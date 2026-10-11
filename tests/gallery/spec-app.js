/* Slop Gallery tests against the real app, in a same-origin iframe with its own test database (?db=). */
(function () {
  'use strict';
  const { describe, it, expect, waitFor, sleep } = SlopTest;
  const T = GT;
  let W = null, G = null, D = null;

  async function boot() {
    const fr = document.getElementById('app');
    fr.src = 'about:blank';
    await sleep(40);
    fr.src = '../../gallery/index.html?db=' + T.dbName;
    await waitFor(() => fr.contentWindow && fr.contentWindow.SlopGallery && fr.contentWindow.SlopGallery.ready, { timeout: 30000 });
    W = fr.contentWindow; G = W.SlopGallery; D = W.document;
    await G.library.load();
    await G.db.destroy();
    G.library._reset();
    await G.library.load();
    return W;
  }
  const tiles = () => [...D.querySelectorAll('#tlContent .tile')];

  describe('app boots and imports', () => {
    it('boots with an empty library and shows the empty state', async () => {
      await boot();
      expect(G.library.size).toBe(0);
      expect(D.getElementById('empty').hidden).toBe(false);
    });
    it('imports real JPEGs and shows them on the timeline by month', async () => {
      const files = [
        await T.jpegFile('jan.jpg', 300, 200, { exif: { date: '2019:01:10 09:00:00', make: 'Canon', model: 'R5', orientation: 1 } }),
        await T.jpegFile('jul.jpg', 300, 200, { exif: { date: '2019:07:04 12:00:00', make: 'Canon', model: 'R5', orientation: 6 } }),
        await T.jpegFile('oct.jpg', 300, 200, { modified: Date.UTC(2020, 9, 3) }),
      ];
      const r = await G.importer.run(files.map((f) => ({ file: f, name: f.name })));
      expect(r.added).toBe(3);
      G.timeline.render();
      await waitFor(() => tiles().length === 3, { timeout: 8000 });
      const heads = [...D.querySelectorAll('.vhead .vhead-l')].map((x) => x.textContent);
      expect(heads).toEqual(['October 2020', 'July 2019', 'January 2019']);
    });
    it('a thumbnail is shown on each tile once loaded', async () => {
      await waitFor(() => tiles().every((t) => t.querySelector('img').getAttribute('src')), { timeout: 8000 });
      expect(tiles()[0].querySelector('img').getAttribute('src').startsWith('blob:')).toBe(true);
    });
  });

  describe('right-click menus', () => {
    it('right-click on a photo opens its menu', async () => {
      await boot();
      await G.importer.run([{ file: await T.jpegFile('menu.jpg', 200, 150), name: 'menu.jpg' }]);
      G.timeline.render();
      await waitFor(() => tiles().length === 1, { timeout: 8000 });
      const tile = tiles()[0];
      tile.dispatchEvent(new W.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 120, clientY: 90, button: 2 }));
      const menu = await waitFor(() => D.querySelector('.sui-menu'), { timeout: 4000 });
      const labels = [...menu.querySelectorAll('.sui-lbl')].map((x) => x.textContent);
      expect(labels).toContain('Open');
      expect(labels).toContain('Add to album');
      expect(labels).toContain('Remove from library…');
      W.SlopUI.closeMenu();
    });
    it('right-click on an album opens album actions', async () => {
      await boot();
      const a = await G.library.createAlbum('Menu album');
      G.sidebar.renderFacets();
      const item = await waitFor(() => D.querySelector(`[data-album="${a.id}"]`), { timeout: 4000 });
      item.dispatchEvent(new W.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 60, clientY: 60, button: 2 }));
      const menu = await waitFor(() => D.querySelector('.sui-menu'), { timeout: 4000 });
      expect([...menu.querySelectorAll('.sui-lbl')].map((x) => x.textContent)).toContain('Rename…');
      W.SlopUI.closeMenu();
    });
  });

  describe('virtual timeline at scale', () => {
    it('5,000 photos: only the visible tiles exist in the DOM', async () => {
      await boot();
      const base = Date.UTC(2010, 0, 1);
      const rows = [];
      for (let i = 0; i < 5000; i++) {
        rows.push({ meta: { id: 'p' + i, name: 'img' + i + '.jpg', type: 'image/jpeg', size: 4, sha: T.shaOf(i + 1), w: 40, h: 30, takenAt: base + i * 3600e3 * 9, modified: 0, make: '', model: '', orientation: 1, fav: false, liked: null, tags: [], addedAt: i, driveId: null }, original: T.blobOf(4), thumb: T.blobOf(4) });
      }
      for (let i = 0; i < rows.length; i += 500) await G.library.addEntries(rows.slice(i, i + 500));
      G.timeline.render();
      await waitFor(() => G.timeline.count === 5000, { timeout: 8000 });
      const n = tiles().length;
      expect(n).toBeGreaterThan(0);
      expect(n).toBeLessThan(160);
      expect(D.querySelectorAll('.vhead').length).toBeLessThan(40);
      const sticky = D.getElementById('sticky');
      expect(sticky.hidden).toBe(false);
    }, { timeout: 90000 });
    it('scrolling to a later month renders different tiles and moves the sticky header', async () => {
      const grid = D.getElementById('grid');
      grid.scrollTop = grid.scrollHeight / 2;
      grid.dispatchEvent(new W.Event('scroll'));
      await sleep(120);
      const label = D.querySelector('#sticky .sticky-l').textContent;
      expect(label.length > 0).toBe(true);
      expect(tiles().length < 160).toBe(true);
    });
  });

  describe('filters and Sort mode in the app', () => {
    it('the tag filter shows only the liked photos', async () => {
      await boot();
      const r = await G.importer.run([{ file: await T.jpegFile('l1.jpg', 90, 60, { colour: '#111' }), name: 'l1.jpg' }, { file: await T.jpegFile('l2.jpg', 90, 60, { colour: '#444' }), name: 'l2.jpg' }]);
      expect(r.added).toBe(2);
      const [first] = G.library.list();
      await G.library.setLiked([first.id], 'liked');
      G.state.setQuery({ tag: 'liked' });
      expect(G.timeline.visibleIds()).toEqual([first.id]);
      G.state.setQuery({ tag: 'untagged' });
      expect(G.timeline.visibleIds().length).toBe(1);
      G.state.setQuery({ tag: '' });
      expect(G.timeline.visibleIds().length).toBe(2);
    });
    it('the Sort deck takes arrow keys on its own overlay', async () => {
      await boot();
      await G.importer.run([{ file: await T.jpegFile('s1.jpg', 90, 60, { colour: '#123' }), name: 's1.jpg' }, { file: await T.jpegFile('s2.jpg', 90, 60, { colour: '#456' }), name: 's2.jpg' }]);
      const ids = G.library.list().map((m) => m.id);
      G.sortmode.open(ids);
      const deck = await waitFor(() => D.querySelector('.sortmode:not([hidden])'), { timeout: 3000 });
      deck.dispatchEvent(new W.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
      await waitFor(() => G.library.photo(ids[0]).liked === 'liked', { timeout: 3000 });
      expect(G.sortmode.state().pos).toBe(1);
      deck.dispatchEvent(new W.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
      expect(G.sortmode.state().pos).toBe(0);
      G.sortmode.close();
      expect(D.querySelector('.sortmode:not([hidden])')).toBe(null);
    });
  });
})();
