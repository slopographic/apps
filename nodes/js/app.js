/* Slopnodes: a node calculator. A node is a name and a formula. A name that another node's formula uses is a wire from
 * that node: change a value and every node downstream updates while you type. The engine is shared/calc (graph.js);
 * the boxes are drawn by graph-view.js. Classic script. The graph is kept on this device (SlopCalcKeep). */
(function () {
  'use strict';
  const C = window.SlopCalc, G = C.graph, K = window.SlopCalcKeep, R = window.SlopCalcRates, V = window.SlopNodesView;
  const $ = (id) => document.getElementById(id);
  const KEY = 'slopnodes.graph', SAVE_MS = 300;
  const SAMPLE = [
    { id: 'a', name: 'price', expr: '19.99 USD', x: 40, y: 60 },
    { id: 'b', name: 'qty', expr: '3', x: 40, y: 220 },
    { id: 'c', name: 'subtotal', expr: 'price * qty', x: 330, y: 140 },
    { id: 'd', name: 'total', expr: 'tax(subtotal, 8)', x: 610, y: 140 },
    { id: 'e', name: 'vat', expr: 'total - subtotal', x: 610, y: 320 },
  ];
  const S = { nodes: [], res: new Map(), cycles: new Set(), timer: 0, seq: 0 };

  const status = (msg) => { $('sn-status').textContent = msg; };
  const today = () => C.dates.localIso();
  const uid = () => 'n' + Math.random().toString(36).slice(2, 9);
  const others = (id) => S.nodes.filter((n) => n.id !== id).map((n) => G.cleanName(n.name));

  /** Works out every node's result and the wires, then paints them. */
  function compute() {
    const r = G.evaluate(S.nodes, { today: today(), rate: R.factor });
    S.res = r.results; S.cycles = r.cycles;
    const edges = [];
    for (const n of S.nodes) {
      for (const name of G.namesIn(n.expr)) {
        const src = S.nodes.find((m) => G.cleanName(m.name) === name);
        if (src) edges.push({ from: src.id, to: n.id, bad: r.cycles.has(n.id) && r.cycles.has(src.id) });
      }
    }
    V.paint(S.nodes, S.res, S.cycles);
    V.wires(S.nodes, edges);
    const total = S.nodes.length, bad = S.cycles.size, errs = [...S.res.values()].filter((x) => !x.ok).length - bad;
    $('sn-count').textContent = total + (total === 1 ? ' node' : ' nodes') + (bad ? ' · ' + bad + ' in a cycle' : '') + (errs > 0 ? ' · ' + errs + ' with errors' : '');
  }
  function save() {
    clearTimeout(S.timer);
    S.timer = setTimeout(() => K.write(KEY, { nodes: S.nodes.map((n) => ({ id: n.id, name: n.name, expr: n.expr, x: n.x, y: n.y })) }), SAVE_MS);
  }
  function refresh(full) {
    if (full) V.sync(S.nodes);
    compute();
    save();
  }

  const handlers = {
    /** The formula changed: recompute everything at once; the box keeps its focus. */
    formula(id, text) {
      const n = S.nodes.find((m) => m.id === id);
      if (n) { n.expr = text; refresh(false); }
    },
    /** A name typed: kept only when it is a valid, unused name. A bad one is shown and not kept. */
    renameLive(id, text) {
      const n = S.nodes.find((m) => m.id === id);
      const problem = G.nameProblem(text, others(id));
      status(problem ? problem : 'Name set.');
      if (!problem && n) { n.name = G.cleanName(text); refresh(false); }
    },
    rename(id, text, revert) {
      const n = S.nodes.find((m) => m.id === id);
      if (G.nameProblem(text, others(id))) { revert(); return; }
      if (n) { n.name = G.cleanName(text); refresh(true); }
    },
    async remove(id) {
      const n = S.nodes.find((m) => m.id === id);
      if (!n) return;
      const used = S.nodes.some((m) => m.id !== id && G.namesIn(m.expr).includes(G.cleanName(n.name)));
      const ok = await SlopUI.confirm('Delete ' + n.name, used ? 'Other formulas use “' + n.name + '”. They will show an error until you change them.' : 'Remove this node?', 'Delete', { danger: true });
      if (!ok) return;
      S.nodes = S.nodes.filter((m) => m.id !== id);
      refresh(true);
      status('Deleted ' + n.name + '.');
    },
    moving() { V.wires(S.nodes, edgesNow()); },
    moved() { save(); },
  };

  function edgesNow() {
    const edges = [];
    for (const n of S.nodes) for (const name of G.namesIn(n.expr)) {
      const src = S.nodes.find((m) => G.cleanName(m.name) === name);
      if (src) edges.push({ from: src.id, to: n.id, bad: S.cycles.has(n.id) && S.cycles.has(src.id) });
    }
    return edges;
  }

  function add() {
    let k = S.nodes.length + 1, name = 'value' + k;
    while (G.nameProblem(name, others(null))) { k++; name = 'value' + k; }
    const at = { x: 40 + ((S.nodes.length * 60) % 600), y: 40 + ((S.nodes.length * 80) % 480) };
    const n = { id: uid(), name, expr: '0', x: at.x, y: at.y };
    S.nodes.push(n);
    refresh(true);
    const box = V.node(n.id);
    if (box) box._expr.focus();
    status('Added ' + name + '. Type a value or a formula.');
  }

  async function clearAll() {
    if (!S.nodes.length) return;
    const ok = await SlopUI.confirm('Clear the graph', 'Delete all ' + S.nodes.length + ' nodes? This cannot be undone.', 'Clear', { danger: true });
    if (!ok) return;
    S.nodes = []; refresh(true); status('Graph cleared.');
  }
  function sample() {
    S.nodes = SAMPLE.map((n) => Object.assign({}, n, { id: uid() }));
    refresh(true);
  }

  function boot() {
    V.mount($('sn-canvas'), handlers);
    const saved = K.read(KEY, null);
    S.nodes = saved && Array.isArray(saved.nodes) && saved.nodes.length ? saved.nodes : SAMPLE.map((n) => Object.assign({}, n, { id: uid() }));
    $('sn-add').addEventListener('click', add);
    $('sn-clear').addEventListener('click', clearAll);
    $('sn-sample').addEventListener('click', async () => {
      const ok = await SlopUI.confirm('Load the example', 'Replace the graph with the example? The current nodes are removed.', 'Load', { danger: true });
      if (ok) sample();
    });
    refresh(true);
    status(S.nodes.length ? 'Change a formula: every node that uses it updates.' : 'Add a node to start.');
  }
  document.addEventListener('DOMContentLoaded', boot);
  window.SlopNodesApp = { compute: () => compute(), nodes: () => S.nodes.slice() };
})();
