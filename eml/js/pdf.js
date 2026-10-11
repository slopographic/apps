/* Slop EML: a message as a PDF, made with pdf-lib (vendor/pdf-lib/pdf-lib.min.js, loaded by index.html). Classic script;
 * exposes window.EmlPdf. Layout: A4, Helvetica (WinAnsi), the headers, the subject, then the plain-text body (or the HTML
 * body reduced to text paragraphs), word wrap, page numbers, and optionally the attachment names at the end (not embedded).
 * A character the standard font cannot encode becomes '?' and is counted: build() reports the count and a few samples.
 * HTML layout and images are not kept. The Print action keeps them. */
(function () {
  'use strict';
  const T = window.EmlText;
  const P = (window.EmlPdf = {});
  const W = 595.28, H = 841.89, MG = 56, SIZE = 10.5, LH = 14.5;
  const TEXT_W = W - 2 * MG;

  const sizeOf = (n) => (n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB');

  /** The PDF of one open message (a doc from EmlApp). Resolves { bytes, replaced, samples, pages }.
   *  opts.attachments: list the attachment names at the end (default true). */
  P.build = async function (doc, opts = {}) {
    const L = window.PDFLib;
    if (!L) throw new Error('The PDF library did not load. Reload the page and try again.');
    const m = doc.msg, s = doc.summary;
    const pdf = await L.PDFDocument.create();
    pdf.setTitle(s.subject || doc.name);
    pdf.setCreator('Slop EML');
    pdf.setProducer('Slop EML');
    const font = await pdf.embedFont(L.StandardFonts.Helvetica);
    const bold = await pdf.embedFont(L.StandardFonts.HelveticaBold);
    const ink = L.rgb(0, 0, 0), dim = L.rgb(0.35, 0.35, 0.35);

    const stats = { replaced: 0, samples: new Set() };
    const known = new Map();
    const encodable = (ch) => {
      if (!known.has(ch)) {
        let ok = true;
        try { font.encodeText(ch); } catch (e) { ok = false; }
        known.set(ch, ok);
      }
      return known.get(ch);
    };
    /** Text the font can draw: line breaks and tabs kept (tabs as spaces), other control characters dropped, unknown characters as '?'. */
    const clean = (str) => {
      let out = '';
      for (const ch of String(str == null ? '' : str)) {
        const c = ch.codePointAt(0);
        if (c === 10) out += '\n';
        else if (c === 9) out += '    ';
        else if (c < 32 || c === 127) continue;
        else if (encodable(ch)) out += ch;
        else {
          out += '?';
          stats.replaced++;
          if (stats.samples.size < 8) stats.samples.add(ch);
        }
      }
      return out;
    };
    const width = (str, size, f) => f.widthOfTextAtSize(str, size);

    const pages = [];
    let page = null, y = 0;
    const newPage = () => { page = pdf.addPage([W, H]); pages.push(page); y = H - MG; };
    const room = (h) => { if (y - h < MG + 24) newPage(); };
    /** One line of text, its baseline below the current top. */
    const put = (str, x, size, f, color) => {
      if (str) page.drawText(str, { x, y: y - size, size, font: f, color });
    };
    /** Wrapped paragraph lines from x to the right margin. */
    const block = (str, o) => {
      const lines = T.wrap(str, W - MG - o.x, (t) => width(t, o.size, o.f));
      for (const ln of lines) { room(o.lh); put(ln, o.x, o.size, o.f, o.color || ink); y -= o.lh; }
    };

    newPage();
    /* Headers: label in bold, the value wrapped beside it. */
    const rows = [['From', s.from], ['To', s.to], ['Cc', s.cc], ['Bcc', s.bcc], ['Date', s.date]];
    for (const [label, value] of rows) {
      if (!value) continue;
      const lw = width(label + ':', 10, bold) + 8;
      const lines = T.wrap(clean(value), W - MG - (MG + lw), (t) => width(t, 10, font));
      for (let i = 0; i < lines.length; i++) {
        room(LH);
        if (i === 0) put(label + ':', MG, 10, bold, ink);
        put(lines[i], MG + lw, 10, font, ink);
        y -= LH;
      }
    }
    room(40);
    y -= 8;
    page.drawLine({ start: { x: MG, y }, end: { x: W - MG, y }, thickness: 0.6, color: dim });
    y -= 16;
    block(clean(s.subject || '(no subject)'), { x: MG, size: 15, f: bold, lh: 19 });
    y -= 10;

    /* Body: plain text, or the HTML reduced to text paragraphs. */
    const source = m.text != null ? m.text : m.html != null ? T.htmlToText(m.html) : '';
    const text = clean(source) || '(This message has no text body.)';
    for (const para of text.split('\n')) {
      if (para.trim() === '') { room(LH); y -= LH * 0.7; continue; }
      block(para, { x: MG, size: SIZE, f: font, lh: LH });
    }

    /* Attachments: names only, at the end. */
    if (opts.attachments !== false) {
      y -= 18;
      room(60);
      put('Attachments (' + m.attachments.length + ')', MG, 12, bold, ink);
      y -= 18;
      if (!m.attachments.length) block('None.', { x: MG, size: SIZE, f: font, lh: LH });
      for (const a of m.attachments) {
        block(clean(a.index + 1 + '. ' + a.name + ' (' + a.type + ', ' + sizeOf(a.size) + ')'), { x: MG, size: SIZE, f: font, lh: LH });
      }
      block('Attachments are listed here and not embedded. Save them from the message.', { x: MG, size: 9, f: font, lh: 12, color: dim });
    }

    /* Page numbers, at the foot of every page. */
    const n = pages.length;
    pages.forEach((p, i) => {
      const label = 'Page ' + (i + 1) + ' of ' + n;
      const w = width(label, 9, font);
      p.drawText(label, { x: (W - w) / 2, y: MG / 2, size: 9, font, color: dim });
    });

    pdf.setSubject(clean(s.subject || doc.name).slice(0, 200));
    const bytes = await pdf.save();
    return { bytes, replaced: stats.replaced, samples: [...stats.samples], pages: n };
  };

  /** A file name for the PDF: the message's file name with .pdf. */
  P.fileName = function (doc) {
    const base = window.EmlApp.baseName(doc).replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim();
    return (base || 'message') + '.pdf';
  };
})();
