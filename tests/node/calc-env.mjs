// Loads the classic pure scripts of calculator/js into a vm context, in order. Helper for calc-parser.test.mjs.
// Not a test file itself.
import vm from 'node:vm';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const JS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'calculator', 'js');
export const CALC_FILES = ['lexer.js', 'units.js', 'dates.js', 'parser.js', 'evaluate.js', 'format.js', 'calc.js'];

/** Returns window.SlopCalc from a fresh context. */
export async function loadCalc() {
  const ctx = {};
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of CALC_FILES) vm.runInContext(await readFile(path.join(JS, f), 'utf8'), ctx, { filename: f });
  return ctx.SlopCalc;
}
