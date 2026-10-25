// Full backup and restore for the business apps, through SlopData.exporter: one file with every record in the shared
// business data. A restore is validated as a whole first, so a bad file changes nothing and its errors are listed.
// SlopBiz.backup.mount({ done? }) wires the Data view's #dBackup button, #dRestore button (a backup file comes in one way:
// the intake's part 'biz.backup', shared/intake) and #dRestoreMsg list, and
// returns { backup, restore }; done() runs after a restore (an app redraws). attach(ns) makes an app's Data view of it.
// Classic script, loaded after biz.js.
(function (g) {
  'use strict';
  const B = (g.SlopBiz = g.SlopBiz || {});
  const $ = (id) => document.getElementById(id);

  /** Downloads every record as one backup file. */
  async function backup() {
    const S = g.SlopData, UI = g.SlopUI;
    const r = await S.exporter.exportFile();
    if (!r.ok) { UI.alert('Backup failed', B.refusal(r)); return false; }
    UI.download(r.value.blob, r.value.name);
    UI.toast('Backup downloaded');
    return true;
  }

  /** Restores a backup file after asking. A bad file changes nothing and its errors are listed. Resolves true when restored. */
  async function restore(file) {
    const S = g.SlopData, UI = g.SlopUI, h = B.h, out = $('dRestoreMsg');
    out.replaceChildren();
    if (!file) return false;
    const yes = await UI.confirm('Restore this backup?',
      'This replaces every record in this browser with the contents of the file: customers, quotes, orders, invoices, payments, credit notes, expenses, stock and the ledger. Download a backup first if you are not sure.',
      'Restore', { danger: true });
    if (!yes) return false;
    const r = await S.exporter.importBundle(await file.text());
    if (!r.ok) {
      const errs = (r.errors || [r.message]).slice(0, 20);
      out.append(h('li', { class: 'rep-error', text: 'The file was not restored. Nothing changed.' }), ...errs.map((e) => h('li', { class: 'rep-error', text: String(e) })));
      return false;
    }
    out.append(h('li', { class: 'rep-ok', text: 'Restored. Every record now matches the file.' }));
    UI.toast('Backup restored');
    return true;
  }

  function mount(opts = {}) {
    const SI = g.SlopIntake;
    SI.register({ id: 'biz.backup', main: false, paste: false, toast: false, limit: 1, accept: { types: ['application/json'], exts: ['.json'], noun: 'a backup file (.json)' },
      process: async (file) => { if ((await restore(file)) && opts.done) opts.done(); return file.name; } });
    $('dBackup').addEventListener('click', backup);
    $('dRestore').addEventListener('click', () => SI.pick({ to: 'biz.backup', multiple: false, accept: 'application/json,.json' }));
    return { backup, restore };
  }

  /** The Data view of an app: ns.views.data mounts the backup controls, and ns.dataActions gives the commands backup and
   *  restore. The document apps get it through SlopDocs.docApp. */
  function attach(ns, opts) {
    ns.dataActions = { backup, restore };
    ns.views = ns.views || {};
    ns.views.data = { mount: () => mount(opts), refresh: () => {}, onShow: () => {} };
  }

  B.backup = { mount, attach, backup, restore };
})(typeof window !== 'undefined' ? window : globalThis);
