/* Slop Contacts: the .scontacts file (JSON, kept in Slop Drive) and the export table. Each export returns
 * { blob, name } so the app can download it and save the same file to Slop Drive.
 * Classic script. Adds SlopContacts.format. */
(function () {
  'use strict';
  const SC = (window.SlopContacts = window.SlopContacts || {});
  const M = SC.model;
  const MIME = 'application/x-slop-contacts', EXT = 'scontacts';
  const enc = new TextEncoder();

  /** The saved list. Contacts are normalised on the way out and on the way back in. */
  function toScontacts(list, meta = {}) {
    return JSON.stringify({ format: 'slop-contacts', version: 1, saved: new Date().toISOString(), meta, contacts: list.map(M.normalise) }, null, 1);
  }
  function fromScontacts(text) {
    const d = JSON.parse(String(text || ''));
    if (!d || d.format !== 'slop-contacts' || !Array.isArray(d.contacts)) throw new Error('This is not a Slop Contacts file.');
    return d.contacts.map(M.normalise);
  }

  /** A file name safe on every system: no slashes, no control characters, at most 80 characters. */
  const safe = (s) => String(s || '').replace(/[\\/:*?"<>|\x00-\x1f]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Contact';
  const textBlob = (text, type) => new Blob([text], { type });

  /** One zip entry per contact, named after its display name (duplicates get " (2)"). */
  function zipOf(list) {
    const files = list.map((c) => ({ name: safe(M.displayName(c)) + '.vcf', data: enc.encode(SC.vcard.one(M.normalise(c))) }));
    return new Blob([SC.zip.store(files)], { type: 'application/zip' });
  }

  /** The export table. base is the list name without extension. */
  const FORMATS = [
    { id: 'vcf', label: 'vCard 3.0 (.vcf), one file for iOS and Android', ext: 'vcf',
      build: (list, base) => ({ blob: textBlob(SC.vcard.write(list), 'text/vcard'), name: `${safe(base)}.vcf` }) },
    { id: 'zip', label: 'vCard per contact (.zip)', ext: 'zip',
      build: (list, base) => ({ blob: zipOf(list), name: `${safe(base)} vcards.zip` }) },
    { id: 'google', label: 'Google Contacts CSV', ext: 'csv',
      build: (list, base) => ({ blob: textBlob(SC.csv.googleCsv(list), 'text/csv'), name: `${safe(base)} (Google).csv` }) },
    { id: 'outlook', label: 'Outlook CSV', ext: 'csv',
      build: (list, base) => ({ blob: textBlob(SC.csv.outlookCsv(list), 'text/csv'), name: `${safe(base)} (Outlook).csv` }) },
  ];
  const formatById = (id) => FORMATS.find((f) => f.id === id) || FORMATS[0];
  /** The export for a format id. Returns { blob, name, count }. */
  function exportAs(id, list, base = 'Contacts') {
    const f = formatById(id);
    return { ...f.build(list, base), count: list.length };
  }

  SC.format = { MIME, EXT, toScontacts, fromScontacts, safe, FORMATS, formatById, exportAs };
})();
