/* =====================================================================
   Salas de Voz
   - Conexión entre aparatos con PeerJS (cada uno se conecta con todos).
     El primero que entra a una sala guarda la lista de presentes con el id
     «salapy26-<sala>-reg»; si se va, otro toma su lugar solo.
   - Voz con quitado de ruido RNNoise (vendor/), más un corte de silencio.
   - Varias pantallas por persona: cada pantalla viaja en su propia llamada.
   - Subtítulos: quien comparte manda el sonido de su pantalla a Deepgram,
     traduce al español lo que no está en español y reparte el texto a todos.
   ===================================================================== */
import { RnnoiseWorkletNode, loadRnnoise } from './vendor/ns.js';

const PFX = 'salapy26-';
const API = (/(^|\.)juegospy\.com$|\.pages\.dev$/.test(location.hostname) ? '/api/' : 'https://juegosdemesapy.pages.dev/api/');   // el servidor del mismo sitio (desde GitHub, el de Cloudflare)
const ROOMS = [['general', 'General'], ['peliculas', 'Películas'], ['juegos', 'Juegos'], ['charla', 'Charla']];
const $ = s => document.querySelector(s);
const rand = n => Math.random().toString(36).slice(2, 2 + n).padEnd(n, '0');
const slug = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const colorOf = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return `hsl(${h % 360} 55% 45%)`; };

const ICON = {
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8"/></svg>',
  micOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 9.3V5a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 5.1 2.1M17 16.9A7 7 0 0 1 5 12v-2M19 10v2c0 .8-.1 1.5-.4 2.2M12 19v3M8 22h8M2 2l20 20"/></svg>',
  head: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z"/></svg>',
  headOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 18v-6a9 9 0 0 1 15.4-6.4M21 12v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3zM2 2l20 20"/></svg>',
  full: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>',
  people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M17 11a3 3 0 1 0 0-6M22 21a6 6 0 0 0-4-5.6"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.9 4.2A10 10 0 0 1 12 4c7 0 10 8 10 8a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3 8 10 8a9.7 9.7 0 0 0 5.4-1.6M2 2l20 20M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  focus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="13" rx="2"/><path d="M7 21h10"/></svg>',
  stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  vol: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>',
  cc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M10 10.5a2.5 2.5 0 1 0 0 3M17 10.5a2.5 2.5 0 1 0 0 3"/></svg>',
};

/* ---------------- ajustes guardados ---------------- */
const cfg = Object.assign({
  name: '', mic: '', btMode: 'both', out: '', ns: 'ia', gate: -58, quality: 'motion', res: 'q1080', autoSub: true, subLang: 'multi', subs: true, subSize: '1', vols: {},
}, (() => { try { return JSON.parse(localStorage.getItem('salas_cfg') || '{}'); } catch (e) { return {}; } })());
const saveCfg = () => { try { localStorage.setItem('salas_cfg', JSON.stringify(cfg)); } catch (e) {} };

/* ---------------- estado ---------------- */
const S = {
  room: '', name: '', me: null, reg: null, regConn: null, regTimer: 0, left: false,
  roster: [],                 // [{id,name}] según la lista de la sala
  peers: new Map(),           // id -> {id, conn, name, muted, deaf, vol}
  pending: new Map(),         // id -> momento en que se intentó conectar
  local: new Map(),           // sid -> {sid, kind, stream, label, calls:Map, sub}
  remote: new Map(),          // "peer|sid" -> {key, peer, sid, kind, stream, call, el, an, label, hasAudio}
  tiles: new Map(),           // key -> elemento del cuadro
  focus: '',                  // cuadro agrandado
  muted: false, deaf: false, shares: 0, unread: 0,
  vcap: {},                   // amigo -> cuánto bajo mis pantallas para cuidar la voz
  hidden: new Set(),          // pantallas de otros que oculté ("peer|sid")
};
const regId = () => PFX + S.room + '-reg';

// calidades para compartir pantalla: tamaño máximo, cuadros por segundo y velocidad (kbps) por cada amigo que mira
const QUAL = {
  q720: { w: 1280, h: 720, fps: 30, kbps: 2500 },
  q1080: { w: 1920, h: 1080, fps: 30, kbps: 5000 },
  'q1080-60': { w: 1920, h: 1080, fps: 60, kbps: 8000 },
  q1440: { w: 2560, h: 1440, fps: 60, kbps: 12000 },
  max: { w: 3840, h: 2160, fps: 60, kbps: 16000 },
};
const qual = k => QUAL[k] || QUAL.q1080;

// salas privadas: el nombre de la sala es «priv-» + un código al azar
const PRIV = 'priv-';
const newCode = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', b = new Uint8Array(6); crypto.getRandomValues(b); return [...b].map(x => A[x % A.length]).join(''); };
const codeOf = room => room.startsWith(PRIV) ? room.slice(PRIV.length).toUpperCase() : '';

/* ---------------- avisos ---------------- */
let toastT = 0;
function toast(msg, ms = 3500) {
  const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), ms);
}
function netState(txt, ok) { const n = $('#netState'); n.textContent = txt; n.classList.toggle('ok', !!ok); }

/* =====================================================================
   PANTALLA DE ENTRADA
   ===================================================================== */
(function home() {
  const params = new URLSearchParams(location.search);
  let pick = slug(params.get('sala')) || 'general';
  $('#inName').value = cfg.name || '';
  const box = $('#roomPick');
  ROOMS.forEach(([id, name]) => {
    const b = document.createElement('button');
    b.innerHTML = `<span style="color:var(--muted)">🔊</span><span class="rn"><b>${esc(name)}</b><small class="who" data-room="${id}">Mirando…</small></span>`;
    b.dataset.id = id;
    b.onclick = () => { pick = id; $('#inRoom').value = ''; mark(); };
    box.appendChild(b);
  });
  if (codeOf(pick)) { $('#inCode').value = codeOf(pick); pick = 'general'; }
  else if (!ROOMS.some(r => r[0] === pick)) $('#inRoom').value = pick;
  const mark = () => box.querySelectorAll('button').forEach(b => b.classList.toggle('sel', !$('#inRoom').value.trim() && !$('#inCode').value.trim() && b.dataset.id === pick));
  $('#inRoom').oninput = $('#inCode').oninput = mark;
  mark();
  const go = () => {
    const name = $('#inName').value.trim();
    const err = $('#homeErr');
    if (!name) { err.textContent = 'Escribí tu nombre.'; err.classList.remove('hidden'); $('#inName').focus(); return; }
    const code = $('#inCode').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if ($('#inCode').value.trim() && code.length < 4) { err.textContent = 'El código tiene que tener al menos 4 letras o números.'; err.classList.remove('hidden'); return; }
    let room = code ? PRIV + code.toLowerCase() : (slug($('#inRoom').value) || pick);
    if (room.startsWith(PRIV) && !code) room = 'sala-' + room;   // nadie entra a una privada escribiendo el nombre
    cfg.name = name; saveCfg();
    enter(name, room).catch(e => {
      console.error(e);
      err.textContent = 'No se pudo entrar: ' + (e && e.message || e); err.classList.remove('hidden');
    });
  };
  $('#btnEnter').onclick = go;
  $('#btnCreate').onclick = () => { $('#inCode').value = newCode(); $('#inRoom').value = ''; mark(); go(); };
  $('#inName').onkeydown = $('#inRoom').onkeydown = $('#inCode').onkeydown = e => { if (e.key === 'Enter') go(); };
  setTimeout(watchRooms, 0);
  if (!navigator.mediaDevices || !window.RTCPeerConnection) {
    $('#homeErr').textContent = 'Este navegador no permite llamadas. Usá Chrome, Edge o Firefox actualizados.';
    $('#homeErr').classList.remove('hidden');
  }
})();

// desde la entrada: quién está en cada sala (pregunta a quien guarda la lista de cada una)
function watchRooms() {
  if (!window.Peer) return;
  const w = S.watch = new Peer(PFX + 'ver-' + rand(10), peerOpts());
  const show = (id, list) => {
    const el = document.querySelector(`.who[data-room="${id}"]`); if (!el) return;
    if (!list.length) { el.textContent = 'Vacía'; el.classList.remove('busy'); return; }
    el.textContent = `${list.length} · ` + list.map(m => m.name).join(', ');
    el.title = list.map(m => m.name).join('\n');
    el.classList.add('busy');
  };
  const pend = {};   // un solo reintento esperando por sala
  const again = (id, ms = 8000) => {
    if (pend[id]) return; pend[id] = true;
    setTimeout(() => { pend[id] = false; if (S.watch === w && !w.destroyed) peek(id); }, ms);
  };
  const peek = id => {
    if (w.destroyed || w.disconnected) return again(id);
    const c = w.connect(PFX + id + '-reg', { reliable: true });
    if (!c) return again(id);
    let got = false;
    let old = false;
    c.on('open', () => {
      c.send({ t: 'peek' });
      // la lista la tiene alguien con la página vieja (no entiende «peek»): se pregunta como antes,
      // presentándose un instante como «👀 mirando», y se corta apenas llega la lista
      setTimeout(() => { if (!got && c.open) { old = true; c.send({ t: 'hello', name: '👀 mirando' }); } }, 3000);
    });
    c.on('data', d => {
      if (!d || d.t !== 'list' || !Array.isArray(d.list)) return;
      got = true;
      show(id, d.list.filter(m => m.id !== w.id && !String(m.id).includes('-ver-')));
      if (old) { try { c.close(); } catch (e) {} }   // al cerrar se vuelve a preguntar en unos segundos
    });
    c.on('close', () => again(id, old ? 15000 : 8000));   // se fue quien tenía la lista (o era la vieja): se vuelve a preguntar
    setTimeout(() => {
      if (got) return;
      if (c.open) { const el = document.querySelector(`.who[data-room="${id}"]`); if (el) { el.textContent = 'Hay gente'; el.classList.add('busy'); } }
      try { c.close(); } catch (e) {}
    }, 9000);
  };
  w.on('open', () => ROOMS.forEach(([id]) => peek(id)));
  w.on('error', e => {
    const m = String(e.message || '').match(/salapy26-([a-z0-9-]+)-reg/);
    if (e.type === 'peer-unavailable' && m) { show(m[1], []); again(m[1]); }
  });
  w.on('disconnected', () => { if (!w.destroyed) setTimeout(() => !w.destroyed && w.reconnect(), 2000); });
}

