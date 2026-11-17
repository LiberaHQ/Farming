'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ARCS,
  BOSSES,
  COOP,
  ITEMS,
  MONSTERS,
  NPCS,
  ROMANCE,
  type ItemId,
  type MonsterKind,
  type NpcId,
} from '@farming/shared';
import { ANIMAL_ART, CREATURE_ART, itemArt, npcArt, playerArt, type Art } from './catalog';
import { SiteHeader } from './SiteChrome';
import { Sprite } from './Sprite';

const clock = (m: number) => {
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  return `${((h + 11) % 12) + 1}:${mm} ${h < 12 ? 'am' : 'pm'}`;
};

/** A small item icon with its name, used throughout the docs. */
function Item({ id, qty, price }: { id: ItemId; qty?: number; price?: number }) {
  return (
    <span className="doc-item" title={ITEMS[id].description}>
      <Sprite art={itemArt(id)} scale={1.5} animate={false} />
      {qty ? `${qty}× ` : ''}
      {ITEMS[id].name}
      {price !== undefined && <em>{price}g</em>}
    </span>
  );
}

function RoleCard({ art, scale = 4, title, tag, tagKind = 'gold', children }: { art?: Art; scale?: number; title: string; tag: string; tagKind?: string; children: React.ReactNode }) {
  return (
    <article className="role-card">
      <div className="role-portrait">{art && <Sprite art={art} scale={scale} />}</div>
      <div className="role-body">
        <header>
          <h3>{title}</h3>
          <span className={`role-tag role-tag-${tagKind}`}>{tag}</span>
        </header>
        {children}
      </div>
    </article>
  );
}

const SECTIONS = [
  { id: 'start', title: 'Getting started' },
  { id: 'roles', title: 'Roles at a glance' },
  { id: 'you', title: 'You, the farmer' },
  { id: 'coop', title: 'Co-op roles' },
  { id: 'villagers', title: 'Villagers' },
  { id: 'animals', title: 'Animals & pets' },
  { id: 'creatures', title: 'Creatures of the mine' },
  { id: 'friendship', title: 'Friendship & romance' },
];

const TRADES: Array<{ name: string; icon: ItemId; text: string }> = [
  { name: 'Farmer', icon: 'watering_can', text: 'Till soil with the hoe, plant seeds, water every day and harvest. Each crop has its own seasons; a greenhouse ignores them.' },
  { name: 'Rancher', icon: 'egg', text: 'Raise chickens, ducks and rabbits in the open and cows and sheep in a barn. Keep hay in the trough and visit daily for eggs, milk and wool.' },
  { name: 'Fisher', icon: 'fishing_rod', text: 'Cast into rivers or the sea, wait for the “!”, then keep the fish in the green bar to reel it in. Crab pots catch while you sleep.' },
  { name: 'Miner', icon: 'pickaxe', text: 'Break rocks for ore and gems across 30 floors. Fight slimes, bats, crabs and ghosts, and face a boss every tenth floor.' },
  { name: 'Forager', icon: 'mushroom', text: 'Wild herbs, mushrooms, nuts and berries appear in the forest — different finds every season.' },
  { name: 'Cook', icon: 'omelette', text: 'Cook at the stove in your cottage. Meals restore energy and many give a buff, such as Swift, Miner or Lucky.' },
  { name: 'Builder', icon: 'chest', text: 'Craft and place chests, sprinklers, machines, fences, paths, decor and buildings, and furnish your home.' },
];

