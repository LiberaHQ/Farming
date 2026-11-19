'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GoogleSignIn } from '@/components/auth/GoogleSignIn';
import { WalletLogin } from '@/components/wallet';
import { PlayHub } from './PlayHub';
import { PixelLogo } from './SiteChrome';
import { useEffect, useState } from 'react';
import { APPEARANCE_OPTIONS, ITEMS, NPCS, normalizeAppearance, SKILL_IDS, SKILLS, skillLevel, type DashboardView, type ItemId, type NpcId } from '@farming/shared';
import { drawHorseSheet, HORSE_FRAME } from '@/game-engine/assets/horse';
import { useSession } from '@/hooks/useSession';
import { api } from '@/services/api';
import { CharacterPreview, STYLE_NAMES } from '../CharacterPicker';
import { ANIMAL_ART, itemArt, npcArt, type Art } from './catalog';
import { logOutEverywhere, SiteNav } from './SiteNav';
import { Sprite } from './Sprite';
import { UPDATES } from './updates';

const HORSE_ART: Art = { key: 'dash-horse', name: 'Horse', draw: drawHorseSheet, frames: { w: HORSE_FRAME.width, h: HORSE_FRAME.height, count: 1 } };


const ago = (ms: number | null) => {
  if (!ms) return 'never';
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};
const date = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** An empty slot, so card grids keep their shape (like an inventory). */
const Empty = ({ n }: { n: number }) => (
  <>
    {Array.from({ length: Math.max(0, n) }, (_, i) => (
      <div key={`e${i}`} className="dash-slot is-empty" />
    ))}
  </>
);

