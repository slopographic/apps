// Bulk actions on the Customers list. The selection is a Set of customer ids on SlopCrm (NS.selection); the bar shows
// while it is not empty. Each action calls the NS.customers functions once per selected customer and reports the result.
(function (g) {
  'use strict';
  const NS = (g.SlopCrm = g.SlopCrm || {});
  const UI = g.SlopUI;
  const el = UI.el;
  const $ = (id) => document.getElementById(id);
  const plural = (n) => `${n} customer${n === 1 ? '' : 's'}`;
  NS.selection = new Set();
  let shown = []; // the customers the list shows now (after the search and filters)

  /** Paints the bar, its count, the select-all box and the row boxes from the selection. */
  function refresh() {
    const n = NS.selection.size;
    $('cBulk').hidden = n === 0;
    $('bCount').textContent = `${n} selected`;
    const picked = shown.filter((c) => NS.selection.has(c.id)).length;
    const all = $('cSelAll');
    all.checked = shown.length > 0 && picked === shown.length;
    all.indeterminate = picked > 0 && picked < shown.length;
    all.disabled = shown.length === 0;
    for (const cb of document.querySelectorAll('#cRows .row-check')) cb.checked = NS.selection.has(cb.dataset.id);
  }

  /** Called by the list after each render: drops selected ids that no longer exist, then repaints. */
  function update(all, visible) {
    shown = visible;
    const live = new Set(all.map((c) => c.id));
    for (const id of [...NS.selection]) if (!live.has(id)) NS.selection.delete(id);
    refresh();
  }

  /** One row's box changed. */
  function toggle(id, on) {
    if (on) NS.selection.add(id); else NS.selection.delete(id);
    refresh();
  }

  /** The select-all box: every shown customer in or out of the selection. */
  function setShown(on) {
    for (const c of shown) { if (on) NS.selection.add(c.id); else NS.selection.delete(c.id); }
    refresh();
  }

  /** Runs one NS.customers call per selected customer. Returns how many worked and the first refusal. */
  async function each(fn, drop = false) {
    const ids = [...NS.selection];
    let done = 0, why = '';
    for (const id of ids) {
      const r = await fn(id);
      if (r && r.ok) { done++; if (drop) NS.selection.delete(id); }
      else if (!why) why = NS.util.refusal(r);
    }
    return { done, total: ids.length, why };
  }

  function report(msg, res) {
    UI.toast(res.why ? `${msg}: ${res.done} of ${res.total} done. ${res.why}` : `${msg}: ${plural(res.done)}`);
  }

  /** Changes one customer from its current record. A customer that is gone is a refusal, not a crash. */
  async function patch(id, change) {
    const r = await NS.customers.get(id);
    if (!r.ok) return r;
    if (!r.value) return { ok: false, message: 'That customer no longer exists.' };
    return NS.customers.save(id, change(r.value));
  }

  async function setStage(stage) {
    report(`Moved to ${NS.stageLabel(stage)}`, await each((id) => NS.customers.moveStage(id, stage)));
  }

  async function addCategory() {
    const add = NS.util.tags(await UI.prompt('Add category', 'Category name', '', { ok: 'Add', placeholder: 'e.g. wholesale' }));
    if (!add.length) return;
    report(`Added ${add.join(', ')}`, await each((id) => patch(id, (c) => ({ categories: NS.util.tags([...(c.categories || []), ...add].join(', ')) }))));
  }

  async function removeCategory() {
    const drop = NS.util.tags(await UI.prompt('Remove category', 'Category to remove', '', { ok: 'Remove' }));
    if (!drop.length) return;
    report(`Removed ${drop.join(', ')}`, await each((id) => patch(id, (c) => ({ categories: (c.categories || []).filter((t) => !drop.includes(t)) }))));
  }

  async function setFollowUp(date) {
    if (!NS.util.isDate(date)) { UI.toast('Pick a real date first.'); return; }
    report(`Follow-up set to ${date}`, await each((id) => NS.customers.setFollowUp(id, date)));
  }

  /** The selected customers, read fresh from the store, as one CSV file (UTF-8 with a BOM so Excel reads accents). */
  async function exportCsv() {
    const r = await NS.customers.load();
    if (!r.ok) { UI.toast(NS.util.refusal(r)); return; }
    const rows = r.value.filter((c) => NS.selection.has(c.id));
    const cell = (v) => {
      const s = Array.isArray(v) ? v.join(', ') : String(v == null ? '' : v);
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = ['Name', 'Stage', 'Email', 'Phone', 'Address', 'Follow-up', 'Categories', 'Notes'];
    const lines = [head, ...rows.map((c) => [c.name, NS.stageLabel(c.stage), c.email, c.phone, c.address, c.followUp, c.categories, c.notes])];
    const text = '﻿' + lines.map((l) => l.map(cell).join(',')).join('\r\n') + '\r\n';
    UI.download(new Blob([text], { type: 'text/csv;charset=utf-8' }), `slop-crm-customers-${NS.util.today()}.csv`);
    UI.toast(`Exported ${plural(rows.length)}`);
  }

  async function removeSelected() {
    const n = NS.selection.size;
    if (!n) return;
    const yes = await UI.confirm(`Delete ${plural(n)}?`, 'They move to the deleted list. Their orders and invoices are kept.', 'Delete', { danger: true });
    if (!yes) return;
    const openGone = !!NS.state.current && NS.selection.has(NS.state.current);
    const res = await each((id) => NS.customers.remove(id), true);
    report('Deleted', res);
    if (openGone) { NS.state.current = null; NS.app.show('customers'); }
  }

  /** Builds the bar, once, and wires the select-all box. Called when the Customers view mounts. */
  function mount() {
    const stage = el('select', { 'aria-label': 'Change stage of selected customers',
      onchange: (e) => { const s = e.target.value; e.target.value = ''; if (s) setStage(s); } },
      el('option', { value: '' }, 'Change stage…'), NS.STAGES.map((s) => el('option', { value: s }, NS.stageLabel(s))));
    const date = el('input', { type: 'date', 'aria-label': 'Follow-up date for selected customers' });
    const btn = (label, act, cls) => el('button', { type: 'button', class: cls ? `btn small ${cls}` : 'btn small', onclick: () => act() }, label);
    $('cBulk').replaceChildren(
      el('span', { class: 'bulk-count', id: 'bCount', role: 'status' }),
      stage,
      btn('Add category', addCategory),
      btn('Remove category', removeCategory),
      el('span', { class: 'bulk-date' }, date, btn('Apply', () => setFollowUp(date.value))),
      btn('Export CSV', exportCsv),
      btn('Delete', removeSelected, 'danger'),
      btn('Clear selection', () => { NS.selection.clear(); refresh(); }));
    $('cSelAll').addEventListener('change', (e) => setShown(e.target.checked));
  }

  NS.bulk = { mount, update, toggle };
})(typeof window !== 'undefined' ? window : globalThis);
