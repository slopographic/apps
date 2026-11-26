/* Slop PDF: the cover an edit leaves over old text it could not take out of the page belongs to that edit. It is not hit
   by clicks (they reach the text or the page under it), not selected on its own (a click, Ed.select, a group, a box drag, the
   context menu), not listed (Layers, the Edit panel's count, the thumbnail badge, nothing to Tab to), not moved by moving its
   text (alone or in a group), kept when the text is deleted (the old text stays hidden), restored exactly by undo and redo,
   and kept under its text when the stack changes. The editor's info line (Lines) and the frame's note (Paragraphs, the select
   tool) say the old text is hidden under a cover. Remove, Replace and the selection's lift make the same covers. A whiteout
   drawn with the Whiteout tool stays an ordinary object.
   Covers: pdf/js/core/layers.js, pdf/js/ui/sheet.js, pdf/js/editor/view.js, pdf/js/editor/multi-sel.js, pdf/js/editor/edit-text.js,
     pdf/js/editor/para-model.js, pdf/js/editor/para-xform.js, pdf/js/editor/sel-actions.js, pdf/js/editor/sel-lift.js,
     pdf/js/find/replace.js, pdf/js/tools/layers-panel.js, pdf/js/tools/edit-panel.js, pdf/js/organize/grid.js, pdf/js/ui/context.js,
     pdf/css/workspace.css, pdf/css/find.css, pdf/css/para.css */
