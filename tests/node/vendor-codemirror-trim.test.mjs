// The two keyword entries taken out of the vendored CodeMirror legacy modes (vendor/codemirror/README.md, Notes): one name
// in the Clojure mode's core list and one special variable in the Perl mode's list. Only their SHA-256 is named here, so a
// re-vendor (tools/vendor-codemirror.mjs) that brings either back fails this test until it is taken out again.
// Covers: vendor/codemirror/legacy-clojure.js, vendor/codemirror/legacy-perl.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const GONE = new Set([
  '6a42f3b5d1154428a12579babe23b6ccdc33b3b89065ad0b20e9c1d8a66077be',   // the Clojure core-list name
  'bbb5f575538bd9a4b807c2df27af1efe4615f9a3f02e0e3a87a044b41612af5d'    // the Perl special variable
]);
const sha = (s) => createHash('sha256').update(s).digest('hex');
const strings = (src) => [...src.matchAll(/"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'/g)].map((m) => m[1] ?? m[2]);

for (const f of ['legacy-clojure.js', 'legacy-perl.js']) {
  test(`${f}: the taken-out entry is not back`, () => {
    const src = readFileSync(new URL(`../../vendor/codemirror/${f}`, import.meta.url), 'utf8');
    const back = strings(src).filter((s) => GONE.has(sha(s)));
    assert.deepEqual(back, [], `${f} has a taken-out entry again`);
    assert.ok(strings(src).length > 100, 'the mode still has its word lists');
  });
}
