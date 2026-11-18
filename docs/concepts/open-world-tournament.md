# Open World and Tournaments — concept (draft for review)

Status: **version 1 built** with the recommended answers (valleys of 40, 8 × 8 plots, 2-hour days, the fees and 90/10 split below, Mine Dash with all three kits, the new mine content in the normal mine too). What's built and what isn't yet: see the README sections “The deeper mine” and “The Open World and Mine Dash tournaments”. Questions still open are marked **Decide**.

## 1. The pitch

Two layers:

1. **The Open World** is free. Anyone with an account joins from the title screen's **Open World**
   section (renamed from "Open games"). It's a public, always-on Harvest Valley on the familiar map:
   you get a plot of land, farm, fish, mine, and meet other players. It plays like a private co-op
   world, only busier. Here you earn **Open World gold**.
2. **Tournaments** run inside the Open World. Entry costs a set amount of Open World gold. Entry fees
   build a prize pool, the best players win it (plus trophies and titles), and a share of every fee
   is removed from the game so gold keeps its value.

The world gives everyone somewhere to live and earn; tournaments give them a reason to compete and to
spend what they earn.

## 2. The big constraint: 1,000 players vs. one map

The current map is 96 × 72 tiles. Measured on three seeds, it has about **4,800 open grass tiles**.
Split among 1,000 players, that's fewer than 5 tiles each. Today's server also sends every position
to every player 10 times a second (1,000 × 1,000 × 10 = 10 million updates a second). So "1,000 on one
map" has to mean one of two things:

| Option | How it works | Good | Bad |
| --- | --- | --- | --- |
| **A. Valleys (recommended)** | One Open World split into ~25 copies of the same map ("valleys") of up to 40 players each. Shared tournaments, leaderboards and global chat. | Keeps the map you know as it is. Each valley feels lively but not crowded. Mostly reuses today's room and world code. Easy to grow: more players means more valleys. | You meet 39 others in person, but tournaments put you against everyone. |
| B. One giant map | A map about 20 times larger: the village in the middle, farm land all around, loaded in chunks. | Truly everyone in one place. | A new map generator, chunk streaming in the client and a much heavier server: months of work, and a different look. |

**Recommended: A.** Tournaments are where all 1,000 players meet, so valleys lose very little.

**Decide:** A or B? Is 40 per valley right, or 20 or 60?

## 3. Joining the Open World

On the title screen, "Open games" becomes **Open World**:

1. **The Open World card**: players online, your valley, your gold, the next three tournaments with
   start times, and **Join** (or **Continue**).
2. **Public farms** below: today's list of public co-op games, unchanged. **Decide:** keep them here?

Join flow:

- Needs an account (already true for co-op).
- The first time, you create an **Open World character**: your look from the character editor, a
  clean backpack, starting gold and starter tools. It's separate from your personal worlds, and
  nothing moves between them, apart from cosmetic rewards. This matters for fairness: personal worlds
  save in the browser and can be edited, so their gold can never be used to pay for tournaments.
- You're placed in a valley automatically: your friends' valley if there's room, otherwise the
  fullest one that isn't full.
- The Open World is **persistent**: your farm stays from month to month. Tournament rankings reset
  each month (§8). **Decide:** keep farms forever, or reset everything every few months?

## 4. Your farm in the Open World: claims

- Each player gets a **claim**, a fenced plot that starts at **8 × 8 tiles** and can be expanded for
  gold (8 × 12, then 12 × 12). 40 players × 8 × 8 = 2,560 tiles, leaving about 2,200 tiles of commons.
- Only you can till, plant, harvest, build or place things on your claim. Others can walk through.
  **No griefing by design.**
- Commons stay shared and first-come: the forest, rocks, forage, the beach, the mine and fishing spots.
- The village works as it does now. Shop stock is per player so nobody can buy everyone out.
- An inactive claim (no visit for X days) becomes "overgrown" and returns to the valley; the owner gets
  a fresh claim if they come back. **Decide:** X = 14 days?

