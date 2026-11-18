'use strict';
/* =====================================================================
   Carrera Guasu — menú, red (PeerJS), chat con privados, voz, controles
   (táctil, teclado, mando, inclinación), tablero de la carrera, sonidos
   y música.
   ===================================================================== */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function store(k,v){ try{ if(v===undefined) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
function load(k){ try{ const v=localStorage.getItem(k); return v==null?null:JSON.parse(v); }catch(e){ return null; } }
function toast(x){ const t=$('#toast'); t.textContent=x; t.style.display='block'; clearTimeout(toast.t); toast.t=setTimeout(()=>t.style.display='none', 3800); }
const PREFIX='kartspy26-';
const genCode = () => { const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s=''; for(let i=0;i<5;i++) s+=A[rnd(A.length)]; return s; };
let myToken=load('kg_token'); if(!myToken){ myToken=Math.random().toString(36).slice(2)+Date.now().toString(36); store('kg_token', myToken); }
const NET={mode:null, peer:null, code:null, conns:{}, hostConn:null, myPid:null, obs:null, welcomed:false};
let CHAT=[], V=null, R=null;
const me = () => NET.myPid || NET.obs;
const VP = id => V && (V.players.find(p=>p.id===id) || (V.observers||[]).find(o=>o.id===id));
const amHost = () => NET.mode==='local' || (V && V.hostPid===NET.myPid && NET.mode==='host');
const simulo = () => NET.mode==='local' || NET.mode==='host';
const CFG = Object.assign({calidad:'media', auto:null, tilt:false, vib:true}, load('kg_cfg')||{});
const tactil = () => matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
if(CFG.auto==null) CFG.auto=tactil();
function guardarCfg(){ store('kg_cfg', CFG); }

/* ====================== MENÚ ====================== */
let miCh = load('kg_ch'); if(miCh==null) miCh=rnd(PILOTOS.length);
const myName = () => ($('#myName').value.trim() || 'Jugador').slice(0,16);
const myEmoji = () => piloto(miCh).e;
$('#myName').value = load('kg_name') || load('ludo_name') || load('uno_name') || '';
$('#myName').addEventListener('input', ()=>store('kg_name', $('#myName').value.trim()));
const barra = n => '<i class="on"></i>'.repeat(n)+'<i></i>'.repeat(5-n);
function pilotoHTML(ch){ const p=piloto(ch); return `<b>${p.e} ${esc(p.n)}</b> <span class="muted">${esc(p.esp)} · ${esc(p.veh)}</span>
  <div class="stats"><span>Velocidad</span><span class="bar">${barra(p.vel)}</span><span>Arranque</span><span class="bar">${barra(p.ace)}</span><span>Manejo</span><span class="bar">${barra(p.man)}</span><span>Peso</span><span class="bar">${barra(p.peso)}</span></div>`; }
function renderPilotos(){
  $('#pilotos').innerHTML = PILOTOS.map((p,i)=>`<button class="tok ${i===miCh?'sel':''}" onclick="pickPiloto(${i})" title="${esc(p.n)}, ${esc(p.esp)}">${p.e}<small>${esc(p.n)}</small></button>`).join('');
  $('#pilotoInfo').innerHTML = pilotoHTML(miCh);
}
function pickPiloto(i){ miCh=i; store('kg_ch', i); renderPilotos(); vitrina(); sfx.sel(); }
function needName(){ if(!$('#myName').value.trim()){ toast('Escribí tu nombre primero ✍️'); $('#myName').focus(); return true; } store('kg_name', myName()); return false; }
function joinClick(){ const code=$('#joinCode').value.trim().toUpperCase(); if(!code) return toast('Escribí el código de la sala.'); if(needName()) return; clientJoin(code); }
function resumeClick(){ const h=load('kg_host'), c=load('kg_client'); if(h && (!c || h.at>=c.at)) return hostStart(true); if(c){ if(needName()) return; clientJoin(c.code); } }
function refreshResume(){ const h=load('kg_host'), c=load('kg_client'), ok=x=>x && Date.now()-x.at<3*3600e3; $('#btnResume').style.display = ok(h)||ok(c) ? 'block' : 'none'; }
(function(){   // enlace con #CÓDIGO o ?sala=CÓDIGO
  const m=(location.hash.slice(1) || new URLSearchParams(location.search).get('sala') || '').toUpperCase();
  if(/^[A-Z0-9]{4,6}$/.test(m)){ $('#joinCode').value=m;
    if(new URLSearchParams(location.search).get('dueno')){ if(!$('#myName').value.trim()) $('#myName').value='Dueño'; setTimeout(()=>clientJoin(m), 300); }
    else toast('Te invitaron a la sala '+m+': escribí tu nombre y tocá “Entrar”.'); }
})();
/* el kart elegido girando en el menú */
function vitrina(){
  const c=$('#c3d'); if(!c) return;
  if(c.parentElement!==$('#vitrina')) $('#vitrina').appendChild(c);
  M3.calidad=CFG.calidad; if(!M3.init(c)){ $('#vitrina').classList.add('sin3d'); return; }
  M3.mostrarVitrina(miCh, piloto(miCh).color); M3.tam();
}
function setCalidad(q){ CFG.calidad=q; guardarCfg(); M3.setCalidad(q); if(!R) vitrina(); toast(q==='baja'?'🐢 Calidad baja: más liviano para celulares modestos.':q==='alta'?'✨ Calidad alta.':'Calidad media.'); }
function ajustesHTML(){
  return `<label>Calidad del 3D</label><select onchange="setCalidad(this.value)">${[['baja','Baja (celulares modestos)'],['media','Media'],['alta','Alta']].map(([v,t])=>`<option value="${v}" ${CFG.calidad===v?'selected':''}>${t}</option>`).join('')}</select>
    <label class="opt"><input type="checkbox" ${CFG.auto?'checked':''} onchange="CFG.auto=this.checked;guardarCfg();renderTouch()"><span><b>Acelerar solo</b><small>Sin botón GO: el kart acelera siempre; vos doblás, derrapás y frenás. Cómodo en el celular.</small></span></label>
    <label class="opt"><input type="checkbox" ${CFG.tilt?'checked':''} onchange="setTilt(this.checked)"><span><b>Doblar inclinando el celular</b><small>Como un volante. Si no, se dobla con las flechas ◀ ▶.</small></span></label>
    <label class="opt"><input type="checkbox" ${CFG.vib?'checked':''} onchange="CFG.vib=this.checked;guardarCfg()"><span><b>Vibración</b><small>En los golpes y turbos (si el celular lo permite).</small></span></label>`;
}
function ajustesModal(){ modal(`<h2>⚙️ Ajustes</h2><button class="btn green wide" onclick="editarControles()">🎮 Acomodar controles del celular</button>${ajustesHTML()}<p class="muted">Teclado: flechas o WASD para manejar, <b>Espacio</b> salta y derrapa, <b>X</b> o <b>Enter</b> usa el objeto, <b>R</b> te vuelve a la pista. También funciona con mando.</p><button class="btn wide" onclick="closeModal()">Listo</button>`); }
/* elegir pista / copa (partidas de un jugador) */
const TIEMPOS = () => load('kg_tiempos') || {};
function pistaCard(id, fn){ const p=PISTAS[id], t=TIEMPOS()[id]; return `<button class="pcard" onclick="${fn}('${id}')"><span class="pe">${p.e}</span><span class="pn"><b>${esc(p.n)}</b><small>${esc(p.ciudad)}${t?` · ⏱️ ${fmtT(t.t)}`:''}</small></span></button>`; }
const selHTML = (id, list, val) => `<select id="${id}">${list.map(([v,t])=>`<option value="${v}" ${String(val)===String(v)?'selected':''}>${t}</option>`).join('')}</select>`;
const LOC = Object.assign({nivel:'medio', ritmo:'normal', vueltas:3, karts:8}, load('kg_local')||{});
function comunesHTML(conKarts){
  return `<div class="row2"><div><label>Bots</label>${selHTML('lNivel', NIVELES.map(n=>[n.id,n.n]), LOC.nivel)}</div><div><label>Velocidad</label>${selHTML('lRitmo', RITMOS.map(n=>[n.id,n.n]), LOC.ritmo)}</div>
    ${conKarts?`<div><label>Vueltas</label>${selHTML('lVueltas', [[2,'2'],[3,'3'],[4,'4'],[5,'5']], LOC.vueltas)}</div><div><label>Karts</label>${selHTML('lKarts', [[2,'2'],[4,'4'],[6,'6'],[8,'8']], LOC.karts)}</div>`:''}</div>`;
}
function leerComunes(){ for(const [id,k] of [['lNivel','nivel'],['lRitmo','ritmo'],['lVueltas','vueltas'],['lKarts','karts']]){ const e=$('#'+id); if(e) LOC[k]=/^\d+$/.test(e.value)?+e.value:e.value; } store('kg_local', LOC); }
function gpModal(){ if(needName()) return; modal(`<h2>🏆 Gran Premio</h2><p class="muted" style="margin-top:0">Cuatro carreras seguidas. Sumás puntos según cómo llegues y el que más junta se lleva la copa.</p>${comunesHTML(false)}
  ${COPAS.map(c=>`<button class="pcard copa" onclick="localStart('copa','${c.id}')"><span class="pe">${c.e}</span><span class="pn"><b>${c.n}</b><small>${c.pistas.map(i=>PISTAS[i].ciudad).join(' · ')}</small></span></button>`).join('')}
  <button class="btn gray wide" onclick="closeModal()">Volver</button>`); }
function libreModal(){ if(needName()) return; modal(`<h2>🏁 Carrera libre</h2>${comunesHTML(true)}<div class="pgrid">${ORDEN_PISTAS.map(i=>pistaCard(i,'libreGo')).join('')}</div><button class="btn gray wide" onclick="closeModal()">Volver</button>`); }
function libreGo(id){ localStart('libre', id); }
function cronoModal(){ if(needName()) return; modal(`<h2>⏱️ Contrarreloj</h2><p class="muted" style="margin-top:0">Vos solo contra el reloj: 3 vueltas con tres chipas turbo. Se guarda tu mejor tiempo y corrés contra tu fantasma 👻.</p><div class="pgrid">${ORDEN_PISTAS.map(i=>pistaCard(i,'cronoGo')).join('')}</div><button class="btn gray wide" onclick="closeModal()">Volver</button>`); }
function cronoGo(id){ localStart('crono', id); }

/* ====================== PANTALLAS ====================== */
/* en el celular se corre en horizontal: pantalla completa y pantalla trabada de costado (como la pelea) */
const deCostado = () => !(tactil() && innerHeight>innerWidth);
function horizontal(){
  if(!tactil()) return;
  const d=document.documentElement;
  const trabar=()=>{ try{ screen.orientation.lock('landscape').catch(()=>{}); }catch(e){} };
  if(!document.fullscreenElement && d.requestFullscreen) d.requestFullscreen({navigationUI:'hide'}).then(trabar).catch(trabar); else trabar();
}
function salirHorizontal(){ try{ screen.orientation.unlock(); }catch(e){} if(document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(()=>{}); }
// si la carrera arrancó sin tocar nada (en línea), se pide al primer toque
document.addEventListener('pointerdown', ()=>{ if(enJuego() && !document.fullscreenElement) horizontal(); });
function show(id){
  $$('.screen').forEach(s=>s.classList.toggle('on', s.id===id));
  const side=$('#side'), dest = id==='lobby' ? $('#lobbySide') : id==='game' ? $('#gameSide') : null;
  if(dest && side.parentElement!==dest) dest.appendChild(side);
  if(id==='menu'){ refreshResume(); vitrina(); }
  const antes=document.body.classList.contains('corriendo');
  document.body.classList.toggle('corriendo', id==='game');
  if(id==='game' && !antes) horizontal(); else if(id!=='game' && antes) salirHorizontal();
  $('#rotateSub').textContent = NET.mode==='local' ? 'La carrera queda en pausa hasta que lo gires.' : 'La carrera sigue: ¡apurate!';
}
function localStart(kind, x){
  leerComunes(); closeModal();
  NET.mode='local'; NET.code=null; CHAT=[];
  S=lobbyState();
  Object.assign(S.opts, {nivel:LOC.nivel, ritmo:LOC.ritmo});
  if(kind==='copa') Object.assign(S.opts, {modo:'copa', copa:x, vueltas:3, karts:8});
  else if(kind==='libre') Object.assign(S.opts, {modo:'libre', pista:x, vueltas:LOC.vueltas, karts:LOC.karts});
  else { Object.assign(S.opts, {modo:'libre', pista:x, vueltas:3, karts:1, objetos:false, ritmo:'normal'}); S.crono=true; }
  const p=addPlayer(myName(), miCh, myToken, null); NET.myPid=p.id; S.hostPid=p.id;
  FACES={}; shareMyFace(); act(p.id, {type:'start'});
}
function leaveClick(){
  if(NET.mode==='local'){ if(S && S.phase==='race' && !confirm('¿Salir de la carrera?')) return; return leaveToMenu(); }
  if(!confirm('¿Salir de la sala?')) return;
  if(NET.mode==='host'){ const others=hostCandidates(S); if(others.length) return hostHandover(); store('kg_host', undefined); }
  else if(NET.mode==='client'){ if(NET.hostConn && NET.hostConn.open && NET.myPid) try{ NET.hostConn.send({t:'act', a:{type:'leave'}}); }catch(e){} store('kg_client', undefined); }
  setTimeout(leaveToMenu, 250);
}
function leaveToMenu(){
  camsReset(); musicStop(); stopMic(false); quitarCarrera();
  try{ if(NET.peer) NET.peer.destroy(); }catch(e){}
  Object.assign(NET,{mode:null, peer:null, code:null, conns:{}, hostConn:null, myPid:null, obs:null, welcomed:false, backup:null});
  S=null; V=null; CHAT=[]; LAST.res=null; closeModal(); netBar(false); $('#side').classList.remove('open');
  history.replaceState(null,'',location.pathname);
  show('menu');
}

/* ====================== RED ====================== */
function publicState(){ const s=JSON.parse(JSON.stringify(S)); s.players.forEach(p=>{ delete p.token; }); (s.observers||[]).forEach(o=>delete o.token); delete s.ownerTok; return s; }
function commit(){
  if(NET.mode==='host'){
    const ps=publicState();
    for(const pid in NET.conns){ const c=NET.conns[pid]; if(c && c.open) try{ c.send({t:'state', s:ps}); }catch(e){} }
    sendBackups();
    if(!NET.noSave) store('kg_host', {code:NET.code, S, CHAT:CHAT.slice(-60), myPid:NET.myPid, at:Date.now()});
  }
  render();
}
function doAct(a){
  if(NET.mode==='client'){ if(NET.hostConn && NET.hostConn.open) NET.hostConn.send({t:'act', a}); else toast('Sin conexión con el anfitrión.'); return; }
  const r=act(me(), a); if(typeof r==='string') toast(r);
}
function newPeer(id){ return new Peer(id, {debug:1, config:{iceServers: window.ICE_SERVERS || [{urls:"stun:stun.l.google.com:19302"}]}}); }
function netBar(on,txt){ const b=$('#netbar'); b.style.display=on?'block':'none'; if(txt) b.textContent=txt; }
function difundir(m){ for(const pid in NET.conns){ const c=NET.conns[pid]; if(c && c.open) try{ c.send(m); }catch(e){} } }

// ---------- anfitrión ----------
function hostStart(resume){
  if(!resume && needName()) return;
  const saved = resume ? load('kg_host') : null;
  NET.mode='host'; NET.code = saved ? saved.code : genCode(); NET.conns={}; NET.noSave=false;
  const peer = NET.peer = newPeer(PREFIX+NET.code);
  peer.on('open', id=>{
    if(saved){
      S=saved.S; CHAT=saved.CHAT||[]; NET.myPid=saved.myPid;
      S.players.forEach(p=>{ if(!p.bot){ p.conn = p.id===NET.myPid; p.mic=false; p.cam=false; } });
      S.observers=[]; P(NET.myPid).peerId=id;
      if(S.phase!=='lobby'){ S.players=S.players.filter(x=>!x.bot); S.players.forEach(x=>x.pts=0); S.phase='lobby'; S.carrera=null; S.res=null; }   // la carrera en curso no se puede retomar: se vuelve a la sala
    } else {
      S=lobbyState(); CHAT=[];
      const p=addPlayer(myName(), miCh, myToken, id); NET.myPid=p.id; S.hostPid=p.id;
      sysChat('Sala '+NET.code+' creada. Pasales el código o el enlace a tus amigos.');
    }
    history.replaceState(null,'','#'+NET.code);
    if(!saved) FACES={}; commit(); renderChat(); shareMyFace();
  });
  wireHostPeer(peer, ()=>{
    if(resume){ toast('La sala sigue abierta en otro aparato (otro jugador quedó de anfitrión). Entrá con el código.'); peer.destroy(); store('kg_host',undefined); NET.mode=null; $('#joinCode').value=NET.code; return; }
    peer.destroy(); hostStart(false);
  });
  show('lobby'); $('#lobbyCode').textContent=NET.code;
}
function wireHostPeer(peer, onIdTaken){
  peer.on('open', ()=>{ peer._wasOpen=true; });
  peer.on('connection', conn=>{
    conn.lastSeen=Date.now();
    conn.on('data', d=>{ conn.lastSeen=Date.now(); hostOnData(conn,d); });
    conn.on('close', ()=>hostOnClose(conn));
    conn.on('error', ()=>hostOnClose(conn));
  });
  peer.on('call', onCall);
  peer.on('disconnected', ()=>{ if(!peer.destroyed) setTimeout(()=>{ try{ peer.reconnect(); }catch(e){} },1500); });
  peer.on('error', e=>{
    if(e.type==='unavailable-id'){ if(peer._wasOpen) demoteToClient(); else onIdTaken(); return; }
    if(e.type==='peer-unavailable') return;
    console.warn(e); if(e.type==='network'||e.type==='server-error'||e.type==='socket-error') netBar(true,'Problema de conexión con el servidor. Reintentando…');
  });
}
function demoteToClient(){
  if(NET.mode!=='host') return;
  try{ NET.peer.destroy(); }catch(e){}
  Object.values(NET.conns).forEach(c=>{ try{ c.close(); }catch(e){} }); NET.conns={};
  store('kg_host', undefined);
  toast('👑 Mientras no estabas, otro jugador quedó de anfitrión. Volvés a la sala como jugador.');
  const code=NET.code; NET.mode=null; clientJoin(code);
}
function hostOnData(conn, d){
  if(!d || typeof d!=='object' || !S) return;
  if(d.t==='k'){ const k=R && conn.pid && R.porPid[conn.pid]; if(k && Array.isArray(d.a) && d.id===R.id){ if(k.local){ k.local=false; k.bot=null; k.ausente=false; } desempacar(R, k, d.a); } return; }
  if(d.t==='ping'){ try{ conn.send({t:'pong'}); }catch(e){} return; }
  if(d.t==='pong') return;
  if(d.t==='hello'){
    if(d.token===myToken) d.token+='-'+conn.peer;   // mismo navegador que el anfitrión (otra pestaña)
    S.observers=S.observers||[];
    let p=S.players.find(x=>x.token && x.token===d.token), ob=null, why='';
    if(!p) ob=S.observers.find(x=>x.token===d.token)||null;
    const nm=(String(d.name||'').trim()||'Jugador').slice(0,16);
    if(!p && !ob){
      if((S.ownerTok||[]).includes(d.token)){
        why='👑 Entraste como dueño del juego: todos ven que estás mirando y podés chatear y hablar.';
        ob={id:'o'+(++S.seq), name:nm, emoji:'👑', token:d.token, peerId:conn.peer, conn:true, owner:true};
        S.observers.push(ob); sysChat(`👑 ${ob.name} (dueño del juego) entró a mirar.`);
      } else if(S.phase==='lobby' && S.players.length<MAXP){
        let name=nm; for(let k=2; S.players.some(x=>x.name.toLowerCase()===name.toLowerCase()); k++) name=nm.slice(0,13)+' '+k;
        p=addPlayer(name, d.ch|0, d.token, conn.peer);
        sysChat(`${p.emoji} ${p.name} entró a la sala.`);
      } else {
        why = S.phase==='lobby' ? 'La parrilla está llena (8 karts): entraste a mirar 👀.' : 'La carrera ya empezó: entraste a mirar 👀. Cuando termine podés sumarte a la próxima.';
        ob={id:'o'+(++S.seq), name:nm, emoji:'👀', token:d.token, peerId:conn.peer, conn:true};
        S.observers.push(ob); sysChat(`👀 ${ob.name} entró a mirar.`);
      }
    } else if(p) sysChat(`${p.emoji} ${p.name} se reconectó.`);
    else { why='Volviste a mirar 👀.'; sysChat(`👀 ${ob.name} volvió a mirar.`); }
    const who=p||ob;
    if(NET.conns[who.id] && NET.conns[who.id]!==conn) try{ NET.conns[who.id].close(); }catch(e){}
    conn.pid=who.id; NET.conns[who.id]=conn; who.conn=true; who.peerId=conn.peer; who.mic=false; who.cam=false; delete who.offAt;
    if(p) conn.send({t:'welcome', pid:p.id, code:NET.code});
    else conn.send({t:'welcome', pid:null, obs:ob.id, why, code:NET.code});
    conn.send({t:'chatlog', list:chatFor(who.id)});
    conn.send({t:'faces', map:FACES});
    commit(); return;
  }
  const pid=conn.pid; if(!pid) return;
  if(d.t==='rq'){ if(R && d.d && typeof d.d==='object' && d.id===R.id){ d.d.pid=pid; hostPedido(R, d.d); } }
  else if(d.t==='act'){ const r=act(pid, d.a||{}); if(typeof r==='string') try{ conn.send({t:'err', m:r}); }catch(e){} }
  else if(d.t==='chat') addChat(pid, d.text, d.to);
  else if(d.t==='face') hostSetFace(pid, d.img);
}
function onSeatChange(oldId, newId){
  if(NET.mode!=='host') return;
  const c=NET.conns[oldId]; if(!c) return;
  delete NET.conns[oldId]; NET.conns[newId]=c; c.pid=newId;
  if(FACES[oldId]){ FACES[newId]=FACES[oldId]; delete FACES[oldId]; }
  try{ c.send({t:'welcome', pid:newId, code:NET.code, why:'🪑 ¡Te sumaste a la parrilla!', force:true}); }catch(e){}
}
function alEchar(pid){ const c=NET.conns[pid]; if(c){ try{ c.send({t:'kicked'}); }catch(e){} setTimeout(()=>{ try{ c.close(); }catch(e){} }, 300); delete NET.conns[pid]; } }
// el kart de alguien que se fue o se cortó: lo sigue un bot desde donde estaba
function alSalirJugador(pid){ const k=R && R.porPid[pid]; if(k && !k.local && simulo()){ k.local=true; k.ausente=true; k.f0=k.idx; k.bot={f:.9, niv:'medio', lat:0, cambia:0, usaEn:1e9, turboEn:1e9, auto:true}; } }
function hostOnClose(conn){
  const pid=conn.pid; if(!pid || NET.conns[pid]!==conn || !S) return;
  delete NET.conns[pid];
  const ob=OB(pid);
  if(ob){ S.observers=S.observers.filter(x=>x!==ob); sysChat(`👀 ${ob.name} dejó de mirar.`); commit(); return; }
  const p=P(pid); if(!p) return;
  if(S.phase==='lobby'){ S.players=S.players.filter(x=>x!==p); sysChat(`${p.name} salió de la sala.`); }
  else if(!p.bot){ p.conn=false; p.mic=false; p.cam=false; p.offAt=Date.now(); sysChat(`⚠️ ${p.name} se desconectó. Un bot maneja su kart hasta que vuelva.`); alSalirJugador(pid); }
  commit();
}
setInterval(()=>{   // pulso para notar cortes bruscos
  if(NET.mode==='host'){
    for(const pid in NET.conns){ const c=NET.conns[pid]; if(!c) continue;
      if(Date.now()-(c.lastSeen||0)>15000){ try{ c.close(); }catch(e){} hostOnClose(c); continue; }
      if(c.open) try{ c.send({t:'ping'}); }catch(e){} }
  } else if(NET.mode==='client' && NET.welcomed){
    if(NET.hostConn && NET.hostConn.open) try{ NET.hostConn.send({t:'ping'}); }catch(e){}
    if(Date.now()-(NET.lastHostMsg||Date.now())>10000){
      if(!NET.hostLost){ NET.hostLost=true; netBar(true,'El anfitrión no responde. Reconectando…'); scheduleTakeover(); }
      if(Date.now()-(NET.lastTry||0)>8000){ NET.lastTry=Date.now(); const c=NET.hostConn; NET.hostConn=null; try{ c && c.close(); }catch(e){} connectHost(); }
    }
  }
}, 3000);

/* ---- traspaso de anfitrión: si el anfitrión se va o se corta, el siguiente sigue con el mismo código ---- */
const numId = id => +String(id).slice(1);
function hostCandidates(s){ return (s.players||[]).filter(p=>!p.bot && p.id!==s.hostPid && p.conn).sort((a,b)=>numId(a.id)-numId(b.id)); }
function sendBackups(){
  if(NET.mode!=='host' || !S) return;
  const msg={t:'backup', s:S, chat:CHAT.slice(-60)};
  hostCandidates(S).slice(0,2).forEach(p=>{ const c=NET.conns[p.id]; if(c && c.open) try{ c.send(msg); }catch(e){} });
}
function hostHandover(){
  const next=hostCandidates(S)[0]; if(!next) return leaveToMenu();
  const mine=P(NET.myPid);
  if(mine){ if(S.phase==='lobby') S.players=S.players.filter(p=>p!==mine); else { mine.bot=true; mine.conn=false; mine.token=null; mine.peerId=null; } }
  const c=NET.conns[next.id];
  try{ c.send({t:'migrate', s:S, chat:CHAT.slice(-60)}); }catch(e){}
  NET.noSave=true; store('kg_host', undefined);
  toast(`👑 ${next.name} quedó como anfitrión.`);
  setTimeout(leaveToMenu, 1200);
}
function scheduleTakeover(){
  if(NET.mode!=='client' || !NET.backup || NET.takeoverTimer) return;
  const pos=hostCandidates(NET.backup.s).map(p=>p.id).indexOf(NET.myPid);
  if(pos<0 || pos>1) return;
  NET.takeoverTimer=setTimeout(()=>{ NET.takeoverTimer=null; if(NET.mode==='client' && !(NET.hostConn && NET.hostConn.open)) takeoverHost('auto'); }, pos===0 ? 8000 : 20000);
}
function takeoverHost(reason){
  if(NET.mode!=='client' || !NET.backup) return;
  const bk=NET.backup, oldId=bk.s.hostPid, pristine=JSON.parse(JSON.stringify(bk));
  clearTimeout(NET.takeoverTimer); NET.takeoverTimer=null;
  try{ if(NET.hostConn) NET.hostConn.close(); }catch(e){}
  try{ NET.peer.destroy(); }catch(e){}
  NET.mode='host'; NET.conns={}; NET.hostConn=null; NET.obs=null; NET.backup=null; NET.hostLost=false; NET.noSave=false;
  S=bk.s; CHAT=bk.chat||[]; renderChat();
  const mine=P(NET.myPid), old=P(oldId);
  S.players.forEach(p=>{ if(p.id!==NET.myPid && !p.bot){ p.conn=false; p.mic=false; p.cam=false; p.offAt=Date.now(); } });
  S.observers=[];
  if(old && reason!=='handover'){ if(S.phase==='lobby') S.players=S.players.filter(p=>p!==old); }
  S.hostPid=NET.myPid;
  // la carrera sigue: desde ahora este aparato mueve los bots y los karts de los que todavía no volvieron
  if(R && S.phase==='race' && S.carrera && R.id===S.carrera.id){ R.host=true; R.objs=[]; R.cierre=null; if(R.estado==='fin') R.estado='carrera';
    for(const k of R.karts) if(k.pid!==NET.myPid && !k.fantasma){ const p=P(k.pid); k.local=true; k.f0=k.idx; k.lat=0; k.ausente=!(p && p.bot); k.humano=!(p && p.bot);
      k.bot={f:(NIVELES.find(n=>n.id===S.carrera.nivel)||NIVELES[1]).f, niv:p&&p.bot?S.carrera.nivel:'medio', lat:0, cambia:0, usaEn:0, turboEn:8, auto:!(p&&p.bot)}; } }
  netBar(true,'👑 Tomando el mando de la sala…');
  let tries=0;
  const claim=()=>{
    if(NET.mode!=='host') return;
    const peer=NET.peer=newPeer(PREFIX+NET.code);
    peer.on('open', id=>{
      netBar(false); mine.peerId=id; mine.conn=true; delete mine.offAt;
      sysChat(`👑 ${mine.name} ahora es el anfitrión${old?` (${old.name} ${reason==='handover'?'salió':'se desconectó'})`:''}. La carrera sigue.`);
      toast('👑 Ahora sos el anfitrión: la sala sigue desde tu aparato. No cierres el juego.');
      commit();
    });
    wireHostPeer(peer, ()=>{
      peer.destroy();
      if(++tries<8) return setTimeout(claim, 1500);
      NET.mode=null; clientJoin(NET.code); NET.welcomed=true; NET.backup=pristine; S=JSON.parse(JSON.stringify(pristine.s));
      netBar(true,'Reconectando con el anfitrión…');
    });
  };
  claim();
}

// ---------- cliente ----------
function clientJoin(code){
  NET.mode='client'; NET.code=code; NET.welcomed=false; NET.hostLost=false; NET.lastHostMsg=Date.now(); CHAT=[];
  const peer = NET.peer = newPeer();
  peer.on('open', ()=>connectHost());
  peer.on('call', onCall);
  peer.on('disconnected', ()=>{ if(!peer.destroyed) setTimeout(()=>{ try{ peer.reconnect(); }catch(e){} },1500); });
  peer.on('error', e=>{
    if(e.type==='peer-unavailable'){
      if(!NET.welcomed){ toast('No se encontró la sala '+code+'. Revisá el código.'); store('kg_client',undefined); leaveToMenu(); }
      else { netBar(true,'El anfitrión no responde. Reintentando…'); setTimeout(connectHost,3000); scheduleTakeover(); }
      return;
    }
    console.warn(e);
  });
  toast('Conectando a la sala '+code+'…');
}
function connectHost(){
  if(NET.mode!=='client' || !NET.peer || NET.peer.destroyed) return;
  if(NET.hostConn && NET.hostConn.open) return;
  const c=NET.peer.connect(PREFIX+NET.code, {reliable:true});
  NET.hostConn=c;
  c.on('open', ()=>{ netBar(false); clearTimeout(NET.takeoverTimer); NET.takeoverTimer=null; c.send({t:'hello', name:myName(), ch:miCh, token:myToken}); });
  c.on('data', d=>{ if(NET.hostConn!==c) return; NET.lastHostMsg=Date.now(); if(NET.hostLost){ NET.hostLost=false; netBar(false); } clientOnData(d); });
  c.on('close', ()=>{ if(NET.mode!=='client' || NET.hostConn!==c) return; netBar(true,'Se perdió la conexión con el anfitrión. Reconectando…'); setTimeout(connectHost,3000); scheduleTakeover(); });
}
function clientOnData(d){
  if(!d) return;
  if(d.t==='s') return clienteFoto(d);
  if(d.t==='ev'){ if(R && d.id===R.id) aplicarEvento(R, d.e); return; }
  if(d.t==='ping'){ try{ NET.hostConn.send({t:'pong'}); }catch(e){} return; }
  if(d.t==='pong') return;
  if(d.t==='welcome'){
    const cambia=NET.myPid!==d.pid;
    NET.myPid=d.pid; NET.obs=d.obs||null; NET.welcomed=true;
    store('kg_client',{code:NET.code, at:Date.now()}); if(location.hash!=='#'+NET.code) history.replaceState(null,'','#'+NET.code);
    if(d.why) toast(d.why);
    if(cambia && R){ quitarCarrera(); if(S) render(); }
    setTimeout(shareMyFace, 300);
  }
  else if(d.t==='state'){ S=d.s; render(); }
  else if(d.t==='chat'){ CHAT.push(d.m); renderChat(d.m); }
  else if(d.t==='chatlog'){ CHAT=d.list||[]; renderChat(); }
  else if(d.t==='faces' || d.t==='face') clientFace(d);
  else if(d.t==='backup'){ NET.backup={s:d.s, chat:d.chat}; }
  else if(d.t==='migrate'){ NET.backup={s:d.s, chat:d.chat}; takeoverHost('handover'); }
  else if(d.t==='kicked'){ toast('🚪 El anfitrión te sacó de la sala.'); store('kg_client',undefined); leaveToMenu(); }
  else if(d.t==='err') toast(d.m);
}

/* ====================== LA CARRERA EN ESTE APARATO ====================== */
const HUD={t:0, fant:[], fantT:0, msgT:0, obsI:0, pausa:false, netT:0};
function quitarCarrera(){ if(R){ R=null; M3.limpiar(); motorOff(); } $('#cuenta').textContent=''; HUD.pausa=false; $('#pausa').style.display='none'; }
function prepararCarrera(){
  const c=S.carrera, T=armarPista(c.pista), soyHost=simulo(), yo=NET.myPid;
  const parrilla=c.parrilla.map(pid=>{ const p=VP(pid); if(!p) return null;
    const ausente=soyHost && !p.bot && !p.conn && p.id!==yo;
    return {pid, ch:p.ch, color:p.color, nombre:p.name, bot:p.bot||ausente, lvl:c.nivel, local: p.id===yo || (soyHost && (p.bot||ausente)), ausente}; }).filter(Boolean);
  const lienzo=$('#c3d'); if(lienzo.parentElement!==$('#stage')) $('#stage').insertBefore(lienzo, $('#stage').firstChild);
  M3.calidad=CFG.calidad; if(!M3.init($('#c3d'))){ toast('Este aparato no pudo abrir el 3D 😕'); return; }
  M3.tam(); M3.cargar(T);
  const fant = S.crono ? load('kg_fant_'+c.pista) : null;
  if(fant) parrilla.push({pid:'fantasma', ch:miCh, color:'#ffffff', nombre:'Tu fantasma', fantasma:true, local:true});
  R=crearCarrera({pista:c.pista, vueltas:c.vueltas, ritmo:c.ritmo, nivel:c.nivel, objetos:c.objetos, parrilla, host:soyHost, miPid:yo});
  R.id=c.id; R.listo=soyHost;
  R.karts.forEach(k=>{ const e=parrilla.find(x=>x.pid===k.pid); if(e.ausente){ k.ausente=true; k.humano=true; } if(k.fantasma){ k.datos=fant; const v=M3.kart(k); v.malla.material.transparent=true; v.malla.material.opacity=.38; v.sombra.visible=false; } });
  if(S.crono){ const k=R.porPid[yo]; k.item='chipa3'; k.itemN=3; }
  R.pedir = d => { if(simulo()) hostPedido(R, d); else if(NET.hostConn && NET.hostConn.open) try{ NET.hostConn.send({t:'rq', d, id:R.id}); }catch(e){} };
  R.emitir = e => { const r=R; aplicarEvento(r, e); if(NET.mode==='host') difundir({t:'ev', e, id:r.id}); };
  R.alFx = fxCarrera;
  R.alTerminar = res => { if(simulo()) cerrarCarrera(res); };
  HUD.fant=[]; HUD.fantT=0; HUD.obsI=0; HUD.mini=null; HUD.cuentaN=null; LAST.res=null;
  ponerEtiquetas(); dibujarMiniBase();
  $('#pistaNombre').innerHTML=`${PISTAS[c.pista].e} <b>${esc(PISTAS[c.pista].n)}</b>${c.modo==='copa'?` <small>· ${esc((COPAS.find(x=>x.id===S.opts.copa)||{}).n||'')} ${S.iCopa+1}/4</small>`:''}`;
  $('#cartelPista').innerHTML=`<span>${PISTAS[c.pista].e}</span><b>${esc(PISTAS[c.pista].n)}</b><small>${esc(PISTAS[c.pista].d)}</small>`; $('#cartelPista').classList.remove('fuera'); void $('#cartelPista').offsetWidth; $('#cartelPista').classList.add('on');
  setTimeout(()=>$('#cartelPista').classList.remove('on'), 4200);
  motorOn(); renderTouch();
}
function ponerEtiquetas(){ if(!R) return; for(const k of R.karts){ if(k.fantasma) continue; const p=VP(k.pid); M3.etiqueta(k, (p?p.name:k.nombre)+(p&&p.bot?' 🤖':''), CFG.calidad==='baja'?null:FACES[k.pid]); } }
// la foto que manda el anfitrión unas 12 veces por segundo
function clienteFoto(d){
  if(!R || d.id!==R.id) return;
  const yo=R.porPid[NET.myPid];
  if(!R.listo){ R.listo=true; R.t=d.rt;
    if(d.rt>.5 && yo && d.k[yo.pid]){ const a=d.k[yo.pid]; yo.x=a[0]; yo.y=a[1]; yo.z=a[2]; yo.h=a[3]; yo.v=a[4]; yo.prog=a[5]; const L=ubicarGlobal(R.T, yo.x, yo.z); yo.idx=L.i; yo.f0=L.f; yo.lapN=Math.floor(yo.prog/R.T.N); yo.tVuelta=R.t; yo.largo=true; yo.fin=a[8]||null; } }
  else if(Math.abs(R.t-d.rt)>.5) R.t=d.rt;
  for(const pid in d.k){ const k=R.porPid[pid]; if(k && !k.local) desempacar(R, k, d.k[pid]); }
  R.objs=(d.o||[]).map(a=>({id:a[0], t:a[1], x:a[2], y:a[3], z:a[4]}));
  const off=d.c||[]; for(let i=0;i<R.cajasOff.length;i++){ if(off.includes(i)) R.cajasOff[i]=Math.max(R.cajasOff[i], R.reloj+.5); else if(R.cajasOff[i]-R.reloj<2.8) R.cajasOff[i]=0; }
  if(d.tor>0 && R.tormenta<=0) R.tormenta=d.tor;
}
function mandarRed(){
  if(!R) return;
  if(NET.mode==='host'){
    const k={}; for(const q of R.karts) if(!q.fantasma) k[q.pid]=empacar(q);
    const c=[]; for(let i=0;i<R.cajasOff.length;i++) if(R.cajasOff[i]>R.reloj) c.push(i);
    difundir({t:'s', id:R.id, rt:Math.round(R.t*1000)/1000, k, o:R.objs.map(o=>[o.id, o.t, Math.round(o.x*10)/10, Math.round(o.y*10)/10, Math.round(o.z*10)/10]), c, tor:R.tormenta>0?Math.round(R.tormenta*10)/10:0});
  } else if(NET.mode==='client' && R.listo && NET.myPid && R.porPid[NET.myPid] && NET.hostConn && NET.hostConn.open){
    try{ NET.hostConn.send({t:'k', id:R.id, a:empacar(R.porPid[NET.myPid])}); }catch(e){}
  }
}

/* ---------- controles ---------- */
const TECLAS={}, TOQUE={izq:0, der:0, gas:0, freno:0, derrape:0, usar:0}, TILT={v:0, ok:false};
const enJuego = () => !!R && $('#game').classList.contains('on');
addEventListener('keydown', e=>{
  if(/^(INPUT|TEXTAREA|SELECT)$/.test((e.target||{}).tagName||'')) return;
  if(!enJuego()) return;
  TECLAS[e.code]=1;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
  if(e.code==='KeyR') volverPista();
  if(e.code==='Escape' || e.code==='KeyP') pausar();
  if(e.code==='KeyC') camSiguiente();
});
addEventListener('keyup', e=>{ TECLAS[e.code]=0; });
addEventListener('blur', ()=>{ for(const k in TECLAS) TECLAS[k]=0; for(const k in TOQUE) TOQUE[k]=0; });
function ligarToques(){
  $$('[data-t]').forEach(b=>{
    const k=b.dataset.t, on=e=>{ if(ED.on) return; e.preventDefault(); TOQUE[k]=1; b.classList.add('ap'); try{ b.setPointerCapture(e.pointerId); }catch(x){} actx(); }, off=e=>{ TOQUE[k]=0; b.classList.remove('ap'); };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off);
    b.addEventListener('contextmenu', e=>e.preventDefault());
  });
}
/* posiciones de los botones táctiles: cada uno se puede mover y agrandar (se guarda en el aparato) */
const CTRL = Object.assign({}, load('kg_ctrl')||{});
// lado (l/r), distancia a ese borde, distancia al borde de abajo, tamaño
function ctrlDef(id){
  const D = {tIzq:['l',12,30,88], tDer:['l',110,30,88], tGas:['r',12,18,96], tDerr:['r',18,128,84], tObj:['r',122,110,70], tFreno:['r',122,18,64]};
  if(CFG.auto) Object.assign(D, {tDerr:['r',12,18,96], tObj:['r',122,98,72], tFreno:['r',122,14,64]});   // sin GO, el derrape va a la esquina
  return D[id];
}
const CTRL_IDS = ['tIzq','tDer','tGas','tDerr','tObj','tFreno'];
function aplicarCtrl(){
  for(const id of CTRL_IDS){
    const b=$('#'+id), [lado,dx,dy,s]=CTRL[id]||ctrlDef(id);
    b.style.left = lado==='l' ? `calc(${dx}px + env(safe-area-inset-left))` : 'auto';
    b.style.right = lado==='r' ? `calc(${dx}px + env(safe-area-inset-right))` : 'auto';
    b.style.bottom = `calc(${dy}px + env(safe-area-inset-bottom))`;
    b.style.width = b.style.height = s+'px';
    b.style.fontSize = Math.round(s*(id==='tGas'?.27:id==='tFreno'?.22:id==='tObj'?.44:.38))+'px';
  }
  $('#toques').style.opacity = (CTRL._op||100)/100;
}
const ED={on:false, sel:null, drag:null};
function editarControles(){
  closeModal(); ED.on=true; document.body.classList.add('editando'); renderTouch();
  $('#eOp').value=CTRL._op||100; $('#eAuto').checked=!!CFG.auto; ctrlElegir(CFG.auto?'tDerr':'tGas');
}
function ctrlElegir(id){ ED.sel=id; $$('#toques button').forEach(b=>b.classList.toggle('sel', b.id===id)); $('#eSel').textContent=$('#'+id).firstChild.textContent.trim(); $('#eTam').value=(CTRL[id]||ctrlDef(id))[3]; }
function ctrlTam(v){ if(!ED.sel) return; const c=(CTRL[ED.sel]||ctrlDef(ED.sel)).slice(); c[3]=+v; CTRL[ED.sel]=c; aplicarCtrl(); }
function ctrlOp(v){ CTRL._op=+v; aplicarCtrl(); }
function ctrlReset(){ Object.keys(CTRL).forEach(k=>{ CTRL[k]=undefined; }); for(const k of Object.keys(CTRL)) if(CTRL[k]===undefined) Reflect.deleteProperty(CTRL, k); aplicarCtrl(); $('#eOp').value=100; if(ED.sel) ctrlElegir(ED.sel); toast('Los controles volvieron a como venían.'); }
function ctrlListo(){ ED.on=false; document.body.classList.remove('editando'); $$('#toques button').forEach(b=>b.classList.remove('sel')); store('kg_ctrl', CTRL); renderTouch(); toast('🎮 Controles guardados en este aparato.'); }
function ctrlArrastre(){
  $$('#toques button').forEach(b=>{
    b.addEventListener('pointerdown', e=>{ if(!ED.on) return; e.preventDefault(); e.stopPropagation(); ctrlElegir(b.id); const r=b.getBoundingClientRect(); ED.drag={b, ox:e.clientX-(r.left+r.width/2), oy:e.clientY-(r.top+r.height/2)}; try{ b.setPointerCapture(e.pointerId); }catch(x){} }, true);
    b.addEventListener('pointermove', e=>{ if(!ED.on || !ED.drag || ED.drag.b!==b) return;
      const W=innerWidth, Hh=innerHeight, s=(CTRL[b.id]||ctrlDef(b.id))[3];
      const cx=Math.max(s/2, Math.min(W-s/2, e.clientX-ED.drag.ox)), cy=Math.max(s/2, Math.min(Hh-s/2, e.clientY-ED.drag.oy));
      CTRL[b.id] = cx<W/2 ? ['l', Math.round(cx-s/2), Math.round(Hh-cy-s/2), s] : ['r', Math.round(W-cx-s/2), Math.round(Hh-cy-s/2), s];
      aplicarCtrl(); });
    const fin=()=>{ ED.drag=null; }; b.addEventListener('pointerup', fin); b.addEventListener('pointercancel', fin);
  });
}
function renderTouch(){
  const t=tactil()||ED.on; $('#toques').classList.toggle('tactil', t);
  $('#tGas').style.display = CFG.auto ? 'none' : '';
  aplicarCtrl();
  $('#tIzq').style.display = $('#tDer').style.display = CFG.tilt && TILT.ok ? 'none' : '';
  $('#ayudaTeclas').style.display = t ? 'none' : '';
}
function setTilt(on){
  CFG.tilt=on; guardarCfg();
  if(on){ const D=window.DeviceOrientationEvent; if(D && typeof D.requestPermission==='function') D.requestPermission().then(r=>{ if(r!=='granted'){ CFG.tilt=false; guardarCfg(); toast('No se dio permiso para usar la inclinación.'); } }).catch(()=>{});
    toast('📱 Inclinación prendida: girá el celular como un volante.'); }
  renderTouch();
}
addEventListener('deviceorientation', e=>{
  if(e.gamma==null) return; TILT.ok=true;
  const ang=(screen.orientation && screen.orientation.angle) || window.orientation || 0;
  const g = ang===90 ? e.beta : (ang===270||ang===-90) ? -e.beta : e.gamma;
  TILT.v=Math.max(-1, Math.min(1, g/24));
});
function leerEntrada(){
  const K=TECLAS; let dir=(K.ArrowRight||K.KeyD?1:0)-(K.ArrowLeft||K.KeyA?1:0)+TOQUE.der-TOQUE.izq;
  let gas=K.ArrowUp||K.KeyW||TOQUE.gas?1:0, freno=K.ArrowDown||K.KeyS||TOQUE.freno?1:0, derrape=K.Space||K.ShiftLeft||K.ShiftRight||TOQUE.derrape?1:0, usar=K.KeyX||K.KeyE||K.Enter||K.ControlLeft||TOQUE.usar?1:0;
  if(CFG.tilt && TILT.ok && tactil() && Math.abs(TILT.v)>.06) dir+=TILT.v;
  if(CFG.auto && tactil() && !freno) gas=1;
  const pads=navigator.getGamepads ? navigator.getGamepads() : [];
  for(const g of pads){ if(!g || !g.connected) continue; const b=i=>g.buttons[i] && g.buttons[i].pressed, ax=g.axes[0]||0;
    if(Math.abs(ax)>.15) dir+=ax; if(b(14)) dir-=1; if(b(15)) dir+=1;
    if(b(0)||b(7)) gas=1; if(b(1)||b(6)) freno=1; if(b(5)||b(2)) derrape=1; if(b(4)||b(3)) usar=1; if(b(9) && !leerEntrada.st) pausar(); leerEntrada.st=b(9); break; }
  return {gas, freno, dir:Math.max(-1, Math.min(1, dir)), derrape, usar};
}
function volverPista(){ const k=R && R.porPid[NET.myPid]; if(k && k.local && !k.bot && R.t>0 && k.spin<=0 && k.hielo<=0 && k.parpadeo<=0){ recolocar(R, k); sfx.sel(); } }
function pausar(){ if(!R || NET.mode!=='local' || S.phase!=='race') return; HUD.pausa=!HUD.pausa; $('#pausa').style.display=HUD.pausa?'flex':'none'; document.body.classList.toggle('pausado', HUD.pausa); if(HUD.pausa) motorSet(0,0,0,0,true); }
function camSiguiente(){ HUD.obsI++; }

/* ---------- lo que se ve y se oye cuando pasa algo ---------- */
function vib(p){ try{ if(CFG.vib && navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(p); }catch(e){} }
function aviso(t, cls){ const d=$('#hMsg'); d.textContent=t; d.className='hmsg on '+(cls||''); clearTimeout(aviso.t); aviso.t=setTimeout(()=>d.className='hmsg', 1500); }
function fxCarrera(e){
  const yo=NET.myPid, nom=id=>{ const p=VP(id); return p?p.name:''; };
  switch(e.k){
    case 'largada': aviso('🚀 ¡Largada turbo!','oro'); sfx.turbo(); break;
    case 'chispa': sfx.chispa(e.n); break;
    case 'miniturbo': sfx.turbo(); if(e.n>=2) aviso(e.n>=3?'🔥 ¡Súper mini turbo!':'💨 ¡Mini turbo!','oro'); vib(30); break;
    case 'truco': aviso('🤸 ¡Pirueta!','oro'); sfx.sel(); break;
    case 'salto': sfx.salto(); break;
    case 'flecha': sfx.turbo(); vib(30); break;
    case 'rebufo': aviso('🌪️ ¡Rebufo!'); break;
    case 'caja': sfx.caja(); break;
    case 'tengo': sfx.tengo(); break;
    case 'uso': if(e.pid==null){ sfx.usar(e.o); } else if(e.pid!==yo && e.o==='tormenta') aviso('⛈️ '+nom(e.pid)+' trajo la tormenta'); break;
    case 'vuelta': if(e.ultima){ aviso('🔔 ¡Última vuelta!','oro'); sfx.ultima(); } else if(e.n<=R.vueltas) { aviso('Vuelta '+e.n+' · '+fmtT(e.t)); sfx.vuelta(); } break;
    case 'meta': sfx.meta(); bigText('🏁 ¡Llegaste!', R.porPid[yo] ? R.porPid[yo].puesto+'º puesto' : ''); break;
    case 'golpe': if(e.pid===yo){ aviso(e.c==='hielo'?'🧊 ¡Te congelaron!':'💫 ¡Patinaste!','rojo'); sfx.golpe(e.c); vib([80,40,120]); } else if(e.por===yo){ aviso('🎯 ¡Le diste a '+nom(e.pid)+'!','oro'); sfx.acierto(); } break;
    case 'escudo': if(e.pid===yo){ aviso('🕸️ ¡El ñandutí te salvó!','oro'); sfx.escudo(); } break;
    case 'tormenta': sfx.trueno(); if(e.de===yo) aviso('⛈️ ¡Tormenta para todos!','oro'); break;
  }
}

/* ---------- el bucle ---------- */
let tPrev=performance.now(), tRaf=0;
function cuadro(dt, dibujar){
  if(R && !HUD.pausa && !(NET.mode==='local' && !deCostado())){
    const yo=R.porPid[NET.myPid], inp=yo && !yo.bot ? leerEntrada() : null;
    if(R.listo || R.host){ let q=dt; while(q>1e-4){ const h=Math.min(q, .034); pasoCarrera(R, h, inp); q-=h; } }
    else R.reloj+=dt;
    HUD.netT+=dt; if(HUD.netT>=.08){ HUD.netT=0; mandarRed(); }
    if(S && S.crono && yo && R.t>=0 && yo.fin==null){ HUD.fantT+=dt; while(HUD.fantT>=.1){ HUD.fantT-=.1; HUD.fant.push([Math.round(yo.x*10), Math.round(yo.y*10), Math.round(yo.z*10), Math.round(yo.h*100)]); } }
    if(dibujar){
      const cam = yo || R.orden[HUD.obsI%Math.max(1,R.orden.length)];
      if(!R.listo && !R.host) M3.paseo(R, R.reloj);
      M3.sync(R, cam, dt); hud(dt, cam);
      if(yo) motorSet(yo.v, yo.drift, yo.boost>0||yo.viento>0, yo.fuera, false); else if(cam) motorSet(cam.v, cam.drift, cam.boost>0, false, false);
    }
  } else if(R && dibujar && NET.mode==='local' && !deCostado()) motorSet(0,0,0,0,true);
  else if(dibujar && !R && $('#menu').classList.contains('on') && M3.listo && M3.enVitrina()) M3.cuadroVitrina(performance.now()/1000);
}
function bucle(t){ const dt=Math.min(.1, (t-tPrev)/1000); tPrev=t; tRaf=t; cuadro(dt, true); requestAnimationFrame(bucle); }
requestAnimationFrame(bucle);
// con la pestaña escondida el navegador frena los dibujos: la carrera (bots, red) sigue igual con este reloj
setInterval(()=>{ const t=performance.now(); if(t-tRaf<250) return; const dt=Math.min(1.2, (t-tPrev)/1000); tPrev=t; cuadro(dt, false); }, 100);
addEventListener('resize', ()=>{ M3.tam(); renderTouch(); });

/* ---------- tablero de la carrera ---------- */
const ORD=['1º','2º','3º','4º','5º','6º','7º','8º'];
function dibujarMiniBase(){
  const T=R.T, c=document.createElement('canvas'), W=150; c.width=c.height=W;
  const g=c.getContext('2d'), b=T.caja, esc2=Math.min((W-16)/(b.x1-b.x0), (W-16)/(b.z1-b.z0)), ox=W/2-(b.x0+b.x1)/2*esc2, oz=W/2-(b.z0+b.z1)/2*esc2;
  HUD.mini={c, e:esc2, ox, oz, W};
  const tr=()=>{ g.beginPath(); T.S.forEach((s,i)=>{ const x=s.x*esc2+ox, y=s.z*esc2+oz; i?g.lineTo(x,y):g.moveTo(x,y); }); g.closePath(); };
  g.lineJoin='round'; tr(); g.strokeStyle='rgba(0,0,0,.55)'; g.lineWidth=9; g.stroke(); tr(); g.strokeStyle='#fff'; g.lineWidth=5; g.stroke();
  g.setLineDash([3,3]); g.strokeStyle='#ffd77a'; g.lineWidth=2; for(const a of T.atajos){ g.beginPath(); a.pts.forEach((p,i)=>{ const x=p.x*esc2+ox, y=p.z*esc2+oz; i?g.lineTo(x,y):g.moveTo(x,y); }); g.stroke(); }
  g.setLineDash([]); const s=T.S[0]; g.strokeStyle='#d52b1e'; g.lineWidth=3; g.beginPath(); g.moveTo((s.x+s.nx*10)*esc2+ox, (s.z+s.nz*10)*esc2+oz); g.lineTo((s.x-s.nx*10)*esc2+ox, (s.z-s.nz*10)*esc2+oz); g.stroke();
}
function hud(dt, cam){
  HUD.t+=dt;
  // cuenta regresiva
  const n = R.t<0 ? Math.ceil(-R.t) : R.t<1 ? 0 : null, cu=$('#cuenta');
  if(n!==HUD.cuentaN){ HUD.cuentaN=n; if(n!=null && n<=3 && (R.listo||R.host)){ cu.textContent=n===0?'¡YA!':n; cu.className='cuenta pop'+(n===0?' ya':''); void cu.offsetWidth; cu.classList.add('go'); if(n===0) sfx.ya(); else sfx.bip(); if(n===0) musicSync(); } else { cu.textContent=''; cu.className='cuenta'; } }
  // minimapa (cada cuadro, es liviano)
  const m=HUD.mini, cv=$('#mini'), g=cv.getContext('2d');
  if(m){ g.clearRect(0,0,m.W,m.W); g.drawImage(m.c,0,0);
    for(const k of R.orden.slice().reverse()){ const x=k.x*m.e+m.ox, y=k.z*m.e+m.oz, yo=k===cam; g.beginPath(); g.arc(x,y,yo?5.5:3.6,0,6.283); g.fillStyle=k.color; g.fill(); g.lineWidth=yo?2.4:1.2; g.strokeStyle=yo?'#fff':'rgba(0,0,0,.7)'; g.stroke(); } }
  if(HUD.t<.1) return; HUD.t=0;
  const k=cam; if(!k) return;
  const tot=R.orden.length, fin=k.fin!=null;
  $('#hPos').innerHTML = S && S.crono ? '⏱️' : `${k.puesto}<small>º</small><i>/${tot}</i>`;
  $('#hVuelta').textContent = 'Vuelta '+Math.min(R.vueltas, Math.max(0,k.lapN)+1)+'/'+R.vueltas;
  $('#hTiempo').textContent = fmtT(fin ? k.fin : Math.max(0, R.t));
  $('#hVel').innerHTML = Math.round(Math.abs(k.v)*3.4)+'<small>km/h</small>';
  const ob=$('#hObj'), it=k.ruleta>0 ? COD_OBJ[Math.floor(R.reloj*14)%COD_OBJ.length] : k.item;
  ob.innerHTML = it ? `<span>${OBJETOS[it].e}</span>${k.ruleta<=0 && k.itemN>1?`<i>×${k.itemN}</i>`:''}` : ''; ob.classList.toggle('lleno', !!k.item && k.ruleta<=0); ob.classList.toggle('gira', k.ruleta>0);
  $('#tObj').classList.toggle('lleno', !!k.item && k.ruleta<=0); $('#tObj').firstChild.textContent = k.item && k.ruleta<=0 ? OBJETOS[k.item].e : '🎁';
  $('#hRank').innerHTML = R.orden.map((q,i)=>{ const p=VP(q.pid); return `<div class="${q===k?'yo':''} ${q.fin!=null?'fin':''}"><b>${i+1}</b><i style="background:${q.color}"></i>${piloto(q.ch).e} <span>${esc(p?p.name:q.nombre)}</span>${q.fin!=null?' 🏁':''}</div>`; }).join('');
  const rev=$('#hAviso'), yo=R.porPid[NET.myPid];
  rev.style.display = yo && !yo.bot && (yo.alReves>1 || yo.quieto>3) && R.t>2 ? 'block' : 'none';
  rev.textContent = yo && yo.alReves>1 ? '⛔ ¡Vas al revés! Tocá ↺ para volver' : '↺ ¿Te trabaste? Tocá para volver a la pista';
  $('#obsbar').style.display = NET.obs ? 'block' : 'none';
  $('#btnReco').style.display = yo && !yo.bot ? '' : 'none';
  $('#hud').classList.toggle('turbo', k.boost>0||k.viento>0); $('#hud').classList.toggle('lluvia', R.tormenta>0);
}

/* ====================== CHAT (general y privado) ====================== */
let chatSeq=0;
const people = () => S ? [...S.players, ...(S.observers||[])] : [];
const chatFor = pid => CHAT.filter(m=>!m.to || m.to===pid || m.from===pid).slice(-80);
function addChat(pid, text, to){
  text=String(text||'').trim().slice(0,300); if(!text || !S) return;
  const w=P(pid)||OB(pid); if(!w) return;
  let t = to ? (P(to)||OB(to)) : null;
  if(!t && text[0]==='@'){ const low=text.toLowerCase(); t=people().filter(x=>x.id!==pid && low.startsWith('@'+x.name.toLowerCase())).sort((a,b)=>b.name.length-a.name.length)[0]||null; }
  if(t && t.id===pid) t=null;
  const m={id:Date.now()+'-'+(++chatSeq), from:pid, n:w.name+(w.owner?' (dueño del juego)':pid[0]==='o'?' (mirando)':''), e:w.emoji, c:w.color||'#666', x:text, to:t?t.id:null, toN:t?t.name:null};
  pushChat(m);
  if(t && t.bot && NET.mode!=='client') setTimeout(()=>{ if(S && P(t.id)) addChat(t.id, ['¡Nos vemos en la pista! 🏁','Jajaja, alcanzame si podés 💨','Cuidado con la cáscara de mango 🥭','Che, convidá tereré 🧉'][rnd(4)], pid); }, 900+rnd(900));
}
function sysChat(x){ pushChat({id:Date.now()+'-'+(++chatSeq), sys:true, x}); }
function pushChat(m){
  CHAT.push(m); if(CHAT.length>250) CHAT.shift();
  if(NET.mode==='host') for(const pid in NET.conns){ if(m.to && pid!==m.to && pid!==m.from) continue; const c=NET.conns[pid]; if(c&&c.open) try{ c.send({t:'chat', m}); }catch(e){} }
  renderChat(m);
}
function chatLine(m){
  if(m.sys) return `<div class="msg sys">${esc(m.x)}</div>`;
  const mine=m.from===me();
  let x=esc(m.x).replace(/(^|\s)@([^\s]+)/g,'$1<span class="at">@$2</span>');
  if(m.to){ const hdr = mine ? `🔒 Privado para ${esc(m.toN)}` : `🔒 Privado de ${esc(m.n)} para vos`; return `<div class="msg priv"><small>${hdr}</small><span class="who">${esc(m.e)} ${esc(m.n)}:</span> ${x}</div>`; }
  return `<div class="msg"><span class="who" style="color:${esc(m.c)}">${esc(m.e)} ${esc(m.n)}:</span> ${x}</div>`;
}
function renderChat(m){
  const el=$('#chatList'), myId=me();
  const vis = x => !x.to || x.to===myId || x.from===myId;
  if(m){
    if(!vis(m)) return;
    el.insertAdjacentHTML('beforeend', chatLine(m));
    if(!m.sys && m.from!==myId){
      if(!sideVisible('chat')){ UNREAD++; refreshUnread(); if(enJuego() && !m.to){ const d=$('#hChat'); d.textContent=`${m.e} ${m.n}: ${m.x.slice(0,70)}`; d.classList.add('on'); clearTimeout(renderChat.t); renderChat.t=setTimeout(()=>d.classList.remove('on'), 4200); } }
      if(m.to){ sfx.priv(); if(!sideVisible('chat')) toast(`🔒 ${m.n} te escribió en privado: ${m.x.slice(0,80)}`); }
    }
  } else el.innerHTML=CHAT.filter(vis).map(chatLine).join('');
  el.scrollTop=el.scrollHeight;
}
let UNREAD=0;
function refreshUnread(){ const b=$('#unread'); b.style.display=UNREAD?'inline-block':'none'; b.textContent=UNREAD; }
function sideVisible(tab){ const on=$('#tab-'+tab).classList.contains('on'); if($('#lobby').classList.contains('on')) return on; return on && $('#side').classList.contains('open'); }
function toggleSide(force){ const s=$('#side'), open = force==null ? !s.classList.contains('open') : force; s.classList.toggle('open', open); document.body.classList.toggle('panel', open); if(open && force==null) setTab('chat'); }
function setTab(t){
  $$('#tabs button').forEach(b=>b.classList.toggle('on', b.dataset.tab===t));
  $$('.tabp').forEach(p=>p.classList.toggle('on', p.id==='tab-'+t));
  if(t==='chat'){ UNREAD=0; refreshUnread(); const el=$('#chatList'); el.scrollTop=el.scrollHeight; }
}
$$('#tabs button').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
function renderChatTo(){
  const sel=$('#chatTo'), cur=sel.value, myId=me();
  const list=V ? [...V.players, ...(V.observers||[])].filter(x=>x.id!==myId) : [];
  const key=list.map(x=>x.id+x.name).join('|'); if(sel.dataset.k===key) return; sel.dataset.k=key;
  sel.innerHTML=`<option value="">📢 Todos</option>`+list.map(x=>`<option value="${x.id}">🔒 ${esc(x.emoji)} ${esc(x.name)}</option>`).join('');
  if(list.some(x=>x.id===cur)) sel.value=cur;
  chatToChanged();
}
function chatToChanged(){ $('#chatIn').classList.toggle('priv', !!$('#chatTo').value); }
function sendChatRaw(text, to){
  if(!text) return;
  if(NET.mode==='client'){ if(NET.hostConn && NET.hostConn.open) NET.hostConn.send({t:'chat', text, to:to||null}); else toast('Sin conexión.'); }
  else addChat(me(), text, to||null);
}
function sendChat(){ const i=$('#chatText'), text=i.value.trim(); if(!text) return; sendChatRaw(text, $('#chatTo').value); i.value=''; atClose(); }
const AT={list:[], sel:0};
function atClose(){ $('#atpop').classList.remove('on'); AT.list=[]; }
$('#chatText').addEventListener('input', ()=>{
  const v=$('#chatText').value, m=v.match(/^@([^\s]*)$/);
  if(!m || !V){ atClose(); return; }
  const q=m[1].toLowerCase(), myId=me();
  AT.list=[...V.players, ...(V.observers||[])].filter(x=>x.id!==myId && x.name.toLowerCase().startsWith(q)); AT.sel=0;
  if(!AT.list.length){ atClose(); return; }
  $('#atpop').innerHTML=AT.list.map((x,i)=>`<div class="${i===AT.sel?'sel':''}" onmousedown="event.preventDefault();atPick(${i})">🔒 ${esc(x.emoji)} ${esc(x.name)}</div>`).join('');
  $('#atpop').classList.add('on');
});
function atPick(i){ const x=AT.list[i]; if(!x) return; $('#chatTo').dataset.k=''; renderChatTo(); $('#chatTo').value=x.id; chatToChanged(); $('#chatText').value=''; atClose(); $('#chatText').focus(); toast(`🔒 Ahora le escribís en privado a ${x.name}. Para volver a todos, elegí “📢 Todos”.`); }
$('#chatText').addEventListener('keydown', e=>{
  if($('#atpop').classList.contains('on')){
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault(); AT.sel=(AT.sel+(e.key==='ArrowDown'?1:-1)+AT.list.length)%AT.list.length; $$('#atpop div').forEach((d,i)=>d.classList.toggle('sel',i===AT.sel)); return; }
    if(e.key==='Enter'||e.key==='Tab'){ e.preventDefault(); atPick(AT.sel); return; }
    if(e.key==='Escape'){ atClose(); return; }
  }
  if(e.key==='Enter') sendChat();
});
function fraseRapida(x){ if(x) sendChatRaw(x, $('#chatTo').value); }

/* ====================== VOZ ====================== */
const VOICE={stream:null, calls:{}, audios:{}, muted:false};
function stopMic(tell){
  if(!VOICE.stream) return;
  VOICE.stream.getTracks().forEach(t=>t.stop()); VOICE.stream=null;
  Object.values(VOICE.calls).forEach(c=>{ try{ c.close(); }catch(e){} }); VOICE.calls={};
  if(tell) doAct({type:'mic', on:false});
  renderVoice();
}
async function toggleMic(){
  if(VOICE.stream) stopMic(true);
  else {
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ toast('Este navegador no permite usar el micrófono (se necesita HTTPS).'); return; }
    try{ VOICE.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true, noiseSuppression:true, autoGainControl:true}}); }
    catch(e){ toast('No se pudo activar el micrófono. Revisá el permiso del navegador.'); return; }
    doAct({type:'mic', on:true}); voiceSync();
  }
  renderVoice();
}
function voiceSync(){
  if(!VOICE.stream || !NET.peer || !V || NET.mode==='local') return;
  const myPeer=NET.peer.id, live=new Set();
  for(const p of [...V.players, ...(V.observers||[])]){
    if(!p.peerId || p.peerId===myPeer || !p.conn) continue;
    live.add(p.peerId);
    if(!VOICE.calls[p.peerId]){
      const c=NET.peer.call(p.peerId, VOICE.stream); if(!c) continue;
      VOICE.calls[p.peerId]=c;
      const drop=()=>{ if(VOICE.calls[p.peerId]===c) delete VOICE.calls[p.peerId]; };
      c.on('close',drop); c.on('error',drop);
    }
  }
  for(const id in VOICE.calls) if(!live.has(id)){ try{ VOICE.calls[id].close(); }catch(e){} delete VOICE.calls[id]; }
}
function onCall(call){
  if(call.metadata && call.metadata.kind==='cam') return camOnCall(call);
  call.answer();
  call.on('stream', st=>{
    let a=VOICE.audios[call.peer];
    if(!a){ a=document.createElement('audio'); a.autoplay=true; a.setAttribute('playsinline',''); document.body.appendChild(a); VOICE.audios[call.peer]=a; }
    a.srcObject=st; a.muted=VOICE.muted; a.play().catch(()=>{});
  });
  call.on('close', ()=>{ const a=VOICE.audios[call.peer]; if(a){ a.srcObject=null; a.remove(); delete VOICE.audios[call.peer]; } });
}
function toggleSpk(){ VOICE.muted=!VOICE.muted; Object.values(VOICE.audios).forEach(a=>{ a.muted=VOICE.muted; if(!VOICE.muted) a.play().catch(()=>{}); }); renderVoice(); }
function renderVoice(){
  const b=$('#btnMic'); b.textContent = VOICE.stream ? '🎤 Micrófono ACTIVO' : '🎤 Activar micrófono';
  b.classList.toggle('on', !!VOICE.stream); b.classList.toggle('gray', !VOICE.stream);
  $('#btnSpk').textContent = VOICE.muted ? '🔇' : '🔊';
  $('#btnMic').style.display = $('#btnSpk').style.display = NET.mode==='local' ? 'none' : '';
  const hm=$('#hMic'); hm.style.display = NET.mode==='local'||!NET.mode ? 'none' : ''; hm.textContent = VOICE.stream ? '🎙️' : '🎤'; hm.classList.toggle('on', !!VOICE.stream);
}

