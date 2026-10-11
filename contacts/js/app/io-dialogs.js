/* Slop Contacts: import and export dialogs. Import (the toolbar, the palette, the list's drop target, or a .scontacts
 * handed over from Slop Drive) goes through importFlow: CSV column mapping, then the preview (import-flow.js). Export
 * writes vCard 3.0 or 4.0 (one file or one per contact), CSV, XLSX (the shared writer, shared/sheets/write.js), Google
 * or Outlook CSV, or .scontacts, for the selection when there is one, otherwise every contact. Adds SlopContacts.io. */
(function () {
  'use strict';
  const SC = window.SlopContacts;
  const S = SC.state;
  const UI = window.SlopUI;
  const el = UI.el;
  const ACCEPT = '.vcf,.vcard,.csv,.tsv,.txt,.scontacts,text/vcard,text/csv,application/json';
  const EXPORTS = [
    ['vcf', 'vCard 3.0 (.vcf), one file for iOS and Android'], ['vcf40', 'vCard 4.0 (.vcf), one file'],
    ['zip', 'vCard 3.0, one file per contact (.zip)'], ['zip40', 'vCard 4.0, one file per contact (.zip)'],
    ['csv', 'CSV (.csv), one column per e-mail and phone'], ['xlsx', 'Excel workbook (.xlsx)'],
    ['google', 'Google Contacts CSV'], ['outlook', 'Outlook CSV'], ['scontacts', 'Slop Contacts list (.scontacts)'],
  ];

  /** Imports files: the flow reads them, maps CSV columns and shows the preview. Resolves with true when imported. */
  function importFiles(files) { return SC.importFlow.run(files); }

  /** The file picker (several files at once). */
  function importPick() {
    const ex = SlopExamples.info('contacts');
    UI.dialog({ title: 'Import contacts', body: el('div', null,
      el('p', { class: 'sui-p' }, 'vCard (.vcf, .vcard), CSV (any column layout) or .scontacts. You see what will be added, with duplicates flagged, before anything changes.'),
      el('p', { class: 'sui-p' }, 'You can also drop these files on the contact list.'),
      el('p', { class: 'sui-p' }, ex.note), el('p', { class: 'sui-p' }, 'Columns: ' + ex.columns.join(', ') + '.'),
      el('button', { type: 'button', class: 'sui-btn', onclick: () => SlopExamples.download('contacts') }, 'Download example CSV')),
    buttons: [{ label: 'Cancel' }, { label: 'Choose files…', primary: true, act: async () => {
      const files = await UI.pickFiles({ accept: ACCEPT, multiple: true });
      if (files && files.length) await importFiles(files);
    } }] });
  }

  /** The .xlsx file from the shared XLSX writer (loaded on first use, from the page's shared folder). */
  async function xlsxFile(list) {
    const mod = await import(new URL('../shared/sheets/write.js', document.baseURI).href);
    const blob = await mod.toXlsxBlob([SC.csv.sheetOf(list, 'Contacts')]);
    return { blob, name: 'Contacts.xlsx' };
  }

  /** Downloads one export for a scope: a set of ids, or null for every contact. */
  async function exportAs(id, scopeIds) {
    const list = scopeIds ? S.list.filter((c) => scopeIds.has(c.id)) : S.list;
    if (!list.length) { UI.toast('Nothing to export'); return false; }
    if (id === 'scontacts') {
      UI.download(new Blob([SC.format.toScontacts(list, { cc: S.cc })], { type: SC.format.MIME }), `Contacts.${SC.format.EXT}`);
    } else if (id === 'xlsx') {
      const r = await xlsxFile(list);
      UI.download(r.blob, r.name);
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
      exportAs(format.value, scope === 'sel' ? new Set(S.sel) : null).catch((e) => UI.toast(`Export failed: ${e.message}`));
      return undefined;
    } }] });
  }

  SC.io = { importFiles, importPick, exportAs, exportDialog };
})();
