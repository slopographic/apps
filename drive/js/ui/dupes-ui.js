/* Slop Drive — ui/dupes-ui: the duplicate finder dialog. Groups of identical files (SHA-256) with the space
 * they waste; pick the one to keep per group, or keep the newest / oldest everywhere, and trash the rest.
 * Near-duplicate images (dHash) are listed separately, for review only. */
'use strict';
(function (DR) {
  const el = DR.el;
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
    async function applyAll(mode) {
      if (!res || !res.groups.length) return false;
      const victims = res.groups.flatMap((g) => DR.dupesToTrash(g, mode));
      if (!(await UI.confirm('Trash duplicates?', `Keep the ${mode} copy in each group and move ${victims.length} file${victims.length === 1 ? '' : 's'} (${DR.fmtSize(res.wasted)}) to the Trash?`, 'Move to Trash'))) return false;
      await DR.trash(victims);
      await scan();
      return false;
    }
    function thumb(r) { const t = el('span', { class: 'dthumb' }, DR.badge(r, 'badge xs')); DR.fillThumb(t, r); return t; }
    function group(g, i) {
      const name = 'keep-' + i;
      if (!keep.has(g.hash)) keep.set(g.hash, g.files[0].id);
      const rows = g.files.map((r) => {
        const radio = el('input', { type: 'radio', name, value: r.id, checked: keep.get(g.hash) === r.id, 'aria-label': 'Keep ' + r.name });
        radio.addEventListener('change', () => keep.set(g.hash, r.id));
        const where = r.parent ? DR.pathOf(r.parent).map((f) => f.name).join(' / ') : 'Slop Drive';
        const show = el('button', { type: 'button', class: 'linkish' }, 'Show');
        show.addEventListener('click', () => { d.close(); DR.reveal(r); });
        return el('label', { class: 'drow' }, radio, thumb(r), el('span', { class: 'dn' }, el('b', null, r.name), el('small', null, `${where} · ${DR.fmtFull(r.modified || r.time)} · ${DR.appName(r.from)}`)), show);
      });
      const go = el('button', { type: 'button', class: 'sui-btn' }, 'Trash the others');
      go.addEventListener('click', async () => { await DR.trash(DR.dupesToTrash(g, keep.get(g.hash))); await scan(); });
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
