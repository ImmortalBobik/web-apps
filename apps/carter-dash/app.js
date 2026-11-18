// Carter Dash — an endless lane-hopper. Dodge delivery trucks, ride floating motherboards
// across cable rivers, grab GPUs for bonus points, and keep moving: the screen scrolls faster
// the further you get.
const COLS = 9;
const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const $ = (s) => document.querySelector(s);

let T = 48, W = 0, H = 0, VIEW_ROWS = 14;
function resize() {
  const box = canvas.parentElement.getBoundingClientRect();
  if (!box.width || !box.height) return;
  T = Math.max(24, Math.floor(Math.min(box.width / COLS, box.height / 10, 64)));
  W = T * COLS;
  H = Math.floor(box.height / T) * T;
  VIEW_ROWS = H / T;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + "px"; canvas.style.height = H + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener("resize", resize);
new ResizeObserver(resize).observe(canvas.parentElement);

/* ---------- world ---------- */
let rows, player, cam, score, bonus, best, state, autoSpeed, deathMsg, particles;
try { best = +localStorage.getItem("carter-dash-best") || 0; } catch { best = 0; }
$("#best").textContent = best;

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const TRUCKS = ["#e03131", "#1c7ed6", "#f59f00", "#7048e8", "#0ca678", "#495057"];

function makeRow(r) {
  if (r < 3) return { type: "floor", blocks: new Set(), items: [] };
  const prev = rows[r - 1]?.type;
  const roll = Math.random();
  const type = roll < 0.38 ? "floor" : roll < 0.78 ? "road" : prev === "river" ? "road" : "river";
  const dir = Math.random() < 0.5 ? -1 : 1;
  if (type === "floor") {
    const blocks = new Set();
    const n = Math.floor(rand(0, 3.5));
    while (blocks.size < n) blocks.add(Math.floor(rand(0, COLS)));
    const items = Math.random() < 0.18 ? [Math.floor(rand(0, COLS))].filter((c) => !blocks.has(c)) : [];
    return { type, blocks, items };
  }
  if (type === "road") {
    const speed = rand(1.2, 2.8), len = Math.random() < 0.3 ? 2 : 1.3, gap = rand(3, 5.5);
    const ents = [];
    for (let x = rand(-2, 2); x < COLS + 4; x += len + gap) ents.push({ x, len, color: pick(TRUCKS) });
    return { type, dir, speed, ents };
  }
  const speed = rand(0.8, 1.7), len = Math.floor(rand(2, 4)), gap = rand(1.6, 2.8);
  const ents = [];
  for (let x = rand(-1, 1); x < COLS + 4; x += len + gap) ents.push({ x, len });
  return { type, dir, speed, ents };
}
const row = (r) => (rows[r] ??= makeRow(r));

function reset() {
  rows = [];
  player = { x: 4, row: 1, hop: 0, face: 1, alive: true };
  cam = -1; score = 0; bonus = 0; autoSpeed = 0; particles = [];
  updateScore();
}

/* ---------- input ---------- */
function move(dx, dr) {
  if (state !== "play" || !player.alive) return;
  const nr = player.row + dr;
  let nx = player.x + dx;
  if (nx < -0.01 || nx > COLS - 0.99 || nr < Math.ceil(cam)) return;
  const target = row(nr);
  if (target.type !== "river") nx = Math.round(nx);
  if (target.type === "floor" && target.blocks.has(Math.round(nx))) return;
  player.x = Math.max(0, Math.min(COLS - 1, nx));
  player.row = nr; player.hop = 1;
  if (dx) player.face = dx;
  if (autoSpeed === 0) autoSpeed = 0.35;
  const f = row(nr);
  if (f.type === "floor" && f.items.includes(Math.round(player.x))) {
    f.items = f.items.filter((c) => c !== Math.round(player.x));
    bonus += 5; burst(player.x, nr, "#40c057");
  }
  updateScore();
}
addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  const map = { arrowup: [0, 1], w: [0, 1], arrowdown: [0, -1], s: [0, -1], arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0] };
  if (map[k]) { e.preventDefault(); if (state !== "play") start(); else move(...map[k]); }
  if ((k === " " || k === "enter") && state !== "play") start();
});
let touch = null;
canvas.addEventListener("pointerdown", (e) => { touch = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener("pointerup", (e) => {
  if (!touch) return;
  const dx = e.clientX - touch.x, dy = e.clientY - touch.y;
  touch = null;
  if (Math.hypot(dx, dy) < 24) return move(0, 1);
  if (Math.abs(dx) > Math.abs(dy)) move(Math.sign(dx), 0);
  else move(0, dy < 0 ? 1 : -1);
});

/* ---------- loop ---------- */
function updateScore() {
  score = Math.max(score, player.row - 1);
  $("#score").textContent = score + bonus;
}
function die(msg) {
  if (!player.alive) return;
  player.alive = false;
  deathMsg = msg;
  burst(player.x, player.row, "#fa5252");
  const total = score + bonus;
  if (total > best) { best = total; try { localStorage.setItem("carter-dash-best", best); } catch {} }
  $("#best").textContent = best;
  setTimeout(() => {
    state = "over";
    $("#title").textContent = total > 0 && total === best ? "New best! " + total : "Score " + total;
    $("#msg").textContent = deathMsg;
    $("#play").textContent = "Play again";
    $("#overlay").hidden = false;
  }, 650);
}
function burst(x, r, color) {
  for (let i = 0; i < 14; i++) particles.push({ x: x + 0.5, r: r + 0.5, vx: rand(-3, 3), vr: rand(-1, 4), life: 0.6, color });
}

function update(dt) {
  const mult = 1 + Math.min(score, 150) / 60;           // everything speeds up as you go
  for (let r = Math.floor(cam) - 1; r < cam + VIEW_ROWS + 2; r++) {
    const R = row(r);
    if (!R.ents) continue;
    const span = COLS + 6;
    for (const e of R.ents) {
      e.x += R.dir * R.speed * mult * dt;
      if (R.dir > 0 && e.x > COLS + 2) e.x -= span;
      if (R.dir < 0 && e.x + e.len < -2) e.x += span;
    }
  }
  if (player.alive && state === "play") {
    const R = row(player.row), cx = player.x + 0.5;
    if (R.type === "road" && R.ents.some((e) => cx > e.x + 0.12 && cx < e.x + e.len - 0.12)) die("Flattened by a delivery truck. Should've waited for the gap.");
    if (R.type === "river") {
      const raft = R.ents.find((e) => cx > e.x && cx < e.x + e.len);
      if (!raft) die("Fell into the cable river. Ride the motherboards!");
      else {
        player.x += R.dir * R.speed * mult * dt;
        if (player.x < -0.4 || player.x > COLS - 0.6) die("Carried off the edge on a motherboard.");
      }
    }
    // camera: follows Carter, and keeps creeping forward on its own
    autoSpeed = autoSpeed ? Math.min(1.7, 0.35 + score * 0.012) : 0;
    const target = player.row - 3;
    cam = Math.max(cam + autoSpeed * dt, cam + (target - cam) * Math.min(1, dt * 4));
    if (player.row < cam - 0.2) die("Too slow — the deadline caught up with you.");
  }
  player.hop = Math.max(0, player.hop - dt * 8);
  for (const p of particles) { p.x += p.vx * dt; p.r += p.vr * dt; p.vr -= 9 * dt; p.life -= dt; }
  particles = particles.filter((p) => p.life > 0);
}

/* ---------- drawing ---------- */
const sy = (r) => H - (r - cam + 1) * T;
function rr(x, y, w, h, rad, fill) {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, rad); ctx.fill();
}
function drawRow(r) {
  const R = row(r), y = sy(r);
  if (R.type === "floor") {
    ctx.fillStyle = r % 2 ? "#e9f5e1" : "#e2f0d8"; ctx.fillRect(0, y, W, T);
    for (const c of R.blocks) {                          // PC towers
      rr(c * T + T * 0.18, y + T * 0.1, T * 0.64, T * 0.8, 5, "#343a40");
      rr(c * T + T * 0.26, y + T * 0.2, T * 0.48, T * 0.08, 2, "#5c7cfa");
      ctx.fillStyle = "#69db7c"; ctx.beginPath(); ctx.arc(c * T + T * 0.5, y + T * 0.72, T * 0.05, 0, 7); ctx.fill();
    }
    for (const c of R.items) {                           // GPU pickup
      rr(c * T + T * 0.2, y + T * 0.34, T * 0.6, T * 0.32, 4, "#212529");
      ctx.fillStyle = "#adb5bd";
      for (const fx of [0.36, 0.64]) { ctx.beginPath(); ctx.arc(c * T + T * fx, y + T * 0.5, T * 0.1, 0, 7); ctx.fill(); }
      rr(c * T + T * 0.22, y + T * 0.34, T * 0.56, T * 0.04, 2, "#40c057");
    }
  } else if (R.type === "road") {
    ctx.fillStyle = "#3d4148"; ctx.fillRect(0, y, W, T);
    ctx.fillStyle = "#6c717a";
    for (let x = 0; x < W; x += T) ctx.fillRect(x + T * 0.3, y + T * 0.48, T * 0.4, T * 0.04);
    for (const e of R.ents) {
      const x = e.x * T;
      rr(x + 2, y + T * 0.14, e.len * T - 4, T * 0.72, 7, e.color);
      rr(R.dir > 0 ? x + e.len * T - T * 0.42 : x + T * 0.1, y + T * 0.22, T * 0.3, T * 0.56, 4, "#cfe8ff");
      ctx.fillStyle = "#ffe066";
      const hx = R.dir > 0 ? x + e.len * T - 4 : x + 2;
      ctx.fillRect(hx, y + T * 0.2, 2, T * 0.12); ctx.fillRect(hx, y + T * 0.68, 2, T * 0.12);
    }
  } else {
    ctx.fillStyle = "#4dabf7"; ctx.fillRect(0, y, W, T);
    ctx.strokeStyle = "rgb(255 255 255 / 0.35)"; ctx.lineWidth = 2;
    for (let x = ((performance.now() / 40) * R.dir) % 24 - 24; x < W; x += 24) {
      ctx.beginPath(); ctx.moveTo(x, y + T * 0.3); ctx.lineTo(x + 10, y + T * 0.3); ctx.stroke();
    }
    for (const e of R.ents) {                            // floating motherboards
      const x = e.x * T;
      rr(x + 2, y + T * 0.12, e.len * T - 4, T * 0.76, 4, "#2b8a3e");
      ctx.fillStyle = "#ffd43b";
      for (let i = 0.3; i < e.len; i += 0.6) ctx.fillRect(x + i * T, y + T * 0.3, T * 0.18, T * 0.12);
      rr(x + T * 0.3, y + T * 0.55, T * 0.4, T * 0.22, 2, "#868e96");
    }
  }
}
function drawCarter() {
  const lift = Math.sin(player.hop * Math.PI) * T * 0.18;
  const cx = (player.x + 0.5) * T, cy = sy(player.row) + T * 0.55 - lift;
  ctx.fillStyle = "rgb(0 0 0 / 0.18)";
  ctx.beginPath(); ctx.ellipse(cx, sy(player.row) + T * 0.82, T * 0.26, T * 0.08, 0, 0, 7); ctx.fill();
  rr(cx - T * 0.22, cy - T * 0.02, T * 0.44, T * 0.32, 8, "#1e1e1e");          // black tee
  ctx.fillStyle = "#8a5a40";
  ctx.beginPath(); ctx.arc(cx, cy - T * 0.12, T * 0.2, 0, 7); ctx.fill();     // head
  ctx.fillStyle = "#120b07";                                                    // curly hair
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + (i / 8) * Math.PI;
    ctx.beginPath(); ctx.arc(cx + Math.cos(a) * T * 0.17, cy - T * 0.17 + Math.sin(a) * T * 0.13, T * 0.075, 0, 7); ctx.fill();
  }
  ctx.fillStyle = "#1a0f0a";
  ctx.beginPath(); ctx.arc(cx - T * 0.07 + player.face * 0.03 * T, cy - T * 0.1, T * 0.025, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + T * 0.07 + player.face * 0.03 * T, cy - T * 0.1, T * 0.025, 0, 7); ctx.fill();
}
function draw() {
  ctx.clearRect(0, 0, W, H);
  for (let r = Math.floor(cam) - 1; r < cam + VIEW_ROWS + 1; r++) drawRow(r);
  if (player.alive) drawCarter();
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / 0.6); ctx.fillStyle = p.color;
    ctx.fillRect(p.x * T - 3, sy(p.r) - 3, 6, 6);
  }
  ctx.globalAlpha = 1;
}

let last = performance.now();
function frame(t) {
  const dt = Math.min(0.05, (t - last) / 1000); last = t;
  if (state === "play") update(dt); else player.hop = 0;
  draw();
  requestAnimationFrame(frame);
}

function start() {
  reset();
  state = "play";
  $("#overlay").hidden = true;
}
$("#play").onclick = start;

resize();
reset();
state = "menu";
requestAnimationFrame(frame);
