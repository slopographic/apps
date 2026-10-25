/* Slop Recorder: boot. The suite's View · Panel layout (shared/frame, SlopFrame): the stage, the trim bar and what the
 * browser can record in the middle; on the right the settings (source, sound, webcam corner, countdown, save as) with the
 * main button at the panel's foot (Record, then Pause and Stop while recording; Download, Save to Slop Drive and Open in…
 * after), a bottom sheet on phones. The header is SlopAppBar (Open recording…). A recording opened from this device or
 * Slop Drive (shared/intake, spec 'recorder': Open recording…, a drop on the stage, a paste, ?drive=) can be trimmed and
 * saved again. Classic script, after the other recorder scripts. Exposes SlopRec.app for commands.js and the tests. */
(function (g) {
  'use strict';
  const R = g.SlopRec, $ = (id) => document.getElementById(id);
  const toast = (m) => g.SlopUI.toast(m);
  let session = null, rec = null, frame = null, side = null, bar = null, saving = null;
  const note = (t) => { $('rc-note').textContent = t || ''; };

  function state() { return session ? session.state : rec ? 'review' : 'idle'; }
  function syncFooter() {
    const st = state(), on = st === 'recording' || st === 'paused' || st === 'countdown';
    const open = rec && !on ? R.save.openInItems() : [];
    const acts = on ? [
      { id: 'rc-stop', label: st === 'countdown' ? 'Cancel' : 'Stop', primary: true, run: () => (st === 'countdown' ? cancel() : stop()) },
      st !== 'countdown' ? { id: 'rc-pause', label: st === 'paused' ? 'Resume' : 'Pause', run: togglePause } : null,
    ] : [
      { id: 'rc-record', label: rec ? 'Record again' : 'Record', primary: !rec, run: () => record() },
      rec ? { id: 'rc-download', label: saving ? 'Saving…' : 'Download', primary: true, disabled: !!saving, run: () => guard(R.save.download()) } : null,
      rec ? { id: 'rc-drive', label: 'Save to Slop Drive', disabled: !!saving, run: () => guard(R.save.toDrive()) } : null,
      open.length ? { id: 'rc-openin', label: 'Open in…', disabled: !!saving, menu: open } : null,
      rec ? { id: 'rc-discard', label: 'Discard', run: discard } : null,
    ];
    side.footer(acts.filter(Boolean), { stack: true, more: 'Settings' });
    R.settings.lock(on);
    bar.setActions([{ id: 'open', label: 'Open recording…', icon: 'open', disabled: on, onClick: () => g.SlopIntake.pick({ to: 'recorder', multiple: false }) }]);
  }
  async function guard(p) {
    saving = p; syncFooter(); note('Making the file…');
    try { const r = await p; note(''); return r; } catch (e) { if (e && e.name !== 'AbortError') toast('Could not save: ' + e.message); note(''); throw e; }
    finally { saving = null; syncFooter(); }
  }

  function hooks() {
    return {
      onChange(st, info) {
        R.view.count(st === 'countdown' ? info.left : 0);
        R.view.timer(info.elapsed, st === 'recording' || st === 'paused' ? st : '');
        if (info.notes.length) note(info.notes.join(' '));
        syncFooter();
      },
      onTick(info) { R.view.count(info.state === 'countdown' ? info.left : 0); R.view.timer(info.elapsed, info.state === 'recording' || info.state === 'paused' ? info.state : ''); },
      onError(e) { toast(e.message); },
      onDone: finished,   // Stop, or the person stopped sharing in the browser's own bar
    };
  }
  async function record(opts) {
    if (session) throw new Error('A recording is already going on.');
    if (opts) R.settings.set(opts);
    if (rec) discard();
    session = R.session.create(hooks());
    try {
      await session.start(R.settings.get());
      R.view.live(session.preview);
      syncFooter();
      if (frame.isPhone()) frame.showView();
      return session.state;
    } catch (e) { session = null; syncFooter(); toast(e.message); throw e; }
  }
  async function stop() {
    if (!session) throw new Error('Nothing is being recorded.');
    await session.stop();
    return rec;
  }
  function finished(r) {
    session = null;
    R.view.live(null); R.view.timer(0, '');
    take(Object.assign(r, { name: R.plan.fileName(new Date(), r.ext) }));
    note(`Recorded ${R.plan.seconds(r.ms / 1000)}. Trim it if you like, then save it.`);
  }
  function cancel() { if (session) { session.cancel(); session = null; R.view.live(null); R.view.count(0); R.view.timer(0, ''); syncFooter(); } }
  function togglePause() { if (!session) return; if (session.state === 'paused') session.resume(); else session.pause(); }
  function take(r) {
    rec = r; R.save.use(r); R.view.review(r); R.settings.formatsFor(r.audioOnly); syncFooter();
  }
  function discard() { rec = null; R.save.use(null); R.view.review(null); note(''); syncFooter(); }

  /** A recording from this device or Slop Drive: its length is read from the file (a WebM's blocks, else the player). */
  async function openFile(file) {
    if (session) throw new Error('Stop the recording first');
    const ext = (/\.([a-z0-9]+)$/i.exec(file.name) || [, 'webm'])[1].toLowerCase(), isWebm = ext === 'webm' || /webm/.test(file.type);
    let ms = 0, audioOnly = /^audio\//.test(file.type);
    if (isWebm) { try { ms = R.webm.measure(new Uint8Array(await file.arrayBuffer())); } catch (e) { ms = 0; } }
    const v = document.createElement('video'), url = URL.createObjectURL(file);
    try {
      v.preload = 'metadata'; v.src = url;
      await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = () => rej(new Error('this file cannot be played in this browser')); });
      if (!ms && isFinite(v.duration)) ms = v.duration * 1000;
      audioOnly = audioOnly || !v.videoWidth;
    } finally { URL.revokeObjectURL(url); }
    if (!ms) throw new Error('its length could not be read');
    take({ blob: file, type: file.type, ext: isWebm ? 'webm' : ext, ms, audioOnly, notes: [], name: file.name });
    note(`${file.name}: ${R.plan.seconds(ms / 1000)}. Trim it or save it in another format.`);
    return file.name;
  }

  function boot() {
    bar = g.SlopAppBar.mount($('rc-bar'), { home: '../', title: 'Slop Recorder', subtitle: 'Record your screen, webcam or microphone. Nothing is uploaded.', actions: [], menu: [] });
    frame = g.SlopFrame.mount($('rc-main'), { list: null, view: $('rc-view'), panel: $('rc-panel'), panelLabel: 'Recorder',
      storageKey: 'recorder', phone: '(max-width: 860px)', phoneButton: false, width: 320, min: 280, max: 480 });
    side = g.SlopFrame.panel($('rc-panel'), { title: 'Recorder' });
    side.render([...document.querySelectorAll('#rc-settings > .rc-group')].map((gr) => ({ key: gr.dataset.title, title: gr.dataset.title, settings: gr })));
    $('rc-panel-open').addEventListener('click', () => frame.openSheet());
    R.settings.init(() => { if (rec) R.settings.formatsFor(rec.audioOnly); R.save.stale(); syncFooter(); });
    R.view.wire(() => { R.save.stale(); });
    R.view.support();
    const preset = new URLSearchParams(g.location.search).get('source');   // a task page's link (?source=camera…)
    if (preset && R.plan.SOURCES.some(([v]) => v === preset)) R.settings.set({ source: preset });
    g.SlopIntake.register({ id: 'recorder', limit: 1,
      accept: { types: ['video/webm', 'video/mp4', 'video/quicktime', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'], exts: ['.webm', '.mp4', '.mov', '.m4a', '.ogg', '.mp3', '.wav'], noun: 'a recording (video or sound)' },
      process: (file) => openFile(file) });
    g.SlopIntake.dropTarget($('rc-stage'), { to: 'recorder' });
    syncFooter();
    if (g.SlopHub) g.SlopHub.register('recorder');
    g.SlopIntake.launch({ to: 'recorder' });
  }
  R.app = { record, stop, cancel, pause: () => session && session.pause(), resume: () => session && session.resume(), togglePause, discard,
    openFile, state, recording: () => rec, session: () => session, frame: () => frame, refresh: syncFooter };
  document.addEventListener('DOMContentLoaded', () => {
    try { boot(); } catch (e) { console.error(e); if (g.SlopUI) toast('Slop Recorder could not start: ' + e.message); }
    document.body.classList.add('ready');
  });
})(typeof window !== 'undefined' ? window : globalThis);
