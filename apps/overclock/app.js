// Overclock — a precision-timing game. A needle sweeps across a CPU clock gauge; tap while it's
// inside the green zone. Every hit raises the clock, shrinks the zone and speeds the needle up.
// Misses heat the CPU — three and it shuts down.
const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const $ = (s) => document.querySelector(s);

let W = 0, H = 0;
function resize() {
  const r = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  W = r.width; H = r.height;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
new ResizeObserver(resize).observe(canvas);

const START = -Math.PI * 1.25, SWEEP = Math.PI * 1.5;   // 270° gauge, opening at the bottom
const MAX_HEAT = 3;
let best = 3;
try { best = +localStorage.getItem("overclock-best") || 3; } catch {}
$("#best").textContent = best.toFixed(1);

let state = "menu", t, dir, speed, zone, ghz, heat, streak, perfects, hits, fx, shake, flash, flashColor, label, labelT, idle;
const rand = (a, b) => a + Math.random() * (b - a);
const buzz = (p) => { if (navigator.userActivation?.hasBeenActive) try { navigator.vibrate?.(p); } catch {} };

function newZone() {
  const width = Math.max(0.045, 0.2 - hits * 0.007);            // fraction of the sweep
  let c;
  do { c = rand(0.12 + width / 2, 0.88 - width / 2); } while (zone && Math.abs(c - zone.c) < 0.18);
  zone = { c, w: width, born: 0 };
}
function reset() {
  t = 0; dir = 1; speed = 0.55; ghz = 3.0; heat = 0; streak = 0; perfects = 0; hits = 0;
  fx = []; shake = 0; flash = 0; label = ""; labelT = 0; idle = 0; zone = null;
  newZone();
}

function say(text, color) { label = text; labelT = 1; flashColor = color; }
function tap() {
  if (state !== "play") return;
  const d = Math.abs(t - zone.c), half = zone.w / 2;
  const p = needlePoint(0.86);
  if (d <= half) {
    const perfect = d <= half * 0.3;
    hits++; streak++; idle = 0;
    const gain = perfect ? 0.2 : 0.1;
    ghz = Math.round((ghz + gain * (1 + Math.floor(streak / 5) * 0.5)) * 10) / 10;
    if (perfect) { perfects++; heat = Math.max(0, heat - 0.34); say("PERFECT", "#ffd43b"); burst(p.x, p.y, "#ffd43b", 26); }
    else { say("+" + gain.toFixed(1) + " GHz", "#69db7c"); burst(p.x, p.y, "#69db7c", 14); }
    flash = 0.18;
    speed = Math.min(2.6, 0.55 + hits * 0.045 + (Math.random() < 0.15 && hits > 8 ? 0.3 : 0));
    if (hits > 12 && Math.random() < 0.35) dir *= -1;            // surprise reversals later on
    newZone();
    buzz(12);
  } else miss("MISS");
}
function miss(text) {
  heat++; streak = 0; shake = 0.4; flash = 0.3;
  say(text, "#ff6b6b");
  const p = needlePoint(0.86);
  burst(p.x, p.y, "#ff6b6b", 12);
  buzz([30, 40, 30]);
  if (heat >= MAX_HEAT) end();
}
function end() {
  state = "over";
  const isBest = ghz > best;
  if (isBest) { best = ghz; try { localStorage.setItem("overclock-best", best); } catch {} }
  $("#best").textContent = best.toFixed(1);
  $("#title").textContent = isBest ? "New record! " + ghz.toFixed(1) + " GHz" : "Thermal shutdown";
  $("#msg").textContent = ghz >= 8 ? "Liquid-nitrogen territory. Carter would frame this screenshot." : ghz >= 5.5 ? "Serious overclock. Chase more Perfects to stay cool." : "The CPU cooked. Perfects cool it down — aim dead-centre.";
  $("#stats").hidden = false;
  $("#stats").innerHTML = `<div><b>${ghz.toFixed(1)}</b><span>GHz</span></div><div><b>${hits}</b><span>Hits</span></div><div><b>${perfects}</b><span>Perfects</span></div>`;
  $("#play").textContent = "Try again";
  setTimeout(() => ($("#overlay").hidden = false), 450);
}
function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), v = rand(60, 280);
    fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, color, life: rand(0.3, 0.7) });
  }
}

function geom() {
  const R = Math.min(W * 0.42, H * 0.4, 260);
  return { cx: W / 2, cy: H * 0.5 + R * 0.12, R };
}
function needlePoint(k) {
  const { cx, cy, R } = geom(), a = START + t * SWEEP;
  return { x: cx + Math.cos(a) * R * k, y: cy + Math.sin(a) * R * k };
}

function update(dt) {
  t += dir * speed * dt;
  if (t >= 1) { t = 2 - t; dir = -1; idle++; }
  if (t <= 0) { t = -t; dir = 1; idle++; }
  if (idle >= 3) { idle = 0; miss("TOO SLOW"); }               // no tap for three sweeps
  zone.born += dt;
  for (const f of fx) { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.93; f.vy *= 0.93; f.life -= dt; }
  fx = fx.filter((f) => f.life > 0);
  shake = Math.max(0, shake - dt); flash = Math.max(0, flash - dt); labelT = Math.max(0, labelT - dt * 1.4);
}

