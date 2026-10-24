/* Slop Gallery: the timeline. Photos grouped by month, newest first, with a sticky month header and a virtual grid.
 * Click opens the viewer; ctrl/cmd or shift click (or select mode) toggles selection; arrow keys move between tiles.
 * It also owns the visible order (visibleIds) that the viewer and Sort mode use as their queue.
 * Exposes window.SlopGallery.timeline. */
(function () {
  'use strict';
  const G = (window.SlopGallery = window.SlopGallery || {});
  const GAP = 4, HEAD_H = 40;
  let els = null, vl = null, cur = { ids: [], rows: [], heads: [], cols: 1, cell: 120, count: 0 };
  let lastCols = -1, lastCell = -1, lastKey = '';

  const tileSize = () => (window.matchMedia && matchMedia('(max-width: 600px)').matches ? 104 : 150);

  /** The filtered, newest-first photo list for the current view and filters. */
  function photos() {
    const L = G.library, st = G.state.state;
    const base = G.query.sortNewest(L.list());
    const shown = G.query.filter(base, st.query, L.albums());
    if (st.view === 'dupes') return G.query.dupeGroups(L.list()).flatMap((g) => g.items).sort((a, b) => (a.sha < b.sha ? -1 : a.sha > b.sha ? 1 : 0));
    if (st.view === 'people') return G.people.checked(shown);
    return shown;
  }
  function layout() {
    const w = Math.max(120, els.scroller.clientWidth - 16);
    const target = tileSize();
    const cols = Math.max(1, Math.floor((w + GAP) / (target + GAP)));
    const cell = Math.floor((w - GAP * (cols - 1)) / cols);
    return { cols, cell };
  }

  function tileEl(item, cell) {
    const m = item.meta, st = G.state.state;
    const t = document.createElement('button');
    t.type = 'button';
    t.className = 'tile' + (st.selected.has(m.id) ? ' sel' : '');
    t.dataset.id = m.id;
    t.dataset.idx = String(item.idx);
    t.tabIndex = -1;
    t.setAttribute('aria-label', m.name + ', ' + new Date(m.takenAt || 0).toLocaleDateString());
    t.style.width = cell + 'px'; t.style.height = cell + 'px';
    const img = document.createElement('img');
    img.alt = ''; img.decoding = 'async'; img.draggable = false;
    G.urls.thumb(m.id).then((u) => { if (u && t.isConnected) img.src = u; });
    t.append(img);
    if (m.fav) t.insertAdjacentHTML('beforeend', '<span class="mk fav" aria-hidden="true">★</span>');
    if (m.liked) t.insertAdjacentHTML('beforeend', '<span class="mk ' + m.liked + '" aria-hidden="true"></span>');
    t.insertAdjacentHTML('beforeend', '<span class="tick" aria-hidden="true"></span>');
    return t;
  }
  function renderRow(row) {
    if (row.kind === 'head') {
      const h = document.createElement('div');
      h.className = 'vhead';
      h.dataset.month = row.key;
      h.innerHTML = '<span class="vhead-l"></span><span class="vhead-n"></span>';
      h.firstChild.textContent = row.label;
      h.lastChild.textContent = row.count + (row.count === 1 ? ' photo' : ' photos');
      return h;
    }
    const r = document.createElement('div');
    r.className = 'vrow';
    r.style.gridTemplateColumns = `repeat(${row.items.length ? cur.cols : 1}, ${row.cell}px)`;
    r.style.gap = GAP + 'px';
    for (const it of row.items) r.append(tileEl(it, row.cell));
    return r;
  }

  function onScroll(st) {
    const heads = cur.heads;
    let lo = 0, hi = heads.length - 1, found = null;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (heads[mid].top <= st + 1) { found = heads[mid]; lo = mid + 1; } else hi = mid - 1; }
    els.sticky.hidden = !found;
    if (found) {
      const label = els.sticky.querySelector('.sticky-l'), n = els.sticky.querySelector('.sticky-n');
      if (label.textContent !== found.label) label.textContent = found.label;
      const txt = found.count + (found.count === 1 ? ' photo' : ' photos');
      if (n.textContent !== txt) n.textContent = txt;
    }
  }

  /** Recomputes the list and the rows. Called on library, filter and view changes, and when the width changes. */
  function render() {
    if (!vl) return;
    const list = photos();
    const people = G.state.state.view === 'people';
    const { cols, cell } = layout();
    // People groups by face count (core/people.js); every other view groups by month. The grid order is the groups' order.
    const groups = people ? G.people.groups(list) : G.query.groupMonths(list);
    const ids = groups.flatMap((g) => g.items.map((m) => m.id));
    const key = ids.length + '|' + cols + '|' + cell + '|' + ids.join(',') + (people ? '|people|' + groups.map((g) => g.key + ':' + g.items.length).join(',') : '');
    const sameLayout = key === lastKey;
    lastKey = key;
    if (!sameLayout || cols !== lastCols || cell !== lastCell) {
      const built = G.rows.build(groups, { cols, cell, gap: GAP, headH: HEAD_H });
      cur = { ids, rows: built.rows, heads: built.heads, cols, cell, count: built.count };
      lastCols = cols; lastCell = cell;
      vl.setRows(built.rows);
    }
    G.state.pruneSelection({ has: (id) => !!G.library.photo(id) }); // hidden by a filter is not gone: only removed photos leave the selection
    els.empty.hidden = people || list.length > 0 || !G.library.loaded; // People explains its own empty state in the bar
    els.empty.querySelector('[data-empty-text]').textContent = G.library.size ? 'Nothing matches these filters.' : 'Your library is empty. Import photos to start.';
    for (const n of els.empty.querySelectorAll('[data-empty-intro]')) n.hidden = G.library.size > 0; // the preview is for an empty library
    markSelection();
  }
  function markSelection() {
    const sel = G.state.state.selected;
    for (const t of els.content.querySelectorAll('.tile')) t.classList.toggle('sel', sel.has(t.dataset.id));
    els.status.textContent = G.library.size ? `${cur.ids.length} of ${G.library.size} photos` + (sel.size ? ` · ${sel.size} selected` : '') : '';
  }

  function tileOf(target) { return target && target.closest ? target.closest('.tile') : null; }
  function openAt(idx) { G.viewer && G.viewer.open(cur.ids, idx); }
  function onClick(e) {
    const t = tileOf(e.target);
    if (!t) return;
    const id = t.dataset.id, st = G.state.state;
    if (e.ctrlKey || e.metaKey || e.shiftKey || st.selectMode) {
      if (e.shiftKey && st.lastId && cur.ids.includes(st.lastId)) {
        const a = cur.ids.indexOf(st.lastId), b = cur.ids.indexOf(id);
        G.state.select(cur.ids.slice(Math.min(a, b), Math.max(a, b) + 1), true);
      } else G.state.select(id, !st.selected.has(id));
      st.lastId = id;
      markSelection();
      return;
    }
    st.lastId = id;
    openAt(Number(t.dataset.idx));
  }
  function onKey(e) {
    const t = tileOf(document.activeElement);
    if (e.key === 'Enter' && t) { e.preventDefault(); openAt(Number(t.dataset.idx)); return; }
    if (e.key === ' ' && t) { e.preventDefault(); G.state.select(t.dataset.id, !G.state.state.selected.has(t.dataset.id)); markSelection(); return; }
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cur.cols, ArrowUp: -cur.cols }[e.key];
    if (!step) return;
    e.preventDefault();
    const from = t ? Number(t.dataset.idx) : -1;
    const to = Math.max(0, Math.min(cur.ids.length - 1, from < 0 ? 0 : from + step));
    focusIndex(to);
  }
  function focusIndex(i) {
    const id = cur.ids[i];
    if (id == null) return;
    const rowIdx = cur.rows.findIndex((r) => r.kind === 'tiles' && r.items.some((x) => x.idx === i));
    if (rowIdx < 0) return;
    vl.scrollToIndex(rowIdx);
    requestAnimationFrame(() => {
      const el = els.content.querySelector(`.tile[data-id="${CSS.escape(id)}"]`);
      if (el) { els.content.querySelectorAll('.tile[tabindex="0"]').forEach((x) => (x.tabIndex = -1)); el.tabIndex = 0; el.focus({ preventScroll: true }); }
    });
  }

  /** Mounts the timeline on the given elements and renders. */
  function init(opts) {
    els = opts;
    vl = G.createVlist({ scroller: els.scroller, content: els.content, render: renderRow, onScroll });
    els.scroller.addEventListener('click', onClick);
    els.scroller.addEventListener('keydown', onKey);
    els.scroller.addEventListener('focusin', (e) => { const t = tileOf(e.target); if (t) { els.content.querySelectorAll('.tile[tabindex="0"]').forEach((x) => (x.tabIndex = -1)); t.tabIndex = 0; } });
    let w = els.scroller.clientWidth;
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { if (els.scroller.clientWidth !== w) { w = els.scroller.clientWidth; render(); } }) : null;
    if (ro) ro.observe(els.scroller); else window.addEventListener('resize', render);
    G.state.subscribe((what) => { if (what === 'selection') markSelection(); else render(); });
    G.library.on(() => render());
    G.people.subscribe(() => { if (G.state.state.view === 'people') render(); }); // a face result arrives: regroup
    render();
  }

  G.timeline = {
    init, render, focusIndex,
    visibleIds: () => cur.ids.slice(),
    get count() { return cur.ids.length; },
    /** Scrolls the grid to a month header, by its key 'YYYY-MM'. */
    jumpToMonth(key) { const i = vl && vl.rowIndexOf('h:' + key); if (i >= 0) vl.scrollToIndex(i); },
    /** Rendered tile count (tests use it to check that the grid is virtualised). */
    rendered: () => (vl ? els.content.querySelectorAll('.tile').length : 0),
    tileOf: (id) => (els ? els.content.querySelector(`.tile[data-id="${CSS.escape(id)}"]`) : null),
  };
})();
