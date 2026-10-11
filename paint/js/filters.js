/* Slop Shop: adjustments, filters and layer styles.
 * Each entry: { id, name, menu, params, fn(canvas, params, env) → canvas | Promise<canvas> }.
 * fn must not mutate its input. env = { fg, bg } colours. */
'use strict';

function withPixels(src, fn) {
  const c = copyCanvas(src), g = cxr(c), img = g.getImageData(0, 0, c.width, c.height);
  fn(img.data, c.width, c.height, img);
  g.putImageData(img, 0, 0);
  return c;
}
function lutMap(src, lr, lg = lr, lb = lr) {
  return withPixels(src, (d) => { for (let i = 0; i < d.length; i += 4) { d[i] = lr[d[i]]; d[i + 1] = lg[d[i + 1]]; d[i + 2] = lb[d[i + 2]]; } });
}
const makeLut = (f) => { const l = new Uint8ClampedArray(256); for (let i = 0; i < 256; i++) l[i] = f(i); return l; };
/** Bilinear sample of RGBA data into out[0..3]. */
function sample(d, w, hh, x, y, out) {
  x = clamp(x, 0, w - 1.001); y = clamp(y, 0, hh - 1.001);
  const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0;
  const i00 = (y0 * w + x0) * 4, i10 = i00 + 4, i01 = i00 + w * 4, i11 = i01 + 4;
  for (let k = 0; k < 4; k++) out[k] = (d[i00 + k] * (1 - fx) + d[i10 + k] * fx) * (1 - fy) + (d[i01 + k] * (1 - fx) + d[i11 + k] * fx) * fy;
}
/** Remap: for each output pixel, fn(x, y) returns source coords in p (p[0], p[1]); return false to keep. */
function displace(src, fn) {
  const w = src.width, hh = src.height;
  const sd = cxr(src).getImageData(0, 0, w, hh).data;
  const c = mkCanvas(w, hh), g = cxr(c), img = g.createImageData(w, hh), d = img.data, p = [0, 0], o = [0, 0, 0, 0];
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (fn(x, y, p) === false) { d[i] = sd[i]; d[i + 1] = sd[i + 1]; d[i + 2] = sd[i + 2]; d[i + 3] = sd[i + 3]; continue; }
    sample(sd, w, hh, p[0], p[1], o);
    d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2]; d[i + 3] = o[3];
  }
  g.putImageData(img, 0, 0);
  return c;
}
function convolve(src, k, opts = {}) {
  const w = src.width, hh = src.height, sd = cxr(src).getImageData(0, 0, w, hh).data;
  const c = mkCanvas(w, hh), g = cxr(c), img = g.createImageData(w, hh), d = img.data;
  const bias = opts.bias || 0, kd = 3;
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
    let r = 0, gg = 0, b = 0;
    for (let ky = 0; ky < kd; ky++) for (let kx = 0; kx < kd; kx++) {
      const sx = clamp(x + kx - 1, 0, w - 1), sy = clamp(y + ky - 1, 0, hh - 1), j = (sy * w + sx) * 4, kv = k[ky * kd + kx];
      r += sd[j] * kv; gg += sd[j + 1] * kv; b += sd[j + 2] * kv;
    }
    const i = (y * w + x) * 4;
    d[i] = r + bias; d[i + 1] = gg + bias; d[i + 2] = b + bias; d[i + 3] = sd[i + 3];
  }
  g.putImageData(img, 0, 0);
  return c;
}
function gaussian(src, r) {
  const c = copyCanvas(src), g = cxr(c), img = g.getImageData(0, 0, c.width, c.height);
  blurImageData(img, r); g.putImageData(img, 0, 0); return c;
}
/** Seeded PRNG so previews and the final apply match. */
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }
function valueNoise2D(seed) {
  const R = rng(seed), P = new Float32Array(256 * 256);
  for (let i = 0; i < P.length; i++) P[i] = R();
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = sm(x - x0), fy = sm(y - y0);
    const v = (a, b) => P[((b & 255) << 8) | (a & 255)];
    return lerp(lerp(v(x0, y0), v(x0 + 1, y0), fx), lerp(v(x0, y0 + 1), v(x0 + 1, y0 + 1), fx), fy);
  };
}
/** Monotone cubic through points [[x,y]...] (0..255) → LUT. */
function curveLut(pts) {
  pts = pts.slice().sort((a, b) => a[0] - b[0]);
  const n = pts.length;
  if (n < 2) return makeLut((i) => i);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), dx = [], m = [];
  for (let i = 0; i < n - 1; i++) { dx.push(xs[i + 1] - xs[i] || 1e-6); m.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i] || 1e-6)); }
  const t = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]));
  t.push(m[n - 2]);
  return makeLut((x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const hh = dx[i], s = (x - xs[i]) / hh, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * ys[i] + (s3 - 2 * s2 + s) * hh * t[i] + (-2 * s3 + 3 * s2) * ys[i + 1] + (s3 - s2) * hh * t[i + 1];
  });
}
function histogram(src) {
  const d = cxr(src).getImageData(0, 0, src.width, src.height).data, H = { l: new Uint32Array(256), r: new Uint32Array(256), g: new Uint32Array(256), b: new Uint32Array(256) };
  const step = Math.max(1, Math.floor(d.length / 4 / 400000)) * 4;
  for (let i = 0; i < d.length; i += step) { if (!d[i + 3]) continue; H.r[d[i]]++; H.g[d[i + 1]]++; H.b[d[i + 2]]++; H.l[Math.round(luma(d[i], d[i + 1], d[i + 2]))]++; }
  return H;
}
function percentile(hist, p) {
  let tot = 0; for (const v of hist) tot += v;
  let acc = 0; for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= tot * p) return i; }
  return 255;
}
/** Sliding min/max over alpha+rgb (erode/dilate). */
function rankFilter(src, r, isMax, alphaOnly) {
  const w = src.width, hh = src.height, sd = cxr(src).getImageData(0, 0, w, hh).data;
  const tmp = new Uint8ClampedArray(sd.length), out = new Uint8ClampedArray(sd.length);
  const pick = isMax ? Math.max : Math.min, chans = alphaOnly ? [3] : [0, 1, 2, 3];
  for (const k of chans) {
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
      let v = isMax ? 0 : 255;
      for (let dx = -r; dx <= r; dx++) { const xx = x + dx; if (xx >= 0 && xx < w) v = pick(v, sd[(y * w + xx) * 4 + k]); }
      tmp[(y * w + x) * 4 + k] = v;
    }
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
      let v = isMax ? 0 : 255;
      for (let dy = -r; dy <= r; dy++) { const yy = y + dy; if (yy >= 0 && yy < hh) v = pick(v, tmp[(yy * w + x) * 4 + k]); }
      out[(y * w + x) * 4 + k] = v;
    }
  }
  if (alphaOnly) for (let i = 0; i < out.length; i += 4) { out[i] = sd[i]; out[i + 1] = sd[i + 1]; out[i + 2] = sd[i + 2]; }
  const c = mkCanvas(w, hh); cxr(c).putImageData(new ImageData(out, w, hh), 0, 0);
  return c;
}
/** Solid-colour silhouette of src's alpha. */
function silhouette(src, color, opacity = 1) {
  const c = mkCanvas(src.width, src.height), g = cx(c);
  g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.globalAlpha = opacity; g.fillRect(0, 0, c.width, c.height);
  return c;
}
function under(src, below) { const c = copyCanvas(below), g = cx(c); g.drawImage(src, 0, 0); return c; }
function blobToCanvas(blob) {
  return new Promise((res, rej) => { const u = URL.createObjectURL(blob), i = new Image(); i.onload = () => { const c = mkCanvas(i.width, i.height); cx(c).drawImage(i, 0, 0); URL.revokeObjectURL(u); res(c); }; i.onerror = rej; i.src = u; });
}
async function jpegCrunch(src, q, times = 1) {
  let c = src;
  for (let k = 0; k < times; k++) {
    const flat = mkCanvas(c.width, c.height), g = cx(flat); g.fillStyle = '#808080'; g.fillRect(0, 0, c.width, c.height); g.drawImage(c, 0, 0);
    const blob = await canvasToBlob(flat, 'image/jpeg', q);
    c = await blobToCanvas(blob);
  }
  const out = copyCanvas(c), g = cx(out); g.globalCompositeOperation = 'destination-in'; g.drawImage(src, 0, 0);
  return out;
}

