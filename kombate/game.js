'use strict';
/* ==================================================================
   KOMBATE DE CARAS — pelea 2D con la cara de tus amigos
   Lienzo lógico de alto 540; el ancho se adapta a la pantalla (760–1280).
   Coordenadas del mundo: x de 0 a STAGE_W, y = altura sobre el piso.
   ================================================================== */
const H = 540, GROUND = 482, STAGE_W = 1600, GRAV = 0.85, SPEC_COST = 50;
let W = 960, RK = 1;
if (!CanvasRenderingContext2D.prototype.roundRect) CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); };
const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t, rnd = (a, b) => a + Math.random() * (b - a);
const isTouch = () => matchMedia('(pointer:coarse)').matches || (navigator.maxTouchPoints > 0 && 'ontouchstart' in window);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function toast(t, ms = 3200) { const e = $('#toast'); e.textContent = t; e.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => e.style.display = 'none', ms); }
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
};

function resize() {
  const vw = innerWidth, vh = innerHeight;
  W = Math.round(clamp(H * vw / vh, 760, 1280));
  const sc = Math.min(vw / W, vh / H);
  cv.style.width = W * sc + 'px'; cv.style.height = H * sc + 'px';
  RK = Math.min(sc * Math.min(2, devicePixelRatio || 1), 2400 / W);
  cv.width = Math.round(W * RK); cv.height = Math.round(H * RK);
}
addEventListener('resize', resize);
resize();

/* =========================== SONIDO =========================== */
let AC = null, noiseBuf = null, muted = store.get('kdc_mute', false);
function audio() {
  if (!AC) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      const n = AC.sampleRate; noiseBuf = AC.createBuffer(1, n, n);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { return null; }
  }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
const quiet = () => muted || G.mode === 'demo';
function sNoise(dur, f, vol, type = 'lowpass', f2) {
  if (quiet()) return; const a = audio(); if (!a) return;
  const t = a.currentTime, s = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain();
  s.buffer = noiseBuf; fl.type = type; fl.frequency.setValueAtTime(f, t);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(fl).connect(g).connect(a.destination); s.start(t, Math.random() * 0.5, dur + 0.05);
}
function sTone(f1, f2, dur, vol, type = 'sine') {
  if (quiet()) return; const a = audio(); if (!a) return;
  const t = a.currentTime, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
}
const SFX = {
  hit(big) { sNoise(big ? .22 : .12, big ? 1400 : 2400, big ? .9 : .6); sTone(big ? 150 : 210, 50, big ? .25 : .13, big ? .8 : .5); },
  block() { sNoise(.08, 3500, .35, 'highpass'); sTone(900, 600, .06, .12, 'square'); },
  whoosh() { sNoise(.12, 600, .16, 'bandpass', 2600); },
  jump() { sTone(220, 420, .12, .07, 'triangle'); },
  land() { sNoise(.08, 300, .22); },
  fire() { sTone(300, 900, .35, .22, 'sawtooth'); sNoise(.4, 1200, .3, 'bandpass', 300); },
  charge() { sTone(110, 260, .4, .28, 'sawtooth'); sNoise(.4, 400, .3, 'bandpass', 1500); },
  tele() { sTone(1500, 200, .3, .18); },
  slam() { sTone(90, 30, .6, .9); sNoise(.6, 500, .9, 'lowpass', 80); },
  ko() { sTone(160, 30, 1.2, .9, 'sawtooth'); sNoise(1, 800, .7, 'lowpass', 60); },
  power() { sTone(400, 1200, .25, .15, 'triangle'); },
  beep() { sTone(660, 660, .08, .12, 'square'); }
};
function speak(t) {
  if (quiet() || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t); u.lang = 'es-ES'; u.rate = 1.05; u.pitch = .6;
    const v = speechSynthesis.getVoices().find(v => /^es/i.test(v.lang)); if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch (e) { }
}

/* ========================= PELEADORES ========================= */
// b.s = escala del cuerpo; tw/ww = medio ancho de hombros/cintura; c = colores
const CHARS = {
  toro: {
    name: 'Toro', desc: 'Bruto y pesado. ⚡ Embestida: carga hacia adelante y te tira al piso.', special: 'charge', hp: 110, speed: 3.5, jump: 15.5, power: 1.15,
    b: { s: 1.06, tw: 29, ww: 22, limb: 15, torso: 60 },
    c: { shirt: '#d0322a', pants: '#3a2a20', arm: '#c98a5f', neck: '#c98a5f', glove: '#e8312a', shoe: '#1a1a1a', belt: '#ffc83d', line: '#160806' }
  },
  rayo: {
    name: 'Rayo', desc: 'Rapidísimo. ⚡ Bola de energía que cruza la pantalla.', special: 'fire', hp: 95, speed: 4.5, jump: 16.5, power: .92,
    b: { s: .98, tw: 25, ww: 19, limb: 12, torso: 58 },
    c: { shirt: '#ffd21f', pants: '#1f4fd0', arm: '#ffd21f', neck: '#ffd21f', glove: '#ffffff', shoe: '#e8312a', belt: '#1f4fd0', line: '#141018' }
  },
  sombra: {
    name: 'Sombra', desc: 'Ninja. ⚡ Desaparece y aparece por detrás con una patada.', special: 'tele', hp: 95, speed: 4.3, jump: 17, power: 1,
    b: { s: 1, tw: 25, ww: 20, limb: 12.5, torso: 58 },
    c: { shirt: '#2c2936', pants: '#1d1b24', arm: '#2c2936', neck: '#2c2936', glove: '#45405a', shoe: '#111', belt: '#8b3dff', line: '#050407', scarf: '#e8312a' }
  },
  tanque: {
    name: 'Tanque', desc: 'Enorme y duro. ⚡ Golpe al suelo: ondas que tiran al piso.', special: 'slam', hp: 125, speed: 2.9, jump: 14.5, power: 1.28,
    b: { s: 1.16, tw: 34, ww: 28, limb: 17, torso: 62 },
    c: { shirt: '#4e6b2f', pants: '#2f3a22', arm: '#b07a52', neck: '#b07a52', glove: '#2b2b2b', shoe: '#141414', belt: '#6b4a2a', line: '#0b0f06', camo: '#33481d' }
  }
};
const CH_KEYS = Object.keys(CHARS);
for (const k of CH_KEYS) { const c = CHARS[k].c; c.dark = {}; for (const n of ['shirt', 'pants', 'arm', 'glove', 'shoe']) c.dark[n] = shade(c[n], -.28); }
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = n >> 8 & 255, b = n & 255;
  const f = v => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k);
  return '#' + ((1 << 24) | (f(r) << 16) | (f(g) << 8) | f(b)).toString(16).slice(1);
}

// su=arranque, ac=activo, rc=recuperación (cuadros); rx/ry = caja de golpe (antes de escalar); lv = high/mid/low/over
const ATK = {
  p: { su: 4, ac: 3, rc: 9, dmg: 5, rx: [15, 82], ry: [118, 148], st: 13, push: 4, lv: 'high' },
  k: { su: 7, ac: 4, rc: 13, dmg: 8, rx: [15, 102], ry: [58, 102], st: 17, push: 6, lv: 'mid' },
  cp: { su: 4, ac: 3, rc: 8, dmg: 4, rx: [15, 78], ry: [62, 96], st: 11, push: 3, lv: 'mid' },
  ck: { su: 8, ac: 4, rc: 17, dmg: 7, rx: [10, 110], ry: [0, 30], st: 0, push: 5, lv: 'low', knock: true, launch: 4 },
  jp: { su: 3, ac: 7, rc: 4, dmg: 6, rx: [10, 75], ry: [70, 125], st: 15, push: 3, lv: 'over' },
  jk: { su: 4, ac: 9, rc: 4, dmg: 8, rx: [5, 90], ry: [20, 85], st: 18, push: 5, lv: 'over' },
  tk: { su: 3, ac: 5, rc: 14, dmg: 11, rx: [10, 102], ry: [70, 135], st: 0, push: 7, lv: 'mid', knock: true, launch: 8 },
  charge: { dmg: 13, rx: [0, 64], ry: [40, 150], st: 0, push: 9, lv: 'mid', knock: true, launch: 7, chip: 2 },
  fire: { dmg: 12, st: 18, push: 5, lv: 'mid', chip: 2, bs: 14 },
  wave: { dmg: 12, st: 0, push: 5, lv: 'low', knock: true, launch: 8, chip: 2 },
  slam: { dmg: 10, st: 0, push: 8, lv: 'low', knock: true, launch: 7 }
};

/* =========================== CARAS =========================== */
const IMG = new Map();
function faceImg(url, onload) {
  if (!url) return null;
  let im = IMG.get(url);
  if (!im) { im = new Image(); im.src = url; IMG.set(url, im); }
  if (onload && !im.complete) im.addEventListener('load', onload, { once: true });
  return im;
}
/* Las caras se guardan mirando a la derecha (o de frente). "yaw" dice cuánto está de perfil:
   0 = de frente, 1 = de perfil. Se guarda aparte, por un código corto sacado de la imagen. */
let YAW = store.get('kdc_yaw', {});
const KEYS = new Map();
function faceKey(url) {
  let k = KEYS.get(url); if (k) return k;
  let h = 5381; for (let i = 0; i < url.length; i += 7) h = (h * 33 + url.charCodeAt(i)) | 0;
  k = (h >>> 0).toString(36) + url.length.toString(36); KEYS.set(url, k); return k;
}
const yawOf = url => url ? (YAW[faceKey(url)] || 0) : 0;
// Pega la foto sobre una "pelota" girada hacia la derecha: así una cara de frente parece mirar al rival.
const ART = new Map();
function faceArt(img, yaw) {
  const th = .4 * (1 - clamp((yaw || 0) / .45, 0, 1));
  if (th < .03) return img;
  const key = img.src + '|' + th.toFixed(2); let c = ART.get(key); if (c) return c;
  const S = 160, N = 40, iw = img.naturalWidth, ih = img.naturalHeight, x = (c = mkCanvas(S, S)).getContext('2d');
  let first = true;
  for (let i = 0; i < N; i++) {
    const u0 = -1 + 2 * i / N, p0 = Math.asin(u0) + th, p1 = Math.asin(Math.min(1, u0 + 2 / N)) + th, mid = Math.cos((p0 + p1) / 2);
    if (mid < .08) continue;
    const d0 = first ? 0 : (Math.sin(p0) + 1) / 2 * S, d1 = (Math.sin(p1) + 1) / 2 * S; first = false;
    x.drawImage(img, (u0 + 1) / 2 * iw, 0, iw / N + .5, ih, d0, 0, d1 - d0 + .8, S);
    const sh = (1 - mid) * .45; if (sh > .02) { x.fillStyle = `rgba(0,0,0,${sh})`; x.fillRect(d0, 0, d1 - d0 + .8, S); }
  }
  ART.set(key, c); return c;
}
/* ---------- heridas ----------
   Cada peleador tiene una lista de heridas con un umbral: aparecen cuando el daño acumulado en
   toda la pelea (hurt, de 0 a 1) lo pasa. Posiciones en radios de la cara (x a la derecha, y abajo). */
const WOUND_PLAN = [
  [.05, 'bruise', 'cheek'], [.11, 'scratch', 'cheek2'], [.17, 'bandaid', 'any'], [.24, 'bump', 'forehead'], [.31, 'blackeye', 'eye'],
  [.37, 'nosebleed', 'nose'], [.44, 'bruise', 'cheek2'], [.51, 'stitches', 'brow'], [.58, 'xband', 'cheek'], [.65, 'lip', 'mouth'],
  [.72, 'blackeye', 'eye2'], [.79, 'scratch', 'any'], [.86, 'bruise', 'chin'], [.92, 'bandage', 'head'], [.97, 'bandaid', 'chin']
];
function mkWounds(seed) {
  const R = rng(seed), side = R() < .5 ? -1 : 1, j = () => (R() - .5) * .1;
  const spot = {
    cheek: [.46 * side, .28], cheek2: [-.46 * side, .28], eye: [.33 * side, -.12], eye2: [-.33 * side, -.12], forehead: [(R() - .5) * .5, -.58],
    brow: [.3 * (R() < .5 ? side : -side), -.36], nose: [.03, .14], mouth: [.14 * side, .46], chin: [(R() - .5) * .35, .7], head: [0, -.62]
  };
  return WOUND_PLAN.map(([t, type, where]) => {
    const [x, y] = where === 'any' ? [(R() - .5) * 1.1, (R() - .3) * .9] : spot[where];
    const fixed = type === 'blackeye' || type === 'nosebleed' || type === 'bandage';
    return { t: t + (R() - .5) * .04, type, x: x + (fixed ? 0 : j()), y: y + (fixed ? 0 : j()), rot: (R() - .5) * 1.6, s: .85 + R() * .35 };
  });
}
function drawWounds(c, R, hf, th) {
  const T = G.time;
  hf.wounds.forEach((w, i) => {
    if (hf.hurt < w.t) return;
    let k = 1;
    if (hf.wt) { if (hf.wt[i] == null) hf.wt[i] = T; k = Math.min(1, (T - hf.wt[i]) / 10); }
    // la cara girada corre los rasgos: las heridas se corren igual
    const x = th ? Math.sin(Math.asin(clamp(w.x, -1, 1)) + th) : w.x;
    c.save(); c.translate(x * R, w.y * R); c.globalAlpha *= k * .9; c.scale(R, R);
    const s = w.s * (1 + (1 - k) * .8); c.scale(s, s);
    WOUND[w.type](c, w);
    c.restore();
  });
  if (hf.cry) { // lágrimas del que perdió
    for (const ex of [-.33, .33]) {
      const x = th ? Math.sin(Math.asin(ex) + th) : ex;
      c.save(); c.translate(x * R, 0); c.scale(R, R);
      const g = c.createLinearGradient(0, -.02, 0, .5); g.addColorStop(0, 'rgba(140,210,255,.9)'); g.addColorStop(1, 'rgba(140,210,255,.2)');
      c.fillStyle = g; c.beginPath(); c.moveTo(-.04, 0); c.quadraticCurveTo(-.06, .3, 0, .5); c.quadraticCurveTo(.06, .3, .04, 0); c.fill();
      c.fillStyle = 'rgba(170,225,255,.95)'; c.beginPath(); c.arc(0, .52, .06, 0, 7); c.fill();
      c.restore();
    }
  }
}
function radial(c, r, stops) { const g = c.createRadialGradient(0, 0, 0, 0, 0, r); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; }
const WOUND = {
  bruise(c, w) {
    c.rotate(w.rot); c.scale(1.35, 1);
    c.fillStyle = radial(c, .27, [[0, 'rgba(95,25,120,.62)'], [.5, 'rgba(70,40,120,.42)'], [.8, 'rgba(90,120,60,.2)'], [1, 'rgba(90,120,60,0)']]);
    c.beginPath(); c.arc(0, 0, .27, 0, 7); c.fill();
  },
  blackeye(c) {
    c.scale(1.25, 1);
    c.fillStyle = radial(c, .27, [[0, 'rgba(60,10,80,.15)'], [.45, 'rgba(60,10,80,.25)'], [.7, 'rgba(55,10,75,.75)'], [.85, 'rgba(90,30,110,.45)'], [1, 'rgba(90,30,110,0)']]);
    c.beginPath(); c.arc(0, 0, .27, 0, 7); c.fill();
  },
  bandaid(c, w) {
    c.rotate(w.rot);
    c.fillStyle = '#e9c49c'; c.strokeStyle = '#b5845a'; c.lineWidth = .025;
    c.beginPath(); c.roundRect(-.29, -.085, .58, .17, .085); c.fill(); c.stroke();
    c.fillStyle = '#f6e3cc'; c.fillRect(-.09, -.07, .18, .14);
    c.fillStyle = '#b5845a'; for (const dx of [-.21, -.15, .15, .21]) for (const dy of [-.03, .03]) { c.beginPath(); c.arc(dx, dy, .01, 0, 7); c.fill(); }
  },
  xband(c, w) { c.save(); c.rotate(.75 - w.rot); WOUND.bandaid(c, { rot: 0 }); c.restore(); c.rotate(-.75 - w.rot); WOUND.bandaid(c, { rot: 0 }); },
  scratch(c, w) {
    c.rotate(w.rot - .6); c.lineCap = 'round';
    for (let k = -1; k <= 1; k++) {
      const L = .2 - Math.abs(k) * .05, y = k * .075;
      c.strokeStyle = 'rgba(160,20,35,.7)'; c.lineWidth = .028; c.beginPath(); c.moveTo(-L, y); c.quadraticCurveTo(0, y - .04, L, y + .03); c.stroke();
      c.strokeStyle = 'rgba(255,140,140,.55)'; c.lineWidth = .01; c.beginPath(); c.moveTo(-L * .9, y - .004); c.quadraticCurveTo(0, y - .044, L * .9, y + .026); c.stroke();
    }
    c.fillStyle = 'rgba(165,0,26,.8)'; c.beginPath(); c.arc(.06, .11, .016, 0, 7); c.arc(-.09, -.1, .012, 0, 7); c.fill();
  },
  bump(c) {
    c.fillStyle = radial(c, .2, [[0, 'rgba(255,150,140,.95)'], [.6, 'rgba(225,90,90,.8)'], [1, 'rgba(200,60,60,0)']]);
    c.beginPath(); c.arc(0, 0, .2, 0, 7); c.fill();
    c.strokeStyle = 'rgba(140,30,30,.5)'; c.lineWidth = .02; c.beginPath(); c.arc(0, .01, .13, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.ellipse(-.05, -.06, .05, .03, -.5, 0, 7); c.fill();
  },
  nosebleed(c) {
    c.fillStyle = '#b3001b';
    for (const dx of [-.07, .07]) {
      c.beginPath(); c.moveTo(dx - .035, 0); c.quadraticCurveTo(dx - .045, .2, dx, .3); c.quadraticCurveTo(dx + .045, .2, dx + .035, 0); c.fill();
      c.beginPath(); c.arc(dx, .3, .035, 0, 7); c.fill();
    }
    c.fillStyle = 'rgba(255,120,120,.6)'; c.beginPath(); c.arc(-.08, .08, .012, 0, 7); c.fill();
  },
  stitches(c, w) {
    c.rotate(w.rot * .5); c.lineCap = 'round';
    c.strokeStyle = 'rgba(200,60,70,.35)'; c.lineWidth = .08; c.beginPath(); c.moveTo(-.22, 0); c.quadraticCurveTo(0, -.03, .22, 0); c.stroke();
    c.strokeStyle = 'rgba(150,15,30,.9)'; c.lineWidth = .025; c.beginPath(); c.moveTo(-.22, 0); c.quadraticCurveTo(0, -.03, .22, 0); c.stroke();
    c.strokeStyle = 'rgba(30,15,15,.85)'; c.lineWidth = .013;
    for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(k * .085 - .02, -.06); c.lineTo(k * .085 + .02, .05); c.stroke(); }
  },
  lip(c) {
    c.fillStyle = radial(c, .18, [[0, 'rgba(200,40,60,.8)'], [1, 'rgba(200,40,60,0)']]);
    c.beginPath(); c.ellipse(0, 0, .2, .12, 0, 0, 7); c.fill();
    c.fillStyle = '#a5001a'; c.beginPath(); c.moveTo(-.025, 0); c.quadraticCurveTo(-.03, .14, 0, .2); c.quadraticCurveTo(.03, .14, .025, 0); c.fill();
    c.beginPath(); c.arc(0, .2, .028, 0, 7); c.fill();
  },
  bandage(c) {
    c.rotate(-.12);
    c.fillStyle = '#f3f1ea'; c.strokeStyle = '#c9c4b5'; c.lineWidth = .02;
    c.translate(0, -.1);
    c.beginPath(); c.roundRect(-1.2, -.12, 2.4, .24, .04); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(160,150,130,.5)'; c.lineWidth = .012;
    for (let x = -1.1; x < 1.1; x += .14) { c.beginPath(); c.moveTo(x, -.11); c.lineTo(x + .07, .11); c.stroke(); }
    c.fillStyle = radial(c, .14, [[0, 'rgba(200,10,20,.75)'], [1, 'rgba(200,10,20,0)']]);
    c.save(); c.translate(.25, 0); c.beginPath(); c.arc(0, 0, .14, 0, 7); c.fill(); c.restore();
  }
};
// dir = 1 mira a la derecha, -1 a la izquierda; hf = { wounds, hurt, wt } para dibujar las heridas
function drawFace(c, img, R, ring, flash, dir = 1, yaw = 0, hf = null) {
  c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2);
  c.fillStyle = '#d9a27c'; c.fill();
  c.save(); if (dir < 0) c.scale(-1, 1);
  const photo = img && img.complete && img.naturalWidth;
  if (photo) {
    c.clip(); c.drawImage(faceArt(img, yaw), -R, -R, R * 2, R * 2);
  } else {
    // cara de muñeco cuando no hay foto
    c.fillStyle = '#fff';
    c.beginPath(); c.ellipse(-R * .36, -R * .12, R * .2, R * .25, 0, 0, 7); c.ellipse(R * .36, -R * .12, R * .2, R * .25, 0, 0, 7); c.fill();
    c.fillStyle = '#222';
    c.beginPath(); c.arc(-R * .3, -R * .08, R * .1, 0, 7); c.arc(R * .42, -R * .08, R * .1, 0, 7); c.fill();
    c.strokeStyle = '#3a2210'; c.lineWidth = R * .1; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-R * .6, -R * .5); c.lineTo(-R * .15, -R * .36); c.moveTo(R * .6, -R * .5); c.lineTo(R * .15, -R * .36);
    c.moveTo(-R * .3, R * .45); c.quadraticCurveTo(0, R * .3, R * .3, R * .45); c.stroke();
  }
  if (hf && hf.wounds && (hf.hurt > 0 || hf.cry)) {
    c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.clip();
    drawWounds(c, R, hf, photo ? .4 * (1 - clamp((yaw || 0) / .45, 0, 1)) : 0);
  }
  c.restore();
  if (flash > 0) { c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.fillStyle = `rgba(255,40,30,${Math.min(1, flash / 10) * .5})`; c.fill(); }
  c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2);
  c.lineWidth = Math.max(3, R * .13); c.strokeStyle = ring; c.stroke();
}
const RING = ['#2f7bff', '#e8312a'];

