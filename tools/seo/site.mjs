// Shared site facts for the SEO tools: the root folder, the site origin, the app registry reader and URL helpers.
// Used by tools/seo/write.mjs and tools/seo/landing.mjs. Node only.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SITE = 'https://slopographic.com';

/** The app registry, read the way the browser reads it (a classic script that sets window.SLOP_APPS). */
export async function loadRegistry() {
  const src = await readFile(path.join(ROOT, 'shared', 'apps.js'), 'utf8');
  const win = {};
  vm.runInNewContext(src, { window: win });
  return win.SLOP_APPS;
}
export const isPage = (app) => !!app.path && !app.path.startsWith('#');
export const pageUrl = (app) => `${SITE}/${app.path}`;
