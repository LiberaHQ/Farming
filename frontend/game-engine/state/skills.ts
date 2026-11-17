import { MAX_SKILL_LEVEL, SKILL_IDS, SKILL_XP, skillBonusChance, skillEnergyDiscount, skillLevel, type SkillId, type ToolKind } from '@farming/shared';

const TOOL_SKILL: Partial<Record<ToolKind, SkillId>> = { axe: 'foraging', pickaxe: 'mining', hoe: 'farming', watering_can: 'farming', fishing_rod: 'fishing' };

/**
 * Your skills (one per player, shared by every scene): systems call `gain` when
 * you harvest, chop, mine or fish, and `bonus` to roll the extra-yield perk.
 */
class Skills {
  private xp: Record<SkillId, number> = { farming: 0, fishing: 0, mining: 0, foraging: 0 };
  /** Called when a level is reached (the world scene shows it). */
  onLevel: (id: SkillId, level: number) => void = () => undefined;
  onChange: () => void = () => undefined;

  load(save: Partial<Record<string, number>> | undefined): void {
    for (const id of SKILL_IDS) this.xp[id] = Math.max(0, save?.[id] ?? 0);
  }

  toSave(): Record<SkillId, number> {
    return { ...this.xp };
  }

  level(id: SkillId): number {
    return skillLevel(this.xp[id]);
  }

  /** XP into the current level and the size of that level (for progress bars). */
  progress(id: SkillId): { level: number; into: number; need: number; xp: number } {
    const level = this.level(id);
    if (level >= MAX_SKILL_LEVEL) return { level, into: 1, need: 1, xp: this.xp[id] };
    return { level, into: this.xp[id] - SKILL_XP[level], need: SKILL_XP[level + 1] - SKILL_XP[level], xp: this.xp[id] };
  }

  gain(id: SkillId, amount: number): void {
    if (amount <= 0) return;
    const before = this.level(id);
    this.xp[id] = Math.min(this.xp[id] + Math.round(amount), SKILL_XP[MAX_SKILL_LEVEL] * 4);
    const after = this.level(id);
    for (let l = before + 1; l <= after; l++) this.onLevel(id, l);
    this.onChange();
  }

  /** Rolls the extra-yield perk for a skill. */
  bonus(id: SkillId): boolean {
    return Math.random() < skillBonusChance(this.level(id));
  }

  /** Energy a tool swing costs after the skill discount (never below 1, except free watering at Farming 10). */
  toolCost(kind: ToolKind | undefined, base: number): number {
    const id = kind ? TOOL_SKILL[kind] : undefined;
    if (!id) return base;
    return Math.max(kind === 'watering_can' && this.level(id) >= 10 ? 0 : 1, base - skillEnergyDiscount(this.level(id)));
  }
}

export const skills = new Skills();
