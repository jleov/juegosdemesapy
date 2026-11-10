'use strict';
/* =====================================================================
   Ludo PY — red (PeerJS), chat con privados, voz, tablero 2D/3D,
   el dado, las fichas, animaciones, sonidos y música.
   ===================================================================== */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function store(k,v){ try{ if(v===undefined) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
function load(k){ try{ const v=localStorage.getItem(k); return v==null?null:JSON.parse(v); }catch(e){ return null; } }
function toast(x){ const t=$('#toast'); t.textContent=x; t.style.display='block'; clearTimeout(toast.t); toast.t=setTimeout(()=>t.style.display='none', 3800); }
const PREFIX='ludopy26-';
const genCode = () => { const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s=''; for(let i=0;i<5;i++) s+=A[rnd(A.length)]; return s; };
let myToken=load('ludo_token'); if(!myToken){ myToken=Math.random().toString(36).slice(2)+Date.now().toString(36); store('ludo_token', myToken); }
const NET={mode:null, peer:null, code:null, conns:{}, hostConn:null, myPid:null, obs:null, welcomed:false};
let CHAT=[], V=null;
const me = () => NET.myPid || NET.obs;
const VP = id => V && (V.players.find(p=>p.id===id) || (V.observers||[]).find(o=>o.id===id));
const amHost = () => NET.mode==='local' || (V && V.hostPid===NET.myPid && NET.mode==='host');

/* ====================== MENÚ ====================== */
let myEmojiSel = load('ludo_emoji') || EMOJIS[0];
const myName = () => ($('#myName').value.trim() || 'Jugador').slice(0,16);
const myEmoji = () => myEmojiSel;
$('#myName').value = load('ludo_name') || load('uno_name') || '';
$('#myName').addEventListener('input', ()=>store('ludo_name', $('#myName').value.trim()));
function renderTokenPicker(){
  $('#tokens').innerHTML = EMOJIS.map(e=>`<button class="tok ${e===myEmojiSel?'sel':''}" onclick="pickEmoji('${e}')">${e}</button>`).join('');
}
function pickEmoji(e){ myEmojiSel=e; store('ludo_emoji', e); renderTokenPicker(); }
renderTokenPicker();
$('#logoBoard').innerHTML = boardSVG(4, 0, null);
function needName(){ if(!$('#myName').value.trim()){ toast('Escribí tu nombre primero ✍️'); $('#myName').focus(); return true; } store('ludo_name', myName()); return false; }
function joinClick(){
  const code=$('#joinCode').value.trim().toUpperCase(); if(!code) return toast('Escribí el código de la sala.');
  if(needName()) return; clientJoin(code);
}
function resumeClick(){
  const h=load('ludo_host'), c=load('ludo_client');
  if(h && (!c || h.at>=c.at)) return hostStart(true);
  if(c){ if(needName()) return; clientJoin(c.code); }
}
function refreshResume(){
  const h=load('ludo_host'), c=load('ludo_client'), ok=x=>x && Date.now()-x.at<6*3600e3;
  $('#btnResume').style.display = ok(h)||ok(c) ? 'block' : 'none';
}
refreshResume();
(function(){   // enlace con #CÓDIGO o ?sala=CÓDIGO
  const m=(location.hash.slice(1) || new URLSearchParams(location.search).get('sala') || '').toUpperCase();
  if(/^[A-Z0-9]{4,6}$/.test(m)){ $('#joinCode').value=m;
    // el dueño viene desde su panel: entra directo a mirar
    if(new URLSearchParams(location.search).get('dueno')){ if(!$('#myName').value.trim()) $('#myName').value='Dueño'; setTimeout(()=>clientJoin(m), 300); }
    else toast('Te invitaron a la sala '+m+': escribí tu nombre y tocá “Entrar”.'); }
})();

/* ====================== PANTALLAS ====================== */
function show(id){
  $$('.screen').forEach(s=>s.classList.toggle('on', s.id===id));
  const side=$('#side'), dest = id==='lobby' ? $('#lobbySide') : id==='game' ? $('#gameSide') : null;
  if(dest && side.parentElement!==dest) dest.appendChild(side);
  if(id==='menu') refreshResume();
}
function localStart(){
  if(needName()) return;
  NET.mode='local'; NET.code=null; CHAT=[];
  S=lobbyState(); S.opts=Object.assign(defaultOpts(), load('ludo_localopts')||{});
  const p=addPlayer(myName(), myEmoji(), myToken, null); NET.myPid=p.id; S.hostPid=p.id;
  const v=$('#nBots').value, n=parseInt(v); for(let i=0;i<n;i++) addBot();
  S.opts.mode = v.endsWith('e') ? 'equipos' : 'solo';
  if(S.opts.mode==='equipos'){ const b=S.players[2]; S.players.splice(2,1); S.players.splice(1,0,b); }   // tu compañero bot se sienta enfrente
  startGame(); sysChat('🎲 Partida de práctica contra bots. Las reglas de la casa se cambian en la pestaña 🏠 Reglas (para la próxima partida).');
  LAST.ev=null; FACES={}; commit(); shareMyFace();
}
function leaveClick(){
  if(NET.mode==='local'){ if(S && S.phase==='play' && !confirm('¿Salir de la partida contra los bots?')) return; return leaveToMenu(); }
  if(!confirm('¿Salir de la sala?')) return;
  if(NET.mode==='host'){
    const others=hostCandidates(S);
    if(others.length) return hostHandover();
    store('ludo_host', undefined);
  } else if(NET.mode==='client'){
    if(NET.hostConn && NET.hostConn.open && NET.myPid) try{ NET.hostConn.send({t:'act', a:{type:'leave'}}); }catch(e){}
    store('ludo_client', undefined);
  }
  setTimeout(leaveToMenu, 250);
}
function leaveToMenu(){
  camsReset();
  musicStop();
  stopMic(false);
  try{ if(NET.peer) NET.peer.destroy(); }catch(e){}
  Object.assign(NET,{mode:null, peer:null, code:null, conns:{}, hostConn:null, myPid:null, obs:null, welcomed:false, backup:null});
  S=null; V=null; CHAT=[]; LAST.ev=null; resetPieces(); closeModal(); netBar(false);
  history.replaceState(null,'',location.pathname);
  show('menu');
}

/* ====================== RED ====================== */
function publicState(forPid){
  const s=JSON.parse(JSON.stringify(S));
  s.players.forEach(p=>{ delete p.token; });
  (s.observers||[]).forEach(o=>delete o.token);
  delete s.ownerTok;
  return s;
}
function commit(){
  if(NET.mode==='host'){
    for(const pid in NET.conns){ const c=NET.conns[pid]; if(c && c.open) try{ c.send({t:'state', s:publicState(pid)}); }catch(e){} }
    sendBackups();
    if(!NET.noSave) store('ludo_host', {code:NET.code, S, CHAT:CHAT.slice(-80), myPid:NET.myPid, at:Date.now()});
  }
  render();
}
function doAct(a){
  if(NET.mode==='client'){ if(NET.hostConn && NET.hostConn.open) NET.hostConn.send({t:'act', a}); else toast('Sin conexión con el anfitrión.'); return; }
  const r=act(me(), a); if(typeof r==='string') toast(r);
}
function newPeer(id){
  return new Peer(id, {debug:1, config:{iceServers: window.ICE_SERVERS || [{urls:"stun:stun.l.google.com:19302"}]}});
}
function netBar(on,txt){ const b=$('#netbar'); b.style.display=on?'block':'none'; if(txt) b.textContent=txt; }

// ---------- anfitrión ----------
function hostStart(resume){
  if(!resume && needName()) return;
  const saved = resume ? load('ludo_host') : null;
  NET.mode='host'; NET.code = saved ? saved.code : genCode(); NET.conns={}; NET.noSave=false;
  const peer = NET.peer = newPeer(PREFIX+NET.code);
  peer.on('open', id=>{
    if(saved){
      S=saved.S; CHAT=saved.CHAT||[]; NET.myPid=saved.myPid;
      S.players.forEach(p=>{ if(!p.bot){ p.conn = p.id===NET.myPid; p.mic=false; p.cam=false; if(!p.conn) p.offAt=Date.now(); } });
      S.observers=[]; P(NET.myPid).peerId=id;
    } else {
      S=lobbyState(); CHAT=[];
      const p=addPlayer(myName(), myEmoji(), myToken, id); NET.myPid=p.id; S.hostPid=p.id;
      sysChat('Sala '+NET.code+' creada. Pasales el código o el enlace a tus amigos.');
    }
    history.replaceState(null,'','#'+NET.code);
    LAST.ev=null; if(!saved) FACES={}; commit(); renderChat(); shareMyFace();
  });
  wireHostPeer(peer, ()=>{
    if(resume){ toast('La sala sigue abierta en otro aparato (otro jugador quedó de anfitrión). Entrá con el código.'); peer.destroy(); store('ludo_host',undefined); NET.mode=null; $('#joinCode').value=NET.code; return; }
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
  store('ludo_host', undefined);
  toast('👑 Mientras no estabas, otro jugador quedó de anfitrión. Volvés a la sala como jugador.');
  const code=NET.code; NET.mode=null; clientJoin(code);
}
function hostOnData(conn, d){
  if(!d || typeof d!=='object' || !S) return;
  if(d.t==='ping'){ try{ conn.send({t:'pong'}); }catch(e){} return; }
  if(d.t==='pong') return;
  if(d.t==='hello'){
    if(d.token===myToken) d.token+='-'+conn.peer;   // mismo navegador que el anfitrión (otra pestaña)
    S.observers=S.observers||[];
    let p=S.players.find(x=>x.token && x.token===d.token), ob=null, why='';
    if(!p) ob=S.observers.find(x=>x.token===d.token)||null;
    const nm=(String(d.name||'').trim()||'Jugador').slice(0,16);
    if(!p && !ob){
      if((S.ownerTok||[]).includes(d.token)){   // el dueño del juego entra a mirar, a la vista de todos
        why='👑 Entraste como dueño del juego: todos ven que estás mirando y podés chatear y hablar.';
        ob={id:'o'+(++S.seq), name:nm, emoji:'👑', token:d.token, peerId:conn.peer, conn:true, owner:true};
        S.observers.push(ob); sysChat(`👑 ${ob.name} (dueño del juego) entró a mirar.`);
      } else if(S.phase==='lobby' && S.players.length<MAXP){
        let name=nm; for(let k=2; S.players.some(x=>x.name.toLowerCase()===name.toLowerCase()); k++) name=nm.slice(0,13)+' '+k;
        let emo=EMOJIS.includes(d.emoji)?d.emoji:EMOJIS[0]; if(S.players.some(x=>x.emoji===emo)) emo=EMOJIS.find(e=>!S.players.some(x=>x.emoji===e))||emo;
        p=addPlayer(name, emo, d.token, conn.peer);
        sysChat(`${p.emoji} ${p.name} entró a la sala.`);
      } else {
        why = S.phase==='lobby' ? 'La mesa está llena (6 jugadores): entraste a mirar 👀.' : 'La partida ya empezó: entraste a mirar 👀. Si hay un bot, podés tomar su lugar desde la pestaña 👥 Mesa.';
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
  if(d.t==='act'){ const r=act(pid, d.a||{}); if(typeof r==='string') try{ conn.send({t:'err', m:r}); }catch(e){} }
  else if(d.t==='chat') addChat(pid, d.text, d.to);
  else if(d.t==='face') hostSetFace(pid, d.img);
}
// un observador se sentó a la mesa: su conexión pasa a ser la del jugador
function onSeatChange(oldId, newId){
  if(NET.mode!=='host') return;
  const c=NET.conns[oldId]; if(!c) return;
  delete NET.conns[oldId]; NET.conns[newId]=c; c.pid=newId;
  if(FACES[oldId]){ FACES[newId]=FACES[oldId]; delete FACES[oldId]; }
  try{ c.send({t:'welcome', pid:newId, code:NET.code, why:'🪑 ¡Te sentaste a la mesa!', force:true}); }catch(e){}
}
function hostOnClose(conn){
  const pid=conn.pid; if(!pid || NET.conns[pid]!==conn || !S) return;
  delete NET.conns[pid];
  const ob=OB(pid);
  if(ob){ S.observers=S.observers.filter(x=>x!==ob); sysChat(`👀 ${ob.name} dejó de mirar.`); commit(); return; }
  const p=P(pid); if(!p) return;
  if(S.phase==='lobby'){ S.players=S.players.filter(x=>x!==p); sysChat(`${p.name} salió de la sala.`); }
  else if(!p.bot){ p.conn=false; p.mic=false; p.cam=false; p.offAt=Date.now(); sysChat(`⚠️ ${p.name} se desconectó. Si no vuelve, un bot juega por él en su turno.`); }
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

/* ---- traspaso de anfitrión: si el anfitrión se va o se corta, el siguiente sigue la partida con el mismo código ---- */
const numId = id => +String(id).slice(1);
function hostCandidates(s){ return (s.players||[]).filter(p=>!p.bot && p.id!==s.hostPid && p.conn).sort((a,b)=>numId(a.id)-numId(b.id)); }
function sendBackups(){
  if(NET.mode!=='host' || !S) return;
  const msg={t:'backup', s:S, chat:CHAT.slice(-80)};
  hostCandidates(S).slice(0,2).forEach(p=>{ const c=NET.conns[p.id]; if(c && c.open) try{ c.send(msg); }catch(e){} });
}
function hostHandover(){
  const next=hostCandidates(S)[0]; if(!next) return leaveToMenu();
  const mine=P(NET.myPid);
  if(mine){ if(S.phase==='lobby') S.players=S.players.filter(p=>p!==mine); else { mine.bot=true; mine.conn=false; mine.token=null; log(`🚪 ${mine.name} se fue: un bot sigue con sus fichas.`); } }
  const c=NET.conns[next.id];
  try{ c.send({t:'migrate', s:S, chat:CHAT.slice(-80)}); }catch(e){}
  NET.noSave=true; store('ludo_host', undefined);
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
  netBar(true,'👑 Tomando el mando de la sala…');
  let tries=0;
  const claim=()=>{
    if(NET.mode!=='host') return;
    const peer=NET.peer=newPeer(PREFIX+NET.code);
    peer.on('open', id=>{
      netBar(false); mine.peerId=id; mine.conn=true; delete mine.offAt;
      sysChat(`👑 ${mine.name} ahora es el anfitrión${old?` (${old.name} ${reason==='handover'?'salió':'se desconectó'})`:''}. La partida sigue.`);
      toast('👑 Ahora sos el anfitrión: la partida sigue desde tu aparato. No cierres el juego.');
      commit();
    });
    wireHostPeer(peer, ()=>{
      peer.destroy();
      // el anfitrión que se va todavía tiene el código unos segundos: se reintenta
      if(++tries<8) return setTimeout(claim, 1500);
      NET.mode=null; clientJoin(NET.code); NET.welcomed=true; NET.backup=pristine; S=JSON.parse(JSON.stringify(pristine.s));
      netBar(true,'Reconectando con el anfitrión…');
    });
  };
  claim();
}

// ---------- cliente ----------
function clientJoin(code){
  NET.mode='client'; NET.code=code; NET.welcomed=false; NET.hostLost=false; NET.lastHostMsg=Date.now(); CHAT=[]; LAST.ev=null;
  const peer = NET.peer = newPeer();
  peer.on('open', ()=>connectHost());
  peer.on('call', onCall);
  peer.on('disconnected', ()=>{ if(!peer.destroyed) setTimeout(()=>{ try{ peer.reconnect(); }catch(e){} },1500); });
  peer.on('error', e=>{
    if(e.type==='peer-unavailable'){
      if(!NET.welcomed){ toast('No se encontró la sala '+code+'. Revisá el código.'); store('ludo_client',undefined); leaveToMenu(); }
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
  c.on('open', ()=>{ netBar(false); clearTimeout(NET.takeoverTimer); NET.takeoverTimer=null; c.send({t:'hello', name:myName(), emoji:myEmoji(), token:myToken}); });
  c.on('data', d=>{ if(NET.hostConn!==c) return; NET.lastHostMsg=Date.now(); if(NET.hostLost){ NET.hostLost=false; netBar(false); } clientOnData(d); });
  c.on('close', ()=>{ if(NET.mode!=='client' || NET.hostConn!==c) return; netBar(true,'Se perdió la conexión con el anfitrión. Reconectando…'); setTimeout(connectHost,3000); scheduleTakeover(); });
}
function clientOnData(d){
  if(!d) return;
  if(d.t==='ping'){ try{ NET.hostConn.send({t:'pong'}); }catch(e){} return; }
  if(d.t==='pong') return;
  if(d.t==='welcome'){
    NET.myPid=d.pid; NET.obs=d.obs||null; NET.welcomed=true;
    store('ludo_client',{code:NET.code, at:Date.now()}); if(location.hash!=='#'+NET.code) history.replaceState(null,'','#'+NET.code);
    if(d.why) toast(d.why);
    setTimeout(shareMyFace, 300);   // mi foto, si tengo
  }
  else if(d.t==='state'){ S=d.s; render(); }
  else if(d.t==='chat'){ CHAT.push(d.m); renderChat(d.m); }
  else if(d.t==='chatlog'){ CHAT=d.list||[]; renderChat(); }
  else if(d.t==='faces' || d.t==='face') clientFace(d);
  else if(d.t==='backup'){ NET.backup={s:d.s, chat:d.chat}; }
  else if(d.t==='migrate'){ NET.backup={s:d.s, chat:d.chat}; takeoverHost('handover'); }
  else if(d.t==='kicked'){ toast('🚪 El anfitrión te sacó de la mesa.'); store('ludo_client',undefined); leaveToMenu(); }
  else if(d.t==='err') toast(d.m);
}

/* ====================== CHAT (general y privado) ====================== */
let chatSeq=0;
const people = () => S ? [...S.players, ...(S.observers||[])] : [];
const chatFor = pid => CHAT.filter(m=>!m.to || m.to===pid || m.from===pid).slice(-80);
function addChat(pid, text, to){
  text=String(text||'').trim().slice(0,300); if(!text || !S) return;
  const w=P(pid)||OB(pid); if(!w) return;
  let t = to ? (P(to)||OB(to)) : null;
  if(!t && text[0]==='@'){   // @Nombre al principio = mensaje privado
    const low=text.toLowerCase();
    t=people().filter(x=>x.id!==pid && low.startsWith('@'+x.name.toLowerCase())).sort((a,b)=>b.name.length-a.name.length)[0]||null;
  }
  if(t && t.id===pid) t=null;
  const m={id:Date.now()+'-'+(++chatSeq), from:pid, n:w.name+(w.owner?' (dueño del juego)':pid[0]==='o'?' (mirando)':''), e:w.emoji, c:w.color||'#666', x:text, to:t?t.id:null, toN:t?t.name:null};
  pushChat(m);
  if(t && t.bot && NET.mode!=='client') botPrivate(t, w, text);
}
function sysChat(x){ pushChat({id:Date.now()+'-'+(++chatSeq), sys:true, x}); }
function botChat(b, x){ addChat(b.id, x); }
function pushChat(m){
  CHAT.push(m); if(CHAT.length>250) CHAT.shift();
  if(NET.mode==='host') for(const pid in NET.conns){
    if(m.to && pid!==m.to && pid!==m.from) continue;   // los privados solo les llegan a los dos
    const c=NET.conns[pid]; if(c&&c.open) try{ c.send({t:'chat', m}); }catch(e){}
  }
  renderChat(m);
}
const BUB={};   // globito sobre el asiento con lo último que dijo cada uno
function chatLine(m){
  if(m.sys) return `<div class="msg sys">${esc(m.x)}</div>`;
  const mine=m.from===me();
  let x=esc(m.x).replace(/(^|\s)@([^\s]+)/g,'$1<span class="at">@$2</span>');
  if(m.to){
    const hdr = mine ? `🔒 Privado para ${esc(m.toN)}` : `🔒 Privado de ${esc(m.n)} para vos`;
    return `<div class="msg priv"><small>${hdr}</small><span class="who">${esc(m.e)} ${esc(m.n)}:</span> ${x}</div>`;
  }
  return `<div class="msg"><span class="who" style="color:${esc(m.c)}">${esc(m.e)} ${esc(m.n)}:</span> ${x}</div>`;
}
function renderChat(m){
  const el=$('#chatList'), myId=me();
  const vis = x => !x.to || x.to===myId || x.from===myId;
  if(m){
    if(!vis(m)) return;
    el.insertAdjacentHTML('beforeend', chatLine(m));
    if(!m.sys && !m.to){ BUB[m.from]={x:m.x, at:Date.now()}; renderSeats(); setTimeout(renderSeats, 4600); }
    if(!m.sys && m.from!==myId){
      if(!sideVisible('chat')){ UNREAD++; refreshUnread(); }
      if(m.to){ sfx.priv(); if(!sideVisible('chat')) toast(`🔒 ${m.n} te escribió en privado: ${m.x.slice(0,80)}`); }
    }
  } else el.innerHTML=CHAT.filter(vis).map(chatLine).join('');
  el.scrollTop=el.scrollHeight;
}
let UNREAD=0;
function refreshUnread(){ const b=$('#unread'); b.style.display=UNREAD?'inline-block':'none'; b.textContent=UNREAD; }
function sideVisible(tab){
  const on=$('#tab-'+tab).classList.contains('on');
  if($('#lobby').classList.contains('on')) return on;
  return on && (window.innerWidth>=1000 || $('#side').classList.contains('open'));
}
function toggleSide(force){
  const s=$('#side'), open = force==null ? !s.classList.contains('open') : force;
  if(window.innerWidth>=1000 && force==null){ setTab('chat'); $('#chatText').focus(); return; }
  s.classList.toggle('open', open);
  if(open && force==null){ setTab('chat'); }
}
function setTab(t){
  $$('#tabs button').forEach(b=>b.classList.toggle('on', b.dataset.tab===t));
  $$('.tabp').forEach(p=>p.classList.toggle('on', p.id==='tab-'+t));
  if(t==='chat'){ UNREAD=0; refreshUnread(); const el=$('#chatList'); el.scrollTop=el.scrollHeight; }
  if(t==='hist') renderHist();
}
$$('#tabs button').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
function renderChatTo(){
  const sel=$('#chatTo'), cur=sel.value, myId=me();
  const list=V ? [...V.players, ...(V.observers||[])].filter(x=>x.id!==myId) : [];
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
function sendChat(){
  const i=$('#chatText'), text=i.value.trim(); if(!text) return;
  sendChatRaw(text, $('#chatTo').value); i.value=''; atClose();
}
// una seña en secreto: si no elegiste a nadie, va a tu compañero
function askSecret(what){
  let to=$('#chatTo').value;
  if(!to && V){
    const mp=VP(me()), mate=mp && mp.team && V.players.find(q=>q!==mp && q.team===mp.team);
    if(mate) to=mate.id;
  }
  if(!to){ toast('Elegí a quién (en “Para”, abajo) o escribí @nombre. Las señas en secreto solo las ve esa persona 🤫'); $('#chatTo').focus(); return; }
  sendChatRaw('🤫 '+what, to);
}
// @ para mencionar: muestra la lista y elige a quién va el privado
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
function atPick(i){ const x=AT.list[i]; if(!x) return; $('#chatTo').value=x.id; chatToChanged(); $('#chatText').value=''; atClose(); $('#chatText').focus(); toast(`🔒 Ahora le escribís en privado a ${x.name}. Para volver a todos, elegí “📢 Todos”.`); }
$('#chatText').addEventListener('keydown', e=>{
  if($('#atpop').classList.contains('on')){
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault(); AT.sel=(AT.sel+(e.key==='ArrowDown'?1:-1)+AT.list.length)%AT.list.length; $$('#atpop div').forEach((d,i)=>d.classList.toggle('sel',i===AT.sel)); return; }
    if(e.key==='Enter'||e.key==='Tab'){ e.preventDefault(); atPick(AT.sel); return; }
    if(e.key==='Escape'){ atClose(); return; }
  }
  if(e.key==='Enter') sendChat();
});

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
  if(call.metadata && call.metadata.kind==='cam') return camOnCall(call);   // cámara de un jugador (caras.js)
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
}


/* ====================== SONIDOS ====================== */
const SND={on:load('ludo_snd')!==false, ctx:null};
function actx(){ if(!SND.ctx){ try{ SND.ctx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } if(SND.ctx && SND.ctx.state==='suspended') SND.ctx.resume(); return SND.ctx; }
function tone(f, d, type, v, when){
  if(!SND.on) return; const c=actx(); if(!c) return;
  const t=c.currentTime+(when||0), o=c.createOscillator(), g=c.createGain();
  o.type=type||'sine'; o.frequency.setValueAtTime(f,t); g.gain.setValueAtTime(v||.12,t); g.gain.exponentialRampToValueAtTime(.001,t+d);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t+d+.02);
}
function noise(d, v, when, hp){
  if(!SND.on) return; const c=actx(); if(!c) return;
  const t=c.currentTime+(when||0), b=c.createBuffer(1, Math.max(1,c.sampleRate*d|0), c.sampleRate), ch=b.getChannelData(0);
  for(let i=0;i<ch.length;i++) ch[i]=(Math.random()*2-1)*(1-i/ch.length);
  const s=c.createBufferSource(), g=c.createGain(), f=c.createBiquadFilter(); f.type='highpass'; f.frequency.value=hp||1800;
  s.buffer=b; g.gain.value=v||.2; s.connect(f).connect(g).connect(c.destination); s.start(t);
}
const sfx={
  dice(){ let t=0; for(let i=0;i<9;i++){ noise(.035,.35,t,1400+rnd(1500)); tone(220+rnd(200),.03,'square',.03,t); t+=.04+i*.012; } },
  step(i){ tone(620+(i%4)*60,.05,'triangle',.08); noise(.02,.12,0,3000); },
  out(){ tone(523,.1,'triangle',.12); tone(784,.16,'triangle',.12,.08); },
  cap(){ noise(.12,.4,0,600); tone(330,.12,'sawtooth',.08,.02); tone(220,.18,'sawtooth',.08,.12); tone(147,.25,'sawtooth',.07,.24); },
  goal(){ [659,784,988,1319].forEach((f,i)=>tone(f,.22,'triangle',.12,i*.08)); },
  six(){ [1047,1319,1568].forEach((f,i)=>tone(f,.2,'sine',.1,i*.07)); },
  turn(){ tone(740,.12,'sine',.14); tone(988,.18,'sine',.14,.11); },
  win(){ [523,659,784,1047,1319].forEach((f,i)=>tone(f,.32,'triangle',.14,i*.13)); },
  priv(){ tone(1200,.08,'sine',.08); tone(1500,.1,'sine',.08,.08); },
};
function toggleSound(){ SND.on=!SND.on; store('ludo_snd', SND.on); $('#btnSnd').textContent=SND.on?'🔊':'🔇'; if(SND.on) sfx.turn(); }
$('#btnSnd').textContent=SND.on?'🔊':'🔇';
document.addEventListener('pointerdown', ()=>actx(), {once:true});

/* ---------- música de fondo: una galopa paraguaya de arpa, tocada en el momento (sin archivos) ---------- */
const MUSIC_CREDIT = 'Música propia del juego: una galopa paraguaya de arpa que se toca en el momento.';
const MUSIC = { on: load('ludo_music')!==false, gain:null, timer:null, t:0, bar:0, VOL:.07 };
const mf = m => 440*Math.pow(2,(m-69)/12);
// 8 compases de 6/8 en Re mayor: acorde, bajo y melodía (0 = silencio)
const GALOPA = [
  {ch:[50,54,57], b:38, m:[74,78,81,0,78,74]},
  {ch:[55,59,62], b:43, m:[79,0,83,81,79,78]},
  {ch:[45,49,52,55], b:33, m:[76,79,76,73,0,76]},
  {ch:[50,54,57], b:38, m:[78,0,74,69,0,0]},
  {ch:[50,54,57], b:38, m:[81,0,78,81,86,0]},
  {ch:[55,59,62], b:43, m:[83,81,79,0,76,79]},
  {ch:[45,49,52,55], b:33, m:[78,76,73,69,73,76]},
  {ch:[50,54,57], b:38, m:[74,0,0,74,0,0]},
];
function harp(f, t, v, d){
  const c=SND.ctx, o=c.createOscillator(), o2=c.createOscillator(), g=c.createGain(), lp=c.createBiquadFilter();
  o.type='triangle'; o.frequency.value=f; o2.type='sine'; o2.frequency.value=f*2;
  lp.type='lowpass'; lp.frequency.value=3200;
  g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(v,t+.006); g.gain.exponentialRampToValueAtTime(.0005,t+d);
  const g2=c.createGain(); g2.gain.value=.25;
  o.connect(g); o2.connect(g2).connect(g); g.connect(lp).connect(MUSIC.gain);
  o.start(t); o2.start(t); o.stop(t+d+.05); o2.stop(t+d+.05);
}
function musicSchedule(){
  const c=SND.ctx; if(!c || !MUSIC.gain) return;
  const E=.155;
  while(MUSIC.t < c.currentTime+.6){
    const bar=GALOPA[MUSIC.bar%8], pass=Math.floor(MUSIC.bar/8)%2, t0=MUSIC.t;
    harp(mf(bar.b), t0, .5, 1.2); harp(mf(bar.b+7), t0+3*E, .32, .9);
    [[1,0],[2,1],[4,2],[5,1]].forEach(([s,k])=>harp(mf(bar.ch[k%bar.ch.length]+12), t0+s*E, .15, .5));
    bar.m.forEach((n,s)=>{ if(n) harp(mf(n+(pass?12:0)), t0+s*E, pass?.16:.21, .7); });
    MUSIC.t+=6*E; MUSIC.bar++;
  }
}
function musicStart(){
  if(!MUSIC.on || MUSIC.timer) return;
  const c=actx(); if(!c) return;
  MUSIC.gain=c.createGain(); MUSIC.gain.connect(c.destination);
  MUSIC.gain.gain.setValueAtTime(0.0001, c.currentTime); MUSIC.gain.gain.exponentialRampToValueAtTime(MUSIC.VOL, c.currentTime+2.5);
  MUSIC.t=c.currentTime+.2; MUSIC.bar=0;
  MUSIC.timer=setInterval(musicSchedule, 200); musicSchedule();
}
function musicStop(){
  if(!MUSIC.timer) return;
  clearInterval(MUSIC.timer); MUSIC.timer=null;
  const c=SND.ctx, g=MUSIC.gain; MUSIC.gain=null;
  try{ g.gain.setValueAtTime(g.gain.value, c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime+.8); setTimeout(()=>{ try{ g.disconnect(); }catch(e){} }, 2500); }catch(e){}
}
const musicWanted = () => !!S && !!NET.mode;
function musicSync(){ if(MUSIC.on && musicWanted()) musicStart(); else musicStop(); renderMusicBtn(); }
function toggleMusic(){ MUSIC.on=!MUSIC.on; store('ludo_music', MUSIC.on); musicSync(); toast(MUSIC.on?'🎶 Música de fondo prendida (galopa de arpa, suave).':'🔕 Música de fondo apagada.'); }
function renderMusicBtn(){ $$('.btnMusic').forEach(b=>{ b.textContent = MUSIC.on ? '🎶' : '🔕'; b.title = MUSIC.on ? 'Apagar la música de fondo' : 'Prender la música de fondo'; }); }
renderMusicBtn(); $('#musicCredit').textContent='🎶 '+MUSIC_CREDIT;

/* ====================== RENDER ====================== */
const LAST={ev:null, turnKey:null, endKey:null};
const MEDAL=['🥇','🥈','🥉','🏅','🏅','🏅'];
function render(){
  if(!S) return;
  V = NET.mode==='client' ? S : publicState(me());
  if(V.phase==='lobby'){ show('lobby'); renderLobby(); }
  else { show('game'); renderGame(); }
  renderSidePanels(); renderChatTo(); renderVoice(); voiceSync(); musicSync(); camSync();
}
function playerTag(p){
  const host=p.id===V.hostPid;
  return `<span class="dot" style="background:${p.color}"></span>${FACES[p.id]?`<img class="fthumb" src="${FACES[p.id]}" alt="">`:`<span style="font-size:20px">${esc(p.emoji)}</span>`}<span class="nm">${esc(p.name)}${p.id===me()?' <span class="muted">(vos)</span>':''}</span>`
    + `${host?'👑':''}${p.bot?'🤖':''}${p.mic?'🎙️':''}${!p.bot&&!p.conn?'⚠️':''}`;
}
const colOf = p => p && p.arm!=null && V && V.N ? colsOf(V.N)[p.arm] : {hex:(p&&p.color)||'#888', dark:'#333', soft:'#eee', n:''};

// ---------- sala de espera ----------
function renderLobby(){
  const host=amHost(), myObs=!!NET.obs, n=V.players.length;
  $('#lobbyCode').textContent=NET.code||'—';
  $('#lobbyCodeBox').style.display = NET.mode==='local' ? 'none' : '';
  $('#pcount').textContent=`(${n}/6)`;
  const prev=seatPreview(V.players, V.opts), teams=V.opts.mode==='equipos' && n===4;
  $('#plist').innerHTML=prev.map(({p,col,team},i)=>`<li>${playerTag(Object.assign({}, p, {color:col.hex}))}<span class="tm" style="background:${col.hex};${col.n==='Amarillo'?'color:#3a2a00':''}">${col.n}</span>${teams?`<span class="tm" style="background:${TCOLORS[team]}">Equipo ${team+1}</span>`:''}
      ${host && i>0?`<button class="btn sm gray" onclick="doAct({type:'seatUp',pid:'${p.id}'})" title="Subir en el orden (cambia el color y los equipos)">⬆️</button>`:''}
      ${host && p.id!==V.hostPid?`<button class="btn sm gray" onclick="doAct({type:'kick',pid:'${p.id}'})" title="Sacar">✕</button>`:''}</li>`).join('')
    + (V.observers||[]).map(o=>`<li style="opacity:.75"><span style="font-size:20px">👀</span><span class="nm">${esc(o.name)} <span class="muted">mirando</span></span>${o.mic?'🎙️':''}</li>`).join('');
  let warn='';
  if(n>=2 && !modeOk(V.opts, n)) warn='⚠️ Los equipos 2 contra 2 son con 4 jugadores en el tablero de 4 colores.';
  const N=boardFor(n, V.opts);
  $('#teamPrev').innerHTML = (teams ? `<div class="teamprev">${[0,1].map(t=>`<b style="color:${TCOLORS[t]}">Equipo ${t+1}:</b> ${prev.filter(x=>x.team===t).map(x=>esc(x.p.emoji+' '+x.p.name)+' ('+x.col.n.toLowerCase()+')').join(' y ')}`).join('<br>')}<br><span class="muted">Los compañeros quedan enfrente.</span></div>` : '')
    + (n>=2?`<p class="muted">${N===6?'🔯 Se juega en el <b>tablero de 6 colores</b>.':'✚ Se juega en el <b>tablero clásico de 4 colores</b>.'}${host?' Con ⬆️ cambiás el orden (y el color).':''}</p>`:'')
    + (warn?`<p class="muted" style="color:#a3320b;font-weight:700">${warn}</p>`:'');
  const canStart = n>=2 && modeOk(V.opts, n);
  $('#lobbyHostBtns').innerHTML = host
    ? `<div class="row"><button class="btn gray" onclick="doAct({type:'addBot'})" ${n>=MAXP?'disabled':''}>🤖 Sumar bot</button>
       <button class="btn green" onclick="doAct({type:'start'})" ${canStart?'':'disabled'}>▶️ Empezar</button></div>
       <p class="muted">De 2 a 6 jugadores. Si alguien se corta en la partida, un bot juega por él hasta que vuelva.</p>`
    : `<p class="muted" style="text-align:center">⏳ Esperando que el anfitrión 👑 empiece la partida…</p>`;
  $('#lobbyObs').innerHTML = myObs ? `<div class="obsbar" style="border-radius:10px;margin-top:8px">👀 Estás mirando. ${n<MAXP?`<button class="btn sm gold" onclick="doAct({type:'joinNext'})">🪑 Sentarme a jugar</button>`:'La mesa está llena.'}</div>` : '';
  $('#optsBox').innerHTML = optsHTML(host);
  const g=$('#grulesBox');
  if(host){
    if(!g.querySelector('textarea')) g.innerHTML=`<textarea id="grulesIn" maxlength="1200" placeholder="Ej.: al que le comen la ficha ceba el tereré 🧉&#10;Se puede pedir revancha…"></textarea><p class="muted" style="margin:4px 0 0">Se guarda solo y lo ven todos.</p>`;
    const ta=$('#grulesIn'); if(document.activeElement!==ta) ta.value=V.grules||'';
    ta.oninput=()=>{ clearTimeout(ta.t); ta.t=setTimeout(()=>doAct({type:'grules', text:ta.value}), 600); };
  } else g.innerHTML = V.grules ? `<div class="grules">${esc(V.grules)}</div>` : `<p class="muted">El anfitrión todavía no escribió reglas propias.</p>`;
  $('#sugBox').innerHTML = sugsHTML(host);
}
function optsHTML(host){
  const o=V.opts, dis = host && V.phase==='lobby' ? '' : 'disabled';
  const sel=(k, list)=>`<select ${dis} onchange="doAct({type:'opt',k:'${k}',v:this.value})">${list.map(t=>`<option value="${t.v}" ${o[k]==t.v?'selected':''}>${t.t}</option>`).join('')}</select>`;
  return `<label style="margin-top:0">Fichas</label>${sel('pieces', PIECES)}
    <label>Cómo se juega</label>${sel('mode', MODES)}
    <label>Tablero</label>${sel('board', BOARDS)}
    <label>Salir de casa</label>${sel('exit', EXITS)}
    <label>Premio</label>${sel('bonus', BONUS)}
    <label>Reglas de la casa ${host?'':'<span class="muted">(las elige el anfitrión)</span>'}</label>`
    + HOUSE.map(h=>`<label class="opt" style="margin:0 0 6px;font-weight:400"><input type="checkbox" ${o[h.k]?'checked':''} ${dis} onchange="doAct({type:'opt',k:'${h.k}',v:this.checked})"><span><b>${h.t}</b><small>${h.d}</small></span></label>`).join('');
}
function sugsHTML(host){
  const list=(V.sugs||[]).slice().sort((a,b)=>b.votes.length-a.votes.length);
  if(!list.length) return '<p class="muted">Todavía no hay sugerencias. ¡Proponé la primera!</p>';
  return list.map(s=>`<div class="sug"><span class="t">${esc(s.text)}<small>${esc(s.e)} ${esc(s.by)}</small></span>
    <button class="vote ${s.votes.includes(me())?'on':''}" onclick="doAct({type:'vote',id:'${s.id}'})">👍 ${s.votes.length}</button>
    ${host?`<button class="vote" onclick="doAct({type:'sugDel',id:'${s.id}'})" title="Borrar">🗑️</button>`:''}</div>`).join('');
}
function sendSug(id){ const i=$('#'+id); const t=i.value.trim(); if(!t) return toast('Escribí la regla que querés sugerir.'); doAct({type:'suggest', text:t}); i.value=''; toast('💡 ¡Sugerencia enviada! Los demás la pueden votar.'); }

// ---------- partida ----------
const meP = () => V && V.players.find(p=>p.id===me());
const curP = () => V && V.players[V.turn];
const isMyTurn = () => V && V.phase==='play' && curP() && curP().id===me();
function myArm(){ const p=meP(); if(p) return p.arm; const q=V.players[0]; return q?q.arm:0; }
function curLayout(){ return V && V.N ? layout(V.N, viewRot(V.N, myArm())) : null; }
const BOARD={key:null};
function renderGame(){
  $('#roomTag').textContent = NET.mode==='local' ? '🤖 Práctica' : '🔑 '+NET.code;
  $('#obsbar').style.display = NET.obs ? 'block' : 'none';
  if(NET.obs) $('#obsbar').innerHTML = `👀 Estás mirando la partida.${V.players.some(p=>p.bot)&&V.phase==='play'?` <button class="btn sm gold" onclick="doAct({type:'joinNext'})">🪑 Tomar el lugar de un bot</button>`:''}`;
  applyView();
  renderBoard();
  processEvents();
  renderPieces(); renderSeats(); renderStrip(); renderDice(); renderActions();
  turnNotice();
  overModal();
}
function renderBoard(){
  const L=curLayout(); if(!L) return;
  const used={}; V.players.forEach(p=>used[p.arm]=1);
  const C=colsOf(V.N), colors=C.map((c,k)=>used[k]?c:null);
  const key=L.N+':'+L.rot+':'+Object.keys(used).join(',');
  if(BOARD.key===key) return;
  BOARD.key=key; resetPieces();
  $('#boardSvg').outerHTML = boardSVG(L.N, L.rot, colors).replace('<svg ', '<svg id="boardSvg" ');
  $('#tablero').classList.toggle('hex', L.N===6);
  $('#lay').style.setProperty('--ps', (100/(2*L.E)*.78)+'%');
  sizeBoard();
}
function sizeBoard(){
  const st=$('#stage'), tb=$('#tablero'); if(!st || !tb) return;
  const w=st.clientWidth, h=st.clientHeight; if(!w || !h) return;
  const s=Math.floor(VIEW.mode==='3d' ? Math.min(w*.9, h*1.02) : Math.min(w, h)*.97);
  tb.style.width=tb.style.height=s+'px';
}
// ---------- las fichas ----------
const PZ={els:{}, anim:{}, timer:null};
function resetPieces(){ Object.values(PZ.els).forEach(e=>e.remove()); PZ.els={}; PZ.anim={}; clearInterval(PZ.timer); PZ.timer=null; BOARD.key=BOARD.key; }
function placeEl(el, xy, L){ el.style.left=((xy[0]+L.E)/(2*L.E)*100)+'%'; el.style.top=((xy[1]+L.E)/(2*L.E)*100)+'%'; }
function stackOff(j, n){
  if(n<=1) return [0,0];
  if(n===2) return j ? [.17,.12] : [-.17,-.12];
  const a=j/n*Math.PI*2-Math.PI/2; return [Math.cos(a)*.22, Math.sin(a)*.22];
}
function myMoves(){ return isMyTurn() && (V.tp==='move'||V.tp==='bonus') ? (V.moves||[]) : []; }
function renderPieces(){
  const L=curLayout(); if(!L) return;
  const lay=$('#lay'), seen=new Set(), mm=myMoves(), groups={};
  V.players.forEach(p=>(p.pz||[]).forEach((x,i)=>{ const k=L.cellKey(p.arm,x,i); (groups[k]=groups[k]||[]).push(p.id+'-'+i); }));
  V.players.forEach(p=>{
    const c=colOf(p);
    (p.pz||[]).forEach((x,i)=>{
      const key=p.id+'-'+i; seen.add(key);
      let el=PZ.els[key];
      if(!el){
        el=document.createElement('div'); el.className='pz'; el.dataset.k=key; el.style.setProperty('--pc', c.hex);
        el.innerHTML=`<div class="hp"><div class="pw"><div class="disc"></div>${pawnSVG(c)}<span class="ix"></span></div></div>`;
        el.onclick=e=>{ e.stopPropagation(); pieceClick(p.id, i); };
        lay.appendChild(el); PZ.els[key]=el;
      }
      const an=PZ.anim[key];
      let xy;
      if(an) xy=an.cur;
      else { xy=L.pos(p.arm,x,i,p.pz.length); const grp=groups[L.cellKey(p.arm,x,i)]; if(grp.length>1){ const o=stackOff(grp.indexOf(key), grp.length); xy=[xy[0]+o[0], xy[1]+o[1]]; } }
      placeEl(el, xy, L);
      el.style.zIndex = 5 + Math.round((xy[1]+L.E)*3);
      const mv=mm.find(m=>m.pid===p.id && m.idx===i);
      el.classList.toggle('can', !!mv && !an);
      el.querySelector('.ix').textContent = mv ? (mv.exit?'↗':'+'+(mv.to-mv.from)) : '';
    });
  });
  for(const k in PZ.els) if(!seen.has(k)){ PZ.els[k].remove(); delete PZ.els[k]; }
  $$('#lay .ghost').forEach(g=>g.remove());
  if(!Object.keys(PZ.anim).length) distinctMoves(mm).forEach(m=>{
    const o=V.players.find(q=>q.id===m.pid); if(!o) return;
    const g=document.createElement('div'); g.className='ghost'; g.style.setProperty('--pc', colOf(o).hex);
    placeEl(g, L.pos(o.arm, m.to, m.idx, o.pz.length), L);
    g.onclick=e=>{ e.stopPropagation(); doMoveUI(m); };
    g.title='Llevar la ficha acá'; lay.appendChild(g);
  });
}
function pieceClick(pid, idx){
  if(DRAG.moved) return;
  if(!V || V.phase!=='play') return;
  const mm=myMoves(), m=mm.find(x=>x.pid===pid && x.idx===idx);
  if(m) return doMoveUI(m);
  if(isMyTurn() && V.tp==='roll') return diceClick();
  if(isMyTurn() && mm.length) return toast('Esa ficha no se puede mover con este número. Las que brillan sí ✨');
}
function doMoveUI(m){ doAct({type:'move', idx:m.idx, pid:m.pid}); }
// recorrido casilla por casilla
function animMove(e){
  const L=curLayout(), p=VP(e.pid); if(!L || !p) return;
  const key=e.pid+'-'+e.idx, pts=e.path.map(x=>L.pos(p.arm, x, e.idx, p.pz.length));
  PZ.anim[key]={pts, i:0, cur:pts[0], delay:0, goal:e.goal, exit:e.path[0]<0};
  (e.caps||[]).forEach(c=>{ const q=VP(c.pid); if(!q) return; const a=L.pos(q.arm,c.at,c.idx), b=L.pos(q.arm,-1,c.idx);
    PZ.anim[c.pid+'-'+c.idx]={pts:[a,b], i:0, cur:a, delay:e.path.length, fly:true, by:e.by, victim:c.pid}; });
  if(!PZ.timer) PZ.timer=setInterval(animTick, 170);
}
function animTick(){
  const L=curLayout(); let any=false;
  for(const k in PZ.anim){
    const a=PZ.anim[k]; any=true;
    if(a.delay>0){ a.delay--; continue; }
    a.i++;
    const el=PZ.els[k];
    if(a.i>=a.pts.length){ delete PZ.anim[k]; if(el) el.classList.remove('fly'); continue; }
    a.cur=a.pts[a.i];
    if(el && L){ el.classList.toggle('fly', !!a.fly); placeEl(el, a.cur, L); if(!a.fly){ el.classList.remove('hop'); void el.offsetWidth; el.classList.add('hop'); } }
    if(a.fly){ sfx.cap(); const by=VP(a.by), vi=VP(a.victim);
      if(vi && vi.id===me()) bigText('😱 ¡Te comieron!', by?by.name+' te mandó a casa':'');
      else if(by && by.id===me()) bigText('😋 ¡Ñam!', vi?'Mandaste a casa a '+vi.name:'');
      else bigText('😋 ¡A casa!', (by?by.name:'')+(vi?' se come a '+vi.name:''));
      if(vi && vi.id===me()) vib([80,60,160]); }
    else if(a.i===a.pts.length-1 && a.goal) sfx.goal();
    else if(a.exit) sfx.out();
    else sfx.step(a.i);
  }
  if(!any){ clearInterval(PZ.timer); PZ.timer=null; if(V && V.phase!=='lobby') renderPieces(); }
}
function vib(p){ try{ if(navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(p); }catch(e){} }
function bigText(t, sub){ const d=document.createElement('div'); d.className='big-msg'; d.innerHTML=esc(t)+(sub?`<small>${esc(sub)}</small>`:''); document.body.appendChild(d); setTimeout(()=>d.remove(),1700); }
// ---------- casas: nombre, cara, globito ----------
function renderSeats(){
  if(!V || V.phase==='lobby') return;
  const L=curLayout(); if(!L) return;
  const lay=$('#lay'), cp=curP();
  $$('#lay .ylab').forEach(x=>x.remove());
  V.players.forEach(p=>{
    const [x,y]=L.yardC(p.arm), d=document.createElement('div');
    const b=BUB[p.id], bub = b && Date.now()-b.at<4500 ? `<div class="bub">${esc(b.x.slice(0,90))}</div>` : '';
    const off=!p.bot && !p.conn;
    d.className='ylab'+(cp===p && V.phase==='play'?' turn':''); d.style.setProperty('--pc', colOf(p).hex);
    d.innerHTML=`${bub}${headHTML(p) || `<span class="em">${esc(p.emoji)}</span>`}<span class="nmb">${p.place?MEDAL[p.place-1]+' ':''}${esc(p.name)}${p.id===me()?' (vos)':''}${p.bot?' 🤖':''}${off?' ⚠️':''}</span>`;
    placeEl(d, [x,y], L); d.style.zIndex=4;
    lay.appendChild(d);
  });
  headsAfterRender();
}
function pipsHTML(p){
  const gl=geo(V.N).goal;
  return `<span class="pips" style="--pc:${colOf(p).hex}">${(p.pz||[]).map(x=>`<i class="${x===gl?'g':x>=0?'c':''}"></i>`).join('')}</span>`;
}
function renderStrip(){
  const cp=curP();
  $('#pstrip').innerHTML=V.players.map(p=>{
    const c=colOf(p), turn=cp===p && V.phase==='play', off=!p.bot&&!p.conn;
    const dd = turn && V.dice && V.tp!=='roll' ? `<span class="dd">${DICE_FACES[V.dice]}</span>` : '';
    const tmk = p.team ? `<span class="tmk" style="--tc:${TCOLORS[+p.team.slice(1)]}">E${+p.team.slice(1)+1}</span>` : '';
    return `<div class="pchip ${turn?'turn':''} ${off?'off':''}" style="--pc:${c.hex}">${tmk}<span class="av">${FACES[p.id]?`<img class="fthumb" style="width:28px;height:28px;border-radius:50%" src="${FACES[p.id]}" alt="">`:esc(p.emoji)}</span><span><b>${esc(p.name)}${p.id===me()?' (vos)':''}</b><small>${pipsHTML(p)}${p.place?' '+MEDAL[p.place-1]:''}${p.bot?' 🤖':''}${p.mic?' 🎙️':''}${off?' ⚠️':''}${p.id===V.hostPid&&NET.mode!=='local'?' 👑':''}</small></span>${dd}</div>`;
  }).join('');
}
// ---------- el dado ----------
const PIPS={1:[5],2:[3,7],3:[3,5,7],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]};
$$('#cube .f').forEach(f=>{ const v=+f.className.match(/f(\d)/)[1]; f.innerHTML=PIPS[v].map(k=>`<i style="grid-row:${Math.ceil(k/3)};grid-column:${(k-1)%3+1}"></i>`).join(''); });
const FACE_ROT={1:[0,0],2:[-90,0],3:[0,-90],4:[0,90],5:[90,0],6:[0,180]};
const DICE={rx:-20, ry:20, v:0, until:0};
function diceTo(v, roll){
  const [bx,by]=FACE_ROT[v]||[0,0], cube=$('#cube');
  const k1=Math.ceil((DICE.rx-bx)/360)+(roll?2+rnd(2):0), k2=Math.ceil((DICE.ry-by)/360)+(roll?2+rnd(2):0);
  DICE.rx=bx+360*k1; DICE.ry=by+360*k2; DICE.v=v;
  cube.style.transition = roll ? '' : 'none';
  cube.style.transform=`rotateX(${DICE.rx-14}deg) rotateY(${DICE.ry+16}deg)`;
  if(roll) DICE.until=Date.now()+950;
}
diceTo(6, false);
function renderDice(){
  const w=$('#dice'), can=isMyTurn() && V.tp==='roll';
  w.classList.toggle('go', can); w.classList.toggle('off', !can);
  if(V.dice && V.dice!==DICE.v && Date.now()>DICE.until) diceTo(V.dice, false);
}
function diceClick(){
  if(!V || !isMyTurn() || V.tp!=='roll') { if(V && V.phase==='play' && !isMyTurn()) toast('Esperá tu turno ⏳'); return; }
  doAct({type:'roll'});
}
document.addEventListener('keydown', e=>{ if((e.key===' '||e.key==='Enter') && document.activeElement===document.body && $('#game').classList.contains('on') && V){ e.preventDefault(); if(isMyTurn() && V.tp==='roll') diceClick(); else { const m=distinctMoves(myMoves()); if(m.length===1) doMoveUI(m[0]); } } });
// ---------- lo que pasó (animaciones y sonidos) ----------
function processEvents(){
  const evs=V.ev||[], maxI=evs.length?evs[evs.length-1].i:0;
  if(LAST.ev==null || maxI<LAST.ev){ LAST.ev=maxI; return; }
  const news=evs.filter(e=>e.i>LAST.ev); LAST.ev=maxI;
  if(news.length>8) return;
  for(const e of news){
    if(e.k==='roll'){ diceTo(e.v, true); sfx.dice(); if(e.v===6) setTimeout(()=>sfx.six(), 850); }
    else if(e.k==='move') animMove(e);
    else if(e.k==='done'){ const p=VP(e.pid); setTimeout(()=>{ bigText('🏆 ¡'+(p?p.name:'')+'!', `metió todas sus fichas: ${e.place}º puesto`); sfx.win(); }, 900); }
    else if(e.k==='end'){ setTimeout(()=>sfx.win(), 1200); }
  }
}
function renderActions(){
  const p=meP(), A=$('#actions'), st=$('#status');
  if(V.phase==='over'){ A.innerHTML=`<button class="btn gold" onclick="LAST.endKey=null;overModal(true)">🏆 Ver el resultado</button>`; const w=VP(V.places&&V.places[0]); st.innerHTML=w?`🎉 Ganó <b>${esc(w.name)}</b>${V.opts.mode==='equipos'?' con su equipo':''}`:''; return; }
  const cp=curP(); if(!cp){ A.innerHTML=''; st.innerHTML=''; return; }
  let h='', s='';
  if(isMyTurn()){
    const owner=V.players.find(q=>q.id===(V.moves&&V.moves[0]&&V.moves[0].pid)) || p;
    if(V.tp==='roll'){
      s = V.sixes ? `🎲 ¡Sacaste 6! <b>Tirá de nuevo</b>` : `🟢 <b>¡Te toca!</b> Tocá el dado para tirar`;
      h = `<button class="btn big" onclick="diceClick()">🎲 Tirar el dado</button>`;
    } else if(V.tp==='move' || V.tp==='bonus'){
      const ms=distinctMoves(V.moves||[]);
      s = V.tp==='bonus' ? `🎁 <b>Premio:</b> contá <b>${V.bonusN}</b> casillas con una ficha` : `Sacaste <b>${V.dice}</b> ${DICE_FACES[V.dice]}: tocá una ficha que brille ✨ o elegí abajo`;
      if(owner && owner!==p) s+=` <span style="opacity:.8">(jugás con las de ${esc(owner.name)})</span>`;
      const gl=geo(V.N);
      h = ms.map(m=>{ const o=V.players.find(q=>q.id===m.pid), safe=m.to<=gl.last && isSafeG(gIdx(o.arm,m.to,V.N));
        const t = m.exit ? '🏠➡️ Sacar una ficha' : m.goal ? `🏁 Ficha ${m.idx+1} a la meta` : `Ficha ${m.idx+1}: +${m.to-m.from}${m.to>=gl.home0&&m.from<gl.home0?' 🛤️':''}${safe?' ⭐':''}`;
        return `<button class="btn chip ${m.cap.length?'cap':''} ${m.goal?'goal':''}" style="--pc:${colOf(o).hex}" onclick="doAct({type:'move',idx:${m.idx},pid:'${m.pid}'})">${t}${m.cap.length?' 😋 come':''}</button>`; }).join('');
    } else if(V.tp==='pass'){
      s = `${DICE_FACES[V.dice]||''} Con <b>${V.dice}</b> no podés mover ninguna ficha${V.extra&&V.sixes<3?'… pero sacaste 6: ¡tirás otra vez!':'.'}`;
    }
  } else {
    const what = V.tp==='roll' ? 'tira el dado' : V.tp==='pass' ? `sacó ${V.dice} y no puede mover` : V.tp==='bonus' ? `cuenta un premio de ${V.bonusN}` : `sacó ${V.dice} ${DICE_FACES[V.dice]} y mueve`;
    s = `${p?'⏳':'👀'} <b style="color:${colOf(cp).hex};filter:brightness(1.5)">${esc(cp.emoji)} ${esc(cp.name)}</b>${cp.bot?' 🤖':''}${p && p.team && cp.team===p.team && cp!==p?' (tu compañero)':''} ${what}`;
  }
  A.innerHTML=h; st.innerHTML=s;
}
function turnNotice(){
  if(V.phase!=='play') return;
  const key=V.turn+':'+V.turnAt+':'+V.tp;
  if(key===LAST.turnKey) return;
  const prevTurn = LAST.turnKey && LAST.turnKey.split(':')[0];
  LAST.turnKey=key;
  if(isMyTurn() && V.tp==='roll' && LAST.ev!=null && prevTurn!==String(V.turn)){
    setTimeout(()=>{ if(!isMyTurn() || V.tp!=='roll') return; sfx.turn(); vib(120);
      const d=document.createElement('div'); d.className='yourturn'; d.textContent='🟢 ¡Te toca tirar!'; document.body.appendChild(d); setTimeout(()=>d.remove(),1700); }, 500);
  }
}

// ---------- ventanas ----------
function modal(h){ $('#mbox').innerHTML=h; $('#modal').classList.add('on'); }
function closeModal(){ $('#modal').classList.remove('on'); }
$('#modal').addEventListener('click', e=>{ if(e.target.id==='modal') closeModal(); });
function overModal(force){
  if(V.phase!=='over') return;
  const key='over:'+V.startedAt;
  if(!force && LAST.endKey===key) return;
  LAST.endKey=key;
  setTimeout(()=>{ if(!V || V.phase!=='over') return; modal(overHTML()); }, force?0:1800);
}
function overHTML(){
  const host=amHost(), gl=geo(V.N).goal;
  const list=(V.places||[]).map(id=>VP(id)).filter(Boolean);
  const teams=V.opts.mode==='equipos';
  const rows=list.map((p,i)=>`<div class="prow" style="border-left:6px solid ${colOf(p).hex}"><span class="md">${teams?(p.place===1?'🥇':'🥈'):MEDAL[i]}</span><span style="font-size:22px">${esc(p.emoji)}</span><span class="nm"><b>${esc(p.name)}${p.id===me()?' (vos)':''}</b><small>${colOf(p).n} · 🏁 ${(p.pz||[]).filter(x=>x===gl).length}/${(p.pz||[]).length} en la meta · 😋 comió ${p.caps||0} · 😩 le comieron ${p.lost||0}</small></span></div>`).join('');
  const w=list[0];
  const nobs = NET.obs && V.players.length<MAXP ? `<button class="btn gold wide" style="margin-top:6px" onclick="doAct({type:'joinNext'});closeModal()">🪑 Sentarme para la próxima partida</button>` : '';
  return `<h2>🎉 ¡Terminó la partida!</h2>
    <p style="font-size:17px">${w?(teams?`🥇 Gana el equipo de <b>${esc(list.filter(p=>p.place===1).map(p=>p.name).join(' y '))}</b>.`:`🥇 <b>${esc(w.name)}</b> metió todas sus fichas primero.`):''}</p>
    <div class="podio">${rows}</div>
    ${host ? `<button class="btn green wide" onclick="closeModal();doAct({type:'newGame'})">🔁 Otra partida</button>` : `<p class="muted" style="text-align:center">⏳ Esperando que el anfitrión arme otra partida…</p>`}
    ${nobs}
    <button class="btn gray wide" style="margin-top:6px" onclick="closeModal()">Ver el tablero</button>`;
}

// ---------- panel: jugadas, mesa y reglas ----------
function renderSidePanels(){
  if($('#tab-hist').classList.contains('on')) renderHist();
  renderMesaTab(); renderReglasTab();
}
let HIST_N=0;
function renderHist(){
  if(!V) return;
  const L=(V.log||[]).slice().reverse();
  const fresh=L.length-HIST_N; HIST_N=L.length;
  $('#histList').innerHTML = L.length ? L.map((l,i)=>{
    const dz = l.bonus ? `<span class="dz bo" style="--pc:${l.color||'#ccc'}">🎁${l.bonus}</span>` : l.dice ? `<span class="dz" style="--pc:${l.color||(VP(l.pid)||{}).color||'#ccc'}">${l.dice}</span>` : '';
    return `<div class="hline ${l.cap?'cap':''} ${l.goal?'goal':''} ${i<fresh&&fresh<5?'new':''}">${dz}<span class="t">${esc(l.x)}</span></div>`;
  }).join('') : '<p class="muted">Todavía no hay jugadas.</p>';
}
function renderMesaTab(){
  const host=amHost(), inPlay=V.phase!=='lobby', gl=inPlay?geo(V.N).goal:0;
  const ps=V.players.map(p=>{
    const offline=!p.bot&&!p.conn, pz=p.pz||[];
    const det = inPlay ? `🏠 ${pz.filter(x=>x<0).length} en casa · 🛣️ ${pz.filter(x=>x>=0&&x<gl).length} en camino · 🏁 ${pz.filter(x=>x===gl).length} en la meta · 😋 ${p.caps||0}` : '';
    return `<div class="prow" style="border-left:5px solid ${inPlay?colOf(p).hex:p.color}"><span style="font-size:22px">${esc(p.emoji)}</span><span class="nm"><b>${esc(p.name)}${p.id===me()?' (vos)':''}${p.id===V.hostPid&&NET.mode!=='local'?' 👑':''}${p.place?' '+MEDAL[p.place-1]:''}</b>
      <small>${inPlay?colOf(p).n+' · ':''}${det}${p.team?` · equipo ${+p.team.slice(1)+1}`:''}${p.bot?' · 🤖 bot':''}${p.mic?' · 🎙️':''}${offline?' · ⚠️ sin conexión':''}${inPlay&&curP()===p&&V.phase==='play'?' · ⏳ su turno':''}</small></span>
      ${host&&p.id!==V.hostPid&&NET.mode!=='local'?`${offline&&inPlay?`<button class="btn sm gray" onclick="doAct({type:'botify',pid:'${p.id}'})" title="Que juegue un bot">🤖</button>`:''}<button class="btn sm gray" onclick="if(confirm('¿Sacar a ${esc(p.name)} de la mesa?'))doAct({type:'kick',pid:'${p.id}'})" title="Sacar">✕</button>`:''}</div>`;
  }).join('');
  const obs=(V.observers||[]).map(o=>`<div class="prow"><span style="font-size:20px">👀</span><span class="nm"><b>${esc(o.name)}${o.id===me()?' (vos)':''}</b><small>mirando${o.mic?' · 🎙️':''}</small></span></div>`).join('');
  const sit = NET.obs && V.phase==='over' && V.players.length<MAXP ? `<button class="btn gold wide" onclick="doAct({type:'joinNext'})">🪑 Sentarme a jugar</button>`
    : NET.obs && V.phase==='play' && V.players.some(p=>p.bot) ? `<button class="btn gold wide" onclick="doAct({type:'joinNext'})">🪑 Tomar el lugar de un bot</button>`
    : NET.obs ? `<p class="muted">Si hay un bot podés tomar su lugar; si no, te sentás en la próxima partida.</p>` : '';
  const info = inPlay ? `<p class="muted">${V.N===6?'Tablero de 6 colores':'Tablero clásico'} · ${V.opts.pieces} fichas cada uno · se sale con ${exitTxt(V.opts)}</p>` : '';
  $('#mesaList').innerHTML = info + `<b>Jugadores (${V.players.length}/6)</b>` + ps + (obs?`<b>Mirando</b>${obs}`:'') + sit
    + (NET.mode!=='local'&&NET.code?`<p class="muted" style="margin-top:12px">Invitá con el código <b>${NET.code}</b> <button class="btn sm" onclick="shareRoom()">📤 Compartir</button></p>`:'');
}
function rulesSummary(o){
  return `<p style="margin-top:0"><b>${(PIECES.find(x=>x.v==o.pieces)||{}).t||''}</b> · ${(MODES.find(m=>m.v===o.mode)||{}).t||''}<br>${(EXITS.find(x=>x.v===o.exit)||{}).t||''}<br>${(BONUS.find(x=>x.v===o.bonus)||{}).t||''}</p>`;
}
function renderReglasTab(){
  const o=V.opts, on=HOUSE.filter(h=>o[h.k]);
  const host=amHost(), localEdit = NET.mode==='local';
  const lo=Object.assign(defaultOpts(), load('ludo_localopts')||{});
  const lsel=(k, list)=>`<select onchange="setLocalOpt('${k}',this.value)">${list.map(t=>`<option value="${t.v}" ${lo[k]==t.v?'selected':''}>${t.t}</option>`).join('')}</select>`;
  $('#reglasList').innerHTML = rulesSummary(o)
    + (localEdit ? `<p class="muted">Lo que cambies acá vale para la próxima partida de práctica.</p><label style="font-weight:800;font-size:13px">Fichas</label>${lsel('pieces',PIECES)}<label style="font-weight:800;font-size:13px">Tablero</label>${lsel('board',BOARDS)}<label style="font-weight:800;font-size:13px">Salir de casa</label>${lsel('exit',EXITS)}<label style="font-weight:800;font-size:13px">Premio</label>${lsel('bonus',BONUS)}<div style="height:8px"></div>`
        +HOUSE.map(h=>`<label class="opt" style="font-weight:400"><input type="checkbox" ${lo[h.k]?'checked':''} onchange="setLocalOpt('${h.k}',this.checked)"><span><b>${h.t}</b><small>${h.d}</small></span></label>`).join('')
        +`<button class="btn green wide" onclick="if(confirm('¿Empezar otra partida de práctica con estas reglas?'))localStart()">🔁 Empezar otra con estas reglas</button>`
      : `<b>Reglas de la casa activas</b>` + (on.length ? on.map(h=>`<div class="opt"><span><b>${h.t}</b><small>${h.d}</small></span></div>`).join('') : '<p class="muted">Ninguna.</p>'))
    + `<b>📝 Reglas propias del grupo</b>` + (V.grules?`<div class="grules" style="margin:6px 0 10px">${esc(V.grules)}</div>`:`<p class="muted">${host&&!localEdit?'Las podés escribir en la sala de espera.':'No hay.'}</p>`)
    + `<b>💡 Sugerencias</b><div style="margin-top:6px">${sugsHTML(host)}</div>
       <div class="row"><input type="text" id="sugIn2" maxlength="240" placeholder="Proponé una regla…" onkeydown="if(event.key==='Enter')sendSug('sugIn2')"><button class="btn sm" style="flex:0 0 auto" onclick="sendSug('sugIn2')">Sugerir</button></div>
       <button class="btn dark wide" style="margin-top:12px" onclick="showRules()">📜 Reglas completas del Ludo</button>`;
}
function setLocalOpt(k, v){
  const o=Object.assign(defaultOpts(), load('ludo_localopts')||{});
  o[k] = k==='pieces' ? +v : ['exit','bonus','board','mode'].includes(k) ? v : !!v;
  store('ludo_localopts', o); toast('Se usa en la próxima partida de práctica.');
}

// ---------- compartir ----------
function roomLink(){ return location.origin+location.pathname+'#'+NET.code; }
function copyCode(){ navigator.clipboard && navigator.clipboard.writeText(NET.code).then(()=>toast('Código copiado: '+NET.code)); }
function shareRoom(){
  const url=roomLink(), text=`¡Vení a jugar al Ludo conmigo! 🎲🇵🇾 Sala ${NET.code}`;
  if(navigator.share) return navigator.share({title:'Ludo PY', text, url}).catch(()=>{});
  modal(`<h2>📤 Invitar a la sala ${NET.code}</h2><p style="word-break:break-all;user-select:all;background:#fff;padding:8px;border-radius:8px">${esc(url)}</p>
    <a class="btn green wide" style="display:block;text-align:center;text-decoration:none" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text+' '+url)}">💬 Mandar por WhatsApp</a>
    <button class="btn wide" style="margin-top:6px" onclick="navigator.clipboard.writeText('${url}').then(()=>toast('Enlace copiado'))">📋 Copiar enlace</button>
    <button class="btn gray wide" style="margin-top:6px" onclick="closeModal()">Cerrar</button>`);
}

/* ====================== VISTA 2D / 3D ====================== */
const VIEW=Object.assign({mode:'2d', tilt:48, spin:0, zoom:.9}, load('ludo_view')||{});
function saveView(){ store('ludo_view', {mode:VIEW.mode, tilt:VIEW.tilt, zoom:VIEW.zoom}); }
function applyView(){
  $('#game').classList.toggle('v3d', VIEW.mode==='3d');
  const m=$('#tablero'); m.style.setProperty('--tilt', VIEW.tilt+'deg'); m.style.setProperty('--spin', VIEW.spin+'deg'); m.style.setProperty('--zoom', VIEW.zoom);
  $('#btnView').textContent = VIEW.mode==='3d' ? '🗺️ 2D' : '🧊 3D';
  sizeBoard();
}
function toggleView(){
  VIEW.mode = VIEW.mode==='3d' ? '2d' : '3d'; VIEW.spin=0; saveView(); applyView();
  toast(VIEW.mode==='3d' ? '🧊 Vista 3D: arrastrá el tablero para girarlo. Botones de cámara a la derecha.' : '🗺️ Vista 2D (desde arriba).');
}
function cam(k, d){
  if(k==='spin') VIEW.spin+=d;
  else if(k==='tilt') VIEW.tilt=Math.max(15, Math.min(64, VIEW.tilt+d));
  else if(k==='zoom') VIEW.zoom=Math.max(.5, Math.min(1.4, +(VIEW.zoom+d).toFixed(2)));
  else if(k==='reset'){ VIEW.spin=0; VIEW.tilt=48; VIEW.zoom=.9; }
  saveView(); applyView();
}
const DRAG={on:false, moved:false};
(function(){
  const stage=$('#stage');
  stage.addEventListener('pointerdown', e=>{ DRAG.moved=false; if(VIEW.mode!=='3d' || e.target.closest('.cam3d')) return; Object.assign(DRAG,{on:true, x:e.clientX, y:e.clientY, spin:VIEW.spin, tilt:VIEW.tilt}); });
  window.addEventListener('pointermove', e=>{
    if(!DRAG.on) return; const dx=e.clientX-DRAG.x, dy=e.clientY-DRAG.y;
    if(!DRAG.moved && Math.hypot(dx,dy)<8) return;
    if(!DRAG.moved){ DRAG.moved=true; $('#tablero').classList.add('dragging'); }
    VIEW.spin=DRAG.spin+dx*.35; VIEW.tilt=Math.max(15, Math.min(64, DRAG.tilt+dy*.15)); applyView();
  });
  window.addEventListener('pointerup', ()=>{ if(!DRAG.on) return; DRAG.on=false; $('#tablero').classList.remove('dragging'); if(DRAG.moved){ saveView(); setTimeout(()=>DRAG.moved=false, 50); } });
})();
window.addEventListener('resize', ()=>{ if(V && V.phase!=='lobby') sizeBoard(); });

/* ====================== REGLAS ====================== */
function showRules(){
  modal(`<div class="rules"><h2>📜 Reglas del Ludo</h2>
  <div class="demo">${boardSVG(4, 0, null)}</div>
  <p>Juegan de <b>2 a 6</b> personas. Con hasta 4 se usa el <b>tablero clásico en cruz</b> (rojo, verde, amarillo y azul); con 5 o 6, el <b>tablero en estrella de 6 colores</b> (se suman naranja y violeta). Cada uno tiene <b>4 fichas</b> en su casa y se juega con un dado. Gana el primero que lleva sus 4 fichas a la <b>meta del centro</b>.</p>
  <h3>🎲 Cómo se juega</h3>
  <ul>
    <li>Se tira el dado por turnos, siguiendo las agujas del reloj.</li>
    <li>Para <b>sacar una ficha de casa</b> hace falta un <b>6</b>: la ficha va a tu <b>salida</b> (la casilla de tu color con la estrella blanca).</li>
    <li>Con lo que sacás en el dado <b>movés una ficha</b> esa cantidad de casillas por el camino, siempre para adelante.</li>
    <li>Si sacás <b>6, volvés a tirar</b>. Pero si sacás <b>tres 6 seguidos, perdés el turno</b>.</li>
    <li>Si ninguna ficha se puede mover con ese número, pasás.</li>
  </ul>
  <h3>😋 Comer</h3>
  <ul>
    <li>Si tu ficha cae justo en una casilla donde hay una ficha de otro color, <b>te la comés</b>: vuelve a su casa y tiene que salir de nuevo.</li>
    <li>Al comer (o al meter una ficha en la meta) <b>tirás otra vez</b>.</li>
    <li><b>Casillas seguras ⭐</b>: las salidas de cada color y las estrellas doradas. Ahí no se come a nadie.</li>
  </ul>
  <h3>🧱 Bloqueos</h3>
  <p>Dos fichas tuyas en la misma casilla del camino hacen un <b>bloqueo</b>: ninguna ficha de otro color puede pasar ni caer ahí. En cada casilla entran como mucho 2 fichas.</p>
  <h3>🏁 El pasillo y la meta</h3>
  <ul>
    <li>Después de dar la vuelta entera, tu ficha entra a <b>tu pasillo de color</b> (la columna del medio de tu brazo, con la flecha). Ahí nadie la puede comer.</li>
    <li>Para entrar a la meta hace falta <b>el número justo</b>.</li>
    <li>El primero que mete todas sus fichas gana, y los demás <b>siguen jugando por el 2º y el 3º puesto</b>.</li>
  </ul>
  <h3>🤝 Equipos 2 contra 2</h3>
  <p>Con 4 jugadores se puede jugar en equipos: los compañeros quedan enfrente, no se comen entre ellos y pueden pasar los bloqueos del otro. El que mete sus fichas primero <b>sigue tirando para mover las de su compañero</b>. Gana el equipo que mete las 8 fichas.</p>
  <h3>🏠 Reglas de la casa (las elige el anfitrión)</h3>
  ${EXITS.map(x=>`<p style="margin:2px 0">${x.t}</p>`).join('')}
  ${BONUS.map(x=>`<p style="margin:2px 0">${x.t}</p>`).join('')}
  <p style="margin:2px 0">🏃 Partida rápida: 3 o 2 fichas cada uno.</p>
  ${HOUSE.map(h=>`<p><b>${h.t}</b>: ${h.d}</p>`).join('')}
  <p>Además, cada grupo puede escribir sus propias reglas en la sala y todos pueden <b>sugerir reglas nuevas y votarlas 👍</b>.</p>
  <h3>💬 Chat y voz</h3>
  <p>Escribí <b>@nombre</b> (o elegí a alguien en “Para”) para mandarle un <b>mensaje privado</b>: solo lo ven ustedes dos. Con <b>🤫 En secreto</b> le pasás una seña a tu compañero o a un aliado. Con 🎤 hablan por voz y con 📷 ponés tu cara en tu casa del tablero.</p>
  <p class="muted">🎶 ${MUSIC_CREDIT}</p>
  <button class="btn wide" onclick="closeModal()">Entendido</button></div>`);
}

if('serviceWorker' in navigator && location.protocol==='https:') navigator.serviceWorker.register('sw.js').catch(()=>{});
