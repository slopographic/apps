/* SlopMacros: macros in an app. Record a run of the app's own commands (SlopCmd commands with args), name and keep it
 * (SlopMacroStore, IndexedDB), play it again, export and import it, and hand it to Slop Workflows as a step. The pure part
 * is core.js (the one recorder and the one replay); the panel, the recording bar and the Macros button are panel.js.
 * Classic script; load after shared/commands/commands.js, core.js and store.js. See shared/macros/HANDOFF.md.
 *
 *   SlopMacros.init({ app, label, host })   app: the SlopCmd / registry app id ('photoslop'); label: its name
 *     host: { open(file, options), save(options, { signal, progress }) → { blob, kind }, ready? () → Promise }  how a hidden copy of the app
 *       (an iframe at <app>/?macro-host=1, shared/macros/frame.js) opens a file and writes the result. With ?macro-host=1
 *       in the address the page serves window.SlopMacroHost = { ready, run(file, steps, options, { signal, progress }) } for it.
 *   record() stop() cancel() note(cmd, args, title) play(id) list() get(id) rename(id) remove(id) exportFile(ids?)
 *   importFile(file?) addToWorkflow(id) on(fn) → off (fn({ type: 'record' | 'steps' | 'list' | 'play' }))
 *   recording, steps(), isHost
 * Commands: macro.record, macro.stop, macro.cancel, macro.panel ("Macros…") and macro.play (arg: name). */
