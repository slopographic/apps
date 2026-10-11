/* Slop Drive — ui/items: which items the main pane shows (section, search, kind filter) and in what order. */
'use strict';
(function (DR) {
  const S = DR.S;
  const recency = (r) => Math.max(r.modified || 0, r.opened || 0, r.time || 0);
  const SORTS = {
    name: (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
    kind: (a, b) => DR.kindLabel(a).localeCompare(DR.kindLabel(b)) || SORTS.name(a, b),
    size: (a, b) => DR.sizeOf(a) - DR.sizeOf(b) || SORTS.name(a, b),
    modified: (a, b) => (a.modified || a.time) - (b.modified || b.time) || SORTS.name(a, b),
    app: (a, b) => (a.isFolder ? '' : DR.appName(a.from)).localeCompare(b.isFolder ? '' : DR.appName(b.from)) || SORTS.name(a, b),
  };
  DR.SORTS = SORTS;
  DR.recency = recency;
  /** Sort with folders first (except Recent, which is by time). */
  DR.sortItems = function (list, sort = S.sort) {
    const f = SORTS[sort.key] || SORTS.name, d = sort.dir || 1;
    return list.sort((a, b) => (a.isFolder !== b.isFolder ? (a.isFolder ? -1 : 1) : d * f(a, b)));
  };
  const kindOk = (it) => S.kind === 'all' || (S.kind === 'folder' ? it.isFolder : !it.isFolder && DR.kindOf(it) === S.kind);
  const queryOk = (it, q) => !q || it.name.toLowerCase().includes(q) || (!it.isFolder && (DR.appName(it.from).toLowerCase().includes(q) || DR.kindLabel(it).toLowerCase().includes(q)));
  /** The items for the current view, already filtered and sorted. */
  DR.visible = function () {
    const q = S.query.trim().toLowerCase();
    let list;
    if (S.section === 'trash') list = DR.trashTops();
    else if (S.section === 'recent') list = DR.liveFiles();
    else if (S.section === 'starred') list = [...DR.liveFolders(), ...DR.liveFiles()].filter((it) => it.starred);
    else if (q) list = [...DR.liveFolders(), ...DR.liveFiles()];
    else { const c = DR.children(S.cwd); list = [...c.folders, ...c.files]; }
    list = list.filter((it) => kindOk(it) && queryOk(it, q));
    if (S.section === 'recent') return list.sort((a, b) => recency(b) - recency(a)).slice(0, 200);
    if (S.section === 'trash' && S.sort.key === 'name' && !q) return list.sort((a, b) => b.trashedAt - a.trashedAt);
    return DR.sortItems(list);
  };
  DR.searching = () => !!S.query.trim() && S.section === 'folder';
  /** Title of the current place. */
  DR.placeName = function () {
    if (S.section === 'recent') return 'Recent';
    if (S.section === 'starred') return 'Starred';
    if (S.section === 'trash') return 'Trash';
    return S.cwd ? (S.folders.get(S.cwd) || {}).name || 'Slop Drive' : 'Slop Drive';
  };
  /** Can the user add files here? (Only in a real folder, not Recent/Starred/Trash/search.) */
  DR.canAddHere = () => S.section === 'folder';
  DR.dest = () => (S.section === 'folder' ? S.cwd : null);
  /** Columns, Nodes and Usage show the folder tree; Recent, Starred, Trash and search fall back to the list. */
  DR.viewNow = () => (['columns', 'nodes', 'usage'].includes(S.view) && (S.section !== 'folder' || DR.searching()) ? 'list' : S.view);

  /** Navigate. go(folderId) opens a folder; go(null) the root; section switches with goSection. */
  DR.go = function (id, { keepQuery = false } = {}) {
    S.section = 'folder'; S.cwd = id || null; S.sel.clear(); S.anchor = S.focus = null;
    if (!keepQuery) { S.query = ''; const s = DR.$('search'); if (s) s.value = ''; }
    for (const f of DR.pathOf(S.cwd)) S.tree.add(f.id);
    DR.pushHistory && DR.pushHistory();
    DR.render();
  };
  DR.goSection = function (sec) {
    S.section = sec; S.sel.clear(); S.anchor = S.focus = null; S.query = ''; const s = DR.$('search'); if (s) s.value = '';
    DR.pushHistory && DR.pushHistory();
    DR.render();
  };
  DR.up = function () { if (S.section !== 'folder') return DR.goSection('folder'); if (S.cwd) { const prev = S.cwd; DR.go(S.folders.get(S.cwd).parent); DR.select(['d:' + prev]); } };
  /** Show a file or folder where it lives, selected. */
  DR.reveal = function (it) {
    if (!it) return;
    if (it.trashedAt || DR.hidden(it)) { DR.goSection('trash'); }
    else DR.go(it.parent);
    DR.select([DR.keyOf(it)]);
    DR.scrollToFocus && DR.scrollToFocus();
  };
  /** Browser back/forward walk the folders. */
  DR.pushHistory = function () {
    const st = { section: S.section, cwd: S.cwd };
    const cur = history.state;
    if (cur && cur.section === st.section && cur.cwd === st.cwd) return;
    try { history.pushState(st, '', location.pathname + location.search); } catch (e) { /* sandboxed */ }
  };
  addEventListener('popstate', (e) => {
    const st = e.state; if (!st) return;
    S.section = st.section || 'folder'; S.cwd = st.cwd && S.folders.has(st.cwd) ? st.cwd : null; S.sel.clear();
    DR.render();
  });
})(window.DR);
