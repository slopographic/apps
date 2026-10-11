// Import from Slop Contacts: pick the saved list in Slop Drive, see the plan (new, already linked, cannot be stored),
// then import. Linked contacts are skipped, so a second import adds nothing that is already here.
(function (g) {
  'use strict';
  const NS = (g.SlopCrm = g.SlopCrm || {});
  const UI = g.SlopUI;
  const el = UI.el;
  const SC_INFO = SlopExamples.info('crm');

  /** The plan for the list the person picked: reads the file and checks it against the customers. */
  async function planFor(rec) {
    const parsed = await NS.contactsImport.readList(rec.blob);
    if (!parsed.ok) return parsed;
    const linked = await NS.customers.linkedContactIds();
    if (!linked.ok) return linked;
    return { ok: true, value: NS.contactsImport.plan(parsed.value, linked.value) };
  }

  /** Opens the import dialog, or says that there is no saved list yet. */
  async function open() {
    const lists = await NS.contactsImport.findLists();
    if (!lists.length) {
      UI.dialog({ title: 'Import from Slop Contacts', body: 'No saved Contacts list was found in Slop Drive. Save your contacts in Slop Contacts first, then come back here.',
        buttons: [{ label: 'OK', primary: true }] });
      return;
    }
    const sel = UI.select(lists.map((f, i) => [i, f.name]), 0);
    const info = el('p', { class: 'note', role: 'status' });
    let plan = null;
    const show = async () => {
      const p = await planFor(lists[Number(sel.value)]);
      plan = p.ok ? p.value : null;
      info.textContent = p.ok
        ? `${plan.add.length} new customer${plan.add.length === 1 ? '' : 's'}, ${plan.skipped} already linked or without an id, ${plan.invalid} that cannot be stored.`
        : NS.util.refusal(p);
    };
    sel.addEventListener('change', show);
    UI.dialog({
      title: 'Import from Slop Contacts',
      body: el('div', null, UI.field('Saved list', sel), info,
        el('p', { class: 'note' }, 'Each contact becomes a lead. Contacts already linked to a customer are skipped.'),
        el('p', { class: 'note' }, SC_INFO.note),
        el('button', { type: 'button', class: 'sui-btn', onclick: () => SlopExamples.download('crm') }, 'Download example CSV')),
      buttons: [
        { label: 'Cancel' },
        { label: 'Import', primary: true, act: async () => {
          if (!plan || !plan.add.length) { UI.toast('Nothing new to import.'); return false; }
          const r = await NS.contactsImport.apply(plan);
          if (!r.ok) { UI.toast(NS.util.refusal(r)); return false; }
          UI.toast(`Imported ${r.value} customer${r.value === 1 ? '' : 's'}`);
          return true;
        } },
      ],
    });
    show();
  }

  NS.importUi = { open };
})(typeof window !== 'undefined' ? window : globalThis);