async function enter(name, room) {
  if (S.watch) { try { S.watch.destroy(); } catch (e) {} S.watch = null; }
  S.name = name; S.room = room;
  $('#btnEnter').disabled = true;
  try { await audioStart(); }
  catch (e) {
    $('#btnEnter').disabled = false;
    if (e && e.name === 'NotAllowedError') throw new Error('hay que permitir el micrófono');
    throw e;
  }
  history.replaceState(null, '', location.pathname + '?sala=' + room);
  $('#home').classList.add('hidden');
  $('#room').classList.remove('hidden');
  const code = codeOf(room);
  const nice = code ? 'Sala privada' : (ROOMS.find(r => r[0] === room) || [0, room])[1];
  $('#roomName').textContent = nice;
  if (code) {
    $('#roomCode').classList.remove('hidden');
    $('#roomCode b').textContent = code;
    $('#roomCode').onclick = () => navigator.clipboard.writeText(code).then(() => toast('Código copiado: ' + code)).catch(() => {});
  }
  document.title = nice + ' · Salas de Voz';
  if (!navigator.mediaDevices.getDisplayMedia) $('#btnShare').classList.add('hidden');
  S.local.set('mic', { sid: 'mic', kind: 'mic', stream: A.dest.stream, label: 'voz', calls: new Map() });
  renderBar(); render();
  netStart();
  mediaSession();
  sysMsg('Entraste a la sala.');
}

/* =====================================================================
   MICRÓFONO: RNNoise + corte de silencio
   ===================================================================== */
const A = { ctx: null, raw: null, src: null, rn: null, rnBin: null, rnReady: false, gate: null, an: null, dest: null, loop: false, open: false, lastLoud: 0, db: -100 };

async function audioStart() {
  A.ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
  A.gate = A.ctx.createGain(); A.gate.gain.value = 0;
  A.an = A.ctx.createAnalyser(); A.an.fftSize = 1024;
  A.dest = A.ctx.createMediaStreamDestination();
  A.gate.connect(A.dest);
  await micOpen();
  // con «Automático», si ya hay un auricular conectado se elige según el modo
  if (!cfg.mic) { const id = await autoMicId(); if (id && id !== A.micId) await micOpen(id).catch(() => {}); }
  knownIns = await audioInputs();
  if (A.ctx.state === 'suspended') await A.ctx.resume();
  setInterval(gateTick, 20);
  setInterval(talkTick, 120);
  navigator.mediaDevices.addEventListener && navigator.mediaDevices.addEventListener('devicechange', onDevices);
}

// id: micrófono a usar en este momento (sin guardarlo); si no se pasa, el elegido en Ajustes
async function micOpen(id = cfg.mic) {
  const want = { echoCancellation: true, noiseSuppression: cfg.ns === 'nav', autoGainControl: true, channelCount: 1 };
  let raw;
  try { raw = await navigator.mediaDevices.getUserMedia({ audio: id ? { ...want, deviceId: { exact: id } } : want }); }
  catch (e) {
    if (!id || e.name === 'NotAllowedError') throw e;
    if (id === cfg.mic) { cfg.mic = ''; saveCfg(); }   // el micrófono elegido ya no está: se usa el normal
    raw = await navigator.mediaDevices.getUserMedia({ audio: want });
  }
  if (A.raw) A.raw.getTracks().forEach(t => t.stop());
  A.raw = raw;
  const tr = raw.getAudioTracks()[0];
  A.micId = tr && tr.getSettings ? tr.getSettings().deviceId : '';
  A.micLabel = tr ? tr.label : '';
  await micWire();
  // si la app está minimizada en el celular, se manda directo el micrófono nuevo
  if (typeof bgRaw !== 'undefined' && bgRaw && tr) { tr.enabled = !S.muted; micSenders().forEach(s => s.replaceTrack(tr).catch(() => {})); }
}

/* ---------------- auriculares (Bluetooth o con cable) ---------------- */
const HEADSET = /bluetooth|headset|hands-?free|auricular|airpods|buds|headphone|\bbt\b/i;
let knownIns = null;
const audioInputs = async () => {
  try {
    return (await navigator.mediaDevices.enumerateDevices())
      .filter(d => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications');
  } catch (e) { return []; }
};
// con «Automático»: auricular conectado → su micrófono (modo «both») o el del celular (modo «listen»)
async function autoMicId(list) {
  const ins = list || await audioInputs();
  const head = ins.find(d => HEADSET.test(d.label));
  if (!head) return '';
  if (cfg.btMode === 'listen') { const phone = ins.find(d => !HEADSET.test(d.label)); return phone ? phone.deviceId : ''; }
  return head.deviceId;
}
async function onDevices() {
  fillMics();
  if (!A.ctx || !S.me || S.left) return;
  const ins = await audioInputs();
  const prev = knownIns || [];
  knownIns = ins;
  const added = ins.filter(d => !prev.some(p => p.deviceId === d.deviceId));
  const removed = prev.filter(p => !ins.some(d => d.deviceId === p.deviceId));
  const head = added.find(d => HEADSET.test(d.label));
  const lostMine = removed.some(d => d.deviceId === A.micId);
  if (cfg.mic && !lostMine) return;   // eligió un micrófono fijo en Ajustes y sigue conectado
  try {
    if (head) {
      await micOpen(await autoMicId(ins));
      toast(cfg.btMode === 'listen'
        ? `🎧 Se conectó «${head.label}»: escuchás por el auricular y hablás con el micrófono del celular.`
        : `🎧 Se conectó «${head.label}»: hablás y escuchás por el auricular.`, 6000);
    } else if (lostMine || removed.some(d => HEADSET.test(d.label))) {
      await micOpen(await autoMicId(ins));
      toast('Se desconectó el auricular: ahora usás el micrófono y el altavoz del aparato.', 6000);
    }
  } catch (e) { toast('No se pudo cambiar el micrófono: ' + e.message); }
  fillMics();
}

/* ---------------- por dónde se escucha ---------------- */
const canSink = 'setSinkId' in HTMLMediaElement.prototype;
function applySink(el) { if (canSink && el && cfg.out) el.setSinkId(cfg.out).catch(() => {}); }
function applySinkAll() {
  S.remote.forEach(r => r.el && (canSink ? r.el.setSinkId(cfg.out || '').catch(() => {}) : 0));
  if (A.ctx && A.ctx.setSinkId) A.ctx.setSinkId(cfg.out || '').catch(() => {});
}

async function micWire() {
  try { A.src && A.src.disconnect(); } catch (e) {}
  if (A.rn) { try { A.rn.disconnect(); A.rn.destroy(); } catch (e) {} A.rn = null; }
  A.src = A.ctx.createMediaStreamSource(A.raw);
  let out = A.src;
  if (cfg.ns === 'ia') {
    try {
      if (!A.rnReady) {
        A.rnBin = await loadRnnoise({ url: 'vendor/rnnoise.wasm', simdUrl: 'vendor/rnnoise_simd.wasm' });
        await A.ctx.audioWorklet.addModule('vendor/rnnoise-worklet.js');
        A.rnReady = true;
      }
      A.rn = new RnnoiseWorkletNode(A.ctx, { wasmBinary: A.rnBin, maxChannels: 1 });
      A.src.connect(A.rn); out = A.rn;
    } catch (e) {
      console.warn('RNNoise no cargó', e);
      toast('No se pudo activar el quitado de ruido inteligente; se usa el del navegador.');
    }
  }
  out.connect(A.an); out.connect(A.gate);
}

const levelDb = (an, buf) => {
  an.getFloatTimeDomainData(buf);
  let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return 10 * Math.log10(s / buf.length + 1e-12);
};
const gBuf = new Float32Array(1024);
function gateTick() {
  if (!A.an) return;
  const now = performance.now();
  A.db = levelDb(A.an, gBuf);
  if (A.db > cfg.gate) { A.lastLoud = now; A.open = true; }
  else if (A.open && now - A.lastLoud > 700) A.open = false;   // espera un poco para no cortar el final de las palabras
  const on = A.open && !S.muted;
  const t = A.ctx.currentTime;
  A.gate.gain.setTargetAtTime(on ? 1 : 0, t, on ? 0.004 : 0.12);
  if (dlgOpen) {
    const pct = v => Math.max(0, Math.min(100, (v + 90) / 70 * 100));
    $('#meter i').style.width = pct(A.db) + '%';
    $('#meter i').style.background = A.db > cfg.gate ? 'var(--green)' : '#4e5058';
    $('#meter b').style.left = pct(cfg.gate) + '%';
  }
}

/* quién está hablando: brillo verde en su cuadro y en la lista */
const tBuf = new Float32Array(1024);
const talking = new Map();
function talkTick() {
  const set = (id, on) => {
    if (talking.get(id) === on) return; talking.set(id, on);
    document.querySelectorAll(`[data-talk="${CSS.escape(id)}"]`).forEach(el => el.classList.toggle('talk', on));
  };
  set('me', A.open && !S.muted);
  S.remote.forEach(r => { if (r.kind === 'mic' && r.an) set(r.peer, levelDb(r.an, tBuf) > -55); });
}

function setMuted(v) {
  S.muted = v;
  A.dest.stream.getAudioTracks().forEach(t => t.enabled = !v);
  if (bgRaw && A.raw) A.raw.getAudioTracks().forEach(t => t.enabled = !v);
  mediaMic();
  broadcast({ t: 'state', muted: S.muted, deaf: S.deaf });
  renderBar(); renderMembers();
}
function setDeaf(v) {
  S.deaf = v;
  if (v) { S.wasMuted = S.muted; setMuted(true); } else setMuted(!!S.wasMuted);
  S.remote.forEach(applyVolume);
  broadcast({ t: 'state', muted: S.muted, deaf: S.deaf });
  renderBar(); renderMembers();
}
function applyVolume(r) {
  if (!r.el) return;
  r.el.muted = S.deaf;
  const v = r.kind === 'mic' ? (cfg.vols[r.peerName || ''] ?? 100) : (r.vol ?? 100);
  r.el.volume = Math.max(0, Math.min(1, v / 100));
}

/* =====================================================================
   RED: lista de la sala + conexiones con cada uno
   ===================================================================== */
const peerOpts = () => ({ config: { iceServers: window.ICE_SERVERS }, debug: 1 });

function netStart() {
  netState('Conectando…');
  const me = S.me = new Peer(PFX + S.room + '-' + rand(8), peerOpts());
  me.on('open', () => { netState('Conectado', true); joinRegistry(); });
  me.on('connection', setupConn);
  me.on('call', onCall);
  me.on('disconnected', () => {
    if (S.left) return;
    netState('Reconectando…');
    setTimeout(() => { if (!me.destroyed && me.disconnected) me.reconnect(); }, 1500);
  });
  me.on('error', e => {
    if (e.type === 'peer-unavailable') {
      const who = String(e.message || '').match(/salapy26-[a-z0-9-]+/);
      if (who && who[0] === regId()) { if (S.regConn) { const c = S.regConn; S.regConn = null; try { c.close(); } catch (x) {} } becomeRegistry(); }
      else if (who) S.pending.delete(who[0]);
      return;
    }
    console.warn('peer', e.type, e);
    if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(e.type)) netState('Sin conexión con el servidor, reintentando…');
  });
  // aviso de vida a la lista y reintento con los que faltan
  setInterval(() => {
    if (S.regConn && S.regConn.open) try { S.regConn.send({ t: 'ping' }); } catch (e) {}
    onList(S.roster);
  }, 4000);
}