(function (g) {
  'use strict';
  if (g.SlopMacros) return;
  const M = g.SlopMacrosCore, ST = g.SlopMacroStore;
  const SCRIPT = document.currentScript;
  const BASE = SCRIPT && SCRIPT.src ? new URL('./', SCRIPT.src).href : null;
  const IS_HOST = /[?&]macro-host=1(&|$)/.test(location.search);
  const UI = () => g.SlopUI;
  const toast = (m, ms) => { if (UI()) UI().toast(m, ms); };
  const listeners = new Set();
  const emit = (type) => { for (const fn of [...listeners]) try { fn({ type }); } catch (e) { console.error(e); } };
  let app = '', label = '', rec = null, cache = [];
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  const load = (src) => new Promise((res, rej) => {
    if ([...document.scripts].some((s) => s.src === src)) { res(); return; }
    const s = document.createElement('script'); s.src = src; s.async = false;
    s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.append(s);
  });
  const panel = () => (g.SlopMacrosPanel ? Promise.resolve(g.SlopMacrosPanel) : load(BASE + 'panel.js').then(() => g.SlopMacrosPanel));
  const C = () => g.SlopCmd;
  const exec = (cmd, args) => C().exec(cmd, args, { source: 'macro' });
  const prepare = () => (C().prepare ? C().prepare() : null);

  async function refresh() { cache = await ST.list(app); emit('list'); return cache; }
  const list = () => cache.slice();
  const get = (id) => cache.find((m) => m.id === id) || null;
  const byName = (name) => { const n = String(name || '').trim().toLowerCase(); return cache.find((m) => m.name.toLowerCase() === n) || cache.find((m) => m.name.toLowerCase().includes(n)) || null; };

  function record() {
    if (rec.recording) return;
    rec.start(); emit('record');
    panel().then((P) => P.bar(api)).catch(() => {});
    toast('Recording a macro. Use menus, filters and commands, then press Stop.', 3600);
  }
  function cancel() { if (!rec.recording) return; rec.cancel(); emit('record'); toast('Recording cancelled.'); }
  async function stop() {
    if (!rec.recording) return null;
    const steps = rec.stop(); emit('record');
    if (!steps.length) { toast('Nothing was recorded. Menus, filters and commands are recorded; brush strokes and hand-drawn selections are not.', 5200); return null; }
    const def = steps.slice(0, 3).map((s) => s.title).join(' + ');
    const name = UI() ? await UI().prompt('Save the macro', `Name (${plural(steps.length, 'step')})`, def.slice(0, 80), { ok: 'Save' }) : def;
    if (name === null) { toast('The macro was not saved.'); return null; }
    const { macro } = M.normalize({ app, name: name || def, steps });
    try { await ST.save(macro); } catch (e) { if (UI()) UI().alert('Could not keep the macro', e.message); return null; }
    await refresh();
    toast(`Saved “${macro.name}”.`);
    return macro;
  }

  async function play(id) {
    const m = typeof id === 'object' && id ? id : get(id);
    if (!m) throw new Error('There is no such macro.');
    if (rec.recording) throw new Error('Stop recording first.');
    emit('play');
    try {
      await rec.playing(() => M.replay(m.steps, { exec, prepare }));
      toast(`Played “${m.name}” (${plural(m.steps.length, 'step')}).`);
      return `Played ${m.name}`;
    } catch (e) { toast(e.message, 5200); throw e; }
  }

  async function rename(id, name) {
    const m = get(id); if (!m) return null;
    const v = name != null ? name : UI() ? await UI().prompt('Rename the macro', 'Name', m.name, { ok: 'Rename' }) : null;
    if (v === null || !String(v).trim()) return null;
    const saved = await ST.save(Object.assign({}, m, { name: String(v).trim().slice(0, 80) }));
    await refresh(); return saved;
  }
  async function remove(id, { ask = true } = {}) {
    const m = get(id); if (!m) return false;
    if (ask && UI() && !(await UI().confirm('Delete the macro?', `“${m.name}” will be deleted from this browser. A workflow that uses it can no longer run that step.`, 'Delete', { danger: true }))) return false;
    await ST.remove(id); await refresh(); toast(`Deleted “${m.name}”.`); return true;
  }

  function exportFile(ids) {
    const list = ids ? [].concat(ids).map(get).filter(Boolean) : cache;
    if (!list.length) { toast('There are no macros to export.'); return null; }
    const blob = new Blob([M.toText(list, app)], { type: 'application/json' });
    const name = (list.length === 1 ? list[0].name.replace(/[\\/:*?"<>|]+/g, '-') : `${app}-macros`) + M.EXT;
    if (UI()) UI().download(blob, name);
    return { blob, name };
  }
  async function importFile(file) {
    if (!file) { const picked = UI() ? await UI().pickFiles({ accept: M.EXT + ',.json,application/json' }) : []; file = picked[0]; }
    if (!file) return 0;
    const { macros, errors } = M.fromText(await file.text(), app);
    if (!macros.length) { if (UI()) UI().alert('Could not import', errors[0] || 'There is no macro in this file.'); return 0; }
    const foreign = macros.filter((m) => m.app && m.app !== app);
    if (foreign.length && UI() && !(await UI().confirm('Import macros', `This file holds macros made in ${foreign[0].app}. Their commands may not work here. Import them anyway?`, 'Import'))) return 0;
    for (const m of macros) await ST.save(Object.assign({}, m, { app, id: get(m.id) ? M.newId() : m.id }));
    await refresh();
    toast(`Imported ${plural(macros.length, 'macro')}.`);
    return macros.length;
  }

  async function addToWorkflow(id) {
    const m = get(id); if (!m) return null;
    if (!g.SlopFlowDoc) await load(new URL('../ops/flowdoc.js', BASE).href);
    return g.SlopFlowDoc.addToWorkflow({ kind: 'macro', id: M.opId(app, m.id), app, macroId: m.id, options: {} }, { name: m.name });
  }
  const openPanel = () => panel().then((P) => P.open(api));

  function commands() {
    const SC = C(); if (!SC || !SC.register) return;
    SC.register([
      { id: 'macro.record', title: 'Record a macro', group: 'Macros', keywords: ['macro', 'record', 'automate', 'actions', 'repeat'], when: () => !rec.recording, run: record },
      { id: 'macro.stop', title: 'Stop recording and save the macro', group: 'Macros', keywords: ['macro', 'stop', 'save'], when: () => rec.recording, run: () => stop() },
      { id: 'macro.cancel', title: 'Cancel recording', group: 'Macros', keywords: ['macro', 'discard'], when: () => rec.recording, run: cancel },
      { id: 'macro.panel', title: 'Macros…', group: 'Macros', keywords: ['macro', 'play', 'recorded', 'actions', 'workflow'], run: openPanel },
      { id: 'macro.play', title: 'Play a macro', group: 'Macros', hidden: true, description: 'Play one of the saved macros of this app by its name.',
        args: [{ name: 'name', type: 'string', required: true, maxLength: 80, description: 'the macro’s name' }],
        when: () => cache.length > 0 && !rec.recording, run: (a) => { const m = a && byName(a.name); if (!m) throw new Error('No macro called ' + (a && a.name)); return play(m); } },
    ]);
  }

  /** The hidden copy of the app the workflows use: open the file, replay, write the result. One file at a time. */
  function serve(host) {
    let chain = Promise.resolve();
    const ready = Promise.resolve(host.ready ? host.ready() : null).then(() => true);
    g.SlopMacroHost = {
      app, ready,
      run(file, steps, options = {}, { signal = null, progress = null } = {}) {
        const job = chain.then(async () => {
          await ready;
          const f = new File([file], file.name || 'picture', { type: file.type || '' });   // this window's own File
          await host.open(f, options || {});   // options may carry more files (SlopCut: the media of an edit list)
          await rec.playing(() => M.replay(steps, { exec: (cmd, args) => C().exec(cmd, args, { source: 'macro', signal }), prepare, signal }));
          return host.save(options || {}, { signal, progress });
        });
        chain = job.catch(() => {});
        return job;
      },
    };
  }

  function init(o = {}) {
    if (rec) return api;
    app = String(o.app || (C() && C().app) || 'app'); label = o.label || app;
    rec = M.createRecorder(C(), { onChange: () => emit('steps') });
    commands();
    if (IS_HOST && o.host) serve(o.host);
    ST.onChange((a) => { if (!a || a === app) refresh(); });
    refresh();
    return api;
  }

  const api = {
    init, record, stop, cancel, play, list, get, refresh, rename, remove, exportFile, importFile, addToWorkflow, openPanel,
    note: (cmd, args, title, o) => (rec ? rec.note(cmd, args, title, o) : false),
    removeStep: (i) => rec && rec.remove(i),
    steps: () => (rec ? rec.steps() : null),
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    get recording() { return !!(rec && rec.recording); },
    get app() { return app; }, get label() { return label; },
    isHost: IS_HOST, base: BASE,
  };
  g.SlopMacros = api;
})(window);
