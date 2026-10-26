/* SlopFinder: a search box (with optional suggestions), facet filters with counts, removable chips, and a view switch
 * (cards, a compact list or a sortable table) over any list of items. The logic is in model.js (window.SlopFinderModel).
 * Classic script: SlopFinder.mount(host, options) returns { setItems, getFilter, clear, destroy }. Options:
 *   items, fields [{key,label,get}], searchKeys, facets [{key,label,values(item),format?}], columns [{key,label,get,render?,sortable?}],
 *   card(item), row(item), sort {key,dir}, urlPrefix (keys in SlopUrlState as "<prefix>.q", ".view", ...),
 *   placeholder, searchLabel, noun ('items' or ['item', 'items']), emptyText, resultsWhen ('filtered': cards view is hidden until a filter or search),
 *   facetsCollapsed (facets sit in a <details>), suggest {max, href(item), label(item), hint(item)} (a listbox under the
 *   search box; Enter opens the first one), autofocus (focuses the search box on mount), onChange(shown, filter),
 *   big (the large search box, without suggestions; Enter opens the first result shown),
 *   layout ('faucet': facets in a column on the left, the results on the right; stacked on narrow screens),
 *   rank(item, q) (a number; higher lists first when no column sort is chosen), view ('cards', 'list' or 'table': the view
 *   shown first, before the reader picks another).
 *   Returns { setItems, getFilter, clear, focus, destroy }. */
