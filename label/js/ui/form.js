/* SlopLabel — ui/form: print-form mode. A shareable link (#form=…) opens a single screen where an
 * operator fills in the prompts, sets the quantity and prints, without seeing the designer. */
'use strict';

async function formLink(doc = App.doc) {
  const u = new URL(location.href); u.search = ''; u.hash = 'form=' + (await encodeDocHash(doc));
  return u.href;
}
async function shareFormLink() {
  const link = await formLink();
  const inp = dInp(link, 'text', { readonly: true });
  const big = link.length > 8000;
  SlopUI.dialog({ title: 'Print form link', body: mk('div', { class: 'dlg-form' },
    mk('p', { class: 'sui-p' }, 'Anyone with this link gets a simple form: fill in the prompts, choose a quantity and print. The whole label travels inside the link; nothing is uploaded.'),
    inp, big ? mk('div', { class: 'msg warn' }, `This link is ${Math.round(link.length / 1000)} KB long (images make it big). Some apps cut long links; bookmark it or save the .sloplabel file instead.`) : null),
  buttons: [{ label: 'Open', act: () => { window.open(link, '_blank'); return false; } }, { label: 'Copy link', primary: true, act: async () => { try { await navigator.clipboard.writeText(link); SlopUI.toast('Link copied'); } catch (e) { inp.select(); document.execCommand('copy'); SlopUI.toast('Link copied'); } } }] });
}
/** Boot into form mode when the URL carries #form=…; returns true if it did. */
async function maybeFormMode() {
  const m = /^#form=(.+)$/.exec(location.hash);
  if (!m) return false;
  let doc;
  try { doc = await decodeDocHash(m[1]); } catch (e) { SlopUI.alert('Broken form link', 'This print form link is damaged or incomplete.'); return false; }
  App.doc = doc;
  document.body.classList.add('form-mode');
  document.title = doc.name + ' — print form';
  await preloadImages(doc);
  const ps = doc.vars.filter((v) => v.type === 'prompt'), vals = {};
  const prev = mk('div', { class: 'pf-prev' }), err = mk('div');
  const inputs = ps.map((v) => { const i = dInp(v.def, 'text', { placeholder: v.prompt }); vals[v.name] = v.def || ''; i.addEventListener('input', () => { vals[v.name] = i.value; draw(); }); return dRow(v.prompt || v.name, i); });
  const n = recordCount(doc), qty = dInp(1, 'number', { min: 1, max: 10000 });
  const draw = () => {
    const get = makeResolver(doc, { record: n ? recordAt(doc, 0) : {}, prompts: vals });
    const c = renderLabelCanvas(doc, buildScene(doc, get), Math.min(300, (520 * 25.4) / Math.max(doc.label.w, doc.label.h)));
    prev.replaceChildren(c);
    const e = checkPrompts(doc, vals);
    err.replaceChildren(...e.map((x) => mk('div', { class: 'msg warn' }, x)));
  };
  const job = () => {
    const e = checkPrompts(doc, vals); if (e.length) { SlopUI.toast(e[0]); return null; }
    App.prompts = Object.assign({}, vals);
    return jobScenes({ qty: +qty.value || 1, prompts: vals }, doc);
  };
  const act = (fn) => async () => { const J = job(); if (J) try { await fn(J); } catch (e) { SlopUI.alert('Output failed', e.message); } };
  const btn = (l, f, cls = '') => fBtn(l, act(f), { cls });
  const designer = mk('a', { href: location.pathname, class: 'btn ghost', style: 'font-size:12px' }, 'Open in designer');
  designer.addEventListener('click', async (e) => { e.preventDefault(); history.replaceState(null, '', location.pathname); document.body.classList.remove('form-mode'); $('pform').remove(); await startTabs(); openDocTab(doc, { label: 'Open form' }); resizeView(); });
  const card = mk('div', { class: 'pf-card' }, prev, ...inputs, dRow(n ? 'Labels per record' : 'Quantity', qty), err,
    mk('div', { class: 'pf-actions' }, designer, mk('span', { class: 'grow' }),
      btn('ZPL', (J) => downloadBytes(buildZPL(doc, J.scenes, { keys: J.keys }), safeName(doc.name, '.zpl'), 'text/plain')),
      btn('PDF', async (J) => downloadBytes(await buildPDF(doc, J.scenes, { title: doc.name }), safeName(doc.name, '.pdf'), 'application/pdf')),
      btn('Print', (J) => printViaIframe(printHTML(doc, J.scenes, { title: doc.name })), 'primary')));
  const root = mk('div', { class: 'pform', id: 'pform' }, mk('h1', null, doc.name), mk('p', { class: 'hint' }, n ? `${n} records attached` : 'Fill in the fields and print.'), card);
  document.body.append(root);
  draw();
  document.body.classList.add('ready');
  return true;
}
