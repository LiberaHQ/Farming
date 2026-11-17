import type { ToolKind } from './items';

/** Things you get better at by doing them. */
export const SKILL_IDS = ['farming', 'fishing', 'mining', 'foraging'] as const;
export type SkillId = (typeof SKILL_IDS)[number];

export const MAX_SKILL_LEVEL = 10;

/** Total XP needed to reach each level (index = level). */
export const SKILL_XP: readonly number[] = [0, 60, 160, 320, 540, 820, 1180, 1620, 2160, 2800, 3600];

export interface SkillDef {
  id: SkillId;
  name: string;
  emoji: string;
  /** How you earn it. */
  how: string;
  /** What the extra-yield perk gives. */
  bonus: string;
  /** The tool that costs less energy from level 5. */
  tool: ToolKind;
}

export const SKILLS: Record<SkillId, SkillDef> = {
  farming: { id: 'farming', name: 'Farming', emoji: '🌾', how: 'Harvest crops (island crops too).', bonus: 'an extra crop at harvest', tool: 'hoe' },
  fishing: { id: 'fishing', name: 'Fishing', emoji: '🎣', how: 'Catch fish — harder fish teach you more.', bonus: 'a bigger catch bar', tool: 'fishing_rod' },
  mining: { id: 'mining', name: 'Mining', emoji: '⛏', how: 'Break rocks and ore, on the farm, in the mine and the island cave.', bonus: 'extra ore and stone', tool: 'pickaxe' },
  foraging: { id: 'foraging', name: 'Foraging', emoji: '🍄', how: 'Chop trees and stumps, pick berries and wild finds.', bonus: 'extra wood and finds', tool: 'axe' },
};

export function skillLevel(xp: number): number {
  let level = 0;
  while (level < MAX_SKILL_LEVEL && xp >= SKILL_XP[level + 1]) level++;
  return level;
}

/** Chance (0–1) of the extra-yield perk: 3% a level, plus 10% at level 10. */
export function skillBonusChance(level: number): number {
  return level * 0.03 + (level >= MAX_SKILL_LEVEL ? 0.1 : 0);
}

/** Energy saved per swing of the skill's tool (from level 5; more at 10). */
export function skillEnergyDiscount(level: number): number {
  return level >= 10 ? 2 : level >= 5 ? 1 : 0;
}

/** Perks shown in the skills panel, by level. */
export function skillPerks(id: SkillId, level: number): string[] {
  const def = SKILLS[id];
  const out = [id === 'fishing' ? `Catch bar ${level * 4}% bigger` : `${Math.round(skillBonusChance(level) * 100)}% chance of ${def.bonus}`];
  if (level >= 5) out.push(`${def.tool === 'watering_can' ? 'Watering can' : def.tool === 'fishing_rod' ? 'Casting' : def.tool[0].toUpperCase() + def.tool.slice(1)} costs ${skillEnergyDiscount(level)} less energy`);
  if (level >= MAX_SKILL_LEVEL) out.push(`Master ${def.name.toLowerCase()}!`);
  return out;
}

// ---------- The horse ----------

/** A rider moves this much faster than walking (and running). */
export const HORSE_SPEED = 1.9;
export const HORSE_NAMES = ['Clover', 'Biscuit', 'Maple', 'Juniper', 'Pepper', 'Willow', 'Hazel', 'Barley'] as const;
