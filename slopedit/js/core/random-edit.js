/* SlopEdit: the random edit. plan() is pure: the same seed, options and media always give the same cuts.
   Cuts come from a shuffled deck, so no clip repeats until every clip has been used (when there are
   enough clips). A template with n slots makes beats of n simultaneous cuts, one per slot. build()
   writes the plan into the project as ordinary clips inside one SE.change (one undo step). */
(function () {
  'use strict';
  const SE = window.SE, U = SE.util, M = SE.model, T = SE.templates, S = SE.seed, L = SE.layout;
  const R = SE.random = {};
  R.PACE = { fast: [0.6, 1.4], medium: [1.5, 3], slow: [3, 6] };
  R.PACES = [['fast', 'Fast (0.6–1.4 s cuts)'], ['medium', 'Medium (1.5–3 s cuts)'], ['slow', 'Slow (3–6 s cuts)']];
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
    const aspect = T.aspectSize(o.aspect) ? o.aspect : '16:9';
    const target = U.clamp(U.round(+o.target || 30, 2), R.TARGET[0], R.TARGET[1]);
    return { seed: (o.seed == null ? S.make() : o.seed) >>> 0, target, pace, aspect, tpl: T.get(o.tpl) ? o.tpl : null };
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

  /** The cut list for a target length. Returns null when there is nothing usable. */
  R.plan = function (o, media) {
    const opt = R.norm(o), pool = R.usable(media || []);
    if (!pool.length) return null;
    const rng = S.rng(opt.seed), tpl = T.get(opt.tpl), n = tpl ? tpl.slots.length : 1;
    const [lo, hi] = R.PACE[opt.pace], take = deck(pool, rng);
    const cuts = [];
    let t = 0;
    while (opt.target - t > 0.005) {
      const rem = opt.target - t;
      let d = U.round(lo + (hi - lo) * rng(), 2);
      if (rem - d < lo) d = rem;            // the last cut takes what is left, never a sliver
      const picks = take(n);
      d = Math.min(d, ...picks.map((m) => (m.kind === 'image' ? Infinity : m.dur)));
      d = U.round(d, 2);
      cuts.push(picks.map((m, slot) => {
        const room = m.kind === 'image' ? Infinity : m.dur - d;
        const inPt = isFinite(room) && room > 0 ? U.round(rng() * room, 2) : 0;
        return { media: m.id, slot, start: U.round(t, 2), dur: d, in: inPt };
      }));
      t = U.round(t + d, 2);
    }
    const used = new Set(cuts.flat().map((x) => x.media));
    return Object.assign(opt, { seedHex: S.hex(opt.seed), slots: n, cuts, total: t, clips: pool.length, used: used.size });
  };

  /** Write a plan into the project: replaces the timeline clips (call inside SE.change). */
  R.build = function (p, plan) {
    const meta = new Map(p.media.map((m) => [m.id, m]));
    const tpl = T.get(plan.tpl);
    L.setAspect(p, plan.aspect);
    p.clips = [];
    p.layout = null;
    for (let i = 0; i < plan.slots; i++) { L.ensureTrack(p, 'video', i); L.ensureTrack(p, 'audio', i); }
    for (const beat of plan.cuts) for (const it of beat) {
      const m = meta.get(it.media);
      if (!m) continue;
      const c = M.newClip({ kind: m.kind === 'image' ? 'image' : 'video', media: m.id, track: M.videoTracks(p)[it.slot].id, start: it.start, dur: it.dur, in: it.in });
      if (tpl) Object.assign(c, L.fit(p, c, tpl.slots[it.slot]));
      p.clips.push(c);
      if (m.kind === 'video' && m.hasAudio) {
        const a = M.newClip({ kind: 'audio', media: m.id, track: L.ensureTrack(p, 'audio', it.slot).id, start: it.start, dur: it.dur, in: it.in, link: U.uid('l') });
        c.link = a.link;
        p.clips.push(a);
      }
    }
    p.random = { seed: plan.seed, seedHex: plan.seedHex, target: plan.target, pace: plan.pace, aspect: plan.aspect, tpl: plan.tpl, cuts: plan.cuts.length, total: plan.total };
    return plan.total;
  };
})();
