/* Slop PDF: Recognise text (OCR). Scanned pages (pictures only) get an invisible text layer (text render mode 3) at the
   recognised lines, so the editor's text runs, find and copy see the words. The OCR engine is stubbed here (the model is
   not in the test sandbox); the real stub-free path is the Get more prompt, which must open and change nothing. */
(function () {
  'use strict';
  const { describe, it, expect } = SlopTest;

  /** Line specs in points on a 400 x 200 page (top-left origin): [{ text, x, y, w, h }]. */
  const PAGE_ONE = [{ text: 'Invoice 2026-0042', x: 40, y: 30, w: 170, h: 22 }, { text: 'Total 1,250.00', x: 40, y: 100, w: 160, h: 22 }];
  const PAGE_TWO = [{ text: 'Second scan line', x: 40, y: 60, w: 210, h: 22 }];
  /** One word alone on its line, 80 pt wide: its ink sits inside the box [36, 28, 104, 54] (points, top-left origin). */
  const WORD_ON_PAPER = [{ text: 'Invoice', x: 40, y: 30, w: 80, h: 22 }];
  const WORD_BOX = [36, 28, 104, 54];

  /** A picture of the lines, drawn at 2 px per point (what a scanner would give us). */
  function scanCanvas(lines, paper = '#ffffff') {
    const c = document.createElement('canvas');
    c.width = 800; c.height = 400;
    const g = c.getContext('2d');
    g.fillStyle = paper; g.fillRect(0, 0, c.width, c.height);
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
  async function scanPdf(pages, paper = '#ffffff') {
    const L = PT.win.PDFLib, doc = await L.PDFDocument.create();
    for (const lines of pages) {
      const img = await doc.embedPng(pngBytes(scanCanvas(lines, paper)));
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

  /** Opens the first line of a page for editing, as a press on its first word does; resolves to the run's input. */
  async function openFirstLine(p) {
    PT.A.openPage(p.id);
    await SlopTest.waitFor(() => PT.win.document.querySelector('.pv-textlayer span') && PT.SP.editor.pid === p.id, { timeout: 8000 });
    PT.SP.editor.setTool('select'); // an earlier test may have left another tool or edit mode on
    if (PT.SP.editor.editText) PT.SP.editor.toggleEditText();
    PT.SP.editor.toggleEditText();
    const el = PT.SP.editor._.slots.get(p.id).el, z = PT.SP.editor.zoom, r = el.getBoundingClientRect();
    // the first word starts 40 pt from the left, on the first line (30 to 52 pt from the top)
    el.dispatchEvent(new PT.win.PointerEvent('pointerdown', { clientX: r.left + 60 * z, clientY: r.top + 42 * z, button: 0, bubbles: true, cancelable: true, pointerId: 5, pointerType: 'mouse', isPrimary: true }));
    await SlopTest.waitFor(() => PT.win.document.querySelector('.edit-run'), { timeout: 5000 });
    return PT.win.document.querySelector('.edit-run');
  }
  /** Types value into an open run and presses Enter; resolves when the page has its new file. */
  async function applyLine(p, input, value) {
    const before = PT.E.pageById(p.id).f;
    input.value = value;
    input.dispatchEvent(new PT.win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await SlopTest.waitFor(() => PT.E.pageById(p.id).f !== before, { timeout: 8000 });
  }
  /** The picture of a page (2 px per point) inside a box in points: mean luma, count of dark pixels (luma under 100)
   * and mean darkness (0 for paper, 1 for black). */
  async function inkIn(p, [x0, y0, x1, y1]) {
    const c = await PT.E.renderToCanvas(PT.E.fileOfPage(p), p.i, 2);
    const d = c.getContext('2d').getImageData(x0 * 2, y0 * 2, (x1 - x0) * 2, (y1 - y0) * 2).data;
    let lum = 0, dark = 0, ink = 0;
    for (let i = 0; i < d.length; i += 4) {
      const l = (d[i] + d[i + 1] + d[i + 2]) / 3;
      lum += l; ink += (255 - l) / 255; if (l < 100) dark++;
    }
    const n = d.length / 4;
    return { lum: lum / n, dark, darkness: ink / n };
  }

  describe('OCR text layer: editing a recognised word', () => {
    it('an edit replaces the word in the page content: the old word is gone from the text, the new one is there', async () => {
      PT.reset();
      await withEngine(async () => {
        const file = await PT.open(await scanPdf([PAGE_ONE]), 'scan-edit.pdf');
        const first = PT.E.state.pages.filter((p) => p.f === file.id)[0];
        stubEngine([PAGE_ONE]);
        expect(await PT.A.recognise([first.id])).toBe(1);
        const input = await openFirstLine(first);
        expect(input.value).toBe('Invoice 2026-0042');
        await applyLine(first, input, input.value.replace('Invoice', 'Receipt')); // the run is the line's text
        const words = await textOf(PT.E.pageById(first.id));
        expect(words).not.toContain('Invoice');
        expect(words).toContain('Receipt');
        expect(words).toContain('2026-0042'); // the other words are kept
        expect(PT.E.pageById(first.id).annots.length).toBe(0); // replaced, not covered
        const content = await contentOf(PT.E.fileOfPage(PT.E.pageById(first.id)).bytes);
        expect(/\b3 Tr\b/.test(content)).toBe(true); // the layer is still invisible
        expect(/496E766F696365/i.test(content)).toBe(false); // no hex of "Invoice" left in the content
        PT.A.undo();
        await SlopTest.sleep(150);
        expect(await textOf(PT.E.pageById(first.id))).toContain('Invoice');
        PT.SP.editor.toggleEditText();
      });
    });

    it('paints the old word out with the paper colour round it, so no dark glyph pixels are left in its box', async () => {
      PT.reset();
      await withEngine(async () => {
        const grey = '#d8d8d8', file = await PT.open(await scanPdf([WORD_ON_PAPER], grey), 'scan-paint.pdf');
        const p = PT.E.state.pages.filter((q) => q.f === file.id)[0];
        stubEngine([WORD_ON_PAPER]);
        expect(await PT.A.recognise([p.id])).toBe(1);
        const before = await inkIn(p, WORD_BOX);
        expect(before.dark).toBeGreaterThan(200); // the scanned word: black glyph pixels
        const input = await openFirstLine(p);
        await applyLine(p, input, ''); // the word is deleted
        const after = await inkIn(PT.E.pageById(p.id), WORD_BOX);
        expect(after.dark).toBe(0);
        expect(before.darkness - after.darkness).toBeGreaterThan(0.05); // the mean darkness of the box falls
        expect(Math.abs(after.lum - 216)).toBeLessThan(6); // painted with the grey sampled round the word, not white
        expect(PT.E.undoLabel()).toBe('Edit text');
        PT.A.undo();
        await SlopTest.sleep(150);
        expect((await inkIn(PT.E.pageById(p.id), WORD_BOX)).dark).toBeGreaterThan(200); // one undo step brings the ink back
        PT.SP.editor.toggleEditText();
      });
    });

    it('draws the new text in Helvetica at the old word\'s place, as visible text that is still recognised', async () => {
      PT.reset();
      await withEngine(async () => {
        const file = await PT.open(await scanPdf([WORD_ON_PAPER]), 'scan-draw.pdf');
        const p = PT.E.state.pages.filter((q) => q.f === file.id)[0];
        stubEngine([WORD_ON_PAPER]);
        expect(await PT.A.recognise([p.id])).toBe(1);
        const before = await inkIn(p, WORD_BOX);
        const input = await openFirstLine(p);
        await applyLine(p, input, 'Paid');
        expect(await textOf(PT.E.pageById(p.id))).toBe('Paid');
        const after = await inkIn(PT.E.pageById(p.id), WORD_BOX);
        expect(after.dark).toBeGreaterThan(20); // the new word is dark on the page
        expect(after.dark).toBeLessThan(before.dark); // and it is less ink than the old word (four letters, not seven)
        const words = await PT.SP.ocrLayer.wordsAll(PT.E.fileOfPage(PT.E.pageById(p.id)).bytes);
        expect(words[0].map((w) => w.str).filter((t) => t)).toEqual(['Paid']); // a later edit finds it
        PT.SP.editor.toggleEditText();
      });
    });
  });

  describe('OCR model installed: ask to run', () => {
    it('after the model is stored, the install callback asks with three buttons, and Run on document runs recognition', async () => {
      PT.reset();
      if (!PT.SP) await PT.boot();
      const O = PT.SP.ocr, A = PT.A, G = PT.win.SlopAIGetMore, savedAll = A.recogniseAll;
      let installed = null, runs = 0;
      try {
        // the Get more dialog is stubbed: it "stores" the model and calls back, as it does after a download
        PT.win.SlopAIGetMore = { open: (id, opts) => { installed = opts.onInstalled; } };
        O.getModel();
        expect(typeof installed).toBe('function');
        A.recogniseAll = async () => { runs++; };
        installed();
        const dlg = await SlopTest.waitFor(() => PT.win.document.querySelector('.ocr-ask'), { timeout: 3000 });
        expect(dlg.querySelector('.sui-title').textContent).toBe('Run text recognition now?');
        const labels = [...dlg.querySelectorAll('.sui-foot .sui-btn')].map((b) => b.textContent);
        expect(labels).toEqual(['Not now', 'Run on document', 'Run on this page']);
        [...dlg.querySelectorAll('.sui-foot .sui-btn')].find((b) => b.textContent === 'Run on document').click();
        await SlopTest.waitFor(() => runs === 1, { timeout: 3000 });
        expect(runs).toBe(1);
        expect(PT.win.document.querySelector('.ocr-ask')).toBe(null);
      } finally {
        A.recogniseAll = savedAll;
        if (G) PT.win.SlopAIGetMore = G; else delete PT.win.SlopAIGetMore;
      }
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
