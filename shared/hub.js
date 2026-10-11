/* Slop Hub: how Slopographic apps talk to each other.
 *  - Slop Drive: a shared IndexedDB file store (same origin, this device only) that every app can
 *    put files into and open files from.
 *  - Bus: live messages between open apps/tabs over BroadcastChannel('slopographic').
 *  - Send to…: put a file in the Drive and open another app on it (?drive=<id>).
 * Classic script, needs shared/apps.js (and shared/slopui.js for the dialogs). Exposes window.SlopHub. */
(function () {
  'use strict';
  if (window.SlopHub) return;
  const ROOT = (() => { const s = document.currentScript && document.currentScript.src; return s ? new URL('../', s).href : new URL('/', location.href).href; })();
  const apps = () => window.SLOP_APPS || [];
  const appById = (id) => apps().find((a) => a.id === id);
  const urlOf = (app, params) => { const u = new URL(app.path, ROOT); if (params) for (const k in params) u.searchParams.set(k, params[k]); return u.href; };

  /* ---------- Slop Drive ---------- */
  let dbp = null;
  function db() {
    if (!dbp) dbp = new Promise((res, rej) => {
      if (!window.indexedDB) { rej(new Error('Storage is unavailable')); return; }
      const r = indexedDB.open('slop-drive', 1);
      r.onupgradeneeded = () => { const s = r.result.createObjectStore('files', { keyPath: 'id' }); s.createIndex('time', 'time'); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function tx(mode, fn) {
    const d = await db();
    return new Promise((res, rej) => { const t = d.transaction('files', mode), r = fn(t.objectStore('files')); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); });
  }
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  async function put(blob, { name = 'Untitled', from = 'unknown', meta = {} } = {}) {
    const rec = { id: newId(), name, type: blob.type || 'application/octet-stream', size: blob.size, from, time: Date.now(), meta, blob };
    await tx('readwrite', (s) => s.put(rec));
    emit('drive:put', { id: rec.id, name, type: rec.type, from });
    return rec.id;
  }
  const get = (id) => tx('readonly', (s) => s.get(id));
  async function list({ accept } = {}) {
    const all = (await tx('readonly', (s) => s.getAll())) || [];
    return all.filter((r) => !accept || matches(r.type, accept)).sort((a, b) => b.time - a.time);
  }
  async function remove(id) { await tx('readwrite', (s) => s.delete(id)); emit('drive:remove', { id }); }
  async function clear() { await tx('readwrite', (s) => s.clear()); emit('drive:clear', {}); }
  function matches(type, accept) {
    const list = [].concat(accept);
    return list.some((p) => p === '*' || p === type || (p.endsWith('/*') && type.startsWith(p.slice(0, -1))));
  }

  /* ---------- Bus ---------- */
  const handlers = new Map();
  const self = { id: newId(), app: null };
  let bc = null;
  try { bc = new BroadcastChannel('slopographic'); bc.onmessage = (e) => dispatch(e.data); } catch (e) { /* old browser: same-tab only */ }
  function dispatch(msg) { if (!msg || msg.src === self.id) return; for (const fn of handlers.get(msg.type) || []) try { fn(msg.data, msg); } catch (e) { console.warn(e); } for (const fn of handlers.get('*') || []) fn(msg.data, msg); }
  function on(type, fn) { if (!handlers.has(type)) handlers.set(type, new Set()); handlers.get(type).add(fn); return () => handlers.get(type).delete(fn); }
  function emit(type, data) { const msg = { type, data, src: self.id, app: self.app, time: Date.now() }; if (bc) bc.postMessage(msg); return msg; }
  /** Announce this app; others can see who is open. */
  const peers = new Map();
  function register(appId) {
    self.app = appId;
    emit('hello', { app: appId });
    on('hello', (d, m) => { peers.set(m.src, { app: d.app, time: m.time }); emit('here', { app: appId }); });
    on('here', (d, m) => peers.set(m.src, { app: d.app, time: m.time }));
    on('bye', (d, m) => peers.delete(m.src));
    addEventListener('pagehide', () => emit('bye', { app: appId }));
  }
  const openApps = () => [...new Set([...peers.values()].map((p) => p.app))];

  /* ---------- Send to / open from ---------- */
  function appsAccepting(type) { return apps().filter((a) => a.kind === 'app' && a.id !== self.app && a.accepts.some((p) => matches(type, p))); }
  async function sendTo(appId, blob, name, { newTab = true, from = self.app } = {}) {
    const app = appById(appId); if (!app) throw new Error('Unknown app ' + appId);
    const id = await put(blob, { name, from });
    const url = urlOf(app, { drive: id });
    if (newTab) { const w = window.open(url, '_blank'); if (!w) location.href = url; } else location.href = url;
    return id;
  }
  /** Menu items (for SlopUI.menu or an app menu): "Send to PhotoSLOP", … getBlob() may be async. */
  function sendMenuItems(getBlob, name, type) {
    return appsAccepting(type).map((a) => ({ label: `Send to ${a.name}`, act: async () => {
      try { const b = await getBlob(); await sendTo(a.id, b, typeof name === 'function' ? name() : name); if (window.SlopUI) SlopUI.toast(`Opened in ${a.name}`); }
      catch (e) { if (window.SlopUI) SlopUI.toast('Could not send: ' + e.message); }
    } }));
  }
  /** If this page was opened with ?drive=<id>, return that Drive record (once) and tidy the URL. */
  async function consumeLaunch() {
    const u = new URL(location.href), id = u.searchParams.get('drive');
    if (!id) return null;
    u.searchParams.delete('drive'); history.replaceState(null, '', u.pathname + u.search + u.hash);
    try { return await get(id); } catch (e) { return null; }
  }
  const fmtSize = (n) => (n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(1) + ' MB');
  /** A Slop Drive picker dialog. Resolves with a record or null. */
  function pickFromDrive({ accept, title = 'Open from Slop Drive' } = {}) {
    return new Promise(async (res) => {
      const UI = window.SlopUI, el = UI.el;
      const items = await list({ accept }).catch(() => []);
      let chosen = null;
      const grid = el('div', { class: 'hub-grid' });
      if (!items.length) grid.append(el('p', { class: 'sui-p' }, 'Slop Drive is empty. Use “Send to…” in any Slopographic app to put files here. Files stay on this device.'));
      const urls = [];
      for (const r of items) {
        const isImg = r.type.startsWith('image/') && r.type !== 'image/vnd.adobe.photoshop';
        let thumb;
        if (isImg) { const u = URL.createObjectURL(r.blob); urls.push(u); thumb = el('img', { src: u, alt: '' }); }
        else thumb = el('span', { class: 'hub-ext' }, (r.name.split('.').pop() || r.type.split('/').pop()).slice(0, 4).toUpperCase());
        const app = appById(r.from);
        const b = el('button', { type: 'button', class: 'hub-item' }, el('span', { class: 'hub-thumb' }, thumb), el('b', null, r.name), el('small', null, `${app ? app.name : r.from} · ${fmtSize(r.size)} · ${new Date(r.time).toLocaleString()}`));
        b.addEventListener('click', () => { chosen = r; d.close(true); });
        b.addEventListener('contextmenu', (e) => { e.preventDefault(); UI.menu([{ label: 'Delete from Slop Drive', act: async () => { await remove(r.id); b.remove(); } }], e.clientX, e.clientY); });
        grid.append(b);
      }
      const d = UI.dialog({ title, cls: 'sui-wide', body: el('div', null, el('p', { class: 'sui-p' }, 'Files shared between Slopographic apps. Stored only in this browser.'), grid),
        buttons: items.length ? [{ label: 'Clear Drive', danger: true, act: async () => { if (await UI.confirm('Clear Slop Drive?', 'Delete every file in Slop Drive on this device?', 'Clear', { danger: true })) { await clear(); return true; } return false; } }, { label: 'Cancel' }] : [{ label: 'OK', primary: true }],
        onClose: () => { urls.forEach((u) => URL.revokeObjectURL(u)); res(chosen); } });
    });
  }
  // Minimal styles for the picker (works in every app theme via SlopUI variables).
  const css = document.createElement('style');
  css.textContent = '.hub-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;max-height:60vh;overflow:auto}.hub-item{display:grid;gap:3px;text-align:left;padding:8px;border-radius:8px;border:1px solid var(--s-line);background:var(--s-bg2);color:var(--s-fg);cursor:pointer;font:inherit}.hub-item:hover{border-color:var(--s-accent)}.hub-thumb{display:grid;place-items:center;height:96px;border-radius:5px;background:repeating-conic-gradient(#3a3a3a 0 25%,#2a2a2a 0 50%) 0 0/12px 12px;overflow:hidden}.hub-thumb img{max-width:100%;max-height:96px}.hub-ext{font:700 18px var(--s-mono);color:var(--s-dim)}.hub-item b{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hub-item small{color:var(--s-faint);font-size:10.5px}';
  document.head.append(css);

  window.SlopHub = { apps, appById, urlOf, put, get, list, remove, clear, on, emit, register, openApps, appsAccepting, sendTo, sendMenuItems, consumeLaunch, pickFromDrive, matches, self };
})();
