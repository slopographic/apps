/* Slop PDF — Redact panel and actions: draw marks, Find & redact (text, regex, presets), a review
   list of marked areas, and "Apply redactions" behind a confirm dialog. Downloading with marks that
   are not applied yet asks to apply them first (E.build refuses to export pending marks). */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, Ed = SP.editor, R = SP.redact, A = SP.app, S = A._, h = U.h;
  var P = SP.panels, K = P.helpers, section = K.section, btn = K.btn, seg = K.seg, select = K.select, check = K.check, note = K.note;
  var opts = R.opts = { text: '', regex: false, matchCase: false, presets: [], dpi: U.store.get('redactDpi', 200), stripMeta: true };
  var results = [];

  function clip(s, n) { s = String(s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function pagesWith() { var s = new Set(); R.pending().forEach(function (x) { s.add(x.p.id); }); return s.size; }

  /* ------------------------------------------------------------ actions */
  A.findRedactions = function () {
    return S.guarded('Searching every page…', async function (prog) {
      try { R.matchers(opts); } catch (e) { SlopUI.alert('Check the pattern', 'That regular expression is not valid: ' + e.message); return null; }
      results = await R.search(opts, function (f) { prog(f); });
      results.forEach(function (m) { m.on = true; });
      A.announce(results.length ? 'Found ' + results.length + ' match' + (results.length === 1 ? '' : 'es') : 'No matches');
      P.refresh('redact');
      return results;
    });
  };
  A.markFound = function () {
    var n = R.markMatches(results.filter(function (m) { return m.on; }));
    results = [];
    A.announce(n + ' area' + (n === 1 ? '' : 's') + ' marked for redaction');
    P.refresh('redact');
    return n;
  };
  A.applyRedactions = function (skipConfirm) {
    var marks = R.pending().length, pages = pagesWith();
    if (!marks) { SlopUI.toast('Nothing is marked for redaction yet.'); return Promise.resolve(false); }
    var ask = skipConfirm ? Promise.resolve(true) : new Promise(function (res) {
      SlopUI.dialog({ title: 'Apply redactions permanently?', cls: 'rd-confirm', onClose: res,
        body: h('div', null,
          h('p', { class: 'sui-p' }, 'This redacts ' + marks + ' marked area' + (marks === 1 ? '' : 's') + ' on ' + pages + ' page' + (pages === 1 ? '' : 's') + '. It is permanent in the file you download:'),
          h('ul', { class: 'rd-list-warn' },
            h('li', null, 'Each redacted page becomes an image with solid black boxes. Its text can no longer be selected, searched or copied.'),
            h('li', null, 'Form fields, comments and other annotations on those pages are flattened; anything inside a box is gone.'),
            h('li', null, 'Pages without marks stay unchanged.' + (opts.stripMeta ? ' Document metadata (title, author, subject, keywords) is removed.' : '')))),
        buttons: [{ label: 'Cancel' }, { label: 'Redact permanently', primary: true, danger: true }] });
    });
    return ask.then(function (ok) {
      if (!ok) return false;
      return S.guarded('Redacting…', async function (prog) {
        var r = await E.applyRedactions({ dpi: opts.dpi, stripMeta: opts.stripMeta, onProgress: function (f) { prog(f, 'Redacting pages… ' + Math.round(f * 100) + '%'); } });
        A.announce('Redacted ' + r.marks + ' area' + (r.marks === 1 ? '' : 's') + ' on ' + r.pages + ' page' + (r.pages === 1 ? '' : 's'));
        SlopUI.toast('Redactions applied. Download to save the redacted PDF.');
        return true;
      }).then(function (v) { return !!v; });
    });
  };
  // Downloads never include unapplied marks: offer to apply them first.
  var download = A.download;
  A.download = function () {
    var n = R.pending().length;
    if (!n) return download.apply(A, arguments);
    return SlopUI.confirm('Redactions not applied', n + ' area' + (n === 1 ? ' is' : 's are') + ' marked for redaction but not removed yet. Apply the redactions permanently, then download?', 'Apply and download', { danger: true })
      .then(function (ok) { return ok ? A.applyRedactions(true).then(function (done) { return done ? download.apply(A) : null; }) : null; });
  };
  A.gotoMark = function (pid, aid) {
    if (A.tool !== 'redact') A.setTool('redact');
    A.openPage(pid, true);
    if (aid) { Ed.setTool('select'); Ed.select(aid); }
  };
  A.removeMarks = function (pid, aid) {
    E.commit(aid ? 'Remove redaction mark' : 'Remove all redaction marks', function (st) {
      st.pages.forEach(function (p) { if (!pid || p.id === pid) p.annots = p.annots.filter(function (a) { return a.type !== 'redact' || (aid && a.id !== aid); }); });
    });
  };

  /* -------------------------------------------------------------- panel */
  P.PANELS.redact = {
    title: 'Redact', icon: 'redact', build: function (b) {
      var np = K.needPages(); if (np) { b.appendChild(np); return; }
      b.appendChild(section('Mark areas', [note('Drag boxes over anything that must go. Marks are hatched red until you apply them.'),
        h('div', { class: 'btn-row' }, btn('Draw redaction boxes', 'redact', function () { A.ensurePage(); Ed.setTool('redact'); }, 'primary'))]));

      var q = K.text(opts.text, function (v) { opts.text = v; }, opts.regex ? 'Regular expression, e.g. INV-\\d+' : 'Words or phrase');
      q.setAttribute('aria-label', 'Text to find');
      q.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); A.findRedactions(); } });
      var presets = h('div', { class: 'rd-presets' }, Object.keys(R.PRESETS).map(function (id) {
        return check(R.PRESETS[id].label, opts.presets.indexOf(id) >= 0, function (on) { opts.presets = opts.presets.filter(function (x) { return x !== id; }); if (on) opts.presets.push(id); });
      }));
      var found = h('div', { class: 'rd-found' });
      b.appendChild(section('Find & redact', [q,
        h('div', { class: 'rd-opts' }, seg([['text', 'Text'], ['regex', 'Regex']], opts.regex ? 'regex' : 'text', function (v) { opts.regex = v === 'regex'; q.placeholder = opts.regex ? 'Regular expression, e.g. INV-\\d+' : 'Words or phrase'; }, 'Search mode'),
          check('Match case', opts.matchCase, function (v) { opts.matchCase = v; })),
        presets,
        h('div', { class: 'btn-row' }, btn('Find on all pages', 'zoomin', function () { A.findRedactions(); }, 'wide')), found]));

      var review = h('div', { class: 'rd-review' });
      b.appendChild(section('Marked for redaction', [review]));

      var dpiSel = select([[150, '150 dpi (smaller file)'], [200, '200 dpi'], [300, '300 dpi (sharpest)']], opts.dpi, function (v) { opts.dpi = +v; U.store.set('redactDpi', +v); });
      var applyBtn = btn('Apply redactions…', 'redact', function () { A.applyRedactions(); }, 'primary danger wide');
      b.appendChild(section('Apply', [K.row('Quality', dpiSel),
        check('Also remove document metadata (title, author, subject, keywords)', opts.stripMeta, function (v) { opts.stripMeta = v; }),
        h('div', { class: 'btn-row' }, applyBtn),
        note('Redacted pages are replaced by images, so the removed text cannot be copied, searched or extracted. Untouched pages keep their text. The download is always written fresh, with no edit history inside.')]));

      K.onRefresh(function () {
        found.innerHTML = '';
        if (results.length) {
          var on = results.filter(function (m) { return m.on; }).length;
          var list = h('div', { class: 'rd-items' }, results.map(function (m) {
            var c = h('input', { type: 'checkbox', checked: m.on, 'aria-label': 'Include match on page ' + (m.index + 1) });
            c.addEventListener('change', function () { m.on = c.checked; P.refresh('redact'); });
            return h('label', { class: 'rd-item' }, c, h('span', { class: 'rd-pg' }, 'p.' + (m.index + 1)), h('span', { class: 'rd-txt' }, clip(m.text, 40)));
          }));
          found.append(note(results.length + ' match' + (results.length === 1 ? '' : 'es') + ' found.'), list,
            h('div', { class: 'btn-row' }, btn('Mark ' + on + ' for redaction', 'redact', function () { A.markFound(); }, 'primary'), btn('Clear', 'close', function () { results = []; P.refresh('redact'); })));
        }
        var pend = R.pending();
        review.innerHTML = '';
        applyBtn.disabled = !pend.length;
        if (!pend.length) { review.appendChild(note('Nothing marked yet.')); return; }
        review.appendChild(note(pend.length + ' area' + (pend.length === 1 ? '' : 's') + ' on ' + pagesWith() + ' page' + (pagesWith() === 1 ? '' : 's') + '.'));
        review.appendChild(h('div', { class: 'rd-items' }, pend.map(function (x) {
          var go = h('button', { type: 'button', class: 'rd-go', title: 'Show on the page' }, h('span', { class: 'rd-pg' }, 'p.' + (x.index + 1)), h('span', { class: 'rd-txt' }, x.a.label ? '“' + clip(x.a.label, 34) + '”' : 'Drawn box'));
          go.addEventListener('click', function () { A.gotoMark(x.p.id, x.a.id); });
          var del = h('button', { type: 'button', class: 'rd-x', title: 'Remove this mark', 'aria-label': 'Remove mark on page ' + (x.index + 1), html: U.icon('close') });
          del.addEventListener('click', function () { A.removeMarks(x.p.id, x.a.id); });
          return h('div', { class: 'rd-item' }, go, del);
        })), h('div', { class: 'btn-row' }, btn('Remove all marks', 'trash', function () { A.removeMarks(null, null); }, 'danger-text')));
      });
    }
  };
})();
