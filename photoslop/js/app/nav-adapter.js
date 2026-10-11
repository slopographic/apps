/* PhotoSlop navigation presets: the viewport adapter for shared/nav (wheel, pan, touch and keys).
 * Only this file touches the view: the presets, the engine and the dialog live in shared/nav.
 * Loaded after view.js (V, setZoom, fitView, actualPixels, zoomStep, dirty are its globals). */
(function () {
  'use strict';
  const host = document.getElementById('viewport');
  if (!window.SlopNav || !host) return;
  const APP = 'photoslop';
  // The engine's capture listeners run before the app's Space handler (commands.js), and a preset may swallow Space
  // for its own pan. Mirror Space into the app's state here, first, so V.space (read by view.js and the guides) is
  // set under every preset. Keyup needs nothing: main.js's keyup handler clears V.space and is not stopped.
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.repeat || e.ctrlKey || e.metaKey) return;
    if (window.SlopUI && SlopUI.openDialogs) return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || '')) return;
    if (e.target && e.target.isContentEditable) return;
    V.space = true; V.el.classList.add('space');
  }, true);
  SlopNav.attach(APP, {
    title: 'PhotoSlop',
    host,
    adapter: {
      zoomAt: (f, x, y) => setZoom(V.zoom * f, viewPt(x, y)), // x, y are viewport points
      panBy: (dx, dy) => { const d = viewDelta(dx, dy); V.ox += d.x; V.oy += d.y; dirty(); },
      fit: () => fitView(),
      actual: () => actualPixels(),
      zoomStep: (dir, x, y) => zoomStep(dir, viewPt(x, y)),
      // A second finger takes over from a stroke the first finger started.
      cancelStroke: () => { if (V.op) { const t = V.op.tool; if (t.cancel) t.cancel(); V.op = null; dirty(); } },
    },
    shortcuts: SlopNav.shortcutsFrom({ fit: 'Fit on Screen', actual: '100%', zoomIn: 'Zoom In', zoomOut: 'Zoom Out', handTool: 'Hand Tool' }),
  });
  if (window.SlopCmd && SlopCmd.register) {
    SlopCmd.register([{ id: 'ps.nav-preset', title: 'Navigation preset…', group: 'View', keywords: ['navigation', 'zoom', 'pan', 'wheel', 'trackpad', 'touch', 'preset', 'mouse'], keys: [], run: () => SlopNav.openModal(APP) }]);
  }
})();
