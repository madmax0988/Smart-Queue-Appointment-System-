const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const appointmentsService = require('../services/appointments.service');

const create = asyncHandler(async (req, res) => {
  const { serviceId, slotId } = req.body;
  const data = await appointmentsService.bookAppointment(req.user.id, serviceId, slotId);
  res.status(201).json({ success: true, data });
});

const listMine = asyncHandler(async (req, res) => {
  const appointments = await prisma.appointment.findMany({
    where: { userId: req.user.id },
    include: { service: { include: { organization: true } }, slot: true, queueEntry: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: appointments });
});

const cancel = asyncHandler(async (req, res) => {
  await appointmentsService.cancelAppointment(req.user.id, req.user.role, req.params.id);
  res.json({ success: true, data: null });
});

const reschedule = asyncHandler(async (req, res) => {
  const data = await appointmentsService.rescheduleAppointment(req.user.id, req.user.role, req.params.id, req.body.newSlotId);
  res.json({ success: true, data });
});

module.exports = { create, listMine, cancel, reschedule };
