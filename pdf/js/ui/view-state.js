/* Slop PDF — ui/view-state: coming back to Slop PDF brings back the session you left, and the view it was in: the tool,
 * the page open in the editor, the zoom, the panel and where the page list or page is scrolled. With autosave on
 * (Menu > Autosave session in this browser) the files come back by themselves, so the Restore button is not needed.
 * The view lives in SlopSession; the session itself stays in IndexedDB (io/session.js). Classic script. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, Ed = SP.editor, A = SP.app, S = A._;
  var APP = 'pdf', ready = false; // nothing is saved until the saved view is applied, so boot cannot overwrite it

  function viewNow() {
    var grid = S.els.grid, viewer = S.els.viewer;
    return {
      tool: A.tool, mode: A.mode, pid: Ed.pid || null, zoomMode: Ed.zoomMode, zoom: Ed.zoom,
      noPanel: S.els.app.classList.contains('no-panel'),
      scroll: { grid: grid ? grid.scrollTop : 0, viewer: viewer ? viewer.scrollTop : 0, viewerLeft: viewer ? viewer.scrollLeft : 0 },
    };
  }
  var auto = window.SlopSession.autosave(APP, 'view', viewNow, { delay: 300 });
  var touch = function () { if (ready) auto.touch(); };
  ['pointerup', 'click', 'keyup'].forEach(function (t) { document.addEventListener(t, touch, true); });
  document.addEventListener('wheel', touch, { capture: true, passive: true });

  /** Boot: bring back the saved session (when autosave is on), then the view. */
  A.restoreView = async function () {
    var s = U.store.get('autosave', true) ? await U.idb.get('session').catch(function () { return null; }) : null;
    if (s && s.state && s.state.pages && s.state.pages.length && !E.state.pages.length) {
      try {
        await E.restore(s);
        if (s.fileName) { S.els.fileName.value = s.fileName; S.fileNameTouched = true; }
        S.savedSession = null; S.els.restore.hidden = true;
        A.announce('Session restored: ' + E.state.pages.length + ' pages');
      } catch (e) { console.warn('Slop PDF: restore failed', e); }
    }
    var v = await window.SlopSession.load(APP, 'view', null).catch(function () { return null; });
    if (v && typeof v === 'object' && E.state.pages.length) applyView(v);
    ready = true;
  };

  function applyView(v) {
    if (v.noPanel && window.innerWidth > 900) A.togglePanel(false);
    if (v.tool && typeof v.tool === 'string') A.setTool(v.tool);
    if (v.mode === 'page' && v.pid && E.pageById(v.pid)) {
      A.openPage(v.pid, true);
      if (v.zoomMode === 'num' && v.zoom > 0) { Ed.zoomMode = 'num'; Ed.zoom = v.zoom; Ed.layout(); }
    }
    var sc = v.scroll || {};
    if (S.els.grid && sc.grid) S.els.grid.scrollTop = sc.grid;
    if (S.els.viewer) { if (sc.viewer) S.els.viewer.scrollTop = sc.viewer; if (sc.viewerLeft) S.els.viewer.scrollLeft = sc.viewerLeft; }
  }
})();
