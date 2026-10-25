/* Slop Music: the library list. Search, sort (artist, album, title), a Tags sidebar that filters with counts,
 * drop or pick files to add, and a row menu (play, tags, playlists). Exposes window.SlopMusic.libUI. */
(function () {
  'use strict';
  const M = (window.SlopMusic = window.SlopMusic || {});
  const UI = () => window.SlopUI, el = (...a) => UI().el(...a);
  const S = { q: '', sort: 'artist', tag: '' };
  const $ = (id) => document.getElementById(id);
  let rows, stat, side, empty, scheduled = false;
  const cmp = (x, y) => String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: 'base' });
  const dash = (a, b) => (a ? 0 : 1) - (b ? 0 : 1);
  const trk = (a, b) => (a.track || 1e9) - (b.track || 1e9);   // album order: numbered tracks first, in number order
  function sortTracks(list, by) {
    const T = (t) => M.lib.display(t);
    return list.slice().sort((a, b) => {
      if (by === 'artist') return dash(a.artist, b.artist) || cmp(a.artist || '', b.artist || '') || dash(a.album, b.album) || cmp(a.album || '', b.album || '') || trk(a, b) || cmp(T(a), T(b));
      if (by === 'album') return dash(a.album, b.album) || cmp(a.album || '', b.album || '') || trk(a, b) || cmp(T(a), T(b));
      return cmp(T(a), T(b)) || cmp(a.artist || '', b.artist || '');
    });
  }
  /** The tracks the list shows: search and tag filter, then sort. */
  function visible() {
    const q = S.q.trim().toLowerCase();
    const list = M.lib.list().filter((t) => (!S.tag || t.tags.includes(S.tag)) &&
      (!q || [t.title, t.name, t.artist, t.album].join(' ').toLowerCase().includes(q)));
    return sortTracks(list, S.sort);
  }
  const curId = () => (M.engine ? M.engine.state().trackId : null);

  function playRow(t) { M.engine.setQueue(visible().map((x) => x.id), t.id); }
  function menuFor(t, x, y) {
    const pls = M.playlists.all();
    const items = [
      { label: 'Play', act: () => playRow(t) },
      { label: 'Tags…', act: () => editTags(t) },
      ...t.tags.map((tag) => ({ label: `Remove tag “${tag}”`, act: () => M.lib.setTags(t.id, t.tags.filter((x) => x !== tag)) })),
      '-',
      { label: 'New playlist with this track', act: () => newPlaylistWith(t) },
      ...pls.map((p) => ({ label: `Add to “${p.name}”`, act: async () => { const n = await M.playlists.addTracks(p.id, [t.id]); UI().toast(n ? `Added to ${p.name}` : 'Already in that playlist'); } })),
    ];
    UI().menu(items, x, y);
  }
  async function editTags(t) {
    const v = await UI().prompt('Tags', 'Tags, separated by commas (replaces the list)', t.tags.join(', '), { ok: 'Save' });
    if (v == null) return;
    const tags = window.SlopTags.parse(v);
    await M.lib.setTags(t.id, tags);
    UI().toast(tags.length ? 'Tags saved' : 'Tags removed');
  }
  async function newPlaylistWith(t) {
    const name = await UI().prompt('New playlist', 'Name', 'New playlist', { ok: 'Create' });
    if (name == null) return;
    await M.playlists.create(name, [t.id]);
    UI().toast('Playlist created');
  }
  function row(t) {
    const sub = [t.artist, t.album].filter(Boolean).join(' · ') || t.name;
    const main = el('button', { type: 'button', class: 'mu-row-main', 'aria-label': 'Play ' + M.lib.display(t), onclick: () => playRow(t) },
      M.fmt.tile(t), el('span', { class: 'mu-txt' }, el('b', null, M.lib.display(t)), el('small', null, sub),
        t.tags.length ? el('span', { class: 'mu-tagline' }, t.tags.map((g) => el('span', { class: 'mu-chip' }, g))) : null),
      el('span', { class: 'mu-dur' }, M.fmt.time(t.duration)));
    const more = el('button', { type: 'button', class: 'mu-more', title: 'More', 'aria-label': 'More for ' + M.lib.display(t),
      onclick: (e) => { const r = e.currentTarget.getBoundingClientRect(); menuFor(t, r.left, r.bottom + 4); } });
    const li = el('li', { class: 'mu-row' + (t.id === curId() ? ' on' : ''), 'data-id': t.id, title: t.error || '' }, main, more);
    li.addEventListener('contextmenu', (e) => { e.preventDefault(); menuFor(t, e.clientX, e.clientY); });
    return li;
  }
  function renderSide(all) {
    const counts = M.lib.tagCounts();
    const btn = (label, n, tag) => el('button', { type: 'button', class: 'mu-tagbtn', 'aria-pressed': S.tag === tag ? 'true' : 'false',
      onclick: () => { S.tag = S.tag === tag ? '' : tag; render(); } }, el('span', null, label), el('span', { class: 'mu-n' }, String(n)));
    side.replaceChildren(el('h2', { class: 'mu-h' }, 'Tags'), btn('All tracks', all.length, ''),
      ...counts.map(([tag, n]) => btn(tag, n, tag)),
      ...(counts.length ? [] : [el('p', { class: 'mu-fine' }, 'No tags yet. Use “Tags…” on a track to add some.')]));
  }
  function render() {
    scheduled = false;
    if (!rows) return;
    const all = M.lib.list(), shown = visible();
    renderSide(all);
    rows.replaceChildren(...shown.map(row));
    stat.textContent = all.length ? `${shown.length} of ${all.length} tracks${S.tag ? ` tagged “${S.tag}”` : ''}` : '';
    empty.hidden = all.length > 0;
  }
  const schedule = () => { if (!scheduled) { scheduled = true; requestAnimationFrame(render); } };
  /** Marks the playing row without rebuilding the list. */
  function markCurrent() {
    const cur = curId();
    if (rows) rows.querySelectorAll('.mu-row').forEach((li) => li.classList.toggle('on', li.dataset.id === cur));
  }
  /** The one way in (shared/intake, spec 'music'): Add files, the empty library's button, a drop on the library, the
   *  sample, a paste, ?drive=<id> and a PWA launch. A file is added to Slop Drive (the library); a track the library
   *  already has (another app's Open in Slop Music) plays. */
  const ACCEPT = { types: ['audio/*'], exts: ['.mp3', '.wav', '.ogg', '.oga', '.flac', '.m4a', '.aac', '.opus'], noun: 'an audio file' };
  function register() {
    window.SlopIntake.register({
      id: 'music', accept: ACCEPT, driveAccept: ['audio/*'],
      process: async (file, ctx) => {
        const id = ctx.drive && ctx.drive.id;
        if (id && M.lib.track(id)) { M.playTrack(id); return file.name; }
        if (!(await M.lib.addFiles([file]))) throw new Error('could not be added to Slop Drive');
        return file.name;
      },
    });
  }
  const addFiles = () => window.SlopIntake.pick({ to: 'music' });
  function bind() {
    register();
    rows = $('lib-list'); stat = $('lib-stat'); side = $('lib-side'); empty = $('lib-empty');
    $('lib-search').addEventListener('input', (e) => { S.q = e.target.value; schedule(); });
    $('lib-sort').addEventListener('change', (e) => { S.sort = e.target.value; schedule(); });
    $('mu-add').addEventListener('click', addFiles);
    $('lib-add-empty').addEventListener('click', addFiles);
    const view = $('v-library');
    // The library's drop strip is the intake's zone (and its feedback for every way in).
    const drop = SlopDrop.attach($('lib-drop'), {
      intake: 'music',
      compact: true,
      targets: [view],
      // the sample's button is the empty library's (below): a compact strip draws none
      sample: { label: 'Try it with 3 sample tracks', files: () => window.SlopSamples.media.melodies(3, 8) },
    });
    $('lib-preview').replaceChildren(SlopDrop.panel.preview({
      picture: { src: '../assets/shots/music.jpg', alt: 'A library of three tracks with tags; the one playing is marked' },
      steps: ['Drop MP3, WAV or other audio files', 'Search, tag and make playlists', 'Play, shuffle and repeat'] }));
    $('lib-sample').addEventListener('click', () => drop.sample());
    M.lib.subscribe(schedule);
    M.engine.subscribe(() => { if (M.engine.state().trackId !== bind.last) { bind.last = M.engine.state().trackId; markCurrent(); } });
  }
  M.libUI = { bind, render, schedule, state: S, visible, editTags, menuFor };
})();
