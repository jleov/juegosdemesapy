/* =====================================================================
   Yva Rape — juego de unir 3 frutas por las ciudades del Paraguay.
   Motor del tablero, especiales y combos, mapa del recorrido, sonido,
   guardado en el aparato y compartir.
   ===================================================================== */
(function(){
'use strict';
const {FRUTAS, PROD, GUAMPA} = window.ARTE;
const {CIUDADES, NIVELES} = window.YVA;
const $ = s => document.querySelector(s);
let VEL = 1;
const esperar = ms => new Promise(r => setTimeout(r, ms / VEL));
const fmt = n => Math.round(n).toLocaleString('es-PY');
const azar = n => Math.floor(Math.random() * n);
const PL = {guitarra:'guitarras', vela:'velas', cantaro:'cántaros', bota:'botas de cuero', chipa:'chipas', poncho:'ponchos', miel:'frascos de miel',
  hamaca:'hamacas', gota:'gotas del salto', libro:'libros de poesía', mandioca:'mandiocas', nota:'notas de Mangoré', surubi:'surubíes',
  mascara:'máscaras de carnaval', campana:'campanas', yerba:'mates', rayo:'rayos de Itaipú', vaca:'vaquitas', cana:'cañas de azúcar',
  leche:'botellas de leche', nanduti:'ñandutí', frutilla:'frutillas', sandia:'sandías', naranja:'naranjas', mango:'mangos', banana:'bananas',
  pina:'piñas', mburukuja:'mburukujas', guayaba:'guayabas', aguacate:'aguacates', yvapuru:'yvapurũ', uva:'uvas', mbokaja:'mbokajas'};

/* ------------------------------ guardado ------------------------------ */
const CLAVE = 'yva_datos';
let datos = {max:0, est:{}, pts:{}};
try{ const d = JSON.parse(localStorage.getItem(CLAVE) || 'null'); if(d && typeof d.max === 'number') datos = Object.assign(datos, d); }catch(e){}
const guardar = () => { try{ localStorage.setItem(CLAVE, JSON.stringify(datos)); }catch(e){} };
const totalEstrellas = () => Object.values(datos.est).reduce((a, b) => a + b, 0);
/* ------------------------------ récords en línea ------------------------------ */
// Cada aparato tiene un código al azar (no es de la persona) y el nombre que elige mostrar.
const API_REC = /(^|\.)juegospy\.com$|\.pages\.dev$/.test(location.hostname) ? '/api/records' : 'https://juegospy.com/api/records';
const PRUEBA_LOCAL = location.protocol === 'file:' || /^(localhost|127\.|\[::1\])/.test(location.hostname);   // probando en la PC: no sube nada
const lsLeer = (k, d) => { try{ const v = localStorage.getItem(k); return v === null ? d : v; }catch(e){ return d; } };
const lsPoner = (k, v) => { try{ localStorage.setItem(k, v); }catch(e){} };
let miId = lsLeer('yva_id', '');
if(!/^[a-z0-9]{12,32}$/.test(miId)){ miId = Array.from({length: 20}, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[azar(36)]).join(''); lsPoner('yva_id', miId); }
let miNombre = lsLeer('yva_nombre', '');
if(!datos.sub) datos.sub = {};
const limpiaNombre = n => String(n || '').replace(/[\u0000-\u001f<>"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 18);
const esOfensivo = n => !!(window.FILTRO_CHAT && FILTRO_CHAT.ofensivo(n));
const totalPuntos = () => Object.values(datos.pts).reduce((a, b) => a + b, 0);
const escHtml = t => String(t).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
async function subirRecords(){
  if(!miNombre || PRUEBA_LOCAL) return false;
  const lista = Object.keys(datos.pts).filter(i => (datos.sub[i] || 0) < datos.pts[i]).map(i => [+i, datos.pts[i]]);
  const cuerpo = {g: 'frutas', id: miId, n: miNombre, lista, tot: totalPuntos(), est: totalEstrellas(), max: Object.keys(datos.est).length};
  try{
    const r = await fetch(API_REC, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(cuerpo)});
    if(!r.ok) return false;
    lista.forEach(([i, p]) => datos.sub[i] = p); guardar(); return true;
  }catch(e){ return false; }
}
async function leerRecords(niv){
  try{
    const r = await fetch(API_REC + '?g=frutas&id=' + miId + (niv !== undefined ? '&niv=' + niv : ''));
    const d = await r.json(); return r.ok ? d : null;
  }catch(e){ return null; }
}
// pide (o cambia) el nombre que se muestra en los récords
function pedirNombre(listo){
  modal(`<h2>🏆 Tu nombre</h2><p class="centro">Así vas a aparecer en la tabla de récords de todos.</p>
    <input id="nomRec" class="campo" maxlength="18" placeholder="Tu nombre o apodo" value="${escHtml(miNombre || limpiaNombre(lsLeer('jpy_chat_nombre', '')))}" autocomplete="nickname">
    <p class="aviso-nom" id="nomAviso"></p>
    <div class="acciones"><button class="btn grande" id="bNomOk">Guardar</button><button class="btn sec" id="bNomNo">Ahora no</button></div>`, true);
  const inp = $('#nomRec'); setTimeout(() => inp.focus(), 100);
  const ok = async () => {
    const n = limpiaNombre(inp.value);
    if(n.length < 2){ $('#nomAviso').textContent = 'Poné al menos 2 letras.'; return; }
    if(esOfensivo(n)){ $('#nomAviso').textContent = '🚫 Ese nombre tiene palabras ofensivas.'; return; }
    miNombre = n; lsPoner('yva_nombre', n);
    datos.sub = {}; guardar();   // con nombre nuevo se vuelve a subir todo
    son('toc'); cerrarModal();
    await subirRecords();
    if(listo) listo();
  };
  $('#bNomOk').onclick = ok; inp.onkeydown = e => { if(e.key === 'Enter') ok(); };
  $('#bNomNo').onclick = () => { cerrarModal(); if(listo) listo(); };
}
function filaRec(x, k, valor){
  const med = ['🥇', '🥈', '🥉'][k] || (k + 1) + '.';
  return `<li class="${x.yo ? 'yo' : ''}"><span class="pu">${med}</span><span class="no">${escHtml(x.n)}${x.yo ? ' <i>(vos)</i>' : ''}</span>${valor}</li>`;
}
async function verRecords(){
  son('toc');
  modal(`<h2>🏆 Récords</h2><p class="centro sub2">Los que más puntos juntaron en todo el recorrido</p><div id="recLista" class="reclista"><p class="centro">Cargando…</p></div>
    <div class="acciones"><button class="btn sec" id="bNom">${miNombre ? '✏️ ' + escHtml(miNombre) : '✏️ Poné tu nombre'}</button><button class="btn" id="bRecOk">Listo</button></div>`, true);
  $('#bRecOk').onclick = cerrarModal;
  $('#bNom').onclick = () => pedirNombre(verRecords);
  if(miNombre) await subirRecords();
  const d = await leerRecords();
  const el = $('#recLista'); if(!el) return;
  if(!d){ el.innerHTML = '<p class="centro">No se pudo cargar la tabla. Fijate si tenés internet.</p>'; return; }
  if(!d.lista.length){ el.innerHTML = '<p class="centro">Todavía nadie está en la tabla. ¡Sé el primero!</p>'; return; }
  let h = '<ol>' + d.lista.map((x, k) => filaRec(x, k, `<span class="va"><b>${fmt(x.tot)}</b><small>⭐ ${x.est} · ${x.max} niv.</small></span>`)).join('') + '</ol>';
  if(d.yo && !d.lista.some(x => x.yo)) h += `<p class="mipuesto">Vos estás en el puesto <b>${d.yo.puesto}</b> con ${fmt(d.yo.tot)} puntos</p>`;
  if(!miNombre) h += '<p class="mipuesto">Poné tu nombre para entrar en la tabla 👇</p>';
  el.innerHTML = h;
}
async function topNivel(i, sel){
  const el = $(sel); if(!el) return;
  const d = await leerRecords(i); if(!$(sel)) return;
  if(!d){ el.innerHTML = ''; return; }
  if(!d.lista.length){ el.innerHTML = '<p class="centro chico">🏆 Nadie tiene récord en este nivel todavía.</p>'; return; }
  el.innerHTML = '<p class="tit-rec">🏆 Mejores de este nivel</p><ol>' + d.lista.slice(0, 5).map((x, k) => filaRec(x, k, `<span class="va"><b>${fmt(x.pts)}</b></span>`)).join('') + '</ol>'
    + (d.yo && !d.lista.slice(0, 5).some(x => x.yo) ? `<p class="mipuesto">Tu puesto en este nivel: <b>${d.yo.puesto}</b></p>` : '');
}
let conSonido = true, conMusica = true;
try{ conSonido = localStorage.getItem('yva_snd') !== '0'; conMusica = localStorage.getItem('yva_mus') !== '0'; }catch(e){}

/* ------------------------------ sonido ------------------------------ */
let AC = null, master, sfx, mus, musTimer = null, musT = 0, musPaso = 0;
function audio(){
  try{
    if(!AC){
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain(); master.gain.value = .9; master.connect(AC.destination);
      sfx = AC.createGain(); sfx.gain.value = conSonido ? .8 : 0; sfx.connect(master);
      mus = AC.createGain(); mus.gain.value = conMusica ? .5 : 0;
      const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200; mus.connect(lp); lp.connect(master);
    }
    if(AC.state === 'suspended') AC.resume();
  }catch(e){}
  return AC;
}
const mf = m => 440 * Math.pow(2, (m - 69) / 12);
function tono(f, t0, dur, tipo, vol, dest, f2, ataque){
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = tipo || 'triangle'; o.frequency.setValueAtTime(f, t0);
  if(f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + (ataque || .005));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(dest || sfx); o.start(t0); o.stop(t0 + dur + .05);
}
let bufRuido = null;
function ruido(t0, dur, vol, f1, f2, tipo){
  if(!bufRuido){ bufRuido = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = bufRuido.getChannelData(0); for(let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = AC.createBufferSource(); s.buffer = bufRuido;
  const fl = AC.createBiquadFilter(); fl.type = tipo || 'bandpass'; fl.Q.value = 1.2;
  fl.frequency.setValueAtTime(f1, t0); if(f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  const g = AC.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(fl); fl.connect(g); g.connect(sfx); s.start(t0); s.stop(t0 + dur + .05);
}
// arpa paraguaya (cuerda pulsada)
function arpa(m, t0, vol, dest){ const f = mf(m); tono(f, t0, 1.1, 'triangle', vol, dest || mus); tono(f * 2, t0, .45, 'sine', vol * .35, dest || mus); }
function son(qual, n){
  if(!conSonido || !audio()) return;
  const t = AC.currentTime + .01;
  switch(qual){
    case 'toc': tono(900, t, .07, 'sine', .12); break;
    case 'swap': tono(420, t, .12, 'sine', .12, sfx, 640); break;
    case 'mal': tono(330, t, .12, 'square', .05); tono(220, t + .1, .16, 'square', .05); break;
    case 'junta': { const b = 72 + Math.min(n - 1, 8) * 2; [0, 4, 7, 12].forEach((d, i) => arpa(b + d, t + i * .035, .16, sfx)); break; }
    case 'crea': for(let i = 0; i < 6; i++) tono(mf(84 + i * 2), t + i * .04, .25, 'sine', .08); break;
    case 'raya': ruido(t, .35, .35, 500, 5000); tono(300, t, .3, 'sawtooth', .05, sfx, 1400); break;
    case 'bomba': tono(140, t, .45, 'sine', .4, sfx, 38); ruido(t, .4, .45, 900, 120, 'lowpass'); break;
    case 'guampa': for(let i = 0; i < 10; i++) tono(mf(72 + [0,4,7,12,16,19,24,28,31,36][i]), t + i * .05, .4, 'sine', .09); ruido(t, .8, .08, 3000, 9000, 'highpass'); break;
    case 'hielo': ruido(t, .12, .3, 5000, 2500, 'highpass'); tono(2400, t, .12, 'sine', .06); tono(3100, t + .04, .1, 'sine', .05); break;
    case 'tela': ruido(t, .1, .25, 1800, 700); tono(700, t, .08, 'triangle', .06, sfx, 300); break;
    case 'cajon': tono(190, t, .12, 'sine', .3, sfx, 120); ruido(t, .09, .3, 900, 500); break;
    case 'ing': arpa(84, t, .2, sfx); arpa(91, t + .09, .2, sfx); arpa(96, t + .18, .2, sfx); break;
    case 'estrella': tono(mf(79 + n * 5), t, .5, 'sine', .18); tono(mf(91 + n * 5), t, .3, 'triangle', .06); break;
    case 'gana': [62, 66, 69, 74, 78, 81, 86].forEach((m, i) => arpa(m, t + i * .08, .2, sfx)); tono(mf(74), t + .6, .9, 'triangle', .12); tono(mf(78), t + .6, .9, 'triangle', .1); break;
    case 'pierde': [69, 67, 64, 62].forEach((m, i) => tono(mf(m), t + i * .18, .35, 'triangle', .14)); break;
    case 'mezcla': for(let i = 0; i < 8; i++) tono(mf(70 + azar(14)), t + i * .04, .12, 'sine', .07); break;
    case 'fiesta': for(let i = 0; i < 5; i++) tono(mf(86 + i), t + i * .03, .15, 'sine', .05); break;
  }
}
// música: polca paraguaya en 6/8 con arpa, guitarra y bajo
const ACORDES = {D:[50, 54, 57, 62], A7:[45, 49, 52, 55], G:[43, 47, 50, 55]};
const PROG = ['D','D','A7','A7','A7','A7','D','D','G','G','D','D','A7','A7','D','D'];
const MEL = [78,81, 86,81, 85,79, 76,79, 81,85, 88,85, 86,81, 78,74, 79,83, 86,83, 81,78, 74,78, 76,79, 85,81, 78,76, 74,0];
function musicaTick(){
  if(!AC || !conMusica) return;
  const ochavo = .19;
  while(musT < AC.currentTime + .4){
    const compas = Math.floor(musPaso / 6) % 16, b = musPaso % 6, ac = ACORDES[PROG[compas]];
    if(b === 0) tono(mf(ac[0] - 12), musT, .5, 'sine', .22, mus);
    if(b === 3) tono(mf(ac[2] - 12), musT, .45, 'sine', .16, mus);
    const arp = [0, 1, 2, 3, 2, 1][b];
    arpa(ac[arp] + 24, musT, .055);
    if(b === 1 || b === 2 || b === 4 || b === 5) ac.slice(1).forEach(n => tono(mf(n + 12), musT, .1, 'sawtooth', .012, mus));
    if(b === 0 || b === 3){ const m = MEL[compas * 2 + (b ? 1 : 0)]; if(m) arpa(m, musT, .1); }
    musT += ochavo; musPaso++;
  }
}
function musica(on){
  if(on && conMusica && audio()){
    if(!musTimer){ musT = AC.currentTime + .1; musTimer = setInterval(musicaTick, 100); }
  } else if(musTimer){ clearInterval(musTimer); musTimer = null; }
}
function ponerSonido(){
  $('#btnSnd').textContent = conSonido ? '🔊' : '🔇';
  $('#btnMus').textContent = conMusica ? '🎵' : '🎶';
  $('#btnMus').style.opacity = conMusica ? 1 : .5;
  if(AC){ sfx.gain.value = conSonido ? .8 : 0; mus.gain.value = conMusica ? .5 : 0; }
}
$('#btnSnd').onclick = () => { conSonido = !conSonido; try{ localStorage.setItem('yva_snd', conSonido ? '1' : '0'); }catch(e){} ponerSonido(); son('toc'); };
$('#btnMus').onclick = () => { conMusica = !conMusica; try{ localStorage.setItem('yva_mus', conMusica ? '1' : '0'); }catch(e){} ponerSonido(); musica(conMusica); };
ponerSonido();
document.addEventListener('visibilitychange', () => { if(document.hidden){ musica(false); if(AC) AC.suspend(); } else if(AC){ AC.resume(); musica(true); } });

/* ------------------------------ dibujos ------------------------------ */
const IMG = {};   // Image de cada svg
const svgUrl = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
function cargarImg(k, s){ return new Promise(r => { const im = new Image(); im.onload = () => { IMG[k] = im; r(); }; im.onerror = () => r(); im.src = svgUrl(s); }); }
const listos = Promise.all([
  ...Object.keys(FRUTAS).map(k => cargarImg(k, FRUTAS[k].svg)),
  ...Object.keys(PROD).filter(k => !PROD[k].fruta).map(k => cargarImg('p_' + k, PROD[k].svg)),
  cargarImg('guampa', GUAMPA),
]);
let BMP = {}, bmpS = 0;
function rasterizar(S){
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5), px = Math.max(16, Math.round(S * dpr));
  if(px === bmpS) return; bmpS = px; BMP = {};
  for(const k in IMG){ const c = document.createElement('canvas'); c.width = c.height = px; c.getContext('2d').drawImage(IMG[k], 0, 0, px, px); BMP[k] = c; }
  // ñandutí (traba)
  const c = document.createElement('canvas'); c.width = c.height = px; const x = c.getContext('2d'); dibujarNanduti(x, px); BMP.tela = c;
}
function dibujarNanduti(x, s){
  x.save(); x.translate(s / 2, s / 2); const R = s * .5;
  x.strokeStyle = 'rgba(255,255,255,.95)'; x.lineWidth = Math.max(1, s / 60); x.shadowColor = 'rgba(120,0,60,.6)'; x.shadowBlur = s / 25;
  for(let i = 0; i < 16; i++){ const a = i * Math.PI / 8; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * R * .98, Math.sin(a) * R * .98); x.stroke(); }
  [.3, .55, .8, .97].forEach((f, j) => { x.beginPath(); for(let i = 0; i <= 16; i++){ const a = i * Math.PI / 8, rr = R * f * (i % 2 ? .9 : 1); i ? x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : x.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } x.stroke(); });
  x.shadowBlur = 0;
  for(let i = 0; i < 8; i++){ const a = i * Math.PI / 4 + Math.PI / 8; x.fillStyle = i % 2 ? '#ff5aa0' : '#ffd21a'; x.beginPath(); x.arc(Math.cos(a) * R * .67, Math.sin(a) * R * .67, s * .035, 0, 7); x.fill(); }
  x.fillStyle = '#ff4a8a'; x.beginPath(); x.arc(0, 0, s * .08, 0, 7); x.fill(); x.fillStyle = '#fff3a0'; x.beginPath(); x.arc(0, 0, s * .035, 0, 7); x.fill();
  x.restore();
}
function rr(x, X, Y, W, H, r){ x.beginPath(); if(x.roundRect) x.roundRect(X, Y, W, H, r); else x.rect(X, Y, W, H); }
function dibujarHielo(x, X, Y, S, n){
  const p = S * .04;
  const g = x.createLinearGradient(X, Y, X + S, Y + S);
  g.addColorStop(0, n > 1 ? 'rgba(235,250,255,.85)' : 'rgba(225,248,255,.6)'); g.addColorStop(1, n > 1 ? 'rgba(120,200,240,.8)' : 'rgba(140,210,245,.5)');
  x.fillStyle = g; rr(x, X + p, Y + p, S - 2 * p, S - 2 * p, S * .14); x.fill();
  x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = Math.max(1, S / 28); x.stroke();
  x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = Math.max(1, S / 22);
  x.beginPath(); x.moveTo(X + S * .18, Y + S * .3); x.lineTo(X + S * .3, Y + S * .18); x.moveTo(X + S * .18, Y + S * .46); x.lineTo(X + S * .46, Y + S * .18); x.stroke();
  if(n > 1){ x.strokeStyle = 'rgba(70,150,210,.6)'; x.lineWidth = Math.max(1, S / 40); rr(x, X + S * .14, Y + S * .14, S * .72, S * .72, S * .1); x.stroke(); }
}
function dibujarCajon(x, X, Y, S, n){
  const p = S * .05, w = S - 2 * p;
  const g = x.createLinearGradient(X, Y, X, Y + S);
  const col = [null, ['#e8b878', '#b87a3a'], ['#c8884a', '#8a5420'], ['#9a6030', '#5a3410']][n];
  g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
  x.fillStyle = g; rr(x, X + p, Y + p, w, w, S * .1); x.fill();
  x.strokeStyle = 'rgba(60,30,8,.85)'; x.lineWidth = Math.max(1, S / 24); x.stroke();
  x.strokeStyle = 'rgba(60,30,8,.45)'; x.lineWidth = Math.max(1, S / 40);
  x.beginPath(); for(let i = 1; i < 3; i++){ x.moveTo(X + p, Y + p + w * i / 3); x.lineTo(X + p + w, Y + p + w * i / 3); } x.stroke();
  x.strokeStyle = 'rgba(60,30,8,.6)'; x.lineWidth = Math.max(1, S / 18);
  x.beginPath(); x.moveTo(X + p * 2, Y + p * 2); x.lineTo(X + S - p * 2, Y + S - p * 2); x.stroke();
  if(n >= 2){ x.fillStyle = 'rgba(190,200,215,.95)'; x.fillRect(X + p, Y + S * .22, w, S * .1); x.fillRect(X + p, Y + S * .68, w, S * .1); }
  if(n >= 3){ x.fillStyle = '#e8eef5'; [[.2, .2], [.8, .2], [.2, .8], [.8, .8]].forEach(([a, b]) => { x.beginPath(); x.arc(X + S * a, Y + S * b, S * .05, 0, 7); x.fill(); }); }
}
function iconoCanvas(f){ const c = document.createElement('canvas'); c.width = c.height = 64; f(c.getContext('2d'), 64); return c.toDataURL(); }

/* ------------------------------ pantallas ------------------------------ */
const pantallas = ['#pTitulo', '#pMapa', '#pJuego'];
function verPantalla(id){
  pantallas.forEach(p => $(p).classList.toggle('on', p === id));
  document.body.dataset.p = id.slice(2).toLowerCase();
  if(id === '#pMapa') armarMapa();
}
function modal(html, cerrable){
  $('#modalIn').innerHTML = html; $('#modal').classList.add('on');
  $('#modal').onclick = cerrable ? (e => { if(e.target.id === 'modal') cerrarModal(); }) : null;
}
const cerrarModal = () => $('#modal').classList.remove('on');
let toastT = 0;
function toast(t){ const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2600); }
function cartel(t, cls){ const el = $('#cartel'); el.className = ''; el.textContent = t; void el.offsetWidth; el.className = 'on ' + (cls || ''); }
function pantallaCompleta(){
  try{ const d = document.documentElement; if(!document.fullscreenElement && d.requestFullscreen && matchMedia('(pointer:coarse)').matches) d.requestFullscreen({navigationUI:'hide'}).catch(() => {}); }catch(e){}
}

// portada del juego
function armarTitulo(){
  const n = Math.min(datos.max, NIVELES.length - 1), c = CIUDADES[NIVELES[n].ciudad];
  $('#resumen').innerHTML = datos.max > 0
    ? `Vas por <b>${c.n}</b> · nivel ${n + 1} de ${NIVELES.length} · ⭐ ${totalEstrellas()}`
    : `${NIVELES.length} niveles en ${CIUDADES.length} ciudades, de Asunción al Chaco`;
  $('#bJugar').textContent = datos.max > 0 ? '▶ Seguir el recorrido' : '▶ Empezar en Asunción';
}
$('#bJugar').onclick = () => { audio(); son('toc'); musica(true); pantallaCompleta(); verPantalla('#pMapa'); };
$('#bComo').onclick = () => { son('toc'); comoJugar(); };
$('#bRec').onclick = () => verRecords();
$('#bRecMapa').onclick = () => verRecords();
$('#bVolverT').onclick = () => { son('toc'); armarTitulo(); verPantalla('#pTitulo'); };
function comoJugar(){
  const im = k => `<img src="${svgUrl(FRUTAS[k].svg)}" alt="">`;
  modal(`<h2>¿Cómo se juega?</h2>
  <div class="ayuda">
   <p>Deslizá una fruta hacia la de al lado (o tocá una y después la vecina) para juntar <b>3 o más iguales</b> en línea. Desaparecen, caen las de arriba y si se forman más, ¡es combo!</p>
   <div class="fila"><span class="pz raya">${im('naranja')}</span><p><b>4 en línea:</b> fruta con rayitas. Al usarla limpia toda la fila o la columna, según para dónde van las rayitas.</p></div>
   <div class="fila"><span class="pz bomba">${im('guayaba')}</span><p><b>En forma de L o T:</b> bomba que explota todo alrededor.</p></div>
   <div class="fila"><span class="pz guampa"><img src="${svgUrl(GUAMPA)}" alt=""></span><p><b>5 en línea:</b> la guampa de tereré. Cambiala con una fruta y se van todas las de ese tipo. ¡Dos guampas juntas limpian todo el tablero!</p></div>
   <p><b>Combos:</b> rayitas + rayitas = cruz · rayitas + bomba = tres filas y tres columnas · bomba + bomba = explosión gigante · guampa + rayitas o bomba = todas las de ese color se vuelven especiales.</p>
   <p><b>Obstáculos:</b> 🧊 hielo del tereré (jugá encima para romperlo), 🕸️ ñandutí que traba la fruta (juntala para soltarla) y 📦 cajones (se rompen con jugadas al lado).</p>
   <p><b>Productos:</b> en algunas ciudades hay que bajar su producto típico (guitarras, chipas, velas…) hasta el fondo del tablero.</p>
   <p>Ganá de 1 a 3 ⭐ por nivel y seguí el camino de Asunción hasta el Chaco. Tu avance queda guardado en este aparato.</p>
  </div>
  <div class="acciones"><button class="btn" onclick="this.closest('#modal').classList.remove('on')">¡Dale!</button></div>`, true);
}

/* ------------------------------ mapa ------------------------------ */
function armarMapa(){
  const cont = $('#mapaIn'), W = Math.min(innerWidth, 520), paso = 96, extraCiudad = 150;
  let y = 90; const pos = [];
  let ciuAnt = -1; const bandas = [];
  NIVELES.forEach((n, i) => {
    if(n.ciudad !== ciuAnt){ if(bandas.length) bandas[bandas.length - 1].y2 = y + 20; y += extraCiudad; bandas.push({c:n.ciudad, y1:y - extraCiudad + 20, yBan:y - 70}); ciuAnt = n.ciudad; }
    pos.push({x: W / 2 + Math.sin(i * 1.05) * W * .27, y}); y += paso;
  });
  bandas[bandas.length - 1].y2 = y + 160;
  const H = y + 160;
  // de abajo hacia arriba: Asunción abajo
  const Y = v => H - v;
  let html = '';
  bandas.forEach((b, j) => {
    const c = CIUDADES[b.c];
    html += `<div class="banda" style="top:${Y(b.y2)}px;height:${b.y2 - b.y1}px;background:linear-gradient(0deg,${c.c1},${c.c2})"></div>`;
  });
  // camino
  let d = `M${pos[0].x} ${Y(pos[0].y - 120)}`;
  pos.forEach((p, i) => { if(i === 0){ d += ` L${p.x} ${Y(p.y)}`; return; } const a = pos[i - 1]; const my = (a.y + p.y) / 2; d += ` C${a.x} ${Y(my)} ${p.x} ${Y(my)} ${p.x} ${Y(p.y)}`; });
  html += `<svg class="camino" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><path d="${d}" stroke="rgba(90,50,20,.45)" stroke-width="22" fill="none" stroke-linecap="round"/>
    <path d="${d}" stroke="#f6e3b8" stroke-width="15" fill="none" stroke-linecap="round"/><path d="${d}" stroke="#d9b878" stroke-width="2.5" stroke-dasharray="2 12" fill="none" stroke-linecap="round"/></svg>`;
  // adornos: lapachos y palmeras
  let semilla = 7; const rnd = () => (semilla = (semilla * 9301 + 49297) % 233280) / 233280;
  for(let yy = 140; yy < H - 100; yy += 70){
    const lado = rnd() < .5, x = lado ? 10 + rnd() * W * .14 : W - 40 - rnd() * W * .14, tipo = rnd();
    html += `<div class="adorno" style="left:${x}px;top:${yy}px">${tipo < .4 ? '🌳' : tipo < .65 ? '🌴' : tipo < .85 ? '<span class="lapacho">🌸</span>' : '🏡'}</div>`;
  }
  bandas.forEach(b => {
    const c = CIUDADES[b.c], pr = PROD[c.prod];
    html += `<div class="ciudad" style="top:${Y(b.yBan) - 34}px"><img src="${svgUrl(pr.svg)}" alt=""><div><b>${c.n}</b><span>${pr.nom}</span></div></div>`;
  });
  pos.forEach((p, i) => {
    const est = datos.est[i] || 0, abierto = i <= datos.max, actual = i === Math.min(datos.max, NIVELES.length - 1);
    html += `<button class="nodo ${abierto ? 'abierto' : 'cerrado'} ${actual ? 'actual' : ''}" style="left:${p.x - 27}px;top:${Y(p.y) - 27}px" data-i="${i}" aria-label="Nivel ${i + 1}">
      ${abierto ? i + 1 : '🔒'}${est ? `<span class="est">${'⭐'.repeat(est)}${'<i>☆</i>'.repeat(3 - est)}</span>` : ''}${actual ? '<span class="pin">📍</span>' : ''}</button>`;
  });
  html += `<div class="meta-chaco" style="top:${Y(H - 70) - 20}px">🏁 ¡Fin del recorrido!</div>`;
  cont.style.height = H + 'px'; cont.style.width = W + 'px'; cont.innerHTML = html;
  cont.querySelectorAll('.nodo.abierto').forEach(b => b.onclick = () => { son('toc'); previaNivel(+b.dataset.i); });
  cont.querySelectorAll('.nodo.cerrado').forEach(b => b.onclick = () => { son('mal'); toast('Primero ganá el nivel anterior 🔒'); });
  $('#mEst').textContent = `⭐ ${totalEstrellas()} / ${NIVELES.length * 3}`;
  const act = Math.min(datos.max, NIVELES.length - 1);
  requestAnimationFrame(() => { const sc = $('#mapa'); sc.scrollTop = Y(pos[act].y) - sc.clientHeight * .6; });
}
function textoMeta(n, k, v){
  switch(k){
    case 'pts': return `Hacé ${fmt(v)} puntos`;
    case 'fr': return v.map(([f, c]) => `${c} ${PL[n.frutas[f]] || n.frutas[f]}`).join(', ').replace(/^/, 'Juntá ');
    case 'hielo': return 'Rompé todo el hielo';
    case 'tela': return 'Soltá todos los ñandutí';
    case 'bloq': return 'Rompé todos los cajones';
    case 'baj': return `Bajá ${v} ${PL[n.prod]} hasta abajo`;
  }
}
function previaNivel(i){
  const n = NIVELES[i], c = CIUDADES[n.ciudad], pr = PROD[c.prod], est = datos.est[i] || 0;
  modal(`<div class="previa" style="--c1:${c.c1};--c2:${c.c2}">
    <div class="pcab"><img src="${svgUrl(pr.svg)}" alt=""><div><small>Nivel ${i + 1}</small><h2>${c.n}</h2></div></div>
    <p class="dato">${c.dato}</p>
    <ul class="metas">${Object.keys(n.g).map(k => `<li>🎯 ${textoMeta(n, k, n.g[k])}</li>`).join('')}
      <li>${n.s ? `⏱ en ${n.s} segundos` : `👆 en ${n.m} movidas`}</li></ul>
    ${n.tip ? `<p class="tip">💡 ${n.tip}</p>` : ''}
    <div class="eprev">${[1, 2, 3].map(k => `<span class="${k <= est ? 'si' : ''}">★</span>`).join('')}${datos.pts[i] ? `<small>Mejor: ${fmt(datos.pts[i])}</small>` : ''}</div>
    <div class="acciones"><button class="btn grande" id="bIr">¡A jugar!</button><button class="btn sec" onclick="this.closest('#modal').classList.remove('on')">Volver</button></div>
    <div class="toprec" id="topNiv"></div></div>`, true);
  $('#bIr').onclick = () => { cerrarModal(); audio(); son('toc'); musica(true); empezar(i); };
  topNivel(i, '#topNiv');
}

/* ------------------------------ motor ------------------------------ */
const cv = $('#tablero'), ctx = cv.getContext('2d');
let G = null, S = 40, OX = 0, OY = 0, clip = null, panel = null, sel = null, arrastre = null, pista = null, pistaT = 0, ultimoToque = 0;
let parts = [], textos = [], rayos = [], temblor = 0, idPieza = 1;

function nuevaPieza(k, x, y, sp){ return {id: idPieza++, k, sp: sp || null, x, y, vy: 0, sc: 1, tw: null, sq: 0, nace: performance.now()}; }
function empezar(i){
  const n = NIVELES[i];
  const R = n.mapa.length, C = n.mapa[0].length;
  G = {i, n, R, C, cel: [], P: [], pts: 0, mov: n.m, tiempo: n.s, cont: {fr: n.frutas.map(() => 0), baj: 0}, tot: {},
       bloqueo: true, fin: false, pausa: false, combo: 0, ingNacidos: 0, techo: [], fondo: [], comboMax: 0};
  for(let r = 0; r < R; r++){
    G.cel.push([]); G.P.push([]);
    for(let c = 0; c < C; c++){
      const ch = n.mapa[r][c];
      G.cel[r].push({ok: ch !== '#', ice: ch === 'i' || ch === 'W' ? 1 : ch === 'I' ? 2 : 0, web: ch === 'w' || ch === 'W', blk: ch === 'b' ? 1 : ch === 'B' ? 2 : ch === 'C' ? 3 : 0});
      G.P[r].push(null);
    }
  }
  for(let c = 0; c < C; c++){
    let t = -1, f = -1; for(let r = 0; r < R; r++) if(G.cel[r][c].ok){ if(t < 0) t = r; f = r; }
    G.techo.push(t); G.fondo.push(f);
  }
  G.tot = {hielo: contarObst('ice'), tela: contarObst('web'), bloq: contarObst('blk')};
  // llenar sin juntas de entrada
  for(let r = 0; r < R; r++) for(let c = 0; c < C; c++){
    const ce = G.cel[r][c]; if(!ce.ok || ce.blk) continue;
    let k, intentos = 0;
    do{ k = azar(n.frutas.length); intentos++; } while(intentos < 30 && ((c >= 2 && llave(r, c - 1) === k && llave(r, c - 2) === k) || (r >= 2 && llave(r - 1, c) === k && llave(r - 2, c) === k)));
    G.P[r][c] = nuevaPieza(k, c, r - R - 1 + (R - r) * .15);
  }
  if(n.g.baj){ const cs = []; for(let c = 0; c < C; c++) if(G.techo[c] >= 0 && !G.cel[G.techo[c]][c].blk && !G.cel[G.techo[c]][c].web) cs.push(c);
    for(let q = 0; q < Math.min(3, n.g.baj) && cs.length; q++){ const c = cs.splice(azar(cs.length), 1)[0]; G.P[G.techo[c]][c] = Object.assign(nuevaPieza(-1, c, -2 - q), {ing: true}); G.ingNacidos++; } }
  if(!buscarJugadas().length) mezclarDatos();
  parts = []; textos = []; rayos = []; sel = null; pista = null;
  $('#pieCiudad').textContent = CIUDADES[n.ciudad].n; $('#pieNivel').textContent = `Nivel ${i + 1}`;
  const c = CIUDADES[n.ciudad];
  $('#pJuego').style.setProperty('--c1', c.c1); $('#pJuego').style.setProperty('--c2', c.c2);
  armarHUD(); verPantalla('#pJuego'); medir();
  setTimeout(async () => { await asentar(); if(!G || G.i !== i) return; G.bloqueo = false; pistaT = performance.now(); if(n.tip && i < 3) cartel(['¡Vamos!', '¡Dale!', '¡A juntar!'][i % 3]); }, 50);
  if(window.JPY_CONTAR && !empezar.contado){ empezar.contado = 1; window.JPY_CONTAR('p'); }
}
function contarObst(q){ let t = 0; for(const fila of G.cel) for(const ce of fila) t += q === 'web' ? (ce.web ? 1 : 0) : (ce[q] > 0 ? 1 : 0); return t; }
function llave(r, c){
  if(r < 0 || c < 0 || r >= G.R || c >= G.C) return -1;
  const ce = G.cel[r][c], p = G.P[r][c];
  if(!ce.ok || ce.blk || !p || p.ing || p.sp === 'g' || p.k < 0) return -1;
  return p.k;
}
const movil = (r, c) => r >= 0 && c >= 0 && r < G.R && c < G.C && G.cel[r][c].ok && !G.cel[r][c].blk && !G.cel[r][c].web && !!G.P[r][c];
function hayRunEn(r, c){
  const k = llave(r, c); if(k < 0) return false;
  let a = 1; for(let x = c - 1; llave(r, x) === k; x--) a++; for(let x = c + 1; llave(r, x) === k; x++) a++; if(a >= 3) return true;
  a = 1; for(let y = r - 1; llave(y, c) === k; y--) a++; for(let y = r + 1; llave(y, c) === k; y++) a++; return a >= 3;
}
// cuánto conviene una jugada (para la pista): tamaño, especiales y lo que ayuda a las metas
function valorEn(r, c){
  const k = llave(r, c); if(k < 0) return 0;
  const h = [{r, c}], v = [];
  for(let x = c - 1; llave(r, x) === k; x--) h.push({r, c: x}); for(let x = c + 1; llave(r, x) === k; x++) h.push({r, c: x});
  for(let y = r - 1; llave(y, c) === k; y--) v.push({r: y, c}); for(let y = r + 1; llave(y, c) === k; y++) v.push({r: y, c});
  const cs = [...(h.length >= 3 ? h : []), ...(v.length >= 2 ? v : [])];
  if(cs.length < 3) return 0;
  let val = cs.length + (h.length >= 5 || v.length >= 4 ? 12 : (h.length >= 3 && v.length >= 2) ? 7 : (h.length === 4 || v.length === 3) ? 4 : 0);
  const g = G.n.g, metaFr = g.fr && g.fr.find(([f, q]) => f === k && G.cont.fr[f] < q);
  for(const x of cs){
    const ce = G.cel[x.r][x.c];
    val += ce.ice * 2.5 + (ce.web ? 3 : 0) + (metaFr ? 1.5 : 0) + x.r * .05;
    for(const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ const r2 = x.r + dr, c2 = x.c + dc; if(r2 >= 0 && c2 >= 0 && r2 < G.R && c2 < G.C && G.cel[r2][c2].blk) val += 2.5; }
    if(g.baj) for(let y = x.r - 1; y >= 0; y--) if(G.P[y][x.c] && G.P[y][x.c].ing){ val += 3; break; }
  }
  return val;
}
function cambiarDatos(a, b){ const t = G.P[a.r][a.c]; G.P[a.r][a.c] = G.P[b.r][b.c]; G.P[b.r][b.c] = t; }
function buscarJugadas(){
  const res = [];
  for(let r = 0; r < G.R; r++) for(let c = 0; c < G.C; c++){
    if(!movil(r, c)) continue;
    for(const [dr, dc] of [[0, 1], [1, 0]]){
      const r2 = r + dr, c2 = c + dc; if(!movil(r2, c2)) continue;
      const a = G.P[r][c], b = G.P[r2][c2];
      if(a.ing && b.ing) continue;
      let val = 0;
      if((a.sp === 'g' || b.sp === 'g') && !a.ing && !b.ing) val = 40 + (a.sp && b.sp ? 30 : 0);
      else if(a.sp && b.sp && !a.ing && !b.ing) val = 30;
      else {
        cambiarDatos({r, c}, {r: r2, c: c2});
        const l = valorEn(r, c) + valorEn(r2, c2);
        const baja = (G.P[r2][c2].ing && dr) ? 5 : 0;
        cambiarDatos({r, c}, {r: r2, c: c2});
        if(l) val = l + baja;
      }
      if(val) res.push({a: {r, c}, b: {r: r2, c: c2}, val});
    }
  }
  return res;
}
function mezclarDatos(){
  const lug = [];
  for(let r = 0; r < G.R; r++) for(let c = 0; c < G.C; c++){ const p = G.P[r][c]; if(p && !p.sp && !p.ing && G.cel[r][c].ok && !G.cel[r][c].blk) lug.push({r, c}); }
  const ks = lug.map(({r, c}) => G.P[r][c].k);
  for(let t = 0; t < 300; t++){
    if(t < 150){ for(let i = ks.length - 1; i > 0; i--){ const j = azar(i + 1); [ks[i], ks[j]] = [ks[j], ks[i]]; } }
    else for(let i = 0; i < ks.length; i++) ks[i] = azar(G.n.frutas.length);
    lug.forEach(({r, c}, i) => G.P[r][c].k = ks[i]);
    let junta = false; for(const {r, c} of lug) if(hayRunEn(r, c)){ junta = true; break; }
    if(!junta && buscarJugadas().length) return true;
  }
  return false;
}
async function mezclar(){
  cartel('¡Mezclando!'); son('mezcla');
  for(const f of G.P) for(const p of f) if(p && !p.sp && !p.ing) p.gira = performance.now();
  await esperar(350); mezclarDatos(); await esperar(450);
}

// caída: primero derecho para abajo; si una casilla quedó tapada, entra en diagonal
function libre(r, c){ const ce = G.cel[r][c]; return ce.ok && !ce.blk && !G.P[r][c]; }
function caer(){
  const nacidos = new Array(G.C).fill(0);
  let cambio = true, vueltas = 0;
  while(cambio && vueltas++ < 400){
    cambio = false;
    for(let c = 0; c < G.C; c++) for(let r = G.R - 1; r >= 0; r--){
      if(!libre(r, c)) continue;
      let rr = r - 1, hallado = -1;
      while(rr >= 0){ const ce = G.cel[rr][c]; if(!ce.ok){ rr--; continue; } if(ce.blk || ce.web) break; if(G.P[rr][c]){ hallado = rr; break; } rr--; }
      if(hallado >= 0){ G.P[r][c] = G.P[hallado][c]; G.P[hallado][c] = null; cambio = true; }
      else if(rr < 0){ G.P[r][c] = piezaNueva(c, G.techo[c] - 1 - nacidos[c]++); cambio = true; }
    }
    if(!cambio){
      fuera: for(let r = G.R - 1; r >= 1; r--) for(let c = 0; c < G.C; c++){
        if(!libre(r, c)) continue;
        const lados = Math.random() < .5 ? [-1, 1] : [1, -1];
        for(const dc of lados){ const c2 = c + dc; if(movil(r - 1, c2)){ G.P[r][c] = G.P[r - 1][c2]; G.P[r - 1][c2] = null; cambio = true; break fuera; } }
      }
    }
  }
}
function piezaNueva(c, y){
  const n = G.n;
  if(n.g.baj){
    let enTablero = 0; for(const f of G.P) for(const p of f) if(p && p.ing) enTablero++;
    const faltan = n.g.baj - G.cont.baj - enTablero;
    if(faltan > 0 && enTablero < 3 && G.ingNacidos < n.g.baj + 3 && Math.random() < (enTablero < 2 ? .4 : .06)){ G.ingNacidos++; return Object.assign(nuevaPieza(-1, c, y), {ing: true}); }
  }
  return nuevaPieza(azar(n.frutas.length), c, y);
}
function asentar(){
  return new Promise(res => {
    const t0 = performance.now();
    const ver = () => {
      if(!G) return res();
      let quieto = true;
      for(let r = 0; r < G.R && quieto; r++) for(let c = 0; c < G.C; c++){ const p = G.P[r][c]; if(p && (p.tw || p.x !== c || p.y !== r)){ quieto = false; break; } }
      if(quieto || performance.now() - t0 > 4000) res(); else setTimeout(ver, 16);
    };
    ver();
  });
}
function buscarGrupos(){
  const runs = [];
  for(let r = 0; r < G.R; r++){ let c = 0; while(c < G.C){ const k = llave(r, c); if(k < 0){ c++; continue; } let e = c + 1; while(e < G.C && llave(r, e) === k) e++; if(e - c >= 3){ const cs = []; for(let x = c; x < e; x++) cs.push({r, c: x}); runs.push({d: 'h', cs}); } c = e; } }
  for(let c = 0; c < G.C; c++){ let r = 0; while(r < G.R){ const k = llave(r, c); if(k < 0){ r++; continue; } let e = r + 1; while(e < G.R && llave(e, c) === k) e++; if(e - r >= 3){ const cs = []; for(let y = r; y < e; y++) cs.push({r: y, c}); runs.push({d: 'v', cs}); } r = e; } }
  // unir los que comparten casilla
  const padre = runs.map((_, i) => i), raiz = i => padre[i] === i ? i : (padre[i] = raiz(padre[i]));
  const due = {};
  runs.forEach((ru, i) => ru.cs.forEach(({r, c}) => { const k = r * 100 + c; if(due[k] !== undefined) padre[raiz(i)] = raiz(due[k]); else due[k] = i; }));
  const grupos = {};
  runs.forEach((ru, i) => { const g = grupos[raiz(i)] || (grupos[raiz(i)] = {runs: [], cs: new Map()}); g.runs.push(ru); ru.cs.forEach(x => g.cs.set(x.r * 100 + x.c, x)); });
  return Object.values(grupos);
}

// golpe en una casilla: rompe hielo, ñandutí, cajón o la fruta (y dispara si es especial)
function golpe(r, c, tipo){
  if(r < 0 || c < 0 || r >= G.R || c >= G.C) return [];
  const ce = G.cel[r][c]; if(!ce.ok) return [];
  if(tipo === 'adj'){ if(ce.blk){ romperCajon(r, c); } return []; }
  if(ce.blk){ romperCajon(r, c); return []; }
  const p = G.P[r][c];
  if(ce.web){ ce.web = false; son('tela'); chispas(r, c, '#ffffff', 10, 'hilo'); }
  if(ce.ice > 0){ ce.ice--; son('hielo'); chispas(r, c, '#d8f4ff', 9, 'hielo'); if(!ce.ice) sumar(r, c, 50); }
  if(tipo === 'fondo' || !p || p.ing) return [];
  G.P[r][c] = null;
  morir(p, r, c);
  if(p.k >= 0) contarFruta(p.k, r, c);
  if(tipo === 'e') G.pts += 60;
  return p.sp ? activar(p, r, c) : [];
}
function romperCajon(r, c){ const ce = G.cel[r][c]; ce.blk--; son('cajon'); chispas(r, c, '#c8884a', 10, 'astilla'); temblor = Math.max(temblor, 3); if(!ce.blk) sumar(r, c, 100); }
function contarFruta(k, r, c){
  G.cont.fr[k]++;
  const meta = G.n.g.fr && G.n.g.fr.find(([f]) => f === k);
  if(meta && G.cont.fr[k] <= meta[1]) volarA(`#meta-fr${k}`, G.n.frutas[k], r, c);
}
function activar(p, r, c){
  const cs = [];
  if(p.sp === 'h'){ for(let x = 0; x < G.C; x++) if(x !== c) cs.push({r, c: x, t: 'e'}); rayos.push({tipo: 'h', r, c, t: 0}); son('raya'); }
  else if(p.sp === 'v'){ for(let y = 0; y < G.R; y++) if(y !== r) cs.push({r: y, c, t: 'e'}); rayos.push({tipo: 'v', r, c, t: 0}); son('raya'); }
  else if(p.sp === 'b'){ for(let y = -2; y <= 2; y++) for(let x = -2; x <= 2; x++) if((x || y) && !(Math.abs(x) === 2 && Math.abs(y) === 2)) cs.push({r: r + y, c: c + x, t: 'e'}); rayos.push({tipo: 'b', r, c, t: 0, rad: 2.5}); son('bomba'); temblor = 8; }
  else if(p.sp === 'g'){
    const cuenta = {}; for(const f of G.P) for(const q of f) if(q && q.k >= 0 && !q.ing) cuenta[q.k] = (cuenta[q.k] || 0) + 1;
    const k = +Object.keys(cuenta).sort((a, b) => cuenta[b] - cuenta[a])[0];
    if(!isNaN(k)) for(let y = 0; y < G.R; y++) for(let x = 0; x < G.C; x++){ const q = G.P[y][x]; if(q && q.k === k && !q.ing){ cs.push({r: y, c: x, t: 'e'}); rayos.push({tipo: 'l', r, c, r2: y, c2: x, t: 0}); } }
    son('guampa');
  }
  return cs;
}
async function golpear(lista){
  let ola = lista;
  for(let v = 0; ola.length && v < 40; v++){
    const sig = [];
    for(const x of ola) sig.push(...golpe(x.r, x.c, x.t));
    actualizarHUD();
    if(sig.length) await esperar(130);
    ola = sig;
  }
}
const PALABRAS = ['', '', '¡Iporã!', '¡Mbarete!', '¡Iporãiterei!', '¡Hetaiterei!', '¡Ndaipóri iguáicha!'];
async function resolver(mov){
  let cascada = 0;
  for(let vuelta = 0; vuelta < 80 && G; vuelta++){
    caer(); await asentar(); if(!G) return;
    const grupos = buscarGrupos();
    if(!grupos.length){ if(sacarIngredientes()){ await esperar(320); continue; } break; }
    cascada++; G.comboMax = Math.max(G.comboMax, cascada);
    son('junta', cascada);
    if(cascada >= 2) cartel(PALABRAS[Math.min(cascada, PALABRAS.length - 1)], 'combo');
    const golpes = [], adj = new Map(), crear = [];
    for(const g of grupos){
      const cs = [...g.cs.values()], maxL = Math.max(...g.runs.map(x => x.cs.length));
      const hayH = g.runs.some(x => x.d === 'h'), hayV = g.runs.some(x => x.d === 'v');
      let tipo = maxL >= 5 ? 'g' : (hayH && hayV) ? 'b' : maxL === 4 ? (g.runs.find(x => x.cs.length === 4).d) : null;
      let pos = null;
      if(tipo){
        const en = m => m && cs.find(x => x.r === m.r && x.c === m.c && !G.P[x.r][x.c].sp);
        pos = (mov && (en(mov[0]) || en(mov[1]))) || null;
        if(!pos && tipo === 'b'){ const h = g.runs.filter(x => x.d === 'h').flatMap(x => x.cs), v = g.runs.filter(x => x.d === 'v').flatMap(x => x.cs); pos = h.find(a => v.some(b => b.r === a.r && b.c === a.c)); if(pos && G.P[pos.r][pos.c].sp) pos = null; }
        if(!pos){ const ru = g.runs.reduce((a, b) => b.cs.length > a.cs.length ? b : a); const libres = ru.cs.filter(x => !G.P[x.r][x.c].sp); pos = libres[Math.floor(libres.length / 2)] || cs.find(x => !G.P[x.r][x.c].sp); }
        if(!pos) tipo = null;
      }
      const k0 = G.P[cs[0].r][cs[0].c].k;
      for(const x of cs){
        if(pos && x.r === pos.r && x.c === pos.c) golpes.push({r: x.r, c: x.c, t: 'fondo'}); else golpes.push({r: x.r, c: x.c, t: 'm'});
        for(const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ const r2 = x.r + dr, c2 = x.c + dc; if(r2 >= 0 && c2 >= 0 && r2 < G.R && c2 < G.C && G.cel[r2][c2].blk) adj.set(r2 * 100 + c2, {r: r2, c: c2, t: 'adj'}); }
      }
      const puntos = cs.length * 60 * cascada + (tipo === 'g' ? 400 : tipo === 'b' ? 200 : tipo ? 120 : 0);
      G.pts += puntos;
      const cm = cs.reduce((a, x) => ({r: a.r + x.r / cs.length, c: a.c + x.c / cs.length}), {r: 0, c: 0});
      textos.push({x: cm.c, y: cm.r, txt: '+' + fmt(puntos), t: 0, col: FRUTAS[G.n.frutas[k0]] ? FRUTAS[G.n.frutas[k0]].col : '#fff'});
      if(tipo) crear.push({r: pos.r, c: pos.c, k: tipo === 'g' ? -1 : G.P[pos.r][pos.c].k, sp: tipo});
    }
    await golpear([...golpes, ...adj.values()]);
    if(!G) return;
    for(const cr of crear){
      const p = G.P[cr.r][cr.c];
      if(p && !p.sp){ p.sp = cr.sp; p.k = cr.k; p.forma = performance.now(); }
      else if(!p){ G.P[cr.r][cr.c] = Object.assign(nuevaPieza(cr.k, cr.c, cr.r, cr.sp), {forma: performance.now()}); }
      son('crea'); chispas(cr.r, cr.c, '#fff7b0', 14, 'estrella');
    }
    mov = null;
    actualizarHUD();
    await esperar(crear.length ? 180 : 60);
  }
}
function sacarIngredientes(){
  let alguno = false;
  for(let c = 0; c < G.C; c++){
    const r = G.fondo[c]; if(r < 0) continue;
    const p = G.P[r][c];
    if(p && p.ing){ G.P[r][c] = null; G.cont.baj++; G.pts += 1000; morir(p, r, c, true); son('ing'); volarA('#meta-baj', 'p_' + G.n.prod, r, c, true); textos.push({x: c, y: r, txt: '+1.000', t: 0, col: '#ffe27a'}); alguno = true; }
  }
  if(alguno) actualizarHUD();
  return alguno;
}

async function jugar(a, b){
  if(!G || G.bloqueo || G.fin || G.pausa) return;
  if(!movil(a.r, a.c) || !movil(b.r, b.c) || Math.abs(a.r - b.r) + Math.abs(a.c - b.c) !== 1) return;
  const pa = G.P[a.r][a.c], pb = G.P[b.r][b.c];
  if(pa.ing && pb.ing) return;
  G.bloqueo = true; pista = null; sel = null;
  const conG = (pa.sp === 'g' || pb.sp === 'g') && !pa.ing && !pb.ing, dos = pa.sp && pb.sp && !pa.ing && !pb.ing;
  if(conG || dos){
    G.mov = Math.max(0, G.mov - (G.n.s ? 0 : 1)); actualizarHUD();
    pa.tw = {x0: pa.x, y0: pa.y, x1: (a.c + b.c) / 2, y1: (a.r + b.r) / 2, t: 0, d: .14}; son('swap');
    await esperar(150);
    await combo(a, b, pa, pb);
    await resolver(null);
    return finJugada();
  }
  cambiarDatos(a, b); animarCambio(a, b); son('swap');
  await esperar(180);
  if(!hayRunEn(a.r, a.c) && !hayRunEn(b.r, b.c)){
    cambiarDatos(a, b); animarCambio(a, b); son('mal'); await esperar(180);
    G.bloqueo = false; pistaT = performance.now(); return;
  }
  if(!G.n.s) G.mov--;
  actualizarHUD();
  await resolver([b, a]);
  return finJugada();
}
function animarCambio(a, b){
  for(const q of [a, b]){ const p = G.P[q.r][q.c]; if(p) p.tw = {x0: p.x, y0: p.y, x1: q.c, y1: q.r, t: 0, d: .16}; }
}
async function combo(a, b, pa, pb){
  const quitar = () => { for(const [q, p] of [[a, pa], [b, pb]]){ if(G.P[q.r][q.c] === p){ G.P[q.r][q.c] = null; morir(p, q.r, q.c); if(p.k >= 0) contarFruta(p.k, q.r, q.c); } } };
  const todos = [];
  if(pa.sp === 'g' && pb.sp === 'g'){
    quitar(); son('guampa'); cartel('¡Tereré para todos!', 'grande'); temblor = 14;
    rayos.push({tipo: 'b', r: b.r, c: b.c, t: 0, rad: 12});
    for(let r = 0; r < G.R; r++) for(let c = 0; c < G.C; c++) todos.push({r, c, t: 'e'});
    G.pts += 5000; await esperar(250); await golpear(todos); return;
  }
  if(pa.sp === 'g' || pb.sp === 'g'){
    const gq = pa.sp === 'g' ? a : b, gp = pa.sp === 'g' ? pa : pb, o = pa.sp === 'g' ? pb : pa;
    const k = o.k, sp = o.sp;
    G.P[gq.r][gq.c] = null; morir(gp, gq.r, gq.c); son('guampa');
    const lista = [];
    for(let r = 0; r < G.R; r++) for(let c = 0; c < G.C; c++){ const q = G.P[r][c]; if(q && q.k === k && !q.ing && q.sp !== 'g'){ lista.push({r, c, t: 'e'}); rayos.push({tipo: 'l', r: gq.r, c: gq.c, r2: r, c2: c, t: 0}); } }
    if(sp === 'h' || sp === 'v' || sp === 'b'){
      cartel(sp === 'b' ? '¡Lluvia de bombas!' : '¡Rayitas por todos lados!', 'grande');
      for(const x of lista){ const q = G.P[x.r][x.c]; q.sp = sp === 'b' ? 'b' : (Math.random() < .5 ? 'h' : 'v'); q.forma = performance.now(); son('fiesta'); await esperar(45); }
      await esperar(300); G.pts += 2000;
    } else { cartel('¡Guampa!', 'grande'); await esperar(260); G.pts += 1000; }
    await golpear(lista); return;
  }
  // dos especiales
  quitar();
  const tipos = [pa.sp, pb.sp].sort().join('');
  const r = b.r, c = b.c;
  if(tipos === 'bb'){
    cartel('¡Bombazo!', 'grande'); son('bomba'); temblor = 14; rayos.push({tipo: 'b', r, c, t: 0, rad: 4});
    for(let y = -3; y <= 3; y++) for(let x = -3; x <= 3; x++) todos.push({r: r + y, c: c + x, t: 'e'});
  } else if(tipos.includes('b')){
    cartel('¡Rayos triples!', 'grande'); son('raya');
    for(let d = -1; d <= 1; d++){ rayos.push({tipo: 'h', r: r + d, c, t: 0}, {tipo: 'v', r, c: c + d, t: 0}); for(let x = 0; x < G.C; x++) todos.push({r: r + d, c: x, t: 'e'}); for(let y = 0; y < G.R; y++) todos.push({r: y, c: c + d, t: 'e'}); }
  } else {
    cartel('¡Cruz!', 'grande'); son('raya'); rayos.push({tipo: 'h', r, c, t: 0}, {tipo: 'v', r, c, t: 0});
    for(let x = 0; x < G.C; x++) todos.push({r, c: x, t: 'e'}); for(let y = 0; y < G.R; y++) todos.push({r: y, c, t: 'e'});
  }
  G.pts += 800; await esperar(120); await golpear(todos);
}

function metas(){
  const n = G.n, g = n.g, res = [];
  if(g.pts) res.push({k: 'pts', falta: Math.max(0, g.pts - G.pts)});
  if(g.fr) g.fr.forEach(([f, q]) => res.push({k: 'fr' + f, falta: Math.max(0, q - G.cont.fr[f])}));
  if(g.hielo) res.push({k: 'hielo', falta: contarObst('ice')});
  if(g.tela) res.push({k: 'tela', falta: contarObst('web')});
  if(g.bloq) res.push({k: 'bloq', falta: contarObst('blk')});
  if(g.baj) res.push({k: 'baj', falta: Math.max(0, g.baj - G.cont.baj)});
  return res;
}
const cumplidas = () => metas().every(m => !m.falta);
const soloPuntos = () => Object.keys(G.n.g).length === 1 && G.n.g.pts;
async function finJugada(){
  if(!G) return;
  actualizarHUD();
  const sinMov = G.n.s ? G.tiempo <= 0 : G.mov <= 0;
  if(cumplidas() && (!soloPuntos() || sinMov)){ G.fin = true; if(!soloPuntos()) await fiesta(); return ganar(); }
  if(sinMov){ G.fin = true; return soloPuntos() && cumplidas() ? ganar() : perder(); }
  if(!buscarJugadas().length){ await mezclar(); }
  G.bloqueo = false; pistaT = performance.now();
}
async function fiesta(){
  cartel('¡Fiesta de frutas!', 'grande'); await esperar(700);
  let n = G.n.s ? Math.min(10, Math.floor(G.tiempo / 4)) : Math.min(G.mov, 18);
  for(let i = 0; i < n && G; i++){
    const cand = [];
    for(let r = 0; r < G.R; r++) for(let c = 0; c < G.C; c++){ const p = G.P[r][c]; if(p && !p.sp && !p.ing && !G.cel[r][c].web && p.k >= 0) cand.push(p); }
    if(!cand.length) break;
    const p = cand[azar(cand.length)]; p.sp = Math.random() < .5 ? 'h' : 'v'; p.forma = performance.now();
    if(G.n.s) G.tiempo = Math.max(0, G.tiempo - 4); else G.mov--;
    G.pts += 300; son('fiesta'); actualizarHUD(); await esperar(110);
  }
  for(let v = 0; v < 12 && G; v++){
    const esp = [];
    for(let r = 0; r < G.R; r++) for(let c = 0; c < G.C; c++){ const p = G.P[r][c]; if(p && p.sp && !p.ing) esp.push({r, c, t: 'e'}); }
    if(!esp.length) break;
    await golpear(esp.slice(0, 6)); await resolver(null);
  }
  await esperar(400);
}
function estrellas(){ const e = G.n.e; return G.pts >= e[2] ? 3 : G.pts >= e[1] ? 2 : 1; }
function ganar(){
  const i = G.i, est = estrellas(), pts = G.pts, nuevoRec = !datos.pts[i] || pts > datos.pts[i];
  datos.est[i] = Math.max(datos.est[i] || 0, est); if(nuevoRec) datos.pts[i] = pts;
  const yaAbierto = datos.max > i; datos.max = Math.max(datos.max, Math.min(i + 1, NIVELES.length)); guardar();
  son('gana');
  const ult = i === NIVELES.length - 1, nCiu = NIVELES[i + 1] && NIVELES[i + 1].ciudad !== NIVELES[i].ciudad ? CIUDADES[NIVELES[i + 1].ciudad] : null;
  confeti();
  modal(`<div class="res gano"><h2>${ult ? '¡Llegaste al Chaco!' : ['¡Muy bien!', '¡Iporã!', '¡Mbarete!'][est - 1]}</h2>
    <div class="estrellas">${[1, 2, 3].map(k => `<span class="st" id="st${k}">★</span>`).join('')}</div>
    <p class="pts">${fmt(pts)} puntos${nuevoRec && datos.pts[i] ? ' <small>¡récord!</small>' : ''}</p>
    <div class="recgano" id="recGano"></div>
    ${ult ? '<p>¡Terminaste todo el recorrido por Paraguay! Volvé a jugar los niveles para sacar 3 estrellas en todos.</p>' : nCiu && !yaAbierto ? `<p>🚌 Próxima parada: <b>${nCiu.n}</b></p>` : ''}
    <div class="acciones">${!ult ? '<button class="btn grande" id="bSig">Siguiente nivel ▶</button>' : ''}
      <button class="btn sec" id="bRep">↻ Repetir</button><button class="btn sec" id="bMapa">🗺️ Mapa</button><button class="btn sec" id="bComp">📤 Compartir</button></div></div>`);
  [1, 2, 3].forEach(k => { if(k <= est) setTimeout(() => { const el = $('#st' + k); if(el){ el.classList.add('si'); son('estrella', k); } }, 350 + k * 380); });
  const sig = $('#bSig'); if(sig) sig.onclick = () => { cerrarModal(); son('toc'); if(nCiu && !yaAbierto){ verPantalla('#pMapa'); setTimeout(() => previaNivel(i + 1), 500); } else previaNivel(i + 1); };
  $('#bRep').onclick = () => { cerrarModal(); son('toc'); empezar(i); };
  $('#bMapa').onclick = () => { cerrarModal(); son('toc'); G = null; verPantalla('#pMapa'); };
  $('#bComp').onclick = () => compartir(i, pts, est);
  recordGanado(i, nCiu && !yaAbierto, ult);
}
// después de ganar: sube el récord y muestra el puesto (o invita a poner el nombre)
async function recordGanado(i, cambiaCiudad, ult){
  const el = $('#recGano'); if(!el) return;
  if(!miNombre){
    el.innerHTML = '<button class="btn sec chico" id="bNomGano">🏆 Poné tu nombre y entrá en los récords</button>';
    $('#bNomGano').onclick = () => pedirNombre(() => verNivelRec(i, cambiaCiudad, ult));
    return;
  }
  el.innerHTML = '<p class="chico">🏆 Subiendo tu récord…</p>';
  const subio = await subirRecords();
  const d = subio ? await leerRecords(i) : null;
  if(!$('#recGano')) return;
  if(d && d.yo) el.innerHTML = `<p class="puesto">🏆 Puesto <b>${d.yo.puesto}</b> en este nivel <button class="lnk" id="bVerNiv">ver tabla</button></p>`;
  else el.innerHTML = PRUEBA_LOCAL ? '<p class="chico">(probando en la PC: no se suben récords)</p>' : '<p class="chico">No se pudo subir el récord ahora; se sube la próxima vez que haya internet.</p>';
  const b = $('#bVerNiv'); if(b) b.onclick = () => verNivelRec(i, cambiaCiudad, ult);
}
function verNivelRec(i, cambiaCiudad, ult){
  modal(`<h2>🏆 ${CIUDADES[NIVELES[i].ciudad].n} · nivel ${i + 1}</h2><div class="toprec" id="topNiv2"><p class="centro">Cargando…</p></div>
    <div class="acciones">${!ult ? '<button class="btn grande" id="bSig2">Siguiente nivel ▶</button>' : ''}<button class="btn sec" id="bMapa2">🗺️ Mapa</button><button class="btn sec" id="bTodos2">🏆 Tabla general</button></div>`);
  topNivel(i, '#topNiv2');
  const sig = $('#bSig2'); if(sig) sig.onclick = () => { cerrarModal(); son('toc'); if(cambiaCiudad){ G = null; verPantalla('#pMapa'); setTimeout(() => previaNivel(i + 1), 500); } else previaNivel(i + 1); };
  $('#bMapa2').onclick = () => { cerrarModal(); son('toc'); G = null; verPantalla('#pMapa'); };
  $('#bTodos2').onclick = () => verRecords();
}
function perder(){
  son('pierde');
  const faltan = metas().filter(m => m.falta);
  const nom = m => m.k === 'pts' ? `${fmt(m.falta)} puntos` : m.k === 'hielo' ? `${m.falta} hielos` : m.k === 'tela' ? `${m.falta} ñandutí` : m.k === 'bloq' ? `${m.falta} cajones` : m.k === 'baj' ? `${m.falta} ${PL[G.n.prod]}` : `${m.falta} ${PL[G.n.frutas[+m.k.slice(2)]]}`;
  modal(`<div class="res perdio"><h2>${G.n.s ? '¡Se acabó el tiempo!' : '¡Se acabaron las movidas!'}</h2>
    <p class="cara">🥲</p><p>Te faltó: <b>${faltan.map(nom).join(', ')}</b></p><p class="pts">${fmt(G.pts)} puntos</p>
    <div class="acciones"><button class="btn grande" id="bRep">↻ Intentar de nuevo</button><button class="btn sec" id="bMapa">🗺️ Mapa</button></div></div>`);
  const i = G.i;
  $('#bRep').onclick = () => { cerrarModal(); son('toc'); empezar(i); };
  $('#bMapa').onclick = () => { cerrarModal(); son('toc'); G = null; verPantalla('#pMapa'); };
}
$('#bPausa').onclick = () => {
  if(!G || G.fin) return; son('toc'); G.pausa = true;
  modal(`<h2>Pausa</h2><p class="centro">${CIUDADES[G.n.ciudad].n} · nivel ${G.i + 1}</p>
    <div class="acciones col"><button class="btn grande" id="bSeg">▶ Seguir</button><button class="btn sec" id="bReini">↻ Empezar de nuevo</button>
    <button class="btn sec" id="bSal">🗺️ Salir al mapa</button><button class="btn sec" id="bAyu">❓ Cómo se juega</button></div>`);
  $('#bSeg').onclick = () => { cerrarModal(); G.pausa = false; pistaT = performance.now(); };
  $('#bReini').onclick = () => { cerrarModal(); empezar(G.i); };
  $('#bSal').onclick = () => { cerrarModal(); G = null; verPantalla('#pMapa'); };
  $('#bAyu').onclick = () => { comoJugar(); $('#modal').onclick = null; const b = $('#modalIn .acciones .btn'); b.onclick = () => { cerrarModal(); if(G){ G.pausa = false; pistaT = performance.now(); } }; };
};
function compartir(i, pts, est){
  const c = CIUDADES[NIVELES[i].ciudad];
  const txt = `🍓🥭 Pasé el nivel ${i + 1} en ${c.n} con ${fmt(pts)} puntos ${'⭐'.repeat(est)} en Yva Rape, el juego de unir frutas por todo el Paraguay. ¿Me ganás?`;
  const url = 'https://juegospy.com/frutas/';
  if(navigator.share) navigator.share({title: 'Yva Rape', text: txt, url}).catch(() => {});
  else { window.open('https://wa.me/?text=' + encodeURIComponent(txt + ' ' + url), '_blank'); }
}

/* ------------------------------ HUD ------------------------------ */
function armarHUD(){
  const n = G.n, g = n.g; let h = '';
  const chip = (id, img, txt) => `<div class="chip" id="${id}">${img}<b>${txt}</b></div>`;
  if(g.pts) h += chip('meta-pts', '<span class="emo">🎯</span>', fmt(g.pts));
  if(g.fr) g.fr.forEach(([f, q]) => h += chip('meta-fr' + f, `<img src="${svgUrl(FRUTAS[n.frutas[f]].svg)}" alt="">`, q));
  if(g.hielo) h += chip('meta-hielo', `<img src="${iconoHielo}" alt="">`, '');
  if(g.tela) h += chip('meta-tela', `<img src="${svgUrl(PROD.nanduti.svg)}" alt="">`, '');
  if(g.bloq) h += chip('meta-bloq', `<img src="${iconoCajon}" alt="">`, '');
  if(g.baj) h += chip('meta-baj', `<img src="${svgUrl(PROD[n.prod].svg)}" alt="">`, '');
  $('#metas').innerHTML = h;
  $('#movLbl').textContent = n.s ? 'Tiempo' : 'Movidas';
  const e = n.e, tope = e[2] * 1.08;
  $('#barra').innerHTML = `<i id="barraIn"></i>${[0, 1, 2].map(k => `<span class="mk" style="left:${(e[k] || e[1] * .5) / tope * 100}%">★</span>`).join('')}`;
  actualizarHUD();
}
const iconoHielo = iconoCanvas((x, s) => dibujarHielo(x, 0, 0, s, 2));
const iconoCajon = iconoCanvas((x, s) => dibujarCajon(x, 0, 0, s, 2));
function actualizarHUD(){
  if(!G) return;
  const n = G.n;
  $('#movNum').textContent = n.s ? Math.ceil(G.tiempo) : G.mov;
  $('#movBox').classList.toggle('poco', n.s ? G.tiempo <= 10 : G.mov <= 3);
  $('#ptsNum').textContent = fmt(G.pts);
  const e = n.e, tope = e[2] * 1.08;
  const bi = $('#barraIn'); if(bi) bi.style.width = Math.min(100, G.pts / tope * 100) + '%';
  document.querySelectorAll('#barra .mk').forEach((m, k) => m.classList.toggle('si', G.pts >= (e[k] || 0) && (k > 0 || cumplidas())));
  for(const m of metas()){
    const el = $('#meta-' + m.k); if(!el) continue;
    el.classList.toggle('lista', !m.falta);
    el.querySelector('b').textContent = m.falta ? fmt(m.falta) : '✓';
  }
}

/* ------------------------------ efectos ------------------------------ */
function morir(p, r, c, ing){ parts.push({tipo: 'muere', p, x: c, y: r, t: 0, d: ing ? .45 : .28});
  if(!ing && p.k >= 0){ const col = FRUTAS[G.n.frutas[p.k]] ? FRUTAS[G.n.frutas[p.k]].col : '#fff'; chispas(r, c, col, 7, 'jugo'); } }
function chispas(r, c, col, n, tipo){
  for(let i = 0; i < n; i++){ const a = Math.random() * Math.PI * 2, v = 1.5 + Math.random() * 3.5;
    parts.push({tipo: tipo || 'jugo', x: c + .5, y: r + .5, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5, t: 0, d: .5 + Math.random() * .4, col, s: .06 + Math.random() * .08, rot: Math.random() * 6}); }
}
function sumar(r, c, n){ G.pts += n; }
function volarA(sel, img, r, c, grande){
  const el = $(sel); if(!el) return; const b = el.getBoundingClientRect();
  parts.push({tipo: 'vuela', img, x0: OX + (c + .5) * S, y0: OY + (r + .5) * S, x1: b.left + b.width * .3, y1: b.top + b.height / 2, t: 0, d: .55 + Math.random() * .15, el, grande});
}
function confeti(){
  const cols = ['#ff4a6a', '#ffd21a', '#3fd27a', '#3ab0ff', '#c86aff', '#ff9a2a'];
  for(let i = 0; i < 90; i++) parts.push({tipo: 'confeti', px: Math.random() * innerWidth, py: -20 - Math.random() * 200, vx: (Math.random() - .5) * 60, vy: 80 + Math.random() * 120, t: 0, d: 3.2, col: cols[i % cols.length], rot: Math.random() * 6, w: 6 + Math.random() * 6});
}

/* ------------------------------ dibujo ------------------------------ */
function medir(){
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
  cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if(!G) return;
  const hud = $('#hud').getBoundingClientRect(), pie = $('#pie').getBoundingClientRect();
  const top = hud.bottom + 10, bot = pie.top - 10, w = Math.min(innerWidth - 16, 640), h = bot - top;
  S = Math.max(20, Math.floor(Math.min(w / G.C, h / G.R)));
  OX = Math.round((innerWidth - S * G.C) / 2); OY = Math.round(top + (h - S * G.R) / 2);
  rasterizar(S);
  clip = new Path2D(); panel = new Path2D();
  for(let r = 0; r < G.R; r++) for(let c = 0; c < G.C; c++) if(G.cel[r][c].ok){
    clip.rect(OX + c * S, OY + r * S, S, S);
    const m = S * .08; if(panel.roundRect) panel.roundRect(OX + c * S - m, OY + r * S - m, S + 2 * m, S + 2 * m, S * .22); else panel.rect(OX + c * S - m, OY + r * S - m, S + 2 * m, S + 2 * m);
  }
}
addEventListener('resize', () => { medir(); });
let tAnt = performance.now();
function cuadro(t){
  requestAnimationFrame(cuadro);
  const dt = Math.min(.05, (t - tAnt) / 1000) * VEL; tAnt = t;
  ultimoCuadro = t;
  if(!$('#pJuego').classList.contains('on') || !G) return;
  actualizar(dt, t); dibujar(t);
}
// si la pestaña no dibuja (oculta), el tablero igual sigue para no trabarse
let ultimoCuadro = 0;
setInterval(() => { const t = performance.now(); if(G && t - ultimoCuadro > 250 && $('#pJuego').classList.contains('on')) actualizar(.05 * VEL, t); }, 50);
function actualizar(dt, t){
  if(G.n.s && !G.pausa && !G.fin && !document.hidden && !$('#modal').classList.contains('on')){
    const antes = Math.ceil(G.tiempo); G.tiempo = Math.max(0, G.tiempo - dt);
    if(Math.ceil(G.tiempo) !== antes) actualizarHUD();
    if(G.tiempo <= 0 && !G.bloqueo){ G.bloqueo = true; finJugada(); }
  }
  for(let r = 0; r < G.R; r++) for(let c = 0; c < G.C; c++){
    const p = G.P[r][c]; if(!p) continue;
    if(p.tw){ p.tw.t += dt; const k = Math.min(1, p.tw.t / p.tw.d), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      p.x = p.tw.x0 + (p.tw.x1 - p.tw.x0) * e; p.y = p.tw.y0 + (p.tw.y1 - p.tw.y0) * e;
      if(k >= 1){ p.tw = null; if(p.x === c && p.y === r){} } continue; }
    if(p.y < r){ p.vy = Math.min(p.vy + 60 * dt, 24); p.y = Math.min(r, p.y + p.vy * dt); if(p.y === r){ p.vy = 0; p.sq = 1; } }
    else if(p.y > r){ p.y = Math.max(r, p.y - 10 * dt); }
    if(p.x !== c){ const v = Math.max(8, p.vy) * dt; p.x = Math.abs(c - p.x) <= v ? c : p.x + Math.sign(c - p.x) * v; }
    if(p.sq > 0) p.sq = Math.max(0, p.sq - dt * 5);
  }
  for(const q of parts){ q.t += dt; if(q.vx !== undefined && q.tipo !== 'confeti'){ q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 9 * dt; } if(q.tipo === 'confeti'){ q.px += q.vx * dt; q.py += q.vy * dt; q.rot += dt * 5; } }
  parts = parts.filter(q => { if(q.t < q.d) return true; if(q.tipo === 'vuela' && q.el){ q.el.classList.remove('late'); void q.el.offsetWidth; q.el.classList.add('late'); } return false; });
  textos.forEach(x => x.t += dt); textos = textos.filter(x => x.t < 1);
  rayos.forEach(x => x.t += dt); rayos = rayos.filter(x => x.t < .45);
  temblor = Math.max(0, temblor - dt * 30);
  // pista
  if(!G.bloqueo && !G.fin && !G.pausa && !pista && t - pistaT > 6000){ const js = buscarJugadas(); if(js.length){ js.sort((a, b) => b.val - a.val); pista = js[Math.min(js.length - 1, azar(3))]; } }
}
function dibujar(t){
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  ctx.save();
  if(temblor) ctx.translate((Math.random() - .5) * temblor, (Math.random() - .5) * temblor);
  // tablero
  ctx.fillStyle = 'rgba(25,12,45,.42)'; ctx.fill(panel);
  for(let r = 0; r < G.R; r++) for(let c = 0; c < G.C; c++){
    const ce = G.cel[r][c]; if(!ce.ok) continue;
    ctx.fillStyle = (r + c) % 2 ? 'rgba(255,255,255,.13)' : 'rgba(255,255,255,.22)';
    rr(ctx, OX + c * S + 1, OY + r * S + 1, S - 2, S - 2, S * .16); ctx.fill();
    if(ce.ice) dibujarHielo(ctx, OX + c * S, OY + r * S, S, ce.ice);
  }
  // salidas de los productos
  if(G.n.g.baj) for(let c = 0; c < G.C; c++){ const r = G.fondo[c]; if(r < 0) continue; ctx.fillStyle = 'rgba(255,240,180,.9)'; ctx.font = `${S * .32}px system-ui`; ctx.textAlign = 'center'; ctx.fillText('▼', OX + (c + .5) * S, OY + (r + 1) * S + S * .3); }
  // fichas
  ctx.save(); ctx.clip(clip);
  const pulso = Math.sin(t / 180);
  for(let r = 0; r < G.R; r++) for(let c = 0; c < G.C; c++){
    const p = G.P[r][c]; if(!p) continue;
    let sc = 1, dx = 0, rot = 0;
    if(sel && sel.r === r && sel.c === c) sc = 1.08 + pulso * .04;
    if(pista && ((pista.a.r === r && pista.a.c === c) || (pista.b.r === r && pista.b.c === c))){ const w = Math.sin(t / 90) * .06; if(pista.a.r === pista.b.r) dx = w; else rot = w * 2; sc *= 1.04; }
    if(p.forma){ const k = (t - p.forma) / 350; if(k < 1) sc *= 1 + Math.sin(k * Math.PI) * .35; else p.forma = 0; }
    if(p.gira){ const k = (t - p.gira) / 800; if(k < 1) { sc *= Math.abs(Math.cos(k * Math.PI)); } else p.gira = 0; }
    const nacio = (t - p.nace) / 200; if(nacio < 1 && p.y >= 0) sc *= .6 + .4 * nacio;
    pieza(p, OX + (p.x + .5 + dx) * S, OY + (p.y + .5) * S, sc, rot, t, p.sq);
  }
  ctx.restore();
  // ñandutí y cajones arriba
  for(let r = 0; r < G.R; r++) for(let c = 0; c < G.C; c++){
    const ce = G.cel[r][c]; if(!ce.ok) continue;
    if(ce.web){ ctx.globalAlpha = .7; ctx.drawImage(BMP.tela, OX + c * S + S * .02, OY + r * S + S * .02, S * .96, S * .96); ctx.globalAlpha = 1; }
    if(ce.blk) dibujarCajon(ctx, OX + c * S, OY + r * S, S, ce.blk);
  }
  if(sel){ ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 3; rr(ctx, OX + sel.c * S + 2, OY + sel.r * S + 2, S - 4, S - 4, S * .18); ctx.stroke(); }
  // rayos
  for(const x of rayos){
    const k = x.t / .45, a = 1 - k;
    if(x.tipo === 'h' || x.tipo === 'v'){
      const g = x.tipo === 'h' ? ctx.createLinearGradient(0, OY + x.r * S, 0, OY + (x.r + 1) * S) : ctx.createLinearGradient(OX + x.c * S, 0, OX + (x.c + 1) * S, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, `rgba(255,250,210,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; const ancho = S * (1.2 - k * .8);
      if(x.tipo === 'h') ctx.fillRect(OX - S, OY + (x.r + .5) * S - ancho / 2, (G.C + 2) * S, ancho); else ctx.fillRect(OX + (x.c + .5) * S - ancho / 2, OY - S, ancho, (G.R + 2) * S);
    } else if(x.tipo === 'b'){
      ctx.strokeStyle = `rgba(255,220,120,${a})`; ctx.lineWidth = S * .35 * a;
      ctx.beginPath(); ctx.arc(OX + (x.c + .5) * S, OY + (x.r + .5) * S, S * x.rad * (.3 + k), 0, 7); ctx.stroke();
      ctx.fillStyle = `rgba(255,255,230,${a * .35})`; ctx.fill();
    } else if(x.tipo === 'l'){
      ctx.strokeStyle = `hsla(${(t / 4 + x.c2 * 40) % 360},100%,75%,${a})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(OX + (x.c + .5) * S, OY + (x.r + .5) * S);
      const mx = (x.c + x.c2) / 2 + .5 + (Math.random() - .5) * .6, my = (x.r + x.r2) / 2 + .5 + (Math.random() - .5) * .6;
      ctx.lineTo(OX + mx * S, OY + my * S); ctx.lineTo(OX + (x.c2 + .5) * S, OY + (x.r2 + .5) * S); ctx.stroke();
    }
  }
  // partículas
  for(const q of parts){
    const k = q.t / q.d;
    if(q.tipo === 'muere'){ const sc = q.p.ing ? 1 + k * .5 : 1 + k * .4; ctx.globalAlpha = 1 - k; pieza(q.p, OX + (q.x + .5) * S, OY + (q.y + .5) * S + (q.p.ing ? k * S : 0), sc, 0, t, 0); ctx.globalAlpha = 1; }
    else if(q.tipo === 'vuela'){
      const e = k * k * (3 - 2 * k), x = q.x0 + (q.x1 - q.x0) * e, y = q.y0 + (q.y1 - q.y0) * e - Math.sin(k * Math.PI) * 60, s = S * (q.grande ? 1 : .7) * (1 - k * .45);
      const b = BMP[q.img]; if(b) ctx.drawImage(b, x - s / 2, y - s / 2, s, s);
    }
    else if(q.tipo === 'confeti'){ ctx.save(); ctx.translate(q.px, q.py); ctx.rotate(q.rot); ctx.fillStyle = q.col; ctx.globalAlpha = Math.min(1, (q.d - q.t) * 2); ctx.fillRect(-q.w / 2, -q.w / 4, q.w, q.w / 2); ctx.restore(); }
    else {
      const x = OX + q.x * S, y = OY + q.y * S, s = q.s * S * (1 - k * .5);
      ctx.globalAlpha = 1 - k; ctx.fillStyle = q.col;
      if(q.tipo === 'estrella'){ estrella(x, y, s * 1.6, q.rot + k * 4); }
      else if(q.tipo === 'hielo' || q.tipo === 'astilla'){ ctx.save(); ctx.translate(x, y); ctx.rotate(q.rot + k * 6); ctx.fillRect(-s, -s / 2, s * 2, s); ctx.restore(); }
      else if(q.tipo === 'hilo'){ ctx.strokeStyle = q.col; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - q.vx * 4, y - q.vy * 4); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(x, y, s, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
  }
  // puntos que suben
  ctx.textAlign = 'center'; ctx.font = `800 ${Math.round(S * .4)}px "Baloo 2", system-ui, sans-serif`;
  for(const x of textos){
    const k = x.t; ctx.globalAlpha = 1 - k * k; const y = OY + (x.y + .5) * S - k * S * .9;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(40,10,30,.75)'; ctx.strokeText(x.txt, OX + (x.x + .5) * S, y);
    ctx.fillStyle = x.col; ctx.fillText(x.txt, OX + (x.x + .5) * S, y); ctx.globalAlpha = 1;
  }
  ctx.restore();
}
function estrella(x, y, s, rot){ ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.beginPath(); for(let i = 0; i < 10; i++){ const a = i * Math.PI / 5, r = i % 2 ? s * .45 : s; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.restore(); }
function pieza(p, x, y, sc, rot, t, sq){
  const s = S * .9 * sc, sx = 1 + (sq || 0) * .12, sy = 1 - (sq || 0) * .12;
  ctx.save(); ctx.translate(x, y + s * (1 - sy) / 2); if(rot) ctx.rotate(rot); ctx.scale(sx, sy);
  if(p.ing){ const b = BMP['p_' + G.n.prod]; if(b) ctx.drawImage(b, -s / 2, -s / 2, s, s); ctx.restore(); return; }
  if(p.sp === 'g'){
    const halo = ctx.createRadialGradient(0, 0, s * .1, 0, 0, s * .62);
    halo.addColorStop(0, `hsla(${(t / 5) % 360},100%,80%,.9)`); halo.addColorStop(1, `hsla(${(t / 5 + 120) % 360},100%,60%,0)`);
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, 0, s * .62, 0, 7); ctx.fill();
    ctx.rotate(Math.sin(t / 300) * .12); ctx.drawImage(BMP.guampa, -s / 2, -s / 2, s, s); ctx.restore(); return;
  }
  const nom = G.n.frutas[p.k], b = BMP[nom];
  if(p.sp === 'b'){
    const pul = 1 + Math.sin(t / 160) * .05;
    ctx.fillStyle = 'rgba(255,240,180,.35)'; ctx.strokeStyle = FRUTAS[nom].col; ctx.lineWidth = s * .08;
    rr(ctx, -s * .5 * pul, -s * .5 * pul, s * pul, s * pul, s * .28); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = s * .03; ctx.setLineDash([s * .08, s * .1]); ctx.lineDashOffset = -t / 30; ctx.stroke(); ctx.setLineDash([]);
    if(b) ctx.drawImage(b, -s * .4, -s * .4, s * .8, s * .8);
    ctx.fillStyle = '#fff'; for(let i = 0; i < 4; i++){ const a = t / 400 + i * Math.PI / 2; ctx.beginPath(); ctx.arc(Math.cos(a) * s * .46, Math.sin(a) * s * .46, s * .045, 0, 7); ctx.fill(); }
    ctx.restore(); return;
  }
  if(b) ctx.drawImage(b, -s / 2, -s / 2, s, s);
  if(p.sp === 'h' || p.sp === 'v'){
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, s * .44, 0, 7); ctx.clip();
    if(p.sp === 'v') ctx.rotate(Math.PI / 2);
    const mov = ((t / 400) % 1) * s * .3;
    for(let i = -2; i <= 2; i++){ const yy = i * s * .22 + mov * 1.4 - s * .2; ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(-s, yy - s * .022, s * 2, s * .044); ctx.fillStyle = 'rgba(80,20,40,.3)'; ctx.fillRect(-s, yy + s * .03, s * 2, s * .018); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = s * .05; ctx.beginPath(); ctx.arc(0, 0, s * .47, 0, 7); ctx.stroke();
    // flechitas
    ctx.fillStyle = '#fff'; const ar = s * .5;
    for(const d of [-1, 1]){ ctx.beginPath(); if(p.sp === 'h'){ ctx.moveTo(d * (ar + s * .1), 0); ctx.lineTo(d * ar, -s * .08); ctx.lineTo(d * ar, s * .08); } else { ctx.moveTo(0, d * (ar + s * .1)); ctx.lineTo(-s * .08, d * ar); ctx.lineTo(s * .08, d * ar); } ctx.fill(); }
  }
  ctx.restore();
}

/* ------------------------------ toques ------------------------------ */
function celdaEn(e){ const c = Math.floor((e.clientX - OX) / S), r = Math.floor((e.clientY - OY) / S); if(!G || r < 0 || c < 0 || r >= G.R || c >= G.C || !G.cel[r][c].ok) return null; return {r, c}; }
cv.addEventListener('pointerdown', e => {
  if(!G || G.bloqueo || G.fin || G.pausa) return;
  audio();
  const q = celdaEn(e); if(!q){ sel = null; return; }
  pistaT = performance.now(); pista = null;
  if(sel && Math.abs(sel.r - q.r) + Math.abs(sel.c - q.c) === 1){ const a = sel; sel = null; jugar(a, q); return; }
  if(!movil(q.r, q.c)){ sel = null; if(G.cel[q.r][q.c].web) toast('Esa fruta está trabada en el ñandutí: juntala con otras iguales'); return; }
  sel = q; arrastre = {q, x: e.clientX, y: e.clientY}; son('toc');
  try{ cv.setPointerCapture(e.pointerId); }catch(err){}
});
cv.addEventListener('pointermove', e => {
  if(!arrastre || !G) return;
  const dx = e.clientX - arrastre.x, dy = e.clientY - arrastre.y;
  if(Math.max(Math.abs(dx), Math.abs(dy)) < S * .35) return;
  const a = arrastre.q, b = Math.abs(dx) > Math.abs(dy) ? {r: a.r, c: a.c + Math.sign(dx)} : {r: a.r + Math.sign(dy), c: a.c};
  arrastre = null; sel = null; jugar(a, b);
});
const soltar = () => { arrastre = null; };
cv.addEventListener('pointerup', soltar); cv.addEventListener('pointercancel', soltar);

/* ------------------------------ arranque ------------------------------ */
// fondo de la portada: frutas que caen
const fondo = $('#cielo'), fx = fondo.getContext('2d'); let caen = [];
function fondoCuadro(){
  requestAnimationFrame(fondoCuadro);
  if($('#pJuego').classList.contains('on')) return;
  const dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight;
  if(fondo.width !== Math.round(W * dpr)){ fondo.width = Math.round(W * dpr); fondo.height = Math.round(H * dpr); }
  fx.setTransform(dpr, 0, 0, dpr, 0, 0); fx.clearRect(0, 0, W, H);
  const ks = Object.keys(FRUTAS);
  if(caen.length < 18 && Math.random() < .05) caen.push({k: ks[azar(ks.length)], x: Math.random() * W, y: -60, v: 30 + Math.random() * 40, r: Math.random() * 6, vr: (Math.random() - .5), s: 34 + Math.random() * 30});
  fx.globalAlpha = .3;
  for(const f of caen){ f.y += f.v / 60; f.r += f.vr / 60; const im = IMG[f.k]; if(im){ fx.save(); fx.translate(f.x, f.y); fx.rotate(f.r); fx.drawImage(im, -f.s / 2, -f.s / 2, f.s, f.s); fx.restore(); } }
  fx.globalAlpha = 1; caen = caen.filter(f => f.y < H + 60);
}
listos.then(() => {
  $('#logoFrutas').innerHTML = ['mango', 'frutilla', 'pina', 'guayaba', 'mburukuja'].map(k => `<img src="${svgUrl(FRUTAS[k].svg)}" alt="">`).join('') + `<img class="gu" src="${svgUrl(GUAMPA)}" alt="">`;
  armarTitulo(); requestAnimationFrame(cuadro); requestAnimationFrame(fondoCuadro);
  setTimeout(subirRecords, 3000);
  document.body.classList.add('listo');
});
window.INICIO = Object.assign(window.INICIO || {}, {enJuego: () => !!G && !G.fin, pregunta: '¿Dejar el nivel y volver a todos los juegos?'});
if('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

// ayuda para probar: juega solo eligiendo la mejor jugada (desde la consola)
window.YVA_PRUEBA = {
  nivel: i => { empezar(i); },
  async auto(veces){ for(let v = 0; v < (veces || 200) && G && !G.fin; v++){ while(G && G.bloqueo && !G.fin) await esperar(50); if(!G || G.fin) break; const js = buscarJugadas(); if(!js.length){ await esperar(200); continue; } js.sort((a, b) => b.val - a.val); const j = js[Math.random() < .7 ? 0 : azar(Math.min(4, js.length))]; await jugar(j.a, j.b); } return G ? {pts: G.pts, mov: G.mov, fin: G.fin, metas: metas()} : null; },
  estado: () => G && {pts: G.pts, mov: G.mov, tiempo: G.tiempo, metas: metas(), bloqueo: G.bloqueo, fin: G.fin},
  datos: () => datos,
  vel: v => { VEL = v; },
  g: () => G, jugar: (a, b) => jugar(a, b), esperar: () => asentar(),
  // prueba todos los niveles: modo 'mejor' (elige la mejor jugada) o 'azar'
  async todos(desde, hasta, modo){ const res = []; for(let i = desde || 0; i <= (hasta ?? NIVELES.length - 1); i++){ cerrarModal(); empezar(i); await esperar(300);
      for(let v = 0; v < 300 && G && !G.fin; v++){ while(G && G.bloqueo && !G.fin) await esperar(40); if(!G || G.fin) break; const js = buscarJugadas(); if(!js.length){ await esperar(100); continue; }
        let j; if(modo === 'azar') j = js[azar(js.length)]; else { js.sort((a, b) => b.val - a.val); j = js[Math.random() < .7 ? 0 : azar(Math.min(4, js.length))]; } await jugar(j.a, j.b); }
      while(G && !$('#modal').classList.contains('on')) await esperar(50);
      res.push({i, gano: !!$('.res.gano'), pts: G.pts, mov: G.mov, t: Math.round(G.tiempo), est: $('.res.gano') ? estrellas() : 0, falta: metas().filter(m => m.falta).map(m => m.k + ':' + m.falta).join(' ')}); }
    return res; },
};
})();
