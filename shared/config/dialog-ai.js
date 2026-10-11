/* SlopConfigDialog.makeAi: "Make one with AI…". It shows the prompt for the kind. When SlopAI has a local model loaded,
 * "Ask the local AI" fills the reply box; otherwise the person copies the prompt into any assistant and pastes the reply.
 * "Check reply" runs SlopConfig.parseAiReply and lists every problem. Only a reply that checked ok, and is unchanged
 * since, can be applied, and then through SlopConfig.applyValue (validate → apply). Loads after dialog.js. */
(function (g) {
  'use strict';
  const D = g.SlopConfigDialog, C = g.SlopConfig, UI = () => g.SlopUI;
  if (!D || !C || D.makeAi) return;
  const el = (...a) => UI().el(...a);
  const plural = (n) => (n === 1 ? '' : 's');

  function makeAi(o = {}) {
    const app = o.app || C.consts.SHARED_APP;
    const kinds = C.kinds(app);
    if (!kinds.length) { D.showResult({ ok: false, errors: [{ path: '', message: 'this app has no config kinds yet' }] }); return; }

    const kindSel = UI().select(kinds.map((e) => [e.kind, e.label]), kinds[0].kind);
    const request = el('textarea', { class: 'sui-input', rows: 3, placeholder: 'For example: 20% tax, EUR as the currency, en-GB' });
    const prompt = el('textarea', { class: 'sui-input', rows: 8, readonly: true, 'aria-label': 'Prompt' });
    const reply = el('textarea', { class: 'sui-input', rows: 6, placeholder: 'The reply appears here, or paste it here', 'aria-label': 'Reply' });
    const verdict = el('div', { class: 'sui-p', role: 'status', 'aria-live': 'polite' });
    const local = !!(g.SlopAI && g.SlopAI.ready);
    const askBtn = el('button', { class: 'sui-btn', type: 'button', hidden: !local }, 'Ask the local AI');
    const copyBtn = el('button', { class: 'sui-btn', type: 'button' }, 'Copy prompt');
    const checkBtn = el('button', { class: 'sui-btn', type: 'button' }, 'Check reply');
    const applyBtn = el('button', { class: 'sui-btn sui-primary', type: 'button', disabled: true }, 'Apply');
    const notice = local
      ? 'A local model is loaded. Ask it, or copy the prompt into any assistant and paste the reply.'
      : 'No local model is loaded here. Copy the prompt into any assistant, then paste its reply below.';

    let checked = null; // { text, result } for the reply that was checked last
    let handle = null;

    const buildText = () => { try { return C.buildPrompt(kindSel.value, app, request.value); } catch (e) { return e.message; } };
    const refresh = () => { prompt.value = buildText(); };
    const setVerdict = (nodes) => verdict.replaceChildren(...nodes);
    const errorList = (errors) => el('ul', { class: 'sui-errors' }, errors.map((e) => el('li', null, e.path ? `${e.path}: ${e.message}` : e.message)));

    function forget() {
      checked = null;
      applyBtn.disabled = true;
    }

    function check() {
      const r = C.parseAiReply(reply.value, { app });
      checked = { text: reply.value, result: r };
      if (r.ok) {
        applyBtn.disabled = false;
        setVerdict([el('p', { class: 'sui-p' }, `Valid: "${r.value.name}" (${r.value.kind}). Apply writes it to this app.`)]);
      } else {
        applyBtn.disabled = true;
        setVerdict([el('p', { class: 'sui-p' }, `Not applied. ${r.errors.length} problem${plural(r.errors.length)} to fix, then check again:`), errorList(r.errors)]);
      }
    }

    async function ask() {
      if (!g.SlopAI || !g.SlopAI.ready) return;
      askBtn.disabled = true;
      forget();
      reply.value = '';
      setVerdict([el('p', { class: 'sui-p' }, 'Asking the local model…')]);
      try {
        const stream = g.SlopAI.ask(buildText(), { persona: 'plain', temperature: 0.2, max_tokens: 1500 });
        for await (const piece of stream) reply.value += piece;
        setVerdict([el('p', { class: 'sui-p' }, 'Reply received. Check it before applying.')]);
      } catch (e) {
        setVerdict([el('p', { class: 'sui-p' }, `The local model stopped: ${e.message}`)]);
      }
      askBtn.disabled = false;
    }

    async function copy() {
      try { await navigator.clipboard.writeText(prompt.value); note('Prompt copied'); } catch (e) { prompt.select(); note('Select the prompt and copy it'); }
    }

    async function apply() {
      if (!checked || !checked.result.ok || checked.text !== reply.value) { forget(); return; }
      applyBtn.disabled = true;
      const res = await C.applyValue(checked.result.value, { app });
      if (res.ok) { handle && handle.close(); D.showResult(res); } else { D.showResult(res); applyBtn.disabled = false; }
    }

    const note = (msg) => { try { UI().toast(msg); } catch (e) { /* no toast layer */ } };
    kindSel.addEventListener('change', () => { refresh(); forget(); });
    request.addEventListener('input', refresh);
    reply.addEventListener('input', () => { forget(); setVerdict([el('p', { class: 'sui-p' }, 'Check the reply to see if it is valid.')]); });
    askBtn.addEventListener('click', ask);
    copyBtn.addEventListener('click', copy);
    checkBtn.addEventListener('click', check);
    applyBtn.addEventListener('click', apply);
    refresh();

    const body = el('div', null,
      el('p', { class: 'sui-p' }, notice),
      UI().field('Kind', kindSel),
      UI().field('What it should contain', request),
      UI().field('Prompt', prompt),
      el('div', { class: 'sui-foot' }, copyBtn, askBtn),
      UI().field('Reply', reply),
      el('div', { class: 'sui-foot' }, checkBtn, applyBtn),
      verdict);
    handle = UI().dialog({ title: o.title || 'Make one with AI', body, cls: 'sui-wide', buttons: [{ label: 'Close' }] });
  }

  D.makeAi = makeAi;
})(typeof window !== 'undefined' ? window : globalThis);
