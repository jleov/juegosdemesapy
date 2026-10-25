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
  zap() { sNoise(.18, 5000, .5, 'highpass'); sTone(1800, 300, .15, .15, 'square'); },
  ice() { sTone(1800, 2600, .18, .1, 'triangle'); sNoise(.25, 6000, .2, 'highpass'); },
  sonic() { sTone(180, 90, .45, .3, 'sawtooth'); sTone(360, 180, .45, .15, 'square'); },
  whip() { sNoise(.06, 5000, .6, 'highpass'); },
  boom() { sTone(110, 30, .7, .9); sNoise(.7, 900, .9, 'lowpass', 60); },
  counter() { sTone(1200, 800, .2, .25, 'square'); sTone(600, 300, .25, .2, 'triangle'); },
  gulp() { sTone(300, 180, .09, .15, 'sine'); },
  grab() { sNoise(.1, 800, .4, 'bandpass'); sTone(200, 120, .15, .3, 'triangle'); },
  shatter() { sNoise(.5, 7000, .6, 'highpass'); sTone(2400, 800, .3, .15, 'triangle'); },
  pop() { sTone(700 + Math.random() * 500, 1300, .07, .06, 'triangle'); },
  confetti() { sNoise(.35, 2500, .25, 'bandpass', 6000); sTone(500, 900, .12, .08, 'triangle'); },
  twinkle() { sTone(1600, 2400, .12, .12, 'triangle'); setTimeout(() => sTone(2400, 3200, .15, .1, 'triangle'), 110); },
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
  },
  // extras de dibujo: emblem (símbolo en el pecho), stripes (rayas de camiseta), cape (capa), hat (sombrero o vincha)
  escarcha: {
    name: 'Escarcha', desc: 'Fría y calculadora. ⚡ Bola de hielo que te deja congelado.', special: 'ice', hp: 95, speed: 4.1, jump: 16, power: .95,
    b: { s: .98, tw: 25, ww: 19, limb: 12.5, torso: 58 },
    c: { shirt: '#cdefff', pants: '#3d7fc4', arm: '#cdefff', neck: '#cdefff', glove: '#ffffff', shoe: '#20476e', belt: '#ffffff', line: '#0b1a2a', emblem: '❄' }
  },
  latigo: {
    name: 'Látigo', desc: 'Vaquero. ⚡ Latigazo de largo alcance que te arrastra.', special: 'whip', hp: 100, speed: 3.9, jump: 15.8, power: 1,
    b: { s: 1.02, tw: 27, ww: 21, limb: 13.5, torso: 60 },
    c: { shirt: '#a0522d', pants: '#3b5998', arm: '#c98a5f', neck: '#c98a5f', glove: '#5a3a1a', shoe: '#3a2410', belt: '#d4a017', line: '#1a0d05', hat: 'cowboy', hatc: '#7a4a22' }
  },
  dragon: {
    name: 'Dragón', desc: 'Artista marcial. ⚡ Gancho volador que sube hasta el cielo.', special: 'upper', hp: 100, speed: 4.2, jump: 16.5, power: 1.05,
    b: { s: 1, tw: 27, ww: 21, limb: 13, torso: 59 },
    c: { shirt: '#ff8a1e', pants: '#ff8a1e', arm: '#ff8a1e', neck: '#c98a5f', glove: '#1e3a8a', shoe: '#1e3a8a', belt: '#1e3a8a', line: '#2a1200', hat: 'band', hatc: '#ffffff' }
  },
  tornado: {
    name: 'Tornado', desc: 'Bailarín de capoeira. ⚡ Torbellino de patadas que avanza.', special: 'spin', hp: 95, speed: 4.4, jump: 16.5, power: .95,
    b: { s: .97, tw: 25, ww: 20, limb: 12.5, torso: 57 },
    c: { shirt: '#1d9e49', pants: '#0f5c2a', arm: '#1d9e49', neck: '#1d9e49', glove: '#ffffff', shoe: '#ffffff', belt: '#ffffff', line: '#04160a', hat: 'band', hatc: '#e8312a' }
  },
  muralla: {
    name: 'Muralla', desc: 'Armadura de piedra. ⚡ Postura de contraataque: si le pegás, te la devuelve.', special: 'counter', hp: 130, speed: 2.8, jump: 14, power: 1.15,
    b: { s: 1.18, tw: 36, ww: 29, limb: 17, torso: 63 },
    c: { shirt: '#7d8590', pants: '#4a5058', arm: '#7d8590', neck: '#7d8590', glove: '#4a5058', shoe: '#2a2e33', belt: '#c9a227', line: '#111418', emblem: '🛡' }
  },
  terere: {
    name: 'Tereré', desc: 'Albirrojo de pura cepa. ⚡ Toma tereré y recupera vida.', special: 'heal', hp: 105, speed: 3.8, jump: 15.5, power: 1,
    b: { s: 1.02, tw: 28, ww: 22, limb: 14, torso: 60 },
    c: { shirt: '#ffffff', stripes: '#d52b1e', pants: '#0038a8', arm: '#c98a5f', neck: '#c98a5f', glove: '#2e8b57', shoe: '#111111', belt: '#0038a8', line: '#160806' }
  },
  meteoro: {
    name: 'Meteoro', desc: 'Hechicero del espacio. ⚡ Lluvia de meteoritos sobre el rival.', special: 'meteor', hp: 95, speed: 3.7, jump: 15.5, power: 1,
    b: { s: 1, tw: 26, ww: 20, limb: 12.5, torso: 58 },
    c: { shirt: '#3b2a6b', pants: '#21173d', arm: '#3b2a6b', neck: '#3b2a6b', glove: '#ffb347', shoe: '#21173d', belt: '#ffb347', line: '#0a0614', cape: '#6b4ac9', emblem: '☄' }
  },
  luchador: {
    name: 'Luchador', desc: 'Luchador de cachascán. ⚡ Agarre y llave: no se puede cubrir.', special: 'grab', hp: 120, speed: 3.2, jump: 14.5, power: 1.2,
    b: { s: 1.12, tw: 33, ww: 27, limb: 16, torso: 61 },
    c: { shirt: '#ff4fa3', pants: '#ff4fa3', arm: '#e0a37a', neck: '#e0a37a', glove: '#ffd21f', shoe: '#ffd21f', belt: '#ffd21f', line: '#2a0014', emblem: '★' }
  },
  halcon: {
    name: 'Halcón', desc: 'Vuela alto. ⚡ Picada voladora con patada.', special: 'dive', hp: 92, speed: 4.6, jump: 18, power: .95,
    b: { s: .96, tw: 24, ww: 19, limb: 12, torso: 57 },
    c: { shirt: '#4fb3ff', pants: '#1d5fa8', arm: '#4fb3ff', neck: '#4fb3ff', glove: '#ffffff', shoe: '#ffd21f', belt: '#ffd21f', line: '#061a2e', cape: '#ffffff' }
  },
  sonico: {
    name: 'Sónico', desc: 'Rockero. ⚡ Grito sónico que empuja y aturde.', special: 'sonic', hp: 95, speed: 4, jump: 16, power: .95,
    b: { s: .98, tw: 25, ww: 20, limb: 12.5, torso: 58 },
    c: { shirt: '#b8ff3d', pants: '#2b2b2b', arm: '#b8ff3d', neck: '#b8ff3d', glove: '#2b2b2b', shoe: '#b8ff3d', belt: '#2b2b2b', line: '#101a00', emblem: '♪' }
  },
  bumeran: {
    name: 'Bumerán', desc: 'Explorador. ⚡ Bumerán que va y vuelve (pega dos veces).', special: 'boom', hp: 98, speed: 4, jump: 16, power: .95,
    b: { s: 1, tw: 26, ww: 20, limb: 13, torso: 58 },
    c: { shirt: '#c2a46b', pants: '#6b5a3a', arm: '#d9a27c', neck: '#d9a27c', glove: '#7a5230', shoe: '#3a2a1a', belt: '#7a5230', line: '#1a1206', hat: 'bush', hatc: '#8a6d3b' }
  },
  bombita: {
    name: 'Bombita', desc: 'Loco por los explosivos. ⚡ Tira bombas que explotan en el piso.', special: 'bomb', hp: 100, speed: 3.6, jump: 15.5, power: 1.1,
    b: { s: 1.04, tw: 29, ww: 24, limb: 14, torso: 58 },
    c: { shirt: '#ff7a1a', pants: '#2b2b2b', arm: '#ff7a1a', neck: '#ff7a1a', glove: '#2b2b2b', shoe: '#2b2b2b', belt: '#ffd21f', line: '#1a0a00', emblem: '💣' }
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
  slam: { dmg: 10, st: 0, push: 8, lv: 'low', knock: true, launch: 7 },
  // habilidades nuevas (push negativo = te arrastra hacia el que pega; lv throw = no se puede cubrir)
  whip: { dmg: 11, rx: [35, 235], ry: [85, 140], st: 20, push: -5, lv: 'mid', chip: 1, bs: 12 },
  upper: { dmg: 13, rx: [0, 62], ry: [50, 200], st: 0, push: 3, lv: 'mid', knock: true, launch: 12, chip: 2 },
  spin: { dmg: 4, rx: [-55, 75], ry: [45, 125], st: 12, push: 3, lv: 'mid', chip: 1, bs: 8 },
  dive: { dmg: 12, rx: [0, 85], ry: [0, 95], st: 0, push: 5, lv: 'over', knock: true, launch: 6, chip: 2 },
  ice: { dmg: 9, st: 55, push: 2, lv: 'mid', chip: 1, bs: 14, freeze: true },
  sonic: { dmg: 8, st: 30, push: 11, lv: 'mid', chip: 1, bs: 16 },
  boom: { dmg: 7, st: 14, push: 3, lv: 'mid', chip: 1, bs: 10 },
  bomb: { dmg: 13, st: 0, push: 6, lv: 'mid', knock: true, launch: 8, chip: 2 },
  meteor: { dmg: 7, st: 0, push: 4, lv: 'over', knock: true, launch: 6, chip: 1 },
  counter: { dmg: 14, st: 0, push: 8, lv: 'mid', knock: true, launch: 9 },
  grab: { dmg: 15, st: 0, push: 4, lv: 'throw', knock: true, launch: 5 }
};

