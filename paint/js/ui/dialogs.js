/* PhotoSLOP UI: keyboard labels, dialogs and the colour picker */
'use strict';

const MOD = isMac ? '⌘' : 'Ctrl+';
const keyLabel = (k) => (isMac ? k.replace(/Ctrl\+/g, '⌘').replace(/Alt\+/g, '⌥').replace(/Shift\+/g, '⇧') : k);
const MODIFIERS = ['Ctrl', 'Alt', 'Shift'];
function normCombo(s) {
  const parts = s.split('+').map((p) => p.trim()).filter(Boolean);
  const key = parts.pop();
  return MODIFIERS.filter((m) => parts.includes(m)).concat([key.length === 1 ? key.toUpperCase() : key]).join('+');
}
const CODE_KEY = { BracketLeft: '[', BracketRight: ']', Equal: '=', Minus: '-', Quote: "'", Slash: '/', Backslash: '\\', Semicolon: ';', Comma: ',', Period: '.', Backquote: '`', Space: 'Space', NumpadAdd: '=', NumpadSubtract: '-' };
function comboOf(e) {
  let k = e.code.startsWith('Key') ? e.code.slice(3) : e.code.startsWith('Digit') ? e.code.slice(5) : e.code.startsWith('Numpad') && /\d/.test(e.code.slice(6)) ? e.code.slice(6) : CODE_KEY[e.code] || e.key;
  if (k && k.length === 1) k = k.toUpperCase();
  const mods = [];
  if (e.ctrlKey || e.metaKey) mods.push('Ctrl');
  if (e.altKey) mods.push('Alt');
  if (e.shiftKey) mods.push('Shift');
  return mods.concat([k]).join('+');
}

/* ---------- dialogs ---------- */
/* Dialogs come from the shared SlopUI kit (../shared/slopui.js), so PhotoSLOP, Slop Vector and Slop PDF share them. */
const CLS_MAP = { 'dlg-wide': 'sui-wide', 'dlg-color': 'sui-narrow', 'dlg-filter': 'sui-filter', 'dlg-curve': 'sui-curve' };
function dialog({ title, body, buttons = [], onClose, cls = '' }) {
  const parts = cls.split(/\s+/).filter(Boolean);
  const dock = parts.includes('dlg-filter') ? 'right' : undefined;
  return SlopUI.dialog({ title, body, buttons, onClose, dock, modal: !dock, cls: parts.map((c) => CLS_MAP[c] || c).join(' ') });
}
function field(label, input, unit) { return h('label', { class: 'field' }, h('span', { class: 'field-l' }, label), input, unit ? h('span', { class: 'field-u' }, unit) : null); }
function numInput(v, min, max, step = 1) { return h('input', { type: 'number', value: v, min, max, step, inputmode: 'decimal' }); }
const alertDlg = (title, msg) => SlopUI.alert(title, msg);
const confirmDlg = (title, msg, ok = 'OK') => SlopUI.confirm(title, msg, ok);

/* ---------- colour picker ---------- */
function colorPicker(get, set) {
  const sv = h('canvas', { class: 'cp-sv', width: 200, height: 140 }), hue = h('canvas', { class: 'cp-hue', width: 200, height: 12 });
  const hex = h('input', { class: 'cp-hex', type: 'text', maxlength: 7, spellcheck: 'false', 'aria-label': 'Hex colour' });
  const rgb = ['R', 'G', 'B'].map((c) => h('input', { type: 'number', min: 0, max: 255, 'aria-label': c, class: 'cp-n' }));
  const el = h('div', { class: 'cp' }, sv, hue, h('div', { class: 'cp-row' }, h('span', null, '#'), hex, ...rgb.flatMap((i, k) => [h('span', null, 'RGB'[k]), i])));
  let H = 0, S = 0, Vv = 0;
  function fromHex(hx) { const [r, g, b] = hexToRgb(hx); const [hh, s, v] = rgbToHsv(r, g, b); if (s > 0 && v > 0) H = hh; S = s; Vv = v; }
  function render() {
    const g = sv.getContext('2d'), w = sv.width, hh = sv.height;
    const [r, gg, b] = hsvToRgb(H, 1, 1);
    g.fillStyle = `rgb(${r},${gg},${b})`; g.fillRect(0, 0, w, hh);
    let gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, hh);
    gr = g.createLinearGradient(0, 0, 0, hh); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, w, hh);
    g.strokeStyle = Vv > 0.5 && S < 0.5 ? '#000' : '#fff'; g.lineWidth = 1.5; g.beginPath(); g.arc(S * w, (1 - Vv) * hh, 5, 0, Math.PI * 2); g.stroke();
    const hg = hue.getContext('2d'), hgr = hg.createLinearGradient(0, 0, hue.width, 0);
    for (let i = 0; i <= 6; i++) { const [a, bb, c] = hsvToRgb((i * 60) % 360, 1, 1); hgr.addColorStop(i / 6, `rgb(${a},${bb},${c})`); }
    hg.fillStyle = hgr; hg.fillRect(0, 0, hue.width, hue.height);
    const x = (H / 360) * hue.width; hg.fillStyle = '#fff'; hg.fillRect(x - 1.5, 0, 3, hue.height); hg.strokeStyle = '#000'; hg.strokeRect(x - 2, 0, 4, hue.height);
    const cur = get();
    if (document.activeElement !== hex) hex.value = cur.slice(1);
    const c = hexToRgb(cur); rgb.forEach((i, k) => { if (document.activeElement !== i) i.value = c[k]; });
  }
  function push() { const [r, g, b] = hsvToRgb(H, S, Vv); set(rgbToHex(r, g, b)); render(); }
  const drag = (canvas, fn) => canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    const go = (ev) => { const r = canvas.getBoundingClientRect(); fn(clamp((ev.clientX - r.left) / r.width, 0, 1), clamp((ev.clientY - r.top) / r.height, 0, 1)); push(); };
    go(e); canvas.onpointermove = go; canvas.onpointerup = () => { canvas.onpointermove = null; };
  });
  drag(sv, (x, y) => { S = x; Vv = 1 - y; });
  drag(hue, (x) => { H = x * 359.9; });
  hex.addEventListener('input', () => { if (/^[0-9a-f]{6}$/i.test(hex.value) || /^[0-9a-f]{3}$/i.test(hex.value)) { set(rgbToHex(...hexToRgb(hex.value))); fromHex(get()); render(); } });
  rgb.forEach((i) => i.addEventListener('input', () => { set(rgbToHex(...rgb.map((x) => clamp(+x.value || 0, 0, 255)))); fromHex(get()); render(); }));
  fromHex(get()); render();
  return { el, sync() { fromHex(get()); render(); } };
}
function pickColorDialog(title, initial) {
  return new Promise((res) => {
    let cur = initial;
    const cp = colorPicker(() => cur, (v) => { cur = v; sw.style.background = v; });
    const sw = h('div', { class: 'cp-preview' }); sw.style.background = cur;
    const old = h('div', { class: 'cp-preview old', title: 'Original — click to restore', onclick: () => { cur = initial; cp.sync(); sw.style.background = cur; } }); old.style.background = initial;
    dialog({ title, cls: 'dlg-color', body: h('div', { class: 'cp-dlg' }, cp.el, h('div', { class: 'cp-compare' }, h('span', null, 'new'), sw, old, h('span', null, 'current'))), buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true }], onClose: (ok) => res(ok ? cur : null) });
  });
}
