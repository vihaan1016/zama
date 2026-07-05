import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { allowedOrigins } from '../config.js';
import { logger } from '../logger.js';

let io: Server | null = null;

export function initSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket) => {
    logger.info('socket connected', { id: socket.id });
    // Clients join the global batch feed; per-batch rooms are added in Phase 4.
    socket.on('subscribe', (room: string) => socket.join(room));
    socket.on('unsubscribe', (room: string) => socket.leave(room));
    socket.on('disconnect', () => logger.info('socket disconnected', { id: socket.id }));
  });

  return io;
}

/** Broadcast a lifecycle event to all subscribers. */
export function broadcast(event: string, payload: unknown): void {
  io?.emit(event, payload);
}

export const emit = {
  batchUpdate: (batch: unknown) => broadcast('batch:update', batch),
  orderNew: (order: unknown) => broadcast('order:new', order),
  batchCleared: (batch: unknown) => broadcast('batch:cleared', batch),
  orderFilled: (order: unknown) => broadcast('order:filled', order),
  batchSettled: (batch: unknown) => broadcast('batch:settled', batch),
};
