/* SlopCut: inspector sections for keyframes ("Animation": animate-in presets, keys at the playhead, one key track
   per property under the clip, and the selected key's editor) and for the random effect layer ("Random effect").
   Both register with I.track so they refresh with the model; the key track does not redraw while a key is dragged. */
(function () {
  'use strict';
  const SE = window.SE, U = SE.util, M = SE.model, F = SE.fields, I = SE.inspector, AN = SE.anim, FX = SE.fx;
  const SV = window.SlopVideo;
  const h = U.h;

  I.animSection = function (c) {
    const id = c.id;
    let sel = null, dragging = false;
    const box = h('div', { class: 'anim' });
    const cur = () => M.clip(SE.doc, id);
    const fps = () => SE.doc.fps;

    /** One track: diamonds for the keys of one property along the clip. Click the empty lane to move the playhead. */
    function lane(clip, prop, dur) {
      const P = AN.PROPS[prop], L = h('div', { class: 'anim-lane', title: 'Click to move the playhead here' });
      L.addEventListener('pointerdown', (e) => {
        if (e.target !== L || e.button !== 0) return;
        const r = L.getBoundingClientRect(), t = clip.start + ((e.clientX - r.left) / r.width) * dur;
        SE.player.seek(U.snapFrame(U.clamp(t, clip.start, clip.start + dur), fps()));
      });
      ((clip.anim && clip.anim[prop]) || []).forEach((k, idx) => {
        const on = sel && sel.prop === prop && sel.idx === idx;
        const b = h('button', { type: 'button', class: 'anim-key' + (on ? ' on' : ''), style: { left: (k.t / dur) * 100 + '%' }, title: P.label + ' key at ' + U.round(k.t, 2) + ' s (drag to move)', 'aria-label': P.label + ' key at ' + U.round(k.t, 2) + ' s' });
        b.addEventListener('pointerdown', (e) => keyDown(e, b, prop, idx, dur, L));
        L.append(b);
      });
      return h('div', { class: 'anim-row' }, h('span', { class: 'anim-name' }, P.label), L);
    }
    function keyDown(e, b, prop, idx, dur, L) {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      sel = { prop, idx };
      box.querySelectorAll('.anim-key.on').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      const r = L.getBoundingClientRect(), x0 = e.clientX, t0 = cur().anim[prop][idx].t, step = 1 / fps();
      let last = t0;
      dragging = true;
      try { b.setPointerCapture(e.pointerId); } catch (err) { /* synthetic event: no active pointer */ } // touch-ok: .anim-key has touch-action: none and a 44 px hit area (css/anim.css)
      const move = (ev) => {
        const t = Math.round((t0 + ((ev.clientX - x0) / r.width) * dur) / step) * step;
        if (Math.abs(t - last) < 1e-9) return;
        last = t;
        SE.change('Move key', (p) => AN.moveKey(M.clip(p, id), prop, idx, t), { key: 'anim:move:' + id + prop + idx });
      };
      const up = () => {
        b.removeEventListener('pointermove', move); b.removeEventListener('pointerup', up); b.removeEventListener('pointercancel', up);
        dragging = false; SE.history.breakCoalescing(); paint();
      };
      b.addEventListener('pointermove', move); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
    }
    /** The editor of the selected key: value, time, ease, delete. */
    function editor(clip) {
      if (!sel) return h('p', { class: 'ins-note' }, 'Click a key to edit its value, time and easing (the easing applies from that key to the next).');
      const { prop, idx } = sel, k = clip.anim[prop][idx], P = AN.PROPS[prop];
      const pct = prop === 'scale' || prop === 'opacity';
      const commit = (label, fn, key) => { SE.change(label, (p) => fn(M.clip(p, id)), { key }); SE.history.breakCoalescing(); };
      const val = h('input', { class: 'inp', type: 'number', step: 1, 'aria-label': P.label + ' key value', value: String(U.round(pct ? k.value * 100 : k.value, 2)) });
      val.addEventListener('change', () => {
        if (val.value === '' || !isFinite(+val.value)) return;
        const v = U.clamp(+val.value, pct ? 0 : -1e6, pct ? (prop === 'scale' ? 400 : 100) : 1e6);
        commit('Key value', (c) => AN.setValue(c, prop, idx, pct ? v / 100 : v), 'anim:val:' + id + prop + idx);
      });
      const time = h('input', { class: 'inp', type: 'number', min: 0, max: U.round(clip.dur, 3), step: 1 / fps(), 'aria-label': 'Key time (s from clip start)', value: String(U.round(k.t, 3)) });
      time.addEventListener('change', () => {
        if (time.value === '' || !isFinite(+time.value)) return;
        commit('Key time', (c) => { sel.idx = AN.moveKey(c, prop, idx, +time.value); });
      });
      const ease = h('select', { class: 'inp', 'aria-label': 'Easing from this key' }, AN.EASES.map(([v, l]) => h('option', { value: v }, l)));
      ease.value = k.ease || 'linear';
      ease.addEventListener('change', () => commit('Easing', (c) => AN.setEase(c, prop, idx, ease.value)));
      const del = h('button', { type: 'button', class: 'btn sm' }, SE.icon('trash'), 'Delete key');
      del.addEventListener('click', () => { sel = null; commit('Delete key', (c) => AN.removeKey(c, prop, idx)); });
      return h('div', { class: 'anim-edit' },
        h('div', { class: 'ins-row' }, h('span', null, P.label + ' ' + (pct ? '(%)' : P.unit ? '(' + P.unit + ')' : '')), val),
        h('div', { class: 'ins-row' }, h('span', null, 'Time (s)'), time),
        h('div', { class: 'ins-row' }, h('span', null, 'Easing'), ease),
        h('div', { class: 'ins-actions' }, del));
    }
    function paint() {
      const clip = cur();
      if (!clip) { box.replaceChildren(); return; }
      if (sel && !(clip.anim && clip.anim[sel.prop] && clip.anim[sel.prop][sel.idx])) sel = null;
      const dur = Math.max(1e-3, clip.dur), n = AN.KEYS.reduce((s, k) => s + ((clip.anim && clip.anim[k]) || []).length, 0);
      box.replaceChildren(
        h('div', { class: 'anim-presets' }, AN.PRESETS.map(([pid, label]) => h('button', { type: 'button', class: 'btn sm', title: 'Writes keys over the first 0.5 s', onclick: () => SE.change(label, (p) => AN.applyPreset(M.clip(p, id), pid, p.w, p.h)) }, label))),
        h('div', { class: 'ins-actions' },
          h('button', { type: 'button', class: 'btn sm', onclick: () => SE.cmd.run('clip.keyPlayhead') }, SE.icon('marker'), 'Key at playhead'),
          h('button', { type: 'button', class: 'btn sm', disabled: n ? null : 'disabled', onclick: () => { sel = null; SE.act.resetKeys([id]); } }, 'Reset keyframes')),
        h('div', { class: 'anim-tracks' }, AN.KEYS.map((prop) => lane(clip, prop, dur))),
        h('div', { class: 'anim-axis' }, h('span', null, '0 s'), h('span', null, U.timecode(dur, fps()))),
        editor(clip),
        h('p', { class: 'ins-note' }, n + ' keys. X, Y and rotation add to the transform above; scale and opacity multiply it. Keys hold their end value before and after.'));
    }
    paint();
    I.track({ sync: () => { if (!dragging) paint(); } });
    return F.section('Animation', 'sparkle', box);
  };

  /** The random effect layer: effect types, intensity, how often the effect changes, seed, reset. */
  I.effectSection = function (c) {
    const id = c.id, t = I.track;
    const fx = () => ((M.clip(SE.doc, id) || {}).fx) || M.fxDefault();
    const setFx = (label, fn, key) => SE.change(label, (p) => { const cc = M.clip(p, id); if (cc) { cc.fx = cc.fx || M.fxDefault(); fn(cc.fx); } }, key ? { key: 'fx:' + id + key } : undefined);
    const after = () => SE.history.breakCoalescing();
    const seedTxt = h('input', { class: 'inp', type: 'text', maxlength: '8', 'aria-label': 'Seed (hex)', spellcheck: 'false' });
    seedTxt.addEventListener('change', () => { const s = SV.seed.parse(seedTxt.value); setFx('Seed', (f) => { f.seed = s; }); after(); });
    const seedRow = { el: h('label', { class: 'ins-row' }, h('span', { title: 'The same seed and settings give the same effects' }, 'Seed'), seedTxt), sync: () => { if (document.activeElement !== seedTxt) seedTxt.value = SV.seed.hex(fx().seed); } };
    return F.section('Random effect', 'sparkle',
      t(F.chips('Effects', FX.TYPES, () => fx().types, (v) => {
        setFx('Effect types', (f) => { f.types = f.types.includes(v) ? f.types.filter((x) => x !== v) : FX.TYPES.map(([k]) => k).filter((k) => k === v || f.types.includes(k)); });
        after();
      })),
      t(F.slider('Intensity', () => fx().intensity, (v) => setFx('Effect intensity', (f) => { f.intensity = U.round(v, 3); }, 'int'), { min: 0, max: 100, step: 1, scale: 100, unit: '%', reset: 0.6, hardMin: 0, hardMax: 100 })),
      t(F.select('Change every', FX.EVERY.map(([v, l]) => [String(v), l]), () => String(fx().every), (v) => { setFx('Change every', (f) => { f.every = +v; }); after(); })),
      t(seedRow),
      h('p', { class: 'ins-note' }, 'One effect is drawn per cut (the change interval) from the enabled types, with this seed. It changes what is drawn on the tracks below this layer, in the preview and the export.'),
      h('div', { class: 'ins-actions' },
        h('button', { type: 'button', class: 'btn sm', onclick: () => setFx('New seed', (f) => { f.seed = SV.seed.make(); }) }, SE.icon('sparkle'), 'New seed'),
        h('button', { type: 'button', class: 'btn sm', onclick: () => SE.act.resetEffect([id]) }, 'Reset effect')));
  };
})();
