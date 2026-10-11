/* Slop AI — ui/builder: "Build a mini-app". The model writes one HTML file; it runs in a sandboxed iframe
 * (sandbox="allow-scripts", no same-origin, plus a CSP that blocks all network), you iterate by chatting, then save
 * it to Slop Drive or download it. */
'use strict';
(function (AI) {
  const K = AI.K, el = AI.el;
  let panel = null, frame = null, codeBox = null, mode = 'preview';
  const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:";

  /** The document the preview runs: the app's HTML with a CSP meta first, so it cannot load or send anything. */
  AI.sandboxDoc = function (html) {
    const meta = `<meta http-equiv="Content-Security-Policy" content="${CSP}">`;
    const s = String(html || '');
    if (/<head[^>]*>/i.test(s)) return s.replace(/<head[^>]*>/i, (m) => m + meta);
    if (/<html[^>]*>/i.test(s)) return s.replace(/<html[^>]*>/i, (m) => m + '<head>' + meta + '</head>');
    return meta + s;
  };
  AI.SANDBOX = 'allow-scripts';
  /** The last complete HTML file in a reply (```html fences, or an unlabelled block that looks like HTML). */
  AI.extractHtml = function (text) {
    const blocks = K.md.codeBlocks(String(text || '')).filter((b) => b.closed && (b.lang === 'html' || b.lang === 'htm' || /^\s*<(!doctype|html|body|div|canvas|style|script)/i.test(b.code)));
    return blocks.length ? blocks[blocks.length - 1].code : null;
  };

  function show() {
    const c = panel && panel.conv, html = c && c.html;
    AI.$('buildEmpty').hidden = !!html;
    frame.hidden = !html || mode !== 'preview'; codeBox.hidden = !html || mode !== 'code';
    if (html && mode === 'preview') frame.srcdoc = AI.sandboxDoc(html);
    if (html && mode === 'code') codeBox.textContent = html;
    for (const b of document.querySelectorAll('#buildModes button')) b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
    for (const id of ['btnBuildSave', 'btnBuildDl', 'btnBuildReload']) AI.$(id).disabled = !html;
    AI.$('buildTitle').textContent = c ? c.title : 'New mini-app';
  }
  const fileName = () => AI.slug(panel.conv && panel.conv.title || 'mini-app') + '.html';
  const blob = () => new Blob([panel.conv.html], { type: 'text/html' });

  function onDone(c, msg) {
    const html = msg && AI.extractHtml(msg.content);
    if (html) { c.html = html; show(); } else if (msg && !msg.error) AI.toast('No complete HTML file in that reply. Ask again, or say “send the whole file”.');
  }

  async function startFrom(tpl) {
    const c = AI.db.blank('build', { title: tpl.name });
    c.messages.push({ role: 'user', content: tpl.prompt, display: tpl.prompt, time: Date.now() },
      { role: 'assistant', content: '```html\n' + tpl.html + '\n```\n\nStarter template. Tell me what to change.', time: Date.now(), template: tpl.id });
    c.html = tpl.html;
    await AI.db.put(c);
    panel.setConv(c); show();
  }
  AI.openBuild = async function (id) { const c = await AI.db.get(id); if (c) { panel.setConv(c); show(); } };
  AI.newBuild = function () { panel.setConv(null); show(); panel.input.focus(); };
  AI.openInBuilder = async function (html) {
    const c = AI.db.blank('build', { title: 'Mini-app from chat' });
    c.messages.push({ role: 'assistant', content: '```html\n' + html + '\n```', time: Date.now() });
    c.html = html;
    await AI.db.put(c);
    AI.setTab('build'); panel.setConv(c); mode = 'preview'; show();
  };

  async function buildsMenu(e) {
    const r = e.currentTarget.getBoundingClientRect(), list = await AI.db.list('build');
    window.SlopUI.menu([{ label: 'New mini-app', act: AI.newBuild }, '-',
      ...(list.length ? list.slice(0, 20).map((c) => ({ label: c.title + ' · ' + AI.fmtTime(c.updated), check: panel.conv && panel.conv.id === c.id, act: () => AI.openBuild(c.id) })) : [{ label: 'No mini-apps yet', disabled: true }]),
      ...(panel.conv && panel.conv.messages.length ? ['-', { label: 'Rename…', act: async () => { const t = await window.SlopUI.prompt('Rename', 'Title', panel.conv.title); if (t) { panel.conv.title = t; await AI.db.put(panel.conv); show(); } } },
        { label: 'Delete…', act: async () => { if (await window.SlopUI.confirm('Delete this mini-app?', 'Its chat and code are removed.', 'Delete', { danger: true })) { await AI.db.remove(panel.conv.id); AI.newBuild(); } } }] : []),
    ], r.left, r.bottom + 4);
  }

  function empty() {
    return el('div', { class: 'empty build-hello' }, el('b', null, 'Build a mini-app'),
      el('p', null, 'Describe an app, game or page. The model writes one HTML file and it runs right here, sandboxed. Or start from a template:'),
      el('div', { class: 'starters' }, AI.TEMPLATES.map((t) => el('button', { type: 'button', class: 'btn', 'data-tpl': t.id, onclick: () => startFrom(t) }, el('b', null, t.name), el('small', { class: 'faint' }, t.blurb)))));
  }

  AI.initBuilder = function () {
    const v = AI.$('view-build');
    const left = el('div', { class: 'build-chat' }, el('div', { class: 'chat-bar' },
      el('button', { type: 'button', class: 'btn sm', id: 'btnBuilds', onclick: buildsMenu }, AI.icon('build'), el('span', { id: 'buildTitle' }, 'New mini-app'), '▾'),
      el('div', { class: 'tpl-row' }, AI.TEMPLATES.map((t) => el('button', { type: 'button', class: 'btn sm', title: 'Start from the ' + t.name + ' template', onclick: () => startFrom(t) }, t.name))),
      el('button', { type: 'button', class: 'btn sm only-mobile', id: 'btnShowPreview', onclick: () => document.body.classList.toggle('show-preview') }, 'Preview')));
    frame = el('iframe', { class: 'preview', id: 'preview', title: 'Mini-app preview (sandboxed)', sandbox: AI.SANDBOX, referrerpolicy: 'no-referrer', allow: '' });
    codeBox = el('pre', { class: 'code-view', id: 'codeView' });
    const right = el('div', { class: 'build-preview' },
      el('div', { class: 'chat-bar' },
        el('button', { type: 'button', class: 'btn sm only-mobile', onclick: () => document.body.classList.remove('show-preview') }, '← Chat'),
        el('div', { class: 'seg', id: 'buildModes', role: 'group', 'aria-label': 'Preview or code' }, [['preview', 'Preview'], ['code', 'Code']].map(([m, l]) => el('button', { type: 'button', 'data-mode': m, onclick: () => { mode = m; show(); } }, l))),
        el('span', { class: 'faint sandbox-note', title: 'sandbox="allow-scripts", no same-origin, no network' }, '🔒 sandboxed'),
        el('div', { class: 'grow' }),
        el('button', { type: 'button', class: 'tb', id: 'btnBuildReload', title: 'Restart the app', 'aria-label': 'Restart the app', onclick: show }, AI.icon('redo')),
        el('button', { type: 'button', class: 'tb', id: 'btnBuildSave', title: 'Save to Slop Drive', 'aria-label': 'Save to Slop Drive', onclick: () => window.SlopHub.saveToDrive(blob(), fileName(), { from: 'ai' }) }, AI.icon('drive')),
        el('button', { type: 'button', class: 'tb', id: 'btnBuildDl', title: 'Download .html', 'aria-label': 'Download', onclick: () => window.SlopUI.download(blob(), fileName()) }, AI.icon('download'))),
      el('div', { class: 'stage' }, el('div', { class: 'empty', id: 'buildEmpty' }, el('b', null, 'Nothing to preview yet'), el('p', null, 'The app appears here as soon as the model sends a complete HTML file.')), frame, codeBox));
    v.append(left, right);
    panel = AI.builder = new AI.ChatPanel(left, { kind: 'build', placeholder: 'Describe your app, or what to change', empty, onDone, onCreate: show });
    panel.setConv(null); show();
  };
})(window.AI);
