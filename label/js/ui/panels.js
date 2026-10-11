/* SlopLabel — ui/panels: the dock (Properties, Objects, Variables, Data tabs). */
'use strict';

const DOCK_TABS = [['props', 'Properties'], ['objects', 'Objects'], ['vars', 'Variables'], ['data', 'Data']];
const TYPE_ICON = { text: 'T', para: '¶', barcode: '║', image: '▣', rect: '□', ellipse: '○', line: '／', inverse: '◩' };
function renderPanels(opts = {}) {
  const tabs = $('dockTabs'), body = $('dockBody'), d = App.doc;
  const counts = { objects: d.objects.length, vars: d.vars.length, data: recordCount(d) };
  tabs.replaceChildren(...DOCK_TABS.map(([id, label]) => {
    const b = mk('button', { type: 'button', class: 'tab' + (App.tab === id ? ' on' : ''), role: 'tab', 'aria-selected': String(App.tab === id), 'data-tab': id }, label, counts[id] ? mk('span', { class: 'count' }, counts[id]) : null);
    b.addEventListener('click', () => { App.tab = id; renderPanels(); });
    return b;
  }));
  if (opts.keepProps && App.tab === 'props') { syncGeomFields(); return; }
  const scroll = body.scrollTop, keep = body.dataset.tab === App.tab;
  body.replaceChildren();
  body.dataset.tab = App.tab;
  if (App.tab === 'props') renderProps(body);
  else if (App.tab === 'objects') renderObjects(body);
  else if (App.tab === 'vars') renderVars(body);
  else renderData(body);
  if (keep) body.scrollTop = scroll;
}

/* ---------------- objects ---------------- */
function objSummary(o) {
  if (o.type === 'text' || o.type === 'para' || o.type === 'barcode') return (o.type === 'barcode' ? (SYM[o.symbology] || {}).name + ': ' : '') + String(o.content || '').replace(/\s+/g, ' ').slice(0, 60);
  return fmtLen(o.w, U(), App.doc.dpi, false) + ' × ' + fmtLen(o.h, U(), App.doc.dpi);
}
function renderObjects(body) {
  const d = App.doc;
  if (!d.objects.length) { body.append(mk('p', { class: 'empty' }, 'No objects yet. Pick a tool and click on the label.')); return; }
  const list = mk('div', { class: 'list', role: 'listbox', 'aria-label': 'Objects, front to back' });
  for (const o of d.objects.slice().reverse()) {
    const act = (lbl, t, f) => { const b = mk('button', { type: 'button', title: t, 'aria-label': t }, lbl); b.addEventListener('click', (e) => { e.stopPropagation(); f(); }); return b; };
    const row = mk('div', { class: 'li' + (App.sel.includes(o.id) ? ' on' : '') + (o.hidden ? ' hiddenobj' : ''), role: 'option', 'aria-selected': String(App.sel.includes(o.id)), tabindex: '0' },
      mk('span', { class: 'ic' }, TYPE_ICON[o.type] || '?'),
      mk('span', { class: 'nm' }, o.name || TYPE_NAMES[o.type], o.group ? ' ⛓' : '', mk('span', { class: 'sub' }, objSummary(o))),
      mk('span', { class: 'acts' },
        act(o.hidden ? '◌' : '◉', o.hidden ? 'Show' : 'Hide', () => { o.hidden = !o.hidden; commit(o.hidden ? 'Hide' : 'Show'); }),
        act(o.locked ? '🔒' : '🔓', o.locked ? 'Unlock' : 'Lock', () => { o.locked = !o.locked; commit(o.locked ? 'Lock' : 'Unlock'); })));
    row.addEventListener('click', (e) => select([o.id], e.shiftKey || e.ctrlKey || e.metaKey));
    row.addEventListener('dblclick', () => { select([o.id]); focusContent(); });
    row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select([o.id]); } });
    row.addEventListener('contextmenu', (e) => { e.preventDefault(); if (!App.sel.includes(o.id)) select([o.id]); SlopUI.menu(contextItems(), e.clientX, e.clientY); });
    list.append(row);
  }
  body.append(list, App.sel.length ? arrangeSection(App.sel.length === 1) : mk('p', { class: 'hint' }, 'Top of the list prints on top. Shift-click to select several.'));
}

