/* SlopBridgeUI: the "Connect an AI app" dialog (the pairing code, Chrome's prompt in plain words) and the
 * "Claude Code is connected · Disconnect" indicator while a tab is paired (shared/agent/bridge.js). Classic script;
 * window.SlopBridgeUI; needs SlopUI. Loaded by SlopAgents.connect (shared/agent/boot.js).
 *   start({ ask, port }) → Promise: ask opens the dialog; without it, a paired tab connects again quietly (a reload)
 *   dialog({ port })     the dialog alone        pill()  the indicator, kept in step with the bridge */
(function (g) {
  'use strict';
  if (g.SlopBridgeUI) return;
  const B = g.SlopBridge, U = () => g.SlopUI;
  const el = (tag, attrs, ...kids) => { const n = document.createElement(tag); for (const k in attrs || {}) n.setAttribute(k, attrs[k]); n.append(...kids.filter((x) => x != null)); return n; };

  const css = `.sbr-pill{position:fixed;left:72px;bottom:34px;z-index:2147483000;display:flex;align-items:center;gap:8px;padding:6px 8px 6px 12px;border-radius:999px;
    background:var(--sui-bg,#232323);color:var(--sui-fg,#e6e6e6);border:1px solid var(--sui-line,#444);box-shadow:0 4px 18px rgba(0,0,0,.35);font:13px/1.3 system-ui,sans-serif}
    .sbr-dot{width:9px;height:9px;border-radius:50%;background:var(--sui-accent,#d4ff3a);box-shadow:0 0 8px var(--sui-accent,#d4ff3a)}
    .sbr-pill .sui-btn{height:24px;padding:0 10px}
    .sbr-dlg ol{margin:0 0 10px;padding-left:20px}.sbr-dlg li{margin:4px 0}
    .sbr-code{font:600 20px/1.2 ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;width:10ch;text-align:center}
    .sbr-status{min-height:1.3em;margin:8px 0 0;opacity:.85}.sbr-status[data-bad]{color:#ff8a8a;opacity:1}
    @media (max-width:640px){.sbr-pill{left:8px;right:8px;bottom:8px;justify-content:space-between}}`;
  function style() { if (!document.getElementById('sbr-css')) document.head.append(Object.assign(el('style', { id: 'sbr-css' }), { textContent: css })); }

  let pillEl = null;
  function pill() {
    style();
    const show = (s) => {
      if (s === 'paired') {
        if (!pillEl) {
          const btn = el('button', { type: 'button', class: 'sui-btn' }, 'Disconnect');
          btn.addEventListener('click', () => { B.disconnect(); if (U()) U().toast(`${B.client()} is disconnected. It can no longer use this tab.`); });
          pillEl = el('div', { class: 'sbr-pill', role: 'status', 'data-slop-bridge': '' }, el('span', { class: 'sbr-dot', 'aria-hidden': 'true' }), el('span', { class: 'sbr-text' }), btn);
          document.body.append(pillEl);
        }
        pillEl.querySelector('.sbr-text').textContent = `${B.client()} is connected`;
        pillEl.title = `${B.client()} on this computer can use this tab's tools (${B.tools().length}). Actions that delete or replace your work still ask you here.`;
      } else if (pillEl) {
        pillEl.remove(); pillEl = null;
        if (s === 'closed' && U()) U().toast(`${B.client()} disconnected (it stopped, or the session ended).`, 4000);
      }
    };
    B.on(show);
    show(B.state());
  }

  const LINES = {
    intro: 'An AI app on this computer (Claude Code, Codex, Cursor, VS Code, Claude Desktop and others) can use this app with its own commands: the same tools as the AI panel. Your files stay on this device; the page and the AI app talk over this computer only (127.0.0.1).',
    steps: [
      'In the AI app, connect to Slopographic. In Claude Code: /slopographic:slop-connect (after /plugin install slopographic@slopographic). It shows a code.',
      'Chrome may ask to let this site use apps and services on this device. Choose Allow: that is how this page reaches the AI app on this computer. Nothing on your network is contacted.',
      'Type the code here.',
    ],
    unreachable: 'No AI app answered on this computer. Start it, ask it to connect to Slopographic, then press Try again. If Chrome asked about apps on this device and you chose Block, allow it in the site settings (the icon left of the address).',
  };

  function dialog({ port = 0 } = {}) {
    style();
    const status = el('p', { class: 'sbr-status', role: 'status' });
    const input = el('input', { class: 'sui-input sbr-code', type: 'text', maxlength: '9', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Pairing code', placeholder: 'ABC-DEF' });
    const say = (t, bad) => { status.textContent = t; if (bad) status.setAttribute('data-bad', ''); else status.removeAttribute('data-bad'); };
    const body = el('div', { class: 'sbr-dlg' }, el('p', {}, LINES.intro), el('ol', {}, ...LINES.steps.map((t) => el('li', {}, t))),
      el('label', { class: 'sui-field' }, el('span', { class: 'sui-label' }, 'Code'), input), status);
    let d = null;
    async function reach() {
      say('Looking for the AI app on this computer…');
      const s = await B.connect({ port });
      if (s === 'paired') { done(); return true; }
      if (s === 'need-code') { say(`${B.client()} is there. Type the code it shows.`); input.focus(); return true; }
      say(s === 'refused' ? (B.detail().reason || 'The AI app refused this page.') : LINES.unreachable, true);
      return false;
    }
    function done() { if (d) d.close(true); if (U()) U().toast(`${B.client()} is connected. It can now use this tab.`, 3500); }
    const go = async () => {
      if (B.state() !== 'need-code') { await reach(); return false; }
      const code = input.value.trim();
      if (!code) { say('Type the code from the AI app.', true); return false; }
      if (g.SlopAgents && !g.SlopAgents.enabled()) g.SlopAgents.set(true);   // connecting is the person's own choice
      const r = await B.pair(code);
      if (r.ok) { done(); return false; }
      say(r.left != null ? `That code is not right. ${r.left} ${r.left === 1 ? 'try' : 'tries'} left.` : (r.reason || 'Pairing failed.'), true);
      input.select();
      return false;
    };
    d = U().dialog({ title: 'Connect an AI app', cls: 'sbr-dialog', body, dismissable: true,
      buttons: [{ label: 'Cancel', act: () => { if (B.state() !== 'paired') B.disconnect(); } }, { label: 'Connect', primary: true, act: go }] });
    reach();
    return d;
  }

  let pilled = false;
  async function start({ ask = false, port = 0 } = {}) {
    if (!pilled) { pilled = true; pill(); }
    if (B.state() === 'paired') { if (ask && U()) U().toast(`${B.client()} is already connected to this tab.`); return true; }
    if (ask) { dialog({ port }); return true; }
    const s = await B.connect({ port });
    if (s === 'need-code') B.disconnect();   // the AI app was restarted: pairing again is the person's choice
    return s === 'paired';
  }

  g.SlopBridgeUI = { start, dialog, pill, LINES };
})(window);
