'use strict';
/* KOSO: a spinning-top battle from the compound.
   World units: the chalk ring has radius R, centred on (0,0). +y is down the screen. */

const R = 300;
const HAND_Y = R + 95;          // where each side holds its top before the throw
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const len = (x, y) => Math.hypot(x, y);

// ---------------------------------------------------------------- data
const TOPS = {
  omo:    { name: 'Ọmọ Ìta',   r: 44, m: 1.0,  acc: 430, drag: 1.75, decay: 0.020, pow: 1.0,  dashCd: 1.05, wood: '#d7a86a', bands: ['#c8312b', '#f6f1e7', '#2f8f4e', '#c8312b', '#f4b63d'], stripe: '#7c1d18', knob: '#8a5a2b' },
  baby:   { name: 'Baby Koso', r: 39, m: 0.82, acc: 375, drag: 1.75, decay: 0.022, pow: 0.85, dashCd: 1.2,  wood: '#e2bb7d', bands: ['#f4b63d', '#fbe3a0', '#e39b1b', '#f4b63d'], stripe: '#a8650c', knob: '#9a6a35' },
  dart:   { name: 'Dart',      r: 39, m: 0.8,  acc: 520, drag: 1.65, decay: 0.023, pow: 0.92, dashCd: 0.9,  wood: '#d9b07a', bands: ['#2b6cd3', '#f6f1e7', '#2b6cd3', '#f6f1e7', '#2b6cd3'], stripe: '#12387a', knob: '#7d5530' },
  iroko:  { name: 'Iroko',     r: 52, m: 1.35, acc: 340, drag: 1.85, decay: 0.024, pow: 1.0, dashCd: 1.3,  wood: '#6e4320', bands: ['#5a3519', '#8b5a2f', '#4a2a12', '#7b4a24'], stripe: '#2b170a', knob: '#3d2410' },
  wahala: { name: 'Wahala',    r: 43, m: 1.0,  acc: 460, drag: 1.7,  decay: 0.022, pow: 1.0,  dashCd: 0.75, wood: '#d7a86a', bands: ['#e5398d', '#f4b63d', '#2bb3a3', '#7a3fd1', '#f6f1e7'], stripe: '#2b3a67', knob: '#8a5a2b' },
  nail:   { name: 'Nail Tip',  r: 45, m: 1.2,  acc: 475, drag: 1.7,  decay: 0.019, pow: 1.08, dashCd: 1.0,  wood: '#3a2a22', bands: ['#1d1a1a', '#c8312b', '#1d1a1a', '#c8312b'], stripe: '#f6f1e7', knob: '#b9c0c8', nail: true },
};
const TOP_ORDER = ['omo', 'baby', 'dart', 'iroko', 'wahala', 'nail'];
const KIDS = [
  { id: 'tunde', name: 'Tunde',    top: 'baby',   hazard: null,      hz: '',                       quote: 'Na my first time o. Abeg go easy.', ai: { skill: .15, aggro: .45, dash: .4, react: .45, perfect: .08, jitter: .25 } },
  { id: 'kemi',  name: 'Kemi',     top: 'dart',   hazard: 'sand',    hz: 'Sand patches slow you',  quote: 'You no fit catch me.',              ai: { skill: .45, aggro: .8,  dash: 1.1, react: .27, perfect: .3,  jitter: .18 } },
  { id: 'sola',  name: 'Big Sola', top: 'iroko',  hazard: 'caps',    hz: 'Bottle caps everywhere', quote: 'Iroko no dey shake.',               ai: { skill: .55, aggro: .6,  dash: .65, react: .22, perfect: .38, jitter: .12 } },
  { id: 'ify',   name: 'Ify',      top: 'wahala', hazard: 'chicken', hz: 'A chicken wanders in',   quote: 'Wahala dey o!',                     ai: { skill: .62, aggro: .95, dash: 2.0, react: .18, perfect: .42, jitter: .4 } },
  { id: 'oga',   name: 'Oga Nail', top: 'nail',   hazard: 'broom',   hz: "Mama's broom sweeps",    quote: 'Bring your koso. Na mine e go be.', ai: { skill: .7, aggro: .8, dash: 1.2, react: .14, perfect: .45,  jitter: .06 } },
];
const KID_BY = Object.fromEntries(KIDS.map(k => [k.id, k]));
const ATTRACT_AI = { skill: .55, aggro: .8, dash: 1.2, react: .2, perfect: .4, jitter: .2 };

// ---------------------------------------------------------------- save
const SAVE_KEY = 'koso:v1';
let save = { beaten: {}, tops: ['omo'], runMs: 0, best: null, champs: 0, hints: 0, sel: 'omo', duo: ['omo', 'nail'] };
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) {}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }

// ---------------------------------------------------------------- canvas + assets
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1, S = 1, CX = 0, CY = 0, HUDH = 70;
const IMG = {};
function loadImg(k, src) { return new Promise(res => { const i = new Image(); i.onload = () => { IMG[k] = i; res(); }; i.onerror = res; i.src = src; }); }

// arena plate: 1600px image, ring centre (800.8, 800.5), chalk radius 556.25px
const PLATE = { cx: 800.8, cy: 800.5, r: 556.25, size: 1600 };
const PK = R / PLATE.r;               // world units per plate pixel
let plateFeather = null, dirtPattern = null, scuff = null, sctx = null;

function buildPlate() {
  const im = IMG.arena; if (!im) return;
  // feathered copy so the plate melts into the repeating dirt
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0, 1024, 1024);
  g.globalCompositeOperation = 'destination-out';
  const f = 110;
  const mk = (x0, y0, x1, y1) => { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); return gr; };
  g.fillStyle = mk(0, 0, f, 0); g.fillRect(0, 0, f, 1024);
  g.fillStyle = mk(1024, 0, 1024 - f, 0); g.fillRect(1024 - f, 0, f, 1024);
  g.fillStyle = mk(0, 0, 0, f); g.fillRect(0, 0, 1024, f);
  g.fillStyle = mk(0, 1024, 0, 1024 - f); g.fillRect(0, 1024 - f, 1024, f);
  plateFeather = c;
  // seamless dirt tile mirrored from a clean patch inside the ring
  const t = document.createElement('canvas'); t.width = t.height = 400;
  const tg = t.getContext('2d'); const sx = 600, sy = 640, sz = 200;
  tg.drawImage(im, sx, sy, sz, sz, 0, 0, 200, 200);
  tg.save(); tg.translate(400, 0); tg.scale(-1, 1); tg.drawImage(im, sx, sy, sz, sz, 0, 0, 200, 200); tg.restore();
  tg.save(); tg.translate(0, 400); tg.scale(1, -1); tg.drawImage(im, sx, sy, sz, sz, 0, 0, 200, 200); tg.restore();
  tg.save(); tg.translate(400, 400); tg.scale(-1, -1); tg.drawImage(im, sx, sy, sz, sz, 0, 0, 200, 200); tg.restore();
  tg.fillStyle = 'rgba(60,20,5,0.10)'; tg.fillRect(0, 0, 400, 400);
  dirtPattern = ctx.createPattern(t, 'repeat');
}
function resetScuff() {
  if (!scuff) { scuff = document.createElement('canvas'); scuff.width = scuff.height = 1200; sctx = scuff.getContext('2d'); }
  sctx.clearRect(0, 0, 1200, 1200);
}

function resize() {
  W = innerWidth; H = innerHeight; DPR = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  HUDH = 66;
  const needW = 2 * R + 60, needH = 2 * (HAND_Y + (W > H ? 95 : 44));
  S = Math.min(W / needW, (H - HUDH) / needH);
  CX = W / 2; CY = HUDH + (H - HUDH) / 2;
}
addEventListener('resize', resize);

