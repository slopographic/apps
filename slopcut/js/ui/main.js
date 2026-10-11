/* SlopCut: boot. Feature detection, wiring of panels, restore and Slop Hub launch. */
(function () {
  'use strict';
  const SE = window.SE, A = SE.app;

  /** What this browser can do (WebCodecs, muxers, WebGL, MediaRecorder). */
  function detect() {
    const c = SE.caps = {
      webcodecs: typeof window.VideoEncoder === 'function' && typeof window.VideoFrame === 'function',
      audioEncoder: typeof window.AudioEncoder === 'function',
      decoder: typeof window.VideoDecoder === 'function',
      recorder: typeof window.MediaRecorder === 'function' && !!HTMLCanvasElement.prototype.captureStream,
      webgl: (() => { try { return !!document.createElement('canvas').getContext('webgl'); } catch (e) { return false; } })(),
      rvfc: 'requestVideoFrameCallback' in HTMLVideoElement.prototype,
      mp4mux: !!window.Mp4Muxer, webmmux: !!window.WebMMuxer
    };
    c.summary = c.webcodecs ? 'WebCodecs available: fast, frame-accurate export.' : c.recorder ? 'No WebCodecs: export records in real time to WebM.' : 'This browser cannot encode video; try Chrome, Edge or a recent Safari.';
    return c;
  }
  async function boot() {
    detect();
    A.init();
    SE.bin.init(A.els.bin);
    if (SE.inspector) SE.inspector.init(A.els.insp);
    if (SE.preview) SE.preview.init();
    if (SE.transport) SE.transport.init(A.els.transport);
    if (SE.timeline) SE.timeline.init();
    SE.menus.build();
    await SE.cmd.load();
    A.els.statusCaps.textContent = SE.caps.webcodecs ? 'WebCodecs ✓' : SE.caps.recorder ? 'WebM recorder' : 'no encoder';
    A.els.statusCaps.title = SE.caps.summary;
    if (window.SlopHub && !SE.offline) try { SlopHub.register('slopedit'); } catch (e) { /* ignore */ }
    let restored = false;
    try { restored = await SE.session.restore(); } catch (e) { console.warn(e); }
    if (restored) A.status('Restored your last project');
    await SE.viewState.restore(); // ui/view-state.js: the timeline zoom, scroll, tool and phone pane
    await SE.session.launch().catch((e) => console.warn(e));
    if (A.isPhone()) A.setPane(SE.doc.clips.length ? 'timeline' : 'media');
    SE.emit('change', { label: 'boot', history: true });
    SE.emit('layout', {});
    document.body.classList.add('ready');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
