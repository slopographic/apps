/* PhotoSLOP UI: menubar, toolbox and options bar */
'use strict';

let openMenu = null;
function buildMenubar() {
  const bar = $('#menubar');
  for (const [name, items] of MENUS) {
    const btn = h('button', { class: 'mb-item', type: 'button', 'aria-haspopup': 'true' }, name);
    const list = () => (typeof items === 'function' ? items() : items);
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); if (openMenu && openMenu.btn === btn) closeMenus(); else showMenu(btn, list()); });
    btn.addEventListener('pointerenter', () => { if (openMenu && openMenu.btn !== btn) showMenu(btn, list()); });
    btn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); showMenu(btn, list(), true); } });
    bar.append(btn);
  }
  document.addEventListener('pointerdown', (e) => { if (openMenu && !e.target.closest('.menu, .mb-item')) closeMenus(); });
}
function closeMenus() { $$('.menu').forEach((m) => m.remove()); $$('.mb-item.open').forEach((b) => b.classList.remove('open')); openMenu = null; }
function menuEnabled(it) {
  if (it.en && !it.en()) return false;
  if (it.need === 'layer' && !activeLayer()) return false;
  return true;
}
function renderMenu(items, x, y, level) {
  const m = h('div', { class: 'menu', role: 'menu' });
  for (const it of items) {
    if (it === '-') { m.append(h('div', { class: 'menu-sep', role: 'separator' })); continue; }
    const en = it.sub ? true : menuEnabled(it);
    const row = h('button', { class: 'menu-row' + (it.sub ? ' has-sub' : ''), type: 'button', role: 'menuitem', disabled: !en },
      h('span', { class: 'menu-check' }, it.check ? (it.check() ? '✓' : '') : ''),
      h('span', { class: 'menu-label' }, it.dyn ? it.dyn() : it.label),
      h('span', { class: 'menu-key' }, it.sub ? '▸' : menuKey(it)));
    if (it.sub) {
      const openSub = () => {
        $$('.menu').filter((mm) => +mm.dataset.level > level).forEach((mm) => mm.remove());
        $$('.menu-row.sub-open', m).forEach((r) => r.classList.remove('sub-open'));
        row.classList.add('sub-open');
        const r = row.getBoundingClientRect();
        const sm = renderMenu(it.sub, r.right - 2, r.top - 4, level + 1);
        const sr = sm.getBoundingClientRect();
        if (sr.right > innerWidth) sm.style.left = Math.max(0, r.left - sr.width + 2) + 'px';
      };
      row.addEventListener('pointerenter', openSub);
      row.addEventListener('click', openSub);
      row.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') { openSub(); const f = $$('.menu').pop().querySelector('.menu-row:not([disabled])'); if (f) f.focus(); } });
    } else {
      row.addEventListener('pointerenter', () => { $$('.menu').filter((mm) => +mm.dataset.level > level).forEach((mm) => mm.remove()); });
      row.addEventListener('click', () => { closeMenus(); if (en) it.act(); });
    }
    m.append(row);
  }
  m.dataset.level = level;
  m.style.left = x + 'px'; m.style.top = y + 'px';
  m.addEventListener('keydown', (e) => {
    const rows = $$('.menu-row:not([disabled])', m), i = rows.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); (rows[i + 1] || rows[0]).focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); (rows[i - 1] || rows[rows.length - 1]).focus(); }
    else if (e.key === 'Escape' || e.key === 'ArrowLeft') { e.preventDefault(); if (level === 0) { const b = openMenu && openMenu.btn; closeMenus(); if (b) b.focus(); } else { m.remove(); } }
  });
  document.body.append(m);
  const r = m.getBoundingClientRect();
  if (r.bottom > innerHeight) m.style.top = Math.max(0, innerHeight - r.height - 4) + 'px';
  if (r.right > innerWidth) m.style.left = Math.max(0, innerWidth - r.width - 4) + 'px';
  return m;
}
function showMenu(btn, items, focus) {
  closeMenus();
  btn.classList.add('open');
  const r = btn.getBoundingClientRect();
  const m = renderMenu(items, r.left, r.bottom, 0);
  openMenu = { btn, m };
  if (focus) { const f = m.querySelector('.menu-row:not([disabled])'); if (f) f.focus(); }
}

