/* Runs one conversion over a batch. 'each' conversions run once per file, 'combine' ones once for all.
 * A failure in one group is recorded against those files and the rest of the batch carries on. */
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
