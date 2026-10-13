/* PhotoSlop watermark panel: the on switch, text or logo, and the placement and look. Every change is live: the page
 * preview repaints at once and the next export uses the same settings. Styles: css/watermark.css. */
'use strict';

const WM_POS_LABEL = { tl: 'Top left', tc: 'Top centre', tr: 'Top right', ml: 'Middle left', mc: 'Centre', mr: 'Middle right', bl: 'Bottom left', bc: 'Bottom centre', br: 'Bottom right' };
const WM_LOGO_TYPES = 'image/png,image/jpeg,image/webp,image/svg+xml';

function buildWatermarkPanel() {
  const on = h('input', { type: 'checkbox', id: 'wmOn' });
  const state = h('p', { class: 'wm-state', 'aria-live': 'polite' });
  const kind = h('select', { 'aria-label': 'Watermark type' }, h('option', { value: 'text' }, 'Text'), h('option', { value: 'logo' }, 'Logo'));
  const text = h('input', { type: 'text', 'aria-label': 'Watermark text', spellcheck: 'false' });
  const pick = h('button', { type: 'button', class: 'sui-btn' }, 'Choose image…');
  const clear = h('button', { type: 'button', class: 'sui-btn' }, 'Remove');
  const logoState = h('span', { class: 'wm-logo-state' });
  const size = h('input', { type: 'range', min: 1, max: 25, step: 0.5, 'aria-label': 'Watermark size' }), sizeOut = h('span', { class: 'fp-u' });
  const opacity = h('input', { type: 'range', min: 0, max: 100, step: 1 }), opacityOut = h('span', { class: 'fp-u' });
  const margin = h('input', { type: 'range', min: 0, max: 20, step: 0.5 }), marginOut = h('span', { class: 'fp-u' });
  const rotate = h('input', { type: 'range', min: -180, max: 180, step: 1 }), rotateOut = h('span', { class: 'fp-u' });
  const colour = h('input', { type: 'color', 'aria-label': 'Watermark colour' });
  const shadow = h('input', { type: 'checkbox' }), tile = h('input', { type: 'checkbox' });
  const grid = h('div', { class: 'wm-pos', role: 'group', 'aria-label': 'Position' }), posBtns = {};
  for (const p of SlopWatermark.POSITIONS) {
    const b = h('button', { type: 'button', class: 'wm-pos-btn', 'aria-label': WM_POS_LABEL[p], title: WM_POS_LABEL[p], 'aria-pressed': 'false' }, h('i'));
    b.addEventListener('click', () => wmSet({ position: p }));
    posBtns[p] = b; grid.append(b);
  }
  const row = (label, el, out) => field(label, el, out || null);
  const textRow = row('Text', text), logoRow = h('div', { class: 'wm-logo' }, pick, clear, logoState);
  const sizeRow = row('Size', size, sizeOut), opRow = row('Opacity', opacity, opacityOut);
  const rotRow = row('Rotation', rotate, rotateOut), mgRow = row('Margin', margin, marginOut);
  const colourRow = row('Colour', colour), shadowRow = h('label', { class: 'field opt-check' }, shadow, h('span', null, 'Shadow'));
  const tileRow = h('label', { class: 'field opt-check' }, tile, h('span', null, 'Tile across the page'));
  const actions = h('div', { class: 'wm-actions' },
    h('button', { type: 'button', class: 'sui-btn' }, 'Save as default'), h('button', { type: 'button', class: 'sui-btn' }, 'Reset to default'));
  const root = h('div', { class: 'wm-panel' }, h('label', { class: 'field opt-check wm-switch' }, on, h('span', null, 'Watermark on')), state,
    row('Type', kind), textRow, logoRow, sizeRow, opRow, h('div', { class: 'field' }, h('span', { class: 'field-l' }, 'Position'), grid),
    tileRow, rotRow, mgRow, colourRow, shadowRow, actions);
  const num = (v, d) => String(Math.round(v * 10 ** d) / 10 ** d);

  on.addEventListener('change', () => wmSetOn(on.checked));
  kind.addEventListener('change', () => wmSet({ kind: kind.value }));
  text.addEventListener('input', () => wmSet({ text: text.value }));
  size.addEventListener('input', () => wmSet(wmState().cfg.kind === 'logo' ? { logoScale: +size.value / 100 } : { size: +size.value / 100 }));
  opacity.addEventListener('input', () => wmSet({ opacity: +opacity.value / 100 }));
  margin.addEventListener('input', () => wmSet({ margin: +margin.value / 100 }));
  rotate.addEventListener('input', () => wmSet({ rotate: +rotate.value }));
  colour.addEventListener('input', () => wmSet({ colour: colour.value }));
  shadow.addEventListener('change', () => wmSet({ shadow: shadow.checked }));
  tile.addEventListener('change', () => wmSet({ tile: tile.checked }));
  pick.addEventListener('click', () => SlopUI.pickFiles({ accept: WM_LOGO_TYPES }).then(async (files) => {
    if (files && files[0]) await wmSetLogo(files[0]).catch((e) => toast(e.message, 4200));
  }).catch(() => { /* the picker was closed */ }));
  clear.addEventListener('click', () => wmClearLogo());
  actions.children[0].addEventListener('click', () => wmSaveDefaults());
  actions.children[1].addEventListener('click', () => wmResetStyle());

  // Shows the document's settings. A control being edited keeps what the person typed.
  const put = (el, v) => { if (document.activeElement !== el && el.value !== String(v)) el.value = String(v); };
  const sync = () => {
    const s = wmState(), c = s.cfg, logo = c.kind === 'logo', pct = logo ? 100 : 25;
    on.checked = !!s.on;
    state.textContent = s.on ? 'On: added to exports and shown on the page.' : 'Off: exports and the page show no watermark.';
    kind.value = logo ? 'logo' : 'text';
    put(text, c.text || '');
    textRow.hidden = logo; logoRow.hidden = !logo; shadowRow.hidden = logo; colourRow.hidden = logo;
    logoState.textContent = c.logo ? 'Logo set' : 'No logo chosen';
    clear.disabled = !c.logo;
    size.max = pct; put(size, num(logo ? c.logoScale * 100 : c.size * 100, 1)); sizeOut.textContent = num(+size.value, 1) + '%';
    put(opacity, Math.round(c.opacity * 100)); opacityOut.textContent = Math.round(c.opacity * 100) + '%';
    put(margin, num(c.margin * 100, 1)); marginOut.textContent = num(c.margin * 100, 1) + '%';
    put(rotate, Math.round(c.rotate)); rotateOut.textContent = Math.round(c.rotate) + '°';
    put(colour, c.colour); shadow.checked = !!c.shadow; tile.checked = !!c.tile;
    for (const p of Object.keys(posBtns)) posBtns[p].setAttribute('aria-pressed', String(p === c.position));
  };
  listeners.add((w) => { if (w === 'watermark' || w === 'doc' || w === 'docname') sync(); });
  sync();
  return root;
}
