/* Reel Remix: export the current plan from the page. The plan is drawn frame by frame at the export preset's size
   (RM.size()) on an offscreen canvas, in real time, while MediaRecorder records that canvas (captureStream). The file
   is WebM (or MP4 where the browser records it). There is no sound. Keep the tab visible while it runs; Stop saves what
   has been drawn so far. Browsers without MediaRecorder are told to use Send to SlopCut. */
(function () {
  'use strict';
  const RM = window.RM;
  const X = (RM.exporter = { busy: false, stop: null });

  X.supported = () => typeof MediaRecorder === 'function' && !!HTMLCanvasElement.prototype.captureStream;
  X.mime = () => ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
  function label(text) { const b = document.getElementById('rm-export'); if (b) b.textContent = text; }
  function save(blob, name) {
    const a = document.createElement('a'), url = URL.createObjectURL(blob);
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  /**
   * Render and record the plan. o.say(msg) reports progress; o.save (default true) downloads the file.
   * Resolves with { blob, name, stopped } or null when there is nothing to export. A second call while busy stops it.
   */
  X.run = async function (o = {}) {
    const say = o.say || (() => {});
    if (X.busy) { if (X.stop) X.stop(); return null; }
    const plan = RM.state.plan;
    if (!plan || !plan.total) { say('Press Remix first, then export'); return null; }
    if (!X.supported()) { say('This browser cannot record video here. Use Send to SlopCut to export.'); return null; }
    const sz = RM.size(), W = sz.w + (sz.w % 2), H = sz.h + (sz.h % 2);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'), mime = X.mime();
    const rec = new MediaRecorder(cv.captureStream(30), mime ? { mimeType: mime, videoBitsPerSecond: 8000000 } : {});
    const parts = [];
    rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
    const stopped = new Promise((r) => { rec.onstop = r; });
    X.busy = true; label('Stop export');
    RM.preview.pause();
    rec.start(250);
    const total = plan.total, t0 = performance.now();
    let raf = 0;
    let stoppedEarly = false;
    await new Promise((resolve) => {
      const finish = () => { cancelAnimationFrame(raf); resolve(); };
      X.stop = () => { stoppedEarly = true; finish(); };
      const step = (now) => {
        const t = Math.min(total, (now - t0) / 1000);
        RM.preview.frame(g, W, H, t);
        say('Exporting ' + Math.min(100, Math.round((100 * t) / total)) + '% · press Stop export to end early');
        if (t >= total) return finish();
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
    rec.stop();
    await stopped;
    X.busy = false; X.stop = null; label('Export');
    RM.preview.seek(RM.preview.t);
    const type = rec.mimeType || mime || 'video/webm';
    const blob = new Blob(parts, { type });
    const name = 'remix-' + plan.seedHex + '.' + (type.includes('mp4') ? 'mp4' : 'webm');
    if (o.save !== false) save(blob, name);
    say((stoppedEarly ? 'Stopped. Saved ' : 'Exported ') + name + ' (' + W + '×' + H + ').');
    return { blob, name, stopped: stoppedEarly };
  };
})();
