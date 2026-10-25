/* SlopAIKit cloud meter: what a connected AI costs, in plain words, and the one-time notice before the first request.
 * Classic script; adds SlopAIKit.cloud.meter.
 *   add(usage) → the totals of this visit { input, output, tokens, cost (null when the price is not known), replies }
 *   total() · reset() · over(cap) → true when this visit used cap tokens or more (cap 0 = no cap)
 *   line(usage) → '1,234 tokens · about $0.02'      totalLine(cap) → 'This visit: 5,678 tokens · about $0.05 (cap 200,000)'
 *   capText(cap) → the sentence the loop stops with
 *   notice(provider, model) → Promise<bool>: before the first request to a provider, once per browser (localStorage
 *        'slop-firstrun:ai-cloud:<id>'): what goes to the provider, that files go only when the person allows each one,
 *        and that the provider charges their account. Cancel = nothing is sent.
 * "This visit" is the tab: the totals live in sessionStorage, so a reload keeps them and a new tab starts at zero. */
(function () {
  'use strict';
  const K = (window.SlopAIKit = window.SlopAIKit || {});
  const C = (K.cloud = K.cloud || {});
  const KEY = 'slop-ai.cloud.visit', SEEN = 'slop-firstrun:ai-cloud:';
  const zero = () => ({ input: 0, output: 0, cacheRead: 0, tokens: 0, cost: 0, known: true, replies: 0 });
  let t = (() => { try { return Object.assign(zero(), JSON.parse(sessionStorage.getItem(KEY)) || {}); } catch (e) { return zero(); } })();
  const keep = () => { try { sessionStorage.setItem(KEY, JSON.stringify(t)); } catch (e) { /* storage blocked: memory only */ } };
  const n = (x) => Math.round(x).toLocaleString('en');
  /** 'about $0.42', or 'less than $0.01' (a cent is the smallest step people read). */
  const money = (c) => (c == null ? '' : c < 0.005 ? 'less than $0.01' : 'about $' + c.toFixed(2));

  function add(u) {
    if (!u) return total();
    t.input += u.input || 0; t.output += u.output || 0; t.cacheRead += u.cacheRead || 0; t.tokens = t.input + t.output; t.replies++;
    if (u.cost == null) t.known = false; else t.cost += u.cost;
    keep();
    return total();
  }
  const total = () => Object.assign({}, t, { cost: t.known ? t.cost : null });
  const reset = () => { t = zero(); keep(); };
  const over = (cap) => !!cap && cap > 0 && t.tokens >= cap;
  function line(u) {
    const tok = (u.input || 0) + (u.output || 0);
    return `${n(tok)} tokens` + (u.cacheRead ? ` (${n(u.cacheRead)} from cache)` : '') + (u.cost != null ? ` · ${money(u.cost)}` : '');
  }
  function totalLine(cap) {
    const x = total();
    return `This visit: ${n(x.tokens)} tokens` + (x.cost != null ? ` · ${money(x.cost)}` : ' · price not known here, see your provider') + (cap ? ` (cap ${n(cap)})` : '');
  }
  const capText = (cap) => `Stopped: this visit reached your spending cap of ${n(cap)} tokens. Raise or clear the cap in the AI settings to go on.`;

  function seen(id) { try { return localStorage.getItem(SEEN + id) === '1'; } catch (e) { return false; } }
  function lines(p) {
    if (p.local) return [`Your requests go to ${p.who} (${p.base || 'the address you gave'}). They do not leave this computer.`,
      'Files and pictures are sent only when the assistant asks to look at one, and you are asked each time.'];
    return [`What you type here, and what the assistant reads and does in this app (for example layer or file names, and each action), go to ${p.who} to be answered.`,
      'Your files and pictures are not sent. When the assistant wants to look at one, you are asked first, every time, and only a small copy goes (a picture scaled down, or the first part of a text).',
      `${p.who} charges your account for what you use, by tokens. The panel shows the tokens of each reply and of this visit, and you can set a cap. ${p.who}'s own terms and privacy policy apply.`,
      `Your key stays in this browser and is sent only to ${p.who}.`];
  }
  function notice(p) {
    if (seen(p.id)) return Promise.resolve(true);
    const remember = () => { try { localStorage.setItem(SEEN + p.id, '1'); } catch (e) { /* the notice shows again next time */ } };
    if (!window.SlopUI || !SlopUI.dialog) { const ok = window.confirm(lines(p).join('\n\n')); if (ok) remember(); return Promise.resolve(ok); }
    return new Promise((resolve) => {
      const body = document.createElement('div');
      for (const s of lines(p)) { const el = document.createElement('p'); el.className = 'sui-p'; el.textContent = s; body.append(el); }
      let done = false;
      const finish = (ok) => { if (done) return; done = true; if (ok) remember(); resolve(ok); };
      SlopUI.dialog({ title: p.local ? `Use ${p.short}?` : `Send your requests to ${p.who}?`, body, cls: 'sap-notice',
        buttons: [{ label: 'Cancel', act: () => finish(false) }, { label: 'Continue', primary: true, act: () => finish(true) }],
        onClose: (ok) => finish(!!ok) });
    });
  }

  C.meter = { add, total, reset, over, line, totalLine, capText, notice, seen, lines, money };
})();
