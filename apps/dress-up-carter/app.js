// Dress Up Carter — a 3D dress-up game starring a stylized CarterPCs.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/* ------------------------------------------------------------------ *
 * Scene setup
 * ------------------------------------------------------------------ */
const stage = document.querySelector("#stage");
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
stage.appendChild(renderer.domElement);
document.querySelector("#loading").remove();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 50);
camera.position.set(0.9, 1.45, 3.4);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.0, 0);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 0.6;
controls.maxDistance = 6;
controls.maxPolarAngle = Math.PI * 0.62;
controls.autoRotateSpeed = 1.6;

scene.add(new THREE.HemisphereLight(0xf2f4ff, 0x4a3b33, 1.1));
const key = new THREE.DirectionalLight(0xfff1e0, 2.4);
key.position.set(2.2, 4, 3);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -1.5; key.shadow.camera.right = 1.5;
key.shadow.camera.top = 2.5; key.shadow.camera.bottom = -0.5;
key.shadow.bias = -0.0005;
scene.add(key);
const rim = new THREE.DirectionalLight(0x9fb4ff, 1.4);
rim.position.set(-3, 2.5, -2.5);
scene.add(rim);
const fill = new THREE.PointLight(0xffd6b0, 0.6, 6);
fill.position.set(-1, 1.6, 2);
scene.add(fill);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(1.4, 64),
  new THREE.MeshStandardMaterial({ color: 0x2b2d42, roughness: 0.9 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const ring = new THREE.Mesh(
  new THREE.RingGeometry(1.4, 1.46, 64),
  new THREE.MeshStandardMaterial({ color: 0x7c96f2, emissive: 0x7c96f2, emissiveIntensity: 0.8 })
);
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.002;
scene.add(ring);

/* ------------------------------------------------------------------ *
 * Helpers: materials, textures, geometry
 * ------------------------------------------------------------------ */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const Zf = V(0, 0, 1);

function mat(color, o = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...o });
}
const metal = (color, rough = 0.3) => mat(color, { metalness: 0.85, roughness: rough });
const glow = (color, k = 1.6) => mat(color, { emissive: color, emissiveIntensity: k, roughness: 0.4 });

function shadowAll(obj) {
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return obj;
}

function canvasTex(draw, repeat = [1, 1], size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d"), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 4;
  return t;
}

// Small deterministic RNG so patterns look the same every load.
function rng(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

const TEX = {
  stripes: (a, b, n = 8, rep = [1, 1]) => canvasTex((g, s) => {
    for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(0, (i * s) / n, s, s / n + 1); }
  }, rep),
  rainbow: (rep = [1, 2]) => canvasTex((g, s) => {
    const cols = ["#ff3b3b", "#ff9f1c", "#ffe14d", "#3ddc84", "#2fb8ff", "#7b5cff", "#ff4fd8"];
    cols.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, (i * s) / cols.length, s, s / cols.length + 1); });
  }, rep),
  plaid: (a, b, c, rep = [3, 3]) => canvasTex((g, s) => {
    g.fillStyle = a; g.fillRect(0, 0, s, s);
    g.globalAlpha = 0.55; g.fillStyle = b;
    g.fillRect(0, s * 0.1, s, s * 0.3); g.fillRect(s * 0.1, 0, s * 0.3, s);
    g.globalAlpha = 0.9; g.fillStyle = c;
    g.fillRect(0, s * 0.7, s, s * 0.04); g.fillRect(s * 0.7, 0, s * 0.04, s);
    g.globalAlpha = 1;
  }, rep),
  flowers: (a, b, c, rep = [3, 3]) => canvasTex((g, s) => {
    g.fillStyle = a; g.fillRect(0, 0, s, s);
    const r = rng(7);
    for (let i = 0; i < 9; i++) {
      const x = r() * s, y = r() * s, R = 14 + r() * 10;
      g.fillStyle = i % 3 ? b : "#ffffff";
      for (let p = 0; p < 5; p++) {
        const an = (p / 5) * Math.PI * 2;
        g.beginPath(); g.ellipse(x + Math.cos(an) * R * 0.6, y + Math.sin(an) * R * 0.6, R * 0.55, R * 0.35, an, 0, 7); g.fill();
      }
      g.fillStyle = c; g.beginPath(); g.arc(x, y, R * 0.3, 0, 7); g.fill();
    }
    g.fillStyle = "#2f9e44";
    for (let i = 0; i < 10; i++) { g.beginPath(); g.ellipse(r() * s, r() * s, 12, 5, r() * 3, 0, 7); g.fill(); }
  }, rep),
  camo: (a, b, c, rep = [2, 2]) => canvasTex((g, s) => {
    g.fillStyle = a; g.fillRect(0, 0, s, s);
    const r = rng(11);
    [b, c].forEach((col) => {
      g.fillStyle = col;
      for (let i = 0; i < 14; i++) {
        const x = r() * s, y = r() * s;
        g.beginPath();
        for (let k = 0; k < 7; k++) {
          const an = (k / 7) * Math.PI * 2, R = 14 + r() * 22;
          g[k ? "lineTo" : "moveTo"](x + Math.cos(an) * R, y + Math.sin(an) * R);
        }
        g.fill();
      }
    });
  }, rep),
  leopard: (rep = [3, 3]) => canvasTex((g, s) => {
    g.fillStyle = "#e0a95b"; g.fillRect(0, 0, s, s);
    const r = rng(23);
    for (let i = 0; i < 26; i++) {
      const x = r() * s, y = r() * s, R = 9 + r() * 8;
      g.fillStyle = "#3b2414";
      g.beginPath(); g.ellipse(x, y, R, R * 0.8, r() * 3, 0, 7); g.fill();
      g.fillStyle = "#b9742f";
      g.beginPath(); g.ellipse(x, y, R * 0.55, R * 0.42, r() * 3, 0, 7); g.fill();
    }
  }, rep),
  polka: (a, b, rep = [3, 3]) => canvasTex((g, s) => {
    g.fillStyle = a; g.fillRect(0, 0, s, s); g.fillStyle = b;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      g.beginPath(); g.arc((x + (y % 2) * 0.5) * s / 4, (y + 0.5) * s / 4, s / 14, 0, 7); g.fill();
    }
  }, rep),
  weave: (rep = [6, 2]) => canvasTex((g, s) => {
    g.fillStyle = "#b8b3a5"; g.fillRect(0, 0, s, s);
    const n = 16, w = s / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      g.fillStyle = (x + y) % 2 ? "#8f8a7c" : "#d6d1c3";
      g.fillRect(x * w + 1, y * w + 1, w - 2, w - 2);
    }
  }, rep),
  coneStripes: () => canvasTex((g, s) => {
    g.fillStyle = "#ff6a00"; g.fillRect(0, 0, s, s);
    g.fillStyle = "#ffffff"; g.fillRect(0, s * 0.3, s, s * 0.12); g.fillRect(0, s * 0.58, s, s * 0.12);
  }),
  spiral: () => canvasTex((g, s) => {
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, s, s);
    g.strokeStyle = "#7b2cff"; g.lineWidth = s / 18; g.beginPath();
    for (let t = 0; t < 30; t += 0.05) {
      const r = t * s / 64, x = s / 2 + Math.cos(t) * r, y = s / 2 + Math.sin(t) * r;
      t ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
  }),
};

// Capsule stretched between two points.
function limb(a, b, r, m) {
  const d = b.clone().sub(a);
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, d.length(), 6, 18), m);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(UP, d.normalize());
  return mesh;
}
// Ellipsoid.
function ell(rx, ry, rz, m, pos = V(0, 0, 0)) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), m);
  mesh.scale.set(rx, ry, rz);
  mesh.position.copy(pos);
  return mesh;
}
function cyl(rt, rb, h, m, pos = V(0, 0, 0), seg = 32, open = false) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), m);
  mesh.position.copy(pos);
  return mesh;
}
function group(...kids) { const g = new THREE.Group(); kids.flat().filter(Boolean).forEach((k) => g.add(k)); return g; }
const mirror = (fn) => [fn(-1), fn(1)];

/* ------------------------------------------------------------------ *
 * Body proportions (metres). Slim, ~1.83 m, long limbs, curly high-top hair.
 * ------------------------------------------------------------------ */
const SKIN = 0x8a5a3c;
const LIP = 0x6e3a2b;
const HAIR = 0x120b08;
const skin = mat(SKIN, { roughness: 0.6 });

const HEAD_Y = 1.77;
const HR = { x: 0.112, y: 0.138, z: 0.122 }; // head radii
const J = {}; // joints
for (const s of [-1, 1]) {
  const k = s < 0 ? "L" : "R";
  J["shoulder" + k] = V(0.215 * s, 1.45, 0);
  J["elbow" + k] = V(0.27 * s, 1.17, -0.02);
  J["wrist" + k] = V(0.29 * s, 0.93, 0.03);
  J["hand" + k] = V(0.295 * s, 0.865, 0.035);
  J["hip" + k] = V(0.095 * s, 0.93, 0);
  J["knee" + k] = V(0.1 * s, 0.52, 0.015);
  J["ankle" + k] = V(0.1 * s, 0.1, 0);
  J["foot" + k] = V(0.1 * s, 0.04, 0.045);
}
const R = { upper: 0.046, fore: 0.04, thigh: 0.068, shin: 0.054, shoulder: 0.056 };
const TORSO = { y: 1.2, r: 0.15, len: 0.36, sx: 1.22, sz: 0.72 };

