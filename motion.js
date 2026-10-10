/* Slopographic motion layer (site-wide): the Authenticator's stamp slam and
 * the footer slime fill. The 3D showreel lives in reel.js.
 * Everything here is decoration: the site works without it, and it all
 * switches off for people who prefer reduced motion.
 */
(() => {
  'use strict';

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const finePointer = matchMedia('(pointer: fine)').matches;

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
