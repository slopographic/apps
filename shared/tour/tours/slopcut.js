/* SlopTour: SlopCut (the slopcut folder). Targets are ids in slopcut/index.html. The words are in slopcut/i18n (slopedit.tour.*), read when the
   tour shows them, so they follow the chosen language. */
(function () {
  const t = (k) => (globalThis.SlopI18n ? SlopI18n.t(k) : k);
  const step = (id, target) => ({ id, target, get title() { return t('slopedit.tour.' + id); }, get text() { return t('slopedit.tour.' + id + '_text'); } });
  SlopTour.define({
    app: 'slopcut',
    get title() { return t('slopedit.tour.title'); },
    steps: [step('bin', '#bin'), step('monitor', '#monitor'), step('inspector', '#insp'), step('timeline', '#timeline'), step('undo', '#btnUndo'), step('export', '#btnExport')],
  });
})();
