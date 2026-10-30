/* =====================================================================
   Sala de Karaoke
   - Conexión entre aparatos con PeerJS (cada uno se conecta con todos),
     igual que las Salas de Voz. El primero que entra guarda la lista de la
     sala y también «la verdad» de lo que suena: video, posición y cola
     (id «karapy26-<sala>-reg»). Si se va, otro toma su lugar con lo último.
   - Sincronización: cada aparato mide la diferencia de su reloj con el de la
     lista (ida y vuelta, como NTP) y calcula en qué segundo tiene que estar
     el video. Si se corre más de 0,2 s salta al lugar justo (aprendiendo
     cuánto tarda YouTube en saltar); las diferencias chicas se corrigen
     cambiando apenas la velocidad, si el video lo permite.
   - «Juntar con quien canta»: quien escucha atrasa su video lo mismo que
     tarda en llegarle la voz del cantante, así voz y música caen juntas.
   - Voz: filtro, compresor, eco, reverberación y cambio de tono (Web Audio).
   ===================================================================== */
const PFX = 'karapy26-';
const API = (/(^|\.)juegospy\.com$|\.pages\.dev$/.test(location.hostname) ? '/api/' : 'https://juegosdemesapy.pages.dev/api/');   // el servidor del mismo sitio (desde GitHub, el de Cloudflare)
const ROOMS = [['karaoke', 'Karaoke General', '🎤'], ['clasicos', 'Clásicos y Baladas', '💿'], ['cumbia', 'Cumbia y Polca', '🪗'], ['rock', 'Rock y Pop', '🎸']];
const $ = s => document.querySelector(s);
const rand = n => Math.random().toString(36).slice(2, 2 + n).padEnd(n, '0');
const slug = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const colorOf = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return `hsl(${h % 360} 60% 45%)`; };
const now = () => performance.timeOrigin + performance.now();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = t => { t = Math.max(0, Math.floor(t || 0)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
const okVid = v => typeof v === 'string' && /^[\w-]{11}$/.test(v);
const thumb = v => `https://i.ytimg.com/vi/${v}/mqdefault.jpg`;
const ytId = s => { const m = String(s).match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/); return m ? m[1] : ''; };

/* ---------------- ajustes guardados ---------------- */
const cfg = Object.assign({
  name: '', mic: '', phones: false, fx: 'karaoke', echo: 35, rev: 30, pitch: 0, vvol: 100, monitor: false,
  music: 80, voices: 100, align: true, onlyK: true, vols: {}, tune: 'off',
}, (() => { try { return JSON.parse(localStorage.getItem('karaoke_cfg') || '{}'); } catch (e) { return {}; } })());
const saveCfg = () => { try { localStorage.setItem('karaoke_cfg', JSON.stringify(cfg)); } catch (e) {} };

/* ---------------- estado ---------------- */
const EMPTY = () => ({ v: 0, sid: '', vid: '', title: '', by: '', playing: false, pos: 0, at: 0, queue: [] });
const S = {
  room: '', name: '', me: null, reg: null, regConn: null, regTimer: 0, left: false,
  roster: [], peers: new Map(), pending: new Map(),
  calls: new Map(),        // amigo -> mi llamada de voz hacia él
  remote: new Map(),       // amigo -> {peer, call, el, an, lat, jb}
  mode: 'mute', st: EMPTY(), unread: 0, tab: 'songs',
};
const regId = () => PFX + S.room + '-reg';
const PRIV = 'priv-';
const newCode = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', b = new Uint8Array(6); crypto.getRandomValues(b); return [...b].map(x => A[x % A.length]).join(''); };
const codeOf = room => room.startsWith(PRIV) ? room.slice(PRIV.length).toUpperCase() : '';

let toastT = 0;
function toast(msg, ms = 3500) {
  const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), ms);
}
function netState(txt, ok) { const n = $('#netState'); n.textContent = txt; n.classList.toggle('ok', !!ok); }
const peerOpts = () => ({ config: { iceServers: window.ICE_SERVERS }, debug: 1 });
const safeSend = (c, m) => { try { c && c.open && c.send(m); } catch (e) {} };

/* =====================================================================
   ENTRADA
   ===================================================================== */
(function home() {
  const params = new URLSearchParams(location.search);
  let pick = slug(params.get('sala')) || 'karaoke';
  $('#inName').value = cfg.name || '';
  const box = $('#roomPick');
  ROOMS.forEach(([id, name, em]) => {
    const b = document.createElement('button');
    b.innerHTML = `<span class="em">${em}</span><span class="rn"><b>${esc(name)}</b><small class="who" data-room="${id}">Mirando…</small><small class="np" data-np="${id}"></small></span>`;
    b.dataset.id = id;
    b.onclick = () => { pick = id; $('#inCode').value = ''; mark(); };
    box.appendChild(b);
  });
  if (codeOf(pick)) { $('#inCode').value = codeOf(pick); pick = 'karaoke'; }
  else if (!ROOMS.some(r => r[0] === pick)) pick = 'karaoke';
  const mark = () => box.querySelectorAll('button').forEach(b => b.classList.toggle('sel', !$('#inCode').value.trim() && b.dataset.id === pick));
  $('#inCode').oninput = mark;
  mark();
  const go = () => {
    const name = $('#inName').value.trim();
    const err = $('#homeErr');
    if (!name) { err.textContent = 'Escribí tu nombre.'; err.classList.remove('hidden'); $('#inName').focus(); return; }
    const code = $('#inCode').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if ($('#inCode').value.trim() && code.length < 4) { err.textContent = 'El código tiene que tener al menos 4 letras o números.'; err.classList.remove('hidden'); return; }
    const room = code ? PRIV + code.toLowerCase() : pick;
    cfg.name = name; saveCfg();
    enter(name, room).catch(e => {
      console.error(e);
      $('#btnEnter').disabled = false;
      err.textContent = 'No se pudo entrar: ' + (e && e.message || e); err.classList.remove('hidden');
    });
  };
  $('#btnEnter').onclick = go;
  $('#btnCreate').onclick = () => { $('#inCode').value = newCode(); mark(); go(); };
  $('#inName').onkeydown = $('#inCode').onkeydown = e => { if (e.key === 'Enter') go(); };
  setTimeout(watchRooms, 0);
  if (!navigator.mediaDevices || !window.RTCPeerConnection) {
    $('#homeErr').textContent = 'Este navegador no permite llamadas. Usá Chrome, Edge, Safari o Firefox actualizados.';
    $('#homeErr').classList.remove('hidden');
  }
})();

