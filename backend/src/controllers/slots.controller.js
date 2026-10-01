const prisma = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { startOfDay } = require('../services/queue.service');

const DEFAULT_START_HOUR = 9;
const DEFAULT_END_HOUR = 17;

/**
 * Builds the slot rows for one service/day using its durationMinutes,
 * shared by both the admin-triggered generator and the on-demand
 * auto-generation in `list` below.
 */
function buildDaySlots(service, day, { startHour = DEFAULT_START_HOUR, endHour = DEFAULT_END_HOUR, capacity } = {}) {
  const slots = [];
  let cursor = new Date(day);
  cursor.setHours(startHour, 0, 0, 0);
  const end = new Date(day);
  end.setHours(endHour, 0, 0, 0);

  while (cursor < end) {
    const slotEnd = new Date(cursor.getTime() + service.durationMinutes * 60000);
    if (slotEnd > end) break;
    slots.push({
      serviceId: service.id,
      startTime: new Date(cursor),
      endTime: slotEnd,
      capacity: capacity || service.capacityPerSlot,
    });
    cursor = slotEnd;
  }
  return slots;
}

const list = asyncHandler(async (req, res) => {
  const { serviceId, date } = req.query;
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) throw new AppError('Service not found', 404);

  const day = startOfDay(date || new Date());
  const nextDay = new Date(day);
  nextDay.setDate(nextDay.getDate() + 1);

  let slots = await prisma.appointmentSlot.findMany({
    where: { serviceId, startTime: { gte: day, lt: nextDay } },
    orderBy: { startTime: 'asc' },
  });

  // No slots exist yet for this day: auto-generate the default operating
  // window so customers always see availability without depending on an
  // admin remembering to run slot generation for every upcoming date.
  // Never backfills past dates - a day that's already gone stays empty.
  const todayStart = startOfDay(new Date());
  if (slots.length === 0 && day >= todayStart) {
    const toCreate = buildDaySlots(service, day);
    if (toCreate.length) {
      await prisma.appointmentSlot.createMany({ data: toCreate, skipDuplicates: true });
      slots = await prisma.appointmentSlot.findMany({
        where: { serviceId, startTime: { gte: day, lt: nextDay } },
        orderBy: { startTime: 'asc' },
      });
    }
  }

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
  const { serviceId, date, startHour = DEFAULT_START_HOUR, endHour = DEFAULT_END_HOUR, capacity } = req.body;
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) throw new AppError('Service not found', 404);

  const day = startOfDay(date);
  const nextDay = new Date(day);
  nextDay.setDate(nextDay.getDate() + 1);

  const existing = await prisma.appointmentSlot.findMany({
    where: { serviceId, startTime: { gte: day, lt: nextDay } },
    select: { startTime: true },
  });
  const existingTimes = new Set(existing.map((s) => s.startTime.getTime()));

  const slotsToCreate = buildDaySlots(service, day, { startHour, endHour, capacity })
    .filter((slot) => !existingTimes.has(slot.startTime.getTime()));

  if (slotsToCreate.length) {
    await prisma.appointmentSlot.createMany({ data: slotsToCreate, skipDuplicates: true });
  }

  res.status(201).json({ success: true, data: slotsToCreate });
});

module.exports = { list, generate };
