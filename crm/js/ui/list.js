// The Customers tab. The list is the first screen on every size. Click a column header to sort it (the Sort box does
// the same on phones), switch between comfortable and compact rows, and filter with the sidebar (groups and tags).
// A row opens the customer; its checkbox selects it for bulk actions; Actions or right-click opens the board's menu.
(function (g) {
  'use strict';
  const NS = (g.SlopCrm = g.SlopCrm || {});
  const UI = g.SlopUI;
  const el = UI.el;
  const $ = (id) => document.getElementById(id);
  const SORTS = [['name', 'Name'], ['stage', 'Stage'], ['activity', 'Last activity'], ['followUp', 'Follow-up']];
  const SORT_TEXT = {
    'name:asc': 'Name, A to Z', 'name:desc': 'Name, Z to A', 'stage:asc': 'Stage, pipeline order', 'stage:desc': 'Stage, reverse order',
    'activity:desc': 'Last activity, newest first', 'activity:asc': 'Last activity, oldest first',
    'followUp:asc': 'Follow-up, soonest first', 'followUp:desc': 'Follow-up, latest first',
  };
  const pref = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(`slop-crm.${k}`)); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(`slop-crm.${k}`, JSON.stringify(v)); } catch (e) { /* storage blocked: the choice lasts this visit */ } },
  };
  let sort = { key: 'name', dir: 'asc' };
  let density = 'comfortable';

  const isoDay = (ms) => {
    const d = new Date(ms), p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };

  function row(c, tagById, loc) {
    const tags = (c.tagIds || []).map((id) => tagById.get(id)).filter(Boolean);
    const cats = c.categories || [];
    const act = NS.query.activityOf(c);
    const overdue = !!c.followUp && c.followUp < NS.util.today();
    const sub = [c.company, c.email, c.phone].filter(Boolean).join(' · ') || 'No contact details';
    return el('li', { class: 'row', role: 'listitem', 'data-id': c.id, 'data-name': c.name, 'data-stage': c.stage },
      el('input', { type: 'checkbox', class: 'row-check', 'data-id': c.id, 'aria-label': `Select ${c.name}`,
        checked: NS.selection.has(c.id), onchange: (e) => NS.bulk.toggle(c.id, e.target.checked) }),
      el('button', { type: 'button', class: 'row-open', onclick: () => NS.app.show('customer', c.id) },
        NS.parts.avatar(c, 'av'),
        el('span', { class: 'row-text' }, el('b', null, c.name), el('span', { class: 'row-sub' }, sub),
          tags.length || cats.length ? el('span', { class: 'chips' },
            tags.map((t) => el('span', { class: `tag-chip tg-${t.color}` }, t.name)),
            cats.map((t) => el('span', { class: 'chip' }, t))) : null)),
      // a supplier (Slop Purchases) is not on the sales pipeline: it reads Supplier, not a stage
      c.supplier ? el('span', { class: 'stage s-supplier' }, 'Supplier') : el('span', { class: `stage s-${c.stage}` }, NS.stageLabel(c.stage)),
      el('span', { class: 'c-cell c-act' }, act ? NS.util.date(isoDay(act), loc) : '—'),
      el('span', { class: `c-cell c-fol${overdue ? ' overdue' : ''}` }, c.followUp ? NS.util.date(c.followUp, loc) : '—'),
      el('button', { type: 'button', class: 'btn small', 'aria-label': `Actions for ${c.name}`,
        onclick: (e) => { const r = e.currentTarget.getBoundingClientRect(); UI.menu(NS.menu.items(c), r.left, r.bottom + 4); } }, 'Actions ▾'));
  }

  /** Keeps the chosen category when the options are rebuilt. */
  function fillCategories(sel, cats) {
    const keep = sel.value;
    sel.replaceChildren(el('option', { value: '' }, 'All categories'), ...cats.map((t) => el('option', { value: t }, t)));
    sel.value = cats.includes(keep) ? keep : '';
  }

  /** A click on a header sorts by it; a second click turns it round. A new column starts at its own default. */
  function setSort(key, dir) {
    if (dir) sort = { key, dir };
    else sort = sort.key === key ? { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: NS.query.DEFAULT_DIR[key] };
    pref.set('sort', sort);
    render();
  }

  function setDensity(v) { density = v; pref.set('density', v); render(); }

  /** The column headers (they sit on the same grid as the rows) and the Sort box, drawn once; only the arrows move. */
  function paintHeads() {
    const arrow = (key) => (sort.key !== key ? '' : sort.dir === 'asc' ? ' ▲' : ' ▼');
    for (const b of document.querySelectorAll('#cSortHead [data-sort]')) {
      const key = b.dataset.sort, on = sort.key === key;
      b.parentElement.setAttribute('aria-sort', on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none');
      b.textContent = SORTS.find(([k]) => k === key)[1] + arrow(key);
    }
    $('cSort').value = `${sort.key}:${sort.dir}`;
    for (const b of document.querySelectorAll('#cDensity [data-density]')) b.setAttribute('aria-checked', String(b.dataset.density === density));
    $('cRows').classList.toggle('compact', density === 'compact');
  }

  async function render() {
    const r = await NS.customers.load();
    if (!r.ok) { $('cSummary').textContent = NS.util.refusal(r); return; }
    const lab = await NS.labels.load();
    if (!lab.ok) { $('cSummary').textContent = NS.util.refusal(lab); return; }
    const all = r.value, f = NS.listFilter;
    if (f.tag && !lab.value.tags.some((t) => t.id === f.tag)) f.tag = '';
    if (f.group && !lab.value.groups.some((x) => x.id === f.group)) f.group = '';
    fillCategories($('cCat'), NS.customers.categoriesOf(all));
    const tagById = new Map(lab.value.tags.map((t) => [t.id, t]));
    const list = NS.query.sort(NS.query.filter(all, { q: $('cSearch').value, stage: $('cStage').value, cat: $('cCat').value, tag: f.tag, group: f.group }),
      sort.key, sort.dir);
    $('cRows').replaceChildren(...list.map((c) => row(c, tagById, NS.state.settings.locale)));
    NS.sidebar.render(all, lab.value);
    NS.bulk.update(all, list);
    paintHeads();
    $('cEmpty').hidden = list.length > 0;
    $('cEmpty').textContent = all.length ? 'No customers match these filters.' : 'No customers yet. Add one, or import your contacts from Slop Contacts.';
    $('cSummary').textContent = `${list.length} of ${all.length} customer${all.length === 1 ? '' : 's'}`;
  }

  function mount() {
    density = pref.get('density', 'comfortable') === 'compact' ? 'compact' : 'comfortable';
    const saved = pref.get('sort', null);
    if (saved && SORTS.some(([k]) => k === saved.key) && (saved.dir === 'asc' || saved.dir === 'desc')) sort = saved;
    NS.bulk.mount();
    $('cSearch').addEventListener('input', render);
    for (const id of ['cStage', 'cCat']) $(id).addEventListener('change', render);
    $('cStage').replaceChildren(el('option', { value: '' }, 'All stages'), ...NS.STAGES.map((s) => el('option', { value: s }, NS.stageLabel(s))));
    $('cSort').replaceChildren(...Object.entries(SORT_TEXT).map(([v, label]) => el('option', { value: v }, label)));
    $('cSort').addEventListener('change', (e) => { const [k, d] = e.target.value.split(':'); setSort(k, d); });
    $('cSortHead').replaceChildren(...SORTS.map(([key]) => el('span', { class: `c-h c-h-${key}`, role: 'columnheader' },
      el('button', { type: 'button', class: 'sort-btn', 'data-sort': key, onclick: () => setSort(key) }))),
    el('span', { class: 'c-h c-h-actions', role: 'presentation' }));
    $('cDensity').replaceChildren(...[['comfortable', 'Comfortable'], ['compact', 'Compact']].map(([v, label]) =>
      el('button', { type: 'button', role: 'radio', class: 'seg-btn', 'data-density': v, 'aria-checked': String(density === v),
        onclick: () => setDensity(v) }, label)));
    $('cAdd').addEventListener('click', () => NS.form.open(null));
    $('cImport').addEventListener('click', () => NS.importUi.open());
    g.SlopCtx.bind($('cRows'), (t) => {
      const li = t && t.closest && t.closest('[data-id]');
      return li ? NS.menu.items({ id: li.dataset.id, name: li.dataset.name, stage: li.dataset.stage }) : null;
    });
  }

  NS.views = NS.views || {};
  NS.views.customers = { mount, render };
})(typeof window !== 'undefined' ? window : globalThis);
