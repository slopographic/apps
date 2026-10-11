/* Entry point for the live preview. Loaded after js/ui/mount.js, so each converter root already has its
 * ConvertTool (root.convertTool). Mounts every [data-convert-preview] block:
 *   data-convert-preview         the preview of the converter on the page (or the hub's converter)
 *   data-convert-preview="units" the preview of the unit converter */
import { PreviewPanel } from './controller.js';
import { mountUnitsPreview } from './units.js';

for (const block of document.querySelectorAll('[data-convert-preview]')) {
  if (block.dataset.convertPreview === 'units') {
    const root = document.querySelector('[data-mode="units"]');
    if (root) mountUnitsPreview(block, root);
    continue;
  }
  const root = document.querySelector('[data-convert-root]:not([data-mode])');
  if (root && root.convertTool) new PreviewPanel(block, root.convertTool, root);
}
