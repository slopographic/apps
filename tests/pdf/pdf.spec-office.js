/* Slop PDF File ▸ Export as: Word, Excel and PowerPoint from the document (shared/convert/pdf-office.js, pdf-pptx.js, the
   same converters as the Convert app), the Convert dialog opened with the target chosen, and the fidelity note on each.
   Table reading is checked on a PDF whose columns are aligned. */
(function () {
  'use strict';
  const { describe, it, expect, waitFor } = SlopTest;
  const doc = () => PT.win.document;
  /** A PDF: page 1 has a sentence and a three-column table of aligned text; page 2 is blank. */
  async function tablePdf() {
    if (!PT.SP) await PT.boot();
    const L = PT.win.PDFLib, d = await L.PDFDocument.create();
    const font = await d.embedFont(L.StandardFonts.Helvetica);
    const p = d.addPage(PT.win.Array.of(400, 300));
    p.drawText('Hello world', { x: 40, y: 260, size: 11, font });
    // pdf.js joins text on one baseline into one item (the documented limit, see HANDOFF): this row reads as one cell.
    [['Item', 'Qty', 'Price'], ['Pen', '3', '4.50'], ['Cup', '1', '12.00']].forEach((row, r) =>
      row.forEach((t, c) => p.drawText(t, { x: 40 + c * 120, y: 200 - r * 20, size: 11, font })));
    d.addPage(PT.win.Array.of(400, 300));
    return new Uint8Array(await d.save());
  }
  const entriesOf = async (blob) => (await (await import('../../shared/office/zip.js')).readZip(blob));
  const textOf = (files, name) => new TextDecoder().decode(files.get(name));

  describe('Slop PDF Export as', () => {
    it('File ▸ Export as lists Word, Excel, PowerPoint and images, and Other formats', async () => {
      if (!PT.SP) await PT.boot();
      PT.reset();
      await PT.open(await PT.makePdf([{ text: 'Export menu' }]), 'export-menu.pdf');
      const sub = PT.A._.fileMenu().find((x) => x && x.label === 'Export as');
      expect(!!sub).toBe(true);
      const labels = sub.sub.filter((x) => x && x.label).map((x) => x.label);
      ['Word (.docx)', 'Excel (.xlsx)', 'PowerPoint (.pptx)', 'PNG images', 'JPG images', 'Other formats…'].forEach((l) => expect(labels).toContain(l));
    });

    it('Export as a Word file opens the Convert dialog with Word chosen and says how faithful it is', async () => {
      PT.A.openConvert('pdf-to-docx');
      await waitFor(() => doc().querySelector('input[data-target="pdf-to-docx"]'), { timeout: 15000 });
      expect(doc().querySelector('input[data-target="pdf-to-docx"]').checked).toBe(true);
      const dlg = doc().querySelector('.sl-cvt-x');
      if (dlg) dlg.click();
      const t = (await import('../../shared/convert/targets.js')).TARGETS.find((x) => x.id === 'pdf-to-docx');
      expect(t.note).toMatch(/Text-based/);
      expect((await import('../../shared/convert/targets.js')).TARGETS.find((x) => x.id === 'pdf-to-pptx').note).toMatch(/picture/);
    });

    it('builds a table only from cells that are positioned apart (synthetic lines), and reads a joined row as one cell', async () => {
      const layout = await import('../../shared/convert/pdf-layout.js');
      // Cells with their own x positions: a table, and a paragraph line in front of it.
      const apart = [
        { y: 260, h: 11, cells: [{ x: 40, text: 'Hello world' }] },
        { y: 200, h: 11, cells: [{ x: 40, text: 'Item' }, { x: 160, text: 'Qty' }, { x: 280, text: 'Price' }] },
        { y: 180, h: 11, cells: [{ x: 40, text: 'Pen' }, { x: 160, text: '3' }, { x: 280, text: '4.50' }] },
        { y: 160, h: 11, cells: [{ x: 40, text: 'Cup' }, { x: 160, text: '1' }, { x: 280, text: '12.00' }] },
      ];
      const blocks = layout.blocksOf(apart);
      expect(blocks[0]).toEqual({ type: 'para', text: 'Hello world' });
      expect(blocks[1]).toEqual({ type: 'table', rows: [['Item', 'Qty', 'Price'], ['Pen', '3', '4.50'], ['Cup', '1', '12.00']] });
      expect(layout.gridOf(apart)[2]).toEqual(['Pen', '3', '4.50']);
      // A row pdf.js gives as one item (same font, same baseline) is one cell: the documented limit.
      const joined = [{ y: 200, h: 11, cells: [{ x: 40, text: 'Item Qty Price' }] }];
      expect(layout.blocksOf(joined)).toEqual([{ type: 'para', text: 'Item Qty Price' }]);
      // The fixture PDF's paragraph is read from the page itself.
      const pages = await layout.readPages(await tablePdf(), '');
      expect(pages.length).toBe(2);
      expect(pages[0].lines[0].cells[0].text).toBe('Hello world');
    });

    it('PDF to Word writes the page text and marks the page with no text', async () => {
      const off = await import('../../shared/convert/pdf-office.js');
      const files = await entriesOf(await off.pdfToDocx(await tablePdf(), { title: 'Report' }));
      const xml = textOf(files, 'word/document.xml');
      expect(xml).toContain('Hello world');
      expect(xml).toContain('Item Qty Price');
      expect(xml).toContain(off.NO_TEXT.slice(0, 30));
    });

    it('PDF to Excel writes the page rows and marks the page with no text', async () => {
      const off = await import('../../shared/convert/pdf-office.js');
      const files = await entriesOf(await off.pdfToXlsx(await tablePdf(), {}));
      const sheet = textOf(files, 'xl/worksheets/sheet1.xml');
      expect(sheet).toContain('Page 1');
      expect(sheet).toContain('Hello world');
      expect(sheet).toContain(off.NO_TEXT.slice(0, 30));
    });

    it('PDF to PowerPoint makes one slide per page, each a picture of the page', async () => {
      const pp = await import('../../shared/convert/pdf-pptx.js');
      const files = await entriesOf(await pp.pdfToPptx(await tablePdf(), {}));
      const slides = [...files.keys()].filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k));
      expect(slides.length).toBe(2);
      const png = files.get('ppt/media/image1.png');
      expect(png[0]).toBe(0x89);
      expect(textOf(files, 'ppt/slides/slide1.xml')).toContain('<p:pic>');
    });
  });
})();
