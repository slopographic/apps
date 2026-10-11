/* Homepage sections: the six sections in order, the placement map (SECTIONS, keyed by app id), the fallback for apps
 * the map does not name, the Print card, the file-type and tour facets. Classic script: window.SlopHomeSections.
 * An app may sit in more than one section: give SECTIONS[id] an array. Converter lines say what goes in and what comes out. */
(function () {
  'use strict';
  const SECTION_DEFS = [
    { id: 'documents', title: 'Documents and PDF', desc: 'Write, sheet, slide, read and sign. Files open and save on this device.' },
    { id: 'converters', title: 'Converters', desc: 'Each tool takes one kind of file in and gives another out. Nothing is uploaded.' },
    { id: 'labels', title: 'Labels, print and QR', desc: 'Barcode labels, QR codes and the print dialog that every app shares.' },
    { id: 'business', title: 'Business', desc: 'Slop 365: orders, invoices, customers, stock and the books, sharing one local drive.' },
    { id: 'creative', title: 'Creative and media', desc: 'Photo, vector, video, 3D and music tools for making things.' },
    { id: 'tools', title: 'Tools and AI', desc: 'Calculators, clocks, code, bytes, on-device AI and the Authenticator.' },
  ];
  /** Shown after the six, only when it has apps (an experiment no section names lands here). */
  const EXPERIMENTS = { id: 'experiments', title: 'Experiments', desc: 'Playful extras. Try them, no promises.', tiles: true };
  const TITLES = Object.fromEntries(SECTION_DEFS.concat([EXPERIMENTS]).map((d) => [d.id, d.title]));
  const FALLBACK = { business: 'business', creative: 'creative' };

  const SECTIONS = {
    docs: { section: 'documents', order: 1 },
    slides: { section: 'documents', order: 2 },
    tables: { section: 'documents', order: 3 },
    pdf: { section: 'documents', order: 4 },
    ocr: [{ section: 'documents', order: 5 }, { section: 'converters', order: 3, line: 'Scanned images or PDFs in; text, Word or a searchable PDF out.' }],
    eml: { section: 'documents', order: 6 },
    html2pdf: [{ section: 'documents', order: 7 }, { section: 'converters', order: 2, line: 'HTML files or pasted HTML in; a PDF with header and QR out.' }],
    notes: { section: 'documents', order: 8 },
    sheetview: [{ section: 'documents', order: 9 }, { section: 'converters', order: 7, line: 'XLSX, CSV or TSV in; a browsable, sortable table out.' }],
    paste: { section: 'documents', order: 10 },
    convert: { section: 'converters', order: 1, line: 'Images, PDFs, CSV, JSON or Markdown in; PNG, PDF, XLSX or JSON out.' },
    img3d: [{ section: 'converters', order: 4, line: 'A picture in; an OBJ or GLB 3D model out.' }, { section: 'creative', order: 10 }],
    resize: { section: 'converters', order: 5, line: 'Pictures or videos in; resized files out, to a size or a file limit.' },
    upscale: { section: 'converters', order: 6, line: 'Pictures or short videos in; 2x or 4x files out.' },
    contacts: [{ section: 'converters', order: 8, line: 'vCard or CSV in; a cleaned address book out.' }, { section: 'business', order: 4 }],
    label: { section: 'labels', order: 1 },
    qr: { section: 'labels', order: 2 },
    orders: { section: 'business', order: 1 },
    invoices: { section: 'business', order: 2 },
    crm: { section: 'business', order: 3 },
    inventory: { section: 'business', order: 5 },
    ledger: { section: 'business', order: 6 },
    calendar: { section: 'business', order: 7 },
    todo: { section: 'business', order: 8 },
    reminders: { section: 'business', order: 9 },
    drive: { section: 'business', order: 10 },
    admin: { section: 'business', order: 11 },
    photoslop: { section: 'creative', order: 1 },
    vector: { section: 'creative', order: 2 },
    slopedit: { section: 'creative', order: 3 },
    cutout: { section: 'creative', order: 4 },
    remix: { section: 'creative', order: 5 },
    gallery: { section: 'creative', order: 6 },
    music: { section: 'creative', order: 7 },
    '3d': { section: 'creative', order: 8 },
    effects: { section: 'creative', order: 9 },
    calculator: { section: 'tools', order: 1 },
    time: { section: 'tools', order: 2 },
    hex: { section: 'tools', order: 3 },
    code: { section: 'tools', order: 4 },
    aitools: { section: 'tools', order: 5 },
    authenticator: { section: 'tools', order: 6 },
    // Not an app: the central print dialog, shown as a card that opens the first app that has it.
    print: { section: 'labels', order: 3 },
  };
  const PRINT = { id: 'print', kind: 'app', group: 'business', name: 'Print', path: 'html2pdf/', status: 'live', icon: 'doc', features: [],
    tagline: 'The central print dialog: the same print look in every app. Try it in Slop HTML to PDF.' };

  /** Where an app sits: its map entries, or (for an app the map does not name) its old group, so it never disappears. */
  function placements(app) {
    const map = SECTIONS[app.id];
    if (map) return [].concat(map);
    const section = app.kind === 'experiment' ? EXPERIMENTS.id : FALLBACK[app.group] || 'business';
    return [{ section, order: 1000 }];
  }
  const titleOf = (id) => TITLES[id] || id;
  /** The file-type groups an app's accepted MIME types fall in (the finder's "File types" facet). */
  function typeKinds(accepts) {
    const out = new Set();
    for (const t of accepts || []) {
      if (t === '*') out.add('Any file');
      else if (t.startsWith('image/')) out.add('Images');
      else if (t.startsWith('video/')) out.add('Video');
      else if (t.startsWith('audio/')) out.add('Audio');
      else if (t === 'application/pdf') out.add('PDF');
      else if (t.startsWith('model/')) out.add('3D models');
      else if (/spreadsheet|excel|csv|tab-separated|json/.test(t)) out.add('Spreadsheets and data');
      else if (/wordprocessing|presentation|opendocument\.text|powerpoint/.test(t)) out.add('Word and slides');
      else if (/rfc822|\.eml/.test(t)) out.add('Email');
      else if (/html|\.htm/.test(t)) out.add('Web pages');
      else if (/vcard/.test(t)) out.add('Contacts');
      else if (/illustrator|photoshop|openraster|svg/.test(t)) out.add('Design files');
      else if (t.startsWith('text/')) out.add('Text');
      else out.add('Other');
    }
    return out.size ? [...out] : ['No upload'];
  }
  /** Apps with a guided tour: keep in step with TOURS in shared/tour/mount.js. */
  const TOUR_DIRS = new Set(['photoslop', 'slopvector', 'slopcut', 'remix', 'slopisolate', 'drive', 'orders', 'invoices', 'crm', 'calendar', 'todo', 'notes', 'paste', 'resize', 'upscale', 'aitools', '3d', 'img3d', 'effects', 'docs', 'slides', 'tables', 'label', 'gallery', 'hex', 'code']);

  window.SlopHomeSections = { SECTION_DEFS, EXPERIMENTS, SECTIONS, PRINT, TOUR_DIRS, placements, titleOf, typeKinds };
})();
