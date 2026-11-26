// Bug Blaster — a pure-reflex game. Bugs pop up on Carter's screen with a shrinking timer ring:
// tap them fast for big points, never tap the red viruses, grab the rare golden GPUs.
// It keeps speeding up: shorter timers, smaller and faster-moving targets, more traps.
const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const $ = (s) => document.querySelector(s);

let W = 0, H = 0, S = 1; // S = size unit (scales targets to the screen)
function resize() {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  W = r.width; H = r.height;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  S = Math.max(0.7, Math.min(1.25, Math.min(W, H) / 560));
}
new ResizeObserver(resize).observe(canvas);

let best = 0;
try { best = +localStorage.getItem("bug-blaster-best") || 0; } catch {}
$("#best").textContent = best;

let state = "menu", targets, fx, score, combo, lives, time, nextSpawn, shake, hits, misses, reactSum, flash;
const rand = (a, b) => a + Math.random() * (b - a);

function reset() {
  targets = []; fx = []; score = 0; combo = 1; lives = 3; time = 0; nextSpawn = 0.4;
  shake = 0; hits = 0; misses = 0; reactSum = 0; flash = 0;
  hud();
}
function hud() {
  $("#score").textContent = score;
  $("#combo").textContent = combo;
  $("#lives").textContent = "❤️".repeat(lives) + "🖤".repeat(3 - lives);
}

// difficulty ramps with time survived
const level = () => Math.min(1, time / 75);
function spawn() {
  const L = level();
  const roll = Math.random();
  const kind = roll < 0.05 + 0.02 * L ? "gold" : roll < 0.12 + 0.2 * L ? "virus" : "bug";
  const r = (kind === "gold" ? 26 : 34 - 12 * L) * S;
  const life = kind === "gold" ? 1.0 - 0.3 * L : kind === "virus" ? 2.2 : 1.9 - 1.05 * L;
  const pad = r + 8;
  let x, y, tries = 0;
  do { x = rand(pad, W - pad); y = rand(pad, H - pad); tries++; }
  while (tries < 20 && targets.some((t) => Math.hypot(t.x - x, t.y - y) < t.r + r + 12));
  const speed = L > 0.25 && kind !== "virus" ? rand(0, 140 * L) * S : 0;
  const a = rand(0, Math.PI * 2);
  targets.push({ kind, x, y, r, life, age: 0, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, wob: rand(0, 6) });
}

function popText(x, y, text, color) { fx.push({ t: "text", x, y, text, color, life: 0.8 }); }
function burst(x, y, color, n = 16) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), v = rand(80, 320) * S;
    fx.push({ t: "p", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, color, life: rand(0.3, 0.6) });
  }
}

function hitAt(x, y) {
  if (state !== "play") return;
  // pick the closest target under the pointer (a little forgiving on touch)
  let best = null, bd = Infinity;
  for (const t of targets) {
    const d = Math.hypot(t.x - x, t.y - y);
    if (d < t.r + 6 * S && d < bd) { best = t; bd = d; }
  }
  if (!best) {                                  // clicked empty space: lose the combo
    if (combo > 1) popText(x, y, "combo lost", "#adb5bd");
    combo = 1; misses++;
    fx.push({ t: "ring", x, y, r: 6, life: 0.25, color: "#868e96" });
    hud();
    return;
  }
  targets.splice(targets.indexOf(best), 1);
  if (best.kind === "virus") {
    loseLife(best.x, best.y, "VIRUS!");
    burst(best.x, best.y, "#fa5252", 24);
    return;
  }
  const speedBonus = Math.max(0, 1 - best.age / best.life);       // faster = more points
  const base = best.kind === "gold" ? 300 : 50 + Math.round(100 * speedBonus);
  const pts = base * combo;
  score += pts; hits++; reactSum += best.age;
  if (hits % 5 === 0) combo = Math.min(8, combo + 1);
  popText(best.x, best.y - best.r, "+" + pts, best.kind === "gold" ? "#fcc419" : speedBonus > 0.6 ? "#69db7c" : "#e9ecef");
  burst(best.x, best.y, best.kind === "gold" ? "#fcc419" : "#40c057");
  fx.push({ t: "ring", x: best.x, y: best.y, r: best.r, life: 0.3, color: best.kind === "gold" ? "#fcc419" : "#69db7c" });
  hud();
}
function loseLife(x, y, label) {
  lives--; combo = 1; shake = 0.35; flash = 0.25; misses++;
  popText(x, y, label, "#ff6b6b");
  hud();
  if (lives <= 0) gameOver();
}

