/* Conversions between the watermark spec (spec.js) and the shapes saved before it, so old settings, project files,
 * .slopflow files and links still load. Pure. Adds to window.SlopWatermarkSpec (load spec.js and spec-layout.js first).
 *   fromCfg(cfg, logo) → spec      the one-mark engine setup of before ({ kind, text, font (a CSS stack), weight, colour,
 *                                   shadow, size, logoScale, opacity, position, tile, rotate, margin, logo? }): Slop
 *                                   Watermark's saved setup, PhotoSlop's PSD resource, SlopCut's project watermark
 *   toCfg(layer) → cfg              the other way, for one layer
 *   fromPdfLayers(layers, { w, h, asset }) → spec    Slop PDF's layers (pdf/js/core/watermark.js: sizes and offsets in
 *                                   points on a w × h page; asset(id) → { url, w, h, name }) on that reference page
 *   toPdfLayers(spec, W, H, { measure, asset }) → [SlopPdfWm layer]   the spec on one W × H page (points): sizes from the
 *                                   shorter side, the margin as an offset, tiles as one layer each. measure(pdfFont, text,
 *                                   size, layer) is the text width; asset(layer) is what the layer's asset field holds
 *   OPTIONS                         Slop Workflows' option schema for its Watermark step (shared/ops/watermark.js), made
 *                                   from FIELDS and SIZE (percent where the spec has fractions)
 *   fromOptions(options, { logoAspect }) → spec ; toOptions(spec) → options (flat when one plain mark, else spec: JSON) */
