/* Slop PDF — the Layers dock section: the layers of the page in view (or the first selected page in the grid), top layer
   first. Each row: select, show or hide, lock or unlock, move up or down, delete. Edits are undoable commands
   (editor/layers-ops.js). Classic script. */
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
  function render(body) {
    var pid = pageId(), p = pid && E.pageById(pid);
    if (!p) { body.appendChild(h('p', { class: 'pp-note' }, 'Open a PDF to see its layers.')); return; }
    var items = L.items(p);
    body.appendChild(h('p', { class: 'pp-note' }, 'Page ' + (E.indexOf(p.id) + 1) + (items.length ? ' · ' + items.length + (items.length === 1 ? ' layer' : ' layers') : '')));
    if (!items.length) { body.appendChild(h('p', { class: 'pp-note' }, 'No layers on this page. Text, shapes, highlights and images you add become layers, top first.')); return; }
    var list = h('ul', { class: 'lyr-list', 'aria-label': 'Layers, top first' });
    items.forEach(function (it, k) { it.count = items.length; list.appendChild(row(p.id, it, k)); });
    body.appendChild(list);
    body.appendChild(h('p', { class: 'pp-hint lyr-hint' }, 'Hidden layers are not drawn or exported. Locked layers cannot be moved, edited or deleted.'));
  }
  D.add({
    id: 'layers', title: 'Layers', open: true, render: render,
    meta: function () { var pid = pageId(), p = pid && E.pageById(pid); return p && p.annots && p.annots.length ? String(p.annots.length) : ''; },
  });
})();
