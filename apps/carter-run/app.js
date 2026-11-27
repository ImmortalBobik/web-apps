// Carter Run — a minimalist side-scrolling runner.
// Tap / Space / ↑ to jump (again in the air to flip), swipe down / ↓ to slide.
// Stomp bugs, dodge fans, towers, cables and flying bugs, grab chips. It keeps getting faster.
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
  bg: "#f4f1ec", far: "#e8e3db", mid: "#ddd6cb", ground: "#1d1d1f", ink: "#1d1d1f",
  accent: "#ff5a4e", chip: "#14b8a6", skin: "#8a5a40", skinDark: "#6f4632", tee: "#1d1d1f", pants: "#4b5563", shoe: "#f8f9fa",
};
const face = new Image();
face.src = "carter.png";
const rand = (a, b) => a + Math.random() * (b - a);
const ease = (x) => 1 - (1 - x) * (1 - x);

let best = 0;
try { best = +localStorage.getItem("carter-run-best") || 0; } catch {}

/* ------------------------------------------------------------------ *
 * State
 * ------------------------------------------------------------------ */
let state = "ready", C, obs, chips, fx, speed, dist, chipCount, spawnIn, shake, slowmo, time, scroll;
function reset() {
  C = { y: 0, vy: 0, air: false, jumps: 0, slide: 0, flip: 0, land: 0, phase: 0, dead: false, deadT: 0, rot: 0, dustT: 0 };
  obs = []; chips = []; fx = [];
  speed = 330; dist = 0; chipCount = 0; spawnIn = 1.2; shake = 0; slowmo = 0; time = 0; scroll = 0;
}

/* ------------------------------------------------------------------ *
 * Input
 * ------------------------------------------------------------------ */
function jump() {
  if (state === "ready" || state === "over") return start();
  if (C.dead) return;
  if (!C.air) { C.vy = -900; C.air = true; C.jumps = 1; C.slide = 0; puff(PX, GROUND, 6); }
  else if (C.jumps < 2) { C.vy = -820; C.jumps = 2; C.flip = 1; puff(PX, GROUND - C.y * U, 5); }
}
function slide() {
  if (state !== "play" || C.dead) return;
  if (C.air) C.vy = Math.max(C.vy, 900);           // fast-fall
  C.slide = 0.65;
}
addEventListener("keydown", (e) => {
  const k = e.key;
  if ([" ", "ArrowUp", "w", "W"].includes(k)) { e.preventDefault(); if (!e.repeat) jump(); }
  if (["ArrowDown", "s", "S"].includes(k)) { e.preventDefault(); slide(); }
  if (k === "Enter" && state !== "play") start();
});
let touch = null;
canvas.addEventListener("pointerdown", (e) => { touch = { x: e.clientX, y: e.clientY, t: performance.now(), used: false }; });
canvas.addEventListener("pointermove", (e) => {
  if (!touch || touch.used) return;
  if (e.clientY - touch.y > 30) { touch.used = true; slide(); }
});
canvas.addEventListener("pointerup", () => { if (touch && !touch.used) jump(); touch = null; });
$("#again").addEventListener("click", (e) => { e.stopPropagation(); start(); });

function start() {
  reset();
  state = "play";
  $("#ui").classList.add("hide");
  $("#again").hidden = true;
}

/* ------------------------------------------------------------------ *
 * Obstacles (world units: 1 = 1 px at U = 1, x measured from Carter)
 * ------------------------------------------------------------------ */
