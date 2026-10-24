/* SlopSheet: on a phone, an app's side panel becomes a bottom sheet that behaves the same in every app. Tapping the tool
 * that is already open closes it, it has a close × in its top corner, and Escape, a tap outside it or a swipe down from
 * its top closes it too. On a wider screen nothing changes: the panel stays where the app puts it.
 *
 *   const s = SlopSheet.attach({
 *     root: appEl,                     // gets openClass while the sheet is open, and 'ssh-phone' on a phone
 *     panel: panelEl,                  // the panel that is the sheet on a phone
 *     phone: '(max-width: 900px)',     // when the panel is a sheet (a media query)
 *     openClass: 'sheet-open',         // the app's own class for an open sheet (its CSS slides the panel in); default
 *                                      //   'ssh-open', with the shared look below (class 'ssh-panel' on the panel)
 *     triggers: railEl,                // optional: the tool buttons; a tap opens the sheet, a tap on the active one closes it
 *     isActive: (btn) => btn.classList.contains('on'),   // which trigger is the open tool (default: aria-selected/pressed)
 *     toggles: [btnPanel],             // optional: buttons that open and close it (aria-expanded is kept)
 *     label: 'Tool panel',             // what the × closes ("Close tool panel")
 *     onChange: (open) => {},
 *   });
 *   s.open(); s.close(); s.toggle(); s.isOpen(); s.isPhone(); s.destroy();
 *
 * The sheet is not modal: focus stays where it was when it opens, and goes back to the button that opened it when the ×
 * or Escape closes it. A tap outside closes the sheet and still reaches what was tapped. Classic script, no dependencies;
 * injects its styles once (colours from --sl-* theme tokens). */
