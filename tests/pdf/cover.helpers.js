/* Helpers for the cover tests (window.CV): a two-page PDF with a line and a paragraph, the cover path forced (the old text
   "cannot be taken out of the page", as text in a form or in a font that cannot be measured), an edit in Edit text ▸ Lines,
   what the browser hits at the points of an element, and the save question's dialog. */
(function () {
  'use strict';
  const { waitFor, sleep } = SlopTest;
  const CV = window.CV = {};
  const doc = () => PT.win.document;
  CV.Ed = () => PT.SP.editor;
  CV.S = () => PT.SP.editor._;
  CV.LINE = 'The browser is the new print shop';
  CV.NOTE = 'The old text can’t be taken out of this page; it’s hidden under a cover.';

  /** Page 1 (420 × 320): the line (16 pt, baseline 260) and a two-line paragraph (12 pt, baselines 160 and 145); page 2:
   * "Other page". */
  CV.pdf = () => PP.pdf((pg, f) => {
    pg.drawText(CV.LINE, { x: 40, y: 260, size: 16, font: f.hel });
    PP.lines(pg, f.hel, ['A paragraph of two lines', 'that stays together here.'], 40, 160);
    f.doc.addPage(PT.win.Array.of(420, 320)).drawText('Other page', { x: 40, y: 260, size: 16, font: f.hel });
  });
  /** The old text cannot be taken out of the page (text-strip.js X.take finds no way): the edits fall back to covers.
   * Returns the function that puts the real one back. */
  CV.force = function () {
    const X = CV.S().strip, take = X.take;
    X.take = async () => ({ to: null, paper: [] });
    return () => { X.take = take; };
  };
  /** Edits the line in Edit text ▸ Lines to `text` (Enter applies). Returns { cover, text, info } once it is committed. */
  CV.editLine = async function (text) {
    const Ed = CV.Ed();
    Ed.setEditTextMode('lines');
    if (!Ed.editText) Ed.toggleEditText();
    const at = SE.at(60, 320 - 260 - 5), el = CV.S().slots.get(Ed.pid).el, n = PT.E.state.pages[0].annots.length;
    el.dispatchEvent(new PT.win.PointerEvent('pointerdown', Object.assign({ button: 0, bubbles: true, cancelable: true, pointerType: 'mouse', isPrimary: true, pointerId: 3 }, at)));
    const input = await waitFor(() => doc().querySelector('.edit-run'), { timeout: 10000 });
    await (CV.S().runEdit.took || null); // the take the editor started (edit-text.js)
    await sleep(30);
    const info = doc().querySelector('.edit-info').textContent;
    input.value = text;
    input.dispatchEvent(new PT.win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await waitFor(() => PT.E.state.pages[0].annots.length > n, { timeout: 10000 });
    Ed.toggleEditText();
    const added = PT.E.state.pages[0].annots.slice(n);
    return { cover: added.find((a) => a.type === 'whiteout'), text: added.find((a) => a.type === 'text'), info };
  };
  /** The elements the browser hit-tests at a grid of points over an element: does any of them belong to it? */
  CV.hit = function (el) {
    const r = el.getBoundingClientRect();
    for (let i = 1; i < 8; i++) for (let j = 1; j < 4; j++) {
      const all = doc().elementsFromPoint(r.left + r.width * i / 8, r.top + r.height * j / 4);
      if (all.some((x) => el.contains(x))) return true;
    }
    return false;
  };
  /** A client point inside the cover right of the new text (the cover only), and the element a press there reaches. */
  CV.coverOnly = function (cover, text) {
    const c = SE.elOf(cover.id).getBoundingClientRect(), t = SE.elOf(text.id).getBoundingClientRect();
    const pt = { clientX: (Math.max(t.right, c.left) + c.right) / 2, clientY: c.top + c.height / 2 };
    return { pt, el: doc().elementFromPoint(pt.clientX, pt.clientY) };
  };
  /** A cover over old text as an edit saves it (core/layers.js L.isCover): a whiteout marked hides: 'text'. */
  CV.isCover = (a) => !!a && a.type === 'whiteout' && a.hides === 'text';
  CV.json = (a) => JSON.stringify(a);
  CV.find = (id, pi = 0) => PT.E.state.pages[pi].annots.find((a) => a.id === id) || null;

  /** The save question (ui/cover-save.js), once it shows. */
  CV.dialog = () => waitFor(() => doc().querySelector('.sui-dlg.cover-save'), { timeout: 8000 });
  /** Clicks a button of the save question by its words. */
  CV.choose = async function (label) {
    const d = await CV.dialog(), b = [...d.querySelectorAll('.sui-btn')].find((x) => x.textContent === label);
    b.click();
    await waitFor(() => !doc().querySelector('.sui-dlg.cover-save'), { timeout: 3000 });
  };
  /** The text of each page of a saved PDF, read back with pdf.js. */
  CV.texts = async (blob) => (await PT.read(await PT.bytesOf(blob))).pages.map((p) => p.text);
})();
