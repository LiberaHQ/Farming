'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ARCS,
  CARNIVAL_BARKER,
  CARNIVAL_GAMES,
  CARNIVAL_PRIZES,
  CARNIVAL_RIDES,
  CARNIVAL_TREATS,
  CARNIVAL_STAFF,
  CARD_BONUS,
  GOLDEN_HOUR,
  JUGGLER_TIP,
  TOKEN_PRICE,
  type CarnivalStaffId,
  BOSSES,
  COOP,
  ITEMS,
  MONSTERS,
  NPCS,
  ROMANCE,
  WILDLIFE,
  WILDLIFE_IDS,
  type ItemId,
  type MonsterKind,
  type NpcId,
} from '@farming/shared';
import { ANIMAL_ART, barkerArt, CREATURE_ART, WILDLIFE_ART, itemArt, npcArt, playerArt, staffArt, type Art } from './catalog';
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
  { id: 'wildlife', title: 'Wildlife & tides' },
  { id: 'places', title: 'Homes, museum & island' },
  { id: 'skills', title: 'Skills, horse & tricks' },
  { id: 'sky', title: 'Weather, wildlife & calendar' },
  { id: 'carnival', title: 'The carnival' },
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
            <h1>The Harvest Valley handbook</h1>
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
                ['P', 'pet: stay / follow'],
                ['H', 'horse: ride / get off / call'],
                ['L', 'calendar'],
                ['N', 'show / hide the minimap'],
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
              <a href="#carnival" className="glance-card">
                {ready && <Sprite art={barkerArt} scale={3} offset={1} />}
                <strong>Carnival</strong>
                <span>Pip runs games, rides and prizes.</span>
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

          <section id="wildlife" className="doc-section">
            <h2>Wildlife, tides & weather</h2>
            <p>
              The beach, the forest and the carnival share the farm's sky: rain and snow fall there too, and night comes with lamplight
              (the beach bonfire and pier lantern, the hermit's window, your own lantern).
            </p>
            <p>
              <strong>Tides.</strong> The sea comes in and goes out twice a day: low tide around 9am and 9pm, high tide around 3am and
              3pm. The label at the top left tells you which way it's going. At low tide, rock pools appear past the usual waterline, each
              with one find a day: <Item id="sea_urchin" />, <Item id="sea_star" />, coral, the odd crab, and rarely a{' '}
              <Item id="rainbow_shell" />.
            </p>
            <h3 className="doc-sub">Rare creatures</h3>
            <p className="doc-muted">Each one is logged under Collection (K) → Wildlife the first time you see it.</p>
            <div className="role-list">
              {WILDLIFE_IDS.map((id) => (
                <RoleCard key={id} art={ready ? WILDLIFE_ART[id] : undefined} title={`${WILDLIFE[id].emoji} ${WILDLIFE[id].name}`} tag="Rare" tagKind="gold">
                  <p>{WILDLIFE[id].description}</p>
                  <dl>
                    <dt>Where & when</dt>
                    <dd>{WILDLIFE[id].hint}</dd>
                  </dl>
                </RoleCard>
              ))}
            </div>
          </section>

          <section id="places" className="doc-section">
            <h2>Homes, the museum & the island</h2>
            <p>
              <b>Villagers' homes.</b> Everyone has a house near the path (🏠 on the map). Merchants walk home from their stall when it closes and their windows light up in the evening. Knock on the door: under 2 hearts they'll say "maybe another time", from 2 hearts you're invited in, and from 4 hearts they have a little treat for you once a day. After 10pm they're asleep.
            </p>
            <p>
              <b>The museum</b> (🏛 on the map). Donate fish, shore finds, ores and gems, and artifacts to fill 30 pedestals in four collections. Finishing a collection pays gold and a gift by mail; fill them all for 5000g. Artifacts: old coins and arrowheads from digging soil, clay pots and fossils from mine rock, stone tablets and a golden idol from the island cave.
            </p>
            <p>
              <b>The island.</b> Repair the rowing boat by the pier (40 wood, 8 hardwood, 20 fiber) and row over. Collect coconuts under the palms, trade them to the parrot for pineapple seeds and taro tubers, and grow them in the island garden in any season with no watering. Reef fish bite all around (look out for the swordfish), and a sea turtle comes ashore some mornings. Break the cracked boulder by the cliff with a copper pickaxe to find the cave: rubies, jade, a giant clam with pearls, and an ancient chest.
            </p>
          </section>

          <section id="skills" className="doc-section">
            <h2>Skills, your horse & pet tricks</h2>
            <p>
              <b>Skills.</b> Farming, Fishing, Mining and Foraging level up from 0 to 10 as you harvest, fish, break rocks and chop or forage. Each level adds a 3% chance of an extra crop, ore, wood or find (fishing gets a bigger catch bar instead); from level 5 that skill's tool costs less energy. See them under Collection → Skills.
            </p>
            <p>
              <b>Horse.</b> Buy one from Mira (2500g, once you've earned 1000g), use it on open ground, then press H next to it to ride — about twice as fast. H again gets off; from far away, H whistles and it comes to you.
            </p>
            <p>
              <b>Pet tricks.</b> Hold wood and press E on your dog to play fetch. Press E again after petting for a trick. Dogs that love you dig on open grass once or twice a day and find old coins, arrowheads, ore, forage or even gold. You can keep both a cat and a dog: after you adopt one, the other stray comes back to your door.
            </p>
          </section>

          <section id="sky" className="doc-section">
            <h2>Weather, wildlife & the calendar</h2>
            <p>
              <b>Storms.</b> Some rainy days bring thunder and lightning; a bolt can hit a tree and leave charcoal. The dry morning after a storm, a rainbow makes you Lucky for the day.
            </p>
            <p>
              <b>Sky and ice.</b> On summer day 7 a meteor shower lights the night, and meteorites land on the farm by morning. In winter, fish through the ice for icefish and the rare glacierfish.
            </p>
            <p>
              <b>Wildlife.</b> Squirrels around the oaks, frogs by the water when it rains, and deer grazing in the old forest — get too close and they scatter.
            </p>
            <p>
              <b>Birthdays & the calendar.</b> Each villager has a birthday; gifts that day count double. Press L for the calendar. The Journal's Guide tab (Q) lists everything there is to discover.
            </p>
            <p>
              <b>Daily goals.</b> Each morning brings three small goals (top right): gather, forage, chat, fish, harvest and more. Each pays gold; finish all three for a bonus and to keep your streak going. Streaks of 3, 7, 14 and 30 days bring special rewards.
            </p>
            <p>
              <b>Crop quality.</b> Harvests can come out silver (☆) or gold (★), worth 25% or 50% more. Your farming level and fertilizer improve the odds.
            </p>
            <p>
              <b>Fruit trees.</b> Mira sells cherry, peach and apple saplings. Plant one on open grass with some room around it. It grows on its own for a season, then bears fruit every year in its own season: press E to shake the fruit down. An axe removes it.
            </p>
            <p>
              <b>The valley train.</b> A little steam train runs along its own track south of the path three or four times a day. You'll hear its whistle. Don't stand on the rails when it comes. Now and then coal, ore, wood or, very rarely, a golden spike falls off by the tracks.
            </p>
            <p>
              <b>The graveyard ghost.</b> After 10pm, a friendly ghost named Elsie floats over her grave in the old graveyard. Help her find her three lost belongings (they glint where they lie, and the map shows the way) and she'll reward you before she finally rests.
            </p>
          </section>

          <section id="carnival" className="doc-section">
            <h2>The carnival</h2>
            <p>
              Follow the CARNIVAL arrow signs by your cottage along the main path to the striped arch with lamp posts and balloons (🎡 on the map) and walk through it. Buy tokens at the ticket booth for {TOKEN_PRICE}g each, play
              games for prize tickets, and trade tickets for prizes. It&apos;s open every day.
            </p>
            <div className="role-list">
              <RoleCard art={ready ? barkerArt : undefined} title={CARNIVAL_BARKER.name} tag={`Carnival · ${CARNIVAL_BARKER.title}`} tagKind="red">
                <p className="role-quote">“{CARNIVAL_STAFF.pip.lines[0]}”</p>
                <dl>
                  <dt>Runs</dt>
                  <dd>The ticket booth: tokens for {TOKEN_PRICE}g each</dd>
                </dl>
              </RoleCard>
              <RoleCard art={ready ? staffArt('dot') : undefined} title="Dot" tag="Carnival · Prize keeper" tagKind="red">
                <p className="role-quote">“{CARNIVAL_STAFF.dot.lines[0]}”</p>
                <dl>
                  <dt>Runs</dt>
                  <dd>The prize booth: trade prize tickets for treats, toys and the trophy</dd>
                </dl>
              </RoleCard>
              <RoleCard art={ready ? staffArt('gus') : undefined} title="Gus" tag="Carnival · Treat seller" tagKind="red">
                <p className="role-quote">“{CARNIVAL_STAFF.gus.lines[0]}”</p>
                <dl>
                  <dt>Sells</dt>
                  <dd className="doc-items">
                    {ready && (Object.keys(CARNIVAL_TREATS) as Array<keyof typeof CARNIVAL_TREATS>).map((id) => <Item key={id} id={id} price={CARNIVAL_TREATS[id]} />)}
                  </dd>
                </dl>
              </RoleCard>
              <RoleCard art={ready ? staffArt('zara') : undefined} title="Madame Zara" tag="Carnival · Fortune teller" tagKind="blue">
                <p>One free fortune a day in her tent. Each fortune brings a blessing for the rest of the day: Lucky, Angler, Miner or Swift.</p>
              </RoleCard>
              <RoleCard art={ready ? staffArt('jojo') : undefined} title="Jojo" tag="Carnival · Juggler" tagKind="gold">
                <p>Juggles on the stage east of the plaza. Tip him {JUGGLER_TIP}g once a day (Space) and luck follows you for two hours.</p>
              </RoleCard>
              <RoleCard art={ready ? staffArt('host_whack') : undefined} title="Game hosts" tag="Carnival · Staff" tagKind="green">
                <p>
                  {(['host_ring', 'host_whack', 'host_ducks', 'host_memory', 'host_strength'] as CarnivalStaffId[]).map((id, i, all) => (
                    <span key={id}>
                      <b>{CARNIVAL_STAFF[id].name}</b> ({CARNIVAL_STAFF[id].title.replace(' host', '')}){i < all.length - 1 ? ', ' : ''}
                    </span>
                  ))}{' '}
                  stand behind the counters and call out to passers-by.
                </p>
              </RoleCard>
              <RoleCard art={ready ? npcArt('rosa') : undefined} title="Visitors" tag="Carnival · Crowd" tagKind="green">
                <p>
                  Folk from all over stroll between the rides and tents, some with balloons. Chat to them for tips; they cheer when you win big. In the evening a couple of
                  villagers come too, and chatting to them counts as your daily talk.
                </p>
              </RoleCard>
            </div>
            <h3 className="doc-sub">Games</h3>
            <div className="trade-grid">
              {Object.values(CARNIVAL_GAMES).map((g) => (
                <div key={g.id} className="trade">
                  <h4>
                    {g.icon} {g.name}
                  </h4>
                  <p>{g.howTo}</p>
                  <p>
                    <b>
                      {g.cost} token{g.cost > 1 ? 's' : ''}
                    </b>{' '}
                    · up to {g.tickets(g.maxScore)} tickets
                  </p>
                </div>
              ))}
              <div className="trade">
                <h4>🎯 Wheel of Fortune</h4>
                <p>One free spin a day: tickets, tokens, treats — or the 25-ticket jackpot.</p>
              </div>
              <div className="trade">
                <h4>🎡 Rides</h4>
                <p>
                  {CARNIVAL_RIDES.ferris.name}: +{CARNIVAL_RIDES.ferris.energy} energy. {CARNIVAL_RIDES.carousel.name}: Swift for {CARNIVAL_RIDES.carousel.buffMinutes / 60}h. 1 token each.
                </p>
              </div>
            </div>
            <h3 className="doc-sub">Every day</h3>
            <ul className="doc-steps">
              <li>
                <b>Carnival card</b>: play all five games in one day for {CARD_BONUS} bonus tickets. Check the board by the arch.
              </li>
              <li>
                <b>Daily challenge</b>: one game and a score to beat, for bonus tickets.
              </li>
              <li>
                <b>Golden hour</b> ({GOLDEN_HOUR.from / 60 - 12}–{GOLDEN_HOUR.to / 60 - 12}pm): every ticket from games counts ×{GOLDEN_HOUR.multiplier}.
              </li>
              <li>
                <b>After dark</b>: the lights come on and fireworks fill the sky.
              </li>
              <li>
                <b>Best scores</b> for every game are kept; beat them for a ⭐.
              </li>
            </ul>
            <h3 className="doc-sub">Prizes</h3>
            <div className="doc-items doc-prizes">
              {ready &&
                CARNIVAL_PRIZES.map((p) => (
                  <span key={p.itemId}>
                    <Item id={p.itemId} qty={p.quantity} /> <em className="doc-muted">{p.tickets} tickets</em>
                  </span>
                ))}
            </div>
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
