/* Slop Contacts: write CSV in the Google Contacts and Outlook layouts. UTF-8 with a byte-order mark (so Excel
 * reads accents), CRLF line ends, fields quoted when they hold a comma, quote or line break.
 * Outlook has fixed slots, so extra phones, e-mails and addresses beyond them are not written (see HANDOFF.md).
 * Classic script. Adds SlopContacts.csv.googleCsv(contacts) and SlopContacts.csv.outlookCsv(contacts). */
(function () {
  'use strict';
  const SC = (window.SlopContacts = window.SlopContacts || {});
  const q = (v) => { const s = v == null ? '' : String(v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const line = (cells) => cells.map(q).join(',');
  const table = (header, rows) => '﻿' + [line(header), ...rows.map(line)].join('\r\n') + '\r\n';
  const ymdUS = (b) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(b || ''); return m ? `${m[2]}/${m[3]}/${m[1]}` : ''; };

  const LABEL = { CELL: 'Mobile', HOME: 'Home', WORK: 'Work', MAIN: 'Main', FAX: 'Fax', PAGER: 'Pager', OTHER: 'Other', CAR: 'Car' };
  /** Types to a Google label: ['HOME', 'FAX'] to "Home Fax", custom 'DAD' to "Dad". */
  const googleLabel = (types) => (types || []).map((t) => LABEL[t] || t.charAt(0) + t.slice(1).toLowerCase()).join(' ');
  const groupsG = (groups) => (groups || []).map((g) => '* ' + g).join(' ::: ');

  /** Google Contacts export layout (the phone, e-mail and address columns grow to the largest contact). */
  function googleCsv(contacts) {
    const list = (contacts || []).map((c) => SC.model.normalise(c));
    const nP = Math.max(1, ...list.map((c) => c.phones.length)), nE = Math.max(1, ...list.map((c) => c.emails.length));
    const nA = Math.max(1, ...list.map((c) => c.adr.length));
    const head = ['Name', 'Given Name', 'Additional Name', 'Family Name', 'Name Prefix', 'Name Suffix', 'Birthday', 'Notes', 'Website 1 - Value',
      'Organization 1 - Name', 'Organization 1 - Department', 'Organization 1 - Title', 'Group Membership'];
    for (let i = 1; i <= nP; i++) head.push(`Phone ${i} - Type`, `Phone ${i} - Value`);
    for (let i = 1; i <= nE; i++) head.push(`E-mail ${i} - Type`, `E-mail ${i} - Value`);
    for (let i = 1; i <= nA; i++) head.push(`Address ${i} - Type`, `Address ${i} - Street`, `Address ${i} - City`, `Address ${i} - PO Box`,
      `Address ${i} - Region`, `Address ${i} - Postal Code`, `Address ${i} - Country`, `Address ${i} - Extended Address`);
    const rows = list.map((c) => {
      const n = c.name;
      const r = [SC.model.composed(c) || c.fn, n.given, n.additional, n.family, n.prefix, n.suffix, c.bday, c.note, c.url, c.org, c.dept, c.title, groupsG(c.groups)];
      for (let i = 0; i < nP; i++) { const p = c.phones[i]; r.push(p ? googleLabel(p.types) : '', p ? p.value : ''); }
      for (let i = 0; i < nE; i++) { const e = c.emails[i]; r.push(e ? googleLabel(e.types) : '', e ? e.value : ''); }
      for (let i = 0; i < nA; i++) {
        const a = c.adr[i];
        r.push(a ? googleLabel(a.types) : '', a ? a.street : '', a ? a.locality : '', a ? a.po : '', a ? a.region : '', a ? a.postal : '', a ? a.country : '', a ? a.ext : '');
      }
      return r;
    });
    return table(head, rows);
  }

  const OUTLOOK_HEAD = ['First Name', 'Middle Name', 'Last Name', 'Title', 'Suffix', 'Company', 'Department', 'Job Title',
    'Business Street', 'Business City', 'Business State', 'Business Postal Code', 'Business Country/Region',
    'Home Street', 'Home City', 'Home State', 'Home Postal Code', 'Home Country/Region',
    'Other Street', 'Other City', 'Other State', 'Other Postal Code', 'Other Country/Region',
    'Business Phone', 'Business Phone 2', 'Home Phone', 'Home Phone 2', 'Mobile Phone', 'Other Phone', 'Business Fax', 'Home Fax', 'Pager',
    'E-mail Address', 'E-mail 2 Address', 'E-mail 3 Address', 'Web Page', 'Birthday', 'Notes', 'Categories'];
  /** The Outlook phone columns a phone may go in, best first. */
  function phoneSlots(types) {
    const t = types || [];
    let pref;
    if (t.includes('FAX') && t.includes('WORK')) pref = ['Business Fax'];
    else if (t.includes('FAX') && t.includes('HOME')) pref = ['Home Fax'];
    else if (t.includes('CELL')) pref = ['Mobile Phone'];
    else if (t.includes('PAGER')) pref = ['Pager'];
    else if (t.includes('WORK')) pref = ['Business Phone', 'Business Phone 2'];
    else if (t.includes('HOME')) pref = ['Home Phone', 'Home Phone 2'];
    else pref = [];
    return pref.concat(['Other Phone']);
  }
  /** Outlook layout: one row per contact in the fixed slots. */
  function outlookCsv(contacts) {
    const rows = (contacts || []).map((x) => {
      const c = SC.model.normalise(x), n = c.name, v = {};
      for (const p of c.phones) { const slot = phoneSlots(p.types).find((s) => !v[s]); if (slot) v[slot] = p.value; }
      c.emails.slice(0, 3).forEach((e, i) => { v[['E-mail Address', 'E-mail 2 Address', 'E-mail 3 Address'][i]] = e.value; });
      const byType = { WORK: 'Business', HOME: 'Home' };
      for (const a of c.adr) {
        const pre = (a.types || []).map((t) => byType[t]).find((p) => p && !v[p + ' Street']) || ['Business', 'Home', 'Other'].find((p) => !v[p + ' Street']);
        if (!pre) continue;
        Object.assign(v, { [pre + ' Street']: a.street, [pre + ' City']: a.locality, [pre + ' State']: a.region,
          [pre + ' Postal Code']: a.postal, [pre + ' Country/Region']: a.country });
      }
      return [n.given, n.additional, n.family, n.prefix, n.suffix, c.org, c.dept, c.title,
        v['Business Street'], v['Business City'], v['Business State'], v['Business Postal Code'], v['Business Country/Region'],
        v['Home Street'], v['Home City'], v['Home State'], v['Home Postal Code'], v['Home Country/Region'],
        v['Other Street'], v['Other City'], v['Other State'], v['Other Postal Code'], v['Other Country/Region'],
        v['Business Phone'], v['Business Phone 2'], v['Home Phone'], v['Home Phone 2'], v['Mobile Phone'], v['Other Phone'],
        v['Business Fax'], v['Home Fax'], v['Pager'], v['E-mail Address'], v['E-mail 2 Address'], v['E-mail 3 Address'],
        c.url, ymdUS(c.bday), c.note, c.groups.join(';')];
    });
    return table(OUTLOOK_HEAD, rows);
  }

  SC.csv = Object.assign(SC.csv || {}, { googleCsv, outlookCsv, OUTLOOK_HEAD });
})();
