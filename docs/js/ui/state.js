/* Slop Docs — ui/state: the open document, its selection, the undo history and the layout. Classic script.
 * Every edit goes through SlopDocs.edit(blocks, sel, kind), which records undo, re-lays out and emits 'change'.
 * Events: 'layout' (new layout), 'sel' (selection moved), 'change' (document changed), 'doc' (document replaced).
 * Exposes window.SlopDocs. */
(function () {
  'use strict';
  const S = (window.SlopDocs = {});
  const ev = {};
  const E = () => window.SlopDocEngine;
  S.on = (n, fn) => { (ev[n] = ev[n] || []).push(fn); };
  S.emit = (n, d) => { for (const fn of ev[n] || []) try { fn(d); } catch (e) { console.error(e); } };

  S.doc = null;
  S.sel = { a: { b: 0, o: 0 }, f: { b: 0, o: 0 } };
  S.pending = null;      // marks for the next typed text when the caret is collapsed (bold on, size 14 …)
  S.layout = null;
  S.zoom = 1;
  S.goalX = null;        // the x an up/down move aims for; cleared by any other move
  S.undoStack = []; S.redoStack = []; S.lastKind = ''; S.lastAt = 0;
  S.file = { id: null, folderId: null, name: 'Untitled document', dirty: false, saved: 0 };

  S.blocks = () => S.doc.blocks;
  S.caret = () => S.sel.f;
  S.isCollapsed = () => E().O.collapsed(S.sel);

  /** Replace the open document. file: { id, folderId, name }. */
  S.setDoc = function (doc, { file, sel, keepHistory } = {}) {
    S.doc = doc;
    S.sel = sel || { a: { b: 0, o: 0 }, f: { b: 0, o: 0 } };
    S.pending = null; S.goalX = null;
    if (!keepHistory) { S.undoStack = []; S.redoStack = []; S.lastKind = ''; }
    S.file = Object.assign({ id: null, folderId: null, name: 'Untitled document', dirty: false, saved: 0 }, file || {});
    S.relayout();
    E().ensureDocFonts(doc).catch(() => {});
    S.emit('doc');
  };
  S.relayout = function () {
    if (!S.doc) return;
    S.layout = E().layoutDoc(S.doc);
    S.emit('layout');
  };
  /** Move the selection to anchor a, focus f. Typing marks are dropped unless keepPending; goal is the x an up/down move aims for. */
  S.select = function (a, f, { keepPending = false, goal = null } = {}) {
    S.sel = { a, f };
    if (!keepPending) S.pending = null;
    S.goalX = goal;
    S.emit('sel');
  };
  /** Record one undoable step. Typing and deleting coalesce while they keep going; replacing a selection starts a new step. */
  function snapshot(kind, replacing) {
    const now = Date.now(), typing = kind === 'type' || kind === 'del';
    if (replacing || !(typing && kind === S.lastKind && now - S.lastAt < 1500)) {
      S.undoStack.push({ blocks: S.doc.blocks, sel: S.sel });
      if (S.undoStack.length > 300) S.undoStack.shift();
    }
    S.redoStack = [];
    S.lastAt = now;
  }
  /** Change the document: blocks and the new selection. Returns false when nothing changed. */
  S.edit = function (blocks, sel, kind = 'edit', { keepPending = false } = {}) {
    const same = blocks === S.doc.blocks && E().O.cmpPos(sel.a, S.sel.a) === 0 && E().O.cmpPos(sel.f, S.sel.f) === 0;
    if (same) return false;
    if (blocks !== S.doc.blocks) snapshot(kind, !E().O.collapsed(S.sel));
    S.lastKind = kind;
    S.doc = Object.assign({}, S.doc, { blocks, meta: Object.assign({}, S.doc.meta, { modified: Date.now() }) });
    S.sel = sel;
    if (!keepPending) S.pending = null;
    S.file.dirty = true;
    S.relayout();
    S.emit('change');
    return true;
  };
  S.undo = function () {
    if (!S.undoStack.length) return;
    S.redoStack.push({ blocks: S.doc.blocks, sel: S.sel });
    const s = S.undoStack.pop();
    S.doc = Object.assign({}, S.doc, { blocks: s.blocks });
    S.sel = s.sel; S.pending = null; S.lastKind = ''; S.file.dirty = true;
    S.relayout(); S.emit('change');
  };
  S.redo = function () {
    if (!S.redoStack.length) return;
    S.undoStack.push({ blocks: S.doc.blocks, sel: S.sel });
    const s = S.redoStack.pop();
    S.doc = Object.assign({}, S.doc, { blocks: s.blocks });
    S.sel = s.sel; S.pending = null; S.lastKind = ''; S.file.dirty = true;
    S.relayout(); S.emit('change');
  };
  S.canUndo = () => S.undoStack.length > 0;
  S.canRedo = () => S.redoStack.length > 0;

  /** Display name without the .sdoc suffix. */
  S.displayName = () => String(S.file.name || 'Untitled document').replace(/\.sdoc$/i, '') || 'Untitled document';

  // Re-lay out when a font finishes loading (its metrics change every line that uses it).
  window.addEventListener('slopdocs:fonts', () => S.relayout());
})();
