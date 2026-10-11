/* Reel Remix stage tests (in the app's iframe): the stage is the widest column and its canvas fills the width under a
   70vh cap; files dropped on the stage join the bin; a bin clip dropped on a cut replaces its slot; scrubbing paints the
   frame while paused and Play carries on from it; Export records a file. */
(function () {
  'use strict';
  const { describe, it, expect, waitFor } = SlopTest;
  const frame = () => document.getElementById('app');
  const win = () => frame().contentWindow;
  const doc = () => win().document;
  const RM = () => win().RM;
  const $ = (id) => doc().getElementById(id);
  const change = (el) => el.dispatchEvent(new (win().Event)('change', { bubbles: true }));

  async function ready() { await waitFor(() => win() && win().RM && win().RM.ready, { timeout: 20000 }); }
  async function still(i) {
    const c = doc().createElement('canvas');
    c.width = 320; c.height = 180;
    const g = c.getContext('2d');
    g.fillStyle = 'hsl(' + i * 60 + ' 70% 45%)'; g.fillRect(0, 0, 320, 180);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    return new (win().File)([blob], 'still-' + i + '.png', { type: 'image/png' });
  }
  async function stills(n) {
    const files = [];
    for (let i = 1; i <= n; i++) files.push(await still(i));
    return files;
  }
  async function addStills(n) {
    const dt = new (win().DataTransfer)();
    for (const f of await stills(n)) dt.items.add(f);
    $('rm-file').files = dt.files;
    change($('rm-file'));
    await waitFor(() => RM().state.items.length >= n, { timeout: 20000 });
  }
  const ev = (name, dt, el) => el.dispatchEvent(new (win().DragEvent)(name, { bubbles: true, cancelable: true, dataTransfer: dt, clientX: 0, clientY: 0 }));
  /** A hash of the whole preview canvas, so two frames can be compared. */
  function frameHash() {
    const cv = $('rm-canvas'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let h = 0;
    for (let i = 0; i < d.length; i++) h = (h * 31 + d[i]) | 0;
    return h;
  }

  describe('reel remix: the stage', () => {
    it('the stage is the widest column and its canvas fills the stage width, capped at 70% of the viewport height', async () => {
      await ready();
      const w = (el) => el.getBoundingClientRect().width;
      const stage = $('rm-stage'), canvas = $('rm-canvas');
      expect(w(stage) > w($('rm-bin'))).toBe(true);
      expect(w(stage) > w(doc().querySelector('.rm-side'))).toBe(true);
      const inner = w(stage) - 2 * 14 - 2; // stage padding and border
      expect(Math.abs(w(canvas) - inner) <= 2).toBe(true);
      expect(canvas.getBoundingClientRect().height <= 0.7 * win().innerHeight + 1).toBe(true);
      expect(getComputedStyle(canvas).objectFit).toBe('contain');
    });
    it('files dropped anywhere on the stage are added to the bin', async () => {
      await ready();
      const before = RM().state.items.length;
      const dt = new (win().DataTransfer)();
      dt.items.add((await stills(2))[0]);
      dt.items.add(await still(9));
      ev('dragover', dt, $('rm-canvas'));
      ev('drop', dt, $('rm-canvas'));
      await waitFor(() => RM().state.items.length >= before + 2, { timeout: 20000 });
      expect(RM().state.items.length).toBe(before + 2);
    });
    it('scrubbing paints the frame while paused, and Play carries on from the scrubbed time', async () => {
      await ready();
      if (RM().state.items.length < 4) await addStills(6);
      $('rm-random').checked = false;
      $('rm-target').value = '12';
      $('rm-remix').click();
      const total = RM().state.plan.total;
      const at0 = frameHash();
      const mid = total / 2;
      const scrub = $('rm-scrub');
      scrub.value = String(mid);
      scrub.dispatchEvent(new (win().Event)('input', { bubbles: true }));
      expect(Math.abs(RM().preview.t - mid) < 0.05).toBe(true);
      expect(RM().preview.playing).toBe(false);
      expect(frameHash() !== at0).toBe(true);
      RM().preview.play();
      await waitFor(() => RM().preview.t > mid + 0.2, { timeout: 5000 });
      RM().preview.pause();
      expect(RM().preview.t > mid).toBe(true);
    });
    it('dragging a bin clip onto a cut replaces that slot in that cut', async () => {
      await ready();
      if (RM().state.items.length < 4) await addStills(6);
      $('rm-random').checked = false;
      $('rm-target').value = '8';
      $('rm-remix').click();
      const item = RM().state.items[0];
      const cut = doc().querySelector('#rm-cuts .rm-cut-item');
      const dt = new (win().DataTransfer)();
      dt.setData(RM().ITEM_MIME, item.id);
      ev('dragover', dt, cut);
      ev('drop', dt, cut);
      expect(RM().state.plan.cuts[0].find((x) => x.slot === 0).media).toBe(item.id);
    });
    it('Export records the plan at the preset size and returns a file', async () => {
      await ready();
      if (RM().state.items.length < 4) await addStills(6);
      $('rm-preset').value = 'square';
      change($('rm-preset'));
      $('rm-target').value = '2';
      $('rm-remix').click();
      const out = await RM().exporter.run({ save: false });
      expect(!!out).toBe(true);
      expect(out.blob.size > 0).toBe(true);
    }, { timeout: 90000 });
  });
})();
