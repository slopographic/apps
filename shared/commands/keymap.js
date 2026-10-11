/* SlopCmd part: the keyboard shortcut editor (SlopUI dialog). Search, click a shortcut to record a
 * new one, + to add, × to remove, ↺ to reset one, Reset all, conflict warnings, export/import JSON.
 * Shortcuts are stored per app in localStorage 'slop.keys.<app>'. */
(function () {
  'use strict';
  const C = window.SlopCmd;
  if (!C || !C._parts || C._parts.keymap) return;
  const el = (tag, attrs, ...kids) => {
    const n = document.createElement(tag);
    for (const k in attrs || {}) { const v = attrs[k]; if (v == null || v === false) continue; if (k === 'class') n.className = v; else n.setAttribute(k, v === true ? '' : v); }
    for (const kid of kids.flat()) if (kid != null && kid !== false) n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return n;
  };
  const appName = () => { const a = (window.SLOP_APPS || []).find((x) => x.id === C.app); return a ? a.name : document.title.split(/\s[—–-]\s/)[0]; };
  const keysEl = (b) => el('span', { class: 'scmd-keys' }, C.format(b).split(' ').map((s) => el('kbd', null, s)));
  let cur = null;

  function open() {
    if (cur && cur.dlg.box.isConnected) { cur.search.focus(); return cur; }
    if (!window.SlopUI) throw new Error('SlopCmd.openKeymap needs shared/slopui.js');
    const R = C._parts.recorder;
    const search = el('input', { class: 'sui-input scmd-km-search', type: 'search', placeholder: 'Search shortcuts', 'aria-label': 'Search shortcuts', autocomplete: 'off', spellcheck: 'false' });
    const list = el('div', { class: 'scmd-km-list', role: 'list', 'aria-label': 'Commands and shortcuts' });
    const note = el('p', { class: 'scmd-km-note' }, 'Shortcuts for ' + appName() + '. Click a shortcut to change it, + to add another, × to remove. Press Esc to cancel recording; press a second combination quickly for a chord.');
    const live = el('div', { class: 'scmd-sr', 'aria-live': 'assertive' });
    const body = el('div', { class: 'scmd-km' }, search, note, list, live);
    let rec = null;
    const stopRec = () => { if (rec) { rec.cancel(); rec = null; } };
    const dlg = SlopUI.dialog({
      title: 'Keyboard shortcuts', cls: 'sui-wide scmd-km-dlg', body,
      buttons: [
        { label: 'Import…', act: () => { R.importFile(); return false; } },
        { label: 'Export…', act: () => { R.exportFile(); return false; } },
        { label: 'Reset all', act: async () => { if (await SlopUI.confirm('Reset all shortcuts', 'Put every shortcut for ' + appName() + ' back to its default?', 'Reset all', { danger: true })) C.resetKeys(); return false; } },
        { label: 'Done', primary: true },
      ],
      onClose: () => { stopRec(); offChange(); cur = null; },
    });
    function startRec(btn, id, old) {
      stopRec();
      btn.classList.add('scmd-recording');
      btn.textContent = 'Press keys…';
      btn.setAttribute('aria-pressed', 'true');
      live.textContent = 'Recording. Press the new shortcut, or Escape to cancel.';
      const r = rec = R.record({ keepOn: btn, onStep: (b) => { btn.textContent = C.format(b) + ' …'; } });
      r.promise.then(async (b) => {
        if (rec === r) rec = null;
        if (b) { await R.assign(id, old, b); live.textContent = 'Set to ' + C.format(b); } else live.textContent = 'Recording cancelled';
        render();
        const again = list.querySelector('[data-id="' + CSS.escape(id) + '"] .scmd-add');
        if (again) again.focus({ preventScroll: true });
      });
    }
    function row(c, conflicts) {
      const binds = el('span', { class: 'scmd-km-binds' });
      for (const b of c.keys) {
        const chip = el('button', { type: 'button', class: 'scmd-chip', title: 'Change shortcut', 'aria-label': 'Change shortcut ' + C.format(b) + ' for ' + c.title }, keysEl(b));
        chip.addEventListener('click', () => startRec(chip, c.id, b));
        const x = el('button', { type: 'button', class: 'scmd-chip-x', 'aria-label': 'Remove shortcut ' + C.format(b) + ' from ' + c.title, title: 'Remove' }, '×');
        x.addEventListener('click', () => { R.removeBinding(c.id, b); live.textContent = 'Removed'; });
        binds.append(el('span', { class: 'scmd-chipwrap' }, chip, x));
      }
      const add = el('button', { type: 'button', class: 'scmd-add', title: 'Add shortcut', 'aria-label': 'Add shortcut for ' + c.title }, '+');
      add.addEventListener('click', () => startRec(add, c.id, null));
      binds.append(add);
      const changed = JSON.stringify(c.keys.map((k) => C.canon(k))) !== JSON.stringify(c.defaults.map((k) => C.canon(k)));
      const reset = el('button', { type: 'button', class: 'scmd-reset', title: 'Reset to default', 'aria-label': 'Reset ' + c.title + ' to default', disabled: !changed }, '↺');
      reset.addEventListener('click', () => C.resetKeys(c.id));
      const warn = conflicts && conflicts.length ? el('span', { class: 'scmd-km-warn', title: 'Same shortcut as another command' }, '⚠ Also: ' + [...new Set(conflicts.map((x) => x.title))].join(', ')) : null;
      return el('div', { class: 'scmd-km-row' + (changed ? ' scmd-changed' : ''), role: 'listitem', 'data-id': c.id },
        el('span', { class: 'scmd-km-name' }, el('span', { class: 'scmd-km-title' }, c.title), warn), binds, reset);
    }
    function render() {
      if (rec) return;
      const q = search.value.trim();
      let cmds = C.list().filter((c) => !c.hidden);
      if (q) {
        const S = C._parts.search;
        const fmt = (c) => c.keys.map((k) => C.format(k) + ' ' + k).join(' ');
        cmds = cmds.filter((c) => (S ? S.rank(q, [c], null).length : (c.title + c.id).toLowerCase().includes(q.toLowerCase())) || fmt(c).toLowerCase().includes(q.toLowerCase()));
      }
      const all = C.allConflicts(), groups = new Map();
      for (const c of cmds) { const g = c.group || 'Commands'; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(c); }
      const scroll = list.scrollTop;
      list.textContent = '';
      for (const [g, items] of groups) {
        list.append(el('div', { class: 'scmd-km-hdr', role: 'presentation' }, g));
        for (const c of items) list.append(row(c, all[c.id]));
      }
      if (!cmds.length) list.append(el('p', { class: 'scmd-km-note' }, 'No commands match “' + q + '”'));
      list.scrollTop = scroll;
    }
    const offChange = C.on('change', render);
    search.addEventListener('input', render);
    render();
    cur = { dlg, search, list, render, get recording() { return rec; } };
    return cur;
  }
  C._parts.keymap = { open, get current() { return cur; } };
})();
