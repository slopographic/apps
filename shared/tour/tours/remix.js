/* SlopTour: Reel Remix. Targets are ids in remix/index.html. The words are in remix/i18n (remix.tour.*), read when
   the tour shows them, so they follow the chosen language. */
(function () {
  const t = (k) => (globalThis.SlopI18n ? SlopI18n.t(k) : k);
  const step = (id, target) => ({ id, target, get title() { return t('remix.tour.' + id); }, get text() { return t('remix.tour.' + id + '_text'); } });
  SlopTour.define({
    app: 'remix',
    get title() { return t('remix.tour.title'); },
    steps: [step('clips', '#rm-drop'), step('preview', '#rm-stage'), step('keys', '#rm-keys'), step('layout', '#rm-base'), step('export', '#rm-export'), step('config', '#rm-config')],
  });
})();
