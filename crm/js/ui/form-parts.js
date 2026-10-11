// Parts shared by the customer form and the detail panel: a labelled field with its message, a section, the editable
// rows of phones, emails and addresses, the photo, avatars, and the picker of tags or groups. Each message element
// carries data-err="<field key>" and each input data-key="<field key>", so the form can show a message by key.
(function (g) {
  'use strict';
  const NS = (g.SlopCrm = g.SlopCrm || {});
  const UI = g.SlopUI;
  const el = UI.el;
  const NOUN = { phone: 'Phone', email: 'Email', address: 'Address' };
  const INPUT_TYPE = { phone: 'tel', email: 'email', address: 'text' };

  /** A labelled field. The key names the message under it and the input for focus and invalid marks. */
  function fld(key, label, input, hint) {
    input.setAttribute('data-key', key);
    return el('div', { class: 'fld' },
      el('label', { class: 'fld-l' }, el('span', { class: 'fld-t' }, label), input),
      hint ? el('span', { class: 'fld-hint' }, hint) : null,
      el('span', { class: 'fld-err', 'data-err': key, role: 'alert' }));
  }

  /** A titled group of fields. */
  const section = (title, ...kids) => el('fieldset', { class: 'fs' }, el('legend', { class: 'fs-h' }, title), el('div', { class: 'fs-body' }, kids));

  /** The initials of a name, for an avatar without a photo. */
  function initials(name) {
    return String(name || '').trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0)).join('').toUpperCase() || '?';
  }

  /** A customer's photo, or its initials. cls is the css class for the size. */
  function avatar(c, cls) {
    return c.photo
      ? el('img', { class: cls, src: c.photo, alt: '', loading: 'lazy' })
      : el('span', { class: `${cls} av-none`, 'aria-hidden': 'true' }, initials(c.name));
  }

  /**
   * Rows of one kind (phone, email or address), edited in place. The first row is the main one. An empty list shows
   * one blank row. Remove takes a row out; the last one is replaced by a blank row.
   */
  function entries(kind, rows) {
    const box = el('div', { class: 'entries' });
    const blank = () => ({ label: NS.fields.DEFAULT_LABEL[kind], value: '' });
    const draw = () => {
      if (!rows.length) rows.push(blank());
      box.replaceChildren(...rows.map((r, i) => {
        const key = `${kind}:${i}`;
        const opts = NS.fields.LABELS[kind].includes(r.label) ? NS.fields.LABELS[kind] : [r.label, ...NS.fields.LABELS[kind]];
        const label = el('select', { 'aria-label': `${NOUN[kind]} ${i + 1} label`, onchange: (e) => { r.label = e.target.value; } },
          opts.map((x) => el('option', { value: x, selected: x === r.label }, x)));
        const value = el('input', { type: INPUT_TYPE[kind], value: r.value, maxlength: NS.fields.LIMIT[kind], autocomplete: 'off',
          'aria-label': `${NOUN[kind]} ${i + 1}`, 'data-key': key, oninput: (e) => { r.value = e.target.value; } });
        const remove = el('button', { type: 'button', class: 'btn small', 'aria-label': `Remove ${NOUN[kind].toLowerCase()} ${i + 1}`,
          onclick: () => { rows.splice(i, 1); draw(); } }, '×');
        return el('div', { class: 'entry' }, label, value, remove, el('span', { class: 'fld-err', 'data-err': key, role: 'alert' }));
      }), el('button', { type: 'button', class: 'btn small add-row', disabled: rows.length >= NS.fields.MAX_ROWS,
        onclick: () => { rows.push(blank()); draw(); } }, `+ Add ${NOUN[kind].toLowerCase()}`));
    };
    draw();
    return box;
  }

  /** The photo: the picture or the initials, with Add, Change and Remove. The value is kept in v.photo. */
  function photo(v) {
    const box = el('div', { class: 'photo' });
    let note = '';
    const draw = () => {
      box.replaceChildren(avatar({ photo: v.photo, name: v.name }, 'av av-lg'), el('div', { class: 'photo-ctl' },
        el('button', { type: 'button', class: 'btn small', onclick: async () => {
          const files = await UI.pickFiles({ accept: 'image/*' });
          if (!files || !files[0]) return;
          try {
            const url = await NS.photo.shrink(files[0]);
            note = url ? '' : 'That picture is too large, even when smaller. Try another.';
            if (url) v.photo = url;
          } catch (e) { note = 'That file is not a picture we can read.'; }
          draw();
        } }, v.photo ? 'Change photo' : 'Add photo'),
        v.photo ? el('button', { type: 'button', class: 'btn small', onclick: () => { v.photo = ''; note = ''; draw(); } }, 'Remove photo') : null,
        el('span', { class: 'fld-err', 'data-err': 'photo', role: 'alert' }, note)));
    };
    draw();
    return box;
  }

  const chip = (kind, x, onX) => el('span', { class: kind === 'tag' ? `tag-chip tg-${x.color}` : 'tag-chip grp' }, x.name,
    el('button', { type: 'button', class: 'chip-x', 'aria-label': `Remove ${x.name}`, onclick: onX }, '×'));

  /**
   * Tags or groups of one customer: chips to remove, a picker to add, and a link to the manager. onChange gets the
   * new list of ids each time it changes. The picker reloads the labels, so a new tag shows at once.
   */
  function labelPicker(kind, ids, onChange) {
    const word = kind === 'tag' ? 'tag' : 'group';
    const box = el('div', { class: 'lp' });
    let cur = (ids || []).slice();
    const set = (next) => { cur = next; onChange(next); draw(); };
    const draw = async () => {
      const r = await NS.labels.load();
      if (!r.ok) { box.replaceChildren(el('p', { class: 'msg' }, NS.util.refusal(r))); return; }
      const all = kind === 'tag' ? r.value.tags : r.value.groups;
      const on = all.filter((x) => cur.includes(x.id));
      const free = all.filter((x) => !cur.includes(x.id));
      const pick = el('select', { 'aria-label': `Add a ${word}`, disabled: !free.length },
        el('option', { value: '' }, free.length ? `Add a ${word}…` : `No more ${word}s to add`), free.map((x) => el('option', { value: x.id }, x.name)));
      box.replaceChildren(
        on.length ? el('div', { class: 'chips' }, on.map((x) => chip(kind, x, () => set(cur.filter((i) => i !== x.id))))) : el('p', { class: 'note' }, `None yet.`),
        el('div', { class: 'inline' }, pick,
          el('button', { type: 'button', class: 'btn small', onclick: () => { if (pick.value) set(NS.labels.withId(cur, pick.value)); } }, 'Add'),
          el('button', { type: 'button', class: 'btn small', onclick: async () => {
            await (kind === 'tag' ? NS.tagManager.open() : NS.groupsPanel.open());
            draw();
          } }, kind === 'tag' ? 'Manage tags' : 'Manage groups')));
    };
    draw();
    return box;
  }

  NS.parts = { fld, section, initials, avatar, entries, photo, labelPicker };
})(typeof window !== 'undefined' ? window : globalThis);
