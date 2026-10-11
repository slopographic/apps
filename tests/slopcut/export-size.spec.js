/* SlopCut: exporting at a chosen size (1080×1920) from a 1920×1080 source. The output must have that size and
   the picture must be drawn the way the preview draws it (fit into the frame, centred). */
(function () {
  'use strict';
  const { describe, it, expect, waitFor } = SlopTest;

  /** Decode the first frame of a blob with a <video> element and return its size and pixels. */
  async function decodeFirst(blob) {
    const url = URL.createObjectURL(blob), v = document.createElement('video');
    v.muted = true; v.src = url;
    await new Promise((r, j) => { v.onloadeddata = r; v.onerror = () => j(new Error('decode failed')); });
    await new Promise((r) => { v.onseeked = r; v.currentTime = 0.01; });
    const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    URL.revokeObjectURL(url);
    return { w: v.videoWidth, h: v.videoHeight, c };
  }
  /** Bounding box of pixels that are red-ish (the picture) in a canvas. */
  function redBox(c) {
    const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data;
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) {
      const i = (y * c.width + x) * 4;
      if (d[i] > 120 && d[i + 1] < 120) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    return { x0, y0, x1, y1 };
  }
  /** A 1920×1080 source: solid red. */
  function sourceCanvas() {
    const s = document.createElement('canvas'); s.width = 1920; s.height = 1080;
    const g = s.getContext('2d'); g.fillStyle = 'rgb(200,50,50)'; g.fillRect(0, 0, 1920, 1080);
    return s;
  }

  describe('export size', () => {
    it('boots the app', async () => { await ST.boot('app'); expect(ST.SE.doc.tracks.length).toBe(4); });
    it('the compositor draws a 1920×1080 source into a 1080×1920 frame the way the preview does', async () => {
      await ST.reset();
      const SE = ST.SE, p = SE.doc;
      SE.change('Size', (d) => { d.w = 1080; d.h = 1920; });
      const out = ST.renderAt(SE.doc, 0.5, { W: 1080, H: 1920, source: () => sourceCanvas() });
      const b = redBox(out);
      // landscape into portrait: full width, 607.5 px tall, centred vertically
      expect(b.x0).toBeLessThanOrEqual(2);
      expect(b.x1).toBeGreaterThanOrEqual(1076);
      expect(Math.abs(b.y0 - (1920 - 608) / 2)).toBeLessThanOrEqual(4);
      expect(p).toBeTruthy();
    });

    it('an export to 1080×1920 has that size and the same picture as the preview', async () => {
      await ST.reset();
      const SE = ST.SE;
      const blob = await SE.synth.video({ w: 1920, h: 1080, fps: 5, dur: 1, draw: (g) => { g.fillStyle = 'rgb(200,50,50)'; g.fillRect(0, 0, 1920, 1080); } });
      const file = new ST.win.File([blob], 'src.' + (blob.type.includes('mp4') ? 'mp4' : 'webm'), { type: blob.type });
      await SE.app.importFiles([file]);
      await waitFor(() => SE.doc.clips.length > 0, { timeout: 30000 });
      expect(SE.doc.w).toBe(1920);
      // what the export dialog does: preset size, sequence size applied, then encode
      const size = SE.exportDialog.size('phone', 0, 0);
      if (size.w !== SE.doc.w || size.h !== SE.doc.h) SE.settings.apply({ w: size.w, h: size.h });
      const out = await SE.encode.run({ format: 'mp4', w: size.w, h: size.h, fps: 5, quality: 'high', audio: false, a: 0, b: 1 });
      const dec = await decodeFirst(out.blob);
      expect([dec.w, dec.h]).toEqual([1080, 1920]);
      const b = redBox(dec.c);
      expect(JSON.stringify({ b, clip: SE.doc.clips.map((c) => ({ x: c.x, y: c.y, scale: c.scale, rot: c.rot, crop: [c.cropL, c.cropR, c.cropT, c.cropB], kind: c.kind })), p: [SE.doc.w, SE.doc.h] })).toBe('DEBUG');
      expect(b.x1 - b.x0).toBeGreaterThanOrEqual(1000);
      expect(Math.abs(b.y0 - (1920 - 608) / 2)).toBeLessThanOrEqual(6);
    }, { timeout: 90000 });
  });
})();
