/* Slop PDF — the text selection bar: a floating row of actions beside a text selection in page view. Highlight, Underline,
   Strikethrough, Copy, Comment, Edit text, Colour (a popover), Remove, Replace and Find. It is placed from the selection's
   box on screen: above it, below when there is no room above, kept inside the viewport, and hidden when the selection
   scrolls out of the viewer or is cleared. Keyboard: Tab from the selection moves into the bar, Escape dismisses it and
   returns focus to the page. The actions are in sel-actions.js, the snapshot in sel-track.js, the styles in css/selbar.css. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, Ed = SP.editor, S = Ed._, T = S.sel, A = S.selAct;
  var h = U.h, bar = null, row = null, pop = null, colBtn = null, dot = null, popOpen = false, raf = 0;
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
      var btn = h('button', { type: 'button', class: 'selbar-btn' + (b[0] === 'remove' ? ' is-danger' : ''), 'data-act': b[0], 'aria-label': b[1], title: b[1] }, b[1]);
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
    bar.append(row, pop);
    // a press on the bar keeps the text selection (the actions need it); inputs in the bar still take focus
    bar.addEventListener('mousedown', function (e) { if (!e.target.closest('input, textarea')) e.preventDefault(); });
    bar.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); if (popOpen) closePop(true); else leave(); }
    });
    document.body.appendChild(bar);
    document.addEventListener('keydown', onDocKey, true);
    document.addEventListener('mousedown', function (e) { if (popOpen && !bar.contains(e.target)) closePop(false); }, true);
    var again = function () { if (!raf) raf = requestAnimationFrame(function () { raf = 0; place(); }); };
    window.addEventListener('resize', again);
    document.addEventListener('scroll', function () { T.rebox(); again(); }, true);
  }

  /** Tab from a selection moves into the bar; Escape anywhere with the bar up dismisses it. */
  function onDocKey(e) {
    if (!bar || bar.hidden || bar.contains(e.target) || editable(e.target)) return;
    if (e.key === 'Tab' && !e.shiftKey) {
      var first = row.querySelector('button');
      if (first) { e.preventDefault(); first.focus(); }
    } else if (e.key === 'Escape') { T.dismiss(); }
  }
  /** Leaves the bar: the selection stays, the bar hides until the selection changes, and focus goes back to the page. */
  function leave() {
    if (bar.contains(document.activeElement)) document.activeElement.blur();
    T.dismiss();
  }

  /** Shows the bar for the current snapshot, or hides it. Runs on every selection change (sel-track.js). */
  function render() {
    if (!bar) { if (!T.shown()) return; build(); }
    if (!T.shown()) { closePop(false); bar.hidden = true; return; }
    colour();
    place();
  }
  /** Puts the bar above the selection, below it when there is no room above, inside the viewport. */
  function place() {
    if (!bar || !T.snap || !T.shown()) return;
    var b = T.snap.box, vr = S.viewer ? S.viewer.getBoundingClientRect() : { top: 0, bottom: innerHeight };
    if (b.bottom < vr.top || b.top > vr.bottom) { bar.hidden = true; return; } // the selection is scrolled out of view
    bar.hidden = false;
    bar.style.left = '0px'; bar.style.top = '0px';
    var w = bar.offsetWidth, ht = bar.offsetHeight, vw = innerWidth, vh = innerHeight, M = 8, GAP = 10;
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
    if (focusBtn && colBtn) colBtn.focus();
  }
  /** A swatch: the colour is used by the next markup, and existing markup under the selection takes it. */
  function pick(col) {
    closePop(true);
    run(function () { return A.setColour(col); }); // sel-actions.js (recolours and refreshes the dot through render)
  }

  T.onChange(render);
  window.SlopSelBar = { place: place, leave: leave, isOpen: function () { return !!bar && !bar.hidden; } };
})();
