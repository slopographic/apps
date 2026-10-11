/* Entry point, loaded by the hub and by every converter page. Mounts each [data-convert-root] it finds:
 *   data-preset="to-jpg" data-from="png"    a single converter, limited to those input kinds
 *   data-defaults='{"format":"jpg"}'         default option values for that converter
 *   data-mode="units"                        the unit converter
 *   (no attributes)                          the full hub */
import { ConvertTool } from './tool.js';
import { mountUnits } from './units.js';

for (const root of document.querySelectorAll('[data-convert-root]')) {
  if (root.dataset.mode === 'units') { mountUnits(root); continue; }
  const preset = root.dataset.preset ? {
    conv: root.dataset.preset,
    from: root.dataset.from ? root.dataset.from.split(',') : null,
    defaults: root.dataset.defaults ? JSON.parse(root.dataset.defaults) : {},
    note: root.dataset.note || '',
  } : null;
  new ConvertTool(root, preset);
}
