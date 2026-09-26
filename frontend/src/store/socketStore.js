import { io } from 'socket.io-client';

let socket = null;

export function connectSocket(accessToken) {
  if (socket) {
    socket.disconnect();
  }
  socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000', {
    auth: { token: accessToken },
    autoConnect: true,
  });
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
