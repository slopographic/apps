/* Slop Font: the rest of the right panel. Characters (add a whole set, keep only some: a subset), Handwriting (print a
 * sheet to fill in, read a photo of it), Export (the format) and the panel's foot, always in reach: Download font (the
 * main action), Save to Slop Drive…, Save project, Copy CSS and Open in…. Classic script, before js/panel.js mounts.
 *   FC.panelMore.sections() → the panel's sections   paint()   subset(text)   addSet(id) */
(function (g) {
  'use strict';
  const S = () => g.FC.state, F = () => g.SlopFont;
  const el = (tag, attrs = {}, ...kids) => { const n = document.createElement(tag); for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]); n.append(...kids); return n; };
  const parts = {};
  const safe = (fn) => () => Promise.resolve().then(fn).catch((e) => g.SlopUI.toast(e.message));
  const button = (id, label, run) => { const b = el('button', { type: 'button', class: 'sui-btn', id }, label); b.addEventListener('click', safe(run)); return b; };
  const field = (label, control, note) => { const l = el('label', { class: 'sf-field' }, el('span', { class: 'sf-lab' }, label), control); if (note) l.append(el('span', { class: 'sf-note' }, note)); return l; };

  function addSet(id) {
    const cps = F().charset.codes(id), p = S().project(), missing = cps.filter((c) => !p.glyphs.some((x) => x.unicode === c));
    if (!missing.length) { g.SlopUI.toast('Every character of that set is in the font already'); return 0; }
    S().edit(`Add ${missing.length} characters`, 'project', (pp) => { for (const c of missing) F().model.ensure(pp, c); });
    g.SlopUI.toast(`Added ${missing.length} empty glyphs to draw`);
    return missing.length;
  }
  function subset(textOrSet) {
    const CS = F().charset;
    const cps = CS.SETS.some((s) => s.id === textOrSet) || textOrSet === 'all' ? CS.codes(textOrSet) : CS.parseChars(textOrSet);
    if (!cps.length) throw new Error('Give the characters to keep');
    const before = S().project().glyphs.length;
    S().edit('Keep only some characters', 'project', (p) => { F().model.subset(p, cps.concat(0x20)); });
    const n = before - S().project().glyphs.length;
    g.SlopUI.toast(n ? `Removed ${n} glyph${n === 1 ? '' : 's'}; ${S().project().glyphs.length} left` : 'Nothing to remove');
    return n;
  }
  function sections() {
    const setSel = el('select', { id: 'fc-add-set' });
    for (const s of F().charset.SETS) setSel.append(el('option', { value: s.id }, s.label));
    const keep = el('input', { type: 'text', id: 'fc-keep', placeholder: 'ABC abc 0123 .,!?', autocomplete: 'off', spellcheck: 'false' });
    const format = el('select', { id: 'fc-format' });
    for (const f of g.FC.io.FORMATS) format.append(el('option', { value: f.id }, f.label));
    format.addEventListener('change', () => S().set({ format: format.value }));
    Object.assign(parts, { setSel, keep, format });
    return [
      { title: 'Characters', key: 'chars', settings: [
        el('div', { class: 'fc-row' }, field('Add a set', setSel), button('fc-add-set-go', 'Add', () => addSet(setSel.value))),
        el('div', { class: 'fc-row' }, field('Keep only these (subset)', keep, 'Every other glyph is removed, with its kerning. Undo brings them back.'),
          button('fc-keep-go', 'Keep', async () => {
            if (!keep.value.trim()) throw new Error('Type the characters to keep');
            if (await g.SlopUI.confirm('Make a subset?', `Keep only the characters “${keep.value.trim().slice(0, 80)}” and remove the rest?`, 'Keep only these', { danger: true })) subset(keep.value);
          }))] },
      { title: 'Handwriting', key: 'hand', settings: [
        el('p', { class: 'sf-note' }, 'Print a sheet with a box for each letter, write in it with a dark pen, then photograph or scan it and read it back: every box becomes a glyph.'),
        el('div', { class: 'fc-btns' }, button('fc-sheet-print', 'Print a sheet…', () => g.FC.sheetUi.template()), button('fc-sheet-read', 'Read a filled sheet…', () => g.FC.sheetUi.pick()))] },
      { title: 'Export', key: 'export', settings: [field('Format', format, 'WOFF2 and WOFF are for websites; TTF and OTF install on a computer.'),
        el('div', { class: 'fc-btns' }, button('fc-css', 'Copy CSS @font-face', () => g.FC.io.copyCss()), button('fc-dl-project', 'Download project (.sfont)', () => g.FC.io.download('sfont')))] },
    ];
  }
  function paint() {
    if (!parts.format) return;
    const s = S().settings(), f = g.FC.io.FORMATS.find((x) => x.id === s.format) || g.FC.io.FORMATS[0], st = F().model.stats(S().project());
    parts.format.value = f.id;
    const side = g.FC.panel.side();
    if (!side) return;
    const none = !st.drawn, IO = g.FC.io;
    side.footer([
      { id: 'fc-download', label: `Download font (.${f.ext})`, primary: true, disabled: none && f.id !== 'sfont', run: () => IO.download().catch((e) => g.SlopUI.toast(e.message)) },
      { id: 'fc-drive', label: 'Save to Slop Drive…', disabled: none && f.id !== 'sfont', run: () => IO.saveToDrive().catch((e) => g.SlopUI.toast('Could not save: ' + e.message)) },
      { id: 'fc-save-project', label: 'Save project', run: () => IO.saveToDrive('sfont').catch((e) => g.SlopUI.toast('Could not save: ' + e.message)) },
      { id: 'fc-openin', label: 'Open in…', disabled: none, menu: () => IO.openInItems() },
    ], { stack: true, more: 'Settings', note: none ? 'Draw a glyph to make a font' : `${st.drawn} of ${st.glyphs} glyphs drawn · ${st.pairs} kerning pair${st.pairs === 1 ? '' : 's'}${S().dirty() ? ' · changed since saved' : ''}` });
  }
  g.FC.panelMore = { sections, paint, subset, addSet };
})(window);
