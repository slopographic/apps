// Two parts of the task editor: the checklist (tick, edit, remove and add items) and "Waits for" (the tasks that must
// finish first; one that would make a loop is refused in plain words). Each returns { el, value() }; nothing is saved
// until the editor's Save. Exposes window.SlopProjects.editorParts.
(function (g) {
  'use strict';
  const NS = (g.SlopProjects = g.SlopProjects || {});
  const UI = g.SlopUI, el = UI.el;

  /** The checklist: items [{ text, done }]. */
  function checklist(items) {
    let list = (items || []).map((c) => ({ text: c.text, done: !!c.done }));
    const ul = el('ul', { class: 'pe-check', 'aria-label': 'Checklist' });
    const input = el('input', { type: 'text', id: 'peCheckNew', maxlength: 200, placeholder: 'Add an item', 'aria-label': 'New checklist item', autocomplete: 'off' });
    const count = el('span', { class: 'note' });
    const draw = () => {
      ul.replaceChildren(...list.map((c, i) => el('li', { class: c.done ? 'is-done' : '' },
        el('input', { type: 'checkbox', checked: c.done, 'aria-label': `Done: ${c.text}`, onchange: (e) => { c.done = e.target.checked; draw(); } }),
        el('input', { type: 'text', value: c.text, maxlength: 200, 'aria-label': `Checklist item ${i + 1}`, oninput: (e) => { c.text = e.target.value; } }),
        el('button', { type: 'button', class: 'pe-x', 'aria-label': `Remove ${c.text}`, onclick: () => { list.splice(i, 1); draw(); input.focus(); } }, '×'))));
      const done = list.filter((c) => c.done).length;
      count.textContent = list.length ? `${done} of ${list.length} done` : '';
    };
    const add = () => { const v = input.value.trim(); if (!v) return; if (list.length >= 100) { UI.toast('A checklist holds at most 100 items.'); return; } list.push({ text: v, done: false }); input.value = ''; draw(); input.focus(); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); add(); } });
    draw();
    return {
      el: el('div', { class: 'pe-sec' }, el('div', { class: 'pe-sec-h' }, el('span', null, 'Checklist'), count), ul,
        el('div', { class: 'inline' }, input, el('button', { type: 'button', class: 'btn small', onclick: add }, 'Add'))),
      value: () => list.map((c) => ({ text: String(c.text || '').trim(), done: !!c.done })).filter((c) => c.text),
    };
  }

  /** "Waits for": the deps of task `id` among the project's tasks (id is null for a new task). */
  function waitsFor(id, deps, tasks) {
    let cur = (deps || []).filter((d) => tasks.some((t) => t.id === d));
    const others = tasks.filter((t) => t.id !== id);
    const chips = el('div', { class: 'pe-deps' });
    const pick = el('select', { id: 'peDepAdd', 'aria-label': 'Add a task this one waits for' });
    const name = (d) => (tasks.find((t) => t.id === d) || {}).title || '';
    const draw = () => {
      chips.replaceChildren(...(cur.length ? cur.map((d) => el('span', { class: 'chip dep' }, name(d),
        el('button', { type: 'button', class: 'pe-x', 'aria-label': `Stop waiting for ${name(d)}`, onclick: () => { cur = cur.filter((x) => x !== d); draw(); } }, '×')))
        : [el('span', { class: 'note' }, 'Nothing: it can start any time.')]));
      pick.replaceChildren(el('option', { value: '' }, 'Add a task it waits for…'),
        ...others.filter((t) => !cur.includes(t.id)).sort((a, b) => a.title.localeCompare(b.title)).map((t) => el('option', { value: t.id }, t.title)));
    };
    pick.addEventListener('change', () => {
      const v = pick.value;
      if (!v) return;
      const r = id ? NS.deps.check(tasks, id, [...cur, v]) : { ok: true, value: [...cur, v] };
      if (!r.ok) { UI.toast(r.message, 5000); pick.value = ''; return; }
      cur = r.value;
      draw();
      pick.focus();
    });
    draw();
    const waiting = id ? NS.deps.successors(tasks, id) : [];
    return {
      el: el('div', { class: 'pe-sec' }, el('div', { class: 'pe-sec-h' }, el('span', null, 'Waits for (finish before this starts)')), chips, pick,
        waiting.length ? el('p', { class: 'note' }, `Waiting for this: ${waiting.map((t) => t.title).join(', ')}.`) : null),
      value: () => cur.slice(),
    };
  }

  NS.editorParts = { checklist, waitsFor };
})(typeof window !== 'undefined' ? window : globalThis);
