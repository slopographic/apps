/* SlopWebMCP: registers the page's tools with the browser's model context, so an AI agent in the browser (or a desktop
 * agent through the MCP-B extension) can use the app. Loaded by shared/agent/boot.js only when the API is there and the
 * setting is on. Classic script; window.SlopWebMCP. The tools are never written per app: they are the one tool list of
 *   the Slop AI panel and the cloud engines (shared/ai/apptools.js appTools.build with the operations, optools.js, and the
 *   page's SlopCmd commands, cmdtools.js), made provider-neutral by cmdTools.neutral, plus open_file and download
 *   (shared/agent/workspace.js), and turned into WebMCP tools by shared/agent/tools.js.
 * They are registered again when what the app offers changes: a command registered or removed, a command that becomes
 * available or not (its when()), a dialog of the app opening or closing (the command tools wait while one is open).
 * A destructive call (delete, clear, overwrite, new…) asks the person first: through the agent's own interaction hook
 * (requestUserInteraction, which some agents and older builds pass to execute; the current draft has none) around the
 * app's own SlopUI dialog.
 *   refresh() → Promise   build and register again now (only when something changed; force: true always)
 *   stop()                unregister every tool (the setting turned off)
 *   tools()               the tools as registered (name, description, inputSchema, annotations, execute)
 *   definitions()         the neutral definitions they came from
 *   ready                 resolves once the first set is registered (after SlopCmd.prepare(), the app's AI commands) */
