// Dress Up Carter — a 3D dress-up game starring a realistic CarterPCs figure.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

/* ------------------------------------------------------------------ *
 * Scene setup — studio lighting with an environment map for real reflections
 * ------------------------------------------------------------------ */
const stage = document.querySelector("#stage");
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(32, 1, 0.02, 50);
camera.position.set(0.9, 1.45, 3.6);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.0, 0);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 0.35;
controls.maxDistance = 6;
controls.maxPolarAngle = Math.PI * 0.62;
controls.autoRotateSpeed = 1.6;

scene.add(new THREE.HemisphereLight(0xf2f4ff, 0x4a3b33, 0.25));
const key = new THREE.DirectionalLight(0xfff0e0, 2.6);
key.position.set(1.8, 3.6, 3);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -1.2; key.shadow.camera.right = 1.2;
key.shadow.camera.top = 2.2; key.shadow.camera.bottom = -0.3;
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.01;
scene.add(key);
const rim = new THREE.DirectionalLight(0xa8c0ff, 1.6);
rim.position.set(-2.5, 2.4, -2.5);
scene.add(rim);
const fill = new THREE.DirectionalLight(0xffd9c0, 0.5);
fill.position.set(-2, 1.4, 2);
scene.add(fill);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(1.4, 64),
  new THREE.MeshStandardMaterial({ color: 0x2b2d42, roughness: 0.85 })
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
 * Helpers
 * ------------------------------------------------------------------ */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const Zf = V(0, 0, 1);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const sm = (e0, e1, v) => { const t = clamp01((v - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const gauss = (x, y, cx, cy, sx, sy) => Math.exp(-(((x - cx) ** 2) / (2 * sx * sx) + ((y - cy) ** 2) / (2 * sy * sy)));
function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; }
const hash3 = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };

function mat(color, o = {}) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.75, metalness: 0, sheen: 0.35, sheenRoughness: 0.8, sheenColor: new THREE.Color(color ?? 0xffffff), ...o });
}
const metal = (color, rough = 0.3) => new THREE.MeshStandardMaterial({ color, metalness: 0.9, roughness: rough });
const glow = (color, k = 1.6) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: k, roughness: 0.4 });
const black = new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.2 });

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
  // fine skin grain used as a bump map on the body
  skinGrain: () => canvasTex((g, s) => {
    const img = g.createImageData(s, s), r = rng(3);
    for (let i = 0; i < s * s; i++) { const v = 118 + r() * 20; img.data.set([v, v, v, 255], i * 4); }
    g.putImageData(img, 0, 0);
  }, [8, 8]),
};

function irisTex(inner, outer, { slit = false, pupil = 0.34 } = {}) {
  return canvasTex((g, s) => {
    const c = s / 2;
    g.fillStyle = "#000"; g.fillRect(0, 0, s, s);
    const grad = g.createRadialGradient(c, c, s * 0.12, c, c, s * 0.5);
    grad.addColorStop(0, inner); grad.addColorStop(0.55, outer); grad.addColorStop(0.92, outer); grad.addColorStop(1, "#050302");
    g.fillStyle = grad; g.beginPath(); g.arc(c, c, s * 0.5, 0, 7); g.fill();
    const r = rng(17);
    for (let i = 0; i < 260; i++) {
      const a = r() * Math.PI * 2, r0 = s * (0.16 + r() * 0.1), r1 = s * (0.36 + r() * 0.12);
      g.strokeStyle = r() > 0.5 ? "rgba(255,230,200,0.12)" : "rgba(0,0,0,0.22)";
      g.lineWidth = 1 + r() * 1.5;
      g.beginPath(); g.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0); g.lineTo(c + Math.cos(a + (r() - 0.5) * 0.15) * r1, c + Math.sin(a) * r1); g.stroke();
    }
    g.strokeStyle = "rgba(10,6,4,0.85)"; g.lineWidth = s * 0.05;
    g.beginPath(); g.arc(c, c, s * 0.47, 0, 7); g.stroke();
    g.fillStyle = "#020101";
    g.beginPath();
    slit ? g.ellipse(c, c, s * 0.05, s * 0.36, 0, 0, 7) : g.arc(c, c, s * pupil * 0.5, 0, 7);
    g.fill();
  }, [1, 1], 256);
}

/* ---------- Geometry ---------- */
// Smooth tapered limb ("muscle") between two points, radii sampled evenly along the bone.
function taperLimb(a, b, radii, m, ex = 0) {
  const d = b.clone().sub(a), len = d.length();
  const n = radii.length, r0 = radii[0] + ex, rN = radii[n - 1] + ex;
  const pts = [new THREE.Vector2(0.0005, -r0 * 0.75)];
  for (let k = 1; k <= 4; k++) { const an = (k / 5) * Math.PI / 2; pts.push(new THREE.Vector2(r0 * Math.sin(an), -r0 * 0.75 * Math.cos(an))); }
  radii.forEach((r, i) => pts.push(new THREE.Vector2(r + ex, (i / (n - 1)) * len)));
  for (let k = 1; k <= 4; k++) { const an = (k / 5) * Math.PI / 2; pts.push(new THREE.Vector2(rN * Math.cos(an), len + rN * 0.75 * Math.sin(an))); }
  pts.push(new THREE.Vector2(0.0005, len + rN * 0.75));
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(pts, 24), m);
  mesh.position.copy(a);
  mesh.quaternion.setFromUnitVectors(UP, d.normalize());
  return mesh;
}
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
 * Anatomy — slim, ~1.83 m, realistic 7.5-head proportions
 * ------------------------------------------------------------------ */
const SKIN = new THREE.Color(0x74503f);
const HAIR = 0x120b07;
const skinGrain = TEX.skinGrain();
const skin = new THREE.MeshPhysicalMaterial({
  color: SKIN, roughness: 0.52, sheen: 0.45, sheenRoughness: 0.55, sheenColor: new THREE.Color(0xc0705a),
  clearcoat: 0.08, clearcoatRoughness: 0.6, bumpMap: skinGrain, bumpScale: 0.6,
});
const faceSkin = new THREE.MeshPhysicalMaterial({
  color: 0xffffff, vertexColors: true, roughness: 0.48, sheen: 0.45, sheenRoughness: 0.55, sheenColor: new THREE.Color(0xc0705a),
  clearcoat: 0.12, clearcoatRoughness: 0.5,
});

const HEAD_Y = 1.705;
const J = {};
for (const s of [-1, 1]) {
  const k = s < 0 ? "L" : "R";
  J["shoulder" + k] = V(0.19 * s, 1.44, -0.005);
  J["elbow" + k] = V(0.235 * s, 1.165, -0.03);
  J["wrist" + k] = V(0.255 * s, 0.925, 0.0);
  J["hand" + k] = V(0.26 * s, 0.86, 0.01);
  J["hip" + k] = V(0.088 * s, 0.9, 0);
  J["knee" + k] = V(0.092 * s, 0.5, 0.012);
  J["ankle" + k] = V(0.09 * s, 0.085, -0.01);
  J["foot" + k] = V(0.092 * s, 0.035, 0.035);
}
const RAD = {
  upper: [0.046, 0.049, 0.046, 0.04, 0.036],
  fore: [0.037, 0.041, 0.038, 0.031, 0.026],
  thigh: [0.08, 0.076, 0.068, 0.058, 0.05],
  shin: [0.05, 0.055, 0.051, 0.04, 0.032, 0.03],
  neck: [0.054, 0.049, 0.046, 0.046, 0.045],
};

// Torso cross-sections: [y, half-width, half-depth, chest-forward bulge]
const TK = [
  [0.82, 0.15, 0.095, 0], [0.9, 0.163, 0.103, 0], [0.98, 0.155, 0.1, 0.004], [1.06, 0.138, 0.094, 0.006],
  [1.14, 0.142, 0.098, 0.01], [1.24, 0.153, 0.104, 0.016], [1.32, 0.162, 0.108, 0.02], [1.4, 0.164, 0.102, 0.014],
  [1.46, 0.158, 0.084, 0.004], [1.505, 0.122, 0.066, 0], [1.54, 0.075, 0.056, 0], [1.58, 0.058, 0.05, 0],
];
function profile(y) {
  let i = 0;
  while (i < TK.length - 2 && y > TK[i + 1][0]) i++;
  const p0 = TK[Math.max(0, i - 1)], p1 = TK[i], p2 = TK[i + 1], p3 = TK[Math.min(TK.length - 1, i + 2)];
  const t = clamp01((y - p1[0]) / (p2[0] - p1[0]));
  const cr = (k) => {
    const a = p0[k], b = p1[k], c = p2[k], d = p3[k];
    return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  };
  return { w: cr(1), d: cr(2), bf: Math.max(0, cr(3)) };
}
// Front surface z of the torso at a given height (+ clothing thickness).
const FZ = (y, ex = 0.02) => { const p = profile(y); return p.d + p.bf + ex; };

