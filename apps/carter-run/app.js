// Carter Run — a minimalist side-scrolling runner.
// Tap / Space / ↑ to jump (again in the air to flip), swipe down / ↓ to slide.
// Stomp bugs, dodge fans, towers, cables and flying bugs, grab chips. It keeps getting faster.
//
// Animation: Carter is a jointed rig (hips, spine, neck, shoulders, elbows, hands, knees, ankles).
// Every state (idle, run, rise, fall, flip, slide, land, tumble) produces a target pose and the
// rig springs toward it, so all transitions blend smoothly. Physics runs at a fixed 120 Hz.
const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const $ = (s) => document.querySelector(s);

let W = 0, H = 0, U = 1, GROUND = 0, PX = 0;
function resize() {
  const r = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  W = r.width; H = r.height;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  U = Math.max(0.6, Math.min(1.3, Math.min(H / 600, W / 330)));
  GROUND = Math.round(H * 0.74);
  PX = Math.max(70 * U, W * 0.22);
}
new ResizeObserver(resize).observe(canvas);

const COL = {
  bg: "#f4f1ec", bg2: "#ece7df", far: "#e6e0d7", mid: "#dad3c8", ground: "#1d1d1f", ink: "#1d1d1f",
  accent: "#ff5a4e", accentDark: "#d9443a", chip: "#14b8a6",
  skin: "#8a5a40", skinLit: "#a0694b", skinDark: "#6a4330", tee: "#222326", teeLit: "#34363b",
  pants: "#4b5563", pantsDark: "#374151", shoe: "#fbfbfb", sole: "#ff5a4e", outline: "#141416",
};
const face = new Image();
face.src = "carter.png";
const rand = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

let best = 0;
try { best = +localStorage.getItem("carter-run-best") || 0; } catch {}

/* ------------------------------------------------------------------ *
 * Rig poses
 * ------------------------------------------------------------------ */
const POSE_KEYS = ["hipY", "lean", "l0", "l1", "k0", "k1", "f0", "f1", "a0", "a1", "e0", "e1", "head"];
const pose = () => Object.fromEntries(POSE_KEYS.map((k) => [k, 0]));
function runPose(p, sp) {
  const o = pose(), lean = 0.16 + sp * 0.14;
  for (const i of [0, 1]) {
    const q = p + i * Math.PI, s = Math.sin(q), c = Math.cos(q);
    o["l" + i] = 0.9 * s;                                              // thigh swing
    o["k" + i] = -(0.12 + 1.55 * Math.pow(Math.max(0, c), 1.3));        // big knee bend on the recovery swing
    o["f" + i] = c > 0 ? 0.35 : -0.15 * s;                             // toe drops while recovering
    o["a" + i] = -0.95 * s;                                            // arms counter-swing
    o["e" + i] = 1.3 - 0.4 * s;                                        // elbows bent forward, more on the forward swing
  }
  o.hipY = -45 + 3.2 * Math.cos(2 * p);                                // dip at each foot contact
  o.lean = lean;
  o.head = 0.05 * Math.sin(2 * p) - lean * 0.4;
  return o;
}
const POSES = {
  idle: (t) => Object.assign(pose(), { hipY: -46 + Math.sin(t * 2.2) * 0.8, lean: 0.03, l0: 0.08, l1: -0.06, k0: -0.06, k1: -0.04, f0: -0.08, f1: 0.06, a0: 0.1 + Math.sin(t * 2.2) * 0.03, a1: -0.08, e0: 0.35, e1: 0.25, head: Math.sin(t * 0.9) * 0.05 }),
  rise: () => Object.assign(pose(), { hipY: -44, lean: 0.14, l0: 1.05, l1: -0.35, k0: -1.75, k1: -0.45, f0: 0.5, f1: 0.3, a0: 1.45, a1: -0.95, e0: 1.0, e1: 1.1, head: -0.12 }),
  fall: (t) => Object.assign(pose(), { hipY: -45, lean: 0.12, l0: 0.55, l1: 0.05, k0: -0.55, k1: -0.95, f0: 0.15, f1: 0.25, a0: 1.3 + Math.sin(t * 9) * 0.25, a1: -1.2 + Math.sin(t * 9 + 1) * 0.25, e0: 0.6, e1: 0.8, head: 0.08 }),
  tuck: () => Object.assign(pose(), { hipY: -40, lean: 0.35, l0: 1.6, l1: 1.4, k0: -2.3, k1: -2.2, f0: 0.4, f1: 0.4, a0: 0.9, a1: 0.7, e0: 0.9, e1: 1.0, head: 0.3 }),
  slide: () => Object.assign(pose(), { hipY: -13, lean: -1.12, l0: 1.5, l1: 1.25, k0: -0.08, k1: -0.32, f0: -0.25, f1: -0.1, a0: 1.6, a1: 0.4, e0: 0.4, e1: 0.9, head: 0.75 }),
  land: () => Object.assign(pose(), { hipY: -34, lean: 0.32, l0: 0.55, l1: -0.25, k0: -1.15, k1: -0.85, f0: -0.55, f1: 0.2, a0: 0.7, a1: -0.6, e0: 1.0, e1: 0.9, head: -0.1 }),
  dead: (t) => Object.assign(pose(), { hipY: -42, lean: 0, l0: 0.7 + Math.sin(t * 16) * 0.5, l1: -0.5 + Math.cos(t * 13) * 0.5, k0: -0.6, k1: -0.9, f0: 0.3, f1: 0.1, a0: -2.4 + Math.sin(t * 18) * 0.7, a1: 2.1 + Math.cos(t * 15) * 0.7, e0: -0.4, e1: 0.5, head: Math.sin(t * 10) * 0.3 }),
};

