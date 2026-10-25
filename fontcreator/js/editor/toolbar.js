/* Slop Font: the bar above the glyph editor. "‹ Glyphs" (phones: back to the grid), the glyph's name and code, the
 * previous and next glyph, the tools (Select, Pen, Rectangle, Ellipse, Stroke; also their letter keys), Undo and Redo,
 * the Path menu (Union, Subtract, Intersect, Exclude, Remove overlap, Flip, Clear), snapping and the zoom. Every button
 * calls the same function as its Ctrl+K command (js/commands.js). Classic script. FC.toolbar.mount(host), paint(). */
(function (g) {
  'use strict';
  const S = () => g.FC.state, CS = () => g.SlopFont.charset;
  const el = (tag, attrs = {}, ...kids) => { const n = document.createElement(tag); for (const k in attrs) n.setAttribute(k, attrs[k]); n.append(...kids); return n; };
  const ICON = {
    select: '<path d="M6 3l12 8-5 1.5 3 6-2.5 1.2-3-6L6 17z"/>', pen: '<path d="M12 3l6 9-6 9-6-9z"/><circle cx="12" cy="12" r="1.6"/>',
    rect: '<rect x="4" y="6" width="16" height="12" rx="1"/>', ellipse: '<ellipse cx="12" cy="12" rx="8" ry="6"/>', stroke: '<path d="M4 18c3-9 6-12 8-6s5 3 8-6" stroke-width="3" stroke-linecap="round"/>',
  };
  let bar = null, title = null, toolBtns = {}, undoB = null, redoB = null, snapB = null;
  const safe = (fn) => () => { try { const r = fn(); if (r && r.catch) r.catch((e) => g.SlopUI.toast(e.message)); } catch (e) { g.SlopUI.toast(e.message); } };
  function btn(id, label, run, extra = {}) {
    const b = el('button', Object.assign({ type: 'button', class: 'sui-btn fc-tb', id, title: label, 'aria-label': label }, extra));
    if (extra.icon) { b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${extra.icon}</svg>`; b.removeAttribute('icon'); } else b.textContent = extra.text || label;
    b.addEventListener('click', safe(run));
    return b;
  }
  function step(d) {
    const ids = [...document.querySelectorAll('#fc-cells .fc-cell')].map((c) => c.dataset.id), i = ids.indexOf(S().cur());
    const to = ids[(i + d + ids.length) % ids.length];
    if (to) S().select(to);
  }
  const PATH = [['union', 'Union (join the selected contours)'], ['minus', 'Subtract (cut the others from the first)'], ['intersect', 'Intersect (keep the overlap)'],
    ['exclude', 'Exclude (keep what does not overlap)'], ['merge', 'Remove overlap (the whole glyph)'], ['flip-h', 'Flip horizontally'], ['flip-v', 'Flip vertically'],
    ['all', 'Select all points'], ['clear', 'Clear the glyph']];
  function pathPick(v) {
    const O = g.FC.ops;
    try {
      if (v === 'merge') O.merge(); else if (v === 'flip-h') O.flip('h'); else if (v === 'flip-v') O.flip('v');
      else if (v === 'all') g.FC.tools.all.select.selectAll(); else if (v === 'clear') O.clear(); else O.boolean(v);
    } catch (e) { g.SlopUI.toast(e.message); }
  }
  function mount(host) {
    bar = el('div', { class: 'fc-toolbar', id: 'fc-toolbar', role: 'toolbar', 'aria-label': 'Glyph editor' });
    const back = btn('fc-back', 'Back to the glyphs', () => g.FC.main.frame().showList(), { text: '‹ Glyphs', class: 'sui-btn fc-tb fc-back' });
    title = el('div', { class: 'fc-gtitle', id: 'fc-gtitle', 'aria-live': 'polite' });
    const nav = el('div', { class: 'fc-tb-group' }, btn('fc-prev', 'Previous glyph', () => step(-1), { text: '‹' }), btn('fc-next', 'Next glyph', () => step(1), { text: '›' }));
    const tools = el('div', { class: 'fc-tb-group', role: 'group', 'aria-label': 'Tools' });
    for (const [id, label, key] of g.FC.tools.IDS) {
      toolBtns[id] = btn('fc-tool-' + id, `${label} (${key})`, () => g.FC.tools.set(id), { icon: ICON[id], 'aria-pressed': 'false' });
      tools.append(toolBtns[id]);
    }
    undoB = btn('fc-undo', 'Undo (Ctrl+Z)', () => { if (!S().undo()) g.SlopUI.toast('Nothing to undo'); }, { text: 'Undo' });
    redoB = btn('fc-redo', 'Redo (Ctrl+Shift+Z)', () => { if (!S().redo()) g.SlopUI.toast('Nothing to redo'); }, { text: 'Redo' });
    const path = btn('fc-path', 'Path operations', () => {}, { text: 'Path ▾' });
    if (g.SlopMenuButton) g.SlopMenuButton.attach(path, { label: 'Path operations', search: false, items: () => PATH.map(([value, label]) => ({ value, label })), onPick: pathPick });
    snapB = btn('fc-snap', 'Snap to the grid and the metric lines', () => S().set({ snap: !S().settings().snap }), { text: 'Snap', 'aria-pressed': 'true' });
    const zoom = el('div', { class: 'fc-tb-group' }, btn('fc-zoom-out', 'Zoom out', () => g.FC.editor.zoomBy(1 / 1.25), { text: '−' }),
      btn('fc-zoom-fit', 'Fit the glyph in view', () => g.FC.editor.fit(), { text: 'Fit' }), btn('fc-zoom-in', 'Zoom in', () => g.FC.editor.zoomBy(1.25), { text: '+' }));
    bar.append(back, title, nav, tools, el('div', { class: 'fc-tb-group' }, undoB, redoB, path, snapB), zoom);
    host.append(bar);
    S().on(paint);
    paint();
  }
  function paint() {
    if (!bar) return;
    const v = S().view(), cp = v.unicode;
    title.replaceChildren(el('span', { class: 'fc-gchar' }, cp != null ? CS().label(cp) : v.name), el('span', { class: 'fc-gname' }, `${v.name}${cp != null ? ' · ' + CS().hex(cp) : ''}${v.virtual ? ' · not drawn yet' : ''}`));
    const tool = S().settings().tool;
    for (const id in toolBtns) toolBtns[id].setAttribute('aria-pressed', String(id === tool));
    undoB.disabled = !S().canUndo(); redoB.disabled = !S().canRedo();
    undoB.title = S().canUndo() ? `Undo ${S().undoLabel()} (Ctrl+Z)` : 'Nothing to undo';
    snapB.setAttribute('aria-pressed', String(!!S().settings().snap));
  }
  g.FC.toolbar = { mount, paint, step };
})(window);
