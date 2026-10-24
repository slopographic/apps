/* SlopFramePanel: the content of a SlopFrame side panel (shared/frame/frame.js), the same in every app: a title, then
 * sections with a small heading, each holding key/value rows, a list of files with their own buttons, action buttons,
 * a note, or the app's own element. render() redraws the sections and keeps the keyboard focus on the same button.
 *   const p = SlopFramePanel.create(panelEl, { title: 'Message' });    // also SlopFrame.panel(panelEl, opts)
 *   p.render([{ title: 'Details', rows: [['From', 'Ann']] }, { title: 'Actions', actions: [{ label: 'Export', menu: [...] }] }]);
 *   p.setTitle(text)
 *   p.setFooter(actions)   the panel's main actions in a footer that stays at the bottom while the panel scrolls (the
 *                          primary one first: "Watermark 3 files", then Download, Save to Slop Drive…); [] removes it
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
        if (s.body) sec.append(s.body);
        body.append(sec);
      });
      if (focused) {
        const again = body.querySelector('[data-sf-key="' + focused.replace(/["\\]/g, '\\$&') + '"]');
        if (again && !again.disabled) again.focus({ preventScroll: true });
      }
    }
    let foot = null;
    function setFooter(actions) {
      const list = (actions || []).filter(Boolean);
      if (!foot) { foot = el('div', 'sf-p-foot'); panel.append(foot); }
      const focused = doc.activeElement && foot.contains(doc.activeElement) ? doc.activeElement.dataset.sfKey : null;
      foot.replaceChildren(...list.map((a, k) => button(a, 'foot/' + (a.id || k))));
      foot.hidden = !list.length;
      const again = focused && foot.querySelector('[data-sf-key="' + focused.replace(/["\\]/g, '\\$&') + '"]');
      if (again && !again.disabled) again.focus({ preventScroll: true });
    }
    return { render, setTitle: (t) => { h.textContent = t; }, setFooter, element: body, title: head };
  }

  g.SlopFramePanel = { create };
})(window);
