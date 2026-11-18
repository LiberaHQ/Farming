'use client';

import { useEffect, useRef, useState } from 'react';
import type { AppearanceChoice } from '@farming/shared';
import type { GameHandle } from '@/game-engine';
import { gameEvents } from '@/game-engine/events/GameEventBus';
import { settings } from '@/game-engine/settings';
import { LocalSaveStore, type SaveStore } from '@/game-engine/state/save';
import { api } from '@/services/api';
import { hostCoop, joinCoop, joinOpenWorld, type SocketSession } from '@/services/coop';
import { CloudSaveStore } from '@/services/saveStores';

/** How many times to try rejoining a co-op game after the connection drops (about 45 seconds in all). */
const RECONNECT_TRIES = 8;

/** Signed-in players save to their account; guests save in the browser. */
async function chooseStore(): Promise<{ store: SaveStore; appearance?: AppearanceChoice; signedIn: boolean }> {
  try {
    const health = await api.health();
    if (!health.database) return { store: new LocalSaveStore(), signedIn: false };
    const { user } = await api.me();
    if (!user) return { store: new LocalSaveStore(), signedIn: false };
    const { profile } = await api.profile();
    return { store: new CloudSaveStore(user.displayName, user.id), appearance: profile.appearance, signedIn: true };
  } catch {
    return { store: new LocalSaveStore(), signedIn: false };
  }
}

/** How this page plays: alone, hosting a co-op world, or joining one with a code. */
export type CoopMode = { kind: 'solo' } | { kind: 'host' } | { kind: 'join'; code: string } | { kind: 'world' };

/**
 * Mounts the Phaser game into a div. The engine is imported dynamically inside
 * the effect, so it only ever loads in the browser (never during SSR). The
 * save (or the shared co-op world) is loaded first, so the game starts
 * directly in the right state.
 */
