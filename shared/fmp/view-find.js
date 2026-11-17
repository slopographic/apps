/* SlopFmpView.finder(grid, table): the "Find in this table" box. Enter finds the next row with the text in any cell
   (Shift+Enter the previous), looking at the pages already loaded first and then paging onward until it is found,
   round the end of the table once. The row is scrolled to and marked. A new text starts where the person is looking.
   Typing, Escape and destroy() stop a search under way.   → { el, destroy() }   Classic script, after view-grid.js. */
(function () {
  'use strict';
  const V = window.SlopFmpView;

  V.finder = function (grid) {
    const W = V.words(), n = grid.rowCount;
    const wrap = V.el('div', 'sfv-find', null, { role: 'search' });
    const input = V.el('input', 'sfv-find-in', null, { type: 'search', autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'search' });
    W.attr(input, 'aria-label', () => V.tr('ui.fmp.find'));
    W.attr(input, 'placeholder', () => V.tr('ui.fmp.find'));
    const prev = V.el('button', 'sfv-btn', null, { type: 'button' }), next = V.el('button', 'sfv-btn', null, { type: 'button' });
    W.text(prev, () => V.tr('ui.fmp.find_prev'));
    W.text(next, () => V.tr('ui.fmp.find_next'));
    const status = V.el('span', 'sfv-find-st', null, { role: 'status', 'aria-live': 'polite' });
    wrap.append(input, prev, next, status);
    let cur = null, lastQ = '', token = 0;

    const say = (key, vars) => { status.textContent = key ? V.tr(key, vars) : ''; };
    /** The first column of the row that holds q (lower case), or -1. */
    const colOf = (row, q) => { for (let i = 0; i < row.length; i++) if (row[i] != null && String(row[i]).toLowerCase().includes(q)) return i; return -1; };

    async function run(dir) {
      const q = input.value.toLowerCase();
      if (!q || !n) { say(''); return; }
      const my = ++token;
      let row = (((cur !== null && q === lastQ ? cur + dir : grid.topRow()) % n) + n) % n, left = n;
      say('ui.fmp.searching', { done: 0, total: n });
      try {
        while (left > 0) {
          const p = Math.floor(row / V.PAGE), rows = await grid.page(p);
          if (my !== token) return;
          const base = p * V.PAGE, before = left;
          let i = row - base;
          if (dir > 0) { for (; i < rows.length && left > 0; i++, left--) { const c = colOf(rows[i], q); if (c >= 0) return found(base + i, c, q); } }
          else { for (i = Math.min(i, rows.length - 1); i >= 0 && left > 0; i--, left--) { const c = colOf(rows[i], q); if (c >= 0) return found(base + i, c, q); } }
          if (left === before) break; // a page with fewer rows than the table says: nowhere further to look
          row = (((dir > 0 ? base + rows.length : base - 1) % n) + n) % n;
          say('ui.fmp.searching', { done: n - left, total: n });
        }
        cur = null;
        grid.clear();
        say('ui.fmp.not_found');
      } catch (e) {
        if (my === token) say('ui.fmp.find_failed');
      }
    }
    function found(row, col, q) {
      cur = row;
      lastQ = q;
      grid.show(row, col, q);
      say('ui.fmp.found', { row: row + 1 });
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); run(e.shiftKey ? -1 : 1); }
      else if (e.key === 'Escape' && status.textContent) { token++; say(''); }
    });
    input.addEventListener('input', () => { token++; cur = null; grid.clear(); say(''); });
    prev.addEventListener('click', () => run(-1));
    next.addEventListener('click', () => run(1));
    return { el: wrap, destroy() { token++; W.destroy(); } };
  };
})();
