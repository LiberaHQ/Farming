import path from 'node:path';
import type { NextConfig } from 'next';

/** Where the Express backend runs; the game reaches it through /api on its own origin. */
const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: { position: 'bottom-right' },
  // The shared workspace ships TypeScript source; let Next compile it.
  transpilePackages: ['@farming/shared'],
  // Monorepo: dependencies are hoisted to the repository root.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${backendUrl}/api/:path*` }];
  },
  turbopack: {
    root: path.resolve(process.cwd(), '..'),
    // Not used (see the stub); keeps an unbundleable optional dependency out.
    resolveAlias: { '@base-org/account': './components/wallet/baseAccountStub.ts' },
  },
};

export default nextConfig;
