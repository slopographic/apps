// A test page that is about a feature a brand profile can leave out says so in its head:
//   <meta name="slop-test-needs" content="mascot=builtin">           the built-in buddy engine (shared/buddy)
//   <meta name="slop-test-needs" content="mascot=builtin|overlay">   any mascot; "media=true", "tone=playful", ...
// (conditions on the brand facts, tests/brand-facts.js; several are joined with ";", and every one must hold). tests/run.mjs
// runs such a page only in a build whose facts fit, and names the pages it left out and why. A build without the feature
// has a page of its own for the switch's other side (for the mascot: tests/buddy/off.test.html). Node only.
// Tests: tests/node/test-needs.test.mjs.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The brand facts of this checkout (tests/brand-facts.js). */
export function loadFacts(root = ROOT) {
  const g = {};
  vm.runInNewContext(readFileSync(path.join(root, 'tests/brand-facts.js'), 'utf8'), g);
  return g.BRAND_FACTS;
}

/** A page's conditions, [{ key, values }], from its slop-test-needs meta (none: []). */
export function needsOf(html) {
  const m = /<meta name="slop-test-needs" content="([^"]*)">/.exec(html);
  if (!m) return [];
  return m[1].split(';').map((c) => c.trim()).filter(Boolean).map((c) => {
    const [key, vals] = c.split('=');
    if (!key || vals === undefined) throw new Error(`slop-test-needs: "${c}" is not key=value`);
    return { key: key.trim(), values: vals.split('|').map((v) => v.trim()) };
  });
}

/** The conditions that do not hold for the facts (an unknown key is an error, so a typo never hides a page). */
export function unmet(needs, facts) {
  return needs.filter(({ key, values }) => {
    if (!Object.prototype.hasOwnProperty.call(facts, key)) throw new Error(`slop-test-needs: no brand fact "${key}"`);
    return !values.includes(String(facts[key]));
  });
}
