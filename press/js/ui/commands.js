/* Slop Press — commands: File, Edit, Object and Tools. (Layout, Type, View, Window, Help and styles: commands2.js) */
(function () {
  'use strict';
  var PR = window.PR, A = PR.actions, S = PR.state, H = PR.history, I = PR.items, M = PR.model, U = PR.util;
  var ui = function () { return PR.ui || {}; };
  var hasSel = function () { return S.sel.length > 0 && !S.text; };
  var hasDoc = function () { return !!S.doc; };
  var editingText = function () { return !!S.text; };
  function del() {
    if (!S.sel.length) return;
    S.sel.slice().forEach(function (id) { I.remove(S.doc, id); });
    S.sel = []; H.commit('Delete'); PR.emit('select', S.sel);
  }
  function nudge(dx, dy) {
    var its = PR.selected(); if (!its.length) return;
    its.forEach(function (it) { it.x += dx; it.y += dy; });
    H.commit('Nudge', true);
  }
  var NUDGE = function () { return U.UNITS[S.doc.unit] >= 2 ? U.UNITS.mm : 1; };

  A.register([
    /* ---------- File ---------- */
    { id: 'file.new', title: 'New Document…', group: 'File', keys: ['Mod+N'], keywords: ['create', 'blank'], run: function () { ui().newDocument(); } },
    { id: 'file.template', title: 'New from Template…', group: 'File', keys: ['Alt+Mod+N'], keywords: ['magazine', 'flyer', 'business card', 'zine'], run: function () { ui().templates(); } },
    { id: 'file.open', title: 'Open…', group: 'File', keys: ['Mod+O'], keywords: ['slpress', 'load'], run: function () { PR.io.openFile(); } },
    { id: 'file.openDrive', title: 'Open from Slop Drive…', group: 'File', when: function () { return !!window.SlopHub; }, run: function () { PR.hub.openFromDrive(); } },
    { id: 'file.save', title: 'Save', group: 'File', keys: ['Mod+S'], keywords: ['slpress', 'download'], run: function () { if (PR.hub) PR.hub.save(); else PR.io.save(); } },
    { id: 'file.saveAs', title: 'Save As…', group: 'File', keys: ['Shift+Mod+S'], run: function () { PR.io.save(true); } },
    { id: 'file.saveDrive', title: 'Save to Slop Drive…', group: 'File', when: function () { return !!window.SlopHub && PR.hub.canSend(); }, run: function () { PR.hub.saveToDrive(); } },
    { id: 'file.place', title: 'Place…', group: 'File', keys: ['Mod+D'], keywords: ['image', 'import', 'text file'], run: function () { PR.place.pick(); } },
    { id: 'file.placeDrive', title: 'Place from Slop Drive…', group: 'File', when: function () { return !!window.SlopHub; }, run: function () { PR.hub.placeFromDrive(); } },
    { id: 'file.exportPDF', title: 'Export PDF…', group: 'File', keys: ['Mod+E'], keywords: ['print', 'bleed', 'crop marks', 'press'], run: function () { ui().exportPDF(); } },
    { id: 'file.exportPNG', title: 'Export PNG…', group: 'File', keys: ['Alt+Mod+E'], keywords: ['image', 'raster'], run: function () { ui().exportPNG(); } },
    { id: 'file.print', title: 'Print…', group: 'File', keys: ['Mod+P'], run: function () { ui().printDialog(); } },
    { id: 'file.docSetup', title: 'Document Setup…', group: 'File', keys: ['Alt+Mod+P'], keywords: ['page size', 'bleed', 'facing'], run: function () { ui().docSetup(); } },
    { id: 'file.loadFont', title: 'Load Font File…', group: 'File', keywords: ['ttf', 'otf', 'typeface'], run: function () { ui().loadFont(); } },
    { id: 'file.downloadApp', title: 'Download App (offline .html)', group: 'File', keywords: ['offline', 'single file'], run: function () { PR.build.download(); } },
    { id: 'file.revert', title: 'Revert to Last Autosave', group: 'File', when: function () { return H.canUndo(); }, run: function () { while (H.doUndo()) { /* back to the start */ } } },

    /* ---------- Edit ---------- */
    { id: 'edit.undo', title: 'Undo', group: 'Edit', keys: ['Mod+Z'], when: H.canUndo, run: function () { var l = H.doUndo(); if (l) U.toast('Undo ' + l); } },
    { id: 'edit.redo', title: 'Redo', group: 'Edit', keys: ['Shift+Mod+Z', 'Mod+Y'], when: H.canRedo, run: function () { var l = H.doRedo(); if (l) U.toast('Redo ' + l); } },
    { id: 'edit.cut', title: 'Cut', group: 'Edit', when: function () { return hasSel() || editingText(); }, run: function () { PR.clipboard.command('cut'); } },
    { id: 'edit.copy', title: 'Copy', group: 'Edit', when: function () { return hasSel() || editingText(); }, run: function () { PR.clipboard.command('copy'); } },
    { id: 'edit.paste', title: 'Paste', group: 'Edit', run: function () { PR.clipboard.command('paste'); } },
    { id: 'edit.pasteInPlace', title: 'Paste in Place', group: 'Edit', keys: ['Alt+Shift+Mod+V'], when: function () { return PR.clipboard.has(); }, run: function () { PR.clipboard.pasteItems(true); } },
    { id: 'edit.duplicate', title: 'Duplicate', group: 'Edit', keys: ['Alt+Shift+Mod+D'], when: hasSel, run: function () { var c = I.duplicate(S.doc, S.sel, 12, 12); H.commit('Duplicate'); PR.select(c.map(function (x) { return x.id; })); } },
    { id: 'edit.delete', title: 'Delete', group: 'Edit', keys: ['Delete', 'Backspace'], when: hasSel, run: del },
    { id: 'edit.selectAll', title: 'Select All', group: 'Edit', keys: ['Mod+A'], run: function () {
      if (S.text) return PR.textEdit.selectAll();
      PR.select(PR.activeItems().filter(function (it) { return !PR.layers.locked(S.doc, it) && PR.layers.visible(S.doc, it); }).map(function (it) { return it.id; }));
    } },
    { id: 'edit.deselect', title: 'Deselect All', group: 'Edit', keys: ['Shift+Mod+A'], run: function () { if (S.text) PR.textEdit.exit(); PR.select([]); } },
    { id: 'edit.escape', title: 'Exit / Deselect', group: 'Edit', keys: ['Escape'], when: function () { return !(PR.ui.dockSheet && PR.ui.dockSheet.isOpen()); }, run: function () { if (PR.selectTool.loaded) { PR.selectTool.loaded = null; PR.view.canvas.classList.remove('loaded'); return; } if (S.text) { PR.textEdit.exit(); PR.tools.set('select'); } else if (S.tool !== 'select') PR.tools.set('select'); else PR.select([]); } },
    { id: 'nudge.left', title: 'Nudge Left', group: 'Edit', keys: ['ArrowLeft'], when: hasSel, run: function () { nudge(-NUDGE(), 0); } },
    { id: 'nudge.right', title: 'Nudge Right', group: 'Edit', keys: ['ArrowRight'], when: hasSel, run: function () { nudge(NUDGE(), 0); } },
    { id: 'nudge.up', title: 'Nudge Up', group: 'Edit', keys: ['ArrowUp'], when: hasSel, run: function () { nudge(0, -NUDGE()); } },
    { id: 'nudge.down', title: 'Nudge Down', group: 'Edit', keys: ['ArrowDown'], when: hasSel, run: function () { nudge(0, NUDGE()); } },
    { id: 'nudge.left10', title: 'Nudge Left ×10', group: 'Edit', keys: ['Shift+ArrowLeft'], when: hasSel, run: function () { nudge(-NUDGE() * 10, 0); } },
    { id: 'nudge.right10', title: 'Nudge Right ×10', group: 'Edit', keys: ['Shift+ArrowRight'], when: hasSel, run: function () { nudge(NUDGE() * 10, 0); } },
    { id: 'nudge.up10', title: 'Nudge Up ×10', group: 'Edit', keys: ['Shift+ArrowUp'], when: hasSel, run: function () { nudge(0, -NUDGE() * 10); } },
    { id: 'nudge.down10', title: 'Nudge Down ×10', group: 'Edit', keys: ['Shift+ArrowDown'], when: hasSel, run: function () { nudge(0, NUDGE() * 10); } },

    /* ---------- Object ---------- */
    { id: 'arrange.front', title: 'Bring to Front', group: 'Object', keys: ['Shift+Mod+]'], when: hasSel, run: function () { I.arrange(S.doc, S.sel, 'front'); H.commit('Bring to front'); } },
    { id: 'arrange.forward', title: 'Bring Forward', group: 'Object', keys: ['Mod+]'], when: hasSel, run: function () { I.arrange(S.doc, S.sel.slice().reverse(), 'forward'); H.commit('Bring forward'); } },
    { id: 'arrange.backward', title: 'Send Backward', group: 'Object', keys: ['Mod+['], when: hasSel, run: function () { I.arrange(S.doc, S.sel, 'backward'); H.commit('Send backward'); } },
    { id: 'arrange.back', title: 'Send to Back', group: 'Object', keys: ['Shift+Mod+['], when: hasSel, run: function () { I.arrange(S.doc, S.sel.slice().reverse(), 'back'); H.commit('Send to back'); } },
    { id: 'object.lock', title: 'Lock', group: 'Object', keys: ['Mod+L'], when: hasSel, run: function () { PR.selected().forEach(function (it) { it.locked = true; }); S.sel = []; H.commit('Lock'); } },
    { id: 'object.unlockAll', title: 'Unlock All on Page', group: 'Object', keys: ['Alt+Mod+L'], run: function () { PR.activeItems().forEach(function (it) { it.locked = false; }); H.commit('Unlock all'); } },
    { id: 'object.textFrameOptions', title: 'Text Frame Options…', group: 'Object', keys: ['Mod+B'], keywords: ['columns', 'inset', 'vertical justification'], when: function () { return PR.selected().some(function (it) { return it.type === 'text'; }); }, run: function () { ui().textFrameOptions(); } },
    { id: 'object.fitFill', title: 'Fill Frame Proportionally', group: 'Object', keys: ['Alt+Shift+Mod+C'], when: function () { return PR.selected().some(function (it) { return it.type === 'image'; }); }, run: function () { setFit('fill'); } },
    { id: 'object.fitFit', title: 'Fit Content Proportionally', group: 'Object', keys: ['Alt+Shift+Mod+E'], when: function () { return PR.selected().some(function (it) { return it.type === 'image'; }); }, run: function () { setFit('fit'); } },
    { id: 'object.fitCenter', title: 'Center Content', group: 'Object', keys: ['Shift+Mod+E'], when: function () { return PR.selected().some(function (it) { return it.type === 'image'; }); }, run: function () { setFit('center'); } },
    { id: 'object.fitStretch', title: 'Fit Content to Frame', group: 'Object', when: function () { return PR.selected().some(function (it) { return it.type === 'image'; }); }, run: function () { setFit('stretch'); } },
    { id: 'wrap.none', title: 'Text Wrap: None', group: 'Object', when: hasSel, checked: function () { return wrapIs('none'); }, run: function () { setWrap('none'); } },
    { id: 'wrap.box', title: 'Text Wrap: Bounding Box', group: 'Object', when: hasSel, checked: function () { return wrapIs('box'); }, run: function () { setWrap('box'); } },
    { id: 'wrap.contour', title: 'Text Wrap: Object Shape', group: 'Object', when: hasSel, checked: function () { return wrapIs('contour'); }, run: function () { setWrap('contour'); } },
    { id: 'wrap.jump', title: 'Text Wrap: Jump Object', group: 'Object', when: hasSel, checked: function () { return wrapIs('jump'); }, run: function () { setWrap('jump'); } },
    { id: 'object.breakThread', title: 'Break Thread After Frame', group: 'Object', when: function () { var s = PR.selected()[0]; return s && s.type === 'text' && !!s.next; }, run: function () { I.breakAfter(S.doc, PR.selected()[0].id); H.commit('Break thread'); } },
    { id: 'object.rotate90', title: 'Rotate 90° Clockwise', group: 'Object', when: hasSel, run: function () { PR.selected().forEach(function (it) { it.rot = ((it.rot || 0) + 90) % 360; }); H.commit('Rotate'); } },
    { id: 'object.placeImage', title: 'Place Image into Frame…', group: 'Object', when: function () { var s = PR.selected()[0]; return s && (s.type === 'image' || s.type === 'rect' || s.type === 'ellipse'); }, run: function () { PR.place.pick(PR.selected()[0]); } },

    /* ---------- Tools ---------- */
    { id: 'tool.select', title: 'Selection Tool', group: 'Tools', keys: ['V'], run: function () { PR.tools.set('select'); } },
    { id: 'tool.text', title: 'Type Tool', group: 'Tools', keys: ['T'], keywords: ['text'], run: function () { PR.tools.set('text'); } },
    { id: 'tool.frame', title: 'Rectangle Frame Tool (images)', group: 'Tools', keys: ['F'], keywords: ['image', 'placeholder'], run: function () { PR.tools.set('frame'); } },
    { id: 'tool.rect', title: 'Rectangle Tool', group: 'Tools', keys: ['M'], run: function () { PR.tools.set('rect'); } },
    { id: 'tool.ellipse', title: 'Ellipse Tool', group: 'Tools', keys: ['L'], keywords: ['circle'], run: function () { PR.tools.set('ellipse'); } },
    { id: 'tool.line', title: 'Line Tool', group: 'Tools', keys: ['\\'], keywords: ['rule'], run: function () { PR.tools.set('line'); } },
    { id: 'tool.polygon', title: 'Polygon Tool', group: 'Tools', keys: ['P'], keywords: ['star'], run: function () { PR.tools.set('polygon'); } },
    { id: 'tool.hand', title: 'Hand Tool', group: 'Tools', keys: ['H'], keywords: ['pan'], run: function () { PR.tools.set('hand'); } },
    { id: 'tool.zoom', title: 'Zoom Tool', group: 'Tools', keys: ['Z'], run: function () { PR.tools.set('zoom'); } },
    { id: 'tool.swapColors', title: 'Swap Fill and Stroke', group: 'Tools', keys: ['Shift+X'], run: function () { var d = S.defaults, f = d.fill; d.fill = d.stroke; d.stroke = f; PR.selected().forEach(function (it) { var t = it.fill; it.fill = it.stroke; it.stroke = t; }); if (S.sel.length) H.commit('Swap colours'); PR.emit('defaults'); } }
  ]);
  function setFit(fit) { PR.selected().forEach(function (it) { if (it.type === 'image') it.fit = fit; }); H.commit('Fitting'); }
  function wrapIs(t) { var s = PR.selected()[0]; return !!s && (s.wrap || {}).type === t; }
  function setWrap(t) { PR.selected().forEach(function (it) { it.wrap = U.assign({ off: 6 }, it.wrap, { type: t }); }); H.commit('Text wrap'); }
  void M; void hasDoc;
})();
