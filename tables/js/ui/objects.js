/* Slop Tables: charts and pivot tables in the menus, the context menu and the sidebar. Insert ▸ Chart… and Pivot table…,
 * Refresh pivot tables (every one in the workbook), and for a cell inside a pivot table: Refresh, Edit and Delete. The
 * sidebar's "Charts and pivots" lists the active sheet's objects; a chart there selects it, a pivot table has Refresh.
 * A sheet rename carries over into the charts' and pivot tables' sources. */
import { S, $, sheet, redraw, toast } from './state.js';
import { transact } from './history.js';
import * as charts from './charts.js';
import { openChartDialog } from './chart-dialog.js';
import { openPivotDialog } from './pivot-dialog.js';
import { writePivot, pivotAt } from '../objects/pivot-write.js';
import { parseRange, quoteSheet, rangeText } from '../engine/refs.js';

/** Refreshes one pivot table, or every one in the workbook. One undo step. Resolves the count refreshed. */
export function refresh(only = null) {
  const wb = S.wb, errors = [];
  let n = 0;
  transact(() => wb.batch(() => {
    for (const sh of wb.sheets) for (const pv of sh.pivots || []) {
      if (only && pv.id !== only) continue;
      try { writePivot(wb, sh, pv); n++; } catch (e) { errors.push(`${sh.name}: ${e.message}`); }
    }
  }));
  if (errors.length) window.SlopUI.alert('Could not refresh', errors.join('\n'));
  else toast(n === 1 ? 'Pivot table refreshed' : n ? `${n} pivot tables refreshed` : 'There are no pivot tables to refresh');
  redraw();
  return n;
}

export function removePivot(id) {
  const sh = sheet(), pv = (sh.pivots || []).find((p) => p.id === id);
  if (!pv) return;
  transact(() => {
    if (pv.extent) S.wb.clear(sh, pv.at.r, pv.at.c, pv.at.r + pv.extent.rows - 1, pv.at.c + pv.extent.cols - 1, 'all');
    sh.pivots = sh.pivots.filter((p) => p !== pv);
  });
  redraw();
}

export const insertChart = () => openChartDialog(null);
export const editChart = (ch = charts.current()) => (ch ? openChartDialog(ch) : null);
export const insertPivot = () => openPivotDialog(null);

export const commands = () => [
  { id: 'insert.chart', title: 'Chart…', group: 'Insert', run: insertChart },
  { id: 'insert.pivot', title: 'Pivot table…', group: 'Insert', run: insertPivot },
  { id: 'data.refreshPivots', title: 'Refresh pivot tables', group: 'Insert', run: () => refresh() },
];

/** Context menu rows for a cell in a pivot table (null when it is not in one). */
export function pivotItems(r, c) {
  const sh = sheet(), pv = pivotAt(sh, r, c);
  if (!pv) return null;
  return [{ label: 'Refresh pivot table', act: () => refresh(pv.id) }, { label: 'Edit pivot table…', act: () => openPivotDialog(pv, sh) },
    { label: 'Delete pivot table', act: () => removePivot(pv.id) }];
}
/** Context menu rows for a chart. */
export function chartItems(id) {
  charts.select(id);
  return [{ label: 'Edit chart…', act: () => editChart() }, { label: 'Delete chart', act: () => charts.remove(id) }];
}

/** After a sheet rename: sources that named the old sheet name the new one. */
export function renamed(wb, oldName, newName) {
  const same = (n) => n && n.toLowerCase() === oldName.toLowerCase();
  for (const sh of wb.sheets) {
    for (const ch of sh.charts || []) {
      const p = parseRange(ch.range);
      if (p && same(p.sheet)) ch.range = quoteSheet(newName) + '!' + rangeText(p.r1, p.c1, p.r2, p.c2);
    }
    for (const pv of sh.pivots || []) if (same(pv.source.sheet)) pv.source.sheet = newName;
  }
}

/* ---- sidebar ---- */
let sideKey = '';
export function renderSide() {
  const list = $('sideObjects');
  if (!list || !S.wb) return;
  const sh = sheet(), key = JSON.stringify([S.si, (sh.charts || []).map((c) => [c.id, c.title, c.type]), (sh.pivots || []).map((p) => p.id)]);
  if (key === sideKey) return;
  sideKey = key;
  const li = (...kids) => { const e = document.createElement('li'); e.className = 'side-obj'; e.append(...kids); return e; };
  const btn = (cls, text, title, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = text; b.title = title; b.addEventListener('click', fn); return b; };
  const rows = [
    ...(sh.charts || []).map((ch) => li(btn('side-item', (ch.title || 'Untitled chart') + ' · ' + ch.type, 'Select this chart', () => reveal(ch.id)))),
    ...(sh.pivots || []).map((pv, i) => li(btn('side-item', 'Pivot table ' + (i + 1), 'Select this pivot table', () => { S.sel = { r: pv.at.r, c: pv.at.c, er: pv.at.r + (pv.extent ? pv.extent.rows - 1 : 0), ec: pv.at.c + (pv.extent ? pv.extent.cols - 1 : 0) }; redraw(); }),
      btn('side-mini', 'Refresh', 'Refresh this pivot table', () => refresh(pv.id)))),
  ];
  if (!rows.length) { const e = document.createElement('span'); e.className = 'side-empty'; e.textContent = 'None on this sheet'; rows.push(li(e)); }
  list.replaceChildren(...rows);
}

/** Selects a chart and scrolls it into view. */
function reveal(id) {
  const ch = (sheet().charts || []).find((c) => c.id === id), vp = $('vp');
  if (!ch) return;
  if (ch.x < vp.scrollLeft || ch.x + 40 > vp.scrollLeft + vp.clientWidth) vp.scrollLeft = Math.max(0, ch.x - 20);
  if (ch.y < vp.scrollTop || ch.y + 40 > vp.scrollTop + vp.clientHeight) vp.scrollTop = Math.max(0, ch.y - 20);
  charts.select(id);
}

export function init() {
  charts.init({ edit: (ch) => editChart(ch) });
  const ins = $('sideInsert');
  if (ins) {
    ins.querySelector('[data-act="chart"]').addEventListener('click', insertChart);
    ins.querySelector('[data-act="pivot"]').addEventListener('click', insertPivot);
  }
}
export function render() { charts.render(); renderSide(); }
