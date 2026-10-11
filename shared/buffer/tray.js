/* SlopBuffer tray: a small chip that shows what the buffer holds and can be dragged onto an app's canvas.
 * It is hidden while the buffer is empty. SlopBuffer.tray(host) adds it to host (default: the body) and returns it.
 * Also adds the one style rule for drop targets (.buffer-over). Classic script; needs buffer.js first. */
(function (g) {
  'use strict';
  var B = g.SlopBuffer;
  var styled = false;

  function style() {
    if (styled || !g.document) return;
    styled = true;
    var s = g.document.createElement('style');
    s.textContent = '.sbuf-tray{position:fixed;left:12px;bottom:12px;z-index:60;font:12px/1.2 system-ui,sans-serif;padding:5px 11px;border-radius:999px;border:1px solid rgba(127,127,127,.5);background:Canvas;color:CanvasText;cursor:grab;max-width:60vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.sbuf-tray[hidden]{display:none}.buffer-over{outline:2px dashed #4a8cff;outline-offset:-2px}';
    g.document.head.appendChild(s);
  }
  var LABEL = { vector: 'vector', image: 'image', text: 'text', table: 'table', clip: 'item' };

  B.tray = function (host) {
    style();
    var el = g.document.createElement('button');
    el.type = 'button';
    el.className = 'sbuf-tray';
    el.hidden = true;
    el.setAttribute('aria-label', 'Copy buffer. Drag it onto the canvas to place it.');
    B.makeDraggable(el);
    function paint(rec) {
      el.hidden = !rec;
      if (!rec) return;
      el.textContent = 'Buffer: ' + (LABEL[rec.kind] || rec.kind) + ' from ' + rec.source;
      el.title = 'Drag onto a canvas to place it. Paste also uses it.';
    }
    B.onChange(paint);
    B.ready.then(paint);
    (host || g.document.body).appendChild(el);
    return el;
  };
})(window);