function gameOver() {
  state = "over";
  const avg = hits ? Math.round((reactSum / hits) * 1000) : 0;
  const acc = hits + misses ? Math.round((hits / (hits + misses)) * 100) : 0;
  const isBest = score > best;
  if (isBest) { best = score; try { localStorage.setItem("bug-blaster-best", best); } catch {} }
  $("#best").textContent = best;
  $("#title").textContent = isBest && score > 0 ? "New best!" : "System crashed";
  $("#msg").textContent = score >= 8000 ? "Elite reflexes. Carter would hire you as QA." : score >= 3000 ? "Solid debugging. Push for a faster average." : "The bugs won this round. Try again!";
  $("#stats").hidden = false;
  $("#stats").innerHTML = `<div><b>${score}</b><span>Score</span></div><div><b>${avg} ms</b><span>Avg reaction</span></div><div><b>${hits}</b><span>Bugs squashed</span></div><div><b>${acc}%</b><span>Accuracy</span></div>`;
  document.querySelector(".legend").hidden = true;
  $("#play").textContent = "Play again";
  setTimeout(() => ($("#overlay").hidden = false), 500);
}

function update(dt) {
  time += dt;
  const L = level();
  nextSpawn -= dt;
  if (nextSpawn <= 0) {
    spawn();
    if (L > 0.5 && Math.random() < 0.3) spawn();
    nextSpawn = rand(0.75, 1.1) * (1 - 0.6 * L);
  }
  for (let i = targets.length - 1; i >= 0; i--) {
    const t = targets[i];
    t.age += dt;
    t.x += t.vx * dt; t.y += t.vy * dt;
    if (t.x < t.r || t.x > W - t.r) t.vx *= -1;
    if (t.y < t.r || t.y > H - t.r) t.vy *= -1;
    if (t.age >= t.life) {
      targets.splice(i, 1);
      if (t.kind === "bug") { loseLife(t.x, t.y, "missed!"); burst(t.x, t.y, "#fa5252", 10); }
      else fx.push({ t: "ring", x: t.x, y: t.y, r: t.r, life: 0.25, color: "#495057" });
    }
  }
  for (const f of fx) {
    f.life -= dt;
    if (f.t === "p") { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.92; f.vy *= 0.92; }
    if (f.t === "text") f.y -= 40 * dt;
    if (f.t === "ring") f.r += 140 * dt;
  }
  fx = fx.filter((f) => f.life > 0);
  shake = Math.max(0, shake - dt);
  flash = Math.max(0, flash - dt);
}

