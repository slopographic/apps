/* Slop PDF File ▸ Fonts…, the top-bar button: opens the shared Fonts panel (shared/fonts/panel.js) with the subset fonts of
   the document. A missing one offers Drop your own font and Use the closest font (Download only when the library lists the
   family). A closest font chosen there is kept on the file (f.fontMap), the first-edit prompt does not ask again for it, the
   panel reopens after it is dismissed, and a document with no subset fonts says so. Barlow is not installed in the tests. */
(function () {
  'use strict';
  const { describe, it, expect, waitFor } = SlopTest;
  const doc = () => PT.win.document;
  const rowOf = (family) => doc().querySelector(`.sf-row[data-family="${family}"]`);
  // the footer's Close (a missing family's "Download from the library" is a primary button too, and comes first)
  const closePanel = () => { const b = Array.from(doc().querySelectorAll('.sf-box .sf-foot button.pri')).find((x) => x.textContent === 'Close'); if (b) b.click(); };
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
    it('is on the top bar, and the panel reopens after it is dismissed', async () => {
      await openDoc(await PT.barlowPdf('Fonts one'), 'fonts-reopen.pdf');
      expect(!!doc().getElementById('btnFonts')).toBe(true);
      doc().getElementById('btnFonts').click();
      await waitFor(() => rowOf('Barlow'), { timeout: 8000 });
      closePanel();
      await waitFor(() => !doc().querySelector('.sf-ov'), { timeout: 3000 });
      doc().getElementById('btnFonts').click();
      await waitFor(() => rowOf('Barlow'), { timeout: 8000 });
      closePanel();
    });

    it('lists a subset the device lacks as missing, with Drop your own font and Use the closest font', async () => {
      await openDoc(await PT.barlowPdf('Fonts two'), 'fonts-missing.pdf');
      PT.A.openFonts();
      const row = await waitFor(() => rowOf('Barlow'), { timeout: 8000 });
      expect(row.textContent).toContain('Missing. It is not installed.');
      expect(!!row.querySelector('[data-how="file"]')).toBe(true);
      expect(!!row.querySelector('[data-how="closest"]')).toBe(true);
      closePanel();
    });

    it('a font embedded in full needs no answer, so the document is said to have no subset fonts', async () => {
      await openDoc(await PT.barlowPdf('Fonts three', { subset: false }), 'fonts-full.pdf');
      PT.A.openFonts();
      await waitFor(() => doc().body.textContent.includes("embeds no fonts"), { timeout: 8000 });
      expect(rowOf('Barlow')).toBe(null);
    });

    it('Use the closest font keeps the answer: the row is done, and the first edit does not ask again', async () => {
      await openDoc(await PT.barlowPdf('Fonts four'), 'fonts-closest.pdf');
      PT.A.openFonts();
      const row = await waitFor(() => rowOf('Barlow'), { timeout: 8000 });
      row.querySelector('[data-how="closest"]').click();
      await waitFor(() => rowOf('Barlow') && rowOf('Barlow').classList.contains('done'), { timeout: 4000 });
      expect(firstFile().fontMap.get('Barlow')).toBe(PT.win.SlopFontCatalog.closestFamily('Barlow'));
      closePanel();
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

    it('a document with no subset fonts says so', async () => {
      await openDoc(await PT.makePdf([{ text: 'Standard only' }]), 'fonts-none.pdf');
      PT.A.openFonts();
      await waitFor(() => doc().body.textContent.includes('embeds no fonts'), { timeout: 8000 });
    });
  });
})();
