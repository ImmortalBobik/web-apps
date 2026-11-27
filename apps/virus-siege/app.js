// Virus Siege — arena survival inside Carter's PC.
// Move to dodge; Carter auto-fires at the nearest malware. Collect XP chips, level up, pick
// upgrades that stack into a build, and survive the Ransomware boss that arrives every 2:30.
const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const $ = (s) => document.querySelector(s);

let W = 0, H = 0, Z = 1; // Z = world-to-screen zoom so phones see a similar area
function resize() {
  const r = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  W = r.width; H = r.height;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  Z = Math.max(0.6, Math.min(1, Math.min(W, H) / 700));
}
new ResizeObserver(resize).observe(canvas);

const face = new Image();
face.src = "carter.png";
const rand = (a, b) => a + Math.random() * (b - a);
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

let best = null;
try { best = JSON.parse(localStorage.getItem("virus-siege-best") || "null"); } catch {}
const showBest = () => ($("#best").textContent = best ? `${fmtTime(best.time)} · ${best.kills} kills` : "—");
showBest();

/* ------------------------------------------------------------------ *
 * Upgrades
 * ------------------------------------------------------------------ */
const UPGRADES = [
  { id: "rate", ic: "⚡", nm: "Faster Fire", ds: "Shoot 18% faster" },
  { id: "dmg", ic: "💥", nm: "Overclocked Bolts", ds: "+30% bolt damage" },
  { id: "multi", ic: "🔱", nm: "Split Shot", ds: "+1 bolt per volley" },
  { id: "pierce", ic: "🎯", nm: "Piercing Code", ds: "Bolts pass through +1 enemy" },
  { id: "fans", ic: "🌀", nm: "Cooling Fans", ds: "+1 blade orbiting you" },
  { id: "aura", ic: "🛡️", nm: "Firewall", ds: "Burns nearby malware (bigger each level)" },
  { id: "zap", ic: "🌩️", nm: "Chain Lightning", ds: "Zaps +2 enemies every 1.4 s" },
  { id: "hp", ic: "🧠", nm: "RAM Upgrade", ds: "+25 max HP and heal 40" },
  { id: "speed", ic: "👟", nm: "SSD Speed", ds: "+12% move speed" },
  { id: "magnet", ic: "🧲", nm: "Data Magnet", ds: "+45% pickup range" },
];
const MAX_LV = 5;

/* ------------------------------------------------------------------ *
 * Enemies
 * ------------------------------------------------------------------ */
const TYPES = {
  bug:    { hp: 12, speed: 72, r: 13, dmg: 8, xp: 1, color: "#40c057" },
  worm:   { hp: 7, speed: 138, r: 10, dmg: 6, xp: 1, color: "#be4bdb" },
  trojan: { hp: 70, speed: 46, r: 22, dmg: 16, xp: 6, color: "#e8590c" },
  boss:   { hp: 2200, speed: 58, r: 50, dmg: 26, xp: 60, color: "#e03131" },
};

let state = "menu", P, enemies, bullets, ebullets, gems, fx, texts, zaps, t, kills, spawnAcc, nextBoss, shake, lvl, xp, xpNeed, owned, bossAlive, keys = {}, joy = null;

function reset() {
  P = { x: 0, y: 0, r: 16, hp: 100, maxHp: 100, speed: 195, inv: 0, fireCd: 0, rate: 0.55, dmg: 10, multi: 1, pierce: 0,
        fans: 0, fanAng: 0, aura: 0, auraTick: 0, zap: 0, zapCd: 1.4, magnet: 90, face: 1, hurtT: 0 };
  enemies = []; bullets = []; ebullets = []; gems = []; fx = []; texts = []; zaps = [];
  t = 0; kills = 0; spawnAcc = 0; nextBoss = 150; shake = 0; lvl = 1; xp = 0; xpNeed = 5; owned = {}; bossAlive = false;
}

