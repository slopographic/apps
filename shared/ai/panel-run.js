/* Slop AI side panel, the run (loaded by panel.js; adds to SlopAIKit.panel): sending a message, the tool loop with
 * the app's commands, each tool call as a step ("Gaussian blur, radius 8 ✓"), Stop, plain errors, and
 * "Undo all AI changes" for the last request (SlopCmd.checkpoint() before it runs, the rollback after). */
(function () {
  'use strict';
  const K = window.SlopAIKit, P = K.panel;
  if (!P) return;
  const h = P.h;
  const MAX_STEPS = 6, MAX_CALLS = 12;

  const confirmFn = (title, msg) => (window.SlopUI && SlopUI.confirm ? SlopUI.confirm(title, msg, 'Allow') : Promise.resolve(window.confirm(title + '\n\n' + msg)));
  const stepText = (tool, call) => { try { return tool && tool.label ? tool.label(call.arguments || {}) : call.name; } catch (e) { return call.name; } };
  const ICON = { run: '…', ok: '✓', bad: '✗', stop: '■' };

  /** One message as DOM: a user bubble, an assistant reply (Markdown), or a step. */
  P.view = function (m) {
    if (m.role === 'tool') {
      const st = m.ok ? 'ok' : 'bad';
      return h('div', { class: 'sap-tool sap-step ' + st, title: String(m.content).slice(0, 400) },
        h('span', { class: 'sap-step-i', 'aria-hidden': 'true' }, ICON[st]), h('span', { class: 'sap-step-t' }, m.label || m.name),
        h('span', { class: 'sr-only' }, m.ok ? ' (done)' : ' (failed)'),
        !m.ok ? h('span', { class: 'sap-step-e' }, String(m.content).replace(/^ERROR:\s*/, '')) : null);
    }
    const d = h('div', { class: 'sap-msg ' + m.role + (m.error ? ' bad' : '') });
    const text = m.display != null ? m.display : m.content;
    if (m.role === 'assistant' && K.md && !m.error) d.innerHTML = K.md.render(text); else d.textContent = text;
    return d;
  };

  function systemPrompt(tools) {
    const name = P.appName();
    const lines = [`You are Slop AI, a helpful assistant inside ${name} on slopographic.com. It runs on the user's own device. Be brief.`];
    if (tools.length) {
      lines.push(`You control ${name} with the tools below. Call app_state first when you need to know what is open.`,
        'Plan the fewest steps. Use the tools that match the request directly, with arguments in the given ranges.',
        'You may put several <tool_call> lines in one reply; they run in order. After the results, answer in one short sentence.',
        'If a tool fails, say so plainly; do not invent results.');
    }
    return lines.join(' ');
  }

  function setBusy(on) {
    P.sendBtn.textContent = on ? 'Stop' : '↑';
    P.sendBtn.classList.toggle('stop', !!on);
    P.sendBtn.setAttribute('aria-label', on ? 'Stop' : 'Send');
  }
  P.stop = function () { if (P.busy) P.busy.abort(); };

  P.send = async function (text) {
    text = text != null ? String(text) : P.input.value.trim();
    if (!text || P.busy) return;
    const eng = P.engine();
    if (!eng) { P.render(); return; }
    P.input.value = '';
    P.messages.push({ role: 'user', content: text });
    P.undoBtn.hidden = true; P.rollback = null;
    P.render();
    const cmd = window.SlopCmd;
    const control = P.toolsBox.checked && !!cmd;
    if (control && cmd.prepare) { try { await cmd.prepare(); } catch (e) { console.warn('SlopCmd.prepare:', e); } }
    const tools = P.toolsBox.checked ? K.appTools.build({ cmd, appId: P.appId(), confirm: confirmFn }) : [];
    let rollback = null;
    try { rollback = control && cmd.checkpoint ? cmd.checkpoint() : null; } catch (e) { rollback = null; }
    let changed = 0;
    const live = h('div', { class: 'sap-live' }), reply = h('div', { class: 'sap-msg assistant live' });
    live.append(reply); P.list.append(live);
    P.busy = new AbortController(); setBusy(true);
    let pieces = '';
    const steps = new Map();
    try {
      const res = await K.tools.run(eng, [{ role: 'system', content: systemPrompt(tools) }, ...P.messages.filter((m) => !m.error && !m.note)], {
        tools, env: { confirm: confirmFn }, maxSteps: tools.length ? MAX_STEPS : 1, maxCalls: MAX_CALLS, temperature: 0.3, max_tokens: 640, signal: P.busy.signal,
        onDelta: (t) => { pieces += t; reply.innerHTML = K.md.render(pieces.replace(/<tool_call>[\s\S]*?(<\/tool_call>|$)/g, '').trim()); P.list.scrollTop = P.list.scrollHeight; },
        onTool: ({ phase, call, tool, res: r }) => {
          if (phase === 'start') {
            const row = h('div', { class: 'sap-tool sap-step run' }, h('span', { class: 'sap-step-i', 'aria-hidden': 'true' }, ICON.run), h('span', { class: 'sap-step-t' }, stepText(tool, call)));
            if (reply.textContent.trim()) live.insertBefore(reply.cloneNode(true), reply);   // what the model said before acting stays
            steps.set(call, row); live.insertBefore(row, reply); pieces = ''; reply.textContent = '';
          } else {
            if (r.ok && tool && (tool.cmdId || (tool.cmdIdOf && tool.cmdIdOf(call.arguments || {})))) changed++;
            const row = steps.get(call);
            if (row) row.replaceWith(P.view({ role: 'tool', ok: r.ok, name: call.name, label: stepText(tool, call), content: r.ok ? r.result : 'ERROR: ' + r.error }));
          }
          P.list.scrollTop = P.list.scrollHeight;
        },
      });
      // the steps keep their labels in the history (the model sees only name and result)
      for (const m of res.messages) if (m.role === 'tool') { const t = tools.find((x) => x.name === m.name); m.label = stepText(t, { name: m.name, arguments: m.args }); }
      P.messages.push(...res.messages);
      if (P.busy.signal.aborted) P.messages.push({ role: 'assistant', content: '', display: 'Stopped. The steps above that show ✓ were done.', note: true });
    } catch (e) {
      P.messages.push({ role: 'assistant', content: '', display: 'Something went wrong: ' + ((e && e.message) || e), error: true });
    }
    P.busy = null; setBusy(false);
    P.rollback = changed && typeof rollback === 'function' ? rollback : null;
    P.render();
    P.undoBtn.hidden = !P.rollback;
    if (P.rollback) P.undoBtn.textContent = `↶ Undo all AI changes (${changed})`;
  };

  P.undoAll = function () {
    const r = P.rollback;
    P.rollback = null; P.undoBtn.hidden = true;
    if (!r) return;
    let ok = true;
    try { ok = r() !== false; } catch (e) { ok = false; console.warn(e); }
    P.messages.push({ role: 'assistant', content: '', display: ok ? 'Undid every change from the last request.' : 'Could not undo: the document changed in another way since.', note: true, error: !ok });
    P.render();
  };
})();
