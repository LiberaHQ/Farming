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
} from '@farming/shared';
import { repaintPlayer, TEXTURES } from '../assets/registerTextures';
import { GRASS_VARIANTS, TILE, TILE_MARGIN, TILE_SPACING, WATER_TILE_INDICES } from '../assets/tileIndex';
import { DEPTH, SCENES } from '../constants';
import { Player } from '../entities/Player';
import { gameCommands, gameEvents, type GameCommandMap, type PanelId } from '../events/GameEventBus';
import { drawWorldMap, MAP_SCALE } from '../maps/mapImage';
import { buildGroundIndices } from '../maps/tileResolver';
import { generateWorld } from '../maps/WorldGenerator';
import { terrainAt, type WorldData } from '../maps/WorldData';
import { barterWith, buyFrom, craft, offerFor, sellTo, stockFor, type TxResult } from '../state/economy';
import { Quests } from '../state/Quests';
import { Social } from '../state/Social';
import { PlayerState } from '../state/PlayerState';
import { LocalSaveStore, SAVE_VERSION, type SaveData, type SaveStore } from '../state/save';
import type { AppearanceChoice } from '@farming/shared';
import { AmbientLifeSystem } from '../systems/AmbientLifeSystem';
import { AnimalSystem } from '../systems/AnimalSystem';
import { FishingSystem } from '../systems/FishingSystem';
import { BuildSystem, type Placed } from '../systems/BuildSystem';
import { CameraSystem } from '../systems/CameraSystem';
import { DropSystem } from '../systems/DropSystem';
import { FarmingSystem } from '../systems/FarmingSystem';
import { FxSystem } from '../systems/FxSystem';
import { GrassRustleSystem } from '../systems/GrassRustleSystem';
import { DAY_LENGTHS, settings } from '../settings';
import { Collection } from '../state/Collection';
import type { ForestSceneData } from './ForestScene';
import type { CarnivalHost, CarnivalSceneData } from './CarnivalScene';
import { drawArch } from '../assets/carnival';
import { WaypointSystem } from '../systems/WaypointSystem';
import { PetSystem } from '../systems/PetSystem';
import { downloadSave } from '../state/saveFile';
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
    if (save) {
      this.resources.restore(save.resources);
      // Saves from before the village market: clear the market area and add its stalls and board.
      this.resources.clearArea(this.world.market);
      const { mine } = this.world;
      this.resources.clearArea({ x0: mine.tx - 1, y0: mine.ty - 1, x1: mine.tx + 2, y1: mine.ty + 1 });
      for (const spec of this.world.objects) if (spec.kind === 'stall' || spec.kind === 'board' || spec.kind === 'mine') this.resources.ensure(spec);
    } else this.resources.spawnAll(this.world.objects);

    if (save) {
      // Friends' cabins only stand while they're playing with you.
      for (const p of save.placed) if (p.kind !== 'cabin' || this.coop) this.build.place(p.kind, p.tx, p.ty, p.items, p.machine, p.hay);
      this.farming.restore(save.farm);
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
    const arch = this.carnivalGate();
    if (!this.textures.exists('carnival-arch')) this.textures.addCanvas('carnival-arch', drawArch().toCanvas());
    const archBase = (arch.ty + 1) * GAME_CONFIG.tileSize - 2;
    this.add
      .image((arch.tx + 0.5) * GAME_CONFIG.tileSize, archBase, 'carnival-arch')
      .setOrigin(0.5, 1)
      .setScale(0.75)
      .setDepth(DEPTH.ySortBase + archBase);
    this.add
      .text((arch.tx + 0.5) * GAME_CONFIG.tileSize, archBase - 27, 'CARNIVAL', { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '6px', fontStyle: 'bold', color: '#fff1a8', stroke: '#2b1d1a', strokeThickness: 3 })
      .setOrigin(0.5, 1)
      .setResolution(8)
      .setDepth(DEPTH.ySortBase + archBase + 1);
    const gate = this.beachGate();
    this.signpost = this.add
      .image((gate.tx + 0.5) * GAME_CONFIG.tileSize, gate.ty * GAME_CONFIG.tileSize, TEXTURES.signpost)
      .setOrigin(0.5, 1)
      .setDepth(gate.ty * GAME_CONFIG.tileSize);
    for (const c of save?.chickens ?? []) this.animals.addChicken(c.x, c.y, { x: c.homeX, y: c.homeY }, c.kind);

    this.npcs = new NpcSystem(this, this.world);
    this.social = new Social(() => this.onSocialChange());
    this.social.restore(save?.social);
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
        `The old mine is ${way === 'near' ? 'close by' : `${way} of your cottage`}, about ${Math.round(Math.hypot(dx, dy))} steps — look for the dark cave mouth in the rocks and press E at it. Ore gets better the deeper you go. And if you follow the path all the way east, there's a signpost to the beach. Open your map (M) to see both.`,
        { itemId: 'sword', quantity: 1 },
      );
    }
    this.npcs.setWeather(this.weather.current);
    this.quests = new Quests(this.seed);
    this.quests.restore(save?.quests, this.time_.day, this.time_.season);
    this.fishing = new FishingSystem(this, this.player, this.state, this.drops, fx);
    this.fishing.isHeld = () => this.controls.useHeld();
    this.ambient = new AmbientLifeSystem(this, this.world);

    new WaterGlintSystem(this, this.world);
    this.lighting = new LightingSystem(this);
    this.audio = new AudioSystem(this);
    bindAudio(this.audio);
    this.applySeasonTint();

    this.interaction = new InteractionSystem(this, {
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
    // A stray cat and dog turn up on day 2 (or right away in an older save).
    if (!this.social.pet && !this.social.petOffered && this.time_.day >= 2) this.offerPet();
    this.pets.show(this.social.pet ? this.social.pet.kind : this.social.petOffered ? null : undefined);
    const unsubscribe = this.bindCommands();
    const offInventory = gameEvents.on('inventory:changed', (snap) => this.noteFinds(snap.slots));
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
    if (actions.toggleEmotes && !this.panel) this.toggleEmotePicker();
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
      if (actions.use) this.interaction.use();
      else if (actions.interact) this.interaction.interact();
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
    this.player.speedBoost = this.state.hasBuff('speed') ? 1.25 : 1;
    this.time_.update(delta);
    this.drops.update(delta, this.player.x, this.player.y, inventory);
    if (!this.away) this.waypoint.update(delta, this.player.x, this.player.y);
    const lateNight = this.time_.minute >= 22 * 60;
    this.pets.update(delta, this.player, { follow: !!this.social.pet && !this.away && !this.sleeping, sleep: lateNight || this.away });
    if (!this.away) this.audio.update(delta, { minute: this.time_.minute, weather: this.weather.current, season: this.time_.season });
    this.playFootsteps(delta, frozen);
    const night = LightingSystem.darkness(this.time_.minute) > 0.5;
    if (!frozen) {
      this.animals.update(delta, this.player.x, this.player.y, night);
      this.livestock.update(delta, night);
      this.npcs.update(delta, this.time_.minute, { x: this.player.x, y: this.player.y });
      this.fishing.update(delta);
    }
    if (this.coop) this.coopUpdate(delta);
    this.ambient.update(delta, {
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

  /** Renders the world map from the current state and opens it. */
  private openMap(): void {
    const canvas = drawWorldMap(this.world, {
      season: this.time_.season,
      objects: this.resources.markers(),
      placed: this.build.serialize().map(({ kind, tx, ty }) => ({ kind, tx, ty })),
      plots: this.farming.markers(),
      people: [...this.npcs.positions(), ...(this.remotes?.positions() ?? [])],
      chickens: this.animals.serializeChickens(),
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
      this.resources.onNewDay(this.time_.day, season);
      this.animals.onNewDay();
      this.livestock.morning(this.build.ofKind('barn'));
      siloRefill([...this.build.ofKind('silo'), ...this.build.ofKind('barn')]);
      this.npcs.setWeather(this.weather.current);
      this.deliverMail();
      this.petMorning();
      this.romanceMorning();
      this.spawnWildForage();
      this.startFestival();
      const sprinkled = this.runSprinklers();
      const collected = this.runCollectors();
      this.quests.setDay(this.time_.day, season);
      if (seasonChanged) this.applySeasonTint();

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
    // Winter freezes ponds and the river: walk across the ice (and ice-fish through it).
    const frozen = season === 'winter';
    this.ground.forEachTile((tile) => {
      if (!WATER_TILE_INDICES.includes(tile.index)) return;
      tile.tint = frozen ? 0xd6ecff : 0xffffff;
      tile.setCollision(!frozen, !frozen, !frozen, !frozen, false);
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
      social: this.social.serialize(),
      quests: this.quests.serialize(),
    };
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
      craft: ({ recipeId }) => report(craft(this.state, recipeId), 'craft'),
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
        if (this.social.pet || this.panel !== 'pet') return;
        const clean = name.replace(/[^\p{L}\p{N} '-]/gu, '').trim().slice(0, 16) || (kind === 'cat' ? 'Whiskers' : 'Biscuit');
        this.social.pet = { kind, name: clean, pettedDay: 0, love: 0 };
        this.social.petOffered = false;
        this.pets.show(kind);
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
        else if (panel === 'inventory' || panel === 'crafting' || panel === 'character' || panel === 'menu' || panel === 'collection' || panel === 'settings' || panel === 'journal') this.setPanel(panel);
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
      social: this.social.serialize(),
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
      social: this.social.serialize(),
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
   * The carnival's gate: a free spot just south of the path below the market
   * (the same for everyone in a world, since it only depends on the map).
   */
  private carnivalGateSpot: { tx: number; ty: number } | null = null;
  private carnivalGate(): { tx: number; ty: number } {
    if (this.carnivalGateSpot) return this.carnivalGateSpot;
    const { market } = this.world;
    const taken = new Set(this.world.objects.map((o) => `${o.tx},${o.ty}`));
    const grass = (x: number, y: number) => terrainAt(this.world, x, y) === Terrain.Grass && !taken.has(`${x},${y}`);
    const cx = Math.round((market.x0 + market.x1) / 2);
    for (let d = 0; d <= market.x1 - market.x0; d++) {
      for (const x of d === 0 ? [cx] : [cx - d, cx + d]) {
        for (let y = market.y1 + 1; y < market.y1 + 14; y++) {
          const t = terrainAt(this.world, x, y);
          if (t !== Terrain.Path && t !== Terrain.Bridge) continue;
          if (t === Terrain.Path && [-1, 0, 1].every((dx) => grass(x + dx, y + 1)) && grass(x, y + 2)) return (this.carnivalGateSpot = { tx: x, ty: y + 1 });
          break;
        }
      }
    }
    return (this.carnivalGateSpot = { tx: cx, ty: market.y1 + 3 });
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

  // ---------- Emotes ----------

  private emotePicker = false;
  private cullTimer = 0;

  private toggleEmotePicker(): void {
    this.emotePicker = !this.emotePicker;
    gameEvents.emit('emote:picker', this.emotePicker);
  }

  /** An emoji bubble that floats over someone's head for a couple of seconds. */
  private showEmote(target: Phaser.GameObjects.Sprite, emote: string): void {
    const bubble = this.add
      .text(target.x, target.y - 34, emote, { fontSize: '28px', fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif', resolution: 2 })
      .setOrigin(0.5, 1)
      .setScale(0.32)
      .setDepth(DEPTH.fx + 5);
    const follow = () => bubble.setPosition(target.x, target.y - 34);
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
    this.social.petOffered = true;
    this.social.send(this.time_.day, 'Tobin', 'A couple of strays', "A cat and a dog have been sleeping on your doorstep. They look hungry — and they seem to like you. Pick one and give them a home?");
  }

  private petAction(x: number, y: number): { verb: string; run: () => void } | null {
    const kind = this.pets.near(x, y, 18) ?? this.pets.near(this.player.x, this.player.y, 14);
    if (!kind) return null;
    const pet = this.social.pet;
    if (!pet) {
      return {
        verb: `Adopt the stray ${kind}`,
        run: () => {
          gameEvents.emit('pet:offer', { kind });
          this.setPanel('pet');
        },
      };
    }
    const day = this.time_.day;
    if (pet.pettedDay === day) return { verb: `${pet.name} is happy`, run: () => this.pets.hop() };
    return {
      verb: `Pet ${pet.name}`,
      run: () => {
        pet.pettedDay = day;
        pet.love = Math.min(1000, pet.love + 10);
        this.state.restoreEnergy(5);
        this.pets.hop();
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
    const pet = this.social.pet;
    if (!pet) {
      if (!this.social.petOffered && this.time_.day >= 2) {
        this.offerPet();
        this.pets.show(null);
      }
      return;
    }
    if (pet.love >= 30 && pet.foundDay !== this.time_.day && Math.random() < 0.35) {
      pet.foundDay = this.time_.day;
      const pool = FORAGE[this.time_.season];
      const item = pool[Math.floor(Math.random() * pool.length)];
      const door = this.doorPosition();
      this.drops.spawn(item, 1, door.x + 14, door.y + 6);
      this.time.delayedCall(1500, () => gameEvents.emit('toast', { text: `${pet.name} brought you a ${ITEMS[item].name}!` }));
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

  private enterBeach(): void {
    const data: BeachSceneData = {
      host: this.areaHost(),
      forage: {
        taken: (day) => this.social.beachTaken(day),
        take: (day, id) => this.social.takeBeach(day, id),
      },
    };
    this.enterArea(SCENES.Beach, data);
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
    } else if (key === SCENES.Beach) {
      const t = this.beachGate();
      this.player.placeAt((t.tx - 1) * size + 8, t.ty * size + 12, 'left');
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
    gameEvents.emit('collection:state', this.collection.view(this.achievementContext()));
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
    const moved = this.state.ship(slot);
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
      bin: this.state.bin.map((s) => ({ itemId: s.itemId, quantity: s.quantity, gold: (ITEMS[s.itemId].sellPrice ?? 0) * s.quantity })),
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
    const result = this.social.gift(npcId, itemId, this.time_.day, lights ? 2 : 1)!;
    const reply =
      result.reaction === 'loved' ? 'I love this! Thank you so much!' : result.reaction === 'liked' ? 'Oh, how nice. Thank you!' : "Thanks, that's kind of you.";
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
    const leftover = target.add(stack.itemId, stack.quantity);
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
