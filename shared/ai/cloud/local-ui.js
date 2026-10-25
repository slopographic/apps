/* SlopAIKit cloud local UI: the parts of the connect form for model servers (connect.js): "Find servers on this
 * computer" and the diagnosis Test connection shows (cloud/local.js). Classic script; adds SlopAIKit.cloud.localUI =
 *   { finder({ onPick(id, base) }) → node, show(box, result) }.
 * The finder asks nothing until it is clicked: the first request to localhost makes Chrome ask whether this site may use
 * apps on the device. Each server that answers is a row with "Use"; one that answers but blocks this website says so. */
(function () {
  'use strict';
  const K = (window.SlopAIKit = window.SlopAIKit || {});
  const C = K.cloud;
  const h = (tag, attrs, ...kids) => { const n = document.createElement(tag); for (const k in attrs || {}) { const v = attrs[k]; if (v == null || v === false) continue; if (k === 'class') n.className = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(c)); return n; };
  const names = (ids) => ids.map((id) => (C.byId(id) || {}).short || id).join(' or ');

  function finder(o = {}) {
    const out = h('div', { class: 'sap-cloud-found', role: 'status' });
    const btn = h('button', { type: 'button', class: 'sap-btn sap-cloud-find' }, 'Find servers on this computer');
    btn.addEventListener('click', async () => {
      btn.disabled = true; out.textContent = 'Looking on the usual ports…';
      try {
        const found = await C.local.find();
        out.textContent = '';
        if (!found.length) { out.append(h('p', { class: 'sap-dim' }, 'No server answered on the usual ports. Start one (Ollama, LM Studio, …), or type its address below. If the browser asked about apps on your device, choose Allow and look again.')); return; }
        for (const f of found) {
          const where = 'localhost:' + f.port;
          if (f.state === 'cors') { out.append(h('p', { class: 'sap-dim sap-cloud-found-row', 'data-port': f.port }, `${names(f.ids)} at ${where} answers, but does not allow this website yet. Pick it and see “How to connect” for the one setting.`)); continue; }
          for (const id of f.ids) {
            const use = h('button', { type: 'button', class: 'sap-btn sap-cloud-found-use', 'data-id': id }, 'Use');
            use.addEventListener('click', () => o.onPick && o.onPick(id, f.base));
            out.append(h('p', { class: 'sap-cloud-found-row', 'data-port': f.port }, h('b', null, (C.byId(id) || {}).short || id), ` at ${where}: ${f.models.length} model${f.models.length === 1 ? '' : 's'} `, use));
          }
        }
      } catch (e) { out.textContent = C.redact(e.message); } finally { btn.disabled = false; }
    });
    return h('div', { class: 'sap-cloud-finder' }, btn, h('span', { class: 'sap-dim' }, ' The browser may ask whether this site may use apps on your device.'), out);
  }

  /** The diagnosis under Test connection: the cause, then its fix, one line each. */
  function show(box, r) {
    box.textContent = '';
    box.hidden = !r || r.ok || !(r.fix && r.fix.length);
    if (!box.hidden) box.append(h('ul', { class: 'sap-cloud-fix', 'data-kind': r.kind }, r.fix.map((t) => h('li', null, t))));
  }

  C.localUI = { finder, show };
})();