// Point on the face/head ellipsoid surface (head-local coords; +z is the face).
function surf(x, y, push = 0) {
  const t = 1 - (x / HR.x) ** 2 - (y / HR.y) ** 2;
  return V(x, y, HR.z * Math.sqrt(Math.max(0, t)) + push);
}
function normalAt(p) {
  return V(p.x / HR.x ** 2, p.y / HR.y ** 2, p.z / HR.z ** 2).normalize();
}
// Flat geometry stuck onto the face, facing outward.
function decal(geom, x, y, m, push = 0.002, rotZ = 0) {
  const mesh = new THREE.Mesh(geom, m);
  const p = surf(x, y, 0);
  const n = normalAt(p);
  mesh.position.copy(p).addScaledVector(n, push);
  mesh.quaternion.setFromUnitVectors(Zf, n);
  mesh.rotateZ(rotZ);
  return mesh;
}

const character = new THREE.Group();
scene.add(character);
const body = new THREE.Group();
character.add(body);
const head = new THREE.Group();
head.position.y = HEAD_Y;
character.add(head);

function buildBody() {
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(TORSO.r, TORSO.len, 8, 24), skin);
  torso.position.y = TORSO.y;
  torso.scale.set(TORSO.sx, 1, TORSO.sz);
  body.add(torso);
  body.add(ell(0.165, 0.1, 0.11, skin, V(0, 0.93, 0)));
  body.add(limb(V(0, 1.5, 0), V(0, 1.68, -0.008), 0.05, skin)); // neck
  for (const k of ["L", "R"]) {
    body.add(new THREE.Mesh(new THREE.SphereGeometry(R.shoulder, 20, 14), skin).translateX(J["shoulder" + k].x).translateY(J["shoulder" + k].y));
    body.add(limb(J["shoulder" + k], J["elbow" + k], R.upper, skin));
    body.add(limb(J["elbow" + k], J["wrist" + k], R.fore, skin));
    body.add(ell(0.032, 0.055, 0.022, skin, J["hand" + k]));
    body.add(limb(J["hip" + k], J["knee" + k], R.thigh, skin));
    body.add(limb(J["knee" + k], J["ankle" + k], R.shin, skin));
    body.add(ell(0.045, 0.035, 0.1, skin, J["foot" + k]));
  }
  body.userData.torso = torso;
  shadowAll(body);
}

const hair = new THREE.Group();
function buildHead() {
  head.add(ell(HR.x, HR.y, HR.z, skin));
  // jaw / chin
  head.add(ell(0.082, 0.062, 0.095, skin, V(0, -0.07, 0.008)));
  // ears
  for (const s of [-1, 1]) head.add(ell(0.016, 0.03, 0.012, skin, V(s * HR.x * 0.97, -0.005, -0.008)));
  // stud earring (seen in his videos)
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.0055, 12, 8), metal(0xe9ecef, 0.15)).translateX(-HR.x - 0.004).translateY(-0.03).translateZ(-0.004));
  // nose
  const nose = ell(0.019, 0.02, 0.016, skin, surf(0, -0.022, -0.004));
  head.add(nose);
  head.add(ell(0.01, 0.025, 0.01, skin, surf(0, 0.0, -0.002)));
  // lips — slight easy smile
  const lip = mat(LIP, { roughness: 0.45 });
  head.add(ell(0.03, 0.007, 0.011, lip, surf(0, -0.06, -0.004)));
  const lower = ell(0.028, 0.009, 0.012, lip, surf(0, -0.07, -0.005));
  head.add(lower);
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.0025, 6, 20, Math.PI * 0.6), mat(0x3c1e16));
  smile.position.copy(surf(0, -0.054, 0.001));
  smile.rotation.z = Math.PI * 1.2;
  head.add(smile);
  // eyebrows — thick, straight
  const brow = mat(HAIR, { roughness: 0.95 });
  for (const s of [-1, 1]) head.add(decal(new THREE.BoxGeometry(0.034, 0.007, 0.006), s * 0.043, 0.042, brow, 0.001, s * -0.12));
  shadowAll(head);
  buildHair();
  head.add(hair);
}

function buildHair() {
  const hm = mat(HAIR, { roughness: 0.95 });
  const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, 1.25), hm);
  cap.scale.set(HR.x * 1.05, HR.y * 1.04, HR.z * 1.05);
  cap.rotation.x = -0.28;
  hair.add(cap);
  // Curly high-top: lots of little lumpy curls, more volume on top and front fringe.
  const N = 380;
  const curls = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), mat(0xffffff, { roughness: 0.9 }), N);
  const r = rng(42), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const c = new THREE.Color();
  let i = 0;
  while (i < N) {
    const u = V(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
    if (u.lengthSq() > 1 || u.lengthSq() < 0.01) continue;
    u.normalize();
    if (u.y < -0.3) continue;
    if (u.z > 0.3 && u.y < 0.48) continue;        // keep the face clear
    if (Math.abs(u.x) > 0.75 && u.y < 0.12 && u.z > -0.5) continue; // show ears
    const rf = 1.0 + (0.1 + 0.42 * Math.max(0, u.y)) * (0.7 + r() * 0.45);
    const p = V(u.x * HR.x * rf * 1.05, u.y * HR.y * rf + 0.012, u.z * HR.z * rf);
    const s = 0.024 + r() * 0.02;
    q.setFromEuler(e.set(r() * 6, r() * 6, r() * 6));
    m4.compose(p, q, V(s, s * 0.9, s));
    curls.setMatrixAt(i, m4);
    c.setHex(HAIR).offsetHSL(0, 0, (r() - 0.5) * 0.06);
    curls.setColorAt(i, c);
    i++;
  }
  curls.castShadow = true;
  hair.add(curls);
}

buildBody();
buildHead();

/* ------------------------------------------------------------------ *
 * Clothing builders
 * ------------------------------------------------------------------ */
function torsoShell(m, k = 1.06, ky = 1.02) {
  const t = new THREE.Mesh(new THREE.CapsuleGeometry(TORSO.r, TORSO.len, 8, 24), m);
  t.position.y = TORSO.y + 0.005;
  t.scale.set(TORSO.sx * k, ky, TORSO.sz * k);
  return t;
}
function sleeves(m, len = "long", ex = 0.012) {
  const out = [];
  for (const k of ["L", "R"]) {
    const sh = J["shoulder" + k], el = J["elbow" + k], wr = J["wrist" + k];
    out.push(new THREE.Mesh(new THREE.SphereGeometry(R.shoulder + ex, 20, 14), m).translateX(sh.x).translateY(sh.y));
    if (len === "short") out.push(limb(sh, sh.clone().lerp(el, 0.5), R.upper + ex, m));
    if (len === "long" || len === "3q") {
      out.push(limb(sh, el, R.upper + ex, m));
      out.push(limb(el, len === "3q" ? el.clone().lerp(wr, 0.5) : wr.clone().lerp(el, 0.06), R.fore + ex, m));
    }
  }
  return out;
}
function collar(m, r = 0.062, tube = 0.014) {
  const t = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 10, 28), m);
  t.position.set(0, 1.53, 0);
  t.rotation.x = Math.PI / 2 - 0.15;
  return t;
}
function pants(m, len = "long", ex = 0.012) {
  const out = [ell(0.172 + ex * 0.4, 0.11, 0.118, m, V(0, 0.935, 0))];
  for (const k of ["L", "R"]) {
    const hp = J["hip" + k], kn = J["knee" + k], an = J["ankle" + k];
    if (len === "shorts") out.push(limb(hp, hp.clone().lerp(kn, 0.8), R.thigh + ex + 0.006, m));
    else {
      out.push(limb(hp, kn, R.thigh + ex, m));
      out.push(limb(kn, an.clone().add(V(0, 0.03, 0)), R.shin + ex, m));
    }
  }
  return out;
}
function shoes({ upper, sole = mat(0xf1f3f5), l = 1, w = 1, h = 1, soleH = 0.018, shaft, extra }) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const f = J[s < 0 ? "footL" : "footR"];
    g.add(ell(0.054 * w, 0.042 * h, 0.115 * l, upper, V(f.x, 0.045 * h, f.z + 0.012 * (l - 1) * 4)));
    const so = ell(0.058 * w, soleH, 0.12 * l, sole, V(f.x, soleH * 0.6, f.z + 0.012 * (l - 1) * 4));
    g.add(so);
    if (shaft) g.add(cyl(shaft.r, shaft.r * 0.95, shaft.top, shaft.m ?? upper, V(f.x, shaft.top / 2 + 0.03, 0)));
    if (extra) g.add(extra(s, f));
  }
  return g;
}

/* ------------------------------------------------------------------ *
 * Eyes
 * ------------------------------------------------------------------ */
const EYE = { x: 0.042, y: 0.012 };
const eyeWhite = mat(0xf4efe9, { roughness: 0.25 });
const black = mat(0x0b0b0b, { roughness: 0.2 });
function socket(s) { return surf(s * EYE.x, EYE.y, -0.01); }

