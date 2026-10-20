/* Homepage browse: the search and finder at the top (shared/finder, SlopFinder), the six section shelves and the
 * Experiments shelf (home/sections.js for what goes where), the jump links under the hero, and the Print card.
 * The finder's filter drives the shelves: a section with no matches is hidden. Classic script, loaded after catalog.js. */
(function () {
  'use strict';
  const APPS = window.SLOP_APPS || [];
  const H = window.SlopHomeSections, C = window.SlopHomeCards, M = window.SlopFinderModel, SF = window.SlopFinder;
  const SEARCH = window.SLOP_APP_SEARCH || {};
  /* The name shown for an app (see shared/apps.js). */
  const shown = (a) => window.slopAppLabel(a, window.slopBrandNamesOn());
  if (!H || !C) return;
  const el = (tag, attrs, ...kids) => {
    const n = document.createElement(tag);
    for (const k in attrs || {}) if (attrs[k] != null && attrs[k] !== false) n.setAttribute(k, attrs[k] === true ? '' : String(attrs[k]));
    for (const c of kids.flat()) if (c != null && c !== false) n.append(c instanceof Node ? c : document.createTextNode(String(c)));
    return n;
  };
  const desktop = () => !!(window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches);

  /* ---------- the shelves: one <section> per homepage section, built once so the headings keep their perch ---------- */
  const host = document.getElementById('app-sections');
  const ALL = H.SECTION_DEFS.concat([H.EXPERIMENTS]);
  const shelves = new Map();
  for (const d of ALL) {
    const grid = el('div', { class: d.tiles ? 'tile-grid' : 'app-grid', 'data-section': d.id });
    const sec = el('section', { id: d.id, class: 'shelf', 'aria-labelledby': d.id + '-title', 'data-section-id': d.id },
      el('header', { class: 'shelf-head' }, el('h2', { id: d.id + '-title', 'data-perch': '' }, d.title), el('p', null, d.desc)), grid);
    if (host) host.append(sec);
    shelves.set(d.id, { sec, grid, def: d });
  }

  /** The jump links under the hero: one per shelf that is showing. */
  function paintJumps() {
    const nav = document.getElementById('jump-links');
    if (!nav) return;
    nav.replaceChildren(...ALL.filter((d) => !shelves.get(d.id).sec.hidden)
      .map((d) => el('a', { class: 'jump-link', href: '#' + d.id, 'data-jump': '' }, d.title)));
  }
  /** Fills the shelves from the apps the finder lets through. The Print card shows only when nothing is filtered. */
  function render(list, filtering) {
    const all = filtering ? list : list.concat([H.PRINT]);
    const by = new Map([...shelves.keys()].map((k) => [k, []]));
    for (const a of all) for (const p of H.placements(a)) if (by.has(p.section)) by.get(p.section).push({ a, p });
    for (const [key, arr] of by) {
      arr.sort((x, y) => x.p.order - y.p.order);
      const s = shelves.get(key);
      s.grid.replaceChildren(...arr.map(({ a, p }) => (s.def.tiles ? C.tile(a) : C.appCard(a, p.line))));
      s.sec.hidden = !arr.length;
    }
    paintJumps();
    C.watch();
  }

  /** A list row opens its app from anywhere on the row; a click on the Open link itself is left to the link. */
  function rowLink(a, row) {
    row.classList.add('is-link');
    row.addEventListener('click', (e) => { if (!e.target.closest('a')) window.location.href = a.path; });
    return row;
  }

  /* ---------- the finder: search at the top, facets, views, and the matches (SlopFinder over the registry) ---------- */
  const folder = (a) => a.path.replace(/\/$/, '');
  const sectionsText = (a) => [...new Set(H.placements(a).map((p) => H.titleOf(p.section)))].join(', ');
  const ready = (a) => (a.status === 'building' ? 'In development' : 'Ready');
  const search = (a) => SEARCH[a.id] || { desc: '', keywords: [] };
  const finderHost = document.getElementById('app-finder');
  if (SF && M && finderHost) {
    const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().trim();
    // Featured apps lead, and an app whose name starts with or contains the search leads above them all.
    const rank = (a, q) => {
      const t = norm(q), n = norm(a.name);
      return (a.featured ? 50 : 0) + (t && n.includes(t) ? 100 : 0) + (t && n.startsWith(t) ? 20 : 0);
    };
    // Wide screens keep the facets open in their column on the left; phones keep them behind "Filter by".
    const wide = window.matchMedia && matchMedia('(min-width: 900px)').matches;
    SF.mount(finderHost, {
      layout: 'faucet',
      facetsCollapsed: !wide,
      rank,
      items: APPS,
      fields: [
        { key: 'name', label: 'Name', get: (a) => a.name },
        { key: 'tagline', label: 'Description', get: (a) => a.tagline },
        { key: 'desc', label: 'Details', get: (a) => search(a).desc },
        { key: 'keywords', label: 'Keywords', get: (a) => search(a).keywords },
        { key: 'features', label: 'Features', get: (a) => a.features || [] },
        { key: 'folder', label: 'Folder', get: folder },
      ],
      searchKeys: ['name', 'tagline', 'desc', 'keywords', 'features', 'folder'],
      facets: [
        { key: 'section', label: 'Section', values: (a) => H.placements(a).map((p) => H.titleOf(p.section)) },
        { key: 'type', label: 'File types', values: (a) => H.typeKinds(a.accepts) },
        { key: 'status', label: 'Status', values: (a) => [ready(a)] },
        { key: 'tour', label: 'Guided tour', values: (a) => [H.TOUR_DIRS.has(folder(a)) ? 'Has a tour' : 'No tour'] },
      ],
      columns: [
        { key: 'name', label: 'App', get: (a) => shown(a) },
        { key: 'section', label: 'Section', get: sectionsText },
        { key: 'types', label: 'File types', get: (a) => H.typeKinds(a.accepts).join(', ') },
        { key: 'open', label: 'Open', sortable: false, get: () => '', render: (a) => el('a', { href: a.path }, 'Open →') },
      ],
      row: (a) => rowLink(a, el('div', { class: 'sf-row has-icon', 'data-id': a.id }, C.icon(a, 'sf-row-icon'), el('b', { class: 'app-title', 'data-id': a.id }, shown(a)), el('span', { class: 'sf-row-sec' }, sectionsText(a)),
        el('span', { class: 'sf-row-tag' }, a.tagline), el('span', { class: 'sf-row-types' }, H.typeKinds(a.accepts).join(', ')),
        el('a', { class: 'sf-row-open', href: a.path }, 'Open →'))),
      card: (a) => C.appCard(a),
      urlPrefix: 'hp',
      placeholder: 'Search apps by name, job, file type or feature',
      searchLabel: 'Search apps',
      noun: 'apps',
      emptyText: 'No apps match these filters.',
      view: 'list',
      big: true, // the large search box; the results filter live below it, so there is no dropdown
      autofocus: desktop(),
      onChange: () => render(APPS, false), // the faucet filters its own list; the shelves below always show every app
    });
  } else {
    render(APPS, false);
  }
  window.SlopHomeBrowse = { render };
})();
