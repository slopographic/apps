/* Slop Music: the Playlists view. Create, rename, delete; add tracks from the library; drag the handle to
 * reorder (pointer events, so it works by touch too); play; save as a .splaylist file to Slop Drive or open one.
 * Exposes window.SlopMusic.plUI = { bind, render, create, rename, remove, addTracks, selected, select }. */
(function () {
  'use strict';
  const M = (window.SlopMusic = window.SlopMusic || {});
  const UI = () => window.SlopUI, el = (...a) => UI().el(...a), H = () => window.SlopHub;
  const $ = (id) => document.getElementById(id);
  const S = { sel: null };
  const byId = (id) => M.lib.track(id);
  function renderList() {
    const all = M.playlists.all();
    if (S.sel && !M.playlists.get(S.sel)) S.sel = null;
    $('pl-list').replaceChildren(...all.map((p) => el('li', null, el('button', { type: 'button', class: 'mu-pl-btn', 'aria-current': p.id === S.sel ? 'true' : 'false',
      onclick: () => { S.sel = p.id; render(); } }, el('b', null, p.name), el('small', null, `${p.trackIds.length} ${p.trackIds.length === 1 ? 'track' : 'tracks'}`)))));
    $('pl-empty').hidden = all.length > 0;
  }
  function playlistIds(p) { return p.trackIds.filter((id) => byId(id)); }
  function item(p, id, i) {
    const t = byId(id);
    const handle = el('button', { type: 'button', class: 'mu-handle', 'aria-label': 'Drag to reorder, or use the arrow keys', title: 'Drag to reorder',
      onkeydown: (e) => keyMove(e, p, i) });
    handle.addEventListener('pointerdown', (e) => startDrag(e, p, i));
    return el('li', { class: 'mu-pl-item', 'data-i': i }, handle,
      el('button', { type: 'button', class: 'mu-row-main', onclick: () => M.engine.setQueue(playlistIds(p), id) },
        t ? M.fmt.tile(t, 'mu-cover-sm') : el('span', { class: 'mu-cover-sm mu-tile' }, '?'),
        el('span', { class: 'mu-txt' }, el('b', null, t ? M.lib.display(t) : 'Not in Slop Drive'), el('small', null, t ? [t.artist, t.album].filter(Boolean).join(' · ') : id))),
      el('button', { type: 'button', class: 'mu-more', 'aria-label': 'Remove from playlist', title: 'Remove',
        onclick: () => M.playlists.setTracks(p.id, p.trackIds.filter((x) => x !== id)) }, '×'));
  }
  function keyMove(e, p, i) {
    const to = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : -1;
    if (!e.altKey || to < 0 || to >= p.trackIds.length) return;
    e.preventDefault();
    M.playlists.setTracks(p.id, moved(p.trackIds, i, to));
  }
  const moved = (arr, from, to) => { const a = arr.slice(), [x] = a.splice(from, 1); a.splice(to, 0, x); return a; };
  /** Pointer drag: the target is the row the pointer is over when released. */
  function startDrag(e, p, from) {
    e.preventDefault();
    const list = $('pl-items'), handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const rowsEls = () => [...list.querySelectorAll('.mu-pl-item')];
    let to = from;
    const mark = (ev) => {
      const rs = rowsEls();
      to = rs.length - 1;
      for (let i = 0; i < rs.length; i++) { const r = rs[i].getBoundingClientRect(); if (ev.clientY < r.top + r.height / 2) { to = i; break; } }
      rs.forEach((r, i) => r.classList.toggle('mu-drop', i === to && to !== from));
    };
    const move = (ev) => { mark(ev); };
    const up = () => {
      handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', up);
      const target = to > from ? to - 1 : to;
      if (target !== from) M.playlists.setTracks(p.id, moved(p.trackIds, from, target));
      else rowsEls().forEach((r) => r.classList.remove('mu-drop'));
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
    handle.closest('.mu-pl-item').classList.add('mu-dragging');
  }
  function renderDetail() {
    const box = $('pl-detail'), p = S.sel && M.playlists.get(S.sel);
    if (!p) { box.replaceChildren(el('p', { class: 'mu-fine' }, 'Choose a playlist, or make a new one.')); return; }
    const ids = p.trackIds;
    box.replaceChildren(
      el('div', { class: 'mu-pl-head' }, el('h2', null, p.name), el('p', { class: 'mu-fine' }, `${ids.length} ${ids.length === 1 ? 'track' : 'tracks'}`)),
      el('div', { class: 'mu-pl-tools' },
        el('button', { type: 'button', class: 'sui-btn sui-primary', disabled: !ids.length, onclick: () => M.engine.setQueue(playlistIds(p), playlistIds(p)[0]) }, 'Play'),
        el('button', { type: 'button', class: 'sui-btn', onclick: () => addTracks(p) }, 'Add tracks…'),
        el('button', { type: 'button', class: 'sui-btn', onclick: () => rename(p) }, 'Rename'),
        el('button', { type: 'button', class: 'sui-btn', onclick: () => saveToDrive(p) }, 'Save to Slop Drive…'),
        el('button', { type: 'button', class: 'sui-btn sui-danger', onclick: () => remove(p) }, 'Delete')),
      ids.length ? el('ol', { class: 'mu-list mu-pl-items', id: 'pl-items', 'aria-label': 'Tracks in order' }, ids.map((id, i) => item(p, id, i)))
        : el('p', { class: 'mu-fine' }, 'This playlist is empty. Use “Add tracks…”.'));
  }
  function render() { renderList(); renderDetail(); }
  async function create() {
    const name = await UI().prompt('New playlist', 'Name', 'New playlist', { ok: 'Create' });
    if (name == null) return;
    const p = await M.playlists.create(name);
    S.sel = p.id;
  }
  async function rename(p) {
    const name = await UI().prompt('Rename playlist', 'Name', p.name, { ok: 'Rename' });
    if (name != null) await M.playlists.rename(p.id, name);
  }
  async function remove(p) {
    if (!(await UI().confirm('Delete playlist', `Delete “${p.name}”? The tracks stay in the library.`, 'Delete', { danger: true }))) return;
    if (S.sel === p.id) S.sel = null;
    await M.playlists.remove(p.id);
  }
  /** A checklist of library tracks; the ones already in the playlist are ticked and kept. */
  function addTracks(p) {
    const tracks = M.lib.list().sort((a, b) => M.lib.display(a).localeCompare(M.lib.display(b), undefined, { numeric: true, sensitivity: 'base' }));
    const boxes = tracks.map((t) => {
      const c = el('input', { type: 'checkbox', value: t.id, checked: p.trackIds.includes(t.id) });
      return el('label', { class: 'sui-check mu-pick' }, c, el('span', null, M.lib.display(t) + (t.artist ? ' · ' + t.artist : '')));
    });
    const body = el('div', { class: 'mu-pick-list' }, boxes.length ? boxes : el('p', { class: 'sui-p' }, 'The library is empty. Add files first.'));
    let chosen = null;
    UI().dialog({ title: 'Add tracks to ' + p.name, cls: 'sui-wide', body,
      buttons: [{ label: 'Cancel' }, { label: 'Done', primary: true, act: () => { chosen = boxes.map((l) => l.querySelector('input')).filter((c) => c.checked).map((c) => c.value); } }],
      onClose: async (ok) => {
        if (!ok || !chosen) return;
        await M.playlists.setTracks(p.id, [...p.trackIds.filter((id) => chosen.includes(id)), ...chosen.filter((id) => !p.trackIds.includes(id))]);
      } });
  }
  async function saveToDrive(p) {
    const tracks = playlistIds(p).map((id) => byId(id));
    const blob = M.plfile.build(p.name, tracks.map((t) => ({ id: t.id, title: M.lib.display(t), artist: t.artist, album: t.album, duration: t.duration })));
    const id = await H().saveToDrive(blob, M.plfile.fileName(p.name), { from: 'music', title: 'Save “' + p.name + '” to Slop Drive' });
    if (id) UI().toast('Playlist saved to Slop Drive');
  }
  async function openFromDrive() {
    const rec = await H().pickFromDrive({ accept: [M.plfile.MIME] });
    if (!rec) return;
    try {
      const parsed = M.plfile.parse(await rec.blob.text());
      const p = await M.playlists.create(parsed.name, parsed.trackIds);
      S.sel = p.id;
      UI().toast('Playlist opened');
    } catch (e) { UI().alert('Could not open', e.message || 'This file is not a playlist.'); }
  }
  function bind() {
    $('pl-new').addEventListener('click', create);
    $('pl-open').addEventListener('click', openFromDrive);
    M.playlists.subscribe(render);
    M.lib.subscribe(() => renderDetail());
  }
  /** The playlist open in the Playlists view, or null. */
  const selected = () => (S.sel ? M.playlists.get(S.sel) : null);
  M.plUI = { bind, render, create, rename, remove, addTracks, selected, select: (id) => { S.sel = id; render(); } };
})();
