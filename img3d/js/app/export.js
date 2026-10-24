/* Slop Image to 3D: exports and hand-off. OBJ goes through Slop 3D's own writer (3d/js/core/obj.js), GLB through
 * core/glbwrite.js, and "Open in Slop 3D" puts a .s3d scene in Slop Drive through SlopHub and opens Slop 3D on it.
 * Nothing leaves the device. Classic script, page only. Sets window.SlopImg3D.exporter. */
(function (root) {
  'use strict';
  const ns = (root.SlopImg3D = root.SlopImg3D || {});
  const S3D = 'application/x-slop-3d';

  /** Saves a file: SlopUI.download (shared/slopui.js), the one copy. */
  function download(blob, name) { window.SlopUI.download(blob, name); }

  /** OBJ text of a height-field mesh, written by Slop 3D's writer. */
  function objText(mesh, name) {
    const scene = ns.s3d.sceneOf(mesh, { name });
    return root.Slop3D.obj.write(scene);
  }
  function exportObj(mesh, name) {
    download(new Blob([objText(mesh, name)], { type: 'model/obj' }), name + '.obj');
  }

  /** GLB of a mesh (textured) or a point cloud (coloured). data: the viewer's object from hf.pointCloud / splats. */
  async function exportGlb(item, name, canvas) {
    const opt = { name };
    if (item.kind === 'mesh') {
      Object.assign(opt, { positions: item.positions, normals: item.normals, uv: item.uv, indices: item.indices });
      if (canvas) opt.texture = { bytes: await ns.image.jpegBytes(canvas), mime: 'image/jpeg' };
    } else {
      Object.assign(opt, { positions: item.positions, colors: item.colors, points: true });
    }
    download(new Blob([ns.glb.write(opt)], { type: 'model/gltf-binary' }), name + '.glb');
  }

  /** Puts the mesh in Slop Drive as a .s3d scene and opens Slop 3D on it (SlopHub.sendTo). */
  async function sendTo3d(mesh, name, canvas) {
    const H = root.SlopHub;
    if (!H) throw new Error('Slop Drive is not available in this browser');
    const scene = ns.s3d.sceneOf(mesh, { name, texture: canvas ? ns.image.jpegUrl(canvas) : null });
    const blob = new Blob([JSON.stringify(scene)], { type: S3D });
    return H.sendTo('3d', blob, name + '.s3d');
  }

  ns.exporter = { exportObj, exportGlb, sendTo3d, objText, download };
})(typeof window !== 'undefined' ? window : globalThis);
