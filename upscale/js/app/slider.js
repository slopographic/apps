/* Slop Upscale: the before and after slider. The "before" picture sits underneath, the "after" on top and is clipped
 * at the divider. A range input moves the divider (mouse, touch, keyboard). Classic script; adds SlopUpscale.slider.
 *   show(box, before, after)   before, after: <img>, <canvas> or <video> elements of the same aspect ratio
 *   Returns nothing; calling show again replaces the content of box. */
(function (g) {
  'use strict';
  const U = (g.SlopUpscale = g.SlopUpscale || {}), SL = (U.slider = {});

  SL.show = function (box, before, after) {
    const layer = (cls, el) => { const d = document.createElement('div'); d.className = 'up-layer ' + cls; el.setAttribute('aria-hidden', cls === 'up-after' ? 'false' : 'true'); d.append(el); return d; };
    const range = document.createElement('input');
    range.type = 'range'; range.min = '0'; range.max = '100'; range.value = '50'; range.className = 'up-range';
    range.setAttribute('aria-label', 'Before and after: drag to compare');
    const divider = document.createElement('div');
    divider.className = 'up-divider';
    const after_ = layer('up-after', after);
    const setPos = () => {
      const p = range.value;
      after_.style.clipPath = `inset(0 0 0 ${p}%)`;
      divider.style.left = p + '%';
    };
    range.addEventListener('input', setPos);
    box.replaceChildren(layer('up-before', before), after_, divider, range);
    box.insertAdjacentHTML('beforeend', '');
    setPos();
    box.append(labelFor('Before', 'up-tag-before'), labelFor('After', 'up-tag-after'));
  };

  function labelFor(text, cls) {
    const s = document.createElement('span');
    s.className = 'up-tag ' + cls; s.textContent = text;
    return s;
  }
})(typeof window !== 'undefined' ? window : globalThis);
