/* Slop Hex: the app state and actions (open, save, find, copy, go to, undo). Classic script; exposes window.HexApp.
 * The DOM is read only inside functions, because this script runs before the page body exists. */
(function () {
  'use strict';
  if (window.HexApp) return;
  const $ = (id) => document.getElementById(id);
  const HB = () => window.HexBytes;
  const app = { doc: null, grid: null, driveId: null, version: 1, shaStale: false, shaTok: 0, findTok: 0, typeTok: 0 };
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

  /** Redraw everything that depends on the document: name, info strip, buttons, the unsaved-changes guard. */
  function refresh() {
    const d = app.doc, has = !!d;
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
    sha.textContent = sha.dataset.value ? sha.dataset.value + (app.shaStale ? ' (before your edits)' : '') : '';
    $('hx-sha-btn').hidden = !app.shaStale;
    if (window.SlopGuard) SlopGuard.setUnsaved('hex', d.dirty());
    updateType();
  }

  async function updateType() {
    const d = app.doc; if (!d) return;
    const tok = ++app.typeTok;
    const head = await d.readRange(0, Math.min(d.size, 1024));
    if (tok === app.typeTok && app.doc === d) $('hx-type').textContent = HB().guessType(head);
  }

  async function computeSha() {
    const d = app.doc; if (!d) return;
    const tok = ++app.shaTok, sha = $('hx-sha');
    sha.dataset.value = ''; sha.textContent = 'Computing…';
    try {
      const h = await d.sha256();
      if (tok !== app.shaTok || app.doc !== d) return;
      sha.dataset.value = h; app.shaStale = false;
      refresh();
    } catch (e) { if (tok === app.shaTok) sha.textContent = 'Could not compute: ' + e.message; }
  }

  /** Any byte change: the hash is out of date until it is recalculated. */
  function changed() { app.shaStale = true; refresh(); }

  async function openBlob(blob, { name = 'untitled.bin', driveId = null, version = 1 } = {}) {
    if (app.doc && app.doc.dirty() && !(await SlopUI.confirm('Discard unsaved changes?', 'This file has edits that are not saved to Slop Drive. Open the new file anyway?', 'Open anyway', { danger: true }))) return false;
    const d = HexDoc.create(blob, { name, type: blob.type, crypto: window.crypto });
    app.doc = d; app.driveId = driveId; app.version = version; app.shaStale = false;
    $('hx-sha').dataset.value = '';
    app.grid.setDoc(d);
    refresh();
    computeSha();
    app.grid.focus();
    status(d.size ? `Opened ${name}` : `${name} is empty`);
    return true;
  }

  async function pickComputer() {
    const files = await SlopUI.pickFiles({ multiple: false });
    if (files && files[0]) await openBlob(files[0], { name: files[0].name });
  }
  async function pickDrive() {
    const r = await SlopHub.pickFromDrive({ title: 'Open in Slop Hex' });
    if (r && r.blob) await openBlob(r.blob, { name: r.name, driveId: r.id });
  }

  /** "photo.bin" -> "photo (v2).bin": the version goes before the extension, and an old version tag is replaced. */
  function versionName(name, n) {
    const dot = name.lastIndexOf('.');
    const ext = dot > 0 ? name.slice(dot) : '';
    const base = (dot > 0 ? name.slice(0, dot) : name).replace(/ \(v\d+\)$/, '');
    return `${base} (v${n})${ext}`;
  }

  /** A new version is a new Drive file beside the one it came from, so nothing is overwritten. */
  async function saveVersion() {
    const d = app.doc; if (!d) return;
    if (!app.driveId) return saveAs();
    const n = app.version + 1, name = versionName(d.name, n);
    let folderId;
    const prev = await SlopHub.get(app.driveId).catch(() => null);
    if (prev) folderId = prev.folderId;
    const id = await SlopHub.put(d.toBlob(), { name, from: 'hex', folderId, meta: { versionOf: app.driveId, version: n } });
    app.driveId = id; app.version = n; d.name = name; d.markSaved();
    refresh();
    SlopUI.toast(`Saved ${name} to Slop Drive`);
  }

  /** Save as a new file in a Drive folder the person picks. */
  async function saveAs() {
    const d = app.doc; if (!d) return;
    const id = await SlopHub.saveToDrive(d.toBlob(), d.name, { from: 'hex', title: `Save “${d.name}” to Slop Drive` });
    if (!id) return;
    app.driveId = id; app.version = 1; d.markSaved();
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
    app, status, refresh, changed, openBlob, pickComputer, pickDrive, saveVersion, saveAs, download, copySel,
    gotoOffset, find, undo, redo, computeSha, selRange, versionName,
    doc: () => app.doc, grid: () => app.grid,
  };
})();
