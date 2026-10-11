// One-page A4 invoice PDF with the vendored pdf-lib (vendor/pdf-lib/pdf-lib.min.js, global PDFLib). Pure bytes out:
// the caller passes the invoice, its customer, the company and the money formatter, and gets Uint8Array bytes.
// Helvetica is a standard font, so no font file is loaded. A PDF page holds MAX_LINES lines; more is refused.
(function (g) {
  'use strict';
  const NS = (g.SlopInvoices = g.SlopInvoices || {});
  const MAX_LINES = 30;
  const PAGE = [595.28, 841.89];
  const LEFT = 40, RIGHT = 555;
  const ROW = 14;
  const TOP_ROWS = 612;

  /** Helvetica (WinAnsi) draws Latin text and the euro sign; anything else becomes "?" and line breaks become spaces,
   *  so pdf-lib never throws on a character it cannot draw. */
  const clean = (t) => String(t ?? '').replace(/[\r\n\t]+/g, ' ').replace(/[\u00a0\u202f]/g, ' ').replace(/[^\x20-\x7e\xa0-\xff\u20ac]/g, '?');

  /** Shortens text with "..." until it fits the width at this size. */
  function fit(font, text, size, maxW) {
    const t = clean(text);
    if (font.widthOfTextAtSize(t, size) <= maxW) return t;
    let s = t;
    while (s.length > 1 && font.widthOfTextAtSize(`${s}...`, size) > maxW) s = s.slice(0, -1);
    return `${s}...`;
  }

  /** ctx: { invoice, customer, company: { name, address, taxNumber }, money(minor), paid, balance, totals }. */
  async function invoicePdf(ctx) {
    const PDFLib = g.PDFLib;
    if (!PDFLib) return { ok: false, code: 'unavailable', message: 'the PDF library did not load' };
    const inv = ctx.invoice;
    if (inv.lines.length > MAX_LINES) {
      return { ok: false, code: 'too_long', message: `a PDF page holds ${MAX_LINES} lines and this invoice has ${inv.lines.length}. Print it instead` };
    }
    const doc = await PDFLib.PDFDocument.create();
    const page = doc.addPage(PAGE);
    const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    const bold = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const write = (s, x, y, size = 10, f = font, right = false) => {
      const t = clean(s);
      page.drawText(t, { x: right ? x - f.widthOfTextAtSize(t, size) : x, y, size, font: f });
    };
    const rule = (y) => page.drawLine({ start: { x: LEFT, y }, end: { x: RIGHT, y }, thickness: 0.6, color: PDFLib.rgb(0.6, 0.6, 0.6) });

    write(ctx.company.name || 'Your company', LEFT, 800, 14, bold);
    let y = 784;
    for (const l of String(ctx.company.address || '').split('\n').slice(0, 3)) { write(l, LEFT, y, 9); y -= 12; }
    if (ctx.company.taxNumber) write(`Tax number: ${ctx.company.taxNumber}`, LEFT, y, 9);
    write('INVOICE', RIGHT, 800, 20, bold, true);
    write(`Number: ${inv.number || 'draft'}`, RIGHT, 782, 10, font, true);
    write(`Date: ${inv.date}`, RIGHT, 768, 10, font, true);
    if (inv.dueDate) write(`Due: ${inv.dueDate}`, RIGHT, 754, 10, font, true);

    const c = ctx.customer || {};
    write('Bill to', LEFT, 700, 9, bold);
    write(c.name || '(no customer)', LEFT, 686, 11, bold);
    let cy = 672;
    for (const l of [c.email, c.phone, ...String(c.address || '').split('\n')].filter(Boolean).slice(0, 4)) { write(l, LEFT, cy, 9); cy -= 12; }

    const cols = { qty: 300, unit: 375, net: 440, tax: 500, total: RIGHT };
    const head = 640;
    write('Description', LEFT, head, 9, bold);
    write('Qty', cols.qty, head, 9, bold, true);
    write('Unit price', cols.unit, head, 9, bold, true);
    write('Net', cols.net, head, 9, bold, true);
    write('Tax', cols.tax, head, 9, bold, true);
    write('Total', cols.total, head, 9, bold, true);
    rule(head - 5);
    let row = TOP_ROWS;
    for (const l of inv.lines) {
      const a = { net: l.net, tax: l.tax, total: l.total };
      write(fit(font, l.description, 9, 250), LEFT, row, 9);
      write(String(l.qty), cols.qty, row, 9, font, true);
      write(ctx.money(l.unitPrice), cols.unit, row, 9, font, true);
      write(ctx.money(a.net), cols.net, row, 9, font, true);
      write(ctx.money(a.tax), cols.tax, row, 9, font, true);
      write(ctx.money(a.total), cols.total, row, 9, font, true);
      row -= ROW;
    }
    rule(row + ROW - 4);

    const t = ctx.totals;
    let ty = row - 8;
    const sumRow = (label, value, size = 10, f = font) => { write(label, 440, ty, size, f, true); write(value, RIGHT, ty, size, f, true); ty -= 15; };
    sumRow('Subtotal', ctx.money(t.subtotal));
    for (const r of t.byRate) sumRow(`Tax ${(r.rate / 100).toFixed(2)}%`, ctx.money(r.tax), 9);
    sumRow('Total', ctx.money(t.total), 11, bold);
    if (ctx.paid) sumRow('Paid', ctx.money(ctx.paid));
    if (inv.status === 'issued' || inv.status === 'paid') sumRow('Balance due', ctx.money(ctx.balance), 11, bold);
    if (inv.notes) write(fit(font, inv.notes, 9, RIGHT - LEFT), LEFT, Math.max(ty - 10, 40), 9);

    return { ok: true, value: await doc.save() };
  }

  NS.pdf = { invoicePdf, MAX_LINES, clean };
})(typeof window !== 'undefined' ? window : globalThis);
