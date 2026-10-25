/* Checksum for the assistant: SlopCmd commands with arguments, loaded on demand by SlopCmd.prepare() (checksum.js).
 * The page's own hashing (Web Crypto, SlopChecksum.use): hash_file (a Slop Drive file, any algorithm, optionally checked
 * against a published hash; the page shows the same result) and save_hash (a "<hash>  <name>" file such as name.sha256,
 * to Slop Drive and/or a download). Nothing to create or edit: the tool reads files and writes no documents. */
(function () {
  'use strict';
  const C = window.SlopCmd, K = () => window.SlopChecksum;
  if (!C || C.get('checksum.ai.hash-file')) return;
  const ALGS = ['SHA-256', 'SHA-384', 'SHA-512', 'SHA-1'];
  const add = (tool, title, args, run, extra) => Object.assign({ id: 'checksum.ai.' + tool.replace(/_/g, '-'), tool, title, group: 'AI', hidden: true, destructive: false, args,
    run: (a) => run(a || window.SlopCmdArgs.defaults(args)) }, extra);
  async function driveFile(q) {
    const H = window.SlopHub, s = String(q).toLowerCase(), all = await H.list();   // intake-ok: an AI command looks a Drive file up by name or id (a lookup; the person's picker is SlopIntake.fromDrive)
    const hit = all.find((f) => f.id === q) || all.find((f) => f.name.toLowerCase() === s) || all.find((f) => f.name.toLowerCase().includes(s));
    if (!hit) throw new Error(`No Slop Drive file “${q}”`);
    const rec = await H.get(hit.id);
    return new File([rec.blob], rec.name, { type: rec.type || rec.blob.type });
  }
  C.register([
    add('hash_file', 'Hash a file', [{ name: 'file', type: 'string', required: true, maxLength: 300, description: 'Slop Drive name or id' },
      { name: 'algorithm', type: 'enum', values: ALGS, default: 'SHA-256' }, { name: 'expected', type: 'string', maxLength: 200, description: 'a published hash to check against' }],
    async (a) => {
      const r = await K().use(await driveFile(a.file), a.algorithm, a.expected || '');
      return { hash: r.hash, algorithm: a.algorithm, verdict: r.verdict || null };
    }, { description: 'The SHA-256 (or SHA-384, SHA-512, SHA-1) of a Slop Drive file, and whether it matches a published hash.', macro: false }),
    add('save_hash', 'Save the hash as a file', [{ name: 'to', type: 'enum', values: ['drive', 'download', 'both'], default: 'drive' }], async (a) => {
      const cur = K().current();
      if (!cur.hash) throw new Error('Hash a file first (hash_file)');
      const ext = cur.algorithm.toLowerCase().replace('-', ''), name = `${cur.file}.${ext}`, blob = new Blob([`${cur.hash}  ${cur.file}\n`], { type: 'text/plain' }), out = [];
      if (a.to !== 'download') out.push(`Saved ${name} to Slop Drive (id ${await window.SlopHub.put(blob, { name, from: 'checksum' })})`);
      if (a.to !== 'drive') { window.SlopUI.download(blob, name); out.push(`downloaded ${name}`); }
      return out.join(' and ') + '.';
    }),
  ]);
  C.provide({ state: () => Object.assign({ app: 'Checksum' }, K().current()), checkpoint: () => () => true });
})();
