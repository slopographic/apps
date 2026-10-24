/* One 3D conversion: read a model (read.js), change its size, axis or parts if asked (scene.js), write it in another
 * format (write.js), and say in plain words what the new format could not keep.
 *   convertModel(files, to, opts) → { files: [{ name, blob }], info: string, stats, bounds }
 * opts: { scale (a factor, 1 keeps the size), up ('keep' | 'z-to-y' | 'y-to-z'), merge (one mesh), binary (STL, PLY),
 *         materials (OBJ: write the MTL file), animations (glTF, GLB: keep them), ask (the decoder notice) }
 * dropped(stats, to, opts) lists what is lost, e.g. ['3 materials', '2 animations']. */
import { readModel } from './read.js';
import { writeModel } from './write.js';
import { stats as statsOf, bounds as boundsOf, transform, bake, merge } from './scene.js';
import { KEEPS, LABEL } from './formats.js';

const n = (k, one, many = one + 's') => `${k.toLocaleString('en')} ${k === 1 ? one : many}`;

/** What the target format drops from a model with these stats. */
export function dropped(s, to, opts = {}) {
  const keep = KEEPS[to] || {};
  const out = [];
  if (s.materials && !keep.materials) out.push(n(s.materials, 'material'));
  else if (s.materials && to === 'obj' && opts.materials === false) out.push(n(s.materials, 'material'));
  if (s.textures && (!keep.textures || (to === 'obj' && opts.materials === false))) out.push(n(s.textures, 'texture'));
  if (s.colors && !keep.colors) out.push('vertex colours');
  if (s.uvs && !keep.uvs) out.push('texture coordinates (UVs)');
  const anim = s.animations && (!keep.animations || opts.merge || opts.animations === false);
  if (anim) out.push(n(s.animations, 'animation'));
  if (s.skinning && (!keep.skinning || opts.merge)) out.push('the skeleton (kept in the pose it stands in)');
  if (s.morphs && (!keep.morphs || opts.merge)) out.push('morph targets (kept in their current shape)');
  if (s.points && !keep.points) out.push(n(s.points, 'point cloud'));
  if (s.lines && !keep.lines) out.push(n(s.lines, 'line object'));
  if (s.lights && !keep.lights) out.push(n(s.lights, 'light'));
  if (s.cameras && !keep.cameras) out.push(n(s.cameras, 'camera'));
  return out;
}

const fmtSize = (v) => +Number(v).toPrecision(4);

/** The status line: what was made, the size, and what was left out. */
function summary(s, b, from, to, lost, notes, warnings) {
  const parts = [`${LABEL[from]} read: ${n(s.meshes, 'mesh', 'meshes')}, ${n(s.triangles, 'triangle')}, ${n(s.vertices, 'vertex', 'vertices')}.`];
  if (b) parts.push(`Size ${b.size.map(fmtSize).join(' × ')} units.`);
  if (lost.length) parts.push(`${LABEL[to]} cannot hold ${lost.join(', ')}, so ${lost.length > 1 ? 'they were' : 'it was'} left out.`);
  if (s.meshes > 1 && (to === 'stl' || to === 'ply')) parts.push(`The ${s.meshes} parts are joined into one ${to === 'stl' ? 'solid' : 'mesh'}.`);
  return [...parts, ...warnings, ...notes].join(' ');
}

export async function convertModel(files, to, opts = {}) {
  const read = await readModel(files, { ask: opts.ask !== false });
  const before = statsOf(read.root, read.animations);
  let root = transform(read.root, { scale: opts.scale, up: opts.up });
  if (opts.merge) {
    const { mergeGeometries } = await import('../../vendor/three/addons/utils/BufferGeometryUtils.js');
    root = merge(bake(root), mergeGeometries);
  }
  const keepAnim = opts.animations !== false && !opts.merge && (to === 'glb' || to === 'gltf');
  const out = await writeModel(root, to, { name: read.name, binary: opts.binary, materials: opts.materials, animations: keepAnim ? read.animations : [] });
  const lost = dropped(before, to, opts);
  const b = boundsOf(root);
  return { files: out.files, info: summary(before, b, read.format, to, lost, out.notes, read.warnings), stats: before, bounds: b, dropped: lost, format: read.format };
}
