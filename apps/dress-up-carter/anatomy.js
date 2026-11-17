// Anatomy for Dress Up Carter: one continuous, smooth body surface with a real skeleton.
//
// The body is a signed distance field (SDF) built from anatomical volumes — pelvis, glutes,
// ribcage, pecs, lats, traps, deltoids, biceps, triceps, forearm muscles, quads, hamstrings,
// calves — blended with smooth unions, then polygonised with Surface Nets into a single seamless
// mesh. Every vertex is skinned to a ~20-bone skeleton, and clothes are thin shells of the same
// field, skinned to the same bones, so they hug the body and move with it.
import * as THREE from "three";

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* ------------------------------------------------------------------ *
 * Joints (world rest pose, metres; +y up, +z forward). Relaxed contrapposto stance.
 * ------------------------------------------------------------------ */
export const J = {
  hips: V(0, 0.93, 0), spine: V(0, 1.04, 0), chest: V(0, 1.22, 0), neck: V(0, 1.47, -0.012), head: V(0, 1.66, -0.005),
  shoulderL: V(-0.183, 1.43, -0.005), elbowL: V(-0.232, 1.165, -0.04), wristL: V(-0.252, 0.93, 0.025),
  shoulderR: V(0.183, 1.423, -0.005), elbowR: V(0.229, 1.158, -0.032), wristR: V(0.255, 0.922, 0.035),
  hipL: V(-0.088, 0.905, 0), kneeL: V(-0.09, 0.5, 0.008), ankleL: V(-0.092, 0.088, -0.012), toeL: V(-0.098, 0.025, 0.12),
  hipR: V(0.088, 0.895, 0), kneeR: V(0.098, 0.5, 0.05), ankleR: V(0.108, 0.09, 0.01), toeR: V(0.118, 0.025, 0.14),
};
J.footL = V(-0.094, 0.035, 0.033);
J.footR = V(0.112, 0.035, 0.055);
J.handL = J.wristL.clone().add(V(0, -0.065, 0.01));
J.handR = J.wristR.clone().add(V(0, -0.065, 0.01));

/* ------------------------------------------------------------------ *
 * Skeleton
 * ------------------------------------------------------------------ */
const BONE_DEFS = [
  ["hips", null, J.hips], ["spine", "hips", J.spine], ["chest", "spine", J.chest],
  ["neck", "chest", J.neck], ["head", "neck", J.head],
];
for (const k of ["L", "R"]) {
  BONE_DEFS.push(
    ["upperArm" + k, "chest", J["shoulder" + k]], ["forearm" + k, "upperArm" + k, J["elbow" + k]], ["hand" + k, "forearm" + k, J["wrist" + k]],
    ["thigh" + k, "hips", J["hip" + k]], ["shin" + k, "thigh" + k, J["knee" + k]], ["foot" + k, "shin" + k, J["ankle" + k]],
  );
}
export const BONE_INDEX = Object.fromEntries(BONE_DEFS.map(([n], i) => [n, i]));

export function createSkeleton() {
  const bones = [], byName = {}, rest = {};
  for (const [name, parent, pos] of BONE_DEFS) {
    const b = new THREE.Bone();
    b.name = name;
    const local = parent ? pos.clone().sub(rest[parent]) : pos.clone();
    b.position.copy(local);
    b.userData.rest = local.clone();
    if (parent) byName[parent].add(b);
    bones.push(b); byName[name] = b; rest[name] = pos.clone();
  }
  bones[0].updateMatrixWorld(true);
  return { bones, byName, rest, root: bones[0], skeleton: new THREE.Skeleton(bones) };
}

/* ------------------------------------------------------------------ *
 * SDF primitives
 * ------------------------------------------------------------------ */
