import * as Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { BeachScene } from './scenes/BeachScene';
import { ForestScene } from './scenes/ForestScene';
import { VillagerHomeScene } from './scenes/VillagerHomeScene';
import { MuseumScene } from './scenes/MuseumScene';
import { IslandScene } from './scenes/IslandScene';
import { IslandCaveScene } from './scenes/IslandCaveScene';
import { CarnivalScene } from './scenes/CarnivalScene';
import { InteriorScene } from './scenes/InteriorScene';
import { MineScene } from './scenes/MineScene';
import { WorldScene } from './scenes/WorldScene';
import type { CreateGameOptions } from './index';

export function createGameConfig(parent: HTMLElement, options: CreateGameOptions): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#1d2a1c',
    pixelArt: true,
    roundPixels: true,
    banner: false,
    disableContextMenu: true,
    scale: {
      // Canvas always fills its container; the camera picks an integer zoom.
      mode: Phaser.Scale.RESIZE,
      width: parent.clientWidth || 960,
      height: parent.clientHeight || 540,
      autoRound: true,
    },
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    render: { powerPreference: 'high-performance' },
    callbacks: {
      preBoot: (game) => {
        game.registry.set('seed', options.seed);
        game.registry.set('initialSave', options.initialSave ?? null);
        game.registry.set('saveStore', options.store);
        game.registry.set('defaultAppearance', options.defaultAppearance);
        game.registry.set('coop', options.coop ?? null);
      },
    },
    scene: [BootScene, WorldScene, MineScene, BeachScene, InteriorScene, ForestScene, CarnivalScene, VillagerHomeScene, MuseumScene, IslandScene, IslandCaveScene],
  };
}
