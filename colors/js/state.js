/* Slop Colors: the page's one state, kept in this browser (localStorage 'slop-colors'; a private window simply starts
 * fresh). Every part of the page reads it and changes it through here, and redraws on change().
 *   current            the colour being looked at ('#rrggbb')
 *   palette            { name, colors: [{ hex, name? }] } (at most 64 colours)
 *   fg, bg             the contrast check's text and background colours
 *   harmony, scale, steps, k, format   the panel's choices (harmony and scale ids, scale steps, colours to find, export format)
 * CO.state.get(), set(patch), on(fn) → off, snapshot() / restore(s) (the assistant's checkpoint), DEFAULTS, MAX. */
(function (g) {
  'use strict';
  const KEY = 'slop-colors', MAX = 64;
  const DEFAULTS = Object.freeze({ current: '#3366cc', palette: { name: 'My palette', colors: [] }, fg: '#1f2937', bg: '#ffffff',
    harmony: 'complementary', scale: 'tints', steps: 6, k: 6, format: 'css' });
  const C = () => g.SlopColors.convert;
  const t = (k, v) => (g.SlopI18n ? g.SlopI18n.t(k, v) : k);
  const fns = new Set();
  const clone = (x) => JSON.parse(JSON.stringify(x));
  let s = clone(DEFAULTS);
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && typeof saved === 'object') s = Object.assign(s, saved);
  } catch (e) { /* no storage: start fresh */ }

  /** Checks a patch: colours parsed, numbers in range, the palette's colours cleaned and capped. */
  function clean(p) {
    const out = {};
    for (const k of ['current', 'fg', 'bg']) if (p[k] != null) { const h = C().parse(p[k]); if (!h) throw new Error(t('colors.app.not_colour', { text: p[k] })); out[k] = h; }
    if (p.palette) {
      const cols = (p.palette.colors || []).map((c) => ({ hex: C().parse(typeof c === 'string' ? c : c.hex), name: typeof c === 'object' && c.name ? String(c.name).slice(0, 60) : undefined }))
        .filter((c) => c.hex).slice(0, MAX).map((c) => (c.name ? c : { hex: c.hex }));
      out.palette = { name: String(p.palette.name == null ? s.palette.name : p.palette.name).slice(0, 80) || 'Palette', colors: cols };
    }
    for (const k of ['harmony', 'scale', 'format']) if (p[k] != null) out[k] = String(p[k]);
    if (p.steps != null) out.steps = Math.max(2, Math.min(12, Math.round(Number(p.steps)) || DEFAULTS.steps));
    if (p.k != null) out.k = Math.max(2, Math.min(12, Math.round(Number(p.k)) || DEFAULTS.k));
    return out;
  }
  function set(patch) {
    Object.assign(s, clean(patch || {}));
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* not kept */ }
    for (const fn of fns) { try { fn(s); } catch (e) { console.error(e); } }
    return s;
  }
  const get = () => s;
  const on = (fn) => { fns.add(fn); return () => fns.delete(fn); };
  const snapshot = () => clone(s);
  const restore = (x) => set(clone(x));
  /** The palette with one more colour (not twice in a row the same one), or an error when it is full. */
  function addColor(hex, name) {
    const cols = s.palette.colors.slice(), h = C().parse(hex);
    if (!h) throw new Error(t('colors.app.not_colour', { text: hex }));
    if (cols.length >= MAX) throw new Error(t('colors.app.full', { n: MAX }));
    cols.push(name ? { hex: h, name } : { hex: h });
    set({ palette: { name: s.palette.name, colors: cols } });
    return cols.length;
  }
  g.CO = g.CO || {};
  g.CO.state = { get, set, on, snapshot, restore, addColor, DEFAULTS, MAX };
})(window);
