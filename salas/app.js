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
const API = 'https://juegosdemesapy.pages.dev/api/';
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
  focus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="13" rx="2"/><path d="M7 21h10"/></svg>',
  stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  vol: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>',
  cc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M10 10.5a2.5 2.5 0 1 0 0 3M17 10.5a2.5 2.5 0 1 0 0 3"/></svg>',
};

/* ---------------- ajustes guardados ---------------- */
const cfg = Object.assign({
  name: '', mic: '', ns: 'ia', gate: -58, quality: 'motion', autoSub: true, subLang: 'multi', subs: true, subSize: '1', vols: {},
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
};
const regId = () => PFX + S.room + '-reg';

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
    b.innerHTML = `<span style="color:var(--muted)">🔊</span>${esc(name)}`;
    b.dataset.id = id;
    b.onclick = () => { pick = id; $('#inRoom').value = ''; mark(); };
    box.appendChild(b);
  });
  if (!ROOMS.some(r => r[0] === pick)) $('#inRoom').value = pick;
  const mark = () => box.querySelectorAll('button').forEach(b => b.classList.toggle('sel', !$('#inRoom').value.trim() && b.dataset.id === pick));
  $('#inRoom').oninput = mark;
  mark();
  const go = () => {
    const name = $('#inName').value.trim();
    const err = $('#homeErr');
    if (!name) { err.textContent = 'Escribí tu nombre.'; err.classList.remove('hidden'); $('#inName').focus(); return; }
    const room = slug($('#inRoom').value) || pick;
    cfg.name = name; saveCfg();
    enter(name, room).catch(e => {
      console.error(e);
      err.textContent = 'No se pudo entrar: ' + (e && e.message || e); err.classList.remove('hidden');
    });
  };
  $('#btnEnter').onclick = go;
  $('#inName').onkeydown = $('#inRoom').onkeydown = e => { if (e.key === 'Enter') go(); };
  if (!navigator.mediaDevices || !window.RTCPeerConnection) {
    $('#homeErr').textContent = 'Este navegador no permite llamadas. Usá Chrome, Edge o Firefox actualizados.';
    $('#homeErr').classList.remove('hidden');
  }
})();

async function enter(name, room) {
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
  const nice = (ROOMS.find(r => r[0] === room) || [0, room])[1];
  $('#roomName').textContent = nice;
  document.title = nice + ' · Salas de Voz';
  if (!navigator.mediaDevices.getDisplayMedia) $('#btnShare').classList.add('hidden');
  S.local.set('mic', { sid: 'mic', kind: 'mic', stream: A.dest.stream, label: 'voz', calls: new Map() });
  renderBar(); render();
  netStart();
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
  if (A.ctx.state === 'suspended') await A.ctx.resume();
  setInterval(gateTick, 20);
  setInterval(talkTick, 120);
  navigator.mediaDevices.addEventListener && navigator.mediaDevices.addEventListener('devicechange', fillMics);
}

async function micOpen() {
  const want = { echoCancellation: true, noiseSuppression: cfg.ns === 'nav', autoGainControl: true, channelCount: 1 };
  let raw;
  try { raw = await navigator.mediaDevices.getUserMedia({ audio: cfg.mic ? { ...want, deviceId: { exact: cfg.mic } } : want }); }
  catch (e) {
    if (!cfg.mic || e.name === 'NotAllowedError') throw e;
    cfg.mic = ''; saveCfg();   // el micrófono elegido ya no está: se usa el normal
    raw = await navigator.mediaDevices.getUserMedia({ audio: want });
  }
  if (A.raw) A.raw.getTracks().forEach(t => t.stop());
  A.raw = raw;
  await micWire();
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
  else if (A.open && now - A.lastLoud > 400) A.open = false;
  const on = A.open && !S.muted;
  const t = A.ctx.currentTime;
  A.gate.gain.setTargetAtTime(on ? 1 : 0, t, on ? 0.008 : 0.06);
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
  const send = () => {
    const list = [...members].map(([id, m]) => ({ id, name: m.name }));
    members.forEach(m => { try { m.conn.open && m.conn.send({ t: 'list', list }); } catch (e) {} });
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
      else { const m = members.get(c.peer); if (m) m.seen = Date.now(); }
    });
    c.on('close', () => { const m = members.get(c.peer); if (m && m.conn === c) { members.delete(c.peer); send(); } });
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
  }
}

