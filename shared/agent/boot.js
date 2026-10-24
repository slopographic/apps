/* SlopAgents: lets AI agents use the app through WebMCP, the browser's model context (a W3C Web Machine Learning CG
 * draft; Chrome's origin trial). Classic script, loaded by shell/shell.js after the page has painted. window.SlopAgents:
 *   enabled() / set(on)   the site-wide setting "Let AI agents use this app" (localStorage 'slop.agents'; on by default,
 *                         only "off" is stored). Turning it off unregisters every tool at once; on registers them again.
 *   api()                 the model context: document.modelContext (current), else navigator.modelContext (the old name,
 *                         which the MCP-B polyfill and early Chrome builds still use), else null
 *   supported()           api() is there
 *   start()               the origin trial token for this origin (shared/agent/trial-tokens.json), then, when the API is
 *                         there and the setting is on, shared/agent/webmcp.js, which registers the tools
 *   about()               the Help note (shared/agent/about.js): what agents can do, in plain words, and the setting
 * Also adds the command "AI agents…" (Help) to the page's SlopCmd, so the note is in Ctrl+K and in Help menus. */
(function (g) {
  'use strict';
  if (g.SlopAgents) return;
  const SCRIPT = document.currentScript;
  const ROOT = SCRIPT && SCRIPT.src ? new URL('../../', SCRIPT.src).href : new URL('/', location.href).href;
  const KEY = 'slop.agents';
  const listeners = new Set();

  function enabled() { try { return localStorage.getItem(KEY) !== 'off'; } catch (e) { return true; } }
  function set(on) {
    try { if (on) localStorage.removeItem(KEY); else localStorage.setItem(KEY, 'off'); } catch (e) { /* storage blocked: this visit only */ }
    mem = !!on;
    for (const fn of listeners) try { fn(!!on); } catch (e) { console.warn(e); }
    if (on) start(); else if (g.SlopWebMCP) g.SlopWebMCP.stop();
    return !!on;
  }
  let mem = null;
  const isOn = () => (mem == null ? enabled() : mem);
  const api = () => (document.modelContext || (g.navigator && g.navigator.modelContext) || null);

  function script(rel) {
    return new Promise((res, rej) => {
      const src = new URL(rel, ROOT).href;
      if ([...document.scripts].some((s) => s.src === src && s.dataset.loaded)) { res(); return; }
      const s = Object.assign(document.createElement('script'), { src, async: false });
      s.onload = () => { s.dataset.loaded = '1'; res(); }; s.onerror = () => rej(new Error('Could not load ' + rel));
      document.head.append(s);
    });
  }

  /** The origin trial token of this origin, as <meta http-equiv="origin-trial">. The pages' heads carry it already
   * (tools/seo/write.mjs); this adds it to a page that does not (an app page outside the SEO writer). */
  let tokenP = null;
  function token() {
    if (tokenP) return tokenP;
    tokenP = (async () => {
      if (document.querySelector('meta[http-equiv="origin-trial"]')) return;
      if (!/^https:/.test(location.protocol)) return;
      const r = await fetch(new URL('shared/agent/trial-tokens.json', ROOT)).catch(() => null);
      const cfg = r && r.ok ? await r.json().catch(() => null) : null;
      for (const t of (cfg && cfg.tokens) || []) {
        if (t.origin !== location.origin || !t.token) continue;
        document.head.append(Object.assign(document.createElement('meta'), { httpEquiv: 'origin-trial', content: t.token }));
      }
    })();
    return tokenP;
  }

  let startP = null;
  function start() {
    if (!isOn()) return Promise.resolve(false);
    if (g.SlopWebMCP) return g.SlopWebMCP.refresh().then(() => true);
    if (startP) return startP;
    startP = (async () => {
      if (!api()) await token();
      if (!api() || !isOn()) return false;
      if (!g.SlopAgentTools) await script('shared/agent/tools.js');
      if (!g.SlopAgentWorkspace) await script('shared/agent/workspace.js');
      await script('shared/agent/webmcp.js');
      return !!g.SlopWebMCP;
    })().catch((e) => { console.warn('SlopAgents', e); return false; }).finally(() => { startP = null; });
    return startP;
  }

  function about() {
    return script('shared/agent/about.js').then(() => g.SlopAgentAbout.open()).catch((e) => { console.warn(e); if (g.SlopUI) g.SlopUI.toast('The note on AI agents could not open offline.'); });
  }
  /** Some apps load SlopCmd after the page: looked for again for a few seconds. */
  function command(tries = 0) {
    const C = g.SlopCmd;
    if (!C || !C.register) { if (tries < 10) setTimeout(() => command(tries + 1), 1000); return; }
    if (!C.get('agents.about')) C.register([{ id: 'agents.about', title: 'AI agents…', group: 'Help', ai: false, noRecent: true,
      keywords: ['agents', 'webmcp', 'mcp', 'ai', 'automation', 'assistant', 'privacy'], run: about }]);
  }

  g.SlopAgents = { KEY, ROOT, enabled: isOn, set, api, supported: () => !!api(), start, about, token, script,
    onChange: (fn) => { listeners.add(fn); return () => listeners.delete(fn); } };
  command();
  start();
})(window);
