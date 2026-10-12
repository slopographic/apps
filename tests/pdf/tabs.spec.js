/* Slop PDF document tabs: two PDFs as two tabs, each keeping its pages, view, undo history, name and Drive link when
   switched to and back; a PDF dropped on the strip opens a new tab (a PDF already open asks first); a PDF dropped on the
   page adds its pages where the person picks, as one undo step (a PDF already in the document asks first); the tabs and
   their documents come back after a reload; the toolbar Convert button opens the converter on the open document. */
(function () {
  'use strict';
  const { describe, it, expect, waitFor, sleep } = SlopTest;
  let booted = false;
  async function boot() {
    if (!booted) { await PT.boot(); booted = true; }
    await waitFor(() => PT.SP.tabs && PT.SP.tabs.api());
  }
  const doc = () => PT.win.document;
  const strip = () => doc().querySelector('#tabs .sl-doctabs-strip');
  const tabs = () => [...doc().querySelectorAll('#tabs .sl-doctab')];
  const tabNamed = (s) => tabs().find((t) => t.textContent.toLowerCase().includes(s));
  const file = (bytes, name) => new PT.win.File([bytes], name, { type: 'application/pdf' });
  /** A drop of files on an element of the app frame (the window's drop handler sees it, as with a real drag). */
  function drop(target, files) {
    const dt = new PT.win.DataTransfer();
    for (const f of files) dt.items.add(f);
    target.dispatchEvent(new PT.win.DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  }
  const dialogs = () => [...doc().querySelectorAll('.sui-dlg')];
  const dialogTitled = (t) => dialogs().find((d) => d.querySelector('.sui-title') && d.querySelector('.sui-title').textContent === t);
  const clickIn = (root, label) => [...root.querySelectorAll('button')].find((b) => b.textContent.trim() === label).click();
  const texts = async () => (await PT.read(await PT.E.build())).pages.map((p) => p.text);
  const field = () => doc().getElementById('fileName');

  describe('document tabs', () => {
    it('two PDFs open as two tabs, and switching brings each one back as it was', async () => {
      await boot();
      PT.A.newTab();
      const alphaBytes = await PT.makePdf([{ text: 'Alpha 1' }, { text: 'Alpha 2' }]);
      await PT.open(alphaBytes, 'alpha.pdf');
      const n0 = tabs().length;
      // a PDF dropped on the strip opens as a new tab, and becomes the tab on screen
      drop(strip(), [file(await PT.makePdf([{ text: 'Beta 1' }]), 'beta.pdf')]);
      await waitFor(() => tabNamed('beta') && PT.E.state.pages.length === 1);
      expect(tabs().length).toBe(n0 + 1);
      expect(tabNamed('beta').getAttribute('aria-selected')).toBe('true');
      expect(await texts()).toEqual(['Beta 1']);
      // the alpha tab: a name, a Drive link and the page view on page 1 are its own; they come back when it is shown again
      tabNamed('alpha').click();
      await waitFor(() => PT.E.state.pages.length === 2);
      expect(await texts()).toEqual(['Alpha 1', 'Alpha 2']);
      PT.A.rename('Alpha renamed');
      PT.A.driveId = 'drive-alpha';
      PT.A.openPage(PT.E.state.pages[0].id);
      tabNamed('beta').click();
      await waitFor(() => PT.E.state.pages.length === 1);
      expect(PT.A.mode).toBe('grid');
      expect(PT.A.driveId).toBe(null);
      expect(PT.E.undoLabel()).not.toBe('Rotate page');
      tabNamed('alpha').click();
      await waitFor(() => PT.E.state.pages.length === 2);
      expect(await texts()).toEqual(['Alpha 1', 'Alpha 2']);
      expect(PT.A.mode).toBe('page');
      expect(PT.SP.editor.pid).toBe(PT.E.state.pages[0].id);
      expect(field().value).toBe('Alpha renamed.pdf');
      expect(PT.A.driveId).toBe('drive-alpha');
      // an edit in alpha is its undo step, and the rotation is there when alpha is shown again
      PT.A.rotate([PT.E.state.pages[1].id], 90);
      // zoom and layout are the tab's too; the edit log of alpha's file is written when the tab is left
      PT.SP.editor.zoomMode = 'num'; PT.SP.editor.zoom = 1.5; PT.SP.editor.layout();
      PT.SP.editor.setLayout('two');
      const fp = [...PT.E.files.values()][0].fp;
      await waitFor(async () => { const r = await PT.U.idb.get('edits/' + fp); return !!r && r.entries.length >= 1; }, { timeout: 10000 });
      tabNamed('beta').click();
      await waitFor(() => PT.E.state.pages.length === 1);
      expect(PT.SP.editor.layoutMode).toBe('continuous');
      tabNamed('alpha').click();
      await waitFor(() => PT.E.state.pages.length === 2);
      expect(PT.E.state.pages[1].rot).toBe(90);
      expect(PT.E.undoLabel()).toBe('Rotate page');
      expect(PT.SP.editor.layoutMode).toBe('two');
      expect(Math.abs(PT.SP.editor.zoom - 1.5) < 1e-6).toBe(true);
      PT.A.driveId = null;
    }, { timeout: 90000 });

    it('a PDF already open in another tab asks before it opens again', async () => {
      await boot();
      PT.A.newTab();
      const bytes = await PT.makePdf([{ text: 'Twice' }]);
      await PT.open(bytes, 'twice.pdf');
      const n0 = tabs().length;
      drop(strip(), [file(bytes, 'twice.pdf')]);
      const d = await waitFor(() => dialogTitled('Already open'));
      expect(d.textContent.includes('already open in a tab')).toBe(true);
      clickIn(d, 'Cancel');
      await sleep(200);
      expect(tabs().length).toBe(n0);
      drop(strip(), [file(bytes, 'twice.pdf')]);
      clickIn(await waitFor(() => dialogTitled('Already open')), 'Open again');
      await waitFor(() => tabs().length === n0 + 1);
      await waitFor(() => PT.E.state.pages.length === 1);
    }, { timeout: 60000 });

    it('a PDF dropped on the page adds its pages where the person picks, as one undo step', async () => {
      await boot();
      PT.A.newTab();
      const baseBytes = await PT.makePdf([{ text: 'Base 1' }, { text: 'Base 2' }]);
      await PT.open(baseBytes, 'base.pdf');
      const page = doc().getElementById('gridWrap');
      // at the start
      drop(page, [file(await PT.makePdf([{ text: 'Extra 1' }, { text: 'Extra 2' }]), 'extra.pdf')]);
      const ask = await waitFor(() => dialogTitled('Add pages'));
      ask.querySelector('select').value = 'start';
      clickIn(ask, 'Add pages');
      await waitFor(() => PT.E.state.pages.length === 4);
      expect(await texts()).toEqual(['Extra 1', 'Extra 2', 'Base 1', 'Base 2']);
      PT.A.undo();
      expect(await texts()).toEqual(['Base 1', 'Base 2']);
      // after page 1
      drop(page, [file(await PT.makePdf([{ text: 'Mid 1' }]), 'mid.pdf')]);
      const ask2 = await waitFor(() => dialogTitled('Add pages'));
      ask2.querySelector('select').value = 'after:1';
      clickIn(ask2, 'Add pages');
      await waitFor(() => PT.E.state.pages.length === 3);
      expect(await texts()).toEqual(['Base 1', 'Mid 1', 'Base 2']);
      PT.A.undo();
      expect(await texts()).toEqual(['Base 1', 'Base 2']);
      // a PDF already in the document asks first; cancelling adds nothing
      drop(page, [file(baseBytes, 'base.pdf')]);
      clickIn(await waitFor(() => dialogTitled('Already in this document')), 'Cancel');
      await sleep(200);
      expect(PT.E.state.pages.length).toBe(2);
      expect(dialogTitled('Add pages')).toBe(undefined);
    }, { timeout: 90000 });

    it('the tabs and their documents come back after a reload', async () => {
      await boot();
      PT.A.newTab();
      await PT.open(await PT.makePdf([{ text: 'Keep A' }]), 'reload-a.pdf');
      PT.A.rename('Reload kept');
      PT.A.newTab();
      await PT.open(await PT.makePdf([{ text: 'Keep B 1' }, { text: 'Keep B 2' }]), 'reload-b.pdf');
      PT.A.rotate([PT.E.state.pages[1].id], 90);
      await PT.A.tabsFlush();
      PT.A._.autosave.flush();
      await sleep(300);
      await PT.boot();
      await waitFor(() => tabNamed('reload kept') && PT.E.state.pages.length === 2, { timeout: 30000 });
      expect(PT.E.state.pages[1].rot).toBe(90);
      expect(await texts()).toEqual(['Keep B 1', 'Keep B 2']);
      tabNamed('reload kept').click();
      await waitFor(() => PT.E.state.pages.length === 1);
      expect(await texts()).toEqual(['Keep A']);
      expect(field().value).toBe('Reload kept.pdf');
    }, { timeout: 90000 });

    it('the toolbar Convert button and File > Convert open the converter on the open document', async () => {
      await boot();
      PT.A.newTab();
      await PT.open(await PT.makePdf([{ text: 'Convert me' }]), 'to-convert.pdf');
      expect(PT.A._.fileMenu().some((x) => x && x.label === 'Convert…')).toBe(true);
      PT.A.driveId = 'drive-convert';
      doc().getElementById('btnConvert').click();
      const dlg = await waitFor(() => doc().querySelector('.sl-cvt-dlg'), { timeout: 20000 });
      await waitFor(() => dlg.querySelector('input[name]'), { timeout: 20000 });
      const ids = [...dlg.querySelectorAll('input[name]')].map((i) => i.dataset.target);
      expect(ids).toContain('pdf-to-png');
      expect(ids).not.toContain('images-to-pdf');
      await waitFor(() => dlg.querySelector('input[data-target="pdf-to-png"]'), { timeout: 20000 });
      dlg.querySelector('[data-k="run"]').click();
      await waitFor(() => dlg.querySelector('[data-k="dl:0"]'), { timeout: 60000 });
      expect(dlg.querySelector('[data-k="dl:0"]').closest('li').querySelector('.sl-cvt-name').textContent).toBe('to-convert-edited-page-1.png');
      expect(!!dlg.querySelector('[data-k="dr:0"]')).toBe(true); // the tab is linked to Slop Drive
      dlg.dispatchEvent(new PT.win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await waitFor(() => !doc().querySelector('.sl-cvt-dlg'));
      PT.A.driveId = null;
    }, { timeout: 90000 });
  });
})();
