const prisma = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { buildQueueSnapshot, startOfDay } = require('../services/queue.service');
const { notify, emitQueueUpdate, emitToUser } = require('../services/notification.service');

async function ensureStaffCanAccessService(user, serviceId, tx = prisma) {
  if (user.role === 'ADMIN') return;
  if (user.role === 'STAFF') {
    const assignment = await tx.staffAssignment.findFirst({ where: { staffId: user.id, serviceId } });
    if (!assignment) throw new AppError('You are not assigned to this service', 403);
    return;
  }
  throw new AppError('You do not have permission to manage this queue', 403);
}

const getByService = asyncHandler(async (req, res) => {
  const { serviceId } = req.params;
  const { date } = req.query;
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) throw new AppError('Service not found', 404);

  const day = startOfDay(date || new Date());
  const queue = await prisma.queue.findUnique({ where: { serviceId_queueDate: { serviceId, queueDate: day } } });
  if (!queue) return res.json({ success: true, data: { queueId: null, nowServing: null, waitingCount: 0, entries: [] } });

  const snapshot = await buildQueueSnapshot(prisma, queue.id, service.durationMinutes);
  res.json({ success: true, data: snapshot });
});

const getMyQueueStatus = asyncHandler(async (req, res) => {
  const { appointmentId } = req.params;
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { queueEntry: true, service: true },
  });
  if (!appointment) throw new AppError('Appointment not found', 404);
  if (appointment.userId !== req.user.id && req.user.role === 'CUSTOMER') {
    throw new AppError('You are not authorized to view this appointment', 403);
  }
  if (!appointment.queueEntry) throw new AppError('No queue entry for this appointment', 404);

  const snapshot = await buildQueueSnapshot(prisma, appointment.queueEntry.queueId, appointment.service.durationMinutes);
  const mine = snapshot.entries.find((e) => e.id === appointment.queueEntry.id);

  res.json({
    success: true,
    data: {
      tokenLabel: appointment.queueEntry.tokenLabel,
      status: appointment.queueEntry.status,
      nowServing: snapshot.nowServing,
      position: mine ? mine.position : null,
      estimatedWaitMinutes: mine ? mine.estimatedWaitMinutes : 0,
    },
  });
});

const callNext = asyncHandler(async (req, res) => {
  const { serviceId } = req.params;
  await ensureStaffCanAccessService(req.user, serviceId);

  const result = await prisma.$transaction(async (tx) => {
    const day = startOfDay(new Date());
    const queue = await tx.queue.findUnique({ where: { serviceId_queueDate: { serviceId, queueDate: day } } });
    if (!queue) throw new AppError('No active queue for today', 404);

    const currentlyServing = await tx.queueEntry.findFirst({ where: { queueId: queue.id, status: 'IN_SERVICE' } });
    if (currentlyServing) {
      await tx.queueEntry.update({ where: { id: currentlyServing.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
      await tx.appointment.update({ where: { id: currentlyServing.appointmentId }, data: { status: 'COMPLETED' } });
    }

    const next = await tx.queueEntry.findFirst({
      where: { queueId: queue.id, status: 'WAITING' },
      orderBy: { tokenNumber: 'asc' },
      include: { appointment: true },
    });
    if (!next) return { queueId: queue.id, called: null, completed: currentlyServing };

    await tx.queueEntry.update({ where: { id: next.id }, data: { status: 'IN_SERVICE', calledAt: new Date() } });
    return { queueId: queue.id, called: next, completed: currentlyServing };
  });

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  const snapshot = await buildQueueSnapshot(prisma, result.queueId, service.durationMinutes);
  emitQueueUpdate(serviceId, snapshot);

  if (result.called) {
    await notify(result.called.appointment.userId, `Your token ${result.called.tokenLabel} has been called. Please proceed.`, 'TOKEN_CALLED');
    emitToUser(result.called.appointment.userId, 'token:called', { tokenLabel: result.called.tokenLabel });
  }

  const upNext = snapshot.entries.find((e) => e.position === 1);
  if (upNext) {
    const nextEntry = await prisma.queueEntry.findUnique({ where: { id: upNext.id }, include: { appointment: true } });
    await notify(nextEntry.appointment.userId, `Your turn is approaching. Token ${upNext.tokenLabel} is next.`, 'TURN_APPROACHING');
  }

  res.json({ success: true, data: snapshot });
});

const updateEntryStatus = asyncHandler(async (req, res) => {
  const { serviceId, entryId } = req.params;
  const { status } = req.body;
  await ensureStaffCanAccessService(req.user, serviceId);

  const validTransitions = ['SKIPPED', 'CANCELLED', 'WAITING', 'COMPLETED'];
  if (!validTransitions.includes(status)) throw new AppError('Invalid status transition', 400);

  const entry = await prisma.$transaction(async (tx) => {
    const existing = await tx.queueEntry.findUnique({ where: { id: entryId }, include: { appointment: true } });
    if (!existing) throw new AppError('Queue entry not found', 404);

    const updated = await tx.queueEntry.update({
      where: { id: entryId },
      data: { status, completedAt: status === 'COMPLETED' ? new Date() : undefined },
    });

    if (status === 'COMPLETED') {
      await tx.appointment.update({ where: { id: existing.appointmentId }, data: { status: 'COMPLETED' } });
    } else if (status === 'CANCELLED') {
      await tx.appointment.update({ where: { id: existing.appointmentId }, data: { status: 'CANCELLED' } });
    }

    return { updated, appointment: existing.appointment };
  });

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  const snapshot = await buildQueueSnapshot(prisma, entry.updated.queueId, service.durationMinutes);
  emitQueueUpdate(serviceId, snapshot);

  res.json({ success: true, data: snapshot });
});

module.exports = { getByService, getMyQueueStatus, callNext, updateEntryStatus };
