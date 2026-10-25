// Covers: shared/mascot/moments.js, tools/whitelabel/mascot.mjs, tools/whitelabel/emit.mjs, tools/whitelabel/profile.mjs, brand/profiles/overlays/acme/icon.js
// The mascot slot without a browser: the moment table and the trackers that turn page states into moments, and the build
// side of a profile's own mascot (the overlay's file list, its icons, LICENSE-ART, NOTICE and TRADEMARKS).
// The slot on a page: tests/buddy/slot.test.html.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MOMENTS, animationFor, stateOf, workTracker, idleTracker, sideOf, DONE_AFTER_MS } from '../../shared/mascot/moments.js';
import { mascotProblems, overlayDir, overlayProblems, overlayIcons, artFiles, licenseArt, artNotice, artTrademarks, artAllow, artHolder, DEST } from '../../tools/whitelabel/mascot.mjs';
import { loadProfile, profilesDir, validate } from '../../tools/whitelabel/profile.mjs';
import { markerValues, applyMarkers, notice, trademarks, readme, logoSvg } from '../../tools/whitelabel/emit.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = profilesDir(ROOT);

test('every buddy moment has a named animation; an overlay may map or lack one', () => {
  assert.deepEqual(Object.keys(MOMENTS).sort(), ['done', 'error', 'greeting', 'idle', 'point', 'wake', 'working']);
  assert.equal(animationFor('done'), 'celebrate');
  assert.equal(animationFor('done', { animations: ['hello'] }), null);
  assert.equal(animationFor('done', { animations: ['bounce'], moments: { done: 'bounce' } }), 'bounce');
  assert.equal(animationFor('nope', {}), null);
});

test('page states: SlopFlow tiles and aria-busy regions', () => {
  const el = (attrs, cls = '') => ({ getAttribute: (k) => (k in attrs ? attrs[k] : null), classList: { contains: (c) => cls.split(' ').includes(c) } });
  assert.equal(stateOf(el({ 'data-state': 'run' }, 'sflow')), 'run');
  assert.equal(stateOf(el({ 'data-state': 'idle' }, 'sflow')), 'end');
  assert.equal(stateOf(el({ 'data-state': 'run' })), null);           // another widget's data-state is not a task
  assert.equal(stateOf(el({ 'aria-busy': 'true' })), 'run');
  assert.equal(stateOf(el({ 'aria-busy': 'false' })), 'end');
  assert.equal(stateOf(null), null);
});

test('work: working once, done when the last task ends, error at once, short busy spells are not done', () => {
  let now = 0;
  const out = [], w = workTracker((m) => out.push(m), () => now);
  w.update('a', 'run'); w.update('b', 'run');
  assert.deepEqual(out, ['working']);
  w.update('a', 'done');
  assert.deepEqual(out, ['working']);                                // b still runs
  w.update('b', 'error');
  assert.deepEqual(out, ['working', 'error']);
  w.update('c', 'run'); now = DONE_AFTER_MS - 1; w.update('c', 'end');
  assert.deepEqual(out, ['working', 'error', 'working']);
  w.update('c', 'run'); now += DONE_AFTER_MS; w.update('c', 'end');
  assert.deepEqual(out.slice(-1), ['done']);
  assert.equal(w.busy, 0);
});

test('idle: sleep once after the quiet time, wake on the next input', () => {
  const out = [], t = idleTracker((m) => out.push(m), 1000, 0);
  t.tick(999); assert.deepEqual(out, []);
  t.tick(1000); t.tick(5000); assert.deepEqual(out, ['idle']);
  assert.equal(t.asleep, true);
  t.activity(5001); t.activity(5002);
  assert.deepEqual(out, ['idle', 'wake']);
  assert.equal(sideOf({ left: 500, width: 100 }, { left: 10, width: 20 }), -1);
  assert.equal(sideOf({ left: 0, width: 100 }, { left: 400, width: 20 }), 1);
});

test('the profile field: false, true, or an overlay with its name and files', () => {
  assert.deepEqual(mascotProblems(false), []);
  assert.deepEqual(mascotProblems({ overlay: 'o', name: 'Bot', files: ['mascot.js', 'icon.js'] }), []);
  assert.equal(mascotProblems({ overlay: 'o' }).length, 2);
  assert.match(mascotProblems('yes')[0], /true, false/);
  assert.match(validate({ legal: { holder: 'A', year: '2026', trademarks: [1] } }).join('\n'), /legal\.trademarks/);
});

