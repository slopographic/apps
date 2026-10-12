/* SlopIsolate video — the player on the stage. Shown when the active item is a video (#stage[data-kind=video]).
 * Play / scrub drive a hidden <video> element; each frame is drawn with its matte (the frame's matte is picked by
 * time) over a checkerboard, or as the original. Buttons: Cut out video (Cancel while it runs), Save WebM (alpha),
 * Save MP4 on a background colour. Limits and what the browser can do are written under the controls. */
(function () {
  'use strict';
  const CO = window.CO, V = CO.video, U = CO.util, S = CO.state, MT = V.matte;
  const P = V.player = {};
  let root = null, vid = null, cv = null, els = {}, raf = 0, shownId = null;

  const fmt = (t) => (t || 0).toFixed(1);
  /** The item on screen as a video, or null. */
  const current = () => { const it = S.current(); return it && it.kind === 'video' ? it : null; };

  function build(stage) {
    root = U.h('div', { class: 'vplayer', id: 'vplayer', hidden: '' });
    cv = U.h('canvas', { class: 'vp-canvas', 'aria-label': 'Video preview' });
    vid = U.h('video', { muted: '', playsinline: '', preload: 'auto', hidden: '' });
    const screen = U.h('div', { class: 'vp-screen' }, cv);
    els.play = U.h('button', { type: 'button', class: 'btn', 'aria-label': 'Play' }, 'Play');
    els.scrub = U.h('input', { type: 'range', min: '0', max: '1000', value: '0', class: 'vp-scrub', 'aria-label': 'Scrub' });
    els.time = U.h('span', { class: 'vp-time' }, '0.0 / 0.0 s');
    els.view = U.h('select', { class: 'vp-view', 'aria-label': 'Show' }, U.h('option', { value: 'cut' }, 'Cut-out'), U.h('option', { value: 'orig' }, 'Original'));
    els.process = U.h('button', { type: 'button', class: 'btn primary' }, 'Cut out video');
    els.cancel = U.h('button', { type: 'button', class: 'btn', hidden: '' }, 'Cancel');
    els.webm = U.h('button', { type: 'button', class: 'btn', disabled: '' }, 'Save WebM (alpha)');
    els.bg = U.h('input', { type: 'color', value: '#00ff00', class: 'vp-bg', 'aria-label': 'Background colour for MP4' });
    els.mp4 = U.h('button', { type: 'button', class: 'btn', disabled: '' }, 'Save MP4 on colour');
    els.msg = U.h('p', { class: 'vp-msg', role: 'status' });
    const controls = U.h('div', { class: 'vp-controls' }, els.play, els.scrub, els.time, els.view);
    const actions = U.h('div', { class: 'vp-actions' }, els.process, els.cancel, els.webm, U.h('label', { class: 'vp-bgl' }, 'Background ', els.bg), els.mp4);
    root.append(screen, controls, actions, els.msg, vid);
    stage.append(root);
    wire();
  }

  function wire() {
    els.play.onclick = () => { if (vid.paused) vid.play().catch(() => {}); else vid.pause(); };
    els.scrub.oninput = () => { const it = current(); if (it) vid.currentTime = (els.scrub.value / 1000) * it.vid.src.duration; };
    els.view.onchange = () => draw();
    els.process.onclick = () => { const it = current(); if (it) V.run(it); };
    els.cancel.onclick = () => { const it = current(); if (it) V.cancel(it); };
    els.webm.onclick = () => { const it = current(); if (it) V.saveWebm(it); };
    els.mp4.onclick = () => { const it = current(); if (it) V.saveMp4(it, els.bg.value); };
    vid.addEventListener('play', loop);
    vid.addEventListener('pause', () => { els.play.textContent = 'Play'; draw(); });
    vid.addEventListener('seeked', draw);
    vid.addEventListener('timeupdate', () => { sync(); });
    vid.addEventListener('ended', () => { vid.pause(); });
  }

  /** Draw the frame at the video's time with its matte (frame index = time × fps). */
  function draw() {
    const it = current();
    if (!it || !it.vid.src) return;
    const src = it.vid.src, res = it.vid.res, W = src.out.w, H = src.out.h;
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const g = cv.getContext('2d');
    g.clearRect(0, 0, W, H);
    if (els.view.value === 'cut' && res) {
      const i = U.clamp(Math.round(vid.currentTime * src.fps), 0, res.masks.length - 1);
      g.drawImage(MT.frame(vid, res.masks[i], res.mw, res.mh, W, H, null), 0, 0);
    } else g.drawImage(vid, 0, 0, W, H);
    sync();
  }
  function sync() {
    const it = current();
    if (!it) return;
    const d = it.vid.src ? it.vid.src.duration : 0;
    els.scrub.value = d ? Math.round((vid.currentTime / d) * 1000) : 0;
    els.time.textContent = `${fmt(vid.currentTime)} / ${fmt(d)} s`;
  }
  function loop() {
    cancelAnimationFrame(raf);
    const step = () => {
      if (vid.paused || vid.ended) return;
      draw();
      els.play.textContent = 'Pause';
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  /** Show the video item (or hide the player). Called on every change of the active item and item state. */
  function refresh() {
    const it = current(), stage = U.$('#stage');
    if (!root || !stage) return;
    stage.dataset.kind = it ? 'video' : '';
    root.hidden = !it;
    if (!it) { vid.pause(); shownId = null; return; }
    if (shownId !== it.id) {
      shownId = it.id;
      vid.pause();
      vid.src = it.vid.src.url;
      vid.currentTime = 0;
    }
    const st = it.status, res = it.vid.res;
    els.process.disabled = st === 'working' || !it.vid.src;
    els.process.textContent = res ? 'Cut out again' : 'Cut out video';
    els.cancel.hidden = st !== 'working';
    els.webm.disabled = !res || st === 'working';
    els.mp4.disabled = !res || st === 'working';
    const lim = it.vid && it.vid.lim, parts = [];
    if (it.status === 'error') parts.push(it.error);
    else if (lim && lim.msg) parts.push(lim.msg);
    if (!res && st !== 'working') parts.push('The matte runs on this device, one frame at a time; the first pass can take a minute.');
    els.msg.textContent = parts.join(' ');
    draw();
  }

  CO.videoPlayer = P;
  P.init = function () {
    const stage = U.$('#stage');
    if (!stage) return;
    build(stage);
    CO.on('activeItem', refresh);
    CO.on('item', (it) => { if (current() && current().id === it.id) refresh(); });
    CO.on('list', refresh);
    CO.on('export', () => {});
    // A hidden tab stops its frame loop and the video: nothing is decoded or drawn while nobody can see it.
    document.addEventListener('visibilitychange', () => { if (document.hidden && vid) vid.pause(); });
  };
})();
