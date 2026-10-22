/* Slop PDF — split view. The workspace (shared/workspace: 1 to 4 panes in columns, rows or a grid) holds the documents. One
 * pane is focused: it is the live editor, and the page viewer sits in it, so the tools, the layers, find and the zoom all
 * act on that pane's document. The other panes show their documents as read-only previews (ui/pane-preview.js), each with
 * its own zoom and scroll. A click on a pane focuses it; the document strip shows the focused pane's document.
 *
 * Focusing a pane swaps documents the way a tab does (ui/doc-tabs.js): the document on screen is saved in its record and the
 * other one is put on screen, with the view it was left in. Classic script; exposes SP.panes. */
(function () {
  'use strict';
  var SP = window.SP, Ed = SP.editor, U = SP.util, DT = SP.tabs, PV = SP.panePreview;
  var LAYOUTS = { one: [1, 'columns'], columns2: [2, 'columns'], rows2: [2, 'rows'], columns3: [3, 'columns'], grid4: [4, 'grid'] };
  var ws = null, host = null, focused = 0, count = 1, layoutKey = 'one', switching = false, subscribed = false;
  var paneDoc = [], views = [], bars = [], viewerHome = null, viewerNext = null, lastLive = null;

  function viewer() { return document.getElementById('viewer'); }
  function api() { return DT.api ? DT.api() : null; }
  function openDocs() { var a = api(); return a ? a.tabs().map(function (t) { return { doc: t.doc, title: t.title }; }) : []; }
  function titleOf(doc) { var hit = openDocs().find(function (t) { return t.doc === doc; }); return hit ? hit.title : 'Document'; }
  function paneEl(i) { return ws.pane(i).el; }
  function relayout() { if (Ed.page && Ed.page()) Ed.layout(); }

  /** Each pane has its own tab strip (shared/doctabs/pane-tabs.js): the open documents, with the one that pane shows marked. */
  function barItems(i) {
    return function () {
      var cur = DT.current();
      return openDocs().map(function (t) {
        var shown = i === focused ? t.doc === cur : t.doc === paneDoc[i];
        return { id: t.doc.id, title: t.title, active: shown };
      });
    };
  }
  function docById(id) { var hit = openDocs().find(function (t) { return t.doc.id === id; }); return hit ? hit.doc : null; }
  /** A tab was picked in pane i. A pane that shows the document takes the focus; otherwise the focused pane takes it live,
   *  or pane i does when it is not the focused one. */
  function pickTab(i, id) {
    var doc = docById(id);
    if (!doc) return;
    for (var j = 0; j < count; j++) {
      if (j === focused ? DT.current() === doc : paneDoc[j] === doc) { focusPane(j); return; }
    }
    if (i === focused) { if (api()) api().activate(doc); } else openDocIn(i, doc);
  }
  function closeTab(id) { var doc = docById(id); if (doc && api()) api().close(doc); }
  /** Draws every pane's tab strip, and puts the strip above the stage away while the view is split. */
  function renderBars() {
    if (!ws) return;
    var strip = document.getElementById('tabs');
    if (strip) strip.hidden = true;
    for (var i = count; i < bars.length; i++) if (bars[i]) { bars[i].destroy(); bars[i] = null; }
    bars.length = count;
    for (var j = 0; j < count; j++) {
      if (!bars[j] || bars[j].el.parentNode !== paneEl(j)) {
        bars[j] = SlopPaneTabs.mount(paneEl(j), {
          label: 'Open documents',
          items: barItems(j),
          pick: (function (k) { return function (id) { pickTab(k, id); }; })(j),
          close: closeTab,
        });
      } else bars[j].render();
    }
  }

  /** The viewer goes into the focused pane, or back where it was when the view is not split. */
  function placeViewer() {
    var v = viewer();
    if (!v) return;
    if (count === 1) {
      if (viewerHome && v.parentNode !== viewerHome) viewerHome.insertBefore(v, viewerNext);
      return;
    }
    if (v.parentNode !== paneEl(focused)) paneEl(focused).append(v);
  }
  /** The viewer goes back to the stage before any pane element is removed: removing a pane removes what is in it. */
  function detachViewer() {
    var v = viewer();
    if (v && viewerHome && v.parentNode !== viewerHome) viewerHome.insertBefore(v, viewerNext);
  }
  function rememberViewerHome() {
    var v = viewer();
    if (v && !viewerHome) { viewerHome = v.parentNode; viewerNext = v.nextSibling; }
  }

  function destroyView(i) { if (views[i]) { views[i].destroy(); views[i] = null; } }
  /** Shows doc (or nothing) as a read-only preview in pane i. The focused pane never has one. */
  function showPreview(i, doc) {
    if (i === focused || !ws || !ws.pane(i)) return;
    paneDoc[i] = doc || null;
    if (!views[i]) views[i] = PV.create(paneEl(i), doc || null, { title: doc ? titleOf(doc) : null, empty: function () { return emptyPane(i); } });
    else views[i].setDoc(doc || null, doc ? titleOf(doc) : null);
  }

  /** What an empty pane offers: open a file in it, or show a document that is open in the strip. */
  function emptyPane(i) {
    var box = U.h('div', { class: 'pv-pv-empty' });
    var open = U.h('button', { type: 'button', class: 'sui-btn sui-primary' }, 'Open a file');
    var show = U.h('button', { type: 'button', class: 'sui-btn' }, 'Show an open document');
    open.addEventListener('click', function () {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf,image/png,image/jpeg,image/webp,image/gif,image/bmp';
      input.addEventListener('change', function () { if (input.files && input.files[0]) SP.app.openFilesInPane(i, [input.files[0]]); });
      input.click();
    });
    show.addEventListener('click', function () {
      var r = show.getBoundingClientRect();
      var items = openDocs().filter(function (t) { return t.doc !== DT.current(); }).map(function (t) {
        return { label: t.title, act: function () { openDocIn(i, t.doc); } };
      });
      SlopUI.menu(items.length ? items : [{ label: 'No other open document', disabled: true }], r.left, r.bottom + 4);
    });
    box.append(open, show);
    return box;
  }

  /** Makes the document that is open in the strip the live one in pane i (the pane takes the focus, as a click does). */
  function openDocIn(i, doc) {
    if (!ws || !ws.pane(i) || !doc) return;
    paneDoc[i] = doc;
    focusPane(i);
  }

  /** A file opened into pane i (not the focused one): the document it opens as is live in pane i, the pane that was live
   *  shows its document as a preview. Called after the file is open in a tab, which made it the live one. */
  function placeIn(i, doc, prev) {
    if (!ws || !ws.pane(i) || i === focused || !doc) return;
    var f = focused;
    switching = true;
    try {
      if (DT.current() !== doc && api()) api().activate(doc);
      destroyView(i);
      focused = i;
      ws.focus(i);
      paneDoc[i] = null;
      lastLive = doc;
      placeViewer();
      showPreview(f, prev && prev !== doc ? prev : null);
      relayout();
      renderBars();
    } finally { switching = false; }
  }

  /** The pane under a drop, by its index (-1 when the drop is not on a pane). */
  function paneAt(target) {
    var el = target && target.closest ? target.closest('.sw-pane') : null;
    return el && ws ? Number(el.dataset.pane) : -1;
  }

  /** The strip's events: closing a document frees the pane that showed it. */
  function onStrip(why, t) {
    if (!ws) return;
    if (why === 'close' && t) {
      for (var i = 0; i < count; i++) {
        if (i !== focused && paneDoc[i] === t.doc) showPreview(i, null);
      }
      if (paneDoc[focused] === t.doc) paneDoc[focused] = null;
    }
    renderBars();
  }
  function subscribe() {
    if (subscribed || !api() || !api().on) return;
    subscribed = true;
    api().on(onStrip);
  }

  /** Lays the view out with n panes in a layout. The panes that already show a document keep it; the others get the
   *  open documents that are not on screen yet, in strip order. */
  function split(n, kind) {
    host = host || document.getElementById('panes');
    if (!host) return;
    if (n <= 1) { unsplit(); return; }
    subscribe();
    rememberViewerHome();
    var cur = DT.current();
    if (!ws) {
      ws = SlopWorkspace.mount(host, { panes: n, layout: kind, onFocus: onFocus });
    } else {
      detachViewer();
      for (var j = n; j < ws.panes().length; j++) destroyView(j);
      ws.setPanes(n);
      ws.setLayout(kind);
    }
    count = n;
    layoutKey = Object.keys(LAYOUTS).find(function (k) { return LAYOUTS[k][0] === n && LAYOUTS[k][1] === kind; }) || layoutKey;
    host.hidden = false;
    host.dataset.split = String(n);
    if (focused >= n) focused = 0;
    if (ws.pane(focused)) placeViewer();
    var list = openDocs().map(function (t) { return t.doc; });
    var at = list.indexOf(cur);
    var free = list.slice(at + 1).concat(list.slice(0, Math.max(0, at)));
    var used = new Set([cur]);
    for (var i = 0; i < n; i++) {
      if (i === focused) { paneDoc[i] = null; continue; }
      var doc = paneDoc[i] && list.indexOf(paneDoc[i]) > -1 && !used.has(paneDoc[i]) ? paneDoc[i] : null;
      if (!doc) doc = free.find(function (d) { return !used.has(d); }) || null;
      if (doc) used.add(doc);
      showPreview(i, doc);
    }
    placeViewer();
    relayout();
    renderBars();
  }

  /** One pane again: the viewer goes back to the page, and the previews go. */
  function unsplit() {
    detachViewer();
    for (var i = 0; i < views.length; i++) destroyView(i);
    bars = [];
    if (ws) { ws.destroy(); ws = null; }
    if (host) { host.hidden = true; delete host.dataset.split; host.replaceChildren(); }
    count = 1; focused = 0; layoutKey = 'one'; paneDoc = [];
    var strip = document.getElementById('tabs');
    if (strip) strip.hidden = false;
    placeViewer();
    relayout();
  }

  /** The workspace reports a focus change (a press on a pane). */
  function onFocus(pane) { focusPane(pane.id); }

  /** Makes pane i the live editor. Its document is put on screen through the strip (saving the one that leaves), the viewer
   *  moves into the pane, and the pane it leaves shows its document as a preview. */
  function focusPane(i) {
    if (switching || i === focused || !ws || !ws.pane(i)) return;
    var target = paneDoc[i] || null;
    if (!target) return;   // an empty pane has no document to edit
    switching = true;
    try {
      var prev = focused, prevDoc = DT.current();
      destroyView(i);
      focused = i;
      if (target !== prevDoc && api()) api().activate(target);
      ws.focus(i);
      paneDoc[i] = null;
      lastLive = target;
      placeViewer();
      showPreview(prev, prevDoc);
      relayout();
      renderBars();
    } finally { switching = false; }
  }

  /** The strip put a document on screen in the focused pane. A preview pane that showed it takes the document that left. */
  function onDocShown(doc) {
    var left = lastLive;
    lastLive = doc;
    if (!ws || switching) return;
    for (var i = 0; i < count; i++) {
      if (i !== focused && paneDoc[i] === doc) { showPreview(i, left && left !== doc ? left : null); return; }
    }
  }

  /** Focus the next pane that has a document (dir 1 or -1). */
  function step(dir) {
    if (count < 2) return;
    for (var k = 1; k < count; k++) {
      var next = (focused + dir * k + count * 4) % count;
      if (paneDoc[next]) { ws.pane(next).el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })); return; }
    }
  }

  // Ctrl+Alt+Left and Ctrl+Alt+Right move between the panes (the View menu shows them).
  window.addEventListener('keydown', function (e) {
    if (!e.ctrlKey || !e.altKey || count < 2 || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault();
    step(e.key === 'ArrowLeft' ? -1 : 1);
  });

  /** The split as it is, for the saved view: the layout, the focused pane and the document each pane shows (by its id). */
  function snapshot() {
    if (count < 2) return null;
    var docs = [];
    for (var i = 0; i < count; i++) { var d = i === focused ? DT.current() : paneDoc[i]; docs.push(d ? d.id : null); }
    return { layout: layoutKey, focused: focused, docs: docs };
  }
  /** Brings a saved split back, once the stored tabs are open. The saved focused document becomes the live one first, so the
   *  split is built around the pane that holds it; a document that is no longer open leaves its pane empty. */
  function restore(s) {
    if (!s || !LAYOUTS[s.layout] || LAYOUTS[s.layout][0] < 2 || !api()) return;
    var n = LAYOUTS[s.layout][0], kind = LAYOUTS[s.layout][1];
    var list = openDocs().map(function (t) { return t.doc; });
    var byId = function (id) { return list.find(function (d) { return d.id === id; }) || null; };
    var docs = (s.docs || []).map(byId);
    var want = s.focused > 0 && s.focused < n && docs[s.focused] ? s.focused : 0;
    switching = true;   // the swaps and the focus below are the restore's own: the focus handler stays out
    try {
      if (docs[want] && docs[want] !== DT.current()) api().activate(docs[want]);
      focused = want;
      split(n, kind);
      for (var i = 0; i < count; i++) if (i !== focused && docs[i]) showPreview(i, docs[i]);
      ws.focus(focused);
      placeViewer();
      relayout();
      renderBars();
    } finally { switching = false; }
  }

  function setLayout(key) {
    var spec = LAYOUTS[key];
    if (!spec) return;
    if (spec[0] === 1) unsplit(); else split(spec[0], spec[1]);
  }

  /** The layouts as menu items: the View menu and the header's Split view button show the same list. */
  function layoutItems() {
    return [
      { label: 'One pane', check: count === 1, act: function () { setLayout('one'); } },
      { label: 'Two columns', check: count === 2 && layoutKey === 'columns2', act: function () { setLayout('columns2'); } },
      { label: 'Two rows', check: count === 2 && layoutKey === 'rows2', act: function () { setLayout('rows2'); } },
      { label: 'Three columns', check: count === 3, act: function () { setLayout('columns3'); } },
      { label: 'Four panes (grid)', check: count === 4, act: function () { setLayout('grid4'); } },
      '-',
      { label: 'Previous pane', key: 'Ctrl+Alt+Left', act: function () { step(-1); } },
      { label: 'Next pane', key: 'Ctrl+Alt+Right', act: function () { step(1); } },
    ];
  }

  /** The header's Split view button: the layout list as a menu, in Page view with pages open. */
  var splitBtn = document.getElementById('btnSplit');
  if (splitBtn) splitBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    var A = SP.app;
    if (A.mode !== 'page' || !SP.engine.state.pages.length) { SlopUI.toast('Open a document in Page view to split it.'); return; }
    var r = splitBtn.getBoundingClientRect();
    SlopUI.menu(layoutItems(), r.left, r.bottom + 4);
  });

  SP.panes = {
    snapshot: snapshot,
    restore: restore,
    split: split,
    setLayout: setLayout,
    items: layoutItems,
    unsplit: unsplit,
    focus: focusPane,
    step: step,
    onDocShown: onDocShown,
    count: function () { return count; },
    focused: function () { return focused; },
    layout: function () { return layoutKey; },
    /** The document in each pane, in pane order (the focused pane's is the one on screen). */
    shownDocs: function () { var out = []; for (var i = 0; i < count; i++) out.push(i === focused ? DT.current() : paneDoc[i]); return out; },
    preview: function (i) { return views[i] || null; },
    paneAt: paneAt,
    placeIn: placeIn,
    openDocIn: openDocIn,
  };
})();
