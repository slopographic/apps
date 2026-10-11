/* Slop Code: the Extensions panel. Built-in helpers only, nothing is downloaded: a formatter, a language mode
 * switcher and snippets. Each is a toggle, kept per viewer (slop-code.extensions). The actions here are also
 * commands in the palette. */
import * as docs from './docs.js';
import { el } from './dom.js';
import { env, toast, setStatus } from './ui.js';
import { HELPER_IDS, helperOn, setHelperOn } from './prefs.js';
import { formatText } from './format.js';
import { langOf, languageById } from './lang.js';
import { setLanguage } from './editor.js';
import { askLanguage } from './dialogs.js';

const INFO = {
  formatter: { title: 'Formatter', desc: 'Format document (Shift+Alt+F). Re-indents JSON, JavaScript, TypeScript and CSS, and removes trailing spaces.', button: 'Format document' },
  languageMode: { title: 'Language mode switcher', desc: 'Change the language of the open file, for highlighting and completion. The file name stays.', button: 'Set language…' },
  snippets: { title: 'Snippets', desc: 'Snippet completions with Ctrl+Space, for example log, fn, html5, flex, def and table.' },
};

/** Format the open file with the formatter. Returns true when it ran. */
export function formatDoc() {
  const d = docs.current(), view = env.view;
  if (!d || !view) { toast('Open a file first'); return false; }
  if (!helperOn('formatter')) { toast('The formatter is off. Turn it on in Extensions.'); return false; }
  const before = view.state.doc.toString();
  let out;
  try { out = formatText(before, langOf(d).id); } catch (e) { toast(e.message); return false; }
  if (out === before) { toast('Already formatted'); return true; }
  view.dispatch({ changes: { from: 0, to: before.length, insert: out }, selection: { anchor: Math.min(view.state.selection.main.head, out.length) } });
  toast('Formatted');
  return true;
}

/** Ask for a language and apply it to the open file. Returns true when the language changed. */
export async function chooseLanguage() {
  const d = docs.current(), view = env.view;
  if (!d || !view) { toast('Open a file first'); return false; }
  if (!helperOn('languageMode')) { toast('The language mode switcher is off. Turn it on in Extensions.'); return false; }
  const id = await askLanguage(langOf(d).id);
  if (!id) return false;
  const lang = languageById(id);
  d.langId = id;
  setLanguage(view, lang);
  setStatus();
  toast('Language: ' + lang.label);
  return true;
}

const ACTIONS = { formatter: formatDoc, languageMode: chooseLanguage };

/** Draw the helper list into `host`: a title, a description, an optional button, and an On/Off switch. */
export function renderExtensions(host) {
  if (!host) return;
  host.replaceChildren(...HELPER_IDS.map((id) => {
    const info = INFO[id];
    const state = el('span', { class: 'cd-switch-txt' }, helperOn(id) ? 'On' : 'Off');
    const box = el('input', { type: 'checkbox', role: 'switch', id: 'cd-ext-' + id, 'aria-describedby': 'cd-ext-desc-' + id,
      onchange: (e) => { setHelperOn(id, e.target.checked); state.textContent = e.target.checked ? 'On' : 'Off'; setStatus(); } });
    box.checked = helperOn(id);
    return el('li', { class: 'cd-ext' },
      el('div', { class: 'cd-ext-main' },
        el('label', { class: 'cd-ext-name', for: 'cd-ext-' + id }, info.title),
        el('p', { class: 'cd-ext-desc', id: 'cd-ext-desc-' + id }, info.desc),
        info.button ? el('button', { type: 'button', class: 'sui-btn cd-mini', onclick: () => ACTIONS[id]() }, info.button) : null),
      el('label', { class: 'cd-switch' }, box, state));
  }));
}