const KINDS = ["fan", "tower", "cable", "bug", "fly"];
function spawn() {
  const lvl = Math.min(1, dist / 4000);
  const pool = lvl < 0.15 ? ["fan", "bug", "fan"] : lvl < 0.35 ? ["fan", "bug", "cable", "tower"] : KINDS;
  const kind = pool[Math.floor(Math.random() * pool.length)];
  const x = (W - PX) / U + 120;
  const o = { kind, x, t: 0, dead: false, squash: 0 };
  if (kind === "fan") Object.assign(o, { w: 52, h: 52, y: 0 });
  if (kind === "tower") Object.assign(o, { w: 46, h: 118, y: 0 });
  if (kind === "cable") Object.assign(o, { w: 18, h: 0, y: 72, top: true });   // hangs down to 72 above ground
  if (kind === "bug") Object.assign(o, { w: 46, h: 30, y: 0, walk: 70 });
  if (kind === "fly") Object.assign(o, { w: 40, h: 26, y: 62 });
  obs.push(o);
  // a little arc of chips over or after some obstacles
  if (Math.random() < 0.55) {
    const n = 5, over = kind === "fan" || kind === "bug";
    for (let i = 0; i < n; i++) chips.push({ x: x + (over ? (i - 2) * 34 : 140 + i * 34), y: over ? 120 + Math.sin((i / (n - 1)) * Math.PI) * 60 : 40, got: false, t: rand(0, 6) });
  }
  const gap = rand(1.0, 1.7) * (1 - 0.35 * lvl);
  spawnIn = Math.max(0.55, gap * (420 / speed) * 1.25);
}

// Carter's hitbox (world units, x relative to Carter, y up from ground)
function hitbox() {
  if (C.slide > 0 && !C.air) return { x0: -26, x1: 30, y0: 0, y1: 42 };
  return { x0: -16, x1: 18, y0: C.y, y1: C.y + 92 };
}
function obsBox(o) {
  if (o.kind === "cable") return { x0: o.x - 9, x1: o.x + 9, y0: o.y, y1: 2000 };
  return { x0: o.x - o.w / 2 + 4, x1: o.x + o.w / 2 - 4, y0: o.y, y1: o.y + o.h - 4 };
}
const overlap = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

/* ------------------------------------------------------------------ *
 * Update
 * ------------------------------------------------------------------ */
function update(dtReal) {
  slowmo = Math.max(0, slowmo - dtReal);
  const dt = dtReal * (slowmo > 0 ? 0.35 : 1);
  time += dt;
  if (!C.dead) { speed = Math.min(900, 330 + dist * 0.045); dist += speed * dt / 10; }
  const move = C.dead ? speed * 0.25 * dt : speed * dt;
  scroll += move;

  // Carter physics
  C.vy += 2500 * dt;
  C.y -= C.vy * dt;
  if (C.y <= 0) {
    if (C.air && !C.dead) { C.land = 1; puff(PX, GROUND, 8); }
    C.y = 0; C.vy = 0; C.air = false; C.jumps = 0; C.flip = 0;
  }
  C.slide = Math.max(0, C.slide - dt);
  C.flip = Math.max(0, C.flip - dt / 0.42);
  C.land = Math.max(0, C.land - dt * 6);
  if (!C.air && !C.dead) C.phase += dt * (speed / 38);
  if (C.dead) { C.deadT += dt; C.rot += dt * 7; }
  // running dust
  C.dustT -= dt;
  if (!C.air && !C.dead && C.dustT <= 0) { C.dustT = C.slide > 0 ? 0.04 : 0.16; puff(PX - 14 * U, GROUND, 1); }

  if (!C.dead) {
    spawnIn -= dt;
    if (spawnIn <= 0) spawn();
  }

  const me = hitbox();
  for (const o of obs) {
    o.t += dt;
    o.x -= move + (o.kind === "bug" && !o.dead ? o.walk * dt : 0);
    if (o.kind === "fly") o.y = 62 + Math.sin(o.t * 4) * 8;
    if (o.dead) { o.squash = Math.min(1, o.squash + dt * 6); continue; }
    if (C.dead) continue;
    const b = obsBox(o);
    if (!overlap(me, b)) continue;
    // stomp: landing on a bug from above squashes it
    if (o.kind === "bug" && C.vy > 0 && me.y0 > b.y1 - 18) {
      o.dead = true; C.vy = -700; C.jumps = 1; C.flip = 0;
      dist += 15; burst(PX + o.x * 0 + (o.x) * U, GROUND - 16 * U, COL.accent, 14); shake = 0.15;
      continue;
    }
    die();
  }
  obs = obs.filter((o) => o.x > -200 && !(o.dead && o.squash >= 1 && o.t > 2));

  for (const c of chips) {
    c.x -= move; c.t += dt;
    if (!c.got && !C.dead && Math.abs(c.x) < 26 && c.y > me.y0 - 10 && c.y < me.y1 + 10) {
      c.got = true; chipCount++; dist += 5;
      sparkle(PX + c.x * U, GROUND - c.y * U);
    }
  }
  chips = chips.filter((c) => c.x > -100 && !c.got);

  for (const f of fx) {
    f.life -= dtReal; f.x += f.vx * dtReal; f.y += f.vy * dtReal;
    if (f.kind === "dust") { f.vx *= 0.94; f.vy *= 0.94; f.r += dtReal * 18 * U; }
    else { f.vy += 600 * dtReal; }
  }
  fx = fx.filter((f) => f.life > 0);
  shake = Math.max(0, shake - dtReal);

  if (C.dead && C.deadT > 0.9 && state === "play") gameOver();
}

