/* Slop Cutout: worker messaging (cutout.js RPC ↔ worker.js), no model download needed. */
(function () {
  'use strict';
  const { describe, it, expect } = SlopTest;
  const C = window.SlopCutout;

  describe('worker messaging', () => {
    it('round-trips a ping through the worker', async () => {
      const r = await C.call('ping', { value: 42 });
      expect(r.pong).toBe(42);
    });
    it('matches concurrent replies to their requests', async () => {
      const vals = await Promise.all([1, 2, 3, 4, 5].map((v) => C.call('ping', { value: v })));
      expect(vals.map((r) => r.pong)).toEqual([1, 2, 3, 4, 5]);
      expect(C.busy).toBe(0);
    });
    it('streams progress events before the reply', async () => {
      const seen = [];
      await C.call('ping', { value: 1, steps: 4 }, { onProgress: (p) => seen.push(p.loaded + '/' + p.total) });
      expect(seen).toEqual(['1/4', '2/4', '3/4', '4/4']);
    });
    it('rejects with the worker error message', async () => {
      await expect(C.call('fail', { message: 'boom' })).rejects(/boom/);
      await expect(C.call('nope')).rejects(/Unknown message nope/);
      await expect(C.finish('no-such-job')).rejects(/Unknown cutout job/);
      expect((await C.call('ping', { value: 'still alive' })).pong).toBe('still alive');
    });
    it('honours an AbortSignal', async () => {
      const ac = new AbortController();
      const p = C.call('ping', { value: 1, steps: 2 }, { signal: ac.signal });
      ac.abort();
      await expect(p).rejects(/Abort/);
      const ac2 = new AbortController(); ac2.abort();
      await expect(C.removeBackground(new ImageData(2, 2), { signal: ac2.signal })).rejects(/Abort/);
    });
    it('restarts the worker after terminate()', async () => {
      const p = C.call('ping', { value: 1 });
      C.terminate();
      await expect(p).rejects(/Stopped/);
      expect((await C.call('ping', { value: 7 })).pong).toBe(7);
    });
    it('reports engine info without loading a model', async () => {
      const i = await C.info();
      expect(i.loaded).toEqual([]);
      expect(i.jobs).toBe(0);
    });
    it('turns images into transferable inputs (ImageData copy, canvas, Blob)', async () => {
      const id = new ImageData(3, 2);
      await expect(C.removeBackground(id, { model: 'fast', signal: AbortSignal.abort() })).rejects(/Abort/);
      expect(id.data.length).toBe(24); // caller's ImageData is not detached
      const blob = await new Promise((r) => { const c = document.createElement('canvas'); c.width = 5; c.height = 4; c.toBlob(r); });
      expect(blob.size).toBeGreaterThan(0);
      await expect(C.removeBackground(blob, { signal: AbortSignal.abort() })).rejects(/Abort/);
      await expect(C.removeBackground({})).rejects(/Unsupported image/);
    });
    it('mask helpers: grey ImageData view and PNG blob', async () => {
      const m = C.maskToImageData(Uint8ClampedArray.of(0, 128, 255, 9), 2, 2);
      expect(Array.from(m.data.slice(4, 8))).toEqual([128, 128, 128, 255]);
      const b = await C.toBlob(m, 'image/png');
      expect(b.type).toBe('image/png');
    });
  });
})();
