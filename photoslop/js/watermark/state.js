/* PhotoSlop watermark: each document's settings (D.wm) and this device's defaults. The drawing is the shared engine
 * (shared/watermark/core.js, SlopWatermark). Off until the person turns it on, per document: the device defaults carry
 * the style only, never the switch or a logo. D.wm is { on, cfg, image }: cfg is the engine's settings plus cfg.logo
 * (a data URL, saved with the file), and image is the decoded logo (rebuilt on open, never saved itself). */
'use strict';

const WM_RES_ID = 8100; // the PSD image resource that holds the settings (psd.js); a private id Photoshop keeps as is
let wmVer = 0; // bumped on every change, so the page preview knows to repaint

/** The engine's settings with the saved values of the right type (unknown or bad values fall back to the defaults). */
function wmClean(saved, withLogo) {
  const base = SlopWatermark.defaults(), out = Object.assign({}, base);
  for (const k of Object.keys(base)) if (saved && typeof saved[k] === typeof base[k]) out[k] = saved[k];
  if (!SlopWatermark.POSITIONS.includes(out.position)) out.position = base.position;
  if (withLogo && saved && typeof saved.logo === 'string' && /^data:image\//.test(saved.logo)) out.logo = saved.logo;
  else delete out.logo;
  return out;
}
/** The style this device uses for a new document (no switch, no logo). */
function wmDefaults() { return wmClean(store.get('watermark.defaults', null), false); }
function wmOn() { return !!(D.wm && D.wm.on); }
/** The document's watermark state, made from the device defaults the first time it is needed (switched off). */
function wmState() { return D.wm || (D.wm = { on: false, cfg: wmDefaults(), image: null }); }
/** Replaces the document's watermark with a new object (so tab stashes and autosave keep the old one). */
function wmUpdate(patch) { D.wm = Object.assign({}, wmState(), patch); wmChanged(); }
function wmChanged() { wmVer++; D.dirty = true; scheduleAutosave(); dirty(); emit('watermark'); }
function wmSetOn(on) { wmUpdate({ on: !!on }); }
function wmToggle() { wmSetOn(!wmOn()); toast(wmOn() ? 'Watermark on: added to exports and shown on the page' : 'Watermark off'); }
/** Changes style settings; patch holds engine settings (kind, text, size, position, ...). */
function wmSet(patch) { wmUpdate({ cfg: Object.assign({}, wmState().cfg, patch) }); }
/** Decodes a picked image (PNG, JPEG, WebP or SVG) as the logo and switches the kind to logo. Throws on a bad file. */
async function wmSetLogo(file) {
  if (file.size > 8 * 1048576) throw new Error('Pick a logo under 8 MB');
  const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Could not read that file')); r.readAsDataURL(file); });
  const image = await loadImage(url);
  if (!image.naturalWidth) throw new Error('That image has no width; use a PNG, JPEG, WebP or an SVG with a size');
  wmUpdate({ image, cfg: Object.assign({}, wmState().cfg, { kind: 'logo', logo: url }) });
}
function wmClearLogo() { const c = Object.assign({}, wmState().cfg); delete c.logo; wmUpdate({ image: null, cfg: c }); }
/** Keeps the current style as this device's default for new documents (the switch and the logo are not kept). */
function wmSaveDefaults() {
  const cfg = Object.assign({}, wmState().cfg); delete cfg.logo; delete cfg.kind;
  store.set('watermark.defaults', cfg);
  toast('Saved as this device’s default watermark');
}
/** Back to the device default style; the switch and the logo stay. */
function wmResetStyle() {
  const s = wmState(), cfg = Object.assign(wmDefaults(), s.cfg.logo ? { logo: s.cfg.logo, kind: s.cfg.kind } : {});
  wmUpdate({ cfg });
}
/** After a document that carried a watermark is opened (PSD, autosave, Slop Drive): its settings, then its logo. */
async function adoptWatermark(saved) {
  const s = { on: !!saved.on, cfg: wmClean(saved.cfg, true), image: null };
  D.wm = s; wmVer++; dirty(); emit('watermark');
  if (s.cfg.logo) {
    try { s.image = await loadImage(s.cfg.logo); wmVer++; dirty(); emit('watermark'); } catch (e) { /* a damaged logo: the watermark stays without it */ }
  }
}
