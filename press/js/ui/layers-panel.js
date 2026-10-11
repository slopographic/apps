/* Slop Press — Layers panel: visibility, locking, active layer, rename, reorder, move selection to a layer. */
(function () {
  'use strict';
  var PR = window.PR, U = PR.util, h = U.h, S = PR.state, L = PR.layers, H = PR.history, K = PR.kit, M = PR.model;
  var UI = PR.ui = PR.ui || {};

  function count(doc, id) { var n = 0; M.containers(doc).forEach(function (c) { c.items.forEach(function (it) { if (it.layer === id) n++; }); }); return n; }
  UI.panel({
    id: 'layers', title: 'Layers',
    build: function (body, foot) {
      var doc = S.doc, list = h('div', { class: 'list', role: 'list' });
      if (!L.active || !doc.layers.some(function (l) { return l.id === L.active; })) L.active = doc.layers[doc.layers.length - 1].id;
      var selLayers = {}; PR.selected().forEach(function (it) { selLayers[it.layer] = 1; });
      doc.layers.slice().reverse().forEach(function (l) {
        var idx = doc.layers.indexOf(l);
        var eye = h('button', { type: 'button', title: l.visible ? 'Hide layer' : 'Show layer', 'aria-label': 'Toggle visibility', html: K.icon('eye', l.visible ? '' : 'off') });
        var lock = h('button', { type: 'button', title: l.locked ? 'Unlock layer' : 'Lock layer', 'aria-label': 'Toggle lock', html: K.icon('lock', l.locked ? '' : 'off') });
        var name = h('span', { class: 'lname' }, l.name + (selLayers[l.id] ? '  ■' : ''));
        var row = h('div', { class: 'lrow' + (L.active === l.id ? ' on' : ''), role: 'listitem', tabindex: '0', title: 'Click: draw on this layer · double-click: rename · drag to reorder' },
          eye, lock, h('span', { class: 'lcolor', style: { background: l.color } }), name, h('span', { class: 'lmeta' }, count(doc, l.id)));
        eye.addEventListener('click', function (e) { e.stopPropagation(); l.visible = !l.visible; H.commit('Layer visibility'); });
        lock.addEventListener('click', function (e) { e.stopPropagation(); l.locked = !l.locked; if (l.locked) S.sel = S.sel.filter(function (id) { var f = M.findItem(doc, id); return f && f.item.layer !== l.id; }); H.commit('Layer lock'); });
        row.addEventListener('click', function () { L.active = l.id; UI.refreshPanels('layers'); });
        row.addEventListener('dblclick', function () { window.SlopUI.prompt('Layer Options', 'Name', l.name).then(function (v) { if (v) { l.name = v; H.commit('Rename layer'); } }); });
        row.addEventListener('contextmenu', function (e) {
          e.preventDefault();
          window.SlopUI.menu([{ label: 'Move Selection to “' + l.name + '”', disabled: !S.sel.length, act: function () { PR.selected().forEach(function (it) { it.layer = l.id; }); H.commit('Move to layer'); } },
            { label: 'Layer Colour…', act: function () { K.customColor(l.color, function (c) { l.color = U.hex(c); H.commit('Layer colour'); }, 'Layer colour'); } },
            { label: 'Move Up', disabled: idx >= doc.layers.length - 1, act: function () { L.move(doc, idx, idx + 1); H.commit('Move layer'); } },
            { label: 'Move Down', disabled: idx === 0, act: function () { L.move(doc, idx, idx - 1); H.commit('Move layer'); } },
            '-', { label: 'Delete Layer', disabled: doc.layers.length < 2, act: function () { delLayer(l); } }], e.clientX, e.clientY);
        });
        list.append(row);
      });
      body.append(list);
      foot.append(h('span', { class: 'count' }, doc.layers.length + ' layer' + (doc.layers.length === 1 ? '' : 's')),
        UI.footBtn('plus', 'New layer', function () { var nl = L.add(doc); L.active = nl.id; H.commit('New layer'); }),
        UI.footBtn('up', 'Move layer up', function () { var i = L.index(doc, L.active); if (i < doc.layers.length - 1) { L.move(doc, i, i + 1); H.commit('Move layer'); } }),
        UI.footBtn('down', 'Move layer down', function () { var i = L.index(doc, L.active); if (i > 0) { L.move(doc, i, i - 1); H.commit('Move layer'); } }),
        UI.footBtn('trash', 'Delete layer', function () { delLayer(M.findLayer(doc, L.active)); }));
    }
  });
  function delLayer(l) {
    var doc = S.doc, n = count(doc, l.id);
    var go = function () { if (L.remove(doc, l.id)) { L.active = doc.layers[doc.layers.length - 1].id; S.sel = []; H.commit('Delete layer'); } };
    if (!n) return go();
    window.SlopUI.confirm('Delete Layer', 'Delete “' + l.name + '” and its ' + n + ' object' + (n === 1 ? '' : 's') + '?', 'Delete', { danger: true }).then(function (ok) { if (ok) go(); });
  }
  var soon = U.debounce(function () { UI.refreshPanels('layers'); }, 120);
  PR.on('commit', soon); PR.on('doc', soon); PR.on('select', soon);
})();
