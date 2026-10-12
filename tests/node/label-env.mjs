// Helpers for the SlopLabel model tests: the real label scripts (units, stock library, document model, configs, presets,
// config store, tab state) in one vm context, with an in-memory storage. Not a test file itself.
import vm from 'node:vm';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const LABEL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'label', 'js');
export const MODEL_FILES = ['core/units.js', 'core/stocks.js', 'core/model.js', 'core/configs.js', 'core/presets.js', 'io/configs-store.js', 'io/tabstate.js'];

/** Loads the files (relative to label/js) into one context. `storage` (optional) stands in for localStorage. */
export async function labelEnv(files = MODEL_FILES, { storage = null } = {}) {
  const ctx = { console, Map, Set, Date, Math, JSON, Object, Array, Number, String, Error, Promise, TextEncoder };
  ctx.window = ctx;
  if (storage) ctx.localStorage = storage;
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(await readFile(path.join(LABEL, f), 'utf8'), ctx, { filename: f });
  /** Reads a top-level name (a function, const or class) of the loaded scripts. */
  ctx.get = (name) => vm.runInContext(name, ctx);
  return ctx;
}

/** A plain copy, so values made inside the vm context compare equal with host objects. */
export const plain = (v) => JSON.parse(JSON.stringify(v));

/** An in-memory localStorage stand-in. */
export function memStorage(throwOnSet = false) {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (throwOnSet) throw new Error('QuotaExceededError'); m.set(k, String(v)); },
    removeItem: (k) => m.delete(k),
    raw: m,
  };
}
