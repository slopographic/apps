/* Slop PDF: the block copy box (K). It sits on the page, so it moves with the page when it scrolls, and it goes
   when the tool changes or Escape is pressed. */
(function () {
  'use strict';
  const { describe, it, expect, waitFor } = SlopTest;

  describe('block copy box', () => {
    it('stays on the page, moves with it, and goes when the tool changes', async () => {
      PT.reset();
      if (!PT.SP) await PT.boot();
      await PT.open(await PT.makePdf([{ text: 'alpha beta gamma' }]), 'block.pdf');
      const Ed = PT.SP.editor, S = Ed._, win = PT.win;
      const pid = PT.E.state.pages[0].id; PT.A.openPage(pid);
      await waitFor(() => PT.win.document.querySelector('.pv-textlayer span') && Ed.pid === pid, { timeout: 8000 });
      Ed.setTool('block');
      const page = S.pageEl, r = page.getBoundingClientRect();
      const ev = (type, x, y) => new win.PointerEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true, pointerId: 1 });
      page.dispatchEvent(ev('pointerdown', r.left + 20, r.top + 20));
      win.dispatchEvent(ev('pointermove', r.left + 220, r.top + 60));
      win.dispatchEvent(ev('pointerup', r.left + 220, r.top + 60));
      const box = page.querySelector('.pv-blockbox');
      expect(!!box).toBeTruthy();
      expect(box.parentElement).toBe(page);
      const before = box.getBoundingClientRect().top - page.getBoundingClientRect().top;
      // Scrolling the page moves the box with it: its place on the page does not change.
      const scroller = PT.win.document.querySelector('.viewer') || page.parentElement;
      scroller.scrollTop += 40;
      await new Promise((res) => PT.win.requestAnimationFrame(() => res()));
      const after = box.getBoundingClientRect().top - page.getBoundingClientRect().top;
      expect(Math.round(after)).toBe(Math.round(before));
      // A tool change removes the box.
      Ed.setTool('select');
      await new Promise((res) => setTimeout(res, 0)); // the tool change is seen after the page's attribute changes
      expect(!!page.querySelector('.pv-blockbox')).toBeFalsy();
    });

    it('Escape removes the box', async () => {
      PT.reset();
      await PT.open(await PT.makePdf([{ text: 'one two' }]), 'block2.pdf');
      const Ed = PT.SP.editor, S = Ed._, win = PT.win;
      const pid = PT.E.state.pages[0].id; PT.A.openPage(pid);
      await waitFor(() => PT.win.document.querySelector('.pv-textlayer span') && Ed.pid === pid, { timeout: 8000 });
      Ed.setTool('block');
      const page = S.pageEl, r = page.getBoundingClientRect();
      const ev = (type, x, y) => new win.PointerEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true, pointerId: 1 });
      page.dispatchEvent(ev('pointerdown', r.left + 20, r.top + 20));
      win.dispatchEvent(ev('pointermove', r.left + 120, r.top + 50));
      win.dispatchEvent(ev('pointerup', r.left + 120, r.top + 50));
      expect(!!page.querySelector('.pv-blockbox')).toBeTruthy();
      win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(!!page.querySelector('.pv-blockbox')).toBeFalsy();
      Ed.setTool('select');
    });
  });
})();
