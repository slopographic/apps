#!/usr/bin/env node
// The history of a white-label copy, commit by commit: every source commit of a ref (oldest first, history-git.mjs chain)
// becomes one commit of the copy, whose tree is what the build makes of that source tree, in the profile's author's name
// at the source commit's author time. A release then adds the full build on top (export.mjs; the caller commits it).
//   node tools/whitelabel/history.mjs <profile id> <out repo> --source=<repo> [--ref=HEAD] [--profiles=<dir>]
//     [--state=<file>] [--state-out=<file>] [--rebuild] [--generated=<build dir>] [--branch=main] [--name=..] [--email=..]
//     [--forbid=<word>,...] [--root=<checkout>] [--report=<file>]
// --root: the checkout whose copy layer and app registry name things (default this one; a release passes its source).
// Incremental: a commit transforms only the paths changed since the last mapped one (git diff-tree) and keeps the rest;
// the cheap rewrites of the build follow their inputs (brand.json, the manifest, the trial tokens, the font block, the
// video ids stripped, the raw links pinned to the cdn TAG, the mirror workflow from .github/workflows/rules.yml). The
// slow steps (SEO writer, precache list, icons) are not run per commit: --generated names a finished build whose own
// files (the ones that are no source file's image: licence, README, icons, logo, mascot, font) enter with the first
// commit, and the release commit on top is the full build.
// Each commit's new and changed files are scanned (scan.mjs, the build's terms and allow list). A commit that cannot be
// built (an old tree the tools do not fit) or whose files leak is folded into the next good one (its message listed
// there); a commit that changes nothing in the copy (only this tool, profiles, left-out files) is dropped.
// The state file (kept by the caller, never in a public repository) holds the last mapped source commit, its source and
// copy files, and source commit -> copy commit, so the next run continues where this one stopped.
// Node only. Tests: tests/node/whitelabel-history.test.mjs.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProfile, loadMap, forbiddenTerms, profilesDir } from './profile.mjs';
import { urls, phrases, tokens } from './rename.mjs';
import { context, forward, forwardPath } from './transform.mjs';
import { brandJson, manifest } from './emit.mjs';
import { mirrorWorkflow } from './workflow.mjs';
import { skipPattern, smokeFor } from './mirror-skip.mjs';
import { pinCdn, TEXT } from './cdnpin.mjs';
import { isText, scan, report, listFiles } from './scan.mjs';
import { artAllow } from './mascot.mjs';
import { mediaIds, stripText } from './media.mjs';
import { withBlock, START, EMPTY } from '../fonts/css.mjs';
import { excluded, patchBinary, isUtf8, SCAN_ALLOW } from './build.mjs';
import { chain, commits, diffTree, lsTree, readBlobs, blobSha, git, FastImport } from './history-git.mjs';
import { mapMessage, combine, areas, areaNames, checker } from './history-message.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const WF = '.github/workflows/rules.yml', ASSETS = 'shared/cdn/assets.js';

/** Everything the steps need for one profile. root: the tree whose tools and copy layer are used (this checkout). */
export function setup(root, dir, id, opts = {}) {
  const p = loadProfile(dir, id), map = loadMap(dir, id);
  if (!map) throw new Error(`profile ${id} has no rename map: its copy is this site itself`);
  const ctx = context(root, p, map), account = p.github.toLowerCase();
  const videos = p.media ? [] : mediaIds(root);   // as the build: this site's video ids are stripped and forbidden
  const terms = [...new Set(forbiddenTerms(dir, p).concat(videos, opts.forbid || []).map((t) => t.toLowerCase()))];
  const ok = checker(terms, account), names = areaNames(root);
  return { p, ctx, terms, videos, account, ok, names, allow: SCAN_ALLOW.concat(HISTORY_ALLOW, p.scanAllow || [], artAllow(p)), fix: (s) => tokens(s, ctx.tokenRules) };
}

export const fresh = () => ({ version: 1, base: null, tag: null, src: {}, out: {}, pinned: [], pending: [], map: {} });

