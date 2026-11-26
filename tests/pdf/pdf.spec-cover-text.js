/* Slop PDF: old text an edit could not take out of the page, hidden under its cover, is gone everywhere inside the app.
   Find (the search, the bar's count) does not find it, the selectable text layer has no spans for it (a drag across the
   page skips it, the layer is built again when a cover comes or goes), the block copy tool does not copy it, Redact ▸ find
   does not find it, and Extract text and Extract all (text and SVG pages) leave it out while keeping the new text drawn over
   the cover. A cover Replace all put over one word hides that word only: the rest of its line is still found and selectable.
   The cover path is forced (cover.helpers.js CV.force).
   Covers: pdf/js/core/covered.js, pdf/js/find/search.js, pdf/js/editor/textlayer.js, pdf/js/editor/block-copy.js,
     pdf/js/redact/find.js, pdf/js/io/convert.js, pdf/js/ui/exports.js, pdf/js/io/extract-more.js */
(function () {
  'use strict';
  const { describe, it, expect, waitFor, sleep } = SlopTest;
  const doc = () => PT.win.document;
  const page = () => PT.E.state.pages[0];
  const F = () => PT.win.SlopPdfFind;
  const found = async (q) => (await F().search(q, { caseSensitive: false, wholeWord: false })).length;
  const redactFound = async (q) => (await PT.SP.redact.search({ text: q })).length;
  /** The spans of page 1's text layer, once it is built for the page's covers as they are now. */
  const spans = (ok) => waitFor(() => {
    const l = CV.S().slots.get(page().id).layer.querySelector('.pv-textlayer'), all = l ? [...l.querySelectorAll('span')].map((s) => s.textContent) : [];
    return all.length && ok(all.join('|')) ? all : null;
  }, { timeout: 8000 });
  let restore = null;

  describe('Slop PDF: old text under a cover is gone inside the app', () => {
    it('Find does not find or count it; the rest of the document still is', async () => {
      await SE.open(await CV.pdf(), 'cover-text.pdf');
      expect(await found('print shop')).toBe(1, 'found before the edit');
      restore = CV.force();
      const made = await CV.editLine('Hi');
      expect(CV.isCover(made.cover)).toBe(true);
      expect(await found('print shop')).toBe(0, 'the old line is under its cover');
      expect(await found('browser')).toBe(0);
      expect(await found('paragraph')).toBe(1);
      expect(await found('Other page')).toBe(1);
      F().open('print shop');
      await waitFor(() => doc().querySelector('.find-count').textContent === 'No results', { timeout: 8000 });
      expect(doc().querySelectorAll('.pv-hits rect').length).toBe(0, 'no highlight over the cover');
      F().close();
    }, { timeout: 60000 });

    it('the text layer has no spans for it: a drag across the page skips it; undo brings it back', async () => {
      const all = await spans((t) => !/print shop/.test(t));
      expect(all.some((t) => /A paragraph/.test(t))).toBe(true, 'the visible text is still there: ' + all.join('|'));
      const l = CV.S().slots.get(page().id).layer.querySelector('.pv-textlayer'), sel = PT.win.getSelection(), r = doc().createRange();
      r.selectNodeContents(l); sel.removeAllRanges(); sel.addRange(r);
      const got = sel.toString();
      expect(/print shop|browser/.test(got)).toBe(false, 'the selection skips it: ' + got);
      expect(/A paragraph of two lines/.test(got)).toBe(true);
      sel.removeAllRanges();
      PT.A.undo();
      await spans((t) => /print shop/.test(t));
      PT.A.redo();
      await spans((t) => !/print shop/.test(t));
    }, { timeout: 60000 });

    it('the block copy tool does not copy it', async () => {
      const Ed = CV.Ed(), S = CV.S(), win = PT.win, nav = win.navigator, had = Object.getOwnPropertyDescriptor(nav, 'clipboard');
      let copied = null;
      Object.defineProperty(nav, 'clipboard', { configurable: true, value: { writeText: (t) => { copied = t; return Promise.resolve(); } } });
      try {
        Ed.setTool('block');
        const r = S.pageEl.getBoundingClientRect(), ev = (type, x, y) => new win.PointerEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true, pointerId: 1 });
        S.pageEl.dispatchEvent(ev('pointerdown', r.left + 2, r.top + 2));
        win.dispatchEvent(ev('pointermove', r.right - 2, r.bottom - 2));
        win.dispatchEvent(ev('pointerup', r.right - 2, r.bottom - 2));
        await waitFor(() => copied !== null, { timeout: 3000 });
        expect(/print shop|browser/.test(copied)).toBe(false, 'copied: ' + copied);
        expect(/paragraph/.test(copied)).toBe(true, 'copied: ' + copied);
      } finally {
        if (had) Object.defineProperty(nav, 'clipboard', had); else delete nav.clipboard;
        Ed.setTool('select');
      }
    }, { timeout: 60000 });

    it('Redact ▸ find does not find it', async () => {
      expect(await redactFound('print shop')).toBe(0);
      expect(await redactFound('paragraph')).toBe(1);
      expect(await redactFound('Other page')).toBe(1);
    }, { timeout: 60000 });

    it('Extract text leaves it out and keeps the new text drawn over its cover', async () => {
      const txt = await PT.A.extractText();
      PT.closeDialogs();
      expect(typeof txt).toBe('string');
      expect(/print shop|browser/.test(txt)).toBe(false, txt);
      expect(/\bHi\b/.test(txt)).toBe(true, 'the new text: ' + txt);
      expect(/A paragraph of two lines/.test(txt) && /Other page/.test(txt)).toBe(true, txt);
    }, { timeout: 60000 });

    it('Extract all leaves it out of the pages\' text and SVG pages', async () => {
      const res = await PT.SP.assets.collect({ text: 'both', pages: 'svg' });
      const get = (p) => { const e = res.entries.find((x) => x.path === p); return e ? new TextDecoder().decode(e.data) : ''; };
      for (const p of ['text/page-01.txt', 'text/page-01.md', 'pages/page-01.svg']) {
        const t = get(p);
        expect(/paragraph/.test(t)).toBe(true, p + ' has the visible text');
        expect(/print shop|browser/.test(t)).toBe(false, p + ': ' + t.slice(0, 400));
        expect(/\bHi\b/.test(t)).toBe(true, p + ' has the new text');
      }
      expect(/Other page/.test(get('text/page-02.txt'))).toBe(true);
    }, { timeout: 60000 });

    it('a cover Replace all put over one word hides that word only', async () => {
      F().openReplace('paragraph', { caseSensitive: false, wholeWord: false });
      await waitFor(() => doc().querySelectorAll('.find-rlist li').length === 1, { timeout: 5000 });
      doc().querySelector('.find-modal input[aria-label="Replace with"]').value = 'note';
      doc().querySelector('.find-go').click();
      await waitFor(() => page().annots.find((a) => a.type === 'text' && a.text === 'note'), { timeout: 8000 });
      const cancel = doc().querySelector('.find-modal:not([hidden]) .find-cancel'); if (cancel) cancel.click();
      expect(await found('paragraph')).toBe(0, 'the replaced word is under its cover');
      expect(await found('of two lines')).toBe(1, 'the rest of its line is still found');
      expect(await redactFound('paragraph')).toBe(0);
      const all = await spans((t) => !/paragraph/.test(t));
      expect(all.some((t) => /of two lines/.test(t))).toBe(true, 'the rest of the line is still selectable: ' + all.join('|'));
      restore();
      await sleep(10);
    }, { timeout: 60000 });
  });
})();
