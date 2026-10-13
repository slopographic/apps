/* Slop PDF Fonts (File ▸ Fonts…, the top-bar button): the fonts the document embeds with a status (embedded, available,
   missing); a missing font offers Drop your own and Use closest font (Download only when the library lists the family);
   an answer is kept on the file, the dialog reopens after it is dismissed, the first-edit prompt does not ask again for an
   answered family, and it still asks for an unanswered one. Barlow is not installed in the tests, so its subset is missing. */
(function () {
  'use strict';
  const { describe, it, expect, waitFor } = SlopTest;
  const doc = () => PT.win.document;
  const rowOf = (family) => doc().querySelector(`.pf-row[data-family="${family}"]`);
  const buttonIn = (el, label) => [...el.querySelectorAll('button')].find((b) => b.textContent.trim() === label);
  /** Closes the open dialog with its Close button. */
  const closeDialog = () => { const b = [...doc().querySelectorAll('.sui-dlg button')].find((x) => x.textContent.trim() === 'Close'); if (b) b.click(); };
  /** Opens a document with these bytes in an empty document. */
  async function openDoc(bytes, name) {
    if (!PT.SP) await PT.boot();
    PT.reset();
    await PT.open(bytes, name);
  }
  const firstFile = () => Array.from(PT.E.files.values())[0];
  /** Replaces the font-check prompt with a recorder for the duration of fn. */
  async function withPromptSpy(answer, fn) {
    const ask = PT.win.SlopFontCheck.ask, calls = [];
    PT.win.SlopFontCheck.ask = (needs, uses) => { calls.push(needs.map((n) => n.family)); return Promise.resolve(answer); };
    try { await fn(); } finally { PT.win.SlopFontCheck.ask = ask; }
    return calls;
  }

  describe('Slop PDF fonts', () => {
    it('is on the top bar and reopens after it is dismissed', async () => {
      await openDoc(await PT.barlowPdf('Fonts one'), 'fonts-reopen.pdf');
      expect(!!doc().getElementById('btnFonts')).toBe(true);
      doc().getElementById('btnFonts').click();
      await waitFor(() => rowOf('Barlow'), { timeout: 8000 });
      closeDialog();
      await waitFor(() => !doc().querySelector('.pf-dlg'), { timeout: 3000 });
      doc().getElementById('btnFonts').click();
      await waitFor(() => rowOf('Barlow'), { timeout: 8000 });
    });

    it('lists a subset the device lacks as missing, with Drop your own and Use closest font', async () => {
      await openDoc(await PT.barlowPdf('Fonts two'), 'fonts-missing.pdf');
      PT.A.openFonts();
      const row = await waitFor(() => rowOf('Barlow'), { timeout: 8000 });
      expect(row.dataset.status).toBe('missing');
      expect(!!buttonIn(row, 'Drop your own')).toBe(true);
      expect(!!buttonIn(row, 'Use closest font')).toBe(true);
      expect(row.querySelector('.pf-status').textContent).toBe('Missing');
      closeDialog();
    });

    it('a font embedded in full is embedded, with no actions', async () => {
      await openDoc(await PT.barlowPdf('Fonts three', { subset: false }), 'fonts-full.pdf');
      PT.A.openFonts();
      const row = await waitFor(() => rowOf('Barlow'), { timeout: 8000 });
      expect(row.dataset.status).toBe('embedded');
      expect(row.querySelectorAll('.pf-actions button').length).toBe(0);
      closeDialog();
    });

    it('Use closest font keeps the answer: the row is available, and the first edit does not ask again', async () => {
      await openDoc(await PT.barlowPdf('Fonts four'), 'fonts-closest.pdf');
      PT.A.openFonts();
      const row = await waitFor(() => rowOf('Barlow'), { timeout: 8000 });
      buttonIn(row, 'Use closest font').click();
      await waitFor(() => rowOf('Barlow') && rowOf('Barlow').dataset.status === 'available', { timeout: 4000 });
      expect(firstFile().fontMap.get('Barlow')).toBe(PT.win.SlopFontCatalog.closestFamily('Barlow'));
      closeDialog();
      const asked = await withPromptSpy(new PT.win.Map(), async () => {
        expect(await PT.SP.editor._.fontsReady(firstFile())).toBe(true);
      });
      expect(asked.length).toBe(0);
    });

    it('the first-edit prompt still asks for a missing font nobody has answered', async () => {
      await openDoc(await PT.barlowPdf('Fonts five'), 'fonts-prompt.pdf');
      const asked = await withPromptSpy(null, async () => {
        expect(await PT.SP.editor._.fontsReady(firstFile())).toBe(false);
      });
      expect(asked.length).toBe(1);
      expect(asked[0]).toEqual(['Barlow']);
    });

    it('a document with no embedded fonts says so', async () => {
      await openDoc(await PT.makePdf([{ text: 'Standard only' }]), 'fonts-none.pdf');
      PT.A.openFonts();
      await waitFor(() => [...doc().querySelectorAll('.pf-list p')].some((p) => p.textContent.includes('embeds no fonts')), { timeout: 8000 });
      closeDialog();
    });
  });
})();