function joinRegistry() {
  if (S.left || !S.me || S.me.destroyed) return;
  clearTimeout(S.regTimer);
  if (S.regConn) { const old = S.regConn; S.regConn = null; try { old.close(); } catch (e) {} }
  const c = S.me.connect(regId(), { reliable: true });
  if (!c) return;
  S.regConn = c;
  let opened = false;
  c.on('open', () => { opened = true; c.send({ t: 'hello', name: S.name }); });
  c.on('data', d => { if (d && d.t === 'list') onList(d.list); });
  c.on('close', () => {
    if (S.regConn !== c || S.left) return;
    S.regConn = null;
    // se fue quien tenía la lista: alguien la toma (al azar para no chocar)
    S.regTimer = setTimeout(becomeRegistry, 300 + Math.random() * 1500);
  });
  setTimeout(() => { if (!opened && S.regConn === c) { S.regConn = null; try { c.close(); } catch (e) {} becomeRegistry(); } }, 9000);
}

function becomeRegistry() {
  if (S.left) return;
  if (S.reg && !S.reg.destroyed) return joinRegistry();
  const r = S.reg = new Peer(regId(), peerOpts());
  const members = new Map();
  const watchers = new Set();   // los que miran desde la entrada quién está, sin entrar
  const send = () => {
    const list = [...members].map(([id, m]) => ({ id, name: m.name }));
    members.forEach(m => { try { m.conn.open && m.conn.send({ t: 'list', list }); } catch (e) {} });
    watchers.forEach(c => { try { c.open && c.send({ t: 'list', list }); } catch (e) {} });
  };
  r.on('open', () => joinRegistry());
  r.on('error', e => {
    if (e.type === 'unavailable-id') {   // otro ya la tomó
      clearInterval(r._iv); r.destroy(); if (S.reg === r) S.reg = null;
      setTimeout(joinRegistry, 300 + Math.random() * 700);
    } else console.warn('lista', e.type);
  });
  r.on('disconnected', () => { if (!r.destroyed) setTimeout(() => { if (!r.destroyed && r.disconnected) r.reconnect(); }, 1500); });
  r.on('connection', c => {
    c.on('data', d => {
      if (!d) return;
      if (d.t === 'hello') { members.set(c.peer, { name: String(d.name || '?').slice(0, 24), conn: c, seen: Date.now() }); send(); }
      else if (d.t === 'peek') { watchers.add(c); c.send({ t: 'list', list: [...members].map(([id, m]) => ({ id, name: m.name })) }); }
      else { const m = members.get(c.peer); if (m) m.seen = Date.now(); }
    });
    c.on('close', () => { watchers.delete(c); const m = members.get(c.peer); if (m && m.conn === c) { members.delete(c.peer); send(); } });
  });
  r._iv = setInterval(() => {
    let ch = false;
    members.forEach((m, id) => { if (Date.now() - m.seen > 15000) { members.delete(id); try { m.conn.close(); } catch (e) {} ch = true; } });
    if (ch) send();
  }, 5000);
}

function onList(list) {
  if (!Array.isArray(list) || !S.me || !S.me.id) return;
  const changed = JSON.stringify(list) !== JSON.stringify(S.roster);
  S.roster = list;
  list.forEach(m => {
    if (m.id === S.me.id || S.peers.has(m.id)) return;
    if (S.me.id < m.id) return;                       // conecta el de id mayor
    const t = S.pending.get(m.id);
    if (t && Date.now() - t < 12000) return;
    S.pending.set(m.id, Date.now());
    const c = S.me.connect(m.id, { reliable: true });
    if (c) setupConn(c);
  });
  if (changed) renderMembers();
}

function setupConn(c) {
  c.on('open', () => {
    S.pending.delete(c.peer);
    const old = S.peers.get(c.peer);
    if (old && old.conn !== c && old.conn.open) {
      // conexión doble: las dos puntas se quedan con la de id más chico
      if (c.connectionId > old.conn.connectionId) { c.close(); return; }
      old.conn.close();
    }
    const fromList = S.roster.find(m => m.id === c.peer);
    const p = old || { id: c.peer, name: fromList ? fromList.name : '…', muted: false, deaf: false };
    p.conn = c;
    S.peers.set(c.peer, p);
    c.send({ t: 'hi', name: S.name, muted: S.muted, deaf: S.deaf });
    // le mando mis transmisiones: voz y cada pantalla
    S.local.forEach(ls => callStream(c.peer, ls));
    if (!old) sysMsg(`${p.name} entró a la sala.`);
    render();
  });
  c.on('data', d => onData(c.peer, d));
  c.on('close', () => { const p = S.peers.get(c.peer); if (p && p.conn === c) dropPeer(c.peer); });
  c.on('error', e => console.warn('conn', e));
}

function dropPeer(id) {
  const p = S.peers.get(id);
  S.peers.delete(id); S.pending.delete(id);
  S.local.forEach(ls => { const call = ls.calls.get(id); if (call) { ls.calls.delete(id); try { call.close(); } catch (e) {} } });
  [...S.remote.values()].filter(r => r.peer === id).forEach(r => removeRemote(r.key));
  if (p) sysMsg(`${p.name} salió de la sala.`);
  render();
}

function broadcast(msg) { S.peers.forEach(p => { try { p.conn && p.conn.open && p.conn.send(msg); } catch (e) {} }); }

function onData(from, d) {
  if (!d || typeof d !== 'object') return;
  const p = S.peers.get(from);
  switch (d.t) {
    case 'hi':
      if (p) { p.name = String(d.name || '?').slice(0, 24); p.muted = !!d.muted; p.deaf = !!d.deaf; }
      S.remote.forEach(r => { if (r.peer === from) { r.peerName = p && p.name; applyVolume(r); } });
      render(); break;
    case 'state':
      if (p) { p.muted = !!d.muted; p.deaf = !!d.deaf; renderMembers(); renderTiles(); } break;
    case 'unshare':
      removeRemote(from + '|' + d.sid); break;
    case 'sub':
      showSub(from + '|' + d.sid, d.seg | 0, String(d.text || '').slice(0, 400), !!d.pend); break;
    case 'chat':
      addMsg(p ? p.name : '?', String(d.text || '').slice(0, 500)); break;
    case 'pause': {
      const ls = S.local.get(d.sid); if (!ls || ls.kind !== 'screen') break;
      ls.paused = ls.paused || new Set();
      if (d.on) ls.paused.add(from); else ls.paused.delete(from);
      applyPause(ls, from);
      break;
    }
  }
}

/* ---------------- llamadas (una por transmisión) ---------------- */
function callStream(pid, ls) {
  if (!S.me || !ls.stream) return;
  const old = ls.calls.get(pid); if (old) { try { old.close(); } catch (e) {} }
  const kbps = ls.kind === 'screen' ? qual(ls.q).kbps : 0;
  const call = S.me.call(pid, ls.stream, {
    metadata: { kind: ls.kind, sid: ls.sid, label: ls.label, audio: ls.stream.getAudioTracks().length > 0, kbps },
    sdpTransform: sdp => sdpBoost(sdp, kbps, ls.kind === 'screen'),
  });
  if (!call) return;
  ls.calls.set(pid, call);
  const pc = call.peerConnection;
  if (pc) pc.addEventListener('connectionstatechange', () => { if (pc.connectionState === 'connected') { tune(pc, ls, pid); applyPause(ls, pid); } });
  call.on('close', () => { if (ls.calls.get(pid) === call) ls.calls.delete(pid); });
  call.on('error', e => console.warn('call', e));
}

