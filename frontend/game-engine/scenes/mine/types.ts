import type { BossId } from '@farming/shared';

/** Things that happen in the mine that a run (Mine Dash) scores. */
export type MineEvent =
  | { t: 'floor'; floor: number }
  | { t: 'boss'; floor: number; id: BossId; mini: boolean }
  | { t: 'elite' }
  | { t: 'vault' }
  /** Left a floor without taking a hit. */
  | { t: 'clean'; floor: number }
  | { t: 'hurt'; damage: number };

/**
 * A run through a fixed mine (Mine Dash). The seed makes every floor, rock,
 * monster and chest the same for every player; the run gets told what happens.
 */
export interface MineRun {
  seed: string;
  /** The course ends after this floor (a Sprint stops at 10). */
  lastFloor: number;
  /** Camp upgrades. */
  lanternBonus: number;
  attackBonus: number;
  defenseBonus: number;
  event(e: MineEvent): void;
  /** The Scout's map: true if this floor's ladder rock should glint. */
  useMap(): boolean;
  /** Leaving a 5th floor: the camp decides whether you go on or bank your score. */
  camp(floor: number): Promise<'continue' | 'bank'>;
}
