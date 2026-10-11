// Loads the classic browser scripts of shared/motion into a vm context (no DOM, no rAF).
// Helper for the motion*.test.mjs files. Not a test file itself.
import vm from 'node:vm';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const MOTION = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'shared', 'motion');
export const FILES = ['easing.js', 'track.js', 'timeline.js', 'transitions.js', 'playback.js', 'presets.js'];

/** Returns window.SlopMotion from a fresh context with every motion file loaded in order. */
export async function load() {
  const ctx = {};
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of FILES) vm.runInContext(await readFile(path.join(MOTION, f), 'utf8'), ctx, { filename: f });
  return ctx.SlopMotion;
}

/** Plain copy of a value, so objects made inside the vm context compare equal to host objects. */
export const plain = (v) => JSON.parse(JSON.stringify(v));
