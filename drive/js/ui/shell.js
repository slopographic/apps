/* Slop Drive — ui/shell: breadcrumbs, view switcher, kind filter, selection bar, status bar, and the
 * New / More menus in the top bar. */
'use strict';
(function (DR) {
  const S = DR.S, el = DR.el, $ = DR.$;
  DR.VIEWS = [['grid', 'Grid', '1'], ['list', 'List', '2'], ['compact', 'Compact', '3'], ['columns', 'Columns', '4'], ['nodes', 'Nodes', '5'], ['usage', 'Disk usage', '6']];
  DR.THEMES = [['pro', 'Pro (dark)'], ['light', 'Light'], ['classic', 'Classic 98']];

  DR.setView = function (v) { if (!DR.VIEWS.some((x) => x[0] === v)) return; S.view = v; DR.savePrefs(); DR.render(); };
  DR.setTheme = function (t) { document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem('slop-drive.theme', JSON.stringify(t)); } catch (e) { /* blocked */ } };

  DR.renderCrumbs = function () {
    const box = $('crumbs'); box.replaceChildren();
    const add = (label, id, sec) => {
      if (box.children.length) box.append(DR.icon('chev', 'ic sep'));
      const b = el('button', { type: 'button', class: 'crumb', title: label }, label);
      if (sec) b.addEventListener('click', () => DR.goSection(sec));
      else { b.dataset.drop = id == null ? 'root' : id; b.addEventListener('click', () => DR.go(id)); }
      box.append(b);
    };
    if (S.section !== 'folder') add(DR.placeName(), null, S.section);
    else {
      add('Slop Drive', null);
      for (const f of DR.pathOf(S.cwd)) add(f.name, f.id);
      if (DR.searching()) { box.append(DR.icon('chev', 'ic sep')); box.append(el('span', { class: 'crumb' }, `Search “${S.query.trim()}”`)); }
    }
    box.scrollLeft = box.scrollWidth;
  };
  DR.renderTools = function () {
    const seg = $('views');
    if (!seg.children.length) for (const [v, label, key] of DR.VIEWS) {
      const b = el('button', { type: 'button', 'data-view': v, title: `${label} (${key})`, 'aria-label': label }, DR.icon(v));
      b.addEventListener('click', () => DR.setView(v));
      seg.append(b);
    }
    for (const b of seg.children) b.setAttribute('aria-pressed', String(b.dataset.view === S.view));
    const k = $('kind');
    if (!k.options.length) {
      k.append(el('option', { value: 'all' }, 'All kinds'));
      for (const x of DR.KINDS) k.append(el('option', { value: x.id }, x.label));
      k.addEventListener('change', () => { S.kind = k.value; S.sel.clear(); DR.render(); });
    }
    k.value = S.kind;
    $('btnInfo').setAttribute('aria-pressed', String(!!S.info));
  };
  DR.renderSelbar = function () {
    const bar = $('selbar'), items = DR.items(S.sel);
    bar.hidden = items.length < (DR.isMobile() ? 1 : 2);
    if (bar.hidden) return;
    const size = items.reduce((n, it) => n + DR.sizeOf(it), 0);
    const btn = (label, act, cls = '') => { const b = el('button', { type: 'button', class: 'btn ' + cls }, label); b.addEventListener('click', act); return b; };
    const kids = [el('b', null, `${items.length} selected · ${DR.fmtSize(size)}`)];
    if (S.section === 'trash') kids.push(btn('Restore', () => DR.restore(items)), btn('Delete forever', () => DR.purge(items), 'danger'));
    else kids.push(btn('Move to…', () => DR.moveDialog(items)), btn('Download', () => DR.download(items)), btn('Trash', () => DR.trash(items), 'danger'));
    kids.push(btn('More…', (e) => { const r = e.currentTarget.getBoundingClientRect(); DR.contextMenu(r.left, r.bottom + 4); }));
    kids.push(btn('Clear', () => DR.select([])));
    bar.replaceChildren(...kids);
  };
  let msg = '';
  DR.status = (m) => { msg = m || ''; DR.renderStatus(); };
  DR.renderStatus = function () {
    const list = DR.lastVisible || [], nF = list.filter((x) => x.isFolder).length, nf = list.length - nF;
    const parts = [];
    if (nF) parts.push(`${nF} folder${nF === 1 ? '' : 's'}`);
    parts.push(`${nf} file${nf === 1 ? '' : 's'}`);
    const sz = list.reduce((n, it) => n + DR.sizeOf(it), 0);
    $('status').replaceChildren(el('span', null, parts.join(', ') + ' · ' + DR.fmtSize(sz)), S.sel.size ? el('span', null, `${S.sel.size} selected`) : '', el('span', { class: 'msg' }, msg));
  };

  /* ---------- top bar menus ---------- */
  DR.newMenu = function (x, y) {
    const here = DR.canAddHere();
    window.SlopUI.menu([
      { label: 'New folder', key: DR.keyLabel('newFolder'), act: () => DR.newFolder(DR.dest()), disabled: !here && S.section !== 'recent' && S.section !== 'starred' },
      '-',
      { label: 'Upload files…', key: DR.keyLabel('upload'), act: () => DR.uploadPicker(false) },
      { label: 'Upload a folder…', act: () => DR.uploadPicker(true) },
      '-',
      { label: 'New text file', act: async () => { const n = await window.SlopUI.prompt('New text file', 'Name', 'Notes.txt', { ok: 'Create' }); if (n) await DR.importFiles([{ file: new File([''], n, { type: 'text/plain' }), path: n }], DR.dest()); } },
    ], x, y);
  };
  DR.moreMenu = function (x, y) {
    const theme = document.documentElement.getAttribute('data-theme');
    window.SlopUI.menu([
      { label: 'Backup & restore…', act: () => DR.backupDialog() },
      { label: 'Find duplicates…', act: () => DR.dupesDialog() },
      '-',
      { label: 'View', sub: DR.VIEWS.map(([v, l, k]) => ({ label: l, key: k, check: S.view === v, act: () => DR.setView(v) })) },
      { label: 'Theme', sub: DR.THEMES.map(([t, l]) => ({ label: l, check: theme === t, act: () => DR.setTheme(t) })) },
      { label: 'Info panel', key: DR.keyLabel('info'), check: S.info, act: () => DR.toggleInfo() },
      '-',
      { label: 'Keep storage (ask the browser)', act: () => DR.requestPersist(true) },
      { label: 'Empty Trash…', act: () => DR.emptyTrash() },
      '-',
      { label: 'Search commands…', key: window.SlopCmd ? 'Ctrl+K' : undefined, act: () => DR.openPalette() },
      { label: 'Help', sub: [{ label: 'Keyboard shortcuts…', key: '?', act: () => DR.shortcutsDialog() }, { label: 'Search commands… (⌘K)', act: () => DR.openPalette() }] },
    ], x, y);
  };
  DR.backupDialog = () => window.SlopBackup.openDialog({ onRestored: () => DR.done() });
  DR.toggleInfo = function (on = !S.info) { S.info = on; DR.savePrefs(); DR.render(); };
  DR.moveDialog = async function (items, copy = false) {
    if (!items.length) return;
    const exclude = items.filter((i) => i.isFolder).map((i) => i.id);
    const dest = await window.SlopHub.pickFolder({ title: (copy ? 'Copy ' : 'Move ') + (items.length === 1 ? `“${items[0].name}”` : items.length + ' items'), ok: copy ? 'Copy here' : 'Move here', start: items[0].parent, exclude });
    if (dest === undefined) return;
    return copy ? DR.copy(items, dest) : DR.move(items, dest);
  };
})(window.DR);
