import type { ClientToServerEvents, CoopJoin, OpAck, ServerToClientEvents, WorldOp } from '@farming/shared';

type Args<F> = F extends (...args: infer A) => unknown ? A : never;

/**
 * The game's view of a co-op connection. The app provides the real one
 * (Socket.IO, in services/coop.ts); the engine never imports a network library.
 */
export interface CoopSession {
  readonly selfId: string;
  /** The world as it was when we joined (the scene restarts from newer snapshots on each new day). */
  readonly join: CoopJoin;
  /** Fire-and-forget events (moves, chat, trade actions…). Ops with replies use `op`. */
  send<K extends Exclude<keyof ClientToServerEvents, 'world:op' | 'room:host' | 'room:join'>>(event: K, ...args: Args<ClientToServerEvents[K]>): void;
  /** Ask the server to change the shared world; resolves with its answer. */
  op(op: WorldOp): Promise<OpAck>;
  on<K extends keyof ServerToClientEvents>(event: K, listener: ServerToClientEvents[K]): () => void;
  /** Leave the room and disconnect. */
  close(): void;
}
