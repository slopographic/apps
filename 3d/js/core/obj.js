/* Slop 3D Wavefront OBJ (pure text). parse(text, name) → an import tree (see ops.importTree): a group with one
 * mesh per 'o' / 'g' object. Faces with more than three corners are fan-triangulated. Missing normals are computed.
 * write(scene) → OBJ text of every visible mesh, in world space (groups and transforms applied).
 * Throws an Error with a readable message on bad input; callers catch it. Sets window.Slop3D.obj. */
(function () {
  'use strict';
  const S = (window.Slop3D = window.Slop3D || {});
  const X = S.xform, M = S.model;
  const MAX_FACES = 2000000;

  function num(t, line) {
    const v = Number(t);
    if (!Number.isFinite(v)) throw new Error(`OBJ line ${line}: "${t}" is not a number`);
    return v;
  }

  function parse(text, name = 'Imported') {
    const V = [], N = [];
    const objs = [];
    let cur = null, faces = 0;
    const start = (label) => { cur = { name: label, pos: [], nrm: [], idx: [], map: new Map(), withN: 0 }; objs.push(cur); };
    const corner = (tok, line) => {
      const [vs, , ns] = tok.split('/');
      let vi = parseInt(vs, 10);
      vi = vi < 0 ? V.length / 3 + vi : vi - 1;
      if (!(vi >= 0 && vi < V.length / 3)) throw new Error(`OBJ line ${line}: vertex ${vs} does not exist`);
      let ni = ns ? parseInt(ns, 10) : NaN;
      if (Number.isFinite(ni)) ni = ni < 0 ? N.length / 3 + ni : ni - 1;
      const hasN = Number.isInteger(ni) && ni >= 0 && ni < N.length / 3;
      const key = vi + '/' + (hasN ? ni : -1);
      let k = cur.map.get(key);
      if (k === undefined) {
        k = cur.pos.length / 3;
        cur.map.set(key, k);
        cur.pos.push(V[vi * 3], V[vi * 3 + 1], V[vi * 3 + 2]);
        if (hasN) { cur.nrm.push(N[ni * 3], N[ni * 3 + 1], N[ni * 3 + 2]); cur.withN++; } else cur.nrm.push(0, 0, 0);
      }
      return k;
    };
    text.split(/\r?\n/).forEach((raw, li) => {
      const line = li + 1, parts = raw.trim().split(/\s+/);
      switch (parts[0]) {
        case 'v': V.push(num(parts[1], line), num(parts[2], line), num(parts[3], line)); break;
        case 'vn': N.push(num(parts[1], line), num(parts[2], line), num(parts[3], line)); break;
        case 'o': case 'g':
          if (!cur || cur.idx.length) start(parts.slice(1).join(' ') || 'Mesh'); else cur.name = parts.slice(1).join(' ') || cur.name;
          break;
        case 'f': {
          if (parts.length < 4) throw new Error(`OBJ line ${line}: a face needs three corners`);
          if (++faces > MAX_FACES) throw new Error('OBJ file has too many faces');
          if (!cur) start(name);
          const c = parts.slice(1).map((t) => corner(t, line));
          for (let t = 1; t < c.length - 1; t++) cur.idx.push(c[0], c[t], c[t + 1]);
          break;
        }
        default: break;
      }
    });
    const children = objs.filter((o) => o.idx.length).map((o) => {
      const withNormals = o.withN === o.pos.length / 3;
      const normals = withNormals ? o.nrm : S.blob.computeNormals(o.pos, o.idx);
      return { type: 'mesh', name: o.name, geom: { kind: 'mesh', positions: o.pos, normals, indices: o.idx } };
    });
    if (!children.length) throw new Error('This OBJ file has no faces');
    return { type: 'group', name, children };
  }

  /** Scene → OBJ text (visible meshes, world space). Mirrored objects keep their faces facing outwards. */
  function write(scene) {
    const lines = ['# Exported from Slop 3D'];
    let offset = 0;
    for (const { id } of M.flatten(scene)) {
      const n = scene.nodes[id];
      if (n.type !== 'mesh' || !S.ops.visibleChain(scene, id)) continue;
      const g = S.geometry.build(n.geom);
      const W = M.worldMatrix(scene, id), NM = X.normalMatrix(W);
      const det = W[0] * (W[5] * W[10] - W[6] * W[9]) - W[4] * (W[1] * W[10] - W[2] * W[9]) + W[8] * (W[1] * W[6] - W[2] * W[5]);
      const count = g.positions.length / 3;
      lines.push(`o ${String(n.name).replace(/[\r\n]+/g, ' ') || 'Mesh'}`);
      for (let i = 0; i < count; i++) {
        const q = X.point(W, g.positions.slice(i * 3, i * 3 + 3));
        lines.push(`v ${+q[0].toFixed(6)} ${+q[1].toFixed(6)} ${+q[2].toFixed(6)}`);
      }
      if (g.normals) for (let i = 0; i < count; i++) {
        const q = X.normalApply(NM, g.normals.slice(i * 3, i * 3 + 3));
        lines.push(`vn ${+q[0].toFixed(6)} ${+q[1].toFixed(6)} ${+q[2].toFixed(6)}`);
      }
      for (let t = 0; t < g.indices.length; t += 3) {
        const tri = [g.indices[t], g.indices[t + 1], g.indices[t + 2]];
        if (det < 0) tri.reverse();
        const ref = (v) => (g.normals ? `${v + offset + 1}//${v + offset + 1}` : `${v + offset + 1}`);
        lines.push(`f ${tri.map(ref).join(' ')}`);
      }
      offset += count;
    }
    return lines.join('\n') + '\n';
  }

  S.obj = { parse, write };
})();