## 5. Time in the Open World

- One clock for everyone, set by us. It never pauses, because the world is always on.
- Days end on the clock, not when everyone sleeps. Everyone who's online wakes up together.
- Offline farms still get the morning update (watered crops grow, sprinklers, silos, auto-collectors).
- **Clock speed:**

  | Game day lasts | Game days per real week | Feel |
  | --- | --- | --- |
  | 12 min (today's "Long") | 840 | Far too fast: a player who logs in once a day misses ~120 days. |
  | **2 hours (recommended)** | **84** | One or two sessions a day keeps a farm going. |
  | 1 real day | 7 | Too slow: most crops wouldn't finish once. |

  Short tournaments (§7) don't depend on this clock: they use their own timer.

## 6. How tournaments work

### Entering

- Tournaments are listed on the **Tournament Board** in the village square, in a **Tournament
  Hall** next to the market, and on the Open World card. Each one shows its type, start time, entry fee,
  current entrants and prize pool.
- Entering costs **Open World gold only**. It's taken when you enter, held by the server, and refunded
  in full if the tournament is cancelled.
- One entry per player per tournament. Time trials can allow up to 3 paid attempts (best one counts).
- Each type has a **free practice mode** with no prize, so nobody pays to learn the rules.
- A minimum number of entrants (for example 8). Below that, it's cancelled and everyone is refunded.

### Entry tiers

| Tier | Entry fee | How often | Who it's for |
| --- | --- | --- | --- |
| Bronze | 250g | Every hour | New players; costs about a day of early farming. |
| Silver | 1,500g | A few times a day | Players with a working farm. |
| Gold | 7,500g | Daily | Established farms. |
| Champion | 25,000g + qualification | Weekly | Top 20 of the month's ranking only (§8). |

The fees are starting points; we'll tune them once we see how much gold players earn per hour.

### Prize pool

- **90% of entry fees** go into the prize pool. **10% is burned** (removed from the game). That keeps
  Open World gold from inflating as farms grow.
- We can **top up** a pool (a guaranteed minimum) for launch events and the Champion tier.
- Payout to roughly the **top 20%** of entrants. Example for 50 entrants: 1st 30%, 2nd 18%, 3rd 12%,
  4th–10th share 25%, 11th–20th share 15%. Everyone in the paid places gets back more than they paid.
- Winners also get a **trophy** (furniture for their cottage), and the top 3 a **title** for the month.

### Three formats

| Format | How it runs | Good for |
| --- | --- | --- |
| **Sealed** | Each entrant plays in a private copy built for the tournament: identical land, kit and seed for everyone. Your Open World farm doesn't matter, only skill. | Fairness; a new player can beat a veteran. |
| **Open** | Played in your own valley with your own farm, animals and tools. | Rewarding long-term progress. |
| **Live** | Everyone starts at the same moment and plays at the same time; results appear live. | Excitement and watching. |

Sealed tournaments also use a **fixed seed** for luck (fish bites, ore drops, quality rolls), so every
entrant faces the same luck and the result comes down to skill.

## 7. Tournament types (what we can organize)

Each one is built on a system the game already has. Format, length and tier are suggestions.

### Recommended launch set

1. **Speed Farm Sprint**: sealed, time trial, 15 real minutes.
   Everyone gets the same empty 10 × 10 plot, the same tools, 300g and a seed shop with special fast
   "tournament seeds" (one growth stage a real minute). Till, plant, water, harvest, replant, ship.
   Score = gold value shipped when the timer ends. The purest farming skill test, and the easiest to
   make fair. Every tier.

2. **Fishing Derby**: live, 20 real minutes, at a derby pond in the valley.
   Uses the fishing minigame. Score = heaviest single fish, with total weight as the tie-breaker.
   Bites and fish are rolled on the server. Bronze to Gold, several times a day.

3. **Mine Dash**: sealed, time trial, 15 real minutes.
   The same generated mine for every entrant. Go as deep as you can; defeating a floor boss earns
   bonus points; ties go to the faster time. Same starting sword, food and energy for all. Silver and
   Gold.
   **Full design, with zones, new enemies and level-by-level progression: §16.**

### Next wave

4. **Prize Vegetable Show**: open, 5 game days.
   Entry buys an identical heirloom seed packet. Grow it on your claim; quality and size depend on
   daily watering, fertilizer and pollinators from the living ecosystem. Judged on your best harvested
   vegetable. Silver and Gold.

5. **Carnival Championship**: live, knockout bracket (16, 32 or 64 players).
   Head-to-head rounds of Ring Toss, Whack-a-Slime, Duck Shoot, High Striker and Memory Cards, the game
   for each round picked at random. Both players get identical targets from the server. Spectators can
   watch the final. Bronze to Gold, weekly Champion final.

6. **Cook-off**: live, 10 real minutes.
   Everyone gets the same mystery basket of ingredients. Cook any recipes you can. Score = total value
   of dishes, plus bonuses for variety and for dishes with buffs. Silver.

7. **Forager's Hunt**: sealed list, played in your valley, one game day.
   A list of 10 finds: forage, tide-pool items at low tide, a fish, a gem from the mine. First to hand
   in the full list wins; the rest rank by items found, then time. Bronze and Silver.

### Long-running and special

8. **Freight Rush**: open, one game day.
   Fill as many train contracts as possible; score = total contract value delivered. Gold.

9. **Night Market Trader**: sealed, one game night.
   Start with 1,000 tournament coins (not your gold) at the ghost night market. Buy low and sell high as
   the server moves prices through the night. Score = final value. Silver.

10. **Farm Design Showcase**: open, one real week.
    Decorate a showcase plot with a fixed decoration budget. Judged half by players' votes (you can't
    vote for yourself or friends, and votes from new accounts count less) and half by a fixed score for
    variety, layout and theme. Gold.

