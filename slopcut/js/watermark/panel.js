/* SlopCut: the Watermark tab of the bin (the project panel): the site's one watermark panel (shared/watermark/panel.js)
   on the open project's watermark, with SlopCut's on switch, the time range of each layer, and the device default.
   Each change is one undoable step on the project, and the monitor shows it at once (watermark/state.js draws it, the
   same pixels as the export). The panel is built once and then only synced, so a slider drag is not interrupted by the
   bin's re-renders. */
(function () {
  'use strict';
  const SE = window.SE, U = SE.util, WM = SE.watermark, h = U.h;
  const P = WM.panel = {};
  let root = null, panel = null;

  function build() {
    root = h('div', { class: 'wm-panel' }, h('div', { class: 'ins-title' }, SE.icon('sparkle'), h('b', null, 'Watermark')));
    panel = SlopWatermarkPanel.mount(root, {
      value: WM.settings().spec,
      media: { pages: false, time: true },
      onChange: (spec, how) => WM.set({ spec }, how.label || 'Watermark', how.key || 'spec'),
      toggle: { get: () => WM.settings().on, set: (on) => WM.set({ on }, on ? 'Watermark on' : 'Watermark off', 'on'), label: 'Watermark',
        note: (on) => (on ? 'On: shows in the monitor and in every export.' : 'Off: no watermark in the monitor or in exports. Turn it on to add it.') },
      actions: [
        { label: 'Save as device default', title: 'New projects on this device start with this watermark', act: () => { WM.saveDefaults(); SlopUI.toast('Saved as this device’s watermark default'); } },
        { label: 'Use device default', title: 'Copy this device’s default watermark into this project', act: () => WM.useDefaults() },
      ],
    });
    return root;
  }

  /** Renders into the bin's list element. Rebuilt only when another tab has replaced the list's content. */
  P.render = function (list) {
    if (!root || root.parentNode !== list) list.replaceChildren(build());
    panel.set(WM.settings().spec);
  };
  SE.act = SE.act || {};
  SE.act.openWatermark = function () { if (SE.bin) SE.bin.show('watermark'); };
})();
