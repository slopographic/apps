// The AI coverage audit (tools/ai-coverage.mjs → shared/commands/AI-COVERAGE.md): the file is up to date, and an app that is
// covered (the assistant can create, add, edit and export there) keeps its create, add and export commands.
// Covers: tools/ai-coverage.mjs, shared/ai/app-skills.js
// Run: node --test tests/node/ai-coverage.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { scan, render, skills, toolsIn, kindOf, ROOT, OUT, SKILLS } from '../../tools/ai-coverage.mjs';
import vm from 'node:vm';

// Apps that must stay covered. Add an app here once its commands cover it (never remove one to make the test pass).
const COVERED = ['photoslop', 'vector', 'pdf', 'label', 'reports', 'docs', 'tables', 'slides', 'press', 'contacts', 'inventory', 'orders', 'quotes', 'purchases',
  'timesheets', 'expenses', 'invoices', 'notes', 'signature', 'qr', 'crm', 'calendar', 'todo', 'ledger', 'drive', 'code', 'gallery', '3d', 'nodes', 'cutout', 'ocr', 'html2pdf', 'resize', 'upscale', 'watermark', 'paste', 'reminders', 'admin', 'time',
  'slopedit', 'projects',   // SlopCut and Slop Projects (wip/video-ai)
  'diff', 'recorder'];
const rows = scan();

test('AI-COVERAGE.md is up to date (run node tools/ai-coverage.mjs)', () => {
  assert.equal(readFileSync(path.join(ROOT, OUT), 'utf8'), render(rows));
});

test('covered apps keep their create, add, edit and export commands', () => {
  for (const id of COVERED) {
    const r = rows.find((x) => x.id === id);
    assert.ok(r, `${id} is in shared/apps.js`);
    for (const k of ['create', 'add', 'edit', 'export']) assert.ok(r.by[k].length > 0, `${r.name} lost every ${k} command`);
  }
  for (const r of rows.filter((x) => x.covered)) assert.ok(COVERED.includes(r.id), `${r.name} is covered now: add '${r.id}' to COVERED in this test`);
});

test('commands are read from the four ways apps write them, and sorted by what they do', () => {
  const src = "const a = [{ name: 'x', type: 'number' }];\nadd('new_presentation', 'New', a);\n['add_column', 'Add', [a]],\n{ id: 'rs.ai.set-size', tool: 'set_size', args: a }\n{ id: 'co.look', title: 'Look', args: a }";
  assert.deepEqual(toolsIn(src).sort(), ['add_column', 'look', 'new_presentation', 'set_size']);
  assert.deepEqual(toolsIn("add('x_y', 'no schemas here')"), []);
  assert.deepEqual(['new_document', 'build_presentation', 'new_layer', 'insert_table', 'use_tool', 'add_noise', 'set_text', 'export_document', 'list_tools', 'undo'].map(kindOf),
    ['create', 'create', 'add', 'add', 'add', 'edit', 'edit', 'export', null, null]);
});

test('shared/ai/app-skills.js (what the AI panel says each app can make) is generated from the same scan and up to date', () => {
  const text = readFileSync(path.join(ROOT, SKILLS), 'utf8');
  assert.equal(text, skills(rows));
  const w = {}; w.window = w; vm.runInNewContext(text, w);
  const S = w.SlopAIKit.appSkills;
  assert.deepEqual([...S.slides.create], ['build_presentation', 'new_presentation']);   // (an array from the vm's realm) assert.ok(S.slides.ops.includes('outline-to-presentation'));
  assert.ok(S.docs.create.includes('build_document')); assert.ok(S.docs.ops.includes('outline-to-document'));
  assert.ok(S.tables.ops.includes('table-data-to-spreadsheet'));
  assert.ok(['add_svg_layer', 'draw_shape', 'use_tool'].every((t) => S.photoslop.add.includes(t)));
  assert.ok(S.invoices.create.includes('create_invoice'));
  for (const v of Object.values(S)) assert.ok(v.add.length <= 8, 'at most 8 add tools per app');
  assert.ok(text.split('\n').length < 120, 'one line per app');
});