/** Files of past trees only, where a scan hit is not a name (reported as allowed, like build.mjs SCAN_ALLOW). */
export const HISTORY_ALLOW = [
  { file: 'vendor/models/depth/depth-anything-v2-small.onnx', term: 'slop', why: 'bytes of the model weights happen to spell it; the file left the tree later' },
];
/** English words the renamer keeps (rename.mjs KEEP) but the scan refuses, and a word the scan forbids: old trees have
 * them in comments and test names, so a mapped commit says them another way (the case kept). */
const SCRUB = [[/sloppiness/gi, 'carelessness'], [/sloppily/gi, 'carelessly'], [/sloppy/gi, 'careless'], [/slurp/gi, 'gulp']];
const sameCase = (m, to) => (m === m.toUpperCase() ? to.toUpperCase() : m[0] === m[0].toUpperCase() ? to[0].toUpperCase() + to.slice(1) : to);
export const scrub = (s) => SCRUB.reduce((t, [re, to]) => t.replace(re, (m) => sameCase(m, to)), s);

const cdnLink = (T) => new RegExp(`raw\\.githubusercontent\\.com/${T.p.github}/cdn/[0-9a-f]{40}/`, 'i');
/** One source file in the copy: { dest, data, link } (link: it has a raw cdn link that the TAG pins). As build.mjs does it. */
export function outFile(T, f, buf, tag) {
  const dest = forwardPath(f, T.ctx);
  if (!isText(buf) || !isUtf8(buf)) return { dest, data: patchBinary(f, buf), link: false };
  let s = scrub(forward(buf.toString('utf8'), T.ctx, dest));
  if (dest === 'brand/brand.json') s = JSON.stringify(brandJson(JSON.parse(s), T.p), null, 2) + '\n';
  const link = cdnLink(T).test(s);
  if (tag && TEXT.test(path.basename(dest)) && Buffer.byteLength(s) <= 4e6) s = pinCdn(s, T.p.github, tag);
  if (dest === 'manifest.webmanifest') s = manifest(s, T.p);
  if (dest === 'shared/agent/trial-tokens.json') { const t = JSON.parse(s); t.tokens = []; s = JSON.stringify(t, null, 2) + '\n'; }
  if (dest === 'shared/fonts/fonts.css' && s.includes(START)) s = withBlock(s, T.p.fontManifest || EMPTY);   // font.mjs emitFont
  if (T.videos.length && /\.(js|mjs|cjs|html|json|md|txt|css|xml)$/.test(dest) && Buffer.byteLength(s) <= 4e6) s = stripText(s, T.videos);   // media.mjs
  return { dest, data: Buffer.from(s), link };
}
/** The mirror workflow from the source's rules.yml (null when the old file does not fit the generator). */
export function workflowFile(T, yml) {
  try { return Buffer.from(tokens(phrases(urls(mirrorWorkflow(yml, skipPattern(T.p), smokeFor(T.p)), T.ctx.urls), T.ctx.phraseRules), T.ctx.tokenRules)); } catch (e) { return null; }
}
const tagOf = (buf) => { const m = buf && /const TAG = '([^']*)';/.exec(buf.toString('utf8')); return m ? m[1] : null; };

/** Scans files about to be committed (written to a scratch folder, so the build's own scan runs on them). */
export function scanFiles(T, files, scratch) {
  rmSync(scratch, { recursive: true, force: true });
  for (const f of files) { const t = path.join(scratch, f.path); mkdirSync(path.dirname(t), { recursive: true }); writeFileSync(t, f.data); }
  const res = existsSync(scratch) ? scan(scratch, T.terms, T.allow, { account: T.account }) : { found: [], allowed: [] };
  rmSync(scratch, { recursive: true, force: true });
  return res;
}

