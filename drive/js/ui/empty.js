/* Slop Drive — ui/empty: friendly empty states with Sloppo (painted by shared/sloppo, an ES module loaded
 * on demand). He bobs gently, unless the person prefers reduced motion. */
'use strict';
(function (DR) {
  const el = DR.el;
  let painter = null;
  const MASCOT = /*profile:mascot*/true;   // the brand profile's mascot switch (set at build time)
  const load = () => painter || (painter = import(new URL('../shared/sloppo/index.js', document.baseURI).href).catch(() => null));
  const LOOKS = {
    drive: { eyes: 'happy', mouth: 'open', hat: 'party' },
    folder: { eyes: 'sleepy', mouth: 'o' },
    trash: { eyes: 'star', mouth: 'smirk' },
    search: { eyes: 'spiral', mouth: 'wavy' },
    starred: { eyes: 'heart', mouth: 'blep' },
    recent: { eyes: 'wink', mouth: 'smirk' },
  };
  const TEXT = {
    drive: ['Slop Drive is empty', 'Drop files here, upload a folder, or use “Send to…” in any Slopographic app. Everything stays in this browser.'],
    folder: ['This folder is empty', 'Drag files in from your computer or from another folder.'],
    trash: ['The Trash is empty', 'Deleted files wait here until you empty the Trash.'],
    search: ['Nothing found', 'Try another word, or clear the kind filter.'],
    starred: ['No stars yet', 'Star the files you use most (press S) and they show up here.'],
    recent: ['Nothing recent', 'Files you add or open show up here.'],
  };
  /** The empty-state block for a situation (drive | folder | trash | search | starred | recent). */
  DR.emptyState = function (what) {
    const [h, p] = TEXT[what] || TEXT.folder;
    const cv = el('canvas', { class: 'sloppo', width: 360, height: 300, 'aria-hidden': 'true' });
    const acts = el('div', { class: 'acts' });
    if (what === 'drive' || what === 'folder') {
      const up = el('button', { type: 'button', class: 'btn primary' }, DR.icon('upload'), 'Upload files');
      up.addEventListener('click', () => DR.uploadPicker(false));
      const nf = el('button', { type: 'button', class: 'btn' }, DR.icon('folder'), 'New folder');
      nf.addEventListener('click', () => DR.newFolder(DR.dest()));
      acts.append(up, nf);
      if (what === 'drive') { const bk = el('button', { type: 'button', class: 'btn' }, 'Restore a backup…'); bk.addEventListener('click', () => DR.backupDialog()); acts.append(bk); }
    } else if (what === 'search') {
      const clr = el('button', { type: 'button', class: 'btn' }, 'Clear search');
      clr.addEventListener('click', () => { DR.S.query = ''; DR.S.tag = ''; DR.S.kind = 'all'; DR.$('search').value = ''; DR.render(); });
      acts.append(clr);
    }
    if (!MASCOT) cv.hidden = true;
    const box = el('div', { class: 'empty', 'data-empty': what }, cv, el('h2', null, h), el('p', null, p), acts);
    if (MASCOT) paint(cv, LOOKS[what] || LOOKS.folder);
    return box;
  };
  function paint(cv, look) {
    load().then((m) => {
      if (!m) return;
      const dpr = Math.min(2, devicePixelRatio || 1), W = 180, Hh = 150;
      cv.width = W * dpr; cv.height = Hh * dpr; cv.style.width = W + 'px'; cv.style.height = Hh + 'px';
      const g = cv.getContext('2d'), still = matchMedia('(prefers-reduced-motion: reduce)').matches, t0 = performance.now();
      const frame = (now) => {
        if (!cv.isConnected) return;
        g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, Hh);
        try { m.drawSloppo(g, W, Hh, Object.assign({ body: 'lime', noGlow: true, seed: 3, scale: 1.35, baseY: 0.9 }, look), still ? 0 : (now - t0) / 1000); } catch (e) { return; }
        if (!still) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
  }
})(window.DR);
