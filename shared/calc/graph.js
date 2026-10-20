/* Slopnodes engine: a graph of named formulas. A node has an id, a name and an expression. A name that another node's
 * expression uses is a wire from that node into this one. evaluate(nodes, opts) → { results, order, cycles }:
 *   results  Map id → { ok, value, text, error, needs: [names] }     a node with an error keeps the error, its dependents say why
 *   order    ids in the order they were worked out (a node after the nodes it needs)
 *   cycles   Set of ids that depend on themselves (directly or through others); they get a cycle error
 * Pure, classic script, after calc.js. Exposes window.SlopCalc.graph. */
(function (g) {
  'use strict';
  const ns = (g.SlopCalc = g.SlopCalc || {});
  const NAME = /^[a-z_][a-z0-9_]*$/;
  const cleanName = (s) => String(s == null ? '' : s).trim().toLowerCase();
  const RESERVED = ns.RESERVED_NAMES || [];

  /** The names a formula uses (lower case); a formula that does not tokenise uses none. */
  function namesIn(expr) {
    try { return ns.lexer.tokenize(String(expr || '')).filter((t) => t.type === 'word').map((t) => t.value.toLowerCase()); } catch (e) { return []; }
  }
  /** Why a name cannot be used for a node, or null when it can. */
  function nameProblem(name, others) {
    const n = cleanName(name);
    if (!n) return 'Give the node a name';
    if (!NAME.test(n)) return 'A name uses letters, digits and _, and starts with a letter';
    if (RESERVED.includes(n)) return '“' + n + '” is built in; pick another name';
    if (others && others.includes(n)) return 'Another node already has the name “' + n + '”';
    return null;
  }

  function evaluate(nodes, opts) {
    const o = opts || {};
    const byName = new Map(), dupes = new Set();
    for (const n of nodes) {
      const name = cleanName(n.name);
      if (!name) continue;
      if (byName.has(name)) dupes.add(n.id); else byName.set(name, n);
    }
    const needs = new Map(nodes.map((n) => [n.id, [...new Set(namesIn(n.expr).filter((x) => byName.has(x)))]]));

    // Order: depth-first from each node; meeting a node that is still open means a cycle.
    const state = new Map(), order = [], cycles = new Set();
    const visit = (node, path) => {
      const st = state.get(node.id);
      if (st === 2) return;
      if (st === 1) { for (let k = path.indexOf(node.id); k >= 0 && k < path.length; k++) cycles.add(path[k]); return; }
      state.set(node.id, 1);
      for (const name of needs.get(node.id)) visit(byName.get(name), path.concat(node.id));
      state.set(node.id, 2);
      order.push(node.id);
    };
    for (const n of nodes) visit(n, []);

    const results = new Map();
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const id of order) {
      const node = byId.get(id), used = needs.get(id);
      if (dupes.has(id)) { results.set(id, { ok: false, error: { code: 'name', message: 'Another node already has this name' }, needs: used }); continue; }
      if (cycles.has(id)) { results.set(id, { ok: false, error: { code: 'cycle', message: 'This formula depends on itself' }, needs: used }); continue; }
      const blocked = used.find((x) => !results.get(byName.get(x).id).ok);
      if (blocked) { results.set(id, { ok: false, error: { code: 'needs', message: 'Waiting on ' + blocked }, needs: used }); continue; }
      const scope = {};
      for (const x of used) scope[x] = results.get(byName.get(x).id).value;
      const st = ns.parseStatement(String(node.expr || '').trim() || '0');
      if (st.name) { results.set(id, { ok: false, error: { code: 'syntax', message: 'Give the name in the name box, not in the formula' }, needs: used }); continue; }
      const r = ns.calc(node.expr, { today: o.today, rate: o.rate, vars: scope });
      results.set(id, r.ok ? { ok: true, value: r.value, text: r.text, needs: used } : { ok: false, error: r.error, needs: used });
    }
    return { results, order, cycles };
  }

  ns.graph = { evaluate, namesIn, nameProblem, cleanName };
})(typeof window !== 'undefined' ? window : globalThis);
