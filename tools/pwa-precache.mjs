#!/usr/bin/env node
// Rebuilds the PRECACHE list in sw-precache.js from the boot files of every app page.
// service-worker.js loads that file with importScripts('/sw-precache.js'); this tool checks the import is there.
//   node tools/pwa-precache.mjs            rewrite the PRECACHE list in sw-precache.js
//   node tools/pwa-precache.mjs --dry-run  print the count only, write nothing
// Walks each page's static <script src>, stylesheet <link href>, ES module imports (not dynamic
// import()) and CSS url()/@import, so the list follows what a page needs to boot offline.
// shell/shell.js loads its parts at run time (brand, registry, SlopUI, shell/*.js, CSS), so its
// quoted .js/.css paths are followed too.
// Entries that do not exist on disk are reported and left out. Bump VERSION in service-worker.js
// after running this; the browser only updates the worker when its bytes change (sw-precache.js is
// imported, so its bytes count too, but the worker's own cache name only changes with VERSION).
import { readFile, writeFile, stat, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SW = path.join(ROOT, 'service-worker.js');
const SW_IMPORT = "importScripts('/sw-precache.js');";
const exists = (p) => stat(path.join(ROOT, p)).then((s) => s, () => null);
const resolveRef = (from, ref) => path.posix.normalize(path.posix.join(path.posix.dirname(from), ref));
const EXTRA = ['offline.html', 'manifest.webmanifest', 'favicon.svg', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'shared/pwa.js',
  'shell/shell.js', 'brand/brand.js', 'brand/brand.json', 'brand/logo.svg'];
const DRY = process.argv.includes('--dry-run');

// shell/shell.js loads its parts with addScript()/addCss(), so static refs miss them. Its paths are
// relative to the site root. Follow every quoted .js/.css path, and expand 'shell/' + m + '.js' over its loop list.
function shellLoads(txt) {
  const out = [];
  for (const m of txt.matchAll(/'([^'\s]+\.(?:m?js|css))'/g)) out.push(m[1]);
  for (const [, v, list] of txt.matchAll(/for \(const (\w+) of \[([^\]]*)\]\)/g)) {
    const names = [...list.matchAll(/'([^']+)'/g)].map((x) => x[1]);
    for (const t of txt.matchAll(new RegExp(`'([^']*)'\\s*\\+\\s*${v}\\s*\\+\\s*'([^']*)'`, 'g'))) for (const n of names) out.push(t[1] + n + t[2]);
  }
  return out;
}

async function pageRoots() {
  const apps = await readFile(path.join(ROOT, 'shared/apps.js'), 'utf8');
  const roots = ['index.html', 'drive/index.html'];
  for (const m of apps.matchAll(/A\('([^']+)', 'app', '[^']*', '([^']+)'/g)) roots.push(m[2] + 'index.html');
  return [...new Set(roots)];
}

function refsOf(p, txt) {
  if (p === 'shell/shell.js') return shellLoads(txt);
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

// The offline font library and font packs: the picker and the font catalogue load these at run time (not by a static src),
// so they are listed here. Every WOFF2 named in shared/fonts/library/index.json is included, and each embeddable copy ("pdf").
const LIBRARY = ['shared/fonts/picker.js', 'shared/fonts/catalog.js', 'shared/fonts/missing.js', 'shared/fonts/panel.js', 'shared/fonts/library/index.json',
  'shared/library/manifest.js', 'shared/library/store.js', 'shared/library/get-more.js', 'shared/library/packs.json',
  'vendor/fontkit/fontkit.min.js', 'vendor/fontkit/LICENSE'];
const libraryFiles = JSON.parse(await readFile(path.join(ROOT, 'shared/fonts/library/index.json'), 'utf8')).fonts
  .flatMap((f) => [`shared/fonts/library/${f.file}`, `shared/fonts/library/${f.licenceFile}`, ...(f.pdf ? [`shared/fonts/library/${f.pdf}`] : [])]);
const roots = [...(await pageRoots()), ...EXTRA, ...LIBRARY, ...new Set(libraryFiles)];
for (const r of roots) await visit(r);
const list = [...files].sort();
for (const m of missing) console.warn('not on disk, left out:', m);

// Pack about four entries per line, and cut the list into parts of at most PART_LINES lines, so every file stays under 300
// lines. Part 1 is sw-precache.js (it declares PRECACHE); parts 2.. are sw-precache-N.js and push onto it.
const PART_LINES = 200;
const lines = [];
let line = '  ';
for (const f of list) {
  const item = `'/${f}', `;
  if (line.length + item.length > 160) { lines.push(line.trimEnd()); line = '  '; }
  line += item;
}
if (line.trim()) lines.push(line.trimEnd());
const parts = [];
for (let i = 0; i < lines.length; i += PART_LINES) parts.push(lines.slice(i, i + PART_LINES));
const partFile = (n) => (n === 1 ? 'sw-precache.js' : `sw-precache-${n}.js`);
const partSrc = (n, body) => (n === 1
  ? `// Precache list for service-worker.js. Loaded there with importScripts(); the classic worker shares this scope.\n// Generated by: node tools/pwa-precache.mjs (do not edit by hand). Parts: ${parts.length}.\n// BEGIN PRECACHE\nconst PRECACHE = [];\nPRECACHE.push(\n${body}\n);\n// END PRECACHE\n`
  : `// Precache list, part ${n} of ${parts.length}. Generated by: node tools/pwa-precache.mjs (do not edit by hand).\n// BEGIN PRECACHE\nPRECACHE.push(\n${body}\n);\n// END PRECACHE\n`);

const swSrc = await readFile(SW, 'utf8');
if (!/importScripts\([^)]*sw-precache/.test(swSrc)) throw new Error('service-worker.js must load the list with importScripts(\'/sw-precache.js\')');
const importLine = `importScripts(${parts.map((_, i) => `'/${partFile(i + 1)}'`).join(', ')});`;
const nextSw = swSrc.replace(/importScripts\([^)]*sw-precache[^)]*\);/, importLine);
if (!DRY) await writeFile(SW, nextSw);
for (let i = 0; i < parts.length; i++) {
  const f = path.join(ROOT, partFile(i + 1));
  if (!DRY) await writeFile(f, partSrc(i + 1, parts[i].join('\n')));
}
const written = parts.map((_, i) => partFile(i + 1));
if (!DRY) for (const f of ['sw-precache.js', 'sw-precache-2.js', 'sw-precache-3.js', 'sw-precache-4.js'].filter((x) => !written.includes(x))) await rm(path.join(ROOT, f), { force: true });
console.log(`PRECACHE: ${list.length} files, ${roots.length} roots, ${missing.size} missing${DRY ? ' (dry run, nothing written)' : ''}`);
