/* Slop Colors: swatches and the parts of the page drawn from them (the current colour and its values: js/values.js):
 * the palette (pick, move, rename, remove) and the rows made from the current colour (harmony, scale, ramp).
 * A swatch's label is in black or white, whichever reads better on it (shared/color/contrast.js). Classic script. */
(function (g) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const S = () => g.CO.state, X = () => g.SlopColors;
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  /** Black or white, whichever has the more contrast on the colour. */
  const ink = (hex) => (g.SlopContrastMath.ratioHex(hex, '#000000') >= g.SlopContrastMath.ratioHex(hex, '#ffffff') ? '#000000' : '#ffffff');

  async function copy(text, btn) {
    try { await navigator.clipboard.writeText(text); if (btn) { btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = 'Copy'; }, 1200); } }
    catch (e) { g.SlopUI.toast('Could not copy: the browser did not allow it'); }
  }

  /** One swatch: a button that picks the colour, and optional small buttons beside it. */
  function swatch(hex, o = {}) {
    const li = el('div', 'co-sw' + (o.selected ? ' is-on' : ''));
    li.setAttribute('role', 'listitem');
    const b = el('button', 'co-sw-btn');
    b.type = 'button';
    b.style.background = hex; b.style.color = ink(hex);
    b.dataset.hex = hex;
    b.append(el('span', 'co-sw-hex', o.label || hex));
    if (o.share != null) b.append(el('span', 'co-sw-share', Math.round(o.share * 100) + '%'));
    b.setAttribute('aria-label', (o.name ? o.name + ', ' : '') + hex + (o.share != null ? `, ${Math.round(o.share * 100)}% of the picture` : '') + (o.pickLabel ? '. ' + o.pickLabel : ''));
    if (o.selected) b.setAttribute('aria-current', 'true');
    b.addEventListener('click', () => (o.onPick || pick)(hex));
    li.append(b);
    if (o.tools) {
      const t = el('div', 'co-sw-tools');
      for (const [label, aria, fn] of o.tools) { const x = el('button', 'co-sw-tool', label); x.type = 'button'; x.setAttribute('aria-label', aria); x.title = aria; x.addEventListener('click', fn); t.append(x); }
      li.append(t);
    }
    return li;
  }
  const pick = (hex) => S().set({ current: hex });

  function move(i, d) {
    const p = S().get().palette, cols = p.colors.slice(), j = i + d;
    if (j < 0 || j >= cols.length) return;
    [cols[i], cols[j]] = [cols[j], cols[i]];
    S().set({ palette: { name: p.name, colors: cols } });
  }
  function remove(i) {
    const p = S().get().palette, cols = p.colors.slice();
    cols.splice(i, 1);
    S().set({ palette: { name: p.name, colors: cols } });
  }
  function rename(i) {
    const p = S().get().palette, cols = p.colors.slice(), cur = cols[i];
    g.SlopUI.prompt('Rename the colour', 'Name', cur.name || '', { placeholder: cur.hex }).then((v) => {
      if (v == null) return;
      cols[i] = v.trim() ? { hex: cur.hex, name: v.trim() } : { hex: cur.hex };
      S().set({ palette: { name: p.name, colors: cols } });
    });
  }
  function palette(s) {
    const cols = s.palette.colors, box = $('co-palette');
    box.replaceChildren(...cols.map((c, i) => swatch(c.hex, { label: c.name || c.hex, name: c.name, selected: c.hex === s.current,
      tools: [['‹', `Move ${c.name || c.hex} left`, () => move(i, -1)], ['›', `Move ${c.name || c.hex} right`, () => move(i, 1)],
        ['✎', `Rename ${c.name || c.hex}`, () => rename(i)], ['×', `Remove ${c.name || c.hex}`, () => remove(i)]] })));
    $('co-pal-note').textContent = cols.length ? `${cols.length} of ${S().MAX} colours. Pick one to edit it; the panel exports the palette.`
      : 'Empty. Add the current colour, a colour from a picture, or use a row below as the palette.';
    $('co-pal-clear').disabled = !cols.length;
  }

  /** The rows made from the current colour; their colours, for "Use as the palette". */
  const made = { harmony: [], scale: [], ramp: [] };
  function generated(s) {
    const H = X().harmony;
    made.harmony = H.harmony(s.current, s.harmony);
    made.scale = H.scale(s.current, s.scale, s.steps);
    const r = H.ramp(s.current);
    made.ramp = H.RAMP_KEYS.map((k) => ({ hex: r[k], name: String(k) }));
    $('co-harm-h').textContent = (H.HARMONIES.find((x) => x[0] === s.harmony) || H.HARMONIES[0])[1];
    $('co-scale-h').textContent = (H.SCALES.find((x) => x[0] === s.scale) || H.SCALES[0])[1];
    $('co-harmony').replaceChildren(...made.harmony.map((h) => swatch(h, { selected: h === s.current })));
    $('co-scale').replaceChildren(...made.scale.map((h) => swatch(h, { selected: h === s.current })));
    $('co-ramp').replaceChildren(...made.ramp.map((c) => swatch(c.hex, { label: c.name, name: c.name, selected: c.hex === s.current })));
  }
  function usePalette(which) {
    const s = S().get(), H = X().harmony, name = which === 'ramp' ? `${s.current} ramp` : `${s.current} ${which === 'harmony' ? s.harmony : s.scale}`;
    const cols = which === 'ramp' ? made.ramp : made[which].map((hex) => ({ hex }));
    S().set({ palette: { name, colors: cols } });
    return H && cols.length;
  }

  function wire() {
    $('co-pal-add').addEventListener('click', () => { try { S().addColor(S().get().current); } catch (e) { g.SlopUI.toast(e.message); } });
    $('co-pal-clear').addEventListener('click', () => S().set({ palette: { name: S().get().palette.name, colors: [] } }));
    for (const w of ['harmony', 'scale', 'ramp']) $(`co-${w === 'harmony' ? 'harm' : w}-use`).addEventListener('click', () => usePalette(w));
  }
  g.CO.swatches = { ink, swatch, copy, palette, generated, usePalette, made, move, remove, wire };
})(window);
