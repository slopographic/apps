/* Slop Signature, copying it out: the signature as each mail program takes it, and the clipboard.
 *   Gmail keeps a pasted picture only when it comes from a web address: a picture kept inside the signature (a data:
 *   address, what "a picture from this device" and the logo maker make) is dropped, so the Gmail copy leaves it out and
 *   says how to fix it (put the picture on a website and paste its address). Outlook and Apple Mail keep it inside.
 *   HTML code is the signature's table for a page, a mail template or a tool that asks for HTML.
 * output(client, s) is pure (s: model.clean's state). The rest is the page: copyFor(client) puts it on the clipboard and
 * resolves true when the browser allowed it; a browser allows copying only right after a click, so when the assistant
 * asks (no click), ask(client) shows a "Copy now" bar the person clicks once. Classic script, before app.js.
 * Sets SlopSignature.copy = { CLIENTS, output, pictureNote, copyFor, ask, hideAsk }. */
(function (g) {
  'use strict';
  const NS = (g.SlopSignature = g.SlopSignature || {});
  const CLIENTS = { gmail: 'Gmail', outlook: 'Outlook', apple: 'Apple Mail', all: 'any mail program', html: 'HTML code' };
  const inside = (s) => /^data:/.test(s.imageHref || '');

  /** What the picture means for each mail program, in plain words ('' when there is no picture). */
  function pictureNote(s) {
    if (!s.imageHref) return '';
    if (inside(s)) return 'Your picture is kept inside the signature. Outlook and Apple Mail keep it. Gmail does not show pictures kept this way, so Copy for Gmail leaves it out: put the picture on your website (Download logo gives you the file) and paste its web address in the picture field.';
    return `The picture loads from ${s.imageHref.replace(/^https?:\/\//i, '').split('/')[0]}. Every mail program shows it while that address is public.`;
  }
  /** The signature for one mail program: { html, text, notes, dropped } (dropped: the picture was left out). */
  function output(client, s) {
    const T = NS.templates, dropped = client === 'gmail' && inside(s);
    const use = dropped ? Object.assign({}, s, { imageHref: '' }) : s;
    const html = T.html(use), notes = [];
    if (dropped) notes.push('The picture is left out: Gmail does not show pictures kept inside a signature. Use a web address for it.');
    if (client === 'apple') notes.push('In Apple Mail, untick "Always match my default message font" before you paste.');
    if (client === 'html') return { html, text: html, notes: ['The HTML code is copied: paste it where a tool asks for an HTML signature.'], dropped };
    return { html: html ? `<div style="font-family:${s.font}">${html}</div>` : '', text: T.text(use), notes, dropped };
  }

  const $ = (id) => g.document.getElementById(id);
  /** The old way, for a browser without the async clipboard: select a hidden copy and copy it (keeps formatting). */
  function legacy(o, client) {
    const box = g.document.createElement(client === 'html' ? 'textarea' : 'div');
    box.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    if (client === 'html') box.value = o.text; else box.innerHTML = o.html;   // the templates escape every typed value
    g.document.body.append(box);
    let ok = false;
    try {
      if (client === 'html') box.select(); else { const r = g.document.createRange(), sel = g.getSelection(); r.selectNodeContents(box); sel.removeAllRanges(); sel.addRange(r); }
      ok = g.document.execCommand('copy');
    } catch (e) { ok = false; }
    box.remove();
    if (client !== 'html') g.getSelection().removeAllRanges();
    return ok;
  }
  async function copyFor(client) {
    const s = NS.model.clean(NS.app.state), o = output(client, s);
    if (!o.html) return false;
    let ok = false;
    if (client === 'html') { try { await g.navigator.clipboard.writeText(o.text); ok = true; } catch (e) { ok = false; } }
    else if (g.SlopBuffer && g.SlopBuffer.writeSystem) ok = await g.SlopBuffer.writeSystem({ t: Date.now(), formats: { 'text/html': o.html, 'text/plain': o.text } });
    if (!ok) ok = legacy(o, client);
    if (ok) { hideAsk(); NS.app.say(`Copied for ${CLIENTS[client]}. ${o.notes.join(' ')}${client === 'html' ? '' : ' Paste it into the signature box (steps below).'}`.trim()); }
    return ok;
  }
  /** The "Copy now" bar: the assistant cannot copy without a click, so the person gets one button to click. */
  function ask(client) {
    const bar = $('sgCopyNow'), btn = $('sgCopyNowBtn');
    $('sgCopyNowText').textContent = `Your signature for ${CLIENTS[client]} is ready. The browser lets a page copy only after a click:`;
    btn.textContent = client === 'html' ? 'Copy HTML code now' : `Copy for ${CLIENTS[client]} now`;
    btn.onclick = async () => { if (!(await copyFor(client))) NS.app.say('The browser did not allow copying: use Download HTML.'); };
    bar.hidden = false;
    bar.classList.remove('sg-flash'); void bar.offsetWidth; bar.classList.add('sg-flash');
    try { bar.scrollIntoView({ block: 'nearest' }); } catch (e) { /* an old browser: the bar still shows */ }
  }
  function hideAsk() { const bar = $('sgCopyNow'); if (bar) bar.hidden = true; }

  NS.copy = { CLIENTS, output, pictureNote, copyFor, ask, hideAsk };
})(typeof window !== 'undefined' ? window : globalThis);