function die() {
  C.dead = true; C.vy = -700; C.air = true; slowmo = 0.45; shake = 0.4;
  burst(PX, GROUND - (C.y + 50) * U, COL.ink, 18);
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

function puff(x, y, n) {
  for (let i = 0; i < n; i++) fx.push({ kind: "dust", x: x + rand(-8, 8) * U, y: y - rand(0, 4) * U, vx: rand(-90, -10) * U, vy: rand(-40, -5) * U, r: rand(3, 6) * U, life: rand(0.3, 0.55), max: 0.55 });
}
function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) { const a = rand(0, Math.PI * 2), v = rand(120, 380) * U; fx.push({ kind: "bit", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 150 * U, color, r: rand(2, 4) * U, life: rand(0.4, 0.8), max: 0.8 }); }
}
function sparkle(x, y) {
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; fx.push({ kind: "bit", x, y, vx: Math.cos(a) * 160 * U, vy: Math.sin(a) * 160 * U, color: COL.chip, r: 2.5 * U, life: 0.35, max: 0.35 }); }
}

/* ------------------------------------------------------------------ *
 * Drawing
 * ------------------------------------------------------------------ */
function limb(x, y, a1, l1, a2, l2, w, color) {
  // two-segment limb from (x, y); angles measured from straight down, + = forward
  const kx = x + Math.sin(a1) * l1, ky = y + Math.cos(a1) * l1;
  const ex = kx + Math.sin(a1 + a2) * l2, ey = ky + Math.cos(a1 + a2) * l2;
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(kx, ky); ctx.lineTo(ex, ey); ctx.stroke();
  return { x: ex, y: ey, a: a1 + a2 };
}
function drawCarter() {
  const u = U;
  const baseY = GROUND - C.y * u;
  const sliding = C.slide > 0 && !C.air && !C.dead;
  const p = C.phase;
  // squash & stretch
  const stretch = C.air ? Math.min(0.12, Math.abs(C.vy) / 6000) : 0;
  const sq = C.land * 0.18;
  ctx.save();
  ctx.translate(PX, baseY);
  // ground shadow (stays on the ground)
  ctx.save(); ctx.translate(0, C.y * u);
  ctx.fillStyle = "rgba(0,0,0,0.12)"; ctx.beginPath(); ctx.ellipse(0, 2 * u, 26 * u * (1 - Math.min(0.6, C.y / 300)), 5 * u, 0, 0, 7); ctx.fill();
  ctx.restore();
  ctx.scale(1.15 * (1 + sq - stretch * 0.5), 1.15 * (1 - sq + stretch)); // Carter drawn a bit larger than his hitbox

  let hipY = -46 * u, lean = 0.12, legA = [0, 0], kneeA = [0, 0], armA = [0, 0], elbowA = [0, 0];
  if (C.dead) {
    ctx.rotate(-C.rot); lean = 0; legA = [0.6, -0.4]; kneeA = [0.5, 0.8]; armA = [-2.4, 2.2]; elbowA = [0.3, 0.3];
  } else if (sliding) {
    hipY = -14 * u; lean = -1.05; legA = [1.45, 1.3]; kneeA = [-0.15, -0.05]; armA = [1.1, 0.7]; elbowA = [-0.6, -0.4];
  } else if (C.air) {
    if (C.flip > 0) ctx.rotate(-(1 - C.flip) * Math.PI * 2);
    const up = C.vy < 0;
    lean = 0.05; legA = up ? [0.9, -0.1] : [0.5, 0.2]; kneeA = up ? [-1.5, -0.9] : [-0.9, -0.6];
    armA = up ? [-2.6, -2.2] : [-1.5, 1.4]; elbowA = [-0.3, -0.2];
  } else {
    const s = Math.sin(p), c = Math.cos(p);
    legA = [s * 0.75, -s * 0.75];
    kneeA = [-Math.max(0, -c) * 1.4 - 0.2, -Math.max(0, c) * 1.4 - 0.2];
    armA = [-s * 0.9, s * 0.9]; elbowA = [-1.1, -1.1];
    hipY -= Math.abs(Math.cos(p)) * 4 * u;          // bob twice per stride
  }
  const L = 24 * u, T = 34 * u, A = 17 * u;
  // back leg + back arm (darker), then torso, front leg + arm
  const hipX = 0;
  const backLeg = limb(hipX, hipY, legA[1], L, kneeA[1], L, 11 * u, "#374151");
  shoe(backLeg, u, "#d9d9d9");
  const shY = hipY - Math.cos(lean) * T, shX = hipX + Math.sin(lean) * T;
  limb(shX, shY + 4 * u, armA[1], A, elbowA[1], A, 8.5 * u, COL.skinDark);
  // torso (tee)
  ctx.strokeStyle = COL.tee; ctx.lineWidth = 24 * u; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(hipX, hipY - 2 * u); ctx.lineTo(shX, shY + 6 * u); ctx.stroke();
  const frontLeg = limb(hipX, hipY, legA[0], L, kneeA[0], L, 11.5 * u, COL.pants);
  shoe(frontLeg, u, COL.shoe);
  // neck + head (the photo), big and clear
  const hx = shX + Math.sin(lean) * 23 * u, hy = shY - Math.cos(lean) * 23 * u, R = 25 * u;
  ctx.strokeStyle = COL.skin; ctx.lineWidth = 9 * u;
  ctx.beginPath(); ctx.moveTo(shX, shY); ctx.lineTo(hx, hy); ctx.stroke();
  ctx.save();
  ctx.beginPath(); ctx.arc(hx, hy, R, 0, Math.PI * 2); ctx.closePath();
  ctx.fillStyle = COL.skin; ctx.fill();
  if (face.complete && face.naturalWidth) { ctx.clip(); ctx.drawImage(face, 104 - 90, 134 - 90, 180, 180, hx - R, hy - R, R * 2, R * 2); }
  ctx.restore();
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.arc(hx, hy, R, 0, Math.PI * 2); ctx.stroke();
  limb(shX, shY + 4 * u, armA[0], A, elbowA[0], A, 9 * u, COL.skin);
  ctx.restore();
}
function shoe(end, u, color) {
  ctx.fillStyle = color; ctx.strokeStyle = COL.ink; ctx.lineWidth = 2 * u;
  ctx.beginPath(); ctx.ellipse(end.x + 5 * u, end.y + 1 * u, 9 * u, 5 * u, 0, 0, 7); ctx.fill(); ctx.stroke();
}

