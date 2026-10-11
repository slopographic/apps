/* Slop Contacts: the filters. The sidebar's Filter section has six facets: group, organisation, e-mail, phone, a created
 * or updated date range, and tag (the shared CRM tags). They combine with AND. Each set facet shows above the list as a
 * removable chip (click it to remove). The filter is SlopContacts.state.filters (core/filters.js). The section is only
 * rewritten when its markup changes, so a date being typed keeps its focus. Adds SlopContacts.filterPanel. */
(function () {
  'use strict';
  const SC = window.SlopContacts;
  const S = SC.state;
  const F = SC.filters;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const opt = (v, label, sel) => `<option value="${esc(v)}"${String(v) === String(sel) ? ' selected' : ''}>${esc(label)}</option>`;
  let lastPanel = '', lastChips = '';

  function setFilters(next) {
    S.filters = F.clean(next);
    S.emit('render');
  }
  /** Every organisation name in the list, A to Z. */
  function orgNames() {
    return [...new Set(S.list.map((c) => c.org).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }
  const yesNo = (v) => `<option value="">Any</option>${opt('yes', 'Yes', v)}${opt('no', 'No', v)}`;

  function panelHtml() {
    const f = S.filters;
    const groups = S.groupCounts().cats.map(([n]) => n).filter((n) => !f.group.includes(n));
    const tags = S.tags.filter((t) => !f.tag.includes(t.id));
    return `<div class="grp-sec filt"><h2 class="grp-h">Filter</h2>`
      + `<label class="flt"><span>Group</span><select data-f="group"><option value="">Add a group…</option>${groups.map((g) => opt(g, g, '')).join('')}</select></label>`
      + `<label class="flt"><span>Organisation</span><select data-f="org"><option value="">Any</option>${orgNames().map((o) => opt(o, o, f.org)).join('')}</select></label>`
      + `<label class="flt"><span>E-mail</span><select data-f="email">${yesNo(f.email)}</select></label>`
      + `<label class="flt"><span>Phone</span><select data-f="phone">${yesNo(f.phone)}</select></label>`
      + `<div class="flt"><span>Date</span><div class="flt-row">`
      + `<select data-f="date" aria-label="Date field">${opt('created', 'Created', f.date)}${opt('updated', 'Updated', f.date)}</select>`
      + `<input type="date" data-f="from" aria-label="From date" value="${esc(f.from)}">`
      + `<input type="date" data-f="to" aria-label="To date" value="${esc(f.to)}"></div></div>`
      + (S.tags.length ? `<label class="flt"><span>Tag</span><select data-f="tag"><option value="">Add a tag…</option>${tags.map((t) => opt(t.id, t.name, '')).join('')}</select></label>` : '')
      + `</div>`;
  }
  function chipsHtml() {
    const names = Object.fromEntries(S.tags.map((t) => [t.id, t.name]));
    const items = F.chips(S.filters, names);
    if (!items.length) return '';
    return items.map((c) => `<button type="button" class="chip" data-chip="${esc(c.id)}" aria-label="Remove filter: ${esc(c.label)}">`
      + `${esc(c.label)} <span aria-hidden="true">×</span></button>`).join('')
      + (items.length > 1 ? `<button type="button" class="text-btn" data-cmd="filters.clear">Clear all</button>` : '');
  }

  /** Rewrites the panel and the chips when their markup changed. */
  function render() {
    const panel = $('filters'), chips = $('chips');
    if (!panel || !chips) return;
    const p = panelHtml();
    if (p !== lastPanel) { panel.innerHTML = p; lastPanel = p; }
    const c = chipsHtml();
    if (c !== lastChips) { chips.innerHTML = c; lastChips = c; }
    chips.hidden = !c;
  }

  /** A change in a facet control sets that facet. Group and tag add to the list of chosen ones. */
  function onChange(e) {
    const t = e.target, k = t.dataset && t.dataset.f;
    if (!k) return;
    const f = { ...S.filters, group: [...S.filters.group], tag: [...S.filters.tag] };
    if (k === 'group') { if (t.value) f.group.push(t.value); }
    else if (k === 'tag') { if (t.value) f.tag.push(t.value); }
    else f[k] = t.value;
    setFilters(f);
  }

  function mount() {
    $('filters').addEventListener('change', onChange);
    $('chips').addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('[data-chip]');
      if (b) setFilters(F.without(S.filters, b.dataset.chip));
    });
    S.on('render', render);
    S.on('change', render);
    render();
  }

  SC.filterPanel = { mount, render };
})();
