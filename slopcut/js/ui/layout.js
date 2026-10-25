/* SlopCut: workspace layouts (shared/layouts). Mounts the bin, monitor, timeline and inspector on the app grid;
   the top bar and status bar stay where they are. Phones keep the one-column pane tabs, except the Inspector, which is a
   bottom sheet (shared/ui/sheet.js). The suite rule (shared/frame/HANDOFF.md): Export, the main button, sits at the
   inspector's foot (the shared footer, shared/frame/panel.js); on a phone the closed sheet still shows it above the
   tabs. File ▸ Export and Ctrl+E too. Classic script. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const PHONE = '(max-width: 760px)';
  /** Export into the inspector's foot, and the inspector as a phone sheet (main.js calls it once the panes are built). */
  window.SE.app.dockInspector = function () {
    const A = window.SE.app, insp = $('insp'), tab = document.querySelector('.mtab[data-pane="insp"]');
    if (window.SlopSheet) {
      A.inspSheet = SlopSheet.attach({ root: $('app'), panel: insp, side: 'bottom', phone: PHONE, label: 'Inspector', toggles: tab ? [tab] : [],
        onChange: (open) => { if (tab) tab.classList.toggle('on', open); if (!open) document.querySelectorAll('.mtab').forEach((b) => b.classList.toggle('on', b.dataset.pane === $('app').dataset.pane)); } });
    }
    if (window.SlopFramePanel) {
      SlopFramePanel.create(insp, { bare: true }).footer([{ el: $('btnExport'), primary: true, title: 'Export the video (Ctrl+E)' }],
        { more: 'Inspector', onMore: () => A.inspSheet && A.inspSheet.toggle() });
    }
  };
  if (!window.SlopLayouts) return;
  SlopLayouts.mount({
    app: 'slopcut',
    root: $('app'),
    phone: PHONE,
    sizeVars: { timeline: '--tl-h' }, // the timeline's drag handle (app.js) sets this, so the layout follows it
    fixed: { top: [document.querySelector('.topbar')], bottom: [$('status')] },
    panels: {
      bin: { el: $('bin') },
      preview: { el: $('monitor') },
      timeline: { el: $('timeline') },
      insp: { el: $('insp') },
    },
  });
})();
