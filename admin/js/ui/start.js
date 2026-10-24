// The Get started tab: the first steps with the business apps (SlopBiz.setup, shared/biz/setup.js), each ticked once it is
// done in the shared data, with a link to the app that does it, and how far along you are.
(function (g) {
  'use strict';
  const NS = (g.SlopAdmin = g.SlopAdmin || {});
  const el = g.SlopUI.el;
  const $ = (id) => document.getElementById(id);

  async function render() {
    const r = await g.SlopBiz.setup.load();
    if (!r.ok) { $('sMsg').textContent = NS.util.refusal(r); return; }
    const { steps, done, total } = r.value;
    $('sProgress').value = done;
    $('sProgress').max = total;
    $('sCount').textContent = done === total ? 'All set. Every business app is ready to use.' : `${done} of ${total} done`;
    $('sSteps').replaceChildren(...steps.map((s) => el('li', { class: `start-step${s.done ? ' is-done' : ''}`, 'data-step': s.id },
      el('span', { class: 'start-mark', 'aria-hidden': 'true' }, s.done ? '✓' : ''),
      el('span', { class: 'start-text' }, el('b', {}, s.title), el('span', { class: 'sub' }, s.why)),
      el('a', { class: `btn small${s.done ? '' : ' primary'}`, href: `../${s.href}` }, s.done ? 'Open' : 'Start'),
      el('span', { class: 'sr' }, s.done ? 'Done' : 'Not done yet'))));
  }

  NS.views = NS.views || {};
  NS.views.start = { mount: () => {}, render };
  NS.start = { render };
})(typeof window !== 'undefined' ? window : globalThis);
