/* Slop Colors: the right panel (shared/frame/panel.js, the suite's rule): the current colour in every format (type in any
 * one, the others follow), what to make from it, how many colours to find in a picture, and the palette's name and
 * export format; at its foot Download palette (the main action), Save to Slop Drive…, Copy code and Open in…. Classic script. */
(function (g) {
  'use strict';
  const S = () => g.CO.state, X = () => g.SlopColors;
  const el = (tag, attrs = {}, ...kids) => { const n = document.createElement(tag); for (const k in attrs) n.setAttribute(k, attrs[k]); n.append(...kids); return n; };
  const LABELS = { hex: 'HEX', rgb: 'RGB', hsl: 'HSL', oklch: 'OKLCH', cmyk: 'CMYK' };
  let side = null, parts = null;

  function field(label, control, note) {
    const l = el('label', { class: 'sf-field' }, el('span', { class: 'sf-lab' }, label), control);
    if (note) l.append(el('span', { class: 'sf-note' }, note));
    return l;
  }
  function select(id, options) { const s = el('select', { id }); for (const [v, t] of options) s.append(el('option', { value: v }, t)); return s; }
  function build() {
    const picker = el('input', { type: 'color', id: 'co-native', 'aria-label': 'Choose a colour' });
    const inputs = {};
    for (const k of X().convert.KINDS) inputs[k] = el('input', { type: 'text', id: 'co-in-' + k, spellcheck: 'false', autocomplete: 'off', 'aria-label': LABELS[k] });
    const asText = el('button', { type: 'button', class: 'sui-btn', id: 'co-as-fg' }, 'Use as text colour');
    const asBg = el('button', { type: 'button', class: 'sui-btn', id: 'co-as-bg' }, 'Use as background');
    const gamut = el('p', { class: 'sf-note', id: 'co-gamut', 'aria-live': 'polite' });
    const H = X().harmony;
    const harmony = select('co-harmony-kind', H.HARMONIES), scale = select('co-scale-kind', H.SCALES);
    const steps = el('input', { type: 'number', id: 'co-steps', min: '2', max: '12', step: '1' });
    const k = el('input', { type: 'number', id: 'co-k', min: '2', max: '12', step: '1' });
    const name = el('input', { type: 'text', id: 'co-pal-name', maxlength: '80', autocomplete: 'off' });
    const format = select('co-format', X().formats.FORMATS.map((f) => [f.id, f.label]));
    parts = { picker, inputs, asText, asBg, gamut, harmony, scale, steps, k, name, format };
    const colour = [field('Colour', picker), ...X().convert.KINDS.map((kk) => field(LABELS[kk], inputs[kk])), gamut, el('div', { class: 'co-btns' }, asText, asBg)];
    wire();
    return [
      { title: 'Colour', key: 'colour', settings: colour },
      { title: 'Made from it', key: 'gen', settings: [field('Harmony', harmony), field('Scale', scale), field('Steps in the scale', steps)] },
      { title: 'Picture', key: 'pic', settings: [field('Colours to find', k, 'The main colours, by k-means, the same every time for the same picture.')] },
      { title: 'Export', key: 'export', settings: [field('Palette name', name), field('Format', format)] },
    ];
  }
  function wire() {
    const P = parts;
    P.picker.addEventListener('input', () => S().set({ current: P.picker.value }));
    for (const [k, inp] of Object.entries(P.inputs)) {
      inp.addEventListener('input', () => {
        const h = X().convert.parse(inp.value);
        inp.setAttribute('aria-invalid', String(!h));
        if (h && h !== S().get().current) S().set({ current: h });
        if (k === 'oklch') gamutNote(inp.value);
      });
      inp.addEventListener('change', () => { inp.removeAttribute('aria-invalid'); inp.value = X().convert.format(S().get().current, k); });
    }
    P.asText.addEventListener('click', () => S().set({ fg: S().get().current }));
    P.asBg.addEventListener('click', () => S().set({ bg: S().get().current }));
    P.harmony.addEventListener('change', () => S().set({ harmony: P.harmony.value }));
    P.scale.addEventListener('change', () => S().set({ scale: P.scale.value }));
    P.steps.addEventListener('change', () => S().set({ steps: P.steps.value }));
    P.k.addEventListener('change', () => { S().set({ k: P.k.value }); g.CO.picture.find(); });
    P.name.addEventListener('input', () => S().set({ palette: { name: P.name.value || 'Palette', colors: S().get().palette.colors } }));
    P.format.addEventListener('change', () => S().set({ format: P.format.value }));
  }
  /** Says when a typed OKLCH colour is outside sRGB (it is shown with less chroma). */
  function gamutNote(text) {
    const m = /oklch\(\s*([\d.]+)(%?)\s+([\d.]+)(%?)\s+([\d.]+)/i.exec(text || ''), C = X().convert;
    const out = m && C.outOfGamut(m[2] ? +m[1] / 100 : +m[1], m[4] ? (+m[3] / 100) * 0.4 : +m[3], +m[5]);
    parts.gamut.textContent = out ? 'Outside the sRGB screen colours: shown with less chroma, the same lightness and hue.' : '';
  }
  /** Puts the state into the controls, except the one being typed in. */
  function paint(s) {
    const P = parts, active = document.activeElement, C = X().convert;
    if (active !== P.picker) P.picker.value = s.current;
    for (const [k, inp] of Object.entries(P.inputs)) if (active !== inp) inp.value = C.format(s.current, k);
    if (active !== P.inputs.oklch) P.gamut.textContent = '';
    P.harmony.value = s.harmony; P.scale.value = s.scale; P.steps.value = s.steps; P.k.value = s.k;
    if (active !== P.name) P.name.value = s.palette.name;
    P.format.value = s.format;
    footer(s);
  }
  function footer(s) {
    const IO = g.CO.io, n = s.palette.colors.length, f = X().formats.FORMATS.find((x) => x.id === s.format) || X().formats.FORMATS[0];
    side.footer([
      { id: 'co-download', label: `Download palette (.${f.ext})`, primary: true, disabled: !n, run: () => IO.download() },
      { id: 'co-drive', label: 'Save to Slop Drive…', disabled: !n, run: () => IO.saveToDrive().catch((e) => g.SlopUI.toast('Could not save: ' + e.message)) },
      { id: 'co-copy-code', label: 'Copy code', disabled: !n || f.id === 'ase', run: () => IO.copyCode() },
      { id: 'co-openin', label: 'Open in…', disabled: !n, menu: () => IO.openInItems() },
    ], { stack: true, more: 'Settings', note: n ? `${n} colour${n === 1 ? '' : 's'} in “${s.palette.name}”` : 'Add colours to the palette to export it' });
  }
  function mount(panelEl) {
    side = g.SlopFrame.panel(panelEl, { title: 'Settings' });
    side.render(build());
    return side;
  }
  g.CO.panel = { mount, paint, footer, parts: () => parts };
})(window);
