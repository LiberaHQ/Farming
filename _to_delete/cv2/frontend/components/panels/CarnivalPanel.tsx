'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CARD_BONUS, CARNIVAL_GAMES, CARNIVAL_PRIZES, CARNIVAL_TREATS, ITEMS, TOKEN_PRICE, WHEEL_SLICES, type CarnivalGameId, type ItemId } from '@farming/shared';
import { gameCommands } from '@/game-engine/events/GameEventBus';
import { useGameEvent } from '@/hooks/useGameEvent';
import { ANIMAL_ART, CREATURE_ART } from '@/components/site/catalog';
import { Sprite } from '@/components/site/Sprite';
import { ItemIcon } from '../ItemIcon';
import { Panel } from './Panel';

/**
 * Everything at the carnival that isn't walking around: the ticket booth, the
 * prize booth, the treat cart, the Wheel of Fortune and the five games. The
 * game scene charges tokens before a game opens and pays out prize tickets
 * from the final score (the same scoring as `CARNIVAL_GAMES`).
 */
export function CarnivalPanel({ slots, gold }: { slots: ReadonlyArray<{ itemId: ItemId; quantity: number } | null>; gold: number }) {
  const view = useGameEvent('carnival:view');
  const count = (id: ItemId) => slots.reduce((n, s) => n + (s && s.itemId === id ? s.quantity : 0), 0);
  const tokens = count('carnival_token');
  const tickets = count('prize_ticket');
  if (!view) return null;

  const wallet = (
    <div className="carnival-wallet">
      <span>
        <ItemIcon id="carnival_token" size={20} /> {tokens} tokens
      </span>
      <span>
        <ItemIcon id="prize_ticket" size={20} /> {tickets} tickets
      </span>
      <span>
        <span className="coin" /> {gold}g
      </span>
    </div>
  );

  if (view.mode === 'game') return <GameRunner key={view.session} game={view.game} session={view.session} tokens={tokens} wallet={wallet} />;
  if (view.mode === 'wheel') return <WheelView slice={view.slice} label={view.label} wallet={wallet} />;

  const title = view.mode === 'tokens' ? '🎟 Ticket booth' : view.mode === 'prizes' ? '🧸 Prize booth' : view.mode === 'card' ? "📋 Today's carnival card" : '🍭 Treat cart';
  return (
    <Panel title={title} footer={wallet}>
      <div className="carnival">
        {view.mode === 'tokens' && <TokenBooth gold={gold} />}
        {view.mode === 'prizes' && <PrizeBooth tickets={tickets} />}
        {view.mode === 'treats' && <TreatCart gold={gold} />}
        {view.mode === 'card' && <CardBoard />}
      </div>
    </Panel>
  );
}

// ---------- Booths ----------

function TokenBooth({ gold }: { gold: number }) {
  return (
    <>
      <p className="carnival-lead">“Step right up! Tokens are {TOKEN_PRICE}g apiece — every game pays out in prize tickets!”</p>
      <div className="carnival-buy">
        {[1, 5, 10, 20].map((n) => (
          <button key={n} type="button" className="btn btn-primary" disabled={gold < n * TOKEN_PRICE} onClick={() => gameCommands.emit('carnival:buy', { tokens: n })}>
            {n} token{n > 1 ? 's' : ''} · {n * TOKEN_PRICE}g
          </button>
        ))}
      </div>
      <h3 className="carnival-sub">What tokens get you</h3>
      <ul className="carnival-list">
        {Object.values(CARNIVAL_GAMES).map((g) => (
          <li key={g.id}>
            <span className="carnival-game-icon">{g.icon}</span>
            <b>{g.name}</b>
            <span className="hud-muted">{g.blurb}</span>
            <span className="carnival-cost">
              {g.cost} <ItemIcon id="carnival_token" size={14} />
            </span>
          </li>
        ))}
        <li>
          <span className="carnival-game-icon">🎡</span>
          <b>Ferris Wheel &amp; Carousel</b>
          <span className="hud-muted">Rest your legs, or get a spring in your step.</span>
          <span className="carnival-cost">
            1 <ItemIcon id="carnival_token" size={14} />
          </span>
        </li>
        <li>
          <span className="carnival-game-icon">🎯</span>
          <b>Wheel of Fortune</b>
          <span className="hud-muted">One free spin every day.</span>
          <span className="carnival-cost">free</span>
        </li>
      </ul>
    </>
  );
}

