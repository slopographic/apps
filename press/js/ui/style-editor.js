/* Slop Press — paragraph / character style editor (only values that differ from the parent are stored,
   so changing a parent style cascades). */
(function () {
  'use strict';
  var PR = window.PR, U = PR.util, h = U.h, S = PR.state, H = PR.history, STY = PR.styles, F = PR.fonts;
  var UI = PR.ui = PR.ui || {};
  var SU = function () { return window.SlopUI; };

  /** kind 'para' | 'char'; name = existing style or null (new, optionally basedOn). */
  UI.styleEditor = function (kind, name, basedOn) {
    var doc = S.doc, table = doc.styles[kind], isNew = !name, fixed = name && /^\[/.test(name);
    var own = name ? U.clone(table[name] || {}) : { basedOn: basedOn || (kind === 'para' ? '[Basic Paragraph]' : undefined) };
    var parentEff = function (b) { return kind === 'para' ? STY.para(doc, b || '[Basic Paragraph]') : STY.char(doc, b); };
    var eff = U.assign({}, kind === 'para' ? parentEff(own.basedOn) : {}, own);
    if (kind === 'para' && fixed) eff = U.clone(table[name]);
    var nameIn = h('input', { class: 'sui-input', type: 'text', value: name || (kind === 'para' ? 'Paragraph Style ' : 'Character Style ') + (Object.keys(table).length), disabled: fixed });
    var others = STY.names(doc, kind).filter(function (n) { return n !== name; });
    var based = SU().select([['', kind === 'para' ? '[No Paragraph Style]' : '[None]']].concat(others.map(function (n) { return [n, n]; })), own.basedOn || '');
    var next = SU().select([['', '[Same Style]']].concat(STY.names(doc, 'para').map(function (n) { return [n, n]; })), own.nextStyle || '');
    var I = {}, unset = kind === 'char';
    function opt(list, v) { return SU().select((unset ? [['', '—']] : []).concat(list), v == null ? '' : v); }
    function num(v, step) { var i = h('input', { class: 'sui-input', type: 'number', step: step || 0.5 }); i.value = v == null ? '' : v; return i; }
    I.font = opt(F.list().map(function (f) { return [f, f]; }), eff.font);
    I.fontStyle = opt(F.STYLES.map(function (f) { return [f, f]; }), eff.fontStyle);
    I.size = num(eff.size); I.leading = h('input', { class: 'sui-input', type: 'text', value: eff.leading == null ? '' : eff.leading });
    I.tracking = num(eff.tracking, 5); I.baselineShift = num(eff.baselineShift);
    I.caps = opt([['normal', 'Normal'], ['allcaps', 'All Caps']], eff.caps);
    I.color = SU().select((unset ? [['', '—']] : []).concat(doc.swatches.map(function (s) { return [s.color, s.name]; })).concat(eff.color && !doc.swatches.some(function (s) { return s.color === eff.color; }) ? [[eff.color, eff.color]] : []), eff.color || '');
    I.underline = opt([['false', 'Off'], ['true', 'On']], eff.underline == null ? null : String(!!eff.underline));
    I.strike = opt([['false', 'Off'], ['true', 'On']], eff.strike == null ? null : String(!!eff.strike));
    var panes = [h('div', null, SU().field('Name', nameIn), SU().field('Based on', based), kind === 'para' ? SU().field('Next style', next) : null)];
    panes.push(h('div', null, SU().field('Font', I.font), SU().field('Style', I.fontStyle), h('div', { class: 'pr-cols' }, SU().field('Size', I.size, 'pt'), SU().field('Leading', I.leading, 'pt'),
      SU().field('Tracking', I.tracking, '‰'), SU().field('Shift', I.baselineShift, 'pt')), SU().field('Case', I.caps), SU().field('Colour', I.color), h('div', { class: 'pr-cols' }, SU().field('Underline', I.underline), SU().field('Strike', I.strike))));
    var tabs = ['General', 'Character'];
    if (kind === 'para') {
      I.align = SU().select([['left', 'Left'], ['center', 'Center'], ['right', 'Right'], ['justify', 'Justify'], ['justify-all', 'Justify all lines']], eff.align);
      ['indentLeft', 'indentRight', 'indentFirst', 'spaceBefore', 'spaceAfter'].forEach(function (k) { I[k] = num(eff[k] || 0); });
      panes.push(h('div', null, SU().field('Alignment', I.align), h('div', { class: 'pr-cols' }, SU().field('Left indent', I.indentLeft, 'pt'), SU().field('Right indent', I.indentRight, 'pt'), SU().field('First line', I.indentFirst, 'pt'), h('span'),
        SU().field('Space before', I.spaceBefore, 'pt'), SU().field('Space after', I.spaceAfter, 'pt'))));
      I.dropLines = num(eff.dropLines || 0, 1); I.dropChars = num(eff.dropChars || 1, 1);
      var ra = eff.ruleAbove || {}, rb = eff.ruleBelow || {};
      I.raW = num(ra.weight || 0); I.raO = num(ra.offset || 0); I.rbW = num(rb.weight || 0); I.rbO = num(rb.offset || 0);
      panes.push(h('div', null, h('h4', null, 'Drop cap'), h('div', { class: 'pr-cols' }, SU().field('Lines', I.dropLines), SU().field('Characters', I.dropChars)),
        h('h4', null, 'Rules (weight 0 = off)'), h('div', { class: 'pr-cols' }, SU().field('Above', I.raW, 'pt'), SU().field('Offset', I.raO, 'pt'), SU().field('Below', I.rbW, 'pt'), SU().field('Offset', I.rbO, 'pt'))));
      var ck = function (k, label) { var c = h('input', { type: 'checkbox' }); c.checked = !!eff[k]; I[k] = c; return h('label', { class: 'pr-check' }, c, label); };
      I.keepFirst = num(eff.keepFirst || 1, 1); I.keepLast = num(eff.keepLast || 1, 1);
      I.composer = SU().select([['kp', 'Paragraph composer (Knuth–Plass)'], ['greedy', 'Single-line composer (greedy)']], eff.composer || 'kp');
      panes.push(h('div', null, ck('keepNext', 'Keep with next paragraph'), ck('keepLines', 'Keep all lines together'), h('div', { class: 'pr-cols' }, SU().field('Keep first', I.keepFirst, 'lines'), SU().field('Keep last', I.keepLast, 'lines')),
        ck('hyphenate', 'Hyphenate (English patterns)'), ck('gridAlign', 'Align to baseline grid'), SU().field('Composer', I.composer)));
      tabs.push('Indents & Spacing', 'Drop Caps & Rules', 'Keeps & Hyphenation');
    }
    var preview = h('div', { class: 'pr-preview', style: { padding: '10px 12px', overflow: 'hidden', color: '#111', height: '84px' } }, 'The quick brown fox jumps over the lazy dog. Sphinx of black quartz, judge my vow.');
    var bar = h('div', { class: 'pr-tabs' }), body = h('div', { class: 'pr-form' }, bar, panes, h('h4', null, 'Preview'), preview);
    function show(k) { panes.forEach(function (p, i) { p.hidden = i !== k; }); U.$$('.pr-tab', bar).forEach(function (t, i) { t.classList.toggle('on', i === k); }); }
    tabs.forEach(function (t, i) { var b = h('button', { type: 'button', class: 'pr-tab' }, t); b.addEventListener('click', function () { show(i); }); bar.append(b); });
    show(0);
    function collect() {
      var v = {}, g = function (k) { return I[k] && I[k].value; };
      if (g('font')) v.font = g('font'); if (g('fontStyle')) v.fontStyle = g('fontStyle');
      ['size', 'tracking', 'baselineShift'].forEach(function (k) { if (g(k) !== '' && g(k) != null && !isNaN(+g(k))) v[k] = +g(k); });
      var ld = String(g('leading') || '').trim(); if (ld) v.leading = /auto/i.test(ld) ? 'auto' : +ld || 'auto';
      if (g('caps')) v.caps = g('caps'); if (g('color')) v.color = g('color');
      if (g('underline')) v.underline = g('underline') === 'true'; if (g('strike')) v.strike = g('strike') === 'true';
      if (kind === 'para') {
        v.align = g('align');
        ['indentLeft', 'indentRight', 'indentFirst', 'spaceBefore', 'spaceAfter', 'dropLines', 'dropChars', 'keepFirst', 'keepLast'].forEach(function (k) { v[k] = +g(k) || 0; });
        v.ruleAbove = +I.raW.value > 0 ? { weight: +I.raW.value, offset: +I.raO.value || 0, color: v.color || eff.color || '#000' } : null;
        v.ruleBelow = +I.rbW.value > 0 ? { weight: +I.rbW.value, offset: +I.rbO.value || 0, color: v.color || eff.color || '#000' } : null;
        ['keepNext', 'keepLines', 'hyphenate', 'gridAlign'].forEach(function (k) { v[k] = I[k].checked; });
        v.composer = g('composer');
      }
      return v;
    }
    function renderPreview() {
      var v = U.assign({}, kind === 'para' ? parentEff(based.value) : STY.para(doc, '[Basic Paragraph]'), collect());
      U.assign(preview.style, { fontFamily: F.family(v.font).css, fontSize: Math.min(28, v.size || 12) + 'px', fontWeight: F.isBold(v.fontStyle) ? 700 : 400, fontStyle: F.isItalic(v.fontStyle) ? 'italic' : 'normal',
        letterSpacing: (v.tracking || 0) / 1000 + 'em', textTransform: v.caps === 'allcaps' ? 'uppercase' : 'none', color: U.css(v.color || '#111'), textAlign: v.align === 'justify-all' ? 'justify' : v.align || 'left',
        textDecoration: (v.underline ? 'underline ' : '') + (v.strike ? 'line-through' : ''), textIndent: (v.indentFirst || 0) + 'px', lineHeight: v.leading && v.leading !== 'auto' ? (v.leading / (v.size || 12)) : 1.2 });
    }
    body.addEventListener('input', renderPreview); body.addEventListener('change', renderPreview); renderPreview();
    SU().dialog({ title: (isNew ? 'New ' : 'Edit ') + (kind === 'para' ? 'Paragraph' : 'Character') + ' Style', body: body, cls: 'pr-mid', buttons: [{ label: 'Cancel' }, { label: isNew ? 'Create' : 'OK', primary: true, act: function () {
      var nm = (nameIn.value || '').trim(); if (!nm) return false;
      if (nm !== name && table[nm]) { U.toast('A style named “' + nm + '” exists'); return false; }
      var v = collect(), parent = kind === 'para' ? parentEff(based.value) : (based.value ? STY.char(doc, based.value) : {}), out = {};
      if (fixed) out = U.assign(U.clone(table[name]), v);
      else for (var k in v) if (JSON.stringify(v[k]) !== JSON.stringify(parent[k])) out[k] = v[k];
      if (!fixed && based.value) out.basedOn = based.value;
      if (kind === 'para' && next.value) out.nextStyle = next.value;
      if (name && nm !== name) STY.rename(doc, kind, name, nm);
      table[nm] = out; STY.invalidate(); H.commit(isNew ? 'New style' : 'Edit style');
      if (isNew && PR.format.hasText() && kind === 'para') PR.format.paraStyle(nm);
    } }] });
  };
})();
