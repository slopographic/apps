/* SlopAIKit cloud connect: "Use your own AI account", the part of the AI panel's model choice (picker.js) where the
 * person picks a provider, pastes their key, tests the connection and chooses a model. Classic script; adds
 * SlopAIKit.cloud.connect = { render(box, { onReady(engine) }), restore() → Promise<engine|null>, engineFor(id, s) }.
 * The key field is a password field with autocomplete off; the key goes to keys.js (this tab, or this device when
 * "Remember on this device" is on) and from there only into requests to that provider. Forget key removes it.
 * restore(appId): the provider chosen last (or the model last picked in this app), used again on the next page when its
 * key is still here (or none is needed). */
(function () {
  'use strict';
  const K = (window.SlopAIKit = window.SlopAIKit || {});
  const C = K.cloud;
  const h = (tag, attrs, ...kids) => { const n = document.createElement(tag); for (const k in attrs || {}) { const v = attrs[k]; if (v == null || v === false) continue; if (k === 'class') n.className = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(c)); return n; };
  const fetched = new Map();   // provider id → the models its list returned this visit

  function engineFor(id, s = C.keys.settings()) {
    const p = C.byId(id), ps = (s.providers || {})[id] || {};
    const model = ps.model || (C.suggested(p, fetched.get(id))[0] || {}).id;
    if (!model) return null;
    const f = (fetched.get(id) || []).find((m) => m.id === model);
    return new K.CloudEngine({ provider: p, model, base: ps.base || p.base, key: () => C.keys.get(id), modelName: (f && f.name) || ps.modelName || '', price: C.price(p, model, f) || ps.price || null });
  }
  /** appId: the model last picked in this app (model-menu.js) wins when its provider is still connected. */
  async function restore(appId) {
    const s = C.keys.settings(), last = appId && s.lastByApp && s.lastByApp[appId], lp = last && C.byId(last.provider);
    if (lp && (!lp.needsKey || (await C.keys.get(lp.id)))) { s.active = lp.id; s.providers = Object.assign({}, s.providers, { [lp.id]: Object.assign({}, s.providers[lp.id], { model: last.model }) }); }
    const p = s.active && C.byId(s.active);
    if (!p) return null;
    if (p.needsKey && !(await C.keys.get(p.id))) return null;
    const eng = engineFor(p.id, s);
    if (eng) await eng.load();
    return eng;
  }

  function render(box, o = {}) {
    const s = C.keys.settings();
    let p = C.byId(s.active) || C.providers[0];
    const sel = h('select', { class: 'sap-cloud-provider', 'aria-label': 'AI provider' }, C.providers.map((x) => h('option', { value: x.id }, x.name)));
    const base = h('input', { class: 'sap-cloud-base', type: 'url', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Server address' });
    const key = h('input', { class: 'sap-cloud-key', type: 'password', spellcheck: 'false', autocomplete: 'off', 'data-lpignore': 'true', 'aria-label': 'API key' });
    const remember = h('input', { class: 'sap-cloud-remember', type: 'checkbox' });
    const model = h('select', { class: 'sap-cloud-model', 'aria-label': 'Model' });
    const cap = h('input', { class: 'sap-cloud-cap', type: 'number', min: '0', step: '10000', inputmode: 'numeric', placeholder: 'no cap', 'aria-label': 'Spending cap in tokens' });
    const steps = h('input', { class: 'sap-cloud-steps', type: 'number', min: '1', max: '30', step: '1', inputmode: 'numeric', 'aria-label': 'Steps per request' });
    const msg = h('p', { class: 'sap-dim sap-cloud-msg', role: 'status' }), est = h('span', { class: 'sap-dim sap-cloud-est' });
    const help = h('p', { class: 'sap-dim sap-cloud-help' }), local = h('details', { class: 'sap-cloud-local' });
    const keyRow = h('label', { class: 'sap-cloud-f' }, 'API key', key), baseRow = h('label', { class: 'sap-cloud-f' }, 'Address', base);
    const remRow = h('label', { class: 'sap-cloud-check' }, remember, ' Remember the key on this device');
    const test = h('button', { type: 'button', class: 'sap-btn sap-cloud-test' }, 'Test connection');
    const forget = h('button', { type: 'button', class: 'sap-btn sap-cloud-forget' }, 'Forget key');
    const use = h('button', { type: 'button', class: 'sap-btn primary sap-cloud-use' }, 'Use');
    const say = (t, bad) => { msg.textContent = t; msg.classList.toggle('bad', !!bad); };

    function fillModels() {
      const list = fetched.get(p.id) || [], top = C.suggested(p, list), ps = (C.keys.settings().providers || {})[p.id] || {};
      model.textContent = '';
      top.forEach((m) => model.append(h('option', { value: m.id }, m.name + (m.note ? ` (${m.note})` : ''))));
      const rest = list.filter((m) => !top.includes(m));
      if (rest.length) model.append(h('optgroup', { label: 'More models' }, rest.map((m) => h('option', { value: m.id }, m.name))));
      if (ps.model && ![...model.options].some((x) => x.value === ps.model)) model.prepend(h('option', { value: ps.model }, ps.modelName || ps.model));
      if (ps.model) model.value = ps.model;
      model.disabled = !model.options.length;
      estimate();
    }
    function estimate() {
      const pr = C.price(p, model.value, (fetched.get(p.id) || []).find((m) => m.id === model.value)), n = Number(cap.value) || 0;
      est.textContent = n && pr ? ` About $${((n * (pr.input * 0.8 + pr.output * 0.2)) / 1e6).toFixed(2)} at most with this model.` : n ? ' The price of this model is not known here.' : '';
    }
    let seq = 0;
    /** Draws the chosen provider. Cleared first and synchronously, so a slow key-store read can never wipe a message
     * (Test connection's answer) that came after; only the latest call draws. */
    async function show() {
      const my = ++seq;
      say('');
      const ps = (C.keys.settings().providers || {})[p.id] || {};
      sel.value = p.id; base.value = ps.base || p.base || ''; base.placeholder = p.base || 'https://…/v1';
      baseRow.hidden = !p.editBase; keyRow.hidden = remRow.hidden = forget.hidden = !(p.needsKey || p.keyOptional);
      key.value = ''; key.placeholder = p.keyHint || 'paste the key (if the service needs one)';
      const rem = await C.keys.remembered(p.id), has = !!(await C.keys.get(p.id));
      if (my !== seq) return;
      remember.checked = rem;
      if (has) key.placeholder = remember.checked ? 'Key saved on this device' : 'Key kept in this tab';
      forget.disabled = !has;
      use.textContent = 'Use ' + p.short;
      help.textContent = '';
      if (p.needsKey) help.append('Get a key at ', h('a', { href: p.keyUrl, target: '_blank', rel: 'noopener' }, p.where), `. ${p.who} charges your account there for what you use.`);
      else if (p.local) help.append(`Uses ${p.short} running on this computer. Nothing leaves it.`);
      else help.append('Any server that speaks the OpenAI Chat Completions API.');
      local.textContent = ''; local.hidden = !p.editBase;
      if (p.editBase) local.append(h('summary', null, 'How to connect a local server'), ...C.localHelp(p).map((t) => h('p', { class: 'sap-dim' }, t)));
      fillModels();
    }
    const cfgBase = () => (p.editBase ? base.value.trim() : p.base);
    async function engineNow() {
      if (p.editBase) { const bad = C.checkBase(cfgBase()); if (bad) throw new C.CloudError('request', bad); }
      const typed = key.value.trim();
      const e = new K.CloudEngine({ provider: p, model: model.value || (p.models[0] || {}).id || 'model', base: cfgBase(), key: async () => typed || C.keys.get(p.id) });
      return e;
    }

    sel.addEventListener('change', () => { p = C.byId(sel.value); show(); });
    cap.addEventListener('input', estimate); model.addEventListener('change', estimate);
    test.addEventListener('click', async () => {
      test.disabled = true; say('Testing…');
      try {
        const list = await (await engineNow()).test();
        if (list.length) fetched.set(p.id, list);
        fillModels();
        say(`Connected to ${p.short}.` + (list.length ? ` ${list.length} models.` : ''));
      } catch (e) { say(C.redact(e.message, key.value.trim()), true); } finally { test.disabled = false; }
    });
    forget.addEventListener('click', async () => {
      await C.keys.forget(p.id);
      const st = C.keys.settings(); if (st.active === p.id) { st.active = ''; C.keys.save(st); }
      await show(); say(`The ${p.short} key is gone from this browser.`);
      if (o.onForget) o.onForget(p);
    });
    use.addEventListener('click', async () => {
      try {
        const typed = key.value.trim();
        if (p.needsKey && !typed && !(await C.keys.get(p.id))) { say('Paste your key first.', true); key.focus(); return; }
        if (p.editBase) { const bad = C.checkBase(cfgBase()); if (bad) { say(bad, true); return; } }
        if (!model.value) { say('Press Test connection to load the models, then pick one.', true); return; }
        if (typed) await C.keys.set(p.id, typed, { remember: remember.checked });
        else if (await C.keys.get(p.id)) await C.keys.set(p.id, await C.keys.get(p.id), { remember: remember.checked });
        const st = C.keys.settings(), f = (fetched.get(p.id) || []).find((m) => m.id === model.value);
        st.active = p.id; st.cap = Math.max(0, Math.round(Number(cap.value) || 0)); st.steps = Math.min(30, Math.max(1, Math.round(Number(steps.value) || 12)));
        st.providers = Object.assign({}, st.providers, { [p.id]: { model: model.value, modelName: f ? f.name : (p.models.find((m) => m.id === model.value) || {}).name, base: p.editBase ? cfgBase() : undefined, price: f && f.price ? f.price : undefined } });
        if (o.appId) st.lastByApp = Object.assign({}, st.lastByApp, { [o.appId]: { provider: p.id, model: model.value } });
        C.keys.save(st);
        key.value = '';
        const eng = engineFor(p.id); await eng.load();
        say(`Using ${eng.info().name} at ${p.short}.`);
        if (o.onReady) o.onReady(eng);
      } catch (e) { say(C.redact(e.message, key.value.trim()), true); }
    });

    cap.value = s.cap || ''; steps.value = s.steps || 12;
    const wrap = h('details', { class: 'sap-cloud', open: o.open || !!s.active || null },
      h('summary', null, h('b', null, 'Use your own AI account'), h('span', { class: 'sap-dim' }, ' Claude, ChatGPT, Gemini, OpenRouter, or a model on this computer')),
      h('p', { class: 'sap-dim' }, 'With your own key, the requests go from this browser straight to that provider, and are charged to your account there. There is no Slopographic server in between.'),
      h('label', { class: 'sap-cloud-f' }, 'Provider', sel), baseRow, keyRow, help, remRow,
      h('p', { class: 'sap-dim sap-cloud-hint' }, 'Off: the key is kept in this tab only, until you close it.'),
      h('div', { class: 'sap-acts' }, test, forget), msg,
      h('label', { class: 'sap-cloud-f' }, 'Model', model),
      h('label', { class: 'sap-cloud-f' }, 'Spending cap (tokens this visit)', cap), est,
      h('label', { class: 'sap-cloud-f' }, 'Steps per request', steps),
      h('div', { class: 'sap-acts' }, use), local);
    box.append(wrap);
    show();
    return wrap;
  }

  C.connect = { render, restore, engineFor, fetched };
})();
