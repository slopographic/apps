/* Slopographic UI: the infinite slop feed, canvas-painted "AI images",
 * meme-card export and the Slop Detector. Content comes from slop.js.
 */
(() => {
  'use strict';

  const S = window.Slop;
  const $ = (sel) => document.querySelector(sel);
  const EMOJI = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"';
  const SANS = `Inter, system-ui, sans-serif, ${EMOJI}`;
  const DISPLAY = `"Bricolage Grotesque", Inter, sans-serif, ${EMOJI}`;
  const ASPECT = { miracle: 1, product: 1, quote: 1, thumb: 9 / 16 };

  // ------------------------------------------------------------ painters

  function drawEmoji(ctx, ch, x, y, size, rot = 0) {
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.font = `${size}px ${EMOJI}, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  }

  function wrap(ctx, text, maxW) {
    const out = [];
    let line = '';
    for (const word of text.split(' ')) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        out.push(line);
        line = word;
      } else line = test;
    }
    if (line) out.push(line);
    return out;
  }

  const MIRACLE = [
    ['#ffe08a', '#ff8a3d', '#6d2a86'],
    ['#b9f0ff', '#4f8cff', '#1b1464'],
    ['#ffe3f1', '#ff7eb6', '#5b2390'],
    ['#fff3b0', '#e09f3e', '#540b0e'],
    ['#e3ffb0', '#45b649', '#0b3d2e'],
  ];

  function paintMiracle(ctx, W, H, im, R) {
    const [a, b, c] = MIRACLE[im.palette % MIRACLE.length];
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, a);
    g.addColorStop(0.55, b);
    g.addColorStop(1, c);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const cx = W / 2, cy = H * 0.45;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = 0; i < 18; i++) {
      ctx.rotate((Math.PI * 2) / 18);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(W, -W * 0.09);
      ctx.lineTo(W, W * 0.09);
      ctx.fill();
    }
    ctx.restore();

    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.42);
    glow.addColorStop(0, 'rgba(255,255,240,0.95)');
    glow.addColorStop(0.4, 'rgba(255,255,220,0.45)');
    glow.addColorStop(1, 'rgba(255,255,220,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // A pile of the "material" along the bottom, and a halo of it around the subject.
    for (let k = 0; k < 34; k++) drawEmoji(ctx, im.part, R.f() * W, H * (0.8 + R.f() * 0.2), W * (0.06 + R.f() * 0.05), R.f() * 6);
    const n = 15;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + R.f() * 0.2;
      const r = W * (0.3 + R.f() * 0.03);
      drawEmoji(ctx, im.part, cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, W * 0.085, ang + Math.PI / 2);
    }
    ctx.save();
    ctx.shadowColor = 'rgba(255,250,210,0.95)';
    ctx.shadowBlur = W * 0.06;
    drawEmoji(ctx, im.main, cx, cy, W * 0.34);
    ctx.restore();
    for (let k = 0; k < 9; k++) drawEmoji(ctx, '✨', R.f() * W, R.f() * H * 0.75, W * (0.03 + R.f() * 0.04));

    ctx.font = `600 ${W * 0.024}px ${SANS}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.lineWidth = W * 0.006;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeText('100% real photo, no AI 🙏', W * 0.97, H * 0.975);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('100% real photo, no AI 🙏', W * 0.97, H * 0.975);
  }

  function paintProduct(ctx, W, H, im) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    const sh = ctx.createRadialGradient(W / 2, H * 0.8, 0, W / 2, H * 0.8, W * 0.32);
    sh.addColorStop(0, 'rgba(0,0,0,0.18)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh;
    ctx.fillRect(0, H * 0.7, W, H * 0.2);
    drawEmoji(ctx, im.emoji, W / 2, H * 0.5, W * 0.52);

    ctx.fillStyle = '#e47911';
    ctx.fillRect(0, H * 0.05, W * 0.42, H * 0.08);
    ctx.font = `800 ${W * 0.04}px ${SANS}`;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(im.badge, W * 0.04, H * 0.09);

    ctx.font = `700 ${W * 0.032}px ${SANS}`;
    ctx.fillStyle = '#0a7bd8';
    ctx.textAlign = 'right';
    ctx.fillText('✔ UPGRADED ✔ PREMIUM ✔ 2026', W * 0.96, H * 0.94);
  }

  const THUMB = [['#fff200', '#ff3d00'], ['#00f0ff', '#7a00ff'], ['#ff00a8', '#ffcc00'], ['#39ff14', '#007aff']];

  function paintThumb(ctx, W, H, im) {
    const [a, b] = THUMB[im.palette % THUMB.length];
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const ox = W * 0.74, oy = H * 0.6;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let i = 0; i < 16; i++) {
      ctx.rotate((Math.PI * 2) / 16);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(W, -W * 0.06);
      ctx.lineTo(W, W * 0.06);
      ctx.fill();
    }
    ctx.restore();

    drawEmoji(ctx, im.face, W * 0.24, H * 0.62, H * 0.78);
    drawEmoji(ctx, im.obj, ox, oy, H * 0.38);
    ctx.strokeStyle = '#ff1e1e';
    ctx.lineWidth = H * 0.028;
    ctx.beginPath();
    ctx.arc(ox, oy, H * 0.27, 0, Math.PI * 2);
    ctx.stroke();

    // Arrow pointing at the thing.
    const x1 = W * 0.46, y1 = H * 0.42, x2 = ox - H * 0.3, y2 = oy - H * 0.06;
    const ang = Math.atan2(y2 - y1, x2 - x1);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2 - Math.cos(ang) * H * 0.05, y2 - Math.sin(ang) * H * 0.05);
    ctx.stroke();
    ctx.fillStyle = '#ff1e1e';
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - Math.cos(ang - 0.5) * H * 0.1, y2 - Math.sin(ang - 0.5) * H * 0.1);
    ctx.lineTo(x2 - Math.cos(ang + 0.5) * H * 0.1, y2 - Math.sin(ang + 0.5) * H * 0.1);
    ctx.fill();

    ctx.font = `800 ${H * 0.16}px ${DISPLAY}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.lineWidth = H * 0.035;
    ctx.strokeStyle = '#000';
    ctx.strokeText(im.text, W * 0.96, H * 0.22);
    ctx.fillStyle = '#fff200';
    ctx.fillText(im.text, W * 0.96, H * 0.22);

    ctx.fillStyle = 'rgba(0,0,0,0.82)';
    const bw = W * 0.1, bh = H * 0.075;
    ctx.fillRect(W * 0.975 - bw, H * 0.965 - bh, bw, bh);
    ctx.font = `700 ${H * 0.048}px ${SANS}`;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('12:47', W * 0.975 - bw / 2, H * 0.965 - bh / 2);
  }

  const SUNSETS = [
    ['#2b1055', '#d53369', '#ffb88c'],
    ['#0f2027', '#2c5364', '#f9d29d'],
    ['#41295a', '#ff6a88', '#ffd194'],
    ['#1a2a6c', '#b21f1f', '#fdbb2d'],
  ];

  function paintQuote(ctx, W, H, im, R) {
    const [a, b, c] = SUNSETS[im.palette % SUNSETS.length];
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, a);
    g.addColorStop(0.6, b);
    g.addColorStop(1, c);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const sun = ctx.createRadialGradient(W / 2, H * 0.72, 0, W / 2, H * 0.72, W * 0.3);
    sun.addColorStop(0, 'rgba(255,240,200,1)');
    sun.addColorStop(0.25, 'rgba(255,220,160,0.9)');
    sun.addColorStop(1, 'rgba(255,200,150,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, W, H);

    for (let layer = 0; layer < 3; layer++) {
      ctx.fillStyle = `rgba(10,5,25,${0.45 + layer * 0.2})`;
      ctx.beginPath();
      ctx.moveTo(0, H);
      const base = H * (0.72 + layer * 0.08);
      for (let x = 0; x <= W + W / 8; x += W / 8) ctx.lineTo(x, base - R.f() * H * 0.12);
      ctx.lineTo(W, H);
      ctx.fill();
    }

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = W * 0.02;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    let size = W * 0.075;
    ctx.font = `800 ${size}px ${DISPLAY}`;
    let lines = wrap(ctx, `“${im.text}”`, W * 0.8);
    while (lines.length > 5) {
      size *= 0.9;
      ctx.font = `800 ${size}px ${DISPLAY}`;
      lines = wrap(ctx, `“${im.text}”`, W * 0.8);
    }
    const lh = size * 1.12;
    let y = H * 0.4 - (lines.length * lh) / 2 + size * 0.8;
    for (const l of lines) {
      ctx.fillText(l, W / 2, y);
      y += lh;
    }
    ctx.font = `500 ${W * 0.034}px ${SANS}`;
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.fillText(`— ${im.who}`, W / 2, y + W * 0.02);
    ctx.restore();
  }

  function paint(ctx, W, H, post) {
    const R = S.makeRand(S.hashString('img:' + post.genre + ':' + post.seed));
    const im = post.image;
    if (im.kind === 'miracle') paintMiracle(ctx, W, H, im, R);
    else if (im.kind === 'product') paintProduct(ctx, W, H, im);
    else if (im.kind === 'thumb') paintThumb(ctx, W, H, im);
    else paintQuote(ctx, W, H, im, R);
  }

  const imgCache = new Map();
  const scratch = document.createElement('canvas');

  function imageURL(post) {
    const key = post.genre + ':' + post.seed;
    if (imgCache.has(key)) return imgCache.get(key);
    const W = 720, H = Math.round(W * ASPECT[post.image.kind]);
    scratch.width = W;
    scratch.height = H;
    paint(scratch.getContext('2d'), W, H, post);
    const url = scratch.toDataURL('image/jpeg', 0.86);
    imgCache.set(key, url);
    return url;
  }

  // ----------------------------------------------------------- post cards

  const avatarBg = (hue) => `linear-gradient(135deg, hsl(${hue} 85% 62%), hsl(${(hue + 70) % 360} 80% 48%))`;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function renderPost(post, pinned) {
    const card = el('article', 'post' + (pinned ? ' pinned' : ''));
    card.dataset.id = post.id;

    const head = el('header', 'post-head');
    const av = el('div', 'avatar', post.author.avatar);
    av.style.background = avatarBg(post.hue);
    av.setAttribute('aria-hidden', 'true');
    const who = el('div', 'who');
    who.append(el('strong', '', post.author.name));
    if (post.author.sub) who.append(el('span', '', post.author.sub));
    if (post.meta) who.append(el('span', '', post.meta));
    const badges = el('div');
    badges.append(el('span', 'badge', `${post.genreEmoji} ${post.genreLabel}`));
    if (post.level > 1) badges.append(el('span', 'badge lvl', `🔥 Lv ${post.level}`));
    head.append(av, who, badges);
    card.append(head);

    if (post.title) card.append(el('h3', 'post-title', post.title));

    const body = el('div', 'post-body');
    const lines = post.body.split('\n');
    for (const line of lines) body.append(line.startsWith('## ') ? el('h4', '', line.slice(3)) : el('p', '', line));
    card.append(body);
    if (lines.length > 14 || post.body.length > 900) {
      body.classList.add('clamped');
      const more = el('button', 'see-more', '…see more');
      more.addEventListener('click', () => {
        body.classList.remove('clamped');
        more.remove();
      });
      card.append(more);
    }

    if (post.image) {
      const img = el('img', 'post-img');
      img.src = imageURL(post);
      img.alt = post.image.kind === 'quote' ? `Quote card: “${post.image.text}” — ${post.image.who}` : 'Extremely real AI-generated image';
      img.width = 720;
      img.height = Math.round(720 * ASPECT[post.image.kind]);
      img.decoding = 'async';
      card.append(img);
    }

    card.append(el('div', 'stats', post.stats));

    if (post.comments && post.comments.length) {
      const list = el('div', 'comments');
      for (const c of post.comments) {
        const cm = el('div', 'comment');
        cm.append(el('b', '', c.name), document.createTextNode(c.text));
        list.append(cm);
      }
      card.append(list);
    }

    const actions = el('div', 'actions');
    const sloppier = el('button', 'act sloppier', post.level >= S.MAX_LEVEL ? '☢️ Max slop' : '🔥 Sloppier');
    sloppier.disabled = post.level >= S.MAX_LEVEL;
    sloppier.title = 'Regenerate this post with more slop';
    sloppier.addEventListener('click', () => {
      const next = S.generate(post.genre, post.seed, post.level + 1);
      const fresh = renderPost(next, pinned);
      card.replaceWith(fresh);
      if (pinned) history.replaceState(null, '', '#p=' + next.id);
      bump(1);
    });
    const copy = el('button', 'act', '📋 Copy');
    copy.addEventListener('click', () => copyText(S.plainText(post) + '\n\n— via slopographic.com', 'Copied. Go forth and pollute. 🫡'));
    const meme = el('button', 'act', '🖼️ Meme');
    meme.title = 'Save this post as an image';
    meme.addEventListener('click', () => saveMeme(post));
    const share = el('button', 'act', '🔗 Share');
    share.addEventListener('click', () => sharePost(post));
    actions.append(sloppier, copy, meme, share);
    card.append(actions);
    return card;
  }

  // -------------------------------------------------------- meme export

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Lays out the card; when `draw` is false it only measures the height.
  function cardPass(ctx, post, imgCanvas, draw, H = 0) {
    const M = 24, CW = 600 - M * 2, P = 24, TW = CW - P * 2;
    let y = M + P;
    const text = (str, x, yy, font, color, align = 'left') => {
      if (!draw) return;
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(str, x, yy);
    };

    if (draw) {
      const bg = ctx.createLinearGradient(0, 0, 600, 600);
      bg.addColorStop(0, '#2a1650');
      bg.addColorStop(1, '#0b0912');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 600, H);
      ctx.fillStyle = '#15121f';
      roundRect(ctx, M, M, CW, H - M - 50, 18);
      ctx.fill();
      ctx.save();
      roundRect(ctx, M + P, y, 48, 48, 24);
      const g = ctx.createLinearGradient(M + P, y, M + P + 48, y + 48);
      g.addColorStop(0, `hsl(${post.hue} 85% 62%)`);
      g.addColorStop(1, `hsl(${(post.hue + 70) % 360} 80% 48%)`);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();
      drawEmoji(ctx, post.author.avatar, M + P + 24, y + 26, 24);
    }
    const nx = M + P + 60, nw = TW - 60;
    text(post.author.name, nx, y + 18, `700 17px ${SANS}`, '#f4f0ff');
    ctx.font = `400 12.5px ${SANS}`;
    let sy = y + 36;
    for (const l of wrap(ctx, [post.author.sub, post.meta].filter(Boolean).join(' · '), nw).slice(0, 3)) {
      text(l, nx, sy, `400 12.5px ${SANS}`, '#a49dbd');
      sy += 16;
    }
    y = Math.max(y + 56, sy) + 8;

    if (post.title) {
      ctx.font = `800 22px ${DISPLAY}`;
      for (const l of wrap(ctx, post.title, TW)) {
        y += 26;
        text(l, M + P, y, `800 22px ${DISPLAY}`, '#f4f0ff');
      }
      y += 8;
    }

    let budget = post.image ? 16 : 34;
    for (const raw of post.body.split('\n')) {
      if (budget <= 0) break;
      if (!raw.trim()) { y += 10; continue; }
      const h4 = raw.startsWith('## ');
      const font = h4 ? `800 17px ${DISPLAY}` : `400 15.5px ${SANS}`;
      ctx.font = font;
      for (const l of wrap(ctx, h4 ? raw.slice(3) : raw, TW)) {
        if (budget-- <= 0) {
          y += 22;
          text('…see more', M + P, y, `600 15px ${SANS}`, '#a49dbd');
          break;
        }
        y += h4 ? 26 : 22;
        text(l, M + P, y, font, '#f4f0ff');
      }
    }
    y += 14;

    if (imgCanvas) {
      const ih = CW * ASPECT[post.image.kind];
      if (draw) ctx.drawImage(imgCanvas, M, y, CW, ih);
      y += ih + 6;
    }

    ctx.font = `400 13px ${SANS}`;
    for (const l of wrap(ctx, post.stats, TW)) {
      y += 20;
      text(l, M + P, y, `400 13px ${SANS}`, '#a49dbd');
    }
    y += P;

    const footY = y + 24;
    text('🍲 slopographic.com', M + 4, footY, `700 14px ${SANS}`, '#f4f0ff');
    text(`${post.genreEmoji} ${post.genreLabel}${post.level > 1 ? ` · slop level ${post.level}` : ''}`, 600 - M - 4, footY, `500 13px ${SANS}`, '#a49dbd', 'right');
    return footY + 18;
  }

  function saveMeme(post) {
    const scale = 2;
    let imgCanvas = null;
    if (post.image) {
      imgCanvas = document.createElement('canvas');
      imgCanvas.width = 552 * scale;
      imgCanvas.height = Math.round(552 * scale * ASPECT[post.image.kind]);
      paint(imgCanvas.getContext('2d'), imgCanvas.width, imgCanvas.height, post);
    }
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    c.width = 600 * scale;
    c.height = 2000;
    const h = cardPass(ctx, post, imgCanvas, false);
    c.height = Math.ceil(h * scale);
    ctx.scale(scale, scale);
    cardPass(ctx, post, imgCanvas, true, h);
    c.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `slop-${post.id}.png`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      toast('Meme saved. Post it everywhere. 🖼️');
    }, 'image/png');
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

  async function sharePost(post) {
    const url = `${location.origin}${location.pathname}#p=${post.id}`;
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      try {
        await navigator.share({ title: 'Fresh slop from Slopographic', text: post.title || post.body.split('\n')[0], url });
        return;
      } catch { /* cancelled: fall back to copying */ }
    }
    copyText(url, 'Link copied. Spread the slop. 🔗');
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

  // ------------------------------------------------------------- feed

  const feedState = { genres: new Set(S.GENRES.map((g) => g.key)), level: 1 };
  const feedEl = $('#feed');
  let lastGenre = '';

  function nextPost() {
    const keys = [...feedState.genres];
    let genre = keys[Math.floor(Math.random() * keys.length)];
    if (keys.length > 1 && genre === lastGenre) genre = keys[(keys.indexOf(genre) + 1) % keys.length];
    lastGenre = genre;
    // Mild = 1, Industrial = 2-3, Maximum = 4-5
    const lv = feedState.level === 1 ? 1 : feedState.level === 2 ? 2 + (Math.random() < 0.5 ? 1 : 0) : 4 + (Math.random() < 0.5 ? 1 : 0);
    return S.generate(genre, (Math.random() * 2 ** 31) >>> 0, lv);
  }

  function loadMore(n = 5) {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < n; i++) frag.append(renderPost(nextPost(), false));
    feedEl.append(frag);
    bump(n);
  }

  function resetFeed() {
    feedEl.textContent = '';
    loadMore(6);
  }

  const chips = $('#chips');
  const allChip = el('button', 'chip', '✨ All slop');
  allChip.dataset.genre = '*';
  chips.append(allChip);
  for (const g of S.GENRES) {
    const c = el('button', 'chip', `${g.emoji} ${g.label}`);
    c.dataset.genre = g.key;
    chips.append(c);
  }

  function syncChips() {
    const all = feedState.genres.size === S.GENRES.length;
    for (const c of chips.children) {
      c.setAttribute('aria-pressed', String(c.dataset.genre === '*' ? all : !all && feedState.genres.has(c.dataset.genre)));
    }
    document.querySelectorAll('[data-level]').forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.level === feedState.level)));
  }

  chips.addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (!c) return;
    const all = feedState.genres.size === S.GENRES.length;
    const key = c.dataset.genre;
    if (key === '*') feedState.genres = new Set(S.GENRES.map((g) => g.key));
    else if (all) feedState.genres = new Set([key]);
    else if (feedState.genres.has(key)) {
      feedState.genres.delete(key);
      if (!feedState.genres.size) feedState.genres = new Set(S.GENRES.map((g) => g.key));
    } else feedState.genres.add(key);
    syncChips();
    resetFeed();
  });

  document.querySelectorAll('[data-level]').forEach((b) =>
    b.addEventListener('click', () => {
      feedState.level = +b.dataset.level;
      syncChips();
      resetFeed();
      toast(['', 'Mild slop. Practically organic. 🥄', 'Industrial slop engaged. 🏭', '☢️ MAXIMUM SLOP. You were warned.'][feedState.level]);
    }),
  );

  new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting) && !$('#view-feed').hidden) loadMore(5);
  }, { rootMargin: '1200px 0px' }).observe($('#sentinel'));

  // ---------------------------------------------------------- detector

  const input = $('#detect-input');
  const HUMAN = [
    'Took the dog to the vet this morning. She was fine, just ate a sock again. The vet laughed and charged us $180 anyway. On the way home we got stuck behind a tractor for twenty minutes and I listened to the same three songs on repeat.',
    'hey, are you still coming saturday? bring chairs if you have them, we only have like four. also mike says he’s making his chili again so maybe eat before lol',
    'The meeting ran long because nobody could find the projector remote. We eventually gave up and crowded around Dana’s laptop. Budget numbers look fine; the main issue is the vendor still hasn’t sent the revised quote.',
    'I planted tomatoes too early again. Every year I tell myself to wait until May, and every year I don’t. Two of them made it. The rest are a lesson I will absolutely ignore next spring.',
  ];
  let humanIdx = 0;

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
    $('#score').textContent = r.score;
    $('#tier-emoji').textContent = r.tier.emoji;
    $('#tier-name').textContent = r.tier.name;
    $('#tier-blurb').textContent = r.tier.blurb;
    const fill = $('#bar-fill');
    fill.style.width = Math.max(2, r.score) + '%';
    fill.style.backgroundSize = `${(100 / Math.max(2, r.score)) * 100}% 100%`;

    const tells = $('#tells');
    tells.textContent = '';
    const entries = Object.entries(r.tally).sort((a, b) => b[1] - a[1]);
    if (!entries.length) tells.append(el('li', 'none', 'No tells found. Suspiciously human. 🧐'));
    for (const [label, n] of entries) {
      const li = el('li');
      const b = el('b', '', `×${n}`);
      li.append(b, document.createTextNode(' ' + label));
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
    lastVerdict = `My text scored ${r.score}% slop on slopographic.com: ${r.tier.emoji} ${r.tier.name}. ${r.tier.blurb}`;
  }
  let lastVerdict = '';

  let detectTimer = 0;
  input.addEventListener('input', () => {
    clearTimeout(detectTimer);
    detectTimer = setTimeout(runDetector, 120);
  });
  $('#sample-slop').addEventListener('click', () => {
    const g = S.GENRES[Math.floor(Math.random() * S.GENRES.length)].key;
    input.value = S.plainText(S.generate(g, (Math.random() * 2 ** 31) >>> 0, Math.random() < 0.5 ? 1 : 2));
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
  $('#copy-verdict').addEventListener('click', () => copyText(lastVerdict, 'Verdict copied. 📋'));

  // ------------------------------------------------------------ routing

  function showView(name) {
    $('#view-feed').hidden = name !== 'feed';
    $('#view-detector').hidden = name !== 'detector';
    document.querySelectorAll('.tab').forEach((t) => {
      if (t.dataset.view === name) t.setAttribute('aria-current', 'page');
      else t.removeAttribute('aria-current');
    });
  }

  document.querySelectorAll('[data-view]').forEach((t) =>
    t.addEventListener('click', (e) => {
      e.preventDefault();
      const v = t.dataset.view;
      history.replaceState(null, '', v === 'detector' ? '#detector' : location.pathname + location.search);
      showView(v);
      window.scrollTo({ top: 0 });
      if (v === 'detector') input.focus({ preventScroll: true });
    }),
  );

  function route() {
    const hash = location.hash.slice(1);
    const pinned = $('#pinned');
    pinned.textContent = '';
    if (hash === 'detector') {
      showView('detector');
      return;
    }
    showView('feed');
    const m = /^p=(.+)$/.exec(hash);
    const parsed = m && S.parseId(decodeURIComponent(m[1]));
    if (parsed) {
      pinned.append(el('p', 'pin-label', '🔗 Someone sent you this slop:'));
      pinned.append(renderPost(S.generate(parsed.genre, parsed.seed, parsed.level), true));
    }
  }
  window.addEventListener('hashchange', route);

  const setTopOffset = () => document.documentElement.style.setProperty('--top', $('.topbar').offsetHeight + 'px');
  window.addEventListener('resize', setTopOffset);

  // --------------------------------------------------------------- boot

  syncChips();
  setTopOffset();
  route();
  const fontsReady = document.fonts && document.fonts.load
    ? Promise.race([
        Promise.all([document.fonts.load(`800 40px "Bricolage Grotesque"`), document.fonts.load('400 16px Inter'), document.fonts.load('700 16px Inter')]),
        new Promise((r) => setTimeout(r, 1500)),
      ]).catch(() => {})
    : Promise.resolve();
  fontsReady.then(() => {
    // Re-render a pinned post so its image picks up the web fonts.
    imgCache.clear();
    route();
    resetFeed();
  });
})();
