/* Slop Drive — ui/info-foot: the details panel's main buttons, at its foot (the suite rule, shared/frame/HANDOFF.md: the
 * shared footer, shared/frame/panel.js, on Drive's own panel). One file: Open in <its app> (or Quick look), Download; a
 * folder: Open, Download .zip; something in the trash: Restore, Delete forever; several: Download N items (Restore N in
 * the trash). The other actions (Open in…, Star, Remove metadata…, faces) stay in the panel under the preview. On a phone
 * the closed details sheet still shows these buttons at the bottom of the screen, and "Details" opens the whole sheet.
 * DR.renderFoot() is called by renderInfo (ui/info.js) on every change, the panel open or not. */
'use strict';
(function (DR) {
  let fp = null;
  const btn = (label, run, cls = '', id = '') => {
    const b = DR.el('button', { type: 'button', class: 'btn ' + cls, ...(id ? { id } : {}) }, label);
    b.addEventListener('click', run);
    return b;
  };
  /** The buttons for what is selected (none: no footer). */
  DR.footActs = function (items) {
    if (!items.length) return [];
    if (items.length > 1) {
      if (items.every((r) => r.trashedAt)) return [btn(`Restore ${items.length} items`, () => DR.restore(items), 'primary', 'infoMain')];
      return [btn(`Download ${items.length} items`, () => DR.download(items), 'primary', 'infoMain')];
    }
    const r = items[0];
    if (r.trashedAt) return [btn('Restore', () => DR.restore([r]), 'primary', 'infoMain'), btn('Delete forever', () => DR.purge([r]), 'danger')];
    if (r.isFolder) return [btn('Open', () => DR.open(r), 'primary', 'infoMain'), btn('Download .zip', () => DR.download([r]))];
    const d = DR.orderedAppsFor(r)[0];
    return [d ? btn(`Open in ${d.name}`, () => DR.openWith(r, d.id, { remember: false }), 'primary', 'infoMain') : btn('Quick look', () => DR.quickLook(r), 'primary', 'infoMain'),
      btn('Download', () => DR.download([r]))];
  };
  DR.renderFoot = function () {
    const box = DR.$('info');
    if (!window.SlopFramePanel || !box) return;
    if (!fp) fp = window.SlopFramePanel.create(box, { bare: true });
    fp.footer(DR.footActs(DR.selected()).map((b) => ({ el: b })), { more: 'Details', onMore: () => DR.sheetUI && DR.sheetUI.toggle() });
  };
})(window.DR);
