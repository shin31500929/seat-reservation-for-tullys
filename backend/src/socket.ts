import { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';

let io: Server | undefined;

export function initSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: { origin: '*' },
  });
  return io;
}

export function getSocket(): Server {
  if (!io) {
    throw new Error('Socket.IO is not initialized');
  }
  return io;
}
