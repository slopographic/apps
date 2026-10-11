/* PhotoSLOP UI: document dialogs, themes and keyboard */
'use strict';

/* ---------- misc dialogs ---------- */
function dlgNumber(title, label, v, min, max, unit, fn) {
  const i = numInput(v, min, max, 0.5);
  dialog({ title, body: field(label, i, unit), buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, act: () => fn(clamp(+i.value, min, max)) }] });
}
const PRESETS = [['PhotoSLOP default', 1600, 1000], ['Instagram post', 1080, 1080], ['Instagram story', 1080, 1920], ['HD 1080p', 1920, 1080], ['4K UHD', 3840, 2160], ['Twitter / X header', 1500, 500], ['A4 @150ppi', 1240, 1754], ['Meme (classic)', 800, 800], ['Icon', 512, 512]];
function dlgNew() {
  const w = numInput(1600, 1, 12000), hh = numInput(1000, 1, 12000);
  const preset = h('select', null, PRESETS.map(([n, a, b], i) => h('option', { value: i }, `${n} — ${a} × ${b}`)), h('option', { value: 'clip' }, 'Clipboard size'));
  preset.addEventListener('change', () => { if (preset.value === 'clip') { if (CLIP.canvas) { w.value = CLIP.canvas.width; hh.value = CLIP.canvas.height; } return; } const p = PRESETS[+preset.value]; w.value = p[1]; hh.value = p[2]; });
  const bg = h('select', null, [['#ffffff', 'White'], ['#000000', 'Black'], ['fg', 'Foreground colour'], ['bg', 'Background colour'], ['transparent', 'Transparent']].map(([v, l]) => h('option', { value: v }, l)));
  const name = h('input', { type: 'text', value: 'Untitled' });
  dialog({ title: 'New Document', body: h('div', { class: 'form' }, field('Name', name), field('Preset', preset), field('Width', w, 'px'), field('Height', hh, 'px'), field('Background', bg)),
    buttons: [{ label: 'Cancel' }, { label: 'Create', primary: true, act: () => {
      const b = bg.value === 'fg' ? C.fg : bg.value === 'bg' ? C.bg : bg.value;
      newDocTab(clamp(+w.value || 1, 1, 12000), clamp(+hh.value || 1, 1, 12000), b, name.value || 'Untitled');
    } }] });
}
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
  const w = numInput(D.w, 1, 12000), hh = numInput(D.h, 1, 12000), st = { ax: 1, ay: 1 };
  dialog({ title: 'Canvas Size', body: h('div', { class: 'form' }, h('p', { class: 'dlg-p' }, `Current size: ${D.w} × ${D.h} px`), field('Width', w, 'px'), field('Height', hh, 'px'), h('div', { class: 'field' }, h('span', { class: 'field-l' }, 'Anchor'), anchorGrid(st))),
    buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, act: () => { const nw = clamp(+w.value || 1, 1, 12000), nh = clamp(+hh.value || 1, 1, 12000); resizeCanvas(nw, nh, Math.round(((nw - D.w) * st.ax) / 2), Math.round(((nh - D.h) * st.ay) / 2)); fitView(); } }] });
}
function dlgImageSize() {
  const w = numInput(D.w, 1, 12000), hh = numInput(D.h, 1, 12000), lock = h('input', { type: 'checkbox', checked: true }), smooth = h('select', null, h('option', { value: '1' }, 'Bicubic (smooth)'), h('option', { value: '0' }, 'Nearest Neighbor (hard edges)'));
  const ratio = D.w / D.h;
  w.addEventListener('input', () => { if (lock.checked) hh.value = Math.max(1, Math.round(+w.value / ratio)); });
  hh.addEventListener('input', () => { if (lock.checked) w.value = Math.max(1, Math.round(+hh.value * ratio)); });
  dialog({ title: 'Image Size', body: h('div', { class: 'form' }, field('Width', w, 'px'), field('Height', hh, 'px'), h('label', { class: 'field opt-check' }, lock, h('span', null, 'Constrain proportions')), field('Resample', smooth)),
    buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, act: () => { imageSize(clamp(+w.value || 1, 1, 12000), clamp(+hh.value || 1, 1, 12000), smooth.value === '1'); fitView(); } }] });
}
function dlgLayerProps() {
  const L = activeLayer(); if (!L) return;
  const name = h('input', { type: 'text', value: L.name });
  dialog({ title: 'Layer Properties', body: h('div', { class: 'form' }, field('Name', name)), buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, act: () => setLayerProps(L.id, { name: name.value || L.name }, 'Layer Properties') }] });
}
function dlgStroke() {
  const w = numInput(4, 1, 250), pos = h('select', null, h('option', { value: 'center' }, 'Center'), h('option', { value: 'inside' }, 'Inside'), h('option', { value: 'outside' }, 'Outside'));
  dialog({ title: 'Stroke', body: h('div', { class: 'form' }, field('Width', w, 'px'), field('Location', pos), h('p', { class: 'dlg-p' }, 'Uses the foreground colour.')),
    buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, act: () => {
      const r = clamp(+w.value, 1, 250), path = selectionPath(D.sel), c = mkCanvas(D.w, D.h), g = cx(c);
      g.strokeStyle = C.fg; g.lineWidth = pos.value === 'center' ? r : r * 2; g.lineJoin = 'round'; g.stroke(path);
      if (pos.value !== 'center') { g.globalCompositeOperation = pos.value === 'inside' ? 'destination-in' : 'destination-out'; g.drawImage(D.sel.mask, 0, 0); }
      fillSelection(c, 'Stroke', 1, 'normal', true);
    } }] });
}
function dlgColorRange() {
  const tol = h('input', { type: 'range', min: 0, max: 200, value: 40 });
  dialog({ title: 'Color Range', body: h('div', { class: 'form' }, h('p', { class: 'dlg-p' }, `Selects pixels close to the foreground colour ${C.fg} across the whole image.`), field('Fuzziness', tol)),
    buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, act: () => {
      const src = flattenCanvas(), d = cxr(src).getImageData(0, 0, D.w, D.h).data, [r, g, b] = hexToRgb(C.fg), f = +tol.value;
      const m = mkCanvas(D.w, D.h), mg = cxr(m), img = mg.createImageData(D.w, D.h), o = img.data;
      for (let i = 0; i < d.length; i += 4) { const dist = Math.max(Math.abs(d[i] - r), Math.abs(d[i + 1] - g), Math.abs(d[i + 2] - b)); o[i + 3] = d[i + 3] && dist <= f ? clamp((1 - dist / (f + 1)) * 2, 0, 1) * 255 : 0; }
      mg.putImageData(img, 0, 0); D.sel = makeSel(m); commit('Color Range');
      if (!D.sel) toast('No pixels matched');
    } }] });
}
function dlgShortcuts() {
  const rows = [];
  const walk = (items, path) => { for (const it of items) { if (it === '-' || !it) continue; if (it.sub) walk(it.sub, path + ' › ' + it.label); else if (it.key) rows.push([path + ' › ' + it.label, it.key]); } };
  MENUS.forEach(([n, items]) => walk(typeof items === 'function' ? items() : items, n));
  const toolRows = TOOLS.map((t) => [t.name, t.key + (TOOLS.filter((x) => x.key === t.key).length > 1 ? ' (Shift+' + t.key + ' cycles)' : '')]);
  const extra = [['Pan', 'Space + drag · middle mouse · two fingers'], ['Zoom', 'Ctrl/⌘ + wheel · pinch'], ['Brush size', '[ and ]'], ['Brush hardness', 'Shift+[ and Shift+]'], ['Tool opacity', '1 … 0'], ['Swap colours', 'X'], ['Default colours', 'D'], ['Nudge layer (Move tool)', 'Arrow keys · Shift = 10px'], ['Commit / cancel (Transform, Crop, Type)', 'Enter / Esc']];
  const table = (list) => h('table', { class: 'keys' }, list.map(([a, b]) => h('tr', null, h('td', null, a), h('td', null, h('kbd', null, keyLabel(b))))));
  dialog({ title: 'Keyboard Shortcuts', cls: 'dlg-wide', body: h('div', { class: 'keys-wrap' }, h('div', null, h('h4', null, 'Tools'), table(toolRows), h('h4', null, 'Canvas'), table(extra)), h('div', null, h('h4', null, 'Menus'), table(rows))), buttons: [{ label: 'Close', primary: true }] });
}
function dlgAbout() {
  dialog({ title: 'About PhotoSLOP', body: h('div', { class: 'about' },
    h('p', { class: 'about-logo' }, 'PhotoSLOP'),
    h('p', null, 'A layered image editor that runs entirely in your browser. Nothing you open, paint or save ever leaves your device: there is no server, no account and no upload.'),
    h('p', null, 'Opens and saves real Photoshop .psd files (layers, masks, opacity and blend modes), exports PNG, JPEG and WebP, and can be downloaded as a single offline .html file.'),
    h('p', { class: 'dlg-p' }, 'Part of ', h('a', { href: '../' }, 'slopographic.com'), '. Prefer the 1998 experience? ', h('a', { href: 'classic/' }, 'Slop Paint Classic'), '.')),
  buttons: [{ label: 'Close', primary: true }] });
}

