/* Slop Drive — ui/view-files: the Grid (thumbnails), List (sortable columns) and Compact views.
 * Every item element carries data-key; folders also carry data-drop so items can be dragged onto them. */
'use strict';
(function (DR) {
  const S = DR.S, el = DR.el;
  /** A file's icon: a coloured badge with its extension; folders get the folder glyph. */
  DR.badge = function (it, cls = 'badge') {
    if (it.isFolder) { const s = DR.icon('folder', 'ic fold'); return el('span', { class: cls + ' is-folder' }, s); }
    const e = (DR.ext(it.name) || (it.type || '').split('/').pop() || '?').slice(0, 4).toUpperCase();
    return el('span', { class: cls, style: `--k:${DR.kindColor(it)}` }, el('span', null, e));
  };
  const where = (it) => (it.parent ? DR.pathOf(it.parent).map((f) => f.name).join(' / ') : 'Slop Drive');
  const showWhere = () => S.section !== 'folder' || DR.searching();
  function base(it, cls) {
    const key = DR.keyOf(it);
    const n = el('div', { class: 'it ' + cls + (S.sel.has(key) ? ' sel' : '') + (S.focus === key ? ' focus' : '') + (S.clip && S.clip.cut && S.clip.keys.includes(key) ? ' cut' : ''),
      role: 'option', 'aria-selected': String(S.sel.has(key)), 'data-key': key, title: it.name });
    if (it.isFolder && !it.trashedAt) n.dataset.drop = it.id;
    return n;
  }
  const star = (it) => (it.starred ? DR.icon('star', 'ic st') : '');

  function card(it) {
    const n = base(it, 'card'), th = el('div', { class: 'th' }, DR.badge(it, 'badge big'));
    if (!it.isFolder) DR.fillThumb(th, it);
    const sub = it.isFolder ? (DR.countOf(it.id) === 1 ? '1 item' : `${DR.countOf(it.id)} items`) : showWhere() ? where(it) : `${DR.fmtSize(it.size)} · ${DR.fmtDate(it.modified || it.time)}`;
    n.append(th, el('div', { class: 'cap' }, el('div', { class: 'nm' }, star(it), el('span', null, it.name)), el('div', { class: 'sub' }, sub)));
    return n;
  }
  const COLS = [['name', 'Name'], ['kind', 'Kind'], ['size', 'Size'], ['modified', 'Modified'], ['app', 'App']];
  function head() {
    const h = el('div', { class: 'lhead', role: 'row' });
    for (const [k, label] of COLS) {
      const on = S.sort.key === k && S.section !== 'recent';
      const b = el('button', { type: 'button', class: 'col c-' + k + (on ? ' on' : ''), 'data-sort': k, 'aria-sort': on ? (S.sort.dir > 0 ? 'ascending' : 'descending') : 'none' }, label, on ? el('span', { class: 'arrow' }, S.sort.dir > 0 ? '▲' : '▼') : '');
      b.addEventListener('click', () => { S.sort = { key: k, dir: S.sort.key === k ? -S.sort.dir : k === 'modified' || k === 'size' ? -1 : 1 }; DR.savePrefs(); DR.render(); });
      h.append(b);
    }
    if (showWhere()) h.append(el('span', { class: 'col c-where' }, S.section === 'trash' ? 'Trashed' : 'Location'));
    return h;
  }
  function row(it) {
    const n = base(it, 'row');
    n.append(el('div', { class: 'c-name' }, DR.badge(it, 'badge sm'), el('span', { class: 'nm' }, it.name), star(it)),
      el('div', { class: 'c-kind' }, DR.kindLabel(it)),
      el('div', { class: 'c-size' }, DR.fmtSize(DR.sizeOf(it))),
      el('div', { class: 'c-modified' }, DR.fmtDate(it.modified || it.time)),
      el('div', { class: 'c-app' }, it.isFolder ? '—' : DR.appName(it.from)));
    if (showWhere()) n.append(el('div', { class: 'c-where' }, S.section === 'trash' ? DR.fmtDate(it.trashedAt) : where(it)));
    return n;
  }
  function compact(it) {
    const n = base(it, 'mini');
    n.append(DR.badge(it, 'badge xs'), el('span', { class: 'nm' }, it.name), star(it), el('span', { class: 'sz' }, it.isFolder ? '' : DR.fmtSize(it.size)));
    return n;
  }
  /** Render list into the pane for view grid | list | compact. */
  DR.renderFiles = function (pane, list, view) {
    const wrap = el('div', { class: 'files v-' + view + (showWhere() ? ' with-where' : ''), role: 'listbox', 'aria-multiselectable': 'true', 'aria-label': DR.placeName() });
    if (view === 'list') wrap.append(head());
    const make = view === 'grid' ? card : view === 'list' ? row : compact;
    const CHUNK = 400;
    for (const it of list.slice(0, CHUNK)) wrap.append(make(it));
    if (list.length > CHUNK) { // render the rest when idle so huge folders stay snappy
      let i = CHUNK;
      const more = () => { if (!wrap.isConnected) return; const end = Math.min(list.length, i + CHUNK); for (; i < end; i++) wrap.append(make(list[i])); if (i < list.length) requestAnimationFrame(more); };
      requestAnimationFrame(more);
    }
    pane.append(wrap);
  };
  /** Columns that make sense per section, for tests and the mobile layout. */
  DR.listColumns = () => COLS.map((c) => c[0]);
})(window.DR);