// calidad de las pantallas y su sonido; la voz siempre con prioridad alta y la pantalla baja.
// S.vcap[amigo] (0,1–1) baja la velocidad de mis pantallas para ese amigo cuando la voz se corta.
function tune(pc, ls, pid) {
  const q = qual(ls.q);
  const f = ls.kind === 'screen' ? (S.vcap[pid] ?? 1) : 1;
  pc.getSenders().forEach(s => {
    const kind = s.track ? s.track.kind : (s._orig && s._orig.kind);
    if (!kind) return;
    const p = s.getParameters(); if (!p.encodings || !p.encodings.length) p.encodings = [{}];
    const e = p.encodings[0];
    if (kind === 'video') {
      e.maxBitrate = Math.max(300, Math.round(q.kbps * f)) * 1000;
      e.maxFramerate = f < 0.5 ? Math.min(q.fps, 30) : q.fps;
      e.scaleResolutionDownBy = 1;
      e.priority = e.networkPriority = 'low';
      p.degradationPreference = ls.hint === 'detail' ? 'maintain-resolution' : 'balanced';
    } else if (ls.kind === 'screen') {
      e.maxBitrate = (f < 0.5 ? 64 : 128) * 1000;
      e.priority = e.networkPriority = 'low';
    } else {
      e.maxBitrate = 64_000;
      e.priority = e.networkPriority = 'high';   // la voz primero
    }
    s.setParameters(p).catch(() => {});
  });
}

// Si la voz con un amigo se corta (sonido perdido o con demoras) mientras comparto, bajo la calidad
// de mis pantallas para ese amigo; cuando se normaliza la subo de a poco.
const voiceBad = p => (p.loss || 0) > 2 || (p.jitter || 0) > 45 || (p.outLoss || 0) > 2 || (p.outJitter || 0) > 45;
function voiceGuard() {
  const sharing = [...S.local.values()].some(l => l.kind === 'screen');
  if (!sharing || cfg.voiceFirst === false) { if (Object.keys(S.vcap).length) { S.vcap = {}; S.peers.forEach((p, id) => applyCaps(id)); } return; }
  // si a mí me llega cortada la voz de cualquiera, puede ser que mi subida esté llena (Wi-Fi): bajo para todos
  const mine = [...S.peers.values()].some(p => (p.loss || 0) > 2 || (p.jitter || 0) > 45);
  S.peers.forEach((p, id) => {
    const old = S.vcap[id] ?? 1;
    const f = (voiceBad(p) || mine) ? Math.max(0.1, old * 0.6) : Math.min(1, old + 0.08);
    if (Math.abs(f - old) > 0.02) { S.vcap[id] = f; applyCaps(id); }
  });
}
function applyCaps(pid) {
  S.local.forEach(ls => {
    if (ls.kind !== 'screen') return;
    const c = ls.calls.get(pid), pc = c && c.peerConnection;
    if (pc && pc.connectionState === 'connected') tune(pc, ls, pid);
  });
}

// un amigo ocultó una de mis pantallas: dejo de mandársela (imagen y sonido) hasta que la vuelva a mostrar
function applyPause(ls, pid) {
  const c = ls.calls.get(pid), pc = c && c.peerConnection; if (!pc) return;
  const off = !!(ls.paused && ls.paused.has(pid));
  pc.getSenders().forEach(s => {
    if (s.track) s._orig = s.track;
    if (!s._orig) return;
    const want = off ? null : s._orig;
    if (s.track !== want) s.replaceTrack(want).catch(() => {});
  });
}

// ocultar / mostrar una pantalla de otro
function hideScreen(key, on) {
  if (on) S.hidden.add(key); else S.hidden.delete(key);
  const [peer, sid] = key.split('|');
  const p = S.peers.get(peer);
  try { p && p.conn && p.conn.open && p.conn.send({ t: 'pause', sid, on }); } catch (e) {}
  if (S.focus === key) S.focus = '';
  renderTiles();
}

