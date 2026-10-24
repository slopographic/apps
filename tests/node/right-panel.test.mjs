// The suite's layout rule (shared/frame/HANDOFF.md, "settings and the main button live in the right panel") stays true
// for every app the audit there marks done: the audit table is the one list, this test reads it. A done app loads
// SlopFrame (frame.css, frame.js, panel.js, and sheet.js for phones), and a done tool also puts its main button in the
// panel's footer (panel.js footer()); a done editor keeps its own panel and puts its main button in the shared footer. The browser tests of each app check the look (tests/<app>/…).
// Covers: shared/frame/HANDOFF.md, shared/frame/frame.js, shared/frame/panel.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFile(path.join(ROOT, rel), 'utf8');

async function audit() {
  const md = await read('shared/frame/HANDOFF.md');
  const at = md.indexOf('## Audit');
  assert.ok(at > 0, 'the audit section is in shared/frame/HANDOFF.md');
  return md.slice(at).split('\n').filter((l) => /^\| [^-|]/.test(l) && !/^\| App \|/.test(l)).map((l) => {
    const [name, folder, kind, , status] = l.split('|').slice(1).map((c) => c.trim());
    return { name, folder: folder.split(' ')[0], kind, status };
  });
}

/** Every script in the app's folder (its own code; sub-pages included). */
async function ownScripts(dir) {
  const files = await readdir(path.join(ROOT, dir), { recursive: true });
  const js = files.filter((f) => /\.(m?js)$/.test(f) && !/(^|\/)(vendor|node_modules)\//.test(f));
  return (await Promise.all(js.map((f) => read(path.join(dir, f))))).join('\n');
}

test('the audit names every app in the registry once, with a known status', async () => {
  const rows = await audit();
  const g = {};
  new Function('window', await read('shared/apps.js'))(g);
  const names = rows.map((r) => r.name);
  for (const a of g.SLOP_APPS) assert.ok(names.includes(a.name), a.name + ' is in the audit');
  assert.equal(new Set(names).size, names.length, 'no app twice');
  for (const r of rows) assert.ok(['done', 'close', 'to do', 'n/a'].includes(r.status), r.name + ': status ' + r.status);
});

test('every app marked done loads SlopFrame and its phone sheet; a done tool has its main button in the panel footer', async () => {
  const done = (await audit()).filter((r) => r.status === 'done');
  assert.ok(done.length >= 3, 'some apps are done');
  for (const r of done) {
    const dir = r.folder.replace(/\/$/, ''), html = await read(dir + '/index.html');
    const loads = (f) => html.includes('shared/frame/' + f) || html.includes("'shared/frame/" + f);
    const js = await ownScripts(dir);
    const all = html + js;
    assert.ok(/shared\/frame\/frame\.css/.test(all), r.name + ': frame.css');
    assert.ok(loads('panel.js'), r.name + ': panel.js');
    assert.ok(all.includes('shared/ui/sheet.js'), r.name + ': shared/ui/sheet.js (the phone sheet)');
    if (r.kind === 'editor') {   // an editor keeps its own panel and takes the shared footer for its main button
      assert.ok(/SlopFramePanel\.create\(.*bare: true/.test(js) && /\.footer\(/.test(js), r.name + ': the shared footer on its own panel');
      continue;
    }
    assert.ok(loads('frame.js'), r.name + ': frame.js');
    assert.ok(/SlopFrame\.mount\(/.test(js) && /(SlopFrame\.panel|SlopFramePanel\.create)\(/.test(js), r.name + ': mounts SlopFrame and its panel');
    if (r.kind === 'tool' && r.folder !== 'workflows/') assert.ok(/\.footer\(/.test(js), r.name + ': the main button is in the panel footer');
  }
});
