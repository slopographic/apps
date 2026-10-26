/* PhotoSlop: the welcome card on the blank canvas of a first visit (no saved work, nothing opened from the hub). It shows
 * what PhotoSlop makes and how (SlopDrop.panel.preview, the same preview the drop zones use) and a sample photo to try it
 * on, which goes through the drop strip's batch like a dropped file. The card does not take clicks on the canvas: the
 * first stroke, a new tab, a file or Close removes it. */
'use strict';

/** The card's picture and steps, in the current language. */
const WELCOME = () => ({
  picture: { src: '../assets/shots/photoslop.jpg', alt: tr('photoslop.welcome.alt') },
  steps: [tr('photoslop.welcome.step_open'), tr('photoslop.welcome.step_edit'), tr('photoslop.welcome.step_export')],
});

function showWelcome() {
  const vp = $('#viewport');
  const pv = window.SlopDrop && SlopDrop.panel.preview(WELCOME());
  if (!vp || !pv || $('#psWelcome')) return;
  const doc = D; // the blank tab the card belongs to
  let card = null;
  const close = () => {
    if (!card) return;
    card.remove(); card = null;
    listeners.delete(onModel);
    vp.removeEventListener('pointerdown', onDown, true);
  };
  const onModel = (w) => { if (D !== doc || (w === 'history' && Hist.idx > 0)) close(); };
  const onDown = (e) => { if (card && !card.contains(e.target)) close(); };
  const sample = h('button', { type: 'button', class: 'sd-sample', id: 'psWelcomeSample', onclick: () => {
    close();
    if (window.SlopSamples) SlopIntake.sample(() => SlopSamples.photos(1, { width: 1600, height: 1000 }), { to: 'photoslop', mode: 'new' });
  } }, tr('photoslop.welcome.sample'));
  const shut = h('button', { type: 'button', class: 'sd-sample', onclick: close }, tr('photoslop.welcome.blank'));
  const inner = h('div', { class: 'ps-welcome-card' }, pv, h('div', { class: 'sd-acts' }, sample, shut));
  inner.addEventListener('pointerdown', (e) => e.stopPropagation()); // a press on the card is not a stroke on the canvas
  card = h('div', { class: 'ps-welcome', id: 'psWelcome', role: 'region', 'aria-label': tr('photoslop.welcome.region') }, inner);
  vp.append(card);
  listeners.add(onModel);
  vp.addEventListener('pointerdown', onDown, true); // a stroke on the canvas starts work: the card goes, the stroke goes on
}
