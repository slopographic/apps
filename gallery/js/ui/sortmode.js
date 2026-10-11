/* Slop Gallery: Sort mode, a swipe-deck organiser over a queue (the photos visible when it opened).
 *   Up arrow: like and next      Down arrow: dislike and next
 *   Left arrow: back, no tag     Right arrow: skip ahead, no tag
 * Tags are the same as everywhere else in the app (photo.liked, photo.tags, and the Drive record for Drive photos).
 * Free-text tags are added with the box in the panel. The key rules live in core/sort.js.
 * Exposes window.SlopGallery.sortmode: open(ids), close(), press(key) -> { pos, tag, atEnd }, state(). */
(function () {
  'use strict';
  const G = (window.SlopGallery = window.SlopGallery || {});
  let root = null, queue = [], pos = 0, url = null, token = 0, opener = null;
  const TAG_LABEL = { liked: 'Liked', disliked: 'Disliked' };

  function build() {
    root = document.createElement('div');
    root.className = 'sortmode';
    root.hidden = true;
    root.tabIndex = -1;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Sort photos');
    root.innerHTML = `
      <div class="s-top">
        <button type="button" class="v-btn" data-act="close" title="Close (Esc)">Done</button>
        <span class="s-count" aria-live="polite"></span>
        <span class="v-spacer"></span>
        <span class="s-hint">↑ like · ↓ dislike · ← back · → skip</span>
      </div>
      <div class="s-stage">
        <button type="button" class="v-nav prev" data-act="back" aria-label="Back, no tag">‹</button>
        <div class="s-pic"><img alt=""></div>
        <button type="button" class="v-nav next" data-act="skip" aria-label="Skip ahead, no tag">›</button>
      </div>
      <div class="s-bar">
        <button type="button" class="s-big like" data-act="like" aria-label="Like and next">Like</button>
        <button type="button" class="s-big dislike" data-act="dislike" aria-label="Dislike and next">Dislike</button>
      </div>
      <div class="s-tags">
        <form class="s-tagform"><input type="text" maxlength="64" placeholder="Add a tag" aria-label="Add a tag to this photo"><button type="submit" class="v-btn">Add tag</button></form>
        <div class="s-taglist"></div>
        <p class="s-status" role="status"></p>
      </div>`;
    document.body.append(root);
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const map = { close: 'Escape', back: 'ArrowLeft', skip: 'ArrowRight', like: 'ArrowUp', dislike: 'ArrowDown' };
      if (map[b.dataset.act]) press(map[b.dataset.act]);
    });
    root.querySelector('.s-tagform').addEventListener('submit', (e) => { e.preventDefault(); addTag(); });
    root.addEventListener('keydown', onKey);
    G.library.on((what) => { if (!root.hidden && (what === 'tags' || what === 'photos')) { queue = queue.filter((id) => G.library.photo(id)); if (pos >= queue.length) pos = Math.max(0, queue.length - 1); if (!queue.length) close(); else paint(); } });
  }

  const cur = () => (queue.length ? G.library.photo(queue[pos]) : null);

  /** Applies one key: the position moves at once; the tag (if any) is written, then the deck repaints.
   * Resolves with what happened once the write has finished (null when the key means nothing here). */
  function press(key) {
    if (!root || root.hidden) return Promise.resolve(null);
    if (key === 'Escape') { close(); return Promise.resolve(null); }
    const d = G.sort.decide(key, pos, queue.length);
    if (!d) return Promise.resolve(null);
    const id = queue[pos];
    pos = d.pos;
    const write = d.tag && id ? G.library.setLiked([id], d.tag) : Promise.resolve(null);
    setStatus(d.tag ? `${TAG_LABEL[d.tag]}. ${d.atEnd ? 'That was the last photo in the queue.' : 'Next photo.'}` : (d.atEnd ? 'Last photo in the queue.' : ''));
    paint();
    return write.then(() => { paint(); return { pos: d.pos, tag: d.tag, atEnd: d.atEnd }; });
  }
  function setStatus(t) { if (root) root.querySelector('.s-status').textContent = t; }

  async function paint() {
    const id = queue[pos], m = cur();
    const my = ++token;
    root.querySelector('.s-count').textContent = queue.length ? `${pos + 1} / ${queue.length}` : '0 photos';
    root.querySelector('[data-act="like"]').setAttribute('aria-pressed', String(!!m && m.liked === 'liked'));
    root.querySelector('[data-act="dislike"]').setAttribute('aria-pressed', String(!!m && m.liked === 'disliked'));
    const list = root.querySelector('.s-taglist');
    list.innerHTML = '';
    if (m) for (const t of m.tags) {
      const chip = document.createElement('button');
      chip.type = 'button'; chip.className = 'chip'; chip.textContent = t + ' ×'; chip.title = 'Remove tag ' + t;
      chip.addEventListener('click', () => G.library.removeTag([id], t).then(paint));
      list.append(chip);
    }
    const next = id ? await G.urls.original(id) : null;
    if (my !== token) { G.urls.release(next); return; }
    G.urls.release(url); url = next;
    const img = root.querySelector('.s-pic img');
    img.src = url || '';
    img.alt = m ? m.name : '';
  }

  function addTag() {
    const input = root.querySelector('.s-tagform input');
    const t = input.value.trim().toLowerCase();
    if (!t || !queue[pos]) return;
    input.value = '';
    G.library.addTag([queue[pos]], t).then(() => { paint(); setStatus(`Tagged “${t}”.`); });
  }
  function onKey(e) {
    if (e.target.closest && e.target.closest('input')) { if (e.key !== 'Escape') return; }
    if (!G.sort.KEYS[e.key] && e.key !== 'Escape') return;
    e.preventDefault(); e.stopPropagation();
    press(e.key);
  }

  /** Opens the deck on the given queue of photo ids. */
  function open(ids) {
    if (!root) build();
    queue = ids.slice(); pos = 0;
    opener = document.activeElement;
    root.hidden = false;
    setStatus(queue.length ? '' : 'Nothing to sort here. Change the filters or import photos.');
    paint();
    root.focus({ preventScroll: true });
  }
  function close() {
    if (!root || root.hidden) return;
    token++;
    root.hidden = true;
    G.urls.release(url); url = null;
    root.querySelector('.s-pic img').removeAttribute('src');
    if (opener && opener.isConnected) try { opener.focus({ preventScroll: true }); } catch (e) { /* gone */ }
  }
  const state = () => ({ open: !!root && !root.hidden, pos, length: queue.length, id: queue[pos] || null });

  G.sortmode = { open, close, press, state };
})();
