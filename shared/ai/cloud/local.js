/* SlopAIKit cloud local: a model server on this computer or the network (Ollama, LM Studio, vLLM, llama.cpp, Jan,
 * LocalAI, KoboldCpp, text-generation-webui, any address). Classic script; adds SlopAIKit.cloud.local =
 *   { where(url) → 'this-computer' | 'network' | 'internet' | '', diagnose(p, base, { key, signal }), find({ signal }) }.
 * diagnose: what Test connection says for a typed address, one cause at a time, each with its fix for that server:
 *   'mixed'      an https page may not call plain http on another machine: said before trying (needs https: Tailscale
 *                Serve, Caddy, a tunnel)
 *   'permission' the request failed and Chrome's local network permission for this site is blocked (navigator.permissions,
 *                when it tells; asked only for a public page, as a page on this computer needs no permission)
 *   'cors'       the server answers but does not allow this website (a no-cors request reaches it; the real one is refused)
 *   'down'       nothing answers: not running, another port, or the browser's local network prompt was dismissed
 *   'path'       it answers, but there is no model list at that address (usually /v1 missing at the end)
 *   'key'        it wants a key (vLLM --api-key, LocalAI API_KEY…)    'none' no models loaded    'ok' with the models
 * → { ok, kind, message, fix: [lines], models, base (a corrected address for 'path') }
 * find(): only after a click (the request makes Chrome ask about the local network): asks the default port of every
 * local preset for its model list, at most 1.5 s each, and returns [{ port, ids (the presets on that port), base,
 * state: 'ok' | 'cors', models }] for the ports that answer. */