11. **Animal Show**: open, one real week.
    Enter one barn animal or chicken. Score = happiness and care (daily feeding, petting, hay) over
    the week, with a bonus for products. Silver.

12. **Harvest Cup**: open, the whole month.
    The original idea: total value shipped from your claim over the month, ranked by valley and
    overall. Champion tier, with a large topped-up prize pool.

**Decide:** which types go in the launch set (my picks: 1, 2 and 3, because they're short, judged on
the server and easy to make fair).

## 8. Monthly ranking and rewards

- Every tournament placing earns **ranking points** (more for higher tiers and larger fields).
- The **monthly ranking** combines them: overall, per type, per valley and among friends. The top 20
  qualify for the Champion tier.
- End-of-month rewards: titles and badges on your profile and name tag, **exclusive outfits and hats**
  for the character editor, trophy furniture, and a **hall of fame** with each month's top 10.
- Gold prizes stay in the Open World. Cosmetics and titles show everywhere, personal worlds included.

## 9. Gold, prizes and the rules that keep it legal

This design is safe as long as Open World gold is **only earned by playing**:

- Gold can't be bought with real money, can't be withdrawn, and has no value outside the game.
- If that ever changes (paid gold packs, or the Web3 token ideas from earlier), paying to enter a
  contest for a prize starts to look like gambling or a regulated prize contest. Rules differ by
  country, and there are age checks, identity checks and taxes to consider. **That needs a legal
  review before gold and real money are ever connected.**
- Keep tournaments **skill-based**: sealed seeds and fixed luck make skill decide, not chance.
- Gold transfers between players (trading, gifts) are capped per day. Otherwise one player could feed
  many accounts' gold to another, or pay friends to throw a match.

## 10. Social and safety

