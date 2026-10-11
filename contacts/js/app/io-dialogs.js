/* Slop Contacts: import and export. Import reads vCard, CSV and .scontacts files and adds each contact as a customer
 * (a new id each time; exact duplicates merge at once). Export writes vCard 3.0, one vCard per contact, Google or
 * Outlook CSV, or .scontacts, for the selection when there is one, otherwise for every contact. Adds SlopContacts.io. */
(function () {
  'use strict';
  const SC = window.SlopContacts;
  const S = SC.state;
  const UI = window.SlopUI;
  const el = UI.el;
  const ACCEPT = '.vcf,.vcard,.csv,.tsv,.txt,.scontacts,text/vcard,text/csv,application/json';
  const EXPORTS = [
    ['vcf', 'vCard 3.0 (.vcf), for iOS and Android'], ['zip', 'One vCard per contact (.zip)'],
    ['google', 'Google Contacts CSV'], ['outlook', 'Outlook CSV'], ['scontacts', 'Slop Contacts list (.scontacts)'],
  ];

  /** Parses one file's text. Returns { contacts, kind } where kind names the format for the report. */
  function parseText(text, name) {
    if (/\.scontacts$/i.test(name) || /^\s*\{/.test(text)) return { contacts: SC.format.fromScontacts(text), kind: '.scontacts' };
    if (/BEGIN:VCARD/i.test(text)) return { contacts: SC.vcard.read(text), kind: 'vCard' };
    const r = SC.csv.read(text);
    return { contacts: r.contacts, kind: r.variant === 'none' ? 'CSV' : `${r.variant} CSV` };
  }

  /** Reads the chosen files and adds their contacts to the customers. */
  async function importFiles(files) {
    let incoming = [];
    const errors = [];
    for (const f of files) {
      try { incoming = incoming.concat(parseText(await f.text(), f.name).contacts); } catch (e) { errors.push(`${f.name}: ${e.message}`); }
    }
    if (!incoming.length) { UI.alert('Nothing to import', errors.join(' ') || 'No contacts were found in those files.'); return 0; }
    const fresh = incoming.map((c) => ({ ...c, id: SC.records.newId() }));
    S.setList([...S.list, ...fresh]);
    const r = SC.dedupe.autoMergeExact(S.list, S.cc);
    if (r.merged) S.setList(r.list);
    UI.toast(`Imported ${fresh.length} contact${fresh.length === 1 ? '' : 's'}${r.merged ? `, ${r.merged} exact duplicate${r.merged === 1 ? '' : 's'} merged` : ''}`);
    return fresh.length;
  }

  /** The file picker (several files at once). */
  function importPick() {
    const ex = SlopExamples.info('contacts');
    // A drop zone in the dialog (SlopDrop, shared/drop): each dropped file is imported as Choose files does.
    const zone = document.createElement('div');
    const parts = [el('p', { class: 'sui-p' }, 'vCard, CSV (Google or Outlook layout) or .scontacts. Each contact is added; exact duplicates merge.'),
      el('p', { class: 'sui-p' }, ex.note), el('p', { class: 'sui-p' }, 'Columns: ' + ex.columns.join(', ') + '.'),
      el('button', { type: 'button', class: 'sui-btn', onclick: () => SlopExamples.download('contacts') }, 'Download example CSV')];
    if (window.SlopDrop) parts.push(zone);
    UI.dialog({ title: 'Import contacts', body: el('div', null, ...parts),
    buttons: [{ label: 'Cancel' }, { label: 'Choose files…', primary: true, act: async () => {
      const files = await UI.pickFiles({ accept: ACCEPT, multiple: true });
      if (files && files.length) await importFiles(files);
    } }] });
    if (window.SlopDrop) window.SlopDrop.attach(zone, {
      accept: { types: ['text/*', 'application/json', 'application/vnd.ms-excel'], exts: ['.vcf', '.vcard', '.csv', '.tsv', '.txt', '.scontacts'], noun: 'a contact file (vCard, CSV or .scontacts)' },
      compact: true, window: false, overlay: false, toast: false,
      process: async (file) => {
        if (!(await importFiles([file]))) throw new Error('has no contacts');
        return file.name;
      },
    });
  }

  /** Downloads one export for a scope: a set of ids, or null for every contact. */
  function exportAs(id, scopeIds) {
    const list = scopeIds ? S.list.filter((c) => scopeIds.has(c.id)) : S.list;
    if (!list.length) { UI.toast('Nothing to export'); return false; }
    if (id === 'scontacts') {
      UI.download(new Blob([SC.format.toScontacts(list, { cc: S.cc })], { type: SC.format.MIME }), `Contacts.${SC.format.EXT}`);
    } else {
      const r = SC.format.exportAs(id, list, 'Contacts');
      UI.download(r.blob, r.name);
    }
    UI.toast(`Exported ${list.length} contact${list.length === 1 ? '' : 's'}`);
    return true;
  }

  /** The export dialog: format and scope (the selection, when there is one). */
  function exportDialog() {
    if (!S.list.length) { UI.toast('No contacts to export'); return; }
    const hasSel = S.sel.size > 0;
    const format = UI.select(EXPORTS, 'vcf');
    let scope = hasSel ? 'sel' : 'all';
    const radio = (value, label) => {
      const r = el('input', { type: 'radio', name: 'export-scope', value, checked: scope === value });
      r.addEventListener('change', () => { if (r.checked) scope = value; });
      return el('label', { class: 'sui-check' }, r, el('span', null, label));
    };
    const body = el('div', null, UI.field('Format', format),
      el('div', { class: 'ed-scope' }, hasSel ? radio('sel', `Selected (${S.sel.size})`) : null, radio('all', `All (${S.list.length})`)));
    UI.dialog({ title: 'Export contacts', body, buttons: [{ label: 'Cancel' }, { label: 'Export', primary: true, act: () => {
      exportAs(format.value, scope === 'sel' ? new Set(S.sel) : null);
      return undefined;
    } }] });
  }

  SC.io = { parseText, importFiles, importPick, exportAs, exportDialog };
})();