(function () {
  'use strict';
  const K = (window.SlopAIKit = window.SlopAIKit || {});
  const C = K.cloud;
  const LOOP = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|0\.0\.0\.0)$/i;
  const LAN = /^(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+|\[f[cd][0-9a-f:]*\]|\[fe80:[0-9a-f:]*\]|[^.]+\.local|[^.]+)$/i;
  const pageHttps = () => { try { return location.protocol === 'https:'; } catch (e) { return true; } };

  function where(url) {
    let u; try { u = new URL(String(url || '').trim()); } catch (e) { return ''; }
    return LOOP.test(u.hostname) ? 'this-computer' : LAN.test(u.hostname) ? 'network' : 'internet';
  }

  /** Chrome's permission for this site to reach local servers, when the browser says: 'granted' | 'denied' | 'prompt' | ''. */
  async function permission() {
    const P = typeof navigator !== 'undefined' && navigator.permissions;
    if (!P || !P.query) return '';
    for (const name of ['local-network-access', 'loopback-network', 'local-network']) {
      try { const s = await P.query({ name }); if (s && s.state) return s.state; } catch (e) { /* this browser does not know the name */ }
    }
    return '';
  }
  /** Does anything answer at all? A no-cors request is not stopped by CORS: it resolves (opaque) when a server is there. */
  async function reachable(url, signal) {
    try { await fetch(url, { mode: 'no-cors', signal }); return true; } catch (e) { return false; }
  }
  const timeout = (ms, outer) => {
    const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
    if (outer) outer.addEventListener('abort', () => c.abort(), { once: true });
    return { signal: c.signal, done: () => clearTimeout(t) };
  };
  const site = () => { try { return location.origin; } catch (e) { return 'https://slopographic.com'; } };
  const out = (kind, message, fix = [], extra = {}) => Object.assign({ ok: kind === 'ok', kind, message, fix, models: [] }, extra);

  async function diagnose(p, base, { key = '', signal } = {}) {
    const name = p.short || p.name, bad = C.checkBase(base), w = where(base);
    if (bad && /mixed content/.test(bad)) return out('mixed', bad, ['Tailscale: tailscale serve --bg <port> on that machine gives an https://<machine>.<tailnet>.ts.net address.', 'Caddy: a reverse proxy with its local certificate (tls internal) in front of the server.', 'A tunnel: cloudflared tunnel --url http://localhost:<port>, or ngrok http <port>, gives an https address.', 'Or run the server on this computer and use http://localhost.']);
    if (bad) return out('address', bad);
    const F = C.formats[p.format], cfg = { key, base, provider: p, signal };
    let list;
    try { list = await F.models(cfg); } catch (e) {
      if (e.kind === 'abort') throw e;
      if (e.kind === 'cors' || e.kind === 'network') {
        // the permission only matters for a public page (a page on this computer may always reach it), and only after a
        // refusal: some browsers report 'denied' for pages that never needed it
        if (w !== 'internet' && where(site()) === 'internet' && (await permission()) === 'denied')
          return out('permission', `This browser blocks ${site()} from reaching servers on your computer or network.`, ['Click the icon left of the address bar, open Site settings, and set “Apps on device” / “Local network access” to Allow. Then press Test connection again.']);
        const t = timeout(2500, signal), up = await reachable(C.endpoint(base, '/models'), t.signal); t.done();
        if (up) return out('cors', `${name} answers, but does not allow requests from this website (CORS).`, C.localHelp(p));
        return out('down', `Nothing answers at ${base}.`, [`Check that ${name} is running${p.port ? ` and listens on port ${p.port}` : ''}, and that the address is right.`, 'Chrome and Edge may ask whether this site may use apps on your device: choose Allow, then try again.', ...(p.start ? [p.start] : [])]);
      }
      if (e.kind === 'model' || e.status === 404 || e.status === 405) {
        const fixed = /\/v1\/?$/.test(base) ? '' : base.replace(/\/+$/, '') + '/v1';
        return out('path', `${name} answers, but has no model list at ${C.endpoint(base, '/models')}.`, [fixed ? `Most servers want /v1 at the end: try ${fixed}` : 'Check the path: the address is the part before /chat/completions.', 'The server must speak the OpenAI API (some need it switched on, see the help below).'], { base: fixed });
      }
      if (e.kind === 'key') return out('key', `${name} wants a key.`, ['Paste the key the server was started with (for example vLLM --api-key, LocalAI API_KEY) in the key field.']);
      return out(e.kind || 'error', e.message);
    }
    if (!list.length) return out('none', `${name} answers, but has no models loaded.`, p.pull ? [p.pull] : ['Load or download a model in the server first, then press Test connection again.']);
    return out('ok', `Connected to ${name}. ${list.length} model${list.length === 1 ? '' : 's'}.`, [], { models: list });
  }

  /** The default ports of the local presets, each asked once (two presets can share one: llama.cpp and LocalAI on 8080). */
  async function find({ signal } = {}) {
    const byPort = new Map();
    for (const p of C.providers.filter((x) => x.local && x.port)) {
      for (const port of [p.port, ...(p.altPorts || [])]) {
        const e = byPort.get(port) || { port, ids: [], base: p.base.replace(':' + p.port + '/', ':' + port + '/') };
        e.ids.push(p.id); byPort.set(port, e);
      }
    }
    const ask = async (e) => {
      const t = timeout(1500, signal), url = C.endpoint(e.base, '/models');
      try {
        const res = await fetch(url, { signal: t.signal });
        if (!res.ok) return null;
        const j = await res.json().catch(() => ({}));
        const models = (Array.isArray(j) ? j : j.data || j.models || []).map((m) => (typeof m === 'string' ? m : m.id || m.name)).filter(Boolean);
        return Object.assign({}, e, { state: 'ok', models });
      } catch (err) {
        if (t.signal.aborted) return null;
        return (await reachable(url, t.signal)) ? Object.assign({}, e, { state: 'cors', models: [] }) : null;
      } finally { t.done(); }
    };
    return (await Promise.all([...byPort.values()].map(ask))).filter(Boolean);
  }

  C.local = { where, diagnose, find, permission };
})();
