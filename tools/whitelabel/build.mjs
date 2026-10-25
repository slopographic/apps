#!/usr/bin/env node
// Builds the whole site for one brand profile into a folder: the white-label copy that a mirror repository publishes.
//   node tools/whitelabel/build.mjs <profile id> <out dir> [--profiles=<dir>] [--no-images] [--no-seo] [--release=<text>]
// --profiles: the folder that holds <id>.json and <id>.map.json (default brand/profiles). Real brands' profiles live
// outside this repository; brand/profiles/sample.json is the made-up one CI builds.
// Steps: copy every file of the working tree (git ls-files) except the source brand's own files (EXCLUDE), rename paths
// and text through the profile's map (rename.mjs), set the profile markers, write the generated files (emit.mjs), run the
// SEO writer and the precache list in the copy, render the icons (images.mjs), then scan for leftovers (scan.mjs) and
// exit 1 when the scan finds any. A profile without a map file (slopographic) is copied as it is.
// The out dir's .git folder is kept, so a mirror checkout can be rebuilt in place. Tests: tests/node/whitelabel-build.test.mjs.
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProfile, loadMap, forbiddenTerms, profilesDir } from './profile.mjs';
import { urls, phrases, tokens, collisions } from './rename.mjs';
import { context, profileText, forward, forwardPath } from './transform.mjs';
import { markerValues, applyMarkers, brandJson, markSvg, logoSvg, manifest, mit, notice, trademarks, security, readme } from './emit.mjs';
import { mirrorWorkflow } from './workflow.mjs';
import { skipPattern } from './mirror-skip.mjs';
import { isText, scan, report } from './scan.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Third-party files where a match is not a name: reported as allowed, never fixed. */
export const SCAN_ALLOW = [
  { file: 'vendor/models/isnet-general-w8.onnx', term: 'slop', why: 'four bytes of the model weights happen to spell it ("PRSLOPHJM"); not text' },
];

/** Model files carry the name of the tool that wrote them in a string field: the same number of bytes, so the file
 * stays valid. Other binaries are copied as they are (the scan reports any name left in them). */
export function patchBinary(file, buf) {
  if (!/\.onnx$/.test(file) || !buf.includes('slopographic')) return buf;
  return Buffer.from(buf.toString('latin1').split('slopographic').join('modelbuilder'), 'latin1');
}

/** Files of the source brand that a renamed build leaves out (it writes its own where one is needed). */
export function excluded(file, p) {
  if (/^(brand\/profiles|brand\/copy|tools\/whitelabel)\//.test(file) || file === 'brand/README.md') return true;
  // this repository's own rules: the commit identity (its workflow and test), and rules.yml, which the build rewrites
  if (/^\.github\/workflows\/(commit-authors|rules)\.yml$/.test(file) || file === 'tests/node/attribution.test.mjs') return true;
  if (/^tests\/node\/whitelabel-/.test(file)) return true;
  if (/^(TRADEMARKS\.md|NOTICE\.md|LICENSE|LICENSE-ART|README\.md|SECURITY\.md|CNAME|favicon\.svg|favicon\.ico|og-share\.png)$/.test(file)) return true;
  if (/^[^/]+\.png$/.test(file)) return true;                                               // stray root screenshots
  if (/^brand\/logo(-128)?\.(webp|svg)$/.test(file) || /^assets\/icons\//.test(file)) return true;
  if (file === 'ads.txt' && !(p.support && p.support.ads)) return true;
  if (!p.media && /^assets\/(shots|clips|video|promo|guides)\//.test(file)) return true;
  return false;
}

/** True for valid UTF-8 (fixtures in Windows-1252 or CP437 are copied as bytes, never decoded and re-encoded). */
export const isUtf8 = (buf) => { try { new TextDecoder('utf-8', { fatal: true }).decode(buf); return true; } catch (e) { return false; } };
const sh = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'inherit'], env: Object.assign({}, process.env, { SEO_LENIENT: '1' }) });
const write = (out, rel, data) => { const f = path.join(out, rel); mkdirSync(path.dirname(f), { recursive: true }); writeFileSync(f, data); };

/** Empties out (keeping .git) or creates it. Refuses the repo itself and its parents. */
function prepareOut(out) {
  const rel = path.relative(out, ROOT);
  if (!rel || !rel.startsWith('..')) throw new Error(`refusing to build into ${out}: it is the repository or holds it`);
  mkdirSync(out, { recursive: true });
  for (const e of readdirSync(out)) if (e !== '.git') rmSync(path.join(out, e), { recursive: true, force: true });
}

