/* Slop PDF — layer commands: hide or show, lock or unlock, move up or down, delete. Each one is an undoable step
   (E.commit), so History and the saved edit log see them like any other edit. The pure state changes are in
   core/layers.js. Classic script. */
(function () {
  'use strict';
  var SP = window.SP, E = SP.engine, Ed = SP.editor, L = SP.layers;

  /** Sets 'hidden' or 'locked' on one layer. Hiding the selected layer clears the selection. */
  L.set = function (pid, aid, key, val) {
    var label = key === 'hidden' ? (val ? 'Hide layer' : 'Show layer') : (val ? 'Lock layer' : 'Unlock layer');
    E.commit(label, function (st) { L.setFlag(st, pid, aid, key, val); });
    if (key === 'hidden' && val && Ed.selId === aid) Ed.select(null);
  };
  /** Moves a layer up (+1, towards the top of the stack) or down (-1). */
  L.moveLayer = function (pid, aid, dir) {
    E.commit(dir > 0 ? 'Move layer up' : 'Move layer down', function (st) { L.move(st, pid, aid, dir); });
  };
  /** Deletes a layer. */
  L.deleteLayer = function (pid, aid) {
    E.commit('Delete layer', function (st) { L.remove(st, pid, aid); });
    if (Ed.selId === aid) Ed.select(null);
  };
})();
