'use strict';
/* Sobrevivencia Nacional: Odisea Paraguaya — runner 2D de scroll lateral para celular.
   Todo se dibuja en el canvas con figuras simples (sin imágenes), así carga al toque. */

const cv = document.getElementById('cv');
let ctx = cv.getContext('2d');
const H = 360, GY = 292;            // alto lógico de la pantalla y altura del piso
let W = 640, KS = 1;                // ancho lógico (depende de la pantalla) y escala real
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
function rng(seed) { return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const isTouch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;

function resize() {
  const vw = innerWidth, vh = innerHeight, portrait = vh > vw;
  W = Math.round(clamp(H * vw / vh, 520, 760));
  KS = Math.min(vw / W, vh / H);
  const dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.round(W * KS * dpr); cv.height = Math.round(H * KS * dpr);
  cv.style.width = Math.round(W * KS) + 'px'; cv.style.height = Math.round(H * KS) + 'px';
  KS *= dpr;
  document.body.classList.toggle('portrait', portrait);
  $('#giro').style.top = (Math.round(H * KS / dpr) + 8) + 'px';
}
addEventListener('resize', resize); resize();

/* ====================== GUARDADO ====================== */
function load() {
  const d = { char: null, unlocked: 1, enc: {}, clockAt: {}, sound: true };
  try { return Object.assign(d, JSON.parse(localStorage.getItem('odisea-v1') || '{}')); } catch (e) { return d; }
}
let S = load();
function save() { try { localStorage.setItem('odisea-v1', JSON.stringify(S)); } catch (e) {} }

/* ====================== SONIDO ====================== */
let AC = null;
function ac() {
  if (!S.sound) return null;
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
function tone(f, d, type = 'square', vol = .07, f2 = 0, delay = 0) {
  const a = ac(); if (!a) return;
  const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0008, t + d);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + d + .02);
}
const SFX = {
  jump() { tone(380, .14, 'square', .05, 720); },
  coin() { tone(990, .07, 'square', .05); tone(1480, .12, 'square', .05, 0, .06); },
  hit() { tone(220, .35, 'sawtooth', .09, 60); },
  bump() { tone(160, .15, 'triangle', .1, 90); },
  eat() { tone(520, .08, 'triangle', .08); tone(660, .08, 'triangle', .08, 0, .08); tone(880, .14, 'triangle', .08, 0, .16); },
  pay() { tone(1200, .05, 'square', .04); tone(1600, .05, 'square', .04, 0, .05); tone(2000, .1, 'square', .04, 0, .1); },
  alarm() { for (let i = 0; i < 4; i++) { tone(880, .18, 'square', .05, 0, i * .4); tone(660, .18, 'square', .05, 0, i * .4 + .2); } },
  moto() { for (let i = 0; i < 6; i++) tone(70 + (i % 2) * 25, .22, 'sawtooth', .07, 55, i * .2); },
  sertanejo() { [392, 494, 587, 494, 392, 330, 392, 494].forEach((f, i) => tone(f, .16, 'triangle', .06, 0, i * .17)); },
  rain() { for (let i = 0; i < 8; i++) tone(200 + Math.random() * 300, .1, 'triangle', .02, 0, i * .12); },
  power() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .12, 'square', .05, 0, i * .07)); },
  win() { [523, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, .2, 'square', .06, 0, i * .14)); },
  whistle() { tone(2400, .3, 'sine', .06, 2600); tone(2400, .25, 'sine', .06, 2200, .35); },
  laugh() { [600, 700, 600, 760].forEach((f, i) => tone(f, .09, 'sine', .05, 0, i * .11)); },
  throw() { tone(600, .12, 'triangle', .06, 300); },
};
function sfx(n) { try { SFX[n] && SFX[n](); } catch (e) {} }

/* ====================== PERSONAJES ====================== */
const CHARS = {
  trabajador: { name: 'El Trabajador', apodo: 'Godínez Paraguayo', lives: 3, coins: 2000, spd: 1, energy: 100, heat: .6, drink: 2, jump: 1, push: true,
    hab: 'Tolerancia al Estrés: con el calor se cansa mucho más lento.', ven: 'El tereré y la bebida le rinden el doble. Pasa empujando a vendedores y multitudes.', des: 'Arranca con poca plata (las cuotas…).' },
  estudiante: { name: 'Estudiante Universitario', apodo: 'El Guerrero de la UNA', lives: 2, coins: 2000, spd: 1, energy: 100, heat: 1, drink: 1, jump: 1, mochila: 2, zombi: true, grace: 3,
    hab: 'Mochila de Supervivencia: guarda 2 comidas en vez de 1.', ven: 'Inmune a los Universitarios Zombis. Corre 3 segundos más con la energía en cero (ansiedad).', des: 'Solo 2 chipas (vidas): viene sin dormir.' },
  senora: { name: 'La Señora', apodo: 'Mamá Guasu', lives: 3, coins: 2000, spd: 1, energy: 100, heat: 1, drink: 1, jump: .9, chancla: true, intimida: true,
    hab: 'Tiro de Chancla 👡: noquea motochorros, vendedores y cuidacoches.', ven: 'Intimidación: los limpiavidrios ni se le acercan.', des: 'Salta menos: va cargada de bolsas.' },
  karai: { name: 'Señor Adulto', apodo: 'Don Karai', lives: 5, coins: 8000, spd: .86, energy: 100, heat: 1, drink: 1, jump: 1, half: true,
    hab: 'Respeto a las Canas: empieza cada ciudad con ₲8.000.', ven: 'Le cobran la mitad en todo. Tiene 5 chipas (vidas).', des: 'Camina y corre más lento.' },
  nino: { name: 'El Niño', apodo: 'Mitã\'i', lives: 3, coins: 1000, spd: 1.15, energy: 60, heat: 1, drink: 1, jump: 1.04, small: true, dodge: true,
    hab: 'Sigilo: cabe debajo de autos y en cajas donde nadie más entra.', ven: 'Esquiva solo el primer golpe de cada ciudad. Es el más rápido.', des: 'La barra de energía más corta del juego.' },
};
const CHAR_ORDER = ['trabajador', 'estudiante', 'senora', 'karai', 'nino'];
const LOOKS = {
  trabajador: { skin: '#c98d5e', shirt: '#9cc7ea', pants: '#2d3550', hair: '#2a1a10', tie: '#c0392b' },
  estudiante: { skin: '#d9a06f', shirt: '#6d6f78', pants: '#3b4a6b', hair: '#1b1410', back: '#2e7d32', glasses: 1 },
  senora: { skin: '#b97a4f', shirt: '#e86fa0', pants: '#e86fa0', dress: 1, hair: '#3a2418', bun: 1, bags: 1 },
  karai: { skin: '#c08a60', shirt: '#f1efe6', pants: '#7b6a4f', hair: '#dedede', hat: 'piri', mustache: 1 },
  nino: { skin: '#d39b6b', shirt: 'albirroja', pants: '#1d3f8f', hair: '#1a120c', scale: .76 },
  limpia: { skin: '#a8714a', shirt: '#f08a24', pants: '#3a3a3a', hair: '#111', cap: '#c62828' },
  hincha: { skin: '#b57a52', shirt: 'luque', pants: '#222', hair: '#111' },
  zombi: { skin: '#b9b49a', shirt: '#8e8e8e', pants: '#4a4a5a', hair: '#222', bags2: 1, back: '#7b1f1f' },
  carre: { skin: '#9c6844', shirt: '#e0e0e0', pants: '#5a4632', hair: '#111', cap: '#2e7d32' },
  vend: { skin: '#c58b5d', shirt: '#ffd54f', pants: '#333', hair: '#222' },
  pasero: { skin: '#a06a42', shirt: '#3e7cb1', pants: '#444', hair: '#111' },
  turista: { skin: '#f0c8a0', shirt: '#4dd0e1', pants: '#f5f5f5', hair: '#c9a14a', cap: '#ff7043', sun: 1 },
  artesano: { skin: '#a6704a', shirt: '#8d6e63', pants: '#4e342e', hair: '#222', hat: 'piri' },
  zorro: { skin: '#b47b50', shirt: '#c6e832', pants: '#24314f', hair: '#111', cap: '#24314f' },
  chorro: { skin: '#8d5a3a', shirt: '#2b2b2b', pants: '#1c1c1c', hair: '#111', helmet: '#444' },
  chorro2: { skin: '#8d5a3a', shirt: '#7a1f1f', pants: '#1c1c1c', hair: '#111', helmet: '#c62828' },
};

/* ====================== NIVELES ====================== */
const LEVELS = [
  { id: 'asu', name: 'Asunción', sub: 'El Caos Capitalino', len: 4500, sky: ['#7fc6f2', '#dff3ff'], mid: 'ciudad',
    land: ['edificio', 'shopping', 'panteon', 'edificio', 'palacio', 'edificio', 'shopping'],
    feat: { limpia: 3, raudal: 2.2, bache: 1, plat: .7, small: .4 }, hides: ['parada', 'basurero'],
    boss: { k: 'ola', n: 'El Raudal de la Avenida' },
    tip: 'Cuando empieza a llover tenés 3 segundos: subite a la vereda alta o escondete en una parada. Para esquivar al limpiavidrios, saltalo por encima o escondete hasta que se vaya. Si te alcanza, le pagás ₲2.000 o te atrasa.',
    audio: 'Hola mi hijo, soy tu abuela. ¿Ya saliste? Hice sopa paraguaya y chipa guasu para la Nochebuena. Está nublado por Asunción, no te vayas a mojar que después te engripás. Te espero, eh.' },
  { id: 'luq', name: 'Luque', sub: 'La República Independiente', len: 4800, sky: ['#5aa9e6', '#e8f1ff'], mid: 'casas', blue: 1,
    land: ['estadio', 'casa', 'pasarela', 'estadio', 'casa'],
    feat: { moto: 3, hinchas: 2, bache: 1, limpia: 1, small: .5 }, hides: ['despensa', 'basurero'], power: 'kure',
    boss: { k: 'motojefe', n: 'El Motochorro Jefe' },
    tip: 'Si escuchás el BRUM BRUM, metete en la despensa o detrás del basurero (botón ⤵). Donde hay hinchas, caminá despacio: si corrés, te ven.',
    audio: '¿Por dónde andás, mi hijo? Me dijeron que hay partido en Luque. Andá despacito y no le mirés a nadie. Y cuidado con los motochorros, guardá bien tu celular.' },
  { id: 'slo', name: 'San Lorenzo', sub: 'La Ciudad Universitaria… y del Bache', len: 5000, sky: ['#9cc9e8', '#f3f0e0'], mid: 'ciudad',
    land: ['catedral', 'una', 'mercado', 'catedral', 'una', 'mercado'],
    feat: { bache: 3, superbache: 1.8, carre: 2, vend: 2, zombi: 2 },
    boss: { k: 'bache', n: 'El Bache Madre' },
    tip: 'Los súper baches se saltan corriendo. Los universitarios zombis caminan lento y te tapan: saltalos. Ojo con los carretilleros.',
    audio: 'Mi hijo, no te vayas a caer en los baches de San Lorenzo. Tu tío se cayó en uno en el 2019 y todavía no lo encontramos. Mentira… o no.' },
  { id: 'cap', name: 'Capiatá', sub: 'La Ruta Mística', len: 5000, sky: ['#f2a65a', '#ffe2b8'], night: 1, mid: 'monte',
    land: ['monte', 'iglesia', 'monte', 'monte', 'casa'],
    feat: { vaca: 4, ramas: 2, bache: 1, small: .3 }, hides: ['basurero'],
    boss: { k: 'pombero', n: 'El Pombero' },
    tip: 'Las vacas no se mueven del asfalto: saltalas. Cuando oscurece, desde los árboles te tiran ramitas.',
    audio: 'Ya se está haciendo de noche. En Capiatá no le hagas caso a nadie que te silba desde el monte. Si escuchás un silbido, es el Pombero. Llevale un caramelo por si acaso.' },
  { id: 'are', name: 'Areguá', sub: 'El Oasis de la Frutilla', len: 5000, sky: ['#86cdf0', '#eaf7ff'], mid: 'colonial',
    land: ['lago', 'casona', 'cerro', 'lago', 'casona'],
    feat: { cantaros: 3, bache: 1, limpia: 1, plat: .6 }, power: 'frutilla', encargo: 'frutillas',
    boss: { k: 'artesanos', n: 'Los Artesanos Furiosos' },
    tip: 'Si pasás corriendo por los cántaros, los rompés y los artesanos te corren con la escoba. Pasá caminando o saltalos. La Súper Frutilla te hace invencible 10 segundos.',
    audio: 'Ah, y traeme frutillas de Areguá, de las grandes, para el postre. No te las vayas a comer todas en el camino, ¡te conozco!' },
  { id: 'nem', name: 'Ñemby', sub: 'La Cantera y el Embotellamiento', len: 5200, sky: ['#f6c66a', '#fff1c9'], heat: 2, mid: 'casas',
    land: ['cantera', 'casa', 'cantera', 'casa'],
    feat: { camion: 2, tere: 2.2, bache: 2, superbache: 1, limpia: 1 },
    boss: { k: 'camion', n: 'El Camión Tumba' },
    tip: 'Hace un calor bárbaro: la energía se gasta el doble y caminando no se recupera. Buscá los puestos de tereré o te desmayás.',
    audio: '¿Todavía no llegaste? Dicen que en Acceso Sur está todo trancado y hace un calor bárbaro. Tomá mucho tereré, che memby.' },
  { id: 'cde', name: 'Ciudad del Este', sub: 'El Laberinto de las Compras', len: 5400, sky: ['#7a6fd6', '#f5c1e8'], mid: 'neon',
    land: ['puente', 'galeria', 'galeria', 'puente', 'galeria'],
    feat: { pasero: 3, mototaxi: 3, iphone: 2, small: .5, bache: .6 }, power: 'electronico', encargo: 'tele',
    boss: { k: 'cajas', n: 'El Pasero Gigante' },
    tip: 'Los paseros cargan cajas enormes: saltalos o te aplastan. Los mototaxis no frenan. Si el del "iPhone barato" te agarra, perdés plata.',
    acto: 'FIN DEL ACTO 1. Te subiste al colectivo en Ñemby, te dormiste… y despertaste en Ciudad del Este.',
    audio: '¡¿Cómo que estás en Ciudad del Este?! Bueno, ya que estás ahí, comprame un tele nuevo, que el mío ya no agarra Telefuturo. Y que no sea de los truchos, eh.' },
  { id: 'enc', name: 'Encarnación', sub: 'La Perla del Sur y del Costo Alto', len: 5400, sky: ['#4fc3f7', '#fffde7'], sol: 1, heat: 1.5, mid: 'costa',
    land: ['costanera', 'precios', 'playa', 'costanera', 'precios'],
    feat: { semaforo: 2, turista: 3, sombrilla: 3, tere: .6 }, encargo: 'termo',
    boss: { k: 'zorro', n: 'El Zorro Supremo' },
    tip: 'Acá las reglas se cumplen: si cruzás con el semáforo en rojo, el zorro te saca toda la plata. El sol te gasta la energía: andá de sombrilla en sombrilla.',
    audio: 'Mi comadre de Encarnación tiene mi termo, el forrado de cuero. Pasá a buscarlo. Y cuidado que ahí sí te multan, cruzá solamente con verde.' },
  { id: 'pjc', name: 'Pedro Juan Caballero', sub: 'La Frontera Seca', len: 5600, sky: ['#e58a5a', '#ffd9a8'], mid: 'frontera',
    land: ['frontera', 'frontera', 'frontera'],
    feat: { frontera: 2.4, camioneta: 2, balacera: 2, bache: 1 }, hides: ['rueda', 'blindado'],
    boss: { k: 'camioneta', n: 'Las 23:59' },
    tip: 'Al cruzar de Paraguay a Brasil los controles se dan vuelta un rato. Si suena la alarma, tenés 2 segundos para esconderte. Las camionetas no se saltan: escondete.',
    audio: 'Ya falta poquito, mi hijo. Ya está la mesa servida. La casa está en la frontera, en la vereda paraguaya. ¡No te vayas a pasar al Brasil!' },
];
const ENCARGO = { frutillas: { e: '🍓', n: 'las frutillas de Areguá' }, tele: { e: '📺', n: 'el tele del Este' }, termo: { e: '🧉', n: 'el termo de la comadre' } };

const HIDES = {
  parada: { w: 84, h: 74 }, basurero: { w: 40, h: 46 }, despensa: { w: 92, h: 82 }, rueda: { w: 60, h: 60 },
  blindado: { w: 72, h: 62 }, auto: { w: 112, h: 40, small: 1 }, caja: { w: 42, h: 34, small: 1 },
};

