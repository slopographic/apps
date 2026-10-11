// Recipes for the creative apps: filmed in real time (video mode) while the recipe works in them.
import { wait, until, drag, curve, hide, strokeFrames, wave } from './util.mjs';
import { seedDrive } from './seed.mjs';

/** Box of the first visible element matching sel, or a fallback rectangle. */
async function boxOf(page, sel, fb = { x: 200, y: 150, width: 800, height: 500 }) {
  const b = await page.locator(sel).first().boundingBox().catch(() => null);
  return b && b.width > 20 ? b : fb;
}
const QUIET = ['.toast', '.toasts', '#toast', '.slop-toast', '.sui-toast', '.toast-wrap'];

export default {
  photoslop: {
    len: 5,
    async setup(page) {
      await until(page, () => document.body.classList.contains('ready'), null, 30000);
      await hide(page, QUIET);
      await wait(page, 800);
      await page.keyboard.press('b');
      for (let i = 0; i < 6; i++) await page.keyboard.press(']');
      const sw = page.locator('.swatch-grid .swatch:not(.add)');
      await sw.nth(17).click();
      await drag(page, curve(200, 420, 70, 90, 1.5, 14, 0.5, 0.6), { steps: 1 });
      await sw.nth(22).click();
      await drag(page, curve(860, 400, 60, 80, 1.5, 14, 2.5, 0.6), { steps: 1 });
      await sw.nth(12).click();
      await page.mouse.move(1270, 790);
    },
    frame: strokeFrames([{ at: 8, pts: wave(130, 930, 690, 22, 120, 2.5) }]),
  },
  vector: {
    len: 5,
    async setup(page) {
      await until(page, () => document.getElementById('app')?.classList.contains('ready') && window.SV, null, 30000);
      await hide(page, QUIET);
      await wait(page, 800);
      await page.keyboard.press('Escape');
    },
    frame: strokeFrames([
      { at: 6, pts: wave(250, 420, 230, 0, 30, 0).map(([x], i) => [x, 200 + i * 5]), before: (p) => p.keyboard.press('l') },
      { at: 50, pts: wave(860, 1000, 520, 0, 30, 0).map(([x], i) => [x, 500 + i * 4]), before: (p) => p.keyboard.press('Shift+S') },
      { at: 95, pts: Array.from({ length: 40 }, (_, i) => [300 + i * 6, 640 - Math.sin(i / 39 * Math.PI) * 120]), before: (p) => p.keyboard.press('b') },
    ]),
  },
  pdf: {
    mode: 'video', len: 5,
    async setup(page) {
      await until(page, () => window.SP && window.SP.app, null, 30000);
      await hide(page, QUIET);
      await page.evaluate(() => window.SP.app.loadSample());
      await wait(page, 3500);
    },
    async play(page, s) {
      const t = Date.now();
      const cards = page.locator('.organize .page, .grid .thumb, [data-page]');
      const n = await cards.count().catch(() => 0);
      for (let i = 0; i < Math.min(n, 4); i++) { const b = await cards.nth(i).boundingBox().catch(() => null); if (b) await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 }); await wait(page, 350); }
      await page.mouse.wheel(0, 400); await wait(page, 600); await page.mouse.wheel(0, -400);
      await wait(page, Math.max(0, s * 1000 - (Date.now() - t)));
    },
  },
  label: {
    mode: 'video', len: 5,
    async setup(page) { await wait(page, 2500); await hide(page, QUIET); },
    async play(page, s) {
      const c = await boxOf(page, '.label-page, .paper, #canvas, main canvas, main svg');
      const t = Date.now();
      const pts = [[0.2, 0.2], [0.5, 0.5], [0.3, 0.8], [0.8, 0.3]];
      for (const [fx, fy] of pts) { await page.mouse.move(c.x + c.width * fx, c.y + c.height * fy, { steps: 15 }); await page.mouse.click(c.x + c.width * fx, c.y + c.height * fy); await wait(page, 400); }
      await page.keyboard.press('Escape');
      await wait(page, Math.max(0, s * 1000 - (Date.now() - t)));
    },
  },
  drive: {
    mode: 'video', len: 6,
    async setup(page) {
      await until(page, () => window.SlopHub, null, 20000);
      await page.evaluate(seedDrive);
      await page.reload();
      await until(page, () => window.SlopHub && document.querySelector('.item, .card, [data-id]'), null, 20000);
      await hide(page, QUIET);
      await wait(page, 1500);
      await page.keyboard.press('1');
      await wait(page, 800);
    },
    async play(page, s) {
      const t = Date.now();
      for (const k of ['2', '4', '5', '6', '1']) { await page.keyboard.press(k); await wait(page, (s * 1000) / 5.5); }
      await wait(page, Math.max(0, s * 1000 - (Date.now() - t)));
    },
  },
};
