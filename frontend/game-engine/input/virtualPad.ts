/**
 * On-screen touch controls write here; every scene's InputSystem reads it.
 * Button presses are counted (not cleared) so each scene sees each press once.
 */
export type PadButton = 'use' | 'interact' | 'inventory' | 'crafting' | 'map' | 'eat' | 'close' | 'collection' | 'next' | 'prev';

class VirtualPad {
  x = 0;
  y = 0;
  run = false;
  /** The touch Use button is being held (reeling in a fish). */
  useHeld = false;
  private readonly presses: Record<PadButton, number> = { use: 0, interact: 0, inventory: 0, crafting: 0, map: 0, eat: 0, close: 0, collection: 0, next: 0, prev: 0 };

  setMove(x: number, y: number, run: boolean): void {
    this.x = x;
    this.y = y;
    this.run = run;
  }

  press(button: PadButton): void {
    this.presses[button] += 1;
  }

  count(button: PadButton): number {
    return this.presses[button];
  }
}

export const virtualPad = new VirtualPad();
