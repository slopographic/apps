/* Slop Sheets viewer: the panel on the right (the suite rule, shared/frame/HANDOFF.md: SlopFrame, shared/frame/frame.js
 * and panel.js). The sheet is the view; the panel holds the table's look (Table style, Colours: the header's old pickers,
 * moved in with their ids and listeners), Open in Slop Table, and Export ▾, the main button, at its foot. Open, Commands
 * and Menu stay in the header. On a phone the panel is a bottom sheet whose closed state still shows Export.
 *   mountPanel({ has: () => bool }) → { paint() }   paint() after every render (Export and Slop Table need a sheet) */
const $ = (id) => document.getElementById(id);

export function mountPanel({ has }) {
  if (!window.SlopFrame) return { paint() {} };
  const side = $('sv-side');
  const frame = window.SlopFrame.mount($('sv-body'), { view: $('sv-main'), panel: side, panelLabel: 'Sheet', storageKey: 'sheetview',
    width: 260, min: 220, max: 420 });   // shown and hidden with Ctrl+Alt+B (the View command); no header button
  $('sv-export').classList.add('sv-primary');
  const p = window.SlopFrame.panel(side, { title: 'Sheet' });
  const pick = (id) => { const l = $(id).closest('label'); l.classList.add('sf-field'); return l; };
  p.render([
    { key: 'look', title: 'Look', settings: [pick('sv-style'), pick('sv-palette')] },
    { key: 'send', title: 'Send', note: 'The current sheet, all rows, as a new table.', actions: [{ el: $('sv-hub') }] },
  ]);
  const paint = () => {
    const on = has();
    p.footer([{ el: $('sv-export'), primary: true, disabled: !on, title: 'Export the rows you see, or all rows' }], { more: 'Sheet' });
    $('sv-hub').disabled = !on;
  };
  paint();
  return { frame, paint };
}
