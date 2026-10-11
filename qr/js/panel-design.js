/* QR SLOP: the Design tab (colours, gradient, shape, background, quiet zone, size, error correction) and the Logo tab
 * (a picture file, a drop, built-in marks, the logo width). Each control reports to the app through a callback.
 * Classic script; exposes window.QRPanelDesign. */
(function (g) {
  'use strict';
  if (g.QRPanelDesign) return;
  const E = (tag, attrs, ...kids) => g.SlopUI.el(tag, attrs, ...kids);
  const UI = () => g.SlopUI;

  /** The design controls. st is the style object; change(key, value) on every change. */
  function drawDesign(host, st, change) {
    const fg = E('input', { type: 'color', value: st.fg, 'aria-label': 'Module colour' });
    const fg2 = E('input', { type: 'color', value: st.fg2, 'aria-label': 'Gradient end colour', disabled: !st.gradient });
    const grad = UI().check('Use a gradient', st.gradient);
    const shape = UI().select([['square', 'Square modules'], ['round', 'Rounded modules']], st.shape);
    const bg = E('input', { type: 'color', value: st.bg, 'aria-label': 'Background colour', disabled: !!st.transparent });
    const tr = UI().check('Transparent background', st.transparent);
    const quiet = E('input', { type: 'range', min: '0', max: '8', step: '1', value: String(st.quiet), 'aria-label': 'Quiet zone' });
    const quietOut = E('output', null, st.quiet + ' modules');
    const size = UI().number(st.size, 64, 4096, 1);
    size.setAttribute('aria-label', 'Size in pixels');
    const ec = UI().select([['L', 'L (7%)'], ['M', 'M (15%)'], ['Q', 'Q (25%)'], ['H', 'H (30%)']], st.ec);
    const ecNote = E('p', { class: 'qr-note' });

    const sync = () => {
      fg2.disabled = !st.gradient; bg.disabled = !!st.transparent;
      ec.disabled = !!g.QRState.S.logo.href;
      ec.value = g.QRState.S.logo.href ? 'H' : st.ec;
      ecNote.textContent = g.QRState.S.logo.href ? 'Set to H while a logo is in the centre, so the code still scans.' : 'Higher levels survive more damage but make a denser code.';
    };
    fg.addEventListener('input', () => change('fg', fg.value));
    fg2.addEventListener('input', () => change('fg2', fg2.value));
    grad.input.addEventListener('change', () => { st.gradient = grad.input.checked; change('gradient', st.gradient); sync(); });
    shape.addEventListener('change', () => change('shape', shape.value));
    bg.addEventListener('input', () => change('bg', bg.value));
    tr.input.addEventListener('change', () => { st.transparent = tr.input.checked; change('transparent', st.transparent); sync(); });
    quiet.addEventListener('input', () => { quietOut.textContent = quiet.value + ' modules'; change('quiet', +quiet.value); });
    size.addEventListener('input', () => change('size', +size.value));
    ec.addEventListener('change', () => { st.ec = ec.value; change('ec', ec.value); });
    host.replaceChildren(
      E('div', { class: 'qr-grid2' },
        UI().field('Module colour', fg), UI().field('Gradient end colour', fg2),
        UI().field('Modules', shape), UI().field('Background colour', bg),
        UI().field('Quiet zone', E('span', { class: 'qr-range' }, quiet, quietOut)),
        UI().field('Size (px)', size), UI().field('Error correction', ec)),
      grad.el, tr.el, ecNote);
    sync();
  }

  /** The logo tab. act = { file(File), mark(id), remove(), width(fraction) }. The current logo, if any, is shown. */
  function drawLogo(host, logo, act) {
    const input = E('input', { type: 'file', accept: 'image/*', hidden: true, 'aria-label': 'Logo image file' });
    const drop = E('div', { class: 'qr-drop', role: 'button', tabindex: '0', 'aria-label': 'Choose a logo image, or drop one here' },
      E('b', null, 'Drop an image here'), E('span', null, 'or choose a file: PNG, JPEG, WebP or SVG'), input);
    const open = () => input.click();
    drop.addEventListener('click', (e) => { if (e.target !== input) open(); });
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    input.addEventListener('change', () => { if (input.files && input.files[0]) act.file(input.files[0]); input.value = ''; });
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('qr-drop-on'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('qr-drop-on'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault(); drop.classList.remove('qr-drop-on');
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) act.file(f);
    });
    const marks = E('div', { class: 'qr-marks', role: 'group', 'aria-label': 'Built-in marks' },
      g.QRLogo.marks().map((m) => {
        const b = E('button', { type: 'button', class: 'qr-mark', 'aria-label': m.name, title: m.name, onclick: () => act.mark(m.id) });
        b.innerHTML = m.svg;
        return b;
      }));
    const frac = E('input', { type: 'range', min: '10', max: '22', step: '1', value: String(Math.round(g.QRRender.clampLogo(logo.frac) * 100)), 'aria-label': 'Logo width' });
    const fracOut = E('output', null, Math.round(g.QRRender.clampLogo(logo.frac) * 100) + '%');
    frac.addEventListener('input', () => { fracOut.textContent = frac.value + '%'; act.width(+frac.value / 100); });
    const current = logo.href
      ? E('div', { class: 'qr-logo-now' }, E('img', { src: logo.href, alt: '', width: 44, height: 44 }),
        E('span', null, logo.name || (logo.mark ? 'Built-in: ' + logo.mark : 'Logo')),
        E('button', { type: 'button', class: 'sui-btn', onclick: () => act.remove() }, 'Remove logo'))
      : E('p', { class: 'qr-note' }, 'No logo yet. The code has no picture in its centre.');
    host.replaceChildren(
      E('p', { class: 'qr-note' }, 'A logo sits in the centre on a white plate. Error correction is set to H, the highest, so the code still scans.'),
      drop, E('span', { class: 'qr-label' }, 'Built-in marks'), marks, current,
      UI().field('Logo width (share of the code, at most 22%)', E('span', { class: 'qr-range' }, frac, fracOut)),
      E('p', { class: 'qr-note' }, 'Keep the logo at most 22% of the code width, and test the printed code with a phone before you use it.'));
  }

  g.QRPanelDesign = Object.freeze({ drawDesign, drawLogo });
})(typeof window !== 'undefined' ? window : globalThis);
