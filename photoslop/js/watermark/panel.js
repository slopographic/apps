/* PhotoSlop watermark panel: the site's one watermark panel (shared/watermark/panel.js) on the open document's watermark,
 * with PhotoSlop's on switch and its device default. Every change is live: the page preview repaints at once and the next
 * export uses the same watermark. */
'use strict';

function buildWatermarkPanel() {
  const host = h('div', { class: 'ps-wm' });
  const panel = SlopWatermarkPanel.mount(host, {
    value: wmState().spec,
    onChange: (spec) => wmSetSpec(spec),
    toggle: { get: wmOn, set: wmSetOn, label: 'Watermark on', note: (on) => (on ? 'On: added to exports and shown on the page.' : 'Off: exports and the page show no watermark.') },
    actions: [
      { label: 'Save as default', title: 'New documents on this device start with this watermark (switched off)', act: () => wmSaveDefaults() },
      { label: 'Reset to default', title: 'Back to this device’s default watermark', act: () => wmResetStyle() },
    ],
  });
  // the document's watermark: after an undo, a tab switch or opening a file
  listeners.add((w) => { if (w === 'watermark' || w === 'doc' || w === 'docname') panel.set(wmState().spec); });
  return host;
}
