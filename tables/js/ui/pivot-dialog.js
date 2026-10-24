/* Slop Tables: Insert ▸ Pivot table… and Edit pivot table…, one dialog (SlopUI.dialog). The source starts as the
 * selection or the region around the active cell; its first row names the fields. Rows (and a second level), Columns,
 * and up to four values each with Sum, Count, Average, Min or Max. The table goes to a new sheet or to a cell the person
 * names; a place that holds other cells asks before it is overwritten. */
import { S, sheet, redraw, toast } from './state.js';
import { transact } from './history.js';
import { select as selectSheet } from './sheets.js';
import { startRange } from './chart-dialog.js';
import { readSource, writePivot, pivotSize, overlaps } from '../objects/pivot-write.js';
import { FNS } from '../objects/pivot.js';
import { newId } from '../objects/store.js';
import { parseCell, parseRange, addr } from '../engine/refs.js';

const MAX_VALUES = 4;

function fieldsOf(host, text) {
  const p = parseRange(text || '');
  if (!p) return { error: 'Type the source range, like A1:D50.' };
  try { const src = readSource(S.wb, host, { sheet: p.sheet, ref: text.slice(text.lastIndexOf('!') + 1) }); return { src }; }
  catch (e) { return { error: e.message }; }
}

function pivotSheetName(wb) { let n = 1; while (wb.sheetByName('Pivot ' + n)) n++; return 'Pivot ' + n; }