(function (win) {
  'use strict';
  const M = win.SlopFinderModel;
  /** The chrome's words in the chosen language (shared/i18n, keys finder.*), English without it. */
  const T = (key, en, vars) => { const I = win.SlopI18n, s = I && typeof I.t === 'function' ? I.t(key, vars) : key; return s === key ? (vars ? en.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : en) : s; };
  const VIEW_LABELS = { cards: T('finder.cards', 'Cards'), list: T('finder.list', 'List'), table: T('finder.table', 'Table') };
  let seq = 0;

  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : String(v));
    }
    for (const c of kids.flat()) if (c != null && c !== false) n.append(c instanceof Node ? c : document.createTextNode(String(c)));
    return n;
  }
  /** The URL scope, or null when the page has no SlopUrlState or no prefix was given. */
  const scopeFor = (prefix) => (prefix && win.SlopUrlState && win.SlopUrlState.scope ? win.SlopUrlState.scope(prefix) : null);
  function readUrl(scope) {
    const sort = scope.get('sort', '');
    return { q: scope.get('q', ''), view: scope.get('view', '') || undefined, facets: scope.get('facets', {}),
      sort: sort ? { key: sort, dir: scope.get('dir', 'asc') } : undefined };
  }
  function writeUrl(scope, st) {
    scope.set({ q: st.q.trim() || null, view: st.view === 'cards' ? null : st.view, sort: st.sort ? st.sort.key : null,
      dir: st.sort && st.sort.dir === 'desc' ? 'desc' : null, facets: Object.keys(st.facets).length ? st.facets : null }, { replace: true });
  }

  function mount(host, opts) {
    // noun: 'items', or ['item', 'items'] for the right word when there is one.
    const noun = (n) => (Array.isArray(opts.noun) ? opts.noun[n === 1 ? 0 : 1] : opts.noun || 'items');
    const spec = { fields: opts.fields || [], searchKeys: opts.searchKeys, facets: opts.facets || [], columns: opts.columns || [], sort: opts.sort, rank: opts.rank, view: opts.view };
    const scope = scopeFor(opts.urlPrefix);
    const id = 'fd' + (++seq);
    let items = (opts.items || []).slice();
    let st = M.normalizeState(scope ? readUrl(scope) : {}, spec);
    let destroyed = false, active = -1, shown = [];

    const search = el('input', { type: 'search', class: 'fd-input', id: id + '-q', placeholder: opts.placeholder || T('finder.search', 'Search'),
      'aria-label': opts.searchLabel || T('finder.search', 'Search'), autocomplete: 'off', spellcheck: 'false', role: opts.suggest ? 'combobox' : null,
      'aria-autocomplete': opts.suggest ? 'list' : null, 'aria-expanded': opts.suggest ? 'false' : null, 'aria-controls': opts.suggest ? id + '-list' : null });
    search.value = st.q;
    const suggest = opts.suggest ? el('ul', { class: 'fd-suggest', id: id + '-list', role: 'listbox', hidden: true, 'aria-label': 'Matching apps' }) : null;
    // The attribute is data-fd-view, not data-view: app.js routes every click on [data-view] to a page view, which hid the homepage.
  const views = M.VIEWS.map((v) => el('button', { type: 'button', class: 'fd-view', 'data-fd-view': v, 'aria-pressed': 'false',
      onclick: () => { st = { ...st, view: v }; update(); } }, VIEW_LABELS[v]));
    const facetBox = el('div', { class: 'fd-facets' });
    const facetWrap = opts.facetsCollapsed ? el('details', { class: 'fd-more' }, el('summary', { class: 'fd-more-sum' }, T('finder.filter_by', 'Filter by')), facetBox) : facetBox;
    const chipBox = el('div', { class: 'fd-chips', hidden: true });
    const count = el('p', { class: 'fd-count', 'aria-live': 'polite' });
    const results = el('div', { class: 'fd-results' });
    const empty = el('div', { class: 'fd-empty', hidden: true }, el('p', null, opts.emptyText || T('finder.no_matches', 'No matches.')),
      el('button', { type: 'button', class: 'fd-btn', onclick: () => clear() }, T('finder.clear_filters', 'Clear filters')));
    const bar = el('div', { class: 'fd-bar' }, el('div', { class: 'fd-search' }, el('label', { class: 'fd-sr', for: id + '-q' }, opts.searchLabel || T('finder.search', 'Search')), search, suggest),
      el('div', { class: 'fd-views', role: 'group', 'aria-label': T('finder.view', 'View') }, views));
    host.replaceChildren(el('div', { class: 'sf' + (opts.suggest || opts.big ? ' fd-big' : '') + (opts.layout === 'faucet' ? ' fd-faucet' : '') }, bar, facetWrap, chipBox, count, results, empty));

    /* ---------- suggestions: as you type, Enter opens the first match, arrows move through them ---------- */
    function paintSuggest() {
      if (!suggest) return;
      const q = st.q;
      const list = q.trim() ? M.filter(items, { ...st, facets: {} }, spec).slice(0, opts.suggest.max || 8) : [];
      suggest.replaceChildren(...list.map((it, i) => el('li', { role: 'option', id: id + '-o' + i, 'aria-selected': i === active ? 'true' : 'false',
        class: i === active ? 'is-on' : null, onmousedown: (e) => { e.preventDefault(); win.location.href = opts.suggest.href(it); } }, // touch-ok: before the field's blur; a tap sends it too
        el('a', { href: opts.suggest.href(it), tabindex: '-1' }, el('b', null, opts.suggest.label(it)), el('span', { class: 'fd-hint' }, opts.suggest.hint ? opts.suggest.hint(it) : '')))));
      suggest.hidden = !list.length;
      search.setAttribute('aria-expanded', String(!!list.length));
      if (active >= list.length) active = -1;
      search.setAttribute('aria-activedescendant', active >= 0 ? id + '-o' + active : '');
    }
    if (suggest) {
      search.addEventListener('keydown', (e) => {
        const n = suggest.children.length;
        if (e.key === 'ArrowDown' && n) { e.preventDefault(); active = (active + 1) % n; paintSuggest(); }
        else if (e.key === 'ArrowUp' && n) { e.preventDefault(); active = active <= 0 ? n - 1 : active - 1; paintSuggest(); }
        else if (e.key === 'Escape') { active = -1; suggest.hidden = true; search.setAttribute('aria-expanded', 'false'); }
        else if (e.key === 'Enter' && n) {
          e.preventDefault();
          const pick = suggest.children[active >= 0 ? active : 0];
          const link = pick && pick.querySelector('a');
          if (link) win.location.href = link.getAttribute('href');
        }
      });
      search.addEventListener('blur', () => setTimeout(() => { suggest.hidden = true; search.setAttribute('aria-expanded', 'false'); }, 150));
      search.addEventListener('focus', () => { paintSuggest(); });
    } else {
      // without suggestions (the big search box): Enter opens the first result shown, as it would be clicked
      search.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || e.isComposing || !st.q.trim()) return;
        const link = results.querySelector('a[href]:not([tabindex="-1"])');
        if (link) { e.preventDefault(); link.click(); }
      });
    }
    search.addEventListener('input', () => { st = { ...st, q: search.value }; active = -1; update(); });

    /* ---------- painting ---------- */
    /** A facet is a list of ticks. All ticked is the default (no filter); "All" puts the facet back to that. */
    function paintFacets(counts) {
      const check = (f, all, o) => {
        const sel = st.facets && st.facets[f.key];
        const box = el('input', { type: 'checkbox', checked: !sel || sel.includes(o.value) ? true : null });
        box.addEventListener('change', () => { st = M.setFacetValue(st, f.key, o.value, box.checked, all); update(); });
        return el('label', { class: 'fd-check' }, box, el('span', { class: 'fd-check-text' }, f.format ? f.format(o.value) : o.value),
          el('span', { class: 'fd-n' }, String(o.count)));
      };
      const group = (f) => {
        const list = counts[f.key] || [], all = list.map((o) => o.value), filtered = !!(st.facets && st.facets[f.key]);
        const reset = filtered ? el('button', { type: 'button', class: 'fd-link', onclick: () => {
          const facets = { ...st.facets }; delete facets[f.key]; st = { ...st, facets }; update(); } }, 'All') : null;
        return el('fieldset', { class: 'fd-facet' }, el('legend', null, f.label, reset ? ' ' : null, reset),
          el('div', { class: 'fd-checks' }, list.map((o) => check(f, all, o))));
      };
      facetBox.replaceChildren(...spec.facets.map(group));
      if (opts.facetsCollapsed) facetWrap.open = M.isFiltered(st) || facetWrap.open;
    }
    function paintChips() {
      const list = M.chips(st, spec);
      chipBox.hidden = !list.length;
      chipBox.replaceChildren(...list.map((c) => el('button', { type: 'button', class: 'fd-chip', 'aria-label': T('finder.remove', 'Remove {name}', { name: c.label }),
        onclick: () => { st = c.kind === 'q' ? { ...st, q: '' } : M.removeFacet(st, c.key, c.value); if (c.kind === 'q') search.value = ''; update(); } },
      c.label, el('span', { 'aria-hidden': 'true' }, ' ×'))), list.length ? el('button', { type: 'button', class: 'fd-link', onclick: () => clear() }, T('finder.clear_all', 'Clear all')) : null);
    }
    function paintResults() {
      if (opts.resultsWhen === 'filtered' && !M.isFiltered(st) && st.view === 'cards') { results.hidden = true; return; }
      results.hidden = false;
      if (st.view === 'table') {
        const head = spec.columns.map((c) => {
          const on = st.sort && st.sort.key === c.key;
          const label = on ? (st.sort.dir === 'desc' ? 'descending' : 'ascending') : 'not sorted';
          if (c.sortable === false) return el('th', { scope: 'col' }, c.label);
          return el('th', { scope: 'col', 'aria-sort': on ? (st.sort.dir === 'desc' ? 'descending' : 'ascending') : 'none' },
            el('button', { type: 'button', class: 'fd-sort', 'aria-label': `${c.label}, ${label}`,
              onclick: () => { st = { ...st, sort: M.nextSort(st.sort, c.key) }; update(); } }, c.label, el('span', { 'aria-hidden': 'true' }, on ? (st.sort.dir === 'desc' ? ' ↓' : ' ↑') : '')));
        });
        const rows = shown.map((it) => el('tr', null, spec.columns.map((c) => el('td', { 'data-col': c.key }, c.render ? c.render(it) : String(c.get(it) ?? '')))));
        results.replaceChildren(el('div', { class: 'fd-tablewrap' }, el('table', { class: 'fd-table' },
          el('thead', null, el('tr', null, head)), el('tbody', null, rows))));
      } else if (st.view === 'list') {
        results.replaceChildren(el('div', { class: 'fd-list' }, shown.map((it) => opts.row(it))));
      } else {
        results.replaceChildren(el('div', { class: 'fd-cards' }, shown.map((it) => opts.card(it))));
      }
    }
    function update() {
      if (destroyed) return;
      const matched = M.filter(items, st, spec);
      shown = st.sort ? M.sortItems(matched, spec.columns, st.sort) : M.rankItems(matched, st.q, spec);
      paintFacets(M.facetCounts(items, st, spec));
      paintChips();
      paintSuggest();
      for (const b of views) b.setAttribute('aria-pressed', String(b.dataset.fdView === st.view)), b.classList.toggle('is-on', b.dataset.fdView === st.view);
      count.textContent = M.isFiltered(st) ? T('finder.count_of', '{shown} of {n} {noun} match', { shown: matched.length, n: items.length, noun: noun(items.length) })
        : T('finder.count', '{n} {noun}', { n: items.length, noun: noun(items.length) });
      empty.hidden = matched.length > 0;
      paintResults();
      if (scope) writeUrl(scope, st);
      if (opts.onChange) opts.onChange(shown, getFilter());
    }
    function clear() {
      st = M.clearFilters(st);
      search.value = '';
      update();
    }
    function getFilter() { return JSON.parse(JSON.stringify(st)); }

    if (scope) scope.onChange(() => { if (!destroyed) { st = M.normalizeState(readUrl(scope), spec); search.value = st.q; update(); } });
    update();
    if (opts.autofocus) search.focus({ preventScroll: true });
    return {
      setItems(next) { items = (next || []).slice(); update(); },
      getFilter,
      clear,
      focus() { search.focus(); },
      destroy() { destroyed = true; host.replaceChildren(); },
    };
  }

  win.SlopFinder = { mount };
})(window);
