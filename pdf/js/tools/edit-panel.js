/* Slop PDF — Edit page and Sign panels: tool palette and annotation properties. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, h = U.h, P = SP.panels, PANELS = P.PANELS, K = P.helpers;
  var section = K.section, row = K.row, btn = K.btn, seg = K.seg, select = K.select, num = K.num, text = K.text, slider = K.slider, colorPicker = K.colorPicker, check = K.check, note = K.note, needPages = K.needPages, onRefresh = K.onRefresh;
  PANELS.edit = {
    title: 'Edit page', icon: 'edit', build: function (b) {
      var np = needPages(); if (np) { b.appendChild(np); return; }
      var tools = h('div', { class: 'tool-grid', role: 'toolbar', 'aria-label': 'Annotation tools' });
      SP.editor.TOOLS.forEach(function (t) {
        var bt = h('button', { type: 'button', class: 'tool-b', 'data-tool': t[0], title: t[1] + ' (' + t[3] + ')', html: U.icon(t[2]) + '<span>' + U.esc(t[1].split(' (')[0]) + '</span>' });
        bt.addEventListener('click', function () { SP.editor.setTool(t[0]); });
        tools.appendChild(bt);
      });
      b.appendChild(section('Tools', [tools]));
      var props = h('div', { class: 'props-box' });
      b.appendChild(props);
      var pageSec = h('div');
      b.appendChild(pageSec);
      var lastKey = null;
      onRefresh(function (reason) {
        U.$$('.tool-b', tools).forEach(function (x) { x.classList.toggle('on', x.dataset.tool === SP.editor.tool); });
        var a = SP.editor.getSelected(), type = a ? a.type : SP.editor.tool;
        var key = (a ? a.id + ':' + a.type : 'tool:' + type) + ':' + SP.editor.pid;
        if (key !== lastKey || reason === 'history') { lastKey = key; buildProps(props, a, type); }
        var p = SP.editor.page();
        pageSec.innerHTML = '';
        if (p) {
          var n = p.annots.length;
          pageSec.appendChild(section('This page', [note('Page ' + (E.indexOf(p.id) + 1) + ' of ' + E.state.pages.length + ' · ' + (n ? n + ' annotation' + (n > 1 ? 's' : '') : 'no annotations yet') + '. Annotations are flattened into the page when you download.'),
            n ? h('div', { class: 'btn-row' }, btn('Clear page annotations', 'trash', function () { E.commit('Clear annotations', function (st) { st.pages.forEach(function (x) { if (x.id === p.id) x.annots = []; }); }); }, 'danger-text')) : null]));
        }
      });
    }
  };
  function buildProps(box, a, type) {
    box.innerHTML = '';
    var Ed = SP.editor, d = a || Ed.defaults[type] || {};
    var set = function (k) { return function (v) { Ed.setProp(k, v); }; };
    var kids = [];
    if (type === 'select' && !a) { box.appendChild(section('Selection', [note('Click an annotation to select it. Drag to move, use the handles to resize, double-click text to edit. Drag empty space to pan; Ctrl/⌘ + wheel or pinch to zoom.')])); return; }
    if (type === 'text') {
      kids.push(row('Font', select([['Helvetica', 'Helvetica (sans)'], ['Times', 'Times (serif)'], ['Courier', 'Courier (mono)']], d.font, set('font'))));
      kids.push(row('Size', num(d.size || 16, 4, 400, 1, set('size')), 'pt'));
      kids.push(h('div', { class: 'btn-row' },
        toggle('B', 'Bold', d.bold, set('bold'), 'bold'), toggle('I', 'Italic', d.italic, set('italic'), 'italic')));
      kids.push(row('Colour', colorPicker(d.color, set('color'))));
    }
    if (/^(pen|marker|line|arrow|rect|ellipse)$/.test(type)) {
      kids.push(row(type === 'rect' || type === 'ellipse' ? 'Stroke' : 'Colour', colorPicker(d.color, set('color'), type === 'rect' || type === 'ellipse')));
      kids.push(row('Width', slider(d.width || 2, 0.5, type === 'marker' ? 40 : 20, 0.5, set('width'), function (v) { return v + ' pt'; })));
    }
    if (type === 'rect' || type === 'ellipse') kids.push(row('Fill', colorPicker(d.fill || 'none', set('fill'), true)));
    if (type === 'whiteout' || type === 'hlbox') kids.push(row(type === 'whiteout' ? 'Cover colour' : 'Colour', colorPicker(d.fill, set('fill'))));
    if (type === 'redact') { box.appendChild(section(a ? 'Selected: Redaction mark' : 'New redaction mark', [note('Drag over anything that must be removed. Marks are hatched red until you apply them in the Redact panel; applying replaces the page with an image and removes the content for good.', 'warn'), h('div', { class: 'btn-row' }, btn('Open Redact panel', 'redact', function () { SP.app.setTool('redact'); }), a ? btn('Delete', 'trash', function () { Ed.deleteSelected(); }, 'danger-text') : null)])); return; }
    if (type !== 'whiteout') kids.push(row('Opacity', slider(Math.round((d.opacity == null ? 1 : d.opacity) * 100), 5, 100, 1, function (v) { Ed.setProp('opacity', v / 100); }, function (v) { return v + '%'; })));
    if (type === 'whiteout') kids.push(note('Whiteout paints an opaque box over the page. It hides content visually; the original text underneath is still in the file. Use Redact to remove content for real.', 'warn'));
    var names = { text: 'Text', pen: 'Drawing', marker: 'Highlighter', rect: 'Rectangle', ellipse: 'Ellipse', line: 'Line', arrow: 'Arrow', whiteout: 'Whiteout', hlbox: 'Highlight box', image: a && a.sig ? 'Signature' : 'Image' };
    box.appendChild(section((a ? 'Selected: ' : 'New ') + (names[type] || type), kids));
    if (a) {
      box.appendChild(section(null, [h('div', { class: 'btn-grid' },
        a.type === 'text' ? btn('Edit text', 'text', function () { Ed.editSelectedText(); }) : null,
        btn('Duplicate', 'copy', function () { Ed.duplicateSelected(); }),
        btn('Bring to front', 'plus', function () { zorder(a.id, 1); }),
        btn('Send to back', 'reverse', function () { zorder(a.id, -1); }),
        btn('Delete', 'trash', function () { Ed.deleteSelected(); }, 'danger-text'))]));
    }
  }
  function zorder(id, dir) {
    var pid = SP.editor.pid;
    E.commit(dir > 0 ? 'Bring to front' : 'Send to back', function (st) {
      st.pages.forEach(function (p) { if (p.id !== pid) return; var a = p.annots.filter(function (x) { return x.id === id; })[0]; if (!a) return; p.annots = p.annots.filter(function (x) { return x.id !== id; }); if (dir > 0) p.annots.push(a); else p.annots.unshift(a); });
    });
  }
  function toggle(label, title, on, onChange, cls) {
    var b = h('button', { type: 'button', class: 'tog ' + (cls || '') + (on ? ' on' : ''), title: title, 'aria-pressed': on ? 'true' : 'false' }, label);
    b.addEventListener('click', function () { on = !on; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); onChange(on); });
    return b;
  }

  /* -------------------------------------------------------------- sign */
  PANELS.sign = {
    title: 'Sign', icon: 'sign', build: function (b) {
      var np = needPages(); if (np) { b.appendChild(np); return; }
      b.appendChild(section(null, [note('Draw your signature or type it in a handwriting font, then drag it into place on the page. Saved signatures stay in this browser only.'),
        h('div', { class: 'btn-row' }, btn('Create signature…', 'sign', function () { SP.app.ensurePage(); SP.editor.setTool('signature'); }, 'primary wide'))]));
      var list = h('div', { class: 'sig-list' });
      b.appendChild(section('Saved signatures', [list]));
      function paint() {
        list.innerHTML = '';
        var saved = SP.sign.saved();
        if (!saved.length) { list.appendChild(note('None yet.')); return; }
        saved.forEach(function (sig) {
          list.appendChild(h('button', { type: 'button', class: 'sig-item', title: 'Place on the current page', onclick: function () { SP.app.ensurePage(); SP.editor.placeImage(SP.sign.toAsset(sig), 'Add signature'); } }, h('img', { src: sig.url, alt: 'Saved signature' })));
        });
        list.appendChild(h('div', { class: 'btn-row' }, btn('Clear saved signatures', 'trash', function () {
          SlopUI.confirm('Clear saved signatures', 'Remove every signature saved in this browser? Signatures already placed on pages stay.', 'Clear', { danger: true }).then(function (ok) { if (ok) { SP.sign.clear(); paint(); SlopUI.toast('Saved signatures cleared'); } });
        }, 'danger-text')));
      }
      paint();
      b.appendChild(section('Tips', [note('After placing, drag the corners to resize (the aspect ratio is kept). Use the Edit page tool for text like the date next to it.')]));
    }
  };

  /* ------------------------------------------------------ page numbers */
})();
