// A mirror's own CI workflow, made from this repository's .github/workflows/rules.yml: the same jobs (file rules, Node
// tests, the browser suite in slices, the touch tests), without the steps that only make sense here (the changed-script
// rule, which needs this repository's history; the commit identity of this repository; the cdn check, which reads this
// repository's cdn), plus the smoke pages and the contrast sweep in slices. The build then renames it like every other file. Node only. Tests: tests/node/whitelabel-build.test.mjs.

/** Steps left out of a mirror, by the start of their name. */
export const DROP_STEPS = ['Every changed script has a test', 'Every cdn file answers'];

/** Jobs left out of a mirror: the white-label job builds mirrors, which a mirror cannot do; the sliced browser suite and
 * the touch jobs (a mirror runs the smoke pages instead, smokeJob). */
export const DROP_JOBS = ['whitelabel', 'plan', 'browser', 'touch'];

/** Slices of the contrast sweep in a mirror (tests/a11y/sweep-*, about 27 minutes of pages): each slice is one job. */
export const SWEEP_SHARDS = 6;

/** The workflow without a job and the comment lines just above it. */
function dropJob(yml, name) {
  const lines = yml.split('\n');
  const at = lines.findIndex((l) => l === `  ${name}:`);
  if (at < 0) return yml;
  let start = at;
  while (start > 0 && /^\s*#/.test(lines[start - 1])) start--;
  let end = at + 1;
  while (end < lines.length && !/^  [\w-]+:$/.test(lines[end]) && !/^  # /.test(lines[end])) end++;
  while (end > at + 1 && lines[end - 1].trim() === '') end--;
  return lines.slice(0, start).concat(lines.slice(end)).join('\n').replace(/\n{3,}/g, '\n\n');
}

/** The workflow text without the dropped jobs and steps and without the git identity lines. */
/** The mirror's browser job: the smoke pages (source paths; the build renames the whole workflow afterwards). */
export function smokeJob(yml, pages) {
  const image = (yml.match(/mcr\.microsoft\.com\/playwright:v[\w.-]+/) || ['mcr.microsoft.com/playwright:v1.64.1-noble'])[0];
  return `
  # Browser pages served from this repository: the smoke set. The full browser suite runs where the site is made.
  smoke:
    runs-on: ubuntu-24.04
    timeout-minutes: 20
    container:
      image: ${image}
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
      - run: npm ci --no-audit --no-fund
      - name: Browser smoke pages
        run: |
          printf '%s\\n' ${pages.join(' ')} > smoke-pages.txt
          node tests/run.mjs --skip-node --jobs=3 --pages-file=smoke-pages.txt
`;
}

/** The mirror's contrast sweep: every sweep page in the profile's own colours, in parallel slices (balanced by
 * tests/timings.json, which the build copies). */
export function sweepJob(yml, shards = SWEEP_SHARDS) {
  const image = (yml.match(/mcr\.microsoft\.com\/playwright:v[\w.-]+/) || ['mcr.microsoft.com/playwright:v1.64.1-noble'])[0];
  return `
  # The contrast sweep (tests/a11y/sweep-*) in this site's own colours, in ${shards} parallel slices.
  sweep:
    name: Contrast sweep \${{ matrix.shard }}/${shards}
    runs-on: ubuntu-24.04
    timeout-minutes: 20
    container:
      image: ${image}
    strategy:
      fail-fast: false
      matrix:
        shard: [${Array.from({ length: shards }, (_, i) => i + 1).join(', ')}]
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
      - run: npm ci --no-audit --no-fund
      - name: Contrast sweep, slice \${{ matrix.shard }} of ${shards}
        run: node tests/run.mjs a11y/sweep- --skip-node --jobs=3 --shard=\${{ matrix.shard }}/${shards}
`;
}

export function mirrorWorkflow(yml, skip = '', pages = [], sweep = true) {
  const lines = DROP_JOBS.reduce(dropJob, yml).split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)- name: (.*)$/);
    if (m && DROP_STEPS.some((d) => m[2].startsWith(d))) {
      const ind = m[1].length;
      while (i + 1 < lines.length && !(lines[i + 1].trim() && lines[i + 1].search(/\S/) <= ind)) i++;
      continue;
    }
    if (/^\s*git config user\.(name|email) /.test(lines[i])) continue;
    out.push(lines[i]);
  }
  // the tests that pin this site's own profile values are skipped by name (mirror-skip.mjs)
  const node = skip ? `node --test '--test-skip-pattern=${skip}' tests/node/` : 'node --test tests/node/';
  return (out.join('\n').replace(/\s*$/, '\n') + (pages.length ? smokeJob(yml, pages) : '') + (sweep ? sweepJob(yml) : '')).replace('node --test tests/node/', node)
    .replace(/^# The file rules[\s\S]*?\n(?=on:)/m, '# Generated with the site: the file rules, the Node tests and the browser tests, on every push.\n')
    .replace(/name: Set up the repo as a clone is[^\n]*/, 'name: Install the test dependencies')
    .replace(/^( *)run: (node --test '--test-skip-pattern=.*)$/m, (all, ind, cmd) => `${ind}run: |\n${ind}  ${cmd}`);   // a block scalar: test names hold ": ", which a plain YAML value cannot
}