function arc(cx, cy, r, a0, a1, color, width) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = "round";
  ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke();
}
function draw() {
  ctx.save();
  if (shake > 0) ctx.translate(rand(-10, 10) * shake, rand(-10, 10) * shake);
  ctx.fillStyle = "#0d1017"; ctx.fillRect(-20, -20, W + 40, H + 40);
  const { cx, cy, R } = geom();
  const heatK = heat / MAX_HEAT;

  // glow behind the gauge reacts to heat
  const g = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.4);
  g.addColorStop(0, `rgba(${Math.round(60 + 190 * heatK)}, ${Math.round(90 - 40 * heatK)}, ${Math.round(200 - 150 * heatK)}, 0.18)`);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // track, ticks, zone
  arc(cx, cy, R, START, START + SWEEP, "#1f2533", R * 0.13);
  for (let i = 0; i <= 30; i++) {
    const a = START + (i / 30) * SWEEP, long = i % 5 === 0;
    ctx.strokeStyle = long ? "#4a5468" : "#2c3344"; ctx.lineWidth = long ? 3 : 1.5;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R * 0.76, cy + Math.sin(a) * R * 0.76); ctx.lineTo(cx + Math.cos(a) * R * (long ? 0.68 : 0.72), cy + Math.sin(a) * R * (long ? 0.68 : 0.72)); ctx.stroke();
  }
  const zIn = Math.min(1, zone.born / 0.15);
  const z0 = START + (zone.c - (zone.w / 2) * zIn) * SWEEP, z1 = START + (zone.c + (zone.w / 2) * zIn) * SWEEP;
  arc(cx, cy, R, z0, z1, "#2f9e44", R * 0.13);
  const pc = START + zone.c * SWEEP, pw = zone.w * 0.3 * SWEEP * zIn;
  arc(cx, cy, R, pc - pw / 2, pc + pw / 2, "#ffd43b", R * 0.13);

  // needle with a motion trail
  const a = START + t * SWEEP;
  for (let i = 6; i >= 1; i--) {
    const ta = a - dir * i * 0.025 * speed;
    ctx.strokeStyle = `rgba(255,255,255,${0.05 * (7 - i) / 6})`; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ta) * R * 1.02, cy + Math.sin(ta) * R * 1.02); ctx.stroke();
  }
  ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 5; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R * 1.06, cy + Math.sin(a) * R * 1.06); ctx.stroke();
  ctx.fillStyle = "#e9ecef"; ctx.beginPath(); ctx.arc(cx, cy, R * 0.07, 0, 7); ctx.fill();

  // readout
  ctx.textAlign = "center";
  ctx.fillStyle = "#f1f3f5"; ctx.font = `800 ${Math.round(R * 0.32)}px system-ui, sans-serif`;
  ctx.fillText(ghz.toFixed(1), cx, cy + R * 0.42);
  ctx.fillStyle = "#6c7488"; ctx.font = `600 ${Math.round(R * 0.09)}px system-ui, sans-serif`;
  ctx.fillText("GHz", cx, cy + R * 0.56);
  if (streak >= 5) { ctx.fillStyle = "#ffd43b"; ctx.fillText(`🔥 streak ${streak}`, cx, cy - R * 0.25); }

  // temperature bar
  const bw = Math.min(R * 1.6, W - 40), bx = cx - bw / 2, by = cy + R * 0.8;
  ctx.fillStyle = "#1f2533"; ctx.beginPath(); ctx.roundRect(bx, by, bw, 10, 5); ctx.fill();
  const tg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  tg.addColorStop(0, "#4dabf7"); tg.addColorStop(0.5, "#fcc419"); tg.addColorStop(1, "#fa5252");
  ctx.fillStyle = tg; ctx.beginPath(); ctx.roundRect(bx, by, Math.max(10, bw * heatK), 10, 5); ctx.fill();
  ctx.fillStyle = "#6c7488"; ctx.font = `600 12px system-ui, sans-serif`;
  ctx.fillText(`TEMP ${Math.round(45 + heatK * 50)}°C`, cx, by + 28);

  // floating label
  if (labelT > 0) {
    ctx.globalAlpha = Math.min(1, labelT * 1.5);
    ctx.fillStyle = flashColor; ctx.font = `800 ${Math.round(R * 0.16 * (1 + (1 - labelT) * 0.15))}px system-ui, sans-serif`;
    ctx.fillText(label, cx, cy - R * 0.42 - (1 - labelT) * 20);
    ctx.globalAlpha = 1;
  }
  for (const f of fx) {
    ctx.globalAlpha = Math.min(1, f.life / 0.4); ctx.fillStyle = f.color;
    ctx.beginPath(); ctx.arc(f.x, f.y, 3, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  if (flash > 0) { ctx.fillStyle = flashColor === "#ff6b6b" ? `rgba(250,82,82,${flash * 0.6})` : `rgba(255,255,255,${flash * 0.25})`; ctx.fillRect(0, 0, W, H); }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (state === "play") update(dt);
  else for (const f of fx) f.life -= dt;
  draw();
  requestAnimationFrame(frame);
}

$("#wrap").addEventListener("pointerdown", (e) => { if (!e.target.closest(".overlay")) tap(); });
addEventListener("keydown", (e) => {
  if (e.key === " " || e.key === "Enter") {
    e.preventDefault();
    if (state === "play") tap(); else start();
  }
});
function start() {
  reset();
  state = "play";
  $("#overlay").hidden = true;
}
$("#play").onclick = start;

resize();
reset();
requestAnimationFrame(frame);
