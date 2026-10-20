/* Slopnodes drawing: the node boxes, their wires and dragging. Pure DOM, no engine here (the page computes; this paints).
 * Classic script. Exposes window.SlopNodesView = { mount, sync, paint, wires, node }.
 * A node box is positioned by its x, y (its top-left corner, in canvas pixels). */
(function () {
  'use strict';
  const NODE_W = 220, HEAD = 30;
  const NS = 'http://www.w3.org/2000/svg';
  let canvas = null, svg = null, boxes = new Map(), handlers = {};

  function mount(root, h) {
    canvas = root;
    handlers = h || {};
    svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'sn-wires');
    svg.setAttribute('aria-hidden', 'true');
    canvas.append(svg);
  }
  const node = (id) => boxes.get(id) || null;

  /** One box for a node: name, formula, result line, the two ports. Built once; updated after. */
  function build(n) {
    const box = document.createElement('div');
    box.className = 'sn-node';
    box.dataset.id = n.id;
    const head = document.createElement('div');
    head.className = 'sn-head';
    const name = document.createElement('input');
    name.className = 'sn-name'; name.value = n.name; name.setAttribute('aria-label', 'Name of this node');
    name.spellcheck = false; name.autocomplete = 'off';
    name.addEventListener('change', () => handlers.rename && handlers.rename(n.id, name.value, () => { name.value = n.name; }));
    name.addEventListener('input', () => handlers.renameLive && handlers.renameLive(n.id, name.value));
    const del = document.createElement('button');
    del.type = 'button'; del.className = 'sn-del'; del.textContent = '×'; del.setAttribute('aria-label', 'Delete ' + n.name);
    del.addEventListener('click', () => handlers.remove && handlers.remove(n.id));
    head.append(name, del);
    const expr = document.createElement('input');
    expr.className = 'sn-expr'; expr.value = n.expr; expr.spellcheck = false; expr.autocomplete = 'off';
    expr.setAttribute('aria-label', 'Formula for ' + n.name);
    expr.addEventListener('input', () => handlers.formula && handlers.formula(n.id, expr.value));
    const out = document.createElement('p');
    out.className = 'sn-res'; out.setAttribute('aria-live', 'polite');
    const inPort = document.createElement('span'); inPort.className = 'sn-port sn-in'; inPort.title = 'Uses other nodes';
    const outPort = document.createElement('span'); outPort.className = 'sn-port sn-out'; outPort.title = 'Other nodes can use this one';
    box.append(head, expr, out, inPort, outPort);
    head.addEventListener('pointerdown', (e) => {
      if (e.target.closest('input, button')) return;
      drag(box, n, e);
    });
    box._res = out; box._expr = expr; box._name = name;
    return box;
  }

  function drag(box, n, e) {
    const x0 = e.clientX, y0 = e.clientY, nx = n.x, ny = n.y;
    box.setPointerCapture(e.pointerId);
    box.classList.add('is-drag');
    const move = (ev) => {
      n.x = Math.max(0, nx + ev.clientX - x0); n.y = Math.max(0, ny + ev.clientY - y0);
      place(box, n);
      if (handlers.moving) handlers.moving();
    };
    const up = () => {
      box.removeEventListener('pointermove', move);
      box.removeEventListener('pointerup', up);
      box.classList.remove('is-drag');
      if (handlers.moved) handlers.moved();
    };
    box.addEventListener('pointermove', move);
    box.addEventListener('pointerup', up);
  }
  function place(box, n) { box.style.left = n.x + 'px'; box.style.top = n.y + 'px'; }

  /** Brings the boxes in line with the nodes: new ones are built, removed ones are dropped, the rest are moved. */
  function sync(nodes) {
    const keep = new Set(nodes.map((n) => n.id));
    for (const [id, box] of boxes) if (!keep.has(id)) { box.remove(); boxes.delete(id); }
    for (const n of nodes) {
      let box = boxes.get(n.id);
      if (!box) { box = build(n); boxes.set(n.id, box); canvas.append(box); }
      box._n = n;
      place(box, n);
    }
  }

  /** The result line and the state of each node. */
  function paint(nodes, results, cycles) {
    for (const n of nodes) {
      const box = boxes.get(n.id), r = results.get(n.id);
      if (!box) continue;
      box._res.textContent = !r ? '' : r.ok ? '= ' + r.text : r.error.message;
      box._res.classList.toggle('sn-err', !!r && !r.ok);
      box.classList.toggle('is-cycle', cycles.has(n.id));
      box.classList.toggle('is-wired', !!(r && r.needs && r.needs.length));
    }
  }

  /** Wires from each node a formula uses to that formula's node. edges: [{ from, to, bad }] (node ids). */
  function wires(nodes, edges) {
    svg.replaceChildren();
    const at = new Map(nodes.map((n) => [n.id, n]));
    for (const e of edges) {
      const a = at.get(e.from), b = at.get(e.to);
      if (!a || !b) continue;
      const x1 = a.x + NODE_W, y1 = a.y + HEAD / 2, x2 = b.x, y2 = b.y + HEAD / 2;
      const dx = Math.max(60, Math.abs(x2 - x1) / 2);
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', `M${x1} ${y1} C${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`);
      p.setAttribute('class', 'sn-wire' + (e.bad ? ' is-bad' : ''));
      svg.append(p);
    }
  }

  window.SlopNodesView = { mount, sync, paint, wires, node, NODE_W, HEAD };
})();