// ---------------------------------------------------------------- art: tops
function drawTop(g, spec, r, ang, spin, wob, phi) {
  const tx = Math.cos(phi) * wob * r * 0.3, ty = Math.sin(phi) * wob * r * 0.3;
  g.save();
  g.translate(tx * 0.35, ty * 0.35);
  // wooden body
  const wg = g.createRadialGradient(-r * .3, -r * .3, r * .1, 0, 0, r);
  wg.addColorStop(0, spec.wood); wg.addColorStop(1, shade(spec.wood, -0.35));
  g.fillStyle = wg; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
  // paint bands
  const n = spec.bands.length, outer = 0.97, inner = 0.3, bw = (outer - inner) / n;
  for (let i = 0; i < n; i++) {
    g.fillStyle = spec.bands[i];
    g.beginPath(); g.arc(0, 0, r * (outer - i * bw), 0, TAU); g.fill();
  }
  g.fillStyle = shade(spec.wood, -0.1); g.beginPath(); g.arc(0, 0, r * inner, 0, TAU); g.fill();
  // stripes that show the rotation; they smear away at high spin like a real top
  const vis = clamp(1 - spin * 1.25, 0, 1);
  const sa = 0.12 + 0.78 * vis;
  g.save(); g.rotate(ang); g.globalAlpha = sa; g.fillStyle = spec.stripe;
  const k = 4;
  for (let i = 0; i < k; i++) {
    const a0 = i * TAU / k;
    g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r * 0.95, a0, a0 + 0.32 + spin * 0.9); g.closePath(); g.fill();
  }
  g.restore();
  // motion smear rings
  if (spin > 0.25) {
    g.save(); g.rotate(ang * 0.15); g.globalAlpha = 0.25 * spin; g.strokeStyle = '#fff'; g.lineWidth = r * 0.06;
    g.beginPath(); g.arc(0, 0, r * 0.78, 0.2, 1.4); g.stroke();
    g.beginPath(); g.arc(0, 0, r * 0.55, 3.3, 4.2); g.stroke();
    g.restore();
  }
  // light and shade
  const lg = g.createRadialGradient(-r * .45, -r * .5, r * .05, -r * .1, -r * .1, r * 1.15);
  lg.addColorStop(0, 'rgba(255,255,255,0.42)'); lg.addColorStop(0.45, 'rgba(255,255,255,0.04)'); lg.addColorStop(1, 'rgba(30,8,0,0.38)');
  g.fillStyle = lg; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(40,14,4,0.75)'; g.lineWidth = Math.max(1.5, r * 0.06); g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
  g.restore();
  // knob (or nail head)
  g.save(); g.translate(tx, ty);
  const kr = r * (spec.nail ? 0.17 : 0.22);
  const kg = g.createRadialGradient(-kr * .4, -kr * .4, kr * .1, 0, 0, kr);
  kg.addColorStop(0, spec.nail ? '#f4f7fa' : shade(spec.knob, 0.35)); kg.addColorStop(1, spec.nail ? '#5d646c' : shade(spec.knob, -0.3));
  g.fillStyle = kg; g.beginPath(); g.arc(0, 0, kr, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(40,14,4,0.8)'; g.lineWidth = Math.max(1, r * 0.04); g.stroke();
  g.restore();
}
function drawLyingTop(g, spec, r, a) {
  g.save(); g.rotate(a);
  g.beginPath();
  g.moveTo(r * 1.25, 0);
  g.quadraticCurveTo(r * 0.6, r * 0.82, -r * 0.55, r * 0.78);
  g.lineTo(-r * 0.55, -r * 0.78);
  g.quadraticCurveTo(r * 0.6, -r * 0.82, r * 1.25, 0);
  g.closePath();
  g.save(); g.clip();
  g.fillStyle = spec.wood; g.fillRect(-r, -r, r * 2.4, r * 2);
  const n = spec.bands.length;
  for (let i = 0; i < n; i++) { g.fillStyle = spec.bands[i]; g.fillRect(-r * 0.55 + i * r * 0.26, -r, r * 0.17, r * 2); }
  const sh = g.createLinearGradient(0, -r, 0, r);
  sh.addColorStop(0, 'rgba(255,255,255,0.35)'); sh.addColorStop(0.45, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(30,8,0,0.45)');
  g.fillStyle = sh; g.fillRect(-r, -r, r * 2.4, r * 2);
  g.restore();
  g.strokeStyle = 'rgba(40,14,4,0.8)'; g.lineWidth = r * 0.06; g.stroke();
  g.fillStyle = spec.nail ? '#b9c0c8' : spec.knob;
  g.beginPath(); g.ellipse(-r * 0.66, 0, r * 0.14, r * 0.24, 0, 0, TAU); g.fill(); g.stroke();
  if (spec.nail) { g.fillStyle = '#9aa2aa'; g.fillRect(r * 1.2, -r * 0.05, r * 0.22, r * 0.1); }
  g.restore();
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, gg = (n >> 8) & 255, b = n & 255;
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round((t - r) * p + r); gg = Math.round((t - gg) * p + gg); b = Math.round((t - b) * p + b);
  return `rgb(${r},${gg},${b})`;
}
function topIcon(c, id, spin = 0, ang = 0.6) {
  const g = c.getContext('2d'), s = c.width;
  g.clearRect(0, 0, s, s); g.save(); g.translate(s / 2, s / 2);
  const r = s * 0.4;
  g.fillStyle = 'rgba(40,12,0,0.25)'; g.beginPath(); g.ellipse(r * 0.12, r * 0.18, r, r * 0.96, 0, 0, TAU); g.fill();
  drawTop(g, TOPS[id], r, ang, spin, 0, 0);
  g.restore();
}
function iconCanvas(id, px = 92) { const c = document.createElement('canvas'); c.width = c.height = px; topIcon(c, id); return c; }

// ---------------------------------------------------------------- game state
const G = {
  mode: 'attract',     // attract | ladder | duo
  phase: 'idle',       // idle | throw | battle | end
  paused: false,
  tops: [], ctrl: ['cpu', 'cpu'], ai: [ATTRACT_AI, ATTRACT_AI],
  kid: null, round: 0, score: [0, 0], order: [], thr: null,
  bt: 0, matchT: 0, endT: 0, stop: 0, shake: 0, camPunch: 0,
  parts: [], pops: [], caps: [], sand: [], chicken: null, chickenT: 0, broom: null, broomT: 0,
  pairCd: 0, quiet: true,
};

function mkTop(id, side) {
  const sp = TOPS[id];
  return { id, spec: sp, side, r: sp.r, m: sp.m, x: 0, y: side === 0 ? HAND_Y : -HAND_Y, vx: 0, vy: 0,
    spin: 0, ang: Math.random() * TAU, wob: 0, phi: 0, state: 'hand', dashCd: 0, dashT: 0, u: { x: 0, y: 0 },
    uWant: { x: 0, y: 0 }, aiT: 0, mode: 'attack', fallT: 0, fallA: 0, fallW: 0, hum: null, fl: null, px: 0, py: 0, outT: 0 };
}

// ---------------------------------------------------------------- particles & popups
function puff(x, y, n, sp = 60, col = '214,160,110') {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, v = rnd(sp * 0.3, sp);
    G.parts.push({ t: 'dust', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: rnd(0.45, 0.9), r: rnd(6, 13), col });
  }
}
function chips(x, y, n, cols, sp = 220) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, v = rnd(sp * 0.4, sp);
    G.parts.push({ t: 'chip', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: rnd(0.35, 0.7), r: rnd(2.5, 5), rot: Math.random() * TAU, vr: rnd(-14, 14), col: cols[i % cols.length] });
  }
}
function sparks(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, v = rnd(200, 520);
    G.parts.push({ t: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: rnd(0.15, 0.3) });
  }
}
function feathers(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, v = rnd(40, 160);
    G.parts.push({ t: 'feather', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: rnd(1.0, 1.8), rot: Math.random() * TAU, vr: rnd(-4, 4) });
  }
}
function shock(x, y, r0 = 20) { G.parts.push({ t: 'ring', x, y, life: 0, max: 0.35, r: r0 }); }
function pop(txt, x, y, col = '#f6f1e7', size = 46) { G.pops.push({ txt, x, y, life: 0, max: 0.9, col, size }); }

// ---------------------------------------------------------------- round flow
function startMatch(mode, opts = {}) {
  G.mode = mode; G.score = [0, 0]; G.round = 0; G.matchT = 0; G.quiet = mode === 'attract';
  if (mode === 'ladder') {
    G.kid = KID_BY[opts.kid];
    G.specs = [opts.top || 'omo', G.kid.top];
    G.ctrl = ['human', 'cpu']; G.ai = [null, G.kid.ai];
    G.hazard = G.kid.hazard;
  } else if (mode === 'duo') {
    G.kid = null; G.specs = [save.duo[0], save.duo[1]];
    G.ctrl = ['human', 'human']; G.ai = [null, null]; G.hazard = 'caps';
  } else {
    G.kid = null;
    const pool = TOP_ORDER.slice();
    G.specs = [pool.splice(Math.floor(Math.random() * pool.length), 1)[0], pool[Math.floor(Math.random() * pool.length)]];
    G.ctrl = ['cpu', 'cpu']; G.ai = [ATTRACT_AI, ATTRACT_AI]; G.hazard = null;
  }
  G.sand = [];
  if (G.hazard === 'sand') {
    for (let i = 0; i < 3; i++) {
      for (let tries = 0; tries < 30; tries++) {
        const a = Math.random() * TAU, d = rnd(40, R * 0.62), x = Math.cos(a) * d, y = Math.sin(a) * d, r = rnd(56, 82);
        if (G.sand.every(s => len(s.x - x, s.y - y) > s.r + r + 10)) { G.sand.push({ x, y, r, seed: Math.random() * 1000 }); break; }
      }
    }
    buildSandArt();
  }
  updateHud();
  startRound();
}

function startRound() {
  stopHums();
  G.tops = [mkTop(G.specs[0], 0), mkTop(G.specs[1], 1)];
  G.parts = []; G.pops = []; G.chicken = null; G.broom = null;
  G.chickenT = rnd(2, 4); G.broomT = 6.5;
  G.caps = [];
  if (G.hazard === 'caps' || G.mode === 'duo') {
    const cols = ['#c8312b', '#2f8f4e', '#f4b63d', '#2b6cd3', '#d9d9d9', '#c8312b', '#2f8f4e'];
    for (let i = 0; i < 7; i++) {
      for (let tries = 0; tries < 30; tries++) {
        const a = Math.random() * TAU, d = rnd(60, R * 0.8), x = Math.cos(a) * d, y = Math.sin(a) * d;
        if (G.caps.every(c => len(c.x - x, c.y - y) > 40)) { G.caps.push({ x, y, vx: 0, vy: 0, r: 13, m: 0.14, rot: Math.random() * TAU, col: cols[i], out: false }); break; }
      }
    }
  }
  resetScuff();
  // throw order alternates: rounds 1 and 3 the opponent (side 1) throws first
  G.order = G.round % 2 === 0 ? [1, 0] : [0, 1];
  G.phase = 'throw'; G.bt = 0;
  updateHud();
  nextThrower();
}

function nextThrower() {
  const side = G.order.shift();
  if (side === undefined) { beginBattle(); return; }
  const t = G.tops[side];
  G.thr = { side, t, human: G.ctrl[side] === 'human', holding: false, ph: 0, holdT: 0, sx: 0, sy: 0, x: 0, y: 0,
    kb: false, aim: side === 0 ? -Math.PI / 2 : Math.PI / 2, pull: 73, wait: 0, cpuHold: rnd(0.9, 1.5), cpuT: 0, ptr: null };
  if (!G.thr.human) planCpuThrow(G.thr);
  if (G.thr.human && !G.quiet) {
    AU.duck(true);
    if (save.hints < 3) hint(isTouch ? 'Drag back to wind. Let go when the rings meet.' : 'Drag back with the mouse (or hold SPACE + arrows). Let go when the rings meet.', side === 1);
  }
}

function beginBattle() {
  G.thr = null; G.phase = 'battle'; G.bt = 0;
  hideHint(); AU.duck(false);
  if (!G.quiet) {
    banner('SPIN!', '', 650); AU.fx.sting();
    if (save.hints < 3 && G.mode !== 'attract') {
      setTimeout(() => { if (G.phase === 'battle') hint(isTouch ? 'Steer with your thumb. GBAM to charge.' : 'WASD / arrows to steer. SPACE to GBAM.'); }, 700);
      setTimeout(hideHint, 4200);
    }
    if (G.mode === 'duo') { show('dash0'); show('dash1'); } else show('dash0');
  }
}

function endRound(winner, why) {
  if (G.phase !== 'battle' && G.phase !== 'throw') return;
  G.phase = 'end'; G.endT = 0; G.thr = null; hideHint();
  hide('dash0'); hide('dash1');
  if (winner !== null) G.score[winner]++;
  updateHud();
  if (G.quiet) { setTimeout(() => { if (G.mode === 'attract') { G.round++; if (G.score[0] > 1 || G.score[1] > 1) startMatch('attract'); else startRound(); } }, 1600); return; }
  const who = winner === null ? 'DRAW' : roundName(winner);
  banner(why, winner === null ? 'Throw again' : who, 1500);
  if (winner === null) AU.fx.lose(); else if (G.ctrl[winner] === 'human' && G.mode === 'ladder') { AU.fx.win(); } else if (G.mode === 'duo') AU.fx.win(); else AU.fx.lose();
  AU.swell(0.1);
  setTimeout(() => {
    if (G.mode === 'attract') return;
    if (G.score[0] >= 2 || G.score[1] >= 2) endMatch(G.score[0] >= 2 ? 0 : 1);
    else { if (winner !== null) G.round++; startRound(); }
  }, 1700);
}
function roundName(side) {
  if (G.mode === 'duo') return side === 0 ? 'ROUND TO PLAYER 1' : 'ROUND TO PLAYER 2';
  return side === 0 ? 'ROUND TO YOU' : 'ROUND TO ' + G.kid.name.toUpperCase();
}

function stopHums() { for (const t of G.tops) if (t.hum) { t.hum.stop(); t.hum = null; } }

