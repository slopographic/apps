/* Slop Slides: the animation sections of the inspector. Slide: the transition (effect, duration in seconds, and Apply to
   all slides). Present: the "Play animations" switch (session only, not saved). Object: its animations in order, each with
   preset, trigger, delay and duration, with move up, move down and delete. Every edit is one undo step; the animations
   are looked up by id on each edit, so an undo that replaces the deck cannot leave a stale reference. Exposes SS.animPanel. */
(function () {
  'use strict';
  var SS = window.SS, A = SS.app, D = SS.dom, AN = SS.anim;
  var AP = SS.animPanel = {};
  if (window.SlopPresets) window.SlopPresets.useDrive().catch(function () {});
  var clamp = function (v, lo, hi, dflt) { v = parseFloat(v); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : dflt; };
  var round1 = function (v) { return Math.round(v * 10) / 10; };

  function section(title, kids) { return D.el('section', { class: 'grp' }, D.el('h2', { text: title }), kids); }
  function row(label, control) { return D.el('label', { class: 'row' }, D.el('span', { text: label }), control); }
  function numberInput(label, value, min, max, step) {
    return D.el('input', { type: 'number', min: min, max: max, step: step, value: value, 'aria-label': label });
  }

  /* ---------- slide transition ---------- */
  function setTransition(name, dur, all) {
    var t = { name: name, duration: AN.clampDuration(dur) };
    A.change(all ? 'Transition for all slides' : 'Transition', function () {
      (all ? A.deck.slides : [A.slide()]).forEach(function (s) { s.transition = { name: t.name, duration: t.duration }; });
    }, all ? undefined : 'tr:' + A.idx);
    A.emit('select');
  }
  AP.transitionSection = function (s) {
    var t = AN.transitionOf(s);
    var sel = D.el('select', { 'aria-label': 'Transition' }, AN.transitionNames().map(function (n) {
      return D.option(n, AN.transitionLabel(n), t.name);
    }));
    var dur = numberInput('Transition duration in seconds', t.duration, AN.DUR_MIN, AN.DUR_MAX, 0.1);
    var commit = function () { setTransition(sel.value, dur.value, false); };
    sel.addEventListener('change', commit);
    dur.addEventListener('change', commit);
    var all = D.el('button', { type: 'button', onclick: function () { setTransition(sel.value, dur.value, true); } }, 'Apply to all slides');
    return section('Transition', [row('Effect', sel), row('Duration (s)', dur), D.el('div', { class: 'btns' }, all)]);
  };

  /* ---------- present switch ---------- */
  AP.presentSection = function () {
    var box = D.el('input', { type: 'checkbox', 'aria-label': 'Play animations and transitions' });
    box.checked = !!SS.present.animsOn;
    box.addEventListener('change', function () { SS.present.animsOn = box.checked; });
    return section('Present', [row('Play animations', box), D.el('p', { class: 'hint', text: 'Off: every slide appears whole and each click moves on.' })]);
  };

  /* ---------- object animations ---------- */
  function live(oid, aid) {
    var s = A.slide(), o = s && s.objects.filter(function (x) { return x.id === oid; })[0];
    var a = o && (o.anims || []).filter(function (x) { return x.id === aid; })[0];
    return a ? { o: o, a: a } : null;
  }
  function edit(label, oid, aid, key, fn) {
    A.change(label, function () { var r = live(oid, aid); if (r) fn(r); }, 'anim:' + aid + ':' + key);
  }
  function structural(label, oid, fn) {
    A.change(label, function () {
      var s = A.slide(), o = s && s.objects.filter(function (x) { return x.id === oid; })[0];
      if (o) fn(o);
    });
    A.emit('select');
  }
  function move(oid, aid, d) {
    structural('Move animation', oid, function (o) {
      var list = o.anims || [], i = -1;
      list.forEach(function (a, k) { if (a.id === aid) i = k; });
      var j = i + d;
      if (i < 0 || j < 0 || j >= list.length) return;
      var item = list[i];
      list.splice(i, 1);
      list.splice(j, 0, item);
    });
  }
  /** Saves an object's first animation as a motion preset: its keys, stretched by its timing. The preset also applies in
   * Cut and Remix (same keys). Needs the shared library on the page (shared/presets). */
  function saveAsPreset(o) {
    var L = window.SlopPresets;
    if (!L) { if (window.SlopUI) SlopUI.toast('Presets are not available here'); return; }
    L.openSave({
      app: 'slides', apps: L.MOTION_APPS, kinds: ['motion'], title: 'Save animation as preset',
      build: function () {
        var a = (o.anims || [])[0], src = a && L.get(a.preset);
        return src && src.kind === 'motion' ? L.motion.scaleTime(src.params, a.timeScale) : null;
      },
    });
  }
  function animRow(oid, a, i, n) {
    var pre = D.el('select', { 'aria-label': 'Animation' }, AN.presets().map(function (p) { return D.option(p.name, p.label, a.preset); }));
    var trig = D.el('select', { 'aria-label': 'Trigger' }, AN.TRIGGERS.map(function (t) { return D.option(t[0], t[1], a.trigger); }));
    var at = numberInput('Delay in seconds', round1(a.at), 0, 60, 0.1);
    var dur = numberInput('Duration in seconds', round1(AN.duration(a)), 0.1, 30, 0.1);
    pre.addEventListener('change', function () { edit('Animation', oid, a.id, 'preset', function (r) { r.a.preset = pre.value; }); });
    trig.addEventListener('change', function () { edit('Trigger', oid, a.id, 'trigger', function (r) { r.a.trigger = trig.value === 'click' ? 'click' : 'with'; }); });
    at.addEventListener('change', function () {
      var v = clamp(at.value, 0, 60, 0);
      at.value = round1(v);
      edit('Delay', oid, a.id, 'at', function (r) { r.a.at = v; });
    });
    dur.addEventListener('change', function () {
      var v = clamp(dur.value, 0.1, 30, 1);
      dur.value = round1(v);
      edit('Duration', oid, a.id, 'dur', function (r) { r.a.timeScale = Math.max(AN.TS_MIN, Math.min(AN.TS_MAX, v / AN.presetDuration(r.a.preset))); });
    });
    var head = D.el('div', { class: 'anim-head' }, D.el('b', { text: (i + 1) + '.' }), pre,
      D.el('button', { type: 'button', 'aria-label': 'Move animation up', title: 'Move up', disabled: i === 0 ? true : null, onclick: function () { move(oid, a.id, -1); } }, '↑'),
      D.el('button', { type: 'button', 'aria-label': 'Move animation down', title: 'Move down', disabled: i === n - 1 ? true : null, onclick: function () { move(oid, a.id, 1); } }, '↓'),
      D.el('button', { type: 'button', class: 'danger', 'aria-label': 'Delete animation', title: 'Delete', onclick: function () {
        structural('Delete animation', oid, function (o) { o.anims = (o.anims || []).filter(function (x) { return x.id !== a.id; }); });
      } }, '×'));
    return D.el('div', { class: 'anim' }, head, row('Starts', trig), row('Delay (s)', at), row('Duration (s)', dur));
  }
  AP.objectSection = function (o) {
    var list = o.anims || [], kids = list.map(function (a, i) { return animRow(o.id, a, i, list.length); });
    if (!list.length) kids.push(D.el('p', { class: 'hint', text: 'No animation.' }));
    var add = D.el('select', { 'aria-label': 'Preset to add' }, AN.presets().map(function (p) { return D.option(p.name, p.label, ''); }));
    var trig = D.el('select', { 'aria-label': 'Trigger for the new animation' }, AN.TRIGGERS.map(function (t) { return D.option(t[0], t[1], 'with'); }));
    var addBtn = D.el('button', { type: 'button', onclick: function () {
      var preset = add.value, t = trig.value;
      structural('Add animation', o.id, function (x) { x.anims = (x.anims || []).concat([AN.make(preset, t)]); });
    } }, 'Add animation');
    var saveBtn = D.el('button', { type: 'button', title: 'Save this object\'s first animation, with its timing, as a preset', onclick: function () { saveAsPreset(o); } }, 'Save as preset…');
    kids.push(D.el('div', { class: 'anim-add' }, add, trig, addBtn, list.length ? saveBtn : null));
    return section('Animation', kids);
  };
})();