// quién está en cada sala abierta y qué suena
function watchRooms() {
  if (!window.Peer) return;
  const w = S.watch = new Peer(PFX + 'ver-' + rand(10), peerOpts());
  const show = (id, list, np) => {
    const el = document.querySelector(`.who[data-room="${id}"]`), n = document.querySelector(`.np[data-np="${id}"]`);
    if (!el) return;
    n.textContent = np ? '▶ ' + np : '';
    if (!list.length) { el.textContent = 'Vacía'; el.classList.remove('busy'); return; }
    el.textContent = `${list.length} · ` + list.map(m => m.name).join(', ');
    el.classList.add('busy');
  };
  const pend = {};
  const again = (id, ms = 8000) => {
    if (pend[id]) return; pend[id] = true;
    setTimeout(() => { pend[id] = false; if (S.watch === w && !w.destroyed) peek(id); }, ms);
  };
  const peek = id => {
    if (w.destroyed || w.disconnected) return again(id);
    const c = w.connect(PFX + id + '-reg', { reliable: true });
    if (!c) return again(id);
    let got = false;
    c.on('open', () => c.send({ t: 'peek' }));
    c.on('data', d => { if (d && d.t === 'list' && Array.isArray(d.list)) { got = true; show(id, d.list, String(d.now || '').slice(0, 80)); } });
    c.on('close', () => again(id));
    setTimeout(() => { if (!got) { try { c.close(); } catch (e) {} } }, 9000);
  };
  w.on('open', () => ROOMS.forEach(([id]) => peek(id)));
  w.on('error', e => {
    const m = String(e.message || '').match(/karapy26-([a-z0-9-]+)-reg/);
    if (e.type === 'peer-unavailable' && m) { show(m[1], [], ''); again(m[1]); }
  });
  w.on('disconnected', () => { if (!w.destroyed) setTimeout(() => !w.destroyed && w.reconnect(), 2000); });
}

async function enter(name, room) {
  if (S.watch) { try { S.watch.destroy(); } catch (e) {} S.watch = null; }
  S.name = name; S.room = room;
  $('#btnEnter').disabled = true;
  await audioStart();
  history.replaceState(null, '', location.pathname + '?sala=' + room);
  $('#home').classList.add('hidden');
  $('#room').classList.remove('hidden');
  const code = codeOf(room);
  const r = ROOMS.find(x => x[0] === room);
  const nice = code ? '🔒 Sala privada' : r ? r[2] + ' ' + r[1] : room;
  $('#roomName').textContent = nice;
  if (code) { $('#roomCode').classList.remove('hidden'); $('#roomCode b').textContent = code; $('#roomCode').onclick = invite; }
  document.title = nice + ' · Karaoke';
  roomUI();
  setMode('mute');
  netStart();
  ytStart();
  wakeLock();
  sysMsg(A.noMic ? 'Entraste sin micrófono: podés mirar, escuchar y escribir.' : 'Entraste a la sala. Tocá «Hablar» o «Cantar» para que te escuchen.');
  search('karaoke éxitos en español', true);
}

/* =====================================================================
   MICRÓFONO Y EFECTOS
   ===================================================================== */
const PRESETS = {
  natural: { n: 'Natural', echo: 0, rev: 0, size: 1.2 },
  estudio: { n: 'Estudio', echo: 0, rev: 30, size: 1.3 },
  karaoke: { n: 'Karaoke', echo: 35, rev: 30, size: 1.8, delay: 0.27 },
  salon: { n: 'Salón', echo: 10, rev: 55, size: 3.2, delay: 0.32 },
  estadio: { n: 'Estadio', echo: 40, rev: 50, size: 4.2, delay: 0.42 },
  radio: { n: 'Radio', echo: 0, rev: 10, size: 0.8, radio: true },
};
// afinación automática: cuánto corrige hacia la nota más cercana y en cuánto tiempo (s)
const TUNES = {
  off: { n: 'Apagada', tune: 0, speed: 0.05 },
  suave: { n: 'Suave', tune: 0.5, speed: 0.12 },
  natural: { n: 'Natural', tune: 0.85, speed: 0.045 },
  robot: { n: 'Robot', tune: 1, speed: 0.002 },
};
const A = { ctx: null, irSize: 0, open: false, lastLoud: 0, db: -100 };
// efectos prendidos: cantando, o probándolos en silencio con «Escucharme» (nadie más oye)
const fxOn = () => S.mode === 'sing' || (S.mode === 'mute' && cfg.monitor);

async function audioStart() {
  const ctx = A.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive', sampleRate: 48000 });
  const g = v => { const n = ctx.createGain(); n.gain.value = v; return n; };
  const bq = (type, f, q = 0.7, gain = 0) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; n.gain.value = gain; return n; };
  A.hp = bq('highpass', 90);
  A.comp = ctx.createDynamicsCompressor();
  A.comp.threshold.value = -26; A.comp.knee.value = 12; A.comp.ratio.value = 3.5; A.comp.attack.value = 0.004; A.comp.release.value = 0.2;
  A.pres = bq('peaking', 3200, 0.9, 0);
  A.lp = bq('lowpass', 16000);
  A.an = ctx.createAnalyser(); A.an.fftSize = 1024;
  A.gate = g(0);
  A.dry = g(1);
  A.conv = ctx.createConvolver(); A.rev = g(0);
  A.dly = ctx.createDelay(1.5); A.fb = g(0.3); A.fbLp = bq('lowpass', 3500); A.echo = g(0);
  A.mix = g(1); A.vvol = g(1); A.mon = g(0);
  A.dest = ctx.createMediaStreamDestination(); A.dest.channelCount = 2;
  try {
    await ctx.audioWorklet.addModule('pitch-worklet.js');
    A.pitch = new AudioWorkletNode(ctx, 'pitch-shift', { outputChannelCount: [1] });
  } catch (e) { console.warn('sin cambio de tono', e); A.pitch = null; }
  // micrófono → filtro → (tono) → compresor → brillo → corte de silencio → seco + reverberación + eco
  const head = A.pitch ? (A.hp.connect(A.pitch), A.pitch) : A.hp;
  head.connect(A.comp); A.comp.connect(A.pres); A.pres.connect(A.lp);
  A.lp.connect(A.an); A.lp.connect(A.gate);
  A.gate.connect(A.dry); A.dry.connect(A.mix);
  A.gate.connect(A.conv); A.conv.connect(A.rev); A.rev.connect(A.mix);
  A.gate.connect(A.dly); A.dly.connect(A.fbLp); A.fbLp.connect(A.fb); A.fb.connect(A.dly); A.fbLp.connect(A.echo); A.echo.connect(A.mix);
  A.echo.connect(A.conv);
  A.mix.connect(A.vvol); A.vvol.connect(A.dest); A.vvol.connect(A.mon); A.mon.connect(ctx.destination);
  // sin micrófono (no hay o no dio permiso) igual se puede mirar y escuchar
  try { await micOpen(); } catch (e) { console.warn('sin micrófono', e); A.noMic = e && e.name === 'NotAllowedError' ? 'permiso' : 'falta'; }
  if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
  setInterval(gateTick, 20);
  setInterval(talkTick, 150);
  applyFx();
}

async function micOpen(id = cfg.mic) {
  const want = { echoCancellation: !cfg.phones, noiseSuppression: S.mode !== 'sing' && !cfg.phones, autoGainControl: false, channelCount: 1 };
  let raw;
  try { raw = await navigator.mediaDevices.getUserMedia({ audio: id ? { ...want, deviceId: { exact: id } } : want }); }
  catch (e) {
    if (!id || e.name === 'NotAllowedError') throw e;
    cfg.mic = ''; saveCfg();
    raw = await navigator.mediaDevices.getUserMedia({ audio: want });
  }
  if (A.raw) A.raw.getTracks().forEach(t => t.stop());
  try { A.src && A.src.disconnect(); } catch (e) {}
  A.raw = raw;
  A.src = A.ctx.createMediaStreamSource(raw);
  A.src.connect(A.hp);
}

