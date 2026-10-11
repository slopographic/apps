/* SlopCut: template and random-edit actions (SE.act.*), run by commands and menus.
   Templates apply to the selected timeline clips, else to the media picked in the bin (placed at the
   playhead), else give an empty layout at the playhead. With a layout already on, choosing a template re-flows it. */
(function () {
  'use strict';
  const SE = window.SE, U = SE.util, T = SE.templates, L = SE.layout, R = SE.random, S = SE.seed, A = SE.app, act = SE.act;

  /** Bin items picked (Ctrl/Shift-click) that are ready to use. */
  R.picked = () => SE.doc.media.filter((m) => SE.bin.picked.has(m.id) && SE.media.ready(m.id));
  /** The media the random edit draws from: the picked items, or every ready item when none is picked. */
  R.pool = () => {
    const ready = SE.doc.media.filter((m) => SE.media.ready(m.id));
    const pk = ready.filter((m) => SE.bin.picked.has(m.id));
    return pk.length ? pk : ready;
  };

  act.openTemplates = () => SE.bin.show('templates');
  act.applyTemplate = function (id) {
    const tpl = T.get(id);
    if (!tpl) return;
    if (SE.doc.layout) {
      SE.change('Change template', (p) => L.setTemplate(p, id));
      A.status(tpl.name + ': clips kept and re-flowed');
      return;
    }
    const ids = A.selectedIds().filter((x) => { const c = SE.model.clip(SE.doc, x); return c && c.kind !== 'audio'; });
    if (ids.length) {
      let n = 0;
      SE.change('Apply template', (p) => { n = L.apply(p, id, ids); return n ? undefined : false; });
      if (n) A.status(tpl.name + ': ' + n + ' of ' + tpl.slots.length + ' slot' + (tpl.slots.length > 1 ? 's' : '') + ' filled');
      return;
    }
    const metas = R.picked();
    if (metas.length) {
      const t = U.snapFrame(SE.player ? SE.player.time : 0, SE.doc.fps);
      let n = 0;
      SE.change('Apply template', (p) => {
        const made = metas.slice(0, tpl.slots.length).map((m) => L.createMedia(p, m, t, tpl.dur));
        n = L.apply(p, id, made, { dur: tpl.dur });
      });
      A.status(tpl.name + ': ' + n + ' item' + (n > 1 ? 's' : '') + ' placed at the playhead');
      return;
    }
    // Nothing chosen: an empty layout at the playhead, one track and one cell per slot. Drag bin items into the cells.
    const t0 = U.snapFrame(SE.player ? SE.player.time : 0, SE.doc.fps);
    SE.change('Add layout', (p) => L.empty(p, id, t0));
    A.status(tpl.name + ': ' + tpl.slots.length + ' empty slots at the playhead. Drag bin items into them (or onto the monitor cells)');
  };
  act.clearLayout = function () {
    if (!SE.doc.layout) return;
    SE.change('Clear layout', (p) => L.clear(p));
    A.status('Layout cleared; the clips stay on the timeline');
  };
  /** Build a random edit from options (see R.norm). Returns the plan, or false when there is nothing to use. */
  act.randomEdit = function (o) {
    const plan = R.plan(o || {}, R.pool());
    if (!plan) { SlopUI.toast('No usable clips: import video or still images first'); return false; }
    SE.change('Random edit', (p) => { R.build(p, plan); });
    A.select([]);
    if (SE.player) SE.player.seek(0);
    SE.emit('settings', {});
    A.status('Random edit: ' + plan.total.toFixed(1) + ' s, ' + plan.cuts.length + ' cuts, seed ' + plan.seedHex + ' (Undo restores the timeline)');
    return plan;
  };
  /** Same options as the last random edit with a new seed (or the given seed). */
  act.reshuffleRandom = function (seed) {
    const last = SE.doc.random;
    if (!last) { A.status('Make a random edit first (Shift+R)'); return false; }
    return act.randomEdit({ target: last.target, pace: last.pace, aspect: last.aspect, size: last.size, tpl: last.tpl, switches: last.switches, layouts: last.layouts, seed: seed == null ? S.make() : seed });
  };
})();
