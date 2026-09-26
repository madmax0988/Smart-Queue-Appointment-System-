const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { signAccessToken, issueRefreshToken, rotateRefreshToken, revokeRefreshToken } = require('../services/jwt.service');

const toPublicUser = (user) => ({ id: user.id, name: user.name, email: user.email, role: user.role });

const register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError('An account with this email already exists', 409);

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role: role === 'ADMIN' ? 'CUSTOMER' : role || 'CUSTOMER' },
  });

  const accessToken = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user);

  res.status(201).json({ success: true, data: { user: toPublicUser(user), accessToken, refreshToken } });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError('Invalid email or password', 401);

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AppError('Invalid email or password', 401);

  const accessToken = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user);

  res.json({ success: true, data: { user: toPublicUser(user), accessToken, refreshToken } });
});

const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new AppError('Refresh token is required', 400);

  const result = await rotateRefreshToken(refreshToken);
  if (!result) throw new AppError('Invalid or expired refresh token', 401);

  res.json({
    success: true,
    data: {
      user: toPublicUser(result.user),
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    },
  });
});

const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) await revokeRefreshToken(refreshToken);
  res.json({ success: true, data: null });
});

const me = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) throw new AppError('User not found', 404);
  res.json({ success: true, data: toPublicUser(user) });
});

module.exports = { register, login, refresh, logout, me };
