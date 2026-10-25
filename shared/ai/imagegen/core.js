/* SlopAIKit imageGen core: who can make pictures with the person's own key, which models, what sizes, and what it
 * costs. Classic script, no DOM (the Node tests run it in a vm); adds SlopAIKit.imageGen.
 * The keys are the ones the person already gave the AI panel (shared/ai/cloud/keys.js): no second key store.
 *   providers                 → the image providers, by the cloud provider id whose key they use (cloud/providers.js)
 *   byId(id) · models(id, fetched) · model(id, modelId)
 *   size(aspect, resolution)  → { w, h } in px for the providers that take pixel sizes (OpenAI and compatible servers)
 *   estimate(req)             → { perImage ($ or null), total, exact (published price) , note } before generating
 *   costOf(provider, model, usage, req) → $ or null, from what the provider reported
 *   settings() · save(s)      → the last choices (localStorage 'slop-ai.imagegen'; never a key)
 *   register(p)               → the hook for more providers, e.g. an on-device model (see HANDOFF.md, "Local")
 * Prices are the providers' published lists (checked 2026-10-24): OpenAI's image tokens ($8 in, $30 out per million,
 * text in $5) and its per-image table for GPT Image 2; Google's per-image prices by size; OpenRouter's from its list. */
(function () {
  'use strict';
  const K = (window.SlopAIKit = window.SlopAIKit || {});
  const SETTINGS = 'slop-ai.imagegen';
  const ASPECTS = ['1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16', '21:9'];
  const RESOLUTIONS = ['1K', '2K', '4K'];
  const STYLES = { none: '', photo: 'a realistic photograph', illustration: 'a clean digital illustration', painting: 'a painting with visible brush strokes',
    '3d': 'a 3D render', 'pixel-art': 'pixel art', 'line-art': 'black line art on white', anime: 'anime style', watercolor: 'a watercolour painting' };
  const GPT_TOKENS = { text: 5, image: 8, out: 30 };   // $ per million tokens, every GPT Image 2 / 2.5 model
  // GPT Image 2's published price per image: quality → [square, portrait, landscape] at 1024², 1024×1536, 1536×1024
  const GPT2_TABLE = { low: [0.006, 0.005, 0.005], medium: [0.053, 0.041, 0.041], high: [0.211, 0.165, 0.165] };

  const list = [
    { id: 'openai', format: 'openai', who: 'OpenAI', short: 'OpenAI', needsKey: true, mask: true, transparent: true, maxN: 10, quality: ['low', 'medium', 'high'],
      models: [{ id: 'gpt-image-2.5-flare', name: 'GPT Image 2.5 Flare', note: 'fast, everyday pictures' },
        { id: 'gpt-image-2.5-sunburst', name: 'GPT Image 2.5 Sunburst', note: 'most precise edits' },
        { id: 'gpt-image-2', name: 'GPT Image 2', note: 'published price per picture' }],
      help: 'OpenAI may ask you to verify your organization (platform.openai.com › Settings › Organization) before its picture models work.' },
    { id: 'gemini', format: 'gemini', who: 'Google', short: 'Gemini', needsKey: true, mask: false, transparent: false, maxN: 4,
      models: [{ id: 'gemini-nano-banana-2.1', name: 'Nano Banana 2.1', note: 'recommended by Google', sizes: { '1K': 0.0336, '2K': 0.0504, '4K': 0.113 }, input: 1.5 },
        { id: 'gemini-3.1-flash-lite-image', name: 'Gemini 3.1 Flash-Lite Image', note: 'cheapest, 1K only', sizes: { '1K': 0.0336 }, input: 0.25 },
        { id: 'gemini-3-pro-image', name: 'Gemini 3 Pro Image', note: 'most capable', sizes: { '1K': 0.134, '2K': 0.134, '4K': 0.24 }, input: 2 }],
      help: 'Every picture Gemini makes carries Google’s invisible SynthID watermark.' },
    { id: 'openrouter', format: 'openrouter', who: 'OpenRouter', short: 'OpenRouter', needsKey: true, mask: false, transparent: true, maxN: 4, quality: ['low', 'medium', 'high'],
      models: [{ id: 'google/gemini-nano-banana-2.1', name: 'Google: Nano Banana 2.1' }, { id: 'openai/gpt-image-2.5-flare', name: 'OpenAI: GPT Image 2.5 Flare' },
        { id: 'black-forest-labs/flux-3-image', name: 'Black Forest Labs: FLUX 3 Image' }],
      help: 'OpenRouter passes the request to the model’s maker; its price list is shown with each model.' },
    { id: 'ollama', format: 'openai', who: 'Ollama on this computer', short: 'Ollama', needsKey: false, local: true, mask: true, transparent: false, maxN: 4, models: [], free: true },
    { id: 'lmstudio', format: 'openai', who: 'LM Studio on this computer', short: 'LM Studio', needsKey: false, local: true, mask: true, transparent: false, maxN: 4, models: [], free: true },
    { id: 'custom', format: 'openai', who: 'the service at the address you gave', short: 'Your service', needsKey: false, mask: true, transparent: true, maxN: 4, models: [] },
  ];
  const extra = [];
  const all = () => list.concat(extra);
  const byId = (id) => all().find((p) => p.id === id) || null;
  /** The models offered: the fetched list (OpenRouter's image models) when there is one, else the defaults. */
  const models = (id, fetched) => { const p = byId(id); return p ? (fetched && fetched.length ? fetched : p.models) : []; };
  const model = (id, mid, fetched) => (models(id, fetched).find((m) => m.id === mid) || (byId(id) || { models: [] }).models.find((m) => m.id === mid) || null);
  /** More providers (an on-device model, another service). p: { id, name, who, short, local, generate(req) → { images, usage } }. */
  function register(p) { if (!p || !p.id || byId(p.id)) return false; extra.push(Object.assign({ format: 'custom', models: [], maxN: 1, mask: false, transparent: false }, p)); return true; }

  const r16 = (x) => Math.max(16, Math.round(x / 16) * 16);
  /** Pixel size for an aspect ratio at 1K/2K/4K, inside OpenAI's limits (multiples of 16, 655,360 to 8,294,400 px,
   * edges up to 3840, ratio at most 3:1). The three standard sizes come out exactly: 1024², 1536×1024, 1024×1536. */
  function size(aspect = '1:1', res = '1K') {
    const [a, b] = String(aspect).split(':').map(Number), ratio = a > 0 && b > 0 ? Math.min(3, Math.max(1 / 3, a / b)) : 1;
    const long = ratio === 1 ? { '1K': 1024, '2K': 2048, '4K': 2880 }[res] || 1024 : { '1K': 1536, '2K': 2560, '4K': 3840 }[res] || 1536;
    let w = ratio >= 1 ? long : long * ratio, h = ratio >= 1 ? long / ratio : long;
    w = r16(w); h = r16(h);
    const MAX = 8294400, MIN = 655360;
    if (w * h > MAX) { const s = Math.sqrt(MAX / (w * h)); w = Math.floor((w * s) / 16) * 16; h = Math.floor((h * s) / 16) * 16; }
    if (w * h < MIN) { const s = Math.sqrt(MIN / (w * h)); w = r16(w * s + 8); h = r16(h * s + 8); }
    return { w, h };
  }

  const shape = (aspect) => { const [a, b] = String(aspect || '1:1').split(':').map(Number); return a === b ? 0 : a < b ? 1 : 2; };
  /** What a request will cost before it is sent, when the provider publishes a price; note says why not otherwise. */
  function estimate(req, fetched) {
    const p = byId(req.provider), n = Math.max(1, Number(req.n) || 1);
    const out = (perImage, exact, note) => ({ perImage, total: perImage == null ? null : perImage * n, exact: !!exact, note: note || '' });
    if (!p) return out(null, false, 'unknown provider');
    if (p.free || p.local) return out(0, true, 'runs on your computer');
    const m = model(p.id, req.model, fetched) || {};
    if (p.id === 'openai') {
      const q = GPT2_TABLE[req.quality] ? req.quality : 'medium', px = req.w && req.h ? req.w * req.h : size(req.aspect, req.resolution).w * size(req.aspect, req.resolution).h;
      if (/^gpt-image-2(-\d{4}-\d\d-\d\d)?$/.test(m.id || req.model)) {
        const base = GPT2_TABLE[q][shape(req.aspect)], std = px <= 1572864;
        return out(std ? base : base * (px / 1572864), std, std ? '' : 'estimated from the 1024 px price');
      }
      return out(null, false, `billed by tokens ($${GPT_TOKENS.out} per million picture tokens); the cost is shown after`);
    }
    if (p.id === 'gemini') {
      const v = m.sizes && (m.sizes[req.resolution || '1K'] || null);
      return out(v, v != null, v == null ? 'this size has no published price' : '');
    }
    if (m.price && m.price.image > 0) return out(m.price.image, true, '');
    return out(null, false, 'billed by the model’s own rate; the cost is shown after');
  }

  /** The cost of a finished request from the provider's usage report (null when it cannot be known). */
  function costOf(pid, mid, u, req = {}) {
    const p = byId(pid);
    if (!p || !u) return null;
    if (p.free || p.local) return 0;
    if (u.cost != null) return Number(u.cost);
    if (p.id === 'openai') {
      const d = u.input_details || {}, img = d.image_tokens || 0, txt = d.text_tokens != null ? d.text_tokens : Math.max(0, (u.input || 0) - img);
      return (txt * GPT_TOKENS.text + img * GPT_TOKENS.image + (u.output || 0) * GPT_TOKENS.out) / 1e6;
    }
    if (p.id === 'gemini') {
      const m = model(pid, mid) || {}, per = m.sizes && m.sizes[req.resolution || '1K'];
      return per == null ? null : per * (u.images || 1) + ((u.input || 0) * (m.input || 0)) / 1e6;
    }
    return null;
  }

  const BLANK = () => ({ provider: '', models: {}, aspect: '1:1', resolution: '1K', quality: 'medium', style: 'none' });
  function settings() { try { return Object.assign(BLANK(), JSON.parse(localStorage.getItem(SETTINGS)) || {}); } catch (e) { return BLANK(); } }
  function save(s) {
    const clean = {};
    for (const k of Object.keys(BLANK())) if (s && s[k] !== undefined) clean[k] = s[k];
    try { localStorage.setItem(SETTINGS, JSON.stringify(Object.assign(settings(), clean))); } catch (e) { /* storage blocked: this visit only */ }
  }
  /** The prompt with the chosen style, in plain words the models follow. */
  const promptOf = (prompt, style) => (STYLES[style] ? `${String(prompt).trim()}\n\nStyle: ${STYLES[style]}.` : String(prompt).trim());

  const G = (K.imageGen = K.imageGen || {});
  Object.defineProperty(G, 'providers', { get: all, configurable: true });
  Object.assign(G, { byId, models, model, register, size, estimate, costOf, settings, save, promptOf, ASPECTS, RESOLUTIONS, STYLES, GPT2_TABLE, GPT_TOKENS, SETTINGS });
})();
