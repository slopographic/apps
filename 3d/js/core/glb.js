/* Slop 3D glTF 2.0 import (pure). Reads .glb (binary) and .gltf (JSON whose buffers are embedded as data: URIs).
 * importGltf(input) → { tree, warnings }, where tree is an import tree (see ops.importTree).
 * Supports triangle primitives (mode 4) with POSITION, NORMAL and indices, the node hierarchy (matrix or TRS) and
 * baseColorFactor / metallic / roughness for the material. Other modes and external files are reported in warnings.
 * Throws an Error with a readable message for files it cannot read. Sets window.Slop3D.glb. */
(function () {
  'use strict';
  const S = (window.Slop3D = window.Slop3D || {});
  const X = S.xform;
  const SIZE = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
  const NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  const READ = {
    5120: (d, o) => d.getInt8(o), 5121: (d, o) => d.getUint8(o), 5122: (d, o) => d.getInt16(o, true),
    5123: (d, o) => d.getUint16(o, true), 5125: (d, o) => d.getUint32(o, true), 5126: (d, o) => d.getFloat32(o, true),
  };

  /** Splits a GLB container into its JSON and BIN chunks. */
  function parseGlb(buf) {
    const dv = new DataView(buf);
    if (buf.byteLength < 20 || dv.getUint32(0, true) !== 0x46546c67) throw new Error('This is not a GLB file');
    if (dv.getUint32(4, true) !== 2) throw new Error('Only glTF 2.0 is supported');
    const total = Math.min(dv.getUint32(8, true), buf.byteLength);
    let off = 12, json = null, bin = null;
    while (off + 8 <= total) {
      const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
      const body = buf.slice(off + 8, off + 8 + len);
      if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(body));
      else if (type === 0x004e4942 && !bin) bin = body;
      off += 8 + len;
    }
    if (!json) throw new Error('The GLB file has no JSON part');
    return { json, bin };
  }
  /** Decodes a base64 data: URI into an ArrayBuffer. */
  function dataUri(uri) {
    const m = /^data:[^,]*;base64,(.*)$/s.exec(uri || '');
    if (!m) throw new Error('External files are not supported: embed the buffers in the .gltf, or use .glb');
    const bin = atob(m[1]), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }
  function loadBuffers(json, glbBin) {
    return (json.buffers || []).map((b, i) => {
      if (!b.uri) { if (i === 0 && glbBin) return glbBin; throw new Error('A buffer has no data'); }
      return dataUri(b.uri);
    });
  }
  /** Reads an accessor into a flat plain array of numbers. */
  function readAccessor(json, buffers, idx) {
    const acc = json.accessors[idx];
    if (!acc) throw new Error('accessor ' + idx + ' is missing');
    const bv = json.bufferViews[acc.bufferView];
    const comps = NCOMP[acc.type], size = SIZE[acc.componentType];
    if (!bv || !comps || !size) throw new Error('unsupported accessor ' + idx);
    const buf = buffers[bv.buffer];
    if (!buf) throw new Error('buffer ' + bv.buffer + ' is missing');
    const dv = new DataView(buf, (bv.byteOffset || 0) + (acc.byteOffset || 0));
    const stride = bv.byteStride || comps * size, out = new Array(acc.count * comps);
    for (let i = 0; i < acc.count; i++) for (let c = 0; c < comps; c++) {
      out[i * comps + c] = READ[acc.componentType](dv, i * stride + c * size);
    }
    return out;
  }
  const hex = (c) => '#' + c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('');

  function materialOf(json, i) {
    const m = json.materials && json.materials[i];
    const pbr = (m && m.pbrMetallicRoughness) || {};
    const f = pbr.baseColorFactor || [0.8, 0.8, 0.8, 1];
    return { color: hex(f), roughness: pbr.roughnessFactor ?? 0.55, metallic: pbr.metallicFactor ?? 0, opacity: f[3] ?? 1 };
  }

  /** Mesh index → list of mesh children (one per triangle primitive). */
  function meshChildren(json, buffers, mi, warnings) {
    const out = [];
    (json.meshes[mi].primitives || []).forEach((p, k) => {
      const label = `mesh ${mi} primitive ${k}`;
      if ((p.mode ?? 4) !== 4) { warnings.push(`${label} is not a triangle list, skipped`); return; }
      if (p.attributes.POSITION === undefined) { warnings.push(`${label} has no positions, skipped`); return; }
      const positions = readAccessor(json, buffers, p.attributes.POSITION);
      const normals = p.attributes.NORMAL !== undefined ? readAccessor(json, buffers, p.attributes.NORMAL) : null;
      const count = positions.length / 3;
      const indices = p.indices !== undefined ? readAccessor(json, buffers, p.indices) : Array.from({ length: count }, (_, i) => i);
      if (indices.length % 3 || indices.some((v) => v >= count)) { warnings.push(`${label} has bad indices, skipped`); return; }
      out.push({ type: 'mesh', name: (json.meshes[mi].name || 'Mesh') + (k ? ' ' + (k + 1) : ''), material: p.material !== undefined ? materialOf(json, p.material) : undefined,
        geom: { kind: 'mesh', positions, normals: normals || S.blob.computeNormals(positions, indices), indices } });
    });
    return out;
  }

  /** A glTF node → group transform + children (its mesh primitives and child nodes). */
  function nodeTree(json, buffers, ni, warnings, seen) {
    if (seen.has(ni)) throw new Error('the node hierarchy loops');
    seen.add(ni);
    const nd = json.nodes[ni];
    let transform;
    if (nd.matrix) transform = X.decompose(nd.matrix);
    else {
      const m = X.mul(X.fromTRS(nd.translation || [0, 0, 0], [0, 0, 0], [1, 1, 1]), X.mul(X.fromQuat(nd.rotation || [0, 0, 0, 1]), X.fromTRS([0, 0, 0], [0, 0, 0], nd.scale || [1, 1, 1])));
      transform = X.decompose(m);
    }
    const children = nd.mesh !== undefined ? meshChildren(json, buffers, nd.mesh, warnings) : [];
    for (const c of nd.children || []) children.push(nodeTree(json, buffers, c, warnings, seen));
    return { type: 'group', name: nd.name || 'Node', transform, children };
  }

  /** Accepts an ArrayBuffer (GLB) or a string (glTF JSON). */
  function importGltf(input) {
    let json, glbBin = null;
    if (typeof input === 'string') json = JSON.parse(input);
    else ({ json, bin: glbBin } = parseGlb(input));
    if (!json.asset || String(json.asset.version).split('.')[0] !== '2') throw new Error('Only glTF 2.0 is supported');
    const buffers = loadBuffers(json, glbBin);
    const warnings = [];
    const scene = json.scenes ? json.scenes[json.scene || 0] : null;
    let roots = scene ? scene.nodes || [] : null;
    if (!roots) {
      const kids = new Set((json.nodes || []).flatMap((n) => n.children || []));
      roots = (json.nodes || []).map((_, i) => i).filter((i) => !kids.has(i));
    }
    const seen = new Set();
    const children = roots.map((ni) => nodeTree(json, buffers, ni, warnings, seen));
    if (!children.length) throw new Error('The glTF file has no objects');
    return { tree: { type: 'group', name: 'glTF', children }, warnings };
  }

  S.glb = { importGltf, parseGlb };
})();
