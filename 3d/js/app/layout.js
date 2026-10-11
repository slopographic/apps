/* Slop 3D: workspace layouts (shared/layouts). Mounts the outliner, viewport and inspector on the .workspace grid;
   the top bar stays put. Below 900 px the stacked phone layout applies, unchanged. Classic script. */
(function () {
  'use strict';
  if (!window.SlopLayouts) return;
  SlopLayouts.mount({
    app: '3d',
    root: document.querySelector('.workspace'),
    phone: '(max-width: 900px)',
    panels: {
      outliner: { el: document.querySelector('.panel-left') },
      viewport: { el: document.querySelector('.viewport') },
      inspector: { el: document.querySelector('.panel-right') },
    },
  });
})();
