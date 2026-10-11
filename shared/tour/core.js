/* SlopTour core: the namespace, tour validation, step logic and per-app saved progress.
 * Classic script, no dependencies. Sets window.SlopTour; spot.js, panel.js and engine.js add to it.
 * Progress lives in localStorage 'slop.tour.<app>' as { v: 1, data }. Every access is guarded: a blocked
 * or full store just means the tour does not remember its place. See HANDOFF.md. */
(function () {
  'use strict';
  const T = (window.SlopTour = window.SlopTour || {});
  const ACTIONS = ['focus', 'scroll', 'none'];
  const CHECKS = ['visible', 'exists', 'none'];
  const STATUSES = ['new', 'active', 'closed', 'finished'];
  const APP_RE = /^[a-z0-9][a-z0-9-]*$/;
  const key = (app) => 'slop.tour.' + app;

  /** The problems with a tour definition, as readable strings. An empty list means it is valid. */
  function problems(t) {
    if (!t || typeof t !== 'object') return ['tour is not an object'];
    const out = [];
    if (typeof t.app !== 'string' || !APP_RE.test(t.app)) out.push('app must be a lowercase id');
    if (typeof t.title !== 'string' || !t.title.trim()) out.push('title is required');
    if (!Array.isArray(t.steps) || !t.steps.length) return out.concat('steps must be a non-empty array');
    const ids = new Set();
    t.steps.forEach((s, i) => {
      const at = 'step ' + (i + 1);
      if (!s || typeof s !== 'object') { out.push(at + ' is not an object'); return; }
      if (typeof s.id !== 'string' || !s.id) out.push(at + ' needs an id');
      else if (ids.has(s.id)) out.push(at + ' id "' + s.id + '" repeats');
      else ids.add(s.id);
      if (typeof s.title !== 'string' || !s.title.trim()) out.push(at + ' needs a title');
      if (typeof s.text !== 'string' || !s.text.trim()) out.push(at + ' needs text');
      if (s.target !== undefined && (typeof s.target !== 'string' || !s.target.trim())) out.push(at + ' target must be a selector');
      if (s.action !== undefined && !ACTIONS.includes(s.action)) out.push(at + ' action must be ' + ACTIONS.join(', '));
      if (s.check !== undefined && !CHECKS.includes(s.check)) out.push(at + ' check must be ' + CHECKS.join(', '));
    });
    return out;
  }

  /** A saved progress record, cleaned up. Unknown or broken input gives a fresh record. */
  function norm(d) {
    d = d && typeof d === 'object' ? d : {};
    return {
      index: Number.isInteger(d.index) && d.index >= 0 ? d.index : 0,
      done: Array.isArray(d.done) ? d.done.filter((x) => typeof x === 'string').slice(0, 200) : [],
      status: STATUSES.includes(d.status) ? d.status : 'new',
      at: typeof d.at === 'number' ? d.at : 0,
    };
  }
  function read(app) {
    try {
      const env = JSON.parse(localStorage.getItem(key(app)) || 'null');
      if (env && env.v === 1) return norm(env.data);
    } catch (e) { /* blocked or corrupt storage: start fresh */ }
    return norm({});
  }
  function write(app, data) {
    try { localStorage.setItem(key(app), JSON.stringify({ v: 1, data: norm(data) })); return true; } catch (e) { return false; }
  }
  function clear(app) {
    try { localStorage.removeItem(key(app)); } catch (e) { /* nothing to clear */ }
  }

  const clamp = (i, n) => Math.max(0, Math.min(n - 1, Number.isInteger(i) ? i : 0));
  /** Where to open: the saved step, or the first one after a finish, a restart or a damaged record. */
  const resumeIndex = (saved, n) => (saved.status === 'finished' ? 0 : clamp(saved.index, n));
  const counter = (i, n) => (i + 1) + ' of ' + n;
  /** The default target check: a step with a target must be visible, a step without one has nothing to check. */
  const checkFor = (step) => step.check || (step.target ? 'visible' : 'none');

  T.logic = { problems, norm, read, write, clear, clamp, resumeIndex, counter, checkFor, key, ACTIONS, CHECKS };
})();
