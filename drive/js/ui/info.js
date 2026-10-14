/* Slop Drive — ui/info: the details panel (right side on desktop, a bottom sheet on phones): a live preview
 * plus size, kind, type, dates, the app that made it, location, dimensions and tags. The grip and the width: info-width.js. */
'use strict';
(function (DR) {
  const S = DR.S, el = DR.el, $ = DR.$;
  let shownKey = null, urls = [];
  const free = () => { urls.forEach((u) => URL.revokeObjectURL(u)); urls = []; };
  const objUrl = (b, sink = urls) => { const u = URL.createObjectURL(b); sink.push(u); return u; };
  const rows = (pairs) => el('dl', { class: 'facts' }, pairs.filter((p) => p && p[1] != null && p[1] !== '').flatMap(([k, v]) => [el('dt', null, k), el('dd', null, v)]));

  /** A live preview element for a file (Quick Look, the details panel and the columns). Images and PDFs use the shared
   * viewer (ui/viewer.js: zoom, pan, open in a new tab). 3D scenes get a live 3D view (ui/preview-3d.js), CSV a table,
   * text its start, and any other kind its card (ui/preview-kinds.js). big: the Quick Look variant. sink: the array that
   * keeps its object URLs (the info panel frees its own on each change; a column keeps its own). */
  DR.previewOf = function (r, big = false, sink = urls) {
    const kind = DR.kindOf(r), box = el('div', { class: 'pv pv-' + kind });
    if (kind === 'image' || kind === 'pdf' || DR.isAi(r)) box.append(DR.viewerFor(r, big, sink).el);
    else if (kind === 'model' && DR.ext(r.name) === 's3d') box.append(DR.preview3d(r, big));
    else if (kind === 'audio') box.append(DR.audioView(r, big));
    else if (kind === 'video') box.append(el('video', { src: objUrl(r.blob, sink), controls: true, preload: 'metadata', playsinline: true }));
    else if (kind === 'text' && ['csv', 'tsv'].includes(DR.ext(r.name))) box.append(DR.csvPreview(r, big));
    else if (kind === 'text') box.append(DR.textPreview(r, big));
    else box.append(...DR.cardPreview(r));
    return box;
  };
  function dims(r) {
    const m = DR.mediaInfo(r);
    if (!m) return null;
    if (m.pages) return `${m.pages} page${m.pages === 1 ? '' : 's'} · ${m.w} × ${m.h} pt`;
    const parts = [];
    if (m.w) parts.push(`${m.w} × ${m.h} px`);
    if (m.duration) parts.push(`${Math.floor(m.duration / 60)}:${String(Math.round(m.duration % 60)).padStart(2, '0')}`);
    return parts.join(' · ') || null;
  }
  function actions(r) {
    const b = (label, act, cls = '') => { const x = el('button', { type: 'button', class: 'btn ' + cls }, label); x.addEventListener('click', act); return x; };
    if (r.trashedAt) return el('div', { class: 'acts' }, b('Restore', () => DR.restore([r]), 'primary'), b('Delete forever', () => DR.purge([r]), 'danger'));
    const apps = DR.orderedAppsFor(r), d = apps[0];
    const openIn = r.isFolder ? [] : d ? [b(`Open in ${d.name}`, () => DR.openWith(r, d.id, { remember: false }), 'primary'),
      b('Open in…', (e) => { const x = e.currentTarget.getBoundingClientRect(); window.SlopUI.menu(DR.openInRows(r), x.left, x.bottom + 4); })] : [el('span', { class: 'muted' }, 'No app opens this type')];
    return el('div', { class: 'acts' }, ...openIn,
      r.isFolder ? b('Open', () => DR.open(r), 'primary') : b('Quick look', () => DR.quickLook(r)),
      b(r.isFolder ? 'Download .zip' : 'Download', () => DR.download([r])), b(r.starred ? 'Unstar' : 'Star', () => DR.setStar([r], !r.starred)),
      DR.isCleanable(r) ? b('Remove metadata…', () => DR.openInClean(r)) : null,
      DR.isFaceable(r) ? b('Find faces', () => DR.findFaces([r])) : null,
      DR.isFaceable(r) ? b('Faces and people…', () => DR.openFaces()) : null);
  }
  /** The face row for a picture, when face detection is on: the badge with the count (it draws the boxes on the preview
   * when opened, shared/faces/view.js), or "Not checked yet". With the mode Off, the count as text. */
  function faceRow(r, facts, preview) {
    if (!DR.isFaceable(r) || !window.SlopFaces || !window.SlopFaces.enabled()) return;
    const cell = el('dd', { class: 'faces-n' }, 'Not checked yet');
    facts.append(el('dt', null, 'Faces'), cell);
    DR.facesOf(r).then((row) => {
      if (!row) return;
      if (window.SlopFaces.view.mode() === 'off') { cell.textContent = DR.faceText(row.faces.length); return; }
      cell.textContent = '';
      DR.attachFaces(preview, r, cell).then((h) => { if (h) faceH = h; });
    });
  }
  let faceH = null; // the badge and boxes of the shown picture (destroyed when the panel is rebuilt)
  function single(r) {
    const head = el('div', { class: 'info-h' }, DR.badge(r, 'badge sm'), el('h2', { title: r.name }, r.name));
    const loc = r.parent ? DR.pathOf(r.parent).map((f) => f.name).join(' / ') : 'Slop Drive';
    if (r.isFolder) {
      const c = DR.children(r.id), sub = DR.descendants(r.id);
      return [head, el('div', { class: 'pv pv-folder' }, DR.icon('folder', 'ic huge')), actions(r),
        rows([['Kind', 'Folder'], ['Contains', `${c.folders.length} folders, ${c.files.length} files`], ['All inside', `${sub.files.filter((x) => !DR.hidden(x)).length} files`], ['Size', DR.fmtSize(DR.sizeOf(r))],
          ['Location', loc], ['Created', DR.fmtFull(r.time)], ['Modified', DR.fmtFull(r.modified)], r.trashedAt ? ['Trashed', DR.fmtFull(r.trashedAt)] : null])];
    }
    const dd = el('dd', { class: 'dims' }, dims(r) || '—');
    if (!dims(r)) DR.thumb(r).then(() => { const v = dims(r); dd.textContent = v || '—'; });
    const nv = DR.versionCount(r);
    const facts = rows([['Kind', DR.kindLabel(r)], ['Type', r.type], ['Size', `${DR.fmtSize(r.size)} (${(r.size || 0).toLocaleString()} bytes)`], ['Made by', DR.appName(r.from)],
      ['Location', loc], ['Added', DR.fmtFull(r.time)], ['Modified', DR.fmtFull(r.modified)], ['Opened', r.opened ? DR.fmtFull(r.opened) : 'Never'],
      nv ? ['Versions', `${nv} saved. Switch between them in the preview above.`] : null, r.trashedAt ? ['Trashed', DR.fmtFull(r.trashedAt)] : null]);
    if (['image', 'video', 'pdf'].includes(DR.kindOf(r))) facts.append(el('dt', null, DR.kindOf(r) === 'pdf' ? 'Pages' : 'Dimensions'), dd);
    const pv = DR.previewOf(r);
    faceRow(r, facts, pv);
    return [head, pv, DR.pvGrip(), actions(r), facts, tagBox(r)];
  }
  /** A file's tags: a chip per tag with a remove button, and a box that adds more (Enter or a comma). */
  function tagBox(r) {
    const focusTags = () => { const i = DR.$('info') && DR.$('info').querySelector('.tag-in'); if (i) i.focus(); };
    const chips = DR.tagsOf(r).map((t) => {
      const x = el('button', { type: 'button', class: 'tag-x', title: `Remove ${t}`, 'aria-label': `Remove tag ${t}` }, DR.icon('x'));
      x.addEventListener('click', async () => { await DR.removeTag([r], t); focusTags(); });
      return el('span', { class: 'tag' }, t, x);
    });
    const input = el('input', { type: 'text', class: 'tag-in', placeholder: 'Add a tag', 'aria-label': 'Add a tag', autocomplete: 'off', maxlength: '200' });
    input.addEventListener('keydown', async (e) => {
      if (e.key !== 'Enter' && e.key !== ',') return;
      e.preventDefault();
      if (input.value.trim()) { await DR.addTags([r], input.value); focusTags(); }
    });
    return el('div', { class: 'tags-box' }, el('h3', { class: 'tags-h' }, 'Tags'),
      el('div', { class: 'tag-chips' }, ...(chips.length ? chips : [el('span', { class: 'muted' }, 'No tags yet')])), input);
  }
  function many(items) {
    const by = new Map();
    for (const it of items) { const k = DR.KIND[DR.kindOf(it)]; by.set(k, (by.get(k) || 0) + 1); }
    return [el('div', { class: 'info-h' }, el('h2', null, `${items.length} items`)),
      el('div', { class: 'kinds' }, [...by].map(([k, n]) => el('span', { class: 'chip', style: `--k:${k.color}` }, `${n} ${n === 1 ? k.one.toLowerCase() : k.label.toLowerCase()}`))),
      rows([['Total size', DR.fmtSize(items.reduce((n, it) => n + DR.sizeOf(it), 0))]])];
  }
  function place() {
    const it = S.section === 'folder' && S.cwd ? S.folders.get(S.cwd) : null;
    if (it) return single(it);
    const list = DR.lastVisible || [];
    return [el('div', { class: 'info-h' }, el('h2', null, DR.placeName())), el('p', { class: 'muted' }, 'Select a file to see its details and a preview.'),
      rows([['Items here', String(list.length)], ['Size', DR.fmtSize(list.reduce((n, x) => n + DR.sizeOf(x), 0))]])];
  }
  DR.renderInfo = function (force) {
    const box = $('info'), open = S.info || document.body.classList.contains('sheet-open');
    box.hidden = !open;
    document.body.classList.toggle('info-on', !!S.info);
    if (!open) { shownKey = null; free(); return; }
    const items = DR.selected();
    const key = DR.version() + '|' + (items.length ? items.map(DR.keyOf).join(',') : 'place:' + S.section + ':' + S.cwd + ':' + (DR.lastVisible || []).length);
    if (key === shownKey && !force) return;
    shownKey = key; free();
    if (faceH) { faceH.destroy(); faceH = null; }
    const close = el('button', { type: 'button', class: 'tb info-x', 'aria-label': 'Close details' }, DR.icon('x'));
    close.addEventListener('click', () => { if (document.body.classList.contains('sheet-open')) DR.sheet(false); else DR.toggleInfo(false); });
    box.replaceChildren(DR.$('infoGrip'), close, ...(items.length === 1 ? single(items[0]) : items.length ? many(items) : place()));
  };
  /** Phones: the details panel as a bottom sheet. */
  DR.sheet = function (open) {
    document.body.classList.toggle('sheet-open', !!open);
    $('scrim').hidden = !open && !document.body.classList.contains('drawer-open');
    DR.renderInfo(true);
  };
})(window.DR);
