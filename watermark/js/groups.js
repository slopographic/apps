/* Slop Watermark: sorting pictures into shape groups, and the per-group override of the shared setup. Pure (no DOM).
 * Classic script. Exposes window.WMGroups.
 *   classify(w, h) → 'portrait' | 'landscape' | 'square' | 'panorama'
 *   summarise(items) → [{ kind, label, items, first, sizeText }] in KINDS order, only the groups with pictures
 *   scaleKey(kind) → the setup key of the size: 'logoScale' for a logo, 'size' for text
 *   scaleRange(kind) → { min, max, step } of the size slider, in percent ; fmtScale(kind, fraction) → '4.5%'
 *   overrideFrom(cfg) → an override copied from the shared setup (off) ; clean(raw, base) → a saved override or null
 *   applyOverride(cfg, ov) → the setup one picture is drawn with: the shared setup, or the group's when it is on */
(function () {
  'use strict';
  /** The shape thresholds. Change them here only.
   *  tol: a picture is portrait or landscape when one side is MORE than tol longer than the other (0.10 = 10 percent).
   *  panoramaMax / panoramaMin: width / height above panoramaMax or below panoramaMin is a panorama. */
  const THRESHOLDS = { tol: 0.10, panoramaMax: 2.2, panoramaMin: 0.45 };
  const KINDS = ['portrait', 'landscape', 'square', 'panorama'];
  const LABEL = { portrait: 'Portrait', landscape: 'Landscape', square: 'Square', panorama: 'Panorama' };
  const POSITIONS = window.SlopWatermark.POSITIONS;

  /** The group of a picture by its size in pixels. Panorama is checked first; a picture with no size is a square. */
  function classify(w, h) {
    if (!(w > 0 && h > 0)) return 'square';
    const T = THRESHOLDS, r = w / h;
    if (r > T.panoramaMax || r < T.panoramaMin) return 'panorama';
    if (w > h * (1 + T.tol)) return 'landscape';
    if (h > w * (1 + T.tol)) return 'portrait';
    return 'square';
  }

  /** The groups that have pictures, with the count and the size range (the shorter side, which the watermark scales by). */
  function summarise(items) {
    const out = [];
    for (const kind of KINDS) {
      const list = items.filter((x) => x.group === kind);
      if (!list.length) continue;
      const sides = list.map((x) => Math.min(x.w, x.h));
      const min = Math.min(...sides), max = Math.max(...sides);
      const n = list.length;
      const sizeText = (min === max ? String(min) : min + ' to ' + max) + ' px';
      out.push({ kind, label: LABEL[kind], items: list, first: list[0], sizeText, text: LABEL[kind] + ', ' + n + (n === 1 ? ' picture' : ' pictures') + ', ' + sizeText });
    }
    return out;
  }

  const scaleKey = (kind) => (kind === 'logo' ? 'logoScale' : 'size');
  const scaleRange = (kind) => (kind === 'logo' ? { min: 2, max: 80, step: 1 } : { min: 0.5, max: 20, step: 0.5 });
  const fmtScale = (kind, fraction) => (fraction * 100).toFixed(kind === 'logo' ? 0 : 1) + '%';

  /** An override that starts from the shared setup, and is off. */
  function overrideFrom(cfg) {
    return { on: false, position: cfg.position, opacity: cfg.opacity, size: cfg.size, logoScale: cfg.logoScale };
  }
  /** A saved override, checked: only an override that is on is kept; a bad field falls back to the shared setup. */
  function clean(raw, base) {
    if (!raw || raw.on !== true) return null;
    const num = (v, d) => (typeof v === 'number' && isFinite(v) && v >= 0 ? v : d);
    return {
      on: true,
      position: POSITIONS.includes(raw.position) ? raw.position : base.position,
      opacity: Math.min(1, num(raw.opacity, base.opacity)),
      size: num(raw.size, base.size),
      logoScale: num(raw.logoScale, base.logoScale),
    };
  }
  /** The setup for one picture: the shared setup, with the group's position, opacity and size when the group's override is on. */
  function applyOverride(cfg, ov) {
    if (!ov || !ov.on) return cfg;
    const out = Object.assign({}, cfg, { position: ov.position, opacity: ov.opacity });
    out[scaleKey(cfg.kind)] = ov[scaleKey(cfg.kind)];
    return out;
  }

  window.WMGroups = { THRESHOLDS, KINDS, LABEL, classify, summarise, scaleKey, scaleRange, fmtScale, overrideFrom, clean, applyOverride };
})();