/* ========================= ESCENARIOS ========================= */
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function grad(c, y0, y1, stops) { const g = c.createLinearGradient(0, y0, 0, y1); stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s)); return g; }
function glow(c, x, y, r, col) { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
const FL = 40; // la capa del piso empieza 40px arriba de GROUND
const STAGES = [
  {
    name: 'Calle de Asunción',
    far(c, R) {
      c.fillStyle = grad(c, 0, GROUND, ['#2a1b4d', '#8a3b6b', '#ff7a59', '#ffc46b']); c.fillRect(0, 0, STAGE_W, H);
      glow(c, 760, 300, 180, 'rgba(255,230,150,.7)');
      c.fillStyle = '#ffe29a'; c.beginPath(); c.arc(760, 300, 62, 0, 7); c.fill();
      for (let x = -20; x < STAGE_W;) {
        const w = 40 + R() * 60, h = 70 + R() * 170; c.fillStyle = R() < .5 ? '#3b2453' : '#2f1d45';
        c.fillRect(x, GROUND - 70 - h, w, h + 80);
        c.fillStyle = 'rgba(255,210,120,.75)';
        for (let wy = GROUND - 60 - h; wy < GROUND - 80; wy += 14) for (let wx = x + 6; wx < x + w - 8; wx += 11) if (R() < .22) c.fillRect(wx, wy, 5, 7);
        x += w + R() * 8;
      }
    },
    mid(c, R) {
      const cols = ['#e9a5a0', '#f2d48f', '#9fd3c7', '#c7a6e8', '#f5b971', '#8fb8e8', '#f0e6d2'];
      let x = -30, n = 0;
      while (x < STAGE_W) {
        n++;
        if (n % 4 === 0) { lapacho(c, x + 70, GROUND - 32, R); x += 150; continue; }
        const w = 170 + R() * 80, h = 150 + R() * 80, top = GROUND - 32 - h, col = cols[R() * cols.length | 0];
        c.fillStyle = col; c.fillRect(x, top, w, h);
        c.fillStyle = shade(col, -.25); c.fillRect(x - 4, top - 12, w + 8, 14); c.fillRect(x, GROUND - 46, w, 14);
        c.fillStyle = '#ffffff55'; c.fillRect(x, top + 2, w, 4);
        const dx = x + w / 2 - 22; c.fillStyle = '#2e5a3a';
        c.beginPath(); c.moveTo(dx, GROUND - 32); c.lineTo(dx, top + h - 80); c.arc(dx + 22, top + h - 80, 22, Math.PI, 0); c.lineTo(dx + 44, GROUND - 32); c.fill();
        for (const wx of [x + 22, x + w - 56]) {
          c.fillStyle = '#3b6b8a'; c.fillRect(wx, top + 30, 34, 50);
          c.fillStyle = '#ffffff66'; c.fillRect(wx + 3, top + 33, 12, 20);
          c.strokeStyle = '#222'; c.lineWidth = 2; c.strokeRect(wx - 6, top + 74, 46, 12);
          for (let bx = wx - 2; bx < wx + 40; bx += 7) { c.beginPath(); c.moveTo(bx, top + 74); c.lineTo(bx, top + 86); c.stroke(); }
        }
        x += w;
        if (R() < .5) {
          c.fillStyle = '#1b1b1b'; c.fillRect(x + 4, GROUND - 200, 6, 170); c.fillRect(x - 6, GROUND - 204, 26, 6);
          glow(c, x + 7, GROUND - 190, 40, 'rgba(255,220,120,.8)');
          c.fillStyle = '#ffe9a8'; c.beginPath(); c.arc(x + 7, GROUND - 192, 7, 0, 7); c.fill();
        }
      }
      c.fillStyle = 'rgba(255,120,60,.12)'; c.fillRect(0, 0, STAGE_W, H);
      function lapacho(c, x, base, R) {
        c.strokeStyle = '#4a2c1a'; c.lineWidth = 14; c.lineCap = 'round';
        c.beginPath(); c.moveTo(x, base); c.quadraticCurveTo(x - 10, base - 90, x + 6, base - 150); c.stroke();
        c.lineWidth = 6; c.beginPath(); c.moveTo(x - 4, base - 100); c.lineTo(x - 50, base - 160); c.moveTo(x + 2, base - 120); c.lineTo(x + 50, base - 170); c.stroke();
        for (let i = 0; i < 70; i++) {
          const a = R() * Math.PI * 2, r = R() * 90;
          c.fillStyle = ['#ff5fa8', '#ff8cc6', '#e83f8f', '#ffb3d9'][i % 4];
          c.beginPath(); c.arc(x + Math.cos(a) * r, base - 175 + Math.sin(a) * r * .55, 9 + R() * 9, 0, 7); c.fill();
        }
      }
    },
    floor(c, R) {
      c.fillStyle = '#8d8590'; c.fillRect(0, 8, STAGE_W, 32); c.fillStyle = '#b0a8b2'; c.fillRect(0, 8, STAGE_W, 5);
      c.fillStyle = '#5b4f5e'; c.fillRect(0, FL, STAGE_W, H);
      let y = FL + 2, rh = 9;
      while (y < H - GROUND + FL) {
        const off = (y * 7) % 30;
        for (let x = -off; x < STAGE_W; x += rh * 2.6) { c.fillStyle = R() < .5 ? '#6c5f70' : '#655868'; c.beginPath(); c.roundRect(x + 2, y, rh * 2.6 - 4, rh - 2, 4); c.fill(); }
        y += rh; rh += 2.2;
      }
    }
  },
  {
    name: 'Cataratas',
    falls: [[260, 90], [600, 120], [960, 80], [1290, 110]],
    far(c, R) {
      c.fillStyle = grad(c, 0, GROUND, ['#5fb6ff', '#a8dcff', '#e6f6ff']); c.fillRect(0, 0, STAGE_W, H);
      c.fillStyle = '#ffffffcc'; for (let i = 0; i < 9; i++) { const x = R() * STAGE_W, y = 30 + R() * 90; for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(x + k * 22, y + Math.sin(k) * 6, 20 + R() * 12, 0, 7); c.fill(); } }
      c.fillStyle = '#2f6b3a'; c.beginPath(); c.moveTo(0, GROUND);
      for (let x = 0; x <= STAGE_W; x += 40) c.lineTo(x, 150 + Math.sin(x * .01) * 20 + R() * 20);
      c.lineTo(STAGE_W, GROUND); c.fill();
      c.fillStyle = '#58704a';
      for (let i = 0; i < 40; i++) { const x = R() * STAGE_W, y = 200 + R() * 220; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 30 + R() * 40, y + 10); c.lineTo(x + 10, y + 50 + R() * 40); c.fill(); }
      for (const [x, w] of this.falls) {
        c.fillStyle = grad(c, 160, GROUND - 40, ['#cfefff', '#f4fbff']); c.fillRect(x, 160, w, GROUND - 200);
      }
      c.fillStyle = '#3d8fc0'; c.fillRect(0, GROUND - 60, STAGE_W, 40);
    },
    fxFar(c, camx, T) {
      const ox = -camx * .25;
      c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 3;
      for (const [x, w] of this.falls) for (let k = 0; k < w / 9; k++) {
        const xx = ox + x + 4 + k * 9, y = 160 + ((T * 6 + k * 53) % (GROUND - 220));
        c.beginPath(); c.moveTo(xx, y); c.lineTo(xx, y + 26); c.stroke();
      }
      for (const [x, w] of this.falls) { const p = .5 + .5 * Math.sin(T * .05 + x); c.fillStyle = `rgba(255,255,255,${.35 + p * .25})`; c.beginPath(); c.ellipse(ox + x + w / 2, GROUND - 58, w * .9, 26, 0, 0, 7); c.fill(); }
    },
    mid(c, R) {
      for (let x = -40; x < STAGE_W; x += 70 + R() * 60) {
        const h = 60 + R() * 120, base = GROUND - 30;
        for (let k = 0; k < 9; k++) { c.fillStyle = ['#1f5a2a', '#2b7a37', '#3d9447'][k % 3]; c.beginPath(); c.ellipse(x + rnd2(R, -40, 40), base - R() * h, 30 + R() * 25, 18 + R() * 12, R() * 3, 0, 7); c.fill(); }
        if (R() < .35) { c.strokeStyle = '#5a3d1e'; c.lineWidth = 8; c.beginPath(); c.moveTo(x, base); c.quadraticCurveTo(x + 20, base - 150, x + 10, base - 230); c.stroke(); for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * .45; c.strokeStyle = '#2f8a3c'; c.lineWidth = 9; c.beginPath(); c.moveTo(x + 10, base - 230); c.quadraticCurveTo(x + 10 + Math.cos(a) * 40, base - 260 + Math.sin(a) * 20, x + 10 + Math.cos(a) * 80, base - 220 + Math.sin(a) * 10 + 30); c.stroke(); } }
      }
      function rnd2(R, a, b) { return a + R() * (b - a); }
    },
    floor(c, R) {
      c.fillStyle = '#3f4a43'; c.fillRect(0, 16, STAGE_W, H);
      c.fillStyle = '#56645a'; c.fillRect(0, 16, STAGE_W, 24);
      for (let i = 0; i < 160; i++) { c.fillStyle = R() < .5 ? '#4d5a52' : '#34403a'; c.beginPath(); c.ellipse(R() * STAGE_W, FL + 10 + R() * 60, 20 + R() * 40, 4 + R() * 6, 0, 0, 7); c.fill(); }
      for (let i = 0; i < 20; i++) { c.fillStyle = 'rgba(160,215,255,.35)'; c.beginPath(); c.ellipse(R() * STAGE_W, FL + 18 + R() * 40, 30 + R() * 50, 5, 0, 0, 7); c.fill(); }
    }
  },
  {
    name: 'Templo de noche',
    lanterns: [180, 470, 760, 840, 1130, 1420],
    far(c, R) {
      c.fillStyle = grad(c, 0, GROUND, ['#070a24', '#1b1d4a', '#3a2f63']); c.fillRect(0, 0, STAGE_W, H);
      c.fillStyle = '#fff'; for (let i = 0; i < 160; i++) { c.globalAlpha = .3 + R() * .7; c.fillRect(R() * STAGE_W, R() * 300, 2, 2); } c.globalAlpha = 1;
      glow(c, 1100, 120, 150, 'rgba(255,245,210,.35)');
      c.fillStyle = '#fff6d8'; c.beginPath(); c.arc(1100, 120, 56, 0, 7); c.fill();
      c.fillStyle = '#e9dfbf'; c.beginPath(); c.arc(1085, 108, 9, 0, 7); c.arc(1118, 132, 6, 0, 7); c.fill();
      c.fillStyle = '#1a1b3d'; c.beginPath(); c.moveTo(0, GROUND);
      for (let x = 0; x <= STAGE_W; x += 80) c.lineTo(x, 300 + Math.sin(x * .004) * 60 + R() * 30); c.lineTo(STAGE_W, GROUND); c.fill();
      c.fillStyle = '#12122c';
      const px = 420, pb = 330;
      for (let k = 0; k < 4; k++) { const w = 120 - k * 22, y = pb - k * 44; c.fillRect(px - w / 2 + 10, y - 30, w - 20, 30); c.beginPath(); c.moveTo(px - w / 2 - 14, y - 26); c.lineTo(px + w / 2 + 14, y - 26); c.lineTo(px + w / 2 - 10, y - 44); c.lineTo(px - w / 2 + 10, y - 44); c.fill(); }
      c.fillRect(px - 3, pb - 210, 6, 40);
      c.fillRect(0, GROUND - 120, STAGE_W, 120);
    },
    mid(c, R) {
      c.fillStyle = '#2a1414'; c.fillRect(0, GROUND - 52, STAGE_W, 22);
      for (let x = 60; x < STAGE_W; x += 290) { c.fillStyle = '#5a1717'; c.fillRect(x, GROUND - 260, 22, 230); c.fillStyle = '#3a0f0f'; c.fillRect(x + 16, GROUND - 260, 6, 230); }
      c.fillStyle = '#3a1d10'; c.fillRect(0, GROUND - 276, STAGE_W, 18);
      const tx = STAGE_W / 2;
      c.fillStyle = '#c0392b'; c.fillRect(tx - 150, GROUND - 250, 24, 220); c.fillRect(tx + 126, GROUND - 250, 24, 220);
      c.fillRect(tx - 175, GROUND - 230, 350, 16);
      c.fillStyle = '#111'; c.beginPath(); c.moveTo(tx - 200, GROUND - 262); c.quadraticCurveTo(tx, GROUND - 250, tx + 200, GROUND - 262); c.lineTo(tx + 190, GROUND - 280); c.quadraticCurveTo(tx, GROUND - 270, tx - 190, GROUND - 280); c.fill();
    },
    fx(c, camx, T) {
      const ox = -camx * .6;
      for (const lx of this.lanterns) {
        const x = ox + lx + Math.sin(T * .03 + lx) * 4, y = GROUND - 225, f = .85 + Math.sin(T * .2 + lx) * .08;
        c.strokeStyle = '#222'; c.lineWidth = 2; c.beginPath(); c.moveTo(ox + lx, GROUND - 258); c.lineTo(x, y - 20); c.stroke();
        glow(c, x, y, 70 * f, 'rgba(255,140,60,.45)');
        c.fillStyle = '#ff5a2a'; c.beginPath(); c.ellipse(x, y, 16, 21, 0, 0, 7); c.fill();
        c.fillStyle = '#ffcf70'; c.beginPath(); c.ellipse(x, y, 8, 15, 0, 0, 7); c.fill();
        c.fillStyle = '#222'; c.fillRect(x - 9, y - 23, 18, 5); c.fillRect(x - 9, y + 18, 18, 5);
      }
    },
    floor(c, R) {
      c.fillStyle = '#3a2412'; c.fillRect(0, 20, STAGE_W, 20);
      c.fillStyle = '#6b4426'; c.fillRect(0, FL, STAGE_W, H);
      let y = FL, h = 8;
      while (y < H) { c.fillStyle = (y / h | 0) % 2 ? '#74492a' : '#5f3c21'; c.fillRect(0, y, STAGE_W, h); c.fillStyle = '#00000040'; c.fillRect(0, y + h - 2, STAGE_W, 2); for (let x = R() * 200; x < STAGE_W; x += 150 + R() * 150) c.fillRect(x, y, 2, h); y += h; h += 3; }
      c.fillStyle = 'rgba(255,170,90,.08)'; c.fillRect(0, FL, STAGE_W, 30);
    }
  },
  {
    name: 'Estadio',
    far(c, R) {
      c.fillStyle = grad(c, 0, GROUND, ['#04060e', '#0d1430', '#18224a']); c.fillRect(0, 0, STAGE_W, H);
      c.fillStyle = '#10162e'; c.beginPath(); c.moveTo(0, 110); c.quadraticCurveTo(STAGE_W / 2, 70, STAGE_W, 110); c.lineTo(STAGE_W, GROUND); c.lineTo(0, GROUND); c.fill();
      const shirts = ['#d52b1e', '#ffffff', '#0038a8', '#d52b1e', '#ffffff', '#ffd21f'];
      for (let y = 130; y < GROUND - 70; y += 15) {
        c.fillStyle = '#0a0e20'; c.fillRect(0, y + 10, STAGE_W, 3);
        for (let x = (y % 2) * 6; x < STAGE_W; x += 11) {
          if (R() < .1) continue;
          c.fillStyle = shirts[R() * shirts.length | 0]; c.globalAlpha = .55 + (y / GROUND) * .4; c.fillRect(x, y + 4, 8, 7);
          c.fillStyle = ['#e3b08a', '#b07a52', '#7a4e30'][R() * 3 | 0]; c.beginPath(); c.arc(x + 4, y + 2, 3, 0, 7); c.fill();
        }
      }
      c.globalAlpha = 1;
      for (const tx of [120, STAGE_W - 120]) {
        c.fillStyle = '#2a2f40'; c.fillRect(tx - 6, 40, 12, GROUND);
        c.fillStyle = '#ddd'; c.fillRect(tx - 50, 30, 100, 36);
        glow(c, tx, 48, 160, 'rgba(255,255,230,.5)');
        c.fillStyle = '#fffef0'; for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { c.beginPath(); c.arc(tx - 36 + i * 24, 40 + j * 16, 6, 0, 7); c.fill(); }
      }
    },
    fxFar(c, camx, T) {
      const ox = -camx * .25, s = T / 7 | 0;
      for (let i = 0; i < 6; i++) {
        const R = rng(s * 13 + i); if (R() < .4) continue;
        const x = ox + R() * STAGE_W, y = 140 + R() * 240; glow(c, x, y, 14, 'rgba(255,255,255,.9)');
      }
      c.fillStyle = 'rgba(255,255,220,.05)';
      for (const tx of [120, STAGE_W - 120]) { c.beginPath(); c.moveTo(ox + tx - 40, 60); c.lineTo(ox + tx + 40, 60); c.lineTo(ox + STAGE_W / 2 + 300 * Math.sign(STAGE_W / 2 - tx), GROUND); c.lineTo(ox + STAGE_W / 2 - 100 * Math.sign(STAGE_W / 2 - tx), GROUND); c.fill(); }
    },
    mid(c, R) {
      const ads = [['KOMBATE', '#d52b1e', '#fff'], ['DE CARAS', '#ffd21f', '#111'], ['JLEOV GAMES', '#0038a8', '#fff'], ['PY 🇵🇾', '#fff', '#d52b1e'], ['¡PIÑA!', '#1d9e49', '#fff']];
      c.fillStyle = '#0a0d18'; c.fillRect(0, GROUND - 92, STAGE_W, 62);
      for (let i = 0, x = 0; x < STAGE_W; i++, x += 220) {
        const [t, bg, fg] = ads[i % ads.length]; c.fillStyle = bg; c.fillRect(x + 4, GROUND - 86, 212, 48);
        c.fillStyle = fg; c.font = '900 26px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, x + 110, GROUND - 61);
      }
    },
    floor(c, R) {
      c.fillStyle = '#ffffff'; c.fillRect(0, 34, STAGE_W, 6);
      for (let x = 0; x < STAGE_W; x += 100) { c.fillStyle = (x / 100) % 2 ? '#2f8f3a' : '#37a045'; c.fillRect(x, FL, 100, H); }
      c.fillStyle = '#ffffffcc'; c.fillRect(STAGE_W / 2 - 3, FL, 6, H);
      c.strokeStyle = '#ffffffcc'; c.lineWidth = 5; c.beginPath(); c.ellipse(STAGE_W / 2, FL + 40, 160, 26, 0, 0, 7); c.stroke();
      c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(0, FL, STAGE_W, 8);
    }
  },
  {
    name: 'Playa del lago',
    far(c, R) {
      c.fillStyle = grad(c, 0, 330, ['#3aa2ff', '#8fd0ff', '#d9f2ff']); c.fillRect(0, 0, STAGE_W, H);
      glow(c, 300, 90, 120, 'rgba(255,250,200,.8)'); c.fillStyle = '#fffbe0'; c.beginPath(); c.arc(300, 90, 42, 0, 7); c.fill();
      c.fillStyle = '#ffffffdd'; for (let i = 0; i < 8; i++) { const x = R() * STAGE_W, y = 50 + R() * 120; for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(x + k * 26, y + (k % 2) * 8, 22 + R() * 10, 0, 7); c.fill(); } }
      c.fillStyle = '#5f9c6a'; c.beginPath(); c.moveTo(0, 340); for (let x = 0; x <= STAGE_W; x += 60) c.lineTo(x, 300 + Math.sin(x * .006) * 18 + R() * 10); c.lineTo(STAGE_W, 340); c.fill();
      c.fillStyle = grad(c, 335, GROUND - 40, ['#2f8fc7', '#4fb0dd', '#7cd0ea']); c.fillRect(0, 335, STAGE_W, GROUND - 335);
    },
    fxFar(c, camx, T) {
      const ox = -camx * .25;
      c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 2;
      for (let i = 0; i < 40; i++) { const x = ox + ((i * 97 + T * (.3 + (i % 3) * .2)) % STAGE_W), y = 350 + (i * 37) % 100; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 18, y); c.stroke(); }
      const bx = ox + ((T * .4) % (STAGE_W + 200)) - 100, by = 352 + Math.sin(T * .05) * 2;
      c.fillStyle = '#fff'; c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + 4, by - 50); c.lineTo(bx + 32, by - 4); c.fill();
      c.fillStyle = '#d52b1e'; c.fillRect(bx - 16, by, 52, 7);
    },
    mid(c, R) {
      for (let x = 80; x < STAGE_W; x += 260 + R() * 120) {
        const base = GROUND - 32, lean = (R() - .5) * 60;
        c.strokeStyle = '#7a5530'; c.lineWidth = 12; c.lineCap = 'round';
        c.beginPath(); c.moveTo(x, base); c.quadraticCurveTo(x + lean * .3, base - 140, x + lean, base - 240); c.stroke();
        for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; c.strokeStyle = k % 2 ? '#2f9a46' : '#24803a'; c.lineWidth = 10; c.beginPath(); c.moveTo(x + lean, base - 240); c.quadraticCurveTo(x + lean + Math.cos(a) * 50, base - 260 + Math.sin(a) * 20, x + lean + Math.cos(a) * 90, base - 220 + Math.abs(Math.sin(a)) * 30); c.stroke(); }
        if (R() < .7) { const ux = x + 120, cols = ['#ff4d4d', '#ffd21f', '#2f7bff', '#ff8c1a']; c.strokeStyle = '#eee'; c.lineWidth = 4; c.beginPath(); c.moveTo(ux, base); c.lineTo(ux, base - 120); c.stroke(); for (let k = 0; k < 6; k++) { c.fillStyle = cols[(k + (x | 0)) % 4]; c.beginPath(); c.moveTo(ux, base - 130); c.arc(ux, base - 105, 70, Math.PI + k * Math.PI / 6, Math.PI + (k + 1) * Math.PI / 6); c.fill(); } }
      }
    },
    floor(c, R) {
      c.fillStyle = '#cfb47a'; c.fillRect(0, 22, STAGE_W, 18);
      c.fillStyle = '#e9cf92'; c.fillRect(0, FL, STAGE_W, H);
      for (let i = 0; i < 900; i++) { c.fillStyle = R() < .5 ? '#d9bd80' : '#f5dfaa'; c.fillRect(R() * STAGE_W, FL + R() * 70, 2, 2); }
      for (let i = 0; i < 12; i++) { c.fillStyle = ['#ffffff', '#ffb3c6', '#ffd27a'][i % 3]; c.beginPath(); c.ellipse(R() * STAGE_W, FL + 20 + R() * 40, 5, 3, R(), 0, 7); c.fill(); }
    }
  }
];
function stageLayers(i) {
  const S = STAGES[i]; if (S.L) return S.L;
  const R = rng(i * 999 + 7), far = mkCanvas(STAGE_W, H), mid = mkCanvas(STAGE_W, H), fl = mkCanvas(STAGE_W, H - GROUND + FL);
  S.far(far.getContext('2d'), R); S.mid(mid.getContext('2d'), R); S.floor(fl.getContext('2d'), R);
  return S.L = { far, mid, fl };
}
function drawStage(c, i, camx, T) {
  const S = STAGES[i], L = stageLayers(i);
  c.drawImage(L.far, -camx * .25, 0); if (S.fxFar) S.fxFar(c, camx, T);
  c.drawImage(L.mid, -camx * .6, 0); if (S.fx) S.fx(c, camx, T);
  c.drawImage(L.fl, -camx, GROUND - FL);
}