/* ---------- generador de cada ciudad ---------- */
function genLevel(idx) {
  const C = LEVELS[idx], R = rng(1000 + idx * 77);
  const L = { idx, C, len: C.len, gaps: [], plats: [], hides: [], items: [], ents: [], trig: [], zones: [], cps: [], trees: [] };
  const item = (t, x, y = GY - 22, o = {}) => L.items.push(Object.assign({ t, x, y, got: false }, o));
  const ent = (t, x, o = {}) => L.ents.push(Object.assign({ t, x, y: GY, vx: 0, on: false, done: false, dead: false, ph: R() * 6 }, ENT[t].base, o));
  const hide = (x, k) => { const d = HIDES[k]; L.hides.push({ x, w: d.w, h: d.h, k, small: !!d.small }); return d.w; };
  const coinRow = (x, y, n, dx = 28) => { for (let i = 0; i < n; i++) item('coin', x + i * dx, y); };
  const coinArc = (x, w, n, hh = 70) => { for (let i = 0; i < n; i++) { const f = n === 1 ? .5 : i / (n - 1); item('coin', x + f * w, GY - 30 - Math.sin(f * Math.PI) * hh); } };
  const hideKinds = C.hides || ['basurero'];
  const F = {
    bache(x) { const w = 58 + R() * 34; L.gaps.push({ x1: x, x2: x + w, water: C.id === 'slo' && R() < .45 }); coinArc(x - 8, w + 16, 3); return w; },
    superbache(x) { const w = 108 + R() * 20; L.gaps.push({ x1: x, x2: x + w, water: R() < .5, big: 1 }); coinArc(x, w, 4, 85); return w; },
    plat(x) { L.plats.push({ x, w: 150, y: GY - 42, solid: 1 }); coinRow(x + 35, GY - 66, 3); return 150; },
    small(x) { const k = R() < .5 ? 'auto' : 'caja'; return hide(x, k); },
    limpia(x) { ent('limpia', x + 40); return 80; },
    raudal(x) { L.trig.push({ x, t: 'raudal' }); L.plats.push({ x: x + 110, w: 190, y: GY - 42, solid: 1 }); coinRow(x + 140, GY - 66, 4); if (R() < .5) { hide(x + 330, 'parada'); return 420; } return 300; },
    moto(x) { L.trig.push({ x, t: 'moto' }); return 150 + hide(x + 150, R() < .6 ? 'despensa' : 'basurero'); },
    hinchas(x) { const w = 380 + R() * 120; L.zones.push({ t: 'hinchas', x1: x, x2: x + w }); coinRow(x + 60, GY - 22, 4, 60); return w; },
    carre(x) { ent('carre', x + 100); return 140; },
    vend(x) { ent('vend', x + 40); return 80; },
    zombi(x) { ent('zombi', x + 40); if (R() < .5) ent('zombi', x + 110); return 150; },
    vaca(x) { ent('vaca', x + 40); return 110; },
    ramas(x) { L.trees.push({ x: x + 40 }); ent('arbol', x + 40); return 120; },
    cantaros(x) { ent('cantaros', x + 30); return 80; },
    camion(x) { L.trig.push({ x, t: 'camion' }); coinRow(x, GY - 22, 3); return 120; },
    tere(x) { item('tere', x + 30); return 70; },
    pasero(x) { ent('pasero', x + 120); return 160; },
    mototaxi(x) { L.trig.push({ x, t: 'mototaxi' }); return 60; },
    iphone(x) { ent('iphone', x + 40); return 80; },
    turista(x) { ent('turista', x + 200); return 120; },
    semaforo(x) { L.zones.push({ t: 'cruce', x1: x + 30, x2: x + 230, off: R() * 6 }); return 260; },
    sombrilla(x) { L.zones.push({ t: 'sombra', x1: x, x2: x + 96 }); return 96; },
    frontera(x) { L.trig.push({ x, t: 'frontera' }); return 60; },
    camioneta(x) { L.trig.push({ x, t: 'camioneta' }); return 150 + hide(x + 150, R() < .5 ? 'rueda' : 'blindado'); },
    balacera(x) { L.trig.push({ x, t: 'balacera' }); return 120 + hide(x + 120, hideKinds[(R() * hideKinds.length) | 0]); },
  };
  const keys = Object.keys(C.feat), tot = keys.reduce((s, k) => s + C.feat[k], 0);
  const pick = () => { let r = R() * tot; for (const k of keys) { r -= C.feat[k]; if (r <= 0) return k; } return keys[0]; };
  const end = C.len - 1250, cpX = C.len * .5;
  const special = [];
  if (C.power) special.push({ at: C.len * .3, t: C.power });
  if (C.power === 'frutilla') special.push({ at: C.len * .62, t: 'frutilla' });
  if (C.encargo) special.push({ at: C.len * .72, t: 'encargo' });
  let x = 520, cpDone = false, last = '';
  while (x < end) {
    if (!cpDone && x > cpX) { L.cps.push({ x: x + 20, used: false }); x += 220; cpDone = true; continue; }
    const sp = special.find(s => !s.done && x > s.at);
    if (sp) {
      sp.done = true;
      if (sp.t === 'encargo') { L.plats.push({ x: x + 40, w: 110, y: GY - 72 }); item('encargo', x + 95, GY - 96, { k: C.encargo }); x += 260; }
      else { item(sp.t, x + 40, GY - 40); x += 160; }
      continue;
    }
    let f = pick(); if (f === last && R() < .5) f = pick(); last = f;
    x += F[f](x);
    // espacio libre entre obstáculos (sin baches), con algún consumible
    const gap = 150 + R() * 150 * (1 - idx * .04);
    const mx = x + gap * .5, r = R();
    if (r < .1) item(R() < .5 ? 'pulp' : 'cerveza', mx);
    else if (r < .16) item('chipa', mx);
    else if (r < .25) item('emp', mx, GY - 22, { price: 5000 });
    else if (r < .3) item(R() < .5 ? 'emp' : 'asado', mx);
    else if (r < .6) coinRow(mx - 28, GY - 22, 3);
    if (C.heat && R() < .3) item('tere', x + gap * .8);
    x += gap;
  }
  // tramo del jefe: corre detrás tuyo hasta la meta
  L.bossX = end + 60;
  if (C.heat) item('tere', end + 260);
  L.gaps.push({ x1: end + 520, x2: end + 590 });
  L.gaps.push({ x1: end + 860, x2: end + 930 });
  coinArc(end + 510, 90, 3); coinArc(end + 850, 90, 3);
  L.goal = C.len - 130;
  return L;
}

/* ---------- comportamiento de cada enemigo/obstáculo ---------- */
const ENT = {
  limpia: { base: { w: 20, h: 46 } }, carre: { base: { w: 54, h: 46 } }, vend: { base: { w: 24, h: 48 } }, iphone: { base: { w: 24, h: 48 } },
  zombi: { base: { w: 20, h: 46 } }, vaca: { base: { w: 66, h: 40 } }, arbol: { base: { w: 10, h: 10 } }, cantaros: { base: { w: 40, h: 46 } },
  artesano: { base: { w: 20, h: 46 } }, pasero: { base: { w: 34, h: 74 } }, turista: { base: { w: 22, h: 46 } }, rama: { base: { w: 18, h: 10 } },
  moto: { base: { w: 60, h: 150 } }, camioneta: { base: { w: 110, h: 150 } }, mototaxi: { base: { w: 54, h: 30 } },
};

/* ====================== ESTADO DE JUEGO ====================== */
let G = null;
const K = { left: 0, right: 0, run: 0, down: 0, jump: 0 };
const PR = { jump: 0, down: 0, dash: 0, eat: 0, throw: 0 };

function startLevel(i, fromCp) {
  const C = CHARS[S.char], L = genLevel(i), prev = G;
  const keepCp = fromCp && prev && prev.i === i && prev.cp;
  const startX = keepCp ? prev.cp : 80;
  const clock0 = S.clockAt[i] != null ? S.clockAt[i] : 18 * 60 + i * 30;
  G = { i, L, C, lk: LOOKS[S.char], state: 'play', t: 0, clock: keepCp ? prev.clock : clock0,
    p: { x: startX, y: GY, vx: 0, vy: 0, w: C.small ? 16 : 20, h: C.small ? 36 : 48, face: 1, lives: C.lives, en: C.energy, coins: C.coins,
      invul: 1.2, shield: 0, frut: 0, slow: 0, stun: 0, kbT: 0, kbV: 0, dashT: 0, dash: 0, food: [], ph: 0, ground: true, coy: 0, jbuf: 0,
      hidden: null, crouch: false, grace: C.grace || 0, faint: 0, dodged: false, boost: 0, hcd: 0, tcd: 0, prevY: GY, prevX: startX, running: false, payCd: 0 },
    cp: keepCp ? prev.cp : 0, encargo: keepCp ? prev.encargo : false, ev: [], shots: [], parts: [], msg: null, banner: null,
    boss: { on: false, x: 0 }, invert: 0, fog: 0, shake: 0, camX: 0, rain: 0, water: 0 };
  if (keepCp) {
    L.trig.forEach(t => { if (t.x < startX) t.done = true; });
    L.cps.forEach(c => { if (c.x <= startX) c.used = true; });
    L.items.forEach(it => { if (it.x < startX && it.t !== 'encargo') it.got = true; });
    if (G.encargo) L.items.forEach(it => { if (it.t === 'encargo') it.got = true; });
  }
  G.camX = clamp(startX - W * .33, 0, L.len - W);
  showScreen(null); setCtl(true);
  say(LEVELS[i].name + ' — ' + LEVELS[i].sub, 3);
}

function say(t, d = 2.4) { G.msg = { t, d, t0: G.t }; }
function bannerOn(t, d = 2.5, col = '#d52b1e') { G.banner = { t, d, t0: G.t, col }; }
function float(x, y, t, col = '#fff') { G.parts.push({ x, y, vx: 0, vy: -40, life: 1.2, t, col }); }
function burst(x, y, col, n = 10) { for (let i = 0; i < n; i++) G.parts.push({ x, y, vx: (Math.random() - .5) * 260, vy: -Math.random() * 260, life: .6 + Math.random() * .4, col, g: 1 }); }

function hurt(msg, o = {}) {
  const P = G.p, C = G.C;
  if (!o.fall && (P.invul > 0 || P.frut > 0 || P.shield > 0)) return false;
  if (!o.fall && C.dodge && !P.dodged) { P.dodged = true; P.invul = 1.2; say('¡El Mitã\'i lo esquivó! 😎'); float(P.x, P.y - 60, '¡ESQUIVÓ!', '#7fffd4'); return false; }
  P.lives--; P.invul = 1.8; G.shake = .35; sfx('hit'); say(msg, 2.6);
  float(P.x, P.y - 60, '-1 🥯', '#ff6b6b');
  if (P.lives <= 0) { G.state = 'dead'; setCtl(false); setTimeout(showDead, 700); }
  return true;
}
function bump(msg, en, dir = -1) {
  const P = G.p;
  if (P.invul > 0 || P.frut > 0 || P.shield > 0) return false;
  P.en = Math.max(0, P.en - en); P.kbT = .25; P.kbV = 230 * dir; P.vy = -220; P.ground = false; P.invul = .7;
  sfx('bump'); say(msg); float(P.x, P.y - 60, '-' + en + '⚡', '#ffd54f');
  return true;
}
function overlap(e, pad = 0) {
  const P = G.p, ph = P.crouch ? P.h * .62 : P.h;
  return Math.abs(e.x - P.x) < (e.w + P.w) / 2 - pad && P.y - ph < e.y && P.y > e.y - e.h;
}
const price = n => G.C.half ? n / 2 : n;

