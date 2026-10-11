/* SlopPrint: the one print dialog for every Slopographic app. Classic script, no dependencies.
 * Uses SlopUI (dialogs, toasts) and SlopCmd (the "Print" command) when present. Exposes window.SlopPrint.
 * Load after shared/slopui.js. Apps call SlopPrint.register(appId, provider) once, then open() or print(). */
(function () {
  'use strict';
  if (window.SlopPrint) return;
  const PAPERS = { A4: [210, 297], Letter: [216, 279], A5: [148, 210], Legal: [216, 356] };
  const CSS_PAPER = { A4: 'A4', Letter: 'letter', A5: 'A5', Legal: 'legal' };
  const MARGIN_MM = { normal: 15, narrow: 6, none: 0 };
  const mm = (v) => (v * 96) / 25.4; // millimetres to CSS pixels
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const providers = new Map();
  let lastApp = null, dialogOpen = false, cmdDone = false;

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const toast = (msg, ms, act) => { if (window.SlopUI) SlopUI.toast(msg, ms, act); };
  const activeApp = () => { const sc = window.SlopCmd && SlopCmd.app; return sc && providers.has(sc) ? sc : lastApp; };
  const hasProvider = () => providers.has(activeApp());

  /** Page range: '' means all pages; otherwise '1-3, 5'. Returns { ok, text }. */
  function parsePages(s) {
    const parts = String(s || '').split(',').map((p) => p.trim()).filter((p) => p !== '');
    if (!parts.length) return { ok: true, text: '' };
    for (const p of parts) {
      const m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(p);
      if (!m || +m[1] < 1 || (m[2] && +m[2] < +m[1])) return { ok: false, text: '' };
    }
    return { ok: true, text: parts.join(', ').replace(/\s*-\s*/g, '-') };
  }

  /** Removes anything that could load or run: scripts, frames, handlers and non-local URLs. Parsed inertly. */
  function clean(html) {
    const doc = new DOMParser().parseFromString('<!doctype html><body>' + String(html), 'text/html');
    doc.querySelectorAll('script, iframe, frame, frameset, object, embed, applet, link, meta, base').forEach((n) => n.remove());
    for (const n of doc.body.querySelectorAll('*')) for (const a of [...n.attributes]) {
      const name = a.name.toLowerCase();
      if (name.startsWith('on') || (/^(src|srcset|href|action|formaction|poster|background|xlink:href)$/.test(name) && !/^(data:|blob:|#)/i.test(a.value.trim()))) n.removeAttribute(a.name);
    }
    return doc.body.innerHTML;
  }

  /** The page's own CSS (style blocks and same-origin sheets), read from the CSSOM: nothing is fetched. */
  function pageCss() {
    const out = [];
    for (const sheet of document.styleSheets) {
      if (sheet.href && new URL(sheet.href, location.href).origin !== location.origin) continue;
      try { out.push([...sheet.cssRules].map((r) => r.cssText).join('\n')); } catch (e) { /* unreadable sheet: skip */ }
    }
    return out.join('\n').replace(/<\/style/gi, '<\\/style');
  }
  function rootAttrs() {
    const out = {};
    for (const a of document.documentElement.attributes) if (a.name === 'class' || a.name.startsWith('data-')) out[a.name] = a.value;
    return out;
  }

  /** The srcdoc for the preview ('preview': first page only) or the print frame ('print'). */
  function buildDoc(job, o, mode) {
    const [w, h] = PAPERS[o.paper];
    const land = o.orientation === 'landscape';
    const pw = land ? h : w, ph = land ? w : h;
    const m = MARGIN_MM[o.margin];
    const pages = o.pages || 'all'; // validated text: digits, commas and hyphens only
    const page = `@page{size:${CSS_PAPER[o.paper]} ${o.orientation};margin:${m}mm;/* pages: ${pages} */}`;
    const fit = o.scale === 'fit' ? '.sp-root img,.sp-root svg,.sp-root video,.sp-root canvas,.sp-root table,.sp-root pre{max-width:100%}' : '';
    const base = 'html,body{margin:0!important;background:#fff!important;color:#111!important}' + fit;
    const preview = mode === 'preview' ? `html{overflow:hidden;background:#8a8a8a!important}.sp-root{box-sizing:border-box;width:${pw}mm;height:${ph}mm;padding:${m}mm;background:#fff;overflow:hidden}` : '';
    const root = Object.entries(job.root || {}).map(([k, v]) => ` ${k}="${esc(v)}"`).join('') + ` data-sp-pages="${esc(pages)}"`;
    return '<!doctype html><html lang="en"' + root + '><head><meta charset="utf-8">' +
      `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline' data: blob:; font-src data: blob:">` +
      `<title>${esc(job.title)}</title><style>${job.css}</style><style>${page}${base}${preview}</style></head>` +
      `<body><div class="sp-root">${job.html}</div></body></html>`;
  }

  /** Prints a srcdoc (or a same-origin blob URL) from a hidden iframe. The iframe is removed on afterprint. */
  function printFrame(src) {
    const f = document.createElement('iframe');
    f.className = 'sp-print';
    f.setAttribute('aria-hidden', 'true');
    f.tabIndex = -1;
    if (src.srcdoc != null) f.srcdoc = src.srcdoc; else f.src = src.url;
    document.body.append(f);
    let timer = 0;
    const done = () => { clearTimeout(timer); f.remove(); };
    f.addEventListener('load', () => {
      const w = f.contentWindow;
      timer = setTimeout(done, 600000); // safety net if afterprint never fires
      w.addEventListener('afterprint', done, { once: true });
      try { w.focus(); w.print(); } catch (e) { done(); toast('The browser would not print: ' + (e.message || e), 6000); }
    }, { once: true });
  }

  /** Opens the dialog. o: { title, html? | blob? | pdfUrl?, pages?, paper?, orientation? }. Returns the SlopUI dialog or null. */
  function open(o = {}) {
    if (!window.SlopUI || dialogOpen) return null;
    const job = { title: String(o.title || document.title || 'Print'), root: o.root || rootAttrs(), css: '' };
    let objectUrl = null;
    if (o.html != null) { job.html = clean(o.html); job.css = pageCss(); }
    else if (o.blob) { objectUrl = URL.createObjectURL(o.blob); job.pdf = objectUrl; }
    else if (typeof o.pdfUrl === 'string' && /^(blob|data):/i.test(o.pdfUrl)) job.pdf = o.pdfUrl;
    else { toast('Nothing to print here'); return null; }
    const isPdf = job.html === undefined;
    const U = window.SlopUI, el = U.el;
    const init = { paper: PAPERS[o.paper] ? o.paper : 'A4', orientation: o.orientation === 'landscape' ? 'landscape' : 'portrait', pages: String(o.pages || '').trim() };

    const paper = U.select(Object.keys(PAPERS).map((k) => [k, k]), init.paper);
    const orient = U.select([['portrait', 'Portrait'], ['landscape', 'Landscape']], init.orientation);
    const margin = U.select([['normal', 'Normal'], ['narrow', 'Narrow'], ['none', 'None']], 'normal');
    const scale = U.select([['fit', 'Fit to width'], ['100', '100 percent']], 'fit');
    const pagesIn = el('input', { class: 'sui-input', type: 'text', placeholder: 'All pages, or e.g. 1-3, 5', value: init.pages, 'aria-label': 'Page range', autocomplete: 'off', spellcheck: 'false' });
    const copiesIn = U.number(1, 1, 99);
    const help = el('p', { class: 'sui-p sp-help', role: 'status' });
    const frame = el('iframe', { class: 'sp-frame', title: 'Print preview', scrolling: 'no', tabindex: '-1' });
    const wrap = el('div', { class: 'sp-wrap' }, frame);
    const body = el('div', { class: 'sp-body' }, wrap,
      el('div', { class: 'sp-grid' },
        U.field('Paper', paper), U.field('Orientation', orient), U.field('Margins', margin),
        U.field('Scale', scale), U.field('Pages', pagesIn), U.field('Copies', copiesIn)),
      help);
    if (isPdf) [paper, orient, margin, scale].forEach((s) => { s.disabled = true; });

    const copies = () => Math.min(99, Math.max(1, parseInt(copiesIn.value, 10) || 1));
    const readOpts = () => ({ paper: paper.value, orientation: orient.value, margin: margin.value, scale: scale.value, pages: parsePages(pagesIn.value).text, copies: copies() });
    function updateHelp() {
      const r = parsePages(pagesIn.value), n = copies();
      pagesIn.setAttribute('aria-invalid', String(!r.ok));
      help.classList.toggle('sp-err', !r.ok);
      if (!r.ok) { help.textContent = 'Page range: use page numbers and ranges, such as 1-3, 5.'; return; }
      const parts = [];
      if (isPdf) parts.push('The PDF sets its own paper size and margins.');
      if (r.text) parts.push(`Set Pages to ${r.text} in the browser's print dialog.`);
      parts.push(n > 1 ? `The browser's print dialog chooses the copies: set ${n} there.` : "The browser's print dialog chooses the number of copies.");
      help.textContent = parts.join(' ');
    }
    const fit = () => {
      const land = orient.value === 'landscape', [w0, h0] = PAPERS[paper.value];
      const pw = mm(land ? h0 : w0), ph = mm(land ? w0 : h0), k = wrap.clientWidth / pw;
      Object.assign(frame.style, { width: pw + 'px', height: ph + 'px', transform: `scale(${k})` });
      wrap.style.height = ph * k + 'px';
    };
    function showPreview() {
      if (isPdf) frame.src = job.pdf;
      else frame.srcdoc = buildDoc(job, readOpts(), 'preview');
      fit();
    }
    /** Print (or Save as PDF, which is the same path with a hint). Returns false to keep the dialog open. */
    function go(mode) {
      updateHelp();
      const r = parsePages(pagesIn.value);
      if (!r.ok) { pagesIn.focus(); return false; }
      if (mode === 'save') toast('In the print dialog, choose Save as PDF as the destination.', 6000);
      const e = Object.assign(readOpts(), { pages: r.text });
      const src = isPdf ? { url: job.pdf } : { srcdoc: buildDoc(job, e, 'print') };
      setTimeout(() => printFrame(src), 0);
    }
    const onOpt = () => { updateHelp(); showPreview(); };
    for (const s of [paper, orient, margin, scale]) s.addEventListener('change', onOpt);
    pagesIn.addEventListener('change', onOpt);
    copiesIn.addEventListener('input', updateHelp);
    const onResize = () => fit();
    addEventListener('resize', onResize);

    dialogOpen = true;
    const dlg = U.dialog({
      title: job.title, cls: 'sp-dlg', body,
      buttons: [
        { label: 'Cancel' },
        { label: 'Save as PDF', act: () => go('save') },
        { label: 'Print', primary: true, act: () => go('print') },
      ],
      onClose: () => {
        dialogOpen = false;
        removeEventListener('resize', onResize);
        if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 300000); // a queued print may still need it
      },
    });
    updateHelp();
    showPreview();
    requestAnimationFrame(fit);
    return dlg;
  }

  /** Opens the dialog for an element: its outer HTML is cloned, with the page's print CSS. */
  function fromElement(el, opts = {}) {
    if (!el) return null;
    return open(Object.assign({ title: el.getAttribute('aria-label') || document.title, html: el.outerHTML }, opts));
  }

  /** Registers an app's provider: () => { title, html } or { blob } (or a Promise of one) for its current document. */
  function register(appId, provider) {
    if (typeof provider !== 'function') throw new TypeError('SlopPrint.register needs a provider function');
    const id = String(appId);
    providers.set(id, provider);
    lastApp = id;
    return () => { providers.delete(id); };
  }

  /** Prints the registered provider's document: print(appId), or the page's current app when omitted. */
  async function print(appId) {
    const provider = providers.get(appId ? String(appId) : activeApp());
    if (!provider) { toast('Nothing to print on this page'); return null; }
    let r;
    try { r = await provider(); } catch (e) { toast('Could not prepare the page: ' + (e.message || e)); return null; }
    return r ? open(r) : null;
  }

  /* Ctrl+P (Cmd+P on Mac): only when the page registered a provider. Otherwise the browser's own print runs. */
  function isPrintKey(e) {
    const mod = isMac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
    return mod && !e.shiftKey && !e.altKey && (e.key === 'p' || e.key === 'P');
  }
  addEventListener('keydown', (e) => {
    if (e.defaultPrevented || !isPrintKey(e) || !hasProvider()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!dialogOpen && !(window.SlopUI && SlopUI.openDialogs)) print();
  }, true);

  /* The "Print" command in the palette. SlopCmd shows Mod+P; its own dispatcher skips the key when this listener took it. */
  function addCommand() {
    if (cmdDone || !window.SlopCmd || !SlopCmd.register) return;
    cmdDone = true;
    SlopCmd.register([{ id: 'print.open', title: 'Print…', group: 'File', keys: ['Mod+P'], keywords: ['print', 'pdf', 'save as pdf', 'page setup', 'copies'], when: hasProvider, run: () => print() }]);
  }
  addCommand();
  addEventListener('load', addCommand);

  /* The stylesheet sits next to this script; add it when the page has not linked it. */
  const me = document.currentScript;
  if (me && me.src) {
    const href = me.src.replace(/print\.js(\?.*)?$/, 'print.css');
    if (![...document.querySelectorAll('link[rel=stylesheet]')].some((l) => l.href === href)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.append(link);
    }
  }

  window.SlopPrint = { open, print, fromElement, register };
})();
