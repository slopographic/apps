/* Slop 3D: workspace layouts (shared/layouts). Mounts the outliner, viewport and inspector on the .workspace grid;
   the top bar stays put. Below 900 px the viewport fills the screen and the panels are SlopSheets (shared/ui/sheet.js):
   the Scene outliner a drawer from the left, the Properties a bottom sheet, each opened and closed by its button over the
   viewport, with the shared ×, Escape, a tap outside and a swipe. Classic script. */
(function () {
  'use strict';
  const PHONE = '(max-width: 900px)', $ = (s) => document.querySelector(s);
  if (window.SlopLayouts) {
    SlopLayouts.mount({
      app: '3d',
      root: $('.workspace'),
      phone: PHONE,
      panels: {
        outliner: { el: $('.panel-left') },
        viewport: { el: $('.viewport') },
        inspector: { el: $('.panel-right') },
      },
    });
  }
  if (!window.SlopSheet) return;
  const root = $('.workspace');
  const scene = SlopSheet.attach({ root, panel: $('.panel-left'), side: 'start', phone: PHONE, toggles: [$('#btnScene')], label: 'Scene' });
  const props = SlopSheet.attach({ root, panel: $('.panel-right'), phone: PHONE, toggles: [$('#btnProps')], label: 'Properties' });
  window.Slop3DSheets = { scene, props };   // for the tests
})();
