/* Slop Code: the Slop Drive file tree. Folders and files as Drive shows them (Trash hidden). Click a folder to
 * open or close it, click a file to open it. Right-click (or the Menu key) for New, Open, Rename, Copy path and
 * Delete. Arrow keys move between rows. On a phone the tree is a drawer. */
import { el } from './dom.js';
import { tree as loadTree, pathOf } from './drive.js';
import { askTrash } from './dialogs.js';

const KEY = 'slop-code.open-folders';
const H = () => window.SlopHub;
let host = null, cb = null, rows = [], byKey = new Map();
let cache = { folders: [], files: [] }; // the last read of Drive, so a toggle redraws without reading again
let expanded = readExpanded();
let selected = null; // folder id of the last folder clicked (null: the root)
let activeId = null;

function readExpanded() {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch (e) { return new Set(); }
}
function saveExpanded() {
  try { localStorage.setItem(KEY, JSON.stringify([...expanded])); } catch (e) { /* not kept */ }
}
const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

/** Wire the tree. callbacks: onOpen(rec), onNew(folderId), onRenamed(rec), onTrashed(rec). */
export function initTree(listEl, callbacks) {
  host = listEl; cb = callbacks;
  host.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const btns = [...host.querySelectorAll('.cd-row')], i = btns.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    btns[Math.max(0, Math.min(btns.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))].focus();
  });
  if (window.SlopHub && SlopHub.on) SlopHub.on('drive:change', () => refresh());
  if (window.SlopCtx) SlopCtx.bind(host, resolveMenu);
}

/** Read Drive and redraw. */
export async function refresh() {
  cache = await loadTree();
  build();
}

/** Flatten the cached folders and files into rows, following the open folders. */
function build() {
  const { folders, files } = cache;
  rows = [];
  const walk = (parentId, depth) => {
    for (const f of folders.filter((x) => (x.parentId ?? null) === parentId).sort(byName)) {
      rows.push({ kind: 'folder', rec: f, depth, key: 'd:' + f.id });
      if (expanded.has(f.id)) walk(f.id, depth + 1);
    }
    for (const f of files.filter((x) => (x.folderId ?? null) === parentId).sort(byName)) rows.push({ kind: 'file', rec: f, depth, key: 'f:' + f.id });
  };
  walk(null, 0);
  draw();
}

function draw() {
  byKey = new Map(rows.map((r) => [r.key, r]));
  const nodes = rows.map((r) => {
    const isFolder = r.kind === 'folder';
    const open = isFolder && expanded.has(r.rec.id);
    return el('button', { type: 'button', class: 'cd-row' + (r.kind === 'file' && r.rec.id === activeId ? ' on' : '') + (isFolder ? ' cd-dir' : ''),
      'data-key': r.key, style: `padding-left:${8 + r.depth * 14}px`, title: r.rec.name, 'aria-expanded': isFolder ? (open ? 'true' : 'false') : null,
      'aria-current': r.kind === 'file' && r.rec.id === activeId ? 'true' : null, onclick: () => activate(r) },
      el('span', { class: 'cd-ic', 'aria-hidden': 'true' }, isFolder ? (open ? '▾' : '▸') : extLabel(r.rec.name)),
      el('span', { class: 'cd-nm' }, r.rec.name));
  });
  host.replaceChildren(...(nodes.length ? nodes : [el('p', { class: 'cd-hint' }, 'Slop Drive is empty. Use New, or save a file here.')]));
}
const extLabel = (name) => { const m = /\.([^.]+)$/.exec(name); return m ? m[1].slice(0, 4).toUpperCase() : '·'; };

function activate(r) {
  if (r.kind === 'folder') {
    selected = r.rec.id;
    if (expanded.has(r.rec.id)) expanded.delete(r.rec.id); else expanded.add(r.rec.id);
    saveExpanded();
    build();
    return;
  }
  cb.onOpen(r.rec);
}

/** Mark the open file in the tree. */
export function setActive(id) { activeId = id; for (const b of host.querySelectorAll('.cd-row')) { const on = b.dataset.key === 'f:' + id; b.classList.toggle('on', on); if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); } }
/** The folder for New: the last folder clicked, or the root. */
export const selectedFolder = () => selected;
/** Open every folder above `id` so a file in it shows in the tree. */
export function revealFolder(id) {
  for (let f = id, n = 0; f && n < 64; n++) {
    expanded.add(f);
    const folder = cache.folders.find((x) => x.id === f);
    f = folder ? folder.parentId ?? null : null;
  }
  saveExpanded();
  build();
}

/* ---------- right-click menu ---------- */
function resolveMenu(target) {
  const btn = target && target.closest ? target.closest('[data-key]') : null;
  const r = btn ? byKey.get(btn.dataset.key) : null;
  const folderId = r ? (r.kind === 'folder' ? r.rec.id : (r.rec.folderId ?? null)) : selected;
  const newSub = [
    { label: 'File…', act: () => cb.onNew(folderId) },
    { label: 'Folder…', act: () => newFolder(folderId) },
  ];
  if (!r) return [{ label: 'New', sub: newSub }];
  if (r.kind === 'folder') {
    const open = expanded.has(r.rec.id);
    return [{ label: open ? 'Close' : 'Open', act: () => activate(r) }, { label: 'New', sub: newSub }, '-',
      { label: 'Rename…', act: () => rename(r) }, { label: 'Copy path', act: () => copyPath(r) }, '-', { label: 'Delete…', act: () => remove(r) }];
  }
  return [{ label: 'Open', act: () => cb.onOpen(r.rec) }, { label: 'New', sub: newSub }, '-',
    { label: 'Rename…', act: () => rename(r) }, { label: 'Copy path', act: () => copyPath(r) }, '-', { label: 'Delete…', act: () => remove(r) }];
}

async function newFolder(parentId) {
  const name = await SlopUI.prompt('New folder', 'Folder name', 'New folder', { ok: 'Create' });
  if (!name || !name.trim()) return;
  const id = await H().createFolder(name.trim(), parentId ?? null);
  if (parentId) expanded.add(parentId);
  expanded.add(id); saveExpanded();
  selected = id;
  await refresh();
}

async function rename(r) {
  const name = await SlopUI.prompt('Rename', 'Name', r.rec.name, { ok: 'Rename' });
  if (!name || !name.trim() || name.trim() === r.rec.name) return;
  const next = name.trim();
  if (r.kind === 'folder') await H().updateFolder(r.rec.id, { name: next });
  else { const out = await H().update(r.rec.id, { name: next }); if (out) cb.onRenamed(out); }
  await refresh();
}

async function copyPath(r) {
  const p = r.kind === 'folder' ? await pathOf(r.rec.parentId ?? null, r.rec.name) : await pathOf(r.rec.folderId ?? null, r.rec.name);
  try { await navigator.clipboard.writeText(p); SlopUI.toast('Copied ' + p); } catch (e) { SlopUI.toast(p); }
}

async function remove(r) {
  if (!(await askTrash(r.rec.name, r.kind === 'folder'))) return;
  const stamp = { trashedAt: Date.now() };
  if (r.kind === 'folder') await H().updateFolder(r.rec.id, stamp);
  else await H().update(r.rec.id, stamp);
  cb.onTrashed(r.rec, r.kind);
  await refresh();
}