export function GameCanvas({ seed, mode: modeProp }: { seed: string; mode: CoopMode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // Depend on the mode's values, not the object, so re-renders don't restart the game.
  const modeKey = modeProp.kind === 'join' ? `join:${modeProp.code}` : modeProp.kind;

  useEffect(() => {
    const mode: CoopMode = modeKey.startsWith('join:') ? { kind: 'join', code: modeKey.slice(5) } : modeKey === 'world' ? { kind: 'world' } : modeKey === 'host' ? { kind: 'host' } : { kind: 'solo' };
    let handle: GameHandle | null = null;
    let session: SocketSession | null = null;
    let cancelled = false;
    const cleanups: Array<() => void> = [];
    const engine = import('@/game-engine');

    const start = async (options: { store: SaveStore; appearance?: AppearanceChoice; initialSave?: Awaited<ReturnType<SaveStore['load']>>; coop?: SocketSession | null }) => {
      const { createGame } = await engine;
      if (cancelled || !containerRef.current) return;
      handle?.destroy();
      handle = createGame(containerRef.current, {
        seed: options.coop?.join.room.seed ?? seed,
        store: options.store,
        initialSave: options.initialSave ?? null,
        defaultAppearance: options.appearance,
        coop: options.coop ?? null,
      });
    };

    let startOptions: Parameters<typeof start>[0] | null = null;
    let reconnecting = false;
    /** Sessions the server ended on purpose (restart, everyone left, joined from another tab): no point reconnecting. */
    const closedByServer = new WeakSet<SocketSession>();
    const begin = (s: SocketSession) => {
      session = s;
      s.on('room:closed', () => void closedByServer.add(s));
      s.onDisconnect((reason) => void reconnect(s, reason));
      // Dev-only handle for automated playtests (e.g. dropping the connection on purpose).
      if (process.env.NODE_ENV === 'development') (window as unknown as { __coop?: SocketSession }).__coop = s;
    };

    /**
     * The connection dropped: keep trying to rejoin the same room for a while
     * (Wi-Fi blips, a laptop waking up) instead of ending the session. The game
     * restarts from the server's world with your progress as of the drop.
     */
    const reconnect = async (old: SocketSession, reason: string) => {
      // A room the server closed was already reported by the game (with the server's reason).
      if (cancelled || reconnecting || old !== session || !startOptions || closedByServer.has(old)) return;
      reconnecting = true;
      const latest = handle?.coopState() ?? null;
      const code = old.join.room.code;
      const tries = RECONNECT_TRIES;
      for (let attempt = 1; attempt <= tries && !cancelled; attempt++) {
        gameEvents.emit('coop:reconnecting', { attempt, of: tries });
        await new Promise((r) => setTimeout(r, Math.min(1000 * attempt, 6000)));
        if (cancelled) return;
        try {
          const s = old.join.valley ? await joinOpenWorld() : await joinCoop(code);
          if (cancelled) return void s.close();
          if (latest && s.join.valley) {
            // Open World: the server holds the gold; the rest is your progress as of the drop.
            const serverGold = s.join.me?.player.gold ?? latest.player.gold;
            s.join.me = { ...latest, player: { ...latest.player, gold: serverGold } };
          } else if (latest) {
            // Your own progress as of the drop (fresher than the server's last report). With a shared
            // wallet the server already split the purse when you dropped, so its gold figure stands.
            const serverGold = s.join.me?.player.gold;
            s.join.me = { ...latest, player: { ...latest.player, ...(s.join.settings?.sharedWallet && serverGold !== undefined ? { gold: serverGold } : {}) } };
          }
          begin(s);
          reconnecting = false;
          await start({ ...startOptions, coop: s });
          gameEvents.emit('coop:reconnecting', null);
          gameEvents.emit('toast', { text: 'Reconnected to the co-op game.' });
          return;
        } catch (err) {
          // The room is gone (everyone left, or the server restarted): no point retrying.
          if (err instanceof Error && /No game with that code/i.test(err.message)) break;
        }
      }
      reconnecting = false;
      gameEvents.emit('coop:reconnecting', null);
      gameEvents.emit('coop:ended', { reason: `${reason} Could not reconnect — the game may have ended.` });
    };

    (async () => {
      const { store, appearance, signedIn } = await chooseStore();
      if (mode.kind === 'world') {
        if (!signedIn) throw new UserError('Log in to enter the Open World.');
        setStatus('Entering the Open World…');
        begin(await joinOpenWorld());
        if (cancelled) return;
        startOptions = { store, appearance };
        await start({ store, appearance, coop: session });
      } else if (mode.kind === 'join') {
        if (!signedIn) throw new UserError('Log in to join a friend’s world.');
        setStatus('Joining…');
        begin(await joinCoop(mode.code));
        if (cancelled) return;
        // Co-op reload keeps the room: the URL stays /play?join=CODE.
        startOptions = { store, appearance };
        await start({ store, appearance, coop: session });
      } else if (mode.kind === 'host') {
        if (!signedIn) throw new UserError('Log in to host a co-op world.');
        setStatus('Opening your world to friends…');
        const save = await store.load(seed);
        if (!save) throw new UserError('Play this world once (it saves each morning) before hosting it.');
        begin(await hostCoop(save, new URLSearchParams(window.location.search).get('public') === '1', settings.get().dayLength));
        if (cancelled) return;
        startOptions = { store, appearance };
        await start({ store, appearance, coop: session });
      } else {
        const initialSave = await store.load(seed);
        await start({ store, appearance, initialSave });
        // "Invite friends" in the pause menu: host this world without leaving the page.
        const off = gameEvents.on('coop:hostRequest', ({ save, public: isPublic }) => {
          if (!signedIn) return void gameEvents.emit('toast', { text: 'Log in to host a co-op world.' });
          gameEvents.emit('toast', { text: 'Opening your world to friends…' });
          hostCoop(save, isPublic, settings.get().dayLength)
            .then(async (s) => {
              if (cancelled) return s.close();
              begin(s);
              window.history.replaceState(null, '', `/play?seed=${encodeURIComponent(seed)}&host=1`);
              off();
              startOptions = { store, appearance };
              await start({ store, appearance, coop: s });
            })
            .catch((err: Error) => gameEvents.emit('toast', { text: err.message }));
        });
        cleanups.push(off);
      }
      setStatus(null);
    })().catch((err: unknown) => {
      console.error(err);
      if (cancelled) return;
      setStatus(null);
      setError(err instanceof UserError || (err instanceof Error && mode.kind !== 'solo') ? (err as Error).message : 'The game failed to start. Try reloading the page.');
    });

    return () => {
      cancelled = true;
      cleanups.forEach((c) => c());
      handle?.destroy();
      (session as SocketSession | null)?.close();
    };
  }, [seed, modeKey]);

  return (
    <>
      <div ref={containerRef} className="game-canvas" />
      {status && !error && <div className="hud-loading">{status}</div>}
      {error && (
        <div className="hud-loading hud-error">
          <p>{error}</p>
          <a className="btn btn-primary" href="/start">
            Back to title
          </a>
        </div>
      )}
    </>
  );
}

class UserError extends Error {}