/* ====================== ACTUALIZAR ====================== */
function update(dt) {
  const P = G.p, C = G.C, L = G.L, LC = L.C;
  G.t += dt; G.clock += dt / 4;
  for (const k of ['invul', 'shield', 'frut', 'slow', 'stun', 'kbT', 'dashT', 'boost', 'hcd', 'tcd', 'payCd', 'coy', 'jbuf']) if (P[k] > 0) P[k] -= dt;
  if (G.invert > 0) G.invert -= dt;
  if (G.fog > 0) G.fog -= dt;
  if (G.shake > 0) G.shake -= dt;

  // entradas
  let dir = (K.right ? 1 : 0) - (K.left ? 1 : 0);
  if (G.invert > 0) dir = -dir;
  if (PR.jump) P.jbuf = .14;
  if (PR.down) {
    if (P.hidden) { P.hidden = null; }
    else {
      const h = P.ground && L.hides.find(h => P.x > h.x - 10 && P.x < h.x + h.w + 10);
      if (h) {
        if (h.small && !C.small) say('Ahí solamente cabe el Mitã\'i 🧒');
        else { P.hidden = h; P.x = h.x + h.w / 2; P.vx = 0; sfx('bump'); float(P.x, GY - h.h - 10, '🤫', '#fff'); }
      }
    }
  }
  if (P.hidden && (dir || P.jbuf > 0)) { P.hidden = null; P.jbuf = 0; }
  if (PR.dash && P.dash > 0 && !P.hidden) { P.dash--; P.dashT = .38; P.invul = Math.max(P.invul, .45); P.vy = Math.min(P.vy, -120); sfx('power'); burst(P.x, P.y - 20, '#bde0fe', 8); }
  if (PR.eat && P.food.length && !P.hidden) { const f = P.food.pop(); P.en = C.energy; sfx('eat'); say(f === 'emp' ? '🥟 ¡Empanada con pancito! Energía llena' : '🍖 ¡Asadito! Energía llena'); }
  if (PR.throw && C.chancla && P.tcd <= 0 && !P.hidden) { P.tcd = .9; G.shots.push({ x: P.x + P.face * 10, y: P.y - 34, vx: P.face * 520 + P.vx * .3, vy: -170, r: 0 }); sfx('throw'); }
  for (const k in PR) PR[k] = 0;

  // velocidad y energía
  const heat = LC.heat || 1;
  const tired = P.en <= 0 && !(C.grace && P.grace > 0);
  P.crouch = K.down && P.ground && !P.hidden;
  const wantRun = K.run && dir !== 0 && !tired && !P.crouch;
  let sp = C.spd * (wantRun ? 250 : 140);
  if (P.en <= 0 && !wantRun) sp *= .75;
  if (P.boost > 0) sp *= 1.3;
  if (P.frut > 0) sp = C.spd * 410;
  if (P.slow > 0) sp *= .5;
  if (P.crouch) sp *= .45;
  if (P.stun > 0 || P.hidden || G.state !== 'play') sp = 0;
  const target = dir * sp;
  P.vx += clamp(target - P.vx, -1600 * dt, 1600 * dt);
  if (P.dashT > 0) P.vx = 540 * P.face;
  if (P.kbT > 0) P.vx = P.kbV;
  if (dir) P.face = dir;
  P.running = (wantRun || P.frut > 0) && Math.abs(P.vx) > C.spd * 170;
  const moving = Math.abs(P.vx) > 20;
  let shade = false;
  for (const z of L.zones) if (z.t === 'sombra' && P.x > z.x1 && P.x < z.x2) shade = true;
  if (P.frut > 0) P.en = Math.min(C.energy, P.en + 20 * dt);
  else if (P.running) P.en -= 22 * (heat > 1 ? heat * C.heat : 1) * dt;
  else if (LC.sol) P.en += shade ? 32 * dt : -6 * C.heat * dt;
  else if (!LC.heat) P.en += (moving ? 8 : 16) * dt;
  else if (!moving) P.en += 3 * dt;
  if (LC.sol && P.running && shade) P.en += 20 * dt;
  if (P.en <= 0) { P.en = 0; if (P.running && C.grace) P.grace -= dt; }
  if (P.en > 25 && C.grace) P.grace = C.grace;
  P.en = Math.min(C.energy, P.en);
  if (heat > 1 && P.en <= 0 && !P.hidden) { P.faint += dt; if (P.faint > 3.5) { P.faint = 0; if (hurt('😵 ¡Te desmayaste del calor! Tomá tereré', { fall: true })) P.en = C.energy * .6; } } else P.faint = 0;

  // salto y gravedad
  if (P.ground) P.coy = .1;
  if (P.jbuf > 0 && P.coy > 0 && !P.hidden && P.stun <= 0) { P.vy = -620 * C.jump; P.jbuf = 0; P.coy = 0; P.ground = false; sfx('jump'); }
  if (!K.jump && P.vy < -250) P.vy += 1800 * dt;   // salto corto si soltás
  P.vy += (P.dashT > 0 ? 400 : 1800) * dt;
  P.prevY = P.y; P.prevX = P.x;
  P.x += P.vx * dt; P.y += P.vy * dt;
  if (P.x < 20) P.x = 20;
  if (P.x > L.len - 20) P.x = L.len - 20;
  if (moving && P.ground) P.ph += dt * Math.abs(P.vx) / 14;

  // piso, baches y veredas altas
  P.ground = false;
  const gap = P.frut > 0 ? null : L.gaps.find(g => P.x > g.x1 + 6 && P.x < g.x2 - 6);
  if (P.vy >= 0) {
    for (const pl of L.plats) if (P.x > pl.x - 6 && P.x < pl.x + pl.w + 6 && P.prevY <= pl.y + 2 && P.y >= pl.y) { P.y = pl.y; P.vy = 0; P.ground = true; }
    if (!P.ground && !gap && P.y >= GY && P.prevY <= GY + 6) { P.y = GY; P.vy = 0; P.ground = true; }
  }
  for (const pl of L.plats) if (pl.solid && P.y > pl.y + 4 && P.y - P.h < GY && P.x + P.w / 2 > pl.x && P.x - P.w / 2 < pl.x + pl.w) {
    P.x = P.prevX <= pl.x + pl.w / 2 ? pl.x - P.w / 2 : pl.x + pl.w + P.w / 2; P.vx = 0;
  }
  if (P.y > GY + 6) {   // adentro de un bache: no se puede atravesar la pared
    const g = L.gaps.find(g => P.prevX >= g.x1 - 2 && P.prevX <= g.x2 + 2);
    if (g) P.x = clamp(P.x, g.x1 + 4, g.x2 - 4);
  }
  if (P.y > H + 40) {
    const g = L.gaps.find(g => P.x >= g.x1 - 10 && P.x <= g.x2 + 10);
    hurt(g && g.water ? '💦 ¡Era un bache con agua y no tenía fondo!' : '🕳️ ¡Te caíste en un bache!', { fall: true });
    P.x = g ? g.x1 - 40 : P.x - 80; P.y = GY; P.vy = 0; P.vx = 0; P.invul = 1.8;
    if (G.boss.on) G.boss.x = Math.min(G.boss.x, P.x - 300);
  }

  // checkpoint de tereré (yuyera)
  for (const c of L.cps) if (!c.used && P.x > c.x) {
    c.used = true; G.cp = c.x; P.en = C.energy; sfx('eat');
    if (LC.id === 'pjc' && Math.random() < .5) {
      P.boost = 9; if (P.lives > 1) { P.lives--; float(P.x, P.y - 60, '-1 🥯 ¡quema!', '#ff6b6b'); }
      say('🧉 ¡Era chimarrão! Corrés más rápido… pero te quemaste. Partida guardada', 3.2);
    } else say('🧉 Tereré en la yuyera: energía llena y partida guardada', 3);
  }

  // ítems
  for (const it of L.items) {
    if (it.got || Math.abs(it.x - P.x) > 22 || P.y - P.h > it.y + 10 || P.y < it.y - 14) continue;
    if (P.hidden) continue;
    pickItem(it);
  }

  // disparadores de eventos
  for (const tr of L.trig) if (!tr.done && P.x > tr.x) { tr.done = true; startEvent(tr.t); }
  for (let k = G.ev.length - 1; k >= 0; k--) { const e = G.ev[k]; e.t += dt; if (stepEvent(e, dt)) G.ev.splice(k, 1); }
  G.rain = G.ev.some(e => e.k === 'raudal') ? Math.min(1, G.rain + dt) : Math.max(0, G.rain - dt);

  // zonas
  for (const z of L.zones) {
    if (P.x < z.x1 || P.x > z.x2) continue;
    if (z.t === 'hinchas' && P.running && !P.hidden && P.hcd <= 0) { P.hcd = 2.5; if (hurt('📣 ¡Los hinchas te vieron correr! Caminá despacio')) burst(P.x, P.y - 40, '#f2c14e', 12); }
    if (z.t === 'cruce' && !semaforoVerde(z) && P.payCd <= 0 && P.y >= GY - 2) {
      P.payCd = 2; sfx('whistle');
      if (P.coins > 0) { say('🚔 ¡Multa por cruzar en rojo! El zorro te sacó ₲' + fmt(P.coins), 3); float(P.x, P.y - 60, '-₲' + fmt(P.coins), '#ff6b6b'); P.coins = 0; }
      else say('🚔 ¡En rojo no se cruza! Y encima no tenés ni para la multa', 3);
      P.x = z.x1 - 26; P.vx = 0; P.stun = .6;
    }
  }

  // enemigos
  for (const e of L.ents) if (!e.dead) stepEnt(e, dt);
  L.ents = L.ents.filter(e => !e.dead || e.keep);

  // chancla de la señora
  for (const s of G.shots) {
    s.vy += 900 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.r += dt * 18;
    for (const e of L.ents) if (!e.dead && !e.ko && ['limpia', 'carre', 'vend', 'iphone', 'zombi', 'artesano', 'pasero', 'turista', 'moto', 'mototaxi'].includes(e.t)
      && Math.abs(e.x - s.x) < e.w / 2 + 10 && s.y > e.y - Math.min(e.h, 80) && s.y < e.y) {
      e.ko = 1.5; e.done = true; e.hitDone = true; s.dead = true; burst(s.x, s.y, '#fff', 8); float(e.x, e.y - 70, '¡PAF! 👡', '#fff'); sfx('bump');
      if (e.t === 'moto' || e.t === 'mototaxi') { e.vx *= .2; }
    }
    if (s.y > GY + 10) s.dead = true;
  }
  G.shots = G.shots.filter(s => !s.dead);

  // jefe que te persigue
  const B = G.boss;
  if (!B.on && P.x > L.bossX) { B.on = true; B.x = P.x - 440; bannerOn('⚠️ ' + LC.boss.n + ' te persigue. ¡CORRÉ!', 3); sfx('alarm'); }
  if (B.on && P.x < L.goal) {
    B.x += C.spd * 140 * 1.14 * dt;
    if (B.x > P.x - P.w / 2) {
      if (hurt('💥 ¡Te alcanzó ' + LC.boss.n + '!')) B.x = P.x - 440;
      else B.x = P.x - 60;
    }
  }

  // partículas
  for (const p of G.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.g) p.vy += 700 * dt; }
  G.parts = G.parts.filter(p => p.life > 0);

  // cámara
  const tx = clamp(P.x - W * .33, 0, L.len - W);
  G.camX += (tx - G.camX) * Math.min(1, dt * 8);

  if (P.x >= L.goal && G.state === 'play') winLevel();
}

function semaforoVerde(z) { return ((G.t + z.off) % 7) < 4; }

function pickItem(it) {
  const P = G.p, C = G.C;
  const cap = C.mochila || 1;
  switch (it.t) {
    case 'coin': P.coins += 1000; sfx('coin'); float(it.x, it.y - 10, '+₲1.000', '#ffe082'); break;
    case 'chipa': if (P.lives >= C.lives + 2) { P.coins += 2000; float(it.x, it.y - 10, '+₲2.000'); } else { P.lives++; say('🥯 ¡Chipa calentita! +1 vida'); } sfx('eat'); break;
    case 'emp': case 'asado':
      if (it.price) {
        const pz = price(it.price);
        if (P.coins < pz) { if (P.payCd <= 0) { say('💸 La empanada sale ₲' + fmt(pz) + ' y no te alcanza'); P.payCd = 2; } return; }
        P.coins -= pz; sfx('pay'); float(it.x, it.y - 10, '-₲' + fmt(pz), '#ffcc80');
      }
      if (P.en < C.energy * .6 || P.food.length >= cap) { P.en = C.energy; sfx('eat'); say(it.t === 'emp' ? '🥟 Empanada con pancito: energía llena' : '🍖 Asadito: energía llena'); }
      else { P.food.push(it.t); sfx('coin'); say((it.t === 'emp' ? '🥟' : '🍖') + ' A la mochila. Tocá COMER cuando estés cansado'); }
      break;
    case 'pulp': case 'cerveza':
      P.dash = Math.min(3, P.dash + 1); P.en = Math.min(C.energy, P.en + 15 * C.drink); sfx('coin');
      say((it.t === 'pulp' ? '🥤 Pulp' : '🍺 Cerveza') + ' bien fría: tocá DASH para un impulso' + (C.drink > 1 ? ' (te rinde el doble)' : '')); break;
    case 'tere': P.en = Math.min(C.energy, P.en + 40 * C.drink); P.faint = 0; sfx('eat'); say('🧉 ¡Tereré! +energía' + (C.drink > 1 ? ' (x2)' : '')); break;
    case 'kure': P.shield = 9; sfx('power'); bannerOn('🐷 KURE DE PELUCHE: escudo por 9 segundos', 2, '#1f4fbf'); break;
    case 'electronico': P.shield = 10; sfx('power'); bannerOn('🔋 ELECTRÓNICO DE CONTRABANDO: escudo cibernético 10 s', 2, '#7a3fd0'); break;
    case 'frutilla': P.frut = 10; P.en = C.energy; sfx('power'); bannerOn('🍓 ¡MODO AZÚCAR! Invencible 10 segundos', 2, '#e53935'); break;
    case 'encargo': G.encargo = true; sfx('win'); bannerOn('🎁 ¡Conseguiste ' + ENCARGO[it.k].n + '!', 2.6, '#2a9d3f'); break;
  }
  it.got = true;
}

/* ---------- eventos: motochorros, raudal, balacera… ---------- */
function startEvent(k) {
  const e = { k, t: 0 };
  if (k === 'moto') { sfx('moto'); bannerOn('🔊 BRUM BRUM… ¡Motochorros! Escondete (⤵)', 2.6); }
  if (k === 'camioneta') { sfx('sertanejo'); bannerOn('🎶 ¡Camioneta con sertanejo a todo lo que da! Escondete', 2.4, '#e65100'); }
  if (k === 'raudal') { sfx('rain'); bannerOn('🌧️ ¡Se viene el raudal! Subite a la vereda alta (3…)', 3, '#0277bd'); }
  if (k === 'balacera') { sfx('alarm'); bannerOn('🚨 ¡PELIGRO! Escondete YA', 2, '#b71c1c'); }
  if (k === 'mototaxi') { sfx('moto'); }
  if (k === 'camion') { sfx('moto'); }
  if (k === 'frontera') {
    G.invert = 4.5; sfx('whistle');
    G.side = !G.side;
    bannerOn(G.side ? '🇧🇷 ¡Bem-vindo ao Brasil! Controles al revés' : '🇵🇾 ¡De vuelta en Paraguay! Controles al revés', 2.2, G.side ? '#2e7d32' : '#d52b1e');
  }
  G.ev.push(e);
}
function stepEvent(e, dt) {
  const P = G.p, L = G.L;
  switch (e.k) {
    case 'moto': case 'camioneta': {
      const wait = e.k === 'moto' ? 2.6 : 2.3;
      if (e.t >= wait && !e.spawned) {
        e.spawned = true;
        L.ents.push({ t: e.k, x: G.camX + W + 80, y: GY, vx: e.k === 'moto' ? -620 : -700, w: ENT[e.k].base.w, h: 150, on: true, ph: 0 });
      }
      return e.t > wait + 2.5;
    }
    case 'mototaxi':
      if (e.t >= 1.1 && !e.spawned) { e.spawned = true; L.ents.push({ t: 'mototaxi', x: G.camX + W + 60, y: GY, vx: -560, w: 54, h: 30, on: true, ph: 0 }); }
      return e.t > 3.5;
    case 'raudal': {
      if (e.t > 1 && e.t < 3 && Math.floor(e.t) !== e.last) { e.last = Math.floor(e.t); bannerOn('🌧️ ¡Se viene el raudal! Subite a la vereda alta (' + (3 - e.last) + '…)', 1, '#0277bd'); }
      G.water = e.t < 3 ? 0 : e.t < 3.5 ? (e.t - 3) * 2 : e.t < 7 ? 1 : Math.max(0, 1 - (e.t - 7) * 1.5);
      if (e.t > 3.2 && e.t < 7 && !e.hit && P.y >= GY - 2 && !(P.hidden && P.hidden.k === 'parada')) {
        if (hurt('🌊 ¡El raudal te arrastró!')) { e.hit = true; P.kbT = .5; P.kbV = -260; }
      }
      if (e.t >= 7.7) { G.water = 0; return true; }
      return false;
    }
    case 'balacera':
      if (e.t > 2 && e.t < 3.6) {
        if (Math.random() < dt * 12) G.parts.push({ x: G.camX + Math.random() * W, y: 120 + Math.random() * 160, vx: 0, vy: 0, life: .25, t: '💥', col: '#fff' });
        if (!e.hit && !P.hidden && hurt('💥 ¡Te agarró la balacera! Había que esconderse')) e.hit = true;
      }
      if (e.t >= 3.6 && !e.said) { e.said = true; say('😮‍💨 Ya pasó el caos…'); }
      return e.t > 4;
    case 'camion':
      if (e.t > 1.2 && !e.dust) { e.dust = true; G.fog = 4; say('🚛 ¡Camión tumba! No se ve nada por el polvo'); }
      return e.t > 5.5;
    case 'frontera': return true;
  }
  return true;
}

function stepEnt(e, dt) {
  const P = G.p, C = G.C, d = e.x - P.x;
  e.ph += dt * 6;
  if (e.ko > 0) { e.ko -= dt; e.x += e.vx * dt; if (e.ko <= 0) e.dead = true; return; }
  if (!e.on && d < W * .8) e.on = true;
  if (!e.on) return;
  const touch = !P.hidden && overlap(e, 4);
  if (P.frut > 0 && touch && !['arbol', 'rama'].includes(e.t)) { e.dead = true; burst(e.x, e.y - 30, '#ff5252', 14); float(e.x, e.y - 60, '¡PUM! 🍓', '#ff8a80'); sfx('bump'); return; }
  switch (e.t) {
    case 'limpia':
      if (e.done) { e.vx = -150; e.face = -1; }
      else if (C.intimida) { e.vx = d < 260 ? 120 : 0; e.face = 1; if (d < 260 && !e.said) { e.said = 1; float(e.x, e.y - 60, '¡Perdón doña! 😰', '#fff'); } }
      else if (P.hidden && d < 380) {   // si te escondés, al rato se aburre y se va
        e.vx = 0; e.lost = (e.lost || 0) + dt;
        if (e.lost > .8) { e.done = true; float(e.x, e.y - 60, 'Bueh… se fue 🤷', '#fff'); }
      }
      else if (d < -14) { e.done = true; float(e.x, e.y - 60, '¡Se me escapó! 😤', '#fff'); }   // ya lo pasaste (saltando): no te persigue
      else if (d < 380) { e.vx = -115; e.face = -1; } else e.vx = 0;
      e.x += e.vx * dt;
      if (touch && !e.done) {
        e.done = true; const pz = price(2000);
        if (C.intimida) float(e.x, e.y - 60, '¡Perdón doña! 😰', '#fff');
        else if (P.coins >= pz) { P.coins -= pz; sfx('pay'); say('🧽 Le pagaste ₲' + fmt(pz) + ' al limpiavidrios y te dejó pasar'); float(P.x, P.y - 60, '-₲' + fmt(pz), '#ffcc80'); }
        else { P.slow = 2.2; sfx('bump'); say('🧽 ¡Te limpió el parabrisas… de la cara! Sin plata, te atrasó'); }
      }
      if (e.x < G.camX - 200 && e.done) e.dead = true;
      break;
    case 'carre':
      if (d < 520) e.vx = -230; e.x += e.vx * dt;
      if (touch && !e.hitDone) { e.hitDone = true; bump('🛒 ¡Carretillero a toda velocidad!', 25); }
      if (e.x < G.camX - 200) e.dead = true;
      break;
    case 'vend': case 'iphone':
      if (touch && !e.done) {
        e.done = true;
        if (C.push) { say('💪 Pasaste empujando al vendedor'); break; }
        P.stun = 1.4; P.vx = 0; sfx('bump');
        if (e.t === 'iphone') { const q = Math.min(P.coins, 5000); P.coins -= q; say('📱 Te vendieron un "iPhone barato"… era un ladrillo 🧱 (-₲' + fmt(q) + ')', 3); }
        else say('🧦 "¡Medias, medias, 3 por 10.000!" Te atajó el vendedor', 2.6);
      }
      break;
    case 'zombi':
      e.vx = 34; e.x += e.vx * dt;
      if (touch && !C.zombi && !C.push && P.y > e.y - e.h + 10) {
        P.x = P.x < e.x ? e.x - (e.w + P.w) / 2 + 4 : e.x + (e.w + P.w) / 2 - 4;
        if (!e.said) { e.said = 1; float(e.x, e.y - 64, 'zzz… parcial…', '#ddd'); }
      }
      break;
    case 'vaca':
      if (touch && !e.hitDone) { if (bump('🐄 ¡Muuu! Chocaste una vaca en plena ruta', 22)) { e.hitDone = true; setTimeout(() => e.hitDone = false, 1500); } }
      break;
    case 'arbol':
      if (G.L.C.night && G.t > 0 && nightAmt() > .3 && !e.done && d < 170 && d > -20) {
        e.done = true; G.L.ents.push({ t: 'rama', x: P.x + P.vx * .45, y: 90, vy: 0, vx: 0, w: 18, h: 10, on: true, ph: 0 });
        if (Math.random() < .5) { sfx('laugh'); float(e.x, 130, 'jiji… 👀', '#cfd8dc'); }
      }
      break;
    case 'rama':
      e.vy += 700 * dt; e.y += e.vy * dt;
      if (touch && !e.hitDone) { e.hitDone = true; bump('🌿 ¡Te tiraron una ramita desde el monte!', 25, P.face > 0 ? -1 : 1); P.stun = .4; }
      if (e.y > GY) e.dead = true;
      break;
    case 'cantaros':
      if (touch && !e.broken && P.running && P.y > e.y - e.h + 8) {
        e.broken = true; burst(e.x, e.y - 20, '#b5651d', 18); sfx('hit'); say('🏺 ¡Rompiste los cántaros! Los artesanos te corren con la escoba', 3);
        G.L.ents.push({ t: 'artesano', x: e.x - 60, y: GY, vx: 0, w: 20, h: 46, on: true, ph: 0, life: 6 });
      }
      break;
    case 'artesano':
      e.life -= dt;
      if (e.life > 0 && !e.done) { e.vx = (P.x > e.x ? 1 : -1) * 200; e.face = Math.sign(e.vx); } else { e.vx = -160; e.face = -1; }
      e.x += e.vx * dt;
      if (touch && !e.done && hurt('🧹 ¡Escobazo del artesano!')) e.done = true;
      if (e.life < -4) e.dead = true;
      break;
    case 'pasero':
      if (d < 620) e.vx = -95; e.x += e.vx * dt;
      if (touch && !e.hitDone && hurt('📦 ¡Te aplastó un pasero con un tele de 65"!')) e.hitDone = true;
      if (e.x < G.camX - 200) e.dead = true;
      break;
    case 'turista':
      if (d < 700) e.vx = -270; e.x += e.vx * dt;
      if (touch && !e.hitDone) { e.hitDone = true; bump('🛼 ¡Turista en rollers mirando el celular!', 20); }
      if (e.x < G.camX - 200) e.dead = true;
      break;
    case 'moto': case 'camioneta':
      e.x += e.vx * dt;
      if (!e.hitDone && Math.abs(e.x - P.x) < e.w / 2 + 6) {
        e.hitDone = true;
        if (P.hidden) { float(P.x, P.y - 70, '¡Uff! No te vieron 😮‍💨', '#c8e6c9'); }
        else if (e.t === 'moto') { if (hurt('🔪 ¡Motochorros! Te robaron la mitad de la plata')) { const q = Math.floor(P.coins / 2000) * 1000; P.coins -= q; } }
        else hurt('🛻 ¡Te pasó por encima la camioneta!');
      }
      if (e.x < G.camX - 300) e.dead = true;
      break;
    case 'mototaxi':
      e.x += e.vx * dt;
      if (touch && !e.hitDone && hurt('🏍️ ¡Mototaxi sin frenos!')) e.hitDone = true;
      if (e.x < G.camX - 200) e.dead = true;
      break;
  }
}

