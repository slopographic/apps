/* SlopGuides panel: the Form / Notation / Intervals tabs and the preset actions menu. */
(function (root) {
  'use strict';
  const SG = root.SlopGuides = root.SlopGuides || {};

  /** A text input bound to obj[key]; accepts numbers with units ('10px', '5%'). */
  function lenInput(el, obj, key, label, placeholder, onInput) {
    const i = el('input', { type: 'text', class: 'sgd-in sgd-num', 'aria-label': label, title: label, placeholder: placeholder || '', spellcheck: 'false', autocomplete: 'off' });
    i.value = obj[key] == null ? '' : obj[key];
    i.addEventListener('input', () => { obj[key] = i.value.trim(); i.classList.toggle('sgd-bad', !!i.value.trim() && !SG.parseLen(i.value)); onInput(i); });
    i.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      const l = SG.parseLen(i.value || '0'); if (!l) return;
      e.preventDefault();
      const step = (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? 1 : -1), v = Math.round((l.v + step) * 1000) / 1000;
      i.value = /[a-z%]$/i.test(i.value.trim()) ? v + l.u : String(v);
      i.dispatchEvent(new Event('input'));
    });
    return i;
  }
  function check(el, obj, key, label, onChange) {
    const c = el('input', { type: 'checkbox' }); c.checked = !!obj[key];
    c.addEventListener('change', () => { obj[key] = c.checked; onChange(); });
    return el('label', { class: 'sgd-chk' }, c, el('span', null, label));
  }
  const group = (el, title, ...kids) => el('fieldset', { class: 'sgd-group' }, el('legend', null, title), ...kids);
  const cells = (el, ...kids) => el('div', { class: 'sgd-cells' }, ...kids);
  const cell = (el, label, input) => el('label', { class: 'sgd-cell' }, input, el('span', null, label));

  function formTab(st, update, el) {
    const f = st.form, m = f.margins;
    const sides = ['top', 'right', 'bottom', 'left'], ins = {};
    const onMargin = (src) => { if (f.link) for (const s of sides) if (ins[s] !== src) { ins[s].value = src.value; m[s] = src.value.trim(); } update(); };
    for (const s of sides) ins[s] = lenInput(el, m, s, `${s[0].toUpperCase() + s.slice(1)} margin`, '0', onMargin);
    const link = el('button', { type: 'button', class: 'sgd-btn sgd-icon sgd-link' + (f.link ? ' sgd-on' : ''), 'aria-pressed': String(!!f.link), title: 'Link the four margins', 'aria-label': 'Link margins' }, '⛓');
    link.addEventListener('click', () => {
      f.link = !f.link; link.classList.toggle('sgd-on', f.link); link.setAttribute('aria-pressed', String(f.link));
      if (f.link) { const v = sides.map((s) => m[s]).find((x) => x) || ''; for (const s of sides) { m[s] = v; ins[s].value = v; } update(); }
    });
    const c = f.cols, r = f.rows, u = () => update();
    const bl = f.baseline || (f.baseline = { on: false, step: '', offset: '' });
    return el('div', { class: 'sgd-form' },
      group(el, 'Margins', el('div', { class: 'sgd-cells sgd-cells5' }, cell(el, 'Top', ins.top), cell(el, 'Right', ins.right), cell(el, 'Bottom', ins.bottom), cell(el, 'Left', ins.left), link)),
      group(el, 'Columns', cells(el, cell(el, 'Count', lenInput(el, c, 'count', 'Number of columns', '–', u)), cell(el, 'Width', lenInput(el, c, 'width', 'Column width', 'auto', u)), cell(el, 'Gutter', lenInput(el, c, 'gutter', 'Column gutter', '0', u)))),
      group(el, 'Rows', cells(el, cell(el, 'Count', lenInput(el, r, 'count', 'Number of rows', '–', u)), cell(el, 'Height', lenInput(el, r, 'height', 'Row height', 'auto', u)), cell(el, 'Gutter', lenInput(el, r, 'gutter', 'Row gutter', '0', u)))),
      group(el, 'Also add',
        el('div', { class: 'sgd-checks' }, check(el, f, 'colMid', 'Column midpoints', u), check(el, f, 'rowMid', 'Row midpoints', u), check(el, f, 'midV', 'Vertical centre', u), check(el, f, 'midH', 'Horizontal centre', u), check(el, f, 'edges', 'Outer edges', u), check(el, bl, 'on', 'Baseline grid', u)),
        cells(el, cell(el, 'Baseline every', lenInput(el, bl, 'step', 'Baseline step', '24', u)), cell(el, 'Offset', lenInput(el, bl, 'offset', 'Baseline offset', '0', u)))));
  }

  function notationTab(st, update, el) {
    const ta = el('textarea', { class: 'sgd-in sgd-code', rows: 5, spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Grid notation' });
    ta.value = st.notation || '';
    ta.addEventListener('input', () => { st.notation = ta.value; update(); });
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); const b = ta.closest('.sgd-panel').querySelector('.sgd-primary'); if (b && !b.disabled) b.click(); } });
    const help = el('dl', { class: 'sgd-help' }, SG.NOTATION_HELP.flatMap(([k, v]) => [el('dt', null, k), el('dd', null, v)]));
    const ex = el('div', { class: 'sgd-examples' }, el('span', null, 'Try:'), ...['| ~ | ~ | ~ |', '|10px|~|10px|', '(|~|20px|)*4 ~|', '| ~ | ~ | ( h )'].map((s) => {
      const b = el('button', { type: 'button', class: 'sgd-chip', title: 'Use this example' }, s);
      b.addEventListener('click', () => { ta.value = s; st.notation = s; update(); });
      return b;
    }));
    return el('div', { class: 'sgd-notation' }, ta, ex, el('details', { class: 'sgd-syntax', open: true }, el('summary', null, 'Syntax'), help));
  }

  function intervalsTab(st, update, el) {
    const iv = st.intervals, u = () => update();
    const row = (spec, title, which) => group(el, title,
      check(el, spec, 'on', which, u),
      cells(el, cell(el, 'Every', lenInput(el, spec, 'step', title + ' spacing', '100', u)), cell(el, 'From', lenInput(el, spec, 'origin', title + ' origin', '0', u))));
    return el('div', { class: 'sgd-intervals' },
      row(iv.x, 'Vertical guides', 'Across (left → right)'),
      row(iv.y, 'Horizontal guides', 'Down (top → bottom)'),
      el('p', { class: 'sgd-hint' }, 'A guide every N units from the origin, filling the whole target. % is of the target size.'));
  }

  SG.buildTab = function (tab, st, update, el) {
    return tab === 'notation' ? notationTab(st, update, el) : tab === 'intervals' ? intervalsTab(st, update, el) : formTab(st, update, el);
  };

  /** The ⋯ preset menu: save / delete / export / import. */
  SG.presetActions = function (anchor, st, ctx) {
    const UI = root.SlopUI, say = (m) => (ctx.toast ? ctx.toast(m) : UI ? UI.toast(m) : null);
    const ask = (t, l, v) => (UI ? UI.prompt(t, l, v, { ok: 'Save' }) : Promise.resolve(root.prompt(l, v)));
    const custom = SG.loadCustom();
    const items = [
      { label: 'Save as Preset…', act: async () => {
        const name = await ask('Save Guide Preset', 'Name', st.tab === 'form' ? 'My grid' : st.tab === 'notation' ? 'My notation' : 'My intervals');
        if (!name || !name.trim()) return;
        const p = { name: name.trim(), tab: st.tab, unit: st.unit, snap: st.snap };
        if (st.tab === 'form') p.form = st.form; else if (st.tab === 'notation') p.notation = st.notation; else p.intervals = st.intervals;
        SG.addPreset(p); ctx.fillPresets(); say(`Saved preset “${p.name}”`);
      } },
      { label: 'Delete Saved Preset', disabled: !custom.length, sub: custom.length ? custom.map((p) => ({ label: p.name, act: () => { SG.removePreset(p.name); ctx.fillPresets(); say(`Deleted “${p.name}”`); } })) : undefined },
      '-',
      { label: 'Export Presets (.json)', disabled: !custom.length, act: () => {
        const blob = new Blob([SG.exportJSON()], { type: 'application/json' });
        if (UI) UI.download(blob, 'guide-presets.json');
      } },
      { label: 'Import Presets…', act: async () => {
        const files = UI ? await UI.pickFiles({ accept: '.json,application/json' }) : [];
        for (const f of files) { try { const n = SG.importJSON(await f.text()); ctx.fillPresets(); say(`Imported ${n} preset${n === 1 ? '' : 's'}`); } catch (e) { say(e.message); } }
      } },
    ];
    const r = anchor.getBoundingClientRect();
    if (UI) UI.menu(items, r.left, r.bottom + 2);
  };
})(window);
