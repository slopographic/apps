/* Slop Vector navigation presets: the stage adapter for shared/nav (wheel, pan, touch and keys).
 * Only this file touches the view: the presets, the engine and the dialog live in shared/nav.
 * Loaded after ui/commands.js (S, SV and the stage element are its globals). */
(function () {
  'use strict';
  const host = document.getElementById('stage');
  if (!window.SlopNav || !host) return;
  SlopNav.attach('vector', {
    title: 'Slop Vector',
    host,
    adapter: {
      zoomAt: (f, x, y) => SV.setZoom(S.view.zoom * f, x, y),
      panBy: (dx, dy) => { S.view.x += dx; S.view.y += dy; SV.requestRender(true); if (S.editing) SV.positionEditor(); },
      fit: () => SV.fitArtboard(),
      actual: () => SV.actualSize(),
      zoomStep: (dir, x, y) => SV.zoomStep(dir, x, y),
      // A second finger ends a drag the first finger started (same as Esc does).
      cancelStroke: () => { if (S.op) { SV.revert(); S.op = null; S.marquee = null; S.readout = null; SV.requestRender(true); } },
    },
    shortcuts: SlopNav.shortcutsFrom({ fit: 'Fit Artboard in Window', actual: 'Actual Size', zoomIn: 'Zoom In', zoomOut: 'Zoom Out' }),
  });
})();
