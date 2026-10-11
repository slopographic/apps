// 3D Sloppo: a jelly blob rendered with three.js. Loaded only when the HUD's "3D" toggle is
// switched on (dynamic import), so the homepage stays light. Follows the same perch, physics and
// moods as the 2D painter; create() throws if WebGL is unavailable and the caller falls back to 2D.
import * as THREE from '../../vendor/three/three.module.min.js';

const LIME = 0xa6ee14, INK = 0x120c04;

/** A unit sphere reshaped into Sloppo's gumdrop: flat squishy base, soft dome, slight tip. */
function gumdrop() {
  const g = new THREE.SphereGeometry(1, 48, 32), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (y < 0) { y *= 0.42; const k = 1 + 0.12 * (-y / 0.42); x *= k; z *= k; }
    else { const k = 1 - 0.28 * y * y * y; x *= k; z *= k; y *= 1.08; }
    p.setXYZ(i, x, y + 0.42, z);
  }
  g.computeVertexNormals();
  g.userData.rest = Float32Array.from(p.array);
  return g;
}

export function create(container, W, H, base) {
  const canvas = document.createElement('canvas');
  canvas.className = 'sloppo-3d';
  canvas.setAttribute('aria-hidden', 'true');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: true });
  if (!renderer.getContext()) throw new Error('No WebGL');
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(W, H, false);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  container.append(canvas);

  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, -400, 400);
  cam.position.z = 200;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x223300, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-80, 140, 160); scene.add(key);
  const rim = new THREE.DirectionalLight(0xd4ff3a, 1.4); rim.position.set(120, -20, -120); scene.add(rim);

  const root = new THREE.Group();
  root.position.y = H / 2 - base;
  scene.add(root);
  const body = new THREE.Group();          // squash, spin and turn happen here (origin at his feet)
  root.add(body);

  const geo = gumdrop();
  const jelly = new THREE.MeshPhysicalMaterial({ color: LIME, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.15, sheen: 0.6, sheenColor: new THREE.Color(0xf1ffb8), emissive: 0x2c5200, emissiveIntensity: 0.35 });
  const blob = new THREE.Mesh(geo, jelly);
  body.add(blob);
  const puddle = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.06, 40), new THREE.MeshPhysicalMaterial({ color: LIME, roughness: 0.3, clearcoat: 1, transparent: true, opacity: 0.85 }));
  root.add(puddle);

  // Face: eyes (with highlights), brows, mouth, fangs, cheeks.
  const face = new THREE.Group();     // face units are body sizes (s), like the 2D painter
  face.scale.set(1 / 0.5, 1.5 / 0.84, 1 / 0.45);
  body.add(face);
  const dark = new THREE.MeshStandardMaterial({ color: INK, roughness: 0.3 });
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const pink = new THREE.MeshStandardMaterial({ color: 0xff4f86, roughness: 0.3 });
  const sph = new THREE.SphereGeometry(1, 20, 14);
  const eyes = [-1, 1].map((sx) => {
    const e = new THREE.Group();
    const ball = new THREE.Mesh(sph, dark); ball.scale.set(0.085, 0.108, 0.05);
    const hi = new THREE.Mesh(sph, white); hi.scale.setScalar(0.032); hi.position.set(-0.03, 0.04, 0.05);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.02), dark); brow.position.set(0, 0.15, 0.03); brow.rotation.z = sx * -0.45;
    e.add(ball, hi, brow);
    e.position.set(sx * 0.17, 0.42, 0.37);
    e.userData = { ball, hi, brow, sx };
    face.add(e);
    return e;
  });
  const cheeks = [-1, 1].map((sx) => { const c = new THREE.Mesh(sph, new THREE.MeshBasicMaterial({ color: 0xff6f96, transparent: true, opacity: 0.45 })); c.scale.set(0.065, 0.035, 0.02); c.position.set(sx * 0.29, 0.32, 0.34); face.add(c); return c; });
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 8, 20, Math.PI), dark);
  smile.rotation.z = Math.PI; smile.position.set(0, 0.29, 0.41);
  const mouthO = new THREE.Mesh(sph, dark); mouthO.scale.set(0.035, 0.045, 0.02); mouthO.position.set(0, 0.27, 0.41);
  const fangs = [-1, 1].map((sx) => { const f = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.04, 8), white); f.rotation.z = Math.PI; f.position.set(sx * 0.022, 0.255, 0.42); return f; });
  face.add(smile, mouthO, ...fangs, ...cheeks);

  const rest = geo.userData.rest, pos = geo.attributes.position;
  let wobT = 0;
  /** Paint one frame. M: mascot state, s: body size (px), look: [eyes, mouth], t: ms. */
  function render(M, s, look, t, still) {
    const [eyeKind, mouth] = look;
    const k = still ? 0 : M.squash;
    const h = s * 0.84;
    body.scale.set(s * 0.5 * (1 + k * 0.32), h * 0.66 * (1 - k * 0.28), s * 0.45 * (1 + k * 0.32));
    body.rotation.z = -M.rot;
    body.rotation.y = still ? 0 : Math.sin(t / 1400) * 0.35 + (M.mode === 'drag' ? Math.max(-0.6, Math.min(0.6, M.rot * 2)) : 0);
    puddle.scale.set(s * 0.68, 1, s * 0.3);
    puddle.visible = M.mode === 'perched' || M.mode === 'hop';
    // Jelly wobble: ripple the surface a little (stronger right after a squash).
    if (!still) {
      wobT = t / 1000;
      const amp = 0.012 + Math.min(0.05, Math.abs(k) * 0.08);
      for (let i = 0; i < pos.count; i++) {
        const x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2];
        const w = 1 + amp * Math.sin(wobT * 6 + y * 5 + Math.atan2(z, x) * 2) * Math.min(1, y);
        pos.setXYZ(i, x * w, y, z * w);
      }
      pos.needsUpdate = true;
    }
    // Moods: rage tints him red and shakes him.
    jelly.color.setHex(M.raging ? 0xff5a1f : LIME);
    jelly.emissive.setHex(M.raging ? 0x5a0a00 : 0x2c5200);
    root.position.x = M.raging && !still ? Math.sin(t * 0.09) * 2 : 0;
    for (const e of eyes) {
      const { ball, hi, brow, sx } = e.userData;
      const closed = eyeKind === 'sleepy' || eyeKind === 'happy';
      ball.material = eyeKind === 'heart' ? pink : dark;
      ball.scale.set(0.085, closed ? 0.02 : 0.108, 0.05);
      hi.visible = !closed;
      brow.visible = eyeKind === 'angry';
      e.rotation.z = eyeKind === 'spiral' ? t / 120 * sx : 0;
      hi.position.x = eyeKind === 'spiral' ? 0.045 : -0.03;
    }
    smile.visible = mouth === 'smile' || mouth === 'fangs' || mouth === 'wavy';
    smile.rotation.z = mouth === 'frown' ? 0 : Math.PI;
    if (mouth === 'frown') smile.visible = true;
    mouthO.visible = mouth === 'o' || mouth === 'open';
    mouthO.scale.y = mouth === 'open' ? 0.06 : 0.045;
    fangs.forEach((f) => { f.visible = mouth === 'fangs'; });
    renderer.render(scene, cam);
  }
  function dispose() {
    renderer.dispose();
    geo.dispose();
    canvas.remove();
  }
  return { render, dispose, canvas };
}
