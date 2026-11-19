'use client';

import { useEffect, useState } from 'react';
import { MINE_DASH_CAMP, MINE_DASH_KITS, MINE_DASH_VARIANTS, PRIZES, prizeShares, type MineDashKit, type TournamentView } from '@farming/shared';
import { gameCommands } from '@/game-engine/events/GameEventBus';
import { useGameEvent } from '@/hooks/useGameEvent';
import { Panel } from './Panel';

const until = (ms: number) => {
  const s = Math.max(0, Math.round((ms - Date.now()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
};

function Tournament({ t, kit, now }: { t: TournamentView; kit: MineDashKit; now: number }) {
  const v = MINE_DASH_VARIANTS[t.variant];
  const upcoming = t.startsAt > now;
  const open = t.status === 'open' && !upcoming && t.endsAt > now;
  const lateToEnter = t.endsAt - now < v.minutes * 60_000;
  const payout = Math.floor(t.pool * PRIZES.payout);
  const first = t.entrants ? Math.floor(payout * prizeShares(Math.max(t.entrants, 1))[0]) : 0;
  return (
    <li className={`tournament tier-${t.tier}`}>
      <div className="tournament-head">
        <strong>{t.name}</strong>
        <span className="hud-muted">{upcoming ? `starts in ${until(t.startsAt)}` : open ? `ends in ${until(t.endsAt)}` : t.status === 'cancelled' ? 'cancelled (refunded)' : 'finished'}</span>
      </div>
      <div className="hud-muted">
        {v.blurb} Entry {t.fee}g · {t.entrants} entered · pool {t.pool}g{first ? ` · 1st wins ~${first}g` : ''}
      </div>
      {t.myEntries > 0 && (
        <div>
          You: {t.myEntries} entr{t.myEntries > 1 ? 'ies' : 'y'}, best {t.myBest ?? '—'}
        </div>
      )}
      {t.top.length > 0 && (
        <ol className="tournament-top">
          {t.top.map((r, i) => (
            <li key={i}>
              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`} {r.name} <b>{r.score}</b>
            </li>
          ))}
        </ol>
      )}
      {open && (
        <div className="tournament-actions">
          {!t.eligible ? (
            <span className="hud-muted">Only this month’s top players may enter.</span>
          ) : (
            <>
              <button type="button" className="btn" disabled={lateToEnter || t.myEntries >= PRIZES.maxEntries} onClick={() => gameCommands.emit('tournament:enter', { id: t.id })}>
                {t.myEntries >= PRIZES.maxEntries ? 'Max entries' : lateToEnter ? 'Too late to enter' : `Enter (${t.fee}g)`}
              </button>
              {t.myEntries > 0 && (
                <button type="button" className="btn btn-primary" onClick={() => gameCommands.emit('dash:start', { tournamentId: t.id, kit })}>
                  ⛏ Play a run ({MINE_DASH_KITS[kit].name})
                </button>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}

/** The tournament board: what's running, entry fees, prize pools, the monthly ranking, and Mine Dash kits. */
export function TournamentPanel() {
  const data = useGameEvent('tournament:list');
  const [kit, setKit] = useState<MineDashKit>('brawler');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    const r = setInterval(() => gameCommands.emit('tournament:refresh', {}), 20_000);
    return () => {
      clearInterval(t);
      clearInterval(r);
    };
  }, []);
  const list = (data?.tournaments ?? []).filter((t) => t.status === 'open' || t.myEntries > 0);
  return (
    <Panel title="🏆 Tournaments">
      <details className="tournament-help">
        <summary>How tournaments work</summary>
        <p className="hud-muted">
          Pay the entry fee in gold, then play your run any time before the tournament ends (each entry is one run; your best counts, up to {PRIZES.maxEntries}). 90%
          of all fees go to the top fifth of players; 10% is burned. Too few players and everyone is refunded. Everyone plays the same mine.
        </p>
      </details>
      <h3 className="panel-subtitle">Your kit</h3>
      <div className="kit-row" role="radiogroup" aria-label="Kit">
        {(Object.keys(MINE_DASH_KITS) as MineDashKit[]).map((k) => (
          <button key={k} type="button" role="radio" className={`kit${kit === k ? ' kit-active' : ''}`} aria-checked={kit === k} onClick={() => setKit(k)}>
            {MINE_DASH_KITS[k].name}
          </button>
        ))}
      </div>
      <p className="hud-muted kit-blurb">{MINE_DASH_KITS[kit].blurb}</p>
      <div className="tournament-actions">
        <button type="button" className="btn" onClick={() => gameCommands.emit('dash:start', { tournamentId: null, kit })}>
          Practice run (free, doesn’t count)
        </button>
        {data && <span className="hud-muted">Your gold: {data.gold}g</span>}
      </div>
      <h3 className="panel-subtitle">Mine Dash</h3>
      {!data ? (
        <p className="hud-muted">Loading…</p>
      ) : data.error ? (
        <p className="hud-muted">{data.error}</p>
      ) : (
        <ul className="tournament-list">
          {list.map((t) => (
            <Tournament key={t.id} t={t} kit={kit} now={now} />
          ))}
        </ul>
      )}
      {data && data.ranking.length > 0 && (
        <>
          <h3 className="panel-subtitle">This month’s ranking</h3>
          <ol className="tournament-top">
            {data.ranking.slice(0, 10).map((r) => (
              <li key={r.name}>
                {r.name} · {r.points} pts
              </li>
            ))}
          </ol>
        </>
      )}
    </Panel>
  );
}

/** A Mine Dash camp: spend run money, then go on or bank your score. */
export function CampPanel() {
  const camp = useGameEvent('dash:camp');
  if (!camp) return null;
  const C = MINE_DASH_CAMP;
  const buy = (action: 'meal' | 'fullHeal' | 'sharpen' | 'lantern' | 'armour', cost: number, label: string) => (
    <button type="button" className="btn" disabled={camp.money < cost} onClick={() => gameCommands.emit('dash:camp', { action })}>
      {label} · {cost}
    </button>
  );
  return (
    <Panel title={`⛺ Camp after floor ${camp.floor}`} onClose={() => gameCommands.emit('dash:camp', { action: 'continue' })}>
      <p>
        Run money: <strong>{camp.money}</strong> · Health {camp.health}/{camp.maxHealth}
        {camp.attack > 0 && ` · +${camp.attack} attack`}
        {camp.defense > 0 && ` · ${camp.defense}% guard`}
        {camp.lantern > 0 && ` · +${camp.lantern} light`}
      </p>
      <p className="hud-muted">The clock is still running. Spending run money lowers the ore points you’d bank.</p>
      <div className="tournament-actions">
        {buy('meal', C.meal.cost, `Hot meal (+${C.meal.heal} health)`)}
        {buy('fullHeal', C.fullHeal.cost, 'Full heal')}
        {buy('sharpen', C.sharpen.cost, 'Sharpen sword (+1 attack)')}
        {buy('lantern', C.lantern.cost, 'Bigger lantern')}
        {buy('armour', C.armour.cost, 'Patch armour (+10% guard)')}
      </div>
      <div className="tournament-actions">
        <button type="button" className="btn btn-primary" onClick={() => gameCommands.emit('dash:camp', { action: 'continue' })}>
          ⬇ Push on
        </button>
        <button type="button" className="btn" onClick={() => gameCommands.emit('dash:camp', { action: 'bank' })}>
          🏦 Bank my score and climb out
        </button>
      </div>
    </Panel>
  );
}

/** A finished run's score, line by line. */
export function DashResultPanel() {
  const r = useGameEvent('dash:result');
  if (!r) return null;
  return (
    <Panel title={`${r.name}: results`}>
      {r.checking && <p className="hud-muted">Checking your run with the server…</p>}
      {r.error && <p className="hud-muted">The server couldn’t score this run: {r.error}</p>}
      <table className="dash-lines">
        <tbody>
          {r.score.lines.map((l, i) => (
            <tr key={i}>
              <td>{l.label}</td>
              <td>{l.points}</td>
            </tr>
          ))}
          <tr className="total">
            <td>Score</td>
            <td>{r.score.total}</td>
          </tr>
        </tbody>
      </table>
      {r.practice ? (
        <p className="hud-muted">Practice run: it doesn’t count. Enter a tournament to play for prizes.</p>
      ) : (
        r.best !== null && <p>Your best in this tournament: {r.best}</p>
      )}
      <div className="tournament-actions">
        <button type="button" className="btn btn-primary" onClick={() => gameCommands.emit('tournament:open', {})}>
          Back to the board
        </button>
      </div>
    </Panel>
  );
}

/** Clock, floor, run money and score while a run is on. */
export function DashHud() {
  const s = useGameEvent('dash:state');
  if (!s) return null;
  const m = Math.floor(s.timeLeft / 60);
  return (
    <div className="hud-panel dash-hud">
      <strong>{s.practice ? 'Practice' : '🏆'}</strong>
      <span className={s.timeLeft <= 30 ? 'urgent' : ''}>
        ⏱ {m}:{String(s.timeLeft % 60).padStart(2, '0')}
      </span>
      <span>Floor {s.floor}</span>
      <span>💰 {s.money}</span>
      <span>Score {s.score}</span>
    </div>
  );
}
