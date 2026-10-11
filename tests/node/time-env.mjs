// Loads the classic pure scripts of time/js into a vm context, in order. Helper for time-zones.test.mjs.
// Not a test file itself.
import vm from 'node:vm';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const JS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'time', 'js');
export const TIME_FILES = ['zones.js', 'work.js', 'convert.js', 'sync.js', 'timers.js'];

/** Returns window.SlopTime from a fresh context. */
export async function loadTime() {
  const ctx = {};
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of TIME_FILES) vm.runInContext(await readFile(path.join(JS, f), 'utf8'), ctx, { filename: f });
  return ctx.SlopTime;
}
