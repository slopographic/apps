/* Paste: boot. Loads the pastes from Slop Drive, opens the paste named by ?paste=<id> (a share link) or the one
 * open last (SlopSession), and wires the screen, the paste handler, the menus, the commands and the save indicator. */
import * as store from './store.js';
import { S } from './state.js';
import * as A from './actions.js';
import { renderAll, wireView } from './view.js';
import { registerCommands, resolveMenu } from './commands.js';
import { $ } from './dom.js';

function wire() {
  $('pb-new').addEventListener('click', () => A.newPaste({ kind: 'text' }));
  $('pb-add-img').addEventListener('click', () => A.addImage());
  $('pb-side-btn').addEventListener('click', () => A.setPane('list'));
  $('pb-cmd').addEventListener('click', () => { if (window.SlopCmd && SlopCmd.open) SlopCmd.open(); });
  $('pb-link-copy').addEventListener('click', () => {
    const v = $('pb-link').value;
    navigator.clipboard.writeText(v).then(() => SlopUI.toast('Link copied'), () => { $('pb-link').select(); SlopUI.toast('Select the link and copy it'); });
  });
  wireView(A);
  document.addEventListener('paste', (e) => A.onPaste(e));
  if (window.SlopCtx) SlopCtx.bind($('pb-app'), resolveMenu);
}

/** The save indicator, and the guard that asks before leaving while a paste is not yet in Slop Drive. */
function wireSaves() {
  store.onSaveState((state, err) => {
    const t = $('pb-save');
    t.dataset.state = state;
    t.textContent = state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved to Slop Drive' : 'Not saved: ' + ((err && err.message) || 'Slop Drive is unavailable');
    if (window.SlopGuard) SlopGuard.setUnsaved('paste', store.hasPending());
  });
  addEventListener('pagehide', () => { store.flush(); });
}

async function openStart() {
  const link = new URL(location.href).searchParams.get('paste');
  if (link) { A.openLink(link); return; }
  let last = null;
  try { last = await SlopSession.load('paste', 'last', null); } catch (e) { last = null; }
  if (last && last.id && S.pastes.some((p) => p.id === last.id)) A.open(last.id);
}

async function boot() {
  SlopHub.register('paste');
  wire();
  wireSaves();
  registerCommands();
  try {
    S.pastes = await store.load();
    await openStart();
    // First visit (nothing saved yet): open a new paste straight away, so the editor is ready to type in.
    if (!S.pastes.length && !S.id) await A.newPaste({ kind: 'text' });
  } catch (e) {
    SlopUI.toast('Could not read Slop Drive: ' + e.message);
  }
  renderAll();
  document.body.classList.add('ready');
}

boot();
