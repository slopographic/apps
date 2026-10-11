#!/usr/bin/env node
// One-off build step: renders favicon.svg onto a canvas (headless Chromium via Playwright,
// the same browser the test runner uses) and writes the PNG icons the PWA manifest lists.
//   node tools/pwa-icons.mjs
// Output is committed: assets/icons/icon-192.png and icon-512.png.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets', 'icons');
const SIZES = [192, 512];

async function loadPlaywright() {
  try { return await import('playwright'); } catch (e) { /* fall through */ }
  for (const p of ['/opt/node22/lib/node_modules/playwright', path.join(process.env.npm_config_prefix || '', 'lib/node_modules/playwright')]) {
    try { return createRequire(import.meta.url)(p); } catch (e) { /* try next */ }
  }
  throw new Error('Playwright not found. Run: npm i -D playwright && npx playwright install chromium');
}

const svg = await readFile(path.join(ROOT, 'favicon.svg'), 'utf8');
const dataUrl = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<!doctype html><body style="margin:0"></body>');
await mkdir(OUT, { recursive: true });
for (const size of SIZES) {
  const png = await page.evaluate(async ({ dataUrl, size }) => {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, size, size);
    return c.toDataURL('image/png');
  }, { dataUrl, size });
  const file = path.join(OUT, `icon-${size}.png`);
  await writeFile(file, Buffer.from(png.split(',')[1], 'base64'));
  console.log('wrote', path.relative(ROOT, file));
}
await browser.close();