function spawn(type, near) {
  const T = TYPES[type], scale = 1 + t / 110;
  const a = rand(0, Math.PI * 2), d = Math.hypot(W, H) / Z / 2 + 60;
  const e = { type, x: P.x + Math.cos(a) * d, y: P.y + Math.sin(a) * d, r: T.r, speed: T.speed * rand(0.9, 1.1),
    hp: T.hp * (type === "boss" ? 1 + t / 200 : scale), dmg: T.dmg, xp: T.xp, color: T.color, hit: 0, wob: rand(0, 6), shootCd: 3, summonCd: 5 };
  if (near) { e.x = near.x + rand(-30, 30); e.y = near.y + rand(-30, 30); }
  e.maxHp = e.hp;
  enemies.push(e);
  return e;
}

/* ------------------------------------------------------------------ *
 * Update
 * ------------------------------------------------------------------ */
function update(dt) {
  t += dt;

  // movement: keyboard or touch joystick
  let mx = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
  let my = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
  if (joy && joy.active) { const dx = joy.x - joy.ox, dy = joy.y - joy.oy, l = Math.hypot(dx, dy); if (l > 6) { mx = dx / Math.max(l, 50); my = dy / Math.max(l, 50); } }
  const ml = Math.hypot(mx, my);
  if (ml > 1) { mx /= ml; my /= ml; }
  P.x += mx * P.speed * dt; P.y += my * P.speed * dt;
  if (mx) P.face = Math.sign(mx);
  P.inv = Math.max(0, P.inv - dt); P.hurtT = Math.max(0, P.hurtT - dt);

  // spawning: denser and tougher over time, worm swarms and trojans join in
  spawnAcc += dt * (1.1 + t / 18);
  while (spawnAcc >= 1) {
    spawnAcc--;
    const roll = Math.random();
    if (t > 40 && roll < 0.08) { const lead = spawn("worm"); for (let i = 0; i < 5; i++) spawn("worm", lead); }
    else if (t > 70 && roll < 0.2) spawn("trojan");
    else spawn(roll < 0.75 ? "bug" : "worm");
  }
  if (t >= nextBoss && !bossAlive) { spawn("boss"); bossAlive = true; nextBoss += 150; banner("⚠️ RANSOMWARE INBOUND", "#ff6b6b"); shake = 0.5; }

  // auto-fire at the nearest enemies
  P.fireCd -= dt;
  if (P.fireCd <= 0 && enemies.length) {
    let target = null, bd = Infinity;
    for (const e of enemies) { const d = dist2(e, P); if (d < bd) { bd = d; target = e; } }
    if (bd < (700 / Z) ** 2) {
      P.fireCd = P.rate;
      const base = Math.atan2(target.y - P.y, target.x - P.x);
      for (let i = 0; i < P.multi; i++) {
        const a = base + (i - (P.multi - 1) / 2) * 0.16;
        bullets.push({ x: P.x, y: P.y, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, life: 1.2, pierce: P.pierce, hitSet: new Set() });
      }
    }
  }
  for (const b of bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    for (const e of enemies) {
      if (e.hp <= 0 || b.hitSet.has(e) || dist2(b, e) > (e.r + 5) ** 2) continue;
      b.hitSet.add(e); damage(e, P.dmg, b.vx * 0.02, b.vy * 0.02);
      if (b.pierce-- <= 0) { b.life = 0; break; }
    }
  }
  bullets = bullets.filter((b) => b.life > 0);

  // orbiting fans
  if (P.fans) {
    P.fanAng += dt * 3.2;
    for (let i = 0; i < P.fans; i++) {
      const a = P.fanAng + (i / P.fans) * Math.PI * 2, fx2 = P.x + Math.cos(a) * 70, fy2 = P.y + Math.sin(a) * 70;
      for (const e of enemies) if (e.hp > 0 && (e.x - fx2) ** 2 + (e.y - fy2) ** 2 < (e.r + 14) ** 2 && e.hit <= 0) damage(e, 9 + P.fans * 2, Math.cos(a) * 4, Math.sin(a) * 4);
    }
  }
  // firewall aura
  if (P.aura) {
    P.auraTick -= dt;
    if (P.auraTick <= 0) {
      P.auraTick = 0.45;
      const R = 70 + P.aura * 18;
      for (const e of enemies) if (e.hp > 0 && dist2(e, P) < (R + e.r) ** 2) damage(e, 4 + P.aura * 3, 0, 0, true);
    }
  }
  // chain lightning
  if (P.zap) {
    P.zapCd -= dt;
    if (P.zapCd <= 0 && enemies.length) {
      P.zapCd = 1.4;
      let from = P;
      const hitList = new Set();
      for (let i = 0; i < P.zap * 2; i++) {
        let nx = null, nd = (320) ** 2;
        for (const e of enemies) if (e.hp > 0 && !hitList.has(e)) { const d = dist2(e, from); if (d < nd) { nd = d; nx = e; } }
        if (!nx) break;
        hitList.add(nx); zaps.push({ x1: from.x, y1: from.y, x2: nx.x, y2: nx.y, life: 0.18 });
        damage(nx, 14 + P.zap * 4, 0, 0); from = nx;
      }
    }
  }

  // enemies chase, push apart, hurt on contact; the boss shoots and summons
  for (const e of enemies) {
    const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1;
    const wig = e.type === "worm" ? Math.sin(t * 8 + e.wob) * 0.6 : 0;
    e.x += ((dx / d) * Math.cos(wig) - (dy / d) * Math.sin(wig)) * e.speed * dt;
    e.y += ((dy / d) * Math.cos(wig) + (dx / d) * Math.sin(wig)) * e.speed * dt;
    e.hit = Math.max(0, e.hit - dt);
    if (d < e.r + P.r && P.inv <= 0) hurt(e.dmg);
    if (e.type === "boss") {
      e.shootCd -= dt; e.summonCd -= dt;
      if (e.shootCd <= 0) {
        e.shootCd = 2.6;
        for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2 + t; ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190, life: 4 }); }
      }
      if (e.summonCd <= 0) { e.summonCd = 6; for (let i = 0; i < 6; i++) spawn("bug", e); }
    }
  }
  // light separation so the horde doesn't stack into one blob
  for (let i = 0; i < enemies.length; i++) {
    const a = enemies[i];
    for (let j = i + 1; j < Math.min(enemies.length, i + 12); j++) {
      const b = enemies[j], dx = b.x - a.x, dy = b.y - a.y, min = a.r + b.r, dd = dx * dx + dy * dy;
      if (dd > 0 && dd < min * min) { const d = Math.sqrt(dd), push = (min - d) / 2; a.x -= (dx / d) * push; a.y -= (dy / d) * push; b.x += (dx / d) * push; b.y += (dy / d) * push; }
    }
  }
  for (const b of ebullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (P.inv <= 0 && dist2(b, P) < (P.r + 6) ** 2) { b.life = 0; hurt(12); }
  }
  ebullets = ebullets.filter((b) => b.life > 0);

  // deaths, drops
  for (const e of enemies) if (e.hp <= 0) {
    kills++;
    burst(e.x, e.y, e.color, e.type === "boss" ? 60 : 10);
    if (e.type === "boss") { bossAlive = false; banner("RANSOMWARE DELETED", "#69db7c"); shake = 0.6; for (let i = 0; i < 20; i++) gems.push({ x: e.x + rand(-60, 60), y: e.y + rand(-60, 60), v: 3 }); P.hp = Math.min(P.maxHp, P.hp + 40); }
    else gems.push({ x: e.x, y: e.y, v: e.xp });
  }
  enemies = enemies.filter((e) => e.hp > 0 && dist2(e, P) < (2200) ** 2);

  // XP chips fly to you inside the magnet range
  for (const g of gems) {
    const d2 = dist2(g, P);
    if (d2 < P.magnet ** 2 || g.pull) {
      g.pull = true;
      const d = Math.sqrt(d2) || 1;
      g.x += ((P.x - g.x) / d) * 520 * dt; g.y += ((P.y - g.y) / d) * 520 * dt;
      if (d < P.r + 6) { g.taken = true; gainXp(g.v); }
    }
  }
  gems = gems.filter((g) => !g.taken);

  for (const f of fx) { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.9; f.vy *= 0.9; f.life -= dt; }
  fx = fx.filter((f) => f.life > 0);
  for (const s of texts) { s.y -= 30 * dt; s.life -= dt; }
  texts = texts.filter((s) => s.life > 0);
  for (const z of zaps) z.life -= dt;
  zaps = zaps.filter((z) => z.life > 0);
  shake = Math.max(0, shake - dt);
}