function torsoGeo(y0, y1, ex = 0, rows = 48, segs = 48) {
  const pos = [], uv = [], idx = [];
  const n = 2.5;
  for (let r = 0; r <= rows; r++) {
    const y = y0 + ((y1 - y0) * r) / rows;
    const { w, d, bf } = profile(y);
    for (let j = 0; j <= segs; j++) {
      const a = (j / segs) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      const x = (w + ex) * Math.sign(c) * Math.abs(c) ** (2 / n);
      let z = (d + ex) * Math.sign(s) * Math.abs(s) ** (2 / n);
      if (s > 0) z += bf * s * s;
      // subtle spine groove and shoulder blades on the back
      if (s < 0) z += 0.006 * Math.exp(-(c * c) / 0.004) * sm(0.95, 1.3, y) - 0.004 * gauss(Math.abs(c), y, 0.45, 1.36, 0.15, 0.06);
      pos.push(x, y, z);
      uv.push(j / segs, r / rows);
    }
  }
  for (let r = 0; r < rows; r++) for (let j = 0; j < segs; j++) {
    const a = r * (segs + 1) + j, b = a + segs + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // weld the seam normals
  const nr = g.attributes.normal;
  for (let r = 0; r <= rows; r++) {
    const a = r * (segs + 1), b = a + segs;
    const nx = (nr.getX(a) + nr.getX(b)) / 2, ny = (nr.getY(a) + nr.getY(b)) / 2, nz = (nr.getZ(a) + nr.getZ(b)) / 2;
    nr.setXYZ(a, nx, ny, nz); nr.setXYZ(b, nx, ny, nz);
  }
  return g;
}

/* ---------- Sculpted head ---------- */
const HB = { x: 0.075, y: 0.108, z: 0.098 }; // base head radii
const EYE = { x: 0.032, y: 0.022 };
const EYE_R = 0.0122;
const smile = (x) => 5 * x * x;

function shapeHead(d) {
  let x = d.x * HB.x, y = d.y * HB.y, z = d.z * HB.z;
  if (d.z > 0) {
    // a real face is close to a vertical plane: forehead, nose, lips and chin stack up
    const yn = y / HB.y, flat = HB.z * (1 - Math.sqrt(Math.max(0, 1 - yn * yn)));
    z += flat * 0.72 * sm(0.0, 0.55, d.z) * sm(0.105, 0.055, y) * sm(-0.106, -0.072, y);
  }
  if (z < 0) z *= 1 + 0.12 * sm(-0.03, 0.05, y);          // occipital bulge
  const low = sm(0.0, -0.1, y);
  x *= 1 - 0.16 * low;                                      // narrower jaw
  if (z < 0) z *= 1 - 0.4 * sm(-0.02, -0.1, y);             // tuck into the neck
  const front = sm(0.1, 0.6, d.z);
  const ax = Math.abs(x);
  let dz = 0;
  dz += 0.006 * gauss(ax, y, 0.028, 0.043, 0.022, 0.008);   // brow ridge
  dz -= 0.012 * gauss(ax, y, EYE.x, EYE.y, 0.013, 0.009);   // eye sockets
  dz += 0.005 * gauss(ax, y, 0.047, -0.006, 0.014, 0.014);  // cheekbones
  const bridge = sm(0.032, -0.03, y) * (y > -0.042 ? 1 : 0);
  dz += (0.003 + 0.007 * sm(0.03, -0.028, y)) * Math.exp(-(x * x) / (2 * 0.0075 ** 2)) * bridge; // nose bridge
  dz += 0.0095 * gauss(x, y, 0, -0.03, 0.0115, 0.0095);     // broad nose tip
  dz += 0.0085 * gauss(ax, y, 0.0185, -0.034, 0.0075, 0.0065); // nostril wings
  const ys = y - smile(x);
  dz += 0.0025 * gauss(x, y, 0, -0.05, 0.02, 0.011);         // upper-lip area
  dz += 0.0055 * gauss(x, ys, 0, -0.0555, 0.0128, 0.0032);   // upper lip
  dz += 0.0065 * gauss(x, ys, 0, -0.0668, 0.0118, 0.0042);   // lower lip
  dz -= 0.0045 * gauss(x, ys, 0, -0.0608, 0.0155, 0.0011);   // lip line
  dz -= 0.0035 * gauss(x, y, 0, -0.0765, 0.014, 0.0028);     // under-lip crease
  dz += 0.009 * gauss(x, y, 0, -0.09, 0.016, 0.011);         // chin
  z += dz * front;
  x += Math.sign(x) * (0.006 * gauss(ax, y, 0.058, -0.062, 0.012, 0.018) + 0.003 * gauss(ax, y, 0.05, -0.005, 0.012, 0.014)) * sm(-0.2, 0.3, d.z);
  return V(x, y, z);
}

function hairline(d) {
  const fz = d.z / (Math.hypot(d.x, d.z) + 1e-6);
  const wobble = 0.0025 * Math.sin(d.x * 60) + 0.0015 * Math.sin(d.x * 140 + 1);
  return 0.014 + 0.048 * sm(0.35, 0.92, fz) + 0.009 * Math.exp(-((fz - 0.78) ** 2) / 0.006)
    - 0.075 * sm(0.0, 0.85, -fz) - 0.022 * Math.exp(-((fz - 0.45) ** 2) / 0.02) + wobble * sm(0.5, 0.9, fz);
}
function hairThick(d, p) {
  const fz = d.z / (Math.hypot(d.x, d.z) + 1e-6);
  let t = 0.004 + 0.044 * sm(0.3, 0.95, d.y) + 0.008 * sm(0.5, 0.9, fz) * sm(0.3, 0.75, d.y);
  t *= 1 - 0.55 * sm(0, 0.8, -fz) * sm(0.85, 0.3, d.y);
  t *= 0.25 + 0.75 * sm(0, 0.045, p.y - hairline(d));        // short taper near the hairline
  return Math.max(0.003, t);
}
const hairNormal = (p) => V(p.x / HB.x ** 2, p.y / HB.y ** 2, p.z / HB.z ** 2).normalize();

function headColor(p, d, out) {
  const ax = Math.abs(p.x), front = sm(0.2, 0.6, d.z);
  const c = SKIN.clone();
  c.lerp(new THREE.Color(0x9a5a3f), 0.18 * front * (gauss(ax, p.y, 0.045, -0.015, 0.02, 0.02) + gauss(p.x, p.y, 0, -0.03, 0.012, 0.01)));
  c.multiplyScalar(1 - 0.16 * front * gauss(ax, p.y, EYE.x, EYE.y - 0.006, 0.016, 0.009));     // under-eye shadow
  c.multiplyScalar(1 + 0.06 * front * gauss(p.x, p.y, 0, 0.06, 0.03, 0.02));                     // forehead sheen
  const ys = p.y - smile(p.x);
  const lipU = gauss(p.x, ys, 0, -0.0555, 0.0145, 0.0042), lipL = gauss(p.x, ys, 0, -0.0665, 0.0135, 0.0052);
  c.lerp(new THREE.Color(0x4f251d), sm(0.35, 0.7, lipU) * front);
  c.lerp(new THREE.Color(0x6a3528), sm(0.35, 0.7, lipL) * front);
  c.lerp(new THREE.Color(0x2a120d), 0.8 * front * gauss(p.x, ys, 0, -0.0608, 0.0145, 0.0009)); // mouth line
  c.lerp(new THREE.Color(0x24130c), 0.75 * front * gauss(ax, p.y, 0.0085, -0.0385, 0.0035, 0.0022));   // nostrils
  // light moustache + chin stubble
  const stub = Math.max(gauss(p.x, p.y, 0, -0.046, 0.024, 0.004) * (ax < 0.03 ? 1 : 0), gauss(p.x, p.y, 0, -0.092, 0.018, 0.012));
  c.lerp(new THREE.Color(0x2e1b12), 0.35 * stub * front);
  // dark scalp under the hair, soft at the hairline
  c.lerp(new THREE.Color(0x1d120c), 0.85 * sm(-0.006, 0.008, p.y - hairline(d)));
  c.multiplyScalar(0.97 + hash3(p.x * 900, p.y * 900, p.z * 900) * 0.06);
  out.copy(c);
}

function buildHeadGeo() {
  let g = new THREE.SphereGeometry(1, 280, 210);
  g.deleteAttribute("uv"); g.deleteAttribute("normal");
  g = mergeVertices(g);
  const pos = g.attributes.position, n = pos.count;
  const dirs = new Float32Array(n * 3), cols = new Float32Array(n * 3);
  const d = V(0, 0, 0), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    d.fromBufferAttribute(pos, i).normalize();
    const p = shapeHead(d);
    pos.setXYZ(i, p.x, p.y, p.z);
    dirs.set([d.x, d.y, d.z], i * 3);
    headColor(p, d, c);
    cols.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute("dir", new THREE.BufferAttribute(dirs, 3));
  g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  g.computeVertexNormals();
  return g;
}
const headGeo = buildHeadGeo();
const probe = new THREE.Mesh(headGeo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
probe.updateMatrixWorld();
const caster = new THREE.Raycaster();

// Surface point + outward normal on the face, found by casting a ray from the front.
const hitCache = new Map();
function hitFace(x, y) {
  const k = Math.round(x * 2000) + "," + Math.round(y * 2000);
  let h = hitCache.get(k);
  if (!h) {
    caster.set(V(x, y, 0.3), V(0, 0, -1));
    const r = caster.intersectObject(probe)[0];
    h = r ? { p: r.point, n: r.face.normal.clone().normalize() } : { p: V(x, y, 0.08), n: Zf.clone() };
    hitCache.set(k, h);
  }
  return { p: V(x, y, h.p.z), n: h.n.clone() };
}
function surf(x, y, push = 0) { const { p, n } = hitFace(x, y); return p.addScaledVector(n, push); }
function decal(geom, x, y, m, push = 0.0008, rotZ = 0) {
  const { p, n } = hitFace(x, y);
  const mesh = new THREE.Mesh(geom, m);
  mesh.position.copy(p).addScaledVector(n, push);
  mesh.quaternion.setFromUnitVectors(Zf, n);
  mesh.rotateZ(rotZ);
  return mesh;
}
// A skin-tight patch of the head surface (masks, hair caps), pushed out along the normals.
function headPatch(keep, offset, m) {
  const pos = headGeo.attributes.position, nor = headGeo.attributes.normal, dir = headGeo.attributes.dir, n = pos.count;
  const out = new Float32Array(n * 3), ok = new Uint8Array(n);
  const p = V(0, 0, 0), q = V(0, 0, 0), d = V(0, 0, 0);
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(pos, i); q.fromBufferAttribute(nor, i); d.fromBufferAttribute(dir, i);
    ok[i] = keep(p, d) ? 1 : 0;
    p.addScaledVector(q, offset(p, d));
    out.set([p.x, p.y, p.z], i * 3);
  }
  const src = headGeo.index.array, idx = [];
  for (let i = 0; i < src.length; i += 3) if (ok[src[i]] && ok[src[i + 1]] && ok[src[i + 2]]) idx.push(src[i], src[i + 1], src[i + 2]);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(out, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return new THREE.Mesh(g, m);
}

const EYE_C = [-1, 1].map((s) => { const z = hitFace(s * EYE.x, EYE.y).p.z; return V(s * EYE.x, EYE.y, z - EYE_R * 0.5); });
const socket = (s) => EYE_C[s < 0 ? 0 : 1].clone();

/* ------------------------------------------------------------------ *
 * Character
 * ------------------------------------------------------------------ */
const character = new THREE.Group();
scene.add(character);
const body = new THREE.Group();
character.add(body);
const head = new THREE.Group();
head.position.y = HEAD_Y;
character.add(head);
const lids = [];

function hand(s) {
  const g = new THREE.Group();
  const w = J[s < 0 ? "wristL" : "wristR"];
  g.position.copy(w);
  g.add(ell(0.013, 0.045, 0.036, skin, V(0, -0.045, 0.004)));                 // palm
  const fingers = [[-0.022, 0.07], [-0.0075, 0.08], [0.0075, 0.077], [0.022, 0.064]];
  for (const [fz, len] of fingers) {
    const base = V(-s * 0.002, -0.085, fz);
    const mid = base.clone().add(V(-s * 0.006, -len * 0.5, 0.003));
    const tip = mid.clone().add(V(-s * 0.012, -len * 0.42, 0.004));
    g.add(taperLimb(base, mid, [0.0085, 0.008, 0.0075], skin));
    g.add(taperLimb(mid, tip, [0.0074, 0.0068, 0.006], skin));
  }
  const tb = V(-s * 0.006, -0.035, 0.032), tm = tb.clone().add(V(-s * 0.008, -0.03, 0.014)), tt = tm.clone().add(V(-s * 0.008, -0.022, 0.006));
  g.add(taperLimb(tb, tm, [0.012, 0.01, 0.0085], skin), taperLimb(tm, tt, [0.0085, 0.008, 0.007], skin));
  g.rotation.z = s * 0.06;
  return g;
}

function buildBody() {
  const torso = new THREE.Mesh(torsoGeo(0.82, 1.6, 0), skin);
  torso.geometry.translate(0, -1.2, 0);
  torso.position.y = 1.2;
  body.add(torso);
  body.add(ell(0.14, 0.05, 0.088, skin, V(0, 0.83, 0)));
  body.add(taperLimb(V(0, 1.5, -0.008), V(0, 1.665, -0.012), RAD.neck, skin));
  // collarbones
  body.add(...mirror((s) => { const c = taperLimb(V(s * 0.02, 1.515, 0.06), V(s * 0.15, 1.475, 0.035), [0.008, 0.009, 0.008], skin); return c; }));
  for (const k of ["L", "R"]) {
    const s = k === "L" ? -1 : 1;
    const delt = ell(0.05, 0.058, 0.052, skin, J["shoulder" + k].clone().add(V(s * 0.006, -0.014, 0)));
    delt.rotation.z = s * 0.35;
    body.add(delt);
    body.add(taperLimb(J["shoulder" + k], J["elbow" + k], RAD.upper, skin));
    body.add(taperLimb(J["elbow" + k], J["wrist" + k], RAD.fore, skin));
    body.add(hand(s));
    body.add(taperLimb(J["hip" + k], J["knee" + k], RAD.thigh, skin));
    body.add(ell(0.045, 0.05, 0.045, skin, J["knee" + k].clone().add(V(0, 0, 0.012))));
    body.add(taperLimb(J["knee" + k], J["ankle" + k], RAD.shin, skin));
    body.add(ell(0.042, 0.032, 0.1, skin, J["foot" + k]));
  }
  body.userData.torso = torso;
  shadowAll(body);
}

function buildEar(s) {
  const g = new THREE.Group();
  const em = skin;
  g.add(ell(0.008, 0.027, 0.016, em));
  const helix = new THREE.Mesh(new THREE.TorusGeometry(0.0125, 0.0022, 8, 32, Math.PI * 1.5), em);
  helix.rotation.set(0, Math.PI / 2, Math.PI * 0.6);
  helix.scale.set(1, 1.8, 0.6);
  helix.position.set(0.004, 0.003, -0.001);
  g.add(helix);
  g.add(ell(0.0055, 0.008, 0.007, em, V(0.002, -0.024, 0.002)));            // lobe
  g.add(ell(0.003, 0.011, 0.007, new THREE.MeshStandardMaterial({ color: SKIN.clone().multiplyScalar(0.55), roughness: 0.7 }), V(0.0065, -0.002, 0.002))); // concha
  g.position.set(s * 0.071, 0.0, -0.014);
  g.rotation.y = s * 0.25;
  g.scale.x = s;
  return g;
}

function buildHead() {
  const face = new THREE.Mesh(headGeo, faceSkin);
  head.add(face);
  head.add(buildEar(-1), buildEar(1));
  // stud earring
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.0035, 14, 10), metal(0xf1f3f5, 0.08)).translateX(-0.081).translateY(-0.023).translateZ(-0.008));

  // Eyelids + lash line (they blink)
  const lidSkin = new THREE.MeshPhysicalMaterial({ color: SKIN.clone().multiplyScalar(0.88), roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0xc0705a), side: THREE.DoubleSide });
  const lash = new THREE.MeshStandardMaterial({ color: 0x080504, roughness: 0.8, side: THREE.DoubleSide });
  // Almond-shaped lids: the lid edge follows a curve instead of a straight cut.
  const upperEdge = (s) => 1.3 + 0.45 * (1 - s) ** 1.4;
  const lowerEdge = (s) => 1.9 - 0.32 * (1 - s) ** 1.4;
  function lidGeo(r, from, to, phi0 = 0, phi1 = Math.PI) {
    const pos = [], idx = [], NP = 40, NV = 10;
    for (let i = 0; i <= NP; i++) {
      const phi = phi0 + ((phi1 - phi0) * i) / NP, sp = Math.sin(phi);
      const t0 = from(sp), t1 = to(sp);
      for (let j = 0; j <= NV; j++) {
        const th = t0 + ((t1 - t0) * j) / NV;
        pos.push(-r * Math.cos(phi) * Math.sin(th), r * Math.cos(th), r * sp * Math.sin(th));
      }
    }
    for (let i = 0; i < NP; i++) for (let j = 0; j < NV; j++) {
      const a = i * (NV + 1) + j, b = a + NV + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  for (const s of [-1, 1]) {
    const c = socket(s);
    const up = new THREE.Group();
    up.add(new THREE.Mesh(lidGeo(EYE_R * 1.1, () => 0, upperEdge), lidSkin));
    up.add(new THREE.Mesh(lidGeo(EYE_R * 1.118, (sp) => upperEdge(sp) - 0.11, upperEdge, 0.2, Math.PI - 0.2), lash));
    up.position.copy(c);
    const lo = new THREE.Group();
    lo.add(new THREE.Mesh(lidGeo(EYE_R * 1.08, lowerEdge, () => Math.PI), lidSkin));
    lo.add(new THREE.Mesh(lidGeo(EYE_R * 1.09, lowerEdge, (sp) => lowerEdge(sp) + 0.06, 0.3, Math.PI - 0.3), lash));
    lo.position.copy(c);
    // slight upward tilt toward the outer corner
    up.rotation.z = lo.rotation.z = s * 0.06;
    head.add(up, lo);
    lids.push(up);
  }

  // Eyebrows: individual hair strands
  const strands = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x0c0705, roughness: 0.9 }), 2 * 110);
  const r = rng(8), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qz = new THREE.Quaternion();
  let k = 0;
  for (const s of [-1, 1]) {
    for (let i = 0; i < 110; i++) {
      const t = r();
      const x = 0.011 + t * 0.042;
      const yc = 0.039 + 0.0065 * Math.sin(Math.PI * Math.min(1, t * 1.25)) - 0.003 * t;
      const spread = 0.0042 * (1 - t) + 0.0018;
      const y = yc + (r() - 0.5) * spread;
      const { p, n } = hitFace(s * x, y);
      p.addScaledVector(n, 0.0012);
      const ang = (1 - t) * 1.1 + 0.15 + (r() - 0.5) * 0.3;
      q.setFromUnitVectors(Zf, n);
      qz.setFromAxisAngle(Zf, s > 0 ? ang : Math.PI - ang);
      q.multiply(qz);
      m4.compose(p, q, V(0.0055 + r() * 0.0025, 0.0008, 0.0008));
      strands.setMatrixAt(k++, m4);
    }
  }
  head.add(strands);
  shadowAll(head);
  buildHair();
  head.add(hair);
}

