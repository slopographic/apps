// Helpers for the currency and rate tests: an in-memory transaction over the real schema (no IndexedDB), a small
// DOMParser stand-in for the ECB fixture, and a loader that runs the consent scripts and the data scripts in one
// vm context. Not a test file itself.
import vm from 'node:vm';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'shared');
const DATA = path.join(ROOT, 'data');
export const DATA_FILES = ['money.js', 'barcode.js', 'schema-defs.js', 'schema.js', 'currency.js', 'store.js', 'numbering.js', 'fx.js', 'ledger.js', 'billing.js', 'bundle-check.js', 'rates-ecb.js'];

/** Runs the given files (relative to shared/) in one context. `extra` is copied onto the window first. */
export async function loadInto(files, extra = {}) {
  const ctx = { ...extra };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of files) {
    const src = await readFile(path.join(ROOT, f), 'utf8');
    vm.runInContext(src, ctx, { filename: f });
  }
  return ctx;
}

/** Plain copy of a value, so objects made inside the vm context compare equal to host objects. */
export const plain = (v) => JSON.parse(JSON.stringify(v));

/** An in-memory stand-in for a store transaction: list/get/put with the real schema rules, no immutability or numbering. */
export function fakeTx(D, seed = {}) {
  const tables = { accounts: D.schema.DEFAULT_CHART.map((a) => ({ ...a, createdAt: 1, updatedAt: 1, version: 1 })), settings: [{ id: 'main', ...D.schema.DEFAULT_SETTINGS, createdAt: 1, updatedAt: 1, version: 1 }], ...seed };
  let seq = 0;
  const ok = (value) => ({ ok: true, value });
  const fail = (code, message) => ({ ok: false, code, message });
  const tx = {
    tables,
    fail: (r) => r,
    async get(name, key) {
      const k = D.schema.def(name).key;
      return ok((tables[name] || []).find((r) => r[k] === key) || null);
    },
    async list(name, o = {}) {
      let rows = tables[name] || [];
      if (o.index) rows = rows.filter((r) => r[o.index] === o.value);
      if (o.filter) rows = rows.filter(o.filter);
      if (o.limit) rows = rows.slice(0, o.limit);
      return ok(rows.slice());
    },
    async put(name, rec) {
      const d = D.schema.def(name);
      const key = rec[d.key] !== undefined ? rec[d.key] : `${name}-${++seq}`;
      const p = D.schema.prepare(name, { ...rec, [d.key]: key });
      if (!p.ok) return fail('invalid', D.schema.errorText(p.errors));
      const row = { ...p.value, [d.key]: key, createdAt: ++seq, updatedAt: seq, version: 1 };
      tables[name] = (tables[name] || []).filter((r) => r[d.key] !== key).concat([row]);
      return ok(row);
    },
  };
  return tx;
}

/** A DOMParser stand-in that reads <Cube ...> elements with a regex. Enough for the ECB daily file, nothing more. */
export class FakeDOMParser {
  parseFromString(text) {
    const cubes = [];
    const re = /<Cube\s+([^>]*?)\/?>/g;
    let m;
    while ((m = re.exec(text))) {
      const attrs = {};
      for (const a of m[1].matchAll(/(\w+)="([^"]*)"/g)) attrs[a[1]] = a[2];
      cubes.push({ getAttribute: (k) => (Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null) });
    }
    return {
      getElementsByTagName: (n) => (n === 'Cube' ? cubes : n === 'parsererror' && !cubes.length ? [{}] : []),
    };
  }
}

/** A small fixture in the shape of the ECB daily reference file. */
export const ECB_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
<gesmes:subject>Reference rates</gesmes:subject>
<Cube>
<Cube time="2026-10-09">
<Cube currency="USD" rate="1.1600"/>
<Cube currency="JPY" rate="180.25"/>
<Cube currency="GBP" rate="0.8712"/>
</Cube>
</Cube>
</gesmes:Envelope>`;