/** One source commit on top of state S: { state, changes: [{ path, data|null }], paths } or throws (cannot build, leaks). */
export function step(T, repo, S, sha, scratch) {
  const diff = diffTree(repo, S.base, sha);
  const src = Object.assign({}, S.src), pinned = new Set(S.pinned), out = new Map(), todo = new Map();
  let wf;
  for (const d of diff) {
    if (d.path === WF) wf = d;
    if (excluded(d.path, T.p)) continue;
    if (d.sha) todo.set(d.path, d.sha);
    else if (src[d.path]) { out.set(src[d.path][1], null); delete src[d.path]; pinned.delete(d.path); }
  }
  const blobs = readBlobs(repo, [...todo.values()].concat(wf && wf.sha ? [wf.sha] : []));
  let tag = S.tag;
  if (todo.has(ASSETS)) tag = tagOf(blobs.get(todo.get(ASSETS)));
  else if (diff.some((d) => d.path === ASSETS)) tag = null;
  if (tag !== S.tag) {                               // a new TAG: every pinned link again
    const again = [...pinned].filter((f) => src[f] && !todo.has(f));
    for (const f of again) todo.set(f, src[f][0]);
    for (const [k, v] of readBlobs(repo, again.map((f) => src[f][0]))) blobs.set(k, v);
  }
  const owner = new Map(Object.entries(src).map(([f, [, dest]]) => [dest, f]));
  for (const [f, blob] of todo) {
    const o = outFile(T, f, blobs.get(blob), tag);
    const was = src[f] && src[f][1];
    if (owner.has(o.dest) && owner.get(o.dest) !== f) throw new Error(`two files map to ${o.dest}: ${owner.get(o.dest)} and ${f}`);
    if (was && was !== o.dest && !out.has(was)) { out.set(was, null); owner.delete(was); }
    owner.set(o.dest, f); src[f] = [blob, o.dest]; out.set(o.dest, o.data);
    if (o.link) pinned.add(f); else pinned.delete(f);
  }
  if (wf) out.set(WF, wf.sha ? workflowFile(T, blobs.get(wf.sha).toString('utf8')) : null);
  const next = Object.assign({}, S.out), changes = [];
  for (const [dest, data] of out) {
    const id = data ? blobSha(data) : null;
    if (id === (S.out[dest] || null)) continue;
    changes.push({ path: dest, data });
    if (id) next[dest] = id; else delete next[dest];
  }
  const res = scanFiles(T, changes.filter((c) => c.data), scratch);
  if (res.found.length) throw new Error(`leaks: ${report(res, 5)}`);
  return { state: Object.assign({}, S, { base: sha, tag, src, out: next, pinned: [...pinned] }), changes, paths: diff.map((d) => d.path) };
}

/** A finished build's own files: the ones that are no image of a source file at ref (licence, README, icons, mascot...). */
export function generatedFiles(T, repo, ref, dir) {
  const own = new Set([WF]);
  for (const f of lsTree(repo, ref).keys()) if (!excluded(f, T.p)) own.add(forwardPath(f, T.ctx));
  return listFiles(dir).filter((f) => !own.has(f) && !/^node_modules(\/|$)/.test(f)).map((f) => ({ path: f, data: readFileSync(path.join(dir, f)) }));
}