const hair = new THREE.Group();
function buildHair() {
  const hairMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.6, sheen: 0.5, sheenRoughness: 0.4, sheenColor: new THREE.Color(0x3a2a1f) });
  const capMat = new THREE.MeshStandardMaterial({ color: 0x140c08, roughness: 0.95 });
  const inHair = (p, d) => p.y > hairline(d) - 0.002;
  hair.add(headPatch(inHair, () => 0.0012, capMat));
  hair.add(headPatch((p, d) => p.y > hairline(d) + 0.006, (p, d) => 0.6 * hairThick(d, p), capMat));

  // tight coils — the curly top
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, a = t * Math.PI * 2 * 2.3;
    pts.push(V(Math.cos(a) * 0.0045, Math.sin(a) * 0.0045, t * 0.024 - 0.012));
  }
  const coilGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.0016, 4);
  const N = 3200;
  const coils = new THREE.InstancedMesh(coilGeo, hairMat, N);
  const r = rng(42), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
  let i = 0, guard = 0;
  while (i < N && guard++ < 200000) {
    const d = V(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
    if (d.lengthSq() > 1 || d.lengthSq() < 0.01) continue;
    d.normalize();
    const p = shapeHead(d);
    const fz = d.z / (Math.hypot(d.x, d.z) + 1e-6);
    const below = hairline(d) + 0.002 - p.y;
    // a few loose curls fall onto the forehead
    if (below > 0 && !(fz > 0.75 && below < 0.012 && r() < 0.35)) continue;
    const th = below > 0 ? 0.008 : hairThick(d, p);
    if (r() > 0.25 + th / 0.04) continue;
    const n = hairNormal(p);
    const pos = p.addScaledVector(n, 0.002 + (0.3 + 0.7 * Math.sqrt(r())) * th);
    q.setFromEuler(e.set(r() * 6.3, r() * 6.3, r() * 6.3));
    const sc = (0.6 + r() * 0.45) * (th < 0.012 ? 0.6 : 1);
    m4.compose(pos, q, V(sc, sc, sc));
    coils.setMatrixAt(i, m4);
    c.setHex(HAIR).offsetHSL(0, 0, (r() - 0.6) * 0.02);
    coils.setColorAt(i, c);
    i++;
  }
  coils.count = i;
  coils.castShadow = true;
  hair.add(coils);
}

