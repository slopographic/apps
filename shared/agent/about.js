/* SlopAgentAbout: the "AI agents" note of every app (Help ▸ AI agents…, and Ctrl+K), with the site-wide setting
 * "Let AI agents use this app". Classic script, loaded by shared/agent/boot.js on first use; needs SlopUI.
 *   open()          the note in a SlopUI dialog
 *   note()          the note as a DOM fragment (the Settings page shows the same one)
 *   LINES           the plain-words text, one source for the dialog and Settings
 * An element with data-slop-agents-note gets the note when this script loads (the Settings page). */
(function (g) {
  'use strict';
  if (g.SlopAgentAbout) return;
  const LINES = [
    'Some browsers let an AI agent use the page you have open: an assistant built into the browser, or an app on your computer connected through a browser extension. The page tells the agent what it can do, and the agent asks the page to do it.',
    'Here an agent can run this app\'s commands, run File convert conversions and Slop Workflows on your files, and open, save to Slop Drive or download files.',
    'Your files stay on this device. The app gives the agent file names and ids and the results of what it ran; the work itself runs in this browser and the app uploads nothing. What the agent does with what it is told is up to the agent you use.',
    'Before anything that deletes, clears or replaces your work, the app asks you first.',
    'Browsers: Chrome 149 to 156 on slopographic.com while its WebMCP trial runs, or any recent Chrome with chrome://flags/#enable-webmcp-testing turned on. Edge has it behind a flag. Firefox and Safari do not have it yet. An agent on your computer (outside the browser) needs an extension that connects it to WebMCP, such as MCP-B.',
  ];
  const el = (tag, attrs, ...kids) => { const n = document.createElement(tag); for (const k in attrs || {}) n.setAttribute(k, attrs[k]); n.append(...kids); return n; };

  function note({ compact = false } = {}) {
    const A = g.SlopAgents, frag = document.createDocumentFragment();
    for (const t of compact ? LINES.slice(1, 4) : LINES) frag.append(el('p', {}, t));
    const status = el('p', { class: 'sag-status', role: 'status' });
    const box = el('input', { type: 'checkbox', id: 'sag-on' + Math.random().toString(36).slice(2, 6) });
    box.checked = !!(A && A.enabled());
    const show = () => {
      const on = !!(A && A.enabled()), here = !!(A && A.supported()), W = g.SlopWebMCP;
      status.textContent = !here ? 'This browser does not offer WebMCP, so no agent can use this app here.'
        : !on ? 'Off: no tools are offered to agents.'
          : `On: ${W ? W.tools().length : 0} tools are offered to agents on this page.`;
    };
    box.addEventListener('change', async () => { A.set(box.checked); await (box.checked ? A.start() : null); show(); });
    const label = el('label', { for: box.id, class: 'sag-toggle' }, box, ' Let AI agents use this app');
    frag.append(label, el('p', { class: 'sag-hint' }, 'The setting is for every Slopographic app in this browser. Turned off, the apps offer agents nothing.'), status);
    show();
    document.addEventListener('slop:agent-tools', show);
    return frag;
  }

  function open() {
    const body = el('div', { class: 'sag-note' });
    body.append(note());
    return g.SlopUI.dialog({ title: 'AI agents', body, buttons: [{ label: 'Close', primary: true }], dismissable: true });
  }

  g.SlopAgentAbout = { open, note, LINES };
  for (const host of document.querySelectorAll('[data-slop-agents-note]')) host.append(note());
})(window);