/* ---------------- variables ---------------- */
function varSummary(v) {
  switch (v.type) {
    case 'prompt': return 'Asked at print' + (v.required ? ' · required' : '');
    case 'counter': return `Counter from ${v.prefix || ''}${String(v.start).padStart(v.pad || 0, '0')}${v.suffix || ''}, step ${v.step}` + (v.remember ? ' · remembers' : '');
    case 'date': return 'Date ' + v.format + (+v.days ? ` · ${+v.days > 0 ? '+' : ''}${v.days} days` : '') + (+v.months ? ` · ${+v.months > 0 ? '+' : ''}${v.months} months` : '');
    case 'formula': return '= ' + v.expr;
    default: return 'Fixed';
  }
}
function renderVars(body) {
  const d = App.doc, get = previewGet();
  const add = fBtn('+ Add variable', (e) => { const r = e.currentTarget.getBoundingClientRect(); SlopUI.menu(Object.entries(VAR_TYPES).map(([t, l]) => ({ label: l, act: () => varDialog(null, t) })), r.left, r.bottom + 2); }, { cls: 'small' });
  body.append(mk('div', { class: 'sec-h' }, mk('span', null, 'Variables'), mk('span', { class: 'grow' }), add));
  if (!d.vars.length) body.append(mk('p', { class: 'empty' }, 'Variables fill in text and barcodes at print time: prompts, serial counters, dates and formulas. Use them as {Name}.'));
  const list = mk('div', { class: 'list' });
  for (const v of d.vars) {
    const row = mk('div', { class: 'li', tabindex: '0' }, mk('span', { class: 'ic' }, { prompt: '?', counter: '#', date: '◷', formula: 'ƒ', fixed: '=' }[v.type]),
      mk('span', { class: 'nm' }, '{' + v.name + '}', mk('span', { class: 'sub' }, varSummary(v) + ' → ' + String(get(v.name) || '').slice(0, 40))),
      mk('span', { class: 'acts' }, (() => { const b = mk('button', { type: 'button', title: 'Delete variable', 'aria-label': 'Delete variable' }, '✕'); b.addEventListener('click', (e) => { e.stopPropagation(); deleteVar(v); }); return b; })()));
    row.addEventListener('click', () => varDialog(v));
    row.addEventListener('keydown', (e) => { if (e.key === 'Enter') varDialog(v); });
    list.append(row);
  }
  body.append(list);
  const prompts = d.vars.filter((v) => v.type === 'prompt');
  if (prompts.length) {
    body.append(mk('div', { class: 'sec-h' }, mk('span', null, 'Preview values')));
    for (const v of prompts) body.append(fRow(v.name, fText(App.prompts[v.name] != null ? App.prompts[v.name] : v.def, (x) => { App.prompts[v.name] = x; refresh({ keepProps: true }); }, { placeholder: v.prompt })));
    body.append(mk('p', { class: 'hint' }, 'These values only change the preview. You are asked for them when you print.'));
  }
  const f = fieldNames();
  body.append(mk('div', { class: 'sec-h' }, mk('span', null, 'Other fields')), mk('p', { class: 'hint' },
    (f.data.length ? 'Data: ' + f.data.map((n) => '{' + n + '}').join(' ') + '. ' : '') + 'System: {LABEL_NO} {RECORD_NO} {TODAY} {NOW}. Filters: {Name|upper}, {Price|fixed:2}, {Code|pad:8}, {Date|date:DD.MM.YY}, {Body|gs1check}.'));
}
function deleteVar(v) {
  const used = App.doc.objects.some((o) => varRefs(o.content).includes(v.name));
  const go = () => editDoc((d) => { d.vars = d.vars.filter((x) => x.id !== v.id); }, 'Delete variable');
  if (!used) return go();
  SlopUI.confirm('Delete variable?', `{${v.name}} is used on the label. Deleting it leaves the placeholder text in place.`, 'Delete', { danger: true }).then((ok) => ok && go());
}

/* ---------------- data ---------------- */
function renderData(body) {
  const d = App.doc, D = d.data;
  const btns = mk('div', { class: 'btnrow' }, fBtn('Import CSV / Excel…', () => importDataDialog()), fBtn('Paste data…', () => pasteDataDialog()), hubAvailable() ? fBtn('From Slop Drive…', () => dataFromDrive()) : null);
  if (!D) {
    body.append(fSec('Data source', btns, mk('p', { class: 'hint' }, 'Merge a spreadsheet: every row prints one label. Columns become {Fields}; a column with the same name as a prompt variable fills it. CSV, TSV, JSON and Excel .xlsx are read here in the browser.')));
    return;
  }
  const n = D.rows.length;
  body.append(fSec('Data source',
    mk('p', { class: 'hint' }, `${D.name} · ${n} record${n === 1 ? '' : 's'} · ${D.columns.length} columns`),
    mk('div', { class: 'btnrow' }, fBtn('Map columns…', () => mapColumnsDialog(D)), fBtn('Replace…', () => importDataDialog()), fBtn('Remove', () => editDoc((x) => { x.data = null; }, 'Remove data'), { cls: 'danger' })),
    fRow('Quantity from', fSel([['', '(1 label per record)'], ...D.columns.map((c) => [c, c])], D.qtyCol || '', (v) => editDoc((x) => { x.data.qtyCol = v; }, 'Quantity column')))));
  const wrap = mk('div', { class: 'tbl-wrap' }), tbl = mk('table', { class: 'tbl' }), max = Math.min(n, 300);
  tbl.append(mk('thead', null, mk('tr', null, mk('th', null, '#'), D.columns.map((c) => mk('th', { title: (D.map && D.map[c] && D.map[c] !== c) ? '→ {' + D.map[c] + '}' : c }, c + (D.map && D.map[c] && D.map[c] !== c ? ' → ' + D.map[c] : ''))))));
  const tb = mk('tbody');
  for (let i = 0; i < max; i++) {
    const tr = mk('tr', { class: i === App.rec ? 'on' : '' }, mk('td', null, i + 1), D.rows[i].map((v) => mk('td', { title: v }, v)));
    tr.addEventListener('click', () => setRecord(i));
    tb.append(tr);
  }
  tbl.append(tb); wrap.append(tbl);
  body.append(wrap, n > max ? mk('p', { class: 'hint' }, `Showing the first ${max} of ${n} records.`) : null, mk('p', { class: 'hint' }, 'Click a row to preview it on the label (PageUp / PageDown step through records).'));
}
