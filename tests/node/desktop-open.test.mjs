// Opening files with the desktop app: each type goes to the app the site itself uses (the installed web app's file
// handlers in manifest.webmanifest, then Slop Drive's default app from shared/apps.js), the opener hands the files over
// by token, and the preload's window.launchQueue gives a page File objects as an installed web app gets them.
// Covers: desktop/lib/open-map.js
// Covers: desktop/main/open.js
// Covers: desktop/main/preload.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Module, { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const M = require('../../desktop/lib/open-map.js');
const { createOpener } = require('../../desktop/main/open.js');

test('every associated type opens in the app the site uses for it', () => {
  const { manifest, apps } = M.loadRegistry(ROOT);
  assert.ok(apps.length > 20 && manifest && manifest.file_handlers.length, 'the registry and the manifest load');
  const map = M.openMap(manifest, apps);
  const appPath = (id) => '/' + apps.find((a) => a.id === id).path;
  // the manifest's handlers first: what the browser opens an installed copy of the site with
  for (const h of manifest.file_handlers) for (const exts of Object.values(h.accept)) for (const e of exts) assert.equal(map[e.slice(1)], h.action, e);
  // then Slop Drive's default app
  assert.equal(map.docx, appPath('docs'));
  assert.equal(map.xlsx, appPath('tables'));
  assert.equal(map.pptx, appPath('slides'));
  assert.equal(map.svg, appPath('vector'));
  assert.equal(map.txt, appPath('docs'));
  for (const a of M.ASSOCIATIONS) for (const e of a.ext) assert.ok(map[e] && map[e].startsWith('/') && map[e].endsWith('/'), e);
  assert.equal(M.routeFor('/x/Report.PDF', map), map.pdf);
  assert.equal(M.routeFor('/x/archive.zip', map), '/drive/', 'a type no app takes opens in Slop Drive');
  assert.equal(M.extOf('a.tar.GZ'), 'gz');
  assert.equal(M.extOf('noext'), '');
});

test('driveRoute ranks as Slop Drive does: the app that makes the type, an exact match, then a wildcard', () => {
  const apps = [
    { id: 'wild', kind: 'app', path: 'wild/', accepts: ['image/*'] },
    { id: 'tool', kind: 'app', path: 'tool/', accepts: ['image/png'], tool: true },
    { id: 'exact', kind: 'app', path: 'exact/', accepts: ['image/png'] },
    { id: 'game', kind: 'game', path: 'game/', accepts: ['image/png'] },
    { id: 'maker', kind: 'app', path: 'maker/', accepts: [], creates: [{ ext: 'md', mime: 'text/markdown' }] },
  ];
  assert.equal(M.driveRoute('png', apps), '/exact/');
  assert.equal(M.driveRoute('webp', apps), '/wild/');
  assert.equal(M.driveRoute('md', apps), '/maker/');
  assert.equal(M.driveRoute('pdf', apps), null);
});

test('the opener: files grouped by app, served by token, handed to the page that asks', (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'desk-open-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const f of ['a.pdf', 'b.pdf', 'c.docx']) writeFileSync(path.join(dir, f), f);
  const shown = [];
  const o = createOpener({ map: { pdf: '/pdf/', docx: '/docs/' }, origin: 'app://h', show: (url, files, fresh) => { shown.push([url, files.length, fresh]); return false; } });
  const routes = o.open([path.join(dir, 'a.pdf'), path.join(dir, 'c.docx'), path.join(dir, 'b.pdf'), path.join(dir, 'missing.pdf'), dir]);
  assert.deepEqual(routes, ['/pdf/', '/docs/']);
  assert.deepEqual(shown, [['app://h/pdf/', 2, false], ['app://h/docs/', 1, true]]);
  const files = o.take('app://h/pdf/');
  assert.deepEqual(files.map((f) => [f.name, f.type]), [['a.pdf', 'application/pdf'], ['b.pdf', 'application/pdf']]);
  const token = files[0].url.split('/__open/')[1];
  assert.match(token, /^[0-9a-f]{32}$/);
  assert.equal(o.file(token), path.join(dir, 'a.pdf'));
  assert.equal(o.file('nope'), null);
  assert.deepEqual(o.take('app://h/pdf/'), [], 'taken once');
  assert.equal(o.take('app://h/docs/').length, 1);
  // a page already showing the route takes the files at once
  const o2 = createOpener({ map: { pdf: '/pdf/' }, origin: 'app://h', show: () => true });
  o2.open([path.join(dir, 'a.pdf')]);
  assert.deepEqual(o2.take('app://h/pdf/'), []);
  assert.deepEqual(o.argvFiles(['/opt/app/app', '--flag', path.join(dir, 'a.pdf'), 'missing.txt', dir], dir), [path.join(dir, 'a.pdf')]);
});

test('the preload: SlopDesktop through the bridge and a launchQueue whose handles give File objects', async () => {
  const exposed = {}, ran = [], sent = [];
  const electron = {
    contextBridge: { exposeInMainWorld: (k, v) => { exposed[k] = v; }, executeInMainWorld: (s) => ran.push(s.func) },
    ipcRenderer: {
      on: (ch, fn) => { if (ch === 'desktop:files') electron.push = fn; },
      sendSync: (ch) => (sent.push(ch), { version: '0.1.0', name: 'App', updates: true }),
      invoke: async (ch) => (sent.push(ch), ch === 'desktop:take' ? [{ name: 'a.csv', type: 'text/csv', url: 'app://h/__open/t1', modified: 5 }] : true),
    },
  };
  const load = Module._load;
  Module._load = function (req, ...rest) { return req === 'electron' ? electron : load.call(this, req, ...rest); };
  globalThis.location = { href: 'app://h/convert/' };
  try {
    delete require.cache[require.resolve('../../desktop/main/preload.js')];
    require('../../desktop/main/preload.js');
  } finally { Module._load = load; }
  assert.equal(exposed.SlopDesktop.desktop, true);
  assert.equal(exposed.SlopDesktop.version, '0.1.0');
  assert.equal(typeof exposed.SlopDesktop.checkForUpdates, 'function');
  assert.equal(ran.length, 1);
  // the main-world part, in a stand-in window
  const win = { SlopDesktop: exposed.SlopDesktop };
  const g = globalThis;
  const keep = { window: g.window, fetch: g.fetch };
  g.window = win;
  g.fetch = async (url) => ({ ok: true, blob: async () => new Blob(['x,y'], { type: 'text/csv' }), url });
  try {
    ran[0]();
    const got = await new Promise((done) => win.launchQueue.setConsumer(done));
    assert.equal(got.files.length, 1);
    assert.equal(got.files[0].kind, 'file');
    const file = await got.files[0].getFile();
    assert.equal(file.name, 'a.csv');
    assert.equal(file.type, 'text/csv');
    assert.equal(await file.text(), 'x,y');
    // later files (the app opened again with this page showing) reach the same consumer
    const later = new Promise((done) => win.launchQueue.setConsumer(done));
    electron.push({}, [{ name: 'b.csv', type: 'text/csv', url: 'app://h/__open/t2' }]);
    assert.equal((await later).files[0].name, 'b.csv');
  } finally { g.window = keep.window; g.fetch = keep.fetch; delete g.location; }
  assert.ok(sent.includes('desktop:info') && sent.includes('desktop:take'));
});
