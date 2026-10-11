/* Slop EML: app state and actions. Classic script; exposes window.EmlApp. Nothing is uploaded: files are read in this page.
 * Each open message is a doc: { id, name, size, msg (EmlMime.parse result), summary, view: 'html' | 'text', cids: bool }.
 * Listeners (subscribe) run after every change, and the view redraws. */
(function () {
  'use strict';
  const M = window.EmlMime;
  const listeners = [];
  let seq = 0, curId = null;
  const docs = [];
  const notify = () => listeners.forEach((f) => { try { f(); } catch (e) { console.error(e); } });

  const find = (id) => docs.find((d) => d.id === id) || null;
  const current = () => find(curId);

  /** Reads one .eml file and opens it. Resolves with the doc. Throws when the file cannot be read at all. */
  async function openFile(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const msg = M.parse(bytes);
    const doc = {
      id: ++seq, name: file.name || 'message.eml', size: bytes.length, msg, summary: M.summary(msg),
      view: msg.html != null ? 'html' : 'text', cids: false,
    };
    docs.push(doc);
    curId = doc.id;
    notify();
    return doc;
  }
  /** Opens several files in turn. Returns { opened: [names], failed: [{ name, reason }] }. */
  async function openFiles(files) {
    const res = { opened: [], failed: [] };
    for (const f of Array.from(files)) {
      try { await openFile(f); res.opened.push(f.name); } catch (e) { res.failed.push({ name: f.name, reason: (e && e.message) || 'could not be read' }); }
    }
    return res;
  }
  function select(id) { if (find(id)) { curId = id; notify(); } }
  function close(id) {
    const i = docs.findIndex((d) => d.id === id);
    if (i < 0) return;
    docs.splice(i, 1);
    if (curId === id) curId = docs.length ? docs[Math.min(i, docs.length - 1)].id : null;
    notify();
  }
  function step(dir) {
    if (!docs.length) return;
    const i = Math.max(0, docs.findIndex((d) => d.id === curId));
    select(docs[(i + dir + docs.length) % docs.length].id);
  }
  /** Changes the body view of a doc, only to a view the message has. */
  function setView(view, doc = current()) {
    if (!doc) return;
    if (view === 'html' && doc.msg.html == null) return;
    if (view === 'text' && doc.msg.text == null) return;
    doc.view = view;
    notify();
  }
  function toggleCids(doc = current()) {
    if (!doc) return;
    doc.cids = !doc.cids;
    notify();
  }
  /** The bytes of one attachment, as a Blob for download. */
  function attachmentBlob(doc, index) {
    const a = doc.msg.attachments[index];
    return a ? { blob: new Blob([a.bytes], { type: a.type }), name: a.name } : null;
  }

  window.EmlApp = {
    docs: () => docs.slice(),
    current, find, openFile, openFiles, select, close, step, setView, toggleCids, attachmentBlob,
    subscribe(fn) { listeners.push(fn); },
    /** The file name of a doc without .eml, for the PDF and the print title. */
    baseName(doc) { return String(doc.name || 'message').replace(/\.(eml|mail|msg)$/i, '') || 'message'; },
  };
})();
