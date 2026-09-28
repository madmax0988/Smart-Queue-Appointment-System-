import { io } from 'socket.io-client';

let socket = null;
const listeners = new Set();

export function connectSocket(accessToken) {
  if (socket) {
    socket.disconnect();
  }
  socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000', {
    auth: { token: accessToken },
    autoConnect: true,
  });
  listeners.forEach((cb) => cb(socket));
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    listeners.forEach((cb) => cb(null));
  }
}

/**
 * Subscribes to socket replacement (reconnect after token refresh, or
 * disconnect on logout) so consumers can re-attach their listeners to the
 * live instance instead of holding a reference to a dead socket. Returns an
 * unsubscribe function.
 */
export function onSocketChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}
