/* SlopLabel — ui/datadlg: importing data (CSV/TSV/JSON/Excel file, paste) and mapping columns to fields. */
'use strict';

/** A data file as the label's data source (with no file: the picker, a source of the intake, ui/intake.js). */
async function importDataDialog(file) {
  if (!file) return pickData();
  let src;
  try { src = await loadDataFile(file); } catch (e) { SlopUI.alert('Could not read the data', e.message || String(e)); return false; }
  return useDataSource(src);
}
/** Show the mapping dialog for a freshly loaded source and attach it to the document. */
async function useDataSource(src) {
  if (!src.rows.length) { SlopUI.alert('No records', 'The file has a header row but no data rows.'); return false; }
  // auto-map columns whose names match a variable (case-insensitive)
  for (const c of src.columns) { const v = App.doc.vars.find((x) => x.name.toLowerCase() === c.toLowerCase().trim()); if (v) src.map[c] = v.name; }
  const guessQty = src.columns.find((c) => /^(qty|quantity|copies|count|anzahl|menge)$/i.test(c.trim()));
  if (guessQty) src.qtyCol = guessQty;
  const ok = await mapColumnsDialog(src, true);
  if (!ok) return false;
  App.rec = 0;
  editDoc((d) => { d.data = src; }, 'Import data');
  App.tab = 'data';
  refresh();
  SlopUI.toast(`${src.rows.length} records from ${src.name}`);
  return true;
}
function pasteDataDialog() {
  const ta = mk('textarea', { class: 'inp', rows: 10, placeholder: 'Name,SKU,Price\nLime goo,SLP-1,4.99\n…  (or a JSON array)', style: 'width:100%;min-height:200px' });
  SlopFormReset.snapshot(ta.parentNode);
  SlopUI.dialog({ title: 'Paste data', cls: 'sui-wide', body: mk('div', null, mk('p', { class: 'sui-p' }, 'Paste rows from a spreadsheet (tab separated), CSV or JSON. The first row holds the column names.'), ta),
    buttons: [{ label: 'Cancel' }, { label: 'Next', primary: true, act: async () => {
      const t = ta.value.trim(); if (!t) return false;
      let src;
      try { src = /^[[{]/.test(t) ? parseJSONSource(t, 'Pasted data') : tableToSource(parseCSV(t), 'Pasted data'); } catch (e) { SlopUI.toast(e.message); return false; }
      setTimeout(() => useDataSource(src), 0);
    } }] });
}
/** Column → field mapping. isNew: the source is not attached yet (OK/Cancel decides). */
function mapColumnsDialog(D, isNew = false) {
  const vars = App.doc.vars.map((v) => v.name);
  const sels = {};
  const grid = mk('div', { class: 'map-grid' });
  for (const c of D.columns) {
    const cur = (D.map && D.map[c]) || c;
    const opts = [[c, '{' + c + '} (column name)'], ...vars.filter((v) => v !== c).map((v) => [v, 'Fill {' + v + '}']), ['-', '(ignore)']];
    const s = mk('select', { class: 'inp' }, opts.map(([v, l]) => mk('option', { value: v }, l)));
    s.value = opts.some(([v]) => v === cur) ? cur : c;
    sels[c] = s;
    grid.append(mk('span', { class: 'mono', title: c }, c, mk('small', { class: 'hint', style: 'display:block' }, D.rows[0] ? String(D.rows[0][D.columns.indexOf(c)] || '').slice(0, 40) : '')), mk('span', { class: 'arrow' }, '→'), s);
  }
  const qty = mk('select', { class: 'inp' }, [['', '(one label per record)'], ...D.columns.map((c) => [c, c])].map(([v, l]) => mk('option', { value: v }, l)));
  qty.value = D.qtyCol || '';
  const body = mk('div', { class: 'dlg-form' }, mk('p', { class: 'sui-p' }, `${D.name}: ${D.rows.length} records. Each column becomes a {Field}; or let it fill an existing variable (for example a prompt).`), grid, dRow('Labels per record', qty));
  SlopFormReset.snapshot(body);
  return new Promise((res) => SlopUI.dialog({ title: 'Map data columns', cls: 'sui-wide', body, onClose: (ok) => res(ok),
    buttons: [{ label: 'Cancel' }, SlopFormReset.dialogButton(body), { label: isNew ? 'Use data' : 'Apply', primary: true, act: () => {
      const map = {}; for (const c of D.columns) if (sels[c].value !== c) map[c] = sels[c].value;
      if (isNew) { D.map = map; D.qtyCol = qty.value; } else editDoc((d) => { d.data.map = map; d.data.qtyCol = qty.value; }, 'Map columns');
    } }] }));
}
