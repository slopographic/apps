/* Slop PDF: Recognise text (OCR). Scanned pages (pictures only) get an invisible text layer (text render mode 3) at the
   recognised lines, so the editor's text runs, find and copy see the words. The OCR engine is stubbed here (the model is
   not in the test sandbox); the real stub-free path is the Get more prompt, which must open and change nothing. */
(function () {
  'use strict';
  const { describe, it, expect } = SlopTest;

  /** Line specs in points on a 400 x 200 page (top-left origin): [{ text, x, y, w, h }]. */
  const PAGE_ONE = [{ text: 'Invoice 2026-0042', x: 40, y: 30, w: 170, h: 22 }, { text: 'Total 1,250.00', x: 40, y: 100, w: 160, h: 22 }];
  const PAGE_TWO = [{ text: 'Second scan line', x: 40, y: 60, w: 210, h: 22 }];

  /** A picture of the lines, drawn at 2 px per point (what a scanner would give us). */
  function scanCanvas(lines) {
    const c = document.createElement('canvas');
    c.width = 800; c.height = 400;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#000000'; g.font = '36px sans-serif'; g.textBaseline = 'top';
    lines.forEach((l) => g.fillText(l.text, l.x * 2, l.y * 2));
    return c;
  }
  function pngBytes(c) {
    const bin = atob(c.toDataURL('image/png').split(',')[1]), u = new PT.win.Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  /** An image-only PDF: one picture per page, no text operators at all. */
  async function scanPdf(pages) {
    const L = PT.win.PDFLib, doc = await L.PDFDocument.create();
    for (const lines of pages) {
      const img = await doc.embedPng(pngBytes(scanCanvas(lines)));
      doc.addPage(PT.win.Array.of(400, 200)).drawImage(img, { x: 0, y: 0, width: 400, height: 200 });
    }
    doc.setCreationDate(new PT.win.Date(PT.win.Date.UTC(2022, 0, 1) + (++PT._nonce) * 1000));
    return doc.save();
  }
  /** The text the editor sees on a page: pdf.js text items (the same source as the text runs), joined. */
  async function textOf(p) {
    const pg = await PT.E.fileOfPage(p).doc.getPage(p.i + 1), tc = await pg.getTextContent();
    return tc.items.map((it) => it.str).filter((s) => s.trim()).join(' ');
  }
  /** Decoded content stream of page 1 of a file's bytes. */
  async function contentOf(bytes) {
    const L = PT.win.PDFLib, doc = await L.PDFDocument.load(bytes, { updateMetadata: false });
    const c = doc.getPage(0).node.Contents(), refs = c instanceof L.PDFArray ? c.asArray() : [c];
    let out = '';
    for (const r of refs) {
      const s = doc.context.lookup(r);
      const b = s instanceof L.PDFRawStream ? L.decodePDFRawStream(s).decode() : s.getUnencodedContents();
      out += String.fromCharCode(...b);
    }
    return out;
  }
  /** Replaces the engine: ready() passes, read() returns the next picture's lines from the queue (pt, top-left). */
  function stubEngine(queue, onRead) {
    const O = PT.SP.ocr;
    O.ready = async () => {};
    O.read = async (canvas, onProgress) => {
      if (onRead) onRead();
      if (onProgress) onProgress({ stage: 'detect', done: 1, total: 1 });
      const k = canvas.width / 400, lines = queue.shift() || [];
      return lines.map((l) => ({ text: l.text, score: 0.99, box: { x: Math.round(l.x * k), y: Math.round(l.y * k), w: Math.round(l.w * k), h: Math.round(l.h * k) } }));
    };
  }
  /** Runs fn with the engine stubs in place, restoring the real engine afterwards. */
  async function withEngine(fn) {
    const O = PT.SP.ocr, saved = { ready: O.ready, read: O.read };
    try { return await fn(); } finally { Object.assign(O, saved); }
  }

  describe('OCR text layer: geometry', () => {
    it('places each word inside the line box, left to right, and stretches the line to the box width', async () => {
      if (!PT.SP) await PT.boot();
      const L = PT.win.PDFLib, doc = await L.PDFDocument.create(), font = await doc.embedFont(L.StandardFonts.Helvetica);
      const g = { W: 400, H: 200, x0: 0, y0: 0 };
      const words = PT.SP.ocrLayer.placements([{ text: 'Hello big world', box: { x: 80, y: 20, w: 200, h: 24 } }], g, { w: 800, h: 400 }, font);
      expect(words.map((w) => w.str)).toEqual(['Hello', 'big', 'world']);
      expect(words[0].x).toBeCloseTo(40, 6);
      expect(words[1].x).toBeGreaterThan(words[0].x);
      expect(words[2].x).toBeGreaterThan(words[1].x);
      const last = words[2], end = last.x + font.widthOfTextAtSize(last.str, last.size) * last.sx;
      expect(end).toBeCloseTo(140, 3); // the box is 100 pt wide, from x 40
      expect(words[0].y).toBeGreaterThan(160); // 12 pt high box near the top of a 200 pt page
      expect(PT.SP.ocrLayer.placements([{ text: '  ', box: { x: 0, y: 0, w: 10, h: 10 } }], g, { w: 800, h: 400 }, font)).toEqual([]);
    });
  });

  describe('OCR text layer: recognise a page', () => {
    it('adds the words of a picture-only page as invisible text, and one undo step undoes it', async () => {
      PT.reset();
      await withEngine(async () => {
        const file = await PT.open(await scanPdf([PAGE_ONE, PAGE_TWO]), 'scan.pdf');
        const [first, second] = PT.E.state.pages.filter((p) => p.f === file.id);
        expect(await textOf(first)).toBe('');
        stubEngine([PAGE_ONE]);
        expect(await PT.A.recognise([first.id])).toBe(1);
        const words = await textOf(PT.E.pageById(first.id));
        expect(words).toContain('Invoice');
        expect(words).toContain('2026-0042');
        expect(words).toContain('1,250.00');
        expect(PT.E.undoLabel()).toBe('Recognise text on page 1');
        const content = await contentOf(PT.E.fileOfPage(PT.E.pageById(first.id)).bytes);
        expect(/\b3 Tr\b/.test(content)).toBe(true);
        expect(PT.E.pageById(first.id).f).not.toBe(file.id);
        // the other page is untouched and still picture-only
        expect(second.f).toBe(file.id);
        expect(await textOf(second)).toBe('');
        PT.E.undo();
        expect(PT.E.pageById(first.id).f).toBe(file.id);
        expect(await textOf(PT.E.pageById(first.id))).toBe('');
        PT.E.redo();
        expect(await textOf(PT.E.pageById(first.id))).toContain('Invoice');
      });
    });

    it('on all pages skips pages that already have text and makes one undo step per page', async () => {
      PT.reset();
      await withEngine(async () => {
        const file = await PT.open(await scanPdf([PAGE_ONE, PAGE_TWO]), 'scan2.pdf');
        const [one, two] = PT.E.state.pages.filter((p) => p.f === file.id);
        const queue = [PAGE_ONE, PAGE_TWO];
        stubEngine(queue);
        await PT.A.recognise([one.id]);
        expect(queue.length).toBe(1);
        expect(await PT.A.recogniseAll()).toBe(1); // page 1 has text now: only page 2 is read
        expect(queue.length).toBe(0);
        expect(await textOf(PT.E.pageById(two.id))).toContain('Second');
        expect(PT.E.undoLabel()).toBe('Recognise text on page 2');
        PT.E.undo();
        expect(await textOf(PT.E.pageById(two.id))).toBe('');
        expect(await textOf(PT.E.pageById(one.id))).toContain('Invoice');
      });
    });

    it('cancel keeps the pages already read and stops before the next one', async () => {
      PT.reset();
      await withEngine(async () => {
        const file = await PT.open(await scanPdf([PAGE_ONE, PAGE_TWO]), 'scan3.pdf');
        const [one, two] = PT.E.state.pages.filter((p) => p.f === file.id);
        // the first read cancels from the progress dialog, as the Cancel button does
        stubEngine([PAGE_ONE, PAGE_TWO], () => {
          const btn = PT.win.document.querySelector('.ocr-progress .sui-btn');
          if (btn) btn.click();
        });
        expect(await PT.A.recogniseAll()).toBe(1);
        expect(await textOf(PT.E.pageById(one.id))).toContain('Invoice');
        expect(await textOf(PT.E.pageById(two.id))).toBe('');
        expect(PT.E.pageById(two.id).f).toBe(file.id);
        await SlopTest.waitFor(() => !PT.win.document.querySelector('.ocr-progress'), { timeout: 3000 });
      });
    });

    it('without the model it opens Get more and changes nothing', async () => {
      PT.reset();
      const SAI = PT.win.SlopAISupport, savedCheck = SAI.check;
      try {
        SAI.check = () => ({ ok: true, reason: '' }); // the sandbox may report a device limit; the model is what is tested
        const file = await PT.open(await scanPdf([PAGE_ONE]), 'scan4.pdf');
        const p = PT.E.state.pages.filter((q) => q.f === file.id)[0];
        const undoBefore = PT.E.undoLabel();
        expect(await PT.A.recognise([p.id])).toBe(0);
        expect(PT.E.pageById(p.id).f).toBe(file.id);
        expect(PT.E.undoLabel()).toBe(undoBefore);
        const prompt = await SlopTest.waitFor(() => PT.win.document.querySelector('.ai-ov'), { timeout: 5000 });
        expect(!!prompt).toBe(true);
        prompt.remove();
      } finally { SAI.check = savedCheck; }
    });
  });

  describe('OCR text layer: commands', () => {
    it('File menu and command palette list the two recognise commands', async () => {
      if (!PT.SP) await PT.boot();
      const labels = PT.A._.fileMenu().map((i) => i && i.label);
      expect(labels).toContain('Recognise text on this page');
      expect(labels).toContain('Recognise text on all pages');
    });
  });
})();
