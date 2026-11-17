'use client';

import { useEffect } from 'react';

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

type Dir = 'up' | 'down' | 'left' | 'right';

function visible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
}

/** The focusable thing nearest in a direction (favouring ones straight ahead). */
function nearest(from: HTMLElement, all: HTMLElement[], dir: Dir): HTMLElement | null {
  const a = from.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  let best: { el: HTMLElement; score: number } | null = null;
  for (const el of all) {
    if (el === from) continue;
    const b = el.getBoundingClientRect();
    const bx = b.left + b.width / 2;
    const by = b.top + b.height / 2;
    const dx = bx - ax;
    const dy = by - ay;
    const ahead = dir === 'up' ? -dy : dir === 'down' ? dy : dir === 'left' ? -dx : dx;
    const side = dir === 'up' || dir === 'down' ? Math.abs(dx) : Math.abs(dy);
    if (ahead <= 2) continue;
    const score = ahead + side * 2.2;
    if (!best || score < best.score) best = { el, score };
  }
  return best?.el ?? null;
}

/**
 * Lets a gamepad drive the menus: the D-pad or left stick moves a highlight
 * between buttons, A presses, LB/RB switch tabs. (B and Start already close
 * menus in the game.) Only runs while a panel is open.
 */
export function GamepadMenuNav({ open }: { open: boolean }) {
  useEffect(() => {
    if (!open || typeof navigator === 'undefined' || !navigator.getGamepads) return;
    let raf = 0;
    const held: Record<string, number> = {};
    const root = () => (document.querySelector('.panel') as HTMLElement | null) ?? null;
    const items = () => {
      const r = root();
      return r ? [...r.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(visible) : [];
    };
    const focus = (el: HTMLElement | null) => {
      if (!el) return;
      document.querySelectorAll('.gp-focus').forEach((n) => n.classList.remove('gp-focus'));
      el.classList.add('gp-focus');
      el.focus({ preventScroll: false });
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    };
    const current = (): HTMLElement | null => {
      const el = document.activeElement as HTMLElement | null;
      const r = root();
      return el && r?.contains(el) ? el : null;
    };
    const move = (dir: Dir) => {
      const all = items();
      if (!all.length) return;
      const from = current();
      if (!from) return focus(all.find((el) => !el.classList.contains('panel-close')) ?? all[0]);
      focus(nearest(from, all, dir));
    };
    const tab = (step: number) => {
      const r = root();
      const tabs = r ? [...r.querySelectorAll<HTMLElement>('[role="tab"]')] : [];
      if (!tabs.length) return;
      const i = Math.max(0, tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true'));
      const next = tabs[(i + step + tabs.length) % tabs.length];
      next.click();
      focus(next);
    };
    /** True on the first press, then repeating while held. */
    const pressed = (id: string, down: boolean, now: number) => {
      if (!down) {
        delete held[id];
        return false;
      }
      const t = held[id];
      if (t === undefined) {
        held[id] = now + 380;
        return true;
      }
      if (now >= t) {
        held[id] = now + 120;
        return true;
      }
      return false;
    };
    const loop = (now: number) => {
      const pad = [...navigator.getGamepads()].find((p) => p?.connected);
      if (pad) {
        const b = (i: number) => !!pad.buttons[i]?.pressed;
        const ax = pad.axes[0] ?? 0;
        const ay = pad.axes[1] ?? 0;
        if (pressed('up', b(12) || ay < -0.6, now)) move('up');
        if (pressed('down', b(13) || ay > 0.6, now)) move('down');
        if (pressed('left', b(14) || ax < -0.6, now)) move('left');
        if (pressed('right', b(15) || ax > 0.6, now)) move('right');
        const firstPress = (id: string, down: boolean) => {
          const was = held[id] !== undefined;
          if (down) held[id] = 1;
          else delete held[id];
          return down && !was;
        };
        if (firstPress('lb', b(4))) tab(-1);
        if (firstPress('rb', b(5))) tab(1);
        if (firstPress('a', b(0))) current()?.click();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      document.querySelectorAll('.gp-focus').forEach((n) => n.classList.remove('gp-focus'));
    };
  }, [open]);
  return null;
}
