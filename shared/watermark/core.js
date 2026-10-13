/* Slopographic watermark engine (one source for Slop Watermark, the SlopCut and PhotoSlop modules).
 * window.SlopWatermark.draw(ctx, w, h, cfg, assets) paints a text or logo watermark onto a 2D canvas context
 * of size w x h. Positions and sizes are fractions of the frame's shorter side, so the same settings look the
 * same on a photo, a thumbnail or a video frame. Classic script; no dependencies. */
(function () {
  'use strict';
  var POS = { tl: [0, 0], tc: [0.5, 0], tr: [1, 0], ml: [0, 0.5], mc: [0.5, 0.5], mr: [1, 0.5], bl: [0, 1], bc: [0.5, 1], br: [1, 1] };

  function defaults() {
    return { kind: 'text', text: '© Your name', font: 'Inter Tight, system-ui, sans-serif', weight: 600,
      colour: '#ffffff', shadow: true, size: 0.045, logoScale: 0.2, opacity: 0.5,
      position: 'br', tile: false, rotate: 0, margin: 0.03 };
  }

  /** The size of one watermark item in pixels, { w, h }, for a frame of w x h. */
  function itemSize(ctx, w, h, cfg, img) {
    var s = Math.min(w, h);
    if (cfg.kind === 'logo' && img) {
      var lw = s * cfg.logoScale, aspect = (img.naturalHeight || img.height) / (img.naturalWidth || img.width);
      return { w: lw, h: lw * aspect };
    }
    var px = Math.max(8, s * cfg.size);
    ctx.save(); ctx.font = cfg.weight + ' ' + px + 'px ' + cfg.font;
    var tw = ctx.measureText(cfg.text || ' ').width; ctx.restore();
    return { w: tw, h: px * 1.2 };
  }

  /** Where one item goes: the anchor point inside the frame, with the margin. Returns the item's top-left. */
  function anchored(w, h, cfg, size) {
    var a = POS[cfg.position] || POS.br, m = Math.min(w, h) * cfg.margin;
    var x = a[0] === 0 ? m : a[0] === 1 ? w - m - size.w : (w - size.w) / 2;
    var y = a[1] === 0 ? m : a[1] === 1 ? h - m - size.h : (h - size.h) / 2;
    return { x: x, y: y };
  }

  function paintItem(ctx, cfg, img, x, y, size) {
    if (cfg.kind === 'logo' && img) { ctx.drawImage(img, x, y, size.w, size.h); return; }
    ctx.font = cfg.weight + ' ' + (size.h / 1.2) + 'px ' + cfg.font;
    ctx.textBaseline = 'top';
    if (cfg.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = size.h * 0.15; ctx.shadowOffsetY = size.h * 0.05; }
    ctx.fillStyle = cfg.colour;
    ctx.fillText(cfg.text, x, y);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  }

  /** Paints the watermark onto ctx (a 2D context already sized w x h). assets.image is the logo when kind is 'logo'. */
  function draw(ctx, w, h, cfg, assets) {
    cfg = Object.assign(defaults(), cfg || {});
    var img = assets && assets.image || null;
    if (cfg.kind === 'logo' && !img) return;
    if (cfg.kind !== 'logo' && !cfg.text) return;
    var size = itemSize(ctx, w, h, cfg, img);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, cfg.opacity));
    ctx.textAlign = 'left';
    if (!cfg.tile) {
      var p = anchored(w, h, cfg, size);
      var cx = p.x + size.w / 2, cy = p.y + size.h / 2;
      ctx.translate(cx, cy); ctx.rotate(cfg.rotate * Math.PI / 180);
      paintItem(ctx, cfg, img, -size.w / 2, -size.h / 2, size);
    } else {
      var gap = Math.min(w, h) * 0.12, stepX = size.w + gap, stepY = size.h + gap;
      var diag = Math.hypot(w, h);
      ctx.translate(w / 2, h / 2); ctx.rotate(cfg.rotate * Math.PI / 180);
      for (var y = -diag / 2; y < diag / 2; y += stepY) {
        for (var x = -diag / 2; x < diag / 2; x += stepX) paintItem(ctx, cfg, img, x, y, size);
      }
    }
    ctx.restore();
  }

  window.SlopWatermark = { defaults: defaults, draw: draw, itemSize: itemSize, POSITIONS: Object.keys(POS) };
})();
