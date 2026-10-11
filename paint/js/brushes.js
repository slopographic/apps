/* PhotoSLOP: brush engine v2 and brush packs.
 * Presets carry a tip (procedural shape or an imported image) plus dynamics: angle,
 * roundness, size/angle/opacity/hue jitter, scatter, count, follow-stroke and pressure.
 * Packs: built-ins, plus imports from Photoshop .abr, PNG tips and .slopbrush/JSON packs. */
'use strict';

const DYN = { angle: 0, roundness: 1, sizeJitter: 0, angleJitter: 0, follow: false, scatter: 0, count: 1, opacityJitter: 0, hueJitter: 0, pressureOpacity: false, tipImage: null };
const TIP_IMAGES = new Map(); // id → alpha-mask canvas (black where it paints)
const ALL_TIPS = [['round', 'Round'], ['square', 'Square'], ['flat', 'Flat'], ['spray', 'Spray'], ['chalk', 'Chalk'], ['charcoal', 'Charcoal'], ['bristle', 'Bristle'], ['sponge', 'Sponge'], ['grass', 'Grass'], ['leaf', 'Leaf'], ['star', 'Star'], ['heart', 'Heart'], ['ring', 'Bubble'], ['splat', 'Splat'], ['slime', 'Slime drip'], ['sloppo', 'Sloppo']];
const tipOptions = (o) => ALL_TIPS.concat(o.tip === 'image' ? [['image', 'Image tip']] : []);
const MULTI = { spray: 6, chalk: 4, bristle: 4, charcoal: 4, sponge: 4, splat: 4 };

