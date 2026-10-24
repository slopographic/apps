/* SlopFramePanel: the content of a SlopFrame side panel (shared/frame/frame.js), the same in every app: a title, then
 * sections with a small heading, each holding key/value rows, a list of files with their own buttons, action buttons,
 * a note, or the app's own element. render() redraws the sections and keeps the keyboard focus on the same button.
 *   const p = SlopFramePanel.create(panelEl, { title: 'Message' });    // also SlopFrame.panel(panelEl, opts)
 *   p.render([{ title: 'Details', rows: [['From', 'Ann']] }, { title: 'Actions', actions: [{ label: 'Export', menu: [...] }] }]);
 *   p.setTitle(text)
 *   p.footer([{ label: 'Upscale', primary: true, run }], { note: 'Ctrl+Enter', more: 'Settings' })
 * Tool apps (resize, upscale, ocr…) put their settings and their main button here, the rule for every tool app
 * (shared/frame/HANDOFF.md): settings groups as { title, settings: element | [elements] } sections (the app's own form
 * controls, styled by .sf-field / .sf-lab / .sf-seg in frame.css), and the main button in footer(): a bar stuck to the
 * panel's bottom edge, so it is in reach however long the settings are. On a phone the closed sheet still shows the
 * footer at the bottom of the screen (the primary button is never hidden); its "more" button opens the whole sheet.
 * footer() redraws only the footer (call it on every state change; the settings are not touched). footer([]) removes it.
 * Section and action shapes: see frame.js. A menu opens under its button with shared/ui/menubutton.js (SlopMenuButton);
 * items are { label, act, disabled?, keywords? } or { heading }. Classic script; styles in frame.css. */
