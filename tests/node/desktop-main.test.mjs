// The desktop app's main process, run against a stand-in for Electron (no window opens): it registers the privileged
// scheme before ready, takes the single-instance lock, makes a sandboxed window with no Node, and routes links (pages it
// carries stay, others open on the website, http(s) in the browser, a dropped file opens in its app). Also the menu, the
// kept window place and when updates run.
// Covers: desktop/main/main.js
// Covers: desktop/main/menu.js
// Covers: desktop/main/navigation.js
// Covers: desktop/main/window-state.js
// Covers: desktop/main/updates.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import Module, { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { decide } = require('../../desktop/main/navigation.js');
const menu = require('../../desktop/main/menu.js');
const state = require('../../desktop/main/window-state.js');
const updates = require('../../desktop/main/updates.js');
const P = require('../../desktop/main/protocol.js');

test('navigation: carried pages stay, the rest goes to the website, the browser or the file opener', () => {
  const ctx = { origin: P.ORIGIN, website: 'https://example.test', carried: (p) => p !== '/best/' };
  assert.deepEqual(decide(P.ORIGIN + '/pdf/', ctx), { action: 'allow' });
  assert.deepEqual(decide(P.ORIGIN + '/best/?a=1#b', ctx), { action: 'external', url: 'https://example.test/best/?a=1#b' });
  assert.deepEqual(decide('https://github.com/x', ctx), { action: 'external', url: 'https://github.com/x' });
  assert.deepEqual(decide('mailto:a@b.test', ctx).action, 'external');
  assert.deepEqual(decide('file:///tmp/a.pdf', ctx), { action: 'file', file: path.resolve('/tmp/a.pdf') });
  assert.deepEqual(decide('blob:app://x/123', ctx), { action: 'allow' });
  assert.deepEqual(decide('javascript:alert(1)', ctx), { action: 'deny' });
  assert.deepEqual(decide(P.ORIGIN + '/best/', { ...ctx, website: '' }), { action: 'deny' });
});

test('the menu: File ▸ Open…, Edit roles, zoom and full screen, Help with the website; updates only when they run', () => {
  const calls = [];
  const ctx = { name: 'App', mac: false, website: 'https://example.test', openFile: () => calls.push('open'), goHome() {}, goDrive() {}, about: () => calls.push('about'), openExternal: (u) => calls.push(u), checkUpdates: () => calls.push('check') };
  const t = menu.template(ctx);
  const labels = t.map((m) => m.label);
  assert.deepEqual(labels, ['File', 'Edit', 'View', 'Window', 'Help']);
  const items = (label) => t.find((m) => m.label === label).submenu;
  const open = items('File').find((i) => i.label === 'Open…');
  assert.equal(open.accelerator, 'CmdOrCtrl+O');
  open.click();
  assert.ok(['copy', 'paste', 'undo', 'selectAll'].every((r) => items('Edit').some((i) => i.role === r)));
  assert.ok(['zoomIn', 'zoomOut', 'resetZoom', 'togglefullscreen'].every((r) => items('View').some((i) => i.role === r)));
  items('Help').filter((i) => i.click).forEach((i) => i.click());
  assert.deepEqual(calls, ['open', 'about', 'https://example.test', 'check']);
  const mac = menu.template({ ...ctx, mac: true, checkUpdates: null, website: '' });
  assert.equal(mac[0].label, 'App');
  assert.ok(!mac.find((m) => m.label === 'Help').submenu.some((i) => /Update|website/.test(i.label || '')));
});

test('window state: saved bounds come back only while they are on a screen', (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'desk-ws-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 's.json');
  assert.deepEqual(state.load(file, []), state.DEFAULT);
  const win = { isDestroyed: () => false, getNormalBounds: () => ({ x: 100, y: 50, width: 900, height: 700 }), isMaximized: () => true };
  state.save(file, win);
  assert.deepEqual(state.load(file, [{ x: 0, y: 0, width: 1920, height: 1080 }]), { width: 900, height: 700, maximized: true, x: 100, y: 50 });
  assert.deepEqual(state.load(file, [{ x: 3000, y: 0, width: 800, height: 600 }]), { width: 900, height: 700, maximized: true }, 'off screen: no place');
});

