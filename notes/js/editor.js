/* The editor pane: title, tags, Markdown source and the live preview. Typing saves in the background (store.touch). */
import * as store from './store.js';
import { S, curNote } from './state.js';
import * as A from './actions.js';
import { render } from './markdown.js';
import { $ } from './dom.js';

const tagsFrom = (text) => [...new Set(String(text).split(',').map((t) => t.trim().replace(/^#/, '').toLowerCase()).filter(Boolean))].slice(0, 30);

export function renderPreview() {
  const n = curNote();
  $('nt-preview').innerHTML = render(n ? n.body : '');
}

function applyMode() {
  const panes = $('nt-panes');
  panes.dataset.mode = S.mode;
  for (const b of document.querySelectorAll('[data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === S.mode));
}

export function renderEditor() {
  const n = curNote();
  $('nt-empty-note').hidden = !!n;
  $('nt-note').hidden = !n;
  if (!n) return;
  $('nt-title').value = n.title;
  $('nt-tags-in').value = n.tags.join(', ');
  $('nt-body').value = n.body;
  $('nt-pin').textContent = n.pinned ? 'Unpin' : 'Pin';
  $('nt-pin').setAttribute('aria-pressed', String(n.pinned));
  renderPreview();
  applyMode();
}

export function setMode(mode) {
  S.mode = mode;
  applyMode();
}

/** Connects the editor controls. redraw refreshes the list and sidebar after a title or tag change. */
export function wireEditor(redraw) {
  $('nt-title').addEventListener('input', (e) => {
    const n = curNote(); if (!n) return;
    n.title = e.target.value;
    store.touch(n);
    redraw.list();
  });
  $('nt-tags-in').addEventListener('input', (e) => {
    const n = curNote(); if (!n) return;
    n.tags = tagsFrom(e.target.value);
    store.touch(n);
    redraw.side(); redraw.list();
  });
  $('nt-body').addEventListener('input', (e) => {
    const n = curNote(); if (!n) return;
    n.body = e.target.value;
    store.touch(n);
    renderPreview();
    redraw.list();
  });
  for (const b of document.querySelectorAll('[data-mode]')) b.addEventListener('click', () => setMode(b.dataset.mode));
  $('nt-pin').addEventListener('click', () => A.togglePin());
  $('nt-back').addEventListener('click', () => A.setPane('list'));
}
