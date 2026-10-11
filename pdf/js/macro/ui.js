/* Slop PDF macros — the dialogs: open() creates and edits macros (with a test run on a PDF), and runFor(file) runs
   the macro whose file name rule matches a dropped PDF, asking first when the rule says so. Uses SlopUI. */
(function () {
  'use strict';
  var M = window.SlopPdfMacro = window.SlopPdfMacro || {};
  var UI = M.ui = M.ui || {};
  var S = function () { return window.SlopUI; };
  function el(tag, attrs) { return S().el.apply(null, [tag, attrs].concat(Array.prototype.slice.call(arguments, 2))); }
  function ensureCss() {
    if (document.getElementById('spm-css')) return;
    var st = el('style', { id: 'spm-css' });
    st.textContent = UI.CSS;
    document.head.append(st);
  }
  function plainCopy(v) { return JSON.parse(JSON.stringify(v)); }
  function baseName(n) { return String(n || 'document').replace(/\.pdf$/i, ''); }
  function slug(n) { return String(n || 'macro').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'macro'; }
  function outputName(file, macro) { return baseName(file) + '-' + slug(macro.name) + '.pdf'; }

  /** The run log as a list: a mark, the step, and what happened. */
  UI.logList = function (log) {
    return el('ol', { class: 'spm-log' }, (log || []).map(function (l) {
      var cls = !l.ok ? 'spm-err' : l.warn ? 'spm-warn' : 'spm-ok';
      var mark = !l.ok ? '✕' : l.warn ? '!' : '✓';
      return el('li', { class: cls },
        el('span', { class: 'spm-mark', 'aria-hidden': 'true' }, mark),
        el('span', { class: 'spm-step-name' }, l.step),
        l.message ? el('span', { class: 'spm-msg' }, l.message) : null);
    }));
  };
  function logHasTrouble(log) { return (log || []).some(function (l) { return !l.ok || l.warn; }); }

  function download(bytes, name) {
    S().download(new Blob([bytes], { type: 'application/pdf' }), name);
  }

  /**
   * open(opts): the macro editor. opts.current() → Promise<{ name, bytes } | null> gives the open PDF for a test run;
   * without it the test run asks for a PDF. opts.onSaved(list) is called after a save.
   */
  M.open = function (opts) {
    opts = opts || {};
    ensureCss();
    var list = M.load(), draft = null, testResult = null;
    var problems = el('ul', { class: 'spm-problems', role: 'alert' });
    var nameIn = el('input', { class: 'sui-input', type: 'text', maxlength: 80, placeholder: 'Macro name', 'aria-label': 'Macro name' });
    var patIn = el('input', { class: 'sui-input', type: 'text', placeholder: 'invoice-*.pdf  or  /^inv-\\d+/', 'aria-label': 'File name pattern', autocomplete: 'off', spellcheck: 'false' });
    var autoSel = S().select([['off', 'Only when I run it'], ['ask', 'Ask me when a matching PDF is dropped'], ['silent', 'Run by itself when a matching PDF is dropped']], 'off');
    var pickSel = S().select([['', 'New macro']].concat(list.map(function (m) { return [m.id, m.name]; })), '');
    var stepsBox = el('div', { 'aria-label': 'Steps' });
    var addSel = S().select(M.TYPE_ORDER.map(function (t) { return [t, M.STEP_TYPES[t].label]; }), M.TYPE_ORDER[0]);
    var testLog = el('div', { class: 'spm-testlog', 'aria-live': 'polite' });
    var saveMsg = el('p', { class: 'spm-hint' }, 'Macros are kept in this browser. Nothing is uploaded.');

    function readMeta() {
      draft.name = nameIn.value.trim() || 'Untitled macro';
      draft.pattern = patIn.value.trim();
      draft.auto = autoSel.value;
    }
    function showProblems(list2) {
      problems.replaceChildren.apply(problems, (list2 || []).map(function (p) { return el('li', null, p); }));
    }
    function renderSteps() {
      stepsBox.replaceChildren();
      if (!draft.steps.length) stepsBox.append(el('p', { class: 'spm-hint' }, 'No steps yet. Choose a step below and press Add step.'));
      draft.steps.forEach(function (step, i) {
        stepsBox.append(UI.stepCard(step, i, draft.steps.length, {
          set: function (k, v) { draft.steps[i][k] = v; testResult = null; },
          changeType: function (t) { draft.steps[i] = M.newStep(t); testResult = null; renderSteps(); },
          move: function (d) { var j = i + d; if (j < 0 || j >= draft.steps.length) return; var t = draft.steps[i]; draft.steps[i] = draft.steps[j]; draft.steps[j] = t; renderSteps(); },
          remove: function () { draft.steps.splice(i, 1); testResult = null; renderSteps(); }
        }));
      });
    }
    function setDraft(m) {
      draft = plainCopy(m);
      nameIn.value = draft.name || ''; patIn.value = draft.pattern || ''; autoSel.value = draft.auto || 'off';
      testLog.replaceChildren(); testResult = null; showProblems([]);
      renderSteps();
    }
    pickSel.addEventListener('change', function () {
      var m = list.find(function (x) { return x.id === pickSel.value; });
      setDraft(m || M.newMacro('New macro'));
    });
    var addBtn = el('button', { type: 'button', class: 'sui-btn', onclick: function () {
      draft.steps.push(M.newStep(addSel.value)); testResult = null; renderSteps();
      var cards = stepsBox.querySelectorAll('.spm-step'); var last = cards[cards.length - 1];
      if (last) { var f = last.querySelector('input, select'); if (f) f.focus({ preventScroll: true }); }
    } }, 'Add step');

    var testBtn = el('button', { type: 'button', class: 'sui-btn' }, opts.current ? 'Test on the open PDF' : 'Test on a PDF…');
    var dlBtn = el('button', { type: 'button', class: 'sui-btn', hidden: true }, 'Download test result');
    async function testRun() {
      readMeta();
      showProblems([]);
      var errs = M.validateMacro(draft);
      if (errs.length) { showProblems(errs); return false; }
      var src = opts.current ? await opts.current() : null;
      if (!src) {
        var picked = await S().pickFiles({ accept: 'application/pdf,.pdf' });
        if (!picked.length) return false;
        src = { name: picked[0].name, bytes: new Uint8Array(await picked[0].arrayBuffer()) };
      }
      var r = await M.runMacro(draft, src.bytes, { filename: src.name });
      testLog.replaceChildren(UI.logList(r.log));
      testResult = r.ok ? { bytes: r.bytes, name: outputName(src.name, draft) } : null;
      dlBtn.hidden = !testResult;
      return false;
    }
    testBtn.addEventListener('click', function () { testRun().catch(function (e) { showProblems([e.message || String(e)]); }); });
    dlBtn.addEventListener('click', function () { if (testResult) download(testResult.bytes, testResult.name); });

    var body = el('div', null,
      el('div', { class: 'spm-row' }, S().field('Macro', pickSel)),
      el('div', { class: 'spm-grid', style: 'margin-top:10px' },
        S().field('Name', nameIn), S().field('File name pattern (optional)', patIn),
        el('div', { class: 'spm-wide' }, S().field('When a matching PDF is dropped', autoSel))),
      el('p', { class: 'spm-hint' }, 'Patterns use * for any text and ? for one character, or a regular expression between slashes. A pattern must match the whole file name.'),
      el('div', { class: 'spm-sec' }, el('h4', null, 'Steps', el('span', { class: 'spm-grow' }), addSel, addBtn), stepsBox),
      el('div', { class: 'spm-sec' }, el('h4', null, 'Test run'),
        el('div', { class: 'spm-row' }, testBtn, dlBtn),
        el('p', { class: 'spm-hint' }, 'The test runs the steps on a copy. Your open file is not changed.'),
        testLog),
      problems, saveMsg);

    var exists = function () { return list.some(function (x) { return x.id === draft.id; }); };
    var buttons = [];
    var deleteBtn = { label: 'Delete', danger: true, act: async function () {
      var ok = await S().confirm('Delete this macro?', '“' + (draft.name || 'Untitled macro') + '” will be removed from this browser.', 'Delete', { danger: true });
      if (!ok) return false;
      list = list.filter(function (x) { return x.id !== draft.id; });
      M.save(list);
      if (opts.onSaved) opts.onSaved(M.load());
      return true;
    } };
    if (list.length) buttons.push(deleteBtn);
    buttons.push({ label: 'Close' });
    buttons.push({ label: 'Save', primary: true, act: function () {
      readMeta();
      var errs = M.validateMacro(draft);
      if (errs.length) { showProblems(errs); return false; }
      var i = list.findIndex(function (x) { return x.id === draft.id; });
      if (i < 0) list.push(draft); else list[i] = draft;
      var kept = M.save(list);
      if (!kept) S().toast('This browser would not keep the macro. It lasts until this page closes.', 4000);
      else S().toast('Macro saved.');
      if (opts.onSaved) opts.onSaved(M.load());
      return true;
    } });
    setDraft(M.newMacro('New macro'));
    return S().dialog({ title: 'Macros', body: body, buttons: buttons, cls: 'spm-dlg' });
  };

  /** Asks which of several macros to run on a dropped file. Resolves the chosen macro, or null. */
  function askWhich(name, macros) {
    return new Promise(function (res) {
      var picked = null;
      var buttons = [{ label: 'Not now' }].concat(macros.map(function (m, i) {
        return { label: 'Run “' + m.name + '”', primary: i === 0, act: function () { picked = m; } };
      }));
      var text = macros.length === 1 ? 'A macro is set to ask first for files like this one.' : 'More than one macro is set to ask first for files like this one. Choose one to run.';
      S().dialog({ title: 'Run a macro on ' + name + '?', body: text, buttons: buttons, onClose: function () { res(picked); } });
    });
  }

  /**
   * runFor(file, opts): the drop hook. Finds the macro whose file name rule matches the PDF. A rule set to run by
   * itself runs at once; a rule set to ask first asks. opts.onResult({ name, bytes, log, macro, ok }) receives the
   * new PDF; without it the PDF is downloaded. Resolves { ran, reason?, ok, bytes, log, macro, name }.
   */
  M.runFor = async function (file, opts) {
    opts = opts || {};
    ensureCss();
    var name = file.name || 'document.pdf', matches = M.findRules(M.load(), name);
    if (!matches.length) return { ran: false, reason: 'no-rule' };
    var chosen = matches[0].auto === 'silent' ? matches[0] : await askWhich(name, matches);
    if (!chosen) return { ran: false, reason: 'declined' };
    var r = await M.runMacro(chosen, new Uint8Array(await file.arrayBuffer()), { filename: name });
    var result = { ran: true, macro: chosen, name: outputName(name, chosen), ok: r.ok, bytes: r.bytes, log: r.log };
    if (!r.ok || logHasTrouble(r.log)) {
      S().dialog({ title: r.ok ? '“' + chosen.name + '” ran with warnings' : '“' + chosen.name + '” stopped', body: UI.logList(r.log), buttons: [{ label: 'OK', primary: true }] });
    }
    if (!r.ok) return result;
    if (opts.onResult) opts.onResult(result);
    else { download(r.bytes, result.name); S().toast('Ran “' + chosen.name + '” on ' + name + '.'); }
    return result;
  };
})();
