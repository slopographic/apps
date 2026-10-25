/* Slop Docs — ui/panel: the Document panel on the right, the suite rule (shared/frame/HANDOFF.md). It holds what the File
 * and Format menus already do for the whole document (the same functions: one source of truth): new and open, the page
 * (header and footer, fonts, print), downloads and Send to…; Save, the main button, and Download PDF sit in its footer
 * (the shared footer, shared/frame/panel.js). Its edge resizes it (shared/ui/resize-panel.js, kept in the settings
 * store); a top-bar button, View ▸ and Ctrl+Alt+B (the command docs.panel) hide and show it, remembered. On a phone
 * (640 px and under) it is a bottom sheet (shared/ui/sheet.js) whose closed state still shows the footer. Classic script. */
(function () {
  'use strict';
  const S = window.SlopDocs, $ = (id) => document.getElementById(id);
  const app = $('app'), el = $('docPanel'), PHONE = '(max-width: 640px)', KEY = 'slop-docs-panel';
  if (!S || !app || !el || !window.SlopFramePanel) return;
  const later = (fn) => () => { fn(); if (S.focusIme) S.focusIme(); };
  const ICON = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M15 4.5v15"/></svg>';

  const sheet = window.SlopSheet ? SlopSheet.attach({ root: app, panel: el, side: 'bottom', phone: PHONE, label: 'Document' }) : null;
  const p = SlopFramePanel.create(el, { title: 'Document' });
  const kinds = [['pdf', 'PDF (.pdf)'], ['docx', 'Word (.docx)'], ['md', 'Markdown (.md)'], ['txt', 'Plain text (.txt)'], ['sdoc', 'Slop Doc (.sdoc)']];
  p.render([
    { title: 'File', actions: [
      { id: 'dp-new', label: 'New', menu: () => [{ label: 'Blank document', act: later(() => S.newDoc()) }, { label: 'Random template…', act: () => S.random.open() }] },
      { id: 'dp-open', label: 'Open from Slop Drive…', run: later(() => S.openFromDrive()), disabled: !window.SlopHub },
    ] },
    { title: 'Page', actions: [
      { id: 'dp-hf', label: 'Header and footer…', run: () => S.openHF() },
      { id: 'dp-fonts', label: 'Fonts…', run: () => $('tbFonts').click() },
      { id: 'dp-print', label: 'Print…', run: later(() => S.print()) },
    ] },
    { title: 'Download and send', actions: [
      { id: 'dp-dl', label: 'Download', menu: () => kinds.map(([k, l]) => ({ label: l, act: later(() => S.download(k)) })) },
      { id: 'dp-send', label: 'Send to', menu: () => (S.sendItems ? S.sendItems() : []), empty: 'No other apps here', disabled: !window.SlopHub },
    ] },
  ]);
  p.footer([{ el: $('btnSave'), primary: true }, { id: 'dp-pdf', label: 'PDF', title: 'Download PDF (.pdf)', run: later(() => S.download('pdf')) }],
    { more: 'Document', onMore: () => sheet && sheet.toggle() });

  // The width: dragged on the inner edge, kept per app in the settings store
  if (window.SlopResizePanel) {
    SlopResizePanel.attach(el, { app: 'docs', id: 'doc-panel', edge: 'start', width: 212, min: 190, max: 420, phone: PHONE, label: 'Document',
      apply: (px) => { if (px != null) app.style.setProperty('--dp-w', px + 'px'); } });
  }
  // Shown or hidden on a wide screen (remembered); on a phone the button opens the sheet
  let shut = false;
  try { shut = localStorage.getItem(KEY) === 'shut'; } catch (e) { /* not kept */ }
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'tb'; btn.id = 'btnPanel'; btn.innerHTML = ICON;
  btn.setAttribute('aria-label', 'Document panel'); btn.title = 'Show or hide the document panel (Ctrl+Alt+B)';
  const paint = () => { app.classList.toggle('dp-shut', shut); btn.setAttribute('aria-pressed', String(!shut)); };
  function toggle() {
    if (sheet && sheet.isPhone()) { sheet.toggle(); return; }
    shut = !shut; paint();
    try { localStorage.setItem(KEY, shut ? 'shut' : 'open'); } catch (e) { /* not kept */ }
  }
  btn.addEventListener('click', toggle);
  const save = $('btnCmd') || $('docName');
  if (save && save.closest('.topbar')) save.closest('.topbar').append(btn);
  paint();
  if (window.SlopCmd) SlopCmd.register([{ id: 'docs.panel', title: 'Show or hide the document panel', group: 'View', keys: ['Mod+Alt+B'],
    keywords: ['panel', 'sidebar', 'document', 'side'], checked: () => !shut, run: toggle }]);
  S.panel = { el, sheet, toggle, shown: () => !shut };
})();
