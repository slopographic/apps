/* Slop PDF: split view (ui/panes.js). Two documents side by side: the focused one is the live editor, the other a read-only
   preview with its own zoom; a click focuses a pane and moves the tools to its document; closing a document empties the pane
   that showed it; one pane again puts the page view back. Every test restores one pane, even when it fails. */
(function () {
  'use strict';
  const { describe, it, expect, waitFor } = SlopTest;

  /** Two documents, the first on screen, in a fresh state. Returns both document records. */
  async function twoDocs() {
    PT.reset();
    if (!PT.SP) await PT.boot();
    await PT.open(await PT.makePdf([{ text: 'alpha one' }, { text: 'alpha two' }]), 'a.pdf');
    const docA = PT.SP.tabs.current();
    PT.A.newTab();
    await PT.open(await PT.makePdf([{ text: 'beta one' }]), 'b.pdf');
    const docB = PT.SP.tabs.current();
    PT.SP.tabs.api().activate(docA);
    const pid = PT.E.state.pages[0].id;
    PT.A.openPage(pid);
    await waitFor(() => PT.SP.editor.pid === pid, { timeout: 8000 });
    return { docA, docB };
  }
  /** A focus can open a stored document that is still loading, and the app is busy until it is in: wait for that, so the
     next test does not meet a busy app (a drop is refused while it is). */
  const settle = () => waitFor(() => !PT.A.isLocked(), { timeout: 15000 });
  /** Closes every document the strip holds, so the next test starts with what it expects (a reset empties the page only). */
  async function closeTabs() {
    await settle();
    const a = PT.SP.tabs.api();
    for (const t of a.tabs()) await a.close(t.doc);
    PT.reset();
    await settle();
  }
  /** Runs fn with two panes in columns, then puts one pane back and closes the documents, whatever happens. */
  async function inSplit(fn) {
    const docs = await twoDocs();
    PT.SP.panes.setLayout('columns2');
    try { await fn(docs); } finally { PT.SP.panes.unsplit(); await closeTabs(); }
  }
  // A press and its release, as a finger or a mouse makes them.
  const click = (win, el) => {
    el.dispatchEvent(new win.PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true }));
    win.dispatchEvent(new win.PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true }));
  };

  describe('split view', () => {
    it('two columns: the focused document is live, the other is a read-only preview of its own', () => inSplit(async ({ docA, docB }) => {
      const win = PT.win, P = PT.SP.panes;
      expect(P.count()).toBe(2);
      expect(P.layout()).toBe('columns2');
      expect(P.shownDocs()[0] === docA && P.shownDocs()[1] === docB).toBe(true);
      expect(win.document.getElementById('viewer').parentNode.dataset.pane).toBe('0');
      const preview = P.preview(1);
      expect(!!preview).toBe(true);
      expect(preview.el.parentNode.dataset.pane).toBe('1');
      await waitFor(() => win.document.querySelector('.sw-pane[data-pane="1"] .pv-pv-canvas[data-drawn="1"]'), { timeout: 8000 });
      expect(win.document.querySelectorAll('.sw-pane[data-pane="1"] .pv-pv-page').length).toBe(1);
    }));

    it('a click on a pane focuses it: the tools and the strip move to its document', () => inSplit(async ({ docA, docB }) => {
      const win = PT.win, P = PT.SP.panes;
      click(win, win.document.querySelector('.sw-pane[data-pane="1"]'));
      expect(P.focused()).toBe(1);
      expect(PT.SP.tabs.current() === docB).toBe(true);
      expect(PT.E.state.pages.length).toBe(1);             // the live state is B's: one page
      expect(win.document.getElementById('viewer').parentNode.dataset.pane).toBe('1');
      expect(P.preview(0).doc() === docA).toBe(true);     // A is now the preview
    }));

    it('a preview shows the annotations of its page, and its text can be selected', () => inSplit(async ({ docB }) => {
      const win = PT.win, P = PT.SP.panes;
      // B's page gets a rectangle, added to the document as the editor would add it
      docB.state.pages[0].annots.push({ id: 'preview-rect', type: 'rect', cx: 80, cy: 45, w: 120, h: 50, rot: 0, color: '#ff0000', width: 2, fill: 'none', opacity: 1 });
      P.split(2, 'columns');
      await waitFor(() => win.document.querySelector('.sw-pane[data-pane="1"] .annots > *'), { timeout: 8000 });
      expect(win.document.querySelectorAll('.sw-pane[data-pane="1"] .annots > *').length >= 1).toBe(true);
      await waitFor(() => win.document.querySelector('.sw-pane[data-pane="1"] .pv-textlayer span'), { timeout: 8000 });
      expect(win.document.querySelector('.sw-pane[data-pane="1"] .pv-textlayer span').textContent.includes('beta')).toBe(true);
      docB.state.pages[0].annots = docB.state.pages[0].annots.filter((a) => a.id !== 'preview-rect');
    }));

    it('a saved split comes back: its layout, its focused pane and the documents in each pane', () => inSplit(async ({ docA, docB }) => {
      const win = PT.win, P = PT.SP.panes;
      click(win, win.document.querySelector('.sw-pane[data-pane="1"]'));
      const snap = P.snapshot();
      expect(snap.layout).toBe('columns2');
      expect(snap.focused).toBe(1);
      expect(snap.docs[0] === docA.id && snap.docs[1] === docB.id).toBe(true);
      P.unsplit();
      expect(P.count()).toBe(1);
      P.restore(snap);
      expect(P.count()).toBe(2);
      expect(P.layout()).toBe('columns2');
      expect(P.focused()).toBe(1);
      expect(P.shownDocs()[0] === docA && P.shownDocs()[1] === docB).toBe(true);
    }));

    it('Ctrl+Alt+arrows move between the panes, and skip an empty one', () => inSplit(async ({ docB }) => {
      const win = PT.win, P = PT.SP.panes;
      win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowRight', ctrlKey: true, altKey: true, bubbles: true }));
      expect(P.focused()).toBe(1);
      expect(PT.SP.tabs.current() === docB).toBe(true);
      win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowLeft', ctrlKey: true, altKey: true, bubbles: true }));
      expect(P.focused()).toBe(0);
    }));

    it('each pane zooms on its own: a preview zoom does not change the live editor', () => inSplit(async () => {
      const win = PT.win, P = PT.SP.panes;
      const live = PT.SP.editor.zoom;
      const before = P.preview(1).zoom();
      win.document.querySelector('.sw-pane[data-pane="1"] .pv-pv-btn[aria-label="Zoom in"]').click();
      expect(P.preview(1).zoom() > before).toBe(true);
      expect(PT.SP.editor.zoom).toBe(live);
    }));

    it('closing a document shown in a preview pane empties that pane', () => inSplit(async ({ docB }) => {
      const P = PT.SP.panes;
      await PT.SP.tabs.api().close(docB);
      expect(P.shownDocs()[1] === null).toBe(true);
      expect(P.preview(1).doc() === null).toBe(true);
    }));

    it('one pane again: the page view goes back to the stage, and the previews go', async () => {
      await twoDocs();
      const win = PT.win, P = PT.SP.panes;
      P.setLayout('grid4');
      expect(P.count()).toBe(4);
      P.setLayout('one');
      expect(P.count()).toBe(1);
      expect(win.document.getElementById('viewer').parentNode.id).toBe('stage');
      expect(win.document.getElementById('panes').hidden).toBe(true);
    });
  });
})();
