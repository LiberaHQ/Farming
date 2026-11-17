/**
 * Stand-in for `@base-org/account`. wagmi's Base Account connector imports it
 * lazily, and it drags in Coinbase's server SDK with optional packages that
 * don't bundle. Harvest Valley doesn't offer the Base Account wallet, so this stub is
 * aliased in next.config.ts instead.
 */
export function createBaseAccountSDK(): never {
  throw new Error('Base Account is not available in Harvest Valley.');
}
