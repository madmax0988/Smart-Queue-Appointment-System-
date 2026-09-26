const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const createStaff = asyncHandler(async (req, res) => {
  const { name, email, password, serviceIds = [] } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError('An account with this email already exists', 409);

  const passwordHash = await bcrypt.hash(password, 12);
  const staff = await prisma.user.create({ data: { name, email, passwordHash, role: 'STAFF' } });

  if (serviceIds.length) {
    await prisma.staffAssignment.createMany({
      data: serviceIds.map((serviceId) => ({ staffId: staff.id, serviceId })),
      skipDuplicates: true,
    });
  }

  res.status(201).json({ success: true, data: { id: staff.id, name: staff.name, email: staff.email, role: staff.role } });
});

const listStaff = asyncHandler(async (req, res) => {
  const staff = await prisma.user.findMany({
    where: { role: 'STAFF' },
    include: { staffAssignments: { include: { service: true } } },
  });
  res.json({ success: true, data: staff });
});

const assignStaff = asyncHandler(async (req, res) => {
  const { staffId, serviceId } = req.body;
  const assignment = await prisma.staffAssignment.upsert({
    where: { staffId_serviceId: { staffId, serviceId } },
    create: { staffId, serviceId },
    update: {},
  });
  res.status(201).json({ success: true, data: assignment });
});

const analytics = asyncHandler(async (req, res) => {
  const { organizationId } = req.query;
  const serviceFilter = organizationId ? { organizationId } : {};

  const [totalAppointments, completed, cancelled, waiting, services] = await Promise.all([
    prisma.appointment.count({ where: { service: serviceFilter } }),
    prisma.appointment.count({ where: { service: serviceFilter, status: 'COMPLETED' } }),
    prisma.appointment.count({ where: { service: serviceFilter, status: 'CANCELLED' } }),
    prisma.queueEntry.count({ where: { status: 'WAITING', queue: { service: serviceFilter } } }),
    prisma.service.findMany({ where: serviceFilter, select: { id: true, name: true, durationMinutes: true } }),
  ]);

  const completedEntries = await prisma.queueEntry.findMany({
    where: { status: 'COMPLETED', calledAt: { not: null }, completedAt: { not: null }, queue: { service: serviceFilter } },
    select: { calledAt: true, completedAt: true },
    take: 500,
    orderBy: { completedAt: 'desc' },
  });

  const avgWaitMinutes = completedEntries.length
    ? Math.round(
        completedEntries.reduce((sum, e) => sum + (e.completedAt.getTime() - e.calledAt.getTime()) / 60000, 0) /
          completedEntries.length
      )
    : 0;

  res.json({
    success: true,
    data: {
      totalAppointments,
      completed,
      cancelled,
      waiting,
      avgWaitMinutes,
      serviceCount: services.length,
    },
  });
});

module.exports = { createStaff, listStaff, assignStaff, analytics };
