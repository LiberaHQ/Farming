'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CROPS, CROP_IDS, ITEMS, NPCS, type NpcId } from '@farming/shared';
import { TILE } from '@/game-engine/assets/tileIndex';
import { drawCottage } from '@/game-engine/assets/structures';
import { drawBarn, drawMailbox, drawShippingBin } from '@/game-engine/assets/farmBuildings';
import { drawOak, drawPine, drawScarecrow, drawStall, drawTallGrass, drawBush, OAK_FOLIAGE, PINE_FOLIAGE, GRASS_FOLIAGE } from '@/game-engine/assets/sprites';
import { drawFlowerBed, drawWell } from '@/game-engine/assets/farmDecor';
import { drawFence } from '@/game-engine/assets/structures';
import { createRng } from '@/game-engine/utils/random';
import { ANIMAL_ART, ART_GROUPS, cropStages, ITEM_GROUPS, itemArt, meadowPattern, npcArt, playerArt, renderArt, tileArt, type Art } from './catalog';
import { PixelLogo, SiteHeader } from './SiteChrome';
import { artSize, Sprite } from './Sprite';

// ---------- The hero diorama ----------

const WORLD = { w: 400, h: 184 };
const PATH_Y = 120;

interface Piece {
  art: Art;
  /** Left edge and feet line, in world pixels. */
  x: number;
  y: number;
  flip?: boolean;
  offset?: number;
  /** Flat on the ground (drawn under everything). */
  ground?: boolean;
}

const a = (key: string, draw: Art['draw']): Art => ({ key: `hero-${key}`, name: key, draw });
const v = (kind: string, n: number) => createRng(`${kind}-${n}-v1`);

function heroPieces(): Piece[] {
  const crop = (id: Parameters<typeof cropStages>[0]) => {
    const stages = cropStages(id);
    return stages[stages.length - 1];
  };
  const soil = tileArt(TILE.SOIL_WET, 'Soil');
  const pieces: Piece[] = [
    // Back row of trees.
    { art: a('pine0', () => drawPine(v('pine', 0), PINE_FOLIAGE.summer)), x: -6, y: 58 },
    { art: a('oak1', () => drawOak(v('oak', 1), OAK_FOLIAGE.spring, true)), x: 18, y: 50 },
    { art: a('pine1', () => drawPine(v('pine', 1), PINE_FOLIAGE.summer)), x: 352, y: 54 },
    { art: a('oak2', () => drawOak(v('oak', 2), OAK_FOLIAGE.summer)), x: 376, y: 64 },
    { art: a('oak0', () => drawOak(v('oak', 0), OAK_FOLIAGE.fall)), x: 318, y: 46 },
    // Home.
    { art: a('cottage', () => drawCottage(createRng('cottage'))), x: 46, y: 104 },
    { art: a('mailbox', drawMailbox), x: 104, y: 112 },
    { art: a('bin', drawShippingBin), x: 22, y: 112 },
    { art: a('well', drawWell), x: 126, y: 64 },
    // The field.
    ...[0, 1, 2, 3, 4].flatMap((c) => [0, 1].map((r) => ({ art: soil, x: 150 + c * 16, y: 80 + r * 16, ground: true }))),
    ...(['pumpkin', 'corn', 'strawberry', 'tomato', 'carrot'] as const).flatMap((id, c) => [0, 1].map((r) => ({ art: crop(id), x: 150 + c * 16, y: 78 + r * 16 }))),
    { art: a('scarecrow', drawScarecrow), x: 234, y: 92 },
    ...[0, 1, 2, 3, 4, 5].map((i) => ({ art: a(`fence${i}`, () => drawFence(i > 0, i < 5)), x: 146 + i * 16, y: 112 })),
    // Barn and animals.
    { art: a('barn', drawBarn), x: 262, y: 100 },
    { art: ANIMAL_ART.cow, x: 300, y: 114, flip: true },
    { art: ANIMAL_ART.sheep, x: 330, y: 112, offset: 1 },
    { art: ANIMAL_ART.chicken, x: 250, y: 116 },
    { art: ANIMAL_ART.chicken, x: 238, y: 110, offset: 1, flip: true },
    { art: ANIMAL_ART.duck, x: 222, y: 116 },
    { art: ANIMAL_ART.rabbit, x: 372, y: 110, flip: true },
    { art: ANIMAL_ART.butterfly, x: 200, y: 40 },
    { art: ANIMAL_ART.butterfly, x: 96, y: 30, offset: 1 },
    // The path and the people on it.
    { art: playerArt, x: 120, y: PATH_Y + 14 },
    { art: { ...ANIMAL_ART.dog, key: 'hero-dog', frames: { w: 16, h: 14, count: 2 } }, x: 98, y: PATH_Y + 14 },
    { art: npcArt('tobin'), x: 210, y: PATH_Y + 14, offset: 1 },
    { art: npcArt('mira'), x: 290, y: PATH_Y + 16, offset: 2 },
    { art: ANIMAL_ART.cat, x: 60, y: PATH_Y + 14, flip: true },
    // The market below the path.
    ...(['rosa', 'bram', 'finn', 'willa'] as NpcId[]).flatMap((id, i) => [
      { art: a(`stall${i}`, () => drawStall(i + 1)), x: 70 + i * 66, y: 178 },
      { art: npcArt(id), x: 78 + i * 66, y: 182, offset: i },
    ]),
    { art: a('flowers', drawFlowerBed), x: 22, y: 172 },
    { art: a('bush', () => drawBush(v('bush', 1), 1, OAK_FOLIAGE.summer)), x: 340, y: 168 },
    { art: a('grass0', () => drawTallGrass(v('grass', 0), 0, GRASS_FOLIAGE.summer)), x: 360, y: 176 },
    { art: a('grass1', () => drawTallGrass(v('grass', 1), 1, GRASS_FOLIAGE.summer)), x: 6, y: 150 },
    { art: a('pine2', () => drawPine(v('pine', 0), PINE_FOLIAGE.summer)), x: 378, y: 190 },
  ];
  return pieces;
}