/* ====================== SONIDOS ====================== */
const SND={on:load('kg_snd')!==false, ctx:null};
function actx(){ if(!SND.ctx){ try{ SND.ctx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } if(SND.ctx && SND.ctx.state==='suspended') SND.ctx.resume(); return SND.ctx; }
function tone(f, d, type, v, when, f2){
  if(!SND.on) return; const c=actx(); if(!c) return;
  const t=c.currentTime+(when||0), o=c.createOscillator(), g=c.createGain();
  o.type=type||'sine'; o.frequency.setValueAtTime(f,t); if(f2) o.frequency.exponentialRampToValueAtTime(f2, t+d);
  g.gain.setValueAtTime(v||.12,t); g.gain.exponentialRampToValueAtTime(.001,t+d);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t+d+.02);
}
function noise(d, v, when, hp, tipo){
  if(!SND.on) return; const c=actx(); if(!c) return;
  const t=c.currentTime+(when||0), b=c.createBuffer(1, Math.max(1,c.sampleRate*d|0), c.sampleRate), ch=b.getChannelData(0);
  for(let i=0;i<ch.length;i++) ch[i]=(Math.random()*2-1)*(1-i/ch.length);
  const s=c.createBufferSource(), g=c.createGain(), f=c.createBiquadFilter(); f.type=tipo||'highpass'; f.frequency.value=hp||1800;
  s.buffer=b; g.gain.value=v||.2; s.connect(f).connect(g).connect(c.destination); s.start(t);
}
const sfx={
  sel(){ tone(660,.07,'triangle',.08); tone(880,.09,'triangle',.08,.06); },
  bip(){ tone(440,.22,'square',.09); },
  ya(){ tone(880,.5,'square',.1); tone(1320,.5,'triangle',.08); },
  turbo(){ noise(.5,.22,0,700,'bandpass'); tone(220,.45,'sawtooth',.07,0,880); },
  chispa(n){ tone(700+n*260,.1,'square',.06); tone(1000+n*260,.12,'square',.05,.07); },
  salto(){ tone(300,.25,'sine',.1,0,700); },
  caja(){ [784,988,1175,1568].forEach((f,i)=>tone(f,.09,'square',.05,i*.06)); },
  tengo(){ tone(1175,.1,'triangle',.1); tone(1568,.18,'triangle',.1,.09); },
  usar(o){ if(o==='chipa'||o==='chipa3'||o==='viento') this.turbo(); else if(o==='nanduti'){ tone(880,.3,'sine',.09,0,1760); } else { tone(500,.14,'triangle',.1,0,250); noise(.12,.15,0,1200); } },
  golpe(c){ if(c==='hielo'){ [2093,1568,1175,784].forEach((f,i)=>tone(f,.16,'triangle',.09,i*.05)); } else { noise(.3,.4,0,500,'lowpass'); tone(400,.5,'sawtooth',.09,0,90); } },
  acierto(){ tone(988,.1,'square',.07); tone(1319,.16,'square',.07,.09); },
  escudo(){ tone(1568,.2,'sine',.1,0,523); },
  trueno(){ noise(1.6,.5,0,180,'lowpass'); noise(.25,.3,0,2500); },
  vuelta(){ tone(784,.12,'triangle',.1); tone(1047,.18,'triangle',.1,.1); },
  ultima(){ [784,988,784,988,1175].forEach((f,i)=>tone(f,.13,'square',.07,i*.11)); },
  meta(){ [523,659,784,1047,1319,1568].forEach((f,i)=>tone(f,.3,'triangle',.12,i*.11)); },
  priv(){ tone(1200,.08,'sine',.08); tone(1500,.1,'sine',.08,.08); },
};
function toggleSound(){ SND.on=!SND.on; store('kg_snd', SND.on); $('#btnSnd').textContent=SND.on?'🔊':'🔇'; if(SND.on) sfx.sel(); else motorSet(0,0,0,0,true); }
$('#btnSnd').textContent=SND.on?'🔊':'🔇';
document.addEventListener('pointerdown', ()=>actx(), {once:true});
/* el motor del kart: dos osciladores y ruido para el derrape */
const MOTOR={g:null};
function motorOn(){
  const c=actx(); if(!c || MOTOR.g) return;
  const o1=c.createOscillator(), o2=c.createOscillator(), f=c.createBiquadFilter(), g=c.createGain(); o1.type='sawtooth'; o2.type='square'; o2.detune.value=-1200; f.type='lowpass'; f.frequency.value=700; g.gain.value=0;
  o1.connect(f); o2.connect(f); f.connect(g).connect(c.destination); o1.start(); o2.start();
  const b=c.createBuffer(1, c.sampleRate, c.sampleRate), ch=b.getChannelData(0); for(let i=0;i<ch.length;i++) ch[i]=Math.random()*2-1;
  const n=c.createBufferSource(); n.buffer=b; n.loop=true; const nf=c.createBiquadFilter(); nf.type='bandpass'; nf.frequency.value=2200; nf.Q.value=1.2; const ng=c.createGain(); ng.gain.value=0; n.connect(nf).connect(ng).connect(c.destination); n.start();
  Object.assign(MOTOR,{o1,o2,f,g,n,nf,ng});
}
function motorSet(v, drift, turbo, fuera, callar){
  if(!MOTOR.g) return; const c=SND.ctx, t=c.currentTime, a=Math.abs(v);
  const fr=52+a*3.3+(turbo?26:0);
  MOTOR.o1.frequency.setTargetAtTime(fr, t, .06); MOTOR.o2.frequency.setTargetAtTime(fr*1.005, t, .06); MOTOR.f.frequency.setTargetAtTime(500+a*30, t, .1);
  MOTOR.g.gain.setTargetAtTime(SND.on && !callar ? .028+Math.min(.03, a*.0012) : 0, t, .08);
  MOTOR.ng.gain.setTargetAtTime(SND.on && !callar ? (drift ? .05 : fuera && a>5 ? .03 : turbo ? .025 : 0) : 0, t, .06); MOTOR.nf.frequency.setTargetAtTime(drift?2600:fuera?700:1200, t, .1);
}
function motorOff(){ if(!MOTOR.g) return; for(const k of ['o1','o2','n']) try{ MOTOR[k].stop(); }catch(e){} try{ MOTOR.g.disconnect(); MOTOR.ng.disconnect(); }catch(e){} MOTOR.g=null; }

