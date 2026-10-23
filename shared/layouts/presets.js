/* Workspace layouts: the presets are plain data. Classic script: sets window.SlopLayouts.CATEGORIES and .PRESETS.
 * A preset says which panels show, which side each sits on and how big it is (px; null = take the rest).
 *   side: left | center | right | top | bottom   (center takes the free space; top and bottom span the full width)
 *   size: px for left, right, top, bottom; null for center, or where the side should take the rest of the space
 * Panel ids are the names each app gives its panels in shared/layouts/HANDOFF.md. A panel an app does not have is ignored. */
(function (g) {
  'use strict';
  const NS = (g.SlopLayouts = g.SlopLayouts || {});

  NS.CATEGORIES = Object.freeze([
    { id: 'video', name: 'Video editing', blurb: 'Preview large, timeline along the bottom.', apps: ['slopcut'] },
    { id: 'image', name: 'Image editing', blurb: 'Canvas large, tools left, layers and properties right.', apps: ['photoslop'] },
    { id: '3d', name: '3D', blurb: 'Viewport large, outliner left, inspector right.', apps: ['3d'] },
    { id: 'business', name: 'Business', blurb: 'The list on the left, the document or record on the right.', apps: ['invoices', 'orders', 'quotes', 'crm'] },
    { id: 'writing', name: 'Writing', blurb: 'The document in the centre, its outline on the left.', apps: [] },
  ]);

  NS.PRESETS = Object.freeze([
    { id: 'video-edit', category: 'video', name: 'Video editing', apps: ['slopcut'],
      panels: {
        preview: { show: true, side: 'center', size: null },
        bin: { show: true, side: 'left', size: 280 },
        insp: { show: true, side: 'right', size: 300 },
        timeline: { show: true, side: 'bottom', size: 300 },
      } },
    { id: 'image-edit', category: 'image', name: 'Image editing', apps: ['photoslop'],
      panels: {
        canvas: { show: true, side: 'center', size: null },
        tools: { show: true, side: 'left', size: 62 },
        panels: { show: true, side: 'right', size: 280 },
      } },
    { id: '3d-view', category: '3d', name: '3D', apps: ['3d'],
      panels: {
        viewport: { show: true, side: 'center', size: null },
        outliner: { show: true, side: 'left', size: 230 },
        inspector: { show: true, side: 'right', size: 270 },
      } },
    { id: 'business-document', category: 'business', name: 'List and document', apps: ['invoices', 'orders', 'quotes'],
      panels: {
        list: { show: true, side: 'left', size: 340 },
        document: { show: true, side: 'right', size: null },
      } },
    { id: 'business-detail', category: 'business', name: 'List and detail', apps: ['crm'],
      panels: {
        list: { show: true, side: 'left', size: 340 },
        detail: { show: true, side: 'right', size: null },
      } },
    { id: 'writing-document', category: 'writing', name: 'Document and outline', apps: [],
      panels: {
        outline: { show: true, side: 'left', size: 240 },
        document: { show: true, side: 'center', size: null },
      } },
  ]);
})(typeof window !== 'undefined' ? window : globalThis);
