/* Reel Remix: the page. Wires the bin (drop or pick clips and photos, drag them onto the stage), the controls (target
   length, pace, export preset, fill, layout, Random, seed), Remix and Reshuffle, the preview with Play, Export and
   Send to SlopCut, the Layout lane (click or drag to scrub) and the cut list (per-cut fill, drop targets). Everything
   here is the DOM side; the plan, the state and the manifest are in core.js. */
(function () {
  'use strict';
  const RM = window.RM, SV = window.SlopVideo, $ = (id) => document.getElementById(id), S = SV.seed;
  const fmt = (s) => { const t = Math.max(0, s), m = Math.floor(t / 60), r = (t - m * 60).toFixed(1); return m + ':' + (r.length < 4 ? '0' : '') + r; };
  const LOCK_SVG = '<svg class="rm-lock" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 7V5a4 4 0 0 1 8 0v2h1v8H3V7h1zm2 0h4V5a2 2 0 0 0-4 0v2z" fill="currentColor"/></svg>';
  const FILL_LABELS = [['auto', 'Auto: cover, blur when orientations mix'], ['cover', 'Cover (crop to fill)'], ['fit', 'Fit (letterbox)'], ['stretch', 'Stretch (distort to fill)'], ['blur', 'Blur background']];

  function status(msg) { $('rm-status').textContent = msg; }
  /** Fill a select from [value, label] pairs, keeping the value when it is still there. */
  function fill(sel, list, value) {
    sel.replaceChildren(...list.map(([v, l]) => new Option(l, v)));
    if (list.some(([v]) => v === value)) sel.value = value;
  }
  function renderBin() {
    const ul = $('rm-bin'), st = RM.state;
    $('rm-count').textContent = st.items.length + ' item' + (st.items.length === 1 ? '' : 's');
    ul.replaceChildren(...st.items.map((it) => {
      const li = document.createElement('li');
      li.dataset.id = it.id;
      li.draggable = !it.missing; li.title = it.missing ? 'Missing: add a file with this name' : 'Drag onto a slot of the preview or a cut';
      li.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData(RM.ITEM_MIME, it.id); e.dataTransfer.setData('text/plain', it.name);
        e.dataTransfer.effectAllowed = 'copy';
      });
      const name = document.createElement('span');
      name.className = 'rm-name'; name.textContent = (it.missing ? 'Missing · ' : '') + it.name + ' · ' + (it.kind === 'video' ? fmt(it.dur) : 'photo') + (it.w && it.h ? ' · ' + SV.orient.classify(it.w / it.h) : '');
      const rm = document.createElement('button');
      rm.type = 'button'; rm.className = 'rm-x'; rm.textContent = '×'; rm.title = 'Remove ' + it.name; rm.setAttribute('aria-label', 'Remove ' + it.name);
      rm.onclick = () => { RM.removeItem(it.id); renderBin(); status('Removed ' + it.name + '. Press Remix to plan again.'); };
      li.append(name, rm);
      return li;
    }));
    if (!st.items.length) ul.append(Object.assign(document.createElement('li'), { className: 'rm-empty', textContent: 'Drop clips and photos here, or use Add files.' }));
  }
  /** One cut in the cut list: its items (each a drop target for a clip) and its fill. */
  function cutItem(beat, i, st) {
    const li = document.createElement('li');
    const locked = beat.every((x) => SV.locks.has(st.locks, i, x.slot));
    if (locked) li.classList.add('locked');
    const lk = document.createElement('button');
    lk.type = 'button'; lk.className = 'rm-lockbtn'; lk.innerHTML = LOCK_SVG;
    lk.title = locked ? 'Unlock cut ' + (i + 1) : 'Lock cut ' + (i + 1) + ': its clips stay through Reshuffle';
    lk.setAttribute('aria-label', lk.title); lk.setAttribute('aria-pressed', String(locked));
    lk.onclick = () => { RM.toggleCutLock(i); renderPlan(); status(locked ? 'Cut ' + (i + 1) + ' unlocked' : 'Cut ' + (i + 1) + ' locked: Reshuffle keeps its clips'); };
    li.append(lk, ' ' + (i + 1) + '. ');
    beat.forEach((x, k) => {
      if (k) li.append(' | ');
      const m = st.items.find((q) => q.id === x.media);
      const span = document.createElement('span');
      span.className = 'rm-cut-item';
      span.textContent = (m ? m.name : '?') + ' (slot ' + (x.slot + 1) + (st.timing !== 'same' || (m && m.kind === 'video' && st.video === 'random') ? ', ' + fmt(x.start) + '–' + fmt(x.start + x.dur) : '') + ')';
      RM.dnd.cutTargets(span, i, x.slot);
      li.append(span);
    });
    const fx = st.plan && st.plan.effect ? SV.effects.at(st.plan.effect, i) : null;
    if (fx) li.append(' · fx ' + SV.effects.name(fx.kind));
    const sel = document.createElement('select');
    sel.className = 'rm-cutfill'; sel.setAttribute('aria-label', 'Fill for cut ' + (i + 1));
    fill(sel, FILL_LABELS, beat[0].fill || 'auto');
    sel.addEventListener('change', () => { RM.setCutFill(i, sel.value); renderPlan(); status('Cut ' + (i + 1) + ' fill: ' + sel.options[sel.selectedIndex].text); });
    li.append(' · ' + fmt(beat[0].start) + ' ', sel);
    if (locked) li.append(' ', Object.assign(document.createElement('span'), { className: 'rm-lockbadge', textContent: 'locked' }));
    return li;
  }
  /** Show the plan: the cut list, the total, the lane and the scrubber range. */
  function renderPlan() {
    const st = RM.state, plan = st.plan;
    const cuts = $('rm-cuts');
    $('rm-scrub').max = String(plan ? plan.total : 0);
    $('rm-total').textContent = plan ? 'Total ' + fmt(plan.total) + ' of ' + fmt(st.target) + ' · ' + plan.segments.length + ' layout' + (plan.segments.length > 1 ? 's' : '') + ' · seed ' + plan.seedHex : 'Nothing planned yet';
    cuts.replaceChildren(...(plan ? plan.cuts.map((beat, i) => cutItem(beat, i, st)) : []), RM.panel.effectRow());
    RM.lane.update({ duration: plan ? plan.total : st.target, switches: st.lane, layouts: RM.layoutChoices(), playhead: st.playhead });
    RM.preview.setPlan();
    RM.preview.seek(Math.min(st.playhead, plan ? plan.total : 0));
    slotsCut = -2; renderSlots();
    RM.panel.renderKeys();
  }
  function readControls() {
    const st = RM.state;
    st.target = Math.min(600, Math.max(1, +$('rm-target').value || 30));
    st.pace = $('rm-pace').value;
    st.preset = $('rm-preset').value;
    st.custom = { w: +$('rm-cw').value || 1080, h: +$('rm-ch').value || 1920 };
    st.base = $('rm-base').value;
    st.fill = $('rm-fill').value;
    st.timing = $('rm-timing').value; st.video = $('rm-vtiming').value;
    st.min = +$('rm-lmin').value || 1; st.max = +$('rm-lmax').value || 3;
    st.stagger = $('rm-stagger').value === '' ? 1 : Math.max(0, +$('rm-stagger').value || 0);
    st.audioMode = $('rm-audio').value; st.audioTrack = $('rm-track').value || 'random';
    st.random = $('rm-random').checked;
    st.grids = RM.GRIDS.filter((g) => $('rm-g-' + g).checked);
    const seed = S.parse($('rm-seed').value);
    st.seed = seed;
    $('rm-seed').value = S.hex(seed);
    $('rm-custom').hidden = st.preset !== SV.presets.CUSTOM;
    $('rm-size').textContent = RM.size().w + '×' + RM.size().h + ' · ' + RM.aspect(RM.size());
  }
  /** Remix: plan a new edit with the current options (the seed shown is used). */
  function remix(fresh) {
    readControls();
    if (fresh) { RM.state.seed = S.make(); $('rm-seed').value = S.hex(RM.state.seed); }
    const plan = RM.remix();
    if (!plan) { status(RM.media().length ? 'Nothing usable to plan' : 'Add some clips or photos first'); RM.state.plan = null; renderPlan(); return null; }
    RM.lane.update({ switches: RM.state.lane });
    $('rm-seed').value = S.hex(RM.state.seed);
    renderPlan();
    status('Remixed: ' + fmt(plan.total) + ' with ' + plan.cuts.length + ' cuts. Seed ' + plan.seedHex + '.');
    return plan;
  }
  RM.remixNow = remix;
  RM.reshuffleNow = function () { readControls(); RM.reshuffle(); $('rm-seed').value = S.hex(RM.state.seed); renderPlan(); status('Reshuffled: new seed ' + S.hex(RM.state.seed)); return RM.state.plan; };

  // The bin and the stage take files through SlopDrop (shared/drop): it checks the types, shows each file's progress,
  // and calls RM.addFiles (the same path as before) one file at a time.
  const DROP_RULES = { types: ['image/*', 'video/*'], exts: [], noun: 'a picture or video' };
  let missingBefore = 0;
  function wireDrop() {
    SlopDrop.attach($('rm-drop'), {
      accept: DROP_RULES,
      input: $('rm-file'),
      targets: [$('rm-bin'), $('rm-stage')],
      begin: () => { missingBefore = RM.state.items.filter((x) => x.missing).length; },
      process: async (file) => {
        if (!(await RM.addFiles([file]))) throw new Error('could not be decoded as a picture or video');
        return RM.state.items.slice().reverse().find((x) => x.name === file.name).id;
      },
      done: (sum) => {
        const filled = missingBefore - RM.state.items.filter((x) => x.missing).length;
        renderBin();
        if (filled > 0) { remix(); status('Filled ' + filled + ' missing clip' + (filled > 1 ? 's' : '') + ' and planned the edit again.'); }
        else if (sum.added.length) status('Added ' + sum.added.length + ' file' + (sum.added.length > 1 ? 's' : '') + '. Press Remix to make the edit.');
      },
      reveal: (sum) => document.querySelector('#rm-bin li[data-id="' + sum.added[sum.added.length - 1].value + '"]'),
    });
  }
  /** After a config import: the controls show the state, and the bin, the plan and the lane are drawn again. */
  RM.syncUI = function () {
    const st = RM.state;
    $('rm-target').value = String(st.target);
    $('rm-pace').value = st.pace; $('rm-preset').value = st.preset; $('rm-fill').value = st.fill;
    $('rm-timing').value = st.timing; $('rm-vtiming').value = st.video;
    $('rm-lmin').value = String(st.min); $('rm-lmax').value = String(st.max); $('rm-stagger').value = String(st.stagger);
    $('rm-audio').value = st.audioMode; renderTracks();
    $('rm-cw').value = String(st.custom.w); $('rm-ch').value = String(st.custom.h);
    $('rm-base').value = st.base; $('rm-random').checked = st.random; gridBoxes();
    $('rm-seed').value = S.hex(st.seed);
    if (RM.lane) RM.lane.update({ switches: st.lane });
    renderBin(); renderPlan();
  };
  function gridBoxes() {
    const wrap = $('rm-grids');
    wrap.replaceChildren(...RM.GRIDS.map((g) => {
      const l = document.createElement('label');
      l.className = 'rm-chk';
      const cb = Object.assign(document.createElement('input'), { type: 'checkbox', id: 'rm-g-' + g, checked: true });
      cb.addEventListener('change', readControls);
      l.append(cb, ' ' + SV.templates.get(g).name + ' (' + SV.templates.get(g).slots.length + ' cells)');
      return l;
    }));
  }
  /** The audio track choices: random (seeded), each bin video's sound, and the picked music file. */
  function renderTracks() {
    const st = RM.state, list = [['random', "Random: a bin video's sound (seeded)"]]
      .concat(st.items.filter((m) => m.kind === 'video').map((m) => [m.id, m.name]))
      .concat(st.music ? [['file', 'Picked file: ' + st.music.name]] : []);
    fill($('rm-track'), list, st.audioTrack);
    $('rm-music-name').textContent = st.music ? st.music.name : '';
  }
  /** Lock toggles for the slots of the cut at the playhead, under the preview. */
  let slotsCut = -2, keysCut = -2;
  function renderSlots() {
    const st = RM.state, plan = st.plan, t = RM.preview.t;
    let ci = -1;
    if (plan) plan.cuts.forEach((beat, i) => { if (beat.length && t >= beat[0].start && t < beat[0].start + beat[0].dur + 1e-6) ci = i; });
    if (ci === slotsCut) return;
    slotsCut = ci;
    const row = $('rm-slots');
    if (ci < 0) { row.replaceChildren(); return; }
    const head = Object.assign(document.createElement('span'), { className: 'rm-size', textContent: 'Cut ' + (ci + 1) + ' slots:' });
    row.replaceChildren(head, ...plan.cuts[ci].map((x) => {
      const on = SV.locks.has(st.locks, ci, x.slot);
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'rm-btn rm-slotlock' + (on ? ' on' : ''); b.innerHTML = LOCK_SVG + ' Slot ' + (x.slot + 1);
      b.setAttribute('aria-pressed', String(on)); b.title = (on ? 'Unlock' : 'Lock') + ' slot ' + (x.slot + 1) + ' of cut ' + (ci + 1);
      b.onclick = () => { RM.toggleLock(ci, x.slot); slotsCut = -2; renderSlots(); renderPlan(); status((on ? 'Unlocked' : 'Locked') + ' slot ' + (x.slot + 1) + ' of cut ' + (ci + 1) + '.'); };
      return b;
    }));
  }
  function init() {
    const st = RM.state;
    $('rm-target').value = String(st.target);
    fill($('rm-pace'), SV.random.PACES, st.pace);
    fill($('rm-preset'), SV.presets.choices(), st.preset);
    fill($('rm-fill'), FILL_LABELS, st.fill);
    fill($('rm-timing'), SV.timing.MODES, st.timing);
    fill($('rm-vtiming'), SV.timing.VIDEO, st.video);
    $('rm-lmin').value = String(st.min); $('rm-lmax').value = String(st.max); $('rm-stagger').value = String(st.stagger);
    fill($('rm-audio'), SV.audio.MODES, st.audioMode);
    renderTracks();
    $('rm-cw').value = String(st.custom.w); $('rm-ch').value = String(st.custom.h);
    fill($('rm-base'), [['none', 'None: one clip after another'], ['random', 'Random grid from the list']].concat(SV.templates.list.map((t) => [t.id, t.name])).concat(RM.GRIDS.map((g) => [g, SV.templates.get(g).name])), st.base);
    $('rm-random').checked = st.random;
    gridBoxes();
    $('rm-seed').value = S.hex(st.seed);
    RM.preview.attach($('rm-canvas'));
    RM.lane = SV.laneView.mount($('rm-lanehost'), {
      label: 'Layout lane',
      onCommit: (list) => {
        st.lane = list; RM.lane.update({ switches: list }); renderPlan();
        status(st.random ? 'Random is on, so Remix draws new switches over the lane. Turn Random off to keep these.' : 'Layout switches changed: press Remix to re-plan with them.');
      },
      onSeek: scrubTo, onScrub: scrubTo
    });
    RM.preview.onTick = syncTime;
    readControls();
    renderBin();
    renderPlan();
    wire();
    RM.say = status; RM.renderPlan = renderPlan;
    RM.panel.init();
    RM.ready = true;
  }
  /** Move the playhead to t and paint that frame (scrubbing; works while paused). */
  function scrubTo(t) { RM.preview.pause(); RM.state.playhead = t; RM.preview.seek(t); syncTime(); }
  function syncTime() {
    const t = RM.preview.t;
    renderSlots();
    const kc = RM.keys.cutAt(t);
    if (kc !== keysCut) { keysCut = kc; RM.panel.renderKeys(); }
    $('rm-scrub').value = String(t);
    $('rm-time').textContent = fmt(t) + ' / ' + fmt(RM.preview.total());
    $('rm-play').textContent = RM.preview.playing ? 'Pause' : 'Play';
    RM.state.playhead = t;
    if (RM.lane) RM.lane.update({ playhead: t });
  }
  function wire() {
    ['rm-timing', 'rm-vtiming', 'rm-lmin', 'rm-lmax', 'rm-stagger'].forEach((id) => $(id).addEventListener('change', () => { readControls(); status('Timing: press Remix to plan the new timing.'); }));
    const audioChanged = () => { readControls(); renderTracks(); const p = RM.state.plan; if (p) p.audio = SV.audio.choose({ mode: RM.state.audioMode, track: RM.state.audioTrack }, p.seed, RM.media()); status('Audio: ' + $('rm-audio').options[$('rm-audio').selectedIndex].text + '.'); };
    $('rm-audio').addEventListener('change', audioChanged);
    $('rm-track').addEventListener('change', audioChanged);
    $('rm-music').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; RM.setMusic(f); $('rm-audio').value = 'music'; readControls(); renderTracks(); audioChanged(); status('Music: ' + f.name + '.'); });
    $('rm-fill').addEventListener('change', () => { readControls(); if (RM.state.plan) { RM.state.plan.fill = RM.state.fill; renderPlan(); } status('Fill: ' + $('rm-fill').options[$('rm-fill').selectedIndex].text + '.'); });
    const ctl = ['rm-target', 'rm-pace', 'rm-preset', 'rm-cw', 'rm-ch', 'rm-base', 'rm-random', 'rm-seed'];
    ctl.forEach((id) => $(id).addEventListener('change', () => { readControls(); if (id === 'rm-preset' || id === 'rm-cw' || id === 'rm-ch') status('Frame size ' + RM.size().w + '×' + RM.size().h + ': press Remix to plan for it.'); }));
    $('rm-seed').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); remix(false); } });
    $('rm-remix').addEventListener('click', () => remix(false));
    $('rm-reshuffle').addEventListener('click', () => RM.reshuffleNow());
    $('rm-play').addEventListener('click', () => (RM.preview.playing ? RM.preview.pause() : RM.preview.play()));
    $('rm-export').addEventListener('click', () => RM.exporter.run({ say: status }));
    $('rm-scrub').addEventListener('input', (e) => scrubTo(+e.target.value));
    wireDrop();
    RM.dnd.install({
      stage: $('rm-stage'), say: status,
      redraw: () => { renderPlan(); renderBin(); }
    });
    const send = () => RM.sendToSlopCut && RM.sendToSlopCut();
    $('rm-send').addEventListener('click', send);
    $('rm-send-stage').addEventListener('click', send);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