function eyePair({ iris = 0x3b2314, irisR = 0.0095, emissive = 0, pupil = true, whiteR = 0.019 } = {}) {
  const g = new THREE.Group();
  const im = mat(iris, { roughness: 0.25, emissive: emissive ? iris : 0, emissiveIntensity: emissive });
  for (const s of [-1, 1]) {
    const c = socket(s);
    g.add(new THREE.Mesh(new THREE.SphereGeometry(whiteR, 20, 14), eyeWhite).translateX(c.x).translateY(c.y).translateZ(c.z));
    g.add(ell(irisR, irisR, irisR * 0.5, im, c.clone().add(V(0, 0, whiteR - irisR * 0.25))));
    if (pupil) g.add(ell(irisR * 0.48, irisR * 0.48, irisR * 0.3, black, c.clone().add(V(0, 0, whiteR + 0.0005))));
    // catch-light
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.0022, 8, 6), glow(0xffffff, 2)).translateX(c.x + 0.004).translateY(c.y + 0.004).translateZ(c.z + whiteR + 0.001));
  }
  return g;
}

function heartShape() {
  const s = new THREE.Shape();
  s.moveTo(0, -1);
  s.bezierCurveTo(-0.2, -0.6, -1, -0.3, -1, 0.3);
  s.bezierCurveTo(-1, 0.8, -0.4, 1, 0, 0.55);
  s.bezierCurveTo(0.4, 1, 1, 0.8, 1, 0.3);
  s.bezierCurveTo(1, -0.3, 0.2, -0.6, 0, -1);
  return s;
}
function starShape(n = 5, r1 = 1, r2 = 0.45) {
  const s = new THREE.Shape();
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? r2 : r1;
    i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return s;
}
function boltShape() {
  const s = new THREE.Shape();
  [[0.2, 1], [-0.45, 0.05], [-0.05, 0.05], [-0.3, -1], [0.5, 0.15], [0.08, 0.15], [0.45, 1]]
    .forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  return s;
}

/* ------------------------------------------------------------------ *
 * Item catalog
 * style tags drive cohesion scoring, color drives harmony, bold (0–3) drives the risk bonus.
 * ------------------------------------------------------------------ */
const CATS = [
  { id: "hat", label: "🎩 Hats", hint: "Anything on top of those curls." },
  { id: "eyes", label: "👀 Eyes", hint: "Swap his eyes for something stranger." },
  { id: "makeup", label: "💄 Makeup", hint: "Face paint, glitter and worse." },
  { id: "top", label: "👕 Tops", hint: "Shirts, jackets and full-on costumes." },
  { id: "bottom", label: "👖 Bottoms", hint: "Pants, shorts, skirts." },
  { id: "shoes", label: "👟 Shoes", hint: "From sneakers to clown shoes." },
  { id: "acc", label: "🕶️ Extras", hint: "Stack up to 3 extras." },
];
const MAX_ACC = 3;
const ITEMS = {};
const BY_CAT = Object.fromEntries(CATS.map((c) => [c.id, []]));
function item(cat, id, name, emo, color, style, bold, build, extra = {}) {
  const it = { cat, id, name, emo, color, style, bold, build, ...extra };
  ITEMS[id] = it;
  BY_CAT[cat].push(it);
}

/* ---------- Hats ---------- */
item("hat", "no-hat", "No hat", "🚫", null, [], 0, () => null);
item("hat", "fedora", "Woven fedora", "👒", 0xb8b3a5, ["formal", "street"], 0, () => {
  const w = mat(0xffffff, { map: TEX.weave() });
  const g = group(
    cyl(0.112, 0.128, 0.1, w, V(0, 0.17, 0)),
    cyl(0.225, 0.225, 0.008, w, V(0, 0.122, 0), 48),
    cyl(0.131, 0.131, 0.026, mat(0x1f2a44), V(0, 0.137, 0)),
  );
  g.rotation.x = -0.08;
  return g;
}, { hair: 0.62 });
item("hat", "beanie", "Striped beanie", "🧢", 0xe03131, ["street", "cozy"], 0, () => {
  const k = mat(0xffffff, { map: TEX.stripes("#e03131", "#f8f9fa", 8, [1, 1]) });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.15, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), k);
  dome.scale.set(1, 1.05, 1.05);
  dome.position.y = 0.02;
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.148, 0.022, 10, 32), mat(0xe03131));
  cuff.rotation.x = Math.PI / 2; cuff.position.y = 0.03;
  const pom = ell(0.04, 0.04, 0.04, mat(0xf8f9fa, { roughness: 1 }), V(0, 0.19, 0));
  return group(dome, cuff, pom);
}, { hair: 0.6 });
item("hat", "crown", "Royal crown", "👑", 0xfcc419, ["royal"], 2, () => {
  const gold = metal(0xf2b705, 0.25);
  const g = group(cyl(0.1, 0.1, 0.055, gold, V(0, 0.2, 0), 32, true));
  g.children[0].material = gold.clone(); g.children[0].material.side = THREE.DoubleSide;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.05, 8), gold);
    spike.position.set(Math.sin(a) * 0.1, 0.25, Math.cos(a) * 0.1);
    g.add(spike);
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), glow([0xe03131, 0x1c7ed6, 0x2f9e44][i % 3], 0.6)).translateX(Math.sin(a) * 0.102).translateY(0.2).translateZ(Math.cos(a) * 0.102));
  }
  g.rotation.z = 0.08;
  return g;
});
item("hat", "cowboy", "Cowboy hat", "🤠", 0x8b5a2b, ["western"], 1, () => {
  const lea = mat(0x8b5a2b, { roughness: 0.8 });
  const brim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 8, 40), lea);
  brim.rotation.x = Math.PI / 2; brim.scale.set(1, 1.1, 0.12); brim.position.y = 0.13;
  const disc = cyl(0.21, 0.21, 0.006, lea, V(0, 0.122, 0), 40);
  const crown = cyl(0.1, 0.125, 0.13, lea, V(0, 0.19, 0));
  const dent = ell(0.06, 0.02, 0.09, mat(0x6f4520), V(0, 0.255, 0));
  const band = cyl(0.122, 0.126, 0.02, mat(0x2b1a0c), V(0, 0.14, 0));
  return group(brim, disc, crown, dent, band);
}, { hair: 0.6 });
item("hat", "tophat", "Top hat", "🎩", 0x111111, ["formal"], 1, () => {
  const m = mat(0x141414, { roughness: 0.5 });
  const g = group(cyl(0.1, 0.1, 0.24, m, V(0, 0.25, 0)), cyl(0.17, 0.17, 0.01, m, V(0, 0.13, 0), 40), cyl(0.102, 0.102, 0.03, mat(0x9c1c1c), V(0, 0.15, 0)));
  g.rotation.z = -0.1;
  return g;
}, { hair: 0.6 });
item("hat", "helmet", "Space helmet", "🧑‍🚀", 0xdfe3ea, ["space"], 2, () => {
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xcfe8ff, roughness: 0.02, metalness: 0.1, transparent: true, opacity: 0.22, clearcoat: 1 });
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.27, 40, 28), glass);
  bubble.position.y = 0.02;
  const neck = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.03, 12, 36), metal(0xdfe3ea, 0.35));
  neck.rotation.x = Math.PI / 2; neck.position.y = -0.2;
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 10), glow(0x51cf66, 3));
  light.position.set(0.13, -0.19, 0.08);
  return group(bubble, neck, light);
});
item("hat", "propeller", "Propeller cap", "🌀", 0xfab005, ["circus", "party"], 2, () => {
  const panels = canvasTex((g, s) => ["#e03131", "#fab005", "#1c7ed6", "#2f9e44"].forEach((c, i) => { g.fillStyle = c; g.fillRect((i * s) / 4, 0, s / 4 + 1, s); }));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.15, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xffffff, { map: panels }));
  dome.position.y = 0.04;
  const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.008, 28, 1, false, -0.9, 1.8), mat(0xe03131));
  visor.position.set(0, 0.045, 0.06); visor.scale.set(1, 1, 1.25);
  const stick = cyl(0.006, 0.006, 0.05, metal(0xadb5bd), V(0, 0.21, 0));
  const prop = group(
    new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.004, 0.035), mat(0x1c7ed6)),
    new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.004, 0.22), mat(0xe03131)),
  );
  prop.position.y = 0.235;
  prop.userData.spin = 18;
  return group(dome, visor, stick, prop);
}, { hair: 0.62 });
item("hat", "viking", "Viking helmet", "🪓", 0x868e96, ["fantasy"], 2, () => {
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.152, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), metal(0x868e96, 0.4));
  dome.position.y = 0.03;
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.152, 0.012, 8, 32), metal(0xb08d57, 0.35));
  band.rotation.x = Math.PI / 2; band.position.y = 0.035;
  const horn = mat(0xf1e6c8, { roughness: 0.6 });
  const horns = mirror((s) => {
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.022, 10, 20, Math.PI * 0.55), horn);
    h.position.set(s * 0.13, 0.08, 0);
    h.rotation.set(0, s < 0 ? Math.PI : 0, -0.2);
    return h;
  });
  return group(dome, band, horns);
}, { hair: 0.6 });
item("hat", "cone", "Traffic cone", "🚧", 0xff6a00, ["chaos"], 3, () => {
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.36, 32, 1, true), mat(0xffffff, { map: TEX.coneStripes(), side: THREE.DoubleSide }));
  cone.position.y = 0.3;
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.3), mat(0xff6a00));
  base.position.y = 0.12;
  const g = group(cone, base);
  g.rotation.z = 0.12;
  return g;
}, { hair: 0.62 });
item("hat", "chef", "Chef toque", "👨‍🍳", 0xf8f9fa, ["kitchen"], 2, () => {
  const w = mat(0xf8f9fa, { roughness: 0.95 });
  const g = group(cyl(0.12, 0.12, 0.12, w, V(0, 0.17, 0)));
  const r = rng(5);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    g.add(ell(0.07, 0.06, 0.07, w, V(Math.sin(a) * 0.08, 0.28 + r() * 0.03, Math.cos(a) * 0.08)));
  }
  g.add(ell(0.08, 0.07, 0.08, w, V(0, 0.31, 0)));
  return g;
}, { hair: 0.6 });