function nightAmt() {
  const L = G ? G.L : null; if (!L || !L.C.night) return 0;
  return clamp((G.p.x / L.len - .35) * 2.5, 0, .85);
}

/* ====================== DIBUJO ====================== */
function emo(e, x, y, s = 20) { ctx.font = s + 'px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(e, x, y); }
function txt(t, x, y, s = 12, col = '#fff', al = 'center', bold = true, stroke = '') {
  ctx.font = (bold ? '800 ' : '') + s + 'px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif'; ctx.textAlign = al; ctx.textBaseline = 'middle';
  if (stroke) { ctx.lineWidth = 3; ctx.strokeStyle = stroke; ctx.strokeText(t, x, y); }
  ctx.fillStyle = col; ctx.fillText(t, x, y);
}
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }

function drawPerson(x, y, lk, o = {}) {
  const s = (lk.scale || 1) * (o.scale || 1), f = o.face || 1;
  ctx.save(); ctx.translate(x, y); ctx.scale(f * s, s);
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  const sw = o.moving ? Math.sin(o.ph || 0) : 0, cr = o.crouch ? 10 : 0;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const hip = -18 + cr;
  // mochila atrás
  if (lk.back) { ctx.fillStyle = lk.back; rr(-13, -38 + cr, 8, 16, 3); ctx.fill(); }
  // piernas
  ctx.strokeStyle = lk.dress ? lk.skin : lk.pants; ctx.lineWidth = 5;
  ctx.beginPath();
  if (o.air) { ctx.moveTo(0, hip); ctx.lineTo(-6, -4); ctx.moveTo(0, hip); ctx.lineTo(7, -9); }
  else if (o.crouch) { ctx.moveTo(0, hip); ctx.lineTo(7, -5); ctx.lineTo(4, 0); ctx.moveTo(0, hip); ctx.lineTo(-5, -5); ctx.lineTo(-7, 0); }
  else { ctx.moveTo(0, hip); ctx.lineTo(sw * 9, 0); ctx.moveTo(0, hip); ctx.lineTo(-sw * 9, 0); }
  ctx.stroke();
  ctx.fillStyle = '#222';
  if (!o.air && !o.crouch) { ctx.fillRect(sw * 9 - 2, -2, 6, 3); ctx.fillRect(-sw * 9 - 2, -2, 6, 3); }
  // torso
  const ty = -37 + cr;
  if (lk.dress) {
    ctx.fillStyle = lk.shirt; ctx.beginPath(); ctx.moveTo(-6, ty); ctx.lineTo(6, ty); ctx.lineTo(10, -12 + cr * .5); ctx.lineTo(-10, -12 + cr * .5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-5 + i * 3.5, ty + 8 + (i % 2) * 7, 1.6, 0, 7); ctx.fill(); }
  } else if (lk.shirt === 'albirroja' || lk.shirt === 'luque') {
    const a = lk.shirt === 'luque' ? ['#1f4fbf', '#f2c14e'] : ['#d52b1e', '#fff'];
    for (let i = 0; i < 4; i++) { ctx.fillStyle = a[i % 2]; ctx.fillRect(-6 + i * 3, ty, 3, 20); }
  } else { ctx.fillStyle = lk.shirt; rr(-6, ty, 12, 20, 3); ctx.fill(); }
  if (lk.tie) { ctx.fillStyle = lk.tie; ctx.beginPath(); ctx.moveTo(0, ty + 1); ctx.lineTo(2, ty + 11); ctx.lineTo(0, ty + 14); ctx.lineTo(-2, ty + 11); ctx.fill(); }
  // brazos
  ctx.strokeStyle = lk.skin; ctx.lineWidth = 4; ctx.beginPath();
  const sh = ty + 4;
  if (o.arms === 'fwd') { ctx.moveTo(0, sh); ctx.lineTo(13, sh + 4); ctx.moveTo(0, sh); ctx.lineTo(12, sh + 8); }
  else if (o.arms === 'up') { ctx.moveTo(0, sh); ctx.lineTo(8, sh - 12); ctx.moveTo(0, sh); ctx.lineTo(-6, sh - 12); }
  else if (o.arms === 'carry') { ctx.moveTo(0, sh); ctx.lineTo(9, sh - 10); ctx.moveTo(0, sh); ctx.lineTo(-7, sh - 10); }
  else { ctx.moveTo(0, sh); ctx.lineTo(-sw * 8, sh + 14); ctx.moveTo(0, sh); ctx.lineTo(sw * 8, sh + 14); }
  ctx.stroke();
  if (lk.bags && o.arms !== 'fwd') { ctx.fillStyle = '#fafafa'; rr(sw * 8 - 4, sh + 12, 9, 10, 2); ctx.fill(); ctx.strokeStyle = '#bbb'; ctx.lineWidth = 1; ctx.stroke(); }
  // cabeza
  const hy = ty - 7;
  ctx.fillStyle = lk.skin; ctx.beginPath(); ctx.arc(1, hy, 7, 0, 7); ctx.fill();
  if (lk.helmet) { ctx.fillStyle = lk.helmet; ctx.beginPath(); ctx.arc(1, hy - 1, 8, Math.PI, 0); ctx.lineTo(9, hy + 3); ctx.lineTo(-7, hy + 3); ctx.fill(); ctx.fillStyle = 'rgba(30,30,40,.85)'; ctx.fillRect(2, hy - 3, 7, 4); }
  else {
    ctx.fillStyle = lk.hair; ctx.beginPath(); ctx.arc(1, hy - 1, 7.2, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
    ctx.fillRect(-6, hy - 3, 4, 5);
    if (lk.bun) { ctx.beginPath(); ctx.arc(-6, hy - 6, 4, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#1b1b1b'; ctx.beginPath(); ctx.arc(5, hy - 1, 1.2, 0, 7); ctx.fill();
    if (lk.glasses) { ctx.strokeStyle = '#111'; ctx.lineWidth = 1.2; ctx.strokeRect(3, hy - 3, 5, 4); }
    if (lk.sun) { ctx.fillStyle = '#111'; ctx.fillRect(2, hy - 3, 7, 3); }
    if (lk.bags2) { ctx.fillStyle = 'rgba(80,40,90,.6)'; ctx.fillRect(3, hy + 1, 4, 2); }
    if (lk.mustache) { ctx.fillStyle = '#cfcfcf'; ctx.fillRect(3, hy + 2, 6, 2); }
    if (lk.cap) { ctx.fillStyle = lk.cap; ctx.beginPath(); ctx.arc(1, hy - 2, 7.4, Math.PI, 0); ctx.fill(); ctx.fillRect(5, hy - 3, 7, 2.5); }
    if (lk.hat === 'piri') { ctx.fillStyle = '#e8d08a'; ctx.beginPath(); ctx.ellipse(1, hy - 5, 13, 3, 0, 0, 7); ctx.fill(); ctx.fillRect(-5, hy - 12, 12, 7); ctx.fillStyle = '#5d4037'; ctx.fillRect(-5, hy - 7, 12, 2); }
  }
  if (o.carry) o.carry();
  ctx.restore();
}

/* ---------- paisaje ---------- */
function drawLand(k, x, b, r) {
  ctx.save(); ctx.translate(x, b);
  const label = (t, y, c = 'rgba(0,0,0,.45)') => txt(t, 60, y, 8, c);
  switch (k) {
    case 'edificio': { const h = 120 + r * 90, w = 62 + r * 26; ctx.fillStyle = r < .5 ? '#8a9bb0' : '#9fa8b6'; ctx.fillRect(0, -h, w, h); ctx.fillStyle = 'rgba(220,240,255,.7)'; for (let yy = -h + 8; yy < -12; yy += 14) for (let xx = 6; xx < w - 8; xx += 12) ctx.fillRect(xx, yy, 6, 8); break; }
    case 'shopping': ctx.fillStyle = '#d7dde6'; ctx.fillRect(0, -78, 160, 78); ctx.fillStyle = '#7fb3d9'; ctx.fillRect(8, -62, 144, 30); ctx.fillStyle = '#c62828'; rr(40, -94, 80, 18, 4); ctx.fill(); txt('SHOPPING', 80, -85, 10); break;
    case 'panteon':
      ctx.fillStyle = '#efe6d2'; ctx.fillRect(0, -56, 120, 56); ctx.fillStyle = '#d9cfb8'; for (let i = 0; i < 6; i++) ctx.fillRect(8 + i * 19, -50, 6, 44);
      ctx.fillStyle = '#e4d9c0'; ctx.fillRect(30, -70, 60, 14); ctx.beginPath(); ctx.arc(60, -70, 28, Math.PI, 0); ctx.fill(); ctx.fillRect(56, -110, 8, 14);
      txt('PANTEÓN DE LOS HÉROES', 60, 8, 8, 'rgba(0,0,0,.5)'); break;
    case 'palacio':
      ctx.fillStyle = '#f1ece0'; ctx.fillRect(0, -48, 180, 48); ctx.fillRect(76, -96, 28, 50); ctx.fillRect(82, -112, 16, 16);
      ctx.fillStyle = '#cbbfa7'; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(12 + i * 20, -22, 6, Math.PI, 0); ctx.fill(); }
      ctx.fillStyle = '#d52b1e'; ctx.fillRect(90, -132, 12, 4); ctx.fillStyle = '#fff'; ctx.fillRect(90, -128, 12, 4); ctx.fillStyle = '#0038a8'; ctx.fillRect(90, -124, 12, 4); ctx.fillStyle = '#555'; ctx.fillRect(89, -132, 1.5, 22);
      txt('PALACIO DE LÓPEZ', 90, 8, 8, 'rgba(0,0,0,.5)'); break;
    case 'estadio':
      ctx.fillStyle = '#1f4fbf'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(20, -60); ctx.lineTo(200, -60); ctx.lineTo(220, 0); ctx.fill();
      ctx.fillStyle = '#f2c14e'; ctx.fillRect(16, -46, 188, 8); ctx.fillStyle = '#555'; ctx.fillRect(10, -110, 4, 60); ctx.fillRect(206, -110, 4, 60);
      ctx.fillStyle = '#fff59d'; ctx.fillRect(2, -116, 20, 8); ctx.fillRect(198, -116, 20, 8);
      txt('FELICIANO CÁCERES', 110, -24, 10, '#fff'); break;
    case 'pasarela':
      ctx.fillStyle = '#90a4ae'; ctx.fillRect(0, -64, 240, 10); ctx.fillRect(16, -54, 8, 54); ctx.fillRect(216, -54, 8, 54);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; for (let i = 0; i < 4; i++) { const cx = 50 + i * 46; ctx.beginPath(); ctx.arc(cx, -78, 16, 0, 7); for (let a = 0; a < 8; a++) { ctx.moveTo(cx, -78); ctx.lineTo(cx + Math.cos(a * .785) * 16, -78 + Math.sin(a * .785) * 16); } ctx.stroke(); }
      txt('PASARELA ÑANDUTÍ', 120, -105, 9, 'rgba(0,0,0,.5)'); break;
    case 'catedral':
      ctx.fillStyle = '#cfc7bd'; ctx.fillRect(0, -70, 100, 70); ctx.fillRect(4, -120, 22, 50); ctx.fillRect(74, -120, 22, 50);
      ctx.beginPath(); ctx.moveTo(4, -120); ctx.lineTo(15, -160); ctx.lineTo(26, -120); ctx.moveTo(74, -120); ctx.lineTo(85, -160); ctx.lineTo(96, -120); ctx.moveTo(30, -70); ctx.lineTo(50, -100); ctx.lineTo(70, -70); ctx.fill();
      ctx.fillStyle = '#7e57c2'; ctx.beginPath(); ctx.arc(50, -48, 10, 0, 7); ctx.fill(); txt('CATEDRAL', 50, 8, 8, 'rgba(0,0,0,.5)'); break;
    case 'una': ctx.fillStyle = '#e7e1d1'; ctx.fillRect(0, -64, 150, 64); ctx.fillStyle = '#b0bec5'; for (let i = 0; i < 6; i++) ctx.fillRect(10 + i * 23, -50, 14, 18); ctx.fillStyle = '#0d47a1'; rr(45, -84, 60, 20, 4); ctx.fill(); txt('UNA', 75, -74, 13); break;
    case 'mercado': ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#fb8c00'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(i * 36, -30); ctx.lineTo(i * 36 + 18, -44); ctx.lineTo(i * 36 + 36, -30); ctx.fill(); ctx.fillStyle = '#795548'; ctx.fillRect(i * 36 + 4, -30, 28, 30); }); txt('MERCADO', 90, -54, 10, 'rgba(0,0,0,.55)'); break;
    case 'monte': ctx.fillStyle = '#2e5d32'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(i * 34 + 20, -40 - (i % 3) * 18, 32, 0, 7); ctx.fill(); } break;
    case 'iglesia': ctx.fillStyle = '#f5f5f5'; ctx.fillRect(0, -50, 80, 50); ctx.fillRect(30, -96, 20, 46); ctx.beginPath(); ctx.moveTo(30, -96); ctx.lineTo(40, -114); ctx.lineTo(50, -96); ctx.fill(); ctx.fillStyle = '#b71c1c'; ctx.beginPath(); ctx.moveTo(-4, -50); ctx.lineTo(40, -74); ctx.lineTo(84, -50); ctx.fill(); break;
    case 'casa': ctx.fillStyle = ['#ffcc80', '#a5d6a7', '#90caf9', '#f48fb1'][(r * 4) | 0]; ctx.fillRect(0, -44, 80, 44); ctx.fillStyle = '#8d4a2f'; ctx.beginPath(); ctx.moveTo(-6, -44); ctx.lineTo(40, -70); ctx.lineTo(86, -44); ctx.fill(); break;
    case 'lago': ctx.fillStyle = '#4fa3d9'; ctx.fillRect(-40, -30, 340, 30); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(120, -34); ctx.lineTo(132, -58); ctx.lineTo(132, -34); ctx.fill(); txt('LAGO YPACARAÍ', 150, -16, 9, 'rgba(255,255,255,.85)'); break;
    case 'casona': ctx.fillStyle = '#fafafa'; ctx.fillRect(0, -52, 130, 52); ctx.fillStyle = '#c0572e'; ctx.fillRect(-6, -60, 142, 10); ctx.fillStyle = '#d7ccc8'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(14 + i * 25, -22, 9, Math.PI, 0); ctx.lineTo(23 + i * 25, 0); ctx.lineTo(5 + i * 25, 0); ctx.fill(); } break;
    case 'cerro': ctx.fillStyle = '#4e8b3a'; ctx.beginPath(); ctx.ellipse(110, 0, 130, 90, 0, Math.PI, 0); ctx.fill(); txt('CERRO KÕI', 110, -50, 9, 'rgba(255,255,255,.7)'); break;
    case 'cantera': ctx.fillStyle = '#6a8f4a'; ctx.beginPath(); ctx.ellipse(120, 0, 150, 110, 0, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#9e9e9e'; ctx.beginPath(); ctx.moveTo(90, 0); ctx.lineTo(110, -80); ctx.lineTo(170, -70); ctx.lineTo(180, 0); ctx.fill(); txt('CERRO ÑEMBY', 120, -96, 9, 'rgba(255,255,255,.8)'); break;
    case 'puente':
      ctx.fillStyle = '#eceff1'; ctx.fillRect(0, -70, 320, 8); ctx.strokeStyle = '#eceff1'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(40, 0); ctx.quadraticCurveTo(160, -150, 280, 0); ctx.stroke();
      ctx.lineWidth = 1.5; for (let i = 1; i < 10; i++) { ctx.beginPath(); ctx.moveTo(40 + i * 24, -66); ctx.lineTo(40 + i * 24, -66 - Math.sin(i / 10 * Math.PI) * 6); ctx.stroke(); }
      txt('PUENTE DE LA AMISTAD', 160, -86, 9, 'rgba(255,255,255,.85)'); break;
    case 'galeria': {
      const h = 140 + r * 60; ctx.fillStyle = '#3b2f5c'; ctx.fillRect(0, -h, 90, h); ctx.fillStyle = 'rgba(255,255,255,.15)'; for (let yy = -h + 10; yy < -20; yy += 16) ctx.fillRect(8, yy, 74, 8);
      const n = ['GALERÍA', 'IMPORTADOS', 'ELETRÔNICOS', 'CASA DE CAMBIO', 'PERFUMES'][(r * 5) | 0], c = ['#ff4081', '#00e5ff', '#ffea00', '#76ff03', '#ff9100'][(r * 7 % 5) | 0];
      ctx.shadowColor = c; ctx.shadowBlur = 10; txt(n, 45, -h + 18, 9, c); ctx.shadowBlur = 0; break;
    }
    case 'costanera': ctx.fillStyle = '#29b6f6'; ctx.fillRect(-20, -26, 300, 26); for (let i = 0; i < 3; i++) palm(40 + i * 90, 0, .9); txt('COSTANERA', 130, -10, 9, '#fff'); break;
    case 'playa': ctx.fillStyle = '#ffe0a3'; ctx.fillRect(0, -16, 200, 16); ['#e53935', '#1e88e5', '#fdd835'].forEach((c, i) => { ctx.fillStyle = '#795548'; ctx.fillRect(30 + i * 60, -40, 2, 26); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(31 + i * 60, -40, 16, Math.PI, 0); ctx.fill(); }); break;
    case 'precios': ctx.fillStyle = '#555'; ctx.fillRect(40, -60, 4, 60); ctx.fillRect(120, -60, 4, 60); ctx.fillStyle = '#fff'; rr(10, -110, 150, 52, 6); ctx.fill(); ctx.strokeStyle = '#d52b1e'; ctx.lineWidth = 3; ctx.stroke();
      txt(r < .5 ? 'COCIDO ₲45.000' : 'EMPANADA ₲25.000', 85, -92, 11, '#d52b1e'); txt(r < .5 ? 'precio de temporada 😱' : '¡oferta! 🤑', 85, -73, 9, '#333'); break;
    case 'frontera': {
      const sg = [['FARMÁCIA', '#2e7d32'], ['DESPENSA', '#d52b1e'], ['LOJA', '#1565c0'], ['MBA\'ÉICHAPA', '#6a1b9a'], ['BEM-VINDO', '#f9a825'], ['CAMBIO', '#00838f']];
      for (let i = 0; i < 3; i++) { const s = sg[((r * 6) + i * 2) % 6 | 0]; ctx.fillStyle = ['#ffe0b2', '#dcedc8', '#f8bbd0'][i]; ctx.fillRect(i * 80, -66, 76, 66); ctx.fillStyle = s[1]; ctx.fillRect(i * 80 + 4, -60, 68, 14); txt(s[0], i * 80 + 38, -53, 8); }
      break;
    }
  }
  ctx.restore();
}
function palm(x, b, s = 1) {
  ctx.save(); ctx.translate(x, b); ctx.scale(s, s);
  ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(6, -40, 2, -78); ctx.stroke();
  ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 4; for (let a = 0; a < 6; a++) { ctx.beginPath(); ctx.moveTo(2, -78); ctx.quadraticCurveTo(2 + Math.cos(a) * 20, -96, 2 + Math.cos(a * 1.05 + .3) * 34, -70 + Math.sin(a) * 8); ctx.stroke(); }
  ctx.restore();
}

