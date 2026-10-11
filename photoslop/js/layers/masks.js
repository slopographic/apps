/* PhotoSlop layer masks and clipping masks: the operations behind the Layer menu, the layers
 * panel and the layer right-click menu. A mask is { canvas, x, y, def, enabled }: the canvas alpha
 * is how much of the layer shows (black paint hides, white reveals), and def = true means the
 * area outside the canvas is hidden (Hide All), false means revealed (Reveal All). Every change
 * here is one history step. */
'use strict';

/** Layer ▸ Layer Mask ▸ Invert Mask: swaps shown and hidden. Outside the canvas flips with def. */
function invertMask(id) {
  const L = D.layers.find((l) => l.id === id);
  if (!L || !L.mask) return;
  const m = L.mask, c = copyCanvas(m.canvas), g = cxr(c);
  const img = g.getImageData(0, 0, c.width, c.height), d = img.data;
  for (let i = 3; i < d.length; i += 4) d[i] = 255 - d[i];
  g.putImageData(img, 0, 0);
  setLayerProps(id, { mask: Object.assign({}, m, { canvas: c, def: !m.def }) }, 'Invert Mask');
}

/** Clipping mask on/off: a clipped layer shows only where the layer below it is opaque. */
function setClipping(id, on) {
  const i = layerIndex(id);
  if (i < 0) return;
  const L = D.layers[i];
  if (!!L.clip === !!on) return;
  if (on && i === 0) { toast('The bottom layer has no layer below to clip to'); return; }
  if (L.locked && on) { toast('That layer is locked'); return; }
  setLayerProps(id, { clip: on ? true : false }, on ? 'Create Clipping Mask' : 'Release Clipping Mask');
}
/** Alt-click on a layer row: toggles the clipping mask of that layer. */
function toggleClippingAt(id) { const L = D.layers.find((l) => l.id === id); if (L) setClipping(id, !L.clip); }
