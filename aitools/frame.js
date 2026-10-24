/* Slop AI Tools pages (ocr, speech, denoise, tags, portrait): each tool as the suite's View · Panel (shared/frame). The
 * page marks its controls: data-side="settings" (a setting: the panel's Settings section), data-side="save" (a button: the
 * panel's Save section) and data-side="main" (the main button: stuck to the panel's foot; the suite rule,
 * shared/frame/HANDOFF.md). Everything else (the drop zone, the picture, the text) stays in the view. Phones: the panel is
 * a bottom sheet whose foot (Settings + the main button) always shows. The controls keep their ids and listeners (the
 * page's own script wires them). Classic script, after the markup, before or after the page's script. */
(function (g) {
  'use strict';
  const doc = g.document, ui = doc.getElementById('ui');
  if (!ui || !g.SlopFrame || ui.dataset.framed) return;
  ui.dataset.framed = '1';
  const view = doc.createElement('div'), side = doc.createElement('aside');
  view.className = 'ai-view ai-stack'; view.id = 'aiView';
  side.className = 'ai-side'; side.id = 'aiSide'; side.setAttribute('aria-label', 'Settings');
  view.append(...ui.childNodes);
  ui.classList.remove('ai-stack');
  ui.append(view, side);
  const pick = (kind) => [...view.querySelectorAll('[data-side="' + kind + '"]')];
  const settings = pick('settings'), saves = pick('save'), main = pick('main');
  side.append(...settings, ...saves, ...main);
  const fr = g.SlopFrame.mount(ui, {
    list: null, view, panel: side, phone: '(max-width: 760px)', panelLabel: 'Settings',
    storageKey: 'aitools-' + (location.pathname.split('/').filter(Boolean).pop() || 'tool'), phoneButton: false, width: 300, min: 260,
  });
  const title = (doc.querySelector('.ai-top h1') || {}).textContent || 'Tool';
  const panel = g.SlopFrame.panel(side, { title });
  panel.render([
    settings.length ? { title: 'Settings', key: 'settings', settings } : null,
    saves.length ? { title: 'Save', key: 'save', actions: saves.map((el) => ({ el })) } : null,
  ]);
  if (main.length) panel.footer(main.map((el) => ({ el })), { more: 'Settings' });
  g.SlopAIToolFrame = { frame: fr, panel };
})(typeof window !== 'undefined' ? window : globalThis);
