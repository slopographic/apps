/* Right-click and keyboard menus for notebooks, folders and notes, and the Export menu. Items call the actions. */
import * as A from './actions.js';
import { S, byId, curNote } from './state.js';

const key = (id) => (window.SlopCtx ? SlopCtx.keyFor(id) : '');

/** The menu for one item. kind is 'notebook', 'folder' or 'note'; id is its Drive id. */
export function menuFor(kind, id) {
  if (kind === 'notebook') {
    const nb = byId(S.notebooks, id);
    if (!nb) return null;
    return [
      { label: 'Open notebook', act: () => A.selectNotebook(id) },
      { label: 'New note here', act: () => { A.selectNotebook(id); A.newNote(); } },
      { label: 'New folder…', act: () => { A.selectNotebook(id); A.newFolder(null); } },
      { label: 'Rename…', act: () => A.rename(nb) },
      '-',
      { label: 'Move to Trash…', act: () => A.remove(nb) },
    ];
  }
  if (kind === 'folder') {
    const f = byId(S.folders, id);
    if (!f) return null;
    return [
      { label: 'Open folder', act: () => A.selectFolder(id) },
      { label: 'New subfolder…', act: () => A.newFolder(id) },
      { label: 'Rename…', act: () => A.rename(f) },
      '-',
      { label: 'Move to Trash…', act: () => A.remove(f) },
    ];
  }
  if (kind === 'note') {
    const n = byId(S.notes, id);
    if (!n) return null;
    const here = S.folders.filter((f) => f.notebook === n.notebook);
    const toFolders = [{ label: 'Top of the notebook', disabled: !n.folder, act: () => A.moveToFolder(n, null) }]
      .concat(here.map((f) => ({ label: f.title || 'Untitled folder', disabled: n.folder === f.id, act: () => A.moveToFolder(n, f.id) })));
    const toBooks = S.notebooks.filter((b) => b.id !== n.notebook).map((b) => ({ label: b.title || 'Untitled notebook', act: () => A.moveToNotebook(n, b.id) }));
    return [
      { label: 'Open note', act: () => A.selectNote(id) },
      { label: n.pinned ? 'Unpin' : 'Pin to top', key: key('notes.pin'), act: () => A.togglePin(n) },
      { label: 'Move to folder', sub: toFolders },
      ...(toBooks.length ? [{ label: 'Move to notebook', sub: toBooks }] : []),
      '-',
      { label: 'Export as Markdown (.md)', act: () => A.exportNote(n, 'md') },
      { label: 'Export as HTML (.html)', act: () => A.exportNote(n, 'html') },
      '-',
      { label: 'Move to Trash…', key: key('notes.delete'), act: () => A.remove(n) },
    ];
  }
  return null;
}

/** The Export button's menu, for the current note. */
export function exportMenu() {
  const n = curNote();
  if (!n) return null;
  return [
    { label: 'Export as Markdown (.md)', act: () => A.exportNote(n, 'md') },
    { label: 'Export as HTML (.html)', act: () => A.exportNote(n, 'html') },
  ];
}

/** Resolves the menu for a right-click or Menu key target (the nearest item with data-kind). */
export function resolveMenu(target) {
  const item = target && target.closest ? target.closest('[data-kind]') : null;
  return item ? menuFor(item.dataset.kind, item.dataset.id) : null;
}
