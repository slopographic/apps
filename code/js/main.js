/* Slop Code: boot. Wires the editor, the tabs, the Slop Drive tree, Run, the drawer and the commands, then
 * opens the file given by ?drive=<id> (Send to, or Open with). */
import * as docs from './docs.js';
import { newView, makeState, setHooks, setWrap, isWrap, showFind } from './editor.js';
import { initTree, refresh as refreshTree, selectedFolder, revealFolder, newFolder } from './tree.js';
import { initLayout, expandSection } from './explorer.js';
import { renderExtensions, formatDoc, chooseLanguage } from './extensions.js';
import { $, env, setHandlers, renderChrome, setStatus, setTreeOpen, treeOpen, setPreview, toast, isPhone, initDrawer } from './ui.js';
import { openRecord, saveDoc, saveAs, newFile, closeDoc, onEdit, showDoc, restoreTabs, togglePreview } from './ops.js';
import { runDoc, attachPreview, canRun } from './run.js';
import { registerCommands } from './commands.js';

async function openPicker() {
  const rec = await SlopHub.pickFromDrive({ title: 'Open from Slop Drive' });
  if (rec) openRecord(rec);
}
async function runCurrent() {
  const d = docs.current();
  if (!d) { toast('Open a file first'); return; }
  if (d.kind !== 'text' || !canRun(d.name)) { toast('Run works on HTML and JavaScript files'); return; }
  setPreview(true);
  await runDoc(d, docs.textOf(d), (id) => { const o = docs.find(id); return o ? docs.textOf(o) : undefined; });
}
function toggleWrap() {
  setWrap(env.view, !isWrap());
  setStatus();
  toast(`Line wrap ${isWrap() ? 'on' : 'off'}`);
}
const toggleFiles = () => setTreeOpen(!treeOpen());
/** Show the sidebar with the Extensions section open, and put focus on the first helper. */
function showExtensions() {
  setTreeOpen(true);
  expandSection('ext');
  const first = document.getElementById('cd-ext-formatter');
  if (first) first.focus();
}

/** The actions the commands and buttons call. */
const ACTIONS = {
  open: openPicker,
  new: () => newFile(selectedFolder()),
  save: () => saveDoc(),
  saveAs: () => saveAs(),
  close: () => closeDoc(),
  find: () => env.view && showFind(env.view, false),
  replace: () => env.view && showFind(env.view, true),
  wrap: toggleWrap,
  files: toggleFiles,
  run: runCurrent,
  newFolder: () => newFolder(selectedFolder()),
  format: formatDoc,
  language: chooseLanguage,
  extensions: showExtensions,
  markdown: () => togglePreview(),
};

function wireButtons() {
  const on = (id, fn) => $(id).addEventListener('click', fn);
  on('cd-open', openPicker); on('cd-empty-open', openPicker);
  on('cd-new', () => ACTIONS.new()); on('cd-empty-new', () => ACTIONS.new()); on('cd-tree-new', () => ACTIONS.new());
  on('cd-save', () => saveDoc()); on('cd-saveas', () => saveAs());
  on('cd-run', runCurrent);
  on('cd-md', () => togglePreview());
  on('cd-cmd', () => (window.SlopCmd && SlopCmd.open ? SlopCmd.open() : toast('Commands are not loaded')));
  on('cd-files', () => { if (!isPhone()) toggleFiles(); });   // on a phone it is the drawer's own toggle
  on('cd-tree-folder', () => newFolder(selectedFolder()));
  on('cd-pv-close', () => setPreview(false));
}

async function boot() {
  SlopHub.register('code');
  initLayout();
  initDrawer();
  setTreeOpen(treeOpen()); // keeps the Files button's aria-expanded in step with what is shown
  const view = newView($('cd-editor'), makeState('', 'untitled.txt'));
  env.view = view;
  docs.attachView(view);
  setHooks({ change: () => onEdit(), select: () => setStatus() });
  setHandlers({ select: (d) => showDoc(d), close: (d) => closeDoc(d) });
  attachPreview($('cd-frame'), $('cd-console'));
  initTree($('cd-tree-list'), {
    // Opening a file keeps the sidebar where it is. Only the phone drawer closes, since it covers the editor.
    onOpen: (rec) => { openRecord(rec); if (isPhone()) setTreeOpen(false); },
    onNew: (folderId) => newFile(folderId),
    onRenamed: (rec) => { docs.rename(rec.id, rec.name); renderChrome(); },
    onMoved: (rec) => { docs.rename(rec.id, rec.name); const d = docs.find(rec.id); if (d) d.folderId = rec.folderId ?? null; renderChrome(); },
    onTrashed: () => {},
  });
  renderExtensions($('cd-ext-list'));
  wireButtons();
  registerCommands(ACTIONS);
  await refreshTree();
  await restoreTabs();
  const launch = await SlopHub.consumeLaunch();
  if (launch) { if (launch.folderId) revealFolder(launch.folderId); await openRecord(launch); }
  renderChrome();
  document.body.classList.add('ready');
}

window.SlopCode = { view: () => env.view, docs, openRecord, saveDoc, saveAs, newFile, closeDoc, runCurrent, refreshTree, actions: ACTIONS };
// Convert… in the header (shared/convert/provided.js): the open file (its live text, or a viewer tab's Drive file).
addEventListener('slop:convert-files', (e) => e.detail.provide(async () => {
  const d = docs.current();
  if (!d) return null;
  if (d.kind === 'text' || !d.kind) return [{ name: d.name, blob: new Blob([docs.textOf(d)], { type: 'text/plain' }) }];
  const rec = d.id && window.SlopHub ? await SlopHub.get(d.id).catch(() => null) : null;
  return rec && rec.blob ? [{ name: rec.name || d.name, blob: rec.blob }] : null;
}));
boot().catch((e) => { console.error(e); toast('Slop Code could not start: ' + e.message); document.body.classList.add('ready'); });
