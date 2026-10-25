/* Slop Slides: every command with its shortcut, registered with SlopCmd (the Mod+K palette and the customisable
   keymap). Editing commands are off while Present mode runs or a text box is open. Exposes window.SS.commands. */
(function () {
  'use strict';
  var SS = window.SS, A = SS.app, OP = SS.ops, C = null;
  var K = SS.commands = {};
  var HERE = (document.currentScript && document.currentScript.src) || location.href;
  /** The assistant's commands with arguments (ai-files.js, ai-commands.js), loaded in order when SlopCmd.prepare() asks. */
  function script(name) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = new URL(name, HERE).href; s.async = false;
      s.onload = res; s.onerror = function () { rej(new Error('Could not load ' + name)); };
      document.head.append(s);
    });
  }
  K.prepare = function () {
    if (SS.aiCmd) return Promise.resolve();
    return (window.SlopCmdSources ? Promise.resolve() : script('../../../shared/commands/sources.js'))
      .then(function () { return script('ai-files.js'); }).then(function () { return script('ai-commands.js'); });
  };
  function editing() { return A.mode === 'edit' && !SS.textEdit.editing; }
  function hasSel() { return editing() && A.sel.length > 0; }
  function cmd(id, title, group, keys, run, when, extra) {
    return Object.assign({ id: id, title: title, group: group, keys: keys || [], run: run, when: when || null }, extra || {});
  }
  function list() {
    var one = function () { var o = A.selObjs(); return A.sel.length === 1 && o[0] && SS.textEdit.canEdit(o[0]) ? o[0] : null; };
    var L = [
      cmd('file.new', 'New presentation', 'File', ['Mod+N'], function () { SS.files.newDeck(); }, function () { return A.mode === 'edit'; }),
      cmd('file.open', 'Open from Slop Drive…', 'File', ['Mod+O'], function () { SS.files.openDrive(); }, editing, { keywords: ['import'] }),
      cmd('file.save', 'Save to Slop Drive', 'File', ['Mod+S'], function () { SS.files.save(false); }, editing, { keywords: ['store'] }),
      cmd('file.rename', 'Rename…', 'File', [], function () { SlopDocTabs.rename(null); }, null, { keywords: ['name', 'title'] }),
      cmd('file.saveAs', 'Save as a new Drive file…', 'File', [], function () { SS.files.save(true); }, editing),
      cmd('file.download', 'Download .sslide', 'File', [], function () { SS.files.download(); }),
      cmd('file.newTemplate', 'New from template…', 'File', [], function () { SS.templatesUI.openNew(); }, function () { return A.mode === 'edit'; }, { keywords: ['template', 'import'] }),
      cmd('file.saveTemplate', 'Save as template…', 'File', [], function () { SS.templatesUI.openSave(); }, editing, { keywords: ['template', 'export'] }),
      cmd('file.pptx', 'Export PowerPoint (.pptx)', 'File', [], function () { SS.files.exportPptx(); }, null, { keywords: ['powerpoint', 'export'] }),
      cmd('file.pdf', 'Download PDF', 'File', [], function () { SS.files.exportPdf(); }, null, { keywords: ['pdf', 'export', 'print'] }),
      cmd('file.openLocal', 'Open a file from this computer…', 'File', [], function () { SS.fileDrop.choose(); }, function () { return A.mode === 'edit'; }, { keywords: ['import', 'powerpoint', 'pptx'] }),
      cmd('edit.undo', 'Undo', 'Edit', ['Mod+Z'], function () { A.undo(); }, function () { return editing() && A.hist.canUndo(); }),
      cmd('edit.redo', 'Redo', 'Edit', ['Shift+Mod+Z', 'Mod+Y'], function () { A.redo(); }, function () { return editing() && A.hist.canRedo(); }),
      cmd('edit.copy', 'Copy', 'Edit', ['Mod+C'], function () { OP.copy(); }, hasSel),
      cmd('edit.copyBuffer', 'Copy to buffer', 'Edit', [], function () { OP.copyToBuffer(); }, hasSel),
      cmd('edit.paste', 'Paste', 'Edit', ['Mod+V'], function () { OP.paste(); }, function () { return editing() && (!!A.clip || (OP.hasBuffer && OP.hasBuffer())); }),
      cmd('edit.duplicate', 'Duplicate', 'Edit', ['Mod+D'], function () { OP.duplicateSel(); }, hasSel),
      cmd('edit.delete', 'Delete', 'Edit', ['Delete', 'Backspace'], function () { OP.deleteSel(); }, hasSel),
      cmd('edit.selectAll', 'Select all objects', 'Edit', ['Mod+A'], function () { A.select(A.slide().objects.map(function (o) { return o.id; })); }, editing),
      cmd('edit.deselect', 'Deselect', 'Edit', ['Escape'], function () { A.select([]); }, hasSel, { hidden: true }),
      cmd('edit.text', 'Edit text', 'Edit', ['Enter'], function () { SS.textEdit.open(one()); }, function () { return editing() && !!one(); }),
      cmd('insert.text', 'Insert text box', 'Insert', ['T'], function () { OP.addText(); }, editing),
      cmd('insert.rect', 'Insert rectangle', 'Insert', [], function () { OP.addShape('rect'); }, editing),
      cmd('insert.ellipse', 'Insert ellipse', 'Insert', [], function () { OP.addShape('ellipse'); }, editing),
      cmd('insert.image', 'Insert picture…', 'Insert', [], function () { OP.addImage(); }, editing),
      cmd('edit.restoreAspect', 'Restore original aspect ratio', 'Edit', [], function () { SS.aspect.restore(null); }, function () { return hasSel() && !!SS.aspect.target(); }),
      cmd('arrange.front', 'Bring to front', 'Arrange', ['Mod+Shift+]'], function () { OP.arrange('front'); }, hasSel),
      cmd('arrange.back', 'Send to back', 'Arrange', ['Mod+Shift+['], function () { OP.arrange('back'); }, hasSel),
      cmd('slide.new', 'New slide', 'Slide', ['Shift+Mod+Enter'], function () { OP.newSlide(); }, editing),
      cmd('slide.duplicate', 'Duplicate slide', 'Slide', [], function () { OP.dupSlide(); }, editing),
      cmd('slide.delete', 'Delete slide', 'Slide', [], function () { OP.delSlide(); }, function () { return editing() && A.deck.slides.length > 1; }),
      cmd('slide.up', 'Move slide up', 'Slide', [], function () { OP.moveSlide(-1); }, editing),
      cmd('slide.down', 'Move slide down', 'Slide', [], function () { OP.moveSlide(1); }, editing),
      cmd('slide.next', 'Next slide', 'Slide', ['PageDown'], function () { A.go(A.idx + 1); }, function () { return editing() && A.idx < A.deck.slides.length - 1; }, { hidden: true }),
      cmd('slide.prev', 'Previous slide', 'Slide', ['PageUp'], function () { A.go(A.idx - 1); }, function () { return editing() && A.idx > 0; }, { hidden: true }),
      cmd('view.present', 'Present', 'View', ['F5'], function () { SS.present.start(); }, editing),
      cmd('view.presenter', 'Present with presenter view', 'View', ['Alt+F5'], function () { SS.presenter.start(); }, editing, { keywords: ['notes', 'speaker', 'timer'] })
    ];
    [['Left', -1, 0], ['Right', 1, 0], ['Up', 0, -1], ['Down', 0, 1]].forEach(function (d) {
      L.push(cmd('nudge.' + d[0].toLowerCase(), 'Nudge ' + d[0].toLowerCase(), 'Arrange', ['Arrow' + d[0]], function () { OP.nudge(d[1], d[2]); }, hasSel, { repeat: true, hidden: true }));
      L.push(cmd('nudge.big' + d[0].toLowerCase(), 'Nudge ' + d[0].toLowerCase() + ' (10 pt)', 'Arrange', ['Shift+Arrow' + d[0]], function () { OP.nudge(d[1] * 10, d[2] * 10); }, hasSel, { repeat: true, hidden: true }));
    });
    return L.concat(SS.configio && SS.configio.commands ? SS.configio.commands() : []);
  }
  /** Called once at boot. Without SlopCmd the editor still works, only without shortcuts and the palette. */
  K.setup = function () {
    C = window.SlopCmd || null;
    if (!C) { console.warn('Slop Slides: SlopCmd is missing; keyboard shortcuts are off'); return; }
    C.init({ app: 'slides' });
    C.register(list());
    if (C.provide) C.provide({ prepare: K.prepare });
  };
})();
