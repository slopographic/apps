/* Slop AI — ui/settings: personas (system prompts), the per-chat settings dialog (persona editor, temperature,
 * max tokens, "Control apps" tools) and the tool set for a conversation. */
'use strict';
(function (AI) {
  const K = AI.K, el = AI.el;
  AI.PERSONAS = {
    helper: { name: 'Helpful assistant', system: 'You are Slop AI, a helpful assistant that runs entirely on the user’s own device. Answer clearly and briefly. Use Markdown for lists and code.' },
    sloppo: { name: 'Sloppo', system: (window.SlopAI && SlopAI.SLOPPO) || 'You are Sloppo, a funny jelly slime. SLURP.' },
    coder: { name: 'Code helper', system: 'You are a senior programmer. Give working code in fenced code blocks with the language name, then a short explanation. Prefer simple, dependency-free solutions.' },
    writer: { name: 'Writing coach', system: 'You are a friendly writing coach. Improve the user’s text: keep their voice, make it clearer and shorter, and explain your main changes in a short list.' },
    builder: { name: 'Mini-app builder', hidden: true, system: '' }, // filled by builder-prompts.js
    custom: { name: 'Custom…', system: '' },
  };
  const TOOL_NOTE = 'You are inside slopographic.com, a studio of browser apps. You can open apps, list them and save files to Slop Drive with the tools below.';

  AI.systemFor = function (c) {
    if (!c) return AI.PERSONAS.helper.system;
    let s = c.persona === 'custom' || c.system ? c.system || '' : (AI.PERSONAS[c.persona] || AI.PERSONAS.helper).system;
    if (c.tools) s += '\n\n' + TOOL_NOTE;
    return s.trim();
  };
  AI.toolsFor = function (c) {
    if (!c || !c.tools) return [];
    return K.appTools.build({ appId: 'ai', confirm: (t, m) => window.SlopUI.confirm(t, m, 'Allow') });
  };

  /** The settings dialog for conversation c (or the defaults for new chats when c is null). */
  AI.settingsDialog = function (c, { onSave } = {}) {
    const target = c || { persona: AI.prefs.persona, system: null, temperature: AI.prefs.temperature, maxTokens: AI.prefs.maxTokens, tools: AI.prefs.tools };
    const opts = Object.entries(AI.PERSONAS).filter(([, p]) => !p.hidden || target.persona === 'builder').map(([k, p]) => [k, p.name]);
    const sel = window.SlopUI.select(opts, target.system && target.persona !== 'builder' ? 'custom' : target.persona);
    const ta = el('textarea', { class: 'sui-input persona-text', rows: 7, 'aria-label': 'System prompt' });
    const fill = () => { const p = AI.PERSONAS[sel.value]; ta.value = sel.value === 'custom' ? target.system || '' : (target.persona === sel.value && target.system) || p.system; };
    fill();
    sel.onchange = fill;
    ta.oninput = () => { if (sel.value !== 'custom' && ta.value !== AI.PERSONAS[sel.value].system) sel.value = 'custom'; };
    const temp = el('input', { type: 'range', min: 0, max: 1.5, step: 0.05, value: target.temperature, class: 'range', 'aria-label': 'Temperature' });
    const tempV = el('b', { class: 'mono' }, Number(target.temperature).toFixed(2));
    temp.oninput = () => { tempV.textContent = Number(temp.value).toFixed(2); };
    const max = window.SlopUI.number(target.maxTokens, 16, 8192, 16);
    const tools = window.SlopUI.check('Control apps: let the model open apps and save files (asks before anything destructive)', target.tools);
    const body = el('div', { class: 'settings' },
      window.SlopUI.field('Persona', sel), ta,
      el('label', { class: 'sui-field' }, el('span', { class: 'sui-label' }, 'Temperature'), temp, tempV),
      el('p', { class: 'faint hint' }, 'Lower is focused and repeatable, higher is creative and random.'),
      window.SlopUI.field('Max tokens', max, 'per reply'),
      target.persona === 'builder' ? null : tools.el,
      c ? el('p', { class: 'faint hint' }, 'Applies to this conversation. New chats use your defaults.') : el('p', { class: 'faint hint' }, 'Defaults for new chats.'));
    return new Promise((res) => window.SlopUI.dialog({
      title: c ? 'Chat settings' : 'Default settings', body, cls: 'ai-dlg settings-dlg', onClose: res,
      buttons: [{ label: 'Cancel' }, { label: 'Save', primary: true, act: async () => {
        const persona = sel.value, sys = ta.value.trim();
        Object.assign(target, {
          persona: persona === 'custom' ? 'custom' : persona,
          system: persona === 'custom' || sys !== (AI.PERSONAS[persona] || {}).system ? sys : null,
          temperature: Math.max(0, Math.min(2, +temp.value)), maxTokens: Math.max(16, Math.min(8192, Math.round(+max.value) || 1024)),
          tools: target.persona === 'builder' ? false : tools.input.checked,
        });
        if (c) await AI.db.put(c);
        else { Object.assign(AI.prefs, { persona: target.persona, temperature: target.temperature, maxTokens: target.maxTokens, tools: target.tools }); AI.savePrefs(); }
        if (onSave) onSave(target);
      } }],
    }));
  };
})(window.AI);