export function build(id, out, opts = {}) {
  const dir = opts.profiles || profilesDir(ROOT);
  const p = loadProfile(dir, id);
  const map = loadMap(dir, id);
  out = path.resolve(out);
  prepareOut(out);
  const files = sh('git', ['ls-files', '-co', '--exclude-standard', '-z'], ROOT).split('\0').filter((f) => f && existsSync(path.join(ROOT, f)));
  const values = markerValues(p);
  const log = (s) => { if (!opts.quiet) console.log(s); };
  if (!map) {                                   // the source brand itself: a plain copy with its own profile values
    for (const f of files) {
      const buf = readFileSync(path.join(ROOT, f));
      write(out, f, isText(buf) ? applyMarkers(buf.toString('utf8'), values) : buf);
    }
    log(`${p.id}: copied ${files.length} files to ${out}`);
    return { profile: p, out, files: files.length, found: [] };
  }
  const ctx = context(ROOT, p, map);
  const seen = new Map(), clashes = [];
  let n = 0;
  for (const f of files) {
    if (excluded(f, p)) continue;
    const dest = forwardPath(f, ctx);
    if (seen.has(dest)) throw new Error(`two files map to ${dest}: ${seen.get(dest)} and ${f}`);
    seen.set(dest, f);
    const buf = readFileSync(path.join(ROOT, f));
    if (!isText(buf) || !isUtf8(buf)) { write(out, dest, patchBinary(f, buf)); n++; continue; }   // other encodings stay byte for byte
    const src = buf.toString('utf8');
    for (const [t, c] of collisions(profileText(src, ctx), map)) clashes.push(`${f}: '${t}' x${c}`);
    write(out, dest, forward(src, ctx, dest));
    n++;
  }
  for (const [t] of collisions(files.join('\n'), map)) clashes.push(`(file names): '${t}'`);
  if (clashes.length) throw new Error(`the rename map's targets already occur in the source, so the reverse would be ambiguous:\n  ${clashes.slice(0, 40).join('\n  ')}`);
  emit(out, p, opts, ctx);
  log(`${p.id}: wrote ${n} files to ${out}`);
  const node = process.execPath;
  if (!opts.noImages) sh(node, [path.join(ROOT, 'tools/whitelabel/images.mjs'), out]);   // before the precache list, which hashes them
  if (!opts.noSeo) { sh(node, ['tools/seo/write.mjs'], out); sh(node, ['tools/pwa-precache.mjs'], out); }
  const res = scan(out, forbiddenTerms(dir, p), SCAN_ALLOW.concat(p.scanAllow || []), { account: p.github.toLowerCase() });
  log(report(res));
  return { profile: p, out, files: n, found: res.found, allowed: res.allowed };
}

/** The files written from the profile rather than copied. */
function emit(out, p, opts, ctx) {
  write(out, 'brand/brand.json', JSON.stringify(brandJson(JSON.parse(readFileSync(path.join(out, 'brand/brand.json'), 'utf8')), p), null, 2) + '\n');
  write(out, 'CNAME', p.cname + '\n');
  write(out, 'LICENSE', mit(p));
  write(out, 'NOTICE.md', notice(p));
  write(out, 'TRADEMARKS.md', trademarks(p));
  write(out, 'SECURITY.md', security(p));
  write(out, 'README.md', readme(p, opts.release));
  write(out, 'brand/mark.svg', markSvg(p));
  write(out, 'brand/logo.svg', logoSvg(p));
  write(out, 'favicon.svg', markSvg(p));
  write(out, 'manifest.webmanifest', manifest(readFileSync(path.join(out, 'manifest.webmanifest'), 'utf8'), p));
  const trial = path.join(out, 'shared/agent/trial-tokens.json');
  if (existsSync(trial)) { const t = JSON.parse(readFileSync(trial, 'utf8')); t.tokens = []; writeFileSync(trial, JSON.stringify(t, null, 2) + '\n'); }
  const wf = readFileSync(path.join(ROOT, '.github/workflows/rules.yml'), 'utf8');
  write(out, '.github/workflows/rules.yml', tokens(phrases(urls(mirrorWorkflow(wf, skipPattern(p)), ctx.urls), ctx.phraseRules), ctx.tokenRules));
  write(out, '.nojekyll', '');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2), pos = args.filter((a) => !a.startsWith('--'));
  const opt = (k) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : null; };
  if (pos.length !== 2) { console.error('usage: build.mjs <profile id> <out dir> [--profiles=<dir>] [--no-images] [--no-seo] [--release=<text>]'); process.exit(2); }
  try {
    const r = build(pos[0], pos[1], { profiles: opt('profiles') && path.resolve(opt('profiles')), release: opt('release'), noImages: args.includes('--no-images'), noSeo: args.includes('--no-seo') });
    process.exit(r.found.length ? 1 : 0);
  } catch (e) { console.error(String(e.message || e)); process.exit(1); }
}
