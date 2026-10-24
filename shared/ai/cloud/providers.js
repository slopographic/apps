/* SlopAIKit cloud providers: who the person can connect with their own key, in plain words. Classic script; adds
 * SlopAIKit.cloud.providers (the list), byId(id), price(provider, model) → { input, output } $ per million tokens or
 * null, cost(usage, price) → $ or null, suggested(provider, models) → the few models offered first.
 * A provider: { id, name (in the menu), who (the company, for "goes to <who>"), format (cloud/<format>.js), base,
 *   needsKey, local (a server on this computer), editBase (the address can be changed), keyUrl, keyHint, models (the
 *   defaults shown before the list is fetched), prefer (patterns for the fetched list), prices, headers, test(cfg) }.
 * Prices are what we know for sure: Anthropic's published list (2026-10), and OpenRouter's, which its model list
 * carries. For the others the panel shows tokens only and says so. */
(function () {
  'use strict';
  const K = (window.SlopAIKit = window.SlopAIKit || {});
  const C = (K.cloud = K.cloud || {});
  const origin = () => { try { return location.origin; } catch (e) { return 'https://slopographic.com'; } };

  const list = [
    { id: 'anthropic', name: 'Claude (Anthropic)', who: 'Anthropic', short: 'Claude', format: 'anthropic', needsKey: true,
      keyUrl: 'https://platform.claude.com/settings/keys', keyHint: 'sk-ant-…', where: 'the Claude Console (platform.claude.com) › API keys',
      models: [{ id: 'claude-opus-5-5', name: 'Claude Opus 5.5', note: 'most capable' }, { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', note: 'fast and capable' }, { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5', note: 'fastest, cheapest' }],
      prefer: [/^claude-opus-5-5$/, /^claude-sonnet-5-5$/, /^claude-haiku-5-5$/],
      prices: { 'claude-opus-5-5': [4, 20], 'claude-sonnet-5-5': [2, 10], 'claude-haiku-5-5': [0.1, 0.5], 'claude-fable-5-1': [10, 50], 'claude-opus-5': [5, 25], 'claude-sonnet-5': [2, 10], 'claude-opus-4-8': [5, 25], 'claude-sonnet-4-6': [3, 15], 'claude-haiku-4-5': [1, 5] } },
    { id: 'openai', name: 'ChatGPT (OpenAI)', who: 'OpenAI', short: 'OpenAI', format: 'openai', needsKey: true,
      keyUrl: 'https://platform.openai.com/api-keys', keyHint: 'sk-…', where: 'platform.openai.com › API keys (a ChatGPT subscription is not an API key)',
      models: [{ id: 'gpt-6-astra', name: 'gpt-6-astra', note: 'recommended by OpenAI' }, { id: 'gpt-5.6-terra', name: 'gpt-5.6-terra', note: 'lower cost' }, { id: 'gpt-5.6-luna', name: 'gpt-5.6-luna', note: 'fastest, cheapest' }],
      prefer: [/^gpt-6-astra$/, /^gpt-5\.6-terra$/, /^gpt-5\.6-luna$/, /^gpt-6/, /^gpt-5/] },
    { id: 'gemini', name: 'Gemini (Google)', who: 'Google', short: 'Gemini', format: 'gemini', needsKey: true,
      keyUrl: 'https://aistudio.google.com/app/apikey', keyHint: 'AIza…', where: 'Google AI Studio › Get API key',
      models: [{ id: 'gemini-3.8-pro', name: 'Gemini 3.8 Pro', note: 'most capable' }, { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', note: 'fast' }, { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite', note: 'cheapest' }],
      prefer: [/^gemini-[\d.]+-pro$/, /^gemini-[\d.]+-flash$/, /^gemini-[\d.]+-flash-lite$/] },
    { id: 'openrouter', name: 'OpenRouter (many models, one key)', who: 'OpenRouter', short: 'OpenRouter', format: 'compat', needsKey: true,
      base: 'https://openrouter.ai/api/v1', keyUrl: 'https://openrouter.ai/keys', keyHint: 'sk-or-…', where: 'openrouter.ai › Keys',
      headers: { 'HTTP-Referer': origin(), 'X-OpenRouter-Title': 'Slopographic' }, maxTokens: 16000, toolsOnly: true,
      models: [], prefer: [/^anthropic\/claude-sonnet/, /^openai\/gpt-/, /^google\/gemini-[\d.]+-flash$/, /^anthropic\/claude-haiku/],
      /** The model list is public, so the key is checked on its own endpoint. */
      test: async (cfg) => { await C.call(cfg.base.replace(/\/+$/, '') + '/key', { headers: { authorization: 'Bearer ' + cfg.key }, signal: cfg.signal }, { secret: cfg.key, provider: cfg.provider }); } },
    { id: 'ollama', name: 'Ollama on this computer', who: 'Ollama on this computer', short: 'Ollama', format: 'compat', needsKey: false, local: true, editBase: true,
      base: 'http://localhost:11434/v1', models: [], prefer: [/qwen|llama|mistral|gemma/i] },
    { id: 'lmstudio', name: 'LM Studio on this computer', who: 'LM Studio on this computer', short: 'LM Studio', format: 'compat', needsKey: false, local: true, editBase: true,
      base: 'http://localhost:1234/v1', usageOption: false, models: [], prefer: [/./] },
    { id: 'custom', name: 'Another service (OpenAI-compatible address)', who: 'the service at the address you gave', short: 'Your service', format: 'compat', needsKey: false, keyOptional: true, editBase: true,
      base: '', models: [], prefer: [/./] },
  ];

  const byId = (id) => list.find((p) => p.id === id) || null;
  /** The address of a local or custom server is checked: http only for this computer, https anywhere. */
  function checkBase(url) {
    let u;
    try { u = new URL(String(url || '').trim()); } catch (e) { return 'Type the full address, for example http://localhost:11434/v1'; }
    if (u.protocol === 'https:') return '';
    if (u.protocol === 'http:' && /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])$/i.test(u.hostname)) return '';
    return 'Use an https:// address, or http://localhost for a server on this computer.';
  }

  function price(p, model, fetched) {
    if (fetched && fetched.price) return fetched.price;
    const row = p && p.prices && p.prices[model];
    return row ? { input: row[0], output: row[1] } : null;
  }
  const cost = (usage, pr) => (pr && usage ? ((usage.input || 0) * pr.input + (usage.output || 0) * pr.output) / 1e6 : null);

  /** The models offered first: the provider's preferred ones that the fetched list has, else its defaults. */
  function suggested(p, models) {
    if (!models || !models.length) return p.models.slice();
    const usable = models.filter((m) => m.tools !== false || !p.toolsOnly), out = [];
    for (const re of p.prefer || []) { const m = usable.find((x) => re.test(x.id) && !out.includes(x)); if (m) out.push(m); }
    return (out.length ? out : usable).slice(0, 4);
  }

  /** Plain help for a server on this computer: the one setting that lets this website talk to it. */
  function localHelp(p) {
    const site = origin();
    const chrome = 'Chrome and Edge ask once whether this website may connect to apps on your device (“Apps on device” or “local network access”). Choose Allow. If you blocked it, click the icon left of the address, open Site settings and allow it again.';
    if (p.id === 'ollama') return [`Ollama answers web pages only from the addresses you allow. Set OLLAMA_ORIGINS to ${site} and restart Ollama:`,
      `Mac: in Terminal, launchctl setenv OLLAMA_ORIGINS "${site}" then quit and open Ollama again.`,
      `Windows: Settings › System › About › Advanced system settings › Environment Variables, add OLLAMA_ORIGINS = ${site}, then restart Ollama.`,
      `Linux: sudo systemctl edit ollama.service, add Environment="OLLAMA_ORIGINS=${site}" under [Service], then sudo systemctl restart ollama.`, chrome,
      'Pick a model that can use tools (for example qwen3 or llama3.2); download it first with ollama pull <name>.'];
    if (p.id === 'lmstudio') return ['In LM Studio, open the Developer tab, start the server, and in its settings turn on “Enable CORS”, so web pages may use it.', chrome, 'Load a model that supports tool use.'];
    return ['The address must speak the OpenAI Chat Completions API (it ends in /v1 for most servers) and allow requests from this website (CORS).', chrome];
  }

  Object.assign(C, { providers: list, byId, price, cost, suggested, checkBase, localHelp });
})();
