import { bandpass, envelope, highpass, lowpass, noiseSource, oscillator, render, sweep, type Wave } from './dsp';

/** Every sound effect in the game. */
export type SfxName =
  | 'chop'
  | 'mine'
  | 'clunk'
  | 'treeFall'
  | 'rockBreak'
  | 'thunder'
  | 'ribbit'
  | 'whistle'
  | 'chug'
  | 'ghost'
  | 'swish'
  | 'rustle'
  | 'till'
  | 'water'
  | 'refill'
  | 'plant'
  | 'harvest'
  | 'sparkle'
  | 'pickup'
  | 'place'
  | 'whoosh'
  | 'eat'
  | 'coin'
  | 'craft'
  | 'error'
  | 'uiOpen'
  | 'uiClose'
  | 'talk'
  | 'cluck'
  | 'step'
  | 'sleep'
  | 'morning'
  | 'cast'
  | 'splash'
  | 'bite'
  | 'catch'
  | 'heart'
  | 'quest';

type Builder = (ctx: BaseAudioContext) => AudioBuffer;

/** A short tone with optional pitch glide. */
function tone(ctx: BaseAudioContext, wave: Wave, from: number, to: number, seconds: number, attack = 0.005, gain = 0.5): AudioBuffer {
  const osc = sweep(ctx.sampleRate);
  return render(ctx, seconds, (t) => oscillator(wave, osc(from + (to - from) * (t / seconds))) * envelope(t, attack, seconds - attack), gain);
}

/** A sequence of notes [frequency, start, duration]. */
function notes(ctx: BaseAudioContext, wave: Wave, list: Array<[number, number, number]>, gain = 0.35): AudioBuffer {
  const total = Math.max(...list.map(([, s, d]) => s + d));
  return render(
    ctx,
    total,
    (t) => {
      let v = 0;
      for (const [f, s, d] of list) {
        if (t < s || t > s + d) continue;
        const lt = t - s;
        v += oscillator(wave, f * lt) * envelope(lt, 0.004, d, 2.5);
      }
      return v;
    },
    gain,
  );
}

