// Shared test harness for the sync tests. Not a test file itself (the runner only picks *.test.mjs).
// Browser scripts in shared/sync are classic scripts, so each one runs in a vm context with test doubles.
import vm from 'node:vm';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const SYNC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'shared', 'sync');
export const FILES = ['config.js', 'pkce.js', 'tokens.js', 'providers/gdrive.js', 'providers/dropbox.js', 'sync.js'];

export const reply = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  blob: async () => (body instanceof Blob ? body : new Blob([JSON.stringify(body)]))
});

export function defaultFetch(url) {
  if (url.startsWith('https://oauth2.googleapis.com/token')) return reply(200, { access_token: 'AT-NEW', expires_in: 3600 });
  return reply(200, { files: [], id: 'X', name: 'x' });
}

export function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

export function memBackend() {
  const m = new Map();
  return { m, get: async (k) => m.get(k), put: async (k, v) => { m.set(k, v); }, del: async (k) => { m.delete(k); } };
}

export async function textOf(b) { return typeof b === 'string' ? b : b.text(); }

export async function makeEnv({ url = 'https://apps.example.com/pdf/?x=1#top', fetchImpl = defaultFetch } = {}) {
  const calls = [];
  const imported = [];
  const u = new URL(url);
  const location = { href: url, origin: u.origin, pathname: u.pathname, search: u.search, hash: u.hash, assigned: [], assign(x) { this.assigned.push(x); } };
  const ctx = {
    location,
    history: { replaceState() {} },
    fetch: async (target, init = {}) => {
      calls.push({ url: String(target), method: (init.method || 'GET').toUpperCase(), headers: init.headers || {}, body: init.body });
      return fetchImpl(String(target), init);
    },
    localStorage: memStorage(),
    sessionStorage: memStorage(),
    crypto: globalThis.crypto, TextEncoder, TextDecoder, URL, URLSearchParams, Blob, btoa, atob, JSON, Date, Math, Promise
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of FILES) vm.runInContext(await readFile(path.join(SYNC, f), 'utf8'), ctx, { filename: f });
  const mem = memBackend();
  ctx.SlopSyncTokens.setBackend(mem);
  ctx.SlopData = {
    exportAll: async () => new Blob(['{"docs":[1]}'], { type: 'application/json' }),
    importAll: async (b) => { imported.push(b); }
  };
  return { ctx, S: ctx.SlopSync, calls, imported, location, mem };
}

export async function seedTokens(env, extra = {}) {
  await env.ctx.SlopSyncTokens.save('gdrive', { access: 'AT1', refresh: 'RT1', expiresAt: Date.now() + 3600e3, ...extra });
}

