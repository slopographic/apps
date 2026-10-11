/* Slop Gallery: the Sort mode decision logic (pure, no DOM). A swipe-deck organiser over a queue of photo ids.
 *   ArrowUp     tag as liked, move to the next photo
 *   ArrowDown   tag as disliked, move to the next photo
 *   ArrowLeft   move to the previous photo, no tag (go back to an earlier one)
 *   ArrowRight  move to the next photo, no tag (skip ahead)
 * The position is clamped to the queue: at the first photo Left stays put, at the last one a move stays on it and
 * reports atEnd. decide() returns what to do; the UI applies the tag and moves the position.
 * Exposes window.SlopGallery.sort.decide(key, pos, length) -> { tag, pos, moved, atEnd } or null for other keys. */
(function () {
  'use strict';
  const G = (window.SlopGallery = window.SlopGallery || {});
  const KEYS = {
    ArrowUp: { tag: 'liked', move: 1 },
    ArrowDown: { tag: 'disliked', move: 1 },
    ArrowLeft: { tag: null, move: -1 },
    ArrowRight: { tag: null, move: 1 },
  };

  function decide(key, pos, length) {
    const k = KEYS[key];
    if (!k || !(length > 0)) return null;
    const start = Math.min(Math.max(0, pos | 0), length - 1);
    const next = Math.min(Math.max(0, start + k.move), length - 1);
    return { tag: k.tag, pos: next, moved: next !== start, atEnd: k.move > 0 && start === length - 1 };
  }

  G.sort = { decide, KEYS };
})();
