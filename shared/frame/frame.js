/* SlopFrame: the suite's "List · View · Panel" layout, for every app that shows items one at a time (mail, files, records):
 * an optional list on the left, the item in the centre, and a panel of details and actions on the right. One look and one
 * behaviour everywhere (see shared/frame/HANDOFF.md):
 *   - wide screens: three columns; the panel's width is dragged on its edge (or the arrow keys on the edge) and remembered;
 *     the panel can be hidden and shown (a header button, the View command, Ctrl+Alt+B), and that choice is remembered;
 *   - phones: the list is the main view and an item opens over it (back returns to the list); the panel is a bottom sheet
 *     (shared/ui/sheet.js, SlopSheet) opened by the same header button.
 *
 *   const fr = SlopFrame.mount(root, {
 *     list: listEl, view: viewEl, panel: panelEl,     // list is optional (null: two columns)
 *     phone: '(max-width: 900px)', panelLabel: 'Actions', storageKey: 'eml',
 *     button: '.smb-tools',                           // where the header's show/hide button goes (selector or element; optional;
 *                                                     //   a selector not on the page yet is tried again at DOMContentLoaded)
 *     phoneButton: true,                              // false: no header button on phones (the app opens the sheet itself)
 *     width: 300, min: 240, max: 520,                 // panel width in px (default, limits)
 *     command: true,                                  // register '<storageKey>.panel' in SlopCmd (default true when present)
 *     onChange: (state) => {},                        // { panel: shown, width, viewing } after any change
 *   });
 *   fr.setPanel(bool) fr.togglePanel() fr.panelShown() fr.setWidth(px) fr.width()
 *   fr.setList(bool)     the list column is there or not (an app shows it only when it has more than one item)
 *   fr.showView() fr.showList() fr.viewing()   phones: the item over the list, or the list (wide screens: both shown)
 *   fr.openSheet() fr.closeSheet() fr.isPhone() fr.destroy()
 *
 *   SlopFrame.panel(panelEl, { title, icon }).render(sections)   the panel's content, the same in every app:
 *     { title, rows: [[label, value, hint?]] }                       key/value rows (empty values are skipped)
 *     { title, list: [{ name, meta, open?, actions: [action] }] }    files or items, each with its own buttons
 *     { title, actions: [action] }                                   buttons; one may be primary
 *     { title, note }  { title, body: element }                      a line of text, or the app's own element
 *     { title, settings: element | [elements] }                      a tool's settings group (the app's own controls)
 *   .footer([action], { note, more })   the panel's main button(s), stuck to its bottom (tool apps: the rule)
 *   action = { label, run?, menu?: items | () => items, primary?, disabled?, title?, id? }  or { el: a button already in the page }
 *     menu items = [{ label, act, disabled?, heading? }] open under the button (shared/ui/menubutton.js) as "Label ▾".
 * Classic script; styles in frame.css. Needs shared/ui/sheet.js for phones and shared/ui/menubutton.js for menus. */