/* ---------- themes ---------- */
const theme = () => document.documentElement.dataset.theme || 'pro';
function setTheme(t) { document.documentElement.dataset.theme = t; store.set('theme', t); const m = $('meta[name=theme-color]'); if (m) m.content = t === 'paint' ? '#008080' : t === 'light' ? '#e8e8e8' : '#1d1d1d'; dirty(); emit('theme'); }

/* ---------- keyboard ---------- */
const TOOL_KEYS = {};
for (const t of TOOLS) (TOOL_KEYS[t.key] = TOOL_KEYS[t.key] || []).push(t.id);
function onKeyDown(e) {
  if (SlopUI.openDialogs || isTyping(e.target)) return;
  if (e.code === 'Space' && !e.repeat) { V.space = true; V.el.classList.add('space'); e.preventDefault(); return; }
  const combo = comboOf(e);
  const t = currentTool();
  if (t.onKey && t.onKey(e)) { e.preventDefault(); dirty(); return; }
  if (openMenu && e.key === 'Escape') { closeMenus(); return; }
  if (e.key === 'Escape' && D.sel && !(TE.el)) { /* Photoshop keeps the selection on Esc */ }
  const item = SHORTCUTS.get(combo) || (combo === 'Ctrl+Y' ? SHORTCUTS.get('Shift+Ctrl+Z') : null) || (combo === 'Alt+Ctrl+Z' ? SHORTCUTS.get('Ctrl+Z') : null) || (combo === 'Backspace' ? SHORTCUTS.get('Delete') : null) || (combo === 'Ctrl+Shift+=' || combo === 'Shift+Ctrl+=' ? SHORTCUTS.get('Ctrl+=') : null);
  if (item) {
    if (combo === 'Ctrl+V' || combo === 'Shift+Ctrl+V') { armPasteCatcher(); return; } // the native paste event carries system images
    if (combo === 'Ctrl+C' || combo === 'Ctrl+X') { e.preventDefault(); item.act(); return; }
    if (!menuEnabled(item)) { e.preventDefault(); return; }
    e.preventDefault(); closeMenus(); item.act(); return;
  }
  if (e.altKey && !e.ctrlKey && !e.metaKey && /^Digit[1-9]$/.test(e.code)) { const r = DOCS[+e.code.slice(5) - 1]; if (r) { e.preventDefault(); switchToDoc(r); } return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = combo.replace('Shift+', '');
  if (TOOL_KEYS[k] && !e.repeat) {
    const ids = TOOL_KEYS[k];
    if (e.shiftKey && ids.includes(UI.tool)) selectTool(ids[(ids.indexOf(UI.tool) + 1) % ids.length]);
    else selectTool(ids.includes(store.get('lastOf.' + k)) ? store.get('lastOf.' + k) : ids[0]);
    e.preventDefault(); return;
  }
  const o = BRUSH_OPTS()[UI.tool];
  if (o && (e.code === 'BracketLeft' || e.code === 'BracketRight')) {
    const up = e.code === 'BracketRight';
    if (e.shiftKey && o.hardness != null) o.hardness = clamp(Math.round((o.hardness + (up ? 0.25 : -0.25)) * 4) / 4, 0, 1);
    else { const s = o.size, step = s < 10 ? 1 : s < 50 ? 5 : s < 100 ? 10 : s < 300 ? 25 : 50; o.size = clamp(s + (up ? step : -step), 1, 1000); }
    saveToolOptions(); buildOptions(); dirty(); e.preventDefault(); return;
  }
  if (/^Digit\d$/.test(e.code) && o && o.opacity != null) { const n = +e.code.slice(5); o.opacity = n === 0 ? 1 : n / 10; saveToolOptions(); buildOptions(); toast(`Opacity ${Math.round(o.opacity * 100)}%`, 900); return; }
  if (combo === 'X') { swapColors(); return; }
  if (combo === 'D') { defaultColors(); return; }
  if (UI.tool === 'move' && e.key.startsWith('Arrow')) {
    const n = e.shiftKey ? 10 : 1, dx = e.key === 'ArrowLeft' ? -n : e.key === 'ArrowRight' ? n : 0, dy = e.key === 'ArrowUp' ? -n : e.key === 'ArrowDown' ? n : 0;
    nudge(dx, dy); e.preventDefault();
  }
}
function onKeyUp(e) { if (e.code === 'Space') { V.space = false; V.el.classList.remove('space'); } }
listeners.add((w) => { if (w === 'tool') { const t = TOOL[UI.tool]; if (t) store.set('lastOf.' + t.key, t.id); buildOptions(); V.el.style.cursor = ''; } });
