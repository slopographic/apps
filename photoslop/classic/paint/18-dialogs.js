/* Slop Paint, part 18: dialog framework, message boxes, About and Help.
 * Split from the old paint.js (one IIFE). Loaded in order by index.html; state and helpers are shared through window.SlopPaint (P). */
(() => {
'use strict';
const P = window.SlopPaint;
const { $, $$, S, applyImage, blackAndWhite, cancelOp, clamp, finishPending, flipH, flipV, h, main, mctx, pushUndo, rotate, savePNG, setCanvasSize, setZoom, stretchSkew, win } = P;

/* =====================================================================
 * Dialogs
 * ===================================================================== */
const xSvg = '<svg viewBox="0 0 8 7" width="8" height="7"><path d="M0 0h2l2 2 2-2h2v1L5 3.5 8 6v1H6L4 5 2 7H0V6l3-2.5L0 1z"/></svg>';
function openDialog({ title, content, buttons, width = 320, init }) {
  return new Promise(resolve => {
    P.closeMenus(); P.closeStart();
    const prevFocus = document.activeElement;
    const back = h('div', { class: 'modal-back' });
    const close = h('button', { class: 'tbtn close', type: 'button', 'aria-label': 'Close', html: xSvg });
    const tb = h('div', { class: 'titlebar' }, h('span', { class: 'ttl', text: title }), close);
    const body = h('div', { class: 'dlg-body' }, content);
    const row = h('div', { class: 'btnrow' });
    const dlg = h('div', { class: 'win dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': title, tabindex: '-1', style: { '--w': width + 'px' } }, tb, body, row);
    let defBtn = null;
    const done = v => {
      back.remove();
      document.removeEventListener('keydown', onKey, true);
      win.classList.remove('inactive');
      if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true });
      resolve(v);
    };
    for (const b of buttons) {
      const btn = h('button', { class: 'btn' + (b.default ? ' default' : ''), type: 'button', text: b.label });
      btn.addEventListener('click', () => { if (b.validate && !b.validate()) return; done(b.value); });
      if (b.default) defBtn = btn;
      row.append(btn);
    }
    close.addEventListener('click', () => done(null));
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(null); return; }
      if (e.key === 'Enter' && defBtn && !(e.target instanceof HTMLButtonElement) && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT') { e.preventDefault(); defBtn.click(); return; }
      if (e.key === 'Tab') {
        const f = $$('button, input:not([disabled]), select, a[href], [tabindex="0"]', dlg).filter(x => x.offsetParent !== null);
        if (!f.length) return;
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
      e.stopPropagation();
    }
    document.addEventListener('keydown', onKey, true);
    back.append(dlg);
    document.body.append(back);
    win.classList.add('inactive');
    // center, then make draggable by the title bar
    const place = () => {
      const r = dlg.getBoundingClientRect();
      dlg.style.left = Math.max(6, (innerWidth - r.width) / 2) + 'px';
      dlg.style.top = Math.max(6, (innerHeight - r.height) / 2.4) + 'px';
    };
    place();
    tb.addEventListener('pointerdown', e => {
      if (e.target.closest('button')) return;
      const r = dlg.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
      tb.setPointerCapture(e.pointerId);
      const mv = ev => { dlg.style.left = clamp(ev.clientX - ox, -r.width + 60, innerWidth - 60) + 'px'; dlg.style.top = clamp(ev.clientY - oy, 0, innerHeight - 30) + 'px'; };
      const up = () => { tb.removeEventListener('pointermove', mv); tb.removeEventListener('pointerup', up); };
      tb.addEventListener('pointermove', mv); tb.addEventListener('pointerup', up);
    });
    if (init) init(dlg);
    const first = $('input:not([disabled]):not([type=radio]), input[type=radio]:checked, select', body);
    (first || defBtn || dlg).focus({ preventScroll: true });
    if (first && first.select) first.select();
  });
}
const ICON_SVG = {
  warn: '<svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2L31 29H1z" fill="#ffd400" stroke="#000" stroke-width="1.5"/><rect x="14.5" y="10" width="3" height="11" fill="#000"/><rect x="14.5" y="23" width="3" height="3" fill="#000"/></svg>',
  question: '<svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><path d="M4 3h24v18H13l-7 7v-7H4z" fill="#fff" stroke="#000" stroke-width="1.5"/><text x="16" y="18" text-anchor="middle" font-family="Times New Roman, serif" font-weight="bold" font-size="15" fill="#0000c0">?</text></svg>',
  info: '<svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14" fill="#fff" stroke="#000" stroke-width="1.5"/><rect x="14" y="13" width="4" height="11" fill="#0000c0"/><rect x="14" y="7" width="4" height="4" fill="#0000c0"/></svg>',
  slop: '<svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2S5 14 5 21a11 11 0 0 0 22 0C27 14 16 2 16 2z" fill="#d4ff3a" stroke="#000" stroke-width="1.5"/><path d="M10.5 21.5a5.5 5.5 0 0 0 4.5 5" fill="none" stroke="#fff" stroke-width="2"/></svg>',
};
function msgBox(message, buttons = ['OK'], icon = 'info', title = 'Slop Paint') {
  const content = h('div', { class: 'msg-wrap', html: ICON_SVG[icon] || '' }, h('p', { text: message }));
  return openDialog({ title, content, width: 360, buttons: buttons.map((b, i) => ({ label: b, value: b, default: i === 0 })) });
}
async function attributesDialog() {
  const content = h('div', { html: `
    <div class="row"><span>File last saved:</span><span>Not Available (it's slop)</span></div>
    <div class="row" style="margin-bottom:12px"><span>Size on disk:</span><span>Not Available</span></div>
    <div class="field-row" style="margin-bottom:12px">
      <label for="atW"><u>W</u>idth:</label><input id="atW" type="number" min="1" max="6000" value="${S.w}">
      <label for="atH"><u>H</u>eight:</label><input id="atH" type="number" min="1" max="6000" value="${S.h}">
    </div>
    <fieldset><legend>Units</legend><div class="row">
      <label class="disabled"><input type="radio" name="atU" disabled>Inches</label>
      <label class="disabled"><input type="radio" name="atU" disabled>Cm</label>
      <label><input type="radio" name="atU" checked>Pels</label></div></fieldset>
    <fieldset><legend>Colors</legend><div class="row">
      <label><input type="radio" name="atC" id="atBW">Black and white</label>
      <label><input type="radio" name="atC" checked>Colors</label></div></fieldset>` });
  const r = await openDialog({ title: 'Attributes', content, width: 300, buttons: [
    { label: 'OK', value: 'ok', default: true }, { label: 'Cancel', value: null },
    { label: 'Default', value: 'default' },
  ] });
  if (!r) return;
  if (P.st.op) cancelOp();
  finishPending();
  let w = +$('#atW', content).value, hh = +$('#atH', content).value;
  if (r === 'default') { w = 800; hh = 500; }
  if (!(w >= 1 && hh >= 1)) { msgBox('Please enter a whole number between 1 and 6000.\nEven slop has limits.', ['OK'], 'warn'); return; }
  w = clamp(Math.round(w), 1, 6000); hh = clamp(Math.round(hh), 1, 6000);
  const bw = $('#atBW', content).checked;
  if (w !== S.w || hh !== S.h || bw) {
    pushUndo();
    if (w !== S.w || hh !== S.h) setCanvasSize(w, hh);
    if (bw) { const o = blackAndWhite(main); mctx.drawImage(o, 0, 0); }
  }
}
async function flipRotateDialog() {
  const content = h('div', { html: `
    <fieldset><legend>Flip or rotate</legend>
      <div class="row"><label><input type="radio" name="fr" value="h" checked>Flip <u>h</u>orizontal</label></div>
      <div class="row"><label><input type="radio" name="fr" value="v">Flip <u>v</u>ertical</label></div>
      <div class="row"><label><input type="radio" name="fr" value="r">Rotate by angle</label></div>
      <div class="indent">
        <div class="row"><label><input type="radio" name="deg" value="90" checked>90°</label></div>
        <div class="row"><label><input type="radio" name="deg" value="180">180°</label></div>
        <div class="row"><label><input type="radio" name="deg" value="270">270°</label></div>
      </div>
    </fieldset>` });
  $$('input[name=deg]', content).forEach(i => i.addEventListener('change', () => { $('input[value=r]', content).checked = true; }));
  const r = await openDialog({ title: 'Flip and Rotate', content, width: 260, buttons: [{ label: 'OK', value: 'ok', default: true }, { label: 'Cancel', value: null }] });
  if (!r) return;
  const m = $('input[name=fr]:checked', content).value, deg = +$('input[name=deg]:checked', content).value;
  applyImage(c => m === 'h' ? flipH(c) : m === 'v' ? flipV(c) : rotate(c, deg));
}
async function stretchSkewDialog() {
  const content = h('div', { html: `
    <fieldset><legend>Stretch</legend><div class="field-row">
      <label for="ssH">Horizontal:</label><span><input id="ssH" type="number" value="100" min="1" max="500"> %</span>
      <label for="ssV">Vertical:</label><span><input id="ssV" type="number" value="100" min="1" max="500"> %</span></div></fieldset>
    <fieldset><legend>Skew</legend><div class="field-row">
      <label for="skH">Horizontal:</label><span><input id="skH" type="number" value="0" min="-89" max="89"> Degrees</span>
      <label for="skV">Vertical:</label><span><input id="skV" type="number" value="0" min="-89" max="89"> Degrees</span></div></fieldset>` });
  const r = await openDialog({ title: 'Stretch and Skew', content, width: 290, buttons: [{ label: 'OK', value: 'ok', default: true }, { label: 'Cancel', value: null }] });
  if (!r) return;
  const v = id => +$(id, content).value || 0;
  const sx = clamp(v('#ssH') || 100, 1, 500), sy = clamp(v('#ssV') || 100, 1, 500), kx = clamp(v('#skH'), -89, 89), ky = clamp(v('#skV'), -89, 89);
  const big = (S.w * sx / 100) * (S.h * sy / 100);
  if (big > 36e6) { msgBox('That is too much slop, even for us.', ['OK'], 'warn'); return; }
  applyImage(c => stretchSkew(c, sx, sy, kx, ky));
}
async function customZoomDialog() {
  const content = h('div', { html: `<div class="row" style="margin-bottom:10px">Current zoom: ${S.zoom * 100}%</div>
    <fieldset><legend>Zoom to</legend><div class="field-row" style="grid-template-columns:auto auto">
      ${[1, 2, 4, 6, 8].map(z => `<label><input type="radio" name="cz" value="${z}" ${z === S.zoom ? 'checked' : ''}>${z * 100}%</label>`).join('')}
    </div></fieldset>` });
  const r = await openDialog({ title: 'Custom Zoom', content, width: 240, buttons: [{ label: 'OK', value: 'ok', default: true }, { label: 'Cancel', value: null }] });
  if (r) setZoom(+$('input[name=cz]:checked', content).value);
}
async function saveAsDialog() {
  const content = h('div', { html: `<div class="field-row" style="grid-template-columns:auto 1fr">
      <label for="saN">File <u>n</u>ame:</label><input id="saN" type="text" value="${S.fileName.replace(/"/g, '')}" maxlength="80" style="width:100%">
      <label for="saT">Save as <u>t</u>ype:</label><select id="saT"><option>PNG (*.png) — premium slop</option></select></div>` });
  const r = await openDialog({ title: 'Save As', content, width: 360, buttons: [{ label: 'Save', value: 'ok', default: true }, { label: 'Cancel', value: null }] });
  if (!r) return;
  const n = ($('#saN', content).value || 'untitled').replace(/[\\/:*?"<>|]+/g, '').trim() || 'untitled';
  savePNG(n);
}
function aboutDialog() {
  const content = h('div', { class: 'about', html: `
    <div class="logo">${ICON_SVG.slop.replace(/width="32" height="32"/, 'width="56" height="56"')}</div>
    <div>
      <p class="big">Slop Paint</p>
      <p>Version 98.0.5L0P (Build 1998)<br>Copyright © 1998–2026 slopographic.com</p>
      <hr>
      <p>This product is licensed to:<br>&nbsp;&nbsp;Whoever is holding the mouse<br>&nbsp;&nbsp;Department of Pixels</p>
      <hr>
      <p>Hand-made pixels. Machine-made drips.<br>No AI was harmed in the making of this program.</p>
      <p>Physical memory available to Slop Paint: 640 KB (plenty)<br>System resources: 98% Free</p>
      <p><a href="../../">slopographic.com</a> · more slop where this came from</p>
    </div>` });
  return openDialog({ title: 'About Slop Paint', content, width: 400, buttons: [{ label: 'OK', value: 'ok', default: true }] });
}
function helpDialog() {
  const content = h('div', { html: `
    <ul class="helplist">
      <li><b>Left button</b> draws with the primary color, <b>right button</b> with the secondary color. On touch, long-press a palette color to set the secondary.</li>
      <li><b>Shift</b> makes perfect squares and circles, and snaps lines to 45°.</li>
      <li><b>Curve:</b> drag a straight line, then click (or drag) twice to bend it.</li>
      <li><b>Polygon:</b> drag the first side, click to add corners, double-click (or click the start) to finish.</li>
      <li><b>Select:</b> drag to select, drag inside to move, Ctrl+drag to leave a copy, drag the blue handles to stretch. Delete clears it.</li>
      <li><b>Ctrl+C / Ctrl+X / Ctrl+V</b> copy, cut and paste. You can also paste images from other apps.</li>
      <li><b>Text:</b> click or drag a box, type, pick the font in the Fonts toolbar, click outside to stamp it down.</li>
      <li>Drag the little blue handles at the canvas edges to resize it.</li>
      <li>Drop an image file onto the window to open it.</li>
      <li><b>Ctrl+Z / Ctrl+Y</b> undo and redo. <b>Ctrl+mouse wheel</b> zooms. Two fingers scroll on touch screens.</li>
      <li>Double-click a palette color to edit it. Click the color well to swap colors.</li>
      <li><b>Slop Brush</b> drips, <b>Slop Stamp</b> stamps emoji, <b>Image → SLOPIFY</b> deep-fries the picture (Ctrl+Z undoes it).</li>
    </ul>` });
  return openDialog({ title: 'Slop Paint Help Topics', content, width: 440, buttons: [{ label: 'OK', value: 'ok', default: true }] });
}

Object.assign(P, { aboutDialog, attributesDialog, customZoomDialog, flipRotateDialog, helpDialog, msgBox, openDialog, saveAsDialog, stretchSkewDialog });
})();
