/* SlopCut test helpers: boot the real app in an iframe and reach its SE namespace.
   Exposes window.ST = { boot, win, SE, M, E, reset, matte, pixel, colorVideo, errors }. */
(function () {
  'use strict';
  const { waitFor } = SlopTest;
  const ST = window.ST = { errors: [] };

  /** Load slopcut/index.html into an iframe and wait until it is ready. */
  ST.boot = async function (frameId = 'app', query = '') {
    const fr = document.getElementById(frameId);
    fr.src = 'about:blank';
    await waitFor(() => fr.contentWindow && fr.contentWindow.location.href === 'about:blank');
    fr.src = '../../slopcut/index.html' + query;
    await waitFor(() => { const w = fr.contentWindow; return w && w.document && w.document.body && w.document.body.classList.contains('ready') && w.SE && w.SE.app; }, { timeout: 30000 });
    const win = fr.contentWindow;
    win.addEventListener('error', (e) => ST.errors.push(frameId + ': ' + e.message));
    win.addEventListener('unhandledrejection', (e) => ST.errors.push(frameId + ': ' + (e.reason && e.reason.message || e.reason)));
    if (frameId === 'app') Object.assign(ST, { win, SE: win.SE, M: win.SE.model, E: win.SE.edit });
    return win;
  };
  /** Fresh empty project without dialogs. */
  ST.reset = async function () {
    await ST.SE.session.newProject(false);
    ST.SE.app.select([]);
  };
  /** A bare project (no UI): tracks V1, V2, A1, A2 at 160×90, 10 fps. */
  ST.project = (o = {}) => ST.M.newProject(Object.assign({ w: 160, h: 90, fps: 10 }, o));
  /** Add a colour matte clip to a project. */
  ST.matte = function (p, trackIdx, start, dur, color, extra = {}) {
    const t = ST.M.videoTracks(p)[trackIdx];
    return ST.E.addGenerated(p, 'color', t.id, start, dur, Object.assign({ color }, extra));
  };
  /** Render a project at time t into a canvas and return [r,g,b,a] at (x, y). */
  ST.renderAt = function (p, t, opts = {}) {
    const c = ST.win.document.createElement('canvas');
    c.width = opts.W || p.w; c.height = opts.H || p.h;
    ST.SE.compositor.render(c.getContext('2d'), p, t, { W: c.width, H: c.height, source: opts.source || (() => null) });
    return c;
  };
  ST.px = (c, x, y) => [...c.getContext('2d').getImageData(x, y, 1, 1).data];
  ST.near = (a, b, tol = 6) => a.every((v, i) => Math.abs(v - b[i]) <= tol);
  /** Can this browser encode video with WebCodecs? */
  ST.canEncode = async function () {
    const w = ST.win;
    if (typeof w.VideoEncoder !== 'function') return false;
    return !!(await ST.SE.synth.pickVideoCodec(64, 64, 10, 2e5));
  };
  /** A synthetic test video: frame i is a flat colour (R = i*12) with a white bar at x = i (encoded in the page). */
  ST.colorVideo = async function (frames = 20, fps = 10, tone = true) {
    const blob = await ST.SE.synth.video({ w: 160, h: 90, fps, dur: frames / fps, draw: (g, t, i) => { g.fillStyle = 'rgb(' + Math.min(255, i * 12) + ',40,90)'; g.fillRect(0, 0, 160, 90); g.fillStyle = '#fff'; g.fillRect(i * 4, 70, 4, 20); }, tone: tone ? (t) => { const v = Math.sin(2 * Math.PI * 440 * t) * 0.3; return [v, v]; } : null });
    return new ST.win.File([blob], 'colors.' + (blob.type.includes('mp4') ? 'mp4' : 'webm'), { type: blob.type });
  };
})();
