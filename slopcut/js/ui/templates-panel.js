/* SlopCut: the Templates tab of the bin. The layout picker (labels are columns × rows: 3×1 is three columns, 1×3 three
   rows), the slots of the current layout (drag a bin item or a clip into a slot, drag a slot onto another to swap, drag a
   slot onto the clip list to clear it, or use the selects), the layout lane and the clips on the timeline as chips.
   Renders into the bin's list element. */
(function () {
  'use strict';
  const SE = window.SE, U = SE.util, M = SE.model, T = SE.templates, L = SE.layout, h = U.h, SV = window.SlopVideo, G = SV.grid;
  const P = SE.tplPanel = {};
  const MIME_SLOT = 'application/x-slopedit-slot', MIME_CLIP = 'application/x-slopedit-clip', MIME_MEDIA = 'application/x-slopedit-media', MIME_FX = 'application/x-slopedit-fx';
  const dragHas = (e, type) => !!e.dataTransfer && [...(e.dataTransfer.types || [])].includes(type);
  /** The picker, in order: [template id, label (columns × rows), description]. Grids are made on demand (grid.js). */
  P.PICK = [
    ['split-v', '1×2', 'Two rows'], ['split-h', '2×1', 'Two columns'], ['three-up', '3×1', 'Three columns'], ['grid-3x1', '1×3', 'Three rows'],
    ['grid2', '2×2', 'Four cells'], ['grid3', '3×3', 'Nine cells'], ['pip', 'PIP', 'Picture-in-picture'], ['title-two', 'Title + 2', 'Title band over two clips'],
    ['single', '1×1', 'One full frame'], ['reel', '9:16', 'Vertical reel, two stacked']
  ];

  /** A miniature of a template, drawn from its region data. */
  function thumb(tpl) {
    const box = h('div', { class: 'tp-thumb' + (tpl.aspect ? ' portrait' : ''), 'aria-hidden': 'true' });
    tpl.slots.forEach((r, i) => box.append(h('span', { class: 'tp-reg', style: { left: r.x * 100 + '%', top: r.y * 100 + '%', width: r.w * 100 + '%', height: r.h * 100 + '%' } }, String(i + 1))));
    return box;
  }
  function tile(id, label, desc) {
    const tpl = T.get(id);
    if (!tpl) return null;
    const cur = !!SE.doc.layout && SE.doc.layout.tpl === tpl.id;
    return h('button', { type: 'button', class: 'tp-tile' + (cur ? ' on' : ''), 'aria-pressed': cur ? 'true' : 'false', title: label + ' · ' + desc, onclick: () => SE.act.applyTemplate(tpl.id) },
      thumb(tpl), h('b', null, label), h('small', null, desc));
  }
  /** Custom grid…: columns and rows (1 to 4 each), applied like a template (equal cells). */
  function customTile() {
    return h('button', { type: 'button', class: 'tp-tile tp-custom', title: 'Custom grid: choose columns and rows', onclick: () => customDialog() },
      h('span', { class: 'tp-thumb tp-cgrid', 'aria-hidden': 'true' }, '+'), h('b', null, 'Custom…'), h('small', null, 'Columns and rows'));
  }
  function customDialog() {
    const cols = SlopUI.number(3, 1, G.MAX, 1), rows = SlopUI.number(2, 1, G.MAX, 1);
    const sum = h('p', { class: 'sui-p', role: 'status' });
    const upd = () => { sum.textContent = cols.value * rows.value + ' equal cells: ' + cols.value + ' column' + (cols.value > 1 ? 's' : '') + ' × ' + rows.value + ' row' + (rows.value > 1 ? 's' : '') + '. Each cell takes a track.'; };
    cols.addEventListener('input', upd); rows.addEventListener('input', upd); upd();
    SlopUI.dialog({
      title: 'Custom grid', cls: 'sui-narrow',
      body: h('div', null, SlopUI.field('Columns', cols), SlopUI.field('Rows', rows), sum),
      buttons: [{ label: 'Cancel' }, { label: 'Apply', primary: true, act: () => { SE.act.applyTemplate(G.id(+rows.value, +cols.value)); } }]
    });
  }
  const clipLabel = (c) => M.label(SE.doc, c) + ' · ' + U.dur(c.start);
  /** Visual clips on the timeline, in time order (the choices for a slot). */
  const visual = () => SE.doc.clips.filter((c) => c.kind !== 'audio').sort((a, b) => a.start - b.start);

  function slotCard(i) {
    const lay = SE.doc.layout, id = lay.slots[i], c = id && M.clip(SE.doc, id);
    const card = h('div', { class: 'tp-slot' + (c ? '' : ' empty') + (i === 0 ? ' main' : ''), dataset: { slot: String(i) }, draggable: c ? 'true' : 'false', title: 'Slot ' + (i + 1) + (c ? ': ' + clipLabel(c) : ': empty. Drop a bin item or a clip here') },
      h('span', { class: 'tp-num' }, String(i + 1)),
      h('span', { class: 'tp-name' }, c ? M.label(SE.doc, c) : 'Empty'));
    card.addEventListener('dragstart', (e) => { if (!c) return; e.dataTransfer.setData(MIME_SLOT, String(i)); e.dataTransfer.effectAllowed = 'move'; });
    card.addEventListener('dragover', (e) => { if (dragHas(e, MIME_SLOT) || dragHas(e, MIME_CLIP) || dragHas(e, MIME_MEDIA) || dragHas(e, MIME_FX)) { e.preventDefault(); card.classList.add('over'); } });
    card.addEventListener('dragleave', () => card.classList.remove('over'));
    card.addEventListener('drop', (e) => { // intake-ok: slots, clips, bin items and effects dragged inside the app, not files
      e.preventDefault(); card.classList.remove('over');
      const from = e.dataTransfer.getData(MIME_SLOT), clip = e.dataTransfer.getData(MIME_CLIP), media = e.dataTransfer.getData(MIME_MEDIA), fx = e.dataTransfer.getData(MIME_FX);
      if (from !== '') SE.change('Swap slots', (p) => L.swap(p, i, +from));
      else if (clip) SE.change('Put clip in slot', (p) => L.put(p, i, clip));
      else if (media && SE.media.ready(media)) SE.change('Put media in slot', (p) => L.placeMedia(p, i, M.media(p, media)));
      else if (fx) addTitleTo(i, fx);
    });
    return card;
  }
  /** A title preset dropped from the Effects tab becomes a title clip in the slot (the title band of Title + 2). */
  function addTitleTo(i, raw) {
    let fx = null;
    try { fx = JSON.parse(raw); } catch (e) { return; }
    if (!fx || fx.kind !== 'title') return;
    SE.change('Title in slot', (p) => {
      const lay = p.layout;
      if (!lay) return false;
      const id = SE.edit.addGenerated(p, 'title', L.ensureTrack(p, 'video', 0).id, lay.start, lay.dur, JSON.parse(JSON.stringify(fx.preset || {})));
      L.put(p, i, id);
    });
  }
  /** Per-slot controls: choose a clip, free the slot, or swap with another slot (keyboard friendly). */
  function slotControls(i) {
    const lay = SE.doc.layout, n = lay.slots.length;
    const choose = h('select', { class: 'inp tp-sel', 'aria-label': 'Clip for slot ' + (i + 1), onchange: (e) => { const v = e.target.value; if (v) SE.change('Put clip in slot', (p) => L.put(p, i, v)); } },
      h('option', { value: '' }, '— choose a clip —'),
      visual().map((c) => h('option', { value: c.id, selected: lay.slots[i] === c.id }, clipLabel(c))));
    const swap = h('select', { class: 'inp tp-sel', 'aria-label': 'Swap slot ' + (i + 1) + ' with', onchange: (e) => { const v = +e.target.value; if (e.target.value !== '') SE.change('Swap slots', (p) => L.swap(p, i, v)); } },
      h('option', { value: '' }, 'Swap with…'),
      [...Array(n).keys()].filter((k) => k !== i).map((k) => h('option', { value: String(k) }, 'Slot ' + (k + 1))));
    const free = h('button', { type: 'button', class: 'btn sm', disabled: !lay.slots[i], title: 'Empty this slot (the clip stays)', onclick: () => SE.change('Free slot', (p) => L.free(p, i)) }, 'Free');
    return h('div', { class: 'tp-ctl' }, choose, swap, free);
  }
  /** Dropping a slot on the clip list empties it (the clip stays on the timeline). */
  function clearZone(el) {
    el.addEventListener('dragover', (e) => { if (dragHas(e, MIME_SLOT)) { e.preventDefault(); el.classList.add('over'); } });
    el.addEventListener('dragleave', () => el.classList.remove('over'));
    el.addEventListener('drop', (e) => { // intake-ok: a slot dragged onto the clip list
      const from = e.dataTransfer.getData(MIME_SLOT);
      el.classList.remove('over');
      if (from === '') return;
      e.preventDefault();
      SE.change('Clear slot', (p) => L.free(p, +from));
    });
    return el;
  }
  function chip(c) {
    const b = h('button', { type: 'button', class: 'tp-chip', draggable: 'true', title: clipLabel(c) + ' (drag into a slot)', dataset: { clip: c.id }, onclick: () => SE.app.select([c.id]) },
      SE.icon(c.kind === 'image' ? 'image' : c.kind === 'title' ? 'text' : c.kind === 'graphic' ? 'sparkle' : 'film'), h('span', null, M.label(SE.doc, c)));
    b.addEventListener('dragstart', (e) => { e.dataTransfer.setData(MIME_CLIP, c.id); e.dataTransfer.effectAllowed = 'move'; });
    return b;
  }

  P.render = function (list) {
    const p = SE.doc, lay = p.layout, tpl = lay && T.get(lay.tpl);
    const kids = [
      h('h4', { class: 'fx-h' }, 'Layouts'),
      h('p', { class: 'tp-note' }, lay ? 'Choose another layout to re-flow this one. The clips stay.' : 'Choose a layout: each slot gets its own track on the timeline and a cell in the monitor. Then drag bin items into the cells.'),
      h('div', { class: 'tp-grid' }, P.PICK.map(([id, label, desc]) => tile(id, label, desc)), customTile())
    ];
    if (tpl) {
      kids.push(h('h4', { class: 'fx-h' }, 'Slots · ' + tpl.name));
      kids.push(h('p', { class: 'tp-note' }, 'Drag a bin item, a clip or a title from the Effects tab into a slot (or a bin item onto its monitor cell). Drag a slot onto another to swap, or onto the clip list to clear it.'));
      kids.push(h('div', { class: 'tp-slots' + (tpl.aspect ? ' portrait' : '') }, tpl.slots.map((_, i) => slotCard(i))));
      kids.push(h('div', { class: 'tp-slotctl' }, tpl.slots.map((_, i) => h('div', { class: 'tp-row' }, h('span', { class: 'tp-lbl' }, 'Slot ' + (i + 1)), slotControls(i)))));
      kids.push(h('div', { class: 'tp-actions' }, h('button', { type: 'button', class: 'btn sm', onclick: () => SE.act.clearLayout() }, 'Clear layout (keeps clips)')));
    }
    kids.push(h('h4', { class: 'fx-h' }, 'Layout lane'));
    kids.push(SE.laneUI.element());
    const vis = visual();
    kids.push(h('h4', { class: 'fx-h' }, 'Clips on the timeline'));
    kids.push(clearZone(vis.length ? h('div', { class: 'tp-chips tp-drop' }, vis.map(chip)) : h('div', { class: 'tp-drop' }, h('p', { class: 'tp-note' }, 'No video, image or title clips yet.'))));
    if (p.random) {
      const r = p.random;
      kids.push(h('h4', { class: 'fx-h' }, 'Last random edit'));
      kids.push(h('p', { class: 'tp-note' }, 'Seed ' + r.seedHex + ' · ' + r.cuts + ' cuts · ' + r.total.toFixed(1) + ' s · ' + r.pace + ' · ' + r.aspect + (r.tpl ? ' · ' + (T.get(r.tpl) || {}).name : '')));
      kids.push(h('div', { class: 'tp-actions' },
        h('button', { type: 'button', class: 'btn sm', onclick: () => SE.act.reshuffleRandom() }, 'Reshuffle (new seed)'),
        h('button', { type: 'button', class: 'btn sm', onclick: () => SE.act.randomDialog() }, 'Random edit…')));
    }
    list.replaceChildren(h('div', { class: 'tp-panel' }, kids));
  };
})();
