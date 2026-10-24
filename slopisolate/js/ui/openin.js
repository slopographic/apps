/* SlopIsolate — Open in…: where a result goes out, through the one outbound builder (shared/intake/outtake.js,
 * SlopOuttake.items). The same items fill the toolbar's "Open in…", More ▸ Open in and the queue's right-click menu:
 * every app that takes the output (Slop Upscale, Slop Vector, …), Run a workflow… / Add to a workflow…, Save to Slop
 * Drive…, and two richer handovers of this app (SlopOuttake.handover):
 *   PhotoSlop  (image)  the cut-out as a layer, its see-through part being its mask (CO.send.layer; the mask can come back)
 *   Slop Cut   (video)  a colour video + its matte video (a matte pair). If Cut is open the clip is sent to it over the
 *                       Slop Hub bus; otherwise a new Cut tab opens on it. A clip that came from Cut goes back above it.
 * An image's output is its finished picture as a PNG (background, shadow and crop, as exported); a video's is its
 * cut-out on the export colour as MP4. With two or more pictures selected, O.bulkItems() does each item for all of them.
 * CO.openIn: options(it) · items(it) · bulkItems() · show(anchor) */
(function () {
  'use strict';
  const CO = window.CO, U = CO.util, S = CO.state, O = CO.openIn = {};
  const hub = () => (document.documentElement.dataset.offline ? null : window.SlopHub || null);
  const toast = (m) => window.SlopUI && SlopUI.toast(m);
  const OUT = () => window.SlopOuttake || null;

  /** Video to Slop Cut: the colour and matte as two Drive files, then Cut opens on the pair. */
  async function toCut(it) {
    const h = hub(), V = CO.video;
    if (!h || !it.vid || !it.vid.res) return toast('Cut out the video first');
    toast('Preparing the clip for Slop Cut…');
    const base = U.baseName(it.name), folderId = await CO.drive.folder();
    const colour = (await V.enc.colourMp4(it.vid.src, it.vid.res, {})).blob;
    const matte = (await V.enc.matteMp4(it.vid.src, it.vid.res, {})).blob;
    const matteId = await h.put(matte, { name: base + '-matte.mp4', from: 'cutout', meta: { role: 'matte' }, folderId });
    const colourName = base + '-cutout.mp4';
    const colourId = await h.put(colour, { name: colourName, from: 'cutout', meta: { role: 'colour', matteId, clipId: it.origin && it.origin.meta ? it.origin.meta.clipId || null : null }, folderId });
    const clipId = it.origin && it.origin.from === 'slopedit' && it.origin.meta ? it.origin.meta.clipId : null;
    const payload = { id: colourId, matteId, name: colourName, clipId: clipId || null };
    if (h.openApps().includes('slopedit')) { h.emit('cutout-result', payload); toast('Sent to the open Slop Cut'); }
    else window.open(h.urlOf(h.appById('slopedit'), { drive: colourId }), '_blank');
    return colourId;
  }

  const itemOf = (ctx) => (ctx && ctx.data && ctx.data.item) || S.current();
  if (OUT()) {
    OUT().handover({ from: 'cutout', to: 'photoslop', types: ['image/*'], replaces: true, label: 'Send to PhotoSlop as a layer (with its mask)', run: (ctx) => CO.send.layer(itemOf(ctx)) });
    OUT().handover({ from: 'cutout', to: 'slopedit', types: ['video/*'], replaces: true, label: 'Send to Slop Cut as a colour + matte pair', run: (ctx) => toCut(itemOf(ctx)) });
  }

  const isVideo = (it) => it.kind === 'video';
  /** What goes out for an item: SlopOuttake's options. */
  O.options = function (it) {
    const vid = isVideo(it);
    return {
      from: 'cutout', data: { item: it },
      type: vid ? 'video/mp4' : 'image/png',
      name: () => U.baseName(it.name) + (vid ? '-cutout.mp4' : '-cutout.png'),
      get: async () => (vid
        ? (await CO.video.enc.mp4(it.vid.src, it.vid.res, { bg: S.exportOpts.jpgBg })).blob
        : (await CO.export.encode(it, 'png')).blob),
    };
  };
  const ready = (it) => !!it && it.status === 'done' && (!isVideo(it) || (it.vid && it.vid.res));
  /** The menu items for one item (the toolbar, More and the queue's right-click menu). */
  O.items = (it) => (ready(it) && OUT() ? OUT().items(O.options(it)) : []);

  /** With several pictures selected: the items of the first, each done for every selected picture that is ready. Run a
   *  workflow… gets all of them at once; Save to Slop Drive… is the selection's own action (ui/bulk-act.js). */
  O.bulkItems = function () {
    const list = CO.bulk.items().filter(ready), first = list[0];
    if (!first) return [];
    return O.items(first).filter((row) => row !== '-' && !/^Save to Slop Drive/.test(row.label)).map((row) => {
      if (/^Run a workflow/.test(row.label)) return { label: row.label, act: () => CO.bulk.act('workflow') };
      if (/^Add to a workflow/.test(row.label)) return row;
      return { label: row.label, act: () => CO.bulk.run(row.label, list, async (it) => {
        const mine = O.items(it).find((r) => r.label === row.label);
        if (mine) await mine.act();
      }) };
    });
  };
  /** The menu under the toolbar button: the selection's when two or more are selected, else the image on screen's. */
  O.show = function (anchor) {
    const many = S.bulk(), items = many ? O.bulkItems() : O.items(S.current());
    if (!items.length) return toast(S.current() ? 'Wait until the cut-out is ready' : 'Open an image first');
    const r = anchor.getBoundingClientRect();
    SlopUI.menu(items, r.left, r.bottom + 4);
  };

  O.init = function () {
    const top = U.$('.topbar'), dl = U.$('#btnDownload');
    if (!top || !dl) return;
    const b = U.h('button', { type: 'button', class: 'btn', id: 'btnOpenIn', title: 'Open the cut-out in another app', 'aria-haspopup': 'menu' }, 'Open in…');
    b.addEventListener('click', () => O.show(b));
    top.insertBefore(b, dl);
    const sync = () => { const it = S.current(); b.disabled = !(S.bulk() ? CO.bulk.items().some(ready) : ready(it)); };
    ['activeItem', 'item', 'sel'].forEach((t) => CO.on(t, sync));
    sync();
  };
})();
