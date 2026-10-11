/* SlopCut — ui/view-state: coming back to SlopCut brings back the project you left (session.js already restores it),
 * and the place you were working in: the timeline zoom and scroll, the tool, and the phone pane. The project and the
 * media stay in this browser (IndexedDB), never uploaded. The place is kept in SlopSession. Classic script; SE.viewState. */
(function () {
  'use strict';
  const SE = window.SE, APP = 'slopedit', PANES = ['media', 'effects', 'insp', 'timeline', 'preview'];
  let ready = false; // nothing is saved until the saved place has been applied
  const TL = () => SE.timeline || null;
  const auto = window.SlopSession.autosave(APP, 'place', function () {
    const t = TL();
    return {
      pps: t ? t.pps : null, scrollX: t ? t.scrollX : 0, scrollY: t ? t.scrollY : 0,
      tool: t ? t.tool : null, pane: SE.app && SE.app.els && SE.app.els.app ? SE.app.els.app.dataset.pane || null : null,
    };
  }, { delay: 500 });
  const touch = function () { if (ready) auto.touch(); };
  ['pointerup', 'keyup', 'click', 'wheel'].forEach(function (t) { document.addEventListener(t, touch, { capture: true, passive: true }); });
  SE.on('tool', touch);

  SE.viewState = {
    /** Boot, after the project is open: the zoom, scroll, tool and pane it was left in. */
    restore: async function () {
      const p = await window.SlopSession.load(APP, 'place', null).catch(function () { return null; });
      const t = TL();
      if (p && typeof p === 'object' && t) {
        if (typeof p.pps === 'number' && p.pps >= 2 && p.pps <= 2400) t.pps = p.pps;
        if (typeof p.scrollX === 'number' && isFinite(p.scrollX)) t.scrollX = Math.max(0, p.scrollX);
        if (typeof p.scrollY === 'number' && isFinite(p.scrollY)) t.scrollY = Math.max(0, p.scrollY);
        if (typeof t.clampScroll === 'function') t.clampScroll();
        if (typeof p.tool === 'string' && t.setTool) t.setTool(p.tool);
        if (typeof t.dirty === 'function') t.dirty();
      }
      if (p && typeof p === 'object' && PANES.includes(p.pane) && SE.app && SE.app.setPane && (window.innerWidth <= 900)) SE.app.setPane(p.pane);
      ready = true;
    },
  };
})();
