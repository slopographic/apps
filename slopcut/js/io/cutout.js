/* SlopCut: Remove background (send to SlopIsolate). A video clip's media goes to Slop Drive and SlopIsolate opens on it
   (?drive=). Isolate sends the result back as a matte pair: the colour video and its matte video, both in Drive.
   The result is a NEW clip on the video track above the source clip, starting at the same time, with the matte
   (clip.matteMedia) as its alpha. The source clip stays. Results come in over the Slop Hub bus ('cutout-result') when
   Cut is open, or with ?drive= when Cut was opened for them (session.js). SE.cutout.send(clip), SE.cutout.receive(p). */
(function () {
  'use strict';
  const SE = window.SE, M = SE.model, E = SE.edit, A = SE.app;
  const CU = SE.cutout = {};
  const toast = (m) => window.SlopUI && SlopUI.toast(m);

  /** Send a clip's media to SlopIsolate (Drive record carries the clip id so the result can go back above it). */
  CU.send = async function (clip) {
    const h = window.SlopHub, it = SE.media.get(clip.media);
    if (!h || SE.offline) return toast('Slop Drive is not available');
    if (!it || !it.blob) return toast('The media is not loaded yet');
    try {
      const id = await h.put(it.blob, { name: it.meta.name, from: 'slopedit', meta: { clipId: clip.id } });
      window.open(h.urlOf(h.appById('cutout'), { drive: id }), '_blank');
      toast('Opened in SlopIsolate');
    } catch (e) { toast('Could not send: ' + (e.message || e)); }
  };

  /** Place a matte pair as a new clip above payload.clipId (or on a new top track). payload: { id, matteId, name, clipId }. */
  CU.receive = async function (payload) {
    const h = window.SlopHub;
    if (!h || !A) return false;
    const cRec = await h.get(payload.id), mRec = await h.get(payload.matteId);
    if (!cRec || !mRec) { toast('The cut-out is no longer in Slop Drive'); return false; }
    const files = [new File([cRec.blob], cRec.name, { type: cRec.type }), new File([mRec.blob], mRec.name, { type: mRec.type })];
    const metas = (await A.importFiles(files, { from: 'cutout' })) || [];
    const cm = metas.find((m) => m.name === cRec.name), mm = metas.find((m) => m.name === mRec.name);
    if (!cm || !mm) { toast('Could not place the cut-out'); return false; }
    let ids = [];
    SE.change('Add background cut-out', (p) => {
      const src = payload.clipId ? M.clip(p, payload.clipId) : null;
      const vt = M.videoTracks(p);
      let tk, start = 0;
      if (src) { const i = vt.findIndex((t) => t.id === src.track); tk = vt[i + 1] || M.addTrack(p, 'video'); start = src.start; }
      else tk = M.addTrack(p, 'video');
      ids = E.addMedia(p, cm, tk.id, start);
      for (const id of ids) { const c = M.clip(p, id); if (c && c.kind === 'video') c.matteMedia = mm.id; }
      return ids.length ? ids : false;
    });
    if (ids.length) A.select(ids);
    toast('Added the cut-out above the clip');
    return true;
  };

  if (window.SlopHub && typeof SlopHub.on === 'function') SlopHub.on('cutout-result', (d) => { CU.receive(d).catch((e) => toast('Could not add the cut-out: ' + (e.message || e))); });
})();
