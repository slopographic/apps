/* Slop Time: a MANUAL clock offset. This is not a network sync: the app makes no network calls. The person types the
 * time from a source they trust, and the app records how far this device's clock was from it at that moment.
 * Pure, classic script (after zones.js). Exposes window.SlopTime.sync:
 *   referenceMs(zone, iso, clockText) → the instant typed (clockText is HH:MM or HH:MM:SS), or null
 *   offsetFor(referenceMs, deviceMs)  → reference − device, in ms (positive: the device clock is behind)
 *   correctedNow(offsetMs, deviceMs)  → the device time moved by the offset
 *   describe(offsetMs)                → 'The device clock was 2.4 s behind the reference you entered.' */
(function (g) {
  'use strict';
  const ns = (g.SlopTime = g.SlopTime || {});
  const Z = ns.zones, C = ns.convert;

  function referenceMs(zone, iso, clockText) {
    const day = C.parseIsoDate(iso), clock = C.parseClock(clockText);
    if (!day || !clock || !Z.isZone(zone)) return null;
    const [y, mo, d] = day.split('-').map(Number);
    return Z.zonedToUtc(zone, y, mo, d, clock.h, clock.mi, clock.s || 0);
  }
  const offsetFor = (referenceMs, deviceMs) => referenceMs - deviceMs;
  const correctedNow = (offsetMs, deviceMs = Date.now()) => deviceMs + (Number(offsetMs) || 0);

  function describe(offsetMs) {
    const abs = Math.abs(offsetMs) / 1000;
    if (abs < 0.05) return 'The device clock matched the reference you entered, to within a tenth of a second.';
    const amount = abs < 60 ? `${abs.toFixed(1)} s` : `${Math.floor(abs / 60)} min ${Math.round(abs % 60)} s`;
    return `The device clock was ${amount} ${offsetMs > 0 ? 'behind' : 'ahead of'} the reference you entered.`;
  }

  ns.sync = Object.freeze({ referenceMs, offsetFor, correctedNow, describe });
})(typeof window !== 'undefined' ? window : globalThis);
