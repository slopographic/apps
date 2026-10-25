/* SlopAIKit catalog: the local models Slop AI offers. Classic script; adds SlopAIKit.catalog.
 * Ids are WebLLM prebuilt ids (vendor/web-llm prebuiltAppConfig.model_list, v0.2.86); vramMB and lowResource are
 * copied from there. sizeMB is the approximate one-time download (weights + tokenizer + kernels).
 * f32Id is the q4f32 build for GPUs without shader-f16. */
(function () {
  'use strict';
  const K = (window.SlopAIKit = window.SlopAIKit || {});
  const LIC = {
    llama: { name: 'Llama 3.2 Community License', short: 'Llama community', url: 'https://www.llama.com/llama3_2/license/', commercial: 'yes, under 700M monthly users' },
    apache: { name: 'Apache License 2.0', short: 'Apache 2.0', url: 'https://www.apache.org/licenses/LICENSE-2.0', commercial: 'yes' },
    qwenResearch: { name: 'Qwen Research License', short: 'Qwen research', url: 'https://huggingface.co/Qwen/Qwen2.5-3B-Instruct/blob/main/LICENSE', commercial: 'no (research and personal use)' },
    mit: { name: 'MIT License', short: 'MIT', url: 'https://huggingface.co/microsoft/Phi-3.5-mini-instruct/blob/main/LICENSE', commercial: 'yes' },
    gemma: { name: 'Gemma Terms of Use', short: 'Gemma terms', url: 'https://ai.google.dev/gemma/terms', commercial: 'yes, with the use policy' },
  };
  const M = (id, o) => Object.assign({ id, maker: '', params: 0, sizeMB: 0, vramMB: 0, ctx: 4096, lowResource: false, f16: true, strengths: [], blurb: '' }, o);
  const list = [
    M('Qwen2.5-0.5B-Instruct-q4f16_1-MLC', { name: 'Qwen2.5 0.5B', maker: 'Alibaba Qwen', params: 0.5, sizeMB: 290, vramMB: 944.62, lowResource: true, license: LIC.apache,
      f32Id: 'Qwen2.5-0.5B-Instruct-q4f32_1-MLC', vram32: 1060.2, strengths: ['tiny', 'fast'], blurb: 'Tiny and quick. Fine for short answers and Sloppo jokes, weak at reasoning.' }),
    M('Llama-3.2-1B-Instruct-q4f16_1-MLC', { name: 'Llama 3.2 1B', maker: 'Meta', params: 1.2, sizeMB: 700, vramMB: 879.04, lowResource: true, license: LIC.llama,
      f32Id: 'Llama-3.2-1B-Instruct-q4f32_1-MLC', vram32: 1128.82, strengths: ['fast', 'chat'], blurb: 'Small, fast, friendly chat. Runs on almost any WebGPU laptop.' }),
    M('Qwen2.5-1.5B-Instruct-q4f16_1-MLC', { name: 'Qwen2.5 1.5B', maker: 'Alibaba Qwen', params: 1.5, sizeMB: 880, vramMB: 1629.75, lowResource: true, license: LIC.apache,
      f32Id: 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC', vram32: 1888.97, strengths: ['balanced', 'multilingual', 'tools'], blurb: 'The best all-rounder for small GPUs. Follows tool instructions well.' }),
    M('Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC', { name: 'Qwen2.5 Coder 1.5B', maker: 'Alibaba Qwen', params: 1.5, sizeMB: 880, vramMB: 1629.75, license: LIC.apache,
      f32Id: 'Qwen2.5-Coder-1.5B-Instruct-q4f32_1-MLC', vram32: 1888.97, strengths: ['code', 'mini-apps'], blurb: 'Small coding model. Good first choice for "Build a mini-app".' }),
    M('gemma-2-2b-it-q4f16_1-MLC', { name: 'Gemma 2 2B', maker: 'Google', params: 2.6, sizeMB: 1500, vramMB: 1895.3, license: LIC.gemma,
      f32Id: 'gemma-2-2b-it-q4f32_1-MLC', vram32: 2508.75, strengths: ['writing', 'chat'], blurb: 'Natural writing style for its size. English first.' }),
    M('Llama-3.2-3B-Instruct-q4f16_1-MLC', { name: 'Llama 3.2 3B', maker: 'Meta', params: 3.2, sizeMB: 1800, vramMB: 2263.69, lowResource: true, license: LIC.llama,
      f32Id: 'Llama-3.2-3B-Instruct-q4f32_1-MLC', vram32: 2951.51, strengths: ['chat', 'summaries', 'tools'], blurb: 'Noticeably smarter than 1B, still light. Great default on 8 GB machines.' }),
    M('Qwen2.5-3B-Instruct-q4f16_1-MLC', { name: 'Qwen2.5 3B', maker: 'Alibaba Qwen', params: 3.1, sizeMB: 1750, vramMB: 2504.76, lowResource: true, license: LIC.qwenResearch,
      f32Id: 'Qwen2.5-3B-Instruct-q4f32_1-MLC', vram32: 2893.64, strengths: ['reasoning', 'multilingual', 'tools'], blurb: 'Strong 3B. Its licence is research/personal use only.' }),
    M('Phi-3.5-mini-instruct-q4f16_1-MLC', { name: 'Phi-3.5 mini', maker: 'Microsoft', params: 3.8, sizeMB: 2150, vramMB: 3672.07, license: LIC.mit,
      f32Id: 'Phi-3.5-mini-instruct-q4f32_1-MLC', vram32: 5483.12, strengths: ['reasoning', 'maths', 'code'], blurb: 'Punches above its size at reasoning. Needs a 4 GB GPU budget.' }),
    M('Qwen2.5-7B-Instruct-q4f16_1-MLC', { name: 'Qwen2.5 7B', maker: 'Alibaba Qwen', params: 7.6, sizeMB: 4300, vramMB: 5106.67, license: LIC.apache,
      f32Id: 'Qwen2.5-7B-Instruct-q4f32_1-MLC', vram32: 5900.09, strengths: ['smartest', 'tools', 'multilingual'], blurb: 'The smartest here. Needs a real GPU with 6 GB or more.' }),
    M('Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC', { name: 'Qwen2.5 Coder 7B', maker: 'Alibaba Qwen', params: 7.6, sizeMB: 4300, vramMB: 5106.67, license: LIC.apache,
      f32Id: 'Qwen2.5-Coder-7B-Instruct-q4f32_1-MLC', vram32: 5900.09, strengths: ['code', 'mini-apps'], blurb: 'Writes real working mini-apps. Needs a strong GPU.' }),
  ];
  const byId = (id) => list.find((m) => m.id === id || m.f32Id === id) || null;
  /** GPUs whose driver reports shader-f16 but cannot compile the f16 kernels (a load failed with a shader validation
   * error and the f32 build worked): remembered on this device by adapter vendor, architecture and description. */
  const F16_KEY = 'slop-ai.f16-broken';
  const gpuKey = (g) => [g && g.vendor, g && g.architecture, g && g.description].map((x) => String(x || '')).join('|');
  const brokenList = () => { try { return JSON.parse(localStorage.getItem(F16_KEY)) || []; } catch (e) { return []; } };
  const f16Broken = (g) => !!g && brokenList().includes(gpuKey(g));
  function markF16Broken(g) { const l = brokenList(), k = gpuKey(g); if (!l.includes(k)) l.push(k); try { localStorage.setItem(F16_KEY, JSON.stringify(l)); } catch (e) { /* this visit only */ } }
  /** The id to load on this machine: the q4f32 build when the GPU lacks shader-f16, or its f16 kernels failed before. */
  const idFor = (m, sys) => (sys && sys.gpu && sys.gpu.ok && (!sys.gpu.f16 || f16Broken(sys.gpu)) && m.f32Id ? m.f32Id : m.id);
  /** A model record for a folder loaded from disk (see webllm.js loadFromDisk). */
  const custom = (id, o = {}) => M(id, Object.assign({ name: id, maker: 'Local folder', license: { name: 'See the model folder', short: 'see folder', url: '' }, custom: true, sizeMB: 0, vramMB: 0, blurb: 'Loaded from a folder on this computer.' }, o));
  K.catalog = { list, byId, idFor, custom, gpuKey, f16Broken, markF16Broken, LICENSES: LIC, DEFAULT: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC' };
})();
