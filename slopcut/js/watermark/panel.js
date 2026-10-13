/* SlopCut: the Watermark tab of the bin (the project panel). The on/off switch, text or logo, size, opacity,
   position (nine places), tile, rotation, margin, colour and shadow. Each change is one undoable step on the open
   project and the monitor shows it at once, drawn by watermark/state.js (the same pixels as the export).
   The panel is built once and then only synced, so a slider drag is not interrupted by the bin's re-renders. */
(function () {
  'use strict';
  const SE = window.SE, U = SE.util, WM = SE.watermark, h = U.h;
  const P = WM.panel = {};
  const NAMES = { tl: 'Top left', tc: 'Top centre', tr: 'Top right', ml: 'Middle left', mc: 'Centre', mr: 'Middle right', bl: 'Bottom left', bc: 'Bottom centre', br: 'Bottom right' };
  let root = null, fields = [];

  /** A logo as a PNG data URL, at most 600 px on its long side (it is kept in the project file). */
  async function logoData(file) {
    const url = URL.createObjectURL(file), img = new Image();
    try { img.src = url; await img.decode(); } finally { URL.revokeObjectURL(url); }
    const w = img.naturalWidth || 512, hh = img.naturalHeight || 512, k = Math.min(1, 600 / Math.max(w, hh));
    const c = U.canvas(Math.max(1, Math.round(w * k)), Math.max(1, Math.round(hh * k)));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return { src: c.toDataURL('image/png'), name: file.name };
  }
  async function pickLogo() {
    const files = await SlopUI.pickFiles({ accept: 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml' });
    if (!files || !files[0]) return;
    try { const d = await logoData(files[0]); WM.set({ kind: 'logo', logo: d.src, logoName: d.name }, 'Watermark logo', 'logo'); }
    catch (e) { SlopUI.toast('That image could not be read'); }
  }
  /** A checkbox row: get() gives a boolean, set(boolean) changes it. */
  function check(label, get, set) {
    const cb = h('input', { type: 'checkbox', 'aria-label': label });
    cb.addEventListener('change', () => set(cb.checked));
    const el = h('label', { class: 'ins-row wm-check' }, h('span', null, label), cb, h('span'));
    return { el, sync: () => { cb.checked = !!get(); } };
  }

  function build() {
    const S = SE.fields, get = (k) => () => WM.settings()[k];
    const set = (k) => (v) => WM.set({ [k]: v }, 'Watermark ' + k.replace(/([A-Z])/g, ' $1').toLowerCase(), k);
    const track = (f) => { fields.push(f); return f; };
    fields = [];
    // the switch: the watermark shows in the monitor and in exports only while this is on
    const cb = h('input', { type: 'checkbox', role: 'switch', 'aria-label': 'Watermark on' });
    const note = h('p', { class: 'wm-note' });
    cb.addEventListener('change', () => WM.set({ on: cb.checked }, cb.checked ? 'Watermark on' : 'Watermark off', 'on'));
    const switchField = track({ el: h('div', null, h('label', { class: 'wm-switch' }, cb, h('span', null, 'Watermark')), note), sync: () => {
      const s = WM.settings();
      cb.checked = !!s.on;
      note.textContent = s.on ? 'On: shows in the monitor and in every export.' : 'Off: no watermark in the monitor or in exports. Turn it on to add it.';
    } });
    // the logo: the picked image, its name and the buttons
    const logoImg = h('img', { alt: '', hidden: true }), logoName = h('span', { class: 'wm-logoname' });
    const logoClear = h('button', { type: 'button', class: 'btn sm', onclick: () => WM.set({ logo: null, logoName: null, kind: 'text' }, 'Remove logo', 'logo') }, 'Remove');
    const logoField = track({ el: h('div', { class: 'ins-row' }, h('span', null, 'Logo'), h('div', { class: 'wm-logo' }, logoImg, logoName,
      h('button', { type: 'button', class: 'btn sm', onclick: pickLogo }, SE.icon('plus'), 'Choose…'), logoClear)), sync: () => {
      const s = WM.settings();
      logoImg.hidden = !s.logo;
      if (s.logo && logoImg.getAttribute('src') !== s.logo) logoImg.src = s.logo;
      logoName.textContent = s.logo ? (s.logoName || 'Logo') : 'No logo chosen';
      logoClear.disabled = !s.logo;
    } });
    // the nine places (SlopWatermark.POSITIONS is in grid order)
    const cells = SlopWatermark.POSITIONS.map((k) => {
      const b = h('button', { type: 'button', class: 'wm-cell', title: NAMES[k], 'aria-label': NAMES[k], onclick: () => WM.set({ position: k }, 'Watermark position', 'position') });
      b.dataset.v = k; return b;
    });
    const posField = track({ el: h('div', { class: 'ins-row' }, h('span', null, 'Position'), h('div', { class: 'wm-pos', role: 'group', 'aria-label': 'Position' }, cells)), sync: () => {
      const p = WM.settings().position;
      cells.forEach((b) => { const on = b.dataset.v === p; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    } });
    const kind = track(S.chips('Type', [['text', 'Text'], ['logo', 'Logo']], get('kind'), set('kind')));
    const text = track(S.text('Text', get('text'), set('text')));
    const colour = track(S.color('Colour', get('colour'), set('colour')));
    const size = track(S.slider('Text size', get('size'), set('size'), { min: 1, max: 20, step: 0.5, dec: 1, scale: 100, unit: '%' }));
    const logoSize = track(S.slider('Logo size', get('logoScale'), set('logoScale'), { min: 2, max: 80, step: 1, scale: 100, unit: '%' }));
    const opacity = track(S.slider('Opacity', get('opacity'), set('opacity'), { min: 0, max: 100, step: 1, scale: 100, unit: '%' }));
    const shadow = track(check('Shadow', get('shadow'), set('shadow')));
    const tile = track(check('Tile across', get('tile'), set('tile')));
    const rotate = track(S.slider('Rotation', get('rotate'), set('rotate'), { min: -180, max: 180, step: 1, unit: '°' }));
    const margin = track(S.slider('Margin', get('margin'), set('margin'), { min: 0, max: 20, step: 0.5, dec: 1, scale: 100, unit: '%' }));
    return h('div', { class: 'wm-panel' },
      h('div', { class: 'ins-title' }, SE.icon('sparkle'), h('b', null, 'Watermark')),
      switchField.el,
      S.section('Content', 'film', kind, text, logoField, colour),
      S.section('Look', 'sliders', size, logoSize, opacity, shadow),
      S.section('Placement', 'image', posField, tile, rotate, margin),
      h('div', { class: 'wm-actions' },
        h('button', { type: 'button', class: 'btn sm', title: 'Keep this style as the default for new watermarks on this device', onclick: () => { WM.saveDefaults(); SlopUI.toast('Saved as this device’s watermark default'); } }, 'Save as device default'),
        h('button', { type: 'button', class: 'btn sm', title: 'Copy this device’s default style into this project', onclick: () => WM.useDefaults() }, 'Use device default')));
  }

  /** Renders into the bin's list element. Rebuilt only when another tab has replaced the list's content. */
  P.render = function (list) {
    if (!root || root.parentNode !== list) { root = build(); list.replaceChildren(root); }
    fields.forEach((f) => f.sync());
  };
  SE.act = SE.act || {};
  SE.act.openWatermark = function () { if (SE.bin) SE.bin.show('watermark'); };
})();
