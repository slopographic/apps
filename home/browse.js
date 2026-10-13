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

  /* ---------- the finder: search at the top, facets, views, and the matches (SlopFinder over the registry) ---------- */
  const folder = (a) => a.path.replace(/\/$/, '');
  const sectionsText = (a) => [...new Set(H.placements(a).map((p) => H.titleOf(p.section)))].join(', ');
  const ready = (a) => (a.status === 'building' ? 'In development' : 'Ready');
  const search = (a) => SEARCH[a.id] || { desc: '', keywords: [] };
  const finderHost = document.getElementById('app-finder');
  if (SF && M && finderHost) {
    SF.mount(finderHost, {
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
      row: (a) => el('div', { class: 'sf-row', 'data-id': a.id }, el('b', { class: 'app-title', 'data-id': a.id }, shown(a)), el('span', { class: 'sf-row-sec' }, sectionsText(a)),
        el('span', { class: 'sf-row-tag' }, a.tagline), el('span', { class: 'sf-row-types' }, H.typeKinds(a.accepts).join(', ')),
        el('a', { class: 'sf-row-open', href: a.path }, 'Open →')),
      card: (a) => C.appCard(a),
      urlPrefix: 'hp',
      placeholder: 'Search apps by name, job, file type or feature',
      searchLabel: 'Search apps',
      noun: 'apps',
      emptyText: 'No apps match these filters.',
      resultsWhen: 'filtered',
      facetsCollapsed: true,
      suggest: { max: 8, href: (a) => a.path, label: (a) => shown(a), hint: sectionsText },
      autofocus: desktop(),
      onChange: (list, st) => render(list, M.isFiltered(st)),
    });
  } else {
    render(APPS, false);
  }
  window.SlopHomeBrowse = { render };
})();
