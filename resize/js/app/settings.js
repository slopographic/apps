/* Slop Resize: the settings panel. Reads the form into one settings object, writes one back (presets), shows only the
 * controls that suit the chosen mode, and turns the settings into what the queue runs. Classic script; exposes
 * window.SlopResize.settings.
 *   DEFAULTS                 the settings a new session starts with
 *   read() / write(s)        the form <-> settings object (ids rs-*, see index.html)
 *   fromSaved(obj)           a saved settings object, checked and filled in with defaults
 *   toRun(s)                 { spec, image, video } for queue.run
 *   showModes(mode)          hides the rows that do not apply to the mode (data-modes="size bytes" on each row) */
(function (g) {
  'use strict';
  const NS = g.SlopResize, S = (NS.settings = {});
  const $ = (id) => document.getElementById(id);

  S.DEFAULTS = {
    mode: 'size', w: 1080, h: 1080, keepRatio: true, scale: 50, long: 1920, maxKB: 500,
    fill: 'fit', anchor: 'center', bg: 'transparent', even: true,
    mime: 'image/jpeg', quality: 85,
    vformat: 'mp4', vquality: 'medium', fps: 30, audio: true,
  };
  const KEYS = Object.keys(S.DEFAULTS);
  const ANCHORS = NS.size.ANCHORS, FILLS = NS.size.FILLS, MODES = NS.size.MODES;

  const val = (id) => { const e = $(id); return e ? e.value : ''; };
  const num = (id) => { const n = parseFloat(val(id)); return Number.isFinite(n) ? n : 0; };
  const chk = (id) => { const e = $(id); return !!(e && e.checked); };
  const setVal = (id, v) => { const e = $(id); if (e) e.value = String(v); };
  const setChk = (id, v) => { const e = $(id); if (e) e.checked = !!v; };

  S.read = function () {
    return {
      mode: val('rs-mode'), w: num('rs-w'), h: num('rs-h'), keepRatio: chk('rs-keep'),
      scale: num('rs-scale'), long: num('rs-long'), maxKB: num('rs-kb'),
      fill: val('rs-fill'), anchor: val('rs-anchor'),
      bg: chk('rs-transparent') ? 'transparent' : val('rs-bg'), even: chk('rs-even'),
      mime: val('rs-mime'), quality: num('rs-quality'),
      vformat: val('rs-vformat'), vquality: val('rs-vquality'), fps: num('rs-fps'), audio: chk('rs-audio'),
    };
  };

  S.write = function (s) {
    setVal('rs-mode', s.mode); setVal('rs-w', s.w); setVal('rs-h', s.h); setChk('rs-keep', s.keepRatio);
    setVal('rs-scale', s.scale); setVal('rs-long', s.long); setVal('rs-kb', s.maxKB);
    setVal('rs-fill', s.fill); setVal('rs-anchor', s.anchor);
    setChk('rs-transparent', s.bg === 'transparent'); if (s.bg !== 'transparent') setVal('rs-bg', s.bg);
    setChk('rs-even', s.even); setVal('rs-mime', s.mime); setVal('rs-quality', s.quality);
    setVal('rs-vformat', s.vformat); setVal('rs-vquality', s.vquality); setVal('rs-fps', s.fps); setChk('rs-audio', s.audio);
    S.showModes(s.mode);
    S.labels();
  };

  /** A saved settings object (from Drive or local storage) with only known keys, each of the right type. */
  S.fromSaved = function (o) {
    const out = Object.assign({}, S.DEFAULTS);
    if (!o || typeof o !== 'object') return out;
    for (const k of KEYS) {
      const d = S.DEFAULTS[k], v = o[k];
      if (typeof d === 'number') { if (Number.isFinite(v)) out[k] = v; }
      else if (typeof d === 'boolean') { if (typeof v === 'boolean') out[k] = v; }
      else if (typeof v === 'string') out[k] = v;
    }
    if (!MODES.includes(out.mode)) out.mode = S.DEFAULTS.mode;
    if (!FILLS.includes(out.fill)) out.fill = S.DEFAULTS.fill;
    if (!ANCHORS.includes(out.anchor)) out.anchor = S.DEFAULTS.anchor;
    if (!NS.format.byMime(out.mime)) out.mime = S.DEFAULTS.mime;
    return out;
  };

  /** What the queue runs with: the geometry spec plus the encoder choices. */
  S.toRun = function (s) {
    const spec = NS.size.normalize({ mode: s.mode, w: s.w, h: s.h, keepRatio: s.keepRatio, scale: s.scale, long: s.long, fill: s.fill, anchor: s.anchor, bg: s.bg, even: s.even, maxBytes: s.maxKB * 1024 });
    return {
      spec,
      image: { mime: s.mime, quality: Math.min(1, Math.max(0.05, s.quality / 100)) },
      video: { format: s.vformat === 'webm' ? 'webm' : 'mp4', fps: [24, 25, 30, 50, 60].includes(s.fps) ? s.fps : 30, quality: ['low', 'medium', 'high'].includes(s.vquality) ? s.vquality : 'medium', audio: !!s.audio },
    };
  };

  S.showModes = function (mode) {
    for (const row of document.querySelectorAll('[data-modes]')) {
      row.hidden = !row.dataset.modes.split(/\s+/).includes(mode);
    }
  };

  /** Labels that show a value next to its control. */
  S.labels = function () {
    const sc = $('rs-scale'), out = $('rs-scale-out');
    if (sc && out) out.textContent = sc.value + '%';
    const q = $('rs-quality'), qo = $('rs-quality-out');
    if (q && qo) qo.textContent = q.value + '%';
  };
})(typeof window !== 'undefined' ? window : globalThis);
