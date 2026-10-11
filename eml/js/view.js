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

  function drawTabs(docs, cur) {
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

  function drawAtts(doc) {
    const list = $('em-atts-list');
    const atts = doc.msg.attachments;
    $('em-atts').hidden = atts.length === 0;
    $('em-atts-count').textContent = String(atts.length);
    list.replaceChildren();
    atts.forEach((a, i) => {
      const li = el('li', 'em-att');
      const info = el('div', 'em-att-info');
      info.append(el('span', 'em-att-name', a.name));
      const meta = [a.type, size(a.size)];
      if (a.inline) meta.push('inline');
      if (a.malformed) meta.push('could not be read in full');
      info.append(el('span', 'em-att-meta', meta.join(' · ')));
      const save = el('button', 'sui-btn em-att-save', 'Save');
      save.type = 'button';
      save.setAttribute('aria-label', 'Save ' + a.name);
      save.addEventListener('click', () => V.saveAttachment(doc, i));
      li.append(info, save);
      list.append(li);
    });
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

  /** Redraws the whole page from the app's state. */
  V.render = function () {
    const app = window.EmlApp;
    const docs = app.docs(), cur = app.current();
    drawTabs(docs, cur);
    $('em-empty').hidden = !!cur;
    $('em-msg').hidden = !cur;
    if (!cur) return;
    drawHead(cur);
    drawBody(cur);
    drawAtts(cur);
    drawWarn(cur);
  };
})();
