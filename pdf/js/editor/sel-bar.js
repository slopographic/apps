/* Slop PDF — the selection bar: one floating row of actions beside what is selected in page view, in every mode (Select and
   Edit text, Lines or Paragraphs). For selected text: Highlight, Underline, Strikethrough, Colour (a popover), Copy,
   Comment, Edit text, Remove, Redact, Replace and Find (sel-actions.js, on the snapshot of sel-track.js). For a selected
   annotation: Edit (text boxes, callouts, steps, paragraphs), Colour, Opacity (popovers), Comment, Duplicate and Delete
   (sel-annot.js; Del still deletes). It is placed from the selection's box on screen: above it, below when there is no
   room above (near the top edge), kept inside the viewport and above the on-screen keyboard (SlopKeyboard), and hidden
   when the selection scrolls out of the viewer or is cleared. Keyboard: Tab from the selection moves into the bar, Escape
   dismisses it and returns focus to the page. Styles: css/selbar.css. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, Ed = SP.editor, S = Ed._, T = S.sel, A = S.selAct, N = S.annotAct;
  var h = U.h, bar = null, row = null, pop = null, colBtn = null, dot = null, popOpen = false, raf = 0;
  var arow = null, abtns = {}, adot = null, apop = null, opop = null, mode = null; // the annotation row and its popovers
  var OPACITY = [[1, '100%'], [0.75, '75%'], [0.5, '50%'], [0.25, '25%']];
  var MARKS = ['highlight', 'underline', 'strike'], markBtns = {}, markSeq = 0; // markSeq: the token of the newest markState
  var COLOURS = [['#ffe14d', 'Yellow'], ['#34c759', 'Green'], ['#0a84ff', 'Blue'], ['#ff2d92', 'Pink'], ['#ff9500', 'Orange'], ['#e0102f', 'Red'], ['#111111', 'Black']];
  // [id, label, action or null for the colour button, group] in the order shown
  var BUTTONS = [
    ['highlight', 'Highlight', function () { return A.markup('highlight'); }, 1],
    ['underline', 'Underline', function () { return A.markup('underline'); }, 1],
    ['strike', 'Strikethrough', function () { return A.markup('strike'); }, 1],
    ['colour', 'Colour', null, 1],
    ['copy', 'Copy', function () { return A.copy(); }, 2],
    ['comment', 'Comment', function () { return A.comment(); }, 2],
    ['edit', 'Edit text', function () { return A.editText(); }, 2],
    ['remove', 'Remove', function () { return A.remove(); }, 3],
    ['redact', 'Redact', function () { return A.redact(); }, 3],
    ['replace', 'Replace', function () { return A.replace(); }, 4],
    ['find', 'Find', function () { return A.find(); }, 4]
  ];

  function editable(el) { return !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable); }
  function run(fn) { Promise.resolve().then(fn).catch(function (err) { console.error(err); SlopUI.toast('That did not work. ' + ((err && err.message) || '')); }); }

  function build() {
    bar = h('div', { class: 'selbar', role: 'toolbar', 'aria-label': 'Selected text', hidden: true });
    row = h('div', { class: 'selbar-row' });
    var last = 1;
    BUTTONS.forEach(function (b) {
      if (b[3] !== last) { row.appendChild(h('span', { class: 'selbar-sep', 'aria-hidden': 'true' })); last = b[3]; }
      if (b[0] === 'colour') {
        dot = h('span', { class: 'selbar-dot', 'aria-hidden': 'true' });
        colBtn = h('button', { type: 'button', class: 'selbar-btn', 'data-act': 'colour', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-label': 'Colour for highlight, underline and strikethrough', title: 'Colour for highlight, underline and strikethrough' }, dot, b[1]);
        colBtn.addEventListener('click', function () { if (popOpen) closePop(true); else openPop(); });
        row.appendChild(colBtn);
        return;
      }
      var isMark = MARKS.indexOf(b[0]) >= 0;
      var btn = h('button', { type: 'button', class: 'selbar-btn', 'data-act': b[0], 'aria-label': b[1], title: b[1], 'aria-pressed': isMark ? 'false' : null }, b[1]);
      if (isMark) markBtns[b[0]] = btn;
      btn.addEventListener('click', function () { run(b[2]); });
      row.appendChild(btn);
    });
    pop = h('div', { class: 'selbar-pop', role: 'dialog', 'aria-label': 'Colour', hidden: true },
      COLOURS.map(function (c) {
        var sw = h('button', { type: 'button', class: 'selbar-sw', 'aria-label': c[1], title: c[1], 'data-colour': c[0], 'aria-pressed': 'false' });
        sw.style.background = c[0];
        sw.addEventListener('click', function () { pick(c[0]); });
        return sw;
      }));
    buildAnnot();
    bar.append(row, arow, pop, apop, opop);
    // a press on the bar keeps the text selection (the actions need it); inputs in the bar still take focus
    bar.addEventListener('mousedown', function (e) { if (!e.target.closest('input, textarea')) e.preventDefault(); }); // touch-ok: only keeps the focus (browsers send it after a tap too)
    bar.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); if (popOpen) closePop(true); else leave(); }
    });
    document.body.appendChild(bar);
    document.addEventListener('keydown', onDocKey, true);
    document.addEventListener('pointerdown', function (e) { if (popOpen && !bar.contains(e.target)) closePop(false); }, true); // a finger too (the page's pointerdown stops the compatibility mousedown)
    var again = function () { if (!raf) raf = requestAnimationFrame(function () { raf = 0; place(); }); };
    window.addEventListener('resize', again);
    document.addEventListener('scroll', function () { T.rebox(); again(); }, true);
  }

  /** The annotation row: Edit, Colour, Opacity | Comment, Duplicate | Delete, and its two popovers. */
  function buildAnnot() {
    var b = function (id, label, fn, extra) {
      var el = h('button', Object.assign({ type: 'button', class: 'selbar-btn', 'data-act': id, 'aria-label': label, title: label }, extra || {}), label);
      if (fn) el.addEventListener('click', function () { run(fn); });
      return (abtns[id] = el);
    };
    adot = h('span', { class: 'selbar-dot', 'aria-hidden': 'true' });
    var ac = b('a-colour', 'Colour', null, { 'aria-haspopup': 'dialog', 'aria-expanded': 'false' }); ac.prepend(adot);
    var ao = b('a-opacity', 'Opacity', null, { 'aria-haspopup': 'dialog', 'aria-expanded': 'false' });
    ac.addEventListener('click', function () { toggle(apop, ac); });
    ao.addEventListener('click', function () { toggle(opop, ao); });
    var sep = function () { return h('span', { class: 'selbar-sep', 'aria-hidden': 'true' }); };
    arow = h('div', { class: 'selbar-row is-annot', hidden: true },
      b('a-edit', 'Edit', function () { return N.edit(); }), ac, ao, sep(),
      b('a-comment', 'Comment', function () { return N.comment(); }), b('a-duplicate', 'Duplicate', function () { return N.duplicate(); }), sep(),
      b('a-delete', 'Delete', function () { return N.remove(); }, { title: 'Delete (Del)', 'aria-keyshortcuts': 'Delete' }));
    abtns['a-delete'].classList.add('is-danger');
    apop = h('div', { class: 'selbar-pop', role: 'dialog', 'aria-label': 'Colour', hidden: true }, COLOURS.map(function (c) {
      var sw = h('button', { type: 'button', class: 'selbar-sw', 'aria-label': c[1], title: c[1], 'data-colour': c[0], 'aria-pressed': 'false' });
      sw.style.background = c[0];
      sw.addEventListener('click', function () { closePop(false); run(function () { return N.setColour(c[0]); }); });
      return sw;
    }));
    opop = h('div', { class: 'selbar-pop', role: 'dialog', 'aria-label': 'Opacity', hidden: true }, OPACITY.map(function (o) {
      var ob = h('button', { type: 'button', class: 'selbar-btn selbar-op', 'data-opacity': String(o[0]), 'aria-pressed': 'false' }, o[1]);
      ob.addEventListener('click', function () { closePop(false); run(function () { return N.setOpacity(o[0]); }); });
      return ob;
    }));
  }
  /** Opens one of the annotation popovers (closing the other), or closes it. */
  function toggle(p, btn) {
    var open = p.hidden;
    closePop(false);
    if (!open) return;
    popOpen = true; p.hidden = false; btn.setAttribute('aria-expanded', 'true');
    var a = N.target();
    if (a) p.querySelectorAll('[aria-pressed]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.dataset.colour ? x.dataset.colour === N.colour(a) : +x.dataset.opacity === N.opacity(a))); });
    var cur = p.querySelector('[aria-pressed="true"]') || p.querySelector('button'); if (cur) cur.focus();
  }
  /** Shows the annotation row for the selected annotation: its buttons fit its type. */
  function annotRow(a) {
    abtns['a-edit'].hidden = !N.canEdit(a);
    abtns['a-colour'].hidden = !N.colourKey(a);
    abtns['a-opacity'].hidden = !N.canOpacity(a);
    adot.style.background = N.colour(a);
    bar.setAttribute('aria-label', 'Selected ' + N.name(a).toLowerCase());
  }

  /** Tab from a selection moves into the bar; Escape anywhere with the bar up dismisses it. */
  function onDocKey(e) {
    if (!bar || bar.hidden || bar.contains(e.target) || editable(e.target)) return;
    if (e.key === 'Tab' && !e.shiftKey) {
      var first = (mode === 'annot' ? arow : row).querySelector('button:not([hidden])');
      if (first) { e.preventDefault(); first.focus(); }
    } else if (e.key === 'Escape') { T.dismiss(); }
  }
  /** Leaves the bar: the selection stays, the bar hides until the selection changes, and focus goes back to the page. */
  function leave() {
    if (bar.contains(document.activeElement)) document.activeElement.blur();
    if (mode === 'annot') { dismissed = Ed.selId; render(); return; }
    T.dismiss();
  }
  var dismissed = null; // the annotation whose bar Escape put away (it comes back when another one is selected)

  /** Shows the bar for what is selected, or hides it: a selected annotation first, else the text selection. Runs on every
      selection change (sel-track.js) and every repaint of the selection (view.js drawSelection). */
  function render() {
    var a = N && Ed.selId && Ed.selId !== dismissed ? N.target() : null;
    if (Ed.selId !== dismissed) dismissed = null;
    var next = a ? 'annot' : T.shown() ? 'text' : null;
    if (!bar) { if (!next) return; build(); }
    if (next !== mode) closePop(false);
    mode = next;
    if (!next) { bar.hidden = true; markSeq++; setPressed(null); return; }
    row.hidden = next !== 'text'; arow.hidden = next !== 'annot';
    if (next === 'annot') { annotRow(a); place(); return; }
    bar.setAttribute('aria-label', 'Selected text');
    colour();
    place();
    markState();
  }
  /** Shows which markup the selection already has: the markup buttons are pressed (aria-pressed, is-on) for those styles.
      The answer is async, so a token drops any answer that a newer selection has overtaken. */
  function markState() {
    var token = ++markSeq, snap = T.snap;
    A.markedStyles(snap).then(function (set) { if (token === markSeq) setPressed(set); },
      function () { if (token === markSeq) setPressed(null); });
  }
  /** Sets the pressed state of each markup button from a Set of styles (null clears them all). */
  function setPressed(set) {
    MARKS.forEach(function (s) {
      var btn = markBtns[s], on = !!(set && set.has(s));
      if (!btn) return;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  /** Puts the bar above the selection, below it when there is no room above, inside the viewport. */
  function place() {
    if (!bar || !mode) return;
    var b = mode === 'annot' ? N.box() : T.snap && T.snap.box, vr = S.viewer ? S.viewer.getBoundingClientRect() : { top: 0, bottom: innerHeight };
    if (!b) { bar.hidden = true; return; }
    if (b.bottom < vr.top || b.top > vr.bottom) { bar.hidden = true; return; } // the selection is scrolled out of view
    bar.hidden = false;
    bar.style.left = '0px'; bar.style.top = '0px';
    // above the on-screen keyboard: its top is the bottom of the space the bar may use
    var kb = window.SlopKeyboard && SlopKeyboard.height() ? SlopKeyboard.visible() : null;
    var w = bar.offsetWidth, ht = bar.offsetHeight, vw = innerWidth, vh = kb ? Math.min(innerHeight, kb.bottom) : innerHeight, M = 8, GAP = 10;
    var x = U.clamp(b.left + (b.right - b.left) / 2 - w / 2, M, Math.max(M, vw - w - M));
    var above = b.top - ht - GAP, below = b.bottom + GAP, y;
    if (above >= M) y = above;
    else if (below + ht <= vh - M) y = below;
    else y = (b.top >= vh - b.bottom) ? Math.max(M, above) : Math.min(below, vh - ht - M);
    y = U.clamp(y, M, Math.max(M, vh - ht - M));
    bar.style.left = Math.round(x) + 'px'; bar.style.top = Math.round(y) + 'px';
    bar.classList.toggle('pop-below', y < 230); // the colour popover opens on the side with room
  }
  /** The colour button's dot shows the colour the next highlight, underline or strikethrough uses. */
  function colour() { if (dot) dot.style.background = A.colour(); }
  function openPop() {
    popOpen = true; pop.hidden = false; colBtn.setAttribute('aria-expanded', 'true');
    pop.querySelectorAll('.selbar-sw').forEach(function (sw) { sw.setAttribute('aria-pressed', String(sw.dataset.colour === A.colour())); });
    var cur = pop.querySelector('[aria-pressed="true"]') || pop.querySelector('button'); if (cur) cur.focus();
  }
  function closePop(focusBtn) {
    if (!pop) return;
    popOpen = false; pop.hidden = true; if (colBtn) colBtn.setAttribute('aria-expanded', 'false');
    [apop, opop].forEach(function (p) { if (p) p.hidden = true; });
    ['a-colour', 'a-opacity'].forEach(function (k) { if (abtns[k]) abtns[k].setAttribute('aria-expanded', 'false'); });
    if (focusBtn && colBtn) colBtn.focus();
  }
  /** A swatch: the colour is used by the next markup, and existing markup under the selection takes it. */
  function pick(col) {
    closePop(true);
    run(function () { return A.setColour(col); }); // sel-actions.js (recolours and refreshes the dot through render)
  }

  T.onChange(render);
  // every repaint of the selection (a selected annotation, its move, the page or zoom changing) places the bar again
  var draw = S.drawSelection;
  S.drawSelection = function () { var r = draw.apply(this, arguments); render(); return r; };
  window.addEventListener('slopkeyboard', function () { if (bar && mode) place(); });
  window.SlopSelBar = { place: place, leave: leave, update: render, mode: function () { return mode; }, isOpen: function () { return !!bar && !bar.hidden; } };
})();
