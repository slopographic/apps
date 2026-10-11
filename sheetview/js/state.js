/* Slop Sheets viewer: the open documents and their views (sheet, sort, filters). No DOM here.
 * A document: { id, name, format, sheets, sheet (index), views: [{ sort, filters: Map<col, filter>, version, cache }] }.
 * Every change to a view bumps its version, and the visible rows are recomputed only when the version moves. */
import { visibleOrder } from '../../shared/sheets/query.js';
import { emptyFilter, isActiveFilter } from '../../shared/sheets/query.js';

let nextId = 1;

export function createStore(onChange = () => {}) {
  const store = { docs: [], active: -1 };
  const changed = () => onChange(store);

  const newView = () => ({ sort: null, filters: new Map(), version: 0, cache: null });
  const bump = (v) => { v.version++; v.cache = null; };

  store.addDoc = (parsed, { name = parsed.name } = {}) => {
    const doc = {
      id: nextId++, name: name.replace(/\.[^.]*$/, '') || 'Untitled', fileName: name, format: parsed.format,
      sheets: parsed.sheets, sheet: 0, views: parsed.sheets.map(newView),
    };
    store.docs.push(doc);
    store.active = store.docs.length - 1;
    changed();
    return doc;
  };
  store.doc = () => store.docs[store.active] || null;
  store.sheet = () => { const d = store.doc(); return d ? d.sheets[d.sheet] : null; };
  store.view = () => { const d = store.doc(); return d ? d.views[d.sheet] : null; };

  store.selectDoc = (i) => { if (i >= 0 && i < store.docs.length) { store.active = i; changed(); } };
  store.selectSheet = (i) => {
    const d = store.doc();
    if (d && i >= 0 && i < d.sheets.length) { d.sheet = i; changed(); }
  };
  store.closeDoc = (i) => {
    if (i < 0 || i >= store.docs.length) return;
    store.docs.splice(i, 1);
    if (store.active >= store.docs.length) store.active = store.docs.length - 1;
    else if (i < store.active) store.active--;
    changed();
  };

  /** Click on a column header: ascending, then descending, then no sort. */
  store.cycleSort = (col) => {
    const v = store.view();
    if (!v) return;
    if (!v.sort || v.sort.col !== col) v.sort = { col, dir: 1 };
    else if (v.sort.dir === 1) v.sort = { col, dir: -1 };
    else v.sort = null;
    bump(v);
    changed();
  };
  store.setFilter = (col, spec) => {
    const v = store.view();
    if (!v) return;
    if (isActiveFilter(spec)) v.filters.set(col, spec); else v.filters.delete(col);
    bump(v);
    changed();
  };
  store.clearView = () => {
    const v = store.view();
    if (!v) return;
    v.sort = null; v.filters = new Map();
    bump(v);
    changed();
  };

  /** Row indexes to show for the active sheet, after filter and sort. Cached until the view changes. */
  store.order = () => {
    const d = store.doc(), v = store.view();
    if (!d || !v) return [];
    if (!v.cache || v.cache.sheet !== d.sheets[d.sheet] || v.cache.version !== v.version) {
      v.cache = { sheet: d.sheets[d.sheet], version: v.version, order: visibleOrder(d.sheets[d.sheet], v) };
    }
    return v.cache.order;
  };
  store.filterOf = (col) => store.view()?.filters.get(col) ?? emptyFilter();
  return store;
}
