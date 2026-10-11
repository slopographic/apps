/* Slop Drive — ui/mini-player: the bar at the bottom of the page while a file plays, so playback goes on after Quick look
 * or the details panel is closed. Shows the name, play or pause, previous and next, the time and a stop button. */
'use strict';
(function (DR) {
  const el = DR.el, P = DR.player;
  const clock = (t) => { t = isFinite(t) && t > 0 ? Math.floor(t) : 0; return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
  const button = (label, title, act) => { const b = el('button', { type: 'button', class: 'btn mp-b', title, 'aria-label': title }, label); b.addEventListener('click', act); return b; };
  let bar = null, name = null, play = null, time = null;
  function build() {
    name = el('span', { class: 'mp-name' });
    play = button('▶', 'Play', () => P.toggle());
    time = el('span', { class: 'mp-time' });
    bar = el('div', { class: 'mini-player', role: 'region', 'aria-label': 'Audio player', hidden: '' },
      el('span', { class: 'mp-label' }, 'Now playing'), name,
      button('⏮', 'Previous file', () => P.step(-1)), play, button('⏭', 'Next file', () => P.step(1)), time,
      button('Stop', 'Stop playback', () => P.stop()));
    document.body.append(bar);
    P.subscribe(render);
    render();
  }
  function render() {
    if (!bar) return;
    bar.hidden = !P.cur;
    if (!P.cur) return;
    name.textContent = P.cur.name;
    name.title = P.error || P.cur.name;
    play.textContent = P.audio.paused ? '▶' : '❚❚';
    play.title = play.getAttribute('aria-label') === 'Play' && P.audio.paused ? 'Play' : (P.audio.paused ? 'Play' : 'Pause');
    play.setAttribute('aria-label', play.title);
    time.textContent = `${clock(P.audio.currentTime)} / ${clock(P.audio.duration)}`;
  }
  if (document.body) build(); else document.addEventListener('DOMContentLoaded', build);
})(window.DR);
