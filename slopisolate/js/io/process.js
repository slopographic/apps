/* SlopIsolate — the queue and the active image. Every image is segmented once (its base mask is kept on
 * the item). The image on screen owns a worker job (CO.active): slider and brush changes re-run only the
 * cheap post-processing in the worker via SlopCutout.finish(), so the model never runs twice. */
(function () {
  'use strict';
  const CO = window.CO, U = CO.util, S = CO.state, C = CO.compose;
  const P = CO.process = { active: null };
  const queue = [];
  let running = false, refreshSeq = 0;

  /** Turn a finished engine result into the record the view and export read. */
  function record(it, jobId, r, bitmap) {
    return {
      item: it, jobId, w: r.width, h: r.height, bitmap,
      mask: r.mask, cutout: r.cutout, cut: null, bbox: C.bbox(r.mask, r.width, r.height), rev: 0,
    };
  }
  function fill(act, r) {
    Object.assign(act, { mask: r.mask, cutout: r.cutout, cut: null, bbox: C.bbox(r.mask, act.w, act.h) });
    act.rev++;
  }

  /** Segment one item with the model (sequential queue). */
  async function segment(it) {
    S.setStatus(it, 'working', { progress: 0, error: '' });
    try {
      const r = await SlopCutout.removeBackground(it.file, {
        model: it.model, ...it.s,
        onProgress: (p) => { it.progress = p.total ? p.loaded / p.total : null; CO.emit('progress', { it, p }); },
      });
      it.base = r.base.slice(); it.w = r.width; it.h = r.height;
      it.modelUsed = r.model; it.timings = r.timings; it.progress = null;
      if (r.jobId) SlopCutout.release(r.jobId);
      S.setStatus(it, 'done');
      if (CO.drive && CO.drive.ready()) CO.drive.saveImage(it, r);
      if (!P.active && S.activeId === it.id) P.select(it);
    } catch (e) {
      S.setStatus(it, 'error', { error: e.message || String(e), progress: null });
    }
  }
  async function run() {
    if (running) return;
    running = true;
    while (queue.length) {
      const it = queue.shift();
      if (S.get(it.id)) await segment(it);
    }
    running = false;
  }

  /** Add files to the queue and start segmenting. */
  P.add = function (files, opts = {}) {
    const items = [];
    for (const f of files) {
      if (CO.video && CO.video.isVideo(f)) { CO.video.addItem(f, opts); continue; }
      if (!U.isImage(f)) continue;
      const it = S.createItem(f);
      it.url = URL.createObjectURL(f);
      if (opts.driveId) it.driveOriginId = opts.driveId;
      if (opts.origin) it.origin = opts.origin;
      S.items.push(it);
      items.push(it);
      queue.push(it);
    }
    if (items.length && !S.activeId) S.activeId = items[0].id;
    CO.emit('list', S.items);
    if (items.length) { run(); CO.emit('activeItem', S.current()); }
    return items;
  };

  /** Re-segment an item (new model or a changed file). Keeps its brush edits. */
  P.rerun = function (it) {
    if (P.active && P.active.item === it) P.drop();
    it.base = null;
    if (!queue.includes(it)) queue.push(it);
    S.setStatus(it, 'queued', { error: '' });
    run();
  };

  /** Build a record for an item (new worker job, post-processed). Caller must release() it. */
  P.build = async function (it) {
    const jobId = await SlopCutout.createJob(it.file, it.base);
    const r = await SlopCutout.finish(jobId, it.s, it.edit);
    const bitmap = await U.decode(it.file);
    return record(it, jobId, r, bitmap);
  };

  /** Make an item the active one (the image on screen). */
  P.select = async function (it) {
    if (!it || it.status !== 'done') return;
    if (P.active && P.active.item === it) return;
    const seq = ++refreshSeq;
    P.drop();
    try {
      const act = await P.build(it);
      if (seq !== refreshSeq || S.current() !== it) { SlopCutout.release(act.jobId); return; }
      P.active = act;
      CO.emit('active', act);
    } catch (e) { S.setStatus(it, 'error', { error: e.message }); }
  };

  /** Free the worker job of the active image. */
  P.drop = function () {
    const act = P.active;
    P.active = null;
    if (act) SlopCutout.release(act.jobId).catch(() => {});
  };

  /** Re-run post-processing for the active image (settings or brush edits changed). Newest call wins. */
  P.refresh = async function (it) {
    const act = P.active;
    if (!act || act.item !== it || !act.jobId) return;
    const seq = ++refreshSeq;
    try {
      const r = await SlopCutout.finish(act.jobId, it.s, it.edit);
      if (seq !== refreshSeq || P.active !== act) return;
      fill(act, r);
      CO.emit('active', act);
    } catch (e) { S.setStatus(it, 'error', { error: e.message }); }
  };
  P.refreshSoon = U.debounce((it) => P.refresh(it), 90);

  /** Remove an item from the list. */
  P.remove = function (it) {
    if (P.active && P.active.item === it) P.drop();
    const i = queue.indexOf(it);
    if (i >= 0) queue.splice(i, 1);
    const idx = S.index(it.id);
    if (idx >= 0) S.items.splice(idx, 1);
    if (it.url) URL.revokeObjectURL(it.url);
    if (S.activeId === it.id) {
      const next = S.items[Math.min(idx, S.items.length - 1)] || null;
      S.activeId = next ? next.id : null;
      CO.emit('activeItem', next);
      if (next) P.select(next);
    }
    CO.emit('list', S.items);
  };

  /** Live brush preview: recompute the matte and the cut-out alpha for one dirty rect on the main thread, so the
   * picture follows the brush at every stroke step (no worker round-trip). Same maths as P.matte + P.applyEdit;
   * feather and decontamination are applied by the worker when the stroke ends. */
  P.live = function (it, rect) {
    const act = P.active;
    if (!act || act.item !== it || !it.base || !act.mask || !rect) return;
    const W = act.w, s = it.s || {}, th = s.threshold == null ? 0.5 : s.threshold, sf = s.softness == null ? 1 : s.softness;
    const lo = (th - sf / 2) * 255, hi = (th + sf / 2) * 255, hard = hi - lo < 1, k = hard ? 0 : 255 / (hi - lo);
    const base = it.base, ed = it.edit, m = act.mask, cut = act.cutout.data;
    for (let y = rect.y; y < rect.y1; y++) {
      for (let x = rect.x; x < rect.x1; x++) {
        const i = y * W + x;
        let a = hard ? (base[i] >= th * 255 ? 255 : 0) : (base[i] - lo) * k;
        const e = ed ? ed[i] : 128;
        if (e > 128) a = a + (255 - a) * (e - 128) / 127; else if (e < 128) a = a * e / 128;
        m[i] = a; cut[i * 4 + 3] = a;
      }
    }
    act.rev++; act.cut = null;
    CO.emit('active', act);
  };

  P.pending = () => queue.length + (running ? 1 : 0);
  CO.on('look', (it) => P.refreshSoon(it));
  CO.on('history', ({ it }) => { if (it.edit || it.s) P.refreshSoon(it); });
})();