test('the sample overlay: every file listed, the required modules, icons drawn in Node', () => {
  const p = loadProfile(DIR, 'sample'), dir = overlayDir(DIR, p);
  assert.deepEqual(overlayProblems(dir, p), []);
  const short = Object.assign({}, p, { mascot: Object.assign({}, p.mascot, { files: ['mascot.js', 'gone.js'] }) });
  const bad = overlayProblems(dir, short).join('\n');
  assert.match(bad, /icon\.js is in the overlay but not listed/);
  assert.match(bad, /gone\.js is listed but not in the overlay/);
  const icons = overlayIcons(dir);
  assert.match(icons.full, /^<svg[^>]* width="64"[^>]*viewBox="0 0 64 64"/);
  assert.match(icons.small, /^<svg[^>]* width="16"/);
  assert.notEqual(icons.full, icons.small);
  assert.match(logoSvg(p, icons.full), /<svg x="0" y="0" width="32" height="32" viewBox="0 0 64 64">.*Acme Tools/s);
});

test('LICENSE-ART, NOTICE and TRADEMARKS name the character and its files', () => {
  const p = loadProfile(DIR, 'sample');
  const files = artFiles(p);
  assert.ok(files.includes(`${DEST}/mascot.js`) && files.includes(`${DEST}/icon.js`) && files.includes('favicon.ico'));
  const art = licenseArt(p);
  assert.match(art, /Copyright \(c\) 2026 Acme Example Ltd\. All rights reserved\./);
  assert.match(art, /not covered by the MIT License/);
  for (const f of files) assert.ok(art.includes(`  ${f}\n`), f);
  assert.match(notice(p), /3\. The Acme Bot character\. Its art, 3D model, animations and icons/);
  assert.match(artNotice(p), /all rights reserved/);
  assert.match(trademarks(p), /"Acme", "Acme Tools", "Acme Bot", their logos and the Acme Bot character design are trademarks of Acme Example Ltd/);
  assert.match(artTrademarks(p), /grants no trademark rights/);
  assert.match(trademarks(p), /different name, logo and mascot/);
  assert.match(readme(p), /LICENSE-ART/);
  const plain = loadProfile(DIR, 'sample-sv');                       // no overlay: no art item, the old wording
  assert.deepEqual(artFiles(plain), []);
  assert.doesNotMatch(notice(plain), /character/);
  assert.match(trademarks(plain), /different name and logo,/);
});

test('a character owned by someone else: its owner in the art files and notices only', () => {
  const p = loadProfile(DIR, 'sample');
  assert.deepEqual(artAllow(p), []);                                  // the site's holder owns it
  const q = Object.assign({}, p, { mascot: Object.assign({}, p.mascot, { holder: 'Bots Inc', trademarks: ['Bots Inc', 'Acme Bot'] }) });
  assert.equal(artHolder(q), 'Bots Inc');
  assert.match(licenseArt(q), /Copyright \(c\) 2026 Bots Inc\. All rights reserved\./);
  assert.match(trademarks(q), /"Acme", "Acme Tools", "Acme Bot" and their logos belong to Acme Example Ltd\. "Bots Inc", "Acme Bot", their logos and the Acme Bot character design are trademarks of Bots Inc\./);
  assert.match(trademarks(q), /suggest that Acme Example Ltd or Bots Inc made/);
  const allow = artAllow(q);
  assert.deepEqual(allow.map((a) => a.file), ['brand/mascot/icon.js', 'brand/mascot/mascot.js', 'LICENSE-ART', 'NOTICE.md', 'TRADEMARKS.md']);
  assert.ok(allow.every((a) => a.term === 'bots inc' && a.why));
});

test('markers: an overlay turns the built-in buddy off and the slot on', () => {
  const v = markerValues(loadProfile(DIR, 'sample'));
  assert.equal(v.mascot, false);
  assert.equal(v.mascotOverlay, true);
  const src = 'const MASCOT = /*profile:mascot*/true;\nconst OVERLAY = /*profile:mascotOverlay*/false;';
  assert.equal(applyMarkers(src, v), 'const MASCOT = /*profile:mascot*/false;\nconst OVERLAY = /*profile:mascotOverlay*/true;');
  const own = markerValues(loadProfile(DIR, 'slopographic'));
  assert.equal(applyMarkers(src, own), src);
});
