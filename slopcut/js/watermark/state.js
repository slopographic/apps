/* SlopCut: the watermark module, state and drawing. The open project keeps its settings in doc.watermark
   (saved with the project file, undoable through SE.change). A project without it keeps the watermark OFF and takes
   its style from this device's saved default. The pixels come from the shared engine (shared/watermark/core.js,
   window.SlopWatermark). SE.compositor.render calls apply() after the layers are drawn, so the monitor, snapshots
   and every export (MP4, WebM, GIF, real-time recording) get the same frame.
   Switching the module off: remove its script tags from index.html. Every call site checks for SE.watermark first. */
(function () {
  'use strict';
  const SE = window.SE, U = SE.util;
  const WM = SE.watermark = {};
  const KEY = 'watermark'; // device default style (localStorage key slopedit.watermark)
  const STYLE = ['kind', 'text', 'font', 'weight', 'colour', 'shadow', 'size', 'logoScale', 'opacity', 'position', 'tile', 'rotate', 'margin'];
  const logos = new Map(); // logo data URL → { img, ok, ready } (runtime only, decoded once)

  /** This device's style for new watermarks: the saved default over the engine defaults. */
  WM.deviceDefaults = function () {
    const d = SlopWatermark.defaults(), s = U.store.get(KEY, null) || {};
    for (const k of STYLE) if (s[k] !== undefined) d[k] = s[k];
    return d;
  };
  /** The settings in force for a project: { on, logo, ...style }. Off unless the person turned it on. */
  WM.settings = (p = SE.doc) => Object.assign({ on: false, logo: null }, WM.deviceDefaults(), p.watermark || {});
  /** Change the watermark of the open project as one undoable step (a drag or typing coalesces by key). */
  WM.set = function (patch, label = 'Watermark', key = 'wm') {
    SE.change(label, (p) => { p.watermark = Object.assign(WM.settings(p), patch); }, { key: 'wm:' + key });
  };
  /** Keep the current style as this device's default (the logo and the on switch stay per project). */
  WM.saveDefaults = function () {
    const s = WM.settings(), d = {};
    for (const k of STYLE) d[k] = s[k];
    U.store.set(KEY, d);
  };
  /** Copy this device's default style into the open project (text, colour, size and placement). */
  WM.useDefaults = function () {
    const d = WM.deviceDefaults(), patch = {};
    for (const k of STYLE) patch[k] = d[k];
    WM.set(patch, 'Watermark style', 'style');
  };

  /** Decode a logo once. The monitor is redrawn when it arrives. */
  function loadLogo(src) {
    let e = logos.get(src);
    if (!e) {
      const img = new Image();
      e = { img, ok: false, ready: null };
      e.ready = (async () => {
        img.src = src;
        try { await img.decode(); e.ok = true; SE.emit('frame', {}); } catch (err) { console.warn('SlopCut: watermark logo did not load', err); }
      })();
      logos.set(src, e);
    }
    return e;
  }
  /** Resolves when the logo of a project (if it is on and uses one) is decoded. Export waits for it, like text fonts. */
  WM.ready = async function (p = SE.doc) {
    const s = WM.settings(p);
    if (s.on && s.kind === 'logo' && s.logo) await loadLogo(s.logo).ready;
  };
  /** Draw the watermark on a frame of w × h (the transform is the identity). Called by the compositor. */
  WM.apply = function (g, w, h, p = SE.doc) {
    const s = WM.settings(p);
    if (!s.on || !window.SlopWatermark) return;
    const e = s.kind === 'logo' && s.logo ? loadLogo(s.logo) : null;
    SlopWatermark.draw(g, w, h, s, { image: e && e.ok ? e.img : null });
  };
})();
