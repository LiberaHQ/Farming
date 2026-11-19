import type { AppearanceChoice } from '../game-config';
import type { ItemId } from '../game-config/items';

/**
 * Everything the dashboard page shows about a player, gathered on the server:
 * their Open World character (or, if they haven't joined it yet, their most
 * recently played world), tournaments, friends and the monthly leaderboard.
 */
export interface DashboardView {
  profile: {
    displayName: string;
    appearance: AppearanceChoice;
    motto: string;
    memberSince: number;
    lastPlayed: number | null;
  };
  /** Where the character data below comes from. */
  source: { kind: 'openworld'; valley: string } | { kind: 'world'; seed: string } | null;
  character: {
    gold: number;
    lifetimeEarnings: number;
    items: Array<{ itemId: ItemId; quantity: number }>;
    skills: Record<string, number>;
    mineDepth: number;
    equipment: { ring?: ItemId; armor?: ItemId };
    pets: Array<{ kind: 'cat' | 'dog'; name: string; love: number }>;
    horse: string | null;
    spouse: string | null;
    day: number;
  } | null;
  worlds: { count: number; longestDays: number; totalEarnings: number };
  friends: { total: number; online: number; list: Array<{ name: string; online: boolean }> };
  tournaments: {
    entries: number;
    best: number | null;
    prizes: number;
    rank: number | null;
    points: number;
    recent: Array<{ name: string; rank: number | null; entrants: number; score: number | null; prize: number; endsAt: number }>;
  };
  leaderboard: Array<{ name: string; points: number; me: boolean }>;
  openWorld: { online: number; valleys: number };
}