/* ---------- toolbox ---------- */
function buildToolbox() {
  const box = $('#toolbox');
  const order = ['move', 'marquee', 'ellipse', 'lasso', 'polylasso', 'wand', 'crop', 'eyedropper', 'brush', 'pencil', 'clone', 'heal', 'spot', 'redeye', 'eraser', 'gradient', 'bucket', 'blur', 'sharpen', 'smudge', 'dodge', 'sponge', 'type', 'shape', 'hand', 'zoom'];
  const grid = h('div', { class: 'tools' });
  for (const id of order) {
    const t = TOOL[id];
    const b = h('button', { class: 'tool', type: 'button', 'data-tool': id, title: `${t.name} (${t.key})`, 'aria-label': t.name, html: t.icon });
    b.addEventListener('click', () => selectTool(id));
    grid.append(b);
  }
  const fg = h('button', { class: 'sw-fg', type: 'button', title: 'Set foreground colour', 'aria-label': 'Foreground colour' });
  const bg = h('button', { class: 'sw-bg', type: 'button', title: 'Set background colour', 'aria-label': 'Background colour' });
  const swap = h('button', { class: 'sw-swap', type: 'button', title: 'Swap colours (X)', 'aria-label': 'Swap colours', html: '<svg viewBox="0 0 12 12"><path d="M2 4h6l-2-2M10 8H4l2 2"/></svg>' });
  const def = h('button', { class: 'sw-def', type: 'button', title: 'Default colours (D)', 'aria-label': 'Default colours' }, h('i'), h('i'));
  fg.addEventListener('click', async () => { const c = await pickColorDialog('Color Picker (Foreground Color)', C.fg); if (c) setColor('fg', c); });
  bg.addEventListener('click', async () => { const c = await pickColorDialog('Color Picker (Background Color)', C.bg); if (c) setColor('bg', c); });
  swap.addEventListener('click', swapColors);
  def.addEventListener('click', defaultColors);
  box.append(grid, h('div', { class: 'swatches-fgbg' }, bg, fg, swap, def));
  const sync = () => {
    $$('.tool', box).forEach((b) => b.classList.toggle('active', b.dataset.tool === UI.tool && !TRANSFORM.active));
    fg.style.background = C.fg; bg.style.background = C.bg;
  };
  listeners.add((w) => { if (w === 'tool' || w === 'color') sync(); });
  sync();
}
function swapColors() { const f = C.fg; setColor('fg', C.bg); setColor('bg', f); }
function defaultColors() { setColor('fg', '#000000'); setColor('bg', '#ffffff'); }

