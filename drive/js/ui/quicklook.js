/* Slop Drive — ui/quicklook: Space opens a large preview (images, SVG, text, PDF pages, audio, video).
 * ←/→ step through the files in view, Space or Esc closes. Built on SlopUI.dialog. */
'use strict';
(function (DR) {
  const S = DR.S, el = DR.el;
  let current = null;
  DR.quickLookOpen = () => !!current;
  DR.quickLook = function (r) {
    if (!r || r.isFolder) return;
    if (current) current.close(false);
    DR.touch(r);
    const files = (DR.lastVisible || []).filter((x) => !x.isFolder), i = files.findIndex((x) => x.id === r.id);
    const apps = r.trashedAt ? [] : DR.orderedAppsFor(r);
    const qlUrls = [], pv = DR.previewOf(r, true, qlUrls); // its own object URLs: the details panel frees its own on each change
    let fh = null, shut = false; // the face badge and boxes (shared/faces/view.js), when the picture has been checked
    const meta = el('div', { class: 'ql-meta' }, `${DR.kindLabel(r)} · ${DR.fmtSize(r.size)} · ${DR.appName(r.from)} · ${DR.fmtFull(r.modified || r.time)}`, files.length > 1 && i >= 0 ? el('span', null, `${i + 1} / ${files.length}`) : '');
    const buttons = [];
    if (apps.length) buttons.push({ label: `Open in ${apps[0].name}`, act: () => { DR.openWith(r, apps[0].id); } });
    buttons.push({ label: 'Download', act: () => { DR.downloadFile(r); return false; } }, { label: 'Close', primary: true });
    const d = window.SlopUI.dialog({ title: r.name, cls: 'sui-wide ql', body: el('div', null, pv, meta), buttons, onClose: () => { shut = true; if (fh) fh.destroy(); if (current === d) current = null; qlUrls.forEach((u) => URL.revokeObjectURL(u)); } });
    DR.attachFaces(pv, r, meta).then((h) => { if (shut && h) h.destroy(); else fh = h; });
    d.box.dataset.ql = r.id;
    current = d;
    const step = (n) => { const next = files[(i + n + files.length) % files.length]; if (next && next.id !== r.id) { if (S.sel.size <= 1) DR.select([DR.keyOf(next)]); DR.quickLook(next); } };
    d.box.addEventListener('keydown', (e) => {
      if (e.target.closest('audio, video, input, .ap')) return;
      if (e.key === ' ') { e.preventDefault(); e.stopPropagation(); d.close(false); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); step(1); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); step(-1); }
    });
    return d;
  };
})(window.DR);