function makeIR(sec) {
  const sr = A.ctx.sampleRate, len = Math.floor(sr * sec), pre = Math.floor(sr * 0.012);
  const b = A.ctx.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = pre; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) * 0.6;
  }
  return b;
}

// aplica el efecto: con «Cantar» todo; con «Hablar» la voz limpia
function applyFx() {
  if (!A.ctx) return;
  const p = PRESETS[cfg.fx] || PRESETS.karaoke, sing = fxOn(), t = A.ctx.currentTime;
  const echo = sing ? cfg.echo / 100 : 0, rev = sing ? cfg.rev / 100 : 0;
  if (sing && A.irSize !== p.size) { A.conv.buffer = makeIR(p.size); A.irSize = p.size; }
  A.rev.gain.setTargetAtTime(rev * 0.8, t, 0.05);
  A.echo.gain.setTargetAtTime(echo * 0.55, t, 0.05);
  A.fb.gain.setTargetAtTime(0.2 + echo * 0.3, t, 0.05);
  A.dly.delayTime.setTargetAtTime(p.delay || 0.28, t, 0.05);
  const radio = sing && p.radio;
  A.hp.frequency.setTargetAtTime(radio ? 450 : 90, t, 0.05);
  A.lp.frequency.setTargetAtTime(radio ? 3400 : 16000, t, 0.05);
  A.pres.gain.setTargetAtTime(radio ? 6 : sing ? 2.5 : 0, t, 0.05);
  A.comp.ratio.value = sing ? 4 : 3;
  if (A.pitch) {
    const tu = TUNES[cfg.tune] || TUNES.off;
    A.pitch.parameters.get('ratio').setValueAtTime(sing ? Math.pow(2, cfg.pitch / 12) : 1, t);
    A.pitch.parameters.get('tune').setValueAtTime(sing ? tu.tune : 0, t);
    A.pitch.parameters.get('speed').setValueAtTime(tu.speed, t);
  }
  A.vvol.gain.setTargetAtTime(cfg.vvol / 100, t, 0.05);
  A.mon.gain.setTargetAtTime(cfg.monitor ? 1 : 0, t, 0.05);
}

const levelDb = (an, buf) => {
  an.getFloatTimeDomainData(buf);
  let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return 10 * Math.log10(s / buf.length + 1e-12);
};
const gBuf = new Float32Array(1024);
function gateTick() {
  const n = now(), sing = fxOn();
  A.db = levelDb(A.an, gBuf);
  if (A.db > (sing ? -62 : -55)) { A.lastLoud = n; A.open = true; }
  else if (A.open && n - A.lastLoud > (sing ? 1000 : 650)) A.open = false;
  const on = A.open && (S.mode !== 'mute' || cfg.monitor);
  A.gate.gain.setTargetAtTime(on ? 1 : 0, A.ctx.currentTime, on ? 0.004 : 0.15);
  if (S.tab === 'voice') {
    $('#meter i').style.width = clamp((A.db + 80) / 65 * 100, 0, 100) + '%';
    $('#meter i').style.background = on ? 'var(--green)' : '#5a4a78';
  }
}

const tBuf = new Float32Array(1024);
const talking = new Map();
function talkTick() {
  const set = (id, on) => {
    if (talking.get(id) === on) return; talking.set(id, on);
    document.querySelectorAll(`[data-talk="${CSS.escape(id)}"]`).forEach(el => el.classList.toggle('talk', on));
  };
  set('me', A.open && S.mode !== 'mute');
  S.remote.forEach(r => { if (r.an) set(r.peer, levelDb(r.an, tBuf) > -55); });
}

function setMode(m) {
  if (A.noMic && m !== 'mute') {
    toast(A.noMic === 'permiso' ? 'No diste permiso al micrófono: tocá el candado de la barra de direcciones, permitilo y volvé a entrar.' : 'No se encontró un micrófono: podés mirar y escuchar.', 6000);
    m = 'mute';
  }
  const was = S.mode;
  S.mode = m;
  A.dest.stream.getAudioTracks().forEach(t => t.enabled = m !== 'mute');
  // al cantar se apaga el quitado de ruido del navegador (corta las notas largas)
  const tr = A.raw && A.raw.getAudioTracks()[0];
  if (tr && tr.applyConstraints) tr.applyConstraints({ echoCancellation: !cfg.phones, noiseSuppression: m !== 'sing' && !cfg.phones, autoGainControl: false }).catch(() => {});
  applyFx();
  broadcast({ t: 'mode', mode: m });
  if (m === 'sing' && was !== 'sing' && !cfg.phones && !S.tipShown) { S.tipShown = true; toast('🎧 Consejo: con auriculares suena mucho mejor (sin que la música se escuche dos veces).', 6000); }
  if (m === 'sing' && was !== 'sing') sysMsg('Estás cantando con el efecto «' + (PRESETS[cfg.fx] || PRESETS.karaoke).n + '». Cambialo en 🎚️ Voz.');
  document.querySelectorAll('#modes button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
  renderMembers(); renderSingers();
}

/* =====================================================================
   RED: lista de la sala, estado del video y conexiones de voz
   ===================================================================== */
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
      const who = String(e.message || '').match(/karapy26-[a-z0-9-]+/);
      if (who && who[0] === regId()) { if (S.regConn) { const c = S.regConn; S.regConn = null; try { c.close(); } catch (x) {} } becomeRegistry(); }
      else if (who) S.pending.delete(who[0]);
      return;
    }
    console.warn('peer', e.type, e);
    if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(e.type)) netState('Sin conexión, reintentando…');
  });
  // aviso de vida + medición del reloj
  setInterval(() => { ping(); onList(S.roster); }, 2000);
  setInterval(statsTick, 2000);
  setInterval(syncTick, 200);
}

/* ---------------- reloj compartido ---------------- */
const CK = { s: [], off: 0, rtt: 0 };
const regNow = () => now() + CK.off;
function ping() { safeSend(S.regConn, { t: 'ping', c: now() }); }
function onPong(d) {
  const t = now(), rtt = t - d.c;
  if (!(rtt >= 0 && rtt < 5000)) return;
  CK.s.push({ rtt, off: d.s - (d.c + rtt / 2) });
  if (CK.s.length > 15) CK.s.shift();
  const b = CK.s.reduce((a, x) => x.rtt < a.rtt ? x : a);   // la medición más rápida es la más exacta
  CK.off = b.off; CK.rtt = b.rtt;
}
// en qué segundo del video tiene que estar la sala ahora
function expectedPos(st = S.st) { return st.playing ? st.pos + (regNow() - st.at) / 1000 : st.pos; }

function joinRegistry() {
  if (S.left || !S.me || S.me.destroyed) return;
  clearTimeout(S.regTimer);
  if (S.regConn) { const old = S.regConn; S.regConn = null; try { old.close(); } catch (e) {} }
  const c = S.me.connect(regId(), { reliable: true });
  if (!c) return;
  S.regConn = c;
  let opened = false;
  c.on('open', () => {
    opened = true;
    CK.s = [];
    // se manda lo último que se sabía de la sala, por si quien tiene la lista es nuevo
    const st = S.st.vid || S.st.queue.length ? { ...S.st, pos: expectedPos() } : null;
    c.send({ t: 'hello', name: S.name, st });
    for (let i = 0; i < 8; i++) setTimeout(ping, 60 + i * 150);
  });
  c.on('data', d => {
    if (!d) return;
    if (d.t === 'list') onList(d.list);
    else if (d.t === 'st') onSt(d.st);
    else if (d.t === 'pong') onPong(d);
  });
  c.on('close', () => {
    if (S.regConn !== c || S.left) return;
    S.regConn = null;
    S.regTimer = setTimeout(becomeRegistry, 300 + Math.random() * 1500);
  });
  setTimeout(() => { if (!opened && S.regConn === c) { S.regConn = null; try { c.close(); } catch (e) {} becomeRegistry(); } }, 9000);
}