(function (g) {
  'use strict';
  if (g.SlopFrame) return;
  const doc = g.document;
  const ls = {
    get(k) { try { return JSON.parse(g.localStorage.getItem(k)) || {}; } catch (e) { return {}; } },
    set(k, v) { try { g.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* not kept */ } },
  };
  const el = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M15 4.5v15"/></svg>';
  const pick = (x) => (typeof x === 'string' ? doc.querySelector(x) : x || null);

  function mount(root, o) {
    o = o || {};
    const list = pick(o.list), view = pick(o.view), panel = pick(o.panel), win = root.ownerDocument.defaultView;
    const key = 'slop-frame:' + (o.storageKey || 'app'), label = o.panelLabel || 'Panel';
    const min = o.min || 240, max = o.max || 520, mq = win.matchMedia(o.phone || '(max-width: 900px)');
    const saved = ls.get(key);
    let shown = saved.hidden !== true, width = clamp(saved.width || o.width || 300), viewing = false, hasList = !!list;
    function clamp(w) { return Math.round(Math.max(min, Math.min(max, Number(w) || 300))); }

    root.classList.add('sf-root');
    if (list) list.classList.add('sf-list');
    view.classList.add('sf-view');
    panel.classList.add('sf-panel');
    if (!panel.getAttribute('aria-label')) panel.setAttribute('aria-label', label);

    const grip = el('div', 'sf-grip');
    grip.tabIndex = 0;
    grip.setAttribute('role', 'separator');
    grip.setAttribute('aria-orientation', 'vertical');
    grip.setAttribute('aria-label', 'Resize the ' + label.toLowerCase() + ' panel (arrow keys)');
    grip.setAttribute('aria-valuemin', String(min));
    grip.setAttribute('aria-valuemax', String(max));
    panel.before(grip);

    // The header button goes into o.button; a host that is not on the page yet (a menu bar mounted after this script)
    // is looked up again once the page is parsed.
    let btn = null;
    const host = pick(o.button);
    if (o.button) {
      btn = el('button', 'slop-hbtn sf-toggle' + (o.phoneButton === false ? ' sf-toggle-wide' : ''));
      btn.type = 'button';
      btn.innerHTML = ICON + '<span class="slop-hbtn-txt"></span>';
      btn.querySelector('.slop-hbtn-txt').textContent = label;
      btn.title = 'Show or hide the ' + label.toLowerCase() + ' panel (Ctrl+Alt+B)';
      btn.setAttribute('aria-label', label + ' panel');
      if (host) host.append(btn);
      else doc.addEventListener('DOMContentLoaded', () => { const h = pick(o.button); if (h) h.append(btn); }, { once: true });
    }

    const sheet = g.SlopSheet ? g.SlopSheet.attach({
      root, panel, side: 'bottom', phone: o.phone || '(max-width: 900px)', label, toggles: btn ? [btn] : [],
      onChange: () => paint(),
    }) : null;

    const phone = () => mq.matches;
    function save() { ls.set(key, { hidden: !shown, width }); }
    function paint() {
      root.style.setProperty('--sf-panel-w', width + 'px');
      root.classList.toggle('sf-nopanel', !shown);
      root.classList.toggle('sf-nolist', !hasList);
      root.classList.toggle('sf-phone', phone());
      root.classList.toggle('sf-viewing', phone() && hasList && viewing);
      grip.setAttribute('aria-valuenow', String(width));
      // a phone's closed sheet that shows only its footer (panel.js footer()): the rest of it is out of reach until opened
      const peek = phone() && panel.classList.contains('sf-has-foot') && !(sheet && sheet.isOpen());
      for (const c of panel.children) { if (!c.classList.contains('sf-p-foot')) c.inert = peek; }
      if (btn) { btn.setAttribute('aria-pressed', String(phone() ? !!(sheet && sheet.isOpen()) : shown)); btn.classList.toggle('sf-phone-hide', phone()); }
      if (o.onChange) o.onChange({ panel: shown, width, viewing });
    }
    function setPanel(on) { shown = !!on; save(); paint(); }
    function togglePanel() {
      if (phone()) { if (sheet) sheet.toggle(); paint(); return; }
      setPanel(!shown);
    }
    function setWidth(w) { width = clamp(w); save(); paint(); }
    if (btn) btn.addEventListener('click', () => { if (!phone()) setPanel(!shown); });
    const onMore = () => { if (phone() && sheet) { sheet.toggle(); paint(); } else if (!shown) setPanel(true); };   // the footer's "more" button
    panel.addEventListener('sf-sheet', onMore);
    const onFoot = () => paint();   // the footer came or went
    panel.addEventListener('sf-foot', onFoot);   // on a phone SlopSheet's toggle opens it

    // Drag the edge: the panel is as wide as from the pointer to the root's far edge (the start edge in right-to-left).
    let drag = null;
    const rtl = () => win.getComputedStyle(root).direction === 'rtl';
    grip.addEventListener('pointerdown', (e) => {
      if (phone() || e.button !== 0) return;
      e.preventDefault();
      drag = e.pointerId;
      try { grip.setPointerCapture(e.pointerId); } catch (x) { /* synthetic event */ }
      root.classList.add('sf-dragging');
    });
    grip.addEventListener('pointermove', (e) => {
      if (drag !== e.pointerId) return;
      const r = root.getBoundingClientRect();
      width = clamp(rtl() ? e.clientX - r.left : r.right - e.clientX);
      paint();
    });
    const end = (e) => { if (drag !== e.pointerId) return; drag = null; root.classList.remove('sf-dragging'); save(); };
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
    grip.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 64 : 16, grow = rtl() ? 'ArrowRight' : 'ArrowLeft', shrink = rtl() ? 'ArrowLeft' : 'ArrowRight';
      if (e.key === grow) setWidth(width + step);
      else if (e.key === shrink) setWidth(width - step);
      else if (e.key === 'Home') setWidth(min);
      else if (e.key === 'End') setWidth(max);
      else return;
      e.preventDefault();
    });
    const onMq = () => paint();
    mq.addEventListener('change', onMq);

    const cmdId = (o.storageKey || 'app') + '.panel';
    if (o.command !== false && g.SlopCmd) {
      g.SlopCmd.register([{ id: cmdId, title: 'Show or hide the ' + label.toLowerCase() + ' panel', group: 'View', keys: ['Mod+Alt+B'],
        keywords: ['panel', 'sidebar', 'details', 'actions', 'side'], checked: () => shown, run: togglePanel }]);
    }
    paint();

    return {
      setPanel, togglePanel, setWidth, panelShown: () => shown, width: () => width,
      setList(on) { hasList = !!on && !!list; if (!hasList) viewing = false; paint(); },
      showView() { viewing = true; paint(); }, showList() { viewing = false; paint(); }, viewing: () => phone() && hasList && viewing,
      openSheet() { if (sheet) sheet.open(); paint(); }, closeSheet() { if (sheet) sheet.close(); paint(); },
      isPhone: phone, button: btn, grip, command: cmdId,
      destroy() {
        mq.removeEventListener('change', onMq);
        panel.removeEventListener('sf-sheet', onMore); panel.removeEventListener('sf-foot', onFoot);
        if (sheet) sheet.destroy();
        grip.remove(); if (btn) btn.remove();
        if (g.SlopCmd && o.command !== false) g.SlopCmd.unregister(cmdId);
        root.classList.remove('sf-root', 'sf-nopanel', 'sf-nolist', 'sf-phone', 'sf-viewing');
      },
    };
  }

  g.SlopFrame = { mount, panel: (p, o) => g.SlopFramePanel.create(p, o) };
})(window);
