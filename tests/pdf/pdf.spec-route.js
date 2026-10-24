/* Slop PDF: the URL sections (shared/router) and the view modes (shared/viewmode). A ?panel= link opens that dock
   section and shows the sidebar; Ctrl+Shift+F cycles the view mode. */
(function () {
  'use strict';
  const { describe, it, expect, waitFor } = SlopTest;
  const doc = () => PT.win.document;
  const header = (id) => doc().querySelector('[data-dock="' + id + '"] .pp-dock-h');
  const pressCtrlShiftF = () => doc().dispatchEvent(new PT.win.KeyboardEvent('keydown', { key: 'F', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }));

  describe('URL sections and view modes', () => {
    it('?panel=history opens that dock section and shows the sidebar', async () => {
      await PT.boot('?panel=history');
      await waitFor(() => header('history').getAttribute('aria-expanded') === 'true', { timeout: 15000 });
      expect(doc().getElementById('app').classList.contains('no-panel')).toBe(false);
      expect(header('layers').getAttribute('aria-expanded')).toBe('true');
    }, { timeout: 60000 });

    it('?tool=compress (a task page link) opens that rail tool; an unknown tool is ignored', async () => {
      await PT.boot('?tool=compress');
      await waitFor(() => PT.SP.app.tool === 'compress', { timeout: 15000 });
      await PT.boot('?tool=nonsense');
      await waitFor(() => doc().documentElement.classList.contains('ready'), { timeout: 15000 });
      expect(PT.SP.app.tool).toBe('organize');
    }, { timeout: 90000 });

    it('Ctrl+Shift+F cycles Full, Focus, Content only and back', async () => {
      if (!PT.SP) await PT.boot();
      const V = PT.win.SlopViewMode;
      V.set('full');
      const rail = doc().getElementById('rail');
      pressCtrlShiftF();
      expect(V.mode()).toBe('focus');
      expect(doc().documentElement.dataset.slopvm).toBe('focus');
      expect(rail.classList.contains('slopvm-off')).toBe(true);
      pressCtrlShiftF();
      expect(V.mode()).toBe('content');
      expect(doc().getElementById('props').classList.contains('slopvm-off')).toBe(true);
      pressCtrlShiftF();
      expect(V.mode()).toBe('full');
      expect(rail.classList.contains('slopvm-off')).toBe(false);
    }, { timeout: 60000 });
  });
})();
