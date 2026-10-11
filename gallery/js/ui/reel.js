/* Slop Gallery: "Make reel". The Make reel dialog (template, target length, pace, aspect, order, Cut out subjects first),
 * then run(): photos go into a Slop Drive folder, optional cut-outs follow (cancellable, rolled back on cancel), a manifest
 * is written and SlopEdit opens on it (?drive=<manifest id>). See HANDOFF.md for the flow and the manifest format.
 * Entry points: init(button) for the toolbar button, open(ids) for menus and the command palette.
 * Exposes window.SlopGallery.reel. */
(function () {
  'use strict';
  const G = (window.SlopGallery = window.SlopGallery || {});
  const C = () => G.reelCore;
  const el = (...a) => SlopUI.el(...a);
  const toast = (m) => window.SlopUI && SlopUI.toast(m);
  const STAGE = { runtime: 'loading the runtime', model: 'downloading the model', init: 'starting', infer: 'finding the subject', refine: 'refining the edges' };
  class Cancelled extends Error { constructor() { super('Cancelled'); this.cancelled = true; } }

  /** Opens a tab for SlopEdit inside the click (browsers allow that), filled in when the reel is ready. */
  function openTab() {
    try {
      const w = window.open('', '_blank');
      if (w) w.document.write('<!doctype html><title>SlopEdit</title><p style="font:16px system-ui;padding:24px">Making your reel…</p>');
      return w;
    } catch (e) { return null; }
  }
  function editorUrl(manifestId) {
    return SlopHub.urlOf(SlopHub.appById('slopedit'), { drive: manifestId });
  }
  /** Points the tab from openTab() at SlopEdit (or this tab, when no tab could be opened). */
  function openEditor(manifestId, win) {
    const url = editorUrl(manifestId);
    if (win && !win.closed) { try { win.location.href = url; return; } catch (e) { /* fall through */ } }
    location.href = url;
  }

  /** The progress dialog for the cut-outs. Cancel, Escape or closing it calls onCancel once. */
  function progress(total, onCancel) {
    let done = false;
    const msg = el('p', { class: 'sui-p' }, 'Starting…');
    const bar = el('progress', { class: 'reel-bar', max: String(total), value: '0' });
    const d = SlopUI.dialog({ title: 'Cutting out subjects', body: el('div', { class: 'reel-prog' }, msg, bar), buttons: [{ label: 'Cancel' }], modal: true, onClose: () => { if (!done) onCancel(); } });
    return {
      set(n, text) { bar.value = String(n); if (text) msg.textContent = text; },
      close() { done = true; d.close(true); },
    };
  }

  /** Makes the reel. Resolves with { cancelled, error, failed, folderId, manifestId, files (Drive ids in order), overlays }. */
  async function run(photos, spec, opts = {}) {
    const ctl = new AbortController();
    if (opts.signal) { if (opts.signal.aborted) ctl.abort(); else opts.signal.addEventListener('abort', () => ctl.abort(), { once: true }); }
    const check = () => { if (ctl.signal.aborted) throw new Cancelled(); };
    const ordered = C().orderPhotos(photos, spec.order);
    const name = C().folderName(new Date());
    const out = { cancelled: false, error: '', folderId: null, manifestId: null, files: [], fileIds: [], overlays: [], failed: [] };
    let session = null, bar = null;
    try {
      session = await G.reelDrive.begin(name);
      out.folderId = session.folderId;
      if (spec.cutout) bar = progress(ordered.length, () => ctl.abort());
      for (const p of ordered) {
        check();
        const row = await G.db.get('originals', p.id);
        if (!row || !row.blob) { out.failed.push(p.name); continue; }
        out.fileIds.push({ photo: p, id: await session.addPhoto(p, row.blob) });
      }
      if (out.fileIds.length < C().MIN_FILES) throw new Error('Fewer than two of the photos could be read.');
      if (spec.cutout) {
        const n = out.fileIds.length;
        for (let i = 0; i < n; i++) {
          check();
          const { photo, id } = out.fileIds[i];
          bar.set(i, `Cutting out ${i + 1} of ${n}: ${photo.name}`);
          try {
            const row = await G.db.get('originals', photo.id);
            const png = await G.reelCutout.cutOut(row.blob, { signal: ctl.signal, onProgress: (pr) => bar.set(i, `Cutting out ${i + 1} of ${n}: ${photo.name} · ${STAGE[pr.phase] || 'working'}`) });
            check();
            out.overlays.push({ id: await session.addOverlay(photo, id, png), of: id });
          } catch (e) {
            check();
            out.failed.push(`${photo.name} (no cut-out: ${e.message || e})`);
          }
        }
        bar.set(n, 'Saving the reel…');
      }
      check();
      out.files = out.fileIds.map((x) => x.id);
      const manifest = C().buildManifest({ spec, fileIds: out.files, overlays: out.overlays, now: new Date() });
      out.manifestId = await session.finish(manifest);
      if (bar) bar.close();
      if (opts.open !== false) openEditor(out.manifestId, opts.win);
      toast(`Reel ready: ${out.fileIds.length} photos${out.overlays.length ? ', ' + out.overlays.length + ' cut-outs' : ''}`);
      if (out.failed.length) SlopUI.alert('Some photos were left out', `These could not be used: ${out.failed.slice(0, 10).join(', ')}${out.failed.length > 10 ? '…' : ''}`);
      return out;
    } catch (e) {
      if (bar) bar.close();
      if (opts.win && !opts.win.closed) try { opts.win.close(); } catch (x) { /* ignore */ }
      if (session) await session.abort();
      if (e && e.cancelled) { out.cancelled = true; toast('Cancelled. Nothing was added to Slop Drive.'); return out; }
      out.error = e.message || String(e);
      SlopUI.alert('Make reel', 'The reel was not made: ' + out.error + ' Nothing was kept.');
      return out;
    }
  }

  /** The Make reel dialog for these photos. Validation keeps it open with the reason shown. */
  function dialog(photos) {
    const D = C().defaults(), n = photos.length;
    const opt = (list) => list.map((x) => [x.id, x.label]);
    const tpl = SlopUI.select(opt(C().TEMPLATES), D.template);
    const len = SlopUI.number(D.length, C().MIN_LENGTH, C().MAX_LENGTH, 1);
    const pace = SlopUI.select(opt(C().PACES), D.pace);
    const aspect = SlopUI.select(opt(C().ASPECTS), D.aspect);
    const order = SlopUI.select(opt(C().ORDERS), D.order);
    const cut = SlopUI.check('Cut out subjects first (on this device, Fast model; the cut-outs go on top of the photos)', D.cutout);
    const err = el('p', { class: 'sui-p reel-err', role: 'alert' });
    const spec = () => ({ template: tpl.value, length: len.value, pace: pace.value, aspect: aspect.value, order: order.value, cutout: cut.input.checked });
    const check = () => { const e = C().validate(spec(), n); err.textContent = e.join(' '); return e; };
    tpl.addEventListener('change', () => { if (tpl.value === 'reel') aspect.value = '9:16'; check(); });
    for (const x of [len, pace, aspect, order]) { x.addEventListener('input', check); x.addEventListener('change', check); }
    const body = el('div', { class: 'reel-form' },
      el('p', { class: 'sui-p' }, `${n} photo${n === 1 ? '' : 's'} selected. The reel is made in Slop Drive and opens in SlopEdit.`),
      SlopUI.field('Template', tpl), SlopUI.field('Target length', len, 'seconds'), SlopUI.field('Pace', pace),
      SlopUI.field('Aspect', aspect), SlopUI.field('Order', order), cut.el, err);
    SlopUI.dialog({
      title: 'Make reel', body, buttons: [{ label: 'Cancel' }, { label: 'Make reel', primary: true, act: () => {
        const s = spec();
        if (C().validate(s, n).length) { check(); return false; }
        const win = openTab();
        run(photos, s, { win });
        return undefined;
      } }],
    });
    check();
  }

  /** Opens the dialog for the photo ids (the selection, from the menus and the palette). */
  function open(ids) {
    const photos = [...new Set(ids || [])].map((id) => G.library.photo(id)).filter(Boolean);
    dialog(photos);
  }

  /** The toolbar button: shown while something is selected. */
  function init(button) {
    const sync = () => { if (button) button.hidden = G.state.selected.length === 0; };
    if (button) button.addEventListener('click', () => open(G.state.selected));
    G.state.subscribe((what) => { if (what === 'selection') sync(); });
    sync();
  }

  G.reel = { open, run, init, editorUrl, openEditor };
})();
