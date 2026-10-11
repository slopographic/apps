/* SlopCut: the Random edit dialog. Target length, pace, frame size (a preset), the layout (none, a template,
   or a random grid from the list), optional random switches over time, and the seed. The cut list is planned
   live from the same seed Build uses, so what you see is what gets built. Reshuffle draws a new seed and keeps
   the dialog open. Build replaces the timeline in one undoable step. */
(function () {
  'use strict';
  const SE = window.SE, U = SE.util, R = SE.random, T = SE.templates, S = SE.seed, SV = window.SlopVideo, h = U.h, act = SE.act;
  const GRIDS = ['grid-1x2', 'grid-2x2', 'grid-1x3', 'grid-2x3', 'grid-3x3'];

  act.randomDialog = function () {
    const pool = R.pool();
    const last = SE.doc.random || {};
    const seedNow = S.make();
    const target = SlopUI.number(last.target || 30, R.TARGET[0], R.TARGET[1], 1);
    const pace = SlopUI.select(R.PACES, last.pace || 'medium');
    const size = SlopUI.select(SV.presets.LIST.map((x) => [x.id, x.name]), (SV.presets.LIST.find((x) => x.w === (last.size || {}).w && x.h === (last.size || {}).h) || SV.presets.LIST[2]).id);
    const tpl = SlopUI.select([['', 'None: one clip after another'], ['random', 'Random grid from the list below']]
      .concat(T.list.map((t) => [t.id, t.name + ' (' + t.slots.length + ' per cut)'])), last.tpl || '');
    const switches = SlopUI.check('Switch layouts at random points (uses the list below)', !!last.switches);
    const pick = new Map(GRIDS.map((id) => [id, SlopUI.check(T.get(id).name + ' (' + T.get(id).slots.length + ' cells)', true)]));
    const seed = h('input', { class: 'inp', type: 'text', value: S.hex(seedNow), 'aria-label': 'Seed', spellcheck: 'false', autocomplete: 'off', maxlength: '32' });
    const summary = h('p', { class: 'sui-p rd-sum', role: 'status' });
    const list = h('ol', { class: 'rd-list', 'aria-label': 'Cuts in order' });
    const src = pool.length
      ? pool.length + ' clip' + (pool.length > 1 ? 's' : '') + (SE.bin.picked.size ? ' picked in the bin' : ' in the bin (Ctrl-click to pick some)')
      : 'No ready clips yet. Import video or still images first.';
    const layouts = () => GRIDS.filter((id) => pick.get(id).input.checked);
    const opts = () => {
      const sz = SV.presets.get(size.value);
      return { target: +target.value, pace: pace.value, size: { w: sz.w, h: sz.h }, aspect: sz.aspect, tpl: tpl.value || null,
        switches: switches.input.checked, layouts: layouts(), seed: S.parse(seed.value) };
    };
    const preview = () => {
      const o = opts();
      seed.value = S.hex(o.seed);
      const plan = R.plan(o, pool);
      list.replaceChildren();
      if (!plan) { summary.textContent = src; return null; }
      summary.textContent = plan.cuts.length + ' cuts · ' + plan.total.toFixed(1) + ' s · ' + plan.used + ' of ' + plan.clips + ' clips used · ' + plan.segments.length + ' layout' + (plan.segments.length > 1 ? 's' : '') + ' · seed ' + plan.seedHex;
      plan.cuts.forEach((beat, i) => list.append(h('li', null, (i + 1) + '. ' + beat.map((x) => {
        const m = SE.doc.media.find((mm) => mm.id === x.media);
        return (m ? m.name : '?') + ' (in ' + x.in.toFixed(2) + ' s)';
      }).join(' | ') + ' · ' + beat[0].start.toFixed(1) + ' s · ' + beat[0].dur.toFixed(2) + ' s')));
      return plan;
    };
    const els = [target, pace, size, tpl, switches.input, ...[...pick.values()].map((c) => c.input)];
    els.forEach((el) => el.addEventListener('change', preview));
    seed.addEventListener('change', preview);
    seed.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); preview(); } });
    const body = h('div', { class: 'rd' },
      h('div', { class: 'rd-fields' },
        SlopUI.field('Target length', target, 's'), SlopUI.field('Pace', pace), SlopUI.field('Frame size', size), SlopUI.field('Layout', tpl),
        SlopUI.field('Seed', seed)),
      h('div', { class: 'rd-grids' }, switches.el, h('div', { class: 'rd-pick' }, [...pick.values()].map((c) => c.el))),
      h('p', { class: 'sui-p rd-src' }, src),
      summary, list,
      h('p', { class: 'sui-p rd-note' }, 'The same seed, options and clips always give the same edit. Build puts the cuts on the timeline as ordinary clips; Undo restores the timeline.'));
    SlopUI.dialog({
      title: 'Random edit', cls: 'rd-dlg',
      body,
      buttons: [
        { label: 'Cancel' },
        { label: 'Reshuffle', act: () => { seed.value = S.hex(S.make()); preview(); return false; } },
        {
          label: SE.doc.clips.length ? 'Build (replaces timeline)' : 'Build edit', primary: true,
          act: () => { if (!pool.length) { SlopUI.toast('Import video or still images first'); return false; } return act.randomEdit(opts()) ? undefined : false; }
        }
      ]
    });
    preview();
  };
})();
