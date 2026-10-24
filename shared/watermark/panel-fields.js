/* The watermark panel's layer editor (panel.js): the fields of the selected layer, built from the spec's one table of
 * settings (SlopWatermarkSpec.FIELDS and SIZE: ranges, steps, defaults and words). Text: the text, font, bold, colour and
 * shadow; logo: the picture; then size, opacity, the 3 by 3 position, space from the edge, move across and down, repeat,
 * rotation, and the page range (PDFs) or time range (videos) when the panel shows those kinds of file.
 * Classic script: SlopWatermarkPanel.fields(ctx) → { el, sync() }. ctx: { layer() → the selected layer, patch(patch,
 * label, key), media() → { pages, time }, pageCount(), currentPage(), pickLogo() }. sync() puts the layer's values in
 * the fields without touching the one being edited, so a slider drag or typing is never interrupted. */
(function () {
  'use strict';
  const P = (window.SlopWatermarkPanel = window.SlopWatermarkPanel || {});
  const S = window.SlopWatermarkSpec, F = S.FIELDS;
  const el = (...a) => window.SlopUI.el(...a);
  let seq = 0;

  const fmt = (f, v) => (f.pct ? (Math.round(v * 1000) / 10) + '%' : f.unit ? Math.round(v) + f.unit : String(v));
  const put = (input, v) => { if (document.activeElement !== input && input.value !== String(v)) input.value = String(v); };

  P.fields = function (ctx) {
    const syncs = [], id = () => 'swp-f' + (++seq);
    const L = () => ctx.layer();
    function row(label, control, extra) {
      const fid = control.id || (control.id = id());
      return el('div', { class: 'swp-field' }, el('label', { class: 'swp-label', for: fid }, label), control, extra || null);
    }
    /** A slider for a field: the shown value is a percent when the field is a fraction. */
    function slider(key, f, labelOf, undoLabel) {
      const k = f.pct ? 100 : 1, input = el('input', { type: 'range', class: 'swp-range', min: f.min * k, max: f.max * k, step: f.step * k, 'data-f': key });
      const out = el('output', { class: 'swp-out', for: input.id = id() });
      input.addEventListener('input', () => ctx.patch({ [key]: +input.value / k }, undoLabel, key));
      const lab = el('label', { class: 'swp-label', for: input.id });
      syncs.push(() => {
        const ff = key === 'size' ? S.SIZE[L().kind] : f;
        input.min = ff.min * k; input.max = ff.max * k; input.step = ff.step * k;
        put(input, Math.round(L()[key] * k * 1000) / 1000);
        out.textContent = fmt(ff, L()[key]);
        lab.textContent = labelOf ? labelOf() : f.label;
      });
      return el('div', { class: 'swp-field' }, el('div', { class: 'swp-label-row' }, lab, out), input);
    }
    function check(key, label, undoLabel) {
      const cb = el('input', { type: 'checkbox', 'data-f': key });
      cb.addEventListener('change', () => ctx.patch({ [key]: cb.checked }, undoLabel || label));
      syncs.push(() => { cb.checked = !!L()[key]; });
      return el('label', { class: 'swp-check' }, cb, el('span', null, label));
    }

    // text
    const text = el('input', { type: 'text', class: 'sui-input', maxlength: F.text.max, autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Watermark text', 'data-f': 'text' });
    text.addEventListener('input', () => ctx.patch({ text: text.value }, 'Edit watermark text', 'text'));
    const font = el('select', { class: 'sui-input', 'data-f': 'font' }, F.font.options.map(([v, l]) => el('option', { value: v }, l)));
    font.addEventListener('change', () => ctx.patch({ font: font.value }, 'Change font'));
    const colour = el('input', { type: 'color', class: 'swp-colour', 'aria-label': 'Watermark colour', 'data-f': 'colour' });
    colour.addEventListener('input', () => ctx.patch({ colour: colour.value }, 'Change colour', 'colour'));
    syncs.push(() => { put(text, L().text); font.value = L().font; put(colour, L().colour); });
    const textBox = el('div', { class: 'swp-group' }, row('Text', text),
      el('div', { class: 'swp-pair' }, row('Font', font), row('Colour', colour)),
      el('div', { class: 'swp-pair' }, check('bold', 'Bold', 'Change bold'), check('shadow', 'Soft shadow', 'Change shadow')));

    // logo
    const thumb = el('img', { class: 'swp-thumb', alt: '' }), logoName = el('span', { class: 'swp-logo-name' });
    const choose = el('button', { type: 'button', class: 'sui-btn' }, 'Choose picture…');
    choose.addEventListener('click', () => ctx.pickLogo());
    syncs.push(() => {
      const x = L();
      thumb.hidden = !x.logo;
      if (x.logo && thumb.getAttribute('src') !== x.logo) thumb.src = x.logo;
      logoName.textContent = x.logo ? (x.logoName || 'Logo') : 'No picture yet';
      choose.textContent = x.logo ? 'Change picture…' : 'Choose picture…';
    });
    const logoBox = el('div', { class: 'swp-group swp-logo' }, thumb, el('div', { class: 'swp-logo-meta' }, logoName, choose,
      el('span', { class: 'swp-fine' }, 'PNG, JPEG, WebP, GIF or SVG. A see-through PNG looks best.')));

    // placement
    const grid = el('div', { class: 'swp-pos', role: 'group', 'aria-label': 'Position' });
    const cells = S.POSITIONS.map((p) => {
      const b = el('button', { type: 'button', class: 'swp-cell', 'data-pos': p, 'aria-label': S.POSITION_LABELS[p], title: S.POSITION_LABELS[p], 'aria-pressed': 'false' }, el('i'));
      b.addEventListener('click', () => ctx.patch({ position: p }, 'Move layer'));
      grid.append(b);
      return b;
    });
    syncs.push(() => cells.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pos === L().position))));

    // pages (PDF) and time (video)
    const pageMode = el('div', { class: 'swp-seg', role: 'group', 'aria-label': 'Pages' });
    const pagesIn = el('input', { type: 'text', class: 'sui-input', placeholder: 'e.g. 1-3, 5, last', 'aria-label': 'Page range', maxlength: F.pages.max, 'data-f': 'pages' });
    const pagesNote = el('p', { class: 'swp-fine swp-warn', hidden: true });
    const segs = [['all', 'All pages'], ['current', 'This page'], ['range', 'Some pages']].map(([v, l]) => {
      const b = el('button', { type: 'button', class: 'sui-btn', 'data-mode': v, 'aria-pressed': 'false' }, l);
      b.addEventListener('click', () => {
        if (v === 'all') ctx.patch({ pages: '' }, 'Apply to all pages');
        else if (v === 'current') ctx.patch({ pages: String(ctx.currentPage()) }, 'Apply to this page');
        else { pagesIn.hidden = false; pagesIn.focus(); }
      });
      pageMode.append(b);
      return b;
    });
    pagesIn.addEventListener('input', () => {
      let bad = '';
      try { S.parsePages(pagesIn.value, ctx.pageCount() || Infinity); } catch (e) { bad = e.message; }
      pagesNote.textContent = bad; pagesNote.hidden = !bad; pagesIn.classList.toggle('swp-bad', !!bad);
      if (!bad) ctx.patch({ pages: pagesIn.value.trim() }, 'Change pages', 'pages');
    });
    syncs.push(() => {
      const v = String(L().pages || '').trim(), cur = ctx.currentPage ? String(ctx.currentPage()) : '';
      const mode = !v ? 'all' : cur && v === cur ? 'current' : 'range';
      segs.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
      segs[1].hidden = !ctx.currentPage;
      if (mode === 'range') pagesIn.hidden = false; else if (document.activeElement !== pagesIn) pagesIn.hidden = true;
      if (mode === 'range') put(pagesIn, v);
    });
    const pagesBox = el('div', { class: 'swp-group swp-pages' }, el('span', { class: 'swp-label' }, 'Pages (PDF)'), pageMode, pagesIn, pagesNote);
    const timeIn = (key) => {
      const n = el('input', { type: 'number', class: 'sui-input', min: 0, step: F[key].step, inputmode: 'decimal', 'data-f': key });
      n.addEventListener('input', () => { const v = parseFloat(n.value); ctx.patch({ [key]: Number.isFinite(v) ? v : 0 }, 'Change time', key); });
      syncs.push(() => put(n, L()[key] || 0));
      return n;
    };
    const timeBox = el('div', { class: 'swp-group swp-time' }, el('span', { class: 'swp-label' }, 'When it shows (video)'),
      el('div', { class: 'swp-pair' }, row('From (seconds)', timeIn('from')), row('Until (0 is the end)', timeIn('to'))));

    const rest = el('div', { class: 'swp-group' },
      slider('size', S.SIZE.text, () => (L().kind === 'logo' ? 'Logo width (% of the shorter side)' : 'Text size (% of the shorter side)'), 'Change size'),
      slider('opacity', F.opacity, null, 'Change opacity'),
      el('div', { class: 'swp-field' }, el('span', { class: 'swp-label' }, 'Position'), grid),
      check('tile', F.tile.label, 'Repeat across'),
      slider('rotate', F.rotate, null, 'Change rotation'),
      slider('margin', F.margin, null, 'Change space from the edge'),
      el('details', { class: 'swp-more' }, el('summary', null, 'Fine position'),
        slider('dx', F.dx, null, 'Move layer'), slider('dy', F.dy, null, 'Move layer')));

    const root = el('div', { class: 'swp-editor' }, textBox, logoBox, rest, pagesBox, timeBox);
    function sync() {
      const x = L();
      if (!x) return;
      textBox.hidden = x.kind !== 'text'; logoBox.hidden = x.kind !== 'logo';
      const m = ctx.media();
      pagesBox.hidden = !m.pages; timeBox.hidden = !m.time;
      syncs.forEach((fn) => fn());
    }
    return { el: root, sync };
  };
})();
