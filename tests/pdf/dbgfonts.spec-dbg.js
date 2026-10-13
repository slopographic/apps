(function () {
  'use strict';
  const { describe, it, expect, waitFor } = SlopTest;
  const doc = () => PT.win.document;
  describe('dbg', () => {
    it('dump prompt', async () => {
      if (!PT.SP) await PT.boot();
      PT.reset();
      const bytes = await PT.barlowPdf('hello world');
      await PT.open(bytes, 'barlow.pdf');
      const f = Array.from(PT.E.files.values())[0];
      const info = { hasDoc: !!f.doc, fontMap: f.fontMap ? [...f.fontMap.entries()] : null, fontCheck: !!f.fontCheck };
      PT.A.openPage(PT.E.state.pages[0].id);
      await waitFor(() => doc().querySelector('.pv-textlayer span'), { timeout: 8000 });
      const scanned = await PT.SP.editor._.scanFonts(f);
      info.scan = [...scanned.values()].map((x) => [x.family, x.subset, x.std]);
      const C = PT.win.SlopFontCatalog;
      info.installed = await C.hasFamily('Barlow');
      info.closest = C.closestFamily('Barlow');
      throw new Error('DBG ' + JSON.stringify(info));
    });
  });
})();
