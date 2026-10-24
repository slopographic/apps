/* SlopIsolate — the image queue (#queue): one thumbnail per image (status badge, active ring, remove
 * button) and an add tile. Tiles are kept per image and updated in place, so progress ticks only touch a badge. */
(function () {
  'use strict';
  const CO = window.CO, U = CO.util, S = CO.state, h = U.h;
  const Q = CO.queue = {};
  const tiles = new Map();
  let root = null, addBtn = null;

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
    const on = S.activeId === it.id;
    if (t.img.getAttribute('src') !== it.url) t.img.src = it.url || '';
    t.btn.dataset.status = it.status;
    t.btn.classList.toggle('on', on);
    t.btn.classList.toggle('sel', S.sel.has(it.id));
    t.btn.setAttribute('aria-current', on ? 'true' : 'false');
    t.btn.title = it.error ? it.name + ' — ' + it.error : it.name;
    t.badge.textContent = badgeText(it);
  }

  function make(id) {
    const img = h('img', { alt: '', draggable: 'false' });
    const badge = h('span', { class: 'q-badge' });
    // The remove control is a span: it sits inside the tile button, so it cannot be a nested <button>.
    const x = h('span', { class: 'q-x', role: 'button', 'aria-label': 'Remove image', title: 'Remove' });
    x.innerHTML = U.icon('x');
    x.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      const it = S.get(id);
      if (it) CO.process.remove(it);
    });
    const btn = h('button', { type: 'button', class: 'q-item' }, img, badge, x);
    btn.dataset.id = String(id);
    btn.addEventListener('click', (e) => {
      const it = S.get(id);
      if (!it) return;
      if (e.shiftKey && S.anchor) CO.bulk.range(S.anchor, it.id); // Shift: range from the anchor
      else if (e.ctrlKey || e.metaKey) CO.bulk.toggle(it.id); // Ctrl/Cmd: add or remove one
      else { CO.bulk.clear(); Q.open(it); S.anchor = it.id; }
    });
    return { btn, img, badge };
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
    root.replaceChildren(...nodes, addBtn);
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
    addBtn = h('button', { type: 'button', class: 'q-add', 'aria-label': 'Add images', title: 'Add images' });
    addBtn.innerHTML = U.icon('plus');
    addBtn.addEventListener('click', () => CO.files.open());
    // Files dropped on the sidebar are taken by the drop zone (CO.files.init lists #queue as one of its targets).
    CO.on('list', render);
    CO.on('activeItem', render);
    CO.on('item', (it) => {
      const t = tiles.get(it.id);
      if (t) update(t, it); else render();
    });
    CO.on('sel', render);
    CO.on('progress', ({ it }) => { const t = tiles.get(it.id); if (t) update(t, it); });
    render();
  };
})();
