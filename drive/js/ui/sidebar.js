/* Slop Drive — ui/sidebar: places (Slop Drive, Recent, Starred, Trash), the folder tree, and the storage
 * meter (SlopQuota.estimate, shared/storage/quota.js) with a "keep my files" persist request. */
'use strict';
(function (DR) {
  const S = DR.S, el = DR.el, $ = DR.$;
  const closeDrawer = () => { if (DR.isMobile()) DR.drawer(false); };

  DR.renderPlaces = function () {
    const box = $('places'), trashN = DR.trashTops().length, starN = [...DR.liveFolders(), ...DR.liveFiles()].filter((x) => x.starred).length;
    const row = (sec, icon, label, count, drop) => {
      const on = S.section === sec && (sec !== 'folder' || (!S.cwd && !DR.searching()));
      const b = el('button', { type: 'button', class: 'place' + (on ? ' on' : ''), 'data-section': sec, 'aria-current': on ? 'page' : null }, DR.icon(icon), el('span', null, label), count ? el('small', null, String(count)) : '');
      if (drop) b.dataset.drop = drop;
      b.addEventListener('click', () => { if (sec === 'folder') DR.go(null); else DR.goSection(sec); closeDrawer(); });
      return b;
    };
    box.replaceChildren(row('folder', 'home', 'Slop Drive', 0, 'root'), row('recent', 'clock', 'Recent'), row('starred', 'star', 'Starred', starN, 'star'), row('trash', 'trash', 'Trash', trashN, 'trash'));
  };

  DR.renderTree = function () {
    const box = $('tree'); box.replaceChildren();
    const walk = (parent, depth) => {
      const kids = DR.children(parent).folders.sort(DR.SORTS.name);
      for (const f of kids) {
        const open = S.tree.has(f.id), has = DR.hasSubfolders(f.id), on = S.section === 'folder' && S.cwd === f.id;
        const app = DR.appOfFolder(f);
        const tw = el('span', { class: 'twisty' + (has ? '' : ' none') + (open ? ' open' : ''), 'aria-hidden': 'true' }, DR.icon('chev'));
        const b = el('button', { type: 'button', class: 'node' + (on ? ' on' : '') + (app ? ' app' : ''), role: 'treeitem', 'aria-expanded': has ? String(open) : null, 'aria-selected': String(on),
          'data-drop': f.id, 'data-key': 'd:' + f.id, 'data-app': app ? app.id : null, style: `--d:${depth}`, title: app ? `${f.name} (${app.name} keeps its files here)` : f.name },
          tw, DR.icon('folder'), el('span', { class: 'nm' }, f.name), f.starred ? DR.icon('star', 'ic st') : '');
        tw.addEventListener('click', (e) => { e.stopPropagation(); if (open) S.tree.delete(f.id); else S.tree.add(f.id); DR.savePrefs(); DR.renderTree(); });
        b.addEventListener('click', () => { DR.go(f.id); closeDrawer(); });
        box.append(b);
        if (open && has) walk(f.id, depth + 1);
      }
    };
    walk(null, 0);
    if (!box.children.length) box.append(el('p', { class: 'tree-empty' }, 'No folders yet.'));
  };

  /** Tags: every tag on a live file, with how many files carry it. Click one to filter the drive by it. */
  DR.renderTags = function () {
    const box = $('tags'); if (!box) return;
    const counts = DR.tagCounts();
    box.replaceChildren(...(counts.length ? counts.map(([t, n]) => {
      const on = S.tag === t;
      const b = el('button', { type: 'button', class: 'place tagx' + (on ? ' on' : ''), 'data-tag': t, 'aria-pressed': String(on), title: `Files tagged ${t}` },
        el('span', { class: 'hash', 'aria-hidden': 'true' }, '#'), el('span', null, t), el('small', null, String(n)));
      b.addEventListener('click', () => { DR.setTagFilter(t); closeDrawer(); });
      return b;
    }) : [el('p', { class: 'tree-empty' }, 'No tags yet. Add one in the details panel.')]));
  };

  /* ---------- storage ---------- */
  let persisted = null;       // true/false once the browser has answered; null = ask it again
  DR.requestPersist = async function (loud) {
    const answer = await window.SlopQuota.request();
    persisted = answer === 'granted';
    if (loud) DR.toast(persisted ? 'The browser will keep Slop Drive' : 'The browser did not promise. See the note under Storage');
    DR.renderMeter();
    return persisted;
  };
  // The install flow (appinstalled, or running standalone) records an answer on its own.
  window.SlopPWA.onPersist(() => { persisted = null; DR.renderMeter(); });
  DR.renderMeter = async function () {
    const box = $('meter');
    const drive = DR.liveFiles().reduce((n, r) => n + (r.size || 0), 0) + DR.trashTops().reduce((n, it) => n + DR.sizeOf(it), 0);
    const Q = window.SlopQuota, est = await Q.estimate(), usage = est.usage, quota = est.quota;
    if (persisted == null) persisted = !!est.persisted;
    // The recorded answer explains a "no" in plain words; a yes shows as "Kept by the browser".
    const recorded = window.SlopPWA.persistAnswer();
    const state = persisted ? 'granted' : (recorded === 'denied' || recorded === 'unsupported' ? recorded : null);
    const pct = usage != null && quota ? Math.min(100, (usage / quota) * 100) : 0;
    const bar = el('div', { class: 'meter-bar', role: 'meter', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': pct.toFixed(1), 'aria-label': 'Storage used' }, el('i', { style: `width:${Math.max(pct, usage ? 1 : 0)}%` }));
    const keep = el('button', { type: 'button', class: 'linkish', 'data-act': 'persist' }, persisted ? 'Kept by the browser ✓' : 'Ask the browser to keep it');
    keep.disabled = !!persisted;
    keep.addEventListener('click', () => DR.requestPersist(true));
    const bk = el('button', { type: 'button', class: 'linkish' }, 'Backup & restore…');
    bk.addEventListener('click', () => DR.backupDialog());
    const clear = el('button', { type: 'button', class: 'linkish', 'data-act': 'clear-cache', title: 'Removes only what is made again on demand' }, 'Clear local cache…');
    clear.addEventListener('click', () => DR.clearLocalCache());
    const note = state ? el('p', { class: 'meter-note persist-note', 'data-state': state }, window.SlopPWA.persistMessage(state)) : null;
    box.replaceChildren(
      el('div', { class: 'meter-h' }, el('b', null, 'Storage'), el('span', null, usage != null ? Q.format(usage, quota, DR.fmtSize) : 'Unknown')), bar,
      el('div', { class: 'meter-note' }, `Slop Drive: ${DR.fmtSize(drive)}. Everything stays in this browser.`), ...(note ? [note] : []), keep, bk, clear);
  };
  /** Removes only the regenerable caches (thumbnails, waveforms, face results, downloaded models). Files and documents stay. */
  DR.clearLocalCache = async function () {
    const yes = await window.SlopUI.confirm('Clear local cache?', 'This removes only what is made again on demand: thumbnails, waveforms, face results and downloaded AI and cut-out models. Your files, documents and backups are kept. A model downloads again when you use it.', 'Clear cache');
    if (!yes) return;
    const n = await window.SlopRegen.clear();
    DR.toast(`Cleared ${n.thumbs + n.faces + n.models + n.cutout} cached entries. Your files are unchanged.`);
    DR.renderMeter();
  };

  /** Phones: the sidebar is a drawer from the start edge. SlopSheet (shared/ui/sheet.js) does the ×, the Folders button,
   * Escape, a tap outside and the swipe; wired before the app's own keys so its Escape comes first. */
  DR.wireDrawer = function () {
    DR.drawerUI = SlopSheet.attach({ root: document.body, panel: $('side'), side: 'start', phone: '(max-width: 760px)', toggles: [$('btnSide')], label: 'Folders' });
  };
  DR.drawer = (open) => (open ? DR.drawerUI.open() : DR.drawerUI.close());
})(window.DR);
