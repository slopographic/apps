// Round-up pages (tools/seo/roundups.mjs, copy in shared/seo/roundups/): the checks that keep them fair and sourced,
// the page (disclosure, criteria, table, sources, trademark note) and the JSON-LD.
// Covers: tools/seo/roundups.mjs, shared/seo/roundups/index.mjs, shared/seo/roundups/creative.mjs, shared/seo/roundups/documents.mjs,
//   shared/seo/roundups/business.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const R = await import(pathToFileURL(path.join(ROOT, 'tools/seo/roundups.mjs')).href);
const { ROUNDUPS } = await import(pathToFileURL(path.join(ROOT, 'shared/seo/roundups/index.mjs')).href);
const { loadRegistry, SITE } = await import(pathToFileURL(path.join(ROOT, 'tools/seo/site.mjs')).href);
const apps = await loadRegistry();
const tool = (name, extra = {}) => ({ name, url: `https://${name.toLowerCase()}.example/`, bestFor: 'x', pros: ['a'], cons: ['b'], cells: ['Free', 'Yes'],
  sources: [{ label: `${name} pricing`, url: `https://${name.toLowerCase()}.example/pricing` }], ...extra });
const good = { slug: 'free-pdf-editors', app: 'pdf', checked: '2026-10-24', title: 't', description: 'd', h1: 'Best free PDF editors', lead: 'l',
  criteria: ['Free to use', 'Privacy', 'Features'], columns: ['Price', 'Works offline'],
  tools: [{ ...tool('Slop PDF'), ours: true, sources: undefined, url: undefined }, tool('Alpha'), tool('Beta')],
  faq: [['Q1?', 'A'], ['Q2?', 'A'], ['Q3?', 'A']] };

test('checks: a date the facts were checked, exactly one tool of ours, a con for every tool, sources for the others', () => {
  assert.doesNotThrow(() => R.checkRoundup(good, apps));
  assert.throws(() => R.checkRoundup({ ...good, checked: 'October' }, apps), /checked/);
  assert.throws(() => R.checkRoundup({ ...good, tools: good.tools.map((t) => ({ ...t, ours: false })) }, apps), /exactly one/);
  assert.throws(() => R.checkRoundup({ ...good, tools: [good.tools[0], { ...tool('Alpha'), sources: [] }, tool('Beta')] }, apps), /sources/);
  assert.throws(() => R.checkRoundup({ ...good, tools: [good.tools[0], { ...tool('Alpha'), cons: [] }, tool('Beta')] }, apps), /con/);
  assert.throws(() => R.checkRoundup({ ...good, tools: [good.tools[0], { ...tool('Alpha'), cells: ['Free'] }, tool('Beta')] }, apps), /one cell per column/);
  assert.throws(() => R.checkRoundup({ ...good, app: 'nope' }, apps), /no app/);
});

test('the page says which tool is ours, how they were compared, and links each source', () => {
  const [p] = R.roundupPages(apps, SITE, [good]);
  assert.equal(p.dir, 'best/free-pdf-editors/');
  assert.match(p.html, /We make Slop PDF, one of the tools on this page/);
  assert.match(p.html, /<h2>How we compared them<\/h2>/);
  assert.match(p.html, /<a href="https:\/\/alpha\.example\/pricing" rel="noopener nofollow">Alpha pricing<\/a>/);
  assert.match(p.html, /<a class="btn" href="\/pdf\/">Open Slop PDF<\/a>/);
  assert.match(p.html, /trademarks of their owners/);
  assert.match(p.html, /class="l-wrap"/);   // the site's page frame
});

test('JSON-LD: the article with its date, the list in order, the breadcrumb and the questions', () => {
  const ld = R.roundupJsonLd(good, `${SITE}/best/free-pdf-editors/`, SITE), t = (k) => ld.find((x) => x['@type'] === k);
  assert.equal(t('Article').dateModified, '2026-10-24');
  assert.deepEqual(t('ItemList').itemListElement.map((i) => i.name), ['Slop PDF', 'Alpha', 'Beta']);
  assert.equal(t('ItemList').itemListElement[0].url, `${SITE}/apps/pdf/`);
  assert.equal(t('FAQPage').mainEntity.length, 3);
});

test('every round-up in the copy passes the checks, and the index lists them all', () => {
  for (const r of ROUNDUPS) assert.doesNotThrow(() => R.checkRoundup(r, apps), r.slug);
  const idx = R.roundupIndex(SITE, ROUNDUPS);
  for (const r of ROUNDUPS) assert.ok(idx.html.includes(`href="/best/${r.slug}/"`));
});

test('the feature matrix: one value per tool, shown with marks, and the same tables on the app landing page', async () => {
  const m = (feature, values) => ({ feature, values });
  const withMatrix = { ...good, matrix: [m('Merge', ['yes', 'yes', 'no']), m('Sign', ['yes', 'partial', 'unknown']), m('OCR', ['no', 'yes', 'yes']),
    m('Offline', ['yes', 'no', 'no']), m('Free limit', ['None', '2 a day', 'unknown'])] };
  assert.doesNotThrow(() => R.checkRoundup(withMatrix, apps));
  assert.throws(() => R.checkRoundup({ ...withMatrix, matrix: withMatrix.matrix.slice(0, 3) }, apps), /at least 5/);
  assert.throws(() => R.checkRoundup({ ...withMatrix, matrix: [m('X', ['yes'])].concat(withMatrix.matrix) }, apps), /one value per tool/);
  const html = R.compareTables(withMatrix);
  assert.match(html, /<td class="m-yes"><span aria-hidden="true">✓<\/span> Yes<\/td>/);
  assert.match(html, /<td class="m-partial">/);
  assert.match(html, /<td>2 a day<\/td>/);
  assert.match(html, /<tr class="us"><th scope="row">Slop PDF <span class="l-badge">ours<\/span>/);
  const L = await import(pathToFileURL(path.join(ROOT, 'tools/seo/landing.mjs')).href);
  const page = L.landingPages(apps, SITE, new Proxy({}, { get: () => ({ title: 't', description: 'd' }) }), [], [withMatrix]).find((p) => p.key === 'pdf');
  assert.match(page.html, /<h2>How Slop PDF compares<\/h2>/);
  assert.ok(page.html.includes(R.compareTables(withMatrix)));
  assert.match(page.html, /href="\/best\/free-pdf-editors\/"/);
});
