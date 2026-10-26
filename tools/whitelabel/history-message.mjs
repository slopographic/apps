// Commit messages of a mapped history (history.mjs): a source commit's message with its trailers stripped and its names
// mapped the way the build maps the site (links, plain names, the rename map). A part that still holds a forbidden word,
// or that talks about how the copy is made (TALK), is left out; when too little is left, the message is a neutral one
// made from the areas of the site the commit changed ("Image Editor and Tests: updates"). Messages of commits that were
// folded into the next one are listed in its body. Node only. Tests: tests/node/whitelabel-history.test.mjs.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { profileText } from './transform.mjs';
import { tokens } from './rename.mjs';
import { findTerms } from './scan.mjs';

/** Words about the making of a copy: never in a mapped message. */
export const TALK = /mirror|white[\s-]?label|brand[\s-]?(?:profile|build)|profile[\s-]?marker|rename[\s-]?map|sample[\s-]?(?:brand|profile)|\bacme\b|\bsilos?\b/i;
/** Trailer lines and tool footers. */
const TRAILER = /^\s*(?:[A-Z][\w-]*-by|Change-Id|Signed-off-by|Co-authored-by)\s*:|generated with \[|^\s*🤖/i;

/** The message without trailers, tool footers and signature blocks, spaces tidied. */
export function cleanMessage(raw) {
  const lines = String(raw).replace(/\r/g, '').split('\n').filter((l) => !TRAILER.test(l) && !/^-----(BEGIN|END)/.test(l));
  return lines.join('\n').replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
}

/** Readable names for the top folders of the site: the app registry's plain names, then a few fixed ones. */
const FIXED = { shared: 'Shared components', tests: 'Tests', tools: 'Tools', vendor: 'Libraries', home: 'Homepage', shell: 'App shell',
  style: 'Styles', brand: 'Brand', assets: 'Assets', '.github': 'CI', '.githooks': 'Hooks', docs: 'Docs', package: 'Package' };
export function areaNames(root) {
  const names = new Map(Object.entries(FIXED));
  try {
    const win = {};
    vm.runInNewContext(readFileSync(path.join(root, 'shared', 'apps.js'), 'utf8'), { window: win });
    for (const a of win.SLOP_APPS || []) {
      const dir = String(a.path || a.id || '').replace(/^\.?\//, '').split('/')[0];
      if (dir && a.plain && !names.has(dir)) names.set(dir, a.plain);
    }
  } catch (e) { /* the fixed names only */ }
  return names;
}

/** The areas a list of source paths falls in, most touched first (root files: "Site"). fix: what an unnamed folder's
 * name goes through (the rename map), so no source word reaches a message. */
export function areas(paths, names, fix = (s) => s) {
  const n = new Map();
  for (const p of paths) {
    const top = p.includes('/') ? p.split('/')[0] : '';
    const a = top ? names.get(top) || fix(top).replace(/[-_]+/g, ' ').replace(/^./, (c) => c.toUpperCase()) : 'Site';
    n.set(a, (n.get(a) || 0) + 1);
  }
  return [...n.entries()].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1)).map(([a]) => a);
}

/** "A: updates", "A and B: updates", "A, B and 3 more areas: updates". */
export function neutral(list) {
  if (!list.length) return 'Updates';
  if (list.length === 1) return `${list[0]}: updates`;
  if (list.length === 2) return `${list[0]} and ${list[1]}: updates`;
  if (list.length === 3) return `${list[0]}, ${list[1]} and ${list[2]}: updates`;
  return `${list[0]}, ${list[1]} and ${list.length - 2} more areas: updates`;
}

/** A checker for mapped text: true when it holds no forbidden term and no TALK word. */
export function checker(terms, account) {
  return (s) => !TALK.test(s) && findTerms(s, terms, { account }).length === 0;
}

/** Names mapped like the build does. */
export const mapText = (s, ctx) => tokens(profileText(s, ctx), ctx.tokenRules);

/** The subject without the parts that fail: "Milestone 4: a, b; c" keeps its prefix and the clauses that pass. */
function pruneSubject(subject, ok) {
  if (ok(subject)) return subject;
  const m = /^([^:]{1,40}:\s+)([\s\S]*)$/.exec(subject), head = m ? m[1] : '', body = m ? m[2] : subject;
  if (!ok(head)) return '';
  const parts = body.split(/(;\s+|,\s+)/), kept = [];
  for (let i = 0; i < parts.length; i += 2) if (parts[i].trim() && ok(parts[i])) kept.push(parts[i]);
  if (!kept.length || kept.length * 2 < Math.ceil(parts.length / 2)) return '';   // more than half gone: say less, not nonsense
  return head + kept.join(', ').replace(/^and /, '');
}

/** One source message, mapped; '' when nothing usable is left. */
export function mapMessage(raw, ctx, ok) {
  const text = mapText(cleanMessage(raw), ctx);
  if (/^Merge (?:branch|remote-tracking|pull request|wip\/|[\w/.-]+ into )/.test(text)) return '';   // a merge: the areas say more
  const [subject, ...rest] = text.split('\n');
  const s = pruneSubject(subject.trim(), ok);
  if (!s) return '';
  const body = rest.filter((l) => ok(l)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return body ? `${s}\n\n${body}` : s;
}

/** The message of one mapped commit: its own (or a neutral one), and when earlier commits were folded into it, their
 * subjects (at most 40). items: [{ message (already mapped, may be ''), areas }], oldest first; the last is the commit. */
export function combine(items, ok) {
  const last = items[items.length - 1];
  let own = last.message || neutral(last.areas);
  if (!ok(own)) own = 'Updates';
  if (items.length === 1) return own + '\n';
  const folded = items.slice(0, -1).map((it) => (it.message || neutral(it.areas)).split('\n')[0]);
  const list = folded.slice(-40).map((s) => `- ${s}`);
  if (folded.length > 40) list.unshift(`- (and ${folded.length - 40} earlier changes)`);
  const msg = `${own}\n\nAlso in this commit:\n${list.join('\n')}\n`;
  return ok(msg) ? msg : own + '\n';
}
