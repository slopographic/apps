/* Slopographic motion layer (site-wide): slime cursor, scroll-reactive
 * ticker, the Authenticator's stamp slam and the footer
 * slime fill. The home page film lives in scenes.js.
 * Everything here is decoration: the site works without it, and it all
 * switches off for people who prefer reduced motion.
 */
(() => {
  'use strict';

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const finePointer = matchMedia('(pointer: fine)').matches;

  // --------------------------------------------------------- slime cursor

  if (finePointer) {
    // A tapered slug of slime drawn on one canvas: cheap, no filters.
    const cv = document.createElement('canvas');
    cv.className = 'slime';
    document.body.append(cv);
    const cx = cv.getContext('2d');
    const size = () => {
      const d = 1; // a soft blob doesn't need retina pixels
      cv.width = innerWidth * d;
      cv.height = innerHeight * d;
      cx.setTransform(d, 0, 0, d, 0, 0);
    };
    size();
    addEventListener('resize', size);
    const N = 10;
    const pts = Array.from({ length: N }, () => ({ x: -100, y: -100 }));
    let mx = -100, my = -100, idle = 0;
    addEventListener('pointermove', (e) => {
      mx = e.clientX;
      my = e.clientY;
      idle = 0;
    }, { passive: true });
    (function tick() {
      requestAnimationFrame(tick);
      if (idle > 90) return;
      idle++;
      pts[0].x += (mx - pts[0].x) * 0.55;
      pts[0].y += (my - pts[0].y) * 0.55;
      for (let k = 1; k < N; k++) {
        pts[k].x += (pts[k - 1].x - pts[k].x) * 0.42;
        pts[k].y += (pts[k - 1].y - pts[k].y) * 0.42;
      }
      cx.clearRect(0, 0, innerWidth, innerHeight);
      cx.lineCap = 'round';
      cx.strokeStyle = cx.fillStyle = '#d4ff3a';
      for (let k = N - 1; k > 0; k--) {
        cx.lineWidth = 18 * (1 - k / N) + 3;
        cx.beginPath();
        cx.moveTo(pts[k].x, pts[k].y);
        cx.lineTo(pts[k - 1].x, pts[k - 1].y);
        cx.stroke();
      }
      cx.beginPath();
      cx.arc(pts[0].x, pts[0].y, 10, 0, Math.PI * 2);
      cx.fill();
      cx.fillStyle = 'rgba(255,255,255,0.75)';
      cx.beginPath();
      cx.arc(pts[0].x - 3, pts[0].y - 3, 2.6, 0, Math.PI * 2);
      cx.fill();
    })();
    addEventListener('pointerdown', (e) => {
      for (let k = 0; k < 7; k++) {
        const s = document.createElement('i');
        s.className = 'splat';
        const a = (k / 7) * Math.PI * 2 + Math.random() * 0.5;
        const d = 18 + Math.random() * 26;
        s.style.left = e.clientX + 'px';
        s.style.top = e.clientY + 'px';
        s.style.setProperty('--dx', Math.cos(a) * d + 'px');
        s.style.setProperty('--dy', Math.sin(a) * d + 'px');
        document.body.append(s);
        s.addEventListener('animationend', () => s.remove());
      }
    });
  }

  // ------------------------------------------------- scroll-driven ticker

  const track = $('.ticker-track');
  if (track) {
    let lastY = scrollY, vel = 0;
    addEventListener('scroll', () => {
      vel += (scrollY - lastY) * 0.06;
      lastY = scrollY;
    }, { passive: true });
    (function loop() {
      vel *= 0.9;
      const v = Math.max(-8, Math.min(8, vel));
      // Re-read each frame: hiding the ticker (on the home film) recreates its animation.
      const anim = track.getAnimations()[0];
      if (anim) anim.playbackRate = 1 + Math.abs(v) * (v < 0 ? -1.4 : 1);
      requestAnimationFrame(loop);
    })();
  }

  // -------------------------------------------------- authenticator

  let shown = 0;
  let lastStamp = '';
  let countRaf = 0;
  document.addEventListener('slop:verdict', (e) => {
    const { score, stamp } = e.detail;
    const el = $('#score');
    const from = shown;
    const t0 = performance.now();
    cancelAnimationFrame(countRaf);
    (function step(now) {
      const p = Math.min(1, (now - t0) / 900);
      const eased = 1 - Math.pow(1 - p, 3);
      shown = Math.round(from + (score - from) * eased);
      el.textContent = shown;
      if (p < 1) countRaf = requestAnimationFrame(step);
    })(t0);

    if (stamp !== lastStamp) {
      lastStamp = stamp;
      const st = $('#stamp');
      const cert = $('#result');
      st.classList.remove('slam');
      cert.classList.remove('thud');
      void st.offsetWidth;
      st.classList.add('slam');
      cert.classList.add('thud');
    }
  });

  // ------------------------------------------------------ footer fill

  const fm = $('.footer-mark');
  if (fm) {
    new IntersectionObserver((entries) => {
      entries.forEach((e) => fm.classList.toggle('filled', e.isIntersecting));
    }, { threshold: 0.6 }).observe(fm);
  }
})();
