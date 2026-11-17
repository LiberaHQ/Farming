import type * as Phaser from 'phaser';
import type { Season, WeatherKind } from '@farming/shared';
import { gameEvents } from '../events/GameEventBus';
import { midiToFreq } from './dsp';
import {
  birdChirp,
  caveDrip,
  caveDrone,
  caveGrowl,
  caveHeartbeat,
  caveRumble,
  caveSkitter,
  caveWail,
  caveWhisper,
  cricket,
  flute,
  glassTone, glock,
  kalimba,
  LOOPS,
  organ,
  pad,
  pluck,
  SFX,
  stab,
  tuba,
  type SfxName,
} from './sounds';

export type AudioChannel = 'master' | 'music' | 'sfx' | 'ambience';

export interface AudioSettings {
  master: number;
  music: number;
  sfx: number;
  ambience: number;
  muted: boolean;
}

const SETTINGS_KEY = 'farming-game:audio';
const DEFAULTS: AudioSettings = { master: 0.8, music: 0.45, sfx: 0.8, ambience: 0.6, muted: false };

function loadSettings(): AudioSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULTS };
    const s = JSON.parse(raw) as Partial<AudioSettings>;
    const vol = (v: unknown, d: number) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : d);
    return {
      master: vol(s.master, DEFAULTS.master),
      music: vol(s.music, DEFAULTS.music),
      sfx: vol(s.sfx, DEFAULTS.sfx),
      ambience: vol(s.ambience, DEFAULTS.ambience),
      muted: s.muted === true,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

/** Where the player is: each place has its own music (or none, e.g. indoors and the mine). */
export type MusicArea = 'world' | 'carnival' | 'forest' | 'mine' | 'quiet';

export interface AudioContextState {
  minute: number;
  weather: WeatherKind;
  season: Season;
  area?: MusicArea;
  /** Mine floor (1–30): the deeper, the more often the dark makes itself heard. */
  floor?: number;
}

const CAVE_SOUNDS = ['drip', 'rumble', 'growl', 'whisper', 'wail', 'skitter', 'heartbeat'] as const;
type CaveSound = (typeof CAVE_SOUNDS)[number];
const CAVE_BUILDERS: Record<CaveSound, (ctx: BaseAudioContext) => AudioBuffer> = {
  drip: caveDrip,
  rumble: caveRumble,
  growl: caveGrowl,
  whisper: caveWhisper,
  wail: caveWail,
  skitter: caveSkitter,
  heartbeat: caveHeartbeat,
};

/**
 * The carnival tune: an original fairground waltz in C (3/4, 16 bars), as
 * [midi note, beats] per bar; 0 is a rest. Played on a calliope over oom-pah-pah.
 */
const CARNIVAL_TUNE: [number, number][][] = [
  [[76, 2], [79, 1]],
  [[84, 2], [83, 1]],
  [[81, 1], [79, 1], [77, 1]],
  [[74, 3]],
  [[74, 2], [77, 1]],
  [[83, 2], [81, 1]],
  [[79, 1], [76, 1], [72, 1]],
  [[76, 3]],
  [[77, 2], [81, 1]],
  [[84, 2], [81, 1]],
  [[79, 1], [76, 1], [79, 1]],
  [[84, 3]],
  [[83, 1], [81, 1], [79, 1]],
  [[77, 1], [74, 1], [71, 1]],
  [[72, 1], [76, 1], [79, 1]],
  [[84, 2], [0, 1]],
];
/** Chord per bar: bass root and the notes of the "pah" stabs. */
const C_CHORD = { bass: [48, 43], stab: [60, 64, 67] };
const G7_CHORD = { bass: [43, 50], stab: [59, 62, 65] };
const F_CHORD = { bass: [41, 48], stab: [60, 65, 69] };
const CARNIVAL_CHORDS = [C_CHORD, C_CHORD, G7_CHORD, G7_CHORD, G7_CHORD, G7_CHORD, C_CHORD, C_CHORD, F_CHORD, F_CHORD, C_CHORD, C_CHORD, G7_CHORD, G7_CHORD, C_CHORD, C_CHORD];
const CARNIVAL_BEAT = 60 / 168;

/** The forest: slow, in D dorian, a drone with a wandering wooden flute and kalimba. */
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const FOREST_CHORDS = [0, -2, 0, 7 - 12, 3, -2];
const FOREST_EIGHTH = 60 / 58 / 2;

const MAJOR = [0, 2, 4, 7, 9];
const MINOR = [0, 3, 5, 7, 10];
/** Each season has its own key and mood. */
const SEASON_KEYS: Record<Season, { root: number; scale: number[]; chords: number[] }> = {
  spring: { root: 60, scale: MAJOR, chords: [0, 9, 5, 7] },
  summer: { root: 62, scale: MAJOR, chords: [0, 5, 9, 7] },
  fall: { root: 57, scale: MINOR, chords: [0, 8, 3, 10] },
  winter: { root: 64, scale: MINOR, chords: [0, 3, 8, 7] },
};
const BPM = 76;
const EIGHTH = 60 / BPM / 2;

/**
 * Game audio: synthesised sound effects, ambience (birds by day, crickets at
 * night, rain and wind loops) and a gentle generative score that follows the
 * season and time of day. Volumes are per channel and remembered.
 */
export class AudioSystem {
  private readonly ctx: AudioContext | null;
  private readonly bus = {} as Record<AudioChannel, GainNode>;
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly loops = new Map<'rain' | 'wind' | 'cave', { source: AudioBufferSourceNode; gain: GainNode }>();
  /** Cave sounds go through an echo before reaching the ambience bus. */
  private caveIn: GainNode | null = null;
  private caveTimers: Record<CaveSound, number> = { drip: 800, rumble: 9000, growl: 14000, whisper: 20000, wail: 26000, skitter: 7000, heartbeat: 4000 };
  private settings = loadSettings();
  private birdTimer = 2000;
  private cricketTimer = 1000;
  private nextNote = 0;
  private step = 0;
  private melodyIndex = 2;
  private night = false;
  private area: MusicArea = 'world';

  constructor(scene: Phaser.Scene) {
    const manager = scene.sound as Phaser.Sound.WebAudioSoundManager;
    this.ctx = 'context' in manager && manager.context ? manager.context : null;
    if (!this.ctx) return;

    const ctx = this.ctx;
    this.bus.master = ctx.createGain();
    this.bus.master.connect(ctx.destination);
    for (const ch of ['music', 'sfx', 'ambience'] as const) {
      this.bus[ch] = ctx.createGain();
      this.bus[ch].connect(this.bus.master);
    }
    for (const name of Object.keys(SFX) as SfxName[]) this.buffers.set(name, SFX[name](ctx));
    this.buffers.set('bird', birdChirp(ctx));
    this.buffers.set('cricket', cricket(ctx));
    for (const name of CAVE_SOUNDS) this.buffers.set(`cave:${name}`, CAVE_BUILDERS[name](ctx));
    // A cavernous echo: delay with feedback, darkened a little on each repeat.
    this.caveIn = ctx.createGain();
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.32;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.42;
    const dark = ctx.createBiquadFilter();
    dark.type = 'lowpass';
    dark.frequency.value = 2200;
    this.caveIn.connect(this.bus.ambience);
    this.caveIn.connect(delay);
    delay.connect(dark).connect(feedback).connect(delay);
    dark.connect(this.bus.ambience);
    for (const kind of ['rain', 'wind', 'cave'] as const) {
      const source = ctx.createBufferSource();
      source.buffer = kind === 'cave' ? caveDrone(ctx) : LOOPS[kind](ctx);
      source.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      source.connect(gain).connect(this.bus.ambience);
      source.start();
      this.loops.set(kind, { source, gain });
    }
    this.applySettings();
  }

  get current(): AudioSettings {
    return { ...this.settings };
  }

  /** Plays a sound effect. `vary` adds slight random pitch so repeats don't sound robotic. */
  play(name: SfxName, options: { volume?: number; rate?: number; vary?: number } = {}): void {
    const buffer = this.buffers.get(name);
    if (!this.ctx || !buffer || this.settings.muted) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const vary = options.vary ?? 0.06;
    source.playbackRate.value = (options.rate ?? 1) * (1 + (Math.random() * 2 - 1) * vary);
    const gain = this.ctx.createGain();
    gain.gain.value = options.volume ?? 1;
    source.connect(gain).connect(this.bus.sfx);
    source.start();
  }

  set(channel: AudioChannel, value: number): void {
    if (!Number.isFinite(value)) return;
    this.settings = { ...this.settings, [channel]: Math.max(0, Math.min(1, value)) };
    this.applySettings();
  }

  toggleMute(): void {
    this.settings = { ...this.settings, muted: !this.settings.muted };
    this.applySettings();
  }

  emit(): void {
    gameEvents.emit('audio:settings', { ...this.settings });
  }

  /** Ambience and music; call every frame. */
  update(delta: number, state: AudioContextState): void {
    if (!this.ctx) return;
    const area = state.area ?? 'world';
    if (area !== this.area) {
      // A new place starts its own piece from the top, after a short breath.
      this.area = area;
      this.step = 0;
      this.melodyIndex = 4;
      this.nextNote = this.ctx.currentTime + 0.4;
    }
    const ctx = this.ctx;
    this.loops.get('cave')?.gain.gain.setTargetAtTime(area === 'mine' ? 0.55 : 0, ctx.currentTime, 1.2);
    if (area === 'mine') {
      this.loops.get('rain')?.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.8);
      this.loops.get('wind')?.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.8);
      this.caveAmbience(delta, state.floor ?? 1);
      this.scheduleMine(state.floor ?? 1);
      return;
    }
    if (area === 'quiet') return;
    const h = state.minute / 60;
    this.night = h >= 20 || h < 5.5;
    const wet = state.weather === 'rain';

    // Weather loops fade in and out.
    const set = (kind: 'rain' | 'wind', target: number) => this.loops.get(kind)?.gain.gain.setTargetAtTime(target, ctx.currentTime, 0.8);
    set('rain', wet ? 0.55 : 0);
    set('wind', state.weather === 'snow' ? 0.4 : 0);

    // Birds by day in fair weather; crickets on warm nights.
    this.birdTimer -= delta;
    if (this.birdTimer <= 0) {
      this.birdTimer = 1500 + Math.random() * 4500;
      if (!this.night && h < 19 && !wet && state.weather !== 'snow' && state.season !== 'winter') {
        const count = 1 + Math.floor(Math.random() * 3);
        const pitch = 0.8 + Math.random() * 0.5;
        for (let i = 0; i < count; i++) this.scheduleAmbient('bird', ctx.currentTime + i * 0.18, pitch, 0.5 + Math.random() * 0.5);
      }
    }
    this.cricketTimer -= delta;
    if (this.cricketTimer <= 0) {
      this.cricketTimer = 500 + Math.random() * 1600;
      if (this.night && !wet && state.season !== 'winter') this.scheduleAmbient('cricket', ctx.currentTime, 0.95 + Math.random() * 0.1, 0.6 + Math.random() * 0.4);
    }

    if (area === 'carnival') this.scheduleCarnival();
    else if (area === 'forest') this.scheduleForest();
    else this.scheduleMusic(state.season);
  }

  /**
   * The mine's ambience: drips, shifting rock, skittering claws, whispers,
   * something growling and a far-off wail, all echoing. Deeper floors bring
   * the unsettling ones more often, and a heartbeat below floor 20.
   */
  private caveAmbience(delta: number, floor: number): void {
    const ctx = this.ctx!;
    const depth = Math.min(1, floor / 30);
    // Average gap between each sound (ms), shrinking with depth for the scary ones.
    const gaps: Record<CaveSound, number> = {
      drip: 2200,
      rumble: 16000 - 6000 * depth,
      skitter: 12000 - 5000 * depth,
      growl: 30000 - 18000 * depth,
      whisper: 40000 - 24000 * depth,
      wail: 45000 - 25000 * depth,
      heartbeat: floor >= 20 ? 1500 : Infinity,
    };
    for (const name of CAVE_SOUNDS) {
      this.caveTimers[name] -= delta;
      if (this.caveTimers[name] > 0) continue;
      const gap = gaps[name];
      this.caveTimers[name] = Number.isFinite(gap) ? gap * (0.5 + Math.random()) : 5000;
      if (!Number.isFinite(gap)) continue;
      const buffer = this.buffers.get(`cave:${name}`);
      if (!buffer || !this.caveIn) continue;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      // Each sound comes from somewhere different, a little different every time.
      const rate = name === 'drip' ? 0.8 + Math.random() * 0.5 : name === 'heartbeat' ? 1 : 0.85 + Math.random() * 0.3;
      source.playbackRate.value = rate;
      const gain = ctx.createGain();
      gain.gain.value = name === 'heartbeat' ? 0.35 + 0.4 * ((floor - 20) / 10) : name === 'drip' ? 0.4 + Math.random() * 0.5 : 0.55 + Math.random() * 0.45;
      const pan = ctx.createStereoPanner();
      pan.pan.value = name === 'heartbeat' ? 0 : Math.random() * 1.8 - 0.9;
      source.connect(gain).connect(pan).connect(name === 'heartbeat' ? this.bus.ambience : this.caveIn);
      source.start();
    }
  }

  /** The mine's score: low, uneasy intervals and the odd cold glassy note. */
  private scheduleMine(floor: number): void {
    const ctx = this.ctx!;
    if (this.nextNote < ctx.currentTime) this.nextNote = ctx.currentTime + 0.1;
    const root = 38 - Math.floor(floor / 10); // sinks a little as you go down
    const bar = 60 / 40 * 4; // one slow bar
    while (this.nextNote < ctx.currentTime + 0.6) {
      const step = this.step % 4;
      if (step === 0) {
        // A low fifth, then a tritone that never quite resolves.
        const intervals = this.step % 8 === 0 ? [0, 7, 13] : [0, 6, 11];
        for (const i of intervals) this.playNote(pad, midiToFreq(root + i), bar * 1.05, this.nextNote, 0.55);
      }
      if (Math.random() < 0.18 + floor / 150) {
        const note = root + 36 + [0, 1, 6, 7, 10][Math.floor(Math.random() * 5)];
        this.playNote(glassTone, midiToFreq(note), bar * 0.75, this.nextNote + Math.random() * 0.4, 0.6);
      }
      this.step += 1;
      this.nextNote += bar / 4;
    }
  }

  /** The fairground waltz: oom-pah-pah under a calliope tune, with glockenspiel sparkles. */
  private scheduleCarnival(): void {
    const ctx = this.ctx!;
    if (this.nextNote < ctx.currentTime) this.nextNote = ctx.currentTime + 0.1;
    while (this.nextNote < ctx.currentTime + 0.6) {
      const bar = Math.floor(this.step / 3) % CARNIVAL_TUNE.length;
      const beat = this.step % 3;
      const chord = CARNIVAL_CHORDS[bar];
      const when = this.nextNote;
      // Every other time through, the tune goes up an octave on the glockenspiel too.
      const round = Math.floor(this.step / (3 * CARNIVAL_TUNE.length)) % 2;
      if (beat === 0) this.playNote(tuba, midiToFreq(chord.bass[bar % 2]), CARNIVAL_BEAT * 0.9, when, 1);
      else for (const n of chord.stab) this.playNote(stab, midiToFreq(n), CARNIVAL_BEAT * 0.45, when, 0.9);
      // Melody notes that start on this beat.
      let at = 0;
      for (const [note, beats] of CARNIVAL_TUNE[bar]) {
        if (at === beat && note > 0) {
          this.playNote(organ, midiToFreq(note), CARNIVAL_BEAT * beats * 0.92, when, 1);
          if (round === 1) this.playNote(glock, midiToFreq(note + 12), CARNIVAL_BEAT * 1.5, when, 0.55);
        }
        at += beats;
      }
      // A little run on the glockenspiel at the end of every fourth bar.
      if (bar % 4 === 3 && beat === 2) {
        for (let i = 0; i < 3; i++) this.playNote(glock, midiToFreq([84, 88, 91][i]), CARNIVAL_BEAT, when + (i * CARNIVAL_BEAT) / 3, 0.4);
      }
      this.step += 1;
      this.nextNote += CARNIVAL_BEAT;
    }
  }

  /** The old forest: a low drone, a wandering flute and the odd kalimba note, slower at night. */
  private scheduleForest(): void {
    const ctx = this.ctx!;
    if (this.nextNote < ctx.currentTime) this.nextNote = ctx.currentTime + 0.1;
    const root = 62;
    while (this.nextNote < ctx.currentTime + 0.6) {
      const bar = Math.floor(this.step / 8) % FOREST_CHORDS.length;
      const beat = this.step % 8;
      const when = this.nextNote;
      if (beat === 0) {
        const chordRoot = root - 24 + FOREST_CHORDS[bar];
        for (const interval of [0, 7, 15]) this.playNote(pad, midiToFreq(chordRoot + interval), FOREST_EIGHTH * 8.6, when, this.night ? 0.5 : 0.8);
      }
      // The flute takes long notes; it rests a lot so the birds can be heard.
      if ((beat === 0 || beat === 4) && Math.random() < (this.night ? 0.3 : 0.55)) {
        this.melodyIndex = Math.max(0, Math.min(DORIAN.length * 2 - 1, this.melodyIndex + Math.floor(Math.random() * 5) - 2));
        const octave = Math.floor(this.melodyIndex / DORIAN.length);
        const note = root + 12 * octave + DORIAN[this.melodyIndex % DORIAN.length];
        this.playNote(flute, midiToFreq(note), FOREST_EIGHTH * (Math.random() < 0.5 ? 4 : 3), when, this.night ? 0.5 : 0.75);
      }
      if (beat % 2 === 1 && Math.random() < 0.14) {
        const note = root + 12 + DORIAN[Math.floor(Math.random() * DORIAN.length)];
        this.playNote(kalimba, midiToFreq(note), FOREST_EIGHTH * 3, when, 0.6);
      }
      this.step += 1;
      this.nextNote += FOREST_EIGHTH;
    }
  }

  destroy(): void {
    for (const { source } of this.loops.values()) {
      try {
        source.stop();
      } catch {
        // already stopped
      }
    }
    this.bus.master?.disconnect();
  }

  private scheduleAmbient(key: 'bird' | 'cricket', when: number, rate: number, volume: number): void {
    const buffer = this.buffers.get(key);
    if (!this.ctx || !buffer) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    // Gentle stereo placement so the world feels wide.
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = Math.random() * 1.6 - 0.8;
    source.connect(gain).connect(panner).connect(this.bus.ambience);
    source.start(when);
  }

  /** Schedules the generative score a little ahead of time on the audio clock. */
  private scheduleMusic(season: Season): void {
    const ctx = this.ctx!;
    if (this.nextNote < ctx.currentTime) this.nextNote = ctx.currentTime + 0.1;
    const key = SEASON_KEYS[season];
    while (this.nextNote < ctx.currentTime + 0.6) {
      const bar = Math.floor(this.step / 8) % key.chords.length;
      const beat = this.step % 8;
      const chordRoot = key.root - 12 + key.chords[bar];
      if (beat === 0) {
        // Pad: root, fifth and octave, sustained for the bar.
        for (const interval of [0, 7, 12]) this.playNote(pad, midiToFreq(chordRoot + interval), EIGHTH * 8.5, this.nextNote, this.night ? 0.6 : 1);
      }
      const density = this.night ? 0.18 : 0.38;
      if (beat % 2 === 0 ? Math.random() < density + 0.15 : Math.random() < density * 0.5) {
        this.melodyIndex = Math.max(0, Math.min(key.scale.length * 2 - 1, this.melodyIndex + Math.floor(Math.random() * 5) - 2));
        const octave = Math.floor(this.melodyIndex / key.scale.length);
        const note = key.root + 12 * octave + key.scale[this.melodyIndex % key.scale.length];
        this.playNote(pluck, midiToFreq(note), EIGHTH * (beat % 4 === 0 ? 3 : 2), this.nextNote, this.night ? 0.55 : 0.9);
      }
      this.step += 1;
      this.nextNote += EIGHTH;
    }
  }

  private playNote(make: (ctx: BaseAudioContext, f: number, s: number) => AudioBuffer, freq: number, seconds: number, when: number, volume: number): void {
    const ctx = this.ctx!;
    const cacheKey = `${make.name}:${freq.toFixed(2)}:${seconds.toFixed(2)}`;
    let buffer = this.buffers.get(cacheKey);
    if (!buffer) {
      buffer = make(ctx, freq, seconds);
      this.buffers.set(cacheKey, buffer);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(this.bus.music);
    source.start(when);
  }

  private applySettings(): void {
    if (this.ctx) {
      const now = this.ctx.currentTime;
      this.bus.master.gain.setTargetAtTime(this.settings.muted ? 0 : this.settings.master, now, 0.05);
      this.bus.music.gain.setTargetAtTime(this.settings.music * 0.6, now, 0.05);
      this.bus.sfx.gain.setTargetAtTime(this.settings.sfx, now, 0.05);
      this.bus.ambience.gain.setTargetAtTime(this.settings.ambience, now, 0.05);
    }
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      // storage unavailable
    }
    this.emit();
  }
}
