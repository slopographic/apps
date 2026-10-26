#!/usr/bin/env node
// Writes the static SEO pages in every published language: the head block of every app page, about page and the
// homepage, the generated pages (landing, task, guide, round-up and hub pages), the copies of the hand-made pages in each
// other language's folder, the sitemaps, and the English table parts written from other sources (tables.mjs).
//   node tools/seo/write.mjs            write the files
//   node tools/seo/write.mjs --check    exit 1 and name the files that are out of date, write nothing
//   node tools/seo/write.mjs --date=2026-10-11   lastmod date (default: today)
// The root language (the brand profile's defaultLang) is at the site root, every other published language in its own
// folder (/sv/...): lang.mjs. The copy is in the SEO tables (shared/seo/i18n), the facts in shared/seo, the app list in
// shared/apps.js. Each page gets one block between <!-- seo:start --> and <!-- seo:end -->, placed after its charset tag.
// A language folder holds only what this tool writes: a file there that it does not write is removed (and a folder of
// a language no longer published). Read shared/seo/HANDOFF.md first.
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, SITE, loadRegistry, isPage, pageUrl } from './site.mjs';
import { published, unpublished, prefixOf, LANGS, ROOT_LANG } from './lang.mjs';
import { buildLang, pagePaths } from './build-lang.mjs';
import { converterFiles } from './footnav.mjs';
import { sitemaps } from './sitemap.mjs';
import { generatedParts } from './tables.mjs';
import { context } from './lang.mjs';
import { landingPages } from './landing.mjs';
import { taskPages, hubPage } from './tasks.mjs';
import { roundupPages, roundupIndex } from './roundups.mjs';
import { guidePages } from './guides.mjs';

export { ROOT, SITE, loadRegistry, isPage, pageUrl };
export { headBlock, injectHead, validateCopy, imageFor, TRIAL_TOKENS } from './head.mjs';
export { appJsonLd, homeJsonLd } from './build-lang.mjs';
export { siteChrome } from './chrome.mjs';

/** Every file under a folder, relative to the repo. */
const walk = (dir) => readdirSync(path.join(ROOT, dir)).flatMap((f) => (statSync(path.join(ROOT, dir, f)).isDirectory() ? walk(`${dir}${f}/`) : [`${dir}${f}`]));

/** The directories of the generated pages (the same in every language: a language is published only when complete). */
async function generatedDirs(apps) {
  const { landingIn } = await import('../../shared/seo/copy.mjs');
  const { TASKS } = await import('../../shared/seo/tasks/index.mjs');
  const { ROUNDUPS } = await import('../../shared/seo/roundups/index.mjs');
  const { GUIDES } = await import('../../shared/seo/guides/index.mjs');
  const L = context(ROOT_LANG);
  return [...landingPages(apps, SITE, landingIn(ROOT_LANG), [], [], [], L), ...taskPages(apps, SITE, TASKS, {}, L), hubPage(apps, SITE, TASKS, L),
    ...roundupPages(apps, SITE, ROUNDUPS, { TASKS, GUIDES }, L), roundupIndex(SITE, ROUNDUPS, L), ...guidePages(apps, SITE, GUIDES, { TASKS, ROUNDUPS }, L)].map((p) => p.dir);
}

/** Builds every page's new content: [{ file, html, before }] (html null: the file goes). */
export async function build({ date }) {
  const apps = await loadRegistry(), codes = published();
  const out = generatedParts().map((p) => ({ file: path.join(ROOT, p.file), html: p.text }));
  for (const f of out) f.before = existsSync(f.file) ? await readFile(f.file, 'utf8') : '';
  const paths = pagePaths(apps, await generatedDirs(apps));
  const byLang = new Map();
  for (const code of codes) {
    const r = await buildLang(code, codes, { apps, date, paths });
    out.push(...r.files);
    byLang.set(code, r.urls);
  }
  // a language folder holds only what is written here
  const written = new Set(out.map((f) => f.file));
  for (const l of LANGS) {
    const dir = l.code.toLowerCase();   // the root language too: its pages are at the root, not in a folder
    if (!dir || !existsSync(path.join(ROOT, dir))) continue;
    for (const f of walk(dir + '/')) if (!written.has(path.join(ROOT, f))) out.push({ file: path.join(ROOT, f), html: null, before: await readFile(path.join(ROOT, f), 'utf8') });
  }
  out.push(...await sitemaps(byLang, date, codes));
  return out;
}

async function main() {
  const check = process.argv.includes('--check');
  const dateArg = process.argv.find((a) => a.startsWith('--date='));
  const date = dateArg ? dateArg.slice(7) : new Date().toISOString().slice(0, 10);
  const files = await build({ date });
  const stale = files.filter((f) => f.before !== f.html && !(f.html === null && f.before === undefined)).map((f) => path.relative(ROOT, f.file));
  const langs = published().map((c) => `${c}${c === ROOT_LANG ? ' (root)' : ` (${prefixOf(c)}/)`}`).join(', ');
  const left = unpublished().map((u) => `${u.code}: ${u.why}`).join('; ');
  if (check) {
    if (stale.length) { console.error('SEO out of date (run node tools/seo/write.mjs):\n  ' + stale.slice(0, 50).join('\n  ') + (stale.length > 50 ? `\n  ... and ${stale.length - 50} more` : '')); process.exit(1); }
    console.log(`SEO up to date: ${files.length} files; languages ${langs}${left ? `; not published: ${left}` : ''}`);
    return;
  }
  for (const f of files) {
    if (f.before === f.html) continue;
    if (f.html === null) { await rm(f.file, { force: true }); continue; }
    await mkdir(path.dirname(f.file), { recursive: true });
    await writeFile(f.file, f.html);
  }
  console.log(`SEO written: ${stale.length} changed of ${files.length} files (lastmod ${date}); languages ${langs}${left ? `; not published: ${left}` : ''}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
}
