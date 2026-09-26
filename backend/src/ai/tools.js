const prisma = require('../config/db');
const AppError = require('../utils/AppError');
const { buildQueueSnapshot, startOfDay } = require('../services/queue.service');
const appointmentsService = require('../services/appointments.service');

/**
 * Every tool receives `ctx` (the authenticated user's id/role, taken from the
 * verified JWT — never from the LLM) plus the model-supplied `args`. Tools
 * never trust an identity field coming from `args`; the chatbot cannot act as
 * another user regardless of what the model is prompted to send.
 */

async function getAvailableServices(ctx, args) {
  const { organizationId } = args;
  const services = await prisma.service.findMany({
    where: organizationId ? { organizationId } : undefined,
    include: { organization: true },
  });
  return services.map((s) => ({
    id: s.id,
    name: s.name,
    organization: s.organization.name,
    organizationId: s.organizationId,
    durationMinutes: s.durationMinutes,
    description: s.description,
  }));
}

async function getAvailableSlots(ctx, args) {
  const { serviceId, date } = args;
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) return { error: 'Service not found' };

  const day = startOfDay(date || new Date());
  const nextDay = new Date(day);
  nextDay.setDate(nextDay.getDate() + 1);

  const slots = await prisma.appointmentSlot.findMany({
    where: { serviceId, startTime: { gte: day, lt: nextDay } },
    orderBy: { startTime: 'asc' },
  });

  return slots
    .filter((s) => s.bookedCount < s.capacity)
    .map((s) => ({
      slotId: s.id,
      startTime: s.startTime,
      endTime: s.endTime,
      availableCapacity: s.capacity - s.bookedCount,
    }));
}

async function getMyAppointments(ctx) {
  const appointments = await prisma.appointment.findMany({
    where: { userId: ctx.userId },
    include: { service: true, slot: true, queueEntry: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  return appointments.map((a) => ({
    appointmentId: a.id,
    service: a.service.name,
    status: a.status,
    startTime: a.slot.startTime,
    tokenLabel: a.queueEntry ? a.queueEntry.tokenLabel : null,
  }));
}

async function getQueueStatus(ctx, args) {
  const { appointmentId } = args;
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { queueEntry: true, service: true },
  });
  if (!appointment) return { error: 'Appointment not found' };
  if (appointment.userId !== ctx.userId && ctx.role === 'CUSTOMER') {
    return { error: 'Not authorized to view this appointment' };
  }
  if (!appointment.queueEntry) return { error: 'No queue entry for this appointment' };

  const snapshot = await buildQueueSnapshot(prisma, appointment.queueEntry.queueId, appointment.service.durationMinutes);
  const mine = snapshot.entries.find((e) => e.id === appointment.queueEntry.id);
  return {
    tokenLabel: appointment.queueEntry.tokenLabel,
    status: appointment.queueEntry.status,
    nowServing: snapshot.nowServing,
    position: mine ? mine.position : null,
    estimatedWaitMinutes: mine ? mine.estimatedWaitMinutes : 0,
  };
}

/**
 * Booking requires args.confirm === true. The system prompt instructs the
 * model to first present the slot to the user in plain language and only
 * call this tool with confirm:true after the user explicitly agrees.
 */
async function createAppointment(ctx, args) {
  const { serviceId, slotId, confirm } = args;
  if (!confirm) return { requiresConfirmation: true, message: 'Ask the user to confirm before booking.' };

  try {
    return await appointmentsService.bookAppointment(ctx.userId, serviceId, slotId);
  } catch (err) {
    return { error: err.message || 'Failed to create appointment' };
  }
}

async function cancelAppointment(ctx, args) {
  const { appointmentId, confirm } = args;
  if (!confirm) return { requiresConfirmation: true, message: 'Ask the user to confirm before cancelling.' };

  try {
    await appointmentsService.cancelAppointment(ctx.userId, ctx.role, appointmentId);
    return { success: true };
  } catch (err) {
    return { error: err.message || 'Failed to cancel appointment' };
  }
}

async function rescheduleAppointment(ctx, args) {
  const { appointmentId, newSlotId, confirm } = args;
  if (!confirm) return { requiresConfirmation: true, message: 'Ask the user to confirm before rescheduling.' };

  try {
    return await appointmentsService.rescheduleAppointment(ctx.userId, ctx.role, appointmentId, newSlotId);
  } catch (err) {
    return { error: err.message || 'Failed to reschedule appointment' };
  }
}

async function getOrganizationInformation(ctx, args) {
  const { organizationId } = args;
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, include: { services: true } });
  if (!org) return { error: 'Organization not found' };
  return {
    name: org.name,
    description: org.description,
    address: org.address,
    operatingHours: org.operatingHours,
    services: org.services.map((s) => ({ id: s.id, name: s.name, durationMinutes: s.durationMinutes })),
  };
}

const TOOL_DEFINITIONS = [
  {
    name: 'getAvailableServices',
    description: "Lists services offered, optionally filtered by organization. Use to answer 'what services do you offer' or before booking.",
    input_schema: {
      type: 'object',
      properties: { organizationId: { type: 'string', description: 'Optional organization id to filter by' } },
    },
  },
  {
    name: 'getAvailableSlots',
    description: 'Lists open appointment slots for a service on a given date (YYYY-MM-DD). Use before booking to show real options.',
    input_schema: {
      type: 'object',
      properties: {
        serviceId: { type: 'string' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD format, defaults to today' },
      },
      required: ['serviceId'],
    },
  },
  {
    name: 'getMyAppointments',
    description: "Lists the authenticated user's own appointments and their status.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'getQueueStatus',
    description: 'Gets the live queue position, now-serving token, and estimated wait for a specific appointment.',
    input_schema: { type: 'object', properties: { appointmentId: { type: 'string' } }, required: ['appointmentId'] },
  },
  {
    name: 'createAppointment',
    description: 'Books an appointment for a specific service and slot. Must only be called with confirm:true after the user has explicitly confirmed the exact service, date and time.',
    input_schema: {
      type: 'object',
      properties: {
        serviceId: { type: 'string' },
        slotId: { type: 'string' },
        confirm: { type: 'boolean', description: 'Set true only after explicit user confirmation' },
      },
      required: ['serviceId', 'slotId'],
    },
  },
  {
    name: 'cancelAppointment',
    description: 'Cancels an existing appointment. Must only be called with confirm:true after explicit user confirmation.',
    input_schema: {
      type: 'object',
      properties: { appointmentId: { type: 'string' }, confirm: { type: 'boolean' } },
      required: ['appointmentId'],
    },
  },
  {
    name: 'rescheduleAppointment',
    description: 'Reschedules an existing appointment to a new slot. Must only be called with confirm:true after explicit user confirmation.',
    input_schema: {
      type: 'object',
      properties: { appointmentId: { type: 'string' }, newSlotId: { type: 'string' }, confirm: { type: 'boolean' } },
      required: ['appointmentId', 'newSlotId'],
    },
  },
  {
    name: 'getOrganizationInformation',
    description: 'Gets details about an organization: description, address, operating hours and its services.',
    input_schema: { type: 'object', properties: { organizationId: { type: 'string' } }, required: ['organizationId'] },
  },
];

const TOOL_IMPLEMENTATIONS = {
  getAvailableServices,
  getAvailableSlots,
  getMyAppointments,
  getQueueStatus,
  createAppointment,
  cancelAppointment,
  rescheduleAppointment,
  getOrganizationInformation,
};

module.exports = { TOOL_DEFINITIONS, TOOL_IMPLEMENTATIONS };
