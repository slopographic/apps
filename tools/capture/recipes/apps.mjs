// Recipes for the creative apps: filmed in real time (video mode) while the recipe works in them.
import { wait, until, drag, curve, hide } from './util.mjs';
import { seedDrive } from './seed.mjs';

/** Box of the first visible element matching sel, or a fallback rectangle. */
async function boxOf(page, sel, fb = { x: 200, y: 150, width: 800, height: 500 }) {
  const b = await page.locator(sel).first().boundingBox().catch(() => null);
  return b && b.width > 20 ? b : fb;
}
const QUIET = ['.toast', '.toasts', '#toast', '.slop-toast', '.sui-toast', '.toast-wrap'];

export default {
  photoslop: {
    mode: 'video', len: 5,
    async setup(page) {
      await until(page, () => document.body.classList.contains('ready'), null, 30000);
      await hide(page, QUIET);
      await wait(page, 800);
      const c = await boxOf(page, '#stage canvas, .canvas-wrap canvas, main canvas');
      const P = (fx, fy) => [c.x + c.width * fx, c.y + c.height * fy];
      await page.keyboard.press('b');
      await page.keyboard.press('Shift+Control+n').catch(() => {});
      await page.keyboard.press('Escape');
      const sw = page.locator('.swatch-grid .swatch:not(.add)');
      const n = await sw.count();
      const strokes = [[0.13, 0.25, 0.08, 0.1], [0.86, 0.72, 0.07, 0.12], [0.85, 0.24, 0.05, 0.08]];
      for (let i = 0; i < strokes.length; i++) {
        if (n) await sw.nth([5, 9, 13, 3][i % 4] % n).click();
        const [fx, fy, rx, ry] = strokes[i];
        await drag(page, curve(fx, fy, rx, ry, 1.6, 36, i, 0.5).map(([x, y]) => P(x, y)), { steps: 3 });
      }
      await page.mouse.move(1270, 790);
      this.P = P; this.sw = sw; this.n = n;
    },
    async play(page, s) {
      const t = Date.now();
      if (this.n) await this.sw.nth(7 % this.n).click();
      const pts = [];
      for (let i = 0; i <= 60; i++) pts.push(this.P(0.1 + i / 60 * 0.8, 0.88 + Math.sin(i / 5) * 0.04));
      await drag(page, pts, { steps: 4 });
      await page.mouse.move(1270, 790, { steps: 10 });
      await wait(page, Math.max(0, s * 1000 - (Date.now() - t)));
    },
  },
  vector: {
    mode: 'video', len: 5,
    async setup(page) {
      await until(page, () => document.getElementById('app')?.classList.contains('ready') && window.SV, null, 30000);
      await hide(page, QUIET);
      await wait(page, 800);
      this.c = await boxOf(page, '#canvas, #stage, svg#doc, .stage svg, main svg');
    },
    async play(page, s) {
      const c = this.c, t = Date.now();
      const P = (fx, fy) => [c.x + c.width * fx, c.y + c.height * fy];
      await page.keyboard.press('v');
      await page.mouse.click(...P(0.4, 0.55));
      await wait(page, 500);
      await page.keyboard.press('Escape');
      await page.keyboard.press('l');
      await drag(page, [P(0.75, 0.2), P(0.8, 0.28), P(0.86, 0.34)], { steps: 12 });
      await page.keyboard.press('m');
      await drag(page, [P(0.08, 0.68), P(0.13, 0.76), P(0.2, 0.86)], { steps: 12 });
      await page.keyboard.press('v');
      await page.mouse.move(1270, 790, { steps: 8 });
      await wait(page, Math.max(0, s * 1000 - (Date.now() - t)));
    },
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
