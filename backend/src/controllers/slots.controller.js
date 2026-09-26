const prisma = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { startOfDay } = require('../services/queue.service');

const list = asyncHandler(async (req, res) => {
  const { serviceId, date } = req.query;
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) throw new AppError('Service not found', 404);

  const day = startOfDay(date || new Date());
  const nextDay = new Date(day);
  nextDay.setDate(nextDay.getDate() + 1);

  const slots = await prisma.appointmentSlot.findMany({
    where: { serviceId, startTime: { gte: day, lt: nextDay } },
    orderBy: { startTime: 'asc' },
  });

  const data = slots.map((slot) => ({
    ...slot,
    availableCapacity: slot.capacity - slot.bookedCount,
  }));

  res.json({ success: true, data });
});

/**
 * Generates slots for a service across a date range using its durationMinutes.
 * Simplified admin utility: assumes a 09:00-17:00 operating window.
 */
const generate = asyncHandler(async (req, res) => {
  const { serviceId, date, startHour = 9, endHour = 17, capacity } = req.body;
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) throw new AppError('Service not found', 404);

  const day = startOfDay(date);
  const slotsToCreate = [];
  let cursor = new Date(day);
  cursor.setHours(startHour, 0, 0, 0);
  const end = new Date(day);
  end.setHours(endHour, 0, 0, 0);

  while (cursor < end) {
    const slotEnd = new Date(cursor.getTime() + service.durationMinutes * 60000);
    if (slotEnd > end) break;
    slotsToCreate.push({
      serviceId,
      startTime: new Date(cursor),
      endTime: slotEnd,
      capacity: capacity || service.capacityPerSlot,
    });
    cursor = slotEnd;
  }

  const created = await prisma.$transaction(
    slotsToCreate.map((data) => prisma.appointmentSlot.create({ data }))
  );

  res.status(201).json({ success: true, data: created });
});

module.exports = { list, generate };