// arranca la imagen con buena velocidad desde el principio (si no, empieza borrosa unos segundos)
// y manda el sonido de la pantalla en estéreo
function sdpBoost(sdp, kbps, stereo) {
  if (!kbps) return sdp;
  const lines = sdp.split('\r\n'), pts = {}, out = [];
  lines.forEach(l => { const m = l.match(/^a=rtpmap:(\d+) ([\w-]+)\//); if (m) pts[m[1]] = m[2].toUpperCase(); });
  const hasFmtp = new Set(lines.filter(l => l.startsWith('a=fmtp:')).map(l => l.slice(7).split(' ')[0]));
  const bw = `x-google-start-bitrate=${Math.round(kbps * 0.6)};x-google-min-bitrate=${Math.round(kbps * 0.15)};x-google-max-bitrate=${kbps}`;
  const vid = ['VP8', 'VP9', 'H264', 'AV1'];
  let sect = '';
  for (const l of lines) {
    if (l.startsWith('m=')) sect = l.slice(2).split(' ')[0];
    let m = l.match(/^a=fmtp:(\d+) (.*)$/);
    if (m && sect === 'video' && vid.includes(pts[m[1]]) && !/x-google-max-bitrate/.test(l)) { out.push(l + ';' + bw); continue; }
    if (m && sect === 'audio' && stereo && pts[m[1]] === 'OPUS') {
      out.push(l.replace(/;?(stereo|sprop-stereo|maxaveragebitrate)=\d+/g, '') + ';stereo=1;sprop-stereo=1;maxaveragebitrate=128000'); continue;
    }
    out.push(l);
    m = l.match(/^a=rtpmap:(\d+) ([\w-]+)\//);
    if (m && sect === 'video' && vid.includes(pts[m[1]]) && !hasFmtp.has(m[1])) out.push(`a=fmtp:${m[1]} ${bw}`);
  }
  return out.join('\r\n');
}

function onCall(call) {
  const md = call.metadata || {};
  const sid = String(md.sid || 'mic');
  const key = call.peer + '|' + sid;
  const kbps = md.kind === 'screen' ? Math.min(20000, Math.max(0, md.kbps | 0)) : 0;
  call.answer(undefined, { sdpTransform: sdp => sdpBoost(sdp, kbps, md.kind === 'screen') });
  let done = false;
  call.on('stream', st => {
    if (md.kind === 'screen' && !st.getVideoTracks().length) return;   // espera a que llegue la imagen
    if (done) return; done = true;
    addRemote(key, call, md, st);
  });
  call.on('close', () => { const r = S.remote.get(key); if (r && r.call === call) removeRemote(key); });
  call.on('error', e => console.warn('call', e));
}

function addRemote(key, call, md, st) {
  removeRemote(key, true);
  const [peer, sid] = key.split('|');
  const p = S.peers.get(peer);
  const r = { key, peer, sid, kind: md.kind === 'screen' ? 'screen' : 'mic', stream: st, call, label: String(md.label || 'Pantalla').slice(0, 40), hasAudio: !!md.audio, peerName: p && p.name, vol: 100 };
  if (r.kind === 'mic') {
    r.el = new Audio(); r.el.autoplay = true; r.el.srcObject = st; applySink(r.el);
    r.el.play().catch(() => toast('Tocá la pantalla para escuchar a los demás.'));
    try { const src = A.ctx.createMediaStreamSource(st); r.an = A.ctx.createAnalyser(); r.an.fftSize = 1024; src.connect(r.an); } catch (e) {}
  } else {
    sysMsg(`${p ? p.name : 'Alguien'} compartió ${r.label.toLowerCase()}.`);
    // si la tenía oculta (por ejemplo, se reconectó), se le vuelve a pedir que no la mande
    if (S.hidden.has(key)) try { p && p.conn.open && p.conn.send({ t: 'pause', sid, on: true }); } catch (e) {}
  }
  S.remote.set(key, r);
  applyVolume(r);
  renderTiles(); renderMembers();
}

function removeRemote(key, quiet) {
  const r = S.remote.get(key); if (!r) return;
  S.remote.delete(key);
  try { r.call && r.call.close(); } catch (e) {}
  if (r.el) { r.el.pause(); r.el.srcObject = null; }
  if (S.focus === key) S.focus = '';
  subLines.delete(key);
  if (!quiet) { renderTiles(); renderMembers(); }
}

/* =====================================================================
   COMPARTIR PANTALLA (varias a la vez)
   ===================================================================== */
async function shareScreen() {
  // el traductor de Chrome necesita un toque del usuario para bajarse la primera vez
  if (cfg.autoSub) chromeTranslator(cfg.subLang === 'multi' ? 'en' : cfg.subLang);
  let st;
  const qk = cfg.res, q = qual(qk);
  // el sonido de toda la PC se puede capturar una sola vez: si otra pantalla mía ya lo manda, esta no lo pide
  const sysAudioBusy = [...S.local.values()].some(l => l.kind === 'screen' && l.stream.getAudioTracks().length &&
    (l.stream.getVideoTracks()[0] || { getSettings: () => ({}) }).getSettings().displaySurface === 'monitor');
  const opts = audio => ({
    video: { frameRate: { ideal: q.fps, max: q.fps }, width: { ideal: q.w, max: q.w }, height: { ideal: q.h, max: q.h } },
    audio: audio ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false, suppressLocalAudioPlayback: false, restrictOwnAudio: true } : false,
    systemAudio: sysAudioBusy ? 'exclude' : 'include', selfBrowserSurface: 'exclude', surfaceSwitching: 'include', monitorTypeSurfaces: 'include',
  });
  try {
    st = await navigator.mediaDevices.getDisplayMedia(opts(true));
  } catch (e) {
    if (!e || e.name === 'NotAllowedError') return;   // canceló el cuadro de Chrome
    // a veces Chrome no deja capturar sonido otra vez: se comparte la imagen sin sonido
    try { st = await navigator.mediaDevices.getDisplayMedia(opts(false)); toast('Esta pantalla se comparte sin sonido (el sonido ya lo manda otra pantalla tuya).', 6000); }
    catch (e2) { if (e2 && e2.name !== 'NotAllowedError') toast('No se pudo compartir: ' + (e2.message || e.message) + '. Tocá de nuevo el botón de pantalla.', 7000); return; }
  }
  const v = st.getVideoTracks()[0];
  if (v) v.contentHint = cfg.quality === 'detail' ? 'detail' : 'motion';
  const surf = v && v.getSettings ? v.getSettings().displaySurface : '';
  S.shares++;
  const label = (surf === 'browser' ? 'Pestaña ' : surf === 'window' ? 'Ventana ' : 'Pantalla ') + S.shares;
  const ls = { sid: 's' + rand(6), kind: 'screen', stream: st, label, calls: new Map(), sub: null, q: qk, hint: cfg.quality };
  S.local.set(ls.sid, ls);
  if (v) v.addEventListener('ended', () => stopShare(ls.sid));
  S.peers.forEach((p, id) => callStream(id, ls));
  S.focus = '';   // se ven todas las pantallas juntas en cuadrícula
  const many = [...S.local.values()].filter(l => l.kind === 'screen').length;
  if (st.getAudioTracks().length) { if (cfg.autoSub) startSubs(ls); }
  else if (!sysAudioBusy) toast('Se comparte sin sonido. Para compartir el sonido elegí una pestaña o «Toda la pantalla» y marcá «Compartir audio».', 7000);
  if (many === 1) setTimeout(() => toast('¿Querés compartir otra cosa a la vez? Tocá de nuevo el botón de pantalla (+).', 6000), st.getAudioTracks().length ? 0 : 7500);
  renderBar(); renderTiles(); renderMembers();
}

function stopShare(sid) {
  const ls = S.local.get(sid); if (!ls || ls.kind !== 'screen') return;
  S.local.delete(sid);
  stopSubs(ls);
  ls.stream.getTracks().forEach(t => t.stop());
  ls.calls.forEach(c => { try { c.close(); } catch (e) {} });
  broadcast({ t: 'unshare', sid });
  const key = 'me|' + sid;
  subLines.delete(key);
  if (S.focus === key) S.focus = '';
  renderBar(); renderTiles(); renderMembers();
}

/* =====================================================================
   SUBTÍTULOS: Deepgram + traducción al español
   ===================================================================== */
const pickMime = () => ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';

function startSubs(ls) {
  if (ls.sub && ls.sub.on) return;
  if (!ls.stream.getAudioTracks().length) { toast('Esta pantalla no comparte sonido, no hay nada para subtitular.'); return; }
  if (!window.MediaRecorder) { toast('Este navegador no puede enviar el sonido para subtitular.'); return; }
  ls.sub = { on: true, ws: null, rec: null, seg: 0, tries: 0, ka: 0 };
  subConnect(ls);
  renderTiles();
}

function stopSubs(ls) {
  const sub = ls.sub; if (!sub) return;
  sub.on = false;
  subClose(sub);
  ls.sub = null;
  renderTiles();
}

function subClose(sub) {
  clearInterval(sub.ka);
  try { sub.rec && sub.rec.state !== 'inactive' && sub.rec.stop(); } catch (e) {}
  sub.rec = null;
  try { sub.ws && sub.ws.readyState < 2 && (sub.ws.send(JSON.stringify({ type: 'CloseStream' })), sub.ws.close()); } catch (e) {}
}

async function subConnect(ls) {
  const sub = ls.sub; if (!sub || !sub.on || !S.local.has(ls.sid)) return;
  let token;
  try {
    const r = await fetch(API + 'deepgram', { cache: 'no-store' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.token) throw new Error(d.error || ('error ' + r.status));
    token = d.token;
  } catch (e) {
    toast('No se pudieron activar los subtítulos: ' + e.message, 6000);
    stopSubs(ls); return;
  }
  if (!sub.on) return;
  const lang = cfg.subLang || 'multi';
  const q = new URLSearchParams({ model: 'nova-3', language: lang, smart_format: 'true', punctuate: 'true', interim_results: 'true', endpointing: '400' });
  const ws = new WebSocket('wss://api.deepgram.com/v1/listen?' + q, ['bearer', token]);
  sub.ws = ws;
  ws.onopen = () => {
    sub.tries = 0;
    const track = ls.stream.getAudioTracks()[0];
    if (!track || track.readyState === 'ended') return;
    const mime = pickMime();
    const rec = new MediaRecorder(new MediaStream([track]), mime ? { mimeType: mime, audioBitsPerSecond: 64000 } : {});
    sub.rec = rec;
    rec.ondataavailable = e => { if (e.data && e.data.size && ws.readyState === 1) ws.send(e.data); };
    rec.start(250);
    sub.ka = setInterval(() => { if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'KeepAlive' })); }, 8000);
  };
  ws.onmessage = ev => {
    let d; try { d = JSON.parse(ev.data); } catch (e) { return; }
    if (d.type !== 'Results') return;
    const alt = d.channel && d.channel.alternatives && d.channel.alternatives[0];
    const text = (alt && alt.transcript || '').trim();
    if (!text) return;
    const lg = (alt.languages && alt.languages[0]) || (lang === 'multi' ? '' : lang);
    onTranscript(ls, text, !!d.is_final, lg);
  };
  ws.onclose = ev => {
    if (sub.ws !== ws) return;
    clearInterval(sub.ka);
    try { sub.rec && sub.rec.state !== 'inactive' && sub.rec.stop(); } catch (e) {}
    if (!sub.on || !S.local.has(ls.sid)) return;
    sub.tries++;
    if (sub.tries > 6) { toast('Los subtítulos se cortaron (' + (ev.reason || ev.code) + ').', 6000); stopSubs(ls); return; }
    setTimeout(() => subConnect(ls), Math.min(10000, 800 * sub.tries));
  };
}

function onTranscript(ls, text, final, lg) {
  const sub = ls.sub; if (!sub) return;
  const seg = sub.seg;
  const es = lg ? lg.startsWith('es') : cfg.subLang === 'es';
  if (!final) { emitSub(ls.sid, seg, text, !es); return; }
  sub.seg++;
  if (es) { emitSub(ls.sid, seg, text, false); return; }
  emitSub(ls.sid, seg, text, true);
  translate(text, lg).then(t => emitSub(ls.sid, seg, t || text, false)).catch(() => emitSub(ls.sid, seg, text, false));
}

// primero el traductor que trae Chrome (en la misma PC, gratis y sin límite); si no hay, el del sitio
const chromeTr = {};
function chromeTranslator(from) {
  if (!('Translator' in self) || !/^[a-z]{2}$/.test(from) || from === 'es') return null;
  if (!chromeTr[from]) chromeTr[from] = Translator.availability({ sourceLanguage: from, targetLanguage: 'es' })
    .then(av => av === 'unavailable' ? null : Translator.create({ sourceLanguage: from, targetLanguage: 'es' }))
    .catch(e => { console.warn('traductor de Chrome', e); delete chromeTr[from]; return null; });
  return chromeTr[from];
}
async function translate(text, from) {
  from = (from || '').slice(0, 2);
  // si el traductor de Chrome no contesta en unos segundos, se sigue con el del sitio
  const limit = (p, ms) => Promise.race([p, new Promise(ok => setTimeout(() => ok(null), ms))]);
  const tr = await limit(chromeTranslator(from), 4000);
  if (tr) { try { const out = await limit(tr.translate(text), 4000); if (out) return out; } catch (e) { console.warn('traductor de Chrome', e); } }
  const r = await fetch(API + 'traducir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, from: (from || '').slice(0, 2) }) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || r.status);
  return d.text;
}

function emitSub(sid, seg, text, pend) {
  showSub('me|' + sid, seg, text, pend);
  broadcast({ t: 'sub', sid, seg, text, pend });
}

// renglones de subtítulos por cuadro: se ven los 2 últimos y se borran solos
const subLines = new Map();   // key -> Map(seg -> {text, pend, at})
function showSub(key, seg, text, pend) {
  let m = subLines.get(key); if (!m) subLines.set(key, m = new Map());
  m.set(seg, { text, pend, at: Date.now() });
  [...m.keys()].sort((a, b) => a - b).slice(0, -2).forEach(k => m.delete(k));
  paintSubs(key);
}
function paintSubs(key) {
  const tile = S.tiles.get(key); if (!tile) return;
  const box = tile.querySelector('.subs'); if (!box) return;
  const m = subLines.get(key);
  box.innerHTML = '';
  if (!cfg.subs || !m) return;
  [...m.entries()].sort((a, b) => a[0] - b[0]).forEach(([, l]) => {
    if (l.pend && cfg.subOnlyEs) return;   // texto en el idioma original mientras se traduce
    const s = document.createElement('span'); s.textContent = l.text; if (l.pend) s.className = 'pend'; box.appendChild(s);
  });
}
setInterval(() => {
  const now = Date.now();
  subLines.forEach((m, key) => {
    let ch = false;
    m.forEach((l, k) => { if (now - l.at > 7000) { m.delete(k); ch = true; } });
    if (ch) paintSubs(key);
  });
}, 1000);

/* =====================================================================
   MEDICIONES: ping de cada uno, pérdida de sonido y calidad de las pantallas
   ===================================================================== */
async function pairOf(pc) {
  const st = await pc.getStats();
  let pair = null;
  st.forEach(s => { if (s.type === 'transport' && s.selectedCandidatePairId) pair = st.get(s.selectedCandidatePairId); });
  if (!pair) st.forEach(s => { if (s.type === 'candidate-pair' && s.nominated && s.state === 'succeeded') pair = s; });
  if (!pair) return { st };
  const lc = st.get(pair.localCandidateId), rc = st.get(pair.remoteCandidateId);
  return { st, rtt: pair.currentRoundTripTime != null ? pair.currentRoundTripTime * 1000 : null, relay: (lc && lc.candidateType === 'relay') || (rc && rc.candidateType === 'relay') };
}

// velocidad en Mbps a partir de los bytes contados la vez anterior
const rate = (o, bytes, ts) => { const r = o.b != null && ts > o.t ? (bytes - o.b) * 8 / (ts - o.t) / 1000 : null; o.b = bytes; o.t = ts; return r; };
const LIMIT = { bandwidth: 'limitado por internet', cpu: 'limitado por la PC' };

async function statsTick() {
  if (!S.me || S.left) return;
  for (const p of S.peers.values()) {
    try {
      const pc = p.conn && p.conn.peerConnection; if (!pc) continue;
      const r = await pairOf(pc);
      p.rtt = r.rtt; p.relay = r.relay;
      const mic = S.remote.get(p.id + '|mic');
      const mpc = mic && mic.call && mic.call.peerConnection;
      if (mpc) {
        (await mpc.getStats()).forEach(s => {
          if (s.type !== 'inbound-rtp' || s.kind !== 'audio') return;
          const lost = s.packetsLost - (mic.pl ?? s.packetsLost), recv = s.packetsReceived - (mic.pr ?? s.packetsReceived);
          mic.pl = s.packetsLost; mic.pr = s.packetsReceived;
          p.loss = lost + recv > 0 ? Math.max(0, lost) / (lost + recv) * 100 : 0;
          p.jitter = (s.jitter || 0) * 1000;
        });
      }
      // cómo le llega MI voz a este amigo (lo informa su navegador)
      const myMic = S.local.get('mic'), oc = myMic && myMic.calls.get(p.id), opc = oc && oc.peerConnection;
      if (opc) {
        (await opc.getStats()).forEach(s => {
          if (s.type !== 'remote-inbound-rtp' || s.kind !== 'audio') return;
          p.outLoss = (s.fractionLost || 0) * 100;
          p.outJitter = (s.jitter || 0) * 1000;
        });
      }
    } catch (e) {}
  }
  voiceGuard();
  // pantallas que recibo
  for (const r of S.remote.values()) {
    if (r.kind !== 'screen' || !r.call || !r.call.peerConnection) continue;
    try {
      (await r.call.peerConnection.getStats()).forEach(s => {
        if (s.type !== 'inbound-rtp' || s.kind !== 'video') return;
        r.qi = { w: s.frameWidth, h: s.frameHeight, fps: s.framesPerSecond, mbps: rate(r.qr || (r.qr = {}), s.bytesReceived, s.timestamp) };
      });
    } catch (e) {}
  }
  // pantallas que mando (se mide con el primer amigo)
  for (const ls of S.local.values()) {
    if (ls.kind !== 'screen') continue;
    const call = ls.calls.values().next().value;
    if (!call || !call.peerConnection) { ls.qi = null; continue; }
    try {
      (await call.peerConnection.getStats()).forEach(s => {
        if (s.type !== 'outbound-rtp' || s.kind !== 'video') return;
        ls.qi = { w: s.frameWidth, h: s.frameHeight, fps: s.framesPerSecond, mbps: rate(ls.qr || (ls.qr = {}), s.bytesSent, s.timestamp), lim: LIMIT[s.qualityLimitationReason] || '' };
      });
    } catch (e) {}
  }
  paintStats();
}
setInterval(statsTick, 2000);

function paintStats() {
  document.querySelectorAll('[data-ping]').forEach(el => {
    const p = S.peers.get(el.dataset.ping);
    if (!p || p.rtt == null) { el.textContent = ''; el.title = ''; return; }
    const ms = Math.round(p.rtt), loss = p.loss || 0;
    const bad = ms > 250 || loss > 5, mid = ms > 120 || loss > 1;
    el.textContent = ms + ' ms' + (loss >= 1 ? ` · ${loss.toFixed(0)}% perdido` : '');
    el.className = 'ping ' + (bad ? 'bad' : mid ? 'mid' : 'good');
    el.title = `Ping: ${ms} ms\nSonido perdido: ${loss.toFixed(1)}%\nVariación (jitter): ${Math.round(p.jitter || 0)} ms\nConexión: ${p.relay ? 'por el servidor de respaldo (más lenta)' : 'directa'}`;
  });
  document.querySelectorAll('[data-q]').forEach(el => {
    const key = el.dataset.q;
    const o = key.startsWith('me|') ? (S.local.get(key.slice(3)) || {}).qi : (S.remote.get(key) || {}).qi;
    if (!o || !o.w) { el.textContent = ''; return; }
    const caps = Object.values(S.vcap), low = key.startsWith('me|') && caps.length ? Math.min(...caps) : 1;
    el.textContent = `${o.w}×${o.h} · ${Math.round(o.fps || 0)} fps` + (o.mbps != null ? ` · ${o.mbps.toFixed(1)} Mbps` : '') + (o.lim ? ` · ${o.lim}` : '') +
      (low < 0.95 ? ` · 🎙️ voz primero: calidad al ${Math.round(low * 100)}%` : '');
  });
}

/* =====================================================================
   DIBUJO
   ===================================================================== */
function render() { renderMembers(); renderTiles(); renderBar(); }

function renderBar() {
  const mic = $('#btnMic');
  mic.innerHTML = S.muted ? ICON.micOff : ICON.mic;
  mic.classList.toggle('off', S.muted);
  mic.dataset.tip = S.muted ? 'Activar micrófono (M)' : 'Silenciar (M)';
  const deaf = $('#btnDeaf');
  deaf.innerHTML = S.deaf ? ICON.headOff : ICON.head;
  deaf.classList.toggle('off', S.deaf);
  deaf.dataset.tip = S.deaf ? 'Volver a escuchar' : 'Ensordecer';
  const n = [...S.local.values()].filter(l => l.kind === 'screen').length;
  $('#btnShare').classList.toggle('act', n > 0);
  $('#btnShare').dataset.tip = n ? `Compartiendo ${n} — tocá para compartir otra a la vez` : 'Compartir pantalla';
  const c = $('#shareCount'); c.textContent = n ? n + '+' : ''; c.classList.toggle('hidden', !n);
}

function avatar(name, talkId, extra = '') {
  return `<div class="av ${extra}" data-talk="${esc(talkId)}" style="background:${colorOf(name)}">${esc((name || '?').trim().charAt(0).toUpperCase() || '?')}</div>`;
}

function renderMembers() {
  const box = $('#members');
  const list = [{ id: 'me', name: S.name + ' (vos)', muted: S.muted, deaf: S.deaf, live: [...S.local.values()].some(l => l.kind === 'screen'), me: true }];
  S.peers.forEach(p => list.push({ id: p.id, name: p.name, muted: p.muted, deaf: p.deaf, live: [...S.remote.values()].some(r => r.peer === p.id && r.kind === 'screen') }));
  // los de la lista que todavía no se conectaron
  S.roster.forEach(m => { if (S.me && m.id !== S.me.id && !S.peers.has(m.id) && !String(m.id).includes('-ver-')) list.push({ id: m.id, name: m.name, wait: true }); });
  box.innerHTML = list.map(m => `
    <div class="mem" data-id="${esc(m.id)}" ${m.wait ? 'style="opacity:.5" title="Conectando…"' : ''}>
      ${avatar(m.name, m.wait ? '' : m.id, talking.get(m.id) ? 'talk' : '')}
      <span class="nm">${esc(m.name)}${m.wait ? ' …' : ''}${!m.me && !m.wait ? `<span class="ping" data-ping="${esc(m.id)}"></span>` : ''}</span>
      ${m.live ? '<span class="live">EN VIVO</span>' : ''}
      <span class="ic">${m.muted ? ICON.micOff : ''}${m.deaf ? ICON.headOff : ''}</span>
    </div>
    ${!m.me && !m.wait ? `<div class="memvol">${ICON.vol} <input type="range" min="0" max="100" value="${cfg.vols[m.name] ?? 100}" data-vol="${esc(m.name)}" aria-label="Volumen de ${esc(m.name)}"></div>` : ''}
  `).join('');
  box.querySelectorAll('input[data-vol]').forEach(inp => inp.oninput = () => {
    cfg.vols[inp.dataset.vol] = +inp.value; saveCfg();
    S.remote.forEach(r => { if (r.kind === 'mic') applyVolume(r); });
  });
  $('#netState').title = S.reg ? 'Tenés la lista de la sala' : '';
  paintStats();
  paintPeople();
}

// lista de personas que se ve sobre una pantalla en pantalla completa (brillo verde = está hablando)
const PEOPLE_TIP = {
  all: 'Personas: se ven todos (tocá para ver solo quien habla)',
  talk: 'Personas: solo quien habla (tocá para ocultar)',
  off: 'Personas: ocultas (tocá para ver a todos)',
};
function paintPeople() {
  const list = [{ id: 'me', name: S.name, muted: S.muted }];
  S.peers.forEach(p => list.push({ id: p.id, name: p.name, muted: p.muted }));
  const html = list.map(m => `<div class="pchip${talking.get(m.id) ? ' talk' : ''}" data-talk="${esc(m.id)}">${avatar(m.name, '')}<span>${esc(m.name)}</span>${m.muted ? ICON.micOff : ''}</div>`).join('');
  const mode = cfg.fsPeople || 'all';
  document.querySelectorAll('.people').forEach(el => {
    el.className = 'people' + (mode === 'off' ? ' off' : mode === 'talk' ? ' onlytalk' : '');
    el.innerHTML = html;
  });
}

function userTile(id, name, muted) {
  const t = document.createElement('div');
  t.className = 'tile' + (talking.get(id) ? ' talk' : '');
  t.dataset.talk = id;
  t.innerHTML = `<div class="user">${avatar(name, '')}</div><div class="tag">${muted ? ICON.micOff : ''}<span>${esc(name)}</span>${id !== 'me' ? `<small class="ping" data-ping="${esc(id)}"></small>` : ''}</div>`;
  return t;
}

function screenTile(key, stream, title, mine, ls, r) {
  const t = document.createElement('div');
  t.className = 'tile';
  const v = document.createElement('video');
  v.autoplay = true; v.playsInline = true; v.srcObject = stream;
  v.muted = mine || S.deaf;
  if (r) { r.el = v; applyVolume(r); applySink(v); }
  t.appendChild(v);
  t.insertAdjacentHTML('beforeend', `<div class="badge">EN VIVO</div><div class="people"></div><div class="subs" style="--subsize:${cfg.subSize}"></div><div class="tag"><span>${esc(title)}</span><small class="qinfo" data-q="${esc(key)}"></small></div><div class="tools"></div>`);
  const tools = t.querySelector('.tools');
  const btn = (html, tip, fn, on) => { const b = document.createElement('button'); b.innerHTML = html; b.title = tip; if (on) b.classList.add('on'); b.onclick = e => { e.stopPropagation(); fn(); }; tools.appendChild(b); return b; };
  if (r && r.hasAudio) {
    const w = document.createElement('div'); w.className = 'vol';
    w.innerHTML = ICON.vol + `<input type="range" min="0" max="100" value="${r.vol}" aria-label="Volumen de la pantalla">`;
    w.querySelector('input').oninput = e => { r.vol = +e.target.value; applyVolume(r); };
    w.onclick = e => e.stopPropagation();
    tools.appendChild(w);
  }
  if (mine && ls.stream.getAudioTracks().length) {
    btn(ICON.cc, ls.sub ? 'Apagar subtítulos' : 'Subtitular esta pantalla', () => ls.sub ? stopSubs(ls) : startSubs(ls), !!ls.sub);
  }
  if (r) btn(ICON.eyeOff, 'Ocultar esta pantalla (deja de llegarte y libera internet)', () => hideScreen(key, true));
  btn(ICON.focus, S.focus === key ? 'Achicar' : 'Ver en grande', () => { S.focus = S.focus === key ? '' : key; renderTiles(); }, S.focus === key);
  // en pantalla completa: mostrar a todos, solo a quien habla, o a nadie
  const pb = btn(ICON.people, PEOPLE_TIP[cfg.fsPeople] || PEOPLE_TIP.all, () => {
    cfg.fsPeople = { all: 'talk', talk: 'off', off: 'all' }[cfg.fsPeople] || 'talk'; saveCfg();
    document.querySelectorAll('.tools .pbtn').forEach(b => b.title = PEOPLE_TIP[cfg.fsPeople]);
    paintPeople();
    toast({ all: '👥 Se ven todos los de la sala', talk: '🎙️ Se ve solo quien está hablando', off: 'Lista de personas oculta' }[cfg.fsPeople], 2000);
  });
  pb.classList.add('pbtn');
  btn(ICON.full, 'Pantalla completa', () => { document.fullscreenElement ? document.exitFullscreen() : t.requestFullscreen && t.requestFullscreen().catch(() => {}); });
  if (mine) btn(ICON.stop, 'Dejar de compartir', () => stopShare(ls.sid));
  if (mine && ls.sub) t.insertAdjacentHTML('beforeend', '<div class="badge cc">CC subtitulando</div>');
  t.ondblclick = () => { document.fullscreenElement ? document.exitFullscreen() : t.requestFullscreen && t.requestFullscreen().catch(() => {}); };
  v.play().catch(() => {
    const b = document.createElement('button'); b.className = 'btn playbtn'; b.textContent = '▶ Ver';
    b.onclick = e => { e.stopPropagation(); v.play(); b.remove(); }; t.appendChild(b);
  });
  return t;
}

function renderTiles() {
  // no rehacer un cuadro que está en pantalla completa
  if (document.fullscreenElement && [...S.tiles.values()].includes(document.fullscreenElement)) { S.tiles.forEach((t, k) => paintSubs(k)); return; }
  const big = $('#big'), strip = $('#strip');
  const keep = new Map(S.tiles);
  S.tiles.clear();
  const screens = [];
  S.local.forEach(ls => { if (ls.kind === 'screen') screens.push({ key: 'me|' + ls.sid, title: `${ls.label} — vos`, mine: true, ls, stream: ls.stream }); });
  const hidden = [];
  S.remote.forEach(r => {
    if (r.kind !== 'screen') return;
    const p = S.peers.get(r.peer), s = { key: r.key, title: `${r.label} — ${p ? p.name : '?'}`, r, stream: r.stream };
    (S.hidden.has(r.key) ? hidden : screens).push(s);
  });
  if (S.focus && !screens.some(s => s.key === S.focus)) S.focus = '';
  const users = [{ id: 'me', name: S.name, muted: S.muted }];
  S.peers.forEach(p => users.push({ id: p.id, name: p.name, muted: p.muted }));

  const mk = s => {
    // si el cuadro no cambió se reutiliza tal cual (así el video no parpadea)
    const sig = JSON.stringify([s.title, S.focus === s.key, !!(s.ls && s.ls.sub), s.stream.id, cfg.subSize]);
    let t = keep.get(s.key);
    if (!t || t._sig !== sig) { t = screenTile(s.key, s.stream, s.title, !!s.mine, s.ls, s.r); t._sig = sig; }
    keep.delete(s.key);
    S.tiles.set(s.key, t); return t;
  };
  big.innerHTML = ''; strip.innerHTML = '';
  let main;
  if (S.focus) main = [screens.find(s => s.key === S.focus)];
  else if (screens.length) main = screens;
  else main = null;
  if (main) {
    main.forEach(s => big.appendChild(mk(s)));
    screens.filter(s => !main.includes(s)).forEach(s => strip.appendChild(mk(s)));
    users.forEach(u => strip.appendChild(userTile(u.id, u.name, u.muted)));
  } else {
    users.forEach(u => big.appendChild(userTile(u.id, u.name, u.muted)));
  }
  // pantallas ocultas: un cuadrito con el botón para volver a verlas
  hidden.forEach(s => {
    const t = document.createElement('div');
    t.className = 'tile hiddenscr';
    t.innerHTML = `<div class="user"><button class="btn ghost">${ICON.eye} Mostrar</button></div><div class="tag"><span>${esc(s.title)} (oculta)</span></div>`;
    t.querySelector('button').onclick = () => hideScreen(s.key, false);
    strip.prepend(t);
  });
  // los cuadros que ya no están sueltan su video
  keep.forEach(t => { const v = t.querySelector('video'); if (v) v.srcObject = null; });
  const n = big.children.length;
  const wide = big.clientWidth > big.clientHeight * 1.2;
  const cols = n <= 1 ? 1 : wide ? Math.ceil(Math.sqrt(n * 1.5)) : Math.ceil(Math.sqrt(n / 1.5));
  big.style.gridTemplateColumns = `repeat(${Math.min(cols, n)}, minmax(0,1fr))`;
  big.style.gridAutoRows = `minmax(0,1fr)`;
  // los cuadros de pantalla se pueden tocar para agrandar
  S.tiles.forEach((t, k) => { t.onclick = () => { if (S.focus !== k) { S.focus = k; renderTiles(); } }; paintSubs(k); });
  paintPeople();
}
window.addEventListener('resize', () => { clearTimeout(window._rt); window._rt = setTimeout(renderTiles, 150); });
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) renderTiles(); });

