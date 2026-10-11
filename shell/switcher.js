/* SlopSwitcher: the Spotlight-style app switcher. Ctrl+Space (Cmd+Space on Mac) opens it, the header
 * button opens it too. Lists the Recent apps, the open app tabs and every registry app; typing filters
 * by name. Enter opens, arrow keys move, Escape closes. Built on the SlopShell core (shell/shell.js). */
(function () {
  'use strict';
  if (window.SlopSwitcher) return;
  const S = window.SlopShell;
  let back = null, input = null, listEl = null, items = [], active = 0, returnTo = null, isOpen = false;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const hue = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  /** The text for a key in the chosen language (SlopI18n), else the English given. {name} vars are filled. */
  const tr = (key, en, vars) => {
    const I = window.SlopI18n;
    const s = I ? I.t(key, vars) : '';
    if (s && s !== key) return s;
    return vars ? en.replace(/\{(\w+)\}/g, (m, n) => (n in vars ? String(vars[n]) : m)) : en;
  };

  /** Sections for the current query. Each item: { kind: 'app', app } or { kind: 'tab', tab }. */
  function sections(q) {
    const all = S.apps();
    const query = q.trim().toLowerCase();
    if (query) {
      const hits = all.filter((a) => (a.name + ' ' + a.id + ' ' + (a.tagline || '')).toLowerCase().includes(query))
        .sort((a, b) => Number(!a.name.toLowerCase().startsWith(query)) - Number(!b.name.toLowerCase().startsWith(query)));
      return [{ title: hits.length ? tr('nav.apps', 'Apps') : '', items: hits.map((app) => ({ kind: 'app', app })) }];
    }
    const cur = S.currentApp && S.currentApp.id;
    const recent = S.recent().filter((id) => id !== cur).map((id) => all.find((a) => a.id === id)).filter(Boolean).slice(0, 5);
    const tabs = window.SlopTabs ? window.SlopTabs.list() : [];
    return [
      { title: tr('switcher.recent', 'Recent'), items: recent.map((app) => ({ kind: 'app', app })) },
      { title: tr('switcher.open_tabs', 'Open tabs'), items: tabs.map((tab) => ({ kind: 'tab', tab })) },
      { title: tr('switcher.all_apps', 'All apps'), items: all.map((app) => ({ kind: 'app', app })) },
    ].filter((s) => s.items.length);
  }
  function label(it) {
    if (it.kind === 'tab') return { name: it.tab.name || tr('switcher.tab_name', 'Open tab'), sub: tr('switcher.tab_sub', 'Open in another window'), letter: (it.tab.name || '?')[0], key: 'tab:' + it.tab.tab };
    return { name: it.app.name, sub: it.app.tagline || '', letter: it.app.name[0], key: 'app:' + it.app.id, status: it.app.status };
  }

  function render() {
    const q = input.value;
    const secs = sections(q);
    items = [];
    listEl.textContent = '';
    for (const s of secs) {
      if (s.title) { const h = document.createElement('div'); h.className = 'sh-sec'; h.textContent = s.title; h.setAttribute('role', 'presentation'); listEl.append(h); }
      for (const it of s.items) {
        const i = items.length, L = label(it);
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'sh-opt';
        b.id = 'sh-opt-' + i;
        b.setAttribute('role', 'option');
        b.dataset.i = String(i);
        b.innerHTML = `<span class="sh-badge" style="--h:${hue(L.name)}">${esc(L.letter.toUpperCase())}</span><span class="sh-opt-text"><span class="sh-opt-name">${esc(L.name)}</span>${L.sub ? `<span class="sh-opt-sub">${esc(L.sub)}</span>` : ''}</span>${L.status && L.status !== 'live' ? `<span class="sh-tag">${esc(L.status)}</span>` : ''}`;
        b.addEventListener('click', () => activate(i));
        b.addEventListener('pointermove', () => setActive(i, false));
        listEl.append(b);
        items.push(it);
      }
    }
    if (!items.length) { const p = document.createElement('p'); p.className = 'sh-empty'; p.textContent = tr('switcher.no_match', 'No app matches “{query}”.', { query: q.trim() }); listEl.append(p); }
    active = 0;
    setActive(0, false);
  }
  function setActive(i, scroll = true) {
    if (!items.length) return;
    active = (i + items.length) % items.length;
    listEl.querySelectorAll('.sh-opt').forEach((o) => { const on = Number(o.dataset.i) === active; o.setAttribute('aria-selected', String(on)); o.classList.toggle('sh-on', on); });
    input.setAttribute('aria-activedescendant', 'sh-opt-' + active);
    if (scroll) { const cur = document.getElementById('sh-opt-' + active); if (cur) cur.scrollIntoView({ block: 'nearest' }); }
  }
  function activate(i) {
    const it = items[i];
    if (!it) return;
    close();
    if (it.kind === 'tab') window.SlopTabs && window.SlopTabs.focus(it.tab.tab);
    else S.navigate(S.appUrl(it.app));
  }

  function build() {
    back = document.createElement('div');
    back.className = 'sh-back';
    back.hidden = true;
    back.innerHTML = `<div class="sh-sw" role="dialog" aria-modal="true" aria-label="Switch app" data-i18n-attr="aria-label:shell.switch_app">
      <div class="sh-sw-head"><label class="sh-sr" for="sh-q" data-i18n="switcher.search">Search apps</label>
        <input id="sh-q" class="sh-q" type="search" placeholder="Search apps" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="sh-list" aria-autocomplete="list" data-i18n-attr="placeholder:switcher.search">
        <kbd class="sh-kbd" data-i18n="switcher.esc">Esc</kbd></div>
      <div class="sh-list" id="sh-list" role="listbox" aria-label="Apps" data-i18n-attr="aria-label:nav.apps"></div>
      <div class="sh-sw-foot"><span class="sh-hint" data-i18n="switcher.hint">Enter to open · ↑ ↓ to move</span><button type="button" class="sh-all" data-i18n="switcher.all_apps">All apps</button></div>
    </div>`;
    document.body.append(back);
    if (window.SlopI18n) window.SlopI18n.apply(); // the static labels, in the chosen language
    input = back.querySelector('#sh-q');
    listEl = back.querySelector('#sh-list');
    input.addEventListener('input', render);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); activate(active); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'Tab') { e.preventDefault(); input.focus(); }
    });
    back.querySelector('.sh-all').addEventListener('click', () => { close(); S.drawer.open(); });
    back.addEventListener('pointerdown', (e) => { if (e.target === back) close(); });
  }

  function open() {
    if (!back) build();
    if (isOpen) return;
    returnTo = document.activeElement;
    isOpen = true;
    back.hidden = false;
    input.value = '';
    render();
    requestAnimationFrame(() => input.focus({ preventScroll: true }));
  }
  function close() {
    if (!isOpen) return;
    isOpen = false;
    back.hidden = true;
    if (returnTo && returnTo.focus && document.contains(returnTo)) try { returnTo.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
  function toggle() { isOpen ? close() : open(); }

  /* Ctrl+Space and Cmd+Space. Skipped when a page already used the key (defaultPrevented). */
  document.addEventListener('keydown', (e) => {
    if (isOpen && e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); close(); return; }
    if (e.defaultPrevented || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    if (e.code !== 'Space' && e.key !== ' ') return;
    e.preventDefault();
    toggle();
  });

  window.SlopSwitcher = { open, close, toggle, isOpen: () => isOpen, items: () => items.slice() };
})();
