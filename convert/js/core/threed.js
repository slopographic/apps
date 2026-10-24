/* The 3D model conversions of File convert. The reading, writing and the drop report are the shared 3D I/O module's
 * (shared/3d-io, built on the three.js loaders and exporters), the same one Slop 3D opens and exports with, loaded
 * only when a 3D conversion runs. Each entry takes the model formats in `from` and, beside them, the files a model
 * can come with (`with`: an OBJ's .mtl, a glTF's .bin, textures), which are found by name and never converted alone.
 * The runs are 'combine': every model among the files gives its own output, with the companions shared. */
const IN = ['obj', 'stl', 'ply', 'gltf', 'glb', '3mf', 'dae', 'fbx'];
const WITH = ['mtl', 'bin', 'png', 'jpg', 'webp', 'gif', 'bmp', 'tga', 'ktx2'];
export const MODEL_KINDS = IN;
export const COMPANION_KINDS = WITH;

const UNITS = { key: 'units', type: 'select', label: 'Units', value: '1', options: [
  ['1', 'Keep the size'], ['1000', 'Metres to millimetres (× 1000)'], ['0.001', 'Millimetres to metres (× 0.001)'],
  ['10', 'Centimetres to millimetres (× 10)'], ['0.01', 'Centimetres to metres (× 0.01)'],
  ['25.4', 'Inches to millimetres (× 25.4)'], ['0.0254', 'Inches to metres (× 0.0254)']],
  hint: 'Most formats have no unit: a 3D printer reads STL and 3MF numbers as millimetres, glTF and USDZ as metres.' };
const SCALE = { key: 'scale', type: 'number', label: 'Extra scale factor', min: 0, max: 1000000, placeholder: '1', hint: 'Blank keeps 1. Multiplies on top of the units.' };
const UP = { key: 'up', type: 'select', label: 'Up axis', value: 'keep', options: [['keep', 'Keep as it is'], ['z-to-y', 'Z up to Y up (STL, 3MF and CAD to glTF)'], ['y-to-z', 'Y up to Z up (glTF to STL, 3MF and CAD)']] };
const MERGE = { key: 'merge', type: 'checkbox', label: 'Merge all meshes into one', value: false, hint: 'One mesh, with each material kept as a part. Animations are left out.' };
const ENCODING = { key: 'encoding', type: 'select', label: 'Encoding', value: 'binary', options: [['binary', 'Binary (small)'], ['ascii', 'ASCII text']] };
const MATERIALS = { key: 'materials', type: 'checkbox', label: 'Write materials (an .mtl file and textures)', value: true };
const ANIMATIONS = { key: 'animations', type: 'checkbox', label: 'Keep animations', value: true };

let io = null;
const load = () => (io ??= import('../../../shared/3d-io/convert.js'));

/** One conversion run for every model among the files. A model that fails is reported; all failing throws. */
function to(format) {
  return async (files, o = {}) => {
    const { convertModel } = await load();
    const models = files.filter((f) => IN.includes(f.kind));
    const others = files.filter((f) => !IN.includes(f.kind));
    if (!models.length) throw new Error('Add the model file itself (OBJ, STL, PLY, glTF, GLB, 3MF, DAE or FBX), not only its textures or .mtl.');
    const out = [], info = [], failed = [];
    const scale = (Number(o.units) || 1) * (Number(o.scale) > 0 ? Number(o.scale) : 1);
    for (const m of models) {
      try {
        const r = await convertModel([m, ...others].map((f) => ({ name: f.name, blob: f.file })), format, {
          scale, up: o.up || 'keep', merge: !!o.merge, binary: o.encoding !== 'ascii', materials: o.materials !== false, animations: o.animations !== false });
        out.push(...r.files);
        info.push(models.length > 1 ? `${m.name}: ${r.info}` : r.info);
      } catch (e) {
        failed.push(`${m.name}: ${(e && e.message) || e}`);
      }
    }
    if (!out.length) throw new Error(failed.join(' '));
    out.info = [...info, ...failed.map((f) => `Not converted: ${f}`)].join(' ');
    return out;
  };
}

const entry = (format, label, options) => ({ id: `3d-to-${format}`, label, group: '3D models', from: IN, with: WITH, ext: format, mode: 'combine', options, run: to(format) });

export const THREED = [
  entry('stl', 'To STL (3D printing)', [ENCODING, UNITS, SCALE, UP]),
  entry('obj', 'To OBJ', [MATERIALS, MERGE, UNITS, SCALE, UP]),
  entry('glb', 'To GLB (binary glTF)', [ANIMATIONS, MERGE, UNITS, SCALE, UP]),
  entry('gltf', 'To glTF (one .gltf file)', [ANIMATIONS, MERGE, UNITS, SCALE, UP]),
  entry('ply', 'To PLY', [ENCODING, UNITS, SCALE, UP]),
  entry('usdz', 'To USDZ (Apple AR)', [MERGE, UNITS, SCALE, UP]),
];
