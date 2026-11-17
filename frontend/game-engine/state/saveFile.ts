import { validateSave, type SaveData } from '@farming/shared';

/** Downloads a save as a .json file. */
export function downloadSave(save: SaveData): void {
  const blob = new Blob([JSON.stringify(save)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `farming-${save.seed.replace(/[^\w-]+/g, '_')}-day${save.time.day}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Reads and checks a save file picked by the player. */
export async function readSaveFile(file: File): Promise<{ ok: true; save: SaveData } | { ok: false; error: string }> {
  if (file.size > 5_000_000) return { ok: false, error: 'That file is too big to be a save.' };
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    return { ok: false, error: "That file isn't a save file (not JSON)." };
  }
  const checked = validateSave(raw);
  if (!checked.ok) return { ok: false, error: `That save can't be loaded: ${checked.error}` };
  return { ok: true, save: checked.data };
}
