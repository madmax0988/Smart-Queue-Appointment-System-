const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../config/db');

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email, name: user.name },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
  );
}

function parseExpiryToDate(expiresIn) {
  const match = /^(\d+)([smhd])$/.exec(expiresIn || '7d');
  const amount = match ? parseInt(match[1], 10) : 7;
  const unit = match ? match[2] : 'd';
  const unitMs = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[unit];
  return new Date(Date.now() + amount * unitMs);
}

async function issueRefreshToken(user) {
  const token = crypto.randomBytes(48).toString('hex');
  const expiresAt = parseExpiryToDate(process.env.JWT_REFRESH_EXPIRES_IN);
  await prisma.refreshToken.create({
    data: { token, userId: user.id, expiresAt },
  });
  return token;
}

async function rotateRefreshToken(oldToken) {
  const record = await prisma.refreshToken.findUnique({ where: { token: oldToken } });
  if (!record || record.revoked || record.expiresAt < new Date()) {
    return null;
  }
  // Atomic conditional update: only one concurrent caller can win the
  // revoke-and-rotate race for the same token; the loser gets count 0.
  const { count } = await prisma.refreshToken.updateMany({
    where: { id: record.id, revoked: false },
    data: { revoked: true },
  });
  if (count === 0) return null;
  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (!user) return null;
  const newRefreshToken = await issueRefreshToken(user);
  const accessToken = signAccessToken(user);
  return { accessToken, refreshToken: newRefreshToken, user };
}

async function revokeRefreshToken(token) {
  await prisma.refreshToken.updateMany({ where: { token }, data: { revoked: true } });
}

module.exports = { signAccessToken, issueRefreshToken, rotateRefreshToken, revokeRefreshToken };