const cleanItem = x => x && okVid(x.vid) ? { k: String(x.k || rand(6)).slice(0, 8), vid: x.vid, title: String(x.title || '').slice(0, 150), by: String(x.by || '').slice(0, 24) } : null;

function becomeRegistry() {
  if (S.left) return;
  if (S.reg && !S.reg.destroyed) return joinRegistry();
  const r = S.reg = new Peer(regId(), peerOpts());
  const members = new Map(), watchers = new Set();
  // arranca con lo último que este aparato sabía de la sala
  const R = EMPTY();
  const adopt = st => {
    if (!st || (!okVid(st.vid) && !(st.queue || []).length)) return;
    Object.assign(R, {
      sid: String(st.sid || rand(6)).slice(0, 8), vid: okVid(st.vid) ? st.vid : '', title: String(st.title || '').slice(0, 150), by: String(st.by || '').slice(0, 24),
      playing: !!st.playing && okVid(st.vid), pos: clamp(+st.pos || 0, 0, 36000), at: now(), queue: (st.queue || []).map(cleanItem).filter(Boolean).slice(0, 100),
    });
    R.v++;
  };
  if (S.st.vid || S.st.queue.length) adopt({ ...S.st, pos: expectedPos() });
  const listMsg = () => ({ t: 'list', list: [...members].map(([id, m]) => ({ id, name: m.name })), now: R.title || '' });
  const sendList = () => { const m = listMsg(); members.forEach(x => safeSend(x.conn, m)); watchers.forEach(c => safeSend(c, m)); };
  const sendSt = () => { const m = { t: 'st', st: R }; members.forEach(x => safeSend(x.conn, m)); };
  const cur = () => R.playing ? R.pos + Math.max(0, now() - R.at) / 1000 : R.pos;
  const startNext = () => {
    const it = R.queue.shift();
    if (it) Object.assign(R, { sid: rand(6), vid: it.vid, title: it.title, by: it.by, pos: 0, playing: true, at: now() + 1500 });
    else Object.assign(R, { sid: '', vid: '', title: '', by: '', pos: 0, playing: false, at: now() });
    sendList();
  };
  const doCmd = (d, who) => {
    switch (d.op) {
      case 'add': {
        const it = cleanItem({ vid: d.vid, title: d.title, by: who }); if (!it || R.queue.length >= 100) return;
        R.queue.push(it); if (!R.vid) startNext(); break;
      }
      case 'now': {
        const it = cleanItem({ vid: d.vid, title: d.title, by: who }); if (!it) return;
        Object.assign(R, { sid: rand(6), vid: it.vid, title: it.title, by: it.by, pos: 0, playing: true, at: now() + 1500 });
        sendList(); break;
      }
      case 'next': startNext(); break;
      case 'ended': if (!R.vid || d.sid !== R.sid) return; startNext(); break;
      case 'play': if (!R.vid || R.playing) return; R.pos = cur(); R.playing = true; R.at = now() + 700; break;
      case 'pause': if (!R.playing) return; R.pos = cur(); R.playing = false; R.at = now(); break;
      case 'seek': if (!R.vid) return; R.pos = clamp(+d.pos || 0, 0, 36000); R.at = now() + (R.playing ? 700 : 0); break;
      case 'rm': R.queue = R.queue.filter(x => x.k !== d.k); break;
      case 'up': { const i = R.queue.findIndex(x => x.k === d.k); if (i > 0) R.queue.unshift(R.queue.splice(i, 1)[0]); break; }
      default: return;
    }
    R.v++; sendSt();
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
      const m = members.get(c.peer);
      if (m) m.seen = Date.now();
      if (d.t === 'hello') {
        members.set(c.peer, { name: String(d.name || '?').slice(0, 24), conn: c, seen: Date.now() });
        if (!R.vid && !R.queue.length && d.st) adopt(d.st);
        sendList(); safeSend(c, { t: 'st', st: R });
      } else if (d.t === 'peek') { watchers.add(c); safeSend(c, listMsg()); }
      else if (d.t === 'ping') safeSend(c, { t: 'pong', c: d.c, s: now() });
      else if (d.t === 'cmd' && m) doCmd(d, m.name);
    });
    c.on('close', () => { watchers.delete(c); const m = members.get(c.peer); if (m && m.conn === c) { members.delete(c.peer); sendList(); } });
  });
  r._iv = setInterval(() => {
    let ch = false;
    members.forEach((m, id) => { if (Date.now() - m.seen > 15000) { members.delete(id); try { m.conn.close(); } catch (e) {} ch = true; } });
    if (ch) sendList();
  }, 5000);
}

function cmd(op, extra = {}) {
  if (S.regConn && S.regConn.open) S.regConn.send({ t: 'cmd', op, ...extra });
  else toast('Conectando con la sala… probá de nuevo en un momento.');
}

function onSt(st) {
  if (!st || typeof st !== 'object') return;
  const prev = S.st;
  S.st = { ...EMPTY(), ...st, queue: Array.isArray(st.queue) ? st.queue : [] };
  if (prev.sid !== S.st.sid && S.st.vid) sysMsg(`▶ ${S.st.title || 'Canción nueva'}${S.st.by ? ' — pedida por ' + S.st.by : ''}`);
  renderNow(); renderQueue();
  syncTick();
}

function onList(list) {
  if (!Array.isArray(list) || !S.me || !S.me.id) return;
  const changed = JSON.stringify(list) !== JSON.stringify(S.roster);
  S.roster = list;
  list.forEach(m => {
    if (m.id === S.me.id || S.peers.has(m.id) || S.me.id < m.id) return;   // conecta el de id mayor
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
      if (c.connectionId > old.conn.connectionId) { c.close(); return; }
      old.conn.close();
    }
    const fromList = S.roster.find(m => m.id === c.peer);
    const p = old || { id: c.peer, name: fromList ? fromList.name : '…', mode: 'mute' };
    p.conn = c;
    S.peers.set(c.peer, p);
    c.send({ t: 'hi', name: S.name, mode: S.mode });
    callVoice(c.peer);
    if (!old) sysMsg(`${p.name} entró a la sala.`);
    renderMembers();
  });
  c.on('data', d => onData(c.peer, d));
  c.on('close', () => { const p = S.peers.get(c.peer); if (p && p.conn === c) dropPeer(c.peer); });
  c.on('error', e => console.warn('conn', e));
}

function dropPeer(id) {
  const p = S.peers.get(id);
  S.peers.delete(id); S.pending.delete(id);
  const call = S.calls.get(id); if (call) { S.calls.delete(id); try { call.close(); } catch (e) {} }
  removeRemote(id);
  if (p) sysMsg(`${p.name} salió de la sala.`);
  renderMembers(); renderSingers();
}