function sdEllipsoid(px, py, pz, rx, ry, rz) {
  const ax = px / rx, ay = py / ry, az = pz / rz;
  const k0 = Math.sqrt(ax * ax + ay * ay + az * az);
  const bx = px / (rx * rx), by = py / (ry * ry), bz = pz / (rz * rz);
  const k1 = Math.sqrt(bx * bx + by * by + bz * bz);
  return k1 < 1e-9 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
}
// Exact round cone (capsule with different end radii), after Inigo Quilez.
function sdRoundCone(px, py, pz, a, b, r1, r2) {
  const bax = b.x - a.x, bay = b.y - a.y, baz = b.z - a.z;
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
  const pax = px - a.x, pay = py - a.y, paz = pz - a.z;
  const y = pax * bax + pay * bay + paz * baz, z = y - l2;
  const xx = pax * l2 - bax * y, xy = pay * l2 - bay * y, xz = paz * l2 - baz * y;
  const x2 = xx * xx + xy * xy + xz * xz, y2 = y * y * l2, z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
function smin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

// groups: 0 torso, 1 armL, 2 armR, 3 legL, 4 legR
const GROUP_K = [0.055, 0.02, 0.02, 0.026, 0.026];
const PRIMS = [];
function ellP(c, r, group, bone) {
  const m = 0.05;
  PRIMS.push({ t: 0, c, r, group, bone: BONE_INDEX[bone], bb: [c.x - r.x - m, c.y - r.y - m, c.z - r.z - m, c.x + r.x + m, c.y + r.y + m, c.z + r.z + m] });
}
function coneP(a, b, r1, r2, group, bone) {
  const m = 0.05, R = Math.max(r1, r2) + m;
  PRIMS.push({ t: 1, a, b, r1, r2, group, bone: BONE_INDEX[bone],
    bb: [Math.min(a.x, b.x) - R, Math.min(a.y, b.y) - R, Math.min(a.z, b.z) - R, Math.max(a.x, b.x) + R, Math.max(a.y, b.y) + R, Math.max(a.z, b.z) + R] });
}
const lerp = (a, b, t) => a.clone().lerp(b, t);

// Torso
ellP(V(0, 0.925, 0), V(0.15, 0.1, 0.1), 0, "hips");                       // pelvis
for (const s of [-1, 1]) ellP(V(s * 0.066, 0.88, -0.045), V(0.072, 0.085, 0.068), 0, "hips"); // glutes
ellP(V(0, 0.99, 0.01), V(0.135, 0.09, 0.095), 0, "spine");                // lower belly
ellP(V(0, 1.09, 0.004), V(0.128, 0.11, 0.09), 0, "spine");                // waist
ellP(V(0, 1.27, 0), V(0.138, 0.165, 0.1), 0, "chest");                    // ribcage
ellP(V(0, 1.4, 0.008), V(0.14, 0.06, 0.085), 0, "chest");                 // upper chest
for (const s of [-1, 1]) {
  ellP(V(s * 0.066, 1.33, 0.052), V(0.07, 0.05, 0.04), 0, "chest");       // pecs
  ellP(V(s * 0.098, 1.26, -0.02), V(0.052, 0.12, 0.062), 0, "chest");    // lats
  ellP(V(s * 0.178, 1.415, -0.004), V(0.046, 0.056, 0.048), 0, s < 0 ? "upperArmL" : "upperArmR"); // deltoids
}
ellP(V(0, 1.458, -0.024), V(0.128, 0.068, 0.07), 0, "chest");              // trapezius
coneP(V(0, 1.44, -0.012), V(0, 1.665, -0.005), 0.054, 0.045, 0, "neck");  // neck

// Arms
for (const [s, k, g] of [[-1, "L", 1], [1, "R", 2]]) {
  const sh = J["shoulder" + k], el = J["elbow" + k], wr = J["wrist" + k];
  coneP(sh, el, 0.043, 0.033, g, "upperArm" + k);
  ellP(lerp(sh, el, 0.45).add(V(0, 0, 0.012)), V(0.033, 0.075, 0.035), g, "upperArm" + k);  // biceps
  ellP(lerp(sh, el, 0.4).add(V(0, 0, -0.014)), V(0.034, 0.08, 0.034), g, "upperArm" + k);   // triceps
  ellP(el.clone(), V(0.033, 0.034, 0.033), g, "forearm" + k);
  coneP(el, wr, 0.035, 0.023, g, "forearm" + k);
  ellP(lerp(el, wr, 0.25).add(V(s * 0.004, 0, 0.004)), V(0.037, 0.075, 0.033), g, "forearm" + k); // forearm flexors
}
// Legs
for (const [s, k, g] of [[-1, "L", 3], [1, "R", 4]]) {
  const hp = J["hip" + k], kn = J["knee" + k], an = J["ankle" + k], toe = J["toe" + k];
  coneP(hp, kn, 0.074, 0.047, g, "thigh" + k);
  ellP(lerp(hp, kn, 0.45).add(V(s * 0.008, 0, 0.022)), V(0.057, 0.15, 0.054), g, "thigh" + k); // quads
  ellP(lerp(hp, kn, 0.45).add(V(0, 0, -0.025)), V(0.054, 0.14, 0.05), g, "thigh" + k);         // hamstrings
  ellP(kn.clone().add(V(0, 0, 0.008)), V(0.04, 0.044, 0.04), g, "shin" + k);
  coneP(kn, an, 0.045, 0.028, g, "shin" + k);
  ellP(lerp(kn, an, 0.28).add(V(s * 0.004, 0, -0.022)), V(0.045, 0.095, 0.043), g, "shin" + k); // calves
  coneP(an.clone().add(V(0, -0.02, 0)), toe, 0.032, 0.022, g, "foot" + k);
  ellP(an.clone().add(V(0, -0.05, -0.028)), V(0.03, 0.032, 0.038), g, "foot" + k);               // heel
}

function primDist(p, x, y, z) {
  return p.t === 0 ? sdEllipsoid(x - p.c.x, y - p.c.y, z - p.c.z, p.r.x, p.r.y, p.r.z) : sdRoundCone(x, y, z, p.a, p.b, p.r1, p.r2);
}
const inBB = (p, x, y, z) => x >= p.bb[0] && y >= p.bb[1] && z >= p.bb[2] && x <= p.bb[3] && y <= p.bb[4] && z <= p.bb[5];
function combine(g) {
  let d = smin(g[0], g[3], 0.03);
  d = smin(d, g[4], 0.03);
  d = smin(d, g[1], 0.016);
  return smin(d, g[2], 0.016);
}

const _g = [1, 1, 1, 1, 1];
// Body distance + dominant group at any point.
export function evalBody(x, y, z, out = {}) {
  _g.fill(1);
  for (const p of PRIMS) if (inBB(p, x, y, z)) _g[p.group] = smin(_g[p.group], primDist(p, x, y, z), GROUP_K[p.group]);
  let gi = 0;
  for (let i = 1; i < 5; i++) if (_g[i] < _g[gi]) gi = i;
  out.d = combine(_g); out.group = gi;
  return out;
}

/* ------------------------------------------------------------------ *
 * Grid sampling + Surface Nets
 * ------------------------------------------------------------------ */
const GRID = { x0: -0.36, y0: -0.01, z0: -0.17, x1: 0.36, y1: 1.72, z1: 0.21, h: 0.0075 };
let cache = null;
function sampleBody() {
  if (cache) return cache;
  const { x0, y0, z0, h } = GRID;
  const nx = Math.ceil((GRID.x1 - x0) / h) + 1, ny = Math.ceil((GRID.y1 - y0) / h) + 1, nz = Math.ceil((GRID.z1 - z0) / h) + 1;
  const N = nx * ny * nz;
  const G = [0, 1, 2, 3, 4].map(() => new Float32Array(N).fill(1));
  for (const p of PRIMS) {
    const ix0 = Math.max(0, Math.floor((p.bb[0] - x0) / h)), ix1 = Math.min(nx - 1, Math.ceil((p.bb[3] - x0) / h));
    const iy0 = Math.max(0, Math.floor((p.bb[1] - y0) / h)), iy1 = Math.min(ny - 1, Math.ceil((p.bb[4] - y0) / h));
    const iz0 = Math.max(0, Math.floor((p.bb[2] - z0) / h)), iz1 = Math.min(nz - 1, Math.ceil((p.bb[5] - z0) / h));
    const F = G[p.group], k = GROUP_K[p.group];
    for (let iz = iz0; iz <= iz1; iz++) for (let iy = iy0; iy <= iy1; iy++) {
      let i = ix0 + nx * (iy + ny * iz);
      for (let ix = ix0; ix <= ix1; ix++, i++) F[i] = smin(F[i], primDist(p, x0 + ix * h, y0 + iy * h, z0 + iz * h), k);
    }
  }
  const field = new Float32Array(N), group = new Uint8Array(N), g = [0, 0, 0, 0, 0];
  for (let i = 0; i < N; i++) {
    let gi = 0;
    for (let j = 0; j < 5; j++) { g[j] = G[j][i]; if (g[j] < g[gi]) gi = j; }
    field[i] = combine(g); group[i] = gi;
  }
  cache = { field, group, nx, ny, nz };
  return cache;
}

const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
function surfaceNets(F, nx, ny, nz, x0, y0, z0, h) {
  const cx = nx - 1, cy = ny - 1, cz = nz - 1;
  const cell = new Int32Array(cx * cy * cz).fill(-1);
  const verts = [], v = new Float32Array(8);
  for (let z = 0; z < cz; z++) for (let y = 0; y < cy; y++) for (let x = 0; x < cx; x++) {
    let neg = 0;
    for (let i = 0; i < 8; i++) {
      v[i] = F[(x + (i & 1)) + nx * ((y + ((i >> 1) & 1)) + ny * (z + ((i >> 2) & 1)))];
      if (v[i] < 0) neg++;
    }
    if (neg === 0 || neg === 8) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of EDGES) {
      if ((v[a] < 0) === (v[b] < 0)) continue;
      const t = v[a] / (v[a] - v[b]);
      sx += (a & 1) + t * ((b & 1) - (a & 1));
      sy += ((a >> 1) & 1) + t * (((b >> 1) & 1) - ((a >> 1) & 1));
      sz += ((a >> 2) & 1) + t * (((b >> 2) & 1) - ((a >> 2) & 1));
      n++;
    }
    cell[x + cx * (y + cy * z)] = verts.length / 3;
    verts.push(x0 + (x + sx / n) * h, y0 + (y + sy / n) * h, z0 + (z + sz / n) * h);
  }
  const C = (x, y, z) => cell[x + cx * (y + cy * z)];
  const idx = [];
  const quad = (a, b, c, d) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; idx.push(a, b, c, a, c, d); };
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const f0 = F[x + nx * (y + ny * z)] < 0;
    if (x < cx && y > 0 && z > 0 && y < cy && z < cz && f0 !== (F[x + 1 + nx * (y + ny * z)] < 0))
      quad(C(x, y - 1, z - 1), C(x, y, z - 1), C(x, y, z), C(x, y - 1, z));
    if (y < cy && x > 0 && z > 0 && x < cx && z < cz && f0 !== (F[x + nx * (y + 1 + ny * z)] < 0))
      quad(C(x - 1, y, z - 1), C(x, y, z - 1), C(x, y, z), C(x - 1, y, z));
    if (z < cz && x > 0 && y > 0 && x < cx && y < cy && f0 !== (F[x + nx * (y + ny * (z + 1))] < 0))
      quad(C(x - 1, y - 1, z), C(x, y - 1, z), C(x, y, z), C(x - 1, y, z));
  }
  return { pos: new Float32Array(verts), idx };
}

