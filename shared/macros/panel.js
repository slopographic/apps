/* SlopMacrosPanel: the Macros panel, the recording bar and the Macros ▾ button, for any app that runs SlopMacros
 * (macros.js). Built from the shared pieces: the record list (SlopList, shared/ui/list.js) with each macro's menu, SlopUI
 * prompts and confirms, SlopMenuButton for the header button, and SlopSheet on phones (the panel is a bottom sheet there;
 * on a wide screen it floats at the bottom right and does not block the app, so the app can be used while recording).
 * Classic script; loads list.js, menubutton.js, sheet.js and macros.css from shared/ when the page has not.
 *   open(api) close() toggle(api) bar(api) (the recording bar) button(api, el) (the Macros ▾ menu on a button) */
(function (g) {
  'use strict';
  if (g.SlopMacrosPanel) return;
  const SCRIPT = document.currentScript;
  const BASE = SCRIPT && SCRIPT.src ? new URL('./', SCRIPT.src).href : (g.SlopMacros && g.SlopMacros.base) || '';
  const el = (tag, attrs, ...kids) => g.SlopUI.el(tag, attrs, ...kids);
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const when = (t) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const script = (rel, ready) => (ready() ? Promise.resolve() : new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = new URL(rel, BASE).href; s.async = false; s.onload = res; s.onerror = rej; document.head.append(s);
  }));
  const css = (rel) => { const href = new URL(rel, BASE).href; if (![...document.querySelectorAll('link[rel=stylesheet]')].some((l) => l.href === href)) document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href })); };
  let partsP = null;
  const parts = () => (partsP = partsP || (css('macros.css'), css('../ui/list.css'),
    Promise.all([script('../ui/list.js', () => !!g.SlopList), script('../ui/menubutton.js', () => !!g.SlopMenuButton), script('../ui/sheet.js', () => !!g.SlopSheet)])));

  let P = null;   // the panel, once built: { root, box, list, sheet, off, api, sel }
  function build(api) {
    const box = el('section', { class: 'smac', id: 'smac-panel', role: 'region', 'aria-label': 'Macros', hidden: true });
    const record = el('button', { type: 'button', class: 'sui-btn smac-rec-btn', id: 'smac-record' }, el('span', { class: 'smac-dot', 'aria-hidden': 'true' }), 'Record');
    const stop = el('button', { type: 'button', class: 'sui-btn', id: 'smac-stop' }, 'Stop and save');
    const play = el('button', { type: 'button', class: 'sui-btn sui-primary', id: 'smac-play' }, 'Play');
    const more = el('div', { class: 'smac-more' },
      el('button', { type: 'button', class: 'sui-btn', id: 'smac-import' }, 'Import…'),
      el('button', { type: 'button', class: 'sui-btn', id: 'smac-export' }, 'Export all'));
    const steps = el('ol', { class: 'smac-steps', 'aria-label': 'Recorded steps' });
    const live = el('div', { class: 'smac-live', hidden: true }, el('p', { class: 'smac-hint', role: 'status', id: 'smac-count' }), steps,
      el('button', { type: 'button', class: 'sui-btn', id: 'smac-cancel' }, 'Cancel recording'));
    const hint = el('p', { class: 'smac-hint' }, `A macro repeats steps you did in ${api.label}: menus, filters and commands, with their settings. Brush strokes and hand-drawn selections are not recorded. Add a macro to a workflow to run it on many files.`);
    const listHost = el('div', { class: 'smac-list' });
    box.append(el('h2', { class: 'smac-title' }, 'Macros'), el('div', { class: 'smac-controls' }, record, stop, play), live, listHost, hint, more);
    const root = el('div', { class: 'smac-root' }, box);
    document.body.append(root);

    const p = { root, box, api, sel: null };
    p.list = g.SlopList.mount(listHost, { label: 'Saved macros', noun: ['macro', 'macros'], empty: 'No macros yet. Press Record, do the steps, then Stop and save.',
      row: (m) => ({ title: m.name, amount: plural(m.steps.length, 'step'), selected: p.sel === m.id, meta: [m.steps.slice(0, 4).map((s) => s.title).join(' → ') + (m.steps.length > 4 ? ' …' : ''), when(m.modified)] }),
      open: (m) => { p.sel = m.id; draw(); },
      menu: (m) => [
        { label: 'Play', act: () => api.play(m.id).catch(() => {}) },
        { label: 'Add to a workflow…', act: () => api.addToWorkflow(m.id) },
        { label: 'Rename…', act: () => api.rename(m.id) },
        { label: 'Export', act: () => api.exportFile([m.id]) },
        '-',
        { label: 'Delete…', act: () => api.remove(m.id) },
      ] });
    record.addEventListener('click', () => api.record());
    stop.addEventListener('click', () => api.stop());
    play.addEventListener('click', () => { const m = api.get(p.sel) || api.list()[0]; if (m) api.play(m.id).catch(() => {}); });
    live.querySelector('#smac-cancel').addEventListener('click', () => api.cancel());
    more.querySelector('#smac-import').addEventListener('click', () => api.importFile());
    more.querySelector('#smac-export').addEventListener('click', () => api.exportFile());
    // the row's own buttons for the selected macro: the list's menu is right-click or the Menu key; a tap needs these
    p.actions = el('div', { class: 'smac-actions', hidden: true },
      ...[['Add to a workflow…', (id) => api.addToWorkflow(id)], ['Rename…', (id) => api.rename(id)], ['Export', (id) => api.exportFile([id])], ['Delete…', (id) => api.remove(id)]]
        .map(([t, fn]) => { const b = el('button', { type: 'button', class: 'sui-btn' }, t); b.addEventListener('click', () => { if (p.sel) fn(p.sel); }); return b; }));
    listHost.after(p.actions);
    p.sheet = g.SlopSheet.attach({ root, panel: box, side: 'bottom', phone: '(max-width: 640px)', label: 'Macros', closeWide: () => close(), onChange: () => mark() });
    p.off = api.on(() => draw());
    p.els = { record, stop, play, live, steps };
    return p;
  }

  function draw() {
    if (!P) return;
    const { api, els } = P, rec = api.recording, list = api.list(), steps = api.steps() || [];
    if (P.sel && !api.get(P.sel)) P.sel = null;
    els.record.disabled = rec; els.stop.disabled = !rec; els.play.disabled = rec || !list.length;
    els.play.textContent = P.sel && api.get(P.sel) ? `Play “${api.get(P.sel).name}”` : 'Play';
    els.live.hidden = !rec;
    P.box.classList.toggle('is-recording', rec);
    if (rec) {
      P.box.querySelector('#smac-count').textContent = steps.length ? `Recording: ${plural(steps.length, 'step')}` : 'Recording. Do the first step…';
      els.steps.replaceChildren(...steps.map((s, i) => {
        const x = el('button', { type: 'button', class: 'smac-x', 'aria-label': `Leave out step ${i + 1}, ${s.title}`, title: 'Leave out this step' }, '×');
        x.addEventListener('click', () => api.removeStep(i));
        return el('li', null, el('span', null, s.title), x);
      }));
    }
    P.list.set(list);
    P.actions.hidden = !P.sel || rec;
  }

  async function open(api) {
    await parts();
    if (!P) P = build(api);
    P.box.hidden = false;
    P.root.classList.add('smac-shown');
    if (P.sheet.isPhone()) P.sheet.open();
    mark(); draw();
    return P;
  }
  function close() { if (!P) return; if (P.sheet.isPhone()) P.sheet.close(); P.box.hidden = true; P.root.classList.remove('smac-shown'); mark(); }
  const isOpen = () => !!P && (P.sheet.isPhone() ? P.sheet.isOpen() : !P.box.hidden);
  /** The page knows when the panel is in sight (the recording bar steps aside then). */
  const mark = () => document.documentElement.classList.toggle('smac-open', isOpen());

  /* the recording bar: always in sight while recording, with Stop */
  let BAR = null;
  async function bar(api) {
    css('macros.css');
    if (!BAR) {
      const count = el('span', { class: 'smac-bar-n' });
      const stop = el('button', { type: 'button', class: 'sui-btn sui-primary' }, 'Stop and save');
      const cancel = el('button', { type: 'button', class: 'sui-btn' }, 'Cancel');
      BAR = el('div', { class: 'smac-bar', role: 'status', hidden: true }, el('span', { class: 'smac-dot', 'aria-hidden': 'true' }), count, stop, cancel);
      stop.addEventListener('click', () => api.stop()); cancel.addEventListener('click', () => api.cancel());
      document.body.append(BAR);
      const sync = () => { const s = api.steps(); BAR.hidden = !s; if (s) count.textContent = s.length ? `Recording · ${plural(s.length, 'step')}` : 'Recording a macro'; };
      api.on(sync);
      BAR.sync = sync;
    }
    BAR.sync();
    return BAR;
  }

  /** The Macros ▾ button: Record or Stop, each saved macro to play, Macros… */
  async function button(api, btn) {
    await parts();
    const items = () => {
      const out = [api.recording ? { value: 'stop', label: 'Stop recording and save' } : { value: 'record', label: 'Record a macro' }];
      if (api.recording) out.push({ value: 'cancel', label: 'Cancel recording' });
      const list = api.list();
      if (list.length && !api.recording) { out.push({ heading: 'Play' }); for (const m of list) out.push({ value: 'play:' + m.id, label: m.name, keywords: m.steps.map((s) => s.title) }); }
      out.push({ heading: ' ' }, { value: 'panel', label: 'Macros…' });
      return out;
    };
    return g.SlopMenuButton.attach(btn, { label: 'Macros', search: 'auto', items, onPick: (v) => {
      if (v === 'record') api.record(); else if (v === 'stop') api.stop(); else if (v === 'cancel') api.cancel();
      else if (v === 'panel') open(api); else if (v.startsWith('play:')) api.play(v.slice(5)).catch(() => {});
    } });
  }

  g.SlopMacrosPanel = { open, close, isOpen, toggle: (api) => (isOpen() ? close() : open(api)), bar, button, draw };
})(window);
