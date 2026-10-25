/* Slop Recorder: getting the picture and the sound from the browser, as one MediaStream to record. Classic script:
 * SlopRec.capture.
 *   caps()                    what this browser offers: { display, user, recorder, canvasStream, mediaStream, types }
 *   open(opts, { onEnded })   → { stream, preview, parts, notes, stop() }: asks for the screen (getDisplayMedia, with its
 *                             sound when opts.systemAudio), the webcam and the microphone as the source needs
 *                             (SlopRec.plan.needs); screen + webcam are drawn together on a canvas (the webcam in a corner);
 *                             two sounds are mixed with WebAudio. onEnded(): the person stopped sharing in the browser's bar.
 *                             notes: plain sentences about what was not granted ("The screen was shared without sound").
 * The canvas is drawn on a worker's clock, not requestAnimationFrame: a recording goes on while this tab is in the background
 * (the person is showing another window), where frames and timers of the page itself are held back. */
(function (g) {
  'use strict';
  const R = (g.SlopRec = g.SlopRec || {});
  const md = () => (g.navigator && g.navigator.mediaDevices) || null;

  function caps() {
    const M = g.MediaRecorder, d = md();
    const types = M && M.isTypeSupported ? ['video/webm', 'video/mp4', 'audio/webm', 'audio/mp4'].filter((t) => { try { return M.isTypeSupported(t); } catch (e) { return false; } }) : [];
    return {
      display: !!(d && d.getDisplayMedia), user: !!(d && d.getUserMedia), recorder: typeof M === 'function',
      canvasStream: !!(g.HTMLCanvasElement && g.HTMLCanvasElement.prototype.captureStream),
      mediaStream: !!(g.HTMLMediaElement && (g.HTMLMediaElement.prototype.captureStream || g.HTMLMediaElement.prototype.mozCaptureStream)),
      types,
    };
  }

  /** A clock that keeps ticking in a background tab: a tiny worker posting every ms. */
  function ticker(ms, fn) {
    let w = null, id = 0;
    try {
      const url = URL.createObjectURL(new Blob([`setInterval(() => postMessage(0), ${ms});`], { type: 'text/javascript' }));
      w = new Worker(url); URL.revokeObjectURL(url); w.onmessage = fn;
    } catch (e) { id = setInterval(fn, ms); }
    return () => { if (w) w.terminate(); if (id) clearInterval(id); };
  }
  function videoOf(stream) {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.srcObject = stream;
    const p = v.play(); if (p && p.catch) p.catch(() => {});
    return v;
  }
  /** Screen and webcam on one canvas: the screen fills it, the webcam sits in a corner with rounded corners. */
  function compose(screen, camera, o) {
    const P = R.plan, sv = videoOf(screen), cv = videoOf(camera), c = document.createElement('canvas'), x = c.getContext('2d');
    const st = screen.getVideoTracks()[0].getSettings ? screen.getVideoTracks()[0].getSettings() : {};
    c.width = st.width || 1920; c.height = st.height || 1080;
    const draw = () => {
      const w = sv.videoWidth || c.width, h = sv.videoHeight || c.height;
      if (w !== c.width || h !== c.height) { c.width = w; c.height = h; }
      x.drawImage(sv, 0, 0, c.width, c.height);
      if (cv.videoWidth) {
        const r = P.pipRect(c.width, c.height, cv.videoWidth, cv.videoHeight, o.corner, o.pipSize), rad = Math.round(r.w * 0.06);
        x.save(); x.beginPath();
        if (x.roundRect) x.roundRect(r.x, r.y, r.w, r.h, rad); else x.rect(r.x, r.y, r.w, r.h);
        x.clip(); x.drawImage(cv, r.x, r.y, r.w, r.h); x.restore();
      }
    };
    draw();
    const stopTick = ticker(1000 / 30, draw), out = c.captureStream(30);
    return { stream: out, stop: () => { stopTick(); sv.srcObject = null; cv.srcObject = null; } };
  }
  /** One audio track from several: a WebAudio mix (null when there is none, the track itself when there is one). */
  function mix(tracks) {
    if (tracks.length < 2) return { track: tracks[0] || null, stop() {} };
    const AC = g.AudioContext || g.webkitAudioContext, ac = new AC(), dest = ac.createMediaStreamDestination();
    for (const t of tracks) ac.createMediaStreamSource(new MediaStream([t])).connect(dest);
    return { track: dest.stream.getAudioTracks()[0], stop: () => { ac.close().catch(() => {}); } };
  }
  function said(e, what) {
    const n = e && e.name;
    if (n === 'NotAllowedError' || n === 'SecurityError') return new Error(`${what} was not allowed. Allow it in the browser's address bar, then press Record again.`);
    if (n === 'NotFoundError' || n === 'OverconstrainedError') return new Error(`No ${what.toLowerCase()} was found on this device.`);
    if (n === 'NotReadableError') return new Error(`The ${what.toLowerCase()} is in use by another program.`);
    return new Error(`${what} could not be started${e && e.message ? ': ' + e.message : ''}.`);
  }

  async function open(opts, { onEnded } = {}) {
    const P = R.plan, o = P.clean(opts), need = P.needs(o), d = md(), parts = [], notes = [];
    const stopAll = () => { for (const s of parts) for (const t of s.getTracks()) t.stop(); };
    if (!d) throw new Error('This browser gives pages no camera, microphone or screen (a secure https page is needed).');
    try {
      let screen = null, camera = null, mic = null;
      if (need.display) {
        if (!d.getDisplayMedia) throw new Error('This browser cannot record the screen. Phones and tablets do not allow it; use a desktop browser.');
        try { screen = await d.getDisplayMedia({ video: { frameRate: 30 }, audio: need.systemAudio, systemAudio: need.systemAudio ? 'include' : 'exclude', selfBrowserSurface: 'exclude' }); }
        catch (e) { throw said(e, 'Sharing the screen'); }
        parts.push(screen);
        if (need.systemAudio && !screen.getAudioTracks().length) notes.push('The screen was shared without its sound (this browser or this choice shares none).');
        const v = screen.getVideoTracks()[0];
        if (v && onEnded) v.addEventListener('ended', () => onEnded());
      }
      if (need.camera) {
        try { camera = await d.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); } catch (e) { throw said(e, 'The webcam'); }
        parts.push(camera);
      }
      if (need.mic) {
        try { mic = await d.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false }); parts.push(mic); }
        catch (e) { if (o.source === 'mic') throw said(e, 'The microphone'); notes.push('Recording without the microphone: ' + said(e, 'The microphone').message); }
      }
      let video = null, composer = null;
      if (screen && camera) { composer = compose(screen, camera, o); video = composer.stream.getVideoTracks()[0]; }
      else video = (screen || camera) ? (screen || camera).getVideoTracks()[0] : null;
      const sound = mix([...(screen ? screen.getAudioTracks() : []), ...(mic ? mic.getAudioTracks() : [])]);
      const stream = new MediaStream([video, sound.track].filter(Boolean));
      const preview = composer ? composer.stream : video ? new MediaStream([video]) : null;
      return { stream, preview, parts, notes, audioOnly: !video,
        stop() { if (composer) composer.stop(); sound.stop(); stopAll(); } };
    } catch (e) { stopAll(); throw e; }
  }
  R.capture = { caps, open, ticker };
})(typeof window !== 'undefined' ? window : globalThis);
