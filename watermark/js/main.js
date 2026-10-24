/* Slop Watermark: boot. Builds the header (SlopAppBar), the drop zone (SlopDrop), the setup form, the list and the
 * preview, then restores the saved setup and marks the page ready for the tests. Classic script. */
(function () {
  'use strict';
  const $ = window.WMUtil.$;
  const toast = (msg) => window.SlopUI.toast(msg);
  let bar = null, busy = false, cancelRun = false, dropZone = null;

  /** Header actions. Apply and ZIP need pictures (and results); the page says why when they are not ready. */
  function syncBar() {
    const n = window.WMItems.count(), outs = window.WMItems.outCount();
    if (dropZone) dropZone.empty(!n); // the preview in the zone is for an empty page only
    $('wm-preview-box').hidden = !n; $('wm-preview-note').hidden = !n; // the empty stage would only repeat the zone
    bar.setActions([
      { id: 'open', label: 'Open pictures…', icon: 'open', disabled: busy, onClick: () => $('wm-open').click() },
      { id: 'apply', label: 'Apply to all', icon: 'save', primary: true, disabled: busy || !n, onClick: applyAll },
      { id: 'zip', label: 'Download all (ZIP)', icon: 'download', disabled: busy || !outs, onClick: downloadZip },
      { id: 'clear', label: 'Clear', disabled: busy || !n, onClick: clearAll },
    ]);
  }
  /** Changing the setup makes earlier results out of date: they are dropped, and the page says so. */
  function changed() {
    const had = window.WMItems.outCount();
    if (had) { window.WMItems.clearOuts(); $('wm-run-note').textContent = 'The setup changed. Apply to all again to update the results.'; }
    window.WMList.render();
    window.WMPreview.schedule();
    syncBar();
  }
  function readyToApply() {
    const cfg = window.WMSettings.cfg();
    if (cfg.kind === 'logo' && !window.WMSettings.logo()) { toast('Upload a logo first'); return false; }
    if (cfg.kind === 'text' && !cfg.text.trim()) { toast('Type the watermark text first'); return false; }
    return true;
  }
  function showRun(on) {
    $('wm-progress').hidden = !on;
    $('wm-cancel').disabled = !on;
  }
  async function applyAll() {
    if (busy || !window.WMItems.count() || !readyToApply()) return;
    busy = true; cancelRun = false; syncBar(); showRun(true);
    const logo = window.WMSettings.logo();
    const pbar = $('wm-prog-bar');
    try {
      const res = await window.WMExport.applyAll(window.WMItems.all(), (item) => window.WMSettings.cfgFor(item.group), logo && logo.bitmap,
        (done, total, name) => { pbar.max = total; pbar.value = done; $('wm-prog-text').textContent = 'Writing ' + (done + 1) + ' of ' + total + ': ' + name; },
        () => cancelRun);
      $('wm-run-note').textContent = res.stopped ? 'Stopped. ' + res.done + ' written.'
        : res.failed ? res.done + ' written, ' + res.failed + ' could not be written (see the list).'
        : 'Done: ' + res.done + ' ' + (res.done === 1 ? 'picture' : 'pictures') + ' watermarked. Download each one, or all as a ZIP.';
    } catch (err) {
      toast('Could not apply the watermark: ' + ((err && err.message) || 'unknown error'));
    } finally {
      busy = false; showRun(false); window.WMList.render(); syncBar();
    }
  }
  async function downloadZip() {
    if (!window.WMItems.outCount()) return;
    const blob = await window.WMExport.zipAll(window.WMItems.all());
    window.SlopUI.download(blob, window.WMExport.ZIP_NAME);
  }
  function clearAll() {
    if (busy) return;
    window.WMItems.clear();
    $('wm-run-note').textContent = '';
    window.WMList.render(); window.WMPreview.schedule(); syncBar();
  }

  /** Drops and Open pictures: each picture is read into the list. The shared module reports the rest. */
  function wireDrop() {
    dropZone = window.SlopDrop.attach($('wm-drop'), {
      accept: {
        types: window.WMDecode.TYPES, exts: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'],
        noun: 'a PNG, JPEG, WebP, GIF or SVG picture',
      },
      input: $('wm-open'),
      targets: [$('wm-drop'), $('wm-preview-box')],
      label: 'Drop pictures here',
      hint: 'PNG, JPEG, WebP, GIF or SVG. Many at once. Read in this browser, never uploaded.',
      preview: { picture: { src: '../assets/shots/watermark.jpg', alt: 'A sunset photo with a © text watermark in the bottom right corner' },
        steps: ['Drop pictures, many at once', 'Type your text or add a logo, pick a corner', 'Download them all as a ZIP'] },
      sample: { label: 'Try it with 4 sample photos', files: () => window.SlopSamples.photos(4) },
      process: async (file) => {
        if (window.WMItems.count() >= window.WMItems.MAX) throw new Error('the list is full (' + window.WMItems.MAX + ' pictures)');
        return (await window.WMItems.add(file)).id;
      },
      done: () => { window.WMList.render(); window.WMPreview.schedule(); syncBar(); },
      reveal: () => $('wm-list').lastElementChild,
    });
  }

  function boot() {
    bar = window.SlopAppBar.mount($('wm-bar'), {
      home: '../', title: 'Slop Watermark', subtitle: 'Watermark many pictures with your logo or text. Nothing is uploaded.', actions: [], menu: [],
    });
    window.WMSettings.init({ onChange: changed });
    window.WMList.wire((id) => { window.WMItems.remove(id); window.WMList.render(); window.WMPreview.schedule(); syncBar(); });
    $('wm-cancel').addEventListener('click', () => { cancelRun = true; });
    wireDrop();
    window.WMList.render();
    syncBar();
    window.WMSettings.restore().then(() => window.WMPreview.schedule());
    window.WMPreview.schedule();
  }

  document.addEventListener('DOMContentLoaded', () => {
    try { boot(); } catch (e) {
      console.error(e);
      if (window.SlopUI) toast('Slop Watermark could not start: ' + e.message);
    }
    document.body.classList.add('ready');
  });
})();
