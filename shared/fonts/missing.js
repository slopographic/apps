/* Slopographic missing-font check (window.SlopFontCheck), for every app. Before a text edit, an app lists the families its
 * text uses that are neither installed nor bundled, and calls ask(needs). For each family the person picks one answer:
 *  - download it from the library: Get more opens that pack's confirmation; nothing downloads until they confirm there;
 *  - drop a font file they own (TTF, OTF, WOFF or WOFF2), on the button or onto the row; it is stored on the device;
 *  - use the closest bundled font instead.
 * ask(needs) resolves a Map family -> { family, how } ('library', 'file' or 'closest') once every family has an answer, or null
 * when the person cancels the edit. needs: [{ family, closest, pack }], pack being { id, name } or null when no listed pack has it.
 * Classic script; needs shared/fonts/catalog.js. */
(function (root) {
  'use strict';
  const doc = root.document, C = () => root.SlopFontCatalog;
  let host = null;

  function el(tag, attrs, ...kids) {
    const n = doc.createElement(tag);
    for (const k in attrs || {}) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'on') for (const ev in attrs.on) n.addEventListener(ev, attrs.on[ev]);
      else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    }
    for (const c of kids) if (c != null) n.append(c);
    return n;
  }
  function css() {
    if (doc.getElementById('slop-fontask-css')) return;
    doc.head.append(el('style', { id: 'slop-fontask-css' }, `
.sf-ov{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:9990;font:13px system-ui,sans-serif}
.sf-box{background:#fff;color:#111;border-radius:10px;width:min(560px,calc(100vw - 32px));max-height:80vh;overflow:auto;padding:16px;box-shadow:0 12px 40px rgba(0,0,0,.35)}
.sf-box h2{font-size:16px;margin:0 0 6px}.sf-meta{color:#555;font-size:12px;margin:4px 0}.sf-row{border-top:1px solid #ddd;padding:10px 0}
.sf-row.done{opacity:.6}.sf-row p{margin:0 0 8px}.sf-btns{display:flex;flex-wrap:wrap;gap:6px}.sf-foot{display:flex;justify-content:flex-end;margin-top:10px}
.sf-box button{font:inherit;padding:6px 10px;border-radius:6px;border:1px solid #888;background:#f4f4f4;color:#111;cursor:pointer}
.sf-box button.pri{background:#222;color:#fff;border-color:#222}.sf-box button:disabled{opacity:.5;cursor:default}
@media (prefers-color-scheme:dark){.sf-box{background:#1d1d20;color:#eee}.sf-row{border-color:#3a3a40}.sf-meta{color:#aaa}.sf-box button{background:#2a2a30;color:#eee;border-color:#555}.sf-box button.pri{background:#eee;color:#111;border-color:#eee}}
`));
  }

  /** Asks about the needed families. uses: the fonts the document embeds, listed in the dialog. Resolves the answers (a Map)
   * or null when the edit is cancelled. */
  function ask(needs, uses) {
    if (!needs.length) return Promise.resolve(new Map());
    css();
    if (host) host.remove();
    return new Promise((resolve) => {
      const answers = new Map(), rows = new Map();
      let finished = false;
      const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); finish(null); } };
      function finish(result) {
        if (finished) return;
        finished = true;
        doc.removeEventListener('keydown', onKey, true);
        if (host) host.remove();
        host = null;
        resolve(result);
      }
      /** Records one family's answer, updates its row, and finishes when every family has one. */
      function answer(n, how, family) {
        if (finished || answers.has(n.family)) return;
        answers.set(n.family, { family, how });
        const r = rows.get(n.family);
        r.row.classList.add('done');
        r.status.textContent = how === 'library' ? `${n.family} is installed.` : how === 'file' ? `Using ${family} from your file.` : `Using ${family} instead.`;
        if (answers.size === needs.length) finish(answers);
      }
      /** Drops a font file on one family's row: fontkit must read it, then it is stored on the device. */
      async function drop(n, file) {
        const st = rows.get(n.family).status;
        st.textContent = 'Checking ' + file.name + '…';
        try { const r = await C().addUserFile(file); answer(n, 'file', r.family); }
        catch (e) { st.textContent = e.message; }
      }
      needs.forEach((n) => {
        const status = el('p', { class: 'sf-meta', role: 'status' });
        const input = el('input', { type: 'file', accept: '.ttf,.otf,.woff,.woff2', hidden: '' });
        input.addEventListener('change', () => { if (input.files[0]) drop(n, input.files[0]); input.value = ''; });
        const btns = [];
        if (n.pack) {
          btns.push(el('button', { type: 'button', class: 'pri', 'data-how': 'library', on: { click: () => root.SlopLibrary.open({ packId: n.pack.id, onInstalled: (p) => fromPack(p) }) } }, 'Download from the library'));
        }
        btns.push(el('button', { type: 'button', 'data-how': 'file', on: { click: () => input.click() } }, 'Drop your own file…'));
        btns.push(el('button', { type: 'button', 'data-how': 'closest', on: { click: () => answer(n, 'closest', n.closest) } }, `Use the closest font instead (${n.closest})`));
        const row = el('div', { class: 'sf-row', 'data-family': n.family },
          el('p', null, `This document uses ${n.family}, which is not installed. Download it to edit the text as it looks?`),
          n.pack ? null : el('p', { class: 'sf-meta' }, `${n.family} is not in the font library, so it cannot be downloaded here.`),
          el('div', { class: 'sf-btns' }, ...btns), input, status);
        row.addEventListener('dragover', (e) => e.preventDefault());
        row.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) drop(n, e.dataTransfer.files[0]); });
        rows.set(n.family, { row, status });
      });
      /** After a pack is installed, every family it lists is installed too. */
      function fromPack(p) { needs.forEach((n) => { if (n.pack && n.pack.id === p.id) answer(n, 'library', n.family); }); }
      host = el('div', { class: 'sf-ov' }, el('div', { class: 'sf-box', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sfTitle' },
        el('h2', { id: 'sfTitle' }, 'Fonts this document uses are not installed'),
        el('p', { class: 'sf-meta' }, 'This document uses: ' + (uses || needs.map((n) => n.family)).join(', ') + '.'),
        el('p', { class: 'sf-meta' }, 'Choose how to edit the text. Nothing is downloaded until you confirm it in the library.'),
        ...needs.map((n) => rows.get(n.family).row),
        el('div', { class: 'sf-foot' }, el('button', { type: 'button', on: { click: () => finish(null) } }, 'Cancel edit'))));
      doc.addEventListener('keydown', onKey, true);
      doc.body.append(host);
    });
  }

  root.SlopFontCheck = { ask };
})(typeof window !== 'undefined' ? window : globalThis);