/* =========================== CARAS =========================== */
const IMG = new Map();
function faceImg(url, onload) {
  if (!url) return null;
  let im = IMG.get(url);
  // las caras nuevas vienen recortadas (PNG/WebP con transparencia); las viejas son JPG cuadradas
  if (!im) { im = new Image(); im.src = url; im.cut = /^data:image\/(png|webp)/.test(url); IMG.set(url, im); }
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
    const d0 = first && !img.cut ? 0 : (Math.sin(p0) + 1) / 2 * S, d1 = (Math.sin(p1) + 1) / 2 * S; first = false;
    x.drawImage(img, (u0 + 1) / 2 * iw, 0, iw / N + .5, ih, d0, 0, d1 - d0 + .8, S);
    // la sombra solo sobre la foto (en las caras recortadas no pinta el fondo transparente)
    const sh = (1 - mid) * .45; if (sh > .02) { x.globalCompositeOperation = 'source-atop'; x.fillStyle = `rgba(0,0,0,${sh})`; x.fillRect(d0, 0, d1 - d0 + .8, S); x.globalCompositeOperation = 'source-over'; }
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
// cabeza recortada: el borde del color del jugador sigue la silueta del pelo y la cara
const OUTL = new Map(), CUTK = 1.22, PAD = 10;
function outlined(art, key, ring) {
  const k = key + '|' + ring; let o = OUTL.get(k); if (o) return o;
  const S = art.width, T = S + PAD * 2; o = mkCanvas(T, T); const x = o.getContext('2d');
  for (let a = 0; a < 16; a++) x.drawImage(art, PAD + Math.cos(a * Math.PI / 8) * 5, PAD + Math.sin(a * Math.PI / 8) * 5, S, S);
  x.globalCompositeOperation = 'source-in'; x.fillStyle = ring; x.fillRect(0, 0, T, T);
  x.globalCompositeOperation = 'source-over'; x.drawImage(art, PAD, PAD, S, S);
  if (OUTL.size > 40) OUTL.clear();
  OUTL.set(k, o); return o;
}
const WOFF = mkCanvas(160, 160), WX = WOFF.getContext('2d');
function drawCutFace(c, img, R, ring, flash, dir, yaw, hf) {
  const art = faceArt(img, yaw), th = .4 * (1 - clamp((yaw || 0) / .45, 0, 1)), Rk = R * CUTK;
  c.save(); if (dir < 0) c.scale(-1, 1);
  const o = outlined(art, img.src + '|' + th.toFixed(2), ring), ext = Rk * (1 + 2 * PAD / art.width);
  c.drawImage(o, -ext, -ext, ext * 2, ext * 2);
  // heridas y el rojo del golpe, recortados con la misma silueta
  const wounds = hf && hf.wounds && (hf.hurt > 0 || hf.cry);
  if (wounds || flash > 0) {
    WX.setTransform(1, 0, 0, 1, 0, 0); WX.globalCompositeOperation = 'source-over'; WX.globalAlpha = 1; WX.clearRect(0, 0, 160, 160);
    WX.save(); WX.translate(80, 80);
    if (wounds) drawWounds(WX, 80, hf, th);
    WX.restore();
    if (flash > 0) { WX.fillStyle = `rgba(255,40,30,${Math.min(1, flash / 10) * .5})`; WX.fillRect(0, 0, 160, 160); }
    WX.globalCompositeOperation = 'destination-in'; WX.drawImage(art, 0, 0, 160, 160); WX.globalCompositeOperation = 'source-over';
    c.drawImage(WOFF, -Rk, -Rk, Rk * 2, Rk * 2);
  }
  c.restore();
}
function drawFace(c, img, R, ring, flash, dir = 1, yaw = 0, hf = null) {
  if (img && img.cut && img.complete && img.naturalWidth) return drawCutFace(c, img, R, ring, flash, dir, yaw, hf);
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
  },
  {
    // el ring de piedra del gran torneo, con el templo atrás y el público alrededor
    name: 'Arena del Torneo',
    flags: [140, 420, 700, 900, 1180, 1460],
    far(c, R) {
      c.fillStyle = grad(c, 0, GROUND, ['#3d9be9', '#8fcfff', '#e3f5ff']); c.fillRect(0, 0, STAGE_W, H);
      c.fillStyle = '#ffffffdd'; for (let i = 0; i < 9; i++) { const x = R() * STAGE_W, y = 30 + R() * 100; for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(x + k * 24, y + (k % 2) * 7, 20 + R() * 12, 0, 7); c.fill(); } }
      c.fillStyle = '#6fa36a'; c.beginPath(); c.moveTo(0, 330); for (let x = 0; x <= STAGE_W; x += 70) c.lineTo(x, 250 + Math.sin(x * .005) * 40 + R() * 20); c.lineTo(STAGE_W, 330); c.fill();
      // templo
      const tx = STAGE_W / 2, base = GROUND - 120;
      c.fillStyle = '#efe6d2'; c.fillRect(tx - 260, base - 120, 520, 120);
      c.fillStyle = '#c9b48f'; for (let x = tx - 240; x <= tx + 240; x += 60) c.fillRect(x - 9, base - 118, 18, 118);
      for (let k = 0; k < 3; k++) {
        const w = 620 - k * 170, y = base - 120 - k * 70;
        c.fillStyle = k % 2 ? '#d9661f' : '#e8782a';
        c.beginPath(); c.moveTo(tx - w / 2 - 30, y + 8); c.quadraticCurveTo(tx, y - 18, tx + w / 2 + 30, y + 8); c.lineTo(tx + w / 2 - 20, y - 28); c.lineTo(tx - w / 2 + 20, y - 28); c.closePath(); c.fill();
        c.fillStyle = '#8a3a12'; c.fillRect(tx - w / 2 + 10, y + 2, w - 20, 6);
        if (k < 2) { c.fillStyle = '#efe6d2'; c.fillRect(tx - w / 2 + 70, y - 70, w - 140, 42); }
      }
      c.fillStyle = '#ffd21f'; c.beginPath(); c.arc(tx, base - 340, 12, 0, 7); c.fill();
      c.fillStyle = '#2a1408'; c.font = '900 26px system-ui,sans-serif'; c.textAlign = 'center'; c.fillText('GRAN TORNEO', tx, base - 150);
    },
    mid(c, R) {
      // gradas con público a los costados del ring
      const shirts = ['#d52b1e', '#ffffff', '#0038a8', '#ffd21f', '#1d9e49', '#ff8a1e'];
      for (let y = GROUND - 150; y < GROUND - 40; y += 14) {
        for (let x = 0; x < STAGE_W; x += 12) {
          if (x > STAGE_W / 2 - 300 && x < STAGE_W / 2 + 300) continue;
          if (R() < .12) continue;
          c.fillStyle = shirts[R() * shirts.length | 0]; c.fillRect(x, y + 5, 9, 8);
          c.fillStyle = ['#e3b08a', '#b07a52', '#7a4e30'][R() * 3 | 0]; c.beginPath(); c.arc(x + 4.5, y + 2, 3.6, 0, 7); c.fill();
        }
      }
      c.fillStyle = '#9a8e78'; c.fillRect(0, GROUND - 46, STAGE_W, 16);
    },
    fx(c, camx, T) {
      const ox = -camx * .6;
      for (const fx0 of this.flags) {
        const x = ox + fx0, top = GROUND - 250;
        c.fillStyle = '#5a4a3a'; c.fillRect(x - 3, top, 6, 220);
        c.fillStyle = ['#d52b1e', '#0038a8', '#ffd21f'][fx0 % 3];
        c.beginPath(); c.moveTo(x + 3, top + 4);
        for (let k = 0; k <= 6; k++) c.lineTo(x + 3 + k * 9, top + 4 + Math.sin(T * .12 + k * .9 + fx0) * 5);
        for (let k = 6; k >= 0; k--) c.lineTo(x + 3 + k * 9, top + 34 + Math.sin(T * .12 + k * .9 + fx0) * 5);
        c.fill();
      }
    },
    floor(c, R) {
      c.fillStyle = '#b9ad97'; c.fillRect(0, 12, STAGE_W, 28);
      c.fillStyle = '#8a7e68'; c.fillRect(0, 34, STAGE_W, 6);
      c.fillStyle = '#ddd5c3'; c.fillRect(0, FL, STAGE_W, H);
      let y = FL, h = 12;
      while (y < H) {
        const tw = h * 4.2, off = (y / h | 0) % 2 ? tw / 2 : 0;
        for (let x = -off; x < STAGE_W; x += tw) { c.fillStyle = R() < .5 ? '#d3cab6' : '#e2dac9'; c.fillRect(x + 1.5, y + 1.5, tw - 3, h - 3); }
        y += h; h += 4;
      }
    }
  }
];
const ARENA = STAGES.length - 1;
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
// a qué distancia conviene usar cada habilidad
const AI_SPEC = {
  fire: d => d > 200, ice: d => d > 180, sonic: d => d > 80 && d < 300, boom: d => d > 120 && d < 330, bomb: d => d > 150 && d < 480, meteor: () => true,
  charge: d => d < 400, slam: d => d < 320, tele: () => true, whip: d => d > 90 && d < 235, upper: d => d < 110, spin: d => d < 220,
  grab: d => d < 90, dive: d => d > 120 && d < 300, counter: () => false, heal: (d, f) => f.hp < f.maxHp * .6 && d > 230
};
function cpuThink(f, o, S, lv) {
  const L = AI_LV[lv] || AI_LV.normal, ai = f.ai || (f.ai = { t: 0, mv: null, def: 0, saw: false });
  const dx = o.x - f.x, dist = Math.abs(dx), tw = dx > 0 ? 'r' : 'l', aw = dx > 0 ? 'l' : 'r';
  const h = S.h; for (const k in h) h[k] = 0;
  const comingAt = q => q.o === o && Math.sign(f.x - q.x) === Math.sign(q.vx);
  const threat = ((o.st === 'attack' || (o.st === 'special' && o.spec !== 'fire')) && dist < 190)
    || G.proj.some(p => comingAt(p) && Math.abs(p.x - f.x) < 230) || G.waves.some(w => comingAt(w) && Math.abs(w.x - f.x) < 170);
  if (threat && !ai.saw) {
    ai.saw = true;
    // la Muralla aprovecha el ataque para su contragolpe
    if (f.ch.special === 'counter' && f.en >= SPEC_COST && dist < 170 && Math.random() < L.sp + .2 && ['idle', 'walk', 'crouch'].includes(f.st)) { S.t.s++; return; }
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
    const good = AI_SPEC[sp] ? AI_SPEC[sp](dist, f) : true;
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
  mode: 'demo', phase: 'intro', pf: 0, round: 1, timer: 60, tf: 0, time: 0, f: [], proj: [], waves: [], parts: [], bolts: [], mets: [], need: 2, scrFlash: 0, fin: null, fatal: null,
  stage: 0, hitstop: 0, shake: 0, slow: 0, ann: null, combo: null, paused: false, cam: { x: 0 }, winner: -1, ev: [], src: [], lvl: 'normal', setup: null, maxD: 850
};
const P_IDLE = { t: .08, a1: .75, a2: 2.55, b1: .35, b2: 2.25, l1: .42, l2: .05, m1: -.38, m2: -.2 };
const P_CROUCH = { t: .7, a1: 1.05, a2: 2.55, b1: .75, b2: 2.35, l1: 1.35, l2: .1, m1: .55, m2: -1.25 };
const P_TUCK = { t: .1, a1: 1.0, a2: 2.4, b1: .3, b2: 1.9, l1: 1.45, l2: -.1, m1: .55, m2: -.9 };

const newSeeds = () => [Math.random() * 1e9 | 0, Math.random() * 1e9 | 0];
function mkFighter(i, sel, seed) {
  const ch = CHARS[sel.ch] || CHARS.toro;
  const f = { i, ch, key: CHARS[sel.ch] ? sel.ch : 'toro', name: (sel.name || '').trim() || ('Jugador ' + (i + 1)), faceUrl: sel.face || null, img: faceImg(sel.face), yaw: sel.yaw ?? yawOf(sel.face), wins: 0, maxHp: ch.hp, en: 0, hurt: 0, wt: {}, wounds: mkWounds(seed) };
  placeFighter(f); return f;
}
function placeFighter(f) {
  Object.assign(f, {
    x: STAGE_W / 2 + (f.i ? 170 : -170), y: 0, vx: 0, vy: 0, face: f.i ? -1 : 1, tx: 0, ty: 0,
    hp: f.maxHp, hpLag: f.maxHp, st: 'idle', sf: 0, atk: null, an: '', hitDone: false, stun: 0, combo: 0, flash: 0, alpha: 1, rot: 0, inv: 0,
    buf: { p: 0, k: 0, s: 0 }, pose: { ...P_IDLE }, ai: null, spec: null, slamLand: 0, crouchBlock: false, pal: 0, squash: 0, inflate: 0, thin: 0, upside: false, pin: false, seq: [], holdBack: 0, holdDown: 0, airAtk: false, en: 0
  });
  f.tx = f.x; f.ty = 0;
}
function setSt(f, st) { if (f.st !== st) { f.st = st; f.sf = 0; } }

function startMatch(setup) {
  G.paused = false; G.setup = setup; G.mode = setup.mode; G.need = setup.need || 2; G.me = setup.me ?? -1; G.tourTitle = setup.title || ''; G.stage = setup.stage; G.lvl = setup.lvl || 'normal'; G.lvls = setup.lvls || null;
  const seeds = G.seeds = setup.seeds || newSeeds();
  G.f = [mkFighter(0, setup.sel[0], seeds[0]), mkFighter(1, setup.sel[1], seeds[1])];
  const mine = [S_KB1, S_T[0], S_PAD[0], S_PAD[1]];
  G.src = {
    demo: [[S_CPU[0]], [S_CPU[1]]], bots: [[S_CPU[0]], [S_CPU[1]]], cpu: [mine, [S_CPU[1]]],
    host: [mine, [S_NET]], guest: [[], []], spect: [[S_CPU[0]], [S_CPU[1]]]
  }[G.mode];
  // en el torneo cada lado lo maneja quien ocupa ese lugar: vos, un amigo conectado o la máquina
  if (G.mode === 'tour') G.src = [setup.tour.a, setup.tour.b].map((s, i) => tourSrc(s, i, mine));
  // a cuál de los dos peleadores manejo yo en esta pantalla (-1 = solo miro)
  G.meIdx = { cpu: 0, host: 0, guest: 1, spect: G.me }[G.mode] ?? (G.mode === 'tour' ? G.src.findIndex(s => s === mine) : -1);
  for (const S of [S_KB1, ...S_T, ...S_PAD, ...S_CPU, S_NET]) for (const k in S.t) S.t[k] = 0;
  // los que miran pueden tener pantallas más angostas: en la sala de bots los peleadores no se separan tanto
  G.maxD = Math.min(W, G.mode === 'host' ? NET.rW || W : (G.mode === 'bots' || G.mode === 'tour') && roomHost() ? 760 : W) - 110;
  G.emo = []; G.conf = []; G.hype = [0, 0];
  if (G.mode === 'bots' && botsRoom()) { G.ev = []; netCast(startMsg()); }
  G.round = 1; G.parts = []; startRound();
  if (G.mode !== 'demo') beginPlay();
}
function startRound() {
  G.f.forEach(placeFighter);
  Object.assign(G, { proj: [], waves: [], bolts: [], mets: [], phase: 'intro', pf: 0, timer: 60, tf: 0, winner: -1, combo: null, hitstop: 0, slow: 0, ann: null, fin: null, fatal: null });
}
function ann(text) { fx('ann', text); }
function phaseStep() {
  G.pf++;
  const [a, b] = G.f;
  if (G.phase === 'intro') {
    if (G.pf === 1) { const fin = G.need > 1 && a.wins === G.need - 1 && b.wins === G.need - 1, one = G.need === 1; ann(one ? 'PELEA ÚNICA' : fin ? 'RONDA FINAL' : 'RONDA ' + G.round); fx('say', one ? 'Pelea única' : fin ? 'Ronda final' : 'Ronda ' + (['uno', 'dos', 'tres', 'cuatro', 'cinco'][G.round - 1] || G.round)); }
    if (G.pf === 72) { ann('¡A PELEAR!'); fx('say', '¡A pelear!'); }
    if (G.pf >= 95) { G.phase = 'fight'; G.pf = 0; }
  } else if (G.phase === 'fight') {
    if (++G.tf >= 60) { G.tf = 0; G.timer--; if (G.timer <= 5 && G.timer > 0) fx('sfx', 'beep'); if (G.timer <= 0) { G.phase = 'time'; G.pf = 0; } }
  } else if (G.phase === 'finish') {
    // ¡ACABALO!: el ganador tiene 5 segundos para hacer su combinación
    if (G.pf >= FINISH_T) {
      const o = G.f[1 - G.fin.w]; o.st = 'ko'; o.sf = 0; o.vy = 4; o.y = .1; o.vx = 0;
      G.fin = null; G.phase = 'ko'; G.pf = 80;
    }
  } else if (G.phase === 'fatal') {
    const F = G.fatal, w = G.f[F.w];
    if (G.pf === 150) { ann('¡REMATE FATAL!'); fx('say', 'Remate fatal'); }
    if (G.pf === 240) { ann('¡GANA ' + w.name.toUpperCase() + '!'); fx('say', 'Gana ' + w.name); }
    if (G.pf >= 350) { G.phase = 'over'; G.pf = 0; fx('end'); }
  } else if (G.phase === 'ko' || G.phase === 'time') {
    if (G.phase === 'ko' && G.fin && G.pf === 70) { startFinish(); return; }
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
      if (a.wins >= G.need || b.wins >= G.need || G.round >= 5) { G.phase = 'over'; G.pf = 0; fx('end'); }
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
    case 'hit': case 'block': case 'frozen':
      f.vx *= .86; if (--f.stun <= 0) setSt(f, inp.h.d ? 'crouch' : 'idle'); break;
    case 'held': return; // lo tiene agarrado el luchador: él lo mueve
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
  else if (f.st === 'special' && (f.spec === 'upper' || f.spec === 'dive')) { setSt(f, 'land'); f.vx = 0; fx('dust', f.x, 10); fx('sfx', 'land'); }
}
function spawnProj(f, kind, speed) {
  const s = f.ch.b.s;
  G.proj.push({ x: f.x + f.face * 62 * s, y: (kind === 'bomb' ? 135 : 115) * s, vx: speed * f.face, vy: kind === 'bomb' ? 8 : 0, dir: f.face, o: f, t: 0, kind });
}
function startAttack(f, name) {
  f.atk = ATK[name]; f.an = name; f.st = 'attack'; f.sf = 0; f.hitDone = false;
  if (f.y <= 0) f.vx = 0;
  fx('sfx', 'whoosh');
}
function startSpecial(f, o) {
  f.en -= SPEC_COST; f.spec = f.ch.special; setSt(f, 'special'); f.sf = 0; f.hitDone = false; f.vx = 0; f.slamLand = 0;
  if (f.spec === 'slam') { f.vy = 11; f.y = .1; }
  f.grab = null;
  fx('aura', f.x, 110 * f.ch.b.s, f.i); fx('sfx', 'power');
}
function specialStep(f, o) {
  const t = f.sf, s = f.ch.b.s, sp = f.spec;
  // las que tiran algo: [cuadro en que sale, velocidad, cuadro en que termina]
  const SHOT = { fire: [13, 8.5, 34], ice: [14, 6.5, 36], sonic: [10, 9, 32], boom: [10, 12, 30], bomb: [12, 6, 30] }[sp];
  if (SHOT) {
    f.vx = 0;
    if (t === SHOT[0]) { spawnProj(f, sp, SHOT[1]); fx('sfx', { fire: 'fire', ice: 'ice', sonic: 'sonic' }[sp] || 'whoosh'); }
    if (t >= SHOT[2]) setSt(f, 'idle');
  } else if (sp === 'whip') {
    f.vx = 0; if (t === 7) fx('sfx', 'whip'); if (t >= 30) setSt(f, 'idle');
  } else if (sp === 'upper') {
    if (t < 3) f.vx = 0;
    if (t === 3) { f.vy = 14.5; f.y = .1; f.vx = 2.5 * f.face; fx('sfx', 'charge'); }
    if (t < 12) f.inv = 2;
    if (t > 3 && t % 2 === 0 && f.y > 0) fx('flame', f.x + f.face * 30, f.y + 150);
  } else if (sp === 'spin') {
    if (t >= 6 && t < 46) { f.vx = 5 * f.face; if ((t - 6) % 8 === 0) { f.hitDone = false; fx('sfx', 'whoosh'); } } else f.vx *= .7;
    if (t >= 56) setSt(f, 'idle');
  } else if (sp === 'counter') {
    f.vx = 0; if (t >= 44) setSt(f, 'idle');
  } else if (sp === 'heal') {
    f.vx = 0;
    if (t >= 10 && t < 50 && t % 5 === 0) { f.hp = Math.min(f.maxHp, f.hp + 2); fx('heal', f.x, 150 * s); if (t % 10 === 0) fx('sfx', 'gulp'); }
    if (t >= 60) setSt(f, 'idle');
  } else if (sp === 'meteor') {
    f.vx = 0;
    if (t === 16) { for (let k = 0; k < 3; k++) G.mets.push({ x: o.x + (k - 1) * 75 + rnd(-15, 15), y: 640 + k * 140, vy: -13, o: f }); fx('sfx', 'power'); }
    if (t >= 34) setSt(f, 'idle');
  } else if (sp === 'grab') {
    if (f.grab) grabStep(f, o);
    else {
      if (t >= 6 && t < 13) { f.vx = 3 * f.face; if (Math.abs(o.x - f.x) < 82 * s && o.y < 20 && canHurt(o)) startGrab(f, o); }
      else f.vx = 0;
      if (!f.grab && t >= (f.grabbed ? 52 : 34)) { f.grabbed = false; setSt(f, 'idle'); }
    }
  } else if (sp === 'dive') {
    if (t === 2) { f.vy = 13; f.y = .1; f.vx = 6 * f.face; fx('sfx', 'jump'); }
    if (t === 16) { f.vy = -11; f.vx = 11 * f.face; f.hitDone = false; fx('sfx', 'whoosh'); }
  } else if (sp === 'charge') {
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
// agarre del luchador: lo levanta por arriba de la cabeza y lo estrella del otro lado
function startGrab(f, o) {
  f.grab = { t: 0 }; f.vx = 0;
  Object.assign(o, { st: 'held', sf: 0, vx: 0, vy: 0, atk: null, alpha: 1 });
  fx('sfx', 'grab');
}
function grabStep(f, o) {
  const g = f.grab, k = Math.min(1, ++g.t / 22);
  o.x = f.x + f.face * lerp(45, -40, k); o.y = 50 + Math.sin(k * Math.PI) * 120; o.face = -f.face;
  if (g.t === 24) {
    o.x = f.x - f.face * 68; o.y = 25; o.st = 'fall';
    f.grab = null; f.grabbed = true; f.sf = 30; f.face = -f.face;
    applyHit(f, o, ATK.grab, o.x, 40); fx('shake', 14); fx('dust', o.x, 20); fx('sfx', 'slam');
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
  if (f.st === 'attack' && f.atk) { const a = f.atk; if (f.sf >= a.su && f.sf < a.su + a.ac) return a; }
  if (f.st === 'special') {
    const t = f.sf, sp = f.spec;
    if (sp === 'charge' && t >= 8 && t < 26) return ATK.charge;
    if (sp === 'whip' && t >= 8 && t < 14) return ATK.whip;
    if (sp === 'upper' && t >= 3 && t < 16) return ATK.upper;
    if (sp === 'spin' && t >= 6 && t < 46) return ATK.spin;
    if (sp === 'dive' && t >= 16) return ATK.dive;
  }
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
const canHurt = f => f.inv <= 0 && f.alpha > .5 && !['down', 'ko', 'getup', 'win', 'held', 'dizzy'].includes(f.st);
const overlap = (a, b) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
function canBlock(d, a) {
  if (a.lv === 'throw' || d.y > 0 || !['idle', 'walk', 'crouch', 'block'].includes(d.st) || !d.holdBack) return false;
  if (a.lv === 'low' && !d.holdDown) return false;
  if (a.lv === 'over' && d.holdDown) return false;
  return true;
}
function applyHit(att, def, a, px, py) {
  const dir = Math.sign(def.x - att.x) || att.face;
  // Muralla en postura de contraataque: no recibe el golpe y, si el otro está cerca, se lo devuelve
  if (def.st === 'special' && def.spec === 'counter' && def.sf >= 3 && def.sf < 44 && a.lv !== 'throw') {
    fx('block', px, py); fx('sfx', 'counter'); G.hitstop = 6;
    if (Math.abs(att.x - def.x) < 170 && canHurt(att)) {
      def.face = Math.sign(att.x - def.x) || def.face;
      def.st = 'attack'; def.atk = ATK.k; def.an = 'k'; def.sf = ATK.k.su; def.hitDone = true;
      applyHit(def, att, ATK.counter, att.x, 110);
    } else def.sf = 44;
    return;
  }
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
    // si con esto ganó la pelea, viene el remate
    G.fin = att.wins >= G.need ? { w: att.i, cpuAt: 45 + (Math.random() * 70 | 0) } : null;
    fx('hit', px, py, 1); fx('sfx', 'ko'); fx('shake', 18); ann('K.O.'); fx('say', 'K O'); G.hitstop = 22; return;
  }
  def.grab = null;
  if (a.knock || def.y > 0) { def.st = 'fall'; def.sf = 0; def.vy = a.launch || 6; def.y = Math.max(def.y, .1); def.vx = dir * (Math.abs(a.push) * .8 + 1.5); }
  else { def.st = a.freeze ? 'frozen' : 'hit'; def.sf = 0; def.stun = a.st; def.vx = dir * a.push; if (a.freeze) fx('sfx', 'ice'); }
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
  // lo que se tira: bolas de energía y de hielo, grito, bumerán y bombas
  for (const p of G.proj) {
    p.x += p.vx; p.t++;
    const d = G.f[1 - p.o.i], k = p.kind || 'fire';
    if (k === 'boom') { // frena, da la vuelta y vuelve a la mano
      p.vx -= p.dir * .22;
      if (!p.ret && Math.sign(p.vx) !== p.dir) { p.ret = true; p.hitNow = false; }
      if ((p.ret && Math.abs(p.x - p.o.x) < 35) || p.t > 180) p.dead = true;
    } else if (k === 'bomb') { p.vy -= .45; p.y += p.vy; if (p.y <= 0) { explode(p); continue; } }
    else if (k === 'sonic' && p.t > 42) p.dead = true;
    const r = k === 'sonic' ? 26 + p.t * .7 : 18;
    if (!p.dead && !p.hitNow && canHurt(d)) {
      const hu = hurtOf(d);
      if (p.x + r > hu.x1 && p.x - r < hu.x2 && p.y + r > hu.y1 && p.y - r < hu.y2) {
        if (k === 'bomb') { explode(p); continue; }
        if (k === 'boom') p.hitNow = true; else p.dead = true;
        applyHit(p.o, d, ATK[k], p.x, p.y);
      }
    }
    if (Math.abs(p.x - (G.cam.x + W / 2)) > W) p.dead = true;
  }
  for (const p of G.proj) for (const q of G.proj) if (p !== q && p.o !== q.o && !p.dead && !q.dead && p.kind !== 'bomb' && q.kind !== 'bomb' && Math.abs(p.x - q.x) < 30 && Math.abs(p.y - q.y) < 60) { p.dead = q.dead = true; fx('hit', (p.x + q.x) / 2, p.y, 1); }
  G.proj = G.proj.filter(p => !p.dead);
  // meteoritos que caen del cielo
  for (const m of G.mets) {
    m.y += m.vy;
    if (m.y <= 0) {
      m.dead = true; fx('boom', m.x, 10);
      const d = G.f[1 - m.o.i];
      if (canHurt(d) && Math.abs(d.x - m.x) < 72 && d.y < 110) applyHit(m.o, d, ATK.meteor, d.x, 40);
    }
  }
  G.mets = G.mets.filter(m => !m.dead);
  // ondas del golpe al suelo
  for (const w of G.waves) {
    w.x += w.vx; w.life--;
    const d = G.f[1 - w.o.i];
    if (!w.hit && canHurt(d) && d.y < 25 && Math.abs(d.x - w.x) < 34) { w.hit = true; w.life = Math.min(w.life, 8); applyHit(w.o, d, ATK.wave, w.x, 20); }
  }
  G.waves = G.waves.filter(w => w.life > 0);
}
function explode(p) {
  p.dead = true; fx('boom', p.x, 15);
  const d = G.f[1 - p.o.i];
  if (canHurt(d) && Math.abs(d.x - p.x) < 95 && d.y < 110) applyHit(p.o, d, ATK.bomb, d.x, 40);
}
function separate() {
  const [a, b] = G.f;
  if (Math.abs(a.y - b.y) > 95 || ['down', 'ko', 'held'].includes(a.st) || ['down', 'ko', 'held'].includes(b.st)) return;
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

/* ------------------------- remates (¡ACABALO!) -------------------------
   Al ganar la pelea, el perdedor queda mareado y el ganador puede hacer la combinación de su
   personaje. D = abajo, F = adelante, B = atrás, P = puño, K = patada, S = habilidad.
   anim = la animación (varios personajes comparten animación con su propio estilo). */
const FINISH_T = 300;
const FATAL = {
  toro: { name: 'Cornada voladora', seq: ['D', 'F', 'P'], anim: 'charge' },
  rayo: { name: 'Electrocución', seq: ['D', 'D', 'P'], anim: 'fire' },
  sombra: { name: 'Mil patadas', seq: ['B', 'B', 'K'], anim: 'tele' },
  tanque: { name: 'Aplastada', seq: ['D', 'D', 'K'], anim: 'slam' },
  escarcha: { name: 'Congelado y roto', seq: ['D', 'B', 'P'], anim: 'freeze' },
  latigo: { name: 'Revoleada con el lazo', seq: ['F', 'F', 'P'], anim: 'lasso' },
  dragon: { name: 'Gancho al cielo', seq: ['D', 'F', 'K'], anim: 'launch' },
  tornado: { name: 'Huracán', seq: ['B', 'F', 'K'], anim: 'tornado' },
  muralla: { name: 'Sándwich de piedra', seq: ['B', 'D', 'P'], anim: 'walls' },
  terere: { name: 'Termazo', seq: ['B', 'B', 'P'], anim: 'termo' },
  meteoro: { name: 'Meteorito gigante', seq: ['D', 'D', 'S'], anim: 'boom' },
  luchador: { name: 'Clavado de cabeza', seq: ['F', 'D', 'P'], anim: 'piledriver' },
  halcon: { name: 'Vuelo sin regreso', seq: ['F', 'F', 'K'], anim: 'eagle' },
  sonico: { name: 'Grito que lo infla', seq: ['B', 'B', 'S'], anim: 'inflate' },
  bumeran: { name: 'Lluvia de bumeranes', seq: ['D', 'B', 'K'], anim: 'boomers' },
  bombita: { name: 'Cuenta regresiva', seq: ['F', 'D', 'K'], anim: 'bombtag' }
};
const SEQ_ICON = { D: '⬇️', F: '➡️', B: '⬅️', P: '👊', K: '🦶', S: '⚡' };
function trackSeq(f, inp) {
  const fw = f.face > 0 ? inp.h.r : inp.h.l, bk = f.face > 0 ? inp.h.l : inp.h.r, p = f.pv || (f.pv = {});
  f.seq = f.seq || [];
  const push = t => { f.seq.push([t, G.time]); if (f.seq.length > 8) f.seq.shift(); };
  if (inp.h.d && !p.d) push('D'); if (fw && !p.f) push('F'); if (bk && !p.b) push('B');
  for (const [k, t] of [['p', 'P'], ['k', 'K'], ['s', 'S']]) for (let n = 0; n < inp.t[k]; n++) push(t);
  p.d = inp.h.d; p.f = fw; p.b = bk;
}
function seqMatch(f, seq) {
  const s = (f.seq || []).filter(e => G.time - e[1] < 100).map(e => e[0]);
  return s.length >= seq.length && seq.every((t, i) => s[s.length - seq.length + i] === t);
}
function startFinish() {
  const o = G.f[1 - G.fin.w], w = G.f[G.fin.w];
  Object.assign(o, { st: 'dizzy', sf: 0, y: 0, vy: 0, vx: 0, inv: 9999, alpha: 1 });
  setSt(w, 'idle'); w.seq = []; w.buf = { p: 0, k: 0, s: 0 };
  G.phase = 'finish'; G.pf = 0;
  ann('¡ACABALO!'); fx('say', '¡Acabalo!');
}
function startFatal() {
  const w0 = G.f[G.fin.w], FD0 = FATAL[w0.key] || FATAL.toro;
  G.fatal = { w: G.fin.w, type: FD0.anim, style: FD0.style || '', hit: 0 };
  G.fin = null; G.phase = 'fatal'; G.pf = 0; G.ann = null;
  const w = G.f[G.fatal.w]; w.vx = 0; setSt(w, 'idle'); w.hitDone = true;
  fx('sfx', 'power'); fx('aura', w.x, 110, w.i);
}
// paletas para el electrocutado: radiografía (esqueleto) y carbonizado
const PAL = new Map();
function palette(ch, kind) {
  const key = ch.name + kind; let p = PAL.get(key); if (p) return p;
  const col = kind === 1 ? { shirt: '#0d1a24', pants: '#0d1a24', arm: '#0d1a24', neck: '#0d1a24', glove: '#e8f6ff', shoe: '#0d1a24', belt: '#e8f6ff', line: '#e8f6ff' }
    : kind === 3 ? { shirt: '#9fdcff', pants: '#7cc4f0', arm: '#9fdcff', neck: '#9fdcff', glove: '#e8fbff', shoe: '#5aa9e6', belt: '#e8fbff', line: '#2a6a9a' } // congelado
      : { shirt: '#2a2522', pants: '#1f1b19', arm: '#2a2522', neck: '#2a2522', glove: '#1a1716', shoe: '#111', belt: '#3a3330', line: '#000' };
  const c = { ...ch.c, ...col, camo: null, scarf: ch.c.scarf ? col.shirt : null }; c.dark = {}; for (const n of ['shirt', 'pants', 'arm', 'glove', 'shoe']) c.dark[n] = shade(c[n], -.2);
  p = { ...ch, c }; PAL.set(key, p); return p;
}
function phys(f) {
  if (f.pin) return false; // lo mueve el remate a mano
  f.x += f.vx;
  if (f.y > 0 || f.vy > 0) { f.y += f.vy; f.vy -= f.st === 'fly' ? .12 : GRAV; if (f.y <= 0 && f.st !== 'fly') { f.y = 0; f.vy = 0; return true; } }
  return false;
}
function fatalStep() {
  const F = G.fatal, t = G.pf, w = G.f[F.w], o = G.f[1 - F.w], dir = o.x >= w.x ? 1 : -1;
  w.sf++; o.sf++; if (w.flash > 0) w.flash--; if (o.flash > 0) o.flash--;
  const lw = phys(w), lo = phys(o);
  if (lo && o.st === 'ko') { G.shake = Math.max(G.shake, 7); fx('dust', o.x, 18); }
  switch (F.type) {
    case 'charge': // cornada: lo embiste y lo manda a volar hasta el cielo
      if (t === 1) { w.st = 'special'; w.spec = 'charge'; w.sf = 0; w.face = dir; }
      if (!F.hit && t > 1) {
        w.sf = Math.min(w.sf, 20);
        if (t < 14) w.vx = 0; else { w.vx = 16 * w.face; if (t % 3 === 0) fx('dust', w.x - w.face * 20, 4); if (t === 14) fx('sfx', 'charge'); }
        if (Math.abs(o.x - w.x) < 70) {
          F.hit = t; Object.assign(o, { st: 'fly', sf: 0, vx: w.face * 11, vy: 19, y: .1, hurt: 1, flash: 12 });
          fx('hit', o.x, 120, 1); fx('sfx', 'ko'); fx('shake', 18);
        }
      } else if (F.hit) { w.vx *= .8; if (t === F.hit + 18) setSt(w, 'win'); if (t === F.hit + 55) fx('twinkle', o.x, 430); }
      break;
    case 'fire': // electrocución (o el grito del Sónico): esqueleto y queda carbonizado
      if (t === 1) { if (F.style === 'sonic') { w.st = 'special'; w.spec = 'sonic'; w.sf = 10; w.face = dir; } else setSt(w, 'win'); }
      if (F.style === 'sonic') w.sf = 12;
      if (t >= 15 && t < 100) {
        o.st = 'zapped'; o.pal = (t >> 2) % 2 ? 1 : 0; o.x += t % 2 ? 3 : -3;
        if (t % 6 === 0) { if (F.style === 'sonic') fx('rings', w.x + dir * 60, 120); else fx('bolt', o.x + rnd(-25, 25)); o.flash = 8; fx('shake', 6); }
      }
      if (t === 100 && F.style === 'sonic') setSt(w, 'win');
      if (t === 100) { o.pal = 2; Object.assign(o, { st: 'ko', sf: 0, vy: 5, y: .1, vx: 0, hurt: 1 }); fx('sfx', 'ko'); }
      if (t > 100 && t < 260 && t % 7 === 0) fx('soot', o.x + rnd(-30, 30), 20);
      break;
    case 'tele': // mil patadas: aparece de un lado y del otro pateándolo, y lo manda al cielo
      if (t === 1) { fx('sfx', 'tele'); fx('smoke', w.x, 90); }
      if (t < 12) w.alpha = 1 - t / 12;
      else if (t < 112) {
        const k = (t - 12) % 10, n = (t - 12) / 10 | 0;
        if (k === 0) { const side = n % 2 ? 1 : -1; w.x = o.x + side * 78; w.face = -side; w.alpha = 1; w.y = n % 3 === 2 ? 60 : 0; w.vy = 0; w.st = 'attack'; w.an = n % 2 ? 'tk' : 'k'; w.atk = ATK[w.an]; w.sf = 0; fx('smoke', w.x, 90); }
        if (k === 4) { fx('hit', o.x, 100 + rnd(-30, 40), 1); o.flash = 10; o.face = -o.face; o.st = 'hit'; o.sf = 0; G.shake = Math.max(G.shake, 5); }
      } else if (t === 112) { w.y = 0; w.x = o.x - dir * 82; w.face = dir; w.st = 'attack'; w.an = 'tk'; w.atk = ATK.tk; w.sf = 0; }
      else if (t === 116) { Object.assign(o, { st: 'fly', sf: 0, vx: dir * 2, vy: 24, y: .1, hurt: 1 }); fx('hit', o.x, 130, 1); fx('sfx', 'ko'); fx('shake', 16); }
      else if (t === 135) setSt(w, 'win');
      else if (t === 170) fx('twinkle', o.x, 430);
      break;
    case 'slam': // aplastada: salta altísimo y cae encima, lo deja chato
      if (t === 1) { w.st = 'special'; w.spec = 'slam'; w.slamLand = 0; w.sf = 0; w.vy = 23; w.y = .1; w.vx = (o.x - w.x) / (2 * 23 / GRAV); fx('sfx', 'jump'); }
      if (lw && !F.hit) {
        F.hit = t; w.vx = 0; w.slamLand = w.sf || 1; w.x = o.x;
        Object.assign(o, { st: 'flat', sf: 0, hurt: 1, flash: 12 });
        fx('sfx', 'slam'); fx('shake', 22); fx('dust', o.x, 34); fx('hit', o.x, 30, 1);
      }
      if (F.hit && t === F.hit + 30) { w.st = 'jump'; w.sf = 0; w.vy = 9; w.y = .1; w.vx = -dir * 3.5; } // se baja de arriba del panqueque
      else if (F.hit && lw && w.st === 'jump') { setSt(w, 'win'); w.vx = 0; fx('dust', w.x, 6); }
      break;
    case 'freeze': // lo congela entero y lo hace pedazos
      if (t === 1) { w.st = 'special'; w.spec = 'ice'; w.sf = 0; w.face = dir; }
      if (t === 14) { o.st = 'frozen'; o.stun = 999; o.pal = 3; fx('sfx', 'ice'); fx('icebits', o.x, 100); }
      if (t > 14 && t < 80) { if (t % 4 === 0) { o.x += t % 8 ? 2 : -2; fx('icebits', o.x, 100); } }
      if (t === 40) setSt(w, 'idle');
      if (t === 80) { fx('shatter', o.x, 100); Object.assign(o, { st: 'ko', sf: 0, vy: 4, y: .1, hurt: 1 }); fx('sfx', 'ko'); setSt(w, 'win'); }
      break;
    case 'launch': // se acerca y lo manda de un golpe hasta el cielo
      if (!F.hit) {
        w.face = dir;
        if (Math.abs(o.x - w.x) > 78) { w.st = 'walk'; w.vx = 5.5 * dir; }
        else {
          F.hit = t; w.st = 'special'; w.spec = 'upper'; w.sf = 4; w.vy = 11; w.y = .1; w.vx = 0;
          Object.assign(o, { st: 'fly', sf: 0, vx: dir * 4, vy: 26, y: .1, hurt: 1, flash: 12 });
          fx('hit', o.x, 150, 1); fx('sfx', 'ko'); fx('shake', 18);
        }
      } else {
        if (w.st === 'special') { w.sf = 6; if (t % 2 === 0) fx('flame', w.x, w.y + 160); }
        if (lw) { setSt(w, 'win'); w.vx = 0; }
        if (t === F.hit + 55) fx('twinkle', o.x, 430);
      }
      break;
    case 'boom': // cae un meteorito (o una bomba) gigante encima
      if (t === 1) { w.st = 'special'; w.spec = 'meteor'; w.sf = 0; w.face = dir; }
      if (w.st === 'special') w.sf = Math.min(w.sf, 20);
      if (t === 18) G.mets.push({ x: o.x, y: 760, vy: -15, o: w, big: true, kind: F.style === 'bomb' ? 'bomb' : '' });
      for (const m of G.mets) {
        m.y += m.vy;
        if (m.y <= 40 && !F.hit) {
          F.hit = t; m.dead = true; fx('boom', o.x, 10, 1); fx('sfx', 'ko');
          Object.assign(o, { st: 'fly', sf: 0, vx: dir * 7, vy: 24, y: .1, hurt: 1, pal: 2, flash: 12 }); setSt(w, 'win');
        }
      }
      G.mets = G.mets.filter(m => !m.dead);
      if (F.hit && t === F.hit + 60) fx('twinkle', o.x, 430);
      break;
    case 'inflate': // Sónico: lo infla a gritos como un globo hasta que revienta
      if (t === 1) { w.st = 'special'; w.spec = 'sonic'; w.face = dir; }
      if (w.st === 'special') w.sf = 12;
      if (t > 8 && t < 104) {
        o.st = 'dizzy'; o.inflate = Math.min(1.3, (t - 8) / 90 * 1.3); o.x += t % 2 ? 1.5 : -1.5;
        if (t % 7 === 0) { fx('rings', w.x + dir * 60, 120); fx('shake', 3); }
      }
      if (t === 104) { o.inflate = 0; fx('boom', o.x, 90, 1); fx('say', '¡Pum!'); Object.assign(o, { st: 'fly', sf: 0, vx: dir * 3, vy: 24, y: .1, hurt: 1, flash: 12 }); setSt(w, 'win'); }
      if (t === 165) fx('twinkle', o.x, 430);
      break;
    case 'tornado': // Tornado: arma un huracán que lo chupa dando vueltas y lo revolea
      if (t === 1) { w.st = 'special'; w.spec = 'spin'; w.face = dir; F.cx = w.x; }
      if (w.st === 'special') w.sf = 6 + (t % 36);
      if (t >= 22 && t < 124) {
        const k = (t - 22) / 102; o.pin = true; o.st = 'fly';
        o.x = F.cx + Math.sin(t * .32) * 80 * (1 - k * .4); o.y = k * 360;
        if (t % 9 === 0) { fx('dust', F.cx, 10); fx('sfx', 'whoosh'); }
      }
      if (t === 124) { o.pin = false; o.vx = dir * 11; o.vy = 9; o.hurt = 1; fx('sfx', 'ko'); }
      if (t === 128) setSt(w, 'win');
      if (t === 175) fx('twinkle', o.x, 430);
      break;
    case 'boomers': // Bumerán: un montón de bumeranes le pegan por todos lados y uno se lo lleva
      if (t === 1) { w.st = 'special'; w.spec = 'boom'; w.face = dir; }
      if (w.st === 'special') w.sf = 12;
      if (t >= 12 && t < 100 && t % 8 === 4) { fx('hit', o.x + rnd(-25, 25), 100 + rnd(-40, 50), 1); o.st = 'hit'; o.sf = 0; o.face = -o.face; o.flash = 8; fx('shake', 4); }
      if (t === 100) { o.pin = true; o.st = 'fly'; o.hurt = 1; F.bx = o.x; fx('sfx', 'whoosh'); }
      if (t > 100 && t < 160) { o.x += dir * 13; o.y = 110 + Math.sin((t - 100) * .15) * 40; }
      if (t === 104) setSt(w, 'win');
      if (t === 160) { o.pin = false; o.vy = 6; fx('twinkle', o.x, 300); }
      break;
    case 'walls': // Muralla: dos paredes de piedra salen del piso y lo dejan finito como un papel
      if (t === 1) { w.st = 'special'; w.spec = 'counter'; w.face = dir; F.cx = o.x; fx('shake', 6); fx('sfx', 'slam'); }
      if (w.st === 'special') w.sf = 10;
      if (t === 10) o.st = 'dizzy';
      if (t === 54) { o.thin = 1; o.st = 'idle'; o.flash = 12; o.hurt = 1; fx('shake', 22); fx('sfx', 'slam'); fx('dust', F.cx, 30); fx('hit', F.cx, 110, 1); }
      if (t === 96) { setSt(w, 'win'); fx('sfx', 'land'); }
      if (t === 118) { Object.assign(o, { st: 'ko', sf: 0, vy: 2, y: .1 }); fx('sfx', 'whoosh'); } // se cae como una hoja
      break;
    case 'piledriver': // Luchador: lo da vuelta, salta y lo clava de cabeza en el piso
      if (t === 1) { w.st = 'special'; w.spec = 'grab'; w.grab = { t: 0 }; w.face = dir; Object.assign(o, { pin: true, st: 'held', upside: true }); fx('sfx', 'grab'); }
      if (!F.hit) {
        if (t === 12) { w.vy = 17; w.y = .1; fx('sfx', 'jump'); }
        o.x = w.x + w.face * 8; o.y = w.y + 390; // cabeza abajo arriba de la del luchador
        if (t > 14 && lw) {
          F.hit = t; w.grab = null; F.cx = o.x; o.x = F.cx; o.y = 115; o.st = 'stuck'; o.hurt = 1; o.flash = 12;
          fx('boom', F.cx, 0); fx('shake', 24); fx('sfx', 'slam'); fx('dust', F.cx, 40);
          w.st = 'jump'; w.sf = 0; w.vy = 8; w.y = .1; w.vx = -dir * 3.5;
        }
      } else if (lw && w.st === 'jump') { setSt(w, 'win'); w.vx = 0; }
      break;
    case 'lasso': // Látigo: lo enlaza, lo revolea por arriba de la cabeza y lo tira lejos
      if (t === 1) { w.st = 'special'; w.spec = 'whip'; w.sf = 9; w.face = dir; fx('sfx', 'whip'); }
      if (w.st === 'special') w.sf = 3;
      if (t >= 18 && t < 112) {
        const a = (t - 18) * .19 - Math.PI / 2 * dir; o.pin = true; o.st = 'fly';
        o.x = w.x + Math.cos(a) * 135; o.y = 165 + Math.sin(a) * 100;
        if (t % 12 === 0) fx('sfx', 'whoosh');
      }
      if (t === 112) { o.pin = false; o.vx = dir * 13; o.vy = 17; o.hurt = 1; fx('sfx', 'whip'); setSt(w, 'win'); }
      if (t === 168) fx('twinkle', o.x, 430);
      break;
    case 'termo': // Tereré: le cae un termo gigante en la cabeza
      if (t === 1) { setSt(w, 'win'); F.cx = o.x; o.st = 'dizzy'; }
      if (t === 44) { F.hit = t; fx('hit', o.x, 200, 1); fx('sfx', 'slam'); fx('shake', 18); o.squash = .5; o.flash = 12; o.hurt = 1; fx('say', '¡Toing!'); }
      if (t > 44 && t < 100) o.squash = Math.max(o.squash, .3);
      if (t === 100) Object.assign(o, { st: 'ko', sf: 0, vy: 3, y: .1 });
      break;
    case 'eagle': // Halcón: se lo lleva volando fuera de la pantalla y lo suelta desde el cielo
      if (t === 1) { w.pin = true; w.st = 'special'; w.spec = 'dive'; w.sf = 2; F.sx = w.x; F.sy = w.y; }
      if (t < 20) { const k = t / 20; w.x = lerp(F.sx, o.x, k); w.y = lerp(F.sy, 210, k); }
      if (t === 20) { o.pin = true; o.st = 'held'; fx('sfx', 'grab'); }
      if (t >= 20 && t < 70) { w.y += 10; o.x = w.x; o.y = w.y - 120; w.sf = 2; }
      if (t === 100) { o.pin = false; Object.assign(o, { st: 'fall', y: 720, vy: -24, vx: 0 }); fx('sfx', 'whoosh'); }
      if (t > 100 && lo && !F.hit) { F.hit = t; o.st = 'ko'; o.hurt = 1; fx('boom', o.x, 0, 1); fx('shake', 24); }
      if (t === 130) { w.x = o.x - dir * 120; w.y = 600; w.pin = false; w.st = 'jump'; w.vy = -4; }
      if (t > 130 && lw && w.st === 'jump') setSt(w, 'win');
      break;
    case 'bombtag': // Bombita: le pega una bomba con cuenta regresiva
      if (t === 1) { w.st = 'special'; w.spec = 'bomb'; w.sf = 0; w.face = dir; }
      if (t === 14) { o.st = 'dizzy'; F.tag = true; fx('sfx', 'grab'); setSt(w, 'idle'); }
      if (t === 30 || t === 60 || t === 90) fx('sfx', 'beep');
      if (t === 40) w.x -= dir * 60;
      if (t === 120) { F.tag = false; o.pal = 2; Object.assign(o, { st: 'fly', sf: 0, vx: dir * 4, vy: 22, y: .1, hurt: 1, flash: 12 }); fx('boom', o.x, 60, 1); fx('say', '¡Bum!'); setSt(w, 'win'); }
      if (t === 178) fx('twinkle', o.x, 430);
      break;
  }
}

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
    case 'ice': return t < 14 ? { ...P_IDLE, t: -.15, a1: -.7, a2: .5, b1: -.8, b2: .4 } : { ...P_IDLE, t: .3, a1: 1.55, a2: 1.6, b1: 1.2, b2: 2.2 };
    case 'sonic': return t < 10 ? { ...P_IDLE, t: -.3, a1: -.4, a2: .2, b1: -.6, b2: 0 } : { ...P_IDLE, t: .35, a1: 1.9, a2: 2.2, b1: 1.6, b2: 2.0, l1: .6, m1: -.55 };
    case 'boom': case 'bomb': return t < 10 ? { ...P_IDLE, t: -.2, a1: -2.4, a2: -2.0, b1: .8, b2: 1.6 } : { ...P_IDLE, t: .3, a1: 1.4, a2: 1.2, b1: .2, b2: 1.0, l1: .65, m1: -.5 };
    case 'whip': return t < 8 ? { ...P_IDLE, t: -.2, a1: -.5, a2: .3 } : { ...P_IDLE, t: .3, a1: 1.6, a2: 1.5, l1: .6, m1: -.5 };
    case 'upper': return t < 3 ? P_CROUCH : { t: -.1, a1: 2.95, a2: 3.1, b1: .3, b2: 1.2, l1: 1.2, l2: .3, m1: -.1, m2: -.05 };
    case 'spin': return t >= 6 && t < 46 ? { t: 0, a1: 1.6, a2: 1.6, b1: -1.6, b2: -1.6, l1: 1.57, l2: 1.57, m1: -.1, m2: -.05 } : P_IDLE;
    case 'counter': return { ...P_IDLE, t: -.05, a1: 1.3, a2: 2.9, b1: 1.1, b2: 2.8, l1: .5, m1: -.45 };
    case 'heal': return { ...P_IDLE, t: -.1, a1: 1.1, a2: 3.05 };
    case 'meteor': return t < 30 ? { ...P_IDLE, t: -.1, a1: 2.9, a2: 3.1, b1: 2.8, b2: 3.0 } : P_IDLE;
    case 'grab': return f.grab ? { ...P_IDLE, t: -.15, a1: 2.8, a2: 3.0, b1: 2.7, b2: 3.0, l1: .5, m1: -.5 } : t < 6 ? P_CROUCH : { ...P_IDLE, t: .45, a1: 1.5, a2: 1.6, b1: 1.4, b2: 1.6 };
    case 'dive': return t < 16 ? P_TUCK : { t: -.25, a1: 2.2, a2: 2.6, b1: -1.2, b2: -.6, l1: 1.0, l2: 1.05, m1: .4, m2: -.9 };
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
    case 'frozen': return { ...f.pose }; // queda duro como estaba
    case 'held': return { t: -.5, a1: 2.4, a2: 2.8, b1: -2.2, b2: -1.6, l1: 1.1, l2: .6, m1: .6, m2: .1 };
    case 'dizzy': { const s = Math.sin(T * .09 + f.i); return { t: .2 + s * .22, a1: .15 + s * .2, a2: .35, b1: -.15 - s * .2, b2: .05, l1: .25 + s * .1, l2: .05, m1: -.25 + s * .1, m2: -.1 }; }
    case 'zapped': { const j = () => rnd(-.25, .25); return { t: j() * .5, a1: 2.3 + j(), a2: 2.5 + j(), b1: -2.1 + j(), b2: -2.3 + j(), l1: .65 + j(), l2: .6, m1: -.65 + j(), m2: -.6 }; }
    case 'fly': return { t: -.5, a1: 2.4, a2: 2.8, b1: -2.2, b2: -1.6, l1: 1.1, l2: .6, m1: .6, m2: .1 };
    case 'flat': return { t: 0, a1: 1.57, a2: 1.57, b1: -1.57, b2: -1.57, l1: .35, l2: .35, m1: -.35, m2: -.35 };
    case 'stuck': { const k = Math.sin(T * .5); return { t: 0, a1: .3, a2: .3, b1: -.3, b2: -.3, l1: .5 + k * .5, l2: .2 + k * .6, m1: -.5 + k * .5, m2: -.2 + k * .6 }; } // clavado de cabeza: patalea
  }
  return P_IDLE;
}
function poseStep(f) {
  const tp = targetPose(f), k = f.st === 'attack' || f.st === 'special' || f.st === 'hit' || f.st === 'zapped' ? .5 : .28;
  for (const key in tp) f.pose[key] = lerp(f.pose[key] ?? tp[key], tp[key], k);
  if (f.st === 'fly') f.rot += .28 * (f.vx >= 0 ? 1 : -1) * f.face; // da vueltas por el aire
  else { const rt = (f.st === 'down' || f.st === 'ko') && f.y <= 2 ? -1.57 : (f.st === 'fall' || f.st === 'ko') ? -.8 : f.st === 'held' ? -1.4 : 0; f.rot = lerp(f.rot, rt, .2); }
  f.squash = lerp(f.squash || 0, f.st === 'flat' ? 1 : 0, .45);
  if (f.upside) f.rot = Math.PI; // cabeza abajo
  f.hpLag = f.hpLag > f.hp ? Math.max(f.hp, f.hpLag - .4) : f.hp;
}

/* ------------------------- efectos ------------------------- */
function fx(type, a, b, c) { runFx(type, a, b, c); if (G.mode === 'host' || ((G.mode === 'bots' || G.mode === 'tour') && roomHost())) G.ev.push([type, a, b, c]); }
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
    case 'bolt': G.bolts.push({ x: a, l: 7, seed: Math.random() * 1e6 | 0 }); G.scrFlash = 4; SFX.zap(); sparks(a, 120, 10, '#bff3ff', 7); break;
    case 'twinkle': G.parts.push({ twinkle: 1, x: a, y: b, l: 50, L: 50 }); SFX.twinkle(); break;
    case 'soot': G.parts.push({ x: a, y: b + 100, vx: rnd(-.4, .4), vy: rnd(1, 1.8), l: 45, L: 45, c: 'rgba(60,55,55,.55)', r: rnd(7, 14), g: -.01, dust: 1 }); break;
    case 'boom': // explosión de bomba o meteorito
      sparks(a, b + 30, 26, '#ffb347', 10); sparks(a, b + 30, 14, '#fff3a0', 7);
      G.parts.push({ ring: 1, x: a, y: b + 30, l: 16, L: 16, c: '#ff8a1e', r: c ? 200 : 95 });
      for (let i = 0; i < (c ? 30 : 12); i++) G.parts.push({ x: a + rnd(-40, 40), y: b + rnd(0, 60), vx: rnd(-2, 2), vy: rnd(1, 3), l: 40, L: 40, c: 'rgba(70,60,55,.6)', r: rnd(10, 20), g: -.02, dust: 1 });
      G.shake = Math.max(G.shake, c ? 24 : 11); SFX.boom(); break;
    case 'flame': G.parts.push({ x: a + rnd(-8, 8), y: b, vx: rnd(-1, 1), vy: rnd(-1, 1), l: 18, L: 18, c: Math.random() < .5 ? '#ff8a1e' : '#ffd21f', r: rnd(5, 9), g: 0, dust: 1 }); break;
    case 'heal': G.parts.push({ plus: 1, x: a + rnd(-25, 25), y: b, vx: rnd(-.4, .4), vy: 1.3, g: 0, l: 40, L: 40 }); break;
    case 'icebits': for (let i = 0; i < 4; i++) G.parts.push({ x: a + rnd(-30, 30), y: b + rnd(-60, 60), vx: rnd(-1, 1), vy: rnd(0, 2), l: 20, L: 20, c: '#e8fbff', r: rnd(2, 4), g: .15, spark: 1 }); break;
    case 'shatter': sparks(a, b, 40, '#bfeaff', 11); sparks(a, b, 20, '#ffffff', 8); G.parts.push({ ring: 1, x: a, y: b, l: 14, L: 14, c: '#e8fbff', r: 120 }); SFX.shatter(); G.shake = Math.max(G.shake, 16); break;
    case 'rings': for (let i = 0; i < 3; i++) G.parts.push({ ring: 1, x: a, y: b, l: 14 + i * 5, L: 14 + i * 5, c: '#c8ff5a', r: 80 + i * 30 }); SFX.sonic(); break;
  }
}
function sparks(x, y, n, col, spd) {
  for (let i = 0; i < n; i++) { const an = Math.random() * Math.PI * 2, v = rnd(.3, 1) * spd; G.parts.push({ x, y, vx: Math.cos(an) * v, vy: Math.sin(an) * v, l: rnd(10, 20), L: 20, c: col, r: rnd(2, 4.5), g: .25, spark: 1 }); }
}
function partsStep() {
  cheerStep();
  for (const b of G.bolts) b.l--;
  G.bolts = G.bolts.filter(b => b.l > 0);
  if (G.scrFlash > 0) G.scrFlash--;
  for (const p of G.parts) { p.l--; if (!p.ring && !p.twinkle) { p.x += p.vx; p.y += p.vy; p.vy -= p.g; if (p.spark) { p.vx *= .92; } } }
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
  if (G.mode === 'guest' || G.mode === 'spect') { guestStep(); return; }
  if (G.paused) return;
  if (G.hitstop > 0) { G.hitstop--; return; }
  if (G.slow > 0) { G.slow--; if (G.slow % 2) return; }
  phaseStep();
  if (G.phase === 'over' && G.mode !== 'demo') { G.f.forEach(poseStep); netTick(); return; } // sigue mandando: así llega el aviso del final
  const live = G.phase === 'fight', fin = G.phase === 'finish' && G.fin;
  if (G.phase === 'fatal') { fatalStep(); G.f.forEach(poseStep); netTick(); return; }
  G.f.forEach((f, i) => { if (G.src[i][0] === S_CPU[i] && live) cpuThink(f, G.f[1 - i], S_CPU[i], G.mode === 'demo' ? 'normal' : G.lvls ? G.lvls[i] : G.lvl); });
  const ins = G.f.map((f, i) => { const r = readSources(G.src[i]); return live || (fin && i === fin.w) ? r : EMPTY; });
  G.f.forEach((f, i) => fighterStep(f, G.f[1 - i], ins[i]));
  if (fin) {
    const w = G.f[fin.w];
    trackSeq(w, ins[fin.w]);
    const cpu = G.src[fin.w][0] === S_CPU[fin.w];
    if (seqMatch(w, FATAL[w.key].seq) || (cpu && G.pf === fin.cpuAt && Math.random() < .85)) startFatal();
  }
  combat(); separate(); bounds();
  G.f.forEach(poseStep);
  netTick();
  touchReady();
}
let lastReady = '';
function touchReady() {
  if (!$('#touch').classList.contains('on')) return;
  const me = G.meIdx >= 0 ? [G.f[G.meIdx]] : [];
  const key = me.map(f => f && f.en >= SPEC_COST ? 1 : 0).join('');
  if (key === lastReady) return; lastReady = key;
  document.querySelectorAll('#touch .btns').forEach(b => { const pi = +b.dataset.pi; b.querySelector('.bs').classList.toggle('ready', key[pi] === '1'); });
}

/* =========================== DIBUJO =========================== */
const SEG = { T: 38, S: 38, U: 30, F: 28 };
function drawFighter(c, f, sx, sy, sc = 1) {
  const ch = f.pal ? palette(f.ch, f.pal) : f.ch, B = ch.b, C = ch.c, P = f.pose, s = B.s * sc, OL = C.line, lw = B.limb, D = C.dark, T = G.time;
  // en el torbellino se da vuelta a cada rato (solo el dibujo, el golpe sigue para adelante)
  const vf = f.st === 'special' && f.spec === 'spin' && f.sf >= 6 && f.sf < 46 && (f.sf >> 2) & 1 ? -f.face : f.face;
  c.save(); c.translate(sx, sy); c.globalAlpha = f.alpha;
  if (f.st === 'special' && f.spec === 'counter' && f.sf >= 3 && f.sf < 44) glow(c, 0, -100 * s, 120 * s, `rgba(255,220,120,${.3 + Math.sin(T * .4) * .12})`);
  if (f.rot) c.translate(0, -16 * Math.min(1, Math.abs(f.rot) / 1.57) * s);
  c.scale(vf * s, s);
  if (f.squash > .01) c.scale(1 + f.squash * .9, 1 - f.squash * .8); // aplastado como panqueque
  if (f.inflate > .01) c.scale(1 + f.inflate, 1 + f.inflate * .85); // inflado como globo
  if (f.thin > .01) c.scale(1 - f.thin * .86, 1); // finito como un papel
  c.rotate(f.rot);
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
  if (C.cape) { // capa que flamea atrás
    const w1 = Math.sin(T * .15) * 6, w2 = Math.sin(T * .15 + 1) * 9;
    c.beginPath(); c.moveTo(shx + px * B.tw * .7, shy); c.lineTo(shx - px * B.tw * .9, shy);
    c.quadraticCurveTo(hx - 34 + w1, hy + 10, hx - 40 + w2, hy + 52); c.lineTo(hx - 4 + w1, hy + 46); c.closePath();
    c.fillStyle = C.cape; c.fill(); c.lineWidth = 3; c.strokeStyle = OL; c.stroke();
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
  if (C.stripes) { // camiseta a rayas (la albirroja)
    c.save(); c.clip(); c.translate(hx, hy); c.rotate(P.t); c.fillStyle = C.stripes;
    for (let k = -3; k <= 3; k += 2) c.fillRect(k * 7 - 3.5, -L - 10, 7, L + 14);
    c.restore();
  }
  if (C.emblem) { // símbolo en el pecho
    const mx = lerp(hx, nx, .55), my = lerp(hy, ny, .55);
    c.save(); c.translate(mx, my); c.rotate(P.t); c.font = `${Math.round(B.tw * .8)}px system-ui`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(C.emblem, 0, 1); c.restore();
  }
  c.lineWidth = 4; c.strokeStyle = OL; c.stroke();
  c.beginPath(); c.moveTo(hx + px * B.ww * 1.05, hy + py * B.ww * 1.05 - uy * 3); c.lineTo(hx - px * B.ww * 1.05, hy - py * B.ww * 1.05 - uy * 3);
  c.lineWidth = ch.special === 'charge' ? 10 : 7; c.strokeStyle = C.belt; c.stroke();
  // pierna de adelante
  limb(hx, hy, fkx, fky, lw * 1.15, C.pants); limb(fkx, fky, ffx, ffy, lw, C.pants); shoe(ffx, ffy, P.l2, C.shoe);
  // cuello y cara
  const R = 31, hcx = nx + ux * R * .78, hcy = ny + uy * R * .78;
  limb(nx, ny + 4, lerp(nx, hcx, .5), lerp(ny, hcy, .5), lw * .9, C.neck);
  c.save(); c.translate(hcx, hcy); c.scale(vf, 1); c.rotate(vf * P.t * .45);
  if (f.flash > 0) { const q = Math.sin(f.flash * 1.3) * .12; c.scale(1 + q, 1 - q); }
  drawFace(c, f.img, R, RING[f.i] || '#fff', f.flash, vf, f.yaw, f);
  if (C.hat) { c.save(); c.scale(vf, 1); drawHat(c, C.hat, C.hatc, R, OL, T); c.restore(); }
  if (((f.st === 'ko' || f.st === 'down') && f.y <= 2) || f.st === 'dizzy') { // estrellitas mareado
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
  if (f.st === 'special' && f.spec === 'ice' && f.sf < 15) { c.globalAlpha = f.alpha * .9; glow(c, (fhx + bhx) / 2, (fhy + bhy) / 2, 10 + f.sf * 1.5, 'rgba(210,245,255,.95)'); }
  if (f.st === 'special' && f.spec === 'whip' && f.sf >= 5 && f.sf < 18) { // el látigo
    const t = f.sf, Lw = t < 8 ? (t - 5) / 3 * 120 : t < 14 ? 232 : (18 - t) / 4 * 232;
    c.strokeStyle = '#4a2c12'; c.lineWidth = 4; c.beginPath(); c.moveTo(fhx, fhy);
    c.quadraticCurveTo(fhx + Lw * .5, fhy - 40 + (t >= 8 && t < 14 ? 20 : 0), Lw, -112); c.stroke();
    if (t >= 8 && t < 14) { c.fillStyle = '#fff3a0'; c.beginPath(); c.arc(Lw, -112, 6, 0, 7); c.fill(); }
  }
  if (f.st === 'special' && f.spec === 'heal') { // la guampa de tereré con su bombilla
    c.save(); c.translate(fhx, fhy - 6);
    c.fillStyle = '#7a5a2a'; c.strokeStyle = OL; c.lineWidth = 2.5; c.beginPath(); c.roundRect(-9, -14, 18, 24, 5); c.fill(); c.stroke();
    c.fillStyle = '#c9a227'; c.fillRect(-9, -14, 18, 4);
    c.strokeStyle = '#d8d8d8'; c.lineWidth = 3; c.beginPath(); c.moveTo(2, -12); c.lineTo(hcx - fhx - 6, hcy - fhy + R * .35 + 6); c.stroke();
    c.restore();
  }
  if (f.st === 'frozen' || f.pal === 3) { // bloque de hielo
    c.globalAlpha = f.alpha * (f.st === 'frozen' ? .5 : .25); c.fillStyle = '#bfeaff';
    c.beginPath(); c.roundRect(-44, -hipH - L - R * 2 - 10, 88, hipH + L + R * 2 + 12, 10); c.fill();
    c.globalAlpha = f.alpha * .8; c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.stroke();
    c.beginPath(); c.moveTo(-30, -hipH - L); c.lineTo(-14, -hipH - L - 30); c.moveTo(20, -40); c.lineTo(32, -70); c.stroke();
  }
  c.restore();
}
// sombreros y vinchas arriba de la cara (mirando a la derecha)
function drawHat(c, type, col, R, OL, T) {
  c.lineWidth = 2.5; c.strokeStyle = OL; c.fillStyle = col;
  if (type === 'cowboy') {
    c.beginPath(); c.ellipse(0, -R * .78, R * 1.25, R * .24, 0, 0, 7); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-R * .55, -R * .82); c.quadraticCurveTo(-R * .6, -R * 1.5, 0, -R * 1.38); c.quadraticCurveTo(R * .6, -R * 1.5, R * .55, -R * .82); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#3a2410'; c.fillRect(-R * .55, -R * .98, R * 1.1, R * .12);
  } else if (type === 'bush') {
    c.beginPath(); c.ellipse(0, -R * .8, R * 1.15, R * .2, 0, 0, 7); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(0, -R * .88, R * .62, R * .48, 0, Math.PI, 0); c.fill(); c.stroke();
    c.fillStyle = '#4a3a1a'; c.fillRect(-R * .62, -R * .95, R * 1.24, R * .1);
  } else if (type === 'band') { // vincha con las puntas para atrás
    c.strokeStyle = col; c.lineWidth = R * .2; c.lineCap = 'round';
    c.beginPath(); c.arc(0, R * .2, R * .98, Math.PI * 1.22, Math.PI * 1.78); c.stroke();
    c.lineWidth = R * .14; c.beginPath(); c.moveTo(-R * .78, -R * .45);
    c.quadraticCurveTo(-R * 1.2, -R * .3 + Math.sin(T * .3) * 4, -R * 1.5, -R * .1 + Math.sin(T * .3 + 1) * 6); c.stroke();
  }
}
// lo que aparece en algunos remates: huracán, bumeranes, paredes, pozo, lazo, termo y la bomba con cuenta regresiva
function drawFatalObjs(c, cx) {
  const F = G.fatal; if (!F || G.phase !== 'fatal') return;
  const t = G.pf, w = G.f[F.w], o = G.f[1 - F.w]; if (!w || !o) return;
  const X = x => x - cx, Y = y => GROUND - y;
  c.save();
  switch (F.type) {
    case 'tornado': if (t >= 8 && t < 140) {
      const a = Math.min(1, (t - 8) / 20) * (t > 124 ? Math.max(0, (140 - t) / 16) : 1), x0 = X(F.cx ?? w.x);
      c.globalAlpha = .5 * a;
      for (let k = 0; k < 14; k++) { c.strokeStyle = k % 2 ? '#d8dee4' : '#9aa6b2'; c.lineWidth = 7; c.beginPath(); c.ellipse(x0 + Math.sin(t * .3 + k * .7) * 12, GROUND - k * 30, 30 + k * 10, 9, 0, 0, 7); c.stroke(); }
    } break;
    case 'boomers':
      if (t >= 10 && t < 100) for (let k = 0; k < 6; k++) { const a = t * .22 + k * Math.PI / 3; drawShot(c, {}, X(o.x) + Math.cos(a) * 88, Y(110) + Math.sin(a) * 62, 'boom'); }
      if (t >= 100 && t < 160) drawShot(c, {}, X(o.x), Y(o.y) + 24, 'boom');
      break;
    case 'walls': {
      const x0 = X(F.cx ?? o.x), rise = Math.min(1, t / 24), close = t < 40 ? 0 : Math.min(1, (t - 40) / 14), sink = t > 92 ? Math.min(1, (t - 92) / 20) : 0;
      const h = 290 * rise * (1 - sink), gap = 122 - 106 * close;
      if (h < 2) break;
      for (const sd of [-1, 1]) {
        const bx = sd < 0 ? x0 - gap - 70 : x0 + gap;
        c.fillStyle = '#8a8f98'; c.fillRect(bx, GROUND - h, 70, h); c.strokeStyle = '#4a4f58'; c.lineWidth = 3; c.strokeRect(bx, GROUND - h, 70, h);
        c.fillStyle = '#6f747d'; for (let yy = GROUND - h + 8, r = 0; yy < GROUND - 10; yy += 28, r++) for (let k = 0; k < 2; k++) c.fillRect(bx + 5 + k * 32 + (r % 2) * 10, yy, 24, 22);
      }
      break;
    }
    case 'piledriver': if (F.hit) { // la tierra que le tapa la cabeza
      const x0 = X(F.cx ?? o.x);
      c.fillStyle = '#5a3d22'; c.beginPath(); c.roundRect(x0 - 75, GROUND - 6, 150, 90, 14); c.fill();
      c.fillStyle = '#7a5a3a'; c.beginPath(); c.ellipse(x0, GROUND - 4, 82, 16, 0, Math.PI, 0); c.fill();
      c.strokeStyle = '#3a2414'; c.lineWidth = 3; c.beginPath(); c.moveTo(x0 - 60, GROUND + 10); c.lineTo(x0 - 30, GROUND + 30); c.moveTo(x0 + 40, GROUND + 8); c.lineTo(x0 + 62, GROUND + 26); c.stroke();
    } break;
    case 'lasso': if (t >= 8 && t < 112) {
      const hx = X(w.x + w.face * 25), hy = Y(w.y + 150), k = Math.min(1, (t - 8) / 10), tx = lerp(hx, X(o.x), k), ty = lerp(hy, Y(o.y + 110), k);
      c.strokeStyle = '#c9a46a'; c.lineWidth = 4; c.beginPath(); c.moveTo(hx, hy); c.quadraticCurveTo((hx + tx) / 2, Math.min(hy, ty) - 30, tx, ty); c.stroke();
      if (k >= 1) { c.beginPath(); c.ellipse(tx, ty, 28, 12, 0, 0, 7); c.stroke(); }
    } break;
    case 'termo': {
      const x0 = X(F.cx ?? o.x), head = Y(o.y + 215) - 150; let top, rot = 0, dx = 0;
      if (t >= 8 && t <= 44) { const k = (t - 8) / 36; top = lerp(-200, head, k * k); }
      else if (t > 44 && t < 92) { const k = (t - 44) / 48; top = head - Math.sin(k * Math.PI) * 110; rot = k * 1.8; dx = (t - 44) * 2.4; }
      else break;
      c.translate(x0 + dx, top + 75); c.rotate(rot);
      c.fillStyle = '#2e8b57'; c.strokeStyle = '#123d24'; c.lineWidth = 4; c.beginPath(); c.roundRect(-34, -75, 68, 150, 14); c.fill(); c.stroke();
      c.fillStyle = '#c9a227'; c.fillRect(-34, -42, 68, 10); c.fillRect(-34, 32, 68, 10);
      c.fillStyle = '#1a1a1a'; c.beginPath(); c.roundRect(-24, -94, 48, 22, 6); c.fill();
      c.fillStyle = '#fff'; c.font = '900 17px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('PY', 0, 0);
      break;
    }
    case 'bombtag': if (F.tag) {
      const x = X(o.x), y = Y(o.y + 80);
      c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(x, y, 20, 0, 7); c.fill();
      c.strokeStyle = '#8a6a44'; c.lineWidth = 3; c.beginPath(); c.moveTo(x + 8, y - 16); c.quadraticCurveTo(x + 14, y - 28, x + 20, y - 26); c.stroke();
      glow(c, x + 20, y - 26, 12 + Math.sin(t) * 4, 'rgba(255,210,60,.95)');
      if (t >= 30) {
        const n = t < 60 ? 3 : t < 90 ? 2 : 1, fs = 70 + ((t - 30) % 30) * 1.4;
        c.font = `900 ${fs}px system-ui,sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 8; c.strokeStyle = '#3a0905'; c.fillStyle = '#ff4d3a';
        c.strokeText(n, x, Y(o.y + 270)); c.fillText(n, x, Y(o.y + 270));
      }
    } break;
  }
  c.restore();
}
function drawShot(c, p, x, y, k) {
  const T = G.time;
  if (k === 'ice') {
    glow(c, x, y, 44, 'rgba(200,240,255,.9)');
    c.save(); c.translate(x, y); c.rotate(T * .2); c.strokeStyle = '#ffffff'; c.lineWidth = 3;
    for (let i = 0; i < 3; i++) { c.rotate(Math.PI / 3); c.beginPath(); c.moveTo(-16, 0); c.lineTo(16, 0); c.stroke(); }
    c.restore(); c.fillStyle = '#e8fbff'; c.beginPath(); c.arc(x, y, 9, 0, 7); c.fill();
  } else if (k === 'sonic') {
    const r = 26 + p.t * .7, d = Math.sign(p.vx) || 1;
    c.strokeStyle = `rgba(200,255,90,${Math.max(0, 1 - p.t / 42)})`; c.lineWidth = 5;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(x - d * i * 14, y, r - i * 8, d > 0 ? -1 : Math.PI - 1, d > 0 ? 1 : Math.PI + 1); c.stroke(); }
  } else if (k === 'boom') {
    c.save(); c.translate(x, y); c.rotate(T * .55); c.fillStyle = '#c98a3a'; c.strokeStyle = '#3a2410'; c.lineWidth = 2.5;
    c.beginPath(); c.roundRect(-22, -5, 30, 10, 5); c.fill(); c.stroke(); c.beginPath(); c.roundRect(-5, -22, 10, 30, 5); c.fill(); c.stroke();
    c.restore();
  } else if (k === 'bomb') {
    c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(x, y, 15, 0, 7); c.fill();
    c.strokeStyle = '#8a6a44'; c.lineWidth = 3; c.beginPath(); c.moveTo(x + 6, y - 12); c.quadraticCurveTo(x + 12, y - 22, x + 18, y - 20); c.stroke();
    glow(c, x + 18, y - 20, 12 + Math.sin(T * 1.3) * 4, 'rgba(255,210,60,.95)');
    c.fillStyle = '#ffffff55'; c.beginPath(); c.arc(x - 5, y - 5, 4, 0, 7); c.fill();
  }
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
  drawFatalObjs(c, cx);
  for (const b of G.bolts) { // rayos del cielo
    const R = rng(b.seed + (G.time >> 1)), x0 = b.x - cx, yEnd = GROUND - 150;
    for (const [w, col] of [[14, 'rgba(120,200,255,.35)'], [6, '#bff3ff'], [2.5, '#fff']]) {
      c.strokeStyle = col; c.lineWidth = w; c.lineJoin = 'round'; c.beginPath(); c.moveTo(x0 + (R() - .5) * 60, 0);
      const R2 = rng(b.seed); for (let y = 40; y < yEnd; y += 40) c.lineTo(x0 + (R2() - .5) * 70, y);
      c.lineTo(x0, yEnd); c.stroke();
    }
  }
  for (const m of G.mets) { // meteoritos (o la bomba gigante del remate)
    const x = m.x - cx, y = GROUND - m.y, r = m.big ? 70 : 24;
    for (let k = 5; k >= 1; k--) { c.globalAlpha = .12 * (6 - k); glow(c, x - k * 6, y - k * 16, r * (1.2 - k * .08), 'rgba(255,140,40,.9)'); }
    c.globalAlpha = 1;
    if (m.kind === 'bomb') { c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.fillStyle = '#ffd21f'; c.beginPath(); c.arc(x + r * .5, y - r * .9, 9 + Math.sin(G.time) * 3, 0, 7); c.fill(); }
    else { c.fillStyle = '#6b4a2a'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.fillStyle = '#8a6a44'; c.beginPath(); c.arc(x - r * .3, y - r * .3, r * .35, 0, 7); c.arc(x + r * .35, y + r * .2, r * .22, 0, 7); c.fill(); }
  }
  for (const p of G.proj) {
    const x = p.x - cx, y = GROUND - p.y, d = Math.sign(p.vx), k = p.kind || 'fire';
    if (k !== 'fire') { drawShot(c, p, x, y, k); continue; }
    for (let k = 4; k >= 1; k--) { c.globalAlpha = .15 * (5 - k); glow(c, x - d * k * 14, y, 22 - k * 2, 'rgba(80,190,255,.9)'); }
    c.globalAlpha = 1; glow(c, x, y, 50, 'rgba(120,220,255,.95)');
    c.fillStyle = '#4ad1ff'; c.beginPath(); c.arc(x, y, 20 + Math.sin(G.time * .6) * 2, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, 12 + Math.sin(G.time * .6) * 2, 0, 7); c.fill();
    c.strokeStyle = '#bff3ff'; c.lineWidth = 2; c.beginPath();
    for (let k = 0; k < 3; k++) { const an = G.time * .4 + k * 2.1; c.moveTo(x, y); c.lineTo(x + Math.cos(an) * 24, y + Math.sin(an) * 24); } c.stroke();
  }
  for (const p of G.parts) {
    const x = p.x - cx, y = GROUND - p.y, k = p.l / p.L;
    if (p.plus) { c.globalAlpha = k; c.font = '900 24px system-ui'; c.textAlign = 'center'; c.fillStyle = '#3dff7a'; c.fillText('+', x, y); }
    else if (p.twinkle) { // estrellita donde desapareció volando
      const s = Math.sin((1 - k) * Math.PI) * 26; c.globalAlpha = 1; c.save(); c.translate(clamp(x, 30, W - 30), Math.max(30, y)); c.rotate(p.l * .15);
      c.fillStyle = '#fff6c0'; c.beginPath(); for (let q = 0; q < 8; q++) { const rr2 = q % 2 ? s * .25 : s, aa = q * Math.PI / 4; c.lineTo(Math.cos(aa) * rr2, Math.sin(aa) * rr2); } c.fill();
      glow(c, 0, 0, s * 1.4, 'rgba(255,240,170,.6)'); c.restore();
    } else if (p.ring) { c.globalAlpha = k; c.strokeStyle = p.c; c.lineWidth = 4 * k + 1; c.beginPath(); c.arc(x, y, p.r * (1.2 - k), 0, 7); c.stroke(); }
    else { c.globalAlpha = p.dust ? k * .8 : Math.min(1, k * 1.5); c.fillStyle = p.c; c.beginPath(); c.arc(x, y, p.dust ? p.r * (1.6 - k) : p.r, 0, 7); c.fill(); }
  }
  c.globalAlpha = 1;
  c.restore();
  if (G.mode === 'demo') { c.fillStyle = 'rgba(10,4,14,.45)'; c.fillRect(0, 0, W, H); return; }
  if (G.scrFlash > 0) { c.fillStyle = `rgba(230,245,255,${G.scrFlash * .12})`; c.fillRect(0, 0, W, H); }
  drawHUD(c);
  if (G.phase === 'finish' && G.fin) drawFinish(c); else if (G.phase !== 'fatal') drawKeys(c);
  drawCheer(c);
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
    for (let k = 0; k < G.need; k++) {
      const sx = right ? x + 14 + k * 22 : x + bw - 14 - k * 22, sy = y + bh + 30;
      c.beginPath(); c.arc(sx, sy, 7, 0, 7); c.fillStyle = k < f.wins ? '#ffc83d' : '#00000080'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#fff8'; c.stroke();
    }
    // carita
    c.save(); c.translate(right ? x + bw + 36 : x - 36, y + 14); drawFace(c, f.img, 27, RING[i], f.flash, i ? -1 : 1, f.yaw, f); c.restore();
  });
  if (G.tourTitle) { // en qué parte del torneo estamos
    c.save(); c.font = '900 14px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 4; c.strokeStyle = '#000';
    const t = '🏆 ' + G.tourTitle; c.strokeText(t, W / 2, 92); c.fillStyle = '#ffc83d'; c.fillText(t, W / 2, 92); c.restore();
  }
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
// barra de teclas para quien juega en la PC; la tecla se ilumina al apretarla
const SPEC_NAME = { charge: 'Embestida', fire: 'Bola de energía', tele: 'Teletransporte', slam: 'Golpe al suelo' };
function drawKeys(c) {
  if (isTouch() || G.meIdx < 0) return;
  const me = G.f[G.meIdx]; if (!me) return;
  const h = S_KB1.h, ready = me.en >= SPEC_COST;
  const items = [
    [['W', 'A', 'S', 'D'], 'moverse', [h.u, h.l, h.d, h.r]],
    [['V'], '👊 puño', [h.p]], [['B'], '🦶 patada', [h.k]], [['G'], '⤒ saltar', [h.u]],
    [['H'], '⚡ ' + (SPEC_NAME[me.ch.special] || 'habilidad') + (ready ? ' ¡LISTA!' : ''), [h.s], ready]
  ];
  c.save(); c.font = '800 14px system-ui,sans-serif'; c.textBaseline = 'middle';
  const K = 24, gap = 6, sp = 18;
  const widths = items.map(([ks, label]) => ks.length * (K + 3) + gap + c.measureText(label).width);
  const total = widths.reduce((a, b) => a + b, 0) + sp * (items.length - 1) + 24, y = H - 22;
  let x = (W - total) / 2;
  rr(c, x, y - 17, total, 34, 17); c.fillStyle = 'rgba(0,0,0,.55)'; c.fill();
  x += 12;
  items.forEach(([ks, label, on, glowIt], n) => {
    ks.forEach((k, j) => {
      rr(c, x, y - K / 2, K, K, 6); c.fillStyle = on[j] ? '#ffc83d' : glowIt ? (G.time % 30 < 15 ? '#b85cff' : '#7a2ebf') : '#ffffff26'; c.fill();
      c.lineWidth = 1.5; c.strokeStyle = '#ffffff70'; c.stroke();
      c.fillStyle = on[j] ? '#1a0d00' : '#fff'; c.textAlign = 'center'; c.fillText(k, x + K / 2, y + 1);
      x += K + 3;
    });
    c.textAlign = 'left'; c.fillStyle = glowIt ? '#f1d4ff' : '#ffffffd0'; c.fillText(label, x + gap - 3, y + 1);
    x += gap + c.measureText(label).width + sp;
  });
  c.restore();
}
// cartel del remate: la combinación del ganador y el tiempo que le queda
function drawFinish(c) {
  const w = G.f[G.fin.w]; if (!w) return;
  const F = FATAL[w.key], pc = !isTouch(), fr = w.face > 0;
  const icon = { D: '⬇️', F: fr ? '➡️' : '⬅️', B: fr ? '⬅️' : '➡️', P: '👊', K: '🦶', S: '⚡' };
  const key = { D: 'S', F: fr ? 'D' : 'A', B: fr ? 'A' : 'D', P: 'V', K: 'B', S: 'H' };
  const mine = G.meIdx === G.fin.w, cpu = G.src[G.fin.w] && G.src[G.fin.w][0] === S_CPU[G.fin.w] && G.mode !== 'spect';
  const left = Math.max(0, 1 - G.pf / FINISH_T), y = H - 92, bw = 460, x = (W - bw) / 2;
  c.save(); rr(c, x, y, bw, 78, 16); c.fillStyle = 'rgba(40,0,0,.75)'; c.fill(); c.lineWidth = 3; c.strokeStyle = '#ff4d3a'; c.stroke();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = '900 16px system-ui,sans-serif'; c.fillStyle = '#ffd9b0';
  c.fillText((mine ? 'Rematalo con ' : cpu ? w.name + ' va a rematar con ' : w.name + ' puede rematar con ') + F.name.toUpperCase(), W / 2, y + 18);
  const toks = F.seq, n = toks.length, sz = 34, gap = 16, tw = n * sz + (n - 1) * gap; let tx = W / 2 - tw / 2;
  const s = (w.seq || []).filter(e => G.time - e[1] < 100).map(e => e[0]);
  let done = 0; for (let k = n; k > 0; k--) if (toks.slice(0, k).every((t, i) => s[s.length - k + i] === t)) { done = k; break; }
  toks.forEach((t, i) => {
    rr(c, tx, y + 30, sz, sz, 9); c.fillStyle = i < done ? '#ffc83d' : '#ffffff22'; c.fill();
    c.font = '22px system-ui'; c.fillStyle = '#fff'; c.fillText(icon[t], tx + sz / 2, y + 48);
    if (pc) { c.font = '900 11px system-ui'; c.fillStyle = i < done ? '#1a0d00' : '#ffd9b0'; c.fillText(key[t], tx + sz - 6, y + 58); }
    tx += sz + gap;
  });
  rr(c, x + 14, y + 70, (bw - 28) * left, 4, 2); c.fillStyle = '#ff4d3a'; c.fill();
  c.restore();
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
// role: host / guest (pelea entre dos) o spect (mira una sala de bots); room: duel o bots
const NET = { peer: null, conn: null, role: null, room: 'duel', specs: new Set(), code: '', rsel: null, rW: 0, cnt: { p: 0, k: 0, s: 0, u: 0 }, last: { p: 0, k: 0, s: 0, u: 0 }, mask: -1, hello: 0 };
const botsRoom = () => NET.role === 'host' && NET.room === 'bots';
const roomHost = () => NET.role === 'host' && (NET.room === 'bots' || NET.room === 'tour');
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
// a todos los que miran la sala de bots (menos a uno, si se indica)
function netCast(m, except) { for (const c of NET.specs) if (c !== except && c.open) try { c.send(m); } catch (e) { } }
function netClose() {
  const c = NET.conn, p = NET.peer, specs = [...NET.specs];
  Object.assign(NET, { peer: null, conn: null, role: null, room: 'duel', rsel: null, mask: -1 }); NET.specs.clear();
  for (const s of specs) try { s.close(); } catch (e) { }
  try { c && c.close(); } catch (e) { } try { p && p.destroy(); } catch (e) { }
}
function netHost(room = 'duel') {
  if (typeof Peer === 'undefined') { oMsg('No se pudo cargar la conexión en línea.'); toast('No se pudo cargar la conexión en línea.'); return; }
  netClose(); NET.role = 'host'; NET.room = room; NET.code = genCode();
  const p = NET.peer = mkPeer(PFX + NET.code); oMsg('Creando sala…');
  p.on('open', () => {
    if (NET.peer !== p) return;
    if (room === 'bots') { audienceChanged(); toast('📡 Sala abierta: ' + NET.code); return; }
    $('#onA').style.display = 'none'; $('#onB').style.display = 'block'; $('#oShow').textContent = NET.code; oMsg('Esperando que tu amigo entre…');
  });
  p.on('connection', c => {
    if (NET.room === 'bots' || NET.room === 'tour') { if (NET.specs.size >= 40) c.on('open', () => { c.send({ t: 'full' }); setTimeout(() => c.close(), 500); }); else bindSpec(c); return; }
    if (NET.conn && NET.conn.open) { c.on('open', () => { c.send({ t: 'full' }); setTimeout(() => c.close(), 500); }); return; }
    bindConn(c);
  });
  p.on('error', e => { if (NET.peer !== p) return; if (e.type === 'unavailable-id') { netHost(room); return; } oMsg('Error de conexión (' + e.type + '). Probá de nuevo.'); if (room === 'bots') toast('Error de conexión (' + e.type + ').'); });
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
  c.on('open', () => {
    NET.conn = c; NET.rx = performance.now(); NET.last = { p: 0, k: 0, s: 0, u: 0 }; NET.cnt = { p: 0, k: 0, s: 0, u: 0 };
    // el anfitrión avisa qué tipo de sala es; el que entra espera ese aviso
    if (NET.role === 'host') { c.send({ t: 'room', kind: 'duel' }); sendHello(); $('#scrOnline').classList.remove('on'); openSelect('host'); toast('✅ ¡Conectados! Elijan sus peleadores.'); }
    else oMsg('Conectado. Entrando a la sala…');
  });
  c.on('data', onNet);
  c.on('close', () => { if (NET.conn === c) netLost(); });
  c.on('error', () => { });
}
function sendHello() { const d = SEL[0]; netSend({ t: 'hello', sel: { name: d.name, ch: d.ch, face: d.face, yaw: yawOf(d.face) }, W }); }
function helloSoon() { clearTimeout(NET.hello); NET.hello = setTimeout(sendHello, 250); }
function netLost() {
  if (!NET.role) return;
  toast(NET.role === 'spect' ? '🔌 Se cortó la conexión con la sala.' : '🔌 Se cortó la conexión con tu amigo.', 4500); netClose(); goMenu();
}
/* ---- sala de bots: el anfitrión simula la pelea y la manda a los que miran ---- */
function bindSpec(c) {
  c._side = -1; c._slot = -1; c._src = mkSrc(); c._last = { p: 0, k: 0, s: 0, u: 0 }; c._fk = [];
  c.on('open', () => { NET.specs.add(c); c.send({ t: 'room', kind: NET.room }); if (NET.room === 'tour') tourJoined(c); else if (G.mode === 'bots' && G.phase !== 'over') c.send(startMsg()); audienceChanged(); });
  c.on('data', m => onSpecMsg(c, m));
  c.on('close', () => { if (NET.specs.delete(c)) { tourLeft(c); audienceChanged(); } });
  c.on('error', () => { });
}
function startMsg() { return { t: 'start', kind: 'bots', stage: G.stage, seeds: G.seeds, sel: G.setup.sel.map(b => ({ name: b.name, ch: b.ch, face: b.face, yaw: b.yaw ?? yawOf(b.face) })) }; }
function onSpecMsg(c, m) {
  if (!m || !m.t) return;
  if (m.t === 'in') { readNetInput(c._src, c._last, m); return; }
  if (m.t === 'hello') { tourHello(c, m.sel); return; }
  if (m.t === 'side') { c._side = m.s === 0 || m.s === 1 ? m.s : -1; audienceChanged(); }
  else if (m.t === 'cheer') {
    const now = performance.now(); if (now - (c._ct || 0) < 150 || !CHEERS.includes(m.e) || (m.s !== 0 && m.s !== 1)) return;
    c._ct = now; cheerFx(m.s, m.e); netCast({ t: 'cheer', s: m.s, e: m.e }, c);
  } else if (m.t === 'bye') { NET.specs.delete(c); try { c.close(); } catch (e) { } audienceChanged(); }
}
// cuántos miran y cuántos apoyan a cada lado (el anfitrión también cuenta)
function audienceChanged() {
  const n = [0, 0]; for (const c of NET.specs) if (c._side >= 0) n[c._side]++;
  if (CHEER_SIDE >= 0) n[CHEER_SIDE]++;
  G.aud = { n, v: NET.specs.size }; netCast({ t: 'aud', n, v: NET.specs.size });
  if ($('#scrSelect').classList.contains('on') && selMode === 'bots') renderSelect();
}
// si el otro cierra la pestaña WebRTC a veces no avisa: nos mandamos un ping cada 2 s y cortamos a los 10 s de silencio
setInterval(() => {
  if (roomHost()) { netCast({ t: 'ping' }); return; }
  if (!NET.role || !(NET.conn && NET.conn.open)) return;
  netSend({ t: 'ping' });
  if (performance.now() - NET.rx > 12000) netLost();
}, 2000);
addEventListener('pagehide', () => { netSend({ t: 'bye' }); netCast({ t: 'bye' }); });
// controles que manda el otro: teclas apretadas (bits) y cuántas veces tocó cada botón
function readNetInput(S, last, m) {
  const b = m.m | 0; S.h.l = b & 1; S.h.r = b >> 1 & 1; S.h.u = b >> 2 & 1; S.h.d = b >> 3 & 1;
  ['p', 'k', 's', 'u'].forEach((k, i) => { const v = (m.c || [])[i] | 0; S.t[k] += Math.max(0, Math.min(5, v - last[k])); last[k] = v; });
}
function onNet(m) {
  NET.rx = performance.now();
  if (!m || !m.t) return;
  switch (m.t) {
    case 'room':
      $('#scrOnline').classList.remove('on');
      if (m.kind === 'tour') { NET.role = 'spect'; NET.room = 'tour'; CHEER_SIDE = -1; TT = null; sendHello(); toast('🏆 ¡Entraste al torneo!'); }
      else if (m.kind === 'bots') { NET.role = 'spect'; CHEER_SIDE = -1; showScreen('scrSpect'); $('#spCode').textContent = NET.code; toast('📺 ¡Entraste a mirar la pelea de bots!'); }
      else { sendHello(); openSelect('guest'); toast('✅ ¡Conectados! Elijan sus peleadores.'); }
      break;
    case 'hello': NET.rsel = m.sel; NET.rW = m.W || 960; if ($('#scrSelect').classList.contains('on')) renderSelect(); break;
    case 'full': oMsg('Esa sala ya está llena.'); netClose(); break;
    case 'start':
      if (NET.role === 'guest' && NET.rsel) { hideScreens(); startMatch({ mode: 'guest', sel: [NET.rsel, SEL[0]], stage: m.stage, seeds: m.seeds }); }
      else if (NET.role === 'spect' && m.kind === 'tour' && TT) { hideScreens(); startMatch({ mode: 'spect', sel: [ttSel(m.a), ttSel(m.b)], stage: m.stage, seeds: m.seeds, need: m.need, me: m.me, title: m.title }); }
      else if (NET.role === 'spect' && m.sel) { hideScreens(); startMatch({ mode: 'spect', sel: m.sel, stage: m.stage, seeds: m.seeds }); }
      break;
    case 'wait': if (NET.role === 'spect') { endPlay(); if (G.mode !== 'demo') startDemo(); showScreen('scrSpect'); } break;
    case 'cheer': if (m.s === 0 || m.s === 1) cheerFx(m.s, m.e); break;
    case 'tour': if (NET.role === 'spect') { const old = TT; TT = m.T; TT.you = m.you; ttQueue(old, TT); ttShow(); } break;
    case 'face': if (NET.role === 'spect') { TFACE[m.i] = m.f; if ($('#scrBracket').classList.contains('on')) renderBracket(); } break;
    case 'aud': G.aud = { n: m.n, v: m.v }; break;
    case 'sel': if (NET.role === 'guest') openSelect('guest'); break;
    case 's': if (G.mode === 'guest' || G.mode === 'spect') applySnap(m); break;
    case 'in':
      if (NET.role === 'host') readNetInput(S_NET, NET.last, m);
      break;
    case 'bye': netLost(); break;
  }
}
// cada 2 cuadros: al invitado (pelea en línea) o a todos los que miran la sala de bots
function netTick() {
  if (G.time % 2) return;
  if (G.mode === 'host') netSend(snapshot());
  else if ((G.mode === 'bots' || G.mode === 'tour') && roomHost()) { if (NET.specs.size) netCast(snapshot()); else G.ev.length = 0; }
}
function snapshot() {
  return {
    t: 's',
    f: G.f.map(f => ({ x: Math.round(f.x), y: Math.round(f.y), fc: f.face, hp: f.hp, en: Math.round(f.en), st: f.st, sf: f.sf, an: f.an, vx: Math.round(f.vx * 10) / 10, vy: Math.round(f.vy * 10) / 10, w: f.wins, fl: f.flash, al: Math.round(f.alpha * 100) / 100, cb: f.crouchBlock ? 1 : 0, sp: f.spec, sl: f.slamLand ? 1 : 0, hu: Math.round(f.hurt * 1000) / 1000, pl: f.pal || 0, inf: Math.round((f.inflate || 0) * 100) / 100, th: f.thin ? 1 : 0, up: f.upside ? 1 : 0 })),
    pr: G.proj.map(p => [Math.round(p.x), Math.round(p.y), Math.round(p.vx * 10) / 10, p.o.i, p.kind || 'fire', p.t]),
    mt: G.mets.map(m => [Math.round(m.x), Math.round(m.y), m.big ? 1 : 0, m.kind || '']),
    wv: G.waves.map(w => [Math.round(w.x), w.o.i, w.life]),
    ph: G.phase, pf: G.pf, fa: G.fatal ? { w: G.fatal.w, type: G.fatal.type, cx: G.fatal.cx, tag: G.fatal.tag ? 1 : 0, hit: G.fatal.hit } : null, fw: G.fin ? G.fin.w : -1, tm: G.timer, rd: G.round, cb: G.combo, ev: G.ev.splice(0)
  };
}
function applySnap(m) {
  m.f.forEach((d, i) => {
    const f = G.f[i]; if (!f) return;
    if (d.st !== f.st || d.sf < f.sf) f.sf = d.sf;
    Object.assign(f, { tx: d.x, ty: d.y, face: d.fc, hp: d.hp, en: d.en, st: d.st, an: d.an, atk: ATK[d.an] || null, vx: d.vx, vy: d.vy, wins: d.w, flash: d.fl, alpha: d.al, crouchBlock: !!d.cb, spec: d.sp, slamLand: d.sl ? (f.slamLand || f.sf) : 0, hurt: d.hu || 0, pal: d.pl || 0, inflate: d.inf || 0, thin: d.th || 0, upside: !!d.up });
    if (Math.abs(f.sf - d.sf) > 3) f.sf = d.sf;
  });
  G.proj = m.pr.map(a => ({ x: a[0], y: a[1], vx: a[2], o: G.f[a[3]], kind: a[4] || 'fire', t: a[5] || 0 }));
  G.mets = (m.mt || []).map(a => ({ x: a[0], y: a[1], big: !!a[2], kind: a[3] }));
  G.waves = m.wv.map(a => ({ x: a[0], o: G.f[a[1]], life: a[2], vx: 0 }));
  G.phase = m.ph; G.timer = m.tm; G.round = m.rd; G.combo = m.cb; G.pf = m.pf || 0; G.fatal = m.fa || null; G.fin = m.fw >= 0 ? { w: m.fw } : null;
  for (const e of m.ev) runFx(...e);
}
function guestStep() {
  // manda mis controles al anfitrión (el que solo mira no manda nada)
  if (G.mode === 'guest' || (G.mode === 'spect' && G.meIdx >= 0)) {
    const r = readSources([S_KB1, S_T[0], S_PAD[0], S_PAD[1]]);
    let tapped = false;
    for (const k of ['p', 'k', 's', 'u']) if (r.t[k]) { NET.cnt[k] += r.t[k]; tapped = true; }
    const mask = r.h.l | r.h.r << 1 | r.h.u << 2 | r.h.d << 3;
    if (mask !== NET.mask || tapped || G.time % 8 === 0) { NET.mask = mask; netSend({ t: 'in', m: mask, c: [NET.cnt.p, NET.cnt.k, NET.cnt.s, NET.cnt.u] }); }
  }
  for (const f of G.f) {
    f.x = lerp(f.x, f.tx, .45); f.y = Math.abs(f.ty - f.y) > 80 ? f.ty : lerp(f.y, f.ty, .6); f.sf++;
    poseStep(f);
  }
  for (const p of G.proj) { p.x += p.vx; p.t = (p.t || 0) + 1; }
  for (const w of G.waves) w.x += Math.sign(w.x - G.f[w.o.i].x) * 7.5;
  if (G.phase !== 'fatal') camFollow(); // en el remate la cámara se queda quieta (el perdedor sale volando)
  touchReady();
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
  $('#btnPause').textContent = ['host', 'guest', 'spect'].includes(G.mode) ? '✕' : '⏸';
  if (!isTouch()) $('#touch').className = '';
  else { if (G.meIdx < 0) $('#touch').className = ''; else { buildTouch(1); lastReady = ''; } goFull(); }
  if (G.meIdx < 0 && ['bots', 'spect', 'tour'].includes(G.mode)) buildCheer(); else $('#cheer').classList.remove('on');
  audio();
}
function endPlay() { document.body.classList.remove('playing'); $('#hudBtns').classList.remove('on'); $('#touch').className = ''; $('#cheer').classList.remove('on'); TOUCH.clear(); G.paused = false; }

/* ---------- hinchada: elegís a quién apoyás y tirás emojis o confeti desde su lado ---------- */
const CHEERS = ['👏', '🔥', '💪', '😂', '😱', '❤️', '🎊'];
let CHEER_SIDE = -1, cheerLast = 0;
function buildCheer() {
  const el = $('#cheer'), [a, b] = G.f;
  el.innerHTML = `<button class="side s0" data-side="0">⬅️ ${esc(a.name)}</button>${CHEERS.map(e => `<button class="emo" data-e="${e}">${e}</button>`).join('')}<button class="side s1" data-side="1">${esc(b.name)} ➡️</button>`;
  el.classList.add('on'); paintCheer();
  el.querySelectorAll('[data-side]').forEach(n => n.onclick = () => {
    CHEER_SIDE = +n.dataset.side; paintCheer();
    if (NET.role === 'spect') netSend({ t: 'side', s: CHEER_SIDE }); else if (roomHost()) audienceChanged(); else G.aud = { n: [+(CHEER_SIDE === 0), +(CHEER_SIDE === 1)], v: 0 };
  });
  el.querySelectorAll('[data-e]').forEach(n => n.onclick = () => {
    if (CHEER_SIDE < 0) { toast('Primero elegí a quién apoyás: ⬅️ o ➡️'); return; }
    const now = performance.now(); if (now - cheerLast < 160) return; cheerLast = now;
    const e = n.dataset.e; audio(); cheerFx(CHEER_SIDE, e);
    if (NET.role === 'spect') netSend({ t: 'cheer', s: CHEER_SIDE, e }); else if (roomHost()) netCast({ t: 'cheer', s: CHEER_SIDE, e });
  });
}
function paintCheer() {
  document.querySelectorAll('#cheer [data-side]').forEach(n => n.classList.toggle('on', +n.dataset.side === CHEER_SIDE));
  $('#cheer').classList.toggle('pick', CHEER_SIDE < 0);
}
const CONF_COL = ['#ffc83d', '#e8312a', '#2f7bff', '#1d9e49', '#ff5fa8', '#ffffff', '#b85cff'];
function cheerFx(s, e) {
  if (!G.emo) return;
  G.hype[s] = Math.min(100, G.hype[s] + (e === '🎊' ? 9 : 4));
  if (e === '🎊') {
    for (let i = 0; i < 55; i++) G.conf.push({ x: s ? W + 10 : -10, y: H * .62 + rnd(-50, 50), vx: (s ? -1 : 1) * rnd(5, 15), vy: rnd(-12, -3), r: rnd(0, 6.3), vr: rnd(-.3, .3), c: CONF_COL[i % CONF_COL.length], w: rnd(6, 11), h: rnd(3, 6), l: rnd(90, 150) });
    if (G.conf.length > 600) G.conf.splice(0, G.conf.length - 600);
    SFX.confetti();
  } else {
    G.emo.push({ e, x: s ? W - rnd(40, 230) : rnd(40, 230), y: H - 70, vy: rnd(-2.8, -1.6), ph: rnd(0, 6), l: 120, L: 120, sz: rnd(30, 44) });
    if (G.emo.length > 70) G.emo.shift();
    SFX.pop();
  }
}
function cheerStep() {
  if (!G.emo) return;
  for (const p of G.emo) { p.y += p.vy; p.l--; p.x += Math.sin(p.l * .08 + p.ph) * .7; }
  G.emo = G.emo.filter(p => p.l > 0);
  for (const p of G.conf) { p.x += p.vx; p.y += p.vy; p.vy += .25; p.vx *= .985; p.r += p.vr; p.l--; }
  G.conf = G.conf.filter(p => p.l > 0 && p.y < H + 20);
  G.hype[0] *= .996; G.hype[1] *= .996;
}
function drawCheer(c) {
  if (!['bots', 'spect', 'tour'].includes(G.mode)) return;
  for (const p of G.conf) { c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.globalAlpha = Math.min(1, p.l / 30); c.fillStyle = p.c; c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); c.restore(); }
  c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const p of G.emo) { c.globalAlpha = Math.min(1, p.l / 30); c.font = `${p.sz}px system-ui`; c.fillText(p.e, p.x, p.y); }
  c.globalAlpha = 1;
  // hinchada de cada lado y cuántos miran
  const a = G.aud || { n: [0, 0], v: 0 }, bw = 150, y = 104;
  for (let s = 0; s < 2; s++) {
    const x = s ? W - 20 - bw : 20;
    rr(c, x, y, bw, 10, 5); c.fillStyle = '#000000a0'; c.fill();
    rr(c, s ? x + bw - bw * G.hype[s] / 100 : x, y, bw * G.hype[s] / 100, 10, 5); c.fillStyle = s ? '#ff5a4a' : '#4a8dff'; c.fill();
    c.font = '800 13px system-ui,sans-serif'; c.textAlign = s ? 'right' : 'left'; c.lineWidth = 3; c.strokeStyle = '#000';
    const t = `📣 Hinchada${a.n[s] ? ' · 🙋 ' + a.n[s] : ''}`; c.strokeText(t, s ? x + bw : x, y + 24); c.fillStyle = '#fff'; c.fillText(t, s ? x + bw : x, y + 24);
  }
  if (a.v) { c.font = '800 14px system-ui,sans-serif'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeText('👀 ' + a.v + ' mirando', W / 2, 74); c.fillStyle = '#fff'; c.fillText('👀 ' + a.v + ' mirando', W / 2, 74); }
}
function startDemo() {
  const pick = () => CH_KEYS[Math.random() * CH_KEYS.length | 0];
  startMatch({ mode: 'demo', sel: [{ ch: pick(), face: FACES[0] || null }, { ch: pick(), face: FACES[1] || FACES[0] || null }], stage: Math.random() * STAGES.length | 0 });
}
function goMenu() {
  if (NET.role) { netSend({ t: 'bye' }); netCast({ t: 'bye' }); netClose(); }
  endPlay(); selMode = null; startDemo(); showScreen('scrMenu');
}
function goFull() {
  const d = document.documentElement;
  if (!document.fullscreenElement && d.requestFullscreen) d.requestFullscreen({ navigationUI: 'hide' }).then(() => { try { screen.orientation.lock('landscape').catch(() => { }); } catch (e) { } }).catch(() => { });
}
function togglePause() {
  if (G.mode === 'demo' || G.phase === 'over') return;
  const online = ['host', 'guest', 'spect'].includes(G.mode);
  const on = !$('#scrPause').classList.contains('on');
  if (!online) G.paused = on;
  $('#pRestart').style.display = online ? 'none' : ''; $('#pSelect').style.display = online || G.mode === 'tour' ? 'none' : '';
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
  if (G.mode === 'tour') { tourMatchDone(); return; }
  if (G.mode === 'demo') return;
  const [a, b] = G.f, w = a.wins > b.wins ? a : b.wins > a.wins ? b : null;
  drawEnd(w);
  $('#eTitle').textContent = w ? '¡' + w.name + ' ganó!' : '¡Empate!';
  $('#eSub').textContent = `${a.name} ${a.wins} – ${b.wins} ${b.name}`;
  if (G.mode === 'bots') {
    if (w) SCORE[w.i]++;
    $('#eSub').textContent += ` (rondas) · Peleas ganadas: ${a.name} ${SCORE[0]} – ${SCORE[1]} ${b.name}`;
  }
  const guest = G.mode === 'guest' || G.mode === 'spect';
  $('#eAgain').style.display = $('#eSelect').style.display = guest ? 'none' : '';
  if (guest) $('#eSub').textContent += G.mode === 'spect' ? ' · Esperando la próxima pelea…' : ' · Esperando que el anfitrión elija la revancha…';
  endPlay(); showScreen('scrEnd');
}

/* ---------- selección de peleadores ---------- */
function panelData() { return selMode === 'host' ? [SEL[0], NET.rsel] : selMode === 'guest' ? [NET.rsel, SEL[0]] : selMode === 'bots' ? BOTS : [SEL[0], SEL[1]]; }
const editable = i => selMode === 'host' ? i === 0 : selMode === 'guest' ? i === 1 : true;
function openSelect(mode) {
  selMode = mode; endPlay(); SCORE = [0, 0];
  if (mode === 'bots' && botsRoom()) netCast({ t: 'wait' }); // los que miran esperan la próxima pelea
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
      <div class="chDesc">${esc(CHARS[d.ch] ? CHARS[d.ch].desc : '')}${CHARS[d.ch] ? `<br>💀 Remate (${esc(FATAL[d.ch].name)}): <b>${FATAL[d.ch].seq.map(t => SEQ_ICON[t]).join(" ")}</b>` : ''}</div>
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
  if (selMode === 'bots') {
    const open = botsRoom() && NET.peer && NET.peer.open, a = G.aud || { n: [0, 0], v: 0 };
    $('#extra').innerHTML = `<div class="secT">📡 Sala para que miren y alienten</div>` + (open
      ? `<div class="row" style="align-items:center"><span style="font-size:15px">Sala <b style="color:var(--gold);letter-spacing:3px;font-size:20px">${esc(NET.code)}</b> · 👀 ${a.v} mirando</span>
         <button class="sm" id="rShare">📤 Compartir link</button><button class="sm" id="rCopy">📋 Copiar</button><button class="sm" id="rClose">✕ Cerrar sala</button></div>
         <div class="hint" style="text-align:left">Los que entren con el código ven la pelea en vivo y alientan con emojis y confeti.</div>`
      : botsRoom() ? `<div class="hint" style="text-align:left">Abriendo sala…</div>`
        : `<button class="sm" id="rOpen">📡 Abrir sala: otros miran desde su celu y alientan</button>`);
    if ($('#rOpen')) $('#rOpen').onclick = () => { netHost('bots'); renderSelect(); };
    if ($('#rShare')) $('#rShare').onclick = () => $('#oShare').onclick();
    if ($('#rCopy')) $('#rCopy').onclick = () => $('#oCopy').onclick();
    if ($('#rClose')) $('#rClose').onclick = () => { netCast({ t: 'bye' }); netClose(); G.aud = null; renderSelect(); };
  }
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
let FD = null, FSEG = null, VIS = null;
function visionLib() {
  if (!VIS) VIS = (async () => { const m = await import(MP + '/vision_bundle.mjs'); return { m, files: await m.FilesetResolver.forVisionTasks(MP + '/wasm') }; })().catch(e => { VIS = null; throw e; });
  return VIS;
}
// separa a la persona (pelo y cara) del fondo
function loadSegmenter() {
  if (!FSEG) FSEG = (async () => {
    const { m, files } = await visionLib();
    return m.ImageSegmenter.createFromOptions(files, {
      baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite', delegate: 'CPU' },
      runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false
    });
  })().catch(e => { FSEG = null; throw e; });
  return FSEG;
}
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, ko) => setTimeout(() => ko(new Error('tiempo')), ms))]);
function loadDetector() {
  if (!FD) FD = (async () => {
    const { m, files } = await visionLib();
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
/* Recorta la cabeza: la persona (pelo y cara) según el recortador de MediaPipe, cortada a la altura
   del mentón y a los costados según dónde está la cara. Sin recortador queda una forma de huevo. */
async function cutFace() {
  const S = 256, s = cropS(), k = S / 240, src = mkCanvas(S, S), x = src.getContext('2d');
  x.fillStyle = '#d9a27c'; x.fillRect(0, 0, S, S);
  // se guarda siempre mirando a la derecha; en la pelea se da vuelta para mirar al rival
  if (CR.dir < 0) { x.translate(S, 0); x.scale(-1, 1); }
  x.drawImage(CR.src, (CR.ox - 30) * k, (CR.oy - 30) * k, CR.src.width * s * k, CR.src.height * s * k);
  let bb = null, mask = null, mw = 0, mh = 0;
  try { const det = await withTimeout(loadDetector(), 8000); const ds = det.detect(src).detections || []; if (ds[0]) bb = ds.sort((a, b) => b.boundingBox.width - a.boundingBox.width)[0].boundingBox; } catch (e) { }
  try {
    const seg = await withTimeout(loadSegmenter(), 8000), r = seg.segment(src), ms = r.confidenceMasks || [];
    const m = ms[ms.length - 1]; if (m) { mask = m.getAsFloat32Array().slice(); mw = m.width; mh = m.height; }
    if (r.close) r.close();
    if (mask) { // algunos modelos dan la probabilidad del fondo: si el centro sale "fondo", se da vuelta
      const at = (u, v) => mask[Math.min(mh - 1, v * mh | 0) * mw + Math.min(mw - 1, u * mw | 0)];
      if (at(.5, .5) < (at(.03, .03) + at(.97, .03)) / 2) for (let i = 0; i < mask.length; i++) mask[i] = 1 - mask[i];
    }
  } catch (e) { mask = null; }
  const O = 160, f = O / S, out = mkCanvas(O, O), ox = out.getContext('2d');
  ox.drawImage(src, 0, 0, O, O);
  const cx = bb ? (bb.originX + bb.width / 2) * f : 80, bw = bb ? bb.width * f : 84;
  const top = bb ? bb.originY * f : 44, chin = bb ? Math.min(O - 2, (bb.originY + bb.height * 1.1) * f) : 132, cy = top + (chin - top) * .45;
  const id = ox.getImageData(0, 0, O, O), px = id.data;
  for (let y = 0; y < O; y++) for (let xx = 0; xx < O; xx++) {
    const dx = Math.abs(xx - cx);
    let hw;
    if (y >= cy) { const t = (y - cy) / (chin - cy + 6); hw = t >= 1 ? 0 : bw * .62 * Math.sqrt(1 - t * t); } // mentón redondeado
    else if (mask) { const t = (cy - y) / (cy - top + bw * .9); hw = bw * 1.05 * Math.sqrt(Math.max(0, 1 - t * t)); } // arriba manda el recortador (el pelo)
    else { const t = (cy - y) / ((cy - top) * 1.9); hw = t >= 1 ? 0 : bw * .64 * Math.sqrt(1 - t * t); }
    let a = clamp((hw - dx) / 4, 0, 1);
    if (a > 0 && mask) a *= clamp((mask[Math.min(mh - 1, y / O * mh | 0) * mw + Math.min(mw - 1, xx / O * mw | 0)] - .3) / .35, 0, 1);
    px[(y * O + xx) * 4 + 3] = Math.round(a * 255);
  }
  ox.putImageData(id, 0, 0);
  const webp = out.toDataURL('image/webp', .9);
  return webp.startsWith('data:image/webp') ? webp : out.toDataURL('image/png');
}
$('#cropOk').onclick = async () => {
  const btn = $('#cropOk'); if (btn.disabled) return;
  CR.gen++; btn.disabled = true; const label = btn.textContent; btn.textContent = '✂️ Recortando…'; cropInfo('✂️ Sacando el fondo de la cara…');
  let url;
  try { url = await cutFace(); } finally { btn.disabled = false; btn.textContent = label; }
  YAW[faceKey(url)] = CR.dir ? Math.max(.25, CR.yaw) : 0;
  for (const k2 in YAW) if (!FACES.some(u => faceKey(u) === k2) && k2 !== faceKey(url)) delete YAW[k2];
  store.set('kdc_yaw', YAW);
  const d = PHOTO_TARGET || panelData()[photoSlot]; if (d) { d.face = url; d.yaw = YAW[faceKey(url)]; }
  const forTour = !!PHOTO_TARGET; PHOTO_TARGET = null;
  if (forTour) { saveTour(); if (NET.role === 'spect') sendHello(); }
  FACES = [url, ...FACES.filter(u => u !== url)].slice(0, 12);
  while (!store.set('kdc_caras', FACES) && FACES.length > 1) FACES.pop();
  saveSel(); if (NET.role) helloSoon();
  $('#crop').classList.remove('on');
  if ($('#scrTour').classList.contains('on')) renderTour(); else if ($('#scrBracket').classList.contains('on')) renderBracket(); else renderSelect();
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
  const text = NET.room === 'bots' ? '🍿 ¡Vení a mirar la pelea de bots en Kombate de Caras y alentá a tu favorito! Código ' + NET.code : '¡Peleemos! Entrá a mi sala de Kombate de Caras con el código ' + NET.code;
  const data = { title: 'Kombate de Caras', text, url: roomLink() };
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
$('#spQuit').onclick = goMenu;
document.addEventListener('visibilitychange', () => { if (document.hidden && (G.mode === 'cpu' || ((G.mode === 'bots' || G.mode === 'tour') && !roomHost())) && G.phase !== 'over' && !G.paused) togglePause(); });

/* instalar como app */
let installPrompt = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; $('#mInstall').style.display = ''; });
$('#mInstall').onclick = () => { if (installPrompt) { installPrompt.prompt(); installPrompt = null; $('#mInstall').style.display = 'none'; } };
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });

/* =========================== TORNEO ===========================
   16 lugares; las llaves se sortean: octavos (8 peleas), cuartos (4), semifinal (2) y final.
   TOUR.R[r] = lugares que llegaron a la ronda r (R[4][0] = campeón). Cada lugar lo maneja
   'me' (yo), 'bot' (la máquina) o 'net' (un amigo conectado a la sala). */
const ROUND_NAMES = ['Octavos de final', 'Cuartos de final', 'Semifinal', 'Final'];
const NEXT_NAMES = ['cuartos de final', 'la semifinal', 'la final', ''];
let PHOTO_TARGET = null, TT = null; const TFACE = [];
function defaultTour() {
  return {
    mode: 'solo', need: 1, lvl: 'normal', status: 'setup', R: null, round: 0, match: 0,
    slots: CH_KEYS.map((k, i) => ({ name: CHARS[k].name, ch: k, face: null, ctl: i === 0 ? 'me' : 'bot' }))
  };
}
let TOUR = store.get('kdc_tour', null);
if (!TOUR || !Array.isArray(TOUR.slots) || TOUR.slots.length !== 16) TOUR = defaultTour();
TOUR.slots.forEach(s => { if (s.ctl === 'net') s.ctl = 'bot'; if (!CHARS[s.ch]) s.ch = 'toro'; });
if (TOUR.mode === 'online' && TOUR.status !== 'setup') TOUR.status = 'setup'; // un torneo en línea no se retoma sin los amigos
function saveTour() { if (!store.set('kdc_tour', TOUR)) toast('No hay espacio para guardar las caras del torneo en este aparato.'); }
const curMatch = () => ({ a: TOUR.R[TOUR.round][TOUR.match * 2], b: TOUR.R[TOUR.round][TOUR.match * 2 + 1] });
const isHuman = s => TOUR.slots[s].ctl !== 'bot';
function tourSrc(slot, i, mine) {
  const s = TOUR.slots[slot];
  if (s.ctl === 'me') return mine;
  if (s.ctl === 'net') { const c = [...NET.specs].find(c => c._slot === slot); if (c) return [c._src]; }
  return [S_CPU[i]];
}
function openTour() {
  selMode = null; endPlay(); if (G.mode !== 'demo') startDemo();
  showScreen('scrTour'); renderTour();
}
function setTourMode(m) {
  TOUR.mode = m;
  if (m === 'bots') TOUR.slots.forEach(s => s.ctl = 'bot');
  else if (m === 'solo' && !TOUR.slots.some(s => s.ctl === 'me')) TOUR.slots[0].ctl = 'me';
  // la sala sigue abierta: fuera de "en línea" los que entraron solo miran (dejan su lugar a la máquina)
  if (m !== 'online') { TOUR.slots.forEach(s => { if (s.ctl === 'net') s.ctl = 'bot'; }); for (const c of NET.specs) c._slot = -1; }
  saveTour(); renderTour();
}
function faceStyle(url, yaw) { return url ? `style="background-image:url(${url})"` : ''; }
function renderTour() {
  const T = TOUR;
  document.querySelectorAll('#tModes [data-tm]').forEach(b => b.classList.toggle('on', b.dataset.tm === T.mode));
  const roomOpen = roomHost() && NET.room === 'tour' && NET.peer && NET.peer.open, friends = [...NET.specs].filter(c => c._slot >= 0).length;
  $('#tOpts').innerHTML = `<div class="secT">Peleas</div><div class="row">
      <button class="sm ${T.need === 1 ? 'on' : ''}" data-need="1">⚡ A 1 ronda</button><button class="sm ${T.need === 2 ? 'on' : ''}" data-need="2">🥊 Al mejor de 3</button>
      <span style="width:12px"></span><span style="font-weight:800;font-size:13px">Bots:</span>${LVLS.map(([k, t]) => `<button class="sm ${T.lvl === k ? "on" : ""}" data-tl="${k}">${t}</button>`).join("")}
      <span style="width:12px"></span><button class="sm" id="tRandCh">🎲 Personajes al azar</button><button class="sm" id="tRandFace">🙂 Repartir caras guardadas</button><button class="sm" id="tReset">↺ Nombres originales</button></div>` +
    `<div class="secT">📡 Sala del torneo</div>` + (roomOpen
      ? `<div class="row" style="align-items:center"><span>Sala <b style="color:var(--gold);letter-spacing:3px;font-size:20px">${esc(NET.code)}</b>${T.mode === 'online' ? ` · 🌐 ${friends} peleando` : ''} · 👀 ${NET.specs.size} conectado${NET.specs.size === 1 ? '' : 's'}</span><button class="sm" id="tShare">📤 Compartir link</button><button class="sm" id="tCopy">📋 Copiar</button></div>
         <div class="hint" style="text-align:left">${T.mode === 'online'
        ? 'Cada amigo que entra con el código toma un lugar del torneo con su cara y su peleador. Los lugares que sobran los pelea la máquina. Si vos no querés pelear, tocá de nuevo tu “🙋 Yo”.'
        : 'Los que entren con el código miran todas las peleas en vivo y alientan a su favorito con emojis y confeti. No toman lugares: pelean los de la lista.'}</div>`
      : roomHost() ? `<div class="hint" style="text-align:left">Abriendo sala…</div>`
        : `<button class="sm" id="tRoom">📡 ${T.mode === 'online' ? 'Abrir sala para mis amigos' : 'Abrir sala para que miren'}</button>`);
  $('#tOpts').querySelectorAll('[data-need]').forEach(b => b.onclick = () => { T.need = +b.dataset.need; saveTour(); renderTour(); });
  $('#tOpts').querySelectorAll('[data-tl]').forEach(b => b.onclick = () => { T.lvl = b.dataset.tl; saveTour(); renderTour(); });
  $('#tRandCh').onclick = () => { const ks = [...CH_KEYS].sort(() => Math.random() - .5); T.slots.forEach((s, i) => { if (s.ctl !== 'net') s.ch = ks[i]; }); saveTour(); renderTour(); };
  $('#tRandFace').onclick = () => { if (!FACES.length) { toast('Todavía no hay caras guardadas: tocá una cara para sacar una foto.'); return; } const fs = [...FACES].sort(() => Math.random() - .5); T.slots.forEach((s, i) => { if (s.ctl !== 'net') { s.face = fs[i % fs.length]; s.yaw = yawOf(s.face); } }); saveTour(); renderTour(); };
  $('#tReset').onclick = () => { T.slots.forEach(s => { if (s.ctl !== 'net') s.name = CHARS[s.ch].name; }); saveTour(); renderTour(); };
  if ($('#tRoom')) $('#tRoom').onclick = () => { netHost('tour'); renderTour(); };
  if ($('#tShare')) $('#tShare').onclick = () => $('#oShare').onclick();
  if ($('#tCopy')) $('#tCopy').onclick = () => $('#oCopy').onclick();
  const box = $('#tSlots');
  box.innerHTML = T.slots.map((s, i) => `<div class="slot ${s.ctl}" data-i="${i}">
      <button class="fb" data-face="${i}" ${faceStyle(s.face)}>${s.face ? '' : '🙂'}</button>
      <input value="${esc(s.name)}" maxlength="12" data-name="${i}" ${s.ctl === 'net' ? 'readonly' : ''}>
      <select data-ch="${i}" ${s.ctl === 'net' ? 'disabled' : ''}>${CH_KEYS.map(k => `<option value="${k}" ${s.ch === k ? 'selected' : ''}>${CHARS[k].name}</option>`).join('')}</select>
      <div class="ctl">${s.ctl === 'net' ? '🌐 Amigo en línea' : T.mode === 'bots' ? '🤖 Bot' : `<button class="${s.ctl === 'me' ? 'on' : ''}" data-me="${i}">🙋 Yo</button>${s.ctl === 'me' ? '' : '🤖 Bot'}`}</div>
    </div>`).join('');
  box.querySelectorAll('[data-face]').forEach(b => b.onclick = () => { const s = T.slots[+b.dataset.face]; if (s.ctl !== 'net') pickFaceFor(s); });
  box.querySelectorAll('[data-name]').forEach(n => n.oninput = () => { T.slots[+n.dataset.name].name = n.value; saveTour(); });
  box.querySelectorAll('[data-ch]').forEach(n => n.onchange = () => { T.slots[+n.dataset.ch].ch = n.value; saveTour(); });
  box.querySelectorAll('[data-me]').forEach(b => b.onclick = () => {
    const i = +b.dataset.me, was = T.slots[i].ctl === 'me';
    T.slots.forEach(s => { if (s.ctl === 'me') s.ctl = 'bot'; });
    // en línea podés sacarte y quedarte solo de anfitrión; jugando solo siempre hay uno que sos vos
    if (!was || T.mode === 'solo') T.slots[i].ctl = 'me';
    saveTour(); renderTour();
  });
  const going = T.status !== 'setup' && T.R;
  $('#tCont').style.display = going ? '' : 'none';
  $('#tGo').textContent = going ? '🔀 Empezar otro torneo' : '🔀 Sortear llaves y empezar';
  $('#tWait').textContent = going ? `Hay un torneo a medias (${ROUND_NAMES[Math.min(3, T.round)]}).` : '';
  if (roomHost() && NET.room === 'tour') broadcastTour();
}
// elegir cara para un lugar del torneo: guardadas, foto o galería
function pickFaceFor(target) {
  PHOTO_TARGET = target;
  $('#fpGrid').innerHTML = [`<button data-fp="-1">🙂</button>`, ...FACES.map((u, k) => `<button data-fp="${k}" style="background-image:url(${u})"></button>`)].join('');
  $('#fpGrid').querySelectorAll('[data-fp]').forEach(b => b.onclick = () => {
    const k = +b.dataset.fp; target.face = k < 0 ? null : FACES[k]; target.yaw = yawOf(target.face); PHOTO_TARGET = null;
    $('#facePick').classList.remove('on'); saveTour(); saveSel();
    if (NET.role === 'spect') { sendHello(); renderBracket(); } else renderTour();
  });
  $('#facePick').classList.add('on');
}
$('#fpCam').onclick = () => { $('#facePick').classList.remove('on'); takePhoto(0); };
$('#fpGal').onclick = () => { $('#facePick').classList.remove('on'); pickPhoto(0); };
$('#fpCancel').onclick = () => { PHOTO_TARGET = null; $('#facePick').classList.remove('on'); };
// primero se arman las llaves (sorteadas, y el anfitrión cambia de lugar a quien quiera); después se pelea
function startTour() {
  const order = [...Array(16).keys()].sort(() => Math.random() - .5);
  Object.assign(TOUR, { R: [order, [], [], [], []], round: 0, match: 0, status: 'arrange', pend: [] });
  bkReset(); saveTour(); showBracket();
}
function startFights() { TOUR.status = 'bracket'; TOUR.round = 0; TOUR.match = 0; saveTour(); showBracket(); fx('sfx', 'power'); }
function showBracket() {
  endPlay(); if (G.mode !== 'demo') startDemo();
  // al terminar el torneo se ve primero cómo sube el campeón y después la pantalla del campeón
  if (TOUR.status === 'champ' && !(TOUR.pend || []).length && !BK.anim.length && !BK.cur) { showChamp(); return; }
  showScreen('scrBracket'); renderBracket();
  if (roomHost() && NET.room === 'tour') broadcastTour();
}
// lo que se ve de cada lugar: en el anfitrión sale de TOUR; en el que entró, de lo que mandó el anfitrión
function slotView(i) {
  if (NET.role === 'spect' && TT) { const s = TT.slots[i]; return { name: s.name, ch: s.ch, face: TFACE[i] || null, ctl: s.ctl }; }
  return TOUR.slots[i];
}
function renderBracket() {
  const T = NET.role === 'spect' ? TT : TOUR; if (!T) return;
  const host = NET.role !== 'spect';
  $('#bTitle').textContent = T.status === 'setup' ? '🏆 Torneo · esperando que empiece' : T.status === 'arrange' ? '✋ Armando las llaves' : '🏆 Llaves del torneo';
  // el que entró en línea arma su peleador mientras se juntan todos
  const mine = !host && TT && TT.you >= 0 ? SEL[0] : null;
  $('#bMine').innerHTML = mine && T.status === 'setup' ? `<div class="slot me" style="max-width:360px"><button class="fb" id="myFace" ${faceStyle(mine.face)}>${mine.face ? '' : '🙂'}</button>
      <input id="myName" value="${esc(mine.name)}" maxlength="12"><select id="myCh">${CH_KEYS.map(k => `<option value="${k}" ${mine.ch === k ? 'selected' : ''}>${CHARS[k].name}</option>`).join('')}</select>
      <div class="ctl">🙋 Tu lugar en el torneo</div></div>` : !host && TT && TT.you < 0 ? `<div class="hint" style="text-align:left">${TT.mode === "online" ? "👀 Estás mirando el torneo (ya no quedaban lugares)." : "👀 Estás mirando el torneo: pelean los bots. En cada pelea elegí a quién apoyás y alentalo con emojis y confeti 🎊."}</div>` : '';
  if ($('#myFace')) {
    $('#myFace').onclick = () => pickFaceFor(SEL[0]);
    $('#myName').oninput = e => { SEL[0].name = e.target.value; saveSel(); helloSoon(); };
    $('#myCh').onchange = e => { SEL[0].ch = e.target.value; saveSel(); sendHello(); };
  }
  if (T.status === 'setup' || !T.R) {
    $('#bTree').innerHTML = `<div class="slots" style="grid-column:1/-1">${[...Array(16).keys()].map(i => { const s = slotView(i); return `<div class="slot ${s.ctl}"><span class="fb" style="display:flex;align-items:center;justify-content:center;${s.face ? `background-image:url(${s.face})` : ''}">${s.face ? '' : '🙂'}</span><b>${esc(s.name)}</b><span style="font-size:12px">${CHARS[s.ch] ? CHARS[s.ch].name : ''}</span><div class="ctl">${s.ctl === 'net' ? '🌐 Amigo' : s.ctl === 'me' ? '🙋 Anfitrión' : '🤖 Bot'}</div></div>`; }).join('')}</div>`;
    $('#bInfo').textContent = '⏳ El anfitrión arma el torneo y sortea las llaves.'; $('#bBtns').innerHTML = ''; return;
  }
  // el tablero se dibuja en un canvas (ver bkDraw)
  if (!$('#bCv')) { $('#bTree').innerHTML = '<canvas id="bCv"></canvas>'; $('#bCv').onclick = bkClick; }
  $('#bTree').style.display = 'block';
  if (host && TOUR.pend && TOUR.pend.length) { BK.anim.push(...TOUR.pend); TOUR.pend = []; }
  bkStart();
  const btns = $('#bBtns');
  if (T.status === 'arrange') {
    $('#bInfo').textContent = host ? '✋ Tocá un peleador y después otro para cambiarlos de lugar. Los que quedan juntos pelean entre sí en la primera ronda.' : '⏳ El anfitrión está armando quién pelea contra quién…';
    btns.innerHTML = host ? `<button class="big b4" id="bShuffle">🔀 Sortear de nuevo</button><button class="big" id="bStart">🥋 ¡Empezar el torneo!</button>` : '';
    if ($('#bShuffle')) $('#bShuffle').onclick = () => { TOUR.R[0].sort(() => Math.random() - .5); BK.sel = -1; saveTour(); fx('sfx', 'whoosh'); if (roomHost() && NET.room === 'tour') broadcastTour(); };
    if ($('#bStart')) $('#bStart').onclick = startFights;
    return;
  }
  if (T.status !== 'bracket') { $('#bInfo').textContent = T.status === 'champ' ? '🏆 ¡El torneo terminó!' : ''; btns.innerHTML = `<button class="big b5" id="bChamp">🏆 Ver al campeón</button>`; $('#bChamp').onclick = showChamp; return; }
  const a = T.R[T.round][T.match * 2], b = T.R[T.round][T.match * 2 + 1], A = slotView(a), B = slotView(b);
  $('#bInfo').textContent = `${ROUND_NAMES[T.round]}${T.round < 3 ? ` · pelea ${T.match + 1} de ${8 >> T.round}` : ''}: ${A.name} contra ${B.name}`;
  if (!host) { btns.innerHTML = `<span class="wait">⏳ El anfitrión maneja el torneo.</span>`; return; }
  const human = isHuman(a) || isHuman(b), meAlive = TOUR.slots.some((s, i) => s.ctl !== 'bot' && aliveIn(i));
  btns.innerHTML = human ? `<button class="big" id="bPlay">🥊 ¡A pelear!</button>`
    : `<button class="big b2" id="bWatch">👀 Ver la pelea</button><button class="big b4" id="bSim">⏩ Simular</button><button class="big b4" id="bSimAll">⏩⏩ ${meAlive ? 'Simular hasta mi pelea' : 'Simular todas'}</button>`;
  if ($('#bPlay')) $('#bPlay').onclick = playTourMatch;
  if ($('#bWatch')) $('#bWatch').onclick = playTourMatch;
  if ($('#bSim')) $('#bSim').onclick = () => { simMatch(); showBracket(); };
  if ($('#bSimAll')) $('#bSimAll').onclick = () => { while (TOUR.status === 'bracket') { const { a, b } = curMatch(); if (isHuman(a) || isHuman(b)) break; simMatch(); } showBracket(); };
}
/* --- el tablero del gran torneo de artes marciales ---
   Los 16 abajo; las líneas suben ronda por ronda hasta la cima, donde queda el campeón.
   Nivel L: 0 = los 16, 1 = cuartos, 2 = semis, 3 = final, 4 = campeón. Nodo (L, j) = TOUR.R[L][j]. */
const BK = { anim: [], cur: null, sel: -1, raf: 0, champShown: false, conf: [], champAt: 0 };
const BW = 960, BH = 600, BY = [520, 408, 316, 236, 146], BRAD = [22, 23, 25, 28, 46];
function bkReset() { Object.assign(BK, { anim: [], cur: null, sel: -1, champShown: false, conf: [], champAt: 0 }); }
function bkX(L, j) { return L === 0 ? 46 + (j + .5) * (BW - 92) / 16 : (bkX(L - 1, j * 2) + bkX(L - 1, j * 2 + 1)) / 2; }
// el tramo de línea desde el nodo (L, i) hasta el de arriba
function bkPath(L, i) {
  const x0 = bkX(L, i), x1 = bkX(L + 1, i >> 1), ym = (BY[L] + BY[L + 1]) / 2 + 6;
  return [[x0, BY[L] - BRAD[L] - 2], [x0, ym], [x1, ym], [x1, BY[L + 1] + BRAD[L + 1] + 2]];
}
function strokePart(c, pts, p) {
  const segs = []; let tot = 0;
  for (let k = 1; k < pts.length; k++) { const d = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); segs.push(d); tot += d; }
  let left = tot * p; c.beginPath(); c.moveTo(...pts[0]);
  for (let k = 1; k < pts.length && left > 0; k++) {
    const d = segs[k - 1], f = Math.min(1, left / d);
    c.lineTo(pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * f, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * f); left -= d;
  }
  c.stroke();
  return left <= 0 ? null : pts[pts.length - 1];
}
function bkStart() { if (!BK.raf) BK.raf = requestAnimationFrame(bkLoop); }
function bkLoop(now) {
  if (!$('#scrBracket').classList.contains('on') || !$('#bCv')) { BK.raf = 0; return; }
  const T = NET.role === 'spect' ? TT : TOUR;
  // la animación que toca: una por vez; si hay muchas en fila, van más rápido
  if (!BK.cur && BK.anim.length) { BK.cur = BK.anim.shift(); BK.cur.t0 = now; BK.cur.dur = BK.anim.length > 2 ? 420 : 1200; SFX.whoosh(); }
  if (BK.cur) {
    const p = (now - BK.cur.t0) / BK.cur.dur;
    if (p >= 1 && !BK.cur.done) { BK.cur.done = now; if (BK.cur.L === 3) { BK.champAt = now; SFX.twinkle(); speak('¡' + slotView(T.R[4][0]).name + ' es el campeón!'); for (let i = 0; i < 140; i++) BK.conf.push({ x: BW / 2, y: BY[4], vx: rnd(-9, 9), vy: rnd(-12, -2), r: rnd(0, 6), vr: rnd(-.3, .3), c: CONF_COL[i % CONF_COL.length], w: rnd(6, 11), h: rnd(3, 6), l: rnd(120, 220) }); } else SFX.pop(); }
    if (BK.cur.done && now - BK.cur.done > 260) BK.cur = null;
  }
  // terminó de subir el campeón: a los 2,5 s se pasa a la pantalla del campeón
  if (T && T.status === 'champ' && BK.champAt && !BK.champShown && now - BK.champAt > 2500 && !BK.cur && !BK.anim.length) { BK.champShown = true; showChamp(); BK.raf = 0; return; }
  if (T && T.R) bkDraw(T, now);
  BK.raf = requestAnimationFrame(bkLoop);
}
function bkDraw(T, now) {
  const cv2 = $('#bCv'), wCss = cv2.parentElement.clientWidth || 600, dpr = Math.min(2, devicePixelRatio || 1);
  if (cv2.width !== Math.round(wCss * dpr)) { cv2.width = Math.round(wCss * dpr); cv2.height = Math.round(wCss * dpr * BH / BW); cv2.style.width = wCss + 'px'; cv2.style.height = wCss * BH / BW + 'px'; }
  const c = cv2.getContext('2d'), k = cv2.width / BW, t = now / 1000;
  c.setTransform(k, 0, 0, k, 0, 0);
  // cielo de atardecer y el templo del torneo atrás
  c.fillStyle = grad(c, 0, BH, ['#ff8a2a', '#ffc04d', '#ffe9a8']); c.fillRect(0, 0, BW, BH);
  c.fillStyle = 'rgba(140,60,20,.25)';
  c.beginPath(); c.moveTo(BW / 2 - 300, 150); c.quadraticCurveTo(BW / 2, 95, BW / 2 + 300, 150); c.lineTo(BW / 2 + 260, 130); c.quadraticCurveTo(BW / 2, 80, BW / 2 - 260, 130); c.fill();
  // el tablero
  rr(c, 18, 56, BW - 36, BH - 70, 18); c.fillStyle = '#f6ecd2'; c.fill(); c.lineWidth = 10; c.strokeStyle = '#6b3a1a'; c.stroke();
  c.lineWidth = 2; c.strokeStyle = '#c9a36a'; rr(c, 30, 68, BW - 60, BH - 94, 12); c.stroke();
  // cartel de arriba
  rr(c, BW / 2 - 300, 14, 600, 56, 12); c.fillStyle = '#c0281e'; c.fill(); c.lineWidth = 5; c.strokeStyle = '#5a0f08'; c.stroke();
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '900 30px system-ui,sans-serif'; c.lineWidth = 7; c.strokeStyle = '#3a0905';
  c.strokeText('GRAN TORNEO DE ARTES MARCIALES', BW / 2, 43); c.fillStyle = '#ffd21f'; c.fillText('GRAN TORNEO DE ARTES MARCIALES', BW / 2, 43);
  // nombres de las rondas al costado
  c.font = '900 13px system-ui,sans-serif'; c.textAlign = 'left'; c.fillStyle = '#8a5a2a';
  ['', 'CUARTOS', 'SEMIFINAL', 'FINAL', ''].forEach((n, L) => { if (n) c.fillText(n, 40, (BY[L] + BY[L - 1]) / 2 + 8); });
  // lo que todavía se está por animar no se muestra (ni la línea encendida ni la cara arriba)
  const hideNode = new Set(), hideSeg = new Set(), cur = BK.cur, cp = cur ? Math.min(1, (now - cur.t0) / cur.dur) : 0;
  for (const a of [...(cur && cp < 1 ? [cur] : []), ...BK.anim]) { hideNode.add((a.L + 1) + ':' + (a.i >> 1)); hideSeg.add(a.L + ':' + a.i); }
  if (cur && cp < 1) hideSeg.add(cur.L + ':' + cur.i);
  // líneas en tinta
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (let L = 0; L < 4; L++) for (let i = 0; i < 16 >> L; i++) { c.lineWidth = 4; c.strokeStyle = '#3a2414'; strokePart(c, bkPath(L, i), 1); }
  // líneas del que ganó: naranja con brillo
  const lit = (L, i, p) => { const pts = bkPath(L, i); c.lineWidth = 13; c.strokeStyle = 'rgba(255,200,40,.45)'; strokePart(c, pts, p); c.lineWidth = 7; c.strokeStyle = '#ff6a00'; return strokePart(c, pts, p); };
  for (let L = 0; L < 4; L++) for (let i = 0; i < 16 >> L; i++) {
    const w = T.R[L + 1] && T.R[L + 1][i >> 1];
    if (w != null && T.R[L][i] === w && !hideSeg.has(L + ':' + i)) lit(L, i, 1);
  }
  let spark = null;
  if (cur && cp < 1) spark = lit(cur.L, cur.i, cp);
  if (spark || (cur && cp < 1)) { // la chispa que va subiendo con la cara del que ganó
    const pts = bkPath(cur.L, cur.i), segs = []; let tot = 0;
    for (let q = 1; q < pts.length; q++) { const d = Math.hypot(pts[q][0] - pts[q - 1][0], pts[q][1] - pts[q - 1][1]); segs.push(d); tot += d; }
    let left = tot * cp, px = pts[0][0], py = pts[0][1];
    for (let q = 1; q < pts.length && left > 0; q++) { const f = Math.min(1, left / segs[q - 1]); px = pts[q - 1][0] + (pts[q][0] - pts[q - 1][0]) * f; py = pts[q - 1][1] + (pts[q][1] - pts[q - 1][1]) * f; left -= segs[q - 1]; }
    glow(c, px, py, 30, 'rgba(255,230,120,.95)');
    const s = slotView(T.R[cur.L][cur.i]);
    c.save(); c.translate(px, py); drawFace(c, faceImg(s.face), 16, '#ffc83d', 0, px < BW / 2 ? 1 : -1, s.yaw ?? yawOf(s.face), null); c.restore();
  }
  // las caras en cada lugar del tablero
  const ringOf = s => s.ctl === 'me' ? '#2f7bff' : s.ctl === 'net' ? '#1d9e49' : '#3a2414';
  for (let L = 0; L <= 4; L++) for (let j = 0; j < (16 >> L || 1); j++) {
    const x = bkX(L, j), y = BY[L], r = BRAD[L], si = T.R[L] ? T.R[L][j] : null;
    const hidden = hideNode.has(L + ':' + j);
    if (si == null || hidden) { // lugar vacío
      c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = '#e9dcbc'; c.fill(); c.setLineDash([5, 5]); c.lineWidth = 3; c.strokeStyle = '#a8865a'; c.stroke(); c.setLineDash([]);
      c.font = `900 ${r}px system-ui,sans-serif`; c.textAlign = 'center'; c.fillStyle = '#a8865a'; c.fillText(L === 4 ? '🏆' : '?', x, y + 2);
      continue;
    }
    const s = slotView(si), lost = L < 4 && T.R[L + 1] && T.R[L + 1][j >> 1] != null && T.R[L + 1][j >> 1] !== si && !hideNode.has((L + 1) + ':' + (j >> 1));
    let sc = 1;
    if (cur && cur.done && (cur.L + 1) + ':' + (cur.i >> 1) === L + ':' + j) sc = 1 + Math.max(0, .5 - (now - cur.done) / 500); // aparece con un saltito
    if (L === 4) { c.save(); c.globalAlpha = .7; glow(c, x, y, 110 + Math.sin(t * 3) * 8, 'rgba(255,210,60,.9)'); c.restore(); }
    c.save(); c.translate(x, y); c.scale(sc, sc); if (lost) c.globalAlpha = .42;
    drawFace(c, faceImg(s.face), r, L === 4 ? '#ffc83d' : ringOf(s), 0, x < BW / 2 ? 1 : -1, s.yaw ?? yawOf(s.face), null);
    c.restore();
    if (lost) { c.strokeStyle = 'rgba(192,40,30,.8)'; c.lineWidth = 4; c.beginPath(); c.moveTo(x - r * .6, y - r * .6); c.lineTo(x + r * .6, y + r * .6); c.moveTo(x + r * .6, y - r * .6); c.lineTo(x - r * .6, y + r * .6); c.stroke(); }
    if (L === 4) { // corona del campeón
      c.save(); c.translate(x, y - r - 10); c.beginPath(); c.moveTo(-30, 12); c.lineTo(-36, -16); c.lineTo(-16, -2); c.lineTo(0, -24); c.lineTo(16, -2); c.lineTo(36, -16); c.lineTo(30, 12); c.closePath();
      c.fillStyle = '#ffc83d'; c.fill(); c.lineWidth = 3; c.strokeStyle = '#8a5a00'; c.stroke(); c.restore();
      c.font = '900 20px system-ui,sans-serif'; c.lineWidth = 5; c.strokeStyle = '#fff6dc'; c.fillStyle = '#c0281e';
      c.strokeText('👑 ' + s.name.toUpperCase(), x, y + r + 20); c.fillText('👑 ' + s.name.toUpperCase(), x, y + r + 20);
    }
    if (L === 0) { // nombre abajo
      c.font = '900 11px system-ui,sans-serif'; c.textAlign = 'center'; c.fillStyle = lost ? '#a8865a' : '#3a2414';
      const nm = s.name.length > 9 ? s.name.slice(0, 8) + '…' : s.name; c.fillText(nm, x, y + r + 13);
      c.font = '700 9px system-ui,sans-serif'; c.fillStyle = '#8a6a44'; c.fillText(CHARS[s.ch] ? CHARS[s.ch].name : '', x, y + r + 25);
    }
  }
  // la pelea que viene: los dos titilan
  if (T.status === 'bracket' && !cur && !BK.anim.length) {
    const L = T.round, a = (Math.sin(t * 5) + 1) / 2;
    for (const j of [T.match * 2, T.match * 2 + 1]) { c.beginPath(); c.arc(bkX(L, j), BY[L], BRAD[L] + 7 + a * 3, 0, 7); c.lineWidth = 4; c.strokeStyle = `rgba(255,80,20,${.5 + a * .5})`; c.stroke(); }
    const xm = (bkX(L, T.match * 2) + bkX(L, T.match * 2 + 1)) / 2;
    c.font = '900 16px system-ui,sans-serif'; c.textAlign = 'center'; c.lineWidth = 4; c.strokeStyle = '#fff6dc'; c.fillStyle = '#c0281e';
    c.strokeText('VS', xm, BY[L] + 4); c.fillText('VS', xm, BY[L] + 4);
  }
  // armando las llaves: el que tocaste queda marcado
  if (T.status === 'arrange') {
    for (let m = 0; m < 8; m++) { const xm = (bkX(0, m * 2) + bkX(0, m * 2 + 1)) / 2; c.font = '900 12px system-ui,sans-serif'; c.textAlign = 'center'; c.fillStyle = '#c0281e'; c.fillText('VS', xm, BY[0] + 4); }
    if (BK.sel >= 0) { c.beginPath(); c.arc(bkX(0, BK.sel), BY[0], BRAD[0] + 8, 0, 7); c.lineWidth = 5; c.strokeStyle = `rgba(47,123,255,${.6 + Math.sin(t * 8) * .4})`; c.stroke(); }
  }
  // confeti cuando el campeón llega a la cima
  for (const p of BK.conf) { p.x += p.vx; p.y += p.vy; p.vy += .22; p.vx *= .99; p.r += p.vr; p.l--; c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.globalAlpha = Math.min(1, p.l / 30); c.fillStyle = p.c; c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); c.restore(); }
  BK.conf = BK.conf.filter(p => p.l > 0 && p.y < BH + 20);
}
// tocar dos peleadores de abajo los cambia de lugar (solo el anfitrión, mientras arma las llaves)
function bkClick(e) {
  if (NET.role === 'spect' || TOUR.status !== 'arrange') return;
  const r = e.target.getBoundingClientRect(), x = (e.clientX - r.left) * BW / r.width, y = (e.clientY - r.top) * BH / r.height;
  let hit = -1; for (let i = 0; i < 16; i++) if (Math.hypot(x - bkX(0, i), y - BY[0]) < 30) hit = i;
  if (hit < 0) return;
  if (BK.sel < 0) { BK.sel = hit; SFX.beep(); return; }
  if (BK.sel !== hit) { const R0 = TOUR.R[0]; [R0[BK.sel], R0[hit]] = [R0[hit], R0[BK.sel]]; saveTour(); SFX.pop(); if (roomHost() && NET.room === 'tour') broadcastTour(); }
  BK.sel = -1;
}
// ¿ese lugar sigue en carrera?
function aliveIn(i) { const r = TOUR.round; return TOUR.R[r].includes(i) && !(TOUR.R[r + 1] || []).some((w, m) => w != null && (TOUR.R[r][m * 2] === i || TOUR.R[r][m * 2 + 1] === i) && w !== i); }
function recordWinner(slot) {
  // para la animación del tablero: el que ganó sube desde su lugar hasta la ronda siguiente
  (TOUR.pend = TOUR.pend || []).push({ L: TOUR.round, i: TOUR.match * 2 + (TOUR.R[TOUR.round][TOUR.match * 2] === slot ? 0 : 1) });
  TOUR.R[TOUR.round + 1][TOUR.match] = slot;
  if (++TOUR.match >= 8 >> TOUR.round) { TOUR.round++; TOUR.match = 0; }
  if (TOUR.round >= 4) TOUR.status = 'champ';
  saveTour();
}
// pelea de bots resuelta al toque: gana el más fuerte… casi siempre
function simMatch() {
  const { a, b } = curMatch(), pow = s => { const c = CHARS[TOUR.slots[s].ch]; return c.hp * c.power * (.7 + Math.random() * .8); };
  recordWinner(pow(a) >= pow(b) ? a : b);
}
function playTourMatch() {
  const { a, b } = curMatch(), A = TOUR.slots[a], B = TOUR.slots[b];
  const title = ROUND_NAMES[TOUR.round] + (TOUR.round < 3 ? ' · Pelea ' + (TOUR.match + 1) + ' de ' + (8 >> TOUR.round) : '');
  audio();
  startMatch({ mode: 'tour', sel: [A, B], stage: ARENA, need: TOUR.need, lvls: [TOUR.lvl, TOUR.lvl], title, tour: { a, b } });
  if (roomHost() && NET.room === 'tour') { G.ev = []; for (const c of NET.specs) if (c.open) try { c.send(tourStartMsg(c)); } catch (e) { } }
}
function tourStartMsg(c) {
  const { a, b } = G.setup.tour;
  return { t: 'start', kind: 'tour', a, b, stage: G.stage, seeds: G.seeds, need: G.need, title: G.tourTitle, me: c._slot === a ? 0 : c._slot === b ? 1 : -1 };
}
// terminó una pelea del torneo: el que ganó pasa de ronda
function tourMatchDone() {
  const [fa, fb] = G.f, { a, b } = G.setup.tour;
  const wi = fa.wins !== fb.wins ? (fa.wins > fb.wins ? 0 : 1) : fa.hp / fa.maxHp !== fb.hp / fb.maxHp ? (fa.hp / fa.maxHp > fb.hp / fb.maxHp ? 0 : 1) : Math.random() * 2 | 0;
  const w = G.f[wi], final = TOUR.round === 3, r0 = TOUR.round;
  recordWinner(wi ? b : a);
  drawEnd(w);
  $('#eTitle').textContent = final ? '🏆 ¡' + w.name + ' es el campeón!' : '¡' + w.name + ' pasa a ' + NEXT_NAMES[r0] + '!';
  $('#eSub').textContent = `${fa.name} ${fa.wins} – ${fb.wins} ${fb.name}`;
  $('#eAgain').style.display = $('#eSelect').style.display = 'none'; $('#eTour').style.display = '';
  $('#eTour').textContent = final ? '🏆 Ver al campeón' : '🏆 Ver las llaves';
  endPlay(); showScreen('scrEnd');
  if (roomHost() && NET.room === 'tour') broadcastTour();
}
$('#eTour').onclick = () => { $('#eTour').style.display = 'none'; $('#eAgain').style.display = $('#eSelect').style.display = ''; showBracket(); };

/* --- campeón --- */
let champRAF = 0;
function showChamp() {
  const T = NET.role === 'spect' ? TT : TOUR; if (!T || !T.R || T.R[4][0] == null) return;
  endPlay(); showScreen('scrChamp');
  $('#chNew').style.display = NET.role === 'spect' ? 'none' : '';
  const s = slotView(T.R[4][0]), img = faceImg(s.face), conf = [];
  for (let i = 0; i < 120; i++) conf.push({ x: Math.random() * 640, y: -Math.random() * 420, vy: 1 + Math.random() * 2.5, vx: rnd(-.6, .6), r: rnd(0, 6), vr: rnd(-.15, .15), c: CONF_COL[i % CONF_COL.length], w: rnd(6, 11), h: rnd(3, 6) });
  cancelAnimationFrame(champRAF);
  const cv2 = $('#chCv'), c = cv2.getContext('2d');
  const draw = () => {
    if (!$('#scrChamp').classList.contains('on')) return;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 640, 420);
    const t = performance.now() / 1000;
    glow(c, 320, 170, 230, 'rgba(255,200,61,.45)');
    // trofeo
    c.save(); c.translate(320, 262); c.scale(.75, .75);
    c.fillStyle = '#ffc83d'; c.strokeStyle = '#8a5a00'; c.lineWidth = 5;
    c.beginPath(); c.moveTo(-70, -60); c.lineTo(70, -60); c.quadraticCurveTo(70, 30, 0, 40); c.quadraticCurveTo(-70, 30, -70, -60); c.fill(); c.stroke();
    c.beginPath(); c.arc(-80, -25, 26, Math.PI * .5, Math.PI * 1.5); c.stroke(); c.beginPath(); c.arc(80, -25, 26, -Math.PI * .5, Math.PI * .5); c.stroke();
    c.fillRect(-14, 40, 28, 30); c.fillRect(-55, 70, 110, 22); c.strokeRect(-55, 70, 110, 22);
    c.restore();
    // la cara del campeón arriba del trofeo, con corona
    c.save(); c.translate(320, 150 + Math.sin(t * 2) * 5); drawFace(c, img, 86, '#ffc83d', 0, 1, s.yaw ?? yawOf(s.face), null); c.restore();
    c.save(); c.translate(320, 50 + Math.sin(t * 2) * 5);
    c.beginPath(); c.moveTo(-46, 18); c.lineTo(-54, -24); c.lineTo(-24, -4); c.lineTo(0, -36); c.lineTo(24, -4); c.lineTo(54, -24); c.lineTo(46, 18); c.closePath();
    c.fillStyle = '#ffc83d'; c.fill(); c.lineWidth = 4; c.strokeStyle = '#8a5a00'; c.stroke(); c.restore();
    for (const p of conf) { p.y += p.vy; p.x += p.vx + Math.sin(t + p.r) * .4; p.r += p.vr; if (p.y > 430) { p.y = -10; p.x = Math.random() * 640; } c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.fillStyle = p.c; c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); c.restore(); }
    c.textAlign = 'center'; c.lineWidth = 7; c.strokeStyle = '#3a0905'; c.font = '900 40px system-ui,sans-serif'; c.fillStyle = '#ffc83d';
    c.strokeText('¡' + s.name.toUpperCase() + '!', 320, 395); c.fillText('¡' + s.name.toUpperCase() + '!', 320, 395);
    c.font = '900 20px system-ui,sans-serif'; c.lineWidth = 5; c.strokeText('CAMPEÓN DEL GRAN TORNEO', 320, 352); c.fillStyle = '#fff'; c.fillText('CAMPEÓN DEL GRAN TORNEO', 320, 352);
    champRAF = requestAnimationFrame(draw);
  };
  draw(); fx('sfx', 'twinkle'); speak('¡' + s.name + ', campeón del gran torneo!');
}
$('#chTree').onclick = () => { showScreen('scrBracket'); renderBracket(); };
$('#chNew').onclick = () => { TOUR.status = 'setup'; TOUR.R = null; saveTour(); openTour(); if (roomHost() && NET.room === 'tour') broadcastTour(); };
$('#chQuit').onclick = goMenu;

/* --- torneo en línea: el anfitrión reparte lugares y manda el estado a todos --- */
function tourState(c) {
  return {
    t: 'tour', you: c._slot,
    T: { mode: TOUR.mode, need: TOUR.need, status: TOUR.status, R: TOUR.R, round: TOUR.round, match: TOUR.match, slots: TOUR.slots.map(s => ({ name: s.name, ch: s.ch, ctl: s.ctl, yaw: s.yaw ?? yawOf(s.face) })) }
  };
}
function sendFaces(c) {
  TOUR.slots.forEach((s, i) => { const k = s.face ? faceKey(s.face) : ''; if (c._fk[i] !== k) { c._fk[i] = k; try { c.send({ t: 'face', i, f: s.face || null }); } catch (e) { } } });
}
function broadcastTour() { for (const c of NET.specs) if (c.open) { sendFaces(c); try { c.send(tourState(c)); } catch (e) { } } }
function tourJoined(c) {
  // si el torneo está en una pelea, la ve en vivo; si no, ve las llaves
  sendFaces(c); c.send(tourState(c));
  if (G.mode === 'tour' && G.phase !== 'over') c.send(tourStartMsg(c));
}
function tourHello(c, sel) {
  if (NET.room !== 'tour' || !sel) return;
  if (TOUR.status === 'setup' && TOUR.mode === 'online') { // fuera de "en línea" los que entran solo miran
    if (c._slot < 0) { const i = TOUR.slots.findIndex(s => s.ctl === 'bot'); if (i >= 0) c._slot = i; }
    if (c._slot >= 0) Object.assign(TOUR.slots[c._slot], { name: (sel.name || 'Amigo').slice(0, 12), ch: CHARS[sel.ch] ? sel.ch : 'toro', face: sel.face || null, yaw: sel.yaw || 0, ctl: 'net' });
  }
  if ($('#scrTour').classList.contains('on')) renderTour(); else broadcastTour();
}
function tourLeft(c) {
  if (NET.room !== 'tour' || c._slot < 0) return;
  const s = TOUR.slots[c._slot]; s.ctl = 'bot';
  // si estaba peleando, sigue la máquina en su lugar
  if (G.mode === 'tour' && G.setup && G.setup.tour) [G.setup.tour.a, G.setup.tour.b].forEach((sl, i) => { if (sl === c._slot) G.src[i] = [S_CPU[i]]; });
  toast('🔌 ' + s.name + ' se desconectó: lo sigue la máquina.');
  if ($('#scrTour').classList.contains('on')) renderTour(); else broadcastTour();
}
// el que entró: muestra lo que corresponde según cómo va el torneo (sin cortar una pelea que está mirando)
const ttSel = i => { const s = TT.slots[i]; return { name: s.name, ch: s.ch, face: TFACE[i] || null, yaw: s.yaw }; };
function ttShow() {
  if (document.body.classList.contains('playing')) return;
  if (TT.status === 'champ' && !BK.anim.length && !BK.cur) { if (!$('#scrChamp').classList.contains('on')) showChamp(); }
  else { if (!$('#scrBracket').classList.contains('on')) showScreen('scrBracket'); renderBracket(); }
}
// lo que cambió en las llaves desde el último aviso: esos ganadores se ven subir en el tablero
function ttQueue(old, T) {
  if (!T.R || T.status === 'setup' || T.status === 'arrange' || !old || !old.R) { if (!T.R || T.status !== 'bracket') bkReset(); return; }
  for (let L = 1; L <= 4; L++) for (let j = 0; j < (16 >> L || 1); j++) {
    const w = T.R[L] && T.R[L][j];
    if (w != null && (!old.R[L] || old.R[L][j] == null)) BK.anim.push({ L: L - 1, i: T.R[L - 1][j * 2] === w ? j * 2 : j * 2 + 1 });
  }
}

$('#mTour').onclick = () => { audio(); openTour(); };
$('#tBack').onclick = () => { if (NET.role) goMenu(); else showScreen('scrMenu'); };
document.querySelectorAll('#tModes [data-tm]').forEach(b => b.onclick = () => setTourMode(b.dataset.tm));
$('#tGo').onclick = () => {
  if (TOUR.mode === 'solo' && !TOUR.slots.some(s => s.ctl === 'me')) TOUR.slots[0].ctl = 'me';
  startTour();
};
$('#tCont').onclick = showBracket;
$('#bQuit').onclick = () => { if (NET.role === 'spect' || confirm('¿Salir del torneo? Podés seguirlo después desde 🏆 Torneo.')) goMenu(); };

/* =========================== ARRANQUE =========================== */
let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(100, now - last); last = now;
  requestAnimationFrame(frame); // primero, así un error en un cuadro no congela el juego
  try {
    while (acc >= 1000 / 60) { step(); acc -= 1000 / 60; }
    render();
  } catch (e) { acc = 0; console.error(e); }
}
startDemo();
{
  const sala = new URLSearchParams(location.search).get('sala');
  if (sala) { history.replaceState(null, '', location.pathname); openOnline(sala); }
}
requestAnimationFrame(frame);
