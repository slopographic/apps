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
  setLayerProps(id, { mask: SlopMask.invert(L.mask) }, 'Invert Mask');
}
/** While a mask is edited, tints where it hides (the live stroke's mask while painting). */
function drawMaskOverlay(g) {
  const L = activeLayer(); if (!L || !L.mask || L.mask.enabled === false) return;
  const m = live && live.layerId === L.id && live.maskSurface && live.maskSurface.last ? live.maskSurface.last : L.mask;
  SlopMask.overlay(g, m.canvas, m.x, m.y, V.ox, V.oy, V.zoom);
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