function drawMid(L, cam) {
  const pr = .6, cw = 150, off = cam * pr, c0 = Math.floor(off / cw) - 1, c1 = c0 + Math.ceil(W / cw) + 2;
  for (let c = c0; c <= c1; c++) {
    const x = c * cw - off, r = hash(c + L.idx * 991), b = GY - 6;
    ctx.save(); ctx.translate(x, b);
    switch (L.C.mid) {
      case 'ciudad': { const h = 60 + r * 70; ctx.fillStyle = ['#b0a296', '#c9b8a6', '#9e9e9e', '#bcaaa4'][(r * 4) | 0]; ctx.fillRect(10, -h, 110, h); ctx.fillStyle = 'rgba(40,50,60,.35)'; for (let yy = -h + 10; yy < -24; yy += 18) for (let xx = 20; xx < 110; xx += 20) ctx.fillRect(xx, yy, 10, 10); ctx.fillStyle = '#5d4037'; ctx.fillRect(56, -22, 18, 22); break; }
      case 'casas': { const col = L.C.blue && r < .5 ? (r < .25 ? '#1f4fbf' : '#f2c14e') : ['#ffcc80', '#a5d6a7', '#90caf9', '#f48fb1', '#fff59d'][(r * 5) | 0]; ctx.fillStyle = col; ctx.fillRect(14, -46, 104, 46); ctx.fillStyle = '#a1502e'; ctx.beginPath(); ctx.moveTo(8, -46); ctx.lineTo(66, -72); ctx.lineTo(124, -46); ctx.fill(); ctx.fillStyle = '#5d4037'; ctx.fillRect(30, -28, 16, 28); ctx.fillStyle = '#bbdefb'; ctx.fillRect(74, -34, 24, 16); break; }
      case 'monte': ctx.fillStyle = r < .5 ? '#33691e' : '#2e5d32'; ctx.fillRect(66, -50, 8, 50); ctx.beginPath(); ctx.arc(70, -70, 34 + r * 10, 0, 7); ctx.arc(46, -56, 22, 0, 7); ctx.arc(94, -58, 24, 0, 7); ctx.fill(); break;
      case 'colonial': ctx.fillStyle = '#fbf6ee'; ctx.fillRect(10, -54, 120, 54); ctx.fillStyle = '#c0572e'; ctx.fillRect(4, -62, 132, 10); ctx.fillStyle = '#8d6e63'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(28 + i * 28, -20, 9, Math.PI, 0); ctx.lineTo(37 + i * 28, 0); ctx.lineTo(19 + i * 28, 0); ctx.fill(); } break;
      case 'neon': { const h = 70 + r * 50; ctx.fillStyle = '#4a3b6b'; ctx.fillRect(10, -h, 125, h); const c = ['#ff4081', '#00e5ff', '#ffea00', '#76ff03'][(r * 4) | 0]; ctx.fillStyle = c; ctx.fillRect(18, -h + 8, 108, 12); ctx.fillStyle = '#d7b98e'; for (let i = 0; i < 4; i++) ctx.fillRect(20 + (i % 2) * 22, -18 - (i >> 1) * 18, 20, 16); txt(['CELULARES', 'TODO $5', 'PERFUMES', 'NOTEBOOKS'][(r * 4) | 0], 72, -h + 14, 8, '#222'); break; }
      case 'costa': palm(70, 0, .8 + r * .3); ctx.fillStyle = '#8d6e63'; ctx.fillRect(100, -12, 34, 4); ctx.fillRect(104, -12, 3, 12); ctx.fillRect(128, -12, 3, 12); break;
      case 'frontera': { ctx.fillStyle = ['#ffe0b2', '#dcedc8', '#f8bbd0', '#b3e5fc'][(r * 4) | 0]; ctx.fillRect(10, -58, 120, 58); const s = ['LOJA', 'DESPENSA', 'FARMÁCIA', 'ROUPAS', 'TERERÉ', 'AÇAÍ'][(r * 6) | 0]; ctx.fillStyle = r < .5 ? '#2e7d32' : '#d52b1e'; ctx.fillRect(18, -52, 104, 14); txt(s, 70, -45, 9); ctx.fillStyle = '#5d4037'; ctx.fillRect(56, -28, 22, 28); break; }
    }
    ctx.restore();
  }
}

function skyCol(L) {
  const n = nightAmt();
  return n > 0 ? [mix(L.C.sky[0], '#0b1030', n), mix(L.C.sky[1], '#2a2350', n)] : L.C.sky;
}
function mix(a, b, t) {
  const p = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)), A = p(a), B = p(b);
  return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')';
}

