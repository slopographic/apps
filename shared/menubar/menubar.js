/* SlopMenuBar: the menu bar of an app: the Slopographic brand and home link, the app's name, a menu bar (File, Edit, View,
 * Help…) and a row of tools. Each menu item runs an action the app already has: a click on one of its buttons, given by
 * selector ('#id'), or a function. One source of truth: a menu never duplicates an action.
 *   SlopMenuBar.mount({
 *     app: 'Slopculator',                       // shown after the brand
 *     home: '../',                              // where the brand goes (default '../')
 *     menus: { File: ['#id', '-', { label, act: fn, disabled?: fn }], Edit: [...], View: [...], Help: [...] },
 *     tools: ['#id', { label, act }]            // optional buttons at the right
 *   })
 * A '#id' item takes the button's own label. The bar is inserted at the top of <body>. Menus open on click or Arrow Down;
 * Arrow keys move, Escape closes, a click elsewhere closes. A disabled item is greyed out; enabled state is read each time
 * a menu opens. Classic script. Exposes window.SlopMenuBar. */
(function () {
  'use strict';
  if (window.SlopMenuBar) return;
  const $ = (sel) => document.querySelector(sel);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

  /** A menu entry from the shorthand: '#id' is that button, '-' a separator, an object is taken as it is. */
  function entry(it) {
    if (it === '-' || (it && typeof it === 'object')) return it;
    if (typeof it !== 'string' || !it.startsWith('#')) return null;
    const t = $(it);
    const label = t ? (t.getAttribute('aria-label') || t.textContent.trim() || t.title || it) : it;
    return { label, click: it };
  }
  /** Is this item usable right now? A click target must exist, be visible and be enabled. */
  function usable(it) {
    if (it.disabled && it.disabled()) return false;
    if (it.click) { const t = $(it.click); return !!t && !t.disabled && !t.hidden; }
    return typeof it.act === 'function';
  }
  function run(it) {
    if (it.click) { const t = $(it.click); if (t) t.click(); return; }
    if (it.act) it.act();
  }

  function menuFor(title, items) {
    const wrap = el('div', 'smb-menu');
    const btn = el('button', 'smb-menu-b', title);
    btn.type = 'button'; btn.setAttribute('aria-haspopup', 'menu'); btn.setAttribute('aria-expanded', 'false');
    const list = el('div', 'smb-pop'); list.setAttribute('role', 'menu'); list.hidden = true;
    const rows = [], pairs = [];
    for (const raw of items) {
      const it = entry(raw);
      if (!it) continue;
      if (it === '-') { list.append(el('hr', 'smb-sep')); continue; }
      const b = el('button', 'smb-item', it.label);
      b.type = 'button'; b.setAttribute('role', 'menuitem');
      if (it.keys) b.append(el('span', 'smb-keys', it.keys));
      b.disabled = !usable(it);
      b.addEventListener('click', () => { close(); run(it); });
      rows.push(b); pairs.push([b, it]);
      list.append(b);
    }
    const open = () => {
      for (const [b, it] of pairs) b.disabled = !usable(it);
      document.querySelectorAll('.smb-pop').forEach((p) => { if (p !== list) p.hidden = true; });
      list.hidden = false; btn.setAttribute('aria-expanded', 'true');
      const first = rows.find((b) => !b.disabled); if (first) first.focus();
    };
    const close = () => { list.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
    btn.addEventListener('click', () => (list.hidden ? open() : close()));
    btn.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown') { e.preventDefault(); open(); } });
    list.addEventListener('keydown', (e) => {
      const live = rows.filter((b) => !b.disabled), i = live.indexOf(document.activeElement);
      if (e.key === 'Escape') { close(); btn.focus(); }
      else if (e.key === 'ArrowDown' && live.length) { e.preventDefault(); live[(i + 1) % live.length].focus(); }
      else if (e.key === 'ArrowUp' && live.length) { e.preventDefault(); live[(i - 1 + live.length) % live.length].focus(); }
    });
    wrap.append(btn, list);
    return { wrap, close };
  }

  function mount(o) {
    const opts = o || {};
    if (document.querySelector('.smb-bar')) return null;
    const bar = el('header', 'smb-bar');
    bar.setAttribute('aria-label', 'Application menu');
    const brand = el('a', 'smb-brand');
    brand.href = opts.home || '../'; brand.title = 'Slopographic home'; brand.setAttribute('aria-label', 'Slopographic home');
    brand.append(el('span', 'smb-mark', 'S'));
    const name = el('span', 'smb-app', opts.app || document.title.split('|')[0].trim());
    const menubar = el('nav', 'smb-menus'); menubar.setAttribute('aria-label', 'Menus');
    const closers = [];
    for (const title of Object.keys(opts.menus || {})) {
      const m = menuFor(title, opts.menus[title]);
      closers.push(m.close);
      menubar.append(m.wrap);
    }
    const tools = el('div', 'smb-tools');
    for (const raw of opts.tools || []) {
      const t = entry(raw);
      if (!t || t === '-') continue;
      const b = el('button', 'smb-tool', t.label); b.type = 'button'; b.title = t.label; b.setAttribute('aria-label', t.label);
      b.disabled = !usable(t);
      b.addEventListener('click', () => run(t));
      tools.append(b);
    }
    bar.append(brand, name, menubar, tools);
    document.body.prepend(bar);
    document.addEventListener('click', (e) => { if (!e.target.closest('.smb-menu')) closers.forEach((c) => c()); });
    return bar;
  }

  window.SlopMenuBar = { mount };
})();
