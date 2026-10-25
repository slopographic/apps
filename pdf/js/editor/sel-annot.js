/* Slop PDF — the actions of a selected annotation, for the selection bar (sel-bar.js): Edit (its text, for text boxes,
   callouts, steps and paragraph frames), Colour (the colour that annotation type has: a highlight's or a text's colour, a
   shape's outline, a box's fill), Opacity, Comment (a comment beside it), Duplicate and Delete. Each is one undo step
   through the editor's own commands (annots.js Ed.setProp, Ed.duplicateSelected, Ed.deleteSelected), the same ones the
   Edit panel, the menus and the keys use. Classic script. */
(function () {
  'use strict';
  var SP = window.SP, E = SP.engine, Ed = SP.editor, S = Ed._;
  var N = S.annotAct = {};
  var EDITABLE = { text: 1, callout: 1, step: 1, para: 1 };
  // the property the bar's Colour sets, per annotation type (none: an image, a signature, a comment, a redaction mark)
  var COLOUR = { text: 'color', callout: 'color', texthl: 'color', para: 'color', pen: 'color', marker: 'color', line: 'color', arrow: 'color',
    rect: 'color', ellipse: 'color', hlbox: 'fill', whiteout: 'fill', step: 'fill' };
  var NAMES = { text: 'Text box', callout: 'Callout', step: 'Step', para: 'Paragraph', texthl: 'Text highlight', pen: 'Drawing', marker: 'Highlighter',
    line: 'Line', arrow: 'Arrow', rect: 'Rectangle', ellipse: 'Ellipse', hlbox: 'Highlight box', whiteout: 'Whiteout', image: 'Image', redact: 'Redaction mark' };

  /** The selected annotation the bar acts on: selected, shown, unlocked and not being typed in; else null. */
  N.target = function () {
    var a = Ed.getSelected ? Ed.getSelected() : null;
    if (!a || a.hidden || a.type === 'note' || (SP.layers && SP.layers.isLocked(a)) || (S.editing && S.editing.id === a.id)) return null;
    return a;
  };
  N.name = function (a) { return a.sig ? 'Signature' : a.stamp ? 'Stamp' : NAMES[a.type] || 'Annotation'; };
  N.canEdit = function (a) { return !!a && EDITABLE[a.type] === 1; };
  N.colourKey = function (a) { return a ? COLOUR[a.type] || null : null; };
  N.colour = function (a) { var k = N.colourKey(a); return k && a[k] && a[k] !== 'none' ? a[k] : '#ffe14d'; };
  N.canOpacity = function (a) { return !!a && a.type !== 'whiteout' && a.type !== 'redact'; };
  N.opacity = function (a) { return a.opacity == null ? 1 : a.opacity; };

  N.edit = function () { return Ed.editSelectedText(); };
  N.setColour = function (col) { var a = N.target(), k = N.colourKey(a); if (k) Ed.setProp(k, col); };
  N.setOpacity = function (v) { if (N.canOpacity(N.target())) Ed.setProp('opacity', v); };
  N.duplicate = function () { if (N.target()) Ed.duplicateSelected(); };
  N.remove = function () { if (N.target()) Ed.deleteSelected(); };
  /** A comment beside the annotation: the comment composer at its top-right corner. */
  N.comment = function () {
    var a = N.target(), p = Ed.page();
    if (!a || !p) return;
    var c = S.ctx(), r = E.annotViewRect(a, c.R, c.W, c.H), pt = E.toPage(c.R, c.W, c.H, r.x + r.w, r.y);
    Ed.select(null);
    Ed.setTool('note');
    Ed.noteUI.compose(p, pt);
  };
  /** The annotation's box on screen (client px), from its selection box on the overlay. */
  N.box = function () {
    var el = S.overlay && S.overlay.querySelector('.sel-box');
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  };
})();
