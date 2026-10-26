/* SlopTour: Slop Effects. Targets are ids in effects/index.html. The words are in effects/i18n (effects.tour.*), read when the
   tour shows them, so they follow the chosen language. */
(function () {
  const t = (k) => (globalThis.SlopI18n ? SlopI18n.t(k) : k);
  const step = (id, target) => ({ id, target, get title() { return t('effects.tour.' + id); }, get text() { return t('effects.tour.' + id + '_text'); } });
  SlopTour.define({
    app: 'effects',
    get title() { return t('effects.tour.title'); },
    steps: [step('preview', '#fx-view'), step('composition', '#fx-comp'), step('layer', '#fx-layer'), step('timeline', '#fx-timeline'), step('panel', '#fx-panel'), step('render', '#fx-render')],
  });
})();
