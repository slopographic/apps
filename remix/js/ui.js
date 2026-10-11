/* Reel Remix: the page. Wires the bin (drop or pick clips and photos), the controls (target length, pace,
   export preset, layout, Random, seed), Remix and Reshuffle, the preview, the Layout lane and the cut list.
   Everything here is the DOM side; the plan, the state and the manifest are in core.js. */
(function () {
  'use strict';
  const RM = window.RM, SV = window.SlopVideo, $ = (id) => document.getElementById(id), S = SV.seed;
  const fmt = (s) => { const t = Math.max(0, s), m = Math.floor(t / 60), r = (t - m * 60).toFixed(1); return m + ':' + (r.length < 4 ? '0' : '') + r; };

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
      const name = document.createElement('span');
      name.className = 'rm-name'; name.textContent = it.name + ' · ' + (it.kind === 'video' ? fmt(it.dur) : 'photo');
      const rm = document.createElement('button');
      rm.type = 'button'; rm.className = 'rm-x'; rm.textContent = '×'; rm.title = 'Remove ' + it.name; rm.setAttribute('aria-label', 'Remove ' + it.name);
      rm.onclick = () => { RM.removeItem(it.id); renderBin(); status('Removed ' + it.name + '. Press Remix to plan again.'); };
      li.append(name, rm);
      return li;
    }));
    if (!st.items.length) ul.append(Object.assign(document.createElement('li'), { className: 'rm-empty', textContent: 'Drop clips and photos here, or use Add files.' }));
  }
  /** Show the plan: the cut list, the total, the lane and the scrubber range. */
  function renderPlan() {
    const st = RM.state, plan = st.plan;
    const cuts = $('rm-cuts');
    cuts.replaceChildren();
    $('rm-scrub').max = String(plan ? plan.total : 0);
    $('rm-total').textContent = plan ? 'Total ' + fmt(plan.total) + ' of ' + fmt(st.target) + ' · ' + plan.segments.length + ' layout' + (plan.segments.length > 1 ? 's' : '') + ' · seed ' + plan.seedHex : 'Nothing planned yet';
    if (plan) plan.cuts.forEach((beat, i) => {
      const li = document.createElement('li');
      li.textContent = (i + 1) + '. ' + beat.map((x) => { const m = st.items.find((q) => q.id === x.media); return (m ? m.name : '?') + ' (slot ' + (x.slot + 1) + ')'; }).join(' | ') + ' · ' + fmt(beat[0].start);
      cuts.append(li);
    });
    RM.lane.update({ duration: plan ? plan.total : st.target, switches: st.lane, layouts: RM.layoutChoices(), playhead: st.playhead });
    RM.preview.setPlan();
    RM.preview.seek(Math.min(st.playhead, plan ? plan.total : 0));
  }
  function readControls() {
    const st = RM.state;
    st.target = Math.min(600, Math.max(1, +$('rm-target').value || 30));
    st.pace = $('rm-pace').value;
    st.preset = $('rm-preset').value;
    st.custom = { w: +$('rm-cw').value || 1080, h: +$('rm-ch').value || 1920 };
    st.base = $('rm-base').value;
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

  async function addFiles(files) {
    const n = await RM.addFiles(files);
    renderBin();
    status(n ? 'Added ' + n + ' file' + (n > 1 ? 's' : '') + '. Press Remix to make the edit.' : 'Those files are not images or videos.');
  }
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
  function init() {
    const st = RM.state;
    $('rm-target').value = String(st.target);
    fill($('rm-pace'), SV.random.PACES, st.pace);
    fill($('rm-preset'), SV.presets.choices(), st.preset);
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
      onSeek: (t) => { RM.preview.pause(); RM.state.playhead = t; RM.preview.seek(t); syncTime(); }
    });
    RM.preview.onTick = syncTime;
    readControls();
    renderBin();
    renderPlan();
    wire();
    RM.ready = true;
  }
  function syncTime() {
    const t = RM.preview.t;
    $('rm-scrub').value = String(t);
    $('rm-time').textContent = fmt(t) + ' / ' + fmt(RM.preview.total());
    $('rm-play').textContent = RM.preview.playing ? 'Pause' : 'Play';
    RM.state.playhead = t;
    if (RM.lane) RM.lane.update({ playhead: t });
  }
  function wire() {
    const ctl = ['rm-target', 'rm-pace', 'rm-preset', 'rm-cw', 'rm-ch', 'rm-base', 'rm-random', 'rm-seed'];
    ctl.forEach((id) => $(id).addEventListener('change', () => { readControls(); if (id === 'rm-preset' || id === 'rm-cw' || id === 'rm-ch') status('Frame size ' + RM.size().w + '×' + RM.size().h + ': press Remix to plan for it.'); }));
    $('rm-seed').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); remix(false); } });
    $('rm-remix').addEventListener('click', () => remix(false));
    $('rm-reshuffle').addEventListener('click', () => RM.reshuffleNow());
    $('rm-play').addEventListener('click', () => (RM.preview.playing ? RM.preview.pause() : RM.preview.play()));
    $('rm-scrub').addEventListener('input', (e) => { RM.preview.pause(); RM.preview.seek(+e.target.value); syncTime(); });
    $('rm-file').addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });
    const drop = $('rm-drop');
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); addFiles(e.dataTransfer.files); });
    $('rm-send').addEventListener('click', () => RM.sendToSlopCut && RM.sendToSlopCut());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
