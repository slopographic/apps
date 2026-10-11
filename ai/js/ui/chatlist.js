/* Slop AI — ui/chatlist: the Chat view: conversation sidebar (new, rename, delete, export, import), the chat bar
 * (title, persona, Control apps) and its ChatPanel. */
'use strict';
(function (AI) {
  const el = AI.el, E = AI.E;
  let panel = null, convs = [];

  function empty() {
    const ready = E.ready();
    return el('div', { class: 'empty hello' },
      el('canvas', { class: 'hello-sloppo', width: 192, height: 192, 'aria-hidden': 'true' }),
      el('b', null, ready ? 'Ask me anything' : 'Your own private AI'),
      el('p', null, ready ? 'Everything runs on this device. Try one of these:' : 'Pick a model to start. It downloads once and then runs offline on your GPU.'),
      ready ? el('div', { class: 'starters' }, ['Explain WebGPU like I am five', 'Write a haiku about slime', 'Give me 5 names for a pet blob', 'Open PhotoSLOP'].map((s) =>
        el('button', { type: 'button', class: 'btn sm', onclick: () => { if (/^Open /.test(s) && panel.conv) panel.conv.tools = true; else if (/^Open /.test(s)) AI.pendingTools = true; panel.send(s); } }, s)))
        : el('div', { class: 'starters' }, el('button', { type: 'button', class: 'btn primary', onclick: () => AI.setTab('models') }, 'Choose a model'), el('button', { type: 'button', class: 'btn', onclick: () => AI.setTab('sys') }, 'Can my PC run it?')));
  }

  async function refresh() {
    convs = await AI.db.list('chat');
    const list = AI.$('convList'); if (!list) return;
    list.textContent = '';
    if (!convs.length) list.append(el('div', { class: 'faint conv-empty' }, 'No chats yet.'));
    for (const c of convs) {
      list.append(el('div', { class: 'conv' + (panel.conv && panel.conv.id === c.id ? ' on' : ''), 'data-id': c.id, role: 'button', tabindex: 0,
        onclick: (e) => { if (!e.target.closest('.conv-more')) AI.openConv(c.id); },
        onkeydown: (e) => { if (e.key === 'Enter') AI.openConv(c.id); },
        oncontextmenu: (e) => { e.preventDefault(); convMenu(c, e.clientX, e.clientY); } },
      el('span', { class: 'conv-t' }, c.title), el('span', { class: 'faint conv-d' }, AI.fmtTime(c.updated)),
      el('button', { type: 'button', class: 'conv-more', 'aria-label': 'More for ' + c.title, onclick: (e) => { const r = e.currentTarget.getBoundingClientRect(); convMenu(c, r.left, r.bottom); } }, AI.icon('more'))));
    }
  }
  function convMenu(c, x, y) {
    window.SlopUI.menu([{ label: 'Rename…', act: () => AI.renameConv(c) }, { label: 'Export', sub: AI.exportItems(c) }, '-', { label: 'Delete…', act: () => AI.deleteConv(c) }], x, y);
  }

  AI.openConv = async function (id) {
    const c = await AI.db.get(id); if (!c) return;
    panel.setConv(c); bar(); refresh();
    if (AI.isMobile()) document.body.classList.remove('side-open');
  };
  AI.newChat = function () {
    if (AI.tab !== 'chat') AI.setTab('chat');
    const c = AI.db.blank('chat');
    if (AI.pendingTools) { c.tools = true; AI.pendingTools = false; }
    panel.setConv(c); bar(); refresh(); panel.input.focus();
    if (AI.isMobile()) document.body.classList.remove('side-open');
    return c;
  };
  AI.renameConv = async function (c) {
    c = c || panel.conv; if (!c) return;
    const t = await window.SlopUI.prompt('Rename chat', 'Title', c.title); if (!t) return;
    c.title = t.trim().slice(0, 80); await AI.db.put(c, { touch: false });
    if (panel.conv && panel.conv.id === c.id) { panel.conv.title = c.title; bar(); }
    refresh();
  };
  AI.deleteConv = async function (c) {
    c = c || panel.conv; if (!c) return;
    if (!(await window.SlopUI.confirm('Delete this chat?', `“${c.title}” will be gone for good.`, 'Delete', { danger: true }))) return;
    await AI.db.remove(c.id);
    if (panel.conv && panel.conv.id === c.id) AI.newChat(); else refresh();
  };
  AI.exportItems = function (c) {
    const get = () => c || panel.conv;
    const md = () => new Blob([AI.toMarkdown(get())], { type: 'text/markdown' }), js = () => new Blob([AI.toJSON(get())], { type: 'application/json' });
    const nm = (ext) => AI.slug(get().title) + ext;
    return [
      { label: 'Markdown to Slop Drive…', act: () => window.SlopHub.saveToDrive(md(), nm('.md'), { from: 'ai' }), disabled: !window.SlopHub },
      { label: 'JSON to Slop Drive…', act: () => window.SlopHub.saveToDrive(js(), nm('.json'), { from: 'ai' }), disabled: !window.SlopHub },
      { label: 'Download Markdown', act: () => window.SlopUI.download(md(), nm('.md')) },
      { label: 'Download JSON', act: () => window.SlopUI.download(js(), nm('.json')) },
    ];
  };
  AI.importConv = async function () {
    const files = await window.SlopUI.pickFiles({ accept: '.json,application/json' });
    const f = files && files[0]; if (!f) return;
    try { const c = AI.fromJSON(await f.text()); await AI.db.put(c, { touch: false }); AI.setTab(c.kind === 'build' ? 'build' : 'chat'); if (c.kind === 'build') AI.openBuild(c.id); else AI.openConv(c.id); AI.toast('Imported “' + c.title + '”'); }
    catch (e) { window.SlopUI.alert('Could not import', e.message); }
  };

  function bar() {
    const c = panel.conv, b = AI.$('chatBar'); if (!b) return;
    const persona = c ? (c.system && c.persona !== 'builder' ? 'Custom' : (AI.PERSONAS[c.persona] || AI.PERSONAS.helper).name) : AI.PERSONAS[AI.prefs.persona] ? AI.PERSONAS[AI.prefs.persona].name : 'Helpful assistant';
    b.replaceChildren(
      el('button', { type: 'button', class: 'tb only-mobile', 'aria-label': 'Chats', onclick: () => document.body.classList.toggle('side-open') }, AI.icon('menu')),
      el('button', { type: 'button', class: 'conv-title', id: 'convTitle', title: 'Rename', onclick: () => c && c.messages.length && AI.renameConv() }, c ? c.title : 'New chat'),
      el('button', { type: 'button', class: 'btn sm', id: 'btnPersona', title: 'Persona, temperature, max tokens', onclick: () => AI.settingsDialog(panel.conv || null, { onSave: bar }) }, AI.icon('gear'), el('span', null, persona)),
      el('button', { type: 'button', class: 'btn sm toggle', id: 'btnTools', 'aria-pressed': String(!!(c ? c.tools : AI.prefs.tools)), title: 'Let the model open apps and save to Slop Drive',
        onclick: async () => { const cv = panel.conv || (await panel.ensureConv()); cv.tools = !cv.tools; if (cv.messages.length) await AI.db.put(cv, { touch: false }); bar(); AI.toast(cv.tools ? 'Control apps is on: the model can open apps and save files' : 'Control apps is off'); } }, AI.icon('tool'), el('span', null, 'Control apps')),
      el('button', { type: 'button', class: 'tb', title: 'Export', 'aria-label': 'Export', disabled: !c || !c.messages.length, onclick: (e) => { const r = e.currentTarget.getBoundingClientRect(); window.SlopUI.menu(AI.exportItems(), r.right - 220, r.bottom + 4); } }, AI.icon('download')));
  }

  AI.initChat = function () {
    const v = AI.$('view-chat');
    const side = el('aside', { class: 'convs', id: 'convs', 'aria-label': 'Chats' },
      el('div', { class: 'convs-h' }, el('button', { type: 'button', class: 'btn primary new-chat', id: 'btnNewChat', onclick: () => AI.newChat() }, AI.icon('plus'), 'New chat')),
      el('div', { class: 'conv-list', id: 'convList' }));
    const main = el('div', { class: 'chat-main' }, el('div', { class: 'chat-bar', id: 'chatBar' }));
    v.append(side, el('div', { class: 'scrim', onclick: () => document.body.classList.remove('side-open') }), main);
    panel = AI.chat = new AI.ChatPanel(main, { kind: 'chat', empty, toolsFor: AI.toolsFor, onCreate: (c) => { if (AI.pendingTools) { c.tools = true; AI.pendingTools = false; } bar(); } });
    AI.on('convs', AI.debounce(refresh, 30));
    AI.on('engine', () => { if (panel.conv && !panel.conv.messages.length || !panel.conv) panel.render(); });
    panel.setConv(null); bar(); refresh();
  };
  AI.refreshChats = refresh;
})(window.AI);
