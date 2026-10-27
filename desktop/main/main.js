/* The desktop app (Electron main process): one window over the bundled site, served from app://<host>/ (main/protocol.js).
 *   - single instance: a second launch focuses the window and opens its files there;
 *   - files from the system (argv on Windows/Linux, open-file on macOS, File ▸ Open…) open in the app the site uses for
 *     their type (main/open.js);
 *   - the renderer has no Node: contextIsolation, sandbox and webSecurity on, the preload exposes only SlopDesktop and
 *     launchQueue (main/preload.js); links leave the app as main/navigation.js says;
 *   - the window's size and place are kept (main/window-state.js); updates come from GitHub Releases (main/updates.js).
 * Paths: the site is desktop/site/ (npm run bundle), the brand desktop/app-brand.json, both inside the package. */
'use strict';
const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, screen, shell, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const P = require('./protocol');
const { createOpener } = require('./open');
const { guard } = require('./navigation');
const menu = require('./menu');
const state = require('./window-state');
const updates = require('./updates');
const { openMap, loadRegistry, ASSOCIATIONS } = require('../lib/open-map');
const { sitePath } = require('../lib/paths');

const BASE = path.resolve(__dirname, '..');
const SITE = path.join(BASE, 'site');
const BRAND = (() => { try { return JSON.parse(fs.readFileSync(path.join(BASE, 'app-brand.json'), 'utf8')); } catch (e) { return {}; } })();
if (BRAND.name) app.setName(BRAND.name);

protocol.registerSchemesAsPrivileged([{ scheme: P.SCHEME, privileges: P.PRIVILEGES }]);

let win = null;
const ARGV_SKIP = app.isPackaged ? 1 : 2;   // the program (and in a development run the app folder) come before the files
const early = [];   // files the system handed over before the window was ready
const getWindow = () => (win && !win.isDestroyed() ? win : null);

/** True when the app carries the page or file at a path (else a link to it opens on the website). */
function carried(pathname) {
  const hit = sitePath(SITE, pathname);
  if (!hit) return false;
  try { return fs.statSync(hit.file).isDirectory() ? fs.existsSync(path.join(hit.file, 'index.html')) : true; } catch (e) { return pathname.startsWith('/__open/'); }
}

function createWindow(url, saved) {
  const s = saved || {};
  const w = new BrowserWindow({
    width: s.width || state.DEFAULT.width, height: s.height || state.DEFAULT.height, x: s.x, y: s.y,
    minWidth: 480, minHeight: 360, show: false, title: BRAND.name || app.getName(),
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true, spellcheck: true,
    },
  });
  w.once('ready-to-show', () => { if (s.maximized) w.maximize(); w.show(); });
  w.loadURL(url);
  return w;
}

let opener = null;
function show(url, files, newWindow) {
  const w = getWindow();
  if (!w) { win = createWindow(url); return false; }
  if (newWindow) { createWindow(url); return false; }
  if (w.isMinimized()) w.restore();
  w.focus();
  const here = (() => { try { return new URL(w.webContents.getURL()).pathname; } catch (e) { return ''; } })();
  if (here === new URL(url).pathname && !w.webContents.isLoading()) { w.webContents.send('desktop:files', files); return true; }
  w.loadURL(url);
  return false;
}
const openFiles = (paths) => { if (!paths || !paths.length) return; if (opener && getWindow()) opener.open(paths); else early.push(...paths); };

async function chooseFiles() {
  const r = await dialog.showOpenDialog(getWindow() || undefined, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Documents and pictures', extensions: ASSOCIATIONS.flatMap((a) => a.ext) }, { name: 'All files', extensions: ['*'] }],
  });
  if (!r.canceled) openFiles(r.filePaths);
}

function about() {
  dialog.showMessageBox(getWindow() || undefined, {
    type: 'info', title: `About ${app.getName()}`, message: `${app.getName()} ${app.getVersion()}`,
    detail: `Electron ${process.versions.electron}, Chromium ${process.versions.chrome}.\nEverything runs on this computer; your files are not uploaded.${BRAND.origin ? '\n' + BRAND.origin : ''}`,
  });
}

// The system's ways in: a second launch (Windows/Linux "Open with", a double-click while running) and macOS open-file.
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', (_e, argv, cwd) => {
    const w = getWindow();
    if (w) { if (w.isMinimized()) w.restore(); w.focus(); }
    openFiles(opener ? opener.argvFiles(argv, cwd, ARGV_SKIP) : []);
  });
  app.on('open-file', (e, file) => { e.preventDefault(); openFiles([file]); });
  app.on('web-contents-created', (_e, contents) => guard(contents, {
    origin: P.ORIGIN, website: BRAND.origin || '', carried, openExternal: (u) => shell.openExternal(u), openFiles,
  }));
  app.whenReady().then(() => {
    P.register(protocol, SITE, (token) => (opener ? opener.file(token) : null));
    const reg = loadRegistry(SITE);
    opener = createOpener({ map: openMap(reg.manifest, reg.apps), origin: P.ORIGIN, show });
    // permissions (camera, microphone, notifications…) only for the app's own pages
    session.defaultSession.setPermissionRequestHandler((wc, _perm, done, details) => done(String((details && details.requestingUrl) || wc.getURL()).startsWith(P.ORIGIN + '/')));
    ipcMain.handle('desktop:take', (_e, url) => opener.take(url));
    const up = updates.start({ app, dialog, getWindow });
    ipcMain.on('desktop:info', (e) => { e.returnValue = { version: app.getVersion(), name: app.getName(), updates: up.enabled }; });
    ipcMain.handle('desktop:check-updates', () => up.check(true).then(() => true, () => false));
    menu.build(Menu, {
      name: app.getName(), mac: process.platform === 'darwin', website: BRAND.origin || '',
      openFile: chooseFiles, about, openExternal: (u) => shell.openExternal(u),
      goHome: () => show(P.ORIGIN + '/', [], false), goDrive: () => show(P.ORIGIN + '/drive/', [], false),
      checkUpdates: up.enabled ? () => up.check(true) : null,
    });
    const file = path.join(app.getPath('userData'), 'window-state.json');
    const saved = state.load(file, screen.getAllDisplays().map((d) => d.workArea));
    win = createWindow(P.ORIGIN + '/', saved);
    state.track(win, file);
    const first = early.splice(0).concat(opener.argvFiles(process.argv, process.cwd(), ARGV_SKIP));
    if (first.length) opener.open(first);
    app.on('activate', () => { if (!getWindow()) { win = createWindow(P.ORIGIN + '/', state.load(file, [])); state.track(win, file); } });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