/* ---------- música: una polca paraguaya de arpa, tocada en el momento (sin archivos) ---------- */
const MUSIC_CREDIT = 'Música propia del juego: una polca de arpa que se toca en el momento.';
const MUSIC = { on: load('kg_music')!==false, gain:null, timer:null, t:0, bar:0, VOL:.06 };
const mf = m => 440*Math.pow(2,(m-69)/12);
const POLCA = [
  {ch:[55,59,62], b:43, m:[79,83,86,83,79,83]}, {ch:[55,59,62], b:43, m:[86,0,83,86,91,0]},
  {ch:[50,54,57,60], b:38, m:[90,86,84,81,84,86]}, {ch:[50,54,57,60], b:38, m:[84,0,81,78,0,74]},
  {ch:[48,52,55], b:36, m:[76,79,84,0,88,84]}, {ch:[55,59,62], b:43, m:[86,83,79,0,83,86]},
  {ch:[50,54,57,60], b:38, m:[84,81,78,81,84,81]}, {ch:[55,59,62], b:43, m:[79,0,83,79,0,0]},
];
function harp(f, t, v, d){
  const c=SND.ctx, o=c.createOscillator(), o2=c.createOscillator(), g=c.createGain(), lp=c.createBiquadFilter();
  o.type='triangle'; o.frequency.value=f; o2.type='sine'; o2.frequency.value=f*2; lp.type='lowpass'; lp.frequency.value=3200;
  g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(v,t+.006); g.gain.exponentialRampToValueAtTime(.0005,t+d);
  const g2=c.createGain(); g2.gain.value=.25; o.connect(g); o2.connect(g2).connect(g); g.connect(lp).connect(MUSIC.gain);
  o.start(t); o2.start(t); o.stop(t+d+.05); o2.stop(t+d+.05);
}
function musicSchedule(){
  const c=SND.ctx; if(!c || !MUSIC.gain) return;
  const E = S && S.phase==='race' && R && R.t>=0 ? .118 : .15;
  while(MUSIC.t < c.currentTime+.6){
    const bar=POLCA[MUSIC.bar%8], pass=Math.floor(MUSIC.bar/8)%2, t0=MUSIC.t;
    harp(mf(bar.b), t0, .5, 1); harp(mf(bar.b+7), t0+3*E, .34, .8); harp(mf(bar.b+12), t0+4*E, .2, .5);
    [[1,0],[2,1],[4,2],[5,1]].forEach(([s,k])=>harp(mf(bar.ch[k%bar.ch.length]+12), t0+s*E, .14, .45));
    bar.m.forEach((n,s)=>{ if(n) harp(mf(n+(pass?-12:0)), t0+s*E, pass?.22:.19, .6); });
    MUSIC.t+=6*E; MUSIC.bar++;
  }
}
function musicStart(){
  if(!MUSIC.on || MUSIC.timer) return;
  const c=actx(); if(!c) return;
  MUSIC.gain=c.createGain(); MUSIC.gain.connect(c.destination);
  MUSIC.gain.gain.setValueAtTime(0.0001, c.currentTime); MUSIC.gain.gain.exponentialRampToValueAtTime(MUSIC.VOL, c.currentTime+2);
  MUSIC.t=c.currentTime+.2; MUSIC.bar=0;
  MUSIC.timer=setInterval(musicSchedule, 200); musicSchedule();
}
function musicStop(){
  if(!MUSIC.timer) return;
  clearInterval(MUSIC.timer); MUSIC.timer=null;
  const c=SND.ctx, g=MUSIC.gain; MUSIC.gain=null;
  try{ g.gain.setValueAtTime(g.gain.value, c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime+.8); setTimeout(()=>{ try{ g.disconnect(); }catch(e){} }, 2500); }catch(e){}
}
function musicSync(){ if(MUSIC.on && S && NET.mode) musicStart(); else musicStop(); renderMusicBtn(); }
function toggleMusic(){ MUSIC.on=!MUSIC.on; store('kg_music', MUSIC.on); musicSync(); toast(MUSIC.on?'🎶 Música prendida (polca de arpa).':'🔕 Música apagada.'); }
function renderMusicBtn(){ $$('.btnMusic').forEach(b=>{ b.textContent = MUSIC.on ? '🎶' : '🔕'; b.title = MUSIC.on ? 'Apagar la música' : 'Prender la música'; }); }
renderMusicBtn(); $('#musicCredit').textContent='🎶 '+MUSIC_CREDIT;

