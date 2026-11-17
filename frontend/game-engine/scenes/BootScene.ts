import * as Phaser from 'phaser';
import { DEFAULT_APPEARANCE, DEFAULT_WORLD_SEED, NPCS, type NpcId } from '@farming/shared';
import { npcTextureKey, registerTextures, TEXTURES } from '../assets/registerTextures';
import { SCENES } from '../constants';
import type { CoopSession } from '../net/CoopSession';
import { createCharacterAnimations } from '../entities/Player';

/** Generates all art and animations, then hands off to the world. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.Boot);
  }

  create(): void {
    registerTextures(this, DEFAULT_APPEARANCE);
    createCharacterAnimations(this, TEXTURES.player);
    for (const id of Object.keys(NPCS) as NpcId[]) createCharacterAnimations(this, npcTextureKey(id));
    const seed = (this.registry.get('seed') as string | undefined) ?? DEFAULT_WORLD_SEED;
    const session = this.registry.get('coop') as CoopSession | null;
    const coop = session
      ? { session, shared: session.join.shared, me: session.join.me, members: session.join.members }
      : null;
    this.scene.start(SCENES.World, { seed: session?.join.room.seed ?? seed, save: this.registry.get('initialSave') ?? null, coop });
  }
}
