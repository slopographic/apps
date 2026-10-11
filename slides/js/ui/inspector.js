/* Slop Slides: the inspector panel (Keynote style: Format / Animate / Document tabs) and its control kit. Panels
   register with I.tab(id, render) and rebuild when the selection, slide or document changes. */
(function () {
  'use strict';
  var SS = window.SS, A = SS.app, D = SS.dom, TH = SS.themes, U = SS.util;
  var I = SS.inspector = { tabs: {}, cur: U.store.get('tab', 'format') };

  I.init = function (host) {
    I.host = host;
    I.bar = D.h('div', { class: 'insp-tabs', role: 'tablist' });
    I.body = D.h('div', { class: 'insp-body' });
    host.append(I.bar, I.body);
    [['format', 'Format', 'format'], ['animate', 'Animate', 'animate'], ['document', 'Document', 'document']].forEach(function (t) {
      var b = D.h('button', { type: 'button', role: 'tab', class: 'insp-tab', 'data-tab': t[0], html: D.icon(t[2]) + '<span>' + t[1] + '</span>' });
      b.addEventListener('click', function () { I.show(t[0]); });
      I.bar.append(b);
    });
    ['select', 'slide', 'deck', 'history'].forEach(function (ev) { A.on(ev, function () { if (!I.quiet) I.render(); }); });
    A.on('editing', function () { I.render(); });
    I.show(I.cur);
  };
  I.show = function (id) {
    I.cur = id; U.store.set('tab', id);
    D.$$('.insp-tab', I.bar).forEach(function (b) { var on = b.dataset.tab === id; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    I.render();
    A.emit('inspector', id);
  };
  I.tab = function (id, fn) { I.tabs[id] = fn; };
  I.render = function () {
    if (!A.deck || !I.body) return;
    var y = I.body.scrollTop;
    I.body.innerHTML = '';
    var fn = I.tabs[I.cur]; if (fn) fn(I.body);
    I.body.scrollTop = y;
  };
  /** Runs an edit from a control without rebuilding the inspector (keeps focus on sliders/inputs). */
  I.edit = function (label, fn, key) { I.quiet = true; try { A.change(label, fn, key); A.emit('select'); } finally { I.quiet = false; } };
  I.editSel = function (label, fn, key) { var objs = A.selected(); I.edit(label, function () { objs.forEach(fn); }, key); };

  /* ---------- control kit ---------- */
  I.section = function (title, kids, opts) {
    var s = D.h('section', { class: 'insp-sec' + (opts && opts.cls ? ' ' + opts.cls : '') });
    if (title) s.append(D.h('h3', { class: 'insp-h', text: title }));
    (kids || []).forEach(function (k) { if (k) s.append(k); });
    return s;
  };
  I.row = function (label, ctrl, cls) { return D.h('div', { class: 'insp-row' + (cls ? ' ' + cls : '') }, D.h('span', { class: 'insp-l', text: label }), ctrl); };
  I.seg = function (opts, value, onchange, aria) {
    var g = D.h('div', { class: 'seg', role: 'radiogroup', 'aria-label': aria || '' });
    opts.forEach(function (o) {
      var b = D.h('button', { type: 'button', class: 'seg-b' + (String(o.v) === String(value) ? ' on' : ''), title: o.title || o.label || '', 'aria-label': o.title || o.label || String(o.v), role: 'radio', 'aria-checked': String(o.v) === String(value) ? 'true' : 'false', html: o.icon ? D.icon(o.icon) : U.esc(o.label) });
      b.addEventListener('click', function () { D.$$('.seg-b', g).forEach(function (x) { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); }); b.classList.add('on'); b.setAttribute('aria-checked', 'true'); onchange(o.v); });
      g.append(b);
    });
    return g;
  };
  I.toggle = function (label, value, onchange) {
    var c = D.h('input', { type: 'checkbox', checked: !!value });
    c.addEventListener('change', function () { onchange(c.checked); });
    return D.h('label', { class: 'insp-check' }, c, D.h('span', { text: label }));
  };
  I.select = function (opts, value, onchange, aria) {
    var s = D.h('select', { class: 'inp', 'aria-label': aria || '' });
    opts.forEach(function (o) { s.append(D.h('option', { value: o[0], selected: String(o[0]) === String(value) }, o[1])); });
    s.addEventListener('change', function () { onchange(s.value); });
    return s;
  };
  I.num = function (value, onchange, o) {
    o = o || {};
    var n = D.h('input', { class: 'inp num', type: 'number', value: U.round(value, o.dec == null ? 1 : o.dec), step: o.step || 1, min: o.min, max: o.max, 'aria-label': o.aria || '' });
    n.addEventListener('change', function () { var v = parseFloat(n.value); if (!isNaN(v)) onchange(v); });
    return o.unit ? D.h('span', { class: 'num-wrap' }, n, D.h('i', { text: o.unit })) : n;
  };
  I.slider = function (value, min, max, step, onchange, fmt, aria) {
    var r = D.h('input', { type: 'range', class: 'rng', min: min, max: max, step: step, value: value, 'aria-label': aria || '' });
    var out = D.h('output', { class: 'rng-v', text: fmt ? fmt(value) : String(value) });
    r.addEventListener('input', function () { var v = parseFloat(r.value); out.textContent = fmt ? fmt(v) : String(v); onchange(v); });
    return D.h('span', { class: 'rng-wrap' }, r, out);
  };
  /** A colour well: theme swatches plus a custom colour. value is a theme ref or hex. */
  I.color = function (value, onchange, opts) {
    opts = opts || {};
    var theme = A.theme(), hex = TH.color(theme, value) || '#000000';
    var well = D.h('button', { type: 'button', class: 'well' + (value == null || value === 'none' ? ' none' : ''), title: opts.title || 'Colour', 'aria-label': opts.title || 'Colour', style: { '--c': hex } });
    well.addEventListener('click', function () { I.colorPop(well, value, function (v) { well.style.setProperty('--c', TH.color(A.theme(), v) || 'transparent'); well.classList.toggle('none', v === 'none'); onchange(v); }, opts); });
    return well;
  };
  I.colorPop = function (anchor, value, onchange, opts) {
    D.$$('.color-pop').forEach(function (p) { p.remove(); });
    var theme = A.theme(), pop = D.h('div', { class: 'color-pop', role: 'dialog', 'aria-label': 'Colours' });
    var grid = D.h('div', { class: 'sw-grid' });
    TH.SLOTS.forEach(function (k) {
      var b = D.h('button', { type: 'button', class: 'sw' + (value === k ? ' on' : ''), title: k, 'aria-label': 'Theme ' + k, style: { background: theme.colors[k] } });
      b.addEventListener('click', function () { onchange(k); close(); });
      grid.append(b);
    });
    ['#ffffff', '#d9d9d9', '#8c8c8c', '#404040', '#000000', '#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#007aff'].forEach(function (c) {
      var b = D.h('button', { type: 'button', class: 'sw' + (value === c ? ' on' : ''), title: c, 'aria-label': c, style: { background: c } });
      b.addEventListener('click', function () { onchange(c); close(); });
      grid.append(b);
    });
    var custom = D.h('input', { type: 'color', value: TH.color(theme, value) || '#000000', 'aria-label': 'Custom colour' });
    custom.addEventListener('input', function () { onchange(custom.value); });
    pop.append(D.h('div', { class: 'pop-h', text: 'Theme colours' }), grid, D.h('label', { class: 'pop-custom' }, custom, D.h('span', { text: 'Custom…' })));
    if (opts && opts.allowNone) { var nb = D.h('button', { type: 'button', class: 'btn sm', text: 'None' }); nb.addEventListener('click', function () { onchange('none'); close(); }); pop.append(nb); }
    document.body.append(pop);
    var r = anchor.getBoundingClientRect(), pr = pop.getBoundingClientRect();
    pop.style.left = U.clamp(r.right - pr.width, 8, innerWidth - pr.width - 8) + 'px';
    pop.style.top = U.clamp(r.bottom + 6, 8, innerHeight - pr.height - 8) + 'px';
    function close() { pop.remove(); document.removeEventListener('pointerdown', outside, true); }
    function outside(e) { if (!pop.contains(e.target) && e.target !== anchor) close(); }
    setTimeout(function () { document.addEventListener('pointerdown', outside, true); }, 0);
  };
  I.btnRow = function (items) {
    var g = D.h('div', { class: 'btn-row' });
    items.forEach(function (it) { if (!it) return; var b = D.h('button', { type: 'button', class: 'ib', title: it.title, 'aria-label': it.title, disabled: !!it.disabled, html: it.icon ? D.icon(it.icon) : U.esc(it.label) }); b.addEventListener('click', it.run); g.append(b); });
    return g;
  };
  I.button = function (label, run, cls) { var b = D.h('button', { type: 'button', class: 'btn ' + (cls || ''), text: label }); b.addEventListener('click', run); return b; };
  I.empty = function (text) { return D.h('p', { class: 'insp-empty', text: text }); };
})();