/* ---------- Eyes ---------- */
item("eyes", "eyes-natural", "Natural brown", "👁️", null, [], 0, () => eyePair());
item("eyes", "eyes-ice", "Ice blue", "🧊", null, ["cool", "fantasy"], 1, () => eyePair({ iris: 0x74c0fc, emissive: 0.4 }));
item("eyes", "eyes-alien", "Alien eyes", "👽", null, ["space"], 3, () => {
  const g = new THREE.Group();
  const gloss = mat(0x050505, { roughness: 0.05, metalness: 0.3 });
  for (const s of [-1, 1]) {
    const c = socket(s);
    const e = ell(0.032, 0.017, 0.016, gloss, c.clone().add(V(s * 0.003, 0, 0.008)));
    e.rotation.z = s * -0.4;
    g.add(e);
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 6), glow(0x69db7c, 4)).translateX(c.x + s * 0.008).translateY(c.y + 0.004).translateZ(c.z + 0.024));
  }
  return g;
});
item("eyes", "eyes-laser", "Laser eyes", "🔴", null, ["tech", "chaos"], 3, () => {
  const g = eyePair({ iris: 0xff1e1e, emissive: 4, irisR: 0.011 });
  const beam = new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const s of [-1, 1]) {
    const c = socket(s);
    const b = cyl(0.004, 0.004, 3, beam, c.clone().add(V(0, 0, 1.52)), 8);
    b.rotation.x = Math.PI / 2;
    b.userData.flicker = true;
    g.add(b);
  }
  return g;
});
item("eyes", "eyes-heart", "Heart eyes", "😍", null, ["party", "cute"], 2, () => {
  const g = new THREE.Group();
  const hm = glow(0xff2d6f, 0.8);
  const geo = new THREE.ExtrudeGeometry(heartShape(), { depth: 0.3, bevelEnabled: false });
  for (const s of [-1, 1]) {
    const c = socket(s);
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.019, 20, 14), eyeWhite).translateX(c.x).translateY(c.y).translateZ(c.z));
    const h = new THREE.Mesh(geo, hm);
    h.scale.set(0.015, 0.015, 0.015);
    h.position.copy(c).add(V(0, 0.001, 0.016));
    h.userData.pulse = true;
    g.add(h);
  }
  return g;
});
item("eyes", "eyes-hypno", "Hypno spirals", "😵‍💫", null, ["circus", "chaos"], 3, () => {
  const g = new THREE.Group();
  const sm = new THREE.MeshBasicMaterial({ map: TEX.spiral() });
  for (const s of [-1, 1]) {
    const c = socket(s);
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.019, 20, 14), eyeWhite).translateX(c.x).translateY(c.y).translateZ(c.z));
    const d = new THREE.Mesh(new THREE.CircleGeometry(0.016, 32), sm);
    d.position.copy(c).add(V(0, 0, 0.0192));
    d.userData.spinZ = s * 6;
    g.add(d);
  }
  return g;
});
item("eyes", "eyes-cat", "Cat eyes", "🐱", null, ["fantasy", "goth"], 2, () => {
  const g = eyePair({ iris: 0xc0eb75, emissive: 0.6, irisR: 0.013, pupil: false });
  for (const s of [-1, 1]) g.add(ell(0.0025, 0.011, 0.002, black, socket(s).add(V(0, 0, 0.0195))));
  return g;
});
item("eyes", "eyes-googly", "Googly eyes", "🤪", null, ["circus", "chaos"], 3, () => {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const c = socket(s).add(V(0, 0.004, 0.006));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.028, 24, 16), mat(0xffffff, { roughness: 0.1 })).translateX(c.x).translateY(c.y).translateZ(c.z));
    const p = ell(0.012, 0.012, 0.006, black, c.clone().add(V(0, 0, 0.026)));
    p.userData.googly = { base: p.position.clone(), phase: s * 1.7 };
    g.add(p);
  }
  return g;
});

/* ---------- Makeup ---------- */
item("makeup", "no-makeup", "Clean face", "🚫", null, [], 0, () => null);
item("makeup", "blush", "Rosy blush", "🌸", null, ["cute", "party"], 1, () => {
  const m = new THREE.MeshBasicMaterial({ color: 0xff6b8a, transparent: true, opacity: 0.4, depthWrite: false });
  return group(mirror((s) => decal(new THREE.CircleGeometry(0.02, 24), s * 0.062, -0.028, m, 0.0015)));
});
item("makeup", "freckles", "Freckles", "🟤", null, ["nature", "cute"], 1, () => {
  const m = mat(0x4a2a1a);
  const r = rng(99), g = new THREE.Group();
  for (let i = 0; i < 46; i++) {
    const x = (r() - 0.5) * 0.15, y = -0.045 + r() * 0.04;
    if (Math.abs(x) < 0.012 && y < -0.03) continue;
    g.add(decal(new THREE.CircleGeometry(0.0018 + r() * 0.0012, 8), x, y, m, 0.0015));
  }
  return g;
});
item("makeup", "eyeliner", "Dramatic wings", "🖋️", null, ["goth", "party"], 1, () => {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const sh = new THREE.Shape();
    sh.moveTo(-1, 0); sh.quadraticCurveTo(0, 0.7, 1, 0.15); sh.lineTo(1.7, 0.75); sh.lineTo(1.05, -0.12); sh.quadraticCurveTo(0, 0.35, -1, 0);
    const m = decal(new THREE.ShapeGeometry(sh), s * 0.044, 0.024, black, 0.012);
    m.scale.set(s * 0.018, 0.016, 1);
    g.add(m);
  }
  return g;
});
item("makeup", "glitter", "Glitter stars", "✨", null, ["party", "space"], 2, () => {
  const geo = new THREE.ShapeGeometry(starShape());
  const cols = [0xffd43b, 0xff8cc6, 0x74c0fc, 0xffffff];
  const spots = [[0.07, -0.01, 0.012], [0.08, -0.035, 0.008], [0.058, -0.045, 0.006], [-0.07, -0.015, 0.01], [-0.06, 0.07, 0.007], [0.035, 0.085, 0.006], [-0.085, -0.04, 0.007]];
  return group(spots.map(([x, y, s], i) => {
    const m = decal(geo, x, y, glow(cols[i % 4], 1.4), 0.002, i);
    m.scale.setScalar(s);
    return m;
  }));
});
item("makeup", "bolt", "Lightning bolt", "⚡", null, ["party", "chaos"], 2, () => {
  const m = decal(new THREE.ShapeGeometry(boltShape()), -0.04, 0.008, mat(0xe03131, { emissive: 0x7a0000, emissiveIntensity: 0.4 }), 0.013, 0.1);
  m.scale.set(0.045, 0.06, 1);
  const inner = decal(new THREE.ShapeGeometry(boltShape()), -0.04, 0.008, mat(0x1c7ed6), 0.0135, 0.1);
  inner.scale.set(0.025, 0.04, 1);
  return group(m, inner);
});
item("makeup", "clown", "Clown face", "🤡", null, ["circus"], 3, () => {
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.024, 20, 14), mat(0xe00000, { roughness: 0.2 }));
  nose.position.copy(surf(0, -0.02, 0.016));
  const dia = new THREE.Shape(); dia.moveTo(0, 1); dia.lineTo(0.5, 0); dia.lineTo(0, -1); dia.lineTo(-0.5, 0);
  const blue = mat(0x1c7ed6, { roughness: 0.4 });
  const marks = [];
  for (const s of [-1, 1]) {
    for (const dy of [0.034, -0.012]) {
      const d = decal(new THREE.ShapeGeometry(dia), s * EYE.x, EYE.y + dy, blue, 0.006);
      d.scale.set(0.01, 0.016, 1);
      marks.push(d);
    }
  }
  const mouth = decal(new THREE.CircleGeometry(1, 32), 0, -0.066, mat(0xe00000), 0.012);
  mouth.scale.set(0.045, 0.018, 1);
  return group(nose, marks, mouth);
});
item("makeup", "goldmask", "Gold mask", "🎭", null, ["royal", "party"], 3, () => {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(1, 40, 12, Math.PI / 2 - 1.05, 2.1, 1.18, 0.5),
    metal(0xf2b705, 0.22)
  );
  m.material.side = THREE.DoubleSide;
  m.scale.set(HR.x * 1.04, HR.y * 1.03, HR.z * 1.07);
  return m;
});
item("makeup", "circuit", "Circuit glow", "🔌", null, ["tech"], 3, () => {
  const m = glow(0x22e5ff, 2.4);
  const lines = [
    [[0.05, -0.02], [0.085, -0.02]], [[0.085, -0.02], [0.095, -0.05]], [[0.05, -0.02], [0.045, -0.045]],
    [[-0.05, -0.025], [-0.085, -0.025]], [[-0.085, -0.025], [-0.08, -0.055]],
    [[-0.035, 0.085], [0.025, 0.085]], [[0.025, 0.085], [0.045, 0.07]], [[-0.035, 0.085], [-0.05, 0.1]],
  ];
  const g = new THREE.Group();
  for (const [[x1, y1], [x2, y2]] of lines) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    g.add(decal(new THREE.BoxGeometry(len, 0.0028, 0.001), (x1 + x2) / 2, (y1 + y2) / 2, m, 0.0015, Math.atan2(y2 - y1, x2 - x1)));
    g.add(decal(new THREE.CircleGeometry(0.004, 12), x2, y2, m, 0.0018));
  }
  return g;
});

