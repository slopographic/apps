/* Slop 3D objects: turns the scene document into three.js objects under stage.world and keeps them in step.
 * sync(doc, { selected, wireframe }) is cheap to call after every change: objects are created, updated or removed
 * by node id, geometry is rebuilt only when a shape changes, and selection outlines are redrawn.
 * Each mesh and light marker carries userData.nodeId, which picking reads. Sets window.Slop3D.objects. */
(function () {
  'use strict';
  const S = (window.Slop3D = window.Slop3D || {});
  const D = Math.PI / 180;

  function toGeometry(THREE, g) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.positions, 3));
    if (g.normals) geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.normals, 3));
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(g.indices), 1));
    if (!g.normals) geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }
  /** A cheap change key for a shape: parameters for primitives, a sampled checksum for imported meshes. */
  function geomKey(node) {
    const g = node.geom;
    if (g.kind !== 'mesh') return JSON.stringify(g);
    let sum = 0;
    const p = g.positions, step = Math.max(3, Math.floor(p.length / 4096) * 3);
    for (let i = 0; i < p.length; i += step) sum += p[i] * 1.000001 + p[i + 1] * 0.7 + p[i + 2] * 0.3;
    return `mesh:${p.length}:${g.indices.length}:${sum}`;
  }

  function create(THREE, world) {
    const items = new Map();     // node id → { obj, key, kind, mesh?, marker? }
    const geoCache = new Map();  // id → { key, geo }
    const sel = new THREE.Group();
    const ui = new THREE.Group(); ui.name = 'selection';
    world.parent.add(ui);
    const markerGeo = new THREE.OctahedronGeometry(0.12, 0);
    const wireMat = new THREE.LineBasicMaterial({ color: 0xffb020, depthTest: false, transparent: true });

    function meshFor(node, it) {
      const key = geomKey(node);
      if (!it.mesh) {
        it.mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide }));
        it.mesh.userData.nodeId = node.id;
        it.obj.add(it.mesh);
      }
      if (it.key !== key) {
        const g = S.geometry.build(node.geom);
        it.mesh.geometry.dispose();
        it.mesh.geometry = toGeometry(THREE, g);
        it.key = key;
      }
      const m = node.material, mat = it.mesh.material;
      mat.color.set(m.color);
      mat.roughness = m.roughness;
      mat.metalness = m.metallic;
      mat.opacity = m.opacity;
      mat.transparent = m.opacity < 1;
      if (node.material.map && mat.userData.map !== node.material.map) {
        mat.userData.map = node.material.map;
        new THREE.TextureLoader().load(node.material.map, (t) => { t.colorSpace = THREE.SRGBColorSpace; mat.map = t; mat.needsUpdate = true; stage.request(); });
      } else if (!node.material.map && mat.map) { mat.map = null; mat.userData.map = null; mat.needsUpdate = true; }
    }
    function lightFor(node, it) {
      const L = node.light;
      if (!it.obj.isLight) {
        it.obj.removeFromParent();
        it.obj = L.kind === 'ambient' ? new THREE.AmbientLight() : new THREE.DirectionalLight();
        if (it.obj.isDirectionalLight) { it.obj.target.position.set(0, 0, 0); world.add(it.obj.target); }
        it.marker = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ wireframe: true }));
        it.marker.userData.nodeId = node.id;
        it.obj.add(it.marker);
        it.obj.userData.nodeId = node.id;
        it.kind = 'light';
      }
      it.obj.color.set(L.color);
      it.obj.intensity = L.intensity;
      it.marker.material.color.set(L.color);
    }

    /** Creates, updates or removes objects so they match doc. opts: { selected: Set|[], wireframe: bool, stage }. */
    function sync(doc, opts = {}) {
      const alive = new Set(Object.keys(doc.nodes));
      for (const id of [...items.keys()]) if (!alive.has(id)) { removeItem(id); }
      for (const id of alive) {
        const node = doc.nodes[id];
        let it = items.get(id);
        const kind = node.type === 'light' ? 'light' : node.type;
        if (it && it.kind !== kind) { removeItem(id); it = null; }
        if (!it) {
          const obj = node.type === 'group' ? new THREE.Group() : node.type === 'mesh' ? new THREE.Group() : new THREE.Group();
          it = { obj, kind, key: null };
          obj.userData.nodeId = id;
          items.set(id, it);
        }
        if (kind === 'light') lightFor(node, it);
        else if (kind === 'mesh') meshFor(node, it);
        const p = node.transform.p, r = node.transform.r, s = node.transform.s;
        it.obj.position.set(p[0], p[1], p[2]);
        it.obj.rotation.set(r[0] * D, r[1] * D, r[2] * D, 'XYZ');
        it.obj.scale.set(s[0], s[1], s[2]);
        it.obj.visible = node.visible;
      }
      // Re-parent: attach every object under its parent's object (or the world).
      for (const id of alive) {
        const node = doc.nodes[id], it = items.get(id);
        const parentObj = node.parent && items.get(node.parent) ? items.get(node.parent).obj : world;
        if (it.obj.parent !== parentObj) parentObj.add(it.obj);
      }
      for (const id of alive) { const node = doc.nodes[id]; const it = items.get(id); if (it.obj.parent !== (node.parent && items.get(node.parent) ? items.get(node.parent).obj : world)) { /* order fixed above */ } }
      sel.clear();
      ui.clear();
      for (const id of opts.selected || []) {
        const it = items.get(id);
        if (!it || !alive.has(id)) continue;
        ui.add(new THREE.BoxHelper(it.obj, 0xffb020));
      }
      return items;
    }
    function removeItem(id) {
      const it = items.get(id);
      if (!it) return;
      if (it.obj.isDirectionalLight) world.remove(it.obj.target);
      it.obj.removeFromParent();
      if (it.mesh) { it.mesh.geometry.dispose(); it.mesh.material.dispose(); }
      items.delete(id);
    }
    /** Every pickable object (meshes and light markers) that is currently visible. */
    function pickables() {
      const out = [];
      for (const [, it] of items) {
        if (it.mesh && it.mesh.visible && it.obj.visible !== false) out.push(it.mesh);
        if (it.marker) out.push(it.marker);
      }
      return out.filter((o) => { for (let c = o; c; c = c.parent) if (c.visible === false) return false; return true; });
    }
    let stage = null;
    return { sync, pickables, items, bindStage(s) { stage = s; }, dispose() { for (const id of [...items.keys()]) removeItem(id); ui.clear(); }, _unused: [sel, wireMat, geoCache] };
  }

  S.objects = { create, toGeometry, geomKey };
})();
