// Camera scanning with the browser's own BarcodeDetector (Chromium today) and getUserMedia. No library, no network.
// support() says plainly why the camera cannot be used here. start() shows the live video and reads a frame
// about five times a second. A code held in view is reported once; it is reported again only after it has
// left the view for three frames in a row, so one label never makes several movements.
(function (g) {
  'use strict';
  const NS = (g.SlopInv = g.SlopInv || {});
  const FRAME_MS = 200;
  const LEAVE_FRAMES = 3;
  const WANTED = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'];

  /** { ok: true } or { ok: false, message } naming the missing piece. */
  function support() {
    if (typeof g.BarcodeDetector !== 'function') {
      return { ok: false, message: 'This browser has no BarcodeDetector, so the camera cannot read codes here. It is available in Chromium-based browsers today. Use the keyboard or scanner mode instead; it works in every browser.' };
    }
    if (!g.navigator || !g.navigator.mediaDevices || !g.navigator.mediaDevices.getUserMedia) {
      return { ok: false, message: 'This browser cannot open a camera on this page (getUserMedia is missing, or the page is not secure). Use the keyboard or scanner mode instead.' };
    }
    return { ok: true };
  }

  /** Plain words for a camera that would not start. */
  function cameraError(e) {
    const name = e && e.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') return 'Camera permission was refused. Allow the camera for this site, or use the keyboard or scanner mode.';
    if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera was found on this device.';
    if (name === 'NotReadableError') return 'The camera is in use by another app. Close it and try again.';
    return `The camera could not start: ${e && e.message ? e.message : 'unknown error'}.`;
  }

  async function formats() {
    const all = g.BarcodeDetector && typeof g.BarcodeDetector.getSupportedFormats === 'function'
      ? await g.BarcodeDetector.getSupportedFormats().catch(() => []) : [];
    const pick = WANTED.filter((f) => !all.length || all.includes(f));
    return pick.length ? pick : WANTED;
  }

  /** Creates a camera reader bound to a video element. onCode(text, { source: 'camera' }); onStatus(text). */
  function createCamera({ video, onCode, onStatus }) {
    let stream = null, timer = 0, detector = null, busy = false, held = null, blanks = 0;
    const say = (t) => onStatus && onStatus(t);

    async function tick() {
      if (busy || !detector || video.readyState < 2) return;
      busy = true;
      try {
        const found = await detector.detect(video);
        handle(found);
      } catch (e) {
        // A frame that fails to decode is skipped; the next frame is tried.
      } finally {
        busy = false;
      }
    }

    function handle(found) {
      const codes = (found || []).map((x) => x.rawValue).filter(Boolean);
      if (!codes.length) {
        if (++blanks >= LEAVE_FRAMES) held = null;
        return;
      }
      blanks = 0;
      if (codes[0] === held) return;
      held = codes[0];
      onCode(codes[0], { source: 'camera' });
    }

    /** Starts the camera. Resolves true when it is reading, false (with a message) when it is not. */
    async function start() {
      if (stream) return true;
      const s = support();
      if (!s.ok) { say(s.message); return false; }
      try {
        detector = new g.BarcodeDetector({ formats: await formats() });
      } catch (e) {
        say(`The barcode reader could not start: ${e.message}`);
        return false;
      }
      try {
        stream = await g.navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      } catch (e) {
        say(cameraError(e));
        return false;
      }
      video.muted = true;
      video.setAttribute('playsinline', '');
      video.srcObject = stream;
      await video.play().catch(() => {});
      timer = setInterval(tick, FRAME_MS);
      say('Point the camera at a barcode. Each code is read once as it comes into view.');
      return true;
    }

    /** Stops the camera and releases it. Safe to call when it is not running. */
    function stop() {
      clearInterval(timer);
      timer = 0;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      stream = null;
      video.srcObject = null;
      held = null;
      blanks = 0;
    }

    return { start, stop, support, get running() { return !!stream; } };
  }

  NS.camera = { support, cameraError, createCamera, WANTED, FRAME_MS, LEAVE_FRAMES };
})(typeof window !== 'undefined' ? window : globalThis);
