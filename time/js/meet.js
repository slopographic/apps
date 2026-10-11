/* Slop Time meeting planner: pick zones, a day and a slot length, and see the hours when everyone is inside their
 * working hours. The day is the 24 hours from local midnight in my zone. Classic script (after state.js, ui.js, work.js).
 * Exposes window.SlopTime.meet. The zone list is kept for this visit only (use "My cities" to reset it). */
(function (g) {
  'use strict';
  const ns = (g.SlopTime = g.SlopTime || {});
  const Z = ns.zones, S = ns.state, W = ns.work, UI = ns.ui, $ = UI.$;
  let zones = [];

  function renderChips() {
    const list = $('st-meet-zones');
    list.replaceChildren(...zones.map((z) => {
      const li = document.createElement('li');
      li.className = 'st-chip';
      const name = document.createElement('span');
      name.textContent = Z.cityOf(z);
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'st-btn st-small';
      x.textContent = '×';
      x.setAttribute('aria-label', `Remove ${Z.cityOf(z)} from the meeting`);
      x.addEventListener('click', () => { zones = zones.filter((k) => k !== z); render(); });
      li.append(name, x);
      return li;
    }));
  }

  function render() {
    const p = S.prefs();
    const day = $('st-meet-date').value || UI.todayIn(p.zone);
    const step = Number($('st-meet-step').value) || 30;
    const people = zones.map((z) => W.normalize({ zone: z, days: p.days, start: p.start, end: p.end }, z));
    const home = p.zone;
    renderChips();
    const out = $('st-meet-out');
    out.replaceChildren();
    if (!zones.length) { $('st-meet-none').textContent = 'Add a zone to plan a meeting.'; $('st-meet-none').hidden = false; return; }
    const wins = W.dayWindows([{ zone: home, days: p.days, start: p.start, end: p.end }, ...people], home, day, step);
    $('st-meet-none').hidden = wins.length > 0;
    $('st-meet-none').textContent = `No hour on ${day} (in ${Z.cityOf(home)}) when everyone is inside working hours. Try another day, or remove a zone.`;
    for (const w of wins) {
      const li = document.createElement('li');
      const head = document.createElement('p');
      head.className = 'st-win-head';
      head.textContent = `${UI.windowLabel(home, w.start, w.end)} (your time)`;
      const each = document.createElement('p');
      each.className = 'st-win-each';
      each.textContent = zones.map((z) => `${Z.cityOf(z)} ${UI.hm(z, w.start)}–${UI.hm(z, w.end)}`).join(' · ');
      li.append(head, each);
      out.append(li);
    }
  }

  function addZone() {
    const z = $('st-meet-add').value.trim();
    if (!Z.isZone(z)) { $('st-meet-err').textContent = 'Choose a zone from the list, such as Asia/Tokyo.'; return; }
    $('st-meet-err').textContent = '';
    if (!zones.includes(z)) zones = [...zones, z];
    $('st-meet-add').value = '';
    render();
  }

  function init() {
    const p = S.prefs();
    zones = S.cities().filter((z) => z !== p.zone).slice(0, 4);
    $('st-meet-date').value = UI.todayIn(p.zone);
    $('st-meet-add-btn').addEventListener('click', addZone);
    $('st-meet-add').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addZone(); } });
    $('st-meet-cities').addEventListener('click', () => { zones = S.cities().filter((z) => z !== S.prefs().zone); render(); });
    for (const id of ['st-meet-date', 'st-meet-step']) $(id).addEventListener('input', render);
    render();
  }

  ns.meet = Object.freeze({ init, render });
})(typeof window !== 'undefined' ? window : globalThis);
