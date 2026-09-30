const prisma = require('../config/db');
const AppError = require('../utils/AppError');
const { getOrCreateQueue, generateNextToken, buildQueueSnapshot, reindexPositions } = require('./queue.service');
const { notify, emitQueueUpdate } = require('./notification.service');

/**
 * Core booking logic shared by the REST controller and the AI chatbot tools,
 * so both paths get identical validation, concurrency safety and side effects.
 */
async function bookAppointment(userId, serviceId, slotId) {
  const result = await prisma.$transaction(async (tx) => {
    const [lockedSlot] = await tx.$queryRaw`
      SELECT * FROM "AppointmentSlot" WHERE id = ${slotId} FOR UPDATE
    `;
    if (!lockedSlot) throw new AppError('Appointment slot not found', 404);
    if (lockedSlot.serviceId !== serviceId) throw new AppError('Slot does not belong to the given service', 400);
    if (lockedSlot.bookedCount >= lockedSlot.capacity) {
      throw new AppError('This time slot is fully booked. Please choose another slot.', 409);
    }

    const existing = await tx.appointment.findFirst({
      where: { userId, slotId, status: { in: ['CONFIRMED', 'PENDING'] } },
    });
    if (existing) throw new AppError('You already have an appointment for this slot', 409);

    await tx.appointmentSlot.update({ where: { id: slotId }, data: { bookedCount: { increment: 1 } } });
    const appointment = await tx.appointment.create({ data: { userId, serviceId, slotId, status: 'CONFIRMED' } });

    const queue = await getOrCreateQueue(tx, serviceId, lockedSlot.startTime);
    await tx.$executeRaw`SELECT * FROM "Queue" WHERE id = ${queue.id} FOR UPDATE`;
    const { tokenNumber, tokenLabel, position } = await generateNextToken(tx, queue.id);
    const queueEntry = await tx.queueEntry.create({
      data: { queueId: queue.id, appointmentId: appointment.id, tokenNumber, tokenLabel, position },
    });

    return { appointment, queueEntry, service: await tx.service.findUnique({ where: { id: serviceId } }) };
  });

  await notify(
    userId,
    `Your appointment for ${result.service.name} is confirmed. Your token is ${result.queueEntry.tokenLabel}.`,
    'APPOINTMENT_CONFIRMED'
  );

  const snapshot = await buildQueueSnapshot(prisma, result.queueEntry.queueId, result.service.durationMinutes);
  emitQueueUpdate(serviceId, snapshot);

  return { appointment: result.appointment, token: result.queueEntry.tokenLabel, position: result.queueEntry.position };
}

async function cancelAppointment(userId, role, appointmentId) {
  const result = await prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.findUnique({
      where: { id: appointmentId },
      include: { queueEntry: true, slot: true, service: true },
    });
    if (!appointment) throw new AppError('Appointment not found', 404);
    if (appointment.userId !== userId && role === 'CUSTOMER') {
      throw new AppError('You are not authorized to cancel this appointment', 403);
    }
    if (['CANCELLED', 'COMPLETED'].includes(appointment.status)) {
      throw new AppError('This appointment cannot be cancelled', 400);
    }

    await tx.appointment.update({ where: { id: appointmentId }, data: { status: 'CANCELLED' } });
    await tx.appointmentSlot.update({ where: { id: appointment.slotId }, data: { bookedCount: { decrement: 1 } } });

    if (appointment.queueEntry) {
      await tx.queueEntry.update({ where: { id: appointment.queueEntry.id }, data: { status: 'CANCELLED' } });
      await reindexPositions(tx, appointment.queueEntry.queueId);
    }

    return appointment;
  });

  await notify(result.userId, `Your appointment for ${result.service.name} has been cancelled.`, 'APPOINTMENT_CANCELLED');

  if (result.queueEntry) {
    const snapshot = await buildQueueSnapshot(prisma, result.queueEntry.queueId, result.service.durationMinutes);
    emitQueueUpdate(result.serviceId, snapshot);
  }

  return null;
}

async function rescheduleAppointment(userId, role, appointmentId, newSlotId) {
  const result = await prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.findUnique({
      where: { id: appointmentId },
      include: { queueEntry: true, service: true },
    });
    if (!appointment) throw new AppError('Appointment not found', 404);
    if (appointment.userId !== userId && role === 'CUSTOMER') {
      throw new AppError('You are not authorized to reschedule this appointment', 403);
    }
    if (['CANCELLED', 'COMPLETED'].includes(appointment.status)) {
      throw new AppError('This appointment cannot be rescheduled', 400);
    }

    const [newSlot] = await tx.$queryRaw`SELECT * FROM "AppointmentSlot" WHERE id = ${newSlotId} FOR UPDATE`;
    if (!newSlot) throw new AppError('New slot not found', 404);
    if (newSlot.serviceId !== appointment.serviceId) throw new AppError('New slot must be for the same service', 400);
    if (newSlot.bookedCount >= newSlot.capacity) throw new AppError('New slot is fully booked', 409);

    await tx.appointmentSlot.update({ where: { id: newSlotId }, data: { bookedCount: { increment: 1 } } });
    await tx.appointmentSlot.update({ where: { id: appointment.slotId }, data: { bookedCount: { decrement: 1 } } });

    const updated = await tx.appointment.update({ where: { id: appointmentId }, data: { slotId: newSlotId, status: 'CONFIRMED' } });

    const oldQueueId = appointment.queueEntry?.queueId;
    const queue = await getOrCreateQueue(tx, appointment.serviceId, newSlot.startTime);
    await tx.$executeRaw`SELECT * FROM "Queue" WHERE id = ${queue.id} FOR UPDATE`;
    const { tokenNumber, tokenLabel, position } = await generateNextToken(tx, queue.id);

    // QueueEntry.appointmentId is unique (one queue entry per appointment), so a
    // reschedule must move the existing entry to the new queue/token rather than
    // cancelling it and inserting a second row for the same appointment — that
    // second insert would collide with the still-present cancelled row.
    let queueEntry;
    if (appointment.queueEntry) {
      queueEntry = await tx.queueEntry.update({
        where: { id: appointment.queueEntry.id },
        data: { queueId: queue.id, tokenNumber, tokenLabel, position, status: 'WAITING', calledAt: null, completedAt: null },
      });
    } else {
      queueEntry = await tx.queueEntry.create({
        data: { queueId: queue.id, appointmentId: updated.id, tokenNumber, tokenLabel, position },
      });
    }

    if (oldQueueId && oldQueueId !== queue.id) {
      await reindexPositions(tx, oldQueueId);
    }

    return { appointment: updated, queueEntry, service: appointment.service, oldQueueId };
  });

  await notify(
    userId,
    `Your appointment for ${result.service.name} was rescheduled. Your new token is ${result.queueEntry.tokenLabel}.`,
    'APPOINTMENT_RESCHEDULED'
  );

  const newSnapshot = await buildQueueSnapshot(prisma, result.queueEntry.queueId, result.service.durationMinutes);
  emitQueueUpdate(result.appointment.serviceId, newSnapshot);
  if (result.oldQueueId && result.oldQueueId !== result.queueEntry.queueId) {
    const oldSnapshot = await buildQueueSnapshot(prisma, result.oldQueueId, result.service.durationMinutes);
    emitQueueUpdate(result.appointment.serviceId, oldSnapshot);
  }

  return { appointment: result.appointment, token: result.queueEntry.tokenLabel, position: result.queueEntry.position };
}

module.exports = { bookAppointment, cancelAppointment, rescheduleAppointment };