(function (g) {
  'use strict';
  if (g.SlopWebMCP) return;
  const T = g.SlopAgentTools, W = g.SlopAgentWorkspace, A = g.SlopAgents;
  let current = [], defsNow = [], sig = '', handles = [], ctrl = null, busy = 0, stopped = false, timer = 0;

  const appName = () => { const a = g.SlopShell && g.SlopShell.currentApp; return (a && a.name) || document.title.split(/[|–—-]/)[0].trim() || 'this app'; };
  const dialogOpen = () => !!(g.SlopUI && g.SlopUI.openDialogs > 0);
  function usable(id) {
    const c = g.SlopCmd && g.SlopCmd.get(id);
    try { return !!c && (!c.when || !!c.when()); } catch (e) { return false; }
  }

  /** The page's SlopCmd, once it is there (some apps load it late): the AI panel's tool builder, the app's AI commands
   * (SlopCmd.provide({ prepare }): PhotoSlop loads them only when an assistant needs them) and its change events. */
  let cmdP = null, hooked = false;
  function hookCmd() {
    const C = g.SlopCmd;
    if (!C || hooked) return cmdP || Promise.resolve();
    if (!cmdP) cmdP = (async () => {
      if (C.prepare) await Promise.resolve(C.prepare()).catch(() => null);
      if (C.on) for (const ev of ['change', 'run', 'open', 'close']) C.on(ev, schedule);
      hooked = true;
      schedule();
    })().catch((e) => { console.warn('WebMCP: the app commands could not load', e); });
    return cmdP;
  }

  const appId = () => (g.SlopHub && g.SlopHub.self && g.SlopHub.self.app) || ((g.SlopShell && g.SlopShell.currentApp) || {}).id || '';
  function build() {
    hookCmd();
    const K = g.SlopAIKit, name = appName();
    let defs = K.appTools.build({ cmd: hooked ? g.SlopCmd : null, ops: true, appId: appId() }).map(K.cmdTools.neutral)
      .filter((d) => !d.cmdId || usable(d.cmdId));
    const isCmd = (d) => !!d.cmdId || d.name === 'run_command';
    if (dialogOpen() && !busy) defs = defs.filter((d) => !isCmd(d) || d.readOnly);   // the app waits on the person
    return T.unique(defs.concat(W ? W.defs({ app: name }) : []));
  }

  async function confirm(text, client) {
    const ask = () => (g.SlopUI && g.SlopUI.confirm
      ? g.SlopUI.confirm('Allow this AI agent action?', text, 'Allow', { danger: true })
      : Promise.resolve(g.confirm(text)));
    if (client && typeof client.requestUserInteraction === 'function') return !!(await client.requestUserInteraction(ask));
    return !!(await ask());
  }
  /** Keeps re-registration out of a running call (its own dialog would otherwise change the tool set under it). */
  function wrap(tool) {
    const run = tool.execute;
    tool.execute = async (input, client) => { busy++; try { return await run(input, client); } finally { busy--; schedule(); } };
    return tool;
  }

  /** The current API (spec of Oct 2026, Chrome 152+): registerTool(tool, { signal }) and no unregister call: aborting the
   * signal removes the tool. Chrome 146–149 builds also had unregisterTool(name), and the first drafts provideContext. */
  function unregisterAll() {
    const mc = A.api();
    if (ctrl) { ctrl.abort(); ctrl = null; }
    if (mc && typeof mc.unregisterTool === 'function') for (const n of handles) try { mc.unregisterTool(n); } catch (e) { /* already gone */ }
    handles = [];
  }
  function apply(tools) {
    const mc = A.api();
    if (!mc) return;
    if (typeof mc.registerTool === 'function') {
      unregisterAll();
      ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      const opts = ctrl ? { signal: ctrl.signal } : undefined;
      for (const t of tools) {
        const warn = (e) => console.warn('WebMCP: could not register ' + t.name, e);
        try { Promise.resolve(mc.registerTool(t, opts)).catch(warn); handles.push(t.name); } catch (e) { warn(e); }
      }
    } else if (typeof mc.provideContext === 'function') mc.provideContext({ tools });
  }

  function signature(defs) {
    return JSON.stringify(defs.map((d) => [d.name, d.description, T.schemaOf(d), !!d.readOnly, T.mayDestroy(d)]));
  }
  async function refresh({ force = false } = {}) {
    if (stopped || !A.enabled() || !A.api()) return current;
    if (busy && !force) return current;
    const defs = build(), s = signature(defs);
    if (!force && s === sig) return current;
    sig = s; defsNow = defs;
    current = defs.map((d) => wrap(T.toWebMCP(d, { confirm })));
    apply(current);
    document.dispatchEvent(new CustomEvent('slop:agent-tools', { detail: { count: current.length, names: current.map((t) => t.name) } }));
    return current;
  }
  function schedule() { if (timer) return; timer = setTimeout(() => { timer = 0; refresh(); }, 120); }

  function stop() {
    stopped = true;
    const mc = A.api();
    unregisterAll();
    if (mc && typeof mc.clearContext === 'function' && typeof mc.registerTool !== 'function') try { mc.clearContext(); } catch (e) { /* none */ }
    current = []; defsNow = []; sig = '';
    document.dispatchEvent(new CustomEvent('slop:agent-tools', { detail: { count: 0, names: [] } }));
  }

  // What changes the tool set: commands registered or removed, a command run, the palette, dialogs, files coming in,
  // and the app's own state, which only shows in its commands' when(): checked again after input, and every few seconds
  // while the page is visible (only a changed set is registered again).
  for (const ev of ['slop:intake-after', 'slop:agent-tools-stale']) document.addEventListener(ev, schedule);
  for (const ev of ['pointerup', 'keyup', 'focusin']) g.addEventListener(ev, schedule, { passive: true, capture: true });
  let lastDialog = dialogOpen();
  if (typeof MutationObserver === 'function') new MutationObserver(() => { if (dialogOpen() !== lastDialog) { lastDialog = dialogOpen(); schedule(); } }).observe(document.body, { childList: true });
  setInterval(() => { if (!document.hidden) refresh(); }, 3000);

  g.SlopWebMCP = {
    refresh: (o) => { stopped = false; return refresh(Object.assign({ force: true }, o)); },
    stop, tools: () => current.slice(), definitions: () => defsNow.slice(), ready: null,
  };
  g.SlopWebMCP.ready = hookCmd().then(() => refresh({ force: true }));
})(window);