function PrizeBooth({ tickets }: { tickets: number }) {
  return (
    <>
      <p className="carnival-lead">Trade your prize tickets for something special. The trophy is the grand prize!</p>
      <div className="carnival-prizes">
        {CARNIVAL_PRIZES.map((p, i) => (
          <div key={p.itemId} className={`carnival-prize${tickets >= p.tickets ? ' is-affordable' : ''}`}>
            <ItemIcon id={p.itemId} size={40} />
            <b>
              {p.quantity ? `${p.quantity}× ` : ''}
              {ITEMS[p.itemId].name}
            </b>
            <span className="hud-muted">{ITEMS[p.itemId].description}</span>
            <button type="button" className="btn btn-primary" disabled={tickets < p.tickets} onClick={() => gameCommands.emit('carnival:redeem', { index: i })}>
              {p.tickets} <ItemIcon id="prize_ticket" size={14} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function TreatCart({ gold }: { gold: number }) {
  const treats = (Object.keys(CARNIVAL_TREATS) as Array<keyof typeof CARNIVAL_TREATS>).map((itemId) => ({ itemId, price: CARNIVAL_TREATS[itemId] }));
  return (
    <>
      <p className="carnival-lead">Fresh spun and toffee-dipped. Each one gives a little boost.</p>
      <div className="carnival-prizes">
        {treats.map((t) => (
          <div key={t.itemId} className="carnival-prize is-affordable">
            <ItemIcon id={t.itemId} size={40} />
            <b>{ITEMS[t.itemId].name}</b>
            <span className="hud-muted">
              +{ITEMS[t.itemId].energy} energy · {ITEMS[t.itemId].buff?.kind === 'speed' ? '👟 Swift' : '🍀 Lucky'} {Math.round((ITEMS[t.itemId].buff?.minutes ?? 0) / 60)}h
            </span>
            <button type="button" className="btn btn-primary" disabled={gold < t.price} onClick={() => gameCommands.emit('carnival:treat', { itemId: t.itemId })}>
              Buy · {t.price}g
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function CardBoard() {
  const card = useGameEvent('carnival:card');
  if (!card) return null;
  const ch = CARNIVAL_GAMES[card.challenge.game];
  return (
    <>
      {card.golden && <p className="carnival-golden">✨ It's golden hour (6–9pm): every ticket you win counts double!</p>}
      <h3 className="carnival-sub">Carnival card · play every game today</h3>
      <div className="card-stamps">
        {Object.values(CARNIVAL_GAMES).map((g) => {
          const done = card.played.includes(g.id);
          return (
            <div key={g.id} className={`card-stamp${done ? ' is-done' : ''}`}>
              <span className="card-stamp-icon">{done ? '✔' : g.icon}</span>
              <span>{g.name}</span>
            </div>
          );
        })}
      </div>
      <p className="hud-muted">
        {card.cardDone ? `Card complete — you earned ${CARD_BONUS} bonus tickets today!` : `${card.played.length} of ${Object.keys(CARNIVAL_GAMES).length} played. Finish the card for ${CARD_BONUS} bonus tickets.`}
      </p>
      <h3 className="carnival-sub">Daily challenge</h3>
      <p className={`card-challenge${card.challenge.done ? ' is-done' : ''}`}>
        {ch.icon} <b>{ch.name}</b>: score {card.challenge.target}
        {card.challenge.game === 'strength' ? '%' : ''} or more for <b>+{card.challenge.tickets} tickets</b>
        {card.challenge.done ? ' — done! 🏅' : ''}
      </p>
      <h3 className="carnival-sub">Your best scores</h3>
      <ul className="carnival-list">
        {Object.values(CARNIVAL_GAMES).map((g) => (
          <li key={g.id} className="card-best">
            <span className="carnival-game-icon">{g.icon}</span>
            <b>{g.name}</b>
            <span className="hud-muted">{card.best[g.id] ? `${card.best[g.id]}${g.id === 'strength' ? '%' : ''}` : 'not played yet'}</span>
            <span />
          </li>
        ))}
      </ul>
    </>
  );
}

// ---------- The Wheel of Fortune ----------

const WHEEL_COLORS = ['#d2404c', '#f4d24a', '#3a83b5', '#f6efe0', '#3f8c3c', '#ea7194', '#8a5aa8', '#e8812f'];

function WheelView({ slice, label, wallet }: { slice: number; label: string; wallet: React.ReactNode }) {
  const [angle, setAngle] = useState(0);
  const [stopped, setStopped] = useState(false);
  const n = WHEEL_SLICES.length;
  const step = 360 / n;
  useEffect(() => {
    const t = setTimeout(() => setAngle(360 * 6 - (slice * step + step / 2)), 60);
    const done = setTimeout(() => setStopped(true), 3600);
    return () => {
      clearTimeout(t);
      clearTimeout(done);
    };
  }, [slice, step]);
  const gradient = `conic-gradient(${WHEEL_SLICES.map((_, i) => `${WHEEL_COLORS[i % WHEEL_COLORS.length]} ${i * step}deg ${(i + 1) * step}deg`).join(', ')})`;
  const nothing = 'nothing' in WHEEL_SLICES[slice];
  return (
    <Panel title="🎯 Wheel of Fortune" footer={wallet}>
      <div className="carnival wheel-view">
        <div className="wheel-pointer">▼</div>
        <div className="wheel" style={{ background: gradient, transform: `rotate(${angle}deg)` }}>
          {WHEEL_SLICES.map((s, i) => (
            <span key={i} className="wheel-label" style={{ transform: `rotate(${i * step + step / 2}deg) translateY(-92px)` }}>
              {s.label}
            </span>
          ))}
          <span className="wheel-hub" />
        </div>
        <p className={`wheel-result${stopped ? ' is-shown' : ''}`}>{stopped ? (nothing ? 'So close! Better luck tomorrow.' : `You won: ${label}!`) : 'Round and round it goes…'}</p>
        {stopped && (
          <button type="button" className="btn btn-primary" onClick={() => gameCommands.emit('ui:close', {})}>
            Lovely
          </button>
        )}
      </div>
    </Panel>
  );
}

// ---------- Games ----------

type GameProps = { onDone: (score: number) => void };

function GameRunner({ game, session, tokens, wallet }: { game: CarnivalGameId; session: number; tokens: number; wallet: React.ReactNode }) {
  const def = CARNIVAL_GAMES[game];
  const [phase, setPhase] = useState<'intro' | 'play' | 'done'>('intro');
  const [score, setScore] = useState(0);
  const finish = useCallback(
    (s: number) => {
      setScore(s);
      setPhase('done');
      gameCommands.emit('carnival:result', { session, score: s });
    },
    [session],
  );
  // Space starts the game from the intro card.
  useEffect(() => {
    if (phase !== 'intro') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        setPhase('play');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase]);
  const outcome = useGameEvent('carnival:outcome');
  const result = outcome && outcome.session === session ? outcome : null;
  const won = result?.tickets ?? 0;
  return (
    <Panel title={`${def.icon} ${def.name}`} footer={wallet}>
      <div className="carnival carnival-game">
        {phase === 'intro' && (
          <div className="game-intro">
            <p>{def.howTo}</p>
            <button type="button" className="btn btn-primary" autoFocus onClick={() => setPhase('play')}>
              Start ▶
            </button>
          </div>
        )}
        {phase === 'play' && (
          <>
            {game === 'ring_toss' && <RingToss onDone={finish} />}
            {game === 'whack' && <Whack onDone={finish} />}
            {game === 'ducks' && <DuckShoot onDone={finish} />}
            {game === 'strength' && <Striker onDone={finish} />}
            {game === 'memory' && <Memory onDone={finish} />}
          </>
        )}
        {phase === 'done' && (
          <div className="game-result">
            <p className="game-score">
              Score <b>{score}</b>
              {game === 'ring_toss' ? ' / 3' : game === 'memory' ? ' / 8 pairs' : game === 'strength' ? '%' : ''}
            </p>
            <p className={`game-won${won > 0 ? ' is-win' : ''}`}>
              {!result ? (
                'Counting your tickets…'
              ) : won > 0 ? (
                <>
                  You won <b>{won}</b> <ItemIcon id="prize_ticket" size={20} /> prize ticket{won > 1 ? 's' : ''}!
                </>
              ) : (
                'No tickets this time. Have another go!'
              )}
            </p>
            {result && result.notes.length > 0 && (
              <ul className="game-notes">
                {result.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
            {result && !result.newBest && result.best > 0 && <p className="hud-muted">Your best: {result.best}</p>}
            <div className="settings-row">
              <button type="button" className="btn btn-primary" disabled={tokens < def.cost} onClick={() => gameCommands.emit('carnival:again', { game })}>
                Play again · {def.cost} <ItemIcon id="carnival_token" size={14} />
              </button>
              <button type="button" className="btn" onClick={() => gameCommands.emit('ui:close', {})}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

/** Runs a callback every animation frame with the elapsed milliseconds. */
function useFrame(cb: (ms: number) => void, running = true) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      ref.current(now - start);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);
}

/** Space (or a click on the game area) as the action button. */
function usePress(onPress: () => void) {
  const ref = useRef(onPress);
  ref.current = onPress;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      e.preventDefault();
      ref.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

// Ring Toss: stop the marker on the green, three times.
const RING_ZONES = [0.24, 0.16, 0.1];
const RING_SPEEDS = [0.0022, 0.003, 0.0038];

function RingToss({ onDone }: GameProps) {
  const [throwIndex, setThrow] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [marker, setMarker] = useState(0);
  const [centre] = useState(() => [0, 1, 2].map(() => 0.25 + Math.random() * 0.5));
  const [paused, setPaused] = useState(false);
  const phase = useRef(Math.random() * Math.PI * 2);
  useFrame((ms) => setMarker((Math.sin(ms * RING_SPEEDS[Math.min(2, throwIndex)] + phase.current) + 1) / 2), !paused && throwIndex < 3);
  usePress(() => press());
  const press = () => {
    if (paused || throwIndex >= 3) return;
    const hit = Math.abs(marker - centre[throwIndex]) <= RING_ZONES[throwIndex] / 2;
    const next = [...results, hit];
    setResults(next);
    setPaused(true);
    setTimeout(() => {
      if (next.length >= 3) onDone(next.filter(Boolean).length);
      else {
        setThrow(next.length);
        setPaused(false);
      }
    }, 800);
  };
  const zone = RING_ZONES[Math.min(2, throwIndex)];
  const c = centre[Math.min(2, throwIndex)];
  return (
    <div className="game-area" onMouseDown={press}>
      <div className="bottles">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`bottle${results[i] ? ' is-ringed' : ''}${results[i] === false ? ' is-missed' : ''}`}>
            <span className="bottle-neck" />
            <span className="bottle-body" />
            {results[i] && <span className="ring" />}
          </div>
        ))}
      </div>
      <div className="meter">
        <span className="meter-zone" style={{ left: `${(c - zone / 2) * 100}%`, width: `${zone * 100}%` }} />
        <span className="meter-marker" style={{ left: `${marker * 100}%` }} />
      </div>
      <p className="game-help">{paused ? (results[results.length - 1] ? 'Ringer! 🎉' : 'Missed!') : `Throw ${throwIndex + 1} of 3 — press Space on the green`}</p>
    </div>
  );
}

// Whack-a-Slime: 20 seconds, bop slimes as they pop up.
const WHACK_TIME = 20_000;

type Hole = { golden: boolean; until: number; hit?: boolean };

function Whack({ onDone }: GameProps) {
  const [up, setUp] = useState<Record<number, Hole>>({});
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(WHACK_TIME);
  // Game state lives in refs (updated once per frame); React state only mirrors it for drawing.
  const holes = useRef<Record<number, Hole>>({});
  const next = useRef(400);
  const done = useRef(false);
  const scoreRef = useRef(0);
  useFrame((ms) => {
    if (done.current) return;
    const remaining = Math.max(0, WHACK_TIME - ms);
    setLeft(remaining);
    if (remaining <= 0) {
      done.current = true;
      setTimeout(() => onDone(scoreRef.current), 300);
      return;
    }
    const speed = 1 - (ms / WHACK_TIME) * 0.45;
    const now: Record<number, Hole> = {};
    for (const [k, v] of Object.entries(holes.current)) if (v.until > ms) now[Number(k)] = v;
    if (ms >= next.current) {
      const free = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((h) => !now[h]);
      if (free.length) now[free[Math.floor(Math.random() * free.length)]] = { golden: Math.random() < 0.12, until: ms + 950 * speed };
      next.current = ms + (380 + Math.random() * 380) * speed;
    }
    holes.current = now;
    setUp(now);
  });
  const bop = (h: number) => {
    const s = holes.current[h];
    if (!s || s.hit || done.current) return;
    scoreRef.current += s.golden ? 3 : 1;
    setScore(scoreRef.current);
    holes.current = { ...holes.current, [h]: { ...s, hit: true } };
    setUp(holes.current);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= 9) {
        e.preventDefault();
        bop(n - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className="game-area">
      <div className="game-hud">
        <span>⏱ {(left / 1000).toFixed(1)}s</span>
        <span>Score {score}</span>
      </div>
      <div className="whack-grid">
        {Array.from({ length: 9 }, (_, h) => {
          const s = up[h];
          return (
            <button key={h} type="button" className={`whack-hole${s ? ' is-up' : ''}${s?.hit ? ' is-hit' : ''}${s?.golden ? ' is-golden' : ''}`} onMouseDown={() => bop(h)}>
              <span className="whack-key">{h + 1}</span>
              {s && !s.hit && <Sprite art={CREATURE_ART.slime} scale={4} />}
              {s?.hit && <span className="whack-bonk">{s.golden ? '+3' : '+1'}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Duck Shoot: ten corks, ducks float along three lanes.
interface Duck {
  id: number;
  lane: number;
  x: number;
  speed: number;
  golden: boolean;
  hit: boolean;
}
const CORKS = 10;

function DuckShoot({ onDone }: GameProps) {
  const [ducks, setDucks] = useState<Duck[]>([]);
  const [corks, setCorks] = useState(CORKS);
  const [score, setScore] = useState(0);
  const pond = useRef<Duck[]>([]);
  const last = useRef(0);
  const spawnAt = useRef(0);
  const ids = useRef(0);
  const ended = useRef(false);
  const scoreRef = useRef(0);
  const end = () => {
    if (ended.current) return;
    ended.current = true;
    setTimeout(() => onDone(scoreRef.current), 700);
  };
  useFrame((ms) => {
    const dt = Math.min(100, ms - last.current);
    last.current = ms;
    if (ms > 30_000) end();
    const moved = pond.current.map((d) => ({ ...d, x: d.x + d.speed * dt * (d.lane % 2 ? -1 : 1) })).filter((d) => d.x > -0.15 && d.x < 1.15);
    if (ms >= spawnAt.current) {
      const lane = Math.floor(Math.random() * 3);
      moved.push({ id: ids.current++, lane, x: lane % 2 ? 1.1 : -0.1, speed: 0.00018 + Math.random() * 0.00012 + lane * 0.00004, golden: Math.random() < 0.15, hit: false });
      spawnAt.current = ms + 550 + Math.random() * 500;
    }
    pond.current = moved;
    setDucks(moved);
  });
  const shoot = (duck: Duck | null) => {
    if (corks <= 0 || ended.current) return;
    const left = corks - 1;
    setCorks(left);
    if (duck && !duck.hit) {
      scoreRef.current += duck.golden ? 3 : 1;
      setScore(scoreRef.current);
      pond.current = pond.current.map((d) => (d.id === duck.id ? { ...d, hit: true, speed: 0 } : d));
      setDucks(pond.current);
    }
    if (left <= 0) end();
  };
  return (
    <div className="game-area">
      <div className="game-hud">
        <span>🍾 Corks {corks}</span>
        <span>Score {score}</span>
      </div>
      <div className="duck-pond" onMouseDown={() => shoot(null)}>
        {[0, 1, 2].map((lane) => (
          <div key={lane} className="duck-lane" />
        ))}
        {ducks.map((d) => (
          <button
            key={d.id}
            type="button"
            className={`duck${d.hit ? ' is-hit' : ''}${d.golden ? ' is-golden' : ''}`}
            style={{ left: `${d.x * 100}%`, top: `${12 + d.lane * 33}%` }}
            onMouseDown={(e) => {
              e.stopPropagation();
              shoot(d);
            }}
          >
            <Sprite art={ANIMAL_ART.duck} scale={4} flip={d.lane % 2 === 1} />
          </button>
        ))}
      </div>
      <p className="game-help">Click the ducks. Golden ducks are worth 3.</p>
    </div>
  );
}

// High Striker: one swing, stop the meter at the top.
function Striker({ onDone }: GameProps) {
  const [power, setPower] = useState(0);
  const [swung, setSwung] = useState<number | null>(null);
  const [puck, setPuck] = useState(0);
  useFrame((ms) => {
    if (swung !== null) return;
    const t = (ms * 0.0016) % 2;
    setPower(Math.round((t < 1 ? t : 2 - t) * 100));
  }, swung === null);
  usePress(() => swing());
  const swing = () => {
    if (swung !== null) return;
    setSwung(power);
    requestAnimationFrame(() => setPuck(power));
    setTimeout(() => onDone(power), 1500);
  };
  const rang = swung !== null && swung >= 96;
  return (
    <div className="game-area striker-area" onMouseDown={swing}>
      <div className={`striker-tower${rang ? ' is-rang' : ''}`}>
        <span className="striker-bell">🔔</span>
        <span className="striker-puck" style={{ bottom: `${puck * 0.86}%` }} />
        {[25, 50, 75].map((m) => (
          <span key={m} className="striker-mark" style={{ bottom: `${m * 0.86}%` }} />
        ))}
      </div>
      <div className="striker-meter">
        <span className="striker-fill" style={{ height: `${swung ?? power}%` }} />
        <span className="striker-top" />
      </div>
      <p className="game-help">{swung === null ? 'Press Space at the very top!' : rang ? 'DING! You rang the bell! 🔔' : `${swung}% — so strong!`}</p>
    </div>
  );
}

// Memory: eight pairs, 45 seconds.
const MEMORY_ITEMS: ItemId[] = ['turnip', 'pumpkin', 'egg', 'sunfish', 'amethyst', 'berries', 'golden_carp', 'milk'];
const MEMORY_TIME = 45_000;

function Memory({ onDone }: GameProps) {
  const deck = useMemo(() => {
    const cards = [...MEMORY_ITEMS, ...MEMORY_ITEMS].map((id, i) => ({ id, key: i, r: Math.random() }));
    return cards.sort((a, b) => a.r - b.r);
  }, []);
  const [open, setOpen] = useState<number[]>([]);
  const [found, setFound] = useState<Set<ItemId>>(new Set());
  const [left, setLeft] = useState(MEMORY_TIME);
  const ended = useRef(false);
  const end = (pairs: number) => {
    if (ended.current) return;
    ended.current = true;
    setTimeout(() => onDone(pairs), 500);
  };
  useFrame((ms) => {
    const r = Math.max(0, MEMORY_TIME - ms);
    setLeft(r);
    if (r <= 0) end(found.size);
  });
  const flip = (i: number) => {
    if (ended.current || open.includes(i) || found.has(deck[i].id) || open.length >= 2) return;
    const now = [...open, i];
    setOpen(now);
    if (now.length === 2) {
      const [a, b] = now;
      if (deck[a].id === deck[b].id) {
        const next = new Set(found).add(deck[a].id);
        setFound(next);
        setOpen([]);
        if (next.size === MEMORY_ITEMS.length) end(next.size);
      } else setTimeout(() => setOpen([]), 650);
    }
  };
  return (
    <div className="game-area">
      <div className="game-hud">
        <span>⏱ {(left / 1000).toFixed(0)}s</span>
        <span>
          Pairs {found.size} / {MEMORY_ITEMS.length}
        </span>
      </div>
      <div className="memory-grid">
        {deck.map((c, i) => {
          const up = open.includes(i) || found.has(c.id);
          return (
            <button key={c.key} type="button" className={`memory-card${up ? ' is-up' : ''}${found.has(c.id) ? ' is-found' : ''}`} onClick={() => flip(i)}>
              {up ? <ItemIcon id={c.id} size={32} /> : <span className="memory-back">?</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
