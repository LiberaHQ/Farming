'use client';

import { useState } from 'react';
import { ACHIEVEMENTS, ITEM_IDS, ITEMS, MAX_SKILL_LEVEL, SKILLS, WILDLIFE, WILDLIFE_IDS, skillPerks, type ItemCategory, type SkillId } from '@farming/shared';
import { useGameEvent } from '@/hooks/useGameEvent';
import { ItemIcon } from '../ItemIcon';
import { Panel } from './Panel';

const GROUPS: { label: string; categories: ItemCategory[] }[] = [
  { label: 'Crops & seeds', categories: ['crop', 'seed'] },
  { label: 'Fish', categories: ['fish'] },
  { label: 'Food', categories: ['food', 'consumable'] },
  { label: 'Resources', categories: ['resource'] },
  { label: 'Artifacts', categories: ['artifact'] },
  { label: 'Tools', categories: ['tool'] },
  { label: 'Buildings & animals', categories: ['placeable', 'animal'] },
  { label: 'Furniture', categories: ['furniture'] },
];

/** Every item you've found, and achievements with their progress. */
export function CollectionPanel() {
  const data = useGameEvent('collection:state');
  const [tab, setTab] = useState<'items' | 'skills' | 'wildlife' | 'achievements'>('items');
  if (!data) return null;
  const found = new Set(data.found);
  const seen = new Set(data.sightings ?? []);
  const earned = data.achievements.filter((a) => a.earned).length;
  return (
    <Panel
      title="Collection"
      footer={
        <span className="hud-muted">
          {found.size}/{ITEM_IDS.length} items found · {seen.size}/{WILDLIFE_IDS.length} creatures spotted · {earned}/{ACHIEVEMENTS.length} achievements
        </span>
      }
    >
      <nav className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'items'} className={`tab${tab === 'items' ? ' active' : ''}`} onClick={() => setTab('items')}>
          Items
        </button>
        <button type="button" role="tab" aria-selected={tab === 'skills'} className={`tab${tab === 'skills' ? ' active' : ''}`} onClick={() => setTab('skills')}>
          Skills
        </button>
        <button type="button" role="tab" aria-selected={tab === 'wildlife'} className={`tab${tab === 'wildlife' ? ' active' : ''}`} onClick={() => setTab('wildlife')}>
          Wildlife
        </button>
        <button type="button" role="tab" aria-selected={tab === 'achievements'} className={`tab${tab === 'achievements' ? ' active' : ''}`} onClick={() => setTab('achievements')}>
          Achievements
        </button>
      </nav>

      {tab === 'items' &&
        GROUPS.map((g) => {
          const ids = ITEM_IDS.filter((id) => g.categories.includes(ITEMS[id].category));
          if (ids.length === 0) return null;
          return (
            <section key={g.label} className="collection-group">
              <h3 className="panel-subtitle">
                {g.label} <span className="hud-muted">{ids.filter((id) => found.has(id)).length}/{ids.length}</span>
              </h3>
              <ul className="collection-grid">
                {ids.map((id) => (
                  <li key={id} className={found.has(id) ? 'found' : 'missing'} title={found.has(id) ? `${ITEMS[id].name} — ${ITEMS[id].description}` : 'Not found yet'}>
                    <ItemIcon id={id} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

      {tab === 'skills' && (
        <ul className="achievement-list">
          {(data.skills ?? []).map((sk) => {
            const def = SKILLS[sk.id as SkillId];
            const max = sk.level >= MAX_SKILL_LEVEL;
            return (
              <li key={sk.id} className={max ? 'earned' : ''}>
                <span className="achievement-icon" style={{ fontSize: 22 }} aria-hidden>
                  {def.emoji}
                </span>
                <div>
                  <strong>
                    {def.name} · level {sk.level}
                    {max ? ' (max)' : ''}
                  </strong>
                  <div className="hud-muted">{def.how}</div>
                  <div className="hud-muted">{sk.level > 0 ? skillPerks(def.id, sk.level).join(' · ') : `Each level gives ${def.id === 'fishing' ? '' : 'a better chance of '}${def.bonus}.`}</div>
                  {!max && (
                    <div className="community-bar" aria-label={`${sk.into} of ${sk.need} XP`}>
                      <span style={{ width: `${(sk.into / sk.need) * 100}%` }} />
                    </div>
                  )}
                </div>
                <span className="hud-muted">{max ? `${sk.xp} XP` : `${sk.into}/${sk.need}`}</span>
              </li>
            );
          })}
        </ul>
      )}

      {tab === 'wildlife' && (
        <ul className="achievement-list">
          {WILDLIFE_IDS.map((id) => {
            const w = WILDLIFE[id];
            const spotted = seen.has(id);
            return (
              <li key={id} className={spotted ? 'earned' : ''}>
                <span className="achievement-icon" style={{ fontSize: 22, filter: spotted ? 'none' : 'grayscale(1) brightness(0.4)' }} aria-hidden>
                  {w.emoji}
                </span>
                <div>
                  <strong>{spotted ? w.name : '???'}</strong>
                  <div className="hud-muted">{spotted ? w.description : `Hint: ${w.hint}`}</div>
                </div>
                <span className="hud-muted">{spotted ? 'Spotted' : ''}</span>
              </li>
            );
          })}
        </ul>
      )}

      {tab === 'achievements' && (
        <ul className="achievement-list">
          {ACHIEVEMENTS.map((a) => {
            const p = data.achievements.find((x) => x.id === a.id);
            const have = Math.min(p?.have ?? 0, p?.need ?? 1);
            const need = p?.need ?? 1;
            return (
              <li key={a.id} className={p?.earned ? 'earned' : ''}>
                <span className="achievement-icon">
                  <ItemIcon id={a.icon} />
                </span>
                <div>
                  <strong>
                    {p?.earned ? '🏆 ' : ''}
                    {a.name}
                  </strong>
                  <div className="hud-muted">{a.description}</div>
                  {!p?.earned && need > 1 && (
                    <div className="community-bar" aria-label={`${have} of ${need}`}>
                      <span style={{ width: `${(have / need) * 100}%` }} />
                    </div>
                  )}
                </div>
                <span className="hud-muted">{p?.earned ? 'Done' : need > 1 ? `${have.toLocaleString()}/${need.toLocaleString()}` : ''}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
