'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TOURNAMENT_TIERS, type LobbyView, type WorldSummary } from '@farming/shared';
import { LocalSaveStore } from '@/game-engine/state/save';
import { downloadSave, readSaveFile } from '@/game-engine/state/saveFile';
import { api, cleanSeed, randomSeed, type SessionUser } from '@/services/api';

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

/**
 * Everything for starting to play, on the dashboard: a new world, your saved
 * worlds (this browser's and your account's), importing a save, the Open World,
 * joining a friend's code, public farms and friends.
 */
export function PlayHub({ user }: { user: SessionUser | null }) {
  const router = useRouter();
  const [worlds, setWorlds] = useState<WorldEntry[] | null>(null);
  const [seed, setSeed] = useState('');
  const [seedError, setSeedError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [lobbies, setLobbies] = useState<LobbyView[] | null>(null);
  const [world, setWorld] = useState<{ online: number; valleys: number; resident: { valley: string } | null } | null>(null);
  const [friends, setFriends] = useState<Array<{ username: string; displayName: string; playing: { code: string; seed: string; hostName: string } | null }> | null>(null);
  const [friendName, setFriendName] = useState('');
  const [friendMsg, setFriendMsg] = useState<string | null>(null);

  const refreshSocial = () => {
    api.lobbies().then((r) => setLobbies(r.lobbies)).catch(() => setLobbies([]));
    api.openWorld().then(setWorld).catch(() => setWorld(null));
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
    const save = new LocalSaveStore(user?.id).read(w.seed) ?? (user ? await api.loadWorld(w.seed).catch(() => null) : null);
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
    if (!new LocalSaveStore(user?.id).write(save)) return setImportMsg("Couldn't store the save in this browser (storage full or blocked).");
    if (user) await api.saveWorld(save).catch(() => undefined);
    router.push(`/play?seed=${encodeURIComponent(save.seed)}`);
  };

  useEffect(() => setSeed(randomSeed()), []);

  useEffect(() => {
    if (user === undefined) return;
    let cancelled = false;
    (async () => {
      const local = new LocalSaveStore(user?.id).list();
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
    <div className="dash-grid play-hub" id="play">
        {/* Playing: a new world, your worlds, importing a save. */}
        <div className="dash-stack">
          <section className="dash-card">
            <header className="dash-card-head">
              <h2>New world</h2>
            </header>
            <form className="title-form" onSubmit={startNew}>
              <label htmlFor="seed" className="dash-muted">
                World name (the same name always makes the same map)
              </label>
              <div className="dash-row">
                <input
                  id="seed"
                  className="dash-input"
                  value={seed}
                  maxLength={64}
                  onChange={(e) => {
                    setSeed(e.target.value);
                    setSeedError(null);
                  }}
                />
                <button type="button" className="dash-btn" onClick={() => setSeed(randomSeed())} title="Random name" aria-label="Random name">
                  🎲
                </button>
                <button type="submit" className="dash-btn dash-btn-orange">
                  {existing ? 'Continue' : 'Start'}
                </button>
              </div>
              {seedError && <p className="dash-error-text">{seedError}</p>}
              {existing && !seedError && <p className="dash-muted">You already have a save for this world; it will be continued.</p>}
            </form>
          </section>

          <section className="dash-card">
            <header className="dash-card-head">
              <h2>Your worlds</h2>
              {worlds && worlds.length > 0 && <span className="dash-muted">{worlds.length}</span>}
            </header>
            {worlds === null ? (
              <p className="dash-muted">Loading…</p>
            ) : worlds.length === 0 ? (
              <p className="dash-muted">No saved worlds yet. Start one above!</p>
            ) : (
              <ul className="title-list">
                {worlds.map((w) => (
                  <li key={w.seed}>
                    <div className="title-list-info">
                      <strong>{w.seed}</strong>
                      <span className="dash-muted">
                        Day {w.day} · {w.gold}g · saved {timeAgo(w.savedAt)}
                        {w.where === 'browser' && user ? ' · this browser only (syncs when you play)' : ''}
                      </span>
                    </div>
                    <div className="title-list-actions">
                      {user && (
                        <button type="button" className="dash-btn dash-btn-small" title="Open this world to friends" onClick={() => router.push(`/play?seed=${encodeURIComponent(w.seed)}&host=1`)}>
                          Host co-op
                        </button>
                      )}
                      <button type="button" className="dash-btn dash-btn-small" title="Download this world as a save file" onClick={() => void exportWorld(w)}>
                        Export
                      </button>
                      <button type="button" className="dash-btn dash-btn-small dash-btn-orange" onClick={() => play(w.seed)}>
                        Continue
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="dash-card">
            <header className="dash-card-head">
              <h2>Import a save</h2>
            </header>
            <p className="dash-muted">Load a save file exported from the pause menu (or the Export button above), from any browser.</p>
            <label className="dash-btn title-import">
              📂 Choose save file…
              <input type="file" accept="application/json,.json" hidden onChange={(e) => void importWorld(e.target.files?.[0])} />
            </label>
            {importMsg && <p className="dash-error-text">{importMsg}</p>}
          </section>
        </div>

        {/* Playing with others: the Open World, a friend's code, public farms, friends. */}
        <div className="dash-stack">
          <section className="dash-card title-open-world">
            <header className="dash-card-head">
              <h2>Open World</h2>
              {user && (
                <button type="button" className="dash-chip" onClick={refreshSocial}>
                  ↻ Refresh
                </button>
              )}
            </header>
            <div className="title-ow">
              <div>
                <h3>🌍 A public valley everyone shares</h3>
                <p className="dash-muted">
                  {world ? `${world.online} playing now · ${world.valleys} valley${world.valleys > 1 ? 's' : ''}` : 'Free to join.'}
                  {world?.resident ? ` · you live in ${world.resident.valley}` : ''}
                </p>
                <p>Get your own plot, farm and earn gold, then spend it on Mine Dash tournaments.</p>
              </div>
              <div className="title-tiers">
                {(['bronze', 'silver', 'gold'] as const).map((t) => (
                  <span key={t} className={`title-tier tier-${t}`}>
                    🏆 {TOURNAMENT_TIERS[t].name} · {TOURNAMENT_TIERS[t].fee.toLocaleString()}g
                    <small>{t === 'bronze' ? 'every hour' : t === 'silver' ? 'every 4 hours' : 'daily'}</small>
                  </span>
                ))}
              </div>
              {user ? (
                <button type="button" className="dash-btn dash-btn-orange title-ow-go" onClick={() => router.push('/play?world=1')}>
                  {world?.resident ? 'Continue in the Open World' : 'Join the Open World'}
                </button>
              ) : (
                <p className="dash-muted">Log in or create an account to join.</p>
              )}
            </div>
          </section>

          <section className="dash-card">
            <header className="dash-card-head">
              <h2>Join a friend</h2>
            </header>
            {user ? (
              <form
                className="title-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
                  if (clean) router.push(`/play?join=${clean}`);
                }}
              >
                <label htmlFor="code" className="dash-muted">
                  Enter the code your friend sees in their game (they host from the pause menu or “Host co-op”).
                </label>
                <div className="dash-row">
                  <input id="code" className="dash-input title-code" value={code} maxLength={8} placeholder="ABC234" onChange={(e) => setCode(e.target.value.toUpperCase())} />
                  <button type="submit" className="dash-btn dash-btn-orange" disabled={!code.trim()}>
                    Join
                  </button>
                </div>
              </form>
            ) : (
              <p className="dash-muted">Co-op needs an account. Log in or create one to host your world or join a friend.</p>
            )}
          </section>

          {user && (
            <section className="dash-card">
              <header className="dash-card-head">
                <h2>Public farms</h2>
              </header>
              {lobbies === null ? (
                <p className="dash-muted">Looking for games…</p>
              ) : lobbies.length === 0 ? (
                <p className="dash-muted">No public games right now. Host one from the pause menu with “Open to everyone”.</p>
              ) : (
                <ul className="title-list">
                  {lobbies.map((l) => (
                    <li key={l.code}>
                      <div className="title-list-info">
                        <strong>{l.hostName}&apos;s farm</strong>
                        <span className="dash-muted">
                          “{l.seed}” · day {l.day} · {l.players}/{l.max} players
                        </span>
                      </div>
                      <div className="title-list-actions">
                        <button type="button" className="dash-btn dash-btn-small dash-btn-orange" disabled={l.players >= l.max} onClick={() => router.push(`/play?join=${l.code}`)}>
                          {l.players >= l.max ? 'Full' : 'Join'}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {user && (
            <section className="dash-card">
              <header className="dash-card-head">
                <h2>Friends</h2>
                {friends && friends.length > 0 && <span className="dash-muted">{friends.filter((f) => f.playing).length} playing</span>}
              </header>
              <form
                className="dash-row"
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
                <input className="dash-input" placeholder="Add a friend by username" value={friendName} maxLength={32} onChange={(e) => setFriendName(e.target.value)} />
                <button type="submit" className="dash-btn" disabled={!friendName.trim()}>
                  Add
                </button>
              </form>
              {friendMsg && <p className="dash-error-text">{friendMsg}</p>}
              {friends && friends.length === 0 && <p className="dash-muted">No friends yet. Add someone by their username.</p>}
              {friends && friends.length > 0 && (
                <ul className="title-list">
                  {friends.map((f) => (
                    <li key={f.username}>
                      <div className="title-list-info">
                        <strong>
                          {f.playing ? '🟢 ' : '⚪ '}
                          {f.displayName}
                        </strong>
                        <span className="dash-muted">
                          @{f.username} · {f.playing ? `playing on ${f.playing.hostName}'s farm` : 'offline'}
                        </span>
                      </div>
                      <div className="title-list-actions">
                        {f.playing && (
                          <button type="button" className="dash-btn dash-btn-small dash-btn-orange" onClick={() => router.push(`/play?join=${f.playing!.code}`)}>
                            Join
                          </button>
                        )}
                        <button type="button" className="dash-btn dash-btn-small" onClick={() => void api.removeFriend(f.username).then(refreshSocial)}>
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
    </div>
  );
}