/* ------------------------------------------------------------------ *
 * State
 * ------------------------------------------------------------------ */
let state = "ready", C, rig, ghosts, obs, chips, fx, lines, speed, dist, chipCount, spawnIn, shake, slowmo, time, scroll, camY, flash;
function reset() {
  C = { y: 0, vy: 0, air: false, jumps: 0, slide: 0, flip: 0, land: 0, phase: 0, dead: false, deadT: 0, rot: 0, dustT: 0, ghostT: 0, squash: 0 };
  rig = POSES.idle(0);
  ghosts = []; obs = []; chips = []; fx = []; lines = [];
  speed = 330; dist = 0; chipCount = 0; spawnIn = 1.2; shake = 0; slowmo = 0; time = 0; scroll = 0; camY = 0; flash = 0;
}

/* ------------------------------------------------------------------ *
 * Input
 * ------------------------------------------------------------------ */
function jump() {
  if (state === "ready" || state === "over") return start();
  if (C.dead) return;
  if (!C.air) { C.vy = -900; C.air = true; C.jumps = 1; C.slide = 0; C.squash = -0.18; dust(PX, GROUND, 7, -1); }
  else if (C.jumps < 2) { C.vy = -820; C.jumps = 2; C.flip = 1; ring(PX, GROUND - (C.y + 40) * U, "rgba(29,29,31,0.25)", 26); }
}
function slide() {
  if (state !== "play" || C.dead) return;
  if (C.air) C.vy = Math.max(C.vy, 950);
  C.slide = 0.65;
}
addEventListener("keydown", (e) => {
  const k = e.key;
  if ([" ", "ArrowUp", "w", "W"].includes(k)) { e.preventDefault(); if (!e.repeat) jump(); }
  if (["ArrowDown", "s", "S"].includes(k)) { e.preventDefault(); slide(); }
  if (k === "Enter" && state !== "play") start();
});
let touch = null;
canvas.addEventListener("pointerdown", (e) => { touch = { x: e.clientX, y: e.clientY, used: false }; });
canvas.addEventListener("pointermove", (e) => { if (touch && !touch.used && e.clientY - touch.y > 30) { touch.used = true; slide(); } });
canvas.addEventListener("pointerup", () => { if (touch && !touch.used) jump(); touch = null; });
$("#again").addEventListener("click", (e) => { e.stopPropagation(); start(); });

function start() {
  reset();
  state = "play";
  $("#ui").classList.add("hide");
  $("#again").hidden = true;
}

/* ------------------------------------------------------------------ *
 * Obstacles (world units: 1 = 1 px at U = 1; x measured from Carter, y up from the ground)
 * ------------------------------------------------------------------ */
const KINDS = ["fan", "tower", "cable", "bug", "fly"];
function spawn() {
  const lvl = Math.min(1, dist / 4000);
  const pool = lvl < 0.15 ? ["fan", "bug", "fan"] : lvl < 0.35 ? ["fan", "bug", "cable", "tower"] : KINDS;
  const kind = pool[Math.floor(Math.random() * pool.length)];
  const x = (W - PX) / U + 120;
  const o = { kind, x, t: rand(0, 3), dead: false, squash: 0 };
  if (kind === "fan") Object.assign(o, { w: 52, h: 52, y: 0 });
  if (kind === "tower") Object.assign(o, { w: 46, h: 118, y: 0 });
  if (kind === "bug") Object.assign(o, { w: 46, h: 30, y: 0, walk: 70 });
  if (kind === "fly") Object.assign(o, { w: 40, h: 26, y: 62 });
  if (kind === "cable") {
    // a real rope: verlet points hanging from the ceiling, swinging as it scrolls in
    const top = GROUND / U + 20, len = top - 72, n = 10;
    o.rope = Array.from({ length: n + 1 }, (_, i) => ({ x, y: top - (len * i) / n, px: x + 3, py: top - (len * i) / n }));
    o.seg = len / n; o.y = 72;
  }
  obs.push(o);
  if (Math.random() < 0.55) {
    const n = 5, over = kind === "fan" || kind === "bug";
    for (let i = 0; i < n; i++) chips.push({ x: x + (over ? (i - 2) * 34 : 140 + i * 34), y: over ? 120 + Math.sin((i / (n - 1)) * Math.PI) * 60 : 40, t: rand(0, 6) });
  }
  const gap = rand(1.0, 1.7) * (1 - 0.35 * lvl);
  spawnIn = Math.max(0.55, gap * (420 / speed) * 1.25);
}
function hitbox() {
  if (C.slide > 0 && !C.air) return { x0: -26, x1: 30, y0: 0, y1: 42 };
  return { x0: -16, x1: 18, y0: C.y, y1: C.y + 92 };
}
function obsBox(o) {
  if (o.kind === "cable") { const end = o.rope[o.rope.length - 1]; return { x0: end.x - 10, x1: end.x + 10, y0: end.y - 4, y1: 2000 }; }
  return { x0: o.x - o.w / 2 + 4, x1: o.x + o.w / 2 - 4, y0: o.y, y1: o.y + o.h - 4 };
}
const overlap = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

