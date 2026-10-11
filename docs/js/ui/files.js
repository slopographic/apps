/* Slop Docs — ui/files: Slop Drive (open with ?drive=<id>, File ▸ Open, Save and Ctrl+S), the IndexedDB draft
 * that autosaves while you type, and exports (.sdoc, .docx, .md, .txt). Classic script; window.SlopDocs.
 * A native .sdoc record is saved back under its own id with SlopHub.update(): put() with an existing id would
 * reset its folder, so update() is used. A file that came in as DOCX, Markdown or text is saved as a new .sdoc. */
(function () {
  'use strict';
  const S = window.SlopDocs;
  const E = () => window.SlopDocEngine;
  const H = () => window.SlopHub || null;
  const SD = () => E().SD, DX = () => E().DX;
  const SDOC_MIME = 'application/x-slop-doc', DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const ACCEPT = [SDOC_MIME, DOCX_MIME, 'text/markdown', 'text/plain', 'text/html'];
  const toast = (m) => { if (window.SlopUI) SlopUI.toast(m); };

  /* ---------- drafts (IndexedDB 'slop-docs', store 'drafts'): per-browser autosave, never shared ---------- */
  let dbp = null;
  function db() {
    if (!dbp) dbp = new Promise((res, rej) => {
      if (!window.indexedDB) { rej(new Error('IndexedDB is unavailable')); return; }
      const r = indexedDB.open('slop-docs', 2);
      r.onupgradeneeded = (e) => {
        // v1 had 'drafts' only; v2 (oldVersion < 2) adds 'templates'. Existing drafts are kept as they are.
        const d = r.result;
        if (!d.objectStoreNames.contains('drafts')) d.createObjectStore('drafts', { keyPath: 'key' });
        if ((e.oldVersion || 0) < 2 && !d.objectStoreNames.contains('templates')) d.createObjectStore('templates', { keyPath: 'id' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => { dbp = null; rej(r.error); };
    });
    return dbp;
  }
  function store(mode, fn, name = 'drafts') {
    return db().then((d) => new Promise((res, rej) => {
      const t = d.transaction(name, mode), req = fn(t.objectStore(name));
      t.oncomplete = () => res(req ? req.result : undefined);
      t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    }));
  }
  const draftKey = (id) => (id ? 'd:' + id : 'untitled');
  S.draftGet = (key) => store('readonly', (s) => s.get(key)).catch(() => null);
  S.draftPut = (key, rec) => store('readwrite', (s) => s.put(Object.assign({ key }, rec))).catch(() => null);
  S.draftDel = (key) => store('readwrite', (s) => s.delete(key)).catch(() => null);
  /** My templates (IndexedDB 'slop-docs', store 'templates'): the same database as the drafts. */
  S.tplStore = (mode, fn) => store(mode, fn, 'templates');
  let timer = 0;
  function scheduleDraft() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!S.doc || !S.file.dirty) return;
      S.draftPut(draftKey(S.file.id), { doc: S.doc, name: S.file.name, id: S.file.id, folderId: S.file.folderId, dirty: true, time: Date.now() });
    }, 1200);
  }

  /* ---------- reading ---------- */
  function htmlText(t) {
    const d = new DOMParser().parseFromString(t, 'text/html');
    const parts = [...d.body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, pre, blockquote')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);
    return parts.length ? parts.join('\n') : d.body.textContent;
  }
  /** A Drive record → { doc, native }. native: it is a .sdoc, so saving goes back to the same record. */
  async function readRecord(rec) {
    const name = rec.name || '', ext = ((/\.([a-z0-9]+)$/i.exec(name) || [])[1] || '').toLowerCase(), blob = rec.blob;
    const native = ext === 'sdoc' || rec.type === SDOC_MIME;
    if (!blob || !blob.size) {
      if (native) return { doc: E().M.newDoc(), native: true };
      throw new Error('That file is empty');
    }
    if (native) return { doc: SD().readSdoc(await blob.text()), native: true };
    if (rec.type === DOCX_MIME || ext === 'docx') return { doc: await DX().importDocx(blob), native: false };
    if (ext === 'md' || rec.type === 'text/markdown') return { doc: SD().fromMarkdown(await blob.text()), native: false };
    if (ext === 'html' || ext === 'htm' || rec.type === 'text/html') return { doc: SD().fromText(htmlText(await blob.text())), native: false };
    if (rec.type.indexOf('text/') === 0 || ext === 'txt') return { doc: SD().fromText(await blob.text()), native: false };
    throw new Error('Slop Docs cannot open ' + (name || 'this file'));
  }
  const baseName = (n) => String(n || 'Untitled document').replace(/\.(sdoc|docx|md|txt|html?)$/i, '') || 'Untitled document';

  /* ---------- the URL: ?drive=<id> reopens the document ---------- */
  function setUrl(id) {
    try {
      const u = new URL(location.href);
      if (id) u.searchParams.set('drive', id); else u.searchParams.delete('drive');
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch (e) { /* sandboxed */ }
  }
  S.setUrl = setUrl;

  /** Show a record in the editor. Restores a newer unsaved draft of the same record when there is one. */
  S.openRecord = async function (rec, { silent = false } = {}) {
    const r = await readRecord(rec);
    const file = { id: r.native ? rec.id : null, folderId: rec.folderId == null ? null : rec.folderId, name: r.native ? rec.name : baseName(rec.name) + '.sdoc', dirty: false, saved: 0 };
    S.setDoc(r.doc, { file });
    setUrl(r.native ? rec.id : null);
    if (r.native) {
      const d = await S.draftGet(draftKey(rec.id));
      if (d && d.dirty && d.doc && d.time > (rec.modified || 0)) { S.setDoc(E().M.normalizeDoc(d.doc), { file: Object.assign(file, { dirty: true }) }); toast('Restored unsaved changes'); }
    }
    if (!silent) toast(r.native ? `Opened ${baseName(rec.name)}` : `Opened ${rec.name} as a new Slop Docs file`);
    return r;
  };
  /** Restore the untitled draft from this browser, if there is one (no ?drive= launch). */
  S.restoreUntitled = async function () {
    const d = await S.draftGet('untitled');
    if (!d || !d.doc || !d.dirty) return false;
    S.setDoc(E().M.normalizeDoc(d.doc), { file: { id: null, name: d.name || 'Untitled document', dirty: true } });
    toast('Restored your unsaved document');
    return true;
  };

  S.confirmDiscard = async function () {
    if (!S.file.dirty || !window.SlopUI) return true;
    return SlopUI.confirm('Discard unsaved changes?', 'This document has changes that are not saved to Slop Drive yet. Save first, or discard them.', 'Discard', { danger: true });
  };
  S.newDoc = async function () {
    if (!(await S.confirmDiscard())) return;
    S.draftDel('untitled');
    S.setDoc(E().M.newDoc(), { file: { id: null, name: 'Untitled document', dirty: false } });
    setUrl(null);
  };
  S.openFromDrive = async function () {
    if (!H()) { toast('Slop Drive is not available'); return; }
    if (!(await S.confirmDiscard())) return;
    const rec = await H().pickFromDrive({ accept: ACCEPT });
    if (!rec) return;
    try { await S.openRecord(rec); } catch (e) { toast('Could not open: ' + e.message); }
  };
  /** Open a Drive record by id (used by ?drive= on boot). */
  S.openDriveId = async function (id) {
    const rec = H() && (await H().get(id).catch(() => null));
    if (!rec) { toast('That document is no longer in Slop Drive'); return false; }
    H().touch(id);
    try { await S.openRecord(rec, { silent: true }); return true; } catch (e) { toast('Could not open: ' + e.message); return false; }
  };

  /* ---------- saving ---------- */
  S.displayName = () => baseName(S.file.name);
  S.saveName = () => S.displayName() + '.sdoc';
  S.saving = false;
  /** Save to Slop Drive. The first save asks for a folder. Resolves true when saved. */
  S.save = async function () {
    if (!S.doc || S.saving) return false;
    if (!H()) { toast('Slop Drive is not available, so the document stays in this browser'); return false; }
    S.saving = true;
    try {
      const name = S.saveName(), blob = SD().sdocBlob(S.doc);
      let id = S.file.id, done = false;
      if (id) { const r = await H().update(id, { blob, type: SDOC_MIME, name }); if (r) done = true; else id = null; }
      if (!done) {
        const nid = await H().saveToDrive(blob, name, { from: 'docs' });
        if (!nid) return false;
        id = nid;
        if (window.SlopUI) SlopUI.toast('Saved to Slop Drive');
      } else toast('Saved to Slop Drive');
      S.file.id = id; S.file.name = name; S.file.dirty = false; S.file.saved = Date.now();
      setUrl(id);
      S.draftDel(draftKey(id)); S.draftDel('untitled');
      if (window.SlopGuard) SlopGuard.setUnsaved('docs', false);
      S.emit('view');
      return true;
    } catch (e) {
      toast('Could not save: ' + e.message);
      return false;
    } finally { S.saving = false; }
  };
  S.saveLabel = () => {
    if (S.file.dirty) return S.file.id ? 'Unsaved changes' : 'Not saved to Slop Drive yet';
    return S.file.id ? 'Saved to Slop Drive' : 'Draft autosaved in this browser';
  };

  /* ---------- export ---------- */
  /** Blob for a format: sdoc, docx, md or txt. */
  S.exportBlob = async function (kind) {
    if (kind === 'docx') return DX().exportDocx(S.doc);
    if (kind === 'md') return new Blob([SD().toMarkdown(S.doc)], { type: 'text/markdown' });
    if (kind === 'txt') return new Blob([SD().toText(S.doc)], { type: 'text/plain' });
    return SD().sdocBlob(S.doc);
  };
  S.download = async function (kind) {
    const blob = await S.exportBlob(kind), name = S.displayName() + '.' + kind;
    const a = document.createElement('a'), url = URL.createObjectURL(blob);
    a.href = url; a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast(`Downloaded ${name}`);
  };
  /** "Send to…" menu rows for the other Slopographic apps. */
  S.sendItems = function () {
    if (!H()) return [];
    return H().sendMenuItems(() => S.exportBlob('docx'), () => S.displayName() + '.docx', DOCX_MIME);
  };

  /* ---------- wiring ---------- */
  S.on('change', () => {
    if (window.SlopGuard) SlopGuard.setUnsaved('docs', !!S.file.dirty);
    scheduleDraft();
  });
  S.on('doc', () => { if (window.SlopGuard) SlopGuard.setUnsaved('docs', !!S.file.dirty); });
})();