/** Maps the commits of o.ref not mapped yet onto o.out's branch. Returns { state, stats, commits: [[source, copy, kind]] }. */
export async function run(o) {
  const T = setup(o.root || ROOT, o.profiles, o.id, o);
  let S = o.rebuild || !o.state ? fresh() : o.state;
  const ref = `refs/heads/${o.branch || 'main'}`, scratch = path.join(o.out, '.git', 'history-scan');
  let from = null;
  try { from = git(o.out, ['rev-parse', '-q', '--verify', ref + '^{commit}']).trim() || null; } catch (e) { /* a new branch */ }
  if (o.rebuild && from) throw new Error(`${o.out} already has ${ref}: a rebuild starts from an empty repository`);
  const list = chain(o.source, o.ref || 'HEAD', new Set(Object.keys(S.map)));
  const info = commits(o.source, list);
  let overlay = o.generated ? generatedFiles(T, o.source, o.ref || 'HEAD', o.generated) : [];
  const bad = scanFiles(T, overlay, scratch);
  if (bad.found.length) throw new Error(`the build's own files leak: ${report(bad, 10)}`);
  const fi = new FastImport(o.out, path.join(o.out, '.git', 'history-marks'));
  const stats = { source: list.length, commits: 0, coalesced: 0, dropped: 0 }, rows = [], log = o.log || (() => {});
  let prev = S.base, lastMark = null, marks;
  const t0 = Date.now();
  try {
    for (const [i, sha] of list.entries()) {
      const c = info.get(sha);
      if (i && i % 50 === 0) log(`${i}/${list.length} source commits, ${stats.commits} commits, ${Math.round((Date.now() - t0) / 1000)} s`);
      let r = null, why = '';
      const t1 = Date.now();
      try { r = step(T, o.source, S, sha, scratch); } catch (e) { why = String(e.message || e).split('\n')[0]; }
      if (Date.now() - t1 > 10000) log(`${sha.slice(0, 10)}: ${Math.round((Date.now() - t1) / 1000)} s${why ? ' (' + why + ')' : ''}`);
      const paths = r && S.base === prev ? r.paths : diffTree(o.source, prev, sha).map((d) => d.path);
      const item = { sha, message: mapMessage(c.message, T.ctx, T.ok), areas: areas(paths, T.names, T.fix), time: c.time };
      prev = sha;
      if (!r) { S.pending.push(item); rows.push([sha, null, 'coalesced', why]); continue; }
      if (!r.changes.length && !overlay.length) {
        for (const x of S.pending) { const row = rows.find((w) => w[0] === x.sha); if (row) Object.assign(row, [x.sha, lastMark, 'dropped']); }
        stats.dropped += 1 + S.pending.length; rows.push([sha, lastMark, 'dropped']);
        S = Object.assign(r.state, { pending: [] });
        continue;
      }
      const message = combine(S.pending.concat([item]), T.ok);
      const mark = await fi.commit({ ref, from: stats.commits === 0 ? from : null, name: o.name || T.p.publish.author, email: o.email || T.p.publish.email,
        time: c.time, message, changes: overlay.concat(r.changes) });
      for (const x of S.pending) { const row = rows.find((w) => w[0] === x.sha); if (row) row[1] = mark; else rows.push([x.sha, mark, 'coalesced']); }
      stats.coalesced += S.pending.length; stats.commits++;
      rows.push([sha, mark, 'mapped']); lastMark = mark; overlay = [];
      S = Object.assign(r.state, { pending: [] });
    }
  } finally {
    marks = await fi.done();
  }
  const map = Object.assign({}, S.map);
  for (const row of rows) {
    if (typeof row[1] === 'number') row[1] = marks.get(row[1]);
    else if (row[1] == null) row[1] = row[2] === 'dropped' ? (from || null) : null;
    map[row[0]] = row[1] || null;
  }
  for (const x of S.pending) map[x.sha] = map[x.sha] || null;
  stats.pending = S.pending.length;
  return { state: Object.assign({}, S, { map }), stats, commits: rows };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2), pos = args.filter((a) => !a.startsWith('--'));
  const opt = (k) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : null; };
  if (pos.length !== 2 || !opt('source')) { console.error('usage: history.mjs <profile id> <out repo> --source=<repo> [--ref=..] [--state=..] [--state-out=..] [--rebuild] [--generated=..]'); process.exit(2); }
  const stateFile = opt('state'), outFile_ = opt('state-out') || stateFile;
  try {
    const state = stateFile && existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : null;
    const r = await run({ id: pos[0], out: path.resolve(pos[1]), source: path.resolve(opt('source')), ref: opt('ref') || 'HEAD', state, rebuild: args.includes('--rebuild'),
      root: opt('root') && path.resolve(opt('root')), profiles: opt('profiles') ? path.resolve(opt('profiles')) : profilesDir(ROOT), generated: opt('generated') && path.resolve(opt('generated')),
      branch: opt('branch') || 'main', name: opt('name'), email: opt('email'), forbid: (opt('forbid') || '').split(',').filter(Boolean), log: (s) => console.log(s) });
    if (outFile_) writeFileSync(outFile_, JSON.stringify(r.state) + '\n');
    if (opt('report')) writeFileSync(opt('report'), r.commits.map((c) => c.join('\t')).join('\n') + '\n');
    console.log(`history: ${r.stats.source} source commits -> ${r.stats.commits} commits (${r.stats.coalesced} folded into the next, ${r.stats.dropped} dropped, ${r.stats.pending} waiting)`);
  } catch (e) { console.error(String(e.stack || e)); process.exit(1); }
}
