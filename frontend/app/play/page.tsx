import { DEFAULT_WORLD_SEED } from '@farming/shared';
import { GameCanvas, type CoopMode } from '@/components/GameCanvas';
import { Hud } from '@/components/Hud';
import { cleanSeed } from '@/services/api';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata = { title: 'Playing — Valley' };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * The game itself.
 * - /play?seed=name           play a world alone (each world has its own save)
 * - /play?seed=name&host=1    open that world to friends (co-op host)
 * - /play?join=CODE           join a friend's world
 */
export default async function PlayPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const seed = cleanSeed(first(params.seed)) ?? DEFAULT_WORLD_SEED;
  const code = first(params.join)?.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const mode: CoopMode = code ? { kind: 'join', code } : first(params.host) === '1' ? { kind: 'host' } : { kind: 'solo' };

  return (
    <main className="game-shell">
      <GameCanvas key={`${seed}:${mode.kind}:${code ?? ''}`} seed={seed} mode={mode} />
      <Hud />
    </main>
  );
}
