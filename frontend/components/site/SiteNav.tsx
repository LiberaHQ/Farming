'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { SessionUser } from '@/services/api';
import { PixelLogo } from './SiteChrome';

type Page = 'dashboard';

const LINKS: Array<{ label: string; href: string; page?: Page }> = [
  { label: 'Dashboard', href: '/dashboard', page: 'dashboard' },
  { label: 'Play', href: '/dashboard#play' },
  { label: 'Open World', href: '/play?world=1' },
  { label: 'Tournaments', href: '/dashboard#tournaments' },
  { label: 'Leaderboard', href: '/dashboard#leaderboard' },
  { label: 'Updates', href: '/dashboard#updates' },
  { label: 'How to Play', href: '/docs' },
  { label: 'Creatures', href: '/docs#creatures' },
];

/** Your name in the top bar: opens a small menu (dashboard, profile, log out). */
function AccountMenu({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on a click elsewhere or Escape.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div className="dash-account" ref={ref}>
      <button type="button" className="dash-btn dash-btn-orange" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {user.wallet ? '🦊 ' : ''}
        {user.displayName} <span aria-hidden className="dash-caret">▾</span>
      </button>
      {open && (
        <div className="dash-menu" role="menu">
          <Link role="menuitem" href="/dashboard" onClick={() => setOpen(false)}>
            📊 Dashboard
          </Link>
          <Link role="menuitem" href="/profile" onClick={() => setOpen(false)}>
            ⚙ Profile
          </Link>
          <button
            type="button"
            role="menuitem"
            className="dash-menu-logout"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            🚪 Log out
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The glass top bar shared by the dashboard and its sections: the logo,
 * the main links (one swipeable row on phones), your gold, and your account menu.
 */
export function SiteNav({ current, user, gold, onLogout }: { current: Page; user: SessionUser | null | undefined; gold?: number | null; onLogout: () => void }) {
  return (
    <nav className="dash-nav" aria-label="Main">
      <Link href="/" className="dash-brand" aria-label="Harvest Valley home">
        <PixelLogo text={'HARVEST VALLEY'} scale={2} />
        <span className="dash-beta">BETA</span>
      </Link>
      <div className="dash-links">
        {LINKS.map((n) => (
          <Link key={n.label} href={n.href} className={n.page === current ? 'is-current' : undefined} aria-current={n.page === current ? 'page' : undefined}>
            {n.label}
          </Link>
        ))}
      </div>
      <div className="dash-nav-right">
        {typeof gold === 'number' && <span className="dash-pill">🪙 {gold.toLocaleString()}g</span>}
        {user ? (
          <AccountMenu user={user} onLogout={onLogout} />
        ) : user === null ? (
          <Link className="dash-btn dash-btn-orange" href="/login">
            Log in
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

/** Logs out, and lets go of the wallet too if that's how they signed in. */
export async function logOutEverywhere(user: SessionUser | null | undefined, logout: () => Promise<void>): Promise<void> {
  const wasWallet = !!user?.wallet;
  await logout();
  if (wasWallet) await (await import('@/components/wallet/WalletLogin')).disconnectWallet();
}