/* ------------------------------------------------------------------ *
 * Simulation (fixed step)
 * ------------------------------------------------------------------ */
function step(dt, dtReal) {
  time += dt;
  if (!C.dead) { speed = Math.min(900, 330 + dist * 0.045); dist += (speed * dt) / 10; }
  const move = C.dead ? speed * 0.2 * dt : speed * dt;
  scroll += move;

  // Carter
  C.vy += 2500 * dt;
  C.y -= C.vy * dt;
  if (C.y <= 0) {
    if (C.air && !C.dead && C.vy > 0) { C.land = 1; C.squash = 0.22 * Math.min(1, C.vy / 900); dust(PX, GROUND, 10, 0); ring(PX, GROUND, "rgba(29,29,31,0.18)", 34, true); }
    if (C.dead && C.vy > 250) { C.vy = -C.vy * 0.35; C.y = 0; shake = Math.max(shake, 0.15); dust(PX, GROUND, 6, 0); }
    else { C.y = 0; C.vy = 0; C.air = false; C.jumps = 0; C.flip = 0; }
  }
  C.slide = Math.max(0, C.slide - dt);
  C.flip = Math.max(0, C.flip - dt / 0.45);
  C.land = Math.max(0, C.land - dt * 5);
  C.squash *= Math.exp(-dt * 12);
  if (!C.dead) C.phase += dt * (C.air ? 6 : speed / 36);
  if (C.dead) {
    C.deadT += dt;
    if (C.y > 0) C.rot += dt * 9;
    else { const flat = Math.round((C.rot - Math.PI / 2) / Math.PI) * Math.PI + Math.PI / 2; C.rot = lerp(C.rot, flat, 1 - Math.exp(-dt * 8)); }
  }
  C.dustT -= dt;
  if (!C.air && !C.dead && C.dustT <= 0) { C.dustT = C.slide > 0 ? 0.035 : 0.13; dust(PX - 12 * U, GROUND, C.slide > 0 ? 2 : 1, -1); }

  // ghost trail during flips and big jumps
  C.ghostT -= dt;
  if (C.flip > 0 && C.ghostT <= 0) {
    C.ghostT = 0.05;
    ghosts.push({ y: C.y, rot: flipRot(), rig: { ...rig }, sx: 0, life: 0.18 });
  }
  for (const g of ghosts) { g.life -= dtReal; g.sx -= move; }
  ghosts = ghosts.filter((g) => g.life > 0);

  // camera: lifts gently with Carter
  camY = lerp(camY, C.y * 0.28, 1 - Math.exp(-dt * 6));

  if (!C.dead) { spawnIn -= dt; if (spawnIn <= 0) spawn(); }

  const me = hitbox();
  for (const o of obs) {
    o.t += dt;
    o.x -= move + (o.kind === "bug" && !o.dead ? o.walk * dt : 0);
    if (o.kind === "fly") o.y = 62 + Math.sin(o.t * 4) * 8;
    if (o.rope) {
      const top = GROUND / U + 20;
      for (const p of o.rope) { p.x -= move; p.px -= move * 0.97; }   // scroll with the world, keep a little inertia
      o.rope[0].x = o.x; o.rope[0].y = top;
      for (let i = 1; i < o.rope.length; i++) {
        const p = o.rope[i], vx = (p.x - p.px) * 0.985, vy = (p.y - p.py) * 0.985;
        p.px = p.x; p.py = p.y;
        p.x += vx + Math.sin(o.t * 2 + i) * 0.02; p.y += vy - 900 * dt * dt;
      }
      for (let it = 0; it < 6; it++) for (let i = 1; i < o.rope.length; i++) {
        const a = o.rope[i - 1], b = o.rope[i], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, diff = (d - o.seg) / d;
        if (i > 1) { a.x += dx * diff * 0.5; a.y += dy * diff * 0.5; b.x -= dx * diff * 0.5; b.y -= dy * diff * 0.5; }
        else { b.x -= dx * diff; b.y -= dy * diff; }
      }
    }
    if (o.dead) { o.squash = Math.min(1, o.squash + dt * 7); continue; }
    if (C.dead) continue;
    const b = obsBox(o);
    if (!overlap(me, b)) continue;
    if (o.kind === "bug" && C.vy > 0 && me.y0 > b.y1 - 18) {
      o.dead = true; C.vy = -720; C.jumps = 1; C.flip = 0; C.squash = -0.2;
      dist += 15; burst(PX + o.x * U, GROUND - 16 * U, COL.accent, 16); ring(PX + o.x * U, GROUND - 10 * U, COL.accent, 30);
      popText(PX + o.x * U, GROUND - 50 * U, "+15", COL.accent); shake = 0.15;
      continue;
    }
    die();
  }
  obs = obs.filter((o) => o.x > -260 && !(o.dead && o.squash >= 1 && o.t > 3));

  for (const c of chips) {
    c.x -= move; c.t += dt;
    if (!c.got && !C.dead && Math.abs(c.x) < 26 && c.y > me.y0 - 10 && c.y < me.y1 + 10) {
      c.got = true; chipCount++; dist += 5;
      const sx = PX + c.x * U, sy = GROUND - c.y * U;
      sparkle(sx, sy); ring(sx, sy, COL.chip, 18); popText(sx, sy - 14 * U, "+5", COL.chip);
    }
  }
  chips = chips.filter((c) => c.x > -100 && !c.got);

  // speed lines once things get fast
  if (speed > 520 && !C.dead && Math.random() < (speed - 520) / 900) lines.push({ x: W + 20, y: rand(H * 0.15, GROUND - 20), len: rand(40, 140) * U, v: speed * U * rand(2.2, 3.2), life: 1 });
  for (const l of lines) { l.x -= l.v * dt; l.life -= dt; }
  lines = lines.filter((l) => l.x + l.len > 0 && l.life > 0);

  // rig follows the target pose
  const target = targetPose();
  const rate = C.dead ? 10 : C.air ? 16 : C.slide > 0 ? 20 : state === "play" ? 32 : 8;
  const k = 1 - Math.exp(-dt * rate);
  for (const key of POSE_KEYS) rig[key] = lerp(rig[key], target[key], k);

  if (C.dead && C.deadT > 1.0 && state === "play") gameOver();
}
function targetPose() {
  if (state !== "play") return C.dead ? POSES.dead(time) : POSES.idle(time);
  if (C.dead) return POSES.dead(time);
  if (C.slide > 0 && !C.air) return POSES.slide();
  if (C.air) {
    if (C.flip > 0.15) return POSES.tuck();
    return C.vy < 150 ? POSES.rise() : POSES.fall(time);
  }
  const run = runPose(C.phase, clamp((speed - 330) / 570, 0, 1));
  if (C.land > 0) { const l = POSES.land(), m = C.land; for (const key of POSE_KEYS) run[key] = lerp(run[key], l[key], m); }
  return run;
}
const flipRot = () => (C.flip > 0 ? -easeInOut(1 - C.flip) * Math.PI * 2 : 0);
function easeInOut(x) { return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2; }

