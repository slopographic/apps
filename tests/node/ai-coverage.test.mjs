// The AI coverage audit (tools/ai-coverage.mjs → shared/commands/AI-COVERAGE.md): the file is up to date, and an app that is
// covered (the assistant can create, add, edit and export there) keeps its create, add and export commands.
// Covers: tools/ai-coverage.mjs
// Run: node --test tests/node/ai-coverage.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { scan, render, toolsIn, kindOf, ROOT, OUT } from '../../tools/ai-coverage.mjs';

// Apps that must stay covered. Add an app here once its commands cover it (never remove one to make the test pass).
const COVERED = ['photoslop', 'docs', 'slides', 'vector', 'label', 'press', 'tables', 'invoices', 'orders', 'quotes', 'purchases', 'crm', 'contacts', 'inventory', 'expenses', 'timesheets'];
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