// Snap vertices onto the true surface, compute smooth normals from the field gradient,
// and orient every triangle outward.
function finalize(pos, idx, sdf) {
  const n = pos.length / 3, nor = new Float32Array(n * 3), e = 0.0015;
  for (let i = 0; i < n; i++) {
    let x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    for (let it = 0; it < 2; it++) {
      const d = sdf(x, y, z);
      let gx = sdf(x + e, y, z) - sdf(x - e, y, z), gy = sdf(x, y + e, z) - sdf(x, y - e, z), gz = sdf(x, y, z + e) - sdf(x, y, z - e);
      const l = Math.hypot(gx, gy, gz) || 1;
      gx /= l; gy /= l; gz /= l;
      if (it === 0) { x -= gx * d; y -= gy * d; z -= gz * d; }
      else { nor[i * 3] = gx; nor[i * 3 + 1] = gy; nor[i * 3 + 2] = gz; }
    }
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
  }
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    if (fx * (nor[a] + nor[b] + nor[c]) + fy * (nor[a + 1] + nor[b + 1] + nor[c + 1]) + fz * (nor[a + 2] + nor[b + 2] + nor[c + 2]) < 0) {
      const tmp = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = tmp;
    }
  }
  return nor;
}

// Skin weights: each vertex follows the bones of the anatomical volumes it sits on,
// blended smoothly where muscles meet (softmax over distances).
function skinWeights(pos) {
  const n = pos.length / 3, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  const acc = new Float32Array(BONE_DEFS.length), tau = 0.012;
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    acc.fill(0);
    let dmin = 1e9;
    const ds = [];
    for (const p of PRIMS) if (inBB(p, x, y, z)) { const d = primDist(p, x, y, z); ds.push([p.bone, d]); if (d < dmin) dmin = d; }
    if (!ds.length) { si[i * 4] = 0; sw[i * 4] = 1; continue; }
    for (const [b, d] of ds) acc[b] += Math.exp(-(d - dmin) / tau);
    const top = [...acc.keys()].sort((a, b) => acc[b] - acc[a]).slice(0, 4);
    const tot = top.reduce((s, b) => s + acc[b], 0);
    top.forEach((b, k) => { si[i * 4 + k] = b; sw[i * 4 + k] = acc[b] / tot; });
  }
  return { si, sw };
}

