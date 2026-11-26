// PC Build Battle — pick parts on a budget, get FPS estimates, compatibility checks and a score.
// Parts are fictional; numbers are simplified relative scores, not real benchmarks.

const SLOTS = [
  { id: "cpu", label: "Processor", parts: [
    { n: "Ryzo 5 Lite", s: "6 cores · 65 W", price: 110, perf: 55, watt: 65 },
    { n: "Ryzo 7 Core", s: "8 cores · 105 W", price: 230, perf: 78, watt: 105 },
    { n: "Ryzo 9 Max", s: "16 cores · 170 W", price: 520, perf: 96, watt: 170 },
    { n: "Intellix i5 Gen", s: "10 cores · 125 W", price: 190, perf: 70, watt: 125 },
    { n: "Intellix i9 Extreme", s: "24 cores · 250 W", price: 590, perf: 99, watt: 250 },
  ]},
  { id: "gpu", label: "Graphics card", parts: [
    { n: "GeoForce 4050", s: "8 GB · 22 cm", price: 220, perf: 42, watt: 130, len: 22 },
    { n: "Radian 7700", s: "12 GB · 27 cm", price: 420, perf: 62, watt: 230, len: 27 },
    { n: "GeoForce 4070 Ti", s: "12 GB · 30 cm", price: 750, perf: 78, watt: 285, len: 30 },
    { n: "Radian 7900 XTX", s: "24 GB · 33 cm", price: 950, perf: 86, watt: 355, len: 33 },
    { n: "GeoForce 4090 Titan", s: "24 GB · 36 cm", price: 1700, perf: 100, watt: 450, len: 36 },
  ]},
  { id: "ram", label: "Memory", parts: [
    { n: "8 GB DDR4", s: "single stick", price: 25, perf: 40, watt: 5 },
    { n: "16 GB DDR5", s: "2 × 8 GB", price: 60, perf: 80, watt: 8 },
    { n: "32 GB DDR5", s: "2 × 16 GB, 6000 MHz", price: 110, perf: 95, watt: 10 },
    { n: "64 GB DDR5 RGB", s: "4 × 16 GB, glowing", price: 230, perf: 97, watt: 16 },
  ]},
  { id: "storage", label: "Storage", parts: [
    { n: "2 TB Hard Drive", s: "spinning disk", price: 55, perf: 30, watt: 8 },
    { n: "1 TB SATA SSD", s: "550 MB/s", price: 60, perf: 70, watt: 4 },
    { n: "1 TB NVMe Gen4", s: "7000 MB/s", price: 80, perf: 92, watt: 6 },
    { n: "4 TB NVMe Gen5", s: "12000 MB/s", price: 380, perf: 100, watt: 9 },
  ]},
  { id: "cooler", label: "CPU cooler", parts: [
    { n: "Stock fan", s: "handles 90 W", price: 0, cap: 90, watt: 3 },
    { n: "Tower air cooler", s: "handles 180 W", price: 45, cap: 180, watt: 5 },
    { n: "360 mm liquid AIO", s: "handles 280 W", price: 140, cap: 280, watt: 10 },
  ]},
  { id: "psu", label: "Power supply", parts: [
    { n: "450 W Bronze", s: "450 W", price: 45, cap: 450 },
    { n: "650 W Gold", s: "650 W", price: 85, cap: 650 },
    { n: "850 W Gold", s: "850 W", price: 125, cap: 850 },
    { n: "1200 W Platinum", s: "1200 W", price: 260, cap: 1200 },
  ]},
  { id: "case", label: "Case", parts: [
    { n: "Mini ITX Cube", s: "fits GPUs ≤ 28 cm", price: 70, maxLen: 28, air: 0.85 },
    { n: "Mid Tower Mesh", s: "fits GPUs ≤ 34 cm", price: 95, maxLen: 34, air: 1 },
    { n: "Full Tower Glass", s: "fits GPUs ≤ 42 cm", price: 180, maxLen: 42, air: 1 },
  ]},
];
const BUDGETS = [700, 1200, 2000, 4000];
const GAMES = [
  { n: "Esports shooter", cpuW: 0.65, base: 360 },
  { n: "Open-world AAA", cpuW: 0.35, base: 140 },
  { n: "Ray-traced showcase", cpuW: 0.2, base: 95 },
];
const RES = [1, 0.68, 0.36];

