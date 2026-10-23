/* Slop PDF — the text selection actions (the buttons of sel-bar.js). Highlight, Underline and Strikethrough add text-markup
   annotations (type texthl, style highlight | underline | strike) as one undo step each, in the edit log; a press on text
   already marked in that style removes the markup instead (a toggle). Colour sets the
   colour of the next markup and recolours the markup under the selection. Remove hides the selected text the way Edit text
   clears it (white covers, OCR words emptied; no rasterizing, one undo step). Redact marks the selected text for the Redact
   tool, which applies it. Copy, Comment, Edit text, Replace and Find use the same snapshot. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, Ed = SP.editor, S = Ed._, T = S.sel, R = SP.redact, G = window.SlopPdfSel;
  var A = S.selAct = {};
  var LABELS = { highlight: 'Highlight text', underline: 'Underline text', strike: 'Strike through text' };
  var NAME = { highlight: 'highlight', underline: 'underline', strike: 'strikethrough' };
  var STYLES = ['highlight', 'underline', 'strike'];
  var MATCH = 0.6; // the share of the selection's area that existing markup of the style must cover for a press to remove it
  var colour = null;

  /** The selection's quads and boxes per page, from the page's lines: [{pid, p, quads, boxes}] for the parts with text. */
  async function geometry(snap) {
    var out = [];
    for (var k = 0; k < snap.parts.length; k++) {
      var part = snap.parts[k], lines = await E.pageTextLines(part.p);
      var quads = G.selectionQuads(lines, part.rects);
      if (quads.length) out.push({ pid: part.pid, p: part.p, quads: quads, rects: part.rects, boxes: G.selectionBoxes(lines, part.rects, 1) });
    }
    return out;
  }
  /** Whether any quad of a markup annotation (four points per line) touches one of the selection's rectangles. */
  function touches(pts, rects) {
    return G.rectsOf(pts).some(function (b) {
      return rects.some(function (r) { return b.x0 < r.x1 && r.x0 < b.x1 && b.y0 < r.y1 && r.y0 < b.y1; });
    });
  }
  /** A markup's style; text highlights made by dragging carry none and are highlights. */
  function styleOf(a) { return a.style || 'highlight'; }
  /** The texthl annotations of this style on a page. */
  function markupOn(pid, style) {
    var pg = E.state.pages.filter(function (x) { return x.id === pid; })[0];
    return pg ? (pg.annots || []).filter(function (a) { return a.type === 'texthl' && a.pts && a.pts.length && styleOf(a) === style; }) : [];
  }
  /** Whether the selection is already marked in this style: the existing markup covers at least MATCH of its area. */
  function alreadyMarked(geo, style) {
    var total = 0, uncovered = 0;
    geo.forEach(function (g) {
      var sel = G.rectsOf(g.quads), old = [];
      markupOn(g.pid, style).forEach(function (a) { old = old.concat(G.rectsOf(a.pts)); });
      total += G.rectsArea(sel);
      uncovered += G.rectsArea(G.rectsMinus(sel, old));
    });
    return total > 0 && total - uncovered >= MATCH * total;
  }
  function defaultColour() { return (Ed.defaults && Ed.defaults.texthl && Ed.defaults.texthl.color) || '#ffe14d'; }

  /** The colour the next highlight, underline or strikethrough uses. */
  A.colour = function () { return colour || defaultColour(); };
  /** Sets the colour; the markup under the selection takes it too (one undo step). */
  A.setColour = async function (col) {
    colour = col;
    var snap = T.snap;
    if (snap) {
      E.commit('Change markup colour', function (st) {
        snap.parts.forEach(function (part) {
          var q = st.pages.filter(function (x) { return x.id === part.pid; })[0];
          (q ? q.annots || [] : []).forEach(function (a) { if (a.type === 'texthl' && a.pts && touches(a.pts, part.rects)) a.color = col; });
        });
      });
      Ed.paint();
    }
    T.emit();
    SlopUI.toast('Colour set. Highlight, underline and strikethrough use it.');
  };

  /** Removes the markup of this style under the selection: each annotation loses the parts the selection covers and keeps
      the rest; one left empty goes. One undo step. */
  function removeMarkup(geo, style) {
    E.commit('Remove ' + NAME[style], function (st) {
      geo.forEach(function (g) {
        var cut = G.rectsOf(g.quads), pg = st.pages.filter(function (x) { return x.id === g.pid; })[0];
        if (!pg) return;
        pg.annots = pg.annots.reduce(function (keep, a) {
          if (a.type !== 'texthl' || styleOf(a) !== style || !a.pts || !touches(a.pts, cut)) { keep.push(a); return keep; }
          var rest = G.rectsMinus(G.rectsOf(a.pts), cut);
          if (rest.length) { a.pts = [].concat.apply([], rest.map(G.rectQuad)); keep.push(a); }
          return keep;
        }, []);
      });
    });
    Ed.selId = null; Ed.paint();
    SlopUI.toast('Removed the ' + NAME[style] + '.');
    T.emit();
  }

  /** Adds highlight, underline or strikethrough over the selected text, one annotation per page, one undo step. Text
      already marked in that style is unmarked instead (removeMarkup), so a second press toggles it off. */
  A.markup = async function (style) {
    var snap = T.snap; if (!snap) return;
    var geo = await geometry(snap);
    if (!geo.length) { SlopUI.toast('No text under the selection.'); return; }
    if (alreadyMarked(geo, style)) { removeMarkup(geo, style); return; }
    var op = style === 'highlight' ? ((Ed.defaults && Ed.defaults.texthl && Ed.defaults.texthl.opacity) || 0.4) : 1;
    var made = geo.map(function (g) { return { pid: g.pid, a: { id: U.uid('a'), type: 'texthl', style: style, color: A.colour(), opacity: op, pts: g.quads } }; });
    E.commit(LABELS[style], function (st) {
      made.forEach(function (m) {
        var q = st.pages.filter(function (x) { return x.id === m.pid; })[0];
        if (q) q.annots.push(JSON.parse(JSON.stringify(m.a)));
      });
    });
    Ed.selId = null; Ed.paint();
    T.emit();
  };

  /** The styles the selection is already marked in, by the toggle's own rule (alreadyMarked): a Set of 'highlight',
      'underline' and 'strike'. Empty when there is no text under the selection. sel-bar.js shows it as pressed buttons. */
  A.markedStyles = async function (snap) {
    var out = new Set(), geo = snap ? await geometry(snap) : [];
    if (geo.length) STYLES.forEach(function (s) { if (alreadyMarked(geo, s)) out.add(s); });
    return out;
  };

  /** Copies the selected text (line breaks kept, as the browser gives them). */
  A.copy = async function () {
    var snap = T.snap; if (!snap) return;
    var sel = window.getSelection ? window.getSelection() : null, text = (sel && sel.toString()) || snap.text;
    function fallback() {
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      SlopUI.toast(ok ? 'Copied the selected text.' : 'Could not copy. Press Ctrl+C with the text selected.');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try { await navigator.clipboard.writeText(text); SlopUI.toast('Copied the selected text.'); return; } catch (e) { /* the copy command below */ }
    }
    fallback();
  };

  /** Opens the comment composer on the selection's first line (the comment tool, at that spot). */
  A.comment = function () {
    var snap = T.snap; if (!snap) return;
    var part = snap.parts[0];
    if (Ed.pid !== part.pid) Ed.show(part.pid);
    Ed.setTool('note');
    Ed.noteUI.compose(part.p, snap.start.slice());
  };

  /** Edit text on the run under the selection's first line (edit-text.js). */
  A.editText = async function () {
    var snap = T.snap; if (!snap) return;
    var part = snap.parts[0];
    if (Ed.pid !== part.pid) Ed.show(part.pid);
    await Ed.editSelectionRun(part.p, part.rects[0]);
  };

  /** Find: the selected text goes into the find bar, which searches from its first match. */
  A.find = function () {
    var snap = T.snap; if (!snap) return;
    window.SlopPdfFind.open(snap.text.slice(0, 200));
  };
  /** Replace: the Replace dialog opens with the selected text as the find text. */
  A.replace = function () {
    var snap = T.snap; if (!snap) return;
    window.SlopPdfFind.openReplace(snap.text.slice(0, 200), { caseSensitive: false, wholeWord: false });
  };

  /** A white cover over one selected line (page space, top-left origin): the whiteout Edit text makes for cleared text. */
  function coverOf(b) { return { id: U.uid('a'), type: 'whiteout', cx: b.x + b.w / 2, cy: b.y + b.h / 2, w: b.w, h: b.h, rot: 0, fill: '#ffffff', opacity: 1 }; }
  /** OCR words under the selection are emptied in the page's content (OL.replaceWord), one new file per document file
      touched. Returns [{file, pids}] for the commit; a word that cannot be found keeps only its cover. */
  async function emptyOcrWords(geo) {
    var files = new Map();
    geo.forEach(function (g) {
      var f = E.fileOfPage(g.p); if (!f) return;
      if (!files.has(f.id)) files.set(f.id, { f: f, bytes: f.bytes, pids: [], changed: false });
      files.get(f.id).pids.push(g.pid);
    });
    var out = [];
    for (const [fid, job] of files) {
      for (const g of geo.filter(function (x) { return x.p.f === fid && job.f.ocr; })) {
        var runs = (await Ed.runsUnder(g.p, g.rects)).filter(function (r) { return r.ocr; });
        for (const run of runs) {
          var next = await SP.ocrLayer.replaceWord(job.bytes, g.p.i, run, '', null);
          if (next) { job.bytes = next; job.changed = true; }
        }
      }
      if (job.changed) {
        var made = await E.registerPdf(job.bytes, job.f.name, null);
        made.noLog = true; made.ocr = true; // generated: its bytes cannot be replayed from the edit log
        out.push({ to: made.id, pids: job.pids });
      }
    }
    return out;
  }

  /** Remove: the selected text leaves the page the way Edit text clears it: each selected line gets a white cover, and the
      OCR words under it are emptied in the content. No page image is rebuilt and nothing asks first. One undo step. */
  A.remove = async function () {
    var snap = T.snap; if (!snap) return;
    var geo = await geometry(snap);
    if (!geo.length) { SlopUI.toast('No text under the selection.'); return; }
    var covers = [];
    geo.forEach(function (g) { g.boxes.forEach(function (b) { covers.push({ pid: g.pid, a: coverOf(b) }); }); });
    var files = await emptyOcrWords(geo);
    E.commit('Remove text', function (st) {
      covers.forEach(function (c) {
        var q = st.pages.filter(function (x) { return x.id === c.pid; })[0];
        if (q) q.annots.push(JSON.parse(JSON.stringify(c.a)));
      });
      files.forEach(function (fl) {
        fl.pids.forEach(function (pid) { var q = st.pages.filter(function (x) { return x.id === pid; })[0]; if (q) q.f = fl.to; });
      });
    });
    Ed.selId = null; Ed.paint();
    SlopUI.toast('Text removed. Undo brings it back.');
    T.emit();
  };

  /* ------------------------------------------------ text selection box: move and resize the selected text
     With the select tool, a text selection on one page (not rotated) shows a box with the annotation handles. Pressing the box
     or a handle lifts the selected text into editable layers: a white cover over each selected line and one text annotation with
     the same words at the same place (set in a standard face: the run's family when it is one of the three). The lift is one
     undo step and is made at the first movement, so a press alone changes nothing; the lifted text is then moved or resized as
     an annotation. The pieces are worked out when the selection is made (A.prepare), so the press itself is synchronous. */
  /** The lift for a selection: {pid, box: {x0, y0, x1, y1}, text: the annotation, annots: covers then the text}, or null. */
  function liftData(part, lines, runs) {
    var spans = G.selectedSpans(lines, part.rects);
    var rows = spans.map(function (s) { return { x: s.x0, top: s.ln.top, bottom: s.ln.bottom, text: spanText(s.ln, part.rects) }; }).filter(function (r) { return r.text; });
    if (!rows.length) return null;
    var run = runs[0], fam = run && /^(Helvetica|Times|Courier)$/.test(run.fam) ? run.fam : 'Helvetica';
    var size = U.round((rows[0].bottom - rows[0].top) / 1.02, 1); // the glyph band is 1.02 em: 0.8 em above the baseline, 0.22 em below
    var text = { id: U.uid('a'), type: 'text', text: rows.map(function (r) { return r.text; }).join('\n'), font: fam, bold: !!(run && run.bold), italic: !!(run && run.italic), size: size, color: '#000000', opacity: 1, rot: 0 };
    var t = E.textLayout(text), left = Math.min.apply(null, rows.map(function (r) { return r.x; })) - t.pad;
    var baseline = rows[0].bottom - 0.22 * size, top = baseline - t.base(0); // the layout puts the first baseline at base(0) below the top
    text.w = t.w; text.h = t.h; text.cx = left + t.w / 2; text.cy = top + t.h / 2;
    var boxes = G.selectionBoxes(lines, part.rects, 1), covers = boxes.map(coverOf);
    var x0 = Math.min.apply(null, boxes.map(function (b) { return b.x; })), y0 = Math.min.apply(null, boxes.map(function (b) { return b.y; }));
    var x1 = Math.max.apply(null, boxes.map(function (b) { return b.x + b.w; })), y1 = Math.max.apply(null, boxes.map(function (b) { return b.y + b.h; }));
    return { pid: part.pid, box: { x0: x0, y0: y0, x1: x1, y1: y1 }, text: text, annots: covers.concat([text]) };
  }
  /** The words of one line that lie inside the selection's rectangles (spaces kept between them, ends trimmed). */
  function spanText(ln, rects) {
    return ln.chars.filter(function (c) {
      var cx = (c.x0 + c.x1) / 2, cy = (c.top + c.bottom) / 2;
      return rects.some(function (r) { return cx >= r.x0 && cx <= r.x1 && cy >= r.y0 && cy <= r.y1; });
    }).map(function (c) { return c.ch; }).join('').replace(/\s+/g, ' ').trim();
  }
  /** Works out the lift of a new selection (sel-bar.js calls it on each selection): on one unrotated page, the lift's data
      comes in later and the box shows then. snap.plan = {data} once known (data null when there is nothing to lift). */
  A.prepare = function (snap) {
    if (snap.plan || snap.parts.length !== 1) return;
    var part = snap.parts[0];
    snap.plan = { data: null };
    if (part.p.blank || E.rotation(part.p) !== 0) return;
    Promise.all([E.pageTextLines(part.p), Ed.runsUnder(part.p, part.rects)]).then(function (res) {
      snap.plan.data = liftData(part, res[0], res[1]);
      if (T.snap === snap && snap.plan.data && S.drawSelection) S.drawSelection();
    }, function () { /* no text positions: no box, the bar still works */ });
  };
  /** The selection box and its handles on the overlay (view.js drawSelection calls it when no annotation is selected). */
  S.drawTextBox = function () {
    var snap = T.snap, d = snap && snap.plan && snap.plan.data;
    if (!d || !T.shown() || Ed.editText || d.pid !== Ed.pid) return;
    var z = Ed.zoom, b = d.box, w = b.x1 - b.x0, h = b.y1 - b.y0;
    var box = U.h('div', { class: 'sel-box is-text' });
    box.style.left = (b.x0 * z) + 'px'; box.style.top = (b.y0 * z) + 'px'; box.style.width = (w * z) + 'px'; box.style.height = (h * z) + 'px';
    S.overlay.appendChild(box);
    ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(function (k) {
      var el = U.h('div', { class: 'handle h-' + k, 'data-h': k, 'data-tb': '1' });
      el.style.left = ((b.x0 + (/w/.test(k) ? 0 : /e/.test(k) ? w : w / 2)) * z) + 'px';
      el.style.top = ((b.y0 + (/n/.test(k) ? 0 : /s/.test(k) ? h : h / 2)) * z) + 'px';
      S.overlay.appendChild(el);
    });
  };
  /** What a press on the text selection box hits: a handle's name, 'move' for the box, or null. */
  S.textBoxHit = function (e) {
    var t = e.target; if (!t.closest) return null;
    var h = t.closest('.handle[data-tb]'); if (h) return h.getAttribute('data-h');
    return t.closest('.sel-box.is-text') ? 'move' : null;
  };
  /** A press on the box or a handle: the lift happens at the first real movement (2 px), then the lifted text is dragged by
      startEdit (pointer.js) as an annotation. A press without movement lifts nothing and keeps the selection. */
  S.liftEdit = function (e, h) {
    var snap = T.snap, d = snap && snap.plan && snap.plan.data; if (!d) return;
    e.preventDefault();
    S.pageEl.setPointerCapture(e.pointerId);
    function cleanup() {
      S.pageEl.removeEventListener('pointermove', mv); S.pageEl.removeEventListener('pointerup', cleanup); S.pageEl.removeEventListener('pointercancel', cleanup);
    }
    function mv(ev) {
      var v = S.viewPt(ev), s0 = S.viewPt(e);
      if (Math.hypot(v[0] - s0[0], v[1] - s0[1]) * Ed.zoom < 2) return;
      cleanup();
      snap.plan = null; // one lift per selection
      var pid = d.pid;
      E.commit('Lift text', function (st) {
        var q = st.pages.filter(function (x) { return x.id === pid; })[0];
        if (q) d.annots.forEach(function (a) { q.annots.push(JSON.parse(JSON.stringify(a))); });
      });
      if (window.getSelection) window.getSelection().removeAllRanges(); // the text is now the annotation
      Ed.select(d.text.id);
      S.startEdit(e, h);
    }
    S.pageEl.addEventListener('pointermove', mv); S.pageEl.addEventListener('pointerup', cleanup); S.pageEl.addEventListener('pointercancel', cleanup);
  };
  // each selection: its lift is worked out, and the box is drawn (or cleared) on the page in view
  T.onChange(function () { if (T.snap) A.prepare(T.snap); if (S.overlay && Ed.pid) S.drawSelection(); });

  /** Redact: the selected lines become redaction marks (R.mark, the Redact tool's marks). Nothing is applied: the marks are
      burned in by Apply redactions in the Redact tool. One undo step. */
  A.redact = async function () {
    var snap = T.snap; if (!snap) return;
    var geo = await geometry(snap), made = [];
    geo.forEach(function (g) { g.boxes.forEach(function (b) { made.push({ pid: g.pid, a: R.mark(b, snap.text.slice(0, 40)) }); }); });
    if (!made.length) { SlopUI.toast('No text under the selection.'); return; }
    E.commit('Mark for redaction', function (st) {
      made.forEach(function (m) {
        var q = st.pages.filter(function (x) { return x.id === m.pid; })[0];
        if (q) q.annots.push(JSON.parse(JSON.stringify(m.a)));
      });
    });
    Ed.selId = null; Ed.paint();
    SlopUI.toast(made.length + ' area' + (made.length === 1 ? '' : 's') + ' marked for redaction. Apply them in the Redact tool.');
    T.emit();
  };
})();
