/* Slop Contacts: import (.vcf, .vcard, CSV, .scontacts merged into the list) and export (each format downloads
 * and is saved to Slop Drive). Imported exact duplicates merge automatically. Adds SlopContacts.io. */
(function () {
  'use strict';
  const SC = window.SlopContacts;
  const S = SC.state;
  const UI = window.SlopUI;
  const el = UI.el;
  const hub = () => window.SlopHub || null;
  const ACCEPT = '.vcf,.vcard,.csv,.tsv,.txt,.scontacts,text/vcard,text/csv,application/json';

  /** Give incoming contacts ids that do not clash with the list (a VCF UID can repeat across files). */
  function freshIds(incoming) {
    const ids = new Set(S.list.map((c) => c.id));
    return incoming.map((c) => {
      const x = ids.has(c.id) ? { ...c, id: SC.model.uid() } : c;
      ids.add(x.id);
      return x;
    });
  }
  /** Parse one file's text. Returns { contacts, kind } where kind names the format for the report. */
  function parseText(text, name) {
    if (/\.scontacts$/i.test(name) || /^\s*\{/.test(text)) return { contacts: SC.format.fromScontacts(text), kind: '.scontacts' };
    if (/BEGIN:VCARD/i.test(text)) {
      const contacts = SC.vcard.read(text);
      return { contacts, kind: 'vCard' };
    }
    const r = SC.csv.read(text);
    return { contacts: r.contacts, kind: (r.variant === 'none' ? 'CSV' : r.variant + ' CSV') };
  }

  /** Merge contacts into the list, then merge any exact duplicates. Returns a summary. */
  function addAndMerge(incoming, cc = S.cc) {
    const before = S.list.length;
    const added = freshIds(incoming);
    S.setList([...S.list, ...added]);
    const r = SC.dedupe.autoMergeExact(S.list, cc);
    if (r.merged) S.setList(r.list);
    return { added: added.length, merged: r.merged, removed: r.removed, total: S.list.length, before };
  }

  /** Read picked files and merge them. Reports what came in. */
  async function importFiles(files) {
    const notes = [];
    let added = 0, merged = 0, failed = 0;
    for (const f of files) {
      try {
        const text = await f.text();
        const p = parseText(text, f.name || '');
        if (!p.contacts.length) { notes.push(`${f.name}: no contacts found`); continue; }
        const s = addAndMerge(p.contacts);
        added += s.added; merged += s.merged;
        notes.push(`${f.name}: ${p.contacts.length} from ${p.kind}`);
      } catch (e) {
        failed++;
        notes.push(`${f.name}: could not read (${e.message})`);
      }
    }
    if (files.length) {
      const body = el('div', null, el('ul', { class: 'sui-p' }, notes.map((n) => el('li', null, n))),
        el('p', { class: 'sui-p' }, `${added} contact${added === 1 ? '' : 's'} added${merged ? `, ${merged} exact duplicate group${merged === 1 ? '' : 's'} merged automatically` : ''}. The list has ${S.list.length}.`),
        failed ? el('p', { class: 'sui-p' }, 'Some files could not be read. Check that they are vCard or CSV.') : null);
      UI.dialog({ title: 'Import', body, buttons: [{ label: 'OK', primary: true }] });
    }
    return { added, merged, failed };
  }
  async function importPick() {
    const files = await UI.pickFiles({ accept: ACCEPT, multiple: true });
    if (files.length) await importFiles(files);
  }

  /** The contacts an export covers: the selection when there is one, otherwise the whole list. */
  const exportScope = () => (S.sel.size ? S.selected() : S.list);

  /** Download an export and save the same file to Slop Drive (root folder). */
  async function exportAs(formatId, list = exportScope()) {
    if (!list.length) { UI.toast('Nothing to export'); return false; }
    const out = SC.format.exportAs(formatId, list, S.file.name || 'Contacts');
    UI.download(out.blob, out.name);
    let saved = false;
    const h = hub();
    if (h) {
      try { await h.put(out.blob, { name: out.name, from: 'contacts' }); saved = true; }
      catch (e) { UI.toast('Downloaded, but Slop Drive did not save it'); }
    }
    UI.toast(`Exported ${out.count} contact${out.count === 1 ? '' : 's'}${saved ? ' and saved to Slop Drive' : ''}`);
    return true;
  }

  /** Export dialog: pick the format and the scope. */
  function exportDialog() {
    const hasSel = S.sel.size > 0;
    let formatId = 'vcf', scope = hasSel ? 'sel' : 'all';
    const fmt = UI.select(SC.format.FORMATS.map((f) => [f.id, f.label]), formatId);
    fmt.addEventListener('change', () => { formatId = fmt.value; });
    const radio = (value, label) => {
      const r = el('input', { type: 'radio', name: 'exp-scope', value, checked: scope === value });
      r.addEventListener('change', () => { if (r.checked) scope = value; });
      return el('label', { class: 'sui-check' }, r, el('span', null, label));
    };
    const body = el('div', null,
      UI.field('Format', fmt),
      el('div', { class: 'ed-scope' }, radio('sel', `Selected (${S.sel.size})`), radio('all', `All contacts (${S.list.length})`)),
      el('p', { class: 'sui-p ed-hint' }, 'The file downloads and a copy is saved to Slop Drive. vCard 3.0 works in iOS and Android; the CSV layouts match Google Contacts and Outlook.'));
    UI.dialog({ title: 'Export contacts', body, buttons: [{ label: 'Cancel' }, { label: 'Download and save', primary: true, act: () => {
      if (scope === 'sel' && !hasSel) { UI.toast('Select contacts first'); return false; }
      return exportAs(formatId, scope === 'sel' ? S.selected() : S.list).then(() => undefined);
    } }] });
  }

  SC.io = { importFiles, importPick, exportAs, exportDialog, addAndMerge, parseText, exportScope };
})();
