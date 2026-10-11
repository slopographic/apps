/* SlopIsolate — bulk editing. The queue selection (S.sel): Ctrl/Cmd-click adds or removes one image, Shift-click
 * selects a range from the anchor, Ctrl+A selects all. With two or more selected, the bulk bar (above the stage)
 * applies to all of them, one after another, with one progress bar (busy overlay):
 *   Apply the look of the image on screen (background, shadow, crop, edge settings) · Clear brush edits ·
 *   Re-run with a model · Export every finished image · Remove. Videos are skipped by the look, model and export actions.
 * CO.bulk.toggle / range / clear / selectAll / items / run(label, items, fn). */
(function () {
  'use strict';
  const CO = window.CO, U = CO.util, S = CO.state, P = CO.process, B = CO.bulk = {};
  let bar = null;

  B.items = () => S.items.filter((it) => S.sel.has(it.id));
  const emitSel = () => CO.emit('sel', [...S.sel]);
  B.toggle = (id) => { if (S.sel.has(id)) S.sel.delete(id); else S.sel.add(id); S.anchor = id; emitSel(); };
  B.clear = () => { if (S.sel.size) { S.sel.clear(); emitSel(); } };
  B.range = (from, to) => {
    const a = S.index(from), b = S.index(to);
    if (a < 0 || b < 0) return;
    S.sel.clear();
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) S.sel.add(S.items[i].id);
    emitSel();
  };
  B.selectAll = () => { S.items.forEach((it) => S.sel.add(it.id)); emitSel(); };

  /** Run fn(item, index) over items, one at a time, with one progress bar. Resolves with the number that succeeded. */
  B.run = async function (label, items, fn) {
    let ok = 0;
    for (let i = 0; i < items.length; i++) {
      CO.emit('busy', { on: true, msg: `${label} ${i + 1} of ${items.length}`, progress: i / items.length });
      try { await fn(items[i], i); ok++; } catch (e) { CO.emit('toast', `${items[i].name}: ${e.message || e}`); }
    }
    CO.emit('busy', { on: false });
    CO.emit('toast', `${label}: ${ok} of ${items.length} done`);
    return ok;
  };
  /** Wait until none of the items is queued or being worked on (the model runs in the queue). */
  const settled = (items) => new Promise((ok) => {
    const check = () => { if (!items.some((it) => it.status === 'queued' || it.status === 'working')) { off(); ok(); } };
    const off = CO.on('item', check);
    check();
  });

  const ACTIONS = {
    look(items) {
      const src = S.current();
      if (!src) return CO.emit('toast', 'Open the image whose look you want to copy');
      const targets = items.filter((it) => it !== src && it.kind !== 'video');
      return B.run('Applying the look to', targets, (it) => {
        Object.assign(it, { s: { ...src.s }, bg: { ...src.bg }, shadow: { ...src.shadow }, crop: { ...src.crop } });
        CO.emit('item', it);
        if (P.active && P.active.item === it) P.refresh(it);
      });
    },
    clear(items) {
      const targets = items.filter((it) => it.edit && it.kind !== 'video');
      return B.run('Clearing brush edits on', targets, (it) => {
        it.edit = null; it.hist = { undo: [], redo: [] };
        CO.emit('history', { it });
        if (P.active && P.active.item === it) P.refresh(it);
        CO.emit('item', it);
      });
    },
    async model(items, name) {
      const targets = items.filter((it) => it.kind !== 'video');
      targets.forEach((it) => { it.model = name; });
      CO.emit('busy', { on: true, msg: 'Re-running the model…', progress: null });
      targets.forEach((it) => P.rerun(it));
      await settled(targets);
      CO.emit('busy', { on: false });
      CO.emit('toast', `Re-ran ${targets.length} with the ${name} model`);
    },
    export(items) {
      const targets = items.filter((it) => it.status === 'done' && it.kind !== 'video');
      return B.run('Exporting', targets, (it) => CO.export.one(it));
    },
    remove(items) {
      if (!window.confirm || !window.confirm(`Remove ${items.length} image${items.length > 1 ? 's' : ''} from the queue?`)) return;
      B.clear();
      return B.run('Removing', items.slice(), (it) => P.remove(it));
    },
  };
  B.act = (name, arg) => { const items = B.items(); if (!items.length) return; return ACTIONS[name](items, arg); };

  /** The bar: count, look, clear, model, export, remove, and clear selection. Shown with two or more selected. */
  function build(workspace) {
    const models = [['fast', 'Fast'], ['quality', 'Quality'], ['portrait', 'Portrait']];
    const btn = (label, fn, cls = 'btn') => U.h('button', { type: 'button', class: cls, onclick: fn }, label);
    bar = U.h('div', { class: 'bulkbar', id: 'bulkBar', hidden: '', role: 'toolbar', 'aria-label': 'Bulk actions' },
      U.h('b', { class: 'bulk-n' }, ''),
      btn('Copy look from this image', () => B.act('look')),
      btn('Clear brush edits', () => B.act('clear')),
      U.h('select', { class: 'bulk-model', 'aria-label': 'Model', onchange: (e) => B.act('model', e.target.value) },
        U.h('option', { value: '' }, 'Re-run model…'), ...models.map(([v, t]) => U.h('option', { value: v }, t))),
      btn('Export all', () => B.act('export')),
      btn('Remove', () => B.act('remove'), 'btn danger'),
      btn('Clear selection', () => B.clear(), 'btn ghost'));
    workspace.prepend(bar);
    const sync = () => {
      const n = S.sel.size;
      bar.hidden = n < 2;
      bar.querySelector('.bulk-n').textContent = n + ' selected';
    };
    CO.on('sel', sync); CO.on('list', sync);
  }

  B.init = function () {
    const ws = U.$('#workspace');
    if (!ws) return;
    build(ws);
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'a' && U.$('#queue') && U.$('#queue').contains(document.activeElement)) {
        e.preventDefault(); B.selectAll();
      }
    });
  };
})();
