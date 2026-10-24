/* SlopAIKit gpuHelp: what to say when a model's GPU kernels cannot run on this graphics card (both the f16 and the f32
 * build failed with a shader or pipeline error; webllm.js tried them). Classic script; adds SlopAIKit.gpuHelp.
 *   gpuHelp.details(model, error, sys) → plain text for a bug report: the model, what was tried, the error, the browser
 *        and the GPU (sysinfo.js)
 *   gpuHelp.render(box, { model, error, sys, onSmaller, onCloud }) → the message, "Copy details", "Try a smaller model",
 *        "Use your own AI account" */
(function () {
  'use strict';
  const K = (window.SlopAIKit = window.SlopAIKit || {});
  const el = (tag, attrs, ...kids) => { const n = document.createElement(tag); for (const k in attrs || {}) { if (attrs[k] == null) continue; if (k === 'class') n.className = attrs[k]; else if (k.startsWith('on')) n.addEventListener(k.slice(2), attrs[k]); else n.setAttribute(k, attrs[k]); } n.append(...kids.filter((x) => x != null)); return n; };

  function details(m, e, sys) {
    const g = (sys && sys.gpu) || {}, b = (sys && sys.browser) || {};
    return [`Slop AI could not load ${m ? m.name || m.id : 'the model'}.`,
      `Tried: ${((e && e.tried) || []).join(', ') || (m && m.id) || '?'}`,
      `Error: ${String((e && e.message) || e).slice(0, 600)}`,
      `Browser: ${[b.name, b.version].filter(Boolean).join(' ') || '?'} on ${b.os || '?'}`,
      `GPU: ${[g.vendor, g.architecture, g.description].filter(Boolean).join(' / ') || '?'}${g.f16 != null ? `, shader-f16: ${g.f16 ? 'yes' : 'no'}` : ''}${g.isFallback ? ' (software)' : ''}`,
      `Page: ${location.origin}${location.pathname}`].join('\n');
  }

  function render(box, o = {}) {
    const m = o.model || {}, text = details(m, o.error, o.sys), both = ((o.error && o.error.tried) || []).length > 1;
    const msg = el('span', { class: 'sap-dim sap-gpu-copied', role: 'status' });
    const copy = el('button', { type: 'button', class: 'sap-btn sap-gpu-copy', onclick: async () => {
      try { await navigator.clipboard.writeText(text); msg.textContent = 'Copied.'; } catch (e) { msg.textContent = 'Could not copy: select the text above.'; }
    } }, 'Copy details');
    const wrap = el('div', { class: 'sap-gpu', role: 'alert' },
      el('p', { class: 'sap-pick-no' }, `This graphics card could not run ${m.name || 'this model'}${both ? ', in either version (f16 and f32)' : ''}. Its driver could not compile the model's GPU code.`),
      el('p', { class: 'sap-dim' }, 'A smaller model may work. An AI account of your own works in every browser. Updating the browser or the graphics driver can help too.'),
      el('pre', { class: 'sap-gpu-details' }, text),
      el('div', { class: 'sap-acts' }, copy,
        o.onSmaller ? el('button', { type: 'button', class: 'sap-btn sap-gpu-smaller', onclick: () => o.onSmaller() }, 'Try a smaller model') : null,
        o.onCloud ? el('button', { type: 'button', class: 'sap-btn primary sap-gpu-cloud', onclick: () => o.onCloud() }, 'Use your own AI account') : null),
      msg);
    box.append(wrap);
    return wrap;
  }

  K.gpuHelp = { details, render };
})();