/* ---------- Tops ---------- */
item("top", "tee", "Black tee", "👕", 0x1e1e1e, ["street"], 0, () => {
  const m = mat(0x1e1e1e, { roughness: 0.9 });
  return group(torsoShell(m), sleeves(m, "short"), collar(m, 0.06, 0.01));
});
item("top", "hoodie", "Purple hoodie", "🧥", 0x7048e8, ["street", "cozy"], 0, () => {
  const m = mat(0x7048e8, { roughness: 0.95 });
  const hood = ell(0.15, 0.1, 0.11, m, V(0, 1.53, -0.08));
  const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09, 0.02), mat(0x5f3dc4));
  pocket.position.set(0, 1.0, 0.105);
  const strings = mirror((s) => cyl(0.004, 0.004, 0.12, mat(0xf8f9fa), V(s * 0.03, 1.43, 0.115), 6));
  return group(torsoShell(m, 1.09), sleeves(m, "long", 0.02), hood, pocket, strings, collar(m, 0.065, 0.018));
});
item("top", "tux", "Tuxedo jacket", "🤵", 0x111111, ["formal"], 0, () => {
  const m = mat(0x121212, { roughness: 0.55 });
  const shirt = ell(0.055, 0.15, 0.02, mat(0xf8f9fa), V(0, 1.36, 0.1));
  const bow = group(mirror((s) => {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.035, 12), m);
    c.rotation.z = (s * Math.PI) / 2;
    c.position.x = s * 0.018;
    return c;
  }));
  bow.position.set(0, 1.5, 0.105);
  const lapels = mirror((s) => {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.01), mat(0x262626, { roughness: 0.25 }));
    l.position.set(s * 0.05, 1.38, 0.108); l.rotation.z = s * 0.25;
    return l;
  });
  const buttons = [1.24, 1.17].map((y) => new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), metal(0xdee2e6)).translateY(y).translateZ(0.112));
  return group(torsoShell(m, 1.1), sleeves(m, "long", 0.016), shirt, bow, lapels, buttons);
});
item("top", "hawaiian", "Hawaiian shirt", "🌺", 0x1098ad, ["party", "nature"], 1, () => {
  const m = mat(0xffffff, { map: TEX.flowers("#1098ad", "#ffd43b", "#ff6b6b") });
  return group(torsoShell(m, 1.08), sleeves(m, "short", 0.02), collar(mat(0x1098ad), 0.07, 0.014));
});
item("top", "spacesuit", "Space suit", "🚀", 0xdfe3ea, ["space"], 2, () => {
  const m = metal(0xdfe3ea, 0.45);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.03), mat(0x343a40));
  panel.position.set(0, 1.3, 0.11);
  const leds = [0xff4d4d, 0x51cf66, 0x4dabf7].map((c, i) => new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), glow(c, 3)).translateX(-0.04 + i * 0.04).translateY(1.3).translateZ(0.127));
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.005), mat(0x1c7ed6));
  flag.position.set(-0.26, 1.38, 0.03); flag.rotation.y = -0.6;
  return group(torsoShell(m, 1.12), sleeves(m, "long", 0.024), panel, leds, flag, collar(metal(0xadb5bd), 0.07, 0.02));
});
item("top", "rgb", "RGB gaming jersey", "🌈", 0x7b5cff, ["tech", "party"], 2, () => {
  const t = TEX.rainbow([1, 2]);
  const m = mat(0xffffff, { map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.35 });
  m.userData.scroll = t;
  return group(torsoShell(m, 1.07), sleeves(m, "short", 0.016), collar(mat(0x111111), 0.06, 0.012));
});
item("top", "leopard", "Leopard fur coat", "🐆", 0xe0a95b, ["party", "goth"], 3, () => {
  const m = mat(0xffffff, { map: TEX.leopard(), roughness: 1 });
  const fluff = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.04, 12, 28), mat(0xf1e3c6, { roughness: 1 }));
  fluff.position.y = 1.5; fluff.rotation.x = Math.PI / 2 - 0.2;
  const hem = cyl(0.21, 0.24, 0.3, m, V(0, 0.8, 0), 32, true);
  hem.scale.z = 0.75; hem.material = m.clone(); hem.material.side = THREE.DoubleSide;
  return group(torsoShell(m, 1.17), sleeves(m, "long", 0.03), fluff, hem);
});
item("top", "puffer", "Orange puffer", "🦺", 0xfd7e14, ["street", "cozy"], 1, () => {
  const m = mat(0xfd7e14, { roughness: 0.35 });
  const rings = [0.96, 1.08, 1.2, 1.32, 1.44].map((y) => {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 10, 32), m);
    t.position.y = y; t.rotation.x = Math.PI / 2; t.scale.set(1.2, 0.8, 1);
    return t;
  });
  return group(torsoShell(m, 1.15), sleeves(m, "long", 0.03), rings, collar(m, 0.075, 0.028));
});
item("top", "banana", "Banana suit", "🍌", 0xffe066, ["chaos", "kitchen"], 3, () => {
  const curve = new THREE.CatmullRomCurve3([V(0, 0.55, 0.06), V(0, 0.9, 0.015), V(0, 1.25, 0), V(0, 1.55, -0.04)]);
  const y = mat(0xffe066, { roughness: 0.6 });
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.22, 24), y);
  const capB = ell(0.22, 0.12, 0.22, y, V(0, 0.55, 0.06));
  const tip = cyl(0.03, 0.045, 0.08, mat(0x5c3d1e), V(0, 0.46, 0.07));
  const capT = ell(0.21, 0.08, 0.21, y, V(0, 1.55, -0.04));
  const spots = [[0.12, 1.1], [-0.1, 0.85], [0.06, 0.7], [-0.14, 1.3]].map(([x, yy]) => ell(0.025, 0.02, 0.01, mat(0x6b4a1e), V(x, yy, Math.sqrt(0.226 ** 2 - x * x))));
  return group(tube, capB, tip, capT, spots);
});
item("top", "armor", "Knight armor", "🛡️", 0xadb5bd, ["fantasy", "royal"], 2, () => {
  const m = metal(0xced4da, 0.28);
  const pauldrons = mirror((s) => {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.085, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), m);
    p.position.set(s * 0.22, 1.47, 0); p.rotation.z = -s * 0.5;
    return p;
  });
  const belt = cyl(0.2, 0.2, 0.04, mat(0x5c3d1e), V(0, 0.92, 0));
  belt.scale.z = 0.72;
  const crest = new THREE.Mesh(new THREE.ShapeGeometry(starShape(4, 1, 0.35)), metal(0xf2b705, 0.3));
  crest.scale.setScalar(0.05); crest.position.set(0, 1.3, 0.125);
  return group(torsoShell(m, 1.12), sleeves(m, "long", 0.02), pauldrons, belt, crest);
});
item("top", "flannel", "Flannel shirt", "🪵", 0xc92a2a, ["western", "street"], 0, () => {
  const m = mat(0xffffff, { map: TEX.plaid("#c92a2a", "#1a1a1a", "#f1f3f5") });
  return group(torsoShell(m, 1.08), sleeves(m, "3q", 0.018), collar(mat(0x8a1c1c), 0.068, 0.014));
});

