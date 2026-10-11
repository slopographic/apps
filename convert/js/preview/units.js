/* Preview for the unit converter: the typed value and its converted value side by side, updated on every
 * change. The widget does the maths; this only shows the input and output as text. Browser only. */
import { convert } from '../core/units.js';
import { createView } from './view.js';

export function mountUnitsPreview(block, root) {
  const view = createView(block, { input: false });
  const q = (sel) => root.querySelector(sel);
  const label = (sel) => { const o = q(sel).selectedOptions[0]; return o ? o.textContent : ''; };
  let copyText = '';
  const update = () => {
    const value = (q('#cv-u-value').value || '').trim() || '0';
    const fromLabel = label('#cv-u-from'), toLabel = label('#cv-u-to');
    let after;
    try {
      const r = convert(q('#cv-u-cat').value, q('#cv-u-from').value, q('#cv-u-to').value, value);
      const text = `${r.exact ? '' : '≈ '}${r.text} ${toLabel}`;
      after = { kind: 'text', text, lines: [text] };
    } catch (e) {
      after = { kind: 'error', message: e.message };
    }
    const input = `${value} ${fromLabel}`;
    view.render({ before: { kind: 'text', text: input, lines: [input] }, after, note: '' });
    copyText = after.kind === 'text' ? after.text : '';
    view.copy.disabled = !copyText;
    view.swap.hidden = false;
    view.download.hidden = true;
  };
  view.copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(copyText); view.setStatus('Copied.'); }
    catch (e) { view.setStatus(`Could not copy: ${e.message}`); }
  });
  view.swap.addEventListener('click', () => {
    const from = q('#cv-u-from'), to = q('#cv-u-to');
    const a = from.value; from.value = to.value; to.value = a;
    from.dispatchEvent(new Event('change', { bubbles: true }));
  });
  root.addEventListener('input', update);
  root.addEventListener('change', update);
  update();
}
