/* Slop Docs — ui/main: boot. Waits for the engine, registers with the hub, opens the document the page was
 * launched with (?drive=<id>, from Slop Drive's New ▸ menu or "Send to…") in a new tab. The open tabs are restored first.
 * Classic script, runs last. */
(function () {
  'use strict';
  const S = window.SlopDocs;
  const $ = (id) => document.getElementById(id);

  function wireChrome() {
    S.wireMenus();
    if (S.ctxmenu) S.ctxmenu.init();
    $('btnSave').addEventListener('click', () => S.save());
    const name = $('docName');
    name.addEventListener('change', () => {
      const v = name.value.trim() || 'Untitled document';
      S.file.name = v.replace(/\.sdoc$/i, '') + '.sdoc';
      S.file.dirty = true;
      S.emit('change');
      S.emit('view');
      S.focusIme();
    });
    name.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); name.blur(); S.focusIme(); } });
    S.on('change', () => S.R.reveal());
    S.on('view', () => { if (S.file && S.saveLabel) $('saveState').textContent = S.saveLabel(); });
    $('stage').addEventListener('pointerdown', (e) => { if (!e.target.closest('#pages')) S.focusIme(); });
  }

  /** On a phone, fit the page to the screen width (the page is 816 px wide at 100%). */
  function fitZoom() {
    if (window.innerWidth >= 700) return;
    const z = Math.round(Math.max(0.35, Math.min(1, (window.innerWidth - 24) / 816)) * 100) / 100;
    S.zoom = z;
    const sel = $('zoomSel');
    if (![...sel.options].some((o) => Number(o.value) === z)) sel.append(new Option(Math.round(z * 100) + '%', String(z)));
    sel.value = String(z);
  }

  async function boot() {
    if (S.booted) return;
    S.booted = true;
    if (!window.SlopDocEngine) { $('pageInfo').textContent = 'Slop Docs could not start'; return; }
    try { if (window.SlopHub) SlopHub.register('docs'); } catch (e) { console.warn('Slop Docs: hub register failed', e); }
    wireChrome();
    fitZoom();
    // The open tabs come back first (ui/tabs.js and shared/doctabs/session.js); a blank tab opens when none were stored.
    const session = S.session = S.mountTabs();
    try { await session.restore(); } catch (e) { console.warn('Slop Docs: restore failed', e); }
    if (!S.tabsApi().current()) S.newDoc();
    let launch = null;
    try { launch = window.SlopHub ? await SlopHub.consumeLaunch() : null; } catch (e) { console.warn('Slop Docs: launch failed', e); }
    if (launch) {
      // A launch from Slop Drive opens its document in a new tab, and an untouched blank tab it replaces is closed.
      const blank = S.isPristine(S.tabsApi().current()) ? S.tabsApi().current() : null;
      try { await S.openRecord(launch, { silent: true }); } catch (e) { if (window.SlopUI) SlopUI.toast('Could not open: ' + e.message); }
      if (blank && S.tabsApi().current() !== blank) await S.tabsApi().close(blank);
    } else {
      try { await S.restorePlace(); } catch (e) { /* the caret and zoom are optional */ }
    }
    S.focusIme();
    S.ready = true;
    S.emit('ready');
  }
  if (window.SlopDocEngine) boot();
  else document.addEventListener('slopdocs:engine', boot, { once: true });
})();
