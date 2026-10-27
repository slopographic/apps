// One text file of the site, turned into its white-label copy, and back: the steps build.mjs runs on every text file
// (forward) and the steps import.mjs runs on a change made in a mirror (back). Every step keeps the line count, so a
// line of a mirror file is the image of the same line of the source file (where the build did not regenerate it).
// Node only. Tests: tests/node/whitelabel-import.test.mjs, tests/node/whitelabel-roundtrip.test.mjs.
import { urls, phraseRules, phrases, tokenRules, reverseRules, tokens, renamePath } from './rename.mjs';
import { phrasePairs } from './profile.mjs';
import { markerValues, applyMarkers } from './emit.mjs';
import { remapColors, paletteFile } from './palette.mjs';

/** Everything the steps need for one profile and its rename map. */
export function context(root, p, map) {
  const pairs = phrasePairs(root, p), values = markerValues(p), rules = tokenRules(map);
  // the app ids a marker names are renamed like the registry's own (a source id never reaches a build)
  for (const k of ['hideApps', 'mainApp']) values[k] = JSON.parse(tokens(JSON.stringify(values[k]), rules));
  return {
    profile: p, map, pairs,
    urls: { origin: p.origin, github: p.github, repo: p.publish && p.publish.repo, mail: p.mailDomain || p.cname },
    phraseRules: phraseRules(pairs, p.brandWord || p.name),
    tokenRules: rules, reverseRules: reverseRules(map), values,
  };
}

/** The profile's content steps (one way): links, visible names. Their result is what the token pass renames. */
export const profileText = (text, ctx) => phrases(urls(text, ctx.urls), ctx.phraseRules);

/** The whole forward step for one file (dest: its path in the copy, for the palette rule). */
export function forward(text, ctx, dest) {
  let t = applyMarkers(tokens(profileText(text, ctx), ctx.tokenRules), ctx.values);
  t = t.replace(/brand\/logo(?:-128)?\.webp/g, 'brand/mark.svg');
  if (ctx.profile.palette && paletteFile(dest)) t = remapColors(t, ctx.profile.palette);
  return t;
}

/** A source path in the copy, and a copy path back in the source. */
export const forwardPath = (file, ctx) => renamePath(file, ctx.tokenRules);
export const backPath = (file, ctx) => renamePath(file, ctx.reverseRules);

/** Lines that hold the profile's own words cannot be turned back by rule (the source said something else there). */
export function profileWords(ctx) {
  const p = ctx.profile, host = p.origin.replace(/^https:\/\//, '');
  return [p.name, host, ...(p.brandTerms || [])].filter(Boolean);
}

/** One line of a mirror file, back in source terms. old: the source lines the mirror's old lines came from (the same
 * place), used to put a source word back where the profile's step replaced it (a name, a link, a marker value, a colour).
 * Returns { line, sure }: sure when the forward step of the result gives the mirror line back exactly. */
export function backLine(mirrorLine, old, ctx, dest) {
  const fwd = (s) => forward(s, ctx, dest);
  let line = tokens(mirrorLine, ctx.reverseRules);
  const oldText = old.join('\n');
  const pairs = sourcePairs(oldText, ctx, dest).filter(([src, dst]) => dst && src !== dst && !oldText.includes(dst));
  for (const [src, dst] of pairs.sort((a, b) => b[1].length - a[1].length)) {
    if (!line.includes(dst)) continue;
    const next = line.split(dst).join(src);
    if (fwd(next) === mirrorLine) line = next;
  }
  return { line, sure: fwd(line) === mirrorLine };
}

/** [source text, what the profile's steps made of it] for everything in the old lines that the steps change. */
function sourcePairs(oldText, ctx, dest) {
  const out = ctx.pairs.filter(([src]) => oldText.includes(src));
  for (const m of oldText.matchAll(/https?:\/\/[^\s"'<>)]+/g)) out.push([m[0], urls(m[0], ctx.urls)]);
  for (const m of oldText.matchAll(/\/\*profile:\w+\*\/('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|true|false|null|-?\d+|\[\]|\{\})/g)) out.push([m[0], applyMarkers(m[0], ctx.values)]);
  for (const m of oldText.matchAll(/brand\/logo(?:-128)?\.webp/g)) out.push([m[0], 'brand/mark.svg']);
  if (ctx.profile.palette && paletteFile(dest)) {
    for (const m of oldText.matchAll(/#[0-9a-fA-F]{3,8}\b|\brgba?\([^)]*\)/g)) out.push([m[0], remapColors(m[0], ctx.profile.palette)]);
  }
  return out;
}
