/* SlopLabel — ui/boot: builds the toolbox, wires the chrome (buttons, drag and drop, resize) and
 * starts the app: print-form link, file sent from another app, autosave, or a starter template. */
'use strict';

function buildToolbox() {
  const box = $('toolbox');
  for (const t of TOOLS) {
    if (t === '-') { box.append(mk('span', { class: 'tool-sep' })); continue; }
    const b = mk('button', { type: 'button', class: 'tool' + (t.id === App.tool ? ' on' : ''), 'data-tool': t.id, title: `${t.name} (${(window.SlopCmd && SlopCmd.keyFor('label.tool.' + t.id)) || t.key})`, 'aria-label': t.name, html: `<svg viewBox="0 0 24 24" aria-hidden="true">${t.svg}</svg>` });
    b.addEventListener('click', () => {
      if (t.id === 'image') { setTool('select'); insertImageFile(); return; }
      setTool(t.id);
      if (narrow() && t.create) status('Tap the label to place it');
    });
    box.append(b);
  }
}
function wireChrome() {
  $('btnUndo').addEventListener('click', undo);
  $('btnRedo').addEventListener('click', redo);
  $('btnPrint').addEventListener('click', openPrintDialog);
  $('btnDock').addEventListener('click', () => { const open = !$('app').classList.contains('dock-open'); $('app').classList.toggle('dock-open', open); if (open) renderPanels(); });
  $('cbLabel').addEventListener('click', () => labelSetupDialog());
  $('recPrev').addEventListener('click', () => setRecord(App.rec - 1));
  $('recNext').addEventListener('click', () => setRecord(App.rec + 1));
  $('zoomIn').addEventListener('click', () => zoomTo(App.zoom * 1.25));
  $('zoomOut').addEventListener('click', () => zoomTo(App.zoom / 1.25));
  $('zoomVal').addEventListener('click', fitView);
  // tapping the canvas on a phone closes the panel sheet
  $('stage').addEventListener('pointerdown', () => { if (narrow()) hideDock(); }, true);
  // drag and drop anywhere: SlopDrop (shared/drop) shows the outline and each file's progress in the strip over the
  // stage. A picture dropped on the stage lands where it was dropped; everything else opens as before (openFiles).
  const DROP_RULES = {
    types: ['image/*'],
    exts: ['.sloplabel', '.json', '.zpl', '.prn', '.txt', '.csv', '.tsv', '.xlsx', '.svg'],
    noun: 'a label, picture or data file',
  };
  window.SlopDrop.attach($('lbDrop'), {
    accept: DROP_RULES,
    compact: true,
    targets: [$('app')],
    process: async (file, progress, ctx) => {
      const hit = ctx.at && document.elementFromPoint(ctx.at.x, ctx.at.y);
      if (/^image\//.test(file.type) && hit && hit.closest && hit.closest('#stage')) {
        const [x, y] = toMMpt({ clientX: ctx.at.x, clientY: ctx.at.y });
        await insertImageFile(file, { x: round(x, 2), y: round(y, 2) });
      } else await openFiles([file]);
      return file.name;
    },
  });
  addEventListener('beforeunload', () => { if (App.doc && App.dirty) autosave(App.doc); });
  matchMedia('(max-width: 760px)').addEventListener('change', () => { hideDock(); setTimeout(fitView, 50); });
}
/** The label people see on first visit: the product label template. */
function starterDoc() { return TEMPLATES.find((t) => t.id === 'product').build(); }

async function boot() {
  setTheme(lsGet('sloplabel-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'pro'));
  if (lsGet('sloplabel-rulers') === '0') $('workspace').classList.add('no-rulers');
  App.doc = starterDoc();
  App.hist.reset(App.doc);
  buildToolbox(); initMenus(); initView(); initInteract(); initKeys(); initCommands(); wireChrome();
  onImageReady = () => refresh({ keepProps: true });
  if (await maybeFormMode()) return;
  const saved = await loadAutosave();
  if (saved && saved.doc) { App.doc = saved.doc; App.hist.reset(App.doc, 'Restore'); document.title = App.doc.name + ' — SlopLabel'; await preloadImages(App.doc); }
  rebuildScene(); fitView(); refreshNow();
  await applyView(!!saved); // ui/view-state.js: the tool, and the zoom and pan of a restored label
  status(saved ? 'Restored your last label' : 'Ready', '', 3000);
  await hubBoot().catch((e) => console.warn(e));
  document.body.classList.add('ready');
}
boot().catch((e) => { console.error(e); SlopUI.alert('SlopLabel could not start', String(e && e.message || e)); });
