/* Slop EML: the attachment preview. EmlPreview.open(doc, index) shows one attachment in a modal (SlopUI.dialog) by its type:
 *   images (png, jpg, gif, webp, svg): an <img> with a data: URL, inside a sandboxed frame (no scripts, no network)
 *   pdf: a blob: URL in a sandboxed iframe (the viewer runs in an opaque origin, with no access to this page)
 *   html: the same sandboxed frame as the message body (EmlFrame.preview: no scripts, no network)
 *   text: escaped in a pre block (capped at TEXT_MAX bytes); csv and tsv too when there is no spreadsheet preview
 *   spreadsheets (xlsx, xls, csv, tsv, ods): window.SlopSheets.preview(container, file) when it exists, else a note
 *   anything else: the name, size and type only
 * Save works for every attachment. The dialog closes on Escape, on the close button and on Close, and keeps focus
 * inside. Classic script; exposes window.EmlPreview. */
(function () {
  'use strict';
  const P = (window.EmlPreview = {});
  const F = window.EmlFrame;
  const TEXT_MAX = 512 * 1024;
  const IMG = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' };
  const SHEET = ['xlsx', 'xls', 'csv', 'tsv', 'ods'];
  const TEXT = ['txt', 'md', 'log', 'json', 'xml', 'ics', 'vcf', 'yaml', 'yml'];
  const NOTE_SHEET = 'Spreadsheet preview is not available yet';

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  const size = (n) => (n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB');
  const extOf = (name) => { const m = /\.([^./\\]+)$/.exec(String(name || '')); return m ? m[1].toLowerCase() : ''; };

  /** The kind of preview an attachment gets: by its extension first, then by its type. */
  P.kindOf = function (a) {
    const e = extOf(a.name), t = String(a.type || '').toLowerCase();
    if (IMG[e]) return 'image';
    if (e === 'pdf' || t === 'application/pdf') return 'pdf';
    if (SHEET.includes(e)) return 'sheet';
    if (e === 'html' || e === 'htm' || t === 'text/html') return 'html';
    if (TEXT.includes(e) || t.startsWith('text/')) return 'text';
    return 'other';
  };

  const blobOf = (a, type) => new Blob([a.bytes], { type: type || a.type || 'application/octet-stream' });
  function dataUrl(a, type) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.readAsDataURL(blobOf(a, type));
    });
  }
  /** The text of the bytes (UTF-8, bad bytes replaced), at most `max` bytes. Returns { text, cut }. */
  function textOf(a, max) {
    const cut = max && a.bytes.length > max;
    const part = cut ? a.bytes.subarray(0, max) : a.bytes;
    return { text: new TextDecoder('utf-8').decode(part), cut: !!cut };
  }
  function frame(srcdoc, title, sandbox) {
    const f = el('iframe', 'em-prev-frame');
    f.title = title;
    f.setAttribute('sandbox', sandbox);
    f.setAttribute('referrerpolicy', 'no-referrer');
    f.srcdoc = srcdoc;
    return f;
  }

  /** Fills the body for one attachment. Object URLs made here go into `urls` (revoked on close). */
  function fill(slot, a, kind, urls) {
    const note = (t) => el('p', 'em-prev-note', t);
    const ext = extOf(a.name);
    if (kind === 'image') {
      dataUrl(a, IMG[ext]).then((u) => {
        const img = el('img', 'em-prev-img');
        img.alt = a.name;
        img.src = u;
        slot.replaceChildren(frame(F.preview(img.outerHTML), 'Preview of ' + a.name, ''));
      }, () => slot.replaceChildren(note('This image could not be shown.')));
    } else if (kind === 'pdf') {
      const u = URL.createObjectURL(blobOf(a, 'application/pdf'));
      urls.push(u);
      const f = el('iframe', 'em-prev-frame');
      f.title = 'Preview of ' + a.name;
      f.setAttribute('sandbox', 'allow-scripts');
      f.src = u;
      slot.append(f);
    } else if (kind === 'html') {
      const { text } = textOf(a, 0);
      slot.append(frame(F.preview(F.bodyHtml({ html: text }, false)), 'Preview of ' + a.name, 'allow-popups allow-popups-to-escape-sandbox'));
    } else if (kind === 'text' || (kind === 'sheet' && !window.SlopSheets && (ext === 'csv' || ext === 'tsv'))) {
      const { text, cut } = textOf(a, TEXT_MAX);
      if (kind === 'sheet') slot.append(note(NOTE_SHEET));
      slot.append(el('pre', 'em-plain em-prev-pre', text));
      if (cut) slot.append(note('Showing the first ' + size(TEXT_MAX) + ' of ' + size(a.bytes.length) + '. Save the file to see all of it.'));
    } else if (kind === 'sheet') {
      if (typeof window.SlopSheets.preview !== 'function') { slot.append(note(NOTE_SHEET)); return; }
      const box = el('div', 'em-prev-sheet');
      slot.append(box);
      Promise.resolve()
        .then(() => window.SlopSheets.preview(box, new File([a.bytes], a.name, { type: a.type || '' })))
        .catch(() => box.replaceChildren(note('This spreadsheet could not be shown.')));
    } else {
      slot.append(note('No preview for this type of file. Save it to open it.'));
    }
  }

  /** Opens the preview of attachment `index` of a doc. Returns the dialog ({ box, close }) or null. */
  P.open = function (doc, index) {
    const a = doc.msg.attachments[index];
    const ui = window.SlopUI;
    if (!a || !ui) return null;
    const kind = P.kindOf(a);
    const urls = [];
    const slot = el('div', 'em-prev-body');
    const meta = el('p', 'em-prev-meta', [a.name, a.type || 'no type', size(a.size)].join(' · '));
    const body = el('div', 'em-prev', meta, slot);
    fill(slot, a, kind, urls);

    const save = () => {
      const got = window.EmlApp.attachmentBlob(doc, index);
      if (got) ui.download(got.blob, got.name);
      return false; // the preview stays open
    };
    /* A click inside a sandboxed frame moves focus into it, and its keys (Escape, Tab) never reach this page. So when the
     * window loses focus to the frame, focus goes back to the Close button, where Escape and Tab work again. */
    let box = null;
    const onBlur = () => setTimeout(() => {
      const f = document.activeElement;
      if (box && f && f.tagName === 'IFRAME' && box.contains(f)) { const c = box.querySelector('.sui-primary'); if (c) c.focus({ preventScroll: true }); }
    }, 0);
    const onFocusIn = (e) => { if (box && !box.contains(e.target)) { const c = box.querySelector('.sui-primary'); if (c) c.focus({ preventScroll: true }); } };
    const d = ui.dialog({
      title: a.name,
      cls: 'em-prev-dlg',
      body: body,
      buttons: [{ label: 'Save', act: save }, { label: 'Close', primary: true }],
      onClose: () => {
        window.removeEventListener('blur', onBlur);
        document.removeEventListener('focusin', onFocusIn, true);
        urls.forEach((u) => URL.revokeObjectURL(u));
      },
    });
    box = d.box;
    window.addEventListener('blur', onBlur);
    document.addEventListener('focusin', onFocusIn, true);
    return d;
  };
})();
