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

  var linkTool = null, viewing = 0;   // the link's ?tool= and "a view or the link is being applied" (see below)
  var R = SlopRoute.register('pdf', {
    ready: ready,
    params: {
      tool: { values: TOOLS, def: 'organize' },
      panel: { values: PANELS, def: '' },
    },
    apply: function (s) {
      if (R.has('tool') && s.tool && s.tool !== A.tool) { viewing++; try { A.setTool(s.tool); } finally { viewing--; } }
      if (R.has('panel') && s.panel) {
        if (A.togglePanel) A.togglePanel(true);
        if (D && D.setOpen) D.setOpen(s.panel, true);
      }
    },
  });

  // The tool picked by the person (any caller of A.setTool, boot included) goes to the URL once the app is ready.
  // A link's tool (?tool=) outlives the stored tabs: a tab that finishes loading after the page is ready brings back its
  // own view, and the link's tool is put back over it, until the person picks a tool themselves.
  linkTool = R.has('tool') ? R.get('tool') : null;
  var setTool = A.setTool;
  A.setTool = function (t) {
    setTool.apply(this, arguments);
    if (R && ready()) { if (!viewing) linkTool = null; R.set({ tool: A.tool }); }
  };
  var applyView = A.applyView;
  if (applyView) A.applyView = function (v) {
    viewing++;
    try { applyView.apply(this, arguments); } finally { viewing--; }
    if (linkTool && A.tool !== linkTool) { viewing++; try { A.setTool(linkTool); } finally { viewing--; } }
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
