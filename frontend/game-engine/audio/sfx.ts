import type { AudioSystem } from './AudioSystem';
import type { SfxName } from './sounds';

/**
 * Global access point for sound effects, so any system can play a sound
 * without wiring the audio system through every constructor. Does nothing
 * until the world scene has created its AudioSystem.
 */
let active: AudioSystem | null = null;

export function bindAudio(system: AudioSystem | null): void {
  active = system;
}

/** Unbinds only if `system` is still the active one (a newer game may have bound its own). */
export function unbindAudio(system: AudioSystem): void {
  if (active === system) active = null;
}

let volumeScale = 1;

export function sfx(name: SfxName, options?: { volume?: number; rate?: number; vary?: number }): void {
  if (volumeScale <= 0) return;
  active?.play(name, volumeScale === 1 ? options : { ...options, volume: (options?.volume ?? 1) * volumeScale });
}

/** Runs `work` with every sound it plays scaled (e.g. quieter for another player's distant actions). */
export function withSfxVolume(scale: number, work: () => void): void {
  const before = volumeScale;
  volumeScale = before * scale;
  try {
    work();
  } finally {
    volumeScale = before;
  }
}
