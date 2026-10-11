// The Data tab: record counts per collection, the full backup download, a validated restore (the whole file is
// checked before anything is written; a bad file changes nothing), and the reset (typed word RESET; the backup is
// offered as a download before anything is erased).
(function (g) {
  'use strict';
  const NS = (g.SlopAdmin = g.SlopAdmin || {});
  const UI = g.SlopUI;
  const el = UI.el;
  const $ = (id) => document.getElementById(id);

  async function render() {
    const r = await NS.overview.counts();
    if (!r.ok) { $('dCounts').replaceChildren(el('tr', null, el('td', { colspan: 3, class: 'msg' }, NS.util.refusal(r)))); return; }
    $('dCounts').replaceChildren(...Object.entries(r.value).map(([name, c]) => el('tr', { 'data-collection': name },
      el('td', null, name), el('td', { class: 'num' }, String(c.live)), el('td', { class: 'num' }, String(c.deleted)))));
  }

  async function backup() {
    const f = await NS.restore.exportFile();
    if (!f.ok) { UI.toast(NS.util.refusal(f)); return; }
    UI.download(f.value.blob, f.value.name);
    UI.toast('Backup downloaded');
  }

  /** Reads the chosen file, checks it whole, then asks before replacing everything. */
  async function restoreFrom(file) {
    const msg = $('dRestoreMsg');
    msg.textContent = '';
    if (!file) return;
    const text = await file.text();
    const c = NS.restore.check(text);
    if (!c.ok) { msg.textContent = c.message; return; }
    const total = Object.values(c.value.counts).reduce((a, b) => a + b, 0);
    UI.confirm('Replace all data with this backup?', `The backup holds ${total} records${c.value.exportedAt ? ` (exported ${c.value.exportedAt.slice(0, 10)})` : ''}. Every record in this browser is replaced by them.`,
      'Restore', { danger: true }).then(async (yes) => {
      if (!yes) return;
      const r = await NS.restore.restore(text);
      msg.textContent = r.ok ? `Restored ${total} records.` : r.message;
      if (r.ok) UI.toast('Backup restored');
    });
  }

  /** The reset dialog: type RESET, and the full backup downloads before anything is erased. */
  function reset() {
    const input = el('input', { type: 'text', autocomplete: 'off', 'aria-label': 'Type RESET to confirm', placeholder: 'RESET', id: 'rInput' });
    const msg = el('p', { class: 'msg', role: 'alert' });
    UI.dialog({
      title: 'Reset all data', cls: 'danger-dlg',
      body: el('div', null, el('p', { class: 'sui-p' }, 'This erases every record in this browser: customers, products, orders, invoices, payments, the ledger and settings. A full backup downloads first.'),
        UI.field('Type RESET in capitals to confirm', input), msg),
      buttons: [{ label: 'Cancel' }, { label: 'Export backup and reset', primary: true, danger: true, act: async () => {
        if (input.value.trim() !== 'RESET') { msg.textContent = 'Type RESET (in capitals) to confirm. Nothing was erased.'; return false; }
        const r = await NS.overview.exportAndReset((blob, name) => UI.download(blob, name));
        if (!r.ok) { msg.textContent = `Not erased. ${NS.util.refusal(r)}`; return false; }
        UI.toast('Everything was reset. The backup was downloaded first.');
        await NS.app.render();
        return true;
      } }],
    });
    setTimeout(() => input.focus(), 30);
  }

  function mount() {
    $('dBackup').addEventListener('click', backup);
    $('dRestore').addEventListener('change', (e) => { restoreFrom(e.target.files && e.target.files[0]); e.target.value = ''; });
    $('dReset').addEventListener('click', reset);
  }

  NS.views = NS.views || {};
  NS.views.data = { mount, render, reset, restoreFrom };
})(typeof window !== 'undefined' ? window : globalThis);
