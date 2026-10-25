/* SlopAIKit cloud pick: the searchable provider picker of "Use your own AI account" (connect.js), the provider's own
 * fields (endpoint id, account id, resource…), and the searchable model list with recently used models first. Classic
 * script; adds SlopAIKit.cloud.pick = { providers(select, { onPick }), fields(p, saved), models(select, p), remember(p, id),
 * recent(p) }.
 *   providers(select): a button naming the chosen provider; it opens a search box and the catalog's groups (Main open,
 *     the others collapsible), each row with badges (tools, vision, images) and "browser OK" / "needs a proxy". Rows the
 *     browser cannot use are greyed, say why, and cannot be chosen. Picking sets the (hidden) select and fires change,
 *     so the form keeps one value. Search covers names, aliases, the company and model names (providers.js search).
 *   fields(p, saved): { node, values(), missing() } inputs for the {fields} of p's address template.
 *   models(select, p): a search box over the model select when the list is long, and "Recently used" on top. */
(function () {
  'use strict';
  const K = (window.SlopAIKit = window.SlopAIKit || {});
  const C = K.cloud;
  const h = (tag, attrs, ...kids) => { const n = document.createElement(tag); for (const k in attrs || {}) { const v = attrs[k]; if (v == null || v === false) continue; if (k === 'class') n.className = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(c)); return n; };
  const CSS = `
.sap-pp-btn { display: flex; align-items: center; gap: 6px; width: 100%; min-height: 34px; padding: 4px 8px; border-radius: var(--p-radius); border: 1px solid var(--p-line); background: var(--p-input); color: var(--p-fg); font: 13px var(--p-font); text-align: start; cursor: pointer; }
.sap-pp-btn > b { flex: 1; min-width: 0; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sap-pp-btn::after { content: '▾'; color: var(--p-dim); }
.sap-pp { display: grid; gap: 6px; padding: 6px; border: 1px solid var(--p-line); border-radius: var(--p-radius); background: var(--p-bg); max-height: min(60vh, 460px); overflow: auto; }
.sap-pp[hidden], .sap-pp-row[hidden], .sap-pp-g[hidden], .sap-pp-none[hidden], .sap-cloud-model-q[hidden] { display: none; }
.sap-pp-q, .sap-cloud-model-q { height: 32px; padding: 0 8px; border-radius: var(--p-radius); border: 1px solid var(--p-line); background: var(--p-input); color: var(--p-fg); font: 13px var(--p-font); width: 100%; min-width: 0; }
.sap-pp-g > summary { cursor: pointer; font-size: 11px; letter-spacing: .05em; text-transform: uppercase; color: var(--p-dim); padding: 4px 2px; }
.sap-pp-row { display: grid; gap: 2px; width: 100%; padding: 6px 8px; border: 0; border-radius: 6px; background: none; color: var(--p-fg); font: 13px var(--p-font); text-align: start; cursor: pointer; }
.sap-pp-row:hover, .sap-pp-row:focus-visible { background: var(--p-bg2); outline: none; }
.sap-pp-row[aria-checked="true"] { background: color-mix(in srgb, var(--p-accent) 14%, transparent); }
.sap-pp-row.off { cursor: default; opacity: .55; }
.sap-pp-n { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.sap-pp-n > b { font-weight: 500; margin-inline-end: 2px; }
.sap-pp-b { font-size: 10.5px; line-height: 16px; padding: 0 5px; border-radius: 4px; border: 1px solid var(--p-line); color: var(--p-dim); white-space: nowrap; }
.sap-pp-b.ok { color: var(--p-fg); border-color: color-mix(in srgb, var(--p-accent) 50%, var(--p-line)); }
.sap-pp-b.no { color: #ff8a98; border-color: color-mix(in srgb, #ff8a98 45%, var(--p-line)); }
.sap-pp-d { font-size: 11.5px; color: var(--p-dim); }
.sap-pp-none { margin: 4px; color: var(--p-dim); font-size: 12px; }`;
  function style() {
    if (document.getElementById('sap-pp-style')) return;
    document.head.append(h('style', { id: 'sap-pp-style' }, CSS));
  }

  /** The small marks on a row: what it can do and whether this browser may call it. */
  function badges(p) {
    const out = [];
    if (p.caps.tools) out.push(h('span', { class: 'sap-pp-b', title: 'Can use the app’s tools' }, 'tools'));
    if (p.caps.vision) out.push(h('span', { class: 'sap-pp-b', title: 'Can look at pictures' }, 'vision'));
    if (p.caps.images || !p.chat) out.push(h('span', { class: 'sap-pp-b', title: 'Makes pictures' }, 'images'));
    if (p.cors === 'needs-proxy') out.push(h('span', { class: 'sap-pp-b no' }, 'needs a proxy'));
    else if (p.local) out.push(h('span', { class: 'sap-pp-b ok' }, 'on this computer'));
    else if (p.cors === 'verified') out.push(h('span', { class: 'sap-pp-b ok', title: 'Checked: this provider accepts requests from web pages' }, 'browser OK'));
    else out.push(h('span', { class: 'sap-pp-b' }, 'not checked'));
    return out;
  }
  const blurb = (p) => (p.cors === 'needs-proxy' ? 'Can’t be used straight from a browser: ' + (p.corsNote || 'it does not accept requests from web pages.') : !p.chat ? 'Pictures only: its key is used by AI pictures, not by the chat.' : p.notes || '');

  function providers(select, o = {}) {
    style();
    const label = h('b'), marks = h('span', { class: 'sap-pp-n' });
    const btn = h('button', { type: 'button', class: 'sap-pp-btn', 'aria-expanded': 'false', 'aria-haspopup': 'listbox' }, label, marks);
    const q = h('input', { type: 'search', class: 'sap-pp-q', placeholder: `Search ${C.providers.length} providers or a model`, 'aria-label': 'Search providers', autocomplete: 'off', spellcheck: 'false' });
    const none = h('p', { class: 'sap-pp-none', hidden: true }, 'No provider matches. “Any address” takes any server that speaks the OpenAI API.');
    const panel = h('div', { class: 'sap-pp', hidden: true, role: 'listbox', 'aria-label': 'AI providers' }, q);
    const rows = new Map(), groups = new Map();
    for (const g of C.GROUPS) {
      const list = C.providers.filter((p) => p.group === g.id);
      if (!list.length) continue;
      const det = h('details', { class: 'sap-pp-g', 'data-group': g.id, open: g.id === 'main' || null }, h('summary', null, `${g.name} (${list.length})`));
      for (const p of list) {
        const off = !p.usable;
        const row = h('button', { type: 'button', role: 'option', class: 'sap-pp-row' + (off ? ' off' : ''), 'data-id': p.id, 'aria-disabled': off ? 'true' : null, 'aria-checked': 'false' },
          h('span', { class: 'sap-pp-n' }, h('b', null, p.name), badges(p)), blurb(p) ? h('span', { class: 'sap-pp-d' }, blurb(p)) : null);
        row.addEventListener('click', () => { if (!off) choose(p.id); });
        rows.set(p.id, row); det.append(row);
      }
      groups.set(g.id, det); panel.append(det);
    }
    panel.append(none);
    const opened = new Set(['main']);   // the groups open before a search, put back when it is cleared
    function filter() {
      const text = q.value.trim(), hits = new Set(C.search(text).map((p) => p.id));
      for (const [id, row] of rows) row.hidden = !!text && !hits.has(id);
      for (const [id, det] of groups) {
        const any = [...det.querySelectorAll('.sap-pp-row')].some((r) => !r.hidden);
        det.hidden = !any;
        det.open = text ? any : opened.has(id);
      }
      none.hidden = !text || hits.size > 0;
    }
    // what the person opened or closed (a click on the heading), not what a search opened
    for (const [id, det] of groups) det.querySelector('summary').addEventListener('click', () => setTimeout(() => { if (!q.value.trim()) { if (det.open) opened.add(id); else opened.delete(id); } }));
    function sync() {
      const p = C.byId(select.value);
      label.textContent = p ? p.name : 'Choose a provider';
      marks.textContent = ''; if (p) marks.append(...badges(p));
      for (const [id, row] of rows) row.setAttribute('aria-checked', String(id === select.value));
    }
    function show(open) {
      panel.hidden = !open; btn.setAttribute('aria-expanded', String(open));
      if (open) { q.value = ''; filter(); q.focus(); }
    }
    function choose(id) {
      select.value = id; select.dispatchEvent(new Event('change')); sync(); show(false); btn.focus();
      if (o.onPick) o.onPick(id);
    }
    btn.addEventListener('click', () => show(panel.hidden));
    q.addEventListener('input', filter);
    q.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); show(false); btn.focus(); }
      if (e.key === 'Enter') { e.preventDefault(); const first = [...rows.values()].find((r) => !r.hidden && !r.classList.contains('off')); if (first) choose(first.dataset.id); }
    });
    select.addEventListener('change', sync);
    sync();
    return { node: h('div', { class: 'sap-pp-wrap' }, btn, panel), sync, open: () => show(true), close: () => show(false), panel };
  }

  /** The inputs for the {fields} in p's address (RunPod's endpoint id, Cloudflare's account id, Azure's resource). */
  function fields(p, saved = {}) {
    const list = p.fields || [], inputs = {};
    const node = h('div', { class: 'sap-cloud-fields' }, list.map((f) => {
      const inp = h('input', { class: 'sap-cloud-field', 'data-field': f.id, type: 'text', spellcheck: 'false', autocomplete: 'off', placeholder: f.placeholder || '', 'aria-label': f.label });
      inp.value = (saved && saved[f.id]) || f.default || '';
      inputs[f.id] = inp;
      return h('label', { class: 'sap-cloud-f' }, f.label, inp, f.help ? h('span', { class: 'sap-dim' }, f.help) : null);
    }));
    const values = () => Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, i.value.trim()]));
    return { node, values, missing: () => C.resolve(p, values()).missing };
  }

  const RECENT = 'slop-ai.cloud.recent';
  const readRecent = () => { try { return JSON.parse(localStorage.getItem(RECENT) || '{}') || {}; } catch (e) { return {}; } };
  const recent = (p) => (readRecent()[p.id || p] || []).slice(0, 5);
  function remember(p, id) {
    if (!id) return;
    const all = readRecent(), pid = p.id || p;
    all[pid] = [id, ...(all[pid] || []).filter((x) => x !== id)].slice(0, 5);
    try { localStorage.setItem(RECENT, JSON.stringify(all)); } catch (e) { /* storage blocked: not remembered */ }
  }

  /** The model select: "Recently used" first, and a search box over it once there are more than 8 models. */
  function models(select, p) {
    style();
    let q = select.parentNode && select.parentNode.querySelector('.sap-cloud-model-q');
    if (!q) {
      q = h('input', { type: 'search', class: 'sap-cloud-model-q', placeholder: 'Search models', 'aria-label': 'Search models', autocomplete: 'off', spellcheck: 'false' });
      select.before(q);
      q.addEventListener('input', () => filter(select, q.value));
    }
    const opts = [...select.querySelectorAll('option')], ids = new Set(opts.map((x) => x.value));
    const rec = recent(p).filter((id) => ids.has(id));
    if (rec.length) {
      const was = select.value;
      select.prepend(h('optgroup', { label: 'Recently used', 'data-recent': '1' }, rec.map((id) => h('option', { value: id }, opts.find((x) => x.value === id).textContent))));
      select.value = was;
    }
    q.value = ''; q.hidden = ids.size <= 8;
  }
  /** Hides the options that do not match (the chosen one stays). */
  function filter(select, text) {
    const words = String(text || '').toLowerCase().split(/\s+/).filter(Boolean);
    for (const o of select.querySelectorAll('option')) o.hidden = !!words.length && o.value !== select.value && !words.every((w) => (o.value + ' ' + o.textContent).toLowerCase().includes(w));
    for (const g of select.querySelectorAll('optgroup')) g.hidden = ![...g.children].some((o) => !o.hidden);
  }

  C.pick = { providers, fields, models, remember, recent, filter, badges };
})();
