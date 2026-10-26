/* SlopIsolate — the image queue (#queue): a header (Select all / none and "4 selected"), one tile per image (its result
 * once finished (render/thumbs.js), status badge, active ring, a checkbox to select it, remove button) and an add tile.
 * Tiles are kept per image and updated in place, so progress ticks only touch a badge.
 * Selecting (ui/bulk.js): the checkbox (shown on hover, always on a touch screen or once something is selected),
 * Ctrl/Cmd-click, Shift-click; on a touch screen a long press starts selecting and then a tap adds or removes. A plain
 * click opens the image; on a selected one it keeps the selection, so the pictures being edited can be looked through. */
(function () {
  'use strict';
  const CO = window.CO, U = CO.util, S = CO.state, h = U.h;
  const Q = CO.queue = {};
  const tiles = new Map();
  const LONG = 500;
  let root = null, addBtn = null, head = null, quiet = 0; // quiet: a long press just selected, ignore its click and menu
  let held = null;   // a tile's long press still to come (a finger down on it): selects at once

  /** What a working image is doing (the engine's progress phases). */
  const PHASE = { runtime: 'Loading', model: 'Loading', init: 'Starting', infer: 'Cutting out', refine: 'Edges' };
  const badgeText = (it) => {
    if (it.status === 'working') return it.progress != null ? Math.round(it.progress * 100) + '%' : PHASE[it.phase] || 'Working…';
    if (it.status === 'queued') return 'Queued';
    if (it.status === 'error') return 'Error';
    return '';
  };

  /** Style one tile from its image. */
  function update(t, it) {
    const on = S.activeId === it.id, sel = S.sel.has(it.id);
    if (t.img.getAttribute('src') !== it.url) t.img.src = it.url || '';
    const res = CO.thumbs && CO.thumbs.of(it);
    if (res && t.res !== res) { if (t.res) t.res.remove(); t.res = res; t.img.after(res); }
    t.btn.dataset.status = it.status;
    t.btn.classList.toggle('on', on);
    t.btn.classList.toggle('sel', sel);
    t.btn.setAttribute('aria-current', on ? 'true' : 'false');
    t.chk.setAttribute('aria-checked', String(sel));
    t.chk.title = sel ? 'Unselect' : 'Select';
    t.btn.title = it.error ? it.name + ' — ' + it.error : it.name;
    t.badge.textContent = badgeText(it);
  }

  function make(id) {
    const img = h('img', { alt: '', draggable: 'false' });
    const badge = h('span', { class: 'q-badge' });
    // The remove and select controls are spans: they sit inside the tile button, so they cannot be nested controls.
    const x = h('span', { class: 'q-x', role: 'button', 'aria-label': 'Remove image', title: 'Remove' });
    x.innerHTML = U.icon('x');
    x.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      const it = S.get(id);
      if (it) CO.process.remove(it);
    });
    const chk = h('span', { class: 'q-chk', role: 'checkbox', 'aria-checked': 'false', 'aria-label': 'Select picture' });
    chk.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); CO.bulk.toggle(id); });
    const btn = h('button', { type: 'button', class: 'q-item' }, img, badge, chk, x);
    btn.dataset.id = String(id);
    let timer = null, start = null, touch = false, fired = false;
    btn.addEventListener('pointerdown', (e) => {
      touch = e.pointerType !== 'mouse';
      if (!touch || e.target === chk) return;
      start = { x: e.clientX, y: e.clientY };
      clearTimeout(timer);
      fired = false;
      const fire = () => { clearTimeout(timer); timer = null; held = null; fired = true; quiet = Date.now(); if (!S.sel.has(id)) CO.bulk.toggle(id); if (navigator.vibrate) try { navigator.vibrate(15); } catch (err) { /* not allowed */ } };
      timer = setTimeout(fire, LONG);
      held = fire;   // the touch layer's own long press (a contextmenu) may come first: it selects then (Q.init)
    });
    const stop = () => { clearTimeout(timer); timer = null; held = null; };
    btn.addEventListener('pointermove', (e) => { if (timer && start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) stop(); });
    btn.addEventListener('pointerup', stop);
    btn.addEventListener('pointercancel', stop);
    btn.addEventListener('click', (e) => {
      const it = S.get(id);
      if (!it) return;
      if (fired) { fired = false; return; } // the click that ends a long press
      if (e.shiftKey && S.anchor) CO.bulk.range(S.anchor, it.id); // Shift: range from the anchor
      else if (e.ctrlKey || e.metaKey) CO.bulk.toggle(it.id, { seed: true }); // Ctrl/Cmd: add or remove one
      else if (touch && S.sel.size) CO.bulk.toggle(it.id); // touch, while selecting: a tap adds or removes
      else if (S.bulk() && S.sel.has(it.id)) { Q.open(it); S.anchor = it.id; } // look through the selection
      else { CO.bulk.clear(); Q.open(it); S.anchor = it.id; }
    });
    return { btn, img, badge, chk, res: null };
  }

  /** The header: Select all / Select none and how many are selected. */
  function makeHead() {
    const all = h('button', { type: 'button', class: 'q-all', id: 'qSelAll' }, 'Select all');
    all.addEventListener('click', () => CO.bulk.toggleAll());
    const n = h('span', { class: 'q-n', 'aria-live': 'polite' });
    head = h('div', { class: 'q-head' }, all, n);
    head.sync = () => {
      const count = S.sel.size, every = S.items.length > 0 && S.items.every((it) => S.sel.has(it.id));
      all.textContent = every ? 'Select none' : 'Select all';
      n.textContent = count ? count + ' selected' : '';
      head.hidden = S.items.length < 2 && !count;
      root.classList.toggle('selecting', count > 0);
    };
    return head;
  }

  function render() {
    if (!root) return;
    const want = new Set(S.items.map((it) => it.id));
    for (const [id, t] of tiles) if (!want.has(id)) { t.btn.remove(); tiles.delete(id); }
    const nodes = S.items.map((it) => {
      let t = tiles.get(it.id);
      if (!t) { t = make(it.id); tiles.set(it.id, t); }
      update(t, it);
      return t.btn;
    });
    head.sync();
    root.replaceChildren(head, ...nodes, addBtn);
  }

  /** Makes one image the active one (the click on a tile and the queue's context menu both use this). */
  Q.open = function (it) {
    S.activeId = it.id;
    CO.emit('activeItem', it);
    CO.process.select(it);
  };

  Q.init = function () {
    root = U.$('#queue');
    if (!root) return;
    makeHead();
    addBtn = h('button', { type: 'button', class: 'q-add', 'aria-label': 'Add images', title: 'Add images' });
    addBtn.innerHTML = U.icon('plus');
    addBtn.addEventListener('click', () => CO.files.open());
    // A long press on a touch screen selects; the menu the browser opens for it is not wanted then.
    root.addEventListener('contextmenu', (e) => { if (held) held(); if (Date.now() - quiet < 1200) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
    // Files dropped on the sidebar are taken by the drop zone (CO.files.init lists #queue as one of its targets).
    CO.on('list', render);
    CO.on('activeItem', render);
    const one = (it) => { const t = tiles.get(it.id); if (t) update(t, it); else render(); };
    CO.on('item', one);
    CO.on('thumb', one);
    CO.on('sel', render);
    CO.on('progress', ({ it }) => { const t = tiles.get(it.id); if (t) update(t, it); });
    render();
  };
})();
