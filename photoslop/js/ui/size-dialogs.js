/* PhotoSlop UI: Image Size and Canvas Size dialogs (the work is in core/size.js) */
'use strict';

const SZ_MAX = 12000;
const szClamp = (v) => clamp(Math.round(v) || 1, 1, SZ_MAX);
const FILL_CHOICES = [['transparent', 'Transparent'], ['bg', 'Background colour'], ['fg', 'Foreground colour'], ['white', 'White'], ['black', 'Black']];
/** Colour for the new canvas area, or null for transparent. */
const canvasFill = (v) => ({ bg: C.bg, fg: C.fg, white: '#ffffff', black: '#000000' })[v] || null;
const LINK_ICON = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M6.5 9.5l3-3M7.2 4.6l1.3-1.3a2.6 2.6 0 0 1 3.7 3.7l-1.3 1.3M8.8 11.4l-1.3 1.3a2.6 2.6 0 0 1-3.7-3.7l1.3-1.3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

/** Anchor grid: nine positions. state.ax / state.ay: 0 = left/top, 1 = centre, 2 = right/bottom. */
function anchorGrid(state) {
  const g = h('div', { class: 'anchor', role: 'group', 'aria-label': 'Anchor' });
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
    const b = h('button', { type: 'button', class: 'anchor-b' + (state.ax === i && state.ay === j ? ' on' : ''), 'aria-label': `Anchor ${['top', 'middle', 'bottom'][j]} ${['left', 'centre', 'right'][i]}` });
    b.addEventListener('click', () => { state.ax = i; state.ay = j; $$('.anchor-b', g).forEach((x) => x.classList.remove('on')); b.classList.add('on'); });
    g.append(b);
  }
  return g;
}
function dlgCanvasSize() {
  const w = numInput(D.w, 1, SZ_MAX), hh = numInput(D.h, 1, SZ_MAX), st = { ax: 1, ay: 1 };
  w.setAttribute('aria-label', 'Width'); hh.setAttribute('aria-label', 'Height');
  const fill = h('select', { 'aria-label': 'Canvas extension' }, FILL_CHOICES.map(([v, l]) => h('option', { value: v }, l)));
  dialog({ title: 'Canvas Size', body: h('div', { class: 'form' }, h('p', { class: 'dlg-p' }, `Current size: ${D.w} × ${D.h} px`), field('Width', w, 'px'), field('Height', hh, 'px'),
    h('div', { class: 'field' }, h('span', { class: 'field-l' }, 'Anchor'), anchorGrid(st)), field('New area', fill)),
    buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, act: () => {
      const nw = szClamp(+w.value), nh = szClamp(+hh.value);
      if (nw === D.w && nh === D.h) return;
      resizeCanvas(nw, nh, Math.round(((nw - D.w) * st.ax) / 2), Math.round(((nh - D.h) * st.ay) / 2), 'Canvas Size', canvasFill(fill.value));
      fitView();
    } }] });
}
function dlgImageSize() {
  const pw = D.w, ph = D.h, flat = flattenCanvas();
  const st = { link: true, w: pw, h: ph };
  const wi = numInput(pw, 1, SZ_MAX), hi = numInput(ph, 1, SZ_MAX);
  wi.setAttribute('aria-label', 'Width'); hi.setAttribute('aria-label', 'Height');
  const uw = h('span', { class: 'field-u' }, 'px'), uh = h('span', { class: 'field-u' }, 'px');
  const unit = h('select', { 'aria-label': 'Units' }, h('option', { value: 'px' }, 'Pixels'), h('option', { value: '%' }, 'Percent'));
  const mode = h('select', { 'aria-label': 'Resample' }, RESAMPLE_MODES.map(([v, l]) => h('option', { value: v, selected: v === 'bicubic' }, l)));
  const link = h('button', { type: 'button', class: 'btn primary', 'aria-pressed': 'true', title: 'Keep aspect ratio', html: LINK_ICON + '<span> Keep aspect ratio</span>' });
  const prev = h('canvas', { 'aria-label': 'Preview of the new size', style: 'display:block;margin:8px auto;border:1px solid rgba(127,127,127,.5);max-width:100%' });
  const info = h('p', { class: 'dlg-p', 'aria-live': 'polite' });
  const base = (axis) => (axis === 'w' ? pw : ph);
  const shown = (px, axis) => (unit.value === '%' ? Math.round((px / base(axis)) * 1000) / 10 : px);
  const toPx = (v, axis) => szClamp(unit.value === '%' ? (v * base(axis)) / 100 : v);
  const read = () => { st.w = toPx(+wi.value || 1, 'w'); st.h = toPx(+hi.value || 1, 'h'); };
  const draw = () => {
    const s = Math.min(220 / st.w, 160 / st.h, 1), dw = Math.max(1, Math.round(st.w * s)), dh = Math.max(1, Math.round(st.h * s));
    prev.width = dw; prev.height = dh;
    const g = cx(prev); setInterp(g, 'bicubic'); g.clearRect(0, 0, dw, dh); g.drawImage(flat, 0, 0, dw, dh);
    info.textContent = `New size: ${st.w} × ${st.h} px (was ${pw} × ${ph} px)`;
  };
  // from = the field the person typed in: the linked field follows it.
  const onInput = (from) => {
    read();
    if (st.link) {
      if (from === 'w') { st.h = szClamp((st.w * ph) / pw); hi.value = shown(st.h, 'h'); }
      else { st.w = szClamp((st.h * pw) / ph); wi.value = shown(st.w, 'w'); }
    }
    draw();
  };
  wi.addEventListener('input', () => onInput('w'));
  hi.addEventListener('input', () => onInput('h'));
  unit.addEventListener('change', () => {
    uw.textContent = uh.textContent = unit.value === '%' ? '%' : 'px';
    wi.step = hi.step = unit.value === '%' ? 0.1 : 1;
    wi.value = shown(st.w, 'w'); hi.value = shown(st.h, 'h'); draw();
  });
  link.addEventListener('click', () => {
    st.link = !st.link; link.classList.toggle('primary', st.link); link.setAttribute('aria-pressed', String(st.link));
    if (st.link) onInput('w');
  });
  const row = (label, input, u) => h('label', { class: 'field' }, h('span', { class: 'field-l' }, label), input, u);
  draw();
  dialog({ title: 'Image Size', body: h('div', { class: 'form' }, row('Width', wi, uw), row('Height', hi, uh),
    h('div', { class: 'field' }, h('span', { class: 'field-l' }, 'Units'), unit), h('div', { class: 'field' }, link), field('Resample', mode), prev, info),
    buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, act: () => {
      read();
      if (st.w === pw && st.h === ph) return;
      imageSize(st.w, st.h, mode.value);
      fitView();
    } }] });
}
