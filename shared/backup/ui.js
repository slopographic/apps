/* SlopBackupUI: the "Backup & restore" dialog (export everything, import with merge or replace).
 * Opened through SlopBackup.openDialog(). Classic script, exposes window.SlopBackupUI. */
(function () {
  'use strict';
  if (window.SlopBackupUI) return;
  const fmtSize = (n) => (n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' KB' : n < 1073741824 ? (n / 1048576).toFixed(1) + ' MB' : (n / 1073741824).toFixed(2) + ' GB');
  const css = document.createElement('style');
  css.textContent = '.bk-sec{border:1px solid var(--s-line);border-radius:var(--s-radius);padding:12px;margin-bottom:10px;display:grid;gap:8px}.bk-sec h3{margin:0;font-size:13px}'
    + '.bk-sec .sui-p{margin:0}.bk-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.bk-status{color:var(--s-faint);font-size:11.5px}.bk-sum{display:grid;gap:4px;padding:8px;border-radius:var(--s-radius);background:var(--s-input)}'
    + '.bk-modes{display:grid;gap:6px}.bk-modes label{display:flex;gap:7px;align-items:flex-start;color:var(--s-dim)}.bk-modes b{color:var(--s-fg)}.bk-modes input{accent-color:var(--s-accent);margin-top:2px}';
  document.head.append(css);

  function summary(el, m) {
    const c = m.counts || {};
    return el('div', { class: 'bk-sum' },
      el('div', null, el('b', null, 'Made '), new Date(m.created).toLocaleString(), m.origin && m.origin !== location.origin ? ` on ${m.origin}` : ''),
      el('div', null, `${c.driveFiles || 0} Slop Drive files in ${c.driveFolders || 0} folders · ${fmtSize(m.bytes || 0)}`),
      el('div', null, `${c.localStorage || 0} settings and saves · ${c.databases || 0} app databases`));
  }

  function open(UI, { onRestored } = {}) {
    return new Promise((resolve) => {
      const el = UI.el, B = window.SlopBackup, last = B.lastExport();
      const status = el('div', { class: 'bk-status', role: 'status' }, last ? 'Last backup from this browser: ' + new Date(last).toLocaleString() : 'No backup made from this browser yet.');
      const exportBtn = el('button', { type: 'button', class: 'sui-btn sui-primary', 'data-act': 'export' }, 'Export everything');
      exportBtn.addEventListener('click', async () => {
        exportBtn.disabled = true;
        try { const r = await B.exportNow({ onProgress: (t) => { status.textContent = t; } }); status.textContent = `Saved ${r.name} (${fmtSize(r.size)}). Keep it somewhere safe.`; UI.toast('Backup downloaded'); }
        catch (e) { status.textContent = 'Export failed: ' + e.message; }
        finally { exportBtn.disabled = false; }
      });
      const exp = el('section', { class: 'bk-sec' }, el('h3', null, 'Export'),
        el('p', { class: 'sui-p' }, 'One file with all Slop Drive files and folders, every app’s settings, saves, high scores and XP, and app autosaves.'),
        el('div', { class: 'bk-row' }, exportBtn), status);

      const impBody = el('div', { class: 'bk-row' });
      const pickBtn = el('button', { type: 'button', class: 'sui-btn', 'data-act': 'import' }, 'Choose backup file…');
      impBody.append(pickBtn);
      const imp = el('section', { class: 'bk-sec' }, el('h3', null, 'Import'), el('p', { class: 'sui-p' }, 'Restore a .slop backup into this browser.'), impBody);
      pickBtn.addEventListener('click', async () => {
        const [f] = await UI.pickFiles({ accept: '.slop,.zip,application/zip' });
        if (f) await choose(f);
      });
      async function choose(file) {
        let data;
        try { data = await window.SlopBackupCore.read(file); } catch (e) { UI.alert('Cannot import', e.message); return; }
        const merge = el('input', { type: 'radio', name: 'bk-mode', value: 'merge', checked: true }), repl = el('input', { type: 'radio', name: 'bk-mode', value: 'replace' });
        const modes = el('div', { class: 'bk-modes' },
          el('label', null, merge, el('span', null, el('b', null, 'Merge. '), 'Add everything from the backup and keep what is only here. Where both have the same item, the backup wins.')),
          el('label', null, repl, el('span', null, el('b', null, 'Replace. '), 'Empty Slop Drive, settings and saves first, so this browser matches the backup exactly.')));
        const go = el('button', { type: 'button', class: 'sui-btn sui-primary', 'data-act': 'restore' }, 'Restore');
        const st = el('div', { class: 'bk-status', role: 'status' });
        impBody.replaceChildren(el('div', { style: 'display:grid;gap:8px;width:100%' }, el('b', null, file.name), summary(el, data.manifest), modes, el('div', { class: 'bk-row' }, go, pickBtn), st));
        go.addEventListener('click', async () => {
          const mode = repl.checked ? 'replace' : 'merge';
          if (mode === 'replace' && !(await UI.confirm('Replace everything?', 'This deletes the Slop Drive files, settings and saves in this browser that are not in the backup.', 'Replace', { danger: true }))) return;
          go.disabled = true;
          try {
            const r = await B.importFile(data, { mode, onProgress: (t) => { st.textContent = t; } });
            st.textContent = `Restored ${r.records} items in ${r.databases} databases and ${r.localStorage} settings.` + (r.errors.length ? ` ${r.errors.length} problems: ${r.errors.join('; ')}` : '') + (r.skipped.length ? ` Skipped: ${r.skipped.join(', ')}.` : '');
            UI.toast('Backup restored');
            if (onRestored) onRestored(r);
          } catch (e) { st.textContent = 'Import failed: ' + e.message; }
          finally { go.disabled = false; }
        });
      }
      const d = UI.dialog({ title: 'Backup & restore', cls: 'bk-dlg', body: el('div', null,
        el('p', { class: 'sui-p' }, 'Everything you make in Slopographic lives only in this browser. Clearing browser or site data deletes it, so keep a backup.'), exp, imp),
        buttons: [{ label: 'Done', primary: true }], onClose: () => resolve() });
      d.box.dataset.backup = '1';
      open.choose = choose; // for tests and drag-and-drop of .slop files
    });
  }
  window.SlopBackupUI = { open };
})();
