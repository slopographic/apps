/* Slop Signature, the form: drawn from the model's FIELDS (one fieldset per group) plus the style controls (template,
 * colour, font, picture size, round picture) and a picture from this device (made small and kept in the signature).
 * Classic script. SlopSignature.form = { mount(host, state, onChange), fill(state), read() -> state }. */
(function (g) {
  'use strict';
  const NS = (g.SlopSignature = g.SlopSignature || {});
  const M = NS.model, UI = g.SlopUI, el = UI.el;
  const FONTS = [['Arial, Helvetica, sans-serif', 'Arial'], ['Helvetica, Arial, sans-serif', 'Helvetica'], ['Verdana, Geneva, sans-serif', 'Verdana'],
    ['Tahoma, Geneva, sans-serif', 'Tahoma'], ['Georgia, serif', 'Georgia'], ["'Times New Roman', Times, serif", 'Times New Roman'], ["'Trebuchet MS', sans-serif", 'Trebuchet MS']];
  const inputs = {};
  let changed = () => {};

  /** A picture from this device, drawn at most 240 px wide as PNG, as a data address the signature carries. */
  function shrink(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), im = new Image();
      im.onload = () => {
        const k = Math.min(1, 240 / Math.max(im.naturalWidth, 1)), c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k));
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        res(c.toDataURL('image/png'));
      };
      im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('That file is not a picture this browser can read')); };
      im.src = url;
    });
  }

  function fieldFor(f) {
    const attrs = { id: 'sg-' + f.key, class: 'sui-input', maxlength: f.max, placeholder: f.placeholder, autocomplete: 'off', oninput: () => changed() };
    const input = f.type === 'textarea' ? el('textarea', Object.assign({ rows: 3 }, attrs)) : el('input', Object.assign({ type: f.type === 'url' ? 'text' : f.type, inputmode: f.type === 'url' ? 'url' : undefined }, attrs));
    inputs[f.key] = input;
    return UI.field(f.label, input);
  }
  function pictureExtras() {
    const pick = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif', hidden: true });
    const msg = el('p', { class: 'sg-note', role: 'status' });
    pick.addEventListener('change', async () => {
      const f = pick.files && pick.files[0]; pick.value = '';
      if (!f) return;
      try { inputs.image.value = await shrink(f); msg.textContent = `${f.name} is kept inside the signature. Gmail does not show pictures kept this way: for Gmail, use a web address.`; changed(); } catch (e) { msg.textContent = e.message; }
    });
    inputs.imageSize = el('input', { id: 'sg-imageSize', type: 'range', min: 32, max: 160, step: 4, oninput: () => changed() });
    inputs.round = el('input', { id: 'sg-round', type: 'checkbox', onchange: () => changed() });
    return [el('div', { class: 'sg-row' }, el('button', { type: 'button', class: 'sui-btn', id: 'sgUpload', onclick: () => pick.click() }, 'Use a picture from this device…'), pick),
      msg, UI.field('Picture size', inputs.imageSize), el('label', { class: 'sg-check' }, inputs.round, ' Round (for a photo of you)')];
  }
  function styleBox() {
    const group = el('div', { class: 'sg-tpls', role: 'radiogroup', 'aria-label': 'Template', id: 'sgTemplates' });
    for (const [id, label] of NS.templates.LIST) {
      group.append(el('button', { type: 'button', role: 'radio', class: 'sg-tpl', 'data-tpl': id, 'aria-checked': 'false',
        onclick: () => { inputs.template.value = id; changed(); } }, label));
    }
    inputs.template = { value: 'classic' };
    inputs.accent = el('input', { id: 'sg-accent', type: 'color', oninput: () => changed() });
    inputs.font = UI.select(FONTS, FONTS[0][0]);
    inputs.font.id = 'sg-font'; inputs.font.addEventListener('change', () => changed());
    return el('fieldset', { class: 'sg-group' }, el('legend', null, 'Style'), group,
      el('div', { class: 'sg-row' }, UI.field('Colour', inputs.accent), UI.field('Font', inputs.font)));
  }

  function mount(host, state, onChange) {
    changed = onChange || changed;
    const sets = M.GROUPS.map(([id, title]) => el('fieldset', { class: 'sg-group', 'data-group': id }, el('legend', null, title),
      ...M.FIELDS.filter((f) => f.group === id).map(fieldFor), ...(id === 'picture' ? pictureExtras() : [])));
    host.replaceChildren(styleBox(), ...sets);
    fill(state);
  }
  function fill(state) {
    const s = Object.assign(M.blank(), state || {});
    for (const f of M.FIELDS) inputs[f.key].value = s[f.key] || '';
    inputs.template.value = s.template; inputs.accent.value = s.accent; inputs.font.value = s.font;
    inputs.imageSize.value = s.imageSize; inputs.round.checked = !!s.round;
    mark();
  }
  /** The chosen template's button shows as chosen. */
  function mark() {
    for (const b of document.querySelectorAll('#sgTemplates .sg-tpl')) b.setAttribute('aria-checked', String(b.dataset.tpl === inputs.template.value));
  }
  function read() {
    const s = {};
    for (const f of M.FIELDS) s[f.key] = inputs[f.key].value;
    Object.assign(s, { template: inputs.template.value, accent: inputs.accent.value, font: inputs.font.value, imageSize: Number(inputs.imageSize.value), round: inputs.round.checked });
    mark();
    return s;
  }

  NS.form = { mount, fill, read, FONTS };
})(typeof window !== 'undefined' ? window : globalThis);