export const SFX: Record<SfxName, Builder> = {
  cast: (ctx) => {
    const n = noiseSource(41);
    const bp = bandpass(ctx.sampleRate);
    return render(ctx, 0.35, (t) => bp(n(), 900 + 2600 * (t / 0.35), 1.2) * envelope(t, 0.02, 0.33, 2) * 2.2, 0.45);
  },
  splash: (ctx) => {
    const n = noiseSource(42);
    const lp = lowpass(ctx.sampleRate);
    const osc = sweep(ctx.sampleRate);
    return render(ctx, 0.4, (t) => (lp(n(), 1800 - 1400 * (t / 0.4)) * 1.6 + oscillator('sine', osc(520 - 300 * (t / 0.4))) * 0.3) * envelope(t, 0.004, 0.38, 3), 0.5);
  },
  bite: (ctx) => notes(ctx, 'square', [
    [988, 0, 0.06],
    [1319, 0.07, 0.1],
  ], 0.3),
  catch: (ctx) => notes(ctx, 'triangle', [
    [523, 0, 0.12],
    [784, 0.1, 0.12],
    [1047, 0.2, 0.3],
  ], 0.34),
  heart: (ctx) => notes(ctx, 'sine', [
    [880, 0, 0.14],
    [1175, 0.12, 0.22],
  ], 0.3),
  quest: (ctx) => notes(ctx, 'triangle', [
    [659, 0, 0.12],
    [784, 0.11, 0.12],
    [988, 0.22, 0.12],
    [1319, 0.33, 0.4],
  ], 0.3),
  // Axe into wood: low thump plus a woody knock.
  chop: (ctx) => {
    const n = noiseSource(11);
    const lp = lowpass(ctx.sampleRate);
    const osc = sweep(ctx.sampleRate);
    return render(ctx, 0.22, (t) => {
      const thump = oscillator('sine', osc(170 - t * 300)) * envelope(t, 0.002, 0.16);
      const knock = lp(n(), 1400) * envelope(t, 0.001, 0.07);
      return thump * 0.8 + knock * 1.6;
    }, 0.7);
  },
  // Pickaxe on stone: bright metallic ping.
  mine: (ctx) => {
    const n = noiseSource(12);
    const hp = highpass(ctx.sampleRate);
    return render(ctx, 0.35, (t) => {
      const ring = (oscillator('sine', 1870 * t) + 0.6 * oscillator('sine', 2730 * t) + 0.3 * oscillator('sine', 4100 * t)) * envelope(t, 0.001, 0.32, 4);
      const click = hp(n(), 2500) * envelope(t, 0.0005, 0.03);
      return ring * 0.35 + click;
    }, 0.55);
  },
  // Wrong tool: dull bonk.
  clunk: (ctx) => tone(ctx, 'triangle', 220, 140, 0.14, 0.002, 0.5),
  treeFall: (ctx) => {
    const n = noiseSource(13);
    const lp = lowpass(ctx.sampleRate);
    const osc = sweep(ctx.sampleRate);
    return render(ctx, 0.9, (t) => {
      const crack = t < 0.25 ? lp(n(), 2500) * envelope(t, 0.002, 0.25, 2) : 0;
      const rustle = lp(n(), 900 + 600 * Math.sin(t * 30)) * envelope(Math.max(0, t - 0.15), 0.1, 0.55, 2) * 0.7;
      const thud = t > 0.62 ? oscillator('sine', osc(70)) * envelope(t - 0.62, 0.003, 0.26) : 0;
      return crack + rustle + thud * 1.4;
    }, 0.6);
  },
  // Thunder: a sharp crack, then a long low rolling rumble.
  thunder: (ctx) => {
    const n = noiseSource(41);
    const lp = lowpass(ctx.sampleRate);
    const lp2 = lowpass(ctx.sampleRate);
    return render(ctx, 3.2, (t) => {
      const crack = t < 0.25 ? lp(n(), 2400) * envelope(t, 0.002, 0.25, 2) * 1.6 : 0;
      const roll = 0.55 + 0.45 * Math.sin(t * 7.3) * Math.sin(t * 2.1 + 1);
      const rumble = lp2(n(), 140 - t * 25) * envelope(t, 0.08, 3.1, 1.6) * roll * 5.5;
      return crack + rumble;
    }, 0.9);
  },
  // A frog: two quick throaty croaks.
  ribbit: (ctx) => {
    const n = noiseSource(42);
    const bp = bandpass(ctx.sampleRate);
    return render(ctx, 0.32, (t) => {
      const pulse = t < 0.12 ? envelope(t, 0.005, 0.11, 2) : t > 0.16 && t < 0.3 ? envelope(t - 0.16, 0.005, 0.13, 2) : 0;
      const tone = oscillator('square', t * (330 + Math.sin(t * 200) * 40)) * 0.5 + bp(n(), 700) * 0.6;
      return tone * pulse * 0.9;
    }, 0.45);
  },
  // A steam train's whistle: two breathy chord tones, a short toot then a long one.
  whistle: (ctx) => {
    const n = noiseSource(51);
    const bp = bandpass(ctx.sampleRate);
    return render(ctx, 1.7, (t) => {
      const on = t < 0.28 ? envelope(t, 0.04, 0.26, 0.6) : t > 0.4 ? envelope(t - 0.4, 0.06, 1.28, 0.8) : 0;
      const bend = t > 0.4 ? 1 - Math.min(0.04, (t - 0.4) * 0.03) : 1;
      const tone = oscillator('sine', t * 587 * bend) * 0.5 + oscillator('sine', t * 740 * bend) * 0.4 + oscillator('triangle', t * 880 * bend) * 0.2;
      return (tone + bp(n(), 1600) * 0.7) * on * 0.8;
    }, 0.55);
  },
  // A passing train: a low rumble with the clickety-clack of wheels over rail joints.
  chug: (ctx) => {
    const n = noiseSource(52);
    const lp = lowpass(ctx.sampleRate);
    const bp = bandpass(ctx.sampleRate);
    return render(ctx, 4, (t) => {
      const swell = Math.min(1, t / 0.8) * Math.min(1, (4 - t) / 1.2);
      const rumble = lp(n(), 120) * 4;
      const beat = t % 0.36;
      const clack = (beat < 0.04 ? envelope(beat, 0.001, 0.04, 2) : beat > 0.09 && beat < 0.13 ? envelope(beat - 0.09, 0.001, 0.04, 2) : 0) * bp(n(), 1800);
      return (rumble + clack * 1.4) * swell;
    }, 0.7);
  },
  // A friendly ghost: a soft, wavering "oooo".
  ghost: (ctx) => {
    const n = noiseSource(53);
    const lp = lowpass(ctx.sampleRate);
    return render(ctx, 1.4, (t) => {
      const f = 330 + Math.sin(t * 5.5) * 18 - t * 40;
      const tone = oscillator('sine', t * f) * 0.7 + oscillator('sine', t * f * 1.5) * 0.15 + lp(n(), 900) * 0.4;
      return tone * envelope(t, 0.35, 1.05, 1.2) * 0.6;
    }, 0.4);
  },
  rockBreak: (ctx) => {
    const n = noiseSource(14);
    const bp = bandpass(ctx.sampleRate);
    return render(ctx, 0.45, (t) => {
      const grains = Math.sin(t * 90) > 0.3 ? 1 : 0.4;
      return bp(n(), 1100 - t * 900) * envelope(t, 0.002, 0.42, 2) * grains * 2.2;
    }, 0.6);
  },
  // Cutting grass: airy swish.
  swish: (ctx) => {
    const n = noiseSource(15);
    const bp = bandpass(ctx.sampleRate);
    return render(ctx, 0.16, (t) => bp(n(), 2500 + t * 9000) * envelope(t, 0.03, 0.13, 2) * 2.4, 0.5);
  },
  rustle: (ctx) => {
    const n = noiseSource(16);
    const bp = bandpass(ctx.sampleRate);
    return render(ctx, 0.3, (t) => bp(n(), 3200) * envelope(t, 0.02, 0.28, 2) * (0.6 + 0.4 * Math.sin(t * 70)) * 2, 0.45);
  },
  // Hoe in soil: crunchy scrape.
  till: (ctx) => {
    const n = noiseSource(17);
    const bp = bandpass(ctx.sampleRate);
    return render(ctx, 0.2, (t) => bp(n(), 700) * envelope(t, 0.005, 0.18, 2) * (Math.sin(t * 160) > 0 ? 1.6 : 0.9) * 2, 0.6);
  },
  water: (ctx) => {
    const n = noiseSource(18);
    const bp = bandpass(ctx.sampleRate);
    return render(ctx, 0.45, (t) => bp(n(), 1600 + 900 * Math.sin(t * 22)) * envelope(t, 0.04, 0.4, 2) * 2.2, 0.45);
  },
  refill: (ctx) => {
    const blips: Array<[number, number, number]> = [];
    for (let i = 0; i < 7; i++) blips.push([420 + ((i * 137) % 380), i * 0.045, 0.06]);
    return notes(ctx, 'sine', blips, 0.3);
  },
  plant: (ctx) => tone(ctx, 'sine', 320, 620, 0.12, 0.003, 0.45),
  harvest: (ctx) => notes(ctx, 'triangle', [
    [523, 0, 0.12],
    [659, 0.06, 0.12],
    [784, 0.12, 0.2],
  ]),
  sparkle: (ctx) => notes(ctx, 'sine', [
    [1568, 0, 0.15],
    [2093, 0.05, 0.15],
    [2637, 0.1, 0.25],
  ], 0.22),
  pickup: (ctx) => tone(ctx, 'square', 880, 1320, 0.08, 0.002, 0.18),
  place: (ctx) => {
    const n = noiseSource(19);
    const lp = lowpass(ctx.sampleRate);
    const osc = sweep(ctx.sampleRate);
    return render(ctx, 0.18, (t) => oscillator('sine', osc(240 - t * 400)) * envelope(t, 0.002, 0.15) + lp(n(), 1800) * envelope(t, 0.001, 0.05), 0.55);
  },
  whoosh: (ctx) => {
    const n = noiseSource(20);
    const bp = bandpass(ctx.sampleRate);
    return render(ctx, 0.18, (t) => bp(n(), 600 + t * 5000, 0.5) * envelope(t, 0.06, 0.12, 2) * 1.6, 0.35);
  },
  eat: (ctx) => {
    const n = noiseSource(21);
    const bp = bandpass(ctx.sampleRate);
    return render(ctx, 0.42, (t) => {
      const bite = [0, 0.14, 0.28].some((s) => t >= s && t < s + 0.08);
      return bite ? bp(n(), 2200) * 2.4 * envelope((t % 0.14), 0.002, 0.08) : 0;
    }, 0.5);
  },
  coin: (ctx) => notes(ctx, 'square', [
    [1319, 0, 0.07],
    [1760, 0.07, 0.22],
  ], 0.16),
  craft: (ctx) => {
    const clink = (offset: number, t: number) =>
      t < offset ? 0 : (oscillator('sine', 2200 * (t - offset)) + 0.5 * oscillator('sine', 3300 * (t - offset))) * envelope(t - offset, 0.001, 0.18, 4);
    return render(ctx, 0.5, (t) => clink(0, t) + clink(0.17, t) * 0.9 + (t > 0.32 ? oscillator('triangle', 784 * (t - 0.32)) * envelope(t - 0.32, 0.005, 0.18) : 0), 0.3);
  },
  error: (ctx) => notes(ctx, 'square', [
    [196, 0, 0.09],
    [155, 0.1, 0.14],
  ], 0.14),
  uiOpen: (ctx) => tone(ctx, 'sine', 600, 900, 0.07, 0.003, 0.3),
  uiClose: (ctx) => tone(ctx, 'sine', 800, 520, 0.07, 0.003, 0.25),
  talk: (ctx) => notes(ctx, 'triangle', [
    [587, 0, 0.06],
    [698, 0.07, 0.06],
    [659, 0.14, 0.08],
  ], 0.28),
  cluck: (ctx) => {
    const osc = sweep(ctx.sampleRate);
    return render(ctx, 0.32, (t) => {
      const burst = t < 0.09 || (t > 0.13 && t < 0.2) || t > 0.24;
      const f = 600 + 400 * Math.sin(t * 60) * (t > 0.24 ? 1.5 : 1);
      return burst ? oscillator('square', osc(f)) * 0.5 * envelope(t % 0.11, 0.004, 0.09) : 0;
    }, 0.25);
  },
  step: (ctx) => {
    const n = noiseSource(22);
    const lp = lowpass(ctx.sampleRate);
    return render(ctx, 0.06, (t) => lp(n(), 900) * envelope(t, 0.002, 0.055), 0.5);
  },
  sleep: (ctx) => notes(ctx, 'sine', [
    [784, 0, 0.5],
    [659, 0.25, 0.5],
    [523, 0.5, 0.5],
    [392, 0.75, 0.9],
  ], 0.3),
  morning: (ctx) => notes(ctx, 'triangle', [
    [523, 0, 0.25],
    [659, 0.15, 0.25],
    [784, 0.3, 0.25],
    [1047, 0.45, 0.6],
  ], 0.28),
};

