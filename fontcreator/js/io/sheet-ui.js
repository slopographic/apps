/* Slop Font: the handwriting sheet in the page. "Print a sheet": the boxes for a set of characters (core/sheet.js
 * layout) drawn on a canvas, downloaded as a PDF (pdf-lib, vendor/pdf-lib, loaded on first use) or a PNG of one page.
 * "Read a filled sheet": a photo or scan of it; the four corner squares are found, the page is mapped onto the photo and
 * each box is traced on its own baseline (core/trace.js, 'lines' placement), every written box becoming that glyph in
 * one undo step. Guide lines are printed light, so the tracer takes them for paper. Classic script.
 *   FC.sheetUi.template()   the print dialog         draw(layout, pageIndex) → canvas      pdf(layout) → Promise<Blob>
 *   pick()                  choose a photo           read(img, name)  the "which sheet" dialog, then readInto()
 *   readInto(img, { set, page, paper }) → { glyphs, empty }   (paper: a4 | letter) */
(function (g) {
  'use strict';
  const S = () => g.FC.state, F = () => g.SlopFont;
  const HERE = (document.currentScript && document.currentScript.src) || location.href;
  const SETS = ['upper', 'lower', 'digits', 'punct', 'nordic', 'basic', 'latin1', 'latinA'];
  let partId = null;
  const lay = (set, paper) => F().sheet.layout(F().charset.codes(set).filter((c) => c > 0x20 && c !== 0xa0 && c !== 0xad), S().project().metrics, { page: paper });
  const setLabel = (id) => (F().charset.SETS.find((s) => s.id === id) || { label: id }).label;

  function draw(L, index) {
    const c = document.createElement('canvas'); c.width = L.width; c.height = L.height;
    const x = c.getContext('2d'), page = L.pages[index], set = S().settings().sheetSet;
    x.fillStyle = '#fff'; x.fillRect(0, 0, L.width, L.height);
    x.fillStyle = '#000';
    for (const m of L.markers) x.fillRect(m.x, m.y, m.size, m.size);
    x.font = '600 22px system-ui, sans-serif'; x.textBaseline = 'middle';
    x.fillText(`Handwriting sheet · ${S().project().info.family}`, L.markers[0].x + L.size + 24, L.markers[0].cy - 8);
    x.font = '15px system-ui, sans-serif'; x.fillStyle = '#444';
    x.fillText(`${setLabel(set)} · page ${index + 1} of ${L.pages.length} · write each character in its box, standing on the dark line, with a black pen`, L.markers[0].x + L.size + 24, L.markers[0].cy + 18);
    for (const cell of page.cells) {
      x.strokeStyle = '#cfcfcf'; x.lineWidth = 1.5; x.strokeRect(cell.x + 0.5, cell.y + 0.5, cell.w - 1, cell.h - 1);
      x.fillStyle = '#7a7a7a'; x.font = '18px system-ui, sans-serif'; x.textBaseline = 'top'; x.fillText(cell.label, cell.x + 8, cell.y + 6);
      x.font = '11px system-ui, sans-serif'; x.fillStyle = '#9a9a9a'; x.fillText(F().charset.hex(cell.cp), cell.x + cell.w - 58, cell.y + 9);
      const a = cell.area;
      for (const [k, col, dash] of [['asc', '#e2e2e2', [6, 6]], ['cap', '#dadada', [3, 5]], ['x', '#dadada', [3, 5]], ['base', '#c2c2c2', []], ['desc', '#e2e2e2', [6, 6]]]) {
        x.strokeStyle = col; x.lineWidth = k === 'base' ? 2 : 1; x.setLineDash(dash);
        x.beginPath(); x.moveTo(a.x, cell.lines[k] + 0.5); x.lineTo(a.x + a.w, cell.lines[k] + 0.5); x.stroke();
      }
      x.setLineDash([]);
    }
    return c;
  }
  const load = (src) => new Promise((res, rej) => { const s = Object.assign(document.createElement('script'), { src: new URL(src, HERE).href }); s.onload = res; s.onerror = () => rej(new Error('Could not load the PDF maker')); document.head.append(s); });
  const png = (c) => new Promise((res) => c.toBlob(res, 'image/png'));
  async function pdf(L) {
    if (!g.PDFLib) await load('../../../vendor/pdf-lib/pdf-lib.min.js');
    const doc = await g.PDFLib.PDFDocument.create(), size = L.page === 'letter' ? [612, 792] : [595.28, 841.89];
    doc.setTitle(`Handwriting sheet: ${S().project().info.family}`);
    for (let i = 0; i < L.pages.length; i++) {
      const img = await doc.embedPng(new Uint8Array(await (await png(draw(L, i))).arrayBuffer()));
      doc.addPage(size).drawImage(img, { x: 0, y: 0, width: size[0], height: size[1] });
    }
    return new Blob([await doc.save()], { type: 'application/pdf' });
  }
  function setSelect(id, value) {
    const el = g.SlopUI.el('select', { class: 'sui-input', id });
    for (const s of SETS) el.append(g.SlopUI.el('option', { value: s }, setLabel(s)));
    el.value = value;
    return el;
  }
  function paperSelect(id) {
    const el = g.SlopUI.el('select', { class: 'sui-input', id });
    for (const [k, v] of Object.entries(F().sheet.PAGES)) el.append(g.SlopUI.el('option', { value: k }, v.label));
    el.value = S().settings().sheetPage;
    return el;
  }
  function template() {
    const U = g.SlopUI, el = U.el, set = setSelect('fc-sheet-set', S().settings().sheetSet), paper = paperSelect('fc-sheet-paper');
    const note = el('p', { class: 'sf-note', id: 'fc-sheet-note' });
    const upd = () => { S().set({ sheetSet: set.value, sheetPage: paper.value }); const L = lay(set.value, paper.value); note.textContent = `${L.pages.reduce((n, p) => n + p.cells.length, 0)} boxes on ${L.pages.length} page${L.pages.length === 1 ? '' : 's'}.`; };
    set.addEventListener('change', upd); paper.addEventListener('change', upd);
    const pngB = el('button', { type: 'button', class: 'sui-btn', id: 'fc-sheet-png' }, 'Download page 1 as PNG');
    pngB.addEventListener('click', async () => { const L = lay(set.value, paper.value); U.download(await png(draw(L, 0)), `handwriting-sheet-${set.value}.png`); });
    upd();
    U.dialog({ title: 'Print a handwriting sheet', cls: 'fc-dialog', body: el('div', { class: 'fc-dlg' },
      el('p', { class: 'sui-p' }, 'Print it at 100% (no "fit to page"), write each character in its box with a black pen, then photograph it flat and in good light, or scan it. Keep the four black corner squares in the picture.'),
      U.field('Characters', set), U.field('Paper', paper), note, pngB),
    buttons: [{ label: 'Close' }, { label: 'Download PDF', primary: true, act: async () => {
      try { U.download(await pdf(lay(set.value, paper.value)), `handwriting-sheet-${set.value}.pdf`); } catch (e) { U.toast(e.message); return false; }
    } }] });
  }
  function readInto(img, o) {
    const T = F().trace, SH = F().sheet, L = lay(o.set, o.paper || 'a4'), page = L.pages[(o.page || 1) - 1];
    if (!page) throw new Error(`That sheet has ${L.pages.length} page${L.pages.length === 1 ? '' : 's'}`);
    const gray = T.binarize(img), marks = SH.findMarkers(gray.bits, img.width, img.height);
    if (!marks) throw new Error('The four black corner squares were not found: photograph the whole sheet, flat and in good light');
    const H = SH.homography(L.markers.map((m) => ({ x: m.cx, y: m.cy })), marks);
    const levels = []; for (let i = 0; i < img.data.length; i += 4 * 97) levels.push(0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2]);
    levels.sort((a, b) => a - b);
    const paperLevel = levels[Math.floor(levels.length * 0.7)] || 230, threshold = Math.round(Math.min(gray.threshold, paperLevel * 0.62));
    const done = [], m = S().project().metrics;
    for (const cell of page.cells) {
      const a = cell.area, inset = 4, rect = { x: a.x + inset, y: a.y + inset, w: a.w - 2 * inset, h: a.h - 2 * inset };
      const px = SH.cut(img, H, rect);
      const r = T.trace(px, { threshold, minArea: 12, place: { mode: 'lines', baseline: cell.lines.base - rect.y, capline: cell.lines.cap - rect.y, capHeight: m.capHeight, left: 50 } });
      if (r.contours.length) done.push({ cp: cell.cp, contours: r.contours, advance: r.advance });
    }
    if (done.length) S().edit(`Read ${done.length} handwritten glyphs`, 'project', (p) => { for (const d of done) { const gl = F().model.ensure(p, d.cp); gl.contours = d.contours; gl.advance = d.advance; } });
    return { glyphs: done.length, empty: page.cells.length - done.length, threshold };
  }
  function read(img, name) {
    const U = g.SlopUI, el = U.el, set = setSelect('fc-read-set', S().settings().sheetSet), paper = paperSelect('fc-read-paper');
    const pageN = el('input', { class: 'sui-input', type: 'number', id: 'fc-read-page', min: '1', max: '20', value: '1' });
    U.dialog({ title: 'Read a handwriting sheet', cls: 'fc-dialog', body: el('div', { class: 'fc-dlg' },
      el('p', { class: 'sui-p' }, `Which sheet is ${name || 'this'}? Its top line says the characters and the page.`), U.field('Characters', set), U.field('Paper', paper), U.field('Page', pageN)),
    buttons: [{ label: 'Cancel' }, { label: 'Read the sheet', primary: true, act: () => {
      try {
        const r = readInto(img, { set: set.value, page: Number(pageN.value) || 1, paper: paper.value });
        U.toast(r.glyphs ? `Read ${r.glyphs} glyph${r.glyphs === 1 ? '' : 's'}${r.empty ? ` (${r.empty} boxes were empty)` : ''}` : 'Every box was empty: write with a darker pen', 5000);
      } catch (e) { U.toast(e.message, 5000); return false; }
    } }] });
  }
  function pick() {
    if (!partId) partId = g.SlopIntake.part({ id: 'fontcreator.sheet', accept: { types: ['image/*'], noun: 'a photo or scan of the sheet' }, process: async (f) => { read(await g.FC.traceUi.pixels(f, 2000), f.name); return f.name; } });
    return g.SlopIntake.pick({ to: partId, accept: 'image/*' });
  }
  g.FC.sheetUi = { template, draw, pdf, pick, read, readInto, lay };
})(window);
