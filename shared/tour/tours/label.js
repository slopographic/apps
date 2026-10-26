/* SlopTour: SlopLabel. Targets are ids in label/index.html. The words are in label/i18n (label.tour.*), read when the
   tour shows them, so they follow the chosen language. */
(function () {
  const t = (k) => (globalThis.SlopI18n ? SlopI18n.t(k) : k);
  const step = (id, target) => ({ id, target, get title() { return t('label.tour.' + id); }, get text() { return t('label.tour.' + id + '_text'); } });
  SlopTour.define({
    app: 'label',
    get title() { return t('label.tour.title'); },
    steps: [step('setup', '#cbLabel'), step('tools', '#toolbox'), step('label', '#workspace'), step('zoom', '#zoomVal'), step('panels', '#dock'), step('print', '#btnPrint')],
  });
})();
