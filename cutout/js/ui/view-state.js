/* SlopIsolate — ui/view-state: coming back to SlopIsolate brings back the images you were working on (each file, its
 * look and its brush edits), the one on screen, and the tool, the view and the split. Everything stays in this browser:
 * it is kept through SlopSession (IndexedDB), never uploaded. The panel is already kept in the prefs (menus.js).
 * Classic script; uses CO.state and CO.process. Exposes CO.viewState. */
(function () {
  'use strict';
  const CO = window.CO, S = CO.state, APP = 'cutout';
  const TOOLS = ['pan', 'keep', 'remove'], VIEWS = ['result', 'before', 'mask'];
  let ready = false; // nothing is saved until the saved session has been put back
  const kept = () => S.items.filter((it) => it.file instanceof Blob);
  const auto = window.SlopSession.autosave(APP, 'session', function () {
    const list = kept();
    return {
      items: list.map((it) => ({
        name: it.name, file: it.file,
        look: { s: it.s, bg: Object.assign({}, it.bg, { image: null }), shadow: it.shadow, crop: it.crop },
        edit: it.edit ? new Uint8ClampedArray(it.edit) : null,
      })),
      active: list.findIndex((it) => it.id === S.activeId),
      tool: S.tool, view: S.view, split: S.split,
    };
  }, { delay: 600 });
  const touch = function () { if (ready) auto.touch(); };
  CO.on('list', touch);
  CO.on('active', touch);
  ['pointerup', 'keyup', 'click', 'input', 'change'].forEach(function (t) { document.addEventListener(t, touch, true); });

  CO.viewState = {
    /** Boot: put back the images, the one on screen and the tool, view and split. */
    restore: async function () {
      const p = await window.SlopSession.load(APP, 'session', null).catch(function () { return null; });
      if (p && typeof p === 'object') {
        if (TOOLS.includes(p.tool)) S.setTool(p.tool);
        if (VIEWS.includes(p.view)) S.setView(p.view);
        if (typeof p.split === 'number' && p.split >= 0 && p.split <= 1) S.split = p.split;
        const list = Array.isArray(p.items) ? p.items.filter((it) => it && it.file instanceof Blob) : [];
        if (list.length && CO.process) {
          const files = list.map((it) => new File([it.file], it.name || 'image', { type: it.file.type }));
          const added = CO.process.add(files) || [];
          added.forEach(function (it, i) {
            const src = list[i];
            if (!src) return;
            if (src.look) Object.assign(it, { s: src.look.s, shadow: src.look.shadow, crop: src.look.crop, bg: Object.assign({}, it.bg, src.look.bg, { image: it.bg.image }) });
            if (src.edit) it.edit = new Uint8ClampedArray(src.edit);
          });
          const act = added[p.active] || added[0];
          if (act) S.activeId = act.id;
          CO.emit('list', S.items);
        }
      }
      ready = true;
    },
  };
})();
