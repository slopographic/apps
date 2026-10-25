/* SlopAIKit cloud providers: who the person can connect with their own key, in plain words. Classic script; adds to
 * SlopAIKit.cloud: providers (every catalog entry, normalized), byId(id), GROUPS, FORMATS, price(provider, model) →
 * { input, output, cacheRead } $ per million tokens or null, cost(usage, price) → $ or null (cache reads and writes priced), suggested(provider, models) → the few
 * models offered first, search(query) → the matching providers best first, resolve(p, values) → { url, missing },
 * baseFor(p, saved), endpoint(base, path), authHeaders(cfg), checkBase(url), localHelp(p).
 * The entries themselves are data in cloud/catalog/*.js (one file per group, see catalog/main.js for the fields). They
 * push into K.cloud.catalog, so they may load before or after this file; each entry is normalized once, on first use:
 *   needsKey / keyOptional from auth ('bearer' default, 'none', 'optional', or { header, prefix }), who / short from
 *   name, editBase for an address the person types, test() from testPath (OpenRouter's key check), usable (false when
 *   the browser cannot call it: cors 'needs-proxy'); chat (false for a picture-only provider).
 * One code path per API format: FORMATS maps the catalog's format to its file (openai-chat → compat.js, openai-responses
 * → openai.js); a provider adds no code of its own. Prices are what we know for sure: Anthropic's published list
 * (2026-10) and OpenRouter's, which its model list carries. For the others the panel shows tokens only and says so. */