/* =========================== ENTRADAS =========================== */
// cada fuente tiene teclas apretadas (h) y toques nuevos (t) que se consumen al leer
const mkSrc = () => ({ h: { l: 0, r: 0, u: 0, d: 0, p: 0, k: 0, s: 0 }, t: { p: 0, k: 0, s: 0, u: 0 } });
const S_KB1 = mkSrc(), S_T = [mkSrc(), mkSrc()], S_PAD = [mkSrc(), mkSrc()], S_CPU = [mkSrc(), mkSrc()], S_NET = mkSrc();
// PC: W A S D para moverse; V puño, B patada, G salto, H habilidad (como los botones del celular)
const KEYS1 = { KeyA: 'l', KeyD: 'r', KeyW: 'u', KeyS: 'd', KeyV: 'p', KeyB: 'k', KeyG: 'u', KeyH: 's' };
function keyEv(e, down) {
  if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
  const b = KEYS1[e.code], S = S_KB1; if (!b) {
    if (down && (e.code === 'Escape' || e.code === 'KeyP') && G.mode !== 'demo') togglePause();
    return;
  }
  if (playing()) e.preventDefault();
  if (down && !S.h[b] && b in S.t) S.t[b]++;
  S.h[b] = down ? 1 : 0;
}
addEventListener('keydown', e => keyEv(e, true));
addEventListener('keyup', e => keyEv(e, false));
addEventListener('blur', () => { for (const S of [S_KB1, ...S_T, ...S_PAD]) for (const k in S.h) S.h[k] = 0; });

function pollPads() {
  const ps = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
  for (let j = 0; j < 2; j++) {
    const p = ps[j], S = S_PAD[j];
    if (!p) { for (const k in S.h) S.h[k] = 0; continue; }
    const B = i => p.buttons[i] && p.buttons[i].pressed, ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    const h = { l: B(14) || ax < -.5, r: B(15) || ax > .5, u: B(12) || ay < -.6, d: B(13) || ay > .6, p: B(2) || B(4), k: B(0) || B(5), s: B(1) || B(3) };
    for (const b in S.t) if (h[b] && !S.h[b]) S.t[b]++;
    for (const b in h) S.h[b] = h[b] ? 1 : 0;
  }
}

/* controles táctiles: joystick (aparece donde apoyás el dedo y lo sigue) + 4 botones */
const TOUCH = new Map();
function buildTouch(n) {
  const el = $('#touch');
  const dpad = pi => `<div class="joy" data-pi="${pi}"><div class="jbase"><div class="jknob"></div></div></div>`;
  const btns = pi => `<div class="btns" data-pi="${pi}"><div class="bj" data-b="u">⤒</div><div class="bs" data-b="s">⚡</div><div class="bp" data-b="p">👊</div><div class="bk" data-b="k">🦶</div></div>`;
  el.innerHTML = n === 2
    ? `<div class="pad left">${dpad(0)}${btns(0)}</div><div class="pad right">${btns(1)}${dpad(1)}</div>`
    : `<div class="pad left">${dpad(0)}</div><div class="pad right">${btns(0)}</div>`;
  el.className = 'on' + (n === 2 ? ' two' : '');
  TOUCH.clear();
}
function onTouch(e) {
  const el = $('#touch'); if (!el.classList.contains('on')) return;
  for (const t of e.changedTouches) {
    if (e.type === 'touchstart') {
      const hit = document.elementFromPoint(t.clientX, t.clientY);
      const jo = hit && hit.closest('.joy'), bt = hit && hit.closest('.btns');
      if (jo && ![...TOUCH.values()].some(m => m.joy === jo)) {
        // la base aparece debajo del dedo
        const zr = jo.getBoundingClientRect(), base = jo.querySelector('.jbase'), R = base.offsetWidth / 2;
        const m = { joy: jo, pi: +jo.dataset.pi, base, knob: base.firstChild, zr, R, cx: clamp(t.clientX, zr.left + R * .5, zr.right - R * .5), cy: clamp(t.clientY, zr.top + R * .5, zr.bottom - R * .5) };
        TOUCH.set(t.identifier, m); jo.classList.add('on'); joyPlace(m, 0, 0);
      } else if (bt) TOUCH.set(t.identifier, { joy: null, pi: +bt.dataset.pi });
    } else if (e.type === 'touchend' || e.type === 'touchcancel') {
      const m = TOUCH.get(t.identifier);
      if (m && m.joy) { m.joy.classList.remove('on'); m.base.style.left = m.base.style.top = ''; m.knob.style.transform = ''; }
      TOUCH.delete(t.identifier);
    }
  }
  const hs = [{}, {}];
  for (const t of e.touches) {
    const m = TOUCH.get(t.identifier); if (!m) continue;
    if (m.joy) {
      let dx = t.clientX - m.cx, dy = t.clientY - m.cy; const R = m.R, d = Math.hypot(dx, dy), far = R * 1.35;
      // si el dedo se va muy lejos, la base lo persigue
      if (d > far) { const k = (d - far) / d; m.cx += dx * k; m.cy += dy * k; dx = t.clientX - m.cx; dy = t.clientY - m.cy; }
      joyPlace(m, dx, dy);
      const H8 = hs[m.pi];
      if (dx > R * .3) H8.r = 1; else if (dx < -R * .3) H8.l = 1;
      if (dy < -R * .55) H8.u = 1; else if (dy > R * .45) H8.d = 1;
    } else {
      const hit = document.elementFromPoint(t.clientX, t.clientY), b = hit && hit.closest('[data-b]');
      if (b && +b.parentElement.dataset.pi === m.pi) hs[m.pi][b.dataset.b] = 1;
    }
  }
  for (let pi = 0; pi < 2; pi++) {
    const S = S_T[pi];
    for (const k in S.h) { const v = hs[pi][k] ? 1 : 0; if (v && !S.h[k] && k in S.t) S.t[k]++; S.h[k] = v; }
  }
  el.querySelectorAll('[data-b]').forEach(n => { const pi = +n.parentElement.dataset.pi; n.classList.toggle('on', !!S_T[pi].h[n.dataset.b]); });
  if (TOUCH.size || e.type === 'touchstart' && e.target.closest && e.target.closest('#touch .pad')) e.preventDefault();
}
function joyPlace(m, dx, dy) {
  m.base.style.left = (m.cx - m.zr.left) + 'px'; m.base.style.top = (m.cy - m.zr.top) + 'px';
  const d = Math.hypot(dx, dy), max = m.R * .7, k = d > max ? max / d : 1;
  m.knob.style.transform = `translate(${dx * k}px,${dy * k}px)`;
}
for (const ev of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) document.addEventListener(ev, onTouch, { passive: false });

function readSources(list) {
  const r = { h: { l: 0, r: 0, u: 0, d: 0 }, t: { p: 0, k: 0, s: 0, u: 0 } };
  for (const S of list) {
    for (const k in r.h) r.h[k] |= S.h[k];
    for (const k in S.t) { r.t[k] += S.t[k]; S.t[k] = 0; }
    if (S.h.p) r.h.p = 1; if (S.h.k) r.h.k = 1; if (S.h.s) r.h.s = 1;
  }
  if (r.t.u) r.h.u = 1; // un toque rápido de salto también cuenta
  return r;
}
const EMPTY = { h: { l: 0, r: 0, u: 0, d: 0 }, t: { p: 0, k: 0, s: 0, u: 0 } };

