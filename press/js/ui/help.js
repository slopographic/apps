/* Slop Press — small dialogs: About, Load Font, placeholder text, and the built-in command palette /
   shortcut list used only while the shared SlopCmd package is not available. */
(function () {
  'use strict';
  var PR = window.PR, U = PR.util, h = U.h, S = PR.state, A = PR.actions, H = PR.history;
  var UI = PR.ui = PR.ui || {};
  var SU = function () { return window.SlopUI; };

  UI.about = function () {
    SU().dialog({ title: 'About Slop Press', body: h('div', { class: 'pr-form' },
      h('p', { class: 'sui-p' }, h('b', null, 'Slop Press'), ' is a page layout app that runs entirely in your browser: spreads and master pages, threaded text frames with its own line breaker (greedy and Knuth–Plass), English hyphenation, paragraph and character styles, text wrap, and print-ready PDF with embedded, subset fonts, bleed and crop marks.'),
      h('p', { class: 'sui-p' }, 'Nothing is uploaded. Work is autosaved in this browser; save .slpress files to keep them. Fonts: the bundled Liberation Sans (embedded in PDFs), your system fonts, and any .ttf/.otf you load.'),
      h('p', { class: 'sui-p' }, 'Press ', h('b', null, A.keyFor('help.search') || 'Ctrl+K'), ' to search every command.')), buttons: [{ label: 'OK', primary: true }] });
  };
  UI.loadFont = function () {
    SU().pickFiles({ accept: '.ttf,.otf,font/ttf,font/otf', multiple: true }).then(function (fs) {
      return fs.reduce(function (p, f) { return p.then(function () { return PR.fonts.addFile(S.doc, f).then(function (fam) { U.toast('Font loaded: ' + fam); }); }); }, Promise.resolve())
        .then(function () { if (fs.length) { H.commit('Load font'); PR.emit('fonts'); } });
    }).catch(function (e) { U.toast('Could not load font: ' + e.message); });
  };
  var IPSUM = ['Slop Press sets type the old-fashioned way: every line is measured, broken and justified by the composer, then hyphenated where the measure demands it.',
    'Good typography is invisible. The reader never notices the even colour of a well-set column, only that the reading felt easy and the page looked calm.',
    'Threaded frames carry a story from page to page; when the last frame fills up, a small red plus sign tells you the text is overset.',
    'Master pages hold the furniture of a publication: running heads, folios and the grid. Change the master and every page follows.',
    'Paragraph styles describe the voice of the text, character styles its accents. Redefine a style once and the whole document reflows.'];
  UI.placeholder = function (n) { var out = []; for (var i = 0; i < n; i++) out.push(IPSUM[i % IPSUM.length]); return out.join('\n'); };
  UI.fillPlaceholder = function () {
    var fr = S.text ? PR.model.findItem(S.doc, S.text.frame).item : PR.selected().filter(function (it) { return it.type === 'text'; })[0];
    if (!fr) return;
    var st = S.doc.stories[fr.story];
    if (S.text) { PR.textEdit.insert(UI.placeholder(3), 'Placeholder text'); return; }
    PR.story.remove(st, 0, st.text.length);
    PR.story.insert(st, 0, UI.placeholder(12));
    PR.touch();
    // trim so the text just fits the frame chain
    var r = PR.engine.story(fr.story);
    if (r && r.overset && r.end > 0) { PR.story.remove(st, r.end, st.text.length); while (st.text.length && /\s/.test(st.text[st.text.length - 1])) PR.story.remove(st, st.text.length - 1, st.text.length); }
    H.commit('Placeholder text');
  };

  /* ---------- fallback palette + shortcut list (SlopCmd provides the real ones) ---------- */
  UI.miniPalette = function () {
    var inp = h('input', { class: 'sui-input', type: 'search', placeholder: 'Type a command…', 'aria-label': 'Search commands' }), list = h('div', { class: 'pr-pal-list', role: 'listbox' });
    var items = [], sel = 0, dlg;
    function score(c, q) { var t = (c.title + ' ' + c.group + ' ' + (c.keywords || []).join(' ')).toLowerCase(); var i = t.indexOf(q); if (i >= 0) return 100 - i; var k = 0; for (var j = 0; j < t.length && k < q.length; j++) if (t[j] === q[k]) k++; return k === q.length ? 10 : -1; }
    function render() {
      var q = inp.value.trim().toLowerCase();
      items = A.order.map(function (id) { return A.get(id); }).filter(function (c) { return c && A.enabled(c.id); }).map(function (c) { return { c: c, s: q ? score(c, q) : 1 }; }).filter(function (x) { return x.s >= 0; })
        .sort(function (a, b) { return b.s - a.s; }).slice(0, 60).map(function (x) { return x.c; });
      sel = Math.min(sel, Math.max(0, items.length - 1)); list.innerHTML = '';
      items.forEach(function (c, i) {
        var b = h('button', { type: 'button', class: i === sel ? 'on' : '', role: 'option' }, h('span', null, c.title, ' ', h('small', null, c.group)), h('small', null, A.keyFor(c.id)));
        b.addEventListener('click', function () { dlg.close(true); setTimeout(function () { A.run(c.id); }, 0); });
        list.append(b);
      });
    }
    inp.addEventListener('input', function () { sel = 0; render(); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { sel = Math.min(items.length - 1, sel + 1); render(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); render(); e.preventDefault(); }
      else if (e.key === 'Enter' && items[sel]) { e.preventDefault(); e.stopPropagation(); var c = items[sel]; dlg.close(true); setTimeout(function () { A.run(c.id); }, 0); }
    });
    dlg = SU().dialog({ title: 'Search Commands', body: h('div', { class: 'pr-pal' }, inp, list), dismissable: true });
    render();
  };
  UI.shortcutList = function () {
    var grid = h('div', { class: 'pr-keys' }), last = '';
    A.order.map(function (id) { return A.get(id); }).filter(function (c) { return c && c.keys && c.keys.length && c.group !== 'Styles'; }).forEach(function (c) {
      if (c.group !== last) { grid.append(h('h5', null, c.group)); last = c.group; }
      grid.append(h('span', null, c.title), h('kbd', null, c.keys.map(A.label).join('  ·  ')));
    });
    SU().dialog({ title: 'Keyboard Shortcuts', cls: 'sui-wide', body: grid, buttons: [{ label: 'OK', primary: true }] });
  };
})();
