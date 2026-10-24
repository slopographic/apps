/* Slop Tables — ui/ctxmenu: context menus for a cell, a selection, a row header, a column header and a sheet tab.
 * A right-click selects what is under the pointer first (as a desktop app does). The Menu key or Shift+F10 opens the
 * same menu for the selection on the grid, or for the focused sheet tab. The items are the menu bar's own rows
 * (commands.js menus()) and the shared actions in actions.js and sheets.js, so nothing is duplicated. */
import { S, range, redraw } from './state.js';
import * as A from './actions.js';
import * as Sh from './sheets.js';
import * as cmd from './commands.js';
import { startEdit } from './editor.js';
import * as OBJ from './objects.js';

const pick = (menu, labels) => labels.map((l) => menu.find((i) => i && i.label === l)).filter((i) => i !== undefined);
const isMulti = () => { const g = range(); return g.r1 !== g.r2 || g.c1 !== g.c2; };
const rowIn = (r) => { const g = range(); return r >= g.r1 && r <= g.r2; };
const colIn = (c) => { const g = range(); return c >= g.c1 && c <= g.c2; };
const cellIn = (r, c) => rowIn(r) && colIn(c);

/** The cell menu (one cell) or the selection menu (a range): clipboard, clear, and the common formats. */
function cellItems(multi) {
  const M = cmd.menus(), out = [];
  if (!multi) out.push({ label: 'Edit cell', act: () => startEdit() }, '-');
  out.push(...pick(M.Edit, ['Cut', 'Copy', 'Paste']), '-', ...pick(M.Edit, ['Clear contents', 'Clear contents and formats']), '-', ...pick(M.Format, ['Bold', 'Italic', 'Number format']));
  return out;
}
function rowItems(r) {
  return [
    { label: 'Select row', act: () => A.selectLine('row', r) },
    { label: 'Clear contents', act: () => { A.selectLine('row', r); A.clearRange('contents'); } },
    '-',
    { label: 'Hide row', act: () => A.setHidden('row', r, r, true) },
    ...showAllItem(),
  ];
}
function colItems(c) {
  return [
    { label: 'Select column', act: () => A.selectLine('col', c) },
    { label: 'Clear contents', act: () => { A.selectLine('col', c); A.clearRange('contents'); } },
    '-',
    { label: 'Hide column', act: () => A.setHidden('col', c, c, true) },
    ...showAllItem(),
  ];
}
/** Only when something is hidden. */
const showAllItem = () => (A.hasHidden() ? ['-', { label: 'Show all rows and columns', act: () => A.showAll() }] : []);
function tabItems(i) {
  return [
    { label: 'Rename…', act: () => Sh.rename(i) },
    { label: 'Delete sheet', act: () => Sh.remove(i) },
    '-',
    { label: 'Add sheet', act: () => Sh.add() },
  ];
}

/** Right-click or Menu key target: a cell, a row or column header, or a sheet tab. ev is null from the keyboard. */
function resolve(target, ev) {
  if (!target || !target.closest) return null;
  const tab = target.closest('.tab[data-i]');
  if (tab) return tabItems(+tab.dataset.i);
  if (!ev) {
    // keyboard: the grid itself (not an open cell editor) opens the menu for the selection
    if (target.id !== 'grid' || S.edit) return null;
    return cellItems(isMulti());
  }
  const box = target.closest('.chart-box');
  if (box) return OBJ.chartItems(box.dataset.id);
  const ch = target.closest('.ch[data-c]');
  if (ch) { const c = +ch.dataset.c; if (!colIn(c)) A.selectLine('col', c); return colItems(c); }
  const rh = target.closest('.rh[data-r]');
  if (rh) { const r = +rh.dataset.r; if (!rowIn(r)) A.selectLine('row', r); return rowItems(r); }
  const cell = target.closest('[data-rc]');
  if (cell) {
    const [r, c] = cell.dataset.rc.split(',').map(Number);
    if (!cellIn(r, c)) { S.sel = { r, c, er: r, ec: c }; redraw(); }
    const pv = OBJ.pivotItems(r, c);
    return pv ? [...pv, '-', ...cellItems(isMulti())] : cellItems(isMulti());
  }
  return null;
}

export function init() {
  if (!window.SlopCtx) return;
  const grid = document.getElementById('grid'), tabs = document.getElementById('tabs');
  if (grid) SlopCtx.bind(grid, resolve);
  if (tabs) SlopCtx.bind(tabs, resolve);
}
