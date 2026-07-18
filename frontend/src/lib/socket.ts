import { io, Socket } from 'socket.io-client';

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

const sockets: Record<string, Socket> = {};

export function getSocket(namespace: string): Socket {
  const key = namespace;
  if (!sockets[key] || !sockets[key].connected) {
    if (sockets[key]) sockets[key].disconnect();
    sockets[key] = io(`${SOCKET_URL}/${namespace}`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
    });
  }
  return sockets[key];
}

export function disconnectAllSockets() {
  Object.values(sockets).forEach((s) => s.disconnect());
}
