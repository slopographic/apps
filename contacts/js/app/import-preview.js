/* Slop Contacts: the import preview. Lists what will be added. Each contact that matches one already in the list on
 * e-mail or phone is flagged as a duplicate, and the person picks what happens to those: skip, merge into the existing
 * contact, or add a new one. Import applies the whole choice in one change. Undo (in the toast) puts the list back,
 * while nothing else has changed since the import (the revision counter in state.js). Adds SlopContacts.importPreview. */
(function () {
  'use strict';
  const SC = window.SlopContacts;
  const S = SC.state;
  const UI = window.SlopUI;
  const el = UI.el;
  let undo = null; // { before, rev } for the last import

  /** Puts the list back as it was before the last import. Refused when anything was changed since. */
  function undoLast() {
    const u = undo;
    undo = null;
    if (!u) return;
    if (S.rev !== u.rev) { UI.toast('Contacts changed after the import, so it cannot be undone in one step.'); return; }
    S.setList(u.before);
    UI.toast('Import undone');
  }

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  /** A line under a name: the company, else the first e-mail or phone. */
  const subOf = (c) => c.org || (c.emails[0] && c.emails[0].value) || (c.phones[0] && c.phones[0].value) || '';

  /** The preview for incoming contacts. sourceLabel names the files; errors lists files that could not be read.
   *  opts.keepIds: an added contact keeps its incoming id when no contact in the list has it (the Drive bundle, whose
   *  X-SLOP-ID makes a later import a match). Resolves with true when the import was applied. */
  function show(incoming, sourceLabel, errors = [], { keepIds = false } = {}) {
    return new Promise((resolve) => {
      const cc = S.cc, rows = SC.importPlan.plan(S.list, incoming, cc);
      const taken = new Set(S.list.map((c) => c.id));
      const idFor = (c) => { const id = keepIds && c.id && !taken.has(c.id) ? c.id : SC.records.newId(); taken.add(id); return id; };
      const dups = rows.filter((r) => r.match).length, fresh = rows.length - dups;
      let choice = 'skip', applied = false;
      const summary = el('p', { class: 'sui-p imp-sum', 'aria-live': 'polite' });
      const list = el('ul', { class: 'imp-list', role: 'list' });
      const statusOf = (r) => {
        if (!r.match) return 'New';
        const what = choice === 'skip' ? 'skipped' : choice === 'merge' ? 'merged' : 'added as new';
        return `Duplicate of ${r.match.fn} (${r.why.join(', ')}): ${what}`;
      };
      const paint = () => {
        const add = fresh + (choice === 'add' ? dups : 0), merge = choice === 'merge' ? dups : 0, skip = choice === 'skip' ? dups : 0;
        summary.textContent = `${plural(fresh, 'new contact', 'new contacts')} and ${plural(dups, 'duplicate', 'duplicates')} `
          + `(matched on e-mail or phone). ${add} will be added, ${merge} merged, ${skip} skipped.`;
        list.replaceChildren(...rows.map((r) => el('li', { class: 'imp-row' + (r.match ? ' is-dup' : '') },
          el('span', { class: 'imp-name' }, r.c.fn), el('span', { class: 'imp-sub' }, subOf(r.c)), el('span', { class: 'imp-status' }, statusOf(r)))));
      };
      const radio = (value, label) => {
        const input = el('input', { type: 'radio', name: 'imp-dup', value, checked: value === choice });
        input.addEventListener('change', () => { if (input.checked) { choice = value; paint(); } });
        return el('label', { class: 'sui-check' }, input, el('span', null, label));
      };
      const choices = dups ? el('fieldset', { class: 'imp-choice' }, el('legend', null, 'Duplicates'),
        radio('skip', 'Skip them (keep the contact already in the list)'),
        radio('merge', 'Merge into the contact already in the list'),
        radio('add', 'Add them as new contacts')) : null;
      const body = el('div', null,
        el('p', { class: 'sui-p' }, `From ${sourceLabel}. Photos are not imported.`),
        errors.length ? el('p', { class: 'sui-p imp-warn' }, `Could not read: ${errors.join(' ')}`) : null,
        summary, choices, el('div', { class: 'imp-wrap' }, list));
      paint();
      const apply = () => {
        if (applied) return false;
        applied = true;
        const before = S.list;
        const res = SC.importPlan.apply(before, rows, choice, idFor, cc);
        S.setList(res.list);
        const bits = [];
        if (res.added) bits.push(`${res.added} added`);
        if (res.merged) bits.push(`${res.merged} merged`);
        if (res.skipped) bits.push(`${res.skipped} skipped`);
        undo = { before, rev: S.rev };
        UI.toast(`Imported: ${bits.join(', ') || 'nothing new'}.`, 6000, bits.length ? { label: 'Undo', run: undoLast } : null);
        return undefined;
      };
      UI.dialog({ title: `Import ${plural(rows.length, 'contact', 'contacts')}`, body, cls: 'imp-dlg', buttons: [
        { label: 'Cancel' }, { label: 'Import', primary: true, act: apply }],
      onClose: (ok) => resolve(!!ok && applied) });
    });
  }

  SC.importPreview = { show, undo: undoLast };
})();
