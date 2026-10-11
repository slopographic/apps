/* The sidebar: notebooks, the folder tree of the chosen notebook, and its tags. */
import { S, folderTree, tagCounts } from './state.js';
import * as A from './actions.js';
import { $, el, clear } from './dom.js';

const count = (fn) => S.notes.filter(fn).length;

function notebooks() {
  const box = clear($('nt-books'));
  box.append(el('button', { class: 'nt-item' + (S.notebookId ? '' : ' on'), type: 'button', onclick: () => A.selectNotebook(null) },
    el('span', { class: 'nt-name' }, 'All notes'), el('span', { class: 'nt-count' }, String(S.notes.length))));
  for (const nb of S.notebooks) {
    box.append(el('button', { class: 'nt-item' + (S.notebookId === nb.id ? ' on' : ''), type: 'button', 'data-kind': 'notebook', 'data-id': nb.id,
      onclick: () => A.selectNotebook(nb.id) },
    el('span', { class: 'nt-name' }, nb.title || 'Untitled notebook'), el('span', { class: 'nt-count' }, String(count((n) => n.notebook === nb.id)))));
  }
  if (!S.notebooks.length) box.append(el('p', { class: 'nt-hint' }, 'No notebooks yet.'));
}

function folders() {
  const box = clear($('nt-folders'));
  if (!S.notebookId) { box.append(el('p', { class: 'nt-hint' }, 'Choose a notebook to see its folders.')); return; }
  box.append(el('button', { class: 'nt-item' + (S.folderId ? '' : ' on'), type: 'button', onclick: () => A.selectFolder(null) },
    el('span', { class: 'nt-name' }, 'Whole notebook')));
  for (const [f, depth] of folderTree()) {
    box.append(el('button', { class: 'nt-item' + (S.folderId === f.id ? ' on' : ''), type: 'button', style: 'padding-left:' + (10 + depth * 14) + 'px',
      'data-kind': 'folder', 'data-id': f.id, onclick: () => A.selectFolder(f.id) },
    el('span', { class: 'nt-name' }, f.title || 'Untitled folder')));
  }
}

function tags() {
  const box = clear($('nt-tags'));
  const list = tagCounts();
  if (!list.length) { box.append(el('p', { class: 'nt-hint' }, 'Tags you add to notes show here.')); return; }
  for (const [t, n] of list) {
    box.append(el('button', { class: 'nt-tag' + (S.tag === t ? ' on' : ''), type: 'button', 'aria-pressed': S.tag === t ? 'true' : 'false',
      onclick: () => A.selectTag(t) }, '#' + t + ' ', el('span', { class: 'nt-count' }, String(n))));
  }
}

export function renderSide() {
  notebooks();
  folders();
  tags();
}