function broadcast(msg) { S.peers.forEach(p => safeSend(p.conn, msg)); }

function onData(from, d) {
  if (!d || typeof d !== 'object') return;
  const p = S.peers.get(from);
  switch (d.t) {
    case 'hi':
      if (p) { p.name = String(d.name || '?').slice(0, 24); p.mode = ['mute', 'talk', 'sing'].includes(d.mode) ? d.mode : 'mute'; }
      applyVolume(S.remote.get(from));
      renderMembers(); renderSingers(); break;
    case 'mode':
      if (p) {
        const m = ['mute', 'talk', 'sing'].includes(d.mode) ? d.mode : 'mute';
        if (m === 'sing' && p.mode !== 'sing') sysMsg(`🎤 ${p.name} está cantando.`);
        p.mode = m;
      }
      renderMembers(); renderSingers(); break;
    case 'chat':
      addMsg(p ? p.name : '?', String(d.text || '').slice(0, 300)); break;
    case 'react':
      if (typeof d.e === 'string' && REACTS.includes(d.e)) floatEmoji(d.e, p ? p.name : ''); break;
  }
}

/* ---------------- voz (una llamada hacia cada amigo) ---------------- */
// voz en estéreo y con buena calidad para cantar (sin cortes de silencio de Opus)
function sdpVoice(sdp) {
  const lines = sdp.split('\r\n'), pts = {};
  lines.forEach(l => { const m = l.match(/^a=rtpmap:(\d+) ([\w-]+)\//); if (m) pts[m[1]] = m[2].toUpperCase(); });
  return lines.map(l => {
    const m = l.match(/^a=fmtp:(\d+) (.*)$/);
    if (m && pts[m[1]] === 'OPUS') return l.replace(/;?(stereo|sprop-stereo|maxaveragebitrate|usedtx|useinbandfec)=\d+/g, '') + ';stereo=1;sprop-stereo=1;maxaveragebitrate=128000;usedtx=0;useinbandfec=1';
    return l;
  }).join('\r\n');
}

function callVoice(pid) {
  if (!S.me) return;
  const old = S.calls.get(pid); if (old) { try { old.close(); } catch (e) {} }
  const call = S.me.call(pid, A.dest.stream, { metadata: { kind: 'voice' }, sdpTransform: sdpVoice });
  if (!call) return;
  S.calls.set(pid, call);
  const pc = call.peerConnection;
  if (pc) pc.addEventListener('connectionstatechange', () => {
    if (pc.connectionState !== 'connected') return;
    pc.getSenders().forEach(s => {
      if (!s.track || s.track.kind !== 'audio') return;
      const p = s.getParameters(); if (!p.encodings || !p.encodings.length) p.encodings = [{}];
      p.encodings[0].maxBitrate = 128000; p.encodings[0].priority = p.encodings[0].networkPriority = 'high';
      s.setParameters(p).catch(() => {});
    });
  });
  call.on('close', () => { if (S.calls.get(pid) === call) S.calls.delete(pid); });
  call.on('error', e => console.warn('call', e));
}

function onCall(call) {
  call.answer(undefined, { sdpTransform: sdpVoice });
  let done = false;
  call.on('stream', st => { if (done) return; done = true; addRemote(call, st); });
  call.on('close', () => { const r = S.remote.get(call.peer); if (r && r.call === call) removeRemote(call.peer); });
  call.on('error', e => console.warn('call', e));
}

function addRemote(call, st) {
  removeRemote(call.peer);
  const r = { peer: call.peer, call, lat: 0, jb: null };
  r.el = new Audio(); r.el.autoplay = true; r.el.srcObject = st;
  r.el.play().catch(() => toast('Tocá la pantalla para escuchar a los demás.'));
  try { const src = A.ctx.createMediaStreamSource(st); r.an = A.ctx.createAnalyser(); r.an.fftSize = 1024; src.connect(r.an); } catch (e) {}
  S.remote.set(call.peer, r);
  applyVolume(r);
}

function removeRemote(id) {
  const r = S.remote.get(id); if (!r) return;
  S.remote.delete(id);
  try { r.call && r.call.close(); } catch (e) {}
  if (r.el) { r.el.pause(); r.el.srcObject = null; }
}

function applyVolume(r) {
  if (!r || !r.el) return;
  const p = S.peers.get(r.peer);
  const v = (cfg.vols[p ? p.name : ''] ?? 100) / 100 * cfg.voices / 100;
  r.el.volume = clamp(v, 0, 1);
}

// cuánto tarda en llegar la voz de cada amigo (red + colchón de audio)
async function statsTick() {
  for (const r of S.remote.values()) {
    const pc = r.call && r.call.peerConnection; if (!pc || pc.connectionState !== 'connected') continue;
    try {
      const rep = await pc.getStats();
      let rtt = 0, jb = 0, pair = '';
      rep.forEach(x => { if (x.type === 'transport' && x.selectedCandidatePairId) pair = x.selectedCandidatePairId; });
      rep.forEach(x => {
        if (x.type === 'candidate-pair' && (x.id === pair || (!pair && x.nominated && x.state === 'succeeded')) && x.currentRoundTripTime) rtt = x.currentRoundTripTime;
        if (x.type === 'inbound-rtp' && x.kind === 'audio' && x.jitterBufferEmittedCount) {
          if (r.jb) { const dn = x.jitterBufferEmittedCount - r.jb.n; if (dn > 0) jb = (x.jitterBufferDelay - r.jb.d) / dn; }
          r.jb = { d: x.jitterBufferDelay, n: x.jitterBufferEmittedCount };
        }
      });
      const lat = clamp(rtt / 2 + (jb || 0.04) + 0.06, 0.05, 1);
      r.lat = r.lat ? r.lat * 0.7 + lat * 0.3 : lat;
    } catch (e) {}
  }
}

/* =====================================================================
   YOUTUBE SINCRONIZADO
   ===================================================================== */
let yt = null;
const P = { ready: false, sid: '', lastSeek: 0, lag: 0.15, drifts: [], lagCheck: false, want: 0, startFor: -1, startT: 0, fine: true, rateFails: 0, rate: 1, align: 0, dragging: false };
window.__karaoke = { S, P, CK, A, yt: () => yt };   // para revisar desde la consola

function loadYT() {
  return new Promise(ok => {
    if (window.YT && YT.Player) return ok();
    window.onYouTubeIframeAPIReady = ok;
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s);
  });
}
async function ytStart() {
  await loadYT();
  yt = new YT.Player('yt', {
    width: '100%', height: '100%',
    playerVars: { controls: 0, disablekb: 1, rel: 0, playsinline: 1, iv_load_policy: 3, fs: 0, modestbranding: 1, autoplay: 1, origin: location.origin },
    events: {
      onReady: () => { P.ready = true; yt.setVolume(cfg.music); syncTick(); },
      onStateChange: e => {
        if (e.data === 0 && S.st.vid && P.sid === S.st.sid) cmd('ended', { sid: S.st.sid });
        if (e.data === 1) $('#tapPlay').classList.add('hidden');
      },
      onError: e => {
        if (!S.st.vid || P.sid !== S.st.sid) return;
        toast([101, 150].includes(e.data) ? 'Este video no se puede ver fuera de YouTube (lo bloqueó su dueño). Pasamos a la siguiente.' : 'No se pudo reproducir este video. Pasamos a la siguiente.', 6000);
        cmd('ended', { sid: S.st.sid });
      },
    },
  });
}

// cuánto atraso mi video para que la voz de quien canta caiga justo con la música
function alignTarget() {
  if (!cfg.align || S.mode === 'sing') return 0;
  const singer = [...S.peers.values()].find(p => p.mode === 'sing');
  if (!singer) return 0;
  const r = S.remote.get(singer.id);
  return r && r.lat ? r.lat : 0.15;
}

// YouTube acepta velocidades como 0,97 o 1,05 aunque no las anuncie; si este no, se corrige solo saltando
function setRate(v) {
  if (P.rate === v) return; P.rate = v;
  try { yt.setPlaybackRate(v); } catch (e) {}
  if (v !== 1) setTimeout(() => {
    try {
      if (P.rate !== v) return;
      if (Math.abs(yt.getPlaybackRate() - v) < 0.005) { P.rateFails = 0; return; }
      if (++P.rateFails >= 3) { P.fine = false; P.rate = 1; yt.setPlaybackRate(1); }
    } catch (e) {}
  }, 2500);
}

function syncTick() {
  if (!P.ready || !yt || !yt.getPlayerState) return;
  const st = S.st;
  $('#empty').classList.toggle('hidden', !!st.vid);
  if (!st.vid) {
    if (P.sid) { try { yt.stopVideo(); } catch (e) {} P.sid = ''; }
    paintCtrl(0, 0); paintSync(null); return;
  }
  // el atraso para el cantante cambia de a poco, para no saltar
  const want = alignTarget();
  P.align += clamp(want - P.align, -0.02, 0.02);
  const target = expectedPos() - P.align;
  if (P.sid !== st.sid) {
    P.sid = st.sid; P.drifts = []; P.lagCheck = false; P.lastSeek = now(); P.want = now(); setRate(1);
    yt.loadVideoById({ videoId: st.vid, startSeconds: Math.max(0, target) });
    yt.setVolume(cfg.music);
    return;
  }
  let ps, cur, dur;
  try { ps = yt.getPlayerState(); cur = yt.getCurrentTime() || 0; dur = yt.getDuration() || 0; } catch (e) { return; }
  paintCtrl(cur, dur);
  const waiting = st.playing && target < st.pos - 0.03;   // todavía no llegó el momento de arrancar
  if (!st.playing || waiting) {
    if (ps === 1) yt.pauseVideo();
    const hold = st.playing ? st.pos : Math.max(0, target);
    if (Math.abs(cur - hold) > 0.25 && ps !== 3 && now() - P.lastSeek > 700) { yt.seekTo(hold, true); P.lastSeek = now(); }
    if (waiting && P.startFor !== st.v) {
      P.startFor = st.v; clearTimeout(P.startT);
      P.startT = setTimeout(() => { try { yt.playVideo(); } catch (e) {} }, (st.pos - target) * 1000);
    }
    P.want = now(); P.drifts = []; setRate(1); paintSync(null); return;
  }
  if (ps === 0) return;
  if (ps !== 1) {
    if (ps !== 3) { try { yt.playVideo(); } catch (e) {} }
    if (ps !== 3 && now() - P.want > 3000) $('#tapPlay').classList.remove('hidden');
    P.drifts = []; paintSync(null); return;
  }
  P.want = now();
  $('#unmute').classList.toggle('hidden', !(yt.isMuted && yt.isMuted()));
  if (CK.s.length < 3) return;   // todavía no se midió bien el reloj
  const d = cur - target;
  P.drifts.push(d); if (P.drifts.length > 5) P.drifts.shift();
  if (P.drifts.length < 3) return;
  const med = [...P.drifts].sort((a, b) => a - b)[P.drifts.length >> 1];
  paintSync(med);
  // después de un salto se aprende cuánto se quedó corto o pasado
  if (P.lagCheck) { P.lagCheck = false; P.lag = clamp(P.lag - med * 0.8, 0, 1.5); }
  // lejos: salto; cerca: un poquito más lento o más rápido hasta alcanzar (no se nota)
  if (Math.abs(med) > (P.fine ? 0.4 : 0.2) && now() - P.lastSeek > 2000) {
    setRate(1);
    yt.seekTo(target + P.lag, true);
    P.lastSeek = now(); P.drifts = []; P.lagCheck = true;
    return;
  }
  if (P.fine) {
    const a = Math.abs(med);
    // con histéresis: arranca a corregir a los 30 ms y para cerca de 8 ms
    const r = a > 0.12 ? 0.05 : a > 0.03 || (P.rate !== 1 && a > 0.008) ? 0.025 : 0;
    setRate(r ? Math.round((1 + (med > 0 ? -r : r)) * 1000) / 1000 : 1);
  }
}

function paintCtrl(cur, dur) {
  $('#bPlay').textContent = S.st.playing ? '⏸' : '▶';
  if (!P.dragging) {
    $('#seek').max = dur || 100; $('#seek').value = cur;
    $('#time').textContent = fmt(cur) + ' / ' + fmt(dur);
  }
}
function paintSync(d) {
  const b = $('#syncBadge');
  b.classList.remove('ok', 'warn');
  if (d === null || !S.st.vid) { b.textContent = S.st.vid ? (S.st.playing ? '● Cargando…' : '⏸ En pausa') : '● —'; return; }
  const ms = Math.round(Math.abs(d) * 1000);
  if (ms < 80) { b.classList.add('ok'); b.textContent = `● Sincronizado ±${ms} ms`; }
  else { b.classList.add('warn'); b.textContent = `● Ajustando ${d > 0 ? '+' : '−'}${(Math.abs(d)).toFixed(2)} s`; }
  if (P.align > 0.02) b.textContent += ' · 🎤';
}

/* =====================================================================
   PANTALLA DE LA SALA
   ===================================================================== */
const REACTS = ['👏', '🔥', '❤️', '😂', '🎉', '🍺'];

function roomUI() {
  // pestañas
  document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => {
    S.tab = b.dataset.tab;
    document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x === b));
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('hidden', t.id !== 'tab-' + S.tab));
    if (S.tab === 'chat') { S.unread = 0; $('#unread').classList.add('hidden'); const mb = $('#msgBox'); mb.scrollTop = mb.scrollHeight; }
    if (S.tab === 'voice') fillMics();
  });
  // modos del micrófono
  document.querySelectorAll('#modes button').forEach(b => b.onclick = () => { if (A.ctx.state === 'suspended') A.ctx.resume(); setMode(b.dataset.m); });
  // reacciones
  let lastR = 0;
  document.querySelectorAll('#reacts button').forEach(b => b.onclick = () => {
    if (now() - lastR < 250) return; lastR = now();
    floatEmoji(b.textContent, S.name); broadcast({ t: 'react', e: b.textContent });
  });
  // controles del video (para todos)
  $('#bPlay').onclick = () => cmd(S.st.playing ? 'pause' : 'play');
  $('#bRestart').onclick = () => cmd('seek', { pos: 0 });
  $('#bNext').onclick = () => cmd('next');
  $('#seek').oninput = () => { P.dragging = true; $('#time').textContent = fmt(+$('#seek').value) + ' / ' + fmt(+$('#seek').max); };
  $('#seek').onchange = () => { P.dragging = false; cmd('seek', { pos: +$('#seek').value }); };
  $('#bFull').onclick = fullscreen;
  $('#tapPlay').onclick = () => {
    $('#tapPlay').classList.add('hidden'); P.want = now();
    try { yt.unMute(); yt.playVideo(); } catch (e) {}
    setTimeout(() => { if (yt && yt.getPlayerState && yt.getPlayerState() !== 1 && S.st.playing) toast('Si no arranca, tocá directamente sobre el video.', 5000); }, 2500);
  };
  $('#unmute').onclick = () => { try { yt.unMute(); yt.setVolume(cfg.music); } catch (e) {} $('#unmute').classList.add('hidden'); };
  $('#btnInvite').onclick = invite;
  $('#btnLeave').onclick = leave;
  // canciones
  $('#onlyK').checked = cfg.onlyK;
  $('#onlyK').onchange = () => { cfg.onlyK = $('#onlyK').checked; saveCfg(); };
  $('#srchForm').onsubmit = e => { e.preventDefault(); const q = $('#srchIn').value.trim(); if (q) search(q); };
  // chat
  $('#chatForm').onsubmit = e => {
    e.preventDefault();
    const t = $('#chatIn').value.trim(); if (!t) return;
    $('#chatIn').value = '';
    addMsg(S.name, t, true); broadcast({ t: 'chat', text: t });
  };
  // voz
  const pr = $('#presets');
  Object.entries(PRESETS).forEach(([k, p]) => {
    const b = document.createElement('button'); b.textContent = p.n; b.dataset.k = k;
    b.onclick = () => { cfg.fx = k; cfg.echo = p.echo; cfg.rev = p.rev; saveCfg(); paintVoice(); applyFx(); };
    pr.appendChild(b);
  });
  const slider = (id, key, show, after) => {
    const el = $(id), out = el.parentElement.querySelector('output');
    el.value = cfg[key]; out.textContent = show(cfg[key]);
    el.oninput = () => { cfg[key] = +el.value; out.textContent = show(cfg[key]); saveCfg(); after && after(); };
  };
  slider('#fxEcho', 'echo', v => v + '%', applyFx);
  slider('#fxRev', 'rev', v => v + '%', applyFx);
  slider('#fxPitch', 'pitch', v => (v > 0 ? '+' : '') + v, applyFx);
  slider('#fxVol', 'vvol', v => v + '%', applyFx);
  slider('#volMusic', 'music', v => v + '%', () => { try { yt.setVolume(cfg.music); } catch (e) {} });
  slider('#volVoices', 'voices', v => v + '%', () => S.remote.forEach(applyVolume));
  const toggle = (id, key, after) => { const el = $(id); el.checked = !!cfg[key]; el.onchange = () => { cfg[key] = el.checked; saveCfg(); after && after(); }; };
  $('#monitor').onchange = () => setMonitor($('#monitor').checked);
  $('#bMon').onclick = () => setMonitor(!cfg.monitor);
  const tb = $('#tunes');
  if (!A.pitch) tb.parentElement.querySelectorAll('#tunes, #tunes + .note').forEach(el => el.classList.add('hidden'));
  Object.entries(TUNES).forEach(([k, p]) => {
    const b = document.createElement('button'); b.textContent = p.n; b.dataset.k = k;
    b.onclick = () => { cfg.tune = k; saveCfg(); paintVoice(); applyFx(); if (k !== 'off' && S.mode !== 'sing' && !cfg.monitor) toast('La afinación se aplica cuando tocás «🎤 Cantar». Con 🎧 la podés escuchar.', 5000); };
    tb.appendChild(b);
  });
  setMonitor(cfg.monitor, true);
  toggle('#phones', 'phones', () => setMode(S.mode));
  toggle('#align', 'align');
  $('#micSel').onchange = async () => {
    cfg.mic = $('#micSel').value; saveCfg();
    try { await micOpen(); toast('Micrófono cambiado.'); } catch (e) { toast('No se pudo usar ese micrófono: ' + e.message); }
  };
  paintVoice();
  renderMembers(); renderQueue(); renderNow();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { if (A.ctx.state === 'suspended') A.ctx.resume(); wakeLock(); } });
  window.addEventListener('pagehide', () => { try { S.me && S.me.destroy(); S.reg && S.reg.destroy(); } catch (e) {} });
}

