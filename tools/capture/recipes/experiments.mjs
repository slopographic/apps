// Recipes for the experiments (and Paint Classic).
import { wait, until, run, drag, curve, hide } from './util.mjs';

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
    mode: 'video', len: 5,
    async setup(page) {
      await wait(page, 1500);
      const c = await page.locator('canvas').first().boundingBox();
      this.P = (fx, fy) => [c.x + c.width * fx, c.y + c.height * fy];
      await page.click('[data-tool="ellipse"]').catch(() => {});
      await page.locator('#palette > *').nth(11).click().catch(() => {});
      await drag(page, [this.P(0.1, 0.15), this.P(0.45, 0.85)]);
      await page.click('[data-tool="fill"]').catch(() => {});
      await page.locator('#palette > *').nth(4).click().catch(() => {});
      await page.mouse.click(...this.P(0.28, 0.5));
      await page.click('[data-tool="brush"]').catch(() => {});
      await page.locator('#palette > *').nth(5).click().catch(() => {});
      await drag(page, curve(0.72, 0.4, 0.15, 0.25, 1.4, 40, 0, 0.6).map(([x, y]) => this.P(x, y)), { steps: 3 });
    },
    async play(page, s) {
      const t = Date.now();
      await page.click('[data-tool="slop"]').catch(() => {});
      const pts = []; for (let i = 0; i <= 40; i++) pts.push(this.P(0.1 + i * 0.02, 0.92 - Math.sin(i / 6) * 0.05));
      await drag(page, pts, { steps: 4 });
      await page.click('[data-tool="stamp"]').catch(() => {});
      for (const [x, y] of [[0.6, 0.8], [0.75, 0.75], [0.9, 0.85]]) { await page.mouse.click(...this.P(x, y)); await wait(page, 250); }
      await page.mouse.move(1270, 790, { steps: 10 });
      await rest(page, s, t);
    },
  },
};
