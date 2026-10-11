/* SlopCut: title rendering. A title is drawn into a frame-sized canvas (cached) and composited like
   any other layer; its animation (fade, slide, pop, typewriter, rise) adds alpha/offset/scale. */
(function () {
  'use strict';
  const SE = window.SE, U = SE.util;
  const TX = SE.text = {};
  const cache = new Map(), tried = new Set();
  TX.ANIMS = [['none', 'None'], ['fade', 'Fade'], ['slide', 'Slide up'], ['pop', 'Pop'], ['type', 'Typewriter'], ['rise', 'Rise & blur']];
  const ease = (x) => 1 - Math.pow(1 - U.clamp(x, 0, 1), 3);
  const back = (x) => { x = U.clamp(x, 0, 1); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

  /** Animation state at clip-relative time u: { alpha, dy (fraction of H), scale, chars, blur }. */
  TX.animAt = function (c, u) {
    const tx = c.text, d = Math.min(0.6, c.dur / 3), outU = c.dur - u;
    const s = { alpha: 1, dy: 0, scale: 1, chars: Infinity, blur: 0 };
    const kIn = d > 0 ? U.clamp(u / d, 0, 1) : 1, kOut = d > 0 ? U.clamp(outU / d, 0, 1) : 1;
    switch (tx.anim) {
      case 'fade': s.alpha = Math.min(ease(kIn), ease(kOut)); break;
      case 'slide': s.alpha = Math.min(ease(kIn), ease(kOut)); s.dy = (1 - ease(kIn)) * 0.06 - (1 - ease(kOut)) * 0.06; break;
      case 'pop': s.scale = kIn < 1 ? 0.5 + 0.5 * back(kIn) : 1; s.alpha = Math.min(ease(kIn * 2), ease(kOut)); if (kOut < 1) s.scale *= 0.9 + 0.1 * kOut; break;
      case 'type': { const len = [...tx.str].length, need = U.clamp(len / 18, 0.4, Math.max(0.4, c.dur * 0.6)); s.chars = Math.floor(len * U.clamp(u / need, 0, 1)); s.alpha = ease(kOut); break; }
      case 'rise': s.alpha = Math.min(ease(kIn), ease(kOut)); s.dy = (1 - ease(kIn)) * 0.12; s.blur = (1 - ease(kIn)) * 12 + (1 - ease(kOut)) * 12; break;
      default: break;
    }
    return s;
  };
  function fontOf(tx, px) { return (tx.italic ? 'italic ' : '') + (tx.bold ? '800 ' : '400 ') + px + 'px "' + tx.font + '", ' + (/(mono|courier)/i.test(tx.font) ? 'monospace' : 'sans-serif'); }
  /** Frame-sized canvas with the text centred (W×H = output size, k = output px per project px). */
  TX.canvas = function (c, W, H, k, chars = Infinity) {
    const tx = c.text;
    const str = chars === Infinity ? tx.str : [...tx.str].slice(0, chars).join('');
    const key = [W, H, k.toFixed(4), str, tx.font, tx.size, tx.color, tx.stroke, tx.strokeW, tx.bold, tx.italic, tx.align, tx.bg, tx.shadow].join('|');
    let hit = cache.get(c.id);
    if (hit && hit.key === key) return hit.cv;
    const cv = hit && hit.cv.width === W && hit.cv.height === H ? hit.cv : U.canvas(W, H);
    const g = cv.getContext('2d');
    g.clearRect(0, 0, W, H);
    const px = Math.max(1, tx.size * k), lh = px * 1.15;
    g.font = fontOf(tx, px); g.textBaseline = 'middle';
    if (document.fonts && document.fonts.check && !tried.has(g.font) && !document.fonts.check(g.font) && tried.add(g.font)) document.fonts.load(g.font).then(() => { cache.delete(c.id); SE.emit('frame', {}); }).catch(() => null);
    const lines = str.split('\n'), full = tx.str.split('\n');
    const widths = full.map((l) => g.measureText(l).width), bw = Math.max(1, ...widths);
    const bh = lh * full.length, x0 = W / 2 - bw / 2, y0 = H / 2 - bh / 2;
    if (tx.bg) {
      const pad = px * 0.35;
      g.fillStyle = tx.bg; g.beginPath();
      if (g.roundRect) g.roundRect(x0 - pad, y0 - pad * 0.6, bw + pad * 2, bh + pad * 1.2, px * 0.18); else g.rect(x0 - pad, y0 - pad * 0.6, bw + pad * 2, bh + pad * 1.2);
      g.fill();
    }
    g.textAlign = tx.align;
    const ax = tx.align === 'left' ? x0 : tx.align === 'right' ? x0 + bw : W / 2;
    lines.forEach((l, i) => {
      const y = y0 + lh * (i + 0.5);
      if (tx.shadow) { g.save(); g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = px * 0.15; g.shadowOffsetY = px * 0.05; g.fillStyle = tx.color; g.fillText(l, ax, y); g.restore(); }
      if (tx.strokeW > 0) { g.lineJoin = 'round'; g.lineWidth = tx.strokeW * k * 2; g.strokeStyle = tx.stroke; g.strokeText(l, ax, y); }
      g.fillStyle = tx.color; g.fillText(l, ax, y);
    });
    cache.set(c.id, { key, cv });
    if (cache.size > 64) cache.delete(cache.keys().next().value);
    return cv;
  };
  /** Size of the text block in project pixels (for selection boxes). */
  let mctx = null;
  TX.measure = function (c) {
    const tx = c.text; mctx = mctx || U.canvas(2, 2).getContext('2d');
    mctx.font = fontOf(tx, tx.size);
    const lines = tx.str.split('\n'), w = Math.max(1, ...lines.map((l) => mctx.measureText(l).width));
    const pad = tx.bg ? tx.size * 0.7 : tx.size * 0.1;
    return { w: w + pad, h: tx.size * 1.15 * lines.length + (tx.bg ? tx.size * 0.6 : 0) };
  };
  /** Make sure web fonts used by titles are loaded before rendering (export, snapshots). */
  TX.ready = async function (p) {
    if (!document.fonts || !document.fonts.load) return;
    const fams = new Set(p.clips.filter((c) => c.kind === 'title').map((c) => fontOf(c.text, 40)));
    await Promise.all([...fams].map((f) => document.fonts.load(f).catch(() => null)));
  };
})();
