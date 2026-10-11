// Recipes for the experiments (and Paint Classic).
import { wait, until, run, drag, curve, hide, strokeFrames, wave } from './util.mjs';

const rest = (page, s, t) => wait(page, Math.max(0, s * 1000 - (Date.now() - t)));

export default {
  tank: {
    async setup(page) {
      await wait(page, 2500);
      await page.click('#panel-toggle').catch(() => {});
      await hide(page, ['#toast', '#hint']);
      await wait(page, 600);
    },
    async warm(page) { await run(page, 120); },
  },
  lighter: {
    async setup(page) {
      await wait(page, 1500);
      await hide(page, ['#hint', '#toast']);
      await page.click('#lid'); await wait(page, 900);
      await page.click('#wheel'); await wait(page, 1500);
    },
    async warm(page) { await run(page, 30); },
    async frame(page, i) { await page.mouse.move(640 + Math.sin(i / 14) * 260, 250 + Math.cos(i / 20) * 60); },
  },
  reel: {
    async setup(page) {
      await until(page, () => window.__reel && window.__reel.ready, null, 40000);
      await wait(page, 1500);
      await page.evaluate(() => { for (let i = 0; i < 4; i++) window.__reel.feed(); });
    },
    async warm(page) { await run(page, 45); },
    async frame(page, i) { if (i % 40 === 20) await page.evaluate(() => window.__reel.dropOnSloppo()); },
  },
  '2100': {
    mode: 'video', len: 5,
    async setup(page) {
      await until(page, () => window.__www, null, 20000);
      await page.evaluate(() => window.__www.skipBoot());
      await wait(page, 2500);
    },
    async play(page, s) {
      const t = Date.now();
      await page.evaluate(() => window.__www.query('slime moulds'));
      await rest(page, s, t);
    },
  },
  shots: {
    mode: 'video', len: 5,
    async setup(page) { await wait(page, 2000); },
    async play(page, s) {
      const t = Date.now();
      const b = await page.locator('#pack').boundingBox();
      if (b) await drag(page, [[b.x + 10, b.y + 30], [b.x + b.width - 10, b.y + 34]], { steps: 25 });
      await wait(page, 1600);
      await page.click('#flipAll').catch(() => {});
      await rest(page, s, t);
    },
  },
  unsubscribe: {
    mode: 'video', len: 5,
    async setup(page) { await wait(page, 2000); },
    async play(page, s) {
      const t = Date.now();
      await page.mouse.move(640, 500, { steps: 20 });
      await page.locator('#stage button').first().click().catch(() => {});
      await wait(page, 1500);
      await page.mouse.move(500, 380, { steps: 30 });
      await rest(page, s, t);
    },
  },
  authenticator: {
    mode: 'video', len: 5, url: 'index.html#detector',
    async setup(page) { await wait(page, 1500); },
    async play(page, s) {
      const t = Date.now();
      await page.click('#sample-slop');
      await wait(page, 1800);
      await page.locator('#result').scrollIntoViewIfNeeded().catch(() => {});
      await rest(page, s, t);
    },
    async beforeShot(page) {
      await page.click('#sample-slop').catch(() => {});
      await wait(page, 2500);
      await page.locator('#result').scrollIntoViewIfNeeded().catch(() => {});
      await wait(page, 600);
    },
  },
  'paint-classic': {
    len: 5,
    async setup(page) {
      await wait(page, 1500);
      const c = await page.locator('canvas').first().boundingBox();
      const P = (fx, fy) => [c.x + c.width * fx, c.y + c.height * fy];
      this.P = P;
      await page.click('[data-tool="ellipse"]').catch(() => {});
      await page.locator('#palette > *').nth(11).click().catch(() => {});
      await drag(page, [P(0.08, 0.12), P(0.42, 0.82)], { steps: 4 });
      await page.click('[data-tool="fill"]').catch(() => {});
      await page.locator('#palette > *').nth(4).click().catch(() => {});
      await page.mouse.click(...P(0.25, 0.47));
      await page.click('[data-tool="rect"]').catch(() => {});
      await page.locator('#palette > *').nth(5).click().catch(() => {});
      await drag(page, [P(0.55, 0.15), P(0.9, 0.45)], { steps: 4 });
      await page.mouse.move(1270, 790);
    },
    get frame() {
      const P = (fx, fy) => (this.P ? this.P(fx, fy) : [fx * 800 + 90, fy * 500 + 64]);
      const self = this;
      return async (page, i) => strokeFrames([
        { at: 4, pts: curve(0.72, 0.68, 0.12, 0.16, 1.3, 50, 0, 0.5).map(([x, y]) => P(x, y)), before: (p) => p.click('[data-tool="brush"]').then(() => p.locator('#palette > *').nth(9).click()).catch(() => {}) },
        { at: 70, pts: wave(0.06, 0.94, 0.92, 0.03, 70, 3).map(([x, y]) => P(x, y)), before: (p) => p.click('[data-tool="slop"]').catch(() => {}) },
      ])(page, i, self);
    },
  },
};
