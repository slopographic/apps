/* SlopEdit: track headers (name, eye/mute/solo/lock) and the timeline toolbar
   (tools, snapping, split, marker, title, zoom). */
(function () {
  'use strict';
  const SE = window.SE, U = SE.util, M = SE.model, TL = SE.timeline, C = SE.cmd;
  const h = U.h;
  let heads, inner, tcEl, bar;

  function tog(icon, on, title, fn, cls) {
    return h('button', { type: 'button', class: 'th-b' + (on ? ' on' : '') + (cls ? ' ' + cls : ''), title, 'aria-label': title, 'aria-pressed': on ? 'true' : 'false', onclick: fn }, typeof icon === 'string' && icon.length <= 2 ? icon : SE.icon(icon));
  }
  function setTrack(id, patch, label) { SE.change(label, (p) => { Object.assign(M.track(p, id), patch); }); }
  async function rename(t) {
    const v = await SlopUI.prompt('Rename track', 'Name', t.name);
    if (v && v.trim()) setTrack(t.id, { name: v.trim().slice(0, 24) }, 'Rename track');
  }
  function trackMenu(t, x, y) {
    const p = SE.doc, used = p.clips.some((c) => c.track === t.id), last = p.tracks.filter((x2) => x2.kind === t.kind).length <= 1;
    SlopUI.menu([
      { label: 'Rename…', act: () => rename(t) },
      { label: 'Add ' + t.kind + ' track', act: () => SE.act.addTrack(t.kind) },
      { label: 'Delete track', disabled: last, act: async () => {
        if (used && !(await SlopUI.confirm('Delete track', 'Delete ' + t.name + ' and its clips?', 'Delete', { danger: true }))) return;
        SE.change('Delete track', (d) => { d.clips = d.clips.filter((c) => c.track !== t.id); d.tracks = d.tracks.filter((x2) => x2.id !== t.id); });
      } }
    ], x, y);
  }
  TL.renderHeads = function () {
    if (!inner) return;
    inner.replaceChildren();
    for (const r of TL.rows()) {
      const t = r.track, v = t.kind === 'video';
      const row = h('div', { class: 'th ' + t.kind + (t.lock ? ' locked' : ''), style: { height: r.h + 'px' }, dataset: { id: t.id } },
        h('span', { class: 'th-name', title: 'Double-click to rename' }, t.name),
        h('div', { class: 'th-tools' },
          v ? tog(t.hide ? 'eyeoff' : 'eye', t.hide, t.hide ? 'Show track' : 'Hide track', () => setTrack(t.id, { hide: !t.hide }, t.hide ? 'Show track' : 'Hide track'), 'eye') : null,
          !v ? tog('M', t.mute, 'Mute track', () => setTrack(t.id, { mute: !t.mute }, 'Mute'), 'mute') : null,
          !v ? tog('S', t.solo, 'Solo track', () => setTrack(t.id, { solo: !t.solo }, 'Solo'), 'solo') : null,
          tog(t.lock ? 'lock' : 'unlock', t.lock, t.lock ? 'Unlock track' : 'Lock track', () => setTrack(t.id, { lock: !t.lock }, t.lock ? 'Unlock track' : 'Lock track'), 'lock')));
      row.querySelector('.th-name').addEventListener('dblclick', () => rename(t));
      row.addEventListener('contextmenu', (e) => { e.preventDefault(); trackMenu(t, e.clientX, e.clientY); });
      inner.append(row);
    }
    inner.append(h('div', { class: 'th-add' },
      h('button', { type: 'button', class: 'btn sm', onclick: () => SE.act.addTrack('video') }, '+ Video'),
      h('button', { type: 'button', class: 'btn sm', onclick: () => SE.act.addTrack('audio') }, '+ Audio')));
    TL.syncHeads();
  };
  TL.syncHeads = function () { if (inner) inner.style.transform = 'translateY(' + (-TL.scrollY) + 'px)'; };

  /* ------------------------------------------------------------ toolbar */
  function toolBtn(id, icon, label) {
    const b = h('button', { type: 'button', class: 'tb tl-tool', dataset: { cmd: id }, 'aria-label': label, onclick: () => C.run(id) }, SE.icon(icon));
    return b;
  }
  function syncBar() {
    U.$$('[data-cmd]', bar).forEach((b) => {
      const c = C.get(b.dataset.cmd); if (!c) return;
      const on = c.checked ? c.checked() : false;
      b.classList.toggle('on', !!on);
      if (c.checked) b.setAttribute('aria-pressed', on ? 'true' : 'false');
      const k = C.keyFor(c.id); b.title = c.title + (k ? ' (' + k + ')' : '');
    });
    const z = bar.querySelector('.tl-zoom'); if (z) z.value = String(Math.log(TL.pps));
  }
  function buildBar() {
    bar = SE.app.els.tlBar;
    const zoom = h('input', { type: 'range', class: 'tl-zoom', min: String(Math.log(2)), max: String(Math.log(2400)), step: '0.01', 'aria-label': 'Timeline zoom', oninput: (e) => TL.setZoom(Math.exp(+e.target.value)) });
    bar.append(
      toolBtn('tool.select', 'select', 'Selection tool'), toolBtn('tool.razor', 'cut', 'Razor tool'), toolBtn('tool.ripple', 'ripple', 'Ripple edit tool'),
      h('span', { class: 'tb-sep' }),
      toolBtn('tool.snap', 'magnet', 'Snapping'),
      toolBtn('edit.split', 'split', 'Split at playhead'),
      toolBtn('tl.marker', 'marker', 'Add marker'),
      toolBtn('tl.title', 'text', 'Add title'),
      toolBtn('edit.delete', 'trash', 'Delete'),
      h('span', { class: 'tb-flex' }),
      toolBtn('tl.zoomOut', 'zoomout', 'Zoom out'), zoom, toolBtn('tl.zoomIn', 'zoomin', 'Zoom in'), toolBtn('tl.fit', 'fit', 'Zoom to fit'));
    SE.on('tool', syncBar); SE.on('zoom', syncBar); SE.on('keys', syncBar); SE.on('change', syncBar);
    syncBar();
  }
  TL.initHeads = function () {
    heads = SE.app.els.tlHeads;
    tcEl = h('button', { type: 'button', class: 'tl-tc', title: 'Current time. Click to type a time.', onclick: () => SE.transport && SE.transport.gotoDialog() }, '00:00:00:00');
    const corner = h('div', { class: 'th-corner', style: { height: TL.top() + 'px' } }, tcEl);
    inner = h('div', { class: 'th-inner' });
    heads.append(corner, h('div', { class: 'th-clip' }, inner));
    SE.on('time', () => { tcEl.textContent = U.timecode(SE.player.time, SE.doc.fps); });
    buildBar();
    TL.renderHeads();
  };
})();
