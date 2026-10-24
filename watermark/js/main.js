/* Slop Watermark: boot. The suite's List · View · Panel layout (shared/frame, SlopFrame): the files on the left (when
 * there is more than one), the preview in the middle, and on the right the shared watermark panel with the main actions
 * in the panel's footer (Watermark N files, Download, Save to Slop Drive, Open in…). On a phone the list is the page, a
 * file opens over it, and the panel is a bottom sheet. Also the header (SlopAppBar), the drop zone (SlopDrop), the saved
 * setup, a file sent from another app (Slop Drive, ?drive=), and the ready mark for the tests. Pictures, videos and PDFs
 * can be mixed in one batch. Classic script. */
(function () {
  'use strict';
  const $ = window.WMUtil.$;
  const toast = (msg) => window.SlopUI.toast(msg);
  let bar = null, busy = false, run = null, dropZone = null, frame = null, side = null;

  const nounOf = (items, n) => (items.every((x) => x.media === 'picture') ? (n === 1 ? 'picture' : 'pictures') : (n === 1 ? 'file' : 'files'));
  /** The header (Open, Clear) and the panel's footer: the main action and what to do with the results. */
  function syncBar() {
    const items = window.WMItems.all(), n = items.length, outs = window.WMItems.outCount(), one = n === 1 && items[0].out;
    if (dropZone) dropZone.empty(!n); // the preview in the zone is for an empty page only
    $('wm-preview-box').hidden = !n; // the empty stage would only repeat the zone
    bar.setActions([
      { id: 'open', label: 'Open files…', icon: 'open', disabled: busy, onClick: () => $('wm-open').click() },
      { id: 'clear', label: 'Clear', disabled: busy || !n, onClick: clearAll },
    ]);
    bar.setMenu([{ id: 'drive', label: 'Save all to Slop Drive…', disabled: busy || !outs, onClick: saveAll }]);
    const O = window.SlopOuttake, openIn = one && O ? O.items({ get: () => items[0].out.blob, name: items[0].out.name, type: items[0].out.blob.type, from: 'watermark', folder: false }) : null;
    side.setFooter([
      { id: 'wm-apply', label: n ? 'Watermark ' + n + ' ' + nounOf(items, n) : 'Watermark files', primary: true, disabled: busy || !n, run: applyAll },
      { id: 'wm-zip', label: n > 1 ? 'Download all (ZIP)' : 'Download', disabled: busy || !outs, run: n > 1 ? downloadZip : () => window.WMExport.downloadOne(items[0]) },
      { id: 'wm-drive', label: 'Save to Slop Drive…', disabled: busy || !outs, run: saveAll },
      openIn && openIn.length ? { id: 'wm-openin', label: 'Open in…', menu: openIn } : null,
    ]);
    frame.setList(n > 1);
    const panel = window.WMSettings.panel();
    if (panel) panel.setMedia(window.WMItems.kinds());
  }
  const saveAll = () => window.WMExport.saveAllToDrive(window.WMItems.all()).catch((e) => toast('Could not save: ' + e.message));
  /** Changing the setup makes earlier results out of date: they are dropped, and the page says so. */
  function changed() {
    if (window.WMItems.outCount()) { window.WMItems.clearOuts(); $('wm-run-note').textContent = 'The setup changed. Apply to all again to update the results.'; }
    window.WMList.render();
    window.WMPreview.schedule();
    syncBar();
  }
  function showRun(on) { $('wm-progress').hidden = !on; $('wm-cancel').disabled = !on; }
  async function applyAll() {
    if (busy || !window.WMItems.count()) return;
    const problem = window.SlopWatermarkSpec.check(window.WMSettings.spec());
    if (problem) { toast(problem); return; }
    busy = true; run = new AbortController(); syncBar(); showRun(true);
    const pbar = $('wm-prog-bar');
    try {
      const res = await window.WMExport.applyAll(window.WMItems.all(), (item) => window.WMSettings.specFor(item.group),
        (done, total, name, part) => { pbar.max = total; pbar.value = done + (part || 0); $('wm-prog-text').textContent = 'Writing ' + (done + 1) + ' of ' + total + ': ' + name + (part ? ' (' + Math.round(part * 100) + '%)' : ''); },
        run.signal);
      const n = res.done, word = nounOf(window.WMItems.all(), n);
      $('wm-run-note').textContent = res.stopped ? 'Stopped. ' + n + ' written.'
        : res.failed ? n + ' written, ' + res.failed + ' could not be written (see the list).'
        : 'Done: ' + n + ' ' + word + ' watermarked. Download each one, or all as a ZIP.';
    } catch (err) {
      toast('Could not apply the watermark: ' + ((err && err.message) || 'unknown error'));
    } finally {
      busy = false; run = null; showRun(false); window.WMList.render(); syncBar();
    }
  }
  async function downloadZip() {
    if (!window.WMItems.outCount()) return;
    window.SlopUI.download(await window.WMExport.zipAll(window.WMItems.all()), window.WMExport.ZIP_NAME);
  }
  function clearAll() {
    if (busy) return;
    window.WMItems.clear();
    $('wm-run-note').textContent = '';
    window.WMList.render(); window.WMPreview.schedule(); syncBar();
  }
  const added = () => { window.WMList.render(); window.WMPreview.schedule(); syncBar(); if (frame.isPhone()) frame.showView(); };

  /** Drops and Open files: each file is read into the list. The shared module reports the rest. */
  function wireDrop() {
    const W = window.SlopWatermark, exts = ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.bmp', '.gif', '.svg', '.heic', '.heif', '.mp4', '.m4v', '.mov', '.webm', '.pdf'];
    dropZone = window.SlopDrop.attach($('wm-drop'), {
      accept: { types: W.ACCEPT.split(',').filter((t) => t.includes('/')), exts, noun: 'a picture, a video or a PDF' },
      input: $('wm-open'),
      targets: [$('wm-drop'), $('wm-preview-box')],
      label: 'Drop photos, videos or PDFs here',
      hint: 'Pictures (PNG, JPEG, WebP, GIF, SVG, HEIC), videos (MP4, MOV, WebM) and PDFs, many at once. Read in this browser, never uploaded.',
      preview: { picture: { src: '../assets/shots/watermark.jpg', alt: 'A sunset photo with a © text watermark in the bottom right corner' },
        steps: ['Drop photos, videos and PDFs, many at once', 'Type your text or add a logo, pick a corner', 'Download them all as a ZIP'] },
      sample: { label: 'Try it with 4 sample photos', files: () => window.SlopSamples.photos(4) },
      process: async (file) => {
        if (window.WMItems.count() >= window.WMItems.MAX) throw new Error('the list is full (' + window.WMItems.MAX + ' files)');
        return (await window.WMItems.add(file)).id;
      },
      done: added,
      reveal: () => $('wm-list').lastElementChild,
    });
  }

  /** Slop Workflows: this watermark as a Watermark step (shared/ops/flowdoc.js; the mapping is the operation's). */
  function addToWorkflow() {
    window.SlopFlowDoc.addToWorkflow({ id: 'watermark.apply' }, { settings: { spec: window.WMSettings.spec() } })
      .catch((e) => toast('Could not open Slop Workflows: ' + e.message));
  }
  /** A file sent from another app or opened from Slop Drive (?drive=). */
  async function fromDrive() {
    const H = window.SlopHub;
    if (!H) return;
    H.register('watermark');
    const rec = await H.consumeLaunch();
    if (!rec || !rec.blob) return;
    try { await window.WMItems.add(new File([rec.blob], rec.name, { type: rec.type || rec.blob.type })); added(); }
    catch (e) { toast(rec.name + ' ' + e.message); }
  }

  function boot() {
    bar = window.SlopAppBar.mount($('wm-bar'), {
      home: '../', title: 'Slop Watermark', subtitle: 'Watermark photos, videos and PDFs at once with your logo or text. Nothing is uploaded.', actions: [], menu: [],
    });
    frame = window.SlopFrame.mount($('wm-main'), { list: $('wm-files'), view: $('wm-work'), panel: $('wm-panel'), panelLabel: 'Watermark',
      storageKey: 'watermark', phone: '(max-width: 860px)', phoneButton: false, width: 340, min: 300, max: 520 });
    side = window.SlopFrame.panel($('wm-panel'), { title: 'Watermark' });
    side.render([{ key: 'settings', body: $('wm-settings-box') }]);
    $('wm-panel-open').addEventListener('click', () => frame.openSheet());
    $('wm-back').addEventListener('click', () => frame.showList());
    window.WMSettings.init({ onChange: changed, toWorkflow: addToWorkflow });
    window.WMList.wire((id) => { window.WMItems.remove(id); window.WMList.render(); window.WMPreview.schedule(); syncBar(); });
    $('wm-cancel').addEventListener('click', () => { if (run) run.abort(); });
    wireDrop();
    window.WMSettings.restore();
    window.WMList.render();
    syncBar();
    window.WMPreview.schedule();
    fromDrive().catch(() => {});
  }

  document.addEventListener('DOMContentLoaded', () => {
    try { boot(); } catch (e) {
      console.error(e);
      if (window.SlopUI) toast('Slop Watermark could not start: ' + e.message);
    }
    document.body.classList.add('ready');
  });
  window.WMMain = { frame: () => frame, view: () => { if (frame && frame.isPhone()) frame.showView(); } };
})();