const R = (k, label, min, max, v, extra = {}) => Object.assign({ k, label, type: 'range', min, max, v, step: 1 }, extra);
const FILTERS = [
  /* ---------- Adjustments ---------- */
  { id: 'brightness', menu: 'adjust', name: 'Brightness/Contrast…', params: [R('b', 'Brightness', -150, 150, 0), R('c', 'Contrast', -100, 100, 0)],
    fn: (s, p) => { const c = p.c * 2.55, f = (259 * (c + 255)) / (255 * (259 - c)); return lutMap(s, makeLut((v) => (v - 128) * f + 128 + p.b * 0.6)); } },
  { id: 'levels', menu: 'adjust', name: 'Levels…', key: 'Ctrl+L', params: [{ k: 'hist', type: 'histogram' }, R('inB', 'Input black', 0, 253, 0), R('gamma', 'Midtones (gamma)', 0.1, 9.99, 1, { step: 0.01 }), R('inW', 'Input white', 2, 255, 255), R('outB', 'Output black', 0, 255, 0), R('outW', 'Output white', 0, 255, 255)],
    fn: (s, p) => { const lo = Math.min(p.inB, p.inW - 1); return lutMap(s, makeLut((v) => Math.pow(clamp((v - lo) / (p.inW - lo), 0, 1), 1 / p.gamma) * (p.outW - p.outB) + p.outB)); } },
  { id: 'curves', menu: 'adjust', name: 'Curves…', key: 'Ctrl+M', params: [{ k: 'curve', type: 'curve', v: { rgb: [[0, 0], [255, 255]], r: [[0, 0], [255, 255]], g: [[0, 0], [255, 255]], b: [[0, 0], [255, 255]] } }],
    fn: (s, p) => { const m = curveLut(p.curve.rgb), lr = curveLut(p.curve.r), lg = curveLut(p.curve.g), lb = curveLut(p.curve.b); return lutMap(s, makeLut((v) => lr[m[v]]), makeLut((v) => lg[m[v]]), makeLut((v) => lb[m[v]])); } },
  { id: 'exposure', menu: 'adjust', name: 'Exposure…', params: [R('ev', 'Exposure', -5, 5, 0, { step: 0.01 }), R('off', 'Offset', -0.5, 0.5, 0, { step: 0.001 }), R('gam', 'Gamma correction', 0.1, 9.99, 1, { step: 0.01 })],
    fn: (s, p) => lutMap(s, makeLut((v) => { const lin = Math.pow(v / 255, 2.2) * Math.pow(2, p.ev) + p.off; return Math.pow(Math.max(0, lin), 1 / 2.2 / p.gam) * 255; })) },
  { id: 'vibrance', menu: 'adjust', name: 'Vibrance…', params: [R('vib', 'Vibrance', -100, 100, 0), R('sat', 'Saturation', -100, 100, 0)],
    fn: (s, p) => withPixels(s, (d) => {
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2], l = luma(r, g, b), sat = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
        const k = 1 + (p.vib / 100) * (1 - sat) * 1.5 + p.sat / 100;
        d[i] = l + (r - l) * k; d[i + 1] = l + (g - l) * k; d[i + 2] = l + (b - l) * k;
      }
    }) },
  { id: 'huesat', menu: 'adjust', name: 'Hue/Saturation…', key: 'Ctrl+U', params: [R('h', 'Hue', -180, 180, 0), R('s', 'Saturation', -100, 100, 0), R('l', 'Lightness', -100, 100, 0), { k: 'colorize', label: 'Colorize', type: 'check', v: false }],
    fn: (s, p) => withPixels(s, (d) => {
      const ss = p.s / 100, ll = p.l / 100;
      for (let i = 0; i < d.length; i += 4) {
        let [hh, sat, l] = rgbToHsl(d[i], d[i + 1], d[i + 2]);
        if (p.colorize) { hh = (p.h + 360) % 360; sat = clamp(0.25 + ss * 0.75, 0, 1); }
        else { hh = (hh + p.h + 360) % 360; sat = clamp(ss > 0 ? sat + (1 - sat) * ss * sat * 1.5 + sat * ss * 0.4 : sat * (1 + ss), 0, 1); }
        l = ll > 0 ? l + (1 - l) * ll : l * (1 + ll);
        const [r, g, b] = hslToRgb(hh, sat, l); d[i] = r; d[i + 1] = g; d[i + 2] = b;
      }
    }) },
  { id: 'balance', menu: 'adjust', name: 'Color Balance…', key: 'Ctrl+B', params: [{ k: 'tone', label: 'Tone', type: 'select', options: [['shadows', 'Shadows'], ['midtones', 'Midtones'], ['highlights', 'Highlights']], v: 'midtones' }, R('cr', 'Cyan ↔ Red', -100, 100, 0), R('mg', 'Magenta ↔ Green', -100, 100, 0), R('yb', 'Yellow ↔ Blue', -100, 100, 0), { k: 'keep', label: 'Preserve luminosity', type: 'check', v: true }],
    fn: (s, p) => withPixels(s, (d) => {
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2], l = luma(r, g, b) / 255;
        const w = p.tone === 'shadows' ? clamp(1 - l * 1.6, 0, 1) : p.tone === 'highlights' ? clamp((l - 0.375) * 1.6, 0, 1) : clamp(1 - Math.abs(l - 0.5) * 2.2, 0, 1);
        let nr = r + p.cr * 0.7 * w, ng = g + p.mg * 0.7 * w, nb = b + p.yb * 0.7 * w;
        if (p.keep) { const nl = luma(nr, ng, nb) || 1, k = (l * 255) / nl; nr *= k; ng *= k; nb *= k; }
        d[i] = nr; d[i + 1] = ng; d[i + 2] = nb;
      }
    }) },
  { id: 'bw', menu: 'adjust', name: 'Black & White…', params: [R('re', 'Reds', -200, 300, 40), R('ye', 'Yellows', -200, 300, 60), R('gr', 'Greens', -200, 300, 40), R('cy', 'Cyans', -200, 300, 60), R('bl', 'Blues', -200, 300, 20), R('ma', 'Magentas', -200, 300, 80), { k: 'tint', label: 'Tint', type: 'check', v: false }, { k: 'tintc', label: 'Tint colour', type: 'color', v: '#e1d3b3' }],
    fn: (s, p) => withPixels(s, (d) => {
      // Photoshop's B&W: min + (mid−min)·w(secondary) + (max−mid)·w(primary).
      const W = { r: p.re / 100, y: p.ye / 100, g: p.gr / 100, c: p.cy / 100, b: p.bl / 100, m: p.ma / 100 };
      const [th, ts] = rgbToHsl(...hexToRgb(p.tintc));
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        let mx, md, mn, prim, sec;
        if (r >= g && r >= b) { mx = r; prim = W.r; if (g >= b) { md = g; mn = b; sec = W.y; } else { md = b; mn = g; sec = W.m; } }
        else if (g >= r && g >= b) { mx = g; prim = W.g; if (r >= b) { md = r; mn = b; sec = W.y; } else { md = b; mn = r; sec = W.c; } }
        else { mx = b; prim = W.b; if (r >= g) { md = r; mn = g; sec = W.m; } else { md = g; mn = r; sec = W.c; } }
        const v = clamp(mn + (md - mn) * sec + (mx - md) * prim, 0, 255);
        if (p.tint) { const [tr, tg, tb] = hslToRgb(th, ts * 0.6, v / 255); d[i] = tr; d[i + 1] = tg; d[i + 2] = tb; } else d[i] = d[i + 1] = d[i + 2] = v;
      }
    }) },
  { id: 'photofilter', menu: 'adjust', name: 'Photo Filter…', params: [{ k: 'color', label: 'Filter colour', type: 'color', v: '#ec8a00' }, R('dens', 'Density', 1, 100, 25), { k: 'keep', label: 'Preserve luminosity', type: 'check', v: true }],
    fn: (s, p) => withPixels(s, (d) => {
      const [fr, fg, fb] = hexToRgb(p.color), t = p.dens / 100;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2], l = luma(r, g, b);
        let nr = lerp(r, (r * fr) / 255, t), ng = lerp(g, (g * fg) / 255, t), nb = lerp(b, (b * fb) / 255, t);
        if (p.keep) { const k = l / (luma(nr, ng, nb) || 1); nr *= k; ng *= k; nb *= k; }
        d[i] = nr; d[i + 1] = ng; d[i + 2] = nb;
      }
    }) },
  { id: 'gradmap', menu: 'adjust', name: 'Gradient Map…', params: [{ k: 'a', label: 'Shadows', type: 'color', v: '@fg' }, { k: 'b', label: 'Highlights', type: 'color', v: '@bg' }, { k: 'rev', label: 'Reverse', type: 'check', v: false }],
    fn: (s, p) => withPixels(s, (d) => {
      let A = hexToRgb(p.a), B = hexToRgb(p.b); if (p.rev) [A, B] = [B, A];
      for (let i = 0; i < d.length; i += 4) { const t = luma(d[i], d[i + 1], d[i + 2]) / 255; d[i] = lerp(A[0], B[0], t); d[i + 1] = lerp(A[1], B[1], t); d[i + 2] = lerp(A[2], B[2], t); }
    }) },
  { id: 'posterize', menu: 'adjust', name: 'Posterize…', params: [R('n', 'Levels', 2, 32, 4)], fn: (s, p) => lutMap(s, makeLut((v) => (Math.round((v / 255) * (p.n - 1)) / (p.n - 1)) * 255)) },
  { id: 'threshold', menu: 'adjust', name: 'Threshold…', params: [{ k: 'hist', type: 'histogram' }, R('t', 'Threshold level', 1, 255, 128)],
    fn: (s, p) => withPixels(s, (d) => { for (let i = 0; i < d.length; i += 4) d[i] = d[i + 1] = d[i + 2] = luma(d[i], d[i + 1], d[i + 2]) >= p.t ? 255 : 0; }) },
  { sep: 'adjust' },
  { id: 'invert', menu: 'adjust', name: 'Invert', key: 'Ctrl+I', fn: (s) => lutMap(s, makeLut((v) => 255 - v)) },
  { id: 'desaturate', menu: 'adjust', name: 'Desaturate', key: 'Shift+Ctrl+U', fn: (s) => withPixels(s, (d) => { for (let i = 0; i < d.length; i += 4) d[i] = d[i + 1] = d[i + 2] = (Math.max(d[i], d[i + 1], d[i + 2]) + Math.min(d[i], d[i + 1], d[i + 2])) / 2; }) },
  { id: 'autotone', menu: 'adjust', name: 'Auto Tone', key: 'Shift+Ctrl+L', fn: (s) => { const H = histogram(s); const L = (h) => { const lo = percentile(h, 0.001), hi = Math.max(lo + 1, percentile(h, 0.999)); return makeLut((v) => ((v - lo) / (hi - lo)) * 255); }; return lutMap(s, L(H.r), L(H.g), L(H.b)); } },
  { id: 'autocontrast', menu: 'adjust', name: 'Auto Contrast', key: 'Alt+Shift+Ctrl+L', fn: (s) => { const H = histogram(s); const lo = percentile(H.l, 0.001), hi = Math.max(lo + 1, percentile(H.l, 0.999)); return lutMap(s, makeLut((v) => ((v - lo) / (hi - lo)) * 255)); } },
  { id: 'sepia', menu: 'adjust', name: 'Sepia', fn: (s) => withPixels(s, (d) => { for (let i = 0; i < d.length; i += 4) { const r = d[i], g = d[i + 1], b = d[i + 2]; d[i] = r * 0.393 + g * 0.769 + b * 0.189; d[i + 1] = r * 0.349 + g * 0.686 + b * 0.168; d[i + 2] = r * 0.272 + g * 0.534 + b * 0.131; } }) },

  /* ---------- Blur ---------- */
  { id: 'gauss', menu: 'Blur', name: 'Gaussian Blur…', params: [R('r', 'Radius', 0.1, 250, 4, { step: 0.1, unit: 'px' })], fn: (s, p) => gaussian(s, p.r) },
  { id: 'boxblur', menu: 'Blur', name: 'Box Blur…', params: [R('r', 'Radius', 1, 200, 6, { unit: 'px' })],
    fn: (s, p) => { const c = copyCanvas(s), g = cxr(c), img = g.getImageData(0, 0, c.width, c.height), { data } = img, w = c.width, hh = c.height, n = w * hh, tmp = new Float32Array(n), ch = new Float32Array(n);
      for (let k = 0; k < 4; k++) { for (let i = 0; i < n; i++) ch[i] = data[i * 4 + k]; boxH(ch, tmp, w, hh, p.r); boxV(tmp, ch, w, hh, p.r); for (let i = 0; i < n; i++) data[i * 4 + k] = ch[i]; }
      g.putImageData(img, 0, 0); return c; } },
  { id: 'motion', menu: 'Blur', name: 'Motion Blur…', params: [R('a', 'Angle', -180, 180, 0, { unit: '°' }), R('dist', 'Distance', 1, 400, 30, { unit: 'px' })],
    fn: (s, p) => {
      const w = s.width, hh = s.height, sd = cxr(s).getImageData(0, 0, w, hh).data, c = mkCanvas(w, hh), g = cxr(c), img = g.createImageData(w, hh), d = img.data;
      const N = Math.min(64, Math.max(2, Math.round(p.dist / 2))), ax = Math.cos((p.a * Math.PI) / 180), ay = -Math.sin((p.a * Math.PI) / 180);
      const acc = new Float32Array(w * hh * 4);
      for (let k = 0; k < N; k++) {
        const t = (k / (N - 1) - 0.5) * p.dist, ox = Math.round(ax * t), oy = Math.round(ay * t);
        for (let y = 0; y < hh; y++) { const sy = clamp(y + oy, 0, hh - 1); for (let x = 0; x < w; x++) { const sx = clamp(x + ox, 0, w - 1), j = (sy * w + sx) * 4, i = (y * w + x) * 4, a = sd[j + 3]; acc[i] += sd[j] * a; acc[i + 1] += sd[j + 1] * a; acc[i + 2] += sd[j + 2] * a; acc[i + 3] += a; } }
      }
      for (let i = 0; i < d.length; i += 4) { const a = acc[i + 3]; d[i + 3] = a / N; if (a) { d[i] = acc[i] / a; d[i + 1] = acc[i + 1] / a; d[i + 2] = acc[i + 2] / a; } }
      g.putImageData(img, 0, 0); return c;
    } },
  { id: 'radial', menu: 'Blur', name: 'Radial Blur (Zoom)…', params: [R('amt', 'Amount', 1, 100, 20)],
    fn: (s, p) => {
      const w = s.width, hh = s.height, sd = cxr(s).getImageData(0, 0, w, hh).data, c = mkCanvas(w, hh), g = cxr(c), img = g.createImageData(w, hh), d = img.data, o = [0, 0, 0, 0];
      const N = 24, cxp = w / 2, cyp = hh / 2, k = p.amt / 400;
      for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
        let r = 0, gg = 0, b = 0, a = 0;
        for (let i = 0; i < N; i++) { const t = 1 - (k * i) / N; sample(sd, w, hh, cxp + (x - cxp) * t, cyp + (y - cyp) * t, o); r += o[0] * o[3]; gg += o[1] * o[3]; b += o[2] * o[3]; a += o[3]; }
        const j = (y * w + x) * 4; d[j + 3] = a / N; if (a) { d[j] = r / a; d[j + 1] = gg / a; d[j + 2] = b / a; }
      }
      g.putImageData(img, 0, 0); return c;
    } },
  /* ---------- Sharpen ---------- */
  { id: 'sharpen', menu: 'Sharpen', name: 'Sharpen', fn: (s) => convolve(s, [0, -0.5, 0, -0.5, 3, -0.5, 0, -0.5, 0]) },
  { id: 'unsharp', menu: 'Sharpen', name: 'Unsharp Mask…', params: [R('amt', 'Amount', 1, 500, 120, { unit: '%' }), R('r', 'Radius', 0.1, 100, 2, { step: 0.1, unit: 'px' }), R('t', 'Threshold', 0, 255, 2, { unit: 'levels' })],
    fn: (s, p) => { const bl = cxr(gaussian(s, p.r)).getImageData(0, 0, s.width, s.height).data; return withPixels(s, (d) => { const k = p.amt / 100; for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) { const diff = d[i + c] - bl[i + c]; if (Math.abs(diff) >= p.t) d[i + c] = d[i + c] + diff * k; } }); } },
  { id: 'highpass', menu: 'Other', name: 'High Pass…', params: [R('r', 'Radius', 0.1, 250, 6, { step: 0.1, unit: 'px' })],
    fn: (s, p) => { const bl = cxr(gaussian(s, p.r)).getImageData(0, 0, s.width, s.height).data; return withPixels(s, (d) => { for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) d[i + c] = 128 + d[i + c] - bl[i + c]; }); } },
  /* ---------- Noise ---------- */
  { id: 'noise', menu: 'Noise', name: 'Add Noise…', params: [R('amt', 'Amount', 0.1, 100, 12, { step: 0.1, unit: '%' }), { k: 'mono', label: 'Monochromatic', type: 'check', v: false }, R('seed', 'Seed', 1, 999, 7)],
    fn: (s, p) => withPixels(s, (d) => { const r = rng(p.seed), k = p.amt * 2.55 * 1.2; const gn = () => (r() + r() + r() - 1.5) * k; for (let i = 0; i < d.length; i += 4) { if (p.mono) { const n = gn(); d[i] += n; d[i + 1] += n; d[i + 2] += n; } else { d[i] += gn(); d[i + 1] += gn(); d[i + 2] += gn(); } } }) },
  { id: 'median', menu: 'Noise', name: 'Median (Despeckle)…', params: [R('r', 'Radius', 1, 12, 2, { unit: 'px' })],
    fn: (s, p) => {
      const w = s.width, hh = s.height, r = p.r, sd = cxr(s).getImageData(0, 0, w, hh).data, c = mkCanvas(w, hh), g = cxr(c), img = g.createImageData(w, hh), d = img.data;
      for (let k = 0; k < 4; k++) {
        for (let y = 0; y < hh; y++) {
          const hist = new Uint32Array(256); let cnt = 0;
          const add = (x, sgn) => { if (x < 0 || x >= w) return; for (let dy = -r; dy <= r; dy++) { const yy = clamp(y + dy, 0, hh - 1); hist[sd[(yy * w + x) * 4 + k]] += sgn; cnt += sgn; } };
          for (let x = -r; x <= r; x++) add(x, 1);
          for (let x = 0; x < w; x++) {
            let acc = 0, m = 0; const target = cnt >> 1;
            for (m = 0; m < 255; m++) { acc += hist[m]; if (acc > target) break; }
            d[(y * w + x) * 4 + k] = m;
            add(x - r, -1); add(x + r + 1, 1);
          }
        }
      }
      g.putImageData(img, 0, 0); return c;
    } },
  /* ---------- Pixelate ---------- */
  { id: 'mosaic', menu: 'Pixelate', name: 'Mosaic…', params: [R('n', 'Cell size', 2, 200, 12, { unit: 'px' })],
    fn: (s, p) => withPixels(s, (d, w, hh) => {
      const n = p.n;
      for (let by = 0; by < hh; by += n) for (let bx = 0; bx < w; bx += n) {
        let r = 0, g = 0, b = 0, a = 0, cnt = 0;
        for (let y = by; y < Math.min(by + n, hh); y++) for (let x = bx; x < Math.min(bx + n, w); x++) { const i = (y * w + x) * 4, al = d[i + 3]; r += d[i] * al; g += d[i + 1] * al; b += d[i + 2] * al; a += al; cnt++; }
        for (let y = by; y < Math.min(by + n, hh); y++) for (let x = bx; x < Math.min(bx + n, w); x++) { const i = (y * w + x) * 4; if (a) { d[i] = r / a; d[i + 1] = g / a; d[i + 2] = b / a; } d[i + 3] = a / cnt; }
      }
    }) },
  { id: 'crystal', menu: 'Pixelate', name: 'Crystallize…', params: [R('n', 'Cell size', 3, 200, 18, { unit: 'px' }), R('seed', 'Seed', 1, 999, 3)],
    fn: (s, p) => {
      const w = s.width, hh = s.height, n = p.n, sd = cxr(s).getImageData(0, 0, w, hh).data, r = rng(p.seed);
      const gw = Math.ceil(w / n) + 1, gh = Math.ceil(hh / n) + 1, px = new Float32Array(gw * gh), py = new Float32Array(gw * gh);
      for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { px[j * gw + i] = (i + r()) * n; py[j * gw + i] = (j + r()) * n; }
      const c = mkCanvas(w, hh), g = cxr(c), img = g.createImageData(w, hh), d = img.data;
      for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
        const ci = Math.floor(x / n), cj = Math.floor(y / n); let best = 1e18, bi = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = ci + di, jj = cj + dj; if (ii < 0 || jj < 0 || ii >= gw || jj >= gh) continue; const k = jj * gw + ii, dd = (px[k] - x) ** 2 + (py[k] - y) ** 2; if (dd < best) { best = dd; bi = k; } }
        const sx = clamp(Math.round(px[bi]), 0, w - 1), sy = clamp(Math.round(py[bi]), 0, hh - 1), si = (sy * w + sx) * 4, o = (y * w + x) * 4;
        d[o] = sd[si]; d[o + 1] = sd[si + 1]; d[o + 2] = sd[si + 2]; d[o + 3] = sd[o + 3];
      }
      g.putImageData(img, 0, 0); return c;
    } },
  { id: 'halftone', menu: 'Pixelate', name: 'Color Halftone…', params: [R('r', 'Max radius', 2, 40, 6, { unit: 'px' })],
    fn: (s, p) => {
      const w = s.width, hh = s.height, sd = cxr(s).getImageData(0, 0, w, hh).data, c = mkCanvas(w, hh), g = cx(c);
      g.fillStyle = '#fff'; g.fillRect(0, 0, w, hh); g.globalCompositeOperation = 'multiply';
      const cell = p.r * 2;
      [[0, '#00ffff', 15], [1, '#ff00ff', 75], [2, '#ffff00', 0]].forEach(([ch, col, ang]) => {
        g.fillStyle = col; const a = (ang * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a), ext = Math.hypot(w, hh);
        for (let v = -ext; v < ext; v += cell) for (let u = -ext; u < ext; u += cell) {
          const x = u * ca - v * sa + w / 2, y = u * sa + v * ca + hh / 2;
          if (x < -cell || y < -cell || x > w + cell || y > hh + cell) continue;
          const sx = clamp(Math.round(x), 0, w - 1), sy = clamp(Math.round(y), 0, hh - 1), ink = 1 - sd[(sy * w + sx) * 4 + ch] / 255;
          if (ink < 0.02) continue;
          g.beginPath(); g.arc(x, y, Math.sqrt(ink) * p.r * 1.25, 0, Math.PI * 2); g.fill();
        }
      });
      g.globalCompositeOperation = 'destination-in'; g.drawImage(s, 0, 0);
      return c;
    } },
  /* ---------- Stylize ---------- */
  { id: 'edges', menu: 'Stylize', name: 'Find Edges', fn: (s) => {
      const w = s.width, hh = s.height, sd = cxr(s).getImageData(0, 0, w, hh).data, c = mkCanvas(w, hh), g = cxr(c), img = g.createImageData(w, hh), d = img.data;
      const at = (x, y, k) => sd[(clamp(y, 0, hh - 1) * w + clamp(x, 0, w - 1)) * 4 + k];
      for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; for (let k = 0; k < 3; k++) { const gx = at(x + 1, y - 1, k) + 2 * at(x + 1, y, k) + at(x + 1, y + 1, k) - at(x - 1, y - 1, k) - 2 * at(x - 1, y, k) - at(x - 1, y + 1, k); const gy = at(x - 1, y + 1, k) + 2 * at(x, y + 1, k) + at(x + 1, y + 1, k) - at(x - 1, y - 1, k) - 2 * at(x, y - 1, k) - at(x + 1, y - 1, k); d[i + k] = 255 - Math.min(255, Math.hypot(gx, gy) * 0.5); } d[i + 3] = sd[i + 3]; }
      g.putImageData(img, 0, 0); return c;
    } },
  { id: 'emboss', menu: 'Stylize', name: 'Emboss…', params: [R('a', 'Angle', -180, 180, 135, { unit: '°' }), R('hgt', 'Height', 1, 10, 3, { unit: 'px' }), R('amt', 'Amount', 1, 500, 100, { unit: '%' })],
    fn: (s, p) => {
      const w = s.width, hh = s.height, sd = cxr(s).getImageData(0, 0, w, hh).data, c = mkCanvas(w, hh), g = cxr(c), img = g.createImageData(w, hh), d = img.data;
      const dx = Math.round(Math.cos((p.a * Math.PI) / 180) * p.hgt), dy = -Math.round(Math.sin((p.a * Math.PI) / 180) * p.hgt), k = p.amt / 100;
      for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4, j = (clamp(y + dy, 0, hh - 1) * w + clamp(x + dx, 0, w - 1)) * 4, m = (clamp(y - dy, 0, hh - 1) * w + clamp(x - dx, 0, w - 1)) * 4;
        const v = 128 + (luma(sd[j], sd[j + 1], sd[j + 2]) - luma(sd[m], sd[m + 1], sd[m + 2])) * k;
        d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = sd[i + 3];
      }
      g.putImageData(img, 0, 0); return c;
    } },
  { id: 'solarize', menu: 'Stylize', name: 'Solarize', fn: (s) => lutMap(s, makeLut((v) => (v > 127 ? 255 - v : v) * 2)) },
  { id: 'oil', menu: 'Stylize', name: 'Oil Paint…', params: [R('r', 'Brush size', 1, 16, 4, { unit: 'px' })],
    fn: (s, p) => {
      // Kuwahara filter on summed-area tables.
      const w = s.width, hh = s.height, r = p.r, sd = cxr(s).getImageData(0, 0, w, hh).data, W1 = w + 1, N = W1 * (hh + 1);
      const SR = new Float64Array(N), SG = new Float64Array(N), SB = new Float64Array(N), SL = new Float64Array(N), SQ = new Float64Array(N);
      for (let y = 0; y < hh; y++) { let ar = 0, ag = 0, ab = 0, al = 0, aq = 0; for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, l = luma(sd[i], sd[i + 1], sd[i + 2]); ar += sd[i]; ag += sd[i + 1]; ab += sd[i + 2]; al += l; aq += l * l; const o = (y + 1) * W1 + x + 1, u = y * W1 + x + 1; SR[o] = SR[u] + ar; SG[o] = SG[u] + ag; SB[o] = SB[u] + ab; SL[o] = SL[u] + al; SQ[o] = SQ[u] + aq; } }
      const box = (S, x0, y0, x1, y1) => S[(y1 + 1) * W1 + x1 + 1] - S[y0 * W1 + x1 + 1] - S[(y1 + 1) * W1 + x0] + S[y0 * W1 + x0];
      const c = mkCanvas(w, hh), g = cxr(c), img = g.createImageData(w, hh), d = img.data;
      for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
        let best = Infinity, br = 0, bg = 0, bb = 0;
        for (const [qx, qy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
          const x0 = clamp(x + qx * r, 0, w - 1), x1 = clamp(x + (qx + 1) * r, 0, w - 1), y0 = clamp(y + qy * r, 0, hh - 1), y1 = clamp(y + (qy + 1) * r, 0, hh - 1);
          const n = (x1 - x0 + 1) * (y1 - y0 + 1), m = box(SL, x0, y0, x1, y1) / n, v = box(SQ, x0, y0, x1, y1) / n - m * m;
          if (v < best) { best = v; br = box(SR, x0, y0, x1, y1) / n; bg = box(SG, x0, y0, x1, y1) / n; bb = box(SB, x0, y0, x1, y1) / n; }
        }
        const i = (y * w + x) * 4; d[i] = br; d[i + 1] = bg; d[i + 2] = bb; d[i + 3] = sd[i + 3];
      }
      g.putImageData(img, 0, 0); return c;
    } },
  /* ---------- Distort ---------- */
  { id: 'twirl', menu: 'Distort', name: 'Twirl…', params: [R('a', 'Angle', -999, 999, 120, { unit: '°' })],
    fn: (s, p) => { const w = s.width, hh = s.height, cx0 = w / 2, cy0 = hh / 2, R0 = Math.min(w, hh) / 2, A = (p.a * Math.PI) / 180;
      return displace(s, (x, y, o) => { const dx = x - cx0, dy = y - cy0, r = Math.hypot(dx, dy); if (r >= R0) return false; const t = 1 - r / R0, a = Math.atan2(dy, dx) + A * t * t; o[0] = cx0 + r * Math.cos(a); o[1] = cy0 + r * Math.sin(a); }); } },
  { id: 'pinch', menu: 'Distort', name: 'Pinch / Bulge…', params: [R('amt', 'Amount (− bulge, + pinch)', -100, 100, -50, { unit: '%' })],
    fn: (s, p) => { const w = s.width, hh = s.height, cx0 = w / 2, cy0 = hh / 2, R0 = Math.min(w, hh) / 2, k = p.amt / 100;
      return displace(s, (x, y, o) => { const dx = x - cx0, dy = y - cy0, r = Math.hypot(dx, dy); if (r >= R0 || !r) return false; const rn = r / R0, f = Math.pow(rn, k > 0 ? 1 - k * 0.7 : 1 - k * 1.2) / rn; o[0] = cx0 + dx * f; o[1] = cy0 + dy * f; }); } },
  { id: 'wave', menu: 'Distort', name: 'Wave…', params: [R('amp', 'Amplitude', 1, 200, 12, { unit: 'px' }), R('len', 'Wavelength', 4, 800, 80, { unit: 'px' })],
    fn: (s, p) => displace(s, (x, y, o) => { o[0] = x + p.amp * Math.sin((2 * Math.PI * y) / p.len); o[1] = y + p.amp * Math.sin((2 * Math.PI * x) / p.len); }) },
  { id: 'ripple', menu: 'Distort', name: 'Ripple…', params: [R('amp', 'Amount', 1, 60, 6, { unit: 'px' }), R('len', 'Ring size', 4, 200, 24, { unit: 'px' })],
    fn: (s, p) => { const cx0 = s.width / 2, cy0 = s.height / 2; return displace(s, (x, y, o) => { const dx = x - cx0, dy = y - cy0, r = Math.hypot(dx, dy) || 1, k = (p.amp * Math.sin((2 * Math.PI * r) / p.len)) / r; o[0] = x + dx * k; o[1] = y + dy * k; }); } },
  { id: 'polar', menu: 'Distort', name: 'Polar Coordinates (Tiny Planet)', fn: (s) => { const w = s.width, hh = s.height, cx0 = w / 2, cy0 = hh / 2, R0 = Math.min(w, hh) / 2;
      return displace(s, (x, y, o) => { const dx = x - cx0, dy = y - cy0, r = Math.hypot(dx, dy); let a = Math.atan2(dx, -dy); if (a < 0) a += 2 * Math.PI; o[0] = (a / (2 * Math.PI)) * w; o[1] = (1 - Math.min(1, r / R0)) * (hh - 1); }); } },
  { id: 'offset', menu: 'Other', name: 'Offset…', params: [R('x', 'Horizontal', -2000, 2000, 100, { unit: 'px' }), R('y', 'Vertical', -2000, 2000, 0, { unit: 'px' }), { k: 'wrap', label: 'Wrap around', type: 'check', v: true }],
    fn: (s, p) => { const c = mkCanvas(s.width, s.height), g = cx(c), w = s.width, hh = s.height;
      if (p.wrap) { const ox = ((p.x % w) + w) % w, oy = ((p.y % hh) + hh) % hh; for (const dx of [ox - w, ox]) for (const dy of [oy - hh, oy]) g.drawImage(s, dx, dy); } else g.drawImage(s, p.x, p.y);
      return c; } },
  { id: 'maximum', menu: 'Other', name: 'Maximum (Dilate)…', params: [R('r', 'Radius', 1, 30, 2, { unit: 'px' })], fn: (s, p) => rankFilter(s, p.r, true) },
  { id: 'minimum', menu: 'Other', name: 'Minimum (Erode)…', params: [R('r', 'Radius', 1, 30, 2, { unit: 'px' })], fn: (s, p) => rankFilter(s, p.r, false) },
  /* ---------- Render ---------- */
  { id: 'clouds', menu: 'Render', name: 'Clouds', params: [R('scale', 'Scale', 10, 800, 160, { unit: 'px' }), R('seed', 'Seed', 1, 999, 11)],
    fn: (s, p, env) => { const w = s.width, hh = s.height, A = hexToRgb(env.fg), B = hexToRgb(env.bg), n = valueNoise2D(p.seed);
      const c = mkCanvas(w, hh), g = cxr(c), img = g.createImageData(w, hh), d = img.data;
      for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) { let v = 0, amp = 0.5, f = 1 / p.scale; for (let o = 0; o < 6; o++) { v += n(x * f, y * f) * amp; amp *= 0.5; f *= 2; } const i = (y * w + x) * 4; d[i] = lerp(A[0], B[0], v); d[i + 1] = lerp(A[1], B[1], v); d[i + 2] = lerp(A[2], B[2], v); d[i + 3] = 255; }
      g.putImageData(img, 0, 0); return c; }, cover: true },
  { id: 'vignette', menu: 'Render', name: 'Vignette…', params: [R('amt', 'Amount', 0, 100, 55, { unit: '%' }), R('size', 'Size', 10, 150, 75, { unit: '%' }), { k: 'color', label: 'Colour', type: 'color', v: '#000000' }],
    fn: (s, p) => { const c = copyCanvas(s), g = cx(c), w = c.width, hh = c.height, r = Math.hypot(w, hh) / 2;
      const gr = g.createRadialGradient(w / 2, hh / 2, r * (p.size / 100) * 0.45, w / 2, hh / 2, r * Math.max(0.2, p.size / 100) * 1.05);
      const [cr, cg, cb] = hexToRgb(p.color); gr.addColorStop(0, `rgba(${cr},${cg},${cb},0)`); gr.addColorStop(1, `rgba(${cr},${cg},${cb},${p.amt / 100})`);
      g.globalCompositeOperation = 'source-atop'; g.fillStyle = gr; g.fillRect(0, 0, w, hh); return c; } },
  /* ---------- Slop ---------- */
  { id: 'deepfry', menu: 'Slop', name: 'Deep Fry…', params: [R('amt', 'Crispiness', 1, 100, 70, { unit: '%' }), R('seed', 'Seed', 1, 999, 5)],
    fn: async (s, p) => { const k = p.amt / 100;
      let c = withPixels(s, (d) => { const r = rng(p.seed); for (let i = 0; i < d.length; i += 4) { let R0 = d[i], G0 = d[i + 1], B0 = d[i + 2]; const l = luma(R0, G0, B0); R0 = l + (R0 - l) * (1 + 2.6 * k); G0 = l + (G0 - l) * (1 + 2.6 * k); B0 = l + (B0 - l) * (1 + 2.6 * k); R0 = (R0 - 128) * (1 + 0.9 * k) + 128 + 30 * k; G0 = (G0 - 128) * (1 + 0.9 * k) + 128 + 8 * k; B0 = (B0 - 128) * (1 + 0.9 * k) + 128 - 25 * k; const n = (r() - 0.5) * 50 * k; d[i] = R0 + n; d[i + 1] = G0 + n; d[i + 2] = B0 + n; } });
      c = convolve(c, [0, -1 * k, 0, -1 * k, 1 + 4 * k, -1 * k, 0, -1 * k, 0]);
      return jpegCrunch(c, Math.max(0.02, 0.35 - 0.33 * k), 1 + Math.round(k * 3)); } },
  { id: 'jpeg', menu: 'Slop', name: 'JPEG Crunch…', params: [R('q', 'Quality', 1, 60, 8), R('n', 'Generations', 1, 20, 4)], fn: (s, p) => jpegCrunch(s, p.q / 100, p.n) },
  { id: 'glitch', menu: 'Slop', name: 'Glitch…', params: [R('amt', 'Amount', 1, 100, 45, { unit: '%' }), R('shift', 'RGB split', 0, 60, 8, { unit: 'px' }), R('seed', 'Seed', 1, 999, 42)],
    fn: (s, p) => { const w = s.width, hh = s.height, r = rng(p.seed), sd = cxr(s).getImageData(0, 0, w, hh).data, c = mkCanvas(w, hh), g = cxr(c), img = g.createImageData(w, hh), d = img.data;
      const rows = new Int32Array(hh); let y = 0;
      while (y < hh) { const bh = 2 + Math.floor(r() * hh * 0.06), off = r() < p.amt / 100 ? Math.round((r() - 0.5) * w * 0.25 * (p.amt / 100)) : 0; for (let k = 0; k < bh && y < hh; k++, y++) rows[y] = off; }
      for (let yy = 0; yy < hh; yy++) for (let x = 0; x < w; x++) { const i = (yy * w + x) * 4, sx = clamp(x - rows[yy], 0, w - 1);
        const ir = (yy * w + clamp(sx + p.shift, 0, w - 1)) * 4, ig = (yy * w + sx) * 4, ib = (yy * w + clamp(sx - p.shift, 0, w - 1)) * 4;
        d[i] = sd[ir]; d[i + 1] = sd[ig + 1]; d[i + 2] = sd[ib + 2]; d[i + 3] = Math.max(sd[ir + 3], sd[ig + 3], sd[ib + 3]); }
      g.putImageData(img, 0, 0); return c; } },
  { id: 'chroma', menu: 'Slop', name: 'Chromatic Aberration…', params: [R('amt', 'Amount', 1, 40, 6, { unit: 'px' })],
    fn: (s, p) => { const w = s.width, hh = s.height, sd = cxr(s).getImageData(0, 0, w, hh).data, c = mkCanvas(w, hh), g = cxr(c), img = g.createImageData(w, hh), d = img.data, o = [0, 0, 0, 0], cx0 = w / 2, cy0 = hh / 2, R0 = Math.hypot(cx0, cy0);
      for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) { const dx = (x - cx0) / R0, dy = (y - cy0) / R0, i = (y * w + x) * 4;
        sample(sd, w, hh, x + dx * p.amt, y + dy * p.amt, o); d[i] = o[0]; const a1 = o[3];
        sample(sd, w, hh, x - dx * p.amt, y - dy * p.amt, o); d[i + 2] = o[2]; const a2 = o[3];
        d[i + 1] = sd[i + 1]; d[i + 3] = Math.max(sd[i + 3], a1, a2); }
      g.putImageData(img, 0, 0); return c; } },
  { id: 'vhs', menu: 'Slop', name: 'VHS Tape…', params: [R('amt', 'Wear', 1, 100, 50, { unit: '%' }), R('seed', 'Seed', 1, 999, 9)],
    fn: (s, p) => { const k = p.amt / 100, r = rng(p.seed), w = s.width, hh = s.height, sd = cxr(gaussian(s, 0.8 + k)).getImageData(0, 0, w, hh).data, c = mkCanvas(w, hh), g = cxr(c), img = g.createImageData(w, hh), d = img.data, sh = Math.round(2 + 6 * k);
      let jitter = 0;
      for (let y = 0; y < hh; y++) { if (r() < 0.02 * k) jitter = (r() - 0.5) * 20 * k; else jitter *= 0.9; const line = y % 3 === 0 ? 1 - 0.18 * k : 1;
        for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, sx = clamp(Math.round(x + jitter), 0, w - 1), j = (y * w + sx) * 4, jr = (y * w + clamp(sx + sh, 0, w - 1)) * 4, n = (r() - 0.5) * 40 * k;
          d[i] = (sd[jr] * 0.9 + 20) * line + n; d[i + 1] = (sd[j + 1] * 0.92 + 8) * line + n; d[i + 2] = (sd[j + 2] * 0.85 + 30) * line + n; d[i + 3] = sd[i + 3]; } }
      g.putImageData(img, 0, 0); return c; } },
  { id: 'slopify', menu: 'Slop', name: 'Slopify (Melt)…', params: [R('melt', 'Melt', 0, 100, 55, { unit: '%' }), R('tint', 'Slime tint', 0, 100, 45, { unit: '%' }), R('seed', 'Seed', 1, 999, 23)],
    fn: (s, p) => { const w = s.width, hh = s.height, n = valueNoise2D(p.seed), k = p.melt / 100;
      const drip = new Float32Array(w); for (let x = 0; x < w; x++) drip[x] = Math.pow(n(x / 38, 0.5) * 0.7 + n(x / 9, 3.1) * 0.3, 3) * hh * 0.9 * k;
      let c = displace(s, (x, y, o) => { const t = y / hh; o[0] = x + Math.sin(y / 23 + x / 41) * 4 * k; o[1] = y - drip[x] * t * t; });
      if (p.tint > 0) { const g = cx(c); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = p.tint / 100; const gr = g.createLinearGradient(0, 0, 0, hh); gr.addColorStop(0, '#e6ff8c'); gr.addColorStop(0.55, '#9fcc00'); gr.addColorStop(1, '#3d5200'); g.fillStyle = gr; g.globalCompositeOperation = 'source-atop'; g.fillRect(0, 0, w, hh); g.globalAlpha = 1; }
      return c; } },
  /* ---------- Layer styles (baked) ---------- */
  { id: 'shadow', menu: 'style', name: 'Drop Shadow…', cover: true, params: [{ k: 'color', label: 'Colour', type: 'color', v: '#000000' }, R('op', 'Opacity', 0, 100, 60, { unit: '%' }), R('a', 'Angle', -180, 180, 120, { unit: '°' }), R('dist', 'Distance', 0, 300, 12, { unit: 'px' }), R('size', 'Size', 0, 250, 14, { unit: 'px' })],
    fn: (s, p) => { const sh = silhouette(s, p.color, p.op / 100), c = mkCanvas(s.width, s.height), g = cx(c); const a = (p.a * Math.PI) / 180; g.drawImage(p.size ? gaussian(sh, p.size) : sh, -Math.cos(a) * p.dist, Math.sin(a) * p.dist); g.drawImage(s, 0, 0); return c; } },
  { id: 'glow', menu: 'style', name: 'Outer Glow…', cover: true, params: [{ k: 'color', label: 'Colour', type: 'color', v: '#d4ff3a' }, R('op', 'Opacity', 0, 100, 85, { unit: '%' }), R('spread', 'Spread', 0, 40, 4, { unit: 'px' }), R('size', 'Size', 1, 250, 24, { unit: 'px' })],
    fn: (s, p) => { let sh = silhouette(s, p.color, 1); if (p.spread) sh = rankFilter(sh, p.spread, true, true); sh = gaussian(sh, p.size); const c = mkCanvas(s.width, s.height), g = cx(c); g.globalAlpha = p.op / 100; g.drawImage(sh, 0, 0); g.drawImage(sh, 0, 0); g.globalAlpha = 1; g.drawImage(s, 0, 0); return c; } },
  { id: 'stroke', menu: 'style', name: 'Stroke…', cover: true, params: [R('size', 'Size', 1, 60, 4, { unit: 'px' }), { k: 'color', label: 'Colour', type: 'color', v: '@fg' }, { k: 'pos', label: 'Position', type: 'select', options: [['outside', 'Outside'], ['inside', 'Inside']], v: 'outside' }],
    fn: (s, p) => { if (p.pos === 'outside') return under(s, silhouette(rankFilter(s, p.size, true, true), p.color)); const inner = rankFilter(s, p.size, false, true), ring = silhouette(s, p.color), g = cx(ring); g.globalCompositeOperation = 'destination-out'; g.drawImage(inner, 0, 0); const c = copyCanvas(s); cx(c).drawImage(ring, 0, 0); return c; } },
  { id: 'overlay', menu: 'style', name: 'Color Overlay…', params: [{ k: 'color', label: 'Colour', type: 'color', v: '@fg' }, R('op', 'Opacity', 0, 100, 100, { unit: '%' }), { k: 'blend', label: 'Blend mode', type: 'select', options: BLENDS.map((b) => [b[0], b[1]]), v: 'normal' }],
    fn: (s, p) => { const c = copyCanvas(s), g = cx(c), f = silhouette(s, p.color, p.op / 100); g.globalCompositeOperation = BLEND_OP[p.blend]; g.drawImage(f, 0, 0); g.globalCompositeOperation = 'destination-in'; g.drawImage(s, 0, 0); return c; } },
  { id: 'bevel', menu: 'style', name: 'Bevel & Emboss…', params: [R('size', 'Size', 1, 60, 8, { unit: 'px' }), R('depth', 'Depth', 10, 500, 120, { unit: '%' }), R('a', 'Light angle', -180, 180, 120, { unit: '°' })],
    fn: (s, p) => { const w = s.width, hh = s.height, a = cxr(gaussian(silhouette(s, '#fff'), p.size)).getImageData(0, 0, w, hh).data;
      const lx = Math.cos((p.a * Math.PI) / 180), ly = -Math.sin((p.a * Math.PI) / 180), k = (p.depth / 100) * 3;
      return withPixels(s, (d) => { for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; if (!d[i + 3]) continue;
        const ax = (a[(y * w + Math.min(w - 1, x + 1)) * 4 + 3] - a[(y * w + Math.max(0, x - 1)) * 4 + 3]) / 2, ay = (a[(Math.min(hh - 1, y + 1) * w + x) * 4 + 3] - a[(Math.max(0, y - 1) * w + x) * 4 + 3]) / 2;
        const sh = clamp(-(ax * lx + ay * ly) * k, -160, 160); for (let c = 0; c < 3; c++) d[i + c] = sh > 0 ? d[i + c] + (255 - d[i + c]) * (sh / 160) : d[i + c] * (1 + sh / 160); } }); } },
];
const FILTER_BY_ID = Object.fromEntries(FILTERS.filter((f) => f.id).map((f) => [f.id, f]));
