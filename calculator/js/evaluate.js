/* Slopculator evaluator: syntax tree → value. Pure, classic script (after parser.js). Exposes window.SlopCalc.evaluate.
 * Values: { t:'n', v } number · { t:'q', dim, unit, v } quantity (dim: length, mass, volume, time, calendar, temp,
 * currency) · { t:'d', iso } date · { t:'tod', min } time of day · { t:'pct', v } a fraction from 20%.
 * ctx: { today: 'YYYY-MM-DD', ans: value|null, rate(from, to) → factor or undefined }. A currency conversion with no
 * rate throws CalcError code 'rate' with from and to, so the page can fetch the rate and run it again. */
(function (g) {
  'use strict';
  const ns = (g.SlopCalc = g.SlopCalc || {});
  const CalcError = ns.CalcError;
  const { units, dates } = ns;
  const N = (v) => ({ t: 'n', v });
  const Q = (dim, unit, v) => ({ t: 'q', dim, unit, v });
  const fail = (msg, pos, code = 'type', extra) => new CalcError(msg, pos || 0, code, extra);
  const DIM_NAME = { length: 'length', mass: 'mass', volume: 'volume', time: 'time', calendar: 'calendar days', temp: 'temperature', currency: 'currency' };
  const wrapDay = (m) => ((m % 1440) + 1440) % 1440;
  const TEMP_MSG = 'Temperatures can only be converted, with in (for example 100 C in F)';

  function plain(v) { return v.t === 'pct' ? N(v.v) : v; }

  function rateFactor(from, to, ctx, pos) {
    if (from === to) return 1;
    const f = ctx.rate ? ctx.rate(from, to) : undefined;
    if (typeof f !== 'number' || !(f > 0)) throw fail(`No exchange rate for ${from} to ${to}`, pos, 'rate', { from, to });
    return f;
  }

  /** A quantity in another unit of the same dimension (currency uses the rate). */
  function convertTo(q, target, ctx, pos) {
    if (q.unit === target.unit) return q;
    if (q.dim !== target.dim) throw fail(`Cannot convert ${DIM_NAME[q.dim]} to ${DIM_NAME[target.dim]}`, pos, 'unit');
    if (q.dim === 'temp') return Q('temp', target.unit, units.convertTemp(q.v, q.unit, target.unit));
    if (q.dim === 'currency') return Q('currency', target.unit, q.v * rateFactor(q.unit, target.unit, ctx, pos));
    return Q(q.dim, target.unit, q.v * units.convertFactor(q.dim, q.unit, target.unit));
  }

  function scale(v, f, pos) {
    if (v.t === 'n') return N(v.v * f);
    if (v.t === 'q') return Q(v.dim, v.unit, v.v * f);
    throw fail('Only a number or a quantity can be scaled by a percentage', pos);
  }

  function numOp(op, a, b, pos) {
    let r;
    if (op === '+') r = a + b;
    else if (op === '-') r = a - b;
    else if (op === '*') r = a * b;
    else if (op === '/') { if (b === 0) throw fail('Division by zero', pos, 'math'); r = a / b; }
    else r = Math.pow(a, b);
    if (!Number.isFinite(r)) throw fail('The result is not a real number', pos, 'math');
    return r;
  }

  function quantityNumber(op, q, n, pos, swapped) {
    if (q.dim === 'temp') throw fail(TEMP_MSG, pos, 'type');
    if (op === '*') return Q(q.dim, q.unit, q.v * n.v);
    if (op === '/' && !swapped) { if (n.v === 0) throw fail('Division by zero', pos, 'math'); return Q(q.dim, q.unit, q.v / n.v); }
    throw fail(`Cannot ${op === '^' ? 'raise a quantity to a power' : 'combine a number and ' + DIM_NAME[q.dim] + ' like this'}`, pos);
  }

  function quantityQuantity(op, a, b, ctx, pos) {
    if (a.dim === 'temp' || b.dim === 'temp') throw fail(TEMP_MSG, pos);
    if (op === '+' || op === '-') {
      if (a.dim !== b.dim) throw fail(`Cannot ${op === '+' ? 'add' : 'subtract'} ${DIM_NAME[b.dim]} and ${DIM_NAME[a.dim]}`, pos, 'unit');
      const bb = convertTo(b, { dim: a.dim, unit: a.unit }, ctx, pos);
      return Q(a.dim, a.unit, op === '+' ? a.v + bb.v : a.v - bb.v);
    }
    if (op === '/' && a.dim === b.dim) {
      const bb = convertTo(b, { dim: a.dim, unit: a.unit }, ctx, pos);
      if (bb.v === 0) throw fail('Division by zero', pos, 'math');
      return N(a.v / bb.v);
    }
    throw fail(`Cannot use “${op}” on two quantities here`, pos);
  }

  /** Date ± calendar span. Months and years move by calendar months; days and weeks by whole days. */
  function addSpan(iso, sign, q, pos) {
    if (q.unit === 'days' || q.unit === 'weeks') {
      const days = sign * q.v * (q.unit === 'weeks' ? 7 : 1);
      if (!Number.isInteger(days)) throw fail('Use a whole number of days', pos, 'math');
      return { t: 'd', iso: dates.addDays(iso, days) };
    }
    const months = sign * q.v * (q.unit === 'years' ? 12 : 1);
    if (!Number.isInteger(months)) throw fail('Use a whole number of months or years', pos, 'math');
    return { t: 'd', iso: dates.addMonths(iso, months) };
  }

  function dateOp(op, a, b, pos) {
    if (a.t === 'd' && b.t === 'q' && b.dim === 'calendar' && (op === '+' || op === '-')) return addSpan(a.iso, op === '+' ? 1 : -1, b, pos);
    if (a.t === 'q' && b.t === 'd' && a.dim === 'calendar' && op === '+') return addSpan(b.iso, 1, a, pos);
    if (a.t === 'd' && b.t === 'd' && op === '-') return Q('calendar', 'days', dates.diffDays(a.iso, b.iso));
    if (a.t === 'd' && b.t === 'n') throw fail('Add a span such as 2 weeks, 3 months or 90 days', pos);
    throw fail('A date can only be moved by days, weeks, months or years, or two dates subtracted', pos);
  }

  function timeOp(op, a, b, pos) {
    const minutesOf = (x) => (x.t === 'tod' ? x.min : units.toBase('time', x.unit, x.v));
    if (a.t === 'tod' && b.t === 'q' && b.dim === 'time' && (op === '+' || op === '-')) {
      return { t: 'tod', min: wrapDay(a.min + (op === '+' ? 1 : -1) * minutesOf(b)) };
    }
    if (a.t === 'q' && a.dim === 'time' && b.t === 'tod' && op === '+') return { t: 'tod', min: wrapDay(b.min + minutesOf(a)) };
    if (a.t === 'tod' && b.t === 'tod' && op === '-') return Q('time', 'min', a.min - b.min);
    throw fail('A time of day can only move by a duration such as 2 h 45 min, or two times subtracted', pos);
  }

  function arith(op, A0, B0, ctx, pos) {
    if (op === 'of') {
      if (A0.t !== 'pct') throw fail('“of” needs a percentage on the left, such as 20% of 150', pos, 'syntax');
      return scale(plain(B0), A0.v, pos);
    }
    if (B0.t === 'pct' && (op === '+' || op === '-') && (A0.t === 'n' || A0.t === 'q')) {
      const amount = scale(A0, B0.v, pos);
      return op === '+' ? arith('+', A0, amount, ctx, pos) : arith('-', A0, amount, ctx, pos);
    }
    const A = plain(A0), B = plain(B0);
    if (A.t === 'n' && B.t === 'n') return N(numOp(op, A.v, B.v, pos));
    if (A.t === 'q' && B.t === 'n') return quantityNumber(op, A, B, pos, false);
    if (A.t === 'n' && B.t === 'q') {
      if (op === '*') return quantityNumber('*', B, A, pos, true);
      throw fail(`Cannot ${op === '/' ? 'divide a number by' : 'combine a number and'} ${DIM_NAME[B.dim]} like this`, pos);
    }
    if (A.t === 'q' && B.t === 'q') return quantityQuantity(op, A, B, ctx, pos);
    if (A.t === 'd' || B.t === 'd') return dateOp(op, A, B, pos);
    if (A.t === 'tod' || B.t === 'tod') return timeOp(op, A, B, pos);
    throw fail('These values cannot be combined', pos);
  }

  function convNode(node, ctx) {
    const x = plain(evaluate(node.x, ctx));
    if (x.t !== 'q') throw fail('Only a quantity can be converted. Put a unit after the number, such as 5 km in m', node.pos, 'unit');
    return convertTo(x, node.to, ctx, node.pos);
  }

  function rateOf(argNode, val, pos) {
    if (val.t === 'pct') return val.v;
    const p = plain(val);
    if (p.t !== 'n') throw fail('A rate must be a number, such as 8 or 8%', pos);
    return p.v / 100;
  }

  function callFn(node, ctx) {
    const args = node.args.map((a) => evaluate(a, ctx));
    const num = (i) => {
      const p = plain(args[i]);
      if (p.t !== 'n') throw fail(`${node.fn} needs a number`, node.pos);
      return p.v;
    };
    switch (node.fn) {
      case 'sqrt': if (num(0) < 0) throw fail('Square root of a negative number', node.pos, 'math'); return N(Math.sqrt(num(0)));
      case 'cbrt': return N(Math.cbrt(num(0)));
      case 'abs': return args[0].t === 'q' ? Q(args[0].dim, args[0].unit, Math.abs(args[0].v)) : N(Math.abs(num(0)));
      case 'tax': return scale(args[0], 1 + rateOf(node.args[1], args[1], node.pos), node.pos);
      case 'markup': return scale(args[0], 1 + rateOf(node.args[1], args[1], node.pos), node.pos);
      case 'discount': return scale(args[0], 1 - rateOf(node.args[1], args[1], node.pos), node.pos);
      default: throw fail(`Unknown function ${node.fn}`, node.pos);
    }
  }

  function constant(node, ctx) {
    if (node.name === 'pi') return N(Math.PI);
    if (node.name === 'e') return N(Math.E);
    if (!ctx.ans) throw fail('There is no previous result yet', node.pos, 'syntax');
    return ctx.ans;
  }

  function evaluate(node, ctx) {
    switch (node.type) {
      case 'num': return N(node.v);
      case 'qty': return Q(node.dim, node.unit, node.v);
      case 'pct': return { t: 'pct', v: plain(evaluate(node.x, ctx)).v / 100 };
      case 'date': return { t: 'd', iso: node.iso };
      case 'today': return { t: 'd', iso: ctx.today };
      case 'tod': return { t: 'tod', min: node.min };
      case 'const': return constant(node, ctx);
      case 'neg': {
        const x = evaluate(node.x, ctx);
        if (x.t === 'n' || x.t === 'pct') return { t: x.t, v: -x.v };
        if (x.t === 'q') return Q(x.dim, x.unit, -x.v);
        throw fail('Cannot negate this value', node.pos);
      }
      case 'conv': return convNode(node, ctx);
      case 'call': return callFn(node, ctx);
      case 'bin': return arith(node.op, evaluate(node.a, ctx), evaluate(node.b, ctx), ctx, node.pos);
      default: throw fail('Unknown expression', node.pos, 'syntax');
    }
  }

  ns.evaluate = (tree, ctx) => evaluate(tree, Object.assign({ today: dates.localIso(), ans: null, rate: null }, ctx || {}));
  ns.plain = plain;
})(typeof window !== 'undefined' ? window : globalThis);