function HeroScene() {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [meadow, setMeadow] = useState('');
  const [path, setPath] = useState('');
  const pieces = useMemo(() => heroPieces(), []);

  useEffect(() => {
    setMeadow(meadowPattern(16, 12, 'valley-hero'));
    setPath(renderArt(tileArt(TILE.PATH_BASE + 5, 'Path')).toDataURL());
    const el = box.current!;
    const fit = () => setScale(Math.max(1, Math.min(4, Math.floor(el.clientWidth / WORLD.w))) || 1);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const S = scale;
  return (
    <div
      ref={box}
      className="hero-scene"
      style={{
        height: S ? WORLD.h * S : 360,
        backgroundImage: meadow ? `url(${meadow})` : undefined,
        backgroundSize: S ? `${256 * S}px ${192 * S}px` : undefined,
      }}
    >
      {S > 0 && (
        <>
          <div className="hero-path" style={{ top: (PATH_Y - 4) * S, height: 16 * S, backgroundImage: path ? `url(${path})` : undefined, backgroundSize: `${16 * S}px ${16 * S}px` }} />
          <div className="hero-world" style={{ width: WORLD.w * S, height: WORLD.h * S }}>
            {pieces.map((p, i) => {
              const size = artSize(p.art);
              return (
                <Sprite
                  key={i}
                  art={p.art}
                  scale={S}
                  flip={p.flip}
                  offset={p.offset}
                  className="hero-piece"
                  style={{ left: p.x * S, top: (p.y - size.h) * S, zIndex: p.ground ? 0 : p.y }}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ---------- The page ----------

export function Landing() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const totalArt = ART_GROUPS.reduce((n, g) => n + g.items.length, 0) + ITEM_GROUPS.reduce((n, g) => n + g.ids.length, 0);

  return (
    <div className="site">
      <SiteHeader />

      <section className="hero">
        <div className="hero-copy">
          <PixelLogo scale={10} className="hero-logo" />
          <p className="hero-tagline">A cozy pixel valley to farm, fish, mine, craft and build — alone or with friends, right in your browser.</p>
          <div className="hero-actions">
            <Link className="site-btn site-btn-play site-btn-big" href="/dashboard">
              ▶ Play
            </Link>
            <Link className="site-btn site-btn-big" href="/docs">
              Docs
            </Link>
          </div>
        </div>
        {ready ? <HeroScene /> : <div className="hero-scene" style={{ height: 368 }} />}
      </section>

      <main className="showcase">
        <header className="showcase-head">
          <h2>Everything in the valley</h2>
          <p>
            Every sprite in the game, drawn live by the same code the game uses — {totalArt} pieces of pixel art. Hover any of them for its name.
          </p>
        </header>

        {ready &&
          ART_GROUPS.map((group) => (
            <section key={group.id} className="art-group" id={group.id}>
              <h3>{group.title}</h3>
              <p className="art-blurb">{group.blurb}</p>
              {group.id === 'crops' ? (
                <div className="crop-rows">
                  {CROP_IDS.map((id) => (
                    <div key={id} className="crop-row">
                      <span className="crop-name">{CROPS[id].name}</span>
                      <div className="crop-stages">
                        {cropStages(id).map((art, i, all) => (
                          <span key={art.key} className={`crop-stage${i === all.length - 1 ? ' is-ripe' : ''}`}>
                            <Sprite art={art} scale={2} />
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
              <div className={`art-grid art-grid-${group.id}`}>
                {group.items.map((art) => (
                  <figure key={art.key} className="art-cell">
                    <div className="art-frame">
                      <Sprite art={art} scale={group.scale ?? 3} />
                    </div>
                    {group.id !== 'tiles' && group.id !== 'crops' && <figcaption>{art.name}</figcaption>}
                  </figure>
                ))}
              </div>
              )}
            </section>
          ))}

        {ready && (
          <section className="art-group" id="items">
            <h3>Items</h3>
            <p className="art-blurb">Every item you can hold — {ITEM_GROUPS.reduce((n, g) => n + g.ids.length, 0)} of them.</p>
            {ITEM_GROUPS.map((g) => (
              <div key={g.category} className="item-group">
                <h4>
                  {g.title} <span>{g.ids.length}</span>
                </h4>
                <div className="item-grid">
                  {g.ids.map((id) => (
                    <div key={id} className="item-cell" title={ITEMS[id].name}>
                      <Sprite art={itemArt(id)} scale={2} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}
      </main>

      <footer className="site-footer">
        <PixelLogo scale={3} />
        <span>
          {Object.keys(NPCS).length} villagers · 4 seasons · 30 mine floors
        </span>
      </footer>
    </div>
  );
}