/** Looping ambience beds. */
export const LOOPS = {
  // Gentle broadband rain: filtered noise with slow swells.
  rain: (ctx: BaseAudioContext) => {
    const n = noiseSource(31);
    const lp = lowpass(ctx.sampleRate);
    const hp = highpass(ctx.sampleRate);
    return render(ctx, 4, (t) => hp(lp(n(), 2400), 300) * (0.8 + 0.2 * Math.sin(t * Math.PI * 0.5)) * 1.4, 0.5);
  },
  // Soft wind for snowy days.
  wind: (ctx: BaseAudioContext) => {
    const n = noiseSource(32);
    const bp = bandpass(ctx.sampleRate);
    return render(ctx, 6, (t) => bp(n(), 400 + 250 * Math.sin(t * Math.PI / 3), 0.5) * (0.6 + 0.4 * Math.sin((t * Math.PI) / 3)) * 2, 0.5);
  },
} as const;

/** One bird chirp (pitched by the caller for variety). */
export const birdChirp: Builder = (ctx) => {
  const osc = sweep(ctx.sampleRate);
  return render(ctx, 0.28, (t) => {
    const seg = Math.floor(t / 0.07);
    const lt = t - seg * 0.07;
    const f = 2600 + 1400 * Math.sin(lt * 70) + seg * 200;
    return oscillator('sine', osc(f)) * envelope(lt, 0.005, 0.06, 2);
  }, 0.18);
};

