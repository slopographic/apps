/* Slop Time world clock: one card per city (local time, day, working day, working hours), a search to add a city or
 * zone from the browser's own zone list, and remove. Classic script (after state.js, ui.js). Exposes window.SlopTime.world:
 * render() is called on every tick and only updates the text; the cards are rebuilt when the list changes. */
(function (g) {
  'use strict';
  const ns = (g.SlopTime = g.SlopTime || {});
  const Z = ns.zones, S = ns.state, UI = ns.ui, $ = UI.$;
  let signature = null;
  const cards = new Map();

  function makeCard(zone) {
    const li = document.createElement('li');
    li.className = 'st-card';
    li.dataset.zone = zone;
    const head = document.createElement('div');
    head.className = 'st-card-head';
    const name = document.createElement('h3');
    name.textContent = Z.cityOf(zone);
    const id = document.createElement('span');
    id.className = 'st-zone';
    id.textContent = zone;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'st-btn st-small';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove ${Z.cityOf(zone)}`);
    remove.addEventListener('click', () => { S.setCities(S.cities().filter((z) => z !== zone)); signature = null; render(); });
    head.append(name, remove);
    const time = document.createElement('p');
    time.className = 'st-time';
    time.innerHTML = '<span class="st-hm"></span><span class="st-sec"></span>';
    const day = document.createElement('p');
    day.className = 'st-day';
    const badges = document.createElement('p');
    badges.className = 'st-badges';
    li.append(head, id, time, day, badges);
    cards.set(zone, li);
    return li;
  }

  function updateCard(zone, t, prefs) {
    const li = cards.get(zone);
    const p = Z.localParts(zone, t);
    li.querySelector('.st-hm').textContent = `${UI.pad(p.h)}:${UI.pad(p.mi)}`;
    li.querySelector('.st-sec').textContent = `:${UI.pad(p.s)}`;
    li.querySelector('.st-day').textContent = UI.dayLabel(zone, t) + ' · ' + Z.gmtLabel(Z.offsetMinutes(zone, t));
    const workDay = prefs.days.includes(p.wd);
    const minutes = p.h * 60 + p.mi;
    const inHours = workDay && minutes >= prefs.start * 60 && minutes < prefs.end * 60;
    const badges = li.querySelector('.st-badges');
    badges.replaceChildren();
    const add = (text, cls) => { const s = document.createElement('span'); s.className = 'st-badge ' + cls; s.textContent = text; badges.append(s); };
    add(workDay ? 'Working day' : 'Not a working day', workDay ? 'st-ok' : 'st-off');
    if (inHours) add('In working hours', 'st-ok');
  }

  function rebuild(zones) {
    cards.clear();
    const list = $('st-cities');
    list.replaceChildren(...zones.map(makeCard));
    $('st-world-empty').hidden = zones.length > 0;
  }

  function render() {
    const zones = S.cities();
    const key = zones.join('|');
    if (key !== signature) { signature = key; rebuild(zones); }
    const t = S.nowMs(), prefs = S.prefs();
    for (const z of zones) updateCard(z, t, prefs);
    const off = S.offset();
    $('st-world-note').textContent = off
      ? 'Times are your device clock moved by a manual offset you typed. This is not a network sync. See Sync.'
      : `Times are from this device's clock and the browser's zone rules. Your time zone: ${S.device()}.`;
  }

  function addZone(zone) {
    const zones = S.cities();
    if (!zones.includes(zone)) S.setCities([...zones, zone]);
    signature = null;
    $('st-add').value = '';
    $('st-add-results').replaceChildren();
    render();
  }

  function showResults() {
    const q = $('st-add').value.trim();
    const list = $('st-add-results');
    if (!q) { list.replaceChildren(); return; }
    const t = S.nowMs();
    const hits = Z.search(Z.list(), q, 12);
    list.replaceChildren(...hits.map((zone) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'st-result';
      b.textContent = `${Z.cityOf(zone)} · ${zone} · ${UI.hm(zone, t)} ${Z.gmtLabel(Z.offsetMinutes(zone, t))}`;
      b.addEventListener('click', () => addZone(zone));
      li.append(b);
      return li;
    }));
    if (!hits.length) { const li = document.createElement('li'); li.className = 'st-note'; li.textContent = 'No zone matches. Try a city name such as Lisbon or Sydney.'; list.append(li); }
  }

  function init() {
    $('st-add').addEventListener('input', showResults);
    $('st-add').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const first = $('st-add-results').querySelector('button');
      if (first) first.click();
    });
    render();
  }

  ns.world = Object.freeze({ init, render, addZone, showResults });
})(typeof window !== 'undefined' ? window : globalThis);
