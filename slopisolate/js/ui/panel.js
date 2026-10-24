/* SlopIsolate — settings panel (#props): the header (panel-head.js), Model, Edges, the look sections from panel-look.js,
 * and Export. The panel is the one editor: it edits the image on screen, or, with two or more pictures selected, all of
 * them (S.targets(); "Editing 4 pictures"). Controls are built once. Each one registers a bind(it, M) function; refresh()
 * runs them all with the active image (or null) and M = the merged settings of what is edited (core/settings.js merge:
 * M.value(path), M.mixed(path)), so a setting whose values differ shows as mixed. */
(function () {
  'use strict';
  const CO = window.CO, U = CO.util, S = CO.state, K = CO.kit, h = U.h;
  const P = CO.panel = {};
  const binds = [];
  const bind = (fn) => binds.push(fn);
  const pct = (v) => Math.round(v * 100) + '%';
  let cache = {};
  const FALLBACK = [{ id: 'fast', name: 'Fast' }, { id: 'quality', name: 'Quality' }, { id: 'portrait', name: 'Portrait' }];
  const MODELS = window.SlopCutoutModels ? SlopCutoutModels.ids.map((id) => SlopCutoutModels.get(id)) : FALLBACK;

  /** Run a promise-returning action; errors become toasts. */
  const run = (fn) => { Promise.resolve().then(fn).catch((e) => CO.emit('toast', (e && e.message) || String(e))); };

  /** Slider bound to one look field (path, as in core/settings.js). */
  function lookSlider(label, min, max, step, fmt, path, look) {
    const c = K.slider({ label, min, max, step, value: CO.settings.get(S.defaults, path), fmt, onInput: look.input, onCommit: look.commit });
    bind((it, M) => c.sync(M.value(path), M.mixed(path)));
    return c;
  }
  P.lookSlider = lookSlider;

  /* ---------- model ---------- */
  /** The Model panel sets the app's model, for every image (not only the one on screen): the image on screen follows it
   *  again if it had another of its own, and every image that follows it re-runs with it (CO.process.followModel).
   *  With several pictures selected it is a setting of those pictures only (CO.edit: only they re-run). */
  function pickModel(id) {
    const name = MODELS.find((m) => m.id === id).name;
    if (S.bulk()) {
      const n = S.targets().filter((t) => S.modelOf(t) !== id).length;
      CO.edit.apply(S.targets(), { model: id }, 'Model');
      if (n) CO.emit('toast', `Running ${n} picture${n === 1 ? '' : 's'} again with the ${name} model`);
      return P.refresh();
    }
    const it = S.current();
    S.model = id;
    U.store.set('model', id);
    if (it && it.model && it.model !== id) it.model = null;
    const redo = CO.process.followModel();
    if (redo.length > 1) CO.emit('toast', `Running ${redo.length} images again with the ${name} model`);
    P.refresh();
  }
  function modelSec() {
    const rows = MODELS.map((m) => {
      const input = h('input', { type: 'radio', name: 'cutout-model', value: m.id });
      const size = h('span', { class: 'm-size' });
      const lab = h('label', { class: 'model' }, input, h('b', null, m.name), size, h('small', null, m.blurb || ''));
      input.addEventListener('change', () => { if (input.checked) pickModel(m.id); });
      return { m, input, size, lab };
    });
    const mixed = h('p', { class: 'pp-note pp-mixed-note' }, 'Mixed: the selected pictures use different models. Pick one for all.');
    bind((it, M) => {
      const id = M.n ? (M.mixed('model') ? null : M.value('model')) : S.modelOf(it);
      mixed.hidden = !(M.n && M.mixed('model'));
      for (const r of rows) {
        // The size as the first-use notice writes it, from the same byte count (shared/cutout/models.js).
        const on = r.m.id === id, bytes = r.m.bytes ? (window.SlopFirstRun ? SlopFirstRun.size(r.m.bytes) : U.fmtBytes(r.m.bytes)) : '';
        const ready = cache[r.m.id] === true;
        r.input.checked = on;
        r.lab.classList.toggle('on', on);
        r.size.classList.toggle('cached', ready);
        r.size.textContent = ready ? 'on device · ' + bytes : bytes;
        r.size.title = ready ? 'Stored on this device' : 'Downloads once, then runs offline';
      }
    });
    return K.section('Model', h('div', { class: 'models', role: 'radiogroup', 'aria-label': 'Model' }, ...rows.map((r) => r.lab)), mixed);
  }
  /** Which models are stored on this device (engine call; a failure just leaves the sizes plain). */
  function loadCache() {
    try { Promise.resolve(SlopCutout.cached()).then((c) => { cache = c || {}; P.refresh(); }, () => {}); }
    catch (e) { /* engine not ready */ }
  }

  /* ---------- edges ---------- */
  function edgeSec() {
    const L = {
      threshold: K.look('Threshold', 's.threshold'),
      softness: K.look('Softness', 's.softness'),
      feather: K.look('Feather', 's.feather'),
      decontaminate: K.look('Decontaminate', 's.decontaminate'),
      refine: K.look('Refine edges', 's.refine'),
    };
    const rows = [
      lookSlider('Threshold', 0, 1, 0.01, pct, 's.threshold', L.threshold),
      lookSlider('Softness', 0, 1, 0.01, pct, 's.softness', L.softness),
      lookSlider('Feather', 0, 16, 0.5, (v) => v + ' px', 's.feather', L.feather),
    ];
    const dec = K.check({ label: 'Decontaminate', checked: true, onChange: (v) => L.decontaminate.once(v) });
    const ref = K.check({ label: 'Refine edges', checked: true, onChange: (v) => L.refine.once(v) });
    bind((it, M) => { dec.sync(M.value('s.decontaminate'), M.mixed('s.decontaminate')); ref.sync(M.value('s.refine'), M.mixed('s.refine')); });
    return K.section('Edges', ...rows, dec, ref,
      K.note('Threshold cuts the matte, softness smooths its ramp, feather blurs the edge in pixels. Refine re-runs the model.'));
  }

  /* ---------- export ---------- */
  function exportSec() {
    const fmt = K.seg({
      options: [['png', 'PNG'], ['webp', 'WebP'], ['jpg', 'JPG']], value: S.exportOpts.format,
      onChange: (v) => S.setExport({ format: v }),
    });
    const q = K.slider({ label: 'Quality', min: 0.5, max: 1, step: 0.01, value: S.exportOpts.quality, fmt: pct, onInput: (v) => S.setExport({ quality: v }) });
    const jpg = K.color({ label: 'Background', value: S.exportOpts.jpgBg, onInput: (v) => S.setExport({ jpgBg: v }) });
    const one = h('button', { type: 'button', class: 'btn primary', id: 'btnExportOne' });
    U.btnIcon(one, 'download', 'Export image');
    one.addEventListener('click', () => run(() => (S.bulk() ? CO.bulk.act('export') : CO.export.one(S.current()))));
    const all = h('button', { type: 'button', class: 'btn', id: 'btnExportAll' });
    U.btnIcon(all, 'zip', 'Export all (ZIP)');
    all.addEventListener('click', () => run(() => CO.export.all()));
    bind((it) => {
      const f = S.exportOpts.format;
      fmt.sync(f);
      q.hidden = f === 'png';
      q.sync(S.exportOpts.quality);
      jpg.hidden = f !== 'jpg';
      jpg.sync(S.exportOpts.jpgBg);
      const many = S.bulk(), ready = S.targets().filter((t) => t.status === 'done').length;
      U.btnIcon(one, 'download', many ? `Export ${ready} picture${ready === 1 ? '' : 's'} (ZIP)` : 'Export image');
      one.disabled = many ? !ready : !(it && it.status === 'done');
      all.disabled = !S.items.some((i) => i.status === 'done');
    });
    return K.section('Export', fmt, q, jpg,
      h('div', { class: 'no-wm' }, U.icon('lock'), h('span', null, 'No watermarks, ever')),
      h('div', { class: 'pp-btns' }, one, all));
  }

  /* ---------- refresh ---------- */
  P.refresh = function () {
    const root = U.$('#props');
    if (!root) return;
    const it = S.current(), items = S.targets(), M = CO.settings.merge(items.length ? items : [S.defaults], S.modelOf);
    if (!items.length) M.n = 0;
    for (const fn of binds) fn(it, M);
    for (const sec of root.querySelectorAll('.pp-sec')) {
      if (it || items.length) sec.removeAttribute('data-off'); else sec.dataset.off = '1';
    }
  };
  P.refreshSoon = U.debounce(() => P.refresh(), 60);

  P.init = function () {
    const root = U.$('#props');
    if (!root) return;
    const head = CO.panelHead.build(bind);
    const look = CO.panelLook ? CO.panelLook.build(bind) : [];
    root.replaceChildren(...head, modelSec(), edgeSec(), ...look, exportSec());
    CO.on('activeItem', () => P.refresh());
    CO.on('active', () => P.refresh());
    CO.on('item', (it) => { P.refresh(); if (it.status === 'done' && cache[S.modelOf(it)] !== true) loadCache(); });
    CO.on('list', () => P.refresh());
    CO.on('export', () => P.refresh());
    CO.on('sel', () => P.refresh());
    CO.on('settings', () => P.refreshSoon());
    CO.on('history', () => P.refreshSoon());
    loadCache();
    P.refresh();
  };
})();