/** Opens the dialog. pv and pvSheet: an existing pivot table and its sheet to edit, or null to insert one. */
export function openPivotDialog(pv = null, pvSheet = null) {
  const ui = window.SlopUI, el = ui.el, host = pvSheet || sheet();
  const srcIn = el('input', { class: 'sui-input', type: 'text', spellcheck: 'false', autocomplete: 'off', placeholder: 'A1:D50', 'aria-label': 'Source range' });
  srcIn.value = pv ? (pv.source.sheet ? `'${pv.source.sheet.replace(/'/g, "''")}'!` : '') + pv.source.ref : startRange();
  const msg = el('p', { class: 'chart-msg', role: 'status' });
  const rows1 = el('select', { class: 'sui-input', 'aria-label': 'Rows' }), rows2 = el('select', { class: 'sui-input', 'aria-label': 'Then by' });
  const cols = el('select', { class: 'sui-input', 'aria-label': 'Columns' });
  const valuesBox = el('div', { class: 'pv-values' }), addBtn = el('button', { type: 'button', class: 'sui-btn pv-add' }, '+ Add value');
  const place = ui.select([['new', 'A new sheet'], ['here', 'This sheet, at a cell']], 'new');
  place.setAttribute('aria-label', 'Put it in');
  const atIn = el('input', { class: 'sui-input', type: 'text', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Top-left cell', placeholder: 'F1' });
  const placeRow = el('div', { class: 'pv-place' }, ui.field('Put it in', place), ui.field('At cell', atIn));
  let fields = [], numeric = [];

  const options = (sel, none, value) => {
    sel.replaceChildren(...(none ? [el('option', { value: '' }, none)] : []), ...fields.map((f) => el('option', { value: f }, f)));
    sel.value = fields.includes(value) ? value : (none ? '' : fields[0] || '');
  };
  function valueRow(v = {}) {
    const f = el('select', { class: 'sui-input', 'aria-label': 'Value field' }), fn = ui.select(FNS, v.fn || 'sum');
    fn.setAttribute('aria-label', 'Summarize by');
    options(f, null, v.field);
    const rm = el('button', { type: 'button', class: 'sui-btn pv-rm', 'aria-label': 'Remove value', title: 'Remove value' }, '×');
    const row = el('div', { class: 'pv-value' }, f, fn, rm);
    rm.addEventListener('click', () => { row.remove(); addBtn.disabled = false; });
    valuesBox.append(row);
    addBtn.disabled = valuesBox.children.length >= MAX_VALUES;
  }
  function loadFields(keep) {
    const r = fieldsOf(host, srcIn.value.trim());
    msg.textContent = r.error || '';
    if (r.error) return;
    fields = r.src.headers;
    numeric = fields.filter((_, j) => r.src.records.some((rec) => typeof rec[j] === 'number'));
    const text = fields.find((f) => !numeric.includes(f));
    options(rows1, '(none)', keep ? keep.rows[0] : text);
    options(rows2, '(none)', keep ? keep.rows[1] : '');
    options(cols, '(none)', keep ? keep.cols[0] : '');
    const old = keep ? keep.values : [...valuesBox.querySelectorAll('.pv-value')].map((row) => ({ field: row.children[0].value, fn: row.children[1].value }));
    valuesBox.replaceChildren();
    const list = old.filter((v) => fields.includes(v.field));
    (list.length ? list : [{ field: numeric[0] || fields[0], fn: numeric.length ? 'sum' : 'count' }]).slice(0, MAX_VALUES).forEach(valueRow);
  }
  srcIn.addEventListener('change', () => loadFields(null));
  addBtn.addEventListener('click', () => valueRow({ field: numeric[0] || fields[0], fn: 'sum' }));
  const syncPlace = () => { atIn.disabled = place.value !== 'here'; if (!atIn.disabled && !atIn.value) atIn.value = defaultCell(); };
  place.addEventListener('change', syncPlace);
  const defaultCell = () => { const p = parseRange(srcIn.value.trim()); return p ? addr(p.r1, Math.min(16383, p.c2 + 2)) : 'A1'; };
  loadFields(pv);
  syncPlace();

  const spec = () => {
    const p = parseRange(srcIn.value.trim());
    return {
      source: { sheet: p && p.sheet && p.sheet !== host.name ? p.sheet : null, ref: srcIn.value.trim().slice(srcIn.value.trim().lastIndexOf('!') + 1) },
      rows: [rows1.value, rows2.value].filter(Boolean).filter((f, i, a) => a.indexOf(f) === i),
      cols: cols.value ? [cols.value] : [],
      values: [...valuesBox.querySelectorAll('.pv-value')].map((row) => ({ field: row.children[0].value, fn: row.children[1].value })),
    };
  };
  const body = el('div', { class: 'pv-dlg' },
    ui.field('Source', srcIn), msg,
    el('div', { class: 'pv-grid' }, ui.field('Rows', rows1), ui.field('Then by', rows2), ui.field('Columns', cols)),
    el('div', { class: 'pv-h' }, 'Values'), valuesBox, addBtn, pv ? null : placeRow);

  return new Promise((res) => {
    let done = null;
    ui.dialog({
      title: pv ? 'Edit pivot table' : 'Insert pivot table', body, cls: 'pv-dialog',
      buttons: [{ label: 'Cancel' }, { label: pv ? 'Save' : 'Insert', primary: true, act: () => apply() }],
      onClose: (ok) => { redraw(); res(ok ? done : null); },
    });
    async function apply() {
      const s = spec();
      if (!fieldsOf(host, srcIn.value.trim()).src) { toast(msg.textContent || 'Check the source range'); return false; }
      if (!s.values.length) { toast('Add a value to summarize'); return false; }
      const wb = S.wb;
      let target = pvSheet, at = pv ? pv.at : { r: 0, c: 0 };
      if (!pv && place.value === 'here') {
        const cell = parseCell(atIn.value || '');
        if (!cell) { toast('Type the top-left cell, like F1'); return false; }
        target = host; at = { r: cell.r, c: cell.c };
      }
      const draft = { ...(pv || { id: newId(wb, 'p'), extent: null }), ...s, at };
      let size;
      try { size = pivotSize(wb, host, draft); } catch (e) { toast(e.message); return false; }
      if (target && overlaps(target, draft, at, size)) {
        const ok = await ui.confirm('Replace cells?', 'The pivot table needs cells that already hold data. Replace them?', 'Replace', { danger: true });
        if (!ok) return false;
      }
      try {
        transact(() => {
          if (!target) target = wb.addSheet(pivotSheetName(wb));
          if (draft.source.sheet === null && target !== host) draft.source.sheet = host.name;
          const list = target.pivots, i = list.findIndex((p) => p.id === draft.id);
          if (i >= 0) list[i] = draft; else list.push(draft);
          writePivot(wb, target, draft);
        });
      } catch (e) { toast(e.message); return false; }
      const si = wb.sheets.indexOf(target);
      if (si !== S.si) selectSheet(si);
      S.sel = { r: at.r, c: at.c, er: at.r + draft.extent.rows - 1, ec: at.c + draft.extent.cols - 1 };
      done = draft.id;
      return true;
    }
  });
}
