#!/usr/bin/env node
// Tests that check this site's own profile values (its brand app names, its copy lengths, its media, its support links).
// A white-label build has other values by design, so its test runs skip these by name (node --test --test-skip-pattern):
// the mirror's workflow (workflow.mjs) and CI's white-label job here. Every other test runs on the build as it is.
//   node tools/whitelabel/mirror-skip.mjs <profile id> [--profiles=<dir>]   prints the pattern (empty when nothing is skipped)
// Node only. Tests: tests/node/whitelabel-build.test.mjs.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProfile, profilesDir } from './profile.mjs';

const plain = (p) => p.naming === 'plain', noMedia = (p) => !p.media, always = (p) => !!p;
const supportOff = (p) => !p.support || Object.values(p.support).some((v) => v === false);
export const SKIP = [
  { test: 'the system prompt: short, names the tools to load', why: 'the brand app names in the AI prompt', when: plain },
  { test: 'sorting by a column is stable, both directions, and missing values go last', why: 'the order of the brand app names', when: plain },
  { test: 'a label is the short part of the app title', why: 'the brand titles of the apps', when: plain },
  { test: 'the feature matrix: one value per tool', why: 'heading ids made from the brand app names', when: plain },
  { test: 'a guide page: the guide sidebar with it marked', why: 'the tutorial video, left out without media', when: noMedia },
  { test: "the guide: a sidebar of the app's pages", why: 'the tutorial video, left out without media', when: noMedia },
  { test: 'a page has the task, an Open link with the preset', why: 'the video thumbnail, left out without media', when: noMedia },
  { test: 'JSON-LD: breadcrumb to the app, HowTo steps, FAQ and the tutorial', why: 'the VideoObject, left out without media', when: noMedia },
  { test: 'the shipped brand/brand.json has the support block, all on', why: 'this site’s support links', when: supportOff },
  { test: 'each landing page has a description of 120 to 160 characters', why: 'the renamed copy is longer or shorter (the build writes it leniently)', when: always },
  { test: 'each page has a description of 120 to 160 characters', why: 'the renamed copy is longer or shorter (the build writes it leniently)', when: always },
];

/** One regular expression for --test-skip-pattern ('' when nothing applies). No quote characters, for shell and YAML. */
export function skipPattern(p) {
  return SKIP.filter((s) => s.when(p)).map((s) => '^' + s.test.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&').replace(/['"’]/g, '.')).join('|');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), id = args.find((a) => !a.startsWith('--'));
  const pa = args.find((a) => a.startsWith('--profiles='));
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  process.stdout.write(skipPattern(loadProfile(pa ? path.resolve(pa.slice(11)) : profilesDir(root), id)));
}
