/* Slop PDF: Edit text takes the old text out of files that real producers make (tests/pdf/strip-fixtures.js): text in a
   Form XObject (the whole page wrapped in one, a form two pages share, a form drawn twice on a page, four forms deep), in
   a Type 3 font, in Type 0 fonts with an embedded and with a predefined CMap, and in fonts with no Widths. For each, a line
   edited in Lines mode and a paragraph in Paragraphs mode: no cover is made, the saved page has the new text and not the
   old, and everything else on it (and on the other page that draws the form) is where it was, pixel for pixel outside the
   edited lines. A bold word whose next run starts a hair inside its box (kerned back under it) is taken out too: the check
   no longer takes that run for text left behind. Clipping text in a form is still covered, in the colour the form paints under it. */
// Covers: pdf/js/core/content-glyphs.js, pdf/js/core/content-strip.js, pdf/js/core/content-cmap.js, pdf/js/core/content-fonts.js,
//   pdf/js/core/content-res.js, pdf/js/core/content-forms.js, pdf/js/editor/text-strip.js, pdf/js/core/content-fills.js
(function () {
  'use strict';
  const { describe, it, expect, waitFor, sleep } = SlopTest;
  const doc = () => PT.win.document, Ed = () => PT.SP.editor, S = () => PT.SP.editor._;
  const H = 792, A = 690, B = 674;

  /** pdf.js's text items of page i of bytes: { s, x, y, w }. */
  async function items(bytes, i) {
    const lib = await PT.E.pdfjs(), d = await lib.getDocument(PT.E.docParams(new PT.win.Uint8Array(bytes))).promise;
    const tc = await (await d.getPage(i + 1)).getTextContent();
    await d.destroy();
    return tc.items.filter((it) => it.str && it.str.trim()).map((it) => ({ s: it.str, x: it.transform[4], y: it.transform[5], w: it.width }));
  }
  const textOf = (list) => list.map((it) => it.s).join(' ');
  const count = (text, s) => text.split(s).length - 1;
  /** Opens a fixture of a kind on page n and waits for its text layer. */
  async function open(kind, n = 0) {
    if (!PT.SP) await PT.boot();
    PT.reset();
    PT.win.getSelection().removeAllRanges();
    const fx = await window.StripFixtures.make(PT.win.PDFLib, kind, String(++PT._nonce));
    const f = await PT.open(fx.bytes, kind + '.pdf'), p = PT.E.state.pages[n], word = fx.text.a.split(' ')[0];
    PT.A.openPage(p.id);
    await waitFor(() => Ed().pid === p.id && [...doc().querySelectorAll('.pv-textlayer span')].some((s) => s.textContent.includes(word)), { timeout: 15000 });
    Ed().setTool('select');
    return { fx, f, p, before: await items(fx.bytes, n) };
  }
  /** Lines mode: the run under a page-space box (from the top) gets new text. */
  async function editLine(p, box, text) {
    if (!Ed().editText) Ed().toggleEditText();
    Ed().setEditTextMode('lines');
    await Ed().editSelectionRun(p, box);
    const input = await waitFor(() => doc().querySelector('.edit-run'), { timeout: 10000 });
    input.value = text;
    input.dispatchEvent(new PT.win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await waitFor(() => PT.E.pageById(p.id).annots.some((a) => a.type === 'text'), { timeout: 15000 });
    Ed().toggleEditText();
  }
  /** Paragraphs mode: the paragraph under a page point gets new text; the selection is ready to take it off. */
  async function editPara(p, x, y, text) {
    Ed().setEditTextMode('paragraphs');
    if (!Ed().editText) Ed().toggleEditText();
    const el = S().slots.get(p.id).el, z = Ed().zoom, rc = el.getBoundingClientRect(), cx = rc.left + x * z, cy = rc.top + y * z;
    const ev = (type) => new PT.win.PointerEvent(type, { clientX: cx, clientY: cy, button: 0, bubbles: true, cancelable: true, pointerId: 7, pointerType: 'mouse', isPrimary: true });
    el.dispatchEvent(ev('pointerdown')); PT.win.dispatchEvent(ev('pointerup'));
    const sel = await waitFor(() => (S().para.sel && S().para.sel.model ? S().para.sel : null), { timeout: 15000 });
    expect(sel.blocks[0].lines.length).toBe(2, 'the paragraph of lines a and b');
    expect(!!sel.to).toBe(true, 'its text can be taken out of the content');
    S().para.edit();
    const box = await waitFor(() => doc().querySelector('.para-edit'), { timeout: 8000 });
    box.focus(); doc().execCommand('selectAll'); doc().execCommand('insertText', false, text);
    box.dispatchEvent(new PT.win.KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true }));
    await waitFor(() => PT.E.pageById(p.id).annots.some((a) => a.type === 'para'), { timeout: 15000 });
    S().para.clear(); Ed().setEditTextMode('lines'); Ed().toggleEditText();
  }
  /** The rows of a canvas outside the bands [y0, y1] (page space from the top, 1 px per point) that differ. */
  function changedRows(a, b, bands) {
    const da = a.getContext('2d').getImageData(0, 0, a.width, a.height).data, db = b.getContext('2d').getImageData(0, 0, b.width, b.height).data, out = [];
    for (let y = 0; y < a.height; y++) {
      if (bands.some((r) => y >= r[0] && y <= r[1])) continue;
      for (let x = 0, i = y * a.width * 4; x < a.width; x++, i += 4) if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 30) { out.push(y); break; }
    }
    return out;
  }
  /** After an edit of lines `gone` (baselines ys) on page n: no cover, the page is a derived copy, and the saved file has the
   * new text once, the old words nowhere on that page (but once more where a second Do draws them), everything else in place. */
  async function check(o, n, gone, ys, text, again) {
    const p = PT.E.state.pages[n];
    expect(p.annots.filter((a) => a.type === 'whiteout').length).toBe(0, 'nothing is painted over the old text');
    expect(PT.E.files.get(p.f).derived.from).toBe(o.f.id, 'the text was taken out of a copy of the file');
    const bytes = await PT.E.build(), after = await items(bytes, n), all = textOf(after);
    expect(count(all.replace(/\s+/g, ' '), text)).toBe(1, all);
    gone.forEach((s) => s.split(' ').filter((w) => w.length > 2).forEach((w) => expect(count(all, w)).toBe(again ? 1 : 0, w + ': ' + all)));
    const edited = (it) => ys.some((y) => Math.abs(it.y - y) < 0.5) && gone.some((s) => s.includes(it.s.trim()));
    const moved = o.before.filter((it) => !edited(it) && !after.some((a) => a.s === it.s && Math.abs(a.x - it.x) < 0.5 && Math.abs(a.y - it.y) < 0.5));
    expect(moved.map((it) => it.s)).toEqual([], 'every other line is where it was');
    const bands = ys.map((y) => [H - y - 16, H - y + 7]);
    expect(changedRows(await PT.render(o.fx.bytes, n, 1), await PT.render(bytes, n, 1), bands)).toEqual([], 'the page is unchanged outside the edited lines');
    return bytes;
  }

  describe('Slop PDF: Edit text takes the old text out of forms and hard fonts', () => {
    ['wrapped', 'twice', 'nested', 'type3', 'cmap', 'ucs2', 'nowidths'].forEach((kind) => {
      it(kind + ', Lines: the edited line leaves the content; no cover', async () => {
        const o = await open(kind), t = o.fx.text;
        await editLine(o.p, { x0: 76, y0: H - A - 8, x1: 120, y1: H - A + 1 }, 'Brand new line');
        await check(o, 0, [t.a], [A], 'Brand new line', kind === 'twice');
      }, { timeout: 90000 });
      it(kind + ', Paragraphs: the edited paragraph leaves the content; no cover', async () => {
        const o = await open(kind), t = o.fx.text;
        await editPara(o.p, 80, H - A - 4, 'Brand new paragraph.');
        await check(o, 0, [t.a, t.b], [A, B], 'Brand new paragraph.', kind === 'twice');
      }, { timeout: 90000 });
    });

    ['lines', 'paragraphs'].forEach((mode) => {
      it('a form two pages draw, ' + mode + ': page 1 loses the text, page 2 is as it was (text and pixels)', async () => {
        const o = await open('shared'), t = o.fx.text, two = await items(o.fx.bytes, 1);
        if (mode === 'lines') await editLine(o.p, { x0: 76, y0: H - A - 8, x1: 120, y1: H - A + 1 }, 'Brand new line');
        else await editPara(o.p, 80, H - A - 4, 'Brand new paragraph.');
        const bytes = await check(o, 0, mode === 'lines' ? [t.a] : [t.a, t.b], mode === 'lines' ? [A] : [A, B], mode === 'lines' ? 'Brand new line' : 'Brand new paragraph.');
        expect(await items(bytes, 1)).toEqual(two, 'page 2 reads as before');
        expect(changedRows(await PT.render(o.fx.bytes, 1, 1), await PT.render(bytes, 1, 1), [])).toEqual([], 'page 2 looks as before');
      }, { timeout: 90000 });
    });

    it('a bold word in a line whose next run is kerned back under it: taken out, the run after it stays (Lines)', async () => {
      const o = await open('kern'), bold = o.before.find((it) => it.s === 'bold');
      await editLine(o.p, { x0: bold.x + 2, y0: H - A - 8, x1: bold.x + bold.w - 2, y1: H - A + 1 }, 'plain');
      const p = PT.E.state.pages[0];
      expect(p.annots.filter((a) => a.type === 'whiteout').length).toBe(0, 'no cover');
      const after = await items(await PT.E.build(), 0), rest = o.before.find((it) => it.s.includes('world'));
      expect(after.some((it) => it.s === 'bold')).toBe(false);
      expect(after.some((it) => it.s === rest.s && Math.abs(it.x - rest.x) < 0.5)).toBe(true, 'the kerned run keeps its place');
    }, { timeout: 90000 });

    it('clipping text in a form is still covered, in the colour the form paints under it (the canvas cannot be read)', async () => {
      const o = await open('clip'), readable = S().canvasReadable;
      S().canvasReadable = () => false;
      try {
        if (!Ed().editText) Ed().toggleEditText();
        Ed().setEditTextMode('lines');
        await Ed().editSelectionRun(o.p, { x0: 76, y0: H - A - 8, x1: 120, y1: H - A + 1 });
        const input = await waitFor(() => doc().querySelector('.edit-run'), { timeout: 10000 });
        input.value = 'Covered, not removed';
        input.dispatchEvent(new PT.win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        const cover = await waitFor(() => PT.E.state.pages[0].annots.find((a) => a.type === 'whiteout'), { timeout: 15000 });
        expect(PT.E.state.pages[0].f).toBe(o.f.id, 'the content is not rewritten');
        const rgb = [1, 3, 5].map((i) => parseInt(cover.fill.slice(i, i + 2), 16));
        expect(rgb.every((v, i) => Math.abs(v - [235, 242, 255][i]) <= 4)).toBe(true, 'the form\'s paper colour, not white: ' + cover.fill);
      } finally { S().canvasReadable = readable; Ed().toggleEditText(); await sleep(30); }
    }, { timeout: 90000 });
  });
})();
