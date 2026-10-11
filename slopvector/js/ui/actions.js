/* SlopVector — ui: the action registry (menus, shortcuts, context menus) */
(function () {
  'use strict';
  var G = window.SVGeom, SV = window.SV, S = SV.state, D = SV.dom, IO = SV.io, C = SV.cmd;
  var clone = SV.clone, getObj = SV.getObj, esc = SV.esc, fmt = G.fmt;
  var abs = Math.abs, min = Math.min, max = Math.max, round = Math.round, PI = Math.PI;
  var UI = SV.ui = SV.ui || {}; UI.st = UI.st || {};
  var IS_MAC = SV.IS_MAC;
  var $ = UI._p = UI._p || {};
  function aboutDialog() { return $.aboutDialog.apply(this, arguments); }
  function applyDock() { return $.applyDock.apply(this, arguments); }
  function applyRulers() { return $.applyRulers.apply(this, arguments); }
  function docSetupDialog() { return $.docSetupDialog.apply(this, arguments); }
  function h() { return $.h.apply(this, arguments); }
  function isPanelVisible() { return $.isPanelVisible.apply(this, arguments); }
  function newDocDialog() { return $.newDocDialog.apply(this, arguments); }
  function pdfDialog() { return $.pdfDialog.apply(this, arguments); }
  function prefsDialog() { return $.prefsDialog.apply(this, arguments); }
  function rasterDialog() { return $.rasterDialog.apply(this, arguments); }
  function saveAsDialog() { return $.saveAsDialog.apply(this, arguments); }
  function savePrefs() { return $.savePrefs.apply(this, arguments); }
  function setTheme() { return $.setTheme.apply(this, arguments); }
  function shortcutsDialog() { return $.shortcutsDialog.apply(this, arguments); }
  function showPanel() { return $.showPanel.apply(this, arguments); }
  function swatches() { return $.swatches.apply(this, arguments); }
  function togglePanels() { return $.togglePanels.apply(this, arguments); }
  function transformDialog() { return $.transformDialog.apply(this, arguments); }

  /* ================= actions ================= */
  var A = SV.actions = {};
  function act(id, label, keys, run, opts) { A[id] = Object.assign({ id: id, label: label, keys: keys || [], run: run }, opts || {}); }
  function hasSel() { return S.sel.length > 0; }
  function hasMulti() { return S.sel.length > 1; }
  function selHas(type) { return SV.selObjs().some(function (o) { return SV.leaves(o).some(function (l) { return l.type === type; }) || o.type === type; }); }
  function togglePref(k, label) { return function () { S.prefs[k] = !S.prefs[k]; savePrefs(); SV.requestRender(true); if (label) UI.toast(label + (S.prefs[k] ? ' on' : ' off')); }; }

  act('file.new', 'New…', ['mod+alt+n'], function () { newDocDialog(); });
  act('file.open', 'Open…', ['mod+o'], function () { IO.pickFile('.svg,image/svg+xml', function (f) { if (f[0]) IO.openFile(f[0]); }); });
  act('file.place', 'Place…', ['mod+shift+p'], function () { IO.pickFile('.svg,image/svg+xml,image/png,image/jpeg,image/gif,image/webp', function (f) { IO.placeFiles(f); }, true); });
  act('file.openDrive', 'Open from Slop Drive…', [], function () { SV.hub.openFromDrive(); });
  act('file.placeDrive', 'Place from Slop Drive…', [], function () { SV.hub.placeFromDrive(); });
  act('file.sample', 'Open Sample: Sloppo', [], function () { SV.loadDoc(SV.sampleDoc(), { fit: true }); SV.commit('sample'); UI.toast('Say hi to Sloppo'); });
  act('file.save', 'Save', ['mod+s'], function () { SV.hub.save(); });
  act('file.saveAs', 'Save As…', ['mod+shift+s'], function () { saveAsDialog(); });
  act('file.exportSVG', 'Export as SVG…', [], function () { IO.exportPlainSVG(); });
  act('file.exportBuffer', 'Export to buffer', [], function () { SV.buffer.exportToBuffer(); });
  act('file.exportPNG', 'Export as PNG…', ['mod+shift+e'], function () { rasterDialog('png'); });
  act('file.exportJPG', 'Export as JPG…', [], function () { rasterDialog('jpg'); });
  act('file.exportPDF', 'Export as PDF…', [], function () { pdfDialog(false); });
  act('file.exportAI', 'Export as .ai (PDF-compatible)…', [], function () { pdfDialog(true); });
  act('file.docSetup', 'Document Setup…', ['mod+alt+p'], function () { docSetupDialog(); });
  act('file.downloadApp', 'Download App (offline .html)', [], function () { IO.downloadApp(); });
  act('file.home', 'Back to Slopographic', [], function () { location.href = '../'; });

  act('edit.undo', 'Undo', ['mod+z'], function () { SV.undo(); }, { enabled: function () { return S.hIdx > 0; } });
  act('edit.redo', 'Redo', ['mod+shift+z'], function () { SV.redo(); }, { enabled: function () { return S.hIdx < S.history.length - 1; } });
  act('edit.cut', 'Cut', ['mod+x'], function () { C.copy(); try { document.execCommand('copy'); } catch (e) { /* ignore */ } C.cut(); }, { enabled: hasSel });
  act('edit.copy', 'Copy', ['mod+c'], function () { C.copy(); try { document.execCommand('copy'); } catch (e) { /* ignore */ } UI.toast('Copied'); }, { enabled: hasSel });
  act('edit.copyBuffer', 'Copy as buffer', [], function () { SV.buffer.copyAsBuffer(); }, { enabled: hasSel });
  act('edit.paste', 'Paste', ['mod+v'], function () {
    if (SV.buffer.pasteIfNewer()) return;
    if (S.clipboard) return C.paste();
    if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(function (t) { if (/<svg[\s>]/i.test(t)) IO.importSVGText(t, { place: true }); else UI.toast('Clipboard is empty'); }).catch(function () { UI.toast('Clipboard is empty'); });
    else UI.toast('Clipboard is empty');
  });
  act('edit.pasteFront', 'Paste in Front', ['mod+f'], function () { C.paste('front'); });
  act('edit.pasteBack', 'Paste in Back', ['mod+b'], function () { C.paste('back'); });
  act('edit.clear', 'Delete', [], function () { C.deleteSel(); }, { enabled: hasSel, keyText: 'Del' });
  act('edit.duplicate', 'Duplicate', ['mod+d'], function () { C.duplicate(); }, { enabled: hasSel });
  act('edit.prefs', 'Preferences…', ['mod+k'], function () { prefsDialog(); });
  act('edit.nav', 'Navigation…', [], function () { SlopNav.openModal('vector'); });

  act('object.group', 'Group', ['mod+g'], function () { C.group(); }, { enabled: hasSel });
  act('object.ungroup', 'Ungroup', ['mod+shift+g'], function () { C.ungroup(); }, { enabled: function () { return SV.selObjs().some(function (o) { return o.type === 'group'; }); } });
  act('arrange.front', 'Bring to Front', ['mod+shift+]'], function () { C.arrange('front'); }, { enabled: hasSel });
  act('arrange.forward', 'Bring Forward', ['mod+]'], function () { C.arrange('forward'); }, { enabled: hasSel });
  act('arrange.backward', 'Send Backward', ['mod+['], function () { C.arrange('backward'); }, { enabled: hasSel });
  act('arrange.back', 'Send to Back', ['mod+shift+['], function () { C.arrange('back'); }, { enabled: hasSel });
  act('transform.move', 'Move…', ['mod+shift+m'], function () { transformDialog('move'); }, { enabled: hasSel });
  act('transform.rotate', 'Rotate…', [], function () { transformDialog('rotate'); }, { enabled: hasSel });
  act('transform.scale', 'Scale…', [], function () { transformDialog('scale'); }, { enabled: hasSel });
  act('transform.reflect', 'Reflect…', [], function () { transformDialog('reflect'); }, { enabled: hasSel });
  act('transform.flipH', 'Flip Horizontal', [], function () { C.flip('h'); }, { enabled: hasSel });
  act('transform.flipV', 'Flip Vertical', [], function () { C.flip('v'); }, { enabled: hasSel });
  act('object.lock', 'Lock Selection', ['mod+2'], function () { C.lockSel(); }, { enabled: hasSel });
  act('object.unlockAll', 'Unlock All', ['mod+alt+2'], function () { C.unlockAll(); });
  act('object.hide', 'Hide Selection', ['mod+3'], function () { C.hideSel(); }, { enabled: hasSel });
  act('object.showAll', 'Show All', ['mod+alt+3'], function () { C.showAll(); });
  act('object.expand', 'Expand Shape to Path', [], function () { C.expand(); }, { enabled: hasSel });
  act('compound.make', 'Make Compound Path', ['mod+8'], function () { C.makeCompound(); }, { enabled: hasSel });
  act('compound.release', 'Release Compound Path', ['mod+alt+shift+8'], function () { C.releaseCompound(); }, { enabled: hasSel });
  act('clip.make', 'Make Clipping Mask', ['mod+7'], function () { C.makeClip(); }, { enabled: function () { return C.canMakeClip(); } });
  act('clip.release', 'Release Clipping Mask', ['mod+alt+7'], function () { C.releaseClip(); }, { enabled: function () { return C.canReleaseClip(); } });
  act('pf.unite', 'Unite', [], function () { C.pathfinder('union'); }, { enabled: hasMulti });
  act('pf.minus', 'Minus Front', [], function () { C.pathfinder('minus'); }, { enabled: hasMulti });
  act('pf.intersect', 'Intersect', [], function () { C.pathfinder('intersect'); }, { enabled: hasMulti });
  act('pf.exclude', 'Exclude', [], function () { C.pathfinder('xor'); }, { enabled: hasMulti });
  act('object.slopify', 'Slopify', ['mod+alt+s'], function () { C.slopify(); }, { enabled: hasSel });

  act('type.alignLeft', 'Align Left', [], function () { SV.applyFont('align', 'left'); }, { checked: function () { return S.font.align === 'left'; } });
  act('type.alignCenter', 'Align Center', [], function () { SV.applyFont('align', 'center'); }, { checked: function () { return S.font.align === 'center'; } });
  act('type.alignRight', 'Align Right', [], function () { SV.applyFont('align', 'right'); }, { checked: function () { return S.font.align === 'right'; } });
  function changeCase(fn) { return function () { var n = 0; SV.selObjs().forEach(function (o) { SV.leaves(o).forEach(function (l) { if (l.type === 'text') { l.text = fn(l.text); n++; } }); }); if (n) SV.commit('case'); else UI.toast('Select text first'); }; }
  act('type.upper', 'UPPERCASE', [], changeCase(function (t) { return t.toUpperCase(); }), { enabled: function () { return selHas('text'); } });
  act('type.lower', 'lowercase', [], changeCase(function (t) { return t.toLowerCase(); }), { enabled: function () { return selHas('text'); } });
  act('type.title', 'Title Case', [], changeCase(function (t) { return t.toLowerCase().replace(/(^|\s)(\S)/g, function (m, a, b) { return a + b.toUpperCase(); }); }), { enabled: function () { return selHas('text'); } });
  act('type.ipsum', 'Fill with Slop Ipsum', [], function () {
    var ip = ['Slop ipsum dolor sit amet, consectetur generative elit.', 'Six fingers, zero regrets, infinite content.', 'Engagement bait aliquam, hallucinatio maxima.'];
    var n = 0; SV.selObjs().forEach(function (o) { SV.leaves(o).forEach(function (l) { if (l.type === 'text') { l.text = ip[n % ip.length]; n++; } }); });
    if (n) SV.commit('ipsum'); else UI.toast('Select a text object first');
  }, { enabled: function () { return selHas('text'); } });

  act('select.all', 'All', ['mod+a'], function () { SV.selectAll(); });
  act('select.none', 'Deselect', ['mod+shift+a'], function () { SV.deselect(); });
  act('select.inverse', 'Inverse', [], function () { C.selectInverse(); });
  act('select.sameFill', 'Same Fill Color', [], function () { C.selectSame('fill'); }, { enabled: hasSel });
  act('select.sameStroke', 'Same Stroke Color', [], function () { C.selectSame('stroke'); }, { enabled: hasSel });
  act('select.layer', 'All on Active Layer', [], function () { C.selectLayer(); });

  act('view.zoomIn', 'Zoom In', ['mod+=', 'mod+shift+='], function () { SV.zoomStep(1); });
  act('view.zoomOut', 'Zoom Out', ['mod+-'], function () { SV.zoomStep(-1); });
  act('view.fit', 'Fit Artboard in Window', ['mod+0', '0'], function () { SV.fitArtboard(true); });
  act('view.actual', 'Actual Size', ['mod+1', '1'], function () { SV.actualSize(true); });
  act('view.outline', 'Outline', ['mod+y'], togglePref('outline'), { checked: function () { return S.prefs.outline; } });
  act('view.rulers', 'Rulers', ['mod+r'], function () { S.prefs.rulers = !S.prefs.rulers; savePrefs(); applyRulers(); SV.requestRender(true); }, { checked: function () { return S.prefs.rulers; } });
  act('view.grid', 'Grid', ["mod+'"], togglePref('grid'), { checked: function () { return S.prefs.grid; } });
  act('view.snapGrid', 'Snap to Grid', ["mod+shift+'"], togglePref('snapGrid', 'Snap to grid'), { checked: function () { return S.prefs.snapGrid; } });
  act('view.smart', 'Smart Guides', ['mod+u'], togglePref('smart', 'Smart guides'), { checked: function () { return S.prefs.smart; } });
  act('view.guides', 'Show Guides', ['mod+;'], togglePref('guides'), { checked: function () { return S.prefs.guides; } });
  act('view.lockGuides', 'Lock Guides', ['mod+alt+;'], togglePref('lockGuides'), { checked: function () { return S.prefs.lockGuides; } });
  act('view.clearGuides', 'Clear Guides', [], function () { S.doc.guides = { h: [], v: [] }; SV.commit('clear guides'); });
  ['pro', 'light', 'classic'].forEach(function (t) {
    act('theme.' + t, { pro: 'Pro (Dark)', light: 'Light', classic: 'Classic 98' }[t], [], function () { setTheme(t); }, { checked: function () { return UI.st.currentTheme === t; } });
  });

  var PANEL_IDS = ['properties', 'appearance', 'layers', 'swatches', 'gradient', 'align', 'pathfinder'];
  var PANEL_NAMES = { properties: 'Properties', appearance: 'Appearance', layers: 'Layers', swatches: 'Swatches', gradient: 'Gradient', align: 'Align', pathfinder: 'Pathfinder' };
  PANEL_IDS.forEach(function (p) { act('window.' + p, PANEL_NAMES[p], [], function () { showPanel(p); }, { checked: function () { return isPanelVisible(p); } }); });
  act('window.togglePanels', 'Show/Hide Panels', [], function () { togglePanels(); }, { keyText: 'Tab', checked: function () { return S.prefs.panels; } });
  act('window.reset', 'Reset Workspace', [], function () { S.prefs.panels = true; UI.st.activeTabs = { a: 'properties', c: 'swatches' }; UI.st.collapsed = {}; savePrefs(); applyDock(); });
  // The colour picker, opened from the fill or stroke chip in the toolbar (the popover is anchored there).
  function editChip(which) { var el = document.querySelector('.fs.' + which); if (el) { S.focus = which; UI.editPaint(which, el); } }
  act('window.fillColor', 'Fill Colour…', [], function () { editChip('fill'); });
  act('window.strokeColor', 'Stroke Colour…', [], function () { editChip('stroke'); });

  act('help.shortcuts', 'Keyboard Shortcuts', ['mod+/'], function () { shortcutsDialog(); }, { keyText: 'F1' });
  act('help.about', 'About SlopVector', [], function () { aboutDialog(); });

  SV.runAction = function (id) {
    var a = A[id]; if (!a) return;
    if (a.enabled && !a.enabled()) return;
    if (S.editing && id.indexOf('type.') !== 0) SV.commitTextEdit();
    a.run();
  };
  SV.keymap = {};
  Object.keys(A).forEach(function (id) { A[id].keys.forEach(function (k) { SV.keymap[k] = id; }); });
  SV.keymap['mod+n'] = 'file.new';
  SV.keymap['mod+shift+/'] = 'help.shortcuts';

  $.A = A; $.PANEL_IDS = PANEL_IDS; $.PANEL_NAMES = PANEL_NAMES; $.act = act;
})();