/** A cricket trill. */
export const cricket: Builder = (ctx) =>
  render(ctx, 0.4, (t) => oscillator('sine', 4400 * t) * (Math.sin(t * Math.PI * 2 * 28) > 0 ? 1 : 0) * envelope(t, 0.02, 0.38, 1.5), 0.08);

/** A soft music note (plucked) used by the music sequencer. */
export function pluck(ctx: BaseAudioContext, freq: number, seconds: number): AudioBuffer {
  return render(ctx, seconds, (t) => (oscillator('triangle', freq * t) * 0.7 + oscillator('sine', freq * 2 * t) * 0.3) * envelope(t, 0.006, seconds, 3), 0.3);
}

/** A slow pad note for chords. */
export function pad(ctx: BaseAudioContext, freq: number, seconds: number): AudioBuffer {
  return render(
    ctx,
    seconds,
    (t) => (oscillator('sine', freq * t) + 0.4 * oscillator('sine', freq * 1.5 * t) + 0.25 * oscillator('triangle', freq * 0.5 * t)) * Math.min(1, t / 0.6) * Math.min(1, (seconds - t) / 0.8),
    0.12,
  );
}

/** A bright calliope / fairground organ note: square and sine with a fast vibrato. */
export function organ(ctx: BaseAudioContext, freq: number, seconds: number): AudioBuffer {
  const osc = sweep(ctx.sampleRate);
  const lp = lowpass(ctx.sampleRate);
  return render(
    ctx,
    seconds,
    (t) => {
      const p = osc(freq * (1 + 0.006 * Math.sin(t * Math.PI * 2 * 6.5)));
      const v = 0.45 * oscillator('square', p) + 0.55 * oscillator('sine', p * 2) + 0.25 * oscillator('sine', p);
      return lp(v, 3200) * Math.min(1, t / 0.012) * Math.min(1, (seconds - t) / 0.05) * (0.85 + 0.15 * Math.exp(-t * 6));
    },
    0.16,
  );
}