/* ---------------- llamadas (una por transmisión) ---------------- */
function callStream(pid, ls) {
  if (!S.me || !ls.stream) return;
  const old = ls.calls.get(pid); if (old) { try { old.close(); } catch (e) {} }
  const call = S.me.call(pid, ls.stream, { metadata: { kind: ls.kind, sid: ls.sid, label: ls.label, audio: ls.stream.getAudioTracks().length > 0 } });
  if (!call) return;
  ls.calls.set(pid, call);
  const pc = call.peerConnection;
  if (pc) pc.addEventListener('connectionstatechange', () => { if (pc.connectionState === 'connected') tune(pc, ls.kind); });
  call.on('close', () => { if (ls.calls.get(pid) === call) ls.calls.delete(pid); });
  call.on('error', e => console.warn('call', e));
}

// más calidad para las pantallas y su sonido
function tune(pc, kind) {
  pc.getSenders().forEach(s => {
    if (!s.track) return;
    const p = s.getParameters(); if (!p.encodings || !p.encodings.length) p.encodings = [{}];
    if (s.track.kind === 'video') {
      p.encodings[0].maxBitrate = cfg.quality === 'detail' ? 2_500_000 : 3_000_000;
      p.encodings[0].maxFramerate = 30;
      p.degradationPreference = cfg.quality === 'detail' ? 'maintain-resolution' : 'maintain-framerate';
    } else p.encodings[0].maxBitrate = kind === 'screen' ? 128_000 : 64_000;
    s.setParameters(p).catch(() => {});
  });
}

function onCall(call) {
  const md = call.metadata || {};
  const sid = String(md.sid || 'mic');
  const key = call.peer + '|' + sid;
  call.answer();
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
    r.el = new Audio(); r.el.autoplay = true; r.el.srcObject = st;
    r.el.play().catch(() => toast('Tocá la pantalla para escuchar a los demás.'));
    try { const src = A.ctx.createMediaStreamSource(st); r.an = A.ctx.createAnalyser(); r.an.fftSize = 1024; src.connect(r.an); } catch (e) {}
  } else {
    if (!S.focus) S.focus = key;
    sysMsg(`${p ? p.name : 'Alguien'} compartió ${r.label.toLowerCase()}.`);
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
  let st;
  try {
    st = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 30, max: 60 }, width: { max: 1920 }, height: { max: 1080 } },
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, suppressLocalAudioPlayback: false, restrictOwnAudio: true },
      systemAudio: 'include', selfBrowserSurface: 'exclude', surfaceSwitching: 'include', monitorTypeSurfaces: 'include',
    });
  } catch (e) {
    if (e && e.name !== 'NotAllowedError') toast('No se pudo compartir: ' + e.message);
    return;
  }
  const v = st.getVideoTracks()[0];
  if (v) v.contentHint = cfg.quality === 'detail' ? 'detail' : 'motion';
  const surf = v && v.getSettings ? v.getSettings().displaySurface : '';
  S.shares++;
  const label = (surf === 'browser' ? 'Pestaña ' : surf === 'window' ? 'Ventana ' : 'Pantalla ') + S.shares;
  const ls = { sid: 's' + rand(6), kind: 'screen', stream: st, label, calls: new Map(), sub: null };
  S.local.set(ls.sid, ls);
  if (v) v.addEventListener('ended', () => stopShare(ls.sid));
  S.peers.forEach((p, id) => callStream(id, ls));
  S.focus = 'me|' + ls.sid;
  if (st.getAudioTracks().length) { if (cfg.autoSub) startSubs(ls); }
  else toast('Se comparte sin sonido. Para compartir el sonido elegí una pestaña o «Toda la pantalla» y marcá «Compartir audio».', 7000);
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

async function translate(text, from) {
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
  $('#btnShare').dataset.tip = n ? 'Compartir otra pantalla' : 'Compartir pantalla';
  const c = $('#shareCount'); c.textContent = n; c.classList.toggle('hidden', n < 2);
}

function avatar(name, talkId, extra = '') {
  return `<div class="av ${extra}" data-talk="${esc(talkId)}" style="background:${colorOf(name)}">${esc((name || '?').trim().charAt(0).toUpperCase() || '?')}</div>`;
}

