/* Reel Remix: state, the plan and the reel manifest. The plan is shared/video (SlopVideo.random.plan), never a
   copy: Remix only chooses the options. The lane (layout switches over time) is the state's lane list; with
   Random on, Remix draws new switch points and replaces the lane with them. Exposes window.RM. */
(function () {
  'use strict';
  const SV = window.SlopVideo, RM = (window.RM = window.RM || {});
  const S = SV.seed, R = SV.random, P = SV.presets, T = SV.templates;
  RM.GRIDS = ['grid-1x2', 'grid-2x2', 'grid-1x3', 'grid-2x3', 'grid-3x3'];
  RM.state = {
    items: [], target: 30, pace: 'medium', preset: 'phone', custom: { w: 1080, h: 1920 },
    base: 'none', random: true, grids: RM.GRIDS.slice(), lane: [], seed: S.make(), plan: null, playhead: 0
  };
  /** Frame size of the chosen export preset (the sequence size). */
  RM.size = () => P.size(RM.state.preset, RM.state.custom.w, RM.state.custom.h) || { w: 1080, h: 1920 };
  RM.aspect = (size) => { const p = P.get(P.idFor(size.w, size.h)); return p ? p.aspect : '16:9'; };
  /** Options for the shared plan, from the state. seed defaults to the state's seed. */
  RM.options = function (seed) {
    const st = RM.state, size = RM.size();
    return {
      seed: seed == null ? st.seed : seed, target: st.target, pace: st.pace, size, aspect: RM.aspect(size),
      tpl: st.base === 'none' ? null : st.base,
      switches: !!st.random, layouts: st.grids.slice(),
      segments: !st.random && st.lane.length ? st.lane.map((s) => ({ start: s.start, layout: s.layout })) : null
    };
  };
  /** Media the plan may draw from: the loaded items. */
  RM.media = () => RM.state.items.filter((m) => m.kind && (m.kind === 'image' || m.dur > 0));
  /** Build the random edit. With Random on, the drawn switch points become the lane. Returns the plan or null. */
  RM.remix = function () {
    const st = RM.state;
    const plan = R.plan(RM.options(), RM.media());
    st.plan = plan;
    if (plan) {
      st.seed = plan.seed;
      if (st.random) st.lane = plan.segments.filter((s) => s.layout).map((s) => ({ start: s.start, layout: s.layout }));
    }
    return plan;
  };
  /** A new seed and a new edit with the same options. */
  RM.reshuffle = function () { RM.state.seed = S.make(); return RM.remix(); };
  /** The lane's layout choices (named templates, then grids), as [id, label]. */
  RM.layoutChoices = () => T.list.map((t) => [t.id, t.name]).concat(RM.GRIDS.map((id) => [id, T.get(id).name]));
  /** The Slop Drive manifest that SlopEdit opens (format slop-reel, with the remix options). Ids are Drive ids in play order. */
  RM.manifest = function (ids) {
    const o = RM.options();
    return {
      format: 'slop-reel', version: 2, from: 'remix', created: new Date().toISOString(),
      template: 'remix', length: o.target, pace: o.pace, aspect: o.aspect, order: 'selection',
      files: ids.slice(), overlays: [], remix: JSON.parse(JSON.stringify(o))
    };
  };
})();
