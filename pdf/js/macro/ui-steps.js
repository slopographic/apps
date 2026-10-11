/* Slop PDF macros — the step editor: one card per step, with the fields that each step type needs. Uses SlopUI. */
(function () {
  'use strict';
  var M = window.SlopPdfMacro = window.SlopPdfMacro || {};
  var UI = M.ui = M.ui || {};
  var S = function () { return window.SlopUI; };
  function el(tag, attrs) {
    var kids = Array.prototype.slice.call(arguments, 2);
    return S().el.apply(null, [tag, attrs].concat(kids));
  }

  /** The input for one field. set(value) stores the raw value; M.normalizeStep checks it later. */
  UI.fieldInput = function (f, value, set) {
    var ui = S();
    switch (f.t) {
      case 'bool': {
        var c = ui.check(f.label, value);
        c.input.addEventListener('change', function () { set(c.input.checked); });
        return c.el;
      }
      case 'select': {
        var sel = ui.select((f.opts || []).map(function (o) { return [String(o[0]), o[1]]; }), String(value));
        sel.addEventListener('change', function () { set(sel.value); });
        return ui.field(f.label, sel);
      }
      case 'num': {
        var n = ui.number(value, f.min, f.max, f.int ? 1 : 'any');
        n.addEventListener('input', function () { set(n.value); });
        return ui.field(f.label, n);
      }
      case 'colour': {
        var col = el('input', { type: 'color', class: 'spm-colour', value: /^#[0-9a-f]{6}$/i.test(String(value)) ? value : '#000000', 'aria-label': f.label });
        col.addEventListener('input', function () { set(col.value); });
        return ui.field(f.label, col);
      }
      case 'pages': {
        var pg = el('input', { class: 'sui-input', type: 'text', value: value || '', placeholder: 'all, 1-3, last', autocomplete: 'off', spellcheck: 'false' });
        pg.addEventListener('input', function () { set(pg.value); });
        return ui.field(f.label, pg);
      }
      case 'image': return UI.imageField(f, value, set);
    }
    var t = el('input', { class: 'sui-input', type: 'text', value: value == null ? '' : value, maxlength: f.max || null, autocomplete: 'off' });
    t.addEventListener('input', function () { set(t.value); });
    return ui.field(f.label, t);
  };

  /** Picks a PNG or JPEG for a stamp. The image is kept as a data URL inside the macro. */
  UI.imageField = function (f, value, set) {
    var thumb = el('img', { class: 'spm-thumb', alt: '', src: value || '', hidden: !value });
    var file = el('input', { type: 'file', accept: 'image/png,image/jpeg', 'aria-label': f.label });
    var clear = el('button', { type: 'button', class: 'spm-btn', disabled: !value }, 'Remove');
    file.addEventListener('change', function () {
      var pick = file.files && file.files[0];
      if (!pick) return;
      if (!/^image\/(png|jpeg)$/.test(pick.type)) { S().toast('Choose a PNG or JPEG image.'); file.value = ''; return; }
      var rd = new FileReader();
      rd.onload = function () { set(String(rd.result)); thumb.src = String(rd.result); thumb.hidden = false; clear.disabled = false; };
      rd.readAsDataURL(pick);
    });
    clear.addEventListener('click', function () { set(''); thumb.removeAttribute('src'); thumb.hidden = true; file.value = ''; clear.disabled = true; });
    return el('div', { class: 'sui-field spm-wide' }, el('span', { class: 'sui-label' }, f.label), el('div', { class: 'spm-row' }, file, clear), thumb);
  };

  /**
   * One step card. cb: { set(key, value), changeType(type), move(delta), remove() }.
   * n is the number of steps; i the 0-based index.
   */
  UI.stepCard = function (step, i, n, cb) {
    var def = M.STEP_TYPES[step.type] || { label: 'Unknown step', fields: [] };
    var typeSel = S().select(M.TYPE_ORDER.map(function (t) { return [t, M.STEP_TYPES[t].label]; }), step.type);
    typeSel.setAttribute('aria-label', 'Step type');
    typeSel.addEventListener('change', function () { cb.changeType(typeSel.value); });
    var up = el('button', { type: 'button', class: 'spm-btn', 'aria-label': 'Move step up', disabled: i === 0, onclick: function () { cb.move(-1); } }, '↑');
    var down = el('button', { type: 'button', class: 'spm-btn', 'aria-label': 'Move step down', disabled: i >= n - 1, onclick: function () { cb.move(1); } }, '↓');
    var del = el('button', { type: 'button', class: 'spm-btn spm-danger', 'aria-label': 'Remove step', onclick: function () { cb.remove(); } }, '✕');
    var grid = el('div', { class: 'spm-grid' });
    def.fields.forEach(function (f) {
      grid.append(UI.fieldInput(f, step[f.k], function (v) { cb.set(f.k, v); }));
    });
    return el('div', { class: 'spm-step', 'data-step': i },
      el('div', { class: 'spm-step-head' }, el('span', { class: 'spm-step-no' }, (i + 1) + '.'), typeSel, up, down, del),
      grid);
  };
})();
