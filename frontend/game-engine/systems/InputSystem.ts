import * as Phaser from 'phaser';
import { virtualPad, type PadButton } from '../input/virtualPad';
import { BIND_ACTIONS, SECONDARY_KEYS, settings, type BindAction } from '../settings';

export interface MoveIntent {
  /** -1..1 (keyboard gives -1, 0 or 1; a stick can give anything between) */
  x: number;
  /** -1..1 */
  y: number;
  run: boolean;
}

/** Discrete actions triggered this frame (edge-triggered, not held). */
export interface ActionIntent {
  use: boolean;
  interact: boolean;
  toggleInventory: boolean;
  toggleCrafting: boolean;
  toggleMap: boolean;
  toggleCollection: boolean;
  toggleJournal: boolean;
  toggleEmotes: boolean;
  /** Tell the pet to stay put, or to follow again. */
  petStay: boolean;
  /** Call the horse, get on, or get off. */
  horse: boolean;
  toggleCalendar: boolean;
  toggleMinimap: boolean;
  /** Eat the selected food. */
  eat: boolean;
  close: boolean;
  /** Hotbar slot chosen with the number keys, or null. */
  hotbar: number | null;
  /** -1 / +1 from the mouse wheel or shoulder buttons, or 0. */
  cycle: number;
}

const HOTBAR_KEYS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'ZERO'] as const;

/** Standard gamepad layout → game buttons. */
const PAD_BUTTONS: Partial<Record<number, PadButton>> = {
  0: 'use', // A / Cross
  2: 'interact', // X / Square
  1: 'close', // B / Circle
  3: 'inventory', // Y / Triangle
  4: 'prev', // LB
  5: 'next', // RB
  6: 'eat', // LT
  8: 'map', // Back / View
  9: 'close', // Start / Menu
};
const PAD_RUN = 7; // RT
const DEAD_ZONE = 0.25;

/**
 * Translates keyboard, mouse, gamepad and on-screen touch controls into
 * device-independent intents. Key bindings come from the player's settings
 * and update live when they're changed.
 */
export class InputSystem {
  private keys = new Map<BindAction, Phaser.Input.Keyboard.Key[]>();
  private readonly esc: Phaser.Input.Keyboard.Key;
  private readonly hotbar: Phaser.Input.Keyboard.Key[];
  private pointerUse = false;
  private wheel = 0;
  /** Touch presses already seen by this scene. */
  private readonly padSeen = new Map<PadButton, number>();
  /** Gamepad buttons held last frame. */
  private padHeld = new Set<number>();
  private readonly offSettings: () => void;

  constructor(private readonly scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input is not available');
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.esc = keyboard.addKey(K.ESC, true);
    this.hotbar = HOTBAR_KEYS.map((name) => keyboard.addKey(K[name], true));
    this.bindKeys();
    this.offSettings = settings.on(() => this.bindKeys());
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.offSettings());
    scene.events.once(Phaser.Scenes.Events.DESTROY, () => this.offSettings());
    for (const b of ['use', 'interact', 'inventory', 'crafting', 'map', 'eat', 'close', 'collection', 'next', 'prev'] as PadButton[]) {
      this.padSeen.set(b, virtualPad.count(b));
    }