/** The "oom" of an oom-pah bass: a round low note that dies away quickly. */
export function tuba(ctx: BaseAudioContext, freq: number, seconds: number): AudioBuffer {
  return render(ctx, seconds, (t) => (oscillator('triangle', freq * t) * 0.8 + oscillator('sine', freq * 2 * t) * 0.2) * envelope(t, 0.01, seconds, 2), 0.42);
}

/** A short organ chord stab (the "pah"). */
export function stab(ctx: BaseAudioContext, freq: number, seconds: number): AudioBuffer {
  return render(ctx, seconds, (t) => (0.6 * oscillator('square', freq * t) + 0.4 * oscillator('triangle', freq * t)) * envelope(t, 0.005, seconds, 2.5), 0.07);
}

/** A glockenspiel ping for sparkles on top. */
export function glock(ctx: BaseAudioContext, freq: number, seconds: number): AudioBuffer {
  return render(ctx, seconds, (t) => (oscillator('sine', freq * t) + 0.35 * oscillator('sine', freq * 3.98 * t) * Math.exp(-t * 12)) * envelope(t, 0.002, seconds, 4), 0.16);
}

/** A breathy wooden flute for the forest. */
export function flute(ctx: BaseAudioContext, freq: number, seconds: number): AudioBuffer {
  const osc = sweep(ctx.sampleRate);
  const n = noiseSource(7);
  const lp = lowpass(ctx.sampleRate);
  return render(
    ctx,
    seconds,
    (t) => {
      const vib = 1 + 0.008 * Math.sin(t * Math.PI * 2 * 5) * Math.min(1, t / 0.4);
      const p = osc(freq * vib);
      const tone = oscillator('sine', p) + 0.18 * oscillator('sine', p * 2);
      const breath = lp(n(), 2200) * 0.12;
      return (tone + breath) * Math.min(1, t / 0.12) * Math.min(1, (seconds - t) / 0.3);
    },
    0.2,
  );
}