buildBody();
buildHead();

/* ------------------------------------------------------------------ *
 * Clothing builders (fit to the anatomy above)
 * ------------------------------------------------------------------ */
function torsoShell(m, k = 1.06, y0 = 0.86, y1 = 1.552) {
  const ex = 0.008 + (k - 1) * 0.16;
  const t = new THREE.Mesh(torsoGeo(y0, y1, ex, 40, 40), m);
  return t;
}
function sleeves(m, len = "long", ex = 0.012) {
  const out = [];
  for (const k of ["L", "R"]) {
    const s = k === "L" ? -1 : 1;
    const sh = J["shoulder" + k], el = J["elbow" + k], wr = J["wrist" + k];
    const delt = ell(0.05 + ex * 0.7, 0.058 + ex * 0.7, 0.052 + ex * 0.7, m, sh.clone().add(V(s * 0.006, -0.014, 0)));
    delt.rotation.z = s * 0.35;
    out.push(delt);
    if (len === "short") out.push(taperLimb(sh, sh.clone().lerp(el, 0.5), RAD.upper.slice(0, 3), m, ex));
    if (len === "long" || len === "3q") {
      out.push(taperLimb(sh, el, RAD.upper, m, ex));
      out.push(taperLimb(el, len === "3q" ? el.clone().lerp(wr, 0.55) : wr.clone().lerp(el, 0.04), RAD.fore.slice(0, len === "3q" ? 3 : 5), m, ex));
    }
  }
  return out;
}
function collar(m, r = 0.062, tube = 0.012) {
  const t = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 10, 32), m);
  t.position.set(0, 1.535, 0.004);
  t.rotation.x = Math.PI / 2 - 0.18;
  t.scale.set(1.08, 1, 1);
  return t;
}
function pants(m, len = "long", ex = 0.012) {
  const out = [new THREE.Mesh(torsoGeo(0.8, 1.02, ex + 0.004, 16, 40), m), ell(0.15 + ex, 0.05, 0.095 + ex, m, V(0, 0.83, 0))];
  for (const k of ["L", "R"]) {
    const hp = J["hip" + k], kn = J["knee" + k], an = J["ankle" + k];
    if (len === "shorts") out.push(taperLimb(hp, hp.clone().lerp(kn, 0.8), RAD.thigh.slice(0, 4), m, ex + 0.008));
    else {
      out.push(taperLimb(hp, kn, RAD.thigh, m, ex));
      out.push(taperLimb(kn, an.clone().add(V(0, 0.025, 0)), RAD.shin.map((r) => Math.max(r, 0.04)), m, ex));
    }
  }
  return out;
}
function shoes({ upper, sole = mat(0xf1f3f5), l = 1, w = 1, h = 1, soleH = 0.016, shaft, extra }) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const f = J[s < 0 ? "footL" : "footR"];
    const fz = f.z + 0.012 * (l - 1) * 4;
    const toe = ell(0.047 * w, 0.038 * h, 0.115 * l, upper, V(f.x, 0.042 * h, fz));
    const heel = ell(0.044 * w, 0.05 * h, 0.05, upper, V(f.x, 0.05 * h, f.z - 0.055));
    g.add(toe, heel);
    g.add(ell(0.051 * w, soleH, 0.122 * l, sole, V(f.x, soleH * 0.6, fz)));
    if (shaft) g.add(cyl(shaft.r, shaft.r * 0.95, shaft.top, shaft.m ?? upper, V(f.x, shaft.top / 2 + 0.03, -0.012)));
    if (extra) g.add(extra(s, f));
  }
  return g;
}

/* ------------------------------------------------------------------ *
 * Eyes
 * ------------------------------------------------------------------ */
const sclera = new THREE.MeshPhysicalMaterial({ color: 0xf1e9e1, roughness: 0.3, clearcoat: 0.6 });
const cornea = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0, metalness: 0, transparent: true, opacity: 0.12, clearcoat: 1, clearcoatRoughness: 0, depthWrite: false });
const HOLE = 0.53; // sclera opening for the iris (radians)

function eyeball({ tex, glowK = 0, irisMat } = {}) {
  const g = new THREE.Group();
  const scl = new THREE.Mesh(new THREE.SphereGeometry(EYE_R, 32, 24, 0, Math.PI * 2, HOLE, Math.PI - HOLE), sclera);
  scl.rotation.x = Math.PI / 2;
  g.add(scl);
  const im = irisMat ?? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, emissive: glowK ? 0xffffff : 0, emissiveMap: glowK ? tex : null, emissiveIntensity: glowK });
  const iris = new THREE.Mesh(new THREE.CircleGeometry(EYE_R * Math.sin(HOLE) * 1.02, 40), im);
  iris.position.z = EYE_R * Math.cos(HOLE) - 0.0004;
  g.add(iris);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(EYE_R * 0.62, 24, 12, 0, Math.PI * 2, 0, 0.95), cornea);
  cap.rotation.x = Math.PI / 2;
  cap.position.z = EYE_R * 0.43;
  g.add(cap);
  g.userData.iris = iris;
  return g;
}
function eyePair(opts = {}) {
  const tex = opts.tex ?? irisTex("#7a4a26", "#2b170c");
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const e = eyeball({ tex, ...opts });
    e.position.copy(socket(s));
    e.userData.gaze = true;
    g.add(e);
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
 * Hats and head gear are authored in "hat units" and scaled to the head with HAT_K.
 * ------------------------------------------------------------------ */
const HAT_K = 0.8;
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
  let b = build;
  if (extra.hk) b = () => {
    const o = build(); if (!o) return null;
    const w = group(o); w.scale.setScalar(HAT_K);
    if (extra.hair) w.position.set(0, -0.022, -0.006); // sit down onto the squashed curls
    return w;
  };
  const it = { cat, id, name, emo, color, style, bold, build: b, ...extra };
  ITEMS[id] = it;
  BY_CAT[cat].push(it);
}

