/* SlopAIKit imageGen dialog: "Generate image…" and "Edit with AI…" for any app (PhotoSlop's Layer menu uses it). Classic
 * script on SlopUI.dialog; needs index.js loaded (await SlopAIKit.imageGenReady) and imageTools (tools.js).
 *   imageGen.dialog({ mode: 'generate' | 'edit', sink, hub, args }) → Promise<{ text, out } | null>
 * The person picks who makes the picture (only providers whose key is in this browser), the model, the size, the
 * quality, a style and how many; the price per picture shows when the provider publishes one. The dialog says which
 * provider receives the prompt (and, for an edit, a copy of the layer) and that its terms apply. Generate is the
 * person's go-ahead, so no second question follows; × or Cancel while it runs stops the request. */
(function () {
  'use strict';
  const K = (window.SlopAIKit = window.SlopAIKit || {});
  const G = K.imageGen, T = () => K.imageTools;
  const LABEL = { layer: 'A new layer', document: 'A new document', drive: 'Slop Drive' };

  async function dialog({ mode = 'generate', sink = window.SlopImageSink, hub = window.SlopHub, args = {} } = {}) {
    const UI = window.SlopUI, el = UI.el, edit = mode === 'edit';
    const list = await G.connected(), cur = (await G.choose(args)) || {}, s = G.settings();
    const body = el('div', { class: 'sig-body' });
    if (!list.length) {
      body.append(el('p', { class: 'sui-p' }, 'Pictures need an image model at a provider you connect with your own key: OpenAI, Google Gemini or OpenRouter (or a server on your computer that offers OpenAI’s Image API). The chat models, Claude among them, cannot draw.'),
        el('p', { class: 'sui-p' }, 'Open the AI panel, click the model name at its top, choose “Use your own AI account” and add the key. Nothing is sent until you press Generate here.'));
      return new Promise((res) => UI.dialog({ title: edit ? 'Edit with AI' : 'Generate image', body, cls: 'sig-dlg', onClose: () => res(null),
        buttons: [{ label: 'Close' }, { label: 'Open the AI panel', primary: true, act: () => { if (window.SlopHeader && SlopHeader.openAI) SlopHeader.openAI(); else if (window.SlopAIPanel) SlopAIPanel.open(); } }] }));
    }
    const prompt = el('textarea', { class: 'sui-input sig-prompt', rows: 4, placeholder: edit ? 'What to change, for example: make the sky a warm sunset' : 'What the picture shows, for example: a misty mountain lake at sunrise, a red canoe on the shore', 'aria-label': edit ? 'What to change' : 'Prompt', style: 'width:100%;box-sizing:border-box;margin-bottom:10px' });
    prompt.value = args.prompt || '';
    const provider = UI.select(list.map((p) => [p.id, p.short]), cur.provider);
    const model = UI.select([], '');
    const aspect = UI.select(G.ASPECTS.map((a) => [a, a]), args.aspect || s.aspect);
    const res = UI.select(G.RESOLUTIONS.map((r) => [r, r === '1K' ? '1K (about 1 megapixel)' : r]), args.resolution || s.resolution);
    const quality = UI.select([['low', 'Low (cheapest)'], ['medium', 'Medium'], ['high', 'High']], args.quality || s.quality);
    const style = UI.select(Object.keys(G.STYLES).map((k) => [k, k === 'none' ? 'None' : k.replace('-', ' ')]), args.style || s.style);
    const count = UI.number(Number(args.n) || 1, 1, 4);
    const clear = UI.check('Transparent background', !!args.transparent);
    const targets = sink ? (sink.targets || ['layer', 'document', 'drive']) : ['drive'];
    const target = UI.select(targets.map((t) => [t, LABEL[t] || t]), targets.includes(args.target) ? args.target : targets[0]);
    const cost = el('p', { class: 'sui-p sig-cost', role: 'status' }), who = el('p', { class: 'sui-p sig-who' }), msg = el('p', { class: 'sui-p sig-msg', role: 'alert' });
    const rows = { aspect: UI.field('Shape', aspect), quality: UI.field('Quality', quality), clear: clear.el };
    body.append(...[prompt, UI.field('Made by', provider), UI.field('Model', model), edit ? null : rows.aspect, UI.field('Size', res), rows.quality, UI.field('Style', style),
      edit ? null : UI.field('Pictures', count), edit ? null : rows.clear, UI.field('Put it in', target), cost, who, msg].filter(Boolean));
    let fetched = [];

    const req = () => ({ provider: provider.value, model: model.value, prompt: prompt.value, aspect: aspect.value, resolution: res.value, quality: quality.value, style: style.value,
      n: edit ? 1 : Math.max(1, Math.min(4, Number(count.value) || 1)), transparent: !edit && clear.input.checked, edit });
    function fillModels() {
      const p = G.byId(provider.value), keep = (G.settings().models || {})[p.id] || cur.model;
      let ms = G.models(p.id, fetched.length && p.id === 'openrouter' ? fetched.filter((m) => (edit ? m.edits : m.generates)) : null);
      if (!ms.length) ms = [{ id: keep || '', name: keep || 'the server’s default model' }];
      model.textContent = '';
      for (const m of ms) model.append(el('option', { value: m.id }, (m.name || m.id) + (m.note ? ` (${m.note})` : '')));
      if (keep && ms.some((m) => m.id === keep)) model.value = keep;
      rows.quality.hidden = !p.quality; rows.clear.hidden = edit || !p.transparent;
      update();
    }
    function update() {
      const r = req(), p = G.byId(r.provider), d = T().describe(r), est = G.estimate(r, fetched);
      cost.textContent = est.perImage != null ? `Price: ${T().money(est.perImage)} per picture${r.n > 1 ? ` · ${T().money(est.total)} for ${r.n}` : ''}${est.exact ? '' : ' (estimate)'}${d ? ` · ${d.size}` : ''}.` : `Price: not known before it is made (${est.note}).`;
      who.textContent = p.local ? `Your prompt${edit ? ' and a copy of the layer' : ''} go to ${p.who}. Nothing leaves this computer.`
        : `Your prompt${edit ? ' and a copy of the layer (at most 1536 px)' : ''} go to ${p.who}, which makes the picture and charges your account. ${p.who}’s terms and content rules apply.` + (p.help ? ' ' + p.help : '')
          + (edit && !p.mask ? ` ${p.short} takes no mask: with a selection, the result is kept inside it here.` : '');
    }
    provider.addEventListener('change', () => { fillModels(); if (provider.value === 'openrouter' && !fetched.length) loadRouter(); });
    [model, aspect, res, quality, style, count, clear.input].forEach((x) => x.addEventListener('change', update));
    count.addEventListener('input', update);
    async function loadRouter() { try { fetched = await G.formats.openrouter.models(); fillModels(); } catch (e) { /* the defaults stay */ } }
    fillModels();
    if (provider.value === 'openrouter') loadRouter();

    let ctl = null;
    return new Promise((done) => {
      let result = null;
      UI.dialog({ title: edit ? 'Edit with AI' : 'Generate image', body, cls: 'sig-dlg',
        onClose: () => { if (ctl) ctl.abort(); done(result); },
        buttons: [{ label: 'Cancel' }, { label: edit ? 'Edit' : 'Generate', primary: true, act: async () => {
          const r = req();
          if (!r.prompt.trim()) { msg.textContent = edit ? 'Say what to change.' : 'Say what the picture should show.'; prompt.focus(); return false; }
          G.save({ provider: r.provider, models: Object.assign({}, G.settings().models, { [r.provider]: r.model }), aspect: r.aspect, resolution: r.resolution, quality: r.quality, style: r.style });
          msg.textContent = edit ? 'Editing… this can take up to a minute.' : 'Making the picture… this can take up to a minute.';
          ctl = new AbortController();
          try { result = await T().make(r, { target: target.value, sink, hub, signal: ctl.signal }); ctl = null; UI.toast(result.text.split('. ')[0] + '.'); return true; } catch (e) {
            ctl = null;
            msg.textContent = (K.cloud && K.cloud.redact ? K.cloud.redact(e && e.message) : e && e.message) || 'Something went wrong.';
            return false;
          }
        } }] });
      setTimeout(() => prompt.focus(), 0);
    });
  }

  G.dialog = dialog;
})();
