/* SlopVector — tools: clipping masks (Object ▸ Make Clipping Mask, Object ▸ Release Clipping Mask).
   Make: the topmost selected object is the clip shape. It clips the other selected objects below it in the same
   stack; with one object selected it clips every sibling below it. One undo step. Release: each selected clipping
   mask becomes its objects again (the shape stays on top). Tree logic: core/clipmask.js. */
(function () {
  'use strict';
  var SV = window.SV, S = SV.state, CM = SV.clipMask, C = SV.cmd = SV.cmd || {};

  /** The editable selected ids, topmost last. */
  function selIds() { return SV.zSorted(S.sel.filter(function (id) { var o = SV.getObj(id); return o && SV.isEditable(o); })); }

  C.makeClip = function () {
    var ids = selIds();
    if (!ids.length) return SV.toast('Select the shape to clip with, and the objects below it');
    var top = SV.find(ids[ids.length - 1]);
    if (!top) return;
    var sameStack = ids.filter(function (id) { var f = SV.find(id); return f && f.arr === top.arr; });
    var plan = CM.plan(top.arr, sameStack);
    if (!plan) return SV.toast('Nothing below the clip shape in its stack');
    var g = CM.apply(top.arr, plan, function (kids) { return SV.mk.group(kids, 'Clipping mask'); });
    SV.select([g.id]);
    SV.commit('make clipping mask');
  };
  C.releaseClip = function () {
    var out = [], any = false;
    selIds().forEach(function (id) {
      var f = SV.find(id);
      if (!f || !CM.isClip(f.obj)) return;
      any = true;
      CM.release(f.arr, f.idx).forEach(function (k) { out.push(k.id); });
    });
    if (!any) return SV.toast('Select a clipping mask to release');
    SV.select(out);
    SV.commit('release clipping mask');
  };
  /** Enabled checks for the menu and shortcuts. */
  C.canMakeClip = function () { return selIds().length > 0; };
  C.canReleaseClip = function () { return selIds().some(function (id) { return CM.isClip(SV.getObj(id)); }); };
})();
