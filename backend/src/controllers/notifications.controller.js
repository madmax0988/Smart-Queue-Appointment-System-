const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

const list = asyncHandler(async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json({ success: true, data: notifications });
});

const markRead = asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.user.id },
    data: { readStatus: true },
  });
  res.json({ success: true, data: null });
});

module.exports = { list, markRead };
