/* Slop Press — boot: build the UI, attach the view and tools, open a document (Slop Drive launch,
   autosave, or the welcome template), autosave on every change, drag & drop. */
(function () {
  'use strict';
  var PR = window.PR, U = PR.util, S = PR.state, V = PR.view, UI = PR.ui, ST = PR.store;

  function welcomeDoc() {
    if (PR.templates && PR.templates.make) { try { return PR.templates.make('magazine'); } catch (e) { console.warn(e); } }
    return PR.model.create({ pages: 4 });
  }
  function dropSetup() {
    var stage = U.$('#stage'), depth = 0;
    stage.addEventListener('dragenter', function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') >= 0) { depth++; stage.classList.add('dropping'); e.preventDefault(); } });
    stage.addEventListener('dragover', function (e) { if (stage.classList.contains('dropping')) e.preventDefault(); });
    stage.addEventListener('dragleave', function () { if (--depth <= 0) { depth = 0; stage.classList.remove('dropping'); } });
    stage.addEventListener('drop', function (e) {
      depth = 0; stage.classList.remove('dropping');
      var fs = Array.prototype.slice.call(e.dataTransfer.files || []); if (!fs.length) return;
      e.preventDefault();
      var r = V.canvas.getBoundingClientRect(), w = V.toWorld(e.clientX - r.left, e.clientY - r.top), hit = PR.tools.hit(w.x, w.y);
      var s = V.surfaceAt(w.x, w.y); if (s) PR.selectTool.activate(s);
      if (fs.length === 1 && /\.slpress$/i.test(fs[0].name)) return PR.io.openAny(fs[0]);
      var frame = hit && /image|rect|ellipse/.test(hit.it.type) && /^image\//.test(fs[0].type) ? hit.it : null;
      PR.place.files(fs, { frame: frame });
    });
  }
  function prefs() {
    var show = ST.pref('show'); if (show) U.assign(V.show, show);
    U.$('#app').classList.toggle('no-rulers', !V.show.rulers);
  }
  function boot() {
    prefs();
    UI.buildMenubar(); UI.buildToolbar(); UI.buildDock(); UI.buildStatus();
    V.init(U.$('#view'));
    PR.rulers.attach(U.$('#rulerH'), U.$('#rulerV'));
    PR.tools.attach(V.canvas);
    PR.textEdit.attach(U.$('#textInput'));
    dropSetup();
    U.$('#panelsToggle').addEventListener('click', function () { UI.togglePanels(); });
    U.$('#searchCmd').addEventListener('click', function () { PR.actions.palette(); });
    var setKey = function () { U.$('#searchKey').textContent = PR.actions.keyFor('help.search') || (U.IS_MAC ? '⌘K' : 'Ctrl+K'); };
    setKey(); PR.on('keys', setKey);
    PR.on('commit', function () { ST.schedule(); });
    PR.on('doc', function () { V.request(); });
    PR.on('page', function () { V.request(); PR.ui.refreshPanels(); });
    addEventListener('pagehide', function () { if (S.dirty) ST.autosave(); });
    PR.actions.loadSlopCmd();
    PR.tools.set('select');
    // open: Slop Drive launch → autosave → welcome template
    var launch = PR.hub ? PR.hub.init() : Promise.resolve(null);
    return launch.then(function (rec) {
      if (rec) return true;
      return ST.restore().then(function (saved) {
        if (saved && saved.doc && !/[?&]fresh\b/.test(location.search)) { return PR.io.openDoc(saved.doc, saved.fileName).then(function () { S.dirty = true; U.toast('Restored your last session'); return true; }); }
        return PR.io.openDoc(welcomeDoc()).then(function () { return true; });
      });
    }).catch(function (e) {
      console.error(e);
      return PR.io.openDoc(PR.model.create({ pages: 2 }));
    }).then(function () {
      if (innerWidth < 900) U.$('#app').classList.remove('dock-open');
      V.resize(); V.fitPage(); UI.refreshPanels(); UI.refreshControlBar(true); UI.refreshStatus();
      U.$('#app').classList.add('ready');
      PR.emit('ready');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