function drawObstacle(o) {
  const u = U, x = PX + o.x * u, g = GROUND;
  ctx.save();
  if (o.kind === "fan") {
    const s = o.w * u, y = g - s;
    ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.roundRect(x - s / 2, y, s, s, 10 * u); ctx.fill();
    ctx.translate(x, y + s / 2); ctx.rotate(o.t * 14);
    ctx.fillStyle = "#9ca3af";
    for (let i = 0; i < 5; i++) { ctx.rotate((Math.PI * 2) / 5); ctx.beginPath(); ctx.ellipse(s * 0.2, 0, s * 0.2, s * 0.08, 0.5, 0, 7); ctx.fill(); }
    ctx.fillStyle = COL.accent; ctx.beginPath(); ctx.arc(0, 0, s * 0.08, 0, 7); ctx.fill();
  } else if (o.kind === "tower") {
    const w = o.w * u, h = o.h * u, y = g - h;
    ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.roundRect(x - w / 2, y, w, h, 8 * u); ctx.fill();
    // angry LED eyes that blink
    const blink = (o.t % 2.4) < 0.12 ? 0.2 : 1;
    ctx.fillStyle = COL.accent;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + s * 9 * u, y + 24 * u, 4.5 * u, 4.5 * u * blink, 0, 0, 7); ctx.fill(); }
    ctx.strokeStyle = COL.accent; ctx.lineWidth = 3 * u;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + s * 15 * u, y + 15 * u); ctx.lineTo(x + s * 4 * u, y + 19 * u); ctx.stroke(); }
    ctx.fillStyle = "#374151";
    for (let i = 0; i < 4; i++) ctx.fillRect(x - w / 2 + 8 * u, y + (46 + i * 14) * u, w - 16 * u, 4 * u);
  } else if (o.kind === "cable") {
    const sway = Math.sin(o.t * 3) * 6 * u, endY = g - o.y * u;
    ctx.strokeStyle = COL.ink; ctx.lineWidth = 5 * u; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.quadraticCurveTo(x + sway * 2, endY * 0.6, x + sway, endY - 16 * u); ctx.stroke();
    ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.roundRect(x + sway - 9 * u, endY - 18 * u, 18 * u, 18 * u, 4 * u); ctx.fill();
    ctx.fillStyle = COL.accent; ctx.fillRect(x + sway - 5 * u, endY - 2 * u, 3 * u, 6 * u); ctx.fillRect(x + sway + 2 * u, endY - 2 * u, 3 * u, 6 * u);
  } else if (o.kind === "bug") {
    const sq = o.squash, w = o.w * u, h = o.h * u * (1 - sq * 0.75), y = g - h;
    ctx.strokeStyle = COL.ink; ctx.lineWidth = 2.5 * u; ctx.lineCap = "round";
    if (!o.dead) for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
      const lx = x + (i - 1) * 12 * u, step = Math.sin(o.t * 18 + i * 2 + (s > 0 ? Math.PI : 0)) * 5 * u;
      ctx.beginPath(); ctx.moveTo(lx, g - h * 0.4); ctx.lineTo(lx + step - 3 * u, g); ctx.stroke();
    }
    ctx.fillStyle = COL.accent; ctx.beginPath(); ctx.ellipse(x, y + h / 2, w / 2, h / 2, 0, 0, 7); ctx.fill();
    if (!o.dead) {
      // eyes look at Carter
      for (const s of [-1, 1]) {
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x - 12 * u + s * 6 * u, y + h * 0.35, 5 * u, 0, 7); ctx.fill();
        ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.arc(x - 14 * u + s * 6 * u, y + h * 0.37, 2.4 * u, 0, 7); ctx.fill();
      }
    }
  } else if (o.kind === "fly") {
    const y = g - (o.y + o.h / 2) * u;
    ctx.fillStyle = "rgba(29,29,31,0.15)";
    const flap = Math.abs(Math.sin(o.t * 30)) * 12 * u;
    ctx.beginPath(); ctx.ellipse(x - 2 * u, y - 10 * u, 10 * u, 4 * u + flap * 0.5, -0.4, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 8 * u, y - 10 * u, 10 * u, 4 * u + flap * 0.5, 0.4, 0, 7); ctx.fill();
    ctx.fillStyle = COL.accent; ctx.beginPath(); ctx.ellipse(x, y, 18 * u, 11 * u, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x - 9 * u, y - 2 * u, 4.5 * u, 0, 7); ctx.fill();
    ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.arc(x - 11 * u, y - 1 * u, 2.2 * u, 0, 7); ctx.fill();
  }
  ctx.restore();
}

