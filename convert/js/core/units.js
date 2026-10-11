/* Unit conversion with exact rational arithmetic (BigInt), so decimal inputs such as 1.5 mi or 0.1 kg
 * give exact decimal answers whenever the answer terminates. Non-terminating results are rounded to
 * 12 decimal places and flagged approximate. Temperatures are affine and go through kelvin. Pure. */

const gcd = (a, b) => { if (a < 0n) a = -a; if (b < 0n) b = -b; while (b) [a, b] = [b, a % b]; return a; };
const norm = (n, d) => {
  if (d === 0n) throw new RangeError('Division by zero');
  if (d < 0n) { n = -n; d = -d; }
  const g = gcd(n, d) || 1n;
  return { n: n / g, d: d / g };
};
const add = (a, b) => norm(a.n * b.d + b.n * a.d, a.d * b.d);
const neg = (a) => ({ n: -a.n, d: a.d });
const mul = (a, b) => norm(a.n * b.n, a.d * b.d);
const div = (a, b) => norm(a.n * b.d, a.d * b.n);

/** Parse a decimal string ("12", "-0.5", "1e3", "2.50") into an exact rational. Throws on anything else. */
export function parseDecimal(text) {
  const m = /^\s*([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d{1,3}))?\s*$/.exec(String(text));
  if (!m || (!m[2] && !m[3])) throw new Error(`“${text}” is not a number.`);
  const frac = m[3] || '';
  let n = BigInt((m[2] || '0') + frac);
  let d = 10n ** BigInt(frac.length);
  const e = m[4] ? Number(m[4]) : 0;
  if (e >= 0) n *= 10n ** BigInt(e); else d *= 10n ** BigInt(-e);
  if (m[1] === '-') n = -n;
  return norm(n, d);
}

/** Exact decimal string of a rational. Terminating values are exact; others are rounded to `places`. */
export function formatDecimal(r, places = 12) {
  const exactLimit = 60;
  const a = r.n < 0n ? -r.n : r.n;
  const sign = r.n < 0n && a !== 0n ? '-' : '';
  const scale = (p) => {
    const q = 10n ** BigInt(p);
    return (2n * a * q + r.d) / (2n * r.d); // round half up
  };
  const exact = (a * 10n ** BigInt(exactLimit)) % r.d === 0n;
  const P = exact ? exactLimit : places;
  const digits = scale(P).toString().padStart(P + 1, '0');
  const ip = digits.slice(0, digits.length - P), fp = digits.slice(digits.length - P).replace(/0+$/, '');
  return { text: sign + ip + (fp ? '.' + fp : ''), exact };
}

const LINEAR = {
  length: { base: 'm', label: 'Length', units: [
    ['mm', 'Millimetres', '0.001'], ['cm', 'Centimetres', '0.01'], ['m', 'Metres', '1'], ['km', 'Kilometres', '1000'],
    ['in', 'Inches', '0.0254'], ['ft', 'Feet', '0.3048'], ['yd', 'Yards', '0.9144'], ['mi', 'Miles', '1609.344'], ['nmi', 'Nautical miles', '1852'],
  ] },
  weight: { base: 'g', label: 'Weight', units: [
    ['mg', 'Milligrams', '0.001'], ['g', 'Grams', '1'], ['kg', 'Kilograms', '1000'], ['t', 'Metric tonnes', '1000000'],
    ['oz', 'Ounces', '28.349523125'], ['lb', 'Pounds', '453.59237'], ['st', 'Stone', '6350.29318'], ['ton', 'US short tons', '907184.74'],
  ] },
  time: { base: 's', label: 'Time', units: [
    ['ms', 'Milliseconds', '0.001'], ['s', 'Seconds', '1'], ['min', 'Minutes', '60'], ['h', 'Hours', '3600'], ['d', 'Days', '86400'], ['wk', 'Weeks', '604800'],
  ] },
  data: { base: 'B', label: 'Data size', units: [
    ['B', 'Bytes', '1'], ['KB', 'Kilobytes (1000)', '1000'], ['MB', 'Megabytes (1000²)', '1000000'], ['GB', 'Gigabytes (1000³)', '1000000000'],
    ['TB', 'Terabytes (1000⁴)', '1000000000000'], ['PB', 'Petabytes (1000⁵)', '1000000000000000'],
    ['KiB', 'Kibibytes (1024)', '1024'], ['MiB', 'Mebibytes (1024²)', '1048576'], ['GiB', 'Gibibytes (1024³)', '1073741824'], ['TiB', 'Tebibytes (1024⁴)', '1099511627776'],
  ] },
};
const KELVIN_OFFSET = { n: 27315n, d: 100n };        // 273.15
const TEMP = {
  label: 'Temperature',
  units: [
    ['K', 'Kelvin', (v) => v, (k) => k],
    ['C', 'Celsius', (v) => add(v, KELVIN_OFFSET), (k) => add(k, neg(KELVIN_OFFSET))],
    ['F', 'Fahrenheit', (v) => mul(add(v, { n: 45967n, d: 100n }), { n: 5n, d: 9n }), (k) => add(mul(k, { n: 9n, d: 5n }), neg({ n: 45967n, d: 100n }))],
  ],
};

/** Category list for the UI: [{ key, label, units: [{ key, label }] }]. */
export function categories() {
  const out = Object.entries(LINEAR).map(([key, c]) => ({ key, label: c.label, units: c.units.map(([k, l]) => ({ key: k, label: l })) }));
  out.push({ key: 'temperature', label: TEMP.label, units: TEMP.units.map(([k, l]) => ({ key: k, label: l })) });
  return out;
}

/**
 * Convert value (decimal text) between two units of one category.
 * Returns { text, exact, value } where text is the decimal answer.
 */
export function convert(category, from, to, value) {
  const v = parseDecimal(value);
  let r;
  if (category === 'temperature') {
    const f = TEMP.units.find((u) => u[0] === from), t = TEMP.units.find((u) => u[0] === to);
    if (!f || !t) throw new Error('Unknown temperature unit.');
    r = t[3](f[2](v));
  } else {
    const c = LINEAR[category];
    if (!c) throw new Error('Unknown category.');
    const f = c.units.find((u) => u[0] === from), t = c.units.find((u) => u[0] === to);
    if (!f || !t) throw new Error('Unknown unit.');
    r = div(mul(v, parseDecimal(f[2])), parseDecimal(t[2]));
  }
  return { ...formatDecimal(r), value: r };
}
