/* Slop Code: the commands, registered with SlopCmd (shared/commands) so the palette, the key labels and the
 * shortcut editor all know them. Without SlopCmd, the same shortcuts are handled here. */

/** The command list for the action table `A` (open, new, save, saveAs, close, find, replace, wrap, files, run, and the
 * Explorer and Extensions actions: newFolder, format, language, extensions). */
export function commandList(A) {
  const C = (id, title, group, keys, extra = {}) => ({ id: 'code.' + id, title, group, keys, run: () => A[id](), ...extra });
  return [
    C('open', 'Open from Slop Drive…', 'File', ['Mod+O'], { keywords: ['load', 'drive'] }),
    C('new', 'New file…', 'File', ['Mod+Alt+N'], { keywords: ['create', 'type', 'language'] }),
    C('save', 'Save', 'File', ['Mod+S'], { keywords: ['write', 'drive'] }),
    C('saveAs', 'Save as…', 'File', ['Shift+Mod+S'], { keywords: ['copy', 'folder'] }),
    C('close', 'Close tab', 'File', ['Mod+Alt+W']),
    C('find', 'Find', 'Edit', ['Mod+F'], { keywords: ['search'] }),
    C('replace', 'Replace', 'Edit', ['Mod+H'], { keywords: ['substitute'] }),
    C('wrap', 'Toggle line wrap', 'View', ['Mod+Alt+Z'], { keywords: ['word wrap'] }),
    C('files', 'Show or hide Explorer', 'View', ['Mod+B'], { keywords: ['files', 'tree', 'sidebar', 'drawer'] }),
    C('newFolder', 'New folder…', 'File', ['Mod+Alt+Shift+N'], { keywords: ['folder', 'directory', 'create'] }),
    C('extensions', 'Show Extensions', 'View', [], { keywords: ['helpers', 'toggle', 'snippets', 'formatter'] }),
    C('language', 'Set language mode…', 'Tools', [], { keywords: ['highlight', 'syntax', 'mode', 'language'] }),
    C('format', 'Format document', 'Tools', ['Shift+Mod+F'], { keywords: ['pretty', 'indent', 'beautify', 'formatter'] }),
    C('run', 'Run preview', 'Tools', ['Mod+Enter'], { keywords: ['preview', 'html', 'javascript'] }),
  ];
}

/** Register with SlopCmd, or install a small keydown handler when it is not loaded. */
export function registerCommands(A) {
  const list = commandList(A);
  if (window.SlopCmd) {
    try {
      SlopCmd.init({ app: 'code' }); SlopCmd.register(list);
      if (SlopCmd.provide) SlopCmd.provide({ prepare: () => import('./ai-commands.js') });   // the assistant's commands, when the AI panel first asks
      return;
    } catch (e) { /* fall back below */ }
  }
  const binds = list.flatMap((c) => c.keys.map((k) => ({ run: c.run, ...parse(k) })));
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    const hit = binds.find((b) => b.mod === mod && b.shift === e.shiftKey && b.alt === e.altKey && b.key === String(e.key).toLowerCase());
    if (!hit) return;
    e.preventDefault();
    hit.run();
  }, true);
}

function parse(s) {
  const parts = s.split('+'), key = parts.pop().toLowerCase();
  return { mod: parts.includes('Mod'), shift: parts.includes('Shift'), alt: parts.includes('Alt'), key };
}