/* ---------- procedural tips ---------- */
function procTip(tip, d, variant) {
  const c = mkCanvas(d, d), g = cx(c), m = d / 2, r = d / 2 - 1, rnd = rng(variant * 7919 + tip.length * 131 + 3);
  g.fillStyle = '#000'; g.strokeStyle = '#000';
  const path = (fn) => { g.beginPath(); fn(); g.fill(); };
  switch (tip) {
    case 'bristle':
      for (let i = 0; i < 26; i++) { const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * r * 0.9; g.globalAlpha = 0.35 + rnd() * 0.65; g.beginPath(); g.ellipse(m + Math.cos(a) * rr, m + Math.sin(a) * rr * 0.45, r * (0.04 + rnd() * 0.06), r * (0.04 + rnd() * 0.05), 0, 0, Math.PI * 2); g.fill(); }
      break;
    case 'charcoal': {
      path(() => g.ellipse(m, m, r, r * 0.8, 0.4, 0, Math.PI * 2));
      const img = g.getImageData(0, 0, d, d), px = img.data;
      for (let i = 3; i < px.length; i += 4) if (px[i]) px[i] *= rnd() < 0.55 ? rnd() * 0.25 : 0.55 + rnd() * 0.45;
      g.putImageData(img, 0, 0);
      break;
    }
    case 'sponge':
      path(() => g.arc(m, m, r, 0, Math.PI * 2));
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 22; i++) { g.beginPath(); g.arc(m + (rnd() - 0.5) * d * 0.9, m + (rnd() - 0.5) * d * 0.9, r * (0.06 + rnd() * 0.16), 0, Math.PI * 2); g.fill(); }
      break;
    case 'grass':
      path(() => { g.moveTo(m - r * 0.12, m + r); g.quadraticCurveTo(m - r * 0.1, m, m + r * 0.15, m - r); g.quadraticCurveTo(m + r * 0.05, m, m + r * 0.12, m + r); });
      break;
    case 'leaf':
      path(() => { g.moveTo(m, m - r); g.quadraticCurveTo(m + r * 0.75, m, m, m + r); g.quadraticCurveTo(m - r * 0.75, m, m, m - r); });
      g.globalCompositeOperation = 'destination-out'; g.lineWidth = Math.max(1, d * 0.03); g.beginPath(); g.moveTo(m, m - r * 0.8); g.lineTo(m, m + r * 0.9); g.stroke();
      break;
    case 'star':
      path(() => { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.42 : r; g.lineTo(m + Math.cos(a) * rr, m + Math.sin(a) * rr); } g.closePath(); });
      break;
    case 'heart':
      path(() => { const k = r * 0.95; g.moveTo(m, m + k * 0.85); g.bezierCurveTo(m - k * 1.5, m - k * 0.1, m - k * 0.6, m - k * 1.1, m, m - k * 0.35); g.bezierCurveTo(m + k * 0.6, m - k * 1.1, m + k * 1.5, m - k * 0.1, m, m + k * 0.85); });
      break;
    case 'ring':
      g.lineWidth = Math.max(1, d * 0.07); g.beginPath(); g.arc(m, m, r * 0.88, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = 0.25; path(() => g.arc(m, m, r * 0.82, 0, Math.PI * 2));
      g.globalAlpha = 1; path(() => g.ellipse(m - r * 0.35, m - r * 0.38, r * 0.2, r * 0.11, -0.6, 0, Math.PI * 2));
      break;
    case 'splat':
      path(() => g.arc(m, m, r * 0.42, 0, Math.PI * 2));
      for (let i = 0; i < 14; i++) { const a = rnd() * Math.PI * 2, rr = r * (0.45 + rnd() * 0.5), s = r * (0.04 + rnd() * 0.12); path(() => g.arc(m + Math.cos(a) * rr, m + Math.sin(a) * rr, s, 0, Math.PI * 2)); }
      break;
    case 'sloppo': {
      path(() => { g.moveTo(m - r * 0.78, m + r * 0.8); g.bezierCurveTo(m - r * 0.95, m - r * 0.2, m - r * 0.4, m - r * 0.62, m, m - r * 0.62); g.bezierCurveTo(m + r * 0.4, m - r * 0.62, m + r * 0.95, m - r * 0.2, m + r * 0.78, m + r * 0.8); g.closePath(); });
      path(() => g.ellipse(m - r * 0.02, m - r * 0.72, r * 0.18, r * 0.2, 0, 0, Math.PI * 2));
      g.globalCompositeOperation = 'destination-out';
      for (const sx of [-1, 1]) path(() => g.ellipse(m + sx * r * 0.27, m + r * 0.08, r * 0.12, r * 0.16, 0, 0, Math.PI * 2));
      g.lineWidth = Math.max(1, r * 0.07); g.lineCap = 'round'; g.beginPath(); g.arc(m, m + r * 0.28, r * 0.14, 0.3, Math.PI - 0.3); g.stroke();
      break;
    }
    default: return null;
  }
  return c;
}
/** Black alpha mask for any tip at the given size. */
function tipMask(o, size, variant) {
  const tip = o.tip || 'round';
  if (tip === 'image') {
    const src = TIP_IMAGES.get(o.tipImage);
    if (!src) return dabCanvas(size, o.hardness, '#000000', 'round', 0);
    const key = `img|${o.tipImage}|${Math.ceil(size)}`;
    if (dabCache.has(key)) return dabCache.get(key);
    const k = size / Math.max(src.width, src.height), w = Math.max(1, Math.round(src.width * k)), hh = Math.max(1, Math.round(src.height * k));
    const c = mkCanvas(w, hh), g = cx(c); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, w, hh);
    dabCache.set(key, c); return c;
  }
  if (['round', 'square', 'flat', 'spray', 'chalk', 'slime'].includes(tip)) return dabCanvas(size, o.hardness, '#000000', tip, variant);
  const d = Math.max(4, Math.ceil(size) + 2), key = `proc|${tip}|${d}|${variant}`;
  if (dabCache.has(key)) return dabCache.get(key);
  const c = procTip(tip, d, variant) || dabCanvas(size, o.hardness, '#000000', 'round', 0);
  dabCache.set(key, c);
  return c;
}
function tint(mask, color) {
  const c = mkCanvas(mask.width, mask.height), g = cx(c);
  g.drawImage(mask, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  return c;
}
function hueShift(hex, deg) { const [hh, s, l] = rgbToHsl(...hexToRgb(hex)); return rgbToHex(...hslToRgb((hh + deg + 360) % 360, s, l)); }

/** Build the per-stroke dab painter for a brush preset. Returns { spacing(pressure), dab(g, x, y, pressure) }. */
function makeDabber(o, color, usePressure) {
  o = Object.assign({}, DYN, o);
  const nv = MULTI[o.tip] || 1, master = Math.max(4, Math.min(o.size, 1200));
  const masks = Array.from({ length: nv }, (_, v) => tipMask(o, master, v));
  const colors = o.hueJitter > 0 ? Array.from({ length: 6 }, () => hueShift(color, (Math.random() - 0.5) * 360 * o.hueJitter)) : [color];
  const tips = colors.map((c) => masks.map((m) => tint(m, c)));
  const spacingK = o.tip === 'spray' ? Math.max(o.spacing, 0.3) : o.tip === 'slime' ? Math.max(o.spacing, 0.18) : o.spacing;
  let last = null, dir = 0;
  return {
    spacing: (pr) => Math.max(0.5, o.size * (usePressure ? clamp(pr, 0.05, 1) : 1) * spacingK),
    dab(g, x, y, pr) {
      if (last) { const dx = x - last.x, dy = y - last.y; if (dx * dx + dy * dy > 0.25) dir = Math.atan2(dy, dx); }
      last = { x, y };
      const p = usePressure ? clamp(pr, 0.05, 1) : 1;
      for (let k = 0; k < Math.max(1, o.count | 0); k++) {
        const set = tips[(Math.random() * tips.length) | 0], tip = set[(Math.random() * set.length) | 0];
        const s = o.size * p * (1 - o.sizeJitter * Math.random());
        if (s < 0.3) continue;
        const sc = o.scatter * o.size * (Math.random() - 0.5) * 2, sc2 = o.scatter * o.size * (Math.random() - 0.5) * 2;
        const px = x + (o.follow ? -Math.sin(dir) * sc : sc), py = y + (o.follow ? Math.cos(dir) * sc : sc2);
        const ang = (o.angle * Math.PI) / 180 + (o.follow ? dir : 0) + (Math.random() - 0.5) * 2 * Math.PI * o.angleJitter;
        const alpha = o.flow * (1 - o.opacityJitter * Math.random()) * (usePressure && o.pressureOpacity ? p : 1);
        const k2 = s / master, w = tip.width * k2, hh = tip.height * k2;
        g.save(); g.globalAlpha = alpha; g.translate(px, py);
        if (ang) g.rotate(ang);
        if (o.roundness < 1) g.scale(1, Math.max(0.05, o.roundness));
        g.drawImage(tip, -w / 2, -hh / 2, w, hh);
        g.restore();
      }
    },
  };
}
/** A sample S-stroke for previews. */
function presetPreview(p, w = 64, hh = 40, color) {
  const c = mkCanvas(w, hh), g = cx(c), col = color || (theme() === 'pro' ? '#e8e8e8' : '#111111');
  const o = Object.assign({}, DYN, p);
  const s = clamp(o.size, 3, hh * 0.55) * (o.tip === 'spray' ? 1.3 : 1);
  const big = p.size > 140 || p.size < 6 || ['sloppo', 'star', 'heart', 'leaf', 'splat', 'image'].includes(o.tip) && !o.scatter && o.spacing > 0.6;
  const d = makeDabber(Object.assign({}, o, { size: s, flow: Math.min(1, o.flow * 1.4) }), col, false);
  if (big) { d.dab(g, w / 2, hh / 2, 1); return c; }
  const st = new Stroker(() => d.spacing(1), (x, y, pr) => d.dab(g, x, y, pr));
  const pt = (t) => ({ x: 8 + t * (w - 16), y: hh / 2 + Math.sin(t * Math.PI * 2) * hh * 0.22, pressure: 1 });
  st.begin(pt(0)); for (let i = 1; i <= 24; i++) st.to(pt(i / 24));
  return c;
}

/* ---------- packs ---------- */
const B = (name, tip, size, hardness, extra = {}) => Object.assign({ name, tip, size, hardness, spacing: 0.12, flow: 1, opacity: 1 }, extra);
const BUILTIN_PACKS = [
  { name: 'Basics', builtin: true, brushes: [
    B('Soft Round', 'round', 45, 0), B('Hard Round', 'round', 20, 1), B('Soft Round Big', 'round', 220, 0),
    B('Hard Round Fine', 'round', 4, 1), B('Airbrush', 'round', 90, 0, { flow: 0.12, spacing: 0.06 }), B('Square', 'square', 30, 1),
  ] },
  { name: 'Ink & Paint', builtin: true, brushes: [
    B('Ink Pen', 'round', 8, 1, { spacing: 0.05 }), B('Calligraphy', 'flat', 34, 1, { angle: 45, spacing: 0.05 }),
    B('Marker', 'round', 40, 0.85, { roundness: 0.55, angle: 30, opacity: 0.85 }),
    B('Watercolor', 'round', 80, 0, { flow: 0.18, sizeJitter: 0.35, opacityJitter: 0.5, hueJitter: 0.04, scatter: 0.15 }),
    B('Oil Bristle', 'bristle', 48, 1, { follow: true, spacing: 0.06, flow: 0.8 }), B('Dry Brush', 'bristle', 60, 1, { follow: true, spacing: 0.08, opacityJitter: 0.6, flow: 0.6 }),
  ] },
  { name: 'Texture', builtin: true, brushes: [
    B('Chalk', 'chalk', 40, 0.8), B('Charcoal', 'charcoal', 36, 1, { angleJitter: 1, spacing: 0.1 }), B('Spray', 'spray', 70, 1),
    B('Sponge', 'sponge', 60, 1, { angleJitter: 1, spacing: 0.35, opacityJitter: 0.4 }),
    B('Grass', 'grass', 70, 1, { spacing: 0.25, sizeJitter: 0.5, angleJitter: 0.08, scatter: 0.4, count: 2, hueJitter: 0.08 }),
    B('Leaves', 'leaf', 40, 1, { spacing: 0.7, sizeJitter: 0.4, angleJitter: 1, scatter: 0.8, hueJitter: 0.12 }),
    B('Stars', 'star', 30, 1, { spacing: 1.1, sizeJitter: 0.6, angleJitter: 1, scatter: 1.2 }),
    B('Confetti', 'square', 14, 1, { spacing: 0.9, sizeJitter: 0.5, angleJitter: 1, scatter: 2, count: 2, hueJitter: 1, roundness: 0.5 }),
  ] },
  { name: 'Slop FX', builtin: true, brushes: [
    B('Slime Drip', 'slime', 46, 0.85), B('Goo Splat', 'splat', 60, 1, { spacing: 0.8, sizeJitter: 0.4, angleJitter: 1, scatter: 0.6 }),
    B('Bubbles', 'ring', 36, 1, { spacing: 1, sizeJitter: 0.7, scatter: 1.5 }), B('Sloppo Stamp', 'sloppo', 60, 1, { spacing: 1.3, sizeJitter: 0.35, angleJitter: 0.06 }),
    B('Hearts', 'heart', 34, 1, { spacing: 1.1, sizeJitter: 0.5, angleJitter: 0.15, scatter: 1, hueJitter: 0.05 }),
    B('Glitter', 'star', 10, 1, { spacing: 0.6, sizeJitter: 0.8, angleJitter: 1, scatter: 2.5, count: 3, hueJitter: 0.6 }),
  ] },
];
let customPacks = [];
const allPacks = () => BUILTIN_PACKS.concat(customPacks);
async function loadBrushPacks() {
  try {
    const saved = await idbDo('readonly', (st) => st.get('brushpacks'));
    if (!saved) return;
    for (const pack of saved) for (const b of pack.brushes) if (b.image) await registerTipImage(b);
    customPacks = saved;
    emit('brushes');
  } catch (e) { /* storage unavailable */ }
}
async function saveBrushPacks() { try { await idbDo('readwrite', (st) => st.put(customPacks, 'brushpacks')); } catch (e) { toast('Could not store brushes on this device'); } }
async function registerTipImage(b) {
  const id = b.tipImage || 'img:' + hash32(b.image);
  if (!TIP_IMAGES.has(id)) TIP_IMAGES.set(id, await imageToMask(await loadImage(b.image)));
  b.tipImage = id; b.tip = 'image';
  return id;
}
function hash32(s) { let h = 2166136261; for (let i = 0; i < s.length; i += 7) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + s.length.toString(36); }
/** Image → black alpha mask. Opaque images: dark = paint (like Photoshop). Transparent images: use alpha. */
function imageToMask(img, maxSide = 600) {
  const k = Math.min(1, maxSide / Math.max(img.width, img.height)), w = Math.max(1, Math.round(img.width * k)), hh = Math.max(1, Math.round(img.height * k));
  const c = mkCanvas(w, hh), g = cxr(c); g.drawImage(img, 0, 0, w, hh);
  const d = g.getImageData(0, 0, w, hh), px = d.data;
  let transparent = false; for (let i = 3; i < px.length; i += 4) if (px[i] < 250) { transparent = true; break; }
  for (let i = 0; i < px.length; i += 4) { const a = transparent ? px[i + 3] : 255 - luma(px[i], px[i + 1], px[i + 2]); px[i] = px[i + 1] = px[i + 2] = 0; px[i + 3] = a; }
  g.putImageData(d, 0, 0);
  return trimMask(c);
}
function trimMask(c) { const b = alphaBounds(c); if (!b) return c; const t = mkCanvas(b.w, b.h); cx(t).drawImage(c, -b.x, -b.y); return t; }
function maskToDataURL(m) { const c = mkCanvas(m.width, m.height), g = cx(c); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(m, 0, 0); return c.toDataURL('image/png'); }

/* ---------- Photoshop .abr ---------- */
function abrGray(R, w, hh, depth, compressed) {
  const bps = depth >> 3, n = w * hh * bps, out = new Uint8Array(w * hh);
  let raw;
  if (!compressed) raw = R.bytes(n);
  else {
    const counts = []; for (let y = 0; y < hh; y++) counts.push(R.u16());
    raw = new Uint8Array(n); let p = R.p;
    for (let y = 0; y < hh; y++) { unpackBits(R.buf, p, p + counts[y], raw, y * w * bps, w * bps); p += counts[y]; }
    R.p = p;
  }
  for (let i = 0; i < w * hh; i++) out[i] = raw[i * bps];
  return out;
}
function grayToTip(gray, w, hh) {
  const c = mkCanvas(w, hh), g = cxr(c), img = g.createImageData(w, hh);
  for (let i = 0; i < w * hh; i++) img.data[i * 4 + 3] = gray[i];
  g.putImageData(img, 0, 0);
  const k = Math.min(1, 600 / Math.max(w, hh));
  if (k < 1) { const t = mkCanvas(w * k, hh * k), tg = cx(t); tg.imageSmoothingQuality = 'high'; tg.drawImage(c, 0, 0, t.width, t.height); return trimMask(t); }
  return trimMask(c);
}
function parseABR(buf) {
  const R = new Reader(buf), version = R.u16(), tips = [];
  if (version === 1 || version === 2) {
    const count = R.u16();
    for (let i = 0; i < count && R.p < R.buf.length; i++) {
      const type = R.u16(), size = R.u32(), next = R.p + size;
      if (type === 2) {
        R.u32(); const spacing = R.u16();
        let name = '';
        if (version === 2) { const n = R.u32(); for (let k = 0; k < n; k++) name += String.fromCharCode(R.u16()); name = name.replace(/\0+$/, ''); }
        R.u8();
        const top = R.i16(), left = R.i16(), bottom = R.i16(), right = R.i16(), depth = R.u16(), comp = R.u8();
        const w = right - left, hh = bottom - top;
        if (w > 0 && hh > 0 && w < 6000 && hh < 6000) tips.push({ name: name || `Brush ${tips.length + 1}`, canvas: grayToTip(abrGray(R, w, hh, depth, comp), w, hh), spacing: spacing / 100 });
      }
      R.p = next;
    }
  } else if (version === 6 || version === 7 || version === 10) {
    const sub = R.u16();
    while (R.p + 12 <= R.buf.length) {
      const sig = R.ascii(4), key = R.ascii(4), len = R.u32(), end = R.p + len;
      if (sig !== '8BIM') break;
      if (key === 'samp') {
        while (R.p + 4 < end) {
          const bl = R.u32(); let pad = bl; while (pad % 4) pad++;
          const next = R.p + pad;
          R.skip(sub === 1 ? 47 : 301);
          const top = R.i32(), left = R.i32(), bottom = R.i32(), right = R.i32(), depth = R.u16(), comp = R.u8();
          const w = right - left, hh = bottom - top;
          if (w > 0 && hh > 0 && w < 6000 && hh < 6000 && (depth === 8 || depth === 16)) {
            try { tips.push({ name: `Brush ${tips.length + 1}`, canvas: grayToTip(abrGray(R, w, hh, depth, comp), w, hh), spacing: 0.25 }); } catch (e) { /* skip a broken sample */ }
          }
          R.p = next;
        }
      }
      R.p = end + (len % 2);
    }
  } else throw new Error(`Unsupported .abr version ${version}`);
  if (!tips.length) throw new Error('No sampled brushes found in that .abr (computed brushes are not supported)');
  return tips;
}

async function importBrushFiles(files) {
  let added = 0;
  for (const f of files) {
    try {
      const n = f.name.replace(/\.[^.]+$/, '');
      if (/\.abr$/i.test(f.name)) {
        const tips = parseABR(await f.arrayBuffer());
        const pack = { name: n, brushes: [] };
        for (const t of tips) { const image = maskToDataURL(t.canvas); const b = B(t.name, 'image', Math.min(200, Math.max(t.canvas.width, t.canvas.height)), 1, { spacing: Math.max(0.05, t.spacing || 0.25), image }); await registerTipImage(b); pack.brushes.push(b); }
        customPacks.push(pack); added += pack.brushes.length;
      } else if (/\.(slopbrush|json)$/i.test(f.name)) {
        const data = JSON.parse(await f.text());
        if (data.format !== 'slopbrush' || !Array.isArray(data.brushes)) throw new Error('Not a .slopbrush pack');
        for (const b of data.brushes) { if (b.image) await registerTipImage(b); }
        customPacks.push({ name: data.name || n, brushes: data.brushes }); added += data.brushes.length;
      } else if (f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(f.name)) {
        const img = await loadImage(URL.createObjectURL(f));
        const mask = imageToMask(img);
        const b = B(n, 'image', Math.min(200, Math.max(mask.width, mask.height)), 1, { spacing: 0.25, image: maskToDataURL(mask) });
        await registerTipImage(b); myBrushes().brushes.push(b); added++;
      } else toast(`Can't import ${f.name}`);
    } catch (e) { console.warn(e); toast(`Couldn't import ${f.name}: ${e.message}`, 4000); }
  }
  if (added) { await saveBrushPacks(); emit('brushes'); toast(`Imported ${added} brush${added === 1 ? '' : 'es'}`); }
}
function myBrushes() { let p = customPacks.find((x) => x.mine); if (!p) { p = { name: 'My Brushes', mine: true, brushes: [] }; customPacks.unshift(p); } return p; }
function exportPack(pack) {
  const data = { format: 'slopbrush', version: 1, name: pack.name, brushes: pack.brushes.map((b) => { const o = Object.assign({}, b); delete o.tipImage; if (b.tip === 'image' && !o.image) o.image = maskToDataURL(TIP_IMAGES.get(b.tipImage)); return o; }) };
  download(new Blob([JSON.stringify(data)], { type: 'application/json' }), pack.name.replace(/[\\/:*?"<>|]+/g, '-') + '.slopbrush');
}
function defineBrushFromSelection() {
  const L = activeLayer(); if (!L) return;
  const r = copySelectionPixels(true), mask = imageToMask(r.canvas);
  SlopUI.prompt('Define Brush Preset', 'Name', 'Brush ' + (myBrushes().brushes.length + 1)).then(async (name) => {
    if (name == null) return;
    const b = B(name || 'Brush', 'image', Math.min(300, Math.max(mask.width, mask.height)), 1, { spacing: 0.25, image: maskToDataURL(mask) });
    await registerTipImage(b); myBrushes().brushes.push(b); await saveBrushPacks();
    applyPreset(b); emit('brushes'); toast(`Brush “${b.name}” added to My Brushes`);
  });
}
function brushTarget() { return UI.tool === 'eraser' ? T.eraser : T.brush; }
function applyPreset(p) {
  const o = brushTarget();
  Object.assign(o, DYN, { tip: 'round', spacing: 0.12, flow: 1 }, p);
  delete o.image; delete o.name; delete o.builtin;
  o.preset = p.name;
  if (UI.tool !== 'brush' && UI.tool !== 'eraser') selectTool('brush');
  saveToolOptions(); buildOptions(); emit('brushes'); dirty();
}

/* ---------- Brushes panel ---------- */
const previewCache = new Map();
function buildBrushesPanel() {
  const wrap = h('div', { class: 'bp-panel' });
  const render = () => {
    wrap.textContent = '';
    const cur = brushTarget().preset;
    for (const pack of allPacks()) {
      if (!pack.brushes.length && !pack.mine) continue;
      const head = h('div', { class: 'bpk-head' }, h('span', null, pack.name), h('span', { class: 'bpk-n' }, pack.brushes.length));
      if (!pack.builtin) {
        const ex = h('button', { type: 'button', class: 'bpk-btn', title: 'Export this pack (.slopbrush)' }, '⇩'); ex.addEventListener('click', () => exportPack(pack));
        const del = h('button', { type: 'button', class: 'bpk-btn', title: 'Remove this pack' }, '×'); del.addEventListener('click', async () => { if (await SlopUI.confirm('Remove brush pack?', `Remove “${pack.name}” and its ${pack.brushes.length} brushes from this device?`, 'Remove', { danger: true })) { customPacks = customPacks.filter((p) => p !== pack); await saveBrushPacks(); emit('brushes'); } });
        head.append(ex, del);
      }
      const grid = h('div', { class: 'bpk-grid' });
      for (const b of pack.brushes) {
        const key = pack.name + '|' + b.name + '|' + theme();
        if (!previewCache.has(key)) previewCache.set(key, presetPreview(b));
        const btn = h('button', { type: 'button', class: 'bpk-b' + (cur === b.name ? ' on' : ''), title: `${b.name} · ${b.size}px` }, previewCache.get(key), h('span', null, b.name));
        btn.addEventListener('click', () => applyPreset(b));
        btn.addEventListener('contextmenu', (e) => { e.preventDefault(); SlopUI.menu([{ label: 'Use', act: () => applyPreset(b) }, { label: 'Brush Settings…', act: () => { applyPreset(b); dlgBrushSettings(); } }, !pack.builtin ? { label: 'Delete brush', act: async () => { pack.brushes.splice(pack.brushes.indexOf(b), 1); await saveBrushPacks(); emit('brushes'); } } : null], e.clientX, e.clientY); });
        grid.append(btn);
      }
      wrap.append(head, grid);
    }
  };
  const bar = h('div', { class: 'bp-bar' },
    h('button', { type: 'button', class: 'btn', onclick: () => SlopUI.pickFiles({ accept: '.abr,.slopbrush,.json,image/*', multiple: true }).then(importBrushFiles), title: 'Photoshop .abr, PNG/JPEG tips, .slopbrush packs' }, 'Import…'),
    h('button', { type: 'button', class: 'btn', onclick: () => dlgBrushSettings() }, 'Settings…'),
    h('button', { type: 'button', class: 'btn', onclick: () => defineBrushFromSelection(), title: 'Make a brush from the selection (or the whole image)' }, 'From selection'));
  listeners.add((w) => { if (w === 'brushes' || w === 'theme') render(); });
  render();
  return h('div', null, bar, wrap);
}

/* ---------- Brush Settings ---------- */
function dlgBrushSettings() {
  const o = brushTarget();
  Object.keys(DYN).forEach((k) => { if (o[k] === undefined) o[k] = DYN[k]; });
  const prev = h('canvas', { class: 'bs-preview', width: 520, height: 140 });
  const draw = () => {
    const g = cx(prev); g.clearRect(0, 0, prev.width, prev.height);
    g.fillStyle = theme() === 'pro' ? '#1a1a1a' : '#ffffff'; g.fillRect(0, 0, prev.width, prev.height);
    const d = makeDabber(Object.assign({}, o, { size: Math.min(o.size, 90) }), theme() === 'pro' ? '#e8e8e8' : '#111111', false);
    const st = new Stroker(() => d.spacing(1), (x, y, pr) => d.dab(g, x, y, pr));
    const pt = (t) => ({ x: 40 + t * 440, y: 70 + Math.sin(t * Math.PI * 2) * 38, pressure: 1 });
    st.begin(pt(0)); for (let i = 1; i <= 60; i++) st.to(pt(i / 60));
  };
  const rows = [];
  const range = (label, key, min, max, step, fmt = (v) => v, toV = (v) => v, fromV = (v) => v) => {
    const r = h('input', { type: 'range', min, max, step, value: fromV(o[key]) }), n = h('span', { class: 'bs-v' }, fmt(fromV(o[key])));
    r.addEventListener('input', () => { o[key] = toV(+r.value); n.textContent = fmt(+r.value); o.preset = null; saveToolOptions(); draw(); });
    rows.push(h('label', { class: 'bs-row' }, h('span', null, label), r, n));
  };
  const pctF = (v) => Math.round(v) + '%';
  range('Size', 'size', 1, 1000, 1, (v) => v + 'px');
  range('Hardness', 'hardness', 0, 100, 1, pctF, (v) => v / 100, (v) => v * 100);
  range('Spacing', 'spacing', 1, 300, 1, pctF, (v) => v / 100, (v) => v * 100);
  range('Angle', 'angle', -180, 180, 1, (v) => v + '°');
  range('Roundness', 'roundness', 5, 100, 1, pctF, (v) => v / 100, (v) => v * 100);
  range('Flow', 'flow', 1, 100, 1, pctF, (v) => v / 100, (v) => v * 100);
  range('Size jitter', 'sizeJitter', 0, 100, 1, pctF, (v) => v / 100, (v) => v * 100);
  range('Angle jitter', 'angleJitter', 0, 100, 1, pctF, (v) => v / 100, (v) => v * 100);
  range('Scatter', 'scatter', 0, 300, 1, pctF, (v) => v / 100, (v) => v * 100);
  range('Count', 'count', 1, 6, 1);
  range('Opacity jitter', 'opacityJitter', 0, 100, 1, pctF, (v) => v / 100, (v) => v * 100);
  range('Hue jitter', 'hueJitter', 0, 100, 1, pctF, (v) => v / 100, (v) => v * 100);
  const tipSel = SlopUI.select(tipOptions(o), o.tip || 'round');
  tipSel.addEventListener('change', () => { o.tip = tipSel.value; o.preset = null; saveToolOptions(); draw(); });
  const follow = SlopUI.check('Angle follows the stroke', o.follow); follow.input.addEventListener('change', () => { o.follow = follow.input.checked; draw(); saveToolOptions(); });
  const pop = SlopUI.check('Pen pressure controls opacity', o.pressureOpacity); pop.input.addEventListener('change', () => { o.pressureOpacity = pop.input.checked; saveToolOptions(); });
  const body = h('div', { class: 'bs' }, prev, SlopUI.field('Tip', tipSel), h('div', { class: 'bs-grid' }, rows), h('div', { class: 'bs-checks' }, follow.el, pop.el));
  draw();
  SlopUI.dialog({ title: 'Brush Settings', cls: 'sui-wide bs-dlg', body, buttons: [
    { label: 'Save as Preset…', act: async () => {
      const name = await SlopUI.prompt('New Brush Preset', 'Name', o.preset || 'My Brush'); if (name == null) return false;
      const b = Object.assign({}, o, { name: name || 'My Brush' }); delete b.preset; delete b.pressure; delete b.blend;
      if (b.tip === 'image') b.image = maskToDataURL(TIP_IMAGES.get(b.tipImage));
      myBrushes().brushes.push(b); await saveBrushPacks(); o.preset = b.name; emit('brushes'); toast(`Saved “${b.name}”`);
      return false;
    } },
    { label: 'Done', primary: true },
  ], onClose: () => { buildOptions(); emit('brushes'); } });
}
