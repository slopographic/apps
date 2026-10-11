/* PhotoSLOP brushes: brush packs, .abr import and presets */
'use strict';

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
