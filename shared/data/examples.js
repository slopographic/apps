// Example files for the imports: CSV text generated here, so nothing is downloaded. Each kind lists its
// columns and a short note; the importer reads the same header names (see each app's import code).
// Exposes window.SlopExamples: kinds(), info(kind), csv(kind), filename(kind), download(kind).
(function (g) {
  'use strict';
  const quote = (v) => { const s = String(v ?? ''); return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const line = (cells) => cells.map(quote).join(',');
  // Valid GS1 check digits throughout (EAN-13 bodies from the GS1 example prefixes).
  const KINDS = {
    label: {
      title: 'SlopLabel data (merge)', file: 'sloplabel-data-example.csv',
      columns: ['SKU', 'Name', 'Price', 'EAN', 'Qty'],
      rows: [['SLP-1', 'Lime goo 250 ml', '4.99', '4006381333931', '3'], ['SLP-2', 'Blue sparkle 500 ml', '6.50', '5012345678900', '1'],
        ['SLP-3', 'Mint slime, travel size', '2.25', '9780201379624', '2'], ['SLP-4', 'Glow pebbles (pack of 6)', '11.00', '5901234123457', '1']],
      note: 'One label per row. Each column becomes a {Field} you can put on the label (for example {EAN} in a barcode). A column named Qty (or Quantity, Copies) sets how many labels that row prints. Add a column with the same name as a prompt variable to fill it.',
    },
    inventory: {
      title: 'Inventory products (CSV import)', file: 'slop-products-example.csv',
      columns: ['SKU', 'EAN', 'Name', 'Price', 'Reorder level'],
      rows: [['SLP-1', '4006381333931', 'Lime goo 250 ml', '4.99', '10'], ['SLP-2', '5012345678900', 'Blue sparkle 500 ml', '6.50', '5'],
        ['SLP-3', '', 'Mint slime, travel size', '2.25', ''], ['SLP-4', '5901234123457', 'Glow pebbles (pack of 6)', '11.00', '0']],
      note: 'SKU, Name and Price are required. SKU must be unique (a row with a known SKU updates that product). EAN is optional and its check digit is verified. Price is a plain amount before tax (12.50, not $12.50). Reorder level is a whole number, or blank for no alert. Other columns are ignored.',
    },
    contacts: {
      title: 'Contacts (Google Contacts CSV)', file: 'slop-contacts-example.csv',
      columns: ['First Name', 'Last Name', 'Organization 1 - Name', 'Organization 1 - Title', 'E-mail 1 - Value', 'Phone 1 - Type', 'Phone 1 - Value', 'Labels', 'Notes'],
      rows: [['Ada', 'Lovelace', 'Analytical Works', 'Buyer', 'ada@example.com', 'Work', '+44 20 7946 0001', 'Customers', 'Asked for a quote on 250 ml jars'],
        ['Grace', 'Hopper', '', '', 'grace@example.com', 'Mobile', '+1 555 0100', 'Leads', ''],
        ['Alan', 'Turing', 'Bletchley Supplies', 'Owner', 'alan@example.com', 'Work', '+44 20 7946 0002', '', 'Wants a follow-up in May']],
      note: 'Save these columns from Google Contacts or Outlook (or use this file as a model). Each row is one contact. Labels become groups; Notes are kept. In Slop Contacts, use File ▸ Import vCard, CSV or .scontacts, then bring the saved list into SlopCRM.',
    },
    crm: {
      title: 'CRM customers (through Slop Contacts)', file: 'slop-crm-customers-example.csv',
      columns: ['First Name', 'Last Name', 'Organization 1 - Name', 'E-mail 1 - Value', 'Phone 1 - Value', 'Labels', 'Notes'],
      rows: [['Ada', 'Lovelace', 'Analytical Works', 'ada@example.com', '+44 20 7946 0001', 'Customers', 'Asked for a quote on 250 ml jars'],
        ['Grace', 'Hopper', '', 'grace@example.com', '+1 555 0100', 'Leads', 'Met at the trade show']],
      note: 'The CRM does not read CSV directly. Import this file in Slop Contacts first. Then, in SlopCRM, use Customers ▸ Import from Slop Contacts: each new contact becomes a lead with its name, e-mail, phone, labels as categories and notes. Contacts already linked to a customer are skipped.',
    },
  };

  const need = (kind) => { const k = KINDS[kind]; if (!k) throw new Error(`No example for "${kind}"`); return k; };
  /** The example's CSV text (header row, then the rows; CRLF-free, RFC 4180 quoting). */
  function csv(kind) { const k = need(kind); return [line(k.columns), ...k.rows.map(line)].join('\n') + '\n'; }
  /** { title, file, columns, note } for the import dialog's text. */
  function info(kind) { const k = need(kind); return { title: k.title, file: k.file, columns: k.columns.slice(), note: k.note }; }
  function filename(kind) { return need(kind).file; }
  function kinds() { return Object.keys(KINDS); }

  /** Downloads the example as a file (through SlopUI when the page has it). */
  function download(kind) {
    const blob = new Blob([csv(kind)], { type: 'text/csv;charset=utf-8' });
    if (g.SlopUI && g.SlopUI.download) g.SlopUI.download(blob, filename(kind));
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename(kind); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  }

  g.SlopExamples = { kinds, info, csv, filename, download };
})(typeof window !== 'undefined' ? window : globalThis);