function geometryFrom(pos, idx, nor) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.setIndex(idx);
  const { si, sw } = skinWeights(pos);
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
  g.computeBoundingSphere();
  return g;
}

export function bodyGeometry() {
  const { field, nx, ny, nz } = sampleBody();
  const { pos, idx } = surfaceNets(field, nx, ny, nz, GRID.x0, GRID.y0, GRID.z0, GRID.h);
  const o = {};
  const nor = finalize(pos, idx, (x, y, z) => evalBody(x, y, z, o).d);
  return geometryFrom(pos, idx, nor);
}

/* ------------------------------------------------------------------ *
 * Garments: thin shells of the body field, trimmed by cuts along the bones
 * ------------------------------------------------------------------ */
function chainParam(x, y, z, a, b, c) {
  // position along a two-segment chain a→b→c as 0..2
  const seg = (p, q) => {
    const dx = q.x - p.x, dy = q.y - p.y, dz = q.z - p.z, l2 = dx * dx + dy * dy + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - p.x) * dx + (y - p.y) * dy + (z - p.z) * dz) / l2));
    return [t, Math.hypot(x - p.x - dx * t, y - p.y - dy * t, z - p.z - dz * t)];
  };
  const [t1, d1] = seg(a, b), [t2, d2] = seg(b, c);
  return d1 < d2 ? t1 : 1 + t2;
}
const SLEEVE = { none: -0.1, short: 0.45, "3q": 1.5, long: 1.96 };
const LEG = { waist: -0.2, shorts: 0.78, long: 1.93 };

