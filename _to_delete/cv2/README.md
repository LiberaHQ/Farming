# Valley

A browser-based, top-down 2D sandbox adventure: farming, exploration, gathering, crafting and building.
**Current state: Phase 5 + two big content updates** — co-op multiplayer over Socket.IO (shared worlds the server is in charge of, synced movement, chat, trading, co-op farming, host migration), accounts, profiles and cloud saves in PostgreSQL, and a game with days and seasons, weather, building, a village market of five merchants with schedules, festivals, heart events and mail, a 30-floor mine with combat, 11 crops, a greenhouse and artisan machines, a barn with cows and sheep, a beach, a cottage you furnish, community projects, a collection with achievements, settings for keys, UI size, day length, gamepads and touch screens — and now a story, villager requests and first-day tips, a shipping bin with a morning report, food buffs, a fishing minigame and crab pots, mine bosses and treasure, rings and armour, an old forest with a hermit, pets, romance and marriage, silos, wells, sheds, ducks and rabbits, decorations and automation, a cottage that comes furnished (with displays for your best fish, food and gems), public co-op games, friends, cabins, a shared wallet, and emotes.

## The carnival

South of the path below the market stands a striped arch (🎡 on the map): walk through it into
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

## Homepage, docs and indoor decor

- **Valley homepage** (`/`) and **docs** (`/docs`), in the game's colours. Every sprite is drawn live by the
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
| `/` | Homepage: the Valley logo, a living pixel diorama, **Play** and **Docs**, and every sprite in the game (villagers, animals, mine, nature by season, crops by stage, buildings, machines, decor, furniture, tiles and all items) |
| `/docs` | The Valley handbook: controls, and every role in the game — you and your trades, co-op host/guest/leader, each villager (hours, stock, gifts, favours), animals and pets, mine monsters and bosses, friendship and romance. Built from the game data, so it stays current |
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
| I or Tab | Inventory (drag stacks, or click one slot then another) |
| C | Crafting |
| K | Collection & achievements |
| Q | Journal: the story and villager requests |
| T | Emotes (co-op partners see them) |
| Esc | Close a menu, or open the pause menu (save, customise, new game) |
| Shift+M | Mute / unmute |
| Enter | Co-op chat (the game ignores keys while you type; Esc closes) |
| Click the floating button | Do the action shown above whatever you're facing |
| `` ` `` (backtick) | Toggle collision boxes (developer aid) |

**Gamepad** (any standard controller): left stick / D-pad move, A use, X interact, Y backpack,
B or Start menu, LB/RB hotbar, LT eat, RT run, View/Back map.
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
13. **The mine** (north of the farm) — 30 floors of ore, gems and slimes; find the ladder down,
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
28. **Seasons** — oaks blossom and petals fall in spring; in winter the river and ponds freeze and
    you can walk across the ice.
29. **Pets** — on day 2 a stray cat and dog wait by your door. Adopt one, name it, pet it daily; it
    follows you and sometimes brings you things.
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
- **E — Forest, seasons, pets:** `ForestScene`, `FORAGE`, oak blossom and petals, frozen water
  (collision turned off per tile in winter), `PetSystem`.
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
3. **Menus by gamepad** — the pad plays the game and closes menus but can't move through buttons.
4. **Auto-collectors in co-op** — they only run in single player for now.
5. **The shared wallet** lasts for the session; it isn't saved with the world.
