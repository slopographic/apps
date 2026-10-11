/* Slop Drive: face detection for pictures (opt-in, off by default; see shared/faces/). "Find faces" runs the detector on
 * the selected pictures and keeps the result in the shared cache, keyed by the file id and its modified time, so an
 * edited picture is detected again. The details panel shows the count, and Quick look draws the boxes. No names, no
 * identity matching. The first use asks first (SlopFaces.askOptIn). Classic script; adds to window.DR. */
'use strict';
(function (DR) {
  const F = () => window.SlopFaces;

  /** A picture the detector can read: a raster image (not SVG), not a folder, not in the Trash. */
  DR.isFaceable = (r) => !!r && !r.isFolder && !r.trashedAt && DR.kindOf(r) === 'image' && !DR.isSvg(r);
  /** The stamp a result is kept for: the file's modified time (a changed file is detected again). */
  DR.faceStamp = (r) => String(r.modified || r.time || 0);
  /** The stored result for a picture when it is current, else null. */
  DR.facesOf = (r) => (window.SlopFaces ? F().cache.get('drive', r.id, DR.faceStamp(r)) : Promise.resolve(null));
  DR.faceText = (n) => (n === 0 ? 'No faces' : n === 1 ? '1 face' : `${n} faces`);

  /** Runs the detector on the pictures among items and keeps the results. Asks first while the setting is off. */
  DR.findFaces = async function (items) {
    const pics = (items || []).filter(DR.isFaceable);
    if (!pics.length) return DR.toast('Pick a picture to find its faces');
    if (!F()) return DR.toast('Face detection is not available here');
    if (!F().enabled() && !(await F().askOptIn('drive'))) return;
    DR.toast(pics.length === 1 ? 'Finding faces…' : `Finding faces in ${pics.length} pictures…`);
    let found = 0, failed = 0, last = null;
    for (const r of pics) {
      const res = await F().analyse('drive', r.id, DR.faceStamp(r), r.blob);
      if (!res) { failed++; continue; }
      found += res.faces.length; last = { r, n: res.faces.length };
    }
    DR.renderInfo(true);
    if (failed === pics.length) return DR.toast(F().lastError() ? `Faces could not be found: ${F().lastError()}` : 'Faces could not be found in these pictures');
    if (pics.length === 1 && last) return DR.toast(`${DR.faceText(last.n)} in “${last.r.name}”`);
    DR.toast(`${found} ${found === 1 ? 'face' : 'faces'} found in ${pics.length - failed} ${pics.length - failed === 1 ? 'picture' : 'pictures'}`);
  };

  /** Quick look: draws the stored boxes over the picture, while the setting is on. */
  DR.faceOverlayFor = async function (pv, r) {
    if (!F() || !F().enabled() || !DR.isFaceable(r)) return;
    const row = await DR.facesOf(r);
    if (row && row.faces.length) F().drawBoxes(pv, row.faces);
  };
})(window.DR);