/* ---------------- chat ---------------- */
function addMsg(who, text, mine) {
  const box = $('#msgs');
  const d = document.createElement('div'); d.className = 'msg';
  const time = new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  d.innerHTML = `<div class="who" style="color:${mine ? 'var(--text)' : colorOf(who).replace('45%', '70%')}">${esc(who)}<small>${time}</small></div><div class="tx"></div>`;
  d.querySelector('.tx').textContent = text;
  box.appendChild(d); box.scrollTop = box.scrollHeight;
  if ($('#chat').classList.contains('hidden') && !mine) { S.unread++; const u = $('#unread'); u.textContent = S.unread; u.classList.remove('hidden'); }
}
function sysMsg(text) {
  const box = $('#msgs');
  const d = document.createElement('div'); d.className = 'msg sys'; d.textContent = text;
  box.appendChild(d); box.scrollTop = box.scrollHeight;
}

/* ---------------- ajustes ---------------- */
let dlgOpen = false;
async function fillMics() {
  const sel = $('#setMic');
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    const ins = all.filter(d => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications');
    const now = A.micLabel ? ` — ahora: ${A.micLabel}` : '';
    sel.innerHTML = `<option value="">Automático (cambia solo al conectar un auricular)${esc(now)}</option>` +
      ins.map((d, i) => `<option value="${esc(d.deviceId)}">${HEADSET.test(d.label) ? '🎧 ' : ''}${esc(d.label || 'Micrófono ' + (i + 1))}</option>`).join('');
    sel.value = cfg.mic;
    // salida: solo si el navegador deja elegirla y hay más de una
    const outs = all.filter(d => d.kind === 'audiooutput' && d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications');
    const show = canSink && outs.length > 0;
    $('#outBox').classList.toggle('hidden', !show);
    if (show) {
      $('#setOut').innerHTML = '<option value="">Automático (el del sistema)</option>' +
        outs.map((d, i) => `<option value="${esc(d.deviceId)}">${HEADSET.test(d.label) ? '🎧 ' : ''}${esc(d.label || 'Salida ' + (i + 1))}</option>`).join('');
      $('#setOut').value = outs.some(d => d.deviceId === cfg.out) ? cfg.out : '';
    }
  } catch (e) {}
}
function openSettings() {
  fillMics();
  $('#setName').value = S.name;
  document.querySelectorAll('input[name=ns]').forEach(r => r.checked = r.value === cfg.ns);
  document.querySelectorAll('input[name=bt]').forEach(r => r.checked = r.value === (cfg.btMode || 'both'));
  $('#setGate').value = cfg.gate;
  $('#setLoop').checked = A.loop;
  $('#setQuality').value = cfg.quality;
  $('#setRes').value = QUAL[cfg.res] ? cfg.res : 'q1080';
  $('#setVoiceFirst').checked = cfg.voiceFirst !== false;
  $('#setAutoSub').checked = cfg.autoSub;
  $('#setSubLang').value = cfg.subLang;
  $('#setSubs').checked = cfg.subs;
  $('#setSubOnlyEs').checked = !!cfg.subOnlyEs;
  $('#setSubSize').value = cfg.subSize;
  $('#dlgSet').showModal(); dlgOpen = true;
}
$('#dlgSet').addEventListener('close', () => {
  dlgOpen = false;
  if (A.loop) { A.loop = false; try { A.gate.disconnect(A.ctx.destination); } catch (e) {} }
  const nm = $('#setName').value.trim().slice(0, 24);
  if (nm && nm !== S.name) { S.name = nm; cfg.name = nm; saveCfg(); broadcast({ t: 'hi', name: nm, muted: S.muted, deaf: S.deaf }); if (S.regConn && S.regConn.open) S.regConn.send({ t: 'hello', name: nm }); render(); }
});
$('#btnSetOk').onclick = () => $('#dlgSet').close();
$('#setMic').onchange = async e => {
  cfg.mic = e.target.value; saveCfg();
  try { await micOpen(cfg.mic || await autoMicId()); fillMics(); } catch (x) { toast('No se pudo usar ese micrófono.'); }
};
document.querySelectorAll('input[name=bt]').forEach(r => r.onchange = async () => {
  cfg.btMode = r.value; saveCfg();
  if (!cfg.mic) { try { await micOpen(await autoMicId()); fillMics(); } catch (e) {} }
});
$('#setOut').onchange = e => { cfg.out = e.target.value; saveCfg(); applySinkAll(); };
document.querySelectorAll('input[name=ns]').forEach(r => r.onchange = async () => {
  const prev = cfg.ns; cfg.ns = r.value; saveCfg();
  try { if ((prev === 'nav') !== (cfg.ns === 'nav')) await micOpen(); else await micWire(); } catch (e) { toast('No se pudo cambiar: ' + e.message); }
});
$('#setGate').oninput = e => { cfg.gate = +e.target.value; saveCfg(); };
$('#setLoop').onchange = e => {
  A.loop = e.target.checked;
  try { A.loop ? A.gate.connect(A.ctx.destination) : A.gate.disconnect(A.ctx.destination); } catch (x) {}
};
$('#setQuality').onchange = e => { cfg.quality = e.target.value; saveCfg(); };
$('#setVoiceFirst').onchange = e => { cfg.voiceFirst = e.target.checked; saveCfg(); voiceGuard(); };
$('#setRes').onchange = e => {
  cfg.res = e.target.value; saveCfg();
  if ([...S.local.values()].some(l => l.kind === 'screen')) toast('La calidad nueva se usa en la próxima pantalla que compartas.');
};
$('#setAutoSub').onchange = e => { cfg.autoSub = e.target.checked; saveCfg(); };
$('#setSubLang').onchange = e => {
  cfg.subLang = e.target.value; saveCfg();
  // reinicia los subtítulos que estén andando con el idioma nuevo
  S.local.forEach(ls => { if (ls.sub && ls.sub.on) { subClose(ls.sub); } });
};
$('#setSubs').onchange = e => { cfg.subs = e.target.checked; saveCfg(); S.tiles.forEach((t, k) => paintSubs(k)); };
$('#setSubOnlyEs').onchange = e => { cfg.subOnlyEs = e.target.checked; saveCfg(); S.tiles.forEach((t, k) => paintSubs(k)); };
$('#setSubSize').onchange = e => { cfg.subSize = e.target.value; saveCfg(); document.querySelectorAll('.subs').forEach(s => s.style.setProperty('--subsize', cfg.subSize)); };

/* ---------------- botones ---------------- */
$('#btnMic').onclick = () => { if (S.deaf) setDeaf(false); else setMuted(!S.muted); };
$('#btnDeaf').onclick = () => setDeaf(!S.deaf);
$('#btnShare').onclick = shareScreen;
$('#btnSet').onclick = openSettings;
$('#btnSide').onclick = () => $('#side').classList.toggle('open');
const toggleChat = show => {
  $('#chat').classList.toggle('hidden', !show);
  if (show) { S.unread = 0; $('#unread').classList.add('hidden'); setTimeout(() => $('#chatIn').focus(), 50); }
  renderTiles();
};
$('#btnChat').onclick = () => toggleChat($('#chat').classList.contains('hidden'));
$('#btnChatClose').onclick = () => toggleChat(false);
$('#chatForm').onsubmit = e => {
  e.preventDefault();
  const text = $('#chatIn').value.trim(); if (!text) return;
  $('#chatIn').value = '';
  addMsg(S.name, text, true);
  broadcast({ t: 'chat', text });
};
$('#btnInvite').onclick = async () => {
  const link = location.origin + location.pathname + '?sala=' + S.room;
  try { await navigator.clipboard.writeText(link); toast('Invitación copiada: ' + link); }
  catch (e) { prompt('Copiá este link:', link); }
};
$('#btnLeave').onclick = () => {
  S.left = true;
  S.local.forEach(ls => { if (ls.kind === 'screen') stopShare(ls.sid); });
  try { S.me && S.me.destroy(); } catch (e) {}
  try { S.reg && (clearInterval(S.reg._iv), S.reg.destroy()); } catch (e) {}
  location.href = location.pathname + '?sala=' + S.room;
};
document.addEventListener('keydown', e => {
  if (e.target.matches('input,textarea,select') || $('#room').classList.contains('hidden')) return;
  if (e.key === 'm' || e.key === 'M') $('#btnMic').click();
});
window.addEventListener('pagehide', () => { try { S.me && S.me.destroy(); S.reg && S.reg.destroy(); } catch (e) {} });

/* =====================================================================
   APP: instalar, avisar versión nueva y seguir hablando con el celular minimizado
   ===================================================================== */
const MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
const IOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (!standalone()) $('#installBox').classList.remove('hidden'); });
window.addEventListener('appinstalled', () => { installEvt = null; $('#installBox').classList.add('hidden'); toast('¡Listo! Salas de Voz quedó instalada con su ícono.'); });
if (MOBILE && !standalone()) $('#installBox').classList.remove('hidden');
$('#btnInstall').onclick = async () => {
  if (installEvt) {
    installEvt.prompt();
    await installEvt.userChoice.catch(() => {});
    installEvt = null; return;
  }
  if (IOS) toast('En iPhone: abrí esta página en Safari, tocá Compartir ⬆️ y elegí «Agregar a pantalla de inicio».', 9000);
  else toast('Abrí esta página en Chrome, tocá el menú ⋮ y elegí «Instalar app» o «Agregar a pantalla principal».', 9000);
};
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