/* ============================ IA ============================ */
const AI_LV = { facil: { th: 26, bl: .15, ag: .35, sp: .15 }, normal: { th: 14, bl: .45, ag: .55, sp: .3 }, dificil: { th: 7, bl: .8, ag: .7, sp: .5 } };
function cpuThink(f, o, S, lv) {
  const L = AI_LV[lv] || AI_LV.normal, ai = f.ai || (f.ai = { t: 0, mv: null, def: 0, saw: false });
  const dx = o.x - f.x, dist = Math.abs(dx), tw = dx > 0 ? 'r' : 'l', aw = dx > 0 ? 'l' : 'r';
  const h = S.h; for (const k in h) h[k] = 0;
  const comingAt = q => q.o === o && Math.sign(f.x - q.x) === Math.sign(q.vx);
  const threat = ((o.st === 'attack' || (o.st === 'special' && o.spec !== 'fire')) && dist < 190)
    || G.proj.some(p => comingAt(p) && Math.abs(p.x - f.x) < 230) || G.waves.some(w => comingAt(w) && Math.abs(w.x - f.x) < 170);
  if (threat && !ai.saw) {
    ai.saw = true;
    if (Math.random() < L.bl) {
      const low = (o.st === 'attack' && o.an === 'ck') || G.waves.some(w => w.o === o);
      ai.defH = low && lv === 'dificil' && G.waves.length && Math.random() < .5 ? { u: 1, [tw]: 1 } : { [aw]: 1, d: low ? 1 : 0 };
      ai.def = ai.defH.u ? 4 : 20;
    }
  }
  if (!threat) ai.saw = false;
  if (ai.def > 0) { ai.def--; Object.assign(h, ai.defH); return; }
  if (--ai.t > 0) { if (ai.mv) Object.assign(h, ai.mv); return; }
  ai.t = L.th + (Math.random() * L.th | 0); ai.mv = null;
  const r = Math.random(), sp = f.ch.special;
  if (f.st === 'jump') { if (dist < 140) S.t.k++; ai.t = 3; return; }
  if (f.en >= SPEC_COST && Math.random() < L.sp) {
    const good = sp === 'fire' ? dist > 200 : sp === 'charge' ? dist < 400 : sp === 'slam' ? dist < 320 : true;
    if (good) { S.t.s++; return; }
  }
  if (dist > 260) { if (r < .75) ai.mv = { [tw]: 1 }; else if (r < .85) { ai.mv = { u: 1, [tw]: 1 }; ai.t = 4; } }
  else if (dist > 105) {
    if (r < L.ag) ai.mv = { [tw]: 1 };
    else if (r < L.ag + .15) { ai.mv = { u: 1, [tw]: 1 }; ai.t = 4; }
    else if (r < L.ag + .25) ai.mv = { [aw]: 1 };
    else if (r < L.ag + .32) S.t.k++;
  } else {
    if (r < .3) S.t.p++;
    else if (r < .52) S.t.k++;
    else if (r < .64) { ai.mv = { d: 1 }; S.t.k++; }
    else if (r < .74) { ai.mv = { d: 1 }; S.t.p++; }
    else if (r < .86) ai.mv = { [aw]: 1 };
    else ai.mv = { [aw]: 1, d: 1 };
  }
  if (ai.mv) Object.assign(h, ai.mv);
}

/* ========================== JUEGO ========================== */
const G = {
  mode: 'demo', phase: 'intro', pf: 0, round: 1, timer: 60, tf: 0, time: 0, f: [], proj: [], waves: [], parts: [],
  stage: 0, hitstop: 0, shake: 0, slow: 0, ann: null, combo: null, paused: false, cam: { x: 0 }, winner: -1, ev: [], src: [], lvl: 'normal', setup: null, maxD: 850
};
const P_IDLE = { t: .08, a1: .75, a2: 2.55, b1: .35, b2: 2.25, l1: .42, l2: .05, m1: -.38, m2: -.2 };
const P_CROUCH = { t: .7, a1: 1.05, a2: 2.55, b1: .75, b2: 2.35, l1: 1.35, l2: .1, m1: .55, m2: -1.25 };
const P_TUCK = { t: .1, a1: 1.0, a2: 2.4, b1: .3, b2: 1.9, l1: 1.45, l2: -.1, m1: .55, m2: -.9 };

const newSeeds = () => [Math.random() * 1e9 | 0, Math.random() * 1e9 | 0];
function mkFighter(i, sel, seed) {
  const ch = CHARS[sel.ch] || CHARS.toro;
  const f = { i, ch, key: sel.ch, name: (sel.name || '').trim() || ('Jugador ' + (i + 1)), faceUrl: sel.face || null, img: faceImg(sel.face), yaw: sel.yaw ?? yawOf(sel.face), wins: 0, maxHp: ch.hp, en: 0, hurt: 0, wt: {}, wounds: mkWounds(seed) };
  placeFighter(f); return f;
}
function placeFighter(f) {
  Object.assign(f, {
    x: STAGE_W / 2 + (f.i ? 170 : -170), y: 0, vx: 0, vy: 0, face: f.i ? -1 : 1, tx: 0, ty: 0,
    hp: f.maxHp, hpLag: f.maxHp, st: 'idle', sf: 0, atk: null, an: '', hitDone: false, stun: 0, combo: 0, flash: 0, alpha: 1, rot: 0, inv: 0,
    buf: { p: 0, k: 0, s: 0 }, pose: { ...P_IDLE }, ai: null, spec: null, slamLand: 0, crouchBlock: false, holdBack: 0, holdDown: 0, airAtk: false, en: 0
  });
  f.tx = f.x; f.ty = 0;
}
function setSt(f, st) { if (f.st !== st) { f.st = st; f.sf = 0; } }

function startMatch(setup) {
  G.setup = setup; G.mode = setup.mode; G.stage = setup.stage; G.lvl = setup.lvl || 'normal'; G.lvls = setup.lvls || null;
  const seeds = setup.seeds || newSeeds();
  G.f = [mkFighter(0, setup.sel[0], seeds[0]), mkFighter(1, setup.sel[1], seeds[1])];
  const mine = [S_KB1, S_T[0], S_PAD[0], S_PAD[1]];
  G.src = {
    demo: [[S_CPU[0]], [S_CPU[1]]], bots: [[S_CPU[0]], [S_CPU[1]]], cpu: [mine, [S_CPU[1]]],
    host: [mine, [S_NET]], guest: [[], []]
  }[G.mode];
  for (const S of [S_KB1, ...S_T, ...S_PAD, ...S_CPU, S_NET]) for (const k in S.t) S.t[k] = 0;
  G.maxD = Math.min(W, G.mode === 'host' ? NET.rW || W : W) - 110;
  G.round = 1; G.parts = []; startRound();
  if (G.mode !== 'demo') beginPlay();
}
function startRound() {
  G.f.forEach(placeFighter);
  Object.assign(G, { proj: [], waves: [], phase: 'intro', pf: 0, timer: 60, tf: 0, winner: -1, combo: null, hitstop: 0, slow: 0, ann: null });
}
function ann(text) { fx('ann', text); }
function phaseStep() {
  G.pf++;
  const [a, b] = G.f;
  if (G.phase === 'intro') {
    if (G.pf === 1) { const fin = a.wins === 1 && b.wins === 1; ann(fin ? 'RONDA FINAL' : 'RONDA ' + G.round); fx('say', fin ? 'Ronda final' : 'Ronda ' + (['uno', 'dos', 'tres', 'cuatro', 'cinco'][G.round - 1] || G.round)); }
    if (G.pf === 72) { ann('¡A PELEAR!'); fx('say', '¡A pelear!'); }
    if (G.pf >= 95) { G.phase = 'fight'; G.pf = 0; }
  } else if (G.phase === 'fight') {
    if (++G.tf >= 60) { G.tf = 0; G.timer--; if (G.timer <= 5 && G.timer > 0) fx('sfx', 'beep'); if (G.timer <= 0) { G.phase = 'time'; G.pf = 0; } }
  } else if (G.phase === 'ko' || G.phase === 'time') {
    if (G.phase === 'time' && G.pf === 1) {
      ann('¡TIEMPO!'); fx('say', 'Tiempo');
      const ra = a.hp / a.maxHp, rb = b.hp / b.maxHp;
      G.winner = Math.abs(ra - rb) < .001 ? -1 : ra > rb ? 0 : 1; if (G.winner >= 0) G.f[G.winner].wins++;
    }
    if (G.pf === 95) {
      const w = G.f[G.winner];
      if (w) { if (w.y <= 0 && w.hp > 0) setSt(w, 'win'); ann('¡GANA ' + w.name.toUpperCase() + '!'); fx('say', 'Gana ' + w.name); }
      else ann('EMPATE');
    }
    if (G.pf >= 220) {
      if (a.wins >= 2 || b.wins >= 2 || G.round >= 5) { G.phase = 'over'; G.pf = 0; fx('end'); }
      else { G.round++; startRound(); }
    }
  } else if (G.phase === 'over') {
    if (G.mode === 'demo' && G.pf > 90) startDemo();
  }
}

function fighterStep(f, o, inp) {
  f.sf++;
  if (f.flash > 0) f.flash--;
  if (f.inv > 0) f.inv--;
  for (const b of ['p', 'k', 's']) { if (inp.t[b]) f.buf[b] = 8; else if (f.buf[b] > 0) f.buf[b]--; }
  const ch = f.ch, dirO = o.x >= f.x ? 1 : -1;
  const fwd = dirO > 0 ? inp.h.r : inp.h.l, back = dirO > 0 ? inp.h.l : inp.h.r;
  f.holdBack = back; f.holdDown = inp.h.d;
  switch (f.st) {
    case 'idle': case 'walk': case 'crouch': case 'land': {
      if (f.st === 'land' && f.sf < 4) { f.vx = 0; break; }
      f.face = dirO; f.combo = 0;
      if (f.buf.s && f.en >= SPEC_COST) { f.buf.s = 0; startSpecial(f, o); break; }
      if (f.buf.p || f.buf.k) { const k = f.buf.p ? 'p' : 'k'; f.buf.p = f.buf.k = 0; startAttack(f, inp.h.d ? 'c' + k : k); break; }
      if (inp.h.u) { setSt(f, 'jump'); f.vy = ch.jump; f.y = .1; f.airAtk = false; f.vx = (fwd ? ch.speed * 1.25 : back ? -ch.speed * 1.1 : 0) * f.face; fx('sfx', 'jump'); break; }
      if (inp.h.d) { setSt(f, 'crouch'); f.vx = 0; }
      else if (fwd || back) { setSt(f, 'walk'); f.vx = (fwd ? ch.speed : -ch.speed * .75) * f.face; }
      else { setSt(f, 'idle'); f.vx = 0; }
      break;
    }
    case 'jump':
      if ((f.buf.p || f.buf.k) && !f.airAtk) { const k = f.buf.p ? 'p' : 'k'; f.buf.p = f.buf.k = 0; f.airAtk = true; startAttack(f, 'j' + k); }
      break;
    case 'attack': {
      const a = f.atk;
      if (f.sf >= a.su + a.ac + a.rc) { if (f.y > 0) setSt(f, 'jump'); else setSt(f, inp.h.d ? 'crouch' : 'idle'); }
      break;
    }
    case 'special': specialStep(f, o); break;
    case 'hit': case 'block':
      f.vx *= .86; if (--f.stun <= 0) setSt(f, inp.h.d ? 'crouch' : 'idle'); break;
    case 'down': f.vx *= .8; if (f.sf >= 38) setSt(f, 'getup'); break;
    case 'getup': f.inv = 2; f.vx = 0; if (f.sf >= 20) setSt(f, 'idle'); break;
    case 'ko': if (f.y <= 0) f.vx *= .9; break;
    case 'win': f.vx = 0; break;
  }
  f.x += f.vx;
  if (f.y > 0 || f.vy > 0) { f.y += f.vy; f.vy -= GRAV; if (f.y <= 0) { f.y = 0; f.vy = 0; onLand(f); } }
}
function onLand(f) {
  if (f.st === 'jump' || f.st === 'attack') { setSt(f, 'land'); f.vx = 0; fx('sfx', 'land'); fx('dust', f.x, 6); }
  else if (f.st === 'fall') { setSt(f, 'down'); f.vx *= .4; G.shake = Math.max(G.shake, 5); fx('dust', f.x, 14); fx('sfx', 'land'); }
  else if (f.st === 'ko') { f.vx *= .3; G.shake = Math.max(G.shake, 7); fx('dust', f.x, 18); fx('sfx', 'land'); }
  else if (f.st === 'special' && f.spec === 'slam') slamLand(f);
}
function startAttack(f, name) {
  f.atk = ATK[name]; f.an = name; f.st = 'attack'; f.sf = 0; f.hitDone = false;
  if (f.y <= 0) f.vx = 0;
  fx('sfx', 'whoosh');
}
function startSpecial(f, o) {
  f.en -= SPEC_COST; f.spec = f.ch.special; setSt(f, 'special'); f.sf = 0; f.hitDone = false; f.vx = 0; f.slamLand = 0;
  if (f.spec === 'slam') { f.vy = 11; f.y = .1; }
  fx('aura', f.x, 110 * f.ch.b.s, f.i); fx('sfx', 'power');
}
function specialStep(f, o) {
  const t = f.sf, s = f.ch.b.s;
  if (f.spec === 'fire') {
    f.vx = 0;
    if (t === 13) { G.proj.push({ x: f.x + f.face * 70 * s, y: 118 * s, vx: 8.5 * f.face, o: f, t: 0 }); fx('sfx', 'fire'); }
    if (t >= 34) setSt(f, 'idle');
  } else if (f.spec === 'charge') {
    if (t < 8) f.vx = 0;
    else if (t < 26) { f.vx = 13.5 * f.face; if (t === 8) fx('sfx', 'charge'); if (t % 3 === 0) fx('dust', f.x - f.face * 20, 4); if (f.hitDone) f.sf = 26; }
    else f.vx *= .75;
    if (t >= 40) setSt(f, 'idle');
  } else if (f.spec === 'tele') {
    f.inv = 3; f.vx = 0;
    if (t === 1) { fx('sfx', 'tele'); fx('smoke', f.x, 90 * s); }
    if (t < 14) f.alpha = 1 - t / 14;
    else if (t === 14) {
      let nx = o.x - o.face * 78; if (nx < 50 || nx > STAGE_W - 50) nx = o.x + o.face * 78;
      f.x = clamp(nx, 40, STAGE_W - 40); f.face = o.x >= f.x ? 1 : -1; fx('smoke', f.x, 90 * s);
    } else f.alpha = Math.min(1, (t - 14) / 5);
    if (t >= 19) { f.alpha = 1; f.inv = 0; startAttack(f, 'tk'); }
  } else if (f.spec === 'slam') {
    if (f.slamLand) { f.vx = 0; if (t - f.slamLand >= 22) { f.slamLand = 0; setSt(f, 'idle'); } }
    else f.vx = 0;
  }
}
function slamLand(f) {
  f.slamLand = f.sf || 1; f.vx = 0;
  const o = G.f[1 - f.i], s = f.ch.b.s;
  G.waves.push({ x: f.x + 40, vx: 7.5, o: f, life: 50, hit: false }, { x: f.x - 40, vx: -7.5, o: f, life: 50, hit: false });
  G.shake = Math.max(G.shake, 13); fx('sfx', 'slam'); fx('dust', f.x, 30);
  if (Math.abs(o.x - f.x) < 95 * s && o.y < 30 && canHurt(o)) applyHit(f, o, ATK.slam, o.x, 30);
}
function activeAtk(f) {
  if (f.hitDone) return null;
  if (f.st === 'attack') { const a = f.atk; if (f.sf >= a.su && f.sf < a.su + a.ac) return a; }
  if (f.st === 'special' && f.spec === 'charge' && f.sf >= 8 && f.sf < 26) return ATK.charge;
  return null;
}
function boxOf(f, a) {
  const s = f.ch.b.s, x1 = f.x + f.face * a.rx[0] * s, x2 = f.x + f.face * a.rx[1] * s;
  return { x1: Math.min(x1, x2), x2: Math.max(x1, x2), y1: f.y + a.ry[0] * s, y2: f.y + a.ry[1] * s };
}
function isCrouched(f) { return f.st === 'crouch' || f.st === 'land' || f.st === 'getup' || (f.st === 'attack' && f.an[0] === 'c') || (f.st === 'block' && f.crouchBlock); }
function hurtOf(f) {
  const s = f.ch.b.s, cr = isCrouched(f), hw = (cr ? 30 : 24) * s, hh = (cr ? 112 : 188) * s;
  return { x1: f.x - hw, x2: f.x + hw, y1: f.y, y2: f.y + hh };
}
const canHurt = f => f.inv <= 0 && f.alpha > .5 && !['down', 'ko', 'getup', 'win'].includes(f.st);
const overlap = (a, b) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
function canBlock(d, a) {
  if (d.y > 0 || !['idle', 'walk', 'crouch', 'block'].includes(d.st) || !d.holdBack) return false;
  if (a.lv === 'low' && !d.holdDown) return false;
  if (a.lv === 'over' && d.holdDown) return false;
  return true;
}
function applyHit(att, def, a, px, py) {
  const dir = Math.sign(def.x - att.x) || att.face;
  if (canBlock(def, a)) {
    def.st = 'block'; def.sf = 0; def.crouchBlock = !!def.holdDown; def.stun = a.bs || 12; def.vx = dir * a.push * .9;
    if (a.chip) { def.hp = Math.max(1, def.hp - a.chip); def.hurt = Math.min(1, def.hurt + a.chip / (def.maxHp * 2)); }
    def.en = Math.min(100, def.en + 3); att.en = Math.min(100, att.en + 2);
    fx('block', px, py); G.hitstop = 4; return;
  }
  let dmg = a.dmg * att.ch.power; if (def.combo > 0) dmg *= Math.max(.45, 1 - .15 * def.combo);
  dmg = Math.max(1, Math.round(dmg));
  // hurt: daño de toda la pelea; perder dos barras enteras = cara destrozada
  def.hurt = Math.min(1, def.hurt + Math.min(dmg, def.hp) / (def.maxHp * 2));
  def.hp = Math.max(0, def.hp - dmg); def.combo++; def.flash = 12; def.atk = null; def.alpha = 1; def.slamLand = 0;
  att.en = Math.min(100, att.en + 7); def.en = Math.min(100, def.en + 5);
  if (def.combo >= 2) G.combo = { i: att.i, n: def.combo, t: 80 };
  const heavy = dmg >= 10 || !!a.knock;
  if (def.hp <= 0) {
    def.st = 'ko'; def.sf = 0; def.vy = 9; def.y = Math.max(def.y, .1); def.vx = dir * 5; def.inv = 9999;
    att.wins++; G.winner = att.i; G.phase = 'ko'; G.pf = 0; G.slow = 70;
    fx('hit', px, py, 1); fx('sfx', 'ko'); fx('shake', 18); ann('K.O.'); fx('say', 'K O'); G.hitstop = 22; return;
  }
  if (a.knock || def.y > 0) { def.st = 'fall'; def.sf = 0; def.vy = a.launch || 6; def.y = Math.max(def.y, .1); def.vx = dir * (a.push * .8 + 1.5); }
  else { def.st = 'hit'; def.sf = 0; def.stun = a.st; def.vx = dir * a.push; }
  fx('hit', px, py, heavy ? 1 : 0); fx('shake', heavy ? 9 : 4);
  G.hitstop = heavy ? 8 : 5;
}
function combat() {
  const hits = [];
  for (let i = 0; i < 2; i++) {
    const f = G.f[i], o = G.f[1 - i], a = activeAtk(f);
    if (!a || !canHurt(o)) continue;
    const hb = boxOf(f, a), hu = hurtOf(o);
    if (overlap(hb, hu)) hits.push([f, o, a, f.face > 0 ? Math.min(hb.x2, hu.x2) : Math.max(hb.x1, hu.x1), (Math.max(hb.y1, hu.y1) + Math.min(hb.y2, hu.y2)) / 2]);
  }
  for (const [f, o, a, px, py] of hits) { f.hitDone = true; if (G.phase !== 'ko' || o.hp > 0) applyHit(f, o, a, px, py); }
  // bolas de energía
  for (const p of G.proj) {
    p.x += p.vx; p.t++;
    const d = G.f[1 - p.o.i];
    if (!p.dead && canHurt(d)) { const hu = hurtOf(d); if (p.x + 18 > hu.x1 && p.x - 18 < hu.x2 && p.y + 18 > hu.y1 && p.y - 18 < hu.y2) { p.dead = true; applyHit(p.o, d, ATK.fire, p.x, p.y); } }
    if (Math.abs(p.x - (G.cam.x + W / 2)) > W) p.dead = true;
  }
  for (const p of G.proj) for (const q of G.proj) if (p !== q && p.o !== q.o && !p.dead && !q.dead && Math.abs(p.x - q.x) < 30) { p.dead = q.dead = true; fx('hit', (p.x + q.x) / 2, p.y, 1); }
  G.proj = G.proj.filter(p => !p.dead);
  // ondas del golpe al suelo
  for (const w of G.waves) {
    w.x += w.vx; w.life--;
    const d = G.f[1 - w.o.i];
    if (!w.hit && canHurt(d) && d.y < 25 && Math.abs(d.x - w.x) < 34) { w.hit = true; w.life = Math.min(w.life, 8); applyHit(w.o, d, ATK.wave, w.x, 20); }
  }
  G.waves = G.waves.filter(w => w.life > 0);
}
function separate() {
  const [a, b] = G.f;
  if (Math.abs(a.y - b.y) > 95 || ['down', 'ko'].includes(a.st) || ['down', 'ko'].includes(b.st)) return;
  const min = (24 * a.ch.b.s + 24 * b.ch.b.s) * .92, dx = b.x - a.x;
  if (Math.abs(dx) < min) { const d = dx > 0 ? 1 : dx < 0 ? -1 : a.face, push = (min - Math.abs(dx)) / 2; a.x -= d * push; b.x += d * push; }
}
function bounds() {
  const [a, b] = G.f, d = b.x - a.x;
  if (Math.abs(d) > G.maxD) { const ex = (Math.abs(d) - G.maxD) / 2 * Math.sign(d); a.x += ex; b.x -= ex; }
  for (const f of G.f) f.x = clamp(f.x, 40, STAGE_W - 40);
  camFollow();
}
function camFollow() { const [a, b] = G.f; G.cam.x = clamp((a.x + b.x) / 2 - W / 2, 0, STAGE_W - W); }

