'use client';

import { useRef, useState } from 'react';
import { virtualPad, type PadButton } from '@/game-engine/input/virtualPad';
import { useCoarsePointer, useSettings } from '@/hooks/useSettings';

const RADIUS = 48;

/** On-screen joystick and buttons for phones and tablets. */
export function TouchControls() {
  const { touch } = useSettings();
  const coarse = useCoarsePointer();
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [run, setRun] = useState(false);
  const pointer = useRef<number | null>(null);
  if (touch === 'off' || (touch === 'auto' && !coarse)) return null;

  const moveTo = (clientX: number, clientY: number) => {
    const rect = base.current?.getBoundingClientRect();
    if (!rect) return;
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS;
      dy = (dy / len) * RADIUS;
    }
    setKnob({ x: dx, y: dy });
    const strength = Math.min(1, len / RADIUS);
    if (strength < 0.25) virtualPad.setMove(0, 0, run);
    // Pushing the stick all the way runs.
    else virtualPad.setMove(dx / RADIUS, dy / RADIUS, run || strength > 0.95);
  };
  const release = () => {
    pointer.current = null;
    setKnob({ x: 0, y: 0 });
    virtualPad.setMove(0, 0, false);
  };
  const btn = (button: PadButton, label: string, className = '') => (
    <button
      type="button"
      className={`touch-btn ${className}`}
      onPointerDown={(e) => {
        e.preventDefault();
        virtualPad.press(button);
        if (button === 'use') virtualPad.useHeld = true;
      }}
      onPointerUp={() => {
        if (button === 'use') virtualPad.useHeld = false;
      }}
      onPointerCancel={() => {
        if (button === 'use') virtualPad.useHeld = false;
      }}
      onPointerLeave={() => {
        if (button === 'use') virtualPad.useHeld = false;
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="touch-controls">
      <div
        ref={base}
        className="touch-stick"
        onPointerDown={(e) => {
          pointer.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          moveTo(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (pointer.current === e.pointerId) moveTo(e.clientX, e.clientY);
        }}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <span className="touch-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
      <div className="touch-buttons">
        {btn('use', 'Use', 'touch-main')}
        {btn('interact', 'Act', 'touch-act')}
        {btn('eat', 'Eat')}
        {btn('inventory', 'Bag')}
        {btn('map', 'Map')}
        {btn('close', '☰')}
        <button
          type="button"
          className={`touch-btn${run ? ' on' : ''}`}
          onPointerDown={(e) => {
            e.preventDefault();
            setRun(!run);
            virtualPad.setMove(virtualPad.x, virtualPad.y, !run);
          }}
        >
          Run
        </button>
      </div>
    </div>
  );
}