    scene.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[] = []) => {
      // Clicking an item on the ground picks it up rather than swinging the tool.
      if (over.some((o) => o.getData?.('floorItem'))) return;
      // Touches go through the on-screen buttons instead.
      if (pointer.leftButtonDown() && !pointer.wasTouch) this.pointerUse = true;
    });
    scene.input.on(Phaser.Input.Events.POINTER_WHEEL, (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      this.wheel += Math.sign(dy);
    });
  }

  private bindKeys(): void {
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) return;
    for (const list of this.keys.values()) for (const k of list) keyboard.removeKey(k, true);
    this.keys = new Map();
    const { keys } = settings.get();
    for (const { id } of BIND_ACTIONS) {
      const codes = [keys[id], SECONDARY_KEYS[id]].filter((c): c is number => c !== undefined);
      this.keys.set(
        id,
        [...new Set(codes)].map((c) => keyboard.addKey(c, true)),
      );
    }
  }

  private down(action: BindAction): boolean {
    return this.keys.get(action)?.some((k) => k.isDown) ?? false;
  }

  /** Polls every key of an action once (so no "just pressed" state lingers). */
  private pressed(action: BindAction): boolean {
    let hit = false;
    for (const k of this.keys.get(action) ?? []) if (Phaser.Input.Keyboard.JustDown(k)) hit = true;
    return hit;
  }

  private gamepad(): Gamepad | null {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    for (const pad of navigator.getGamepads()) if (pad?.connected) return pad;
    return null;
  }

  /** Use held down right now (keys, mouse, gamepad A, or the touch Use button) — for reeling in. */
  useHeld(): boolean {
    if (this.down('use')) return true;
    if (this.scene.input.activePointer?.isDown && !this.scene.input.activePointer.wasTouch) return true;
    if (this.gamepad()?.buttons[0]?.pressed) return true;
    return virtualPad.useHeld;
  }

  getMoveIntent(): MoveIntent {
    let x = (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0);
    let y = (this.down('down') ? 1 : 0) - (this.down('up') ? 1 : 0);
    let run = this.down('run');
    const pad = this.gamepad();
    if (pad && x === 0 && y === 0) {
      const [ax = 0, ay = 0] = pad.axes;
      const dpadX = (pad.buttons[15]?.pressed ? 1 : 0) - (pad.buttons[14]?.pressed ? 1 : 0);
      const dpadY = (pad.buttons[13]?.pressed ? 1 : 0) - (pad.buttons[12]?.pressed ? 1 : 0);
      if (dpadX || dpadY) [x, y] = [dpadX, dpadY];
      else if (Math.hypot(ax, ay) > DEAD_ZONE) [x, y] = [ax, ay];
      run ||= (pad.buttons[PAD_RUN]?.value ?? 0) > 0.4;
    }
    if (x === 0 && y === 0 && (virtualPad.x || virtualPad.y)) [x, y] = [virtualPad.x, virtualPad.y];
    run ||= virtualPad.run;
    return { x, y, run };
  }

  /** Buttons pressed this frame on the gamepad and the touch controls. */
  private extraPresses(): Set<PadButton> {
    const out = new Set<PadButton>();
    for (const [b, seen] of this.padSeen) {
      const now = virtualPad.count(b);
      if (now !== seen) {
        this.padSeen.set(b, now);
        out.add(b);
      }
    }
    const pad = this.gamepad();
    const held = new Set<number>();
    pad?.buttons.forEach((btn, i) => {
      if (!btn.pressed) return;
      held.add(i);
      const name = PAD_BUTTONS[i];
      if (name && !this.padHeld.has(i)) out.add(name);
    });
    this.padHeld = held;
    return out;
  }

  /** Must be called exactly once per frame. */
  getActions(): ActionIntent {
    // Poll every key once, so no key's "just pressed" state lingers to a later frame.
    const hotbarPressed = this.hotbar.map((key) => Phaser.Input.Keyboard.JustDown(key));
    const hotbar = hotbarPressed.indexOf(true);
    const extra = this.extraPresses();
    const p = (action: BindAction, pad: PadButton) => this.pressed(action) || extra.has(pad);
    const mapKey = this.keys.get('map')?.[0];
    const map = this.pressed('map');
    const result: ActionIntent = {
      use: p('use', 'use') || this.pointerUse,
      interact: p('interact', 'interact'),
      toggleInventory: p('inventory', 'inventory'),
      toggleCrafting: p('crafting', 'crafting'),
      // Shift+M is mute (handled by the scene); plain M opens the map.
      toggleMap: (map && !mapKey?.shiftKey) || extra.has('map'),
      toggleCollection: p('collection', 'collection'),
      toggleJournal: this.pressed('journal'),
      toggleEmotes: this.pressed('emote'),
      petStay: this.pressed('petStay'),
      horse: this.pressed('horse'),
      toggleCalendar: this.pressed('calendar'),
      toggleMinimap: this.pressed('minimap'),
      eat: p('eat', 'eat'),
      close: Phaser.Input.Keyboard.JustDown(this.esc) || extra.has('close'),
      hotbar: hotbar >= 0 ? hotbar : null,
      cycle: this.wheel + (extra.has('next') ? 1 : 0) - (extra.has('prev') ? 1 : 0),
    };
    this.pointerUse = false;
    this.wheel = 0;
    return result;
  }
}