/* ------------------------- poses ------------------------- */
function attackPose(f) {
  const a = f.atk, t = f.sf, n = f.an, ph = t < a.su ? 0 : t < a.su + a.ac ? 1 : 2;
  const base = n[0] === 'c' ? P_CROUCH : n[0] === 'j' ? P_TUCK : P_IDLE;
  const P = {
    p: [{ a1: .5, a2: 2.9, t: .02 }, { a1: 1.57, a2: 1.57, t: .3, b1: .45, b2: 2.6 }, { a1: 1.1, a2: 2.0, t: .15 }],
    k: [{ l1: 1.3, l2: -.3, t: -.1, m1: -.12, m2: -.05 }, { l1: 1.6, l2: 1.62, t: -.4, m1: -.1, m2: -.05, a1: .3, a2: 1.8, b1: -.4, b2: 1.2 }, { l1: 1.0, l2: .2, m1: -.15, m2: -.05 }],
    cp: [{ a1: .9, a2: 2.9 }, { a1: 1.6, a2: 1.65, t: .8 }, { a1: 1.2, a2: 2.2 }],
    ck: [{ l1: 1.25, l2: .6 }, { t: .55, l1: 1.52, l2: 1.56, m1: .75, m2: -1.35, a1: .4, a2: 1.0, b1: -.2, b2: .2 }, { l1: 1.4, l2: .9 }],
    jp: [{ a1: .7, a2: 2.7 }, { a1: 1.25, a2: 1.0, t: .25 }, { a1: 1.0, a2: 1.8 }],
    jk: [{ l1: 1.2, l2: .1 }, { l1: 1.05, l2: 1.1, m1: .4, m2: -.9, t: -.25 }, { l1: 1.1, l2: .5 }],
    tk: [{ l1: 1.6, l2: .2, t: -.2, m1: -.1, m2: 0 }, { l1: 2.0, l2: 2.1, t: -.6, m1: -.05, m2: 0, a1: .2, a2: 1.4, b1: -.6, b2: .8 }, { l1: 1.2, l2: .3, m1: -.1, m2: 0 }]
  }[n] || [{}, {}, {}];
  return { ...base, ...P[ph] };
}
function specialPose(f) {
  const t = f.sf;
  switch (f.spec) {
    case 'fire': return t < 13 ? { t: -.15, a1: -.7, a2: .5, b1: -.8, b2: .4, l1: .6, l2: .1, m1: -.55, m2: -.3 } : { t: .3, a1: 1.55, a2: 1.6, b1: 1.45, b2: 1.62, l1: .62, l2: .1, m1: -.55, m2: -.3 };
    case 'charge': {
      if (t < 8) return { t: .4, a1: .6, a2: 2.4, b1: .2, b2: 2.0, l1: .8, l2: .1, m1: -.4, m2: -.6 };
      const s = Math.sin(t * .9);
      return { t: .75, a1: 1.3, a2: 2.2, b1: -.3, b2: .6, l1: .4 + .7 * s, l2: .4 * s - .3, m1: .4 - .7 * s, m2: -.4 * s - .3 };
    }
    case 'slam': return f.slamLand ? { ...P_CROUCH, t: .85, a1: .9, a2: .5, b1: .7, b2: .4 } : { ...P_TUCK, t: -.1, a1: 2.9, a2: 3.05, b1: 2.8, b2: 3.0 };
    default: return { ...P_IDLE, a1: 1.2, a2: 2.85, b1: 1.0, b2: 2.95 };
  }
}
function targetPose(f) {
  const T = G.time;
  switch (f.st) {
    case 'idle': { const br = Math.sin(T * .08 + f.i) * .05; return { ...P_IDLE, a2: P_IDLE.a2 + br, b2: P_IDLE.b2 + br, t: P_IDLE.t + br * .5 }; }
    case 'walk': {
      const ph = T * .22 * (Math.sign(f.vx) * f.face || 1), s1 = Math.sin(ph), c1 = Math.cos(ph);
      return { ...P_IDLE, l1: .05 + .45 * s1, l2: .05 + .45 * s1 - .4 * Math.max(0, c1), m1: .05 - .45 * s1, m2: .05 - .45 * s1 - .4 * Math.max(0, -c1) };
    }
    case 'crouch': case 'land': case 'getup': return P_CROUCH;
    case 'jump': return f.vy > 3 ? P_TUCK : { t: .05, a1: .9, a2: 2.0, b1: .1, b2: 1.5, l1: .7, l2: .2, m1: -.2, m2: -.5 };
    case 'attack': return f.atk ? attackPose(f) : P_IDLE;
    case 'special': return specialPose(f);
    case 'block': return f.crouchBlock ? { ...P_CROUCH, t: .55, a1: 1.6, a2: 3.0, b1: 1.3, b2: 2.9 } : { ...P_IDLE, t: -.1, a1: 1.4, a2: 3.05, b1: 1.15, b2: 2.95 };
    case 'hit': return { t: -.45, a1: .2, a2: 1.0, b1: -.5, b2: .2, l1: .5, l2: .2, m1: -.3, m2: -.3 };
    case 'fall': case 'ko': case 'down':
      return f.y > 2 ? { t: -.5, a1: 2.4, a2: 2.8, b1: -2.2, b2: -1.6, l1: 1.1, l2: .6, m1: .6, m2: .1 } : { t: 0, a1: .6, a2: .9, b1: -.6, b2: -.4, l1: .15, l2: .05, m1: -.1, m2: -.05 };
    case 'win': { const w = Math.sin(T * .15); return { t: -.05, a1: 2.9 + w * .15, a2: 3.1, b1: 2.7 - w * .15, b2: 3.0, l1: .25, l2: .05, m1: -.25, m2: -.05 }; }
  }
  return P_IDLE;
}
function poseStep(f) {
  const tp = targetPose(f), k = f.st === 'attack' || f.st === 'special' || f.st === 'hit' ? .5 : .28;
  for (const key in tp) f.pose[key] = lerp(f.pose[key] ?? tp[key], tp[key], k);
  const rt = (f.st === 'down' || f.st === 'ko') && f.y <= 2 ? -1.57 : (f.st === 'fall' || f.st === 'ko') ? -.8 : 0;
  f.rot = lerp(f.rot, rt, .2);
  f.hpLag = f.hpLag > f.hp ? Math.max(f.hp, f.hpLag - .4) : f.hp;
}

/* ------------------------- efectos ------------------------- */
function fx(type, a, b, c) { runFx(type, a, b, c); if (G.mode === 'host') G.ev.push([type, a, b, c]); }
function runFx(type, a, b, c) {
  switch (type) {
    case 'hit': sparks(a, b, c ? 22 : 12, c ? '#fff3a0' : '#ffffff', c ? 9 : 6); G.parts.push({ ring: 1, x: a, y: b, l: 12, L: 12, c: c ? '#ffd23f' : '#fff', r: c ? 50 : 30 }); SFX.hit(c); break;
    case 'block': sparks(a, b, 8, '#8fd3ff', 5); G.parts.push({ ring: 1, x: a, y: b, l: 9, L: 9, c: '#8fd3ff', r: 26 }); SFX.block(); break;
    case 'sfx': if (SFX[a]) SFX[a](); break;
    case 'ann': G.ann = { text: a, t: 0 }; break;
    case 'say': speak(a); break;
    case 'shake': G.shake = Math.max(G.shake, a); break;
    case 'dust': for (let i = 0; i < (b || 8); i++) G.parts.push({ x: a + rnd(-20, 20), y: rnd(0, 10), vx: rnd(-2.5, 2.5), vy: rnd(.5, 3), l: 22, L: 22, c: 'rgba(220,200,170,.8)', r: rnd(4, 9), g: -.05, dust: 1 }); break;
    case 'smoke': for (let i = 0; i < 18; i++) G.parts.push({ x: a + rnd(-30, 30), y: b + rnd(-70, 70), vx: rnd(-1.5, 1.5), vy: rnd(-.5, 1.5), l: 28, L: 28, c: 'rgba(140,90,220,.7)', r: rnd(8, 18), g: 0, dust: 1 }); break;
    case 'aura': sparks(G.f[b] ? G.f[b].x : a, 110, 16, '#d07bff', 6); G.parts.push({ ring: 1, x: G.f[b] ? G.f[b].x : a, y: 100, l: 16, L: 16, c: '#d07bff', r: 90 }); break;
    case 'end': if (G.mode !== 'demo') setTimeout(showEnd, 300); break;
  }
}
function sparks(x, y, n, col, spd) {
  for (let i = 0; i < n; i++) { const an = Math.random() * Math.PI * 2, v = rnd(.3, 1) * spd; G.parts.push({ x, y, vx: Math.cos(an) * v, vy: Math.sin(an) * v, l: rnd(10, 20), L: 20, c: col, r: rnd(2, 4.5), g: .25, spark: 1 }); }
}
function partsStep() {
  for (const p of G.parts) { p.l--; if (!p.ring) { p.x += p.vx; p.y += p.vy; p.vy -= p.g; if (p.spark) { p.vx *= .92; } } }
  G.parts = G.parts.filter(p => p.l > 0);
  if (G.parts.length > 400) G.parts.splice(0, G.parts.length - 400);
}

/* ------------------------- paso de simulación ------------------------- */
function step() {
  G.time++;
  pollPads();
  if (G.ann) G.ann.t++;
  if (G.combo && --G.combo.t <= 0) G.combo = null;
  partsStep();
  if (G.mode === 'guest') { guestStep(); return; }
  if (G.paused) return;
  if (G.hitstop > 0) { G.hitstop--; return; }
  if (G.slow > 0) { G.slow--; if (G.slow % 2) return; }
  phaseStep();
  if (G.phase === 'over' && G.mode !== 'demo') { G.f.forEach(poseStep); return; }
  const live = G.phase === 'fight';
  G.f.forEach((f, i) => { if (G.src[i][0] === S_CPU[i] && live) cpuThink(f, G.f[1 - i], S_CPU[i], G.mode === 'demo' ? 'normal' : G.lvls ? G.lvls[i] : G.lvl); });
  const ins = G.f.map((f, i) => { const r = readSources(G.src[i]); return live ? r : EMPTY; });
  G.f.forEach((f, i) => fighterStep(f, G.f[1 - i], ins[i]));
  combat(); separate(); bounds();
  G.f.forEach(poseStep);
  if (G.mode === 'host' && G.time % 2 === 0) netSend(snapshot());
  touchReady();
}
let lastReady = '';
function touchReady() {
  if (!$('#touch').classList.contains('on')) return;
  const me = G.mode === 'guest' ? [G.f[1]] : [G.f[0]];
  const key = me.map(f => f && f.en >= SPEC_COST ? 1 : 0).join('');
  if (key === lastReady) return; lastReady = key;
  document.querySelectorAll('#touch .btns').forEach(b => { const pi = +b.dataset.pi; b.querySelector('.bs').classList.toggle('ready', key[pi] === '1'); });
}