// ---------------------------------------------------------------- throwing
const WIND_P = 0.95, WIND_TGT = 0.72;
function throwGeom(thr) {
  // returns landing target and normalised direction from the current aim/pull
  const side = thr.side, hy = side === 0 ? HAND_Y : -HAND_Y;
  const d = clamp(thr.pull, 0, 150);   // pull is in screen px so it feels the same on every device
  const dist = lerp(120, 2 * R + 140, clamp((d - 12) / 138, 0, 1));
  const dx = Math.cos(thr.aim), dy = Math.sin(thr.aim);
  return { hx: 0, hy, dx, dy, tx: dx * dist, ty: hy + dy * dist, pull: d };
}
function aimFromPointer(thr) {
  const ddx = thr.sx - thr.x, ddy = thr.sy - thr.y;
  const fwd = thr.side === 0 ? -Math.PI / 2 : Math.PI / 2;
  let a = Math.atan2(ddy, ddx), rel = Math.atan2(Math.sin(a - fwd), Math.cos(a - fwd));
  rel = clamp(rel, -1.15, 1.15);
  thr.aim = fwd + rel; thr.pull = len(ddx, ddy);
}
function windQuality(ph) {
  const err = Math.abs(ph - WIND_TGT);
  if (err < 0.055) return { q: 1, spin: 1, label: 'PERFECT!' };
  if (err < 0.16) return { q: 0.7, spin: 0.95 - (err - 0.055) * 0.95, label: 'GOOD' };
  return { q: 0.3, spin: clamp(0.8 - (err - 0.16) * 0.7, 0.58, 0.8), label: 'LOOSE' };
}
function release(thr) {
  if (!thr || thr.done) return;
  if (thr.human && thr.pull < 12) { thr.holding = false; thr.kb = false; return; }  // a tap without a pull: cancel
  thr.done = true;
  const gq = throwGeom(thr), wq = thr.forceQ || windQuality(thr.ph);
  const t = thr.t;
  t.spin = wq.spin; t.state = 'air';
  const sx = gq.hx - gq.dx * gq.pull * 0.3 / S, sy = gq.hy - gq.dy * gq.pull * 0.3 / S;
  const dist = len(gq.tx - sx, gq.ty - sy);
  t.fl = { sx, sy, tx: gq.tx, ty: gq.ty, t: 0, dur: 0.38 + dist / 1500, dx: gq.dx, dy: gq.dy, v: 50 + 50 * wq.q };
  t.x = sx; t.y = sy;
  if (!G.quiet) {
    AU.fx.whoosh(); AU.fx.zip(0.6);
    if (wq.q === 1) { AU.fx.perfect(); pop('PERFECT!', gq.tx, gq.ty - 50, '#f4b63d', 40); }
    else pop(wq.label, gq.tx, gq.ty - 50, '#f6f1e7', 30);
  }
  if (thr.human) { save.hints++; persist(); hideHint(); }
}
function land(t) {
  const f = t.fl; t.fl = null; t.fl0x = f.dx; t.fl0y = f.dy;
  t.x = f.tx; t.y = f.ty; t.vx = f.dx * f.v; t.vy = f.dy * f.v;
  if (len(t.x, t.y) > R - t.r * 0.2) {
    // landed outside the chalk
    t.state = 'out'; t.outT = 0;
    puff(t.x, t.y, 8);
    if (!G.quiet) AU.fx.thunk(0.6);
    endRound(1 - t.side, 'MISSED!');
    return;
  }
  t.state = 'spin';
  puff(t.x, t.y, 10, 70); shock(t.x, t.y, t.r);
  G.shake = Math.max(G.shake, 4);
  if (!G.quiet) { AU.fx.thunk(1); t.hum = AU.hum(); }
  // direct hit on a top that is already spinning
  const o = G.tops[1 - t.side];
  if (o.state === 'spin' && len(o.x - t.x, o.y - t.y) < t.r + o.r + 6) {
    t.vx = t.fl0x * 320; t.vy = t.fl0y * 320;
    collideTops(t, o, true);
    pop('KPA!', (t.x + o.x) / 2, (t.y + o.y) / 2 - 30, '#f4b63d', 54);
  }
  if (G.phase === 'throw') nextThrower();
}
function planCpuThrow(thr) {
  const ai = G.ai[thr.side], side = thr.side, hy = side === 0 ? HAND_Y : -HAND_Y;
  const o = G.tops[1 - side];
  let tx, ty;
  if (o.state === 'spin' && Math.random() < 0.35 + 0.5 * ai.skill) {
    const er = 14 + 80 * (1 - ai.skill), a = Math.random() * TAU;
    tx = o.x + Math.cos(a) * er * Math.random(); ty = o.y + Math.sin(a) * er * Math.random();
  } else {
    const a = (side === 0 ? Math.PI / 2 : -Math.PI / 2) + rnd(-1, 1), d = rnd(0.12, 0.5) * R;
    tx = Math.cos(a) * d; ty = Math.sin(a) * d;
  }
  if (len(tx, ty) > R * 0.82) { const k = R * 0.82 / len(tx, ty); tx *= k; ty *= k; }
  const dx = tx, dy = ty - hy, dist = len(dx, dy);
  thr.aim = Math.atan2(dy, dx);
  thr.pull = 12 + (dist - 120) / (2 * R + 20) * 138;
  thr.forceQ = Math.random() < ai.perfect ? windQuality(WIND_TGT) : windQuality(WIND_TGT + (Math.random() < 0.5 ? -1 : 1) * rnd(0.06, 0.06 + 0.3 * (1 - ai.skill)));
}

// ---------------------------------------------------------------- physics
const DT = 1 / 120;
const DG = [{ decay: 0, hit: 0, dash: 0, n: 0 }, { decay: 0, hit: 0, dash: 0, n: 0 }];
const TUNE = { dish: 0.85, dmg: 0.00008, dashCost: 0.03, rest: 1.6, clash: 1.0, dashSp: 470 };
function stepPhys(dt) {
  const battle = G.phase === 'battle';
  if (battle) G.bt += dt;
  if (G.phase === 'throw' || battle) G.matchT += dt;
  if (G.pairCd > 0) G.pairCd -= dt;

  // throw controller
  const thr = G.thr;
  if (thr && !thr.done) {
    if (thr.human) {
      if (thr.holding) {
        thr.holdT += dt; const prev = thr.ph; thr.ph = (thr.holdT / WIND_P) % 1;
        if (thr.ph < prev && !G.quiet) AU.fx.zip(0.5);
        if (thr.kb) {
          const k = keyVec(thr.side);
          thr.aim += k.x * 1.6 * dt * (thr.side === 0 ? 1 : -1);
          const fwd = thr.side === 0 ? -Math.PI / 2 : Math.PI / 2;
          thr.aim = fwd + clamp(Math.atan2(Math.sin(thr.aim - fwd), Math.cos(thr.aim - fwd)), -1.15, 1.15);
          thr.pull = clamp(thr.pull - k.y * 110 * dt * (thr.side === 0 ? 1 : -1), 13, 150);
        }
      } else {
        thr.wait += dt;
        if (thr.wait > 12 && G.mode !== 'duo') { thr.pull = 73; thr.ph = 0.3; release(thr); }
      }
    } else {
      thr.cpuT += dt;
      if (thr.cpuT > 0.35) { thr.holding = true; thr.holdT += dt; thr.ph = (thr.holdT / WIND_P) % 1; }
      if (thr.cpuT > 0.35 + thr.cpuHold) release(thr);
    }
  }

  for (const t of G.tops) {
    if (t.state === 'air') {
      t.fl.t += dt; const k = clamp(t.fl.t / t.fl.dur, 0, 1);
      t.x = lerp(t.fl.sx, t.fl.tx, k); t.y = lerp(t.fl.sy, t.fl.ty, k); t.ang += 25 * dt;
      if (k >= 1) land(t);
      continue;
    }
    if (t.state === 'spin') {
      const o = G.tops[1 - t.side];
      let ux = 0, uy = 0;
      if (battle) {
        if (G.ctrl[t.side] === 'human') { const v = steerVec(t.side); ux = v.x; uy = v.y; }
        else { aiSteer(t, o, G.ai[t.side], dt); ux = t.u.x; uy = t.u.y; }
      }
      const grip = 0.32 + 0.68 * clamp(t.spin / 0.5, 0, 1);
      let ax = ux * t.spec.acc * grip, ay = uy * t.spec.acc * grip;
      ax -= t.x * TUNE.dish; ay -= t.y * TUNE.dish;           // the ring is a very shallow dish
      t.wob = clamp((0.3 - t.spin) / 0.3, 0, 1);
      if (t.wob > 0) { ax += Math.cos(t.phi * 0.7) * t.wob * 240; ay += Math.sin(t.phi * 0.7) * t.wob * 240; }
      let drag = t.spec.drag, extra = 0;
      for (const s of G.sand) if (len(t.x - s.x, t.y - s.y) < s.r) { drag *= 2.6; extra = 0.03; }
      if (G.broom && G.broom.state === 'sweep') { const f = broomForce(t.x, t.y); ax += f.x * 3400; ay += f.y * 3400; }
      t.vx += ax * dt; t.vy += ay * dt;
      const dmp = Math.exp(-drag * dt); t.vx *= dmp; t.vy *= dmp;
      t.px = t.x; t.py = t.y;
      t.x += t.vx * dt; t.y += t.vy * dt;
      if (battle) { const dl = (t.spec.decay + 0.006 * len(ux, uy) + extra) * dt; t.spin -= dl; DG[t.side].decay += dl; }
      t.ang += (5 + t.spin * 40) * dt; t.phi += (3 + 10 * (1 - t.spin)) * dt;
      if (t.dashCd > 0) t.dashCd -= dt;
      if (t.dashT > 0) t.dashT -= dt;
      // scuff marks in the dirt
      t.trail = (t.trail || 0) + len(t.x - t.px, t.y - t.py);
      if (sctx && t.trail > 10 && len(t.x, t.y) < R + 10) {   // a faint dusty track behind the top
        t.trail = 0;
        const gx = 600 + t.x * 2, gy = 600 + t.y * 2, rr = t.r * 0.9;
        const gr = sctx.createRadialGradient(gx, gy, 0, gx, gy, rr);
        gr.addColorStop(0, 'rgba(240,190,140,0.05)'); gr.addColorStop(1, 'rgba(240,190,140,0)');
        sctx.fillStyle = gr; sctx.beginPath(); sctx.arc(gx, gy, rr, 0, TAU); sctx.fill();
      }
      if (t.hum) t.hum.set(Math.max(0, t.spin), len(t.vx, t.vy), t.wob);
      if (len(t.x, t.y) > R + t.r * 0.25) { knockOut(t); continue; }
      if (t.spin <= 0) { fallOver(t); continue; }
    } else if (t.state === 'fall' || t.state === 'out') {
      const dmp = Math.exp(-(t.state === 'fall' ? 3 : 1.4) * dt); t.vx *= dmp; t.vy *= dmp;
      t.x += t.vx * dt; t.y += t.vy * dt;
      if (t.state === 'fall') { t.fallT = Math.min(1, t.fallT + dt / 0.4); t.fallA += t.fallW * dt; t.fallW *= Math.exp(-1.5 * dt); }
      else { t.outT += dt; t.ang += (5 + t.spin * 40) * dt; t.spin = Math.max(0, t.spin - dt * 0.4); }
    }
  }
  // collisions
  const [a, b] = G.tops;
  if (a.state === 'spin' && b.state === 'spin') {
    const d = len(b.x - a.x, b.y - a.y);
    if (d < a.r + b.r) collideTops(a, b, false);
  }
  stepHazards(dt, battle);
  // round end checks
  if (battle) {
    const down = G.tops.map(t => t.state === 'fall' || t.state === 'out');
    if (down[0] && down[1]) endRound(null, 'DRAW!');
    else if (down[0] || down[1]) {
      const loser = down[0] ? 0 : 1;
      endRound(1 - loser, G.tops[loser].state === 'out' ? 'OUT!' : 'IT FELL!');
    } else if (G.bt > 75) {
      endRound(a.spin >= b.spin ? 0 : 1, 'TIME!');
    }
  }
}
function knockOut(t) {
  t.state = 'out'; t.outT = 0;
  if (G.quiet) return;
  AU.fx.out(); AU.ooh(1); AU.swell(0.12);
  G.shake = Math.max(G.shake, 10); puff(t.x, t.y, 12, 90);
  if (t.hum) { t.hum.stop(); t.hum = null; }
}
function fallOver(t) {
  t.state = 'fall'; t.fallT = 0; t.spin = 0; t.fallA = Math.atan2(t.vy, t.vx) || Math.random() * TAU; t.fallW = rnd(2, 4) * (Math.random() < 0.5 ? -1 : 1);
  puff(t.x, t.y, 10, 60);
  if (G.quiet) return;
  AU.fx.fall(); AU.ooh(0.8);
  if (t.hum) { t.hum.stop(); t.hum = null; }
}

