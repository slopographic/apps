/* Slop Contacts: open and save the list through Slop Drive (SlopHub). The file is .scontacts (JSON). A vCard or CSV
 * record opens as an unsaved import, so Drive is never overwritten with a different format. A zero-byte .scontacts
 * from Drive's New menu is a blank list that saves back to that record. Launch order: ?drive=<id>, then the draft,
 * then a blank list. Without SlopHub, Save downloads the file. Adds SlopContacts.storage. */
(function () {
  'use strict';
  const SC = window.SlopContacts;
  const S = SC.state;
  const UI = window.SlopUI;
  const hub = () => window.SlopHub || null;
  const isScontacts = (rec) => /\.scontacts$/i.test(rec.name || '') || rec.type === SC.format.MIME;
  const OPENABLE = [SC.format.MIME, 'text/vcard', 'text/csv', 'text/tab-separated-values', 'application/json'];

  /** Ids that repeat within a list get a new id (a hand-edited file or a repeated UID). */
  function uniqueIds(list) {
    const seen = new Set();
    return list.map((c) => { let x = c; if (seen.has(x.id)) x = { ...x, id: SC.model.uid() }; seen.add(x.id); return x; });
  }
  function setUrl(id) {
    try {
      const u = new URL(location.href);
      if (id) u.searchParams.set('drive', id); else u.searchParams.delete('drive');
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch (e) { /* file: or sandboxed URL */ }
  }
  const guard = () => { if (window.SlopGuard) window.SlopGuard.setUnsaved('contacts', S.file.dirty); };
  const markSaved = () => { S.file.dirty = false; S.emit('saved'); S.emit('render'); guard(); };
  const draftState = () => ({ list: S.list, name: S.file.name, driveId: S.file.driveId, folderId: S.file.folderId, cc: S.cc });
  const confirmDiscard = () => (S.file.dirty
    ? UI.confirm('Discard changes?', 'This list has changes that are not saved to Slop Drive. Continue anyway?', 'Continue', { danger: true })
    : Promise.resolve(true));

  /** Make a record the open list. Resolves true when it is open. */
  async function openRecord(rec, { ask = true } = {}) {
    if (!rec) return false;
    if (ask && !(await confirmDiscard())) return false;
    const linked = isScontacts(rec);
    const base = (rec.name || '').replace(/\.[^.]+$/, '') || 'Contacts';
    let contacts;
    try {
      const text = rec.blob && rec.blob.size ? await rec.blob.text() : '';
      contacts = !text.trim() ? [] : linked ? SC.format.fromScontacts(text) : SC.io.parseText(text, rec.name || '').contacts;
    } catch (err) {
      UI.alert('Could not open that file', 'This is not a Slop Contacts file. ' + (err.message && !/JSON/.test(err.message) ? err.message : ''));
      return false;
    }
    S.file = { name: base, driveId: linked ? rec.id : null, folderId: rec.folderId ?? null, dirty: !linked };
    S.sel = new Set(); S.group = null; S.query = '';
    const q = document.getElementById('search'); if (q) q.value = '';
    S.setList(uniqueIds(contacts), { dirty: !linked });
    setUrl(linked ? rec.id : null);
    S.emit('open');
    return true;
  }

  async function openFromDrive() {
    const h = hub();
    if (!h) return;
    const rec = await h.pickFromDrive({ accept: OPENABLE });
    if (rec) await openRecord(rec);
  }
  async function newList() {
    if (!(await confirmDiscard())) return;
    S.file = { name: 'Contacts', driveId: null, folderId: null, dirty: false };
    S.sel = new Set(); S.group = null;
    S.setList([], { dirty: false });
    setUrl(null);
    UI.toast('New list');
  }

  /** Save to the list's Drive record, or ask for a folder the first time. Without Slop Drive it downloads. */
  async function save({ as = false } = {}) {
    const h = hub(), name = `${SC.format.safe(S.file.name)}.${SC.format.EXT}`;
    const blob = new Blob([SC.format.toScontacts(S.list, { cc: S.cc })], { type: SC.format.MIME });
    if (!h) { UI.download(blob, name); markSaved(); return true; }
    try {
      if (S.file.driveId && !as) {
        const prev = await h.get(S.file.driveId);
        await h.put(blob, { id: S.file.driveId, name, from: 'contacts', folderId: prev ? prev.folderId : S.file.folderId });
      } else {
        const folderId = await h.pickFolder({ title: `Save “${name}” to Slop Drive` });
        if (folderId === undefined) return false;
        S.file.driveId = await h.put(blob, { name, from: 'contacts', folderId });
        S.file.folderId = folderId;
        setUrl(S.file.driveId);
      }
      markSaved();
      UI.toast('Saved to Slop Drive');
      return true;
    } catch (err) {
      UI.alert('Could not save', err.message || String(err));
      return false;
    }
  }

  /** Startup. Sets S.ready when done; drafts are written only after this, so an empty start cannot erase one. */
  async function launch() {
    const h = hub();
    if (h) { try { h.register('contacts'); } catch (e) { /* hub without register */ } }
    let rec = null;
    try { rec = h ? await h.consumeLaunch() : null; } catch (e) { rec = null; }
    if (rec && await openRecord(rec, { ask: false })) return;
    let d = null;
    try { d = await SC.drafts.read(); } catch (e) { d = null; }
    if (d && d.json) {
      try {
        S.file = { name: d.name || 'Contacts', driveId: d.driveId || null, folderId: d.folderId ?? null, dirty: true };
        S.setList(uniqueIds(SC.format.fromScontacts(d.json)), { dirty: true });
        UI.toast('Restored your unsaved list');
        return;
      } catch (e) { /* damaged draft: start blank */ }
    }
    S.file = { name: 'Contacts', driveId: null, folderId: null, dirty: false };
    S.setList([], { dirty: false });
  }

  S.on('change', () => { guard(); if (S.ready) SC.drafts.schedule(draftState); });
  S.on('saved', () => { if (S.ready) SC.drafts.writeNow(draftState()); });
  SC.storage = { launch, openRecord, openFromDrive, newList, save, setUrl, draftState, uniqueIds, markSaved };
})();