/* =========================== DIBUJO =========================== */
const SEG = { T: 38, S: 38, U: 30, F: 28 };
function drawFighter(c, f, sx, sy, sc = 1) {
  const ch = f.ch, B = ch.b, C = ch.c, P = f.pose, s = B.s * sc, OL = C.line, lw = B.limb, D = C.dark, T = G.time;
  c.save(); c.translate(sx, sy); c.globalAlpha = f.alpha;
  if (f.rot) c.translate(0, -16 * Math.min(1, Math.abs(f.rot) / 1.57) * s);
  c.scale(f.face * s, s); c.rotate(f.rot);
  const hipH = Math.max(Math.cos(P.l1) * SEG.T + Math.cos(P.l2) * SEG.S, Math.cos(P.m1) * SEG.T + Math.cos(P.m2) * SEG.S);
  const hx = 0, hy = -hipH, L = B.torso;
  const ux = Math.sin(P.t), uy = -Math.cos(P.t), px = Math.cos(P.t), py = Math.sin(P.t);
  const nx = hx + ux * L, ny = hy + uy * L, shx = lerp(nx, hx, .14), shy = lerp(ny, hy, .14);
  const seg = (x, y, a, len) => [x + Math.sin(a) * len, y + Math.cos(a) * len];
  const [fkx, fky] = seg(hx, hy, P.l1, SEG.T), [ffx, ffy] = seg(fkx, fky, P.l2, SEG.S);
  const [bkx, bky] = seg(hx, hy, P.m1, SEG.T), [bfx, bfy] = seg(bkx, bky, P.m2, SEG.S);
  const [fex, fey] = seg(shx, shy, P.a1, SEG.U), [fhx, fhy] = seg(fex, fey, P.a2, SEG.F);
  const [bex, bey] = seg(shx, shy, P.b1, SEG.U), [bhx, bhy] = seg(bex, bey, P.b2, SEG.F);
  c.lineCap = 'round'; c.lineJoin = 'round';
  const limb = (x1, y1, x2, y2, w, col) => { c.strokeStyle = OL; c.lineWidth = w + 5; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); };
  const ball = (x, y, r, col) => { c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = col; c.fill(); c.lineWidth = 2.5; c.strokeStyle = OL; c.stroke(); };
  const shoe = (x, y, a, col) => { c.save(); c.translate(x, y); c.rotate(-a); c.beginPath(); c.ellipse(6, 0, 12, lw * .45, 0, 0, 7); c.fillStyle = col; c.fill(); c.lineWidth = 2.5; c.strokeStyle = OL; c.stroke(); c.restore(); };
  const glove = ch.special === 'charge' ? lw * 1.05 : lw * .82;
  // bufanda del ninja (atrás de todo)
  if (C.scarf) {
    c.strokeStyle = C.scarf; c.lineWidth = 7; c.beginPath(); c.moveTo(nx, ny + 4);
    for (let k = 1; k <= 4; k++) c.lineTo(nx - k * 15, ny + 4 + k * 4 + Math.sin(T * .25 + k) * 5); c.stroke();
  }
  // brazo y pierna de atrás
  limb(shx, shy, bex, bey, lw, D.arm); limb(bex, bey, bhx, bhy, lw * .92, D.arm); ball(bhx, bhy, glove, D.glove);
  limb(hx, hy, bkx, bky, lw * 1.15, D.pants); limb(bkx, bky, bfx, bfy, lw, D.pants); shoe(bfx, bfy, P.m2, D.shoe);
  // torso
  c.beginPath();
  c.moveTo(hx + px * B.ww, hy + py * B.ww); c.lineTo(nx + px * B.tw, ny + py * B.tw + 6);
  c.quadraticCurveTo(nx, ny - 6, nx - px * B.tw, ny - py * B.tw + 6); c.lineTo(hx - px * B.ww, hy - py * B.ww); c.closePath();
  c.fillStyle = C.shirt; c.fill();
  if (C.camo) { c.save(); c.clip(); c.fillStyle = C.camo; for (let k = 0; k < 6; k++) { c.beginPath(); c.ellipse(hx + ux * L * (k / 6) + px * ((k % 3) - 1) * 12, hy + uy * L * (k / 6) + py * ((k % 3) - 1) * 12, 10, 6, k, 0, 7); c.fill(); } c.restore(); }
  if (ch.special === 'fire') { // rayo en el pecho
    const mx = lerp(hx, nx, .55), my = lerp(hy, ny, .55);
    c.save(); c.translate(mx, my); c.rotate(P.t); c.fillStyle = '#1f4fd0';
    c.beginPath(); c.moveTo(4, -16); c.lineTo(-8, 2); c.lineTo(0, 2); c.lineTo(-4, 16); c.lineTo(9, -3); c.lineTo(1, -3); c.closePath(); c.fill(); c.restore();
  }
  if (ch.special === 'charge') { // musculosa: hombros al aire
    c.fillStyle = C.arm; c.beginPath(); c.arc(shx, shy + 2, lw * .7, 0, 7); c.fill();
  }
  c.lineWidth = 4; c.strokeStyle = OL; c.stroke();
  c.beginPath(); c.moveTo(hx + px * B.ww * 1.05, hy + py * B.ww * 1.05 - uy * 3); c.lineTo(hx - px * B.ww * 1.05, hy - py * B.ww * 1.05 - uy * 3);
  c.lineWidth = ch.special === 'charge' ? 10 : 7; c.strokeStyle = C.belt; c.stroke();
  // pierna de adelante
  limb(hx, hy, fkx, fky, lw * 1.15, C.pants); limb(fkx, fky, ffx, ffy, lw, C.pants); shoe(ffx, ffy, P.l2, C.shoe);
  // cuello y cara
  const R = 31, hcx = nx + ux * R * .78, hcy = ny + uy * R * .78;
  limb(nx, ny + 4, lerp(nx, hcx, .5), lerp(ny, hcy, .5), lw * .9, C.neck);
  c.save(); c.translate(hcx, hcy); c.scale(f.face, 1); c.rotate(f.face * P.t * .45);
  if (f.flash > 0) { const q = Math.sin(f.flash * 1.3) * .12; c.scale(1 + q, 1 - q); }
  drawFace(c, f.img, R, RING[f.i] || '#fff', f.flash, f.face, f.yaw, f);
  if ((f.st === 'ko' || f.st === 'down') && f.y <= 2) { // estrellitas mareado
    for (let k = 0; k < 3; k++) {
      const a = T * .12 + k * 2.09, sx = Math.cos(a) * R * 1.1, sy = -R * .9 + Math.sin(a) * R * .3;
      c.save(); c.translate(sx, sy); c.rotate(a); c.fillStyle = k % 2 ? '#fff3a0' : '#ffc83d'; c.beginPath();
      for (let p = 0; p < 10; p++) { const rr2 = p % 2 ? 4 : 10, aa = p * Math.PI / 5; c.lineTo(Math.cos(aa) * rr2, Math.sin(aa) * rr2); }
      c.fill(); c.restore();
    }
  }
  c.restore();
  // brazo de adelante
  limb(shx, shy, fex, fey, lw, C.arm); limb(fex, fey, fhx, fhy, lw * .92, C.arm); ball(fhx, fhy, glove, C.glove);
  // bola cargándose en las manos
  if (f.st === 'special' && f.spec === 'fire' && f.sf < 14) { c.globalAlpha = f.alpha * .9; glow(c, (fhx + bhx) / 2, (fhy + bhy) / 2, 10 + f.sf * 1.6, 'rgba(120,220,255,.9)'); }
  c.restore();
}
function drawShadow(c, f, cx) {
  const s = f.ch.b.s, k = 1 - Math.min(.6, f.y / 300);
  c.fillStyle = `rgba(0,0,0,${.32 * k * f.alpha})`; c.beginPath(); c.ellipse(f.x - cx, GROUND + 3, (f.rot < -1 ? 70 : 40) * s * k, 9 * k, 0, 0, 7); c.fill();
}
function render() {
  const c = ctx;
  c.setTransform(RK, 0, 0, RK, 0, 0);
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  G.shake *= .88;
  const sh = G.shake > .6 ? G.shake : 0;
  c.save(); if (sh) c.translate(rnd(-sh, sh), rnd(-sh, sh) * .6);
  const cx = G.cam.x;
  drawStage(c, G.stage, cx, G.time);
  if (!G.f.length) { c.restore(); return; }
  for (const f of G.f) drawShadow(c, f, cx);
  for (const w of G.waves) {
    const a = Math.min(1, w.life / 15), x = w.x - cx;
    c.globalAlpha = a; c.fillStyle = '#c98b4a'; c.beginPath(); c.ellipse(x, GROUND, 26, 34, 0, Math.PI, 0); c.fill();
    c.fillStyle = '#ffd08a'; c.beginPath(); c.ellipse(x, GROUND, 14, 22, 0, Math.PI, 0); c.fill();
    c.fillStyle = '#6b4a2a'; for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(x + (k - 1.5) * 12, GROUND - 30 - Math.abs(Math.sin(w.life * .5 + k)) * 18, 5, 0, 7); c.fill(); }
    c.globalAlpha = 1;
  }
  const order = [...G.f].sort((a, b) => (a.st === 'attack' || a.st === 'special' ? 1 : 0) - (b.st === 'attack' || b.st === 'special' ? 1 : 0));
  for (const f of order) {
    if (f.st === 'special' && f.spec === 'charge' && f.sf >= 8 && f.sf < 26) {
      const al = f.alpha; for (let k = 2; k >= 1; k--) { f.alpha = .18 * k; drawFighter(c, f, f.x - cx - f.face * 26 * k, GROUND - f.y); } f.alpha = al;
    }
    drawFighter(c, f, f.x - cx, GROUND - f.y);
  }
  for (const p of G.proj) {
    const x = p.x - cx, y = GROUND - p.y, d = Math.sign(p.vx);
    for (let k = 4; k >= 1; k--) { c.globalAlpha = .15 * (5 - k); glow(c, x - d * k * 14, y, 22 - k * 2, 'rgba(80,190,255,.9)'); }
    c.globalAlpha = 1; glow(c, x, y, 50, 'rgba(120,220,255,.95)');
    c.fillStyle = '#4ad1ff'; c.beginPath(); c.arc(x, y, 20 + Math.sin(G.time * .6) * 2, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, 12 + Math.sin(G.time * .6) * 2, 0, 7); c.fill();
    c.strokeStyle = '#bff3ff'; c.lineWidth = 2; c.beginPath();
    for (let k = 0; k < 3; k++) { const an = G.time * .4 + k * 2.1; c.moveTo(x, y); c.lineTo(x + Math.cos(an) * 24, y + Math.sin(an) * 24); } c.stroke();
  }
  for (const p of G.parts) {
    const x = p.x - cx, y = GROUND - p.y, k = p.l / p.L;
    if (p.ring) { c.globalAlpha = k; c.strokeStyle = p.c; c.lineWidth = 4 * k + 1; c.beginPath(); c.arc(x, y, p.r * (1.2 - k), 0, 7); c.stroke(); }
    else { c.globalAlpha = p.dust ? k * .8 : Math.min(1, k * 1.5); c.fillStyle = p.c; c.beginPath(); c.arc(x, y, p.dust ? p.r * (1.6 - k) : p.r, 0, 7); c.fill(); }
  }
  c.globalAlpha = 1;
  c.restore();
  if (G.mode === 'demo') { c.fillStyle = 'rgba(10,4,14,.45)'; c.fillRect(0, 0, W, H); return; }
  drawHUD(c);
  if (G.ann && G.ann.t < 85) drawAnn(c);
  if (G.paused) { c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(0, 0, W, H); }
}
function rr(c, x, y, w, h, r) { c.beginPath(); if (w > 0) c.roundRect(x, y, w, h, Math.min(r, w / 2)); }
function drawHUD(c) {
  const bw = Math.min(390, W / 2 - 120), y = 26, bh = 22;
  G.f.forEach((f, i) => {
    const right = i === 1, x = right ? W / 2 + 52 : W / 2 - 52 - bw;
    rr(c, x - 3, y - 3, bw + 6, bh + 6, 7); c.fillStyle = '#000000b0'; c.fill();
    const hp = f.hp / f.maxHp, lag = f.hpLag / f.maxHp;
    const seg = (frac, col) => { const w = bw * frac; rr(c, right ? x + bw - w : x, y, w, bh, 5); c.fillStyle = col; c.fill(); };
    seg(lag, '#ff3b2f');
    const g = c.createLinearGradient(0, y, 0, y + bh); g.addColorStop(0, hp > .3 ? '#ffe45c' : '#ff9a3c'); g.addColorStop(1, hp > .3 ? '#f2a516' : '#e2441b');
    seg(hp, g);
    c.fillStyle = '#ffffff40'; c.fillRect(x, y + 2, bw, 4);
    // energía
    const ew = bw * .62, ex = right ? x + bw - ew : x, ey = y + bh + 7, en = f.en / 100, ready = f.en >= SPEC_COST;
    rr(c, ex - 2, ey - 2, ew + 4, 12, 5); c.fillStyle = '#000000a0'; c.fill();
    rr(c, right ? ex + ew - ew * en : ex, ey, ew * en, 8, 4); c.fillStyle = ready ? (G.time % 30 < 15 ? '#e19bff' : '#b85cff') : '#7a4ab0'; c.fill();
    c.fillStyle = '#ffffff70'; c.fillRect(ex + ew / 2 - 1, ey, 2, 8);
    c.font = '900 13px system-ui,sans-serif'; c.textBaseline = 'middle'; c.textAlign = right ? 'right' : 'left';
    if (ready) { c.fillStyle = '#f1d4ff'; c.fillText('⚡ HABILIDAD', right ? ex - 8 - ew : ex + ew + 8, ey + 4); }
    // nombre
    c.font = '900 17px system-ui,sans-serif'; c.textAlign = right ? 'right' : 'left';
    c.lineWidth = 4; c.strokeStyle = '#000'; const nm = f.name.toUpperCase(), nx2 = right ? x + bw : x;
    c.strokeText(nm, nx2, y + bh + 30); c.fillStyle = '#fff'; c.fillText(nm, nx2, y + bh + 30);
    // rondas ganadas
    for (let k = 0; k < 2; k++) {
      const sx = right ? x + 14 + k * 22 : x + bw - 14 - k * 22, sy = y + bh + 30;
      c.beginPath(); c.arc(sx, sy, 7, 0, 7); c.fillStyle = k < f.wins ? '#ffc83d' : '#00000080'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#fff8'; c.stroke();
    }
    // carita
    c.save(); c.translate(right ? x + bw + 36 : x - 36, y + 14); drawFace(c, f.img, 27, RING[i], f.flash, i ? -1 : 1, f.yaw, f); c.restore();
  });
  // reloj
  c.save(); c.translate(W / 2, y + 12);
  c.beginPath(); c.arc(0, 0, 30, 0, 7); c.fillStyle = '#000000c0'; c.fill(); c.lineWidth = 3; c.strokeStyle = G.timer <= 10 ? '#ff4d3a' : '#ffc83d'; c.stroke();
  c.font = '900 28px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.fillText(Math.max(0, G.timer), 0, 2);
  c.restore();
  if (G.combo && G.combo.n >= 2) {
    const right = G.combo.i === 1, k = Math.min(1, G.combo.t / 20);
    c.save(); c.globalAlpha = k; c.font = '900 34px system-ui,sans-serif'; c.textAlign = right ? 'right' : 'left'; c.textBaseline = 'middle';
    const x = right ? W - 30 : 30, yy = 150;
    c.lineWidth = 6; c.strokeStyle = '#000'; c.strokeText(G.combo.n + ' GOLPES', x, yy); c.fillStyle = '#ffc83d'; c.fillText(G.combo.n + ' GOLPES', x, yy);
    c.restore();
  }
}
function drawAnn(c) {
  const t = G.ann.t, s = t < 10 ? 2.4 - 1.4 * (t / 10) : 1, a = t > 70 ? (85 - t) / 15 : 1;
  c.save(); c.globalAlpha = Math.max(0, a); c.translate(W / 2, H * .42); c.scale(s, s);
  const txt = G.ann.text, fs = txt.length > 12 ? 52 : 80;
  c.font = `900 ${fs}px system-ui,sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineWidth = 12; c.strokeStyle = '#3a0905'; c.strokeText(txt, 0, 0);
  const g = c.createLinearGradient(0, -fs / 2, 0, fs / 2); g.addColorStop(0, '#fff3a0'); g.addColorStop(.5, '#ffc83d'); g.addColorStop(1, '#ff7a1a');
  c.fillStyle = g; c.fillText(txt, 0, 0);
  c.restore();
}

/* =========================== EN LÍNEA =========================== */
const PFX = 'kdcpy26-';
const NET = { peer: null, conn: null, role: null, code: '', rsel: null, rW: 0, cnt: { p: 0, k: 0, s: 0, u: 0 }, last: { p: 0, k: 0, s: 0, u: 0 }, mask: -1, hello: 0 };
function mkPeer(id) {
  const o = {
    debug: 1, config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' },
        { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' }
      ]
    }
  };
  return id ? new Peer(id, o) : new Peer(o);
}
function genCode() { const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 5; i++) s += A[Math.random() * A.length | 0]; return s; }
const oMsg = t => $('#oMsg').textContent = t;
function netSend(m) { try { if (NET.conn && NET.conn.open) NET.conn.send(m); } catch (e) { } }
function netClose() {
  const c = NET.conn, p = NET.peer;
  Object.assign(NET, { peer: null, conn: null, role: null, rsel: null, mask: -1 });
  try { c && c.close(); } catch (e) { } try { p && p.destroy(); } catch (e) { }
}
function netHost() {
  if (typeof Peer === 'undefined') { oMsg('No se pudo cargar la conexión en línea.'); return; }
  netClose(); NET.role = 'host'; NET.code = genCode();
  const p = NET.peer = mkPeer(PFX + NET.code); oMsg('Creando sala…');
  p.on('open', () => { if (NET.peer !== p) return; $('#onA').style.display = 'none'; $('#onB').style.display = 'block'; $('#oShow').textContent = NET.code; oMsg('Esperando que tu amigo entre…'); });
  p.on('connection', c => {
    if (NET.conn && NET.conn.open) { c.on('open', () => { c.send({ t: 'full' }); setTimeout(() => c.close(), 500); }); return; }
    bindConn(c);
  });
  p.on('error', e => { if (NET.peer !== p) return; if (e.type === 'unavailable-id') { netHost(); return; } oMsg('Error de conexión (' + e.type + '). Probá de nuevo.'); });
  p.on('disconnected', () => { try { if (NET.peer === p) p.reconnect(); } catch (e) { } });
}
function netJoin(code) {
  if (typeof Peer === 'undefined') { oMsg('No se pudo cargar la conexión en línea.'); return; }
  code = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length < 5) { oMsg('El código tiene 5 letras.'); return; }
  netClose(); NET.role = 'guest'; NET.code = code; oMsg('Conectando a la sala ' + code + '…');
  const p = NET.peer = mkPeer();
  p.on('open', () => {
    const c = p.connect(PFX + code, { reliable: true, serialization: 'json' }); bindConn(c);
    setTimeout(() => { if (NET.peer === p && !(NET.conn && NET.conn.open)) oMsg('No se encontró la sala ' + code + '. Revisá el código.'); }, 10000);
  });
  p.on('error', e => { if (NET.peer !== p) return; oMsg(e.type === 'peer-unavailable' ? 'No existe la sala ' + code + '. Revisá el código.' : 'Error de conexión (' + e.type + ').'); });
}
function bindConn(c) {
  c.on('open', () => { NET.conn = c; NET.rx = performance.now(); NET.last = { p: 0, k: 0, s: 0, u: 0 }; NET.cnt = { p: 0, k: 0, s: 0, u: 0 }; sendHello(); $('#scrOnline').classList.remove('on'); openSelect(NET.role); toast('✅ ¡Conectados! Elijan sus peleadores.'); });
  c.on('data', onNet);
  c.on('close', () => { if (NET.conn === c) netLost(); });
  c.on('error', () => { });
}
function sendHello() { const d = SEL[0]; netSend({ t: 'hello', sel: { name: d.name, ch: d.ch, face: d.face, yaw: yawOf(d.face) }, W }); }
function helloSoon() { clearTimeout(NET.hello); NET.hello = setTimeout(sendHello, 250); }
function netLost() {
  if (!NET.role) return;
  toast('🔌 Se cortó la conexión con tu amigo.', 4500); netClose(); goMenu();
}
// si el otro cierra la pestaña WebRTC a veces no avisa: nos mandamos un ping cada 2 s y cortamos a los 10 s de silencio
setInterval(() => {
  if (!NET.role || !(NET.conn && NET.conn.open)) return;
  netSend({ t: 'ping' });
  if (performance.now() - NET.rx > 12000) netLost();
}, 2000);
addEventListener('pagehide', () => netSend({ t: 'bye' }));
function onNet(m) {
  NET.rx = performance.now();
  if (!m || !m.t) return;
  switch (m.t) {
    case 'hello': NET.rsel = m.sel; NET.rW = m.W || 960; if ($('#scrSelect').classList.contains('on')) renderSelect(); break;
    case 'full': oMsg('Esa sala ya tiene dos jugadores.'); netClose(); break;
    case 'start': if (NET.role === 'guest' && NET.rsel) { hideScreens(); startMatch({ mode: 'guest', sel: [NET.rsel, SEL[0]], stage: m.stage, seeds: m.seeds }); } break;
    case 'sel': if (NET.role === 'guest') openSelect('guest'); break;
    case 's': if (G.mode === 'guest') applySnap(m); break;
    case 'in':
      if (NET.role === 'host') {
        const b = m.m; S_NET.h.l = b & 1; S_NET.h.r = b >> 1 & 1; S_NET.h.u = b >> 2 & 1; S_NET.h.d = b >> 3 & 1;
        ['p', 'k', 's', 'u'].forEach((k, i) => { const v = m.c[i] | 0; S_NET.t[k] += Math.max(0, Math.min(5, v - NET.last[k])); NET.last[k] = v; });
      }
      break;
    case 'bye': netLost(); break;
  }
}
function snapshot() {
  return {
    t: 's',
    f: G.f.map(f => ({ x: Math.round(f.x), y: Math.round(f.y), fc: f.face, hp: f.hp, en: Math.round(f.en), st: f.st, sf: f.sf, an: f.an, vx: Math.round(f.vx * 10) / 10, vy: Math.round(f.vy * 10) / 10, w: f.wins, fl: f.flash, al: Math.round(f.alpha * 100) / 100, cb: f.crouchBlock ? 1 : 0, sp: f.spec, sl: f.slamLand ? 1 : 0, hu: Math.round(f.hurt * 1000) / 1000 })),
    pr: G.proj.map(p => [Math.round(p.x), Math.round(p.y), Math.sign(p.vx), p.o.i]),
    wv: G.waves.map(w => [Math.round(w.x), w.o.i, w.life]),
    ph: G.phase, tm: G.timer, rd: G.round, cb: G.combo, ev: G.ev.splice(0)
  };
}
function applySnap(m) {
  m.f.forEach((d, i) => {
    const f = G.f[i]; if (!f) return;
    if (d.st !== f.st || d.sf < f.sf) f.sf = d.sf;
    Object.assign(f, { tx: d.x, ty: d.y, face: d.fc, hp: d.hp, en: d.en, st: d.st, an: d.an, atk: ATK[d.an] || null, vx: d.vx, vy: d.vy, wins: d.w, flash: d.fl, alpha: d.al, crouchBlock: !!d.cb, spec: d.sp, slamLand: d.sl ? (f.slamLand || f.sf) : 0, hurt: d.hu || 0 });
    if (Math.abs(f.sf - d.sf) > 3) f.sf = d.sf;
  });
  G.proj = m.pr.map(a => ({ x: a[0], y: a[1], vx: a[2] * 8.5, o: G.f[a[3]] }));
  G.waves = m.wv.map(a => ({ x: a[0], o: G.f[a[1]], life: a[2], vx: 0 }));
  G.phase = m.ph; G.timer = m.tm; G.round = m.rd; G.combo = m.cb;
  for (const e of m.ev) runFx(...e);
}
function guestStep() {
  // manda mis controles al anfitrión
  const r = readSources([S_KB1, S_T[0], S_PAD[0], S_PAD[1]]);
  let tapped = false;
  for (const k of ['p', 'k', 's', 'u']) if (r.t[k]) { NET.cnt[k] += r.t[k]; tapped = true; }
  const mask = r.h.l | r.h.r << 1 | r.h.u << 2 | r.h.d << 3;
  if (mask !== NET.mask || tapped || G.time % 8 === 0) { NET.mask = mask; netSend({ t: 'in', m: mask, c: [NET.cnt.p, NET.cnt.k, NET.cnt.s, NET.cnt.u] }); }
  for (const f of G.f) {
    f.x = lerp(f.x, f.tx, .45); f.y = Math.abs(f.ty - f.y) > 80 ? f.ty : lerp(f.y, f.ty, .6); f.sf++;
    poseStep(f);
  }
  for (const p of G.proj) p.x += p.vx;
  for (const w of G.waves) w.x += Math.sign(w.x - G.f[w.o.i].x) * 7.5;
  camFollow(); touchReady();
}

/* =========================== PANTALLAS =========================== */
let SEL = store.get('kdc_sel', null);
if (!Array.isArray(SEL) || SEL.length !== 2) SEL = [{ name: 'Jugador 1', ch: 'toro', face: null }, { name: 'Jugador 2', ch: 'rayo', face: null }];
let FACES = store.get('kdc_caras', []);
let STAGE_SEL = store.get('kdc_stage', -1), LVL = store.get('kdc_lvl', 'normal');
// los dos bots del modo "Bots peleando" tienen sus propias caras, nombres y dificultad
let BOTS = store.get('kdc_bots', null);
if (!Array.isArray(BOTS) || BOTS.length !== 2) BOTS = [{ name: 'Bot 1', ch: 'sombra', face: null, lvl: 'normal' }, { name: 'Bot 2', ch: 'tanque', face: null, lvl: 'normal' }];
let SCORE = [0, 0]; // peleas ganadas por cada bot desde que se eligieron
let selMode = null;
function saveSel() { if (!store.set('kdc_sel', SEL) || !store.set('kdc_bots', BOTS)) toast('No hay espacio para guardar más caras en este aparato.'); }
const playing = () => G.mode !== 'demo' && G.phase !== 'over';
function showScreen(id) { document.querySelectorAll('.scr').forEach(s => s.classList.toggle('on', s.id === id)); }
function hideScreens() { document.querySelectorAll('.scr').forEach(s => s.classList.remove('on')); }
function beginPlay() {
  hideScreens();
  document.body.classList.add('playing');
  $('#hudBtns').classList.add('on');
  $('#btnPause').textContent = G.mode === 'host' || G.mode === 'guest' ? '✕' : '⏸';
  if (!isTouch()) $('#touch').className = '';
  else { if (G.mode === 'bots') $('#touch').className = ''; else { buildTouch(1); lastReady = ''; } goFull(); }
  audio();
}
function endPlay() { document.body.classList.remove('playing'); $('#hudBtns').classList.remove('on'); $('#touch').className = ''; TOUCH.clear(); G.paused = false; }
function startDemo() {
  const pick = () => CH_KEYS[Math.random() * CH_KEYS.length | 0];
  startMatch({ mode: 'demo', sel: [{ ch: pick(), face: FACES[0] || null }, { ch: pick(), face: FACES[1] || FACES[0] || null }], stage: Math.random() * STAGES.length | 0 });
}
function goMenu() {
  if (NET.role) { netSend({ t: 'bye' }); netClose(); }
  endPlay(); selMode = null; startDemo(); showScreen('scrMenu');
}
function goFull() {
  const d = document.documentElement;
  if (!document.fullscreenElement && d.requestFullscreen) d.requestFullscreen({ navigationUI: 'hide' }).then(() => { try { screen.orientation.lock('landscape').catch(() => { }); } catch (e) { } }).catch(() => { });
}
function togglePause() {
  if (G.mode === 'demo' || G.phase === 'over') return;
  const online = G.mode === 'host' || G.mode === 'guest';
  const on = !$('#scrPause').classList.contains('on');
  if (!online) G.paused = on;
  $('#pRestart').style.display = $('#pSelect').style.display = online ? 'none' : '';
  $('#scrPause').classList.toggle('on', on);
}
// las dos caras como quedaron: el perdedor siempre más golpeado que el ganador
function drawEnd(w) {
  const cv2 = $('#eCv'), c = cv2.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv2.width, cv2.height);
  const hurts = G.f.map(f => f.hurt);
  if (w) hurts[1 - w.i] = Math.max(hurts[1 - w.i], Math.min(1, hurts[w.i] + .25));
  G.f.forEach((f, i) => {
    const win = w === f, lose = w && !win, cx = i ? 470 : 170, cy = 150, R = win ? 108 : 98;
    c.save(); c.translate(cx, cy + (lose ? 10 : 0)); if (lose) c.rotate(i ? .2 : -.2);
    if (win) { c.save(); c.globalAlpha = .55; glow(c, 0, 0, R * 1.5, 'rgba(255,200,61,.8)'); c.restore(); }
    drawFace(c, f.img, R, win ? '#ffc83d' : RING[i], 0, i ? -1 : 1, f.yaw, { wounds: f.wounds, hurt: hurts[i], wt: null, cry: lose });
    c.restore();
    if (win) { // corona
      c.save(); c.translate(cx, cy - R - 8); c.rotate(i ? .15 : -.15);
      c.beginPath(); c.moveTo(-48, 18); c.lineTo(-56, -26); c.lineTo(-26, -4); c.lineTo(0, -38); c.lineTo(26, -4); c.lineTo(56, -26); c.lineTo(48, 18); c.closePath();
      c.fillStyle = '#ffc83d'; c.fill(); c.lineWidth = 5; c.strokeStyle = '#8a5a00'; c.stroke();
      for (const [x, col] of [[-30, '#e8312a'], [0, '#2f7bff'], [30, '#1d9e49']]) { c.beginPath(); c.arc(x, 6, 7, 0, 7); c.fillStyle = col; c.fill(); }
      c.restore();
    }
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 6; c.strokeStyle = '#000';
    c.font = '900 30px system-ui,sans-serif'; c.fillStyle = win ? '#ffc83d' : '#fff';
    const label = (win ? '👑 ' : lose ? '💥 ' : '') + f.name; c.strokeText(label, cx, 290); c.fillText(label, cx, 290);
    c.font = '800 21px system-ui,sans-serif'; c.fillStyle = '#ffd9b0';
    const t = 'Daño recibido: ' + Math.round(f.hurt * 100) + '%'; c.strokeText(t, cx, 324); c.fillText(t, cx, 324);
  });
  if (!w) { c.font = '900 54px system-ui'; c.textAlign = 'center'; c.fillText('🤝', 320, 150); }
}
function showEnd() {
  if (G.mode === 'demo') return;
  const [a, b] = G.f, w = a.wins > b.wins ? a : b.wins > a.wins ? b : null;
  drawEnd(w);
  $('#eTitle').textContent = w ? '¡' + w.name + ' ganó!' : '¡Empate!';
  $('#eSub').textContent = `${a.name} ${a.wins} – ${b.wins} ${b.name}`;
  if (G.mode === 'bots') {
    if (w) SCORE[w.i]++;
    $('#eSub').textContent += ` (rondas) · Peleas ganadas: ${a.name} ${SCORE[0]} – ${SCORE[1]} ${b.name}`;
  }
  const guest = G.mode === 'guest';
  $('#eAgain').style.display = $('#eSelect').style.display = guest ? 'none' : '';
  if (guest) $('#eSub').textContent += ' · Esperando que el anfitrión elija la revancha…';
  endPlay(); showScreen('scrEnd');
}

/* ---------- selección de peleadores ---------- */
function panelData() { return selMode === 'host' ? [SEL[0], NET.rsel] : selMode === 'guest' ? [NET.rsel, SEL[0]] : selMode === 'bots' ? BOTS : [SEL[0], SEL[1]]; }
const editable = i => selMode === 'host' ? i === 0 : selMode === 'guest' ? i === 1 : true;
function openSelect(mode) {
  selMode = mode; endPlay(); SCORE = [0, 0];
  if (G.mode !== 'demo') startDemo();
  showScreen('scrSelect'); renderSelect();
}
function drawPreview(cv2, key, face, i, yaw) {
  const c = cv2.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv2.width, cv2.height);
  const f = { ch: CHARS[key], i, face: i === 1 ? -1 : 1, yaw, alpha: 1, rot: 0, flash: 0, img: faceImg(face, () => drawPreview(cv2, key, face, i, yaw)), pose: { ...P_IDLE }, st: 'idle', sf: 0 };
  const sc = 0.92 / CHARS[key].b.s;
  drawFighter(c, f, cv2.width / 2 - f.face * 8, cv2.height - 8, sc);
}
function renderSelect() {
  const D = panelData(), box = $('#players');
  $('#sTitle').textContent = { cpu: 'Vos contra la máquina', local: 'Dos jugadores', bots: 'Bots peleando · vos mirás', host: 'En línea · sos el anfitrión', guest: 'En línea · sala ' + NET.code }[selMode] || 'Elegí tu peleador';
  box.innerHTML = '';
  D.forEach((d, i) => {
    const el = document.createElement('div'); el.className = 'pl p' + (i + 1) + (editable(i) ? '' : ' ro'); box.appendChild(el);
    if (!d) { el.innerHTML = '<div class="wait" style="padding:30px;text-align:center">Esperando a tu amigo…</div>'; return; }
    const who = selMode === 'cpu' && i === 1 ? 'Máquina 🤖 (ponele la cara que quieras)' : selMode === 'bots' ? 'Bot ' + (i + 1) + ' 🤖' : (selMode === 'host' || selMode === 'guest') ? (editable(i) ? 'Vos' : 'Tu amigo') : 'Jugador ' + (i + 1);
    const ed = editable(i);
    el.innerHTML = `<div class="plHead"><div class="faceBig ${d.face ? '' : 'empty'}" ${d.face ? `style="background-image:url(${d.face})"` : ''}></div>
      <div class="plInfo"><div class="who">${esc(who)}</div><input maxlength="12" value="${esc(d.name)}" placeholder="Nombre" ${ed ? '' : 'readonly'}>
      ${ed ? '<div class="row camBtns"><button class="sm" data-a="cam">📷 Foto</button><button class="sm" data-a="gal">🖼️ Galería</button></div>' : ''}</div></div>
      ${ed ? `<div class="faces">${[`<button class="fc none ${d.face ? '' : 'on'}" data-f="-1" title="Sin foto">🙂</button>`, ...FACES.map((u, k) => `<button class="fc ${u === d.face ? 'on' : ''}" data-f="${k}" style="background-image:url(${u})"><i data-del="${k}">✕</i></button>`)].join('')}</div>` : ''}
      <div class="chars">${CH_KEYS.map(k => `<button class="chr ${d.ch === k ? 'on' : ''}" data-ch="${k}"><canvas width="180" height="220"></canvas><b>${CHARS[k].name}</b></button>`).join('')}</div>
      <div class="chDesc">${esc(CHARS[d.ch] ? CHARS[d.ch].desc : '')}</div>
      ${selMode === 'bots' ? `<div class="row" style="align-items:center;margin-top:6px"><span style="font-size:13px;font-weight:800">Nivel:</span>${LVLS.map(([k, t]) => `<button class="sm ${(d.lvl || 'normal') === k ? 'on' : ''}" data-bl="${k}">${t}</button>`).join('')}</div>` : ''}`;
    el.querySelectorAll('.chr').forEach(b => drawPreview(b.querySelector('canvas'), b.dataset.ch, d.face, i, d.yaw ?? yawOf(d.face)));
    if (!ed) return;
    const changed = () => { saveSel(); if (NET.role) helloSoon(); };
    el.querySelector('input').oninput = e => { d.name = e.target.value; changed(); };
    el.querySelector('.faceBig').onclick = () => takePhoto(i);
    el.querySelector('[data-a=cam]').onclick = () => takePhoto(i);
    el.querySelector('[data-a=gal]').onclick = () => pickPhoto(i);
    el.querySelectorAll('.fc').forEach(b => b.onclick = e => {
      const del = e.target.dataset.del;
      if (del != null) {
        const u = FACES[+del]; if (!confirm('¿Borrar esta cara guardada?')) return;
        FACES.splice(+del, 1); store.set('kdc_caras', FACES); for (const s of [...SEL, ...BOTS]) if (s.face === u) s.face = null;
      } else { const k = +b.dataset.f; d.face = k < 0 ? null : FACES[k]; }
      changed(); renderSelect();
    });
    el.querySelectorAll('.chr').forEach(b => b.onclick = () => { d.ch = b.dataset.ch; changed(); renderSelect(); });
    el.querySelectorAll('[data-bl]').forEach(b => b.onclick = () => { d.lvl = b.dataset.bl; changed(); renderSelect(); });
  });
  $('#extra').innerHTML = selMode === 'cpu' ? `<div class="secT">Dificultad de la máquina</div><div class="row">${LVLS.map(([k, t]) => `<button class="sm ${LVL === k ? 'on' : ''}" data-l="${k}">${t}</button>`).join('')}</div>` : '';
  $('#extra').querySelectorAll('[data-l]').forEach(b => b.onclick = () => { LVL = b.dataset.l; store.set('kdc_lvl', LVL); renderSelect(); });
  const guest = selMode === 'guest';
  $('#stgT').style.display = $('#stages').style.display = guest ? 'none' : '';
  if (!guest) renderStages();
  $('#sGo').style.display = guest ? 'none' : '';
  $('#sGo').disabled = selMode === 'host' && !NET.rsel;
  $('#sWait').textContent = guest ? '⏳ El anfitrión elige el escenario y arranca la pelea.' : selMode === 'host' && !NET.rsel ? '⏳ Esperando a tu amigo…' : '';
}
let stageThumbs = null;
function renderStages() {
  const box = $('#stages');
  if (!stageThumbs) {
    box.innerHTML = [`<button class="stg" data-s="-1"><canvas width="320" height="180"></canvas><b>🎲 Al azar</b></button>`, ...STAGES.map((s, i) => `<button class="stg" data-s="${i}"><canvas width="320" height="180"></canvas><b>${esc(s.name)}</b></button>`)].join('');
    box.querySelectorAll('.stg').forEach(b => {
      const i = +b.dataset.s, c = b.querySelector('canvas').getContext('2d');
      if (i < 0) { c.fillStyle = '#2b1838'; c.fillRect(0, 0, 320, 180); c.font = '80px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🎲', 160, 92); }
      else { c.scale(1 / 3, 1 / 3); drawStage(c, i, (STAGE_W - 960) / 2, 0); }
      b.onclick = () => { STAGE_SEL = i; store.set('kdc_stage', i); renderStages(); };
    });
    stageThumbs = true;
  }
  box.querySelectorAll('.stg').forEach(b => b.classList.toggle('on', +b.dataset.s === STAGE_SEL));
}
$('#sBack').onclick = () => { if (NET.role) goMenu(); else { selMode = null; showScreen('scrMenu'); } };
$('#sGo').onclick = () => {
  audio();
  const st = STAGE_SEL < 0 || STAGE_SEL >= STAGES.length ? Math.random() * STAGES.length | 0 : STAGE_SEL;
  if (selMode === 'host') {
    if (!NET.rsel) return;
    const seeds = newSeeds(); netSend({ t: 'start', stage: st, seeds }); startMatch({ mode: 'host', sel: [SEL[0], NET.rsel], stage: st, seeds });
  } else if (selMode === 'bots') startMatch({ mode: 'bots', sel: BOTS, stage: st, lvls: BOTS.map(b => b.lvl || 'normal') });
  else startMatch({ mode: selMode, sel: [SEL[0], SEL[1]], stage: st, lvl: LVL });
};
const LVLS = [['facil', '😌 Fácil'], ['normal', '😠 Normal'], ['dificil', '😈 Difícil']];

/* ---------- fotos: cámara, galería y recorte ---------- */
let photoSlot = 0, camStream = null, camFacing = 'user';
function takePhoto(i) {
  photoSlot = i;
  if (!isTouch() && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) openCam();
  else $('#fileCam').click();
}
function pickPhoto(i) { photoSlot = i; $('#fileGal').click(); }
for (const id of ['#fileCam', '#fileGal']) $(id).onchange = e => {
  const file = e.target.files[0]; e.target.value = ''; if (!file) return;
  const url = URL.createObjectURL(file), im = new Image();
  im.onload = () => { openCrop(im); URL.revokeObjectURL(url); };
  im.onerror = () => toast('No se pudo abrir esa imagen.');
  im.src = url;
};
async function openCam() {
  try {
    camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: camFacing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    const v = $('#camV'); v.srcObject = camStream; v.style.transform = camFacing === 'user' ? 'scaleX(-1)' : 'none';
    $('#cam').classList.add('on');
  } catch (e) { closeCam(); toast('No se pudo usar la cámara. Elegí una foto de la galería.'); $('#fileGal').click(); }
}
function closeCam() { if (camStream) camStream.getTracks().forEach(t => t.stop()); camStream = null; $('#camV').srcObject = null; $('#cam').classList.remove('on'); }
$('#camCancel').onclick = closeCam;
$('#camFlip').onclick = () => { camFacing = camFacing === 'user' ? 'environment' : 'user'; if (camStream) camStream.getTracks().forEach(t => t.stop()); openCam(); };
$('#camShot').onclick = () => {
  const v = $('#camV'); if (!v.videoWidth) return;
  const c = mkCanvas(v.videoWidth, v.videoHeight), x = c.getContext('2d');
  if (camFacing === 'user') { x.translate(c.width, 0); x.scale(-1, 1); }
  x.drawImage(v, 0, 0); closeCam(); openCrop(c);
};
const CR = { src: null, base: 1, z: 1, ox: 0, oy: 0, ptr: new Map(), pinch: null, dir: 0, yaw: 0, manual: false, touched: false, found: false, gen: 0, t: 0 };
function openCrop(img) {
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, k = Math.min(1, 1100 / Math.max(w, h));
  const c = mkCanvas(Math.round(w * k), Math.round(h * k)); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  setCropSrc(c); $('#crop').classList.add('on');
}
function setCropSrc(c) {
  CR.src = c; CR.base = 240 / Math.min(c.width, c.height); CR.z = 1;
  CR.ox = 150 - c.width * CR.base / 2; CR.oy = 150 - c.height * CR.base / 2; $('#cropZoom').value = 1;
  Object.assign(CR, { dir: 0, yaw: 0, manual: false, touched: false, found: false });
  setDir(0, false); drawCrop(); analyzeFace(true);
}

/* detector de caras (MediaPipe, se baja solo la primera vez que se arma una cara) */
const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
let FD = null;
function loadDetector() {
  if (!FD) FD = (async () => {
    const m = await import(MP + '/vision_bundle.mjs');
    const files = await m.FilesetResolver.forVisionTasks(MP + '/wasm');
    return m.FaceDetector.createFromOptions(files, {
      baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite', delegate: 'CPU' },
      runningMode: 'IMAGE', minDetectionConfidence: .45
    });
  })().catch(e => { FD = null; throw e; });
  return FD;
}
const cropInfo = t => $('#cropInfo').textContent = t;
// full = analiza la foto entera y centra la cara; si no, solo lo que está dentro del círculo
async function analyzeFace(full) {
  const gen = ++CR.gen;
  if (!CR.found) cropInfo('🔍 Buscando la cara…');
  let det;
  try { det = await loadDetector(); } catch (e) { if (gen === CR.gen) cropInfo('Elegí hacia dónde mira la cara 👇'); return; }
  if (gen !== CR.gen || !$('#crop').classList.contains('on')) return;
  let img, sx = 1, ox = 0, oy = 0;
  if (full) {
    const k = Math.min(1, 640 / Math.max(CR.src.width, CR.src.height));
    img = mkCanvas(Math.round(CR.src.width * k), Math.round(CR.src.height * k)); img.getContext('2d').drawImage(CR.src, 0, 0, img.width, img.height); sx = 1 / k;
  } else {
    // lo que se ve dentro del círculo, en coordenadas de la foto
    const s = cropS(); img = mkCanvas(240, 240); img.getContext('2d').drawImage(CR.src, CR.ox - 30, CR.oy - 30, CR.src.width * s, CR.src.height * s);
    sx = 1 / s; ox = (30 - CR.ox) / s; oy = (30 - CR.oy) / s;
  }
  let r; try { r = det.detect(img); } catch (e) { return; }
  const d = (r.detections || []).sort((a, b) => b.boundingBox.width * b.boundingBox.height - a.boundingBox.width * a.boundingBox.height)[0];
  if (!d) {
    if (!CR.found) cropInfo(full ? 'No encontré la cara. Acomodala en el círculo 👆 y elegí hacia dónde mira 👇' : 'No encontré la cara: elegí hacia dónde mira 👇');
    return;
  }
  CR.found = true;
  const kp = d.keypoints, bb = d.boundingBox, W0 = img.width;
  // nariz comparada con el medio de los ojos: + mira a la derecha, - a la izquierda
  const eyeMid = (kp[0].x + kp[1].x) / 2 * W0, eyeD = Math.abs(kp[1].x - kp[0].x) * W0;
  const turn = (kp[2].x * W0 - eyeMid) / Math.max(eyeD, bb.width * .25);
  if (!CR.manual) {
    const dir = Math.abs(turn) < .16 ? 0 : Math.sign(turn);
    CR.yaw = clamp((Math.abs(turn) - .08) / .55, 0, 1); setDir(dir, false);
  }
  if (full && !CR.touched) {
    // centra la cara y la agranda para que llene el círculo
    const cx = ox + (bb.originX + bb.width / 2) * sx, cy = oy + (bb.originY + bb.height * .42) * sx, bw = bb.width * sx;
    const s = clamp(150 / bw, CR.base, CR.base * 5); CR.z = s / CR.base; $('#cropZoom').value = CR.z;
    CR.ox = 150 - cx * s; CR.oy = 150 - cy * s; drawCrop();
  }
  cropInfo(['✅ Cara encontrada: mira a la izquierda', '✅ Cara encontrada: está de frente', '✅ Cara encontrada: mira a la derecha'][CR.dir + 1] + '. En la pelea va a mirar a su rival.');
}
function setDir(dir, manual) {
  CR.dir = dir; if (manual) { CR.manual = true; CR.yaw = dir ? .7 : 0; }
  document.querySelectorAll('#cropDir [data-dir]').forEach(b => b.classList.toggle('on', +b.dataset.dir === dir));
}
document.querySelectorAll('#cropDir [data-dir]').forEach(b => b.onclick = () => setDir(+b.dataset.dir, true));
// cuando el usuario termina de mover la foto, si todavía no se encontró la cara se busca dentro del círculo
function cropMoved() { CR.touched = true; clearTimeout(CR.t); if (!CR.found && !CR.manual) CR.t = setTimeout(() => analyzeFace(false), 600); }
const cropS = () => CR.base * CR.z;
function setZoom(z, cx = 150, cy = 150) {
  const s0 = cropS(); CR.z = clamp(z, 1, 5); const s1 = cropS();
  CR.ox = cx - (cx - CR.ox) * s1 / s0; CR.oy = cy - (cy - CR.oy) * s1 / s0; $('#cropZoom').value = CR.z; drawCrop();
}
function drawCrop() {
  const c = $('#cropCv').getContext('2d'), s = cropS();
  c.fillStyle = '#111'; c.fillRect(0, 0, 300, 300);
  c.drawImage(CR.src, CR.ox, CR.oy, CR.src.width * s, CR.src.height * s);
  c.fillStyle = 'rgba(0,0,0,.62)'; c.beginPath(); c.rect(0, 0, 300, 300); c.arc(150, 150, 120, 0, Math.PI * 2, true); c.fill();
  c.strokeStyle = '#ffc83d'; c.lineWidth = 3; c.beginPath(); c.arc(150, 150, 120, 0, Math.PI * 2); c.stroke();
}
{
  const cc = $('#cropCv');
  const pos = e => { const r = cc.getBoundingClientRect(); return [(e.clientX - r.left) * 300 / r.width, (e.clientY - r.top) * 300 / r.height]; };
  cc.addEventListener('pointerdown', e => { cc.setPointerCapture(e.pointerId); CR.ptr.set(e.pointerId, pos(e)); CR.pinch = null; });
  cc.addEventListener('pointermove', e => {
    if (!CR.ptr.has(e.pointerId)) return;
    const p = pos(e), old = CR.ptr.get(e.pointerId); CR.ptr.set(e.pointerId, p);
    if (CR.ptr.size === 1) { CR.ox += p[0] - old[0]; CR.oy += p[1] - old[1]; drawCrop(); }
    else if (CR.ptr.size === 2) {
      const [a, b] = [...CR.ptr.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (!CR.pinch) CR.pinch = { d, z: CR.z }; else setZoom(CR.pinch.z * d / CR.pinch.d, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    }
  });
  const up = e => { if (CR.ptr.delete(e.pointerId)) cropMoved(); CR.pinch = null; };
  cc.addEventListener('pointerup', up); cc.addEventListener('pointercancel', up);
  cc.addEventListener('wheel', e => { e.preventDefault(); const p = pos(e); setZoom(CR.z * (e.deltaY < 0 ? 1.1 : 1 / 1.1), p[0], p[1]); cropMoved(); }, { passive: false });
}
$('#cropZoom').oninput = e => { setZoom(+e.target.value); cropMoved(); };
$('#cropRot').onclick = () => { const s = CR.src, c = mkCanvas(s.height, s.width), x = c.getContext('2d'); x.translate(c.width, 0); x.rotate(Math.PI / 2); x.drawImage(s, 0, 0); setCropSrc(c); };
$('#cropCancel').onclick = () => { CR.gen++; $('#crop').classList.remove('on'); };
$('#cropOk').onclick = () => {
  CR.gen++;
  const out = mkCanvas(160, 160), x = out.getContext('2d'), k = 160 / 240, s = cropS();
  x.fillStyle = '#d9a27c'; x.fillRect(0, 0, 160, 160);
  // se guarda siempre mirando a la derecha; en la pelea se da vuelta para mirar al rival
  if (CR.dir < 0) { x.translate(160, 0); x.scale(-1, 1); }
  x.drawImage(CR.src, (CR.ox - 30) * k, (CR.oy - 30) * k, CR.src.width * s * k, CR.src.height * s * k);
  const url = out.toDataURL('image/jpeg', .85);
  YAW[faceKey(url)] = CR.dir ? Math.max(.25, CR.yaw) : 0;
  for (const k2 in YAW) if (!FACES.some(u => faceKey(u) === k2) && k2 !== faceKey(url)) delete YAW[k2];
  store.set('kdc_yaw', YAW);
  const d = panelData()[photoSlot]; if (d) d.face = url;
  FACES = [url, ...FACES.filter(u => u !== url)].slice(0, 12);
  while (!store.set('kdc_caras', FACES) && FACES.length > 1) FACES.pop();
  saveSel(); if (NET.role) helloSoon();
  $('#crop').classList.remove('on'); renderSelect();
};

/* ---------- menú, pausa, fin, en línea ---------- */
$('#mCpu').onclick = () => { audio(); openSelect('cpu'); };
$('#mBots').onclick = () => { audio(); openSelect('bots'); };
$('#mOnline').onclick = () => { audio(); openOnline(); };
$('#mHelp').onclick = () => $('#scrHelp').classList.add('on');
$('#mFull').onclick = () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => { }); else goFull(); };
function openOnline(code) {
  $('#onA').style.display = 'block'; $('#onB').style.display = 'none'; oMsg('');
  $('#oCode').value = code || ''; $('#scrOnline').classList.add('on');
  if (code) netJoin(code);
}
$('#oHost').onclick = netHost;
$('#oJoin').onclick = () => netJoin($('#oCode').value);
$('#oCode').onkeydown = e => { if (e.key === 'Enter') netJoin($('#oCode').value); };
$('#oClose').onclick = () => { netClose(); $('#scrOnline').classList.remove('on'); };
const roomLink = () => location.origin + location.pathname + '?sala=' + NET.code;
$('#oShare').onclick = () => {
  const data = { title: 'Kombate de Caras', text: '¡Peleemos! Entrá a mi sala de Kombate de Caras con el código ' + NET.code, url: roomLink() };
  if (navigator.share) navigator.share(data).catch(() => { }); else $('#oCopy').onclick();
};
$('#oCopy').onclick = () => { navigator.clipboard.writeText(roomLink()).then(() => toast('📋 Link copiado. Pasáselo a tu amigo.')).catch(() => toast(roomLink(), 6000)); };
$('#btnPause').onclick = togglePause;
$('#btnMute').onclick = () => { muted = !muted; store.set('kdc_mute', muted); $('#btnMute').textContent = muted ? '🔇' : '🔊'; if (muted && 'speechSynthesis' in window) speechSynthesis.cancel(); };
$('#btnMute').textContent = muted ? '🔇' : '🔊';
$('#pResume').onclick = togglePause;
$('#pRestart').onclick = () => { $('#scrPause').classList.remove('on'); startMatch(G.setup); };
$('#pSelect').onclick = () => { $('#scrPause').classList.remove('on'); openSelect(G.setup.mode); };
$('#pQuit').onclick = () => { $('#scrPause').classList.remove('on'); goMenu(); };
$('#eAgain').onclick = () => {
  if (G.setup.mode === 'host') { if (!NET.rsel) return goMenu(); const seeds = newSeeds(); netSend({ t: 'start', stage: G.setup.stage, seeds }); startMatch({ ...G.setup, sel: [SEL[0], NET.rsel], seeds }); }
  else startMatch(G.setup);
};
$('#eSelect').onclick = () => { if (G.setup.mode === 'host') netSend({ t: 'sel' }); openSelect(G.setup.mode); };
$('#eQuit').onclick = goMenu;
document.addEventListener('visibilitychange', () => { if (document.hidden && (G.mode === 'cpu' || G.mode === 'bots') && G.phase !== 'over' && !G.paused) togglePause(); });

/* instalar como app */
let installPrompt = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; $('#mInstall').style.display = ''; });
$('#mInstall').onclick = () => { if (installPrompt) { installPrompt.prompt(); installPrompt = null; $('#mInstall').style.display = 'none'; } };
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });

/* =========================== ARRANQUE =========================== */
let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(100, now - last); last = now;
  while (acc >= 1000 / 60) { step(); acc -= 1000 / 60; }
  render();
  requestAnimationFrame(frame);
}
startDemo();
{
  const sala = new URLSearchParams(location.search).get('sala');
  if (sala) { history.replaceState(null, '', location.pathname); openOnline(sala); }
}
requestAnimationFrame(frame);
