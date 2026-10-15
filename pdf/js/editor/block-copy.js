/* Slop PDF — the block copy tool (K). Drag a box over a page: the text inside it is copied to the clipboard, one line
   per row, and the box stays until the next box or Escape. It takes the text of the page where the drag starts;
   the words are read from the page's text layer (editor/textlayer.js), so only text the page really has is copied.
   The text rules are in editor/block-text.js. */
(function () {
  'use strict';
  var SP = window.SP, Ed = SP.editor, S = Ed._;

  var style = document.createElement('style');
  style.textContent = '.pv-blockbox{position:absolute;z-index:50;pointer-events:none;border:1.5px dashed var(--accent,#6b5cff);background:rgba(107,92,255,.12);border-radius:2px}';
  document.head.append(style);

  // The box goes when the tool changes. Every tool change sets data-tool on the page, so one observer covers them all.
  var watcher = null;
  function clear() {
    if (watcher) { watcher.disconnect(); watcher = null; }
    if (S.blockBox) { S.blockBox.remove(); S.blockBox = null; }
  }

  /** Starts a box from the press at e (on page p). The box follows the pointer, and on release its text is copied. */
  S.blockDown = function (e, p) {
    var layer = S.pageEl && S.pageEl.querySelector('.pv-textlayer');
    if (!layer) { SlopUI.toast('This page has no text to copy.', 3000); return; }
    clear();
    var x0 = e.clientX, y0 = e.clientY;
    var box = document.createElement('div'); box.className = 'pv-blockbox';
    // The box lives inside the page (position: relative), in page coordinates, so it scrolls and zooms with the page.
    S.pageEl.append(box); S.blockBox = box;
    watcher = new MutationObserver(function () { if (S.pageEl.dataset.tool !== 'block') clear(); });
    watcher.observe(S.pageEl, { attributes: true, attributeFilter: ['data-tool'] });
    function place(x1, y1) {
      var r = { left: Math.min(x0, x1), top: Math.min(y0, y1), right: Math.max(x0, x1), bottom: Math.max(y0, y1) };
      var pr = S.pageEl.getBoundingClientRect(), z = Ed.zoom || 1;
      Object.assign(box.style, {
        left: (r.left - pr.left) / z + 'px', top: (r.top - pr.top) / z + 'px',
        width: (r.right - r.left) / z + 'px', height: (r.bottom - r.top) / z + 'px'
      });
      return r;
    }
    function move(ev) { place(ev.clientX, ev.clientY); }
    function up(ev) {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      var r = place(ev.clientX, ev.clientY);
      if (r.right - r.left < 4 || r.bottom - r.top < 4) { clear(); return; }
      var spans = [].map.call(layer.querySelectorAll('span'), function (s) {
        var rc = s.getBoundingClientRect();
        return { text: s.textContent, rect: { left: rc.left, top: rc.top, right: rc.right, bottom: rc.bottom } };
      });
      var text = SPBlockText.extract(spans, r);
      if (!text) { SlopUI.toast('No text in that box. Drag over the words.', 3000); return; }
      var lines = text.split('\n').length;
      Promise.resolve().then(function () { return navigator.clipboard.writeText(text); }).then(function () {
        SlopUI.toast('Copied ' + lines + (lines === 1 ? ' line' : ' lines') + ' of text.', 2600);
      }, function () {
        SlopUI.toast('Could not reach the clipboard. Select the page and copy from the page instead.', 4200);
      });
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  /** Escape removes the box. */
  // On window, in capture: other handlers stop Escape before it reaches the document, so this is the first place to see it.
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape') clear(); }, true);
  S.blockClear = clear;
})();
