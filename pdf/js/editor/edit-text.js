/* Slop PDF — Edit text in place (Ctrl+E). Click a line of text on the page and type over it: the old run is covered with
   a white box and the new text is drawn at the same baseline, size and colour (the darkest ink in the run on the rendered
   page). The new text is set in the standard font of the run's family (Helvetica, Times or Courier, bold and italic where
   the run has them). The info line says whether the run's font is embedded in the file. Reusing an embedded font is not
   done: pdf-lib needs fontkit to embed one, and fontkit is not vendored, so the new text is always a standard font. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, Ed = SP.editor, S = Ed._, M = window.SlopPdfMacro, F = window.SlopPdfFind;
  var cache = new Map(); // file page → Promise of { pg, runs }
  Ed.editText = false;

  /** Text runs of a page: one per pdf.js text item, with its box in page space and its PDF baseline and font. */
  function runsOf(p) {
    var key = p.f + ':' + p.i;
    if (!cache.has(key)) {
      var f = E.fileOfPage(p), view = f.info[p.i].view;
      var pr = f.doc.getPage(p.i + 1).then(function (pg) {
        return pg.getTextContent().then(function (tc) {
          var runs = [];
          tc.items.forEach(function (it) {
            if (typeof it.str !== 'string' || !it.str.trim()) return;
            var t = it.transform, st = tc.styles[it.fontName] || {}, name = (st.fontFamily || '') + ' ' + it.fontName;
            var fs = Math.hypot(t[2], t[3]) || it.height || 10, fam = M.text.family(st) || 'Helvetica';
            runs.push({
              str: it.str, fs: fs, fam: fam, fontName: it.fontName, bold: /bold|black|heavy|semibold/i.test(name), italic: /italic|oblique/i.test(name),
              x0: t[4], y: t[5], width: it.width || 0, box: SP.redact.itemBox(it, 0, it.str.length, view, st.fontFamily), pg: pg
            });
          });
          return { pg: pg, runs: runs };
        });
      });
      pr.catch(function () { cache.delete(key); });
      cache.set(key, pr);
    }
    return cache.get(key);
  }
  /** The run under a page point (the smallest box, with a little slack), or null. */
  function pick(runs, pt) {
    var best = null, slack = 2;
    runs.forEach(function (r) {
      var b = r.box;
      if (pt[0] < b.x - slack || pt[0] > b.x + b.w + slack || pt[1] < b.y - slack || pt[1] > b.y + b.h + slack) return;
      if (!best || b.w * b.h < best.box.w * best.box.h) best = r;
    });
    return best;
  }

  Ed.toggleEditText = function () {
    if (Ed.editText) { S.closeRun(); Ed.editText = false; SlopUI.toast('Edit text is off.'); }
    else { Ed.editText = true; SlopUI.toast('Edit text: click a line of text, type, then Enter to apply (Esc cancels).', 5000); }
    if (S.viewer) S.viewer.classList.toggle('edit-text', Ed.editText);
  };

  /** A press in edit mode: the run under the pointer opens for editing. */
  S.runDown = function (e, p) {
    var pt = S.pagePt(e);
    if (S.runEdit) { S.commitRun(); }
    runsOf(p).then(function (r) {
      var run = pick(r.runs, pt);
      if (!run) { SlopUI.toast('No text there. Click on a line of text.'); return; }
      S.openRun(p, run);
    }, function () { SlopUI.toast('This page has no text to edit.'); });
  };
  S.openRun = function (p, run) {
    var s = S.slots.get(p.id); if (!s) return;
    var z = Ed.zoom, b = run.box;
    var input = U.h('input', { type: 'text', class: 'edit-run', value: run.str, 'aria-label': 'Edit text' });
    input.style.left = (b.x * z) + 'px'; input.style.top = (b.y * z) + 'px';
    input.style.width = ((b.w + 6) * z) + 'px'; input.style.height = (b.h * z + 2) + 'px';
    input.style.fontSize = (run.fs * z) + 'px'; input.style.fontFamily = E.CSSFONT[run.fam] || E.CSSFONT.Helvetica;
    var info = U.h('div', { class: 'edit-info' }, 'Checking the font…');
    info.style.left = (b.x * z) + 'px'; info.style.top = ((b.y + b.h) * z + 4) + 'px';
    s.layer.append(input, info);
    S.runEdit = { p: p, run: run, input: input, info: info, done: false };
    input.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); S.commitRun(); }
      else if (e.key === 'Escape') { e.preventDefault(); S.closeRun(); }
    });
    input.addEventListener('blur', function () { if (S.runEdit && S.runEdit.input === input) S.commitRun(); });
    input.focus(); input.select();
    showFontInfo(run, info);
  };
  /** The info line: the font's name and whether the file embeds it, and what the new text is set in. */
  function showFontInfo(run, info) {
    var ok = run.pg.commonObjs && run.pg.commonObjs.has(run.fontName), fo = ok ? run.pg.commonObjs.get(run.fontName) : null;
    var name = (fo && fo.name) || run.fontName, embedded = !!fo && !fo.missingFile;
    var set = E.stdFontName({ font: run.fam, bold: run.bold, italic: run.italic });
    info.textContent = name + (ok ? (embedded ? ' · embedded' : ' · not embedded') : '') + ' · new text in ' + set +
      (embedded ? ' (an embedded font cannot be reused yet)' : '');
  }
  S.closeRun = function () {
    var r = S.runEdit; if (!r) return;
    S.runEdit = null; r.done = true;
    r.input.remove(); r.info.remove();
  };
  /** The darkest ink inside the run's box on the rendered page; black when the page is not rendered. */
  function inkColour(s, run) {
    var c = s.canvas, g = E.geom(E.pageById(s.pid));
    if (!c || !c.width || !g.W) return '#000000';
    var k = c.width / g.W, b = run.box, x = Math.max(0, Math.floor(b.x * k)), y = Math.max(0, Math.floor(b.y * k));
    var w = Math.min(c.width - x, Math.ceil(b.w * k)), h = Math.min(c.height - y, Math.ceil(b.h * k));
    if (w < 1 || h < 1) return '#000000';
    var d = c.getContext('2d').getImageData(x, y, w, h).data, best = null, bestSum = 1e9;
    for (var i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;
      var sum = d[i] + d[i + 1] + d[i + 2];
      if (sum < bestSum) { bestSum = sum; best = [d[i], d[i + 1], d[i + 2]]; }
    }
    if (!best || bestSum > 600) return '#000000'; // nothing dark: keep black
    return '#' + best.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
  }
  /** Applies the edited run as one undo step: cover the old run, draw the new text on its baseline. */
  S.commitRun = function () {
    var r = S.runEdit; if (!r || r.done) return;
    var text = r.input.value, run = r.run, p = r.p, s = S.slots.get(p.id);
    S.closeRun();
    if (text === run.str) return;
    var color = s ? inkColour(s, run) : '#000000';
    var m = { segs: [{ x0: run.x0, x1: run.x0 + run.width, y: run.y, fs: run.fs }] };
    var plan = M.coverPlan(m, E.sanitize(text, E.stdFontName({ font: run.fam, bold: run.bold, italic: run.italic })), function (t, sz) { return E.measure(t, run.fam, sz); });
    var annots = plan.covers.map(function (c) { return F.coverAnnot(p, c); });
    if (plan.text) annots.push(F.textAnnot(p, run.x0, run.y, run.fs, plan.text.text, { font: run.fam, bold: run.bold, italic: run.italic, color: color }));
    E.commit('Edit text', function (st) {
      var q = st.pages.filter(function (x) { return x.id === p.id; })[0];
      if (q) annots.forEach(function (a) { q.annots.push(JSON.parse(JSON.stringify(a))); });
    });
    if (F.refresh) F.refresh();
    Ed.paint();
  };
})();
