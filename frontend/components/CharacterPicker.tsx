'use client';

import { useMemo } from 'react';
import { APPEARANCE_OPTIONS, APPEARANCE_PARTS, resolveAppearance, type AppearanceChoice, type AppearancePart } from '@farming/shared';
import { drawCharacterSheet } from '@/game-engine/assets/character';

const LABELS: Record<AppearancePart, string> = { skin: 'Skin', hair: 'Hair', shirt: 'Shirt', pants: 'Trousers' };

/** Main swatch colour for each option. */
const swatch = (part: AppearancePart, i: number): string => {
  const o = APPEARANCE_OPTIONS[part][i] as Record<string, string>;
  return o[part];
};

/** Front-facing preview, drawn with the same generator the game uses. */
export function CharacterPreview({ choice, scale = 6 }: { choice: AppearanceChoice; scale?: number }) {
  const src = useMemo(() => {
    const sheet = drawCharacterSheet(resolveAppearance(choice)).toCanvas();
    const frame = document.createElement('canvas');
    frame.width = 16;
    frame.height = 24;
    frame.getContext('2d')?.drawImage(sheet, 0, 0, 16, 24, 0, 0, 16, 24);
    return frame.toDataURL();
  }, [choice]);
  return <img className="character-preview" src={src} width={16 * scale} height={24 * scale} alt="Character preview" />;
}

/** Preview plus a swatch row per body part. */
export function CharacterPicker({ choice, onPick }: { choice: AppearanceChoice; onPick: (part: AppearancePart, index: number) => void }) {
  return (
    <div className="character">
      <CharacterPreview choice={choice} />
      <div className="character-options">
        {APPEARANCE_PARTS.map((part) => (
          <div key={part} className="character-row">
            <span className="character-label">{LABELS[part]}</span>
            <div className="swatches">
              {APPEARANCE_OPTIONS[part].map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`swatch${choice[part] === i ? ' swatch-active' : ''}`}
                  style={{ background: swatch(part, i) }}
                  aria-label={`${LABELS[part]} option ${i + 1}`}
                  aria-pressed={choice[part] === i}
                  onClick={() => onPick(part, i)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
