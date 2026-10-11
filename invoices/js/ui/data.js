// Backup and restore through SlopData.exporter. A restore is validated as a whole first: a bad file changes nothing.
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopInvoices = g.SlopInvoices || {});
  const U = NS.util;
  const UI = g.SlopUI;
  const $ = (id) => document.getElementById(id);
  const h = U.h;

  /** Downloads every record as one backup file. */
  async function backup() {
    const r = await S.exporter.exportFile();
    if (!r.ok) { UI.alert('Backup failed', U.refusal(r)); return; }
    UI.download(r.value.blob, r.value.name);
    UI.toast('Backup downloaded');
  }

  /** Restores a backup file. A bad file changes nothing and its errors are listed. */
  async function restore(file) {
    const out = $('dRestoreMsg');
    out.replaceChildren();
    if (!file) return;
    const yes = await UI.confirm('Restore this backup?',
      'This replaces every record in this browser with the contents of the file: customers, orders, invoices, payments, stock and the ledger. Download a backup first if you are not sure.',
      'Restore', { danger: true });
    if (!yes) { $('dRestore').value = ''; return; }
    const r = await S.exporter.importBundle(await file.text());
    if (!r.ok) {
      const errs = (r.errors || [r.message]).slice(0, 20);
      out.append(h('li', { class: 'rep-error', text: 'The file was not restored. Nothing changed.' }), ...errs.map((e) => h('li', { class: 'rep-error', text: String(e) })));
      return;
    }
    out.append(h('li', { class: 'rep-ok', text: 'Restored. Every record now matches the file.' }));
    UI.toast('Backup restored');
  }

  function mount() {
    $('dBackup').addEventListener('click', backup);
    $('dRestore').addEventListener('change', (e) => restore(e.target.files && e.target.files[0]));
  }

  NS.dataActions = { backup, restore };
  NS.views = NS.views || {};
  NS.views.data = { mount, refresh: () => {}, onShow: () => {} };
})(typeof window !== 'undefined' ? window : globalThis);