/* ---------- Hats ---------- */
item("hat", "no-hat", "No hat", "🚫", null, [], 0, () => null);
item("hat", "fedora", "Woven fedora", "👒", 0xb8b3a5, ["formal", "street"], 0, () => {
  const w = mat(0xffffff, { map: TEX.weave(), sheen: 0 });
  const g = group(
    cyl(0.112, 0.128, 0.1, w, V(0, 0.17, 0)),
    cyl(0.225, 0.225, 0.008, w, V(0, 0.122, 0), 48),
    cyl(0.131, 0.131, 0.026, mat(0x1f2a44), V(0, 0.137, 0)),
  );
  g.rotation.x = -0.08;
  return g;
}, { hair: true, hk: true });
item("hat", "beanie", "Striped beanie", "🧢", 0xe03131, ["street", "cozy"], 0, () => {
  const k = mat(0xffffff, { map: TEX.stripes("#e03131", "#f8f9fa", 8, [1, 1]) });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.15, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), k);
  dome.scale.set(1, 1.05, 1.05);
  dome.position.y = 0.02;
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.148, 0.022, 10, 32), mat(0xe03131));
  cuff.rotation.x = Math.PI / 2; cuff.position.y = 0.03;
  const pom = ell(0.04, 0.04, 0.04, mat(0xf8f9fa, { roughness: 1 }), V(0, 0.19, 0));
  return group(dome, cuff, pom);
}, { hair: true, hk: true });
item("hat", "crown", "Royal crown", "👑", 0xfcc419, ["royal"], 2, () => {
  const gold = metal(0xf2b705, 0.22);
  const band = cyl(0.1, 0.1, 0.055, gold.clone(), V(0, 0.2, 0), 32, true);
  band.material.side = THREE.DoubleSide;
  const g = group(band);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.05, 8), gold);
    spike.position.set(Math.sin(a) * 0.1, 0.25, Math.cos(a) * 0.1);
    g.add(spike);
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), glow([0xe03131, 0x1c7ed6, 0x2f9e44][i % 3], 0.6)).translateX(Math.sin(a) * 0.102).translateY(0.2).translateZ(Math.cos(a) * 0.102));
  }
  g.rotation.z = 0.08;
  return g;
}, { hk: true });
item("hat", "cowboy", "Cowboy hat", "🤠", 0x8b5a2b, ["western"], 1, () => {
  const lea = mat(0x8b5a2b, { roughness: 0.8 });
  const brim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 8, 40), lea);
  brim.rotation.x = Math.PI / 2; brim.scale.set(1, 1.1, 0.12); brim.position.y = 0.13;
  const disc = cyl(0.21, 0.21, 0.006, lea, V(0, 0.122, 0), 40);
  const crown = cyl(0.1, 0.125, 0.13, lea, V(0, 0.19, 0));
  const dent = ell(0.06, 0.02, 0.09, mat(0x6f4520), V(0, 0.255, 0));
  const band = cyl(0.122, 0.126, 0.02, mat(0x2b1a0c), V(0, 0.14, 0));
  return group(brim, disc, crown, dent, band);
}, { hair: true, hk: true });
item("hat", "tophat", "Top hat", "🎩", 0x111111, ["formal"], 1, () => {
  const m = mat(0x141414, { roughness: 0.5 });
  const g = group(cyl(0.1, 0.1, 0.24, m, V(0, 0.25, 0)), cyl(0.17, 0.17, 0.01, m, V(0, 0.13, 0), 40), cyl(0.102, 0.102, 0.03, mat(0x9c1c1c), V(0, 0.15, 0)));
  g.rotation.z = -0.1;
  return g;
}, { hair: true, hk: true });
item("hat", "helmet", "Space helmet", "🧑‍🚀", 0xdfe3ea, ["space"], 2, () => {
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xcfe8ff, roughness: 0.02, metalness: 0.1, transparent: true, opacity: 0.18, clearcoat: 1, depthWrite: false });
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.27, 40, 28), glass);
  bubble.position.y = 0.02;
  const neck = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.03, 12, 36), metal(0xdfe3ea, 0.35));
  neck.rotation.x = Math.PI / 2; neck.position.y = -0.2;
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 10), glow(0x51cf66, 3));
  light.position.set(0.13, -0.19, 0.08);
  return group(bubble, neck, light);
}, { hk: true });
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
}, { hair: true, hk: true });
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
}, { hair: true, hk: true });
item("hat", "cone", "Traffic cone", "🚧", 0xff6a00, ["chaos"], 3, () => {
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.36, 32, 1, true), mat(0xffffff, { map: TEX.coneStripes(), side: THREE.DoubleSide }));
  cone.position.y = 0.3;
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.3), mat(0xff6a00));
  base.position.y = 0.12;
  const g = group(cone, base);
  g.rotation.z = 0.12;
  return g;
}, { hair: true, hk: true });
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
}, { hair: true, hk: true });

/* ---------- Eyes ---------- */
item("eyes", "eyes-natural", "Natural brown", "👁️", null, [], 0, () => eyePair());
item("eyes", "eyes-ice", "Ice blue", "🧊", null, ["cool", "fantasy"], 1, () => eyePair({ tex: irisTex("#cdeeff", "#3d8fd1"), glowK: 0.25 }));
item("eyes", "eyes-alien", "Alien eyes", "👽", null, ["space"], 3, () => {
  const g = new THREE.Group();
  const gloss = new THREE.MeshPhysicalMaterial({ color: 0x030303, roughness: 0.02, clearcoat: 1 });
  for (const s of [-1, 1]) {
    const c = socket(s);
    const e = ell(0.024, 0.013, 0.012, gloss, c.clone().add(V(s * 0.003, 0.001, 0.006)));
    e.rotation.z = s * -0.4;
    g.add(e);
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.0028, 8, 6), glow(0x69db7c, 4)).translateX(c.x + s * 0.006).translateY(c.y + 0.003).translateZ(c.z + 0.017));
  }
  return g;
});
item("eyes", "eyes-laser", "Laser eyes", "🔴", null, ["tech", "chaos"], 3, () => {
  const g = eyePair({ tex: irisTex("#ff9a9a", "#ff1010", { pupil: 0.2 }), glowK: 3 });
  const beam = new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const s of [-1, 1]) {
    const c = socket(s);
    const b = cyl(0.003, 0.003, 3, beam, c.clone().add(V(0, 0, 1.512)), 8);
    b.rotation.x = Math.PI / 2;
    b.userData.flicker = true;
    g.add(b);
  }
  return g;
});
item("eyes", "eyes-heart", "Heart eyes", "😍", null, ["party", "cute"], 2, () => {
  const hm = glow(0xff2d6f, 0.8);
  const g = eyePair({ irisMat: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }) });
  const geo = new THREE.ExtrudeGeometry(heartShape(), { depth: 0.3, bevelEnabled: false });
  g.children.forEach((e) => {
    const h = new THREE.Mesh(geo, hm);
    h.scale.setScalar(0.0062);
    h.position.z = EYE_R * 0.95;
    h.userData.pulse = 0.0062;
    e.add(h);
  });
  return g;
});
item("eyes", "eyes-hypno", "Hypno spirals", "😵‍💫", null, ["circus", "chaos"], 3, () => {
  const g = eyePair({ irisMat: new THREE.MeshBasicMaterial({ map: TEX.spiral() }) });
  g.children.forEach((e, i) => { e.userData.iris.userData.spinZ = i ? 6 : -6; e.userData.gaze = false; });
  return g;
});
item("eyes", "eyes-cat", "Cat eyes", "🐱", null, ["fantasy", "goth"], 2, () => eyePair({ tex: irisTex("#f4ff9a", "#8fbf2a", { slit: true }), glowK: 0.5 }));
item("eyes", "eyes-googly", "Googly eyes", "🤪", null, ["circus", "chaos"], 3, () => {
  const g = eyePair();
  for (const s of [-1, 1]) {
    const c = socket(s).add(V(0, 0.003, EYE_R + 0.004));
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.019, 24, 16), mat(0xffffff, { roughness: 0.1, sheen: 0 }));
    w.position.copy(c); w.scale.z = 0.45;
    g.add(w);
    const p = ell(0.009, 0.009, 0.004, black, c.clone().add(V(0, 0, 0.009)));
    p.userData.googly = { base: p.position.clone(), phase: s * 1.7 };
    g.add(p);
  }
  return g;
});

