/* Slop Drive — ui/dupes-ui: the duplicate finder dialog. Groups of identical files (SHA-256) with the space
 * they waste; pick the one to keep per group, or keep the newest / oldest everywhere, and trash the rest.
 * Every trash step opens a review list first (SlopReview): one checkbox per file, the copies to remove checked,
 * the copy to keep unchecked. Only the files left checked are moved to the Trash.
 * Near-duplicate images (dHash) are listed separately, for review only. */
'use strict';
(function (DR) {
  const el = DR.el;
  const plural = (n) => window.SlopReview.model.plural(n, 'file');
  const where = (r) => (r.parent ? DR.pathOf(r.parent).map((f) => f.name).join(' / ') : 'Slop Drive');

  /** One review item per file in the groups. pick(group) gives the copies to remove; the others are kept. */
  function itemsFor(groups, pick) {
    return groups.flatMap((g, i) => {
      const victims = new Set(pick(g).map((r) => r.id));
      const label = `${i + 1}. ${g.files.length} copies of ${g.files[0].name}`;
      return g.files.map((r) => ({ id: r.id, label: r.name, detail: where(r) + (victims.has(r.id) ? '' : ' · the copy kept'),
        size: r.size, group: label, checked: victims.has(r.id) }));
    });
  }

  DR.dupesDialog = async function ({ near = true } = {}) {
    const UI = window.SlopUI;
    const status = el('p', { class: 'sui-p', role: 'status' }, 'Looking for duplicates…');
    const body = el('div', { class: 'dupes' }, status);
    const keep = new Map();
    let res = null;
    const d = UI.dialog({ title: 'Find duplicates', cls: 'sui-wide dupes-dlg', body, buttons: [
      { label: 'Keep newest everywhere', act: () => applyAll('newest') },
      { label: 'Keep oldest everywhere', act: () => applyAll('oldest') },
      { label: 'Close', primary: true },
    ] });
    d.box.dataset.dupes = '1';
    /** Opens the review list for these groups, and moves the files left checked to the Trash. Keeps the dialog open. */
    async function reviewAndTrash(groups, pick, title) {
      const ids = await window.SlopReview.open({ title, items: itemsFor(groups, pick),
        intro: 'Only the checked files move to the Trash. Untick a file to keep it. You can restore them from the Trash.',
        confirmLabel: (n) => 'Trash ' + plural(n), danger: false });
      if (!ids) return false;
      const want = new Set(ids);
      await DR.trash(groups.flatMap((g) => g.files).filter((r) => want.has(r.id)));
      await scan();
      return false;
    }
    function applyAll(mode) {
      if (!res || !res.groups.length) return false;
      return reviewAndTrash(res.groups, (g) => DR.dupesToTrash(g, mode), 'Trash duplicates?');
    }
    function thumb(r) { const t = el('span', { class: 'dthumb' }, DR.badge(r, 'badge xs')); DR.fillThumb(t, r); return t; }
    function group(g, i) {
      const name = 'keep-' + i;
      if (!keep.has(g.hash)) keep.set(g.hash, g.files[0].id);
      const rows = g.files.map((r) => {
        const radio = el('input', { type: 'radio', name, value: r.id, checked: keep.get(g.hash) === r.id, 'aria-label': 'Keep ' + r.name });
        radio.addEventListener('change', () => keep.set(g.hash, r.id));
        const show = el('button', { type: 'button', class: 'linkish' }, 'Show');
        show.addEventListener('click', () => { d.close(); DR.reveal(r); });
        return el('label', { class: 'drow' }, radio, thumb(r), el('span', { class: 'dn' }, el('b', null, r.name), el('small', null, `${where(r)} · ${DR.fmtFull(r.modified || r.time)} · ${DR.appName(r.from)}`)), show);
      });
      const go = el('button', { type: 'button', class: 'sui-btn' }, 'Trash the others');
      go.addEventListener('click', () => reviewAndTrash([g], (x) => DR.dupesToTrash(x, keep.get(x.hash)), 'Trash the others?'));
      return el('section', { class: 'dgroup', 'data-hash': g.hash }, el('div', { class: 'dhead' }, el('b', null, `${g.files.length} copies · ${DR.fmtSize(g.size)} each`), el('span', null, `${DR.fmtSize(g.wasted)} wasted`), go), ...rows);
    }
    async function scan() {
      body.replaceChildren(status);
      res = await DR.findDupes({ near, onProgress: (t) => { status.textContent = t; } });
      const kids = [];
      kids.push(el('div', { class: 'dsum' }, el('b', null, res.groups.length ? `${res.groups.length} group${res.groups.length === 1 ? '' : 's'} of identical files` : 'No identical files.'),
        el('span', null, `${DR.fmtSize(res.wasted)} could be freed · ${res.scanned} files checked`)));
      res.groups.forEach((g, i) => kids.push(group(g, i)));
      if (res.near.length) {
        kids.push(el('h3', { class: 'dh3' }, 'Similar images'), el('p', { class: 'sui-p' }, 'These look alike but are not byte-for-byte the same (for example resized or re-saved). Review them yourself.'));
        for (const n of res.near) kids.push(el('section', { class: 'dgroup near' }, el('div', { class: 'dhead' }, el('b', null, `${n.files.length} similar images`), el('span', null, n.distance ? `difference ${n.distance}/64` : 'almost identical')),
          ...n.files.map((r) => { const show = el('button', { type: 'button', class: 'linkish' }, 'Show'); show.addEventListener('click', () => { d.close(); DR.reveal(r); }); return el('div', { class: 'drow' }, thumb(r), el('span', { class: 'dn' }, el('b', null, r.name), el('small', null, DR.fmtSize(r.size))), show); })));
      }
      body.replaceChildren(...kids);
      return res;
    }
    DR.dupesScan = scan;
    return scan();
  };
})(window.DR);
