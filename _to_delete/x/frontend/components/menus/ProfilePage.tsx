'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { AppearanceChoice, WorldSummary } from '@farming/shared';
import { LocalSaveStore } from '@/game-engine/state/save';
import { api, ApiError, type Profile, type ProfileStats } from '@/services/api';
import { CharacterPicker } from '../CharacterPicker';

/** Display name, default character look for new worlds, stats, and world management. */
export function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [name, setName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = async () => {
    try {
      const [p, w] = await Promise.all([api.profile(), api.worlds()]);
      setProfile(p.profile);
      setStats(p.stats);
      setName(p.profile.displayName);
      setWorlds(w.worlds);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.replace('/login');
      else setMessage(err instanceof ApiError ? err.message : 'Could not load your profile.');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { profile: updated } = await api.updateProfile({ displayName: name });
      setProfile(updated);
      setMessage('Display name saved.');
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Could not save.');
    }
  };

  const pick = async (part: keyof AppearanceChoice, index: number) => {
    if (!profile) return;
    const appearance = { ...profile.appearance, [part]: index };
    setProfile({ ...profile, appearance });
    try {
      await api.updateProfile({ appearance });
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Could not save your look.');
    }
  };

  const deleteWorld = async (seed: string) => {
    await api.deleteWorld(seed).catch(() => undefined);
    await new LocalSaveStore().clear(seed);
    setConfirmDelete(null);
    await load();
  };

  if (!profile) {
    return (
      <main className="menu-page">
        <p className="hud-muted">{message ?? 'Loading…'}</p>
      </main>
    );
  }

  return (
    <main className="menu-page">
      <header className="title">
        <h1>{profile.displayName}</h1>
        <p className="hud-muted">
          <Link href="/start">← Back to title</Link>
        </p>
      </header>

      {stats && (
        <section className="card stats">
          <div>
            <strong>{stats.worlds}</strong>
            <span className="hud-muted">worlds</span>
          </div>
          <div>
            <strong>{stats.totalEarnings}g</strong>
            <span className="hud-muted">earned in total</span>
          </div>
          <div>
            <strong>{stats.longestWorldDays}</strong>
            <span className="hud-muted">days in your longest world</span>
          </div>
        </section>
      )}

      <section className="card">
        <h2>Display name</h2>
        <form className="new-world-row" onSubmit={saveName}>
          <input className="input" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
          <button type="submit" className="btn btn-primary">
            Save
          </button>
        </form>
        {message && <p className="hud-muted">{message}</p>}
      </section>

      <section className="card">
        <h2>Character</h2>
        <p className="hud-muted">Your look for new worlds. Change it in-game from the pause menu too.</p>
        <CharacterPicker choice={profile.appearance} onPick={(part, index) => void pick(part, index)} />
      </section>

      <section className="card">
        <h2>Saved worlds</h2>
        {worlds.length === 0 ? (
          <p className="hud-muted">No worlds saved to your account yet.</p>
        ) : (
          <ul className="world-list">
            {worlds.map((w) => (
              <li key={w.seed}>
                <div className="world-info">
                  <strong>{w.seed}</strong>
                  <span className="hud-muted">
                    Day {w.day} · {w.gold}g · {w.lifetimeEarnings}g earned
                  </span>
                </div>
                {confirmDelete === w.seed ? (
                  <span className="account-actions">
                    <button type="button" className="btn btn-danger" onClick={() => void deleteWorld(w.seed)}>
                      Delete forever
                    </button>
                    <button type="button" className="btn" onClick={() => setConfirmDelete(null)}>
                      Cancel
                    </button>
                  </span>
                ) : (
                  <span className="account-actions">
                    <Link className="btn btn-primary" href={`/play?seed=${encodeURIComponent(w.seed)}`}>
                      Play
                    </Link>
                    <button type="button" className="btn" onClick={() => setConfirmDelete(w.seed)}>
                      Delete
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