function die() {
  C.dead = true; C.vy = -760; C.air = true; slowmo = 0.5; shake = 0.45; flash = 0.18;
  burst(PX, GROUND - (C.y + 50) * U, COL.ink, 22);
  ring(PX, GROUND - (C.y + 50) * U, COL.accent, 50);
}
function gameOver() {
  state = "over";
  const score = Math.floor(dist);
  const isBest = score > best;
  if (isBest) { best = score; try { localStorage.setItem("carter-run-best", best); } catch {} }
  $("#big").textContent = score;
  $("#sub").textContent = isBest ? "new best" : `best ${best}`;
  $("#again").hidden = false;
  $("#ui").classList.remove("hide");
}

/* ---------- particles ---------- */
function dust(x, y, n, dir) {
  for (let i = 0; i < n; i++) {
    const side = dir === 0 ? (i % 2 ? 1 : -1) : dir;
    fx.push({ kind: "dust", x: x + rand(-6, 6) * U, y: y - rand(0, 3) * U, vx: side * rand(30, 130) * U, vy: -rand(10, 60) * U, r: rand(3, 6) * U, grow: rand(10, 22) * U, life: rand(0.35, 0.6), max: 0.6 });
  }
}
function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) { const a = rand(0, Math.PI * 2), v = rand(140, 420) * U; fx.push({ kind: "bit", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 160 * U, color, r: rand(2, 4.5) * U, rot: rand(0, 6), vr: rand(-12, 12), life: rand(0.45, 0.85), max: 0.85 }); }
}
function sparkle(x, y) {
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; fx.push({ kind: "star", x, y, vx: Math.cos(a) * 180 * U, vy: Math.sin(a) * 180 * U, color: COL.chip, r: 2.4 * U, life: 0.38, max: 0.38 }); }
}
function ring(x, y, color, r, flat) { fx.push({ kind: "ring", x, y, color, r: 4 * U, to: r * U, flat, life: 0.35, max: 0.35 }); }
function popText(x, y, text, color) { fx.push({ kind: "text", x, y, text, color, vx: 0, vy: -70 * U, life: 0.7, max: 0.7 }); }
function updateFx(dt) {
  for (const f of fx) {
    f.life -= dt; f.x += (f.vx || 0) * dt; f.y += (f.vy || 0) * dt;
    if (f.kind === "dust") { f.vx *= 0.92; f.vy *= 0.92; f.r += f.grow * dt; }
    if (f.kind === "bit") { f.vy += 900 * U * dt; f.rot += f.vr * dt; }
    if (f.kind === "star") { f.vx *= 0.9; f.vy *= 0.9; }
    if (f.kind === "text") f.vy *= 0.94;
  }
  fx = fx.filter((f) => f.life > 0);
}

/* ------------------------------------------------------------------ *
 * Drawing Carter
 * ------------------------------------------------------------------ */
