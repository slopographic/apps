/* Slop PDF — the Layers dock section: the layers of the page in view (or the first selected page in the grid), top layer
   first. Each row: select, show or hide, lock or unlock, move up or down, delete. Edits are undoable commands
   (editor/layers-ops.js). Under them, the PDF's own layers (optional content groups: show, hide, delete; tools/ocg-panel.js).
   Classic script. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, Ed = SP.editor, A = SP.app, O = SP.organizer, L = SP.layers, D = SP.dock, h = U.h;

  /** The page the Layers section shows. */
  function pageId() {
    if (A.mode === 'page' && Ed.pid) return Ed.pid;
    var sel = O.selected();
    return sel[0] || O.focusId || (E.state.pages[0] && E.state.pages[0].id) || null;
  }
  /** A row button. key names it for focus after a re-render. */
  function act(key, label, name, onclick, extra) {
    var b = h('button', { type: 'button', class: 'lyr-b' + (extra && extra.cls ? ' ' + extra.cls : ''), 'data-key': key, 'aria-label': label, title: label, html: U.icon(name) });
    if (extra && extra.disabled) b.disabled = true;
    b.addEventListener('click', onclick);
    return b;
  }
  function select(pid, aid) {
    if (A.mode !== 'page') A.openPage(pid, true);
    Ed.select(aid);
    A.editorSelectionChanged();
  }
  function row(pid, it, n) {
    var a = it.a, id = a.id, hid = L.isHidden(a), lock = L.isLocked(a), on = Ed.selId === id;
    return h('li', { class: 'lyr' + (on ? ' on' : '') + (hid ? ' is-hidden' : '') + (lock ? ' is-locked' : ''), 'data-aid': id },
      act('vis:' + id, hid ? 'Show ' + it.name : 'Hide ' + it.name, 'eye', function () { L.set(pid, id, 'hidden', !hid); }, { cls: 'lyr-vis' + (hid ? ' off' : '') }),
      h('button', { type: 'button', class: 'lyr-name', 'data-key': 'sel:' + id, 'aria-current': on ? 'true' : null, title: it.name, onclick: function () { select(pid, id); } }, it.name),
      act('lock:' + id, lock ? 'Unlock ' + it.name : 'Lock ' + it.name, 'lock', function () { L.set(pid, id, 'locked', !lock); }, { cls: 'lyr-lock' + (lock ? ' on' : '') }),
      act('up:' + id, 'Move ' + it.name + ' up', 'up', function () { L.moveLayer(pid, id, 1); }, { disabled: n === 0 }),
      act('down:' + id, 'Move ' + it.name + ' down', 'down', function () { L.moveLayer(pid, id, -1); }, { disabled: n === it.count - 1 }),
      act('del:' + id, 'Delete ' + it.name, 'trash', function () { L.deleteLayer(pid, id); }, { cls: 'lyr-del' }));
  }
  /** Which layers the section lists: 'page' (the page in view) or 'all' (every page, one group each). Kept for the session. */
  var scope = 'page';
  function scopeTabs() {
    var bar = h('div', { class: 'lyr-scope', role: 'tablist', 'aria-label': 'Layers shown' });
    [['page', 'This page'], ['all', 'All pages']].forEach(function (t) {
      var b = h('button', { type: 'button', role: 'tab', class: 'lyr-scope-b' + (scope === t[0] ? ' on' : ''), 'aria-selected': scope === t[0] ? 'true' : 'false' }, t[1]);
      b.addEventListener('click', function () { scope = t[0]; D.refresh(); });
      bar.appendChild(b);
    });
    return bar;
  }
  /** The rows of one page, top layer first. */
  function pageRows(body, p) {
    var items = L.items(p);
    if (!items.length) { body.appendChild(h('p', { class: 'pp-note' }, 'No layers on this page yet.')); return; }
    var list = h('ul', { class: 'lyr-list', 'aria-label': 'Layers on page ' + (E.indexOf(p.id) + 1) + ', top first' });
    items.forEach(function (it, k) { it.count = items.length; list.appendChild(row(p.id, it, k)); });
    body.appendChild(list);
  }
  function render(body) {
    body.appendChild(scopeTabs());
    if (scope === 'all') {
      var withLayers = E.state.pages.filter(function (p) { return (p.annots || []).length; });
      if (!withLayers.length) { body.appendChild(h('p', { class: 'pp-note' }, 'No layers in this document yet. Text, shapes, highlights and images you add become layers, top first.')); ocg(body); return; }
      body.appendChild(h('p', { class: 'pp-note' }, withLayers.length + (withLayers.length === 1 ? ' page' : ' pages') + ' with layers'));
      E.state.pages.forEach(function (p) {
        if (!(p.annots || []).length) return;
        var group = h('div', { class: 'lyr-group' }, h('h4', { class: 'lyr-group-h' }, 'Page ' + (E.indexOf(p.id) + 1) + ' · ' + p.annots.length + (p.annots.length === 1 ? ' layer' : ' layers')));
        body.appendChild(group);
        pageRows(group, p);
      });
    } else {
      var pid = pageId(), p = pid && E.pageById(pid);
      if (!p) { body.appendChild(h('p', { class: 'pp-note' }, 'Open a PDF to see its layers.')); return; }
      body.appendChild(h('p', { class: 'pp-note' }, 'Page ' + (E.indexOf(p.id) + 1) + ((p.annots || []).length ? ' · ' + p.annots.length + (p.annots.length === 1 ? ' layer' : ' layers') : '')));
      pageRows(body, p);
    }
    body.appendChild(h('p', { class: 'pp-hint lyr-hint' }, 'Hidden layers are not drawn or exported. Locked layers cannot be moved, edited or deleted.'));
    ocg(body);
  }
  /** The PDF's own layers (optional content groups, tools/ocg-panel.js, loaded after the first paint). */
  function ocg(body) { if (SP.ocgPanel && E.state.pages.length) SP.ocgPanel(body); }
  D.add({
    id: 'layers', title: 'Layers', open: true, render: render,
    meta: function () { var pid = pageId(), p = pid && E.pageById(pid); return p && p.annots && p.annots.length ? String(p.annots.length) : ''; },
  });
})();