/* ====================== RENDER ====================== */
const LAST={res:null};
const MEDAL=['🥇','🥈','🥉','4º','5º','6º','7º','8º'];
function render(){
  if(!S) return;
  V = NET.mode==='client' ? S : publicState();
  if(V.phase==='lobby'){ quitarCarrera(); show('lobby'); renderLobby(); }
  else {
    show('game');
    if(V.carrera && (!R || R.id!==V.carrera.id)){ quitarCarrera(); prepararCarrera(); }
    renderGame();
  }
  renderMesaTab(); renderChatTo(); renderVoice(); voiceSync(); musicSync(); camSync(); headsAfterRender();
}
function carita(p, tam){ return FACES[p.id] ? `<img class="fthumb" src="${FACES[p.id]}" alt="">` : `<span style="font-size:${tam||20}px">${esc(p.emoji)}</span>`; }
function playerTag(p){
  const host=p.id===V.hostPid;
  return `<span class="dot" style="background:${p.color}"></span>${headHTML(p) || carita(p)}<span class="nm">${esc(p.name)}${p.id===me()?' <span class="muted">(vos)</span>':''} <small class="muted">${esc(piloto(p.ch).n)}</small></span>`
    + `${host?'👑':''}${p.bot?'🤖':''}${p.mic?'🎙️':''}${!p.bot&&!p.conn?'⚠️':''}`;
}
// ---------- sala de espera ----------
function renderLobby(){
  const host=amHost(), myObs=!!NET.obs, n=V.players.length, yo=V.players.find(p=>p.id===me());
  $('#lobbyCode').textContent=NET.code||'—';
  $('#pcount').textContent=`(${n}/${MAXP})`;
  $('#plist').innerHTML=V.players.map(p=>`<li>${playerTag(p)}${host && p.id!==V.hostPid?`<button class="btn sm gray" onclick="doAct({type:'kick',pid:'${p.id}'})" title="Sacar">✕</button>`:''}</li>`).join('')
    + (V.observers||[]).map(o=>`<li style="opacity:.75"><span style="font-size:20px">${o.owner?'👑':'👀'}</span><span class="nm">${esc(o.name)} <span class="muted">mirando</span></span>${o.mic?'🎙️':''}</li>`).join('');
  $('#lobbyPiloto').innerHTML = yo ? `<label style="margin-top:0">Tu piloto</label><div class="tokens">${PILOTOS.map((p,i)=>`<button class="tok ${i===yo.ch?'sel':''}" onclick="miCh=${i};store('kg_ch',${i});doAct({type:'ch',ch:${i}})">${p.e}<small>${esc(p.n)}</small></button>`).join('')}</div><div class="pinfo">${pilotoHTML(yo.ch)}</div>
    <label>Color del kart</label><div class="colores">${COLORES.map(c=>`<button class="${c===yo.color?'sel':''}" style="background:${c}" onclick="doAct({type:'color',c:'${c}'})"></button>`).join('')}</div>` : '';
  const karts=Math.max(n, V.opts.karts);
  $('#lobbyHostBtns').innerHTML = host
    ? `<button class="btn green wide big" onclick="doAct({type:'start'})">🏁 ¡A correr!</button><p class="muted">Hasta 8 karts. ${karts>n?`Los ${karts-n} lugares libres los completan bots 🤖.`:'Sin bots.'} Si alguien se corta en la carrera, un bot maneja su kart hasta que vuelva.</p>`
    : `<p class="muted" style="text-align:center">⏳ Esperando que el anfitrión 👑 largue la carrera…</p>`;
  $('#lobbyObs').innerHTML = myObs ? `<div class="obsbar" style="border-radius:10px;margin-top:8px">👀 Estás mirando. ${n<MAXP?`<button class="btn sm gold" onclick="doAct({type:'joinNext',ch:${miCh}})">🪑 Sumarme a la parrilla</button>`:'La parrilla está llena.'}</div>` : '';
  $('#optsBox').innerHTML = optsHTML(host);
}
function optsHTML(host){
  const o=V.opts, dis = host ? '' : 'disabled';
  const sel=(k, list)=>`<select ${dis} onchange="doAct({type:'opt',k:'${k}',v:this.value})">${list.map(([v,t])=>`<option value="${v}" ${String(o[k])===String(v)?'selected':''}>${t}</option>`).join('')}</select>`;
  const pista = o.modo==='copa'
    ? `<label>Copa</label>${sel('copa', COPAS.map(c=>[c.id, c.e+' '+c.n+': '+c.pistas.map(i=>PISTAS[i].ciudad).join(', ')]))}`
    : `<label>Pista</label>${sel('pista', [['azar','🎲 Al azar']].concat(ORDEN_PISTAS.map(i=>[i, PISTAS[i].e+' '+PISTAS[i].n])))}<label>Vueltas</label>${sel('vueltas', [[2,'2'],[3,'3'],[4,'4'],[5,'5']])}`;
  const pd = o.modo==='libre' && PISTAS[o.pista] ? `<p class="muted">${esc(PISTAS[o.pista].d)}</p>` : '';
  return `<label style="margin-top:0">Qué se corre ${host?'':'<span class="muted">(lo elige el anfitrión)</span>'}</label>${sel('modo', [['libre','🏁 Carrera suelta'],['copa','🏆 Copa de 4 carreras con puntos']])}${pista}${pd}
    <div class="row2"><div><label>Karts en la parrilla</label>${sel('karts', [1,2,3,4,5,6,7,8].map(k=>[k, k+(k>V.players.length?' (con bots)':'')]))}</div><div><label>Bots</label>${sel('nivel', NIVELES.map(n=>[n.id,n.n]))}</div>
    <div><label>Velocidad</label>${sel('ritmo', RITMOS.map(n=>[n.id,n.n]))}</div><div><label>Objetos</label>${sel('objetos', [[1,'Con objetos'],[0,'Sin objetos']]).replace(`value="${o.objetos?1:0}"`, `value="${o.objetos?1:0}" selected`).replace('this.value})','this.value==1})')}</div></div>`;
}
// ---------- carrera ----------
function renderGame(){
  $('#roomTag').textContent = NET.mode==='local' ? (S.crono?'⏱️ Contrarreloj':'🤖 Contra bots') : '🔑 '+NET.code;
  $('#obsbar').innerHTML = `👀 Estás mirando la carrera. <button class="btn sm dark" onclick="camSiguiente()">🎥 Cambiar de kart</button>${V.phase==='results'?` <button class="btn sm gold" onclick="doAct({type:'joinNext',ch:${miCh}})">🪑 Sumarme a la próxima</button>`:''}`;
  ponerEtiquetas();
  if(V.phase==='results') resultados(); else if($('#resBox')) closeModal();
}
function bigText(t, sub){ const d=document.createElement('div'); d.className='big-msg'; d.innerHTML=esc(t)+(sub?`<small>${esc(sub)}</small>`:''); document.body.appendChild(d); setTimeout(()=>d.remove(),1700); }
function resultados(force){
  const key=V.carrera.id; if(!force && LAST.res===key){ if($('#resBox')) $('#mbox').innerHTML=resHTML(); return; }
  LAST.res=key;
  // contrarreloj: guardar el mejor tiempo y el fantasma
  if(S.crono && V.res && V.res[0] && !V.res[0].est){ const r=V.res[0], T0=TIEMPOS(), id=V.carrera.pista, ant=T0[id]; LAST.record=!ant || r.t<ant.t; LAST.antes=ant?ant.t:null;
    if(LAST.record){ T0[id]={t:r.t, v:r.mejor}; store('kg_tiempos', T0); store('kg_fant_'+id, HUD.fant.slice(0, 3000)); } else if(r.mejor && (!ant.v || r.mejor<ant.v)){ ant.v=r.mejor; store('kg_tiempos', T0); } }
  setTimeout(()=>{ if(V && V.phase==='results' && V.carrera.id===key) modal(resHTML()); }, force?0:1200);
}
function resHTML(){
  const host=amHost(), copa=V.opts.modo==='copa', c=COPAS.find(x=>x.id===V.opts.copa)||COPAS[0], yo=me();
  const fila=(r,i)=>{ const p=VP(r.pid)||{name:'?', ch:0, color:'#888', emoji:'❔'}; return `<div class="prow ${r.pid===yo?'yo':''}" style="border-left:6px solid ${p.color}"><span class="md">${MEDAL[i]}</span>${carita(p,22)}<span class="nm"><b>${esc(p.name)}${r.pid===yo?' (vos)':''}${p.bot?' 🤖':''}</b><small>${esc(piloto(p.ch).n)} · ${r.est?'no llegó':'⏱️ '+fmtT(r.t)}${r.mejor?' · mejor vuelta '+fmtT(r.mejor):''}</small></span>${S.crono?'':`<span class="pts">+${r.pts}</span>`}</div>`; };
  let h=`<div id="resBox"><h2>${PISTAS[V.carrera.pista].e} ${esc(PISTAS[V.carrera.pista].n)}</h2>`;
  if(S.crono){ const r=V.res[0]; h+=`<p style="font-size:18px;text-align:center">⏱️ <b>${fmtT(r.t)}</b>${r.mejor?`<br><span class="muted">Mejor vuelta: ${fmtT(r.mejor)}</span>`:''}</p><p style="text-align:center;font-weight:800">${LAST.record?'🏆 ¡Nuevo récord tuyo!'+(LAST.antes?` (antes ${fmtT(LAST.antes)})`:''):`Tu récord sigue siendo ${fmtT(LAST.antes)}`}</p>`; }
  else h+=`<div class="podio">${(V.res||[]).map(fila).join('')}</div>`;
  if(copa){ const tabla=V.players.slice().sort((a,b)=>b.pts-a.pts);
    h+=`<h3>${c.e} ${esc(c.n)} · ${V.final?'tabla final':`carrera ${V.iCopa+1} de ${c.pistas.length}`}</h3><div class="podio">${tabla.map((p,i)=>`<div class="prow ${p.id===yo?'yo':''}"><span class="md">${V.final?MEDAL[i]:(i+1)+'º'}</span>${carita(p,20)}<span class="nm"><b>${esc(p.name)}${p.bot?' 🤖':''}</b></span><span class="pts">${p.pts} pts</span></div>`).join('')}</div>`;
    if(V.final) h+=`<p style="text-align:center;font-size:18px">🏆 <b>${esc(tabla[0].name)}</b> se lleva la ${esc(c.n)}.</p>`; }
  if(host){
    if(S.crono) h+=`<button class="btn green wide" onclick="closeModal();doAct({type:'next'})">🔁 Otra vez</button>`;
    else if(copa) h+=`<button class="btn green wide" onclick="closeModal();doAct({type:'next'})">${V.final?'🏆 Correr la copa siguiente':'▶️ Siguiente carrera: '+esc(PISTAS[c.pistas[V.iCopa+1]].n)}</button>`;
    else h+=`<div class="row"><button class="btn green" onclick="closeModal();doAct({type:'next'})">🔁 Otra vez acá</button><button class="btn" onclick="closeModal();doAct({type:'next',sig:1})">▶️ Pista siguiente</button></div>`;
    h+=`<button class="btn gray wide" style="margin-top:6px" onclick="closeModal();${NET.mode==='local'?'leaveToMenu()':`doAct({type:'lobby'})`}">${NET.mode==='local'?'🏠 Volver al menú':'↩️ Volver a la sala'}</button>`;
  } else h+=`<p class="muted" style="text-align:center">⏳ Esperando que el anfitrión 👑 largue la próxima…</p>${NET.obs?`<button class="btn gold wide" onclick="doAct({type:'joinNext',ch:${miCh}})">🪑 Sumarme a la próxima carrera</button>`:''}`;
  return h+`<button class="btn dark wide" style="margin-top:6px" onclick="closeModal()">Ver la pista</button></div>`;
}
// ---------- ventanas ----------
function modal(h){ $('#mbox').innerHTML=h; $('#modal').classList.add('on'); }
function closeModal(){ $('#modal').classList.remove('on'); $('#mbox').innerHTML=''; }
$('#modal').addEventListener('click', e=>{ if(e.target.id==='modal') closeModal(); });
// ---------- panel: parrilla ----------
function renderMesaTab(){
  if(!V) return;
  const host=amHost(), carr=V.phase!=='lobby';
  const lista = carr && V.opts.modo==='copa' ? V.players.slice().sort((a,b)=>b.pts-a.pts) : V.players;
  const ps=lista.map(p=>{
    const offline=!p.bot&&!p.conn;
    return `<div class="prow" style="border-left:5px solid ${p.color}">${carita(p,22)}<span class="nm"><b>${esc(p.name)}${p.id===me()?' (vos)':''}${p.id===V.hostPid&&NET.mode!=='local'?' 👑':''}</b>
      <small>${esc(piloto(p.ch).n)} · ${esc(piloto(p.ch).veh)}${carr&&V.opts.modo==='copa'?` · ${p.pts} pts`:''}${p.bot?' · 🤖 bot':''}${p.mic?' · 🎙️':''}${offline?' · ⚠️ sin conexión':''}</small></span>
      ${host&&p.id!==V.hostPid&&NET.mode!=='local'&&!p.bot?`<button class="btn sm gray" onclick="if(confirm('¿Sacar a ${esc(p.name)} de la sala?'))doAct({type:'kick',pid:'${p.id}'})" title="Sacar">✕</button>`:''}</div>`;
  }).join('');
  const obs=(V.observers||[]).map(o=>`<div class="prow"><span style="font-size:20px">${o.owner?'👑':'👀'}</span><span class="nm"><b>${esc(o.name)}${o.id===me()?' (vos)':''}</b><small>mirando${o.mic?' · 🎙️':''}</small></span></div>`).join('');
  const info = carr && V.carrera ? `<p class="muted">${PISTAS[V.carrera.pista].e} ${esc(PISTAS[V.carrera.pista].n)} · ${V.carrera.vueltas} vueltas · bots ${(NIVELES.find(n=>n.id===V.carrera.nivel)||{}).n} · ${(RITMOS.find(n=>n.id===V.carrera.ritmo)||{}).n}</p>` : '';
  const fin = host && carr && NET.mode!=='local' ? `<button class="btn gray wide" onclick="if(confirm('¿Cortar la carrera y volver a la sala de espera?'))doAct({type:'lobby'})">↩️ Volver todos a la sala</button>` : '';
  $('#mesaList').innerHTML = info + `<b>Parrilla (${V.players.length}/${MAXP})</b>` + ps + (obs?`<b>Mirando</b>${obs}`:'') + fin
    + (NET.mode!=='local'&&NET.code?`<p class="muted" style="margin-top:12px">Invitá con el código <b>${NET.code}</b> <button class="btn sm" onclick="shareRoom()">📤 Compartir</button></p>`:'')
    + `<button class="btn sm dark" style="margin-top:8px" onclick="faceModal()">📷 Mi cara (foto o cámara)</button> <button class="btn sm dark" onclick="ajustesModal()">⚙️ Ajustes</button> <button class="btn sm dark" onclick="showRules()">📜 Cómo se juega</button>`;
}
// ---------- compartir ----------
function roomLink(){ return location.origin+location.pathname+'#'+NET.code; }
function copyCode(){ navigator.clipboard && navigator.clipboard.writeText(NET.code).then(()=>toast('Código copiado: '+NET.code)); }
function shareRoom(){
  const url=roomLink(), text=`¡Vení a correr conmigo en Carrera Guasu! 🏁🇵🇾 Sala ${NET.code}`;
  if(navigator.share) return navigator.share({title:'Carrera Guasu', text, url}).catch(()=>{});
  modal(`<h2>📤 Invitar a la sala ${NET.code}</h2><p style="word-break:break-all;user-select:all;background:#fff;padding:8px;border-radius:8px">${esc(url)}</p>
    <a class="btn green wide" style="display:block;text-align:center;text-decoration:none" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text+' '+url)}">💬 Mandar por WhatsApp</a>
    <button class="btn wide" style="margin-top:6px" onclick="navigator.clipboard.writeText('${url}').then(()=>toast('Enlace copiado'))">📋 Copiar enlace</button>
    <button class="btn gray wide" style="margin-top:6px" onclick="closeModal()">Cerrar</button>`);
}