// A limb segment with a dark outline, a base colour and a soft highlight — reads as rounded.
function seg(x1, y1, x2, y2, w, color, lit) {
  ctx.lineCap = "round";
  ctx.strokeStyle = COL.outline; ctx.lineWidth = w + 3 * U;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  if (lit) {
    ctx.strokeStyle = lit; ctx.lineWidth = w * 0.32;
    const nx = -(y2 - y1), ny = x2 - x1, l = Math.hypot(nx, ny) || 1, o = w * 0.22;
    ctx.beginPath(); ctx.moveTo(x1 - (nx / l) * o, y1 - (ny / l) * o); ctx.lineTo(x2 - (nx / l) * o, y2 - (ny / l) * o); ctx.stroke();
  }
}
const at = (x, y, a, l) => ({ x: x + Math.sin(a) * l, y: y + Math.cos(a) * l });
function leg(hx, hy, thigh, knee, foot, colors, u) {
  const L = 24 * u, k = at(hx, hy, thigh, L), a = at(k.x, k.y, thigh + knee, L);
  seg(hx, hy, k.x, k.y, 12.5 * u, colors[0], colors[1]);
  seg(k.x, k.y, a.x, a.y, 11 * u, colors[0], colors[1]);
  // sneaker: rotated with the ankle
  const ang = -(thigh + knee) + foot;
  ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(ang);
  ctx.fillStyle = COL.outline;
  ctx.beginPath(); ctx.roundRect(-6.5 * u, -5.5 * u, 22 * u, 11.5 * u, 5.5 * u); ctx.fill();
  ctx.fillStyle = colors[2];
  ctx.beginPath(); ctx.roundRect(-5 * u, -4 * u, 19 * u, 8.5 * u, 4.2 * u); ctx.fill();
  ctx.fillStyle = COL.sole; ctx.fillRect(-4.5 * u, 2.6 * u, 18 * u, 1.9 * u);
  ctx.restore();
}
function arm(sx, sy, sh, el, colors, u, sleeve) {
  const A = 17 * u, e = at(sx, sy, sh, A), h = at(e.x, e.y, sh + el, A - 1 * u);
  seg(sx, sy, e.x, e.y, 9.5 * u, colors[0], colors[1]);
  seg(e.x, e.y, h.x, h.y, 8.5 * u, colors[0], colors[1]);
  if (sleeve) { const m = at(sx, sy, sh, A * 0.48); seg(sx, sy, m.x, m.y, 12.5 * u, COL.tee, COL.teeLit); }
  ctx.fillStyle = COL.outline; ctx.beginPath(); ctx.arc(h.x, h.y, 5.8 * u, 0, 7); ctx.fill();
  ctx.fillStyle = colors[0]; ctx.beginPath(); ctx.arc(h.x, h.y, 4.4 * u, 0, 7); ctx.fill();
}
function drawCarter(r, y, rot, alpha, squash) {
  const u = U * 1.15;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(PX, GROUND - y * U);
  ctx.rotate(rot);
  ctx.scale(1 + squash * 0.7, 1 - squash);
  const hipX = 0, hipY = r.hipY * u, T = 34 * u;
  const shX = hipX + Math.sin(r.lean) * T, shY = hipY - Math.cos(r.lean) * T;
  // back limbs first (shadowed)
  arm(shX, shY + 4 * u, r.a1, r.e1, [COL.skinDark, null], u, true);
  leg(hipX, hipY, r.l1, r.k1, r.f1, [COL.pantsDark, null, "#d6d6d6"], u);
  // torso: a tapered tee
  const px = Math.cos(r.lean), py = Math.sin(r.lean);
  const hw = 11.5 * u, sw = 13.5 * u;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(hipX - px * hw, hipY - py * hw + 2 * u);
    ctx.lineTo(shX - px * sw, shY - py * sw + 3 * u);
    ctx.quadraticCurveTo(shX, shY - 2 * u, shX + px * sw, shY + py * sw + 3 * u);
    ctx.lineTo(hipX + px * hw, hipY + py * hw + 2 * u);
    ctx.quadraticCurveTo(hipX, hipY + 6 * u, hipX - px * hw, hipY - py * hw + 2 * u);
    ctx.closePath();
  };
  path(); ctx.lineWidth = 3 * U; ctx.strokeStyle = COL.outline; ctx.lineJoin = "round"; ctx.stroke();
  ctx.fillStyle = COL.tee; ctx.fill();
  ctx.save(); path(); ctx.clip();
  ctx.fillStyle = COL.teeLit; ctx.beginPath(); ctx.ellipse(shX - px * 4 * u, shY + 10 * u, 6 * u, 14 * u, r.lean, 0, 7); ctx.fill();
  ctx.restore();
  // front leg
  leg(hipX, hipY, r.l0, r.k0, r.f0, [COL.pants, "rgba(255,255,255,0.12)", COL.shoe], u);
  // neck + head (the photo), with a slight lag for follow-through
  const hx = shX + Math.sin(r.lean + r.head) * 23 * u, hy = shY - Math.cos(r.lean + r.head) * 23 * u, R = 25 * u;
  seg(shX, shY, hx, hy + R * 0.6, 9 * u, COL.skin, null);
  ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.beginPath(); ctx.ellipse(hx + 2 * u, hy + R * 0.85, R * 0.7, R * 0.28, 0, 0, 7); ctx.fill();
  ctx.save();
  ctx.translate(hx, hy); ctx.rotate(r.head * 0.6);
  ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.closePath();
  ctx.fillStyle = COL.skin; ctx.fill();
  if (face.complete && face.naturalWidth) { ctx.save(); ctx.clip(); ctx.drawImage(face, 104 - 90, 134 - 90, 180, 180, -R, -R, R * 2, R * 2); ctx.restore(); }
  ctx.lineWidth = 3.5 * U; ctx.strokeStyle = "#fff"; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1.5 * U; ctx.strokeStyle = COL.outline; ctx.beginPath(); ctx.arc(0, 0, R + 2.4 * U, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  // front arm on top
  arm(shX, shY + 4 * u, r.a0, r.e0, [COL.skin, COL.skinLit], u, true);
  ctx.restore();
}

/* ------------------------------------------------------------------ *
 * Drawing the world
 * ------------------------------------------------------------------ */
