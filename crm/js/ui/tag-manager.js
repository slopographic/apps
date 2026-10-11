// The tag manager: create, rename, recolour, merge and delete tags in a SlopUI dialog. A tag is one definition, so a
// change here reaches every customer that has it. Categories (free text on each customer) are a different thing and
// are not changed here; the note in the dialog says so.
(function (g) {
  'use strict';
  const NS = (g.SlopCrm = g.SlopCrm || {});
  const UI = g.SlopUI;
  const el = UI.el;
  const COLORS = g.SlopData.schemaDefs.ENUM.tagColor;
  const plural = (n) => `${n} customer${n === 1 ? '' : 's'}`;
  const enter = (fn) => (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); fn(); } };

  function colourSelect(value, label, onChange) {
    return el('select', { 'aria-label': label, onchange: (e) => onChange(e.target.value) },
      COLORS.map((c) => el('option', { value: c, selected: c === value }, NS.labels.COLOR_NAME[c])));
  }

  /** Opens the manager. The promise resolves when it closes. */
  function open() {
    return new Promise((resolve) => {
      const body = el('div', { class: 'lab-body' });
      const msg = el('p', { class: 'msg', role: 'alert' });
      const say = (r, done) => { msg.textContent = r.ok ? '' : NS.util.refusal(r); if (r.ok && done) UI.toast(done); };
      let newColour = 'blue';
      const newName = el('input', { type: 'text', maxlength: NS.labels.MAX.tag, placeholder: 'New tag', 'aria-label': 'New tag name',
        autocomplete: 'off', onkeydown: enter(() => add()) });
      const addRow = el('div', { class: 'lab-add' }, newName,
        colourSelect('blue', 'New tag colour', (c) => { newColour = c; }),
        el('button', { type: 'button', class: 'btn primary', onclick: () => add() }, 'Add tag'));
      const note = el('p', { class: 'note' }, 'Tags are coloured labels. Rename, recolour, merge or delete one here and every customer that has it is updated. ',
        'Categories are different: free text on each customer, kept as they were.');

      const add = async () => {
        const r = await NS.labels.createTag(newName.value, newColour);
        say(r, 'Tag added');
        if (r.ok) newName.value = '';
        await draw();
      };
      const row = (t, tags, n) => {
        const run = async (p, done) => { say(await p, done); await draw(); };
        const name = el('input', { type: 'text', value: t.name, maxlength: NS.labels.MAX.tag, autocomplete: 'off',
          'aria-label': `Name of tag ${t.name}`, onkeydown: enter(() => run(NS.labels.renameTag(t.id, name.value), 'Tag renamed')) });
        const others = tags.filter((x) => x.id !== t.id);
        const target = el('select', { 'aria-label': `Merge ${t.name} into`, disabled: !others.length },
          el('option', { value: '' }, others.length ? 'Merge into…' : 'No other tag'), others.map((x) => el('option', { value: x.id }, x.name)));
        const merge = async () => {
          const to = others.find((x) => x.id === target.value);
          if (!to) { msg.textContent = 'Pick the tag to merge into first.'; return; }
          const yes = await UI.confirm(`Merge “${t.name}” into “${to.name}”?`,
            `${plural(n)} with “${t.name}” will have “${to.name}” instead. “${t.name}” is then removed.`, 'Merge');
          if (yes) await run(NS.labels.mergeTags(t.id, to.id), `Merged into ${to.name}`);
        };
        const remove = async () => {
          const yes = await UI.confirm(`Delete tag “${t.name}”?`,
            `It is taken off ${n ? plural(n) : 'every customer, where it is not used'}. Nothing else is deleted.`, 'Delete', { danger: true });
          if (yes) await run(NS.labels.deleteTag(t.id), 'Tag deleted');
        };
        return el('li', { class: 'lab-row' },
          el('span', { class: `tag-chip tg-${t.color}`, 'aria-hidden': 'true' }, t.name.slice(0, 14)),
          name,
          colourSelect(t.color, `Colour of ${t.name}`, (c) => run(NS.labels.recolourTag(t.id, c), 'Colour changed')),
          el('span', { class: 'lab-count' }, plural(n)),
          el('button', { type: 'button', class: 'btn small', onclick: () => run(NS.labels.renameTag(t.id, name.value), 'Tag renamed') }, 'Rename'),
          target, el('button', { type: 'button', class: 'btn small', disabled: !others.length, onclick: merge }, 'Merge'),
          el('button', { type: 'button', class: 'btn small danger', onclick: remove }, 'Delete'));
      };
      const draw = async () => {
        const [lab, cs] = await Promise.all([NS.labels.load(), NS.customers.load()]);
        if (!lab.ok || !cs.ok) { msg.textContent = NS.util.refusal(lab.ok ? cs : lab); return; }
        const counts = NS.labels.countsOf(cs.value, 'tagIds');
        const tags = lab.value.tags;
        body.replaceChildren(note, addRow, msg,
          tags.length
            ? el('ul', { class: 'lab-list', 'aria-label': 'Tags' }, tags.map((t) => row(t, tags, counts.get(t.id) || 0)))
            : el('p', { class: 'empty' }, 'No tags yet. Add one above.'));
      };
      UI.dialog({ title: 'Tags', cls: 'lab-dlg', body, buttons: [{ label: 'Done', primary: true }], onClose: () => resolve() });
      draw();
    });
  }

  NS.tagManager = { open };
})(typeof window !== 'undefined' ? window : globalThis);
