/* Runs the conversions over a batch. 'each' conversions run once per file, 'combine' ones once for all their files.
 * A failure in one group is recorded against those files and the rest of the batch carries on.
 *   convertAll(conv, items, opts, progress)          one conversion over its files
 *   runGroups(groups, optsFor, progress)             every file with its own target: groups from targets.js groupsFor
 *   firstUseGate()                                   the video engine's first-download notice (once) */
export async function convertAll(conv, items, opts, progress) {
  const outputs = [], errors = [], info = [];
  const groups = conv.mode === 'combine' ? [items] : items.map((i) => [i]);
  for (let g = 0; g < groups.length; g++) {
    if (progress) progress(g, groups.length);
    const inputs = groups[g].map((i) => ({ name: i.name, file: i.file, kind: i.kind }));
    try {
      const res = await conv.run(inputs, opts);
      outputs.push(...res);
      if (res.info) info.push(res.info);
    } catch (e) {
      errors.push({ ids: groups[g].map((i) => i.id), message: (e && e.message) || String(e) });
    }
  }
  return { outputs, errors, info };
}

/** groups: [{ conv, items }]. optsFor(conv) gives that conversion's option values. progress(done, total) counts runs. */
export async function runGroups(groups, optsFor, progress) {
  const all = { outputs: [], errors: [], info: [] };
  const units = (g) => (g.conv.mode === 'combine' ? 1 : g.items.length);
  const total = groups.reduce((n, g) => n + units(g), 0);
  let done = 0;
  for (const g of groups) {
    const res = await convertAll(g.conv, g.items, optsFor(g.conv), (i) => progress && progress(done + i, total));
    done += units(g);
    all.outputs.push(...res.outputs); all.errors.push(...res.errors); all.info.push(...res.info);
  }
  return all;
}

/** The notice before the video engine's first download: shown once, and only when a video conversion runs (catalog
 *  entries with engine: 'ffmpeg'). Every other conversion needs no download and starts without asking. */
const FIRST_USE = {
  title: 'Download the video engine?',
  lines: ['Converting a video needs the video engine. It is downloaded once and kept by this browser for next time. Your files are still read on this device and never uploaded.'],
  downloads: [{ name: 'Video engine (ffmpeg.wasm)', bytes: 32344223 }],
};
let firstUse = null;
/** Resolves true when the work may go on. Cancelling clears the gate, so the next drop asks again. */
export function firstUseGate() {
  if (!firstUse) firstUse = window.SlopFirstRun ? window.SlopFirstRun.once('convert', FIRST_USE) : Promise.resolve(true);
  return firstUse.then((ok) => { if (!ok) firstUse = null; return ok; });
}