function drawObstacle(o) {
  const u = U, x = PX + o.x * u, g = GROUND;
  ctx.save();
  // soft contact shadow
  if (o.kind !== "cable" && o.kind !== "fly") { ctx.fillStyle = "rgba(0,0,0,0.12)"; ctx.beginPath(); ctx.ellipse(x, g + 2 * u, (o.w / 2 + 4) * u, 5 * u, 0, 0, 7); ctx.fill(); }
  if (o.kind === "fan") {
    const s = o.w * u, y = g - s, wob = Math.sin(o.t * 40) * 0.6 * u;
    ctx.translate(wob, 0);
    ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.roundRect(x - s / 2, y, s, s, 11 * u); ctx.fill();
    ctx.fillStyle = "#2d2e33"; ctx.beginPath(); ctx.arc(x, y + s / 2, s * 0.4, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(x, y + s / 2);
    for (let blur = 0; blur < 3; blur++) {                       // motion blur: three faded copies
      ctx.save(); ctx.rotate(o.t * 16 - blur * 0.18); ctx.globalAlpha = blur ? 0.25 : 1;
      ctx.fillStyle = "#a3a7b0";
      for (let i = 0; i < 5; i++) { ctx.rotate((Math.PI * 2) / 5); ctx.beginPath(); ctx.ellipse(s * 0.2, 0, s * 0.19, s * 0.075, 0.55, 0, 7); ctx.fill(); }
      ctx.restore();
    }
    ctx.fillStyle = COL.accent; ctx.beginPath(); ctx.arc(0, 0, s * 0.085, 0, 7); ctx.fill();
    ctx.restore();
  } else if (o.kind === "tower") {
    const near = clamp(1 - (o.x - 40) / 320, 0, 1);
    const w = o.w * u, h = o.h * u * (1 + Math.sin(o.t * 3) * 0.012), y = g - h, jit = Math.sin(o.t * 70) * 1.8 * u * near;
    ctx.translate(jit, 0);
    ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.roundRect(x - w / 2, y, w, h, 9 * u); ctx.fill();
    ctx.fillStyle = "#2d2e33"; ctx.fillRect(x - w / 2 + 6 * u, y + 6 * u, w - 12 * u, 36 * u);
    const blink = (o.t % 2.6) < 0.12 ? 0.15 : 1, look = -2 * u;
    for (const s of [-1, 1]) {
      ctx.fillStyle = COL.accent; ctx.beginPath(); ctx.ellipse(x + s * 9 * u + look, y + 25 * u, 5 * u, 5 * u * blink, 0, 0, 7); ctx.fill();
      ctx.fillStyle = "rgba(255,90,78,0.25)"; ctx.beginPath(); ctx.arc(x + s * 9 * u + look, y + 25 * u, 9 * u, 0, 7); ctx.fill();
    }
    ctx.strokeStyle = COL.accent; ctx.lineWidth = 3 * u; ctx.lineCap = "round";
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + s * 15 * u, y + (14 - near * 2) * u); ctx.lineTo(x + s * 4 * u, y + (19 + near * 2) * u); ctx.stroke(); }
    ctx.fillStyle = "#3b3d44";
    for (let i = 0; i < 4; i++) ctx.fillRect(x - w / 2 + 9 * u, y + (52 + i * 14) * u, w - 18 * u, 4 * u);
  } else if (o.kind === "cable") {
    const pts = o.rope.map((p) => ({ x: PX + p.x * u, y: g - p.y * u }));
    ctx.strokeStyle = COL.ink; ctx.lineWidth = 5 * u; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(pts[0].x, -10);
    for (let i = 1; i < pts.length - 1; i++) ctx.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
    const e = pts[pts.length - 1], pe = pts[pts.length - 2];
    ctx.lineTo(e.x, e.y); ctx.stroke();
    const ang = Math.atan2(e.x - pe.x, pe.y - e.y);
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(-ang);
    ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.roundRect(-10 * u, -6 * u, 20 * u, 20 * u, 5 * u); ctx.fill();
    ctx.fillStyle = COL.accent; ctx.fillRect(-6 * u, 14 * u, 3.5 * u, 7 * u); ctx.fillRect(2.5 * u, 14 * u, 3.5 * u, 7 * u);
    ctx.restore();
  } else if (o.kind === "bug") {
    const sq = o.squash, hop = o.dead ? 0 : Math.abs(Math.sin(o.t * 9)) * 4 * u, stretch = o.dead ? 0 : Math.sin(o.t * 18) * 0.06;
    const w = o.w * u * (1 + sq * 0.5 - stretch), h = o.h * u * (1 - sq * 0.78 + stretch), y = g - h - hop;
    ctx.strokeStyle = COL.ink; ctx.lineWidth = 2.6 * u; ctx.lineCap = "round";
    if (!o.dead) for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
      const lx = x + (i - 1) * 12 * u, stepX = Math.sin(o.t * 18 + i * 2 + (s > 0 ? Math.PI : 0)) * 6 * u, lift = Math.max(0, Math.cos(o.t * 18 + i * 2 + (s > 0 ? Math.PI : 0))) * 4 * u;
      ctx.beginPath(); ctx.moveTo(lx, y + h * 0.6); ctx.quadraticCurveTo(lx + stepX * 0.5, y + h, lx + stepX - 3 * u, g - lift); ctx.stroke();
    }
    ctx.fillStyle = COL.accent; ctx.beginPath(); ctx.ellipse(x, y + h / 2, w / 2, h / 2, 0, 0, 7); ctx.fill();
    ctx.fillStyle = COL.accentDark; ctx.beginPath(); ctx.ellipse(x + 3 * u, y + h * 0.62, w * 0.38, h * 0.3, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.beginPath(); ctx.ellipse(x - 6 * u, y + h * 0.28, w * 0.18, h * 0.12, -0.3, 0, 7); ctx.fill();
    if (!o.dead) {
      for (const s of [-1, 1]) {
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x - 12 * u + s * 6 * u, y + h * 0.35, 5.2 * u, 0, 7); ctx.fill();
        ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.arc(x - 14 * u + s * 6 * u, y + h * 0.38 - C.y * 0.01 * u, 2.5 * u, 0, 7); ctx.fill();
      }
    } else { ctx.strokeStyle = COL.ink; ctx.lineWidth = 2 * u; for (const s of [-1, 1]) { const ex = x - 12 * u + s * 6 * u, ey = y + h * 0.4; ctx.beginPath(); ctx.moveTo(ex - 3 * u, ey - 3 * u); ctx.lineTo(ex + 3 * u, ey + 3 * u); ctx.moveTo(ex + 3 * u, ey - 3 * u); ctx.lineTo(ex - 3 * u, ey + 3 * u); ctx.stroke(); } }
  } else if (o.kind === "fly") {
    const y = g - (o.y + o.h / 2) * u, tilt = Math.sin(o.t * 4) * 0.12;
    ctx.translate(x, y); ctx.rotate(tilt);
    const flap = Math.sin(o.t * 46);
    ctx.fillStyle = "rgba(120,130,150,0.28)";
    for (const [dx, a] of [[-3, -0.5], [7, 0.5]]) { ctx.beginPath(); ctx.ellipse(dx * u, -11 * u, 11 * u, (3 + 5 * Math.abs(flap)) * u, a + flap * 0.4, 0, 7); ctx.fill(); }
    ctx.fillStyle = COL.accent; ctx.beginPath(); ctx.ellipse(0, 0, 18 * u, 11 * u, 0, 0, 7); ctx.fill();
    ctx.fillStyle = COL.accentDark; ctx.beginPath(); ctx.ellipse(5 * u, 3 * u, 11 * u, 6 * u, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-9 * u, -2 * u, 4.8 * u, 0, 7); ctx.fill();
    ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.arc(-11 * u, -1 * u, 2.3 * u, 0, 7); ctx.fill();
    ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.6 * u; ctx.beginPath(); ctx.moveTo(14 * u, 0); ctx.lineTo(21 * u, 2 * u); ctx.stroke();
  }
  ctx.restore();
}