(function () {
  'use strict';
  const K = (window.SlopAIKit = window.SlopAIKit || {});
  const C = (K.cloud = K.cloud || {});
  C.formats = C.formats || {};
  const raw = (C.catalog = C.catalog || []);
  const origin = () => { try { return location.origin; } catch (e) { return 'https://slopographic.com'; } };

  const GROUPS = [{ id: 'main', name: 'Main' }, { id: 'fast', name: 'Fast inference' }, { id: 'open-models', name: 'Open models' },
    { id: 'cloud', name: 'Clouds' }, { id: 'local', name: 'Local on this computer' }, { id: 'images', name: 'Images' }, { id: 'other', name: 'More' }];
  /** Chat formats: catalog name → the file in cloud/ that speaks it. Picture formats are spoken by shared/ai/imagegen. */
  const FORMATS = { anthropic: 'anthropic', 'openai-responses': 'openai', 'openai-chat': 'compat', gemini: 'gemini' };
  const IMAGE_FORMATS = ['openai-images', 'fal', 'replicate', 'stability', 'bfl', 'ideogram', 'recraft', 'runpod-sync'];
  for (const [name, file] of Object.entries(FORMATS)) {
    if (name !== file && !Object.getOwnPropertyDescriptor(C.formats, name)) Object.defineProperty(C.formats, name, { get: () => C.formats[file], configurable: true });
  }

  function norm(p) {
    if (p._n) return p;
    const auth = p.auth || 'bearer';
    Object.assign(p, { _n: true, who: p.who || p.name, short: p.short || p.name, models: p.models || [], prefer: p.prefer || [/./], caps: p.caps || {},
      needsKey: auth !== 'none' && auth !== 'optional', keyOptional: auth === 'optional', chat: !!FORMATS[p.format] });
    p.usable = p.cors !== 'needs-proxy';   // a picture-only provider can be chosen: its key is kept for AI pictures
    if (p.local || p.anyAddress) p.editBase = true;
    if (p.testPath && !p.test) p.test = async (cfg) => { await C.call(endpoint(cfg.base, p.testPath), { headers: authHeaders(cfg), signal: cfg.signal }, { secret: cfg.key, provider: cfg.provider }); };
    return p;
  }
  const order = (p) => GROUPS.findIndex((g) => g.id === p.group);
  const all = () => raw.map(norm).sort((a, b) => order(a) - order(b) || (a.rank || 50) - (b.rank || 50));
  Object.defineProperty(C, 'providers', { get: all, configurable: true });
  const byId = (id) => { const p = raw.find((x) => x.id === id); return p ? norm(p) : null; };

  /** A templated base URL filled in: { url, missing: [the labels of empty fields] }. Values are URL-encoded. */
  function resolve(p, values = {}) {
    const missing = [];
    const url = String(p.base || '').replace(/\{(\w+)\}/g, (m, k) => {
      const f = (p.fields || []).find((x) => x.id === k) || { label: k };
      const v = String(values[k] != null && values[k] !== '' ? values[k] : f.default || '').trim();
      if (!v) { missing.push(f.label); return m; }
      return encodeURIComponent(v);
    });
    return { url, missing };
  }
  /** The base a request uses: the typed address (local, any address), else the template with the saved fields. */
  const baseFor = (p, saved = {}) => (p.editBase ? saved.base || p.base || '' : resolve(p, saved.fields).url);
  /** base + path, with a query in the base (Azure's ?api-version=…) kept at the end. */
  function endpoint(base, path) {
    const s = String(base || ''), i = s.indexOf('?');
    return (i < 0 ? s : s.slice(0, i)).replace(/\/+$/, '') + path + (i < 0 ? '' : s.slice(i));
  }
  /** The key's header: Authorization: Bearer by default, or the provider's own ({ header: 'api-key' } for Azure). */
  function authHeaders(cfg) {
    const p = (cfg && cfg.provider) || {}, a = p.auth;
    const h = Object.assign({}, p.headers || {});
    if (!cfg.key) return h;
    if (a && typeof a === 'object') h[a.header] = (a.prefix || '') + cfg.key;
    else h.authorization = 'Bearer ' + cfg.key;
    return h;
  }

  /** Search over names, aliases, ids, the company and model names. Empty query: every provider. */
  function search(query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return all();
    const words = q.split(/\s+/);
    const score = (p) => {
      const name = p.name.toLowerCase(), hay = [p.id, p.who, ...(p.aliases || [])].join(' ').toLowerCase();
      const models = [...p.models.map((m) => m.id + ' ' + (m.name || '')), ...(p.modelHints || [])].join(' ').toLowerCase();
      let s = 0;
      for (const w of words) {
        if (name.startsWith(w) || p.id.startsWith(w)) s += 8; else if (name.includes(w)) s += 5; else if (hay.includes(w)) s += 4; else if (models.includes(w)) s += 2; else return 0;
      }
      return s;
    };
    return all().map((p) => [p, score(p)]).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1] || order(a[0]) - order(b[0])).map((x) => x[0]);
  }

  /** The address of a local or custom server: https anywhere, plain http only to this computer. An https page may not
   * call plain http on another machine (mixed content), so that is said before trying. */
  function checkBase(url) {
    let u;
    try { u = new URL(String(url || '').trim()); } catch (e) { return 'Type the full address, for example http://localhost:11434/v1'; }
    if (u.protocol === 'https:') return '';
    if (u.protocol === 'http:' && /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])$/i.test(u.hostname)) return '';
    if (u.protocol === 'http:') return `${u.host} is another machine, and this page is https, so the browser blocks plain http to it (mixed content). Use an https:// address, or http://localhost for a server on this computer. To reach a server on your network over https: Tailscale Serve, Caddy with a local certificate, or a tunnel (cloudflared, ngrok).`;
    return 'Use an https:// address, or http://localhost for a server on this computer.';
  }

  function price(p, model, fetched) {
    if (fetched && fetched.price) return fetched.price;
    const row = p && p.prices && p.prices[model];
    return row ? { input: row[0], output: row[1], cacheRead: row[2] != null ? row[2] : row[0] * 0.1 } : null;
  }
  /** $ for a reply: cached input at the cache price (0.1× input when unknown), cache writes at 1.25× input. */
  function cost(u, pr) {
    if (!pr || !u) return null;
    const read = u.cacheRead || 0, wrote = u.cacheWrite || 0, plain = Math.max(0, (u.input || 0) - read - wrote);
    const cr = pr.cacheRead != null ? pr.cacheRead : pr.input * 0.1;
    return (plain * pr.input + read * cr + wrote * pr.input * 1.25 + (u.output || 0) * pr.output) / 1e6;
  }

  /** The models offered first: the provider's preferred ones that the fetched list has, else its defaults. */
  function suggested(p, models) {
    if (!models || !models.length) return p.models.slice();
    const usable = models.filter((m) => m.tools !== false || !p.toolsOnly), out = [];
    for (const re of p.prefer || []) { const m = usable.find((x) => re.test(x.id) && !out.includes(x)); if (m) out.push(m); }
    return (out.length ? out : usable).slice(0, 4);
  }

  const CHROME = 'Chrome and Edge ask once whether this website may connect to apps on your device (“Apps on device” or “Local network access”). Choose Allow. If you blocked it, click the icon left of the address, open Site settings and allow it again.';
  /** Plain help for a server on this computer: the entry's own setup lines ({site} = this website), then Chrome's prompt. */
  function localHelp(p) {
    const site = origin(), lines = (p.setup || ['The address must speak the OpenAI Chat Completions API (it ends in /v1 for most servers) and allow requests from {site} (CORS).']).map((t) => t.split('{site}').join(site));
    return [...lines, CHROME, ...(p.after || [])];
  }

  Object.assign(C, { byId, GROUPS, FORMATS, IMAGE_FORMATS, price, cost, suggested, search, resolve, baseFor, endpoint, authHeaders, checkBase, localHelp, norm });
})();
