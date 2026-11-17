# Harvest Valley

A browser-based, top-down 2D sandbox adventure: farming, exploration, gathering, crafting and building.
**Current state: Phase 5 + two big content updates** — co-op multiplayer over Socket.IO (shared worlds the server is in charge of, synced movement, chat, trading, co-op farming, host migration), accounts, profiles and cloud saves in PostgreSQL, and a game with days and seasons, weather, building, a village market of five merchants with schedules, festivals, heart events and mail, a 30-floor mine with combat, 11 crops, a greenhouse and artisan machines, a barn with cows and sheep, a beach, a cottage you furnish, community projects, a collection with achievements, settings for keys, UI size, day length, gamepads and touch screens — and now a story, villager requests and first-day tips, a shipping bin with a morning report, food buffs, a fishing minigame and crab pots, mine bosses and treasure, rings and armour, an old forest with a hermit, pets, romance and marriage, silos, wells, sheds, ducks and rabbits, decorations and automation, a cottage that comes furnished (with displays for your best fish, food and gems), public co-op games, friends, cabins, a shared wallet, and emotes.

## A living ecosystem

- **Deer graze unprotected crops** (`shared/src/game-config/ecosystem.ts`, `systems/EcosystemSystem.ts`): some nights
  (about 30%, spring to fall, from day 5) a deer wanders in from the wild edges of the valley and eats 1–3 crops
  it can reach, ripe ones first. A plant that keeps producing only loses its current harvest. In the morning
  there are hoofprints by the eaten plots, and the deer bounds off as you wake.
- **Foxes at dawn:** some mornings (about 25%, from day 4) a fox creeps up to the coop and spooks up to two
  chickens, ducks or farm rabbits, which lay nothing that morning. Nothing is ever hurt or lost for good.