/* ====================== CÓMO SE JUEGA ====================== */
function showRules(){
  modal(`<div class="rules"><h2>📜 Cómo se juega a Carrera Guasu</h2>
  <p>Carreras de karts por <b>12 ciudades del Paraguay</b>, con animales de acá al volante. Gana el que cruza primero la meta después de dar todas las vueltas. Hasta <b>8 karts</b>: los lugares libres los completan bots.</p>
  <h3>🎮 Manejar</h3>
  <ul><li><b>Celular:</b> ◀ ▶ para doblar (o inclinando el celular, en ⚙️ Ajustes), <b>↯</b> para saltar y derrapar, <b>🎁</b> para usar el objeto y <b>freno</b>. El kart puede acelerar solo.</li>
  <li><b>PC:</b> flechas o WASD, <b>Espacio</b> derrapa, <b>X</b> o <b>Enter</b> usa el objeto, <b>R</b> te vuelve a la pista. También anda con mando.</li></ul>
  <h3>💨 Trucos para ir más rápido</h3>
  <ul><li><b>Largada turbo:</b> empezá a acelerar justo cuando la cuenta pasa del 2 al 1 (no antes).</li>
  <li><b>Derrape y mini turbo:</b> doblando, mantené apretado ↯: el kart salta y derrapa. Mientras más aguantes, las chispas pasan de <b style="color:#3ba0e0">celestes</b> a <b style="color:#ff8a1e">naranjas</b> y a <b style="color:#b04fd8">violetas</b>. Al soltar sale el turbo.</li>
  <li><b>Rebufo:</b> andá pegado atrás de otro kart un ratito y tomás más velocidad.</li>
  <li><b>Saltos:</b> en las rampas amarillas, apretá ↯ justo en el aire para hacer una pirueta y caer con turbo.</li>
  <li><b>Flechas naranjas</b> en el piso dan turbo. Los <b>atajos</b> son caminitos de tierra (en el mapa, la línea de puntos).</li>
  <li>Por el pasto vas a la mitad, salvo que tengas turbo.</li></ul>
  <h3>🎁 Objetos (se agarran en las cajas con “?”)</h3>
  ${Object.values(OBJETOS).map(o=>`<p style="margin:3px 0">${o.e} <b>${o.n}:</b> ${o.d}</p>`).join('')}
  <p>A los que van atrás les tocan los objetos más fuertes.</p>
  <h3>🏆 Modos</h3>
  <p><b>Gran Premio:</b> copas de 4 carreras con puntos (${PUNTOS.join(', ')}). <b>Carrera libre:</b> elegís pista, vueltas y bots. <b>Contrarreloj:</b> solo contra el reloj y tu fantasma. <b>En línea:</b> creá una sala y pasá el código; los que llegan con la carrera empezada miran 👀 y se suman a la próxima.</p>
  <h3>🗺️ Copas y pistas</h3>
  ${COPAS.map(c=>`<p style="margin:3px 0">${c.e} <b>${c.n}:</b> ${c.pistas.map(i=>PISTAS[i].n).join(' · ')}</p>`).join('')}
  <h3>💬 Chat y voz</h3>
  <p>Escribí <b>@nombre</b> (o elegí a alguien en “Para”) para mandarle un <b>mensaje privado</b>. Con 🎤 hablan por voz y con 📷 ponés tu cara arriba de tu kart.</p>
  <p class="muted">🎶 ${MUSIC_CREDIT}</p>
  <button class="btn wide" onclick="closeModal()">Entendido</button></div>`);
}

renderPilotos(); ligarToques(); ctrlArrastre(); renderTouch(); renderVoice();
setTimeout(vitrina, 50);
if('serviceWorker' in navigator && location.protocol==='https:') navigator.serviceWorker.register('sw.js').catch(()=>{});
