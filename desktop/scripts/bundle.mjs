#!/usr/bin/env node
// Copies the site into the desktop app before electron-builder packs it (npm run bundle; run by npm start/dist/dir):
//   desktop/.site/           the tracked site files the app carries (desktop/lib/bundle-list.js decides which)
//   desktop/build/icon.png   the app icon (assets/icons/icon-512.png; electron-builder makes .ico and .icns from it)
//   desktop/app-brand.json   the name, id and website the running app reads (desktop/lib/brand.js loadBrand)
// All three are build output (.gitignore). The file list is git ls-files, so a local file that is not committed never
// ends up in an installer.
//   node desktop/scripts/bundle.mjs [--profile=<id>] [--list]   --list prints the paths and the total size, copies nothing
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync, statSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { bundleFiles, langDirsOf } = require('../lib/bundle-list.js');
const { loadBrand } = require('../lib/brand.js');

const DESKTOP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(DESKTOP, '..');

/** The site's languages (shared/i18n/i18n.js SlopI18n.LANGS) and its root one (the profile marker in tools/seo/lang.mjs). */
export function languages(root = ROOT) {
  const ctx = { document: undefined };
  ctx.window = ctx;
  vm.runInNewContext(readFileSync(path.join(root, 'shared/i18n/i18n.js'), 'utf8'), ctx);
  const m = /\/\*profile:defaultLang\*\/'([^']+)'/.exec(readFileSync(path.join(root, 'tools/seo/lang.mjs'), 'utf8'));
  return { langs: JSON.parse(JSON.stringify(ctx.SlopI18n.LANGS)), rootLang: m ? m[1] : 'en' };
}

/** The repo paths the app carries, from git ls-files (only files that exist in the working tree). */
export function plan(root = ROOT) {
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 }).split('\0').filter(Boolean);
  const { langs, rootLang } = languages(root);
  return bundleFiles(files, langDirsOf(langs, rootLang)).filter((f) => existsSync(path.join(root, f)));
}

function main(argv) {
  const prof = (argv.find((a) => a.startsWith('--profile=')) || '').slice(10) || undefined;
  const files = plan();
  const bytes = files.reduce((n, f) => n + statSync(path.join(ROOT, f)).size, 0);
  if (argv.includes('--list')) {
    for (const f of files) console.log(f);
    console.log(`${files.length} files, ${(bytes / 1048576).toFixed(1)} MB`);
    return 0;
  }
  const site = path.join(DESKTOP, '.site');
  rmSync(site, { recursive: true, force: true });
  for (const f of files) {
    const to = path.join(site, f);
    mkdirSync(path.dirname(to), { recursive: true });
    copyFileSync(path.join(ROOT, f), to);
  }
  const brand = loadBrand(ROOT, prof);
  mkdirSync(path.join(DESKTOP, 'build'), { recursive: true });
  copyFileSync(path.join(ROOT, brand.icon), path.join(DESKTOP, 'build', 'icon.png'));
  writeFileSync(path.join(DESKTOP, 'app-brand.json'), JSON.stringify({ id: brand.id, name: brand.name, origin: brand.origin }, null, 2) + '\n');
  console.log(`bundle: ${files.length} files, ${(bytes / 1048576).toFixed(1)} MB into desktop/.site/ for ${brand.name}`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
