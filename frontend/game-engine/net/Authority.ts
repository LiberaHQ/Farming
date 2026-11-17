import type { OpAck, WorldOp } from '@farming/shared';
import { sfx } from '../audio/sfx';
import { gameEvents } from '../events/GameEventBus';
import type { CoopSession } from './CoopSession';

export type Granted = Extract<OpAck, { ok: true }>;

/**
 * Who decides changes to the shared world. Alone, the game does (changes
 * apply at once). In co-op the server does: the request goes to the server
 * and the change is applied here only once it agrees, so two players can
 * never harvest the same crop or fell the same tree.
 */
export interface Authority {
  readonly online: boolean;
  request(op: WorldOp, apply: (granted: Granted) => void, onRefused?: () => void): void;
}

export class LocalAuthority implements Authority {
  readonly online = false;

  request(_op: WorldOp, apply: (granted: Granted) => void): void {
    apply({ ok: true });
  }
}

export class ServerAuthority implements Authority {
  readonly online = true;

  constructor(private readonly session: CoopSession) {}

  request(op: WorldOp, apply: (granted: Granted) => void, onRefused?: () => void): void {
    void this.session.op(op).then((ack) => {
      if (ack.ok) {
        apply(ack);
        return;
      }
      onRefused?.();
      sfx('error');
      gameEvents.emit('toast', { text: ack.reason });
    });
  }
}
