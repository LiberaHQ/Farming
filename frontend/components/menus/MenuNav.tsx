import Link from 'next/link';

/** Home and Docs buttons at the top of the menu pages (title, login, profile). */
export function MenuNav() {
  return (
    <nav className="menu-nav" aria-label="Site">
      <Link className="site-btn" href="/">
        ⌂ Home
      </Link>
      <Link className="site-btn" href="/docs">
        Docs
      </Link>
    </nav>
  );
}
