/* Slop PDF edit text in place: the editor sits on the line it edits. It shows the run in the page's own face when the file
   embeds one (pdf.js loaded it to draw the page), on the same baseline and as wide as the PDF draws it, on an opaque paper
   colour so the old text does not show through, and it grows to the right while typing (up to the page edge) instead of
   scrolling inside the old run's box. */
// Covers: pdf/js/editor/edit-text.js
(function () {
  'use strict';
  const { describe, it, expect, waitFor, sleep } = SlopTest;
  const doc = () => PT.win.document;

  /** One page, 400 x 200: a Helvetica line (not embedded) at baseline 140 and a Barlow subset line at baseline 80, 16 pt. */
  async function twoLinePdf() {
    const L = PT.win.PDFLib, kit = await PT.win.SlopFontCatalog.fontkit(), d = await L.PDFDocument.create();
    d.registerFontkit(kit);
    const bar = await d.embedFont(await PT.fixture('Barlow-Regular.ttf'), { subset: true, customName: 'ABCDEF+Barlow-Regular' });
    const pg = d.addPage(PT.win.Array.of(400, 200));
    pg.drawText('The browser is the new print shop', { x: 20, y: 140, size: 16, font: await d.embedFont(L.StandardFonts.Helvetica) });
    pg.drawText('Barlow line of text', { x: 20, y: 80, size: 16, font: bar });
    d.setCreationDate(new PT.win.Date(PT.win.Date.UTC(2023, 0, 1) + (++PT._nonce) * 1000));
    return d.save();
  }
  /** Opens the editor on the line at a baseline, answering the font check with the closest font when it asks. */
  async function openAt(baseline, id) {
    const el = PT.SP.editor._.slots.get(PT.E.state.pages[0].id).el, z = PT.SP.editor.zoom, r = el.getBoundingClientRect();
    const init = { clientX: r.left + 60 * z, clientY: r.top + (200 - baseline - 5) * z, button: 0, bubbles: true, cancelable: true, pointerType: 'mouse', isPrimary: true, pointerId: id };
    el.dispatchEvent(new PT.win.PointerEvent('pointerdown', init));
    const got = await waitFor(() => doc().querySelector('.edit-run') || doc().querySelector('.sf-ov'), { timeout: 8000 });
    if (got.classList.contains('edit-run')) return got;
    [...doc().querySelectorAll('.sf-ov button')].find((b) => /closest/.test(b.textContent)).click();
    return waitFor(() => doc().querySelector('.edit-run'), { timeout: 8000 });
  }
  const spanOf = (text) => [...doc().querySelectorAll('.pv-textlayer span')].find((s) => s.textContent === text);
  const escape = (input) => input.dispatchEvent(new PT.win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

  describe('Slop PDF edit text in place', () => {
    it('an embedded run opens in the page\'s own face, on its line, on an opaque background', async () => {
      if (!PT.SP) await PT.boot();
      PT.reset();
      await PT.open(await twoLinePdf(), 'in-place.pdf');
      PT.A.openPage(PT.E.state.pages[0].id);
      await waitFor(() => spanOf('Barlow line of text'), { timeout: 8000 });
      PT.SP.editor.setTool('select');
      if (!PT.SP.editor.editText) PT.SP.editor.toggleEditText();
      const input = await openAt(80, 41);
      await sleep(100);
      const first = input.style.fontFamily.split(',')[0].replace(/["']/g, '').trim();
      let loaded = false;
      doc().fonts.forEach((f) => { if (f.family.replace(/["']/g, '') === first) loaded = true; });
      expect(loaded).toBe(true, 'the first family is the face pdf.js loaded for the page: ' + input.style.fontFamily);
      const bg = PT.win.getComputedStyle(input).backgroundColor;
      expect(/^rgb\(/.test(bg)).toBe(true, 'opaque background: ' + bg);
      const z = PT.SP.editor.zoom, ir = input.getBoundingClientRect(), sr = spanOf('Barlow line of text').getBoundingClientRect();
      expect(Math.abs(ir.left + 0.12 * 16 * z - sr.left) < 3).toBe(true, `text starts where the line does: ${ir.left} vs ${sr.left}`);
      expect(Math.abs((ir.top + ir.bottom) / 2 - (sr.top + sr.bottom) / 2) < 0.25 * 16 * z).toBe(true, `on the same line: ${ir.top}-${ir.bottom} vs ${sr.top}-${sr.bottom}`);
      escape(input);
    });
    it('a standard-font run is as wide as the PDF draws it', async () => {
      const input = await openAt(140, 43);
      await sleep(100);
      const z = PT.SP.editor.zoom, run = spanOf('The browser is the new print shop').getBoundingClientRect(), ir = input.getBoundingClientRect();
      const want = run.width + 0.24 * 16 * z; // the run box adds 0.12 em on each side
      expect(Math.abs(ir.width - want) / want < 0.05).toBe(true, `editor ${ir.width} px, line ${want} px`);
      escape(input);
    });
    it('typing past the end grows the box to the right (to the page edge) and keeps the text visible', async () => {
      const input = await openAt(140, 45);
      const w0 = input.getBoundingClientRect().width, page = PT.SP.editor._.slots.get(PT.E.state.pages[0].id).el.getBoundingClientRect();
      input.value = 'The browser is the new print shop, and more';
      input.dispatchEvent(new PT.win.Event('input', { bubbles: true }));
      const r1 = input.getBoundingClientRect();
      expect(r1.width > w0 * 1.15).toBe(true, `grew: ${w0} -> ${r1.width}`);
      expect(input.scrollWidth <= input.clientWidth + 1).toBe(true, 'no text hidden inside the box');
      input.value = 'x'.repeat(400);
      input.dispatchEvent(new PT.win.Event('input', { bubbles: true }));
      expect(input.getBoundingClientRect().right <= page.right + 2).toBe(true, 'stops at the page edge');
      input.value = 'Short';
      input.dispatchEvent(new PT.win.Event('input', { bubbles: true }));
      expect(Math.abs(input.getBoundingClientRect().width - w0) < 2).toBe(true, 'never narrower than the line it edits');
      escape(input);
      PT.SP.editor.toggleEditText();
    });
  });
})();
