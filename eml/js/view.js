/* Slop EML: the page. Draws the open messages (tabs), the headers, the body (HTML in a sandboxed iframe, or plain text
 * escaped), the notices, the attachments and the warnings from EmlApp's state. Classic script; exposes window.EmlView.
 * The body iframe has sandbox without allow-scripts, and its document has the CSP from frame.js: nothing loads from the
 * network, and remote images stay blocked until the reader asks for the message's own (cid:) images. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const K = window.EmlCodec, M = window.EmlMime, F = window.EmlFrame;
  const V = (window.EmlView = {});

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  const size = (n) => (n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB');
  function fmtDate(raw) {
    const d = K.parseDate(raw);
    return d ? d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : raw;
  }

  /** The tabs: the pinned messages (a message opened on its own is pinned; a batch is in the list). */
  function drawTabs(all, cur) {
    const docs = all.filter((d) => d.pinned);
    const nav = $('em-tabs');
    nav.hidden = docs.length === 0;
    nav.replaceChildren();
    docs.forEach((d) => {
      const tab = el('div', 'em-tab' + (cur && cur.id === d.id ? ' em-on' : ''));
      const pick = el('button', 'em-tab-pick', d.summary.subject || d.name);
      pick.type = 'button';
      pick.title = d.name;
      pick.setAttribute('aria-current', cur && cur.id === d.id ? 'true' : 'false');
      pick.addEventListener('click', () => window.EmlApp.select(d.id));
      const x = el('button', 'em-tab-x', '×');
      x.type = 'button';
      x.setAttribute('aria-label', 'Close ' + d.name);
      x.addEventListener('click', () => window.EmlApp.close(d.id));
      tab.append(pick, x);
      nav.append(tab);
    });
  }

  function drawHead(doc) {
    const s = doc.summary;
    $('em-subject').textContent = s.subject || '(no subject)';
    const dl = $('em-head');
    dl.replaceChildren();
    [['From', s.from], ['To', s.to], ['Cc', s.cc], ['Bcc', s.bcc], ['Date', s.date ? fmtDate(s.date) : '']].forEach(([k, v]) => {
      if (!v) return;
      const row = el('div');
      const dd = el('dd', '', v);
      if (k === 'Date') dd.title = s.date;
      row.append(el('dt', '', k), dd);
      dl.append(row);
    });
  }

  /** The body: HTML in the sandboxed frame, or the plain text escaped in a block. */
  function drawBody(doc) {
    const m = doc.msg, body = $('em-body');
    const hasHtml = m.html != null, hasText = m.text != null;
    let view = doc.view;
    if (view === 'html' && !hasHtml) view = hasText ? 'text' : 'none';
    if (view === 'text' && !hasText) view = hasHtml ? 'html' : 'none';
    $('em-views').hidden = !(hasHtml && hasText);
    $('em-v-html').setAttribute('aria-pressed', String(view === 'html'));
    $('em-v-text').setAttribute('aria-pressed', String(view === 'text'));

    const key = doc.id + ':' + view + ':' + !!doc.cids;
    if (body.dataset.key === key && body.firstChild) return;   // the same body: a tick or a sort does not reload the frame
    body.dataset.key = key;
    body.replaceChildren();
    if (view === 'html') {
      const f = document.createElement('iframe');
      f.className = 'em-frame';
      f.title = 'Message body';
      f.setAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox');
      f.setAttribute('referrerpolicy', 'no-referrer');
      f.srcdoc = F.preview(F.bodyHtml(m, doc.cids));
      body.append(f);
    } else if (view === 'text') {
      body.append(el('pre', 'em-plain', m.text));
    } else {
      body.append(el('p', 'em-none', 'This message has no body.'));
    }

    notices(doc, m, view, hasHtml);
  }
  function notices(doc, m, view, hasHtml) {
    const remote = hasHtml && view === 'html' ? M.remoteRefs(m.html) : 0;
    const cids = hasHtml && view === 'html' ? M.cidRefs(m.html) : 0;
    $('em-notice').hidden = !(remote || cids);
    $('em-notice-t').textContent = remote
      ? 'Remote images are blocked. This app loads nothing from the network.'
      : 'This message has embedded images. They are not shown until you choose to.';
    $('em-cid').hidden = !cids;
    $('em-cid').textContent = doc.cids ? 'Hide embedded images' : 'Show embedded images';
    $('em-cid').setAttribute('aria-pressed', String(!!doc.cids));
  }

  /** The chip under the headers: how many attachments; it shows them in the side panel. */
  function drawChip(doc) {
    const n = doc.msg.attachments.length, chip = $('em-atts-chip');
    chip.hidden = n === 0;
    chip.textContent = n + (n === 1 ? ' attachment' : ' attachments');
  }

  function drawWarn(doc) {
    const w = doc.msg.warnings;
    $('em-warn').hidden = w.length === 0;
    const list = $('em-warn-list');
    list.replaceChildren(...w.map((t) => el('li', '', t)));
  }

  /** Saves the decoded bytes of one attachment. */
  V.saveAttachment = function (doc, index) {
    const got = window.EmlApp.attachmentBlob(doc, index);
    if (got) window.SlopUI.download(got.blob, got.name);
  };

  /** Saves several attachments: one as it is, more in one ZIP. */
  V.downloadAtts = async function (doc, indexes) {
    const got = await window.EmlAttachments.packageOf(doc, indexes);
    if (got) window.SlopUI.download(got.blob, got.name);
  };
  V.downloadAll = function () {
    const doc = window.EmlApp.current();
    if (doc) V.downloadAtts(doc, doc.msg.attachments.map((_, i) => i));
  };

  /** Redraws the whole page from the app's state. */
  V.render = function () {
    const app = window.EmlApp;
    const docs = app.docs(), cur = app.current();
    drawTabs(docs, cur);
    if (V.frame) V.frame.setList(docs.length > 1);
    if (window.EmlList) window.EmlList.render();
    if (window.EmlSide) window.EmlSide.render();
    $('em-list-n').textContent = String(docs.length);
    $('em-empty').hidden = !!cur;
    $('em-msg').hidden = !cur;
    if (!cur) { $('em-body').dataset.key = ''; return; }
    drawHead(cur);
    drawBody(cur);
    drawChip(cur);
    drawWarn(cur);
  };
})();
