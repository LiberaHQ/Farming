import * as Phaser from 'phaser';
import {
  CARNIVAL_GAMES,
  CARNIVAL_PRIZES,
  CARNIVAL_RIDES,
  CARNIVAL_TREATS,
  CARNIVAL_GAME_IDS,
  CARD_BONUS,
  FORTUNES,
  GOLDEN_HOUR,
  JUGGLER_TIP,
  dailyChallenge,
  isGoldenHour,
  TOKEN_PRICE,
  WHEEL_SLICES,
  spinWheel,
  type CarnivalGameId,
  DEFAULT_WORLD_SEED,
  GAME_CONFIG,
  EGG_HUNT,
  FESTIVALS,
  festivalOn,
  FRIEND_GIFT_CHANCE,
  FRIEND_GIFTS,
  gameTime,
  isMachineKind,
  mailboxTile,
  shippingBinTile,
  NPC_IDS,
  ITEMS,
  ITEM_IDS,
  MACHINES,
  MINE,
  NPCS,
  BUFF_INFO,
  TERRAIN_NAMES,
  TIME_CONFIG,
  Terrain,
  formatClock,
  resolveAppearance,
  WILDLIFE,
  withQuality,
  findRecipe,
  QUALITY_NAMES,
  FRUIT_TREES,
  fruitTreeForSapling,
  type Quality,
  joinSave,
  type CoopPlayerState,
  type FestivalDef,
  type InteriorSave,
  type Direction,
  type ItemAmount,
  type ItemId,
  type MemberView,
  type SharedWorldState,
  type TradeOffer,
  type WorldOp,
  type NpcId,
  type TerrainType,
  applyDonation,
  communityGoal,
  communityRoom,
  type CommunityGoalId,
  type CommunityProgress,
  COMMUNITY_GOALS,
  communityDone,
  type AchievementContext,
  type SlotData,
  ARCS,
  STORY,
  TUTORIAL,
  type StoryContext,
  type TutorialStep,
  FORAGE,
  BARN,
  ROMANCE,
  SPOUSE_LINES,
  siloRefill,
  sprinklerTiles,
  type CabinSave,
  EMOTES,
  STARTER_FURNITURE,
  BOAT_REPAIR,
  HOME_BEDTIME,
  HOME_LIFE,
  HOME_TREAT_HEARTS,
  HOME_VISIT_HEARTS,
  MUSEUM_COMPLETE_GOLD,
  MUSEUM_ITEMS,
  MUSEUM_SET_IDS,
  MUSEUM_SETS,
  museumSetOf,
  SKILL_IDS,
  SKILLS,
  skillPerks,
  type SkillId,
  HORSE_NAMES,
  HORSE_SPEED,
  BIRTHDAY_GIFT_MULTIPLIER,
  birthdayOn,
  forecastWeather,
  isMeteorNight,
  isStormDay,
  METEOR_SHOWER,
  RAINBOW_HOURS,
  RAINBOW_LUCK_MINUTES,
  CROPS,
  TOWNS,
  TOWN_IDS,
  FREIGHT_PREMIUM,
  freightPremium,
  dayOfSeason,
  seasonOfDay,
  MOTH_TRADES,
  NIGHT_MARKET_HOURS,
  SPIRITS,
  SPIRIT_IDS,
  WICK_BUYS,
  ferryOffers,
  nightMarketOpen,
  type SpiritId,
  HEIRLOOMS,
  HEIRLOOM_IDS,
  HEIRLOOM_STARTER_SEEDS,
  HEIRLOOM_START_DAY,
  MAX_REDEEMED_PARCELS,
  SEED_PARCEL_SIZES,
  decodeSeedParcel,
  encodeSeedParcel,
  heirloomOfSeed,
  nativeHeirlooms,
  parcelKey,
  worldTag,
} from '@farming/shared';
import { itemTextureKey, objectTextureKey, repaintPlayer, TEXTURES } from '../assets/registerTextures';
import { edgeTileInfo, GRASS_VARIANTS, SEASON_EDGES, TILE, TILE_MARGIN, TILE_SPACING, WATER_TILE_INDICES } from '../assets/tileIndex';
import { DEPTH, SCENES } from '../constants';
import { Player } from '../entities/Player';
import { gameCommands, gameEvents, type GameCommandMap, type PanelId } from '../events/GameEventBus';
import { drawWorldMap, MAP_SCALE } from '../maps/mapImage';
import { buildGroundIndices } from '../maps/tileResolver';
import { generateWorld } from '../maps/WorldGenerator';
import { terrainAt, type WorldData } from '../maps/WorldData';
import { barterWith, buyFrom, craft, offerFor, sellTo, stockFor, type TxResult } from '../state/economy';
import { Quests } from '../state/Quests';
import { Freight, type FreightEvent } from '../state/Freight';
import { Social } from '../state/Social';
import { PlayerState } from '../state/PlayerState';
import { LocalSaveStore, SAVE_VERSION, type SaveData, type SaveStore } from '../state/save';
import type { AppearanceChoice } from '@farming/shared';
import { AmbientLifeSystem } from '../systems/AmbientLifeSystem';
import { TrainSystem } from '../systems/TrainSystem';
import { NightMarketSystem } from '../systems/NightMarketSystem';
import { EcosystemSystem, type DawnReport } from '../systems/EcosystemSystem';
import { OrchardSystem } from '../systems/OrchardSystem';
import { daily } from '../state/daily';
import { EPITAPHS, GhostSystem } from '../systems/GhostSystem';
import { drawDeadTree, drawFreightDeck, drawFreightGoods, drawFreightShed, drawGraveFence, drawGravePost, drawTombstone } from '../assets/valley';
import { AnimalSystem } from '../systems/AnimalSystem';
import { FishingSystem } from '../systems/FishingSystem';
import { BuildSystem, type Placed } from '../systems/BuildSystem';
import { CameraSystem } from '../systems/CameraSystem';
import { DropSystem } from '../systems/DropSystem';
import { FarmingSystem } from '../systems/FarmingSystem';
import { FxSystem } from '../systems/FxSystem';
import { GrassRustleSystem } from '../systems/GrassRustleSystem';
import { DAY_LENGTHS, keyLabel, settings } from '../settings';
import { Collection } from '../state/Collection';
import type { ForestSceneData } from './ForestScene';
import type { CarnivalHost, CarnivalSceneData } from './CarnivalScene';
import { drawBridgeLantern, drawBridgeRail } from '../assets/bridge';
import { drawMineCart } from '../assets/mine';
import { drawArch, drawBunting, drawFairBillboard, drawFairSignpost, drawHandBalloon, drawLightPole, drawTreatCart } from '../assets/carnival';
import { WaypointSystem } from '../systems/WaypointSystem';
import { PetSystem } from '../systems/PetSystem';
import { downloadSave } from '../state/saveFile';
import { floorItems } from '../state/floorItems';
import { InputSystem } from '../systems/InputSystem';
import { InteractionSystem } from '../systems/InteractionSystem';
import { LivestockSystem } from '../systems/LivestockSystem';
import { LightingSystem } from '../systems/LightingSystem';
import { NpcSystem, type Npc } from '../systems/NpcSystem';
import { OcclusionSystem } from '../systems/OcclusionSystem';
import { ResourceSystem } from '../systems/ResourceSystem';
import { TimeSystem } from '../systems/TimeSystem';
import { createRng } from '../utils/random';
import { WaterGlintSystem } from '../systems/WaterGlintSystem';
import { WeatherSystem } from '../systems/WeatherSystem';
import { AudioSystem } from '../audio/AudioSystem';
import { bindAudio, sfx, unbindAudio, withSfxVolume } from '../audio/sfx';
import { LocalAuthority, ServerAuthority, type Authority } from '../net/Authority';
import type { CoopSession } from '../net/CoopSession';
import { RemotePlayerSystem } from '../systems/RemotePlayerSystem';
import type { MineHost, MineSceneData } from './MineScene';
import type { AreaHost } from './AreaScene';
import type { BeachSceneData } from './BeachScene';
import type { InteriorSceneData } from './InteriorScene';
import type { HomeSceneData } from './VillagerHomeScene';
import type { MuseumSceneData } from './MuseumScene';
import type { IslandSceneData } from './IslandScene';
import type { IslandCaveSceneData } from './IslandCaveScene';
import { drawMuseum, drawVillagerHouse } from '../assets/places';
import { skills } from '../state/skills';
import { HorseSystem } from '../systems/HorseSystem';
import { SkyEventsSystem } from '../systems/SkyEventsSystem';

type Rect = { x0: number; y0: number; x1: number; y1: number };

interface WorldSceneData {
  seed?: string;
  /** Save to resume from (loaded by the app before the game starts). Null = new game. */
  save?: SaveData | null;
  /** Co-op: the shared world from the server, and this player's own progress. */
  coop?: CoopSceneData | null;
}

export interface CoopSceneData {
  session: CoopSession;
  shared: SharedWorldState;
  /** This player's progress in the world, or null on a first visit. */
  me: CoopPlayerState | null;
  members: MemberView[];
  /** Set when the scene restarts for a new co-op day. */
  morning?: { passedOut: boolean; shipped?: { items: Array<{ itemId: ItemId; quantity: number; gold: number }>; total: number } };
}

/** How often this player's own progress is reported to the co-op server. */
const COOP_STATE_MS = 3000;

const GROUND_TINT = { spring: 0xffffff, summer: 0xf4ffe6, fall: 0xf2cf8e, winter: 0xffffff } as const;

/** The playable overworld. Owns the map and wires the gameplay systems together. */
export class WorldScene extends Phaser.Scene {
  private seed = DEFAULT_WORLD_SEED;
  private world!: WorldData;
  private ground!: Phaser.Tilemaps.TilemapLayer;
  private player!: Player;
  private state!: PlayerState;
  private controls!: InputSystem;
  private occlusion!: OcclusionSystem;
  private rustle!: GrassRustleSystem;
  private drops!: DropSystem;
  private interaction!: InteractionSystem;
  private resources!: ResourceSystem;
  private farming!: FarmingSystem;
  private build!: BuildSystem;
  private animals!: AnimalSystem;
  private livestock!: LivestockSystem;
  private npcs!: NpcSystem;
  private time_!: TimeSystem;
  private weather!: WeatherSystem;
  private lighting!: LightingSystem;
  private audio!: AudioSystem;
  private fx!: FxSystem;
  private fishing!: FishingSystem;
  private ambient!: AmbientLifeSystem;
  private social!: Social;
  private quests!: Quests;
  /** Merchant whose trade panel is open. */
  private shopNpc: NpcId | null = null;
  private stepTimer = 0;
  private store: SaveStore = new LocalSaveStore();
  private initialSave: SaveData | null = null;
  private panel: PanelId | null = null;
  private sleeping = false;
  private lastTileKey = -1;
  private fpsElapsed = 0;
  private lastSavedAt: number | null = null;
  private coop: CoopSceneData | null = null;
  private authority: Authority = new LocalAuthority();
  private remotes: RemotePlayerSystem | null = null;
  private netOffs: Array<() => void> = [];
  private lastSentMove = '';
  private moveTimer = 0;
  private stateTimer = 0;
  private lastStateSig = '';
  private inBed = false;
  /** Down in the mine (the mine scene runs on top; this scene keeps the clock and menus). */
  private away = false;
  /** Which side-area scene is running. */
  private awayKey: string | null = null;
  /** Inside your cottage (yours, even in co-op). */
  private interior: InteriorSave = { level: 0, furniture: [] };
  private community: CommunityProgress = {};
  private collection = new Collection();
  /** Things the tutorial waits for that leave no trace in the save. */
  private readonly seen = new Set<string>();
  private walked = 0;
  private waypoint!: WaypointSystem;
  private roomSettings: { public: boolean; sharedWallet: boolean; leaderId: string } = { public: false, sharedWallet: false, leaderId: '' };
  /** Co-op guests' cabins on this farm. */
  private cabins: CabinSave[] = [];
  private pets!: PetSystem;
  /** The first backpack check after loading is silent (it's not a new find). */
  private collectionReady = false;
  private signpost: Phaser.GameObjects.Image | null = null;
  /** Lines still to show in the current conversation. */
  private dialogueQueue: Array<{ speaker: string; text: string; hearts?: number }> = [];
  /** Festival bunting and lanterns. */
  private decorations: Phaser.GameObjects.Image[] = [];

  constructor() {
    super(SCENES.World);
  }

  init(data: WorldSceneData): void {
    this.seed = data.seed ?? DEFAULT_WORLD_SEED;
    this.initialSave = data.save ?? null;
    this.store = (this.registry.get('saveStore') as SaveStore | undefined) ?? new LocalSaveStore();
    this.lastTileKey = -1;
    this.panel = null;
    this.sleeping = false;
    this.coop = data.coop ?? null;
    this.authority = this.coop ? new ServerAuthority(this.coop.session) : new LocalAuthority();
    this.remotes = null;
    this.netOffs = [];
    this.inBed = false;
    this.lastStateSig = '';
    this.away = false;
    this.dialogueQueue = [];
    this.decorations = [];
  }

  create(): void {
    const { tileSize } = GAME_CONFIG;
    const { widthTiles, heightTiles } = GAME_CONFIG.world;
    this.world = generateWorld(this.seed, widthTiles, heightTiles);
    const save = this.coop ? this.coopSave(this.coop) : this.initialSave;
    const freshGuest = !!this.coop && !this.coop.me;
    this.lastSavedAt = save?.savedAt ?? null;

    // Tile layers: ground (collidable water), floor paths, tilled soil.
    const map = this.make.tilemap({ data: buildGroundIndices(this.world), tileWidth: tileSize, tileHeight: tileSize });
    const tileset = map.addTilesetImage(TEXTURES.tiles, TEXTURES.tiles, tileSize, tileSize, TILE_MARGIN, TILE_SPACING);
    if (!tileset) throw new Error('Tileset could not be created');
    const ground = map.createLayer(0, tileset, 0, 0);
    const floor = map.createBlankLayer('floor', tileset, 0, 0);
    const soil = map.createBlankLayer('soil', tileset, 0, 0);
    if (!ground || !floor || !soil) throw new Error('Tile layers could not be created');
    this.ground = ground.setDepth(DEPTH.ground);
    ground.setCollision(WATER_TILE_INDICES);

    const worldWidth = map.widthInPixels;
    const worldHeight = map.heightInPixels;
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    // Clock and weather come first: other systems spawn in the right season.
    // In co-op the server ends the day (and tells everyone), so passing out locally does nothing.
    this.time_ = new TimeSystem({ onTick: () => this.onClockTick(), onPassOut: () => (this.coop ? undefined : this.goToSleep(true)) });
    this.weather = new WeatherSystem(this, this.seed);
    if (save) this.time_.set(save.time.day, save.time.minute);
    this.weather.set(save?.weather ?? this.weather.forecast(this.time_.day));

    // Player state and entity.
    this.state = new PlayerState();
    if (save && !freshGuest) this.state.restore(save.player);
    else {
      // New worlds start with the look chosen on the player's profile.
      const look = this.registry.get('defaultAppearance') as AppearanceChoice | undefined;
      if (look) for (const part of Object.keys(look) as (keyof AppearanceChoice)[]) this.state.setAppearancePart(part, look[part]);
    }
    repaintPlayer(this, resolveAppearance(this.state.appearance));
    const door = this.doorPosition();
    this.player = new Player(this, save?.player.x ?? door.x, save?.player.y ?? door.y);

    // Systems.
    const fx = new FxSystem(this);
    this.fx = fx;
    if (this.coop) floorItems.keepFor(this.seed);
    else floorItems.reset(this.seed, save?.floor ?? []);
    this.drops = new DropSystem(this);
    this.occlusion = new OcclusionSystem();
    this.rustle = new GrassRustleSystem(this);
    this.farming = new FarmingSystem(this, this.world, soil, fx, this.drops);
    this.farming.lucky = () => this.state.hasBuff('luck');
    const obstacles = this.physics.add.staticGroup();
    this.build = new BuildSystem(this, this.world, floor, obstacles, this.occlusion, fx);
    this.resources = new ResourceSystem(this, this.world.width, {
      obstacles,
      occlusion: this.occlusion,
      rustle: this.rustle,
      fx,
      drops: this.drops,
      isTileReserved: (tx, ty) => this.farming.isTilled(tx, ty) || this.build.isBlocked(tx, ty),
      playerPosition: () => ({ x: this.player.x, y: this.player.y }),
      claim: (node, proceed) =>
        this.authority.request({ t: 'node', tx: node.spec.tx, ty: node.spec.ty }, proceed, () => {
          node.claiming = false;
        }),
    });
    this.resources.setCalendar(this.time_.day, this.time_.season);
    this.orchard = new OrchardSystem(this, {
      obstacles,
      occlusion: this.occlusion,
      drops: this.drops,
      fx,
      calendar: () => ({ day: this.time_.day, season: this.time_.season }),
      farmingLevel: () => skills.level('farming'),
      lucky: () => this.state.hasBuff('luck'),
      grass: (tx, ty) => terrainAt(this.world, tx, ty) === Terrain.Grass,
      blocked: (tx, ty) =>
        this.resources.isBlocked(tx, ty) || this.build.isBlocked(tx, ty) || this.farming.isTilled(tx, ty) || this.animals.occupies(tx, ty) || this.livestock?.occupies(tx, ty) === true,
      solid: (tx, ty) => this.resources.isBlocked(tx, ty) || this.build.isBlocked(tx, ty),
    });
    if (save) {
      this.resources.restore(save.resources);
      // The market moved a little west of the cottage: drop stalls/boards from their old spots.
      this.resources.pruneFixtures(this.world.objects.filter((o) => o.kind === 'stall' || o.kind === 'board' || o.kind === 'mine'));
      // Saves from before the village market: clear the market area and add its stalls and board.
      this.resources.clearArea(this.world.market);
      const { mine } = this.world;
      this.resources.clearArea({ x0: mine.tx - 3, y0: mine.ty - 2, x1: mine.tx + 4, y1: mine.ty + 4 });
      for (const spec of this.world.objects) if (spec.kind === 'stall' || spec.kind === 'board' || spec.kind === 'mine') this.resources.ensure(spec);
    } else this.resources.spawnAll(this.world.objects);
    this.clearCarnivalEntrance();
    this.labelStalls();

    if (save) {
      // Friends' cabins only stand while they're playing with you.
      for (const p of save.placed) if (p.kind !== 'cabin' || this.coop) this.build.place(p.kind, p.tx, p.ty, p.items, p.machine, p.hay);
      this.farming.restore(save.farm);
      if (!this.coop) this.orchard.restore(save.orchard);
    } else {
      this.build.place('cottage', this.world.home.tx, this.world.home.ty);
      const mailbox = mailboxTile(this.world);
      if (!this.resources.isBlocked(mailbox.tx, mailbox.ty)) this.build.place('mailbox', mailbox.tx, mailbox.ty);
      const bin = shippingBinTile(this.world);
      if (!this.resources.isBlocked(bin.tx, bin.ty)) this.build.place('shipping_bin', bin.tx, bin.ty);
      this.prepareStarterPlot();
    }
    if (!this.build.at(this.world.home.tx, this.world.home.ty)) this.build.place('cottage', this.world.home.tx, this.world.home.ty);
    this.farming.setShelter((tx, ty) => this.build.isSheltered(tx, ty));
    const box = mailboxTile(this.world);
    // Older saves: make room for the shipping bin (an empty plot, grass or a bush gives way).
    const binTile = shippingBinTile(this.world);
    if (!this.build.at(binTile.tx, binTile.ty)) {
      const binPlot = this.farming.plotAt(binTile.tx, binTile.ty);
      if (binPlot && !binPlot.crop) this.farming.untill(binPlot);
      if (!this.farming.isTilled(binTile.tx, binTile.ty)) {
        this.resources.clearArea({ x0: binTile.tx, y0: binTile.ty, x1: binTile.tx, y1: binTile.ty });
        this.build.place('shipping_bin', binTile.tx, binTile.ty);
      }
    }
    // Older saves: an empty starter-plot tile on the mailbox's spot gives way to it.
    const boxPlot = this.farming.plotAt(box.tx, box.ty);
    if (boxPlot && !boxPlot.crop && !this.build.at(box.tx, box.ty)) this.farming.untill(boxPlot);
    if (!this.build.at(box.tx, box.ty) && !this.resources.isBlocked(box.tx, box.ty) && !this.farming.isTilled(box.tx, box.ty)) {
      this.build.place('mailbox', box.tx, box.ty);
    }
    this.build.refreshMachines(gameTime(this.time_.day, this.time_.minute));
    if (this.weather.isWet) this.farming.waterAll();

    this.animals = new AnimalSystem(
      this,
      this.world,
      (tx, ty) => this.resources.isBlocked(tx, ty) || this.build.isBlocked(tx, ty) || this.farming.isTilled(tx, ty),
      this.drops,
      fx,
    );
    this.animals.spawnRabbits(14);
    this.livestock = new LivestockSystem(this, fx, (tx, ty) => {
      const t = terrainAt(this.world, tx, ty);
      return (t === Terrain.Grass || t === Terrain.Path) && !this.resources.isBlocked(tx, ty) && !this.build.isBlocked(tx, ty) && !this.farming.isTilled(tx, ty);
    });
    this.livestock.restore(save?.livestock);
    this.cabins = (save?.cabins ?? []).map((c) => ({ ...c }));
    this.community = structuredClone(save?.community ?? {});
    if (save?.interior) this.interior = structuredClone(save.interior);
    const fg = this.forestGate();
    this.add
      .image((fg.tx + 0.5) * GAME_CONFIG.tileSize, fg.ty * GAME_CONFIG.tileSize, TEXTURES.signpost)
      .setOrigin(0.5, 1)
      .setFlipX(true)
      .setDepth(fg.ty * GAME_CONFIG.tileSize);
    this.decorateCarnivalEntrance();
    this.decorateBridges();
    this.chimneySmoke();
    this.decorateMine();
    this.decorateLots(obstacles);
    const gate = this.beachGate();
    this.signpost = this.add
      .image((gate.tx + 0.5) * GAME_CONFIG.tileSize, gate.ty * GAME_CONFIG.tileSize, TEXTURES.signpost)
      .setOrigin(0.5, 1)
      .setDepth(gate.ty * GAME_CONFIG.tileSize);
    for (const c of save?.chickens ?? []) this.animals.addChicken(c.x, c.y, { x: c.homeX, y: c.homeY }, c.kind);

    this.npcs = new NpcSystem(this, this.world, this.homeDoors());
    this.social = new Social(() => this.onSocialChange());
    this.social.restore(save?.social);
    this.freight.restore(save?.social?.freight);
    this.freightClock = '';
    this.freightGoods = null;
    skills.load(save?.social?.skills);
    daily.attach({
      giveGold: (n) => this.state.receiveGold(n),
      giveItem: (itemId, quantity) => {
        const left = this.state.inventory.add(itemId, quantity);
        if (left > 0) this.drops.spawn(itemId, left, this.player.x, this.player.y - 4);
      },
      lucky: () => this.state.addBuff('luck', 8 * 60),
    });
    daily.load(save?.social?.daily);
    skills.onLevel = (id, level) => this.skillLevelUp(id, level);
    skills.onChange = () => {
      if (this.panel === 'collection') this.emitCollection();
    };
    this.collection.restore(save?.collection);
    if (this.social.letters.length === 0) {
      this.social.send(
        this.time_.day,
        'Mira',
        'Welcome to the valley!',
        "Welcome, neighbour! The market's just west of your cottage — come say hello to everyone. Here are a few seeds to get you started. Check this mailbox now and then; we'll write.",
        { itemId: 'carrot_seeds', quantity: 5 },
      );
    }
    // Point everyone (old saves too) at the mine and the beach once.
    if (!this.social.letters.some((l) => l.subject === 'Places worth a visit')) {
      const { home, mine } = this.world;
      const dx = mine.tx - home.tx;
      const dy = mine.ty - home.ty;
      const ns = dy < -4 ? 'north' : dy > 4 ? 'south' : '';
      const ew = dx > 4 ? 'east' : dx < -4 ? 'west' : '';
      const way = ns && ew ? `${ns}-${ew}` : ns || ew || 'near';
      this.social.send(
        this.time_.day,
        'Bram',
        'Places worth a visit',
        `The old mine is ${way === 'near' ? 'close by' : `${way} of your cottage`}, about ${Math.round(Math.hypot(dx, dy))} steps — look for the stone steps going underground between two timber posts (there's a lamp and an ore cart) and press E at them. Ore gets better the deeper you go. And if you follow the path all the way east, there's a signpost to the beach. Open your map (M) to see both.`,
        { itemId: 'sword', quantity: 1 },
      );
    }
    this.npcs.setWeather(this.weather.current);
    this.quests = new Quests(this.seed);
    this.quests.restore(save?.quests, this.time_.day, this.time_.season);
    this.fishing = new FishingSystem(this, this.player, this.state, this.drops, fx);
    this.fishing.isHeld = () => this.controls.useHeld();
    this.ambient = new AmbientLifeSystem(this, this.world);
    this.ecosystem = new EcosystemSystem(this, this.seed, this.world, this.farming, this.build, this.animals);
    this.farming.setPollinators((tx, ty) => this.ecosystem.pollinated(tx, ty, this.time_.season));

    new WaterGlintSystem(this, this.world);
    this.lighting = new LightingSystem(this);
    this.audio = new AudioSystem(this);
    bindAudio(this.audio);
    this.applySeasonTint();
    // A save made while standing on old winter ice: step back onto dry land.
    {
      const size = GAME_CONFIG.tileSize;
      if (terrainAt(this.world, Math.floor(this.player.x / size), Math.floor(this.player.y / size)) === Terrain.Water) {
        const door = this.doorPosition();
        this.player.placeAt(door.x, door.y, 'down');
      }
    }

    this.interaction = new InteractionSystem(this, {
      orchard: this.orchard,
      coop: !!this.coop,
      world: this.world,
      player: this.player,
      state: this.state,
      resources: this.resources,
      farming: this.farming,
      build: this.build,
      animals: this.animals,
      npcs: this.npcs,
      drops: this.drops,
      fx,
      fishing: this.fishing,
      social: this.social,
      authority: this.authority,
      livestock: this.livestock,
      calendar: () => ({ day: this.time_.day, minute: this.time_.minute, season: this.time_.season, weather: this.weather.current }),
      openShop: (npcId) => this.openShop(npcId),
      openBoard: () => this.openBoard(),
      boardRequests: () => this.quests.openCount(),
      talkTo: (npc) => this.talkTo(npc),
      giveGift: (npcId, slot) => this.giveGift(npcId, slot),
      rest: () => this.rest(),
      enterMine: () => this.openMineEntrance(),
      enterBeach: () => this.enterBeach(),
      enterCottage: () => this.enterCottage(),
      beachGate: this.beachGate(),
      forestGate: this.forestGate(),
      carnivalGate: this.carnivalGate(),
      enterCarnival: () => this.enterCarnival(),
      landmark: (tx, ty) => this.landmarkAction(tx, ty),
      releaseHorse: (x, y) => this.releaseHorse(x, y),
      petAction: (x, y) => this.petAction(x, y),
      homeAction: (placed) => {
        const mine = this.myCabin();
        if (placed.kind === 'cabin') {
          if (mine && mine.tx === placed.tx && mine.ty === placed.ty) return { verb: 'Go inside your cabin', run: () => this.enterCottage() };
          const owner = this.cabins.find((c) => c.tx === placed.tx && c.ty === placed.ty);
          return { verb: `${owner?.name ?? 'A friend'}'s cabin`, info: true, run: () => gameEvents.emit('toast', { text: `This is ${owner?.name ?? 'a friend'}'s cabin.` }) };
        }
        // Guests sleep in their own cabin; the farmhouse belongs to the host.
        if (mine) return { verb: 'The farmhouse', info: true, run: () => gameEvents.emit('toast', { text: 'This is the host’s farmhouse. Your cabin is nearby — check the map.' }) };
        return null;
      },
      enterForest: () => this.enterForest(),
      houseLevel: () => this.interior.level,
      upgradeHouse: () => this.upgradeHouse(),
      openShipping: () => this.openShipping(),
      shipSlot: (slot) => this.shipSlot(slot),
      openMail: () => {
        this.emitMail();
        this.emitSeeds();
        this.setPanel('mail');
      },
      openChest: (placed: Placed) => {
        this.build.openChestUi(placed);
        this.setPanel('chest');
      },
      sleep: () => this.goToSleep(false),
      say: (speaker, text) => {
        gameEvents.emit('dialogue', { speaker, text });
        this.setPanel('dialogue');
      },
    });

    this.physics.add.collider(this.player.sprite, ground);
    this.physics.add.collider(this.player.sprite, obstacles);

    this.controls = new InputSystem(this);
    new CameraSystem(this, this.player.sprite, worldWidth, worldHeight);

    // Developer aid: toggle collision-box rendering with the backtick key.
    this.input.keyboard?.on('keydown-BACKTICK', this.toggleCollisionDebug, this);
    this.input.keyboard?.on('keydown-M', (e: KeyboardEvent) => {
      if (e.shiftKey) this.audio.toggleMute();
    });

    // Sync dependent visuals after Arcade Physics has moved bodies this frame.
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.lateUpdate, this);

