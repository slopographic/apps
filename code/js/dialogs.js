/* Slop Code: the SlopUI dialogs (never a browser alert or confirm). */
import { el } from './dom.js';
import { LANGS, languageById, withExt } from './lang.js';

const UI = () => window.SlopUI;

/** New file: a type (it sets the extension and the language) and a name. Resolves { name, lang } or null. */
export function askNewFile(folderLabel, startId = 'javascript') {
  return new Promise((res) => {
    let picked = null;
    const sel = UI().select(LANGS.map((l) => [l.id, l.label]), startId);
    const name = el('input', { class: 'sui-input', type: 'text', value: withExt('untitled', languageById(startId)),
      'aria-label': 'File name', spellcheck: 'false', autocomplete: 'off' });
    sel.addEventListener('change', () => { name.value = withExt(name.value, languageById(sel.value)); });
    const body = el('div', null, UI().field('Type', sel), UI().field('Name', name),
      el('p', { class: 'sui-p cd-note' }, 'Saved in ' + folderLabel + ' on Slop Drive.'));
    UI().dialog({ title: 'New file', body, buttons: [{ label: 'Cancel' }, { label: 'Create', primary: true, act: () => {
      const v = name.value.trim();
      if (!v) { name.focus(); return false; }
      const lang = languageById(sel.value);
      picked = { name: withExt(v, lang), lang };
    } }], onClose: () => res(picked) });
  });
}

/** The document has unsaved changes. Resolves 'save', 'discard' or 'cancel' (Escape is cancel). */
export function askUnsaved(name) {
  return new Promise((res) => {
    let choice = 'cancel';
    UI().dialog({ title: 'Unsaved changes', body: `“${name}” has changes that are not saved to Slop Drive yet.`, buttons: [
      { label: 'Cancel' },
      { label: 'Discard', danger: true, act: () => { choice = 'discard'; } },
      { label: 'Save', primary: true, act: () => { choice = 'save'; } },
    ], onClose: () => res(choice) });
  });
}

/** Resolves true when the user confirms the move to the Trash. */
export const askTrash = (name, isFolder) => UI().confirm(`Delete “${name}”?`,
  `${isFolder ? 'This folder and its contents' : 'This file'} moves to the Slop Drive Trash, where you can restore it.`,
  'Delete', { danger: true });

/** Language mode: the language for the open file. Resolves the language id, or null on Cancel. */
export function askLanguage(curId) {
  return new Promise((res) => {
    let picked = null;
    const sel = UI().select(LANGS.map((l) => [l.id, l.label]), curId);
    const body = el('div', null, UI().field('Language', sel),
      el('p', { class: 'sui-p cd-note' }, 'Highlighting and completion change for this file. Its name and its Slop Drive record stay as they are.'));
    UI().dialog({ title: 'Language mode', body, buttons: [{ label: 'Cancel' }, { label: 'Set', primary: true, act: () => { picked = sel.value; } }],
      onClose: () => res(picked) });
  });
}
