import { randomInt } from 'node:crypto';
import type { Server as HttpServer, IncomingMessage } from 'node:http';
import { Server } from 'socket.io';
import {
  COOP,
  isDayLength,
  splitSave,
  validateSave,
  type ClientToServerEvents,
  type CoopJoin,
  type LobbyView,
  type Result,
  type ServerToClientEvents,
} from '@farming/shared';
import { parseCookies, SESSION_COOKIE } from '../api/middleware';
import { config } from '../config';
import { isDatabaseReady } from '../database/db';
import { findMemberState } from '../models/coopModel';
import { findProfile } from '../models/profileModel';
import { findWorldSave } from '../models/worldModel';
import { userForToken } from '../services/authService';
import { storeWorld } from '../services/worldService';
import { OpenWorld } from './openWorld';
import { Room } from './Room';
import type { CoopSocket, SocketData } from './types';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SEED = /^[\w\- ]{1,64}$/;

/** Live rooms by invite code (Open World valleys too). */
const rooms = new Map<string, Room>();
let openWorld: OpenWorld | null = null;

/** The Open World's card on the title screen. */
export async function openWorldStatus(userId: string | null) {
  return openWorld ? openWorld.status(userId) : { online: 0, valleys: 1, resident: null };
}

function newCode(): string {
  for (;;) {
    const code = Array.from({ length: COOP.codeLength }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
    if (!rooms.has(code)) return code;
  }
}

/**
 * Only accept connections from pages served by this same machine (any port)
 * or from origins listed in CORS_ORIGINS. The session cookie is SameSite=Lax,
 * so other sites can't use it anyway; this is a second fence.
 */
function originAllowed(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) return true; // non-browser clients (tests)
  const extra = (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (extra.includes(origin)) return true;
  try {
    const host = (req.headers.host ?? '').split(':')[0];
    return new URL(origin).hostname === host;
  } catch {
    return false;
  }
}

/**
 * Socket.IO for co-op play, on the same HTTP server as the API. Players are
 * signed in with the same session cookie; guests (no account) can't join.
 */
export function attachRealtime(server: HttpServer): Server {
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(server, {
    path: '/socket.io',
    cors: { origin: true, credentials: true },
    allowRequest: (req, callback) => callback(null, originAllowed(req)),
    maxHttpBufferSize: config.maxSaveBytes,
  });

  io.use(async (socket, next) => {
    if (!isDatabaseReady()) return next(new Error('Co-op is offline: the database is unavailable.'));
    const token = parseCookies(socket.handshake.headers.cookie)[SESSION_COOKIE];
    try {
      const user = await userForToken(token);
      if (!user) return next(new Error('Please log in to play co-op.'));
      const profile = await findProfile(user.id);
      socket.data.user = user;
      socket.data.displayName = profile?.display_name ?? user.username;
      socket.data.roomCode = null;
      next();
    } catch {
      next(new Error('Could not check your session.'));
    }
  });

  // The Open World runs its tournament schedule from the start (it waits for the database).
  openWorld = new OpenWorld(rooms);

  io.on('connection', (socket: CoopSocket) => {
    const user = () => ({ id: socket.data.user.id, name: socket.data.displayName });
    const room = () => (socket.data.roomCode ? rooms.get(socket.data.roomCode) : undefined);
    const leaveCurrent = () => {
      room()?.leave(socket.data.user.id, socket);
      socket.data.roomCode = null;
    };
    /** One connection per player per room: an older tab is kicked. */
    const kickOtherTabs = (target: Room) => {
      for (const [, other] of io.of('/').sockets) {
        if (other !== socket && other.data.user?.id === socket.data.user.id && other.data.roomCode === target.code) {
          target.leave(other.data.user.id, other as CoopSocket);
          other.data.roomCode = null;
          other.emit('room:closed', { reason: 'You joined from another tab.' });
        }
      }
    };

    socket.on('room:host', async (payload, ack) => {
      const reply = ack as (r: Result<CoopJoin>) => void;
      try {
        const checked = validateSave(payload?.save);
        if (!checked.ok) return reply({ ok: false, error: `Invalid save: ${checked.error}` });
        const seed = checked.data.seed;
        if (!SEED.test(seed)) return reply({ ok: false, error: 'Invalid world name.' });
        leaveCurrent();
        // Already hosting this world (e.g. after a reload)? Rejoin it; the room's state is newer.
        let target = [...rooms.values()].find((r) => r.ownerId === socket.data.user.id && r.seed === seed);
        if (!target) {
          let save = checked.data;
          try {
            await storeWorld(socket.data.user.id, seed, save);
          } catch {
            // A newer copy is on the server (another device): host that one.
            save = (await findWorldSave(socket.data.user.id, seed)) ?? save;
          }
          const { shared, player } = splitSave(save);
          target = new Room(newCode(), socket.data.user.id, socket.data.displayName, shared, player, (r) => rooms.delete(r.code), payload?.public === true, isDayLength(payload?.dayLength) ? payload.dayLength : 'normal');
          rooms.set(target.code, target);
          console.log(`[coop] ${socket.data.displayName} is hosting "${seed}" as ${target.code}`);
        }
        kickOtherTabs(target);
        socket.data.roomCode = target.code;
        reply({ ok: true, ...target.join(socket, user(), null) });
      } catch (err) {
        console.error('[coop] host failed:', (err as Error).message);
        reply({ ok: false, error: 'Could not start co-op. Try again.' });
      }
    });

    socket.on('room:join', async (payload, ack) => {
      const reply = ack as (r: Result<CoopJoin>) => void;
      try {
        const code = String(payload?.code ?? '').trim().toUpperCase();
        const target = rooms.get(code);
        if (!target) return reply({ ok: false, error: 'No game with that code. Check it with your host.' });
        if (target.valley) return reply({ ok: false, error: 'Join the Open World from the title screen.' });
        if (!target.has(socket.data.user.id) && target.size >= COOP.maxPlayers) {
          return reply({ ok: false, error: `That game is full (${COOP.maxPlayers} players).` });
        }
        leaveCurrent();
        kickOtherTabs(target);
        const me = socket.data.user.id === target.ownerId ? null : await findMemberState(target.ownerId, target.seed, socket.data.user.id);
        socket.data.roomCode = target.code;
        reply({ ok: true, ...target.join(socket, user(), me) });
      } catch (err) {
        console.error('[coop] join failed:', (err as Error).message);
        reply({ ok: false, error: 'Could not join. Try again.' });
      }
    });

    // ---------- The Open World ----------

    socket.on('openworld:join', async (_payload, ack) => {
      const reply = ack as (r: Result<CoopJoin>) => void;
      if (typeof reply !== 'function') return;
      try {
        leaveCurrent();
        const { room: target, join } = await openWorld!.join(socket, user());
        kickOtherTabs(target);
        socket.data.roomCode = target.code;
        reply({ ok: true, ...join });
      } catch (err) {
        console.error('[world] join failed:', (err as Error).message);
        reply({ ok: false, error: 'Could not reach the Open World. Try again.' });
      }
    });
    const tournament = <T,>(work: () => Promise<Result<T>>, ack: unknown) => {
      const reply = ack as (r: Result<T>) => void;
      if (typeof reply !== 'function') return;
      if (!openWorld) return reply({ ok: false, error: 'Join the Open World first.' });
      work()
        .then(reply)
        .catch((err: Error) => {
          console.error('[tournaments]', err.message);
          reply({ ok: false, error: 'Something went wrong. Try again.' });
        });
    };
    socket.on('tournament:list', (_p, ack) => tournament(async () => ({ ok: true as const, ...(await openWorld!.list(id())) }), ack));
    socket.on('tournament:enter', (p, ack) => tournament(() => openWorld!.enter(id(), socket.data.displayName, String(p?.id ?? '')), ack));
    socket.on('dash:start', (p, ack) => tournament(() => openWorld!.startRun(id(), typeof p?.tournamentId === 'string' ? p.tournamentId : null, p?.kit), ack));
    socket.on('dash:finish', (p, ack) => tournament(() => openWorld!.finishRun(id(), String(p?.runId ?? ''), p?.summary), ack));

    socket.on('room:leave', leaveCurrent);
    socket.on('disconnect', leaveCurrent);

    const id = () => socket.data.user.id;
    socket.on('player:move', (p) => room()?.move(id(), p ?? {}));
    socket.on('player:anim', (p) => room()?.anim(id(), p ?? {}));
    socket.on('player:emote', (p) => room()?.emote(id(), p ?? {}));
    socket.on('player:state', (s) => room()?.reportState(id(), s));
    socket.on('sleep:set', (p) => room()?.setInBed(id(), p?.inBed));
    socket.on('world:op', (op, ack) => {
      if (typeof ack !== 'function') return;
      const r = room();
      if (!r) return ack({ ok: false, reason: 'Not in a co-op game.' });
      r.op(id(), op, ack);
    });
    socket.on('chat:send', (p) => room()?.chat(id(), p?.text));
    socket.on('room:settings', (p) => room()?.updateSettings(id(), p));
    socket.on('trade:request', (p) => room()?.requestTrade(id(), p?.to));
    socket.on('trade:respond', (p) => room()?.respondTrade(id(), p?.from, p?.accept));
    socket.on('trade:offer', (o) => room()?.offer(id(), o));
    socket.on('trade:confirm', () => room()?.confirm(id()));
    socket.on('trade:cancel', () => room()?.cancelTrade(id()));
    socket.on('trade:ack', (p) => room()?.ackTrade(id(), p ?? {}));
  });

  return io;
}

/** Public games for the game browser. */
export function publicLobbies(): LobbyView[] {
  return [...rooms.values()].filter((r) => r.isPublic && r.size > 0).map((r) => r.lobbyView());
}

/** Where a player is playing right now, if anywhere. */
export function presenceOf(userId: string): { code: string; seed: string; hostName: string } | null {
  for (const r of rooms.values()) if (r.has(userId)) return { code: r.code, seed: r.seed, hostName: r.leaderName };
  return null;
}

/** Saves every live room (server shutting down). */
export async function closeAllRooms(): Promise<void> {
  await Promise.all([...rooms.values()].map((r) => r.close('The server is restarting.')));
}
