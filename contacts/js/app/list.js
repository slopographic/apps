/* Slop Contacts: the group sidebar (with counts; click to filter) and the contact list (avatar, checkboxes, search,
 * selection bar). A click on a row opens that contact in the detail panel. Renders from SlopContacts.state. */
(function () {
  'use strict';
  const SC = window.SlopContacts;
  const S = SC.state;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const isGroupOn = (kind, name) => (kind === 'all' ? S.group === null : kind === 'none' ? S.group === '' : S.group === name);

  function sideButton(kind, name, label, count) {
    const on = isGroupOn(kind, name);
    return `<button type="button" class="gbtn${on ? ' is-on' : ''}" data-kind="${kind}" data-name="${esc(name)}" aria-pressed="${on}">` +
      `<span class="gl">${esc(label)}</span><span class="gn">${count}</span></button>`;
  }
  function renderGroups() {
    const g = S.groupCounts();
    const rows = [sideButton('all', '', 'All contacts', g.all), sideButton('none', '', 'Ungrouped', g.none)];
    for (const [name, n] of g.groups) rows.push(sideButton('group', name, name, n));
    $('groups').innerHTML = rows.join('');
    $('groupHint').textContent = g.groups.length ? '' : 'Groups come from CATEGORIES (vCard), Group Membership (Google) and Categories (Outlook).';
  }

  /** The row for one contact. */
  function rowHtml(c, shown) {
    const on = S.sel.has(c.id), name = SC.model.displayName(c), open = SC.panel && SC.panel.openId() === c.id;
    const sub = [c.org, c.phones[0] && c.phones[0].value, c.emails[0] && c.emails[0].value].filter(Boolean).join(' · ');
    const chips = c.groups.slice(0, 4).map((g) => `<span class="chip">${esc(g)}</span>`).join('') + (c.groups.length > 4 ? `<span class="chip">+${c.groups.length - 4}</span>` : '');
    return `<li class="row${on ? ' is-sel' : ''}${open ? ' is-open' : ''}" data-id="${esc(c.id)}" data-shown="${shown}">` +
      `<label class="ck"><input type="checkbox" data-ck="${esc(c.id)}"${on ? ' checked' : ''} aria-label="Select ${esc(name)}"></label>` +
      `<button type="button" class="open" data-open="${esc(c.id)}" title="Open ${esc(name)}"${open ? ' aria-current="true"' : ''}>` +
      `${SC.photoUi.avatarHtml(c)}<span class="open-text"><span class="nm">${esc(name)}</span><span class="sub">${esc(sub) || '&nbsp;'}</span></span></button>` +
      `<span class="chips">${chips}</span></li>`;
  }
  function renderRows() {
    const vis = S.visible();
    $('rows').innerHTML = vis.map((c) => rowHtml(c, true)).join('');
    const total = S.list.length;
    $('count').textContent = !total ? '' : vis.length === total ? `${total} contact${total === 1 ? '' : 's'}` : `${vis.length} of ${total} shown`;
    $('empty').hidden = total > 0;
    $('noMatch').hidden = !(total && !vis.length);
    const n = S.sel.size;
    $('selBar').hidden = !n;
    $('selCount').textContent = `${n} selected`;
    $('btnSelAll').textContent = vis.length && vis.every((c) => S.sel.has(c.id)) ? 'Clear shown' : 'Select all shown';
    $('btnSelAll').dataset.cmd = vis.length && vis.every((c) => S.sel.has(c.id)) ? 'contacts.clearSel' : 'contacts.selectAll';
  }
  const render = () => { renderGroups(); renderRows(); };

  function bind() {
    $('groups').addEventListener('click', (e) => {
      const b = e.target.closest('.gbtn');
      if (!b) return;
      const kind = b.dataset.kind;
      S.group = kind === 'all' ? null : kind === 'none' ? '' : b.dataset.name;
      S.emit('render');
    });
    $('rows').addEventListener('click', (e) => {
      const b = e.target.closest('[data-open]');
      if (b) { SC.panel.show(b.dataset.open); return; }
      const ck = e.target.closest('input[data-ck]');
      if (ck) {
        const next = new Set(S.sel);
        if (ck.checked) next.add(ck.dataset.ck); else next.delete(ck.dataset.ck);
        S.setSel(next);
      }
    });
    $('search').addEventListener('input', (e) => { S.query = e.target.value; S.emit('render'); });
    S.on('render', render);
    S.on('change', render);
  }

  /** Shift-click ranges are not needed; this selects every shown contact. */
  function selectShown(on) {
    const vis = S.visible();
    const next = new Set(on ? S.sel : []);
    for (const c of vis) { if (on) next.add(c.id); else next.delete(c.id); }
    S.setSel(next);
  }

  SC.list = { render, bind, esc, selectShown, rowHtml };
  bind();
})();
