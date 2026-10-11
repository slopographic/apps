/* Slop Drive pickers used by every app through SlopHub.pickFromDrive() and SlopHub.pickFolder().
 * Loaded on first use by shared/hub.js. Needs window.SlopHub and window.SlopUI. Exposes window.SlopDrivePicker.
 * Both dialogs browse nested folders with breadcrumbs; the file picker also searches every folder. */
(function () {
  'use strict';
  if (window.SlopDrivePicker) return;
  const H = () => window.SlopHub, UI = () => window.SlopUI;
  const css = document.createElement('style');
  css.textContent = '.hub-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;max-height:55vh;overflow:auto;align-content:start;min-height:120px}'
    + '.hub-item{display:grid;gap:3px;text-align:left;padding:8px;border-radius:8px;border:1px solid var(--s-line);background:var(--s-bg2);color:var(--s-fg);cursor:pointer;font:inherit;min-width:0}'
    + '.hub-item:hover,.hub-item:focus-visible{border-color:var(--s-accent)}.hub-thumb{display:grid;place-items:center;height:88px;border-radius:5px;background:repeating-conic-gradient(#3a3a3a 0 25%,#2a2a2a 0 50%) 0 0/12px 12px;overflow:hidden}'
    + '.hub-thumb img{max-width:100%;max-height:88px}.hub-ext{font:700 18px var(--s-mono);color:var(--s-dim)}.hub-item b{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.hub-item small{color:var(--s-faint);font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hub-folder .hub-thumb{background:var(--s-input)}'
    + '.hub-fold-ic{width:44px;height:36px;border-radius:3px 6px 6px 6px;background:var(--s-accent);opacity:.85;position:relative}.hub-fold-ic::before{content:"";position:absolute;left:0;top:-6px;width:18px;height:8px;border-radius:3px 3px 0 0;background:inherit}'
    + '.hub-bar{display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap}.hub-crumbs{display:flex;gap:2px;align-items:center;flex:1;min-width:0;overflow:auto;white-space:nowrap}'
    + '.hub-crumbs button{border:0;background:none;color:var(--s-dim);font:inherit;padding:3px 6px;border-radius:4px;cursor:pointer}.hub-crumbs button:hover{background:var(--s-hover);color:var(--s-fg)}.hub-crumbs button:last-child{color:var(--s-fg);font-weight:600}'
    + '.hub-crumbs i{color:var(--s-faint);font-style:normal}.hub-search{width:170px}.hub-rows{display:grid;gap:2px;max-height:45vh;overflow:auto;min-height:120px;align-content:start}'
    + '.hub-row{display:flex;gap:8px;align-items:center;padding:7px 9px;border:0;border-radius:5px;background:none;color:var(--s-fg);font:inherit;text-align:left;cursor:pointer}.hub-row:hover,.hub-row:focus-visible{background:var(--s-hover)}'
    + '.hub-row .hub-fold-ic{width:18px;height:14px}.hub-row .hub-fold-ic::before{top:-3px;width:8px;height:4px}@media(max-width:500px){.hub-search{width:100%}.hub-grid{grid-template-columns:repeat(2,1fr)}}';
  document.head.append(css);

  function crumbs(path, go) {
    const el = UI().el, box = el('nav', { class: 'hub-crumbs', 'aria-label': 'Folder path' });
    box.append(el('button', { type: 'button', onclick: () => go(null) }, 'Slop Drive'));
    for (const f of path) box.append(el('i', null, '›'), el('button', { type: 'button', onclick: () => go(f.id) }, f.name));
    return box;
  }
  const folderIcon = () => UI().el('span', { class: 'hub-fold-ic', 'aria-hidden': 'true' });
  const visibleFolders = async () => { const all = await H().listFolders(); const m = new Map(all.map((f) => [f.id, f])); return { all: all.filter((f) => !H().inTrash(f, m)), map: m }; };

  /** pickFile({ accept, title }): resolves with a file record or null. */
  function pickFile({ accept, title = 'Open from Slop Drive' } = {}) {
    return new Promise((res) => {
      const UIx = UI(), el = UIx.el, urls = [];
      let chosen = null, cwd = null, query = '';
      const search = el('input', { class: 'sui-input hub-search', type: 'search', placeholder: 'Search all folders', 'aria-label': 'Search Slop Drive' });
      const bar = el('div', { class: 'hub-bar' }), grid = el('div', { class: 'hub-grid' });
      const note = el('p', { class: 'sui-p' }, 'Files shared between Slopographic apps. Stored only in this browser.');
      search.addEventListener('input', () => { query = search.value.trim().toLowerCase(); render(); });
      async function render() {
        const { all, map } = await visibleFolders().catch(() => ({ all: [], map: new Map() }));
        const files = (await H().list({ accept }).catch(() => [])).filter((r) => !H().inTrash(r, map));
        urls.splice(0).forEach((u) => URL.revokeObjectURL(u));
        bar.replaceChildren(crumbs(cwd ? await H().folderPath(cwd) : [], (id) => { cwd = id; search.value = query = ''; render(); }), search);
        grid.replaceChildren();
        const folders = query ? all.filter((f) => f.name.toLowerCase().includes(query)) : all.filter((f) => f.parentId === cwd);
        const shown = query ? files.filter((r) => r.name.toLowerCase().includes(query)) : files.filter((r) => (map.has(r.folderId) ? r.folderId : null) === cwd);
        for (const f of folders) {
          const n = files.filter((r) => r.folderId === f.id).length;
          const b = el('button', { type: 'button', class: 'hub-item hub-folder', 'data-folder': f.id }, el('span', { class: 'hub-thumb' }, folderIcon()), el('b', null, f.name), el('small', null, n + (n === 1 ? ' file' : ' files')));
          b.addEventListener('click', () => { cwd = f.id; search.value = query = ''; render(); });
          grid.append(b);
        }
        for (const r of shown) {
          const isImg = /^image\//.test(r.type) && r.type !== 'image/vnd.adobe.photoshop';
          let thumb;
          if (isImg && r.blob) { const u = URL.createObjectURL(r.blob); urls.push(u); thumb = el('img', { src: u, alt: '', loading: 'lazy' }); }
          else thumb = el('span', { class: 'hub-ext' }, (r.name.includes('.') ? r.name.split('.').pop() : r.type.split('/').pop()).slice(0, 4).toUpperCase());
          const app = H().appById(r.from);
          const b = el('button', { type: 'button', class: 'hub-item', 'data-id': r.id }, el('span', { class: 'hub-thumb' }, thumb), el('b', { title: r.name }, r.name), el('small', null, `${app ? app.name : r.from} · ${H().fmtSize(r.size)} · ${new Date(r.time).toLocaleString()}`));
          b.addEventListener('click', () => { chosen = r; H().touch(r.id); d.close(true); });
          b.addEventListener('contextmenu', (e) => { e.preventDefault(); UIx.menu([{ label: 'Move to Trash', act: async () => { await H().update(r.id, { trashedAt: Date.now() }); b.remove(); } }], e.clientX, e.clientY); });
          grid.append(b);
        }
        if (!grid.children.length) grid.append(el('p', { class: 'sui-p hub-empty' }, query ? 'Nothing matches “' + search.value + '”.' : cwd ? 'This folder is empty.'
          : 'Slop Drive is empty. Use “Send to…” in any Slopographic app to put files here. Files stay on this device.'));
      }
      const d = UIx.dialog({ title, cls: 'sui-wide', body: el('div', null, note, bar, grid),
        buttons: [{ label: 'Open Slop Drive', act: () => { window.open(new URL('drive/', H().ROOT).href, '_blank'); return false; } }, { label: 'Cancel' }],
        onClose: () => { urls.forEach((u) => URL.revokeObjectURL(u)); res(chosen); } });
      render();
    });
  }

  /** pickFolder({ title, ok, start }): resolves with a folder id, null for the root, or undefined if cancelled. */
  function pickFolder({ title = 'Choose a folder', ok = 'Save here', start = null, exclude = [] } = {}) {
    return new Promise((res) => {
      const UIx = UI(), el = UIx.el;
      let cwd = start, result;
      const bar = el('div', { class: 'hub-bar' }), rows = el('div', { class: 'hub-rows', role: 'list' });
      async function render() {
        const { all } = await visibleFolders().catch(() => ({ all: [] }));
        if (cwd && !all.some((f) => f.id === cwd)) cwd = null;
        const newBtn = el('button', { type: 'button', class: 'sui-btn' }, 'New folder');
        newBtn.addEventListener('click', async () => { const n = await UIx.prompt('New folder', 'Name', 'New folder'); if (n && n.trim()) { cwd = await H().createFolder(n.trim(), cwd); render(); } });
        bar.replaceChildren(crumbs(cwd ? await H().folderPath(cwd) : [], (id) => { cwd = id; render(); }), newBtn);
        rows.replaceChildren();
        for (const f of all.filter((x) => x.parentId === cwd && !exclude.includes(x.id))) {
          const b = el('button', { type: 'button', class: 'hub-row', role: 'listitem', 'data-folder': f.id }, folderIcon(), el('span', null, f.name));
          b.addEventListener('click', () => { cwd = f.id; render(); });
          rows.append(b);
        }
        if (!rows.children.length) rows.append(el('p', { class: 'sui-p' }, 'No folders here. This is where the file will go.'));
      }
      UIx.dialog({ title, body: el('div', null, bar, rows), buttons: [{ label: 'Cancel' }, { label: ok, primary: true, act: () => { result = cwd; } }],
        onClose: (okd) => res(okd ? result : undefined) });
      render();
    });
  }
  window.SlopDrivePicker = { pickFile, pickFolder };
})();
