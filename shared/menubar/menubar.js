/* SlopMenuBar: the menu bar of an app: the Slopographic brand and home link, the app's name, a menu bar (File, Edit, View,
 * Help…) and a row of tools. Each menu item runs an action the app already has: a click on one of its buttons, given by
 * selector ('#id'), or a function. One source of truth: a menu never duplicates an action.
 *   SlopMenuBar.mount({
 *     app: 'Slopculator',                       // shown after the brand
 *     home: '../',                              // where the brand goes (default '../')
 *     menus: { File: ['#id', 'cmd:data.backup', '-', { label, act: fn, disabled?: bool|fn, key?, sub?: [...] }], Help: () => [...] },
 *     tools: ['#id', { label, act }],           // optional buttons at the right; a '#id' button is moved here
 *     host: '#menubar'                          // optional: fill this element instead of adding a bar at the top
 *   })
 * A menu given as a function is built each time it opens (for items that depend on the state of the app). An item with
 * sub opens a submenu. A '#id' item takes the button's own label. The bar is inserted at the top of <body>. Menus open on
 * click or Arrow Down; Arrow keys move, Right opens a submenu, Escape closes, a click elsewhere closes. A disabled item is
 * greyed out; enabled state is read each time a menu opens. Classic script. Exposes window.SlopMenuBar. */
