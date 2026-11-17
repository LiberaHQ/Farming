'use client';

import dynamic from 'next/dynamic';

/** The wallet button, loaded in the browser only (wallet libraries need window). */
export const WalletLogin = dynamic(() => import('./WalletLogin').then((m) => m.WalletLogin), {
  ssr: false,
  loading: () => (
    <button type="button" className="btn btn-wallet" disabled>
      🦊 Sign in with wallet
    </button>
  ),
});
