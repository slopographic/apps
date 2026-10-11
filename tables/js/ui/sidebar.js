/* Slop Tables sidebar: the left column with Sheets, Templates (From template…, My templates) and Functions.
   It is collapsible; the choice is kept in this browser. Every item calls the same code as the menus. */
import { S, $, redraw } from './state.js';
import * as Sheets from './sheets.js';
import * as TPL from './templates.js';
import * as F from './storage.js';
import { fromNative } from '../io/native.js';
import { fnNames } from '../fn/index.js';
import { startEdit } from './editor.js';

const KEY = 'slop-tables.sidebar';
const LIMIT_MS = 1500; // My templates is read from IndexedDB; a read that never answers shows an empty list
let sheetsKey = '';
let mineSeq = 0;

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

/** A list item holding one control or text. */
const wrap = (node) => { const li = el('li'); li.append(node); return li; };

/* ---- collapse ---- */
function applyCollapsed(collapsed) {
  const side = $('side'), t = $('sideToggle');
  if (!side || !t) return;
  side.classList.toggle('collapsed', collapsed);
  t.setAttribute('aria-expanded', String(!collapsed));
  t.setAttribute('aria-label', collapsed ? 'Show sidebar' : 'Hide sidebar');
  t.title = collapsed ? 'Show sidebar' : 'Hide sidebar';
  t.textContent = collapsed ? '›' : '‹';
}
function savedCollapsed() {
  try { return localStorage.getItem(KEY) === 'collapsed'; } catch (e) { return false; }
}
export function setCollapsed(collapsed) {
  try { localStorage.setItem(KEY, collapsed ? 'collapsed' : 'open'); } catch (e) { /* storage blocked: lasts this visit */ }
  applyCollapsed(collapsed);
  if (!collapsed) loadMine();
  redraw(); // the grid is wider or narrower now
}

/* ---- Sheets ---- */
/** Rebuilds the sheet list only when the names or the active sheet change. */
export function renderSheets() {
  const list = $('sideSheets');
  if (!list || !S.wb) return;
  const key = S.wb.sheets.map((s) => s.name).join('\u0001') + '|' + S.si;
  if (key === sheetsKey) return;
  sheetsKey = key;
  list.replaceChildren(...S.wb.sheets.map((sh, i) => {
    const b = el('button', 'side-item' + (i === S.si ? ' on' : ''), sh.name);
    b.type = 'button';
    b.title = sh.name;
    if (i === S.si) b.setAttribute('aria-current', 'true');
    b.addEventListener('click', () => Sheets.select(i));
    return wrap(b);
  }));
}

/* ---- My templates ---- */
async function loadMine() {
  const list = $('sideMine');
  if (!list) return;
  const seq = ++mineSeq;
  const recs = await new Promise((res) => {
    const t = setTimeout(() => res([]), LIMIT_MS);
    Promise.resolve().then(() => TPL.listMine()).then((v) => { clearTimeout(t); res(v || []); }, () => { clearTimeout(t); res([]); });
  });
  if (seq !== mineSeq) return; // a newer load has started
  if (!recs.length) { list.replaceChildren(wrap(el('span', 'side-empty', 'None saved yet'))); return; }
  list.replaceChildren(...recs.map((rec) => {
    const b = el('button', 'side-item', rec.name || 'Untitled template');
    b.type = 'button';
    b.title = rec.description || rec.name || '';
    b.addEventListener('click', async () => {
      try { await F.useWorkbook(fromNative(rec.native), rec.name); } catch (e) { window.SlopUI.toast('That template could not be opened'); }
      loadMine();
    });
    return wrap(b);
  }));
}

/* ---- Functions ---- */
function buildFunctions() {
  const list = $('sideFns');
  if (!list) return;
  list.replaceChildren(...fnNames().map((name) => {
    const b = el('button', 'side-item side-fn-b', name);
    b.type = 'button';
    b.title = 'Start a formula with ' + name;
    b.dataset.name = name;
    b.addEventListener('click', () => { if (!S.edit) startEdit('=' + name + '('); });
    return wrap(b);
  }));
  const filter = $('fnFilter');
  filter.addEventListener('input', () => {
    const q = filter.value.trim().toUpperCase();
    for (const b of list.querySelectorAll('.side-fn-b')) b.parentNode.hidden = !!q && !b.dataset.name.includes(q);
  });
}

/** Wires the sidebar. Called once at boot. */
export function init() {
  applyCollapsed(savedCollapsed());
  $('sideToggle').addEventListener('click', () => setCollapsed(!$('side').classList.contains('collapsed')));
  $('sideAddSheet').addEventListener('click', () => Sheets.add());
  $('sideFromTpl').addEventListener('click', () => TPL.openTemplates());
  buildFunctions();
  if (!savedCollapsed()) loadMine();
}

/** Repaint hook: keeps the sheet list in step with the workbook. */
export function render() { renderSheets(); }