/* ---------- Bottoms ---------- */
item("bottom", "joggers", "Grey joggers", "🩶", 0x868e96, ["street", "cozy"], 0, () => {
  const m = mat(0x868e96, { roughness: 0.95 });
  const cuffs = mirror((s) => cyl(0.06, 0.06, 0.04, mat(0x495057), V(0.1 * s, 0.14, 0)));
  return group(pants(m, "long", 0.016), cuffs);
});
item("bottom", "jeans", "Blue jeans", "👖", 0x2f4b8f, ["street", "western"], 0, () => {
  const m = mat(0x2f4b8f, { roughness: 0.85 });
  const belt = cyl(0.18, 0.18, 0.03, mat(0x3b2414), V(0, 1.0, 0)); belt.scale.z = 0.68;
  return group(pants(m, "long", 0.012), belt);
});
item("bottom", "suitpants", "Suit trousers", "🖤", 0x141414, ["formal"], 0, () => group(pants(mat(0x161616, { roughness: 0.55 }), "long", 0.012)));
item("bottom", "cargo", "Camo cargo shorts", "🩳", 0x5c7a3a, ["street", "nature"], 1, () => {
  const m = mat(0xffffff, { map: TEX.camo("#6b7f45", "#3e4e28", "#a39770") });
  const pockets = mirror((s) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.07), m);
    p.position.set(s * 0.175, 0.72, 0.01);
    return p;
  });
  return group(pants(m, "shorts", 0.02), pockets);
});
item("bottom", "spacepants", "Space pants", "🛰️", 0xdfe3ea, ["space"], 1, () => {
  const m = metal(0xdfe3ea, 0.45);
  const pads = mirror((s) => ell(0.05, 0.05, 0.03, mat(0x343a40), V(0.1 * s, 0.53, 0.07)));
  return group(pants(m, "long", 0.022), pads);
});
item("bottom", "leggings", "Neon leggings", "💚", 0x94d82d, ["party", "chaos"], 2, () => {
  const t = TEX.stripes("#94d82d", "#f06595", 6, [1, 3]);
  return group(pants(mat(0xffffff, { map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.25 }), "long", 0.005));
});
item("bottom", "kilt", "Tartan kilt", "🏴", 0x2b5c3a, ["royal", "fantasy"], 2, () => {
  const t = TEX.plaid("#1d4d2b", "#1b2a5c", "#e03131", [4, 1]);
  const skirt = cyl(0.18, 0.27, 0.34, mat(0xffffff, { map: t, side: THREE.DoubleSide }), V(0, 0.79, 0), 40, true);
  skirt.scale.z = 0.8;
  const socks = mirror((s) => cyl(0.06, 0.058, 0.3, mat(0xf1f3f5, { roughness: 1 }), V(0.1 * s, 0.27, 0)));
  const sporran = ell(0.04, 0.05, 0.02, mat(0x5c3d1e), V(0, 0.8, 0.15));
  return group(skirt, ell(0.17, 0.1, 0.12, mat(0xffffff, { map: t }), V(0, 0.94, 0)), socks, sporran);
});
item("bottom", "clownpants", "Clown pants", "🎪", 0xfab005, ["circus"], 3, () => {
  const m = mat(0xffffff, { map: TEX.polka("#fab005", "#e03131") });
  const susp = mirror((s) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.55, 0.01), mat(0x1c7ed6));
    b.position.set(s * 0.08, 1.24, 0.118); b.rotation.z = s * 0.06;
    return b;
  });
  return group(pants(m, "long", 0.05), susp);
});

/* ---------- Shoes ---------- */
item("shoes", "sneakers", "White sneakers", "👟", 0xf1f3f5, ["street"], 0, () => shoes({ upper: mat(0xf1f3f5, { roughness: 0.6 }), sole: mat(0xdee2e6) }));
item("shoes", "chunky", "Chunky red kicks", "❤️", 0xe03131, ["street", "party"], 1, () => shoes({ upper: mat(0xe03131, { roughness: 0.5 }), sole: mat(0xffffff), soleH: 0.035, h: 1.2, w: 1.15 }));
item("shoes", "boots", "Cowboy boots", "🥾", 0x8b5a2b, ["western"], 1, () => shoes({
  upper: mat(0x8b5a2b, { roughness: 0.55 }), sole: mat(0x3b2414), l: 1.08,
  shaft: { r: 0.064, top: 0.3 },
  extra: (s, f) => { const h = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.05), mat(0x3b2414)); h.position.set(f.x, 0.02, -0.05); return h; },
}));
item("shoes", "oxfords", "Patent oxfords", "🖤", 0x111111, ["formal"], 0, () => shoes({ upper: mat(0x0f0f0f, { roughness: 0.12, metalness: 0.2 }), sole: mat(0x2b2b2b), l: 1.05, h: 0.9 }));
item("shoes", "moonboots", "Moon boots", "🌙", 0xf1f3f5, ["space"], 1, () => shoes({
  upper: mat(0xf1f3f5, { roughness: 0.8 }), sole: mat(0x868e96), w: 1.3, h: 1.4, soleH: 0.04,
  shaft: { r: 0.08, top: 0.22, m: mat(0xe9ecef, { roughness: 0.8 }) },
}));
item("shoes", "clownshoes", "Clown shoes", "🤡", 0xe03131, ["circus"], 3, () => shoes({ upper: mat(0xe00000, { roughness: 0.2 }), sole: mat(0xfab005), l: 2.1, w: 1.5, h: 1.3, soleH: 0.025 }));
item("shoes", "bunny", "Bunny slippers", "🐰", 0xffc9de, ["cozy", "cute"], 2, () => shoes({
  upper: mat(0xffc9de, { roughness: 1 }), sole: mat(0xffffff, { roughness: 1 }), w: 1.3, h: 1.25,
  extra: (s, f) => group(
    mirror((e) => { const ear = ell(0.015, 0.05, 0.01, mat(0xffc9de, { roughness: 1 }), V(f.x + e * 0.022, 0.13, f.z + 0.03)); ear.rotation.z = e * 0.25; return ear; }),
    mirror((e) => new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 6), black).translateX(f.x + e * 0.02).translateY(0.075).translateZ(f.z + 0.1)),
    new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), mat(0xff6b8a)).translateX(f.x).translateY(0.06).translateZ(f.z + 0.12),
  ),
}));
item("shoes", "goldtops", "Gold high-tops", "🥇", 0xf2b705, ["royal", "party"], 2, () => shoes({ upper: metal(0xf2b705, 0.2), sole: mat(0xffffff), h: 1.1, shaft: { r: 0.066, top: 0.13, m: metal(0xf2b705, 0.2) } }));

/* ---------- Extras (multi-select) ---------- */
item("acc", "headphones", "RGB headphones", "🎧", null, ["tech"], 1, () => {
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.012, 10, 40, Math.PI), mat(0x212529, { roughness: 0.4 }));
  band.position.y = 0.0;
  const cups = mirror((s) => {
    const c = cyl(0.045, 0.045, 0.04, mat(0x212529, { roughness: 0.35 }), V(s * 0.135, -0.005, 0));
    c.rotation.z = Math.PI / 2;
    const rgb = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.005, 8, 24), glow(0x22e5ff, 3));
    rgb.position.set(s * 0.156, -0.005, 0); rgb.rotation.y = Math.PI / 2;
    rgb.userData.hue = true;
    return group(c, rgb);
  });
  return group(band, cups);
}, { parent: "head" });
item("acc", "chain", "Gold chain", "📿", null, ["street", "royal"], 1, () => {
  const gold = metal(0xf2b705, 0.18);
  const c = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.009, 8, 40), gold);
  c.position.set(0, 1.48, 0.025); c.rotation.x = Math.PI / 2 - 0.55;
  const pend = cyl(0.028, 0.028, 0.008, gold, V(0, 1.38, 0.118));
  pend.rotation.x = Math.PI / 2;
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.014), glow(0x4dabf7, 1));
  gem.position.set(0, 1.38, 0.124);
  return group(c, pend, gem);
});
item("acc", "shades", "Shutter shades", "🕶️", null, ["street", "party"], 1, () => {
  const fr = mat(0x111111, { roughness: 0.2, metalness: 0.3 });
  const lens = mirror((s) => {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.006), fr);
    const c = socket(s);
    l.position.set(c.x, c.y + 0.002, c.z + 0.03);
    l.rotation.y = s * 0.15;
    return l;
  });
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.006, 0.006), fr);
  bridge.position.copy(surf(0, EYE.y + 0.008, 0.024));
  const arms = mirror((s) => { const a = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.005, 0.11), fr); a.position.set(s * 0.1, EYE.y + 0.006, 0.05); return a; });
  return group(lens, bridge, arms);
}, { parent: "head" });
item("acc", "monocle", "Monocle", "🧐", null, ["formal"], 1, () => {
  const c = socket(1);
  const r = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.003, 8, 24), metal(0xf2b705, 0.2));
  r.position.set(c.x, c.y, c.z + 0.026);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.021, 24), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.15, roughness: 0 }));
  glass.position.copy(r.position);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.14, 4), metal(0xf2b705));
  chain.position.set(c.x + 0.025, c.y - 0.07, c.z + 0.015); chain.rotation.z = 0.25;
  return group(r, glass, chain);
}, { parent: "head" });
item("acc", "cape", "Royal cape", "🦸", null, ["royal", "fantasy"], 2, () => {
  const red = mat(0xb5121b, { roughness: 0.7, side: THREE.DoubleSide });
  const cape = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.42, 1.05, 32, 6, true, Math.PI - 1.35, 2.7), red);
  cape.position.set(0, 0.97, -0.03);
  cape.scale.z = 0.75;
  cape.userData.sway = true;
  const trim = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 10, 30), mat(0xf8f9fa, { roughness: 1 }));
  trim.position.y = 1.52; trim.rotation.x = Math.PI / 2;
  return group(cape, trim);
});
item("acc", "wings", "Angel wings", "🪽", null, ["fantasy", "cute"], 2, () => {
  const w = mat(0xffffff, { roughness: 0.9 });
  const wings = mirror((s) => {
    const g = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const f = ell(0.05, 0.16 - i * 0.012, 0.012, w, V(s * (0.05 + i * 0.05), 0.1 - i * 0.035, 0));
      f.rotation.z = s * (0.5 + i * 0.12);
      g.add(f);
    }
    g.position.set(s * 0.06, 1.32, -0.13);
    g.userData.flap = s;
    return g;
  });
  return group(wings);
});
item("acc", "gpu", "Graphics card", "🖥️", null, ["tech"], 1, () => {
  const g = new THREE.Group();
  const card = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.13), mat(0x212529, { roughness: 0.35, metalness: 0.4 }));
  g.add(card);
  for (const x of [-0.08, 0.06]) {
    const fan = cyl(0.045, 0.045, 0.006, mat(0x343a40), V(x, -0.028, 0), 24);
    const blades = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.002, 0.012), mat(0x868e96));
    blades.position.set(x, -0.032, 0);
    blades.userData.spin = 25;
    g.add(fan, blades);
  }
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.006, 0.006), glow(0xff00aa, 3));
  strip.position.set(0, 0.026, 0.065); strip.userData.hue = true;
  g.add(strip);
  g.position.set(0.32, 0.86, 0.12);
  g.rotation.set(0.2, -0.3, Math.PI / 2 - 0.2);
  return g;
});
item("acc", "scarf", "Chunky scarf", "🧣", null, ["cozy"], 0, () => {
  const m = mat(0xffffff, { map: TEX.stripes("#2f9e44", "#f8f9fa", 6, [4, 1]), roughness: 1 });
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.04, 12, 30), m);
  loop.position.y = 1.53; loop.rotation.x = Math.PI / 2 - 0.15;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.3, 0.025), m);
  tail.position.set(0.06, 1.35, 0.12); tail.rotation.z = 0.08;
  return group(loop, tail);
});
item("acc", "halo", "RGB halo", "😇", null, ["tech", "fantasy"], 2, () => {
  const h = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.012, 10, 48), glow(0xffd43b, 3));
  h.position.y = 0.3; h.rotation.x = Math.PI / 2;
  h.userData.hue = true; h.userData.bob = true;
  return h;
}, { parent: "head" });