function renderMembers() {
  const box = $('#members');
  const list = [{ id: 'me', name: S.name + ' (vos)', muted: S.muted, deaf: S.deaf, live: [...S.local.values()].some(l => l.kind === 'screen'), me: true }];
  S.peers.forEach(p => list.push({ id: p.id, name: p.name, muted: p.muted, deaf: p.deaf, live: [...S.remote.values()].some(r => r.peer === p.id && r.kind === 'screen') }));
  // los de la lista que todavía no se conectaron
  S.roster.forEach(m => { if (S.me && m.id !== S.me.id && !S.peers.has(m.id)) list.push({ id: m.id, name: m.name, wait: true }); });
  box.innerHTML = list.map(m => `
    <div class="mem" data-id="${esc(m.id)}" ${m.wait ? 'style="opacity:.5" title="Conectando…"' : ''}>
      ${avatar(m.name, m.wait ? '' : m.id, talking.get(m.id) ? 'talk' : '')}
      <span class="nm">${esc(m.name)}${m.wait ? ' …' : ''}</span>
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
}

function userTile(id, name, muted) {
  const t = document.createElement('div');
  t.className = 'tile' + (talking.get(id) ? ' talk' : '');
  t.dataset.talk = id;
  t.innerHTML = `<div class="user">${avatar(name, '')}</div><div class="tag">${muted ? ICON.micOff : ''}<span>${esc(name)}</span></div>`;
  return t;
}

function screenTile(key, stream, title, mine, ls, r) {
  const t = document.createElement('div');
  t.className = 'tile';
  const v = document.createElement('video');
  v.autoplay = true; v.playsInline = true; v.srcObject = stream;
  v.muted = mine || S.deaf;
  if (r) { r.el = v; applyVolume(r); }
  t.appendChild(v);
  t.insertAdjacentHTML('beforeend', `<div class="badge">EN VIVO</div><div class="subs" style="--subsize:${cfg.subSize}"></div><div class="tag"><span>${esc(title)}</span></div><div class="tools"></div>`);
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
  btn(ICON.focus, S.focus === key ? 'Achicar' : 'Ver en grande', () => { S.focus = S.focus === key ? '' : key; renderTiles(); }, S.focus === key);
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
  S.remote.forEach(r => { if (r.kind === 'screen') { const p = S.peers.get(r.peer); screens.push({ key: r.key, title: `${r.label} — ${p ? p.name : '?'}`, r, stream: r.stream }); } });
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
  // los cuadros que ya no están sueltan su video
  keep.forEach(t => { const v = t.querySelector('video'); if (v) v.srcObject = null; });
  const n = big.children.length;
  const wide = big.clientWidth > big.clientHeight * 1.2;
  const cols = n <= 1 ? 1 : wide ? Math.ceil(Math.sqrt(n * 1.5)) : Math.ceil(Math.sqrt(n / 1.5));
  big.style.gridTemplateColumns = `repeat(${Math.min(cols, n)}, minmax(0,1fr))`;
  big.style.gridAutoRows = `minmax(0,1fr)`;
  // los cuadros de pantalla se pueden tocar para agrandar
  S.tiles.forEach((t, k) => { t.onclick = () => { if (S.focus !== k) { S.focus = k; renderTiles(); } }; paintSubs(k); });
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
    const devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput');
    sel.innerHTML = '<option value="">El del sistema</option>' + devs.filter(d => d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications')
      .map((d, i) => `<option value="${esc(d.deviceId)}">${esc(d.label || 'Micrófono ' + (i + 1))}</option>`).join('');
    sel.value = cfg.mic;
  } catch (e) {}
}
function openSettings() {
  fillMics();
  $('#setName').value = S.name;
  document.querySelectorAll('input[name=ns]').forEach(r => r.checked = r.value === cfg.ns);
  $('#setGate').value = cfg.gate;
  $('#setLoop').checked = A.loop;
  $('#setQuality').value = cfg.quality;
  $('#setAutoSub').checked = cfg.autoSub;
  $('#setSubLang').value = cfg.subLang;
  $('#setSubs').checked = cfg.subs;
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
$('#setMic').onchange = async e => { cfg.mic = e.target.value; saveCfg(); try { await micOpen(); } catch (x) { toast('No se pudo usar ese micrófono.'); } };
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
$('#setAutoSub').onchange = e => { cfg.autoSub = e.target.checked; saveCfg(); };
$('#setSubLang').onchange = e => {
  cfg.subLang = e.target.value; saveCfg();
  // reinicia los subtítulos que estén andando con el idioma nuevo
  S.local.forEach(ls => { if (ls.sub && ls.sub.on) { subClose(ls.sub); } });
};
$('#setSubs').onchange = e => { cfg.subs = e.target.checked; saveCfg(); S.tiles.forEach((t, k) => paintSubs(k)); };
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

// para revisar desde la consola
window.SALA = { S, A, cfg };