/* ---------- Makeup ---------- */
item("makeup", "no-makeup", "Clean face", "🚫", null, [], 0, () => null);
item("makeup", "blush", "Rosy blush", "🌸", null, ["cute", "party"], 1, () => {
  const m = new THREE.MeshBasicMaterial({ color: 0xff5a7a, transparent: true, opacity: 0.32, depthWrite: false });
  return group(mirror((s) => decal(new THREE.CircleGeometry(0.014, 24), s * 0.046, -0.018, m, 0.0012)));
});
item("makeup", "freckles", "Freckles", "🟤", null, ["nature", "cute"], 1, () => {
  const m = new THREE.MeshStandardMaterial({ color: 0x3d2216, roughness: 0.6 });
  const r = rng(99), g = new THREE.Group();
  for (let i = 0; i < 46; i++) {
    const x = (r() - 0.5) * 0.11, y = -0.03 + r() * 0.03;
    if (Math.abs(x) < 0.012 && y < -0.022) continue;
    g.add(decal(new THREE.CircleGeometry(0.0013 + r() * 0.0009, 8), x, y, m, 0.0008));
  }
  return g;
});
item("makeup", "eyeliner", "Dramatic wings", "🖋️", null, ["goth", "party"], 1, () => {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const sh = new THREE.Shape();
    sh.moveTo(-1, 0); sh.quadraticCurveTo(0, 0.6, 1, 0.1); sh.lineTo(1.8, 0.7); sh.lineTo(1.05, -0.15); sh.quadraticCurveTo(0, 0.3, -1, 0);
    const m = decal(new THREE.ShapeGeometry(sh), s * (EYE.x + 0.006), EYE.y + 0.006, black, 0.0045);
    m.scale.set(s * 0.012, 0.011, 1);
    g.add(m);
  }
  return g;
});
item("makeup", "glitter", "Glitter stars", "✨", null, ["party", "space"], 2, () => {
  const geo = new THREE.ShapeGeometry(starShape());
  const cols = [0xffd43b, 0xff8cc6, 0x74c0fc, 0xffffff];
  const spots = [[0.05, -0.006, 0.008], [0.058, -0.024, 0.0055], [0.042, -0.032, 0.004], [-0.05, -0.01, 0.007], [-0.045, 0.058, 0.005], [0.024, 0.07, 0.0045], [-0.06, -0.028, 0.005]];
  return group(spots.map(([x, y, s], i) => {
    const m = decal(geo, x, y, glow(cols[i % 4], 1.4), 0.0012, i);
    m.scale.setScalar(s);
    return m;
  }));
});
item("makeup", "bolt", "Lightning bolt", "⚡", null, ["party", "chaos"], 2, () => {
  const m = decal(new THREE.ShapeGeometry(boltShape()), -EYE.x, EYE.y - 0.004, mat(0xe03131, { emissive: 0x7a0000, emissiveIntensity: 0.4, sheen: 0 }), 0.009, 0.1);
  m.scale.set(0.03, 0.045, 1);
  const inner = decal(new THREE.ShapeGeometry(boltShape()), -EYE.x, EYE.y - 0.004, mat(0x1c7ed6, { sheen: 0 }), 0.0095, 0.1);
  inner.scale.set(0.017, 0.03, 1);
  return group(m, inner);
});
item("makeup", "clown", "Clown face", "🤡", null, ["circus"], 3, () => {
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.017, 20, 14), new THREE.MeshPhysicalMaterial({ color: 0xe00000, roughness: 0.15, clearcoat: 1 }));
  nose.position.copy(surf(0, -0.03, 0.006));
  const dia = new THREE.Shape(); dia.moveTo(0, 1); dia.lineTo(0.5, 0); dia.lineTo(0, -1); dia.lineTo(-0.5, 0);
  const blue = mat(0x1c7ed6, { roughness: 0.4, sheen: 0 });
  const marks = [];
  for (const s of [-1, 1]) {
    for (const dy of [0.026, -0.019]) {
      const d = decal(new THREE.ShapeGeometry(dia), s * EYE.x, EYE.y + dy, blue, 0.0015);
      d.scale.set(0.007, 0.011, 1);
      marks.push(d);
    }
  }
  const mouth = decal(new THREE.CircleGeometry(1, 32), 0, -0.061, mat(0xe00000, { sheen: 0 }), 0.0035);
  mouth.scale.set(0.03, 0.012, 1);
  return group(nose, marks, mouth);
});
item("makeup", "goldmask", "Gold mask", "🎭", null, ["royal", "party"], 3, () => {
  const m = headPatch(
    (p) => p.z > 0.035 && p.y > -0.006 && p.y < 0.05 && EYE_C.every((c) => Math.hypot(p.x - c.x, (p.y - c.y) * 1.3) > 0.0135),
    () => 0.0016,
    metal(0xf2b705, 0.2)
  );
  m.material.side = THREE.DoubleSide;
  return m;
});
item("makeup", "circuit", "Circuit glow", "🔌", null, ["tech"], 3, () => {
  const m = glow(0x22e5ff, 2.4);
  const lines = [
    [[0.036, -0.012], [0.06, -0.012]], [[0.06, -0.012], [0.066, -0.036]], [[0.036, -0.012], [0.033, -0.032]],
    [[-0.036, -0.016], [-0.062, -0.016]], [[-0.062, -0.016], [-0.058, -0.04]],
    [[-0.026, 0.066], [0.02, 0.066]], [[0.02, 0.066], [0.034, 0.055]], [[-0.026, 0.066], [-0.036, 0.078]],
  ];
  const g = new THREE.Group();
  for (const [[x1, y1], [x2, y2]] of lines) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    g.add(decal(new THREE.BoxGeometry(len, 0.002, 0.0008), (x1 + x2) / 2, (y1 + y2) / 2, m, 0.0009, Math.atan2(y2 - y1, x2 - x1)));
    g.add(decal(new THREE.CircleGeometry(0.003, 12), x2, y2, m, 0.0011));
  }
  return g;
});

/* ---------- Tops ---------- */
item("top", "tee", "Black tee", "👕", 0x1e1e1e, ["street"], 0, () => {
  const m = mat(0x1e1e1e, { roughness: 0.9 });
  return group(torsoShell(m), sleeves(m, "short", 0.008), collar(m, 0.058, 0.008));
});
item("top", "hoodie", "Purple hoodie", "🧥", 0x7048e8, ["street", "cozy"], 0, () => {
  const m = mat(0x7048e8, { roughness: 0.95 });
  const hood = ell(0.14, 0.09, 0.1, m, V(0, 1.53, -0.075));
  const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09, 0.02), mat(0x5f3dc4));
  pocket.position.set(0, 1.0, FZ(1.0, 0.03));
  const strings = mirror((s) => cyl(0.003, 0.003, 0.12, mat(0xf8f9fa), V(s * 0.03, 1.43, FZ(1.43, 0.026)), 6));
  return group(torsoShell(m, 1.09), sleeves(m, "long", 0.02), hood, pocket, strings, collar(m, 0.066, 0.017));
});
item("top", "tux", "Tuxedo jacket", "🤵", 0x111111, ["formal"], 0, () => {
  const m = mat(0x121212, { roughness: 0.55 });
  const shirt = ell(0.05, 0.13, 0.02, mat(0xf8f9fa), V(0, 1.37, FZ(1.37, 0.008)));
  const bow = group(mirror((s) => {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.032, 12), m);
    c.rotation.z = (s * Math.PI) / 2;
    c.position.x = s * 0.016;
    return c;
  }));
  bow.position.set(0, 1.5, FZ(1.5, 0.03));
  const lapels = mirror((s) => {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.01), mat(0x262626, { roughness: 0.25 }));
    l.position.set(s * 0.05, 1.38, FZ(1.38, 0.026)); l.rotation.z = s * 0.25;
    return l;
  });
  const buttons = [1.24, 1.17].map((y) => new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 6), metal(0xdee2e6)).translateY(y).translateZ(FZ(y, 0.026)));
  return group(torsoShell(m, 1.1), sleeves(m, "long", 0.016), shirt, bow, lapels, buttons);
});
item("top", "hawaiian", "Hawaiian shirt", "🌺", 0x1098ad, ["party", "nature"], 1, () => {
  const m = mat(0xffffff, { map: TEX.flowers("#1098ad", "#ffd43b", "#ff6b6b") });
  return group(torsoShell(m, 1.08), sleeves(m, "short", 0.02), collar(mat(0x1098ad), 0.068, 0.013));
});
item("top", "spacesuit", "Space suit", "🚀", 0xdfe3ea, ["space"], 2, () => {
  const m = metal(0xdfe3ea, 0.45);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.03), mat(0x343a40));
  panel.position.set(0, 1.3, FZ(1.3, 0.03));
  const leds = [0xff4d4d, 0x51cf66, 0x4dabf7].map((c, i) => new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), glow(c, 3)).translateX(-0.04 + i * 0.04).translateY(1.3).translateZ(FZ(1.3, 0.047)));
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.005), mat(0x1c7ed6));
  flag.position.set(-0.235, 1.37, 0.03); flag.rotation.y = -0.6;
  return group(torsoShell(m, 1.12), sleeves(m, "long", 0.024), panel, leds, flag, collar(metal(0xadb5bd), 0.07, 0.02));
});
item("top", "rgb", "RGB gaming jersey", "🌈", 0x7b5cff, ["tech", "party"], 2, () => {
  const t = TEX.rainbow([1, 2]);
  const m = mat(0xffffff, { map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.35 });
  m.userData.scroll = t;
  return group(torsoShell(m, 1.07), sleeves(m, "short", 0.016), collar(mat(0x111111), 0.06, 0.011));
});
item("top", "leopard", "Leopard fur coat", "🐆", 0xe0a95b, ["party", "goth"], 3, () => {
  const m = mat(0xffffff, { map: TEX.leopard(), roughness: 1, sheen: 1 });
  const fluff = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.04, 12, 28), mat(0xf1e3c6, { roughness: 1, sheen: 1 }));
  fluff.position.y = 1.5; fluff.rotation.x = Math.PI / 2 - 0.2;
  const hem = cyl(0.2, 0.235, 0.3, m.clone(), V(0, 0.8, 0), 32, true);
  hem.scale.z = 0.72; hem.material.side = THREE.DoubleSide;
  return group(torsoShell(m, 1.17), sleeves(m, "long", 0.03), fluff, hem);
});
item("top", "puffer", "Orange puffer", "🦺", 0xfd7e14, ["street", "cozy"], 1, () => {
  const m = mat(0xfd7e14, { roughness: 0.3, sheen: 0.2, clearcoat: 0.3 });
  const rings = [0.96, 1.08, 1.2, 1.32, 1.44].map((y) => {
    const p = profile(y);
    const t = new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 10, 40), m);
    t.position.y = y; t.rotation.x = Math.PI / 2;
    t.scale.set(p.w + 0.03, p.d + p.bf * 0.5 + 0.03, 1);
    return t;
  });
  return group(torsoShell(m, 1.15), sleeves(m, "long", 0.03), rings, collar(m, 0.075, 0.026));
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
    p.position.set(s * 0.2, 1.45, 0); p.rotation.z = -s * 0.5;
    return p;
  });
  const belt = cyl(1, 1, 0.04, mat(0x5c3d1e), V(0, 0.92, 0));
  belt.scale.set(profile(0.92).w + 0.04, 1, profile(0.92).d + 0.04);
  const crest = new THREE.Mesh(new THREE.ShapeGeometry(starShape(4, 1, 0.35)), metal(0xf2b705, 0.3));
  crest.scale.setScalar(0.05); crest.position.set(0, 1.3, FZ(1.3, 0.03));
  return group(torsoShell(m, 1.12), sleeves(m, "long", 0.02), pauldrons, belt, crest);
});
item("top", "flannel", "Flannel shirt", "🪵", 0xc92a2a, ["western", "street"], 0, () => {
  const m = mat(0xffffff, { map: TEX.plaid("#c92a2a", "#1a1a1a", "#f1f3f5") });
  return group(torsoShell(m, 1.08), sleeves(m, "3q", 0.018), collar(mat(0x8a1c1c), 0.066, 0.013));
});

