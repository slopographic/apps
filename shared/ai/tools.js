/* SlopAIKit tools: prompt-based tool calling that works with any small model. Classic script; adds SlopAIKit.tools.
 * A tool: { name, description, params: { arg: { type, description, required } }, destructive?: bool | (args) => bool, run(args) }
 * The model calls one by replying  <tool_call>{"name": "open_app", "arguments": {"id": "paint"}}</tool_call>
 * Results go back as a user message that starts with "TOOL RESULT (name):".
 *   prepare(messages, tools)   → messages for the engine (tool help in the system prompt; roles normalised)
 *   parse(text, tools)         → { text, calls: [{ name, arguments }] }
 *   dispatch(call, tools, env) → { ok, result | error }     env.confirm(title, message) → Promise<bool>
 *   run(engine, messages, { tools, env, onDelta, onTool, maxSteps, maxCalls, ...chatOpts }) → the agent loop
 *       (onTool({ phase: 'start' | 'end', call, tool, res }); an aborted signal stops between actions) */
(function () {
  'use strict';
  const K = (window.SlopAIKit = window.SlopAIKit || {});

  function describe(tools) {
    const lines = tools.map((t) => {
      const ps = Object.entries(t.params || {}).map(([k, p]) => `${k}${p.required ? '' : '?'}: ${p.type || 'string'}${p.hint ? ' ' + p.hint : ''}`).join(', ');
      return `- ${t.name}(${ps}): ${t.description}`;
    });
    return ['You can use these tools:', ...lines, '',
      'To use a tool, reply with exactly one line and nothing else:',
      '<tool_call>{"name": "TOOL_NAME", "arguments": {"ARG": "VALUE"}}</tool_call>',
      'Then wait. You will get a message that starts with "TOOL RESULT". Use it to answer in plain words.',
      'Only call a tool when the user asks for an action. Never invent tool names.'].join('\n');
  }

  /** Engines get plain system/user/assistant messages: one system message first, tool results as user messages,
   * consecutive same-role messages merged (some chat templates require alternation), and a user message last. */
  function prepare(messages, tools) {
    let sys = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
    if (tools && tools.length) sys = (sys ? sys + '\n\n' : '') + describe(tools);
    const out = [];
    for (const m of messages) {
      if (m.role === 'system') continue;
      const role = m.role === 'tool' ? 'user' : m.role === 'assistant' ? 'assistant' : 'user';
      const content = m.role === 'tool' ? `TOOL RESULT (${m.name || 'tool'}): ${m.content}` : String(m.content == null ? '' : m.content);
      const prev = out[out.length - 1];
      if (prev && prev.role === role) prev.content += '\n\n' + content; else out.push({ role, content });
    }
    return sys ? [{ role: 'system', content: sys }, ...out] : out;
  }

  /** Lenient JSON: accepts single quotes and trailing commas, which small models produce. */
  function loose(s) {
    try { return JSON.parse(s); } catch (e) { /* try repairs */ }
    try { return JSON.parse(s.replace(/,\s*([}\]])/g, '$1').replace(/'([^'\\]*)'/g, '"$1"')); } catch (e) { return null; }
  }
  function norm(o, names) {
    if (!o || typeof o !== 'object') return null;
    if (o.function && typeof o.function === 'object') o = o.function;
    const name = o.name || o.tool || o.tool_name;
    if (typeof name !== 'string' || (names && !names.includes(name))) return null;
    let args = o.arguments != null ? o.arguments : o.parameters != null ? o.parameters : o.args != null ? o.args : {};
    if (typeof args === 'string') args = loose(args) || {};
    return { name, arguments: args && typeof args === 'object' ? args : {} };
  }
  function parse(text, tools) {
    const names = tools ? tools.map((t) => t.name) : null, calls = [];
    let rest = String(text || '');
    rest = rest.replace(/<tool_call>\s*([\s\S]*?)\s*(?:<\/tool_call>|$)/g, (all, body) => {
      const o = norm(loose(body.replace(/^```(?:json)?|```$/g, '').trim()), names);
      if (o) { calls.push(o); return ''; }
      return all;
    });
    if (!calls.length) {
      // a fenced ```json {"name": …}``` block, or a bare JSON object as the whole reply
      rest = rest.replace(/```(?:json|tool_call)?\s*(\{[\s\S]*?\})\s*```/g, (all, body) => { const o = norm(loose(body), names); if (o) { calls.push(o); return ''; } return all; });
      const t = rest.trim();
      if (!calls.length && t.startsWith('{') && t.endsWith('}')) { const o = norm(loose(t), names); if (o) { calls.push(o); rest = ''; } }
    }
    return { text: rest.replace(/\n{3,}/g, '\n\n').trim(), calls };
  }

  // A tool may set maxChars when its whole answer must arrive (list_apps is JSON that the model parses).
  const clip = (s, n = 4000) => (s.length > (n || 4000) ? s.slice(0, n || 4000) + `… (${s.length - (n || 4000)} more characters)` : s);
  async function dispatch(call, tools, env = {}) {
    const t = tools.find((x) => x.name === call.name);
    if (!t) return { ok: false, error: `Unknown tool "${call.name}". Available: ${tools.map((x) => x.name).join(', ')}` };
    const args = call.arguments || {};
    for (const [k, p] of Object.entries(t.params || {})) if (p.required && (args[k] == null || args[k] === '')) return { ok: false, error: `Missing argument "${k}" for ${t.name}` };
    const destructive = typeof t.destructive === 'function' ? t.destructive(args) : !!t.destructive;
    if (destructive) {
      const what = t.confirmText ? t.confirmText(args) : `The assistant wants to run ${t.name}(${JSON.stringify(args)}).`;
      const ok = env.confirm ? await env.confirm('Allow this action?', what) : false;
      if (!ok) return { ok: false, error: 'The user said no to this action.' };
    }
    try {
      const r = await t.run(args, env);
      return { ok: true, result: clip(typeof r === 'string' ? r : JSON.stringify(r == null ? 'ok' : r), t.maxChars) };
    } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
  }

  /** The agent loop: chat, run any tool calls, feed the results back, repeat (maxSteps).
   * Returns { text, messages (the new assistant/tool messages), usage, steps }. */
  async function run(engine, messages, { tools = [], env = {}, onDelta, onTool, maxSteps = 4, maxCalls = 12, ...chatOpts } = {}) {
    const added = [], stopped = () => !!(chatOpts.signal && chatOpts.signal.aborted);
    let usage = null, text = '', calls = 0;
    for (let step = 0; step < maxSteps; step++) {
      const stream = engine.chat([...messages, ...added], Object.assign({}, chatOpts, { tools, stream: true }));
      let done = null;
      for await (const c of stream) { if (c.type === 'delta') { if (onDelta) onDelta(c.text, step); } else done = c; }
      usage = done.usage; text = done.text;
      added.push({ role: 'assistant', content: done.raw, display: done.text, toolCalls: done.toolCalls, usage });
      if (!done.toolCalls.length || done.aborted) break;
      for (const call of done.toolCalls) {
        if (stopped()) break;
        if (++calls > maxCalls) { text += '\n\n(Stopped: at most ' + maxCalls + ' actions per request.)'; break; }
        const tool = tools.find((x) => x.name === call.name) || null;
        if (onTool) onTool({ phase: 'start', call, tool });
        const res = await dispatch(call, tools, env);
        if (onTool) onTool({ phase: 'end', call, res, tool });
        added.push({ role: 'tool', name: call.name, content: res.ok ? res.result : 'ERROR: ' + res.error, ok: res.ok, args: call.arguments });
      }
      if (stopped() || calls > maxCalls) break;
      if (step === maxSteps - 1) text += '\n\n(Stopped after ' + maxSteps + ' tool steps.)';
    }
    return { text, messages: added, usage };
  }

  K.tools = { describe, prepare, parse, dispatch, run, loose };
})();
