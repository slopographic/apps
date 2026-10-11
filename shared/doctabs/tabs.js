/* SlopDocTabs: the document tab strip that every document app shares. Classic script, no network, no storage.
 * SlopDocTabs.mount(hostEl, adapter, opts) -> api. The adapter contract and the steps to use it are in HANDOFF.md.
 * Each tab keeps its own doc object. Switching calls adapter.deactivate(old) and then adapter.activate(new).
 * Load order: tabs.js, drive.js, session.js (drive and session attach themselves to window.SlopDocTabs). */
(function () {
  'use strict';
  const NS = window.SlopDocTabs || (window.SlopDocTabs = {});
  if (NS.mount) return;

  let seq = 0;
  /** A tab id, unique across reloads too: session.js names the stored content with it. */
  const newId = () => 't' + Date.now().toString(36) + '-' + (seq++).toString(36) + '-' + Math.random().toString(36).slice(2, 8);

  /** A DOM element from a tag, attributes (false, null and undefined are skipped, true is a bare attribute) and children. */
  function make(d, tag, attrs, kids) {
    const n = d.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v !== false && v != null) n.setAttribute(k, v === true ? '' : String(v));
    n.append(...(kids || []).filter(Boolean));
    return n;
  }
  function defaultConfirm(title, msg, ok) {
    if (window.SlopUI && SlopUI.confirm) return SlopUI.confirm(title, msg, ok, { danger: true });
    return Promise.resolve(window.confirm(msg));
  }
  function defaultToast(msg) { if (window.SlopUI && SlopUI.toast) SlopUI.toast(msg, 3200); }

  /** mount(hostEl, adapter, opts): opts = { appId, confirm(title, msg, ok) -> Promise<bool>, toast(msg), keys: true }. */
  function mount(host, adapter, opts = {}) {
    if (!host || !adapter) throw new Error('SlopDocTabs.mount needs a host element and an adapter');
    const d = host.ownerDocument, win = d.defaultView;
    const confirmFn = opts.confirm || defaultConfirm, toastFn = opts.toast || defaultToast;
    const tabs = []; // { id, doc, driveId }
    const listeners = new Set();
    let cur = null, dragId = null, menuOpen = false;

    const strip = make(d, 'div', { class: 'sl-doctabs-strip' });
    const plus = make(d, 'button', { type: 'button', class: 'sl-doctabs-new', title: 'New document (Ctrl+T)', 'aria-label': 'New document' }, ['+']);
    const more = make(d, 'button', { type: 'button', class: 'sl-doctabs-more', title: 'All open documents', 'aria-label': 'All open documents', 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, ['⋯']);
    const menu = make(d, 'div', { class: 'sl-doctabs-menu', role: 'menu' });
    more.hidden = true; menu.hidden = true;
    host.classList.add('sl-doctabs');
    host.append(strip, plus, more, menu);

    const call = (name, ...a) => (typeof adapter[name] === 'function' ? adapter[name](...a) : undefined);
    const find = (doc) => tabs.find((t) => t.doc === doc) || null;
    const titleOf = (t) => call('title', t.doc) || 'Untitled';
    const dirtyOf = (t) => !!call('dirty', t.doc);
    const emit = (why, t, other) => { for (const fn of [...listeners]) { try { fn(why, t, api, other); } catch (e) { console.warn(e); } } };

    function checkOverflow() {
      more.hidden = !(tabs.length > 1 && strip.scrollWidth > strip.clientWidth + 1);
      if (more.hidden) setMenu(false);
    }
    function render() {
      strip.replaceChildren(...tabs.map(tabEl));
      const act = strip.querySelector('.sl-doctab[aria-selected="true"]');
      if (act && act.scrollIntoView) act.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      checkOverflow();
      if (menuOpen) renderMenu();
    }
    function tabEl(t) {
      const on = t === cur, name = titleOf(t);
      const x = make(d, 'button', { type: 'button', class: 'sl-doctab-x', title: 'Close (Ctrl+W)', 'aria-label': 'Close ' + name }, ['×']);
      x.addEventListener('click', (e) => { e.stopPropagation(); close(t.doc); });
      const n = make(d, 'div', { class: 'sl-doctab' + (on ? ' active' : ''), role: 'tab', 'aria-selected': on ? 'true' : 'false', tabindex: on ? '0' : '-1', title: name, draggable: 'true', 'data-id': t.id }, [
        make(d, 'span', { class: 'sl-doctab-name' }, [name]),
        dirtyOf(t) ? make(d, 'i', { class: 'sl-doctab-dot', 'aria-label': 'unsaved changes' }) : null,
        x,
      ]);
      n.addEventListener('click', (e) => { if (e.button === 0 && !e.target.closest('.sl-doctab-x')) activate(t.doc); });
      n.addEventListener('auxclick', (e) => { if (e.button === 1) { e.preventDefault(); close(t.doc); } });
      n.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); step(e.key === 'ArrowRight' ? 1 : -1); } });
      n.addEventListener('dragstart', (e) => { dragId = t.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('application/x-sl-doctab', t.id); });
      n.addEventListener('dragend', () => { dragId = null; });
      n.addEventListener('dragover', (e) => { if (dragId) e.preventDefault(); });
      n.addEventListener('drop', (e) => {
        if (!dragId) return;
        e.preventDefault();
        const r = n.getBoundingClientRect(), at = tabs.findIndex((x2) => x2.id === t.id);
        reorder(dragId, at + (e.clientX > r.left + r.width / 2 ? 1 : 0));
        dragId = null;
      });
      return n;
    }
    function reorder(id, to) {
      const from = tabs.findIndex((t) => t.id === id);
      if (from < 0) return;
      const [t] = tabs.splice(from, 1);
      if (from < to) to--;
      tabs.splice(Math.max(0, Math.min(to, tabs.length)), 0, t);
      render(); emit('reorder', t);
    }

    /** Make t the active tab: the old one is deactivated first, then the new one is activated. */
    function switchTo(t) {
      const old = cur;
      if (old) call('deactivate', old.doc);
      cur = t;
      call('activate', t.doc);
      render();
      emit('activate', t, old);
    }
    function activate(doc) {
      const t = find(doc);
      if (t && t !== cur) switchTo(t);
    }
    function step(dir) {
      if (tabs.length < 2 || !cur) return;
      const i = tabs.indexOf(cur);
      activate(tabs[(i + dir + tabs.length) % tabs.length].doc);
    }

    /** Open a document as a tab. opts: { id, driveId, activate = true, append = false }. The new tab goes after the active one. */
    function openDoc(doc, o = {}) {
      const t = { id: o.id || newId(), doc, driveId: o.driveId || null };
      tabs.splice(o.append || !cur ? tabs.length : tabs.indexOf(cur) + 1, 0, t);
      if (o.activate === false && cur) { render(); emit('open', t); return t; }
      switchTo(t);
      emit('open', t);
      return t;
    }
    function newTab() { return openDoc(adapter.newDoc()); }

    /** Close a tab (the active one by default). A dirty tab asks first. The last tab closed leaves a blank one. */
    async function close(doc = cur && cur.doc) {
      const t = doc && find(doc);
      if (!t) return true;
      if (dirtyOf(t) && !(await confirmFn('Close document?', `“${titleOf(t)}” has changes you haven't saved. Close it anyway?`, 'Close'))) return false;
      const i = tabs.indexOf(t), wasCur = t === cur;
      tabs.splice(i, 1);
      if (wasCur) { cur = null; call('deactivate', t.doc); }
      emit('close', t);
      if (!tabs.length) openDoc(adapter.newDoc());
      else if (wasCur) switchTo(tabs[Math.min(i, tabs.length - 1)]);
      else render();
      return true;
    }

    /** The app calls this after an edit (or a rename): the tab title and dirty dot are redrawn and the session saves. */
    function changed(doc) {
      const t = find(doc);
      if (!t) return;
      render();
      emit('content', t);
    }

    /* ----- overflow menu: every tab in a list, for when the strip is full ----- */
    function renderMenu() {
      menu.replaceChildren(...tabs.map((t) => make(d, 'button', { type: 'button', role: 'menuitemradio', 'aria-checked': t === cur ? 'true' : 'false', class: 'sl-doctabs-item' + (t === cur ? ' active' : '') }, [titleOf(t), dirtyOf(t) ? ' ●' : ''])));
      menu.querySelectorAll('button').forEach((b, i) => b.addEventListener('click', () => { setMenu(false); activate(tabs[i].doc); }));
    }
    function setMenu(open) {
      menuOpen = open;
      menu.hidden = !open;
      more.setAttribute('aria-expanded', String(open));
      if (open) renderMenu();
    }

    /* ----- wiring ----- */
    const onClick = (e) => {
      if (menuOpen && !menu.contains(e.target) && e.target !== more) setMenu(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape' && menuOpen) { setMenu(false); return; }
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (e.key === 'Tab') { e.preventDefault(); step(e.shiftKey ? -1 : 1); }
      else if (k === 'w' && !e.shiftKey) { e.preventDefault(); close(); }
      else if (k === 't' && !e.shiftKey) { e.preventDefault(); newTab(); }
    };
    plus.addEventListener('click', () => newTab());
    more.addEventListener('click', () => setMenu(!menuOpen));
    d.addEventListener('pointerdown', onClick, true);
    if (opts.keys !== false) d.addEventListener('keydown', onKey, true);
    win.addEventListener('resize', checkOverflow);

    const api = {
      appId: opts.appId || null,
      adapter,
      newTab, openDoc, activate, close, changed, step, reorder,
      current: () => (cur ? cur.doc : null),
      /** Snapshot of the strip, in order: [{ id, doc, title, dirty, active, driveId }]. */
      tabs: () => tabs.map((t) => ({ id: t.id, doc: t.doc, title: titleOf(t), dirty: dirtyOf(t), active: t === cur, driveId: t.driveId })),
      tabOf: (doc) => { const t = find(doc); return t ? t.id : null; },
      driveIdOf: (doc) => { const t = find(doc); return t ? t.driveId : null; },
      /** Record the Slop Drive file a tab is linked to (kept across reloads by session.js). */
      setDriveId(doc, id) { const t = find(doc); if (t) { t.driveId = id || null; emit('drive', t); } },
      /** After a save: the adapter's saved(doc) runs (clears the dirty state), then the strip is redrawn. */
      markSaved(doc) { if (find(doc)) { call('saved', doc); changed(doc); } },
      /** Subscribe to strip events: fn(why, tab, api, other). why: open, close, activate, reorder, content, drive. */
      on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
      overflowVisible: () => !more.hidden,
      saveToDrive: (doc = api.current()) => (NS.drive ? NS.drive.saveToDrive(api, doc) : Promise.resolve(null)),
      openFromDrive: (o) => (NS.drive ? NS.drive.openFromDrive(api, o) : Promise.resolve(null)),
      toast: (msg) => toastFn(msg),
      destroy() {
        d.removeEventListener('pointerdown', onClick, true);
        d.removeEventListener('keydown', onKey, true);
        win.removeEventListener('resize', checkOverflow);
        listeners.clear(); tabs.length = 0; cur = null;
        strip.remove(); plus.remove(); more.remove(); menu.remove();
        host.classList.remove('sl-doctabs');
      },
    };
    render();
    return api;
  }

  NS.mount = mount;
  NS.newId = newId;
})();