function cutFor(spec, group, x, y, z) {
  if (spec.kind === "top") {
    if (group === 1 || group === 2) {
      const k = group === 1 ? "L" : "R";
      return (chainParam(x, y, z, J["shoulder" + k], J["elbow" + k], J["wrist" + k]) - SLEEVE[spec.sleeve]) * 0.26;
    }
    return Math.max(spec.hem - y, y - spec.neck);
  }
  // pants
  if (group === 1 || group === 2) return 1;
  if (group === 3 || group === 4) {
    const k = group === 3 ? "L" : "R";
    const legCut = (chainParam(x, y, z, J["hip" + k], J["knee" + k], J["ankle" + k]) - LEG[spec.len]) * 0.41;
    return spec.len === "waist" ? Math.max(legCut, spec.hem - y, y - spec.waist) : Math.max(legCut, y - spec.waist);
  }
  return spec.len === "waist" ? Math.max(spec.hem - y, y - spec.waist) : y - spec.waist;
}

export function garmentGeometry(spec) {
  spec = { neck: 1.508, hem: 0.87, waist: 1.0, thick: 0.01, ...spec };
  const { field, group, nx, ny, nz } = sampleBody();
  const { x0, y0, z0, h } = GRID;
  const F = new Float32Array(field.length);
  for (let iz = 0, i = 0; iz < nz; iz++) for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++, i++) {
    const d = field[i] - spec.thick;
    F[i] = d > 0.03 ? d : Math.max(d, cutFor(spec, group[i], x0 + ix * h, y0 + iy * h, z0 + iz * h));
  }
  const { pos, idx } = surfaceNets(F, nx, ny, nz, x0, y0, z0, h);
  const o = {};
  const sdf = (x, y, z) => { evalBody(x, y, z, o); return Math.max(o.d - spec.thick, cutFor(spec, o.group, x, y, z)); };
  const nor = finalize(pos, idx, sdf);
  const geo = geometryFrom(pos, idx, nor);
  return withUVs(geo);
}

