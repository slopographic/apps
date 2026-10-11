/* Slop Notes commands, registered with SlopCmd so the palette, the menus and the shortcut editor all know them.
 * Commands that need a note are hidden when none is open (when()). */
import * as A from './actions.js';
import { S, curNote } from './state.js';
import { $ } from './dom.js';
import { setMode } from './editor.js';

const MODES = ['split', 'write', 'preview'];

export function commandList() {
  const has = () => !!curNote();
  const C = (id, title, group, keys, extra = {}) => Object.assign({ id: 'notes.' + id, title, group, keys, run: () => {} }, extra);
  return [
    C('new', 'New note', 'File', ['Mod+Alt+N'], { keywords: ['create', 'write'], run: () => A.newNote() }),
    C('notebook', 'New notebook…', 'File', [], { keywords: ['folder', 'book'], run: () => A.newNotebook() }),
    C('folder', 'New folder…', 'File', [], { keywords: ['subfolder'], run: () => A.newFolder() }),
    C('md', 'Export note as Markdown', 'File', [], { keywords: ['download', '.md'], when: has, run: () => A.exportNote(curNote(), 'md') }),
    C('html', 'Export note as HTML', 'File', [], { keywords: ['download', '.html', 'web page'], when: has, run: () => A.exportNote(curNote(), 'html') }),
    C('find', 'Search notes', 'Edit', ['Mod+Shift+F'], { keywords: ['find', 'filter'], run: () => $('nt-q').focus() }),
    C('pin', 'Pin or unpin note', 'Edit', ['Mod+Alt+P'], { keywords: ['star', 'top'], when: has, run: () => A.togglePin() }),
    C('delete', 'Move note to Trash', 'Edit', [], { keywords: ['remove', 'delete'], when: has, run: () => A.remove(curNote()) }),
    C('view', 'Cycle view: split, write, preview', 'View', ['Mod+Alt+V'], { keywords: ['preview', 'markdown', 'split'], run: () => setMode(MODES[(MODES.indexOf(S.mode) + 1) % MODES.length]) }),
    C('next', 'Next note', 'Go', ['Mod+Alt+ArrowDown'], { keywords: ['down'], run: () => A.stepNote(1) }),
    C('prev', 'Previous note', 'Go', ['Mod+Alt+ArrowUp'], { keywords: ['up'], run: () => A.stepNote(-1) }),
  ];
}

/** Registers the commands with SlopCmd when it is loaded. */
export function registerCommands() {
  if (!window.SlopCmd) return;
  SlopCmd.init({ app: 'notes' });
  SlopCmd.register(commandList());
}