(function (root) {
  'use strict';
  const S = root.SlopWatermarkSpec || (typeof require === 'function' ? require('./spec.js') : null);
  if (!S || S.fromCfg) return;
  if (!S.placements && typeof require === 'function') require('./spec-layout.js');
  const F = S.FIELDS, FONTS = S.FONTS;

  /** The font key of a CSS stack (or a PDF font name). */
  function fontKey(v) {
    const s = String(v || '');
    for (const k of Object.keys(FONTS)) if (s === FONTS[k].css || s === FONTS[k].pdf || s === k) return k;
    return /mono|courier|consol/i.test(s) ? 'mono' : /(^|[^-])serif|georgia|times/i.test(s) && !/sans/i.test(s) ? 'serif' : 'sans';
  }

  function fromCfg(c, logo) {
    c = c || {};
    const kind = c.kind === 'logo' ? 'logo' : 'text';
    const L = { kind, text: c.text == null ? F.text.value : c.text, font: fontKey(c.font), bold: (Number(c.weight) || 600) >= 600, colour: c.colour,
      shadow: c.shadow, size: kind === 'logo' ? c.logoScale : c.size, opacity: c.opacity, position: c.position, tile: c.tile, rotate: c.rotate,
      margin: c.margin, logo: logo || c.logo || '', logoName: c.logoName || '' };
    return S.normalize({ layers: [L] });
  }
  function toCfg(L) {
    return { kind: L.kind, text: L.text, font: FONTS[L.font].css, weight: L.bold ? 600 : 400, colour: L.colour, shadow: L.shadow,
      size: L.kind === 'text' ? L.size : S.SIZE.text.value, logoScale: L.kind === 'logo' ? L.size : S.SIZE.logo.value,
      opacity: L.opacity, position: L.position, tile: L.tile, rotate: L.rotate, margin: L.margin, logo: L.logo || undefined };
  }

  function fromPdfLayers(list, o = {}) {
    const s = Math.min(o.w || 612, o.h || 792), asset = o.asset || (() => null);
    return S.normalize({ layers: (list || []).map((P) => {
      const a = P.kind === 'image' ? asset(P.asset) || {} : {};
      return { id: P.id, kind: P.kind === 'image' ? 'logo' : 'text', show: P.show !== false, text: P.text, font: fontKey(P.font), bold: !!P.bold,
        colour: P.colour, shadow: false, size: (P.size || 0) / s, opacity: P.opacity, position: P.anchor, margin: 0, dx: (P.dx || 0) / s,
        dy: (P.dy || 0) / s, rotate: -(P.rot || 0), pages: P.pages || '', logo: a.url || '', logoName: a.name || '', logoW: a.w || 0, logoH: a.h || 0 };
    }) });
  }
  function toPdfLayers(spec, W, H, o = {}) {
    const s = S.short(W, H), out = [], measure = o.measure, asset = o.asset || ((L) => L.logo);
    for (const L of S.visible(spec)) {
      if (L.kind === 'text' && !L.text.trim()) continue;
      if (L.kind === 'logo' && !L.logo) continue;
      const pdfFont = FONTS[L.font].pdf;
      const item = S.itemSize(L, W, H, measure ? (t, px) => measure(pdfFont, t, px, L) : null);
      const base = { kind: L.kind === 'logo' ? 'image' : 'text', text: L.text, font: pdfFont, bold: L.bold, colour: L.colour,
        size: L.kind === 'logo' ? item.w : item.px, opacity: L.opacity, rot: -L.rotate, pages: L.pages, asset: L.kind === 'logo' ? asset(L) : '', show: true };
      if (!L.tile) {
        const col = L.position.charAt(1), row = L.position.charAt(0), m = s * L.margin;
        out.push(Object.assign({ id: L.id, anchor: L.position, dx: (col === 'l' ? m : col === 'r' ? -m : 0) + L.dx * s, dy: (row === 't' ? m : row === 'b' ? -m : 0) + L.dy * s }, base));
        continue;
      }
      S.placements(L, W, H, item).items.forEach((p, i) => out.push(Object.assign({ id: L.id + '-' + i, anchor: 'mc', dx: p.cx - W / 2, dy: p.cy - H / 2 }, base)));
    }
    return out;
  }

  /* ---------- Slop Workflows: the Watermark step's options ---------- */
  const pct = (v) => Math.round(v * 1000) / 10;
  const sel = (f) => ({ type: 'select', options: f.options });
  const range = (f, o) => Object.assign({ type: 'number', min: pct(f.min), max: pct(f.max), step: 0.5, value: pct(f.value) }, o);
  const FONT_CSS = Object.keys(FONTS).map((k) => [FONTS[k].css, FONTS[k].label]);
  const OPTIONS = [
    { key: 'mark', type: 'select', label: 'Watermark', value: 'text', options: [['text', 'Text'], ['logo', 'Logo'], ['both', 'Logo and text']] },
    { key: 'text', type: 'text', label: F.text.label, value: F.text.value, placeholder: F.text.value },
    { key: 'logo', type: 'image', label: 'Logo picture', value: '', hint: 'A PNG with a see-through background looks best. Kept inside the workflow.' },
    { key: 'font', type: 'select', label: F.font.label, value: FONT_CSS[0][0], options: FONT_CSS },
    { key: 'colour', type: 'color', label: 'Text colour', value: F.colour.value },
    { key: 'shadow', type: 'checkbox', label: F.shadow.label, value: F.shadow.value },
    range(S.SIZE.text, { key: 'size', label: 'Text size (% of the shorter side)' }),
    range(S.SIZE.logo, { key: 'logoSize', label: 'Logo size (% of the shorter side)', step: 1 }),
    { key: 'opacity', type: 'range', label: 'Opacity (%)', min: pct(F.opacity.min), max: pct(F.opacity.max), value: pct(F.opacity.value) },
    Object.assign({ key: 'position', label: F.position.label, value: F.position.value }, sel(F.position)),
    range(F.margin, { key: 'margin', label: 'Margin (% of the shorter side)' }),
    { key: 'rotate', type: 'number', label: 'Rotation (degrees)', min: F.rotate.min, max: F.rotate.max, value: F.rotate.value },
    { key: 'tile', type: 'checkbox', label: 'Repeat across the picture (tile)', value: F.tile.value },
    { key: 'pages', type: 'text', label: 'PDF pages', value: '', placeholder: 'all', hint: F.pages.hint },
    { key: 'from', type: 'number', label: 'Video: from (seconds)', min: F.from.min, max: F.from.max, step: 0.1, value: 0 },
    { key: 'to', type: 'number', label: 'Video: until (seconds, 0 is the end)', min: F.to.min, max: F.to.max, step: 0.1, value: 0 },
    { key: 'spec', type: 'watermark', label: 'My watermarks', value: '', hint: 'A watermark saved in any Slopographic app. When one is chosen, it is used instead of the settings above.' },
  ];
  const DEF = Object.fromEntries(OPTIONS.map((o) => [o.key, o.value]));

  function fromOptions(o = {}, { logoAspect = 0 } = {}) {
    if (o.spec && String(o.spec).trim()) { const sp = S.normalize(o.spec); if (sp.layers.length) return sp; }
    const v = Object.assign({}, DEF, o), mark = ['text', 'logo', 'both'].includes(v.mark) ? v.mark : 'text';
    const common = { opacity: Number(v.opacity) / 100, position: v.position, margin: Number(v.margin) / 100, rotate: Number(v.rotate) || 0,
      tile: !!v.tile, pages: v.pages || '', from: Number(v.from) || 0, to: Number(v.to) || 0 };
    const layers = [];
    const logoSize = Number(v.logoSize) / 100, textSize = Number(v.size) / 100;
    if (mark !== 'text') layers.push(Object.assign({ kind: 'logo', logo: v.logo || '', size: logoSize }, common));
    if (mark !== 'logo') {
      const T = Object.assign({ kind: 'text', text: v.text == null ? '' : String(v.text), font: fontKey(v.font), colour: v.colour, shadow: v.shadow !== false, size: textSize }, common);
      if (mark === 'both' && !v.tile) {
        // logo and text at one position: the text goes above the logo at the bottom, below it at the top and the middle
        const lh = logoSize * (logoAspect || 1), th = Math.max(0, textSize) * S.LINE, gap = 0.01, row = String(v.position || 'br').charAt(0);
        T.dy = row === 'b' ? -(lh + gap) : row === 't' ? lh + gap : (lh + th) / 2 + gap;
      }
      layers.push(T);
    }
    return S.normalize({ layers });
  }
  /** Options for a spec: the flat settings when it is one plain text or logo mark, else the whole spec as JSON. */
  function toOptions(spec) {
    const sp = S.normalize(spec), L = sp.layers[0];
    const flat = sp.layers.length === 1 && L.show && !L.dx && !L.dy && (L.kind === 'text' ? L.bold : true);
    if (!flat) return { spec: JSON.stringify(sp) };
    const o = { mark: L.kind, opacity: Math.round(L.opacity * 100), position: L.position, margin: pct(L.margin), rotate: L.rotate, tile: L.tile, pages: L.pages, from: L.from, to: L.to };
    if (L.kind === 'logo') Object.assign(o, { logo: L.logo, logoSize: Math.round(L.size * 100) });
    else Object.assign(o, { text: L.text, font: FONTS[L.font].css, colour: L.colour, shadow: L.shadow, size: pct(L.size) });
    return o;
  }

  Object.assign(S, { fontKey, fromCfg, toCfg, fromPdfLayers, toPdfLayers, OPTIONS, fromOptions, toOptions });
})(typeof window !== 'undefined' ? window : globalThis);
