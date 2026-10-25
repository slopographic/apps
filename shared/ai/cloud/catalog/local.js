/* The AI provider catalog, group 'local': model servers on this computer (or, over https, on your network), all
 * OpenAI Chat Completions (cloud/compat.js), each with its default port and the one setting that lets this website
 * use it (setup: plain lines, {site} = this website's origin). Flags and ports from each server's docs or source,
 * read 2026-10-24. cors 'unknown': it depends on how the server was started (cloud/local.js diagnoses it). Classic script. */
(function () {
  'use strict';
  const K = (window.SlopAIKit = window.SlopAIKit || {});
  const C = (K.cloud = K.cloud || {});
  const L = { group: 'local', format: 'openai-chat', local: true, auth: 'none', cors: 'unknown', modelsEndpoint: '/models', caps: { tools: true, streaming: true }, models: [], prefer: [/./] };
  // a server on this computer is free: no account, no limits but the computer's own (each of these servers is free to download and run)
  const FREE = { tier: 'free', rank: 9, verified: '2026-10-25', training: null, note: 'Free: it runs on your own computer, with no account and no limits but your hardware. Nothing leaves the computer.' };
  const add = (e) => Object.assign({}, L, e, e.anyAddress ? {} : { free: Object.assign({ docs: e.docs, signup: e.docs }, FREE) });
  (C.catalog = C.catalog || []).push(
    add({ id: 'ollama', name: 'Ollama on this computer', who: 'Ollama on this computer', short: 'Ollama', rank: 1, base: 'http://localhost:11434/v1', port: 11434,
      docs: 'https://docs.ollama.com/api/openai-compatibility', aliases: ['ollama', 'local'], prefer: [/qwen|llama|mistral|gemma/i],
      pull: 'Download a model first, for example: ollama pull qwen3', start: 'Start it with the Ollama app, or ollama serve in a terminal.',
      setup: ['Ollama answers web pages only from the addresses you allow. Set OLLAMA_ORIGINS to {site} and restart Ollama:',
        'Mac: in Terminal, launchctl setenv OLLAMA_ORIGINS "{site}" then quit and open Ollama again.',
        'Windows: Settings › System › About › Advanced system settings › Environment Variables, add OLLAMA_ORIGINS = {site}, then restart Ollama.',
        'Linux: sudo systemctl edit ollama.service, add Environment="OLLAMA_ORIGINS={site}" under [Service], then sudo systemctl restart ollama.'],
      after: ['Pick a model that can use tools (for example qwen3 or llama3.2); download it first with ollama pull <name>.'] }),
    add({ id: 'lmstudio', name: 'LM Studio on this computer', who: 'LM Studio on this computer', short: 'LM Studio', rank: 2, base: 'http://localhost:1234/v1', port: 1234, usageOption: false,
      docs: 'https://lmstudio.ai/docs/developer/core/server', aliases: ['lm studio', 'lmstudio', 'lms'],
      pull: 'Load a model in LM Studio (the Developer tab), then press Test connection again.', start: 'In LM Studio, open the Developer tab and start the server (or: lms server start --cors).',
      setup: ['In LM Studio, open the Developer tab, start the server, and in its settings turn on “Enable CORS”, so web pages may use it (or start it with lms server start --cors).'],
      after: ['Load a model that supports tool use.'] }),
    add({ id: 'vllm', name: 'vLLM server', who: 'the vLLM server', short: 'vLLM', rank: 3, base: 'http://localhost:8000/v1', port: 8000, auth: 'optional',
      docs: 'https://docs.vllm.ai/en/latest/serving/openai_compatible_server.html', aliases: ['vllm'],
      start: 'Start it with vllm serve <model> (port 8000 by default).',
      setup: ['vLLM allows no other website by default. Start it with --allowed-origins \'["{site}"]\' (and --enable-auto-tool-choice with a --tool-call-parser for tools).', 'If you started it with --api-key, paste that key here.'] }),
    add({ id: 'llamacpp', name: 'llama.cpp server', who: 'the llama.cpp server', short: 'llama.cpp', rank: 4, base: 'http://localhost:8080/v1', port: 8080, altPorts: [9931], auth: 'optional',
      docs: 'https://github.com/ggml-org/llama.cpp/tree/master/tools/server', aliases: ['llama.cpp', 'llamacpp', 'llama-server', 'gguf'],
      start: 'Start it with llama-server -m <model.gguf> --jinja (newer builds listen on 9931 unless you pass --port 8080).',
      setup: ['llama-server allows every website by default (--cors-origins is * unless --tools, --agent or MCP is on; then pass --cors-origins {site}).', 'Start it with --jinja so models can call tools. If you passed --api-key, paste that key here.'] }),
    add({ id: 'jan', name: 'Jan on this computer', who: 'Jan on this computer', short: 'Jan', rank: 5, base: 'http://127.0.0.1:1337/v1', port: 1337, auth: 'optional',
      docs: 'https://www.jan.ai/docs/desktop/api-server', aliases: ['jan', 'jan.ai'],
      start: 'In Jan: Settings › Local API Server › Start Server.',
      setup: ['In Jan: Settings › Local API Server: keep CORS on and add {site} to Trusted Hosts. If you set an API key there, paste it here.', 'Update Jan past 0.8.4 (an older CORS flaw).'] }),
    add({ id: 'localai', name: 'LocalAI', who: 'LocalAI', short: 'LocalAI', rank: 6, base: 'http://localhost:8080/v1', port: 8080, auth: 'optional',
      docs: 'https://localai.io/basics/getting_started/', aliases: ['localai', 'local ai'],
      setup: ['Start LocalAI with LOCALAI_CORS=true and LOCALAI_CORS_ALLOW_ORIGINS={site}.', 'If you set API_KEY, paste it here.'] }),
    add({ id: 'koboldcpp', name: 'KoboldCpp', who: 'KoboldCpp', short: 'KoboldCpp', rank: 7, base: 'http://localhost:5001/v1', port: 5001, auth: 'optional', caps: { streaming: true },
      docs: 'https://github.com/LostRuins/koboldcpp/wiki', aliases: ['kobold', 'koboldcpp'],
      setup: ['KoboldCpp allows every website by default; nothing to set. Its OpenAI address is /v1 on port 5001.'] }),
    add({ id: 'textgen', name: 'text-generation-webui', who: 'text-generation-webui', short: 'text-gen-webui', rank: 8, base: 'http://127.0.0.1:5000/v1', port: 5000, auth: 'optional',
      docs: 'https://github.com/oobabooga/text-generation-webui/wiki/12-%E2%80%90-OpenAI-API', aliases: ['oobabooga', 'text generation webui', 'textgen', 'tgwui'],
      start: 'Start it with --api (port 5000; --api-port to change it).',
      setup: ['Start it with --api. It accepts only localhost pages unless started with --listen or --public-api (then any website); there is no separate CORS flag.', 'If you started it with --api-key, paste that key here.'] }),
    add({ id: 'custom', name: 'Any address (OpenAI-compatible)', who: 'the service at the address you gave', short: 'Your service', rank: 9, base: '', local: false, anyAddress: true, auth: 'optional',
      docs: 'https://platform.openai.com/docs/api-reference/chat', aliases: ['custom', 'any', 'address', 'url', 'openai compatible', 'proxy', 'self-hosted', 'server'],
      notes: 'Any server that speaks the OpenAI Chat Completions API: http://localhost:<port>/v1, or https:// anywhere.' }),
  );
})();
