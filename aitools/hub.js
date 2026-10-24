/* Slop AI Tools hub: lists the five tools with their status (ready, needs download, not supported on this device)
 * and the model index with licence, size, source and status. Nothing is downloaded here: "Get more" opens the
 * licence dialog (get-more.js) and only its Download button fetches. Classic script, page: aitools/index.html.
 * ?tool=<id> (from a task page) goes straight to that tool's page. */
(function () {
  'use strict';
  const doc = document, R = window.SlopAIModels, M = window.SlopAIManager, S = window.SlopAISupport;
  const $ = (id) => doc.getElementById(id);
  const LABEL = { ready: 'Ready', 'needs-download': 'Needs download', unsupported: 'Not supported on this device' };

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
  /** Pure: the page of the tool a task page's link names (?tool=portrait gives 'portrait/'), or null for an unknown one. */
  function toolPage(search) {
    const id = new URLSearchParams(search || '').get('tool'), t = R.TOOLS.find((x) => x.id === id);
    return t ? t.page : null;
  }
  const go = toolPage(location.search);
  if (go) { location.replace(go); return; }   // straight to the tool; the hub is not drawn
  const pill = (state) => el('span', { class: 'ai-pill ai-' + state }, LABEL[state]);

  /** Status of one tool: { state, reason, missing } from the device check and its models. */
  async function toolState(tool) {
    const sup = S.check(tool.id);
    if (!sup.ok) return { state: 'unsupported', reason: sup.reason };
    const missing = [];
    for (const id of tool.models) if ((await M.status(id)) === 'needs-download') missing.push(R.byId(id));
    return missing.length ? { state: 'needs-download', missing } : { state: 'ready' };
  }

  async function renderTools() {
    const box = $('toolList');
    box.replaceChildren();
    for (const t of R.TOOLS) {
      const st = await toolState(t);
      const extra = st.state === 'unsupported' ? el('p', { class: 'ai-meta' }, st.reason)
        : st.state === 'needs-download' ? el('p', { class: 'ai-meta' }, 'Needs ' + st.missing.map((m) => m.name).join(', ') + '. Downloads start only when you press Get more.')
        : null;
      const open = st.state === 'unsupported' ? null : el('a', { class: 'ai-btn ai-pri', href: t.page }, st.state === 'ready' ? 'Open' : 'Open and get the model');
      box.append(el('article', { class: 'ai-card' },
        el('div', { class: 'ai-row' }, el('h3', null, t.name), pill(st.state)),
        el('p', null, t.blurb), extra, open));
    }
  }

  async function renderModels() {
    const box = $('modelList');
    box.replaceChildren();
    const rows = await M.list();
    for (const { model: m, status, installedAt } of rows) {
      const remote = R.remoteFiles(m);
      const action = status === 'bundled' ? el('span', { class: 'ai-meta' }, 'Ships with the site')
        : status === 'installed' || status === 'update' ? el('span', null, el('span', { class: 'ai-meta' }, 'Installed ' + installedAt.slice(0, 10) + '. '), el('button', { type: 'button', on: { click: () => removeModel(m) } }, 'Remove'))
        : el('button', { type: 'button', class: 'ai-pri', on: { click: () => window.SlopAIGetMore.open(m.id, { onInstalled: refresh }) } }, 'Get more…');
      box.append(el('div', { class: 'ai-model' },
        el('div', null, el('strong', null, m.name), el('div', { class: 'ai-meta' }, R.LICENCES[m.licence] + ' (' + m.licence + ') · ' + (remote.length ? R.formatSize(R.downloadBytes(m)) : 'bundled')),
          el('div', { class: 'ai-meta' }, 'From ' + m.source.replace(/^https:\/\//, '') + ' · used by ' + R.TOOLS.filter((t) => t.models.includes(m.id)).map((t) => t.name).join(', '))),
        el('div', { class: 'ai-act' }, pill(status === 'needs-download' ? 'needs-download' : 'ready'), action)));
    }
    const sup = $('storeNote');
    sup.textContent = (await M.available()) ? 'Models are stored on this device in IndexedDB. Clear site data to remove them all.' : 'Storage is unavailable here, so downloaded models cannot be kept.';
  }

  async function removeModel(m) {
    if (!window.confirm(`Remove ${m.name} from this device? You can download it again later.`)) return;
    try { await M.remove(m.id); } catch (e) { $('status').textContent = 'Could not remove ' + m.name + ': ' + e.message; return; }
    refresh();
  }

  async function refresh() { await renderTools(); await renderModels(); }

  refresh();
  window.SlopAIHub = { refresh, toolState, toolPage };
})();
