/* Slop PDF — the text selection actions (the buttons of sel-bar.js). Highlight, Underline and Strikethrough add text-markup
   annotations (type texthl, style highlight | underline | strike) as one undo step each, in the edit log; a press on text
   already marked in that style removes the markup instead (a toggle). Colour sets the
   colour of the next markup and recolours the markup under the selection. Remove redacts the selected text through the
   redaction code (redact/apply.js), behind a confirmation. Copy, Comment, Edit text, Replace and Find use the same snapshot. */
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
      if (quads.length) out.push({ pid: part.pid, p: part.p, quads: quads, boxes: G.selectionBoxes(lines, part.rects, 1) });
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

  /** Remove: the selected text's lines become redaction boxes, applied at once (the same burn-in as Apply redactions),
      behind a confirmation. One undo step. The other pending marks in the document are applied with it. */
  A.remove = async function () {
    var snap = T.snap; if (!snap) return;
    var geo = await geometry(snap), extra = [];
    geo.forEach(function (g) { g.boxes.forEach(function (b) { extra.push({ p: g.p, box: b }); }); });
    if (!extra.length) { SlopUI.toast('No text under the selection.'); return; }
    var others = R.pending().length;
    var ok = await SlopUI.confirm('Remove the selected text from the file?',
      'The selected text is removed from the file, not just covered. Its whole page is rebuilt as an image, as with Apply redactions, ' +
      'so the rest of that page\'s text also stops being selectable, searchable and copyable. ' +
      (others ? others + ' other pending redaction mark' + (others === 1 ? ' is' : 's are') + ' in this document are applied too. ' : '') +
      'Undo works while this document is open. A downloaded file keeps the text removed.', 'Remove text', { danger: true });
    if (!ok) return;
    var dpi = +U.store.get('redactDpi', 200) || 200;
    return SP.app._.guarded('Removing text…', async function (prog) {
      var r = await E.applyRedactions({ dpi: dpi, extra: extra, onProgress: function (f) { prog(f, 'Removing text… ' + Math.round(f * 100) + '%'); } });
      SlopUI.toast('Text removed (' + r.marks + ' area' + (r.marks === 1 ? '' : 's') + '). Download to save the file without it.');
      return r;
    });
  };
})();
