/* Slopographic UI: routing, the live counter and the
 * Authenticator. The home film lives in scenes.js; text engine in slop/.
 */
(() => {
  'use strict';

  const S = window.Slop;
  const $ = (sel) => document.querySelector(sel);
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // --------------------------------------------------------- clipboard

  let toastTimer = 0;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  async function copyText(text, msg) {
    try {
      await navigator.clipboard.writeText(text);
      toast(msg);
    } catch {
      window.prompt('Copy this:', text);
    }
  }

  // ------------------------------------------------------------ counter

  let served = Math.floor(((Date.now() - Date.UTC(2025, 0, 1)) / 1000) * 2.7);
  const counterEl = $('#counter');
  const bump = (n) => {
    served += n;
    counterEl.textContent = served.toLocaleString('en-US');
  };
  bump(0);
  setInterval(() => bump(Math.floor(Math.random() * 7)), 180);

  // ------------------------------------------------- shared with scenes

  const randSeed = () => (Math.random() * 2 ** 31) >>> 0;
  window.SlopUI = { randSeed, served: () => served };

  // ------------------------------------------------------ authenticator

  const input = $('#detect-input');
  const HUMAN = [
    'Took the dog to the vet this morning. She was fine, just ate a sock again. The vet laughed and charged us $180 anyway. On the way home we got stuck behind a tractor for twenty minutes and I listened to the same three songs on repeat.',
    'hey, are you still coming saturday? bring chairs if you have them, we only have like four. also mike says he’s making his chili again so maybe eat before lol',
    'The meeting ran long because nobody could find the projector remote. We eventually gave up and crowded around Dana’s laptop. Budget numbers look fine; the main issue is the vendor still hasn’t sent the revised quote.',
    'I planted tomatoes too early again. Every year I tell myself to wait until May, and every year I don’t. Two of them made it. The rest are a lesson I will absolutely ignore next spring.',
  ];
  let humanIdx = 0;
  let lastVerdict = '';

  const escapeHTML = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function runDetector() {
    const text = input.value;
    const box = $('#result');
    if (!text.trim()) {
      box.hidden = true;
      return;
    }
    const r = S.analyze(text);
    box.hidden = false;
    $('#serial').textContent = 'Nº SLP-' + S.hashString(text).toString(36).toUpperCase().padStart(7, '0');
    $('#cert-date').textContent = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    $('#score').textContent = r.score;
    $('#tier-emoji').textContent = r.tier.emoji;
    $('#tier-name').textContent = r.tier.name;
    $('#tier-blurb').textContent = r.tier.blurb;
    $('#bar-fill').style.width = Math.max(1, r.score) + '%';
    const genuine = r.score >= 55;
    const stamp = $('#stamp');
    stamp.className = 'stamp ' + (genuine ? 'genuine' : 'fake');
    stamp.textContent = genuine ? 'Genuine Slop' : r.score >= 30 ? 'Partial Slop' : 'Counterfeit · Human Made';
    document.dispatchEvent(new CustomEvent('slop:verdict', { detail: { score: r.score, stamp: stamp.textContent } }));

    const tells = $('#tells');
    tells.textContent = '';
    const entries = Object.entries(r.tally).sort((a, b) => b[1] - a[1]);
    if (!entries.length) tells.append(el('li', 'none', 'No tells found. Suspiciously human.'));
    for (const [label, n] of entries) {
      const li = el('li');
      li.append(el('b', '', `×${n}`), document.createTextNode(' ' + label));
      tells.append(li);
    }

    let html = '';
    let pos = 0;
    for (const s of r.spans) {
      html += escapeHTML(text.slice(pos, s.start));
      html += `<mark title="${escapeHTML(s.label)}">${escapeHTML(text.slice(s.start, s.end))}</mark>`;
      pos = s.end;
    }
    html += escapeHTML(text.slice(pos));
    $('#annotated').innerHTML = html;
    lastVerdict = `Authenticated by Slopographic: my text is ${r.score}% slop. ${r.tier.emoji} ${r.tier.name}. ${genuine ? 'Genuine slop.' : 'A human counterfeit.'} slopographic.com`;
  }

  let detectTimer = 0;
  input.addEventListener('input', () => {
    clearTimeout(detectTimer);
    detectTimer = setTimeout(runDetector, 120);
  });
  $('#sample-slop').addEventListener('click', () => {
    const g = S.GENRES[Math.floor(Math.random() * S.GENRES.length)].key;
    input.value = S.plainText(S.generate(g, randSeed(), Math.random() < 0.5 ? 1 : 2));
    runDetector();
  });
  $('#sample-human').addEventListener('click', () => {
    input.value = HUMAN[humanIdx++ % HUMAN.length];
    runDetector();
  });
  $('#clear').addEventListener('click', () => {
    input.value = '';
    runDetector();
    input.focus();
  });
  $('#copy-verdict').addEventListener('click', () => copyText(lastVerdict, 'Verdict copied.'));

  // ------------------------------------------------------------ routing

  let currentView = '';
  function showView(name) {
    if (currentView && currentView !== name) window.scrollTo(0, 0);
    currentView = name;
    $('#view-home').hidden = name !== 'home';
    $('#view-detector').hidden = name !== 'detector';
    document.body.dataset.view = name;
    document.dispatchEvent(new CustomEvent('slop:view', { detail: name }));
    fitWordmarks();
    document.querySelectorAll('.tab').forEach((t) => {
      if (t.dataset.view === name) t.setAttribute('aria-current', 'page');
      else t.removeAttribute('aria-current');
    });
  }

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-view]');
    if (!t || t === document.body) return; // body carries data-view as state, not as a link
    e.preventDefault();
    const v = t.dataset.view;
    history.replaceState(null, '', v === 'home' ? location.pathname + location.search : '#' + v);
    showView(v);
    window.scrollTo({ top: 0 });
    if (v === 'detector') input.focus({ preventScroll: true });
  });

  function route() {
    // Old feed links (#feed, #p=…) land on the home film now.
    showView(location.hash === '#detector' ? 'detector' : 'home');
  }
  window.addEventListener('hashchange', route);
  window.slopShowView = showView; // used by home/catalog.js and the mascot

  const setTopOffset = () => document.documentElement.style.setProperty('--top', $('.nav').offsetHeight + 'px');

  // Scale the giant wordmarks so they exactly fill their row.
  function fitWordmarks() {
    document.querySelectorAll('.wordmark, .footer-mark').forEach((w) => {
      if (!w.offsetParent) return;
      w.style.fontSize = '100px';
      const range = document.createRange();
      range.selectNodeContents(w);
      const textW = range.getBoundingClientRect().width;
      const cs = getComputedStyle(w);
      const avail = w.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      if (textW) w.style.fontSize = Math.min(320, (100 * avail) / textW) * 0.99 + 'px';
    });
  }
  window.addEventListener('resize', () => {
    setTopOffset();
    fitWordmarks();
  });

  // --------------------------------------------------------------- boot

  setTopOffset();
  route();
  const fontsReady = document.fonts && document.fonts.load
    ? Promise.race([
        Promise.all([
          document.fonts.load('900 40px Archivo'),
          document.fonts.load('italic 400 40px "Instrument Serif"'),
          document.fonts.load('400 40px "Instrument Serif"'),
          document.fonts.load('400 16px "Inter Tight"'),
          document.fonts.load('600 12px "JetBrains Mono"'),
        ]),
        new Promise((r) => setTimeout(r, 1500)),
      ]).catch(() => {})
    : Promise.resolve();
  fontsReady.then(() => {
    fitWordmarks();
    route();
    document.dispatchEvent(new Event('slop:ready'));
  });
})();
