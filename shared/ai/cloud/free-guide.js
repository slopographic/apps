/* SlopAIKit cloud freeGuide: "Get a free key in 2 minutes", the collapsible guide in "Use your own AI account"
 * (connect.js). Classic script; adds SlopAIKit.cloud.freeGuide = { render({ onChoose(id), tools() }) → <details> }.
 * Steps for Gemini, Groq and OpenRouter in plain words. Their sign-up links, limits and what the provider may do with
 * free-tier data come from the catalog's `free` field (cloud/catalog/*.js), so the guide and the badges say the same.
 * Gemini and Groq come first: they use the app's tools on their free tier. At OpenRouter only some free models can. */
(function () {
  'use strict';
  const K = (window.SlopAIKit = window.SlopAIKit || {});
  const C = K.cloud;
  const h = (tag, attrs, ...kids) => { const n = document.createElement(tag); for (const k in attrs || {}) { const v = attrs[k]; if (v == null || v === false) continue; if (k === 'class') n.className = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(c)); return n; };
  const CSS = `
.sap-free-guide { border: 1px solid var(--p-line); border-radius: var(--p-radius); padding: 6px 10px; background: var(--p-bg2); }
.sap-free-guide > summary { cursor: pointer; font-weight: 600; color: var(--p-fg); }
.sap-free-guide section { display: grid; gap: 4px; padding: 8px 0 4px; border-top: 1px solid var(--p-line); margin-top: 6px; }
.sap-free-guide h4 { margin: 0; font-size: 13px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.sap-free-guide ol { margin: 0; padding-inline-start: 20px; display: grid; gap: 2px; }
.sap-free-guide a { color: var(--p-fg); }
.sap-free-guide .sap-btn { justify-self: start; height: 28px; }`;
  const style = () => { if (!document.getElementById('sap-free-guide-style')) document.head.append(h('style', { id: 'sap-free-guide-style' }, CSS)); };

  /** The steps for each provider; {link} is its sign-up page from the catalog. */
  const STEPS = {
    gemini: { why: 'Good at controlling apps (it uses tools) and can look at pictures.',
      steps: ['Open {link} and sign in with a Google account.', 'Create an API key there and copy it.', 'Paste it below under API key, press Test connection, and pick a model marked Free (a Flash model).'] },
    groq: { why: 'Very fast, and good at controlling apps (it uses tools).',
      steps: ['Open {link} and sign up (email, Google or GitHub).', 'Create an API key there and copy it.', 'Paste it below under API key, press Test connection, and pick gpt-oss 120B.'] },
    openrouter: { why: 'Many models with one key; the ones whose name ends in :free cost nothing.',
      steps: ['Open {link} and sign up.', 'Create an API key there and copy it.', 'Paste it below under API key, press Test connection, tick “Show only free models” and pick one.'] },
  };

  function section(id, o) {
    const p = C.byId(id), f = p && C.free.tier(p), s = STEPS[id];
    if (!f) return null;
    const link = () => h('a', { href: f.signup, target: '_blank', rel: 'noopener', class: 'sap-free-link' }, f.signup.replace(/^https:\/\//, ''));
    const steps = s.steps.map((t) => { const [a, b] = t.split('{link}'); return h('li', null, a, b === undefined ? null : link(), b || null); });
    const tools = id === 'openrouter' ? h('p', { class: 'sap-dim' }, 'To control apps, the free model must support tools. With “Control this app” on, the free list shows only those.') : null;
    return h('section', { 'data-provider': id },
      h('h4', null, p.short, h('span', { class: 'sap-pp-b free' }, C.free.label(p))),
      h('p', { class: 'sap-dim' }, s.why), h('ol', null, steps),
      h('p', { class: 'sap-dim' }, h('b', null, 'Limits: '), f.note),
      f.training ? h('p', { class: 'sap-dim' }, h('b', null, 'Your data: '), f.training) : null, tools,
      h('button', { type: 'button', class: 'sap-btn sap-free-choose', onclick: () => o.onChoose && o.onChoose(id) }, 'Choose ' + p.short));
  }

  function render(o = {}) {
    style();
    return h('details', { class: 'sap-free-guide' }, h('summary', null, 'Get a free key in 2 minutes'),
      h('p', { class: 'sap-dim' }, 'These give you a key for free. To let the AI control apps, start with Gemini or Groq: they use the app’s tools. A free tier has low limits; when you hit one, wait a little or switch to another free provider.'),
      ['gemini', 'groq', 'openrouter'].map((id) => section(id, o)),
      h('p', { class: 'sap-dim' }, 'Fully free and private: a model on this device (Models on this device, in this same list), or Ollama or LM Studio on this computer (in the provider list).'));
  }

  C.freeGuide = { render, STEPS };
})();
