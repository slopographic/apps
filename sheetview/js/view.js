/* Slop Sheets viewer: draws the open files, their sheet tabs, the grid and the status line from the store.
 * createView(store, els, appearance) → { render(), grid }. Clicks go back to the store, which the render reads. */
import { mountGrid, colName } from '../../shared/sheets/table.js';
import { describeSort, isActiveFilter } from '../../shared/sheets/query.js';
import { openFilter } from './filter-ui.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const n = (v) => v.toLocaleString(undefined);
const plural = (c, one, many) => `${c} ${c === 1 ? one : many}`;

export function createView(store, els, appearance) {
  const grid = mountGrid(els.grid, { sortable: true, onSort: (col) => store.cycleSort(col), style: appearance.style, palette: appearance.palette, emptyText: 'This sheet is empty.' });
  let shownKey = null;

  function docTabs(d) {
    els.docs.replaceChildren(...store.docs.map((doc, i) => {
      const tab = el('div', 'sv-doctab' + (i === store.active ? ' on' : ''));
      const pick = el('button', 'sv-doctab-name', doc.name);
      pick.type = 'button';
      pick.setAttribute('role', 'tab');
      pick.setAttribute('aria-selected', String(i === store.active));
      pick.title = doc.fileName;
      pick.addEventListener('click', () => store.selectDoc(i));
      const x = el('button', 'sv-doctab-x', '×');
      x.type = 'button';
      x.setAttribute('aria-label', `Close ${doc.fileName}`);
      x.addEventListener('click', () => store.closeDoc(i));
      tab.append(pick, x);
      return tab;
    }));
    els.docs.hidden = !d;
  }

  function sheetTabs(d) {
    els.sheets.replaceChildren(...(d ? d.sheets : []).map((s, i) => {
      const b = el('button', 'sv-sheettab' + (i === d.sheet ? ' on' : ''), s.name);
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(i === d.sheet));
      b.title = `${s.name}: ${plural(s.height, 'row', 'rows')}, ${plural(s.width, 'column', 'columns')}`;
      b.addEventListener('click', () => store.selectSheet(i));
      return b;
    }));
    els.sheets.hidden = !d;
  }

  /** Counts leave out the header row (v.head), which always shows. */
  function status(sheet, order, v) {
    const filters = [...v.filters.values()].filter(isActiveFilter).length;
    const parts = [], total = sheet.height - v.head, shown = order.length - v.head;
    parts.push(shown === total
      ? `${plural(total, 'row', 'rows')}`
      : `${n(shown)} of ${n(total)} rows`);
    if (filters) parts.push(`${plural(filters, 'filter', 'filters')} on`);
    const sort = describeSort(v.sort, colName);
    if (sort) parts.push(sort);
    return parts.join(' · ');
  }

  function render() {
    const d = store.doc();
    els.empty.hidden = !!d;
    els.view.hidden = !d;
    docTabs(d);
    sheetTabs(d);
    if (!d) { els.name.textContent = ''; els.status.textContent = ''; els.clear.disabled = true; return; }
    const sheet = store.sheet(), v = store.view(), order = store.order();
    const key = `${d.id}:${d.sheet}`;
    const changedSheet = key !== shownKey;
    shownKey = key;
    els.name.textContent = d.fileName;
    els.clear.disabled = !v.sort && ![...v.filters.values()].some(isActiveFilter);
    els.status.textContent = `${sheet.name} · ${status(sheet, order, v)}`;
    grid.update({
      sheet, order, sort: v.sort, filtered: new Set([...v.filters.keys()].filter((c) => isActiveFilter(v.filters.get(c)))),
      onFilter: (col, btn) => openFilter(btn, { sheet, col, spec: store.filterOf(col), onApply: (f) => store.setFilter(col, f), head: v.head }),
      resetScroll: changedSheet,
    });
  }

  return {
    render,
    grid,
    /** Restyle the table at once (the header choices). */
    restyle(a) { grid.update({ style: a.style, palette: a.palette }); },
  };
}