// si se publica una versión nueva mientras la página está abierta, se avisa (no se recarga sola para no cortar la llamada)
(function () {
  let first = null;
  const check = () => fetch('app.js', { method: 'HEAD', cache: 'no-store' }).then(r => {
    const tag = r.headers.get('etag') || r.headers.get('last-modified'); if (!tag) return;
    if (first === null) first = tag; else if (tag !== first) $('#update').classList.remove('hidden');
  }).catch(() => {});
  check(); setInterval(check, 3 * 60e3);
})();
$('#update').onclick = () => {
  if (S.me && !S.left) $('#btnLeave').click();
  else location.reload();
};

// En el celular, con la app minimizada el sistema puede frenar el procesamiento de sonido de la página:
// mientras está minimizada se manda el micrófono directo (con el filtro del propio celular) y al volver
// se pone de nuevo el quitado de ruido inteligente.
let bgRaw = false;
function micSenders() {
  const ls = S.local.get('mic'); if (!ls) return [];
  return [...ls.calls.values()].flatMap(c => c.peerConnection ? c.peerConnection.getSenders().filter(s => s.track && s.track.kind === 'audio') : []);
}
function bgVoice(hidden) {
  if (!MOBILE || !A.raw || !A.dest || !S.me || S.left) return;
  const raw = A.raw.getAudioTracks()[0], proc = A.dest.stream.getAudioTracks()[0];
  if (!raw || !proc || bgRaw === hidden) return;
  bgRaw = hidden;
  raw.enabled = hidden ? !S.muted : true;
  micSenders().forEach(s => s.replaceTrack(hidden ? raw : proc).catch(() => {}));
  if (!hidden && A.ctx.state === 'suspended') A.ctx.resume().catch(() => {});
}
document.addEventListener('visibilitychange', () => bgVoice(document.hidden));

