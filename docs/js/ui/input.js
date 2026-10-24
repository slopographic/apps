/* Slop Docs — ui/input: keyboard, text input (through a hidden textarea, so IME, mobile keyboards and spell
 * check work), the pointer (click, drag, double and triple click) and the clipboard. Classic script. Key
 * shortcuts with Ctrl or ⌘ are SlopCmd commands (ui/commands.js); this file only falls back to them without SlopCmd. */
(function () {
  'use strict';
  const S = window.SlopDocs, A = () => S.A;
  const E = () => window.SlopDocEngine;
  const ime = () => document.getElementById('ime');
  const pages = () => document.getElementById('pages');
  let drag = null;   // { anchor } while the pointer is down over the text

  /** Keep the hidden input focused: it receives every key the document types. */
  S.focusIme = function () {
    const t = ime();
    if (t && document.activeElement !== t) { try { t.focus({ preventScroll: true }); } catch (e) { t.focus(); } }
  };
  const NAV = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Home: 'home', End: 'end' };

  function onKey(e) {
    if (e.isComposing || e.keyCode === 229) return;
    const key = e.key;
    if (NAV[key]) {
      e.preventDefault();
      const dir = NAV[key], mod = e.ctrlKey || e.metaKey;
      const word = (key === 'ArrowLeft' || key === 'ArrowRight') && (e.ctrlKey || e.altKey) && !e.metaKey;
      const lineEdge = (key === 'ArrowLeft' || key === 'ArrowRight') && e.metaKey;
      const opts = { extend: e.shiftKey, word, doc: (dir === 'home' || dir === 'end' || dir === 'up' || dir === 'down') && mod };
      if (lineEdge) A().move(key === 'ArrowLeft' ? 'home' : 'end', opts);
      else A().move(dir, opts);
      return;
    }
    if (e.ctrlKey || e.metaKey) { if (!window.SlopCmd) fallbackMod(e); return; }
    if (e.altKey) return;
    if (key === 'Backspace') { e.preventDefault(); A().backspace(); }
    else if (key === 'Delete') { e.preventDefault(); A().del(); }
    else if (key === 'Enter') { e.preventDefault(); A().enter(); }
    else if (key === 'Tab') { e.preventDefault(); if (!e.shiftKey) A().type('\t'); }
    else if (key === 'PageDown' || key === 'PageUp') { e.preventDefault(); for (let i = 0; i < 20; i++) A().move(key === 'PageDown' ? 'down' : 'up', { extend: e.shiftKey }); }
  }
  /** Shortcuts when SlopCmd is not loaded (the offline or script-blocked case). */
  function fallbackMod(e) {
    const k = (e.key || '').toLowerCase();
    const map = { b: () => A().toggle('b'), i: () => A().toggle('i'), u: () => A().toggle('u'), a: () => A().selectAll(), z: () => (e.shiftKey ? A().redo() : A().undo()), y: () => A().redo() };
    if (map[k]) { e.preventDefault(); map[k](); }
    if (k === 's' && S.save) { e.preventDefault(); S.save(); }
  }

  const input = ime();
  input.addEventListener('keydown', onKey);
  input.addEventListener('input', (e) => {
    if (e.isComposing) return;
    const t = input.value;
    input.value = '';
    const type = e.inputType || '';
    if (type === 'deleteContentBackward') A().backspace();
    else if (type === 'deleteContentForward') A().del();
    else if (type === 'insertParagraph' || type === 'insertLineBreak') A().enter();
    else if (type === 'insertFromPaste' || type === 'insertFromDrop') return;
    else { const text = t || e.data || ''; if (text) A().type(text.replace(/\r\n?/g, '\n')); }
  });
  input.addEventListener('compositionend', () => { const t = input.value; input.value = ''; if (t) A().type(t); });
  input.addEventListener('paste', (e) => {
    e.preventDefault();
    if (A().pasteBuffer && A().pasteBuffer()) return; // the shared buffer, when it is newer than this document's last copy
    A().paste((e.clipboardData && e.clipboardData.getData('text/plain')) || '');
  });
  input.addEventListener('copy', (e) => {
    const t = A().copyText();
    if (e.clipboardData && t) e.clipboardData.setData('text/plain', t);
    e.preventDefault();
  });
  input.addEventListener('cut', (e) => {
    const t = A().cut();
    if (e.clipboardData && t) e.clipboardData.setData('text/plain', t);
    e.preventDefault();
  });

  /* ---------- pointer ---------- */
  // A mouse: press places the caret (double: the word, triple: the paragraph), drag selects, Shift extends.
  // A finger or a pen: the page scrolls under a drag, as on any phone, so the caret moves on the tap (the finger's lift,
  // unless it moved or a long press opened the menu); a double tap selects the word, a triple tap the paragraph. The
  // header and footer open on a double tap through the touch layer's dblclick (hf.js).
  const finger = (e) => e.pointerType === 'touch' || e.pointerType === 'pen';
  let press = null, taps = { n: 0, t: 0, x: 0, y: 0 };
  function place(h, count, shift) {
    const pos = { b: h.b, o: h.o };
    const p = S.doc.blocks[h.b], t = p && p.type === 'p' ? E().M.paraText(p) : '';
    let anchor = pos;
    if (count >= 3) { anchor = { b: h.b, o: 0 }; S.select(anchor, { b: h.b, o: t.length }); }
    else if (count === 2) { const w = E().O.wordAt(t, h.o); anchor = { b: h.b, o: w.s }; S.select(anchor, { b: h.b, o: w.e }); }
    else if (shift) { anchor = S.sel.a; S.select(anchor, pos); }
    else S.select(pos, pos);
    return anchor;
  }
  const fingerDown = (e) => { press = { id: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now(), shift: e.shiftKey }; };
  pages().addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const h = S.R.hit(e.clientX, e.clientY);
    if (!h) return;
    if (finger(e)) { fingerDown(e); return; }
    e.preventDefault();
    S.focusIme();
    drag = { anchor: place(h, e.detail, e.shiftKey) };
  });
  function tap(e) {
    const p = press;
    press = null;
    if (!p || e.pointerId !== p.id || Date.now() - p.t > 500 || Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) return;
    const h = S.R.hit(e.clientX, e.clientY);
    if (!h) return;
    const now = Date.now(), near = Math.hypot(e.clientX - taps.x, e.clientY - taps.y) <= 24;
    taps = { n: near && now - taps.t < 350 ? taps.n % 3 + 1 : 1, t: now, x: e.clientX, y: e.clientY };
    S.focusIme(); // in the pointerup, a user gesture: iOS shows the keyboard
    place(h, taps.n, p.shift);
  }
  window.addEventListener('pointermove', (e) => {
    if (press && e.pointerId === press.id && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) press = null;
    if (!drag) return;
    const h = S.R.hit(e.clientX, e.clientY);
    if (h) S.select(drag.anchor, { b: h.b, o: h.o });
  });
  window.addEventListener('pointerup', (e) => { drag = null; if (press) tap(e); });
  window.addEventListener('pointercancel', () => { drag = null; press = null; });
  window.addEventListener('contextmenu', () => { press = null; }, true); // a long press opened the menu: not a tap
})();
