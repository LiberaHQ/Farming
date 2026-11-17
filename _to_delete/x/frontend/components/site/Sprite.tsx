'use client';

import { useEffect, useRef, useState } from 'react';
import { renderArt, type Art } from './catalog';

/** One shared clock so every animated sprite steps in time. */
const listeners = new Set<(tick: number) => void>();
let tick = 0;
let timer: ReturnType<typeof setInterval> | null = null;

function useTick(enabled: boolean): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    listeners.add(setT);
    timer ??= setInterval(() => {
      tick += 1;
      for (const l of listeners) l(tick);
    }, 260);
    return () => {
      listeners.delete(setT);
      if (listeners.size === 0 && timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  }, [enabled]);
  return t;
}

/** Size of one frame of the art, in art pixels (null before mount). */
export function artSize(art: Art): { w: number; h: number } {
  if (art.frames) return { w: art.frames.w, h: art.frames.h };
  const c = renderArt(art);
  return { w: c.width, h: c.height };
}

interface SpriteProps {
  art: Art;
  scale?: number;
  /** Play the sheet's frames. */
  animate?: boolean;
  /** Start on a different frame so neighbours don't step in lockstep. */
  offset?: number;
  flip?: boolean;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

/** Game pixel art drawn crisp at an integer scale. */
export function Sprite({ art, scale = 3, animate = true, offset = 0, flip = false, className, style, title }: SpriteProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const count = art.frames?.count ?? 1;
  const t = useTick(animate && count > 1);
  const frame = count > 1 ? (t + offset) % count : 0;

  useEffect(() => setSize(artSize(art)), [art]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !size) return;
    const src = renderArt(art);
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const sx = art.frames ? frame * art.frames.w : 0;
    const sy = art.frames?.y ?? 0;
    ctx.save();
    if (flip) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(src, sx, sy, size.w, size.h, 0, 0, size.w * scale, size.h * scale);
    ctx.restore();
  }, [art, size, frame, scale, flip]);

  if (!size) return <span className={className} style={{ display: 'inline-block', width: 16 * scale, height: 16 * scale, ...style }} />;
  return (
    <canvas
      ref={ref}
      className={['sprite', className].filter(Boolean).join(' ')}
      width={size.w * scale}
      height={size.h * scale}
      style={style}
      title={title ?? art.name}
      aria-label={art.name}
      role="img"
    />
  );
}
