/* Slop Contacts: the tools dialogs. Duplicate review (merge a group or all), clean up (bulk fixes), find and replace,
 * add or remove a group on the selection, delete the selection, and the default country code.
 * Bulk changes act on the selection when there is one, otherwise on every contact. Adds SlopContacts.tools. */
(function () {
  'use strict';
  const SC = window.SlopContacts;
  const S = SC.state;
  const UI = window.SlopUI;
  const el = UI.el;
  const scopeName = (sel) => (sel ? `${S.sel.size} selected` : `all ${S.list.length}`);

  /** Radios for "selection" or "all". Returns { el, value() }. */
  function scopeRadios(hasSel) {
    let v = hasSel ? 'sel' : 'all';
    const mk = (value, label) => {
      const r = el('input', { type: 'radio', name: 'bulk-scope', value, checked: v === value });
      r.addEventListener('change', () => { if (r.checked) v = value; });
      return el('label', { class: 'sui-check' }, r, el('span', null, label));
    };
    return { el: el('div', { class: 'ed-scope' }, mk('sel', `Selected (${S.sel.size})`), mk('all', `All (${S.list.length})`)), value: () => v };
  }

  /** Duplicate review: a list of groups, each with Merge, and Merge all. Exact copies are already merged on import. */
  function dupesDialog() {
    const cc = S.cc;
    let groups = SC.dedupe.findGroups(S.list, cc);
    if (!groups.length) { UI.alert('No duplicates', 'No two contacts share a phone number, an e-mail address, or a name and organisation.'); return; }
    const box = el('div', { class: 'dupes' });
    const head = el('p', { class: 'sui-p' });
    const paint = () => {
      groups = SC.dedupe.findGroups(S.list, cc);
      const exact = groups.filter(SC.dedupe.isExact).length;
      head.textContent = groups.length
        ? `${groups.length} group${groups.length === 1 ? '' : 's'} of possible duplicates${exact ? `, ${exact} exact` : ''}. Merging keeps every phone, e-mail, address and group.`
        : 'No duplicates left.';
      box.replaceChildren(...groups.map((g) => {
        const names = g.map((c) => SC.model.displayName(c)).join(' + ');
        const why = SC.dedupe.reasonsOf(g, cc).join(', ');
        const mergeBtn = el('button', { type: 'button', class: 'sui-btn sui-primary' }, 'Merge');
        mergeBtn.addEventListener('click', () => { S.setList(SC.dedupe.applyMerges(S.list, [g], cc)); paint(); });
        return el('div', { class: 'dupe' }, el('div', { class: 'dn' }, names), el('div', { class: 'dr' }, why || 'matching details'), mergeBtn);
      }));
    };
    paint();
    const all = { label: 'Merge all', act: () => { S.setList(SC.dedupe.applyMerges(S.list, groups, cc)); paint(); return false; } };
    UI.dialog({ title: 'Find duplicates', cls: 'dupe-dlg', body: el('div', null, head, box), buttons: [{ label: 'Close' }, all] });
  }

  /** Clean up: the bulk fixes. */
  function cleanDialog() {
    const hasSel = S.sel.size > 0;
    const o = { trim: true, titleCase: false, e164: false, lowerEmail: true, removeEmpty: true };
    const check = (key, label) => {
      const c = UI.check(label, o[key]);
      c.input.addEventListener('change', () => { o[key] = c.input.checked; });
      return c.el;
    };
    const cc = UI.field('Default country code', el('input', { class: 'sui-input', id: 'cleanCc', value: S.cc, placeholder: '+44, 1, 61 (empty = keep)', 'aria-label': 'Default country code', autocomplete: 'off' }));
    const ccIn = cc.querySelector('input');
    const scope = scopeRadios(hasSel);
    const body = el('div', null,
      el('p', { class: 'sui-p' }, `Applies to ${scopeName(hasSel)}.`),
      scope.el,
      check('trim', 'Trim and collapse spaces'),
      check('titleCase', 'Title-case names (keeps particles like van, de, la lower case)'),
      check('e164', 'Phones to E.164 with the country code above'),
      check('lowerEmail', 'Lowercase e-mail addresses'),
      check('removeEmpty', 'Remove empty phones, e-mails, addresses and groups'),
      cc);
    UI.dialog({ title: 'Clean up contacts', body, buttons: [{ label: 'Cancel' }, { label: 'Apply', primary: true, act: () => {
      S.setCc(ccIn.value);
      const r = SC.bulk.cleanup(S.list, scope.value() === 'sel' ? S.scope() : null, { ...o, cc: S.cc });
      if (r.changed) S.setList(r.list);
      UI.toast(r.changed ? `Cleaned ${r.changed} contact${r.changed === 1 ? '' : 's'}` : 'Nothing to change');
      return undefined;
    } }] });
  }

  /** Find and replace inside one field group, plain text. */
  function findDialog() {
    const hasSel = S.sel.size > 0;
    const labels = { all: 'Every field', name: 'Name', org: 'Organisation and department', title: 'Job title', note: 'Note',
      url: 'Website', email: 'E-mail', phone: 'Phone', address: 'Address', group: 'Group' };
    const field = UI.select(SC.bulk.FIELD_GROUPS.map((f) => [f, labels[f]]), 'all');
    const find = el('input', { class: 'sui-input', id: 'findText', placeholder: 'Find', 'aria-label': 'Find', autocomplete: 'off' });
    const rep = el('input', { class: 'sui-input', id: 'replaceText', placeholder: 'Replace with', 'aria-label': 'Replace with', autocomplete: 'off' });
    const cs = UI.check('Match case', false);
    const scope = scopeRadios(hasSel);
    const body = el('div', null, scope.el, UI.field('Field', field), UI.field('Find', find), UI.field('Replace with', rep), cs.el);
    UI.dialog({ title: 'Find and replace', body, buttons: [{ label: 'Cancel' }, { label: 'Replace all', primary: true, act: () => {
      if (!find.value) { UI.toast('Type text to find'); return false; }
      const r = SC.bulk.findReplace(S.list, scope.value() === 'sel' ? S.scope() : null,
        { field: field.value, find: find.value, replace: rep.value, matchCase: cs.input.checked });
      if (r.changed) S.setList(r.list);
      UI.toast(r.count ? `${r.count} replacement${r.count === 1 ? '' : 's'} in ${r.changed} contact${r.changed === 1 ? '' : 's'}` : 'No matches');
      return undefined;
    } }] });
  }

  /** Add a group to the selection. */
  async function addGroupDialog() {
    if (!S.sel.size) { UI.toast('Select contacts first'); return; }
    const name = await UI.prompt('Add to group', `Group name for ${S.sel.size} selected contact${S.sel.size === 1 ? '' : 's'}`, '', { ok: 'Add', placeholder: 'Work, Family, Clients' });
    if (!name || !name.trim()) return;
    const r = SC.bulk.addGroup(S.list, S.scope(), name);
    if (r.changed) S.setList(r.list);
    UI.toast(`Added to “${name.trim()}”: ${r.changed} contact${r.changed === 1 ? '' : 's'}`);
  }

  /** Remove a group from the selection (only groups the selection has). */
  function removeGroupDialog() {
    if (!S.sel.size) { UI.toast('Select contacts first'); return; }
    const names = [...new Set(S.selected().flatMap((c) => c.groups))].sort();
    if (!names.length) { UI.toast('The selected contacts have no groups'); return; }
    const pick = UI.select(names.map((n) => [n, n]), names[0]);
    UI.dialog({ title: 'Remove from group', body: UI.field('Group', pick), buttons: [{ label: 'Cancel' }, { label: 'Remove', primary: true, act: () => {
      const r = SC.bulk.removeGroup(S.list, S.scope(), pick.value);
      if (r.changed) S.setList(r.list);
      UI.toast(`Removed from “${pick.value}”: ${r.changed}`);
      return undefined;
    } }] });
  }

  /** Delete the selected contacts after a confirm (the same dialog as the Delete key). */
  async function deleteSelected() {
    if (!S.sel.size) { UI.toast('Select contacts first'); return; }
    const n = S.sel.size;
    if (await SC.select.remove(new Set(S.sel))) UI.toast(`Deleted ${n}`);
  }

  /** The default country code for E.164 (per viewer, kept in the draft). */
  async function countryDialog() {
    const v = await UI.prompt('Default country code', 'Country code, for example +44, 1 or 61. Leave empty to keep numbers as typed.', S.cc, { ok: 'Save', placeholder: '+44' });
    if (v === null) return;
    S.setCc(v);
    UI.toast(S.cc ? `Default country code ${S.cc}` : 'Numbers kept as typed');
  }

  SC.tools = { dupesDialog, cleanDialog, findDialog, addGroupDialog, removeGroupDialog, deleteSelected, countryDialog };
})();