// escucharse a uno mismo: va directo del micrófono a los auriculares con la menor demora que permite el aparato
function setMonitor(v, quiet) {
  cfg.monitor = !!v; saveCfg();
  $('#monitor').checked = cfg.monitor;
  $('#bMon').classList.toggle('on', cfg.monitor);
  applyFx();
  const ms = Math.round(((A.ctx.baseLatency || 0.01) + (A.ctx.outputLatency || 0)) * 1000 + 12);
  $('#monLat').textContent = `Demora al escucharte: unos ${ms} ms` + (ms <= 40 ? ' ✅ casi no se nota.' : ms <= 90 ? ' — se nota un poquito, como un eco corto.'
    : ' — se nota como eco. Con auriculares con cable baja mucho (los Bluetooth tardan bastante).');
  if (quiet) return;
  if (cfg.monitor) {
    if (A.noMic) toast('No hay micrófono para escucharte.');
    else toast(`🎧 Te escuchás (demora ~${ms} ms).` + (cfg.phones ? '' : ' Usá auriculares, con parlante se acopla.') + (S.mode === 'mute' ? ' En Silencio solo vos te oís: probá los efectos.' : ''), 6000);
  }
  renderSingers();
}

function paintVoice() {
  document.querySelectorAll('#presets button').forEach(b => b.classList.toggle('sel', b.dataset.k === cfg.fx));
  document.querySelectorAll('#tunes button').forEach(b => b.classList.toggle('sel', b.dataset.k === (cfg.tune || 'off')));
  [['#fxEcho', 'echo', v => v + '%'], ['#fxRev', 'rev', v => v + '%']].forEach(([id, k, show]) => {
    const el = $(id); el.value = cfg[k]; el.parentElement.querySelector('output').textContent = show(cfg[k]);
  });
}

