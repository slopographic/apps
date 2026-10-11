/* SlopCentral dialog: "Everything in one file". Export everything (with or without open-app state), or choose a backup
 * file, read what it holds (imported, left alone, skipped, excluded) and confirm. Uses SlopCentral.exportEverything,
 * plan and apply only. Opened through SlopBackup.openEverything(). Classic script; part of central.js. */
(function () {
  'use strict';
  const C = window.SlopCentral, B = window.SlopBackup;
  const fmt = (n) => Number(n || 0).toLocaleString();
  const css = document.createElement('style');
  css.textContent = '.ev-sec{border:1px solid var(--s-line);border-radius:var(--s-radius);padding:12px;margin-bottom:10px;display:grid;gap:8px}'
    + '.ev-sec h3{margin:0;font-size:13px}.ev-sec .sui-p{margin:0}.ev-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}'
    + '.ev-status{color:var(--s-faint);font-size:11.5px}.ev-list{display:grid;gap:5px;padding:8px;border-radius:var(--s-radius);background:var(--s-input)}'
    + '.ev-list div{display:grid;grid-template-columns:minmax(120px,1fr) 2fr;gap:8px;font-size:12.5px}.ev-list b{color:var(--s-fg)}'
    + '.ev-warn{color:var(--s-fg);font-size:12px}.ev-bad{color:var(--s-danger, #c0392b);font-size:12.5px;display:grid;gap:3px}'
    + '.ev-ex{font-size:11.5px;color:var(--s-dim)}.ev-ex li{margin:2px 0}';
  document.head.append(css);

  /** What one app line says: how many items come in, or why it is not imported. */
  function rowText(r) {
    if (r.action === 'import') {
      const parts = Object.entries(r.counts.parts || {}).filter(([, n]) => n).map(([k, n]) => `${fmt(n)} ${k}`).join(', ');
      const up = r.from !== r.version ? ` (upgraded from version ${r.from})` : '';
      const how = r.mode === 'replace' ? 'replaces what is here now' : 'adds to what is here; the file wins where items match';
      return `${fmt(r.counts.records)} items${parts ? `: ${parts}` : ''}${up}. ${how[0].toUpperCase()}${how.slice(1)}.`;
    }
    if (r.action === 'left-alone') return 'Not in this file. Left as it is.';
    return 'An app this browser does not know. Skipped.';
  }

  /** The plan as a list: one row per app, then what is excluded. */
  function planEl(el, p) {
    const made = new Date(p.created).toLocaleString();
    const list = el('div', { class: 'ev-list' },
      el('div', null, el('b', null, 'Made'), el('span', null, `${made} · ${p.source}`)),
      ...p.rows.map((r) => el('div', { 'data-app': r.id, 'data-action': r.action }, el('b', null, r.label), el('span', null, rowText(r)))));
    const replaces = p.rows.some((r) => r.action === 'import' && r.mode === 'replace');
    return el('div', { style: 'display:grid;gap:8px;width:100%' }, list,
      replaces ? el('p', { class: 'ev-warn' }, 'Slop Data is replaced by the records in this file: records here now that the file does not have are removed.') : null,
      el('details', null, el('summary', null, `Not included (${p.excluded.length})`),
        el('ul', { class: 'ev-ex' }, ...p.excluded.map((x) => el('li', null, el('b', null, x.source + '. '), x.reason)))));
  }

  async function open(opts = {}) {
    const UI = await B.kit(), el = UI.el;
    let current = null;
    const status = el('div', { class: 'ev-status', role: 'status' }, 'Everything in one file: every app in this suite, in one .slop-backup.json.');
    const session = el('input', { type: 'checkbox', checked: true });
    const exportBtn = el('button', { type: 'button', class: 'sui-btn sui-primary', 'data-act': 'export-all' }, 'Export everything');
    exportBtn.addEventListener('click', async () => {
      exportBtn.disabled = true;
      try {
        const r = await C.exportEverything({ includeSession: session.checked, onProgress: (t) => { status.textContent = t; } });
        UI.download(r.blob, r.name);
        const got = r.rows.map((x) => `${x.label} (${fmt(x.counts.records)})`).join(', ');
        status.textContent = `Saved ${r.name}. Includes: ${got || 'nothing'}. ${r.excluded.length} things are not included, listed when you import.`;
        UI.toast('Backup downloaded');
      } catch (e) { status.textContent = 'Export failed: ' + (e && e.message ? e.message : e); }
      finally { exportBtn.disabled = false; }
    });
    const exp = el('section', { class: 'ev-sec' }, el('h3', null, 'Export'),
      el('p', { class: 'sui-p' }, 'Slop Data (records, contacts, settings), Slop Drive files and folders, Gallery, Music playlists, Tables, Slides and Docs templates, and the profile settings.'),
      el('label', { class: 'ev-row' }, session, el('span', null, 'Include open-app state (where each app was, and unsaved view state)')),
      el('div', { class: 'ev-row' }, exportBtn), status);

    const planArea = el('div', { class: 'ev-row', style: 'width:100%' });
    const pickBtn = el('button', { type: 'button', class: 'sui-btn', 'data-act': 'import-all' }, 'Choose backup file…');
    const confirmBtn = el('button', { type: 'button', class: 'sui-btn sui-primary', 'data-act': 'confirm-import' }, 'Confirm import');
    const imp = el('section', { class: 'ev-sec' }, el('h3', null, 'Import'),
      el('p', { class: 'sui-p' }, 'Choose a .slop-backup.json file, or a version 1 Slop Data or Slopographic backup. The file is checked whole first. Nothing changes until you confirm.'),
      el('div', { class: 'ev-row' }, pickBtn), planArea);

    async function choose(file) {
      planArea.replaceChildren(el('span', { class: 'ev-status' }, 'Checking the file…'));
      const p = await C.plan(file);
      current = p;
      if (!p.ok) {
        planArea.replaceChildren(el('div', { class: 'ev-bad', role: 'alert' }, el('b', null, 'This backup was not imported. Nothing was changed.'), ...p.errors.map((m) => el('span', null, m))));
        return;
      }
      confirmBtn.disabled = false;
      planArea.replaceChildren(el('div', { style: 'display:grid;gap:8px;width:100%' }, el('b', null, file.name), planEl(el, p),
        el('div', { class: 'ev-row' }, confirmBtn, pickBtn)));
    }
    confirmBtn.disabled = true;
    pickBtn.addEventListener('click', async () => {
      const [f] = await UI.pickFiles({ accept: '.json,.slop,.zip,application/json,application/zip' });
      if (f) await choose(f);
    });
    confirmBtn.addEventListener('click', async () => {
      if (!current || !current.ok) return;
      confirmBtn.disabled = true;
      status.textContent = 'Importing…';
      const r = await C.apply(current, { onProgress: (t) => { status.textContent = t; } });
      if (!r.ok) { status.textContent = r.errors.join(' '); confirmBtn.disabled = false; return; }
      const done = r.applied.map((a) => `${a.label} (${fmt(a.counts.records)})`).join(', ');
      const left = r.skipped.map((s) => `${s.label || s.id} ${s.action === 'unknown' ? 'skipped' : 'left alone'}`).join(', ');
      status.textContent = `Imported: ${done || 'nothing'}.${left ? ` Not imported: ${left}.` : ''}`;
      UI.toast('Backup imported');
      current = null;
      if (opts.onRestored) opts.onRestored(r);
    });

    return new Promise((resolve) => {
      UI.dialog({ title: 'Everything in one file', cls: 'ev-dlg',
        body: el('div', null, el('p', { class: 'sui-p' }, 'One file for the whole suite. Secrets (sign-in tokens, consent) and caches are never in it.'), exp, imp),
        buttons: [{ label: 'Done', primary: true }], onClose: () => resolve() });
    });
  }

  C.ui = { open };
})();
