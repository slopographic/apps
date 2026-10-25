/* Slop Font: boot. The header (SlopAppBar: Open…, and New font, Save project, the handwriting sheet in its menu), the
 * suite's List · View · Panel layout (shared/frame, SlopFrame: the glyph grid on the left, the editor, Kerning and Type
 * test views in the middle, the settings with Download font at the foot of the right panel; on phones the grid is the
 * page, a glyph opens over it, and the panel is a bottom sheet whose foot always shows), drops anywhere on the page
 * (shared intake, spec 'fontcreator'), a file sent from another app (?drive=), and the project kept in this browser
 * (js/store.js). Classic script, after the other parts. FC.main: frame(), tab(name), newFont(), ready (a Promise). */
(function (g) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const S = () => g.FC.state, F = () => g.SlopFont;
  let frame = null, tabs = null, resolveReady;
  const ready = new Promise((r) => { resolveReady = r; });
  const name = () => (g.slopAppName ? g.slopAppName('fontcreator') : 'Slop Font');

  function tab(v) {
    if (!['draw', 'kerning', 'test'].includes(v)) throw new Error(`Unknown view “${v}”: draw, kerning or test`);
    if (tabs) tabs.show(v);
    S().set({ tab: v });
    if (frame && frame.showView) frame.showView();
    if (v === 'kerning') g.FC.kerning.paint();
    if (v === 'test') g.FC.tester.show();
    if (v === 'draw') g.FC.editor.paint();
  }
  function newFont() {
    const U = g.SlopUI, el = U.el;
    const fam = el('input', { class: 'sui-input', id: 'fc-new-family', value: 'My Font', maxlength: '120' }), style = el('input', { class: 'sui-input', id: 'fc-new-style', value: 'Regular', maxlength: '60' });
    const chars = el('select', { class: 'sui-input', id: 'fc-new-chars' });
    for (const s of [{ id: 'none', label: 'Start empty (add characters as you go)' }, ...F().charset.SETS, { id: 'all', label: 'All Latin (Basic, Latin-1, Extended-A)' }]) chars.append(el('option', { value: s.id }, s.label));
    chars.value = 'basic';
    U.dialog({ title: 'New font', cls: 'fc-dialog', body: el('div', { class: 'fc-dlg' }, U.field('Family name', fam), U.field('Style', style), U.field('Characters to draw', chars),
      el('p', { class: 'sui-p' }, 'The font on the page is replaced; Undo brings it back. 1000 units per em, ascender 800, descender −200, cap height 700, x-height 500 (change them under Metrics).')),
    buttons: [{ label: 'Cancel' }, { label: 'Create', primary: true, act: () => {
      const p = F().model.create({ family: fam.value.trim() || 'My Font', style: style.value.trim() || 'Regular' });
      if (chars.value !== 'none') for (const cp of F().charset.codes(chars.value)) F().model.ensure(p, cp);
      S().load(p, 'New font');
      S().set({ set: chars.value === 'none' ? 'font' : chars.value });
      U.toast(`New font: ${p.info.family}`);
    } }] });
  }
  function hint() {
    const box = $('fc-start');
    if (box) box.hidden = F().model.stats(S().project()).drawn > 0;
  }
  /** The header first, at once: the shell's buttons and the Tour button go into it when the page is parsed. */
  function header() {
    g.SlopAppBar.mount($('fc-bar'), {
      home: '../', title: name(), subtitle: 'Make a font in your browser: draw, trace handwriting or edit a font. Nothing is uploaded.',
      actions: [{ id: 'open', label: 'Open…', icon: 'open', onClick: () => g.SlopIntake.pick({ to: 'fontcreator' }) }],
      menu: [{ id: 'new', label: 'New font…', onClick: newFont }, { id: 'save', label: 'Save project to Slop Drive', icon: 'save', onClick: () => g.FC.io.saveToDrive('sfont').catch((e) => g.SlopUI.toast(e.message)) },
        { id: 'download-project', label: 'Download project (.sfont)', icon: 'download', onClick: () => g.FC.io.download('sfont') }, { separator: true },
        { id: 'sheet', label: 'Print a handwriting sheet…', icon: 'print', onClick: () => g.FC.sheetUi.template() }, { id: 'sheet-read', label: 'Read a filled sheet…', onClick: () => g.FC.sheetUi.pick() }],
    });
  }
  function boot() {
    frame = g.SlopFrame.mount($('fc-main'), { list: $('fc-list'), view: $('fc-view'), panel: $('fc-panel'), panelLabel: 'Settings', storageKey: 'fontcreator',
      phone: '(max-width: 860px)', phoneButton: false, width: 320, min: 280, max: 480 });
    if (frame.setList) frame.setList(true);
    g.FC.io.register();
    g.FC.grid.mount($('fc-list'));
    g.FC.toolbar.mount($('fc-tools-host'));
    g.FC.editor.mount($('fc-stage'));
    g.FC.kerning.mount($('view-kerning'));
    g.FC.tester.mount($('view-test'));
    g.FC.panel.mount($('fc-panel'));
    tabs = g.SlopTabs.mount($('fc-tabs'), { select: (v) => tab(v) });
    tabs.show(S().settings().tab || 'draw');
    for (const [id, run] of [['fc-start-pen', () => { g.FC.tools.set('pen'); g.FC.editor.focus(); }], ['fc-start-open', () => g.SlopIntake.pick({ to: 'fontcreator' })],
      ['fc-start-sheet', () => g.FC.sheetUi.template()], ['fc-start-svg', () => g.FC.svgUi.open()]]) $(id).addEventListener('click', run);
    g.SlopIntake.dropTarget($('fc-main'), { to: 'fontcreator' });
    S().on(hint);
    hint();
    if (g.SlopHub) g.SlopHub.register('fontcreator');
    g.SlopIntake.launch({ to: 'fontcreator' });
  }
  g.FC.main = { frame: () => frame, tab, newFont, ready };
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      header();
      await g.FC.store.restore();
      boot();
      if (S().settings().tab !== 'draw') tab(S().settings().tab);
    } catch (e) { console.error(e); if (g.SlopUI) g.SlopUI.toast(name() + ' could not start: ' + e.message); }
    document.body.classList.add('ready');
    resolveReady();
  });
})(window);
