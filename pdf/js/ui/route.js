/* Slop PDF — the URL sections (shared/router) and the view modes (shared/viewmode).
 *   ?tool=<rail tool id>    the tool open in the rail (organize, edit, sign, redact, ...). Default: organize.
 *   ?panel=layers|history   the sidebar dock section to open; the sidebar is shown too.
 * A tool or dock section the person picks is written to the URL (a replace, not a new history entry). Nothing is written
 * before the app is ready, so the link's own values are not replaced during boot. Ctrl+Shift+F cycles the view mode and
 * Ctrl+Shift+L shows hidden regions (shared/viewmode). Classic script: after js/ui/view-state.js, before js/ui/main.js
 * (which boots the app). The other URL parameters (?drive=, ...) are kept as they are. */
(function () {
  'use strict';
  var SP = window.SP, A = SP.app, S = A._, D = SP.dock;
  var PANELS = ['layers', 'history'];
  var TOOLS = S.RAIL.map(function (t) { return t[0]; });
  function ready() { return document.documentElement.classList.contains('ready'); }

  var R = SlopRoute.register('pdf', {
    ready: ready,
    params: {
      tool: { values: TOOLS, def: 'organize' },
      panel: { values: PANELS, def: '' },
    },
    apply: function (s) {
      if (R.has('tool') && s.tool && s.tool !== A.tool) A.setTool(s.tool);
      if (R.has('panel') && s.panel) {
        if (A.togglePanel) A.togglePanel(true);
        if (D && D.setOpen) D.setOpen(s.panel, true);
      }
    },
  });

  // The tool picked by the person (any caller of A.setTool, boot included) goes to the URL once the app is ready.
  var setTool = A.setTool;
  A.setTool = function (t) {
    setTool.apply(this, arguments);
    if (R && ready()) R.set({ tool: A.tool });
  };
  // A dock section the person opens or closes. The URL names the section last opened.
  if (D) D.onToggle = function (id, open) {
    if (!R || !ready()) return;
    if (open) R.set({ panel: id });
    else if (R.get('panel') === id) R.set({ panel: '' });
  };

  SlopViewMode.register('pdf', {
    regions: { toolbar: '.topbar', sidebar: '#rail', panels: '#props' },
    mount: '.topbar',
  });
})();
