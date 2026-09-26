const prisma = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const list = asyncHandler(async (req, res) => {
  const { organizationId } = req.query;
  const services = await prisma.service.findMany({
    where: organizationId ? { organizationId } : undefined,
    include: { organization: true },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, data: services });
});

const getOne = asyncHandler(async (req, res) => {
  const service = await prisma.service.findUnique({
    where: { id: req.params.id },
    include: { organization: true },
  });
  if (!service) throw new AppError('Service not found', 404);
  res.json({ success: true, data: service });
});

const create = asyncHandler(async (req, res) => {
  const service = await prisma.service.create({ data: req.body });
  res.status(201).json({ success: true, data: service });
});

const update = asyncHandler(async (req, res) => {
  const service = await prisma.service.update({ where: { id: req.params.id }, data: req.body });
  res.json({ success: true, data: service });
});

const remove = asyncHandler(async (req, res) => {
  await prisma.service.delete({ where: { id: req.params.id } });
  res.json({ success: true, data: null });
});

module.exports = { list, getOne, create, update, remove };
