/* Slop Gallery: exact duplicates. Groups photos with the same SHA-256 of their bytes. For each group one copy is kept
 * (the oldest by default, or the one you pick) and the rest are removed after a confirmation.
 * Exposes window.SlopGallery.dupes.open(). */
(function () {
  'use strict';
  const G = (window.SlopGallery = window.SlopGallery || {});
  const toast = (m) => window.SlopUI && SlopUI.toast(m);

  function groupEl(group, keep, onPick) {
    const el = SlopUI.el;
    const box = el('section', { class: 'dupe-group' });
    box.append(el('h3', { class: 'dupe-h' }, `${group.items.length} copies · ${group.items[0].name}`));
    for (const m of group.items) {
      const thumb = el('img', { alt: '', class: 'dupe-thumb' });
      G.urls.thumb(m.id).then((u) => { if (u) thumb.src = u; });
      const radio = el('input', { type: 'radio', name: 'keep-' + group.sha, value: m.id, checked: m.id === keep });
      radio.addEventListener('change', () => onPick(m.id));
      box.append(el('label', { class: 'dupe-row' }, radio, thumb,
        el('span', { class: 'dupe-meta' }, el('b', null, m.name), el('small', null, new Date(m.takenAt || 0).toLocaleString()))));
    }
    return box;
  }

  /** Opens the dialog. Resolves when it closes with the number of photos removed. */
  function open() {
    const groups = G.query.dupeGroups(G.library.list());
    if (!groups.length) { SlopUI.alert('No duplicates', 'Every photo in this library has different bytes.'); return Promise.resolve(0); }
    const keep = new Map(groups.map((g) => [g.sha, g.items[0].id]));
    const extra = () => groups.reduce((n, g) => n + g.items.length - 1, 0);
    const body = SlopUI.el('div', { class: 'dupes' });
    body.append(SlopUI.el('p', { class: 'sui-p' }, `${groups.length} ${groups.length === 1 ? 'group' : 'groups'} of exact copies. Pick the copy to keep in each group; the others are removed. Nothing is re-encoded.`));
    for (const g of groups) body.append(groupEl(g, keep.get(g.sha), (id) => keep.set(g.sha, id)));
    let removed = 0;
    return new Promise((res) => {
      SlopUI.dialog({ title: 'Duplicates', cls: 'dupes-dlg', body, onClose: () => res(removed),
        buttons: [{ label: 'Close' }, { label: 'Delete the extra copies', danger: true, act: async () => {
          const drop = [];
          for (const g of groups) for (const m of g.items) if (m.id !== keep.get(g.sha)) drop.push(m.id);
          const ok = await SlopUI.confirm('Delete extra copies', `Remove ${drop.length} duplicate ${drop.length === 1 ? 'copy' : 'copies'} (${extra()} in total, keeping one per group)? This cannot be undone.`, 'Delete', { danger: true });
          if (!ok) return false;
          removed = await G.library.remove(drop);
          drop.forEach((id) => G.urls.forget(id));
          toast(`Removed ${removed} duplicate ${removed === 1 ? 'copy' : 'copies'}`);
          return true;
        } }] });
    });
  }

  G.dupes = { open };
})();