/* ------------------------------------------------------------------ *
 * Equipping
 * ------------------------------------------------------------------ */
const DEFAULTS = { hat: "no-hat", eyes: "eyes-natural", makeup: "no-makeup", top: "tee", bottom: "joggers", shoes: "sneakers", acc: [] };
const state = structuredClone(DEFAULTS);
const mounted = {}; // id -> Object3D
const animated = []; // meshes with userData animation flags
let bounce = 0;

function parentFor(it) {
  if (it.parent) return it.parent === "head" ? head : body;
  return ["hat", "eyes", "makeup"].includes(it.cat) ? head : body;
}
function mount(id, pop = true) {
  const it = ITEMS[id];
  const obj = it.build();
  if (!obj) return;
  shadowAll(obj);
  obj.traverse((o) => { if (Object.keys(o.userData).length || o.material?.userData?.scroll) animated.push(o); });
  parentFor(it).add(obj);
  mounted[id] = obj;
  if (pop) {
    if (parentFor(it) === head) { obj.scale.setScalar(0.6); obj.userData.popT = 0; animated.push(obj); }
    else bounce = 1;
  }
}
function unmount(id) {
  const obj = mounted[id];
  if (!obj) return;
  obj.parent.remove(obj);
  const gone = new Set();
  obj.traverse((o) => { gone.add(o); if (o.isMesh) o.geometry.dispose(); });
  for (let i = animated.length - 1; i >= 0; i--) if (gone.has(animated[i])) animated.splice(i, 1);
  delete mounted[id];
}
function applyHair() {
  const hat = ITEMS[state.hat];
  hair.scale.y = hat.hair ?? 1;
}
function equip(cat, id, pop = true) {
  if (cat === "acc") {
    const i = state.acc.indexOf(id);
    if (i >= 0) { state.acc.splice(i, 1); unmount(id); }
    else {
      if (state.acc.length >= MAX_ACC) unmount(state.acc.shift());
      state.acc.push(id);
      mount(id, pop);
    }
  } else {
    if (state[cat] === id) return;
    unmount(state[cat]);
    state[cat] = id;
    mount(id, pop);
  }
  applyHair();
  renderItems();
  updateDrip();
}
function loadState(next) {
  for (const id of Object.keys(mounted)) unmount(id);
  Object.assign(state, structuredClone(next));
  for (const c of CATS) (c.id === "acc" ? state.acc : [state[c.id]]).forEach((id) => mount(id, false));
  bounce = 1;
  applyHair();
  renderItems();
  updateDrip();
}

/* ------------------------------------------------------------------ *
 * Rating
 * ------------------------------------------------------------------ */
const COMBOS = [
  { name: "🚀 Houston, we have drip", need: ["helmet", "spacesuit", "spacepants", "moonboots"], min: 3 },
  { name: "🤵 Red carpet ready", need: ["tux", "suitpants", "oxfords"], min: 3 },
  { name: "🎪 Full circus", need: ["clown", "clownshoes", "clownpants", "propeller", "eyes-googly"], min: 3 },
  { name: "🖥️ Tech lord", need: ["headphones", "gpu", "rgb", "circuit", "eyes-laser", "halo"], min: 3 },
  { name: "👑 His Majesty", need: ["crown", "cape", "goldmask", "goldtops", "armor"], min: 2 },
  { name: "🤠 Yeehaw", need: ["cowboy", "boots", "flannel", "jeans"], min: 3 },
  { name: "👽 Abducted", need: ["eyes-alien", "helmet", "spacesuit", "glitter"], min: 2 },
  { name: "🍌 Peel the vibe", need: ["banana", "chef"], min: 2 },
  { name: "🧸 Cozy king", need: ["hoodie", "joggers", "bunny", "scarf", "beanie"], min: 3 },
  { name: "🛡️ Side quest", need: ["viking", "armor", "kilt", "cape"], min: 3 },
];

function equipped() {
  return [state.hat, state.eyes, state.makeup, state.top, state.bottom, state.shoes, ...state.acc].map((id) => ITEMS[id]);
}
function hsl(hex) { const o = {}; new THREE.Color(hex).getHSL(o); return o; }