/** A soft kalimba / music-box pluck for the forest. */
export function kalimba(ctx: BaseAudioContext, freq: number, seconds: number): AudioBuffer {
  return render(ctx, seconds, (t) => (oscillator('sine', freq * t) + 0.25 * oscillator('sine', freq * 5.4 * t) * Math.exp(-t * 18)) * envelope(t, 0.003, seconds, 3.5), 0.17);
}

/* ---- The mine: strange, dangerous sounds ---- */

/** The cave's breath: a deep rumbling drone with a slow, uneasy beat (loops). */
export function caveDrone(ctx: BaseAudioContext): AudioBuffer {
  const n = noiseSource(41);
  const lp = lowpass(ctx.sampleRate);
  const lp2 = lowpass(ctx.sampleRate);
  const seconds = 8;
  return render(
    ctx,
    seconds,
    (t) => {
      // Whole cycles of 40 Hz / 41.5 Hz / 0.25 Hz so the loop is seamless.
      const sub = Math.sin(t * Math.PI * 2 * 40) * 0.5 + Math.sin(t * Math.PI * 2 * 41.5) * 0.4;
      const rumble = lp2(lp(n(), 180), 90) * 6;
      const swell = 0.7 + 0.3 * Math.sin(t * Math.PI * 2 * 0.25);
      return (sub + rumble) * swell;
    },
    0.5,
  );
}

/** A water drip in a big cave: a falling plink and its echoes. */
export const caveDrip: Builder = (ctx) =>
  render(ctx, 1.2, (t) => {
    let v = 0;
    for (const [delay, amp] of [[0, 1], [0.21, 0.4], [0.43, 0.18], [0.66, 0.08]]) {
      const lt = t - delay;
      if (lt < 0 || lt > 0.12) continue;
      // Pitch falls from ~1900 Hz: phase = f0·t − k·t².
      v += Math.sin((lt * 1900 - lt * lt * 3500) * Math.PI * 2) * envelope(lt, 0.002, 0.1, 3) * amp;
    }
    return v;
  }, 0.35);

/** Distant rocks shifting: a low rumble with crackles. */
export const caveRumble: Builder = (ctx) => {
  const n = noiseSource(43);
  const lp = lowpass(ctx.sampleRate);
  const crackle = noiseSource(44);
  return render(ctx, 2.4, (t) => {
    const body = lp(n(), 140 + 80 * Math.sin(t * 3)) * 5 * envelope(t, 0.4, 2, 1.5);
    const bits = crackle() > 0.985 ? crackle() * envelope(t, 0.2, 2.2, 2) * 0.6 : 0;
    return body + bits;
  }, 0.55);
};

