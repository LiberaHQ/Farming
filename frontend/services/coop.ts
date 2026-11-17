'use client';

import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, CoopJoin, OpAck, Result, SaveData, ServerToClientEvents, WorldOp } from '@farming/shared';
import type { CoopSession } from '@/game-engine/net/CoopSession';

type CoopSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Where the co-op server is. In development the API runs on port 4000 of the
 * same machine; set NEXT_PUBLIC_COOP_URL when it lives elsewhere. (The session
 * cookie is shared across ports of the same host, so sign-in carries over.)
 */
function serverUrl(): string {
  const configured = process.env.NEXT_PUBLIC_COOP_URL;
  if (configured) return configured;
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:4000`;
}

function connect(): Promise<CoopSocket> {
  return new Promise((resolve, reject) => {
    const socket: CoopSocket = io(serverUrl(), {
      path: '/socket.io',
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: false,
      timeout: 8000,
    });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (err) => {
      socket.close();
      reject(new Error(err.message || 'Could not reach the co-op server.'));
    });
  });
}

class SocketSession implements CoopSession {
  readonly selfId: string;

  constructor(
    private readonly socket: CoopSocket,
    readonly join: CoopJoin,
  ) {
    this.selfId = join.selfId;
  }

  send: CoopSession['send'] = (event, ...args) => {
    (this.socket.emit as (e: string, ...a: unknown[]) => void)(event, ...args);
  };

  op(op: WorldOp): Promise<OpAck> {
    return new Promise((resolve) => {
      this.socket.timeout(8000).emit('world:op', op, (err: Error | null, ack: OpAck) => {
        resolve(err ? { ok: false, reason: 'The server did not answer.' } : ack);
      });
    });
  }

  on: CoopSession['on'] = (event, listener) => {
    this.socket.on(event, listener as never);
    return () => void this.socket.off(event, listener as never);
  };

  close(): void {
    this.socket.emit('room:leave');
    this.socket.close();
  }

  /** Called when the connection drops. */
  onDisconnect(listener: (reason: string) => void): void {
    this.socket.on('disconnect', (reason) => {
      if (reason !== 'io client disconnect') listener('Lost connection to the co-op server.');
    });
  }
}

async function enter(event: 'room:host' | 'room:join', payload: { save: SaveData; public?: boolean } | { code: string }): Promise<SocketSession> {
  const socket = await connect();
  const reply = await new Promise<Result<CoopJoin>>((resolve) => {
    (socket.timeout(15000).emit as (e: string, p: unknown, cb: (err: Error | null, r: Result<CoopJoin>) => void) => void)(event, payload, (err, r) =>
      resolve(err ? { ok: false, error: 'The co-op server did not answer.' } : r),
    );
  });
  if (!reply.ok) {
    socket.close();
    throw new Error(reply.error);
  }
  const { ok: _ok, ...join } = reply;
  return new SocketSession(socket, join);
}

/** Opens your world to friends. The save is uploaded first so the room starts from your latest progress. */
export function hostCoop(save: SaveData, isPublic = false): Promise<SocketSession> {
  return enter('room:host', { save, public: isPublic });
}

export function joinCoop(code: string): Promise<SocketSession> {
  return enter('room:join', { code: code.trim().toUpperCase() });
}

export type { SocketSession };
