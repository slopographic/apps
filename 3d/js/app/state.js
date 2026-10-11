/* Slop 3D app state: the document, the selection, the undo history, the file and the view flags.
 * A tiny event hub (on / emit) lets the panels redraw. Sets window.Slop3D.state. */
(function () {
  'use strict';
  const S = (window.Slop3D = window.Slop3D || {});
  const listeners = {};
  const history = S.history.createHistory({ limit: 300 });
  const s = {
    doc: S.model.defaultScene('Untitled'),
    sel: [],
    history,
    file: { name: 'Untitled', driveId: null, folderId: null, dirty: false },
    snapStep: 0,
    view: { wire: false, grid: true, axes: true },
  };
  history.reset(s.doc);

  function on(evt, fn) {
    (listeners[evt] = listeners[evt] || []).push(fn);
    return () => { listeners[evt] = listeners[evt].filter((f) => f !== fn); };
  }
  function emit(evt, arg) { for (const fn of listeners[evt] || []) fn(arg); }
  /** Selects ids (existing nodes only). The last id is the primary one (the inspector shows it). */
  function select(ids) {
    s.sel = [...new Set(ids)].filter((id) => s.doc.nodes[id]);
    emit('sel');
  }
  const primary = () => (s.sel.length ? s.sel[s.sel.length - 1] : null);

  S.state = { s, on, emit, select, primary };
})();