// Cylindrical UVs per body part so printed fabrics wrap around torso, arms and legs.
function withUVs(geo) {
  const g = geo.toNonIndexed();
  const p = g.attributes.position, n = p.count, uv = new Float32Array(n * 2), o = {};
  const frac = new Float32Array(n), scale = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    evalBody(x, y, z, o);
    let cx = 0, cz = 0, circ = 0.82;
    if (o.group === 1 || o.group === 2) { const w = J[o.group === 1 ? "elbowL" : "elbowR"]; cx = w.x; cz = w.z; circ = 0.26; }
    else if (o.group === 3 || o.group === 4) { const k = J[o.group === 3 ? "kneeL" : "kneeR"]; cx = k.x; cz = k.z; circ = 0.42; }
    frac[i] = Math.atan2(x - cx, z - cz) / (2 * Math.PI) + 0.5;
    scale[i] = circ / 0.3;
    uv[i * 2 + 1] = y / 0.3;
  }
  for (let t = 0; t < n; t += 3) {
    const f = [frac[t], frac[t + 1], frac[t + 2]];
    if (Math.max(...f) - Math.min(...f) > 0.5) for (let k = 0; k < 3; k++) if (f[k] < 0.5) f[k] += 1;
    const s = Math.min(scale[t], scale[t + 1], scale[t + 2]);
    for (let k = 0; k < 3; k++) uv[(t + k) * 2] = f[k] * s;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
}

/* ------------------------------------------------------------------ *
 * Hands: fine-resolution SDF with three-jointed, relaxed, curled fingers
 * ------------------------------------------------------------------ */
