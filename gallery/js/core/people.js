/* Slop Gallery: People. Groups photos by how many faces the on-device detector found: one face, two or more, none. There
 * is no identity matching, no face recognition and no names. Results come from the shared face cache (shared/faces/,
 * scope 'gallery', kept for the photo's SHA-256) and are loaded into memory. The background scan runs only while Face
 * detection is on (off by default), one photo at a time with idle time between them, and Stop pauses it. Exposes
 * window.SlopGallery.people. */
(function () {
  'use strict';
  const G = (window.SlopGallery = window.SlopGallery || {});
  const F = () => window.SlopFaces || null;
  const GROUPS = [
    { key: 'faces-1', label: 'One face', test: (n) => n === 1 },
    { key: 'faces-2', label: 'Two or more faces', test: (n) => n >= 2 },
    { key: 'faces-0', label: 'No faces', test: (n) => n === 0 },
  ];
  const results = new Map();   // photo id -> { w, h, faces }
  const failed = new Set();    // photo ids the detector could not read in this session
  const listeners = new Set();
  let loaded = false, running = false, paused = false, done = 0, total = 0, lastMessage = '';

  const emit = () => { for (const fn of [...listeners]) try { fn(); } catch (e) { console.error(e); } };
  const idle = () => new Promise((res) => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(() => res(), { timeout: 1500 });
    else setTimeout(res, 40);
  });
  const countOf = (id) => { const r = results.get(id); return r ? r.faces.length : null; };

  /** Reads the stored results of this library. A result counts only while the photo's SHA-256 is the one it was made for. */
  async function load() {
    if (!F() || !G.library) return;
    try {
      const rows = await F().cache.all('gallery');
      results.clear();
      for (const m of G.library.list()) {
        const r = rows.get(m.id);
        if (r && r.stamp === String(m.sha) && r.model === F().MODEL_ID) results.set(m.id, r);
      }
    } catch (e) { lastMessage = 'The stored results could not be read.'; }
    loaded = true;
    emit();
  }

  /** Photos (in the given order) that have a result, grouped: one face, two or more, none. Empty groups are left out. */
  function groups(list) {
    const out = GROUPS.map((g) => ({ key: g.key, label: g.label, items: [] }));
    for (const m of list) {
      const n = countOf(m.id);
      if (n == null) continue;
      const i = GROUPS.findIndex((g) => g.test(n));
      if (i >= 0) out[i].items.push(m);
    }
    return out.filter((g) => g.items.length);
  }
  /** Photos that have a result (the list the People view shows). */
  const checked = (list) => list.filter((m) => results.has(m.id));
  /** Counts for the bar: checked, photos in the library, and the number in each group. */
  function stats() {
    const list = G.library ? G.library.list() : [];
    const by = { 1: 0, 2: 0, 0: 0 };
    let checkedN = 0;
    for (const m of list) {
      const n = countOf(m.id);
      if (n == null) continue;
      checkedN++;
      by[n === 0 ? 0 : n === 1 ? 1 : 2]++;
    }
    return { total: list.length, checked: checkedN, one: by[1], many: by[2], none: by[0], running, paused, done, pending: total - done, message: lastMessage };
  }

  /** Scans the photos that have no result yet. Re-entrant safe: a second call while a scan runs does nothing. */
  async function scan() {
    if (running || !F() || !G.library || !G.library.loaded) return;
    if (!F().enabled() || paused) { emit(); return; }
    running = true;
    done = 0;
    total = G.library.list().filter((m) => countOf(m.id) == null && !failed.has(m.id)).length;
    lastMessage = '';
    emit();
    try {
      for (const m of G.query.sortNewest(G.library.list())) {
        if (paused || !F().enabled()) break;
        if (countOf(m.id) != null || failed.has(m.id)) continue;
        await idle();
        if (paused || !F().enabled()) break;
        await one(m);
        done++;
        emit();
      }
    } finally {
      running = false;
      emit();
    }
  }
  /** One photo: its original is read, the detector runs (or the stored result is used), and the result is kept. */
  async function one(m) {
    try {
      const row = await G.db.get('originals', m.id);
      if (!row || !row.blob) { failed.add(m.id); return; }
      const res = await F().analyse('gallery', m.id, m.sha, row.blob);
      if (!res) { failed.add(m.id); return; }
      results.set(m.id, { w: res.w, h: res.h, faces: res.faces });
    } catch (e) { failed.add(m.id); lastMessage = 'Some photos could not be read.'; }
  }

  /** Starts (or resumes) the background scan. */
  G.people = {
    load, groups, checked, stats,
    get loaded() { return loaded; },
    /** Starts the scan when the setting is on. */
    start() { paused = false; if (F() && F().enabled()) scan(); else emit(); },
    /** Pauses after the current photo. */
    stop() { paused = true; emit(); },
    /** The faces of a photo for the viewer's boxes, or null. */
    facesOf: (id) => (results.has(id) ? results.get(id).faces : null),
    /** Draws the boxes of a photo over a SlopPreview element, while the setting is on. */
    overlay(el, id) {
      if (!F() || !F().enabled()) return;
      const faces = G.people.facesOf(id);
      if (faces && faces.length) F().drawBoxes(el, faces);
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    GROUPS: GROUPS.map((g) => g.key),
  };

  // The library changes: a new photo is checked in the background; a loaded library reads its results.
  if (G.library) G.library.on((what) => {
    if (what === 'load') load().then(() => G.people.start());
    else if (what === 'photos' && loaded) G.people.start();
  });
  if (F()) F().onChange(() => { if (F().enabled()) G.people.start(); else emit(); });
})();
