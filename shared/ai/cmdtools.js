/* SlopAIKit cmdTools: an app's SlopCmd commands as tools for the model. Classic script; adds SlopAIKit.cmdTools.
 *   cmdTools.build(cmd, { label, confirm }) → tools for SlopAIKit.tools.run:
 *     - one tool per command that has an args schema (shared/commands/args.js), named c.tool or from its id
 *       ('ps.ai.blur' → 'blur'); its arguments are checked and clamped against the schema before it runs
 *       (SlopCmd.exec), and the result says what was clamped or ignored
 *     - app_state: the app's own summary (SlopCmd.provide({ state })), when it has one
 *     - list_commands / run_command(id, args?): every other command, by id
 *   cmdTools.definitions(cmd) → OpenAI-style JSON-schema tool definitions [{ type: 'function', function: { name, description, parameters } }]
 *   cmdTools.specs(cmd, env) → the same tools provider-neutral, with inputSchema (JSON Schema) and readOnly / mayDestroy:
 *     what cloud engines and WebMCP (shared/agent/webmcp.js) take; inputSchema(tool) is the one schema maker
 *   cmdTools.isDestructive(c): c.destructive when the command sets it, else the words in its id/title (appTools.DESTRUCTIVE)
 *   cmdTools.label(c, args): 'Gaussian blur, radius 8', for the panel's step list
 * Tools carry cmdId, so the panel knows which steps changed the app (its "Undo all AI changes"). */
