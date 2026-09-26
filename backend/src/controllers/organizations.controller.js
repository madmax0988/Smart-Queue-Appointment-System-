const prisma = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const list = asyncHandler(async (req, res) => {
  const organizations = await prisma.organization.findMany({
    include: { services: true },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, data: organizations });
});

const getOne = asyncHandler(async (req, res) => {
  const org = await prisma.organization.findUnique({
    where: { id: req.params.id },
    include: { services: true },
  });
  if (!org) throw new AppError('Organization not found', 404);
  res.json({ success: true, data: org });
});

const create = asyncHandler(async (req, res) => {
  const org = await prisma.organization.create({ data: req.body });
  res.status(201).json({ success: true, data: org });
});

const update = asyncHandler(async (req, res) => {
  const org = await prisma.organization.update({ where: { id: req.params.id }, data: req.body });
  res.json({ success: true, data: org });
});

const remove = asyncHandler(async (req, res) => {
  await prisma.organization.delete({ where: { id: req.params.id } });
  res.json({ success: true, data: null });
});

module.exports = { list, getOne, create, update, remove };
