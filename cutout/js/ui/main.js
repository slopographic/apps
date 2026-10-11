/* Slop Cutout — boot. Starts every UI and render module (a missing one is skipped with a warning, a failing
 * init is logged and the rest still start), then keeps the app-level pieces in step: empty / work mode, the
 * status bar, the busy overlay, toasts, the download button, the unsaved-work guard, and the Slop Hub
 * (register, and open a file another app sent here with ?drive=). */
(function () {
  'use strict';
  const CO = window.CO, U = CO.util, S = CO.state, $ = U.$;
  const MODULES = ['view', 'pointer', 'ctxbar', 'panel', 'queue', 'menus', 'commands', 'ctxmenu', 'files'];
  let busyBy = null;

  function startModules() {
    for (const name of MODULES) {
      const m = CO[name];
      if (!m || typeof m.init !== 'function') { console.warn('Slop Cutout: module missing: ' + name); continue; }
      try { m.init(); } catch (e) { console.error('Slop Cutout: ' + name + '.init failed', e); }
    }
  }

  /* ---------- app state on the page ---------- */
  function mode() { $('#app').dataset.mode = S.current() ? 'work' : 'empty'; }

  function status() {
    const it = S.current(), P = CO.process;
    $('#statusLeft').textContent = it
      ? it.name + (it.w ? ' · ' + it.w + ' × ' + it.h : '') + (it.file ? ' · ' + U.fmtBytes(it.file.size) : '')
      : 'No image';
    let msg = '';
    if (it) {
      if (it.status === 'error') msg = it.error || 'Could not cut out this image';
      else if (it.status === 'working') msg = 'Cutting out…';
      else if (it.status === 'queued') msg = P && P.pending() > 1 ? 'Queued · ' + (P.pending() - 1) + ' more' : 'Queued';
    }
    $('#statusMsg').textContent = msg;
  }

  /** The download button exports the active image in the chosen format; it needs a finished cutout. */
  function download() {
    const b = $('#btnDownload'), it = S.current(), fmt = S.exportOpts.format.toUpperCase();
    b.disabled = !(it && it.status === 'done');
    U.btnIcon(b, 'download', 'Download ' + fmt);
    b.title = 'Download ' + fmt;
  }

  function showBusy(on, msg, progress) {
    const el = $('#busy');
    el.hidden = !on;
    if (!on) return;
    el.querySelector('.busy-msg').textContent = msg || 'Working…';
    const none = progress == null;
    el.classList.toggle('indeterminate', none);
    el.querySelector('.busy-bar i').style.width = none ? '' : Math.round(U.clamp(progress, 0, 1) * 100) + '%';
  }

  /** Unsaved-work guard: an image with brush or look edits lives only in this tab until exported. */
  function guardSync() {
    const g = window.SlopGuard;
    if (g && g.setUnsaved) g.setUnsaved('cutout', S.items.some((it) => it.hist && it.hist.undo.length > 0));
  }

  /* ---------- events ---------- */
  function wire() {
    CO.on('activeItem', () => { mode(); status(); download(); });
    CO.on('list', () => { mode(); status(); guardSync(); });
    CO.on('item', () => {
      status(); download();
      // The model download shows a busy bar; hide it once no image is still being worked on.
      if (busyBy === 'progress' && !S.items.some((i) => i.status === 'working')) { busyBy = null; showBusy(false); }
      guardSync();
    });
    CO.on('history', guardSync);
    CO.on('export', download);
    CO.on('progress', ({ p }) => {
      busyBy = 'progress';
      showBusy(true, 'Loading the AI model…', p && p.total ? p.loaded / p.total : null);
    });
    CO.on('busy', (d) => { busyBy = d.on ? 'busy' : null; showBusy(!!d.on, d.msg, d.progress); });
    CO.on('toast', (msg) => { if (window.SlopUI) SlopUI.toast(msg); });
  }

  /** Announce this app to Slop Hub and open a file another app sent here (?drive=<id>). */
  async function hubBoot() {
    const hub = document.documentElement.dataset.offline ? null : window.SlopHub;
    if (!hub) return;
    hub.register('cutout');
    const rec = await hub.consumeLaunch();
    if (rec && CO.process) CO.process.add([new File([rec.blob], rec.name || 'Untitled', { type: rec.type })]);
  }

  function boot() {
    startModules();
    wire();
    CO.viewState.restore().catch(function (e) { console.warn('Slop Cutout: the last session was not restored', e); }); // ui/view-state.js
    mode(); status(); download(); guardSync();
    hubBoot().catch((e) => console.warn('Slop Cutout: Slop Hub is not available', e));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