function drawWorld() {
  ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, W, H);
  // parallax silhouettes: far PC towers, mid monitors
  const layer = (factor, color, seed, minH, maxH, wMin, wMax, gap) => {
    ctx.fillStyle = color;
    const off = (scroll * factor * U) % (gap * U * 8);
    for (let i = -1; i < W / (gap * U) + 2; i++) {
      const k = i + Math.floor((scroll * factor * U) / (gap * U));
      const r = Math.abs(Math.sin(k * 12.9898 + seed) * 43758.5453) % 1;
      const h = (minH + r * (maxH - minH)) * U, w = (wMin + r * (wMax - wMin)) * U;
      const x = i * gap * U - ((scroll * factor * U) % (gap * U));
      ctx.beginPath(); ctx.roundRect(x, GROUND - h, w, h, 6 * U); ctx.fill();
    }
    return off;
  };
  layer(0.15, COL.far, 1, 90, 220, 60, 110, 150);
  layer(0.4, COL.mid, 7, 40, 110, 40, 90, 210);
  // ground
  ctx.fillStyle = COL.ground; ctx.fillRect(0, GROUND, W, 3 * U);
  ctx.fillStyle = "#e5e0d8"; ctx.fillRect(0, GROUND + 3 * U, W, H - GROUND);
  ctx.fillStyle = "#d6d0c6";
  const step = 60 * U, o = (scroll * U) % step;
  for (let x = -o; x < W; x += step) ctx.fillRect(x, GROUND + 14 * U, 22 * U, 3 * U);
}
function drawChips() {
  for (const c of chips) {
    const x = PX + c.x * U, y = GROUND - c.y * U, s = Math.cos(c.t * 4);
    ctx.save(); ctx.translate(x, y); ctx.scale(Math.max(0.2, Math.abs(s)), 1);
    ctx.fillStyle = COL.chip; ctx.beginPath(); ctx.moveTo(0, -8 * U); ctx.lineTo(6 * U, 0); ctx.lineTo(0, 8 * U); ctx.lineTo(-6 * U, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
function drawFx() {
  for (const f of fx) {
    ctx.globalAlpha = Math.max(0, f.life / f.max) * (f.kind === "dust" ? 0.5 : 1);
    ctx.fillStyle = f.kind === "dust" ? "#cfc8bd" : f.color;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function drawHud() {
  if (state !== "play") return;
  ctx.textAlign = "center"; ctx.fillStyle = COL.ink;
  ctx.font = `800 ${Math.round(34 * Math.max(0.8, U))}px system-ui, sans-serif`;
  ctx.fillText(Math.floor(dist), W / 2, 56);
  if (chipCount) {
    ctx.fillStyle = COL.chip; ctx.font = `700 ${Math.round(14 * Math.max(0.9, U))}px system-ui, sans-serif`;
    ctx.fillText(`◆ ${chipCount}`, W / 2, 80);
  }
}

function draw() {
  ctx.save();
  if (shake > 0) ctx.translate(rand(-8, 8) * shake, rand(-8, 8) * shake);
  drawWorld();
  drawChips();
  for (const o of obs) drawObstacle(o);
  drawCarter();
  drawFx();
  ctx.restore();
  drawHud();
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000); last = now;
  if (state === "play") update(dt);
  else {
    // idle: Carter breathes on the start/game-over screen
    C.phase += dt * 1.5;
    for (const f of fx) f.life -= dt;
    fx = fx.filter((f) => f.life > 0);
  }
  draw();
  requestAnimationFrame(frame);
}

resize();
reset();
requestAnimationFrame(frame);
