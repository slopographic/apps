/* Slop AI — ui/models: the model picker. Catalog cards with size, GPU memory, licence, strengths, a recommended
 * badge from the system check, download with progress / pause / cancel, delete, disk usage and the default model. */
'use strict';
(function (AI) {
  const K = AI.K, E = AI.E, el = AI.el;
  const statuses = new Map();
  let lastKey = '';

  const all = () => [...K.catalog.list, ...K.models.locals().map((r) => K.catalog.custom(r.model_id, { name: r.model_id.slice(6) }))];
  AI.allModels = all;

  async function refreshStatus() {
    await Promise.all(all().map(async (m) => { statuses.set(m.id, await E.status(m.id).catch(() => ({ state: 'none', bytes: 0 }))); }));
  }

  function actions(m, st) {
    const loaded = E.model && E.model.id === m.id && E.engine && E.engine.loaded;
    const loading = E.state === 'loading' && E.loadingId === m.id, paused = E.state === 'paused' && E.loadingId === m.id;
    const v = AI.sys ? K.sysinfo.verdict(AI.sys, m) : null;
    const b = [];
    if (loading) b.push(el('button', { type: 'button', class: 'btn sm', 'data-act': 'pause', onclick: () => E.pause() }, AI.icon('pause'), 'Pause'), el('button', { type: 'button', class: 'btn sm', 'data-act': 'cancel', onclick: () => E.cancel() }, AI.icon('x'), 'Cancel'));
    else if (loaded) b.push(el('button', { type: 'button', class: 'btn sm primary', onclick: () => AI.setTab('chat') }, AI.icon('chat'), 'Chat'), el('button', { type: 'button', class: 'btn sm', onclick: () => E.unload() }, 'Unload'));
    else {
      const label = paused ? 'Resume' : st.state === 'ready' || m.custom ? 'Load' : st.state === 'partial' ? 'Resume download' : 'Download';
      b.push(el('button', { type: 'button', class: 'btn sm' + (v && v.level === 'no' ? '' : ' primary'), 'data-act': 'load', onclick: () => load(m, paused) }, AI.icon(st.state === 'ready' ? 'play' : 'download'), label));
      if (paused) b.push(el('button', { type: 'button', class: 'btn sm', 'data-act': 'cancel', onclick: () => E.cancel() }, AI.icon('x'), 'Cancel'));
    }
    const isDef = AI.prefs.defaultModel === m.id;
    b.push(el('button', { type: 'button', class: 'btn sm', 'data-act': 'default', 'aria-pressed': String(isDef), title: 'Load this model automatically when Slop AI opens', onclick: () => setDefault(m) }, AI.icon('star'), isDef ? 'Default' : 'Set default'));
    if (st.state !== 'none' && !loading) b.push(el('button', { type: 'button', class: 'btn sm danger', 'data-act': 'delete', onclick: () => del(m) }, AI.icon('trash'), 'Delete'));
    return el('div', { class: 'm-acts' }, b);
  }

  async function load(m, resume) {
    const v = AI.sys ? K.sysinfo.verdict(AI.sys, m) : null;
    if (v && v.level === 'no' && !E.isFake() && !(await window.SlopUI.confirm('This may not work', `${v.reason}. Try anyway?`, 'Try anyway'))) return;
    const ok = await E.load(m.id, { skipConsent: !!resume });
    if (ok) { AI.toast(m.name + ' is ready'); if (AI.prefs.defaultModel == null) setDefault(m, true); }
  }
  function setDefault(m, quiet) {
    AI.prefs.defaultModel = AI.prefs.defaultModel === m.id && !quiet ? null : m.id; AI.savePrefs();
    if (!quiet) AI.toast(AI.prefs.defaultModel ? m.name + ' loads when Slop AI opens' : 'No default model');
    render();
  }
  async function del(m) {
    const st = statuses.get(m.id) || {};
    if (!(await window.SlopUI.confirm('Delete ' + m.name + '?', `This removes ${st.bytes ? AI.fmtBytes(st.bytes) : 'its files'} from this browser. You can download it again later.`, 'Delete', { danger: true }))) return;
    await E.remove(m.id);
    if (AI.prefs.defaultModel === m.id) { AI.prefs.defaultModel = null; AI.savePrefs(); }
    await refreshStatus(); render();
  }

  function card(m, rec, recCode) {
    const st = statuses.get(m.id) || { state: 'none', bytes: 0 };
    const v = AI.sys ? K.sysinfo.verdict(AI.sys, m) : null;
    const loading = E.loadingId === m.id && (E.state === 'loading' || E.state === 'paused');
    const loaded = E.model && E.model.id === m.id && E.engine && E.engine.loaded;
    const failed = E.state === 'error' && E.loadingId === m.id;
    const stateText = failed ? 'Failed: ' + E.error : loaded ? 'Loaded and ready' : st.state === 'ready' ? `Downloaded · ${AI.fmtBytes(st.bytes)}` : st.state === 'partial' ? `Partly downloaded · ${AI.fmtBytes(st.bytes)}` : m.custom ? 'From a folder on this computer' : 'Not downloaded';
    return el('article', { class: 'mcard' + (loaded ? ' loaded' : '') + (AI.focusModel === m.id ? ' focus' : ''), 'data-id': m.id },
      el('div', { class: 'm-head' }, el('div', null, el('h3', null, m.name), el('div', { class: 'faint' }, [m.maker, m.params ? m.params + 'B parameters' : ''].filter(Boolean).join(' · '))),
        el('div', { class: 'm-badges' }, m.id === rec ? el('span', { class: 'badge rec' }, 'Recommended') : null, m.id === recCode ? el('span', { class: 'badge rec' }, 'Best for code') : null,
          AI.prefs.defaultModel === m.id ? el('span', { class: 'badge' }, '★ Default') : null, v ? el('span', { class: 'badge ' + v.level, title: v.reason || '' }, AI.verdictText(v)) : null)),
      el('p', { class: 'm-blurb' }, m.blurb),
      el('div', { class: 'm-tags' }, m.strengths.map((s) => el('span', { class: 'tag' }, s))),
      el('dl', { class: 'm-facts' },
        el('dt', null, 'Download'), el('dd', null, m.sizeMB ? '~' + AI.fmtMB(m.sizeMB) : '—'),
        el('dt', null, 'GPU memory'), el('dd', null, m.vramMB ? AI.fmtMB(v && v.vram || m.vramMB) : '—'),
        el('dt', null, 'Context'), el('dd', null, Math.round(m.ctx / 1024) + 'k tokens'),
        el('dt', null, 'Licence'), el('dd', null, m.license.url ? el('a', { href: m.license.url, target: '_blank', rel: 'noopener' }, m.license.name) : m.license.name)),
      el('div', { class: 'm-state' + (loading ? ' on' : '') + (failed ? ' bad' : '') }, el('span', { class: 'm-st' }, loading ? (E.state === 'paused' ? 'Paused at ' + Math.round(E.progress * 100) + '%' : E.text) : stateText),
        loading ? el('div', { class: 'pbar' }, el('i', { style: `width:${Math.round(E.progress * 100)}%` })) : null),
      el('div', { class: 'faint mono m-id' }, m.loadId || (AI.sys ? K.catalog.idFor(m, AI.sys) : m.id)),
      actions(m, st));
  }

  async function usage() {
    let total = 0; for (const s of statuses.values()) total += s.bytes || 0;
    const est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate().catch(() => ({})) : {};
    const box = AI.$('mUsage');
    if (box) box.textContent = `Models use ${AI.fmtBytes(total)} on this device` + (est.quota ? ` · ${AI.fmtBytes(est.quota - (est.usage || 0))} free for this site` : '');
  }

  async function importDisk() {
    let files = null;
    if (window.showDirectoryPicker) {
      try {
        const dir = await window.showDirectoryPicker({ id: 'slop-ai-model', mode: 'read' }); files = [];
        const walk = async (d, pre) => { for await (const [name, h] of d.entries()) { if (h.kind === 'file') files.push({ path: pre + name, file: await h.getFile() }); else await walk(h, pre + name + '/'); } };
        await walk(dir, dir.name + '/');
      } catch (e) { if (e.name === 'AbortError') return; files = null; }
    }
    if (!files) {
      files = await new Promise((res) => { const i = el('input', { type: 'file', webkitdirectory: true, multiple: true, style: 'position:fixed;left:-9999px' }); i.onchange = () => { res([...i.files]); i.remove(); }; document.body.append(i); i.click(); });
      if (!files || !files.length) return;
    }
    try { AI.toast('Importing the model folder…', 6000); const id = await K.models.importFolder(files); await refreshStatus(); render(); AI.toast('Imported ' + id.slice(6)); await E.load(id, { skipConsent: true }); }
    catch (e) { window.SlopUI.alert('Could not use this folder', e.message); }
  }

  async function render() {
    const v = AI.$('view-models'); if (!v || AI.tab !== 'models') return;
    lastKey = E.state + E.loadingId + (E.model && E.model.id);
    const rec = AI.recommended('chat'), recCode = AI.recommended('code');
    v.textContent = '';
    v.append(el('div', { class: 'page-in' },
      el('div', { class: 'page-head' }, el('div', null, el('h1', null, 'Models'), el('p', { class: 'lead' }, E.isFake() ? 'Demo engine: downloads are simulated and replies are canned. Switch to the real engine in the ⋯ menu.' : 'Each model downloads once from huggingface.co after you click Download, then runs offline on your GPU. Your chats never leave your device.'),
        el('p', { class: 'faint', id: 'mUsage' }, '…')),
      el('div', { class: 'head-acts' }, el('button', { type: 'button', class: 'btn', id: 'btnDisk', onclick: importDisk, disabled: E.isFake() }, AI.icon('folder'), 'Load from disk…'),
        !AI.sys ? el('button', { type: 'button', class: 'btn', onclick: () => AI.setTab('sys') }, 'Check my PC') : null)),
      el('div', { class: 'mgrid' }, all().map((m) => card(m, rec, recCode)))));
    const f = v.querySelector('.mcard.focus'); if (f) { f.scrollIntoView({ block: 'center' }); AI.focusModel = null; }
    usage();
  }
  /** Progress ticks patch the bar and text in place; state changes re-render. */
  function onEngine() {
    if (AI.tab !== 'models') return;
    const key = E.state + E.loadingId + (E.model && E.model.id);
    if (key === lastKey && E.state === 'loading') {
      const c = AI.$('view-models').querySelector(`.mcard[data-id="${CSS.escape(E.loadingId)}"]`);
      if (c) { const i = c.querySelector('.pbar i'); if (i) i.style.width = Math.round(E.progress * 100) + '%'; const t = c.querySelector('.m-st'); if (t) t.textContent = E.text; }
      return;
    }
    refreshStatus().then(render);
  }
  AI.renderModels = () => refreshStatus().then(render);
  AI.modelStatus = (id) => statuses.get(id);
  AI.importModelFolder = importDisk;
  AI.on('engine', onEngine);
  AI.on('sys', () => { if (AI.tab === 'models') render(); });
  AI.on('tab', ({ tab }) => { if (tab === 'models') AI.renderModels(); });
  /** Menu rows for a model card (the right-click menu): the same actions as its buttons. */
  AI.modelItems = function (id) {
    const m = all().find((x) => x.id === id);
    if (!m) return null;
    const st = statuses.get(m.id) || {};
    const loaded = E.model && E.model.id === m.id && E.engine && E.engine.loaded;
    const loading = E.state === 'loading' && E.loadingId === m.id, paused = E.state === 'paused' && E.loadingId === m.id;
    const out = [];
    if (loading) out.push({ label: 'Pause', act: () => E.pause() }, { label: 'Cancel', act: () => E.cancel() });
    else if (loaded) out.push({ label: 'Chat with this model', act: () => AI.setTab('chat') }, { label: 'Unload', act: () => E.unload() });
    else {
      const label = paused ? 'Resume' : st.state === 'ready' || m.custom ? 'Load' : st.state === 'partial' ? 'Resume download' : 'Download';
      out.push({ label, act: () => load(m, paused) });
      if (paused) out.push({ label: 'Cancel', act: () => E.cancel() });
    }
    const isDef = AI.prefs.defaultModel === m.id;
    out.push('-', { label: isDef ? 'Clear default' : 'Set as default', act: () => setDefault(m) });
    if (st.state !== 'none' && !loading) out.push({ label: 'Delete…', act: () => del(m) });
    return out;
  };
})(window.AI);
