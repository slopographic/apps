/* Slop Workflows: does each step fit the files the step before makes? Pure (the registry is passed in), Node-tested.
 *   check(steps, inputKinds, R)   steps: the workflow's steps ({ id, options }); inputKinds: the kinds of the files in
 *                                 (empty: none yet, so the first step's own kinds are assumed); R: shared/ops/registry.js
 *     → [{ ok, op, in: [kinds] | null, out: [kinds] | null, message }] one per step; null kinds = any (a step that takes
 *       any file and keeps it, Rename, before anything fixes the kind)
 *   firstProblem(result) → { index, message } | null
 *   kindsLabel(kinds) → 'PNG, JPG'  */
import { TAG } from '../../../convert/js/core/chain.js';

export const kindsLabel = (kinds) => (kinds && kinds.length ? kinds.map(TAG).join(', ') : 'any file');
const uniq = (list) => [...new Set(list)];

/** The kinds a workflow with no files yet is checked against: what its first step takes (none for "any file"). */
export function assumedKinds(op) {
  if (!op || op.from.includes('*')) return null;
  return op.from.slice();
}

export function check(steps, inputKinds, R) {
  const out = [];
  let kinds = inputKinds && inputKinds.length ? uniq(inputKinds) : null;
  steps.forEach((s, i) => {
    const op = R.byId(s.id);
    if (!op) { out.push({ ok: false, op: null, in: kinds, out: null, message: `This step (${s.id}) is not available on this page.` }); kinds = null; return; }
    if (i === 0 && kinds === null) kinds = assumedKinds(op);
    const opts = { ...R.defaultsOf(op), ...(s.options || {}) };
    const bad = kinds ? kinds.filter((k) => !R.accepts(op, k)) : [];
    let message = '';
    if (kinds && bad.length) {
      const prev = i ? `step ${i} (${(R.byId(steps[i - 1].id) || { label: steps[i - 1].id }).label})` : '';
      message = i === 0 ? `${op.label} cannot take ${kindsLabel(bad)} files. It takes ${kindsLabel(op.from)}.`
        : `${op.label} cannot take ${kindsLabel(bad)}, which ${prev} makes. It takes ${kindsLabel(op.from)}.`;
    }
    if (!message && op.check) { try { message = op.check(opts) || ''; } catch (e) { message = e.message; } }
    // what goes on to the next step; when the kinds are not known (or none fit), the next step is not judged by them
    const made = kinds ? uniq(kinds.filter((k) => R.accepts(op, k)).map((k) => R.outOf(op, k, opts))) : op.ext ? [op.ext] : null;
    out.push({ ok: !message, op, in: kinds, out: made && made.length ? made : null, message });
    kinds = made && made.length ? made : null;
  });
  return out;
}

export function firstProblem(result) {
  const i = result.findIndex((r) => !r.ok);
  return i < 0 ? null : { index: i, message: `Step ${i + 1}: ${result[i].message}` };
}
