/* SlopAIKit handoff: a request that belongs in another app continues there. Classic script; adds SlopAIKit.handoff.
 *   save({ to, toName, from, fromName, task, messages }) → the record, in sessionStorage 'slop-ai.handoff'. A tab opened
 *        with window.open gets a copy of this tab's sessionStorage, so the new app's page finds it (and the key of a
 *        provider connected for this tab only, and "allow for this visit" answers, which live there too).
 *   take(appId) → the record when it is for this app and fresh (10 minutes), removed so it runs once; peek(appId) reads it
 *   clear() · carry(messages) → the conversation as plain user/assistant text (no provider-specific parts: the new
 *        page has other tools), the steps as short lines, the last 40 messages
 * The shell's header (shell/header.js) opens the AI panel on a page that has a record for it; panel.js shows "Continued
 * from <app>" and sends the task as soon as a model is there (the provider chosen last comes back on its own). */
(function () {
  'use strict';
  const K = (window.SlopAIKit = window.SlopAIKit || {});
  const KEY = 'slop-ai.handoff', FRESH = 10 * 60 * 1000;
  const read = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };

  function carry(messages) {
    const out = [];
    const add = (role, text) => { const prev = out[out.length - 1]; if (prev && prev.role === role) prev.content += '\n' + text; else out.push({ role, content: text }); };
    for (const m of messages || []) {
      if (m.error || m.meter || m.handoff) continue;
      if (m.role === 'user') add('user', String(m.content || ''));
      else if (m.role === 'tool') add('assistant', `(${m.ok === false ? 'Failed' : 'Done'}: ${m.label || m.name})`);
      else if (m.role === 'assistant') { const t = String(m.display != null ? m.display : m.content || '').trim(); if (t) add('assistant', t); }
    }
    return out.slice(-40);
  }
  function save(rec) {
    const r = Object.assign({ at: Date.now() }, rec);
    try { sessionStorage.setItem(KEY, JSON.stringify(r)); } catch (e) { /* storage blocked: the new page starts fresh */ }
    return r;
  }
  function peek(appId) { const r = read(); return r && r.to === appId && Date.now() - (r.at || 0) < FRESH ? r : null; }
  function clear() { try { sessionStorage.removeItem(KEY); } catch (e) { /* nothing stored */ } }
  function take(appId) { const r = peek(appId); if (r) clear(); return r; }

  K.handoff = { save, take, peek, clear, carry, KEY };
})();
