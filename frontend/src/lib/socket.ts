import { io, Socket } from 'socket.io-client'

const socket: Socket = io(import.meta.env.VITE_API_BASE_URL ?? '', {
  autoConnect: false,
  path: '/socket.io',
  reconnectionAttempts: 5,
  reconnectionDelay: 1_000,
  timeout: 5_000,
  transports: ['websocket', 'polling'],
})

export function connectSocket() {
  if (!socket.connected) socket.connect()
}

export { socket }
