/* SlopVector — ui: guide layouts. Wires the shared GuideGuide-style panel (../shared/guides) to the
 * document's guides ({ h: [y…], v: [x…] }), plus New Guide… and Snap to Guides. Guides snap through
 * SV.buildSnap (core/hittest.js), so generated guides snap like hand-made ones. */
(function () {
  'use strict';
  var SV = window.SV, S = SV.state, SG = window.SlopGuides;
  var UI = SV.ui = SV.ui || {};
  var $ = UI._p = UI._p || {};
  var act = $.act;
  function savePrefs() { return $.savePrefs.apply(this, arguments); }

  function list() { return SG.fromHV(S.doc.guides); }
  /** Replace or extend the document's guides with a SlopGuides list; one undo step. */
  SV.applyGuideList = function (gs, mode, label) {
    var next = mode === 'replace' ? SG.normalize(gs) : SG.merge(list(), gs);
    S.doc.guides = SG.toHV(next);
    if (!S.prefs.guides) { S.prefs.guides = true; savePrefs(); }
    SV.commit(label || (mode === 'replace' ? 'replace guides' : 'guide layout'));
  };
  SV.clearGuides = function () { if (!list().length) return; S.doc.guides = { h: [], v: [] }; SV.commit('clear guides'); };

  SV.openGuidePanel = function () {
    if (SG.panel) { SG.panel.close(); return null; }
    return SG.openPanel({
      title: 'Guide Layout', stateKey: 'slopvector.guidePanel',
      targets: [
        { id: 'artboard', label: 'Artboard', rect: function () { return { x: 0, y: 0, w: S.doc.width, h: S.doc.height }; } },
        { id: 'selection', label: 'Selection', rect: function () { var b = S.sel.length ? SV.selBBox(S.sel) : null; return b && b.w > 0 && b.h > 0 ? { x: b.x, y: b.y, w: b.w, h: b.h } : null; } },
      ],
      preview: function (gs) { S.guidePreview = gs; SV.requestRender(); },
      apply: function (gs, o) { SV.applyGuideList(gs, o.mode); },
      clear: function () { SV.clearGuides(); },
      toast: function (m) { UI.toast(m); },
    });
  };

  function newGuideDialog() {
    var U = window.SlopUI;
    var o = U.select([['v', 'Vertical'], ['h', 'Horizontal']], 'v');
    var pos = U.el('input', { type: 'text', class: 'sui-input', value: '50%', spellcheck: 'false', 'aria-label': 'Position' });
    U.dialog({ title: 'New Guide', body: U.el('div', null, U.field('Orientation', o), U.field('Position', pos), U.el('p', { class: 'sui-p' }, 'From the artboard’s top-left corner: px, %, mm, in or pt.')),
      buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, act: function () {
        var len = SG.parseLen(pos.value, 'px');
        if (!len) { UI.toast('Type a position like 120, 50% or 2in'); return false; }
        SV.applyGuideList([{ o: o.value, pos: SG.toPx(len, { ref: o.value === 'v' ? S.doc.width : S.doc.height }) }], 'add', 'guide');
      } }] });
  }

  if (S.prefs.snapGuides == null) S.prefs.snapGuides = true;
  act('view.guideLayout', 'New Guide Layout…', ['mod+alt+shift+;'], function () { SV.openGuidePanel(); }, { checked: function () { return !!SG.panel; } });
  act('view.newGuide', 'New Guide…', [], newGuideDialog);
  act('view.snapGuides', 'Snap to Guides', ['mod+shift+;'], function () { S.prefs.snapGuides = !S.prefs.snapGuides; savePrefs(); UI.toast('Snap to guides ' + (S.prefs.snapGuides ? 'on' : 'off')); }, { checked: function () { return S.prefs.snapGuides !== false; } });
  act('view.guidesFromSel', 'Guides from Selection', [], function () {
    var b = SV.selBBox(S.sel);
    SV.applyGuideList([{ o: 'v', pos: b.x }, { o: 'v', pos: b.x + b.w / 2 }, { o: 'v', pos: b.x + b.w }, { o: 'h', pos: b.y }, { o: 'h', pos: b.y + b.h / 2 }, { o: 'h', pos: b.y + b.h }], 'add', 'guides from selection');
  }, { enabled: function () { return S.sel.length > 0; } });
  $.A['view.clearGuides'].run = function () { SV.clearGuides(); };
  ['view.guideLayout', 'view.snapGuides'].forEach(function (id) { $.A[id].keys.forEach(function (k) { SV.keymap[k] = id; }); });
})();
