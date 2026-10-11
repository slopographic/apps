/* Slop Gallery: the full-screen viewer. The picture, its zoom and pan are SlopPreview's (shared/preview/, the same
 * component Slop Drive uses): the wheel, + − 0 1, the toolbar, drag, pinch, double-tap and Escape. The viewer adds the
 * gallery's own parts: ← → (previous and next), the counter, the slideshow (Space; 3, 5 or 10 seconds), the info panel
 * (I), and the footer actions: Info, Like (L), Dislike (D), Favourite (F) and Remove (Delete, after a confirmation; its
 * Drive file stays). The photo's blob URL is revoked when the viewer moves to another photo or closes.
 * Exposes window.SlopGallery.viewer.open(ids, index), .close(), .current(). */
(function () {
  'use strict';
  const G = (window.SlopGallery = window.SlopGallery || {});
  let root = null, ids = [], i = 0, url = null, pv = null, token = 0, info = false, timer = 0, opener = null;
  const LABEL = { dateFrom: { exif: 'Taken (from EXIF)', file: 'Date (from file)' } };

  const fmtBytes = (n) => (n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(1) + ' MB');
  const fmtDate = (t) => (t ? new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Unknown');

  function build() {
    root = document.createElement('div');
    root.className = 'viewer';
    root.hidden = true;
    root.tabIndex = -1;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Photo viewer');
    root.innerHTML = `
      <div class="v-top">
        <button type="button" class="v-btn" data-act="close" aria-label="Close viewer" title="Close (Esc)">×</button>
        <span class="v-count" aria-live="polite"></span>
        <span class="v-spacer"></span>
        <select class="v-sel" data-act="interval" aria-label="Slideshow interval"><option value="3000">3 s</option><option value="5000">5 s</option><option value="10000">10 s</option></select>
        <button type="button" class="v-btn" data-act="play" title="Slideshow (Space)">Play</button>
      </div>
      <div class="v-stage"><button type="button" class="v-nav prev" data-act="prev" aria-label="Previous photo">‹</button>
        <div class="v-pic"></div>
        <button type="button" class="v-nav next" data-act="next" aria-label="Next photo">›</button>
        <aside class="v-info" hidden></aside></div>
      <div class="v-foot">
        <button type="button" class="v-btn" data-act="info" title="Info (I)" aria-pressed="false">Info</button>
        <button type="button" class="v-btn" data-act="like" title="Like (L)" aria-pressed="false">Like</button>
        <button type="button" class="v-btn" data-act="dislike" title="Dislike (D)" aria-pressed="false">Dislike</button>
        <button type="button" class="v-btn" data-act="fav" title="Favourite (F)" aria-pressed="false">Favourite</button>
        <button type="button" class="v-btn danger" data-act="delete" title="Remove from library (Delete)">Remove</button>
      </div>`;
    document.body.append(root);
    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKey);
    G.library.on((what) => {
      if (root.hidden) return;
      if (what === 'photos' && !G.library.photo(ids[i])) { ids = ids.filter((id) => G.library.photo(id)); if (!ids.length) close(); else show(Math.min(i, ids.length - 1)); }
      else if (what === 'tags') { renderInfo(); syncButtons(); }
    });
  }

  function renderInfo() {
    const m = G.library.photo(ids[i]); if (!m) return;
    const panel = root.querySelector('.v-info');
    const camera = G.query.cameraOf(m) || 'Unknown camera';
    panel.innerHTML = '';
    const rows = [['Name', m.name], [LABEL.dateFrom[m.dateFrom || 'file'] || 'Date', fmtDate(m.takenAt)], ['Size', fmtBytes(m.size) + ' · ' + m.w + ' × ' + m.h + ' px'], ['Camera', camera],
      ['Liked', m.liked || 'No'], ['Tags', m.tags.length ? m.tags.join(', ') : 'None'], ['Favourite', m.fav ? 'Yes' : 'No'], ['Drive file', m.driveId ? 'Imported from Slop Drive' : 'Imported from this device']];
    for (const [k, v] of rows) { const d = document.createElement('div'); d.className = 'v-row'; d.innerHTML = '<b></b><span></span>'; d.firstChild.textContent = k; d.lastChild.textContent = v; panel.append(d); }
  }
  /** The footer's pressed states follow the photo's record. */
  function syncButtons() {
    const m = G.library.photo(ids[i]) || {};
    const press = (act, on) => { const b = root.querySelector(`[data-act="${act}"]`); if (b) b.setAttribute('aria-pressed', String(!!on)); };
    press('info', info); press('like', m.liked === 'liked'); press('dislike', m.liked === 'disliked'); press('fav', m.fav);
  }

  /** Frees the picture: its preview leaves the page and its blob URL is revoked. */
  function dropPreview() {
    const old = pv;
    pv = null; // the preview's onClose sees this and does nothing
    if (old) old.close();
    G.urls.release(url);
    url = null;
  }
  /** Puts the picture of a new photo on screen. The new preview takes the focus when the viewer had it, so the keys keep working. */
  function mount(blobUrl, title) {
    const keep = root.contains(document.activeElement) || document.activeElement === document.body;
    dropPreview();
    url = blobUrl;
    pv = window.SlopPreview.create({
      kind: 'image', blobUrl, title, chrome: false,
      onPrev: () => show(i - 1), onNext: () => show(i + 1),
      onClose: () => { if (pv) close(); },
    });
    root.querySelector('.v-pic').append(pv.el);
    if (keep) pv.el.focus({ preventScroll: true });
  }

  async function show(n) {
    if (!ids.length) return;
    i = (n + ids.length) % ids.length;
    const id = ids[i], my = ++token;
    root.querySelector('.v-count').textContent = `${i + 1} / ${ids.length}`;
    const next = await G.urls.original(id);
    if (my !== token) { G.urls.release(next); return; }
    mount(next, (G.library.photo(id) || {}).name || '');
    if (pv && G.facesUi) G.facesUi.attach(pv.el, root.querySelector('.v-top'), id); // the face badge and boxes (shared/faces/view.js)
    root.querySelector('[data-act="play"]').textContent = timer ? 'Pause' : 'Play';
    syncButtons();
    renderInfo();
    G.state.state.lastId = id;
  }

  function open(list, index = 0) {
    if (!root) build();
    ids = list.slice();
    opener = document.activeElement;
    root.hidden = false;
    root.querySelector('.v-info').hidden = !info;
    show(index);
    root.focus({ preventScroll: true });
  }
  function close() {
    stopSlides();
    token++;
    dropPreview();
    if (G.facesUi) G.facesUi.detach();
    root.hidden = true;
    if (opener && opener.isConnected) try { opener.focus({ preventScroll: true }); } catch (e) { /* gone */ }
  }
  function toggleInfo() {
    info = !info;
    root.querySelector('.v-info').hidden = !info;
    renderInfo();
    syncButtons();
  }
  function stopSlides() { clearInterval(timer); timer = 0; const b = root && root.querySelector('[data-act="play"]'); if (b) b.textContent = 'Play'; }
  function toggleSlides() {
    if (timer) { stopSlides(); return; }
    const ms = Number(root.querySelector('[data-act="interval"]').value) || 3000;
    timer = setInterval(() => show(i + 1), ms);
    root.querySelector('[data-act="play"]').textContent = 'Pause';
  }
  async function like(v) { const id = ids[i]; if (id) await G.library.setLiked([id], G.library.photo(id).liked === v ? null : v); }
  async function fav() { const id = ids[i]; if (id && G.library.photo(id)) await G.library.toggleFav([id]); }
  async function remove() {
    const id = ids[i], m = G.library.photo(id); if (!m) return;
    const ok = await window.SlopUI.confirm('Remove photo', `Remove “${m.name}” from Slop Gallery? Its Slop Drive file, if it has one, is kept.`, 'Remove', { danger: true });
    if (!ok) return;
    stopSlides();
    await G.library.remove([id]);
    G.urls.forget(id);
    ids = ids.filter((x) => x !== id);
    if (!ids.length) { close(); return; }
    show(Math.min(i, ids.length - 1));
  }

  const ACT = {
    close: () => close(), prev: () => show(i - 1), next: () => show(i + 1), info: toggleInfo,
    play: toggleSlides, like: () => like('liked'), dislike: () => like('disliked'), fav, delete: remove,
  };
  function onClick(e) { const b = e.target.closest('[data-act]'); if (b && ACT[b.dataset.act]) { e.stopPropagation(); ACT[b.dataset.act](); } }
  /** Keys the picture does not use itself (the preview takes + - 0 1, Escape and the arrows while it has the focus). */
  function onKey(e) {
    if (e.target.closest && e.target.closest('input, select')) { if (e.key !== 'Escape') return; }
    const map = { Escape: () => close(), ArrowLeft: () => show(i - 1), ArrowRight: () => show(i + 1),
      i: toggleInfo, I: toggleInfo, l: () => like('liked'), L: () => like('liked'), d: () => like('disliked'), D: () => like('disliked'),
      f: fav, F: fav, Delete: remove, Backspace: remove, ' ': toggleSlides };
    if (!map[e.key]) return;
    e.preventDefault(); e.stopPropagation();
    map[e.key]();
  }

  G.viewer = { open, close, current: () => (ids.length ? { id: ids[i], index: i, count: ids.length } : null), toggleSlides, get slideshowOn() { return !!timer; } };
})();
