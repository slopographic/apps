/* Slopculator units: which words are units, what dimension each belongs to, and how to convert.
 * Classic script, no dependencies. Exposes window.SlopCalc.units:
 *   lookup(word)            → { dim, unit, label } for a unit word (case-insensitive), or null
 *   isCurrency(code)        → true for an ISO 4217 code known to the browser
 *   toBase(dim, unit, v)    → v in the base unit of the dimension (m, kg, L, min, days)
 *   convertFactor(dim, from, to) → multiply by this to go from one unit to another (same dimension, not temperature)
 *   convertTemp(v, from, to)     → temperature conversion between 'c', 'f', 'k'
 *   CALENDAR_DAYS           → days in a month and a year on average, used to compare calendar units
 * Base units: length m, mass kg, volume L, time min, calendar days. Currency is not in the table: it is converted
 * with a rate the caller supplies (see evaluate.js). Temperature converts with its own formulas (it is affine). */
(function (g) {
  'use strict';
  const ns = (g.SlopCalc = g.SlopCalc || {});
  const CALENDAR_DAYS = Object.freeze({ days: 1, weeks: 7, months: 30.436875, years: 365.2425 });

  // [dim, canonical unit, factor to base, display label, aliases…]
  const ROWS = [
    ['length', 'mm', 0.001, 'mm', 'millimetre', 'millimetres', 'millimeter', 'millimeters'],
    ['length', 'cm', 0.01, 'cm', 'centimetre', 'centimetres', 'centimeter', 'centimeters'],
    ['length', 'm', 1, 'm', 'metre', 'metres', 'meter', 'meters'],
    ['length', 'km', 1000, 'km', 'kilometre', 'kilometres', 'kilometer', 'kilometers'],
    ['length', 'in', 0.0254, 'in', 'inch', 'inches'],
    ['length', 'ft', 0.3048, 'ft', 'foot', 'feet'],
    ['length', 'yd', 0.9144, 'yd', 'yard', 'yards'],
    ['length', 'mi', 1609.344, 'mi', 'mile', 'miles'],
    ['mass', 'mg', 1e-6, 'mg', 'milligram', 'milligrams'],
    ['mass', 'g', 0.001, 'g', 'gram', 'grams', 'gramme', 'grammes'],
    ['mass', 'kg', 1, 'kg', 'kilo', 'kilos', 'kilogram', 'kilograms'],
    ['mass', 't', 1000, 't', 'tonne', 'tonnes'],
    ['mass', 'oz', 0.028349523125, 'oz', 'ounce', 'ounces'],
    ['mass', 'lb', 0.45359237, 'lb', 'lbs', 'pound', 'pounds'],
    ['volume', 'ml', 0.001, 'ml', 'millilitre', 'millilitres', 'milliliter', 'milliliters'],
    ['volume', 'cl', 0.01, 'cl', 'centilitre', 'centiliter'],
    ['volume', 'L', 1, 'L', 'l', 'litre', 'litres', 'liter', 'liters'],
    ['volume', 'tsp', 0.00492892159375, 'tsp', 'teaspoon', 'teaspoons'],
    ['volume', 'tbsp', 0.01478676478125, 'tbsp', 'tablespoon', 'tablespoons'],
    ['volume', 'cup', 0.2365882365, 'cup', 'cups'],
    ['volume', 'floz', 0.0295735295625, 'fl oz', 'fluidounce', 'fluidounces'],
    ['volume', 'pt', 0.473176473, 'pt', 'pint', 'pints'],
    ['volume', 'qt', 0.946352946, 'qt', 'quart', 'quarts'],
    ['volume', 'gal', 3.785411784, 'gal', 'gallon', 'gallons'],
    ['time', 'min', 1, 'min', 'mins', 'minute', 'minutes'],
    ['time', 'h', 60, 'h', 'hr', 'hrs', 'hour', 'hours'],
    ['calendar', 'days', 1, 'days', 'day'],
    ['calendar', 'weeks', 7, 'weeks', 'week'],
    ['calendar', 'months', CALENDAR_DAYS.months, 'months', 'month'],
    ['calendar', 'years', CALENDAR_DAYS.years, 'years', 'year'],
    ['temp', 'c', 1, '°C', 'celsius'],
    ['temp', 'f', 1, '°F', 'fahrenheit'],
    ['temp', 'k', 1, 'K', 'kelvin'],
  ];
  const BY_NAME = new Map();
  const FACTOR = new Map(); // dim|unit → factor
  for (const [dim, unit, f, label, ...names] of ROWS) {
    const entry = Object.freeze({ dim, unit, label });
    for (const n of [unit, ...names]) BY_NAME.set(n.toLowerCase(), entry);
    FACTOR.set(dim + '|' + unit, f);
  }

  // ISO currency codes. Intl knows the list in every browser and in Node 18+; a short list is the fallback.
  const FALLBACK_CODES = 'USD EUR GBP JPY CHF CAD AUD NZD SEK NOK DKK PLN CZK HUF RON BGN HRK ISK TRY CNY HKD SGD KRW INR BRL MXN ZAR AED SAR ILS THB'.split(' ');
  let codes = null;
  function currencyCodes() {
    if (codes) return codes;
    let list = [];
    try { list = Intl.supportedValuesOf ? Intl.supportedValuesOf('currency') : []; } catch (e) { list = []; }
    codes = new Set((list.length ? list : FALLBACK_CODES).map((c) => c.toUpperCase()));
    return codes;
  }

  /** The unit a word stands for. Table words win over currency codes, so 'm' is metres, never a currency. */
  function lookup(word) {
    const w = String(word || '').toLowerCase();
    if (!w) return null;
    const hit = BY_NAME.get(w);
    if (hit) return hit;
    if (/^[a-z]{3}$/.test(w) && currencyCodes().has(w.toUpperCase())) return { dim: 'currency', unit: w.toUpperCase(), label: w.toUpperCase() };
    return null;
  }
  const isCurrency = (code) => currencyCodes().has(String(code || '').toUpperCase());

  function factorOf(dim, unit) {
    const f = FACTOR.get(dim + '|' + unit);
    if (f === undefined) throw new Error(`no factor for ${dim} ${unit}`);
    return f;
  }
  const toBase = (dim, unit, v) => v * factorOf(dim, unit);
  const convertFactor = (dim, from, to) => factorOf(dim, from) / factorOf(dim, to);

  /** Celsius, Fahrenheit and Kelvin. Kelvin is the pivot. */
  function convertTemp(v, from, to) {
    const toK = (x, u) => (u === 'c' ? x + 273.15 : u === 'f' ? ((x - 32) * 5) / 9 + 273.15 : x);
    const fromK = (k, u) => (u === 'c' ? k - 273.15 : u === 'f' ? ((k - 273.15) * 9) / 5 + 32 : k);
    return fromK(toK(v, from), to);
  }

  ns.units = Object.freeze({ lookup, isCurrency, currencyCodes, toBase, convertFactor, convertTemp, CALENDAR_DAYS });
})(typeof window !== 'undefined' ? window : globalThis);
