/* Slop Cutout — compose the final picture from an active cutout: background (transparent, colour,
 * gradient or blurred original), drop shadow and crop. Pure canvas work, no DOM state. */
(function () {
  'use strict';
  const CO = window.CO, U = CO.util;
  const C = CO.compose = {};

  /** Tight box around the alpha (mask > 8) of an image. Returns { x, y, w, h } or null if empty. */
  C.bbox = function (mask, w, h) {
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        if (mask[row + x] <= 8) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        y1 = y;
      }
    }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  };

  /** The canvas for a cutout's ImageData (cached on the active record). */
  C.cutCanvas = function (act) {
    if (act.cut) return act.cut;
    const c = U.canvas(act.w, act.h);
    U.ctx(c).putImageData(act.cutout, 0, 0);
    act.cut = c;
    return c;
  };

  /** Output rectangle in image pixels: the whole image, or the subject plus padding. */
  C.boxOf = function (it, act) {
    if (it.crop.mode !== 'subject' || !act.bbox) return { x: 0, y: 0, w: act.w, h: act.h };
    const p = Math.max(0, it.crop.pad | 0), b = act.bbox;
    const x = Math.max(0, b.x - p), y = Math.max(0, b.y - p);
    const x1 = Math.min(act.w, b.x + b.w + p), y1 = Math.min(act.h, b.y + b.h + p);
    return { x, y, w: x1 - x, h: y1 - y };
  };

  function paintBackground(g, it, act, box) {
    const bg = it.bg;
    if (bg.mode === 'color') { g.fillStyle = bg.color; g.fillRect(0, 0, box.w, box.h); }
    else if (bg.mode === 'gradient') {
      const a = (bg.angle || 0) * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a);
      const half = (Math.abs(box.w * dx) + Math.abs(box.h * dy)) / 2, cx = box.w / 2, cy = box.h / 2;
      const grad = g.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
      grad.addColorStop(0, bg.gradA); grad.addColorStop(1, bg.gradB);
      g.fillStyle = grad; g.fillRect(0, 0, box.w, box.h);
    } else if (bg.mode === 'blur' && act.bitmap) {
      g.filter = `blur(${Math.max(0, bg.blur)}px)`;
      g.drawImage(act.bitmap, -box.x, -box.y, act.w, act.h);
      g.filter = 'none';
    }
  }

  /** Full-resolution picture for an item's look. Transparent backgrounds keep alpha. */
  C.render = function (it, act) {
    const box = C.boxOf(it, act);
    const c = U.canvas(box.w, box.h), g = U.ctx(c);
    paintBackground(g, it, act, box);
    const sh = it.shadow;
    if (sh.on && sh.opacity > 0) {
      g.shadowColor = U.rgba(sh.color, sh.opacity);
      g.shadowBlur = Math.max(0, sh.blur) * 4;
      g.shadowOffsetX = sh.x; g.shadowOffsetY = sh.y;
    }
    g.drawImage(C.cutCanvas(act), -box.x, -box.y);
    g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetX = 0; g.shadowOffsetY = 0;
    return c;
  };

  /** Grey view of the mask (white = keep), cropped like the result. */
  C.maskCanvas = function (it, act) {
    const box = C.boxOf(it, act), src = U.canvas(act.w, act.h), sg = U.ctx(src);
    sg.putImageData(new ImageData(new Uint8ClampedArray(act.w * act.h * 4).map((_, i) => (i % 4 === 3 ? 255 : act.mask[i >> 2])), act.w, act.h), 0, 0);
    const c = U.canvas(box.w, box.h);
    U.ctx(c).drawImage(src, -box.x, -box.y);
    return c;
  };
})();
