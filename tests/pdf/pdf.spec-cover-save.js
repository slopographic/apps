/* Slop PDF: a PDF does not leave the app with old text under covers without the person knowing. Every way out (Download,
   Save to Slop Drive, Send to / Convert through A.currentPdfBlob, Download selected pages, the assistant's export_pdf) asks
   once: "N edited lines still have their old text hidden in the file. Anyone can copy it." Save anyway keeps the old text
   in the file; Make those pages images makes the pages with covers image pages (no old text, the new text drawn in, one
   undo step) while the other pages keep their text; Cancel (or Escape) saves nothing. An old edit log whose whiteouts carry
   no mark still replays: they stay ordinary objects and are not counted.
   Covers: pdf/js/ui/cover-save.js, pdf/js/redact/apply.js, pdf/js/io/export.js, pdf/js/ui/exports.js, pdf/js/ui/main.js,
     pdf/js/ui/ai-commands.js, pdf/js/io/edit-log.js, pdf/js/editor/edit-text.js, pdf/js/core/layers.js */
(function () {
  'use strict';
  const { describe, it, expect, waitFor, sleep } = SlopTest;
  const doc = () => PT.win.document;
  const page = (i = 0) => PT.E.state.pages[i];
  let restore = null, cap = null, made = null;
  /** Counts the save questions shown while fn runs. */
  async function asked(fn) {
    const UI = PT.win.SlopUI, dialog = UI.dialog;
    let n = 0;
    UI.dialog = function (o) { if (/cover-save/.test(o.cls || '')) n++; return dialog.apply(this, arguments); };
    try { await fn(); } finally { UI.dialog = dialog; }
    return n;
  }

  describe('Slop PDF: a save with old text under covers asks first', () => {
    it('Download asks once, in plain words, keyboard first; Escape and Cancel save nothing', async () => {
      await SE.open(await CV.pdf(), 'cover-save.pdf');
      restore = CV.force();
      made = await CV.editLine('Edited line');
      cap = PT.captureDownloads();
      const before = CV.json(PT.E.state);
      const run = PT.A.download();
      const d = await CV.dialog();
      expect(d.querySelector('.sui-title').textContent).toBe('Old text is still in the file');
      expect(d.querySelector('.cover-warn').textContent).toBe('1 edited line still has its old text hidden in the file. Anyone can copy it.');
      expect(d.querySelector('.cover-images').textContent).toContain('will no longer be selectable');
      expect([...d.querySelectorAll('.sui-btn')].map((b) => b.textContent)).toEqual(['Cancel', 'Save anyway', 'Make those pages images']);
      await waitFor(() => doc().activeElement && doc().activeElement.textContent === 'Make those pages images', { timeout: 2000 });
      d.dispatchEvent(new PT.win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      expect(await run).toBe(null, 'Escape is Cancel');
      await waitFor(() => !doc().querySelector('.sui-dlg.cover-save'), { timeout: 3000 });
      expect(cap.list.length).toBe(0, 'nothing downloaded');
      expect(CV.json(PT.E.state)).toBe(before, 'nothing changed');
      const n = await asked(async () => { const r = PT.A.extract([page(0).id, page(1).id]); await CV.choose('Cancel'); expect(await r).toBe(null); });
      expect(n).toBe(1);
      expect(cap.list.length).toBe(0);
    }, { timeout: 60000 });

    it('Save to Slop Drive, Send to and Convert (A.currentPdfBlob) ask too; Cancel stops them without an error', async () => {
      let err = null;
      const blob = PT.A.currentPdfBlob().catch((e) => { err = e; });
      await CV.choose('Cancel');
      await blob;
      expect(!!(err && err.cancelled)).toBe(true, 'a cancelled save: ' + err);
      if (PT.win.SlopHub) {
        const r = PT.A.saveToDrive();
        await CV.choose('Cancel');
        expect(await r).toBe(null);
        await sleep(50);
        expect(doc().querySelector('.sui-dlg')).toBe(null, 'no error dialog after a cancel');
        const send = PT.A.sendItems().find((x) => x && x.plain && x.act); // File ▸ Send to ▸ <app>
        if (send) {
          send.act();
          await CV.choose('Cancel');
          await waitFor(() => /Could not send: Cancelled\. Nothing was saved\./.test((doc().querySelector('.sui-toast') || {}).textContent || ''), { timeout: 3000 });
        }
      }
      const C = PT.win.SlopCmd;
      await C.prepare();
      expect((await C.state()).pageList[0].additions).toEqual(['text: Edited line'], 'the assistant sees the edit, not its cover');
      const ai = C.exec('pdf.ai.export-pdf', { to: 'download' });
      await CV.choose('Cancel');
      expect((await ai).value).toMatch(/^Not saved/);
      expect(cap.list.length).toBe(0);
    }, { timeout: 60000 });

    it('Save anyway keeps the old text in the saved file (and asks only once)', async () => {
      const n = await asked(async () => { const r = PT.A.download(); await CV.choose('Save anyway'); await r; });
      expect(n).toBe(1);
      expect(cap.list.length).toBe(1);
      const texts = await CV.texts(cap.list[0].blob);
      expect(texts[0]).toContain(CV.LINE);
      expect(texts[0]).toContain('Edited line');
      expect(texts[1]).toBe('Other page');
      cap.list.length = 0;
    }, { timeout: 60000 });

    it('Make those pages images: the saved PDF has no old text, shows the new one, and the other page keeps its text', async () => {
      const f0 = page(0).f, f1 = page(1).f;
      const run = PT.A.download();
      await CV.choose('Make those pages images');
      await run;
      await waitFor(() => cap.list.length === 1, { timeout: 30000 });
      const bytes = await PT.bytesOf(cap.list[0].blob), texts = await CV.texts(cap.list[0].blob);
      expect(texts[0]).toBe('', 'page 1 is an image: no text, old or new');
      expect(texts[1]).toBe('Other page', 'page 2 stays vector');
      expect(page(0).imaged).toBe(true);
      expect(page(0).f).not.toBe(f0);
      expect(page(1).f).toBe(f1);
      expect(page(0).annots.filter((a) => CV.isCover(a) || a.type === 'text').length).toBe(0, 'drawn into the picture');
      // the picture: white where the old line ran past the new text, ink where the new text is (page points, y from the top)
      const c = await PT.render(bytes, 0, 2), inked = (x0, x1, y0, y1) => {
        const px = c.getContext('2d').getImageData(x0 * 2, y0 * 2, (x1 - x0) * 2, (y1 - y0) * 2).data;
        let n = 0; for (let i = 0; i < px.length; i += 4) if (Math.max(px[i], px[i + 1], px[i + 2]) < 120) n++;
        return n;
      };
      expect(inked(170, 300, 49, 62)).toBe(0, 'the old text is gone');
      expect(inked(40, 120, 47, 62) > 20).toBe(true, 'the new text is in the picture');
      expect(PT.A.coveredPages(PT.E.state.pages).length).toBe(0);
      PT.A.undo();
      expect(page(0).f).toBe(f0);
      expect(page(0).annots.map((a) => a.id)).toEqual([made.cover.id, made.text.id]);
      cap.list.length = 0;
    }, { timeout: 90000 });

    it('an old edit log with plain whiteouts still replays: they stay ordinary objects, and only new covers are counted', async () => {
      restore();
      cap.list.length = 0;
      const bytes = await CV.pdf(), E = PT.E;
      await SE.open(bytes, 'old-log.pdf');
      const f = E.fileOfPage(page(0));
      // what Edit text wrote before covers were marked: a plain whiteout over the paragraph's first line, the new text on it
      CV.Ed().addAnnot({ id: 'oldw', type: 'whiteout', rot: 0, cx: 110, cy: 156, w: 150, h: 14, fill: '#ffffff', opacity: 1 }, 'Edit text');
      CV.Ed().addAnnot(SE.textAnnot('oldt', 'Old edit', 110, 156), 'Edit text');
      const rec = await waitFor(async () => { const r = await PT.U.idb.get('edits/' + f.fp); return r && r.entries.length === 2 ? r : null; }, { timeout: 10000 });
      expect(rec.entries.length).toBe(2);
      PT.reset();
      const again = PT.open(bytes, 'old-log.pdf');
      await waitFor(() => [...doc().querySelectorAll('.sui-dlg')].some((x) => x.textContent.includes('Saved edits found')), { timeout: 20000 });
      [...doc().querySelectorAll('.sui-dlg .sui-btn')].find((x) => x.textContent === 'Replay').click();
      await again;
      expect(page(0).annots.map((a) => a.id)).toEqual(['oldw', 'oldt']);
      PT.A.openPage(page(0).id);
      await waitFor(() => CV.Ed().pid === page(0).id && SE.elOf('oldw') && doc().querySelector('.pv-textlayer span') && !doc().querySelector('.sui-back'), { timeout: 20000 });
      CV.S().pageEl.setPointerCapture = () => {}; CV.S().pageEl.releasePointerCapture = () => {};
      expect(CV.hit(SE.elOf('oldw'))).toBe(true, 'the old whiteout is an object as before');
      CV.Ed().select('oldw');
      expect(CV.Ed().selId).toBe('oldw');
      PT.SP.dock.refresh();
      expect(!!doc().querySelector('#dock-layers .lyr[data-aid="oldw"]')).toBe(true);
      CV.Ed().select(null);
      const quiet = await asked(async () => { await PT.A.download(); });
      expect(quiet).toBe(0, 'plain whiteouts are not counted');
      expect(cap.list.length).toBe(1);
      cap.list.length = 0;
      // a new edit's cover is marked, and it is the one the save counts
      restore = CV.force();
      const now = await CV.editLine('New edit');
      expect(CV.isCover(now.cover)).toBe(true);
      const run = PT.A.download();
      const d = await CV.dialog();
      expect(d.querySelector('.cover-warn').textContent).toBe('1 edited line still has its old text hidden in the file. Anyone can copy it.');
      await CV.choose('Cancel');
      await run;
      restore(); cap.restore();
    }, { timeout: 90000 });
  });
})();
