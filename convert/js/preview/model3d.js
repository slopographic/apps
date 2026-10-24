/* The 3D model panels of the live preview: the input model and the converted one, each read back and drawn in 3D by
 * the shared 3D I/O module (shared/3d-io: read.js and viewer.js), with its counts and size underneath. Reading the
 * output back shows the file as another program would see it. USDZ has no reader here, so it shows its size only.
 * Browser only; loaded by model.js and view.js. */
import { KIND_LABEL } from '../core/detect.js';
import { MODEL_KINDS } from '../core/threed.js';
import { h } from '../ui/dom.js';

export const is3d = (conv) => !!conv && /^3d-to-/.test(conv.id);
const extOf = (name) => (/\.([^.]+)$/.exec(String(name)) || [, ''])[1].toLowerCase();

/** The before panel: every input file goes in, so a .gltf finds its .bin and an .obj its .mtl. */
export function modelBefore(inputs) {
  const model = inputs.find((i) => MODEL_KINDS.includes(i.kind)) || inputs[0];
  const others = inputs.length - 1;
  return { kind: 'model', files: inputs.map((i) => ({ name: i.name, blob: i.file })), size: model.size,
    label: `${KIND_LABEL[model.kind] || '3D model'}${others ? `, with ${others} more file${others > 1 ? 's' : ''}` : ''}` };
}

/** The after panel: the written files (an OBJ with its .mtl and textures counts as one model). */
export function modelAfter(outs) {
  const main = outs[0], ext = extOf(main.name);
  const label = `${ext.toUpperCase()}${outs.length > 1 ? `, with ${outs.length - 1} more file${outs.length > 2 ? 's' : ''}` : ''}`;
  const note = outs.info || '';   // the drop report from the run (what the format could not hold)
  if (ext === 'usdz') return { kind: 'info', text: 'USDZ file, ready. Open it on an iPhone or iPad (AR Quick Look) to see it.', size: main.blob.size, label, note };
  return { kind: 'model', files: outs.map((o) => ({ name: o.name, blob: o.blob })), size: main.blob.size, label, note };
}

let io = null;
const load = () => (io ??= Promise.all([import('../../../shared/3d-io/read.js'), import('../../../shared/3d-io/viewer.js')]));

/** Fills a preview panel with the 3D view. Returns a cleanup function (the panel calls it before its next fill). */
export function fillModel(pn, p) {
  const stage = h('div', { class: 'cv-pv-3d' });
  const cap = h('p', { class: 'cv-hint', text: 'Reading the model…' });
  pn.body.replaceChildren(stage, cap);
  let viewer = null, gone = false;
  (async () => {
    try {
      const [{ readModel }, { view, describe }] = await load();
      const r = await readModel(p.files);
      if (gone) return;
      cap.textContent = describe(r.root, r.animations);
      try { viewer = view(stage, r.root); } catch (e) {
        stage.replaceChildren(h('p', { class: 'cv-hint', text: 'This browser cannot draw 3D (no WebGL), so the model is not shown. The conversion still works.' }));
      }
      if (gone && viewer) viewer.dispose();
    } catch (e) {
      if (!gone) pn.body.replaceChildren(h('p', { class: 'cv-pv-error', role: 'alert', text: (e && e.message) || String(e) }));
    }
  })();
  return () => { gone = true; if (viewer) viewer.dispose(); };
}
