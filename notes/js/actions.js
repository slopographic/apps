/* Slop Notes actions: every change the screen, the menus and the commands make. Each one changes S, saves through the
 * store and asks the views to redraw. Nothing here touches the DOM except the focus after a new note. */
import * as store from './store.js';
import { S, byId, curNote, visibleNotes } from './state.js';
import { download, notebookZip, fileBase } from './export.js';

let redraw = () => {};
export const setRedraw = (fn) => { redraw = fn; };
const toast = (m) => { if (window.SlopUI) SlopUI.toast(m); };
const ask = (title, label, value, ok) => SlopUI.prompt(title, label, value, { ok });
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const byTitle = (a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });

/** Remembers the note and notebook last open, so a later visit reopens them (SlopSession). */
function remember() {
  try { SlopSession.save('notes', 'last', { noteId: S.noteId, notebookId: S.notebookId }).catch(() => {}); } catch (e) { /* no session store */ }
}

export function setPane(pane) { S.pane = pane; redraw(); }

export function selectNotebook(id) {
  S.notebookId = id || null;
  S.folderId = null;
  S.tag = null;
  if (id && curNote() && curNote().notebook !== id) S.noteId = null;
  S.pane = 'list';
  remember();
  redraw();
}

export function selectFolder(id) { S.folderId = id || null; S.tag = null; S.pane = 'list'; redraw(); }
export function selectTag(tag) { S.tag = S.tag === tag ? null : tag; redraw(); }

export function selectNote(id) {
  if (!S.notes.some((n) => n.id === id)) return;
  S.noteId = id;
  S.pane = 'editor';
  remember();
  redraw();
}

/** The notebook new things go into: the chosen one, else the first, else a new 'My notes'. */
async function ensureNotebook() {
  if (S.notebookId) return S.notebookId;
  if (!S.notebooks.length) S.notebooks.push(await store.createNotebook('My notes'));
  S.notebookId = S.notebooks[0].id;
  return S.notebookId;
}

export async function newNote() {
  const notebook = await ensureNotebook();
  const n = await store.createNote({ notebook, folder: S.folderId, title: '' });
  S.notes.push(n);
  S.noteId = n.id;
  S.pane = 'editor';
  remember();
  redraw();
  const t = document.getElementById('nt-title');
  if (t) { t.focus(); t.select(); }
  return n;
}

export async function newNotebook() {
  const title = await ask('New notebook', 'Name', '', 'Create');
  if (title == null) return;
  const nb = await store.createNotebook(clean(title) || 'Untitled notebook');
  S.notebooks.push(nb);
  S.notebooks.sort(byTitle);
  selectNotebook(nb.id);
  toast('Notebook made');
}

/** A folder inside a notebook, under parent (a folder id, or null for the top of the notebook). */
export async function newFolder(parent = S.folderId) {
  if (!S.notebookId) { toast('Choose a notebook first'); return; }
  const title = await ask('New folder', 'Name', '', 'Create');
  if (title == null) return;
  const f = await store.createFolder(S.notebookId, parent || null, clean(title) || 'Untitled folder');
  S.folders.push(f);
  redraw();
  toast('Folder made');
}

/** Renames a notebook, folder or note (the title shows in the list and, for a note, in its file name). */
export async function rename(item) {
  const title = await ask('Rename', 'Name', item.title, 'Rename');
  if (title == null) return;
  item.title = clean(title) || (item.kind === 'note' ? '' : item.title);
  store.touch(item);
  redraw();
}

export function togglePin(n = curNote()) {
  if (!n) return;
  n.pinned = !n.pinned;
  store.touch(n);
  redraw();
}

/** Moves a note into a folder of its notebook (folder id), or to the top of its notebook (null). */
export function moveToFolder(n, folder) {
  n.folder = folder || null;
  store.touch(n);
  redraw();
}

export function moveToNotebook(n, notebook) {
  n.notebook = notebook;
  n.folder = null;
  store.touch(n);
  redraw();
}

/** Moves an item and what is in it to the Drive Trash, after a confirmation. */
export async function remove(item) {
  const all = { notebooks: S.notebooks, folders: S.folders, notes: S.notes };
  const ids = store.trashIds(all, item);
  const what = item.kind === 'note' ? `“${item.title || 'Untitled'}”` : `“${item.title}” and the ${ids.length - 1} item${ids.length === 2 ? '' : 's'} in it`;
  const ok = await SlopUI.confirm('Move to Trash?', `${what} goes to the Slop Drive Trash, where you can restore it.`, 'Move to Trash', { danger: true });
  if (!ok) return;
  store.forget(ids);
  try { await store.trash(ids); } catch (e) { toast('Could not move to Trash: ' + e.message); return; }
  const gone = new Set(ids);
  S.notes = S.notes.filter((n) => !gone.has(n.id));
  S.folders = S.folders.filter((f) => !gone.has(f.id));
  S.notebooks = S.notebooks.filter((b) => !gone.has(b.id));
  if (gone.has(S.noteId)) S.noteId = null;
  if (gone.has(S.notebookId)) { S.notebookId = null; S.folderId = null; }
  if (gone.has(S.folderId)) S.folderId = null;
  remember();
  redraw();
  toast('Moved to Trash');
}

/** Exports one note (md, html, txt, doc) or opens its print view (pdf). */
export function exportNote(n, format) {
  if (!n) return;
  const name = download(n, format);
  toast(name ? 'Exported ' + name : 'Print view opened: choose Save as PDF');
}

/** Exports a whole notebook as a zip of its notes (md or html), in their folders. */
export async function exportNotebook(id, format) {
  const nb = byId(S.notebooks, id);
  if (!nb) return;
  const notes = S.notes.filter((n) => n.notebook === id);
  const blob = await notebookZip(notes, S.folders.filter((f) => f.notebook === id), format);
  const name = fileBase(nb.title) + ' (' + (format === 'html' ? 'HTML' : 'Markdown') + ').zip';
  SlopUI.download(blob, name);
  toast('Exported ' + notes.length + ' note' + (notes.length === 1 ? '' : 's') + ' to ' + name);
}

/** The next (+1) or previous (-1) note in the list. */
export function stepNote(dir) {
  const list = visibleNotes();
  if (!list.length) return;
  const i = list.findIndex((n) => n.id === S.noteId);
  const j = i < 0 ? (dir > 0 ? 0 : list.length - 1) : (i + dir + list.length) % list.length;
  selectNote(list[j].id);
}