/* ---------- Bottoms ---------- */
item("bottom", "joggers", "Grey joggers", "🩶", 0x868e96, ["street", "cozy"], 0, () => {
  const m = mat(0x868e96, { roughness: 0.95 });
  const cuffs = mirror((s) => cyl(0.05, 0.05, 0.04, mat(0x495057), V(0.09 * s, 0.13, -0.008)));
  return group(pants(m, "long", 0.016), cuffs);
});
item("bottom", "jeans", "Blue jeans", "👖", 0x2f4b8f, ["street", "western"], 0, () => {
  const m = mat(0x2f4b8f, { roughness: 0.85 });
  const belt = cyl(1, 1, 0.03, mat(0x3b2414, { roughness: 0.4 }), V(0, 1.0, 0));
  belt.scale.set(profile(1).w + 0.022, 1, profile(1).d + 0.022);
  return group(pants(m, "long", 0.012), belt);
});
item("bottom", "suitpants", "Suit trousers", "🖤", 0x141414, ["formal"], 0, () => group(pants(mat(0x161616, { roughness: 0.55 }), "long", 0.012)));
item("bottom", "cargo", "Camo cargo shorts", "🩳", 0x5c7a3a, ["street", "nature"], 1, () => {
  const m = mat(0xffffff, { map: TEX.camo("#6b7f45", "#3e4e28", "#a39770") });
  const pockets = mirror((s) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.07), m);
    p.position.set(s * 0.18, 0.7, 0.01);
    return p;
  });
  return group(pants(m, "shorts", 0.02), pockets);
});
item("bottom", "spacepants", "Space pants", "🛰️", 0xdfe3ea, ["space"], 1, () => {
  const m = metal(0xdfe3ea, 0.45);
  const pads = mirror((s) => ell(0.048, 0.05, 0.03, mat(0x343a40), V(0.092 * s, 0.51, 0.075)));
  return group(pants(m, "long", 0.022), pads);
});
item("bottom", "leggings", "Neon leggings", "💚", 0x94d82d, ["party", "chaos"], 2, () => {
  const t = TEX.stripes("#94d82d", "#f06595", 6, [1, 3]);
  return group(pants(mat(0xffffff, { map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.25 }), "long", 0.005));
});
item("bottom", "kilt", "Tartan kilt", "🏴", 0x2b5c3a, ["royal", "fantasy"], 2, () => {
  const t = TEX.plaid("#1d4d2b", "#1b2a5c", "#e03131", [4, 1]);
  const skirt = cyl(0.175, 0.26, 0.34, mat(0xffffff, { map: t, side: THREE.DoubleSide }), V(0, 0.79, 0), 40, true);
  skirt.scale.z = 0.72;
  const socks = mirror((s) => taperLimb(V(0.091 * s, 0.4, 0.01), V(0.09 * s, 0.1, -0.01), [0.053, 0.05, 0.04, 0.034], mat(0xf1f3f5, { roughness: 1 }), 0.005));
  const sporran = ell(0.04, 0.05, 0.02, mat(0x5c3d1e), V(0, 0.8, 0.13));
  return group(skirt, new THREE.Mesh(torsoGeo(0.86, 1.02, 0.014, 12, 40), mat(0xffffff, { map: t })), socks, sporran);
});
item("bottom", "clownpants", "Clown pants", "🎪", 0xfab005, ["circus"], 3, () => {
  const m = mat(0xffffff, { map: TEX.polka("#fab005", "#e03131") });
  const susp = mirror((s) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.55, 0.008), mat(0x1c7ed6));
    b.position.set(s * 0.075, 1.24, FZ(1.24, 0.03)); b.rotation.z = s * 0.06;
    return b;
  });
  return group(pants(m, "long", 0.05), susp);
});

/* ---------- Shoes ---------- */
item("shoes", "sneakers", "White sneakers", "👟", 0xf1f3f5, ["street"], 0, () => shoes({ upper: mat(0xf1f3f5, { roughness: 0.6 }), sole: mat(0xdee2e6) }));
item("shoes", "chunky", "Chunky red kicks", "❤️", 0xe03131, ["street", "party"], 1, () => shoes({ upper: mat(0xe03131, { roughness: 0.5 }), sole: mat(0xffffff), soleH: 0.032, h: 1.2, w: 1.15 }));
item("shoes", "boots", "Cowboy boots", "🥾", 0x8b5a2b, ["western"], 1, () => shoes({
  upper: mat(0x8b5a2b, { roughness: 0.45, clearcoat: 0.3 }), sole: mat(0x3b2414), l: 1.08,
  shaft: { r: 0.058, top: 0.3 },
  extra: (s, f) => { const h = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.04, 0.05), mat(0x3b2414)); h.position.set(f.x, 0.02, -0.06); return h; },
}));
item("shoes", "oxfords", "Patent oxfords", "🖤", 0x111111, ["formal"], 0, () => shoes({ upper: new THREE.MeshPhysicalMaterial({ color: 0x0c0c0c, roughness: 0.15, clearcoat: 1 }), sole: mat(0x2b2b2b), l: 1.05, h: 0.9 }));
item("shoes", "moonboots", "Moon boots", "🌙", 0xf1f3f5, ["space"], 1, () => shoes({
  upper: mat(0xf1f3f5, { roughness: 0.8 }), sole: mat(0x868e96), w: 1.3, h: 1.4, soleH: 0.04,
  shaft: { r: 0.075, top: 0.22, m: mat(0xe9ecef, { roughness: 0.8 }) },
}));
item("shoes", "clownshoes", "Clown shoes", "🤡", 0xe03131, ["circus"], 3, () => shoes({ upper: new THREE.MeshPhysicalMaterial({ color: 0xe00000, roughness: 0.2, clearcoat: 1 }), sole: mat(0xfab005), l: 2.1, w: 1.5, h: 1.3, soleH: 0.025 }));
item("shoes", "bunny", "Bunny slippers", "🐰", 0xffc9de, ["cozy", "cute"], 2, () => shoes({
  upper: mat(0xffc9de, { roughness: 1, sheen: 1 }), sole: mat(0xffffff, { roughness: 1 }), w: 1.3, h: 1.25,
  extra: (s, f) => group(
    mirror((e) => { const ear = ell(0.015, 0.05, 0.01, mat(0xffc9de, { roughness: 1, sheen: 1 }), V(f.x + e * 0.022, 0.13, f.z + 0.03)); ear.rotation.z = e * 0.25; return ear; }),
    mirror((e) => new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 6), black).translateX(f.x + e * 0.02).translateY(0.075).translateZ(f.z + 0.1)),
    new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), mat(0xff6b8a)).translateX(f.x).translateY(0.06).translateZ(f.z + 0.12),
  ),
}));
item("shoes", "goldtops", "Gold high-tops", "🥇", 0xf2b705, ["royal", "party"], 2, () => shoes({ upper: metal(0xf2b705, 0.2), sole: mat(0xffffff), h: 1.1, shaft: { r: 0.06, top: 0.13, m: metal(0xf2b705, 0.2) } }));

