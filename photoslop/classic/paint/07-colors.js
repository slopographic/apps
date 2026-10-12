/* Slop Paint, part 07: primary and secondary colours and the palette.
 * Split from the old paint.js (one IIFE). Loaded in order by index.html; state and helpers are shared through window.SlopPaint (P). */
(() => {
'use strict';
const P = window.SlopPaint;
const { $, PALETTE, S, h, status } = P;

/* =====================================================================
 * Colors
 * ===================================================================== */
function setColor(which, hex) {
  if (which === 2) S.secondary = hex; else S.primary = hex;
  $('#ccFg').style.background = S.primary;
  $('#ccBg').style.background = S.secondary;
  if (P.st.text) P.styleTextBox();
  if (P.st.sel && P.st.sel.canvas && S.transparent) P.renderFloating();
}
function renderPalette() {
  const pal = $('#palette');
  pal.textContent = '';
  PALETTE.forEach((c, i) => {
    let lp = 0;
    const b = h('button', { class: 'sw', type: 'button', 'aria-label': `Color ${c}`, title: 'Left-click: primary · Right-click: menu · Double-click: edit', style: { background: c } });
    b.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      const prev = S.primary;
      setColor(0, PALETTE[i]);
      if (e.pointerType === 'touch') {
        clearTimeout(lp);
        lp = setTimeout(() => { setColor(0, prev); setColor(2, PALETTE[i]); status('Secondary color set. Long-press = right-click.'); if (navigator.vibrate) navigator.vibrate(15); }, 550);
      }
    });
    const stop = () => clearTimeout(lp);
    b.addEventListener('pointerup', stop); b.addEventListener('pointerleave', stop); b.addEventListener('pointercancel', stop);
    b.addEventListener('click', e => { if (e.detail === 0) setColor(0, PALETTE[i]); });
    b.addEventListener('dblclick', () => editSwatch(i));
    b.addEventListener('contextmenu', e => e.preventDefault());
    pal.append(b);
  });
}
async function editSwatch(i) {
  const res = await P.editColorsDialog(PALETTE[i]);
  if (!res) return;
  PALETTE[i] = res;
  renderPalette();
  setColor(0, res);
}

Object.assign(P, { editSwatch, renderPalette, setColor });
})();
