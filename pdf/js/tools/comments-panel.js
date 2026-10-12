/* Slop PDF — Comments panel: every comment in the document with its page and author, filtered by state. A click
   jumps to the page, selects the comment and opens its thread. Model and popups: editor/notes.js, notes-view.js. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, Ed = SP.editor, h = U.h, P = SP.panels, PANELS = P.PANELS, K = P.helpers;
  var section = K.section, seg = K.seg, note = K.note, needPages = K.needPages, onRefresh = K.onRefresh;
  var filter = 'all';
  function when(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    try { return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return d.toISOString(); }
  }
  PANELS.comments = {
    title: 'Comments', icon: 'comments', build: function (b) {
      var np = needPages(); if (np) { b.appendChild(np); return; }
      var list = h('ul', { class: 'cm-list', 'aria-label': 'Comments' });
      var sel = seg([['all', 'All'], ['open', 'Open'], ['resolved', 'Resolved']], filter, function (v) { filter = v; P.refresh('filter'); }, 'Show');
      b.appendChild(section(null, [h('div', { class: 'cm-filter' }, sel), list,
        note('Comments are saved as PDF comments on download, with their replies and resolved state. Choose the Comment tool and click on a page to add one.')]));
      onRefresh(function () {
        list.innerHTML = '';
        var rows = Ed.allNotes().filter(function (r) { return filter === 'all' || (filter === 'open' ? !r.note.resolved : r.note.resolved); });
        if (!rows.length) list.appendChild(h('li', null, note(filter === 'all' ? 'No comments yet.' : 'No comments here.')));
        rows.forEach(function (r) {
          var a = r.note, n = (a.replies || []).length;
          var item = h('button', { type: 'button', class: 'cm-item' + (a.resolved ? ' is-resolved' : ''), title: 'Go to this comment' },
            h('b', null, 'Page ' + (r.index + 1) + ' · ' + (a.author || 'Unnamed')),
            h('span', null, when(a.date) + (n ? ' · ' + n + ' repl' + (n === 1 ? 'y' : 'ies') : '') + (a.resolved ? ' · resolved' : '')),
            h('p', null, a.text));
          item.addEventListener('click', function () {
            SP.app.openPage(r.pid, true); // SP.app is set by ui/app.js, which loads after this file
            Ed.select(a.id);
            Ed.noteUI.open(a.id);
          });
          list.appendChild(h('li', null, item));
        });
      });
    }
  };
})();
