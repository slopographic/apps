/* SlopDeck: the swipe deck for sorting photos, one at a time, full screen. Used by Slop Gallery (its library) and by Slop
 * Photo Sorter (photos dropped on the page). Classic script; sets window.SlopDeck = { create, rules }.
 *   Up arrow / Like: like and next        Down arrow / Dislike: dislike and next
 *   Left arrow: back, no tag               Right arrow: skip ahead, no tag
 *   Enter, or a letter or number typed on the photo: a tag field under it (Enter adds, commas separate, Esc cancels)
 *   Escape: close
 * The photos come from a source the app passes in:
 *   { photo(id) -> { name, liked: 'liked' | 'disliked' | null, tags: [] } | null,  url(id) -> Promise<url>,  release(url),
 *     setLiked(id, tag) -> Promise,  addTag(id, tag) -> Promise,  removeTag(id, tag) -> Promise,  on(fn)?  (fn('tags' | 'photos')),
 *     onClose()? }
 * const deck = SlopDeck.create(source): deck.open(ids, { start }), deck.close(), deck.press(key) -> Promise<{ pos, tag, atEnd }>,
 * deck.state() -> { open, pos, length, id, quick }. Styles: shared/deck/deck.css. */
(function (g) {
  'use strict';
  if (g.SlopDeck) return;
  const KEYS = {
    ArrowUp: { tag: 'liked', move: 1 }, ArrowDown: { tag: 'disliked', move: 1 },
    ArrowLeft: { tag: null, move: -1 }, ArrowRight: { tag: null, move: 1 },
  };
  /** Pure: what a key does at a position in a queue: { tag, pos, moved, atEnd }, or null for a key that means nothing.
   *  The position stays inside the queue; a move forward from the last photo stays on it and reports atEnd. */
  function decide(key, pos, length) {
    const k = KEYS[key];
    if (!k || !(length > 0)) return null;
    const start = Math.min(Math.max(0, pos | 0), length - 1);
    const next = Math.min(Math.max(0, start + k.move), length - 1);
    return { tag: k.tag, pos: next, moved: next !== start, atEnd: k.move > 0 && start === length - 1 };
  }
  const TAG_LABEL = { liked: 'Liked', disliked: 'Disliked' };
  const CHAR = /^[\p{L}\p{N}]$/u;
  const MARKUP = `
      <div class="s-top">
        <button type="button" class="dk-btn" data-act="close" title="Close (Esc)">Done</button>
        <span class="s-count" aria-live="polite"></span>
        <span class="dk-spacer"></span>
        <span class="s-hint">↑ like · ↓ dislike · ← back · → skip · Enter tag</span>
      </div>
      <div class="s-stage">
        <button type="button" class="dk-nav prev" data-act="back" aria-label="Back, no tag">‹</button>
        <div class="s-pic"><img alt=""></div>
        <button type="button" class="dk-nav next" data-act="skip" aria-label="Skip ahead, no tag">›</button>
      </div>
      <div class="s-quick" hidden><input type="text" maxlength="64" autocomplete="off" placeholder="Tag, or several separated by commas. Enter adds, Esc cancels" aria-label="Tags for this photo"></div>
      <div class="s-bar">
        <button type="button" class="s-big like" data-act="like" aria-label="Like and next">Like</button>
        <button type="button" class="s-big dislike" data-act="dislike" aria-label="Dislike and next">Dislike</button>
      </div>
      <div class="s-tags">
        <form class="s-tagform"><input type="text" maxlength="64" placeholder="Add a tag" aria-label="Add a tag to this photo"><button type="submit" class="dk-btn">Add tag</button></form>
        <div class="s-taglist"></div>
        <p class="s-status" role="status"></p>
      </div>`;

  function create(src) {
    let root = null, queue = [], pos = 0, url = null, token = 0, opener = null;
    const $ = (sel) => root.querySelector(sel);
    const cur = () => (queue.length ? src.photo(queue[pos]) : null);
    const quickOpen = () => !!root && !$('.s-quick').hidden;
    const setStatus = (t) => { if (root) $('.s-status').textContent = t; };

    function build() {
      root = document.createElement('div');
      root.className = 'sortmode';
      root.hidden = true; root.tabIndex = -1;
      root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Sort photos');
      root.innerHTML = MARKUP;
      document.body.append(root);
      root.addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]'); if (!b) return;
        const map = { close: 'Escape', back: 'ArrowLeft', skip: 'ArrowRight', like: 'ArrowUp', dislike: 'ArrowDown' };
        if (map[b.dataset.act]) press(map[b.dataset.act]);
      });
      $('.s-tagform').addEventListener('submit', (e) => { e.preventDefault(); addTag(); });
      root.addEventListener('keydown', onKey);
      if (src.on) src.on((what) => {
        if (root.hidden || (what !== 'tags' && what !== 'photos')) return;
        queue = queue.filter((id) => src.photo(id));
        if (pos >= queue.length) pos = Math.max(0, queue.length - 1);
        if (!queue.length) close(); else paint();
      });
    }

    /** One key: the position moves at once; the tag (if any) is written, then the deck repaints. */
    function press(key) {
      if (!root || root.hidden) return Promise.resolve(null);
      if (key === 'Escape') { close(); return Promise.resolve(null); }
      const d = decide(key, pos, queue.length);
      if (!d) return Promise.resolve(null);
      hideQuick();
      const id = queue[pos];
      pos = d.pos;
      const write = d.tag && id ? Promise.resolve(src.setLiked(id, d.tag)) : Promise.resolve(null);
      setStatus(d.tag ? `${TAG_LABEL[d.tag]}. ${d.atEnd ? 'That was the last photo.' : 'Next photo.'}` : (d.atEnd ? 'Last photo.' : ''));
      paint();
      return write.then(() => { paint(); return { pos: d.pos, tag: d.tag, atEnd: d.atEnd }; });
    }
    function openQuick(first) {
      if (!root || root.hidden || !queue.length) return;
      const input = $('.s-quick input');
      input.value = first || '';
      $('.s-quick').hidden = false;
      input.focus({ preventScroll: true });
      input.setSelectionRange(input.value.length, input.value.length);
    }
    function hideQuick(refocus) {
      if (!quickOpen()) return;
      $('.s-quick input').value = '';
      $('.s-quick').hidden = true;
      if (refocus !== false) root.focus({ preventScroll: true });
    }
    /** The field's text as tags: trimmed, lower case, no repeats, none the photo already has. */
    function parseTags(text, m) {
      const have = new Set(m ? m.tags : []), out = [];
      for (const part of String(text).split(',')) { const t = part.trim().toLowerCase(); if (t && !have.has(t) && !out.includes(t)) out.push(t); }
      return out;
    }
    function commitQuick() {
      const id = queue[pos];
      if (!id) { hideQuick(); return Promise.resolve(null); }
      const tags = parseTags($('.s-quick input').value, cur());
      if (!tags.length) { hideQuick(); setStatus('No tag added.'); return Promise.resolve(null); }
      hideQuick();
      const d = decide('ArrowRight', pos, queue.length);
      pos = d.pos;
      const writes = tags.reduce((p, t) => p.then(() => src.addTag(id, t)), Promise.resolve());
      setStatus(`Tagged “${tags.join('”, “')}”. ${d.atEnd ? 'That was the last photo.' : 'Next photo.'}`);
      paint();
      return writes.then(() => { paint(); return { pos: d.pos, tags, atEnd: d.atEnd }; });
    }
    function addTag() {
      const input = $('.s-tagform input'), t = input.value.trim().toLowerCase();
      if (!t || !queue[pos]) return;
      input.value = '';
      Promise.resolve(src.addTag(queue[pos], t)).then(() => { paint(); setStatus(`Tagged “${t}”.`); });
    }

    async function paint() {
      const id = queue[pos], m = cur(), my = ++token;
      $('.s-count').textContent = queue.length ? `${pos + 1} / ${queue.length}` : '0 photos';
      $('[data-act="like"]').setAttribute('aria-pressed', String(!!m && m.liked === 'liked'));
      $('[data-act="dislike"]').setAttribute('aria-pressed', String(!!m && m.liked === 'disliked'));
      $('.s-taglist').replaceChildren(...(m ? m.tags : []).map((t) => {
        const chip = document.createElement('button');
        chip.type = 'button'; chip.className = 'chip'; chip.textContent = t + ' ×'; chip.title = 'Remove tag ' + t;
        chip.addEventListener('click', () => Promise.resolve(src.removeTag(id, t)).then(paint));
        return chip;
      }));
      const next = id ? await src.url(id) : null;
      if (my !== token) { src.release(next); return; }
      src.release(url); url = next;
      const img = $('.s-pic img');
      img.src = url || '';
      img.alt = m ? m.name : '';
    }

    function onKey(e) {
      // The tag field owns its keys: nothing typed there reaches the deck's shortcuts or the page's.
      if (e.target.closest && e.target.closest('.s-quick')) {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); commitQuick(); } else if (e.key === 'Escape') { e.preventDefault(); hideQuick(); }
        return;
      }
      // The panel's tag box keeps its keys, except Escape, which closes the deck.
      if (e.target.closest && e.target.closest('input')) { if (e.key !== 'Escape') return; }
      if (e.key === 'Enter' && !(e.target.closest && e.target.closest('button'))) { e.preventDefault(); e.stopPropagation(); openQuick(''); return; }
      if (!quickOpen() && !e.ctrlKey && !e.metaKey && !e.altKey && CHAR.test(e.key)) { e.preventDefault(); e.stopPropagation(); openQuick(e.key); return; }
      if (!KEYS[e.key] && e.key !== 'Escape') return;
      e.preventDefault(); e.stopPropagation();
      press(e.key);
    }

    function open(ids, { start = 0 } = {}) {
      if (!root) build();
      queue = ids.slice(); pos = Math.min(Math.max(0, start), Math.max(0, queue.length - 1));
      opener = document.activeElement;
      root.hidden = false;
      hideQuick(false);
      setStatus(queue.length ? '' : 'Nothing to sort here.');
      paint();
      root.focus({ preventScroll: true });
    }
    function close() {
      if (!root || root.hidden) return;
      token++;
      hideQuick(false);
      root.hidden = true;
      src.release(url); url = null;
      $('.s-pic img').removeAttribute('src');
      if (opener && opener.isConnected) try { opener.focus({ preventScroll: true }); } catch (e) { /* gone */ }
      if (src.onClose) src.onClose();
    }
    const state = () => ({ open: !!root && !root.hidden, pos, length: queue.length, id: queue[pos] || null, quick: quickOpen() });
    return { open, close, press, state, get element() { return root; } };
  }

  g.SlopDeck = { create, rules: { decide, KEYS } };
})(typeof window !== 'undefined' ? window : globalThis);
