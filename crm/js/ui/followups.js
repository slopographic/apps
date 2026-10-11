// The follow-up list: customers with a follow-up date, overdue first, then today, then later.
(function (g) {
  'use strict';
  const NS = (g.SlopCrm = g.SlopCrm || {});
  const UI = g.SlopUI;
  const el = UI.el;
  const $ = (id) => document.getElementById(id);

  function row(c, group, loc) {
    return el('li', { class: `row ${group}`, role: 'listitem' },
      el('button', { type: 'button', class: 'row-open', onclick: () => NS.app.show('customer', c.id) },
        el('b', null, c.name), el('span', { class: 'row-sub' }, `${group === 'overdue' ? 'Overdue · ' : ''}${NS.util.date(c.followUp, loc)}`)),
      el('span', { class: `stage s-${c.stage}` }, NS.stageLabel(c.stage)),
      el('button', { type: 'button', class: 'btn small', onclick: async () => {
        const r = await NS.customers.setFollowUp(c.id, null);
        UI.toast(r.ok ? 'Follow-up cleared' : NS.util.refusal(r));
      } }, 'Done'));
  }

  async function render() {
    const r = await NS.customers.load();
    if (!r.ok) { $('fRows').replaceChildren(el('p', { class: 'msg', role: 'alert' }, NS.util.refusal(r))); return; }
    const today = NS.util.today();
    const due = r.value.filter((c) => c.followUp).sort((a, b) => (a.followUp < b.followUp ? -1 : a.followUp > b.followUp ? 1 : 0));
    const group = (c) => (c.followUp < today ? 'overdue' : c.followUp === today ? 'today' : 'later');
    const loc = NS.state.settings.locale;
    $('fRows').replaceChildren(...due.map((c) => row(c, group(c), loc)));
    $('fEmpty').hidden = due.length > 0;
    $('fSummary').textContent = `${due.filter((c) => group(c) === 'overdue').length} overdue · ${due.filter((c) => group(c) === 'today').length} today`;
  }

  NS.views = NS.views || {};
  NS.views.followups = { render };
})(typeof window !== 'undefined' ? window : globalThis);
