/* PhotoSlop Auto retouch ▸ Auto enhance and Straighten. Loaded on first use (js/retouch/boot.js).
 * The maths is shared/retouch/tone.js (the same analysis Filter ▸ Auto Enhance… shows in its dialog) and
 * shared/retouch/horizon.js; the denoise is the AI Tools edge-keeping filter (app/ai-tools.js aiDenoiseCanvas).
 * Auto enhance works on the visible picture and puts the result in a new layer, "Auto Enhance", above the active one:
 * hide it, lower its opacity or paint its mask to take the change back anywhere. One history step (with Straighten, the
 * rotation and crop are folded into the same step). */
'use strict';

/** The analysed values for a canvas (a copy of at most 256 px). */
function rtEnhanceValues(c) { const s = rtSmall(c, 256); return SlopRetouchTone.analyse(s.data, s.w, s.h); }
/** The tone parameters from the analysed values and the command's switches (a missing switch is on). */
function rtEnhanceParams(v, a = {}) {
  const on = (k) => a[k] !== false;
  return {
    inB: on('levels') ? v.inB : 0, inW: on('levels') ? v.inW : 255,
    wr: on('white_balance') ? v.wr : 1, wg: on('white_balance') ? v.wg : 1, wb: on('white_balance') ? v.wb : 1,
    ev: on('exposure') ? v.ev : 0, shadows: on('shadows_highlights') ? v.shadows : 0, highlights: on('shadows_highlights') ? v.highlights : 0,
    sat: on('vibrance') ? v.sat : 0, skin: true, strength: a.strength ?? 100, sharpen: a.sharpen ?? v.sharpen,
  };
}
const rtTone = (c, p) => rtCanvas(SlopRetouchTone.apply(rtPixels(c).data, c.width, c.height, p), c.width, c.height);
/** The enhanced canvas: tone, then denoise, then the sharpening (so the noise is not sharpened). */
async function rtEnhanceCanvas(src, p, denoise) {
  let out = rtTone(src, Object.assign({}, p, { sharpen: 0 }));
  out = await rtDenoise(out, denoise);
  if (p.sharpen) out = rtTone(out, { sharpen: (p.sharpen * (p.strength ?? 100)) / 100 });
  return out;
}
function rtDescribe(p) {
  const parts = [`levels ${p.inB}–${p.inW}`, `white balance R×${p.wr} G×${p.wg} B×${p.wb}`, `exposure ${p.ev > 0 ? '+' : ''}${p.ev} EV`];
  if (p.shadows || p.highlights) parts.push(`shadows +${p.shadows}, highlights −${p.highlights}`);
  if (p.sat) parts.push(`vibrance +${p.sat}%`);
  if (p.sharpen) parts.push(`sharpen ${p.sharpen}%`);
  return parts.join(', ');
}

async function rtAutoEnhance(a = {}) {
  await rtSettle();
  if (!activeLayer()) throw new Error('There is no picture to enhance');
  await rtPrepareAI();
  const src = rtComposite(), p = rtEnhanceParams(rtEnhanceValues(src), a);
  const tilt = a.straighten ? rtTilt(src) : null, fix = tilt && Math.abs(tilt.angle) >= 0.2 && tilt.confidence >= 0.3;
  const out = await rtEnhanceCanvas(src, p, a.denoise);
  await aiOneStep('Auto Enhance', () => {
    rtAddLayers([{ name: nextName('Auto Enhance'), canvas: out }], 'Auto Enhance');
    if (fix) rtStraighten(tilt.angle, true);
  });
  if (window.SlopMacros && a.fromDialog) SlopMacros.note('ps.retouch.auto-enhance', rtArgsOnly(a), 'Auto enhance');
  dirty(true);
  return `Added the “Auto Enhance” layer: ${rtDescribe(p)}${a.denoise && a.denoise !== 'none' ? `, denoise ${a.denoise}` : ''}.` +
    (a.straighten ? (fix ? ` Straightened by ${-tilt.angle}°.` : ' The picture looks level, so it was not rotated.') : '');
}
/** The command's own arguments (what a macro records), without the dialog's extras. */
function rtArgsOnly(a) { const o = Object.assign({}, a); delete o.fromDialog; return o; }

/* ---------- straighten ---------- */
function rtTilt(c) {
  const s = rtSmall(c, 400);
  return SlopRetouchHorizon.detectTilt(SlopRetouchCore.lumaOf(s.data, s.w, s.h), s.w, s.h);
}
/** Rotates every layer (and mask) about the document centre by −angle and, with crop, keeps the largest box of the
 *  picture's own proportions that has no empty corners. One history step, 'Straighten'. */
function rtStraighten(angle, crop = true) {
  const box = crop ? SlopRetouchHorizon.straightenBox(D.w, D.h, angle) : { w: D.w, h: D.h };
  const W = box.w, H = box.h, rad = (-angle * Math.PI) / 180, dw = D.w, dh = D.h;
  const rot = (c, x, y) => {
    const o = mkCanvas(W, H), g = cx(o);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.translate(W / 2, H / 2); g.rotate(rad); g.translate(-dw / 2, -dh / 2); g.drawImage(c, x, y);
    return o;
  };
  D.layers = D.layers.map((L) => {
    const n = Object.assign({}, L, { canvas: rot(L.canvas, L.x, L.y), x: 0, y: 0, text: null, shape: null });
    if (L.mask) n.mask = Object.assign({}, L.mask, { canvas: rot(SlopMask.align(L.mask, dw, dh, 0, 0), 0, 0), x: 0, y: 0 });
    return n;
  });
  D.w = W; D.h = H; D.sel = null;
  remapGuides(() => null);
  commit('Straighten');
  fitView();
}
async function rtStraightenCmd(a = {}) {
  await rtSettle();
  let angle = a.angle, how = 'given';
  if (angle == null) {
    const t = rtTilt(rtComposite());
    if (!t || t.confidence < 0.2) return 'No clear horizon or verticals were found, so nothing was changed. Give an angle to rotate anyway.';
    angle = t.angle; how = `detected (${t.kind}, confidence ${t.confidence})`;
  }
  if (Math.abs(angle) < 0.1) return `The picture is level (${angle}°), so nothing was changed.`;
  rtStraighten(angle, a.crop !== false);
  return `Rotated by ${-angle}° (tilt ${how}). The image is now ${D.w} × ${D.h} px.`;
}
function rtDetectTilt() {
  const t = rtTilt(rtComposite());
  if (!t) return 'No strong straight lines were found.';
  return `Tilt ${t.angle}° from the ${t.kind} (confidence ${t.confidence}; positive falls to the right). Straighten rotates by ${-t.angle}°.`;
}
/** Image ▸ Straighten…: detect, then ask. */
async function rtStraightenAsk() {
  await rtSettle();
  const t = rtTilt(rtComposite());
  if (!t || t.confidence < 0.2) { alertDlg('Straighten', 'No clear horizon or vertical lines were found in this picture.'); return; }
  if (Math.abs(t.angle) < 0.1) { alertDlg('Straighten', 'The picture is already level.'); return; }
  const ok = await confirmDlg('Straighten', `The ${t.kind === 'horizon' ? 'horizon leans' : 'verticals lean'} by ${Math.abs(t.angle)}°. Rotate the image by ${-t.angle}° and crop the empty corners?`, 'Straighten');
  if (!ok) return;
  rtStraighten(t.angle, true);
  if (window.SlopMacros) SlopMacros.note('ps.retouch.straighten', { angle: t.angle, crop: true }, 'Straighten');
}
