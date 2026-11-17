'use client';

import { useMemo, useState } from 'react';
import { APPEARANCE_OPTIONS, APPEARANCE_PARTS, APPEARANCE_STYLE_PARTS, normalizeAppearance, resolveAppearance, type AppearanceChoice, type AppearancePart } from '@farming/shared';
import { DIRECTION_ROWS } from '@/game-engine/assets/character';
import { drawPlayerSheet, PLAYER_FRAME } from '@/game-engine/assets/playerCharacter';

const LABELS: Record<AppearancePart, string> = {
  skin: 'Skin',
  eyes: 'Eyes',
  hairStyle: 'Hair style',
  hair: 'Hair colour',
  hat: 'Hat',
  outfit: 'Outfit',
  shirt: 'Top',
  pants: 'Bottoms',
  shoes: 'Shoes',
};

/** Names for the parts picked by style. */
const STYLE_NAMES: Partial<Record<AppearancePart, string[]>> = {
  hairStyle: ['Short', 'Long', 'Ponytail', 'Bun', 'Curly', 'Spiky', 'Bob'],
  hat: ['None', 'Straw hat', 'Cap', 'Beanie', 'Bandana', 'Flower'],
  outfit: ['Shirt', 'T-shirt', 'Overalls', 'Dress'],
};

/** The options grouped the way people think about them. */
const GROUPS: Array<{ title: string; parts: AppearancePart[] }> = [
  { title: 'Face', parts: ['skin', 'eyes'] },
  { title: 'Hair', parts: ['hairStyle', 'hair', 'hat'] },
  { title: 'Clothes', parts: ['outfit', 'shirt', 'pants', 'shoes'] },
];

const FACINGS = ['down', 'left', 'up', 'right'] as const;
type Facing = (typeof FACINGS)[number];

/** Main swatch colour for a colour option. */
const swatch = (part: AppearancePart, i: number): string => (APPEARANCE_OPTIONS[part][i] as unknown as Record<string, string>)[part];

/** A preview of the player, drawn with the same generator the game uses. */
export function CharacterPreview({ choice, scale = 5, facing = 'down' }: { choice: Partial<AppearanceChoice>; scale?: number; facing?: Facing }) {
  const { width: FW, height: FH } = PLAYER_FRAME;
  const src = useMemo(() => {
    const sheet = drawPlayerSheet(resolveAppearance(choice)).toCanvas();
    const frame = document.createElement('canvas');
    frame.width = FW;
    frame.height = FH;
    frame.getContext('2d')?.drawImage(sheet, 0, DIRECTION_ROWS[facing] * FH, FW, FH, 0, 0, FW, FH);
    return frame.toDataURL();
  }, [choice, facing, FW, FH]);
  return <img className="character-preview" src={src} width={FW * scale} height={FH * scale} alt="Character preview" />;
}

/**
 * The character editor: a turnable preview, then each part as colour swatches
 * or named chips, grouped into face, hair and clothes, with a randomise button.
 * `onSet` (if given) receives a whole new look at once (randomising).
 */
export function CharacterPicker({
  choice,
  onPick,
  onSet,
}: {
  choice: Partial<AppearanceChoice>;
  onPick: (part: AppearancePart, index: number) => void;
  onSet?: (choice: AppearanceChoice) => void;
}) {
  const look = normalizeAppearance(choice);
  const [facing, setFacing] = useState(0);
  const turn = (d: number) => setFacing((f) => (f + d + FACINGS.length) % FACINGS.length);
  const randomize = () => {
    const next = Object.fromEntries(APPEARANCE_PARTS.map((p) => [p, Math.floor(Math.random() * APPEARANCE_OPTIONS[p].length)])) as AppearanceChoice;
    if (onSet) onSet(next);
    else for (const p of APPEARANCE_PARTS) onPick(p, next[p]);
  };
  return (
    <div className="character">
      <div className="character-stage">
        <CharacterPreview choice={look} facing={FACINGS[facing]} />
        <div className="character-turn">
          <button type="button" className="btn" onClick={() => turn(-1)} aria-label="Turn left">
            ◀
          </button>
          <button type="button" className="btn" onClick={randomize}>
            🎲 Randomise
          </button>
          <button type="button" className="btn" onClick={() => turn(1)} aria-label="Turn right">
            ▶
          </button>
        </div>
      </div>
      <div className="character-options">
        {GROUPS.map((g) => (
          <fieldset key={g.title} className="character-group">
            <legend>{g.title}</legend>
            {g.parts.map((part) => (
              <div key={part} className="character-row">
                <span className="character-label">{LABELS[part]}</span>
                <div className="swatches">
                  {APPEARANCE_OPTIONS[part].map((_, i) =>
                    APPEARANCE_STYLE_PARTS.includes(part) ? (
                      <button
                        key={i}
                        type="button"
                        className={`chip${look[part] === i ? ' chip-active' : ''}`}
                        aria-pressed={look[part] === i}
                        onClick={() => onPick(part, i)}
                      >
                        {STYLE_NAMES[part]?.[i] ?? `Style ${i + 1}`}
                      </button>
                    ) : (
                      <button
                        key={i}
                        type="button"
                        className={`swatch${look[part] === i ? ' swatch-active' : ''}`}
                        style={{ background: swatch(part, i) }}
                        aria-label={`${LABELS[part]} option ${i + 1}`}
                        aria-pressed={look[part] === i}
                        onClick={() => onPick(part, i)}
                      />
                    ),
                  )}
                </div>
              </div>
            ))}
          </fieldset>
        ))}
      </div>
    </div>
  );
}