- **Chat:** valley chat plus a slower global channel (one message every 10–20 seconds). Emotes as today.
- **Mute, block and report** any player; reports go to an admin page.
- Word filter on names and chat; rate limits on chat and actions.
- In live and bracket tournaments, opponents can't chat or trade with each other during the match.

## 11. Fairness and anti-cheat

Today a player's own browser keeps track of their backpack and gold, and the server only checks
reports for impossible jumps. That's fine with friends, not with paid entry and prizes. In the
Open World:

- **The server owns the backpack and gold.** Harvesting, shipping, buying, selling, crafting, cooking
  and eating become server actions (README "Next steps #1"; tournaments are the reason to do it now).
- Quality, luck and tournament scores are worked out on the server only.
- Movement checks already exist; add collision checks against the map.
- One Open World character per account; verified email; minimum account age for Gold and Champion.
- Flag statistical outliers for review before prizes are paid; hold Champion prizes for 24 hours.

## 12. Technical design (how it would be built)

Builds on today's co-op code (`Room`, `CoopWorld`, Socket.IO, the shared protocol).

- **Open World service**: valleys, player placement, the global clock, chat channels.
- **Valley room**: like today's `Room` with up to 40 players and no host (the server is the host),
  claims, the server-owned backpack and gold, and a fixed clock.
- **Tournament service**: the schedule, entry and refunds (gold held in escrow), the prize pool and
  burn, results and ranking points.
- **Sealed instances**: a small one-player room built from a tournament seed (plot, mine or market),
  with its own timer; the score is posted when it ends. Cheap to run, so hundreds can run at once.
- **Live events**: a shared event room (derby pond, carnival bracket) with a live scoreboard.
- **Interest management**: each player gets positions only for players within ~2 screens (and at most
  the 40 nearest). World operations go to nearby players plus the owner.
- **Storage**: real PostgreSQL in production (`DATABASE_URL` is supported; PGlite is for development
  only). Save per claim and per player, plus a ledger table for every entry fee, refund, prize and burn
  (so gold movements can always be audited).
- **Load test**: extend the co-op test bot to run 1,000 bots across 25 valleys, plus 200 sealed
  sprints at once.

## 13. Build phases (after we finalize)

1. **Open World rename + Open World card** (shows "coming soon" until live).
2. **Server-owned backpack and gold** for Open World characters (the fairness foundation).
3. **Valleys and claims**: valley rooms, placement, claim protection, the fixed clock, offline mornings.
4. **Tournament service**: board, entry, escrow, refunds, prize pool, burn, ledger.
5. **First three tournaments**: Speed Farm Sprint (sealed), Fishing Derby (live), Mine Dash (sealed).
6. **Monthly ranking and rewards**: ranking points, Champion qualification, trophies, titles, cosmetics,
   hall of fame.
7. **Scale and safety**: interest management, PostgreSQL, the 1,000-bot load test, chat channels,
   mute/block/report, admin review.
8. **More tournament types**, one at a time.

## 14. Open questions to finalize

1. Valleys (recommended) or one giant map? Valley size: 20, 40 or 60?
2. Open World clock speed (a game day every 2 hours?).
3. Keep Open World farms forever, or reset every few months?
4. Which tournament types for launch (suggested: Speed Farm Sprint, Fishing Derby, Mine Dash)?
5. Entry tiers and fees: are 250 / 1,500 / 7,500 / 25,000g in the right range?
6. Prize split and burn: 90% paid out / 10% burned, paid to the top 20%?
7. Rewards beyond gold: titles, trophies and exclusive outfits — anything else?
8. Gold transfers between players: off, capped (how much a day), or on?
9. Will gold ever be linked to real money or tokens? (If yes, legal review before building §6.)
10. Keep public co-op games listed under Open World?
11. How long before an inactive claim returns to the valley (14 days?)
12. Which ideas from §15 should go into the plan, and which should be dropped?

## 15. More ideas (not chosen yet)

