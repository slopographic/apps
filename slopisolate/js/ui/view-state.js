/* SlopIsolate — ui/view-state: keeps the work across leaving the page and reloads. Everything stays in this browser,
 * through SlopSession (IndexedDB 'slop-session'); nothing is uploaded. Saved per item: the file (blob), the model,
 * the look, the brush edits and, once processed, the matte itself (the refined base mask for images; the per-frame
 * masks for videos). Coming back puts the same images, masks and edits on screen without running the model again.
 * Items that were still queued are queued again. The active item, tool, view and split are kept too.
 * Clear saved work: the toolbar button removes the saved session and the queue. Exposes CO.viewState. */
(function () {
  'use strict';
  const CO = window.CO, S = CO.state, U = CO.util, APP = 'cutout', KEY = 'session';
  const TOOLS = ['pan', 'keep', 'remove'], VIEWS = ['result', 'before', 'mask'];
  let ready = false; // nothing is saved until the saved session has been put back

  const isImg = (it) => it.kind !== 'video' && it.file instanceof Blob;
  const kept = () => S.items.filter((it) => it.file instanceof Blob);
  const copyLook = (it) => ({ s: it.s, bg: Object.assign({}, it.bg, { image: null }), shadow: it.shadow, crop: it.crop });
  const u8 = (a) => (a ? new Uint8ClampedArray(a) : null);

  const auto = window.SlopSession.autosave(APP, KEY, function () {
    const list = kept();
    return {
      v: 2,
      items: list.map((it) => {
        const done = it.status === 'done';
        const rec = { kind: it.kind || 'image', name: it.name, file: it.file, model: it.model, look: copyLook(it), edit: it.edit ? u8(it.edit) : null, done };
        if (done && rec.kind === 'image') Object.assign(rec, { base: it.base ? u8(it.base) : null, w: it.w, h: it.h });
        if (done && rec.kind === 'video' && it.vid && it.vid.res) rec.res = { masks: it.vid.res.masks.map((m) => u8(m)), mw: it.vid.res.mw, mh: it.vid.res.mh };
        return rec;
      }),
      active: list.findIndex((it) => it.id === S.activeId),
      tool: S.tool, view: S.view, split: S.split,
    };
  }, { delay: 600 });
  const touch = function () { if (ready) auto.touch(); };
  ['list', 'active', 'activeItem', 'item', 'history', 'look'].forEach((t) => CO.on(t, touch));
  ['pointerup', 'keyup', 'click', 'input', 'change'].forEach((t) => document.addEventListener(t, touch, true));

  /** One finished image back on the list: its base mask is already there, so no model run. */
  function restoreImage(src) {
    const f = new File([src.file], src.name || 'image', { type: src.file.type });
    const it = S.createItem(f, src.name);
    Object.assign(it, { url: URL.createObjectURL(f), model: src.model || it.model, w: src.w || 0, h: src.h || 0, base: u8(src.base), status: 'done' });
    if (src.look) Object.assign(it, { s: src.look.s, shadow: src.look.shadow, crop: src.look.crop, bg: Object.assign({}, it.bg, src.look.bg, { image: null }) });
    if (src.edit) it.edit = u8(src.edit);
    S.items.push(it);
    return it;
  }
  /** One finished video back on the list: the source is probed again, the saved matte is put back. */
  async function restoreVideo(src) {
    const f = new File([src.file], src.name || 'video', { type: src.file.type });
    const it = await CO.video.addItem(f, {});
    if (src.res && it.vid && it.vid.src) {
      it.vid.res = { masks: src.res.masks.map((m) => u8(m)), mw: src.res.mw, mh: src.res.mh, weight: 0.35, cancelled: false };
      S.setStatus(it, 'done', { progress: null });
    }
    return it;
  }
  /** Items that were still queued (no result) are simply queued again. */
  function restoreQueued(list) {
    const files = list.map((src) => new File([src.file], src.name || 'image', { type: src.file.type }));
    return CO.process.add(files) || [];
  }

  CO.viewState = {
    /** Boot: put back the images (with their masks and edits), the one on screen and the tool, view and split. */
    restore: async function () {
      const p = await window.SlopSession.load(APP, KEY, null).catch(function () { return null; });
      if (p && typeof p === 'object') {
        if (TOOLS.includes(p.tool)) S.setTool(p.tool);
        if (VIEWS.includes(p.view)) S.setView(p.view);
        if (typeof p.split === 'number' && p.split >= 0 && p.split <= 1) S.split = p.split;
        const list = Array.isArray(p.items) ? p.items.filter((it) => it && it.file instanceof Blob) : [];
        const byItem = new Map();
        for (const src of list) {
          if (!src.done) { const [it] = restoreQueued([src]); if (it && src.edit) it.edit = u8(src.edit); byItem.set(src, it || null); continue; }
          const it = src.kind === 'video' ? await restoreVideo(src) : restoreImage(src);
          byItem.set(src, it);
        }
        const act = byItem.get(list[p.active]) || byItem.get(list[0]);
        if (act) { S.activeId = act.id; CO.emit('list', S.items); CO.emit('activeItem', act); if (act.status === 'done' && act.kind !== 'video') CO.process.select(act); }
        else CO.emit('list', S.items);
      }
      ready = true;
    },
    /** Remove the saved session and the queue. */
    clear: async function () {
      auto.cancel();
      ready = false;
      await window.SlopSession.remove(APP, KEY).catch(function () {});
      for (const it of [...S.items]) CO.process.remove(it);
      S.activeId = null;
      CO.emit('list', S.items);
      CO.emit('activeItem', null);
      ready = true;
      if (window.SlopUI) SlopUI.toast('Saved work cleared');
    },
    /** Flush the pending save now (used before an in-page navigation). */
    flush: function () { return auto.flush(); },
    isImage: isImg,
  };

  /** The toolbar button: clear the saved work (asks first). */
  CO.viewState.init = function () {
    const top = U.$('.topbar'), dl = U.$('#btnDownload');
    if (!top || !dl) return;
    const b = U.h('button', { type: 'button', class: 'btn ghost', id: 'btnClearSaved', title: 'Remove the saved work in this browser' }, 'Clear saved work');
    b.addEventListener('click', () => {
      if (!window.confirm || !window.confirm('Clear the saved work? The images and masks in this browser will be removed.')) return;
      CO.viewState.clear();
    });
    top.insertBefore(b, dl);
  };
})();
