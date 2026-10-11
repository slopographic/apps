// The Groups panel: create, rename and delete groups in a SlopUI dialog. A customer can be in many groups. Groups
// filter the list in the sidebar, and bulk actions add or remove them. Deleting a group only takes it off customers.
(function (g) {
  'use strict';
  const NS = (g.SlopCrm = g.SlopCrm || {});
  const UI = g.SlopUI;
  const el = UI.el;
  const plural = (n) => `${n} customer${n === 1 ? '' : 's'}`;
  const enter = (fn) => (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); fn(); } };

  /** Opens the panel. The promise resolves when it closes. */
  function open() {
    return new Promise((resolve) => {
      const body = el('div', { class: 'lab-body' });
      const msg = el('p', { class: 'msg', role: 'alert' });
      const say = (r, done) => { msg.textContent = r.ok ? '' : NS.util.refusal(r); if (r.ok && done) UI.toast(done); };
      const nameIn = el('input', { type: 'text', maxlength: NS.labels.MAX.group, placeholder: 'New group name', 'aria-label': 'New group name',
        autocomplete: 'off', onkeydown: enter(() => add()) });
      const addRow = el('div', { class: 'lab-add' }, nameIn, el('button', { type: 'button', class: 'btn primary', onclick: () => add() }, 'Add group'));

      const add = async () => {
        const r = await NS.labels.createGroup(nameIn.value);
        say(r, 'Group added');
        if (r.ok) nameIn.value = '';
        await draw();
      };
      const row = (x, n) => {
        const name = el('input', { type: 'text', value: x.name, maxlength: NS.labels.MAX.group, autocomplete: 'off',
          'aria-label': `Name of group ${x.name}`, onkeydown: enter(() => rename()) });
        const rename = async () => { const r = await NS.labels.renameGroup(x.id, name.value); say(r, 'Group renamed'); await draw(); };
        const remove = async () => {
          const yes = await UI.confirm(`Delete group “${x.name}”?`,
            `${n ? `It is taken off ${plural(n)}. ` : ''}The customers stay, with their other groups.`, 'Delete', { danger: true });
          if (!yes) return;
          const r = await NS.labels.deleteGroup(x.id);
          say(r, 'Group deleted');
          await draw();
        };
        return el('li', { class: 'lab-row' }, name, el('span', { class: 'lab-count' }, plural(n)),
          el('button', { type: 'button', class: 'btn small', onclick: rename }, 'Rename'),
          el('button', { type: 'button', class: 'btn small danger', onclick: remove }, 'Delete'));
      };
      const draw = async () => {
        const [lab, cs] = await Promise.all([NS.labels.load(), NS.customers.load()]);
        if (!lab.ok || !cs.ok) { msg.textContent = NS.util.refusal(lab.ok ? cs : lab); return; }
        const counts = NS.labels.countsOf(cs.value, 'groupIds');
        body.replaceChildren(
          el('p', { class: 'note' }, 'A customer can be in many groups. Pick a group in the sidebar to filter the list, or add and remove customers in bulk.'),
          addRow, msg,
          lab.value.groups.length
            ? el('ul', { class: 'lab-list', 'aria-label': 'Groups' }, lab.value.groups.map((x) => row(x, counts.get(x.id) || 0)))
            : el('p', { class: 'empty' }, 'No groups yet. Add one above.'));
      };
      UI.dialog({ title: 'Groups', cls: 'lab-dlg', body, buttons: [{ label: 'Done', primary: true }], onClose: () => resolve() });
      draw();
    });
  }

  NS.groupsPanel = { open };
})(typeof window !== 'undefined' ? window : globalThis);
