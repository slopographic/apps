/* SlopCentral: "Export everything" and "Import everything" for the whole suite, in one versioned file.
 *   <name>.slop-backup.json  format "slop-backup", version 2 (shared/backup/HANDOFF.md)
 *   SlopCentral.ready()                 loads the parts and the Slop Data scripts (idempotent)
 *   SlopCentral.exportEverything(opts)  → { name, blob, size, envelope, rows, excluded }   opts.includeSession, opts.onProgress
 *   SlopCentral.plan(input)             → { ok, errors, source, created, rows, excluded, envelope }  reads, validates and
 *                                         migrates. Writes nothing.
 *   SlopCentral.apply(plan, opts)       → { ok, applied, skipped, errors, rolledBack }  all or nothing
 *   SlopCentral.openDialog(opts)        the dialog (central-ui.js); opts.onRestored(result)
 * This file knows no app's storage: apps register with SlopBackup.registerApp (central-apps.js has the built-in ones).
 * Parts: central-format.js (file and envelope), central-idb.js (IndexedDB stores), central-apps.js, central-ui.js. */
(function () {
  'use strict';
  if (window.SlopCentral) return;
  const B = window.SlopBackup;
  const C = (window.SlopCentral = {});
  const FORMAT = 'slop-backup', VERSION = 2;
  const PARTS = ['central-format.js', 'central-idb.js', 'central-apps.js'];
  // What never leaves this browser. Listed in every file so the person can see what is not in it.
  const EXCLUDED = [
    { source: 'Slop Sync sign-in tokens (IndexedDB slop-sync)', reason: 'secrets: they never leave this browser' },
    { source: 'Your own AI provider keys (IndexedDB slop-ai-keys)', reason: 'secrets: they never leave this browser' },
    { source: 'Slop Sync settings and pending queue (localStorage slop-sync, slop-sync-pending)', reason: 'tied to this browser and its cloud accounts' },
    { source: 'Consent record (localStorage slop-consent)', reason: 'consent choices stay in each browser' },
    { source: 'Drive thumbnails (IndexedDB slop-drive-thumbs)', reason: 'a cache, made again on demand' },
    { source: 'Music analysis cache (IndexedDB slop-music, analysis)', reason: 'a cache, made again from the tracks' },
    { source: 'Autosaved drafts of each app', reason: 'not part of this format yet' },
    { source: 'Other settings and saves in localStorage', reason: 'only the apps listed in this file are covered' },
  ];
  let readyP = null;

  /** Loads the parts once. Resolves when they are all there and the Slop Data scripts are loaded. */
  function ready() {
    if (!readyP) readyP = (async () => {
      await B.ready();
      for (const f of PARTS) await B.load('shared/backup/' + f);
      await C.apps.loadData();
    })().catch((e) => { readyP = null; throw e; });
    return readyP;
  }

  const sectionsOf = (def, env) => (def.part === 'settings' ? env.settings : env.apps);
  const pad = (n) => String(n).padStart(2, '0');

  /** Builds the file from every registered app. An app that cannot be read is left out and listed as excluded. */
  async function exportEverything(opts = {}) {
    await ready();
    const env = { format: FORMAT, version: VERSION, created: new Date().toISOString(), apps: {}, settings: {}, registry: [], excluded: EXCLUDED.map((x) => ({ ...x })) };
    const rows = [];
    for (const def of B.defs()) {
      env.registry.push(def.id);
      if (def.optional && opts.includeSession === false) { env.excluded.push({ source: def.label, reason: 'left out by choice' }); continue; }
      if (opts.onProgress) opts.onProgress(`Reading ${def.label}…`);
      try {
        const data = await def.exportData();
        sectionsOf(def, env)[def.id] = { version: def.version, data };
        rows.push({ id: def.id, label: def.label, counts: C.format.countsOf(data) });
      } catch (e) {
        env.excluded.push({ source: def.label, reason: `could not be read, so it is not in this file (${e && e.message ? e.message : e})` });
      }
    }
    const text = JSON.stringify(env);
    const errors = C.format.validateEnvelope(JSON.parse(text)); // the file must read back before it is offered
    if (errors.length) throw new Error(`The backup could not be checked: ${errors[0]}`);
    const d = new Date();
    const name = `slopographic-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.slop-backup.json`;
    const blob = new Blob([text], { type: 'application/json' });
    return { name, blob, size: blob.size, envelope: env, rows, excluded: env.excluded };
  }

  /** Runs a def's migrations from the section's version up to the current one. A newer file is refused. */
  async function migrate(def, sec) {
    if (sec.version > def.version) throw new Error(`was made by a newer version (${sec.version}); this browser reads up to version ${def.version}. Update Slopographic first.`);
    let data = sec.data;
    for (let n = sec.version + 1; n <= def.version; n++) data = await def.migrations[n](data);
    return data;
  }
  const refused = (errors) => ({ ok: false, errors, rows: [], envelope: null, excluded: [] });

  /** Reads a file (or text), validates the envelope, migrates every section and checks it. Writes nothing. */
  async function plan(input) {
    await ready();
    const read = await C.format.readFile(input);
    if (!read.ok) return refused(read.errors);
    const env = read.envelope;
    const errors = C.format.validateEnvelope(env);
    if (errors.length) return refused(errors);
    const out = { apps: {}, settings: {} }, rows = [], defs = B.defs();
    for (const def of defs) {
      const sec = sectionsOf(def, env)[def.id];
      if (!sec) { rows.push({ id: def.id, label: def.label, mode: def.mode, action: 'left-alone' }); continue; }
      try {
        const data = await migrate(def, sec);
        const problems = def.check(data);
        if (problems.length) return refused([`${def.label}: ${problems[0]}`]);
        const bucket = def.part === 'settings' ? out.settings : out.apps;
        bucket[def.id] = { version: def.version, from: sec.version, data };
        rows.push({ id: def.id, label: def.label, mode: def.mode, action: 'import', from: sec.version, version: def.version, counts: C.format.countsOf(data) });
      } catch (e) {
        return refused([`${def.label}: ${e && e.message ? e.message : e}`]);
      }
    }
    const known = new Set(defs.map((d) => `${d.part}:${d.id}`));
    for (const part of ['apps', 'settings']) for (const id of Object.keys(env[part])) {
      if (!known.has(`${part}:${id}`)) rows.push({ id, label: id, action: 'unknown' });
    }
    return { ok: true, errors: [], source: read.legacy || 'Slopographic backup, version 2', created: env.created, rows, excluded: env.excluded, envelope: out };
  }

  let chain = Promise.resolve();
  /** Imports a plan. Sections apply in registration order (Slop Data first). If one fails, every undo step that ran is
   * run in reverse, and the result says so. Calls are queued, so two imports never interleave. */
  function apply(p, opts = {}) {
    const run = chain.then(() => doApply(p, opts));
    chain = run.catch(() => {});
    return run;
  }
  async function doApply(p, opts) {
    if (!p || !p.ok) return { ok: false, applied: [], skipped: [], errors: (p && p.errors) || ['nothing to import'], rolledBack: false };
    const undo = [], done = [];
    const ctx = { undo: (fn) => { if (typeof fn === 'function') undo.push(fn); } };
    const todo = B.defs().filter((d) => sectionsOf(d, p.envelope)[d.id]);
    for (const def of todo) {
      const sec = sectionsOf(def, p.envelope)[def.id];
      if (opts.onProgress) opts.onProgress(`Restoring ${def.label}…`);
      try {
        await def.importData(sec.data, sec.from, ctx);
        done.push({ id: def.id, label: def.label, counts: C.format.countsOf(sec.data) });
      } catch (e) {
        let undone = true;
        for (const fn of undo.slice().reverse()) { try { await fn(); } catch (e2) { undone = false; } }
        const why = `${def.label}: ${e && e.message ? e.message : e}`;
        return { ok: false, applied: [], skipped: [], rolledBack: undone,
          errors: [undone ? `${why}. Nothing was changed.` : `${why}. Some changes could not be undone; check the data before continuing.`] };
      }
    }
    return { ok: true, applied: done, skipped: p.rows.filter((r) => r.action !== 'import'), errors: [], rolledBack: false };
  }

  /** The dialog. Loads its own part on first use. */
  async function openDialog(opts = {}) {
    await ready();
    await B.load('shared/backup/central-ui.js');
    return C.ui.open(opts);
  }

  Object.assign(C, { FORMAT, VERSION, EXCLUDED, ready, exportEverything, plan, apply, openDialog });
})();
