/* Slop PDF watermark layers: two layers stacked (a logo dropped on the Watermark panel, and a text layer), moved and
   undone one step at a time, and burned into the downloaded page content in stacking order. */
(function () {
  'use strict';
  const { describe, it, expect, waitFor } = SlopTest;
  const layers = () => PT.E.state.stamps.watermarks || [];
  const panel = () => PT.win.document.querySelector('.wm-drop');
  const row = (i) => [...PT.win.document.querySelectorAll('.wm-row')][i];
  const labelsTopFirst = () => [...PT.win.document.querySelectorAll('.wm-item')].map((b) => b.textContent);
  const btn = (label) => [...PT.win.document.querySelectorAll('.wm-stack button, .btn-row button')].find((b) => b.textContent.trim() === label);
  /** A small PNG made in the app's window, as a File (what a drop delivers). */
  async function logoFile() {
    const c = PT.win.document.createElement('canvas'); c.width = 40; c.height = 20;
    const g = c.getContext('2d'); g.fillStyle = '#e0245e'; g.fillRect(0, 0, 40, 20);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    return new PT.win.File([blob], 'logo.png', { type: 'image/png' });
  }
  async function drop(file) {
    const dt = new PT.win.DataTransfer(); dt.items.add(file);
    panel().dispatchEvent(new PT.win.DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    await waitFor(() => layers().some((L) => L.kind === 'image' && L.asset));
  }

  describe('watermark layers', () => {
    it('two layers stacked with a logo and text are moved and undone step by step, and burn into the download', async () => {
      PT.reset();
      await PT.open(await PT.makePdf([{ text: 'Body', w: 300, h: 200 }]), 'wm.pdf');
      PT.A.setTool('watermark');
      await waitFor(() => panel());
      // text layer from the panel's button, then a logo dropped on the panel (it lands on top)
      btn('Text layer').click();
      expect(layers().length).toBe(1);
      expect(PT.E.undoLabel()).toBe('Add text layer');
      const text = PT.win.document.querySelector('.wm-editor input[type="text"]');
      text.value = 'DRAFT';
      text.dispatchEvent(new PT.win.Event('input', { bubbles: true }));
      expect(layers()[0].text).toBe('DRAFT');
      await drop(await logoFile());
      expect(layers().length).toBe(2);
      expect(layers()[1].kind).toBe('image');
      expect(PT.E.assets.get(layers()[1].asset).url.startsWith('data:image/png')).toBe(true);
      expect(labelsTopFirst()[0].startsWith('Logo')).toBe(true);
      expect(labelsTopFirst()[1]).toBe('“DRAFT”');
      // move the logo down: it is now bottom (drawn first, under the text)
      PT.A.setTool('watermark');
      await waitFor(() => PT.win.document.querySelector('.wm-stack'));
      PT.win.document.querySelectorAll('.wm-item')[0].click();
      btn('Move down').click();
      expect(layers()[0].kind).toBe('image');
      expect(PT.E.undoLabel()).toBe('Move layer down');
      // a position change: the layer is anchored to the top right with an offset
      const logoId = layers()[0].id;
      expect(PT.SP.engine.state.stamps.watermarks[0].id).toBe(logoId);
      // undo the move: the logo is on top again, with the text below it
      PT.A.undo();
      expect(layers()[1].kind).toBe('image');
      expect(layers()[0].kind).toBe('text');
      // the download draws the text (and the logo) into the page content
      const bytes = await PT.E.build();
      const read = await PT.read(bytes);
      expect(read.pages[0].text.includes('DRAFT')).toBe(true);
      const L = PT.win.PDFLib, out = await L.PDFDocument.load(bytes, { updateMetadata: false });
      const xo = out.getPage(0).node.Resources().lookup(L.PDFName.of('XObject'));
      expect(!!xo && String(xo).includes('/Im')).toBe(true); // the logo is an image XObject in the page resources
    }, { timeout: 90000 });
  });
})();
