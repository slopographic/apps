/* Slop Cutout — panel kit: form controls for the settings panel. Every control is a row or a widget
 * with `.input` (the form control) and `.sync(v)` (set the shown value without firing events).
 * CO.kit.look() turns a slider drag into one undo step: the look is snapshotted on the first move. */
(function () {
  'use strict';
  const CO = window.CO, U = CO.util, S = CO.state, H = CO.history, h = U.h;
  const K = CO.kit = {};

  const ctl = (el, input, sync) => Object.assign(el, { input, sync });

  /** A titled block of rows (class pp-sec, heading pp-h). */
  K.section = (title, ...kids) => h('section', { class: 'pp-sec' }, h('h3', { class: 'pp-h' }, title), ...kids);
  /** Small grey explanation under a section. */
  K.note = (text) => h('p', { class: 'pp-note' }, text);

  /** Range slider row. onInput runs live while dragging; onCommit runs when the drag ends (change). */
  K.slider = function ({ label, min, max, step, value, fmt = (v) => String(v), onInput, onCommit }) {
    const input = h('input', { type: 'range', min, max, step, 'aria-label': label });
    const out = h('span', { class: 'pp-val' });
    const sync = (v) => { input.value = String(v); out.textContent = fmt(+input.value); };
    sync(value == null ? min : value);
    input.addEventListener('input', () => { out.textContent = fmt(+input.value); if (onInput) onInput(+input.value); });
    input.addEventListener('change', () => { if (onCommit) onCommit(+input.value); });
    return ctl(h('div', { class: 'pp-row' }, h('span', null, label), input, out), input, sync);
  };

  /** Drop-down row. options: [[value, text], …]. */
  K.select = function ({ label, options, value, onChange }) {
    const sel = h('select', { class: 'inp', 'aria-label': label }, ...options.map(([v, t]) => h('option', { value: v }, t)));
    const sync = (v) => { sel.value = String(v); };
    sync(value);
    sel.addEventListener('change', () => { if (onChange) onChange(sel.value); });
    return ctl(h('div', { class: 'pp-row wide' }, h('span', null, label), sel), sel, sync);
  };

  /** Segmented buttons. options: [[value, text, iconName?], …]. */
  K.seg = function ({ options, value, onChange }) {
    let cur = value;
    const btns = options.map(([v, t, icon], i) => {
      const b = h('button', { type: 'button', class: 'seg-b', 'data-i': i });
      if (icon) b.innerHTML = U.icon(icon);
      b.append(t);
      return b;
    });
    const sync = (v) => {
      cur = v;
      btns.forEach((b, i) => { const on = options[i][0] === v; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    };
    btns.forEach((b, i) => b.addEventListener('click', () => {
      const v = options[i][0];
      if (v === cur) return;
      sync(v);
      if (onChange) onChange(v);
    }));
    sync(value);
    return ctl(h('div', { class: 'seg', role: 'group' }, ...btns), null, sync);
  };

  /** Colour row. onInput runs while the picker moves; onCommit when it closes. */
  K.color = function ({ label, value, onInput, onCommit }) {
    const input = h('input', { type: 'color', 'aria-label': label });
    const sync = (v) => { input.value = v; };
    sync(value);
    input.addEventListener('input', () => { if (onInput) onInput(input.value); });
    input.addEventListener('change', () => { if (onCommit) onCommit(input.value); });
    return ctl(h('div', { class: 'pp-row wide' }, h('span', null, label), h('span', { class: 'color' }, input)), input, sync);
  };

  /** Checkbox row. */
  K.check = function ({ label, checked, onChange }) {
    const input = h('input', { type: 'checkbox' });
    const sync = (v) => { input.checked = !!v; };
    sync(checked);
    input.addEventListener('change', () => { if (onChange) onChange(input.checked); });
    return ctl(h('label', { class: 'chk' }, input, h('span', null, label)), input, sync);
  };

  /** Colour swatches. 'transparent' is drawn as a chequer. */
  K.swatches = function ({ colors, value, onChange }) {
    const btns = colors.map((c) => h('button', { type: 'button', class: 'sw' + (c === 'transparent' ? ' transparent' : ''), 'data-c': c, 'aria-label': c }));
    btns.forEach((b, i) => { if (colors[i] !== 'transparent') b.style.background = colors[i]; });
    const sync = (v) => btns.forEach((b, i) => { const on = colors[i] === v; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    btns.forEach((b, i) => b.addEventListener('click', () => { sync(colors[i]); if (onChange) onChange(colors[i]); }));
    sync(value);
    return ctl(h('div', { class: 'swatches', role: 'group' }, ...btns), null, sync);
  };

  /**
   * Look edits for the active image. `apply(it, v)` changes one field of it.look.
   *  input(v): live change (snapshot on the first move, emits 'look').
   *  commit(): the drag ended, push one undo step for the whole drag.
   *  once(v):  a discrete change (check, seg), one undo step.
   * opts.rerun: the field changes the segmentation (e.g. refine), so re-run the model instead of the look.
   */
  K.look = function (label, apply, opts = {}) {
    let snap = null, snapIt = null;
    const change = (it, v) => {
      apply(it, v);
      S.rememberLook(it);
      if (opts.rerun) CO.process.rerun(it); else CO.emit('look', it);
    };
    return {
      input(v) {
        const it = S.current();
        if (!it) return;
        if (!snap || snapIt !== it) { snap = H.snapLook(it); snapIt = it; }
        change(it, v);
      },
      commit() {
        if (snap && snapIt) H.pushLook(snapIt, snap, label);
        snap = null; snapIt = null;
      },
      once(v) {
        const it = S.current();
        if (!it) return;
        const before = H.snapLook(it);
        change(it, v);
        H.pushLook(it, before, label);
      },
    };
  };
})();