(function () {
  'use strict';
  const K = (window.SlopAIKit = window.SlopAIKit || {});
  const WORDS = /\b(delete|remove|trash|purge|clear|erase|empty|reset|close|discard|revert|overwrite|replace|wipe|destroy|new|flatten|merge|crop|quit)\b/i;
  const A = () => window.SlopCmdArgs || null;

  function isDestructive(c) {
    if (!c) return false;
    if (typeof c.destructive === 'boolean') return c.destructive;
    const re = (K.appTools && K.appTools.DESTRUCTIVE) || WORDS;
    return re.test(c.title || '') || re.test((c.id || '').replace(/[._-]/g, ' '));
  }
  /** Which approval a destructive command needs: 'delete' or 'change' (shared/ai/permissions.js, the one rule). */
  const kindOf = (c) => { const P = window.SlopAIPermissions; return P && P.kindOf ? P.kindOf(`${(c && c.id) || ''} ${(c && c.title) || ''}`) : 'delete'; };
  const toolName = (c) => (c.tool || String(c.id).replace(/^[a-z0-9]+\./i, '')).replace(/\W+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
  const plainTitle = (c) => String(c.title || c.id).replace(/…$/, '').split(' › ').pop();
  function label(c, args) {
    const a = A();
    return a && c.args ? a.summary(plainTitle(c), c.args, a.validate(c.args, args || {}).args) : plainTitle(c);
  }
  function listAll(cmd) {
    try { return (cmd.list() || []).filter((c) => !/^cmd\./.test(c.id)); } catch (e) { return []; }
  }
  const usable = (c) => c.enabled !== false && (!c.when || (() => { try { return c.when(); } catch (e) { return false; } })());
  /** For tools.describe: { name: { type, description, required, hint } } from a schema. */
  function params(schema) {
    const a = A(), out = {};
    for (const p of a ? a.normalize(schema) : []) out[p.name] = { type: p.type, description: p.description || '', required: !!p.required && p.default === undefined, hint: a.hint(p).replace(/^\w+ ?/, '') };
    return out;
  }
  function said(c, r) {
    const bits = [`Done: ${label(c, r.args)}.`];
    if (r.notes && r.notes.length) bits.push('Note: ' + r.notes.join('; ') + '.');
    if (r.value != null && r.value !== true && r.value !== false) bits.push(typeof r.value === 'string' ? r.value : JSON.stringify(r.value));
    return bits.join(' ');
  }
  /** Runs a command with arguments: SlopCmd.exec when the page has it, else the plain run(id). */
  async function exec(cmd, c, args) {
    if (cmd.exec) {
      const r = await cmd.exec(c.id, args || {}, { source: 'ai' });
      if (!r.ok) throw new Error(r.error || `${plainTitle(c)} did not run`);
      return said(c, r);
    }
    if (cmd.run(c.id, { source: 'ai', args: args || {} }) === false) throw new Error(`${plainTitle(c)} is not available right now`);
    return `Ran “${c.title || c.id}”.`;
  }

  function build(cmd, env = {}) {
    if (!cmd || !cmd.list || !(cmd.run || cmd.exec)) return [];
    const where = env.label || 'this app', all = listAll(cmd), names = new Set(['app_state', 'list_commands', 'run_command']);
    const confirmText = (c) => `The assistant wants to run “${c ? plainTitle(c) : 'a command'}” in ${where}. This may change or remove your work.`;
    const tools = [];
    for (const c of all) {
      if (!c.args || c.ai === false) continue;
      let name = toolName(c);
      while (names.has(name)) name += '_';
      names.add(name);
      tools.push({ name, cmdId: c.id, description: c.description || plainTitle(c), params: params(c.args),
        schema: A() ? A().jsonSchema(c.args) : { type: 'object', properties: {} },
        destructive: () => isDestructive(c), kind: () => kindOf(c), confirmText: () => confirmText(c), label: (a) => label(c, a),
        run: (a) => exec(cmd, c, a) });
    }
    if (cmd.state) {
      tools.unshift({ name: 'app_state', description: `A short JSON summary of ${where} right now (document, layers, selection…). Call it first.`, params: {}, maxChars: 6000, label: () => 'Read the app state',
        run: () => cmd.state() || `${where} shares no state.` });
    }
    const byId = (id) => listAll(cmd).find((c) => c.id === id) || null;
    tools.push(
      { name: 'list_commands', description: `List the other commands of ${where} that can run now (id, title, and the arguments a command takes).`, params: {}, label: () => 'List the commands',
        run: () => listAll(cmd).filter(usable).filter((c) => !c.hidden || c.args).map((c) => (c.args && A() ? { id: c.id, title: c.title, args: A().normalize(c.args).map((p) => `${p.name}: ${A().hint(p)}`) } : { id: c.id, title: c.title, group: c.group || '' })) },
      { name: 'run_command', description: `Run one command of ${where} by its id (ids from list_commands), with optional arguments.`,
        params: { id: { type: 'string', description: 'command id', required: true }, args: { type: 'object', description: 'arguments, when the command takes any' } },
        destructive: (a) => isDestructive(byId(a.id) || { id: a.id }), kind: (a) => kindOf(byId(a.id) || { id: a.id }), confirmText: (a) => confirmText(byId(a.id) || { id: a.id }),
        label: (a) => { const c = byId(a.id); return c ? label(c, a.args) : String(a.id); },
        cmdIdOf: (a) => a.id,
        run: (a) => {
          const c = byId(a.id);
          if (!c || !usable(c)) throw new Error(`No command "${a.id}" right now. Use list_commands.`);
          return exec(cmd, c, a.args && typeof a.args === 'object' ? a.args : {});
        } });
    return tools;
  }

  /** A tool's input as JSON Schema: its args schema (args.js), else one made from its params map. */
  function inputSchema(t) {
    if (t.schema) return t.schema;
    const params = t.params || {};
    return { type: 'object', properties: Object.fromEntries(Object.entries(params).map(([k, p]) => [k, Object.assign({ type: p.type === 'object' ? 'object' : 'string' }, p.description ? { description: p.description } : {})])),
      required: Object.keys(params).filter((k) => params[k].required) };
  }
  function definitions(cmd) {
    return build(cmd).filter((t) => t.schema || t.params).map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: inputSchema(t) } }));
  }
  const READ_ONLY = new Set(['app_state', 'list_commands']);
  /** The same tools, provider-neutral (for cloud engines and WebMCP, shared/agent/): { name, description, inputSchema,
   * readOnly, untrusted (it returns the app's own content), mayDestroy, destructive(args), confirmText(args), cmdId, run(args) }. */
  function specs(cmd, env = {}) {
    return build(cmd, env).map((t) => ({ name: t.name, description: t.description, inputSchema: inputSchema(t), cmdId: t.cmdId || null,
      readOnly: READ_ONLY.has(t.name), untrusted: t.name === 'app_state', mayDestroy: t.name === 'run_command' || (!!t.destructive && !!t.destructive({})),
      destructive: t.destructive || false, kind: t.kind || null, confirmText: t.confirmText, run: t.run }));
  }

  K.cmdTools = { build, definitions, specs, inputSchema, isDestructive, kindOf, label, toolName };
})();
