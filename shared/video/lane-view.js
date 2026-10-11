/* Shared video core (window.SlopVideo.laneView): the Layout lane, a timeline strip of layout switches used by
   SlopCut and Reel Remix. Each band is one layout (its name and slot count); each marker is a switch. Add a
   switch at the playhead (with a chosen layout), drag a marker to move it, select one and press Delete (or
   the Delete button) to remove it. Every change is reported through onCommit(switches) as a new list; the host
   stores it and calls update() again. Pointer and keyboard only; no dependencies. */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const SV = (root.SlopVideo = root.SlopVideo || {});
  const V = (SV.laneView = {});
  const SEG = SV.segments, T = SV.templates;
  const SNAP = 0.1;
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const k in attrs) { if (k === 'class') n.className = attrs[k]; else if (k === 'text') n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]); }
    for (const k of kids) n.append(k);
    return n;
  };
  const pct = (t, dur) => (dur > 0 ? Math.min(100, Math.max(0, (t / dur) * 100)) : 0) + '%';
  /** Time of a pointer (client x) on the track, snapped to 0.1 s and clamped to [0, dur]. */
  const timeAt = (track, x, dur) => {
    const r = track.getBoundingClientRect();
    const t = r.width > 0 ? ((x - r.left) / r.width) * dur : 0;
    return Math.round(Math.min(dur, Math.max(0, t)) / SNAP) * SNAP;
  };

  /**
   * Mount a lane into host. opts.onCommit(list) receives the new switch list; opts.onSeek(t) (optional) is called
   * when the track is clicked. Returns { update({ duration, switches, layouts, playhead }) }.
   * layouts is a list of [id, label] for the add select.
   */
  V.mount = function (host, opts) {
    const select = el('select', { class: 'lv-sel', 'aria-label': 'Layout for the new switch' });
    const add = el('button', { type: 'button', class: 'lv-btn', title: 'Add a layout switch at the playhead' }, 'Switch at playhead');
    const del = el('button', { type: 'button', class: 'lv-btn', title: 'Delete the selected switch (Delete key)', disabled: '' }, 'Delete switch');
    const track = el('div', { class: 'lv-track', role: 'group', 'aria-label': 'Layout switches over time' });
    const head = el('div', { class: 'lv-head' }, el('b', { class: 'lv-title' }, opts.label || 'Layouts'), select, add, del);
    const hint = el('p', { class: 'lv-hint' });
    const root2 = el('div', { class: 'lv' }, head, track, hint);
    host.replaceChildren(root2);
    const st = { duration: 10, switches: [], layouts: [], playhead: 0, sel: -1, drag: null };

    const commit = (list) => { if (opts.onCommit) opts.onCommit(SEG.clean(list)); };
    add.addEventListener('click', () => commit(SEG.add(st.switches, st.playhead, select.value)));
    del.addEventListener('click', () => { if (st.sel >= 0) { const i = st.sel; st.sel = -1; commit(SEG.remove(st.switches, i)); } });
    track.addEventListener('pointerdown', (e) => {
      const m = e.target.closest('.lv-mark');
      if (!m) { if (opts.onSeek) opts.onSeek(timeAt(track, e.clientX, st.duration)); return; }
      const i = +m.dataset.i;
      st.sel = i; track.focus?.();
      st.drag = { i, moved: false, t: st.switches[i].start, pointer: e.pointerId, m };
      try { m.setPointerCapture(e.pointerId); } catch (err) { /* not an active pointer: the drag still follows the track */ }
      e.preventDefault();
      for (const x of track.querySelectorAll('.lv-mark')) x.classList.toggle('on', +x.dataset.i === i);
      del.disabled = false;
    });
    track.addEventListener('pointermove', (e) => {
      const d = st.drag;
      if (!d) { if (opts.onScrub && e.buttons === 1) opts.onScrub(timeAt(track, e.clientX, st.duration)); return; }
      if (d.pointer !== e.pointerId) return;
      const t = timeAt(track, e.clientX, st.duration);
      d.moved = d.moved || t !== d.t;
      d.t = t;
      d.m.style.left = pct(t, st.duration);
    });
    const end = (e) => {
      const d = st.drag;
      if (!d || d.pointer !== e.pointerId) return;
      st.drag = null;
      if (d.moved) commit(SEG.move(st.switches, d.i, d.t));
      else render();
      e.stopPropagation();
    };
    track.addEventListener('pointerup', end);
    track.addEventListener('pointercancel', () => { if (st.drag) { st.drag = null; render(); } });
    track.addEventListener('keydown', (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && st.sel >= 0) { e.preventDefault(); const i = st.sel; st.sel = -1; commit(SEG.remove(st.switches, i)); }
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && st.sel >= 0) {
        e.preventDefault();
        const step = (e.shiftKey ? 1 : SNAP) * (e.key === 'ArrowLeft' ? -1 : 1);
        commit(SEG.move(st.switches, st.sel, st.switches[st.sel].start + step));
      }
    });
    track.tabIndex = 0;

    function render() {
      if (st.drag) return; // no re-render while a marker is held: it would drop the pointer capture
      const dur = Math.max(st.duration, 0.1);
      const segs = SEG.norm(st.switches, dur);
      const kids = [];
      segs.forEach((s) => {
        kids.push(el('div', { class: 'lv-band', style: `left:${pct(s.start, dur)};width:${pct(s.end - s.start, dur)}`, title: T.label(s.layout) + ' · ' + s.start.toFixed(1) + '–' + s.end.toFixed(1) + ' s' },
          el('span', { class: 'lv-bl', text: T.label(s.layout) + ' · ' + s.slots + ' slot' + (s.slots > 1 ? 's' : '') })));
      });
      st.switches.forEach((s, i) => {
        if (st.drag && st.drag.i === i) return; // the dragged marker is drawn by the drag
        kids.push(mark(s, i));
      });
      if (st.drag) kids.push(mark({ start: st.drag.t, layout: st.switches[st.drag.i].layout }, st.drag.i, st.drag.m));
      kids.push(el('div', { class: 'lv-ph', style: `left:${pct(st.playhead, dur)}` }));
      track.replaceChildren(...kids);
      del.disabled = st.sel < 0;
      const hasSw = st.switches.length > 0;
      hint.textContent = hasSw
        ? 'Each band is one layout, from its switch to the next. Drag a marker to move it; select it and press Delete to remove it.'
        : 'No switches: one layout for the whole video. Pick a layout and press "Switch at playhead" to change it over time.';
    }
    function mark(s, i, node) {
      const sel = i === st.sel;
      const b = node || el('button', { type: 'button', class: 'lv-mark' + (sel ? ' on' : ''), tabindex: '-1', 'data-i': String(i), 'aria-label': 'Switch to ' + T.label(s.layout) + ' at ' + s.start.toFixed(1) + ' seconds' });
      b.className = 'lv-mark' + (sel ? ' on' : '') + (st.drag && st.drag.i === i ? ' drag' : '');
      b.dataset.i = String(i);
      b.style.left = pct(s.start, Math.max(st.duration, 0.1));
      b.title = T.label(s.layout) + ' at ' + s.start.toFixed(1) + ' s';
      if (!node) b.textContent = String(i + 1);
      return b;
    }
    return {
      update(o = {}) {
        if (o.duration != null) st.duration = +o.duration || 10;
        if (o.switches) st.switches = SEG.clean(o.switches);
        if (o.playhead != null) st.playhead = +o.playhead || 0;
        if (o.layouts) {
          const keep = select.value;
          select.replaceChildren(...o.layouts.map(([v, l]) => el('option', { value: v, text: l })));
          if (o.layouts.some(([v]) => v === keep)) select.value = keep;
        }
        if (st.sel >= st.switches.length) st.sel = -1;
        render();
      }
    };
  };
})();
