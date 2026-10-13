/* Slopographic Fonts panel and missing-font check (adds openPanel, check and askOnce to window.SlopFonts). Classic script;
 * loaded by picker.js on first use, and needs catalog.js.
 * - openPanel(opts): one dialog for the fonts a document uses and the library. Each family has a status: built in (a standard
 *   name), bundled, downloaded, your own file, or missing. A missing family can be downloaded (Get more opens that pack's
 *   confirmation; nothing downloads until it is confirmed there), taken from a font file the person owns (dropped on its row or
 *   on the footer; it is stored on the device like a pack), or replaced by the closest bundled family. The panel can be opened
 *   again at any time, after it was closed or dismissed.
 * - check(names, opts): the names that are neither built in nor installed, as [{ family, closest, pack, category }].
 * - askOnce(document, names, opts): opens the panel the first time a document is checked and a family is missing. Once per
 *   document object; the Fonts… button still opens the panel. */
(function (root) {
  'use strict';
  const doc = root.document, C = () => root.SlopFontCatalog, L = () => root.SlopLibrary;
  let cur = null;     // the open panel's handle
  const asked = new WeakSet();
  /** The family a missing name falls back to: the app's own closest map (opts.closest: { sans, serif, mono }) or the catalogue's. */
  const closestOf = (n, opts) => (opts && opts.closest && opts.closest[C().guessCategory(n)]) || C().closestFamily(n);

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
.sf-box h2{font-size:16px;margin:0 0 6px}.sf-h{font-size:11px;text-transform:uppercase;letter-spacing:.04em;opacity:.7;margin:14px 0 2px}
.sf-meta{color:#555;font-size:12px;margin:4px 0}.sf-row{border-top:1px solid #ddd;padding:8px 0}.sf-row.done{opacity:.6}
.sf-row p{margin:0 0 6px}.sf-btns{display:flex;flex-wrap:wrap;gap:6px}.sf-foot{display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-top:12px}
.sf-box button{font:inherit;padding:6px 10px;border-radius:6px;border:1px solid #888;background:#f4f4f4;color:#111;cursor:pointer}
.sf-box button.pri{background:#222;color:#fff;border-color:#222}.sf-box button:disabled{opacity:.5;cursor:default}
@media (prefers-color-scheme:dark){.sf-box{background:#1d1d20;color:#eee}.sf-row{border-color:#3a3a40}.sf-meta{color:#aaa}.sf-box button{background:#2a2a30;color:#eee;border-color:#555}.sf-box button.pri{background:#eee;color:#111;border-color:#eee}}
`));
  }

  /** The names that are neither built in (standard) nor installed (bundled, downloaded or own). Resolves an array of
   * { family, closest, pack, category }, pack being { id, name } or null when no listed pack has the family. */
  async function check(names, opts = {}) {
    await root.SlopFonts.ready();
    const standard = new Set(opts.standard || []), out = [], seen = new Set();
    for (const n of names || []) {
      if (!n || seen.has(n) || standard.has(n)) continue;
      seen.add(n);
      if (await C().hasFamily(n)) continue;
      out.push({ family: n, closest: closestOf(n, opts), pack: await C().packFor(n), category: C().guessCategory(n) });
    }
    return out;
  }

  /** Opens the Fonts panel. Resolves nothing; returns a handle { close(notify) } (notify false: no onClose).
   * opts: fonts (the names the document uses, listed first), standard (built-in names, never missing), title, note (text or
   * array), closeLabel, library (false hides the library list, Get more and the Download action on each missing row; the
   * person's own files and the closest font stay), closest ({ sans, serif, mono } families the app embeds; default the
   * catalogue's), addFile(file) (stores a dropped font in the app and resolves its family name; default the catalogue),
   * onUse({ family, use }) when the closest font is
   * chosen for a missing family, onAdd({ family, how, row }) when a font is installed: how 'library' or 'file'; row is the
   * missing family it answers (or undefined), onClose() when the person dismisses the panel. */
  function openPanel(opts = {}) {
    css();
    if (cur) cur.close(false);
    const names = [...new Set(opts.fonts || [])], standard = new Set(opts.standard || []);
    const answered = new Map();   // family -> { how, use }
    const footInput = el('input', { type: 'file', accept: '.ttf,.otf,.woff,.woff2', hidden: '' });
    const body = el('div', { role: 'status' }, el('p', { class: 'sf-meta' }, 'Loading…'));
    const box = el('div', { class: 'sf-box', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sfTitle' },
      el('h2', { id: 'sfTitle' }, opts.title || 'Fonts'), body);
    const host = el('div', { class: 'sf-ov', on: { click: (e) => { if (e.target === host) close(true); } } }, box);
    let closed = false, shown = false, gen = 0, unsub = null;
    const onKey = (e) => { if (e.key === 'Escape' && !doc.querySelector('.slop-lib-ov')) { e.stopPropagation(); close(true); } };
    const handle = { close: (notify = true) => close(notify) };
    function close(notify) {
      if (closed) return;
      closed = true;
      host.remove();
      doc.removeEventListener('keydown', onKey, true);
      if (unsub) unsub();
      if (cur === handle) cur = null;
      if (notify && opts.onClose) opts.onClose();
    }
    cur = handle;
    footInput.addEventListener('change', () => { if (footInput.files[0]) dropFile(null, footInput.files[0], null); footInput.value = ''; });

    /** A family that became installed: answers the rows it fills, then tells the app. */
    function installed(fam, how, row) {
      if (row) answered.set(row, { how, use: fam });
      if (opts.onAdd) opts.onAdd({ family: fam, how, row });
    }
    async function render() {
      const g = ++gen;
      await root.SlopFonts.ready();
      const all = new Map((await C().families()).map((f) => [f.name, f]));
      const rows = [];
      for (const n of names) rows.push({ n, info: all.get(n), pack: opts.library !== false && !standard.has(n) && !all.has(n) ? await C().packFor(n) : null });
      if (closed || g !== gen) return;
      const kids = [];
      for (const t of [].concat(opts.note || [])) kids.push(el('p', { class: 'sf-meta' }, t));
      if (names.length) { kids.push(el('div', { class: 'sf-h' }, 'This document')); for (const r of rows) kids.push(fontRow(r)); }
      if (opts.library !== false) {
        kids.push(el('div', { class: 'sf-h' }, 'Library'));
        for (const f of all.values()) if (!names.includes(f.name)) kids.push(el('div', { class: 'sf-row' }, el('p', null, f.name + ' · ' + sourceText(f))));
        if (!all.size) kids.push(el('p', { class: 'sf-meta' }, 'No fonts are installed.'));
      }
      kids.push(el('div', { class: 'sf-foot' },
        el('span', { class: 'sf-btns' },
          el('button', { type: 'button', on: { click: () => footInput.click() } }, 'Drop your own font…'),
          opts.library !== false ? el('button', { type: 'button', on: { click: () => openLibrary() } }, 'Get more…') : null,
          footInput),
        el('button', { type: 'button', class: 'pri', on: { click: () => close(true) } }, opts.closeLabel || 'Close')));
      body.replaceChildren(...kids);
      if (!shown) { shown = true; doc.body.append(host); doc.addEventListener('keydown', onKey, true); }
    }
    function sourceText(f) { return f.source === 'bundled' ? 'Bundled (offline)' : f.source === 'own' ? 'Your own file' : 'Downloaded'; }
    function describe(n, a) {
      if (a.how === 'library') return 'Installed from the library.';
      if (a.how === 'file') return a.use === n ? 'Installed from your file.' : `Using ${a.use} from your file.`;
      return `Using ${a.use} instead.`;
    }
    function fontRow({ n, info, pack }) {
      const a = answered.get(n), msg = el('p', { class: 'sf-meta', role: 'status' });
      const row = el('div', { class: 'sf-row' + (a ? ' done' : ''), 'data-family': n });
      if (standard.has(n)) { row.append(el('p', null, n + ' · Built in.')); return row; }
      if (a) { row.append(el('p', null, n + ' · ' + describe(n, a))); return row; }
      if (info) { row.append(el('p', null, n + ' · ' + sourceText(info) + '.')); return row; }
      const closest = closestOf(n, opts);
      const fileIn = el('input', { type: 'file', accept: '.ttf,.otf,.woff,.woff2', hidden: '' });
      fileIn.addEventListener('change', () => { if (fileIn.files[0]) dropFile(n, fileIn.files[0], msg); fileIn.value = ''; });
      const btns = [];
      if (pack) btns.push(el('button', { type: 'button', class: 'pri', 'data-how': 'library', on: { click: () => openLibrary(pack.id) } }, 'Download from the library'));
      btns.push(el('button', { type: 'button', 'data-how': 'file', on: { click: () => fileIn.click() } }, 'Drop your own font…'));
      btns.push(el('button', { type: 'button', 'data-how': 'closest', on: { click: () => useClosest(n, closest) } }, `Use the closest font instead (${closest})`));
      row.addEventListener('dragover', (e) => e.preventDefault());
      row.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) dropFile(n, e.dataTransfer.files[0], msg); });
      const why = pack || opts.library === false ? null : el('p', { class: 'sf-meta' }, `${n} is not in the font library, so it cannot be downloaded here.`);
      row.append(el('p', null, `${n} · Missing. It is not installed.`), why,
        el('div', { class: 'sf-btns' }, ...btns), fileIn, msg);
      return row;
    }
    /** Opens the library (Get more) on one pack's confirmation, or the list. Nothing downloads until the person confirms there. */
    async function openLibrary(packId) {
      await root.SlopFonts.ready();
      if (L()) L().open(packId ? { packId } : {});
    }
    /** Stores a font file the person owns and answers the row it was dropped on (if any). */
    async function dropFile(n, file, msg) {
      if (closed) return;
      if (msg) msg.textContent = 'Checking ' + file.name + '…';
      try {
        const fam = opts.addFile ? await opts.addFile(file) : (await C().addUserFile(file)).family;
        if (closed) return;
        installed(fam, 'file', n || undefined);
        await render();
      } catch (e) { if (msg) msg.textContent = e.message; else if (!closed) body.prepend(el('p', { class: 'sf-meta', role: 'status' }, e.message)); }
    }
    function useClosest(n, use) {
      answered.set(n, { how: 'closest', use });
      if (opts.onUse) opts.onUse({ family: n, use });
      render();
    }
    /** A pack from the library is installed or removed: its families answer the rows they fill. */
    async function libChanged(p) {
      if (closed) return;
      if (p && p.kind !== 'model') for (const fam of [...new Set(p.files.map((f) => f.family))]) installed(fam, 'library', names.includes(fam) ? fam : undefined);
      await render();
    }
    root.SlopFonts.ready().then(() => {
      if (closed || !L()) return;
      unsub = L().onChange(libChanged);
      render();
    });
    return handle;
  }

  /** Opens the panel the first time a document is checked and one of its families is missing. Returns the panel's handle, or
   * null when the document was asked about before or nothing is missing. */
  async function askOnce(docObj, names, opts = {}) {
    if (!docObj || typeof docObj !== 'object') throw new Error('askOnce needs the document object');
    if (asked.has(docObj)) return null;
    asked.add(docObj);
    const missing = await check(names, opts);
    if (!missing.length) return null;
    return openPanel({ ...opts, fonts: names });
  }

  Object.assign(root.SlopFonts, { openPanel, check, askOnce });
})(typeof window !== 'undefined' ? window : globalThis);
