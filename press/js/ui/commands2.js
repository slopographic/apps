/* Slop Press — commands: Layout, Type, View, Window, Help, plus one command per paragraph/character style. */
(function () {
  'use strict';
  var PR = window.PR, A = PR.actions, S = PR.state, H = PR.history, P = PR.pages, M = PR.model, U = PR.util, V = PR.view, FM = PR.format, ST = PR.store;
  var ui = function () { return PR.ui || {}; };
  var textTarget = function () { return FM.hasText(); };
  function goPage(i) { if (!S.doc.pages.length) return; S.editMaster = null; S.page = U.clamp(i, 0, S.doc.pages.length - 1); PR.emit('page', S.page); V.showPage(S.page); PR.touch(); }
  PR.goPage = goPage;
  function setTheme(t) { document.documentElement.setAttribute('data-theme', t); ST.pref('theme', t); V.request(); PR.emit('theme', t); }
  function toggle(key, label) { V.show[key] = !V.show[key]; ST.pref('show', V.show); V.request(); PR.emit('view'); if (label) U.toast(label + (V.show[key] ? ' on' : ' off')); }
  function special(ch, label) { return function () { PR.textEdit.insert(ch, label); }; }

  A.register([
    /* ---------- Layout ---------- */
    { id: 'layout.addPage', title: 'Add Page', group: 'Layout', keys: ['Shift+Mod+P'], keywords: ['insert', 'new page'], run: function () { P.insertPages(S.doc, S.page + 1, 1); H.commit('Add page'); goPage(S.page + 1); } },
    { id: 'layout.insertPages', title: 'Insert Pages…', group: 'Layout', run: function () { ui().insertPages(); } },
    { id: 'layout.duplicatePage', title: 'Duplicate Page', group: 'Layout', run: function () { P.duplicatePage(S.doc, S.page); H.commit('Duplicate page'); goPage(S.page + 1); } },
    { id: 'layout.deletePage', title: 'Delete Page', group: 'Layout', when: function () { return S.doc.pages.length > 1 && !S.editMaster; }, run: function () { P.deletePages(S.doc, [S.page]); S.sel = []; H.commit('Delete page'); goPage(Math.min(S.page, S.doc.pages.length - 1)); } },
    { id: 'layout.firstPage', title: 'First Page', group: 'Layout', keys: ['Shift+Mod+PageUp'], run: function () { goPage(0); } },
    { id: 'layout.prevPage', title: 'Previous Page', group: 'Layout', keys: ['Shift+PageUp'], run: function () { goPage(S.page - 1); } },
    { id: 'layout.nextPage', title: 'Next Page', group: 'Layout', keys: ['Shift+PageDown'], run: function () { goPage(S.page + 1); } },
    { id: 'layout.lastPage', title: 'Last Page', group: 'Layout', keys: ['Shift+Mod+PageDown'], run: function () { goPage(S.doc.pages.length - 1); } },
    { id: 'layout.goto', title: 'Go to Page…', group: 'Layout', keys: ['Mod+J'], run: function () { window.SlopUI.prompt('Go to Page', 'Page', String(P.label(S.doc, S.page))).then(function (v) { if (v == null) return; var n = parseInt(v, 10) - (S.doc.startPage || 1); if (!isNaN(n)) goPage(n); }); } },
    { id: 'layout.marginsColumns', title: 'Margins and Columns…', group: 'Layout', run: function () { ui().docSetup('margins'); } },
    { id: 'layout.createGuides', title: 'Create Guides…', group: 'Layout', keywords: ['grid', 'rows', 'columns'], run: function () { ui().createGuides(); } },
    { id: 'layout.clearGuides', title: 'Clear Guides on Page', group: 'Layout', run: function () { var g = PR.layers.guideList(S.doc, S); g.length = 0; H.commit('Clear guides'); } },
    { id: 'layout.newMaster', title: 'New Master…', group: 'Layout', run: function () { ui().newMaster(); } },
    { id: 'layout.editMaster', title: 'Edit Master of This Page', group: 'Layout', checked: function () { return !!S.editMaster; }, run: function () {
      if (S.editMaster) { S.editMaster = null; S.sel = []; PR.emit('page', S.page); V.fitPage(); PR.touch(); return; }
      var pg = S.doc.pages[S.page], mid = pg && pg.master || (S.doc.masters[0] && S.doc.masters[0].id);
      if (!mid) return U.toast('No master pages yet');
      ui().editMaster(mid, P.masterSide(S.doc, S.page));
    } },
    { id: 'layout.applyMaster', title: 'Apply Master to Pages…', group: 'Layout', run: function () { ui().applyMaster(); } },
    { id: 'layout.overrideMaster', title: 'Override All Master Page Items', group: 'Layout', keys: ['Alt+Shift+Mod+L'], when: function () { return !S.editMaster && P.masterItems(S.doc, S.page).length > 0; }, run: function () { var m = P.overrideMaster(S.doc, S.page); H.commit('Override master items'); PR.select(m.map(function (i) { return i.id; })); } },
    { id: 'layout.autoflow', title: 'Autoflow Overset Text', group: 'Layout', keywords: ['add pages', 'overset'], when: function () { return PR.engine.oversetStories().length > 0; }, run: function () {
      var sid = PR.selected()[0] && PR.selected()[0].story; var list = PR.engine.oversetStories(); if (list.indexOf(sid) < 0) sid = list[0];
      var n = PR.engine.autoflow(sid); H.commit('Autoflow'); U.toast(n + ' page' + (n === 1 ? '' : 's') + ' added');
    } },

    /* ---------- Type ---------- */
    { id: 'type.bold', title: 'Bold', group: 'Type', keys: ['Shift+Mod+B'], when: textTarget, run: function () { FM.toggle('bold'); } },
    { id: 'type.italic', title: 'Italic', group: 'Type', keys: ['Shift+Mod+I'], when: textTarget, run: function () { FM.toggle('italic'); } },
    { id: 'type.underline', title: 'Underline', group: 'Type', keys: ['Shift+Mod+U'], when: textTarget, run: function () { var c = FM.current(); FM.char({ underline: !(c && c.char.underline) }); } },
    { id: 'type.alignLeft', title: 'Align Left', group: 'Type', keys: ['Shift+Mod+L'], when: textTarget, run: function () { FM.para({ align: 'left' }); } },
    { id: 'type.alignCenter', title: 'Align Center', group: 'Type', keys: ['Shift+Mod+C'], when: textTarget, run: function () { FM.para({ align: 'center' }); } },
    { id: 'type.alignRight', title: 'Align Right', group: 'Type', keys: ['Shift+Mod+R'], when: textTarget, run: function () { FM.para({ align: 'right' }); } },
    { id: 'type.justify', title: 'Justify (last line left)', group: 'Type', keys: ['Shift+Mod+J'], when: textTarget, run: function () { FM.para({ align: 'justify' }); } },
    { id: 'type.justifyAll', title: 'Justify All Lines', group: 'Type', keys: ['Shift+Mod+F'], when: textTarget, run: function () { FM.para({ align: 'justify-all' }); } },
    { id: 'type.bigger', title: 'Increase Point Size', group: 'Type', keys: ['Shift+Mod+.'], when: textTarget, run: function () { var c = FM.current(); FM.char({ size: Math.round((c.char.size + 1) * 10) / 10 }); } },
    { id: 'type.smaller', title: 'Decrease Point Size', group: 'Type', keys: ['Shift+Mod+,'], when: textTarget, run: function () { var c = FM.current(); FM.char({ size: Math.max(1, Math.round((c.char.size - 1) * 10) / 10) }); } },
    { id: 'type.trackIn', title: 'Tighten Tracking', group: 'Type', keys: ['Alt+ArrowLeft'], when: function () { return !!S.text; }, run: function () { var c = FM.current(); FM.char({ tracking: (c.char.tracking || 0) - 10 }); } },
    { id: 'type.trackOut', title: 'Loosen Tracking', group: 'Type', keys: ['Alt+ArrowRight'], when: function () { return !!S.text; }, run: function () { var c = FM.current(); FM.char({ tracking: (c.char.tracking || 0) + 10 }); } },
    { id: 'type.pageNumber', title: 'Insert Current Page Number', group: 'Type', keys: ['Alt+Shift+Mod+N'], keywords: ['special character', 'folio', 'marker'], when: function () { return !!S.text; }, run: special(M.PAGE_NUM, 'Page number') },
    { id: 'type.emDash', title: 'Insert Em Dash', group: 'Type', keys: ['Alt+Shift+-'], keywords: ['special character'], when: function () { return !!S.text; }, run: special('—', 'Em dash') },
    { id: 'type.enDash', title: 'Insert En Dash', group: 'Type', keys: ['Alt+-'], keywords: ['special character'], when: function () { return !!S.text; }, run: special('–', 'En dash') },
    { id: 'type.nbsp', title: 'Insert Nonbreaking Space', group: 'Type', keys: ['Alt+Mod+X'], keywords: ['special character', 'white space'], when: function () { return !!S.text; }, run: special('\u00A0', 'Nonbreaking space') },
    { id: 'type.softHyphen', title: 'Insert Discretionary Hyphen', group: 'Type', keys: ['Shift+Mod+-'], keywords: ['special character'], when: function () { return !!S.text; }, run: special('\u00AD', 'Discretionary hyphen') },
    { id: 'type.lineBreak', title: 'Insert Forced Line Break', group: 'Type', keywords: ['special character', 'shift enter'], when: function () { return !!S.text; }, run: special('\u2028', 'Line break') },
    { id: 'type.bullet', title: 'Insert Bullet •', group: 'Type', keywords: ['special character'], when: function () { return !!S.text; }, run: special('•', 'Bullet') },
    { id: 'type.copyright', title: 'Insert Copyright ©', group: 'Type', keywords: ['special character'], when: function () { return !!S.text; }, run: special('©', 'Copyright') },
    { id: 'type.placeholder', title: 'Fill with Placeholder Text', group: 'Type', keywords: ['lorem ipsum'], when: function () { return PR.selected().some(function (it) { return it.type === 'text'; }) || !!S.text; }, run: function () { ui().fillPlaceholder(); } },
    { id: 'type.clearOverrides', title: 'Clear Overrides', group: 'Type', when: textTarget, run: function () { FM.clearOverrides(); } },
    { id: 'type.redefinePara', title: 'Redefine Paragraph Style from Selection', group: 'Type', when: textTarget, run: function () { if (FM.redefine('para')) U.toast('Style redefined'); } },
    { id: 'type.newParaStyle', title: 'New Paragraph Style…', group: 'Type', run: function () { ui().styleEditor('para', null); } },
    { id: 'type.newCharStyle', title: 'New Character Style…', group: 'Type', run: function () { ui().styleEditor('char', null); } },
    { id: 'type.hyphenate', title: 'Hyphenate', group: 'Type', when: textTarget, checked: function () { var c = FM.current(); return !!(c && c.para.hyphenate); }, run: function () { var c = FM.current(); FM.para({ hyphenate: !c.para.hyphenate }); } },
    { id: 'type.composerKP', title: 'Paragraph Composer (Knuth–Plass)', group: 'Type', when: textTarget, checked: function () { var c = FM.current(); return !!(c && c.para.composer === 'kp'); }, run: function () { FM.para({ composer: 'kp' }); } },
    { id: 'type.composerGreedy', title: 'Single-line Composer (greedy)', group: 'Type', when: textTarget, checked: function () { var c = FM.current(); return !!(c && c.para.composer !== 'kp'); }, run: function () { FM.para({ composer: 'greedy' }); } },
    { id: 'type.gridAlign', title: 'Align to Baseline Grid', group: 'Type', when: textTarget, checked: function () { var c = FM.current(); return !!(c && c.para.gridAlign); }, run: function () { var c = FM.current(); FM.para({ gridAlign: !c.para.gridAlign }); } },
    { id: 'type.dropCap', title: 'Drop Cap (3 lines)', group: 'Type', when: textTarget, checked: function () { var c = FM.current(); return !!(c && c.para.dropLines >= 2); }, run: function () { var c = FM.current(); FM.para({ dropLines: c.para.dropLines >= 2 ? 0 : 3 }); } },

    /* ---------- View ---------- */
    { id: 'view.zoomIn', title: 'Zoom In', group: 'View', keys: ['Mod+=', 'Shift+Mod+='], run: function () { V.zoomBy(1.25); } },
    { id: 'view.zoomOut', title: 'Zoom Out', group: 'View', keys: ['Mod+-'], run: function () { V.zoomBy(0.8); } },
    { id: 'view.fitPage', title: 'Fit Page in Window', group: 'View', keys: ['Mod+0'], run: function () { V.fitPage(); } },
    { id: 'view.fitSpread', title: 'Fit Spread in Window', group: 'View', keys: ['Alt+Mod+0'], run: function () { V.fitSpread(); } },
    { id: 'view.actual', title: 'Actual Size', group: 'View', keys: ['Mod+1'], run: function () { V.actualSize(); } },
    { id: 'view.pasteboard', title: 'Entire Pasteboard', group: 'View', keys: ['Alt+Shift+Mod+0'], run: function () { V.fitRect(V.bounds()); } },
    { id: 'view.preview', title: 'Preview Mode', group: 'View', keys: ['W'], keywords: ['screen mode', 'hide guides'], checked: function () { return V.preview; }, run: function () { V.preview = !V.preview; V.request(); PR.emit('view'); } },
    { id: 'view.guides', title: 'Show Guides', group: 'View', keys: ['Mod+;'], checked: function () { return V.show.guides; }, run: function () { toggle('guides', 'Guides'); } },
    { id: 'view.baseline', title: 'Show Baseline Grid', group: 'View', keys: ["Alt+Mod+'"], checked: function () { return V.show.baseline; }, run: function () { toggle('baseline', 'Baseline grid'); } },
    { id: 'view.frames', title: 'Show Frame Edges', group: 'View', keys: ['Mod+H'], checked: function () { return V.show.frames; }, run: function () { toggle('frames'); } },
    { id: 'view.threads', title: 'Show Text Threads', group: 'View', keys: ['Alt+Mod+Y'], checked: function () { return V.show.threads; }, run: function () { toggle('threads'); } },
    { id: 'view.snap', title: 'Snap to Guides', group: 'View', keys: ['Shift+Mod+;'], checked: function () { return V.show.snap; }, run: function () { toggle('snap', 'Snapping'); } },
    { id: 'view.rulers', title: 'Show Rulers', group: 'View', keys: ['Mod+R'], checked: function () { return V.show.rulers; }, run: function () { toggle('rulers'); document.getElementById('app').classList.toggle('no-rulers', !V.show.rulers); } },
    { id: 'theme.pro', title: 'Theme: Pro (dark)', group: 'View', checked: function () { return document.documentElement.getAttribute('data-theme') === 'pro'; }, run: function () { setTheme('pro'); } },
    { id: 'theme.light', title: 'Theme: Light', group: 'View', checked: function () { return document.documentElement.getAttribute('data-theme') === 'light'; }, run: function () { setTheme('light'); } },
    { id: 'theme.classic', title: 'Theme: Classic 98', group: 'View', checked: function () { return document.documentElement.getAttribute('data-theme') === 'classic'; }, run: function () { setTheme('classic'); } },

    /* ---------- Window ---------- */
    { id: 'window.pages', title: 'Pages Panel', group: 'Window', keys: ['Mod+F12'], run: function () { ui().showPanel('pages'); } },
    { id: 'window.layers', title: 'Layers Panel', group: 'Window', keys: ['F7'], run: function () { ui().showPanel('layers'); } },
    { id: 'window.paraStyles', title: 'Paragraph Styles Panel', group: 'Window', keys: ['Mod+F11'], run: function () { ui().showPanel('styles', 'para'); } },
    { id: 'window.charStyles', title: 'Character Styles Panel', group: 'Window', keys: ['Shift+F11'], run: function () { ui().showPanel('styles', 'char'); } },
    { id: 'window.props', title: 'Properties Panel', group: 'Window', run: function () { ui().showPanel('props'); } },
    { id: 'window.swatches', title: 'Swatches Panel', group: 'Window', keys: ['F5'], run: function () { ui().showPanel('swatches'); } },
    { id: 'window.togglePanels', title: 'Show/Hide Panels', group: 'Window', keys: ['Tab'], run: function () { ui().togglePanels(); } },

    /* ---------- Help ---------- */
    { id: 'help.search', title: 'Search Commands…', group: 'Help', keys: ['Mod+K'], keywords: ['palette', 'spotlight'], run: function () { A.palette(); } },
    { id: 'help.shortcuts', title: 'Keyboard Shortcuts…', group: 'Help', keys: ['Alt+Shift+Mod+K'], run: function () { A.keymap(); } },
    { id: 'help.about', title: 'About Slop Press', group: 'Help', run: function () { ui().about(); } },
    { id: 'help.home', title: 'slopographic.com', group: 'Help', run: function () { location.href = '../'; } }
  ]);

  /* ---------- one command per style ("Apply paragraph style: Heading 1") ---------- */
  var styleIds = [];
  PR.registerStyleCommands = function () {
    if (!S.doc) return;
    styleIds.forEach(function (id) { A.unregister(id); }); styleIds = [];
    var list = [];
    PR.styles.names(S.doc, 'para').forEach(function (n) { list.push({ id: 'style.para.' + n, title: 'Apply paragraph style: ' + n, group: 'Styles', keywords: ['paragraph style'], when: textTarget, run: function () { FM.paraStyle(n); } }); });
    PR.styles.names(S.doc, 'char').forEach(function (n) { list.push({ id: 'style.char.' + n, title: 'Apply character style: ' + n, group: 'Styles', keywords: ['character style'], when: textTarget, run: function () { FM.charStyle(n); } }); });
    styleIds = list.map(function (c) { return c.id; });
    A.register(list);
  };
  var lastSig = '';
  PR.on('commit', function () { var sig = S.doc && Object.keys(S.doc.styles.para).concat(Object.keys(S.doc.styles.char)).join('|'); if (sig !== lastSig) { lastSig = sig; PR.registerStyleCommands(); } });
  PR.on('doc', function () { lastSig = ''; PR.registerStyleCommands(); });
})();
