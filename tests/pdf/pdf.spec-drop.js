/* Slop PDF: a drop on the open document asks Add to current or Create new (shared/drop/choice.js, the same dialog as
   PhotoSlop); a file the app cannot open (XLSX, DOCX, CSV, SVG…) is named and refused, and SVG is offered Convert to PDF. */
(function () {
  'use strict';
  const { describe, it, expect, waitFor } = SlopTest;
  const doc = () => PT.win.document;
  /** A real drop: a DataTransfer with the files, dispatched on the page view (the window listener in ui/input.js takes it). */
  function drop(files, target) {
    const dt = new PT.win.DataTransfer();
    files.forEach((f) => dt.items.add(f));
    (target || doc().getElementById('viewer')).dispatchEvent(new PT.win.DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  }
  const choiceDialog = () => doc().querySelector('.sdc-dialog');
  const clickChoice = (label) => {
    const b = [...doc().querySelectorAll('.sdc-btn')].find((x) => x.textContent === label);
    if (!b) throw new Error('no choice "' + label + '"');
    b.click();
  };
  const clickSui = (label) => {
    const b = [...doc().querySelectorAll('.sui-dlg .sui-btn')].find((x) => x.textContent === label);
    if (!b) throw new Error('no dialog button "' + label + '": ' + [...doc().querySelectorAll('.sui-dlg')].map((d) => d.textContent).join(' | '));
    b.click();
  };
  const suiTitles = () => [...doc().querySelectorAll('.sui-dlg .sui-title')].map((t) => t.textContent);
  const file = (name, type, bytes) => new PT.win.File([bytes || new PT.win.Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])], name, { type });
  const openTabs = () => PT.SP.docs.list().length;

  describe('drop on the open document', () => {
    it('asks Add to current or Create new when a PDF is dropped on an open document', async () => {
      if (!PT.SP) await PT.boot();
      PT.reset();
      await PT.open(await PT.makePdf([{ text: 'a' }, { text: 'b' }]), 'base.pdf');
      const bytes = await PT.makePdf([{ text: 'x' }]);
      drop([file('extra.pdf', 'application/pdf', bytes)]);
      await waitFor(() => choiceDialog(), { timeout: 15000 });
      const d = choiceDialog();
      expect(d.textContent).toContain('extra.pdf');
      const labels = [...d.querySelectorAll('.sdc-btn')].map((b) => b.textContent);
      expect(labels).toEqual(['Cancel', 'Create new', 'Add to current']);
      expect(PT.E.state.pages.length).toBe(2);
      clickChoice('Cancel');
      await waitFor(() => !choiceDialog());
      expect(PT.E.state.pages.length).toBe(2);
    }, { timeout: 60000 });

    it('Add to current adds the pages to this document, at the place chosen', async () => {
      if (!PT.SP) await PT.boot();
      PT.reset();
      await PT.open(await PT.makePdf([{ text: 'a' }, { text: 'b' }]), 'base2.pdf');
      drop([file('more.pdf', 'application/pdf', await PT.makePdf([{ text: 'x' }]))]);
      await waitFor(() => choiceDialog(), { timeout: 15000 });
      clickChoice('Add to current');
      await waitFor(() => suiTitles().includes('Add pages'), { timeout: 15000 });
      clickSui('Add pages');
      await waitFor(() => PT.E.state.pages.length === 3, { timeout: 30000 });
      expect(PT.texts()).toEqual(['1', '2', '1']);
      expect(PT.E.undoLabel()).toBeTruthy();
    }, { timeout: 90000 });

    it('Create new opens the dropped file in a new tab and leaves this document as it was', async () => {
      if (!PT.SP) await PT.boot();
      PT.reset();
      await PT.open(await PT.makePdf([{ text: 'a' }, { text: 'b' }]), 'base3.pdf');
      const before = openTabs();
      drop([file('fresh.pdf', 'application/pdf', await PT.makePdf([{ text: 'x' }]))]);
      await waitFor(() => choiceDialog(), { timeout: 15000 });
      clickChoice('Create new');
      await waitFor(() => openTabs() === before + 1 && PT.E.state.pages.length === 1, { timeout: 30000 });
      expect(PT.E.state.pages.length).toBe(1);
      expect(PT.texts()).toEqual(['1']);
    }, { timeout: 90000 });

    it('with no document open, the file opens without a choice', async () => {
      if (!PT.SP) await PT.boot();
      PT.reset();
      drop([file('solo.pdf', 'application/pdf', await PT.makePdf([{ text: 'x' }, { text: 'y' }]))]);
      await waitFor(() => PT.E.state.pages.length === 2, { timeout: 30000 });
      expect(choiceDialog()).toBe(null);
    }, { timeout: 60000 });
  });

  describe('files the app cannot open', () => {
    it('an XLSX (or CSV) drop is named and refused, and nothing is added', async () => {
      if (!PT.SP) await PT.boot();
      PT.reset();
      await PT.open(await PT.makePdf([{ text: 'a' }]), 'base4.pdf');
      drop([file('budget.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')]);
      await waitFor(() => suiTitles().includes('File not supported'), { timeout: 15000 });
      const text = [...doc().querySelectorAll('.sui-dlg')].map((d) => d.textContent).join(' ');
      expect(text).toContain('budget.xlsx');
      expect(text).toContain('Not supported, not added');
      expect(text).toContain('XLSX');
      expect([...doc().querySelectorAll('.sui-dlg .sui-btn')].map((b) => b.textContent)).toEqual(['OK']);
      expect(doc().getElementById('statusMsg').textContent).toContain('not supported');
      clickSui('OK');
      await waitFor(() => !doc().querySelector('.sui-dlg'));
      expect(PT.E.state.pages.length).toBe(1);
      expect(choiceDialog()).toBe(null);
    }, { timeout: 60000 });

    it('an SVG is offered Convert to PDF, which opens the converter with the file', async () => {
      if (!PT.SP) await PT.boot();
      PT.reset();
      drop([file('logo.svg', 'image/svg+xml', new PT.win.Uint8Array([60, 115, 118, 103, 62]))]);
      await waitFor(() => suiTitles().includes('Convert to PDF?'), { timeout: 15000 });
      const text = [...doc().querySelectorAll('.sui-dlg')].map((d) => d.textContent).join(' ');
      expect(text).toContain('logo.svg');
      expect(text).toContain('Can be converted to PDF');
      await waitFor(() => PT.win.SlopConvert, { timeout: 30000 });
      clickSui('Convert to PDF');
      await waitFor(() => doc().querySelector('.sl-cvt-dlg'), { timeout: 30000 });
      await waitFor(() => doc().querySelector('.sl-cvt-dlg').textContent.includes('logo.svg'), { timeout: 15000 });
      doc().querySelector('.sl-cvt-x').click();
      await waitFor(() => !doc().querySelector('.sl-cvt-dlg'));
    }, { timeout: 90000 });

    it('a mixed drop opens the PDF and names the file that was refused', async () => {
      if (!PT.SP) await PT.boot();
      PT.reset();
      drop([file('ok.pdf', 'application/pdf', await PT.makePdf([{ text: 'x' }])), file('notes.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')]);
      await waitFor(() => PT.E.state.pages.length === 1 && suiTitles().includes('File not supported'), { timeout: 30000 });
      const text = [...doc().querySelectorAll('.sui-dlg')].map((d) => d.textContent).join(' ');
      expect(text).toContain('notes.docx');
      expect(text).not.toContain('ok.pdf');
      clickSui('OK');
      await waitFor(() => !doc().querySelector('.sui-dlg'));
    }, { timeout: 60000 });
  });
})();
