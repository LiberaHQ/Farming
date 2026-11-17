'use client';

import { useEffect, useState } from 'react';
import { useGameEvent } from '@/hooks/useGameEvent';
import { BUFF_INFO, ITEMS, RECIPE_CATEGORIES, RECIPES, whereToGet, type ItemId, type RecipeCategory } from '@farming/shared';
import { gameCommands, type GameEventMap } from '@/game-engine/events/GameEventBus';
import { ItemIcon } from '../ItemIcon';
import { Panel } from './Panel';

type InventoryView = GameEventMap['inventory:changed'];

function countOf(inventory: InventoryView, itemId: ItemId): number {
  return inventory.slots.reduce((sum, s) => (s?.itemId === itemId ? sum + s.quantity : sum), 0);
}

/**
 * Recipes. Things you can make right now come first; for the rest, each
 * missing ingredient says how many more you need and where to get it.
 * From the kitchen stove it opens as just the Kitchen (cooking only).
 */
export function CraftingPanel({ inventory }: { inventory: InventoryView }) {
  const want = useGameEvent('crafting:open');
  const kitchen = !!want?.kitchen;
  const [category, setCategory] = useState<RecipeCategory>(want?.category ?? 'tools');
  useEffect(() => {
    if (want?.category) setCategory(want.category);
  }, [want]);
  const cooking = category === 'cooking';
  const recipes = RECIPES.filter((r) => r.category === category).map((recipe) => ({
    recipe,
    ready: recipe.inputs.every((input) => countOf(inventory, input.itemId) >= input.quantity),
  }));
  const ready = recipes.filter((r) => r.ready);
  const missing = recipes.filter((r) => !r.ready);

  const row = ({ recipe, ready: canMake }: (typeof recipes)[number]) => {
    const out = ITEMS[recipe.output.itemId];
    const buff = out.buff ? BUFF_INFO[out.buff.kind] : null;
    return (
      <li key={recipe.id} className={`recipe${canMake ? ' recipe-ready' : ''}`}>
        <ItemIcon id={recipe.output.itemId} />
        <div className="recipe-info">
          <div className="recipe-title">
            <strong>{out.name}</strong>
            {recipe.output.quantity > 1 && <span className="hud-muted"> ×{recipe.output.quantity}</span>}
            {out.energy !== undefined && <span className="recipe-effect">+{out.energy} energy</span>}
            {buff && out.buff && (
              <span className="recipe-effect recipe-buff" title={buff.description}>
                {buff.icon} {buff.name} {Math.round(out.buff.minutes / 60)}h
              </span>
            )}
          </div>
          <ul className="recipe-needs">
            {recipe.inputs.map((input) => {
              const have = countOf(inventory, input.itemId);
              const enough = have >= input.quantity;
              return (
                <li key={input.itemId} className={enough ? 'have' : 'lack'}>
                  <ItemIcon id={input.itemId} size={16} />
                  <span>
                    {input.quantity}× {ITEMS[input.itemId].name}
                  </span>
                  <span className="recipe-have">
                    {enough ? `✓ you have ${have}` : `you have ${have} — ${whereToGet(input.itemId)}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <button type="button" className={`btn${canMake ? ' btn-primary' : ''}`} disabled={!canMake} onClick={() => gameCommands.emit('craft', { recipeId: recipe.id })}>
          {cooking ? 'Cook' : 'Make'}
        </button>
      </li>
    );
  };

  return (
    <Panel
      title={kitchen ? '🍳 Kitchen' : 'Crafting'}
      footer={
        <span className="hud-muted">
          {cooking ? 'Cooked food restores more energy, and some dishes give a bonus for a few hours. ' : ''}
          Ingredients come from your backpack.
        </span>
      }
    >
      {!kitchen && (
        <nav className="tabs" role="tablist">
          {RECIPE_CATEGORIES.map((c) => (
            <button key={c.id} type="button" role="tab" aria-selected={category === c.id} className={`tab${category === c.id ? ' active' : ''}`} onClick={() => setCategory(c.id)}>
              {c.label}
            </button>
          ))}
        </nav>
      )}
      <h3 className="panel-subtitle">{ready.length ? `Ready to ${cooking ? 'cook' : 'make'} (${ready.length})` : `Nothing ready to ${cooking ? 'cook' : 'make'} yet`}</h3>
      {ready.length > 0 ? <ul className="recipe-list">{ready.map(row)}</ul> : <p className="hud-muted recipe-empty">Gather the ingredients below — each one says where to find it.</p>}
      {missing.length > 0 && (
        <>
          <h3 className="panel-subtitle">Need more ingredients ({missing.length})</h3>
          <ul className="recipe-list recipe-list-missing">{missing.map(row)}</ul>
        </>
      )}
    </Panel>
  );
}
