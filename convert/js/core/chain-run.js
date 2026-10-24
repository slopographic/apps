/* Runs a route (chain.js): each step's outputs are the next step's inputs. An 'each' step runs once per input, so a step
 * that made several files (PDF to images: one per page) has the next step mapped over each of them; a 'combine' step
 * (Images to PDF) takes the whole set at once. A failure stops only the files it came from, and says which step failed.
 * Pure orchestration: the work is the converters' own run(files, options). No DOM.
 *   runChain(steps, items, { optsFor, progress, keep })
 *     steps     [{ conv, fmt, to }]: to is the kind the step makes (the next step's input kind)
 *     items     [{ id, name, file, kind }]: the original files
 *     optsFor(conv, item, i)  the option values of step i for that file (a combine step takes its first file's)
 *     progress({ step, steps, from, to, done, total })  before every run
 *     keep(item)  true: that file's in-between outputs are returned too
 *   -> { outputs, middles, errors: [{ ids, step, message }], info } */
import { TAG } from './chain.js';

const asFile = (o) => (typeof File === 'function' && !(o.blob instanceof File) ? new File([o.blob], o.name, { type: o.blob.type || '' }) : o.blob);
const uniq = (list) => [...new Set(list)];

export async function runChain(steps, items, { optsFor = () => ({}), progress = null, keep = null } = {}) {
  const errors = [], info = [], middles = [];
  let cur = items.map((it) => ({ name: it.name, file: it.file, kind: it.kind, src: [it] }));
  let kinds = items.length ? items[0].kind : '';
  for (let i = 0; i < steps.length && cur.length; i++) {
    const { conv, fmt, to } = steps[i], last = i === steps.length - 1;
    const units = conv.mode === 'combine' ? [cur] : cur.map((x) => [x]), next = [];
    const label = `${TAG(kinds)} → ${TAG(to || conv.ext)}`;
    for (let u = 0; u < units.length; u++) {
      const unit = units[u], src = uniq(unit.flatMap((x) => x.src));
      if (progress) progress({ step: i + 1, steps: steps.length, from: kinds, to: to || conv.ext, done: u, total: units.length });
      try {
        const opts = { ...optsFor(conv, src[0], i), ...(fmt ? { format: fmt } : {}) };
        const res = await conv.run(unit.map(({ name, file, kind }) => ({ name, file, kind })), opts);
        if (res.info) info.push(res.info);
        for (const o of res) next.push({ name: o.name, file: asFile(o), blob: o.blob, kind: to || conv.ext, src });
        if (!res.length) throw new Error('It made no file.');
      } catch (e) {
        const message = (e && e.message) || String(e);
        errors.push({ ids: src.map((s) => s.id), step: i + 1, message: steps.length > 1 ? `Step ${i + 1} of ${steps.length} (${label}) failed: ${message}` : message });
      }
    }
    if (!last && keep) for (const o of next) if (o.src.some((s) => keep(s))) middles.push({ name: o.name, blob: o.blob, step: i + 1 });
    cur = next;
    kinds = to || conv.ext;
  }
  return { outputs: cur.map((o) => ({ name: o.name, blob: o.blob, src: o.src.map((s) => s.id) })), middles, errors, info: uniq(info) };
}
