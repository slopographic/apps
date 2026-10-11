/* SlopClean: the "What to remove" panel. One checkbox per category, with how many were found across all pictures.
 * A change re-runs the cleaning (the controller passes onChange). Classic script; sets window.CL.choices. */
(function () {
  'use strict';
  const CL = (window.CL = window.CL || {});
  const el = (...a) => window.SlopUI.el(...a);

  CL.choices = {
    render(state, onChange) {
      const box = document.getElementById('cl-choices');
      const all = state.items.flatMap((it) => it.findings);
      const rows = window.SlopClean.CATS.map((c) => {
        const n = all.filter((f) => f.cat === c.id).length;
        const input = el('input', { type: 'checkbox', checked: !!state.remove[c.id] });
        input.addEventListener('change', () => { state.remove[c.id] = input.checked; onChange(); });
        return el('label', { class: 'cl-choice' + (n ? '' : ' is-none') }, input,
          el('span', null, c.label), el('span', { class: 'cl-count' }, String(n)));
      });
      box.replaceChildren(
        el('h2', { class: 'cl-side-h' }, 'What to remove'),
        el('p', { class: 'cl-side-p' }, 'Applies to every picture. The colour profile and DPI stay unless you tick them.'),
        el('div', { class: 'cl-choice-list' }, rows));
    },
  };
})();