function Card({ title, id, children, action }: { title: string; id?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="dash-card" id={id}>
      <header className="dash-card-head">
        <h2>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

/**
 * The player's dashboard: their farmer and stats, gold and backpack,
 * cosmetics, mounts and pets, tournament record, the monthly leaderboard and
 * the latest updates, all from the game's own data.
 */
export function Dashboard() {
  const { user, online, logout, refresh } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DashboardView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [motto, setMotto] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  useEffect(() => {
    if (!user) return;
    api
      .dashboard()
      .then((d) => {
        setData(d);
        setMotto(d.profile.motto);
      })
      .catch((e: Error) => setError(e.message));
  }, [user]);

  const saveMotto = () => {
    api
      .updateProfile({ motto })
      .then(() => {
        setSaved('Saved');
        setTimeout(() => setSaved(null), 1500);
      })
      .catch((e: Error) => setSaved(e.message));
  };

  const c = data?.character ?? null;
  const levels = SKILL_IDS.map((id) => ({ id, level: skillLevel(c?.skills[id] ?? 0) }));
  const totalLevel = Math.max(1, levels.reduce((sum, s) => sum + s.level, 0));
  const look = normalizeAppearance(data?.profile.appearance ?? {});
  const t = data?.tournaments;
  const titles = [
    ...(t?.rank === 1 ? ['👑 Valley Champion'] : t?.rank && t.rank <= 10 ? ['🏆 Top 10 this month'] : []),
    ...(t && t.prizes > 0 ? ['💰 Prize winner'] : []),
    ...(c && c.mineDepth > 30 ? ['🕳 Abyss diver'] : c && c.mineDepth >= 30 ? ['⛏ Conqueror of the mine'] : []),
    ...(data && data.worlds.longestDays >= 40 ? ['📅 A year in the valley'] : []),
  ];
  const outfitColor = (part: 'shirt' | 'hair' | 'pants' | 'shoes') => (APPEARANCE_OPTIONS[part][look[part]] as unknown as Record<string, string>)[part];

  return (
    <div className="dash-page" id="top">
      <SiteNav current="dashboard" user={user} gold={c?.gold ?? null} onLogout={() => void logOutEverywhere(user, logout)} />
      {user === undefined && <p className="dash-loading">Loading your farm…</p>}

      {user === null && (
        <>
          <section className="dash-card title-hero">
            <div className="title-hero-text">
              <PixelLogo text={'HARVEST\nVALLEY'} scale={5} className="title-logo" />
              <p className="title-tagline">Farm, gather, craft and build in a cosy pixel world, alone, with friends, or in the Open World.</p>
            </div>
            <div className="title-account">
              {online ? (
                <>
                  <p>
                    Playing as a <strong>guest</strong>
                  </p>
                  <p className="dash-muted">Saves stay in this browser. Make an account to keep them safe, play co-op, enter the Open World and see your stats here.</p>
                  <div className="dash-row">
                    <Link className="dash-btn dash-btn-orange" href="/register">
                      Create account
                    </Link>
                    <Link className="dash-btn" href="/login">
                      Log in
                    </Link>
                  </div>
                  <div className="title-social">
                    <GoogleSignIn mode="login" compact onSignedIn={(_u, created) => (created ? router.push('/profile') : void refresh())} />
                    <WalletLogin signedIn={false} onSignedIn={refresh} className="dash-btn" />
                  </div>
                </>
              ) : (
                <p className="dash-muted">The server is offline, so accounts are unavailable. You can still play; saves stay in this browser.</p>
              )}
            </div>
          </section>
          <PlayHub user={null} />
        </>
      )}
      {error && <p className="dash-error">{error}</p>}

      {user && (
        <div className="dash-grid">
          <Card
            title="Profile"
            action={
              <div className="dash-row">
                <Link className="dash-chip" href="/profile">
                  Customize ⚙
                </Link>
                <button type="button" className="dash-chip" onClick={() => void logOutEverywhere(user, logout)}>
                  Log out
                </button>
              </div>
            }
          >
            <div className="dash-profile">
              <div className="dash-avatar">
                <div className="dash-pedestal">{ready && <CharacterPreview choice={look} scale={6} />}</div>
                <a className="dash-btn dash-btn-orange dash-play" href="#play">
                  Play Now
                </a>
              </div>
              <div className="dash-facts">
                <h3 className="dash-name">{data?.profile.displayName ?? user.displayName}</h3>
                <div className="dash-fact">
                  <span>📊</span> <b>Total Level:</b> {totalLevel}
                </div>
                <div className="dash-skills">
                  {levels.map((s) => (
                    <span key={s.id} className="dash-chip" title={SKILLS[s.id].name}>
                      {SKILLS[s.id].emoji} {s.level}
                    </span>
                  ))}
                </div>
                <div className="dash-fact">
                  <span>💬</span> <b>Motto</b>
                </div>
                <div className="dash-row">
                  <input className="dash-input" maxLength={80} placeholder="Enter your motto…" value={motto} onChange={(e) => setMotto(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveMotto()} />
                  <button type="button" className="dash-btn dash-btn-small" onClick={saveMotto} disabled={!data}>
                    {saved ?? 'Save'}
                  </button>
                </div>
                <div className="dash-fact">
                  <span>👥</span> <b>Friends Online:</b> {data ? `${data.friends.online} of ${data.friends.total}` : '…'}
                </div>
                <div className="dash-fact">
                  <span>🌍</span> <b>Home:</b>{' '}
                  {data?.source?.kind === 'openworld' ? `${data.source.valley}, Open World` : data?.source?.kind === 'world' ? `“${data.source.seed}”, day ${c?.day}` : 'No farm yet'}
                </div>
                <div className="dash-fact">
                  <span>🕒</span> <b>Last Played:</b> {data ? ago(data.profile.lastPlayed) : '…'}
                </div>
                <div className="dash-fact">
                  <span>🌱</span> <b>Farming Since:</b> {data?.profile.memberSince ? date(data.profile.memberSince) : '…'}
                </div>
              </div>
            </div>
          </Card>

          <div className="dash-stack">
            <Card title="Gold & Items" action={data?.source && <span className="dash-muted">{data.source.kind === 'openworld' ? 'Open World backpack' : `World “${data.source.seed}”`}</span>}>
              {c ? (
                <>
                  <div className="dash-gold">
                    <span className="dash-gold-big">🪙 {c.gold.toLocaleString()}g</span>
                    <span className="dash-muted">{c.lifetimeEarnings.toLocaleString()}g earned in all · deepest mine floor {c.mineDepth || '—'}</span>
                  </div>
                  <div className="dash-slots">
                    {c.items.slice(0, 11).map((it) => (
                      <div key={it.itemId} className="dash-slot" title={`${ITEMS[it.itemId as ItemId].name}${it.quantity > 1 ? ` ×${it.quantity}` : ''}`}>
                        {ready && <Sprite art={itemArt(it.itemId as ItemId)} scale={2} animate={false} />}
                        {it.quantity > 1 && <em>{it.quantity}</em>}
                      </div>
                    ))}
                    <Empty n={11 - c.items.length} />
                  </div>
                </>
              ) : (
                <p className="dash-muted">Play a world or join the Open World and your gold and backpack show up here.</p>
              )}
            </Card>

            <Card title="Cosmetics">
              <div className="dash-slots">
                <div className="dash-slot dash-cosmetic" title="Hair style">
                  <span className="dash-swatch" style={{ background: outfitColor('hair') }} />
                  <small>{STYLE_NAMES.hairStyle?.[look.hairStyle] ?? 'Hair'}</small>
                </div>
                <div className="dash-slot dash-cosmetic" title="Outfit">
                  <span className="dash-swatch" style={{ background: outfitColor('shirt') }} />
                  <small>{STYLE_NAMES.outfit?.[look.outfit] ?? 'Outfit'}</small>
                </div>
                <div className="dash-slot dash-cosmetic" title="Hat">
                  <span>🎩</span>
                  <small>{STYLE_NAMES.hat?.[look.hat] ?? 'Hat'}</small>
                </div>
                <div className="dash-slot dash-cosmetic" title="Shoes">
                  <span className="dash-swatch" style={{ background: outfitColor('shoes') }} />
                  <small>Shoes</small>
                </div>
                {c?.equipment.ring && (
                  <div className="dash-slot" title={ITEMS[c.equipment.ring].name}>
                    {ready && <Sprite art={itemArt(c.equipment.ring)} scale={2} animate={false} />}
                  </div>
                )}
                {c?.equipment.armor && (
                  <div className="dash-slot" title={ITEMS[c.equipment.armor].name}>
                    {ready && <Sprite art={itemArt(c.equipment.armor)} scale={2} animate={false} />}
                  </div>
                )}
                {titles.map((title) => (
                  <div key={title} className="dash-slot dash-title" title="Title">
                    <small>{title}</small>
                  </div>
                ))}
                <Empty n={11 - 4 - titles.length - (c?.equipment.ring ? 1 : 0) - (c?.equipment.armor ? 1 : 0)} />
              </div>
            </Card>

            <Card title="Mounts & Pets">
              <div className="dash-slots">
                {c?.horse && (
                  <div className="dash-slot dash-companion" title={`Your horse, ${c.horse}`}>
                    {ready && <Sprite art={HORSE_ART} scale={1.2} animate={false} />}
                    <small>{c.horse}</small>
                  </div>
                )}
                {c?.pets.map((p) => (
                  <div key={p.name} className="dash-slot dash-companion" title={`${p.name} the ${p.kind} · ${p.love} love`}>
                    {ready && <Sprite art={ANIMAL_ART[p.kind]} scale={2} />}
                    <small>
                      {p.name} {p.love >= 60 ? '❤️' : p.love >= 30 ? '🧡' : '🤍'}
                    </small>
                  </div>
                ))}
                {c?.spouse && c.spouse in NPCS && (
                  <div className="dash-slot dash-companion" title={`Married to ${NPCS[c.spouse as NpcId].name}`}>
                    {ready && <Sprite art={npcArt(c.spouse as NpcId)} scale={1.5} />}
                    <small>💍 {NPCS[c.spouse as NpcId].name}</small>
                  </div>
                )}
                <Empty n={11 - (c?.horse ? 1 : 0) - (c?.pets.length ?? 0) - (c?.spouse ? 1 : 0)} />
              </div>
              {c && !c.horse && !c.pets.length && <p className="dash-muted">Adopt the stray cat or dog on day 2, and buy a horse from Mira once you’ve earned 1,000g.</p>}
            </Card>
          </div>

        </div>
      )}

      {/* Playing: new and saved worlds, the Open World, co-op and friends. */}
      {user && <PlayHub user={user} />}

      {user && (
        <div className="dash-grid">
          <Card title="Tournaments" id="tournaments" action={<Link className="dash-chip" href="/play?world=1">🏆 Open World</Link>}>
            <div className="dash-stats">
              <div>
                <b>{t?.rank ? `#${t.rank}` : '—'}</b>
                <span>Monthly rank</span>
              </div>
              <div>
                <b>{t?.points ?? 0}</b>
                <span>Ranking points</span>
              </div>
              <div>
                <b>{t?.best ?? '—'}</b>
                <span>Best Mine Dash</span>
              </div>
              <div>
                <b>{(t?.prizes ?? 0).toLocaleString()}g</b>
                <span>Prizes won</span>
              </div>
              <div>
                <b>{t?.entries ?? 0}</b>
                <span>Entries</span>
              </div>
              <div>
                <b>{data?.openWorld.online ?? 0}</b>
                <span>In the Open World now</span>
              </div>
            </div>
            {t && t.recent.length > 0 ? (
              <ul className="dash-list">
                {t.recent.map((r, i) => (
                  <li key={i}>
                    <b>{r.name}</b>
                    <span>{r.rank ? `#${r.rank} of ${r.entrants}` : r.endsAt > Date.now() ? 'in progress' : 'no placing'}</span>
                    <span>{r.score ?? '—'} pts</span>
                    <span className={r.prize ? 'dash-win' : ''}>{r.prize ? `+${r.prize}g` : ''}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="dash-muted">No tournaments yet. Join the Open World, earn some gold and enter a Bronze Mine Dash Sprint (250g).</p>
            )}
          </Card>

          <Card title="Leaderboard" id="leaderboard" action={<span className="dash-muted">This month</span>}>
            {data && data.leaderboard.length ? (
              <ol className="dash-board">
                {data.leaderboard.map((r, i) => (
                  <li key={r.name} className={r.me ? 'is-me' : ''}>
                    <span className="dash-place">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</span>
                    <span>{r.name}</span>
                    <b>{r.points} pts</b>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="dash-muted">Nobody has ranking points yet this month. Place in a tournament to top the board.</p>
            )}
          </Card>
        </div>
      )}

      <Card title="Recent Updates" id="updates">
        <div className="dash-updates">
          {UPDATES.map((u) => (
            <article key={u.version} className="dash-update">
              <h3>
                Update {u.version} — {u.title} <small>{u.date}</small>
              </h3>
              <p>{u.body}</p>
            </article>
          ))}
        </div>
      </Card>
    </div>
  );
}