(function (g) {
  'use strict';
  if (g.SlopSheet) return;
  const CSS = `
.ssh-x { display: none; }
.ssh-phone .ssh-x { display: inline-flex; position: sticky; inset-block-start: 0; float: inline-end; z-index: 3; align-items: center; justify-content: center;
  inline-size: 44px; block-size: 44px; margin-block-end: -44px; margin-inline-end: 2px; border: 0; border-radius: 12px; background: transparent;
  color: inherit; font: 400 26px/1 system-ui, sans-serif; cursor: pointer; }
.ssh-phone .ssh-x:focus-visible { outline: 2px solid var(--sl-accent, Highlight); outline-offset: -4px; }
.ssh-phone .ssh-panel { position: fixed; inset-inline: 0; inset-block-end: var(--ssh-bottom, 0px); max-block-size: 70vh; overflow: auto; z-index: var(--ssh-z, 60);
  background: var(--sl-surface, Canvas); color: var(--sl-text, CanvasText); border-block-start: 1px solid var(--sl-border, GrayText);
  border-radius: 18px 18px 0 0; box-shadow: 0 -16px 40px rgba(0, 0, 0, .35); transform: translateY(calc(100% + 80px)); visibility: hidden;
  transition: transform .22s ease, visibility 0s .22s; }
.ssh-phone.ssh-open .ssh-panel { transform: none; visibility: visible; transition: transform .22s ease; }
@media (prefers-reduced-motion: reduce) { .ssh-phone .ssh-panel, .ssh-phone.ssh-open .ssh-panel { transition: none; } }`;

  function style(doc) {
    if (doc.getElementById('ssh-style')) return;
    const s = doc.createElement('style'); s.id = 'ssh-style'; s.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(s);
  }
  const activeDefault = (b) => b.getAttribute('aria-selected') === 'true' || b.getAttribute('aria-pressed') === 'true' || b.classList.contains('on');

  function attach(o) {
    const root = o.root, panel = o.panel, doc = panel.ownerDocument, win = doc.defaultView;
    style(doc);
    const cls = o.openClass || 'ssh-open', isActive = o.isActive || activeDefault;
    if (!o.openClass) panel.classList.add('ssh-panel');
    const mq = win.matchMedia(o.phone || '(max-width: 900px)');
    const toggles = o.toggles || [];
    let opener = null, wasActive = false;

    const x = doc.createElement('button');
    x.type = 'button'; x.className = 'ssh-x'; x.textContent = '×';
    x.setAttribute('aria-label', 'Close' + (o.label ? ' ' + o.label.toLowerCase() : ''));
    /** The × is the panel's first child; an app that redraws the panel's content keeps it (it is put back on open). */
    const ensureX = () => { if (x.parentNode !== panel) panel.prepend(x); };
    ensureX();

    const isOpen = () => root.classList.contains(cls);
    function set(open, why) {
      if (open && !mq.matches) return;   // a wide screen has no sheet
      if (open) ensureX();
      const was = isOpen();
      root.classList.toggle(cls, !!open);
      if (!o.openClass) root.classList.toggle('ssh-open', !!open);
      for (const t of toggles) t.setAttribute('aria-expanded', String(!!open));
      if (was !== !!open && o.onChange) o.onChange(!!open, why);
    }
    function close(refocus) {
      if (!isOpen()) return;
      set(false, 'close');
      if (refocus && opener && opener.isConnected) { try { opener.focus({ preventScroll: true }); } catch (e) { opener.focus(); } }
    }
    const phoneClass = () => { root.classList.toggle('ssh-phone', mq.matches); if (!mq.matches && isOpen()) set(false, 'wide'); };
    phoneClass();
    mq.addEventListener('change', phoneClass);

    // A tool button: note (before the app's own handler runs) whether it was the open one, then open or close after it.
    const onTriggerDown = (e) => { const b = e.target.closest && e.target.closest('button'); wasActive = !!(b && o.triggers.contains(b) && isActive(b) && isOpen()); };
    const onTrigger = (e) => {
      const b = e.target.closest && e.target.closest('button');
      if (!b || !o.triggers.contains(b) || !mq.matches) return;
      opener = b;
      const close_ = wasActive; wasActive = false;
      win.setTimeout(() => { if (close_) set(false, 'trigger'); else set(true, 'trigger'); }, 0);
    };
    if (o.triggers) { o.triggers.addEventListener('pointerdown', onTriggerDown, true); o.triggers.addEventListener('keydown', onTriggerDown, true); o.triggers.addEventListener('click', onTrigger); }
    const onToggle = (e) => { if (!mq.matches) return; opener = e.currentTarget; set(!isOpen(), 'toggle'); };
    for (const t of toggles) t.addEventListener('click', onToggle);

    x.addEventListener('click', () => close(true));
    const onKey = (e) => { if (e.key === 'Escape' && isOpen() && mq.matches && !e.defaultPrevented) { e.preventDefault(); close(true); } };
    doc.addEventListener('keydown', onKey);
    // a tap outside the sheet, its tool buttons and its toggles closes it; the tap itself still happens
    const inside = (n) => panel.contains(n) || (o.triggers && o.triggers.contains(n)) || toggles.some((t) => t.contains(n));
    const onOutside = (e) => { if (isOpen() && mq.matches && !inside(e.target) && !(e.target.closest && e.target.closest('.sui-back, .smb-menu, [role="dialog"], [role="menu"]'))) set(false, 'outside'); };
    doc.addEventListener('pointerdown', onOutside, true);

    // a swipe down that starts on the top 56 px of the sheet closes it
    let drag = null;
    const onDown = (e) => {
      if (!isOpen() || !mq.matches || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const top = panel.getBoundingClientRect().top;
      if (e.clientY - top > 56 || panel.scrollTop > 0 || (e.target.closest && e.target.closest('input, select, textarea, button:not(.ssh-x)'))) return;
      drag = { y: e.clientY, id: e.pointerId };
    };
    const onMove = (e) => { if (drag && e.pointerId === drag.id) { const dy = Math.max(0, e.clientY - drag.y); panel.style.transform = dy ? 'translateY(' + dy + 'px)' : ''; } };
    const onUp = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dy = e.clientY - drag.y; drag = null; panel.style.transform = '';
      if (dy > 80) close(false);
    };
    panel.addEventListener('pointerdown', onDown);
    win.addEventListener('pointermove', onMove);
    win.addEventListener('pointerup', onUp);
    win.addEventListener('pointercancel', onUp);

    return {
      open: () => set(true, 'api'), close: () => close(false), toggle: () => set(!isOpen(), 'api'), isOpen, isPhone: () => mq.matches,
      destroy() {
        set(false, 'destroy'); x.remove(); mq.removeEventListener('change', phoneClass); root.classList.remove('ssh-phone');
        if (o.triggers) { o.triggers.removeEventListener('pointerdown', onTriggerDown, true); o.triggers.removeEventListener('keydown', onTriggerDown, true); o.triggers.removeEventListener('click', onTrigger); }
        for (const t of toggles) t.removeEventListener('click', onToggle);
        doc.removeEventListener('keydown', onKey); doc.removeEventListener('pointerdown', onOutside, true);
        panel.removeEventListener('pointerdown', onDown); win.removeEventListener('pointermove', onMove);
        win.removeEventListener('pointerup', onUp); win.removeEventListener('pointercancel', onUp);
      },
    };
  }

  g.SlopSheet = { attach };
})(typeof window !== 'undefined' ? window : globalThis);
