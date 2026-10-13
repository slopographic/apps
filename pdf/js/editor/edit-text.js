/* Slop PDF — Edit text in place (Ctrl+E). Click a line of text on the page and type over it: the old run is covered with
   a white box and the new text is drawn at the same baseline, size and colour (the darkest ink in the run on the rendered
   page). The new text is never written into the document's own subset font (that holds only the old glyphs). It is set in
   the run's family when that family is installed (shared/fonts), else in the family the person chose in the asset check
   (font-check.js), else in the closest bundled family; standard families (Helvetica, Times, Courier) stay standard. The info
   line says which font the run uses and what the new text is set in. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, Ed = SP.editor, S = Ed._, M = window.SlopPdfMacro, F = window.SlopPdfFind;
  var cache = new Map(); // file page → Promise of { pg, runs }
  Ed.editText = false;

  /** Text runs of a page: one per pdf.js text item, with its box in page space, its PDF baseline and its font. */
  function runsOf(p) {
    var key = p.f + ':' + p.i;
    if (!cache.has(key)) {
      var f = E.fileOfPage(p), view = f.info[p.i].view;
      var pr = f.doc.getPage(p.i + 1).then(function (pg) {
        return pg.getTextContent().then(function (tc) {
          var runs = [];
          tc.items.forEach(function (it) {
            if (typeof it.str !== 'string' || !it.str.trim()) return;
            var t = it.transform, st = tc.styles[it.fontName] || {}, ps = S.embeddedName(pg, it.fontName);
            var facts = ps && window.SlopFontCatalog ? S.fontFacts(ps) : null;
            var label = (pg.commonObjs.has(it.fontName) && pg.commonObjs.get(it.fontName).name) || st.fontFamily || it.fontName;
            var fs = Math.hypot(t[2], t[3]) || it.height || 10, fam = (facts && facts.std) || M.text.family(st) || 'Helvetica';
            runs.push({
              str: it.str, fs: fs, fam: fam, fontName: it.fontName, label: label, ps: ps, facts: facts, embedded: !!ps,
              bold: /bold|black|heavy|semibold/i.test(label), italic: /italic|oblique/i.test(label),
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
      S.beginRun(p, run);
    }, function () { SlopUI.toast('This page has no text to edit.'); });
  };
  /** Opens a run: the document's fonts are checked first (once per document), then the new text's font is set up. A press
   * that has been overtaken by a later one (a double click) opens nothing. */
  S.beginRun = async function (p, run) {
    var token = S.runToken = (S.runToken || 0) + 1, f = E.fileOfPage(p);
    try {
      if (!(await S.fontsReady(f)) || token !== S.runToken) return;
      var font = await S.runFont(f, run);
      if (token === S.runToken) S.openRun(p, run, font);
    } catch (err) {
      if (token === S.runToken) { SlopUI.toast('The font could not be set up: ' + (err && err.message || err)); S.openRun(p, run, { font: run.fam, bold: run.bold, italic: run.italic, std: true }); }
    }
  };
  S.openRun = function (p, run, font) {
    var s = S.slots.get(p.id); if (!s) return;
    if (S.runEdit) S.closeRun(); // one editor at a time
    var z = Ed.zoom, b = run.box;
    var input = U.h('input', { type: 'text', class: 'edit-run', value: run.str, 'aria-label': 'Edit text' });
    input.style.left = (b.x * z) + 'px'; input.style.top = (b.y * z) + 'px';
    input.style.width = ((b.w + 6) * z) + 'px'; input.style.height = (b.h * z + 2) + 'px';
    input.style.fontSize = (run.fs * z) + 'px'; input.style.fontFamily = E.cssFont(font); input.style.fontWeight = E.cssWeight(font);
    var info = U.h('div', { class: 'edit-info' }, 'Checking the font…');
    info.style.left = (b.x * z) + 'px'; info.style.top = ((b.y + b.h) * z + 4) + 'px';
    s.layer.append(input, info);
    S.runEdit = { p: p, run: run, font: font, input: input, info: info, done: false };
    input.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); S.commitRun(); }
      else if (e.key === 'Escape') { e.preventDefault(); S.closeRun(); }
    });
    input.addEventListener('blur', function () { if (S.runEdit && S.runEdit.input === input) S.commitRun(); });
    input.focus(); input.select();
    showFontInfo(run, info, font);
  };
  /** The info line: the run's font and whether the file embeds it, and what the new text is set in. */
  function showFontInfo(run, info, font) {
    var fx = run.facts;
    if (!font.std && fx) {
      info.textContent = fx.family + ' ' + fx.weight + (fx.subset ? ' · subset in the file' : ' · embedded in full') + ' · new text in ' + font.font + ' ' + font.weight +
        (font.font === fx.family ? ' (installed)' : ' (the closest font the app has; the file’s subset is not reused)');
      return;
    }
    var embedded = !!run.ps, set = E.stdFontName({ font: font.font, bold: font.bold, italic: font.italic });
    info.textContent = run.label + (embedded ? ' · embedded' : ' · not embedded') + ' · new text in ' + set + (embedded ? ' (an embedded font cannot be reused yet)' : '');
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
  /** Edit text on the run under a selection (sel-bar.js): the run that overlaps the rect {x0, y0, x1, y1} most. */
  Ed.editSelectionRun = function (p, rect) {
    return runsOf(p).then(function (r) {
      var best = null, bestA = 0;
      r.runs.forEach(function (run) {
        var b = run.box, ox = Math.min(b.x + b.w, rect.x1) - Math.max(b.x, rect.x0), oy = Math.min(b.y + b.h, rect.y1) - Math.max(b.y, rect.y0);
        if (ox > 0 && oy > 0 && ox * oy > bestA) { best = run; bestA = ox * oy; }
      });
      if (!best) { SlopUI.toast('No text to edit there.'); return false; }
      if (!Ed.editText) Ed.toggleEditText();
      S.beginRun(p, best);
      return true;
    }, function () { SlopUI.toast('This page has no text to edit.'); return false; });
  };
  /** Applies the edited run as one undo step: cover the old run, draw the new text on its baseline. */
  S.commitRun = function () {
    var r = S.runEdit; if (!r || r.done) return;
    var text = r.input.value, run = r.run, font = r.font, p = r.p, s = S.slots.get(p.id);
    S.closeRun();
    if (text === run.str) return;
    var color = s ? inkColour(s, run) : '#000000', key = E.fontKey(font);
    var m = { segs: [{ x0: run.x0, x1: run.x0 + run.width, y: run.y, fs: run.fs }] };
    var plan = M.coverPlan(m, E.sanitize(text, key), function (t, sz) { return E.measure(t, key, sz); });
    var annots = plan.covers.map(function (c) { return F.coverAnnot(p, c); });
    if (plan.text) annots.push(F.textAnnot(p, run.x0, run.y, run.fs, plan.text.text, { font: font.font, bold: font.bold, italic: font.italic, weight: font.weight, color: color }));
    E.commit('Edit text', function (st) {
      var q = st.pages.filter(function (x) { return x.id === p.id; })[0];
      if (q) annots.forEach(function (a) { q.annots.push(JSON.parse(JSON.stringify(a))); });
    });
    if (F.refresh) F.refresh();
    Ed.paint();
  };
})();
