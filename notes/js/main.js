/* Slop Notes: boot. Reads the notebooks, folders and notes from Slop Drive, reopens the notes that were open (their tabs,
 * tabs.js), and wires the screen, the menus, the commands and the save indicator. Saves run in the background. */
import * as store from './store.js';
import * as tabs from './tabs.js';
import { S, curNote } from './state.js';
import * as A from './actions.js';
import { renderSide } from './side.js';
import { renderList } from './list.js';
import { renderEditor, wireEditor } from './editor.js';
import { resolveMenu, exportMenu, renameFocused } from './menus.js';
import { blockItems } from './blocks.js';
import { registerCommands } from './commands.js';
import { $ } from './dom.js';

function refresh() {
  renderSide();
  renderList();
  renderEditor();
  $('nt-app').dataset.pane = S.pane;
  tabs.refresh();
}
A.setRedraw(refresh);

function wire() {
  const on = (id, fn) => $(id).addEventListener('click', fn);
  on('nt-new', () => A.newNote());
  on('nt-nb-new', () => A.newNotebook());
  on('nt-fd-new', () => A.newFolder());
  // On a phone the notebooks are a drawer from the start edge: SlopSheet (shared/ui/sheet.js) makes Notebooks (View menu)
  // its toggle and gives it the ×, Escape, a tap outside and a swipe left. Wired before the app's keys.
  A.setSide(SlopSheet.attach({ root: $('nt-app'), panel: $('nt-side'), side: 'start', phone: '(max-width: 899px)', toggles: [$('nt-side-btn')], label: 'Notebooks' }));
  on('nt-del', () => { const n = curNote(); if (n) A.remove(n); });
  on('nt-cmd', () => { if (window.SlopCmd && SlopCmd.open) SlopCmd.open(); });
  $('nt-insert').addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    SlopUI.menu(blockItems(), r.left, r.bottom + 4);
  });
  $('nt-app').addEventListener('keydown', (e) => { if (e.key === 'F2' && renameFocused(e.target)) e.preventDefault(); });
  $('nt-export').addEventListener('click', (e) => {
    const items = exportMenu();
    if (!items) return;
    const r = e.currentTarget.getBoundingClientRect();
    SlopUI.menu(items, r.left, r.bottom + 4);
  });
  $('nt-q').addEventListener('input', (e) => { S.query = e.target.value; renderList(); });
  wireEditor({ list: () => { renderList(); tabs.refresh(); }, side: renderSide }); // a typed title also renames the tab
  if (window.SlopCtx) SlopCtx.bind($('nt-app'), resolveMenu);
}

/** The save indicator, and the guard that asks before leaving while a change is not yet in Slop Drive. */
function wireSaves() {
  store.onSaveState((state, err) => {
    const t = $('nt-save');
    t.dataset.state = state;
    t.textContent = state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved to Slop Drive' : 'Not saved: ' + ((err && err.message) || 'Slop Drive is unavailable');
    if (window.SlopGuard) SlopGuard.setUnsaved('notes', store.hasPending());
    tabs.refresh();
    if (state === 'saved') tabs.flush();
  });
  addEventListener('pagehide', () => { store.flush(); });
}

async function boot() {
  SlopHub.register('notes');
  wire();
  wireSaves();
  registerCommands();
  const session = tabs.init({ redraw: refresh });
  try {
    Object.assign(S, await store.load());
  } catch (e) {
    SlopUI.toast('Could not read Slop Drive: ' + e.message);
  }
  await tabs.restore(session);   // the notes that were open, if they are still in Slop Drive
  refresh();
  document.body.classList.add('ready');
}

/** Convert… in the header (shared/convert/provided.js): the open note, as Markdown. */
addEventListener('slop:convert-files', (e) => e.detail.provide(async () => {
  const n = curNote();
  if (!n) return null;
  const { noteToMarkdown, fileBase } = await import('./export.js');
  return [{ name: fileBase(n.title) + '.md', blob: noteToMarkdown(n) }];
}));

boot();
