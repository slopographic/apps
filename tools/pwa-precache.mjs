#!/usr/bin/env node
// Rebuilds the PRECACHE list in service-worker.js from the boot files of every app page.
//   node tools/pwa-precache.mjs
// Walks each page's static <script src>, stylesheet <link href>, ES module imports (not dynamic
// import()) and CSS url()/@import, so the list follows what a page needs to boot offline.
// Entries that do not exist on disk are reported and left out. Bump VERSION in service-worker.js
// after running this; the browser only updates the worker when its bytes change.
import { readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SW = path.join(ROOT, 'service-worker.js');
const exists = (p) => stat(path.join(ROOT, p)).then((s) => s, () => null);
const resolveRef = (from, ref) => path.posix.normalize(path.posix.join(path.posix.dirname(from), ref));
const EXTRA = ['offline.html', 'manifest.webmanifest', 'favicon.svg', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'shared/pwa.js'];

async function pageRoots() {
  const apps = await readFile(path.join(ROOT, 'shared/apps.js'), 'utf8');
  const roots = ['index.html', 'drive/index.html'];
  for (const m of apps.matchAll(/A\('([^']+)', 'app', '[^']*', '([^']+)'/g)) roots.push(m[2] + 'index.html');
  return [...new Set(roots)];
}

function refsOf(p, txt) {
  const out = [];
  if (p.endsWith('.html')) {
    for (const m of txt.matchAll(/<(script|link)\b[^>]*?>/gi)) {
      const tag = m[0];
      const attr = tag.match(/\b(?:src|href)=["']([^"'#?]+)/i);
      if (!attr || /^(https?:|\/\/|data:)/.test(attr[1])) continue;
      if (/^<link/i.test(tag) && !/rel=["']?(stylesheet|modulepreload)/i.test(tag)) continue;
      out.push(attr[1].startsWith('/') ? attr[1].slice(1) : resolveRef(p, attr[1]));
    }
  } else if (/\.m?js$/.test(p)) {
    for (const m of txt.matchAll(/(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]/g)) {
      const s = m[1] || m[2];
      if (s.startsWith('.')) out.push(resolveRef(p, s));
    }
  } else if (p.endsWith('.css')) {
    for (const m of txt.matchAll(/@import\s+(?:url\()?\s*["']([^"']+)["']|url\(\s*["']?([^"')]+?)["']?\s*\)/g)) {
      const s = (m[1] || m[2] || '').split(/[#?]/)[0];
      if (!s || /^(data:|https?:|\/\/)/.test(s) || s.includes('%')) continue;
      out.push(resolveRef(p, s));
    }
  }
  return out;
}

const seen = new Set();
const missing = new Set();
const files = new Set();
async function visit(p) {
  if (seen.has(p)) return;
  seen.add(p);
  const st = await exists(p);
  if (!st) { missing.add(p); return; }
  if (st.isDirectory()) return;            // "./" and folder links are not files
  files.add(p);
  if (!/\.(html|m?js|css)$/.test(p)) return;
  for (const r of refsOf(p, await readFile(path.join(ROOT, p), 'utf8'))) await visit(r);
}

const roots = [...(await pageRoots()), ...EXTRA];
for (const r of roots) await visit(r);
const list = [...files].sort();
for (const m of missing) console.warn('not on disk, left out:', m);

// Pack about four entries per line so the list stays short enough to read.
const lines = [];
let line = '  ';
for (const f of list) {
  const item = `'/${f}', `;
  if (line.length + item.length > 160) { lines.push(line.trimEnd()); line = '  '; }
  line += item;
}
if (line.trim()) lines.push(line.trimEnd());

const src = await readFile(SW, 'utf8');
const block = `// BEGIN PRECACHE\nconst PRECACHE = [\n${lines.join('\n')}\n];\n// END PRECACHE`;
const next = src.replace(/\/\/ BEGIN PRECACHE[\s\S]*?\/\/ END PRECACHE/, block);
if (next === src && !src.includes(block)) throw new Error('PRECACHE markers not found in service-worker.js');
await writeFile(SW, next);
console.log(`PRECACHE: ${list.length} files, ${roots.length} roots, ${missing.size} missing`);