function drawWorld() {
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, COL.bg); sky.addColorStop(1, COL.bg2);
  ctx.fillStyle = sky; ctx.fillRect(0, -200, W, GROUND + 200);
  const layer = (factor, color, seed, minH, maxH, wMin, wMax, gap, yOff) => {
    ctx.fillStyle = color;
    const sc = scroll * factor * U, gp = gap * U;
    for (let i = -1; i < W / gp + 2; i++) {
      const k = i + Math.floor(sc / gp), r = Math.abs(Math.sin(k * 12.9898 + seed) * 43758.5453) % 1;
      const h = (minH + r * (maxH - minH)) * U, w = (wMin + r * (wMax - wMin)) * U, x = i * gp - (sc % gp);
      ctx.beginPath(); ctx.roundRect(x, GROUND - h + yOff, w, h, 6 * U); ctx.fill();
      if (r > 0.6) { ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(x + w * 0.2, GROUND - h + yOff + 12 * U, w * 0.6, 4 * U); ctx.fillStyle = color; }
    }
  };
  layer(0.12, COL.far, 1, 110, 240, 60, 120, 160, -camY * 0.4 * U);
  layer(0.38, COL.mid, 7, 40, 120, 40, 95, 220, -camY * 0.15 * U);
  ctx.fillStyle = COL.ground; ctx.fillRect(0, GROUND, W, 3 * U);
  const fl = ctx.createLinearGradient(0, GROUND, 0, H);
  fl.addColorStop(0, "#e7e2da"); fl.addColorStop(1, "#ddd6cc");
  ctx.fillStyle = fl; ctx.fillRect(0, GROUND + 3 * U, W, H - GROUND + 200);
  ctx.fillStyle = "#d3ccc1";
  const step = 60 * U, o = (scroll * U) % step;
  for (let x = -o; x < W; x += step) ctx.fillRect(x, GROUND + 14 * U, 22 * U, 3 * U);
  const step2 = 110 * U, o2 = (scroll * 1.25 * U) % step2;
  for (let x = -o2; x < W; x += step2) ctx.fillRect(x, GROUND + 38 * U, 46 * U, 4 * U);
}
function drawChips() {
  for (const c of chips) {
    const x = PX + c.x * U, y = GROUND - c.y * U + Math.sin(c.t * 3) * 3 * U, s = Math.cos(c.t * 4);
    ctx.fillStyle = "rgba(20,184,166,0.15)"; ctx.beginPath(); ctx.arc(x, y, 12 * U, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(x, y); ctx.scale(Math.max(0.18, Math.abs(s)), 1);
    ctx.fillStyle = COL.chip; ctx.beginPath(); ctx.moveTo(0, -9 * U); ctx.lineTo(7 * U, 0); ctx.lineTo(0, 9 * U); ctx.lineTo(-7 * U, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.beginPath(); ctx.moveTo(0, -9 * U); ctx.lineTo(3.5 * U, -2 * U); ctx.lineTo(0, 0); ctx.lineTo(-3.5 * U, -2 * U); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
function drawFx() {
  for (const f of fx) {
    const a = Math.max(0, f.life / f.max);
    if (f.kind === "dust") { ctx.globalAlpha = a * 0.55; ctx.fillStyle = "#cbc3b7"; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill(); }
    if (f.kind === "bit") { ctx.globalAlpha = Math.min(1, a * 1.5); ctx.fillStyle = f.color; ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.fillRect(-f.r, -f.r * 0.6, f.r * 2, f.r * 1.2); ctx.restore(); }
    if (f.kind === "star") { ctx.globalAlpha = a; ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * a + 0.5, 0, 7); ctx.fill(); }
    if (f.kind === "ring") {
      const k = 1 - a, r = lerp(f.r, f.to, 1 - (1 - k) ** 3);
      ctx.globalAlpha = a; ctx.strokeStyle = f.color; ctx.lineWidth = 3 * U * a + 0.5;
      ctx.beginPath(); f.flat ? ctx.ellipse(f.x, f.y, r * 1.6, r * 0.35, 0, 0, 7) : ctx.arc(f.x, f.y, r, 0, 7); ctx.stroke();
    }
    if (f.kind === "text") { ctx.globalAlpha = Math.min(1, a * 2); ctx.fillStyle = f.color; ctx.font = `800 ${Math.round(15 * U)}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.fillText(f.text, f.x, f.y); }
  }
  ctx.globalAlpha = 1;
}
function drawLines() {
  ctx.strokeStyle = "rgba(29,29,31,0.12)"; ctx.lineWidth = 2 * U; ctx.lineCap = "round";
  for (const l of lines) { ctx.globalAlpha = Math.min(1, l.life * 3); ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(l.x + l.len, l.y); ctx.stroke(); }
  ctx.globalAlpha = 1;
}
let shownScore = 0, scorePop = 0;
function drawHud() {
  if (state !== "play") return;
  const s = Math.floor(dist);
  if (s !== shownScore) { if (Math.floor(s / 100) > Math.floor(shownScore / 100)) scorePop = 1; shownScore = s; }
  scorePop = Math.max(0, scorePop - 0.04);
  ctx.textAlign = "center"; ctx.fillStyle = COL.ink;
  ctx.font = `800 ${Math.round(34 * Math.max(0.8, U) * (1 + scorePop * 0.25))}px system-ui, sans-serif`;
  ctx.fillText(s, W / 2, 58);
  if (chipCount) { ctx.fillStyle = COL.chip; ctx.font = `700 ${Math.round(14 * Math.max(0.9, U))}px system-ui, sans-serif`; ctx.fillText(`◆ ${chipCount}`, W / 2, 82); }
}

function draw() {
  ctx.save();
  if (shake > 0) ctx.translate(rand(-9, 9) * shake, rand(-9, 9) * shake);
  ctx.translate(0, camY * U);
  drawWorld();
  drawLines();
  drawChips();
  for (const o of obs) drawObstacle(o);
  // Carter's ground shadow
  ctx.fillStyle = "rgba(0,0,0,0.14)";
  ctx.beginPath(); ctx.ellipse(PX + (C.slide > 0 ? 4 : 0) * U, GROUND + 2 * U, (C.slide > 0 && !C.air ? 34 : 24) * U * (1 - Math.min(0.6, C.y / 320)), 5 * U, 0, 0, 7); ctx.fill();
  for (const g of ghosts) { ctx.save(); ctx.translate(g.sx * U, 0); drawCarter(g.rig, g.y, g.rot, 0.13 * (g.life / 0.18), 0); ctx.restore(); }
  const rot = C.dead ? -C.rot : flipRot();
  drawCarter(rig, C.y, rot, 1, C.squash);
  drawFx();
  ctx.restore();
  if (flash > 0) { ctx.fillStyle = `rgba(255,90,78,${flash})`; ctx.fillRect(0, 0, W, H); }
  drawHud();
}

/* ------------------------------------------------------------------ *
 * Loop
 * ------------------------------------------------------------------ */
const STEP = 1 / 120;
let last = performance.now(), acc = 0;
function frame(now) {
  const real = Math.min(0.05, (now - last) / 1000); last = now;
  slowmo = Math.max(0, slowmo - real);
  const scale = slowmo > 0 ? 0.35 : 1;
  if (state === "play") {
    acc += real * scale;
    while (acc >= STEP) { step(STEP, STEP / scale); acc -= STEP; }
  } else {
    time += real;
    const target = targetPose(), k = 1 - Math.exp(-real * 8);
    for (const key of POSE_KEYS) rig[key] = lerp(rig[key], target[key], k);
    if (C.dead) {
      C.vy += 2500 * real; C.y = Math.max(0, C.y - C.vy * real); if (C.y === 0) C.vy = 0;
      // settle flat on the ground (nearest "lying down" angle)
      const flat = Math.round((C.rot - Math.PI / 2) / Math.PI) * Math.PI + Math.PI / 2;
      C.rot = lerp(C.rot, flat, 1 - Math.exp(-real * 6));
    }
  }
  updateFx(real);
  shake = Math.max(0, shake - real);
  flash = Math.max(0, flash - real * 1.5);
  draw();
  requestAnimationFrame(frame);
}

resize();
reset();
requestAnimationFrame(frame);
