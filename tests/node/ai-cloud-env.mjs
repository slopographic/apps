// The own-key AI providers (shared/ai/cloud/) in a Node vm with a fake window: storage stubs, a fetch that records each
// request and answers from a queue, and Responses made from recorded Server-Sent-Event text, cut into small pieces so the
// parsers must join events across reads.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export const FILES = ['shared/commands/args.js', 'shared/ai/engines.js', 'shared/ai/tools.js', 'shared/ai/cmdtools.js', 'shared/ai/apptools.js',
  'shared/ai/cloud/net.js', ...['main', 'open', 'cloud', 'more', 'local', 'images'].map((g) => `shared/ai/cloud/catalog/${g}.js`), 'shared/ai/cloud/providers.js', 'shared/ai/cloud/anthropic.js', 'shared/ai/cloud/openai.js', 'shared/ai/cloud/compat.js',
  'shared/ai/cloud/gemini.js', 'shared/ai/cloud/meter.js', 'shared/ai/cloud/engine.js', 'shared/ai/cloud/local.js'];

function store() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), get length() { return m.size; }, key: (i) => [...m.keys()][i], dump: () => Object.fromEntries(m) };
}

/** A Response whose body streams text in pieces of n characters (default 9: events split mid-line and mid-JSON). */
export function sseResponse(text, { status = 200, n = 9, headers = {} } = {}) {
  const enc = new TextEncoder(), bytes = enc.encode(text);
  let i = 0;
  const body = new ReadableStream({ pull(c) { if (i >= bytes.length) { c.close(); return; } c.enqueue(bytes.slice(i, i + n)); i += n; } });
  return new Response(body, { status, headers: Object.assign({ 'content-type': 'text/event-stream' }, headers) });
}
export const jsonResponse = (obj, status = 200, headers = {}) => new Response(JSON.stringify(obj), { status, headers: Object.assign({ 'content-type': 'application/json' }, headers) });

/** SSE text from a list of events: [event, data] pairs (Anthropic, OpenAI Responses) or bare data objects/strings. */
export function sse(events) {
  return events.map((e) => (Array.isArray(e) ? `event: ${e[0]}\ndata: ${JSON.stringify(e[1])}\n\n` : `data: ${typeof e === 'string' ? e : JSON.stringify(e)}\n\n`)).join('');
}

/** The kit in a fresh context. win.requests: [{ url, init, body }]; win.answers: a queue of Responses (or functions). */
export function kit() {
  const w = { console, TextDecoder, TextEncoder, ReadableStream, Response, Headers, URL, performance, setTimeout, clearTimeout, AbortController, Promise,
    btoa, atob, localStorage: store(), sessionStorage: store(), navigator: { onLine: true }, location: { origin: 'https://slopographic.com', href: 'https://slopographic.com/photoslop/' } };
  w.window = w; w.requests = []; w.answers = [];
  w.fetch = async (url, init = {}) => {
    w.requests.push({ url: String(url), init, body: init.body ? JSON.parse(init.body) : null, headers: init.headers || {} });
    if (init.signal && init.signal.aborted) throw Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' });
    const a = w.answers.shift();
    if (!a) throw new Error('no answer queued for ' + url);
    return typeof a === 'function' ? a(url, init) : a;
  };
  const ctx = vm.createContext(w);
  for (const f of FILES) vm.runInContext(readFileSync(new URL('../../' + f, import.meta.url), 'utf8'), ctx, { filename: f });
  return w;
}

/** Collects an engine stream: { text (from the deltas), done }. */
export async function collect(stream) {
  let text = '', done = null;
  for await (const c of stream) { if (c.type === 'delta') text += c.text; else done = c; }
  return { text, done };
}