function damage(e, amount, kx, ky, quiet) {
  e.hp -= amount; e.hit = 0.1;
  e.x += kx; e.y += ky;
  if (!quiet || Math.random() < 0.3) texts.push({ x: e.x, y: e.y - e.r, text: Math.round(amount), life: 0.5, color: "#fff" });
}
function hurt(n) {
  P.hp -= n; P.inv = 0.6; P.hurtT = 0.25; shake = 0.3;
  if (P.hp <= 0) gameOver();
}
function gainXp(v) {
  xp += v;
  if (xp >= xpNeed) {
    xp -= xpNeed; lvl++; xpNeed = Math.round(5 + lvl * 4 + lvl * lvl * 0.6);
    openLevelUp();
  }
}
function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) { const a = rand(0, Math.PI * 2), v = rand(60, 260); fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, color, life: rand(0.25, 0.55) }); }
}
let bannerText = "", bannerColor = "#fff", bannerT = 0;
function banner(text, color) { bannerText = text; bannerColor = color; bannerT = 2.2; }

/* ------------------------------------------------------------------ *
 * Level-up choices
 * ------------------------------------------------------------------ */
function openLevelUp() {
  state = "level";
  const pool = UPGRADES.filter((u) => (owned[u.id] || 0) < MAX_LV);
  const pick = [];
  while (pick.length < 3 && pool.length) pick.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  if (!pick.length) { state = "play"; P.hp = Math.min(P.maxHp, P.hp + 30); return; }
  $("#cards").innerHTML = pick.map((u, i) => `
    <button class="card-btn" data-id="${u.id}">
      <span class="ic">${u.ic}</span>
      <div><span class="nm">${u.nm}</span>
      <span class="lv">${owned[u.id] ? "Level " + (owned[u.id] + 1) : "New"} · key ${i + 1}</span>
      <span class="ds">${u.ds}</span></div>
    </button>`).join("");
  $("#levelUp").hidden = false;
  $("#cards").querySelector("button")?.focus();
}
function choose(id) {
  owned[id] = (owned[id] || 0) + 1;
  if (id === "rate") P.rate *= 0.82;
  if (id === "dmg") P.dmg *= 1.3;
  if (id === "multi") P.multi++;
  if (id === "pierce") P.pierce++;
  if (id === "fans") P.fans++;
  if (id === "aura") P.aura++;
  if (id === "zap") P.zap++;
  if (id === "hp") { P.maxHp += 25; P.hp = Math.min(P.maxHp, P.hp + 40); }
  if (id === "speed") P.speed *= 1.12;
  if (id === "magnet") P.magnet *= 1.45;
  $("#levelUp").hidden = true;
  state = "play";
  if (xp >= xpNeed) gainXp(0);
}
$("#cards").addEventListener("click", (e) => { const b = e.target.closest(".card-btn"); if (b) choose(b.dataset.id); });

