/* Slop PDF — ui/context: right-click and keyboard (Menu key / Shift+F10) menus for the page view.
   Targets: page background, annotation, text annotation. The organizer's page and thumbnail menu is
   A.pageMenuItems (ui/actions.js). Every item here calls an existing action (Ed.*, A.*); none
   duplicates logic. Items that do not apply to the target are left out. */
(function () {
  'use strict';
  var SP = window.SP, Ed = SP.editor, A = SP.app, S = Ed._;
  var KEY = function (id) { return A.key(id) || undefined; };
  var isMenuKey = function (e) { return e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10'); };

  /** Item lists per target kind. Each returns SlopUI menu items. */
  var KINDS = {
    page: function () {
      var pid = Ed.pid;
      return [
        Ed.canPaste() ? { label: 'Paste annotation', key: KEY('edit.paste'), act: function () { Ed.paste(); } } : null,
        { label: 'Fit page', key: KEY('view.fit'), act: function () { Ed.fit('fit'); } },
        { label: 'Fit width', key: KEY('view.fitWidth'), act: function () { Ed.fit('width'); } },
        '-',
        { label: 'Rotate page right', key: KEY('pages.rotateRight'), act: function () { A.rotate([pid], 90); } },
        { label: 'Rotate page left', key: KEY('pages.rotateLeft'), act: function () { A.rotate([pid], -90); } },
        { label: 'Duplicate page', key: KEY('pages.duplicate'), act: function () { A.duplicate([pid]); } },
        '-',
        { label: 'Back to all pages', act: function () { A.showGrid(); } },
        { label: 'Delete page', key: KEY('pages.delete'), act: function () { A.remove([pid]); } }
      ];
    },
    annotation: function () {
      var a = Ed.getSelected();
      if (!a) return null;
      return [
        { label: 'Copy', key: KEY('edit.copy'), act: function () { Ed.copy(); } },
        Ed.canPaste() ? { label: 'Paste', key: KEY('edit.paste'), act: function () { Ed.paste(); } } : null,
        { label: 'Duplicate', key: KEY('edit.duplicate'), act: function () { Ed.duplicateSelected(); } },
        { label: 'Deselect', act: function () { Ed.select(null); } },
        '-',
        { label: 'Delete', key: KEY('edit.delete'), act: function () { Ed.deleteSelected(); } }
      ];
    },
    text: function () {
      var rest = KINDS.annotation() || [];
      return [{ label: 'Edit text…', key: KEY('annot.editText'), act: function () { Ed.editSelectedText(); } }, '-'].concat(rest);
    }
  };

  /** Opens the menu for a kind at (x, y). Returns false when the kind has nothing to show. */
  function open(kind, x, y) {
    var items = KINDS[kind]();
    if (!items || !items.length) return false;
    SlopUI.menu(items.filter(function (it) { return it !== null; }), x, y);
    return true;
  }
  /** The kind of the selected annotation: 'text' for text annotations, 'annotation' for the rest. */
  function annotKind() { var a = Ed.getSelected(); return a && a.type === 'text' ? 'text' : 'annotation'; }

  /* right-click on the page view: an annotation under the pointer, else the page itself */
  document.addEventListener('contextmenu', function (e) {
    if (A.mode !== 'page' || !Ed.pid || !S.pageEl || !S.pageEl.contains(e.target)) return;
    e.preventDefault();
    var g = e.target.closest('.annots [data-aid]'), id = g && g.getAttribute('data-aid');
    if (id && Ed.selId !== id) Ed.select(id);
    open(id && Ed.getSelected() ? annotKind() : 'page', e.clientX, e.clientY);
  });

  /* keyboard: Menu key or Shift+F10 on the page view opens the same menu, placed at the selection */
  document.addEventListener('keydown', function (e) {
    if (!isMenuKey(e) || A.mode !== 'page' || !Ed.pid) return;
    var a = document.activeElement;
    if (a && a.closest && a.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (document.querySelector('.sui-menu')) return;
    e.preventDefault();
    var anchor = Ed.getSelected() && S.pageEl.querySelector('.annots [data-aid="' + Ed.selId + '"]');
    var r = (anchor || S.pageEl).getBoundingClientRect();
    open(anchor ? annotKind() : 'page', r.left + 16, r.top + 16);
  });

  Ed.contextKinds = KINDS;
  Ed.openContext = open;
})();
