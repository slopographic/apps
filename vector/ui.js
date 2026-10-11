/* Slop Vector — UI: menus, actions, toolbar, control bar, panels, dialogs, color picker,
   rulers, status bar, themes, sample document and app init. */
(function () {
  'use strict';
  var G = window.SVGeom, SV = window.SV, S = SV.state, D = SV.dom, IO = SV.io, C = SV.cmd;
  var clone = SV.clone, getObj = SV.getObj, esc = SV.esc, fmt = G.fmt;
  var abs = Math.abs, min = Math.min, max = Math.max, round = Math.round, PI = Math.PI;
  var UI = SV.ui = {};
  var IS_MAC = SV.IS_MAC;

  /* ================= DOM helper ================= */
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k]; if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.keys(v).forEach(function (s) { el.style.setProperty(s, v[s]); });
      else el.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c != null && c !== false) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }
  UI.h = h;
  function svgIcon(inner, cls) { return '<svg viewBox="0 0 24 24" class="' + (cls || 'ic') + '" aria-hidden="true">' + inner + '</svg>'; }
  var I = {
    eye: svgIcon('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>'),
    eyeOff: svgIcon('<path d="M3 3l18 18M10.6 6c.5-.1.9-.1 1.4-.1 6 0 9.5 6.1 9.5 6.1a17 17 0 0 1-2.6 3.3M6.5 7.3C4 9 2.5 12 2.5 12S6 18.5 12 18.5c1.9 0 3.5-.6 4.9-1.5"/>'),
    lock: svgIcon('<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
    unlock: svgIcon('<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 7.6-1.7"/>'),
    plus: svgIcon('<path d="M12 5v14M5 12h14"/>'),
    trash: svgIcon('<path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/>'),
    caret: svgIcon('<path d="M9 6l6 6-6 6"/>'),
    folder: svgIcon('<path d="M3 7h6l2 2h10v10H3z"/>'),
    link: svgIcon('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
    flipH: svgIcon('<path d="M12 3v18M9 7L4 17h5zM15 7l5 10h-5z"/>'),
    flipV: svgIcon('<path d="M3 12h18M7 9L17 4v5zM7 15l10 5v-5z"/>'),
    alignL: svgIcon('<path d="M4 3v18"/><rect x="7" y="6" width="12" height="4"/><rect x="7" y="14" width="7" height="4"/>'),
    alignHC: svgIcon('<path d="M12 3v18"/><rect x="5" y="6" width="14" height="4"/><rect x="8" y="14" width="8" height="4"/>'),
    alignR: svgIcon('<path d="M20 3v18"/><rect x="5" y="6" width="12" height="4"/><rect x="10" y="14" width="7" height="4"/>'),
    alignT: svgIcon('<path d="M3 4h18"/><rect x="6" y="7" width="4" height="12"/><rect x="14" y="7" width="4" height="7"/>'),
    alignVC: svgIcon('<path d="M3 12h18"/><rect x="6" y="5" width="4" height="14"/><rect x="14" y="8" width="4" height="8"/>'),
    alignB: svgIcon('<path d="M3 20h18"/><rect x="6" y="5" width="4" height="12"/><rect x="14" y="10" width="4" height="7"/>'),
    distH: svgIcon('<path d="M4 4v16M20 4v16M12 4v16"/><rect x="9.5" y="8" width="5" height="8"/>'),
    distV: svgIcon('<path d="M4 4h16M4 20h16M4 12h16"/><rect x="8" y="9.5" width="8" height="5"/>'),
    spaceH: svgIcon('<rect x="3" y="7" width="4" height="10"/><rect x="10" y="7" width="4" height="10"/><rect x="17" y="7" width="4" height="10"/>'),
    spaceV: svgIcon('<rect x="7" y="3" width="10" height="4"/><rect x="7" y="10" width="10" height="4"/><rect x="7" y="17" width="10" height="4"/>'),
    unite: svgIcon('<path d="M4 4h10v6h6v10H10v-6H4z" class="f"/>', 'ic-fill'),
    minus: svgIcon('<path d="M4 4h10v6h-4v4H4z" class="f"/><path d="M10 10h10v10H10z" class="o"/>', 'ic-mix'),
    intersect: svgIcon('<path d="M4 4h10v10H4zM10 10h10v10H10z" class="o"/><path d="M10 10h4v4h-4z" class="f"/>', 'ic-mix'),
    exclude: svgIcon('<path d="M4 4h10v6h-4v4H4zM14 10h6v10H10v-6h4z" class="f"/><path d="M10 10h4v4h-4z" class="o"/>', 'ic-mix'),
    capButt: svgIcon('<path d="M6 12h12" stroke-width="7" stroke-linecap="butt" class="thick"/><path d="M6 4v16" class="thin"/>'),
    capRound: svgIcon('<path d="M8 12h10" stroke-width="7" stroke-linecap="round" class="thick"/><path d="M8 4v16" class="thin"/>'),
    capSquare: svgIcon('<path d="M8 12h10" stroke-width="7" stroke-linecap="square" class="thick"/><path d="M8 4v16" class="thin"/>'),
    joinMiter: svgIcon('<path d="M5 19V6h13" stroke-width="5" stroke-linejoin="miter" class="thick"/>'),
    joinRound: svgIcon('<path d="M5 19V6h13" stroke-width="5" stroke-linejoin="round" class="thick"/>'),
    joinBevel: svgIcon('<path d="M5 19V6h13" stroke-width="5" stroke-linejoin="bevel" class="thick"/>'),
    txtL: svgIcon('<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>'),
    txtC: svgIcon('<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>'),
    txtR: svgIcon('<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>'),
    swap: svgIcon('<path d="M7 4h9a4 4 0 0 1 4 4v9M17 14l3 3 3-3M7 4l3-3M7 4l3 3" />'),
    drop: '<svg viewBox="0 0 32 32" class="brand-mark" aria-hidden="true"><path d="M16 2C16 2 6 13.5 6 20a10 10 0 0 0 20 0C26 13.5 16 2 16 2z"/><path class="shine" d="M11.5 20.5a4.5 4.5 0 0 0 3.5 4.4"/></svg>',
    panels: svgIcon('<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M15 4v16M17.5 8h1.5M17.5 11h1.5"/>'),
    menu: svgIcon('<path d="M4 7h16M4 12h16M4 17h16"/>'),
    slop: svgIcon('<path d="M4 9c0-3 3-5 8-5s8 2 8 5v4c0 1-1 1.5-1.5 1.5S17 14 17 15v3a1.5 1.5 0 0 1-3 0v-2c0-.8-1-.8-1 0v4a1.5 1.5 0 0 1-3 0v-5c0-.8-1-.8-1 0v1a1.5 1.5 0 0 1-3 0v-2.5C5 13 4 12.5 4 11z"/>')
  };
  UI.I = I;

  /* ================= toasts (shared SlopUI kit) ================= */
  UI.toast = function (msg, kind) { if (window.SlopUI) window.SlopUI.toast(String(msg), kind === 'warn' ? 4200 : 2600); };

  /* ================= keys display ================= */
  function keyLabel(combo) {
    if (!combo) return '';
    return combo.split('+').map(function (p) {
      if (p === 'mod') return IS_MAC ? '⌘' : 'Ctrl';
      if (p === 'alt') return IS_MAC ? '⌥' : 'Alt';
      if (p === 'shift') return IS_MAC ? '⇧' : 'Shift';
      if (p === '=') return '+';
      if (p === 'delete') return 'Del';
      return p.length === 1 ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1);
    }).join(IS_MAC ? '' : '+');
  }
  UI.keyLabel = keyLabel;

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
  act('file.sample', 'Open Sample: Sloppo', [], function () { SV.loadDoc(SV.sampleDoc(), { fit: true }); SV.commit('sample'); UI.toast('Say hi to Sloppo'); });
  act('file.save', 'Save', ['mod+s'], function () { IO.saveSVG(); });
  act('file.saveAs', 'Save As…', ['mod+shift+s'], function () { saveAsDialog(); });
  act('file.exportSVG', 'Export as SVG…', [], function () { IO.exportPlainSVG(); });
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
  act('edit.paste', 'Paste', ['mod+v'], function () {
    if (S.clipboard) return C.paste();
    if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(function (t) { if (/<svg[\s>]/i.test(t)) IO.importSVGText(t, { place: true }); else UI.toast('Clipboard is empty'); }).catch(function () { UI.toast('Clipboard is empty'); });
    else UI.toast('Clipboard is empty');
  });
  act('edit.pasteFront', 'Paste in Front', ['mod+f'], function () { C.paste('front'); });
  act('edit.pasteBack', 'Paste in Back', ['mod+b'], function () { C.paste('back'); });
  act('edit.clear', 'Delete', [], function () { C.deleteSel(); }, { enabled: hasSel, keyText: 'Del' });
  act('edit.duplicate', 'Duplicate', ['mod+d'], function () { C.duplicate(); }, { enabled: hasSel });
  act('edit.prefs', 'Preferences…', ['mod+k'], function () { prefsDialog(); });

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
  act('view.fit', 'Fit Artboard in Window', ['mod+0'], function () { SV.fitArtboard(); });
  act('view.actual', 'Actual Size', ['mod+1'], function () { SV.actualSize(); });
  act('view.outline', 'Outline', ['mod+y'], togglePref('outline'), { checked: function () { return S.prefs.outline; } });
  act('view.rulers', 'Rulers', ['mod+r'], function () { S.prefs.rulers = !S.prefs.rulers; savePrefs(); applyRulers(); SV.requestRender(true); }, { checked: function () { return S.prefs.rulers; } });
  act('view.grid', 'Grid', ["mod+'"], togglePref('grid'), { checked: function () { return S.prefs.grid; } });
  act('view.snapGrid', 'Snap to Grid', ["mod+shift+'"], togglePref('snapGrid', 'Snap to grid'), { checked: function () { return S.prefs.snapGrid; } });
  act('view.smart', 'Smart Guides', ['mod+u'], togglePref('smart', 'Smart guides'), { checked: function () { return S.prefs.smart; } });
  act('view.guides', 'Show Guides', ['mod+;'], togglePref('guides'), { checked: function () { return S.prefs.guides; } });
  act('view.lockGuides', 'Lock Guides', ['mod+alt+;'], togglePref('lockGuides'), { checked: function () { return S.prefs.lockGuides; } });
  act('view.clearGuides', 'Clear Guides', [], function () { S.doc.guides = { h: [], v: [] }; SV.commit('clear guides'); });
  ['pro', 'light', 'classic'].forEach(function (t) {
    act('theme.' + t, { pro: 'Pro (Dark)', light: 'Light', classic: 'Classic 98' }[t], [], function () { setTheme(t); }, { checked: function () { return currentTheme === t; } });
  });

  var PANEL_IDS = ['properties', 'appearance', 'layers', 'swatches', 'gradient', 'align', 'pathfinder'];
  var PANEL_NAMES = { properties: 'Properties', appearance: 'Appearance', layers: 'Layers', swatches: 'Swatches', gradient: 'Gradient', align: 'Align', pathfinder: 'Pathfinder' };
  PANEL_IDS.forEach(function (p) { act('window.' + p, PANEL_NAMES[p], [], function () { showPanel(p); }, { checked: function () { return isPanelVisible(p); } }); });
  act('window.togglePanels', 'Show/Hide Panels', [], function () { togglePanels(); }, { keyText: 'Tab', checked: function () { return S.prefs.panels; } });
  act('window.reset', 'Reset Workspace', [], function () { S.prefs.panels = true; activeTabs = { a: 'properties', c: 'swatches' }; collapsed = {}; savePrefs(); applyDock(); });

  act('help.shortcuts', 'Keyboard Shortcuts', ['mod+/'], function () { shortcutsDialog(); }, { keyText: 'F1' });
  act('help.about', 'About Slop Vector', [], function () { aboutDialog(); });

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

  /* ================= menus ================= */
  var MENUS = [
    { label: 'File', items: ['file.new', 'file.open', 'file.sample', '-', 'file.place', '-', 'file.save', 'file.saveAs', { label: 'Export', items: ['file.exportSVG', 'file.exportPNG', 'file.exportJPG', 'file.exportPDF', 'file.exportAI'] }, '-', 'file.docSetup', '-', 'file.downloadApp', '-', 'file.home'] },
    { label: 'Edit', items: ['edit.undo', 'edit.redo', '-', 'edit.cut', 'edit.copy', 'edit.paste', 'edit.pasteFront', 'edit.pasteBack', 'edit.clear', '-', 'edit.duplicate', 'select.all', 'select.none', '-', 'edit.prefs'] },
    { label: 'Object', items: [{ label: 'Transform', items: ['transform.move', 'transform.rotate', 'transform.scale', 'transform.reflect', '-', 'transform.flipH', 'transform.flipV'] }, { label: 'Arrange', items: ['arrange.front', 'arrange.forward', 'arrange.backward', 'arrange.back'] }, '-', 'object.group', 'object.ungroup', '-', 'object.lock', 'object.unlockAll', 'object.hide', 'object.showAll', '-', 'object.expand', { label: 'Compound Path', items: ['compound.make', 'compound.release'] }, { label: 'Pathfinder', items: ['pf.unite', 'pf.minus', 'pf.intersect', 'pf.exclude'] }, '-', 'object.slopify'] },
    { label: 'Type', items: [{ label: 'Font', dyn: 'fonts' }, { label: 'Size', dyn: 'sizes' }, { label: 'Weight', dyn: 'weights' }, '-', 'type.alignLeft', 'type.alignCenter', 'type.alignRight', '-', { label: 'Change Case', items: ['type.upper', 'type.lower', 'type.title'] }, 'type.ipsum'] },
    { label: 'Select', items: ['select.all', 'select.none', 'select.inverse', '-', { label: 'Same', items: ['select.sameFill', 'select.sameStroke'] }, 'select.layer'] },
    { label: 'View', items: ['view.outline', '-', 'view.zoomIn', 'view.zoomOut', 'view.fit', 'view.actual', '-', 'view.rulers', 'view.grid', 'view.snapGrid', 'view.smart', '-', 'view.guides', 'view.lockGuides', 'view.clearGuides', '-', { label: 'Theme', items: ['theme.pro', 'theme.light', 'theme.classic'] }] },
    { label: 'Window', items: PANEL_IDS.map(function (p) { return 'window.' + p; }).concat(['-', 'window.togglePanels', 'window.reset']) },
    { label: 'Help', items: ['help.shortcuts', 'help.about', '-', 'file.home'] }
  ];
  function dynItems(kind) {
    if (kind === 'fonts') return Object.keys(SV.FONTS).map(function (f) { return { label: f, run: function () { SV.applyFont('family', f); }, checked: function () { return curFont().family === f; }, font: f }; });
    if (kind === 'sizes') return [8, 10, 12, 14, 18, 24, 36, 48, 72, 96, 144].map(function (s) { return { label: s + ' px', run: function () { SV.applyFont('size', s); }, checked: function () { return curFont().size === s; } }; });
    if (kind === 'weights') return [[300, 'Light'], [400, 'Regular'], [500, 'Medium'], [600, 'Semibold'], [700, 'Bold'], [800, 'Extra Bold'], [900, 'Black']].map(function (w) { return { label: w[1] + ' (' + w[0] + ')', run: function () { SV.applyFont('weight', w[0]); }, checked: function () { return +curFont().weight === w[0]; } }; });
    return [];
  }
  function curFont() { var t = firstOfType('text'); return t ? t.font : S.font; }
  var openMenu = null;
  UI.closeMenus = function () {
    var layer = document.getElementById('menuLayer');
    if (openMenu === null) return false;
    layer.innerHTML = ''; openMenu = null;
    document.querySelectorAll('.menu-btn.open').forEach(function (b) { b.classList.remove('open'); b.setAttribute('aria-expanded', 'false'); });
    return true;
  };
  function buildMenuList(items, level) {
    var list = h('div', { class: 'menu-list', role: 'menu' });
    items.forEach(function (it) {
      if (it === '-') { list.appendChild(h('div', { class: 'menu-sep', role: 'separator' })); return; }
      var a, label, keys, enabled = true, checked = null, run, sub = null;
      if (typeof it === 'string') { a = A[it]; if (!a) return; label = a.label; keys = a.keyText || keyLabel(a.keys[0]); enabled = !a.enabled || a.enabled(); checked = a.checked ? a.checked() : null; run = function () { SV.runAction(it); }; }
      else if (it.items || it.dyn) { label = it.label; sub = it.items || dynItems(it.dyn); }
      else { label = it.label; run = it.run; checked = it.checked ? it.checked() : null; }
      var row = h('div', { class: 'menu-item' + (enabled ? '' : ' disabled') + (sub ? ' has-sub' : ''), role: 'menuitem', tabindex: '-1', 'aria-disabled': enabled ? null : 'true', 'data-action': typeof it === 'string' ? it : null },
        [h('span', { class: 'mi-check', text: checked ? '✓' : '' }), h('span', { class: 'mi-label', text: label, style: it.font ? { 'font-family': SV.fontStack(it.font) } : null }), h('span', { class: 'mi-key', text: sub ? '' : (keys || '') }), sub ? h('span', { class: 'mi-arrow', html: I.caret }) : null]);
      if (sub) {
        var openSub = function () {
          Array.prototype.forEach.call(list.querySelectorAll(':scope > .menu-item > .menu-list'), function (l) { if (l.parentNode !== row) l.remove(); });
          list.querySelectorAll(':scope > .menu-item.sub-open').forEach(function (r) { if (r !== row) r.classList.remove('sub-open'); });
          if (row.querySelector('.menu-list')) return;
          var sl = buildMenuList(sub, level + 1); sl.classList.add('submenu'); row.appendChild(sl); row.classList.add('sub-open');
          var rr = sl.getBoundingClientRect();
          if (rr.right > window.innerWidth - 4) { sl.classList.add('left'); }
          if (rr.bottom > window.innerHeight - 4) sl.style.top = Math.max(-rr.top + 4, window.innerHeight - 4 - rr.bottom) + 'px';
        };
        row.addEventListener('mouseenter', openSub);
        row.addEventListener('click', function (e) { e.stopPropagation(); openSub(); });
      } else {
        row.addEventListener('mouseenter', function () {
          list.querySelectorAll(':scope > .menu-item.sub-open').forEach(function (r) { r.classList.remove('sub-open'); var l = r.querySelector('.menu-list'); if (l) l.remove(); });
        });
        if (enabled) row.addEventListener('click', function (e) { e.stopPropagation(); UI.closeMenus(); run(); });
      }
      list.appendChild(row);
    });
    return list;
  }
  function openMenuAt(btn, idx) {
    UI.closeMenus();
    var layer = document.getElementById('menuLayer');
    var list = buildMenuList(MENUS[idx].items, 0); list.classList.add('dropdown');
    layer.appendChild(list);
    var r = btn.getBoundingClientRect();
    var left = min(r.left, window.innerWidth - list.offsetWidth - 4);
    list.style.left = max(4, left) + 'px'; list.style.top = r.bottom + 'px';
    list.style.maxHeight = (window.innerHeight - r.bottom - 8) + 'px';
    btn.classList.add('open'); btn.setAttribute('aria-expanded', 'true');
    openMenu = idx;
  }
  function buildMenubar() {
    var nav = document.getElementById('menus');
    MENUS.forEach(function (m, i) {
      var b = h('button', { class: 'menu-btn', type: 'button', 'aria-haspopup': 'true', 'aria-expanded': 'false', text: m.label, 'data-menu': m.label });
      b.addEventListener('pointerdown', function (e) { e.preventDefault(); if (openMenu === i) UI.closeMenus(); else openMenuAt(b, i); });
      b.addEventListener('mouseenter', function () { if (openMenu !== null && openMenu !== i) openMenuAt(b, i); });
      b.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); openMenuAt(b, i); } });
      nav.appendChild(b);
    });
    document.addEventListener('pointerdown', function (e) {
      if (openMenu === null) return;
      if (e.target.closest && (e.target.closest('#menuLayer') || e.target.closest('.menu-btn'))) return;
      UI.closeMenus();
    }, true);
    window.addEventListener('resize', function () { UI.closeMenus(); });
  }

  /* ================= paint helpers ================= */
  function gradCSS(g) {
    var stops = g.stops.slice().sort(function (a, b) { return a.o - b.o; }).map(function (s) { return rgba(s.c, s.a == null ? 1 : s.a) + ' ' + round(s.o * 100) + '%'; }).join(', ');
    if (g.type === 'radial') return 'radial-gradient(circle at ' + round((g.fx != null ? g.fx : g.cx) * 100) + '% ' + round((g.fy != null ? g.fy : g.cy) * 100) + '%, ' + stops + ')';
    var ang = Math.atan2((g.y2 - g.y1), (g.x2 - g.x1)) * 180 / PI + 90;
    return 'linear-gradient(' + round(ang) + 'deg, ' + stops + ')';
  }
  UI.gradCSS = gradCSS;
  function rgba(hex, a) { var c = hexToRgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function paintBG(el, p) {
    el.classList.toggle('none', !p);
    el.style.background = !p ? '' : typeof p === 'string' ? p : gradCSS(p);
  }
  UI.paintBG = paintBG;
  function paintLabel(p) { if (!p) return 'None'; if (typeof p === 'string') return p.toUpperCase(); return (p.type === 'radial' ? 'Radial' : 'Linear') + ' gradient'; }

  /* ================= colour conversions & picker ================= */
  function hexToRgb(hex) {
    hex = String(hex || '#000').replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(hex.slice(0, 6), 16); if (isNaN(n)) n = 0;
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  function rgbToHex(r, g, b) { return '#' + [r, g, b].map(function (v) { return ('0' + SV.clamp(round(v), 0, 255).toString(16)).slice(-2); }).join(''); }
  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var mx = max(r, g, b), mn = min(r, g, b), d = mx - mn, hh = 0;
    if (d) { if (mx === r) hh = ((g - b) / d) % 6; else if (mx === g) hh = (b - r) / d + 2; else hh = (r - g) / d + 4; hh *= 60; if (hh < 0) hh += 360; }
    return [hh, mx ? d / mx : 0, mx];
  }
  function hsvToRgb(hh, s, v) {
    var c = v * s, x = c * (1 - abs((hh / 60) % 2 - 1)), m = v - c, r = 0, g = 0, b = 0;
    if (hh < 60) { r = c; g = x; } else if (hh < 120) { r = x; g = c; } else if (hh < 180) { g = c; b = x; } else if (hh < 240) { g = x; b = c; } else if (hh < 300) { r = x; b = c; } else { r = c; b = x; }
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
  }
  UI.hexToRgb = hexToRgb; UI.rgbToHex = rgbToHex;
  var picker = null, recent = [];
  try { recent = JSON.parse(SV.lsGet('slopvector.recentColors') || '[]') || []; } catch (e) { recent = []; }
  UI.closePicker = function (cancel) {
    if (!picker) return false;
    var p = picker; picker = null;
    p.el.remove();
    document.removeEventListener('pointerdown', p.outside, true);
    if (!cancel && p.changed && p.hex) {
      recent = [p.hex].concat(recent.filter(function (c) { return c !== p.hex; })).slice(0, 12);
      SV.lsSet('slopvector.recentColors', JSON.stringify(recent));
    }
    if (p.onDone) p.onDone(cancel ? undefined : p.value, p.changed);
    return true;
  };
  // opts: {allowNone, title}
  UI.pickColor = function (anchor, initial, onInput, onDone, opts) {
    UI.closePicker();
    opts = opts || {};
    var hex = typeof initial === 'string' ? initial : (initial && initial.stops ? initial.stops[0].c : '#d4ff3a');
    var hsv = rgbToHsv.apply(null, hexToRgb(hex));
    var el = h('div', { class: 'picker', role: 'dialog', 'aria-label': opts.title || 'Color picker' });
    var head = h('div', { class: 'picker-head' }, [h('span', { text: opts.title || 'Color' }), h('button', { class: 'xbtn', type: 'button', 'aria-label': 'Close', html: '&times;', onclick: function () { UI.closePicker(); } })]);
    var sv = h('div', { class: 'pk-sv' }), svDot = h('div', { class: 'pk-dot' }); sv.appendChild(svDot);
    var hue = h('div', { class: 'pk-hue' }), hueDot = h('div', { class: 'pk-hdot' }); hue.appendChild(hueDot);
    var prev = h('div', { class: 'pk-prev' });
    var hexIn = h('input', { class: 'pk-hex mono', type: 'text', maxlength: '7', spellcheck: 'false', 'aria-label': 'Hex color' });
    var rIn = h('input', { class: 'mono', type: 'number', min: 0, max: 255, 'aria-label': 'Red' }), gIn = h('input', { class: 'mono', type: 'number', min: 0, max: 255, 'aria-label': 'Green' }), bIn = h('input', { class: 'mono', type: 'number', min: 0, max: 255, 'aria-label': 'Blue' });
    var sw = h('div', { class: 'pk-swatches' });
    var palette = ['#0a0a0a', '#ffffff', '#f1ede4', '#d4ff3a', '#ff3d8b', '#7a5cff', '#00c2b8', '#ff8a00', '#ffe14d', '#3a7bff', '#ff4d4d', '#2ecc71'];
    function swatchBtn(c) { var b = h('button', { class: 'pk-sw', type: 'button', title: c, style: { background: c } }); b.addEventListener('click', function () { setHex(c, true); }); return b; }
    palette.concat(recent.filter(function (c) { return palette.indexOf(c) < 0; }).slice(0, 6)).forEach(function (c) { sw.appendChild(swatchBtn(c)); });
    var row = h('div', { class: 'pk-row' }, [prev, h('label', { class: 'pk-l' }, ['#', hexIn]), h('label', { class: 'pk-l' }, ['R', rIn]), h('label', { class: 'pk-l' }, ['G', gIn]), h('label', { class: 'pk-l' }, ['B', bIn])]);
    var foot = h('div', { class: 'pk-foot' });
    if (opts.allowNone) foot.appendChild(h('button', { class: 'btn small', type: 'button', text: 'None', onclick: function () { st.value = null; st.changed = true; onInput && onInput(null); UI.closePicker(); } }));
    if (opts.allowGradient) foot.appendChild(h('button', { class: 'btn small', type: 'button', text: 'Gradient…', onclick: function () { UI.closePicker(); opts.allowGradient(); } }));
    foot.appendChild(h('span', { class: 'grow' }));
    foot.appendChild(h('button', { class: 'btn small primary', type: 'button', text: 'Done', onclick: function () { UI.closePicker(); } }));
    el.appendChild(head); el.appendChild(sv); el.appendChild(hue); el.appendChild(row); el.appendChild(sw); el.appendChild(foot);
    document.body.appendChild(el);
    var st = { el: el, hex: hex, value: initial, changed: false, onDone: onDone };
    function paint(fire) {
      var rgb = hsvToRgb(hsv[0], hsv[1], hsv[2]); hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
      sv.style.background = 'linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, hsl(' + hsv[0] + ',100%,50%))';
      svDot.style.left = (hsv[1] * 100) + '%'; svDot.style.top = ((1 - hsv[2]) * 100) + '%';
      hueDot.style.left = (hsv[0] / 360 * 100) + '%';
      prev.style.background = hex;
      if (document.activeElement !== hexIn) hexIn.value = hex.slice(1).toUpperCase();
      if (document.activeElement !== rIn) rIn.value = round(rgb[0]); if (document.activeElement !== gIn) gIn.value = round(rgb[1]); if (document.activeElement !== bIn) bIn.value = round(rgb[2]);
      if (fire) { st.hex = hex; st.value = hex; st.changed = true; if (onInput) onInput(hex); }
    }
    function setHex(c, fire) { var keepH = hsv[0]; hsv = rgbToHsv.apply(null, hexToRgb(c)); if (hsv[1] === 0) hsv[0] = keepH; paint(fire); }
    function drag(target, fn) {
      target.addEventListener('pointerdown', function (e) {
        e.preventDefault(); try { target.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
        fn(e);
        var mv = function (ev) { fn(ev); }, up = function () { target.removeEventListener('pointermove', mv); target.removeEventListener('pointerup', up); target.removeEventListener('pointercancel', up); };
        target.addEventListener('pointermove', mv); target.addEventListener('pointerup', up); target.addEventListener('pointercancel', up);
      });
    }
    drag(sv, function (e) { var r = sv.getBoundingClientRect(); hsv[1] = SV.clamp((e.clientX - r.left) / r.width, 0, 1); hsv[2] = SV.clamp(1 - (e.clientY - r.top) / r.height, 0, 1); paint(true); });
    drag(hue, function (e) { var r = hue.getBoundingClientRect(); hsv[0] = SV.clamp((e.clientX - r.left) / r.width, 0, 0.9999) * 360; paint(true); });
    hexIn.addEventListener('input', function () { var v = hexIn.value.replace(/[^0-9a-f]/gi, ''); if (v.length === 6 || v.length === 3) setHex('#' + v, true); });
    hexIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') UI.closePicker(); });
    [rIn, gIn, bIn].forEach(function (inp) { inp.addEventListener('input', function () { setHex(rgbToHex(+rIn.value || 0, +gIn.value || 0, +bIn.value || 0), true); }); });
    paint(false);
    // position
    var r = anchor.getBoundingClientRect(), pw = el.offsetWidth, ph = el.offsetHeight;
    var left = r.left, top = r.bottom + 6;
    if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
    if (top + ph > window.innerHeight - 8) top = max(8, r.top - ph - 6);
    el.style.left = max(8, left) + 'px'; el.style.top = max(8, top) + 'px';
    st.outside = function (e) { if (!el.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) UI.closePicker(); };
    setTimeout(function () { document.addEventListener('pointerdown', st.outside, true); }, 0);
    picker = st;
    return st;
  };
  // edit fill/stroke of selection via picker
  function editPaint(which, anchor) {
    S.focus = which;
    var cur = SV.currentPaint(which), before = SV.snapshot();
    UI.pickColor(anchor, cur, function (hex) {
      SV.applyStyle(which, hex, { commit: false });
    }, function (val, changed) {
      if (changed) SV.commit('color ' + which); else SV.requestRender(true);
    }, { allowNone: true, title: which === 'fill' ? 'Fill' : 'Stroke', allowGradient: function () { var p = SV.currentPaint(which); if (!p || typeof p !== 'object') SV.applyStyle(which, SV.defaultGradient(p)); showPanel('gradient'); } });
    void before;
  }
  UI.editPaint = editPaint;

  /* ================= bindings ================= */
  var binds = {};
  function bind(group, fn) { (binds[group] = binds[group] || []).push(fn); }
  function runBinds(group) { (binds[group] || []).forEach(function (f) { try { f(); } catch (e) { if (window.console) console.warn(e); } }); }
  function setVal(inp, v) { if (document.activeElement !== inp) inp.value = v; }
  function numIn(group, opts) {
    var inp = h('input', { class: 'num mono' + (opts.cls ? ' ' + opts.cls : ''), type: 'number', step: opts.step || 1, min: opts.min, max: opts.max, 'aria-label': opts.label, title: opts.title || opts.label });
    inp.addEventListener('change', function () { var v = parseFloat(inp.value); if (isNaN(v)) return; if (opts.min != null) v = max(opts.min, v); if (opts.max != null) v = min(opts.max, v); opts.set(v); });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { inp.blur(); } });
    bind(group, function () { var v = opts.get(); setVal(inp, v == null || isNaN(v) ? '' : (Math.round(v * 100) / 100)); inp.disabled = opts.enabled ? !opts.enabled() : false; });
    return inp;
  }
  function field(label, input, unit, title) { return h('label', { class: 'fld', title: title || null }, [h('span', { class: 'fl', text: label }), input, unit ? h('span', { class: 'fu', text: unit }) : null]); }
  function selIn(group, options, get, set, label) {
    var s = h('select', { class: 'sel', 'aria-label': label, title: label });
    options.forEach(function (o) { s.appendChild(h('option', { value: o[0], text: o[1] })); });
    s.addEventListener('change', function () { set(s.value); });
    bind(group, function () { var v = get(); if (document.activeElement !== s) s.value = v == null ? '' : String(v); });
    return s;
  }
  function seg(group, items, get, set, label) {
    var wrap = h('div', { class: 'seg', role: 'group', 'aria-label': label });
    items.forEach(function (it) {
      var b = h('button', { type: 'button', class: 'segb', title: it[2] || it[0], 'aria-label': it[2] || it[0], html: it[1] });
      b.addEventListener('click', function () { set(it[0]); });
      wrap.appendChild(b);
      bind(group, function () { b.classList.toggle('on', get() === it[0]); b.setAttribute('aria-pressed', get() === it[0] ? 'true' : 'false'); });
    });
    return wrap;
  }
  function ibtn(icon, title, onclick, cls) { var b = h('button', { type: 'button', class: 'ibtn' + (cls ? ' ' + cls : ''), title: title, 'aria-label': title, html: icon }); b.addEventListener('click', onclick); return b; }
  function btn(text, onclick, cls, title) { return h('button', { type: 'button', class: 'btn' + (cls ? ' ' + cls : ''), text: text, title: title || null, onclick: onclick }); }
  function chip(group, which, small) {
    var b = h('button', { type: 'button', class: 'chip ' + which + (small ? ' small' : ''), title: which === 'fill' ? 'Fill — click to edit' : 'Stroke — click to edit', 'aria-label': which === 'fill' ? 'Fill color' : 'Stroke color' }, [h('span', { class: 'chip-in' })]);
    b.addEventListener('click', function () { editPaint(which, b); });
    bind(group, function () { paintBG(b.firstChild, SV.currentPaint(which)); });
    return b;
  }

  /* selection info */
  function firstLeaf() { var o = SV.selObjs()[0]; if (!o) return null; return SV.leaves(o).filter(function (l) { return l.style && l.type !== 'image'; })[0] || SV.leaves(o)[0] || o; }
  function firstOfType(t) { var r = null; SV.selObjs().forEach(function (o) { SV.leaves(o).forEach(function (l) { if (!r && l.type === t) r = l; }); }); return r; }
  function curStyle() { var l = firstLeaf(); return l && l.style ? l.style : S.style; }
  UI.curStyle = curStyle;
  var TYPE_NAMES = { path: 'Path', rect: 'Rectangle', ellipse: 'Ellipse', polygon: 'Polygon', star: 'Star', text: 'Text', image: 'Image', group: 'Group' };
  function selLabel() {
    var objs = SV.selObjs();
    if (!objs.length) return 'No Selection';
    if (objs.length > 1) return objs.length + ' Objects';
    var o = objs[0];
    if (o.type === 'path' && o.subpaths.length > 1) return 'Compound Path';
    if (o.type === 'path' && o.subpaths.length === 1 && o.subpaths[0].pts.length === 2 && !o.subpaths[0].closed) return 'Line';
    if (o.type === 'rect' && o.rx > 0) return 'Rounded Rectangle';
    return TYPE_NAMES[o.type] || 'Object';
  }
  SV.objDisplayName = function (o) {
    if (o.name) return o.name;
    if (o.type === 'text') return o.text.split('\n')[0].slice(0, 24) || '<Text>';
    return '<' + (TYPE_NAMES[o.type] || 'Object') + '>';
  };

  /* ================= toolbar ================= */
  function buildToolbar() {
    var tb = document.getElementById('toolbar');
    var grid = h('div', { class: 'tools', role: 'toolbar', 'aria-label': 'Tools' });
    SV.TOOL_LIST.forEach(function (t) {
      var b = h('button', { type: 'button', class: 'tool', 'data-tool': t.id, title: t.name + ' (' + t.key + ')', 'aria-label': t.name + ' (' + t.key + ')', html: SV.ICONS[t.id] });
      b.addEventListener('pointerdown', function (e) { if (e.button === 0) { e.preventDefault(); SV.setTool(t.id); } });
      b.addEventListener('click', function (e) { if (e.detail === 0) SV.setTool(t.id); });
      grid.appendChild(b);
      bind('toolbar', function () { var on = S.tool === t.id; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    });
    tb.appendChild(grid);
    // fill / stroke widget
    var fs = h('div', { class: 'fswidget', 'aria-label': 'Fill and stroke' });
    var fillB = h('button', { type: 'button', class: 'fs fill', title: 'Fill (X to toggle focus, double-click to edit)', 'aria-label': 'Fill' }, [h('span', { class: 'chip-in' })]);
    var strokeB = h('button', { type: 'button', class: 'fs stroke', title: 'Stroke (X to toggle focus, double-click to edit)', 'aria-label': 'Stroke' }, [h('span', { class: 'chip-in' }), h('span', { class: 'hole' })]);
    function fsClick(which, el) { return function () { if (S.focus === which) editPaint(which, el); else { S.focus = which; SV.requestRender(true); } }; }
    fillB.addEventListener('click', fsClick('fill', fillB));
    strokeB.addEventListener('click', fsClick('stroke', strokeB));
    var swapB = h('button', { type: 'button', class: 'fs-mini swapb', title: 'Swap Fill and Stroke (Shift+X)', 'aria-label': 'Swap fill and stroke', html: '<svg viewBox="0 0 16 16"><path d="M3 5h7a3 3 0 0 1 3 3v5M11 11l2 2 2-2M5 3L3 5l2 2" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>', onclick: function () { SV.swapFillStroke(); } });
    var defB = h('button', { type: 'button', class: 'fs-mini defb', title: 'Default Fill and Stroke (D)', 'aria-label': 'Default fill and stroke', html: '<svg viewBox="0 0 16 16"><rect x="1.5" y="1.5" width="7" height="7" fill="#fff" stroke="#000"/><rect x="5.5" y="5.5" width="7" height="7" fill="none" stroke="#000" stroke-width="2"/></svg>', onclick: function () { SV.defaultFillStroke(); } });
    fs.appendChild(h('div', { class: 'fs-stack' }, [strokeB, fillB, swapB, defB]));
    var modes = h('div', { class: 'fs-modes' }, [
      h('button', { type: 'button', class: 'fs-mode', title: 'Color (,)', 'aria-label': 'Solid color', html: '<span class="m-solid"></span>', onclick: function () { var p = SV.currentPaint(S.focus); SV.applyStyle(S.focus, typeof p === 'string' ? p : (p && p.stops ? p.stops[p.stops.length - 1].c : '#d4ff3a')); } }),
      h('button', { type: 'button', class: 'fs-mode', title: 'Gradient (.)', 'aria-label': 'Gradient', html: '<span class="m-grad"></span>', onclick: function () { var p = SV.currentPaint(S.focus); SV.applyStyle(S.focus, p && typeof p === 'object' ? p : SV.defaultGradient(p)); } }),
      h('button', { type: 'button', class: 'fs-mode', title: 'None (/)', 'aria-label': 'None', html: '<span class="m-none"></span>', onclick: function () { SV.applyStyle(S.focus, null); } })
    ]);
    fs.appendChild(modes);
    tb.appendChild(fs);
    bind('toolbar', function () {
      paintBG(fillB.firstChild, SV.currentPaint('fill')); paintBG(strokeB.firstChild, SV.currentPaint('stroke'));
      fillB.classList.toggle('front', S.focus === 'fill'); strokeB.classList.toggle('front', S.focus === 'stroke');
    });
  }

  /* ================= control bar ================= */
  var cbSig = '';
  function controlContext() {
    var objs = SV.selObjs(), types = {};
    objs.forEach(function (o) { SV.leaves(o).forEach(function (l) { types[l.type] = 1; }); });
    return { n: objs.length, types: types, tool: S.tool, editing: !!S.editing };
  }
  var HINTS = {
    pen: 'Click for corner points · drag for curves · click the first point to close · Enter/Esc to finish',
    pencil: 'Drag to draw freehand — ends near the start close the path',
    brush: 'Drag to paint a smooth stroke',
    addAnchor: 'Click a path segment to add an anchor', deleteAnchor: 'Click an anchor to remove it',
    convertAnchor: 'Click an anchor to make it a corner · drag to pull out smooth handles',
    type: 'Click to place text · click existing text to edit · Esc to finish',
    eyedropper: 'Click an object to sample its appearance onto the selection',
    hand: 'Drag to pan (or hold Space with any tool)', zoom: 'Click to zoom in · Alt-click to zoom out · drag to zoom to an area',
    scissors: 'Click on a path to cut it', gradient: 'Drag across the selected object to set the gradient direction',
    rotate: 'Drag to rotate around the origin · click to move the origin · Alt-click for exact angle',
    scale: 'Drag to scale around the origin · Shift for uniform · Alt-click for exact values',
    direct: 'Drag anchors, handles and segments · marquee-select points', line: 'Drag to draw · Shift constrains to 45° · Alt draws from centre',
    rect: 'Drag to draw · Shift for a square · Alt from centre · click for exact size', ellipse: 'Drag to draw · Shift for a circle · Alt from centre · click for exact size',
    rrect: 'Drag to draw · Shift for a square · click for exact size', polygon: 'Drag from the centre · ↑/↓ while dragging changes sides', star: 'Drag from the centre · ↑/↓ while dragging changes points',
    select: 'Click to select · drag to move · Alt-drag duplicates · drag handles to scale · drag outside corners to rotate'
  };
  function buildControlBar(ctx) {
    var cb = document.getElementById('controlbar'); cb.innerHTML = ''; binds.cb = [];
    var g = 'cb';
    var label = h('span', { class: 'cb-label' }); bind(g, function () { label.textContent = S.editing ? 'Type' : selLabel(); });
    cb.appendChild(label);
    var showStyle = ctx.n > 0 || ['pen', 'pencil', 'brush', 'rect', 'rrect', 'ellipse', 'polygon', 'star', 'line', 'type'].indexOf(ctx.tool) >= 0;
    if (showStyle && !(ctx.n && Object.keys(ctx.types).length === 1 && ctx.types.image)) {
      cb.appendChild(h('span', { class: 'cb-sep' }));
      cb.appendChild(field('Fill', chip(g, 'fill', true)));
      cb.appendChild(field('Stroke', chip(g, 'stroke', true)));
      cb.appendChild(numIn(g, { label: 'Stroke weight', min: 0, max: 1000, step: 0.5, get: function () { return curStyle().sw; }, set: function (v) { SV.applyStyle('sw', v); if (v > 0 && !SV.currentPaint('stroke')) SV.applyStyle('stroke', '#0a0a0a'); }, cls: 'w52' }));
      cb.appendChild(h('span', { class: 'fu', text: 'px' }));
    }
    var hasType = ctx.types.text || ctx.tool === 'type';
    var shapeOpt = function (key) {
      return ctx.types[{ radius: 'rect', sides: 'polygon', points: 'star', inner: 'star' }[key]] || (!ctx.n && ({ radius: 'rrect', sides: 'polygon', points: 'star', inner: 'star' }[key] === ctx.tool));
    };
    if (shapeOpt('radius')) {
      cb.appendChild(h('span', { class: 'cb-sep' }));
      cb.appendChild(field('Corners', numIn(g, { label: 'Corner radius', min: 0, max: 5000, get: function () { var r = firstOfType('rect'); return r ? r.rx : S.shape.radius; }, set: function (v) { SV.applyShapeOpt('radius', v); }, cls: 'w52' }), 'px'));
    }
    if (shapeOpt('sides')) {
      cb.appendChild(h('span', { class: 'cb-sep' }));
      cb.appendChild(field('Sides', numIn(g, { label: 'Polygon sides', min: 3, max: 64, get: function () { var r = firstOfType('polygon'); return r ? r.sides : S.shape.sides; }, set: function (v) { SV.applyShapeOpt('sides', round(v)); }, cls: 'w44' })));
    }
    if (shapeOpt('points')) {
      cb.appendChild(h('span', { class: 'cb-sep' }));
      cb.appendChild(field('Points', numIn(g, { label: 'Star points', min: 2, max: 64, get: function () { var r = firstOfType('star'); return r ? r.points : S.shape.points; }, set: function (v) { SV.applyShapeOpt('points', round(v)); }, cls: 'w44' })));
      cb.appendChild(field('Inner', numIn(g, { label: 'Inner radius %', min: 5, max: 100, get: function () { var r = firstOfType('star'); return round((r ? r.r2 / (r.r1 || 1) : S.shape.inner) * 100); }, set: function (v) { SV.applyShapeOpt('inner', v / 100); }, cls: 'w44' }), '%'));
    }
    if (ctx.tool === 'brush' && !ctx.n) {
      cb.appendChild(h('span', { class: 'cb-sep' }));
      cb.appendChild(field('Brush', numIn(g, { label: 'Brush size', min: 0.5, max: 200, get: function () { return S.brush.size; }, set: function (v) { S.brush.size = v; } , cls: 'w52'}), 'px'));
    }
    if (hasType) {
      cb.appendChild(h('span', { class: 'cb-sep' }));
      cb.appendChild(selIn(g, Object.keys(SV.FONTS).map(function (f) { return [f, f]; }), function () { return curFont().family; }, function (v) { SV.applyFont('family', v); }, 'Font family'));
      cb.appendChild(selIn(g, [[300, 'Light'], [400, 'Regular'], [500, 'Medium'], [600, 'Semibold'], [700, 'Bold'], [800, 'ExtraBold'], [900, 'Black']], function () { return curFont().weight; }, function (v) { SV.applyFont('weight', +v); }, 'Font weight'));
      cb.appendChild(numIn(g, { label: 'Font size', min: 1, max: 2000, get: function () { return curFont().size; }, set: function (v) { SV.applyFont('size', v); }, cls: 'w52' }));
      cb.appendChild(h('span', { class: 'fu', text: 'px' }));
      cb.appendChild(seg(g, [['left', I.txtL, 'Align left'], ['center', I.txtC, 'Align center'], ['right', I.txtR, 'Align right']], function () { return curFont().align; }, function (v) { SV.applyFont('align', v); }, 'Paragraph alignment'));
    }
    if (ctx.n) {
      cb.appendChild(h('span', { class: 'cb-sep' }));
      cb.appendChild(field('Opacity', numIn(g, { label: 'Opacity', min: 0, max: 100, get: function () { return round((curStyle().opacity == null ? 1 : curStyle().opacity) * 100); }, set: function (v) { SV.applyStyle('opacity', v / 100); }, cls: 'w44' }), '%'));
    }
    cb.appendChild(h('span', { class: 'grow' }));
    if (ctx.n) {
      var al = h('div', { class: 'cb-align' }, [
        ibtn(I.alignL, 'Horizontal Align Left', function () { C.align('left'); }), ibtn(I.alignHC, 'Horizontal Align Center', function () { C.align('hcenter'); }), ibtn(I.alignR, 'Horizontal Align Right', function () { C.align('right'); }),
        ibtn(I.alignT, 'Vertical Align Top', function () { C.align('top'); }), ibtn(I.alignVC, 'Vertical Align Center', function () { C.align('vcenter'); }), ibtn(I.alignB, 'Vertical Align Bottom', function () { C.align('bottom'); })
      ]);
      cb.appendChild(al);
      cb.appendChild(h('span', { class: 'cb-sep' }));
      cb.appendChild(h('button', { type: 'button', class: 'btn slop', title: 'Slopify the selection (' + keyLabel('mod+alt+s') + ')', html: I.slop + '<span>Slopify</span>', onclick: function () { SV.runAction('object.slopify'); } }));
    } else {
      var hint = h('span', { class: 'cb-hint' }); bind(g, function () { hint.textContent = HINTS[S.tool] || ''; });
      cb.appendChild(hint);
    }
  }

  /* ================= dock & panels ================= */
  var activeTabs = { a: 'properties', c: 'swatches' }, collapsed = {};
  var GROUPS = [{ id: 'a', panels: ['properties', 'appearance'] }, { id: 'b', panels: ['layers'] }, { id: 'c', panels: ['swatches', 'gradient', 'align', 'pathfinder'] }];
  var panelEls = {};
  function groupOf(p) { return GROUPS.filter(function (g) { return g.panels.indexOf(p) >= 0; })[0]; }
  function isPanelVisible(p) { var g = groupOf(p); return S.prefs.panels && !collapsed[g.id] && (g.panels.length === 1 || activeTabs[g.id] === p); }
  function showPanel(p) {
    var g = groupOf(p); S.prefs.panels = true; collapsed[g.id] = false;
    if (g.panels.length > 1) activeTabs[g.id] = p;
    savePrefs(); applyDock();
    if (window.innerWidth < 900) document.getElementById('app').classList.add('dock-open');
  }
  UI.showPanel = showPanel;
  function togglePanels() {
    if (window.innerWidth < 900) { document.getElementById('app').classList.toggle('dock-open'); return; }
    S.prefs.panels = !S.prefs.panels; savePrefs(); applyDock();
    setTimeout(function () { SV.requestRender(true); }, 0);
  }
  UI.togglePanels = togglePanels;
  function applyDock() {
    var app = document.getElementById('app');
    app.classList.toggle('no-dock', !S.prefs.panels);
    GROUPS.forEach(function (g) {
      var ge = document.getElementById('dg-' + g.id);
      ge.classList.toggle('collapsed', !!collapsed[g.id]);
      g.panels.forEach(function (p) {
        var on = g.panels.length === 1 || activeTabs[g.id] === p;
        panelEls[p].body.hidden = !on;
        var tab = ge.querySelector('[data-tab="' + p + '"]');
        if (tab) { tab.classList.toggle('on', on); tab.setAttribute('aria-selected', on ? 'true' : 'false'); }
      });
    });
    SV.requestRender(true);
  }
  function buildDock() {
    var dock = document.getElementById('dock');
    dock.appendChild(h('div', { class: 'dock-head' }, [h('span', { text: 'Panels' }), h('button', { type: 'button', class: 'xbtn', 'aria-label': 'Close panels', html: '&times;', onclick: function () { document.getElementById('app').classList.remove('dock-open'); } })]));
    GROUPS.forEach(function (g) {
      var ge = h('section', { class: 'dock-group dg-' + g.id, id: 'dg-' + g.id });
      var tabs = h('div', { class: 'dock-tabs', role: 'tablist' });
      g.panels.forEach(function (p) {
        var t = h('button', { type: 'button', class: 'dock-tab', role: 'tab', 'data-tab': p, text: PANEL_NAMES[p] });
        t.addEventListener('click', function () { activeTabs[g.id] = p; collapsed[g.id] = false; savePrefs(); applyDock(); });
        t.addEventListener('dblclick', function () { collapsed[g.id] = true; savePrefs(); applyDock(); });
        tabs.appendChild(t);
      });
      tabs.appendChild(h('span', { class: 'grow' }));
      tabs.appendChild(h('button', { type: 'button', class: 'dock-collapse', title: 'Collapse', 'aria-label': 'Collapse panel group', html: '<svg viewBox="0 0 12 12"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>', onclick: function () { collapsed[g.id] = !collapsed[g.id]; savePrefs(); applyDock(); } }));
      ge.appendChild(tabs);
      g.panels.forEach(function (p) {
        var body = h('div', { class: 'panel-body panel-' + p, role: 'tabpanel', 'aria-label': PANEL_NAMES[p] });
        panelEls[p] = { body: body };
        ge.appendChild(body);
      });
      dock.appendChild(ge);
    });
    buildProperties(); buildAppearance(); buildLayers(); buildSwatches(); buildGradient(); buildAlign(); buildPathfinder();
    applyDock();
  }

  /* ---------- Properties ---------- */
  var refPt = 'nw', linkWH = true, propsSig = '';
  function refOf(b) { var fx = refPt.indexOf('w') >= 0 ? 0 : refPt.indexOf('e') >= 0 ? 1 : 0.5, fy = refPt.indexOf('n') >= 0 ? 0 : refPt.indexOf('s') >= 0 ? 1 : 0.5; if (refPt === 'c') { fx = fy = 0.5; } return { x: b.x + fx * b.w, y: b.y + fy * b.h, fx: fx, fy: fy }; }
  function setTransformField(k, v) {
    var ids = SV.zSorted(S.sel), b = SV.selBBox(ids); if (!b) return;
    var r = refOf(b), M;
    if (k === 'x') M = G.translate(v - r.x, 0);
    else if (k === 'y') M = G.translate(0, v - r.y);
    else if (k === 'w' || k === 'h') {
      var cur = k === 'w' ? b.w : b.h; if (cur < 1e-6 || v <= 0) return;
      var s = v / cur, sx = k === 'w' ? s : (linkWH ? s : 1), sy = k === 'h' ? s : (linkWH ? s : 1);
      M = G.scale(sx, sy, r.x, r.y);
    } else if (k === 'rot') {
      var o = getObj(ids[0]), curD = -SV.objRot(o), delta = v - curD, a = -delta * PI / 180;
      var c = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
      M = G.rotate(a, c.x, c.y);
      ids.forEach(function (id) { var oo = getObj(id); SV.transformObj(oo, M); if (oo.type === 'path' || oo.type === 'group') oo.rot = SV.normAng((oo.rot || 0) + a * 180 / PI); });
      SV.commit('rotate'); return;
    }
    if (M) { ids.forEach(function (id) { SV.transformObj(getObj(id), M); }); SV.commit('transform'); }
  }
  function buildProperties() {
    var body = panelEls.properties.body, g = 'props';
    var none = h('div', { class: 'psec doc-sec' });
    none.appendChild(h('div', { class: 'psec-title', text: 'Document' }));
    none.appendChild(h('div', { class: 'grid2' }, [
      field('W', numIn(g, { label: 'Artboard width', min: 1, max: 20000, get: function () { return S.doc.width; }, set: function (v) { S.doc.width = v; SV.commit('artboard'); } }), 'px'),
      field('H', numIn(g, { label: 'Artboard height', min: 1, max: 20000, get: function () { return S.doc.height; }, set: function (v) { S.doc.height = v; SV.commit('artboard'); } }), 'px')
    ]));
    none.appendChild(h('div', { class: 'btnrow' }, [btn('Document Setup…', function () { docSetupDialog(); }), btn('Fit Artboard', function () { SV.fitArtboard(); })]));
    var toggles = h('div', { class: 'checks' });
    [['rulers', 'Rulers', 'view.rulers'], ['grid', 'Grid', 'view.grid'], ['snapGrid', 'Snap to grid', 'view.snapGrid'], ['smart', 'Smart guides', 'view.smart'], ['outline', 'Outline mode', 'view.outline']].forEach(function (t) {
      var cbx = h('input', { type: 'checkbox' });
      cbx.addEventListener('change', function () { if (!!S.prefs[t[0]] !== cbx.checked) SV.runAction(t[2]); });
      bind(g, function () { cbx.checked = !!S.prefs[t[0]]; });
      toggles.appendChild(h('label', { class: 'chk' }, [cbx, h('span', { text: t[1] })]));
    });
    none.appendChild(toggles);
    none.appendChild(h('div', { class: 'psec-title', text: 'Tip' }));
    none.appendChild(h('p', { class: 'tip', text: 'Select something to edit it. Double-click text to retype it. Press F1 for every shortcut.' }));
    // transform section
    var tr = h('div', { class: 'psec tr-sec' });
    tr.appendChild(h('div', { class: 'psec-title', text: 'Transform' }));
    var grid9 = h('div', { class: 'ref9', role: 'radiogroup', 'aria-label': 'Reference point' });
    ['nw', 'n', 'ne', 'w', 'c', 'e', 'sw', 's', 'se'].forEach(function (p) {
      var b = h('button', { type: 'button', class: 'refpt', title: 'Reference point', 'aria-label': 'Reference point ' + p });
      b.addEventListener('click', function () { refPt = p; runBinds(g); });
      bind(g, function () { b.classList.toggle('on', refPt === p); });
      grid9.appendChild(b);
    });
    var gv = function (k) { return function () { var b = SV.selBBox(); if (!b) return null; var r = refOf(b); return k === 'x' ? r.x : k === 'y' ? r.y : k === 'w' ? b.w : b.h; }; };
    var link = h('button', { type: 'button', class: 'ibtn link', title: 'Constrain width and height proportions', 'aria-label': 'Constrain proportions', html: I.link, onclick: function () { linkWH = !linkWH; runBinds(g); } });
    bind(g, function () { link.classList.toggle('on', linkWH); });
    tr.appendChild(h('div', { class: 'tr-grid' }, [grid9, h('div', { class: 'grid2 tight' }, [
      field('X', numIn(g, { label: 'X', step: 1, get: gv('x'), set: function (v) { setTransformField('x', v); } }), 'px'),
      field('W', numIn(g, { label: 'Width', step: 1, min: 0, get: gv('w'), set: function (v) { setTransformField('w', v); } }), 'px'),
      field('Y', numIn(g, { label: 'Y', step: 1, get: gv('y'), set: function (v) { setTransformField('y', v); } }), 'px'),
      field('H', numIn(g, { label: 'Height', step: 1, min: 0, get: gv('h'), set: function (v) { setTransformField('h', v); } }), 'px')
    ]), link]));
    tr.appendChild(h('div', { class: 'grid2 rotrow' }, [
      field('∠', numIn(g, { label: 'Rotation angle', step: 1, get: function () { var o = SV.selObjs()[0]; return o && S.sel.length === 1 ? SV.normAng(-SV.objRot(o)) : 0; }, set: function (v) { setTransformField('rot', v); } }), '°', 'Rotate'),
      h('div', { class: 'btnrow right' }, [ibtn(I.flipH, 'Flip Horizontal', function () { C.flip('h'); }), ibtn(I.flipV, 'Flip Vertical', function () { C.flip('v'); })])
    ]));
    // shape section
    var shp = h('div', { class: 'psec shape-sec' });
    shp.appendChild(h('div', { class: 'psec-title', text: 'Shape' }));
    var shRect = field('Corner radius', numIn(g, { label: 'Corner radius', min: 0, get: function () { var r = firstOfType('rect'); return r ? r.rx : 0; }, set: function (v) { SV.applyShapeOpt('radius', v); } }), 'px');
    var shPoly = field('Sides', numIn(g, { label: 'Sides', min: 3, max: 64, get: function () { var r = firstOfType('polygon'); return r ? r.sides : 6; }, set: function (v) { SV.applyShapeOpt('sides', round(v)); } }));
    var shStar = field('Points', numIn(g, { label: 'Points', min: 2, max: 64, get: function () { var r = firstOfType('star'); return r ? r.points : 5; }, set: function (v) { SV.applyShapeOpt('points', round(v)); } }));
    var shStar2 = field('Inner radius', numIn(g, { label: 'Inner radius', min: 5, max: 100, get: function () { var r = firstOfType('star'); return r ? round(r.r2 / (r.r1 || 1) * 100) : 45; }, set: function (v) { SV.applyShapeOpt('inner', v / 100); } }), '%');
    shp.appendChild(h('div', { class: 'grid2' }, [shRect, shPoly, shStar, shStar2]));
    bind(g, function () { shRect.hidden = !firstOfType('rect'); shPoly.hidden = !firstOfType('polygon'); shStar.hidden = shStar2.hidden = !firstOfType('star'); });
    // character section
    var ch = h('div', { class: 'psec char-sec' });
    ch.appendChild(h('div', { class: 'psec-title', text: 'Character' }));
    ch.appendChild(selIn(g, Object.keys(SV.FONTS).map(function (f) { return [f, f]; }), function () { return curFont().family; }, function (v) { SV.applyFont('family', v); }, 'Font family'));
    ch.appendChild(h('div', { class: 'grid2' }, [
      selIn(g, [[300, 'Light'], [400, 'Regular'], [500, 'Medium'], [600, 'Semibold'], [700, 'Bold'], [800, 'ExtraBold'], [900, 'Black']], function () { return curFont().weight; }, function (v) { SV.applyFont('weight', +v); }, 'Font weight'),
      field('Size', numIn(g, { label: 'Font size', min: 1, get: function () { return curFont().size; }, set: function (v) { SV.applyFont('size', v); } }), 'px'),
      field('Leading', numIn(g, { label: 'Line height', min: 0.5, max: 5, step: 0.05, get: function () { return curFont().lh; }, set: function (v) { SV.applyFont('lh', v); } }), '×'),
      field('Tracking', numIn(g, { label: 'Tracking (1/1000 em)', min: -500, max: 2000, step: 10, get: function () { return curFont().tracking; }, set: function (v) { SV.applyFont('tracking', v); } }))
    ]));
    ch.appendChild(h('div', { class: 'btnrow' }, [seg(g, [['left', I.txtL, 'Align left'], ['center', I.txtC, 'Align center'], ['right', I.txtR, 'Align right']], function () { return curFont().align; }, function (v) { SV.applyFont('align', v); }, 'Alignment'),
      seg(g, [['normal', '<b style="font-style:normal">I</b>', 'Roman'], ['italic', '<i>I</i>', 'Italic']], function () { return curFont().style; }, function (v) { SV.applyFont('style', v); }, 'Style')]));
    // quick actions
    var qa = h('div', { class: 'psec qa-sec' });
    qa.appendChild(h('div', { class: 'psec-title', text: 'Quick Actions' }));
    var qbtns = h('div', { class: 'qbtns' });
    [['Group', 'object.group'], ['Ungroup', 'object.ungroup'], ['Duplicate', 'edit.duplicate'], ['Bring to Front', 'arrange.front'], ['Send to Back', 'arrange.back'], ['Expand', 'object.expand'], ['Lock', 'object.lock'], ['Delete', 'edit.clear']].forEach(function (q) {
      var b = btn(q[0], function () { SV.runAction(q[1]); }, 'small');
      bind(g, function () { var a = A[q[1]]; b.disabled = a.enabled ? !a.enabled() : false; });
      qbtns.appendChild(b);
    });
    qa.appendChild(qbtns);
    qa.appendChild(h('button', { type: 'button', class: 'btn slop wide', html: I.slop + '<span>Slopify selection</span>', onclick: function () { SV.runAction('object.slopify'); } }));
    [none, tr, shp, ch, qa].forEach(function (s) { body.appendChild(s); });
    bind(g, function () {
      var n = S.sel.length;
      none.hidden = n > 0; tr.hidden = !n; qa.hidden = !n;
      shp.hidden = !(firstOfType('rect') || firstOfType('polygon') || firstOfType('star'));
      ch.hidden = !(firstOfType('text') || S.tool === 'type');
    });
  }

  /* ---------- Appearance ---------- */
  function buildAppearance() {
    var body = panelEls.appearance.body, g = 'app';
    var fillLabel = h('span', { class: 'plabel mono' }), strokeLabel = h('span', { class: 'plabel mono' });
    bind(g, function () { fillLabel.textContent = paintLabel(SV.currentPaint('fill')); strokeLabel.textContent = paintLabel(SV.currentPaint('stroke')); });
    body.appendChild(h('div', { class: 'arow' }, [h('span', { class: 'alabel', text: 'Fill' }), chip(g, 'fill'), fillLabel]));
    body.appendChild(h('div', { class: 'arow' }, [h('span', { class: 'alabel', text: 'Stroke' }), chip(g, 'stroke'), strokeLabel]));
    body.appendChild(h('div', { class: 'grid2' }, [
      field('Weight', numIn(g, { label: 'Stroke weight', min: 0, max: 1000, step: 0.5, get: function () { return curStyle().sw; }, set: function (v) { SV.applyStyle('sw', v); if (v > 0 && !SV.currentPaint('stroke')) SV.applyStyle('stroke', '#0a0a0a'); } }), 'px'),
      field('Miter', numIn(g, { label: 'Miter limit', min: 1, max: 500, get: function () { return curStyle().miter; }, set: function (v) { SV.applyStyle('miter', v); } }), '×')
    ]));
    body.appendChild(h('div', { class: 'arow' }, [h('span', { class: 'alabel', text: 'Cap' }), seg(g, [['butt', I.capButt, 'Butt cap'], ['round', I.capRound, 'Round cap'], ['square', I.capSquare, 'Projecting cap']], function () { return curStyle().cap; }, function (v) { SV.applyStyle('cap', v); }, 'Cap'),
      h('span', { class: 'alabel', text: 'Join' }), seg(g, [['miter', I.joinMiter, 'Miter join'], ['round', I.joinRound, 'Round join'], ['bevel', I.joinBevel, 'Bevel join']], function () { return curStyle().join; }, function (v) { SV.applyStyle('join', v); }, 'Join')]));
    var dashChk = h('input', { type: 'checkbox' });
    var dashA = numIn(g, { label: 'Dash length', min: 0, max: 1000, get: function () { var d = curStyle().dash; return d ? d[0] : 12; }, set: function (v) { var d = curStyle().dash || [12, 6]; SV.applyStyle('dash', [v, d[1] == null ? v : d[1]]); }, enabled: function () { return !!curStyle().dash; } });
    var dashB = numIn(g, { label: 'Gap length', min: 0, max: 1000, get: function () { var d = curStyle().dash; return d ? (d[1] == null ? d[0] : d[1]) : 6; }, set: function (v) { var d = curStyle().dash || [12, 6]; SV.applyStyle('dash', [d[0], v]); }, enabled: function () { return !!curStyle().dash; } });
    dashChk.addEventListener('change', function () { SV.applyStyle('dash', dashChk.checked ? [12, 6] : null); });
    bind(g, function () { dashChk.checked = !!curStyle().dash; });
    body.appendChild(h('div', { class: 'arow dashrow' }, [h('label', { class: 'chk' }, [dashChk, h('span', { text: 'Dashed' })]), field('dash', dashA), field('gap', dashB)]));
    var op = h('input', { type: 'range', min: 0, max: 100, class: 'range', 'aria-label': 'Opacity' });
    var opBefore = null;
    op.addEventListener('input', function () { if (opBefore === null) opBefore = 1; SV.applyStyle('opacity', +op.value / 100, { commit: false }); });
    op.addEventListener('change', function () { opBefore = null; SV.commit('opacity'); });
    bind(g, function () { if (document.activeElement !== op) op.value = round((curStyle().opacity == null ? 1 : curStyle().opacity) * 100); });
    body.appendChild(h('div', { class: 'arow' }, [h('span', { class: 'alabel', text: 'Opacity' }), op, numIn(g, { label: 'Opacity %', min: 0, max: 100, get: function () { return round((curStyle().opacity == null ? 1 : curStyle().opacity) * 100); }, set: function (v) { SV.applyStyle('opacity', v / 100); }, cls: 'w44' }), h('span', { class: 'fu', text: '%' })]));
    body.appendChild(h('div', { class: 'grid2' }, [
      h('label', { class: 'fld col' }, [h('span', { class: 'fl', text: 'Blending' }), selIn(g, SV.BLENDS.map(function (b) { return [b, b.replace(/-/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); })]; }), function () { return curStyle().blend || 'normal'; }, function (v) { SV.applyStyle('blend', v); }, 'Blend mode')]),
      h('label', { class: 'fld col' }, [h('span', { class: 'fl', text: 'Fill rule' }), selIn(g, [['nonzero', 'Non-zero'], ['evenodd', 'Even-odd']], function () { return curStyle().rule || 'nonzero'; }, function (v) { SV.applyStyle('rule', v); }, 'Fill rule')])
    ]));
  }

  /* ---------- Layers ---------- */
  var layersSig = '', expandedObjs = {}, renaming = null;
  function buildLayers() {
    var body = panelEls.layers.body;
    var list = h('div', { class: 'layers', id: 'layersList', role: 'tree', 'aria-label': 'Layers' });
    var foot = h('div', { class: 'layers-foot' }, [
      h('span', { class: 'lcount mono', id: 'layerCount' }), h('span', { class: 'grow' }),
      ibtn(I.plus, 'Create New Layer', function () { newLayer(); }),
      ibtn(I.trash, 'Delete Selection / Layer', function () { deleteLayerOrSel(); })
    ]);
    body.appendChild(list); body.appendChild(foot);
    list.addEventListener('click', onLayerClick);
    list.addEventListener('dblclick', onLayerDbl);
    list.addEventListener('pointerdown', onLayerDown);
    bind('layers', renderLayers);
  }
  function newLayer() {
    var n = S.doc.layers.length + 1, L = SV.mk.layer('Layer ' + n, SV.LAYER_COLORS[(n - 1) % SV.LAYER_COLORS.length]);
    var idx = S.doc.layers.indexOf(SV.activeLayer());
    S.doc.layers.splice(idx + 1, 0, L); S.activeLayer = L.id;
    SV.commit('new layer');
  }
  function deleteLayerOrSel() {
    if (S.sel.length) { C.deleteSel(); return; }
    if (S.doc.layers.length <= 1) return UI.toast('A document needs at least one layer');
    var L = SV.activeLayer(), i = S.doc.layers.indexOf(L);
    S.doc.layers.splice(i, 1); S.activeLayer = S.doc.layers[max(0, i - 1)].id;
    SV.commit('delete layer');
  }
  function layerSigNow() {
    return JSON.stringify([S.doc.layers.map(function (L) { return [L.id, L.name, L.hidden, L.locked, L.expanded, L.color, sigKids(L.children)]; }), S.sel, S.activeLayer, expandedObjs, renaming]);
  }
  function sigKids(arr) { return arr.map(function (o) { return [o.id, o.name, o.hidden, o.locked, o.type, o.type === 'text' ? o.text.slice(0, 24) : '', o.type === 'group' ? sigKids(o.children) : 0]; }); }
  function renderLayers() {
    var ae = document.activeElement;
    if (renaming && ae && ae.classList && ae.classList.contains('lrename')) return;
    var sig = layerSigNow(); if (sig === layersSig) return; layersSig = sig;
    var list = document.getElementById('layersList'); list.innerHTML = '';
    var selSet = new Set(S.sel), anySelIn = function (o) { if (selSet.has(o.id)) return true; return o.type === 'group' && o.children.some(anySelIn); };
    for (var li = S.doc.layers.length - 1; li >= 0; li--) {
      var L = S.doc.layers[li];
      var lsel = L.children.some(anySelIn);
      list.appendChild(row(L, 'layer', 0, L.color, L.id === S.activeLayer, lsel, L.expanded, L.children.length > 0, L));
      if (L.expanded) addKids(list, L.children, 1, L, selSet, anySelIn);
    }
    document.getElementById('layerCount').textContent = S.doc.layers.length + (S.doc.layers.length === 1 ? ' Layer' : ' Layers');
    var ri = list.querySelector('.lrename');
    if (ri) { ri.focus(); ri.select(); }
  }
  function addKids(list, arr, depth, L, selSet, anySelIn) {
    for (var i = arr.length - 1; i >= 0; i--) {
      var o = arr[i], isG = o.type === 'group', exp = !!expandedObjs[o.id];
      list.appendChild(row(o, 'obj', depth, L.color, false, selSet.has(o.id), exp, isG, L, anySelIn(o) && !selSet.has(o.id)));
      if (isG && exp) addKids(list, o.children, depth + 1, L, selSet, anySelIn);
    }
  }
  function row(o, kind, depth, color, active, selected, expanded, canExpand, L, partial) {
    var name = kind === 'layer' ? o.name : SV.objDisplayName(o);
    var r = h('div', { class: 'lrow ' + kind + (active ? ' active' : '') + (selected && kind === 'obj' ? ' selected' : '') + (o.hidden ? ' is-hidden' : '') + (o.locked ? ' is-locked' : ''), 'data-id': o.id, 'data-kind': kind, role: 'treeitem', 'aria-selected': selected ? 'true' : 'false', style: { '--depth': depth, '--lc': color } });
    r.appendChild(h('button', { type: 'button', class: 'leye', title: o.hidden ? 'Show' : 'Hide', 'aria-label': (o.hidden ? 'Show ' : 'Hide ') + name, html: o.hidden ? I.eyeOff : I.eye }));
    r.appendChild(h('button', { type: 'button', class: 'llock' + (o.locked ? ' on' : ''), title: o.locked ? 'Unlock' : 'Lock', 'aria-label': (o.locked ? 'Unlock ' : 'Lock ') + name, html: o.locked ? I.lock : I.unlock }));
    r.appendChild(h('span', { class: 'lind' }));
    r.appendChild(canExpand ? h('button', { type: 'button', class: 'ltw' + (expanded ? ' open' : ''), 'aria-label': expanded ? 'Collapse' : 'Expand', html: I.caret }) : h('span', { class: 'ltw-sp' }));
    if (kind === 'layer') r.appendChild(h('span', { class: 'lcolor' }));
    else r.appendChild(h('span', { class: 'ltype', html: typeGlyph(o) }));
    if (renaming === o.id) {
      var inp = h('input', { class: 'lrename', type: 'text', value: o.name || name, 'aria-label': 'Rename' });
      var done = function (save) { if (renaming !== o.id) return; renaming = null; layersSig = ''; if (save && inp.value.trim()) { o.name = inp.value.trim(); SV.commit('rename'); } else { layersSig = ''; SV.requestRender(true); } };
      inp.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); });
      inp.addEventListener('blur', function () { done(true); });
      r.appendChild(inp);
    } else r.appendChild(h('span', { class: 'lname', text: name, title: name }));
    r.appendChild(h('button', { type: 'button', class: 'ltarget' + (selected ? ' on' : '') + (partial ? ' part' : ''), title: kind === 'layer' ? 'Select all on layer' : 'Select', 'aria-label': 'Select ' + name }));
    return r;
  }
  function typeGlyph(o) {
    var m = { path: '<path d="M4 18C8 6 16 18 20 6"/>', rect: '<rect x="5" y="7" width="14" height="10"/>', ellipse: '<ellipse cx="12" cy="12" rx="7" ry="5"/>', polygon: '<path d="M12 5l7 4v6l-7 4-7-4V9z"/>', star: '<path d="M12 4l2.3 5 5.2.6-3.9 3.5 1.1 5.2L12 15.6l-4.7 2.7 1.1-5.2-3.9-3.5 5.2-.6z"/>', text: '<path d="M6 7V5h12v2M12 5v14M9 19h6"/>', image: '<rect x="4" y="5" width="16" height="14"/><path d="M4 16l5-5 4 4 2-2 5 5"/>', group: '<rect x="4" y="4" width="10" height="10"/><rect x="10" y="10" width="10" height="10"/>' };
    return '<svg viewBox="0 0 24 24" class="ic">' + (m[o.type] || m.path) + '</svg>';
  }
  function findLayerOrObj(id) { var L = SV.getLayer(id); if (L) return { kind: 'layer', o: L }; var o = getObj(id); return o ? { kind: 'obj', o: o } : null; }
  var layerDrag = null, lastRowClick = { id: null, t: 0 };
  function onLayerClick(e) {
    if (layerDrag && layerDrag.moved) return;
    var r = e.target.closest('.lrow'); if (!r) return;
    var id = r.getAttribute('data-id'), f = findLayerOrObj(id); if (!f) return;
    var now = Date.now(), isDbl = lastRowClick.id === id && now - lastRowClick.t < 450 && !!e.target.closest('.lname');
    lastRowClick = { id: id, t: isDbl ? 0 : now };
    if (isDbl) { renaming = id; layersSig = ''; renderLayers(); return; }
    var o = f.o;
    if (e.target.closest('.leye')) { o.hidden = !o.hidden; if (o.hidden) S.sel = S.sel.filter(function (s) { var t = getObj(s); return t && SV.isEditable(t); }); SV.commit(o.hidden ? 'hide' : 'show'); return; }
    if (e.target.closest('.llock')) { o.locked = !o.locked; if (o.locked) S.sel = S.sel.filter(function (s) { var t = getObj(s); return t && SV.isEditable(t); }); SV.commit(o.locked ? 'lock' : 'unlock'); return; }
    if (e.target.closest('.ltw')) { if (f.kind === 'layer') { o.expanded = !o.expanded; SV.requestRender(true); } else { expandedObjs[id] = !expandedObjs[id]; SV.requestRender(true); } return; }
    if (f.kind === 'layer') {
      S.activeLayer = id;
      if (e.target.closest('.ltarget')) { if (o.hidden || o.locked) return UI.toast('Layer is ' + (o.hidden ? 'hidden' : 'locked'), 'warn'); SV.select(o.children.filter(function (c) { return !c.hidden && !c.locked; }).map(function (c) { return c.id; })); return; }
      SV.requestRender(true); return;
    }
    if (!SV.isEditable(o)) { UI.toast('Object is ' + (o.locked ? 'locked' : 'hidden or on a locked layer'), 'warn'); return; }
    if (e.shiftKey || e.ctrlKey || e.metaKey) { var ns = S.sel.slice(), k = ns.indexOf(id); if (k >= 0) ns.splice(k, 1); else ns.push(id); SV.select(ns); }
    else SV.select([id]);
    if (S.tool === 'direct') { S.psel = {}; SV.leaves(o).forEach(function (l) { SV.selectAllPoints(l); }); }
  }
  function onLayerDbl(e) {
    var r = e.target.closest('.lrow'); if (!r || !e.target.closest('.lname') || renaming) return;
    renaming = r.getAttribute('data-id'); layersSig = ''; renderLayers();
  }
  function onLayerDown(e) {
    var r = e.target.closest('.lrow'); if (!r || e.target.closest('button') || e.target.closest('input') || e.button !== 0) return;
    layerDrag = { id: r.getAttribute('data-id'), kind: r.getAttribute('data-kind'), y0: e.clientY, x0: e.clientX, moved: false, pid: e.pointerId };
    var list = document.getElementById('layersList');
    var mv = function (ev) {
      if (!layerDrag) return;
      if (!layerDrag.moved && abs(ev.clientY - layerDrag.y0) < 5) return;
      layerDrag.moved = true; ev.preventDefault();
      list.classList.add('dragging');
      var el = document.elementFromPoint(ev.clientX, ev.clientY), tr = el && el.closest ? el.closest('.lrow') : null;
      list.querySelectorAll('.drop-before,.drop-after,.drop-into').forEach(function (x) { x.classList.remove('drop-before', 'drop-after', 'drop-into'); });
      layerDrag.target = null;
      if (!tr || tr.getAttribute('data-id') === layerDrag.id) return;
      var rr = tr.getBoundingClientRect(), rel = (ev.clientY - rr.top) / rr.height, tk = tr.getAttribute('data-kind');
      var pos = rel < 0.5 ? 'before' : 'after';
      if (layerDrag.kind === 'obj' && tk === 'layer' && rel > 0.25 && rel < 0.75) pos = 'into';
      if (layerDrag.kind === 'layer' && tk !== 'layer') return;
      tr.classList.add('drop-' + pos);
      layerDrag.target = { id: tr.getAttribute('data-id'), kind: tk, pos: pos };
    };
    var up = function () {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      list.classList.remove('dragging');
      list.querySelectorAll('.drop-before,.drop-after,.drop-into').forEach(function (x) { x.classList.remove('drop-before', 'drop-after', 'drop-into'); });
      var d = layerDrag;
      setTimeout(function () { layerDrag = null; }, 0);
      if (!d || !d.moved || !d.target) return;
      applyLayerDrop(d);
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  }
  function applyLayerDrop(d) {
    var t = d.target;
    if (d.kind === 'layer') {
      var Ls = S.doc.layers, src = SV.getLayer(d.id), dst = SV.getLayer(t.id); if (!src || !dst) return;
      Ls.splice(Ls.indexOf(src), 1);
      var di = Ls.indexOf(dst);
      Ls.splice(t.pos === 'before' ? di + 1 : di, 0, src);
      SV.commit('reorder layers'); return;
    }
    var f = SV.find(d.id); if (!f) return;
    var obj = f.obj;
    if (t.kind === 'obj') { var tObj = getObj(t.id); if (!tObj) return; if ((function c(o) { if (o.id === t.id) return true; return o.type === 'group' && o.children.some(c); })(obj)) return; }
    f.arr.splice(f.idx, 1);
    if (t.kind === 'layer') {
      var L = SV.getLayer(t.id);
      if (t.pos === 'into' || t.pos === 'after') L.children.push(obj); else { var li = S.doc.layers.indexOf(L), above = S.doc.layers[li + 1] || L; above.children.unshift(obj); }
      L.expanded = true;
    } else {
      var tf = SV.find(t.id); if (!tf) { f.arr.splice(f.idx, 0, obj); return; }
      tf.arr.splice(t.pos === 'before' ? tf.idx + 1 : tf.idx, 0, obj);
    }
    SV.commit('reorder');
  }

  /* ---------- Swatches ---------- */
  var DEFAULT_SWATCHES = [null, '#ffffff', '#0a0a0a', '#f1ede4', '#d4ff3a', '#b8e600', '#7fae00', '#ff3d8b', '#ff7eb6', '#7a5cff', '#3a7bff', '#00c2b8', '#2ecc71', '#ffe14d', '#ff8a00', '#ff4d4d', '#8b5a2b', '#e6e6e6', '#bdbdbd', '#8a8a8a', '#4a4a4a', '#262626',
    { type: 'radial', cx: 0.4, cy: 0.35, r: 0.7, fx: 0.35, fy: 0.3, stops: [{ o: 0, c: '#f6ffc4', a: 1 }, { o: 0.45, c: '#d4ff3a', a: 1 }, { o: 1, c: '#6e9a00', a: 1 }], name: 'Slime' },
    { type: 'linear', x1: 0, y1: 0, x2: 1, y2: 1, stops: [{ o: 0, c: '#ff3d8b', a: 1 }, { o: 1, c: '#ff8a00', a: 1 }], name: 'Toxic Sunset' },
    { type: 'linear', x1: 0, y1: 0, x2: 1, y2: 0, stops: [{ o: 0, c: '#7a5cff', a: 1 }, { o: 1, c: '#00c2b8', a: 1 }], name: 'Synth' },
    { type: 'linear', x1: 0.5, y1: 0, x2: 0.5, y2: 1, stops: [{ o: 0, c: '#f1ede4', a: 1 }, { o: 1, c: '#0a0a0a', a: 1 }], name: 'Bone to Ink' }];
  var selSwatch = -1;
  function swatches() { return S.doc.swatches || DEFAULT_SWATCHES; }
  function buildSwatches() {
    var body = panelEls.swatches.body;
    var grid = h('div', { class: 'swgrid', id: 'swgrid', role: 'listbox', 'aria-label': 'Swatches' });
    body.appendChild(grid);
    body.appendChild(h('div', { class: 'layers-foot' }, [
      h('span', { class: 'lcount', text: 'Click to apply to ' }), h('span', { class: 'lcount strong', id: 'swFocus' }), h('span', { class: 'grow' }),
      ibtn(I.plus, 'New Swatch from current ' + 'color', function () {
        var p = SV.currentPaint(S.focus); if (p === undefined) return;
        var list = swatches().slice(); list.push(clone(p)); S.doc.swatches = list; SV.commit('add swatch'); UI.toast('Swatch added');
      }),
      ibtn(I.trash, 'Delete Swatch', function () {
        if (selSwatch < 0) return UI.toast('Alt-click or select a swatch first');
        var list = swatches().slice(); list.splice(selSwatch, 1); S.doc.swatches = list; selSwatch = -1; SV.commit('delete swatch');
      })
    ]));
    var sig = '';
    bind('swatches', function () {
      document.getElementById('swFocus').textContent = S.focus === 'fill' ? 'Fill' : 'Stroke';
      var s = JSON.stringify([swatches(), selSwatch]); if (s === sig) return; sig = s;
      grid.innerHTML = '';
      swatches().forEach(function (p, i) {
        var b = h('button', { type: 'button', class: 'sw' + (p && typeof p === 'object' ? ' grad' : '') + (i === selSwatch ? ' on' : ''), role: 'option', title: !p ? 'None' : typeof p === 'string' ? p.toUpperCase() : (p.name || 'Gradient'), 'aria-label': !p ? 'None' : typeof p === 'string' ? p : (p.name || 'Gradient') }, [h('span', { class: 'chip-in' })]);
        paintBG(b.firstChild, p);
        b.addEventListener('click', function (e) {
          if (e.altKey) { selSwatch = i; var list = swatches().slice(); list.splice(i, 1); S.doc.swatches = list; selSwatch = -1; SV.commit('delete swatch'); return; }
          selSwatch = i;
          var v = clone(p); if (v && typeof v === 'object') delete v.name;
          SV.applyStyle(S.focus, v);
        });
        grid.appendChild(b);
      });
    });
  }

  /* ---------- Gradient ---------- */
  var gStop = 0;
  function gradTargetPaint() { var p = SV.currentPaint(S.focus); return p && typeof p === 'object' ? p : null; }
  function setGrad(fn, commit) {
    var p = clone(gradTargetPaint()); if (!p) return;
    fn(p); SV.applyStyle(S.focus, p, { commit: commit !== false });
  }
  function buildGradient() {
    var body = panelEls.gradient.body, g = 'grad';
    var empty = h('div', { class: 'gempty' }, [h('div', { class: 'gpreview big', style: { background: 'linear-gradient(90deg,#fff,#d4ff3a)' } }), h('p', { class: 'tip', text: 'The current ' }), btn('Apply Gradient', function () { SV.applyStyle(S.focus, SV.defaultGradient(SV.currentPaint(S.focus))); }, 'primary')]);
    var tipP = empty.querySelector('.tip');
    var ed = h('div', { class: 'geditor' });
    var target = seg(g, [['fill', 'Fill', 'Edit fill'], ['stroke', 'Stroke', 'Edit stroke']], function () { return S.focus; }, function (v) { S.focus = v; SV.requestRender(true); }, 'Gradient target');
    var typeSeg = seg(g, [['linear', 'Linear', 'Linear gradient'], ['radial', 'Radial', 'Radial gradient']], function () { var p = gradTargetPaint(); return p && p.type; }, function (v) {
      setGrad(function (p) { if (p.type === v) return; p.type = v; if (v === 'radial') { p.cx = p.cy = p.fx = p.fy = 0.5; p.r = 0.5; delete p.x1; delete p.y1; delete p.x2; delete p.y2; } else { p.x1 = 0; p.y1 = 0.5; p.x2 = 1; p.y2 = 0.5; delete p.cx; delete p.cy; delete p.r; delete p.fx; delete p.fy; } });
    }, 'Gradient type');
    var bar = h('div', { class: 'gbar', title: 'Click to add a stop · drag stops · drag a stop down to remove' });
    var barFill = h('div', { class: 'gbar-fill' }); bar.appendChild(barFill);
    var stopsBox = h('div', { class: 'gstops' }); bar.appendChild(stopsBox);
    var angle = numIn(g, { label: 'Angle', step: 1, get: function () { var p = gradTargetPaint(); if (!p || p.type !== 'linear') return null; return round(-Math.atan2(p.y2 - p.y1, p.x2 - p.x1) * 180 / PI); }, set: function (v) { setGrad(function (p) { var a = -v * PI / 180, c = Math.cos(a) / 2, s = Math.sin(a) / 2; p.x1 = 0.5 - c; p.y1 = 0.5 - s; p.x2 = 0.5 + c; p.y2 = 0.5 + s; }); }, enabled: function () { var p = gradTargetPaint(); return p && p.type === 'linear'; } });
    var stopChip = h('button', { type: 'button', class: 'chip small', title: 'Stop color', 'aria-label': 'Stop color' }, [h('span', { class: 'chip-in' })]);
    stopChip.addEventListener('click', function () {
      var p = gradTargetPaint(); if (!p) return; var sIdx = min(gStop, p.stops.length - 1);
      UI.pickColor(stopChip, p.stops[sIdx].c, function (hex) { setGrad(function (q) { q.stops[sIdx].c = hex; }, false); }, function (v, changed) { if (changed) SV.commit('gradient stop'); }, { title: 'Gradient stop' });
    });
    var stopOp = numIn(g, { label: 'Stop opacity', min: 0, max: 100, get: function () { var p = gradTargetPaint(); if (!p) return null; var s = p.stops[min(gStop, p.stops.length - 1)]; return round((s.a == null ? 1 : s.a) * 100); }, set: function (v) { setGrad(function (p) { p.stops[min(gStop, p.stops.length - 1)].a = v / 100; }); }, cls: 'w44' });
    var stopLoc = numIn(g, { label: 'Stop location', min: 0, max: 100, get: function () { var p = gradTargetPaint(); if (!p) return null; return round(p.stops[min(gStop, p.stops.length - 1)].o * 100); }, set: function (v) { setGrad(function (p) { p.stops[min(gStop, p.stops.length - 1)].o = v / 100; }); }, cls: 'w44' });
    ed.appendChild(h('div', { class: 'arow' }, [target, typeSeg]));
    ed.appendChild(bar);
    ed.appendChild(h('div', { class: 'arow' }, [field('Angle', angle, '°'), h('span', { class: 'grow' }), btn('Reverse', function () { setGrad(function (p) { p.stops = p.stops.map(function (s) { return { o: 1 - s.o, c: s.c, a: s.a }; }).reverse(); }); }, 'small')]));
    ed.appendChild(h('div', { class: 'arow' }, [h('span', { class: 'alabel', text: 'Stop' }), stopChip, field('Opacity', stopOp, '%'), field('Location', stopLoc, '%'), ibtn(I.trash, 'Delete stop', function () { setGrad(function (p) { if (p.stops.length > 2) { p.stops.splice(min(gStop, p.stops.length - 1), 1); gStop = 0; } }); })]));
    body.appendChild(empty); body.appendChild(ed);
    bar.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.gstop')) return;
      var p = gradTargetPaint(); if (!p) return;
      var r = bar.getBoundingClientRect(), o = SV.clamp((e.clientX - r.left) / r.width, 0, 1);
      var sorted = p.stops.slice().sort(function (a, b) { return a.o - b.o; }), c = sorted[0].c;
      for (var i = 0; i < sorted.length - 1; i++) if (o >= sorted[i].o && o <= sorted[i + 1].o) { var t = (o - sorted[i].o) / ((sorted[i + 1].o - sorted[i].o) || 1), A1 = hexToRgb(sorted[i].c), B1 = hexToRgb(sorted[i + 1].c); c = rgbToHex(A1[0] + (B1[0] - A1[0]) * t, A1[1] + (B1[1] - A1[1]) * t, A1[2] + (B1[2] - A1[2]) * t); }
      if (o > sorted[sorted.length - 1].o) c = sorted[sorted.length - 1].c;
      setGrad(function (q) { q.stops.push({ o: o, c: c, a: 1 }); gStop = q.stops.length - 1; });
    });
    var sig = '';
    bind(g, function () {
      var p = gradTargetPaint();
      empty.hidden = !!p; ed.hidden = !p;
      tipP.textContent = 'The current ' + (S.focus === 'fill' ? 'fill' : 'stroke') + ' is ' + (SV.currentPaint(S.focus) ? 'a solid color' : 'none') + '. Turn it into a gradient:';
      if (!p) return;
      barFill.style.background = gradCSS(Object.assign({}, p, { type: 'linear', x1: 0, y1: 0, x2: 1, y2: 0 }));
      paintBG(stopChip.firstChild, p.stops[min(gStop, p.stops.length - 1)].c);
      var s = JSON.stringify([p.stops, gStop]); if (s === sig) return; sig = s;
      stopsBox.innerHTML = '';
      p.stops.forEach(function (st, i) {
        var m = h('div', { class: 'gstop' + (i === gStop ? ' on' : ''), style: { left: (st.o * 100) + '%' }, title: 'Stop ' + round(st.o * 100) + '%' }, [h('span', { style: { background: st.c } })]);
        m.addEventListener('pointerdown', function (e) {
          e.preventDefault(); e.stopPropagation(); gStop = i; sig = '';
          var r = bar.getBoundingClientRect(), moved = false, removed = false;
          var mv = function (ev) {
            moved = true;
            removed = ev.clientY - r.bottom > 30 && p.stops.length > 2;
            m.style.opacity = removed ? 0.3 : 1;
            var o = SV.clamp((ev.clientX - r.left) / r.width, 0, 1);
            setGrad(function (q) { q.stops[i].o = o; }, false);
          };
          var up = function () {
            window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
            if (removed) setGrad(function (q) { q.stops.splice(i, 1); gStop = 0; });
            else if (moved) SV.commit('gradient stop');
            else SV.requestRender(true);
          };
          window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
        });
        stopsBox.appendChild(m);
      });
    });
  }

  /* ---------- Align ---------- */
  function buildAlign() {
    var body = panelEls.align.body, g = 'align';
    body.appendChild(h('div', { class: 'psec-title', text: 'Align Objects' }));
    body.appendChild(h('div', { class: 'ibtnrow' }, [ibtn(I.alignL, 'Horizontal Align Left', function () { C.align('left'); }), ibtn(I.alignHC, 'Horizontal Align Center', function () { C.align('hcenter'); }), ibtn(I.alignR, 'Horizontal Align Right', function () { C.align('right'); }), ibtn(I.alignT, 'Vertical Align Top', function () { C.align('top'); }), ibtn(I.alignVC, 'Vertical Align Center', function () { C.align('vcenter'); }), ibtn(I.alignB, 'Vertical Align Bottom', function () { C.align('bottom'); })]));
    body.appendChild(h('div', { class: 'psec-title', text: 'Distribute Objects' }));
    body.appendChild(h('div', { class: 'ibtnrow' }, [ibtn(I.distH, 'Horizontal Distribute Center', function () { C.distribute('hcenter'); }), ibtn(I.distV, 'Vertical Distribute Center', function () { C.distribute('vcenter'); }), ibtn(I.spaceH, 'Horizontal Distribute Space', function () { C.distribute('hspace'); }), ibtn(I.spaceV, 'Vertical Distribute Space', function () { C.distribute('vspace'); })]));
    body.appendChild(h('label', { class: 'fld col' }, [h('span', { class: 'fl', text: 'Align To' }), selIn(g, [['selection', 'Selection'], ['artboard', 'Artboard']], function () { return S.prefs.alignTo; }, function (v) { S.prefs.alignTo = v; savePrefs(); }, 'Align to')]));
  }
  /* ---------- Pathfinder ---------- */
  function buildPathfinder() {
    var body = panelEls.pathfinder.body;
    body.appendChild(h('div', { class: 'psec-title', text: 'Shape Modes' }));
    var pf = function (icon, label, id) { return h('button', { type: 'button', class: 'pfbtn', title: label, 'aria-label': label, html: icon + '<span>' + label + '</span>', onclick: function () { SV.runAction(id); } }); };
    body.appendChild(h('div', { class: 'pfrow' }, [pf(I.unite, 'Unite', 'pf.unite'), pf(I.minus, 'Minus Front', 'pf.minus'), pf(I.intersect, 'Intersect', 'pf.intersect'), pf(I.exclude, 'Exclude', 'pf.exclude')]));
    body.appendChild(h('div', { class: 'psec-title', text: 'Paths' }));
    body.appendChild(h('div', { class: 'btnrow' }, [btn('Make Compound', function () { SV.runAction('compound.make'); }, 'small'), btn('Release', function () { SV.runAction('compound.release'); }, 'small'), btn('Expand', function () { SV.runAction('object.expand'); }, 'small')]));
    body.appendChild(h('button', { type: 'button', class: 'btn slop wide', html: I.slop + '<span>Slopify</span>', title: 'Turn the selection into dripping slime', onclick: function () { SV.runAction('object.slopify'); } }));
  }

  /* ================= status bar ================= */
  var curPos = null;
  UI.setCursorPos = function (p) { curPos = p; var el = document.getElementById('sbPos'); if (el) el.textContent = 'X ' + SV.fmtNum(p.x) + '  Y ' + SV.fmtNum(p.y); };
  function buildStatus() {
    var sb = document.getElementById('statusbar');
    var zin = h('input', { class: 'zin mono', id: 'zoomIn', 'aria-label': 'Zoom level', type: 'text' });
    zin.addEventListener('change', function () { var v = parseFloat(zin.value); if (v > 0) SV.setZoom(v / 100); zin.blur(); });
    zin.addEventListener('keydown', function (e) { if (e.key === 'Enter') zin.dispatchEvent(new Event('change')); });
    var zsel = h('select', { class: 'zsel', 'aria-label': 'Zoom presets' }, [h('option', { value: '', text: '' })].concat([3200, 1600, 800, 400, 200, 150, 100, 66.67, 50, 33.33, 25, 12.5].map(function (z) { return h('option', { value: z, text: z + '%' }); })).concat([h('option', { value: 'fit', text: 'Fit Artboard' })]));
    zsel.addEventListener('change', function () { if (zsel.value === 'fit') SV.fitArtboard(); else if (zsel.value) SV.setZoom(parseFloat(zsel.value) / 100); zsel.value = ''; });
    sb.appendChild(h('div', { class: 'sb-zoom' }, [h('button', { type: 'button', class: 'sbb', title: 'Zoom out (' + keyLabel('mod+-') + ')', 'aria-label': 'Zoom out', text: '−', onclick: function () { SV.zoomStep(-1); } }), zin, zsel, h('button', { type: 'button', class: 'sbb', title: 'Zoom in (' + keyLabel('mod+=') + ')', 'aria-label': 'Zoom in', text: '+', onclick: function () { SV.zoomStep(1); } })]));
    sb.appendChild(h('span', { class: 'sb-item mono', id: 'sbArt' }));
    sb.appendChild(h('span', { class: 'sb-item mono', id: 'sbPos', text: 'X 0  Y 0' }));
    sb.appendChild(h('span', { class: 'sb-item', id: 'sbSel' }));
    sb.appendChild(h('span', { class: 'grow' }));
    sb.appendChild(h('span', { class: 'sb-item sb-flags', id: 'sbFlags' }));
    sb.appendChild(h('span', { class: 'sb-item sb-tool', id: 'sbTool' }));
    bind('status', function () {
      setVal(zin, (Math.round(S.view.zoom * 10000) / 100) + '%');
      document.getElementById('sbArt').textContent = 'Artboard ' + SV.fmtNum(S.doc.width) + ' × ' + SV.fmtNum(S.doc.height) + ' px';
      var n = S.sel.length;
      document.getElementById('sbSel').textContent = n ? n + ' selected' : '';
      var flags = [];
      if (S.prefs.smart) flags.push('Smart Guides'); if (S.prefs.snapGrid) flags.push('Snap'); if (S.prefs.outline) flags.push('Outline');
      document.getElementById('sbFlags').textContent = flags.join(' · ');
      var t = SV.TOOL_LIST.filter(function (x) { return x.id === S.tool; })[0];
      document.getElementById('sbTool').textContent = t ? t.name : '';
      var dirty = SV.isDirty();
      var title = S.doc.name + (dirty ? ' •' : '');
      document.getElementById('docTab').innerHTML = '<span class="dt-name">' + esc(S.doc.name) + '.svg</span><span class="dt-meta mono">@ ' + (Math.round(S.view.zoom * 1000) / 10) + '% (RGB/' + (S.prefs.outline ? 'Outline' : 'Preview') + ')</span>' + (dirty ? '<span class="dt-dirty" title="Unsaved changes">●</span>' : '');
      document.getElementById('docTitle').textContent = title;
      document.title = (dirty ? '• ' : '') + 'Slop Vector — Slopographic';
    });
  }

  /* ================= rulers ================= */
  function applyRulers() { document.getElementById('workspace').classList.toggle('no-rulers', !S.prefs.rulers); }
  var rulerColors = null;
  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  SV.drawRulers = function () {
    if (!S.prefs.rulers) return;
    if (!rulerColors) rulerColors = { bg: cssVar('--ruler-bg') || '#2b2b2b', fg: cssVar('--ruler-fg') || '#999', tick: cssVar('--ruler-tick') || '#666', acc: cssVar('--accent-line') || '#d4ff3a' };
    ['rulerH', 'rulerV'].forEach(function (id) {
      var c = document.getElementById(id); if (!c) return;
      var horiz = id === 'rulerH', dpr = window.devicePixelRatio || 1, w = c.clientWidth, hh = c.clientHeight;
      if (!w || !hh) return;
      if (c.width !== round(w * dpr) || c.height !== round(hh * dpr)) { c.width = round(w * dpr); c.height = round(hh * dpr); }
      var x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
      x.fillStyle = rulerColors.bg; x.fillRect(0, 0, w, hh);
      var z = S.view.zoom, off = horiz ? S.view.x : S.view.y, len = horiz ? w : hh;
      var steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000], major = steps[steps.length - 1];
      for (var i = 0; i < steps.length; i++) if (steps[i] * z >= 64) { major = steps[i]; break; }
      var minor = major / 10; if (minor * z < 4) minor = major / 5; if (minor * z < 4) minor = major / 2;
      x.strokeStyle = rulerColors.tick; x.fillStyle = rulerColors.fg; x.lineWidth = 1;
      x.font = '9px ' + (cssVar('--mono') || 'monospace'); x.textBaseline = 'top';
      var start = Math.floor(-off / z / minor) * minor, end = (len - off) / z;
      x.beginPath();
      for (var v = start; v <= end; v += minor) {
        var s = round(v * z + off) + 0.5, isMaj = abs(v / major - round(v / major)) < 1e-6, half = abs(v / (major / 2) - round(v / (major / 2))) < 1e-6;
        var tl = isMaj ? (horiz ? hh : w) : half ? (horiz ? hh : w) * 0.45 : (horiz ? hh : w) * 0.25;
        if (horiz) { x.moveTo(s, hh); x.lineTo(s, hh - tl); } else { x.moveTo(w, s); x.lineTo(w - tl, s); }
        if (isMaj) {
          var label = String(round(v));
          if (horiz) x.fillText(label, s + 3, 2);
          else { x.save(); x.translate(2, s + 3); x.rotate(PI / 2); x.translate(0, -9); x.fillText(label, 0, 0); x.restore(); }
        }
      }
      x.stroke();
      x.strokeStyle = rulerColors.tick; x.beginPath(); if (horiz) { x.moveTo(0, hh - 0.5); x.lineTo(w, hh - 0.5); } else { x.moveTo(w - 0.5, 0); x.lineTo(w - 0.5, hh); } x.stroke();
      if (curPos) {
        var cp = round((horiz ? curPos.x : curPos.y) * z + off) + 0.5;
        x.strokeStyle = rulerColors.acc; x.beginPath(); if (horiz) { x.moveTo(cp, 0); x.lineTo(cp, hh); } else { x.moveTo(0, cp); x.lineTo(w, cp); } x.stroke();
      }
    });
  };
  function bindRulers() {
    ['rulerH', 'rulerV'].forEach(function (id) {
      var c = document.getElementById(id);
      c.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        var axis = id === 'rulerH' ? 'h' : 'v';
        S.guideDrag = { axis: axis, pos: 0, out: true };
        var stage = D.stage;
        var mv = function (ev) {
          var r = stage.getBoundingClientRect(), p = SV.toDoc(ev.clientX - r.left, ev.clientY - r.top);
          S.guideDrag.pos = axis === 'v' ? p.x : p.y;
          if (S.prefs.snapGrid) { var gs = S.prefs.gridSize; S.guideDrag.pos = round(S.guideDrag.pos / gs) * gs; }
          S.guideDrag.out = !(ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom);
          SV.requestRender();
        };
        var up = function () {
          window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
          S.prefs.guides = true;
          SV.endGuideDrag();
        };
        window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
      });
    });
    document.getElementById('rulerCorner').addEventListener('dblclick', function () { SV.fitArtboard(); });
  }

  /* ================= dialogs (shared SlopUI kit) ================= */
  // Thin adapter: app dialogs describe { title, body, buttons:[{label, primary, danger, left, onClick}], cls }
  // and render through window.SlopUI (../shared/slopui.js), shared with PhotoSLOP and Slop PDF.
  function dialog(opts) {
    var body = opts.body;
    if (typeof body === 'string') body = h('div', { class: 'sv-dlg-body', html: body });
    var specs = opts.buttons || [{ label: 'OK', primary: true }];
    var d = window.SlopUI.dialog({
      title: opts.title, body: body, dismissable: true,
      cls: 'sv-dlg ' + (opts.cls === 'wide' ? 'sui-wide' : (opts.cls || '')),
      buttons: specs.map(function (b) { return { label: b.label, primary: !!b.primary, danger: !!b.danger, act: b.onClick ? function () { return b.onClick(); } : undefined }; }),
      onClose: function (ok) { if (opts.onClose) opts.onClose(ok); }
    });
    var foot = d.box.querySelector('.sui-foot');
    if (foot) specs.forEach(function (b, i) { if (b.left && foot.children[i]) foot.children[i].classList.add('sv-left'); });
    return d;
  }
  UI.dialog = dialog;
  UI.handleGlobalKey = function (e) {
    if (picker && e.key === 'Escape') { e.preventDefault(); UI.closePicker(); return true; }
    // SlopUI dialogs handle their own keys (and stop propagation); anything reaching us while one is open
    // came from outside it, so keep app shortcuts quiet.
    if (window.SlopUI && window.SlopUI.openDialogs > 0) {
      if (!(e.ctrlKey || e.metaKey) && !(e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName))) e.preventDefault();
      return true;
    }
    if (openMenu !== null && e.key === 'Escape') { UI.closeMenus(); e.preventDefault(); return true; }
    return false;
  };
  function form(fields) {
    var U = window.SlopUI, wrap = h('div', { class: 'sv-form' }), refs = {};
    fields.forEach(function (f) {
      if (f.type === 'note') { wrap.appendChild(h('p', { class: 'sui-p', html: f.html || esc(f.text) })); return; }
      var inp;
      if (f.type === 'select') inp = U.select(f.options, f.value);
      else if (f.type === 'checkbox') { var c = U.check(f.label, f.value); c.input.id = 'f-' + f.id; refs[f.id] = c.input; wrap.appendChild(h('div', { class: 'sv-check' }, [c.el])); return; }
      else if (f.type === 'text') { inp = U.el('input', { class: 'sui-input', type: 'text' }); inp.value = f.value; }
      else inp = U.number(f.value, f.min, f.max, f.step || 'any');
      inp.id = 'f-' + f.id;
      if (f.onChange) inp.addEventListener(f.type === 'select' ? 'change' : 'input', function () { f.onChange(inp.value, refs); });
      refs[f.id] = inp;
      wrap.appendChild(U.field(f.label, inp, f.unit));
    });
    return { el: wrap, refs: refs, val: function (id) { var r = refs[id]; if (!r) return null; if (r.type === 'checkbox') return r.checked; if (r.type === 'number') return parseFloat(r.value); return r.value; } };
  }
  var PRESETS = [['letter', 'Letter (612 × 792)', 612, 792], ['a4', 'A4 (595 × 842)', 595.28, 841.89], ['square', 'Instagram (1080 × 1080)', 1080, 1080], ['hd', 'HD (1920 × 1080)', 1920, 1080], ['slop', 'Slop Default (1200 × 800)', 1200, 800], ['story', 'Story (1080 × 1920)', 1080, 1920], ['custom', 'Custom', null, null]];
  function newDocDialog() {
    var f = form([
      { id: 'name', label: 'Name', type: 'text', value: 'Untitled-' + S.docCounter },
      { id: 'preset', label: 'Preset', type: 'select', value: 'slop', options: PRESETS.map(function (p) { return [p[0], p[1]]; }), onChange: function (v, refs) { var p = PRESETS.filter(function (x) { return x[0] === v; })[0]; if (p && p[2]) { refs.w.value = p[2]; refs.h.value = p[3]; } } },
      { id: 'w', label: 'Width', value: 1200, min: 1, max: 20000, unit: 'px' },
      { id: 'h', label: 'Height', value: 800, min: 1, max: 20000, unit: 'px' },
      { type: 'note', text: 'The current document is replaced (Undo brings it back). Units: 1 px = 1 pt.' }
    ]);
    ['w', 'h'].forEach(function (k) { f.refs[k].addEventListener('input', function () { f.refs.preset.value = 'custom'; }); });
    dialog({ title: 'New Document', body: f.el, buttons: [{ label: 'Cancel' }, { label: 'Create', primary: true, onClick: function () {
      var w = f.val('w'), hh = f.val('h'); if (!(w > 0 && hh > 0)) { UI.toast('Enter a valid size', 'warn'); return false; }
      S.docCounter++;
      SV.loadDoc(SV.newDoc(w, hh, f.val('name') || 'Untitled'), { fit: true });
      S.fileName = null;
      SV.clearAutosave();
      SV.commit('new document'); SV.markSaved();
      UI.toast('New document · ' + w + ' × ' + hh + ' px');
    } }] });
  }
  function docSetupDialog() {
    var f = form([{ id: 'name', label: 'Name', type: 'text', value: S.doc.name }, { id: 'w', label: 'Width', value: S.doc.width, min: 1, unit: 'px' }, { id: 'h', label: 'Height', value: S.doc.height, min: 1, unit: 'px' }, { id: 'preset', label: 'Preset', type: 'select', value: 'custom', options: PRESETS.map(function (p) { return [p[0], p[1]]; }), onChange: function (v, refs) { var p = PRESETS.filter(function (x) { return x[0] === v; })[0]; if (p && p[2]) { refs.w.value = p[2]; refs.h.value = p[3]; } } }]);
    dialog({ title: 'Document Setup', body: f.el, buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, onClick: function () { var w = f.val('w'), hh = f.val('h'); if (!(w > 0 && hh > 0)) return false; S.doc.width = w; S.doc.height = hh; S.doc.name = f.val('name') || S.doc.name; SV.commit('document setup'); SV.fitArtboard(); } }] });
  }
  function saveAsDialog() {
    return window.SlopUI.prompt('Save As', 'File name', S.doc.name, { ok: 'Save' }).then(function (name) {
      if (name == null) return;
      IO.saveSVG((String(name).trim() || 'Untitled').replace(/\.svg$/i, ''));
    });
  }
  function rasterDialog(type) {
    var f = form([{ id: 'scale', label: 'Resolution', type: 'select', value: '1', options: [['1', '1× (' + S.doc.width + ' × ' + S.doc.height + ')'], ['2', '2× (' + S.doc.width * 2 + ' × ' + S.doc.height * 2 + ')'], ['4', '4× (' + S.doc.width * 4 + ' × ' + S.doc.height * 4 + ')']] }].concat(type === 'png' ? [{ id: 'transparent', type: 'checkbox', label: 'Transparent background', value: false }] : [{ id: 'q', label: 'Quality', value: 92, min: 10, max: 100, unit: '%' }]).concat([{ type: 'note', text: 'Artboard ' + S.doc.width + ' × ' + S.doc.height + ' px. Web fonts fall back to system fonts in raster exports.' }]));
    dialog({ title: 'Export as ' + type.toUpperCase(), body: f.el, buttons: [{ label: 'Cancel' }, { label: 'Export', primary: true, onClick: function () { IO.exportRaster(type, parseFloat(f.val('scale')) || 1, type === 'png' ? f.val('transparent') : false, type === 'jpg' ? (f.val('q') || 92) / 100 : undefined); } }] });
  }
  function pdfDialog(asAI) {
    var body = asAI
      ? '<p class="sui-p">Modern Adobe Illustrator <b>.ai</b> files are PDF-based, so Illustrator opens the same PDF bytes. Slop Vector writes a clean PDF&nbsp;1.4 (vector paths, gradients, opacity, blend modes, Helvetica/Times/Courier text) and saves it with an <b>.ai</b> extension.</p><p class="sui-p">It opens in Illustrator, Affinity, Inkscape and every PDF viewer. Live effects stay as plain vectors; fonts map to the standard PDF fonts.</p>'
      : '<p class="sui-p">Writes a real vector PDF&nbsp;1.4 by hand: paths with fills and strokes, opacity and blend modes, linear and radial gradients (as PDF shadings), embedded images, and text set in the standard Helvetica/Times/Courier fonts.</p>';
    dialog({ title: asAI ? 'Export as .ai (PDF-compatible)' : 'Export as PDF', body: body, buttons: [{ label: 'Cancel' }, { label: 'Export', primary: true, onClick: function () { IO.exportPDF(asAI); } }] });
  }
  function prefsDialog() {
    var f = form([{ id: 'inc', label: 'Keyboard increment', value: S.prefs.keyInc, min: 0.01, unit: 'px' }, { id: 'grid', label: 'Grid size', value: S.prefs.gridSize, min: 1, unit: 'px' }, { id: 'scale', type: 'checkbox', label: 'Scale strokes when scaling objects', value: S.prefs.scaleStrokes }, { id: 'smart', type: 'checkbox', label: 'Smart guides & snapping', value: S.prefs.smart }]);
    dialog({ title: 'Preferences', body: f.el, buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, onClick: function () { S.prefs.keyInc = f.val('inc') || 1; S.prefs.gridSize = f.val('grid') || 10; S.prefs.scaleStrokes = f.val('scale'); S.prefs.smart = f.val('smart'); savePrefs(); SV.requestRender(true); } }] });
  }
  UI.shapeDialog = function (kind, p0) {
    var fields, make;
    var st = function () { return SV.newStyle(kind === 'line' ? 'line' : 'shape'); };
    if (kind === 'rect' || kind === 'rrect' || kind === 'ellipse') {
      fields = [{ id: 'w', label: 'Width', value: 100, min: 0, unit: 'px' }, { id: 'h', label: 'Height', value: 100, min: 0, unit: 'px' }];
      if (kind === 'rrect') fields.push({ id: 'r', label: 'Corner radius', value: S.shape.radius, min: 0, unit: 'px' });
      make = function (f) { var w = f.val('w'), hh = f.val('h'); if (!(w > 0 && hh > 0)) return null; return kind === 'ellipse' ? SV.mk.ellipse(p0.x + w / 2, p0.y + hh / 2, w / 2, hh / 2, st()) : SV.mk.rect(p0.x, p0.y, w, hh, kind === 'rrect' ? (S.shape.radius = f.val('r') || 0) : 0, st()); };
    } else if (kind === 'polygon') {
      fields = [{ id: 'r', label: 'Radius', value: 50, min: 0, unit: 'px' }, { id: 'n', label: 'Sides', value: S.shape.sides, min: 3, max: 64 }];
      make = function (f) { var r = f.val('r'); if (!(r > 0)) return null; S.shape.sides = SV.clamp(round(f.val('n')) || 6, 3, 64); return SV.mk.polygon(p0.x, p0.y, r, S.shape.sides, st()); };
    } else if (kind === 'star') {
      fields = [{ id: 'r1', label: 'Radius 1', value: 50, min: 0, unit: 'px' }, { id: 'r2', label: 'Radius 2', value: 25, min: 0, unit: 'px' }, { id: 'n', label: 'Points', value: S.shape.points, min: 2, max: 64 }];
      make = function (f) { var r1 = f.val('r1'), r2 = f.val('r2'); if (!(r1 > 0)) return null; S.shape.points = SV.clamp(round(f.val('n')) || 5, 2, 64); return SV.mk.star(p0.x, p0.y, r1, r2, S.shape.points, st()); };
    } else if (kind === 'line') {
      fields = [{ id: 'l', label: 'Length', value: 100, min: 0, unit: 'px' }, { id: 'a', label: 'Angle', value: 0, unit: '°' }];
      make = function (f) { var l = f.val('l'), a = -(f.val('a') || 0) * PI / 180; if (!(l > 0)) return null; return SV.mk.path([{ closed: false, pts: [G.A(p0.x, p0.y), G.A(p0.x + Math.cos(a) * l, p0.y + Math.sin(a) * l)] }], st()); };
    } else return;
    var f = form(fields);
    var names = { rect: 'Rectangle', rrect: 'Rounded Rectangle', ellipse: 'Ellipse', polygon: 'Polygon', star: 'Star', line: 'Line Segment Tool Options' };
    dialog({ title: names[kind], body: f.el, buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, onClick: function () { var o = make(f); if (!o) { UI.toast('Enter a size greater than zero', 'warn'); return false; } if (SV.insertObj(o)) { SV.select([o.id]); SV.commit(kind); } } }] });
  };
  var lastT = { move: { h: 10, v: 0 }, rotate: { a: 45 }, scale: { u: 100, h: 100, v: 100, uni: true }, reflect: { axis: 'v' } };
  function transformDialog(kind) {
    if (!S.sel.length) return UI.toast('Select objects first');
    var b = SV.selBBox(), c = S.origin || { x: b.x + b.w / 2, y: b.y + b.h / 2 }, f, build;
    if (kind === 'move') { f = form([{ id: 'h', label: 'Horizontal', value: lastT.move.h, unit: 'px' }, { id: 'v', label: 'Vertical', value: lastT.move.v, unit: 'px' }]); build = function () { lastT.move = { h: f.val('h') || 0, v: f.val('v') || 0 }; return G.translate(lastT.move.h, lastT.move.v); }; }
    else if (kind === 'rotate') { f = form([{ id: 'a', label: 'Angle', value: lastT.rotate.a, unit: '°' }, { type: 'note', text: 'Positive angles rotate counter-clockwise.' }]); build = function () { lastT.rotate.a = f.val('a') || 0; return G.rotate(-lastT.rotate.a * PI / 180, c.x, c.y); }; }
    else if (kind === 'scale') {
      f = form([{ id: 'uni', type: 'checkbox', label: 'Uniform', value: lastT.scale.uni }, { id: 'u', label: 'Scale', value: lastT.scale.u, unit: '%' }, { id: 'h', label: 'Horizontal', value: lastT.scale.h, unit: '%' }, { id: 'v', label: 'Vertical', value: lastT.scale.v, unit: '%' }]);
      build = function () { var uni = f.val('uni'); lastT.scale = { uni: uni, u: f.val('u') || 100, h: f.val('h') || 100, v: f.val('v') || 100 }; var sx = (uni ? lastT.scale.u : lastT.scale.h) / 100, sy = (uni ? lastT.scale.u : lastT.scale.v) / 100; return G.scale(sx, sy, c.x, c.y); };
    } else {
      f = form([{ id: 'axis', label: 'Axis', type: 'select', value: lastT.reflect.axis, options: [['h', 'Horizontal'], ['v', 'Vertical']] }]);
      build = function () { lastT.reflect.axis = f.val('axis') || 'v'; return lastT.reflect.axis === 'h' ? G.scale(1, -1, c.x, c.y) : G.scale(-1, 1, c.x, c.y); };
    }
    var titles = { move: 'Move', rotate: 'Rotate', scale: 'Scale', reflect: 'Reflect' };
    dialog({ title: titles[kind], body: f.el, buttons: [{ label: 'Copy', left: true, onClick: function () { C.transformSel(build(), true, kind + ' copy'); } }, { label: 'Cancel' }, { label: 'OK', primary: true, onClick: function () { var M = build(); var a = kind === 'rotate' ? -lastT.rotate.a : 0; C.transformSel(M, false, kind); if (a) SV.selObjs().forEach(function (o) { if (o.type === 'path' || o.type === 'group') o.rot = SV.normAng((o.rot || 0) + a); }); } }] });
  }
  UI.transformDialog = transformDialog;
  function shortcutsDialog() {
    var wrap = h('div', { class: 'shortcuts' });
    var col1 = h('div', { class: 'sc-col' }), col2 = h('div', { class: 'sc-col' }), col3 = h('div', { class: 'sc-col' });
    function section(col, title, rows) {
      col.appendChild(h('h4', { text: title }));
      var tb = h('table', { class: 'sc-table' });
      rows.forEach(function (r) { tb.appendChild(h('tr', {}, [h('td', { text: r[0] }), h('td', {}, [h('kbd', { text: r[1] })])])); });
      col.appendChild(tb);
    }
    section(col1, 'Tools', SV.TOOL_LIST.map(function (t) { return [t.name, t.key]; }).concat([['Hand (temporary)', 'Space'], ['Swap fill/stroke focus', 'X'], ['Swap fill & stroke colors', 'Shift+X'], ['Default fill & stroke', 'D'], ['Color / Gradient / None', ', . /']]));
    function fromActs(ids) { return ids.map(function (id) { var a = A[id]; return [a.label.replace('…', ''), a.keyText || keyLabel(a.keys[0])]; }).filter(function (r) { return r[1]; }); }
    section(col2, 'File & Edit', fromActs(['file.new', 'file.open', 'file.place', 'file.save', 'file.saveAs', 'file.exportPNG', 'file.docSetup', 'edit.undo', 'edit.redo', 'edit.cut', 'edit.copy', 'edit.paste', 'edit.pasteFront', 'edit.pasteBack', 'edit.duplicate', 'select.all', 'select.none', 'edit.prefs']).concat([['Delete', 'Del / Backspace'], ['Nudge (×10 with Shift)', 'Arrow keys'], ['Move dialog', 'Enter']]));
    section(col3, 'Object & View', fromActs(['object.group', 'object.ungroup', 'arrange.front', 'arrange.forward', 'arrange.backward', 'arrange.back', 'transform.move', 'object.lock', 'object.unlockAll', 'object.hide', 'object.showAll', 'compound.make', 'object.slopify', 'view.zoomIn', 'view.zoomOut', 'view.fit', 'view.actual', 'view.outline', 'view.rulers', 'view.grid', 'view.snapGrid', 'view.smart', 'view.guides', 'window.togglePanels', 'help.shortcuts']).concat([['Constrain / proportional', 'Shift'], ['From centre / duplicate drag', 'Alt'], ['Zoom', (IS_MAC ? '⌘' : 'Ctrl') + '+wheel / pinch']]));
    wrap.appendChild(col1); wrap.appendChild(col2); wrap.appendChild(col3);
    dialog({ title: 'Keyboard Shortcuts', body: wrap, cls: 'wide', buttons: [{ label: 'Close', primary: true }] });
  }
  function aboutDialog() {
    var body = '<div class="about"><div class="about-mark">' + I.drop + '</div><div><h3>Slop Vector</h3><p class="mono">v1.0 · build ' + esc(String(SV.BUILD || '2026.10')) + '</p>' +
      '<p>A real vector editor that runs entirely in your browser: pen & pencil, live shapes, layers, gradients, pathfinder booleans, SVG/PDF/PNG export and a hand-written PDF writer. No accounts, no uploads, no tracking — your artwork never leaves this tab.</p>' +
      '<p>Part of <a href="../">Slopographic</a>, a museum of AI slop. The tool itself is, against all odds, not slop.</p>' +
      '<p class="sui-p">Tip: <b>File → Download App</b> saves a single offline .html copy of this whole editor.</p></div></div>';
    dialog({ title: 'About Slop Vector', body: body, buttons: [{ label: 'Download App', left: true, onClick: function () { IO.downloadApp(); } }, { label: 'Close', primary: true }] });
  }

  /* ================= context menus (shared SlopUI kit) ================= */
  function mi(id, label) {
    var a = A[id]; if (!a) return null;
    return { label: label || a.label, key: a.keyText || keyLabel(a.keys[0]), disabled: a.enabled ? !a.enabled() : false, check: a.checked ? a.checked() : false, act: function () { SV.runAction(id); } };
  }
  UI.canvasMenu = function (x, y) {
    var any = S.sel.length > 0;
    var items = [mi('edit.undo'), mi('edit.redo'), '-'];
    if (any) items.push(mi('edit.cut'), mi('edit.copy'));
    items.push(mi('edit.paste'), mi('edit.pasteFront'));
    if (any) {
      items.push(mi('edit.duplicate'), mi('edit.clear'), '-', mi('object.group'), mi('object.ungroup'),
        { label: 'Arrange', sub: [mi('arrange.front'), mi('arrange.forward'), mi('arrange.backward'), mi('arrange.back')] },
        { label: 'Transform', sub: [mi('transform.move'), mi('transform.rotate'), mi('transform.scale'), mi('transform.reflect'), '-', mi('transform.flipH'), mi('transform.flipV')] },
        { label: 'Pathfinder', sub: [mi('pf.unite'), mi('pf.minus'), mi('pf.intersect'), mi('pf.exclude')] },
        mi('compound.make'), mi('object.expand'), '-', mi('object.lock'), mi('object.hide'), '-', mi('object.slopify'));
    } else {
      items.push('-', mi('select.all'), mi('object.unlockAll'), mi('object.showAll'), '-', mi('view.fit'), mi('view.outline'), mi('view.grid'), mi('view.rulers'), '-', mi('file.docSetup'));
    }
    return window.SlopUI.menu(items, x, y);
  };
  UI.layerMenu = function (id, x, y) {
    var L = SV.getLayer(id), o = L ? null : getObj(id), it = L || o; if (!it) return null;
    var rename = { label: 'Rename…', act: function () { renaming = id; layersSig = ''; renderLayers(); } };
    var vis = { label: it.hidden ? 'Show' : 'Hide', act: function () { it.hidden = !it.hidden; SV.commit(it.hidden ? 'hide' : 'show'); } };
    var lock = { label: it.locked ? 'Unlock' : 'Lock', act: function () { it.locked = !it.locked; SV.commit(it.locked ? 'lock' : 'unlock'); } };
    var items;
    if (L) {
      S.activeLayer = id; SV.requestRender(true);
      items = [rename, vis, lock, '-', { label: 'Select All on Layer', act: function () { C.selectLayer(); } }, { label: 'New Layer', act: newLayer },
        { label: 'Delete Layer', disabled: S.doc.layers.length <= 1, act: function () { var i = S.doc.layers.indexOf(L); if (i < 0 || S.doc.layers.length <= 1) return; S.doc.layers.splice(i, 1); S.activeLayer = S.doc.layers[Math.max(0, i - 1)].id; SV.commit('delete layer'); } }];
    } else {
      if (SV.isEditable(o) && S.sel.indexOf(id) < 0) SV.select([id]);
      items = [rename, vis, lock, '-', mi('edit.duplicate'), mi('edit.clear'), '-', mi('arrange.front'), mi('arrange.back'), mi('object.group'), mi('object.ungroup')];
    }
    return window.SlopUI.menu(items, x, y);
  };
  function bindContextMenus() {
    D.stage.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      if (S.editing) SV.commitTextEdit();
      if (S.pen) SV.finishPen();
      var hit = SV.hitTest(SV.evDoc(e));
      if (hit) {
        var t = S.sel.indexOf(hit.obj.id) >= 0 ? hit.obj.id : hit.top.id;
        if (S.sel.indexOf(t) < 0) SV.select([t]);
      }
      UI.closeMenus();
      UI.canvasMenu(e.clientX, e.clientY);
    });
    document.getElementById('dock').addEventListener('contextmenu', function (e) {
      var r = e.target.closest && e.target.closest('.lrow'); if (!r) return;
      e.preventDefault();
      UI.layerMenu(r.getAttribute('data-id'), e.clientX, e.clientY);
    });
  }

  /* ================= theme & prefs ================= */
  var currentTheme = 'pro';
  function setTheme(t) {
    currentTheme = t;
    document.documentElement.setAttribute('data-theme', t);
    SV.lsSet('slopvector.theme', t);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'light' ? '#e8e8e8' : t === 'classic' ? '#008080' : '#1e1e1e');
    var cs = document.querySelector('meta[name="color-scheme"]'); if (cs) cs.setAttribute('content', t === 'pro' ? 'dark' : 'light');
    rulerColors = null;
    SV.requestRender(true);
  }
  UI.setTheme = setTheme;
  function savePrefs() { SV.lsSet('slopvector.prefs', JSON.stringify({ prefs: S.prefs, tabs: activeTabs, collapsed: collapsed })); }
  function loadPrefs() {
    try { var o = JSON.parse(SV.lsGet('slopvector.prefs') || 'null'); if (o) { Object.assign(S.prefs, o.prefs || {}); Object.assign(activeTabs, o.tabs || {}); collapsed = o.collapsed || {}; } } catch (e) { /* ignore */ }
    S.prefs.outline = false;
  }

  /* ================= update ================= */
  UI.update = function () {
    var ctx = controlContext(), sig = JSON.stringify([ctx.n > 0, Object.keys(ctx.types).sort(), ctx.tool, ctx.editing]);
    if (sig !== cbSig) { cbSig = sig; buildControlBar(ctx); }
    ['toolbar', 'cb', 'props', 'app', 'layers', 'swatches', 'grad', 'align', 'status'].forEach(runBinds);
    document.getElementById('stage').setAttribute('data-tool', S.tool);
  };

  /* ================= sample document ================= */
  SV.sampleDoc = function () {
    var mk = SV.mk, d = SV.newDoc(1200, 800, 'Sloppo');
    var bg = mk.layer('Background', '#4f8bff'), slop = mk.layer('Sloppo', '#2fc65a'), type = mk.layer('Type', '#ff4f7b');
    var INK = '#0a0a0a', LIME = '#d4ff3a';
    var limeBody = { type: 'radial', cx: 0.38, cy: 0.3, r: 0.85, fx: 0.33, fy: 0.22, stops: [{ o: 0, c: '#f7ffcf', a: 1 }, { o: 0.28, c: '#dcff52', a: 1 }, { o: 0.72, c: '#a3d600', a: 1 }, { o: 1, c: '#6a9600', a: 1 }] };
    var limeGoo = { type: 'linear', x1: 0.5, y1: 0, x2: 0.5, y2: 1, stops: [{ o: 0, c: '#c9f227', a: 1 }, { o: 1, c: '#7fa800', a: 1 }] };
    bg.children.push(
      mk.rect(0, 0, 1200, 800, 0, { fill: { type: 'radial', cx: 0.32, cy: 0.5, r: 0.8, fx: 0.32, fy: 0.5, stops: [{ o: 0, c: '#fbf9f3', a: 1 }, { o: 1, c: '#e6e0d1', a: 1 }] } }, 'Paper'),
      mk.ellipse(400, 440, 330, 330, { fill: { type: 'radial', cx: 0.5, cy: 0.5, r: 0.5, stops: [{ o: 0, c: LIME, a: 0.55 }, { o: 0.6, c: LIME, a: 0.18 }, { o: 1, c: LIME, a: 0 }] } }, 'Glow'),
      mk.star(176, 176, 26, 7, 4, { fill: INK }, 'Sparkle'),
      mk.star(622, 132, 16, 4.5, 4, { fill: INK }, 'Sparkle small'),
      mk.star(1110, 648, 24, 7, 4, { fill: LIME, stroke: INK, sw: 3, join: 'round' }, 'Sparkle lime'),
      mk.star(96, 470, 12, 3.5, 4, { fill: INK }, 'Sparkle tiny'),
      mk.text(60, 74, 'SLOPOGRAPHIC  Nº 002', { family: 'JetBrains Mono', size: 14, weight: 600, tracking: 120 }, { fill: '#8a8577' }, 'Kicker')
    );
    var shadowGlow = mk.ellipse(408, 690, 270, 22, { fill: '#0a0a0a', opacity: 0.12 }, 'Shadow');
    var puddle = mk.d('M150 646C146 622 236 610 300 614C360 604 450 606 520 612C600 608 676 622 668 648C662 672 580 684 470 680C400 690 300 686 236 680C176 676 152 664 150 646Z', { fill: limeGoo, stroke: INK, sw: 6, join: 'round' }, 'Puddle');
    var dropL = mk.ellipse(124, 664, 11, 8, { fill: '#b5e000', stroke: INK, sw: 4 }, 'Goo drop');
    var dropR = mk.ellipse(698, 660, 8, 6, { fill: '#b5e000', stroke: INK, sw: 4 }, 'Goo drop');
    var body = mk.d('M236 622C236 560 240 490 262 420C290 320 336 244 404 240C474 236 520 312 548 410C568 482 572 560 570 622C590 630 604 640 598 650C520 664 290 666 210 650C204 640 216 628 236 622Z', { fill: limeBody, stroke: INK, sw: 6, join: 'round' }, 'Body');
    var gloss = mk.ellipse(318, 330, 20, 44, { fill: '#ffffff', opacity: 0.78 }, 'Gloss');
    gloss.m = G.rotate(28 * PI / 180, 318, 330);
    var glossDot = mk.ellipse(298, 398, 8, 8, { fill: '#ffffff', opacity: 0.78 }, 'Gloss dot');
    var eyeL = mk.ellipse(352, 420, 30, 40, { fill: INK }, 'Eye left'), eyeR = mk.ellipse(458, 420, 30, 40, { fill: INK }, 'Eye right');
    var sp1 = mk.ellipse(342, 404, 11, 11, { fill: '#ffffff' }, 'Sparkle'), sp2 = mk.ellipse(364, 440, 5, 5, { fill: '#ffffff' }, 'Sparkle');
    var sp3 = mk.ellipse(448, 404, 11, 11, { fill: '#ffffff' }, 'Sparkle'), sp4 = mk.ellipse(470, 440, 5, 5, { fill: '#ffffff' }, 'Sparkle');
    var eyes = mk.group([eyeL, eyeR, sp1, sp2, sp3, sp4], 'Eyes');
    var blush = mk.group([mk.ellipse(298, 478, 24, 13, { fill: '#ff6fae', opacity: 0.6 }, 'Blush left'), mk.ellipse(512, 478, 24, 13, { fill: '#ff6fae', opacity: 0.6 }, 'Blush right')], 'Blush');
    var mouth = mk.d('M384 474C394 492 420 492 430 474', { stroke: INK, sw: 6, cap: 'round', join: 'round' }, 'Smile');
    var tuft = mk.d('M404 242C398 214 414 194 434 196C452 198 454 222 436 224', { stroke: INK, sw: 6, cap: 'round', join: 'round' }, 'Tuft');
    var flying = mk.d('M512 150C512 150 492 178 492 192C492 203 501 212 512 212C523 212 532 203 532 192C532 178 512 150 512 150Z', { fill: limeBody, stroke: INK, sw: 4, join: 'round' }, 'Flying drop');
    slop.children.push(shadowGlow, puddle, dropL, dropR, body, gloss, glossDot, eyes, blush, mouth, tuft, flying);
    var word = mk.text(656, 352, 'SLOP\nVECTOR', { family: 'Archivo', size: 108, weight: 900, lh: 0.9, tracking: -12 }, { fill: INK }, 'Wordmark');
    var tag = mk.text(660, 506, 'The illustrator clone nobody asked for.', { family: 'Inter Tight', size: 24, weight: 500 }, { fill: '#3b3a36' }, 'Tagline');
    var pillR = mk.rect(658, 546, 344, 46, 23, { fill: LIME, stroke: INK, sw: 3 }, 'Pill');
    var pillT = mk.text(830, 575, '100% LOCAL · 0% UPLOADS', { family: 'JetBrains Mono', size: 16, weight: 600, align: 'center', tracking: 40 }, { fill: INK }, 'Pill label');
    type.children.push(word, tag, mk.group([pillR, pillT], 'Badge'));
    d.layers = [bg, slop, type];
    return d;
  };

  /* ================= init ================= */
  function init() {
    D.stage = document.getElementById('stage');
    D.docsvg = document.getElementById('docsvg');
    D.overlay = document.getElementById('overlay');
    D.vpBack = document.getElementById('vpBack');
    D.vpArt = document.getElementById('vpArt');
    D.artboard = document.getElementById('artboard');
    D.artShadow = document.getElementById('artShadow');
    D.grid = document.getElementById('grid');
    D.textEditor = document.getElementById('textEditor');
    var th = SV.lsGet('slopvector.theme');
    currentTheme = (th === 'light' || th === 'classic' || th === 'pro') ? th : 'pro';
    document.documentElement.setAttribute('data-theme', currentTheme);
    loadPrefs();
    buildMenubar(); buildToolbar(); buildDock(); buildStatus(); bindRulers(); applyRulers();
    document.getElementById('panelsToggle').addEventListener('click', function () { togglePanels(); });
    document.addEventListener('click', function (e) { var b = e.target && e.target.closest ? e.target.closest('button') : null; if (b && e.detail > 0 && !b.closest('.sui-dlg')) setTimeout(function () { if (document.activeElement === b) b.blur(); }, 0); }, true);
    D.textEditor.addEventListener('input', SV.onEditorInput);
    SV.bindStage(); SV.bindKeys(); IO.bindDrop(); bindContextMenus();
    var saved = SV.loadAutosave(), recovered = false;
    if (saved) { try { SV.loadDoc(saved.doc, { fit: true }); S.fileName = saved.fileName || null; recovered = true; } catch (e) { recovered = false; } }
    if (!recovered) SV.loadDoc(SV.sampleDoc(), { fit: true });
    SV.resetHistory();
    if (recovered) { S.savedIdx = -1; setTimeout(function () { UI.toast('Recovered document “' + S.doc.name + '” from your last session'); }, 300); }
    setTheme(currentTheme);
    SV.updateCursor();
    SV.fitArtboard();
    SV.renderNow();
    window.addEventListener('resize', function () { SV.requestRender(true); });
    if (window.ResizeObserver) new ResizeObserver(function () { SV.requestRender(); }).observe(D.stage);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { SV.clearTextCache(); SV.requestRender(true); });
    window.addEventListener('beforeunload', function (e) { if (SV.isDirty()) { SV.autosaveNow(); e.preventDefault(); e.returnValue = ''; return ''; } });
    document.getElementById('app').classList.add('ready');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