function drawWorld(L, cam, P) {
  const sk = skyCol(L), g = ctx.createLinearGradient(0, 0, 0, GY);
  g.addColorStop(0, sk[0]); g.addColorStop(1, sk[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, GY);
  // sol o luna
  if (nightAmt() > .4) { ctx.fillStyle = '#fffde7'; ctx.beginPath(); ctx.arc(W - 90, 60, 16, 0, 7); ctx.fill(); }
  else { ctx.fillStyle = L.C.sol || L.C.heat ? '#fff59d' : 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.arc(W - 90, 58, L.C.sol ? 30 : 20, 0, 7); ctx.fill(); }
  // lejos
  const pf = .3, sp = 270, off = cam * pf, k0 = Math.max(0, Math.floor((off - 300) / sp));
  for (let k = k0; k < k0 + Math.ceil(W / sp) + 3; k++) {
    const x = 40 + k * sp - off; drawLand(L.C.land[k % L.C.land.length], x, GY - 10, hash(k + L.idx * 31));
  }
  drawMid(L, cam);
  // piso
  ctx.save(); ctx.translate(-cam, 0);
  const id = L.C.id;
  const side = id === 'cap' ? '#6b8f3a' : id === 'enc' ? '#e9dcc0' : id === 'pjc' ? '#c58a5a' : id === 'cde' ? '#9e9aa8' : '#c9c3b8';
  ctx.fillStyle = side; ctx.fillRect(cam, GY, W, 14);
  ctx.fillStyle = id === 'cap' ? '#3f4447' : '#55565e'; ctx.fillRect(cam, GY + 14, W, H - GY - 14);
  ctx.fillStyle = 'rgba(0,0,0,.18)'; for (let x = Math.floor(cam / 40) * 40; x < cam + W; x += 40) ctx.fillRect(x, GY, 2, 14);
  ctx.fillStyle = id === 'enc' || id === 'pjc' ? '#fff' : '#f2c14e'; for (let x = Math.floor(cam / 90) * 90; x < cam + W; x += 90) ctx.fillRect(x, GY + 40, 46, 4);
  if (id === 'pjc') { ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(cam, GY + 50, W, 18); }
  // zonas
  for (const z of L.zones) {
    if (z.x2 < cam - 50 || z.x1 > cam + W + 50) continue;
    if (z.t === 'cruce') {
      ctx.fillStyle = '#3d3e44'; ctx.fillRect(z.x1, GY, z.x2 - z.x1, 14);
      ctx.fillStyle = '#fff'; for (let x = z.x1 + 6; x < z.x2 - 8; x += 18) ctx.fillRect(x, GY + 2, 10, 10);
      const v = semaforoVerde(z);
      ctx.fillStyle = '#333'; ctx.fillRect(z.x1 - 14, GY - 100, 4, 100); rr(z.x1 - 22, GY - 128, 20, 34, 4); ctx.fill();
      ctx.fillStyle = v ? '#3e3e3e' : '#ff1744'; ctx.beginPath(); ctx.arc(z.x1 - 12, GY - 119, 6, 0, 7); ctx.fill();
      ctx.fillStyle = v ? '#00e676' : '#3e3e3e'; ctx.beginPath(); ctx.arc(z.x1 - 12, GY - 103, 6, 0, 7); ctx.fill();
      drawPerson(z.x2 + 24, GY, LOOKS.zorro, { face: -1, arms: v ? null : 'up' });
      if (!v) txt('¡PIII!', z.x2 + 24, GY - 70, 10, '#fff', 'center', true, '#000');
    }
    if (z.t === 'sombra') {
      const cx = (z.x1 + z.x2) / 2; ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(cx, GY + 4, 48, 7, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#795548'; ctx.fillRect(cx - 2, GY - 92, 4, 92);
      ctx.fillStyle = hash(z.x1) < .5 ? '#e53935' : '#1e88e5'; ctx.beginPath(); ctx.arc(cx, GY - 90, 50, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#fff'; for (let a = 0; a < 3; a++) { ctx.beginPath(); ctx.moveTo(cx, GY - 90); ctx.arc(cx, GY - 90, 50, Math.PI + a * 1.05 + .35, Math.PI + a * 1.05 + .7); ctx.fill(); }
    }
    if (z.t === 'hinchas') {
      for (let x = z.x1; x < z.x2; x += 34) drawPerson(x + 10, GY - 2, LOOKS.hincha, { face: hash(x) < .5 ? 1 : -1, arms: Math.sin(G.t * 4 + x) > .3 ? 'up' : null, scale: .9, alpha: .9 });
      ctx.fillStyle = 'rgba(31,79,191,.85)'; rr(z.x1, GY - 120, 130, 22, 5); ctx.fill(); txt('🤫 ZONA DE HINCHAS: caminá', z.x1 + 65, GY - 109, 9);
    }
  }
  // baches
  for (const gp of L.gaps) {
    if (gp.x2 < cam - 20 || gp.x1 > cam + W + 20) continue;
    ctx.fillStyle = '#1a1310'; ctx.beginPath(); ctx.moveTo(gp.x1 - 4, GY); ctx.lineTo(gp.x1 + 3, H); ctx.lineTo(gp.x2 - 3, H); ctx.lineTo(gp.x2 + 4, GY); ctx.fill();
    ctx.fillStyle = '#2b211b'; ctx.fillRect(gp.x1, GY, gp.x2 - gp.x1, 8);
    if (gp.water) { ctx.fillStyle = 'rgba(110,90,60,.95)'; ctx.fillRect(gp.x1 + 2, GY + 12, gp.x2 - gp.x1 - 4, H); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(gp.x1 + 8 + Math.sin(G ? G.t * 2 : 0) * 4, GY + 16, 18, 2); }
    if (gp.big) { ctx.fillStyle = '#ffeb3b'; ctx.fillRect(gp.x1 - 18, GY - 24, 3, 24); ctx.beginPath(); ctx.moveTo(gp.x1 - 30, GY - 24); ctx.lineTo(gp.x1 - 16, GY - 46); ctx.lineTo(gp.x1 - 2, GY - 24); ctx.fill(); txt('!', gp.x1 - 16, GY - 31, 12, '#000'); }
  }
  // veredas altas y plataformas
  for (const pl of L.plats) {
    if (pl.x + pl.w < cam - 20 || pl.x > cam + W + 20) continue;
    if (pl.solid) { ctx.fillStyle = '#bdb5a8'; ctx.fillRect(pl.x, pl.y, pl.w, GY - pl.y + 2); ctx.fillStyle = '#d8d1c4'; ctx.fillRect(pl.x, pl.y, pl.w, 6); ctx.fillStyle = 'rgba(0,0,0,.12)'; for (let x = pl.x + 20; x < pl.x + pl.w; x += 24) ctx.fillRect(x, pl.y + 6, 2, GY - pl.y - 6); }
    else { ctx.fillStyle = '#8d6e63'; ctx.fillRect(pl.x, pl.y, pl.w, 10); ctx.fillRect(pl.x + 8, pl.y + 10, 5, GY - pl.y - 10); ctx.fillRect(pl.x + pl.w - 13, pl.y + 10, 5, GY - pl.y - 10); ctx.fillStyle = '#a1887f'; ctx.fillRect(pl.x, pl.y, pl.w, 3); }
  }
  // yuyera (checkpoint)
  for (const c of L.cps) if (c.x > cam - 120 && c.x < cam + W + 120) drawYuyera(c.x, c.used);
  // meta
  drawGoal(L);
  // escondites (los que no te tapan)
  for (const h of L.hides) if (h !== P.hidden && h.x + h.w > cam - 20 && h.x < cam + W + 20) drawHide(h, P);
  ctx.restore();
}

function drawYuyera(x, used) {
  ctx.fillStyle = '#6d4c41'; ctx.fillRect(x - 40, GY - 40, 80, 40); ctx.fillStyle = '#4caf50'; for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(x - 34 + i * 11, GY - 42, 7, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#2e7d32'; rr(x - 44, GY - 82, 88, 20, 4); ctx.fill(); txt('🧉 YUYERA', x, GY - 72, 10);
  ctx.fillStyle = '#5d4037'; ctx.fillRect(x - 40, GY - 62, 4, 22); ctx.fillRect(x + 36, GY - 62, 4, 22);
  emo('🧉', x + 26, GY - 52, 18);
  if (!used) txt('PUNTO DE CONTROL', x, GY - 96, 8, '#fff', 'center', true, '#000');
}
function drawGoal(L) {
  const x = L.goal + 40;
  if (L.C.id === 'pjc') {
    ctx.fillStyle = '#fff3e0'; ctx.fillRect(x - 20, GY - 90, 150, 90); ctx.fillStyle = '#b23a1f'; ctx.beginPath(); ctx.moveTo(x - 32, GY - 90); ctx.lineTo(x + 55, GY - 140); ctx.lineTo(x + 142, GY - 90); ctx.fill();
    ctx.fillStyle = '#6d4c41'; ctx.fillRect(x + 40, GY - 52, 30, 52); ctx.fillStyle = '#ffe082'; ctx.fillRect(x, GY - 70, 26, 20); ctx.fillRect(x + 90, GY - 70, 26, 20);
    txt('CASA DE ÑA CHOLA', x + 55, GY - 104, 10, '#fff', 'center', true, '#5d1a0e'); emo('🎄', x - 34, GY - 22, 30); emo('⭐', x + 55, GY - 146, 16);
  } else {
    ctx.fillStyle = '#455a64'; ctx.fillRect(x, GY - 110, 6, 110); ctx.fillStyle = '#0038a8'; rr(x - 50, GY - 140, 110, 34, 6); ctx.fill();
    txt('🚌 PARADA', x + 5, GY - 130, 10); txt('próxima ciudad →', x + 5, GY - 116, 8);
    ctx.fillStyle = '#eceff1'; ctx.fillRect(x + 10, GY - 64, 70, 6); ctx.fillStyle = '#90a4ae'; ctx.fillRect(x + 76, GY - 64, 4, 64);
  }
}
function drawHide(h, P) {
  const x = h.x, y = GY, near = !P.hidden && P.ground && P.x > h.x - 10 && P.x < h.x + h.w + 10 && (!h.small || G.C.small);
  ctx.save();
  switch (h.k) {
    case 'parada':
      ctx.fillStyle = '#78909c'; ctx.fillRect(x + 4, y - 74, 5, 74); ctx.fillRect(x + h.w - 9, y - 74, 5, 74);
      ctx.fillStyle = '#8d6e63'; ctx.fillRect(x - 4, y - 78, h.w + 8, 7); ctx.fillStyle = 'rgba(180,220,255,.55)'; ctx.fillRect(x + 9, y - 70, h.w - 18, 46);
      ctx.fillStyle = '#5d4037'; ctx.fillRect(x + 12, y - 22, h.w - 24, 5); txt('🚌', x + h.w / 2, y - 62, 12); break;
    case 'basurero': ctx.fillStyle = '#2e7d32'; rr(x, y - h.h, h.w, h.h, 4); ctx.fill(); ctx.fillStyle = '#1b5e20'; ctx.fillRect(x - 3, y - h.h - 4, h.w + 6, 6); txt('♻', x + h.w / 2, y - 22, 14, '#c8e6c9'); break;
    case 'despensa':
      ctx.fillStyle = '#ffe0b2'; ctx.fillRect(x, y - h.h, h.w, h.h); ctx.fillStyle = '#d52b1e'; ctx.fillRect(x - 4, y - h.h - 4, h.w + 8, 16); txt('DESPENSA', x + h.w / 2, y - h.h + 4, 9);
      ctx.fillStyle = '#3e2723'; ctx.fillRect(x + 30, y - 52, 32, 52); ctx.fillStyle = '#90caf9'; ctx.fillRect(x + 6, y - 50, 18, 16); ctx.fillRect(x + 68, y - 50, 18, 16); break;
    case 'rueda': ctx.strokeStyle = '#212121'; ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(x + 30, y - 30, 23, 0, 7); ctx.stroke(); ctx.fillStyle = '#9e9e9e'; ctx.beginPath(); ctx.arc(x + 30, y - 30, 10, 0, 7); ctx.fill(); break;
    case 'blindado': ctx.fillStyle = '#90a4ae'; ctx.fillRect(x, y - h.h, h.w, h.h); ctx.fillStyle = '#607d8b'; for (let i = 0; i < 4; i++) ctx.fillRect(x + 4 + i * 17, y - h.h + 4, 3, 3); ctx.fillStyle = '#2e7d32'; ctx.fillRect(x, y - h.h - 14, h.w, 14); txt('TERERÉ BLINDADO', x + h.w / 2, y - h.h - 7, 7); emo('🧉', x + h.w / 2, y - 28, 18); break;
    case 'auto': ctx.fillStyle = '#c62828'; rr(x, y - 34, h.w, 24, 6); ctx.fill(); rr(x + 22, y - 52, 60, 22, 8); ctx.fill(); ctx.fillStyle = '#bbdefb'; ctx.fillRect(x + 28, y - 48, 22, 14); ctx.fillRect(x + 54, y - 48, 22, 14); ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.arc(x + 22, y - 9, 9, 0, 7); ctx.arc(x + h.w - 22, y - 9, 9, 0, 7); ctx.fill(); break;
    case 'caja': ctx.fillStyle = '#c8a26b'; ctx.fillRect(x, y - h.h, h.w, h.h); ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 1.5; ctx.strokeRect(x, y - h.h, h.w, h.h); ctx.beginPath(); ctx.moveTo(x, y - h.h + 8); ctx.lineTo(x + h.w, y - h.h + 8); ctx.stroke(); txt('FRÁGIL', x + h.w / 2, y - 14, 7, '#5d4037'); break;
  }
  if (near) txt('⤵ ESCONDERSE', x + h.w / 2, y - h.h - 16, 9, '#fff', 'center', true, '#000');
  else if (h.small && !G.C.small && P.x > h.x - 40 && P.x < h.x + h.w + 40) txt('🧒 solo el niño', x + h.w / 2, y - h.h - 12, 8, '#fff', 'center', true, '#000');
  ctx.restore();
}

function drawItem(it) {
  const bob = Math.sin(G.t * 4 + it.x) * 3, x = it.x, y = it.y + bob;
  switch (it.t) {
    case 'coin': ctx.fillStyle = '#c9a227'; ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fill(); ctx.fillStyle = '#f2d36b'; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill(); txt('1000', x, y + .5, 5.5, '#7a5b00'); break;
    case 'chipa': ctx.strokeStyle = '#d9a441'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, y, 8, 0, 7); ctx.stroke(); ctx.strokeStyle = '#f1cf7a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x - 1, y - 1, 8, 3.6, 5.4); ctx.stroke(); break;
    case 'emp': emo('🥟', x, y, 22); if (it.price) { ctx.fillStyle = '#6d4c41'; ctx.fillRect(x - 26, it.y + 10, 52, 12); txt('₲' + fmt(price(it.price)), x, it.y + 16, 8); } break;
    case 'asado': emo('🍖', x, y, 22); break;
    case 'pulp': emo('🥤', x, y, 22); break;
    case 'cerveza': emo('🍺', x, y, 22); break;
    case 'tere': ctx.fillStyle = '#2e7d32'; rr(x - 18, it.y - 2, 36, 26, 4); ctx.fill(); txt('TERERÉ', x, it.y + 16, 7); emo('🧉', x, y - 4, 20); break;
    case 'kure': glow(x, y, '#90caf9'); emo('🐷', x, y, 24); break;
    case 'electronico': glow(x, y, '#ea80fc'); emo('🔋', x, y, 24); break;
    case 'frutilla': glow(x, y, '#ff8a80'); emo('🍓', x, y, 28); break;
    case 'encargo': glow(x, y, '#ffe082'); emo(ENCARGO[it.k].e, x, y, 28); txt('🎁 ENCARGO', x, y - 26, 8, '#fff', 'center', true, '#000'); break;
  }
}
function glow(x, y, c) { const g = ctx.createRadialGradient(x, y, 2, x, y, 26); g.addColorStop(0, c); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 26, 0, 7); ctx.fill(); }

function drawMoto(x, y, riders, col = '#263238', face = -1, ph = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(face, 1);
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-20, -10, 10, 0, 7); ctx.arc(22, -10, 10, 0, 7); ctx.fill();
  ctx.fillStyle = '#9e9e9e'; ctx.beginPath(); ctx.arc(-20, -10, 4, 0, 7); ctx.arc(22, -10, 4, 0, 7); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-24, -16); ctx.lineTo(10, -16); ctx.lineTo(22, -28); ctx.lineTo(26, -24); ctx.lineTo(18, -12); ctx.lineTo(-18, -12); ctx.fill();
  ctx.fillStyle = '#111'; ctx.fillRect(-14, -22, 22, 6);
  riders.forEach((lk, i) => drawPerson(-2 - i * 14, -16, lk, { air: true, arms: i === 0 ? 'fwd' : null, scale: .95 }));
  ctx.restore();
}

