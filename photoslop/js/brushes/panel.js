/* PhotoSlop brushes: Brushes panel and Brush Settings */
'use strict';

/* ---------- Brushes panel ---------- */
const previewCache = new Map();
function buildBrushesPanel() {
  const wrap = h('div', { class: 'bp-panel' });
  const render = () => {
    wrap.textContent = '';
    const cur = brushTarget().preset;
    for (const pack of allPacks()) {
      if (!pack.brushes.length && !pack.mine) continue;
      const head = h('div', { class: 'bpk-head' }, h('span', null, pack.name), h('span', { class: 'bpk-n' }, pack.brushes.length));
      if (!pack.builtin) {
        const ex = h('button', { type: 'button', class: 'bpk-btn', title: 'Export this pack (.slopbrush)' }, '⇩'); ex.addEventListener('click', () => exportPack(pack));
        const del = h('button', { type: 'button', class: 'bpk-btn', title: 'Remove this pack' }, '×'); del.addEventListener('click', async () => { if (await SlopUI.confirm('Remove brush pack?', `Remove “${pack.name}” and its ${pack.brushes.length} brushes from this device?`, 'Remove', { danger: true })) { customPacks = customPacks.filter((p) => p !== pack); await saveBrushPacks(); emit('brushes'); } });
        head.append(ex, del);
      }
      const grid = h('div', { class: 'bpk-grid' });
      for (const b of pack.brushes) {
        const key = pack.name + '|' + b.name + '|' + theme();
        if (!previewCache.has(key)) previewCache.set(key, presetPreview(b));
        const btn = h('button', { type: 'button', class: 'bpk-b' + (cur === b.name ? ' on' : ''), title: `${b.name} · ${b.size}px` }, previewCache.get(key), h('span', null, b.name));
        btn.addEventListener('click', () => applyPreset(b));
        ctxTarget(btn, 'brush', () => [{ label: 'Use', act: () => applyPreset(b) }, { label: 'Brush Settings…', act: () => { applyPreset(b); dlgBrushSettings(); } }, !pack.builtin ? { label: 'Delete brush', act: async () => { pack.brushes.splice(pack.brushes.indexOf(b), 1); await saveBrushPacks(); emit('brushes'); } } : null]);
        grid.append(btn);
      }
      wrap.append(head, grid);
    }
  };
  const bar = h('div', { class: 'bp-bar' },
    h('button', { type: 'button', class: 'btn', onclick: () => SlopUI.pickFiles({ accept: '.abr,.slopbrush,.json,image/*', multiple: true }).then(importBrushFiles), title: 'Photoshop .abr, PNG/JPEG tips, .slopbrush packs' }, 'Import…'),
    h('button', { type: 'button', class: 'btn', onclick: () => dlgBrushSettings() }, 'Settings…'),
    h('button', { type: 'button', class: 'btn', onclick: () => defineBrushFromSelection(), title: 'Make a brush from the selection (or the whole image)' }, 'From selection'));
  listeners.add((w) => { if (w === 'brushes' || w === 'theme') render(); });
  render();
  return h('div', null, bar, wrap);
}

