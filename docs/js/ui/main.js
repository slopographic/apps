/* Slop Docs — ui/main: boot. Waits for the engine, registers with the hub, opens the document the page was
 * launched with (?drive=<id>, from Slop Drive's New ▸ menu or "Send to…") or the untitled draft, or a blank page.
 * Classic script, runs last. */
(function () {
  'use strict';
  const S = window.SlopDocs;
  const $ = (id) => document.getElementById(id);

  function wireChrome() {
    S.wireMenus();
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
    let opened = false;
    try {
      const launch = window.SlopHub ? await SlopHub.consumeLaunch() : null;
      if (launch) opened = !!(await S.openRecord(launch, { silent: true }).then(() => true, (e) => { if (window.SlopUI) SlopUI.toast('Could not open: ' + e.message); return false; }));
    } catch (e) { console.warn('Slop Docs: launch failed', e); }
    if (!opened) {
      let restored = false;
      try { restored = await S.restoreUntitled(); } catch (e) { restored = false; }
      if (!restored) S.setDoc(window.SlopDocEngine.M.newDoc(), { file: { id: null, name: 'Untitled document', dirty: false } });
    }
    S.focusIme();
    S.ready = true;
    S.emit('ready');
  }
  if (window.SlopDocEngine) boot();
  else document.addEventListener('slopdocs:engine', boot, { once: true });
})();
