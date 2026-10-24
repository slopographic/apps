/* Slop Signature: an email signature from a short form, seen in a mock email as it is typed, then copied into Gmail,
 * Outlook or Apple Mail (Copy signature puts the formatted signature and a plain-text one on the clipboard), or taken as
 * HTML. What was typed is kept in this browser (localStorage, through try/catch) so the page opens where it was left.
 * A link may name the mail program (?mail=gmail|outlook|outlook-web|apple, from a task page): its steps open, the others
 * close, for this visit only (presetOf; unknown values are ignored, nothing is stored).
 * Classic script, after model.js, templates.js and form.js. Sets SlopSignature.app = { state, render, copy, copyCode, download, reset, example, presetOf }. */
(function (g) {
  'use strict';
  const NS = (g.SlopSignature = g.SlopSignature || {});
  const M = NS.model, T = NS.templates, F = NS.form, UI = g.SlopUI;
  const KEY = 'slop-signature';
  const $ = (id) => document.getElementById(id);
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
  const save = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* not kept: the page still works */ } };
  let state = load() || M.sample(), current = { html: '', text: '' };

  function render() {
    state = F.read();
    save(state);
    const s = M.clean(state);
    current = { html: T.html(s), text: T.text(s) };
    $('sgSig').innerHTML = current.html;   // the templates escape every typed value
    $('sgEmpty').hidden = !!current.html;
    const probs = M.problems(state);
    $('sgProblems').replaceChildren(...probs.map((p) => UI.el('li', null, p.text)));
    $('sgProblems').hidden = !probs.length;
    for (const id of ['sgCopy', 'sgCode', 'sgDownload']) $(id).disabled = !current.html;
  }
  const say = (t) => { $('sgMsg').textContent = t; };

  /** The formatted signature and its plain text, on the clipboard. Where the browser refuses the clipboard, the signature
   *  is selected and copied the old way, which keeps the formatting too. */
  async function copy() {
    if (!current.html) return false;
    const html = `<div style="font-family:${M.clean(state).font}">${current.html}</div>`;
    const ok = g.SlopBuffer && g.SlopBuffer.writeSystem ? await g.SlopBuffer.writeSystem({ t: Date.now(), formats: { 'text/html': html, 'text/plain': current.text } }) : false;
    if (!ok) {
      const r = document.createRange(), sel = getSelection();
      r.selectNodeContents($('sgSig')); sel.removeAllRanges(); sel.addRange(r);
      try { document.execCommand('copy'); } catch (e) { /* the selection stays for Ctrl+C */ }
    }
    say('Copied. Paste it into the signature box of your mail program (steps below).');
    return true;
  }
  async function copyCode() {
    try { await navigator.clipboard.writeText(current.html); say('The HTML is copied.'); } catch (e) { say('The browser did not allow copying: use Download HTML.'); }
  }
  function download() {
    const s = M.clean(state), name = (s.name || 'signature').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'signature';
    const page = `<!doctype html>\n<html><head><meta charset="utf-8"><title>${M.esc(s.name || 'Signature')}</title></head><body>\n${current.html}\n</body></html>\n`;
    UI.download(new Blob([page], { type: 'text/html' }), `${name}-signature.html`);
  }
  function reset() { F.fill(M.blank()); render(); say('Cleared. Type your details.'); }
  function example() { F.fill(M.sample()); render(); say(''); }

  const MAILS = ['gmail', 'outlook', 'outlook-web', 'apple'];
  /** The preset in a page address: { mail } when it names a known mail program, else {}. Pure. */
  function presetOf(search) {
    const mail = new URLSearchParams(search || '').get('mail');
    return MAILS.includes(mail) ? { mail } : {};
  }
  /** Opens the steps for one mail program and closes the others. */
  function showMail(mail) {
    for (const d of document.querySelectorAll('.sg-how details[data-mail]')) d.open = d.dataset.mail === mail;
  }

  function mount() {
    F.mount($('sgForm'), state, render);
    $('sgCopy').addEventListener('click', copy);
    $('sgCode').addEventListener('click', copyCode);
    $('sgDownload').addEventListener('click', download);
    $('sgReset').addEventListener('click', reset);
    $('sgExample').addEventListener('click', example);
    const preset = presetOf(location.search);
    if (preset.mail) showMail(preset.mail);
    render();
  }

  mount();
  NS.app = { get state() { return state; }, get current() { return current; }, render, copy, copyCode, download, reset, example, presetOf };
})(typeof window !== 'undefined' ? window : globalThis);