const $ = (s) => document.querySelector(s);
const money = (n) => "$" + n.toLocaleString("en-US");
let state = { budget: 1200, pick: {} };
try { state = { ...state, ...JSON.parse(localStorage.getItem("pc-build-battle") || "{}") }; } catch {}
const save = () => { try { localStorage.setItem("pc-build-battle", JSON.stringify(state)); } catch {} };

const part = (slot) => {
  const s = SLOTS.find((x) => x.id === slot);
  return state.pick[slot] != null ? s.parts[state.pick[slot]] : null;
};
const total = () => SLOTS.reduce((t, s) => t + (part(s.id)?.price || 0), 0);

function evaluate() {
  const p = Object.fromEntries(SLOTS.map((s) => [s.id, part(s.id)]));
  const complete = SLOTS.every((s) => p[s.id]);
  const checks = [];
  const spent = total(), over = spent > state.budget;
  const noLimit = state.budget >= 4000;
  checks.push(over ? ["fail", `Over budget by ${money(spent - state.budget)}`] : ["pass", noLimit ? "No budget limit" : `Within budget (${money(state.budget - spent)} left)`]);
  if (!complete) {
    const missing = SLOTS.filter((s) => !p[s.id]).map((s) => s.label.toLowerCase());
    checks.push(["fail", "Missing: " + missing.join(", ")]);
    return { complete, checks, score: 0, fps: null };
  }

  let ok = true, cpuPerf = p.cpu.perf, gpuPerf = p.gpu.perf;
  const draw = p.cpu.watt + p.gpu.watt + p.ram.watt + p.storage.watt + p.cooler.watt + 60;
  if (draw > p.psu.cap) { ok = false; checks.push(["fail", `PSU too weak: needs ~${draw} W, has ${p.psu.cap} W — it won't boot`]); }
  else if (draw > p.psu.cap * 0.85) checks.push(["warn", `PSU running hot: ${draw} W of ${p.psu.cap} W`]);
  else checks.push(["pass", `Power OK: ${draw} W of ${p.psu.cap} W`]);

  if (p.gpu.len > p.case.maxLen) { ok = false; checks.push(["fail", `GPU is ${p.gpu.len} cm — doesn't fit the ${p.case.n}`]); }
  else checks.push(["pass", "GPU fits the case"]);

  if (p.cpu.watt > p.cooler.cap) { cpuPerf *= 0.72; checks.push(["warn", `Cooler can't handle ${p.cpu.watt} W — CPU throttles`]); }
  else checks.push(["pass", "Cooling OK"]);
  cpuPerf *= p.case.air; gpuPerf *= 0.92 + 0.08 * p.case.air;
  if (p.case.air < 1) checks.push(["warn", "Small case: a bit less airflow"]);

  const ramF = 0.75 + 0.25 * (p.ram.perf / 100);
  if (p.ram.perf < 50) checks.push(["warn", "8 GB RAM: expect stutters in big games"]);
  if (p.storage.perf < 50) checks.push(["warn", "Hard drive: very long loading screens"]);

  const gap = gpuPerf - cpuPerf;
  if (gap > 25) checks.push(["warn", "CPU bottleneck — the GPU is waiting on the processor"]);
  else if (gap < -30) checks.push(["warn", "GPU is the weak link for this CPU"]);
  else checks.push(["pass", "Well balanced CPU and GPU"]);

  const fps = GAMES.map((g) => RES.map((r) => {
    if (!ok) return 0;
    const gpuSide = (gpuPerf / 100) * r;
    const cpuSide = cpuPerf / 100;
    const limit = Math.min(gpuSide, cpuSide * (1 / Math.max(0.3, g.cpuW)) * 0.7 + gpuSide * 0.3);
    return Math.round(g.base * limit * ramF);
  }));

  // score: performance 50, value 20, balance 15, compatibility 15
  const perfScore = ok ? Math.min(50, (fps[1][1] / 90) * 50) : 0;
  const value = ok && !over ? Math.min(20, ((fps[1][1] / Math.max(1, spent)) * 1000) / 75 * 20) : 0;
  const balance = Math.max(0, 15 - Math.max(0, Math.abs(gap) - 10) * 0.6);
  const compat = (ok ? 15 : 0) - checks.filter((c) => c[0] === "warn").length * 2;
  let score = Math.round(perfScore + value + balance + Math.max(0, compat));
  if (over) score = Math.min(score, 25);
  if (!ok) score = 0;
  return { complete, checks, score: Math.max(0, Math.min(100, score)), fps, ok, over };
}