A pool to pick from. Each is built on something the game already has. None are in the build phases yet.

### More tournament types

| Idea | Format | How it works | Built on |
| --- | --- | --- | --- |
| **Horse Derby** | Live, 4–8 riders a heat | A marked course through the valley with gates and jumps; fastest lap wins. Everyone rides the same tournament horse, so owning a horse isn't required. | Horse riding |
| **Pet Agility** | Sealed time trial | Guide your dog or cat through an obstacle course with the pet commands (stay, fetch, tricks). Love level doesn't change the course. | Pets and pet tricks |
| **Treasure Hunt** | Live, one valley | Clues on the board lead to hidden dig spots; your dog sniffs and digs. First to find the buried chest wins it; finds along the way score points. | Dog digging |
| **Tide Race** | Live, one low tide | Collect the most valuable finds from the rock pools before the tide comes back in. | Tidal farming |
| **Stargazer's Night** | Live, one game night | During a meteor shower, race to the craters to collect meteorites and rare night fish. | Meteor shower, night fishing |
| **Wildlife Survey** | Sealed list, one game day | Spot and record as many creatures as you can from the living ecosystem; rare ones are worth more. | Living ecosystem |
| **Sprinkler Puzzle** | Sealed, async daily puzzle | A fixed field of crops: water them all with the fewest sprinklers and pipes. Everyone gets the same puzzle; fewest pieces, then fastest, wins. | Sprinklers |
| **Heirloom Breeding League** | Open, one month | A target crop trait is announced (colour, size, season). Cross heirloom seeds to get as close as possible. | Heirloom seeds |
| **Blind Build** | Live, 20 minutes | A theme is revealed at the start ("harvest festival", "haunted farm"). Build on an identical empty plot with the same item kit; players vote. | Building and decorations |
| **Skill Decathlon** | Sealed, one session | Ten short trials: two each of farming, fishing, mining and foraging, plus two carnival games. Points across all ten. | Skills |

### New ways to run tournaments

- **Skill divisions.** Each type has a rating that goes up and down with results, and players enter
  their own division (Sprout, Grower, Master). New players don't pay to lose to veterans, and paid
  entry feels fair.
- **Team tournaments.** Teams of 2–4: a **Relay Farm** (one tills, one plants, one waters, one ships on
  a shared sealed plot), team Fishing Derby, team Treasure Hunt.
- **Valley vs Valley.** A free weekly event: each valley pools community donations toward a giant
  project; the fastest valley wins and everyone in it gets a reward. Gives valley neighbours a reason
  to work together.
- **Qualifiers and finals.** Async Bronze and Silver heats all week; the top 16 meet in a live Sunday
  final that everyone can watch.
