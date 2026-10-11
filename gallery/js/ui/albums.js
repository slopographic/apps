/* Slop Gallery: album dialogs. Create, rename, delete, and add the selection to an album. An album holds links to
 * photos; adding a photo never copies its bytes, and deleting an album never deletes photos.
 * Exposes window.SlopGallery.albums. */
(function () {
  'use strict';
  const G = (window.SlopGallery = window.SlopGallery || {});
  const toast = (m) => window.SlopUI && SlopUI.toast(m);

  async function create() {
    const name = await SlopUI.prompt('New album', 'Album name', '', { ok: 'Create', placeholder: 'e.g. Summer 2019' });
    if (name == null) return null;
    const a = await G.library.createAlbum(name);
    G.state.setView('album', a.id);
    return a;
  }
  async function rename(id) {
    const a = G.library.album(id); if (!a) return null;
    const name = await SlopUI.prompt('Rename album', 'Album name', a.name, { ok: 'Rename' });
    if (name == null || !name.trim()) return null;
    return G.library.renameAlbum(id, name);
  }
  async function remove(id) {
    const a = G.library.album(id); if (!a) return false;
    const ok = await SlopUI.confirm('Delete album', `Delete the album “${a.name}”? Its ${a.photoIds.length} photos stay in the library.`, 'Delete', { danger: true });
    if (!ok) return false;
    await G.library.deleteAlbum(id);
    if (G.state.state.query.album === id) G.state.setView('photos');
    toast('Album deleted');
    return true;
  }
  /** Asks which album, or offers a new one. ids: photo ids to add (links only). */
  async function addIds(ids) {
    if (!ids.length) return 0;
    const albums = G.library.albums();
    if (!albums.length) { const a = await create(); if (a) { const n = await G.library.addToAlbum(a.id, ids); toast(`Added ${n} to “${a.name}”`); return n; } return 0; }
    const sel = SlopUI.select([...albums.map((a) => [a.id, a.name]), ['__new', 'New album…']], albums[0].id);
    const body = SlopUI.el('div', null, SlopUI.field('Album', sel));
    let added = 0;
    await new Promise((res) => SlopUI.dialog({ title: `Add ${ids.length} to an album`, body,
      buttons: [{ label: 'Cancel' }, { label: 'Add', primary: true, act: async () => {
        if (sel.value === '__new') { const a = await create(); if (a) added = await G.library.addToAlbum(a.id, ids); }
        else added = await G.library.addToAlbum(sel.value, ids);
        return true;
      } }], onClose: () => res() }));
    toast(added ? `Added ${added} ${added === 1 ? 'photo' : 'photos'}` : 'Already in that album');
    return added;
  }

  G.albums = { create, rename, remove, addIds };
})();
