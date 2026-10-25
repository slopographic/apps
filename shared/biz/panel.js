// SlopBiz.panel: the record panel of every business app, on the suite's one layout (shared/frame/HANDOFF.md, "settings and
// the main button live in the right panel"): an open record's form or details sit in a panel on the RIGHT of the record
// (SlopFrame: resized on its edge and kept, shown and hidden from its header button, Ctrl+Alt+B), and its main button
// (Save, Issue…, Confirm order, Run…) is in the panel's footer, stuck to the panel's foot. On a phone the panel is a bottom
// sheet (SlopSheet) whose closed state still shows that footer, so the main button is always in reach; "Details" opens it.
// Classic script, after shared/frame/frame.js and panel.js (and shared/ui/sheet.js, menubutton.js, resize-panel.js).
//   const rp = SlopBiz.panel.mount({
//     app: 'invoices',            // the key of the panel's size and shown/hidden state
//     root, view, panel,          // the record view, its main part and the panel (elements or selectors)
//     label: 'Details',           // the panel's name (header button, the footer's button that opens the sheet)
//     button: '.biz-doc-actions', // where the header's show/hide button goes (optional)
//     phone: '(max-width: 720px)' // when the panel is a sheet (the app's own phone width; default 900 px)
//   });
//   rp.actions(nodes, host)   the record's action buttons and notes: the primary one(s) and Save go in the footer, the
//                             others (and the notes) into host, a section of the panel; call it on every state change
//   rp.footer(list, opts)     the footer straight (shared/frame/panel.js footer())     rp.frame   the SlopFrame
(function (g) {
  'use strict';
  const B = (g.SlopBiz = g.SlopBiz || {});
  const pick = (x) => (typeof x === 'string' ? document.querySelector(x) : x || null);
  const SAVE = /^save\b/i;

  function mount(o) {
    const root = pick(o.root), panel = pick(o.panel), label = o.label || 'Details';
    if (!g.SlopFrame || !root || !panel) return { actions: (nodes, host) => { if (host) host.replaceChildren(...nodes); }, footer() {}, frame: null };
    // the header button's place: a bar the app draws later (the record bar) gets it once it is on the page
    const slot = o.button ? document.createElement('span') : null;
    if (slot) {
      slot.className = 'biz-rp-slot';
      const put = () => { const h = pick(o.button); if (h && !h.contains(slot)) h.append(slot); return !!h; };
      if (!put() && g.MutationObserver) { const mo = new g.MutationObserver(() => { if (put()) mo.disconnect(); }); mo.observe(document.body, { childList: true, subtree: true }); }
    }
    const frame = g.SlopFrame.mount(root, { list: null, view: pick(o.view), panel, panelLabel: label, storageKey: o.app + '-record', app: o.app,
      phone: o.phone || '(max-width: 900px)', button: slot, phoneButton: false, width: o.width || 340, min: 280, max: 620 });
    const p = g.SlopFrame.panel(panel, { bare: true });
    root.classList.add('biz-rp');
    // With no main button (a paid invoice, a cancelled order) the phone's footer is only "Details", which opens the sheet
    const peek = document.createElement('button');
    peek.type = 'button';
    peek.className = 'btn biz-rp-peek';
    peek.textContent = label;
    peek.setAttribute('aria-haspopup', 'dialog');
    peek.addEventListener('click', () => frame.openSheet());

    /** The footer: the given buttons (the page's own, moved in) and "Details" that opens the phone's sheet. */
    function footer(list, opts) {
      const foot = (list || []).filter(Boolean);
      if (!foot.length) { p.footer([{ el: peek }]); return; }
      p.footer(foot.map((b) => (b.nodeType ? { el: b } : b)), Object.assign({ more: label }, opts || {}));
    }

    /** Splits the record's actions: Save and the primary button(s) into the footer, the rest into host, in their order. */
    function actions(nodes, host) {
      const list = (nodes || []).filter(Boolean);
      const isBtn = (n) => n.tagName === 'BUTTON' || (n.tagName === 'A' && n.classList.contains('btn'));
      const main = list.filter((n) => isBtn(n) && !n.hidden && (n.classList.contains('primary') || SAVE.test(n.textContent.trim())));
      const save = main.filter((n) => !n.classList.contains('primary')), prim = main.filter((n) => n.classList.contains('primary'));
      if (host) host.replaceChildren(...list.filter((n) => !main.includes(n)));
      if (host) host.hidden = !host.childElementCount;
      footer(save.concat(prim));
    }

    return { actions, footer, frame, panel: p };
  }

  B.panel = { mount };
})(typeof window !== 'undefined' ? window : globalThis);
