/* Slop Notes: boot. Reads the notebooks, folders and notes from Slop Drive, reopens the note that was open last
 * (SlopSession), and wires the screen, the menus, the commands and the save indicator. Saves run in the background. */
import * as store from './store.js';
import { S, curNote } from './state.js';
import * as A from './actions.js';
import { renderSide } from './side.js';
import { renderList } from './list.js';
import { renderEditor, wireEditor } from './editor.js';
import { resolveMenu, exportMenu } from './menus.js';
import { registerCommands } from './commands.js';
import { $ } from './dom.js';

function refresh() {
  renderSide();
  renderList();
  renderEditor();
  $('nt-app').dataset.pane = S.pane;
}
A.setRedraw(refresh);

function wire() {
  const on = (id, fn) => $(id).addEventListener('click', fn);
  on('nt-new', () => A.newNote());
  on('nt-nb-new', () => A.newNotebook());
  on('nt-fd-new', () => A.newFolder());
  on('nt-side-btn', () => A.setPane('side'));
  on('nt-del', () => { const n = curNote(); if (n) A.remove(n); });
  on('nt-cmd', () => { if (window.SlopCmd && SlopCmd.open) SlopCmd.open(); });
  $('nt-export').addEventListener('click', (e) => {
    const items = exportMenu();
    if (!items) return;
    const r = e.currentTarget.getBoundingClientRect();
    SlopUI.menu(items, r.left, r.bottom + 4);
  });
  $('nt-q').addEventListener('input', (e) => { S.query = e.target.value; renderList(); });
  wireEditor({ list: renderList, side: renderSide });
  if (window.SlopCtx) SlopCtx.bind($('nt-app'), resolveMenu);
}

/** The save indicator, and the guard that asks before leaving while a change is not yet in Slop Drive. */
function wireSaves() {
  store.onSaveState((state, err) => {
    const t = $('nt-save');
    t.dataset.state = state;
    t.textContent = state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved to Slop Drive' : 'Not saved: ' + ((err && err.message) || 'Slop Drive is unavailable');
    if (window.SlopGuard) SlopGuard.setUnsaved('notes', store.hasPending());
  });
  addEventListener('pagehide', () => { store.flush(); });
}

/** Reopens the note (and notebook) that was open last, when it is still in Slop Drive. */
async function restoreLast() {
  let last = null;
  try { last = await SlopSession.load('notes', 'last', null); } catch (e) { last = null; }
  const n = last && last.noteId && S.notes.find((x) => x.id === last.noteId);
  if (!n) return;
  S.noteId = n.id;
  S.notebookId = last.notebookId && S.notebooks.some((b) => b.id === last.notebookId) ? last.notebookId : n.notebook;
  S.pane = 'editor';
}

async function boot() {
  SlopHub.register('notes');
  wire();
  wireSaves();
  registerCommands();
  try {
    Object.assign(S, await store.load());
    await restoreLast();
  } catch (e) {
    SlopUI.toast('Could not read Slop Drive: ' + e.message);
  }
  refresh();
  document.body.classList.add('ready');
}

boot();