function drawEnt(e) {
  const f = e.face || -1, mv = Math.abs(e.vx) > 5, a = e.ko > 0 ? Math.max(0, e.ko / 1.5) : 1;
  ctx.save(); if (a < 1) ctx.globalAlpha = a;
  switch (e.t) {
    case 'limpia': drawPerson(e.x, e.y, LOOKS.limpia, { face: f, moving: mv, ph: e.ph * 2, arms: 'fwd', carry: () => { ctx.strokeStyle = '#555'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(12, -30); ctx.lineTo(20, -40); ctx.stroke(); ctx.fillStyle = '#212121'; ctx.fillRect(15, -46, 12, 4); } }); break;
    case 'carre':
      drawPerson(e.x + 22, e.y, LOOKS.carre, { face: -1, moving: true, ph: e.ph * 3, arms: 'fwd' });
      ctx.fillStyle = '#8d6e63'; ctx.fillRect(e.x - 30, e.y - 34, 42, 22); ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.arc(e.x - 10, e.y - 7, 7, 0, 7); ctx.fill();
      ['#ff7043', '#ffca28', '#66bb6a'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(e.x - 22 + i * 12, e.y - 38, 6, 0, 7); ctx.fill(); }); break;
    case 'vend': case 'iphone':
      drawPerson(e.x, e.y, LOOKS.vend, { face: -1, arms: 'fwd', ph: e.ph });
      ctx.fillStyle = '#fff'; rr(e.x - 34, e.y - 66, 54, 18, 3); ctx.fill(); ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.stroke();
      txt(e.t === 'iphone' ? 'iPhone $50' : '🧦 3x10.000', e.x - 7, e.y - 57, 8, '#d52b1e');
      if (e.t === 'iphone') emo('📱', e.x - 14, e.y - 30, 12); break;
    case 'zombi': drawPerson(e.x, e.y, LOOKS.zombi, { face: 1, moving: true, ph: e.ph * .8, arms: 'fwd' }); txt('😵', e.x + 4, e.y - 62, 10); break;
    case 'vaca': {
      const up = Math.sin(e.ph * .3) > .4;
      ctx.fillStyle = '#fafafa'; ctx.beginPath(); ctx.ellipse(e.x, e.y - 24, 32, 15, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.ellipse(e.x - 8, e.y - 28, 9, 6, .4, 0, 7); ctx.ellipse(e.x + 14, e.y - 20, 7, 5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#eee'; for (const lx of [-22, -12, 14, 24]) ctx.fillRect(e.x + lx, e.y - 12, 5, 12);
      ctx.fillStyle = '#fafafa'; ctx.save(); ctx.translate(e.x - 30, e.y - (up ? 34 : 18)); ctx.rotate(up ? -.3 : .5); ctx.beginPath(); ctx.ellipse(-8, 0, 11, 8, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#f8bbd0'; ctx.beginPath(); ctx.ellipse(-16, 3, 5, 4, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-9, -3, 1.6, 0, 7); ctx.fill(); ctx.restore();
      if (!up) { ctx.fillStyle = '#7cb342'; ctx.fillRect(e.x - 50, e.y - 6, 8, 6); }
      break;
    }
    case 'arbol': {
      const n = nightAmt();
      ctx.fillStyle = '#4e342e'; ctx.fillRect(e.x - 6, e.y - 110, 12, 110);
      ctx.fillStyle = n > .3 ? '#16301a' : '#2e5d32'; ctx.beginPath(); ctx.arc(e.x, e.y - 130, 42, 0, 7); ctx.arc(e.x - 30, e.y - 110, 26, 0, 7); ctx.arc(e.x + 30, e.y - 112, 28, 0, 7); ctx.fill();
      if (n > .3) { ctx.fillStyle = '#ffeb3b'; ctx.beginPath(); ctx.arc(e.x - 8, e.y - 124, 2.5, 0, 7); ctx.arc(e.x + 2, e.y - 124, 2.5, 0, 7); ctx.fill(); }
      break;
    }
    case 'rama': ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(e.x - 9, e.y - 4); ctx.lineTo(e.x + 9, e.y + 2); ctx.moveTo(e.x, e.y - 1); ctx.lineTo(e.x + 4, e.y - 8); ctx.stroke(); break;
    case 'cantaros': if (!e.broken) { [[0, 0, 13], [-12, -22, 10], [12, -22, 10], [0, -40, 9]].forEach(([dx, dy, r]) => { ctx.fillStyle = '#b5651d'; ctx.beginPath(); ctx.ellipse(e.x + dx, e.y - 12 + dy, r, r * .95, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#8d4a12'; ctx.fillRect(e.x + dx - 4, e.y - 12 + dy - r - 3, 8, 4); }); }
      else { ctx.fillStyle = '#8d4a12'; for (let i = 0; i < 6; i++) ctx.fillRect(e.x - 20 + i * 8, e.y - 4 - (i % 2) * 3, 6, 4); }
      txt('🏺 frágil', e.x, e.y - 66, 8, '#fff', 'center', true, '#000'); break;
    case 'artesano': drawPerson(e.x, e.y, LOOKS.artesano, { face: e.face || 1, moving: true, ph: e.ph * 2, arms: 'up', carry: () => { ctx.strokeStyle = '#a1887f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(8, -56); ctx.lineTo(16, -80); ctx.stroke(); ctx.fillStyle = '#ffd54f'; ctx.fillRect(10, -90, 14, 12); } }); break;
    case 'pasero':
      drawPerson(e.x, e.y, LOOKS.pasero, { face: -1, moving: mv, ph: e.ph * 2, arms: 'carry' });
      for (let i = 0; i < 3; i++) { ctx.fillStyle = i % 2 ? '#d7b98e' : '#c8a26b'; ctx.fillRect(e.x - 18, e.y - 52 - i * 16 - 16, 34, 16); ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 1; ctx.strokeRect(e.x - 18, e.y - 68 - i * 16, 34, 16); txt(i === 1 ? 'TV 65"' : '📦', e.x - 1, e.y - 60 - i * 16, 7, '#5d4037'); }
      break;
    case 'turista': drawPerson(e.x, e.y - 6, LOOKS.turista, { face: -1, arms: 'fwd', carry: () => emo('📱', 14, -30, 9) }); ctx.fillStyle = '#ff4081'; ctx.fillRect(e.x - 10, e.y - 6, 20, 3); ctx.fillStyle = '#111'; [-7, 0, 7].forEach(d => { ctx.beginPath(); ctx.arc(e.x + d, e.y - 2, 2.5, 0, 7); ctx.fill(); }); break;
    case 'moto': drawMoto(e.x, e.y, [LOOKS.chorro, LOOKS.chorro2]); if (!e.ko) emo('🔪', e.x + 24, e.y - 50, 14); ctx.fillStyle = 'rgba(200,200,200,.5)'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(e.x + 40 + i * 14, e.y - 12 + Math.sin(G.t * 20 + i) * 3, 6 + i * 2, 0, 7); ctx.fill(); } break;
    case 'mototaxi': drawMoto(e.x, e.y, [LOOKS.carre, LOOKS.turista], '#ffb300'); txt('MOTOTAXI', e.x, e.y - 52, 8, '#fff', 'center', true, '#000'); break;
    case 'camioneta': drawTruck(e.x, e.y, '#212121', true); break;
  }
  ctx.restore();
}
function drawTruck(x, y, col, pickup, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = col; rr(-55, -48, 110, 34, 6); ctx.fill(); rr(-55, -76, 52, 30, 8); ctx.fill();
  ctx.fillStyle = '#90caf9'; ctx.fillRect(-48, -70, 40, 18);
  if (!pickup) { ctx.fillStyle = '#9e9e9e'; ctx.beginPath(); ctx.moveTo(0, -48); ctx.lineTo(8, -80); ctx.lineTo(55, -80); ctx.lineTo(55, -48); ctx.fill(); ctx.fillStyle = '#795548'; ctx.beginPath(); ctx.arc(20, -82, 10, 0, 7); ctx.arc(38, -84, 12, 0, 7); ctx.fill(); }
  else { ctx.fillStyle = '#ffeb3b'; ctx.fillRect(-60, -30, 6, 6); txt('♪♫', 30, -90 + Math.sin(G.t * 10) * 4, 16, '#ffeb3b', 'center', true, '#000'); }
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-34, -12, 13, 0, 7); ctx.arc(34, -12, 13, 0, 7); ctx.fill();
  ctx.fillStyle = '#bdbdbd'; ctx.beginPath(); ctx.arc(-34, -12, 5, 0, 7); ctx.arc(34, -12, 5, 0, 7); ctx.fill();
  ctx.restore();
}

function drawBoss(L) {
  const B = G.boss; if (!B.on) return;
  const x = B.x, y = GY, k = L.C.boss.k, t = G.t;
  ctx.save();
  switch (k) {
    case 'ola': {
      const g = ctx.createLinearGradient(x - 300, 0, x, 0); g.addColorStop(0, 'rgba(70,110,140,.9)'); g.addColorStop(1, 'rgba(120,170,200,.95)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 600, H); ctx.lineTo(x - 600, GY - 90);
      for (let i = 0; i <= 12; i++) ctx.lineTo(x - 600 + i * 50, GY - 90 - Math.sin(t * 6 + i) * 12 - (i > 9 ? (i - 9) * 10 : 0));
      ctx.lineTo(x + 6, GY - 40); ctx.lineTo(x, H); ctx.fill();
      ctx.fillStyle = '#fff'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(x - 30 + Math.sin(t * 8 + i) * 6, GY - 120 + i * 18, 8, 0, 7); ctx.fill(); }
      emo('🛋️', x - 120, GY - 110 + Math.sin(t * 3) * 10, 22); emo('🪣', x - 220, GY - 100, 18); break;
    }
    case 'motojefe': drawMoto(x - 40, y, [LOOKS.chorro, LOOKS.chorro2], '#b71c1c', 1); txt('JEFE', x - 40, y - 76, 10, '#ffeb3b', 'center', true, '#000'); emo('🔪', x - 6, y - 52, 16); break;
    case 'bache':
      ctx.fillStyle = '#120c08'; ctx.beginPath(); ctx.moveTo(x - 700, GY); for (let i = 0; i <= 10; i++) ctx.lineTo(x - 700 + i * 70, GY + (i % 2 ? 6 : -2)); ctx.lineTo(x, GY - 4); ctx.lineTo(x + 10, GY + 10); ctx.lineTo(x - 4, H); ctx.lineTo(x - 700, H); ctx.fill();
      for (let i = 0; i < 5; i++) { ctx.fillStyle = '#55565e'; ctx.fillRect(x - 30 - i * 30, GY - 20 - Math.abs(Math.sin(t * 5 + i)) * 40, 10, 8); }
      txt('EL BACHE MADRE', x - 120, GY + 30, 12, '#ffeb3b'); break;
    case 'pombero':
      ctx.fillStyle = '#1b1b1b'; ctx.beginPath(); ctx.ellipse(x - 20, y - 28, 22, 30, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#c9a75a'; ctx.beginPath(); ctx.ellipse(x - 20, y - 58, 28, 6, 0, 0, 7); ctx.fill(); ctx.fillRect(x - 32, y - 70, 24, 12);
      ctx.fillStyle = '#ffeb3b'; ctx.beginPath(); ctx.arc(x - 14, y - 42, 3, 0, 7); ctx.arc(x - 4, y - 42, 3, 0, 7); ctx.fill();
      ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - 4, y - 30); ctx.lineTo(x + 10, y - 40 + Math.sin(t * 8) * 6); ctx.stroke(); break;
    case 'artesanos': for (let i = 0; i < 3; i++) drawPerson(x - 10 - i * 36, y, LOOKS.artesano, { face: 1, moving: true, ph: t * 12 + i, arms: 'up', carry: () => { ctx.strokeStyle = '#a1887f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(8, -56); ctx.lineTo(16, -80); ctx.stroke(); ctx.fillStyle = '#ffd54f'; ctx.fillRect(10, -90, 14, 12); } }); break;
    case 'camion': drawTruck(x - 56, y, '#f57c00', false, 1.15); ctx.fillStyle = 'rgba(160,130,90,.45)'; ctx.beginPath(); ctx.arc(x - 150, y - 40, 40, 0, 7); ctx.fill(); break;
    case 'cajas':
      for (let i = 0; i < 7; i++) { ctx.fillStyle = i % 2 ? '#d7b98e' : '#c8a26b'; ctx.fillRect(x - 60 + Math.sin(t * 4 + i) * 3, y - 40 - i * 26, 56, 26); txt(['TV', 'PS', '📦', 'TV', '🖥️', 'TV', '📦'][i], x - 32, y - 27 - i * 26, 9, '#5d4037'); }
      drawPerson(x - 32, y, LOOKS.pasero, { face: 1, moving: true, ph: t * 10, arms: 'carry' }); break;
    case 'zorro': drawPerson(x - 12, y, LOOKS.zorro, { face: 1, moving: true, ph: t * 14, arms: 'fwd', scale: 1.3 }); txt('¡PIIIII!', x, y - 80, 11, '#fff', 'center', true, '#000'); emo('📝', x + 10, y - 40, 14); break;
    case 'camioneta': drawTruck(x - 60, y, '#263238', true, 1.15); txt('23:59', x - 60, y - 120, 14, '#ff5252', 'center', true, '#000'); break;
  }
  ctx.restore();
  if (B.x < G.camX + 8) { const d = Math.round((G.p.x - B.x) / 10); txt('◀ ' + L.C.boss.n + ' a ' + d + ' m', 8, 96, 11, '#ffeb3b', 'left', true, '#000'); }
}

function drawPlayer() {
  const P = G.p, lk = G.lk;
  if (P.invul > 0 && !P.hidden && Math.floor(G.t * 16) % 2) return;
  ctx.save();
  if (P.frut > 0) { ctx.shadowColor = '#ff1744'; ctx.shadowBlur = 16; }
  if (P.shield > 0) { ctx.strokeStyle = G.L.C.id === 'cde' ? 'rgba(234,128,252,.8)' : 'rgba(144,202,249,.85)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(P.x, P.y - P.h / 2, 22, P.h / 2 + 10, 0, 0, 7); ctx.stroke(); }
  drawPerson(P.x, P.y, lk, { face: P.face, moving: Math.abs(P.vx) > 20 && P.ground, ph: P.ph, air: !P.ground, crouch: P.crouch || !!P.hidden, alpha: P.hidden ? .55 : 1 });
  ctx.restore();
  if (P.en <= 0 && !P.hidden) txt('💦', P.x + 12, P.y - P.h - 6, 12);
  if (P.dashT > 0) { ctx.fillStyle = 'rgba(190,225,255,.5)'; for (let i = 1; i < 4; i++) ctx.fillRect(P.x - P.face * i * 14 - 6, P.y - 40 + i * 6, 12, 3); }
}

function drawOverlays(L) {
  // agua del raudal
  if (G.water > 0) {
    const top = GY - 20 * G.water;
    ctx.fillStyle = 'rgba(110,95,70,.78)'; ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, top + Math.sin(G.t * 8 + x * .05) * 3);
    ctx.lineTo(W, H); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 8; i++) ctx.fillRect(((i * 97 - G.t * 260) % W + W) % W, top + 4, 22, 2);
  }
  if (G.rain > 0) { ctx.strokeStyle = 'rgba(200,220,255,' + (.5 * G.rain) + ')'; ctx.lineWidth = 1.2; ctx.beginPath(); for (let i = 0; i < 70; i++) { const x = (i * 53 + G.t * 90) % W, y = (i * 97 + G.t * 620) % H; ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 12); } ctx.stroke(); ctx.fillStyle = 'rgba(40,60,90,' + .25 * G.rain + ')'; ctx.fillRect(0, 0, W, H); }
  const n = nightAmt();
  if (n > 0) {
    const P = G.p, px = P.x - G.camX, g = ctx.createRadialGradient(px, P.y - 30, 40, px, P.y - 30, 280);
    g.addColorStop(0, 'rgba(5,8,30,0)'); g.addColorStop(1, 'rgba(5,8,30,' + n + ')'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (L.C.heat || L.C.sol) { ctx.fillStyle = L.C.sol ? 'rgba(255,240,150,.12)' : 'rgba(255,140,40,.1)'; ctx.fillRect(0, 0, W, H); }
  if (G.fog > 0) { const a = Math.min(.85, G.fog / 4 * 1.2); ctx.fillStyle = 'rgba(170,140,100,' + a + ')'; ctx.fillRect(0, 0, W, H); for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(190,160,120,' + a * .6 + ')'; ctx.beginPath(); ctx.arc((i * 140 + G.t * 40) % (W + 100) - 50, 180 + Math.sin(i) * 60, 70, 0, 7); ctx.fill(); } }
  if (G.ev.some(e => e.k === 'balacera' && e.t < 3.6)) { const a = .25 + Math.sin(G.t * 20) * .15; ctx.strokeStyle = 'rgba(255,0,0,' + a + ')'; ctx.lineWidth = 16; ctx.strokeRect(0, 0, W, H); }
  if (G.invert > 0) { ctx.strokeStyle = 'rgba(46,125,50,.5)'; ctx.lineWidth = 8; ctx.setLineDash([16, 10]); ctx.strokeRect(4, 4, W - 8, H - 8); ctx.setLineDash([]); txt('🔄 CONTROLES AL REVÉS ' + G.invert.toFixed(1), W / 2, H - 18, 11, '#fff', 'center', true, '#000'); }
}

function bar(x, y, w, h, v, col, bg = 'rgba(0,0,0,.45)') { ctx.fillStyle = bg; rr(x, y, w, h, h / 2); ctx.fill(); ctx.fillStyle = col; if (v > 0) { rr(x, y, Math.max(h, w * v), h, h / 2); ctx.fill(); } }
function drawHUD() {
  const P = G.p, C = G.C, L = G.L;
  ctx.fillStyle = 'rgba(0,0,0,.35)'; rr(6, 6, 196, 56, 10); ctx.fill();
  // chipas = vidas
  for (let i = 0; i < Math.max(P.lives, C.lives); i++) {
    const x = 20 + i * 20, y = 20; ctx.lineWidth = 4.5; ctx.strokeStyle = i < P.lives ? '#e0a83c' : 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.stroke();
  }
  txt('⚡', 16, 42, 11);
  const ev = P.en / C.energy, fl = P.en <= 0 && Math.floor(G.t * 6) % 2;
  bar(26, 37, 116 * C.energy / 100, 10, ev, fl ? '#ff1744' : ev < .3 ? '#ff7043' : '#76ff03');
  if (L.C.heat || L.C.sol) txt('🔥', 150, 42, 11);
  txt('₲ ' + fmt(P.coins), 196, 20, 12, '#ffe082', 'right');
  // reloj
  const m = Math.floor(G.clock), hh = Math.floor(m / 60) % 24, mm = m % 60;
  ctx.fillStyle = 'rgba(0,0,0,.35)'; rr(W / 2 - 60, 6, 120, 34, 10); ctx.fill();
  txt('🕗 ' + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'), W / 2, 17, 12, m >= 24 * 60 ? '#ff5252' : '#fff');
  txt(L.C.name, W / 2, 31, 9, '#cfd8dc');
  bar(W / 2 - 50, 42, 100, 4, P.x / L.goal, '#f2c14e');
  // estados a la derecha
  let y = 54; const st = (t) => { txt(t, W - 10, y, 10, '#fff', 'right', true, '#000'); y += 15; };
  if (P.food.length) st((P.food.map(f => f === 'emp' ? '🥟' : '🍖').join('')) + ' mochila');
  if (P.dash) st('💨 dash x' + P.dash);
  if (P.shield > 0) st('🛡️ escudo ' + P.shield.toFixed(0) + 's');
  if (P.frut > 0) st('🍓 modo azúcar ' + P.frut.toFixed(0) + 's');
  if (P.boost > 0) st('🧉 chimarrão ' + P.boost.toFixed(0) + 's');
  if (L.C.encargo) st((G.encargo ? '✅ ' : '⬜ ') + ENCARGO[L.C.encargo].e + ' encargo');
  if (P.hidden) txt('🤫 ESCONDIDO — tocá ⤵ o movete para salir', W / 2, H - 40, 11, '#fff', 'center', true, '#000');
  // mensajes
  if (G.msg && G.t - G.msg.t0 < G.msg.d) { const a = Math.min(1, (G.msg.d - (G.t - G.msg.t0)) * 3); ctx.globalAlpha = a; ctx.font = '800 12px system-ui'; const w = ctx.measureText(G.msg.t).width + 24; ctx.fillStyle = 'rgba(0,0,0,.6)'; rr(W / 2 - w / 2, 66, w, 24, 12); ctx.fill(); txt(G.msg.t, W / 2, 78, 12); ctx.globalAlpha = 1; }
  if (G.banner && G.t - G.banner.t0 < G.banner.d) { ctx.font = '900 15px system-ui'; const w = Math.min(W - 20, ctx.measureText(G.banner.t).width + 30); ctx.fillStyle = G.banner.col; rr(W / 2 - w / 2, 108, w, 34, 10); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); txt(G.banner.t, W / 2, 125, 15); }
}

function render() {
  ctx.setTransform(KS, 0, 0, KS, 0, 0);
  if (!G) { drawMenuBg(); return; }
  const L = G.L, P = G.p;
  let sx = 0, sy = 0; if (G.shake > 0) { sx = (Math.random() - .5) * 8; sy = (Math.random() - .5) * 8; }
  ctx.save(); ctx.translate(sx, sy);
  const cam = Math.round(G.camX);
  drawWorld(L, cam, P);
  ctx.save(); ctx.translate(-cam, 0);
  for (const it of L.items) if (!it.got && it.x > cam - 40 && it.x < cam + W + 40) drawItem(it);
  for (const e of L.ents) if (!e.dead && e.x > cam - 200 && e.x < cam + W + 200) drawEnt(e);
  drawPlayer();
  if (P.hidden) drawHide(P.hidden, P);
  for (const s of G.shots) { ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.r); ctx.fillStyle = '#ff4081'; rr(-8, -3, 16, 6, 3); ctx.fill(); ctx.restore(); }
  drawBoss(L);
  for (const p of G.parts) { ctx.globalAlpha = clamp(p.life, 0, 1); if (p.t) txt(p.t, p.x, p.y, p.t.length < 3 ? 22 : 11, p.col, 'center', true, '#000'); else { ctx.fillStyle = p.col; ctx.fillRect(p.x, p.y, 4, 4); } ctx.globalAlpha = 1; }
  ctx.restore();
  drawOverlays(L);
  ctx.restore();
  drawHUD();
  if (G.state === 'pause') { ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(0, 0, W, H); }
}

let menuT = 0;
function drawMenuBg() {
  menuT += 1 / 60;
  const L = menuL || (menuL = genLevel(0));
  const cam = (menuT * 60) % (L.len - W - 400);
  const fake = { x: -999, y: GY, hidden: null, ground: true };
  const keep = G; G = { t: menuT, C: CHARS.trabajador, p: fake, L, ev: [], boss: {} };
  drawWorld(L, cam, fake);
  ctx.save(); ctx.translate(-cam, 0);
  for (const e of L.ents) if (e.x > cam - 100 && e.x < cam + W + 100) drawEnt(e);
  ctx.restore();
  const lk = LOOKS[S.char || 'trabajador'];
  drawPerson(W * .33, GY, lk, { face: 1, moving: true, ph: menuT * 12 });
  G = keep;
  ctx.fillStyle = 'rgba(10,5,25,.25)'; ctx.fillRect(0, 0, W, H);
}
let menuL = null;

/* ====================== BUCLE ====================== */
let last = performance.now();
function loop(now) {
  const dt = Math.min(.033, (now - last) / 1000); last = now;
  if (G && G.state === 'play') update(dt);
  else for (const k in PR) PR[k] = 0;
  render();
  syncCtl();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* ====================== CONTROLES ====================== */
const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ShiftLeft: 'run', ShiftRight: 'run', KeyK: 'run',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', ArrowDown: 'down', KeyS: 'down', KeyJ: 'dash', KeyE: 'eat', KeyF: 'throw' };
function press(k, on) {
  if (k in K) { if (on && !K[k] && (k === 'jump' || k === 'down')) PR[k] = 1; K[k] = on ? 1 : 0; }
  else if (on) PR[k] = 1;
}
addEventListener('keydown', e => {
  if (e.code === 'Escape' || e.code === 'KeyP') { togglePause(); return; }
  const k = KEYMAP[e.code]; if (!k) return;
  e.preventDefault(); if (!e.repeat) press(k, true); else if (k in K) K[k] = 1;
});
addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k && k in K) K[k] = 0; });
document.querySelectorAll('#ctl .b').forEach(b => {
  const k = b.dataset.k, ids = new Set();
  const down = e => { e.preventDefault(); ac(); ids.add(e.pointerId); try { b.setPointerCapture(e.pointerId); } catch (_) {} b.classList.add('on'); press(k, true); };
  const up = e => { ids.delete(e.pointerId); if (!ids.size) { b.classList.remove('on'); if (k in K) K[k] = 0; } };
  b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
  b.addEventListener('contextmenu', e => e.preventDefault());
});
function setCtl(on) {
  $('#ctl').classList.toggle('on', on && isTouch); $('#pausa').classList.toggle('on', on);
  document.body.classList.toggle('jugando', on);
  if (!on) for (const k in K) K[k] = 0;
}
function syncCtl() {
  if (!G || !G.p || !G.C) return;
  const P = G.p;
  $('#bThrow').classList.toggle('hide', !G.C.chancla);
  $('#nEat').textContent = P.food.length; $('#bEat').classList.toggle('off', !P.food.length);
  $('#nDash').textContent = P.dash; $('#bDash').classList.toggle('off', !P.dash);
}
$('#pausa').onclick = togglePause;
function togglePause() {
  if (!G) return;
  if (G.state === 'play') { G.state = 'pause'; setCtl(false); $('#pausa').classList.add('on'); showPause(); }
  else if (G.state === 'pause') { G.state = 'play'; showScreen(null); setCtl(true); }
}
document.addEventListener('visibilitychange', () => { if (document.hidden && G && G.state === 'play') togglePause(); });

/* ====================== PANTALLAS ====================== */
function showScreen(html) {
  const s = $('#scr');
  if (html == null) { s.classList.remove('on'); s.innerHTML = ''; return; }
  s.innerHTML = '<div class="box">' + html + '</div>'; s.classList.add('on'); s.scrollTop = 0;
}
function goFull() {
  if (!isTouch) return;
  try { const d = document.documentElement; (d.requestFullscreen || d.webkitRequestFullscreen).call(d).then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {}); } catch (e) {}
}

function showTitle() {
  G = null; setCtl(false); speechSynthesis && speechSynthesis.cancel();
  showScreen(`
    <div style="text-align:center">
      <div style="font-size:13px;font-weight:800;color:#d52b1e;letter-spacing:2px">SOBREVIVENCIA NACIONAL</div>
      <h1>Odisea <span>Paraguaya</span></h1>
      <p class="sub">Es 24 de diciembre. Estás en el centro de Asunción, te queda 12% de batería y la abuela te espera en Pedro Juan para la Nochebuena. Cruzá 9 ciudades corriendo, saltando baches y escondiéndote de motochorros.</p>
    </div>
    <button class="btn r" onclick="showChars()">▶ Jugar</button>
    <div class="flex"><button class="btn" onclick="showHelp()">📖 Cómo se juega</button><button class="btn gr" onclick="toggleSound()">${S.sound ? '🔊 Sonido: sí' : '🔇 Sonido: no'}</button></div>
    <div style="text-align:center"><a class="back" href="../">← Volver a Juegos de Mesa PY</a></div>`);
}
function toggleSound() { S.sound = !S.sound; save(); showTitle(); }

function showHelp() {
  showScreen(`<h2>📖 Cómo se juega</h2>
    <ul class="ay">
      <li><b>Objetivo:</b> llegar a la parada del final de cada ciudad sin perder todas tus <b>chipas</b> (vidas). La última ciudad termina en la casa de la abuela.</li>
      <li><b>Moverse:</b> ◀ ▶ ${isTouch ? '' : '(<kbd>←</kbd> <kbd>→</kbd> o <kbd>A</kbd> <kbd>D</kbd>)'}. <b>Correr:</b> mantené 🏃 ${isTouch ? '' : '(<kbd>Shift</kbd>)'}: gasta energía ⚡.</li>
      <li><b>Saltar:</b> ⤴ ${isTouch ? '' : '(<kbd>Espacio</kbd> o <kbd>↑</kbd>)'}. Los súper baches solo se pasan saltando mientras corrés.</li>
      <li><b>Esconderse:</b> parate en una parada, despensa, basurero o rueda y tocá ⤵ ${isTouch ? '' : '(<kbd>↓</kbd>)'}. Sirve contra motochorros, camionetas, balaceras y el raudal (en la parada).</li>
      <li><b>Energía:</b> si llega a cero no podés correr. Recargá con 🧉 tereré, 🥟 empanada o 🍖 asadito. Lo que sobra va a la mochila: tocá COMER ${isTouch ? '' : '(<kbd>E</kbd>)'}.</li>
      <li><b>Bebidas frías</b> 🥤🍺: te dan un DASH ${isTouch ? '' : '(<kbd>J</kbd>)'}, un impulso rápido para escapar o saltar lejos.</li>
      <li><b>Monedas de ₲1.000:</b> para pagarle al limpiavidrios o comprar empanadas.</li>
      <li><b>Yuyera</b> 🧉 en la mitad de cada ciudad: es el punto de control. Si perdés todas las chipas, podés volver desde ahí.</li>
      <li><b>Jefe:</b> al final de cada ciudad algo te persigue. ¡Corré hasta la parada!</li>
      <li><b>Encargos de la abuela:</b> 🍓 en Areguá, 📺 en Ciudad del Este y 🧉 en Encarnación. De ellos depende el final.</li>
      ${isTouch ? '' : '<li>Señora: chancla con <kbd>F</kbd>. Pausa: <kbd>P</kbd> o <kbd>Esc</kbd>.</li>'}
    </ul>
    <button class="btn" onclick="showTitle()">← Volver</button>`);
}

function showChars() {
  ac();
  showScreen(`<h2>👤 Elegí tu personaje</h2><p class="sub">Cada uno tiene ventajas y desventajas para sobrevivir al día a día.</p>
    <div class="chars">${CHAR_ORDER.map(k => { const c = CHARS[k]; return `<div class="ch ${S.char === k ? 'sel' : ''}" data-k="${k}">
      <canvas width="70" height="100" data-p="${k}" style="width:56px;height:80px"></canvas>
      <div><b>${c.name}</b><i>${c.apodo}</i><div>⭐ ${c.hab}</div><div>👍 ${c.ven}</div><div>👎 ${c.des}</div>
      <div class="st">🥯 ${c.lives} vidas · ⚡ ${c.energy} · ₲${fmt(c.coins)}</div></div></div>`; }).join('')}</div>
    <button class="btn r" id="bOk" ${S.char ? '' : 'disabled'}>Seguir ▶</button>
    <button class="btn gr" onclick="showTitle()">← Volver</button>`);
  document.querySelectorAll('.ch canvas').forEach(c => {
    const keep = ctx; ctx = c.getContext('2d');   // drawPerson dibuja sobre ctx: un momento usamos el canvas chiquito
    ctx.setTransform(1.4, 0, 0, 1.4, 0, 0); drawPerson(25, 66, LOOKS[c.dataset.p], { face: 1 }); ctx = keep;
  });
  document.querySelectorAll('.ch').forEach(d => d.onclick = () => { S.char = d.dataset.k; save(); document.querySelectorAll('.ch').forEach(o => o.classList.toggle('sel', o === d)); $('#bOk').disabled = false; });
  $('#bOk').onclick = () => { goFull(); showMap(); };
}

function showMap() {
  const lv = (i) => { const C = LEVELS[i], lock = i + 1 > S.unlocked, enc = C.encargo ? (S.enc[C.id] ? ' ✅' + ENCARGO[C.encargo].e : ' ⬜' + ENCARGO[C.encargo].e) : '';
    return `<button class="lv ${lock ? 'lock' : ''}" ${lock ? 'disabled' : `onclick="showAudio(${i})"`}><span class="num">${lock ? '🔒' : i + 1}</span><span class="t"><b>${C.name}${enc}</b><small>${C.sub}</small></span>${i + 1 < S.unlocked ? '✔️' : ''}</button>`; };
  showScreen(`<h2>🗺️ El camino a lo de Ña Chola</h2><p class="sub">Jugás con <b>${CHARS[S.char].name}</b>. <a href="#" onclick="showChars();return false">Cambiar</a></p>
    <div class="acto">ACTO 1 · EL GRAN ASUNCIÓN</div>${[0, 1, 2, 3, 4, 5].map(lv).join('')}
    <div class="acto">ACTO 2 · EL PARAGUAY PROFUNDO</div>${[6, 7, 8].map(lv).join('')}
    <button class="btn gr" onclick="showTitle()">← Inicio</button>`);
}

function speak(t) {
  try {
    speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t);
    const v = speechSynthesis.getVoices().filter(v => /^es/i.test(v.lang)); u.voice = v.find(v => /PY|AR|419|MX|US/i.test(v.lang)) || v[0] || null;
    u.lang = (u.voice && u.voice.lang) || 'es-ES'; u.pitch = 1.25; u.rate = .95; speechSynthesis.speak(u);
  } catch (e) {}
}
function showAudio(i) {
  const C = LEVELS[i];
  showScreen(`${C.acto ? `<div class="tip" style="background:#1b2a5a;color:#fff;margin:0 0 12px">🚌💤 ${C.acto}</div>` : ''}
    <div class="wa"><div class="hd"><div class="av">👵</div><div><b>Ña Chola (abuela)</b><small>en línea</small></div></div>
    <div class="bub"><div class="aud"><button onclick="speak(LEVELS[${i}].audio)">▶</button><div class="wave"></div><small style="color:#8696a0">0:${String(8 + C.audio.length % 20).padStart(2, '0')}</small></div>
    <div class="tr">“${C.audio}”</div></div></div>
    <h2 style="margin-top:14px">Nivel ${i + 1}: ${C.name}</h2><p class="sub">${C.sub}</p>
    <div class="tip">💡 ${C.tip}</div>
    <button class="btn r" onclick="speechSynthesis.cancel();startLevel(${i})">¡Vamos! ▶</button>
    <button class="btn gr" onclick="speechSynthesis.cancel();showMap()">← Mapa</button>`);
}

function showPause() {
  showScreen(`<h2>⏸ Pausa</h2><p class="sub">${G.L.C.name} · ${CHARS[S.char].name}</p>
    <button class="btn r" onclick="togglePause()">▶ Seguir</button>
    <button class="btn" onclick="startLevel(${G.i})">↻ Empezar la ciudad de nuevo</button>
    <button class="btn gr" onclick="G=null;showMap()">🗺️ Mapa</button>`);
}
function showDead() {
  const hasCp = G.cp > 0;
  showScreen(`<div style="text-align:center;font-size:54px">🥯💔</div><h2 style="text-align:center">Te quedaste sin chipas</h2>
    <p class="sub" style="text-align:center">${G.msg ? G.msg.t : ''}</p>
    ${hasCp ? `<button class="btn g" onclick="startLevel(${G.i},true)">🧉 Volver desde la yuyera</button>` : ''}
    <button class="btn r" onclick="startLevel(${G.i})">↻ Empezar ${G.L.C.name} de nuevo</button>
    <button class="btn gr" onclick="G=null;showMap()">🗺️ Mapa</button>`);
}
function winLevel() {
  G.state = 'win'; setCtl(false); sfx('win');
  const i = G.i, C = LEVELS[i];
  S.unlocked = Math.max(S.unlocked, i + 2);
  S.clockAt[i + 1] = Math.floor(G.clock);
  if (C.encargo && G.encargo) S.enc[C.id] = true;
  save();
  const m = Math.floor(G.clock), hh = String(Math.floor(m / 60) % 24).padStart(2, '0'), mm = String(m % 60).padStart(2, '0');
  if (i === LEVELS.length - 1) { setTimeout(showEnding, 900); return; }
  setTimeout(() => showScreen(`<div style="text-align:center;font-size:50px">🚌✨</div><h2 style="text-align:center">¡Saliste vivo de ${C.name}!</h2>
    <div class="res"><div>🕗<b>${hh}:${mm}</b>hora</div><div>🥯<b>${G.p.lives}</b>chipas</div><div>⏱️<b>${Math.round(G.t)} s</b>tardaste</div><div>₲<b>${fmt(G.p.coins)}</b>en el bolsillo</div></div>
    ${C.encargo ? `<div class="tip">${G.encargo ? '✅ Conseguiste ' + ENCARGO[C.encargo].n + ' ' + ENCARGO[C.encargo].e : '⬜ No conseguiste ' + ENCARGO[C.encargo].n + '. Podés volver a esta ciudad desde el mapa para buscarlo.'}</div>` : ''}
    <button class="btn r" onclick="showAudio(${i + 1})">Siguiente: ${LEVELS[i + 1].name} ▶</button>
    <button class="btn gr" onclick="G=null;showMap()">🗺️ Mapa</button>`), 900);
}
function showEnding() {
  const m = Math.floor(G.clock), late = m >= 24 * 60;
  const falt = Object.keys(ENCARGO).filter(k => !LEVELS.some(l => l.encargo === k && S.enc[l.id]));
  const hh = String(Math.floor(m / 60) % 24).padStart(2, '0'), mm = String(m % 60).padStart(2, '0');
  let em, tit, body;
  if (late) { em = '🌙🥖'; tit = 'Llegaste a las ' + hh + ':' + mm + '…'; body = 'Ya se comieron toda la sopa paraguaya. Ña Chola te guardó la chipa dura de ayer. “La próxima salí más temprano, che memby.”'; }
  else if (falt.length) { em = '☕😑'; tit = 'Llegaste… pero te faltó algo'; body = 'Te faltó traer ' + falt.map(k => ENCARGO[k].n + ' ' + ENCARGO[k].e).join(' y ') + '. Ña Chola te mira, suspira y te sirve solamente cocido. Volvé a esas ciudades desde el mapa para conseguirlo.'; }
  else { em = '🎄👵🤗'; tit = '¡Llegaste a las ' + hh + ':' + mm + '!'; body = 'Con las frutillas, el tele y el termo. Toda la familia te recibe con un abrazo y sopa paraguaya. Ña Chola te dice: “¿Y por qué tardaste tanto, che memby?” ¡Feliz Navidad! 🎆'; }
  showScreen(`<div style="text-align:center;font-size:56px">${em}</div><h2 style="text-align:center">${tit}</h2><p style="text-align:center">${body}</p>
    <p class="sub" style="text-align:center">Personaje: ${CHARS[S.char].name} · Chipas al final: ${G.p.lives}</p>
    <button class="btn r" onclick="G=null;showMap()">🗺️ Volver al mapa</button>
    <button class="btn gr" onclick="showTitle()">Inicio</button>`);
}

showTitle();
