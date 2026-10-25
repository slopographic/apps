// Every app in the registry has a description and 4 to 10 search keywords (shared/finder/app-search.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const load = (file, name) => {
  const win = {};
  vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), { window: win });
  return win[name];
};
const apps = load('shared/apps.js', 'SLOP_ALL_APPS');   // every app, also one a brand profile hides
const search = load('shared/finder/app-search.js', 'SLOP_APP_SEARCH');

test('every registry app has a search entry with a description', () => {
  const missing = Array.from(apps.filter((a) => !search[a.id] || !search[a.id].desc), (a) => a.id);
  assert.deepEqual(missing, [], 'add these ids to shared/finder/app-search.js');
});

test('every entry has 4 to 10 keywords, none blank or repeated', () => {
  for (const a of apps) {
    const e = search[a.id];
    assert.ok(e.keywords.length >= 4 && e.keywords.length <= 10, `${a.id} has ${e.keywords.length} keywords`);
    assert.ok(e.keywords.every((k) => typeof k === 'string' && k.trim()), `${a.id} has a blank keyword`);
    assert.equal(new Set(e.keywords.map((k) => k.toLowerCase())).size, e.keywords.length, `${a.id} repeats a keyword`);
  }
});

test('no entry is left for an app the registry does not have', () => {
  const ids = new Set(apps.map((a) => a.id));
  assert.deepEqual(Object.keys(search).filter((k) => !ids.has(k)), []);
});