/* ---------- Brush Settings ---------- */
function dlgBrushSettings() {
  const o = brushTarget();
  Object.keys(DYN).forEach((k) => { if (o[k] === undefined) o[k] = DYN[k]; });
  const prev = h('canvas', { class: 'bs-preview', width: 520, height: 140 });
  const draw = () => {
    const g = cx(prev); g.clearRect(0, 0, prev.width, prev.height);
    g.fillStyle = theme() === 'pro' ? '#1a1a1a' : '#ffffff'; g.fillRect(0, 0, prev.width, prev.height);
    const d = makeDabber(Object.assign({}, o, { size: Math.min(o.size, 90) }), theme() === 'pro' ? '#e8e8e8' : '#111111', false);
    const st = new Stroker(() => d.spacing(1), (x, y, pr) => d.dab(g, x, y, pr));
    const pt = (t) => ({ x: 40 + t * 440, y: 70 + Math.sin(t * Math.PI * 2) * 38, pressure: 1 });
    st.begin(pt(0)); for (let i = 1; i <= 60; i++) st.to(pt(i / 60));
  };
  const rows = [];
  const range = (label, key, min, max, step, fmt = (v) => v, toV = (v) => v, fromV = (v) => v) => {
    const r = h('input', { type: 'range', min, max, step, value: fromV(o[key]) }), n = h('span', { class: 'bs-v' }, fmt(fromV(o[key])));
    r.addEventListener('input', () => { o[key] = toV(+r.value); n.textContent = fmt(+r.value); o.preset = null; saveToolOptions(); draw(); });
    rows.push(h('label', { class: 'bs-row' }, h('span', null, label), r, n));
  };
  const pctF = (v) => Math.round(v) + '%';
  range('Size', 'size', 1, 1000, 1, (v) => v + 'px');
  range('Hardness', 'hardness', 0, 100, 1, pctF, (v) => v / 100, (v) => v * 100);
  range('Spacing', 'spacing', 1, 300, 1, pctF, (v) => v / 100, (v) => v * 100);
  range('Angle', 'angle', -180, 180, 1, (v) => v + '°');
  range('Roundness', 'roundness', 5, 100, 1, pctF, (v) => v / 100, (v) => v * 100);
  range('Flow', 'flow', 1, 100, 1, pctF, (v) => v / 100, (v) => v * 100);
  range('Size jitter', 'sizeJitter', 0, 100, 1, pctF, (v) => v / 100, (v) => v * 100);
  range('Angle jitter', 'angleJitter', 0, 100, 1, pctF, (v) => v / 100, (v) => v * 100);
  range('Scatter', 'scatter', 0, 300, 1, pctF, (v) => v / 100, (v) => v * 100);
  range('Count', 'count', 1, 6, 1);
  range('Opacity jitter', 'opacityJitter', 0, 100, 1, pctF, (v) => v / 100, (v) => v * 100);
  range('Hue jitter', 'hueJitter', 0, 100, 1, pctF, (v) => v / 100, (v) => v * 100);
  const tipSel = SlopUI.select(tipOptions(o), o.tip || 'round');
  tipSel.addEventListener('change', () => { o.tip = tipSel.value; o.preset = null; saveToolOptions(); draw(); });
  const follow = SlopUI.check('Angle follows the stroke', o.follow); follow.input.addEventListener('change', () => { o.follow = follow.input.checked; draw(); saveToolOptions(); });
  const pop = SlopUI.check('Pen pressure controls opacity', o.pressureOpacity); pop.input.addEventListener('change', () => { o.pressureOpacity = pop.input.checked; saveToolOptions(); });
  const body = h('div', { class: 'bs' }, prev, SlopUI.field('Tip', tipSel), h('div', { class: 'bs-grid' }, rows), h('div', { class: 'bs-checks' }, follow.el, pop.el));
  draw();
  SlopUI.dialog({ title: 'Brush Settings', cls: 'sui-wide bs-dlg', body, buttons: [
    { label: 'Save as Preset…', act: async () => {
      const name = await SlopUI.prompt('New Brush Preset', 'Name', o.preset || 'My Brush'); if (name == null) return false;
      const b = Object.assign({}, o, { name: name || 'My Brush' }); delete b.preset; delete b.pressure; delete b.blend;
      if (b.tip === 'image') b.image = maskToDataURL(TIP_IMAGES.get(b.tipImage));
      myBrushes().brushes.push(b); await saveBrushPacks(); o.preset = b.name; emit('brushes'); toast(`Saved “${b.name}”`);
      return false;
    } },
    { label: 'Done', primary: true },
  ], onClose: () => { buildOptions(); emit('brushes'); } });
}
