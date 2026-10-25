/* SlopAIPermissions, the part people see (after permissions.js; needs SlopUI). Classic script; sets on window.SlopAIPermissions:
 *   prompt(req) → Promise<'once' | 'request' | 'visit' | 'always' | 'deny'>
 *       the question for one action. It names the action ("Crop, ratio 1:1"), the app and what kind of action it is, then
 *       offers Allow once · Allow for this request · Allow <kind> for this visit · Always allow <kind> in <app> · Deny.
 *       Closing it (×, Escape) is Deny.
 *   renderSettings(box, { app, appName, onChange }) → the panel's "AI permissions": the mode (three choices, the last
 *       with a plain warning) and the remembered "always allow" rules, each with Remove.
 *   modeControl() → a compact switch for the mode (a <select> with MODES' short labels) that the panel shows by the
 *       message box, as Claude Code shows its permission mode. Choosing "Allow everything" shows its warning first
 *       (Cancel keeps the mode); it follows a switch made anywhere else (the settings, another tab).
 * Styles are injected once (class names sap-perm-*), so any page with SlopUI can ask, not only the AI panel. */
(function (g) {
  'use strict';
  const P = g.SlopAIPermissions;
  if (!P || P.renderSettings) return;
  const CSS = `.sui-dlg.sap-perm-dlg { max-width: min(440px, calc(100vw - 24px)); }
.sap-perm-dlg .sui-foot { flex-direction: column; align-items: stretch; gap: 6px; }
.sap-perm-dlg .sui-foot .sui-btn { width: 100%; justify-content: center; margin: 0; }
.sap-perm-act { font-weight: 600; font-size: 15px; margin: 0 0 6px; word-break: break-word; }
.sap-perm-kind { opacity: .75; font-size: 12px; margin: 8px 0 0; }
.sap-perm { display: grid; gap: 8px; }
.sap-perm label { display: flex; gap: 8px; align-items: flex-start; cursor: pointer; }
.sap-perm label input { margin-top: 3px; }
.sap-perm-warn { color: #ff8a98; font-size: 12px; margin: 0 0 0 24px; }
.sap-perm-rules { display: grid; gap: 4px; margin: 0; padding: 0; list-style: none; }
.sap-mode { max-width: 11.5em; height: 28px; font-size: 12px; padding: 0 4px; border-radius: 6px; border: 1px solid var(--p-line, #8884); background: var(--p-input, transparent); color: inherit; }
.sap-mode.all { border-color: #ff8a98; }
.sap-perm-rules li { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 12.5px; }`;
  function style() {
    if (document.getElementById('sap-perm-css')) return;
    const s = document.createElement('style'); s.id = 'sap-perm-css'; s.textContent = CSS; document.head.append(s);
  }
  const el = (tag, attrs, ...kids) => { const n = document.createElement(tag); for (const k in attrs || {}) { if (attrs[k] == null || attrs[k] === false) continue; if (k === 'class') n.className = attrs[k]; else if (k.startsWith('on')) n.addEventListener(k.slice(2), attrs[k]); else n.setAttribute(k, attrs[k] === true ? '' : attrs[k]); } for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(c)); return n; };
  const kindName = (kind) => (P.KINDS[kind] || P.KINDS.delete).name;

  P.prompt = function (req) {
    if (!g.SlopUI || !g.SlopUI.dialog) return Promise.resolve(g.confirm(`${req.action}\n\n${req.detail || ''}`) ? 'once' : 'deny');
    style();
    const app = req.appName || 'this app', k = kindName(req.kind);
    const body = el('div', null,
      el('p', { class: 'sui-p sap-perm-act' }, req.action || 'An action'),
      req.detail ? el('p', { class: 'sui-p' }, req.detail) : null,
      el('p', { class: 'sui-p sap-perm-kind' }, `Kind of action: ${k}. ${req.step ? `Step ${req.step} of this request.` : ''}`.trim()));
    return new Promise((resolve) => {
      let choice = 'deny';
      const pick = (c) => () => { choice = c; };
      g.SlopUI.dialog({ title: req.title || `Allow this in ${app}?`, body, cls: 'sap-perm-dlg',
        buttons: [
          { label: 'Allow once', primary: true, act: pick('once') },
          { label: 'Allow for this request', act: pick('request') },
          { label: `Allow ${k} for this visit`, act: pick('visit') },
          { label: `Always allow ${k} in ${app}`, act: pick('always') },
          { label: 'Deny', act: pick('deny') },
        ],
        onClose: () => resolve(choice) });
    });
  };

  P.modeControl = function () {
    style();
    const sel = el('select', { class: 'sap-mode', 'aria-label': 'AI permissions', title: 'What Slop AI may do without asking' },
      P.MODES.map((m) => el('option', { value: m.id, title: m.note }, m.short || m.label)));
    const sync = () => { sel.value = P.mode(); sel.classList.toggle('all', sel.value === 'all'); };
    sel.addEventListener('change', async () => {
      const m = P.MODES.find((x) => x.id === sel.value);
      if (m && m.warning) {
        const ok = g.SlopUI && g.SlopUI.confirm ? await g.SlopUI.confirm(m.label + '?', m.warning, m.label, { danger: true }) : g.confirm(m.warning);
        if (!ok) return sync();
      }
      P.setMode(sel.value); sync();
    });
    g.addEventListener('slopaipermissions', sync);
    g.addEventListener('storage', (e) => { if (!e.key || /^slop-ai\.permissions/.test(e.key)) sync(); });
    sync();
    return sel;
  };

  P.renderSettings = function (box, o = {}) {
    style();
    const wrap = el('div', { class: 'sap-perm' });
    const draw = () => {
      wrap.textContent = '';
      const now = P.mode();
      wrap.append(el('b', null, 'AI permissions'),
        el('p', { class: 'sap-dim' }, 'What the assistant may do without asking. Reading and ordinary edits never ask, and “Undo all AI changes” works in every mode.'));
      for (const m of P.MODES) {
        const r = el('input', { type: 'radio', name: 'sap-perm-mode', value: m.id, checked: m.id === now || null, class: 'sap-perm-mode' });
        r.addEventListener('change', () => { P.setMode(m.id); draw(); if (o.onChange) o.onChange(m.id); });
        wrap.append(el('label', null, r, el('span', null, el('span', null, m.label), el('br'), el('span', { class: 'sap-dim' }, m.note))));
        if (m.warning && m.id === now) wrap.append(el('p', { class: 'sap-perm-warn', role: 'alert' }, m.warning));
      }
      const list = P.rules();
      wrap.append(el('b', null, 'Always allowed on this device'));
      if (!list.length) wrap.append(el('p', { class: 'sap-dim sap-perm-none' }, 'Nothing yet. Choose “Always allow …” when the assistant asks.'));
      else wrap.append(el('ul', { class: 'sap-perm-rules' }, list.map((r) => el('li', null, el('span', null, `${kindName(r.kind)[0].toUpperCase()}${kindName(r.kind).slice(1)} in ${r.appName || r.app}`),
        el('button', { type: 'button', class: 'sap-btn sap-perm-remove', 'data-kind': r.kind, 'data-app': r.app, onclick: () => { P.removeRule(r.kind, r.app); draw(); if (o.onChange) o.onChange(); } }, 'Remove')))));
    };
    draw();
    box.append(wrap);
    return wrap;
  };
})(window);
