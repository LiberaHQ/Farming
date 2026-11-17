'use client';

import { MenuNav } from './MenuNav';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { LobbyView, WorldSummary } from '@farming/shared';
import { LocalSaveStore } from '@/game-engine/state/save';
import { downloadSave, readSaveFile } from '@/game-engine/state/saveFile';
import { useSession } from '@/hooks/useSession';
import { WalletLogin } from '@/components/wallet';
import { api, cleanSeed, randomSeed } from '@/services/api';

interface WorldEntry extends WorldSummary {
  where: 'cloud' | 'browser' | 'both';
}

const timeAgo = (ms: number) => {
  const mins = Math.round((Date.now() - ms) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(ms).toLocaleDateString();
};

/** Main menu: account, saved worlds, and starting a new world. */
export function TitleScreen() {
  const router = useRouter();
  const { user, online, logout, refresh } = useSession();
  const [worlds, setWorlds] = useState<WorldEntry[] | null>(null);
  const [seed, setSeed] = useState('');
  const [seedError, setSeedError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [lobbies, setLobbies] = useState<LobbyView[] | null>(null);
  const [friends, setFriends] = useState<Array<{ username: string; displayName: string; playing: { code: string; seed: string; hostName: string } | null }> | null>(null);
  const [friendName, setFriendName] = useState('');
  const [friendMsg, setFriendMsg] = useState<string | null>(null);

  const refreshSocial = () => {
    api.lobbies().then((r) => setLobbies(r.lobbies)).catch(() => setLobbies([]));
    if (user) api.friends().then((r) => setFriends(r.friends)).catch(() => setFriends([]));
  };
  useEffect(() => {
    if (user === undefined) return;
    refreshSocial();
    const t = setInterval(refreshSocial, 15_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const exportWorld = async (w: WorldEntry) => {
    const save = new LocalSaveStore().read(w.seed) ?? (user ? await api.loadWorld(w.seed).catch(() => null) : null);
    if (save) downloadSave(save);
    else setImportMsg(`Couldn't load “${w.seed}” to export it.`);
  };

  const importWorld = async (file: File | undefined) => {
    if (!file) return;
    const result = await readSaveFile(file);
    if (!result.ok) return setImportMsg(result.error);
    const save = { ...result.save, savedAt: Date.now() };
    const existing = worlds?.find((w) => w.seed === save.seed);
    if (existing && !window.confirm(`You already have a world called “${save.seed}” (day ${existing.day}). Replace it with the imported save (day ${save.time.day})?`)) return;
    if (!new LocalSaveStore().write(save)) return setImportMsg("Couldn't store the save in this browser (storage full or blocked).");
    if (user) await api.saveWorld(save).catch(() => undefined);
    router.push(`/play?seed=${encodeURIComponent(save.seed)}`);
  };

  useEffect(() => setSeed(randomSeed()), []);

  useEffect(() => {
    if (user === undefined) return;
    let cancelled = false;
    (async () => {
      const local = new LocalSaveStore().list();
      const cloud = user ? await api.worlds().then((r) => r.worlds).catch(() => [] as WorldSummary[]) : [];
      const merged = new Map<string, WorldEntry>();
      for (const w of cloud) merged.set(w.seed, { ...w, where: 'cloud' });
      for (const w of local) {
        const existing = merged.get(w.seed);
        if (!existing) merged.set(w.seed, { ...w, where: 'browser' });
        else merged.set(w.seed, { ...(w.savedAt > existing.savedAt ? w : existing), where: 'both' });
      }
      if (!cancelled) setWorlds([...merged.values()].sort((a, b) => b.savedAt - a.savedAt));
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const play = (name: string) => router.push(`/play?seed=${encodeURIComponent(name)}`);
  const startNew = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = cleanSeed(seed);
    if (!clean) {
      setSeedError('Use letters, numbers, spaces, - or _ (up to 64).');
      return;
    }
    play(clean);
  };
  const existing = worlds?.find((w) => w.seed === cleanSeed(seed));

  return (
    <main className="menu-page">
      <MenuNav />
      <header className="title">
        <h1>Valley</h1>
        <p className="hud-muted">Farm, gather, craft and build in a cosy pixel world.</p>
      </header>

      <section className="card account">
        {user === undefined ? (
          <span className="hud-muted">Checking your account…</span>
        ) : user ? (
          <>
            <span>
              Signed in as <strong>{user.wallet ? '🦊 ' : ''}{user.displayName}</strong>
              <span className="hud-muted"> · your worlds are saved to your account</span>
            </span>
            <span className="account-actions">
              <Link className="btn" href="/profile">
                Profile
              </Link>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const wasWallet = !!user.wallet;
                  void logout().then(async () => {
                    if (wasWallet) await (await import('@/components/wallet/WalletLogin')).disconnectWallet();
                  });
                }}
              >
                Log out
              </button>
            </span>
          </>
        ) : online ? (
          <>
            <span>
              Playing as a <strong>guest</strong>
              <span className="hud-muted"> · saves stay in this browser</span>
            </span>
            <span className="account-actions">
              <Link className="btn" href="/login">
                Log in
              </Link>
              <Link className="btn btn-primary" href="/register">
                Create account
              </Link>
              <WalletLogin signedIn={false} onSignedIn={refresh} />
            </span>
          </>
        ) : (
          <span className="hud-muted">
            The server is offline, so accounts are unavailable. You can still play; saves stay in this browser.
          </span>
        )}
      </section>

      <section className="card">
        <h2>Your worlds</h2>
        {worlds === null ? (
          <p className="hud-muted">Loading…</p>
        ) : worlds.length === 0 ? (
          <p className="hud-muted">No saved worlds yet. Start one below!</p>
        ) : (
          <ul className="world-list">
            {worlds.map((w) => (
              <li key={w.seed}>
                <div className="world-info">
                  <strong>{w.seed}</strong>
                  <span className="hud-muted">
                    Day {w.day} · {w.gold}g · saved {timeAgo(w.savedAt)}
                    {w.where === 'browser' && user ? ' · this browser only (syncs when you play)' : ''}
                  </span>
                </div>
                <span className="world-actions">
                  {user && (
                    <button
                      type="button"
                      className="btn"
                      title="Open this world to friends"
                      onClick={() => router.push(`/play?seed=${encodeURIComponent(w.seed)}&host=1`)}
                    >
                      Host co-op
                    </button>
                  )}
                  <button type="button" className="btn" title="Download this world as a save file" onClick={() => void exportWorld(w)}>
                    Export
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => play(w.seed)}>
                    Continue
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {user && (
        <section className="card">
          <h2>
            Open games <button type="button" className="btn btn-small" onClick={refreshSocial}>Refresh</button>
          </h2>
          {lobbies === null ? (
            <p className="hud-muted">Looking for games…</p>
          ) : lobbies.length === 0 ? (
            <p className="hud-muted">No public games right now. Host one from the pause menu with “Open to everyone”.</p>
          ) : (
            <ul className="world-list">
              {lobbies.map((l) => (
                <li key={l.code}>
                  <div className="world-info">
                    <strong>{l.hostName}&apos;s farm</strong>
                    <span className="hud-muted">
                      “{l.seed}” · day {l.day} · {l.players}/{l.max} players
                    </span>
                  </div>
                  <button type="button" className="btn btn-primary" disabled={l.players >= l.max} onClick={() => router.push(`/play?join=${l.code}`)}>
                    {l.players >= l.max ? 'Full' : 'Join'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {user && (
        <section className="card">
          <h2>Friends</h2>
          <form
            className="new-world-row"
            onSubmit={(e) => {
              e.preventDefault();
              setFriendMsg(null);
              api
                .addFriend(friendName)
                .then(() => {
                  setFriendName('');
                  refreshSocial();
                })
                .catch((err: Error) => setFriendMsg(err.message));
            }}
          >
            <input className="input" placeholder="Add a friend by username" value={friendName} maxLength={32} onChange={(e) => setFriendName(e.target.value)} />
            <button type="submit" className="btn" disabled={!friendName.trim()}>
              Add
            </button>
          </form>
          {friendMsg && <p className="form-error">{friendMsg}</p>}
          {friends && friends.length === 0 && <p className="hud-muted">No friends yet. Add someone by their username.</p>}
          {friends && friends.length > 0 && (
            <ul className="world-list">
              {friends.map((f) => (
                <li key={f.username}>
                  <div className="world-info">
                    <strong>{f.displayName}</strong>
                    <span className="hud-muted">
                      @{f.username} · {f.playing ? `playing on ${f.playing.hostName}'s farm` : 'offline'}
                    </span>
                  </div>
                  <span className="world-actions">
                    {f.playing && (
                      <button type="button" className="btn btn-primary" onClick={() => router.push(`/play?join=${f.playing!.code}`)}>
                        Join
                      </button>
                    )}
                    <button type="button" className="btn" onClick={() => void api.removeFriend(f.username).then(refreshSocial)}>
                      Remove
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="card">
        <h2>Import a save</h2>
        <p className="hud-muted">Load a save file exported from the pause menu (or the Export button above), from any browser.</p>
        <label className="btn import-btn">
          Choose save file…
          <input type="file" accept="application/json,.json" hidden onChange={(e) => void importWorld(e.target.files?.[0])} />
        </label>
        {importMsg && <p className="form-error">{importMsg}</p>}
      </section>

      <section className="card">
        <h2>Join a friend</h2>
        {user ? (
          <form
            className="new-world"
            onSubmit={(e) => {
              e.preventDefault();
              const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
              if (clean) router.push(`/play?join=${clean}`);
            }}
          >
            <label htmlFor="code" className="hud-muted">
              Enter the code your friend sees in their game (they host from the pause menu or “Host co-op” here).
            </label>
            <div className="new-world-row">
              <input id="code" className="input code-input" value={code} maxLength={8} placeholder="ABC234" onChange={(e) => setCode(e.target.value.toUpperCase())} />
              <button type="submit" className="btn btn-primary" disabled={!code.trim()}>
                Join
              </button>
            </div>
          </form>
        ) : (
          <p className="hud-muted">Co-op needs an account. Log in or create one to host your world or join a friend.</p>
        )}
      </section>

      <section className="card">
        <h2>New world</h2>
        <form className="new-world" onSubmit={startNew}>
          <label htmlFor="seed" className="hud-muted">
            World name (the same name always makes the same map)
          </label>
          <div className="new-world-row">
            <input
              id="seed"
              className="input"
              value={seed}
              maxLength={64}
              onChange={(e) => {
                setSeed(e.target.value);
                setSeedError(null);
              }}
            />
            <button type="button" className="btn" onClick={() => setSeed(randomSeed())} title="Random name">
              Shuffle
            </button>
            <button type="submit" className="btn btn-primary">
              {existing ? 'Continue' : 'Start'}
            </button>
          </div>
          {seedError && <p className="form-error">{seedError}</p>}
          {existing && !seedError && <p className="hud-muted">You already have a save for this world; it will be continued.</p>}
        </form>
      </section>
    </main>
  );
}