function collideTops(a, b, landing) {
  let nx = b.x - a.x, ny = b.y - a.y; const d = len(nx, ny) || 1; nx /= d; ny /= d;
  const ov = a.r + b.r - d;
  if (ov > 0) { const ta = b.m / (a.m + b.m); a.x -= nx * ov * ta; a.y -= ny * ov * ta; b.x += nx * ov * (1 - ta); b.y += ny * ov * (1 - ta); }
  const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;   // negative = closing
  const fresh = G.pairCd <= 0 || landing;
  const mu = 0.5;
  const closing = Math.max(0, -vn);
  if (!fresh && closing < 30) return;
  const avg = (a.spin + b.spin) / 2;
  const clash = fresh ? 95 * (0.35 + 0.65 * avg) : 0;
  const base = mu * (closing * TUNE.rest + clash * TUNE.clash);
  const critA = a.dashT > 0 || (landing && a.state === 'spin' && a.fl === null && false);
  const ka = (b.dashT > 0 ? 1.55 : 1) * b.spec.pow * (0.6 + 0.4 * b.spin);   // what b does to a
  const kb = (a.dashT > 0 ? 1.55 : 1) * a.spec.pow * (0.6 + 0.4 * a.spin);
  const ma = 0.6 + 0.4 * a.m, mb = 0.6 + 0.4 * b.m;   // softened so heavy tops don't simply bully
  a.vx -= nx * base * ka / ma; a.vy -= ny * base * ka / ma;
  b.vx += nx * base * kb / mb; b.vy += ny * base * kb / mb;
  // the spinning rims grind past each other and swirl sideways
  const tx = -ny, ty = nx, sw = fresh ? 70 : 0;
  a.vx += tx * sw * b.spin; a.vy += ty * sw * b.spin;
  b.vx -= tx * sw * a.spin; b.vy -= ty * sw * a.spin;
  if (!fresh) return;
  G.pairCd = 0.22;
  const impact = closing + 12;
  const wa = a.spin * (0.55 + 0.45 * a.m * a.spec.pow), wb = b.spin * (0.55 + 0.45 * b.m * b.spec.pow), tot = wa + wb + 0.15;
  const K = TUNE.dmg * (landing ? 1.4 : 1);
  const dmgA = K * impact * (wb + 0.05) / tot * (b.dashT > 0 ? 1.6 : 1);
  const dmgB = K * impact * (wa + 0.05) / tot * (a.dashT > 0 ? 1.6 : 1);
  a.spin -= dmgA; b.spin -= dmgB; DG[a.side].hit += dmgA; DG[b.side].hit += dmgB; DG[a.side].n++;
  const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
  const big = impact > 300 || a.dashT > 0 || b.dashT > 0;
  chips(cx, cy, big ? 10 : 4, [a.spec.bands[0], b.spec.bands[0], a.spec.wood]);
  if (a.spec.nail || b.spec.nail) sparks(cx, cy, big ? 8 : 3);
  if (G.quiet) return;
  AU.fx.clack(clamp(impact / 520, 0.15, 1));
  if (big) {
    G.stop = Math.max(G.stop, 0.07); G.shake = Math.max(G.shake, clamp(impact / 40, 6, 16)); shock(cx, cy, 26);
    const words = ['GBAM!', 'KPA!', 'EHN!', 'GBOSA!'];
    pop(words[Math.floor(Math.random() * words.length)], cx, cy - 34, '#f6f1e7', 50);
    AU.swell(0.06); if (impact > 420) AU.ooh(0.7);
  }
}

function dash(side) {
  const t = G.tops[side];
  if (!t || G.phase !== 'battle' || t.state !== 'spin' || t.dashCd > 0) return false;
  let v = G.ctrl[side] === 'human' ? steerVec(side) : t.u;
  let dx = v.x, dy = v.y;
  if (len(dx, dy) < 0.2) { const o = G.tops[1 - side]; dx = o.x - t.x; dy = o.y - t.y; }
  const l = len(dx, dy) || 1; dx /= l; dy /= l;
  const grip = 0.5 + 0.5 * clamp(t.spin / 0.5, 0, 1);
  const sp = TUNE.dashSp * grip;
  t.vx = t.vx * 0.3 + dx * sp; t.vy = t.vy * 0.3 + dy * sp;
  t.dashT = 0.3; t.dashCd = t.spec.dashCd; t.spin -= TUNE.dashCost; DG[side].dash += TUNE.dashCost;
  puff(t.x - dx * t.r, t.y - dy * t.r, 6, 80);
  if (!G.quiet) AU.fx.gbam();
  return true;
}

// ---------------------------------------------------------------- AI
function aiSteer(t, o, ai, dt) {
  t.aiT -= dt;
  if (t.aiT <= 0) {
    t.aiT = ai.react * rnd(0.7, 1.3);
    const lead = 0.15 + 0.2 * ai.skill;
    const ox = o.x + o.vx * lead, oy = o.y + o.vy * lead;
    const ro = len(ox, oy), nox = ro > 1 ? ox / ro : 0, noy = ro > 1 ? oy / ro : 0;
    const rme = len(t.x, t.y);
    let tx, ty;
    const ahead = t.spin > o.spin + 0.18;
    t.mode = (ahead && Math.random() > ai.aggro) ? 'stall' : 'attack';
    if (G.broom && G.broom.state === 'warn' && ai.skill > 0.5) {
      tx = -G.broom.dx * R * 0.45; ty = -G.broom.dy * R * 0.45; t.mode = 'brace';
    } else if (t.mode === 'stall') {
      tx = -nox * R * 0.3; ty = -noy * R * 0.3;
    } else if (rme < ro - 10 || ai.skill < 0.4) {
      tx = ox; ty = oy;                                   // already on the centre side: drive them outward
    } else {
      tx = ox - nox * (t.r + o.r + 40 * ai.skill); ty = oy - noy * (t.r + o.r + 40 * ai.skill);  // get round to the centre side first
    }
    let ux = tx - t.x, uy = ty - t.y; const l = len(ux, uy) || 1; ux /= l; uy /= l;
    if (rme > R * 0.66) { const k = (rme - R * 0.66) / (R * 0.34) * (1.2 + ai.skill); ux -= t.x / rme * k; uy -= t.y / rme * k; }
    const j = ai.jitter; ux += rnd(-j, j); uy += rnd(-j, j);
    const l2 = len(ux, uy) || 1; const mag = t.mode === 'stall' ? 0.75 : 1;
    t.uWant = { x: ux / l2 * mag, y: uy / l2 * mag };
  }
  const k = Math.min(1, dt * 10);
  t.u.x = lerp(t.u.x, t.uWant.x, k); t.u.y = lerp(t.u.y, t.uWant.y, k);
  // dash decision
  if (t.dashCd <= 0 && t.mode === 'attack' && G.bt > 1.2) {
    const dx = o.x - t.x, dy = o.y - t.y, d = len(dx, dy);
    if (d < 210 && d > t.r + o.r + 8 && Math.random() < ai.dash * dt * 1.6) {
      // a careful kid does not dash when it would carry them out of the ring
      const ex = t.x + dx / d * (d + 90), ey = t.y + dy / d * (d + 90);
      if (len(ex, ey) < R * 0.95 || Math.random() > ai.skill) {
        const err = rnd(-1, 1) * 0.4 * (1 - ai.skill);
        const a = Math.atan2(dy + o.vy * 0.12, dx + o.vx * 0.12) + err;
        t.u = { x: Math.cos(a), y: Math.sin(a) };
        dash(t.side);
      }
    }
  }
}

