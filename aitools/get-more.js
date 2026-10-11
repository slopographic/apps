/* Slop AI Tools: "Get more" for one model. Opening the dialog fetches nothing. It shows what the model is, its
 * licence (name and link), where it comes from and how big it is. Only the Download button starts a download, and
 * the file is checked (length and SHA-256) before it is stored (models.js). Classic script; exposes window.SlopAIGetMore.
 * Used by the hub and by every tool page. */
(function (root) {
  'use strict';
  const doc = root.document, R = root.SlopAIModels, M = root.SlopAIManager;
  let host = null, onDone = null;

  /** Creates an element; children are nodes or text (never HTML). */
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
  const hostOf = (url) => { try { return new URL(url).hostname; } catch (e) { return 'this site'; } };

  /** Opens the dialog for one model. opts.onInstalled(id) runs after the model is stored. */
  function open(modelId, opts = {}) {
    const m = R.byId(modelId);
    if (!m) return null;
    close();
    onDone = opts.onInstalled || null;
    const remote = R.remoteFiles(m), bytes = R.downloadBytes(m);
    const hosts = [...new Set(remote.map((f) => hostOf(f.url)))].join(', ');
    const status = el('p', { class: 'ai-err', role: 'status' });
    const body = el('div', null,
      el('p', { class: 'ai-meta' }, m.arch),
      el('p', null, el('strong', null, 'Licence: '), R.LICENCES[m.licence] + ' (' + m.licence + '). ',
        el('a', { href: m.upstream, target: '_blank', rel: 'noopener' }, 'Upstream project')),
      el('p', { class: 'ai-meta' }, m.sourceNote),
      el('p', { class: 'ai-meta' }, 'Source: ' + (remote.length ? hosts : 'bundled with this site') + '.'),
      el('p', { class: 'ai-meta' }, remote.length ? `Download: ${R.formatSize(bytes)} in ${remote.length} ${remote.length === 1 ? 'file' : 'files'}. Each file is checked against its SHA-256 before it is stored on this device.` : 'Nothing to download. The model ships with the site.'),
      status);
    const cancel = el('button', { type: 'button', on: { click: close } }, 'Cancel');
    const go = el('button', { type: 'button', class: 'ai-pri', on: { click: remote.length ? () => run(m, go, cancel, status) : close } }, remote.length ? `Download ${R.formatSize(bytes)}` : 'Close');
    host = el('div', { class: 'ai-ov', on: { click: (e) => { if (e.target === host) close(); } } },
      el('div', { class: 'ai-dlg', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'aiGetTitle' },
        el('header', null, el('h2', { id: 'aiGetTitle' }, 'Get ' + m.name), el('button', { type: 'button', on: { click: close } }, 'Close')),
        el('div', { class: 'ai-body' }, body),
        el('footer', null, cancel, go)));
    doc.body.append(host);
    doc.addEventListener('keydown', onKey, true);
    go.focus();
    return { close };
  }
  function onKey(e) { if (e.key === 'Escape' && host) { e.stopPropagation(); close(); } }
  function close() {
    doc.removeEventListener('keydown', onKey, true);
    if (host) host.remove();
    host = null; onDone = null;
  }

  /** Downloads and stores the model. Any failure stores nothing and leaves the dialog open with the reason. */
  async function run(m, go, cancel, status) {
    go.disabled = true; cancel.disabled = true;
    try {
      await M.install(m.id, (p) => { status.textContent = `Downloading ${p.file} (${p.index} of ${p.count})…`; });
    } catch (e) {
      status.textContent = 'Not installed: ' + e.message + '. Nothing was stored.';
      go.disabled = false; cancel.disabled = false;
      return;
    }
    const cb = onDone;
    close();
    if (cb) cb(m.id);
  }

  root.SlopAIGetMore = { open, close };
})(typeof window !== 'undefined' ? window : globalThis);
