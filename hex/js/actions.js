/* Slop Hex: the app actions (open, save, find, copy, go to, undo). Classic script; exposes window.HexApp.
 * The open file is the current tab (js/tabs.js): app.doc and app.cur follow it. The DOM is read only inside functions,
 * because this script runs before the page body exists. */
(function () {
  'use strict';
  if (window.HexApp) return;
  const $ = (id) => document.getElementById(id);
  const HB = () => window.HexBytes;
  const tabs = () => window.HexTabs;
  const app = { doc: null, cur: null, grid: null, shaTok: 0, findTok: 0, typeTok: 0 };
  /** The Drive file the open tab is linked to (kept by the strip). */
  Object.defineProperty(app, 'driveId', { get: () => (app.cur && tabs().api() ? tabs().api().driveIdOf(app.cur) : null) });
  const MB = 1 << 20;

  function status(msg) { const el = $('hx-status'); if (el) el.textContent = msg || ''; }
  const plural = (n, w) => `${n.toLocaleString('en')} ${w}${n === 1 ? '' : 's'}`;
  function sizeText(n) { return `${plural(n, 'byte')}${n >= 1024 ? ` (${SlopHub.fmtSize(n)})` : ''}`; }

  /** The selected range as [lo, hi], or null. */
  function selRange() {
    const s = app.grid ? app.grid.sel() : { anchor: null, cursor: null };
    if (s.cursor === null || s.anchor === null) return null;
    return [Math.min(s.anchor, s.cursor), Math.max(s.anchor, s.cursor)];
  }

  function selText() {
    const r = selRange(), d = app.doc;
    if (!r || !d) return 'None';
    const [lo, hi] = r, n = hi - lo + 1;
    return n === 1 ? `${HB().formatOffset(lo, d.size)} (1 byte)` : `${HB().formatOffset(lo, d.size)} to ${HB().formatOffset(hi, d.size)} (${plural(n, 'byte')})`;
  }

  /** Redraw everything that depends on the open file: name, info strip, buttons, the unsaved-changes guard. */
  function refresh() {
    const d = app.doc, T = app.cur, has = !!d;
    $('hx-empty').hidden = has;
    $('hx-scroll').hidden = !has;
    $('hx-info').hidden = !has;
    for (const id of ['hx-save', 'hx-saveas', 'hx-dl', 'hx-goto', 'hx-q', 'hx-next', 'hx-prev']) $(id).disabled = !has;
    if (!has) { $('hx-name').textContent = ''; document.title = 'Slop Hex'; if (window.SlopGuard) SlopGuard.setUnsaved('hex', false); return; }
    const changed = d.changed ? ` · ${plural(d.changed, 'byte')} changed` : '';
    $('hx-name').textContent = `${d.name}${d.dirty() ? ' · unsaved' : ''}${changed}`;
    document.title = `${d.name} · Slop Hex`;
    $('hx-size').textContent = sizeText(d.size);
    $('hx-sel').textContent = selText();
    const sha = $('hx-sha');
    sha.textContent = T.shaBusy ? 'Computing…' : T.sha ? T.sha + (T.shaStale ? ' (before your edits)' : '') : '';
    $('hx-sha-btn').hidden = !T.shaStale;
    if (window.SlopGuard) SlopGuard.setUnsaved('hex', tabs().anyDirty());
    updateType();
  }

  async function updateType() {
    const d = app.doc; if (!d) return;
    const tok = ++app.typeTok;
    const head = await d.readRange(0, Math.min(d.size, 1024));
    if (tok === app.typeTok && app.doc === d) $('hx-type').textContent = HB().guessType(head);
  }

  /** The hash of the open file. Each tab keeps its own, so switching back shows the last one. */
  async function computeSha() {
    const T = app.cur; if (!T) return;
    const tok = ++app.shaTok;
    T.shaBusy = true; refresh();
    try {
      const h = await T.doc.sha256();
      T.sha = h; T.shaStale = false;
    } catch (e) { if (tok === app.shaTok) $('hx-sha').textContent = 'Could not compute: ' + e.message; }
    T.shaBusy = false;
    refresh();
  }

  /** Any byte change: the hash is out of date until it is recalculated, and the strip marks the tab. */
  function changed() {
    if (app.cur) app.cur.shaStale = true;
    tabs().changed(app.cur);
    refresh();
  }

  /** The strip showed a tab: its file is on screen, with its own selection. */
  function activate(T) {
    app.cur = T; app.doc = T.doc;
    app.grid.setDoc(T.doc);
    if (T.sel && T.sel.anchor !== null && T.sel.cursor !== null) app.grid.select(T.sel.anchor, T.sel.cursor);
    app.grid.focus();
    refresh();
    if (!T.sha && !T.shaBusy) computeSha();
  }
  function deactivate(T) {
    if (app.grid && T) T.sel = app.grid.sel();
  }

  /** Is a file of this name and size open in a tab? (A drop of the same file again is not opened twice.) The strip's
   *  record holds the tab (t.doc) and the tab holds the HexDoc (t.doc.doc). */
  function isOpen(file) {
    return !!(tabs().api() && tabs().api().tabs().some((t) => t.doc && t.doc.doc && t.doc.doc.name === file.name && t.doc.doc.size === file.size));
  }
  /** Opens a file in a new tab. A file already open from the same Drive record is shown instead. */
  async function openBlob(blob, { name = 'untitled.bin', driveId = null, version = 1 } = {}) {
    if (driveId && tabs().api()) {
      const open = tabs().api().tabs().find((t) => t.driveId === driveId);
      if (open) { tabs().api().activate(open.doc); return true; }
    }
    const pristine = tabs().current() && tabs().current().doc.size === 0 && !tabs().current().doc.dirty() && !(tabs().api().driveIdOf(tabs().current())) ? tabs().current() : null;
    tabs().open(blob, name, driveId, version);
    if (pristine && tabs().current() !== pristine) tabs().api().close(pristine);
    status(blob.size ? `Opened ${name}` : `${name} is empty`);
    return true;
  }

  async function pickComputer() {
    const files = await SlopUI.pickFiles({ multiple: false });
    if (files && files[0]) await openBlob(files[0], { name: files[0].name });
  }
  /** Open from Slop Drive, through the strip (drive.js): the file opens in a new tab linked to its Drive record. */
  async function pickDrive() {
    const doc = await tabs().api().openFromDrive({ title: 'Open in Slop Hex' });
    if (doc) status(`Opened ${app.doc ? app.doc.name : 'the file'}`);
  }

  /** "photo.bin" -> "photo (v2).bin": the version goes before the extension, and an old version tag is replaced. */
  function versionName(name, n) {
    const dot = name.lastIndexOf('.');
    const ext = dot > 0 ? name.slice(dot) : '';
    const base = (dot > 0 ? name.slice(0, dot) : name).replace(/ \(v\d+\)$/, '');
    return `${base} (v${n})${ext}`;
  }

  /** A new version is a new Drive file beside the one it came from, so nothing is overwritten (this is not the strip's
   * in-place save, which would overwrite the linked file). The tab then follows the new version. */
  async function saveVersion() {
    const T = app.cur; if (!T) return;
    if (!app.driveId) return saveAs();
    const d = T.doc, n = T.version + 1, name = versionName(d.name, n);
    let folderId;
    const prev = await SlopHub.get(app.driveId).catch(() => null);
    if (prev) folderId = prev.folderId;
    const id = await SlopHub.put(d.toBlob(), { name, from: 'hex', folderId, meta: { versionOf: app.driveId, version: n } });
    tabs().api().setDriveId(T, id);
    T.version = n; d.name = name; d.markSaved();
    tabs().changed(T);
    refresh();
    SlopUI.toast(`Saved ${name} to Slop Drive`);
  }

  /** Save as new file: the strip's Save as a new Drive file (drive.js picks the folder). A cancel keeps the link. */
  async function saveAs() {
    const T = app.cur; if (!T) return;
    const api = tabs().api(), prev = api.driveIdOf(T);
    api.setDriveId(T, null);
    const id = await api.saveToDrive(T);
    if (!id) { api.setDriveId(T, prev); return; }
    T.version = 1;
    refresh();
  }

  function download() {
    const d = app.doc; if (!d) return;
    SlopUI.download(d.toBlob(), d.name);
    status(`Downloaded ${d.name}`);
  }

  async function copySel() {
    const d = app.doc, r = selRange();
    if (!d) return;
    if (!r) { status('Select some bytes first'); return; }
    const [lo, hi] = r, n = hi - lo + 1;
    if (n > MB) { status('Select up to 1 MB to copy'); return; }
    const bytes = await d.readRange(lo, n);
    const text = Array.from(bytes, (b) => HB().hexOf(b)).join(' ');
    try { await navigator.clipboard.writeText(text); SlopUI.toast(`Copied ${plural(n, 'byte')} as hex`); }
    catch (e) { SlopUI.toast('Could not copy: ' + e.message); }
  }

  function gotoOffset(text) {
    const d = app.doc; if (!d) return false;
    const r = HB().parseOffset(text, d.size);
    if (r.error) { status(r.error); return false; }
    app.grid.select(r.value, r.value);
    status(`At ${HB().formatOffset(r.value, d.size)}`);
    return true;
  }

  /** Find the next (dir 1) or previous (dir -1) match of the Find box, wrapping at the ends. */
  async function find(dir) {
    const d = app.doc; if (!d) return;
    const q = $('hx-q').value, hex = $('hx-mode').value === 'hex';
    const pat = hex ? HB().parseHex(q) : (q.length ? HB().textBytes(q) : null);
    if (!pat) { status(hex ? 'Enter whole hex bytes, like 4D 5A' : 'Enter some text to find'); return; }
    if (pat.length > d.size) { status('Not found'); return; }
    const tok = ++app.findTok, stop = () => tok !== app.findTok;
    status('Searching…');
    const r0 = selRange();
    let from = dir > 0 ? (r0 ? r0[1] + 1 : 0) : (r0 ? r0[0] - 1 : d.size - 1);
    let r = await d.find(pat, from, dir, stop);
    if (r === null) return;
    let wrapped = false;
    if (r < 0) { wrapped = true; r = await d.find(pat, dir > 0 ? 0 : d.size - 1, dir, stop); if (r === null) return; }
    if (r < 0) { status('Not found'); return; }
    app.grid.select(r, r + pat.length - 1);
    status(`${wrapped ? 'Wrapped. ' : ''}Found at ${HB().formatOffset(r, d.size)} (${plural(pat.length, 'byte')})`);
  }

  function undo() {
    const r = app.doc && app.doc.undo();
    if (!r) { status('Nothing to undo'); return; }
    app.grid.select(r.at, r.at); app.grid.refresh(); changed(); status('Undone');
  }
  function redo() {
    const r = app.doc && app.doc.redo();
    if (!r) { status('Nothing to redo'); return; }
    app.grid.select(r.at, r.at); app.grid.refresh(); changed(); status('Redone');
  }

  window.HexApp = {
    app, status, refresh, changed, isOpen, openBlob, pickComputer, pickDrive, saveVersion, saveAs, download, copySel,
    gotoOffset, find, undo, redo, computeSha, selRange, versionName, activate, deactivate,
    doc: () => app.doc, grid: () => app.grid,
  };
})();
