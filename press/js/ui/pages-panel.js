/* Slop Press — Pages panel: masters, spread thumbnails, select / reorder by drag / apply masters / add / delete. */
(function () {
  'use strict';
  var PR = window.PR, U = PR.util, h = U.h, S = PR.state, P = PR.pages, M = PR.model, H = PR.history, R = PR.render;
  var UI = PR.ui = PR.ui || {};
  var picked = [], thumbW = 44;

  function masterChip(m) {
    var on = S.editMaster && S.editMaster.id === (m && m.id);
    var b = h('button', { type: 'button', class: 'mchip' + (on ? ' on' : ''), title: m ? 'Double-click to edit ' + m.prefix + '-' + m.name + ' (drag onto a page to apply)' : 'No master' },
      h('b', null, m ? m.prefix : '–'), m ? m.name : '[None]');
    b.addEventListener('dblclick', function () { if (m) UI.editMaster(m.id, 0); });
    b.addEventListener('click', function () { if (m && S.editMaster) UI.editMaster(m.id, 0); });
    b.draggable = true;
    b.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/x-press-master', m ? m.id : ''); e.dataTransfer.effectAllowed = 'copy'; });
    b.addEventListener('contextmenu', function (e) {
      e.preventDefault(); if (!m) return;
      window.SlopUI.menu([{ label: 'Edit ' + m.prefix + '-' + m.name, act: function () { UI.editMaster(m.id, 0); } },
        { label: 'Apply to Selected Pages', act: function () { P.applyMaster(S.doc, picked.length ? picked : [S.page], m.id); H.commit('Apply master'); } },
        { label: 'Master Options…', act: function () { UI.newMaster(m); } },
        { label: 'Delete Master', disabled: S.doc.masters.length < 1, act: function () { P.deleteMaster(S.doc, m.id); if (S.editMaster && S.editMaster.id === m.id) S.editMaster = null; H.commit('Delete master'); } }], e.clientX, e.clientY);
    });
    return b;
  }
  function thumb(i) {
    var doc = S.doc, sc = thumbW / doc.size.w, c = h('canvas');
    c.width = Math.round(thumbW * 2); c.height = Math.round(doc.size.h * sc * 2);
    c.style.width = thumbW + 'px'; c.style.height = Math.round(doc.size.h * sc) + 'px';
    var ctx = c.getContext('2d'); ctx.scale(sc * 2, sc * 2);
    try { R.page(ctx, doc, i, { zoom: sc * 2, greek: true }); } catch (e) { /* ignore render glitches in thumbnails */ }
    var page = doc.pages[i], mm = page.master && M.findMaster(doc, page.master);
    var el = h('div', { class: 'pthumb' + (i === S.page && !S.editMaster ? ' on' : '') + (picked.indexOf(i) >= 0 ? ' sel' : ''), 'data-i': i, tabindex: '0', title: 'Page ' + P.label(doc, i) + (mm ? ' · master ' + mm.prefix : '') },
      h('div', { class: 'pthumb-wrap' }, c, mm ? h('span', { class: 'pmaster', style: { left: 0, top: 0 } }, mm.prefix) : null), h('span', { class: 'plabel' }, P.label(doc, i)));
    var pm = el.querySelector('.pmaster'); if (pm) { pm.style.position = 'absolute'; }
    el.addEventListener('click', function (e) {
      if (e.shiftKey && picked.length) { var a = Math.min(picked[0], i), b = Math.max(picked[0], i); picked = []; for (var k = a; k <= b; k++) picked.push(k); }
      else if (e.ctrlKey || e.metaKey) { var j = picked.indexOf(i); if (j >= 0) picked.splice(j, 1); else picked.push(i); }
      else picked = [i];
      PR.goPage(i); UI.refreshPanels('pages');
    });
    el.addEventListener('dblclick', function () { PR.goPage(i); PR.view.fitPage(); });
    el.addEventListener('contextmenu', function (e) {
      e.preventDefault(); if (picked.indexOf(i) < 0) picked = [i];
      var targets = picked.slice();
      window.SlopUI.menu([{ label: 'Insert Page After', act: function () { P.insertPages(doc, i + 1, 1); H.commit('Add page'); PR.goPage(i + 1); } },
        { label: 'Duplicate Page', act: function () { P.duplicatePage(doc, i); H.commit('Duplicate page'); } },
        { label: targets.length > 1 ? 'Delete ' + targets.length + ' Pages' : 'Delete Page', disabled: doc.pages.length <= targets.length, act: function () { P.deletePages(doc, targets); picked = []; H.commit('Delete pages'); PR.goPage(Math.min(S.page, doc.pages.length - 1)); } },
        '-', { label: 'Apply Master', sub: [{ label: '[None]', act: function () { P.applyMaster(doc, targets, null); H.commit('Apply master'); } }].concat(doc.masters.map(function (m) { return { label: m.prefix + '-' + m.name, check: targets.every(function (t) { return doc.pages[t].master === m.id; }), act: function () { P.applyMaster(doc, targets, m.id); H.commit('Apply master'); } }; })) },
        { label: 'Override All Master Items', act: function () { PR.goPage(i); PR.actions.run('layout.overrideMaster'); } }], e.clientX, e.clientY);
    });
    // drop a master chip onto a page
    el.addEventListener('dragover', function (e) { if (Array.prototype.indexOf.call(e.dataTransfer.types, 'text/x-press-master') >= 0) { e.preventDefault(); el.classList.add('sel'); } });
    el.addEventListener('dragleave', function () { el.classList.toggle('sel', picked.indexOf(i) >= 0); });
    el.addEventListener('drop', function (e) { var id = e.dataTransfer.getData('text/x-press-master'); if (id === undefined) return; e.preventDefault(); P.applyMaster(doc, [i], id || null); H.commit('Apply master'); });
    reorder(el, i);
    return el;
  }
  /* reorder by pointer drag (works with touch too) */
  function reorder(el, i) {
    el.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      var x0 = e.clientX, y0 = e.clientY, active = false, target = null, after = false;
      function mv(ev) {
        if (!active && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
        active = true;
        U.$$('.pthumb').forEach(function (t) { t.classList.remove('drop-before', 'drop-after'); });
        var over = document.elementFromPoint(ev.clientX, ev.clientY), t = over && over.closest('.pthumb');
        if (t && t !== el) { var r = t.getBoundingClientRect(); after = ev.clientX > r.left + r.width / 2; t.classList.add(after ? 'drop-after' : 'drop-before'); target = +t.getAttribute('data-i'); } else target = null;
      }
      function up() {
        removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
        U.$$('.pthumb').forEach(function (t) { t.classList.remove('drop-before', 'drop-after'); });
        if (!active || target == null) return;
        var to = target + (after ? 1 : 0); if (to > i) to--;
        if (to === i) return;
        P.movePage(S.doc, i, to); picked = [to]; H.commit('Move page'); PR.goPage(to);
      }
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
    });
  }
  UI.panel({
    id: 'pages', title: 'Pages',
    build: function (body, foot) {
      var doc = S.doc;
      var ms = h('div', { class: 'masters' }, masterChip(null), doc.masters.map(masterChip));
      var add = h('button', { type: 'button', class: 'mchip', title: 'New master' }, '+');
      add.addEventListener('click', function () { UI.newMaster(); }); ms.append(add);
      var sp = h('div', { class: 'spreads' });
      P.spreads(doc).forEach(function (s) {
        var row = h('div', { class: 'spread' });
        if (s.lone && doc.facing) row.style.paddingLeft = (thumbW + 8) + 'px';
        s.pages.forEach(function (i) { row.append(thumb(i)); });
        sp.append(row);
      });
      body.append(ms, sp);
      foot.append(h('span', { class: 'count' }, doc.pages.length + ' page' + (doc.pages.length === 1 ? '' : 's') + ' in ' + P.spreads(doc).length + ' spread' + (P.spreads(doc).length === 1 ? '' : 's')),
        UI.footBtn('plus', 'Add page', function () { PR.actions.run('layout.addPage'); }),
        UI.footBtn('dup', 'Duplicate page', function () { PR.actions.run('layout.duplicatePage'); }),
        UI.footBtn('trash', 'Delete page', function () { PR.actions.run('layout.deletePage'); }));
    }
  });
  var refreshSoon = U.debounce(function () { if (UI.visiblePanel && UI.visiblePanel('pages')) UI.refreshPanels('pages'); }, 350);
  PR.on('commit', refreshSoon); PR.on('doc', function () { picked = []; refreshSoon(); }); PR.on('page', refreshSoon); PR.on('image', refreshSoon); PR.on('fonts', refreshSoon);
})();
