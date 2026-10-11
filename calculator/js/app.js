/* Slopculator page: the expression line, the live result, the paper tape, copy and save to Slop Drive.
 * Classic script, loaded after the pure modules, keep.js, rates.js and panels.js. Exposes window.SlopCalcApp
 * (used by commands.js). Every evaluation goes through evaluate(), which fetches a missing exchange rate and tries again. */
(function () {
  'use strict';
  const C = window.SlopCalc, K = window.SlopCalcKeep, R = window.SlopCalcRates, P = window.SlopCalcPanels;
  const $ = (id) => document.getElementById(id);
  const HIST_KEY = 'slopcalc.history', HIST_MAX = 200, TAPE_MAX = 300;
  const S = { ans: null, tape: [], history: K.read(HIST_KEY, []), recall: -1, seq: 0, last: null, timer: 0 };
  const el = { expr: $('sc-expr'), preview: $('sc-preview'), status: $('sc-status'), tape: $('sc-tape'), tapeClear: $('sc-tape-clear') };
  const today = () => C.dates.localIso();

  function setStatus(msg) { el.status.textContent = msg; }
  function toast(msg) { if (window.SlopUI && SlopUI.toast) SlopUI.toast(msg); else setStatus(msg); }

  /** Runs an expression. A currency pair with no rate yet is fetched from Slop Ledger, then the expression runs again. */
  async function evaluate(src) {
    let r = null;
    for (let i = 0; i < 6; i++) {
      r = C.calc(src, { ans: S.ans, rate: R.factor, today: today() });
      if (r.ok || r.error.code !== 'rate') return r;
      if (!(await R.fetch(r.error.from, r.error.to, today()))) break;
    }
    if (!r.ok && r.error.code === 'rate') r.error.message += '. Add a manual rate under Exchange rates.';
    return r;
  }

  function showPreview(r) {
    el.preview.classList.toggle('sc-error', !!r && !r.ok);
    el.preview.textContent = !r ? '' : r.ok ? '= ' + r.text : r.error.message;
  }
  async function preview() {
    const src = el.expr.value.trim();
    const my = ++S.seq;
    if (!src) { S.last = null; showPreview(null); return; }
    const r = await evaluate(src);
    if (my !== S.seq) return;
    S.last = r.ok ? { expr: src, value: r.value, text: r.text } : null;
    showPreview(r);
  }
  function schedulePreview() { clearTimeout(S.timer); S.timer = setTimeout(preview, 120); }

  async function commit() {
    const src = el.expr.value.trim();
    if (!src) return;
    clearTimeout(S.timer);
    const my = ++S.seq;
    const r = await evaluate(src);
    if (my !== S.seq) return;
    showPreview(r);
    if (!r.ok) { setStatus('Not calculated: ' + r.error.message); return; }
    S.last = { expr: src, value: r.value, text: r.text };
    S.ans = r.value;
    S.tape.push({ expr: src, text: r.text });
    if (S.tape.length > TAPE_MAX) S.tape.splice(0, S.tape.length - TAPE_MAX);
    S.history = [{ expr: src, text: r.text, at: Date.now() }, ...S.history.filter((h) => h.expr !== src)].slice(0, HIST_MAX);
    K.write(HIST_KEY, S.history);
    P.renderHistory(S.history);
    renderTape();
    el.expr.select();
    setStatus(`Saved to the tape: ${src} = ${r.text}`);
  }

  function renderTape() {
    el.tape.replaceChildren(...S.tape.map((row) => {
      const li = document.createElement('li');
      li.className = 'sc-line';
      li.tabIndex = 0;
      li.title = 'Use this line again';
      const a = document.createElement('span'); a.className = 'sc-line-expr'; a.textContent = row.expr;
      const b = document.createElement('span'); b.className = 'sc-line-val'; b.textContent = '= ' + row.text;
      li.append(a, b);
      const use = () => { el.expr.value = row.expr; schedulePreview(); el.expr.focus(); };
      li.addEventListener('click', use);
      li.addEventListener('keydown', (e) => { if (e.key === 'Enter') use(); });
      return li;
    }));
    el.tape.scrollTop = el.tape.scrollHeight;
    el.tapeClear.disabled = !S.tape.length;
  }

  function insert(text) {
    const v = el.expr.value, s = el.expr.selectionStart ?? v.length, e = el.expr.selectionEnd ?? v.length;
    el.expr.value = v.slice(0, s) + text + v.slice(e);
    el.expr.setSelectionRange(s + text.length, s + text.length);
    el.expr.focus();
    S.recall = -1;
    schedulePreview();
  }

  function recall(step) {
    if (!S.tape.length) return;
    S.recall = S.recall < 0 ? (step < 0 ? S.tape.length - 1 : -1) : Math.min(S.tape.length - 1, Math.max(0, S.recall + step));
    if (S.recall < 0) { el.expr.value = ''; } else { el.expr.value = S.tape[S.recall].expr; }
    schedulePreview();
  }

  function onKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    else if (e.key === 'Escape') { e.preventDefault(); clearInput(); }
    else if (e.key === 'ArrowUp' && !e.altKey) { e.preventDefault(); recall(-1); }
    else if (e.key === 'ArrowDown' && !e.altKey) { e.preventDefault(); recall(1); }
  }

  function clearInput() { el.expr.value = ''; S.recall = -1; S.last = null; S.seq++; showPreview(null); el.expr.focus(); }
  function clearTape() { S.tape = []; renderTape(); setStatus('Tape cleared. History is kept.'); }

  /** The result as text to paste: a plain number without separators, else the displayed text. */
  function copyText() {
    if (!S.last) return null;
    const v = S.last.value;
    return v.t === 'n' ? String(Number(v.v.toPrecision(12))) : S.last.text;
  }
  async function copyResult() {
    const text = copyText();
    if (text === null) { setStatus('Calculate something first'); return; }
    try { await navigator.clipboard.writeText(text); toast(`Copied ${text}`); }
    catch (e) { setStatus('The browser blocked the clipboard. Select the result and copy it.'); }
  }

  /** One Slop Drive file per calculation: Markdown, meta { type:'notes', kind:'calc' }. Notes ignores kind 'calc'. */
  async function saveDrive() {
    if (!S.last) { setStatus('Calculate something first'); return; }
    if (!window.SlopHub) { setStatus('Slop Drive is not available in this browser'); return; }
    const { expr, text } = S.last;
    const title = `${expr} = ${text}`.replace(/[\\/:*?"<>|\r\n]+/g, ' ').slice(0, 60).trim();
    const body = `# ${title}\n\n${expr}\n\n= ${text}\n\nSaved from Slopculator on ${today()}.\n`;
    try {
      await SlopHub.put(new Blob([body], { type: 'text/markdown' }), {
        name: `${title}.md`, from: 'calculator',
        meta: { type: 'notes', kind: 'calc', title, expression: expr, result: text, saved: Date.now() },
      });
      toast('Saved to Slop Drive');
    } catch (e) { setStatus('Not saved: ' + (e && e.message ? e.message : 'Slop Drive refused the file')); }
  }

  function boot() {
    el.expr.addEventListener('input', () => { S.recall = -1; schedulePreview(); });
    el.expr.addEventListener('keydown', onKey);
    $('sc-enter').addEventListener('click', commit);
    $('sc-copy').addEventListener('click', copyResult);
    $('sc-save').addEventListener('click', saveDrive);
    $('sc-clear').addEventListener('click', clearInput);
    el.tapeClear.addEventListener('click', clearTape);
    document.querySelectorAll('[data-ins]').forEach((b) => b.addEventListener('click', () => insert(b.dataset.ins)));
    P.init({
      pick: (expr) => { el.expr.value = expr; schedulePreview(); el.expr.focus(); },
      history: () => S.history,
      setHistory: (list) => { S.history = list; K.write(HIST_KEY, list); },
      ratesChanged: () => schedulePreview(),
      status: setStatus,
    });
    renderTape();
    P.renderHistory(S.history);
    const start = new URLSearchParams(location.search).get('expr');
    if (start) { el.expr.value = start; preview(); }
    el.expr.focus();
  }

  window.SlopCalcApp = { commit, copyResult, saveDrive, clearInput, clearTape, insert, focus: () => el.expr.focus(), copyText };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
