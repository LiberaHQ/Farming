/**
 * A tiny offline synthesiser: every sound in the game is generated here as an
 * AudioBuffer from oscillators, noise, envelopes and simple filters, so there
 * are no audio files to load or license.
 */

export type Wave = 'sine' | 'square' | 'triangle' | 'saw';

const TAU = Math.PI * 2;

export function oscillator(wave: Wave, phase: number): number {
  const p = phase - Math.floor(phase);
  switch (wave) {
    case 'sine':
      return Math.sin(p * TAU);
    case 'square':
      return p < 0.5 ? 1 : -1;
    case 'triangle':
      return 1 - 4 * Math.abs(p - 0.5);
    case 'saw':
      return 2 * p - 1;
  }
}

/** Attack/decay envelope (seconds), shaped exponentially. */
export function envelope(t: number, attack: number, decay: number, curve = 3): number {
  if (t < attack) return attack > 0 ? t / attack : 1;
  const d = (t - attack) / decay;
  return d >= 1 ? 0 : Math.pow(1 - d, curve);
}

/** Deterministic white noise source, so sounds are identical every run. */
export function noiseSource(seed = 1): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296) * 2 - 1;
  };
}

/** One-pole low-pass; `cutoff` in Hz may change per sample. */
export function lowpass(sampleRate: number) {
  let y = 0;
  return (x: number, cutoff: number) => {
    const a = 1 - Math.exp((-TAU * cutoff) / sampleRate);
    y += a * (x - y);
    return y;
  };
}

/** One-pole high-pass. */
export function highpass(sampleRate: number) {
  const lp = lowpass(sampleRate);
  return (x: number, cutoff: number) => x - lp(x, cutoff);
}

/** Band-pass made from a high-pass and a low-pass around `center`. */
export function bandpass(sampleRate: number) {
  const hp = highpass(sampleRate);
  const lp = lowpass(sampleRate);
  return (x: number, center: number, width = 0.6) => lp(hp(x, center * (1 - width)), center * (1 + width));
}

export interface Voice {
  /** Sample value at time t (seconds) for sample index i. */
  (t: number, i: number): number;
}

/** Renders `seconds` of audio from a voice function into a mono buffer, with a short fade-out. */
export function render(ctx: BaseAudioContext, seconds: number, voice: Voice, gain = 1): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(seconds * rate));
  const buffer = ctx.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);
  const fade = Math.min(length, Math.floor(rate * 0.005));
  for (let i = 0; i < length; i++) {
    let v = voice(i / rate, i) * gain;
    if (i > length - fade) v *= (length - i) / fade;
    data[i] = Math.max(-1, Math.min(1, v));
  }
  return buffer;
}

/** Phase accumulator for a frequency that changes over time (sweeps, vibrato). */
export function sweep(sampleRate: number) {
  let phase = 0;
  return (freq: number) => {
    phase += freq / sampleRate;
    return phase;
  };
}

export const midiToFreq = (note: number) => 440 * Math.pow(2, (note - 69) / 12);
