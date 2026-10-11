/* Slop Gallery: the full-screen viewer. Arrow keys move, Esc closes, Z toggles fit / 100%, I shows the info panel,
 * L and D tag like and dislike, Delete removes the photo from the library (after a confirmation; its Drive file stays),
 * Space plays or pauses the slideshow (interval 3, 5 or 10 seconds). The original bytes are shown, via a URL that is
 * revoked as soon as the viewer moves on. Exposes window.SlopGallery.viewer.open(ids, index), .close(), .current(). */
(function () {
  'use strict';
  const G = (window.SlopGallery = window.SlopGallery || {});
  let root = null, ids = [], i = 0, url = null, token = 0, zoom = 'fit', info = false, timer = 0, opener = null;
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
        <button type="button" class="v-btn" data-act="zoom" title="Zoom (Z)">Fit</button>
        <button type="button" class="v-btn" data-act="info" title="Info (I)" aria-pressed="false">Info</button>
        <button type="button" class="v-btn" data-act="like" title="Like (L)">Like</button>
        <button type="button" class="v-btn" data-act="dislike" title="Dislike (D)">Dislike</button>
        <button type="button" class="v-btn danger" data-act="delete" title="Remove from library (Delete)">Remove</button>
      </div>
      <div class="v-stage"><button type="button" class="v-nav prev" data-act="prev" aria-label="Previous photo">‹</button>
        <div class="v-pic"><img alt=""></div>
        <button type="button" class="v-nav next" data-act="next" aria-label="Next photo">›</button></div>
      <aside class="v-info" hidden></aside>`;
    document.body.append(root);
    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKey);
    G.library.on((what) => { if (!root.hidden && what === 'photos' && !G.library.photo(ids[i])) { ids = ids.filter((id) => G.library.photo(id)); if (!ids.length) close(); else show(Math.min(i, ids.length - 1)); } else if (!root.hidden && what === 'tags') renderInfo(); });
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

  async function show(n) {
    if (!ids.length) return;
    i = (n + ids.length) % ids.length;
    const id = ids[i], my = ++token;
    const next = await G.urls.original(id);
    if (my !== token) { G.urls.release(next); return; }
    G.urls.release(url); url = next;
    const img = root.querySelector('.v-pic img');
    img.src = url || '';
    img.alt = (G.library.photo(id) || {}).name || '';
    applyZoom();
    root.querySelector('.v-count').textContent = `${i + 1} / ${ids.length}`;
    root.querySelector('[data-act="zoom"]').textContent = zoom === 'fit' ? 'Fit' : '100%';
    root.querySelector('[data-act="info"]').setAttribute('aria-pressed', String(info));
    renderInfo();
    G.state.state.lastId = id;
  }
  function applyZoom() { root.querySelector('.v-pic').classList.toggle('actual', zoom === '100'); }

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
    root.hidden = true;
    G.urls.release(url); url = null;
    root.querySelector('.v-pic img').removeAttribute('src');
    if (opener && opener.isConnected) try { opener.focus({ preventScroll: true }); } catch (e) { /* gone */ }
  }
  function toggleInfo() {
    info = !info;
    root.querySelector('.v-info').hidden = !info;
    root.querySelector('[data-act="info"]').setAttribute('aria-pressed', String(info));
    renderInfo();
  }
  function toggleZoom() { zoom = zoom === 'fit' ? '100' : 'fit'; applyZoom(); root.querySelector('[data-act="zoom"]').textContent = zoom === 'fit' ? 'Fit' : '100%'; }
  function stopSlides() { clearInterval(timer); timer = 0; const b = root && root.querySelector('[data-act="play"]'); if (b) b.textContent = 'Play'; }
  function toggleSlides() {
    if (timer) { stopSlides(); return; }
    const ms = Number(root.querySelector('[data-act="interval"]').value) || 3000;
    timer = setInterval(() => show(i + 1), ms);
    root.querySelector('[data-act="play"]').textContent = 'Pause';
  }
  async function like(v) { const id = ids[i]; if (id) await G.library.setLiked([id], G.library.photo(id).liked === v ? null : v); }
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
    close: () => close(), prev: () => show(i - 1), next: () => show(i + 1), zoom: toggleZoom, info: toggleInfo,
    play: toggleSlides, like: () => like('liked'), dislike: () => like('disliked'), delete: remove,
  };
  function onClick(e) { const b = e.target.closest('[data-act]'); if (b && ACT[b.dataset.act]) { e.stopPropagation(); ACT[b.dataset.act](); } }
  function onKey(e) {
    if (e.target.closest && e.target.closest('input, select')) { if (e.key !== 'Escape') return; }
    const k = e.key;
    const map = { Escape: () => close(), ArrowLeft: () => show(i - 1), ArrowRight: () => show(i + 1), z: toggleZoom, Z: toggleZoom,
      i: toggleInfo, I: toggleInfo, l: () => like('liked'), L: () => like('liked'), d: () => like('disliked'), D: () => like('disliked'),
      Delete: remove, Backspace: remove, ' ': toggleSlides };
    if (!map[k]) return;
    e.preventDefault(); e.stopPropagation();
    map[k]();
  }

  G.viewer = { open, close, current: () => (ids.length ? { id: ids[i], index: i, count: ids.length } : null), toggleSlides, get slideshowOn() { return !!timer; } };
})();