// ---------------------------------------------------------------- hazards
let sandArt = null;
function buildSandArt() {
  sandArt = G.sand.map(s => {
    const c = document.createElement('canvas'), px = Math.ceil(s.r * 2.4); c.width = c.height = px;
    const g = c.getContext('2d'), m = px / 2;
    const gr = g.createRadialGradient(m, m, s.r * 0.2, m, m, s.r * 1.1);
    gr.addColorStop(0, 'rgba(233,196,140,0.95)'); gr.addColorStop(0.7, 'rgba(222,178,118,0.85)'); gr.addColorStop(1, 'rgba(222,178,118,0)');
    g.fillStyle = gr; g.beginPath();
    for (let i = 0; i <= 24; i++) { const a = i / 24 * TAU, rr = s.r * (1 + 0.12 * Math.sin(a * 3 + s.seed) + 0.06 * Math.sin(a * 7 + s.seed * 2)); g.lineTo(m + Math.cos(a) * rr * 1.08, m + Math.sin(a) * rr * 1.08); }
    g.fill();
    for (let i = 0; i < 260; i++) { const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * s.r; g.fillStyle = Math.random() < 0.5 ? 'rgba(160,100,50,0.35)' : 'rgba(255,240,210,0.5)'; g.fillRect(m + Math.cos(a) * d, m + Math.sin(a) * d, 1.6, 1.6); }
    return c;
  });
}
function broomForce(x, y) {
  const b = G.broom; const p = x * b.dx + y * b.dy;
  if (Math.abs(p - b.pos) < 42 && Math.abs(-x * b.dy + y * b.dx) < R + 60) return { x: b.dx, y: b.dy };
  return { x: 0, y: 0 };
}
function stepHazards(dt, battle) {
  // caps
  for (const c of G.caps) {
    const dmp = Math.exp(-2.2 * dt); c.vx *= dmp; c.vy *= dmp; c.x += c.vx * dt; c.y += c.vy * dt; c.rot += len(c.vx, c.vy) * 0.02 * dt;
    if (G.broom && G.broom.state === 'sweep') { const f = broomForce(c.x, c.y); c.vx += f.x * 5000 * dt; c.vy += f.y * 5000 * dt; }
    for (const t of G.tops) {
      if (t.state !== 'spin') continue;
      const dx = c.x - t.x, dy = c.y - t.y, d = len(dx, dy);
      if (d < t.r + c.r && d > 0) {
        const nx = dx / d, ny = dy / d, ov = t.r + c.r - d;
        c.x += nx * ov; c.y += ny * ov;
        const vn = (c.vx - t.vx) * nx + (c.vy - t.vy) * ny;
        if (vn < 40) {
          const j = (-vn + 80 + 120 * t.spin);
          c.vx += nx * j; c.vy += ny * j;
          t.vx -= nx * j * c.m / t.m * 0.6; t.vy -= ny * j * c.m / t.m * 0.6;
          if (!G.quiet && j > 120) AU.fx.cap();
        }
      }
    }
  }
  for (let i = 0; i < G.caps.length; i++) for (let k = i + 1; k < G.caps.length; k++) {
    const a = G.caps[i], b = G.caps[k], dx = b.x - a.x, dy = b.y - a.y, d = len(dx, dy);
    if (d < a.r + b.r && d > 0) {
      const nx = dx / d, ny = dy / d, ov = (a.r + b.r - d) / 2; a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
      const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (vn < 0) { a.vx += nx * vn; a.vy += ny * vn; b.vx -= nx * vn; b.vy -= ny * vn; if (!G.quiet && vn < -80) AU.fx.cap(); }
    }
  }
  if (!battle) return;
  // chicken
  if (G.hazard === 'chicken') {
    if (!G.chicken) {
      G.chickenT -= dt;
      if (G.chickenT <= 0) {
        const a = Math.random() * TAU, sx = Math.cos(a) * (R + 140), sy = Math.sin(a) * (R + 140);
        const b = a + Math.PI + rnd(-0.6, 0.6);
        G.chicken = { x: sx, y: sy, gx: Math.cos(b) * (R + 160), gy: Math.sin(b) * (R + 160), h: 0, st: 'walk', t: 0, peck: rnd(1.5, 3), step: 0, r: 34 };
        if (!G.quiet) AU.fx.cluck();
      }
    } else stepChicken(dt);
  }
  // broom
  if (G.hazard === 'broom') {
    if (!G.broom) {
      G.broomT -= dt;
      if (G.broomT <= 0) {
        const a = Math.random() * TAU;
        G.broom = { state: 'warn', t: 0, dx: Math.cos(a), dy: Math.sin(a), pos: -R - 200 };
        if (!G.quiet) { AU.fx.warn(); banner('MAMA DEY COME!', 'Brace for the broom', 1100); }
      }
    } else {
      const b = G.broom; b.t += dt;
      if (b.state === 'warn' && b.t > 1.5) { b.state = 'sweep'; b.t = 0; if (!G.quiet) AU.fx.broom(1.2); }
      if (b.state === 'sweep') {
        b.pos = lerp(-R - 200, R + 200, b.t / 1.2);
        if (sctx) {   // the broom sweeps the scuff marks away
          sctx.save(); sctx.globalCompositeOperation = 'destination-out'; sctx.translate(600, 600); sctx.scale(2, 2);
          sctx.rotate(Math.atan2(b.dy, b.dx)); sctx.fillStyle = 'rgba(0,0,0,0.5)'; sctx.fillRect(b.pos - 40, -R - 60, 80, 2 * R + 120); sctx.restore();
        }
        if (Math.random() < 0.6) { const off = rnd(-R, R); puff(b.dx * b.pos - b.dy * off, b.dy * b.pos + b.dx * off, 1, 50, '220,175,125'); }
        if (b.t >= 1.2) { G.broom = null; G.broomT = rnd(10, 13); }
      }
    }
  }
}
function stepChicken(dt) {
  const c = G.chicken; c.t += dt;
  let sp = 0;
  if (c.st === 'walk') {
    c.peck -= dt;
    if (c.peck < 0) { c.st = 'peck'; c.t = 0; }
    sp = 48;
    const a = Math.atan2(c.gy - c.y, c.gx - c.x) + Math.sin(c.t * 1.3) * 0.5;
    c.h = a;
  } else if (c.st === 'peck') {
    if (c.t > 0.8) { c.st = 'walk'; c.peck = rnd(1.5, 3); if (!G.quiet && Math.random() < 0.5) AU.fx.cluck(); }
  } else if (c.st === 'flee') sp = 300;
  c.x += Math.cos(c.h) * sp * dt; c.y += Math.sin(c.h) * sp * dt; c.step += sp * dt * 0.08;
  if (len(c.x, c.y) > R + 240 && (c.st === 'flee' || len(c.x - c.gx, c.y - c.gy) < 60)) { G.chicken = null; G.chickenT = rnd(5, 9); return; }
  if (c.st !== 'flee' && len(c.x - c.gx, c.y - c.gy) < 30) { G.chicken = null; G.chickenT = rnd(4, 8); return; }
  for (const t of G.tops) {
    if (t.state !== 'spin') continue;
    const dx = t.x - c.x, dy = t.y - c.y, d = len(dx, dy);
    if (d < t.r + c.r && d > 0) {
      const nx = dx / d, ny = dy / d; t.x = c.x + nx * (t.r + c.r); t.y = c.y + ny * (t.r + c.r);
      const vn = t.vx * nx + t.vy * ny;
      if (vn < 0) { t.vx -= nx * vn * 1.7; t.vy -= ny * vn * 1.7; }
      t.vx += nx * 60; t.vy += ny * 60;
      if (c.st !== 'flee' && -vn > 90) {
        c.st = 'flee'; c.h = Math.atan2(-dy, -dx); feathers(c.x, c.y, 9); t.spin -= 0.02;
        if (!G.quiet) { AU.fx.squawk(); AU.ooh(0.6); pop('KPAKPA!', c.x, c.y - 30, '#f6f1e7', 36); }
      }
    }
  }
}

// ---------------------------------------------------------------- input
let isTouch = matchMedia('(pointer: coarse)').matches;
const keys = {};
const sticks = [null, null];
function steerVec(side) {
  const st = sticks[side];
  if (st) {
    let x = (st.x - st.ox) / 56, y = (st.y - st.oy) / 56; const l = len(x, y);
    if (l < 0.12) return { x: 0, y: 0 };
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }
  return keyVec(side);
}
function keyVec(side) {
  let x = 0, y = 0;
  const duo = G.mode === 'duo';
  if (side === 0) {
    if (keys.KeyA || (!duo && keys.ArrowLeft)) x -= 1; if (keys.KeyD || (!duo && keys.ArrowRight)) x += 1;
    if (keys.KeyW || (!duo && keys.ArrowUp)) y -= 1; if (keys.KeyS || (!duo && keys.ArrowDown)) y += 1;
  } else {
    if (keys.ArrowLeft) x -= 1; if (keys.ArrowRight) x += 1; if (keys.ArrowUp) y -= 1; if (keys.ArrowDown) y += 1;
  }
  const l = len(x, y); return l > 0 ? { x: x / l, y: y / l } : { x: 0, y: 0 };
}
function sideFor(y) { return G.mode === 'duo' ? (y > CY ? 0 : 1) : 0; }
function inMatch() { return (G.mode === 'ladder' || G.mode === 'duo') && !G.paused; }

cv.addEventListener('pointerdown', e => {
  AU.unlock(); if (e.pointerType === 'touch') isTouch = true; else if (e.pointerType === 'mouse') isTouch = false;
  if (!inMatch()) return;
  const side = sideFor(e.clientY);
  if (G.ctrl[side] !== 'human') return;
  const thr = G.thr;
  if (G.phase === 'throw' && thr && thr.side === side && thr.human && !thr.done && !thr.holding) {
    thr.holding = true; thr.holdT = 0; thr.ph = 0; thr.ptr = e.pointerId; thr.sx = thr.x = e.clientX; thr.sy = thr.y = e.clientY; thr.pull = 0;
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
    if (!G.quiet) AU.fx.zip(0.7);
    return;
  }
  if (!sticks[side]) { sticks[side] = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY }; try { cv.setPointerCapture(e.pointerId); } catch (_) {} }
});
cv.addEventListener('pointermove', e => {
  const thr = G.thr;
  if (thr && thr.holding && thr.ptr === e.pointerId) { thr.x = e.clientX; thr.y = e.clientY; aimFromPointer(thr); }
  for (const st of sticks) if (st && st.id === e.pointerId) {
    st.x = e.clientX; st.y = e.clientY;
    const dx = st.x - st.ox, dy = st.y - st.oy, l = len(dx, dy);
    if (l > 80) { st.ox += dx / l * (l - 80); st.oy += dy / l * (l - 80); }   // stick origin follows a long drag
  }
});
function pointerEnd(e) {
  const thr = G.thr;
  if (thr && thr.holding && thr.ptr === e.pointerId) { thr.x = e.clientX; thr.y = e.clientY; aimFromPointer(thr); release(thr); thr.holding = false; thr.ptr = null; }
  for (let i = 0; i < 2; i++) if (sticks[i] && sticks[i].id === e.pointerId) sticks[i] = null;
}
cv.addEventListener('pointerup', pointerEnd);
cv.addEventListener('pointercancel', pointerEnd);
cv.addEventListener('contextmenu', e => { e.preventDefault(); if (inMatch()) dash(0); });

addEventListener('keydown', e => {
  if (e.repeat) { if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault(); return; }
  keys[e.code] = true; AU.unlock(); isTouch = false;
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  if (e.code === 'Escape' && inMatch()) { pauseGame(); return; }
  if (!inMatch()) return;
  const duo = G.mode === 'duo';
  const side = e.code === 'Space' ? 0 : (duo && (e.code === 'Enter' || e.code === 'NumpadEnter')) ? 1 : -1;
  if (side < 0) return;
  const thr = G.thr;
  if (G.phase === 'throw' && thr && thr.side === side && thr.human && !thr.done && !thr.holding) {
    thr.holding = true; thr.kb = true; thr.holdT = 0; thr.ph = 0; thr.pull = 73; thr.aim = side === 0 ? -Math.PI / 2 : Math.PI / 2;
    if (!G.quiet) AU.fx.zip(0.7);
  } else if (G.phase === 'battle') dash(side);
});
addEventListener('keyup', e => {
  keys[e.code] = false;
  const thr = G.thr;
  if (thr && thr.kb && thr.holding && ((e.code === 'Space' && thr.side === 0) || ((e.code === 'Enter' || e.code === 'NumpadEnter') && thr.side === 1))) { release(thr); thr.holding = false; thr.kb = false; }
});
for (const id of ['dash0', 'dash1']) {
  const el = document.getElementById(id), side = id === 'dash0' ? 0 : 1;
  el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); AU.unlock(); el.classList.add('pr'); dash(side); });
  const up = () => el.classList.remove('pr');
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
}