(function (g) {
  'use strict';
  if (g.SlopFramePanel) return;
  const doc = g.document;
  const el = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

  /** One button for an action. With a menu it is "Label ▾" and opens the menu under it. */
  function button(a, key) {
    const b = el('button', 'sui-btn sf-btn' + (a.primary ? ' sui-primary' : '') + (a.menu ? ' sf-menu-btn' : ''));
    b.type = 'button';
    b.dataset.sfKey = key;
    if (a.id) b.id = a.id;
    b.disabled = !!a.disabled;
    if (a.title) b.title = a.title;
    if (a.aria) b.setAttribute('aria-label', a.aria);
    b.append(el('span', 'sf-btn-txt', a.label));
    if (a.menu) {
      b.append(el('span', 'sf-caret', '▾'));
      b.setAttribute('aria-haspopup', 'menu');
      let shown = [];
      const items = () => {
        const src = typeof a.menu === 'function' ? a.menu() : a.menu;
        shown = (src || []).filter(Boolean);
        return shown.map((it, i) => (it.heading ? { heading: it.heading } : { value: String(i), label: it.label, disabled: !!it.disabled, keywords: it.keywords }));
      };
      if (g.SlopMenuButton) {
        g.SlopMenuButton.attach(b, { label: a.label, items, empty: a.empty || 'Nothing here', onPick: (v) => { const it = shown[Number(v)]; if (it && it.act) it.act(); } });
      } else {
        b.addEventListener('click', () => { const r = b.getBoundingClientRect(); items(); if (g.SlopUI) g.SlopUI.menu(shown.filter((it) => !it.heading), r.left, r.bottom + 4); });
      }
    } else if (a.run) {
      b.addEventListener('click', () => a.run());
    }
    return b;
  }

  function rows(list) {
    const dl = el('dl', 'sf-rows');
    for (const r of list) {
      if (!r || r[1] == null || r[1] === '') continue;
      const row = el('div', 'sf-row'), dd = el('dd', 'sf-val', String(r[1]));
      if (r[2]) dd.title = r[2];
      row.append(el('dt', 'sf-key', r[0]), dd);
      dl.append(row);
    }
    return dl;
  }

  function items(list, skey) {
    const ul = el('ul', 'sf-items');
    list.forEach((it, i) => {
      const li = el('li', 'sf-item');
      const main = el(it.open ? 'button' : 'div', 'sf-item-main');
      if (it.open) { main.type = 'button'; main.dataset.sfKey = skey + '/' + i + '/open'; main.title = it.title || it.name; main.addEventListener('click', () => it.open()); }
      main.append(el('span', 'sf-item-name', it.name));
      if (it.meta) main.append(el('span', 'sf-item-meta', it.meta));
      li.append(main);
      if (it.actions && it.actions.length) {
        const bar = el('div', 'sf-item-acts');
        it.actions.forEach((a, k) => bar.append(button(a, skey + '/' + i + '/' + k)));
        li.append(bar);
      }
      ul.append(li);
    });
    return ul;
  }

  function create(panel, o) {
    o = o || {};
    const head = el('div', 'sf-p-title'), h = el('h2', 'sf-p-h', o.title || '');
    head.append(h);
    const body = el('div', 'sf-p-body');
    panel.append(head, body);

    function render(sections) {
      const focused = doc.activeElement && panel.contains(doc.activeElement) ? doc.activeElement.dataset.sfKey : null;
      body.replaceChildren();
      (sections || []).filter(Boolean).forEach((s, si) => {
        const sec = el('section', 'sf-sec' + (s.cls ? ' ' + s.cls : ''));
        const skey = s.key || s.title || String(si);
        if (s.title) sec.append(el('h3', 'sf-h', s.title));
        if (s.note) sec.append(el('p', 'sf-note', s.note));
        if (s.rows) sec.append(rows(s.rows));
        if (s.list) sec.append(s.list.length ? items(s.list, skey) : el('p', 'sf-note', s.empty || 'None.'));
        if (s.actions) {
          const bar = el('div', 'sf-acts');
          s.actions.filter(Boolean).forEach((a, k) => bar.append(button(a, skey + '/a/' + (a.id || k))));
          sec.append(bar);
        }
        if (s.settings) {
          const set = el('div', 'sf-set');
          set.append(...[].concat(s.settings).filter(Boolean));
          sec.append(set);
        }
        if (s.body) sec.append(s.body);
        body.append(sec);
      });
      if (focused) {
        const again = body.querySelector('[data-sf-key="' + focused.replace(/["\\]/g, '\\$&') + '"]');
        if (again && !again.disabled) again.focus({ preventScroll: true });
      }
    }

    // The footer: the main button(s), stuck to the panel's bottom; its height is kept in --sf-foot-h on the frame's root
    // (frame.css lifts the page above it on phones, where the closed sheet shows only the footer).
    const foot = el('div', 'sf-p-foot');
    const host = () => panel.closest('.sf-root') || panel.parentElement;
    const ro = g.ResizeObserver ? new g.ResizeObserver(() => { const r = host(); if (r) r.style.setProperty('--sf-foot-h', foot.offsetHeight + 'px'); }) : null;
    function footer(actions, fo) {
      fo = fo || {};
      const list = (actions || []).filter(Boolean);
      const focused = doc.activeElement && foot.contains(doc.activeElement) ? doc.activeElement.dataset.sfKey : null;
      foot.replaceChildren();
      const had = panel.classList.contains('sf-has-foot');
      panel.classList.toggle('sf-has-foot', list.length > 0);
      if (had !== list.length > 0) panel.dispatchEvent(new g.CustomEvent('sf-foot'));
      if (!list.length) { foot.remove(); return; }
      const bar = el('div', 'sf-foot-acts');
      list.forEach((a, k) => bar.append(button(a, 'foot/' + (a.id || k))));
      if (fo.more) {
        const m = button({ label: fo.more, run: () => panel.dispatchEvent(new g.CustomEvent('sf-sheet', { bubbles: true })) }, 'foot/more');
        m.classList.add('sf-foot-more');
        m.setAttribute('aria-haspopup', 'dialog');
        bar.prepend(m);
      }
      foot.append(bar);
      if (fo.note) foot.append(el('p', 'sf-foot-note', fo.note));
      if (foot.parentNode !== panel || panel.lastChild !== foot) panel.append(foot);
      if (ro) ro.observe(foot);
      if (focused) { const again = foot.querySelector('[data-sf-key="' + focused + '"]'); if (again && !again.disabled) again.focus({ preventScroll: true }); }
    }
    return { render, footer, setTitle: (t) => { h.textContent = t; }, element: body, title: head, foot };
  }

  g.SlopFramePanel = { create };
})(window);
