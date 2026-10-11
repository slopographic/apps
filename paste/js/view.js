/* The Paste screen: the paste list, and the open paste (fields, highlighted text or image, and the share link). */
import * as store from './store.js';
import { S, current, visible, firstLine } from './state.js';
import { highlight, LANGS } from './highlight.js';
import { expiryLabel, EXPIRY_OPTIONS } from './store.js';
import { $, el, clear, dateText } from './dom.js';

const langName = (k) => (LANGS.find(([v]) => v === k) || LANGS[0])[1];

let openFn = () => {};
/** The action a list item calls with its paste's Drive id (set by actions.js). */
export const onOpen = (fn) => { openFn = fn; };

export function renderList() {
  const box = clear($('pb-items'));
  const items = visible();
  for (const p of items) {
    const meta = [p.kind === 'image' ? 'Image' : langName(p.language), expiryLabel(p.expiry), dateText(p.modified)].join(' · ');
    box.append(el('button', { class: 'pb-item' + (p.id === S.id ? ' on' : ''), type: 'button', 'data-kind': 'paste', 'data-id': p.id,
      'aria-current': p.id === S.id ? 'true' : null, onclick: () => openFn(p.id) },
    el('span', { class: 'pb-item-title' }, p.title || (p.kind === 'image' ? 'Image paste' : 'Untitled paste')),
    el('span', { class: 'pb-item-snip' }, firstLine(p) || 'Empty paste'),
    el('span', { class: 'pb-item-meta' }, meta)));
  }
  const none = $('pb-none');
  none.hidden = items.length > 0;
  none.textContent = S.pastes.length ? 'No pastes match.' : 'No pastes yet. Paste text or an image anywhere on this page, or use New paste.';
}

/** Fills the language and expiry selects once. */
function fillSelects() {
  const lang = $('pb-lang');
  if (!lang.options.length) for (const [v, l] of LANGS) lang.append(el('option', { value: v }, l));
  const exp = $('pb-expiry');
  if (!exp.options.length) for (const [v, l] of EXPIRY_OPTIONS) exp.append(el('option', { value: v }, l));
}

export function renderPaste() {
  fillSelects();
  const p = current();
  $('pb-empty').hidden = !!p;
  $('pb-editor').hidden = !p;
  if (!p) return;
  const isImg = p.kind === 'image';
  $('pb-text-wrap').hidden = isImg;
  $('pb-image-wrap').hidden = !isImg;
  $('pb-title').value = p.title;
  $('pb-lang').value = p.language;
  $('pb-expiry').value = p.expiry;
  $('pb-lang').disabled = isImg;
  $('pb-meta').textContent = (isImg ? 'Image paste' : 'Text paste') + ' · ' + expiryLabel(p.expiry) + ' (label only, nothing is deleted)';
  if (isImg) {
    if (p.url) URL.revokeObjectURL(p.url);
    p.url = p.blob ? URL.createObjectURL(p.blob) : '';
    $('pb-img').src = p.url;
  } else {
    $('pb-src').value = p.body;
    renderHighlight();
  }
  $('pb-share-box').hidden = true;
}

/** The highlighted copy of the open text paste, in the language chosen for it. */
export function renderHighlight() {
  const p = current();
  if (!p || p.kind === 'image') return;
  const code = $('pb-code');
  code.className = 'language-' + p.language;
  code.innerHTML = highlight(p.body, p.language);
  code.parentElement.dataset.lang = p.language;
}

export function renderAll() {
  renderList();
  renderPaste();
  $('pb-app').dataset.pane = S.pane;
}

export function showLink(url) {
  const box = $('pb-share-box');
  box.hidden = false;
  const input = $('pb-link');
  input.value = url;
  input.focus();
  input.select();
}

/** Connects the editor controls. Text and field edits save in the background through store.touch. */
export function wireView(actions) {
  const cur = () => current();
  $('pb-src').addEventListener('input', (e) => {
    const p = cur(); if (!p) return;
    p.body = e.target.value;
    store.touch(p);
    renderHighlight();
    renderList();
  });
  $('pb-title').addEventListener('input', (e) => {
    const p = cur(); if (!p) return;
    p.title = e.target.value;
    store.touch(p);
    renderList();
  });
  $('pb-lang').addEventListener('change', (e) => {
    const p = cur(); if (!p) return;
    p.language = e.target.value;
    store.touch(p);
    renderHighlight();
    renderList();
  });
  $('pb-expiry').addEventListener('change', (e) => {
    const p = cur(); if (!p) return;
    p.expiry = e.target.value;
    store.touch(p);
    $('pb-meta').textContent = (p.kind === 'image' ? 'Image paste' : 'Text paste') + ' · ' + expiryLabel(p.expiry) + ' (label only, nothing is deleted)';
    renderList();
  });
  $('pb-copy').addEventListener('click', () => actions.copy(cur()));
  $('pb-download').addEventListener('click', () => actions.download(cur()));
  $('pb-share').addEventListener('click', () => actions.share(cur()));
  $('pb-del').addEventListener('click', () => actions.remove(cur()));
  $('pb-back').addEventListener('click', () => actions.setPane('list'));
  $('pb-q').addEventListener('input', (e) => { S.query = e.target.value; renderList(); });
}
