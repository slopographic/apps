// Slop Projects files: download the current project as a JSON backup or its tasks as CSV, open a backup (a file
// picker, or a drop on the empty page through SlopDrop), and Try a sample (the sample is a backup file made in the page,
// so it goes the same way a dropped file does). Nothing is uploaded. Exposes window.SlopProjects.files.
(function (g) {
  'use strict';
  const NS = (g.SlopProjects = g.SlopProjects || {});
  const UI = g.SlopUI;
  const st = () => NS.state;
  let drop = null;

  function exportJson() {
    const p = st().project;
    if (!p) { UI.toast('Open a project first.'); return false; }
    const text = JSON.stringify(NS.io.backup(p, st().tasks), null, 2);
    UI.download(new Blob([text], { type: 'application/json' }), NS.io.fileName(p, 'json'));
    return true;
  }

  function exportCsv() {
    const p = st().project;
    if (!p) { UI.toast('Open a project first.'); return false; }
    UI.download(new Blob(['﻿' + NS.io.csv(p, st().tasks, st().customers)], { type: 'text/csv' }), NS.io.fileName(p, 'csv'));
    return true;
  }

  /** Reads one backup file and adds its project. Throws Error(reason) for SlopDrop's progress row. */
  async function openFile(file) {
    const r = NS.io.readText(await file.text(), () => NS.store.newId(), new Set(st().customers.keys()));
    if (!r.ok) throw new Error(r.message);
    const sample = /^Sample /.test(file.name);
    const b = { project: { ...r.project, ...(sample ? { sample: true } : {}) }, tasks: r.tasks.map((t) => (sample ? { ...t, sample: true } : t)) };
    const ok = await NS.actions.addBundle(b, sample ? `Opened the sample "${b.project.name}"` : `Opened "${b.project.name}" with ${b.tasks.length} task${b.tasks.length === 1 ? '' : 's'}`);
    if (!ok) throw new Error('It could not be saved.');
    if (r.notes.length) UI.toast(r.notes.join(' '), 6000);
    return b.project.id;
  }

  async function importFile() {
    const files = await UI.pickFiles({ accept: '.json,application/json' });
    const f = files && files[0];
    if (!f) return false;
    try { await openFile(f); return true; } catch (e) { UI.toast(e.message, 5000); return false; }
  }

  /** The sample project as a file, dated around today. */
  const sampleFile = () => g.SlopSamples.file('Sample project.json', JSON.stringify(NS.sample(st().today)), 'application/json');

  async function trySample() {
    try { await openFile(sampleFile()); return true; } catch (e) { UI.toast(e.message); return false; }
  }

  /** The drop zone on the empty page: a backup file, or the sample. */
  function mountEmpty() {
    const zone = document.getElementById('pDrop');
    if (!zone || !g.SlopDrop || drop) return;
    drop = g.SlopDrop.attach(zone, {
      accept: { types: ['application/json'], exts: ['.json'], noun: 'a Slop Projects backup (.json)' },
      window: false, label: 'Drop a project backup (.json) here', chooseLabel: 'Open a backup', multiple: false, limit: 1,
      preview: { steps: ['Make a project, or open one from a backup.', 'Add tasks to the board and drag them across the columns.', 'Give them dates and plan them on the timeline.'] },
      sample: { label: 'Try a sample', files: () => [sampleFile()] },
      process: (file) => openFile(file),
    });
  }

  NS.files = { exportJson, exportCsv, importFile, openFile, trySample, sampleFile, mountEmpty };
})(typeof window !== 'undefined' ? window : globalThis);
