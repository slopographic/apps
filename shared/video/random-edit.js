/* Shared video core (window.SlopVideo.random): the random edit as a pure plan. plan() takes options and the
   media and returns the cuts; the same seed, options and media always give the same plan. Cuts come from a
   shuffled deck (no clip repeats until every clip has been used, when there are enough). Layouts can change
   over time: opts.segments (manual switches { start, layout }), or opts.switches with opts.layouts (random
   switch points, drawn from the layout list). A beat never crosses a switch, so each beat has the slots of
   the layout active at its start. Apps write the plan into their project; see regionFor(). */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const SV = (root.SlopVideo = root.SlopVideo || {});
  const R = (SV.random = {});
  const S = SV.seed, T = SV.templates, P = SV.presets, SEG = SV.segments;
  const round = (v, k = 2) => { const f = Math.pow(10, k); return Math.round(v * f) / f; };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  R.PACE = { fast: [0.6, 1.4], medium: [1.5, 3], slow: [3, 6] };
  R.PACES = [['fast', 'Fast (0.6–1.4 s cuts)'], ['medium', 'Medium (1.5–3 s cuts)'], ['slow', 'Slow (3–6 s cuts)']];
  /** Length range (s) of a layout before a random switch, by pace. */
  R.SWITCH = { fast: [2, 4], medium: [4, 8], slow: [6, 12] };
  /** Layouts a random switch picks from when none are given. */
  R.LAYOUTS = ['grid-1x2', 'grid-2x2', 'grid-1x3', 'grid-2x3', 'grid-3x3'];
  R.TARGET = [1, 600];
  /** Sources shorter than this (s) are not used. Stills are always usable. */
  R.MIN_SRC = 0.2;

  /** Usable bin items (video and stills) in a fixed order, so the seed alone decides the edit. */
  R.usable = function (media) {
    return media
      .filter((m) => (m.kind === 'image' || m.kind === 'video') && (m.kind === 'image' || m.dur > R.MIN_SRC))
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  };
  /** Options with every field checked and defaulted. */
  R.norm = function (o = {}) {
    const pace = R.PACE[o.pace] ? o.pace : 'medium';
    const aspect = P.byAspect(o.aspect) ? o.aspect : '16:9';
    const target = clamp(round(+o.target || 30, 2), R.TARGET[0], R.TARGET[1]);
    const size = o.size && +o.size.w && +o.size.h ? P.clamp(o.size.w, o.size.h) : (P.aspectSize(aspect));
    const layouts = (Array.isArray(o.layouts) ? o.layouts : []).map((id) => (T.get(id) ? T.get(id).id : null)).filter(Boolean);
    return {
      seed: (o.seed == null ? S.make() : o.seed) >>> 0, target, pace, aspect, size,
      tpl: T.get(o.tpl) ? T.get(o.tpl).id : null,
      switches: !!o.switches, layouts: [...new Set(layouts)],
      segments: Array.isArray(o.segments) && o.segments.length ? o.segments : null
    };
  };
  /** Draws n distinct clips per call; a clip returns only after every other clip has been used. */
  function deck(media, rng) {
    let bag = [];
    return function take(n) {
      const out = [];
      while (out.length < n) {
        if (out.length >= media.length) { out.push(media[out.length % media.length]); continue; } // not enough clips: reuse
        if (!bag.length) bag = S.shuffle(media, rng);
        const i = bag.findIndex((m) => !out.includes(m));
        if (i >= 0) out.push(bag.splice(i, 1)[0]);
        else bag = [];
      }
      return out;
    };
  }
  /** Random switch points: lengths from the pace, layouts drawn from the list (never the same twice in a row when avoidable). */
  R.switches = function (opt, rng) {
    const [lo, hi] = R.SWITCH[opt.pace];
    const pool = opt.layouts.length ? opt.layouts : R.LAYOUTS;
    const out = [];
    let t = 0, prev = null;
    while (opt.target - t > 0.005) {
      let len = lo + (hi - lo) * rng();
      if (opt.target - (t + len) < lo) len = opt.target - t; // never leave a short tail
      const choices = pool.filter((x) => x !== prev);
      const pick = (choices.length ? choices : pool)[Math.floor(rng() * (choices.length ? choices : pool).length)];
      out.push({ start: round(t, 2), layout: pick });
      prev = pick;
      t = round(t + len, 2);
    }
    return out;
  };
  /** The segments of a plan: manual switches, random switches, or the single layout (tpl) over the whole length. */
  function segmentsFor(opt, rng) {
    const list = opt.segments ? opt.segments : opt.switches ? R.switches(opt, rng) : [{ start: 0, layout: opt.tpl }];
    const segs = SEG.norm(list, opt.target);
    if (!segs.length) return [{ start: 0, end: opt.target, layout: null, slots: 1 }];
    segs[0].start = 0; // the first layout holds from the start
    return segs;
  }

  /** The cut list for a target length. Returns null when there is nothing usable. */
  R.plan = function (o, media) {
    const opt = R.norm(o), pool = R.usable(media || []);
    if (!pool.length) return null;
    const rng = S.rng(opt.seed), take = deck(pool, rng);
    const [lo, hi] = R.PACE[opt.pace];
    const segs = segmentsFor(opt, rng);
    const segAt = (t) => SEG.at(segs, t) || segs[segs.length - 1];
    const cuts = [];
    let t = 0, guard = 0;
    while (opt.target - t > 0.005 && guard++ < 100000) {
      const seg = segAt(t);
      const toEnd = Math.min(seg.end, opt.target) - t;   // time left in this layout, and in the edit
      let d = lo + (hi - lo) * rng();
      if (toEnd <= hi) d = toEnd;                         // the last cut of a layout takes what is left
      else if (toEnd - d < lo) d = toEnd - lo;            // never leave a sliver before a switch or the end
      d = round(d, 2);
      if (d < 0.01) d = Math.max(0.01, round(toEnd, 2));
      const picks = take(seg.slots);
      d = round(Math.min(d, ...picks.map((m) => (m.kind === 'image' ? Infinity : m.dur))), 2); // a source may be shorter
      if (d < 0.01) { t = round(t + Math.max(0.01, toEnd), 2); continue; }
      cuts.push(picks.map((m, slot) => {
        const room = m.kind === 'image' ? Infinity : m.dur - d;
        const inPt = isFinite(room) && room > 0 ? round(rng() * room, 2) : 0;
        return { media: m.id, slot, start: round(t, 2), dur: d, in: inPt };
      }));
      t = round(t + d, 2);
    }
    const used = new Set(cuts.flat().map((x) => x.media));
    return Object.assign(opt, {
      seedHex: S.hex(opt.seed), slots: SEG.maxSlots(segs), segments: segs, cuts, total: t, clips: pool.length, used: used.size
    });
  };
  /** Region (fractions of the frame) of a cut item in a plan, from the layout active at its start. Null for none. */
  R.regionFor = function (plan, item) {
    const seg = SEG.at(plan.segments || [], item.start);
    const tpl = seg && seg.layout ? T.get(seg.layout) : null;
    return T.region(tpl, item.slot);
  };
})();
