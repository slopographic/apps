// Data actions: import products from CSV (preview and validation report, then all or nothing), export the product
// list, download a full backup, and restore a backup through the validated import.
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopInv = g.SlopInv || {});
  const U = NS.util;
  const UI = g.SlopUI;
  const { h } = U;
  const $ = (id) => document.getElementById(id);
  const stamp = () => new Date().toISOString().slice(0, 10);

  /** Plain sentence for one row of the report. */
  function rowText(l) {
    if (l.action === 'error') return l.errors.map((e) => `${e.field === 'sku' ? 'SKU' : e.field} ${e.message}`).join('; ');
    return l.action === 'new' ? 'New product' : 'Updates the product with this SKU';
  }

  /** Dialog: pick a CSV, see the plan, import only when it is clean. */
  function openImport() {
    const report = h('div', { class: 'report-box', 'aria-live': 'polite' });
    const file = h('input', { type: 'file', accept: '.csv,text/csv', 'aria-label': 'Products CSV file' });
    let plan = null;
    const apply = async () => {
      if (!plan || !plan.ok) return false;
      const r = await NS.importer.applyImport(plan);
      if (!r.ok) { report.append(h('p', { class: 'form-error', text: U.refusal(r) })); return false; }
      UI.toast(`Imported ${U.plural(r.value, 'product')}`);
      NS.app.refresh();
      return true;
    };
    file.addEventListener('change', async () => {
      const f = file.files && file.files[0];
      if (!f) return;
      const text = await f.text();
      const cur = await S.store.list('products');
      const st = await U.settings();
      plan = NS.importer.planImport(text, cur.ok ? cur.value : [], st);
      report.replaceChildren(...planView(plan, f.name));
    });
    UI.dialog({
      title: 'Import products from CSV',
      cls: 'wide',
      body: h('div', { class: 'import' },
        h('p', { class: 'note', text: 'Columns: SKU, EAN, Name, Price, Reorder level. Other columns are ignored. Nothing is saved until the whole file is valid.' }),
        h('p', { class: 'note', text: SlopExamples.info('inventory').note }),
        h('button', { type: 'button', class: 'btn', text: 'Download example CSV', onclick: () => SlopExamples.download('inventory') }),
        file, report),
      buttons: [{ label: 'Cancel' }, { label: 'Import all', primary: true, act: apply }],
    });
  }

  /** The preview: counts, a line for each row, and the errors with their line numbers. */
  function planView(plan, name) {
    const head = h('p', { class: plan.ok ? 'ok-line' : 'form-error', text: plan.ok
      ? `${name}: ${plan.newCount} new, ${plan.updateCount} to update. Ready to import.`
      : `${name}: ${plan.badRows || 0} row${plan.badRows === 1 ? '' : 's'} with problems. Nothing will be imported until they are fixed.` });
    const out = [head];
    for (const m of plan.headerErrors) out.push(h('p', { class: 'form-error', text: `Header: ${m}` }));
    if (plan.lines.length) {
      out.push(h('ul', { class: 'report' }, plan.lines.slice(0, 300).map((l) => h('li', { class: `rep-${l.action}` },
        h('b', { text: `Line ${l.line}  ${l.sku || '(no SKU)'}` }), ` ${l.name || ''} — `, h('span', { text: rowText(l) })))));
      if (plan.lines.length > 300) out.push(h('p', { class: 'note', text: `Showing the first 300 of ${plan.lines.length} rows.` }));
    }
    return out;
  }

  /** Downloads the product list (with on hand) as CSV. */
  async function exportCsv() {
    const r = await NS.rows.stockRows();
    if (!r.ok) { UI.alert('Export failed', U.refusal(r)); return; }
    const st = await U.settings();
    const text = NS.csv.build(NS.importer.exportRows(r.value, st));
    UI.download(new Blob([text], { type: 'text/csv' }), `slop-inventory-products-${stamp()}.csv`);
    UI.toast(`Exported ${U.plural(r.value.length, 'product')}`);
  }

  /** Downloads every record as one backup file. */
  async function backup() {
    const r = await S.exporter.exportFile();
    if (!r.ok) { UI.alert('Backup failed', U.refusal(r)); return; }
    UI.download(r.value.blob, r.value.name);
    UI.toast('Backup downloaded');
  }

  /** Restores a backup file through the validated import. A bad file changes nothing and lists its errors. */
  async function restore(file) {
    const out = $('dRestoreMsg');
    out.replaceChildren();
    if (!file) return;
    const yes = await UI.confirm('Restore this backup?',
      'This replaces every record in this browser with the contents of the file, including customers and invoices. Download a backup first if you are not sure.',
      'Restore', { danger: true });
    if (!yes) { $('dRestore').value = ''; return; }
    const text = await file.text();
    const r = await S.exporter.importBundle(text);
    if (!r.ok) {
      const errs = (r.errors || [r.message]).slice(0, 20);
      out.append(h('li', { class: 'rep-error', text: 'The file was not restored. Nothing changed.' }), ...errs.map((e) => h('li', { class: 'rep-error', text: String(e) })));
      return;
    }
    out.append(h('li', { class: 'rep-ok', text: 'Restored. Every record now matches the file.' }));
    UI.toast('Backup restored');
    NS.app.refresh();
  }

  function mount() {
    $('dImport').addEventListener('click', openImport);
    $('dExport').addEventListener('click', exportCsv);
    $('dBackup').addEventListener('click', backup);
    $('dRestore').addEventListener('change', (e) => restore(e.target.files && e.target.files[0]));
  }

  NS.dataActions = { openImport, exportCsv, backup, restore };
  NS.views = NS.views || {};
  NS.views.data = { mount, refresh: () => {}, onShow: () => {} };
})(typeof window !== 'undefined' ? window : globalThis);
