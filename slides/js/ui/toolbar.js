/* Slop Slides: the top bar. Title, File menu (new, open, save, download, export), undo and redo, insert buttons,
   layout and theme pickers, present, and the save status. Everything refreshes from the model. Exposes SS.toolbar. */
(function () {
  'use strict';
  var SS = window.SS, A = SS.app, D = SS.dom, OP = SS.ops, T = SS.toolbar = {};
  var $ = D.$;

  function keyOf(id) { return window.SlopCmd ? SlopCmd.keyFor(id) : ''; }
  function fileMenu(x, y) {
    var hub = !!window.SlopHub;
    SlopUI.menu([
      { label: 'New presentation', key: keyOf('file.new'), act: SS.files.newDeck },
      { label: 'New from template…', key: keyOf('file.newTemplate'), act: function () { SS.templatesUI.openNew(); } },
      { label: 'Open from Slop Drive…', key: keyOf('file.open'), act: SS.files.openDrive, disabled: !hub },
      '-',
      { label: 'Save to Slop Drive', key: keyOf('file.save'), act: function () { SS.files.save(false); }, disabled: !hub },
      { label: 'Save as a new Drive file…', act: function () { SS.files.save(true); }, disabled: !hub },
      { label: 'Save as template…', key: keyOf('file.saveTemplate'), act: function () { SS.templatesUI.openSave(); } },
      '-',
      { label: 'Download .sslide', act: SS.files.download },
      { label: 'Export PowerPoint (.pptx)', act: SS.files.exportPptx },
      { label: 'Export this slide as PNG', act: SS.files.exportPng },
      '-',
      { label: 'Present', key: keyOf('view.present') || 'F5', act: function () { SS.present.start(); } }
    ], x, y);
  }
  function fillSelects() {
    var lay = $('selLayout'), th = $('selTheme');
    lay.replaceChildren(...SS.layouts.list.map(function (l) { return D.option(l.id, l.name, ''); }));
    th.replaceChildren(...SS.themes.list.map(function (t) { return D.option(t.id, t.name, ''); }));
  }
  function saveText() {
    if (!A.doc) return '';
    if (A.dirty) return A.doc.driveId ? 'Unsaved changes' : 'Not saved yet';
    return A.doc.driveId ? 'Saved to Slop Drive' : 'Not saved yet';
  }
  function refresh() {
    if (!A.deck) return;
    var s = A.slide(), undo = $('btnUndo'), redo = $('btnRedo');
    undo.disabled = !A.hist.canUndo() || A.mode !== 'edit';
    redo.disabled = !A.hist.canRedo() || A.mode !== 'edit';
    undo.title = 'Undo' + (A.hist.label('undo') ? ': ' + A.hist.label('undo') : '');
    redo.title = 'Redo' + (A.hist.label('redo') ? ': ' + A.hist.label('redo') : '');
    setVal($('selLayout'), s ? s.layout : '');
    setVal($('selTheme'), A.deck.theme.id);
    setVal($('title'), A.deck.title);
    $('saveState').textContent = saveText();
    $('saveState').classList.toggle('dirty', A.dirty);
    $('statusSlide').textContent = 'Slide ' + (A.idx + 1) + ' of ' + A.deck.slides.length + (s && s.hidden ? ' (hidden)' : '');
    $('statusSel').textContent = A.sel.length ? (A.sel.length + ' selected') : '';
  }
  function setVal(el, v) {
    if (el && document.activeElement !== el && el.value !== String(v)) el.value = v;
  }
  T.mount = function () {
    fillSelects();
    var title = $('title');
    title.addEventListener('change', function () { OP.setTitle(title.value.trim() || 'Untitled presentation'); });
    title.addEventListener('keydown', function (e) { if (e.key === 'Enter') title.blur(); });
    $('btnFile').addEventListener('click', function (e) { var r = e.currentTarget.getBoundingClientRect(); fileMenu(r.left, r.bottom + 4); });
    $('btnUndo').addEventListener('click', function () { A.undo(); });
    $('btnRedo').addEventListener('click', function () { A.redo(); });
    $('insText').addEventListener('click', OP.addText);
    $('insRect').addEventListener('click', function () { OP.addShape('rect'); });
    $('insEllipse').addEventListener('click', function () { OP.addShape('ellipse'); });
    $('insImage').addEventListener('click', OP.addImage);
    $('selLayout').addEventListener('change', function (e) { OP.setLayout(e.target.value); });
    $('selTheme').addEventListener('change', function (e) { OP.setTheme(e.target.value); });
    $('btnPresent').addEventListener('click', function () { SS.present.start(); });
    $('btnSave').addEventListener('click', function () { SS.files.save(false); });
    $('btnPalette').addEventListener('click', function () { if (window.SlopCmd) SlopCmd.open(); });
    $('btnPalette').hidden = !window.SlopCmd;
    $('slNew').addEventListener('click', OP.newSlide);
    $('slDup').addEventListener('click', OP.dupSlide);
    $('slDel').addEventListener('click', OP.delSlide);
    $('slUp').addEventListener('click', function () { OP.moveSlide(-1); });
    $('slDown').addEventListener('click', function () { OP.moveSlide(1); });
    ['load', 'deck', 'slide', 'select', 'change', 'mode'].forEach(function (ev) { A.on(ev, refresh); });
    refresh();
  };
  T.refresh = refresh;
})();
