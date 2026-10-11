/* Slop Vector — ui: context menus for swatches, dock tabs and dock groups (SlopUI menus).
 * Opened by UI.menuForTarget (ctxmenu.js) from a right-click or the Menu key. */
(function () {
  'use strict';
  var SV = window.SV;
  var UI = SV.ui = SV.ui || {}; var $ = UI._p;
  function menu(items, x, y) { return window.SlopUI.menu(items, x, y); }
  /** A swatch: apply it to the fill or the stroke, or delete it. */
  UI.swatchMenu = function (i, x, y) {
    if ($.swatches()[i] === undefined) return null;
    return menu([
      { label: 'Apply as Fill', act: function () { $.applySwatch(i, 'fill'); } },
      { label: 'Apply as Stroke', act: function () { $.applySwatch(i, 'stroke'); } }, '-',
      { label: 'Delete Swatch', act: function () { $.deleteSwatch(i); } }], x, y);
  };
  /** A dock tab: show its panel, or collapse or expand its group. */
  UI.tabMenu = function (tab, x, y) {
    var gid = tab.parentNode.parentNode.id.replace(/^dg-/, ''), folded = !!UI.st.collapsed[gid];
    return menu([
      { label: 'Show ' + tab.textContent, act: function () { UI.showPanel(tab.getAttribute('data-tab')); } },
      { label: folded ? 'Expand Group' : 'Collapse Group', act: function () { UI.setGroupCollapsed(gid, !folded); } }, '-',
      $.mi('window.togglePanels')], x, y);
  };
  /** A dock group's tab bar: collapse or expand the group, show or hide all panels. */
  UI.panelMenu = function (ge, x, y) {
    var gid = ge.id.replace(/^dg-/, ''), folded = !!UI.st.collapsed[gid];
    return menu([
      { label: folded ? 'Expand Group' : 'Collapse Group', act: function () { UI.setGroupCollapsed(gid, !folded); } }, '-',
      $.mi('window.togglePanels')], x, y);
  };
})();
