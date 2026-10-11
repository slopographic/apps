/* Slop Image to 3D: GLB 2.0 writer (binary glTF) for one mesh or point cloud. Pure. Sets window.SlopImg3D.glb.
 * write({ positions, normals?, uv?, colors?, indices?, points?, name, texture? }) → ArrayBuffer.
 *   positions Float32 xyz; normals Float32 xyz; uv Float32 uv; colors Float32 rgb (0..1) → COLOR_0;
 *   indices Uint32 (triangles); points: true writes POINTS (mode 0) with no indices.
 *   texture: { bytes: ArrayBuffer, mime: 'image/png' | 'image/jpeg' } used as the base colour map (needs uv). */
(function (root) {
  'use strict';
  const ns = (root.SlopImg3D = root.SlopImg3D || {});

  function write(o) {
    const chunks = [];
    let total = 0;
    const views = [], accessors = [], attrs = {};
    /** Appends bytes to the binary chunk, 4-byte aligned, and returns the bufferView index. */
    const addView = (bytes, target) => {
      const pad = (4 - (total % 4)) % 4;
      if (pad) { chunks.push(new Uint8Array(pad)); total += pad; }
      const v = { buffer: 0, byteOffset: total, byteLength: bytes.byteLength };
      if (target) v.target = target;
      chunks.push(new Uint8Array(bytes.buffer || bytes, bytes.byteOffset || 0, bytes.byteLength));
      total += bytes.byteLength;
      views.push(v);
      return views.length - 1;
    };
    const addAccessor = (view, componentType, count, type, extra = {}) => {
      accessors.push(Object.assign({ bufferView: view, componentType, count, type }, extra));
      return accessors.length - 1;
    };
    const ARRAY_BUFFER = 34962, ELEMENT_ARRAY_BUFFER = 34963, FLOAT = 5126, UINT32 = 5125;
    const pos = o.positions, vc = pos.length / 3;
    const minmax = [[Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]];
    for (let i = 0; i < pos.length; i++) { const k = i % 3; minmax[0][k] = Math.min(minmax[0][k], pos[i]); minmax[1][k] = Math.max(minmax[1][k], pos[i]); }
    attrs.POSITION = addAccessor(addView(pos, ARRAY_BUFFER), FLOAT, vc, 'VEC3', { min: minmax[0], max: minmax[1] });
    if (o.normals) attrs.NORMAL = addAccessor(addView(o.normals, ARRAY_BUFFER), FLOAT, vc, 'VEC3');
    if (o.colors) attrs.COLOR_0 = addAccessor(addView(o.colors, ARRAY_BUFFER), FLOAT, vc, 'VEC3');
    if (o.uv) attrs.TEXCOORD_0 = addAccessor(addView(o.uv, ARRAY_BUFFER), FLOAT, vc, 'VEC2');
    const prim = { attributes: attrs, material: 0, mode: o.points ? 0 : 4 };
    if (!o.points) prim.indices = addAccessor(addView(o.indices, ELEMENT_ARRAY_BUFFER), UINT32, o.indices.length, 'SCALAR');
    const material = { name: 'Image', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.9 }, doubleSided: true };
    const json = { asset: { version: '2.0', generator: 'Slop Image to 3D' }, scene: 0, scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0, name: String(o.name || 'Image to 3D').slice(0, 80) }], meshes: [{ name: 'Image', primitives: [prim] }], materials: [material] };
    if (o.texture && o.uv) {
      const img = addView(new Uint8Array(o.texture.bytes));
      json.images = [{ bufferView: img, mimeType: o.texture.mime }];
      json.textures = [{ source: 0 }];
      material.pbrMetallicRoughness.baseColorTexture = { index: 0 };
    }
    const bin = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { bin.set(c, off); off += c.byteLength; }
    json.bufferViews = views; json.accessors = accessors; json.buffers = [{ byteLength: total }];
    const raw = new TextEncoder().encode(JSON.stringify(json));
    const jsonBytes = new Uint8Array(Math.ceil(raw.byteLength / 4) * 4).fill(0x20);
    jsonBytes.set(raw);
    const bin4 = bin.byteLength % 4 ? Math.ceil(bin.byteLength / 4) * 4 : bin.byteLength;
    const out = new ArrayBuffer(12 + 8 + jsonBytes.byteLength + (bin4 ? 8 + bin4 : 0));
    const dv = new DataView(out), u8 = new Uint8Array(out);
    dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, out.byteLength, true);
    dv.setUint32(12, jsonBytes.byteLength, true); dv.setUint32(16, 0x4e4f534a, true); u8.set(jsonBytes, 20);
    let at = 20 + jsonBytes.byteLength;
    if (bin4) { dv.setUint32(at, bin4, true); dv.setUint32(at + 4, 0x004e4942, true); u8.set(bin, at + 8); }
    return out;
  }

  ns.glb = { write };
})(typeof window !== 'undefined' ? window : globalThis);