    // Save when the tab is hidden or closed.
    const saveOnHide = () => {
      if (document.visibilityState === 'hidden') this.saveGame(false, true);
    };
    const saveOnExit = () => this.saveGame(false, true);
    document.addEventListener('visibilitychange', saveOnHide);
    window.addEventListener('pagehide', saveOnExit);

    this.waypoint = new WaypointSystem(this, this.world, (x, y) => this.resources.isBlocked(x, y) || this.build.isBlocked(x, y));
    gameEvents.emit('waypoint:info', null);
    this.pets = new PetSystem(this, () => this.doorPosition());
    this.horse = new HorseSystem(this, this.player);
    this.sky = new SkyEventsSystem(
      this,
      () => {
        const tree = this.resources.randomTreeIn(this.cameras.main.worldView);
        return tree ? { x: tree.x, top: tree.baseY - 44, base: tree.baseY } : null;
      },
      (x, base) => this.lightningHit(x, base),
    );
    this.horse.show(save?.social?.horse);
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, (_t: number, d: number) => this.horse.update(d));
    // A stray cat and dog turn up on day 2 (or right away in an older save).
    if (!this.social.petOffered && this.time_.day >= 2 && (!this.social.pet || !this.social.pet2)) this.offerPet();
    this.showPets();
    const unsubscribe = this.bindCommands();
    const offInventory = gameEvents.on('inventory:changed', (snap) => {
      this.noteFinds(snap.slots);
      // The seed exchange lists the heirloom seeds you carry.
      if (this.panel === 'mail') this.emitSeeds();
      if (snap.slots.some((x) => x?.q === 2)) this.social.mark('gold_crop');
    });
    const offFloor = gameEvents.on('mine:floor', (f) => {
      if (f) {
        this.mineFloor = f.floor;
        daily.note('mine', f.floor);
      }
    });
    const offCollected = gameEvents.on('item:collected', ({ itemId, quantity }) => daily.collected(itemId, quantity));
    this.time.delayedCall(1800, () => this.rollDaily());
    this.noteFinds(this.state.inventory.snapshot().slots);
    this.collectionReady = true;
    this.time.addEvent({ delay: 1500, loop: true, callback: () => this.checkAchievements() });
    this.time.delayedCall(800, () => this.emitTutorial());
    if (this.coop) this.startCoop(this.coop);
    // Restarting the scene fires SHUTDOWN; destroying the whole game fires DESTROY. Clean up once on either.
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      this.netOffs.forEach((off) => off());
      this.netOffs = [];
      this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.lateUpdate, this);
      document.removeEventListener('visibilitychange', saveOnHide);
      window.removeEventListener('pagehide', saveOnExit);
      unsubscribe();
      offInventory();
      offFloor();
      offCollected();
      unbindAudio(this.audio);
      this.audio.destroy();
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);

    gameEvents.emit('world:ready', {
      seed: this.seed,
      widthTiles,
      heightTiles,
      objectCount: this.world.objects.length,
    });
    this.state.emitAll();
    this.emitTime();
    this.emitSaveInfo();
    this.audio.emit();
    gameEvents.emit('ui:panel', { panel: null });
    this.startFestival();
    this.onSocialChange();
    if (this.coop?.morning) {
      this.wakeUpTogether(this.coop.morning.passedOut);
      this.petMorning();
      this.placesMorning();
      this.meteorMorning();
      this.birthdayMorning();
      this.romanceMorning();
      const shipped = this.coop.morning.shipped;
      this.time.delayedCall(900, () => this.showSummary(shipped));
    }
    else if (this.coop) gameEvents.emit('toast', { text: `Joined ${this.coop.session.join.room.hostName}'s world. Day ${this.time_.dayOfSeason} of ${this.time_.season}.` });
    else if (save) gameEvents.emit('toast', { text: `Welcome back! Day ${this.time_.dayOfSeason} of ${this.time_.season}.` });
  }

  update(_time: number, delta: number): void {
    const actions = this.controls.getActions();
    const inventory = this.state.inventory;

    if (actions.hotbar !== null) inventory.select(actions.hotbar);
    if (actions.close) this.setPanel(this.panel ? null : 'menu');
    if (actions.toggleInventory) this.togglePanel('inventory');
    if (actions.toggleCrafting) {
      gameEvents.emit('crafting:open', null);
      this.togglePanel('crafting');
    }
    if (actions.toggleCollection) this.togglePanel('collection');
    if (actions.toggleJournal) this.togglePanel('journal');
    if (actions.toggleCalendar) this.togglePanel('calendar');
    if (actions.toggleMinimap) {
      const on = !settings.get().minimap;
      settings.set({ minimap: on });
      gameEvents.emit('toast', { text: on ? `Minimap on (${keyLabel(settings.get().keys.minimap)} to hide)` : `Minimap hidden (${keyLabel(settings.get().keys.minimap)} to show)` });
    }
    this.minimapTick(delta);
    if (actions.toggleEmotes && !this.panel) this.toggleEmotePicker();
    if (actions.petStay && !this.panel) this.togglePetStay();
    if (actions.horse && !this.panel && !this.away && !this.sleeping) this.horseKey();
    if (actions.toggleMap && this.away) gameEvents.emit('toast', { text: "There's no map of the mine." });
    else if (actions.toggleMap) {
      if (this.panel === 'map') this.setPanel(null);
      else if (!this.panel || this.panel === 'inventory' || this.panel === 'crafting') this.openMap();
    }
    if (this.panel === 'dialogue' && (actions.use || actions.interact)) this.nextLine();

    const frozen = this.panel !== null || this.sleeping;
    // Alone, menus pause the world; in co-op the server's clock keeps running.
    this.time_.running = this.coop ? true : !frozen;
    if (this.coop && this.inBed) {
      const intent = this.controls.getMoveIntent();
      if (intent.x !== 0 || intent.y !== 0) this.leaveBed();
    }
    if (frozen) {
      this.player.stop();
    } else if (this.away) {
      // In the mine: that scene moves the player and handles Use/Interact.
      if (actions.cycle !== 0) inventory.cycle(actions.cycle);
      if (actions.eat) this.interaction.eatSlot(inventory.selected);
      this.player.stop();
    } else {
      if (actions.cycle !== 0) inventory.cycle(actions.cycle);
      if (actions.use) {
        // Tools need both feet on the ground.
        if (this.horse.riding) this.horse.dismount();
        this.interaction.use();
      } else if (actions.interact) this.interaction.interact();
      else if (actions.eat) this.interaction.eatSlot(inventory.selected);
      const intent = this.controls.getMoveIntent();
      // Walking away reels the line in.
      if (this.fishing.active && (intent.x !== 0 || intent.y !== 0)) this.fishing.cancel();
      this.player.update(intent);
      if (intent.x || intent.y) this.walked += delta;
    }

    this.cullTimer -= delta;
    if (this.cullTimer <= 0 && !this.away) {
      this.cullTimer = 250;
      const v = this.cameras.main.worldView;
      this.resources.cull({ x: v.x, y: v.y, right: v.right, bottom: v.bottom });
    }
    const windy = this.weather.current === 'rain' || this.weather.current === 'snow' ? 2.2 : 1;
    if (!this.away) this.farming.sway(this.time.now, windy);
    this.time_.speed = this.coop ? 1 : DAY_LENGTHS[settings.get().dayLength].speed;
    this.state.setClock(gameTime(this.time_.day, this.time_.minute));
    this.player.speedBoost = (this.state.hasBuff('speed') ? 1.25 : 1) * (this.horse.riding ? HORSE_SPEED : 1);
    if (this.horse.riding && (this.sleeping || this.away)) this.horse.dismount();
    this.time_.update(delta);
    this.drops.update(delta, this.player.x, this.player.y, inventory);
    if (!this.away) this.waypoint.update(delta, this.player.x, this.player.y);
    const lateNight = this.time_.minute >= 22 * 60;
    if (!frozen) this.petDigging(delta);
    this.skyTick(delta);
    if (this.away || this.sleeping) this.pets.cancelTask();
    this.pets.update(delta, this.player, { follow: this.social.allPets.length > 0 && !this.away && !this.sleeping, sleep: lateNight || this.away });
    const area = !this.away ? 'world' : this.awayKey === SCENES.Carnival ? 'carnival' : this.awayKey === SCENES.Forest || this.awayKey === SCENES.Island ? 'forest' : this.awayKey === SCENES.Mine ? 'mine' : 'quiet';
    this.audio.update(delta, { minute: this.time_.minute, weather: this.weather.current, season: this.time_.season, area, floor: this.mineFloor });
    this.playFootsteps(delta, frozen);
    const night = LightingSystem.darkness(this.time_.minute) > 0.5;
    if (!frozen) {
      this.animals.update(delta, this.player.x, this.player.y, night);
      this.livestock.update(delta, night);
      this.npcs.update(delta, this.time_.minute, { x: this.player.x, y: this.player.y });
      this.fishing.update(delta);
    }
    if (this.coop) this.coopUpdate(delta);
    // Walking south through the carnival arch takes you straight in.
    if (!this.away && !frozen && this.player.velocityY > 0) {
      const gate = this.carnivalGate();
      const { tx, ty } = this.player.tile;
      if (ty === gate.ty && Math.abs(tx - gate.tx) <= 1) this.enterCarnival();
    }
    if (!frozen || this.coop) {
      this.train?.update(delta, { minute: this.time_.minute, day: this.time_.day, player: this.player, away: this.away });
      this.freightTick();
      this.ghost?.update(this.time_.minute, { x: this.player.x, y: this.player.y }, this.away);
      this.nightMarket?.update(this.marketOpenNow(), this.away, { x: this.player.x, y: this.player.y });
      this.nightMarketNote();
      this.heirloomLetters();
    }
    this.ecosystem.update(delta, { minute: this.time_.minute, season: this.time_.season, weather: this.weather.current, away: this.away });
    this.ambient.update(delta, {
      player: { x: this.player.x, y: this.player.y },
      minute: this.time_.minute,
      season: this.time_.season,
      weather: this.weather.current,
      darkness: LightingSystem.darkness(this.time_.minute),
    });

    this.fpsElapsed += delta;
    if (this.fpsElapsed >= 500) {
      this.fpsElapsed = 0;
      gameEvents.emit('perf:fps', { fps: this.game.loop.actualFps });
    }
  }

  private lateUpdate(): void {
    this.player.lateUpdate();
    this.occlusion.update(this.player.x, this.player.y);
    if (!this.away) this.interaction.update(this.panel === null && !this.sleeping);

    const lights = this.build.lights();
    for (const d of this.decorations) if (d.getData('light')) lights.push({ x: d.x, y: d.y - 4, radius: 34 });
    lights.push(...this.propLights);
    lights.push(...this.windowLights());
    const ghostLight = this.ghost?.light();
    if (ghostLight) lights.push(ghostLight);
    if (this.nightMarket) lights.push(...this.nightMarket.lights());
    if (LightingSystem.darkness(this.time_.minute) > 0.3) lights.push({ x: this.player.x, y: this.player.y - 10, radius: 40 });
    this.lighting.update(this.time_.minute, this.weather.current, lights);

    const { tx, ty } = this.player.tile;
    const tileKey = ty * this.world.width + tx;
    if (tileKey !== this.lastTileKey) {
      this.lastTileKey = tileKey;
      this.rustle.onPlayerEnterTile(tx, ty, this.player.velocityX);
      const terrain = terrainAt(this.world, tx, ty);
      if (terrain >= 0) gameEvents.emit('player:tile', { tx, ty, terrain: TERRAIN_NAMES[terrain as TerrainType] });
    }
  }

  /** New games start with a small tilled plot near the cottage, ready for seeds. */
  private prepareStarterPlot(): void {
    const { home } = this.world;
    const free = (tx: number, ty: number) =>
      this.farming.canTill(tx, ty) && !this.resources.isBlocked(tx, ty) && !this.build.isBlocked(tx, ty);
    // Search outward from beside the cottage for a clear 3x3 patch.
    for (let r = 0; r <= 6; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x0 = home.tx + 4 + dx;
          const y0 = home.ty + dy;
          let ok = true;
          for (let y = y0; y < y0 + 3 && ok; y++) for (let x = x0; x < x0 + 3 && ok; x++) ok = free(x, y);
          if (!ok) continue;
          for (let y = y0; y < y0 + 3; y++) for (let x = x0; x < x0 + 3; x++) this.farming.till(x, y, true);
          return;
        }
      }
    }
  }

  /** Today's goals (rolled once a day; on load it just re-shows the current ones). */
  private rollDaily(): void {
    const line = daily.roll({
      seed: this.seed,
      day: this.time_.day,
      season: this.time_.season,
      raining: this.weather.isWet,
      crops: this.farming.markers().filter((p) => p.crop).length,
      hasRod: this.state.inventory.count('fishing_rod') > 0,
      mineDepth: this.state.mineDepth,
    });
    if (line) gameEvents.emit('toast', { text: line });
  }

  private minimapAt = 0;
  private minimapBaseAt = 0;
  private minimapAway = false;

  /** Feeds the corner minimap: its picture every 20 seconds, and where everything is several times a second. */
  private minimapTick(delta: number): void {
    if (!settings.get().minimap) {
      this.minimapBaseAt = 0;
      return;
    }
    if (this.away) {
      if (!this.minimapAway) gameEvents.emit('minimap:state', null);
      this.minimapAway = true;
      this.minimapBaseAt = 0;
      return;
    }
    this.minimapAway = false;
    const now = this.time.now;
    if (now >= this.minimapBaseAt) {
      this.minimapBaseAt = now + 20_000;
      this.emitMinimapBase();
    }
    this.minimapAt -= delta;
    if (this.minimapAt > 0) return;
    this.minimapAt = 150;
    const S = MAP_SCALE / GAME_CONFIG.tileSize;
    const at = (p: { x: number; y: number }) => ({ x: p.x * S, y: p.y * S });
    type Dot = { x: number; y: number; kind: 'npc' | 'pet' | 'horse' | 'friend' | 'train' };
    const dots: Dot[] = this.npcs.positions().map((p) => ({ ...at(p), kind: 'npc' as const }));
    for (const pet of this.social.allPets) {
      const p = this.pets.position(pet.kind);
      if (p) dots.push({ ...at(p), kind: 'pet' });
    }
    const horse = this.horse.exists && !this.horse.riding ? this.horse.toSave() : undefined;
    if (horse) dots.push({ ...at(horse), kind: 'horse' });
    for (const p of this.remotes?.positions() ?? []) dots.push({ ...at(p), kind: 'friend' });
    const train = this.train?.position();
    if (train) dots.push({ ...at(train), kind: 'train' });
    const wp = this.waypoint.active;
    gameEvents.emit('minimap:state', {
      player: at(this.player),
      facing: this.player.facingDirection as 'up' | 'down' | 'left' | 'right',
      waypoint: wp ? { x: (wp.tx + 0.5) * MAP_SCALE, y: (wp.ty + 0.5) * MAP_SCALE } : null,
      dots,
    });
  }

  private emitMinimapBase(): void {
    const canvas = drawWorldMap(this.world, {
      season: this.time_.season,
      objects: this.resources.markers(),
      placed: this.build.serialize().map(({ kind, tx, ty }) => ({ kind, tx, ty })),
      plots: this.farming.markers(),
      orchard: this.orchard.markers(),
      people: [],
      chickens: [],
      rail: this.lots().rail,
      graveyard: this.lots().graveyard ? { x0: this.lots().graveyard!.tx, y0: this.lots().graveyard!.ty - 4, x1: this.lots().graveyard!.tx + 6, y1: this.lots().graveyard!.ty } : null,
    });
    const S = MAP_SCALE;
    const t = (tx: number, ty: number) => ({ x: tx * S, y: ty * S });
    const icons: { icon: string; x: number; y: number }[] = [
      { icon: '🏡', ...t(this.world.home.tx + 1.5, this.world.home.ty) },
      { icon: '⛏', ...t(this.world.mine.tx + 1, this.world.mine.ty) },
      { icon: '🌲', ...t(this.forestGate().tx + 1, this.forestGate().ty) },
      { icon: '🏖', ...t(this.beachGate().tx, this.beachGate().ty) },
      { icon: '🎡', ...t(this.carnivalGate().tx + 0.5, this.carnivalGate().ty + 1) },
      { icon: '🛒', ...t((this.world.market.x0 + this.world.market.x1) / 2, this.world.market.y1) },
    ];
    const lots = this.lots();
    if (lots.museum) icons.push({ icon: '🏛', ...t(lots.museum.tx + 2.5, lots.museum.ty - 1) });
    if (lots.graveyard) icons.push({ icon: '🪦', ...t(lots.graveyard.tx + 3.5, lots.graveyard.ty - 2) });
    if (lots.depot && this.train) icons.push({ icon: '🚉', ...t(lots.depot.tx + 1.5, lots.depot.ty) });
    for (const id of NPC_IDS) {
      const lot = lots.homes[id];
      if (lot) icons.push({ icon: '🏠', ...t(lot.tx + 1.5, lot.ty - 1) });
    }
    gameEvents.emit('minimap:base', { url: canvas.toDataURL(), width: canvas.width, height: canvas.height, scale: S, icons });
  }

  /** Renders the world map from the current state and opens it. */
  private openMap(): void {
    const canvas = drawWorldMap(this.world, {
      season: this.time_.season,
      objects: this.resources.markers(),
      placed: this.build.serialize().map(({ kind, tx, ty }) => ({ kind, tx, ty })),
      plots: this.farming.markers(),
      orchard: this.orchard.markers(),
      people: [...this.npcs.positions(), ...(this.remotes?.positions() ?? [])],
      chickens: this.animals.serializeChickens(),
      rail: this.lots().rail,
      graveyard: this.lots().graveyard ? { x0: this.lots().graveyard!.tx, y0: this.lots().graveyard!.ty - 4, x1: this.lots().graveyard!.tx + 6, y1: this.lots().graveyard!.ty } : null,
    });
    const toMap = (x: number, y: number) => ({ x: (x / GAME_CONFIG.tileSize) * MAP_SCALE, y: (y / GAME_CONFIG.tileSize) * MAP_SCALE });
    const { home } = this.world;
    gameEvents.emit('map:image', {
      url: canvas.toDataURL(),
      width: canvas.width,
      height: canvas.height,
      player: toMap(this.player.x, this.player.y),
      home: toMap((home.tx + 1.5) * GAME_CONFIG.tileSize, home.ty * GAME_CONFIG.tileSize),
      tiles: { width: this.world.width, height: this.world.height },
      waypoint: this.waypoint.active ? toMap((this.waypoint.active.tx + 0.5) * GAME_CONFIG.tileSize, (this.waypoint.active.ty + 0.5) * GAME_CONFIG.tileSize) : null,
      route: this.waypoint.route.map(([tx, ty]) => toMap((tx + 0.5) * GAME_CONFIG.tileSize, (ty + 0.5) * GAME_CONFIG.tileSize)),
      places: [
        { label: '⛏ Mine', ...toMap((this.world.mine.tx + 1) * GAME_CONFIG.tileSize, this.world.mine.ty * GAME_CONFIG.tileSize) },
        ...(this.myCabin() ? [{ label: '🏠 Your cabin', ...toMap((this.myCabin()!.tx + 1) * GAME_CONFIG.tileSize, this.myCabin()!.ty * GAME_CONFIG.tileSize) }] : []),
        { label: '← Forest', ...toMap((this.forestGate().tx + 1.5) * GAME_CONFIG.tileSize, this.forestGate().ty * GAME_CONFIG.tileSize) },
        { label: '🎡 Carnival', ...toMap((this.carnivalGate().tx + 0.5) * GAME_CONFIG.tileSize, (this.carnivalGate().ty + 1) * GAME_CONFIG.tileSize) },
        { label: 'Beach →', ...toMap((this.beachGate().tx + 0.5) * GAME_CONFIG.tileSize, this.beachGate().ty * GAME_CONFIG.tileSize) },
        ...(this.horse.exists && !this.horse.riding ? [{ label: `🐴 ${this.horse.name}`, ...toMap(this.horse.toSave()!.x, this.horse.toSave()!.y) }] : []),
        ...(this.lots().rail !== null ? [{ label: '🚂 Railway', ...toMap(14 * GAME_CONFIG.tileSize, this.lots().rail! * GAME_CONFIG.tileSize) }] : []),
        ...(this.lots().depot && this.train ? [{ label: '🚉 Freight depot', ...toMap((this.lots().depot!.tx + 1.5) * GAME_CONFIG.tileSize, this.lots().depot!.ty * GAME_CONFIG.tileSize) }] : []),
        ...(this.lots().graveyard ? [{ label: '🪦 Graveyard', ...toMap((this.lots().graveyard!.tx + 3.5) * GAME_CONFIG.tileSize, (this.lots().graveyard!.ty - 4) * GAME_CONFIG.tileSize) }] : []),
        ...(this.lots().museum ? [{ label: '🏛 Museum', ...toMap((this.lots().museum!.tx + 2.5) * GAME_CONFIG.tileSize, (this.lots().museum!.ty - 1) * GAME_CONFIG.tileSize) }] : []),
        ...NPC_IDS.flatMap((id) => {
          const lot = this.lots().homes[id];
          return lot ? [{ label: `🏠 ${NPCS[id].name}`, ...toMap((lot.tx + 1.5) * GAME_CONFIG.tileSize, (lot.ty - 1) * GAME_CONFIG.tileSize) }] : [];
        }),
      ],
    });
    this.setPanel('map');
  }

  /** Soft footsteps whose sound depends on the ground underfoot. */
  private playFootsteps(delta: number, frozen: boolean): void {
    const v = this.player.sprite.body.velocity;
    const speed = Math.hypot(v.x, v.y);
    if (frozen || speed < 1) {
      this.stepTimer = 0;
      return;
    }
    this.stepTimer -= delta;
    if (this.stepTimer > 0) return;
    const running = speed > GAME_CONFIG.player.walkSpeed + 5;
    this.stepTimer = running ? 200 : 290;
    const { tx, ty } = this.player.tile;
    const terrain = terrainAt(this.world, tx, ty);
    const onFloor = this.build.at(tx, ty);
    const wooden = terrain === Terrain.Bridge || onFloor?.kind === 'wood_path';
    const hard = terrain === Terrain.Path || onFloor?.kind === 'stone_path';
    const rate = wooden ? 0.65 : hard ? 1.35 : 1;
    sfx('step', { volume: this.time_.season === 'winter' && terrain === Terrain.Grass ? 0.5 : 0.35, rate, vary: 0.15 });
  }

  // ---------- Time ----------

  private onClockTick(): void {
    this.state.emitBuffs();
    if (this.time_.minute % 60 === 0) this.runCollectors();
    this.build.refreshMachines(gameTime(this.time_.day, this.time_.minute));
    if (this.weather.isWet) this.farming.waterAll();
    if (this.panel === 'shop' && this.shopNpc && !this.npcs.isPresent(this.shopNpc, this.time_.minute)) {
      gameEvents.emit('toast', { text: `${NPCS[this.shopNpc].name} is closing up for the day.` });
      this.setPanel(null);
    }
    this.emitTime();
  }

  /** Bedtime (or collapsing at 2am): fade out, start a new day at home, save, fade in. */
  private goToSleep(passedOut: boolean): void {
    if (this.away) this.leaveArea('quiet');
    if (this.coop) {
      this.enterBed();
      return;
    }
    if (this.sleeping) return;
    this.sleeping = true;
    this.setPanel(null);
    sfx('sleep');
    const camera = this.cameras.main;
    camera.fadeOut(700, 0, 0, 0);
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const previousSeason = this.time_.season;
      const shipped = this.state.sellBin();
      this.state.clearBuffs();
      this.time_.startNewDay();
      const season = this.time_.season;
      const seasonChanged = season !== previousSeason;
      this.weather.set(this.weather.forecast(this.time_.day));

      const withered = this.farming.onNewDay(season, seasonChanged, this.weather.isWet);
      this.orchard.onNewDay();
      this.time.delayedCall(2600, () => this.rollDaily());
      this.resources.onNewDay(this.time_.day, season);
      // The night's wildlife (solo farms; the co-op farm is the server's): deer at the crops, a fox at the coop.
      const dawn = this.ecosystem.dawn(this.time_.day, season, this.social.allPets.some((p) => p.kind === 'dog'));
      this.animals.onNewDay(new Set(dawn.spooked));
      this.livestock.morning(this.build.ofKind('barn'));
      siloRefill([...this.build.ofKind('silo'), ...this.build.ofKind('barn')]);
      this.npcs.setWeather(this.weather.current);
      this.deliverMail();
      this.petMorning();
      this.placesMorning();
      this.meteorMorning();
      this.birthdayMorning();
      this.romanceMorning();
      this.spawnWildForage();
      this.startFestival();
      const sprinkled = this.runSprinklers();
      const collected = this.runCollectors();
      this.quests.setDay(this.time_.day, season);
      if (seasonChanged) {
        this.applySeasonTint();
      }

      const { passOutRestore } = GAME_CONFIG.energy;
      this.state.setEnergyFraction(passedOut ? passOutRestore : 1);
      this.state.heal(this.state.maxHealth);
      const door = this.doorPosition();
      this.player.placeAt(door.x, door.y, 'down');
      this.time_.running = true;
      this.emitTime();
      this.saveGame(false);

      this.time.delayedCall(250, () => {
        camera.fadeIn(700, 0, 0, 0);
        this.sleeping = false;
        sfx('morning');
        const day = `Day ${this.time_.dayOfSeason} of ${season}`;
        if (passedOut) gameEvents.emit('toast', { text: `You passed out and woke up at home, still tired. ${day}.` });
        else gameEvents.emit('toast', { text: `Good morning! ${day}, ${this.weather.current}.` });
        if (seasonChanged) gameEvents.emit('toast', { text: `${season[0].toUpperCase()}${season.slice(1)} has arrived!` });
        if (withered > 0) gameEvents.emit('toast', { text: `${withered} out-of-season crop${withered > 1 ? 's' : ''} withered.` });
        if (sprinkled > 0) gameEvents.emit('toast', { text: `Your sprinklers watered ${sprinkled} plot${sprinkled > 1 ? 's' : ''}.` });
        if (collected > 0) gameEvents.emit('toast', { text: `Your auto-collectors stored ${collected} finished good${collected > 1 ? 's' : ''}.` });
        if (this.quests.openCount() > 0) gameEvents.emit('toast', { text: 'New requests are up on the village notice board.' });
        this.wildlifeMorning(dawn);
        this.showSummary(shipped);
      });
    });
  }

  /** This player's co-op cabin (guests only). */
  private myCabin(): CabinSave | undefined {
    const self = this.coop?.session.selfId;
    return self ? this.cabins.find((c) => c.ownerId === self) : undefined;
  }

  private doorPosition(): { x: number; y: number } {
    const cabin = this.myCabin();
    if (cabin) return { x: (cabin.tx + 1) * GAME_CONFIG.tileSize, y: (cabin.ty + 1) * GAME_CONFIG.tileSize + 12 };
    const size = GAME_CONFIG.tileSize;
    return { x: (this.world.home.tx + 1) * size + size / 2, y: (this.world.home.ty + 1) * size + 12 };
  }

  /** Grass tints with the seasons; in winter it is swapped for snow-covered tiles. */
  private applySeasonTint(): void {
    const season = this.time_.season;
    const tint = GROUND_TINT[season];
    const { width, groundVariant } = this.world;
    this.ground.forEachTile((tile) => {
      const grass = tile.index < 16 || (tile.index >= TILE.SNOW_START && tile.index < TILE.SNOW_START + GRASS_VARIANTS);
      if (!grass) return;
      const v = groundVariant[tile.y * width + tile.x];
      if (season === 'winter') tile.index = TILE.SNOW_START + (v < GRASS_VARIANTS ? v : v % 4);
      else tile.index = v < GRASS_VARIANTS ? TILE.GRASS_START + v : TILE.FLOWER_START + (v - GRASS_VARIANTS);
      tile.tint = tint;
    });
    // Shores and path edges switch to the set that fades into this season's ground.
    const edges = SEASON_EDGES[season];
    this.ground.forEachTile((tile) => {
      const info = edgeTileInfo(tile.index);
      if (info) tile.index = (info.kind === 'water' ? edges.water : edges.path) + info.mask;
    });
    // Water stays water all year (it always blocks); winter just gives it a colder tint.
    const cold = season === 'winter';
    this.ground.forEachTile((tile) => {
      if (!WATER_TILE_INDICES.includes(tile.index)) return;
      tile.tint = cold ? 0xb8d4ec : 0xffffff;
      tile.setCollision(true, true, true, true, false);
    });
    this.ground.calculateFacesWithin(0, 0, this.world.width, this.world.height);
  }

  private emitTime(): void {
    gameEvents.emit('world:time', {
      day: this.time_.day,
      year: this.time_.year,
      season: this.time_.season,
      dayOfSeason: this.time_.dayOfSeason,
      minute: this.time_.minute,
      clock: formatClock(this.time_.minute),
      weather: this.weather.current,
      shopOpen: this.npcs?.isPresent('mira', this.time_.minute) ?? false,
    });
  }

  // ---------- Saving ----------

  private saveGame(announce: boolean, urgent = false): void {
    if (!this.state) return;
    if (this.coop) {
      // The server keeps the shared world; we report our own progress.
      this.reportState(true);
      if (announce) gameEvents.emit('toast', { text: 'Your progress is saved with the shared world.' });
      return;
    }
    const data = this.buildSave();
    void this.store.save(data, { urgent }).then((result) => {
      if (result.ok) this.lastSavedAt = data.savedAt;
      this.emitSaveInfo();
      if (urgent) return;
      const toast = (text: string) => gameEvents.emit('toast', { text });
      const expectsCloud = !(this.store instanceof LocalSaveStore);
      if (result.where === 'none') toast('Could not save (browser storage unavailable)');
      else if (expectsCloud && result.where === 'local') toast("Couldn't reach the server — saved in this browser for now");
      else if (announce) toast(result.where === 'cloud' ? 'Game saved to your account' : 'Game saved in this browser');
    });
  }

  /** The full current state as a save. */
  private buildSave(): SaveData {
    return {
      version: SAVE_VERSION,
      seed: this.seed,
      savedAt: Date.now(),
      time: { day: this.time_.day, minute: this.time_.minute },
      weather: this.weather.current,
      player: { ...this.state.serialize(), x: Math.round(this.player.x), y: Math.round(this.player.y), facing: this.player.facingDirection as Direction },
      resources: this.resources.serialize(),
      farm: this.farming.serialize(),
      placed: this.build.serialize().filter((p) => p.kind !== 'cottage' && p.kind !== 'mailbox' && p.kind !== 'shipping_bin' && p.kind !== 'cabin'),
      chickens: this.animals.serializeChickens(),
      livestock: this.livestock.serialize(),
      cabins: this.cabins.map((c) => ({ ...c })),
      community: structuredClone(this.community),
      collection: this.collection.serialize(),
      interior: structuredClone(this.interior),
      social: (this.rememberPetStay(), { ...this.social.serialize(), skills: skills.toSave(), horse: this.horse.toSave(), daily: daily.toSave(), freight: this.freight.toSave() }),
      quests: this.quests.serialize(),
      floor: floorItems.snapshot(),
      ...(this.coop ? {} : { orchard: this.orchard.serialize() }),
    };
  }

  /** Puts an inventory stack on the ground wherever the player is (farm or a side area). */
  private dropFromBag(slot: number, one: boolean, screen?: { x: number; y: number }): void {
    const inv = this.state.inventory;
    if (!Number.isInteger(slot) || slot < 0 || slot >= inv.slots.length || this.sleeping) return;
    const stack = inv.slots[slot];
    if (!stack) return;
    type DropTarget = { dropItem?(itemId: ItemId, quantity: number, screen?: { x: number; y: number }, q?: Quality): boolean };
    let area: DropTarget | null = null;
    if (this.away) {
      if (!this.awayKey || !this.scene.isActive(this.awayKey)) return;
      area = this.scene.get(this.awayKey) as unknown as DropTarget;
      if (!area.dropItem) return;
    }
    const { itemId } = stack;
    const q = stack.q ?? 0;
    const quantity = inv.removeAt(slot, one ? 1 : stack.quantity);
    if (quantity <= 0) return;
    const placed = area ? !!area.dropItem?.(itemId, quantity, screen, q) : (this.drops.tossFromPlayer(this.player, itemId, quantity, screen, q), true);
    if (!placed) {
      inv.add(itemId, quantity, q);
      return;
    }
    sfx('step', { rate: 1.4, volume: 0.6 });
  }

  /** Downloads the game as a save file (import it from the title screen). */
  private exportSave(): void {
    const save = this.buildSave();
    downloadSave(save);
    gameEvents.emit('toast', { text: 'Save file downloaded. Import it from the title screen on any browser.' });
  }

  private emitSaveInfo(): void {
    gameEvents.emit('save:info', { hasSave: this.lastSavedAt !== null, savedAt: this.lastSavedAt, storage: this.store.description });
  }

  // ---------- UI ----------

  private setPanel(panel: PanelId | null): void {
    if (panel === this.panel) return;
    if (panel) this.fishing?.cancel();
    // Closing the trade window (Esc, ✕) cancels the trade.
    if (this.panel === 'trade' && panel !== 'trade') this.coop?.session.send('trade:cancel');
    if (this.panel === 'shop' && panel !== 'shop') this.shopNpc = null;
    if (this.panel === 'chest') this.build.openChest = null;
    if (panel === 'collection') this.emitCollection();
    if (panel === 'calendar') gameEvents.emit('calendar:state', { day: this.time_.day });
    if (panel === 'journal') {
      this.seen.add('journal');
      this.emitJournal();
    }
    if (panel === 'inventory') this.seen.add('bag');
    if (panel === 'dialogue') sfx('talk');
    else if (panel) sfx('uiOpen');
    else if (this.panel && this.panel !== 'dialogue') sfx('uiClose');
    this.panel = panel;
    gameEvents.emit('ui:panel', { panel });
  }

  private togglePanel(panel: PanelId): void {
    this.setPanel(this.panel === panel ? null : panel);
  }

  /** Commands from the React UI. All validation happens here, not in React. */
  private bindCommands(): () => void {
    const report = (result: TxResult, success: 'coin' | 'craft' = 'coin') => {
      gameEvents.emit('toast', { text: result.message });
      sfx(result.ok ? success : 'error');
    };
    const handlers: { [K in keyof GameCommandMap]: (payload: GameCommandMap[K]) => void } = {
      'inventory:select': ({ index }) => this.state.inventory.select(index),
      'inventory:move': ({ from, to }) => this.state.inventory.move(from, to),
      craft: ({ recipeId }) => {
        const result = craft(this.state, recipeId);
        if (result.ok && findRecipe(recipeId)?.category === 'cooking') daily.note('cook');
        report(result, 'craft');
      },
      'shop:buy': ({ itemId, quantity }) => {
        const npc = this.shopNpc;
        if (this.panel !== 'shop' || !npc) return;
        report(buyFrom(this.state, npc, itemId, quantity, this.time_.season, this.social.pointsOf(npc)));
        this.emitShop();
      },
      'shop:sell': ({ slot, quantity }) => {
        const npc = this.shopNpc;
        if (this.panel !== 'shop' || !npc) return;
        report(sellTo(this.state, npc, slot, quantity, festivalOn(this.time_.day)?.id ?? null));
        this.emitShop();
      },
      'shop:barter': ({ index }) => {
        const npc = this.shopNpc;
        if (this.panel !== 'shop' || !npc) return;
        report(barterWith(this.state, npc, index), 'craft');
        this.emitShop();
      },
      'shop:gift': ({ slot }) => {
        const npc = this.shopNpc;
        if (this.panel !== 'shop' || !npc || !Number.isInteger(slot)) return;
        this.giveGift(npc, slot);
        this.emitShop();
      },
      'community:donate': ({ goal, itemId }) => this.donate(goal, itemId),
      'arc:deliver': ({ npc }) => this.deliverArc(npc),
      'carnival:open': ({ mode }) => {
        if (this.panel !== 'carnival') return;
        if (mode === 'card') this.emitCarnivalCard();
        gameEvents.emit('carnival:view', { mode });
      },
      'carnival:buy': ({ tokens }) => {
        if (this.panel !== 'carnival' || !Number.isInteger(tokens) || tokens < 1 || tokens > 100) return;
        const cost = tokens * TOKEN_PRICE;
        if (this.state.inventory.capacityFor('carnival_token') < tokens) return void gameEvents.emit('toast', { text: 'Your backpack is full.' });
        if (!this.state.spendGold(cost)) return void gameEvents.emit('toast', { text: `You need ${cost}g for ${tokens} tokens.` });
        this.state.inventory.add('carnival_token', tokens);
        sfx('coin');
        this.reportState(true);
      },
      'carnival:redeem': ({ index }) => {
        const prize = CARNIVAL_PRIZES[index];
        if (this.panel !== 'carnival' || !prize) return;
        const qty = prize.quantity ?? 1;
        if (this.state.inventory.count('prize_ticket') < prize.tickets) return void gameEvents.emit('toast', { text: `You need ${prize.tickets} prize tickets.` });
        if (this.state.inventory.capacityFor(prize.itemId) < qty) return void gameEvents.emit('toast', { text: 'Your backpack is full.' });
        this.state.inventory.remove('prize_ticket', prize.tickets);
        this.state.inventory.add(prize.itemId, qty);
        gameEvents.emit('item:collected', { itemId: prize.itemId, quantity: qty });
        sfx('sparkle');
        this.reportState(true);
      },
      'carnival:treat': ({ itemId }) => {
        const price = CARNIVAL_TREATS[itemId];
        if (this.panel !== 'carnival' || !price) return;
        if (this.state.inventory.capacityFor(itemId) < 1) return void gameEvents.emit('toast', { text: 'Your backpack is full.' });
        if (!this.state.spendGold(price)) return void gameEvents.emit('toast', { text: `That's ${price}g.` });
        this.state.inventory.add(itemId, 1);
        sfx('coin');
        this.reportState(true);
      },
      'carnival:result': ({ session, score }) => {
        const paid = this.carnivalPaid;
        if (!paid || paid.session !== session || !Number.isFinite(score)) return;
        this.carnivalPaid = null;
        const def = CARNIVAL_GAMES[paid.game];
        const clean = Math.max(0, Math.min(def.maxScore, Math.round(score)));
        const today = this.social.carnivalToday(this.time_.day);
        const notes: string[] = [];
        let tickets = def.tickets(clean);
        if (tickets > 0 && isGoldenHour(this.time_.minute)) {
          tickets *= GOLDEN_HOUR.multiplier;
          notes.push('✨ Golden hour: tickets doubled!');
        }
        const challenge = dailyChallenge(this.time_.day);
        if (!today.challenge && challenge.game === paid.game && clean >= challenge.target) {
          today.challenge = true;
          tickets += challenge.tickets;
          notes.push(`🏅 Daily challenge beaten: +${challenge.tickets} tickets!`);
        }
        if (!today.played.includes(paid.game)) today.played.push(paid.game);
        if (!today.card && CARNIVAL_GAME_IDS.every((g) => today.played.includes(g))) {
          today.card = true;
          tickets += CARD_BONUS;
          notes.push(`🎟 Carnival card complete: +${CARD_BONUS} tickets!`);
        }
        const before = today.best[paid.game] ?? 0;
        const newBest = clean > before && clean > 0;
        if (newBest) {
          today.best[paid.game] = clean;
          notes.push(before > 0 ? `⭐ New best! (was ${before})` : '⭐ Your first best score!');
        }
        if (tickets > 0) {
          const left = this.state.inventory.add('prize_ticket', tickets);
          if (left > 0) this.drops.spawn('prize_ticket', left, this.player.x, this.player.y);
          gameEvents.emit('item:collected', { itemId: 'prize_ticket', quantity: tickets });
          sfx(tickets >= 10 ? 'quest' : 'coin');
        }
        gameEvents.emit('carnival:outcome', { session, score: clean, tickets, notes, best: Math.max(before, clean), newBest });
        this.emitCarnivalCard();
        this.carnivalCheer?.(tickets);
        this.reportState(true);
      },
      'carnival:again': ({ game }) => {
        if (this.panel !== 'carnival' || !(game in CARNIVAL_GAMES)) return;
        this.carnivalPlay(game);
      },
      'pet:adopt': ({ kind, name }) => {
        if (this.panel !== 'pet' || this.social.petOf(kind) || (this.social.pet && this.social.pet2)) return;
        const clean = name.replace(/[^\p{L}\p{N} '-]/gu, '').trim().slice(0, 16) || (kind === 'cat' ? 'Whiskers' : 'Biscuit');
        const fresh = { kind, name: clean, pettedDay: 0, love: 0 };
        if (!this.social.pet) this.social.pet = fresh;
        else this.social.pet2 = fresh;
        this.social.petOffered = false;
        this.showPets();
        this.setPanel(null);
        sfx('heart');
        gameEvents.emit('toast', { text: `${clean} the ${kind} is part of the family now! Pet ${kind === 'cat' ? 'her' : 'him'} every day.` });
        this.reportState(true);
      },
      emote: ({ emote }) => {
        if (!(EMOTES as readonly string[]).includes(emote)) return;
        this.showEmote(this.player.sprite, emote);
        this.coop?.session.send('player:emote', { emote });
        this.emotePicker = false;
        gameEvents.emit('emote:picker', false);
      },
      'emote:toggle': () => this.toggleEmotePicker(),
      'tutorial:skip': () => {
        this.social.tutorial = -1;
        this.emitTutorial();
      },
      'equip:wear': ({ slot }) => {
        const id = this.state.wear(slot);
        if (id) {
          sfx('craft');
          gameEvents.emit('toast', { text: `You put on the ${ITEMS[id].name}.` });
          this.reportState(true);
        } else gameEvents.emit('toast', { text: "You can't wear that (or your backpack is full)." });
      },
      'equip:remove': ({ which }) => {
        if (!this.state.takeOff(which)) gameEvents.emit('toast', { text: 'Your backpack is full.' });
        else this.reportState(true);
      },
      'ship:add': ({ slot }) => {
        if (this.panel === 'shipping') this.shipSlot(slot);
      },
      'ship:remove': ({ index }) => {
        if (this.panel !== 'shipping') return;
        if (!this.state.unship(index)) gameEvents.emit('toast', { text: 'Your backpack is full.' });
        this.emitShipping();
      },
      'seeds:pack': ({ itemId, quantity }) => this.packSeeds(itemId, quantity),
      'seeds:redeem': ({ code }) => this.redeemSeeds(typeof code === 'string' ? code.slice(0, 64) : ''),
      'market:sell': ({ itemId, all }) => this.marketSell(itemId, all),
      'market:barter': ({ index }) => this.marketBarter(index),
      'market:buy': ({ index }) => this.marketBuy(index),
      'freight:load': ({ id }) => {
        if (this.panel !== 'freight') return;
        const result = this.freight.load(id, this.state.inventory, { day: this.time_.day, minute: this.time_.minute });
        gameEvents.emit('toast', { text: result.message });
        sfx(!result.ok ? 'error' : result.complete ? 'quest' : 'place');
        // A full order may already have its train (loaded right on the minute it leaves).
        this.freightClock = '';
        this.freightTick();
        this.showFreightGoods();
        this.emitFreight();
      },
      'board:deliver': ({ index }) => {
        if (this.panel !== 'board') return;
        const result = this.quests.deliver(index, this.state, this.social);
        gameEvents.emit('toast', { text: result.message });
        sfx(result.ok ? 'quest' : 'error');
        this.emitBoard();
      },
      'ui:open': ({ panel }) => {
        if (panel === 'map' && this.away) gameEvents.emit('toast', { text: "There's no map of the mine." });
        else if (panel === 'map') this.openMap();
        else if (panel === 'inventory' || panel === 'crafting' || panel === 'character' || panel === 'menu' || panel === 'collection' || panel === 'settings' || panel === 'journal' || panel === 'calendar') this.setPanel(panel);
      },
      'mail:read': ({ id }) => {
        this.social.markRead(id);
        this.emitMail();
      },
      'mail:claim': ({ id }) => {
        const letter = this.social.letters.find((l) => l.id === id);
        const att = letter?.attachment;
        if (!att || letter.claimed) return;
        if (this.state.inventory.capacityFor(att.itemId) < att.quantity) {
          gameEvents.emit('toast', { text: 'Make room in your backpack first.' });
          sfx('error');
          return;
        }
        if (!this.social.claim(id)) return;
        this.state.inventory.add(att.itemId, att.quantity);
        gameEvents.emit('item:collected', { itemId: att.itemId, quantity: att.quantity });
        sfx('pickup');
        this.emitMail();
      },
      'dialogue:next': () => {
        if (this.panel === 'dialogue') this.nextLine();
      },
      'festival:enter': ({ slot }) => this.enterHarvestFair(slot),
      'mine:enter': ({ floor }) => {
        if (this.panel !== 'mine' || this.away) return;
        if (!this.elevatorFloors().includes(floor)) return;
        this.enterMine(floor);
      },
      'item:eat': ({ slot }) => {
        if (Number.isInteger(slot) && !this.sleeping) this.interaction.eatSlot(slot);
      },
      'item:drop': ({ slot, one, screen }) => this.dropFromBag(slot, !!one, screen),
      'ui:close': () => this.setPanel(null),
      'chest:transfer': ({ from, slot }) => this.transferChest(from, slot),
      'appearance:set': ({ part, index }) => {
        if (this.state.setAppearancePart(part, index)) repaintPlayer(this, resolveAppearance(this.state.appearance));
      },
      'game:save': () => this.saveGame(true),
      'game:export': () => this.exportSave(),
      'waypoint:set': ({ tx, ty }) => {
        this.waypoint.set(tx, ty);
        if (this.panel === 'map') this.setPanel(null);
        gameEvents.emit('toast', { text: '📍 Follow the glowing trail.' });
      },
      'waypoint:clear': () => {
        this.waypoint.clear();
        if (this.panel === 'map') this.openMap();
      },
      'game:flush': () => this.saveGame(false, true),
      'audio:set': ({ channel, value }) => this.audio.set(channel, value),
      'audio:mute': () => this.audio.toggleMute(),
      'action:perform': ({ trigger }) => {
        if (this.panel || this.sleeping) return;
        if (trigger === 'use') this.interaction.use();
        else this.interaction.interact();
      },
      'coop:host': ({ public: isPublic }) => {
        if (this.coop) return void gameEvents.emit('toast', { text: `Friends can join with code ${this.coop.session.join.room.code}.` });
        gameEvents.emit('coop:hostRequest', { save: this.buildSave(), public: isPublic });
      },
      'coop:settings': (p) => this.coop?.session.send('room:settings', p),
      'chat:send': ({ text }) => this.coop?.session.send('chat:send', { text }),
      'input:typing': ({ typing }) => this.setTyping(typing),
      'trade:request': ({ to }) => this.coop?.session.send('trade:request', { to }),
      'trade:respond': ({ from, accept }) => this.coop?.session.send('trade:respond', { from, accept }),
      'trade:offer': (offer) => this.coop?.session.send('trade:offer', offer),
      'trade:confirm': () => this.coop?.session.send('trade:confirm'),
      'trade:cancel': () => {
        this.coop?.session.send('trade:cancel');
        if (this.panel === 'trade') this.setPanel(null);
      },
      'game:new': () => {
        if (this.coop) return void gameEvents.emit('toast', { text: "You can't restart a shared world." });
        void this.store.clear(this.seed).then(() => {
          this.lastSavedAt = null;
          gameEvents.reset();
          this.scene.restart({ seed: this.seed, save: null });
        });
      },
    };
    const offs = (Object.keys(handlers) as (keyof GameCommandMap)[]).map((name) =>
      gameCommands.on(name, handlers[name] as (payload: GameCommandMap[typeof name]) => void),
    );
    return () => offs.forEach((off) => off());
  }

  // ---------- Co-op ----------

  /** A save built from the server's shared world and this player's own progress. */
  private coopSave(coop: CoopSceneData): SaveData {
    const me: CoopPlayerState = coop.me ?? {
      player: { ...new PlayerState().serialize(), ...this.doorPosition(), facing: 'down' },
    };
    return joinSave(coop.shared, me, SAVE_VERSION, Date.now());
  }

  /** Hooks up the network: other players, the shared world, chat and trading. */
  private startCoop(coop: CoopSceneData): void {
    const { session } = coop;
    const self = session.selfId;
    const room = session.join.room;
    this.remotes = new RemotePlayerSystem(this, self);
    this.remotes.setMembers(coop.members);
    for (const d of coop.shared.drops) this.drops.spawnShared(d.id, d.itemId, d.quantity, d.x, d.y);
    this.drops.setClaimer((id, done) => this.authority.request({ t: 'drop', id }, (g) => done(g.grant ?? null), () => done(null)));
    this.player.onToolUse = (style, texture) => session.send('player:anim', { kind: style, item: texture ? (texture.replace(/^item-/, '') as ItemId) : null });

    const on: CoopSession['on'] = (event, listener) => {
      const off = session.on(event, listener);
      this.netOffs.push(off);
      return off;
    };
    on('room:members', (members) => {
      coop.members = members;
      this.remotes?.setMembers(members);
      gameEvents.emit('coop:members', members);
    });
    on('room:positions', (positions) => this.remotes?.setPositions(positions));
    on('player:anim', ({ id, kind, item }) => this.remotes?.anim(id, kind, item));
    on('player:emote', ({ id, emote }) => {
      const sprite = this.remotes?.spriteOf(id);
      if (sprite) this.showEmote(sprite, emote);
    });
    on('player:correct', ({ x, y }) => this.player.placeAt(x, y, this.player.facingDirection));
    on('world:op', ({ op }) => this.applyRemoteOp(op));
    on('world:chest', ({ tx, ty, items }) => this.build.setChestItems(tx, ty, items));
    on('world:time', ({ day, minute, weather }) => {
      if (day !== this.time_.day) return; // a new day is on its way
      this.time_.set(day, minute);
      if (weather !== this.weather.current) {
        this.weather.set(weather);
        this.npcs.setWeather(weather);
        if (this.weather.isWet) this.farming.waterAll();
      }
      this.emitTime();
    });
    on('world:newday', ({ shared, passedOut }) => this.startCoopMorning(shared, passedOut.includes(self)));
    on('chat:message', (m) => gameEvents.emit('chat:message', m));
    on('notice', ({ text }) => gameEvents.emit('toast', { text }));
    on('sleep:status', (s) => gameEvents.emit('coop:sleep', s.inBed > 0 ? s : null));
    on('room:closed', ({ reason }) => this.endCoop(reason));
    on('trade:incoming', (p) => {
      sfx('talk');
      gameEvents.emit('trade:incoming', p);
    });
    on('trade:state', (t) => {
      gameEvents.emit('trade:state', t);
      if (t && this.panel !== 'trade') this.setPanel('trade');
      else if (!t && this.panel === 'trade') this.setPanel(null);
    });
    on('trade:commit', ({ id, give }) => {
      const ok = this.handOver(give);
      session.send('trade:ack', { id, ok });
      this.reportState(true);
    });
    on('trade:deliver', ({ receive }) => {
      this.receive(receive);
      sfx('coin');
      gameEvents.emit('toast', { text: 'Trade complete!' });
      this.reportState(true);
    });
    on('trade:refund', ({ refund }) => {
      this.receive(refund);
      this.reportState(true);
    });

    const emitInfo = () =>
      gameEvents.emit('coop:info', {
        code: room.code,
        seed: room.seed,
        hostName: room.hostName,
        selfId: self,
        host: session.join.members.find((m) => m.id === self)?.host ?? false,
        leader: this.roomSettings.leaderId === self,
        public: this.roomSettings.public,
        sharedWallet: this.roomSettings.sharedWallet,
      });
    this.roomSettings = session.join.settings ?? { public: false, sharedWallet: false, leaderId: '' };
    emitInfo();
    on('room:settings', (s) => {
      this.roomSettings = s;
      emitInfo();
    });
    on('wallet:gold', ({ gold }) => {
      this.state.setGold(gold);
    });
    on('world:cabins', ({ cabins }) => {
      this.cabins = cabins;
    });
    gameEvents.emit('coop:members', coop.members);
    gameEvents.emit('coop:sleep', null);
    gameEvents.emit('trade:state', null);
    this.reportState(true);
  }

  /** Sends position updates and progress reports at a steady rate. */
  private coopUpdate(delta: number): void {
    this.remotes?.update(delta);
    const session = this.coop!.session;
    this.moveTimer -= delta;
    if (this.moveTimer <= 0) {
      this.moveTimer = 1000 / 10;
      const v = this.player.sprite.body.velocity;
      const moving = Math.hypot(v.x, v.y) > 1 ? 1 : 0;
      const x = Math.round(this.player.x * 10) / 10;
      const y = Math.round(this.player.y * 10) / 10;
      const f = this.player.facingDirection;
      const sig = `${x},${y},${f},${moving}`;
      if (sig !== this.lastSentMove) {
        this.lastSentMove = sig;
        session.send('player:move', { x, y, f, m: moving });
      }
    }
    this.stateTimer -= delta;
    if (this.stateTimer <= 0) {
      this.stateTimer = COOP_STATE_MS;
      this.reportState(false);
    }
  }

  /** Reports this player's own progress (backpack, gold…) if it changed. */
  private reportState(force: boolean): void {
    if (!this.coop || !this.state) return;
    const state: CoopPlayerState = {
      player: { ...this.state.serialize(), x: Math.round(this.player.x), y: Math.round(this.player.y), facing: this.player.facingDirection as Direction },
      social: (this.rememberPetStay(), { ...this.social.serialize(), skills: skills.toSave(), horse: this.horse.toSave(), daily: daily.toSave(), freight: this.freight.toSave() }),
      quests: this.quests.serialize(),
      interior: this.interior,
      collection: this.collection.serialize(),
    };
    const sig = JSON.stringify(state);
    if (!force && sig === this.lastStateSig) return;
    this.lastStateSig = sig;
    this.coop.session.send('player:state', state);
  }

  /** Co-op bedtime: the day ends when everyone is in bed (or at 2am). */
  private enterBed(): void {
    if (this.inBed || !this.coop) return;
    this.inBed = true;
    this.sleeping = true;
    this.player.stop();
    this.setPanel(null);
    sfx('sleep');
    this.cameras.main.fadeOut(600, 0, 0, 0);
    this.coop.session.send('sleep:set', { inBed: true });
    const others = this.coop.members.length - 1;
    gameEvents.emit('toast', { text: others > 0 ? 'Waiting for everyone to go to bed… (move to get up)' : 'Good night…' });
  }

  private leaveBed(): void {
    if (!this.inBed || !this.coop) return;
    this.inBed = false;
    this.sleeping = false;
    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.coop.session.send('sleep:set', { inBed: false });
  }

  /** The server started a new day: restart from its world, keeping our own progress. */
  private startCoopMorning(shared: SharedWorldState, passedOut: boolean): void {
    if (!this.coop) return;
    if (this.away) this.leaveArea('quiet');
    this.sleeping = true;
    this.setPanel(null);
    this.reportState(true);
    const shipped = this.state.sellBin();
    this.state.clearBuffs();
    const door = this.doorPosition();
    const me: CoopPlayerState = {
      player: { ...this.state.serialize(), x: door.x, y: door.y, facing: 'down' },
      social: (this.rememberPetStay(), { ...this.social.serialize(), skills: skills.toSave(), horse: this.horse.toSave(), daily: daily.toSave(), freight: this.freight.toSave() }),
      quests: this.quests.serialize(),
      interior: this.interior,
      collection: this.collection.serialize(),
    };
    const restart = () => this.scene.restart({ seed: this.seed, coop: { ...this.coop!, shared, me, morning: { passedOut, shipped } } });
    if (this.inBed) restart();
    else {
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, restart);
    }
  }

  /** First frame of a new co-op day. */
  private wakeUpTogether(passedOut: boolean): void {
    const { passOutRestore } = GAME_CONFIG.energy;
    this.state.setEnergyFraction(passedOut ? passOutRestore : 1);
    this.state.heal(this.state.maxHealth);
    this.cameras.main.fadeIn(700, 0, 0, 0);
    sfx('morning');
    const day = `Day ${this.time_.dayOfSeason} of ${this.time_.season}`;
    gameEvents.emit('toast', { text: passedOut ? `You passed out and woke up at home, still tired. ${day}.` : `Good morning! ${day}, ${this.weather.current}.` });
    this.deliverMail();
    const sprinkled = this.build.ofKind('sprinkler').length;
    if (sprinkled > 0) gameEvents.emit('toast', { text: 'The sprinklers watered the fields.' });
    this.reportState(true);
  }

  /** The room closed (host left, server restarting…): stop and tell the player. */
  private endCoop(reason: string): void {
    if (this.away) this.leaveArea('quiet');
    this.sleeping = true;
    this.setPanel(null);
    this.player.stop();
    gameEvents.emit('coop:ended', { reason });
  }

  /** Another player changed the shared world: mirror it here (quieter when it happens far away). */
  private applyRemoteOp(op: WorldOp): void {
    const size = GAME_CONFIG.tileSize;
    const x = 'tx' in op ? op.tx * size + 8 : 'x' in op ? op.x : this.player.x;
    const y = 'ty' in op ? op.ty * size + 8 : 'y' in op ? op.y : this.player.y;
    const distance = Math.hypot(x - this.player.x, y - this.player.y);
    const volume = distance > 240 ? 0 : distance > 80 ? 0.4 : 0.8;
    withSfxVolume(volume, () => {
      const plot = 'tx' in op ? this.farming.plotAt(op.tx, op.ty) : undefined;
      switch (op.t) {
        case 'till':
          if (this.farming.canTill(op.tx, op.ty)) this.farming.till(op.tx, op.ty);
          break;
        case 'untill':
          if (plot) this.farming.untill(plot);
          break;
        case 'plant':
          if (plot && !plot.crop) this.farming.plant(plot, op.crop);
          break;
        case 'water':
          if (plot && !plot.watered) this.farming.water(plot);
          break;
        case 'fertilize':
          if (plot) this.farming.fertilize(plot);
          break;
        case 'harvest':
          if (plot) this.farming.harvest(plot, false);
          break;
        case 'node':
          this.resources.destroyAt(op.tx, op.ty);
          break;
        case 'berries': {
          const node = this.resources.nodeAt(op.tx, op.ty);
          if (node) this.resources.pickBerries(node, false);
          break;
        }
        case 'place':
          if (!this.build.at(op.tx, op.ty)) {
            this.build.place(op.kind, op.tx, op.ty);
            sfx('place');
          }
          break;
        case 'pickup': {
          const placed = this.build.at(op.tx, op.ty);
          if (placed) this.build.remove(placed, placed.kind === 'cabin');
          break;
        }
        case 'chicken':
          this.animals.addChicken(op.x, op.y, undefined, op.kind);
          break;
        case 'drop':
          this.drops.removeShared(op.id);
          break;
        case 'machineLoad': {
          const placed = this.build.at(op.tx, op.ty);
          if (placed && isMachineKind(placed.kind) && op.readyAt !== undefined) {
            this.build.setMachine(placed, { input: op.itemId, output: op.output ?? MACHINES[placed.kind].output, readyAt: op.readyAt }, gameTime(this.time_.day, this.time_.minute));
          }
          break;
        }
        case 'livestock': {
          const barn = { tx: op.barnTx, ty: op.barnTy };
          if (op.id !== undefined && !this.livestock.get(op.id)) this.livestock.create(op.kind, barn, op.id, op.name);
          break;
        }
        case 'animalPet':
          this.livestock.pet(op.id, this.time_.day);
          break;
        case 'animalCollect':
          this.livestock.collect(op.id);
          break;
        case 'donate':
          this.recordDonation(op.goal, op.itemId, op.quantity);
          break;
        case 'barnFeed': {
          const barn = this.build.at(op.tx, op.ty);
          if (barn) barn.hay = (barn.hay ?? 0) + op.quantity;
          break;
        }
        case 'machineCollect': {
          const placed = this.build.at(op.tx, op.ty);
          if (placed) this.build.setMachine(placed, null, gameTime(this.time_.day, this.time_.minute));
          break;
        }
      }
    });
  }

  /** Moving items in and out of a shared chest: the server holds its contents. */
  private transferSharedChest(from: 'chest' | 'inventory', slot: number): void {
    const placed = this.build.openChest;
    const inv = this.state.inventory;
    if (!placed?.storage) return;
    const { tx, ty } = placed;
    if (from === 'inventory') {
      const stack = inv.slots[slot];
      if (!stack) return;
      // The server checks the items against the backpack it last heard about.
      this.reportState(true);
      this.authority.request({ t: 'chestPut', tx, ty, itemId: stack.itemId, quantity: stack.quantity }, (g) => {
        const current = inv.slots[slot];
        if (current?.itemId === stack.itemId) inv.removeAt(slot, g.accepted ?? 0);
        else inv.remove(stack.itemId, g.accepted ?? 0);
      });
    } else {
      const stack = placed.storage.slots[slot];
      if (!stack) return;
      const room = inv.capacityFor(stack.itemId);
      if (room === 0) return void gameEvents.emit('toast', { text: `No room for ${ITEMS[stack.itemId].name}` });
      this.authority.request({ t: 'chestTake', tx, ty, slot, max: Math.min(room, stack.quantity) }, (g) => {
        if (!g.grant) return;
        const leftover = inv.add(g.grant.itemId, g.grant.quantity);
        if (leftover > 0) this.drops.spawn(g.grant.itemId, leftover, this.player.x, this.player.y + 4);
      });
    }
  }

  /** Trade: hand over our side. False if we no longer have it all (nothing is removed then). */
  private handOver(offer: TradeOffer): boolean {
    const inv = this.state.inventory;
    const totals = new Map<ItemId, number>();
    for (const it of offer.items) totals.set(it.itemId, (totals.get(it.itemId) ?? 0) + it.quantity);
    for (const [itemId, q] of totals) if (inv.count(itemId) < q) return false;
    if (offer.gold > this.state.gold) return false;
    for (const [itemId, q] of totals) inv.remove(itemId, q);
    if (offer.gold > 0) this.state.spendGold(offer.gold);
    return true;
  }

  /** Trade: take items and gold (anything that doesn't fit lands at our feet). */
  private receive(offer: TradeOffer): void {
    for (const it of offer.items as ItemAmount[]) {
      const leftover = this.state.inventory.add(it.itemId, it.quantity);
      if (leftover > 0) this.drops.spawn(it.itemId, leftover, this.player.x, this.player.y + 4);
      if (it.quantity - leftover > 0) gameEvents.emit('item:collected', { itemId: it.itemId, quantity: it.quantity - leftover });
    }
    this.state.receiveGold(offer.gold);
  }

  /** While a text field (chat) has focus, the game ignores the keyboard. */
  private setTyping(typing: boolean): void {
    const keyboard = this.input?.keyboard;
    if (!keyboard?.manager || !this.sys.isActive()) return;
    keyboard.enabled = !typing;
    if (typing) keyboard.disableGlobalCapture();
    else {
      keyboard.enableGlobalCapture();
      keyboard.resetKeys();
    }
  }

  // ---------- Village life ----------

  /** Shows a conversation one line at a time (Space / click for the next). */
  private sayLines(lines: Array<{ speaker: string; text: string; hearts?: number }>): void {
    if (!lines.length) return;
    const [first, ...rest] = lines;
    this.dialogueQueue = rest;
    gameEvents.emit('dialogue', { ...first, more: rest.length > 0 });
    this.setPanel('dialogue');
  }

  private nextLine(): void {
    const next = this.dialogueQueue.shift();
    if (!next) return this.setPanel(null);
    sfx('talk');
    gameEvents.emit('dialogue', { ...next, more: this.dialogueQueue.length > 0 });
  }

  /** A heart scene, if this villager has one ready. Plays it and mails the gift. */
  private playHeartEvent(id: NpcId): boolean {
    const event = this.social.pendingEvent(id);
    if (!event) return false;
    const def = NPCS[id];
    this.social.markEvent(id, event.hearts);
    const hearts = this.social.hearts(id);
    this.sayLines(event.lines.map((text) => ({ speaker: def.name, text, hearts })));
    sfx('heart');
    if (event.gift) {
      this.social.send(this.time_.day, def.name, 'A little something', `Thanks for listening today. I wanted you to have this. — ${def.name}`, event.gift);
      gameEvents.emit('toast', { text: `${def.name} sent you something — check your mailbox.` });
    }
    return true;
  }

  /** Morning post: festival notices and little gifts from friends. */
  private deliverMail(): void {
    const day = this.time_.day;
    const tomorrow = festivalOn(day + 1);
    if (tomorrow) this.social.send(day, 'Village Council', `Tomorrow: ${tomorrow.name}!`, `${tomorrow.details} Everyone will be at the market. See you there!`);
    for (const id of NPC_IDS) {
      if (this.social.hearts(id) < 4) continue;
      const rng = createRng(`${this.seed}:mail:${day}:${id}:${this.coop?.session.selfId ?? 'solo'}`);
      if (!rng.chance(FRIEND_GIFT_CHANCE)) continue;
      this.social.send(day, NPCS[id].name, 'Thinking of you', `I had some extra and thought of you. Hope the farm is doing well! — ${NPCS[id].name}`, FRIEND_GIFTS[id]);
    }
    if (this.social.unread > 0) gameEvents.emit('toast', { text: `You have ${this.social.unread} new letter${this.social.unread > 1 ? 's' : ''} in your mailbox.` });
  }

  private emitMail(): void {
    gameEvents.emit('mail:list', { letters: this.social.letters.map((l) => ({ ...l })) });
  }

  /** Mail flag on the mailbox, plus anything the UI shows about friends. */
  private onSocialChange(): void {
    if (!this.build) return;
    const box = mailboxTile(this.world);
    const mailbox = this.build.at(box.tx, box.ty);
    if (mailbox?.kind === 'mailbox') this.build.showMarker(mailbox, this.social.unread > 0);
    if (this.panel === 'mail') this.emitMail();
  }

  /** Today's festival: decorations, and the Egg Festival's hidden eggs. */
  private startFestival(): void {
    this.decorations.forEach((d) => d.destroy());
    this.decorations = [];
    const festival = festivalOn(this.time_.day);
    this.emitFestival(festival);
    if (!festival) return;
    const size = GAME_CONFIG.tileSize;
    const { market } = this.world;
    // Bunting over the market, lanterns in winter.
    for (let tx = market.x0 + 1; tx <= market.x1 - 1; tx += 3) {
      const x = tx * size + 8;
      const y = (market.y1 - 2) * size + 2;
      const lantern = festival.id === 'winter_lights';
      const img = this.add.image(x, y, lantern ? TEXTURES.lantern : TEXTURES.bunting).setDepth(DEPTH.ySortBase + y + 40);
      if (lantern) img.setData('light', true);
      this.decorations.push(img);
    }
    gameEvents.emit('toast', { text: `Today: ${festival.name}! ${festival.tagline}` });
    if (festival.id === 'egg_festival' && !this.social.eggsHidden(this.time_.day)) {
      this.social.hideEggs(this.time_.day);
      const rng = createRng(`${this.seed}:eggs:${this.time_.day}`);
      for (let i = 0, tries = 0; i < EGG_HUNT.count && tries < 400; tries++) {
        const tx = rng.int(market.x0 - 4, market.x1 + 4);
        const ty = rng.int(market.y0 - 3, market.y1 + 6);
        if (terrainAt(this.world, tx, ty) !== Terrain.Grass || this.resources.isBlocked(tx, ty) || this.build.isBlocked(tx, ty)) continue;
        this.drops.spawn('painted_egg', 1, tx * size + 8, ty * size + 8);
        i++;
      }
    }
  }

  private emitFestival(festival: FestivalDef | null): void {
    gameEvents.emit(
      'festival:today',
      festival
        ? { id: festival.id, name: festival.name, tagline: festival.tagline, details: festival.details, canEnterFair: festival.id === 'harvest_fair' && !this.social.enteredFair(this.time_.day) }
        : null,
    );
  }

  /** Harvest Fair: the judges pay three times a crop's value, plus a ribbon. */
  private enterHarvestFair(slot: number): void {
    const festival = festivalOn(this.time_.day);
    if (this.panel !== 'board' || festival?.id !== 'harvest_fair' || !Number.isInteger(slot)) return;
    if (this.social.enteredFair(this.time_.day)) return void gameEvents.emit('toast', { text: "You've already entered the fair this year." });
    const stack = this.state.inventory.slots[slot];
    const def = stack ? ITEMS[stack.itemId] : null;
    if (!def || def.category !== 'crop' || !def.sellPrice) return void gameEvents.emit('toast', { text: 'Enter a crop you grew.' });
    if (this.state.inventory.removeAt(slot, 1) !== 1) return;
    const prize = def.sellPrice * 3;
    this.state.earn(prize);
    if (this.state.inventory.add('ribbon', 1) > 0) this.drops.spawn('ribbon', 1, this.player.x, this.player.y + 4);
    this.social.enterFair(this.time_.day);
    this.emitFestival(festival);
    sfx('quest');
    gameEvents.emit('toast', { text: `The judges loved your ${def.name}! +${prize}g and a ribbon.` });
  }

  // ---------- The mine ----------

  /** Floors the elevator can take you to: 1, and every 5th floor you've reached. */
  private elevatorFloors(): number[] {
    const floors = [1];
    for (let f = MINE.elevatorEvery; f <= this.state.mineDepth; f += MINE.elevatorEvery) floors.push(f);
    return floors;
  }

  private openMineEntrance(): void {
    const floors = this.elevatorFloors();
    if (floors.length === 1) return this.enterMine(1);
    gameEvents.emit('mine:elevator', { floors });
    this.setPanel('mine');
  }

  private enterMine(floor: number): void {
    const host: MineHost = {
      state: this.state,
      isFrozen: () => this.panel !== null || this.sleeping,
      exit: ({ fainted }) => this.leaveArea(fainted ? 'fainted' : 'climbed'),
    };
    this.enterArea(SCENES.Mine, { floor, host } satisfies MineSceneData);
  }

  private areaHost(): AreaHost {
    return {
      state: this.state,
      isFrozen: () => this.panel !== null || this.sleeping,
      calendar: () => ({ day: this.time_.day, minute: this.time_.minute, season: this.time_.season, weather: this.weather.current }),
      exit: () => this.leaveArea('climbed'),
      spot: (id) => {
        if (!this.collection.spot(id)) return false;
        gameEvents.emit('toast', { text: `${WILDLIFE[id].emoji} New sighting: ${WILDLIFE[id].name}! Logged in your collection (K → Wildlife).` });
        this.emitCollection();
        return true;
      },
      say: (speaker, text) => this.sayLines([{ speaker, text }]),
      openCooking: () => {
        gameEvents.emit('crafting:open', { category: 'cooking', kitchen: true });
        this.setPanel('crafting');
      },
      rest: () => this.rest(),
    };
  }

  /** The east end of the path, where a signpost points to the beach. */
  private beachGate(): { tx: number; ty: number } {
    const tx = this.world.width - 3;
    for (let ty = 0; ty < this.world.height; ty++) {
      const t = terrainAt(this.world, tx, ty);
      if (t === Terrain.Path || t === Terrain.Bridge) return { tx, ty };
    }
    return { tx, ty: this.world.spawn.ty };
  }

  /** The west end of the path, where a signpost points into the old forest. */
  private forestGate(): { tx: number; ty: number } {
    const tx = 2;
    for (let ty = 0; ty < this.world.height; ty++) {
      const t = terrainAt(this.world, tx, ty);
      if (t === Terrain.Path || t === Terrain.Bridge) return { tx, ty };
    }
    return { tx, ty: this.world.spawn.ty };
  }

  /**
   * The carnival's gate: a clear spot on the south side of the main path, a
   * fair walk from the cottage and the village (the same for everyone in a
   * world, since it only depends on the map).
   */
  private carnivalGateSpot: { tx: number; ty: number } | null = null;
  private carnivalGate(): { tx: number; ty: number } {
    if (this.carnivalGateSpot) return this.carnivalGateSpot;
    const { market, home, width, height } = this.world;
    const taken = new Set(this.world.objects.map((o) => `${o.tx},${o.ty}`));
    const grass = (x: number, y: number) => terrainAt(this.world, x, y) === Terrain.Grass && !taken.has(`${x},${y}`);
    const onPath = (x: number, y: number) => terrainAt(this.world, x, y) === Terrain.Path;
    const nearBridge = (x: number, y: number) => {
      for (let dx = -4; dx <= 4; dx++) for (let dy = -2; dy <= 2; dy++) if (terrainAt(this.world, x + dx, y + dy) === Terrain.Bridge) return true;
      return false;
    };
    const ideal = 30;
    let best: { tx: number; ty: number; score: number } | null = null;
    for (let x = 10; x < width - 10; x++) {
      // Keep clear of the village row and the cottage.
      if (x >= market.x0 - 3 && x <= market.x1 + 6) continue;
      for (let y = 1; y < height - 5; y++) {
        if (!onPath(x, y) || !grass(x, y + 1) || nearBridge(x, y)) continue;
        // The arch itself needs clear grass; the lamp posts, cart and billboard prefer it.
        if (![-2, -1, 0, 1, 2].every((dx) => grass(x + dx, y + 1)) || !grass(x, y + 2)) continue;
        let clutter = 0;
        for (let dx = -6; dx <= 6; dx++) {
          for (let dy = 1; dy <= 3; dy++) {
            const t = terrainAt(this.world, x + dx, y + dy);
            if (t === Terrain.Water || t === Terrain.Bridge || t < 0) clutter += 6;
            else if (!grass(x + dx, y + dy)) clutter += 1;
          }
        }
        const dist = Math.hypot(x - home.tx, y - home.ty);
        if (dist < 20) continue;
        const score = Math.abs(dist - ideal) + clutter * 2;
        if (!best || score < best.score) best = { tx: x, ty: y + 1, score };
      }
    }
    if (best) return (this.carnivalGateSpot = { tx: best.tx, ty: best.ty });
    return (this.carnivalGateSpot = { tx: Math.round((market.x0 + market.x1) / 2), ty: market.y1 + 3 });
  }

  /** Arrow signs pointing to the carnival: by the path nearest the cottage, and halfway along. */
  private carnivalSigns(): { tx: number; ty: number; flip: boolean }[] {
    const gate = this.carnivalGate();
    const { home, width, height } = this.world;
    const taken = new Set(this.world.objects.map((o) => `${o.tx},${o.ty}`));
    const free = (x: number, y: number) => terrainAt(this.world, x, y) === Terrain.Grass && !taken.has(`${x},${y}`);
    // A sign stands on the grass just north of the path at column x.
    const spotAt = (x: number) => {
      for (let y = 1; y < height - 1; y++) if (terrainAt(this.world, x, y) === Terrain.Path && terrainAt(this.world, x, y - 1) === Terrain.Grass) return { tx: x, ty: y - 1 };
      return null;
    };
    const near = (x0: number) => {
      for (let d = 0; d < 6; d++) {
        for (const x of [x0 + d, x0 - d]) {
          const spot = x > 1 && x < width - 2 ? spotAt(x) : null;
          if (spot && free(spot.tx, spot.ty)) return spot;
        }
      }
      return null;
    };
    const signs: { tx: number; ty: number; flip: boolean }[] = [];
    const first = near(home.tx);
    if (first && Math.abs(first.tx - gate.tx) > 6) signs.push({ ...first, flip: gate.tx < first.tx });
    const from = first?.tx ?? home.tx;
    if (Math.abs(from - gate.tx) > 16) {
      const mid = near(Math.round((from + gate.tx) / 2));
      if (mid) signs.push({ ...mid, flip: gate.tx < mid.tx });
    }
    return signs;
  }

  /** Trees, rocks and grass cleared from around the carnival entrance and its signs. */
  private clearCarnivalEntrance(): void {
    const g = this.carnivalGate();
    this.resources.clearArea({ x0: g.tx - 6, y0: g.ty - 1, x1: g.tx + 6, y1: g.ty + 3 });
    for (const s of this.carnivalSigns()) this.resources.clearArea({ x0: s.tx - 1, y0: s.ty - 1, x1: s.tx + 1, y1: s.ty });
  }

  /** The mine floor the player is on (for the cave's sounds). */
  private mineFloor = 1;

  /** What each market stall sells, written on the sign board on top of it with a little icon. */
  private labelStalls(): void {
    const SIGNS: { text: string; icon: ItemId; color: string }[] = [
      { text: 'SEEDS', icon: 'turnip_seeds', color: '#9b3329' },
      { text: 'BAKERY', icon: 'bread', color: '#b0506e' },
      { text: 'SMITHY', icon: 'copper_pickaxe', color: '#2e2e36' },
      { text: 'FISH', icon: 'sunfish', color: '#2f5f8f' },
      { text: 'WOODWORK', icon: 'chest', color: '#3f6a28' },
    ];
    const size = GAME_CONFIG.tileSize;
    for (const spec of this.world.objects) {
      if (spec.kind !== 'stall') continue;
      const sign = SIGNS[spec.variant] ?? SIGNS[0];
      const x = (spec.tx + 1) * size;
      const baseY = spec.ty * size + size - 2;
      const midY = baseY - 45 + 4.5;
      const depth = DEPTH.ySortBase + baseY + 0.5;
      const text = this.add
        .text(x + 4, midY, sign.text, { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '6px', fontStyle: 'bold', color: sign.color, resolution: 8 })
        .setOrigin(0.5, 0.5)
        .setDepth(depth);
      // Fit between the icon and the board's right edge.
      text.setScale(Math.min(1, 24 / text.width));
      this.add.image(x - 13, midY, itemTextureKey(sign.icon)).setScale(0.5).setDepth(depth);
    }
  }

  /** Lamps placed by the scene (carnival entrance, bridge lanterns) that glow at night. */
  private propLights: { x: number; y: number; radius: number }[] = [];

  /**
   * The mine's yard, out on its own: a patch of trampled gravel, the rails
   * running out of the shaft to a loaded ore cart, a lamp, a few loose
   * boulders and a signpost.
   */
  private decorateMine(): void {
    const size = GAME_CONFIG.tileSize;
    const { mine } = this.world;
    const cx = (mine.tx + 1) * size;
    const baseY = (mine.ty + 1) * size - 2;
    // Gravel yard (drawn on the ground, ragged at the edges).
    const g = this.add.graphics().setDepth(DEPTH.ground + 0.1);
    const rng = createRng(`${this.seed}:mine-yard`);
    for (let y = -22; y <= 52; y += 2) {
      for (let x = -60; x <= 60; x += 2) {
        const r = (x / 58) ** 2 + ((y - 14) / 38) ** 2 + (rng.next() - 0.5) * 0.18;
        if (r > 1) continue;
        g.fillStyle(r > 0.85 ? 0x9a8c78 : rng.chance(0.15) ? 0x8a7c6a : rng.chance(0.1) ? 0xb4a690 : 0xa89a84, 1).fillRect(cx + x, baseY + y, 2, 2);
      }
    }
    // Rails from the shaft out into the yard.
    const rails = this.add.graphics().setDepth(DEPTH.ground + 0.15);
    for (let y = baseY; y < baseY + 40; y += 4) rails.fillStyle(0x6f4626, 1).fillRect(cx - 7, y, 14, 2);
    rails.fillStyle(0x8a9098, 1).fillRect(cx - 5, baseY, 1, 40).fillRect(cx + 4, baseY, 1, 40);
    const tex = (key: string, draw: () => { toCanvas(): HTMLCanvasElement }) => {
      if (!this.textures.exists(key)) this.textures.addCanvas(key, draw().toCanvas());
      return key;
    };
    // A loaded ore cart parked on a siding beside the rails.
    const cartY = baseY + 26;
    this.add.image(cx + 24, cartY, tex('mine-cart', drawMineCart)).setOrigin(0.5, 1).setDepth(DEPTH.ySortBase + cartY);
    // A lamp post at the yard's edge, lit at night.
    const lampX = cx - 3 * size;
    const lampY = baseY + 10;
    this.add.image(lampX, lampY, tex('carnival-pole', drawLightPole)).setOrigin(0.5, 1).setDepth(DEPTH.ySortBase + lampY);
    this.propLights.push({ x: lampX, y: lampY - 30, radius: 44 });
    // Loose boulders.
    for (const [dx, dy, v] of [[3.2, 0.6, 0], [-2.6, -0.6, 1], [2.6, 2.4, 2]] as const) {
      const bx = cx + dx * size;
      const by = baseY + dy * size;
      this.add.image(bx, by, objectTextureKey('rock', v % 2)).setOrigin(0.5, 13 / 14).setDepth(DEPTH.ySortBase + by);
    }
    // Signpost.
    const sx = cx + 3 * size;
    const sy = baseY + 2 * size - 4;
    this.add.image(sx, sy, TEXTURES.signpost).setOrigin(0.5, 1).setDepth(DEPTH.ySortBase + sy);
    this.add
      .text(sx, sy - 20, '⛏ MINE', { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '6px', fontStyle: 'bold', color: '#fff1a8', stroke: '#2b1d1a', strokeThickness: 3, resolution: 8 })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.ySortBase + sy + 1);
  }

  /** Soft puffs of smoke drifting up from the cottage chimney. */
  private chimneySmoke(): void {
    const size = GAME_CONFIG.tileSize;
    const { home } = this.world;
    const x = home.tx * size + 40;
    const baseY = home.ty * size + size - 2;
    const y = baseY - 76;
    this.time.addEvent({
      delay: 700,
      loop: true,
      callback: () => {
        if (this.away) return;
        const puff = this.add.circle(x + Phaser.Math.Between(-1, 1), y, Phaser.Math.Between(2, 3), 0xe8e4dc, 0.55).setDepth(DEPTH.ySortBase + baseY + 2);
        this.tweens.add({
          targets: puff,
          x: puff.x + Phaser.Math.Between(4, 10),
          y: y - Phaser.Math.Between(14, 22),
          scale: 2.2,
          alpha: 0,
          duration: 2600,
          ease: 'Sine.easeOut',
          onComplete: () => puff.destroy(),
        });
      },
    });
  }

  /** Railings with stone end pillars and lanterns along both sides of every bridge. */
  private decorateBridges(): void {
    const size = GAME_CONFIG.tileSize;
    const { width, height } = this.world;
    const seen = new Set<number>();
    const isBridge = (x: number, y: number) => terrainAt(this.world, x, y) === Terrain.Bridge;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!isBridge(x, y) || seen.has(y * width + x)) continue;
        // Flood the bridge to find its bounds.
        let x0 = x;
        let x1 = x;
        let y0 = y;
        let y1 = y;
        const stack = [[x, y]];
        seen.add(y * width + x);
        while (stack.length) {
          const [cx, cy] = stack.pop()!;
          x0 = Math.min(x0, cx);
          x1 = Math.max(x1, cx);
          y0 = Math.min(y0, cy);
          y1 = Math.max(y1, cy);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (isBridge(nx, ny) && !seen.has(ny * width + nx)) {
              seen.add(ny * width + nx);
              stack.push([nx, ny]);
            }
          }
        }
        // Rails run along the path direction (east-west for the main path).
        const horizontal = x1 - x0 >= y1 - y0;
        if (!horizontal) continue;
        const w = (x1 - x0 + 1) * size + 8;
        const key = `bridge-rail-${w}`;
        if (!this.textures.exists(key)) this.textures.addCanvas(key, drawBridgeRail(w).toCanvas());
        if (!this.textures.exists('bridge-lantern')) this.textures.addCanvas('bridge-lantern', drawBridgeLantern().toCanvas());
        const left = x0 * size - 4;
        // North rail stands behind the walkway, south rail in front of it.
        const northBase = y0 * size + 3;
        const southBase = (y1 + 1) * size + 3;
        this.add.image(left, northBase, key).setOrigin(0, 1).setDepth(DEPTH.ySortBase + northBase);
        this.add.image(left, southBase, key).setOrigin(0, 1).setDepth(DEPTH.ySortBase + southBase);
        for (const base of [northBase, southBase]) {
          for (const lx of [left + 3.5, left + w - 3.5]) {
            this.add.image(lx, base - 16, 'bridge-lantern').setOrigin(0.5, 1).setDepth(DEPTH.ySortBase + base + 1);
            this.propLights.push({ x: lx, y: base - 22, radius: 30 });
          }
        }
      }
    }
  }

  /** Dresses up the carnival's entrance: arch, lamp posts, bunting, balloons, a billboard and signs from the village. */
  private decorateCarnivalEntrance(): void {
    const size = GAME_CONFIG.tileSize;
    const tex = (key: string, draw: () => { toCanvas(): HTMLCanvasElement }) => {
      if (!this.textures.exists(key)) this.textures.addCanvas(key, draw().toCanvas());
      return key;
    };
    const label = (x: number, y: number, text: string, px: number, color: string, depth: number) =>
      this.add
        .text(x, y, text, { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: `${px}px`, fontStyle: 'bold', color, stroke: '#2b1d1a', strokeThickness: 3, resolution: 8 })
        .setOrigin(0.5, 1)
        .setDepth(depth);
    const arch = this.carnivalGate();
    const cx = (arch.tx + 0.5) * size;
    const base = (arch.ty + 1) * size - 2;
    const ys = (y: number) => DEPTH.ySortBase + y;

    this.add.image(cx, base, tex('carnival-arch', drawArch)).setOrigin(0.5, 1).setScale(0.75).setDepth(ys(base));
    label(cx, base - 27, 'CARNIVAL', 6, '#fff1a8', ys(base) + 1);

    // Lamp posts either side, with bunting strung to the arch.
    const poleL = cx - 3 * size;
    const poleR = cx + 3 * size;
    const pole = tex('carnival-pole', drawLightPole);
    for (const px of [poleL, poleR]) {
      this.add.image(px, base, pole).setOrigin(0.5, 1).setDepth(ys(base));
      this.propLights.push({ x: px, y: base - 30, radius: 46 });
    }
    const bunt = tex('carnival-bunting', () => drawBunting(Math.round(2 * size)));
    this.add.image(poleL + 3, base - 31, bunt).setOrigin(0, 0).setDepth(ys(base) + 2);
    this.add.image(poleR - 3, base - 31, bunt).setOrigin(1, 0).setFlipX(true).setDepth(ys(base) + 2);

    // A bunch of balloons tied to the left post, bobbing.
    const balloons: [string, string, number, number][] = [
      ['#d2404c', '#f26a72', -6, -40],
      ['#3a83b5', '#58a4d2', -1, -44],
      ['#f4d24a', '#fff1a8', 4, -41],
      ['#8a5aa8', '#b07ad0', -3, -37],
    ];
    balloons.forEach(([col, light, dx, dy], i) => {
      const b = this.add.image(poleL + dx, base + dy, tex(`carnival-hb-${col}`, () => drawHandBalloon(col, light))).setOrigin(0.5, 0).setScale(1.3).setDepth(ys(base) + 3);
      this.tweens.add({ targets: b, y: b.y - 2, duration: 1100 + i * 170, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });

    // A billboard to the right: what's inside.
    const bx = cx + 5 * size;
    const bBase = base + size;
    this.add.image(bx, bBase, tex('carnival-billboard', drawFairBillboard)).setOrigin(0.5, 1).setDepth(ys(bBase));
    label(bx, bBase - 24, 'GAMES · RIDES', 4, '#8a2a3a', ys(bBase) + 1).setStroke('#f6efe0', 0);
    label(bx, bBase - 19, 'PRIZES · TREATS', 4, '#3a5a8a', ys(bBase) + 1).setStroke('#f6efe0', 0);

    // A treat cart to the left of the entrance.
    const tcx = cx - 5 * size;
    this.add.image(tcx, bBase, tex('carnival-cart-out', drawTreatCart)).setOrigin(0.5, 1).setScale(0.8).setDepth(ys(bBase));

    // Arrow signs from the village pointing the way.
    const sign = tex('carnival-signpost', drawFairSignpost);
    for (const s of this.carnivalSigns()) {
      const sx = (s.tx + 0.5) * size;
      const sb = (s.ty + 1) * size - 1;
      this.add.image(sx, sb, sign).setOrigin(0.5, 1).setFlipX(s.flip).setDepth(ys(sb));
      label(sx + (s.flip ? 2 : -2), sb - 20, 'CARNIVAL', 4, '#8a2a3a', ys(sb) + 1).setStroke('#f6efe0', 0);
    }
  }

  private carnivalSession = 0;
  private carnivalPaid: { session: number; game: CarnivalGameId } | null = null;

  /** Pay for a carnival game and open it in the panel. */
  private carnivalPlay(game: CarnivalGameId): void {
    const def = CARNIVAL_GAMES[game];
    if (!this.state.inventory.remove('carnival_token', def.cost)) {
      gameEvents.emit('toast', { text: `${def.name} costs ${def.cost} token${def.cost > 1 ? 's' : ''}. Buy tokens at the ticket booth (${TOKEN_PRICE}g each).` });
      sfx('error');
      return;
    }
    this.carnivalPaid = { session: ++this.carnivalSession, game };
    gameEvents.emit('carnival:view', { mode: 'game', game, session: this.carnivalSession });
    if (this.panel !== 'carnival') this.setPanel('carnival');
    this.reportState(true);
  }

  /** Set by the carnival scene: visitors cheer when you win big. */
  private carnivalCheer: ((tickets: number) => void) | null = null;

  private emitCarnivalCard(): void {
    const today = this.social.carnivalToday(this.time_.day);
    const challenge = dailyChallenge(this.time_.day);
    gameEvents.emit('carnival:card', {
      played: today.played as CarnivalGameId[],
      cardDone: today.card,
      challenge: { ...challenge, done: today.challenge },
      best: { ...today.best } as Partial<Record<CarnivalGameId, number>>,
      golden: isGoldenHour(this.time_.minute),
    });
  }

  private carnivalHost(): CarnivalHost {
    return {
      play: (game) => this.carnivalPlay(game),
      open: (mode) => {
        if (mode === 'card') this.emitCarnivalCard();
        gameEvents.emit('carnival:view', { mode });
        this.setPanel('carnival');
      },
      onCheer: (cb) => {
        this.carnivalCheer = cb;
      },
      canFortune: () => !this.social.carnivalToday(this.time_.day).fortune,
      fortune: () => {
        const today = this.social.carnivalToday(this.time_.day);
        if (today.fortune) return;
        today.fortune = true;
        const f = FORTUNES[(this.time_.day * 13 + this.seed.length) % FORTUNES.length];
        this.state.addBuff(f.buff, f.minutes);
        sfx('sparkle');
        this.sayLines([{ speaker: 'Madame Zara', text: `${f.text} (${BUFF_INFO[f.buff].icon} ${BUFF_INFO[f.buff].name} for ${Math.round(f.minutes / 60)} hours)` }]);
        this.reportState(true);
      },
      canTip: () => !this.social.carnivalToday(this.time_.day).tip,
      tip: () => {
        const today = this.social.carnivalToday(this.time_.day);
        if (today.tip) return false;
        if (!this.state.spendGold(JUGGLER_TIP)) {
          gameEvents.emit('toast', { text: `A tip is ${JUGGLER_TIP}g.` });
          return false;
        }
        today.tip = true;
        this.state.addBuff('luck', 120);
        sfx('coin');
        gameEvents.emit('toast', { text: `Jojo bows deeply. "Luck be with you!" (${BUFF_INFO.luck.icon} Lucky for 2 hours)` });
        this.reportState(true);
        return true;
      },
      talkVillager: (id, line) => {
        const { before, after } = this.social.talk(id, this.time_.day);
        gameEvents.emit('dialogue', { speaker: NPCS[id].name, text: line, hearts: this.social.hearts(id) });
        this.setPanel('dialogue');
        if (after > before) this.heartUp(id);
      },
      canSpin: () => this.social.carnivalSpin !== this.time_.day,
      spin: () => {
        if (this.social.carnivalSpin === this.time_.day) return;
        const slice = spinWheel(Math.random());
        const prize = WHEEL_SLICES[slice];
        this.social.carnivalSpin = this.time_.day;
        gameEvents.emit('carnival:view', { mode: 'wheel', slice, label: prize.label });
        this.setPanel('carnival');
        // The prize lands once the wheel has stopped spinning in the panel.
        this.time.delayedCall(3600, () => {
          if ('itemId' in prize) {
            const left = this.state.inventory.add(prize.itemId, prize.quantity);
            if (left > 0) this.drops.spawn(prize.itemId, left, this.player.x, this.player.y);
            gameEvents.emit('item:collected', { itemId: prize.itemId, quantity: prize.quantity });
            sfx(prize.quantity >= 25 ? 'quest' : 'coin');
          }
          this.reportState(true);
        });
      },
      ride: (kind) => {
        const ride = CARNIVAL_RIDES[kind];
        if (!this.state.inventory.remove('carnival_token', ride.cost)) {
          gameEvents.emit('toast', { text: `A ride is ${ride.cost} token. Buy tokens at the ticket booth (${TOKEN_PRICE}g each).` });
          sfx('error');
          return false;
        }
        if ('energy' in ride) this.state.restoreEnergy(ride.energy);
        if ('buffMinutes' in ride) this.state.addBuff('speed', ride.buffMinutes);
        gameEvents.emit('toast', { text: ride.text });
        this.reportState(true);
        return true;
      },
    };
  }

  private enterCarnival(): void {
    this.enterArea(SCENES.Carnival, { host: this.areaHost(), carnival: this.carnivalHost() } satisfies CarnivalSceneData);
  }

  private enterForest(): void {
    const data: ForestSceneData = {
      host: this.areaHost(),
      forage: {
        taken: (day) => this.social.forestTaken(day),
        take: (day, id) => this.social.takeForest(day, id),
      },
    };
    this.enterArea(SCENES.Forest, data);
  }

  // ---------- Villagers' homes, the museum, the island ----------

  /** Whose home you're visiting (to step back out in front of the right door). */
  private visiting: NpcId | null = null;
  private homeTalks = 0;
  private train: TrainSystem | null = null;
  /** Train contracts at the freight depot (this player's own orders). */
  private readonly freight = new Freight();
  /** The game minute freight was last brought up to date ("day:minute"). */
  private freightClock = '';
  /** Goods waiting on the depot platform for the train. */
  private freightGoods: Phaser.GameObjects.Image | null = null;
  private orchard!: OrchardSystem;
  /** Today's goals (also reachable here for debugging). */
  readonly dailyGoals = daily;
  private ghost: GhostSystem | null = null;
  /** The spirits of the night market (in the graveyard). */
  private nightMarket: NightMarketSystem | null = null;
  /** Deer, foxes and pollinators around the farm. */
  private ecosystem!: EcosystemSystem;
  /** Whose stall the market panel is showing. */
  private marketSpirit: SpiritId = 'wick';
  /** The last seed parcel packed this session (its code stays on screen to copy). */
  private lastParcel: { code: string; name: string; quantity: number } | null = null;
  /** Headstones in the graveyard: tile and epitaph index. */
  private graves: Array<{ tx: number; ty: number; epitaph: number }> = [];

  private lotCache: {
    homes: Partial<Record<NpcId, { tx: number; ty: number; rect: Rect }>>;
    museum: { tx: number; ty: number; rect: Rect } | null;
    /** The railway's row (null if no row fits). */
    rail: number | null;
    /** The old graveyard: 7x5 tiles, `ty` its bottom (gate) row. */
    graveyard: { tx: number; ty: number; rect: Rect } | null;
    /** The freight depot: 3 tiles wide on the row two above the rails (`ty`), its platform on the row between. */
    depot: { tx: number; ty: number; rect: Rect } | null;
  } | null = null;

  /**
   * Where the villagers' houses and the museum stand: open grass near the
   * main path, clear of the cottage, the market, the mine yard and the
   * carnival. `tx` is the left column, `ty` the row the door is on.
   */
  private lots(): NonNullable<WorldScene['lotCache']> {
    if (this.lotCache) return this.lotCache;
    const { width, height, home, market, mine } = this.world;
    const fixtures = new Set(this.world.objects.filter((o) => o.kind === 'stall' || o.kind === 'board' || o.kind === 'mine').map((o) => `${o.tx},${o.ty}`));
    const gate = this.carnivalGate();
    const t = (x: number, y: number) => terrainAt(this.world, x, y);
    const taken: Rect[] = [];
    const hit = (a: Rect, b: Rect) => a.x0 <= b.x1 && a.x1 >= b.x0 && a.y0 <= b.y1 && a.y1 >= b.y0;
    const keepOut: Rect[] = [
      { x0: home.tx - 5, y0: home.ty - 6, x1: home.tx + 8, y1: home.ty + 7 },
      { x0: mine.tx - 5, y0: mine.ty - 4, x1: mine.tx + 6, y1: mine.ty + 6 },
      { x0: gate.tx - 7, y0: gate.ty - 3, x1: gate.tx + 7, y1: gate.ty + 4 },
      { x0: market.x0 - 1, y0: market.y0 - 1, x1: market.x1 + 1, y1: market.y1 + 1 },
      ...this.carnivalSigns().map((g) => ({ x0: g.tx - 1, y0: g.ty - 2, x1: g.tx + 1, y1: g.ty + 1 })),
    ];
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (t(x, y) === Terrain.Bridge) keepOut.push({ x0: x - 2, y0: y - 1, x1: x + 2, y1: y + 1 });
    const pathBelow = (x: number, y: number) => {
      for (let d = 1; d <= 6; d++) {
        const k = t(x, y + d);
        if (k === Terrain.Path || k === Terrain.Bridge) return d;
      }
      return 99;
    };
    const fits = (x: number, y: number, w: number, h: number): Rect | null => {
      const r = { x0: x - 1, y0: y - h, x1: x + w, y1: y + 1 };
      if (r.x0 < 5 || r.x1 > width - 6 || r.y0 < 1 || r.y1 > height - 2) return null;
      if (taken.some((o) => hit(r, o)) || keepOut.some((o) => hit(r, o))) return null;
      for (let yy = r.y0; yy <= y; yy++) {
        for (let xx = r.x0; xx <= r.x1; xx++) {
          if (t(xx, yy) !== Terrain.Grass || fixtures.has(`${xx},${yy}`) || this.build.at(xx, yy) || this.farming.isTilled(xx, yy)) return null;
        }
      }
      const front = t(x + Math.floor(w / 2), y + 1);
      return front === Terrain.Grass || front === Terrain.Path ? r : null;
    };
    const pick = (w: number, h: number, score: (x: number, y: number) => number) => {
      let best: { tx: number; ty: number; rect: Rect; sc: number } | null = null;
      for (let y = 3; y < height - 2; y++) {
        for (let x = 5; x < width - 6; x++) {
          const rect = fits(x, y, w, h);
          if (!rect) continue;
          const sc = score(x, y);
          if (!best || sc < best.sc) best = { tx: x, ty: y, rect, sc };
        }
      }
      if (best) taken.push(best.rect);
      return best ? { tx: best.tx, ty: best.ty, rect: best.rect } : null;
    };
    // The museum: a fair walk from the cottage, facing the path.
    const museum = pick(5, 4, (x, y) => Math.abs(Math.hypot(x + 2.5 - home.tx, y - home.ty) - 17) + pathBelow(x + 2, y) * 3);
    // Homes: around the market, each with the path a few steps from the door.
    const ax = (market.x0 + market.x1) / 2;
    const ay = market.y1;
    const homes: Partial<Record<NpcId, { tx: number; ty: number; rect: Rect }>> = {};
    for (const id of NPC_IDS) {
      const lot = pick(3, 3, (x, y) => Math.hypot(x + 1.5 - ax, (y - ay) * 1.3) + pathBelow(x + 1, y) * 2.5);
      if (lot) homes[id] = lot;
    }
    // The railway: one straight row across the whole valley, clear of the path and every landmark.
    const rail = this.pickRailRow(taken, keepOut, fixtures);
    // The depot sits right beside the rails, so it ignores the band kept clear of them for everything else.
    const nearRails = [...keepOut];
    if (rail !== null) keepOut.push({ x0: 0, y0: rail - 2, x1: width, y1: rail + 2 });
    // The old graveyard: off on its own, a fair walk from the cottage.
    const graveyard = pick(7, 5, (x, y) => Math.abs(Math.hypot(x + 3.5 - home.tx, y - home.ty) - 24) + (y > home.ty ? 6 : 0) + pathBelow(x + 3, y));
    // The freight depot: picked last, so every older landmark stays exactly where it was.
    const depot = rail === null ? null : this.pickDepot(rail, taken, nearRails, fixtures);
    return (this.lotCache = { homes, museum, rail, graveyard, depot });
  }

  /**
   * The row the train runs along: no path, landmark or building on it or the
   * rows either side, as little water as possible, and a good way south of
   * the main path. Null if nothing fits.
   */
  private pickRailRow(taken: Rect[], keepOut: Rect[], fixtures: Set<string>): number | null {
    const { width, height, spawn } = this.world;
    const hit = (x: number, y: number) => [...taken, ...keepOut].some((r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1);
    let best: { row: number; cost: number } | null = null;
    for (let y = 4; y < height - 4; y++) {
      let cost = Math.abs(y - (spawn.ty + 15)) * 1.5;
      let ok = true;
      for (let x = 0; x < width && ok; x++) {
        for (let dy = -1; dy <= 1 && ok; dy++) {
          const t = terrainAt(this.world, x, y + dy);
          if (t === Terrain.Path || t === Terrain.Bridge || fixtures.has(`${x},${y + dy}`) || hit(x, y + dy)) ok = false;
          else if (t === Terrain.Water) cost += dy === 0 ? 2 : 0.5;
          else if (this.build.at(x, y + dy) || this.farming.isTilled(x, y + dy)) cost += 25;
        }
      }
      if (ok && (!best || cost < best.cost)) best = { row: y, cost };
    }
    return best?.row ?? null;
  }

  /**
   * Where the freight depot stands: three tiles of open grass on the row two
   * above the rails (the shed) and the row between (its platform), as close
   * to the cottage as possible. Null if nowhere fits.
   */
  private pickDepot(rail: number, taken: Rect[], keepOut: Rect[], fixtures: Set<string>): { tx: number; ty: number; rect: Rect } | null {
    const { width, home } = this.world;
    const inside = (x: number, y: number) => [...taken, ...keepOut].some((r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1);
    const open = (x: number, y: number) =>
      terrainAt(this.world, x, y) === Terrain.Grass && !fixtures.has(`${x},${y}`) && !inside(x, y) && !this.build.at(x, y) && !this.farming.isTilled(x, y) && !this.orchard?.at(x, y);
    const ty = rail - 2;
    if (ty < 2) return null;
    let best: { tx: number; score: number } | null = null;
    for (let x = 6; x <= width - 9; x++) {
      let ok = true;
      for (let dx = 0; dx < 3 && ok; dx++) ok = open(x + dx, ty) && open(x + dx, ty + 1);
      if (!ok) continue;
      const score = Math.hypot(x + 1.5 - (home.tx + 1.5), ty - home.ty);
      if (!best || score < best.score) best = { tx: x, score };
    }
    return best ? { tx: best.tx, ty, rect: { x0: best.tx, y0: ty, x1: best.tx + 2, y1: ty + 1 } } : null;
  }

  /** Front doors (where villagers come and go). */
  private homeDoors(): Partial<Record<NpcId, { x: number; y: number }>> {
    const size = GAME_CONFIG.tileSize;
    const out: Partial<Record<NpcId, { x: number; y: number }>> = {};
    for (const id of NPC_IDS) {
      const lot = this.lots().homes[id];
      if (lot) out[id] = { x: (lot.tx + 1) * size + 8, y: (lot.ty + 1) * size + 10 };
    }
    return out;
  }

  /** Trees and rocks cleared from the lots; draws the houses and the museum and keeps their ground free. */
  private decorateLots(obstacles: Phaser.Physics.Arcade.StaticGroup): void {
    const size = GAME_CONFIG.tileSize;
    const lots = this.lots();
    const all: Rect[] = [
      ...Object.values(lots.homes).map((l) => l!.rect),
      ...(lots.museum ? [lots.museum.rect] : []),
      ...(lots.graveyard ? [lots.graveyard.rect] : []),
      ...(lots.depot ? [lots.depot.rect] : []),
    ];
    if (lots.rail !== null) all.push({ x0: 0, y0: lots.rail - 1, x1: this.world.width - 1, y1: lots.rail });
    for (const r of all) this.resources.clearArea(r);
    if (lots.rail !== null) this.resources.clearArea({ x0: 0, y0: lots.rail + 1, x1: this.world.width - 1, y1: lots.rail + 1 });
    this.build.reserved = (tx, ty) => all.some((r) => tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1) || !!this.orchard.at(tx, ty);
    const tex = (key: string, draw: () => { toCanvas(): HTMLCanvasElement }) => {
      if (!this.textures.exists(key)) this.textures.addCanvas(key, draw().toCanvas());
      return key;
    };
    const label = (x: number, y: number, text: string, depth: number, px = 5) =>
      this.add
        .text(x, y, text, { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: `${px}px`, fontStyle: 'bold', color: '#fff1a8', stroke: '#2b1d1a', strokeThickness: 3, resolution: 8 })
        .setOrigin(0.5, 1)
        .setDepth(depth);
    const solid = (tx: number, ty: number, w: number, h: number) => {
      const zone = this.add.zone(tx * size + (w * size) / 2, (ty - h + 1) * size + (h * size) / 2 + 2, w * size - 2, h * size - 4);
      obstacles.add(zone);
    };
    for (const id of NPC_IDS) {
      const lot = lots.homes[id];
      if (!lot) continue;
      const base = (lot.ty + 1) * size - 1;
      const x = (lot.tx + 1.5) * size;
      this.add.image(x, base, tex(`house-${id}`, () => drawVillagerHouse(id))).setOrigin(0.5, 1).setDepth(DEPTH.ySortBase + base);
      label(x, base - 60, `${NPCS[id].name}'s`, DEPTH.ySortBase + base + 1);
      solid(lot.tx, lot.ty, 3, 3);
    }
    if (lots.museum) {
      const m = lots.museum;
      const base = (m.ty + 1) * size - 1;
      const x = (m.tx + 2.5) * size;
      this.add.image(x, base, tex('museum-front', drawMuseum)).setOrigin(0.5, 1).setDepth(DEPTH.ySortBase + base);
      label(x, base - 44, 'MUSEUM', DEPTH.ySortBase + base + 1, 6);
      solid(m.tx, m.ty, 5, 4);
      this.propLights.push({ x: x - 2 * size, y: base - 20, radius: 30 }, { x: x + 2 * size, y: base - 20, radius: 30 });
    }
    if (lots.rail !== null) {
      this.train = new TrainSystem(this, this.seed, lots.rail, this.world.width, (tx, ty) => terrainAt(this.world, tx, ty) === Terrain.Water, this.drops, () => {
        this.social.trainsSeen += 1;
        if (this.social.trainsSeen === 1) gameEvents.emit('toast', { text: '🚂 The valley train! It passes a few times a day, and things sometimes fall off by the tracks.' });
        this.social.mark('train');
      });
    }
    if (lots.graveyard) this.decorateGraveyard(lots.graveyard, tex, solid, label);
    if (lots.depot && this.train) {
      const d = lots.depot;
      const x = (d.tx + 1.5) * size;
      const base = (d.ty + 1) * size - 1;
      this.add.image(x, (d.ty + 1) * size + 3, tex('freight-deck', drawFreightDeck)).setOrigin(0.5, 0).setDepth(DEPTH.soil + 0.6);
      this.add.image(x, base, tex('freight-shed', drawFreightShed)).setOrigin(0.5, 1).setDepth(DEPTH.ySortBase + base);
      label(x, base - 40, 'FREIGHT', DEPTH.ySortBase + base + 1, 6);
      solid(d.tx, d.ty, 3, 1);
      tex('freight-goods', drawFreightGoods);
      this.propLights.push({ x, y: base - 30, radius: 34 });
    }
  }

  /**
   * The old graveyard: a wrought-iron fence with a gate on the south side,
   * a few headstones (Elsie's in the middle, with flowers), and a dead tree.
   */
  private decorateGraveyard(
    lot: { tx: number; ty: number },
    tex: (key: string, draw: () => { toCanvas(): HTMLCanvasElement }) => string,
    solid: (tx: number, ty: number, w: number, h: number) => void,
    label: (x: number, y: number, text: string, depth: number, px?: number) => Phaser.GameObjects.Text,
  ): void {
    const size = GAME_CONFIG.tileSize;
    const x0 = lot.tx;
    const y0 = lot.ty - 4;
    const depthAt = (ty: number) => DEPTH.ySortBase + (ty + 1) * size - 1;
    // Fence: top row, both sides, and the bottom row with a gate gap in the middle.
    for (let c = 0; c <= 6; c++) {
      for (const r of [0, 4]) {
        if (r === 4 && c === 3) continue;
        const ty = y0 + r;
        this.add.image((x0 + c) * size, (ty + 1) * size, tex('grave-fence-h', () => drawGraveFence(true))).setOrigin(0, 1).setDepth(depthAt(ty));
        solid(x0 + c, ty, 1, 1);
      }
    }
    for (const c of [0, 6]) {
      for (let r = 1; r <= 3; r++) {
        const ty = y0 + r;
        this.add.image((x0 + c) * size, (ty + 1) * size, tex('grave-fence-v', () => drawGraveFence(false))).setOrigin(0, 1).setDepth(depthAt(ty));
        solid(x0 + c, ty, 1, 1);
      }
    }
    const gateY = (lot.ty + 1) * size;
    this.add.image((x0 + 3) * size - 8, gateY, tex('grave-post', drawGravePost)).setOrigin(0, 1).setDepth(depthAt(lot.ty) + 1);
    this.add.image((x0 + 4) * size + 8, gateY, 'grave-post').setOrigin(1, 1).setFlipX(true).setDepth(depthAt(lot.ty) + 1);
    this.propLights.push({ x: (x0 + 3) * size + 6, y: gateY - 12, radius: 22 }, { x: (x0 + 4) * size - 6, y: gateY - 12, radius: 22 });
    // Headstones (Elsie's first).
    this.graves = [
      { tx: x0 + 3, ty: y0 + 1, epitaph: 0 },
      { tx: x0 + 1, ty: y0 + 1, epitaph: 1 },
      { tx: x0 + 5, ty: y0 + 1, epitaph: 2 },
      { tx: x0 + 1, ty: y0 + 3, epitaph: 3 },
      { tx: x0 + 5, ty: y0 + 3, epitaph: 4 },
      { tx: x0 + 2, ty: y0 + 2, epitaph: 5 },
    ];
    const variants = [3, 0, 1, 2, 0, 1];
    this.graves.forEach((g, i) => {
      const v = variants[i];
      this.add.image((g.tx + 0.5) * size, (g.ty + 1) * size, tex(`tombstone-${v}`, () => drawTombstone(v))).setOrigin(0.5, 1).setDepth(depthAt(g.ty));
      solid(g.tx, g.ty, 1, 1);
    });
    // A twisted old tree behind the top-left corner.
    this.add.image((x0 - 0.5) * size + 8, (y0 + 1) * size, tex('dead-tree', drawDeadTree)).setOrigin(0.5, 1).setDepth(depthAt(y0) - 2);
    label((x0 + 3.5) * size, y0 * size + 4, 'GRAVEYARD', depthAt(y0) + 2);
    const elsie = this.graves[0];
    this.ghost = new GhostSystem(this, elsie, this.ghostSpots(), {
      state: this.state,
      ghost: () => this.social.ghost,
      say: (lines) => this.sayLines(lines),
      guide: (tx, ty) => {
        this.waypoint.set(tx, ty);
        gameEvents.emit('toast', { text: '📍 Follow the glowing trail.' });
      },
      mark: (id) => this.social.mark(id),
      drop: (itemId, quantity) => this.drops.spawn(itemId, quantity, this.player.x, this.player.y - 4),
    });
    this.nightMarket = new NightMarketSystem(this, { x0, y0 });
  }

  /**
   * Where Elsie's three belongings lie: by the river near a bridge, near the
   * mine entrance, and in the woods at the far north. Each on open grass you
   * can reach (and kept clear of trees).
   */
  private ghostSpots(): Array<{ tx: number; ty: number }> {
    const { width, height, mine } = this.world;
    const lots = this.lots();
    const inLot = (x: number, y: number) =>
      [...Object.values(lots.homes).map((l) => l!.rect), lots.museum?.rect, lots.graveyard?.rect, lots.depot?.rect].some((r) => r && x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) ||
      (lots.rail !== null && Math.abs(y - lots.rail) <= 1);
    const open = (x: number, y: number) =>
      x > 1 && y > 1 && x < width - 2 && y < height - 2 &&
      terrainAt(this.world, x, y) === Terrain.Grass && !this.resources.isBlocked(x, y) && !this.build.isBlocked(x, y) && !this.farming.isTilled(x, y) && !inLot(x, y);
    const roomy = (x: number, y: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => open(x + dx, y + dy)).length >= 2;
    const nearest = (cx: number, cy: number, ok: (x: number, y: number) => boolean): { tx: number; ty: number } | null => {
      for (let r = 1; r < 24; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            if (ok(cx + dx, cy + dy)) return { tx: cx + dx, ty: cy + dy };
          }
        }
      }
      return null;
    };
    const wetNear = (x: number, y: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => terrainAt(this.world, x + dx, y + dy) === Terrain.Water);
    // 1. By the river where the path crosses it.
    let bridge = { tx: Math.round(width * 0.7), ty: this.world.spawn.ty };
    let bestD = Infinity;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const d = Math.abs(x - width * 0.7);
        if (terrainAt(this.world, x, y) === Terrain.Bridge && d < bestD) {
          bestD = d;
          bridge = { tx: x, ty: y };
        }
      }
    }
    const locket = nearest(bridge.tx, bridge.ty + 2, (x, y) => open(x, y) && roomy(x, y) && wetNear(x, y)) ?? nearest(bridge.tx, bridge.ty, (x, y) => open(x, y) && roomy(x, y));
    // 2. Near the mine entrance.
    const glasses = nearest(mine.tx + 5, mine.ty + 4, (x, y) => open(x, y) && roomy(x, y));
    // 3. The far north woods: the open spot nearest the top edge, near the middle.
    let box: { tx: number; ty: number } | null = null;
    let bestScore = Infinity;
    for (let y = 2; y < Math.min(14, height); y++) {
      for (let x = 4; x < width - 4; x++) {
        if (!open(x, y) || !roomy(x, y)) continue;
        const score = y * 3 + Math.abs(x - width * 0.45) * 0.25;
        if (score < bestScore) {
          bestScore = score;
          box = { tx: x, ty: y };
        }
      }
    }
    const spots = [locket, glasses, box].map((s) => s ?? { tx: this.world.spawn.tx + 2, ty: this.world.spawn.ty + 3 });
    for (const s of spots) this.resources.clearArea({ x0: s.tx, y0: s.ty, x1: s.tx, y1: s.ty });
    return spots;
  }

  /** Lit windows in the evening while a villager is home and awake. */
  private windowLights(): Array<{ x: number; y: number; radius: number }> {
    if (LightingSystem.darkness(this.time_.minute) < 0.3 || !this.npcs) return [];
    const size = GAME_CONFIG.tileSize;
    const out: Array<{ x: number; y: number; radius: number }> = [];
    for (const id of NPC_IDS) {
      const lot = this.lots().homes[id];
      if (!lot || this.npcs.whereIs(id, this.time_.minute, HOME_BEDTIME) !== 'home' || this.social.spouse === id) continue;
      const base = (lot.ty + 1) * size - 1;
      out.push({ x: lot.tx * size + 12, y: base - 22, radius: 20 }, { x: lot.tx * size + 36, y: base - 22, radius: 20 });
    }
    return out;
  }

  /** Doors of the houses and the museum. */
  private landmarkAction(tx: number, ty: number): { verb: string; info?: boolean; run: () => void } | null {
    const lots = this.lots();
    const toast = (text: string) => gameEvents.emit('toast', { text });
    const belonging = this.ghost?.belongingAt(tx, ty);
    if (belonging) return { verb: 'Pick up something glinting', run: () => this.ghost?.pickUp(tx, ty) };
    const spirit = this.nightMarket?.spiritAt(tx, ty);
    if (spirit && this.marketOpenNow()) {
      const def = SPIRITS[spirit];
      return { verb: `${def.emoji} ${def.name} · night market`, run: () => this.openMarket(spirit) };
    }
    const grave = this.graves.find((g) => g.tx === tx && (g.ty === ty || g.ty + 1 === ty));
    if (grave) {
      if (grave.epitaph === 0 && this.ghost?.present(this.time_.minute)) return { verb: 'Talk to the ghost', run: () => this.ghost?.talk() };
      const text = EPITAPHS[grave.epitaph];
      if (grave.epitaph === 0) {
        const after = this.social.ghost.stage >= 3 ? ' Fresh flowers lie at its foot, and you think you hear a music box, very faintly.' : ' The air here feels strangely cold… especially late at night.';
        if (grave.ty === ty) return { verb: 'Read the headstone', info: true, run: () => this.sayLines([{ speaker: 'Headstone', text: text + after }]) };
      }
      if (grave.ty === ty) return { verb: 'Read the headstone', info: true, run: () => this.sayLines([{ speaker: 'Headstone', text }]) };
    }
    const depot = lots.depot;
    if (depot && this.train && ty === depot.ty && tx >= depot.tx && tx <= depot.tx + 2) {
      const open = this.freight.openCount;
      return { verb: open > 0 ? `Freight board (${open} order${open > 1 ? 's' : ''})` : 'Freight board', run: () => this.openFreight() };
    }
    const m = lots.museum;
    if (m && tx >= m.tx && tx < m.tx + 5 && ty >= m.ty - 1 && ty <= m.ty) {
      return { verb: `Enter the museum (${this.social.museum.items.length}/${MUSEUM_ITEMS.length})`, run: () => this.enterMuseum() };
    }
    for (const id of NPC_IDS) {
      const lot = lots.homes[id];
      if (!lot || tx < lot.tx || tx >= lot.tx + 3 || ty < lot.ty - 1 || ty > lot.ty) continue;
      const name = NPCS[id].name;
      if (this.social.spouse === id) return { verb: `${name}'s old house`, info: true, run: () => toast(`${name} lives with you at the cottage now.`) };
      const where = this.npcs.whereIs(id, this.time_.minute, HOME_BEDTIME);
      if (where === 'asleep') return { verb: `${name}'s house · lights out`, info: true, run: () => toast(`It's late. ${name} is asleep — come back tomorrow.`) };
      if (where === 'out') {
        const h = NPCS[id].hours;
        return {
          verb: `${name}'s house · nobody home`,
          info: true,
          run: () => toast(`${name} is out${NPCS[id].shop ? ' at the stall' : ' and about'} (${formatClock(h.from)}–${formatClock(h.to)}). Home until ${formatClock(HOME_BEDTIME)} after that.`),
        };
      }
      if (this.social.hearts(id) < HOME_VISIT_HEARTS) {
        return {
          verb: `Knock on ${name}'s door`,
          run: () => toast(`${name} opens the door a crack. "Oh — hello! Maybe another time." (Friends get invited in at ${HOME_VISIT_HEARTS} hearts.)`),
        };
      }
      return { verb: `Visit ${name}`, run: () => this.enterHome(id) };
    }
    return null;
  }

  private enterHome(id: NpcId): void {
    this.visiting = id;
    const data: HomeSceneData = {
      host: this.areaHost(),
      npc: id,
      talk: () => this.homeTalk(id),
      canTreat: () => this.social.hearts(id) >= HOME_TREAT_HEARTS && !this.social.treatedToday(id, this.time_.day),
      treat: () => this.homeTreat(id),
      gift: (slot) => this.giveGift(id, slot),
    };
    this.enterArea(SCENES.Home, data);
  }

  private homeTalk(id: NpcId): void {
    if (this.playHeartEvent(id)) return;
    const { before, after } = this.social.talk(id, this.time_.day);
    daily.note('talk', 1, id);
    const life = HOME_LIFE[id];
    const friend = this.social.hearts(id) >= 4 ? NPCS[id].lines.friend ?? [] : [];
    const pool = [...life.lines, ...friend];
    const text = pool[(this.time_.day + this.homeTalks++) % pool.length];
    this.sayLines([{ speaker: NPCS[id].name, text, hearts: this.social.hearts(id) }]);
    if (after > before) this.heartUp(id);
  }

  private homeTreat(id: NpcId): void {
    const { treat, treatText } = HOME_LIFE[id];
    if (this.state.inventory.add(treat.itemId, treat.quantity) > 0) {
      gameEvents.emit('toast', { text: 'Your backpack is full — make some room first.' });
      sfx('error');
      return;
    }
    this.social.markTreat(id, this.time_.day);
    gameEvents.emit('item:collected', { itemId: treat.itemId, quantity: treat.quantity });
    sfx('heart');
    this.sayLines([{ speaker: NPCS[id].name, text: treatText }]);
    this.reportState(true);
  }

  private enterMuseum(): void {
    const data: MuseumSceneData = {
      host: this.areaHost(),
      donated: () => new Set(this.social.museum.items),
      donate: (itemId) => this.donateToMuseum(itemId),
    };
    this.enterArea(SCENES.Museum, data);
  }

  /** Puts one of an item on display; finishing a collection mails its reward. */
  private donateToMuseum(itemId: ItemId): boolean {
    const museum = this.social.museum;
    if (museum.items.includes(itemId) || !MUSEUM_ITEMS.includes(itemId)) return false;
    if (!this.state.inventory.remove(itemId, 1)) return false;
    museum.items.push(itemId);
    gameEvents.emit('toast', { text: `🏛 ${ITEMS[itemId].name} is now on display!` });
    const set = museumSetOf(itemId);
    if (set && !museum.sets.includes(set.id) && set.items.every((i) => museum.items.includes(i))) {
      museum.sets.push(set.id);
      this.state.earn(set.reward.gold);
      sfx('coin');
      this.social.send(
        this.time_.day,
        'Professor Hoot',
        `${set.name}: complete!`,
        `Hoo! You've filled every display in "${set.name}". The valley thanks you. I've enclosed a little something, and ${set.reward.gold}g from the museum fund.`,
        set.reward.item,
      );
      gameEvents.emit('toast', { text: `🏛 Collection complete: ${set.name}! +${set.reward.gold}g, and a gift in the mail.` });
      if (MUSEUM_SET_IDS.every((sid) => museum.sets.includes(sid))) {
        this.state.earn(MUSEUM_COMPLETE_GOLD);
        this.social.send(this.time_.day, 'Professor Hoot', 'Every display is full', `Every pedestal in the museum holds a treasure, and every one came from you. Hoo, hoo! Please accept ${MUSEUM_COMPLETE_GOLD}g with the gratitude of the whole valley.`);
        gameEvents.emit('toast', { text: `🏛 The museum is complete! +${MUSEUM_COMPLETE_GOLD}g` });
      }
    }
    this.onSocialChange();
    this.reportState(true);
    return true;
  }

  private repairBoat(): boolean {
    const inv = this.state.inventory;
    const missing = BOAT_REPAIR.filter((r) => inv.count(r.itemId) < r.quantity);
    if (missing.length) {
      sfx('error');
      gameEvents.emit('toast', { text: `You still need ${missing.map((r) => `${r.quantity - inv.count(r.itemId)} ${ITEMS[r.itemId].name.toLowerCase()}`).join(', ')} to fix the boat.` });
      return false;
    }
    for (const r of BOAT_REPAIR) inv.remove(r.itemId, r.quantity);
    this.social.island.boat = true;
    gameEvents.emit('toast', { text: 'The boat is patched up and watertight. Time to see what is out there!' });
    this.reportState(true);
    return true;
  }

  private islandData(arrival: 'dock' | 'cave'): IslandSceneData {
    return {
      host: this.areaHost(),
      island: this.social.island,
      changed: () => this.reportState(true),
      arrival,
      sail: () => this.switchArea(SCENES.Beach, this.beachData('boat')),
      enterCave: () => this.switchArea(SCENES.IslandCave, this.caveData()),
    };
  }

  private caveData(): IslandCaveSceneData {
    return {
      host: this.areaHost(),
      island: this.social.island,
      changed: () => this.reportState(true),
      exit: () => this.switchArea(SCENES.Island, this.islandData('cave')),
    };
  }

  /** Swap one side area for another (beach ↔ island ↔ cave) without going back to the farm. */
  /** Remembers the places you've been (for the guide). */
  private markVisit(key: string): void {
    const id = ({ [SCENES.Beach]: 'beach', [SCENES.Forest]: 'forest', [SCENES.Carnival]: 'carnival', [SCENES.Mine]: 'mine', [SCENES.Island]: 'island', [SCENES.Home]: 'home_visit', [SCENES.Museum]: 'museum_visit' } as Record<string, string>)[key];
    if (id) this.social.mark(id);
  }

  private switchArea(key: string, data: object): void {
    if (!this.away) return;
    this.markVisit(key);
    const old = this.awayKey;
    this.awayKey = key;
    if (old) this.scene.stop(old);
    this.scene.launch(key, data);
  }

  private horse!: HorseSystem;
  private fetches = { day: -1, count: 0 };
  private digTimer = 20_000;

  /** Throw a stick ahead (it lands on open ground); the dog brings it back. */
  private throwStick(pet: NonNullable<Social['pet']>): void {
    const size = GAME_CONFIG.tileSize;
    const dir = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[this.player.facingDirection];
    let dist = 6;
    const land = (n: number) => {
      const tx = Math.floor((this.player.x + dir[0] * n * size) / size);
      const ty = Math.floor((this.player.y + dir[1] * n * size) / size);
      const t = terrainAt(this.world, tx, ty);
      return tx > 0 && ty > 0 && tx < this.world.width - 1 && ty < this.world.height - 1 && (t === Terrain.Grass || t === Terrain.Path || t === Terrain.Bridge);
    };
    while (dist > 1 && !land(dist)) dist--;
    if (dist <= 1) {
      gameEvents.emit('toast', { text: 'Not much room to throw here.' });
      return;
    }
    const to = { x: this.player.x + dir[0] * dist * size, y: this.player.y + dir[1] * dist * size };
    sfx('whoosh');
    this.pets.fetch(pet.kind, { x: this.player.x, y: this.player.y }, to, () => {
      const day = this.time_.day;
      if (this.fetches.day !== day) this.fetches = { day, count: 0 };
      this.fetches.count++;
      if (this.fetches.count <= 3) {
        pet.love = Math.min(1000, pet.love + 3);
        this.fx.burst('heart', this.player.x, this.player.y - 20, 3);
        this.reportState(true);
      }
      sfx('heart');
      gameEvents.emit('toast', { text: `${pet.name} brings the stick back, tail going like mad.` });
    });
  }

  /** Now and then a dog stops to dig — and sometimes finds something good. */
  private petDigging(delta: number): void {
    const pet = this.social.petOf('dog');
    if (!pet || pet.love < 20 || this.away || this.sleeping || this.pets.staying || this.pets.busy) return;
    this.digTimer -= delta;
    if (this.digTimer > 0) return;
    this.digTimer = 25_000 + Math.random() * 20_000;
    const day = this.time_.day;
    const dug = pet.dugDay === day ? pet.dugCount ?? 0 : 0;
    if (dug >= (pet.love >= 100 ? 2 : 1) || Math.random() > 0.45) return;
    const at = this.pets.position('dog');
    if (!at) return;
    const tx = Math.floor(at.x / GAME_CONFIG.tileSize);
    const ty = Math.floor((at.y - 2) / GAME_CONFIG.tileSize);
    if (terrainAt(this.world, tx, ty) !== Terrain.Grass || this.build.isBlocked(tx, ty) || this.farming.isTilled(tx, ty)) return;
    pet.dugDay = day;
    pet.dugCount = dug + 1;
    gameEvents.emit('toast', { text: `${pet.name} has found something and is digging…` });
    this.pets.dig('dog', (x, y) => {
      const roll = Math.random();
      const pool = FORAGE[this.time_.season];
      if (roll < 0.12) {
        const gold = 20 + Math.floor(Math.random() * 60);
        this.state.earn(gold);
        sfx('coin');
        gameEvents.emit('toast', { text: `${pet.name} dug up an old pouch with ${gold}g inside!` });
      } else {
        const item: ItemId =
          roll < 0.3 ? 'old_coin' : roll < 0.46 ? 'arrowhead' : roll < 0.5 ? 'clay_pot' : roll < 0.62 ? 'copper_ore' : roll < 0.68 ? 'iron_ore' : roll < 0.71 ? 'amethyst' : pool[Math.floor(Math.random() * pool.length)];
        this.drops.spawn(item, 1, x + 6, y - 2);
        gameEvents.emit('toast', { text: `${pet.name} dug up ${/^[aeiou]/i.test(ITEMS[item].name) ? 'an' : 'a'} ${ITEMS[item].name}!` });
      }
      this.fx.burst('stone', x, y - 2, 6);
      this.reportState(true);
    });
  }

  /** H: call the horse over, get on when it's close, or get off. */
  private horseKey(): void {
    const toast = (text: string) => gameEvents.emit('toast', { text });
    if (!this.horse.exists) {
      toast("You don't have a horse yet. Mira sells them once you've earned 1000g.");
      return;
    }
    if (this.horse.riding) {
      this.horse.dismount();
      sfx('whoosh');
      return;
    }
    if (this.horse.canMount()) {
      this.mountHorse();
      return;
    }
    this.horse.call();
    sfx('whoosh', { rate: 1.6 });
    toast(`You whistle for ${this.horse.name}.`);
  }

  private mountHorse(): void {
    this.fishing.cancel();
    this.horse.mount();
    sfx('whoosh');
  }

  /** Using the Horse item: let your new horse out. */
  private releaseHorse(x: number, y: number): { verb: string; blocked?: boolean; run: () => void } {
    if (this.horse.exists) return { verb: `You already have ${this.horse.name}`, blocked: true, run: () => undefined };
    return {
      verb: 'Let your horse out',
      run: () => {
        const inv = this.state.inventory;
        if (inv.selectedStack?.itemId !== 'horse' || inv.removeAt(inv.selected, 1) !== 1) return;
        const name = HORSE_NAMES[Math.floor(Math.random() * HORSE_NAMES.length)];
        this.horse.show({ name, x, y });
        this.fx.burst('heart', x, y - 20, 6);
        sfx('heart');
        const key = keyLabel(settings.get().keys.horse);
        gameEvents.emit('toast', { text: `Meet ${name}! Press ${key} next to ${name} to ride (and again to get off). From far away, ${key} whistles for them.` });
        this.reportState(true);
      },
    };
  }

  private sky!: SkyEventsSystem;
  private meteorToastDay = 0;

  /** Storms, the rainbow after them, and the summer meteor shower. */
  private skyTick(delta: number): void {
    const { day, minute } = this.time_;
    const weather = this.weather.current;
    const storm = !this.away && isStormDay(this.seed, day, weather);
    const prev = day > 1 ? forecastWeather(this.seed, day - 1) : 'sunny';
    const rainbow = !this.away && day > 1 && isStormDay(this.seed, day - 1, prev) && weather !== 'rain' && weather !== 'snow' && minute >= RAINBOW_HOURS.from && minute < RAINBOW_HOURS.to;
    const meteors = !this.away && isMeteorNight(day) && minute >= METEOR_SHOWER.from && minute < METEOR_SHOWER.to;
    this.sky.update(delta, { storm, rainbow, meteors, darkness: LightingSystem.darkness(minute) });
    if (rainbow && this.social.rainbowDay !== day) {
      this.social.rainbowDay = day;
      this.social.mark('rainbow');
      this.state.addBuff('luck', RAINBOW_LUCK_MINUTES);
      sfx('quest');
      gameEvents.emit('toast', { text: '🌈 A rainbow after the storm! You feel lucky today.' });
      this.reportState(true);
    }
    if (meteors && this.meteorToastDay !== day) {
      this.meteorToastDay = day;
      this.social.mark('meteors');
      gameEvents.emit('toast', { text: '🌠 Look up — the meteor shower has begun! Something may land on the farm tonight.' });
    }
  }

  /** Lightning hit a tree: sparks, and charcoal left at its foot. */
  private lightningHit(x: number, base: number): void {
    this.fx.burst('sparkle', x, base - 30, 14);
    this.fx.burst('stone', x, base - 4, 8);
    const n = 1 + (Math.random() < 0.4 ? 1 : 0);
    this.drops.spawn('charcoal', n, x + 8, base + 2);
    if (Math.hypot(this.player.x - x, this.player.y - base) < 200) {
      this.social.mark('lightning');
      gameEvents.emit('toast', { text: '⚡ Lightning struck a tree! It left some charcoal behind.' });
    }
  }

  /** The morning after the meteor shower, a few meteorites lie on the farm. */
  private meteorMorning(): void {
    const day = this.time_.day;
    if (day < 2 || !isMeteorNight(day - 1) || this.social.meteorDay === day) return;
    this.social.meteorDay = day;
    const size = GAME_CONFIG.tileSize;
    const { home } = this.world;
    const rng = createRng(`${this.seed}:meteors:${day}`);
    let placed = 0;
    for (let tries = 0; tries < 200 && placed < 3; tries++) {
      const tx = home.tx + rng.int(-14, 14);
      const ty = home.ty + rng.int(-10, 12);
      if (terrainAt(this.world, tx, ty) !== Terrain.Grass || this.build.isBlocked(tx, ty) || this.resources.isBlocked(tx, ty) || this.farming.isTilled(tx, ty)) continue;
      const x = tx * size + 8;
      const y = ty * size + 10;
      const crater = this.add.ellipse(x, y + 2, 14, 7, 0x3a2a1e, 0.55).setDepth(DEPTH.soil);
      this.tweens.add({ targets: crater, alpha: 0, delay: 1000 * 60 * 3, duration: 4000, onComplete: () => crater.destroy() });
      this.drops.spawn('meteorite', 1, x, y);
      placed++;
    }
    if (placed) this.time.delayedCall(1800, () => gameEvents.emit('toast', { text: `☄️ ${placed} meteorite${placed > 1 ? 's' : ''} landed on the farm overnight!` }));
  }

  /** A villager's birthday: say so in the morning. */
  private birthdayMorning(): void {
    const id = birthdayOn(this.time_.day);
    if (!id) return;
    this.time.delayedCall(2600, () => gameEvents.emit('toast', { text: `🎂 It's ${NPCS[id].name}'s birthday today! Gifts count double.` }));
  }

  /** The guide checklist: where to go and what to try, ticked off as you do it. */
  private guideSteps(): Array<{ id: string; text: string; hint: string; done: boolean }> {
    const m = (id: string) => this.social.milestones.has(id);
    const isl = this.social.island;
    const museum = this.social.museum;
    const found = this.collection.foundItems;
    const steps: Array<[string, string, string, boolean]> = [
      ['pet', 'Adopt a pet', 'From day 2, strays wait by your door. Press E on one.', !!this.social.pet],
      ['forest', 'Explore the old forest', 'Follow the path west to the forest edge.', m('forest')],
      ['beach', 'Visit the beach', 'Follow the path east to the signpost.', m('beach')],
      ['carnival', 'Go to the carnival', 'Walk through the striped arch (🎡 on the map).', m('carnival')],
      ['mine', 'Go down into the mine', 'Find the stone steps between timber posts (⛏ on the map).', m('mine')],
      ['museum', 'Donate your first find to the museum', 'The building with columns (🏛 on the map). Talk to Professor Hoot.', museum.items.length >= 1],
      ['museum10', 'Donate 10 items to the museum', 'Fish, shells, ores, gems and artifacts all count.', museum.items.length >= 10],
      ['museumSet', 'Complete a museum collection', 'Fill every pedestal in one of the four collections.', museum.sets.length >= 1],
      ['home', "Visit a villager's home", 'Get to 2 hearts with someone, then knock in the evening.', m('home_visit')],
      ['boat', 'Repair the old boat', 'By the beach pier: 40 wood, 8 hardwood, 20 fiber.', isl.boat],
      ['island', 'Row to the island', 'Press E beside the repaired boat.', m('island')],
      ['cave', 'Find the hidden cave', 'On the island, break the cracked boulder with a copper pickaxe.', isl.cave],
      ['chest', 'Open the ancient chest', 'Deep in the island cave.', isl.chest],
      ['horse', 'Get a horse', 'Mira sells one once you have earned 1000g. Press H to ride.', this.horse.exists],
      ['skill', 'Reach level 5 in any skill', 'Farm, fish, mine and forage — see Collection → Skills.', SKILL_IDS.some((id) => skills.level(id) >= 5)],
      ['wildlife', 'Spot a rare creature', 'A fox at dawn in the forest, an owl at night, dolphins, fireflies, a sea turtle…', this.collection.sightingCount > 0],
      ['birthday', "Give a villager a birthday present", 'Check the calendar (L) for birthdays. Gifts count double.', m('birthday_gift')],
      ['rainbow', 'See a rainbow', 'It appears the dry morning after a thunderstorm.', m('rainbow')],
      ['meteors', 'Watch the meteor shower', 'Summer, day 7, after 9pm. Meteorites land on the farm.', m('meteors')],
      ['icefish', 'Catch a fish through the ice', 'In winter, fish the frozen ponds for icefish.', found.has('icefish') || found.has('glacierfish')],
      ['train', 'Watch the train go by', 'It runs along its own track south of the path a few times a day. Things fall off sometimes!', m('train')],
      ['freight', 'Deliver a train contract', 'Towns down the line post orders at the freight depot by the railway (🚉 on the map).', m('freight')],
      ['daily', 'Finish all three daily goals', 'Your goals for today are under your gold (top right). Finishing all three pays a bonus.', daily.best >= 1],
      ['streak', 'Keep a 3-day goal streak', 'Finish every daily goal three days in a row: you get Lucky for the day.', daily.best >= 3],
      ['orchard', 'Plant a fruit tree', 'Mira sells apple, cherry and peach saplings. Plant one on open grass with room around it.', this.orchard.all.length > 0 || m('orchard')],
      ['gold', 'Harvest a gold-quality crop', 'Higher farming level and fertilizer make silver and gold harvests more likely.', m('gold_crop')],
      ['ghost', "Help the graveyard's ghost rest", 'Visit the graveyard (🪦 on the map) after 10pm and find her three lost belongings.', m('ghost_rest')],
      ['market', 'Trade at the ghost night market', 'Once Elsie is at rest, spirits trade in the graveyard from 10pm until the day ends.', m('night_market')],
    ];
    return steps.map(([id, text, hint, done]) => ({ id, text, hint, done }));
  }

  /** A skill went up a level: say so, and what it now gives. */
  private skillLevelUp(id: SkillId, level: number): void {
    const def = SKILLS[id];
    sfx('quest');
    this.fx.burst('sparkle', this.player.x, this.player.y - 20, 14);
    const perks = skillPerks(id, level);
    gameEvents.emit('toast', { text: `${def.emoji} ${def.name} level ${level}! ${perks[perks.length - 1]}.` });
    this.reportState(true);
  }

  /** Letters that point the way to new places. */
  private placesMorning(): void {
    const sent = (subject: string) => this.social.letters.some((l) => l.subject === subject);
    const day = this.time_.day;
    if (day >= 2 && !sent('The museum is open')) {
      this.social.send(day, 'Professor Hoot', 'The museum is open', 'Hoo! The valley museum is open at last — look for the columns by the path. Bring me fish, shells, stones and any old things you dig up, and I will put them on display. Finish a collection and I will send something nice.');
    }
    if (day >= 4 && !sent('That old boat')) {
      this.social.send(day, 'Finn', 'That old boat', "See the rowing boat tied up by the pier? It's got a hole in it, but patch it up (40 wood, 8 hardwood from the forest, 20 fiber) and you can row out to the island. Reef fish, coconuts… and folks say there's a cave.");
    }
  }


  // ---------- Emotes ----------

  private emotePicker = false;
  private cullTimer = 0;

  /** P: tell your pet to stay where it is, or to follow you again. */
  private togglePetStay(): void {
    const all = this.social.allPets;
    const pet = all.length ? { name: all.map((p) => p.name).join(' and ') } : undefined;
    if (!pet) {
      gameEvents.emit('toast', { text: "You don't have a pet yet." });
      return;
    }
    if (this.away) {
      gameEvents.emit('toast', { text: `${pet.name} ${all.length > 1 ? 'are' : 'is'} waiting back on the farm.` });
      return;
    }
    this.pets.staying = !this.pets.staying;
    this.rememberPetStay();
    this.pets.hop();
    const key = keyLabel(settings.get().keys.petStay);
    gameEvents.emit('toast', {
      text: this.pets.staying ? `${pet.name}: stay! (press ${key} to call them back)` : `${pet.name}: come on! ${pet.name} ${all.length > 1 ? 'follow' : 'follows'} you again.`,
    });
  }

  private toggleEmotePicker(): void {
    this.emotePicker = !this.emotePicker;
    gameEvents.emit('emote:picker', this.emotePicker);
  }

  /** An emoji bubble that floats over someone's head for a couple of seconds. */
  private showEmote(target: Phaser.GameObjects.Sprite, emote: string): void {
    const bubble = this.add
      .text(target.x, target.y - 40, emote, { fontSize: '28px', fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif', resolution: 2 })
      .setOrigin(0.5, 1)
      .setScale(0.32)
      .setDepth(DEPTH.fx + 5);
    const follow = () => bubble.setPosition(target.x, target.y - 40);
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, follow);
    this.tweens.add({ targets: bubble, scale: 0.4, duration: 160, yoyo: true });
    this.time.delayedCall(2200, () => {
      this.events.off(Phaser.Scenes.Events.POST_UPDATE, follow);
      this.tweens.add({ targets: bubble, alpha: 0, duration: 300, onComplete: () => bubble.destroy() });
    });
    sfx('talk', { volume: 0.4, rate: 1.3 });
  }

  // ---------- Pets ----------

  private offerPet(): void {
    const first = this.social.pet;
    if (first && this.social.pet2) return;
    this.social.petOffered = true;
    if (!first) {
      this.social.send(this.time_.day, 'Tobin', 'A couple of strays', "A cat and a dog have been sleeping on your doorstep. They look hungry — and they seem to like you. Pick one and give them a home?");
      return;
    }
    const other = first.kind === 'cat' ? 'dog' : 'cat';
    this.social.send(
      this.time_.day,
      'Tobin',
      `The ${other} came back`,
      `Remember the stray ${other}? It's been hanging around your door again, and ${first.name} doesn't seem to mind one bit. There's room for two, if you'd like to give it a home.`,
    );
  }

  /** Your pets, plus any stray waiting by the door (and staying pets back where you left them). */
  private showPets(): void {
    const owned = this.social.allPets.map((p) => p.kind);
    const strays = this.social.petOffered ? (['cat', 'dog'] as const).filter((k) => !owned.includes(k)) : [];
    this.pets.show(owned, strays);
    const stay = this.social.petStay;
    if (stay && owned.length) {
      this.pets.staying = true;
      for (const k of owned) if (stay[k]) this.pets.place(k, stay[k]!.x, stay[k]!.y);
    }
  }

  /** Saves where staying pets wait (or clears it when they follow again). */
  private rememberPetStay(): void {
    if (!this.pets.staying) {
      this.social.petStay = undefined;
      return;
    }
    const at: NonNullable<Social['petStay']> = {};
    for (const p of this.social.allPets) {
      const pos = this.pets.position(p.kind);
      if (pos) at[p.kind] = { x: Math.round(pos.x), y: Math.round(pos.y) };
    }
    this.social.petStay = at;
  }

  private petAction(x: number, y: number): { verb: string; run: () => void } | null {
    if (this.horse.exists && !this.horse.riding && this.horse.canMount()) {
      return { verb: `Ride ${this.horse.name}`, run: () => this.mountHorse() };
    }
    const kind = this.pets.near(x, y, 18) ?? this.pets.near(this.player.x, this.player.y, 14);
    if (!kind) return null;
    const pet = this.social.petOf(kind);
    if (!pet) {
      if (!this.pets.isStray(kind)) return null;
      return {
        verb: `Adopt the stray ${kind}`,
        run: () => {
          gameEvents.emit('pet:offer', { kind });
          this.setPanel('pet');
        },
      };
    }
    const day = this.time_.day;
    // Busy fetching or digging: wait for them (don't start a trick on top).
    if (this.pets.busy) return { verb: `${pet.name} is busy…`, run: () => undefined };
    const stick = this.state.inventory.selectedStack?.itemId;
    if (stick === 'wood' || stick === 'hardwood') {
      if (pet.kind === 'cat') {
        return { verb: `Show ${pet.name} a stick`, run: () => gameEvents.emit('toast', { text: `${pet.name} looks at the stick, then at you. Cats don't fetch.` }) };
      }
      return {
        verb: `Throw a stick for ${pet.name}`,
        run: () => {
          // A stick is too exciting to keep sitting still for.
          this.pets.staying = false;
          this.rememberPetStay();
          this.throwStick(pet);
        },
      };
    }
    if (pet.pettedDay === day) {
      return {
        verb: `Play with ${pet.name}`,
        run: () => {
          const what = this.pets.trick(pet.kind);
          if (what) gameEvents.emit('toast', { text: `${pet.name} ${what}!` });
        },
      };
    }
    return {
      verb: `Pet ${pet.name}`,
      run: () => {
        pet.pettedDay = day;
        pet.love = Math.min(1000, pet.love + 10);
        this.state.restoreEnergy(5);
        this.pets.hop(pet.kind);
        sfx('heart');
        this.fx.burst('heart', this.player.x, this.player.y - 20, 4);
        gameEvents.emit('toast', { text: `${pet.name} ${pet.kind === 'cat' ? 'purrs' : 'wags happily'}. (+5 energy)` });
        this.reportState(true);
      },
    };
  }

  /** Morning (single player): seasonal forage pops up in the meadows away from the farm. */
  private spawnWildForage(): void {
    if (this.coop) return;
    const { width, height, home } = this.world;
    const pool = FORAGE[this.time_.season];
    const size = GAME_CONFIG.tileSize;
    for (let n = 0, tries = 0; n < 6 && tries < 300; tries++) {
      const tx = Math.floor(Math.random() * width);
      const ty = Math.floor(Math.random() * height);
      if (Math.hypot(tx - home.tx, ty - home.ty) < 10) continue;
      if (terrainAt(this.world, tx, ty) !== Terrain.Grass || this.resources.isBlocked(tx, ty) || this.build.isBlocked(tx, ty) || this.farming.isTilled(tx, ty)) continue;
      this.drops.spawn(pool[Math.floor(Math.random() * pool.length)], 1, tx * size + 8, ty * size + 10);
      n++;
    }
  }

  /** Morning: a loved pet sometimes brings you something it found. */
  private petMorning(): void {
    // Strays turn up on day 2; once you have one pet, the other kind comes back a few days later.
    const first = this.social.pet;
    if (!this.social.petOffered && this.time_.day >= 2 && (!first || (!this.social.pet2 && this.time_.day >= 3))) {
      this.offerPet();
      this.showPets();
    }
    this.social.allPets.forEach((pet, i) => this.petGift(pet, i));
  }

  private petGift(pet: NonNullable<Social['pet']>, i: number): void {
    if (pet.love >= 30 && pet.foundDay !== this.time_.day && Math.random() < 0.35) {
      pet.foundDay = this.time_.day;
      const pool = FORAGE[this.time_.season];
      const item = pool[Math.floor(Math.random() * pool.length)];
      const door = this.doorPosition();
      this.drops.spawn(item, 1, door.x + (i ? -14 : 14), door.y + 6);
      this.time.delayedCall(1500 + i * 1200, () => gameEvents.emit('toast', { text: `${pet.name} brought you a ${ITEMS[item].name}!` }));
    }
  }

  private upgradeHouse(): void {
    const slot = this.state.inventory.selected;
    if (this.interior.level >= 1 || this.state.inventory.selectedStack?.itemId !== 'house_upgrade') return;
    if (this.state.inventory.removeAt(slot, 1) !== 1) return;
    this.interior = { ...this.interior, level: 1 };
    this.fx.burst('sparkle', this.player.x, this.player.y - 20, 14);
    sfx('place');
    gameEvents.emit('toast', { text: 'Willa extended your cottage — there is room for much more furniture now!' });
    this.reportState(true);
  }

  private beachData(arrival: 'gate' | 'boat'): BeachSceneData {
    return {
      host: this.areaHost(),
      arrival,
      forage: {
        taken: (day) => this.social.beachTaken(day),
        take: (day, id) => this.social.takeBeach(day, id),
      },
      boat: {
        repaired: () => this.social.island.boat,
        repair: () => this.repairBoat(),
        sail: () => this.switchArea(SCENES.Island, this.islandData('dock')),
      },
      tidal: {
        save: this.social.tidal,
        changed: () => this.reportState(true),
      },
    };
  }

  private enterBeach(): void {
    this.enterArea(SCENES.Beach, this.beachData('gate'));
  }

  private enterCottage(): void {
    const data: InteriorSceneData = {
      host: this.areaHost(),
      interior: this.interior,
      onChange: (interior) => {
        this.interior = structuredClone(interior);
        this.reportState(true);
      },
      sleep: () => this.goToSleep(false),
      ...(this.social.spouse ? { spouse: { id: this.social.spouse, name: NPCS[this.social.spouse].name } } : {}),
    };
    this.enterArea(SCENES.Interior, data);
  }

  /** Go into a side area (mine, beach, cottage): it runs on top while this scene keeps the clock and menus. */
  private enterArea(key: string, data: object): void {
    if (this.away) return;
    this.horse.dismount();
    this.markVisit(key);
    this.setPanel(null);
    this.fishing.cancel();
    this.player.stop();
    this.away = true;
    this.awayKey = key;
    this.interaction.update(false);
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.cameras.main.setVisible(false);
      this.scene.launch(key, data);
    });
    sfx('step', { rate: 0.6 });
  }

  /** Back outside: climbed out, fainted in the mine, or pulled out by the day ending. */
  private leaveArea(how: 'climbed' | 'fainted' | 'quiet'): void {
    if (!this.away) return;
    const key = this.awayKey;
    this.away = false;
    this.awayKey = null;
    if (key) this.scene.stop(key);
    gameEvents.emit('mine:floor', null);
    gameEvents.emit('area:label', null);
    gameEvents.emit('mine:boss', null);
    const camera = this.cameras.main;
    camera.setVisible(true);
    if (how === 'quiet') return;
    const size = GAME_CONFIG.tileSize;
    if (key === SCENES.Carnival) {
      const t = this.carnivalGate();
      this.player.placeAt(t.tx * size + 8, (t.ty - 1) * size + 12, 'up');
    } else if (key === SCENES.Forest) {
      const t = this.forestGate();
      this.player.placeAt((t.tx + 1) * size + 8, t.ty * size + 12, 'right');
    } else if (key === SCENES.Beach || key === SCENES.Island || key === SCENES.IslandCave) {
      const t = this.beachGate();
      this.player.placeAt((t.tx - 1) * size + 8, t.ty * size + 12, 'left');
    } else if (key === SCENES.Home || key === SCENES.Museum) {
      const lot = key === SCENES.Museum ? this.lots().museum : this.visiting ? this.lots().homes[this.visiting] : undefined;
      const w = key === SCENES.Museum ? 5 : 3;
      if (lot) this.player.placeAt((lot.tx + Math.floor(w / 2)) * size + 8, (lot.ty + 1) * size + 12, 'down');
    } else if (key === SCENES.Interior) {
      const door = this.doorPosition();
      this.player.placeAt(door.x, door.y, 'down');
    } else if (how === 'fainted') {
      const lost = Math.min(MINE.faintGoldLossMax, Math.floor(this.state.gold * MINE.faintGoldLoss));
      if (lost > 0) this.state.spendGold(lost);
      this.state.heal(Math.round(this.state.maxHealth * 0.4));
      const door = this.doorPosition();
      this.player.placeAt(door.x, door.y, 'down');
      gameEvents.emit('toast', { text: `Someone carried you home from the mine.${lost > 0 ? ` You lost ${lost}g on the way.` : ''}` });
    } else {
      const { mine } = this.world;
      this.player.placeAt((mine.tx + 1) * size, (mine.ty + 1) * size + 12, 'down');
    }
    camera.fadeIn(500, 0, 0, 0);
  }

  // ---------- Collection & achievements ----------

  private achievementContext(): Omit<AchievementContext, 'found'> {
    return {
      lifetimeEarnings: this.state.lifetimeEarnings,
      mineDepth: this.state.mineDepth,
      hearts: NPC_IDS.map((id) => this.social.hearts(id)),
      communityDone: COMMUNITY_GOALS.filter((g) => communityDone(this.community, g.id)).length,
      communityTotal: COMMUNITY_GOALS.length,
      furniture: Math.max(0, this.interior.furniture.length - (this.interior.furnished ? STARTER_FURNITURE.length : 0)),
      houseLevel: this.interior.level,
      livestock: this.livestock.serialize().length,
      day: this.time_.day,
    };
  }

  private noteFinds(slots: readonly (SlotData | null)[]): void {
    if (!this.collection) return;
    const fresh = this.collection.note(slots);
    if (fresh.length === 0 || !this.collectionReady) return;
    gameEvents.emit('toast', { text: `New in your collection: ${fresh.map((id) => ITEMS[id].name).join(', ')}` });
    this.checkAchievements();
    if (this.panel === 'collection') this.emitCollection();
  }

  private checkAchievements(): void {
    if (!this.state || !this.social) return;
    this.checkStory();
    this.checkTutorial();
    const fresh = this.collection.check(this.achievementContext());
    for (const a of fresh) {
      sfx('quest');
      gameEvents.emit('toast', { text: `🏆 Achievement unlocked: ${a.name} — ${a.description}` });
    }
    if (fresh.length) {
      this.reportState(true);
      if (this.panel === 'collection') this.emitCollection();
    }
  }

  private emitCollection(): void {
    gameEvents.emit('collection:state', { ...this.collection.view(this.achievementContext()), skills: SKILL_IDS.map((id) => ({ id, ...skills.progress(id) })) });
  }

  // ---------- Story, villager requests, first-day tips ----------

  private storyContext(): StoryContext {
    const buildings: Record<string, number> = {};
    for (const p of this.build.serialize()) buildings[p.kind] = (buildings[p.kind] ?? 0) + 1;
    return {
      found: this.collection.foundItems,
      met: NPC_IDS.filter((id) => NPCS[id].shop && this.social.pointsOf(id) > 0).length,
      mineDepth: this.state.mineDepth,
      lifetimeEarnings: this.state.lifetimeEarnings,
      buildings,
      communityDone: COMMUNITY_GOALS.filter((g) => communityDone(this.community, g.id)).length,
      communityTotal: COMMUNITY_GOALS.length,
      hearts: NPC_IDS.map((id) => this.social.hearts(id)),
    };
  }

  private checkStory(): void {
    const chapter = STORY[this.social.story];
    if (!chapter) return;
    const [have, need] = chapter.progress(this.storyContext());
    if (have < need) return;
    this.social.story += 1;
    if (chapter.reward.gold) this.state.receiveGold(chapter.reward.gold);
    const next = STORY[this.social.story];
    const body = `${chapter.from === 'Tobin' ? 'You did it.' : 'Thank you!'} ${chapter.reward.gold ? `Here's ${chapter.reward.gold}g` : 'Here'}${chapter.reward.item ? ' and a little something' : ''} for your trouble.${next ? `\n\nNext: ${next.from} says — “${next.text}”` : '\n\nThe whole valley is talking about you. Thank you for bringing it back to life.'}`;
    this.social.send(this.time_.day, chapter.from, `📖 ${chapter.title} — complete`, body, chapter.reward.item);
    sfx('quest');
    gameEvents.emit('toast', { text: `📖 Chapter complete: ${chapter.title}!${chapter.reward.gold ? ` +${chapter.reward.gold}g` : ''} Check your mailbox.` });
    if (next) gameEvents.emit('toast', { text: `New chapter: ${next.title} — ${next.goal}.` });
    if (this.panel === 'journal') this.emitJournal();
    this.reportState(true);
  }

  private emitJournal(): void {
    const ctx = this.storyContext();
    const chapter = STORY[this.social.story];
    const [have, need] = chapter ? chapter.progress(ctx) : [0, 0];
    gameEvents.emit('journal:state', {
      guide: this.guideSteps(),
      chapter: chapter ? { index: this.social.story, total: STORY.length, title: chapter.title, from: chapter.from, text: chapter.text, goal: chapter.goal, have, need } : null,
      arcs: (Object.keys(ARCS) as NpcId[]).map((npc) => {
        const steps = ARCS[npc]!;
        const done = this.social.arcs[npc] ?? 0;
        const step = steps[done];
        return {
          npc,
          name: NPCS[npc].name,
          hearts: this.social.hearts(npc),
          done,
          total: steps.length,
          step: step ? { text: step.text, want: step.want, have: this.state.inventory.count(step.want.itemId), needHearts: step.hearts } : null,
        };
      }),
    });
  }

  private deliverArc(npc: NpcId): void {
    if (this.panel !== 'journal') return;
    const step = ARCS[npc]?.[this.social.arcs[npc] ?? 0];
    if (!step) return;
    if (this.social.hearts(npc) < step.hearts) return void gameEvents.emit('toast', { text: `Become better friends with ${NPCS[npc].name} first.` });
    if (this.state.inventory.count(step.want.itemId) < step.want.quantity || !this.state.inventory.remove(step.want.itemId, step.want.quantity)) {
      sfx('error');
      return void gameEvents.emit('toast', { text: `You need ${step.want.quantity}× ${ITEMS[step.want.itemId].name}.` });
    }
    this.social.arcs[npc] = (this.social.arcs[npc] ?? 0) + 1;
    if (step.reward.gold) this.state.receiveGold(step.reward.gold);
    if (step.reward.item && this.state.inventory.add(step.reward.item.itemId, step.reward.item.quantity) > 0) {
      this.social.send(this.time_.day, NPCS[npc].name, 'Something for you', step.thanks, step.reward.item);
    }
    this.social.add(npc, 120);
    sfx('quest');
    this.emitJournal();
    gameEvents.emit('dialogue', { speaker: NPCS[npc].name, text: step.thanks });
    this.setPanel('dialogue');
    this.reportState(true);
  }

  private tutorialDone(id: TutorialStep): boolean {
    switch (id) {
      case 'move':
        return this.walked > 1500;
      case 'plant':
        return this.farming.serialize().some((p) => p.crop);
      case 'water':
        return this.farming.serialize().some((p) => p.crop && p.watered);
      case 'wood':
        return this.collection.foundItems.has('wood');
      case 'bag':
        return this.seen.has('bag');
      case 'mail':
        return this.social.letters.some((l) => l.read);
      case 'talk':
        return NPC_IDS.some((n) => this.social.pointsOf(n) > 0);
      case 'journal':
        return this.seen.has('journal');
      case 'sleep':
        return this.time_.day > 1;
    }
  }

  private checkTutorial(): void {
    let i = this.social.tutorial;
    if (i < 0) return;
    const start = i;
    while (i < TUTORIAL.length && this.tutorialDone(TUTORIAL[i].id)) i++;
    if (i === start) return;
    this.social.tutorial = i >= TUTORIAL.length ? -1 : i;
    sfx('sparkle', { volume: 0.5 });
    if (this.social.tutorial < 0) gameEvents.emit('toast', { text: "✓ That's the basics! Follow your journal (Q) for what to do next." });
    this.emitTutorial();
  }

  private emitTutorial(): void {
    const i = this.social.tutorial;
    gameEvents.emit('tutorial:tip', i >= 0 && i < TUTORIAL.length ? { index: i, total: TUTORIAL.length, text: TUTORIAL[i].text } : null);
  }

  // ---------- Shipping bin ----------

  private openShipping(): void {
    this.emitShipping();
    this.setPanel('shipping');
  }

  private shipSlot(slot: number): void {
    const stack = this.state.inventory.slots[slot];
    const value = stack ? withQuality(ITEMS[stack.itemId].sellPrice ?? 0, stack.q) : 0;
    const moved = this.state.ship(slot);
    if (moved) daily.note('ship', value * moved);
    if (!moved || !stack) {
      sfx('error');
      gameEvents.emit('toast', { text: stack ? `${ITEMS[stack.itemId].name} can't be shipped.` : 'Nothing to ship.' });
      return;
    }
    sfx('place', { rate: 0.8 });
    gameEvents.emit('toast', { text: `Shipped ${moved}× ${ITEMS[stack.itemId].name}. It sells overnight.` });
    this.emitShipping();
    this.reportState(true);
  }

  private emitShipping(): void {
    gameEvents.emit('ship:state', {
      bin: this.state.bin.map((s) => ({ itemId: s.itemId, quantity: s.quantity, gold: withQuality(ITEMS[s.itemId].sellPrice ?? 0, s.q) * s.quantity, ...(s.q ? { q: s.q } : {}) })),
      total: this.state.binValue,
    });
  }

  /** Morning report: the bin sold overnight. */
  private showSummary(shipped: { items: Array<{ itemId: ItemId; quantity: number; gold: number }>; total: number } | null | undefined): void {
    if (!shipped || shipped.items.length === 0) return;
    gameEvents.emit('day:summary', { day: this.time_.day - 1, season: this.time_.season, items: shipped.items, total: shipped.total, gold: this.state.gold });
    this.setPanel('summary');
    sfx('coin');
  }

  // ---------- Community projects ----------

  private donate(goal: CommunityGoalId, itemId: ItemId): void {
    if (this.panel !== 'board') return;
    const quantity = Math.min(this.state.inventory.count(itemId), communityRoom(this.community, goal, itemId));
    if (quantity <= 0) return;
    // The server checks donations against the backpack it last heard about.
    this.reportState(true);
    this.authority.request({ t: 'donate', goal, itemId, quantity }, (granted) => {
      const given = Math.min(granted.accepted ?? quantity, this.state.inventory.count(itemId));
      if (given <= 0 || !this.state.inventory.remove(itemId, given)) return;
      sfx('coin', { rate: 1.2 });
      gameEvents.emit('toast', { text: `Gave ${given}× ${ITEMS[itemId].name} to “${communityGoal(goal)?.title}”.` });
      this.recordDonation(goal, itemId, given);
      this.reportState(true);
    });
  }

  /** A donation landed (yours or a co-op partner's). */
  private recordDonation(goal: CommunityGoalId, itemId: ItemId, quantity: number): void {
    if (applyDonation(this.community, goal, itemId, quantity)) this.completeCommunityGoal(goal);
    gameEvents.emit('community:state', structuredClone(this.community));
  }

  /** Everyone gets paid and a thank-you letter. */
  private completeCommunityGoal(id: CommunityGoalId): void {
    const goal = communityGoal(id);
    if (!goal) return;
    this.state.receiveGold(goal.gold);
    this.social.send(this.time_.day, goal.from, `${goal.title} — done!`, `We did it! Thank you for helping with “${goal.title}”. Here's ${goal.gold}g and a little something for your home.`, goal.gift);
    this.fx.burst('sparkle', this.player.x, this.player.y - 20, 18);
    sfx('quest');
    gameEvents.emit('toast', { text: `Community project finished: ${goal.title}! +${goal.gold}g, and ${goal.from} sent you a gift.` });
    this.reportState(true);
  }

  // ---------- Village ----------

  private openShop(npcId: NpcId): void {
    if (!NPCS[npcId].shop) return;
    // A friend with something to share says it before business.
    if (this.playHeartEvent(npcId)) return;
    // Visiting the stall counts as today's chat.
    const { before, after } = this.social.talk(npcId, this.time_.day);
    this.shopNpc = npcId;
    this.emitShop();
    this.setPanel('shop');
    const npc = this.npcs.get(npcId);
    if (npc) this.npcs.face(npc, { x: this.player.x, y: this.player.y });
    if (after > before) this.heartUp(npcId);
  }

  private emitShop(): void {
    const id = this.shopNpc;
    if (!id) return;
    const def = NPCS[id];
    const hearts = this.social.hearts(id);
    const lines = def.lines;
    const pool = hearts >= 4 && lines.friend?.length ? lines.friend : lines.general;
    const offers: Partial<Record<ItemId, number>> = {};
    for (const itemId of ITEM_IDS) {
      const price = offerFor(id, itemId, festivalOn(this.time_.day)?.id ?? null);
      if (price !== undefined) offers[itemId] = price;
    }
    gameEvents.emit('shop:context', {
      npcId: id,
      name: def.name,
      title: def.title,
      shopTitle: def.shop?.title ?? def.name,
      greeting: pool[this.time_.day % pool.length],
      hearts,
      discount: this.social.discount(id),
      giftedToday: this.social.giftedToday(id, this.time_.day),
      stock: stockFor(id, this.state.lifetimeEarnings, this.time_.season, this.social.pointsOf(id)),
      offers,
      barter: def.shop?.barter ?? [],
      loves: [...def.gifts.loved],
      likes: [...def.gifts.liked],
    });
  }

  // ---------- Wildlife ----------

  /** Tells the player what the wildlife did overnight, and shows the culprits running off. */
  private wildlifeMorning(dawn: DawnReport): void {
    const toast = (text: string) => gameEvents.emit('toast', { text });
    this.ecosystem.playDawn(dawn);
    if (dawn.eaten.length > 0) {
      const n = dawn.eaten.length;
      const what = n === 1 ? `your ${dawn.eaten[0]}` : `${n} of your crops (${[...new Set(dawn.eaten)].join(', ')})`;
      toast(`🦌 A deer got onto the farm last night and ate ${what}. A closed fence, or a scarecrow within 4 tiles, keeps deer off your crops.`);
    }
    if (dawn.spooked.length > 0) {
      const n = dawn.spooked.length;
      toast(`🦊 A fox crept up to the coop at dawn — ${n === 1 ? 'one of your animals was' : `${n} of your animals were`} too spooked to lay. Fence the coop in, or keep a dog.`);
    }
    if (dawn.dogChased) {
      const dog = this.social.allPets.find((p) => p.kind === 'dog');
      toast(`🐕 ${dog?.name ?? 'Your dog'} barked a fox away from the coop at dawn. Good dog!`);
    }
  }

  // ---------- Heirloom seeds ----------

  /** On day 2 (or straight away in an older save) the Seed Library posts the valley's own heirloom seeds. */
  private heirloomLetters(): void {
    const h = this.social.heirloom;
    if (h.intro || this.time_.day < HEIRLOOM_START_DAY) return;
    h.intro = true;
    for (const id of nativeHeirlooms(this.seed)) {
      const crop = CROPS[id];
      this.social.send(
        this.time_.day,
        'Valley Seed Library',
        `Heirloom seeds: ${crop.name}`,
        `Every valley keeps a few old varieties of its own, and ${crop.name} is one of yours — ${HEIRLOOMS[id].blurb.toLowerCase()} It grows just like ${CROPS[HEIRLOOMS[id].base].name.toLowerCase()} (${crop.seasons.join(' and ')}), but fetches a far better price. Save seeds when you harvest, and share them: at your mailbox you can pack seeds into a parcel code for a friend, whose valley won't grow this one. — The Seed Library`,
        { itemId: crop.seedItem, quantity: HEIRLOOM_STARTER_SEEDS },
      );
    }
  }

  /** Pack heirloom seeds from the bag into a parcel code for a friend's world. */
  private packSeeds(itemId: ItemId, quantity: number): void {
    if (this.panel !== 'mail') return;
    const heirloom = heirloomOfSeed(itemId);
    const inv = this.state.inventory;
    if (!heirloom || !(SEED_PARCEL_SIZES as readonly number[]).includes(quantity) || inv.count(itemId) < quantity || !inv.remove(itemId, quantity)) {
      gameEvents.emit('toast', { text: `You need ${quantity} heirloom seeds of one kind to pack a parcel.` });
      sfx('error');
      return;
    }
    const h = this.social.heirloom;
    h.sent += 1;
    const code = encodeSeedParcel({ heirloom, quantity, nonce: h.sent, from: worldTag(this.seed) });
    this.lastParcel = { code, name: ITEMS[itemId].name, quantity };
    sfx('place');
    gameEvents.emit('toast', { text: `🌱 Packed ${quantity} ${ITEMS[itemId].name}. Send the code to a friend!` });
    this.reportState(true);
    this.emitSeeds();
  }

  /** Open a friend's seed parcel by its code (once per parcel, and not one packed in this world). */
  private redeemSeeds(code: string): void {
    if (this.panel !== 'mail') return;
    const toast = (text: string) => gameEvents.emit('toast', { text });
    const parcel = decodeSeedParcel(code);
    if (!parcel) {
      toast("That isn't a seed parcel code. Check it for typos — it starts with HV-.");
      sfx('error');
      return;
    }
    if (parcel.from === worldTag(this.seed)) {
      toast('This parcel was packed in this valley. Send it to a friend whose valley grows something else!');
      sfx('error');
      return;
    }
    const h = this.social.heirloom;
    const key = parcelKey(parcel);
    if (h.redeemed.includes(key)) {
      toast("You've already opened this parcel.");
      sfx('error');
      return;
    }
    h.redeemed = [...h.redeemed, key].slice(-MAX_REDEEMED_PARCELS);
    const seed = CROPS[parcel.heirloom].seedItem;
    const native = nativeHeirlooms(this.seed).includes(parcel.heirloom);
    this.giveOrDrop(seed, parcel.quantity);
    sfx('sparkle');
    toast(`🌱 You open the parcel: ${parcel.quantity} ${ITEMS[seed].name}${native ? '' : ' — a variety your valley has never grown!'}`);
    this.reportState(true);
    this.emitSeeds();
  }

  private emitSeeds(): void {
    const inv = this.state.inventory;
    const found = this.collection.foundItems;
    gameEvents.emit('seeds:state', {
      native: nativeHeirlooms(this.seed).map((id) => ({ itemId: CROPS[id].harvestItem, name: CROPS[id].name, seasons: CROPS[id].seasons.join(' & ') })),
      holding: HEIRLOOM_IDS.map((id) => CROPS[id].seedItem)
        .filter((seed) => inv.count(seed) > 0)
        .map((seed) => ({ itemId: seed, name: ITEMS[seed].name, have: inv.count(seed) })),
      grown: HEIRLOOM_IDS.filter((id) => found.has(CROPS[id].harvestItem)).length,
      total: HEIRLOOM_IDS.length,
      sizes: [...SEED_PARCEL_SIZES],
      parcel: this.lastParcel,
    });
  }

  // ---------- The ghost night market ----------

  /** Open tonight: Elsie is at rest and her note about the market has arrived (so it starts the night after she moves on). */
  private marketOpenNow(): boolean {
    return this.social.nightMarket.intro === true && nightMarketOpen(this.social.ghost.stage, this.time_.minute);
  }

  private openMarket(spirit: SpiritId): void {
    this.marketSpirit = spirit;
    sfx('ghost', { volume: 0.4 });
    this.emitMarket();
    this.setPanel('market');
  }

  /** The morning after Elsie moves on (or the first daytime in an older save), a note about the market. */
  private nightMarketNote(): void {
    const market = this.social.nightMarket;
    if (market.intro || this.social.ghost.stage < 3 || this.time_.minute >= NIGHT_MARKET_HOURS.from) return;
    market.intro = true;
    this.social.send(
      this.time_.day,
      'A note in faded ink',
      'The night market',
      "Dear friend — I'm resting now, truly. But some old friends of mine still wander, and they'd like to meet you. From ten o'clock each night they keep a little market in the graveyard: Old Wick buys the strange things the living throw away, Madame Moth trades curiosities for curiosities, and the Ferryman always has something rare (for a coin — he's old-fashioned). Do say hello. — E.",
    );
  }

  /** The market can only be used while it's open, with its panel up. */
  private marketReady(): boolean {
    if (this.panel !== 'market') return false;
    if (this.marketOpenNow()) return true;
    gameEvents.emit('toast', { text: 'The spirits have faded away with the night.' });
    this.setPanel(null);
    return false;
  }

  /** Gives an item, dropping what doesn't fit at the player's feet. */
  private giveOrDrop(itemId: ItemId, quantity: number): void {
    const left = this.state.inventory.add(itemId, quantity);
    if (quantity - left > 0) gameEvents.emit('item:collected', { itemId, quantity: quantity - left });
    if (left > 0) {
      this.drops.spawn(itemId, left, this.player.x, this.player.y - 4);
      gameEvents.emit('toast', { text: 'Your backpack is full — it landed at your feet.' });
    }
  }

  private marketTraded(): void {
    if (this.social.mark('night_market')) gameEvents.emit('toast', { text: '📖 Guide: you traded at the ghost night market!' });
    this.emitMarket();
  }

  private marketSell(itemId: ItemId, all: boolean): void {
    if (!this.marketReady()) return;
    const entry = WICK_BUYS.find((b) => b.itemId === itemId);
    const inv = this.state.inventory;
    const have = entry ? inv.count(itemId) : 0;
    const n = all ? have : Math.min(1, have);
    if (!entry || n <= 0 || !inv.remove(itemId, n)) {
      gameEvents.emit('toast', { text: "You don't have that with you." });
      sfx('error');
      return;
    }
    const gold = entry.price * n;
    this.state.earn(gold);
    sfx('coin');
    gameEvents.emit('toast', { text: `🕯 Old Wick takes ${n} ${ITEMS[itemId].name} and presses ${gold.toLocaleString()}g into your hand. It's cold.` });
    this.marketTraded();
  }

  private marketBarter(index: number): void {
    if (!this.marketReady()) return;
    const trade = MOTH_TRADES[index];
    const inv = this.state.inventory;
    if (!trade || trade.give.some((g) => inv.count(g.itemId) < g.quantity)) {
      gameEvents.emit('toast', { text: '🦋 "Not quite enough curiosities, darling."' });
      sfx('error');
      return;
    }
    for (const g of trade.give) inv.remove(g.itemId, g.quantity);
    this.giveOrDrop(trade.get.itemId, trade.get.quantity);
    sfx('sparkle');
    gameEvents.emit('toast', { text: `🦋 Madame Moth hands you ${trade.get.quantity > 1 ? `${trade.get.quantity} ` : 'a '}${ITEMS[trade.get.itemId].name}. "Charming doing business."` });
    this.marketTraded();
  }

  private marketBuy(index: number): void {
    if (!this.marketReady()) return;
    const day = this.time_.day;
    const market = this.social.nightMarket;
    if (market.day !== day) {
      market.day = day;
      market.bought = [];
    }
    const offer = ferryOffers(this.seed, day)[index];
    if (!offer || market.bought.includes(index)) {
      gameEvents.emit('toast', { text: '⛵ "That one has already crossed tonight."' });
      sfx('error');
      return;
    }
    if (!this.state.spendGold(offer.price)) {
      gameEvents.emit('toast', { text: `⛵ "The toll is ${offer.price.toLocaleString()}g. No coin, no crossing."` });
      sfx('error');
      return;
    }
    market.bought.push(index);
    this.giveOrDrop(offer.itemId, 1);
    sfx('coin');
    gameEvents.emit('toast', { text: `⛵ The Ferryman bows and hands you a ${ITEMS[offer.itemId].name}.` });
    this.reportState(true);
    this.marketTraded();
  }

  private emitMarket(): void {
    const inv = this.state.inventory;
    const day = this.time_.day;
    const market = this.social.nightMarket;
    const bought = market.day === day ? market.bought : [];
    gameEvents.emit('market:state', {
      spirit: this.marketSpirit,
      spirits: SPIRIT_IDS.map((id) => ({ id, name: SPIRITS[id].name, title: SPIRITS[id].title, emoji: SPIRITS[id].emoji, greeting: SPIRITS[id].greeting })),
      gold: this.state.gold,
      wick: WICK_BUYS.map((b) => ({ itemId: b.itemId, itemName: ITEMS[b.itemId].name, price: b.price, have: inv.count(b.itemId) })),
      moth: MOTH_TRADES.map((t, index) => ({
        index,
        give: t.give.map((g) => ({ itemId: g.itemId, itemName: ITEMS[g.itemId].name, quantity: g.quantity, have: inv.count(g.itemId) })),
        get: { itemId: t.get.itemId, itemName: ITEMS[t.get.itemId].name, quantity: t.get.quantity },
        can: t.give.every((g) => inv.count(g.itemId) >= g.quantity),
      })),
      ferry: ferryOffers(this.seed, day).map((o, index) => ({ index, itemId: o.itemId, itemName: ITEMS[o.itemId].name, price: o.price, bought: bought.includes(index) })),
    });
  }

  // ---------- Train contracts ----------

  private openFreight(): void {
    this.freightTick();
    this.emitFreight();
    this.setPanel('freight');
  }

  /** Whether the player could get hold of an item: held it before, or can buy its seeds now. */
  private canGetForFreight(itemId: ItemId): boolean {
    if (this.collection.has(itemId)) return true;
    const crop = Object.values(CROPS).find((c) => c.harvestItem === itemId);
    if (!crop) return false;
    const seed = ITEMS[crop.seedItem];
    return this.collection.has(crop.seedItem) || (seed.buyPrice !== undefined && (seed.unlockAtEarnings ?? 0) <= this.state.lifetimeEarnings);
  }

  /** Moves the freight orders along to the current game minute, and announces what happened. */
  private freightTick(): void {
    if (!this.train || !this.lots().depot) return;
    const clock = `${this.time_.day}:${this.time_.minute}`;
    if (clock === this.freightClock) return;
    this.freightClock = clock;
    const train = this.train;
    const events = this.freight.update(
      { day: this.time_.day, minute: this.time_.minute },
      {
        seed: this.seed,
        player: this.coop?.session.selfId ?? 'solo',
        lifetimeEarnings: this.state.lifetimeEarnings,
        canGet: (itemId) => this.canGetForFreight(itemId),
        departures: (day) => train.departures(day),
      },
    );
    for (const e of events) this.announceFreight(e);
    this.showFreightGoods();
    if (events.length > 0 && this.panel === 'freight') this.emitFreight();
  }

  private announceFreight(e: FreightEvent): void {
    const toast = (text: string) => gameEvents.emit('toast', { text });
    const day = this.time_.day;
    if (e.kind === 'intro') {
      this.social.send(
        day,
        'Valley Rail Freight',
        'The freight depot is open',
        'Good news from the railway! Towns down the line will post orders on the board at our freight depot, beside the tracks (🚉 on your map). Load the goods there over as many trips as you like before the date on the order. The next train takes a full order away, and the payment comes back on the first train of a later day — well above shipping prices. If an order misses its date, whatever you loaded still goes out and is paid at shipping prices. Safe travels!',
      );
      return;
    }
    if (e.kind === 'posted') {
      toast(`🚉 ${e.count === 1 ? 'A new freight order is' : `${e.count} new freight orders are`} up at the depot by the railway.`);
      return;
    }
    const c = e.contract;
    const town = TOWNS[c.town];
    const name = ITEMS[c.itemId].name;
    const n = c.partial ? c.loaded : c.quantity;
    if (e.kind === 'expired') {
      toast(`${town.emoji} ${town.name}'s order for ${c.quantity} ${name} passed its date.`);
    } else if (e.kind === 'picked') {
      toast(`🚂 The ${formatClock(e.minute)} train took ${n} ${name} to ${town.name}. Payment comes back on a later train.`);
    } else {
      this.state.earn(e.gold);
      sfx('coin');
      toast(`💰 ${town.name} paid ${e.gold.toLocaleString()}g for ${n} ${name} (on the ${formatClock(e.minute)} train).`);
      const body = c.partial
        ? `The ${n} ${name} you loaded went out after our date, so we've paid the shipping price for them: ${e.gold.toLocaleString()}g. We'll post again soon. — ${town.sender}`
        : `All ${n} ${name} arrived safe and sound. Here is your payment of ${e.gold.toLocaleString()}g, with our thanks. We'll keep sending orders your way. — ${town.sender}`;
      this.social.send(day, town.sender, `Payment for ${n} ${name}`, body);
      if (!c.partial && this.social.mark('freight')) toast('📖 Guide: you delivered your first train contract!');
    }
  }

  /** Sacks and a crate on the platform while goods wait there for the train. */
  private showFreightGoods(): void {
    const d = this.lots().depot;
    if (!d || !this.textures.exists('freight-goods')) return;
    const waiting = this.freight.contracts.some((c) => (c.status === 'open' && c.loaded > 0) || c.status === 'ready');
    if (waiting && !this.freightGoods) {
      const size = GAME_CONFIG.tileSize;
      const y = (d.ty + 1) * size + 10;
      this.freightGoods = this.add.image((d.tx + 0.6) * size, y, 'freight-goods').setOrigin(0.5, 1).setDepth(DEPTH.ySortBase + y);
    } else if (!waiting && this.freightGoods) {
      this.freightGoods.destroy();
      this.freightGoods = null;
    }
  }

  private emitFreight(): void {
    const day = this.time_.day;
    const minute = this.time_.minute;
    const trains = (this.train?.departures(day) ?? []).filter((m) => m >= minute);
    const next = trains[0];
    const label = (d: number) => {
      const s = seasonOfDay(d);
      return `${s[0].toUpperCase()}${s.slice(1)} ${dayOfSeason(d)}`;
    };
    const inv = this.state.inventory;
    gameEvents.emit('freight:state', {
      trains: trains.map((m) => formatClock(m)),
      towns: TOWN_IDS.map((id) => {
        const delivered = this.freight.delivered(id);
        return { name: TOWNS[id].name, emoji: TOWNS[id].emoji, blurb: TOWNS[id].blurb, delivered, bonus: Math.round((freightPremium(delivered) - FREIGHT_PREMIUM) * 100) };
      }),
      orders: this.freight.contracts.map((c) => {
        let note = '';
        if (c.status === 'ready') note = next !== undefined ? `Loaded — goes out on the ${formatClock(next)} train.` : 'Loaded — goes out on the first train tomorrow.';
        else if (c.status === 'shipped') note = c.shippedDay === day ? 'On its way — payment comes back on the first train tomorrow.' : 'On its way — payment comes back on the next train.';
        return {
          id: c.id,
          townName: TOWNS[c.town].name,
          emoji: TOWNS[c.town].emoji,
          itemId: c.itemId,
          itemName: ITEMS[c.itemId].name,
          quantity: c.quantity,
          loaded: c.loaded,
          have: inv.count(c.itemId),
          due: label(c.due),
          daysLeft: c.due - day,
          reward: c.reward,
          status: c.status,
          ...(c.pay !== undefined ? { pay: c.pay } : {}),
          ...(c.partial ? { partial: true } : {}),
          note,
        };
      }),
    });
  }

  private openBoard(): void {
    this.emitBoard();
    this.setPanel('board');
  }

  private emitBoard(): void {
    gameEvents.emit('community:state', structuredClone(this.community));
    gameEvents.emit('board:state', {
      requests: this.quests.view(this.state).map((r) => ({
        index: r.index,
        npcName: r.npcName,
        itemId: r.itemId,
        itemName: r.itemName,
        quantity: r.quantity,
        have: r.have,
        reward: r.reward,
        text: r.text,
        done: r.done,
      })),
      friends: this.social.view(this.time_.day),
    });
  }

  private talkTo(npc: Npc): void {
    const id = npc.def.id;
    if (this.playHeartEvent(id)) {
      this.npcs.face(npc, { x: this.player.x, y: this.player.y });
      return;
    }
    const { before, after } = this.social.talk(id, this.time_.day);
    daily.note('talk', 1, id);
    const text = this.npcs.talk(
      npc,
      { day: this.time_.day, season: this.time_.season, weather: this.weather.current, hearts: this.social.hearts(id) },
      { x: this.player.x, y: this.player.y },
    );
    gameEvents.emit('dialogue', { speaker: npc.def.name, text, hearts: this.social.hearts(id) });
    this.setPanel('dialogue');
    if (after > before) this.heartUp(id);
  }

  private giveGift(npcId: NpcId, slot: number): void {
    const stack = this.state.inventory.slots[slot];
    if (!stack || !Social.giftable(stack.itemId)) {
      sfx('error');
      gameEvents.emit('toast', { text: "That can't be given as a gift." });
      return;
    }
    const itemId = stack.itemId;
    const name = NPCS[npcId].name;
    if (itemId === 'bouquet' || itemId === 'pendant') return this.romance(npcId, slot, itemId);
    if (this.social.giftedToday(npcId, this.time_.day)) {
      sfx('error');
      gameEvents.emit('toast', { text: `You've already given ${name} a gift today.` });
      return;
    }
    if (this.state.inventory.removeAt(slot, 1) !== 1) return;
    const lights = festivalOn(this.time_.day)?.id === 'winter_lights';
    const birthday = birthdayOn(this.time_.day) === npcId;
    const result = this.social.gift(npcId, itemId, this.time_.day, (lights ? 2 : 1) * (birthday ? BIRTHDAY_GIFT_MULTIPLIER : 1))!;
    const reply = birthday
      ? result.reaction === 'loved'
        ? 'You remembered my birthday — and it\'s perfect! Thank you!'
        : 'A birthday present? For me? You\'re so thoughtful!'
      : result.reaction === 'loved'
        ? 'I love this! Thank you so much!'
        : result.reaction === 'liked'
          ? 'Oh, how nice. Thank you!'
          : "Thanks, that's kind of you.";
    if (birthday) this.social.mark('birthday_gift');
    daily.note('gift');
    this.npcs.say(npcId, reply);
    const npc = this.npcs.get(npcId);
    if (npc) this.fx.burst('heart', npc.sprite.x, npc.sprite.y - 20, result.reaction === 'loved' ? 8 : result.reaction === 'liked' ? 5 : 2);
    sfx('heart');
    const mood = result.reaction === 'loved' ? 'loved' : result.reaction === 'liked' ? 'liked' : 'accepted';
    gameEvents.emit('toast', { text: `${name} ${mood} the ${ITEMS[itemId].name}.` });
    if (result.after > result.before) this.heartUp(npcId);
  }

  /** Bouquets start dating; a pendant at full hearts is a proposal. */
  private romance(npcId: NpcId, slot: number, itemId: 'bouquet' | 'pendant'): void {
    const name = NPCS[npcId].name;
    const hearts = this.social.hearts(npcId);
    const say = (lines: string[]) => this.sayLines(lines.map((text) => ({ speaker: name, text })));
    if (this.social.spouse) return say([this.social.spouse === npcId ? "We're already married, silly!" : "You're married! I couldn't."]);
    if (itemId === 'bouquet') {
      if (this.social.dating === npcId) return say(["We're already together. But… thank you."]);
      if (this.social.dating) return say(["Aren't you seeing someone already?"]);
      if (hearts < ROMANCE.bouquetHearts) return say(["Flowers? That's sweet… but I don't know you well enough yet."]);
      if (this.state.inventory.removeAt(slot, 1) !== 1) return;
      this.social.dating = npcId;
      sfx('heart');
      say(['A bouquet? For me?', "…Yes. I'd like that. I'd like that a lot."]);
      gameEvents.emit('toast', { text: `💕 You and ${name} are dating!` });
    } else {
      if (this.social.dating !== npcId) return say(["That's beautiful… but it's not meant for me, is it?"]);
      if (hearts < ROMANCE.pendantHearts) return say(['I love you too. But let’s not rush. Give it a little more time?']);
      if (this.social.weddingDay !== undefined) return say(["We're already engaged! Just a few more days."]);
      if (this.state.inventory.removeAt(slot, 1) !== 1) return;
      this.social.weddingDay = this.time_.day + ROMANCE.weddingDelay;
      sfx('quest');
      say(['Is that… a pendant?', 'Yes! Yes, yes, yes!', `Let's have the wedding in ${ROMANCE.weddingDelay} days. I'll tell everyone!`]);
      gameEvents.emit('toast', { text: `💍 You're engaged to ${name}! The wedding is in ${ROMANCE.weddingDelay} days.` });
    }
    this.reportState(true);
  }

  /** Morning: the wedding, and a married partner's help around the farm. */
  private romanceMorning(): void {
    const s = this.social;
    if (s.dating && s.weddingDay !== undefined && this.time_.day >= s.weddingDay) {
      const name = NPCS[s.dating].name;
      s.spouse = s.dating;
      s.dating = undefined;
      s.weddingDay = undefined;
      s.send(this.time_.day, 'Everyone', 'Congratulations!', `The whole valley turned out for the wedding. ${name} has moved into your cottage — say good morning sometime!`, { itemId: 'pumpkin_pie', quantity: 2 });
      this.time.delayedCall(1200, () => this.sayLines([
        { speaker: name, text: "Today's the day! The whole valley came." },
        { speaker: name, text: "I've moved my things into the cottage. Our cottage." },
        { speaker: name, text: "I'll help around the farm when I can. Now — let's go home." },
      ]));
      gameEvents.emit('toast', { text: `💒 You married ${name}!` });
      return;
    }
    if (!s.spouse) return;
    const name = NPCS[s.spouse].name;
    const roll = Math.random();
    if (roll < 0.35 && !this.coop) {
      const plots = this.farming.serialize().filter((p) => p.crop && !p.watered).length;
      if (plots > 0) {
        this.farming.waterAll();
        this.time.delayedCall(1500, () => gameEvents.emit('toast', { text: `${name} watered the crops this morning. 💧` }));
        return;
      }
    }
    if (roll < 0.6 && !this.coop) {
      const barns = this.build.ofKind('barn');
      if (barns.length) {
        for (const b of barns) b.hay = Math.min(BARN.hayCapacity, (b.hay ?? 0) + 6);
        this.time.delayedCall(1500, () => gameEvents.emit('toast', { text: `${name} put fresh hay in the barn.` }));
        return;
      }
    }
    if (roll < 0.85) {
      const breakfast: ItemId = (['omelette', 'bread', 'corn_chowder', 'veggie_soup'] as ItemId[])[Math.floor(Math.random() * 4)];
      if (this.state.inventory.add(breakfast, 1) === 0) this.time.delayedCall(1500, () => gameEvents.emit('toast', { text: `${name} made you breakfast: ${ITEMS[breakfast].name}.` }));
    }
  }

  private heartUp(npcId: NpcId): void {
    const hearts = this.social.hearts(npcId);
    gameEvents.emit('toast', { text: `♥ ${NPCS[npcId].name} — ${hearts} heart${hearts === 1 ? '' : 's'}!${hearts % 2 === 0 && NPCS[npcId].shop ? ' (better prices)' : ''}` });
    sfx('heart');
  }

  /** Sitting on a bench: a short break that restores some energy. */
  private rest(): void {
    if (this.time_.minute >= TIME_CONFIG.dayEndMinute - 50) {
      gameEvents.emit('toast', { text: "It's too late to sit around — go to bed!" });
      sfx('error');
      return;
    }
    if (this.state.energy >= this.state.maxEnergy) {
      gameEvents.emit('toast', { text: "You're well rested already." });
      return;
    }
    this.time_.set(this.time_.day, this.time_.minute + 30);
    this.state.restoreEnergy(15);
    this.fx.burst('sparkle', this.player.x, this.player.y - 18, 6);
    sfx('eat', { rate: 0.8 });
    gameEvents.emit('toast', { text: 'You take a short break on the bench. (+15 energy)' });
    this.emitTime();
  }

  /** Each morning, every sprinkler waters the four plots next to it. */
  private runSprinklers(): number {
    let count = 0;
    for (const kind of ['sprinkler', 'iron_sprinkler', 'gold_sprinkler'] as const) {
      for (const s of this.build.ofKind(kind)) for (const [x, y] of sprinklerTiles(kind, s.tx, s.ty)) if (this.farming.soak(x, y)) count++;
    }
    return count;
  }

  /** Auto-collectors move finished machine goods into the nearest chest or shed (single player). */
  private runCollectors(): number {
    if (this.coop) return 0;
    const now = gameTime(this.time_.day, this.time_.minute);
    const storages = [...this.build.ofKind('chest'), ...this.build.ofKind('shed')];
    let moved = 0;
    for (const c of this.build.ofKind('collector')) {
      const store = storages
        .filter((s) => s.storage && Math.max(Math.abs(s.tx - c.tx), Math.abs(s.ty - c.ty)) <= 4)
        .sort((a, b) => Math.hypot(a.tx - c.tx, a.ty - c.ty) - Math.hypot(b.tx - c.tx, b.ty - c.ty))[0];
      if (!store?.storage) continue;
      const seen = new Set<Placed>();
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const m = this.build.at(c.tx + dx, c.ty + dy);
          if (!m || seen.has(m) || !isMachineKind(m.kind) || !m.machine || now < m.machine.readyAt) continue;
          seen.add(m);
          if (store.storage.add(m.machine.output, 1) > 0) continue;
          this.build.setMachine(m, null, now);
          moved++;
        }
      }
    }
    return moved;
  }

  /** Moves a whole stack between the open chest and the backpack. */
  private transferChest(from: 'chest' | 'inventory', slot: number): void {
    const chest = this.build.openChest?.storage;
    if (this.panel !== 'chest' || !chest || !Number.isInteger(slot)) return;
    if (this.coop) {
      this.transferSharedChest(from, slot);
      return;
    }
    const source = from === 'chest' ? chest : this.state.inventory;
    const target = from === 'chest' ? this.state.inventory : chest;
    const stack = source.slots[slot];
    if (!stack) return;
    const leftover = target.add(stack.itemId, stack.quantity, stack.q ?? 0);
    const moved = stack.quantity - leftover;
    if (moved > 0) source.removeAt(slot, moved);
    else gameEvents.emit('toast', { text: `No room for ${ITEMS[stack.itemId].name}` });
  }

  private toggleCollisionDebug(): void {
    const world = this.physics.world;
    const enable = !(world.drawDebug && world.debugGraphic?.visible);
    // Note: createDebugGraphic() itself switches drawDebug on, so set state after it.
    if (!world.debugGraphic) world.createDebugGraphic();
    world.drawDebug = enable;
    world.debugGraphic.clear().setVisible(enable).setDepth(DEPTH.debug);
  }
}
