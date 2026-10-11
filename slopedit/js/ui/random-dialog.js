/* SlopEdit: the Random edit dialog. Target length, pace, aspect, optional template and the seed. The cut
   list is planned live from the same seed Build uses, so what you see is what gets built. Reshuffle
   draws a new seed and keeps the dialog open. Build replaces the timeline in one undoable step. */
(function () {
  'use strict';
  const SE = window.SE, U = SE.util, R = SE.random, T = SE.templates, S = SE.seed, h = U.h, act = SE.act;

  act.randomDialog = function () {
    const pool = R.pool();
    const last = SE.doc.random || {};
    const seedNow = S.make();
    const target = SlopUI.number(last.target || 30, R.TARGET[0], R.TARGET[1], 1);
    const pace = SlopUI.select(R.PACES, last.pace || 'medium');
    const aspect = SlopUI.select(T.ASPECTS.map(([v]) => [v, v]), last.aspect || '16:9');
    const tpl = SlopUI.select([['', 'None: one clip after another']].concat(T.list.map((t) => [t.id, t.name + ' (' + t.slots.length + ' per cut)'])), last.tpl || '');
    const seed = h('input', { class: 'inp', type: 'text', value: S.hex(seedNow), 'aria-label': 'Seed', spellcheck: 'false', autocomplete: 'off', maxlength: '32' });
    const summary = h('p', { class: 'sui-p rd-sum', role: 'status' });
    const list = h('ol', { class: 'rd-list', 'aria-label': 'Cuts in order' });
    const src = pool.length
      ? pool.length + ' clip' + (pool.length > 1 ? 's' : '') + (SE.bin.picked.size ? ' picked in the bin' : ' in the bin (Ctrl-click to pick some)')
      : 'No ready clips yet. Import video or still images first.';
    const opts = () => ({ target: +target.value, pace: pace.value, aspect: aspect.value, tpl: tpl.value || null, seed: S.parse(seed.value) });
    const preview = () => {
      const o = opts();
      seed.value = S.hex(o.seed);
      const plan = R.plan(o, pool);
      list.replaceChildren();
      if (!plan) { summary.textContent = src; return null; }
      summary.textContent = plan.cuts.length + ' cuts · ' + plan.total.toFixed(1) + ' s · ' + plan.used + ' of ' + plan.clips + ' clips used · seed ' + plan.seedHex;
      plan.cuts.forEach((beat, i) => list.append(h('li', null, (i + 1) + '. ' + beat.map((x) => {
        const m = SE.doc.media.find((mm) => mm.id === x.media);
        return (m ? m.name : '?') + ' (in ' + x.in.toFixed(2) + ' s)';
      }).join(' | ') + ' · ' + beat[0].start.toFixed(1) + ' s · ' + beat[0].dur.toFixed(2) + ' s')));
      return plan;
    };
    [target, pace, aspect, tpl].forEach((el) => el.addEventListener('change', preview));
    seed.addEventListener('change', preview);
    seed.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); preview(); } });
    const body = h('div', { class: 'rd' },
      h('div', { class: 'rd-fields' },
        SlopUI.field('Target length', target, 's'), SlopUI.field('Pace', pace), SlopUI.field('Aspect', aspect), SlopUI.field('Template', tpl),
        SlopUI.field('Seed', seed)),
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