/* ---------- options bar ---------- */
function optRange(label, obj, key, min, max, step = 1, fmt = (v) => v, toVal = (v) => v, fromVal = (v) => v) {
  const range = h('input', { type: 'range', min, max, step, value: fromVal(obj[key]), 'aria-label': label });
  const num = h('input', { type: 'number', min, max, step, value: fmt(fromVal(obj[key])), class: 'opt-num', 'aria-label': label });
  const set = (v) => { v = clamp(+v, min, max); obj[key] = toVal(v); range.value = v; if (document.activeElement !== num) num.value = fmt(v); saveToolOptions(); emit('options'); dirty(); };
  range.addEventListener('input', () => set(range.value));
  num.addEventListener('change', () => set(num.value));
  return h('label', { class: 'opt' }, h('span', null, label), range, num);
}
function optCheck(label, obj, key) {
  const c = h('input', { type: 'checkbox', checked: !!obj[key] });
  c.addEventListener('change', () => { obj[key] = c.checked; saveToolOptions(); emit('options'); });
  return h('label', { class: 'opt opt-check' }, c, h('span', null, label));
}
function optSelect(label, obj, key, options, onChange) {
  const s = h('select', { 'aria-label': label }, options.map(([v, l]) => h('option', { value: v, selected: obj[key] === v }, l)));
  s.addEventListener('change', () => { obj[key] = s.value; saveToolOptions(); emit('options'); if (onChange) onChange(); });
  return h('label', { class: 'opt' }, label ? h('span', null, label) : null, s);
}
function optSelMode() {
  const modes = [['replace', 'New selection', 'M3 3h12v12H3z'], ['add', 'Add to selection (Shift)', 'M3 3h9v9H3zM9 9h9v9H9z'], ['sub', 'Subtract from selection (Alt)', 'M3 3h9v9H3zM9 9h9v9H9z'], ['int', 'Intersect with selection (Shift+Alt)', 'M3 3h9v9H3zM9 9h9v9H9z']];
  const wrap = h('div', { class: 'opt seg', role: 'group', 'aria-label': 'Selection mode' });
  for (const [m, title, d] of modes) {
    const b = h('button', { type: 'button', class: 'seg-b' + (T.select.mode === m ? ' on' : ''), title, 'aria-label': title, html: `<svg viewBox="0 0 21 21" class="selmode-${m}"><path d="${d}"/></svg>` });
    b.addEventListener('click', () => { T.select.mode = m; saveToolOptions(); buildOptions(); });
    wrap.append(b);
  }
  return wrap;
}
const pct = (v) => Math.round(v);
function buildOptions() {
  const bar = $('#options'); bar.textContent = '';
  const t = currentTool();
  const icon = h('span', { class: 'opt-icon', html: t.icon || '' });
  bar.append(icon, h('span', { class: 'opt-name' }, t.name));
  const add = (...els) => bar.append(...els);
  if (TRANSFORM.active) {
    const tf = TRANSFORM;
    const n = (label, get, set, unit) => { const i = h('input', { type: 'number', class: 'opt-num wide', value: get(), step: 0.1 }); i.addEventListener('change', () => { set(+i.value); dirty(true); }); listeners.add((w) => { if (w === 'transform' && document.activeElement !== i) i.value = get(); }); return h('label', { class: 'opt' }, h('span', null, label), i, unit ? h('span', { class: 'opt-u' }, unit) : null); };
    add(n('X', () => Math.round(tf.cx + tf.tx), (v) => { tf.tx = v - tf.cx; }, 'px'), n('Y', () => Math.round(tf.cy + tf.ty), (v) => { tf.ty = v - tf.cy; }, 'px'),
      n('W', () => Math.round(tf.sx * 1000) / 10, (v) => { tf.sx = v / 100; }, '%'), n('H', () => Math.round(tf.sy * 1000) / 10, (v) => { tf.sy = v / 100; }, '%'),
      n('∠', () => Math.round((tf.rot * 180) / Math.PI * 10) / 10, (v) => { tf.rot = (v * Math.PI) / 180; }, '°'),
      optSelect('Interpolation', tf, 'interp', RESAMPLE_MODES, () => dirty(true)),
      h('span', { class: 'opt-spacer' }),
      h('button', { class: 'btn', type: 'button', onclick: cancelTransform, title: 'Cancel (Esc)' }, 'Cancel'),
      h('button', { class: 'btn primary', type: 'button', onclick: commitTransform, title: 'Commit (Enter)' }, 'Commit'));
    return;
  }
  const blendOpts = BLENDS.map((b) => [b[0], b[1]]);
  switch (t.id) {
    case 'brush': add(brushPickerButton(), optSelect('Tip', T.brush, 'tip', tipOptions(T.brush)), optRange('Size', T.brush, 'size', 1, 1000, 1, (v) => v + ''), optRange('Hardness', T.brush, 'hardness', 0, 100, 1, pct, (v) => v / 100, (v) => v * 100), optSelect('Mode', T.brush, 'blend', blendOpts), optRange('Opacity', T.brush, 'opacity', 1, 100, 1, pct, (v) => v / 100, (v) => v * 100), optRange('Flow', T.brush, 'flow', 1, 100, 1, pct, (v) => v / 100, (v) => v * 100), optCheck('Pen pressure', T.brush, 'pressure')); break;
    case 'pencil': add(optRange('Size', T.pencil, 'size', 1, 200), optRange('Opacity', T.pencil, 'opacity', 1, 100, 1, pct, (v) => v / 100, (v) => v * 100)); break;
    case 'eraser': add(brushPickerButton(), optSelect('Tip', T.eraser, 'tip', tipOptions(T.eraser)), optRange('Size', T.eraser, 'size', 1, 1000), optRange('Hardness', T.eraser, 'hardness', 0, 100, 1, pct, (v) => v / 100, (v) => v * 100), optRange('Opacity', T.eraser, 'opacity', 1, 100, 1, pct, (v) => v / 100, (v) => v * 100), optRange('Flow', T.eraser, 'flow', 1, 100, 1, pct, (v) => v / 100, (v) => v * 100), optCheck('Pen pressure', T.eraser, 'pressure')); break;
    case 'clone': add(optRange('Size', T.clone, 'size', 1, 1000), optRange('Hardness', T.clone, 'hardness', 0, 100, 1, pct, (v) => v / 100, (v) => v * 100), optRange('Opacity', T.clone, 'opacity', 1, 100, 1, pct, (v) => v / 100, (v) => v * 100), optCheck('Aligned', T.clone, 'aligned'), optCheck('Sample all layers', T.clone, 'sampleAll'), h('span', { class: 'opt-hint' }, isMac ? '⌥-click to set the source' : 'Alt-click to set the source')); break;
    case 'heal': add(brushPickerButton(), optRange('Size', T.heal, 'size', 1, 1000), optRange('Hardness', T.heal, 'hardness', 0, 100, 1, pct, (v) => v / 100, (v) => v * 100), optRange('Opacity', T.heal, 'opacity', 1, 100, 1, pct, (v) => v / 100, (v) => v * 100), optCheck('Aligned', T.heal, 'aligned'), optCheck('Sample all layers', T.heal, 'sampleAll'), h('span', { class: 'opt-hint' }, isMac ? '⌥-click to set the source, then paint' : 'Alt-click to set the source, then paint')); break;
    case 'spot': add(brushPickerButton(), optRange('Size', T.spot, 'size', 1, 1000), optRange('Hardness', T.spot, 'hardness', 0, 100, 1, pct, (v) => v / 100, (v) => v * 100), optRange('Opacity', T.spot, 'opacity', 1, 100, 1, pct, (v) => v / 100, (v) => v * 100), h('span', { class: 'opt-hint' }, 'Paint over a blemish: the source is picked from the clean ring around it')); break;
    case 'redeye': add(optRange('Tolerance', T.redeye, 'tol', 0, 100, 1, pct, (v) => v, (v) => v), optRange('Darkening', T.redeye, 'dark', 0, 100, 1, pct, (v) => v, (v) => v), h('span', { class: 'opt-hint' }, 'Drag around the eye (a click corrects a square). Works inside the selection.')); break;
    case 'blur': case 'sharpen': { const o = T[t.id]; add(brushPickerButton(), optRange('Size', o, 'size', 1, 500), optRange('Hardness', o, 'hardness', 0, 100, 1, pct, (v) => v / 100, (v) => v * 100), optRange('Strength', o, 'strength', 1, 100, 1, pct, (v) => v / 100, (v) => v * 100)); break; }
    case 'sponge': add(brushPickerButton(), optSelect('', T.sponge, 'mode', [['saturate', 'Saturate'], ['desaturate', 'Desaturate']]), optRange('Size', T.sponge, 'size', 1, 500), optRange('Flow', T.sponge, 'flow', 1, 100, 1, pct, (v) => v / 100, (v) => v * 100)); break;
    case 'smudge': add(optRange('Size', T.smudge, 'size', 1, 500), optRange('Strength', T.smudge, 'strength', 1, 100, 1, pct, (v) => v / 100, (v) => v * 100)); break;
    case 'dodge': add(optSelect('', T.dodge, 'mode', [['dodge', 'Dodge (lighten)'], ['burn', 'Burn (darken)']]), optRange('Size', T.dodge, 'size', 1, 1000), optRange('Exposure', T.dodge, 'exposure', 1, 100, 1, pct, (v) => v / 100, (v) => v * 100)); break;
    case 'marquee': case 'ellipse': case 'lasso': case 'polylasso': add(optSelMode(), optRange('Feather', T.select, 'feather', 0, 250, 1, (v) => v), h('span', { class: 'opt-hint' }, t.id === 'polylasso' ? 'Click points · double-click or Enter to close' : 'Drag inside a selection to move it')); break;
    case 'wand': add(optSelMode(), optRange('Tolerance', T.wand, 'tol', 0, 255), optCheck('Contiguous', T.wand, 'contiguous'), optCheck('Sample all layers', T.wand, 'sampleAll')); break;
    case 'bucket': add(optRange('Tolerance', T.bucket, 'tol', 0, 255), optRange('Opacity', T.bucket, 'opacity', 1, 100, 1, pct, (v) => v / 100, (v) => v * 100), optCheck('Contiguous', T.bucket, 'contiguous'), optCheck('All layers', T.bucket, 'sampleAll')); break;
    case 'gradient': add(optSelect('', T.gradient, 'type', [['linear', 'Linear'], ['radial', 'Radial'], ['reflected', 'Reflected'], ['angle', 'Angle']]), optSelect('', T.gradient, 'mode', [['fgbg', 'Foreground → Background'], ['fgt', 'Foreground → Transparent'], ['slop', 'Slop Green'], ['spectrum', 'Spectrum']]), optCheck('Reverse', T.gradient, 'reverse'), optRange('Opacity', T.gradient, 'opacity', 1, 100, 1, pct, (v) => v / 100, (v) => v * 100)); break;
    case 'shape': add(optSelect('', T.shape, 'kind', [['rect', 'Rectangle'], ['rounded', 'Rounded Rectangle'], ['ellipse', 'Ellipse'], ['polygon', 'Polygon'], ['star', 'Star'], ['heart', 'Heart'], ['line', 'Line']], buildOptions), optCheck('Fill (fg)', T.shape, 'fill'), optCheck('Stroke', T.shape, 'stroke'), optRange('Stroke', T.shape, 'strokeW', 1, 200)); if (T.shape.kind === 'rounded') add(optRange('Radius', T.shape, 'radius', 0, 500)); if (T.shape.kind === 'polygon' || T.shape.kind === 'star') add(optRange('Sides', T.shape, 'sides', 3, 40)); break;
    case 'type': buildTypeOptions(add); break;
    case 'move': add(optCheck('Auto-select layer', T.move, 'auto'), h('span', { class: 'opt-hint' }, 'Drag to move · arrow keys nudge · Ctrl+T to transform')); break;
    case 'crop': add(optCheck('Delete cropped pixels', T.crop, 'del'), h('span', { class: 'opt-spacer' }), h('button', { class: 'btn', type: 'button', onclick: () => { TOOL.crop.activate(); dirty(); } }, 'Reset'), h('button', { class: 'btn primary', type: 'button', onclick: () => TOOL.crop.apply() }, 'Crop')); break;
    case 'eyedropper': add(optSelect('Sample size', T.eyedrop, 'size', [[1, 'Point'], [3, '3 × 3 average'], [5, '5 × 5 average'], [11, '11 × 11 average']].map(([v, l]) => [String(v), l])), optCheck('All layers', T.eyedrop, 'all')); break;
    case 'hand': case 'zoom': add(h('button', { class: 'btn', type: 'button', onclick: () => actualPixels() }, '100%'), h('button', { class: 'btn', type: 'button', onclick: () => fitView() }, 'Fit Screen')); break;
  }
  if (t.id === 'eyedropper') { const s = bar.querySelector('select'); s.value = String(T.eyedrop.size); s.onchange = () => { T.eyedrop.size = +s.value; saveToolOptions(); }; }
}