// ---------------------------------------------------------------- render
function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const sh = G.shake;
  const ox = sh ? rnd(-sh, sh) : 0, oy = sh ? rnd(-sh, sh) : 0;
  const w2s = (x, y) => [CX + ox + x * S, CY + oy + y * S];
  // dirt everywhere
  ctx.setTransform(DPR * S * PK * 2.0, 0, 0, DPR * S * PK * 2.0, DPR * (CX + ox), DPR * (CY + oy));
  if (dirtPattern) { ctx.fillStyle = dirtPattern; ctx.fillRect(-4000, -4000, 8000, 8000); } else { ctx.fillStyle = '#a5502c'; ctx.fillRect(-4000, -4000, 8000, 8000); }
  // world transform
  ctx.setTransform(DPR * S, 0, 0, DPR * S, DPR * (CX + ox), DPR * (CY + oy));
  if (plateFeather) { const sz = PLATE.size * PK; ctx.drawImage(plateFeather, -PLATE.cx * PK, -PLATE.cy * PK, sz, sz); }
  // sand
  if (sandArt) G.sand.forEach((s, i) => { const c = sandArt[i]; if (c) ctx.drawImage(c, s.x - c.width / 2, s.y - c.height / 2); });
  if (scuff) ctx.drawImage(scuff, -300, -300, 600, 600);
  // caps
  for (const c of G.caps) drawCap(c);
  // chicken shadow + chicken
  if (G.chicken) drawChicken(G.chicken);
  // tops: shadows first
  const order = G.tops.slice().sort((a, b) => a.y - b.y);
  for (const t of order) drawShadow(t);
  for (const t of order) drawTopEntity(t);
  // broom
  if (G.broom) drawBroom(G.broom);
  // particles
  drawParts();
  // throw UI
  if (G.thr && !G.thr.done) drawThrowUI(G.thr);
  drawPops();
  // vignette
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const vg = ctx.createRadialGradient(W / 2, CY, Math.min(W, H) * 0.35, W / 2, CY, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(30,8,0,0.45)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  // sticks
  for (let i = 0; i < 2; i++) { const st = sticks[i]; if (st && G.phase === 'battle') drawStick(st); }
  // broom warning arrow
  if (G.broom && G.broom.state === 'warn') {
    const b = G.broom, [sx, sy] = w2s(-b.dx * (R + 40), -b.dy * (R + 40));
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(Math.atan2(b.dy, b.dx));
    const k = 1 + 0.15 * Math.sin(b.t * 18);
    ctx.scale(k, k); ctx.fillStyle = '#f4b63d'; ctx.strokeStyle = '#3a1d0e'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(26, 0); ctx.lineTo(-14, -22); ctx.lineTo(-14, 22); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}
function drawShadow(t) {
  if (t.state === 'hand' || t.state === 'gone') return;
  let h = 0; if (t.state === 'air') h = Math.sin(Math.PI * clamp(t.fl.t / t.fl.dur, 0, 1));
  const r = t.r * (1 - h * 0.25);
  ctx.save(); ctx.globalAlpha = (t.state === 'out' ? clamp(1 - t.outT * 1.2, 0, 1) : 1) * (0.42 - h * 0.2);
  const gx = t.x + t.r * 0.3 + h * 40, gy = t.y + t.r * 0.42 + h * 60;
  const gr = ctx.createRadialGradient(gx, gy, r * 0.3, gx, gy, r * 1.15);
  gr.addColorStop(0, 'rgba(40,10,0,1)'); gr.addColorStop(1, 'rgba(40,10,0,0)');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(gx, gy, r * 1.15, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawTopEntity(t) {
  if (t.state === 'hand') return;  // drawn by the throw UI
  ctx.save();
  if (t.state === 'air') {
    const k = clamp(t.fl.t / t.fl.dur, 0, 1), h = Math.sin(Math.PI * k);
    ctx.translate(t.x, t.y - h * 50); ctx.scale(1 + h * 0.45, 1 + h * 0.45);
    drawTop(ctx, t.spec, t.r, t.ang, t.spin, 0, 0);
  } else if (t.state === 'fall') {
    ctx.translate(t.x, t.y);
    if (t.fallT < 1) { ctx.save(); ctx.globalAlpha = 1 - t.fallT; drawTop(ctx, t.spec, t.r, t.ang, 0, 1, t.phi); ctx.restore(); }
    ctx.globalAlpha = t.fallT; drawLyingTop(ctx, t.spec, t.r, t.fallA);
  } else {
    if (t.state === 'out') ctx.globalAlpha = clamp(1.6 - t.outT, 0, 1);
    ctx.translate(t.x, t.y);
    if (t.dashT > 0) { ctx.save(); ctx.globalAlpha *= 0.3; ctx.translate(-t.vx * 0.03, -t.vy * 0.03); drawTop(ctx, t.spec, t.r, t.ang, t.spin, 0, 0); ctx.restore(); }
    drawTop(ctx, t.spec, t.r, t.ang, Math.max(0, t.spin), t.wob, t.phi);
  }
  ctx.restore();
}
function drawThrowUI(thr) {
  const t = thr.t, gq = throwGeom(thr);
  const pulled = thr.holding || !thr.human;
  const pull = pulled ? gq.pull * 0.3 / S : 0;
  const tx = gq.hx - gq.dx * pull, ty = gq.hy - gq.dy * pull;
  const sideSign = thr.side === 0 ? 1 : -1;
  // string to the hand off-screen
  ctx.save();
  ctx.strokeStyle = '#efe2c4'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + 30, ty + 60 * sideSign, 10, (HAND_Y + 140) * sideSign); ctx.stroke();
  // aim line + reticle
  if (pulled && gq.pull >= 12) {
    const inRing = len(gq.tx, gq.ty) < R - t.r * 0.2;
    ctx.setLineDash([3, 13]); ctx.lineWidth = 5; ctx.strokeStyle = inRing ? 'rgba(246,241,231,0.85)' : 'rgba(224,83,59,0.9)';
    ctx.beginPath(); ctx.moveTo(gq.hx + gq.dx * 50, gq.hy + gq.dy * 50); ctx.lineTo(gq.tx, gq.ty); ctx.stroke(); ctx.setLineDash([]);
    ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(gq.tx, gq.ty, t.r, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(gq.tx - 10, gq.ty); ctx.lineTo(gq.tx + 10, gq.ty); ctx.moveTo(gq.tx, gq.ty - 10); ctx.lineTo(gq.tx, gq.ty + 10); ctx.stroke();
    if (!inRing && thr.human) { ctx.font = '26px "Lilita One"'; ctx.textAlign = 'center'; ctx.fillStyle = '#e0533b'; ctx.fillText('OUT', gq.tx, gq.ty - t.r - 10); }
  }
  // the top itself, wrapped in string
  ctx.translate(tx, ty);
  ctx.fillStyle = 'rgba(40,10,0,0.35)'; ctx.beginPath(); ctx.arc(t.r * 0.25, t.r * 0.35, t.r, 0, TAU); ctx.fill();
  drawTop(ctx, t.spec, t.r, t.ang, 0, 0, 0);
  ctx.strokeStyle = 'rgba(239,226,196,0.95)'; ctx.lineWidth = 2.2;
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(0, 0, t.r * (0.45 + i * 0.13), 0.3 + i, 2.4 + i); ctx.stroke(); }
  // wind rings
  if (pulled) {
    const tgtR = t.r * lerp(3.4, 0.9, WIND_TGT), curR = t.r * lerp(3.4, 0.9, thr.ph);
    const near = Math.abs(thr.ph - WIND_TGT) < 0.055;
    ctx.lineWidth = near ? 9 : 6; ctx.strokeStyle = near ? '#ffe08a' : '#f4b63d';
    ctx.globalAlpha = 0.95; ctx.beginPath(); ctx.arc(0, 0, tgtR, 0, TAU); ctx.stroke();
    ctx.lineWidth = 4; ctx.strokeStyle = '#f6f1e7'; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.arc(0, 0, curR, 0, TAU); ctx.stroke();
  } else if (thr.human) {
    const k = 0.5 + 0.5 * Math.sin(performance.now() / 260);
    ctx.lineWidth = 4; ctx.strokeStyle = `rgba(246,241,231,${0.35 + 0.5 * k})`;
    ctx.beginPath(); ctx.arc(0, 0, t.r * (1.5 + 0.3 * k), 0, TAU); ctx.stroke();
  }
  ctx.restore();
}
function drawCap(c) {
  ctx.save(); ctx.translate(c.x, c.y);
  ctx.fillStyle = 'rgba(40,10,0,0.35)'; ctx.beginPath(); ctx.arc(3, 4, c.r + 1, 0, TAU); ctx.fill();
  ctx.rotate(c.rot);
  ctx.fillStyle = '#c9ccd0'; ctx.beginPath();
  for (let i = 0; i < 21; i++) { const a = i / 21 * TAU, rr = i % 2 ? c.r : c.r + 1.8; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(40,14,4,0.7)'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = c.col; ctx.beginPath(); ctx.arc(0, 0, c.r * 0.72, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(-c.r * 0.25, -c.r * 0.25, c.r * 0.25, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawChicken(c) {
  ctx.save(); ctx.translate(c.x, c.y); ctx.scale(1.75, 1.75);
  ctx.fillStyle = 'rgba(40,10,0,0.3)'; ctx.beginPath(); ctx.ellipse(6, 9, 24, 18, c.h, 0, TAU); ctx.fill();
  ctx.rotate(c.h);
  const bob = c.st === 'peck' ? Math.abs(Math.sin(c.t * 14)) * 8 : 0;
  // legs
  const s = Math.sin(c.step * 6) * 6;
  ctx.strokeStyle = '#e8a33a'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(s, -10); ctx.moveTo(0, 6); ctx.lineTo(-s, 10); ctx.stroke();
  // tail
  ctx.fillStyle = '#7a4a24'; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-30, -9); ctx.lineTo(-27, 0); ctx.lineTo(-30, 9); ctx.closePath(); ctx.fill();
  // body
  const bg = ctx.createRadialGradient(-2, -5, 2, 0, 0, 22); bg.addColorStop(0, '#fffaf0'); bg.addColorStop(1, '#d9cdb8');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(-2, 0, 20, 15, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(60,30,10,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
  // wings
  const fl = c.st === 'flee' ? Math.sin(c.t * 40) * 8 : 0;
  ctx.fillStyle = '#e9dfcc';
  ctx.beginPath(); ctx.ellipse(-4, -12 - fl, 12, 5, -0.2, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(-4, 12 + fl, 12, 5, 0.2, 0, TAU); ctx.fill(); ctx.stroke();
  // head
  ctx.translate(18 + bob, 0);
  ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#d6332a'; ctx.beginPath(); ctx.ellipse(-2, 0, 5, 2.5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f0b43a'; ctx.beginPath(); ctx.moveTo(7, -2.5); ctx.lineTo(13, 0); ctx.lineTo(7, 2.5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(3, -4, 1.4, 0, TAU); ctx.arc(3, 4, 1.4, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawBroom(b) {
  ctx.save(); ctx.rotate(Math.atan2(b.dy, b.dx));
  if (b.state === 'warn') {
    ctx.globalAlpha = 0.25 + 0.2 * Math.sin(b.t * 16);
    ctx.fillStyle = '#3a1d0e'; ctx.fillRect(-R - 60, -R - 40, 60, 2 * R + 80);
  } else {
    // a long bundle of palm-rib sticks (igbale), bristle tips dragging in the sweep direction
    ctx.translate(b.pos, 0);
    const L = R + 90;
    ctx.fillStyle = 'rgba(40,10,0,0.28)'; ctx.fillRect(-20, -L + 14, 64, 2 * L);
    for (let i = 0; i < 120; i++) {
      const y = -L + (i + 0.5) * (2 * L) / 120, sw = Math.sin(i * 2.3) * 7, tip = 40 + Math.sin(i * 0.9) * 10;
      ctx.strokeStyle = i % 4 === 0 ? '#9c7334' : i % 3 ? '#e2c27e' : '#c9a35c'; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(-34, y * 0.96); ctx.quadraticCurveTo(0, y + sw * 0.5, tip, y + sw); ctx.stroke();
    }
    // binding near the back of the bundle
    ctx.fillStyle = '#c8312b'; ctx.strokeStyle = '#3a1d0e'; ctx.lineWidth = 2;
    for (let k = 0; k < 3; k++) { ctx.fillRect(-44 + k * 9, -L * 0.98, 6, 2 * L * 0.98); }
  }
  ctx.restore();
}
function drawParts() {
  for (const p of G.parts) {
    const k = p.life / p.max;
    ctx.save();
    if (p.t === 'dust') { ctx.globalAlpha = 0.5 * (1 - k); ctx.fillStyle = `rgb(${p.col})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + k * 1.5), 0, TAU); ctx.fill(); }
    else if (p.t === 'chip') { ctx.globalAlpha = 1 - k; ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.col; ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r); }
    else if (p.t === 'spark') { ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke(); }
    else if (p.t === 'feather') { ctx.globalAlpha = 1 - k * k; ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.ellipse(0, 0, 8, 3, 0, 0, TAU); ctx.fill(); }
    else if (p.t === 'ring') { ctx.globalAlpha = 0.7 * (1 - k); ctx.strokeStyle = '#f6f1e7'; ctx.lineWidth = 4 * (1 - k) + 1; ctx.beginPath(); ctx.arc(p.x, p.y, p.r + k * 50, 0, TAU); ctx.stroke(); }
    ctx.restore();
  }
}
function drawPops() {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const p of G.pops) {
    const a = p.life / p.max, inK = clamp(p.life / 0.16, 0, 1);
    const sc = inK < 1 ? 0.4 + 0.8 * easeOutBack(inK) : 1;
    ctx.save(); ctx.translate(p.x, p.y - a * 28); ctx.scale(sc, sc); ctx.rotate(-0.08);
    ctx.globalAlpha = a > 0.7 ? (1 - a) / 0.3 : 1;
    ctx.font = `${p.size}px "Lilita One", sans-serif`;
    ctx.lineJoin = 'round'; ctx.lineWidth = p.size * 0.16; ctx.strokeStyle = '#3a1d0e'; ctx.strokeText(p.txt, 0, 4);
    ctx.strokeText(p.txt, 0, 0); ctx.fillStyle = p.col; ctx.fillText(p.txt, 0, 0);
    ctx.restore();
  }
}
function easeOutBack(x) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }
function drawStick(st) {
  ctx.save();
  ctx.globalAlpha = 0.5; ctx.fillStyle = 'rgba(58,29,14,0.35)'; ctx.strokeStyle = '#f6f1e7'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(st.ox, st.oy, 56, 0, TAU); ctx.fill(); ctx.stroke();
  let dx = st.x - st.ox, dy = st.y - st.oy; const l = len(dx, dy); if (l > 56) { dx *= 56 / l; dy *= 56 / l; }
  ctx.globalAlpha = 0.85; ctx.fillStyle = '#f6f1e7'; ctx.beginPath(); ctx.arc(st.ox + dx, st.oy + dy, 24, 0, TAU); ctx.fill();
  ctx.restore();
}
function stepParts(dt) {
  for (const p of G.parts) {
    p.life += dt; p.x += p.vx ? p.vx * dt : 0; p.y += p.vy ? p.vy * dt : 0;
    if (p.vx) { const d = Math.exp(-(p.t === 'feather' ? 2 : 4) * dt); p.vx *= d; p.vy *= d; }
    if (p.rot !== undefined) p.rot += (p.vr || 0) * dt;
  }
  G.parts = G.parts.filter(p => p.life < p.max);
  for (const p of G.pops) p.life += dt;
  G.pops = G.pops.filter(p => p.life < p.max);
}

// ---------------------------------------------------------------- HUD + DOM
const $ = id => document.getElementById(id);
const show = id => $(id).classList.add('on');
const hide = id => $(id).classList.remove('on');
const SCREENS = ['s-title', 's-ladder', 's-pick', 's-vs', 's-result', 's-how', 's-pause', 's-duo'];
function screen(id) { for (const s of SCREENS) $(s).classList.toggle('on', s === id); $('soundBtn').style.display = (id === 's-title' || id === 's-pause') ? 'flex' : 'none'; }
let bannerTimer = 0;
function banner(t, s, ms) {
  const b = $('banner'); b.querySelector('.t').textContent = t; b.querySelector('.s').textContent = s || '';
  b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => b.classList.remove('on'), ms);
}
function hint(txt, top) { const h = $('hint'); h.textContent = txt; h.classList.toggle('top', !!top); h.classList.add('on'); }
function hideHint() { hide('hint'); }
const P2_BADGE = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#2b3a67"/><text x="50" y="66" font-family="Arial Black,Arial" font-weight="900" font-size="44" fill="#f6f1e7" text-anchor="middle">P2</text></svg>');
function portrait(side) {
  if (G.mode === 'ladder') return side === 0 ? 'assets/kids/you.webp' : `assets/kids/${G.kid.id}.webp`;
  return null;
}
function updateHud() {
  const inm = G.mode === 'ladder' || G.mode === 'duo';
  $('hud').classList.toggle('on', inm);
  if (!inm) return;
  for (const side of [0, 1]) {
    const hp = $('hp' + side), src = portrait(side);
    const img = hp.querySelector('img');
    img.src = src || (side === 0 ? 'assets/kids/you.webp' : P2_BADGE);
    const nm = G.mode === 'duo' ? (side === 0 ? 'PLAYER 1' : 'PLAYER 2') : (side === 0 ? 'YOU' : G.kid.name.toUpperCase());
    hp.querySelector('.nm').textContent = nm;
  }
  $('hud').querySelector('.rd').textContent = 'ROUND ' + Math.min(3, G.score[0] + G.score[1] + 1);
  const dots = $('dots').children;
  const seq = []; for (let i = 0; i < G.score[0]; i++) seq.push('p'); for (let i = 0; i < G.score[1]; i++) seq.push('o');
  for (let i = 0; i < 3; i++) dots[i].className = seq[i] || '';
}
function frameHud() {
  if (!(G.mode === 'ladder' || G.mode === 'duo')) return;
  for (const side of [0, 1]) {
    const t = G.tops[side]; if (!t) continue;
    const v = clamp(t.state === 'hand' || t.state === 'air' ? (t.state === 'air' ? t.spin : 0) : t.spin, 0, 1);
    const bar = $('hp' + side).querySelector('i');
    bar.style.transform = `scaleX(${v})`;
    bar.className = v < 0.25 ? 'low' : v < 0.5 ? 'mid' : '';
  }
  const d0 = $('dash0'), t0 = G.tops[0]; if (t0) d0.classList.toggle('cd', t0.dashCd > 0);
  const d1 = $('dash1'), t1 = G.tops[1]; if (t1) d1.classList.toggle('cd', t1.dashCd > 0);
}

// sound button
function paintSound() {
  $('soundBtn').innerHTML = AU.muted
    ? '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#3a1d0e"/><path d="M16 9l5 6M21 9l-5 6" stroke="#3a1d0e" stroke-width="2.4" stroke-linecap="round"/></svg>'
    : '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#3a1d0e"/><path d="M16 8.5c1.6 1.8 1.6 5.2 0 7M18.6 6c3 3.2 3 8.8 0 12" stroke="#3a1d0e" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>';
}
$('soundBtn').addEventListener('click', () => { AU.unlock(); AU.setMuted(!AU.muted); paintSound(); AU.music(true); });

// title
function goTitle() {
  stopHums(); G.paused = false;
  hide('dash0'); hide('dash1'); $('hud').classList.remove('on');
  screen('s-title'); startMatch('attract'); AU.crowdBase(0);
}
$('bStreet').addEventListener('click', () => { AU.unlock(); AU.music(true); AU.fx.click(); goLadder(); });
$('bDuo').addEventListener('click', () => { AU.unlock(); AU.music(true); AU.fx.click(); goDuo(); });
$('bHow').addEventListener('click', () => { AU.unlock(); AU.fx.click(); screen('s-how'); });
$('bHowOk').addEventListener('click', () => { AU.fx.click(); screen(howReturn); howReturn = 's-title'; });
let howReturn = 's-title';

// ladder
function nextKid() { return KIDS.find(k => !save.beaten[k.id]) || null; }
function fmt(ms) { const s = Math.round(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function goLadder() {
  const list = $('kidList'); list.innerHTML = '';
  const nk = nextKid();
  KIDS.forEach((k, i) => {
    const beaten = !!save.beaten[k.id], isNext = nk && nk.id === k.id, locked = !beaten && !isNext;
    const el = document.createElement('div'); el.className = 'kid' + (beaten ? ' beaten' : '') + (isNext ? ' next' : '') + (locked ? ' locked' : '');
    el.innerHTML = `<img class="face" src="assets/kids/${k.id}.webp" alt=""><div class="who"><b>${locked ? '???' : k.name}</b><span>${locked ? 'Beat ' + KIDS[i - 1].name + ' first' : TOPS[k.top].name + ' · “' + k.quote + '”'}</span>${k.hz && !locked ? `<span class="hz">${k.hz}</span>` : ''}</div>`;
    const ic = iconCanvas(k.top, 92); ic.className = 'topic'; el.appendChild(ic);
    const chip = document.createElement('span'); chip.className = 'chip'; chip.textContent = beaten ? 'KOSO WON' : isNext ? 'NEXT' : (i + 1) + ' / 5'; el.appendChild(chip);
    if (isNext || beaten) {
      const b = document.createElement('button'); b.className = 'btn small' + (beaten ? ' white' : ''); b.textContent = beaten ? 'REMATCH' : 'THROW DOWN';
      b.style.minWidth = '0'; b.addEventListener('click', () => { AU.fx.click(); pickFor(k.id); });
      el.querySelector('.who').appendChild(document.createElement('div')).appendChild(b);
      b.parentElement.style.marginTop = '6px';
    }
    list.appendChild(el);
  });
  const mt = $('myTops'); mt.innerHTML = '<small>YOUR TOPS</small>';
  for (const id of TOP_ORDER) if (save.tops.includes(id)) mt.appendChild(iconCanvas(id, 60));
  $('runClock').textContent = (save.best ? 'BEST ' + fmt(save.best) + ' · ' : '') + 'RUN ' + fmt(save.runMs);
  screen('s-ladder');
}
$('bLadBack').addEventListener('click', () => { AU.fx.click(); screen('s-title'); });

// top picker
let pickKid = null, pickSel = null;
function statBars(id) {
  const t = TOPS[id];
  const spin = clamp((0.026 - t.decay) / 0.01, 0.1, 1), speed = clamp((t.acc - 420) / 320, 0.1, 1), weight = clamp((t.m - 0.7) / 0.85, 0.1, 1);
  return `<div class="stat">SPIN<i style="--v:${spin * 100}%"></i></div><div class="stat">SPEED<i style="--v:${speed * 100}%"></i></div><div class="stat">WEIGHT<i style="--v:${weight * 100}%"></i></div>`;
}
function pickFor(kidId) {
  pickKid = kidId;
  if (save.tops.length < 2) { startLadderMatch(kidId, 'omo'); return; }
  pickSel = save.tops.includes(save.sel) ? save.sel : 'omo';
  const box = $('picks'); box.innerHTML = '';
  for (const id of TOP_ORDER) if (save.tops.includes(id)) {
    const b = document.createElement('button'); b.className = 'pick' + (id === pickSel ? ' sel' : '');
    b.appendChild(iconCanvas(id, 152));
    b.insertAdjacentHTML('beforeend', `<b>${TOPS[id].name}</b>${statBars(id)}`);
    b.addEventListener('click', () => { AU.fx.click(); pickSel = id; [...box.children].forEach(c => c.classList.remove('sel')); b.classList.add('sel'); });
    box.appendChild(b);
  }
  $('pickLede').textContent = 'Against ' + KID_BY[kidId].name + '. Every top you win is yours to throw.';
  screen('s-pick');
}
$('bPickBack').addEventListener('click', () => { AU.fx.click(); goLadder(); });
$('bPickGo').addEventListener('click', () => { AU.fx.click(); save.sel = pickSel; persist(); startLadderMatch(pickKid, pickSel); });

function startLadderMatch(kidId, topId) {
  const k = KID_BY[kidId];
  versus({ n0: 'YOU', t0: TOPS[topId].name, i0: 'assets/kids/you.webp', n1: k.name, t1: TOPS[k.top].name, i1: `assets/kids/${k.id}.webp`, q1: '“' + k.quote + '”' },
    () => startMatch('ladder', { kid: kidId, top: topId }));
}
let vsDone = null, vsTimer = 0;
function versus(o, done) {
  $('vsN0').textContent = o.n0; $('vsT0').textContent = o.t0; $('vsI0').src = o.i0;
  $('vsN1').textContent = o.n1; $('vsT1').textContent = o.t1; $('vsI1').src = o.i1; $('vsQ1').textContent = o.q1 || '';
  $('vsI1').style.filter = o.f1 || ''; $('vsI0').style.filter = o.f0 || '';
  screen('s-vs'); AU.fx.whoosh(); setTimeout(() => AU.fx.gbam(), 320);
  vsDone = done; clearTimeout(vsTimer); vsTimer = setTimeout(finishVs, 2400);
}
function finishVs() { if (!vsDone) return; const d = vsDone; vsDone = null; clearTimeout(vsTimer); screen(null); AU.crowdBase(0.025); d(); }
$('s-vs').addEventListener('pointerdown', () => finishVs());

// duo
let duoSel = save.duo.slice();
function goDuo() {
  for (const side of [0, 1]) {
    const box = $(side === 0 ? 'picks1' : 'picks2'); box.innerHTML = '';
    for (const id of TOP_ORDER) {
      const b = document.createElement('button'); b.className = 'pick' + (id === duoSel[side] ? ' sel' : '');
      b.style.padding = '8px'; const ic = iconCanvas(id, 120); ic.style.width = ic.style.height = '56px'; b.appendChild(ic);
      b.insertAdjacentHTML('beforeend', `<b style="font-size:15px">${TOPS[id].name}</b>`);
      b.addEventListener('click', () => { AU.fx.click(); duoSel[side] = id; [...box.children].forEach(c => c.classList.remove('sel')); b.classList.add('sel'); });
      box.appendChild(b);
    }
    box.style.gridTemplateColumns = 'repeat(auto-fill,minmax(96px,1fr))';
  }
  screen('s-duo');
}
$('bDuoBack').addEventListener('click', () => { AU.fx.click(); screen('s-title'); });
$('bDuoGo').addEventListener('click', () => {
  AU.fx.click(); save.duo = duoSel.slice(); persist();
  versus({ n0: 'PLAYER 1', t0: TOPS[duoSel[0]].name, i0: 'assets/kids/you.webp', n1: 'PLAYER 2', t1: TOPS[duoSel[1]].name, i1: P2_BADGE, q1: 'Player 2 sits at the top' },
    () => startMatch('duo'));
});

// match end
function endMatch(winner) {
  stopHums(); hide('dash0'); hide('dash1');
  const body = $('resBody'); body.innerHTML = '';
  const ms = G.matchT * 1000;
  if (G.mode === 'duo') {
    body.innerHTML = `<div class="big">PLAYER ${winner + 1} WINS!</div><canvas class="won-top" width="220" height="220"></canvas><div class="msg">${TOPS[G.specs[winner]].name} takes the koso.</div>
      <div class="row"><button class="btn" id="rA">REMATCH</button><button class="btn white" id="rB">MENU</button></div>`;
    spinIcon(body.querySelector('canvas'), G.specs[winner]);
    AU.fx.win();
    $('rA').onclick = () => { AU.fx.click(); screen(null); startMatch('duo'); };
    $('rB').onclick = () => { AU.fx.click(); goTitle(); };
    $('hud').classList.remove('on'); screen('s-result'); return;
  }
  const k = G.kid;
  save.runMs += ms;
  if (winner === 0) {
    const first = !save.beaten[k.id];
    save.beaten[k.id] = true;
    const newTop = !save.tops.includes(k.top);
    if (newTop) save.tops.push(k.top);
    const champ = KIDS.every(kk => save.beaten[kk.id]) && first;
    if (champ) {
      save.champs++; const t = save.runMs; if (!save.best || t < save.best) save.best = t; persist();
      $('hud').classList.remove('on'); champion(t); return;
    }
    persist();
    body.innerHTML = `<img class="face" src="assets/kids/${k.id}.webp" alt=""><div class="big">${newTop ? 'KOSO WON!' : 'YOU WIN!'}</div><canvas class="won-top" width="220" height="220"></canvas>
      <div class="msg">${newTop ? `You won ${k.name}'s koso! ${TOPS[k.top].name} is yours to throw.` : `${k.name} goes home with nothing today.`}</div>
      <div class="row"><button class="btn" id="rA">CONTINUE</button></div>`;
    spinIcon(body.querySelector('canvas'), k.top);
    AU.fx.win(); AU.ooh(1, 0.2);
    $('rA').onclick = () => { AU.fx.click(); $('hud').classList.remove('on'); goLadder(); startMatch('attract'); };
  } else {
    persist();
    body.innerHTML = `<img class="face" src="assets/kids/${k.id}.webp" alt=""><div class="big">${k.name.toUpperCase()} WINS</div>
      <div class="msg">${k.name} keeps the koso. ${loseTip(k)}</div>
      <div class="row"><button class="btn" id="rA">AGAIN</button><button class="btn white" id="rB">LADDER</button></div>`;
    AU.fx.lose();
    $('rA').onclick = () => { AU.fx.click(); screen(null); startMatch('ladder', { kid: k.id, top: G.specs[0] }); };
    $('rB').onclick = () => { AU.fx.click(); $('hud').classList.remove('on'); goLadder(); startMatch('attract'); };
  }
  $('hud').classList.remove('on');
  screen('s-result');
}
function loseTip(k) {
  const tips = {
    tunde: 'Tip: let go right when the white ring meets the gold one.',
    kemi: 'Tip: Dart is quick but light. Stay off the sand and GBAM when she comes close.',
    sola: 'Tip: Iroko is heavy. Do not trade hits from the edge; make him chase you.',
    ify: 'Tip: Ify dashes a lot. Sidestep, then GBAM while her dash is cooling.',
    oga: 'Tip: When Mama comes, move toward the side the broom starts from.',
  };
  return tips[k.id] || '';
}
let spinIcons = [];
function spinIcon(c, id) { spinIcons.push({ c, id, a: 0 }); }

// champion + share card
function champion(ms) {
  const body = $('resBody');
  body.innerHTML = `<div class="big">STREET CHAMPION</div><div class="timebig">${fmt(ms)}</div>
    <div class="msg">You took every koso in the compound.${save.best === ms ? ' New best time!' : ' Best: ' + fmt(save.best)}</div>
    <div class="tops-row" id="champTops"></div>
    <div class="row"><button class="btn" id="rA">POST MY TIME</button><button class="btn white" id="rB">PLAY AGAIN</button></div>`;
  for (const id of TOP_ORDER) $('champTops').appendChild(iconCanvas(id, 88));
  AU.fx.win(); AU.ooh(1.2, 0.3); AU.swell(0.14);
  $('rA').onclick = () => shareTime(ms);
  $('rB').onclick = () => { AU.fx.click(); save.beaten = {}; save.runMs = 0; persist(); goLadder(); startMatch('attract'); };
  screen('s-result');
}
async function shareCard(ms) {
  const c = document.createElement('canvas'); c.width = 1200; c.height = 675; const g = c.getContext('2d');
  if (IMG.cover) g.drawImage(IMG.cover, 0, 0, 1200, 675); else { g.fillStyle = '#b5532f'; g.fillRect(0, 0, 1200, 675); }
  const gr = g.createLinearGradient(0, 0, 0, 675); gr.addColorStop(0, 'rgba(30,10,2,0.75)'); gr.addColorStop(0.5, 'rgba(30,10,2,0.15)'); gr.addColorStop(1, 'rgba(30,10,2,0.8)');
  g.fillStyle = gr; g.fillRect(0, 0, 1200, 675);
  const txt = (s, x, y, size, fill) => { g.font = `${size}px "Lilita One"`; g.textAlign = 'center'; g.lineJoin = 'round'; g.lineWidth = size * 0.14; g.strokeStyle = '#3a1d0e'; g.strokeText(s, x, y + size * 0.08); g.strokeText(s, x, y); g.fillStyle = fill; g.fillText(s, x, y); };
  txt('KOSO', 600, 150, 130, '#f6f1e7');
  txt('STREET CHAMPION', 600, 230, 54, '#f4b63d');
  txt(fmt(ms), 600, 560, 110, '#f6f1e7');
  txt('koso.nerom.site', 600, 640, 30, '#f6f1e7');
  return new Promise(res => c.toBlob(res, 'image/png'));
}
async function shareTime(ms) {
  AU.fx.click();
  const text = `I took every koso in the compound in ${fmt(ms)}. Who fit beat me? 🌀\nkoso.nerom.site\n@twigpine #ProjectTreetop`;
  try {
    const blob = await shareCard(ms);
    const file = new File([blob], 'koso-champion.png', { type: 'image/png' });
    if (isTouch && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  open('https://x.com/intent/post?text=' + encodeURIComponent(text), '_blank');
}

// pause
function pauseGame() { if (!inMatch()) return; G.paused = true; stopHumsQuiet(true); screen('s-pause'); }
function stopHumsQuiet(on) { for (const t of G.tops) if (t.hum) t.hum.set(0, 0, 0); }
$('pauseBtn').addEventListener('click', () => { AU.fx.click(); pauseGame(); });
$('bResume').addEventListener('click', () => { AU.fx.click(); G.paused = false; screen(null); });
$('bQuit').addEventListener('click', () => {
  AU.fx.click(); G.paused = false;
  if (G.mode === 'ladder') { save.runMs += G.matchT * 1000; persist(); stopHums(); $('hud').classList.remove('on'); hide('dash0'); hide('dash1'); goLadder(); startMatch('attract'); }
  else goTitle();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

// ---------------------------------------------------------------- loop
let last = performance.now(), acc = 0, logoA = 0;
function loop(now) {
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!G.paused) {
    if (G.stop > 0) { G.stop -= dt; dt = 0; }
    acc += dt;
    while (acc >= DT) { stepPhys(DT); acc -= DT; }
    stepParts(dt);
    if (G.phase === 'end') G.endT += dt;
  }
  G.shake *= Math.exp(-12 * Math.max(dt, 0.016)); if (G.shake < 0.3) G.shake = 0;
  render(); frameHud(); AU.frame(dt || 0.016);
  // title logo top and result spinners
  if ($('s-title').classList.contains('on')) { logoA += 0.016 * 30; topIcon($('logoTop'), 'omo', 0.85, logoA); }
  spinIcons = spinIcons.filter(s => s.c.isConnected);
  for (const s of spinIcons) { s.a += 0.016 * 24; topIcon(s.c, s.id, 0.8, s.a); }
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- boot
(async function boot() {
  resize(); paintSound();
  $('titleKids').innerHTML = KIDS.map(k => `<img src="assets/kids/${k.id}.webp" alt="${k.name}">`).join('');
  await Promise.all([loadImg('arena', 'assets/arena.jpg'), loadImg('cover', 'assets/cover.jpg'), document.fonts ? document.fonts.load('40px "Lilita One"') : 0]);
  buildPlate();
  goTitle();
  requestAnimationFrame(t => { last = t; loop(t); });
})();

// test hook for headless balance runs
window.__k = { G, DG, TUNE, TOPS, KIDS, startMatch, startRound, stepPhys, stepParts, dash, release, windQuality, save, setCtrl: (s, c, ai) => { G.ctrl[s] = c; G.ai[s] = ai; } };