- **Villager-sponsored cups.** Villagers host themed events with their own prizes ("Mira's Seed Cup":
  rare seeds; the blacksmith's Mine Dash: a unique tool skin). Adds story and variety without new systems.
- **Spectating.** Watch live finals from the stands in the Tournament Hall, with a live scoreboard.
  Spectators can cheer with emotes. **No betting on results**: that would be gambling with gold.

### Open World life between tournaments

- **Player market stalls.** Rent a stall in the village and sell your goods to other players at your own
  price. A real player economy, with a small stall fee as another gold sink.
- **Request board.** Players post requests ("20 wood, 300g") that other players fill. Helps newcomers
  earn their first entry fees.
- **Valley world events.** Everyone in a valley works together: a giant slime in the mine, a ghost
  market that only opens if enough lanterns are lit, a meteor that needs many players to dig out.
  Rewards for everyone who helped.
- **Guilds.** Join up with friends under a banner: guild chat, a guild noticeboard, and team entry to
  tournaments.
- **Champions' plaza.** Each month's winners get a **statue of their character** in the village square,
  drawn with the character renderer (outfit and all).
- **Farm tours.** Visit other players' claims, leave a ❤️, and see the most-loved farms of the week.
- **Mentors.** Experienced players earn a badge and small rewards for helping new players reach their
  first harvest.
- **Weekly world modifiers.** One twist per week across the Open World: "Bumper week" (extra harvest),
  "Drought" (crops need water twice), "Fish frenzy". Keeps the world fresh and changes which
  tournaments suit you.

## 16. Mine Dash in detail

### 16.1 What the mine has today, and what Mine Dash adds

| Today | Mine Dash adds |
| --- | --- |
| 30 floors of 30 × 22 tiles; the ladder hides under a rock; an elevator every 5 floors. | Floors grouped into **6 zones** with their own look, hazard and enemies, plus **the Abyss** (floor 31 onwards, no bottom) so the best players never tie at 30. |
| 4 enemies (slime, bat, rock crab, ghost) that all chase when you're close and wander otherwise. | **8 new enemies, each with its own trick** to learn (§16.4), and **elite** versions. |
| Bosses on 10, 20 and 30 that walk at you. | **Mini-bosses** on 5, 15 and 25, and **boss phases**: each boss changes its attack at half health. |
| Every floor works the same way: find the ladder. | **Floor types**: monster den, treasure vault, cave-in, darkness and more (§16.5). |
| — | **Camps** every 5 floors to heal, upgrade and decide whether to cash out (§16.6). |

The new zones, enemies and floor types can also go into the normal mine for everyone. Mine Dash is
the reason to build them, but single player and co-op benefit as well.

### 16.2 The run in one minute

1. In the Tournament Hall, pay the entry fee and **pick a kit** (§16.7). Everyone chooses from the same three.
2. A 3-second countdown, then you drop onto floor 1 with **15 minutes on the clock**.
3. Fight and mine your way down, level by level. Ore you mine is **run money** to spend at camps.
4. Every 5 floors there's a camp: heal, buy upgrades, or **bank your score** and leave.
5. The run ends when time runs out, you faint, or you bank. A results screen shows your score
   breakdown and live rank.

Everyone plays **the same mine**: the tournament seed fixes every floor layout, ladder spot, enemy,
chest and drop. Luck is the same for all, so the best player wins.

### 16.3 Zones: level by level

| Floors | Zone | Look and hazard | Enemies | Boss |
| --- | --- | --- | --- | --- |
| 1–5 | **Earth Tunnels** | Brown rock, good light. Learn the controls. | Slime, Spitter Slime | Mini-boss on 5: **Slime Matron** (splits into slimes) |
| 6–10 | **Bat Caverns** | Darker; the lantern circle shrinks. | Slime, Bat, Burrower | **King Slime** on 10 |
| 11–15 | **Crystal Grotto** | Glowing crystals light patches of floor; lots of gems. | Rock Crab, Crystal Beetle, Bat | Mini-boss on 15: **Crystal Queen** |
| 16–20 | **Flooded Depths** | Pools of water block paths; bridges of planks. | Cave Eel, Rock Crab, Fuse Cap | **Stone Golem** on 20 |
| 21–25 | **Haunted Halls** | Very dark; ghosts drift through walls. | Ghost, Lantern Thief, Mimic | Mini-boss on 25: **Lantern Wraith** |
| 26–30 | **Molten Core** | Lava cracks that hurt to stand on; warm red light. | Magma Imp, Crab, Ghost, Fuse Cap | **The Shade** on 30 |
| 31+ | **The Abyss** | Mixed zones in random order, getting harder every floor. | Everything, more elites | A random boss every 5 floors |

Difficulty climbs smoothly: each floor adds health and damage to enemies (as the current formulas
already do), and the Abyss keeps adding 5% per floor with no cap.

### 16.4 New enemies

Each one has a clear warning sign before it attacks (a sound, a flash or a wind-up), so it's about
skill, not surprise.

| Enemy | Zones | Trick | How to beat it |
| --- | --- | --- | --- |
| **Spitter Slime** | 1–2 | Keeps its distance and spits goo that slows you for 2 seconds. | Close in fast; it can't spit at point-blank. |
| **Burrower** (mole) | 2 | Digs under the floor (a moving dirt mound) and pops up next to you. | Watch the mound, then hit it as it surfaces. |
| **Crystal Beetle** | 3 | Hard shell at the front blocks hits. | Hit it from the side or back. |
| **Cave Eel** | 4 | Hides in pools and lunges at anyone on the edge. | Keep away from the edge, or hit it during the lunge. |
| **Fuse Cap** (mushroom) | 4, 6 | Explodes 2 seconds after it's hit, damaging everything nearby, rocks included. | Hit it and step away, or use it to blow open a wall of rocks. |
| **Lantern Thief** | 5 | Steals your light: the screen goes nearly black until you catch it. | Follow its giggle; it's slow while carrying the light. |
| **Mimic** | 5 | Looks exactly like a treasure chest and bites when opened. | It breathes: the lid twitches. Drops extra loot. |
| **Magma Imp** | 6 | Throws fireballs that leave burning tiles for a few seconds. | Dodge sideways and close in between throws. |

**Elites** (all zones, rarer near the top): a golden-glowing version of any enemy with double health.
Worth bonus points, and it always drops run money.

**Boss phases** (Mine Dash version):

- **Slime Matron (5):** splits into four slimes at half health.
- **King Slime (10):** at half health it jumps and lands with a shockwave (jump away when its shadow grows).
- **Crystal Queen (15):** surrounded by crystals that shield her; break the crystals first.
- **Stone Golem (20):** throws boulders; at half health it curls into armour and only its glowing back takes damage.
- **Lantern Wraith (25):** puts out the light every 10 seconds; it can be found by its glowing eyes.
- **The Shade (30):** teleports between shadows, and at half health summons ghosts.

### 16.5 Floor types

Most floors are normal (find the ladder). From zone 2 onwards, some floors are special, and the zone
signboard shows which kind you're on:

| Floor type | How it works |
| --- | --- |
| **Normal** | The ladder is under one of the rocks. |
| **Monster Den** | The ladder appears once every enemy on the floor is defeated. |
| **Treasure Vault** | A locked chest; one enemy carries the key. Optional: skip it to save time. |
| **Cave-in** | The roof is collapsing: find the ladder within 45 seconds or take heavy damage. |
| **Dark Floor** | No crystal light at all, just your lantern. |
| **Ore Vein** | Twice the ore and no enemies: a breather to earn run money. |
| **Shortcut** | A hidden crack in a wall leads two floors down. Finding it is pure map-reading skill. |

### 16.6 Camps (every 5 floors)

A safe floor with a campfire and a dwarf trader. Ore mined during the run is your run money here:

- **Heal:** a hot meal (+50 health), or a full heal.
- **Upgrades for this run only:** sharper sword, faster pickaxe, bigger lantern, extra armour, a ring.
- **Bank and leave:** end the run now and keep your full score. Going deeper risks fainting.

That last choice is the heart of Mine Dash: **push on for more points, or cash out safely?**

### 16.7 Kits (pick one at the start)

Everyone chooses from the same three, so there's strategy without anyone starting ahead:

| Kit | Starts with | Good for |
| --- | --- | --- |
| **Brawler** | Iron sword, leather armour, 2 meals | Fighting through Monster Dens and bosses quickly. |
| **Prospector** | Gold pickaxe (breaks rocks in 1–2 hits), extra lantern oil, 1 meal | Finding ladders fast and earning lots of run money. |
| **Scout** | Basic sword, Swift buff (faster movement), a map scroll that shows the ladder on 3 floors | Speed runs and shortcuts. |

### 16.8 Scoring

| Points for | Points |
| --- | --- |
| Each new floor reached | 100 (200 in the Abyss) |
| Mini-boss / boss defeated | 250 / 500 (1,000 for The Shade) |
| Elite defeated | 50 |
| Ore and gems carried out | Their value ÷ 10 |
| Treasure vault opened | 100 |
| Floor cleared without taking damage | 25 |
| Time left when you bank | 1 per second |

- **Faint:** your run ends, you keep your depth and boss points, and lose half your ore and gem points.
- **Time runs out:** you keep everything except the time bonus.
- **Tie-breaker:** the earlier finish time.

### 16.9 On screen during a run

- Timer, floor number, score and health, all big and clear.
- The current leader's depth ("Leader: floor 22") and your live rank among entrants who started.
- Optional **ghost**: a see-through miner replaying your own best run, to race against.
- The results screen: score breakdown, rank, and the floor where you lost the most time.

### 16.10 Mine Dash variants

| Variant | Length | Rules | Tier |
| --- | --- | --- | --- |
| **Mine Dash Sprint** | 5 min | Floors 1–10 only; King Slime as the finale. | Bronze |
| **Mine Dash** | 15 min | The full run above. | Silver, Gold |
| **Deep Dive** | 25 min | Starts at floor 11 after a short warm-up; the Abyss is the goal. | Gold, Champion |
| **Boss Rush** | 10 min | Only boss floors, back to back; fastest total kill time. | Silver |
| **Duo Dash** | 15 min | Teams of two in the same mine; shared score. | Team events |
| **Hardcore** | 20 min | No healing at camps; faint and you lose everything. | Special weekends |

### 16.11 Keeping it fair

- **Same seed for everyone.** Every floor layout, ladder, enemy and chest comes from the tournament seed.
  Drops are tied to the rock or enemy itself (rock #12 on floor 7 always drops the same thing), not to
  the order you break things, so luck is identical no matter how you play.
- **The server builds each floor** and tracks rocks, ladders, enemies, health and loot; it checks
  every hit against weapon power, swing speed and distance.
- **Run recording:** every run's inputs are saved. The top runs of each Gold and Champion tournament
  are replayed and checked before prizes are paid.
- **Practice mode:** free, on a different seed each day. Tournament seeds are never revealed early.

Today, the mine runs in the player's browser, and the server would only see the results. Checking
every hit on the server for one-player runs is affordable (a sealed run is a small room), but it's
the biggest piece of work in Mine Dash. It could ship in two steps: first with replays checked for
the top runs, then with full server checking.

### 16.12 Rewards special to Mine Dash

- Monthly titles: **Deep Diver** (deepest Abyss floor), **Boss Breaker** (fastest boss kills).
- Cosmetics: a **miner's helmet with a lamp**, glowing pickaxe skins, and a crystal trophy for the cottage.
- The deepest run of the month gets its miner shown at the mine entrance in the Open World.

### 16.13 Building it (when Mine Dash is chosen)

1. **Zones and floor types** in the normal mine (new look per zone, special floors, camps).
2. **New enemies and boss phases**, one zone at a time, each with its warning sign.
3. **Seeded runs**: everything comes from a seed, with drops tied to each rock and enemy.
4. **Mine Dash mode**: kits, 15-minute timer, camps with run money and banking, scoring, HUD,
   results screen; free practice first.
5. **Tournament hookup**: entry and prizes through the tournament service, run recordings, ghost replays.
6. **Server checking** of hits and drops for sealed runs; the Abyss; the variants.

### 16.14 Mine Dash questions to decide

1. Add the new zones, enemies and floor types to the normal mine too, or keep them for Mine Dash only?
2. Run length: 15 minutes for the main event?
3. Kits: are Brawler, Prospector and Scout the right three?
4. Camps and banking (cash out or push on): in, or simpler "just go as deep as you can"?
5. Which new enemies first? (Suggested: Spitter Slime, Burrower, Crystal Beetle, Fuse Cap.)
