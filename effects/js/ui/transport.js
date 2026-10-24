// Slop Effects transport: play and pause, go to start and end, step a frame, loop, a play range (in and out points), the
// scrub bar and the time readout. Playback is the shared SlopMotion player; a play range is kept by seeking back to its
// in point when the playhead passes its out point. Classic script: window.SlopEffects.transport.
(function (g) {
  'use strict';
  const ns = (g.SlopEffects = g.SlopEffects || {});
  const { h, fmtTime } = ns.dom;

  /** Mounts the transport into host. act: the actions, S: the state. Returns { play, pause, toggle, stepFrames, start, end, setIn, setOut, clearRange }. */
  function mount(host, S, act) {
    const fps = () => S.doc.comp.fps;
    const scrub = h('input', { type: 'range', min: 0, max: S.doc.comp.duration, step: 1 / S.doc.comp.fps, value: 0, 'aria-label': 'Playhead', oninput: (e) => { player.seek(Number(e.target.value)); } });
    const time = h('span', { class: 'fx-time', 'aria-live': 'off' });
    const playBtn = h('button', { type: 'button', class: 'sui-btn', title: 'Play or pause (Space)', 'aria-label': 'Play' }, '▶');
    const loopBtn = h('button', { type: 'button', class: 'sui-btn', title: 'Loop', 'aria-pressed': 'true', onclick: () => S.setLoop(!S.loop) }, 'Loop');
    const inBtn = h('button', { type: 'button', class: 'sui-btn', title: 'Set play range start (I)', onclick: () => setIn() }, 'In');
    const outBtn = h('button', { type: 'button', class: 'sui-btn', title: 'Set play range end (O)', onclick: () => setOut() }, 'Out');
    const rangeBtn = h('button', { type: 'button', class: 'sui-btn', title: 'Play the whole composition again (Alt+X clears the range)', onclick: () => clearRange() }, 'Full');
    const rangeNote = h('span', { class: 'fx-time' });

    const player = g.SlopMotion.playback.create({
      duration: S.doc.comp.duration,
      loop: S.loop ? 'loop' : 'none',
      onFrame: (t, st) => {
        const r = S.range;
        if (r && st.playing && (t >= r.out - 1e-6 || t < r.in - 1e-6)) { player.seek(r.in); S.seek(r.in); return; }
        if (st.ended && !S.loop) { player.pause(); }
        S.seek(t);
        if (!st.playing) setPlaying(false);
      },
    });

    /** Sets the play button's state and the aria label. */
    function setPlaying(on) {
      playBtn.textContent = on ? '❚❚' : '▶';
      playBtn.setAttribute('aria-label', on ? 'Pause' : 'Play');
    }

    function play() {
      if (!S.loop && S.playhead >= S.doc.comp.duration - 1e-6) player.seek(S.range ? S.range.in : 0);
      else if (S.range && (S.playhead < S.range.in || S.playhead >= S.range.out)) player.seek(S.range.in);
      player.play();
      setPlaying(true);
    }
    function pause() { player.pause(); setPlaying(false); }
    function toggle() { if (player.playing) pause(); else play(); }
    function seekTo(t) { player.seek(t); S.seek(t); }
    const start = () => seekTo(S.range ? S.range.in : 0);
    const end = () => seekTo(S.doc.comp.duration);
    const stepFrames = (n) => seekTo(S.playhead + n / fps());
    function setIn() { const t = S.playhead; const out = S.range ? S.range.out : S.doc.comp.duration; S.setRange({ in: Math.min(t, out - 1 / fps()), out }); }
    function setOut() { const t = S.playhead; const inT = S.range ? S.range.in : 0; S.setRange({ in: inT, out: Math.max(t, inT + 1 / fps()) }); }
    function clearRange() { S.setRange(null); }

    playBtn.addEventListener('click', toggle);
    host.append(
      h('button', { type: 'button', class: 'sui-btn', title: 'Go to start (Home)', 'aria-label': 'Go to start', onclick: start }, '⇤'),
      h('button', { type: 'button', class: 'sui-btn', title: 'Previous frame (Left)', 'aria-label': 'Previous frame', onclick: () => stepFrames(-1) }, '◁'),
      playBtn,
      h('button', { type: 'button', class: 'sui-btn', title: 'Next frame (Right)', 'aria-label': 'Next frame', onclick: () => stepFrames(1) }, '▷'),
      h('button', { type: 'button', class: 'sui-btn', title: 'Go to end (End)', 'aria-label': 'Go to end', onclick: end }, '⇥'),
      loopBtn, inBtn, outBtn, rangeBtn, rangeNote, scrub, time,
    );

    /** Keeps the readouts and the scrub bar in step with the state. */
    function refresh() {
      const d = S.doc.comp.duration;
      scrub.max = d; scrub.step = 1 / S.doc.comp.fps;
      if (document.activeElement !== scrub) scrub.value = S.playhead;
      time.textContent = fmtTime(S.playhead, S.doc.comp.fps) + ' / ' + d.toFixed(2) + ' s';
      loopBtn.setAttribute('aria-pressed', String(!!S.loop));
      player.setLoop(S.loop ? 'loop' : 'none');
      player.setDuration(d);
      rangeNote.textContent = S.range ? `Range ${S.range.in.toFixed(2)}–${S.range.out.toFixed(2)} s` : '';
      rangeBtn.setAttribute('aria-pressed', String(!!S.range));
    }

    S.on((what) => { if (what === 'doc' || what === 'time' || what === 'view') refresh(); });
    refresh();
    return { play, pause, toggle, start, end, stepFrames, setIn, setOut, clearRange, seekTo, player, refresh, get playing() { return player.playing; } };
  }

  ns.transport = { mount };
})(typeof window !== 'undefined' ? window : globalThis);