// controles en la notificación del celular / teclas multimedia
function mediaSession() {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({ title: 'Salas de Voz', artist: $('#roomName').textContent, artwork: [{ src: 'icon-512.png', sizes: '512x512', type: 'image/png' }] });
    navigator.mediaSession.playbackState = 'playing';
  } catch (e) {}
  const set = (a, f) => { try { navigator.mediaSession.setActionHandler(a, f); } catch (e) {} };
  set('togglemicrophone', () => $('#btnMic').click());
  set('hangup', () => $('#btnLeave').click());
  set('pause', () => {});   // que «pausa» no corte el sonido de los amigos
  set('play', () => {});
}
function mediaMic() { try { navigator.mediaSession && navigator.mediaSession.setMicrophoneActive && navigator.mediaSession.setMicrophoneActive(!S.muted); } catch (e) {} }

// para revisar desde la consola
window.SALA = { S, A, cfg, voiceGuard };

// botón 🏠 de todos los juegos (../inicio.js): si estás en una sala, primero se sale bien
window.INICIO = {
  enJuego: () => !!S.me && !S.left,
  pregunta: '¿Salir de la sala de voz y volver a todos los juegos?',
  salir() {
    S.left = true;
    S.local.forEach(ls => { if (ls.kind === 'screen') stopShare(ls.sid); });
    try { S.me && S.me.destroy(); } catch (e) {}
    try { S.reg && (clearInterval(S.reg._iv), S.reg.destroy()); } catch (e) {}
  },
};
