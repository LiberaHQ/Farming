import type { Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@farming/shared';
import type { SessionUser } from '../models/sessionModel';

export interface SocketData {
  user: SessionUser;
  displayName: string;
  roomCode: string | null;
}

export type CoopSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
