/* Slop Drive — ui/info: the details panel (right side on desktop, a bottom sheet on phones): a live preview
 * plus size, kind, type, dates, the app that made it, location, dimensions and tags. The grip and the width: info-width.js. */
'use strict';
(function (DR) {
  const S = DR.S, el = DR.el, $ = DR.$;
  let shownKey = null, urls = [];
  const free = () => { urls.forEach((u) => URL.revokeObjectURL(u)); urls = []; };
  const objUrl = (b) => { const u = URL.createObjectURL(b); urls.push(u); return u; };
  const rows = (pairs) => el('dl', { class: 'facts' }, pairs.filter((p) => p && p[1] != null && p[1] !== '').flatMap(([k, v]) => [el('dt', null, k), el('dd', null, v)]));

  /** A live preview element for a file (shared with Quick Look). big: full-size variant. */
  DR.previewOf = function (r, big = false) {
    const kind = DR.kindOf(r), box = el('div', { class: 'pv pv-' + kind });
    if (kind === 'image') { box.append(el('img', { src: objUrl(r.blob), alt: r.name, draggable: 'false' })); }
    else if (kind === 'audio') box.append(el('audio', { src: objUrl(r.blob), controls: true, preload: 'metadata' }));
    else if (kind === 'video') box.append(el('video', { src: objUrl(r.blob), controls: true, preload: 'metadata', playsinline: true }));
    else if (kind === 'text') {
      const pre = el('pre', { class: 'pv-text' }, 'Loading…');
      r.blob.slice(0, big ? 400000 : 4000).text().then((t) => { pre.textContent = t + (r.size > (big ? 400000 : 4000) ? '\n…' : ''); });
      box.append(pre);
    } else if (kind === 'pdf') {
      if (big) {
        const pages = el('div', { class: 'pv-pages' }, el('p', { class: 'pv-note' }, 'Rendering…'));
        box.append(pages);
        DR.openPdf(r.blob).then(async (doc) => {
          pages.replaceChildren();
          const n = Math.min(doc.numPages, 20);
          for (let i = 1; i <= n && pages.isConnected; i++) pages.append(await DR.renderPdfPage(doc, i, Math.min(900, innerWidth - 80) * (devicePixelRatio > 1 ? 1.5 : 1)));
          if (doc.numPages > n) pages.append(el('p', { class: 'pv-note' }, `Showing ${n} of ${doc.numPages} pages. Open it in Slop PDF for the rest.`));
          doc.destroy();
        }).catch(() => { pages.replaceChildren(el('p', { class: 'pv-note' }, 'This PDF could not be rendered.')); });
      } else { const th = el('div', { class: 'th' }, DR.badge(r, 'badge big')); DR.fillThumb(th, r); box.append(th); }
    } else box.append(el('div', { class: 'th' }, DR.badge(r, 'badge big')), el('p', { class: 'pv-note' }, 'No preview for this kind of file.'));
    return box;
  };
  function dims(r) {
    const m = DR.mediaInfo(r);
    if (!m) return null;
    if (m.pages) return `${m.pages} page${m.pages === 1 ? '' : 's'} · ${m.w} × ${m.h} pt`;
    let s = `${m.w} × ${m.h} px`;
    if (m.duration) s += ` · ${Math.floor(m.duration / 60)}:${String(Math.round(m.duration % 60)).padStart(2, '0')}`;
    return s;
  }
  function actions(r) {
    const b = (label, act, cls = '') => { const x = el('button', { type: 'button', class: 'btn ' + cls }, label); x.addEventListener('click', act); return x; };
    if (r.trashedAt) return el('div', { class: 'acts' }, b('Restore', () => DR.restore([r]), 'primary'), b('Delete forever', () => DR.purge([r]), 'danger'));
    const apps = DR.appsFor(r);
    return el('div', { class: 'acts' }, ...apps.slice(0, 3).map((a, i) => b(`Open in ${a.name}`, () => DR.openWith(r, a.id), i ? '' : 'primary')),
      r.isFolder ? b('Open', () => DR.open(r), 'primary') : b('Quick look', () => DR.quickLook(r)),
      b(r.isFolder ? 'Download .zip' : 'Download', () => DR.download([r])), b(r.starred ? 'Unstar' : 'Star', () => DR.setStar([r], !r.starred)));
  }
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
    const facts = rows([['Kind', DR.kindLabel(r)], ['Type', r.type], ['Size', `${DR.fmtSize(r.size)} (${(r.size || 0).toLocaleString()} bytes)`], ['Made by', DR.appName(r.from)],
      ['Location', loc], ['Added', DR.fmtFull(r.time)], ['Modified', DR.fmtFull(r.modified)], ['Opened', r.opened ? DR.fmtFull(r.opened) : 'Never'], r.trashedAt ? ['Trashed', DR.fmtFull(r.trashedAt)] : null]);
    if (['image', 'video', 'pdf'].includes(DR.kindOf(r))) facts.append(el('dt', null, DR.kindOf(r) === 'pdf' ? 'Pages' : 'Dimensions'), dd);
    return [head, DR.previewOf(r), actions(r), facts, tagBox(r)];
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