function rate() {
  const items = equipped();
  const ids = new Set(items.map((i) => i.id));

  // Effort: how many slots were changed from the default look.
  const changed = CATS.filter((c) => (c.id === "acc" ? state.acc.length > 0 : state[c.id] !== DEFAULTS[c.id])).length;
  const effort = (changed / CATS.length) * 1.5;

  // Cohesion: share of styled items that agree on one style.
  const styled = items.filter((i) => i.style.length);
  const counts = {};
  styled.forEach((i) => i.style.forEach((s) => (counts[s] = (counts[s] || 0) + 1)));
  const [topStyle, topCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || ["none", 0];
  const share = styled.length ? topCount / styled.length : 0;
  const cohesion = 3 * share * Math.min(1, styled.length / 5);

  // Color harmony across the big garments.
  const colors = [state.hat, state.top, state.bottom, state.shoes].map((id) => ITEMS[id].color).filter((c) => c != null);
  const sat = colors.map(hsl).filter((c) => c.s > 0.3 && c.l > 0.15 && c.l < 0.85);
  let color;
  if (sat.length === 0) color = 1.5;
  else if (sat.length === 1) color = 2.1;
  else {
    let sum = 0, n = 0;
    for (let a = 0; a < sat.length; a++) for (let b = a + 1; b < sat.length; b++) {
      let d = Math.abs(sat[a].h - sat[b].h) * 360; d = Math.min(d, 360 - d);
      sum += d < 35 ? 1 : d > 140 && d < 220 ? 1 : d > 100 ? 0.2 : -0.5;
      n++;
    }
    color = 1.0 + (sum / n) * 1.5;
    if (sat.length >= 4) color -= 0.4;
  }
  color = Math.max(0, Math.min(2.5, color));

  // Boldness: fashion rewards risk.
  const boldSum = items.reduce((t, i) => t + i.bold, 0);
  const bold = Math.min(2.5, (boldSum / 11) * 2.5);

  const combos = COMBOS.filter((c) => c.need.filter((id) => ids.has(id)).length >= c.min).map((c) => c.name);
  if (boldSum >= 16) combos.push("🌪️ Absolute chaos");

  const score = Math.max(0, Math.min(10, 0.5 + effort + cohesion + color + bold + combos.length * 0.75));
  return {
    score: Math.round(score * 10) / 10,
    parts: [
      { key: "effort", label: "Effort", v: effort, max: 1.5 },
      { key: "cohesion", label: "Style cohesion", v: cohesion, max: 3 },
      { key: "color", label: "Color harmony", v: color, max: 2.5 },
      { key: "bold", label: "Boldness", v: bold, max: 2.5 },
    ],
    combos, topStyle, boldSum,
  };
}

const TIERS = [
  [9, "Runway legend", ["Carter would post this four times a day.", "This fit has more cores than his PC builds.", "Vogue just called. They want the full build log."]],
  [7.5, "Certified drip", ["Clean. Like a fresh Windows install.", "That's a top-tier spec sheet right there.", "Overclocked and stable. Respect."]],
  [6, "Drip detected", ["Solid mid-range build. Good value.", "It runs, and it runs pretty well.", "Strong fundamentals, needs one more upgrade."]],
  [4, "Mid", ["Very mid. Like stock cooling.", "It boots… barely.", "Default settings energy."]],
  [0, "Fashion emergency", ["Blue screen of fashion.", "Did a GPU pick this outfit in the dark?", "Call tech support. Immediately."]],
];
const ADVICE = {
  effort: "Try changing more slots — the wardrobe is huge.",
  cohesion: "Pick a lane: the pieces are telling different stories.",
  color: "The colors are fighting each other. Try matching tones or true opposites.",
  bold: "Too safe. Go weirder — the judges love a risk.",
};

function verdict(r) {
  const [, title, lines] = TIERS.find(([min]) => r.score >= min);
  const line = lines[Math.floor(Math.random() * lines.length)];
  const weakest = r.parts.slice().sort((a, b) => a.v / a.max - b.v / b.max)[0];
  const tip = r.score >= 9.5 ? "" : " " + ADVICE[weakest.key];
  const style = r.topStyle !== "none" && r.parts[1].v / 3 > 0.6 ? ` Strong ${r.topStyle} energy.` : "";
  return { title, quote: `“${line}”${style}${tip}` };
}

/* ------------------------------------------------------------------ *
 * UI
 * ------------------------------------------------------------------ */
const $ = (s) => document.querySelector(s);
const tabsEl = $("#tabs"), itemsEl = $("#items"), hintEl = $("#hint");
let activeCat = "top";
try { activeCat = localStorage.getItem("duc-tab") || "top"; } catch {}
if (!BY_CAT[activeCat]) activeCat = "top";

function renderTabs() {
  tabsEl.innerHTML = "";
  for (const c of CATS) {
    const b = document.createElement("button");
    b.textContent = c.label;
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", String(c.id === activeCat));
    b.onclick = () => {
      activeCat = c.id;
      try { localStorage.setItem("duc-tab", c.id); } catch {}
      renderTabs(); renderItems();
    };
    tabsEl.appendChild(b);
  }
}
function renderItems() {
  const cat = CATS.find((c) => c.id === activeCat);
  hintEl.textContent = cat.hint;
  itemsEl.innerHTML = "";
  for (const it of BY_CAT[activeCat]) {
    const on = activeCat === "acc" ? state.acc.includes(it.id) : state[activeCat] === it.id;
    const b = document.createElement("button");
    b.className = "item";
    b.setAttribute("aria-pressed", String(on));
    b.title = it.style.length ? `Style: ${it.style.join(", ")}` : it.name;
    b.innerHTML = `<span class="emo">${it.emo}</span><span>${it.name}</span>` +
      (it.color != null ? `<span class="sw" style="background:#${it.color.toString(16).padStart(6, "0")}"></span>` : "") +
      (it.bold ? `<span class="bold">${"🔥".repeat(it.bold)}</span>` : "");
    b.onclick = () => equip(activeCat, it.id);
    itemsEl.appendChild(b);
  }
}
function updateDrip() {
  const r = rate();
  $("#dripNum").textContent = r.score.toFixed(1);
  $("#dripFill").style.width = r.score * 10 + "%";
}

function randomize() {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const next = {};
  for (const c of CATS) {
    if (c.id === "acc") {
      const pool = BY_CAT.acc.map((i) => i.id).sort(() => Math.random() - 0.5);
      next.acc = pool.slice(0, Math.floor(Math.random() * 3));
    } else next[c.id] = pick(BY_CAT[c.id]).id;
  }
  loadState(next);
}

function showRating() {
  const r = rate();
  const v = verdict(r);
  $("#resTitle").textContent = v.title;
  $("#resQuote").textContent = v.quote;
  const full = Math.round(r.score / 2 * 2) / 2;
  $("#resStars").textContent = "★".repeat(Math.floor(full)) + (full % 1 ? "⯪" : "") + "☆".repeat(5 - Math.ceil(full));
  $("#resBreakdown").innerHTML = r.parts.map((p) =>
    `<div class="brow"><span>${p.label}</span><div class="bar"><i style="width:0"></i></div><span>${p.v.toFixed(1)}/${p.max}</span></div>`).join("");
  $("#resCombos").innerHTML = r.combos.map((c) => `<span class="chip">${c} +0.75</span>`).join("") ||
    `<span class="muted" style="font-size:.8rem">No combos yet — try matching a full theme.</span>`;
  $("#overlay").hidden = false;
  requestAnimationFrame(() => {
    document.querySelectorAll(".brow i").forEach((el, i) => (el.style.width = (r.parts[i].v / r.parts[i].max) * 100 + "%"));
  });
  // count up
  const el = $("#resScore"), t0 = performance.now();
  (function tick(t) {
    const k = Math.min(1, (t - t0) / 900);
    el.textContent = (r.score * (1 - (1 - k) ** 3)).toFixed(1);
    if (k < 1) requestAnimationFrame(tick);
  })(t0);
  if (r.score >= 8) confetti();
  $("#closeRes").focus();
}

$("#randomBtn").onclick = randomize;
$("#resetBtn").onclick = () => loadState(DEFAULTS);
$("#rateBtn").onclick = showRating;
$("#closeRes").onclick = () => ($("#overlay").hidden = true);
$("#overlay").onclick = (e) => { if (e.target.id === "overlay") $("#overlay").hidden = true; };
addEventListener("keydown", (e) => { if (e.key === "Escape") $("#overlay").hidden = true; });

let faceView = false;
const VIEWS = {
  full: { target: V(0, 1.0, 0), dist: 3.5 },
  face: { target: V(0, 1.78, 0), dist: 0.95 },
};
let viewAnim = null;
$("#viewBtn").onclick = (e) => {
  faceView = !faceView;
  e.currentTarget.setAttribute("aria-pressed", String(faceView));
  const v = VIEWS[faceView ? "face" : "full"];
  const dir = camera.position.clone().sub(controls.target).normalize();
  dir.y = Math.max(-0.1, Math.min(0.35, dir.y));
  dir.normalize();
  viewAnim = { t: 0, fromT: controls.target.clone(), toT: v.target, fromP: camera.position.clone(), toP: v.target.clone().addScaledVector(dir, v.dist) };
};
$("#spinBtn").onclick = (e) => {
  controls.autoRotate = !controls.autoRotate;
  e.currentTarget.setAttribute("aria-pressed", String(controls.autoRotate));
};

/* ------------------------------------------------------------------ *
 * Confetti
 * ------------------------------------------------------------------ */
const cc = $("#confetti"), cx = cc.getContext("2d");
let bits = [];
function confetti() {
  cc.width = innerWidth; cc.height = innerHeight;
  const cols = ["#ff6b6b", "#fcc419", "#51cf66", "#4dabf7", "#cc5de8", "#ffffff"];
  bits = Array.from({ length: 160 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 200, y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4,
    r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, w: 6 + Math.random() * 6, c: cols[Math.floor(Math.random() * cols.length)],
  }));
  requestAnimationFrame(drawConfetti);
}
function drawConfetti() {
  cx.clearRect(0, 0, cc.width, cc.height);
  bits = bits.filter((b) => b.y < cc.height + 20);
  for (const b of bits) {
    b.vy += 0.35; b.vx *= 0.99; b.x += b.vx; b.y += b.vy; b.r += b.vr;
    cx.save(); cx.translate(b.x, b.y); cx.rotate(b.r); cx.fillStyle = b.c; cx.fillRect(-b.w / 2, -3, b.w, 6); cx.restore();
  }
  if (bits.length) requestAnimationFrame(drawConfetti);
  else cx.clearRect(0, 0, cc.width, cc.height);
}

/* ------------------------------------------------------------------ *
 * Loop
 * ------------------------------------------------------------------ */
function resize() {
  const { clientWidth: w, clientHeight: h } = stage;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
resize();

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // idle: breathing + head sway
  const breathe = 1 + Math.sin(t * 1.6) * 0.012;
  body.userData.torso.scale.set(TORSO.sx * breathe, 1, TORSO.sz * breathe);
  head.rotation.y = Math.sin(t * 0.5) * 0.12;
  head.rotation.z = Math.sin(t * 0.7) * 0.03;
  head.position.y = HEAD_Y + Math.sin(t * 1.6) * 0.003;

  if (bounce > 0) {
    bounce = Math.max(0, bounce - dt * 2.2);
    character.position.y = Math.sin((1 - bounce) * Math.PI) * 0.06;
  }

  for (const o of animated) {
    const u = o.userData;
    if (u.popT !== undefined) {
      u.popT += dt / 0.35;
      const k = Math.min(1, u.popT);
      o.scale.setScalar(0.6 + 0.4 * (1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2));
      if (k >= 1) { o.scale.setScalar(1); delete u.popT; }
    }
    if (u.spin) o.rotation.y += u.spin * dt;
    if (u.spinZ) o.rotation.z += u.spinZ * dt;
    if (u.flap) o.rotation.y = u.flap * (0.25 + Math.sin(t * 3) * 0.25);
    if (u.sway) o.rotation.x = Math.sin(t * 1.3) * 0.04;
    if (u.bob) o.position.y = 0.3 + Math.sin(t * 2) * 0.01;
    if (u.pulse) { const s = 0.015 * (1 + Math.sin(t * 6) * 0.15); o.scale.set(s, s, s); }
    if (u.flicker) o.material.opacity = 0.55 + Math.random() * 0.35;
    if (u.hue) { o.material.color.setHSL((t * 0.2) % 1, 1, 0.55); o.material.emissive.copy(o.material.color); }
    if (u.googly) {
      o.position.x = u.googly.base.x + Math.sin(t * 7 + u.googly.phase) * 0.008;
      o.position.y = u.googly.base.y + Math.cos(t * 5.3 + u.googly.phase) * 0.008;
    }
    if (o.material?.userData?.scroll) o.material.userData.scroll.offset.y = t * 0.15;
  }

  if (viewAnim) {
    viewAnim.t = Math.min(1, viewAnim.t + dt / 0.6);
    const k = 1 - (1 - viewAnim.t) ** 3;
    controls.target.lerpVectors(viewAnim.fromT, viewAnim.toT, k);
    camera.position.lerpVectors(viewAnim.fromP, viewAnim.toP, k);
    if (viewAnim.t >= 1) viewAnim = null;
  }

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

renderTabs();
loadState(DEFAULTS);
frame();