(function () {
  'use strict';
  if (window.SlopMenuBar) return;
  const $ = (sel) => document.querySelector(sel);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

  const isCmd = (it) => typeof it === 'string' && it.startsWith('cmd:');
  /** A command's title without its group ("Customers: add a customer" is "Add a customer" in a menu). */
  const short = (t) => { const s = String(t).replace(/^[^:…]+:\s+/, ''); return s.charAt(0).toUpperCase() + s.slice(1); };
  /** A menu entry from the shorthand: '#id' is that button, 'cmd:<id>' a SlopCmd command (its title, keys and run: the
   *  app's one list of actions), '-' a separator, an object is taken as it is. A command not registered is left out. */
  function entry(it) {
    if (it === '-' || (it && typeof it === 'object')) return it;
    if (isCmd(it)) {
      const C = window.SlopCmd, id = it.slice(4), c = C && C.get(id);
      return c ? { label: short(c.title), key: C.keyFor(id), act: () => C.run(id) } : null;
    }
    if (typeof it !== 'string' || !it.startsWith('#')) return null;
    const t = $(it);
    const label = t ? (t.getAttribute('aria-label') || t.textContent.trim() || t.title || it) : it;
    return { label, click: it };
  }
  /** Is this item usable right now? A click target must exist, be visible and be enabled. */
  function usable(it) {
    if (typeof it.disabled === 'function' ? it.disabled() : it.disabled) return false;
    if (it.sub) return it.sub.some((s) => { const x = entry(s); return x && x !== '-' && usable(x); });
    if (it.click) { const t = $(it.click); return !!t && !t.disabled && !t.hidden; }
    return typeof it.act === 'function';
  }
  function run(it) {
    if (it.click) { const t = $(it.click); if (t) t.click(); return; }
    if (it.act) it.act();
  }

  /** Fills a menu list with items. Returns the rows (for keyboard moves) and the pairs (for enabled state). */
  function fill(list, items, close) {
    const rows = [], pairs = [];
    for (const raw of items) {
      const it = entry(raw);
      if (!it) continue;
      if (it === '-') { list.append(el('hr', 'smb-sep')); continue; }
      if (it.sub) {
        const wrap = el('div', 'smb-sub');
        const b = el('button', 'smb-item smb-has-sub', it.label);
        b.type = 'button'; b.setAttribute('role', 'menuitem'); b.setAttribute('aria-haspopup', 'menu'); b.setAttribute('aria-expanded', 'false');
        b.append(el('span', 'smb-caret', '›'));
        const pop = el('div', 'smb-pop smb-pop-sub'); pop.setAttribute('role', 'menu'); pop.hidden = true;
        const inner = fill(pop, it.sub, close);
        wrap.append(b, pop);
        const openSub = () => { if (!usable(it)) return; list.querySelectorAll('.smb-pop-sub').forEach((p) => { if (p !== pop) p.hidden = true; }); pop.hidden = false; b.setAttribute('aria-expanded', 'true'); const f = inner.rows.find((x) => !x.disabled); if (f) f.focus(); };
        b.addEventListener('click', () => (pop.hidden ? openSub() : (pop.hidden = true)));
        b.addEventListener('mouseenter', () => { if (pop.hidden) openSub(); });
        b.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') { e.preventDefault(); openSub(); } });
        pop.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft' || e.key === 'Escape') { e.preventDefault(); pop.hidden = true; b.setAttribute('aria-expanded', 'false'); b.focus(); } });
        b.disabled = !usable(it);
        rows.push(b); pairs.push([b, it, () => { inner.pairs.forEach(([x, y]) => { x.disabled = !usable(y); }); }]);
        list.append(wrap);
        continue;
      }
      const b = el('button', 'smb-item', it.label);
      b.type = 'button'; b.setAttribute('role', 'menuitem');
      const keys = it.keys || it.key;
      if (keys) b.append(el('span', 'smb-keys', keys));
      b.disabled = !usable(it);
      b.addEventListener('click', () => { close(); run(it); });
      rows.push(b); pairs.push([b, it]);
      list.append(b);
    }
    return { rows, pairs };
  }

  function menuFor(title, source) {
    const wrap = el('div', 'smb-menu');
    const btn = el('button', 'smb-menu-b', title);
    btn.type = 'button'; btn.setAttribute('aria-haspopup', 'menu'); btn.setAttribute('aria-expanded', 'false');
    const list = el('div', 'smb-pop'); list.setAttribute('role', 'menu'); list.hidden = true;
    let state = { rows: [], pairs: [] };
    const build = () => {
      list.replaceChildren();
      state = fill(list, typeof source === 'function' ? source() : source, close);
    };
    const open = () => {
      if (typeof source === 'function') build();
      for (const [b, it, refresh] of state.pairs) { b.disabled = !usable(it); if (refresh) refresh(); }
      document.querySelectorAll('.smb-pop').forEach((p) => { if (p !== list) p.hidden = true; });
      list.hidden = false; btn.setAttribute('aria-expanded', 'true');
      const first = state.rows.find((b) => !b.disabled); if (first) first.focus();
    };
    function close() { list.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
    if (typeof source !== 'function') build();
    btn.addEventListener('click', () => (list.hidden ? open() : close()));
    btn.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown') { e.preventDefault(); open(); } });
    list.addEventListener('keydown', (e) => {
      const live = state.rows.filter((b) => !b.disabled), i = live.indexOf(document.activeElement);
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
    // host: an element the app already has in its layout (a grid row, say) becomes the bar, so the layout is kept.
    const host = opts.host ? $(opts.host) : null;
    // "100% local": the page's own badge (its title says what stays local) moves next to the name, in every app.
    const local = document.querySelector('.local-badge');
    // The page's own buttons named in tools ('#id') are found before a host is emptied (they may live in it).
    const owned = new Map((opts.tools || []).filter((t) => typeof t === 'string' && t.startsWith('#')).map((t) => [t, $(t)]));
    const bar = host || el('header', 'smb-bar');
    bar.classList.add('smb-bar');
    if (host) host.replaceChildren();
    bar.setAttribute('aria-label', 'Application menu');
    // The brand is the app's icon with the Slopographic mark as a corner badge (SlopBrand.appMark, brand/brand.js), as in
    // every app header; the plain mark when the page has no icon for the app.
    const brand = el('a', 'smb-brand brand');
    brand.href = opts.home || '../'; brand.title = 'Slopographic home'; brand.setAttribute('aria-label', 'Slopographic home');
    brand.innerHTML = '<svg class="brand-mark smb-mark" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2C16 2 6 13.5 6 20a10 10 0 0 0 20 0C26 13.5 16 2 16 2z"/></svg>';
    const name = el('span', 'smb-app', opts.app || document.title.split('|')[0].trim());
    // "100% local": the page's own badge (it carries what stays local in its title) moves next to the name, in every app.

    const menubar = el('nav', 'smb-menus'); menubar.setAttribute('aria-label', 'Menus');
    const closers = [];
    for (const title of Object.keys(opts.menus || {})) {
      const own = opts.menus[title];
      // Help ends with the site's own "AI agents…" note (shared/agent/boot.js), once the page has it.
      const src = title !== 'Help' ? own : () => { const list = [].concat(typeof own === 'function' ? own() : own); return window.SlopCmd && SlopCmd.get('agents.about') && !list.includes('cmd:agents.about') ? list.concat(['-', 'cmd:agents.about']) : list; };
      // A menu of commands is built when it opens: the app registers its commands after the bar is mounted.
      const m = menuFor(title, Array.isArray(src) && src.some(isCmd) ? () => src : src);
      closers.push(m.close);
      menubar.append(m.wrap);
    }
    const tools = el('div', 'smb-tools');
    for (const raw of opts.tools || []) {
      // A '#id' tool is the page's own button, moved here as it is: its listeners and its state stay with it.
      if (typeof raw === 'string' && raw.startsWith('#')) { const own = owned.get(raw); if (own) tools.append(own); continue; }
      const t = entry(raw);
      if (!t || t === '-') continue;
      const b = el('button', 'smb-tool', t.label); b.type = 'button'; b.title = t.label; b.setAttribute('aria-label', t.label);
      b.disabled = !usable(t);
      b.addEventListener('click', () => run(t));
      tools.append(b);
    }
    bar.append(brand, name, ...(local ? [local] : []), menubar, tools);
    if (!host) document.body.prepend(bar);
    if (window.SlopBrand && window.SlopBrand.appMark) window.SlopBrand.appMark();
    document.addEventListener('click', (e) => { if (!e.target.closest('.smb-menu')) closers.forEach((c) => c()); });
    return bar;
  }

  window.SlopMenuBar = { mount };
})();
