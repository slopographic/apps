/* Slop PDF text selection bar: selecting a line of text shows the bar beside it, on screen, and it hides when the selection
   is cleared. Highlight adds one highlight over the line (one undo step). Escape dismisses the bar and Tab moves into it.
   Edit text, Find and Comment open their tools on the selection; Colour recolours the markup under it; Remove redacts the
   selected text (it is gone from the extracted text after apply, and the other page keeps its text) and can be undone. */
(function () {
  'use strict';
  const { describe, it, expect, waitFor } = SlopTest;
  const doc = () => PT.win.document;
  const bar = () => doc().querySelector('.selbar');
  const shown = () => !!bar() && !bar().hidden;
  const act = (id) => bar().querySelector('[data-act="' + id + '"]');
  const texthls = () => PT.E.state.pages.flatMap((p) => p.annots.filter((a) => a.type === 'texthl'));
  const spanFor = (text) => [...doc().querySelectorAll('.pv-textlayer span')].find((s) => s.textContent === text);

  async function openPage(id) {
    PT.A.openPage(id);
    await waitFor(() => doc().querySelector('.pv-page') && PT.SP.editor.pid === id, { timeout: 8000 });
  }
  /** A fixture document, opened on its first page in page view, with no selection. */
  async function fixture(pages) {
    if (!PT.SP) await PT.boot();
    PT.reset();
    PT.win.getSelection().removeAllRanges();
    await PT.open(await PT.makePdf(pages), 'sel.pdf');
    await openPage(PT.E.state.pages[0].id);
    await waitFor(() => spanFor(pages[0].text), { timeout: 8000 });
  }
  /** Selects the whole text-layer span with this text, as a mouse drag over the line would. */
  async function select(text) {
    await waitFor(() => spanFor(text), { timeout: 8000 });
    const span = spanFor(text), r = doc().createRange();
    r.selectNodeContents(span);
    const sel = PT.win.getSelection(); sel.removeAllRanges(); sel.addRange(r);
    await waitFor(() => shown(), { timeout: 3000 });
    return span;
  }
  const key = (target, k, init = {}) => target.dispatchEvent(new PT.win.KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true, cancelable: true }, init)));

  describe('Slop PDF text selection bar', () => {
    it('selecting a line shows the bar beside it, on screen; clearing the selection hides it', async () => {
      await fixture([{ text: 'Hello world', w: 300, h: 200 }]);
      const span = await select('Hello world');
      const r = bar().getBoundingClientRect(), s = span.getBoundingClientRect();
      expect(r.top >= 0 && r.bottom <= PT.win.innerHeight && r.left >= 0 && r.right <= PT.win.innerWidth).toBe(true);
      expect(r.bottom <= s.top + 1 || r.top >= s.bottom - 1).toBe(true);
      for (const id of ['highlight', 'underline', 'strike', 'copy', 'comment', 'edit', 'remove', 'replace', 'find']) expect(!!act(id)).toBe(true);
      PT.win.getSelection().removeAllRanges();
      await waitFor(() => !shown(), { timeout: 3000 });
    });

    it('Highlight adds one highlight whose rectangles cover the line, as one undo step', async () => {
      await fixture([{ text: 'Hello world', w: 300, h: 200 }]);
      const p = PT.E.state.pages[0], lines = await PT.E.pageTextLines(p);
      await select('Hello world');
      const before = texthls().length;
      act('highlight').click();
      await waitFor(() => texthls().length === before + 1, { timeout: 5000 });
      const a = texthls()[before], xs = a.pts.map((q) => q[0]), ys = a.pts.map((q) => q[1]), line = lines[0];
      expect(a.style).toBe('highlight');
      expect(a.pts.length).toBe(4);
      expect(Math.min(...ys) <= line.top + 0.1 && Math.max(...ys) >= line.bottom - 0.1).toBe(true);
      expect(Math.abs(Math.min(...xs) - 20) < 1.5).toBe(true);
      expect(Math.abs(Math.max(...xs) - (20 + PT.E.measure('Hello world', 'Helvetica', 18))) < 1.5).toBe(true);
      PT.A.undo();
      expect(texthls().length).toBe(before);
    });

    it('Underline and Strikethrough add their own styles over the same line', async () => {
      await fixture([{ text: 'Hello world', w: 300, h: 200 }]);
      await select('Hello world');
      act('underline').click();
      await waitFor(() => texthls().length === 1, { timeout: 5000 });
      expect(texthls()[0].style).toBe('underline');
      expect(texthls()[0].opacity).toBe(1);
      expect(!!doc().querySelector('.pv-svg .an-texthl line')).toBe(true);
      act('strike').click();
      await waitFor(() => texthls().length === 2, { timeout: 5000 });
      expect(texthls()[1].style).toBe('strike');
    });

    it('Escape hides the bar; Tab from the selection moves into it, and Escape inside it leaves', async () => {
      await fixture([{ text: 'Hello world', w: 300, h: 200 }]);
      await select('Hello world');
      key(doc().body, 'Tab');
      expect(doc().activeElement.dataset.act).toBe('highlight');
      key(doc().activeElement, 'Escape');
      expect(shown()).toBe(false);
      // selecting the same text again shows the bar again
      PT.win.getSelection().removeAllRanges();
      await select('Hello world');
      key(doc().body, 'Escape');
      expect(shown()).toBe(false);
    });

    it('Edit text opens the edit-text mode on the run under the selection; Find and Replace take the selected text', async () => {
      await fixture([{ text: 'Hello world', w: 300, h: 200 }]);
      await select('Hello world');
      act('edit').click();
      await waitFor(() => doc().querySelector('.edit-run'), { timeout: 5000 });
      expect(doc().querySelector('.edit-run').value).toBe('Hello world');
      expect(PT.SP.editor.editText).toBe(true);
      doc().querySelector('.edit-run').dispatchEvent(new PT.win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await select('Hello world');
      act('find').click();
      await waitFor(() => doc().querySelector('.find-input') && doc().querySelector('.find-input').value === 'Hello world', { timeout: 3000 });
      await waitFor(() => doc().querySelectorAll('.pv-hits rect').length > 0, { timeout: 5000 });
      await select('Hello world');
      act('replace').click();
      await waitFor(() => doc().querySelector('.find-dialog') && !doc().querySelector('.find-dialog').hidden, { timeout: 3000 });
      expect(doc().querySelector('.find-dialog .find-input').value).toBe('Hello world');
    });

    it('Comment opens the comment tool at the selection', async () => {
      await fixture([{ text: 'Hello world', w: 300, h: 200 }]);
      await select('Hello world');
      act('comment').click();
      await waitFor(() => doc().querySelector('.note-pop textarea'), { timeout: 3000 });
      expect(PT.SP.editor.tool).toBe('note');
    });

    it('Colour recolours the highlight under the selection, in place, and sets the next colour', async () => {
      await fixture([{ text: 'Hello world', w: 300, h: 200 }]);
      await select('Hello world');
      act('highlight').click();
      await waitFor(() => texthls().length === 1, { timeout: 5000 });
      bar().querySelector('.selbar-btn[data-act="colour"]').click();
      expect(bar().querySelector('.selbar-pop').hidden).toBe(false);
      bar().querySelector('.selbar-sw[aria-label="Red"]').click();
      await waitFor(() => texthls()[0].color === '#e0102f', { timeout: 3000 });
      expect(texthls().length).toBe(1);
      expect(PT.A.undo() != null).toBe(true);
      expect(texthls()[0].color).not.toBe('#e0102f');
    });

    it('Remove redacts the selected text: it is gone from the file after apply, the other page keeps its text, and undo brings the page back', async () => {
      await fixture([{ text: 'Hello world', w: 300, h: 200 }, { text: 'Keep me', w: 300, h: 200 }]);
      const E = PT.E;
      await select('Hello world');
      act('remove').click();
      await waitFor(() => doc().querySelector('.sui-dlg'), { timeout: 5000 });
      expect(doc().querySelector('.sui-dlg').textContent).toContain('removed from the file');
      doc().querySelector('.sui-dlg .sui-danger').click();
      await waitFor(() => E.state.pages[0].redacted, { timeout: 20000 });
      const out = await PT.read(await E.build());
      expect(out.pages[0].text.includes('Hello world')).toBe(false);
      expect(out.pages[1].text).toContain('Keep me');
      PT.A.undo();
      expect(!!E.state.pages[0].redacted).toBe(false);
    });
  });
})();
