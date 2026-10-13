/* SlopDropChoice: the choice a file drop offers when a document is already open, "Add to current" or "Create new".
   Attaches to window.SlopDropChoice. Classic script, no network, no storage. Loads after panel.js and drop.js (the
   drop routing); it needs nothing else. See shared/drop/HANDOFF.md.
   ask({ files, hasDocument, labels }) -> Promise<'current' | 'new' | null>
     No file: null. No document open: 'new' at once (nothing to add to). Otherwise a dialog with the two choices, Cancel
     and Escape; Cancel, Escape and a click on the backdrop resolve null. labels: { title, message, current, new, cancel }.
   zones(host, { labels, accept }) -> { at(e), hide(), destroy() } | null
     The drop-zone helper. While a drag that accept(e) takes (default: a file drag) is over host, it shows two zones over
     host: 'new' (open as a new document) and 'current' (add to the current one). at(e) says which zone an event is over,
     'new' | 'current', or null outside them. Read it in the drop event: it looks at the event's own target, so a drop
     never inherits an earlier hover. labels: { new, current, newHint, currentHint } (a hint may be a function). */
(function (root) {
  'use strict';
  const doc = root.document;
  const C = (root.SlopDropChoice = root.SlopDropChoice || {});
  const DIALOG = { title: 'Add files', message: 'Where should these files go?', current: 'Add to current', new: 'Create new', cancel: 'Cancel' };
  const ZONES = { new: 'Create new', current: 'Add to current', newHint: 'Open as a new document', currentHint: 'Add to the document that is open' };
  const CSS = [
    '.sdc-zones{position:absolute;inset:0;display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:14px;z-index:20;background:color-mix(in srgb,var(--app,#111) 60%,transparent)}',
    '.sdc-zones[hidden]{display:none}',
    '.sdc-zone{border:2px dashed color-mix(in srgb,var(--fg,#888) 45%,transparent);border-radius:12px;display:grid;place-content:center;text-align:center;gap:8px;padding:16px;color:var(--fg,inherit);background:color-mix(in srgb,var(--chrome,#222) 75%,transparent);transition:background .12s,border-color .12s,transform .12s}',
    '.sdc-zone b{font:800 22px/1.1 "Archivo",var(--ui,system-ui),sans-serif;font-stretch:85%}',
    '.sdc-zone span{font-size:12px;opacity:.8;max-width:260px;justify-self:center}',
    '.sdc-zone.hot{border-color:var(--sui-accent,var(--accent,#3b5bdb));border-style:solid;background:color-mix(in srgb,var(--sui-accent,var(--accent,#3b5bdb)) 16%,transparent);transform:scale(1.01)}',
    '@media (max-width:900px){.sdc-zones{grid-template-columns:1fr}}',
    '.sdc-back{position:fixed;inset:0;z-index:9500;display:grid;place-items:center;background:rgba(0,0,0,.35)}',
    '.sdc-dialog{box-sizing:border-box;width:min(380px,calc(100vw - 32px));display:grid;gap:12px;padding:18px;border-radius:10px;background:var(--sui-panel,var(--panel-2,#fff));color:var(--sui-text,var(--fg,#1b1b22));font:13px/1.4 system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.3)}',
    '.sdc-title{margin:0;font-size:15px;font-weight:600}',
    '.sdc-msg{margin:0;opacity:.85;word-break:break-word}',
    '.sdc-btns{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}',
    '.sdc-btn{font:inherit;padding:7px 12px;border-radius:6px;border:1px solid var(--sui-line,#c8c8d0);background:var(--sui-panel,#fff);color:inherit;cursor:pointer}',
    '.sdc-primary{background:var(--sui-accent,var(--accent,#3b5bdb));border-color:transparent;color:#fff}',
    '.sdc-btn:focus-visible{outline:2px solid var(--sui-accent,var(--accent,#3b5bdb));outline-offset:2px}',
  ].join('\n');

  function style() {
    if (doc.getElementById('sdc-style')) return;
    const s = doc.createElement('style');
    s.id = 'sdc-style'; s.textContent = CSS;
    doc.head.appendChild(s);
  }
  const isFiles = (e) => !!e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
  const text = (v) => (typeof v === 'function' ? v() : v);
  function el(tag, cls, t) {
    const x = doc.createElement(tag);
    if (cls) x.className = cls;
    if (t != null) x.textContent = t;
    return x;
  }

  /** The dialog. Resolves once: 'current', 'new', or null. */
  C.ask = function (o) {
    o = o || {};
    const files = Array.from(o.files || []);
    if (!files.length) return Promise.resolve(null);
    if (!o.hasDocument || !doc.body) return Promise.resolve('new');
    style();
    const L = Object.assign({}, DIALOG, o.labels || {});
    const names = files.length === 1 ? files[0].name : files.length + ' files';
    return new Promise((resolve) => {
      const prev = doc.activeElement;
      let settled = false;
      const back = el('div', 'sdc-back');
      const box = el('div', 'sdc-dialog');
      box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', L.title);
      const btn = (label, value, cls) => {
        const b = el('button', 'sdc-btn' + (cls ? ' ' + cls : ''), label);
        b.type = 'button';
        b.addEventListener('click', () => done(value));
        return b;
      };
      const cancel = btn(L.cancel, null, ''), nw = btn(L.new, 'new', ''), cur = btn(L.current, 'current', 'sdc-primary');
      const row = el('div', 'sdc-btns');
      row.append(cancel, nw, cur);
      box.append(el('p', 'sdc-title', L.title), el('p', 'sdc-msg', L.message + ' ' + names), row);
      back.append(box);
      function done(value) {
        if (settled) return;
        settled = true;
        doc.removeEventListener('keydown', onKey, true);
        back.remove();
        if (prev && prev.focus) prev.focus();
        resolve(value);
      }
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(null); return; }
        if (e.key !== 'Tab') return;
        // Tab stays inside the dialog: the three buttons, in order.
        const items = [cancel, nw, cur], i = items.indexOf(doc.activeElement);
        e.preventDefault(); e.stopPropagation();
        const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i < 0 || i === items.length - 1 ? 0 : i + 1);
        items[next].focus();
      }
      back.addEventListener('click', (e) => { if (e.target === back) done(null); });
      doc.addEventListener('keydown', onKey, true);
      doc.body.append(back);
      cur.focus();
    });
  };

  /** The drop-zone helper: two zones over host while a drag is over it. */
  C.zones = function (host, o) {
    if (!host) return null; // no host on this page: nothing to attach
    o = o || {};
    style();
    const L = Object.assign({}, ZONES, o.labels || {});
    const accept = o.accept || isFiles;
    if (root.getComputedStyle && root.getComputedStyle(host).position === 'static') host.style.position = 'relative';
    const box = el('div', 'sdc-zones');
    box.hidden = true; box.setAttribute('aria-hidden', 'true');
    const zone = (kind, title, hint) => { const z = el('div', 'sdc-zone'); z.dataset.choice = kind; z.append(el('b', null, title), el('span', null, text(hint))); return z; };
    box.append(zone('new', L.new, L.newHint), zone('current', L.current, L.currentHint));
    host.append(box);

    let depth = 0, shown = false, hot = 'new';
    const zoneOf = (e) => {
      const z = e.target && e.target.closest ? e.target.closest('[data-choice]') : null;
      return z && box.contains(z) ? z.dataset.choice : null;
    };
    const paint = () => {
      const hint = box.querySelector('[data-choice="current"] span');
      if (hint) hint.textContent = text(L.currentHint); // the document's name can change between drags
      box.querySelectorAll('[data-choice]').forEach((z) => z.classList.toggle('hot', z.dataset.choice === hot));
    };
    const show = () => { if (!shown) { shown = true; hot = 'new'; box.hidden = false; } };
    const hide = () => { depth = 0; shown = false; box.hidden = true; };
    const onEnter = (e) => { if (!accept(e)) return; depth++; show(); const z = zoneOf(e); if (z) hot = z; paint(); };
    const onOver = (e) => {
      if (!accept(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      const z = zoneOf(e);
      if (z && z !== hot) { hot = z; paint(); }
    };
    const onLeave = (e) => { if (!accept(e)) return; depth = Math.max(0, depth - 1); if (!depth) hide(); };
    const onDrop = (e) => { if (accept(e)) hide(); };
    host.addEventListener('dragenter', onEnter);
    host.addEventListener('dragover', onOver);
    host.addEventListener('dragleave', onLeave);
    host.addEventListener('drop', onDrop);
    return {
      at: (e) => (e ? zoneOf(e) : null),
      hide,
      destroy() {
        host.removeEventListener('dragenter', onEnter);
        host.removeEventListener('dragover', onOver);
        host.removeEventListener('dragleave', onLeave);
        host.removeEventListener('drop', onDrop);
        box.remove();
        hide();
      },
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
