/* SlopEdit: the Export dialog (MP4 / WebM / GIF, resolution, frame rate, quality, range), the progress
   dialog with Cancel and the result dialog (preview, download, Save to Slop Drive). */
(function () {
  'use strict';
  const SE = window.SE, SV = window.SlopVideo, U = SE.util, M = SE.model;
  const h = U.h;
  const XD = SE.exportDialog = {};

  /** Output size for a preset id (shared/video presets), or the custom width and height. Even sides. */
  XD.size = function (choice, cw, ch) {
    const sz = SV.presets.size(choice, cw, ch) || { w: SE.doc.w, h: SE.doc.h };
    return { w: sz.w + (sz.w % 2), h: sz.h + (sz.h % 2) };
  };
  XD.range = function (which) {
    const p = SE.doc, d = M.duration(p);
    if (which === 'io' && p.io) return { a: p.io.in || 0, b: p.io.out != null ? p.io.out : d };
    return { a: 0, b: d };
  };
  function nameFor(ext) { return U.baseName(SE.doc.name).replace(/[\\/:*?"<>|]+/g, '-') + '.' + ext; }

  SE.act.exportVideo = function (preset = {}) { open(Object.assign({ format: SE.caps.webcodecs ? 'mp4' : 'rec' }, preset)); };
  SE.act.exportGif = function () { open({ format: 'gif' }); };

  function open(init) {
    if (!SE.doc.clips.length) { SlopUI.toast('Add some clips to the timeline first'); return; }
    SE.player.pause();
    const caps = SE.caps, p = SE.doc, st = U.store.get('export', {});
    const formats = (caps.webcodecs ? [['mp4', 'MP4 (H.264 / AAC)'], ['webm', 'WebM (VP9 / Opus)']] : []).concat(caps.recorder ? [['rec', 'WebM (real-time recording)']] : [], [['gif', 'Animated GIF (short clip)']]);
    const fmt = SlopUI.select(formats, formats.some(([v]) => v === init.format) ? init.format : formats[0][0]);
    const res = SlopUI.select(SV.presets.choices(), st.res || SV.presets.idFor(p.w, p.h));
    const cw = SlopUI.number(st.cw || p.w, SV.presets.MIN, SV.presets.MAX_W, 2), ch = SlopUI.number(st.ch || p.h, SV.presets.MIN, SV.presets.MAX_H, 2);
    const cwRow = SlopUI.field('Width', cw, 'px'), chRow = SlopUI.field('Height', ch, 'px');
    const fps = SlopUI.select([[24, '24 fps'], [25, '25 fps'], [30, '30 fps'], [50, '50 fps'], [60, '60 fps']], st.fps || p.fps);
    const q = SlopUI.select([['low', 'Low (small file)'], ['medium', 'Medium'], ['high', 'High'], ['max', 'Maximum']], st.q || 'high');
    const hasIO = !!(p.io && (p.io.in != null || p.io.out != null));
    const range = SlopUI.select([['all', 'Entire sequence'], ['io', 'In to out']].filter(([v]) => v === 'all' || hasIO), hasIO ? 'io' : 'all');
    const gw = SlopUI.select([[320, '320 px wide'], [480, '480 px wide'], [640, '640 px wide']], st.gw || 480);
    const gf = SlopUI.select([[10, '10 fps'], [12, '12 fps'], [15, '15 fps']], st.gf || 12);
    const audio = SlopUI.check('Include audio', true);
    const note = h('p', { class: 'exp-note' });
    const vRows = h('div', { class: 'exp-grid' }, SlopUI.field('Size', res), cwRow, chRow, SlopUI.field('Frame rate', fps), SlopUI.field('Quality', q), audio.el);
    const gRows = h('div', { class: 'exp-grid' }, SlopUI.field('Width', gw), SlopUI.field('Frame rate', gf));
    async function refresh() {
      const f = fmt.value, gif = f === 'gif';
      vRows.hidden = gif; gRows.hidden = !gif;
      cwRow.hidden = chRow.hidden = res.value !== SV.presets.CUSTOM;
      const r = XD.range(range.value), dur = r.b - r.a;
      if (gif) { note.className = 'exp-note' + (dur > 15 ? ' warn' : ''); note.textContent = dur > 15 ? 'GIFs are limited to 15 seconds: the first 15 s of the range will be used. Set in/out points (I, O) to pick a part.' : 'Exports ' + U.dur(dur) + ' as a looping GIF.'; return; }
      const s = XD.size(res.value, +cw.value, +ch.value), est = SE.encode.bitrate(s.w, s.h, +fps.value, q.value) * dur / 8 + (audio.input.checked ? 16000 * dur : 0);
      let msg = s.w + '×' + s.h + ' · ' + U.dur(dur) + ' · about ' + U.fmtBytes(est) + '. ';
      note.className = 'exp-note';
      if (f === 'rec') { msg += 'This browser has no WebCodecs, so the video is recorded in real time while it plays (takes ' + U.dur(dur) + '). Keep this tab visible.'; note.className = 'exp-note warn'; }
      else {
        try {
          const sel = await SE.encode.pick(f, s.w, s.h, +fps.value, SE.encode.bitrate(s.w, s.h, +fps.value, q.value), audio.input.checked);
          msg += 'Video: ' + sel.video.codec + (sel.audio ? ' · audio: ' + sel.audio.codec : audio.input.checked ? ' · no audio encoder here' : '') + '.';
          if (f === 'mp4' && !sel.video.h264) { msg += ' H.264 is not available in this browser, so the MP4 uses ' + sel.video.mux.toUpperCase() + '.'; note.className = 'exp-note warn'; }
        } catch (e) { msg += e.message; note.className = 'exp-note warn'; }
      }
      note.textContent = msg;
    }
    for (const el of [fmt, res, cw, ch, fps, q, range, gw, gf, audio.input]) el.addEventListener('change', refresh);
    SlopUI.dialog({
      title: 'Export', cls: 'exp-dlg',
      body: h('div', null, SlopUI.field('Format', fmt), SlopUI.field('Range', range), vRows, gRows, note),
      buttons: [{ label: 'Cancel' }, { label: 'Export', primary: true, act: () => {
        U.store.set('export', { res: res.value, cw: +cw.value, ch: +ch.value, fps: +fps.value, q: q.value, gw: +gw.value, gf: +gf.value });
        const r = XD.range(range.value), size = XD.size(res.value, +cw.value, +ch.value);
        if (size.w !== SE.doc.w || size.h !== SE.doc.h) SE.settings.apply({ w: size.w, h: size.h }); // the preset is the sequence size
        setTimeout(() => run({ format: fmt.value, size, fps: +fps.value, quality: q.value, audio: audio.input.checked, a: r.a, b: r.b, gw: +gw.value, gf: +gf.value }), 0);
      } }]
    });
    refresh();
  }
  /** Run an export with progress and cancel. Resolves with { blob, info } or null. */
  async function run(o) {
    const signal = { cancelled: false };
    const prog = SE.progress.open(o.format === 'gif' ? 'Exporting GIF' : 'Exporting video', { onCancel: () => { signal.cancelled = true; } });
    const progress = (f, m) => prog.set(f, m);
    try {
      let out;
      if (o.format === 'gif') out = { blob: await SE.gif.render({ a: o.a, b: Math.min(o.b, o.a + 15), width: o.gw, fps: o.gf, progress, signal }), info: { fps: o.gf } };
      else if (o.format === 'rec') out = await SE.recorder.run({ w: o.size.w, h: o.size.h, fps: o.fps, a: o.a, b: o.b, quality: o.quality, progress, signal });
      else out = await SE.encode.run({ format: o.format, w: o.size.w, h: o.size.h, fps: o.fps, quality: o.quality, audio: o.audio, a: o.a, b: o.b, progress, signal });
      prog.close();
      const ext = o.format === 'gif' ? 'gif' : out.blob.type.includes('mp4') ? 'mp4' : 'webm';
      result(out, nameFor(ext));
      return out;
    } catch (e) {
      prog.close();
      if (e && e.name === 'AbortError') { SE.app.status('Export cancelled'); return null; }
      console.error(e);
      SlopUI.alert('Export failed', (e && e.message) || String(e));
      return null;
    }
  }
  XD.run = run;
  function result(out, name) {
    const url = URL.createObjectURL(out.blob);
    const media = out.blob.type === 'image/gif' ? h('img', { src: url, alt: 'Exported GIF', class: 'exp-media' }) : h('video', { src: url, controls: true, playsinline: true, class: 'exp-media' });
    const i = out.info || {};
    SlopUI.dialog({
      title: 'Export finished', cls: 'exp-dlg', onClose: () => setTimeout(() => URL.revokeObjectURL(url), 60000),
      body: h('div', null, media, h('p', { class: 'sui-p' }, name + ' · ' + U.fmtBytes(out.blob.size) + (i.w ? ' · ' + i.w + '×' + i.h : '') + (i.codec ? ' · ' + i.codec : '') + (i.seconds ? ' · rendered in ' + i.seconds.toFixed(1) + ' s' : ''))),
      buttons: [window.SlopHub && !SE.offline ? { label: 'Save to Slop Drive', act: async () => { await SlopHub.saveToDrive(out.blob, name); return false; } } : null,
        { label: 'Download', primary: true, act: () => SlopUI.download(out.blob, name) }].filter(Boolean)
    });
    SE.app.status('Exported ' + name);
    XD.last = out;
  }
})();
