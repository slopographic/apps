/* Slop Upscale: the controller. One picture or short video at a time: open (button, drop, Slop Drive, or ?drive=<id>
 * from Slop Resize's "Send to…"), choose 2× or 4× and a model, run, compare, then download or save to Slop Drive.
 * Models: Fast (FSRCNN, bundled) for 2× and 4×; Quality (Real-ESRGAN, opt-in through Get more) for 4× only; Lanczos
 * alone. When the chosen model is not installed the run uses Lanczos and the page says so. Classic script. */
(function (g) {
  'use strict';
  const U = g.SlopUpscale, IO = U.io, SL = U.slider, D = U.drive, V = U.video;
  const E = () => g.SlopUpscaleEngine, PL = () => g.SlopUpscalePipeline, MD = g.SlopUpscaleModels;
  const $ = (id) => document.getElementById(id);
  const QUALITY_ID = 'realesrgan-x4plus', QUALITY_FILE = 'model.onnx';
  const S = { item: null, busy: false, cancel: { cancelled: false }, scale: 2, model: 'fast', format: 'png', quality: 0.92, fps: 24, installed: false };

  const toast = (msg) => { if (g.SlopUI && g.SlopUI.toast) g.SlopUI.toast(msg); };
  const setStatus = (msg, frac) => {
    $('up-status').textContent = msg;
    const bar = $('up-bar');
    bar.hidden = frac == null; if (frac != null) bar.value = frac;
  };

  /* ---------- Get more (the library scripts load on first need; nothing is downloaded here) ---------- */
  const LIB = ['manifest.js', 'store.js', 'get-more.js'];
  let libP = null;
  function loadLib() {
    if (!libP) libP = LIB.reduce((chain, f) => chain.then(() => new Promise((res) => {
      if (document.querySelector(`script[data-lib="${f}"]`)) { res(); return; }
      const s = document.createElement('script');
      s.src = new URL('../shared/library/' + f, location.href).href; s.async = false; s.dataset.lib = f;
      s.onload = s.onerror = () => res();
      document.head.append(s);
    })), Promise.resolve());
    return libP;
  }
  async function refreshModels() {
    try {
      await loadLib();
      const rows = g.SlopLibraryStore ? await g.SlopLibraryStore.listPacks() : [];
      S.installed = rows.some((r) => r.id === QUALITY_ID);
    } catch (e) { S.installed = false; }
    $('up-model').querySelector('option[value="quality"]').textContent = S.installed ? 'Quality (Real-ESRGAN, installed)' : 'Quality (Real-ESRGAN, not installed)';
    updateNote();
  }

  /** The model a run will use, with the reason when it is not the one picked. */
  function choice() {
    if (S.model === 'lanczos') return { id: null, label: 'Lanczos (no AI)', note: 'Lanczos resampling only: no AI model is used.' };
    if (S.model === 'quality' && S.scale === 4) {
      if (S.installed) return { id: QUALITY_ID, label: 'Quality (Real-ESRGAN)', note: '' };
      return { id: null, label: 'Lanczos (no AI)', note: 'The Quality model is not installed, so this uses Lanczos. Get more adds it.' };
    }
    const id = `fsrcnn-x${S.scale}`;
    return { id, label: `Fast (FSRCNN x${S.scale})`, note: '' };
  }
  function updateNote() {
    const c = choice();
    $('up-model-note').textContent = c.note || (S.model === 'quality' && S.scale !== 4 ? 'Quality is 4× only.' : '');
  }

  async function libBytes() {
    const b = await g.SlopLibraryStore.getBlob(`${QUALITY_ID}/${QUALITY_FILE}`);
    if (!b) throw new Error('The Quality model is not in this browser any more. Get more adds it again.');
    return b.arrayBuffer();
  }

  /* ---------- Opening ---------- */
  function revoke() { if (S.item && S.item.url) URL.revokeObjectURL(S.item.url); }
  function clear() {
    revoke();
    if (S.busy) return;
    S.item = null;
    $('up-stage').replaceChildren(); $('up-stage').hidden = true;
    $('up-empty').hidden = false; $('up-info').textContent = '';
    setStatus('');
    updateButtons();
  }

  async function open(file, o = {}) {
    const kind = IO.kind(file);
    if (!kind) { toast('That is not a picture or a video'); return false; }
    if (S.busy) { toast('Wait for the run to finish, or cancel it'); return false; }
    clear();
    const item = { name: file.name || 'Untitled', file, kind, url: URL.createObjectURL(file), canvas: null, out: null, outBlob: null, outName: '', drive: o.drive || null, w: 0, h: 0, dur: 0 };
    S.item = item;
    try {
      if (kind === 'image') {
        item.canvas = await IO.decode(file);
        item.w = item.canvas.width; item.h = item.canvas.height;
      } else {
        const probe = document.createElement('video');
        probe.muted = true; probe.src = item.url;
        await new Promise((res, rej) => { probe.onloadedmetadata = () => res(); probe.onerror = () => rej(new Error('This video cannot be read in this browser')); });
        item.w = probe.videoWidth; item.h = probe.videoHeight; item.dur = probe.duration;
        probe.removeAttribute('src'); probe.load();
        if (item.dur > V.MAX_SECONDS) throw new Error(`Videos up to ${V.MAX_SECONDS} seconds (this one is ${Math.round(item.dur)} s). Trim it first.`);
      }
    } catch (e) { S.item = null; URL.revokeObjectURL(item.url); toast(e.message); setStatus(e.message); return false; }
    $('up-empty').hidden = true;
    $('up-stage').hidden = false;
    showBefore();
    setStatus('Choose 2× or 4×, then Upscale.');
    updateInfo();
    updateButtons();
    return true;
  }

  function showBefore() {
    const it = S.item;
    if (it.kind === 'image') {
      const img = document.createElement('img');
      img.src = it.url; img.alt = 'Original';
      $('up-stage').replaceChildren(img);
    } else {
      const v = document.createElement('video');
      v.src = it.url; v.controls = true; v.muted = true; v.playsInline = true; v.setAttribute('aria-label', 'Original video');
      $('up-stage').replaceChildren(v);
    }
  }

  function updateInfo() {
    const it = S.item;
    if (!it) { $('up-info').textContent = ''; return; }
    const ow = it.w * S.scale, oh = it.h * S.scale;
    const extra = it.kind === 'video' ? `, ${Math.round(it.dur)} s at ${S.fps} fps` : '';
    $('up-info').textContent = `${it.name}: ${it.w} × ${it.h} px → ${ow} × ${oh} px (${S.scale}×)${extra}`;
  }

  /* ---------- Running ---------- */
  async function run() {
    const it = S.item;
    if (!it || S.busy) return;
    const c = choice();
    S.busy = true; S.cancel = { cancelled: false };
    updateButtons();
    try {
      const bytes = c.id === QUALITY_ID && !E().isLoaded(QUALITY_ID) ? await libBytes() : null;
      if (it.kind === 'image') {
        setStatus(`Starting ${c.label}…`, 0);
        it.out = { canvas: await PL().run(it.canvas, { scale: S.scale, model: c.id, bytes, signal: S.cancel,
          onProgress: (d, t) => setStatus(`Upscaling with ${c.label}: tile ${d} of ${t}`, d / t) }) };
        showAfterImage();
        setStatus(`Done: ${c.label}, ${it.out.canvas.width} × ${it.out.canvas.height} px. ${c.note}`.trim());
      } else {
        setStatus(`Starting ${c.label} for video…`, 0);
        const r = await V.run(it.file, { scale: S.scale, model: c.id, bytes, fps: S.fps, signal: S.cancel,
          progress: (d, t) => setStatus(`Frame ${d} of ${t} with ${c.label}`, d / t) });
        it.outBlob = r.blob; it.outName = IO.outName(it.name, S.scale, r.ext);
        it.out = { w: r.w, h: r.h };
        showAfterVideo();
        setStatus(`Done: ${r.frames} frames at ${r.w} × ${r.h}, ${c.label}. ${c.note}`.trim());
      }
    } catch (e) {
      if (S.cancel.cancelled || e.message === 'Cancelled') setStatus('Cancelled.');
      else setStatus('Could not upscale: ' + e.message);
    } finally {
      S.busy = false;
      updateButtons();
    }
  }

  function showAfterImage() {
    const it = S.item, before = document.createElement('img');
    before.src = it.url; before.alt = 'Original';
    const after = it.out.canvas;
    after.className = 'up-result'; after.setAttribute('role', 'img'); after.setAttribute('aria-label', 'Upscaled');
    SL.show($('up-stage'), before, after);
  }
  function showAfterVideo() {
    const it = S.item, box = $('up-stage'), before = document.createElement('video'), after = document.createElement('video');
    before.src = it.url; after.src = URL.createObjectURL(it.outBlob);
    for (const v of [before, after]) { v.controls = true; v.muted = true; v.playsInline = true; }
    before.setAttribute('aria-label', 'Original video'); after.setAttribute('aria-label', 'Upscaled video');
    const row = document.createElement('div'); row.className = 'up-videos';
    row.append(before, after);
    box.replaceChildren(row);
  }

  function cancel() {
    if (!S.busy) return;
    S.cancel.cancelled = true;
    E().cancel();
    setStatus('Cancelling…');
  }

  /* ---------- Results ---------- */
  async function resultBlob() {
    const it = S.item;
    if (!it || !it.out) return null;
    if (it.kind === 'video') return it.outBlob;
    return IO.encode(it.out.canvas, S.format, S.quality);
  }
  function resultName() {
    const it = S.item;
    return it.kind === 'video' ? it.outName : IO.outName(it.name, S.scale, S.format);
  }
  async function download() {
    try {
      const blob = await resultBlob();
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = resultName();
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (e) { setStatus(e.message); }
  }
  async function saveDrive() {
    if (!D.available()) { toast('Slop Drive is not available on this page'); return; }
    try {
      const blob = await resultBlob();
      if (!blob) return;
      const id = await D.save(blob, resultName(), { source: S.item.name, scale: S.scale });
      S.item.drive = id;
      toast('Saved to the Slop Upscale folder in Slop Drive');
    } catch (e) { setStatus('Could not save to Slop Drive: ' + e.message); }
  }
  async function openDrive() {
    if (!D.available()) { toast('Slop Drive is not available on this page'); return; }
    const rec = await D.pick();
    if (rec) await openRecord(rec);
  }
  async function openRecord(rec) {
    if (!rec || !rec.blob) return;
    await open(new File([rec.blob], rec.name || 'Drive file', { type: rec.blob.type || '' }), { drive: rec.id });
  }

  /* ---------- Controls ---------- */
  function updateButtons() {
    const has = !!S.item, done = has && !!S.item.out;
    $('up-run').disabled = !has || S.busy;
    $('up-cancel').disabled = !S.busy;
    $('up-download').disabled = !done || S.busy;
    $('up-save').disabled = !done || S.busy || !D.available();
    $('up-clear').disabled = !has || S.busy;
    $('up-scale-2').setAttribute('aria-pressed', String(S.scale === 2));
    $('up-scale-4').setAttribute('aria-pressed', String(S.scale === 4));
    $('up-model').querySelector('option[value="quality"]').disabled = S.scale !== 4;
    if (S.scale !== 4 && S.model === 'quality') { S.model = 'fast'; $('up-model').value = 'fast'; }
    $('up-quality-wrap').hidden = S.format === 'png';
    $('up-fps-wrap').hidden = !(has && S.item.kind === 'video');
    updateNote();
  }
  function setScale(s) { S.scale = s; updateInfo(); updateButtons(); }

  async function formats() {
    const sel = $('up-format');
    for (const o of sel.options) {
      if (o.value === 'png') continue;
      o.disabled = !(await IO.formatSupported(o.value));
      if (o.disabled) o.textContent += ' (not in this browser)';
    }
  }

  function wire() {
    const pick = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*,video/*'; i.onchange = () => i.files[0] && open(i.files[0]); i.click(); };
    $('up-open').addEventListener('click', pick);
    $('up-open-empty').addEventListener('click', pick);
    $('up-drive').addEventListener('click', openDrive);
    $('up-run').addEventListener('click', run);
    $('up-cancel').addEventListener('click', cancel);
    $('up-download').addEventListener('click', download);
    $('up-save').addEventListener('click', saveDrive);
    $('up-clear').addEventListener('click', clear);
    $('up-scale-2').addEventListener('click', () => setScale(2));
    $('up-scale-4').addEventListener('click', () => setScale(4));
    $('up-model').addEventListener('change', (e) => { S.model = e.target.value; updateButtons(); });
    $('up-format').addEventListener('change', (e) => { S.format = e.target.value; updateButtons(); });
    $('up-quality').addEventListener('input', (e) => { S.quality = Number(e.target.value) / 100; $('up-quality-val').textContent = e.target.value; });
    $('up-fps').addEventListener('change', (e) => { S.fps = Number(e.target.value); updateInfo(); });
    $('up-get-more').addEventListener('click', async () => { await loadLib(); if (g.SlopLibrary) g.SlopLibrary.open({ onInstalled: refreshModels }); });
    // Drops and the zone go through SlopDrop (shared/drop): one picture at a time, the rest are refused with a reason.
    SlopDrop.attach($('up-drop'), {
      accept: { types: ['image/*', 'video/*'], exts: ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.mp4', '.m4v', '.mov', '.webm'], noun: 'a picture or a short video' },
      targets: [$('up-stage-wrap')],
      limit: 1,
      process: async (file) => {
        if (!(await open(file))) throw new Error('could not be opened');
        return file.name;
      },
    });
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); }
      else if (e.key === 'Escape' && S.busy) cancel();
    });
  }

  async function boot() {
    wire();
    updateButtons();
    await formats();
    await refreshModels();
    if (g.SlopLibrary) g.SlopLibrary.onChange(refreshModels);
    if (g.SlopHub) {
      g.SlopHub.register('upscale');
      if (D.available()) { const rec = await g.SlopHub.consumeLaunch(); if (rec) await openRecord(rec); }
    }
  }

  U.controller = { open, run, clear, state: () => ({ scale: S.scale, model: S.model, busy: S.busy }) };
  document.addEventListener('DOMContentLoaded', boot);
})(typeof window !== 'undefined' ? window : globalThis);
