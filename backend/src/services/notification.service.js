const prisma = require('../config/db');

let io = null;

function attachSocketServer(socketServer) {
  io = socketServer;
}

async function notify(userId, message, type) {
  const notification = await prisma.notification.create({
    data: { userId, message, type },
  });

  if (io) {
    io.to(`user:${userId}`).emit('notification:new', notification);
  }

  return notification;
}

function emitQueueUpdate(serviceId, queueSnapshot) {
  if (io) {
    io.to(`queue:${serviceId}`).emit('queue:updated', queueSnapshot);
  }
}

function emitToUser(userId, event, payload) {
  if (io) {
    io.to(`user:${userId}`).emit(event, payload);
  }
}

module.exports = { attachSocketServer, notify, emitQueueUpdate, emitToUser };
