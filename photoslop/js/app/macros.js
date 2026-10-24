/* PhotoSlop macros (shared/macros): record what you do, play it again, run it on many files in Slop Workflows.
 * The steps are PhotoSlop's commands with args (app/ai-commands.js, the ones the Slop AI panel uses). What the menus and
 * dialogs do is reported as the same command: a filter dialog's OK is ps.ai.filter with its settings (ui/filter-dialog.js),
 * Image Size and Canvas Size are ps.ai.image-size and ps.ai.canvas-size (ui/size-dialogs.js), and the menu items below
 * (rotate, flip, crop, select, layers, undo) are their commands. Brush strokes and hand-drawn selections are not steps.
 * With ?macro-host=1 this page is the hidden copy Slop Workflows runs a macro in (shared/macros/frame.js): it then keeps
 * nothing (no autosave, recovery, view state or welcome) and opens, replays and writes one file at a time.
 * Loads after the menus, io/save.js, app/tabs.js, app/view-state.js and app/welcome.js, before app/main.js. */
'use strict';

const PS_RATIOS = ['1:1', '4:5', '3:2', '4:3', '16:9', '9:16'];
/** Crop the whole image to a ratio (width:height) around its centre: the largest such box that fits. */
function psCropRatio(ratio) {
  const [a, b] = String(ratio || '1:1').split(':').map(Number), r = a > 0 && b > 0 ? a / b : 1;
  let w = D.w, hh = Math.round(D.w / r);
  if (hh > D.h) { hh = D.h; w = Math.round(D.h * r); }
  cropTo({ x: Math.round((D.w - w) / 2), y: Math.round((D.h - hh) / 2), w, h: hh }, true);
  fitView();
  return `Cropped to ${w} × ${hh} px (${ratio}).`;
}

(function () {
  const SM = window.SlopMacros;
  if (!SM) return;

  /* ---------- menu items that are commands ---------- */
  const rot = (target) => ({ 'Rotate 180°': ['ps.ai.rotate', { angle: '180', target }], 'Rotate 90° Clockwise': ['ps.ai.rotate', { angle: '90', target }],
    'Rotate 90° Counter Clockwise': ['ps.ai.rotate', { angle: '-90', target }], 'Flip Horizontal': ['ps.ai.flip', { direction: 'horizontal', target }],
    'Flip Vertical': ['ps.ai.flip', { direction: 'vertical', target }] });
  const under = (path, map) => Object.fromEntries(Object.entries(map).map(([k, v]) => [path + '/' + k, v]));
  const SAME = Object.assign({
    'Edit/Undo': ['ps.ai.undo', { steps: 1 }],
    'Edit/Fill with Foreground': () => ['ps.ai.fill', { color: C.fg, opacity: 100 }],
    'Edit/Fill with Background': () => ['ps.ai.fill', { color: C.bg, opacity: 100 }],
    'Image/Crop to Selection': ['ps.ai.crop-to-selection', {}],
    'Layer/New Layer': ['ps.ai.new-layer', {}], 'Layer/Duplicate Layer': ['ps.ai.duplicate-layer', {}], 'Layer/Delete/Delete Layer': ['ps.ai.delete-layer', {}],
    'Select/All': ['ps.ai.select-all', {}], 'Select/Deselect': ['ps.ai.deselect', {}], 'Select/Inverse': ['ps.ai.invert-selection', {}], 'Select/Subject': ['ps.ai.select-subject', {}],
  }, under('Image', rot('image')), under('Edit/Transform', rot('layer')), under('Layer/Rotate and Flip', rot('layer')));
  for (const r of PS_RATIOS) SAME['Image/Crop to Ratio/' + r] = ['ps.ai.crop', { ratio: r }];

  /* ---------- the menu entries ---------- */
  const image = MENUS.find(([n]) => n === 'Image')[1], edit = MENUS.find(([n]) => n === 'Edit')[1];
  const at = image.findIndex((it) => it && it.label === 'Crop to Selection');
  image.splice(at + 1, 0, { label: 'Crop to Ratio', sub: PS_RATIOS.map((r) => ({ label: r, act: () => psCropRatio(r), need: 'layer' })) });
  edit.push('-', { label: 'Macros', sub: [
    { label: 'Record a Macro', cmdId: 'macro.record', act: () => SM.record(), en: () => !SM.recording },
    { label: 'Stop Recording and Save…', cmdId: 'macro.stop', act: () => SM.stop(), en: () => SM.recording },
    { label: 'Cancel Recording', cmdId: 'macro.cancel', act: () => SM.cancel(), en: () => SM.recording },
    { label: 'Macros…', cmdId: 'macro.panel', act: () => SM.openPanel() },
  ] });

  // each menu item that is a command reports it after it runs (keys, menus, the context menu and the palette all call act)
  const walk = (items, path) => {
    for (const it of items) {
      if (!it || it === '-') continue;
      const p = path.concat(it.label);
      if (it.sub) { walk(it.sub, p); continue; }
      const same = SAME[p.join('/')];
      if (!same || !it.act) continue;
      const act = it.act;
      it.act = (...a) => { const [cmd, args] = typeof same === 'function' ? same() : same; const r = act(...a); SM.note(cmd, args, p.slice(1).join(' › ')); return r; };
    }
  };
  for (const [name, items] of MENUS) if (Array.isArray(items)) walk(items, [name]);

  /* ---------- the hidden copy for Slop Workflows ---------- */
  const MIME = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };
  const host = {
    ready: () => new Promise((res) => { const t = () => (document.body && document.body.classList.contains('ready') ? res() : setTimeout(t, 30)); t(); }),
    async open(file) {
      const doc = await readAnyFile(file);
      openDocument(doc.w, doc.h, doc.layers, (file.name || 'Untitled').replace(/\.[^.]+$/, '') || 'Untitled');
      if (doc.guides) adoptGuides(doc.guides);
      if (doc.wm) adoptWatermark(doc.wm);
    },
    async save({ format = 'png', quality = 0.9 } = {}) {
      if (typeof aiSettle === 'function') await aiSettle();
      const mime = MIME[format] || MIME.png;
      const c = await renderExport(mime, 1, mime === MIME.png ? null : '#ffffff');
      const blob = await canvasToBlob(c, mime, quality);
      if (!blob) throw new Error('The picture could not be written.');
      return { blob, kind: blob.type === mime ? format : 'png' };
    },
  };
  if (SM.isHost) {
    // this copy works on its own files only: it must not touch the person's recovery data, tabs, view or Slop Hub launch
    autosave = async () => {}; scheduleAutosave = () => {}; flushAutosave = () => {}; saveTabsIndex = () => {};
    loadAutosave = async () => false; hubBoot = async () => false; restoreView = async () => {}; showWelcome = () => {};
    docIsDirty = () => false;   // nothing to lose here: no "leave the page?" when the run is over
    document.documentElement.dataset.macroHost = '1';
  }
  SM.init({ app: 'photoslop', label: 'PhotoSlop', host });
  if (!SM.isHost) {
    const mount = () => { const b = document.getElementById('macrosBtn'); if (b && window.SlopMacrosPanel) { b.hidden = false; SlopMacrosPanel.button(SM, b); } };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
  }
})();