/* ---------- Extras (multi-select) ---------- */
item("acc", "headphones", "RGB headphones", "🎧", null, ["tech"], 1, () => {
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.012, 10, 40, Math.PI), mat(0x212529, { roughness: 0.4 }));
  const cups = mirror((s) => {
    const c = cyl(0.045, 0.045, 0.04, mat(0x212529, { roughness: 0.35 }), V(s * 0.135, -0.005, 0));
    c.rotation.z = Math.PI / 2;
    const rgb = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.005, 8, 24), glow(0x22e5ff, 3));
    rgb.position.set(s * 0.156, -0.005, 0); rgb.rotation.y = Math.PI / 2;
    rgb.userData.hue = true;
    return group(c, rgb);
  });
  return group(band, cups);
}, { parent: "head", hk: true });
item("acc", "chain", "Gold chain", "📿", null, ["street", "royal"], 1, () => {
  const gold = metal(0xf2b705, 0.15);
  const c = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.007, 8, 48), gold);
  c.position.set(0, 1.47, 0.03); c.rotation.x = Math.PI / 2 - 0.55;
  const pend = cyl(0.024, 0.024, 0.007, gold, V(0, 1.38, FZ(1.38, 0.03)));
  pend.rotation.x = Math.PI / 2;
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.012), glow(0x4dabf7, 1));
  gem.position.set(0, 1.38, FZ(1.38, 0.036));
  return group(c, pend, gem);
});
item("acc", "shades", "Shutter shades", "🕶️", null, ["street", "party"], 1, () => {
  const fr = new THREE.MeshPhysicalMaterial({ color: 0x111111, roughness: 0.15, metalness: 0.3, clearcoat: 1 });
  const lens = mirror((s) => {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.022, 0.004), fr);
    const c = socket(s);
    l.position.set(c.x, c.y + 0.001, c.z + EYE_R + 0.008);
    l.rotation.y = s * 0.15;
    return l;
  });
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.004, 0.004), fr);
  bridge.position.copy(surf(0, EYE.y + 0.006, 0.004));
  const arms = mirror((s) => { const a = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.004, 0.1), fr); a.position.set(s * 0.074, EYE.y + 0.004, 0.02); return a; });
  return group(lens, bridge, arms);
}, { parent: "head" });
item("acc", "monocle", "Monocle", "🧐", null, ["formal"], 1, () => {
  const c = socket(1);
  const r = new THREE.Mesh(new THREE.TorusGeometry(0.017, 0.0022, 8, 24), metal(0xf2b705, 0.2));
  r.position.set(c.x, c.y, c.z + EYE_R + 0.004);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.016, 24), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, roughness: 0, depthWrite: false }));
  glass.position.copy(r.position);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.0009, 0.0009, 0.12, 4), metal(0xf2b705));
  chain.position.set(c.x + 0.02, c.y - 0.06, c.z + 0.008); chain.rotation.z = 0.25;
  return group(r, glass, chain);
}, { parent: "head" });
item("acc", "cape", "Royal cape", "🦸", null, ["royal", "fantasy"], 2, () => {
  const red = mat(0xb5121b, { roughness: 0.6, sheen: 1, sheenColor: new THREE.Color(0xff6b6b), side: THREE.DoubleSide });
  const cape = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.4, 1.05, 32, 6, true, Math.PI - 1.35, 2.7), red);
  cape.position.set(0, 0.97, -0.03);
  cape.scale.z = 0.72;
  cape.userData.sway = true;
  const trim = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.024, 10, 30), mat(0xf8f9fa, { roughness: 1, sheen: 1 }));
  trim.position.y = 1.52; trim.rotation.x = Math.PI / 2;
  return group(cape, trim);
});
item("acc", "wings", "Angel wings", "🪽", null, ["fantasy", "cute"], 2, () => {
  const w = mat(0xffffff, { roughness: 0.9, sheen: 1 });
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
  const card = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.13), new THREE.MeshStandardMaterial({ color: 0x212529, roughness: 0.35, metalness: 0.5 }));
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
  g.position.set(0.29, 0.83, 0.09);
  g.rotation.set(0.2, -0.3, Math.PI / 2 - 0.2);
  return g;
});
item("acc", "scarf", "Chunky scarf", "🧣", null, ["cozy"], 0, () => {
  const m = mat(0xffffff, { map: TEX.stripes("#2f9e44", "#f8f9fa", 6, [4, 1]), roughness: 1, sheen: 1 });
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.036, 12, 30), m);
  loop.position.y = 1.535; loop.rotation.x = Math.PI / 2 - 0.15;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.3, 0.022), m);
  tail.position.set(0.055, 1.35, FZ(1.35, 0.04)); tail.rotation.z = 0.08;
  return group(loop, tail);
});
item("acc", "halo", "RGB halo", "😇", null, ["tech", "fantasy"], 2, () => {
  const h = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.012, 10, 48), glow(0xffd43b, 3));
  h.position.y = 0.3; h.rotation.x = Math.PI / 2;
  h.userData.hue = true; h.userData.bob = true;
  return h;
}, { parent: "head", hk: true });

/* ------------------------------------------------------------------ *
 * Equipping
 * ------------------------------------------------------------------ */
const DEFAULTS = { hat: "no-hat", eyes: "eyes-natural", makeup: "no-makeup", top: "tee", bottom: "joggers", shoes: "sneakers", acc: [] };
const state = structuredClone(DEFAULTS);
const mounted = {};
const animated = [];
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
    if (parentFor(it) === head) { obj.userData.popBase = obj.scale.x; obj.userData.popT = 0; obj.scale.multiplyScalar(0.6); animated.push(obj); }
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
  if (ITEMS[state.hat].hair) hair.scale.set(0.96, 0.7, 0.96);
  else hair.scale.set(1, 1, 1);
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
  const changed = CATS.filter((c) => (c.id === "acc" ? state.acc.length > 0 : state[c.id] !== DEFAULTS[c.id])).length;
  const effort = (changed / CATS.length) * 1.5;

  const styled = items.filter((i) => i.style.length);
  const counts = {};
  styled.forEach((i) => i.style.forEach((s) => (counts[s] = (counts[s] || 0) + 1)));
  const [topStyle, topCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || ["none", 0];
  const share = styled.length ? topCount / styled.length : 0;
  const cohesion = 3 * share * Math.min(1, styled.length / 5);

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
  full: { target: V(0, 1.0, 0), dist: 3.6 },
  face: { target: V(0, HEAD_Y + 0.0, 0), dist: 0.95 },
};
let viewAnim = null;
$("#viewBtn").onclick = (e) => {
  faceView = !faceView;
  e.currentTarget.setAttribute("aria-pressed", String(faceView));
  const v = VIEWS[faceView ? "face" : "full"];
  const dir = camera.position.clone().sub(controls.target).normalize();
  dir.y = Math.max(-0.1, Math.min(0.3, dir.y));
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
 * Loop — breathing, micro head motion, blinking, eye saccades
 * ------------------------------------------------------------------ */
function resize() {
  const { clientWidth: w, clientHeight: h } = stage;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
resize();
document.querySelector("#loading")?.remove();

const clock = new THREE.Clock();
let nextBlink = 2, blinkT = -1;
const gaze = { x: 0, y: 0, tx: 0, ty: 0, next: 1 };

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  const breathe = 1 + Math.sin(t * 1.5) * 0.008;
  body.userData.torso.scale.set(breathe, 1, breathe);
  head.rotation.y = Math.sin(t * 0.45) * 0.1;
  head.rotation.x = Math.sin(t * 0.33) * 0.025;
  head.rotation.z = Math.sin(t * 0.6) * 0.02;
  head.position.y = HEAD_Y + Math.sin(t * 1.5) * 0.002;

  // blink
  if (t > nextBlink && blinkT < 0) blinkT = 0;
  if (blinkT >= 0) {
    blinkT += dt / 0.16;
    const k = blinkT < 0.5 ? blinkT * 2 : Math.max(0, 2 - blinkT * 2);
    lids.forEach((l) => (l.rotation.x = k * 1.25));
    if (blinkT >= 1) { blinkT = -1; nextBlink = t + 2 + Math.random() * 4; lids.forEach((l) => (l.rotation.x = 0)); }
  }
  // saccades
  if (t > gaze.next) { gaze.tx = (Math.random() - 0.5) * 0.35; gaze.ty = (Math.random() - 0.5) * 0.18; gaze.next = t + 0.8 + Math.random() * 2.2; }
  gaze.x += (gaze.tx - gaze.x) * Math.min(1, dt * 18);
  gaze.y += (gaze.ty - gaze.y) * Math.min(1, dt * 18);

  if (bounce > 0) {
    bounce = Math.max(0, bounce - dt * 2.2);
    character.position.y = Math.sin((1 - bounce) * Math.PI) * 0.05;
  }

  for (const o of animated) {
    const u = o.userData;
    if (u.popT !== undefined) {
      u.popT += dt / 0.35;
      const k = Math.min(1, u.popT);
      o.scale.setScalar(u.popBase * (0.6 + 0.4 * (1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2)));
      if (k >= 1) { o.scale.setScalar(u.popBase); delete u.popT; }
    }
    if (u.gaze) { o.rotation.y = gaze.x; o.rotation.x = -gaze.y; }
    if (u.spin) o.rotation.y += u.spin * dt;
    if (u.spinZ) o.rotation.z += u.spinZ * dt;
    if (u.flap) o.rotation.y = u.flap * (0.25 + Math.sin(t * 3) * 0.25);
    if (u.sway) o.rotation.x = Math.sin(t * 1.3) * 0.04;
    if (u.bob) o.position.y = 0.3 + Math.sin(t * 2) * 0.01;
    if (u.pulse) o.scale.setScalar(u.pulse * (1 + Math.sin(t * 6) * 0.15));
    if (u.flicker) o.material.opacity = 0.55 + Math.random() * 0.35;
    if (u.hue) { o.material.color.setHSL((t * 0.2) % 1, 1, 0.55); o.material.emissive.copy(o.material.color); }
    if (u.googly) {
      o.position.x = u.googly.base.x + Math.sin(t * 7 + u.googly.phase) * 0.006;
      o.position.y = u.googly.base.y + Math.cos(t * 5.3 + u.googly.phase) * 0.006;
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
