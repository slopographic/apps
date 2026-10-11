/* PhotoSlop filters: Auto Enhance (Filter ▸ Auto Enhance). One click, in this order:
 *   1. levels from the 0.5 and 99.5 percentiles of luma (gentle clip; at least 16 levels wide)
 *   2. grey-world white balance, each of red and blue limited to ±8 % (green is the reference)
 *   3. exposure nudge: half the log2 distance of the median (after 1 and 2) to mid-grey, at most ±0.4 EV
 *   4. mild saturation lift, weaker where the hue and saturation fall in the skin range (no face model)
 * autoEnhanceValues analyses a small copy of the layer. Its values are the dialog's sliders, so the
 * person can change any of them; "Reset to auto" returns to these. */
'use strict';

const AE_SKIN = { h0: 12, h1: 52, s0: 0.12, s1: 0.75 }; // orange-skin hue (degrees) and saturation range

/** Hue in degrees (0..360) of an RGB triple. */
function hueDeg(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = mx - mn;
  if (!c) return 0;
  let hh = mx === r ? ((g - b) / c) % 6 : mx === g ? (b - r) / c + 2 : (r - g) / c + 4;
  hh *= 60;
  return hh < 0 ? hh + 360 : hh;
}
/** Skin weight 0..1 from the hue and saturation range, with soft edges. */
function skinWeight(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), s = mx ? (mx - mn) / mx : 0, hh = hueDeg(r, g, b);
  const hw = clamp(Math.min(hh - (AE_SKIN.h0 - 8), AE_SKIN.h1 + 8 - hh) / 8, 0, 1);
  const sw = clamp(Math.min(s - (AE_SKIN.s0 - 0.05), AE_SKIN.s1 + 0.1 - s) / 0.05, 0, 1);
  return hw * sw;
}
/** Pixels of a small copy of src (at most 256 px on its long side). */
function aeSample(src) {
  const k = Math.min(1, 256 / Math.max(src.width, src.height)), w = Math.max(1, Math.round(src.width * k)), hh = Math.max(1, Math.round(src.height * k));
  const c = mkCanvas(w, hh);
  cx(c).drawImage(src, 0, 0, w, hh);
  return cxr(c).getImageData(0, 0, w, hh).data;
}
const aeRound = (v, dp) => Math.round(v * 10 ** dp) / 10 ** dp;

/** The values Auto Enhance chooses for a layer canvas. */
function autoEnhanceValues(src) {
  const d = aeSample(src), neutral = { inB: 0, inW: 255, wr: 1, wb: 1, ev: 0, sat: 0 };
  const hl = new Uint32Array(256);
  let cnt = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 8) { hl[Math.round(luma(d[i], d[i + 1], d[i + 2]))]++; cnt++; }
  if (!cnt) return neutral;
  let lo = percentile(hl, 0.005), hi = percentile(hl, 0.995);
  if (hi - lo < 16) { lo = clamp(Math.round((lo + hi) / 2 - 8), 0, 239); hi = lo + 16; }
  const lv = makeLut((v) => clamp((v - lo) / (hi - lo), 0, 1) * 255);
  let sr = 0, sg = 0, sb = 0, sat = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] <= 8) continue;
    const r = lv[d[i]], g = lv[d[i + 1]], b = lv[d[i + 2]], mx = Math.max(r, g, b);
    sr += r; sg += g; sb += b; sat += mx ? (mx - Math.min(r, g, b)) / mx : 0;
  }
  const wr = clamp(sg / Math.max(sr, 1), 0.92, 1.08), wb = clamp(sg / Math.max(sb, 1), 0.92, 1.08);
  const hm = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 8) hm[Math.round(luma(lv[d[i]] * wr, lv[d[i + 1]], lv[d[i + 2]] * wb))]++;
  const med = percentile(hm, 0.5);
  const ev = clamp(Math.log2(128 / Math.max(med, 8)) * 0.5, -0.4, 0.4);
  const sLift = Math.round(clamp((0.22 - sat / cnt) * 100, 0, 12));
  return { inB: lo, inW: hi, wr: aeRound(wr, 3), wb: aeRound(wb, 3), ev: aeRound(ev, 2), sat: sLift };
}

/** Applies the parameters (levels, white balance, exposure, saturation) to a layer canvas. */
function autoEnhanceApply(src, p) {
  const span = Math.max(1, p.inW - p.inB), lv = makeLut((v) => clamp((v - p.inB) / span, 0, 1) * 255);
  const k = p.sat / 100, ev = Math.pow(2, p.ev);
  return withPixels(src, (d) => {
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      let r = clamp(lv[d[i]] * p.wr * ev, 0, 255), g = clamp(lv[d[i + 1]] * ev, 0, 255), b = clamp(lv[d[i + 2]] * p.wb * ev, 0, 255);
      if (k) {
        const l = luma(r, g, b), f = 1 + k * (p.skin ? 1 - 0.75 * skinWeight(r, g, b) : 1);
        r = clamp(l + (r - l) * f, 0, 255); g = clamp(l + (g - l) * f, 0, 255); b = clamp(l + (b - l) * f, 0, 255);
      }
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
    }
  });
}

/** The dialog's parameters for given analysed values (a and the neutral defaults use the same list). */
const AE_PARAMS = (a) => [
  R('inB', 'Black point', 0, 250, a.inB),
  R('inW', 'White point', 5, 255, a.inW),
  R('wr', 'White balance: red', 0.92, 1.08, a.wr, { step: 0.001 }),
  R('wb', 'White balance: blue', 0.92, 1.08, a.wb, { step: 0.001 }),
  R('ev', 'Exposure', -1, 1, a.ev, { step: 0.01, unit: 'EV' }),
  R('sat', 'Saturation lift', 0, 30, a.sat, { unit: '%' }),
  { k: 'skin', label: 'Protect skin tones', type: 'check', v: true },
];
FILTERS.push(
  // params: neutral defaults (used by code that calls fn directly); plist: the analysed values for the dialog.
  { id: 'autoenhance', menu: 'Auto', name: 'Auto Enhance…', auto: true,
    params: AE_PARAMS({ inB: 0, inW: 255, wr: 1, wb: 1, ev: 0, sat: 0 }),
    plist: (base) => AE_PARAMS(autoEnhanceValues(base)),
    fn: (s, p) => autoEnhanceApply(s, p) },
);
