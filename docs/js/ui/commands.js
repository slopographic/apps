/* Slop Docs — ui/commands: every action registered with SlopCmd, the shared palette (Ctrl/⌘+K) and customisable
 * shortcuts (Help ▸ Keyboard shortcuts). Without SlopCmd the fallbacks in input.js still handle the basic keys. Classic script. */
(function () {
  'use strict';
  const C = window.SlopCmd;
  const S = window.SlopDocs;
  if (!C) return;
  const A = () => S.A;
  const cmd = (id, title, group, keys, run, extra) => Object.assign({ id, title, group, keys: keys || [], run }, extra || {});
  const hasText = () => !!S.doc;

  C.init({ app: 'docs' });
  C.register([
    cmd('file.new', 'New document', 'File', [], () => S.newDoc(), { keywords: ['blank', 'create'] }),
    cmd('file.open', 'Open from Slop Drive…', 'File', ['Mod+O'], () => S.openFromDrive(), { keywords: ['drive', 'import', 'docx', 'word'] }),
    cmd('file.random', 'Random template…', 'File', [], () => S.random.open(), { keywords: ['template', 'design', 'generate', 'seed', 'new'] }),
    cmd('file.save', 'Save to Slop Drive', 'File', ['Mod+S'], () => S.save(), { keywords: ['store', 'drive'] }),
    cmd('file.docx', 'Download Word (.docx)', 'File', [], () => S.download('docx'), { keywords: ['export', 'word'] }),
    cmd('file.md', 'Download Markdown (.md)', 'File', [], () => S.download('md'), { keywords: ['export'] }),
    cmd('file.txt', 'Download plain text (.txt)', 'File', [], () => S.download('txt'), { keywords: ['export'] }),
    cmd('edit.undo', 'Undo', 'Edit', ['Mod+Z'], () => A().undo(), { when: () => S.canUndo() }),
    cmd('edit.copyBuffer', 'Copy to buffer', 'Edit', [], () => A().copyToBuffer(), { when: hasText }),
    cmd('edit.redo', 'Redo', 'Edit', ['Shift+Mod+Z', 'Mod+Y'], () => A().redo(), { when: () => S.canRedo() }),
    cmd('edit.selectAll', 'Select all', 'Edit', ['Mod+A'], () => A().selectAll(), { when: hasText }),
    cmd('format.bold', 'Bold', 'Format', ['Mod+B'], () => A().toggle('b'), { keywords: ['strong'] }),
    cmd('format.italic', 'Italic', 'Format', ['Mod+I'], () => A().toggle('i'), { keywords: ['emphasis'] }),
    cmd('format.underline', 'Underline', 'Format', ['Mod+U'], () => A().toggle('u')),
    cmd('format.alignLeft', 'Align left', 'Format', ['Shift+Mod+1'], () => A().setAlign('left')),
    cmd('format.alignCenter', 'Align centre', 'Format', ['Shift+Mod+2'], () => A().setAlign('center')),
    cmd('format.alignRight', 'Align right', 'Format', ['Shift+Mod+3'], () => A().setAlign('right')),
    cmd('format.alignJustify', 'Justify', 'Format', ['Shift+Mod+4'], () => A().setAlign('justify')),
    cmd('format.bullets', 'Bulleted list', 'Format', ['Shift+Mod+L'], () => A().toggleList('bul')),
    cmd('format.numbers', 'Numbered list', 'Format', ['Shift+Mod+7'], () => A().toggleList('num')),
    cmd('format.bigger', 'Increase font size', 'Format', ['Shift+Mod+.'], () => A().stepSize(1)),
    cmd('format.smaller', 'Decrease font size', 'Format', ['Shift+Mod+,'], () => A().stepSize(-1)),
    cmd('format.clear', 'Clear formatting', 'Format', ['Mod+Space'], () => A().clearFormat()),
    cmd('style.normal', 'Normal text', 'Format', [], () => A().setStyle('Normal'), { keywords: ['paragraph'] }),
    cmd('style.h1', 'Heading 1', 'Format', ['Mod+Alt+1'], () => A().setStyle('H1'), { keywords: ['title', 'heading'] }),
    cmd('style.h2', 'Heading 2', 'Format', ['Mod+Alt+2'], () => A().setStyle('H2'), { keywords: ['heading'] }),
    cmd('style.h3', 'Heading 3', 'Format', ['Mod+Alt+3'], () => A().setStyle('H3'), { keywords: ['heading'] }),
    cmd('style.quote', 'Quote', 'Format', [], () => A().setStyle('Quote'), { keywords: ['blockquote'] }),
    cmd('help.keys', 'Keyboard shortcuts…', 'Help', [], () => C.openKeymap(), { keywords: ['keys', 'hotkeys'] }),
  ]);

  /** A ⌘K button in the top bar, next to Save. */
  const save = document.getElementById('btnSave');
  if (save) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tb';
    b.id = 'btnCmd';
    b.setAttribute('aria-label', 'Search commands');
    b.title = 'Search commands (' + C.keyFor('cmd.palette') + ')';
    b.innerHTML = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m20 20-4.2-4.2"/></svg>';
    b.addEventListener('click', () => C.open());
    save.parentNode.insertBefore(b, save);
    C.on('change', () => { b.title = 'Search commands (' + C.keyFor('cmd.palette') + ')'; });
  }
})();
