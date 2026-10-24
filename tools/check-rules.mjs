#!/usr/bin/env node
// The repository's file rules. Run by the pre-commit and pre-push hooks (.githooks) and by CI (.github/workflows/rules.yml).
//   1. Size: every source file (.js, .mjs, .css, .html) has at most 300 lines. Split a longer file into modules.
//   2. Tests: every new or changed source script (.js, .mjs) is named by a test: some file under tests/ holds its repo path
//      (a script src, an import, or a "Covers: <path>" line in the test's header).
//   4. One way in, one way out (tools/one-way.mjs): in the apps on the shared intake, files come in only through
//      SlopIntake and go out only through SlopOuttake; no drop/paste listener, picker, ?drive= reader or hand-made
//      "Open in" list of their own.
// Vendored code (vendor/), minified files and the generated precache lists are not ours to split or test.
//   node tools/check-rules.mjs --all           rules 1 and 4 on every tracked file
//   node tools/check-rules.mjs --staged        rules 1, 2 and 4 on the files staged for commit
//   node tools/check-rules.mjs --range A..B    rules 1, 2 and 4 on the files changed between two commits
//   node tools/check-rules.mjs --files a b     rules 1, 2 and 4 on the files named
// Prints each problem and exits 1 when there is one.
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { strict, oneWayProblems } from './one-way.mjs';

export const MAX_LINES = 300;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = /\.(m?js|css|html)$/;
const SCRIPT = /\.m?js$/;
const EXEMPT = /^vendor\/|(^|\/)node_modules\/|\.min\.(js|css)$|^sw-precache(-\d+)?\.js$/;

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
/** Lines in a file, counted the way wc -l does (newlines), plus a last line with no newline. */
export function lineCount(text) { const n = (text.match(/\n/g) || []).length; return text && !text.endsWith('\n') ? n + 1 : n; }
export const isSource = (f) => SOURCE.test(f) && !EXEMPT.test(f);
/** A script that needs a test: our own JS outside tests/ (tests and their helpers are the tests). */
export const needsTest = (f) => SCRIPT.test(f) && !EXEMPT.test(f) && !f.startsWith('tests/');

const readRepo = (f) => (existsSync(path.join(ROOT, f)) ? readFileSync(path.join(ROOT, f), 'utf8') : null);
/** The problems in a list of repo paths: [{ file, rule, message }]. tests: the text of every file under tests/ (null skips
 * rule 2); read(path): a file's text or null when it is gone (default: the working tree). */
export function check(files, { tests = null, size = true, oneWay = true, read = readRepo } = {}) {
  const out = [];
  for (const f of files) {
    const text = isSource(f) ? read(f) : null;
    if (text == null) continue;
    const n = lineCount(text);
    if (size && n > MAX_LINES) out.push({ file: f, rule: 'size', message: `${f}: ${n} lines (at most ${MAX_LINES}). Split it into modules.` });
    if (oneWay && strict(f)) for (const p of oneWayProblems(text)) out.push({ file: f, rule: 'one-way', message: `${f}:${p.line}: ${p.why}. Files come in through SlopIntake and go out through SlopOuttake (shared/intake/HANDOFF.md); a line that must stay says why with an "intake-ok:" comment.` });
    if (tests != null && needsTest(f) && !tests.includes(f)) out.push({ file: f, rule: 'test', message: `${f}: no test names it. Add a test that loads it, or a "Covers: ${f}" line to the test that checks it.` });
  }
  return out;
}
/** Every file under tests/ as one text, read from the working tree (staged edits included). */
function testsText() { return git('ls-files', '--cached', '--others', '--exclude-standard', 'tests').filter((f) => existsSync(path.join(ROOT, f))).map((f) => readFileSync(path.join(ROOT, f), 'utf8')).join('\n'); }

function main(argv) {
  let files, tests = null;
  if (argv[0] === '--all') files = git('ls-files');
  else if (argv[0] === '--staged') { files = git('diff', '--cached', '--name-only', '--diff-filter=ACMR'); tests = testsText(); }
  else if (argv[0] === '--range' && argv[1]) { files = git('diff', '--name-only', '--diff-filter=ACMR', argv[1]); tests = testsText(); }
  else if (argv[0] === '--files') { files = argv.slice(1); tests = testsText(); }
  else { console.error('usage: node tools/check-rules.mjs --all | --staged | --range A..B | --files <paths>'); return 2; }
  const problems = check(files, { tests });
  for (const p of problems) console.error(p.message);
  console.log(`check-rules: ${files.length} files, ${problems.length} problem${problems.length === 1 ? '' : 's'}`);
  return problems.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
