/* Slop PDF — Forms, Compress, Convert, Split and Metadata panels. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, h = U.h, P = SP.panels, PANELS = P.PANELS, K = P.helpers;
  var section = K.section, row = K.row, btn = K.btn, seg = K.seg, select = K.select, num = K.num, text = K.text, slider = K.slider, colorPicker = K.colorPicker, check = K.check, note = K.note, needPages = K.needPages, onRefresh = K.onRefresh;
  PANELS.forms = {
    title: 'Fill forms', icon: 'forms', build: function (b) {
      var np = needPages(); if (np) { b.appendChild(np); return; }
      var list = h('div', { class: 'form-list' }, note('Looking for form fields…'));
      b.appendChild(list);
      var flatten = check('Flatten forms on download (fields become plain page content)', E.state.flattenForms, function (v) { E.commit(v ? 'Flatten forms' : 'Keep forms editable', function (st) { st.flattenForms = v; }); });
      b.appendChild(section('Output', [flatten, h('div', { class: 'btn-row' }, btn('Reset values', 'undo', function () { E.commit('Reset form values', function (st) { st.forms = {}; }); P.rebuild(); }))]));
      (async function () {
        var used = new Set(E.state.pages.map(function (p) { return p.f; })), any = false;
        list.innerHTML = '';
        for (var f of E.files.values()) {
          if (!used.has(f.id)) continue;
          var fields = await E.loadFields(f);
          if (!fields.length) continue;
          any = true;
          list.appendChild(section(null, [h('div', { class: 'form-file' }, h('span', { class: 'fdot', style: { '--fc': f.color } }), h('b', null, f.name), h('span', { class: 'fi-meta' }, fields.length + ' fields'))].concat(fields.map(function (fld) { return fieldRow(f, fld); }))));
        }
        if (!any) list.appendChild(section(null, [note('None of the open PDFs has fillable form fields (AcroForm). The sample’s last page has some — or use the Edit page tool to type onto any page.')]));
      })();
    }
  };
  function fieldRow(f, fld) {
    var vals = E.state.forms[f.id] || {}, has = Object.prototype.hasOwnProperty.call(vals, fld.name), v = has ? vals[fld.name] : fld.value;
    function set(val) { E.commit('Fill “' + fld.name + '”', function (st) { st.forms[f.id] = Object.assign({}, st.forms[f.id] || {}); st.forms[f.id][fld.name] = val; }, 'form:' + f.id + ':' + fld.name); }
    var ctrl, label = fld.name.split('.').pop();
    if (fld.type === 'checkbox') ctrl = check(label, !!v, set);
    else if (fld.type === 'radiobutton') ctrl = row(label, select([['', '—']].concat(fld.options.map(function (o) { return [o, o]; })), v || '', set));
    else if (fld.type === 'combobox' || fld.type === 'listbox') ctrl = row(label, select([['', '—']].concat(fld.options.map(function (o) { return [o[0], o[1] || o[0]]; })), v || '', set));
    else {
      var inp = fld.multiline ? h('textarea', { class: 'inp', rows: 3 }) : h('input', { class: 'inp', type: 'text' });
      inp.value = v == null ? '' : v;
      inp.addEventListener('input', function () { set(inp.value); });
      ctrl = row(label, inp);
    }
    var wrap = h('div', { class: 'form-field' + (fld.readOnly ? ' ro' : '') }, ctrl, h('span', { class: 'ff-page' }, 'p' + ((fld.page || 0) + 1)));
    wrap.title = fld.name;
    return wrap;
  }

  /* ----------------------------------------------------------- compress */
  PANELS.compress = {
    title: 'Compress', icon: 'compress', build: function (b) {
      var np = needPages(); if (np) { b.appendChild(np); return; }
      var o = { mode: 'lossless', dpi: 110, quality: 0.65 };
      var lossy = h('div', { hidden: true },
        row('Resolution', slider(o.dpi, 50, 200, 5, function (v) { o.dpi = v; }, function (v) { return v + ' dpi'; })),
        row('JPEG quality', slider(Math.round(o.quality * 100), 20, 95, 5, function (v) { o.quality = v / 100; }, function (v) { return v + '%'; })),
        note('Lossy: every page becomes a JPEG picture. Text is no longer selectable or searchable, and forms and links are lost. Best for scans and photo-heavy files.', 'warn'));
      b.appendChild(section('Mode', [seg([['lossless', 'Lossless'], ['lossy', 'Strong (lossy)']], o.mode, function (v) { o.mode = v; lossy.hidden = v !== 'lossy'; }, 'Compression mode'),
        note('Lossless re-saves with compressed object streams and drops unused objects. Text and vectors stay intact.'), lossy]));
      var result = h('div', { class: 'result' });
      b.appendChild(section(null, [h('div', { class: 'btn-row' }, btn('Compress & download', 'compress', function () { SP.app.compress(o, result); }, 'primary wide')), result]));
    }
  };

  /* ------------------------------------------------------------ convert */
  /* OCR: reads the text of scanned pages into an invisible text layer (ocr/recognise.js). */
  PANELS.ocr = {
    title: 'OCR', icon: 'ocr', build: function (b) {
      var off = SP.offline || !window.SlopAITools;
      var note = h('p', { class: 'hint' }, off ? 'Text recognition needs the OCR model, which is available when the app is online.' : 'Reads the text of scanned pages so you can select, search and edit it. Runs on this device.');
      b.appendChild(note);
      b.appendChild(section('Recognise text', [
        row('', btn('Run OCR on this page', 'ocr', function () { A.recognisePage(); })),
        row('', btn('Run OCR on document', 'ocr', function () { A.recogniseAll(); }))
      ]));
    }
  };

  PANELS.convert = {
    title: 'Convert', icon: 'convert', build: function (b) {
      var o = { format: 'png', dpi: 150, quality: 0.9, which: 'all' };
      if (E.state.pages.length) {
        b.appendChild(section('To Word, Excel or PowerPoint', [
          h('div', { class: 'btn-row' },
            btn('Word (.docx)', 'convert', function () { A.openConvert('pdf-to-docx'); }),
            btn('Excel (.xlsx)', 'convert', function () { A.openConvert('pdf-to-xlsx'); }),
            btn('PowerPoint (.pptx)', 'convert', function () { A.openConvert('pdf-to-pptx'); }))
        ]));
      }
      if (E.state.pages.length) {
        b.appendChild(section('PDF pages → images', [
          row('Format', seg([['png', 'PNG'], ['jpeg', 'JPEG']], o.format, function (v) { o.format = v; }, 'Image format')),
          row('Resolution', select([['72', '72 dpi (screen)'], ['150', '150 dpi'], ['300', '300 dpi (print)'], ['600', '600 dpi']], o.dpi, function (v) { o.dpi = +v; })),
          row('JPEG quality', slider(90, 30, 100, 5, function (v) { o.quality = v / 100; }, function (v) { return v + '%'; })),
          row('Pages', seg([['all', 'All'], ['sel', 'Selected']], o.which, function (v) { o.which = v; }, 'Which pages')),
          h('div', { class: 'btn-row' }, btn('Download images', 'image', function () { SP.app.toImages(o); }, 'primary wide')),
          note('Several pages download as one .zip file.')]));
      }
      var io = { size: 'a4', margin: 24, orientation: 'auto', add: E.state.pages.length > 0 };
      b.appendChild(section('Images → PDF', [
        row('Page size', select([['fit', 'Fit each image'], ['a4', 'A4'], ['letter', 'US Letter']], io.size, function (v) { io.size = v; })),
        row('Orientation', select([['auto', 'Auto (match image)'], ['portrait', 'Portrait'], ['landscape', 'Landscape']], io.orientation, function (v) { io.orientation = v; })),
        row('Margin', select([['0', 'None'], ['24', 'Small'], ['48', 'Large']], io.margin, function (v) { io.margin = +v; })),
        h('div', { class: 'btn-row' }, btn('Choose images…', 'image', function () { SP.app.imagesToPdf(io); }, 'primary wide')),
        check('Add the pages to the open document (otherwise download a new PDF)', io.add, function (v) { io.add = v; }),
        note('PNG, JPEG, WebP or GIF. Phone photos are turned upright automatically.')]));
      if (E.state.pages.length) {
        b.appendChild(section('PDF → text', [note('Extracts the text layer of the final document (scans without OCR have none).'),
          h('div', { class: 'btn-row' }, btn('Extract text', 'textfile', function () { SP.app.extractText(); }, 'wide'))]));
      }
    }
  };

  /* -------------------------------------------------------------- split */
  P.split = { mode: 'ranges', ranges: '1-2, 3-', every: 2, output: 'zip' };
  PANELS.split = {
    title: 'Split', icon: 'split', build: function (b) {
      var np = needPages(); if (np) { b.appendChild(np); return; }
      var o = P.split, rangeIn, everyIn, preview = h('div', { class: 'split-preview' });
      var rangesBox = h('div', null, row('Ranges', (rangeIn = text(o.ranges, function (v) { o.ranges = v; upd(); }, 'e.g. 1-3, 5, 8-'))), note('Each comma-separated range becomes its own PDF. “8-” means page 8 to the end.'));
      var everyBox = h('div', { hidden: true }, row('Pages per file', (everyIn = num(o.every, 1, 9999, 1, function (v) { o.every = Math.max(1, Math.round(v)); upd(); }))));
      function modeVis() { rangesBox.hidden = o.mode !== 'ranges'; everyBox.hidden = o.mode !== 'every'; }
      b.appendChild(section('Split by', [seg([['ranges', 'Page ranges'], ['every', 'Every N pages'], ['each', 'Each page']], o.mode, function (v) { o.mode = v; modeVis(); upd(); }, 'Split mode'), rangesBox, everyBox]));
      b.appendChild(section('Result', [preview]));
      b.appendChild(section('Download as', [seg([['zip', 'One .zip'], ['files', 'Separate PDFs']], o.output, function (v) { o.output = v; }, 'Output'),
        h('div', { class: 'btn-row' }, btn('Split & download', 'split', function () { SP.app.split(); }, 'primary wide'))]));
      function upd() {
        preview.innerHTML = '';
        var groups;
        try { groups = P.splitGroups(); rangeIn.classList.remove('bad'); } catch (e) { rangeIn.classList.add('bad'); preview.appendChild(note(e.message, 'err')); SP.organizer.render(); return; }
        preview.appendChild(note(groups.length + ' file' + (groups.length === 1 ? '' : 's') + ':'));
        var ul = h('ol', { class: 'split-list' });
        groups.slice(0, 50).forEach(function (g, i) { ul.appendChild(h('li', null, h('b', null, 'Part ' + (i + 1)), ' — pages ' + U.describeIdx(g) + ' (' + g.length + ')')); });
        if (groups.length > 50) ul.appendChild(h('li', null, '…and ' + (groups.length - 50) + ' more'));
        preview.appendChild(ul);
        SP.organizer.render();
      }
      modeVis(); upd();
      void everyIn;
    }
  };
  /** Groups of page indices for the current split settings. */
  P.splitGroups = function () {
    var o = P.split, n = E.state.pages.length;
    if (o.mode === 'each') return E.state.pages.map(function (_, i) { return [i]; });
    if (o.mode === 'every') { var out = []; for (var i = 0; i < n; i += o.every) { var g = []; for (var j = i; j < Math.min(n, i + o.every); j++) g.push(j); out.push(g); } return out; }
    return U.parseRanges(o.ranges, n);
  };

  /* ----------------------------------------------------------- metadata */
  PANELS.metadata = {
    title: 'Metadata', icon: 'info', build: function (b) {
      var np = needPages(); if (np) { b.appendChild(np); return; }
      var m = E.state.meta;
      function field(k, label, ph) {
        return row(label, text(m[k], function (v) { E.commit('Edit ' + label.toLowerCase(), function (st) { st.meta[k] = v; }, 'meta:' + k); }, ph));
      }
      b.appendChild(section('Document properties', [field('title', 'Title', 'Shown in the viewer’s title bar'), field('author', 'Author', ''), field('subject', 'Subject', ''), field('keywords', 'Keywords', 'comma, separated')]));
      b.appendChild(section(null, [note('Saved into the PDF’s document information when you download. Producer is set to “Slop PDF”.')]));
    }
  };
})();
