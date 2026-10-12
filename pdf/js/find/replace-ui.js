/* Slop PDF find — the Replace dialog: the find and replace fields, the list of every match (page, the text around it,
   and a checkbox per match that can be unticked), and Replace checked. A match whose position cannot be located is
   listed as not replaced and cannot be ticked. Replacing is find/replace.js. Classic script. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, F = window.SlopPdfFind;
  var dlg = null, el = {}, st = { matches: [], on: new Set(), cs: false, ww: false, seq: 0 };

  function build() {
    el.find = U.h('input', { type: 'text', class: 'find-input', 'aria-label': 'Find', placeholder: 'Find' });
    el.rep = U.h('input', { type: 'text', class: 'find-input', 'aria-label': 'Replace with', placeholder: 'Replace with' });
    el.cs = U.h('button', { type: 'button', class: 'find-opt', 'aria-label': 'Match case', 'aria-pressed': 'false', title: 'Match case' }, 'Aa');
    el.ww = U.h('button', { type: 'button', class: 'find-opt', 'aria-label': 'Whole word', 'aria-pressed': 'false', title: 'Whole word' }, 'W');
    el.status = U.h('p', { class: 'find-status', 'aria-live': 'polite' });
    el.list = U.h('ol', { class: 'find-rlist', 'aria-label': 'Matches' });
    el.go = U.h('button', { type: 'button', class: 'find-go' }, 'Replace checked');
    el.cancel = U.h('button', { type: 'button', class: 'find-cancel' }, 'Cancel');
    dlg = U.h('div', { class: 'find-modal', hidden: true },
      U.h('div', { class: 'find-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Replace in document' },
        U.h('h2', { class: 'find-title' }, 'Replace in document'),
        U.h('div', { class: 'find-fields' }, el.find, el.rep, el.cs, el.ww),
        el.status, el.list,
        U.h('div', { class: 'find-foot' }, el.cancel, el.go)));
    document.body.appendChild(dlg);
    var input = function () { st.seq++; search(); };
    var typeT = 0;
    el.find.addEventListener('input', function () { clearTimeout(typeT); typeT = setTimeout(input, 160); });
    el.cs.addEventListener('click', function () { st.cs = !st.cs; el.cs.setAttribute('aria-pressed', String(st.cs)); input(); });
    el.ww.addEventListener('click', function () { st.ww = !st.ww; el.ww.setAttribute('aria-pressed', String(st.ww)); input(); });
    el.go.addEventListener('click', apply);
    el.cancel.addEventListener('click', close);
    dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });
    dlg.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
  }

  /** Opens the dialog with the find text and options the bar was using, and lists its matches. */
  F.openReplace = function (q, opts) {
    if (!dlg) build();
    st.cs = !!(opts && opts.caseSensitive); st.ww = !!(opts && opts.wholeWord);
    el.cs.setAttribute('aria-pressed', String(st.cs)); el.ww.setAttribute('aria-pressed', String(st.ww));
    el.find.value = q || ''; dlg.hidden = false; el.rep.focus();
    search();
  };
  function close() { if (dlg) dlg.hidden = true; }
  async function search() {
    var seq = st.seq, q = el.find.value;
    el.status.textContent = q ? 'Searching…' : 'Type the text to find.';
    var list = q ? await F.search(q, { caseSensitive: st.cs, wholeWord: st.ww }) : [];
    if (seq !== st.seq) return;
    st.matches = list; st.on = new Set();
    list.forEach(function (m, i) { if (m.precise) st.on.add(i); });
    render();
  }
  function render() {
    el.list.replaceChildren();
    st.matches.forEach(function (m, i) {
      var box = U.h('input', { type: 'checkbox', 'aria-label': 'Replace match ' + (i + 1) });
      box.checked = st.on.has(i); box.disabled = !m.precise;
      box.addEventListener('change', function () { if (box.checked) st.on.add(i); else st.on.delete(i); count(); });
      var note = m.precise ? '' : 'Position cannot be located exactly: not replaced';
      el.list.appendChild(U.h('li', { class: m.precise ? '' : 'is-unplaced' },
        box,
        U.h('span', { class: 'find-hit-page' }, 'p. ' + m.page),
        U.h('span', { class: 'find-hit-ctx' }, m.ctx.before, U.h('mark', {}, m.ctx.match), m.ctx.after),
        note ? U.h('span', { class: 'find-note' }, note) : ''));
    });
    count();
  }
  function count() {
    var n = st.on.size, total = st.matches.length;
    el.status.textContent = total ? total + ' match' + (total === 1 ? '' : 'es') + ' · ' + n + ' checked' : (el.find.value ? 'No matches.' : '');
    el.go.disabled = !n;
    el.go.textContent = 'Replace checked' + (n ? ' (' + n + ')' : '');
  }
  function apply() {
    var rep = el.rep.value, items = [], skipped = 0;
    st.matches.forEach(function (m, i) { if (st.on.has(i) && m.precise) items.push({ pid: m.pid, m: m, rep: rep }); else if (!m.precise) skipped++; });
    var unticked = st.matches.length - items.length - skipped;
    var r = F.replaceMatches(items);
    var parts = ['Replaced ' + r.done + ' of ' + st.matches.length + '.'];
    if (skipped) parts.push(skipped + ' not replaced: the position could not be located exactly.');
    if (unticked) parts.push(unticked + ' left unticked.');
    if (r.wide) parts.push(r.wide + ' wider than the original and may overlap nearby text.');
    if (r.unsupported) parts.push('Some characters are not in the standard font and were written as “?”.');
    SlopUI.toast(parts.join(' '), 6000);
    close();
    F.refresh && F.refresh();
  }
})();