/* ------------------------------------------------------------------ *
 * Game flow
 * ------------------------------------------------------------------ */
function gameOver() {
  state = "over";
  const run = { time: Math.floor(t), kills, lvl };
  const isBest = !best || run.time > best.time || (run.time === best.time && run.kills > best.kills);
  if (isBest) { best = run; try { localStorage.setItem("virus-siege-best", JSON.stringify(best)); } catch {} }
  showBest();
  $("#mTitle").textContent = isBest ? "New best run!" : "Carter's PC crashed";
  $("#mMsg").textContent = t >= 150 ? "You lived through a Ransomware attack. Legendary uptime." : "The horde got through. Try a different upgrade path!";
  $("#mStats").hidden = false;
  $("#mStats").innerHTML = `<div><b>${fmtTime(t)}</b><span>Survived</span></div><div><b>${kills}</b><span>Kills</span></div><div><b>${lvl}</b><span>Level</span></div><div><b>${Object.keys(owned).length}</b><span>Upgrades</span></div>`;
  $("#playBtn").textContent = "Play again";
  setTimeout(() => ($("#menu").hidden = false), 600);
}
function start() {
  reset();
  state = "play";
  $("#menu").hidden = true; $("#levelUp").hidden = true;
}
function togglePause() {
  if (state === "play") { state = "paused"; $("#mTitle").textContent = "Paused"; $("#mMsg").textContent = "Take a breath."; $("#mStats").hidden = true; $("#playBtn").textContent = "Resume"; $("#menu").hidden = false; }
  else if (state === "paused") { state = "play"; $("#menu").hidden = true; }
}
$("#playBtn").onclick = () => (state === "paused" ? togglePause() : start());
$("#pauseBtn").onclick = togglePause;

addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
  keys[k] = true;
  if (k === "p" || k === "escape") togglePause();
  if (state === "level" && ["1", "2", "3"].includes(k)) { const b = $("#cards").querySelectorAll("button")[+k - 1]; if (b) choose(b.dataset.id); }
  if ((k === "enter" || k === " ") && (state === "menu" || state === "over")) start();
});
addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });
addEventListener("blur", () => { keys = {}; if (state === "play") togglePause(); });

// touch / mouse joystick: press anywhere and drag
canvas.addEventListener("pointerdown", (e) => {
  const r = canvas.getBoundingClientRect();
  joy = { active: true, ox: e.clientX - r.left, oy: e.clientY - r.top, x: e.clientX - r.left, y: e.clientY - r.top, id: e.pointerId };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => { if (joy && e.pointerId === joy.id) { const r = canvas.getBoundingClientRect(); joy.x = e.clientX - r.left; joy.y = e.clientY - r.top; } });
const endJoy = (e) => { if (joy && e.pointerId === joy.id) joy = null; };
canvas.addEventListener("pointerup", endJoy);
canvas.addEventListener("pointercancel", endJoy);

/* ------------------------------------------------------------------ *
 * Drawing
 * ------------------------------------------------------------------ */
function drawBackground(ox, oy) {
  ctx.fillStyle = "#08130e"; ctx.fillRect(0, 0, W, H);
  const g = 80 * Z, sx = ((-ox * Z) % g + g) % g, sy = ((-oy * Z) % g + g) % g;
  ctx.strokeStyle = "rgba(64,192,87,0.07)"; ctx.lineWidth = 1;
  for (let x = sx; x < W; x += g) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = sy; y < H; y += g) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  // circuit pads at some grid intersections
  ctx.fillStyle = "rgba(252,196,25,0.12)";
  const gx0 = Math.floor(ox / 80), gy0 = Math.floor(oy / 80);
  for (let i = -1; i < W / g + 2; i++) for (let j = -1; j < H / g + 2; j++) {
    const gx = gx0 + i, gy = gy0 + j;
    if (((gx * 73856093) ^ (gy * 19349663)) % 7 === 0) ctx.fillRect((gx * 80 - ox) * Z - 3, (gy * 80 - oy) * Z - 3, 6, 6);
  }
}
function drawEnemy(e) {
  const flash = e.hit > 0;
  ctx.save(); ctx.translate(e.x, e.y);
  const wob = Math.sin(t * 10 + e.wob) * 0.1;
  if (e.type === "bug") {
    ctx.rotate(Math.atan2(P.y - e.y, P.x - e.x) + Math.PI / 2 + wob);
    ctx.strokeStyle = "#2b8a3e"; ctx.lineWidth = 2;
    for (const s of [-1, 1]) for (const yy of [-5, 0, 5]) { ctx.beginPath(); ctx.moveTo(s * 6, yy); ctx.lineTo(s * 13, yy + Math.sin(t * 20 + yy) * 2); ctx.stroke(); }
    ctx.fillStyle = flash ? "#fff" : e.color; ctx.beginPath(); ctx.ellipse(0, 1, 8, 11, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-3, -8, 2, 0, 7); ctx.arc(3, -8, 2, 0, 7); ctx.fill();
  } else if (e.type === "worm") {
    ctx.fillStyle = flash ? "#fff" : e.color;
    for (let i = 3; i >= 0; i--) { ctx.globalAlpha = 1 - i * 0.18; ctx.beginPath(); ctx.arc(Math.sin(t * 12 + i) * 3, i * 6, 9 - i, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-3, -2, 2, 0, 7); ctx.arc(3, -2, 2, 0, 7); ctx.fill();
  } else if (e.type === "trojan") {
    ctx.rotate(wob * 0.5);
    ctx.fillStyle = flash ? "#fff" : e.color; ctx.beginPath(); ctx.roundRect(-20, -18, 40, 36, 6); ctx.fill();
    ctx.fillStyle = "#5c2b0b"; ctx.fillRect(-20, -4, 40, 6); ctx.fillRect(-3, -18, 6, 36);
    ctx.fillStyle = "#ffe066"; ctx.beginPath(); ctx.arc(-8, -9, 3, 0, 7); ctx.arc(8, -9, 3, 0, 7); ctx.fill();
  } else {
    ctx.rotate(t * 0.6);
    ctx.fillStyle = flash ? "#fff" : "#a51111";
    ctx.beginPath();
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = i % 2 ? 40 : 54; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
    ctx.rotate(-t * 0.6);
    ctx.fillStyle = "#1a0505"; ctx.beginPath(); ctx.arc(0, 0, 30, 0, 7); ctx.fill();
    ctx.fillStyle = "#ff6b6b"; ctx.font = "700 22px system-ui"; ctx.textAlign = "center"; ctx.fillText("🔒", 0, 8);
  }
  ctx.restore();
  if (e.type === "trojan" || e.type === "boss") {
    const w = e.r * 2;
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(e.x - w / 2, e.y - e.r - 12, w, 5);
    ctx.fillStyle = e.type === "boss" ? "#ff6b6b" : "#ffa94d"; ctx.fillRect(e.x - w / 2, e.y - e.r - 12, w * Math.max(0, e.hp / e.maxHp), 5);
  }
}
function drawPlayer() {
  const blink = P.inv > 0 && Math.floor(P.inv * 20) % 2 === 0;
  if (blink) return;
  const bob = Math.sin(t * 12) * (Math.abs(P.speed) ? 1.5 : 0);
  ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(P.x, P.y + 18, 14, 5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#1e1e1e"; ctx.beginPath(); ctx.roundRect(P.x - 11, P.y + 2 + bob, 22, 16, 6); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(P.x, P.y - 6 + bob, 16, 0, 7); ctx.closePath();
  ctx.fillStyle = "#3a2418"; ctx.fill();
  if (face.complete && face.naturalWidth) { ctx.clip(); ctx.drawImage(face, 104 - 86, 138 - 86, 172, 172, P.x - 16, P.y - 22 + bob, 32, 32); }
  ctx.restore();
  ctx.strokeStyle = P.hurtT > 0 ? "#ff6b6b" : "#ffffff"; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(P.x, P.y - 6 + bob, 16, 0, 7); ctx.stroke();
}
function drawHud() {
  const pad = 12;
  // HP
  const hw = Math.min(220, W * 0.45);
  ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.beginPath(); ctx.roundRect(pad, pad, hw, 14, 7); ctx.fill();
  ctx.fillStyle = P.hp / P.maxHp < 0.3 ? "#fa5252" : "#51cf66"; ctx.beginPath(); ctx.roundRect(pad, pad, hw * Math.max(0, P.hp / P.maxHp), 14, 7); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = "600 11px system-ui"; ctx.textAlign = "left"; ctx.fillText(`${Math.ceil(Math.max(0, P.hp))} / ${P.maxHp}`, pad + 8, pad + 11);
  // timer + kills
  ctx.textAlign = "right"; ctx.font = "800 20px system-ui"; ctx.fillText(fmtTime(t), W - pad, pad + 16);
  ctx.font = "600 12px system-ui"; ctx.fillStyle = "#adb5bd"; ctx.fillText(`💀 ${kills}`, W - pad, pad + 34);
  // XP bar across the bottom
  ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, H - 8, W, 8);
  ctx.fillStyle = "#4dabf7"; ctx.fillRect(0, H - 8, W * (xp / xpNeed), 8);
  ctx.textAlign = "left"; ctx.fillStyle = "#e7f5ff"; ctx.font = "700 12px system-ui"; ctx.fillText(`LV ${lvl}`, pad, H - 14);
  // owned upgrade icons
  ctx.font = "16px system-ui";
  let x = pad;
  for (const u of UPGRADES) if (owned[u.id]) { ctx.fillText(u.ic, x, pad + 40); ctx.font = "700 10px system-ui"; ctx.fillStyle = "#fff"; ctx.fillText(owned[u.id], x + 17, pad + 42); ctx.font = "16px system-ui"; x += 32; }
  if (bannerT > 0) {
    ctx.globalAlpha = Math.min(1, bannerT); ctx.textAlign = "center"; ctx.fillStyle = bannerColor;
    ctx.font = `800 ${Math.round(Math.min(30, W / 16))}px system-ui`; ctx.fillText(bannerText, W / 2, H * 0.22); ctx.globalAlpha = 1;
  }
  if (joy && joy.active) {
    ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 50, 0, 7); ctx.stroke();
    const dx = joy.x - joy.ox, dy = joy.y - joy.oy, l = Math.hypot(dx, dy), k = l > 50 ? 50 / l : 1;
    ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.beginPath(); ctx.arc(joy.ox + dx * k, joy.oy + dy * k, 20, 0, 7); ctx.fill();
  }
}
function draw() {
  const sx = shake > 0 ? rand(-6, 6) * shake : 0, sy = shake > 0 ? rand(-6, 6) * shake : 0;
  const ox = P.x - W / 2 / Z, oy = P.y - H / 2 / Z;
  drawBackground(ox, oy);
  ctx.save();
  ctx.translate(sx, sy); ctx.scale(Z, Z); ctx.translate(-ox, -oy);
  if (P.aura) { const R = 70 + P.aura * 18; ctx.fillStyle = `rgba(255,146,43,${0.07 + 0.03 * Math.sin(t * 6)})`; ctx.strokeStyle = "rgba(255,146,43,0.35)"; ctx.beginPath(); ctx.arc(P.x, P.y, R, 0, 7); ctx.fill(); ctx.stroke(); }
  for (const g of gems) { ctx.fillStyle = g.v >= 5 ? "#ffd43b" : "#4dabf7"; ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(Math.PI / 4); ctx.fillRect(-4, -4, 8, 8); ctx.restore(); }
  for (const e of enemies) drawEnemy(e);
  ctx.fillStyle = "#a5d8ff";
  for (const b of bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 4.5, 0, 7); ctx.fill(); }
  ctx.fillStyle = "#ff8787";
  for (const b of ebullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 6, 0, 7); ctx.fill(); }
  for (let i = 0; i < P.fans; i++) {
    const a = P.fanAng + (i / P.fans) * Math.PI * 2, x = P.x + Math.cos(a) * 70, y = P.y + Math.sin(a) * 70;
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * 18);
    ctx.fillStyle = "#ced4da"; for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.ellipse(7, 0, 8, 3.5, 0.4, 0, 7); ctx.fill(); }
    ctx.fillStyle = "#495057"; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 7); ctx.fill(); ctx.restore();
  }
  ctx.strokeStyle = "#d0ebff"; ctx.lineWidth = 2.5;
  for (const z of zaps) {
    ctx.globalAlpha = z.life / 0.18; ctx.beginPath(); ctx.moveTo(z.x1, z.y1);
    for (let k = 1; k < 5; k++) ctx.lineTo(z.x1 + (z.x2 - z.x1) * (k / 5) + rand(-8, 8), z.y1 + (z.y2 - z.y1) * (k / 5) + rand(-8, 8));
    ctx.lineTo(z.x2, z.y2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  drawPlayer();
  for (const f of fx) { ctx.globalAlpha = Math.min(1, f.life / 0.3); ctx.fillStyle = f.color; ctx.fillRect(f.x - 2, f.y - 2, 4, 4); }
  ctx.font = "700 12px system-ui"; ctx.textAlign = "center";
  for (const s of texts) { ctx.globalAlpha = Math.min(1, s.life / 0.3); ctx.fillStyle = s.color; ctx.fillText(s.text, s.x, s.y); }
  ctx.globalAlpha = 1;
  ctx.restore();
  if (P.hurtT > 0) { ctx.fillStyle = `rgba(250,82,82,${P.hurtT * 0.8})`; ctx.fillRect(0, 0, W, H); }
  drawHud();
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000); last = now;
  if (state === "play") { update(dt); bannerT = Math.max(0, bannerT - dt); }
  draw();
  requestAnimationFrame(frame);
}

resize();
reset();
requestAnimationFrame(frame);
