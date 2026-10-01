const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const { attachSocketServer } = require('../services/notification.service');
const { createCorsOriginChecker } = require('../config/cors');

function initSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: createCorsOriginChecker(process.env.CORS_ORIGIN), credentials: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      socket.user = { id: payload.sub, role: payload.role };
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.user.id}`);

    socket.on('queue:subscribe', (serviceId) => {
      if (typeof serviceId === 'string') socket.join(`queue:${serviceId}`);
    });

    socket.on('queue:unsubscribe', (serviceId) => {
      if (typeof serviceId === 'string') socket.leave(`queue:${serviceId}`);
    });
  });

  attachSocketServer(io);
  return io;
}

module.exports = initSockets;
