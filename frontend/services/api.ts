import type { DashboardView, AppearanceChoice, LobbyView, SaveData, WorldSummary } from '@farming/shared';

/**
 * Typed client for the backend. Requests go to /api on the game's own origin
 * (Next.js proxies them to Express), so the session cookie just works.
 */

export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  /** Set for accounts that sign in with a wallet. */
  wallet?: string | null;
}

export interface Profile {
  displayName: string;
  appearance: AppearanceChoice;
  motto?: string;
  updatedAt: number;
}

export interface ProfileStats {
  worlds: number;
  totalEarnings: number;
  longestWorldDays: number;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      credentials: 'same-origin',
      ...init,
      headers: { ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers },
    });
  } catch {
    throw new ApiError(0, "Can't reach the server.");
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(res.status, body.error ?? (res.status >= 500 ? 'The server is unavailable.' : 'Request failed.'));
  return body as T;
}

const json = (method: string, data: unknown): RequestInit => ({ method, body: JSON.stringify(data) });
const worldPath = (seed: string) => `/worlds/${encodeURIComponent(seed)}`;

export const api = {
  health: () => request<{ status: string; database: boolean }>('/health'),

  me: () => request<{ user: SessionUser | null }>('/auth/me'),
  register: (username: string, password: string) => request<{ user: SessionUser }>('/auth/register', json('POST', { username, password })),
  login: (username: string, password: string) => request<{ user: SessionUser }>('/auth/login', json('POST', { username, password })),
  googleConfig: () => request<{ clientId: string | null }>('/auth/google/config'),
  googleSignIn: (credential: string) => request<{ user: SessionUser; created: boolean }>('/auth/google', json('POST', { credential })),
  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),

  profile: () => request<{ profile: Profile; stats: ProfileStats }>('/profile'),
  updateProfile: (changes: Partial<Pick<Profile, 'displayName' | 'appearance' | 'motto'>>) => request<{ profile: Profile }>('/profile', json('PATCH', changes)),

  worlds: () => request<{ worlds: WorldSummary[] }>('/worlds'),
  /** Null when this world has no save yet. */
  loadWorld: async (seed: string): Promise<SaveData | null> => (await request<{ save: SaveData | null }>(worldPath(seed))).save,
  /** `keepalive` lets the request finish while the page is closing (bodies up to 64KB). */
  saveWorld: (data: SaveData, keepalive = false) =>
    request<{ savedAt: number }>(worldPath(data.seed), { ...json('PUT', data), keepalive }),
  friends: () => request<{ friends: Array<{ username: string; displayName: string; playing: { code: string; seed: string; hostName: string } | null }> }>('/friends'),
  addFriend: (username: string) => request<{ ok: true }>('/friends', json('POST', { username })),
  removeFriend: (username: string) => request<{ ok: true }>(`/friends/${encodeURIComponent(username)}`, { method: 'DELETE' }),
  dashboard: () => request<DashboardView>('/dashboard'),
  lobbies: () => request<{ lobbies: LobbyView[] }>('/lobbies'),
  openWorld: () => request<{ online: number; valleys: number; resident: { valley: string } | null }>('/openworld'),
  deleteWorld: (seed: string) => request<{ ok: true }>(worldPath(seed), { method: 'DELETE' }),
};

/** World names: letters, numbers, spaces, - and _ (max 64). Matches the server. */
export const SEED_PATTERN = /^[\w\- ]{1,64}$/;

export function cleanSeed(raw: string | null | undefined): string | null {
  const seed = raw?.trim().slice(0, 64) ?? '';
  return SEED_PATTERN.test(seed) ? seed : null;
}

const WORDS_A = ['mossy', 'sunny', 'misty', 'golden', 'quiet', 'amber', 'willow', 'clover', 'river', 'maple'];
const WORDS_B = ['hollow', 'meadow', 'brook', 'glade', 'ridge', 'vale', 'grove', 'field', 'creek', 'acre'];

export function randomSeed(): string {
  const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
  return `${pick(WORDS_A)}-${pick(WORDS_B)}-${Math.floor(Math.random() * 90 + 10)}`;
}
