/* Slop Gallery: right-click menus (and the Menu key) for photos, albums, month headers and the empty grid.
 * Built on SlopCtx.bind (shared/ctxmenu.js), which opens SlopUI.menu at the pointer. Items reuse the shared actions,
 * so a menu and the toolbar cannot disagree. Exposes window.SlopGallery.menus.bind(root) -> unbind. */
(function () {
  'use strict';
  const G = (window.SlopGallery = window.SlopGallery || {});
  const A = () => G.actions;

  const monthIds = (key) => G.timeline.visibleIds().filter((id) => {
    const m = G.library.photo(id), d = new Date((m && m.takenAt) || 0);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') === key;
  });

  function albumSub(ids) {
    const sub = G.library.albums().map((a) => ({ label: a.name, act: () => G.library.addToAlbum(a.id, ids) }));
    sub.push('-', { label: 'New album…', act: () => G.albums.addIds(ids) });
    return sub;
  }
  function sendItems(id, meta) {
    if (!window.SlopHub || !window.SlopHub.sendMenuItems) return [];
    const getBlob = async () => { const row = await G.db.get('originals', id); if (!row || !row.blob) throw new Error('Original missing'); return row.blob; };
    return window.SlopHub.sendMenuItems(getBlob, meta.name, meta.type || 'image/jpeg', { folder: true });
  }

  function photoItems(id) {
    const st = G.state.state, ids = A().targets(id), single = ids.length === 1, sel = G.state.selected;
    const meta = G.library.photo(id);
    if (!meta) return null;
    const idx = G.timeline.visibleIds().indexOf(id);
    const inSel = sel.includes(id);
    const items = [];
    if (single) items.push({ label: 'Open', key: 'Enter', act: () => G.viewer.open(G.timeline.visibleIds(), idx) });
    items.push({ label: inSel ? 'Deselect' : 'Select', act: () => G.state.select(id, !inSel) }, '-');
    items.push({ label: meta.fav ? 'Remove from favourites' : 'Add to favourites', act: () => G.library.toggleFav(ids) });
    items.push({ label: 'Liked', check: single && meta.liked === 'liked', act: () => G.library.setLiked(ids, 'liked') });
    items.push({ label: 'Disliked', check: single && meta.liked === 'disliked', act: () => G.library.setLiked(ids, 'disliked') });
    items.push({ label: 'Clear like or dislike', act: () => G.library.setLiked(ids, null) });
    items.push({ label: 'Add tag…', act: () => A().tagPrompt(ids) }, '-');
    items.push({ label: 'Add to album', sub: albumSub(ids) });
    if (st.view === 'album') items.push({ label: 'Remove from this album', act: () => G.library.removeFromAlbum(st.query.album, ids) });
    items.push('-', { label: 'Download' + (ids.length > 1 ? ` (${ids.length})` : ''), act: () => A().exportIds(ids) });
    if (inSel) items.push({ label: 'Make reel…', disabled: sel.length < 2, act: () => A().makeReel(sel) });
    if (single) items.push(...sendItems(id, meta));
    items.push('-', { label: 'Remove from library…', act: () => A().removeIds(ids) });
    return items;
  }
  function albumItems(id) {
    const a = G.library.album(id);
    if (!a) return null;
    return [
      { label: 'Open album', act: () => G.state.setView('album', id) },
      { label: 'Sort this album', act: () => A().sortIds(a.photoIds.filter((x) => G.library.photo(x))) },
      '-',
      { label: 'Rename…', act: () => G.albums.rename(id) },
      { label: 'Delete album…', act: () => G.albums.remove(id) },
    ];
  }
  function monthItems(key) {
    const ids = monthIds(key);
    return [
      { label: `Select ${ids.length} in this month`, act: () => G.state.select(ids, true) },
      { label: 'Sort this month', act: () => A().sortIds(ids) },
    ];
  }
  function gridItems() {
    return [
      { label: 'Import photos…', key: 'Mod+O', act: () => A().importFiles() },
      { label: 'Select all', key: 'Mod+A', act: () => A().selectAll() },
      { label: 'Clear selection', act: () => A().clearSelection() },
      '-',
      { label: 'Sort photos', act: () => A().sortIds([]) },
      { label: 'Find duplicates…', act: () => A().dupes() },
    ];
  }

  /** Resolves the menu for what sits under the pointer. */
  function resolve(target) {
    if (!target || !target.closest) return null;
    const tile = target.closest('.tile');
    if (tile) return photoItems(tile.dataset.id);
    const album = target.closest('[data-album]');
    if (album) return albumItems(album.dataset.album);
    const head = target.closest('.vhead');
    if (head) return monthItems(head.dataset.month);
    if (target.closest('.grid-area')) return gridItems();
    return null;
  }

  /** The Actions button's menu (the toolbar's less common actions). */
  function openActions(btn) {
    const sel = G.state.selected, r = btn.getBoundingClientRect();
    SlopUI.menu([
      { label: 'Make reel from selection…', disabled: sel.length < 2, act: () => A().makeReel(sel) },
      '-',
      { label: 'Import photos…', act: () => A().importFiles() },
      { label: 'Find duplicates…', act: () => A().dupes() },
      { label: 'Back up the whole library', act: () => A().backup() },
    ], r.left, r.bottom + 4);
  }

  /** Binds the menus to a root element (the timeline area or the sidebar). */
  function bind(root) {
    if (!window.SlopCtx) return () => {};
    return SlopCtx.bind(root, resolve);
  }

  G.menus = { bind, resolve, photoItems, albumItems, openActions };
})();