const VERDICTS = [
  [90, "Carter-approved 🔥", "Thumbnail-worthy. This one's going in a video."],
  [75, "Certified gaming rig", "Smooth frames, smart spending. Respect."],
  [60, "Solid build", "Plays everything — a couple of tweaks from great."],
  [40, "Budget-ish beast", "It runs. Check the warnings for easy wins."],
  [1, "Needs work", "Something's holding this build back — see the checks."],
  [0, "Won't boot", "Fix the red checks and try again."],
];

function render() {
  const spent = total(), over = spent > state.budget;
  $("#budgets").innerHTML = BUDGETS.map((b) => `<button data-b="${b}" aria-pressed="${b === state.budget}">${b >= 4000 ? "No limit" : money(b)}</button>`).join("");
  $("#spent").textContent = money(spent);
  $("#budget").textContent = state.budget >= 4000 ? "no limit" : money(state.budget);
  $("#left").textContent = over ? `${money(spent - state.budget)} over` : state.budget >= 4000 ? "" : `${money(state.budget - spent)} left`;
  $("#left").classList.toggle("over", over);
  const bar = $("#spendBar");
  bar.style.width = Math.min(100, (spent / state.budget) * 100) + "%";
  bar.classList.toggle("over", over);

  $("#parts").innerHTML = SLOTS.map((s) => `
    <div class="slot"><h2>${s.label}</h2><div class="opts">
      ${s.parts.map((p, i) => {
        const cur = part(s.id)?.price || 0;
        const cant = spent - cur + p.price > state.budget;
        return `<button class="opt${cant ? " cant" : ""}" data-slot="${s.id}" data-i="${i}" aria-pressed="${state.pick[s.id] === i}">
          <span class="n">${p.n}</span><span class="s">${p.s}</span><span class="p">${p.price ? money(p.price) : "Free"}</span></button>`;
      }).join("")}
    </div></div>`).join("");

  const r = evaluate();
  $("#score").textContent = r.score;
  const [, title, text] = !r.complete ? [0, "Pick some parts", "Every slot needs a part before the build can boot."] : !r.ok ? VERDICTS[5] : VERDICTS.find(([min]) => r.score >= min);
  $("#verdictTitle").textContent = title;
  $("#verdict").textContent = r.over && r.complete ? "Over budget — Carter caps your score at 25." : text;
  $("#fps").innerHTML = GAMES.map((g, gi) => `<tr><td>${g.n}</td>${[0, 1, 2].map((ri) => {
    const v = r.fps ? r.fps[gi][ri] : null;
    const cls = v == null ? "" : v >= 90 ? "good" : v >= 50 ? "ok" : "bad";
    return `<td class="${cls}">${v == null ? "—" : v}</td>`;
  }).join("")}</tr>`).join("");
  $("#checks").innerHTML = r.checks.map(([k, t]) => `<li class="${k}">${t}</li>`).join("");
}

$("#budgets").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-b]");
  if (!b) return;
  state.budget = +b.dataset.b; save(); render();
});
$("#parts").addEventListener("click", (e) => {
  const b = e.target.closest(".opt");
  if (!b) return;
  const { slot, i } = b.dataset;
  state.pick[slot] = state.pick[slot] === +i ? undefined : +i;
  save(); render();
});
$("#randomBtn").onclick = () => {
  for (const s of SLOTS) state.pick[s.id] = Math.floor(Math.random() * s.parts.length);
  save(); render();
};
$("#clearBtn").onclick = () => { state.pick = {}; save(); render(); };

render();