- **Keeping wildlife out:** a crop or coop is safe if it can't be reached from the edge of the map — a closed
  **fence** ring (water and buildings count as walls; paths don't). A **scarecrow** keeps deer off every crop
  within 4 tiles, and a **dog** barks foxes away.
- **Pollinators:** crops within 3 tiles of a **flower bed** (2 of a flower pot) are pollinated outside winter:
  +8% chance of gold and +10% of silver at harvest. Bees hover over flower beds on dry days, and the crop's info
  says "🐝 pollinated".
- Wildlife raids happen on solo farms (the co-op farm belongs to the server); pollination works everywhere.
  Everything is worked out from the world seed and the day, so nothing new is saved.

## Heirloom seeds

- **Eleven heirloom varieties** (`HEIRLOOMS` in `shared/src/game-config/crops.ts`, rules and parcel codes in
  `heirloom.ts`): a rare-coloured cousin of every crop (Moonlight Turnip, Ghost Pumpkin, Black Tomato, Glass Gem
  Corn…). Each grows exactly like its everyday crop but sells for 1.6×. Art is the base crop recoloured
  (`assets/recolor.ts`); seed packets carry a gold star.
- **Every world grows two natively** (fixed by its seed). The Valley Seed Library posts 5 seeds of each on day 2,
  and every heirloom harvest has a 35% chance to give a seed back.
- **Sharing:** in co-op, trade seeds like any item. Between worlds, the mailbox's **🌱 Seed exchange** tab packs
  5 or 10 heirloom seeds into a code (`HV-XXXXXXX-XXXXXXX-XXXXXXX`) for a friend to open in their own mailbox.
  Packing uses up the seeds; a checksum rejects typos and made-up codes; each parcel opens once per world, and
  never in the world that packed it.
- New achievement **Seed Keeper** (grow 4 heirloom kinds); Green Thumb still counts only the 11 everyday crops.
  Saved per player in `SocialSave.heirloom`.

## The ghost night market

- **Once Elsie is at rest** (`shared/src/game-config/nightMarket.ts`, `systems/NightMarketSystem.ts`,
  `components/panels/NightMarketPanel.tsx`): the next day a note in faded ink arrives, and from then on three
  spirits keep a market **inside the graveyard from 10pm until the day ends**. They glow, carry their own
  lanterns (lit by the night lighting), and — being ghosts — don't block your way. Press E facing one.
- 🕯 **Old Wick, the Lamplighter**, buys strange things for more than any stall pays: ectoplasm, bat wings,
  slime, coal, charcoal, fossils, rainbow shells, meteorites, golden spikes and glacierfish.
- 🦋 **Madame Moth** only swaps curiosities for curiosities: Wisp Tea (2 ectoplasm), a Moon Bloom (4 bat wings
  + 2 ectoplasm) or the Phantom Ring (a meteorite + 6 ectoplasm).
- ⛵ **The Ferryman** takes a coin, as ferrymen do: three rare goods a night, one of each, different every
  night (the same for everyone in a world).
- **Only from the market:** ☕ **Wisp Tea** (+60 energy, Swift for 4 hours), 🌙 **Moon Bloom** (every villager
  loves one) and 💍 **Phantom Ring** (+2 damage, 15% less damage taken).
- Saved per player in `SocialSave.nightMarket`. New Guide step: trade at the ghost night market.

## Tidal farming on the beach

- **Tide beds** (`shared/src/game-config/tidal.ts`, `BeachScene` bed actions, art `drawTideBed` in `assets/beach.ts`):
  six beds — two stakes and a rope line each — in the strip of beach the sea covers twice a day. They sit just
  under the sea's layer, so the tide hides them as it comes in and they reappear as it goes out.
- **Only at low tide:** the beds are out of the water about **6:40–11am and 6:40–11pm** (tide level ≥ 0.7). The
  beach label says "tide beds open", or when they next will be. At high tide a bed can't be worked — and you
  can still cast your line over it.
- **What grows:** 🦪 **oysters** (spat 60g at Finn's) are ready after 5 days of care and give 2–3 oysters (80g,
  Finn pays 95g) with a 10% chance of a pearl; the bed is empty again afterwards. 🌿 **Seaweed** (spores 25g) is
  ready after 3 days, gives 4–6 seaweed, and grows back after 2 more days of care.
- **The routine:** planting counts as the first day's care; after that a bed grows one stage for each day you
  tend it at low tide (2 energy, a little fishing XP). Skip a day and it simply waits. A hoe clears a bed.
- Oysters can now turn up in Port Wren's freight orders. Saved per player in `SocialSave.tidal`.

## Train contracts at the freight depot

- **The depot** (`systems/TrainSystem.ts` timetable, `state/Freight.ts`, rules in `shared/src/game-config/freight.ts`,
  art in `assets/valley.ts`): a roofed order board with crates and a loading platform, right beside the railway
  where it passes closest to the cottage (🚉 on the map and minimap). It's picked after every older landmark, so
  nothing in an existing world moves.
- **Three towns down the line** post orders from day 2 (up to three open at once, topped up each morning):
  🌾 **Millbrook** (crops, eggs, milk, cheese, preserves), ⚓ **Port Wren** (fish, crab, shrimp, seaweed) and
  ⛏ **Ironhollow** (wood, stone, fiber, hardwood, ores, coal). Orders only ask for what you can get: crops in
  season with enough days left to grow, trout and icefish only in their seasons, and anything else only once
  you've held it (wood, stone and fiber always). Deadlines stay inside the season. Order sizes grow with your
  lifetime earnings.
- **Loading:** press E at the board and load what you carry, over as many trips as you like (plainest quality
  first). Silver and gold goods add to the pay. Loaded goods can't be taken back; while they wait, sacks and a
  crate sit on the platform.
- **The train does the rest:** the next scheduled train after an order is full collects it, and the payment comes
  back on the first train of a later day — about 1.6× the shipping price, plus 2% per order already delivered to
  that town (up to +20%), with a thank-you letter. If an order misses its date, whatever you loaded still goes out
  and is paid at shipping prices; an empty one simply lapses. Contracts follow the timetable, not the train on
  screen, so they work while you're indoors, in the mine or asleep.
- Saved per player in `SocialSave.freight` (each co-op player has their own orders) and checked by the save
  validator. New Guide step: deliver a train contract.

## Daily goals and streaks

- Every morning you get **three small goals** (`shared/src/game-config/daily.ts`, `frontend/game-engine/state/daily.ts`),
  picked from a pool that fits where you are in the game: gather wood, stone or fiber, forage wild things, chat
  with villagers (each counts once), from day 2 give a gift, ship goods, cook a dish, and, once you have them,
  harvest or water crops (only if something's growing, and no watering on rainy days), catch fish (with a rod)
  and reach a mine floor a little past your best. The same seed and day always give the same goals.
- Each goal pays gold when done (+10% per streak day, up to +50%). Finishing all three pays a **+100g bonus**
  and extends your **streak**. Missing a day resets it. Streak milestones: 3 days Lucky for the day + 300g,
  7 days 2 iron sprinklers + 500g, 14 days a gold sprinkler + 1000g, 30 days a golden spike + 3000g.
- Progress comes from the game itself: harvests (farm, island and fruit trees), watering a crop, landing a fish
  (not junk), talking, gifts, shipping (by value), cooking, mine floors, and picking up wood, stone, fiber and
  forage.
- The **Today** card under the clock shows the goals with progress bars, rewards and your streak 🔥. Click it to
  fold it away. It's saved per player (`SocialSave.daily`), and the Guide gained two steps: finish all three
  goals once, and keep a 3-day streak.

## Crop quality and fruit trees

- **Quality** (`shared/src/game-config/orchard.ts`): crops and fruit come in normal, **silver** (☆, sells and
  feeds ×1.25) and **gold** (★, ×1.5). Each harvest rolls once for the whole pick: better with farming level
  (+2.5% gold and +3% silver per level), **fertilizer** on that crop (+20% gold, +15% silver; the crop shows
  "fertilized"), and the Lucky buff. Island crops roll too.
- Stacks carry an optional `q` (1 or 2) through the inventory, chests, the shipping bin, drops and items on the
  ground, and saves. Only equal qualities stack; recipes, gifts and requests use plain ones first. Prices in the
  shop, shipping bin, morning report and tooltips reflect quality. Slots show a small silver or gold star. In
  co-op, shared chests store plain quality for now.
- **Fruit trees** (`systems/OrchardSystem.ts`, art in `assets/orchard.ts`): Mira sells cherry (500g, fruits in
  spring), peach (750g, summer) and apple (600g, fall) saplings. Plant one on open grass with no other fruit tree
  next to it and nothing solid beside it. It needs no watering: sapling → young → small tree → grown over 10
  days (one season). Once grown, in its own season it blossoms, then grows one fruit each morning up to three;
  out of season the fruit drops off. In winter it's bare. Press E to shake the fruit down. Older trees give better
  fruit (+4% gold per season after it's grown, up to +20%). An axe takes a tree down: a sapling comes back up
  whole, a grown tree takes 4 hits and gives 8 wood. Trees are saved (`SaveData.orchard`), show on the maps, and
  can't be planted in co-op worlds yet.
- Two new Guide steps: plant a fruit tree, and harvest a gold-quality crop.

## Minimap

- A small map under the top-left panel (`components/Minimap.tsx`) that follows you around the valley: the
  terrain, trees, rocks, your farm and buildings, the railway and graveyard, with landmark icons (cottage, market,
  mine, forest, beach, carnival, museum, graveyard, villagers' homes), dots for villagers, your pets and horse,
  co-op friends and the train, a pulsing diamond for your map marker (pinned to the edge when it's off-screen) and
  an arrow for you pointing the way you face. Click it to open the full map.
- The engine sends its picture (`minimap:base`, redrawn every 20 seconds and on returning from an area) and
  positions (`minimap:state`, ~7 times a second). It hides in side areas (forest, beach, mine…).
- **N** (rebindable) or Settings → Minimap shows or hides it; the choice is saved in this browser.

## The valley train and the graveyard ghost

- **The railway** (`systems/TrainSystem.ts`, art in `assets/valley.ts`): one straight track across the whole
  valley, on a row picked from the map south of the main path (no path, landmark or building on it; least
  water, which it crosses on wooden trestles). Rows either side are kept clear of trees and can't be built on.
  It's on the world map (🚂 Railway).
- **The train** comes by 3–4 times a day (seeded per day from 7:30am to 8:30pm; trains you sleep through don't
  come). A green steam engine with 3–5 wagons (coal, box, tank, a red caboose) whistles as it sets off, puffs
  steam, rumbles past (`whistle` and `chug` in `audio/sounds.ts`), and nudges you off the rails if you're
  standing on them. Just over half the trains drop cargo by the tracks: **coal**, copper or iron ore, wood, gold
  ore or, very rarely, a **golden spike** (Bram loves both). It runs while you're in other areas too.
- **The graveyard** (a lot picked after the villagers' homes and the museum, so they don't move): a wrought-iron
  fence with a gate and two lamps, six headstones you can read, and a twisted old tree (🪦 on the map).
- **Elsie the ghost** (`systems/GhostSystem.ts`): from 10pm until the day ends she floats over her grave and
  glows. Talk to her and she asks for her three lost belongings one by one: a **silver locket** by the river near
  the bridge, **reading glasses** near the mine entrance, and a **music box** in the far northern woods. Each glints
  where it lies (day or night) and she sets the map trail to it. Rewards: 300g, then 500g and 3 ectoplasm, then
  1000g and the **Spirit Ring** (always Lucky, 10% less damage), after which she drifts up into the sky and rests.
  Progress is saved in `SocialSave.ghost`.
- The Guide has two new steps: watch the train go by, and help the ghost rest.

## Storms, wildlife, sky events, birthdays and the guide

- **Thunderstorms** (`isStormDay` in `shared/src/game-config/events.ts`, drawn by `systems/SkyEventsSystem.ts`):
  about 45% of rainy days outside winter are storms. Lightning flashes light up the farm with a rolling
  synthesised thunderclap (`thunder` in `audio/sounds.ts`), and now and then a bolt hits a tree in view and
  leaves **charcoal** at its foot.
- **Rainbows:** the dry morning after a storm (6am–noon) a rainbow arcs over the farm; seeing it makes you
  **Lucky** for 8 hours (once a day).
- **Meteor shower:** summer, day 7, from 9pm — shooting stars streak across the night sky, and the next morning
  three **meteorites** lie in small craters around the farm.
- **Ice fishing:** in winter, fishing a pond or the river cuts a hole in the ice ("Ice fishing"). Icefish and the
  rare **glacierfish** only bite then. Both, plus meteorites and charcoal, are new museum pieces.
- **Wildlife** (`AmbientLifeSystem`, `ForestScene`): red squirrels scamper around the oaks on dry days (they shoot
  up the trunk when you come close), frogs hop and croak by the water when it rains (and plop in if you get
  near), and two or three deer graze in the old forest during the day — they bound off if you approach.
- **Villager birthdays** (`BIRTHDAYS`): Mira spring 4, Finn summer 2, Tobin summer 5, Rosa fall 3, Willa fall 10,
  Bram winter 6. You're told in the morning; gifts that day count double and get a birthday thank-you.
- **Calendar** (L, rebindable, or Pause menu → Calendar): each season's days with birthdays, festivals and the
  meteor shower, today highlighted and what's coming up.
- **Guide** (Journal → Guide, Q): a 22-step checklist that points you to every place and activity — adopt a pet,
  the forest, beach, carnival and mine, the museum (first donation, 10 items, a full collection), a villager's
  home, the boat, the island, the cave and its chest, a horse, skill level 5, a rare creature, a birthday present,
  a rainbow, the meteor shower and ice fishing — ticking them off as you go (`SocialSave.milestones`).
- **Pets stay put across reloads:** if you told your pets to stay (P), where they're waiting is saved
  (`SocialSave.petStay`).
- **Gamepad in menus** (`components/GamepadMenuNav.tsx`): D-pad or left stick moves a highlight between buttons,
  A presses, LB/RB switch tabs, B/Start close.

## Skills, a horse, and pet tricks

- **Skills** (`shared/src/game-config/skills.ts`, tracked by `frontend/game-engine/state/skills.ts`): Farming,
  Fishing, Mining and Foraging, each levels 0–10 (60 XP for level 1 … 3600 XP for level 10). You earn XP by
  harvesting (farm and island crops), catching fish (harder fish teach more), breaking rocks and ore (farm,
  mine, island cave), and chopping trees and stumps, picking berries and wild finds. Perks:
  - a 3%-per-level chance of an extra crop, ore, stone, wood or find (plus 10% at level 10); fishing instead
    makes the catch bar 4% bigger per level;
  - from level 5 the skill's tool costs 1 less energy (2 at level 10; watering is free at Farming 10).
  Level-ups show a toast. Progress, perks and XP bars are in **Collection → Skills**. Saved in
  `SocialSave.skills`.
- **A horse** (`systems/HorseSystem.ts`, art in `assets/horse.ts`): Mira sells one (2500g, after 1000g lifetime
  earnings). Use it on open ground to let it out — it gets a name. Press **H** (rebindable) next to it to ride,
  and again to get off; from further away, H whistles and it trots over (from off-screen if it's far). Riding
  is 1.9× faster. You get off automatically to use a tool (Space), go through a door or gate, or sleep. The horse
  stays where you left it (saved in `SocialSave.horse`) and shows as 🐴 on the map. E on the horse also rides.
- **Pet tricks** (`PetSystem`): hold **wood** and press E on your dog to throw a stick — it runs for it and brings
  it back (+love, up to three times a day; cats are not impressed). Pet your pet, then press E again to play: a
  spin, a roll-over or a high-five. **Dogs dig:** once a day (twice at 100+ love, from 20 love) your dog stops on
  open grass and digs, turning up old coins, arrowheads, clay pots, ore, an amethyst, forage, or a pouch of gold.
  P still makes it stay.
- **Two pets:** you can keep a cat *and* a dog (`SocialSave.pet` and `pet2`). A day or so after you adopt the
  first, Tobin writes that the other stray is back; it waits by the door until you adopt it. Both follow you —
  the cat on your left, the dog on your right; the two are drawn as different animals (a slim tabby cat with
  pointed ears and a curling tail, a stocky dog with floppy ears, a snout and a red collar) — each with its own love, daily pat and morning gifts. P tells
  both to stay. Saves that already have one pet get the second stray on their next load.

## The island, villagers' homes and the museum

- **Villagers' homes** (`scenes/VillagerHomeScene.ts`, houses drawn by `drawVillagerHouse` in `assets/places.ts`):
  each villager has their own house near the path, each with its own look (Mira's seedlings, Rosa's pink bakery
  cottage, Bram's stone house with a forge chimney, Finn's blue boards with nets, Willa's log house and woodpile,
  Tobin's brick cottage). The spots are picked from the map alone (`WorldScene.lots()`, the same for everyone in a
  world) and are kept clear of building (`BuildSystem.reserved`). Merchants now walk **from their front door** to
  their stall and back (`NpcSystem` commute), and their windows glow while they're home in the evening.
  Knock on the door (E): out at work → "nobody home"; after 10pm → asleep; under **2 hearts** they say "maybe
  another time"; at 2+ hearts you're invited in. Inside: their own furniture and things, a chat (counts as the day's
  talk, with home-only lines), gifts, and at **4+ hearts** a daily treat (Rosa's bread, Bram's ore, Finn's bait…).
  Config: `HOME_LIFE`, `HOME_VISIT_HEARTS`, `HOME_TREAT_HEARTS` in `shared/src/game-config/places.ts`.
- **The museum** (`scenes/MuseumScene.ts`, `drawMuseum`): a columned building a walk from the cottage
  (🏛 on the map). The hall has a roped-off dinosaur skeleton (the "Valley Rex"), a model ship in a glass case,
  a globe, a case of curios, a map of the valley, paintings, benches and plants (E on a showpiece reads its
  plaque), and it's busy: 6–9 townsfolk plus two or three villagers stroll between the exhibits, comment on
  them, chat when you talk to them and cheer when you donate. Inside are 30 pedestals in four collections — *Waters of the Valley* (11 fish), *Treasures of
  the Shore* (6), *Stones & Gems* (7) and *Lost Things* (6 artifacts). Face an empty pedestal with the item to
  donate it, or ask Professor Hoot (an owl curator) to put everything new on display at once. Each finished
  collection pays gold and mails a gift; filling every display pays 5000g (`MUSEUM_SETS`).
- **Artifacts** (new `artifact` category): old coins and arrowheads turn up when you dig soil with the hoe,
  clay pots (floors 1–14) and fossils (15+) in mine rock, stone tablets and the golden idol in the island cave.
- **The island** (`scenes/IslandScene.ts`): the rowing boat by the pier has a hole in it — repair it once
  (40 wood, 8 hardwood, 20 fiber, `BOAT_REPAIR`) and press E beside it to row over. The island has a dock,
  palms that drop coconuts each day, an empty hut whose **parrot** trades seeds for coconuts (3 → a pineapple
  seed, 2 → three taro tubers), an 8-plot garden where **pineapple** (6 days, 300g) and **taro** (3 days) grow in
  any season without watering, tiki torches, reef fishing (parrotfish, lionfish at night, the rare swordfish,
  tuna), and a **sea turtle** some mornings (logged under Wildlife).
- **The island cave** (`scenes/IslandCaveScene.ts`): break the cracked boulder by the cliff with a copper
  pickaxe or better. Inside: glowing crystals, crystal rocks with rubies and jade (they grow back daily; rare
  stone tablets), a giant clam that sometimes holds a pearl, and an ancient chest (golden idol, rubies, a pearl
  and 1000g, once).
- **Saving:** `SocialSave.island` (boat, cave, chest, garden, today's finds), `SocialSave.museum` and
  `SocialSave.homeTreat`, all checked by `validateSave`. Side areas can hand you straight to another
  (beach ↔ island ↔ cave) with `WorldScene.switchArea`.
- **Letters:** Professor Hoot announces the museum on day 2; Finn tells you about the boat on day 4.

## The carnival

Out along the main path, a good walk from the village, stands a striped arch with lamp posts, bunting, balloons, a treat cart and a
"Games · Rides" billboard (🎡 on the map; CARNIVAL arrow signs by the path near your cottage point the way).
`WorldScene.carnivalGate()` picks the spot from the map alone (~30 tiles from the cottage, clear of the
village and bridges), so everyone in a world sees it in the same place. Walk south through the arch (or press E
facing it) to go straight into
`CarnivalScene`, a side area with a Ferris wheel and a carousel that turn, five game tents, the Wheel of
Fortune, a treat cart, and Pip the barker at the ticket booth.

- **Tokens** (25g each, ticket booth) pay for games and rides; games pay out **prize tickets**, traded at the
  prize booth for cotton candy, candy apples, tokens, a balloon bunch, a plush bear, a golden carp, or the
  **Carnival Trophy** (75 tickets). Balloons, the bear and the trophy are furniture for the cottage.
- **Games** (React, `components/panels/CarnivalPanel.tsx`): Ring Toss (timing, 3 throws), Whack-a-Slime
  (20 s, click or keys 1–9), Duck Shoot (10 corks), High Striker (stop the meter at the top), Memory Cards
  (8 pairs in 45 s). The world scene takes the tokens before a game opens and pays tickets for the score it
  reports, once per paid play (`carnival:result`, scoring in `shared/src/game-config/carnival.ts`).
- **Wheel of Fortune**: one free spin a day (`SocialSave.carnivalSpin`). **Rides** cost a token: the Ferris
  wheel restores energy, the carousel gives the Swift buff.
- **People** (`scenes/carnival/CarnivalPeople.ts`, looks and lines in `CARNIVAL_STAFF`): Pip (tokens), Dot
  (prizes), Gus (treats), Madame Zara (a free daily fortune with a buff), Jojo the juggler (tip 10g once a
  day for luck), and a host behind every game counter. They turn to face you and call out in speech bubbles.
  6–9 visitors wander between the attractions (some with balloons), share tips when you chat, and cheer when
  you win big; in the evening two villagers visit too, and chatting with them counts as your daily talk.
- **Every day** (`SocialSave.carnival`): the carnival card (play all five games for 15 bonus tickets, board by
  the arch), a daily challenge (`dailyChallenge(day)`), best scores per game, golden hour 6–9pm (tickets ×2),
  and after dark a dusk tint with glowing lights and fireworks.

## Weather everywhere, tides and wildlife

- **Same sky in every area:** the beach, forest and carnival get today's rain or snow, and the beach and forest get
  the dusk/night darkness with lamplight (bonfire, pier lantern, the hermit's window, your lantern) —
  `AreaScene.setupAtmosphere()` (a `WeatherSystem` plus a `LightingSystem` with its own texture key). The
  carnival keeps its own moonlit dusk overlay and fireworks.
- **Tides** (`tideLevel(minute)` in `shared/src/game-config/wildlife.ts`): low around 9am/9pm, high around 3am/3pm.
  The beach ground is drawn at low tide and a separate sea image (`drawTideWater`) slides over it; the pier is its
  own layer above the water. Walking into the sea is stopped per frame (`keepOutOfSea`), fishing checks the live
  waterline, and the area label says "low tide / tide coming in / high tide / tide going out".
- **Rock pools** (five, uncovered at low tide; forage ids 40–44): one find each per day — new items
  `sea_urchin`, `sea_star`, `rainbow_shell` (rare), plus coral or a crab.
- **Rare creatures** (`WILDLIFE`): a red fox on the forest trail 6–8am (trots, sits to look at you, bolts), a barn
  owl in the forest after dark, dolphins leaping past the pier on dry days 10am–5pm, fireflies at the carnival on
  dry nights. Seeing one calls `AreaHost.spot()`; the first sighting toasts and is saved in
  `CollectionSave.sightings`, shown under Collection → **Wildlife** (and on the docs page).

## Music by place, the beach and the bridge

- **Music follows where you are** (`AudioSystem.update(..., { area })`): the seasonal score on the farm, an
  original fairground waltz at the carnival (calliope organ over oom-pah-pah, with glockenspiel runs), and a slow
  D-dorian piece in the old forest (drone, wooden flute, kalimba, with more birdsong), and in the **mine** a deep
  rumbling drone, uneasy low intervals and cold glassy notes, with echoing drips, shifting rock, skittering claws,
  whispers, growls and a far-off wail — more often the deeper you go, plus a heartbeat from floor 20
  (`caveAmbience`, `scheduleMine`; cave sounds run through a feedback-delay echo). Indoors and the beach stay
  quiet as before. Instruments are synthesised in `audio/sounds.ts` (`organ`, `tuba`, `stab`, `glock`,
  `flute`, `kalimba`, `glassTone`, and the `cave*` sounds).
- **The beach** (`BeachScene.decorate`, art in `assets/beach.ts`): palms and dune grass, two picnic spots
  (umbrella, towel, deck chair), a lifeguard tower, a sandcastle, a crackling bonfire, driftwood, rocks and
  starfish, a "The Beach" sign, bollards and a lantern on the pier, a rowing boat bobbing beside it, rolling foam,
  crabs that scuttle away from you and gulls (with shadows) overhead. The ground is painted per pixel along smooth
  curves (`shoreX`/`meadowX`): meadow or snow fading into rippled sand with footprints, wet sand darkening to the
  waterline, and a sea from turquoise shallows to deep blue with wave streaks, two rolling foam lines and sun glints. Decorations block walking
  and shells never wash up on them.
- **Bridges** have new planks (each board its own tone, with grain and nails) and railings with stone end pillars
  and four lanterns that glow at night (`assets/bridge.ts`, `WorldScene.decorateBridges`).

- **The market sits a short walk west of the cottage** (stalls at spawn −7…−19, notice board at −4, so there are
  a few tiles of open grass by your home). Older saves drop stalls/boards from their old spots on load
  (`ResourceSystem.pruneFixtures`, and the same in `CoopWorld`).
- **Edges blend with the season:** shores and path edges fade into the ground with a ragged, dithered fringe
  instead of a straight green strip, and there's a set of edge tiles per season (grass, autumn grass, snow —
  `FRINGES`/`SEASON_EDGES`, swapped in `applySeasonTint`), so winter paths and ponds have snowy edges. The side areas blend the same way (`assets/blend.ts`
  `blendTileEdges`): grass into sand and dry into wet sand on the beach, grass onto the carnival plaza, a ragged
  forest trail, and crumbling rock edges with loose stones in the mine.
- **The mine is off on its own** (~26–44 tiles from spawn, preferring the north, with room for a yard) and goes
  **underground**: stone steps lead down between timber posts with hanging lanterns into a heap of boulders
  (`drawMineEntrance`, 48×40), with a gravel yard, rails running out of the shaft, a loaded ore cart
  (`drawMineCart`), a lamp post, loose boulders and a "⛏ MINE" signpost (`WorldScene.decorateMine`). Old saves move
  to the new spot (`pruneFixtures` covers the mine too).
- **The cottage** is a bigger, more detailed log cabin (64×76 over the same 3-tile footprint, `drawCottage`):
  shingled roof with a dormer and attic window, stone chimney with drifting smoke (`WorldScene.chimneySmoke`),
  flower boxes under both windows, a lantern by the door, and a front porch with a bench, a fern, a mat and steps
  on a stone foundation. Windows and lantern glow at night.
- **Market stalls** are bigger (40×46, `drawStall`): a sign board on top naming what each sells with an icon
  (Seeds, Bakery, Smithy, Fish, Woodwork — `WorldScene.labelStalls`), a scalloped awning with pennants and a
  striped counter front.

## Homepage, docs and indoor decor

- **Harvest Valley homepage** (`/`) and **docs** (`/docs`), in the game's colours. Every sprite is drawn live by the
  same code as the game (`frontend/components/site/catalog.ts` lists them; add new art there too). Only two
  buttons: Play (→ `/start`) and Docs.
- **Indoor decor:** flower pots, flower beds, statues, gnomes, birdbaths, benches and lamp posts can be placed
  inside the cottage as well as on the farm (`furnitureOf()` in `interior.ts`).
- **Things on furniture:** tables and benches now hold two items each, like the display table and shelf — hold
  an item (food, a gem, a flower pot, a gnome…) and press Space while facing it; E takes the top one back.
- **Co-op cabins** only stand while their owner is playing.
- **Wallet sign-in (MetaMask and other Ethereum wallets)** with [RainbowKit](https://rainbowkit.com): on the
  title screen and the login/sign-up pages. The wallet signs a Sign-In with Ethereum (EIP-4361) message — no
  fee, no transaction — and the backend (`services/siweService.ts`: one-time nonce, domain and expiry checks,
  signature recovery with viem) starts the same session cookie as a password login. The first sign-in makes an
  account tied to that address (`users.wallet_address`, migration `004_wallets.sql`). Routes:
  `GET /api/auth/siwe/nonce`, `POST /api/auth/siwe/verify`. Phone wallets and QR codes need a free WalletConnect
  project id in `frontend/.env.local` (`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, see `frontend/.env.example`);
  browser extensions work without one. Smart-contract wallets (ERC-1271) aren't supported yet.

## Quick start

```bash
npm install        # from the repo root (installs all workspaces)
npm run dev        # game on http://localhost:3000, API + co-op server on :4000
```

That's all — **no database to install.** By default the backend runs an embedded PostgreSQL
([PGlite](https://pglite.dev): real PostgreSQL compiled to WebAssembly) inside its own process,
storing data in `backend/.data/pglite/`. Tables are created automatically on first start.

- **Using a PostgreSQL server instead** (Homebrew, Postgres.app, a hosted database): copy
  `backend/.env.example` to `backend/.env` and set `DATABASE_URL`. The same SQL and migrations
  run there. (`npm run db:migrate` applies migrations by hand; stop the dev server first when using
  the embedded database.)
- **Resetting** the embedded database: stop the server and delete `backend/.data/`.
- If the database can't be opened, the game still works: you play as a guest with browser saves,
  and the backend keeps retrying.
- Game only / API only: `npm run dev:frontend`, `npm run dev:backend`.
- The game reaches the API through its own origin (`/api/*` is proxied to Express; set
  `BACKEND_URL` to point elsewhere).
- Production build: `npm run build && npm start` (set `NODE_ENV=production` for the backend so the
  session cookie is HTTPS-only).
- Type-check everything: `npm run typecheck`.
- **Co-op:** the game connects to the co-op server on port 4000 of the same machine it was loaded
  from (set `NEXT_PUBLIC_COOP_URL` if it lives elsewhere). To play with someone on your network,
  they open `http://<your-computer's-IP>:3000`, create an account there, and join with your code;
  both ports (3000 and 4000) must be reachable.

### Pages

| Route | What it is |
| --- | --- |
| `/` | Homepage: the Harvest Valley logo, a living pixel diorama, **Play** and **Docs**, and every sprite in the game (villagers, animals, mine, nature by season, crops by stage, buildings, machines, decor, furniture, tiles and all items) |
| `/docs` | The Harvest Valley handbook: controls, and every role in the game — you and your trades, co-op host/guest/leader, each villager (hours, stock, gifts, favours), animals and pets, mine monsters and bosses, friendship and romance. Built from the game data, so it stays current |
| `/start` | Title screen: account, your worlds (cloud + this browser) with Export, import a save file, start a new world |
| `/play?seed=name` | The game. Each world name is its own map and its own save |
| `/play?seed=name&host=1` | Open that world to friends (co-op host) |
| `/play?join=CODE` | Join a friend's world with their code |
| `/login`, `/register` | Accounts |
| `/profile` | Display name, default character look, stats, manage/delete saved worlds |

### Controls

Every key below except Esc, Enter and the number row can be rebound in **Pause menu → Settings**
(the help text in the game follows your bindings).

| Key | Action |
| --- | --- |
| WASD / Arrow keys | Move (diagonals allowed, 4-direction facing) |
| Shift | Run |
| Space / J / left-click | Use the selected item on the tile you face (chop, mine, till, water, plant, cast a line, give a gift…) |
| E | Interact: talk, trade at a stall, read the notice board, harvest, pick berries, open chests, sit on a bench, go inside, enter the mine, walk to the beach |
| F (or right-click food in the hotbar) | Eat the selected food |
| M | World map — click anywhere on it to set a marker: a glowing trail on the ground leads you there around water and trees, with steps and direction at the top of the screen |
| 1–9, 0 / mouse wheel | Select hotbar slot |
| I or Tab | Inventory (drag stacks, or click one slot then another; drag a stack out of the window, or press Drop, to put it on the ground — Shift for just one) |
| C | Crafting |
| K | Collection & achievements |
| Q | Journal: the story and villager requests |
| T | Emotes (co-op partners see them) |
| P | Pet: stay where it is / follow you again |
| H | Horse: ride when it's next to you, get off, or whistle for it from afar |
| L | Calendar: birthdays, festivals, the meteor shower |
| N | Show / hide the minimap (also in Settings) |
| Esc | Close a menu, or open the pause menu (save, customise, new game) |
| Shift+M | Mute / unmute |
| Enter | Co-op chat (the game ignores keys while you type; Esc closes) |
| Click the floating button | Do the action shown above whatever you're facing |
| `` ` `` (backtick) | Toggle collision boxes (developer aid) |

**Gamepad** (any standard controller): left stick / D-pad move, A use, X interact, Y backpack,
B or Start menu, LB/RB hotbar, LT eat, RT run, View/Back map. In menus: D-pad/stick to move, A to press,
LB/RB to switch tabs.
**Touch screens** get an on-screen joystick and buttons (Use, Act, Eat, Bag, Map, menu, Run toggle);
pushing the stick all the way runs. Settings can force them on or off.

### How to play

You wake up outside your cottage on Spring 1 with an axe, pickaxe, hoe, watering can, 12 turnip
seeds, some berries, 100g, and a freshly tilled plot beside the cottage. The village market is next door; Tobin walks the path most days.

1. **Days** run from 6am to 2am (~8 real minutes; change it in Settings). Go inside your cottage and get into bed to start the next
   day; stay up past 2am and you pass out and wake up tired. The game saves every morning (and when
   you close the tab). Time pauses while a menu is open.
2. **Energy** — tools cost energy; eat crops, berries or eggs (select and press F) or sleep.
3. **Farm** — plant seeds on tilled soil or straight onto grass, then water. Each morning every crop watered the day before grows a stage.
   Rain waters for you. Crops have seasons (turnip: spring/fall, carrot: spring–fall, pumpkin:
   summer/fall) and wither if the season changes under them. Nothing grows in winter.
4. **Gather** — trees, rocks, copper ore, fiber, berries. Everything grows back after a few days.
5. **Build** — craft fences (auto-connecting), wood/stone paths, lamp posts and chests; select one
   and press Space to place. Pick placed things back up with the pickaxe.
6. **Trade** — five merchants keep stalls in the market (see below). Mira's seed stock changes with
   the season, and more unlocks as you earn: pumpkin seeds at 150g lifetime sales, chickens at 300g.
   Chickens lay an egg every morning.
7. **Make friends** — talk to each villager once a day and give gifts to raise hearts. Every two
   hearts with a merchant takes 5% off their prices (up to 20%).
8. **Notice board** — two delivery requests are posted every morning, for gold and friendship.
9. **Fish** — buy a rod from Finn, face water and press Space, then press again when the "!" shows.
10. **Cook** — the Cooking tab in crafting turns crops, eggs, berries and fish into better food.
11. **Customise** your character from the pause menu.
12. **Play together** — see Co-op below.
13. **The mine** (out on its own, usually north — follow ⛏ on the map) — 30 floors of ore, gems and slimes; find the ladder down,
    an elevator every 5 floors. Watch your health; faint and you're carried home minus some gold.
14. **Artisan goods** — kegs make juice, preserves jars make pickles, the cheese press and loom turn
    milk and wool into cheese and cloth. The greenhouse grows any crop in any season.
15. **Barn animals** — build a barn, buy cows and sheep from Mira, keep hay in the barn, pet them daily.
16. **Village life** — villagers walk to their stalls and home again; festivals on day 8 of every
    season; heart events at 2/4/6 hearts; letters (with gifts) arrive in your mailbox.
17. **The beach** — follow the path east to the signpost: sea fishing from the pier, shells and coral.
18. **Your cottage** — walk in the front door. Buy furniture from Willa and place it; the bed is
    inside now. A House Extension (Willa, 2500g) gives you a much bigger room.
19. **Community projects** — Notice board → Community: five big goals everyone chips in to; each
    pays every player and mails a gift.
20. **Collection** (K) — every item you've found and 18 achievements with progress bars.
21. **Saves** — Pause menu → Export save file downloads a `.json`; import it on the title screen in
    any browser. Each world name is its own save slot.
22. **The story** (Q) — nine chapters from "A new start" to "Legend of the valley"; rewards arrive by
    mail. Villagers also ask personal favours at 3, 5 and 7 hearts. First-day tips walk you through
    the basics (skippable).
23. **Shipping bin** (next to the mailbox) — drop goods in; they sell overnight at full price and
    you get a report in the morning.
24. **Food buffs** — omelette and corn chowder (Swift: faster), miner's stew (rocks break twice as
    fast), grilled fish (fish bite sooner, bigger catch bar), pumpkin pie and blueberry tart (Lucky:
    extra harvests). Active buffs show at the top right.
25. **Fishing minigame** — strike when the "!" shows, then hold Use to keep the green bar on the
    fish until the meter fills. Harder fish dart more. Sometimes it's just an old boot. **Crab pots**
    go in any water; bait them and check them the next morning.
26. **Mine monsters** — bats from floor 6, rock crabs from 11, ghosts from 21; a boss on floors 10,
    20 and 30 opens the way down and guards a treasure chest. Chests also turn up on other floors.
    Wear a ring and armour (Wear in the backpack): power, guard and lucky rings, leather and iron
    armour.
27. **The old forest** — at the west end of the path. Seasonal forage, ancient stumps for hardwood
    (once a day), and a hermit who pays double for anything foraged. Forage also pops up in the
    meadows each morning.
28. **Seasons** — oaks blossom and petals fall in spring; in winter the water takes on a cold
    tint, but it always blocks you: there is no walking on water in any season.
29. **Pets** — on day 2 a stray cat and dog wait by your door. Adopt one, name it, pet it daily; it
    follows you and sometimes brings you things. The other stray comes back later, so you can have both. Press **P** (rebindable in Settings) to tell it to
    stay where it is; press P again and it follows you once more. It still goes home to nap at night.
30. **Romance** — give a Bouquet (Mira) at 8 hearts to start dating, and a Sea Pendant (Willa) at 10
    hearts to propose. After the wedding your spouse lives in the cottage and helps around the farm.
    8- and 10-heart scenes for everyone.
31. **Farm buildings** — silo (stores hay, refills barns, makes cut grass give hay), well (refill
    the can), shed (40-slot storage), iron and gold sprinklers (3×3 and 5×5), auto-collector (empties
    finished machines into the nearest chest), ducks and rabbits, and decorations: statue, flower
    bed, birdbath, garden gnome.
32. **Your cottage** comes furnished: a kitchen stove (E to cook), a stone fireplace (E to warm up),
    a table and chair, a rug, a display table and a wall shelf. Hold anything — a fish, a dish, a gem,
    a stone — and press Space at a display to show it off; E takes it back. Craft an aquarium for up
    to three fish. Move furniture with the pickaxe.

## Architecture

```
farming/                     npm workspaces monorepo
├─ shared/                   @farming/shared — no runtime deps, used by front & back
│  └─ src/
│     ├─ constants/          tile size, world size, player speeds
│     ├─ types/              Terrain, WorldObjectSpec, Direction, CharacterAppearance, SaveData
│     ├─ validation/         validateSave(): server-side checks against the game rules
│     ├─ world/              generateWorld(seed), WorldData, seeded RNG/noise, weather forecast
│     │                      (moved here from the engine so the server builds the same map)
│     ├─ net/                the co-op protocol: typed Socket.IO events, world ops, trade views
│     └─ game-config/        GAME_CONFIG, starter kit, and the game rules as data: items, crops,
│                            recipes, resources, placeables, time/weather, NPCs, appearance
├─ scripts/dev-all.mjs       runs frontend + backend together (npm run dev)
├─ frontend/                 Next.js (App Router) + Phaser 3
│  ├─ app/                   routes: / (homepage), /docs, /start (title), /play, /login, /register, /profile
│  ├─ components/            GameCanvas (mounts engine), Hud, Hotbar, Toasts, ItemSlot/Icon,
│  │                         CharacterPicker; menus/ (TitleScreen, AuthForm, ProfilePage);
│  │                         site/ (Landing, Docs, Sprite, catalog of every sprite)
│  │  └─ panels/             Inventory, Crafting, Trade, Board, Chest, Character, Menu, Map (+ Clock, EnergyBar, DialogueBox, Hearts)
│  ├─ hooks/                 useGameEvent (game → React), useSession (who is signed in)
│  ├─ services/              api.ts (typed backend client), saveStores.ts (cloud + browser saves),
│  │                         coop.ts (Socket.IO client: host / join, implements CoopSession)
│  └─ game-engine/           everything game-related; React-free
│     ├─ index.ts            createGame() → GameHandle (the only API React uses)
│     ├─ config.ts           Phaser config (pixelArt, RESIZE scaling, Arcade physics)
│     ├─ constants.ts        scene keys, render depth layers
│     ├─ events/             gameEvents (game → UI) and gameCommands (UI → game); no Phaser import
│     ├─ scenes/             BootScene (generate art) → WorldScene (wires systems together)
│     ├─ entities/           Player (movement, animation, tool swings)
│     ├─ net/                CoopSession (the engine's view of a connection) and Authority
│     │                      (local: apply now; server: apply once the server agrees)
│     ├─ state/              Inventory, PlayerState, economy rules, Social (friendship), Quests (notice board), save format + SaveStore
│     ├─ systems/            Time, Weather, Lighting, Build, Animal, Npc, Interaction, Fishing,
│     │                      AmbientLife, RemotePlayer, Resource, Farming, Drop, Fx, Camera, …
│     ├─ maps/               WorldData, WorldGenerator (seeded), tileResolver (autotiling)
│     ├─ assets/             procedural pixel art: palette, tileset, sprites, character
│     ├─ audio/              synthesiser (dsp), sound designs, AudioSystem (mixing, ambience, music)
│     └─ utils/              seeded RNG, value noise
└─ backend/                  Express + Socket.IO + PostgreSQL (run with tsx)
   └─ src/
      ├─ index.ts            server start, DB connect/migrate with retry, health monitor
      ├─ realtime/           Socket.IO: cookie sign-in, rooms (Room), the server's copy of the
      │                      shared world (CoopWorld), invite codes
      ├─ config.ts           env (DATABASE_URL, PGLITE_DATA_DIR, PORT, NODE_ENV; backend/.env loaded)
      ├─ api/                routes, session/rate-limit middleware, errors
      ├─ controllers/        auth, profile, worlds (+ inventory), game-data
      ├─ services/           auth (scrypt passwords, sessions), world saves (validation, conflicts)
      ├─ models/             SQL for users, sessions, profiles, worlds, inventory_items, coop_members
      └─ database/           db.ts (embedded PGlite or PostgreSQL server), migrate.ts, migrations/*.sql
```

### Key decisions

- **Engine/UI separation.** Phaser owns the game loop and all game state. React only mounts a
  `<div>`, holds an opaque `GameHandle`, renders typed events (`inventory:changed`,
  `player:stats`, `ui:panel`, `interaction:hint`…) and sends typed commands back
  (`inventory:move`, `craft`, `shop:buy`…). The game validates every command, so the same
  handlers can later accept commands from the network. Phaser is loaded with a dynamic
  `import()` inside `useEffect`, so it never runs during server rendering.
- **Rules as data.** Items, crops, recipes and resource nodes live in `shared/game-config`, so the
  backend can validate trades and crafting with the same definitions in Phase 4.
- **Data-first world.** `generateWorld(seed)` returns plain `WorldData` (typed arrays + object
  specs) with no engine references. The same structure can be saved to and loaded from the
  backend in Phase 3/4, and validated server-side for multiplayer.
- **Procedural, original pixel art.** All art (tileset, trees, rocks, character) is drawn in code
  at boot from one palette — no external assets, no licensing questions, consistent 16px grid.
  The character sheet is generated from a `CharacterAppearance`, which is the hook for
  customisation.
- **Crisp rendering.** `pixelArt: true`, an extruded tileset (no seams), and an integer camera
  zoom chosen from the window height, so every art pixel is the same size on any screen.
- **Top-down depth.** Objects and the player are y-sorted by their base. Collision bodies are
  small feet-level boxes, so you can walk behind trees; canopies fade when they hide the player.

## The big content update

Seven batches on top of Phase 5:

1. **Mine & tool upgrades** — `MineScene` (cellular-automaton caves, ore by depth, hidden ladders,
   slimes, health, lantern darkness, elevator); iron and gold tools, swords.
2. **Crops & machines** — 8 new crops (some regrow), the greenhouse, keg and preserves jar
   (`shared/game-config/machines.ts`, ready times in game minutes so the server can run them).
3. **Animal care** — barn, cows and sheep, hay, happiness, milk and wool, cheese press and loom
   (`livestock.ts`; the morning update is a pure function both the game and the server run).
4. **Village life** — NPC commutes, four festivals (egg hunt, fishing derby, harvest fair, winter
   lights), heart events, mail with gifts (`village.ts`, `Social`).
5. **Beach & cottage** — side areas share `AreaScene` (the world scene keeps the clock and menus
   while you're away): `BeachScene` (sea fishing, daily forage) and `InteriorScene` (furniture on
   floor/object/wall layers, lamps, the bed, the cottage extension).
6. **Co-op upgrades** — **host migration** (when the host leaves, the longest-connected player
   becomes host and the world stays open; the owner takes over again on return, and the world
   keeps saving into the owner's account); **community projects** on the notice board, shared
   through a `donate` world op the server clamps and checks; the server now keeps its copy of each
   backpack in step (items given to chests or projects must be in it; items it hands out are added
   to it) and rejects implausible gold jumps.
7. **Quality of life** — `game-engine/settings.ts` (rebindable keys, UI scale, day length, touch
   mode, saved in the browser), `InputSystem` reading keyboard, mouse, gamepad and the on-screen
   `virtualPad` together, `Collection` + `shared/game-config/achievements.ts`, save export/import
   (`state/saveFile.ts`, validated with the same `validateSave` the server uses).

## The second content update

Nine more batches:

- **A — Shipping & buffs:** `shipping_bin` (permanent, next to the mailbox), `PlayerState.ship/sellBin`,
  `SummaryPanel`; `BUFF_INFO` and timed buffs kept in game minutes and saved with the player.
- **B — Fishing:** the reeling minigame lives in `FishingSystem` (`isHeld` comes from
  `InputSystem.useHeld()`: keyboard, mouse, gamepad A or the touch Use button); fish have a
  difficulty; trash catches; crab pots are machines with a random output (`rollMachineOutput`, rolled
  by the server in co-op).
- **C — Mine:** `MONSTERS`, `floorMonsters`, `BOSSES`, `treasureTable` in `activities.ts`; equipment
  (`equip` on items, `PlayerState.wear/takeOff`, attack bonus and damage reduction).
- **D — Story:** `story.ts` (`STORY`, `ARCS`, `TUTORIAL`), progress kept in `SocialSave`, `JournalPanel`,
  `TutorialTip`.
- **E — Forest, seasons, pets:** `ForestScene`, `FORAGE`, oak blossom and petals, a cold winter
  tint on water (water always blocks; ice-walking was removed), `PetSystem`.
- **F — Romance:** 8/10-heart scenes, `ROMANCE`, `SPOUSE_LINES`; the spouse appears in `InteriorScene`
  and helps each morning.
- **G — Farm buildings:** `STORAGE_SIZE`/`isStorage` (chests and sheds), `sprinklerTiles`,
  `siloRefill` (run by both the game and the server), `coopProduce` for chickens, ducks and rabbits,
  auto-collectors (single player).
- **H — Co-op:** public games (`GET /api/lobbies`), friends (`friends` table, `/api/friends`, shows
  which game a friend is in and lets you join it), cabins for guests (`CoopWorld.showCabin`/`hideCabin`: a
  cabin stands only while its owner plays; its spot is remembered in the host's world), and a shared wallet (`room:settings`; the server keeps one purse and syncs
  everyone's gold; turning it off splits the purse).
- **I — Polish:** emotes (`player:emote`), crops swaying in the wind, trees and rocks culled outside
  the camera, a phone layout, and a furnished cottage with displays (`STARTER_FURNITURE`, furniture
  `display` slots saved in `InteriorSave`).

## Co-op (Phase 5)

**How to play together.** Both players need an account.

1. The host opens a world and chooses **Invite friends (co-op)** in the pause menu, or **Host
   co-op** next to a world on the title screen. A six-letter code appears at the top left.
2. Friends enter the code under **Join a friend** on the title screen (or open `/play?join=CODE`).
   Up to four players per world.
3. Everyone sees each other move, swing tools and change the world. Press **Enter** to chat, and
   **Trade** next to a name to swap items and gold.
4. The day ends when **everyone** has gone to bed (anyone still up at 2am passes out). The whole
   world moves to the next morning together.
5. If the host leaves while others are playing, the longest-connected player becomes host and the
   world stays open (it keeps saving to the owner's account); the owner takes over again when they
   rejoin with the same code. If everyone leaves, the room closes after 30 seconds.

**What is shared, and who is in charge.** The server holds the shared world: soil and crops, trees,
rocks and bushes, buildings and chest contents, chickens and their eggs, the clock and the weather.
Every change is a request (`world:op`) that the server checks against its own copy, using the same
item, crop and resource rules as the game, before applying it and telling everyone. So two players
can never harvest the same crop, fell the same tree, pick up the same egg or take the same items
from a chest. The server also runs the clock and the morning update: crops grow, soil dries,
sprinklers water, things regrow and chickens lay.

**What each player keeps.** Your backpack, gold, energy, friendships and notice-board progress are
your own. Your game reports them every few seconds. The server checks each report against the game
rules (`validateSave`) and saves it: the host's in their world's save, guests' in `coop_members`.
Come back to the same world later and you have your things.

**Trading** is coordinated by the server:

- Offers are checked against what you last reported having.
- Any change un-accepts both sides.
- When both accept, each side hands over its items and the server confirms both did before
  delivering. If either side can't, whatever was handed over is refunded.

**Movement** is sent ten times a second each way and smoothed on screen. The server rejects moves
faster than running speed (with slack for lag) and snaps the player back.

**Honest limits.**

- The server does not run physics, so it doesn't check walls or water.
- Your own backpack is reported by your game rather than simulated on the server, so a modified
  client could misreport it, as in single-player. The server still enforces every rule about the
  shared world and between players, checks items put into chests and community projects against
  its own copy of your backpack, and rejects reports where gold jumps implausibly.
- Merchants, fishing and cooking work exactly as in single-player, per player.

**Protocol** (`shared/src/net/protocol.ts`, typed on both ends):

| Client → server | Server → client |
| --- | --- |
| `room:host` {save} / `room:join` {code} → `CoopJoin` | `room:members`, `room:positions` (10/s), `room:closed` |
| `player:move`, `player:anim`, `player:state` | `world:op`, `world:chest`, `world:time`, `world:newday` |
| `world:op` (with an `OpAck` reply) | `player:anim`, `player:correct` |
| `sleep:set`, `chat:send` | `sleep:status`, `chat:message`, `notice` |
| `trade:request` / `respond` / `offer` / `confirm` / `cancel` / `ack` | `trade:incoming`, `trade:state`, `trade:commit` / `deliver` / `refund` |

Sign-in uses the same `farm_sid` session cookie as the API. Connections are only accepted from pages
served by the same machine, or from origins in `CORS_ORIGINS`.

## The village market, friendship and more life

- **Five merchants**, each behind their own stall in the market row west of your cottage, each with
  their own hours, goods, prices and swap offers:

  | Merchant | Stall | Hours | Sells | Buys |
  | --- | --- | --- | --- | --- |
  | Mira | Seeds & goods | 8am–6pm | Seeds (by season), chickens | Anything with a price |
  | Rosa | Bakery | 7am–4pm | Bread, berry jam, pumpkin pie | Eggs, berries, crops |
  | Bram | Smithy | 9am–5pm | Copper tools, sprinklers, lamp posts | Stone, copper ore |
  | Finn | Fish stand | 6am–3pm | Fishing rod, grilled fish | Every fish |
  | Willa | Carpentry | 9am–6pm | Fences, paths, chests, benches, flower pots, scarecrows | Wood, fiber |

  The trade panel has Buy, Sell, Trade (swap items) and Gift tabs, and shows your hearts and
  friend discount.
- **Friendship:** hearts (0–10) per villager. A daily chat (+10) and one gift a day (loved +80,
  liked +40, anything else +15) raise them; friends say warmer things and give discounts. The
  notice board's Villagers tab lists everyone's hearts. Hold a gift and press Space on Tobin to
  give it to him; merchants take gifts from the trade panel.
- **Notice board:** two requests a day, chosen from the world seed and the day (everyone in the
  same world sees the same ones), paying gold plus friendship with whoever asked.
- **Fishing:** sunfish all year, trout in spring and fall, catfish at night or in the rain, and a
  rare golden carp. Reeling in too early or too late loses the fish; walking away reels in.
- **Cooking:** veggie soup, berry jam, grilled fish, omelette and pumpkin pie, in a new Cooking tab.
- **Sprinklers** water the four plots next to them every morning. **Benches** let you sit for a
  short break (+15 energy, 30 minutes). **Flower pots** and **scarecrows** are decoration.
- **Liveliness:** speech bubbles as villagers chat to themselves when you're close, ducks paddling
  on ponds, butterflies on sunny spring and summer days, fireflies on warm nights, and leaves
  drifting down in fall.
- **Older saves** get the new stalls and notice board automatically (anything growing in the
  market area is cleared).

## World map, eating and easier farming

- **World map (M, or the Map button):** the whole world drawn from live state: terrain, forests,
  rocks and copper, your cottage, Mira's stall, farmland (crops ready to harvest in yellow),
  your buildings, villagers and chickens, with a pulsing "you are here" marker.
- **Eating:** F eats the selected food from anywhere, right-click a food slot in the hotbar or
  inventory, or use the Eat button in the inventory. New games start with some berries.
- **Farming:** seeds can be planted straight onto grass ("Till & plant"); new games start with a
  tilled 3×3 plot next to the cottage. Facing a growing crop shows its progress on the action
  button ("Turnip · ready in 3 days · needs water"); mature crops show "Harvest".

## Sound and the action button

- **Floating action button:** whatever you face (tree, rock, crop, chest, NPC, chicken, stall, bed,
  empty soil…) gets a button above it showing the action and its key ("Space · Chop",
  "E · Talk to Mira"). Click it or press the key; blocked actions show in red with the reason.
  Its position is written straight to the DOM each frame, so it follows smoothly without React
  re-renders.
- **Sound, all synthesised in code** (`game-engine/audio/`, no audio files):
  - ~27 effects: chop, mine, wrong-tool clunk, tree fall, rock break, grass swish, berry rustle,
    till, water, refill, plant, harvest, fertilizer sparkle, item pickup, place/pick up, tool whoosh,
    eat, coins, craft, error, menu open/close, dialogue, chicken clucks, footsteps (grass, path,
    wood and snow sound different), going to bed, morning chime.
  - Ambience: birdsong on fair days, crickets on warm nights, rain and wind loops that fade with
    the weather, placed around you in stereo.
  - Music: a gentle generative score in a different key and mood each season, sparser at night.
  - Volume sliders (master, music, effects, ambience) and mute (Shift+M) in the pause menu;
    remembered in the browser.

## What Phase 4 adds

- **Accounts:** register / log in / log out. Passwords hashed with scrypt (Node built-in);
  sessions are random tokens in an `httpOnly`, `SameSite=Lax` cookie, stored server-side only as a
  SHA-256 hash, 30-day expiry with cleanup. Login and registration are rate-limited, and login
  timing doesn't reveal whether a username exists.
- **Profiles:** display name and a default character look for new worlds; stats across worlds.
- **Cloud saves:** signed-in players save to the server and to the browser at the same time.
  Loading uses whichever copy is newer and uploads a newer offline copy. The server rejects saves
  older than the one it has (409), so an old tab can't overwrite newer progress. Guests keep
  browser-only saves.
- **Validation:** every uploaded save is checked against the shared rules (known items, stack
  limits, map bounds, crop stages, chest sizes, value ranges) before it is stored.
- **Database (PostgreSQL):** embedded by default (PGlite, nothing to install) or any PostgreSQL
  server via `DATABASE_URL`, behind one small interface. Tables: `users`, `sessions`, `profiles`,
  `worlds` (full save as JSONB plus day/gold/earnings columns) and `inventory_items` (backpack and
  every chest, one row per slot, for queries and future trading). Plain SQL migrations, applied
  automatically.
- **APIs:**

  | Method & path | Purpose |
  | --- | --- |
  | `GET /api/health` | Service + database status |
  | `GET /api/game-data` | Items, crops, recipes, resources, placeables, NPCs, time and weather rules |
  | `POST /api/auth/register` · `login` · `logout`, `GET /api/auth/me` | Accounts and session |
  | `GET` / `PATCH /api/profile` | Profile and stats |
  | `GET /api/worlds` | Saved worlds (summaries) |
  | `GET` / `PUT` / `DELETE /api/worlds/:seed` | Load / save / delete one world |
  | `GET /api/worlds/:seed/inventory` | Normalised inventory rows for a world |
- **Menus in Next.js:** title screen, login/register, profile; "Save & quit to title" in-game.
- **Resilience:** the backend keeps running if the database is unavailable, reports it on
  `/api/health`, reconnects automatically, and the game falls back to browser saves.

## What Phase 3 adds

- **Time:** a 06:00–02:00 day clock, sleeping in the cottage, passing out at 2am, 4 seasons of
  10 days, years. Menus pause time.
- **Day/night lighting:** dusk and night overlays with lights cut out for lamp posts, cottage windows
  and the player's lantern (canvas light map, redrawn only when something changes).
- **Weather:** sunny, cloudy, rain (waters crops) and snow, rolled per day from the seed.
- **Seasons:** seasonal foliage for every tree, bush and tuft of grass, autumn ground colours,
  snow-covered ground in winter, seasonal crops and shop stock.
- **Energy:** tools cost energy; food restores it; sleep refills it.
- **Building:** fences, wood and stone paths, lamp posts, chests (20-slot storage); placement
  preview; pick-up with the pickaxe; the player's cottage.
- **NPCs:** Mira (merchant, keeps shop hours behind her stall) and Tobin (walks the path); both talk,
  with lines that react to season and weather.
- **Animals:** wild rabbits that flee and hide at night; chickens you buy, release and pet, which lay
  eggs every morning.
- **Progression:** shop items unlock with lifetime earnings; resources regrow over days.
- **Saving:** full game state (player, inventory, chests, farm, buildings, resources and pending
  regrowth, chickens, time, weather) saved to local storage per world, via a `SaveStore`
  interface that Phase 4 can back with the API. Pause menu: save now, new game.
- **Character customisation:** skin, hair, shirt and trousers, applied live.

## What Phase 2 adds

- Facing-tile targeting with a cursor and a contextual hint ("Space · Chop", "E · Shop").
- Tool swings with impact timing, hit shake, particle bursts, toppling trees.
- Resource nodes with HP and tool requirements; trees leave stumps; everything respawns
  (never on top of the player or on soil you've tilled).
- Dropped items that pop out, get pulled to the player, and merge into the inventory.
- 30-slot stacking inventory with a 10-slot hotbar, drag & drop, and pickup toasts.
- Drop items on the ground: drag a stack out of the inventory onto the game (or use **Drop**; Shift drops one).
  It lands near you toward the cursor and stays put; grab it again by clicking (or tapping) it, by stepping onto it, or by walking away and back (then it's pulled in as usual). Items on
  the ground are remembered per area and saved (`floor` in the save); mine floors are rebuilt each visit,
  so anything left there is lost.
- Farming: tilled soil layer, dry/wet soil, three crops with stage art, growth, harvest.
- Crafting (5 recipes, copper tool upgrades) and a merchant to buy seeds and sell goods.
- All new art (18 item icons, crop stages, soil, stall, copper ore, particles) is procedural.

## What Phase 1 includes

- Seeded world (96×72 tiles): ponds, a winding river, a path with a bridge, forests (oak/pine),
  rocks, bushes, stumps, tall grass, flower meadows, and a clearing at spawn.
- Autotiled shorelines and path borders (16 edge variants each).
- Player with 4-direction walk cycles, running, shadow, and world-bound clamping.
- Arcade Physics collisions with water and obstacles.
- Smooth-follow camera clamped to the world; responsive to window size.
- Ambient touches: water glints, tall grass that sways when walked through, canopy fade.
- HUD showing seed, terrain/tile under the player, and FPS.

## Next steps

1. **Fully server-owned backpacks:** crafting, shopping and harvesting still run on the player's side
   and are reported; moving them to the server would close the remaining gaps.
2. **Server physics** (collision against the map) for stricter movement checks.
4. **Auto-collectors in co-op** — they only run in single player for now.
5. **The shared wallet** lasts for the session; it isn't saved with the world.