export function handGeometry(s) {
  const k = s < 0 ? "L" : "R", w = J["wrist" + k];
  const parts = [];
  const add = (a, b, r1, r2) => parts.push({ a, b, r1, r2 });
  // palm as a flattened round cone pair
  parts.push({ e: true, c: w.clone().add(V(0, -0.045, 0.004)), r: V(0.0135, 0.044, 0.037) });
  parts.push({ e: true, c: w.clone().add(V(0, -0.006, 0.002)), r: V(0.02, 0.016, 0.026) });
  const fingers = [[-0.023, 0.04, 0.026, 0.02], [-0.008, 0.046, 0.029, 0.022], [0.008, 0.044, 0.028, 0.021], [0.023, 0.035, 0.022, 0.018]];
  for (const [fz, l1, l2, l3] of fingers) {
    let p = w.clone().add(V(-s * 0.001, -0.084, fz));
    const dirs = [V(-s * 0.12, -1, 0.04), V(-s * 0.45, -0.9, 0.03), V(-s * 0.8, -0.6, 0.0)];
    const lens = [l1, l2, l3], rads = [0.0088, 0.0078, 0.0068, 0.0056];
    for (let j = 0; j < 3; j++) {
      const q = p.clone().addScaledVector(dirs[j].normalize(), lens[j]);
      add(p, q, rads[j], rads[j + 1]);
      p = q;
    }
  }
  let p = w.clone().add(V(-s * 0.008, -0.03, 0.03));
  for (const [d, l, r1, r2] of [[V(-s * 0.35, -0.7, 0.6), 0.032, 0.012, 0.0092], [V(-s * 0.5, -0.8, 0.35), 0.03, 0.0092, 0.0078], [V(-s * 0.6, -0.8, 0.15), 0.024, 0.0078, 0.0066]]) {
    const q = p.clone().addScaledVector(d.normalize(), l);
    add(p, q, r1, r2);
    p = q;
  }
  const sdf = (x, y, z) => {
    let d = 1;
    for (const q of parts) {
      const di = q.e ? sdEllipsoid(x - q.c.x, y - q.c.y, z - q.c.z, q.r.x, q.r.y, q.r.z) : sdRoundCone(x, y, z, q.a, q.b, q.r1, q.r2);
      d = smin(d, di, 0.007);
    }
    return d;
  };
  const h = 0.0022, x0 = w.x - 0.06, y0 = w.y - 0.2, z0 = w.z - 0.06;
  const nx = Math.ceil(0.12 / h), ny = Math.ceil(0.23 / h), nz = Math.ceil(0.13 / h);
  const F = new Float32Array(nx * ny * nz);
  for (let iz = 0, i = 0; iz < nz; iz++) for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++, i++) {
    const y = y0 + iy * h;
    F[i] = y > w.y + 0.012 ? Math.max(0.01, y - w.y - 0.012) : sdf(x0 + ix * h, y, z0 + iz * h);
  }
  const { pos, idx } = surfaceNets(F, nx, ny, nz, x0, y0, z0, h);
  const nor = finalize(pos, idx, sdf);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

/* ------------------------------------------------------------------ *
 * Measurements for placing accessories
 * ------------------------------------------------------------------ */
const _o = {};
function scan(from, dir, y, fixed) {
  for (let t = 0; t < 0.4; t += 0.002) {
    const x = fixed === "z" ? from - t * dir : 0, z = fixed === "x" ? from - t * dir : 0;
    if (evalBody(x, y, z, _o).d < 0 && _o.group === 0) return from - t * dir;
  }
  return 0;
}
const fzCache = new Map(), wCache = new Map();
// Front surface z of the torso centre line at height y.
export function frontZ(y) {
  const k = Math.round(y * 500);
  if (!fzCache.has(k)) fzCache.set(k, scan(0.3, 1, y, "x"));
  return fzCache.get(k);
}
// Half-width / half-depth of the torso at height y.
export function torsoSize(y) {
  const k = Math.round(y * 500);
  if (!wCache.has(k)) wCache.set(k, { w: scan(0.3, 1, y, "z"), d: frontZ(y) });
  return wCache.get(k);
}

export function makeSkinned(geo, material, skeleton) {
  const m = new THREE.SkinnedMesh(geo, material);
  m.bindMode = THREE.DetachedBindMode;
  m.bind(skeleton, new THREE.Matrix4());
  m.frustumCulled = false;
  m.castShadow = m.receiveShadow = true;
  return m;
}
