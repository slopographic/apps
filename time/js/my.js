/* Slop Time "My time": my working pattern (home zone, hours, days) and "My time in…", which shows the time in a chosen
 * city and when my working hours fall there. Classic script (after state.js, ui.js, work.js). Exposes window.SlopTime.my. */
(function (g) {
  'use strict';
  const ns = (g.SlopTime = g.SlopTime || {});
  const Z = ns.zones, S = ns.state, W = ns.work, UI = ns.ui, $ = UI.$;

  function readPrefs() {
    const days = [...document.querySelectorAll('input[name="st-day"]:checked')].map((i) => Number(i.value));
    return { zone: $('st-home').value.trim(), days, start: Number($('st-start').value), end: Number($('st-end').value) };
  }
  function showPrefs(p) {
    $('st-home').value = p.zone;
    $('st-start').value = String(p.start);
    $('st-end').value = String(p.end);
    document.querySelectorAll('input[name="st-day"]').forEach((i) => { i.checked = p.days.includes(Number(i.value)); });
  }
  function savePrefs() {
    const raw = readPrefs();
    if (!Z.isZone(raw.zone)) { $('st-prefs-err').textContent = 'Choose your time zone from the list, such as Europe/London.'; return; }
    S.setPrefs(raw);
    $('st-prefs-err').textContent = '';
    ns.world.render();
    render();
  }

  function render() {
    const p = S.prefs();
    const zone = $('st-my-zone').value.trim();
    const out = $('st-my-out');
    out.replaceChildren();
    if (!Z.isZone(zone)) { $('st-my-msg').textContent = zone ? 'Choose a zone from the list.' : 'Choose a city to see your time there.'; return; }
    const t = S.nowMs();
    const day = $('st-my-date').value || UI.todayIn(p.zone);
    const target = W.normalize({ zone, days: p.days, start: p.start, end: p.end }, zone);
    const mine = W.dayWindows([p], p.zone, day);
    const both = W.dayWindows([p, target], p.zone, day);
    const lines = [
      `It is ${UI.hm(zone, t)} on ${UI.dayLabel(zone, t)} in ${Z.cityOf(zone)} (${Z.gmtLabel(Z.offsetMinutes(zone, t))}).`,
      `${W.isWorkingAt(target, t) ? 'It is inside the usual working hours there.' : 'It is outside the usual working hours there.'}`,
    ];
    $('st-my-msg').textContent = lines.join(' ');
    addSection(out, 'Your working hours, in their time', mine, p.zone, zone, `You have no working hours on ${day}.`);
    addSection(out, 'When you are both working (they keep the same days and hours)', both, p.zone, zone, `No overlap on ${day}.`);
  }

  function addSection(host, title, windows, homeZone, zone, emptyText) {
    const h = document.createElement('h3');
    h.textContent = title;
    host.append(h);
    if (!windows.length) { const q = document.createElement('p'); q.className = 'st-note'; q.textContent = emptyText; host.append(q); return; }
    const ul = document.createElement('ul');
    ul.className = 'st-windows';
    for (const w of windows) {
      const li = document.createElement('li');
      li.textContent = `${UI.windowLabel(homeZone, w.start, w.end)} your time = ${UI.windowLabel(zone, w.start, w.end)} there`;
      ul.append(li);
    }
    host.append(ul);
  }

  function init() {
    const prefs = S.prefs();
    showPrefs(prefs);
    $('st-my-date').value = UI.todayIn(prefs.zone);
    for (const id of ['st-home', 'st-start', 'st-end']) $(id).addEventListener('change', savePrefs);
    document.querySelectorAll('input[name="st-day"]').forEach((i) => i.addEventListener('change', savePrefs));
    for (const id of ['st-my-zone', 'st-my-date']) $(id).addEventListener('input', render);
    render();
  }

  ns.my = Object.freeze({ init, render, savePrefs });
})(typeof window !== 'undefined' ? window : globalThis);