export function Docs() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const npcIds = Object.keys(NPCS) as NpcId[];
  const merchants = npcIds.filter((id) => NPCS[id].role === 'merchant');
  const villagers = npcIds.filter((id) => NPCS[id].role === 'villager');

  return (
    <div className="site">
      <SiteHeader current="docs" />
      <div className="docs">
        <aside className="docs-nav">
          <strong>Guide</strong>
          <ol>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.title}</a>
              </li>
            ))}
          </ol>
        </aside>

        <article className="docs-body">
          <header className="docs-title">
            <h1>The Valley handbook</h1>
            <p>Who lives in the valley, what everyone does, and how you fit in.</p>
          </header>

          <section id="start" className="doc-section">
            <h2>Getting started</h2>
            <p>
              Press <Link href="/start">Play</Link>, name a world and you start on a small farm with a cottage, a few tools and a handful of seeds. Play as a guest
              (saves stay in your browser) or create an account to keep your worlds anywhere and play with friends.
            </p>
            <div className="doc-keys">
              {[
                ['WASD / arrows', 'move'],
                ['Shift', 'run'],
                ['Space', 'use tool'],
                ['E', 'interact'],
                ['F', 'eat'],
                ['I', 'backpack'],
                ['C', 'crafting'],
                ['M', 'map'],
                ['Q', 'journal'],
                ['K', 'collection'],
                ['T', 'emote'],
                ['Esc', 'menu'],
              ].map(([k, what]) => (
                <span key={k}>
                  <kbd>{k}</kbd> {what}
                </span>
              ))}
            </div>
            <p className="doc-muted">Keys can be changed in Settings. Gamepads and touch screens work too.</p>
          </section>

          <section id="roles" className="doc-section">
            <h2>Roles at a glance</h2>
            <div className="glance">
              <a href="#you" className="glance-card">
                {ready && <Sprite art={playerArt} scale={3} />}
                <strong>You</strong>
                <span>The farmer. Every trade is open to you.</span>
              </a>
              <a href="#coop" className="glance-card">
                {ready && <Sprite art={npcArt('willa')} scale={3} offset={1} />}
                <strong>Host & guests</strong>
                <span>Up to {COOP.maxPlayers} players share one farm.</span>
              </a>
              <a href="#villagers" className="glance-card">
                {ready && <Sprite art={npcArt('mira')} scale={3} offset={2} />}
                <strong>{merchants.length} merchants</strong>
                <span>Run the market stalls and sell what you need.</span>
              </a>
              <a href="#villagers" className="glance-card">
                {ready && <Sprite art={npcArt('tobin')} scale={3} />}
                <strong>
                  {villagers.length} villager{villagers.length === 1 ? '' : 's'}
                </strong>
                <span>Neighbours who chat, gift and help out.</span>
              </a>
              <a href="#animals" className="glance-card">
                {ready && <Sprite art={ANIMAL_ART.chicken} scale={3} />}
                <strong>Animals</strong>
                <span>A pet, plus coop and barn animals.</span>
              </a>
              <a href="#creatures" className="glance-card">
                {ready && <Sprite art={CREATURE_ART.slime} scale={3} />}
                <strong>Creatures</strong>
                <span>Monsters and bosses deep in the mine.</span>
              </a>
            </div>
          </section>

          <section id="you" className="doc-section">
            <h2>You, the farmer</h2>
            <p>
              You are the newest farmer in the valley. There are no classes to pick: you take on every trade, in any order, at your own pace. Energy is your
              one limit — tools use it, food brings it back and a good night&apos;s sleep refills it.
            </p>
            <div className="trade-grid">
              {TRADES.map((t) => (
                <div key={t.name} className="trade">
                  <h4>
                    {ready && <Sprite art={itemArt(t.icon)} scale={2} animate={false} />} {t.name}
                  </h4>
                  <p>{t.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="coop" className="doc-section">
            <h2>Co-op roles</h2>
            <p>Signed-in players can open a world to friends. Up to {COOP.maxPlayers} people farm the same valley at once.</p>
            <div className="role-list">
              <RoleCard art={ready ? playerArt : undefined} title="Host" tag="Owner" tagKind="gold">
                <p>Opens their world from the title screen with <b>Host co-op</b> and shares the join code, or lists the game as public in Open games.</p>
                <ul>
                  <li>Owns the farm, the farmhouse and the save.</li>
                  <li>Chooses the room settings: public or private, and whether to share one wallet.</li>
                  <li>If the host reloads or drops out with nobody else online, the world waits 30 seconds for them before closing.</li>
                </ul>
              </RoleCard>
              <RoleCard art={ready ? npcArt('finn') : undefined} title="Guest" tag="Farmhand" tagKind="green">
                <p>Joins with a code, from a friend&apos;s invite or from the list of open games.</p>
                <ul>
                  <li>Gets a cabin of their own beside the farmhouse to sleep in. It only stands while they are playing, and it is in the same spot when they return.</li>
                  <li>Farms, fishes, mines and trades on the shared farm. Their own backpack, gold, friendships and progress are saved to their account.</li>
                  <li>Can trade items with other players and use emotes and chat.</li>
                </ul>
              </RoleCard>
              <RoleCard art={ready ? npcArt('bram') : undefined} title="Leader" tag="Stand-in" tagKind="blue">
                <p>When the host leaves mid-session, the guest who has been there longest takes over as leader so the day keeps running. The host takes back the lead on return.</p>
              </RoleCard>
            </div>
            <p className="doc-muted">
              Shared wallet: when the host turns it on, everyone&apos;s gold goes into one purse. Anyone who leaves takes their share with them. Everyone has to
              go to bed for the day to end.
            </p>
          </section>

          <section id="villagers" className="doc-section">
            <h2>Villagers</h2>
            <p>
              Merchants keep a stall at the village market during their opening hours. Talk to anyone once a day and give them gifts to make friends; at 3, 5
              and 7 hearts they ask you for a favour.
            </p>
            <div className="role-list">
              {npcIds.map((id) => {
                const n = NPCS[id];
                const arcs = ARCS[id] ?? [];
                return (
                  <RoleCard
                    key={id}
                    art={ready ? npcArt(id) : undefined}
                    title={n.name}
                    tag={n.role === 'merchant' ? `Merchant · ${n.title}` : `Villager · ${n.title}`}
                    tagKind={n.role === 'merchant' ? 'gold' : 'green'}
                  >
                    <p className="role-quote">“{n.lines.general[0]}”</p>
                    <dl>
                      <dt>{n.role === 'merchant' ? 'Stall open' : 'Out and about'}</dt>
                      <dd>
                        {clock(n.hours.from)} – {clock(n.hours.to)}
                      </dd>
                      {n.shop && (
                        <>
                          <dt>Sells at {n.shop.title}</dt>
                          <dd className="doc-items">
                            {ready && n.shop.sells.map((s) => <Item key={s.itemId} id={s.itemId} price={s.price} />)}
                          </dd>
                          <dt>Buys</dt>
                          <dd className="doc-items">
                            {n.shop.buys === 'any' ? 'Anything you bring' : ready && n.shop.buys.map((b) => <Item key={b.itemId} id={b.itemId} price={b.price} />)}
                          </dd>
                        </>
                      )}
                      <dt>Loves</dt>
                      <dd className="doc-items">{ready && n.gifts.loved.map((g) => <Item key={g} id={g} />)}</dd>
                      <dt>Likes</dt>
                      <dd className="doc-items">{ready && n.gifts.liked.map((g) => <Item key={g} id={g} />)}</dd>
                      {arcs.length > 0 && (
                        <>
                          <dt>Favours</dt>
                          <dd>
                            <ol className="favours">
                              {arcs.map((step) => (
                                <li key={step.hearts}>
                                  <span className="hearts">♥{step.hearts}</span> brings {ready && <Item id={step.want.itemId} qty={step.want.quantity} />} for{' '}
                                  {step.reward.gold ? <b>{step.reward.gold}g</b> : step.reward.item && ready ? <Item id={step.reward.item.itemId} qty={step.reward.item.quantity} /> : null}
                                </li>
                              ))}
                            </ol>
                          </dd>
                        </>
                      )}
                    </dl>
                  </RoleCard>
                );
              })}
            </div>
          </section>

          <section id="animals" className="doc-section">
            <h2>Animals & pets</h2>
            <div className="role-list">
              <RoleCard art={ready ? ANIMAL_ART.dog : undefined} title="Pet" tag="Companion" tagKind="green">
                <p>
                  On day 2 a letter from Tobin tells you a stray cat and dog have turned up. Adopt one, name it and pet it each day; it follows you around the farm.
                </p>
                <div className="pet-pair">{ready && <Sprite art={ANIMAL_ART.cat} scale={3} />}</div>
              </RoleCard>
              {(
                [
                  ['chicken', 'Chicken', 'Coop animal', 'egg'],
                  ['duck', 'Duck', 'Coop animal', 'duck_egg'],
                  ['rabbit', 'Rabbit', 'Coop animal', 'rabbit_foot'],
                  ['cow', 'Cow', 'Barn animal', 'milk'],
                  ['sheep', 'Sheep', 'Barn animal', 'wool'],
                ] as const
              ).map(([kind, name, tag, product]) => {
                const price = NPCS.mira.shop?.sells.find((s) => s.itemId === kind)?.price;
                return (
                  <RoleCard key={kind} art={ready ? ANIMAL_ART[kind] : undefined} title={name} tag={tag} tagKind={tag === 'Barn animal' ? 'blue' : 'gold'}>
                    <p>
                      {tag === 'Barn animal'
                        ? 'Lives in a barn (up to 4 per barn). Keep hay in the trough and pet it daily; a happy, fed animal is ready to collect each morning.'
                        : 'Release it anywhere on the farm — no coop needed. It leaves its produce on the ground each morning.'}
                    </p>
                    <dl>
                      <dt>Gives</dt>
                      <dd className="doc-items">{ready && <Item id={product} />}</dd>
                      <dt>Buy from</dt>
                      <dd>
                        Mira{price ? `, ${price}g` : ''}
                        {ITEMS[kind].unlockAtEarnings ? ` (after you've earned ${ITEMS[kind].unlockAtEarnings}g)` : ''}
                      </dd>
                    </dl>
                  </RoleCard>
                );
              })}
            </div>
          </section>

          <section id="creatures" className="doc-section">
            <h2>Creatures of the mine</h2>
            <p>Find the mine entrance on the map and take the ladders down. Monsters get tougher the deeper you go; a sword and armour from Bram help.</p>
            <div className="role-list">
              {(Object.keys(MONSTERS) as MonsterKind[]).map((k) => {
                const m = MONSTERS[k];
                return (
                  <RoleCard key={k} art={ready ? CREATURE_ART[k] : undefined} title={m.name} tag={`From floor ${m.minFloor}`} tagKind="red">
                    <p>
                      {m.flies === 'walls' ? 'Drifts straight through walls. ' : m.flies === 'rocks' ? 'Flies over rocks. ' : ''}
                      Health {m.hp(m.minFloor)}, hits for {m.damage(m.minFloor)} on its first floor.
                    </p>
                    <dl>
                      <dt>Drops</dt>
                      <dd className="doc-items">
                        {ready &&
                          m.drops.map((d) => (
                            <span key={d.itemId}>
                              <Item id={d.itemId} /> <em className="doc-muted">{Math.round(d.chance * 100)}%</em>
                            </span>
                          ))}
                      </dd>
                    </dl>
                  </RoleCard>
                );
              })}
            </div>
            <h3 className="doc-sub">Bosses</h3>
            <div className="boss-row">
              {BOSSES.map((b) => (
                <div key={b.floor} className="boss">
                  <div className="boss-art" style={{ filter: `drop-shadow(0 0 6px #${b.tint.toString(16).padStart(6, '0')})` }}>
                    {ready && <Sprite art={CREATURE_ART[b.base as MonsterKind]} scale={5} />}
                  </div>
                  <strong>{b.name}</strong>
                  <span>
                    Floor {b.floor} · {b.hp} health
                  </span>
                </div>
              ))}
            </div>
            <p className="doc-muted">A boss guards every tenth floor. The way down opens once it falls, and every boss floor hides a treasure chest.</p>
          </section>

          <section id="friendship" className="doc-section">
            <h2>Friendship & romance</h2>
            <ul className="doc-steps">
              <li>
                <b>Talk</b> to a villager once a day and <b>give a gift</b> — loved gifts count most.
              </li>
              <li>
                <b>Favours</b> unlock at 3, 5 and 7 hearts and pay out gold or rare items.
              </li>
              <li>
                At <b>{ROMANCE.bouquetHearts} hearts</b>, give a {ready && <Item id="bouquet" />} to start dating.
              </li>
              <li>
                At <b>{ROMANCE.pendantHearts} hearts</b>, a {ready && <Item id="pendant" />} is a proposal. The wedding is {ROMANCE.weddingDelay} days later, and your spouse
                moves into the cottage.
              </li>
            </ul>
          </section>
        </article>
      </div>
      <footer className="site-footer">
        <span>
          Ready? <Link href="/start">Start playing →</Link>
        </span>
      </footer>
    </div>
  );
}
