/* SlopCut: workspace layouts (shared/layouts). Mounts the bin, monitor, timeline and inspector on the app grid;
   the top bar and status bar stay where they are. Phones keep the one-column pane tabs. Classic script. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  if (!window.SlopLayouts) return;
  SlopLayouts.mount({
    app: 'slopcut',
    root: $('app'),
    phone: '(max-width: 760px)',
    fixed: { top: [document.querySelector('.topbar')], bottom: [$('status')] },
    panels: {
      bin: { el: $('bin') },
      preview: { el: $('monitor') },
      timeline: { el: $('timeline') },
      insp: { el: $('insp') },
    },
  });
})();
