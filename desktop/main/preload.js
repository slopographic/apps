/* The desktop app's preload: the only bridge between a page and the app (contextIsolation and the sandbox are on, the
 * page has no Node). It gives the page two things:
 *   window.SlopDesktop   { desktop: true, platform, version, name, checkForUpdates (null where updates do not run),
 *                        onFiles(fn) }: onFiles(fn) calls fn(files) with the files the app was opened with for this
 *                        page, now and later ([{ name, type, url, modified }]; url is app://…/__open/<token>, main/open.js)
 *   window.launchQueue   what an installed web app gets from the browser: setConsumer(fn) calls fn({ files }) with file
 *                        handles ({ kind: 'file', name, getFile() }), so every app takes the files the way it takes an
 *                        installed copy's launch files (SlopIntake.launch in shared/intake/sources.js), unchanged.
 * A sandboxed preload can require only 'electron', so the main-world part (mainWorld) is a function that
 * contextBridge.executeInMainWorld runs there: it must not use anything from this file. */
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const listeners = [];
let pending = [];
ipcRenderer.on('desktop:files', (_e, files) => {
  if (listeners.length) listeners.forEach((fn) => fn(files)); else pending = pending.concat(files);
});
const info = ipcRenderer.sendSync('desktop:info') || {};

contextBridge.exposeInMainWorld('SlopDesktop', {
  desktop: true,
  platform: process.platform,
  version: String(info.version || ''),
  name: String(info.name || ''),
  onFiles(fn) {
    if (typeof fn !== 'function') return;
    listeners.push(fn);
    if (pending.length) { const list = pending; pending = []; fn(list); }
    ipcRenderer.invoke('desktop:take', location.href).then((files) => { if (files && files.length) fn(files); });
  },
  // only where the app updates itself (main/updates.js enabled): not in a store build, a .deb or a development run
  checkForUpdates: info.updates ? () => ipcRenderer.invoke('desktop:check-updates') : null,
});

/** Runs in the page's world: window.launchQueue over SlopDesktop.onFiles. Self-contained (it is serialised). */
function mainWorld() {
  const D = window.SlopDesktop;
  if (!D) return;
  let consumer = null;
  const early = [];
  const handle = (f) => ({
    kind: 'file',
    name: f.name,
    getFile: () => fetch(f.url).then((r) => {
      if (!r.ok) throw new Error(f.name + ': ' + r.status);
      return r.blob();
    }).then((b) => new File([b], f.name, { type: f.type || b.type, lastModified: f.modified || Date.now() })),
  });
  const deliver = (files) => {
    const params = { files: files.map(handle), targetURL: location.href };
    if (consumer) consumer(params); else early.push(params);
  };
  const queue = { setConsumer(fn) { consumer = fn; early.splice(0).forEach((p) => fn(p)); } };
  try { Object.defineProperty(window, 'launchQueue', { value: queue, configurable: true, writable: false }); } catch (e) { return; }
  D.onFiles(deliver);
}
try { contextBridge.executeInMainWorld({ func: mainWorld }); } catch (e) { /* an old Electron: no launch files, the apps still open */ }

if (typeof module !== 'undefined' && module.exports) module.exports = { mainWorld };   // for tests/node; a sandboxed preload has no module
