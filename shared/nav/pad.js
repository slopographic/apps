/* SlopNav try-it pad: a small playground that uses the same engine as the app. It has its own zoom
 * and pan (a 600 x 380 grid world), and takes input only while the pointer is over it, so the
 * modal can test draft bindings before they are applied. Classic script; sets window.SlopNav.pad. */
(function () {
  'use strict';
  const N = (window.SlopNav = window.SlopNav || {});
  const W = 600, H = 380;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /**
   * mount(el, { bindings(), onChange(text) }) → { refresh(), destroy() }
   * el is the pad's box; bindings() gives the bindings to try; onChange gets a readout line.
   */
  function mount(el, opts) {
    el.classList.add('nav-pad');
    el.innerHTML = '';
    const world = document.createElement('div');
    world.className = 'nav-world';
    world.style.width = W + 'px'; world.style.height = H + 'px';
    world.innerHTML = '<span class="nav-world-tag">Try it here</span>';
    el.append(world);
    const st = { z: 1, ox: 0, oy: 0, last: '' };
    const box = () => el.getBoundingClientRect();
    const readout = () => {
      const pct = Math.round(st.z * 100);
      if (opts.onChange) opts.onChange(`Zoom ${pct}%${st.last ? ' · last: ' + st.last : ''}`);
    };
    const paint = () => { world.style.transform = `translate(${st.ox}px, ${st.oy}px) scale(${st.z})`; readout(); };
    const centre = (z) => { const r = box(); st.z = z; st.ox = (r.width - W * z) / 2; st.oy = (r.height - H * z) / 2; paint(); };
    const adapter = {
      zoomAt(f, x, y) {
        const nz = clamp(st.z * f, 0.1, 8), k = nz / st.z;
        st.ox = x - (x - st.ox) * k; st.oy = y - (y - st.oy) * k; st.z = nz; paint();
      },
      panBy(dx, dy) { st.ox += dx; st.oy += dy; paint(); },
      fit() { const r = box(); centre(Math.min(r.width / W, r.height / H) * 0.9); },
      actual() { centre(1); },
      zoomStep(dir, x, y) { adapter.zoomAt(dir > 0 ? 1.25 : 0.8, x, y); },
    };
    const eng = N.engine.attach({
      host: el, adapter, keys: 'hover', bindings: () => (opts.bindings ? opts.bindings() : N.presets.get('slop').bindings),
      onAction(a) { st.last = ({ zoom: 'zoom', pan: 'pan', pinch: 'pinch', fit: 'fit', actual: '100%', zoomIn: 'zoom in', zoomOut: 'zoom out', clickZoom: 'click zoom', hand: 'hold to pan' })[a.type] + (a.via ? ' (' + a.via + ')' : ''); readout(); },
    });
    requestAnimationFrame(() => centre(1));
    return {
      refresh() { readout(); },
      fit() { adapter.fit(); },
      destroy() { eng.detach(); el.innerHTML = ''; el.classList.remove('nav-pad'); },
    };
  }

  N.pad = { mount, W, H };
})();
