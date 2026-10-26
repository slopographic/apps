#!/usr/bin/env node
// Tests that check this site's own profile values (its brand app names, its copy lengths, its media, its support links).
// A white-label build has other values by design, so its test runs skip these by name (node --test --test-skip-pattern):
// the mirror's workflow (workflow.mjs) and CI's white-label job here. Every other test runs on the build as it is.
//   node tools/whitelabel/mirror-skip.mjs <profile id> [--profiles=<dir>]   prints the pattern (empty when nothing is skipped)
//   node tools/whitelabel/mirror-skip.mjs <profile id> --smoke               prints the smoke pages, renamed for the build
// Node only. Tests: tests/node/whitelabel-build.test.mjs.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProfile, loadMap, profilesDir } from './profile.mjs';
import { renamePath, tokenRules } from './rename.mjs';

const otherLang = (p) => p.defaultLang !== 'en';
const plain = (p) => p.naming === 'plain', noMedia = (p) => !p.media, always = (p) => !!p;
const supportOff = (p) => !p.support || Object.values(p.support).some((v) => v === false);
export const SKIP = [
  { test: 'every workflow limits its GITHUB_TOKEN: a top-level permissions block, read-only unless a job asks for more', why: 'counts this site\'s workflows; a mirror has only its own rules.yml', when: always },
  { test: 'the preview copy is the only place that adds noindex to every page', why: 'reads this site\'s preview workflow, which a mirror does not get', when: always },
  { test: 'the browser tests run only in the slices the plan job asks for', why: 'a mirror runs the smoke pages, not the sliced suite', when: always },
  { test: 'the touch jobs run the touch-marked pages', why: 'a mirror runs the smoke pages, not the touch jobs', when: always },
  { test: 'the system prompt: short, names the tools to load', why: 'the brand app names in the AI prompt', when: plain },
  { test: 'sorting by a column is stable, both directions, and missing values go last', why: 'the order of the brand app names', when: plain },
  { test: 'a label is the short part of the app title', why: 'the brand titles of the apps', when: plain },
  { test: 'the feature matrix: one value per tool', why: 'heading ids made from the brand app names', when: plain },
  { test: 'a guide page: the guide sidebar with it marked', why: 'the tutorial video, left out without media', when: noMedia },
  { test: "the guide: a sidebar of the app's pages", why: 'the tutorial video, left out without media', when: noMedia },
  { test: 'a page has the task, an Open link with the preset', why: 'the video thumbnail, left out without media', when: noMedia },
  { test: 'JSON-LD: breadcrumb to the app, HowTo steps, FAQ and the tutorial', why: 'the VideoObject, left out without media', when: noMedia },
  { test: 'the default choice is one literal after the profile marker, on one line, and English in this repo', why: 'this site starts in English', when: otherLang },
  { test: 'with the default (en) the site starts in English', why: 'this site starts in English', when: otherLang },
  { test: 'the language list is data: English first', why: 'checks the start language too', when: otherLang },
  { test: 'with nothing stored the choice is English', why: 'this site starts in English', when: otherLang },
  { test: 'the shipped brand/brand.json has the support block, all on', why: 'this site’s support links', when: supportOff },
  { test: 'COVERAGE.md and tables.covers.txt are up to date', why: 'the report names this site\'s apps and files; the build renames them', when: always },
  { test: 'each landing page has a description of 120 to 160 characters', why: 'the renamed copy is longer or shorter (the build writes it leniently)', when: always },
  { test: 'each page has a description of 120 to 160 characters', why: 'the renamed copy is longer or shorter (the build writes it leniently)', when: always },
];

/** Browser pages a mirror runs on every push (source paths; the build renames them). They check the shell, the language
 * layer, the brand, and the look of the main apps, and none of them pins this site's names, mascot or media. The full
 * browser suite runs here, on the source; the contrast sweep runs in a mirror as its own job (workflow.mjs sweepJob). */
export const SMOKE = ['tests/i18n/default-lang.test.html', 'tests/i18n/switch.test.html', 'tests/shell/drawer.test.html',
  'tests/shell/brand.test.html', 'tests/photoslop/welcome.test.html', 'tests/pdf/pages.test.html', 'tests/drive/look.test.html',
  'tests/tables/look.test.html', 'tests/docs/look.test.html', 'tests/settings/look.test.html', 'tests/how-it-works/how-it-works.test.html',
  'tests/invoices/workspace.test.html'];

/** The smoke pages for a profile: the language switch test starts from English, so a build that starts elsewhere skips it. */
export const smokeFor = (p) => SMOKE.filter((f) => !(otherLang(p) && f === 'tests/i18n/switch.test.html'));

/** One regular expression for --test-skip-pattern ('' when nothing applies). No quote characters, for shell and YAML. */
export function skipPattern(p) {
  return SKIP.filter((s) => s.when(p)).map((s) => '^' + s.test.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&').replace(/['"’]/g, '.')).join('|');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), id = args.find((a) => !a.startsWith('--'));
  const pa = args.find((a) => a.startsWith('--profiles='));
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const dir = pa ? path.resolve(pa.slice(11)) : profilesDir(root);
  if (!args.includes('--smoke')) process.stdout.write(skipPattern(loadProfile(dir, id)));
  else { const map = loadMap(dir, id); process.stdout.write(smokeFor(loadProfile(dir, id)).map((f) => (map ? renamePath(f, tokenRules(map)) : f)).join('\n') + '\n'); }
}
