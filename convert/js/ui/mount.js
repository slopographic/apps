/* Entry point, loaded by the hub and by every converter page. Mounts each [data-convert-root] it finds:
 *   data-preset="to-jpg" data-from="png"    a single converter, limited to those input kinds
 *   data-defaults='{"format":"jpg"}'         default option values for that converter
 *   (no attributes)                          the full hub */
import { ConvertTool } from './tool.js';

for (const root of document.querySelectorAll('[data-convert-root]')) {
  const preset = root.dataset.preset ? {
    conv: root.dataset.preset,
    from: root.dataset.from ? root.dataset.from.split(',') : null,
    defaults: root.dataset.defaults ? JSON.parse(root.dataset.defaults) : {},
    note: root.dataset.note || '',
  } : null;
  root.convertTool = new ConvertTool(root, preset);
}
