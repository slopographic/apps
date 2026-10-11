/* SlopDrop panel: the DOM the module draws. The drop zone (its message, a Choose files button, the progress list),
   the outlines and "Drop to add N files" label shown over each target while a file drag is over the window, and the toast.
   Colours come from the host's slopui tokens (--sui-*) with fallbacks. Attaches to window.SlopDrop.panel. */
(function (root) {
  'use strict';
  const SD = (root.SlopDrop = root.SlopDrop || {});
  const doc = root.document;
  const P = (SD.panel = {});
  const CSS = [
    '.sd-zone{display:grid;gap:8px;justify-items:center;text-align:center;color:var(--sui-muted,#5d5d6b)}',
    '.sd-zone p{margin:0;font-size:13px}',
    '.sd-choose{font:inherit;font-size:13px;padding:7px 12px;border:1px solid var(--sui-line,#d6d6de);border-radius:6px;background:var(--sui-panel,#fff);color:var(--sui-text,#1b1b22);cursor:pointer}',
    '.sd-choose:focus-visible{outline:2px solid var(--sui-accent,#3b5bdb);outline-offset:2px}',
    '.sd-list{list-style:none;margin:4px 0 0;padding:0;width:100%;display:grid;gap:6px;text-align:left}',
    '.sd-list:empty{display:none}',
    '.sd-row{display:grid;gap:3px;padding:6px 8px;border:1px solid var(--sui-line,#d6d6de);border-radius:6px;font-size:12px;color:var(--sui-text,#1b1b22);background:var(--sui-panel,#fff)}',
    '.sd-row-top{display:flex;justify-content:space-between;gap:8px;min-width:0}',
    '.sd-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}',
    '.sd-size,.sd-msg-row{color:var(--sui-muted,#5d5d6b);white-space:nowrap}',
    '.sd-bar{height:4px;border-radius:2px;background:var(--sui-track,#ececf1);overflow:hidden;position:relative}',
    '.sd-bar i{position:absolute;left:0;top:0;bottom:0;width:0;background:var(--sui-accent,#3b5bdb);transition:width .15s linear}',
    '.sd-bar.ind i{width:40%;animation:sd-slide 1s linear infinite}',
    '@keyframes sd-slide{from{left:-40%}to{left:100%}}',
    '.sd-row.ready .sd-msg-row{color:var(--sui-accent,#3b5bdb)}',
    '.sd-row.error{border-color:#c0392b}.sd-row.error .sd-msg-row{color:#c0392b}',
    '.sd-status{font-size:12px;margin:0;min-height:0}',
    '.sd-status:empty{display:none}',
    '.sd-compact{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px 12px;text-align:left}',
    '.sd-compact .sd-msg{flex:1 1 180px}',
    '.sd-compact .sd-list,.sd-compact .sd-status{flex-basis:100%}',
    '.sd-hint{position:fixed;z-index:9000;pointer-events:none;box-sizing:border-box;border:2px dashed var(--sui-accent,#3b5bdb);border-radius:8px;background:color-mix(in srgb,var(--sui-accent,#3b5bdb) 8%,transparent);display:flex;align-items:center;justify-content:center;padding:6px}',
    '.sd-hint b{background:var(--sui-accent,#3b5bdb);color:#fff;font:600 13px/1.3 system-ui,sans-serif;padding:6px 10px;border-radius:6px;max-width:90%;text-align:center}',
    '.sd-toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:9001;max-width:min(560px,calc(100vw - 32px));background:var(--sui-text,#1b1b22);color:var(--sui-panel,#fff);font:13px/1.4 system-ui,sans-serif;padding:9px 14px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.25);cursor:pointer}',
    '.sd-toast.warn{border-left:4px solid #e0a040}',
    '.sd-flash{animation:sd-flash 1.2s ease-out}',
    '@keyframes sd-flash{from{box-shadow:0 0 0 3px var(--sui-accent,#3b5bdb)}to{box-shadow:0 0 0 0 transparent}}',
  ].join('\n');

  function style() {
    if (doc.getElementById('sd-style')) return;
    const s = doc.createElement('style');
    s.id = 'sd-style'; s.textContent = CSS;
    doc.head.appendChild(s);
  }
  /** Replace the zone's content with the module's panel. Returns { list, msg, status, choose } (choose is the button). */
  P.build = function (zone, o) {
    style();
    const wrap = doc.createElement('div');
    wrap.className = 'sd-zone' + (o.compact ? ' sd-compact' : '');
    const msg = doc.createElement('p');
    msg.className = 'sd-msg';
    msg.textContent = o.label || 'Drop files here or choose files';
    wrap.append(msg);
    if (o.hint && !o.compact) { const h = doc.createElement('p'); h.textContent = o.hint; wrap.append(h); }
    const choose = doc.createElement('button');
    choose.type = 'button'; choose.className = 'sd-choose';
    choose.textContent = o.chooseLabel || 'Choose files';
    wrap.append(choose);
    const list = doc.createElement('ul');
    list.className = 'sd-list'; list.setAttribute('aria-label', 'Files being added');
    wrap.append(list);
    const status = doc.createElement('p');
    status.className = 'sd-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    wrap.append(status);
    zone.replaceChildren(wrap);
    return { list, msg, status, choose };
  };
  /** One file's row in the progress list. state: 'reading' | 'ready' | 'error'. Returns { progress(p), set(state, text) }. */
  P.row = function (list, name, size, text) {
    const li = doc.createElement('li');
    li.className = 'sd-row reading';
    const top = doc.createElement('div'); top.className = 'sd-row-top';
    const nm = doc.createElement('span'); nm.className = 'sd-name'; nm.textContent = name; nm.title = name;
    const sz = doc.createElement('span'); sz.className = 'sd-size'; sz.textContent = size;
    top.append(nm, sz);
    const bar = doc.createElement('div'); bar.className = 'sd-bar ind';
    const fill = doc.createElement('i'); bar.append(fill);
    const msg = doc.createElement('div'); msg.className = 'sd-msg-row'; msg.textContent = text || 'Reading…';
    li.append(top, bar, msg);
    list.append(li);
    return {
      el: li,
      progress(p) {
        if (!(p >= 0 && p <= 1)) return;
        bar.classList.remove('ind');
        fill.style.width = Math.round(p * 100) + '%';
      },
      set(state, t) {
        li.className = 'sd-row ' + state;
        msg.textContent = t;
        bar.hidden = state !== 'reading';
      },
    };
  };
  /** The toast: one at a time, shown for 6 s (click to dismiss). kind 'warn' adds an accent edge. */
  let toastEl = null, toastTimer = 0;
  P.toast = function (text, kind) {
    if (!doc.body) return;
    if (!toastEl) {
      toastEl = doc.createElement('div');
      toastEl.className = 'sd-toast'; toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite');
      toastEl.addEventListener('click', () => { toastEl.remove(); toastEl = null; });
      doc.body.append(toastEl);
    }
    toastEl.className = 'sd-toast' + (kind === 'warn' ? ' warn' : '');
    toastEl.textContent = text;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { if (toastEl) { toastEl.remove(); toastEl = null; } }, 6000);
  };
  /** Outline every target and label the first one. Called on each drag move, so the boxes follow the layout. */
  P.showHints = function (targets, label) {
    if (!P.hints) P.hints = [];
    P.hideHints();
    targets.forEach((el, i) => {
      if (!el || !el.getBoundingClientRect) return;
      const box = doc.createElement('div');
      box.className = 'sd-hint';
      if (i === 0 && label) { const b = doc.createElement('b'); b.textContent = label; box.append(b); }
      doc.body.append(box);
      P.hints.push({ box, el });
    });
    P.placeHints();
  };
  P.placeHints = function () {
    for (const h of P.hints || []) {
      const r = h.el.getBoundingClientRect();
      Object.assign(h.box.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    }
  };
  P.hideHints = function () {
    for (const h of P.hints || []) h.box.remove();
    P.hints = [];
  };
})(typeof window !== 'undefined' ? window : globalThis);