/* ---------- drawing ---------- */
function drawBug(t, k) {
  const { x, y, r } = t, wig = Math.sin(t.age * 22 + t.wob) * 0.12;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.atan2(t.vy || 1, t.vx || 0) + Math.PI / 2 + wig);
  ctx.strokeStyle = "#2b8a3e"; ctx.lineWidth = 2.5 * S; ctx.lineCap = "round";
  for (const s of [-1, 1]) for (const yy of [-0.35, 0, 0.35]) {      // legs
    ctx.beginPath(); ctx.moveTo(s * r * 0.45, yy * r); ctx.lineTo(s * r * 0.95, yy * r + Math.sin(t.age * 30 + yy * 9) * r * 0.12); ctx.stroke();
  }
  ctx.fillStyle = "#40c057";
  ctx.beginPath(); ctx.ellipse(0, r * 0.1, r * 0.55, r * 0.7, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#2f9e44";
  ctx.beginPath(); ctx.arc(0, -r * 0.6, r * 0.32, 0, 7); ctx.fill();
  ctx.strokeStyle = "#1e6b2f"; ctx.lineWidth = 1.5 * S;
  ctx.beginPath(); ctx.moveTo(0, -r * 0.55); ctx.lineTo(0, r * 0.75); ctx.stroke();
  ctx.fillStyle = "#fff";
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * r * 0.13, -r * 0.68, r * 0.08, 0, 7); ctx.fill(); }
  ctx.restore();
}
function drawVirus(t) {
  const { x, y, r } = t, spin = t.age * 1.5;
  ctx.save(); ctx.translate(x, y); ctx.rotate(spin);
  ctx.strokeStyle = "#fa5252"; ctx.lineWidth = 3 * S;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55); ctx.lineTo(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95); ctx.stroke();
    ctx.fillStyle = "#fa5252"; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95, 3.2 * S, 0, 7); ctx.fill();
  }
  ctx.fillStyle = "#e03131"; ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, 7); ctx.fill();
  ctx.fillStyle = "#ffc9c9";
  for (const [a, d] of [[0.5, 0.3], [2.5, 0.25], [4.2, 0.32]]) { ctx.beginPath(); ctx.arc(Math.cos(a) * r * d, Math.sin(a) * r * d, r * 0.1, 0, 7); ctx.fill(); }
  ctx.restore();
}
function drawGold(t) {
  const { x, y, r } = t;
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t.age * 6) * 0.15);
  ctx.shadowColor = "#fcc419"; ctx.shadowBlur = 18 * S;
  ctx.fillStyle = "#fab005"; ctx.beginPath(); ctx.roundRect(-r, -r * 0.55, r * 2, r * 1.1, 6 * S); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#5c3d00";
  for (const s of [-0.45, 0.45]) {
    ctx.beginPath(); ctx.arc(s * r, 0, r * 0.38, 0, 7); ctx.fill();
    ctx.strokeStyle = "#ffe066"; ctx.lineWidth = 2 * S;
    for (let i = 0; i < 3; i++) { const a = t.age * 20 + (i * Math.PI * 2) / 3; ctx.beginPath(); ctx.moveTo(s * r, 0); ctx.lineTo(s * r + Math.cos(a) * r * 0.33, Math.sin(a) * r * 0.33); ctx.stroke(); }
  }
  ctx.restore();
}
function draw() {
  ctx.save();
  if (shake > 0) ctx.translate(rand(-8, 8) * shake * S, rand(-8, 8) * shake * S);
  ctx.fillStyle = "#0f1220"; ctx.fillRect(-20, -20, W + 40, H + 40);
  ctx.strokeStyle = "rgb(76 110 245 / 0.08)"; ctx.lineWidth = 1;
  const g = 40 * S;
  for (let x = 0; x < W; x += g) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += g) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  for (const t of targets) {
    const left = 1 - t.age / t.life, pop = Math.min(1, t.age / 0.12);
    // timer ring
    ctx.strokeStyle = t.kind === "virus" ? "rgb(250 82 82 / 0.35)" : left < 0.3 ? "#ff6b6b" : t.kind === "gold" ? "#fcc419" : "#69db7c";
    ctx.lineWidth = 3 * S;
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r + 7 * S, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2); ctx.stroke();
    ctx.save(); ctx.translate(t.x, t.y); ctx.scale(pop, pop); ctx.translate(-t.x, -t.y);
    if (t.kind === "bug") drawBug(t); else if (t.kind === "virus") drawVirus(t); else drawGold(t);
    ctx.restore();
  }
  for (const f of fx) {
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life / 0.4));
    if (f.t === "p") { ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(f.x, f.y, 3 * S, 0, 7); ctx.fill(); }
    if (f.t === "ring") { ctx.strokeStyle = f.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.stroke(); }
    if (f.t === "text") { ctx.fillStyle = f.color; ctx.font = `700 ${Math.round(18 * S)}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.fillText(f.text, f.x, f.y); }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  if (flash > 0) { ctx.fillStyle = `rgb(250 82 82 / ${flash})`; ctx.fillRect(0, 0, W, H); }
  if (state === "play" && combo > 1) {
    ctx.fillStyle = "rgb(255 255 255 / 0.12)";
    ctx.font = `800 ${Math.round(80 * S)}px system-ui, sans-serif`; ctx.textAlign = "center";
    ctx.fillText("x" + combo, W / 2, H / 2 + 28 * S);
  }
}

let last = performance.now();
function frame(t) {
  const dt = Math.min(0.05, (t - last) / 1000); last = t;
  if (state === "play") update(dt);
  else if (fx) { for (const f of fx) f.life -= dt; fx = fx.filter((f) => f.life > 0); }
  if (targets) draw();
  requestAnimationFrame(frame);
}

canvas.addEventListener("pointerdown", (e) => {
  const r = canvas.getBoundingClientRect();
  hitAt(e.clientX - r.left, e.clientY - r.top);
});
function start() {
  reset();
  state = "play";
  $("#overlay").hidden = true;
}
$("#play").onclick = start;
addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && state !== "play") { e.preventDefault(); start(); } });

resize();
reset();
requestAnimationFrame(frame);