(function () {
  'use strict';
  const { describe, it, expect, waitFor, sleep } = SlopTest;
  const doc = () => PT.win.document;
  let restore = null, made = null;
  const page = () => PT.E.state.pages[0];

  describe('Slop PDF: a cover over old text belongs to its edit', () => {
    it('Lines: the info line says when the old text stays under a cover (only then), and the cover belongs to the new text', async () => {
      await SE.open(await CV.pdf(), 'cover-lines.pdf');
      // a line whose old text can be taken out (plain Helvetica in the page's content) says nothing about covers
      const Ed = CV.Ed();
      Ed.setEditTextMode('lines'); if (!Ed.editText) Ed.toggleEditText();
      const el = CV.S().slots.get(Ed.pid).el, at = SE.at(60, 320 - 160 - 4);
      el.dispatchEvent(new PT.win.PointerEvent('pointerdown', Object.assign({ button: 0, bubbles: true, cancelable: true, pointerType: 'mouse', isPrimary: true, pointerId: 4 }, at)));
      const input = await waitFor(() => doc().querySelector('.edit-run'), { timeout: 10000 });
      await (CV.S().runEdit.took || null);
      await sleep(30);
      expect(doc().querySelector('.edit-info').textContent).not.toContain(CV.NOTE);
      input.dispatchEvent(new PT.win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      Ed.toggleEditText();
      // the old text cannot be taken out: the info line says so while typing, and the cover is the edit's
      restore = CV.force();
      made = await CV.editLine('Hi');
      expect(made.info).toContain(CV.NOTE);
      expect(CV.isCover(made.cover)).toBe(true, 'hides old text: ' + CV.json(made.cover));
      expect(made.cover.of).toBe(made.text.id);
      expect(page().annots.map((a) => a.id)).toEqual([made.cover.id, made.text.id]);
    }, { timeout: 60000 });

    it('the cover is not hit by clicks: a click there reaches the text or the page; a drawn whiteout is still an object', async () => {
      const cel = SE.elOf(made.cover.id);
      expect(!!cel).toBe(true, 'the cover is drawn');
      expect(CV.hit(cel)).toBe(false, 'no point of the cover is a hit target');
      const only = CV.coverOnly(made.cover, made.text);
      expect(cel.contains(only.el)).toBe(false);
      await SE.tap(only.pt);
      expect(CV.Ed().selId).toBe(null, 'nothing selected by a click on the cover');
      await SE.tap(SE.centre(SE.elOf(made.text.id)));
      expect(CV.Ed().selId).toBe(made.text.id, 'a click on the new text selects the text');
      // the Whiteout tool's box: an ordinary object (hit, selected, listed)
      CV.Ed().addAnnot({ id: 'mine', type: 'whiteout', rot: 0, cx: 300, cy: 290, w: 80, h: 20, fill: '#ffffff', opacity: 1 }, 'Add whiteout');
      CV.Ed().select(null); await sleep(30);
      expect(CV.hit(SE.elOf('mine'))).toBe(true);
      await SE.tap(SE.centre(SE.elOf('mine')));
      expect(CV.Ed().selId).toBe('mine');
      PT.SP.dock.refresh();
      expect(!!doc().querySelector('#dock-layers .lyr[data-aid="mine"]')).toBe(true);
      PT.A.undo(); CV.Ed().select(null); await sleep(30);
    }, { timeout: 60000 });

    it('the cover cannot be selected or listed: select, groups, a box drag, the context menu, Layers, the counts, Tab', async () => {
      const Ed = CV.Ed(), S = CV.S(), id = made.cover.id;
      Ed.select(id);
      expect(Ed.selId).toBe(null, 'Ed.select refuses it');
      S.groupSet([id, made.text.id]);
      expect(S.selectedIds()).toEqual([made.text.id]);
      Ed.select(null);
      await SE.drag(SE.at(8, 8), 410 * Ed.zoom, 80 * Ed.zoom); // a box from the empty corner over the line
      expect(S.selectedIds().includes(id)).toBe(false, 'not in the box selection: ' + S.selectedIds());
      expect(S.selectedIds().includes(made.text.id)).toBe(true);
      Ed.select(null);
      const only = CV.coverOnly(made.cover, made.text);
      only.el.dispatchEvent(new PT.win.MouseEvent('contextmenu', Object.assign({ bubbles: true, cancelable: true }, only.pt)));
      await sleep(30);
      expect(Ed.selId).toBe(null, 'the context menu is the page\'s');
      PT.win.SlopUI.closeMenu();
      PT.SP.dock.refresh();
      const rows = [...doc().querySelectorAll('#dock-layers .lyr')].map((r) => r.dataset.aid);
      expect(rows).toEqual([made.text.id]);
      expect(doc().querySelector('[data-dock="layers"] .pp-dock-meta').textContent).toBe('1', 'the Layers count');
      const focusable = [...doc().querySelectorAll('button, [tabindex], a[href], input')].filter((x) => x.tabIndex >= 0);
      expect(focusable.some((x) => (x.dataset.key || '').includes(id) || x.closest('[data-aid="' + id + '"]'))).toBe(false, 'nothing to Tab to');
      PT.A.setTool('edit');
      await waitFor(() => /1 annotation/.test(doc().querySelector('#props').textContent), { timeout: 3000 });
      PT.A.showGrid(true);
      const badge = await waitFor(() => doc().querySelector('.thumb .thumb-badge:not([hidden])'), { timeout: 8000 });
      expect(badge.textContent.trim()).toBe('1');
      PT.A.openPage(page().id);
      await waitFor(() => Ed.pid === page().id && SE.elOf(made.text.id), { timeout: 8000 });
      S.pageEl.setPointerCapture = () => {}; S.pageEl.releasePointerCapture = () => {};
    }, { timeout: 60000 });

    it('moving the text, alone or in a group, keeps the cover in place; the stack keeps it under its text', async () => {
      const Ed = CV.Ed(), S = CV.S(), before = CV.json(CV.find(made.cover.id)), cx = CV.find(made.text.id).cx;
      await SE.drag(SE.elOf(made.text.id), 50, 30);
      expect(CV.find(made.text.id).cx > cx + 20).toBe(true, 'the text moved');
      expect(CV.json(CV.find(made.cover.id))).toBe(before);
      Ed.select(null);
      await SE.drag(SE.at(8, 8), 410 * Ed.zoom, 120 * Ed.zoom);
      expect(S.selectedIds()).toEqual([made.text.id]);
      Ed.nudgeSelected(0, 10);
      expect(CV.json(CV.find(made.cover.id))).toBe(before, 'not moved with the group');
      expect(CV.hit(SE.elOf(made.cover.id))).toBe(false);
      // Send to back (Edit panel) and Layers ▸ down: the text never goes under its own cover
      Ed.select(made.text.id);
      PT.A.setTool('edit');
      const back = await waitFor(() => [...doc().querySelectorAll('#props button')].find((b) => /Send to back/.test(b.textContent)), { timeout: 3000 });
      back.click();
      expect(page().annots.map((a) => a.id)).toEqual([made.cover.id, made.text.id]);
      PT.SP.layers.moveLayer(page().id, made.text.id, -1);
      expect(page().annots.map((a) => a.id)).toEqual([made.cover.id, made.text.id]);
    }, { timeout: 60000 });

    it('deleting the text keeps the cover (the old text stays hidden); undo and redo restore both exactly', async () => {
      const Ed = CV.Ed(), cover = CV.json(CV.find(made.cover.id)), text = CV.json(CV.find(made.text.id));
      Ed.select(made.text.id);
      Ed.deleteSelected();
      expect(CV.find(made.text.id)).toBe(null);
      expect(CV.json(CV.find(made.cover.id))).toBe(cover);
      const blocks = await CV.S().para.blocksOf(page());
      expect(blocks.some((b) => b.lines.some((l) => /print shop/.test(l.text)))).toBe(false, 'the old line is still hidden');
      PT.A.undo();
      expect(CV.json(CV.find(made.text.id))).toBe(text);
      expect(CV.json(CV.find(made.cover.id))).toBe(cover);
      PT.A.redo();
      expect(CV.find(made.text.id)).toBe(null);
      expect(CV.json(CV.find(made.cover.id))).toBe(cover);
      expect(CV.hit(SE.elOf(made.cover.id))).toBe(false);
      // Clear page annotations (Edit panel) clears what was added, not the cover
      PT.A.undo();
      PT.A.setTool('edit');
      const clear = await waitFor(() => [...doc().querySelectorAll('#props button')].find((b) => /Clear page annotations/.test(b.textContent)), { timeout: 3000 });
      clear.click();
      const ok = await waitFor(() => [...doc().querySelectorAll('.sui-dlg .sui-btn')].find((b) => b.textContent === 'Clear'), { timeout: 3000 });
      ok.click();
      await waitFor(() => !CV.find(made.text.id));
      expect(page().annots.map((a) => a.id)).toEqual([made.cover.id]);
      PT.A.undo();
      await waitFor(() => !doc().querySelector('.sui-back'), { timeout: 3000 }); // the question has faded out
    }, { timeout: 60000 });

    it('Paragraphs with the select tool: the frame says its old lines are under covers; they belong to it and stay put', async () => {
      const Ed = CV.Ed(), y = 320 - 160 - 4;
      await SE.tap(SE.at(60, y));
      const fr = await SE.frame();
      const note = fr.querySelector('.para-note');
      expect(!!note && !note.hidden).toBe(true, 'the frame has the note');
      expect(note.textContent).toBe(CV.NOTE);
      await PP.type('A new paragraph');
      const a = PP.para(), covers = page().annots.filter((c) => c.of === a.id);
      expect(covers.length).toBe(2, 'one cover per old line, each belonging to the frame');
      expect(covers.every((c) => CV.isCover(c))).toBe(true);
      expect(!doc().querySelector('.para-frame .para-note').hidden).toBe(true, 'the frame annotation still says so');
      const before = CV.json(covers);
      await PP.dragFrame(40, 20);
      expect(PP.para().cx > a.cx + 10).toBe(true, 'the frame moved');
      expect(CV.json(page().annots.filter((c) => c.of === a.id))).toBe(before);
      SE.key(doc().querySelector('.para-frame'), 'Delete');
      await waitFor(() => !PP.para());
      expect(CV.json(page().annots.filter((c) => c.of === a.id))).toBe(before, 'deleting the frame keeps its covers');
      expect(Ed.editText).toBe(false);
    }, { timeout: 60000 });

    it('Remove, Replace and the selection\'s lift make the same covers', async () => {
      await SE.open(await CV.pdf(), 'cover-more.pdf');
      const span = await waitFor(() => [...doc().querySelectorAll('.pv-textlayer span')].find((s) => s.textContent === CV.LINE), { timeout: 8000 });
      const sel = PT.win.getSelection(), r = doc().createRange();
      r.selectNodeContents(span); sel.removeAllRanges(); sel.addRange(r);
      const bar = await waitFor(() => { const b = doc().querySelector('.selbar'); return b && !b.hidden && b.querySelector('[data-act="remove"]') ? b : null; }, { timeout: 5000 });
      bar.querySelector('[data-act="remove"]').click();
      const removed = await waitFor(() => page().annots.find((a) => a.type === 'whiteout'), { timeout: 8000 });
      expect(CV.isCover(removed)).toBe(true);
      expect(removed.of).toBe(undefined, 'a removal has no new text');
      PT.win.SlopPdfFind.openReplace('paragraph', { caseSensitive: false, wholeWord: false });
      await waitFor(() => doc().querySelectorAll('.find-rlist li').length === 1, { timeout: 5000 });
      doc().querySelector('.find-modal input[aria-label="Replace with"]').value = 'note';
      doc().querySelector('.find-go').click();
      const rep = await waitFor(() => page().annots.find((a) => a.type === 'text' && a.text === 'note'), { timeout: 8000 });
      expect(page().annots.some((a) => CV.isCover(a) && a.of === rep.id)).toBe(true, 'Replace: the cover belongs to its text');
      const cancel = doc().querySelector('.find-modal:not([hidden]) .find-cancel'); if (cancel) cancel.click();
      const span2 = await waitFor(() => [...doc().querySelectorAll('.pv-textlayer span')].find((s) => /stays together/.test(s.textContent)), { timeout: 8000 });
      r.selectNodeContents(span2); sel.removeAllRanges(); sel.addRange(r);
      await waitFor(() => doc().querySelector('.sel-box.is-text'), { timeout: 5000 });
      CV.Ed().select(null); // the box is the text selection's, not an annotation's
      await SE.drag(doc().querySelector('.sel-box.is-text'), 30, 0);
      const lifted = await waitFor(() => page().annots.find((a) => a.type === 'text' && /stays together/.test(a.text)), { timeout: 5000 });
      expect(page().annots.some((a) => CV.isCover(a) && a.of === lifted.id)).toBe(true, 'the lift: the cover belongs to the lifted text');
      restore();
    }, { timeout: 60000 });
  });
})();