test('updates run only in a packaged installer, never in a store build, the portable .exe or a .deb', () => {
  const app = { isPackaged: true };
  assert.equal(updates.enabled(app, {}, { platform: 'win32' }), true);
  assert.equal(updates.enabled({ isPackaged: false }, {}, { platform: 'win32' }), false);
  assert.equal(updates.enabled(app, {}, { platform: 'darwin', mas: true }), false);
  assert.equal(updates.enabled(app, {}, { platform: 'win32', windowsStore: true }), false);
  assert.equal(updates.enabled(app, {}, { platform: 'linux' }), false);
  assert.equal(updates.enabled(app, { PORTABLE_EXECUTABLE_DIR: 'C:\\x' }, { platform: 'win32' }), false);
  assert.equal(updates.enabled(app, { APPIMAGE: '/x.AppImage' }, { platform: 'linux' }), true);
});

test('main: privileged scheme before ready, single instance, a sandboxed window without Node, guarded contents', async () => {
  const log = { schemes: null, windows: [], ipc: [], handled: null };
  const app = Object.assign(new EventEmitter(), {
    isPackaged: false, setName() {}, getName: () => 'App', getVersion: () => '0.0.0', getPath: () => tmpdir(), quit() {},
    requestSingleInstanceLock: () => true, whenReady: () => Promise.resolve(),
  });
  class BrowserWindow extends EventEmitter {
    constructor(opts) {
      super();
      this.opts = opts;
      this.webContents = Object.assign(new EventEmitter(), { getURL: () => this.url || '', isLoading: () => false, send() {}, setWindowOpenHandler() {} });
      log.windows.push(this);
    }
    loadURL(u) { this.url = u; }
    isDestroyed() { return false; } isMinimized() { return false; } focus() {} maximize() {} show() {}
    getNormalBounds() { return { x: 0, y: 0, width: 800, height: 600 }; } isMaximized() { return false; }
  }
  const electron = {
    app, BrowserWindow,
    Menu: { buildFromTemplate: (t) => t, setApplicationMenu: (m) => { log.menu = m; } },
    dialog: {}, shell: { openExternal() {} },
    ipcMain: { on: (ch) => log.ipc.push(ch), handle: (ch) => log.ipc.push(ch) },
    protocol: { registerSchemesAsPrivileged: (s) => { log.schemes = s; }, handle: (s, fn) => { log.handled = [s, fn]; } },
    screen: { getAllDisplays: () => [{ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }] },
    session: { defaultSession: { setPermissionRequestHandler: (fn) => { log.perm = fn; } } },
  };
  const load = Module._load;
  Module._load = function (req, ...rest) { return req === 'electron' ? electron : load.call(this, req, ...rest); };
  try { require('../../desktop/main/main.js'); } finally { Module._load = load; }
  assert.deepEqual(log.schemes, [{ scheme: P.SCHEME, privileges: P.PRIVILEGES }], 'registered before ready');
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(log.handled[0], P.SCHEME);
  const win = log.windows[0];
  assert.equal(win.url, P.ORIGIN + '/');
  const wp = win.opts.webPreferences;
  assert.deepEqual([wp.contextIsolation, wp.sandbox, wp.nodeIntegration, wp.webSecurity], [true, true, false, true]);
  assert.match(wp.preload, /preload\.js$/);
  assert.ok(['desktop:info', 'desktop:take', 'desktop:check-updates'].every((c) => log.ipc.includes(c)));
  assert.deepEqual(log.menu.map((m) => m.label), ['File', 'Edit', 'View', 'Window', 'Help'].filter((l) => process.platform !== 'darwin' || l));
  // every WebContents is guarded: a navigation off the app is stopped
  const contents = Object.assign(new EventEmitter(), { setWindowOpenHandler: (fn) => { contents.openHandler = fn; } });
  app.emit('web-contents-created', {}, contents);
  let stopped = false;
  contents.emit('will-navigate', { preventDefault: () => { stopped = true; } }, 'https://example.test/');
  assert.equal(stopped, true);
  assert.deepEqual(contents.openHandler({ url: 'https://example.test/' }), { action: 'deny' });
  // permissions: the app's own pages only
  let answer = null;
  log.perm({ getURL: () => 'https://evil.test/' }, 'media', (a) => { answer = a; }, { requestingUrl: 'https://evil.test/' });
  assert.equal(answer, false);
  log.perm({ getURL: () => P.ORIGIN + '/recorder/' }, 'media', (a) => { answer = a; }, { requestingUrl: P.ORIGIN + '/recorder/' });
  assert.equal(answer, true);
  assert.match(readFileSync(new URL('../../desktop/main/main.js', import.meta.url), 'utf8'), /requestSingleInstanceLock/);
});