/** Something large growling in the dark: a rough low voice that wavers in pitch. */
export const caveGrowl: Builder = (ctx) => {
  const osc = sweep(ctx.sampleRate);
  const bp = bandpass(ctx.sampleRate);
  const bp2 = bandpass(ctx.sampleRate);
  const n = noiseSource(45);
  return render(ctx, 2, (t) => {
    const f = 62 + 14 * Math.sin(t * 2.4) + 6 * Math.sin(t * 23);
    const raw = oscillator('saw', osc(f)) + n() * 0.35;
    const voice = bp(raw, 420, 0.5) * 1.2 + bp2(raw, 900, 0.3) * 0.6;
    return voice * Math.min(1, t / 0.35) * Math.min(1, (2 - t) / 0.7);
  }, 0.5);
};

/** A whisper with no one there: breathy noise that flutters like speech. */
export const caveWhisper: Builder = (ctx) => {
  const n = noiseSource(46);
  const bp = bandpass(ctx.sampleRate);
  return render(ctx, 1.6, (t) => {
    const syllables = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * (5 + Math.sin(t * 2) * 2));
    const center = 2400 + 900 * Math.sin(t * 7);
    return bp(n(), center, 0.25) * syllables * Math.min(1, t / 0.2) * Math.min(1, (1.6 - t) / 0.5) * 2.2;
  }, 0.4);
};

/** A far-off wail echoing up from below. */
export const caveWail: Builder = (ctx) => {
  const echoes: [number, number][] = [[0, 1], [0.35, 0.45], [0.7, 0.2]];
  const phases = echoes.map(() => sweep(ctx.sampleRate));
  return render(ctx, 3, (t) => {
    let v = 0;
    echoes.forEach(([delay, amp], i) => {
      const lt = t - delay;
      if (lt < 0 || lt > 2.2) return;
      const shape = Math.sin((lt / 2.2) * Math.PI);
      const f = 520 + 260 * shape + 12 * Math.sin(lt * 34);
      v += oscillator('sine', phases[i](f)) * shape * amp;
    });
    return v;
  }, 0.3);
};

/** Skittering claws on stone, somewhere close. */
export const caveSkitter: Builder = (ctx) => {
  const n = noiseSource(47);
  const hp = highpass(ctx.sampleRate);
  return render(ctx, 0.9, (t) => {
    const tick = (t * 22) % 1 < 0.12 && Math.sin(t * 9) > -0.3 ? 1 : 0;
    return hp(n(), 2500) * tick * envelope(t, 0.05, 0.85, 1) * 1.5;
  }, 0.3);
};

/** A slow, heavy heartbeat (deep floors). */
export const caveHeartbeat: Builder = (ctx) =>
  render(ctx, 1.1, (t) => {
    let v = 0;
    for (const [d, a] of [[0, 1], [0.28, 0.7]]) {
      const lt = t - d;
      if (lt >= 0) v += Math.sin(lt * Math.PI * 2 * (55 - lt * 40)) * envelope(lt, 0.01, 0.25, 3) * a;
    }
    return v;
  }, 0.8);

/** A cold, glassy tone for the mine's score. */
export function glassTone(ctx: BaseAudioContext, freq: number, seconds: number): AudioBuffer {
  return render(
    ctx,
    seconds,
    (t) => (Math.sin(t * Math.PI * 2 * freq) + 0.3 * Math.sin(t * Math.PI * 2 * freq * 2.76) * Math.exp(-t * 2)) * Math.min(1, t / 0.8) * Math.min(1, (seconds - t) / 1.2),
    0.09,
  );
}
