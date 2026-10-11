/* Slop Tables layout: a blank workbook shows the grid with cells and headers, the formula bar, the sheet tabs and
   the sidebar, at desktop width and at 390 px. A storage that never answers must not leave the page blank. */
(function () {
  'use strict';
  const { describe, it, expect } = SlopTest;
  const doc = () => TB.doc, win = () => TB.win;
  /** Shown on screen: has a box and is not hidden by CSS. */
  const shown = (e) => {
    if (!e) return false;
    const r = e.getBoundingClientRect(), cs = e.ownerDocument.defaultView.getComputedStyle(e);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  const boxOf = (id) => doc().getElementById(id).getBoundingClientRect();
  const headings = () => [...doc().querySelectorAll('#side .side-h')].map((h) => h.textContent);

  describe('blank workbook at desktop width', () => {
    it('shows the grid with column and row headers and the active cell', async () => {
      await TB.boot('', 'app', { keepDrafts: false });
      TB.T.flush();
      expect(doc().querySelectorAll('.ch').length).toBeGreaterThan(5);
      expect(doc().querySelectorAll('.rh').length).toBeGreaterThan(5);
      expect(shown(doc().getElementById('cursor'))).toBe(true);
      expect(boxOf('cursor').width).toBeGreaterThan(20);
      expect(boxOf('grid').width).toBeGreaterThan(600);
      expect(boxOf('grid').height).toBeGreaterThan(300);
    });
    it('shows typed values as visible cells', () => {
      TB.T.type('B2', 'Hello');
      TB.T.type('C3', '=2*21');
      TB.T.flush();
      const b2 = TB.T.el('B2'), c3 = TB.T.el('C3');
      expect(shown(b2)).toBe(true);
      expect(b2.textContent).toBe('Hello');
      expect(c3.textContent).toBe('42');
      expect(shown(c3)).toBe(true);
    });
    it('shows the formula bar, the sheet tabs and the status bar', () => {
      expect(shown(doc().getElementById('fx'))).toBe(true);
      expect(doc().getElementById('namebox').value).toBe('C4'); // Enter after C3 moves down
      const tab = doc().querySelector('#tabs .tab:not(.tab-add)');
      expect(shown(tab)).toBe(true);
      expect(tab.textContent).toBe('Sheet1');
      expect(shown(doc().querySelector('.bottombar'))).toBe(true);
    });
    it('shows the sidebar with Sheets, Templates (From template, My templates) and Functions', () => {
      expect(shown(doc().getElementById('side'))).toBe(true);
      expect(boxOf('side').width).toBeGreaterThan(120);
      expect(headings()).toEqual(['Sheets', 'Templates', 'Functions']);
      expect(shown(doc().getElementById('sideFromTpl'))).toBe(true);
      expect(doc().querySelector('#sideSheets .side-item').textContent).toBe('Sheet1');
      expect(shown(doc().querySelector('#sideSheets .side-item'))).toBe(true);
      expect(doc().querySelector('.side-h + .side-act + .side-sub, .side-sub').textContent).toBe('My templates');
      expect(shown(doc().querySelector('.side-fn-b'))).toBe(true);
    });
    it('collapses and expands the sidebar, and the grid takes the space', async () => {
      const t = doc().getElementById('sideToggle');
      const openW = boxOf('grid').width;
      t.click();
      expect(doc().getElementById('side').classList.contains('collapsed')).toBe(true);
      expect(boxOf('side').width).toBeLessThan(40);
      expect(shown(doc().getElementById('sideBody'))).toBe(false);
      expect(boxOf('grid').width).toBeGreaterThan(openW);
      t.click();
      expect(doc().getElementById('side').classList.contains('collapsed')).toBe(false);
      expect(shown(doc().getElementById('sideBody'))).toBe(true);
      expect(boxOf('grid').width).toBe(openW);
    });
  });

  describe('blank workbook at 390 px', () => {
    it('keeps the grid, the sidebar and the sheet tabs on screen with no page scroll', async () => {
      await TB.boot('', 'app2', { keepDrafts: false });
      TB.T.flush();
      const f = TB.win;
      expect(boxOf('side').width).toBeGreaterThan(100);
      expect(shown(doc().getElementById('sideSheets').querySelector('.side-item'))).toBe(true);
      expect(shown(doc().getElementById('sideFromTpl'))).toBe(true);
      expect(doc().querySelectorAll('.ch').length).toBeGreaterThan(2);
      expect(shown(doc().getElementById('cursor'))).toBe(true);
      expect(boxOf('grid').width).toBeGreaterThan(150);
      expect(shown(doc().querySelector('#tabs .tab:not(.tab-add)'))).toBe(true);
      expect(doc().documentElement.scrollWidth <= f.innerWidth + 1).toBe(true);
      expect(boxOf('grid').right <= f.innerWidth + 1).toBe(true);
    });
  });

  describe('storage that never answers', () => {
    it('still opens a blank workbook with the grid and the sidebar', async () => {
      // The app's HTML is written into the frame after a stub that makes indexedDB.open never answer,
      // the way a blocked or stalled store behaves. Startup must not wait for it.
      const fr = document.getElementById('app');
      fr.src = 'about:blank';
      await SlopTest.sleep(60);
      const url = new URL('../../tables/index.html', location.href);
      const html = await (await fetch(url.href)).text();
      const stub = '<script>(function(){var never=function(){return {};};Object.defineProperty(window,"indexedDB",{configurable:true,value:{open:never,deleteDatabase:never}});})();</script>';
      const d = fr.contentDocument;
      d.open();
      d.write(html.replace('<head>', '<head><base href="' + url.href + '">' + stub));
      d.close();
      await SlopTest.waitFor(() => fr.contentWindow && fr.contentWindow.SlopTables && fr.contentWindow.SlopTables.ready, { timeout: 30000 });
      expect(String(fr.contentWindow.indexedDB.open).slice(0,60)).toBe('DEBUG');
      Object.assign(TB, { win: fr.contentWindow, T: fr.contentWindow.SlopTables, doc: fr.contentDocument });
      TB.T.flush();
      expect(doc().querySelectorAll('.ch').length).toBeGreaterThan(5);
      expect(shown(doc().getElementById('cursor'))).toBe(true);
      expect(shown(doc().querySelector('#tabs .tab:not(.tab-add)'))).toBe(true);
      expect(shown(doc().getElementById('side'))).toBe(true);
    }, { timeout: 60000 });
  });
})();
