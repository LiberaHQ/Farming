'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

/** "VALLEY" in chunky pixel letters, drawn the same way as the game's art. */
const GLYPHS: Record<string, string[]> = {
  V: ['10001', '10001', '10001', '10001', '01010', '01010', '00100'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
};

export function PixelLogo({ text = 'VALLEY', scale = 8, className }: { text?: string; scale?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const letters = text.split('');
  // 1px outline all round, 2px shadow below, 1px gap between letters.
  const w = letters.length * 6 - 1 + 2;
  const h = 7 + 2 + 2;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const fill = new Set<string>();
    letters.forEach((ch, i) => {
      (GLYPHS[ch] ?? []).forEach((row, y) => [...row].forEach((bit, x) => bit === '1' && fill.add(`${1 + i * 6 + x},${1 + y}`)));
    });
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const px = (x: number, y: number, c: string) => {
      ctx.fillStyle = c;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    };
    const has = (x: number, y: number) => fill.has(`${x},${y}`);
    // Drop shadow, then outline, then the letters with a light top and dark base.
    for (const k of fill) {
      const [x, y] = k.split(',').map(Number);
      for (let dy = 1; dy <= 2; dy++) for (let dx = -1; dx <= 1; dx++) if (!has(x + dx, y + dy)) px(x + dx, y + dy, '#16201a');
    }
    for (const k of fill) {
      const [x, y] = k.split(',').map(Number);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!has(x + dx, y + dy)) px(x + dx, y + dy, '#2b1d1a');
    }
    for (const k of fill) {
      const [x, y] = k.split(',').map(Number);
      px(x, y, !has(x, y - 1) ? '#fff1a8' : !has(x, y + 1) ? '#c8982a' : '#f4d24a');
    }
  }, [text, scale]); // eslint-disable-line react-hooks/exhaustive-deps

  return <canvas ref={ref} className={['pixel-logo', className].filter(Boolean).join(' ')} width={w * scale} height={h * scale} role="img" aria-label={text} />;
}

/** Top bar shared by the homepage and the docs: the name, Play and Docs. */
export function SiteHeader({ current }: { current?: 'docs' }) {
  return (
    <header className="site-header">
      <Link href="/" className="site-brand" aria-label="Valley home">
        <PixelLogo scale={3} />
      </Link>
      <nav className="site-actions">
        <Link className="site-btn site-btn-play" href="/start">
          ▶ Play
        </Link>
        <Link className={`site-btn${current === 'docs' ? ' is-current' : ''}`} href="/docs">
          Docs
        </Link>
      </nav>
    </header>
  );
}