async function fillMics() {
  const sel = $('#micSel');
  let list = [];
  try { list = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput' && d.deviceId); } catch (e) {}
  sel.innerHTML = '<option value="">Automático</option>' + list.filter(d => d.deviceId !== 'default' && d.deviceId !== 'communications')
    .map((d, i) => `<option value="${esc(d.deviceId)}">${esc(d.label || 'Micrófono ' + (i + 1))}</option>`).join('');
  sel.value = cfg.mic || '';
}

/* ---------------- buscar canciones ---------------- */
let searchN = 0;
async function search(q, quiet) {
  const box = $('#results'), n = ++searchN;
  const id = ytId(q);
  box.innerHTML = '<div class="empty">Buscando…</div>';
  try {
    let list;
    if (id) {
      const d = await fetch(API + 'yt?id=' + id).then(r => r.json()).catch(() => ({}));
      list = [{ id, title: d.title || 'Video de YouTube', ch: d.ch || '', dur: '' }];
    } else {
      const qq = cfg.onlyK && !/karaoke/i.test(q) ? q + ' karaoke' : q;
      const r = await fetch(API + 'yt?q=' + encodeURIComponent(qq)); const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'error');
      list = d.list || [];
    }
    if (n !== searchN) return;
    if (!list.length) { box.innerHTML = '<div class="empty">No se encontró nada. Probá con otras palabras.</div>'; return; }
    box.innerHTML = (quiet ? '<h4 style="margin-top:4px">Sugerencias</h4>' : '') + list.map(v => `
      <div class="res"><img loading="lazy" src="${thumb(v.id)}" alt="">
        <div class="t"><b>${esc(v.title)}</b><small>${esc(v.ch || '')}${v.dur ? ' · ' + esc(v.dur) : ''}</small></div>
        <div class="acts"><button class="mini go" data-now="${v.id}">▶ Ya</button><button class="mini" data-add="${v.id}">+ Cola</button></div></div>`).join('');
    const byId = Object.fromEntries(list.map(v => [v.id, v.title]));
    box.querySelectorAll('[data-now]').forEach(b => b.onclick = () => { cmd('now', { vid: b.dataset.now, title: byId[b.dataset.now] }); });
    box.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { cmd('add', { vid: b.dataset.add, title: byId[b.dataset.add] }); b.textContent = '✓ En cola'; b.disabled = true; });
  } catch (e) {
    if (n !== searchN) return;
    box.innerHTML = '<div class="empty">No se pudo buscar ahora. Podés pegar el link del video de YouTube.</div>';
  }
}

function renderQueue() {
  const q = S.st.queue || [], box = $('#queue');
  if (!q.length) { box.innerHTML = '<div class="empty">La cola está vacía. Agregá canciones con «+ Cola».</div>'; return; }
  box.innerHTML = q.map((x, i) => `
    <div class="q"><img loading="lazy" src="${thumb(x.vid)}" alt="">
      <div class="t"><b>${i + 1}. ${esc(x.title || x.vid)}</b><small>pedida por ${esc(x.by || '?')}</small></div>
      <div class="acts">${i ? `<button class="mini" data-up="${esc(x.k)}" title="Pasar primero">⬆</button>` : ''}<button class="mini" data-rm="${esc(x.k)}" title="Sacar">✕</button></div></div>`).join('');
  box.querySelectorAll('[data-up]').forEach(b => b.onclick = () => cmd('up', { k: b.dataset.up }));
  box.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => cmd('rm', { k: b.dataset.rm }));
}

function renderNow() {
  const st = S.st;
  $('#nowInfo b').textContent = st.vid ? (st.title || 'Video de YouTube') : 'Nada sonando';
  $('#nowInfo small').textContent = st.vid ? (st.by ? 'Pedida por ' + st.by : '') + (st.queue.length ? ` · ${st.queue.length} en cola` : '') : 'Elegí una canción para empezar';
}

function avatar(name, talkId) {
  return `<div class="av" data-talk="${esc(talkId)}" style="background:${colorOf(name)}">${esc((name[0] || '?').toUpperCase())}</div>`;
}
const MODE_TXT = { mute: '🔇 en silencio', talk: '💬 hablando', sing: '🎤 cantando' };
function renderMembers() {
  const box = $('#members'); if (!box) return;
  $('#nPeople').textContent = S.peers.size + 1;
  let h = `<div class="mem">${avatar(S.name, 'me')}<div class="nm"><b>${esc(S.name)}</b> (vos)<small>${MODE_TXT[S.mode]}</small></div></div>`;
  S.peers.forEach(p => {
    const v = cfg.vols[p.name] ?? 100;
    h += `<div class="mem">${avatar(p.name, p.id)}<div class="nm"><b>${esc(p.name)}</b><small>${MODE_TXT[p.mode] || ''}</small></div>
      <input type="range" min="0" max="100" value="${v}" data-vol="${esc(p.id)}" title="Volumen de ${esc(p.name)}"></div>`;
  });
  const waiting = S.roster.filter(m => m.id !== (S.me && S.me.id) && !S.peers.has(m.id));
  if (waiting.length) h += `<div class="empty">Conectando con: ${waiting.map(m => esc(m.name)).join(', ')}…</div>`;
  box.innerHTML = h;
  box.querySelectorAll('[data-vol]').forEach(el => el.oninput = () => {
    const p = S.peers.get(el.dataset.vol); if (!p) return;
    cfg.vols[p.name] = +el.value; saveCfg(); applyVolume(S.remote.get(p.id));
  });
  talking.clear();
}

function renderSingers() {
  const names = [...S.peers.values()].filter(p => p.mode === 'sing').map(p => p.name);
  if (S.mode === 'sing') names.unshift(S.name + ' (vos)');
  const el = $('#singers');
  el.classList.toggle('hidden', !names.length);
  el.innerHTML = '🎤 Cantando: <b>' + names.map(esc).join(', ') + '</b>';
}

function floatEmoji(e, who) {
  const f = document.createElement('div');
  f.className = 'flt'; f.style.left = (5 + Math.random() * 85) + '%';
  f.innerHTML = esc(e) + (who ? `<small>${esc(who)}</small>` : '');
  $('#floats').appendChild(f);
  setTimeout(() => f.remove(), 2700);
}

function addMsg(who, text, mine) {
  const m = document.createElement('div'); m.className = 'msg';
  m.innerHTML = `<b>${esc(who)}:</b> ${esc(text)}`;
  $('#msgs').appendChild(m);
  const mb = $('#msgBox'); mb.scrollTop = mb.scrollHeight;
  if (!mine && S.tab !== 'chat') { S.unread++; $('#unread').textContent = S.unread; $('#unread').classList.remove('hidden'); }
}
function sysMsg(text) {
  const m = document.createElement('div'); m.className = 'msg sys'; m.textContent = text;
  $('#msgs').appendChild(m);
  const mb = $('#msgBox'); mb.scrollTop = mb.scrollHeight;
}

function invite() {
  const url = location.origin + location.pathname + '?sala=' + S.room;
  const code = codeOf(S.room);
  const text = code ? `¡Vení a cantar karaoke conmigo! Sala privada, código ${code}` : '¡Vení a cantar karaoke conmigo!';
  if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) navigator.share({ title: 'Sala de Karaoke', text, url }).catch(() => {});
  else navigator.clipboard.writeText(url).then(() => toast('Enlace copiado: mandáselo a tus amigos.')).catch(() => toast(url, 8000));
}

function fullscreen() {
  const st = $('#stage');
  if (document.fullscreenElement || document.webkitFullscreenElement) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
  const req = st.requestFullscreen || st.webkitRequestFullscreen;
  if (req) req.call(st).then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} }).catch(() => {});
  else toast('Girá el celular para ver el video más grande.');
}

let wl = null;
async function wakeLock() {
  try { if ('wakeLock' in navigator && !document.hidden && (!wl || wl.released)) wl = await navigator.wakeLock.request('screen'); } catch (e) {}
}

function leave() {
  S.left = true;
  try { S.me && S.me.destroy(); } catch (e) {}
  try { S.reg && S.reg.destroy(); } catch (e) {}
  location.href = location.pathname;
}

// botón 🏠 de todos los juegos (../inicio.js): si estás en una sala, primero se sale bien
window.INICIO = {
  enJuego: () => !!S.me && !S.left,
  pregunta: '¿Salir de la sala de karaoke y volver a todos los juegos?',
  salir() {
    S.left = true;
    try { S.me && S.me.destroy(); } catch (e) {}
    try { S.reg && S.reg.destroy(); } catch (e) {}
  },
};
