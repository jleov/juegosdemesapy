'use strict';
/* =====================================================================
   Bolos PY — red (PeerJS), chat con privados, voz, sala de espera,
   pista desde arriba (2D) y en 3D, controles de tiro y sonidos.
   ===================================================================== */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function store(k,v){ try{ if(v===undefined) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
function load(k){ try{ const v=localStorage.getItem(k); return v==null?null:JSON.parse(v); }catch(e){ return null; } }
function toast(x){ const t=$('#toast'); t.textContent=x; t.style.display='block'; clearTimeout(toast.t); toast.t=setTimeout(()=>t.style.display='none', 3800); }
const PREFIX='bolospy26-';
const genCode = () => { const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s=''; for(let i=0;i<5;i++) s+=A[rnd(A.length)]; return s; };
let myToken=load('bolos_token'); if(!myToken){ myToken=Math.random().toString(36).slice(2)+Date.now().toString(36); store('bolos_token', myToken); }
const NET={mode:null, peer:null, code:null, conns:{}, hostConn:null, myPid:null, obs:null, welcomed:false};
let CHAT=[], V=null;
const me = () => NET.myPid || NET.obs;
const amHost = () => NET.mode==='local' || (V && V.hostPid===NET.myPid && NET.mode==='host');
const VP = id => V && (V.players.find(p=>p.id===id) || (V.observers||[]).find(o=>o.id===id));
// ¿este aparato maneja a ese jugador? (en la partida local, todos los que no son bots)
const mine = pid => pid && (pid===me() || (NET.mode==='local' && V && V.players.some(p=>p.id===pid && !p.bot)));

/* ====================== MENÚ ====================== */
let myEmojiSel = load('bolos_emoji') || EMOJIS[0];
const myName = () => ($('#myName').value.trim() || 'Jugador').slice(0,16);
const myEmoji = () => myEmojiSel;
$('#myName').value = load('bolos_name') || '';
$('#myName').addEventListener('input', ()=>store('bolos_name', $('#myName').value.trim()));
function renderTokenPicker(){ $('#tokens').innerHTML = EMOJIS.map(e=>`<button class="tok ${e===myEmojiSel?'sel':''}" onclick="pickEmoji('${e}')">${e}</button>`).join(''); }
function pickEmoji(e){ myEmojiSel=e; store('bolos_emoji', e); renderTokenPicker(); }
renderTokenPicker();
function needName(){ if(!$('#myName').value.trim()){ toast('Escribí tu nombre primero ✍️'); $('#myName').focus(); return true; } store('bolos_name', myName()); return false; }
function joinClick(){ const code=$('#joinCode').value.trim().toUpperCase(); if(!code) return toast('Escribí el código de la sala.'); if(needName()) return; clientJoin(code); }
function resumeClick(){
  const h=load('bolos_host'), c=load('bolos_client');
  if(h && (!c || h.at>=c.at)) return hostStart(true);
  if(c){ if(needName()) return; clientJoin(c.code); }
}
function refreshResume(){ const h=load('bolos_host'), c=load('bolos_client'), ok=x=>x && Date.now()-x.at<6*3600e3; $('#btnResume').style.display = ok(h)||ok(c) ? 'block' : 'none'; }
refreshResume();
(function(){
  const m=(location.hash.slice(1) || new URLSearchParams(location.search).get('sala') || '').toUpperCase();
  if(/^[A-Z0-9]{4,6}$/.test(m)){ $('#joinCode').value=m;
    if(new URLSearchParams(location.search).get('dueno')){ if(!$('#myName').value.trim()) $('#myName').value='Dueño'; setTimeout(()=>clientJoin(m), 300); }
    else toast('Te invitaron a la sala '+m+': escribí tu nombre y tocá “Entrar”.'); }
})();
const savedOpts = () => Object.assign(defaultOpts(), load('bolos_opts')||{});

/* ====================== PANTALLAS ====================== */
function show(id){
  $$('.screen').forEach(s=>s.classList.toggle('on', s.id===id));
  const side=$('#side'), dest = id==='lobby' ? $('#lobbySide') : id==='game' ? $('#gameSide') : null;
  if(dest && side.parentElement!==dest) dest.appendChild(side);
  if(id==='menu') refreshResume();
  if(id==='game') requestAnimationFrame(resizeStage);
}
function localStart(){
  if(needName()) return;
  NET.mode='local'; NET.code=null; CHAT=[];
  S=lobbyState(); S.opts=savedOpts();
  const p=addPlayer(myName(), myEmoji(), myToken, null); NET.myPid=p.id; S.hostPid=p.id;
  addBot();
  sysChat('🎳 Pista en este aparato. Sumá bots 🤖 o amigos que jueguen en el mismo celular o PC, elegí las reglas y tocá Empezar.');
  ANIM.lastN=null; commit(); renderChat();
}
function leaveClick(){
  if(NET.mode==='local'){ if(S && S.phase==='play' && !confirm('¿Salir de la partida?')) return; return leaveToMenu(); }
  if(!confirm('¿Salir de la sala?')) return;
  if(NET.mode==='host'){
    const others=hostCandidates(S);
    if(others.length) return hostHandover();
    store('bolos_host', undefined);
  } else if(NET.mode==='client'){
    if(NET.hostConn && NET.hostConn.open && NET.myPid) try{ NET.hostConn.send({t:'act', a:{type:'leave'}}); }catch(e){}
    store('bolos_client', undefined);
  }
  setTimeout(leaveToMenu, 250);
}
function leaveToMenu(){
  musicStop(); stopMic(false);
  try{ if(NET.peer) NET.peer.destroy(); }catch(e){}
  Object.assign(NET,{mode:null, peer:null, code:null, conns:{}, hostConn:null, myPid:null, obs:null, welcomed:false, backup:null});
  S=null; V=null; CHAT=[]; ANIM.on=false; ANIM.lastN=null; closeModal(); netBar(false);
  history.replaceState(null,'',location.pathname);
  show('menu');
}

/* ====================== RED ====================== */
// el recorrido del tiro pesa: cuando ya terminó de verse, se manda sin él
function lightShot(){ if(S && S.shot && S.shot.bt && Date.now()>S.busyUntil+2500){ const x=S.shot; S.shot={n:x.n, res:x.res, pid:x.pid, side:x.side, frame:x.frame, ball:x.ball, stale:true}; } }
function publicState(forPid){
  const s=JSON.parse(JSON.stringify(S));
  s.players.forEach(p=>delete p.token);
  (s.observers||[]).forEach(o=>delete o.token);
  delete s.ownerTok;
  return s;
}
function commit(){
  lightShot();
  if(NET.mode==='host'){
    for(const pid in NET.conns){ const c=NET.conns[pid]; if(c && c.open) try{ c.send({t:'state', s:publicState(pid)}); }catch(e){} }
    sendBackups();
    if(!NET.noSave){ const s=JSON.parse(JSON.stringify(S)); if(s.shot) s.shot={n:s.shot.n, res:s.shot.res, stale:true}; store('bolos_host', {code:NET.code, S:s, CHAT:CHAT.slice(-80), myPid:NET.myPid, at:Date.now()}); }
  }
  if(S && (NET.mode==='host'||NET.mode==='local') && S.phase==='lobby') store('bolos_opts', S.opts);
  render();
}
function doAct(a){
  if(NET.mode==='client'){ if(NET.hostConn && NET.hostConn.open) NET.hostConn.send({t:'act', a}); else toast('Sin conexión con el anfitrión.'); return; }
  let who=me();
  if(NET.mode==='local' && a.type==='throw' && S && S.phase==='play'){ const sh=shooterOf(S); if(mine(sh)) who=sh; }
  const r=act(who, a); if(typeof r==='string'){ toast(r); if(a.type==='throw') AIM.sent=false; }
}
function newPeer(id){ return new Peer(id, {debug:1, config:{iceServers: window.ICE_SERVERS || [{urls:"stun:stun.l.google.com:19302"}]}}); }
function netBar(on,txt){ const b=$('#netbar'); b.style.display=on?'block':'none'; if(txt) b.textContent=txt; }

// ---------- anfitrión ----------
function hostStart(resume){
  if(!resume && needName()) return;
  const saved = resume ? load('bolos_host') : null;
  NET.mode='host'; NET.code = saved ? saved.code : genCode(); NET.conns={}; NET.noSave=false;
  const peer = NET.peer = newPeer(PREFIX+NET.code);
  peer.on('open', id=>{
    if(saved){
      S=saved.S; CHAT=saved.CHAT||[]; NET.myPid=saved.myPid;
      S.players.forEach(p=>{ if(!p.bot && !p.local){ p.conn = p.id===NET.myPid; p.mic=false; if(!p.conn) p.offAt=Date.now(); } });
      S.observers=[]; P(NET.myPid).peerId=id;
    } else {
      S=lobbyState(); S.opts=savedOpts(); CHAT=[];
      const p=addPlayer(myName(), myEmoji(), myToken, id); NET.myPid=p.id; S.hostPid=p.id;
      sysChat('Sala '+NET.code+' creada. Pasales el código o el enlace a tus amigos.');
    }
    history.replaceState(null,'','#'+NET.code);
    ANIM.lastN=null; commit(); renderChat();
  });
  wireHostPeer(peer, ()=>{
    if(resume){ toast('La sala sigue abierta en otro aparato (otro jugador quedó de anfitrión). Entrá con el código.'); peer.destroy(); store('bolos_host',undefined); NET.mode=null; $('#joinCode').value=NET.code; return; }
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
  store('bolos_host', undefined);
  toast('👑 Mientras no estabas, otro jugador quedó de anfitrión. Volvés a la sala como jugador.');
  const code=NET.code; NET.mode=null; clientJoin(code);
}
function hostOnData(conn, d){
  if(!d || typeof d!=='object' || !S) return;
  if(d.t==='ping'){ try{ conn.send({t:'pong'}); }catch(e){} return; }
  if(d.t==='pong') return;
  if(d.t==='hello'){
    if(d.token===myToken) d.token+='-'+conn.peer;
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
        let emo=EMOJIS.includes(d.emoji)?d.emoji:EMOJIS[0]; if(S.players.some(x=>x.emoji===emo)) emo=EMOJIS.find(e=>!S.players.some(x=>x.emoji===e))||emo;
        p=addPlayer(name, emo, d.token, conn.peer);
        sysChat(`${p.emoji} ${p.name} entró a la sala.`);
      } else {
        why = S.players.length>=MAXP ? 'La pista está llena: entraste a mirar 👀.' : 'La partida ya empezó: entraste a mirar 👀. Te podés sumar cuando termine la partida.';
        ob={id:'o'+(++S.seq), name:nm, emoji:'👀', token:d.token, peerId:conn.peer, conn:true};
        S.observers.push(ob); sysChat(`👀 ${ob.name} entró a mirar.`);
      }
    } else if(p) sysChat(`${p.emoji} ${p.name} se reconectó.`);
    else { why='Volviste a mirar 👀.'; sysChat(`👀 ${ob.name} volvió a mirar.`); }
    const who=p||ob;
    if(NET.conns[who.id] && NET.conns[who.id]!==conn) try{ NET.conns[who.id].close(); }catch(e){}
    conn.pid=who.id; NET.conns[who.id]=conn; who.conn=true; who.peerId=conn.peer; who.mic=false; delete who.offAt;
    if(p) conn.send({t:'welcome', pid:p.id, code:NET.code});
    else conn.send({t:'welcome', pid:null, obs:ob.id, why, code:NET.code});
    conn.send({t:'chatlog', list:chatFor(who.id)});
    commit(); return;
  }
  const pid=conn.pid; if(!pid) return;
  if(d.t==='act'){ const r=act(pid, d.a||{}); if(typeof r==='string') try{ conn.send({t:'err', m:r}); }catch(e){} }
  else if(d.t==='chat') addChat(pid, d.text, d.to);
  else if(d.t==='aim'){ if(S.phase==='play' && shooterOf(S)===pid) relayAim(pid, d.a); }
}
function onSeatChange(oldId, newId){
  if(NET.mode!=='host') return;
  const c=NET.conns[oldId]; if(!c) return;
  delete NET.conns[oldId]; NET.conns[newId]=c; c.pid=newId;
  try{ c.send({t:'welcome', pid:newId, code:NET.code, why:'🪑 ¡Te sentaste a jugar!', force:true}); }catch(e){}
}
function hostOnClose(conn){
  const pid=conn.pid; if(!pid || NET.conns[pid]!==conn || !S) return;
  delete NET.conns[pid];
  const ob=OB(pid);
  if(ob){ S.observers=S.observers.filter(x=>x!==ob); sysChat(`👀 ${ob.name} dejó de mirar.`); commit(); return; }
  const p=P(pid); if(!p) return;
  if(S.phase==='lobby'){ S.players=S.players.filter(x=>x!==p); sysChat(`${p.name} salió de la sala.`); }
  else if(!p.bot){ p.conn=false; p.mic=false; p.offAt=Date.now(); sysChat(`⚠️ ${p.name} se desconectó. Si no vuelve, un bot tira por él en su turno.`); }
  commit();
}
setInterval(()=>{
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

/* ---- traspaso de anfitrión ---- */
const numId = id => +String(id).slice(1);
function hostCandidates(s){ return (s.players||[]).filter(p=>!p.bot && p.id!==s.hostPid && p.conn).sort((a,b)=>numId(a.id)-numId(b.id)); }
function backupState(){ const s=JSON.parse(JSON.stringify(S)); if(s.shot) s.shot={n:s.shot.n, res:s.shot.res, stale:true}; return s; }
function sendBackups(){
  if(NET.mode!=='host' || !S) return;
  const msg={t:'backup', s:backupState(), chat:CHAT.slice(-80)};
  hostCandidates(S).slice(0,2).forEach(p=>{ const c=NET.conns[p.id]; if(c && c.open) try{ c.send(msg); }catch(e){} });
}
function hostHandover(){
  const next=hostCandidates(S)[0]; if(!next) return leaveToMenu();
  const mineP=P(NET.myPid);
  if(mineP){ if(S.phase==='lobby') S.players=S.players.filter(p=>p!==mineP); else { mineP.bot=true; mineP.conn=false; mineP.token=null; log(`🚪 ${mineP.name} se fue: un bot tira por él.`); } }
  const c=NET.conns[next.id];
  try{ c.send({t:'migrate', s:backupState(), chat:CHAT.slice(-80)}); }catch(e){}
  NET.noSave=true; store('bolos_host', undefined);
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
  const mineP=P(NET.myPid), old=P(oldId);
  S.players.forEach(p=>{ if(p.id!==NET.myPid && !p.bot){ p.conn=false; p.mic=false; p.offAt=Date.now(); } });
  S.observers=[];
  if(old && reason!=='handover'){ if(S.phase==='lobby') S.players=S.players.filter(p=>p!==old); }
  S.hostPid=NET.myPid;
  netBar(true,'👑 Tomando el mando de la sala…');
  let tries=0;
  const claim=()=>{
    if(NET.mode!=='host') return;
    const peer=NET.peer=newPeer(PREFIX+NET.code);
    peer.on('open', id=>{
      netBar(false); mineP.peerId=id; mineP.conn=true; delete mineP.offAt;
      sysChat(`👑 ${mineP.name} ahora es el anfitrión${old?` (${old.name} ${reason==='handover'?'salió':'se desconectó'})`:''}. La partida sigue.`);
      toast('👑 Ahora sos el anfitrión: la partida sigue desde tu aparato. No cierres el juego.');
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
  NET.mode='client'; NET.code=code; NET.welcomed=false; NET.hostLost=false; NET.lastHostMsg=Date.now(); CHAT=[]; ANIM.lastN=null;
  const peer = NET.peer = newPeer();
  peer.on('open', ()=>connectHost());
  peer.on('call', onCall);
  peer.on('disconnected', ()=>{ if(!peer.destroyed) setTimeout(()=>{ try{ peer.reconnect(); }catch(e){} },1500); });
  peer.on('error', e=>{
    if(e.type==='peer-unavailable'){
      if(!NET.welcomed){ toast('No se encontró la sala '+code+'. Revisá el código.'); store('bolos_client',undefined); leaveToMenu(); }
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
    store('bolos_client',{code:NET.code, at:Date.now()}); if(location.hash!=='#'+NET.code) history.replaceState(null,'','#'+NET.code);
    if(d.why) toast(d.why);
  }
  else if(d.t==='state'){ S=d.s; render(); }
  else if(d.t==='chat'){ CHAT.push(d.m); renderChat(d.m); }
  else if(d.t==='chatlog'){ CHAT=d.list||[]; renderChat(); }
  else if(d.t==='aim'){ REMOTE_AIM=Object.assign({}, d.a, {pid:d.pid, at:Date.now()}); }
  else if(d.t==='backup'){ NET.backup={s:d.s, chat:d.chat}; }
  else if(d.t==='migrate'){ NET.backup={s:d.s, chat:d.chat}; takeoverHost('handover'); }
  else if(d.t==='kicked'){ toast('🚪 El anfitrión te sacó de la pista.'); store('bolos_client',undefined); leaveToMenu(); }
  else if(d.t==='err'){ toast(d.m); AIM.sent=false; }
}
// la mira del que está tirando se ve en vivo en los otros aparatos
let REMOTE_AIM=null;
function relayAim(pid, a){
  if(!a) return;
  const x={x:+a.x||0, ang:+a.ang||0, pow:+a.pow||0, spin:+a.spin||0};
  if(pid!==me()) REMOTE_AIM=Object.assign({}, x, {pid, at:Date.now()});
  for(const id in NET.conns){ if(id===pid) continue; const c=NET.conns[id]; if(c && c.open) try{ c.send({t:'aim', a:x, pid}); }catch(e){} }
}
function sendAim(){
  if(NET.mode==='local' || !V || V.phase!=='play') return;
  const now=Date.now(); if(now-(sendAim.t||0)<90) { clearTimeout(sendAim.tm); sendAim.tm=setTimeout(sendAim, 100); return; }
  sendAim.t=now;
  const a={x:AIM.x, ang:AIM.ang, pow:AIM.pow, spin:AIM.spin};
  if(NET.mode==='client'){ if(NET.hostConn && NET.hostConn.open) try{ NET.hostConn.send({t:'aim', a}); }catch(e){} }
  else if(NET.mode==='host') relayAim(me(), a);
}

/* ====================== CHAT ====================== */
let chatSeq=0;
const people = () => S ? [...S.players, ...(S.observers||[])] : [];
const chatFor = pid => CHAT.filter(m=>!m.to || m.to===pid || m.from===pid).slice(-80);
function addChat(pid, text, to){
  text=String(text||'').trim().slice(0,300); if(!text || !S) return;
  const w=P(pid)||OB(pid); if(!w) return;
  let t = to ? (P(to)||OB(to)) : null;
  if(!t && text[0]==='@'){
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
    if(m.to && pid!==m.to && pid!==m.from) continue;
    const c=NET.conns[pid]; if(c&&c.open) try{ c.send({t:'chat', m}); }catch(e){}
  }
  renderChat(m);
}
function chatLine(m){
  if(m.sys) return `<div class="msg sys">${esc(m.x)}</div>`;
  const mineM=m.from===me();
  const x=esc(m.x).replace(/(^|\s)@([^\s]+)/g,'$1<span class="at">@$2</span>');
  if(m.to){
    const hdr = mineM ? `🔒 Privado para ${esc(m.toN)}` : `🔒 Privado de ${esc(m.n)} para vos`;
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
    if(!m.sys && !m.to) bubble(m);
    if(!m.sys && m.from!==myId){
      if(!sideVisible('chat')){ UNREAD++; refreshUnread(); }
      if(m.to){ sfx.priv(); if(!sideVisible('chat')) toast(`🔒 ${m.n} te escribió en privado: ${m.x.slice(0,80)}`); }
    }
  } else el.innerHTML=CHAT.filter(vis).map(chatLine).join('');
  el.scrollTop=el.scrollHeight;
}
// globito arriba de la pista con lo último que dijeron
function bubble(m){
  if(!$('#game').classList.contains('on')) return;
  const box=$('#bubbles'), d=document.createElement('div');
  d.className='bub'; d.innerHTML=`<b style="color:${esc(m.c)}">${esc(m.e)} ${esc(m.n)}:</b> ${esc(m.x.slice(0,100))}`;
  box.appendChild(d); while(box.children.length>3) box.firstChild.remove();
  setTimeout(()=>{ d.classList.add('out'); setTimeout(()=>d.remove(), 500); }, 5000);
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
  if(open) setTab('chat');
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
function sendChat(){ const i=$('#chatText'), text=i.value.trim(); if(!text) return; sendChatRaw(text, $('#chatTo').value); i.value=''; atClose(); }
function quick(t){ sendChatRaw(t, $('#chatTo').value); }
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
  e.stopPropagation();
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
const SND={on:load('bolos_snd')!==false, ctx:null};
function actx(){ if(!SND.ctx){ try{ SND.ctx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } if(SND.ctx && SND.ctx.state==='suspended') SND.ctx.resume(); return SND.ctx; }
function tone(f, d, type, v, when){
  if(!SND.on) return; const c=actx(); if(!c) return;
  const t=c.currentTime+(when||0), o=c.createOscillator(), g=c.createGain();
  o.type=type||'sine'; o.frequency.setValueAtTime(f,t); g.gain.setValueAtTime(v||.12,t); g.gain.exponentialRampToValueAtTime(.001,t+d);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t+d+.02);
}
function noise(d, v, when, hp, lp){
  if(!SND.on) return; const c=actx(); if(!c) return;
  const t=c.currentTime+(when||0), b=c.createBuffer(1, Math.max(1,c.sampleRate*d|0), c.sampleRate), ch=b.getChannelData(0);
  for(let i=0;i<ch.length;i++) ch[i]=(Math.random()*2-1)*Math.pow(1-i/ch.length, 3);
  const s=c.createBufferSource(), g=c.createGain(), f=c.createBiquadFilter(); f.type=lp?'lowpass':'highpass'; f.frequency.value=lp||hp||1800;
  s.buffer=b; g.gain.value=v||.2; s.connect(f).connect(g).connect(c.destination); s.start(t);
}
const sfx={
  release(p){ noise(.12,.18+p*.2,0,0,400); tone(60,.18,'sine',.12); },
  pin(v){ tone(1100+rnd(900),.06,'triangle',.04+v*.12); noise(.05,.06+v*.3,0,2500); },
  hit(v){ tone(140,.14,'sine',.12+v*.2); noise(.12,.2+v*.45,0,900); noise(.2,.08+v*.2,.03,3000); },
  wall(v){ tone(90,.1,'sine',.05+v*.15); noise(.06,.05+v*.15,0,0,600); },
  gutter(){ noise(.25,.12,0,0,300); tone(70,.3,'sine',.08); },
  turn(){ tone(740,.12,'sine',.12); tone(988,.18,'sine',.12,.11); },
  strike(){ [523,659,784,1047,1319].forEach((f,i)=>tone(f,.25,'square',.06,i*.08)); },
  spare(){ [659,880,1175].forEach((f,i)=>tone(f,.22,'triangle',.12,i*.09)); },
  bad(){ tone(300,.2,'sawtooth',.06); tone(200,.3,'sawtooth',.06,.18); },
  win(){ [523,659,784,1047].forEach((f,i)=>tone(f,.3,'triangle',.14,i*.13)); },
  priv(){ tone(1200,.08,'sine',.08); tone(1500,.1,'sine',.08,.08); },
};
// el ruido de la bola rodando por la madera (dura lo que rueda)
const ROLL={src:null, g:null};
function rollStart(){
  if(!SND.on || ROLL.src) return; const c=actx(); if(!c) return;
  const b=c.createBuffer(1, c.sampleRate*2, c.sampleRate), ch=b.getChannelData(0); let l=0;
  for(let i=0;i<ch.length;i++){ l=(l+.04*(Math.random()*2-1))/1.04; ch[i]=l*3.2; }
  const s=c.createBufferSource(), f=c.createBiquadFilter(), g=c.createGain();
  s.buffer=b; s.loop=true; f.type='lowpass'; f.frequency.value=260; g.gain.value=0.0001;
  s.connect(f).connect(g).connect(c.destination); s.start(); g.gain.exponentialRampToValueAtTime(.35, c.currentTime+.25);
  ROLL.src=s; ROLL.g=g;
}
function rollStop(){ if(!ROLL.src) return; const c=actx(), s=ROLL.src, g=ROLL.g; ROLL.src=null; try{ g.gain.setValueAtTime(g.gain.value, c.currentTime); g.gain.exponentialRampToValueAtTime(.0001, c.currentTime+.3); s.stop(c.currentTime+.35); }catch(e){} }
function toggleSound(){ SND.on=!SND.on; store('bolos_snd', SND.on); $('#btnSnd').textContent=SND.on?'🔊':'🔇'; if(SND.on) sfx.turn(); }
$('#btnSnd').textContent=SND.on?'🔊':'🔇';
document.addEventListener('pointerdown', ()=>actx(), {once:true});
const MUSIC_CREDIT = 'Música: "Monkeys Spinning Monkeys" de Kevin MacLeod (incompetech.com). Licencia Creative Commons Atribución 4.0: creativecommons.org/licenses/by/4.0/';
const MUSIC = { on: load('bolos_music')===true, buf:null, src:null, gain:null, loading:false, VOL:.07 };
function musicLoad(){
  if(MUSIC.buf || MUSIC.loading) return Promise.resolve(); MUSIC.loading=true;
  const c=actx(); if(!c){ MUSIC.loading=false; return Promise.resolve(); }
  return fetch('../petei/musica.mp3').then(r=>r.arrayBuffer()).then(b=>c.decodeAudioData(b)).then(buf=>{ MUSIC.buf=buf; }).catch(()=>{ MUSIC.loading=false; });
}
function musicStart(){
  if(!MUSIC.on || MUSIC.src) return;
  musicLoad().then(()=>{
    if(!MUSIC.buf || MUSIC.src || !MUSIC.on || !musicWanted()) return;
    const c=actx(), s=c.createBufferSource(), g=c.createGain();
    s.buffer=MUSIC.buf; s.loop=true; s.connect(g); g.connect(c.destination);
    g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.exponentialRampToValueAtTime(MUSIC.VOL, c.currentTime+2.5);
    s.start(); MUSIC.src=s; MUSIC.gain=g;
  });
}
function musicStop(){
  if(!MUSIC.src) return;
  const c=actx(), s=MUSIC.src, g=MUSIC.gain; MUSIC.src=null; MUSIC.gain=null;
  try{ g.gain.setValueAtTime(g.gain.value, c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime+.8); s.stop(c.currentTime+.85); }catch(e){}
}
const musicWanted = () => !!S && !!NET.mode;
function musicSync(){ if(MUSIC.on && musicWanted()) musicStart(); else musicStop(); renderMusicBtn(); }
function toggleMusic(){ MUSIC.on=!MUSIC.on; store('bolos_music', MUSIC.on); musicSync(); toast(MUSIC.on?'🎶 Música de fondo prendida (suave).':'🔕 Música de fondo apagada.'); }
function renderMusicBtn(){ $$('.btnMusic').forEach(b=>{ b.textContent = MUSIC.on ? '🎶' : '🔕'; b.title = MUSIC.on ? 'Apagar la música de fondo' : 'Prender la música de fondo'; }); }
renderMusicBtn(); $('#musicCredit').textContent='🎶 '+MUSIC_CREDIT;


/* ====================== RENDER GENERAL ====================== */
function render(){
  if(!S) return;
  V = NET.mode==='client' ? S : publicState(me());
  if(V.phase==='lobby'){ show('lobby'); renderLobby(); }
  else { show('game'); renderGame(); }
  renderSidePanels(); renderChatTo(); renderVoice(); voiceSync(); musicSync();
}
function playerTag(p){
  const host=p.id===V.hostPid;
  return `<span class="dot" style="background:${p.color}"></span><span style="font-size:20px">${esc(p.emoji)}</span><span class="nm">${esc(p.name)}${p.id===me()?' <span class="muted">(vos)</span>':''}</span>`
    + `${host&&NET.mode!=='local'?'👑':''}${p.bot?'🤖':''}${p.local&&!p.bot?'📱':''}${p.mic?'🎙️':''}${!p.bot&&!p.conn?'⚠️':''}`;
}
const ballDot = (c, sz) => `<span class="bdot" style="--bc:${c};${sz?`--s:${sz}px`:''}"></span>`;

// ---------- sala de espera ----------
function renderLobby(){
  const host=amHost(), myObs=!!NET.obs, o=V.opts, eq=o.fmt!=='ind';
  $('#lobbyCode').textContent=NET.code||'—';
  $('#lobbyCodeBox').style.display = NET.mode==='local' ? 'none' : '';
  $('#lobbyTitle').textContent = NET.mode==='local' ? '🎳 Pista en este aparato' : '🎳 Sala de espera';
  $('#pcount').textContent=`(${V.players.length}/${MAXP})`;
  const teamBtn = p => eq ? `<button class="tbtn" style="background:${TEAMS[p.team].c}" ${host||p.id===me()?`onclick="doAct({type:'team',pid:'${p.id}'})"`:'disabled'} title="Cambiar de equipo">${TEAMS[p.team].e}</button>` : '';
  const ballBtn = p => `<button class="bbtn" ${mine(p.id)||host&&p.bot?`onclick="ballModal('${p.id}')"`:'disabled'} title="Color de la bola">${ballDot(p.ball,24)}</button>`;
  const hcp = p => host ? `<label class="hcp" title="Hándicap: puntos que se le suman al final">HCP<input type="number" min="0" max="250" value="${p.hc||0}" onchange="doAct({type:'hc',pid:'${p.id}',v:this.value})"></label>` : p.hc ? `<span class="muted">HCP ${p.hc}</span>` : '';
  $('#plist').innerHTML=V.players.map(p=>`<li>${teamBtn(p)}${ballBtn(p)}${playerTag(p)}${hcp(p)}${host && p.id!==V.hostPid?`<button class="btn sm gray" onclick="doAct({type:'kick',pid:'${p.id}'})" title="Sacar">✕</button>`:''}</li>`).join('')
    + (V.observers||[]).map(x=>`<li style="opacity:.75"><span style="font-size:20px">👀</span><span class="nm">${esc(x.name)} <span class="muted">mirando</span></span>${x.mic?'🎙️':''}</li>`).join('');
  const err=canStartV();
  $('#lobbyHostBtns').innerHTML = host
    ? `<div class="row"><button class="btn gray" onclick="doAct({type:'addBot'})" ${V.players.length>=MAXP?'disabled':''}>🤖 Sumar bot</button>
       ${NET.mode==='local'?`<button class="btn gray" onclick="addLocalClick()" ${V.players.length>=MAXP?'disabled':''}>🙋 Amigo en este aparato</button>`:''}
       <button class="btn green" onclick="doAct({type:'start'})">▶️ Empezar</button></div>
       <p class="muted">${err?'⚠️ '+esc(err):'¡Listo para empezar!'}${eq?' · Tocá 🔴/🔵 para cambiar a alguien de equipo.':''} · Tocá la bola para cambiarle el color.</p>`
    : `<p class="muted" style="text-align:center">⏳ Esperando que el anfitrión 👑 empiece la partida…<br>Tocá tu bola para elegir el color${eq?' y tu 🔴/🔵 para cambiarte de equipo':''}.</p>`;
  $('#lobbyObs').innerHTML = myObs ? `<div class="obsbar" style="border-radius:10px;margin-top:8px">👀 Estás mirando. ${V.players.length<MAXP?`<button class="btn sm gold" onclick="doAct({type:'joinNext'})">🎳 Sumarme a jugar</button>`:'La pista está llena.'}</div>` : '';
  $('#optsBox').innerHTML = optsHTML(host);
  const g=$('#grulesBox');
  if(host){
    if(!g.querySelector('textarea')) g.innerHTML=`<textarea id="grulesIn" maxlength="1200" placeholder="Ej.: el que hace menos puntos paga la gaseosa 🥤&#10;Si pisás la línea, ese tiro vale cero…"></textarea><p class="muted" style="margin:4px 0 0">Se guarda solo y lo ven todos.</p>`;
    const ta=$('#grulesIn'); if(document.activeElement!==ta) ta.value=V.grules||'';
    ta.oninput=()=>{ clearTimeout(ta.t); ta.t=setTimeout(()=>doAct({type:'grules', text:ta.value}), 600); };
  } else g.innerHTML = V.grules ? `<div class="grules">${esc(V.grules)}</div>` : `<p class="muted">El anfitrión todavía no escribió reglas propias.</p>`;
  $('#sugBox').innerHTML = sugsHTML(host);
}
function canStartV(){ const keep=S; S=V; try{ return canStart(); } finally{ S=keep; } }
function addLocalClick(){ const n=prompt('Nombre del amigo que juega en este aparato:'); if(n && n.trim()) doAct({type:'addLocal', name:n.trim()}); }
function ballModal(pid){
  const p=V.players.find(x=>x.id===pid); if(!p) return;
  modal(`<h2>🎳 Color de la bola de ${esc(p.name)}</h2><div class="balls">${BALLS.map(c=>`<button onclick="doAct({type:'ballc',pid:'${pid}',c:'${c}'});closeModal()">${ballDot(c,46)}</button>`).join('')}</div><button class="btn gray wide" onclick="closeModal()">Cerrar</button>`);
}
function optsHTML(host){
  const o=V.opts, dis = host && V.phase==='lobby' ? '' : 'disabled';
  const sel=(k, list)=>`<select ${dis} onchange="doAct({type:'opt',k:'${k}',v:this.value})">${list.map(x=>`<option value="${x.v}" ${o[k]==x.v?'selected':''}>${x.t}</option>`).join('')}</select>`;
  const num=(k, t, min, max)=>`<label class="numopt">${t}<input type="number" min="${min}" max="${max}" value="${o[k]}" ${dis} onchange="doAct({type:'opt',k:'${k}',v:this.value})"></label>`;
  const chk=(k, t, d)=>`<label class="opt" style="margin:0 0 6px;font-weight:400"><input type="checkbox" ${o[k]?'checked':''} ${dis} onchange="doAct({type:'opt',k:'${k}',v:this.checked})"><span><b>${t}</b><small>${d}</small></span></label>`;
  const obj=(O)=>Object.keys(O).map(k=>({v:k, t:O[k].t||O[k]}));
  return `<label style="margin-top:0">Modo de juego ${host?'':'<span class="muted">(lo elige el anfitrión)</span>'}</label>${sel('mode', obj(MODES))}
    <p class="muted" style="margin:4px 0 0">${esc(MODES[o.mode].d)}</p>
    ${o.mode!=='spares'?`<label>🧮 Cómo se cuentan los puntos</label>${sel('score', obj(SCORES))}<p class="muted" style="margin:4px 0 0">${esc(SCORES[o.score].d)}</p>`:''}
    ${o.mode!=='spares'&&o.score==='custom'?`<div class="custom">${num('pp','Cada pino vale',1,10)}${num('sb','Strike suma extra',0,50)}${num('spb','Spare suma extra',0,50)}
      ${chk('bon','Bonus de los tiros siguientes','Como en el tradicional: el strike suma los 2 tiros siguientes y el spare el siguiente (y hay tiros extra en el último cuadro).')}</div>`:''}
    <label>Cómo se juega</label>${sel('fmt', Object.keys(FORMATS).map(k=>({v:k, t:FORMATS[k]})))}
    <label>Largo de la partida</label>${sel('frames', FRAMES)}
    <label>Líneas</label>${sel('lines', LINES)}
    <label>🛢️ Estado de la pista</label>${sel('oil', obj(OILS))}
    <label>🎯 Dificultad (ayuda para apuntar)</label>${sel('aim', AIMS)}
    <label>⏰ Tiempo para tirar</label>${sel('timer', TIMERS)}
    <label>Nivel de los bots</label>${sel('bot', BOTLV)}
    <label>Reglas de la casa</label>`
    + HOUSE.filter(h=>o.mode!=='spares' || h.k==='bumpers').map(h=>chk(h.k, h.t, h.d)).join('')
    + (o.gold && o.mode!=='spares' ? num('goldPts','🌟 Puntos del pino dorado',1,50) : '');
}
function sugsHTML(host){
  const list=(V.sugs||[]).slice().sort((a,b)=>b.votes.length-a.votes.length);
  if(!list.length) return '<p class="muted">Todavía no hay sugerencias. ¡Proponé la primera!</p>';
  return list.map(s=>`<div class="sug"><span class="t">${esc(s.text)}<small>${esc(s.e)} ${esc(s.by)}</small></span>
    <button class="vote ${s.votes.includes(me())?'on':''}" onclick="doAct({type:'vote',id:'${s.id}'})">👍 ${s.votes.length}</button>
    ${host?`<button class="vote" onclick="doAct({type:'sugDel',id:'${s.id}'})" title="Borrar">🗑️</button>`:''}</div>`).join('');
}
function sendSug(id){ const i=$('#'+id); const t=i.value.trim(); if(!t) return toast('Escribí la regla que querés sugerir.'); doAct({type:'suggest', text:t}); i.value=''; toast('💡 ¡Sugerencia enviada! Los demás la pueden votar.'); }

/* ====================== PARTIDA ====================== */
const AIM=Object.assign({x:C+20, ang:-.012, pow:0, spin:-.45, sent:false, key:null, charging:false}, load('bolos_aim')||{});
AIM.pow=0; AIM.sent=false; AIM.key=null; AIM.charging=false;
function saveAim(){ store('bolos_aim', {x:AIM.x, ang:AIM.ang, spin:AIM.spin}); }
const ANIM={on:false, lastN:null, t0:0, shot:null, evI:0, fallF:{}, outF:{}, end:0};
const curShooter = () => V && V.phase==='play' ? shooterOf(V) : null;
const myTurn = () => !!V && V.phase==='play' && !ANIM.on && mine(curShooter()) && !NET.obs;

function renderGame(){
  $('#roomTag').textContent = NET.mode==='local' ? '📱 En este aparato' : '🔑 '+NET.code;
  $('#obsbar').style.display = NET.obs ? 'block' : 'none';
  if(NET.obs) $('#obsbar').textContent = '👀 Estás mirando la partida.';
  if(ANIM.lastN==null) ANIM.lastN = V.shot ? V.shot.n : 0;   // al entrar no se repite el último tiro
  else if(V.shot && V.shot.n!==ANIM.lastN){
    ANIM.lastN=V.shot.n;
    if(V.shot.bt) startAnim(V.shot);
    AIM.sent=false;
  }
  const key = V.phase==='play' ? `${V.line}|${V.frame}|${V.cur}|${V.ball}|${V.shotN}` : null;
  if(key && key!==AIM.key){ AIM.key=key; AIM.pow=0; AIM.sent=false; paintPower(); CAM3.follow=true; }
  renderScore(); renderCtrl(); renderPinHud();
  if(!ANIM.on) afterShotUI();
}

// ---------- planilla ----------
function frameCells(st, sd, f, cum){
  const o=st.opts, N=o.frames, fr=sd.frames[f], last=f===N-1;
  const nb = o.mode==='spares' ? 1 : last && hasBonusBalls(o) ? 3 : 2;
  const m = fr ? fr.m.slice() : [];
  let boxes=[];
  if(!last && m[0]==='X' && o.mode!=='spares') boxes=['','X'];
  else for(let k=0;k<nb;k++) boxes.push(m[k]||'');
  const cls=(k,v)=>`${v==='X'?'x':v==='/'?'s':''}${k===0&&fr&&fr.sp?' sp':''}`;
  return `<td class="fr${fr&&!fr.done?' now':''}${fr&&fr.auto?' auto':''}"><div class="bx">${boxes.map((v,k)=>`<i class="${cls(k,v)}">${v}</i>`).join('')}</div><div class="cm">${cum!=null?cum:''}${fr&&fr.g?'<span class="gd">🌟</span>':''}${fr&&fr.tk?'<span class="gd">🦃</span>':''}</div></td>`;
}
function sheetHTML(st, mark){
  const o=st.opts, N=o.frames;
  const head=`<tr><th class="nmh"></th>${[...Array(N)].map((_,f)=>`<th>${f+1}</th>`).join('')}<th>Total</th>${o.lines>1?'<th>Serie</th>':''}</tr>`;
  const rows=st.sides.map((sd,i)=>{
    const sc=scoreSide(st, sd), hc=sideHc(st, sd);
    const color = sd.team!=null ? TEAMS[sd.team].c : (st.players.find(p=>p.id===sd.pids[0])||{}).color||'#888';
    const names = sd.team!=null ? `${TEAMS[sd.team].e} ${sd.pids.map(pid=>{ const p=st.players.find(x=>x.id===pid); return p?`<span class="${pid===curShooter()&&st.phase==='play'?'shoot':''}">${esc(p.name)}</span>`:''; }).join(', ')}`
      : (()=>{ const p=st.players.find(x=>x.id===sd.pids[0])||{}; return `${ballDot(p.ball||'#888',14)} ${esc(p.emoji||'')} ${esc(p.name||'?')}${p.bot?'🤖':''}${!p.bot&&p.conn===false?'⚠️':''}${p.mic?'🎙️':''}`; })();
    const serie = o.lines>1 ? `<td class="tt">${sd.lines.reduce((a,b)=>a+b,0)}${st.phase==='play'?'+':''}</td>` : '';
    return `<tr class="${i===st.cur&&st.phase==='play'?'on':''} ${sd.out?'out':''}" style="--pc:${color}"><td class="nmc">${names}</td>${[...Array(N)].map((_,f)=>frameCells(st, sd, f, sc.cum[f])).join('')}
      <td class="tt">${sc.prov+hc}${hc?`<small>HCP ${hc}</small>`:''}</td>${serie}</tr>`;
  }).join('');
  return `<table class="sheet${mark?' big':''}">${head}${rows}</table>`;
}
function renderScore(){
  const el=$('#score'); el.innerHTML=sheetHTML(V);
  const on=el.querySelector('tr.on'); if(on && el.scrollHeight>el.clientHeight) el.scrollTop=on.offsetTop-24;
}
function sheetModal(){ modal(`<h2>📋 Planilla</h2><div style="overflow-x:auto">${sheetHTML(V,true)}</div><p class="muted">${esc(MODES[V.opts.mode].t)} · ${esc(SCORES[V.opts.score].t)} · línea ${V.line} de ${V.opts.lines}</p><button class="btn gray wide" onclick="closeModal()">Cerrar</button>`); }

// ---------- pinos que quedan (dibujito) ----------
function renderPinHud(){
  const box=$('#pinhud'); if(!V || V.phase==='lobby') return;
  const d=dispState(), byI={}; d.pins.forEach(p=>byI[p.i]=p);
  const gold = ANIM.on ? ANIM.shot.gold : V.gold;
  box.innerHTML=PIN_SPOTS.map(([x,y],i)=>{
    const p=byI[i], st = !p ? 'gone' : p.tilt>0 ? 'fall' : 'up';
    return `<i class="${st}${gold===i&&st!=='gone'?' gold':''}" style="left:${50+(x-C)/SP*12}%;top:${80-(y-HEAD)/ROW*24}%">${i+1}</i>`;
  }).join('');
}

// ---------- controles ----------
function renderCtrl(){
  const my=myTurn(), sh=curShooter(), p=V.players.find(x=>x.id===sh), o=V.opts;
  let st='';
  if(V.phase==='play'){
    const fr=`cuadro ${V.frame+1}/${o.frames}${o.mode==='spares'?` · ${LEAVES[V.leaves[V.frame]].n}`:` · tiro ${V.ball+1}`}`;
    if(ANIM.on) st='🎳 …';
    else if(my){
      const who = NET.mode==='local' && V.players.filter(x=>!x.bot).length>1 ? `<b>${esc(p.name)}</b>, ` : '';
      st = `${who}te toca · ${fr}`;
    } else st = `Tira <b>${esc(p?p.name:'?')}</b>${p&&p.bot?' 🤖':''} · ${fr}`;
    if(o.timer && !ANIM.on && p && !p.bot){ const left=Math.max(0, Math.ceil((Math.max(V.turnAt, V.busyUntil)+o.timer*1000-Date.now())/1000)); st+=` · ⏰ ${left}s`; }
  } else if(V.phase==='lineEnd' || V.phase==='over') st='🏆 Fin de la línea';
  $('#status').innerHTML=st;
  $('#ctrl').classList.toggle('dis', !my);
  $('#spin').value=Math.round(AIM.spin*100); paintSpin();
}
setInterval(()=>{
  // si la pestaña estuvo escondida la animación no avanza: igual se cierra para no trabar el turno
  if(ANIM.on && animFrame()>ANIM.end+45){ ANIM.on=false; rollStop(); afterShotUI(true); renderScore(); renderCtrl(); renderPinHud(); }
  if(V && V.phase==='play' && V.opts.timer && $('#game').classList.contains('on')) renderCtrl();
}, 1000);
function paintSpin(){ const v=Math.round(AIM.spin*100); $('#spinTxt').textContent = v===0 ? 'derecha' : v<0 ? `↶ ${-v}%` : `↷ ${v}%`; }
$('#spin').addEventListener('input', e=>{ AIM.spin=(+e.target.value)/100; paintSpin(); saveAim(); sendAim(); });
const clampX = x => Math.max(BR*.5, Math.min(LW-BR*.5, x));
function moveX(d){ if(!myTurn()) return; AIM.x=clampX(AIM.x+d); saveAim(); sendAim(); }
function turnAim(d){ if(!myTurn()) return; AIM.ang=Math.max(-MAXANG, Math.min(MAXANG, AIM.ang+d)); saveAim(); sendAim(); }
(function(){
  const fs=$('#fine'); let lx=null;
  fs.addEventListener('pointerdown', e=>{ if(!myTurn()) return; fs.setPointerCapture(e.pointerId); lx=e.clientX; });
  fs.addEventListener('pointermove', e=>{ if(lx==null) return; const d=e.clientX-lx; lx=e.clientX; turnAim(d*.00008); fs.style.backgroundPositionX=(parseFloat(fs.style.backgroundPositionX||0)+d)+'px'; });
  const end=()=>{ lx=null; }; fs.addEventListener('pointerup', end); fs.addEventListener('pointercancel', end);
  const hold=(btn, fn)=>{ let t=null; const go=()=>{ fn(); t=setTimeout(go, t?45:350); };
    btn.addEventListener('pointerdown', e=>{ e.preventDefault(); if(!myTurn()) return; t=null; go(); });
    ['pointerup','pointerleave','pointercancel'].forEach(k=>btn.addEventListener(k, ()=>{ clearTimeout(t); t=null; })); };
  hold($('#aimL'), ()=>turnAim(-.0006)); hold($('#aimR'), ()=>turnAim(.0006));
  hold($('#posL'), ()=>moveX(-BOARD)); hold($('#posR'), ()=>moveX(BOARD));
})();
// fuerza: se tira para abajo y se suelta
(function(){
  const bar=$('#power'); let y0=null;
  const set=e=>{ const r=bar.getBoundingClientRect(); AIM.pow=Math.max(0, Math.min(1, (e.clientY-y0)/(r.height*.85))); paintPower(); sendAim(); };
  bar.addEventListener('pointerdown', e=>{ if(!myTurn() || AIM.sent) return; e.preventDefault(); bar.setPointerCapture(e.pointerId); y0=e.clientY; AIM.charging=true; AIM.pow=0; paintPower(); });
  bar.addEventListener('pointermove', e=>{ if(y0!=null) set(e); });
  bar.addEventListener('pointerup', ()=>{ if(y0==null) return; y0=null; AIM.charging=false; if(AIM.pow>.03) shoot(); else { AIM.pow=0; paintPower(); } });
  bar.addEventListener('pointercancel', ()=>{ y0=null; AIM.charging=false; AIM.pow=0; paintPower(); });
})();
function paintPower(){ $('#powFill').style.height=(AIM.pow*100)+'%'; $('#powTxt').textContent = AIM.pow>0 ? Math.round(AIM.pow*100)+'%' : '⬇️'; }
function shoot(){
  if(!myTurn() || AIM.sent) return;
  AIM.sent=true; saveAim();
  doAct({type:'throw', x:AIM.x, ang:AIM.ang, pow:AIM.pow, spin:AIM.spin});
  setTimeout(()=>{ AIM.pow=0; paintPower(); }, 200);
}
const KEYPOW={t0:0};   // con la barra espaciadora la fuerza sube y baja: soltás cuando querés
document.addEventListener('keydown', e=>{
  if(!V || V.phase!=='play' || !$('#game').classList.contains('on') || e.target.tagName==='INPUT' || e.target.tagName==='TEXTAREA' || e.target.tagName==='SELECT') return;
  const k=e.key.toLowerCase();
  if(k==='arrowleft'||k==='arrowright'){ e.preventDefault(); turnAim((k==='arrowleft'?-1:1)*(e.shiftKey?.0002:.0012)); }
  if(k==='a'||k==='d'){ moveX((k==='a'?-1:1)*BOARD); }
  if(k==='q'||k==='e'){ if(myTurn()){ AIM.spin=Math.max(-1,Math.min(1,AIM.spin+(k==='q'?-.05:.05))); renderCtrl(); saveAim(); sendAim(); } }
  if(e.key===' ' && myTurn() && !e.repeat){ e.preventDefault(); KEYPOW.t0=performance.now(); AIM.charging=true; }
});
document.addEventListener('keyup', e=>{ if(e.key===' ' && KEYPOW.t0){ const p=AIM.pow; KEYPOW.t0=0; AIM.charging=false; if(p>.03) shoot(); } });
function keyPowTick(){ if(KEYPOW.t0 && myTurn()){ const t=(performance.now()-KEYPOW.t0)/1100; AIM.pow=Math.abs(((t+1)%2)-1); paintPower(); } }

// ---------- animación del tiro ----------
function startAnim(shot){
  ANIM.on=true; ANIM.shot=shot; ANIM.t0=performance.now(); ANIM.evI=0; ANIM.fallF={}; ANIM.outF={}; ANIM.end=shot.frames+28;
  (shot.ev||[]).forEach(e=>{ if(e.k==='f') ANIM.fallF[e.i]={f:e.f, a:e.a}; if(e.k==='o') ANIM.outF[e.i]=e.f; });
  if(shot.pid!==me() || NET.mode==='local') sfx.release(shot.th?shot.th.pow:.6);
  rollStart(); REMOTE_AIM=null; CAM3.shotStart=performance.now(); R3.anBall=null;
}
const animFrame = () => (performance.now()-ANIM.t0)/1000*30;
function trackAt(t, f){
  const n=t.length/2, k=Math.floor(f);
  if(k>=n-1) return [t[(n-1)*2]/10, t[(n-1)*2+1]/10];
  const a=f-k; return [(t[k*2]+(t[k*2+2]-t[k*2])*a)/10, (t[k*2+1]+(t[k*2+3]-t[k*2+1])*a)/10];
}
// lo que se ve ahora: la bola (si está rodando o en la mano) y los pinos con su caída
function dispState(){
  if(ANIM.on){
    const sh=ANIM.shot, f=animFrame();
    while(ANIM.evI<(sh.ev||[]).length && sh.ev[ANIM.evI].f<=f){ const e=sh.ev[ANIM.evI++];
      if(e.k==='h'){ sfx.hit(e.v); rollStop(); } else if(e.k==='p') sfx.pin(e.v); else if(e.k==='w') sfx.wall(e.v); else if(e.k==='g') sfx.gutter(); }
    if(f>=sh.frames-2) rollStop();
    if(f>=ANIM.end){ ANIM.on=false; rollStop(); afterShotUI(true); renderScore(); renderCtrl(); renderPinHud(); }
    else {
      const nb=sh.bt.length/2, [bx,by]=trackAt(sh.bt, Math.min(f, nb-1));
      const pins=[];
      sh.from.forEach((p0,i)=>{ if(!p0.up || !sh.pt[i]) return;
        const out=ANIM.outF[i]; if(out!=null && f>=out+4) return;
        const [x,y]=trackAt(sh.pt[i], f), fl=ANIM.fallF[i];
        pins.push({i, x, y, tilt: fl && f>=fl.f ? Math.min(1,(f-fl.f)/5) : 0, a: fl?fl.a:0, sink: out!=null && f>=out ? (f-out)/4 : 0});
      });
      return {ball: f<nb+2 && by<PIT+20 ? {x:bx, y:by, f} : null, pins, rolling:true};
    }
  }
  const pins=V.pins.map((p,i)=>p.up?{i, x:p.x, y:p.y, tilt:0, a:0, sink:0}:null).filter(Boolean);
  let ball=null;
  if(V.phase==='play'){
    const sh=curShooter();
    if(mine(sh) && !NET.obs) ball={x:AIM.x, y:-BR-4, held:true};
    else if(REMOTE_AIM && REMOTE_AIM.pid===sh) ball={x:REMOTE_AIM.x, y:-BR-4, held:true};
    else ball={x:C, y:-BR-4, held:true};
  }
  return {ball, pins, rolling:false};
}
const aimNow = () => { const sh=curShooter(); if(mine(sh) && !NET.obs) return {x:AIM.x, ang:AIM.ang, pow:AIM.pow, spin:AIM.spin, me:true}; if(REMOTE_AIM && REMOTE_AIM.pid===sh) return REMOTE_AIM; return null; };
let LASTRES=null;
function afterShotUI(justEnded){
  if(!V || !V.shot || !V.shot.res) return;
  if(LASTRES===V.shot.n) return; LASTRES=V.shot.n;
  if(!justEnded){ endModal(); return; }
  const r=V.shot.res;
  if(r.turkey){ bigText('🦃 ¡PAVO!'); sfx.strike(); }
  else if(r.strike){ bigText('💥 ¡STRIKE!'); sfx.strike(); }
  else if(r.spare){ bigText(V.opts.mode==='spares'?'🎯 ¡LIMPIO!':'✨ ¡SPARE!'); sfx.spare(); }
  else if(r.gutter || r.split){ banner(r.msg, 'bad'); sfx.bad(); }
  else if(r.msg) banner(r.msg, '');
  if(r.gold && !r.strike) banner('🌟 ¡Pino dorado! +'+V.opts.goldPts, '');
  if(myTurn()){ sfx.turn(); if(curShooter()!==V.shot.pid || V.shot.res.redo) yourTurn(); }
  endModal();
}
function banner(t, cls){ const b=$('#banner'); b.className='banner '+(cls||''); b.textContent=t; b.style.display='block'; clearTimeout(banner.t); banner.t=setTimeout(()=>b.style.display='none', 3000); }
function bigText(t){ const d=document.createElement('div'); d.className='bigtext'; d.textContent=t; $('#stage').appendChild(d); setTimeout(()=>d.remove(), 2200); }
function yourTurn(){ const d=document.createElement('div'); d.className='yourturn'; d.textContent='🎳 ¡Te toca!'; document.body.appendChild(d); setTimeout(()=>d.remove(),1700); }

// fin de la línea / partida
let ENDSHOWN=null;
function endModal(){
  if(!V || (V.phase!=='lineEnd' && V.phase!=='over') || !V.lineWin){ if(ENDSHOWN && V && V.phase==='play'){ ENDSHOWN=null; closeModal(); } return; }
  if(ANIM.on) return;
  const key=V.line+'|'+V.phase; if(ENDSHOWN===key) return; ENDSHOWN=key;
  const w=V.lineWin, host=amHost(), over=V.phase==='over', fin = over && w.serie ? w.serie : w;
  const names = ix => ix.map(i=>sideName(V,i)).join(' y ');
  const iWon = fin.ties.some(i=>V.sides[i].pids.some(pid=>mine(pid)));
  if(iWon) sfx.win();
  modal(`<h2>${over?'🏆 ¡Terminó la partida!':`🎳 Fin de la línea ${V.line}`}</h2>
    <p style="font-size:18px"><b>${esc(names(fin.ties))}</b> ${fin.tie?'empatan':'gana'} con <b>${fin.pts}</b> ${over&&w.serie?'en la serie':'puntos'} 🎉</p>
    <div style="overflow-x:auto">${sheetHTML(V,true)}</div>
    ${host ? (over ? `<button class="btn green wide" onclick="closeModal();doAct({type:'rematch'})">🔁 Revancha</button><button class="btn wide" style="margin-top:6px" onclick="closeModal();doAct({type:'newGame'})">⚙️ Volver a la sala (cambiar reglas)</button>`
                   : `<button class="btn green wide" onclick="closeModal();doAct({type:'nextLine'})">▶️ Siguiente línea</button><p class="muted">Si no, arranca sola en unos segundos.</p>`)
           : `<p class="muted">${over?'El anfitrión elige si hay revancha.':'La próxima línea arranca en unos segundos…'}</p>`}
    <button class="btn gray wide" style="margin-top:6px" onclick="closeModal()">Mirar la pista</button>`);
}

/* ====================== PISTA 2D (desde arriba) ====================== */
const VIEW=Object.assign({mode:'2d', theme:'madera'}, load('bolos_view')||{});
const THEMES={madera:{n:'🪵 Madera', lane:['#e6b97a','#d9a560'], app:'#c9965a', gut:'#3b3f45', bg:'#1b120b', arrow:'#5a3416', pin:'#fbfaf5', ring:'#d52b1e', glow:null},
  neon:{n:'🌌 Cósmico', lane:['#1d1b4a','#15123a'], app:'#221f52', gut:'#0b0a1f', bg:'#07051a', arrow:'#39ff14', pin:'#f4f3ff', ring:'#ff2bd6', glow:'#00e5ff'},
  azul:{n:'🔵 Sintética', lane:['#cfd8e3','#b8c4d3'], app:'#a7b4c4', gut:'#2b3440', bg:'#0f1720', arrow:'#d52b1e', pin:'#ffffff', ring:'#0038a8', glow:null}};
const TH = () => THEMES[VIEW.theme]||THEMES.madera;
function saveView(){ store('bolos_view', {mode:VIEW.mode, theme:VIEW.theme}); }
const PITY=HEAD+3*ROW+22, DS=HEAD-50, END=PITY+30, APPV=60;
const T2={sx:1, kA:1, kL:1, hor:false, ox:0, oy:0, len:0};
const cv=$('#c2d'), cx2=cv.getContext('2d');
function resizeStage(){
  const st=$('#stage'), r=st.getBoundingClientRect(), dpr=Math.min(2, window.devicePixelRatio||1);
  cv.width=Math.max(1,r.width*dpr|0); cv.height=Math.max(1,r.height*dpr|0); cv.style.width=r.width+'px'; cv.style.height=r.height+'px';
  if(R3.renderer){ R3.renderer.setSize(r.width, r.height, false); R3.cam.aspect=r.width/Math.max(1,r.height); R3.cam.updateProjectionMatrix(); }
}
window.addEventListener('resize', ()=>{ if($('#game').classList.contains('on')) resizeStage(); });
const XW = LW+2*GW+14;   // ancho que se dibuja (pista, canaletas y paredes)
function layout2D(){
  const dpr=Math.min(2, window.devicePixelRatio||1), W=cv.width/dpr, H=cv.height/dpr;
  T2.hor = W > H*1.15;
  const L = (T2.hor ? W-70 : H-16), Cx = (T2.hor ? H-16 : W-70);
  const deckLen=END-DS;
  let sx=Math.min(Cx/XW, L/(deckLen+APPV*.6+DS*.075));
  T2.sx=sx; T2.kA=sx*.6; T2.kL=(L-sx*deckLen-T2.kA*APPV)/DS;
  T2.len=L;
  if(T2.hor){ T2.ox=8; T2.oy=(H-XW*sx)/2; } else { T2.ox=(W-64-XW*sx)/2; T2.oy=H-8; }
  return dpr;
}
function mapY(y){ if(y<0) return (Math.max(y,-APPV)+APPV)*T2.kA; if(y<DS) return APPV*T2.kA+y*T2.kL; return APPV*T2.kA+DS*T2.kL+(y-DS)*T2.sx; }
function unmapY(m){ const a=APPV*T2.kA, b=a+DS*T2.kL; if(m<a) return m/T2.kA-APPV; if(m<b) return (m-a)/T2.kL; return DS+(m-b)/T2.sx; }
function toS(x,y){ const lat=(x+GW+7)*T2.sx, m=mapY(y); return T2.hor ? [T2.ox+m, T2.oy+lat] : [T2.ox+lat, T2.oy-m]; }
function toLane(X,Y){ return T2.hor ? {x:(Y-T2.oy)/T2.sx-GW-7, y:unmapY(X-T2.ox)} : {x:(X-T2.ox)/T2.sx-GW-7, y:unmapY(T2.oy-Y)}; }
function poly(c, pts){ c.beginPath(); pts.forEach(([x,y],i)=>{ const [X,Y]=toS(x,y); if(i) c.lineTo(X,Y); else c.moveTo(X,Y); }); c.closePath(); }
function rectL(c, x0,y0,x1,y1, fill){ poly(c, [[x0,y0],[x1,y0],[x1,y1],[x0,y1]]); c.fillStyle=fill; c.fill(); }
function lineL(c, pts){ c.beginPath(); pts.forEach(([x,y],i)=>{ const [X,Y]=toS(x,y); if(i) c.lineTo(X,Y); else c.moveTo(X,Y); }); c.stroke(); }
function draw2D(){
  const c=cx2, dpr=layout2D(), s=T2.sx, th=TH();
  c.setTransform(1,0,0,1,0,0); c.clearRect(0,0,cv.width,cv.height); c.setTransform(dpr,0,0,dpr,0,0);
  // paredes, canaletas, pista
  rectL(c, -GW-7, -APPV, LW+GW+7, END, th.bg);
  rectL(c, -GW-7, DECK0, -GW, END, '#2a2a2a'); rectL(c, LW+GW, DECK0, LW+GW+7, END, '#2a2a2a');
  rectL(c, -GW, 0, 0, PITY, th.gut); rectL(c, LW, 0, LW+GW, PITY, th.gut);
  rectL(c, -GW-7, -APPV, LW+GW+7, 0, th.app);
  rectL(c, 0, 0, LW, PITY, th.lane[0]);
  rectL(c, 0, DS, LW, PITY, th.lane[1]);
  rectL(c, -GW, PITY, LW+GW, END, '#050505');
  // tablas
  c.strokeStyle = th.glow ? 'rgba(0,229,255,.07)' : 'rgba(80,40,10,.13)'; c.lineWidth=.6;
  for(let k=1;k<39;k++){ lineL(c, [[k*BOARD,0],[k*BOARD,PITY]]); }
  // línea de falta, puntos y flechas
  c.strokeStyle = th.glow ? th.glow : '#b01e14'; c.lineWidth=Math.max(1.5, s*1.2); lineL(c, [[0,0],[LW,0]]);
  c.fillStyle=th.arrow;
  for(const b of [3,5,8,11,14]) for(const bb of [b, 40-b]){ const [X,Y]=toS(bb*BOARD-BOARD/2, 213); c.beginPath(); c.arc(X,Y,Math.max(1.2,s*.9),0,7); c.fill(); }
  for(let b=5;b<=35;b+=5){ const y=518-Math.abs(b-20)*6, x=b*BOARD-BOARD/2; poly(c, [[x,y+20],[x-BOARD*.55,y-6],[x+BOARD*.55,y-6]]); c.fill(); }
  // marcas de los pinos
  c.fillStyle='rgba(0,0,0,.15)'; PIN_SPOTS.forEach(([x,y])=>{ const [X,Y]=toS(x,y); c.beginPath(); c.arc(X,Y,s*2,0,7); c.fill(); });
  // cartel del fondo
  c.save(); const [tx,ty]=toS(C, END-8); c.translate(tx,ty); if(T2.hor) c.rotate(Math.PI/2); c.fillStyle=th.glow||'#f2c14e'; c.font=`900 ${Math.max(8,s*7)}px system-ui`; c.textAlign='center'; c.textBaseline='middle'; c.fillText('BOLOS · PY', 0, 0); c.restore();
  const d=dispState(), ball=d.ball;
  // ayuda para apuntar
  const am = V.phase==='play' && !ANIM.on ? aimNow() : null;
  if(am) drawGuide2D(c, am);
  // pinos
  const gold = ANIM.on ? ANIM.shot.gold : V.gold;
  for(const p of d.pins.slice().sort((a,b)=>b.tilt-a.tilt)) drawPin2D(c, p, gold===p.i);
  // bola
  if(ball){ const pb=V.players.find(x=>x.id===(ANIM.on?ANIM.shot.pid:curShooter())); drawBall2D(c, ball, pb?pb.ball:'#d52b1e'); }
}
function drawGuide2D(c, am){
  const help=V.opts.aim, th=TH();
  c.save(); c.lineCap='round';
  if(help==='facil'){
    const r=ballPath(am, {oil:V.opts.oil, bumpers:V.opts.bumpers}, HEAD+3*ROW, 30);
    c.strokeStyle = th.glow ? 'rgba(57,255,20,.8)' : 'rgba(255,255,255,.85)'; c.lineWidth=Math.max(1.5,T2.sx*1.6); c.setLineDash([4,4]); lineL(c, r.pts);
    const yh=Math.min(HEAD, r.pts[r.pts.length-1][1]); const e=r.pts.find(p=>p[1]>=yh-5)||r.pts[r.pts.length-1];
    c.setLineDash([]); c.strokeStyle='rgba(255,255,255,.7)'; const [X,Y]=toS(e[0], e[1]); c.beginPath(); c.arc(X,Y,BR*T2.sx,0,7); c.stroke();
  } else {
    const L = help==='medio' ? 560 : 150;
    c.strokeStyle = th.glow ? 'rgba(57,255,20,.8)' : 'rgba(255,255,255,.85)'; c.lineWidth=Math.max(1.5,T2.sx*1.6); c.setLineDash(help==='medio'?[4,4]:[]);
    const x1=am.x+Math.sin(am.ang)*L, y1=Math.cos(am.ang)*L; lineL(c, [[am.x,0],[x1,y1]]);
    c.setLineDash([]); const [X,Y]=toS(x1,y1), [X0,Y0]=toS(am.x+Math.sin(am.ang)*(L-20), Math.cos(am.ang)*(L-20)); const a=Math.atan2(Y-Y0, X-X0), k=Math.max(5,T2.sx*5);
    c.beginPath(); c.moveTo(X,Y); c.lineTo(X-Math.cos(a-.5)*k, Y-Math.sin(a-.5)*k); c.moveTo(X,Y); c.lineTo(X-Math.cos(a+.5)*k, Y-Math.sin(a+.5)*k); c.stroke();
  }
  c.restore();
}
function drawPin2D(c, p, gold){
  const th=TH(), s=T2.sx, r=PR*s*(1-(p.sink||0)*.5);
  c.save(); c.globalAlpha=1-(p.sink||0)*.8;
  if(p.tilt>0){
    const L=19*p.tilt, dx=Math.sin(p.a), dy=Math.cos(p.a);
    const [X0,Y0]=toS(p.x-dx*L*.5, p.y-dy*L*.5), [X1,Y1]=toS(p.x+dx*L, p.y+dy*L);
    c.lineCap='round'; c.strokeStyle='rgba(0,0,0,.3)'; c.lineWidth=r*2; c.beginPath(); c.moveTo(X0+1.5,Y0+1.5); c.lineTo(X1+1.5,Y1+1.5); c.stroke();
    c.strokeStyle=gold?'#f2c14e':th.pin; c.lineWidth=r*2*(1-.25*p.tilt); c.beginPath(); c.moveTo(X0,Y0); c.lineTo(X1,Y1); c.stroke();
    const [Xr,Yr]=toS(p.x+dx*L*.62, p.y+dy*L*.62); c.fillStyle=th.ring; c.beginPath(); c.arc(Xr,Yr,r*.55,0,7); c.fill();
  } else {
    const [X,Y]=toS(p.x,p.y);
    if(gold || th.glow){ c.shadowColor=gold?'#ffd54a':th.glow; c.shadowBlur=gold?14:8; }
    c.fillStyle='rgba(0,0,0,.3)'; c.beginPath(); c.arc(X+1.5,Y+1.5,r,0,7); c.fill();
    const g=c.createRadialGradient(X-r*.3,Y-r*.3,r*.1,X,Y,r); g.addColorStop(0, gold?'#fff6c7':'#fff'); g.addColorStop(1, gold?'#e0a800':th.pin==='#fbfaf5'?'#d9d4c6':'#b9b6d6');
    c.fillStyle=g; c.beginPath(); c.arc(X,Y,r,0,7); c.fill(); c.shadowBlur=0;
    c.strokeStyle=th.ring; c.lineWidth=Math.max(1,r*.22); c.beginPath(); c.arc(X,Y,r*.55,0,7); c.stroke();
    c.fillStyle=gold?'#fff6c7':'#fff'; c.beginPath(); c.arc(X,Y,r*.3,0,7); c.fill();
  }
  c.restore();
}
function drawBall2D(c, b, col){
  const s=T2.sx, r=BR*s, inG = !b.held && (b.x<0 || b.x>LW);
  const [X,Y]=toS(b.x, b.y);
  c.save();
  c.fillStyle='rgba(0,0,0,.35)'; c.beginPath(); c.arc(X+2,Y+2,r*(inG?.85:1),0,7); c.fill();
  const g=c.createRadialGradient(X-r*.35,Y-r*.4,r*.1,X,Y,r); g.addColorStop(0,shade(col,.45)); g.addColorStop(.6,col); g.addColorStop(1,shade(col,-.45));
  c.fillStyle=g; c.beginPath(); c.arc(X,Y,r*(inG?.85:1),0,7); c.fill();
  // agujeros para los dedos (giran mientras rueda)
  const rot = b.f!=null ? b.f*.9 : 0;
  c.fillStyle='rgba(0,0,0,.65)';
  for(const [a,d,k] of [[-.5,.42,.13],[.5,.42,.13],[Math.PI,.35,.15]]){ const aa=a+rot; c.beginPath(); c.arc(X+Math.cos(aa)*r*d*Math.abs(Math.cos(rot*.7)), Y+Math.sin(aa)*r*d, r*k, 0, 7); c.fill(); }
  c.restore();
}
function shade(hex, k){ const n=parseInt(hex.slice(1),16); let r=n>>16, g=(n>>8)&255, b=n&255; const f=v=>Math.max(0,Math.min(255, Math.round(k<0 ? v*(1+k) : v+(255-v)*k))); return `rgb(${f(r)},${f(g)},${f(b)})`; }
// tocar / arrastrar en la pista 2D: cerca de la bola la movés de lugar, en otra parte apuntás
(function(){
  let mode=null;
  cv.addEventListener('pointerdown', e=>{
    if(VIEW.mode!=='2d' || !myTurn()) return;
    const r=cv.getBoundingClientRect(), t=toLane(e.clientX-r.left, e.clientY-r.top);
    cv.setPointerCapture(e.pointerId);
    mode = t.y<120 ? 'pos' : 'aim'; apply(t);
  });
  const apply=t=>{
    if(mode==='pos'){ AIM.x=clampX(t.x); }
    else if(mode==='aim' && t.y>40){ AIM.ang=Math.max(-MAXANG, Math.min(MAXANG, Math.atan2(t.x-AIM.x, t.y))); }
    saveAim(); sendAim();
  };
  cv.addEventListener('pointermove', e=>{ if(!mode) return; const r=cv.getBoundingClientRect(); apply(toLane(e.clientX-r.left, e.clientY-r.top)); });
  const end=()=>{ mode=null; }; cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  cv.addEventListener('wheel', e=>{ if(!myTurn()) return; e.preventDefault(); turnAim(e.deltaY>0?.0004:-.0004); }, {passive:false});
})();

/* ====================== PISTA 3D ====================== */
const R3={renderer:null};
const CAM3=Object.assign({mode:'tiro', h:0, zoom:1, follow:true, shotStart:0}, load('bolos_cam3')||{});
function saveCam3(){ store('bolos_cam3', {mode:CAM3.mode, h:CAM3.h, zoom:CAM3.zoom}); }
const L3 = (x,y,h) => new THREE.Vector3(x-C, h||0, -y);
function laneTexture(){
  const th=TH(), c=document.createElement('canvas'); c.width=256; c.height=4096; const g=c.getContext('2d');
  const sy=c.height/PITY, sx=c.width/LW, Y=y=>c.height-y*sy;
  const gr=g.createLinearGradient(0,0,0,c.height); gr.addColorStop(0,th.lane[1]); gr.addColorStop(.12,th.lane[1]); gr.addColorStop(.14,th.lane[0]); gr.addColorStop(1,th.lane[0]);
  g.fillStyle=gr; g.fillRect(0,0,c.width,c.height);
  for(let k=0;k<39;k++){ g.fillStyle = th.glow ? `rgba(0,229,255,${k%2?.03:.06})` : `rgba(${k%2?'120,60,20':'255,230,190'},${.06+((k*37)%7)/100})`; g.fillRect(k*BOARD*sx, 0, BOARD*sx, c.height); }
  g.fillStyle = th.glow ? 'rgba(0,229,255,.06)' : 'rgba(80,40,10,.25)'; for(let k=1;k<39;k++) g.fillRect(k*BOARD*sx-.5, 0, 1, c.height);
  g.fillStyle=th.glow||'#b01e14'; g.fillRect(0, Y(0)-6, c.width, 6);
  g.fillStyle=th.arrow;
  for(const b of [3,5,8,11,14]) for(const bb of [b,40-b]){ g.beginPath(); g.arc((bb-.5)*BOARD*sx, Y(213), 4, 0, 7); g.fill(); }
  for(let b=5;b<=35;b+=5){ const y=518-Math.abs(b-20)*6, x=(b-.5)*BOARD*sx; g.beginPath(); g.moveTo(x, Y(y+22)); g.lineTo(x-BOARD*sx*.6, Y(y-8)); g.lineTo(x+BOARD*sx*.6, Y(y-8)); g.closePath(); g.fill(); }
  g.fillStyle='rgba(0,0,0,.12)'; PIN_SPOTS.forEach(([x,y])=>{ g.beginPath(); g.ellipse(x*sx, Y(y), 6, 3, 0, 0, 7); g.fill(); });
  const t=new THREE.CanvasTexture(c); t.anisotropy=8; return t;
}
function ballTexture3(col){
  const c=document.createElement('canvas'); c.width=512; c.height=256; const g=c.getContext('2d');
  g.fillStyle=col; g.fillRect(0,0,512,256);
  for(let i=0;i<40;i++){ g.strokeStyle=`rgba(255,255,255,${.04+Math.random()*.08})`; g.lineWidth=2+Math.random()*10; g.beginPath(); g.moveTo(Math.random()*512, Math.random()*256); g.bezierCurveTo(Math.random()*512,Math.random()*256,Math.random()*512,Math.random()*256,Math.random()*512,Math.random()*256); g.stroke(); }
  g.fillStyle='#0d0d0d'; for(const [x,y,r] of [[240,90,13],[272,90,13],[256,150,15]]){ g.beginPath(); g.arc(x,y,r,0,7); g.fill(); }
  g.fillStyle='rgba(255,255,255,.75)'; g.font='bold 20px Arial'; g.textAlign='center'; g.fillText('PY', 384, 140);
  return new THREE.CanvasTexture(c);
}
function makePin(T, mats){
  const prof=[[0,0],[2.6,0],[3.7,1.6],[5.4,6],[6.05,11.4],[5.7,16],[4.2,21.5],[2.8,26],[2.35,28.4],[2.8,31.6],[3.25,34.4],[2.7,36.9],[1.3,38],[0,38.1]].map(([r,h])=>new T.Vector2(r,h-19));
  const g=new T.Group();
  const body=new T.Mesh(new T.LatheGeometry(prof, 22), mats.pin); body.castShadow=true; body.receiveShadow=true; g.add(body);
  for(const h of [26.6, 29.4]){ const r=h<28?2.62:2.5; const ring=new T.Mesh(new T.CylinderGeometry(r+.06, r+.06, 1.1, 22, 1, true), mats.ring); ring.position.y=h-19; g.add(ring); }
  return g;
}
function init3D(){
  if(R3.renderer || !window.THREE) return !!R3.renderer;
  const T=THREE, canvas=$('#c3d');
  let renderer;
  try{ renderer=new T.WebGLRenderer({canvas, antialias:true}); }catch(e){ toast('Este aparato no puede mostrar 3D. Seguimos en 2D.'); return false; }
  const mobile=/Android|iPhone|iPad/i.test(navigator.userAgent);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, mobile?1.5:2));
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=T.PCFSoftShadowMap;
  const scene=new T.Scene();
  const cam=new T.PerspectiveCamera(46, 1, 2, 9000);
  Object.assign(R3, {renderer, scene, cam, T});
  R3.hemi=new T.HemisphereLight(0xfff3dd, 0x2a1a10, .65); scene.add(R3.hemi);
  const dl=new T.DirectionalLight(0xffffff, .55); dl.position.set(-80, 400, -HEAD+200); dl.target.position.set(0,0,-HEAD-40);
  dl.castShadow=true; dl.shadow.mapSize.set(mobile?1024:2048, mobile?1024:2048); Object.assign(dl.shadow.camera, {left:-110, right:110, top:160, bottom:-160, near:50, far:900}); dl.shadow.bias=-.0005;
  scene.add(dl, dl.target);
  R3.spot=new T.PointLight(0xffffff, .5, 900); R3.spot.position.set(0, 160, -HEAD+60); scene.add(R3.spot);
  R3.mats={pin:new T.MeshStandardMaterial({color:0xf7f5ee, roughness:.25, metalness:0}), ring:new T.MeshStandardMaterial({color:0xd52b1e, roughness:.35})};
  R3.world=new T.Group(); scene.add(R3.world);
  buildLane3D();
  // pinos de esta pista
  R3.pins=PIN_SPOTS.map(()=>{ const p=makePin(T, R3.mats); p.visible=false; scene.add(p); return p; });
  // bola
  R3.ball=new T.Mesh(new T.SphereGeometry(BR, 40, 26), new T.MeshPhongMaterial({shininess:120, specular:0x888888})); R3.ball.castShadow=true; scene.add(R3.ball); R3.ballCol=null;
  // ayuda para apuntar
  R3.guide=new T.Line(new T.BufferGeometry().setFromPoints([...Array(90)].map(()=>new T.Vector3())), new T.LineDashedMaterial({color:0xffffff, dashSize:12, gapSize:10, transparent:true, opacity:.85}));
  scene.add(R3.guide);
  R3.ghost=new T.Mesh(new T.RingGeometry(BR-1, BR, 32), new T.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:.6, side:T.DoubleSide})); R3.ghost.rotation.x=-Math.PI/2; scene.add(R3.ghost);
  wire3DInput(canvas);
  resizeStage();
  return true;
}
// arma la pista, las de al lado y el fondo (se rehace al cambiar el estilo)
function buildLane3D(){
  const T=R3.T, th=TH(), W=R3.world;
  while(W.children.length) W.remove(W.children[0]);
  R3.scene.background=new T.Color(th.bg); R3.scene.fog=new T.Fog(th.bg, 1600, 4200);
  const laneMat=new T.MeshStandardMaterial({map:laneTexture(), roughness:.18, metalness:.05});
  const gutMat=new T.MeshStandardMaterial({color:th.gut, roughness:.5, metalness:.4});
  const capMat=new T.MeshStandardMaterial({color: th.glow?0x1a1840:0x3a2a20, roughness:.6});
  const appMat=new T.MeshStandardMaterial({color:th.app, roughness:.4});
  const addLane=(ox, pins)=>{
    const g=new T.Group(); g.position.x=ox; W.add(g);
    const lane=new T.Mesh(new T.BoxGeometry(LW, 6, PITY), [0,1,2,3,4,5].map(i=>i===2?laneMat:capMat)); lane.position.set(0,-3,-PITY/2); lane.receiveShadow=true; g.add(lane);
    const app=new T.Mesh(new T.BoxGeometry(LW+2*GW, 6, 460), appMat); app.position.set(0,-3,230); app.receiveShadow=true; g.add(app);
    for(const sx of [-1,1]){
      const gut=new T.Mesh(new T.BoxGeometry(GW, 1, PITY), gutMat); gut.position.set(sx*(LW/2+GW/2), -7.5, -PITY/2); gut.receiveShadow=true; g.add(gut);
      const kick=new T.Mesh(new T.BoxGeometry(6, 70, PITY-DECK0+60), capMat); kick.position.set(sx*(LW/2+GW+3), 30, -(DECK0+PITY)/2-30); g.add(kick);
      const cap=new T.Mesh(new T.BoxGeometry(14, 10, DECK0), capMat); cap.position.set(sx*(LW/2+GW+7), -1, -DECK0/2); g.add(cap);
    }
    const pit=new T.Mesh(new T.BoxGeometry(LW+2*GW, 2, 120), new T.MeshBasicMaterial({color:0x050505})); pit.position.set(0,-12,-PITY-60); g.add(pit);
    const back=new T.Mesh(new T.PlaneGeometry(LW+2*GW+12, 160), new T.MeshBasicMaterial({color:0x080808})); back.position.set(0,60,-PITY-110); g.add(back);
    if(pins) PIN_SPOTS.forEach(([x,y])=>{ const p=makePin(T, R3.mats); p.position.set(x-C, 19, -y); g.add(p); });
    return g;
  };
  addLane(0, false);
  const step=LW+2*GW+28;
  for(const k of [-2,-1,1,2]) addLane(k*step, true);
  // cartel arriba de los pinos
  const c=document.createElement('canvas'); c.width=1024; c.height=256; const g=c.getContext('2d');
  const gr=g.createLinearGradient(0,0,1024,0); gr.addColorStop(0,'#d52b1e'); gr.addColorStop(.5,'#ffffff'); gr.addColorStop(1,'#0038a8');
  g.fillStyle= th.glow ? '#10082e' : gr; g.fillRect(0,0,1024,256);
  g.fillStyle= th.glow ? th.glow : '#1b2a5a'; g.font='900 120px system-ui'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('🎳 BOLOS PY', 512, 135);
  const mask=new T.Mesh(new T.PlaneGeometry(step*5, 110), new T.MeshBasicMaterial({map:new T.CanvasTexture(c)})); mask.position.set(0, 125, -HEAD-60); W.add(mask);
  const floor=new T.Mesh(new T.PlaneGeometry(9000, 9000), new T.MeshStandardMaterial({color: th.glow?0x0a0820:0x2a1d14, roughness:1})); floor.rotation.x=-Math.PI/2; floor.position.y=-30; W.add(floor);
  if(th.glow){ R3.mats.pin.emissive=new T.Color(0x2a2a55); R3.mats.ring.color.set(th.ring); R3.mats.ring.emissive=new T.Color(th.ring).multiplyScalar(.6); R3.hemi.intensity=.45; }
  else { R3.mats.pin.emissive=new T.Color(0); R3.mats.ring.color.set(th.ring); R3.mats.ring.emissive=new T.Color(0); R3.hemi.intensity=.65; }
}
function wire3DInput(canvas){
  let drag=null;
  canvas.addEventListener('pointerdown', e=>{ if(VIEW.mode!=='3d') return; canvas.setPointerCapture(e.pointerId); drag={x:e.clientX, y:e.clientY}; });
  canvas.addEventListener('pointermove', e=>{
    if(!drag) return;
    const dx=e.clientX-drag.x, dy=e.clientY-drag.y; drag.x=e.clientX; drag.y=e.clientY;
    if(myTurn() && CAM3.mode==='tiro') turnAim(dx*.00012);
    CAM3.h=Math.max(-1, Math.min(1, CAM3.h - dy*.004));
  });
  const end=()=>{ if(drag) saveCam3(); drag=null; };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', e=>{ e.preventDefault(); CAM3.zoom=Math.max(.5, Math.min(2.2, CAM3.zoom*(e.deltaY>0?1.08:.93))); saveCam3(); }, {passive:false});
}
function cam3(k, d){
  if(k==='h') CAM3.h=Math.max(-1, Math.min(1, CAM3.h+d));
  else if(k==='zoom') CAM3.zoom=Math.max(.5, Math.min(2.2, CAM3.zoom*(d>0?.85:1.18)));
  else { CAM3.mode=k; CAM3.h=0; CAM3.zoom=1; }
  saveCam3();
}
function setPin3(m, p){
  m.visible=true;
  const T=R3.T, t=p.tilt||0, dx=Math.sin(p.a||0), dz=-Math.cos(p.a||0);
  m.position.set(p.x-C, 19-(19-5.8)*t - (p.sink||0)*30, -p.y);
  if(t>0){ const ax=new T.Vector3(dz, 0, -dx).normalize(); m.quaternion.setFromAxisAngle(ax, t*Math.PI/2); }
  else m.quaternion.set(0,0,0,1);
}
function draw3D(){
  const T=R3.T, d=dispState(), th=TH();
  R3.pins.forEach(m=>m.visible=false);
  const gold = ANIM.on ? ANIM.shot.gold : V.gold;
  d.pins.forEach(p=>{ const m=R3.pins[p.i]; setPin3(m, p); m.children[0].material = gold===p.i ? (R3.goldMat=R3.goldMat||new T.MeshStandardMaterial({color:0xf2c14e, metalness:.6, roughness:.25, emissive:0x553300})) : R3.mats.pin; });
  // bola
  const b=d.ball, pl=V.players.find(x=>x.id===(ANIM.on?ANIM.shot.pid:curShooter()));
  const col=pl?pl.ball:'#d52b1e';
  if(R3.ballCol!==col){ R3.ballCol=col; if(R3.ball.material.map) R3.ball.material.map.dispose(); R3.ball.material.map=ballTexture3(col); R3.ball.material.needsUpdate=true; }
  if(b){
    R3.ball.visible=true;
    const inG=!b.held && (b.x<0 || b.x>LW), sinkP=Math.max(0, b.y-PITY)*.25;
    const pos=new T.Vector3(b.x-C, BR-(inG?7:0)-sinkP, -b.y);
    if(R3.anBall && !b.held){ const dx=pos.x-R3.anBall.x, dz=pos.z-R3.anBall.z, dist=Math.hypot(dx,dz);
      if(dist>1e-3 && dist<200){ const ax=new T.Vector3(-dz,0,dx).normalize(); R3.ball.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(ax, -dist/BR)); } }
    R3.anBall=b.held?null:pos.clone(); R3.ball.position.copy(pos);
  } else R3.ball.visible=false;
  // ayuda
  const am = V.phase==='play' && !ANIM.on ? aimNow() : null;
  R3.guide.visible=false; R3.ghost.visible=false;
  if(am){
    let pts;
    if(V.opts.aim==='facil'){ pts=ballPath(am, {oil:V.opts.oil, bumpers:V.opts.bumpers}, HEAD, 25).pts; const e=pts[pts.length-1]; R3.ghost.position.set(e[0]-C, .6, -e[1]); R3.ghost.visible=true; }
    else { const L=V.opts.aim==='medio'?560:150; pts=[[am.x,0],[am.x+Math.sin(am.ang)*L, Math.cos(am.ang)*L]]; }
    const arr=R3.guide.geometry.attributes.position;
    for(let i=0;i<90;i++){ const p=pts[Math.min(i, pts.length-1)]; arr.setXYZ(i, p[0]-C, .8, -p[1]); }
    arr.needsUpdate=true; R3.guide.geometry.computeBoundingSphere(); R3.guide.computeLineDistances(); R3.guide.material.color.set(th.glow?0x39ff14:0xffffff); R3.guide.visible=true;
  }
  // cámara
  const z=CAM3.zoom, hh=CAM3.h;
  let want, look;
  if(CAM3.mode==='pinos'){ want=L3(C, HEAD-260*z, 70+hh*60); look=L3(C, HEAD+40, 8); }
  else if(CAM3.mode==='arriba'){ want=L3(C+260*z, HEAD*.45, 900*z+hh*300); look=L3(C, HEAD*.55, 0); }
  else {
    const bx = b ? b.x : C, by = b && !b.held ? Math.min(b.y, HEAD-420) : 0;
    const follow = ANIM.on ? Math.min(1,(performance.now()-CAM3.shotStart)/500) : 0;
    want=L3(C+(bx-C)*.7, by*follow-330*z, 95*z+hh*70+ (ANIM.on? -follow*15 : 0));
    look=L3(C+(bx-C)*.3, (ANIM.on? Math.max(by+600, HEAD-150) : HEAD*.6), ANIM.on?10:0);
    if(!ANIM.on) look=L3(C, HEAD-150, 0);
  }
  R3.cam.position.lerp(want, ANIM.on ? .12 : .25);
  R3.camLook=(R3.camLook||look.clone()).lerp(look, ANIM.on ? .12 : .25); R3.cam.lookAt(R3.camLook);
  R3.renderer.render(R3.scene, R3.cam);
}
function applyView(){
  const is3=VIEW.mode==='3d';
  $('#game').classList.toggle('v3d', is3);
  $('#c2d').style.display = is3 ? 'none' : 'block';
  $('#c3d').style.display = is3 ? 'block' : 'none';
  $('#btnView').textContent = is3 ? '🗺️ Arriba' : '🧊 3D';
}
function toggleView(){
  if(VIEW.mode==='2d'){ if(!init3D()) return; VIEW.mode='3d'; toast('🧊 Vista 3D: arrastrá a los costados para apuntar y arriba/abajo para la cámara. 🎳 para ver los pinos de cerca.'); }
  else { VIEW.mode='2d'; toast('🗺️ Vista desde arriba: tocá cerca de la bola para cambiarla de lugar y en la pista para apuntar.'); }
  saveView(); applyView(); resizeStage();
}
function themeModal(){
  modal(`<h2>🎨 Estilo de la pista</h2><div class="felts">${Object.keys(THEMES).map(k=>`<button style="background:${THEMES[k].lane[0]};color:${k==='neon'?'#39ff14':'#222'}" onclick="setTheme('${k}')">${THEMES[k].n}</button>`).join('')}</div><button class="btn gray wide" onclick="closeModal()">Cerrar</button>`);
}
function setTheme(k){ VIEW.theme=k; saveView(); if(R3.renderer) buildLane3D(); closeModal(); }
function loop(){
  requestAnimationFrame(loop);
  if(!V || V.phase==='lobby' || !$('#game').classList.contains('on')) return;
  keyPowTick();
  if(VIEW.mode==='3d' && R3.renderer) draw3D(); else draw2D();
  if(ANIM.on && (loop.n=(loop.n||0)+1)%4===0) renderPinHud();
}
requestAnimationFrame(loop);
if(VIEW.mode==='3d' && !window.THREE) VIEW.mode='2d';
setTimeout(()=>{ if(VIEW.mode==='3d' && !init3D()) VIEW.mode='2d'; applyView(); }, 0);

/* ====================== PANEL LATERAL ====================== */
function renderSidePanels(){ if($('#tab-hist').classList.contains('on')) renderHist(); renderMesaTab(); renderReglasTab(); }
let HIST_N=0;
function renderHist(){
  if(!V) return;
  const L=(V.log||[]).slice().reverse(); const fresh=L.length-HIST_N; HIST_N=L.length;
  $('#histList').innerHTML = L.map((l,i)=>`<div class="hline ${i<fresh&&fresh<5?'new':''}">${esc(l.x)}</div>`).join('') || '<p class="muted">Todavía no hubo tiros.</p>';
}
function renderMesaTab(){
  const host=amHost(), inPlay=V.phase!=='lobby';
  const ps=V.players.map(p=>{
    const offline=!p.bot&&!p.conn;
    return `<div class="prow" style="border-left:5px solid ${p.color}">${ballDot(p.ball,22)}<span style="font-size:22px">${esc(p.emoji)}</span><span class="nm"><b>${esc(p.name)}${p.id===me()?' (vos)':''}${p.id===V.hostPid&&NET.mode!=='local'?' 👑':''}</b>
      <small>${V.opts.fmt!=='ind'?TEAMS[p.team].e+' '+TEAMS[p.team].n:''}${p.hc?` · HCP ${p.hc}`:''}${p.bot?' · 🤖 bot':''}${p.mic?' · 🎙️':''}${offline?' · ⚠️ sin conexión':''}${inPlay&&curShooter()===p.id?' · 🎳 tirando':''}</small></span>
      ${host&&p.id!==V.hostPid&&NET.mode!=='local'?`${offline&&inPlay?`<button class="btn sm gray" onclick="doAct({type:'botify',pid:'${p.id}'})" title="Que tire un bot">🤖</button>`:''}<button class="btn sm gray" onclick="if(confirm('¿Sacar a ${esc(p.name)} de la pista?'))doAct({type:'kick',pid:'${p.id}'})" title="Sacar">✕</button>`:''}</div>`;
  }).join('');
  const obs=(V.observers||[]).map(o=>`<div class="prow"><span style="font-size:20px">${o.owner?'👑':'👀'}</span><span class="nm"><b>${esc(o.name)}${o.id===me()?' (vos)':''}</b><small>${o.owner?'dueño del juego, ':''}mirando${o.mic?' · 🎙️':''}</small></span></div>`).join('');
  const sit = NET.obs && V.phase!=='play' && V.phase!=='lineEnd' && V.players.length<MAXP ? `<button class="btn gold wide" onclick="doAct({type:'joinNext'})">🎳 Sumarme a jugar</button>` : NET.obs ? `<p class="muted">Te podés sumar cuando termine la partida (si hay lugar).</p>` : '';
  const info = inPlay ? `<p class="muted">${esc(MODES[V.opts.mode].t)} · línea ${V.line}/${V.opts.lines} · cuadro ${Math.min(V.frame+1, V.opts.frames)}/${V.opts.frames}</p><button class="btn dark wide" style="margin-bottom:8px" onclick="sheetModal()">📋 Ver la planilla grande</button>` : '';
  $('#mesaList').innerHTML = info + `<b>Jugadores (${V.players.length}/${MAXP})</b>` + ps + (obs?`<b>Mirando</b>${obs}`:'') + sit
    + (host && inPlay ? `<button class="btn dark wide" style="margin-top:8px" onclick="if(confirm('¿Terminar la partida y volver a la sala?'))doAct({type:'newGame',force:true})">⚙️ Terminar y volver a la sala</button>` : '')
    + (NET.mode!=='local'&&NET.code?`<p class="muted" style="margin-top:12px">Invitá con el código <b>${NET.code}</b> <button class="btn sm" onclick="shareRoom()">📤 Compartir</button></p>`:'');
}
function renderReglasTab(){
  const o=V.opts, on=HOUSE.filter(h=>o[h.k]), host=amHost();
  const custom = o.score==='custom' ? `<p class="muted">Cada pino ${o.pp} · strike +${o.sb} · spare +${o.spb} · ${o.bon?'con':'sin'} bonus de tiros siguientes</p>` : '';
  $('#reglasList').innerHTML = `<p style="margin-top:0"><b>${esc(MODES[o.mode].t)}</b> · ${esc(FORMATS[o.fmt])}</p><p class="muted">${esc(MODES[o.mode].d)}</p>`
    + (o.mode!=='spares'?`<p><b>${esc(SCORES[o.score].t)}</b></p><p class="muted">${esc(SCORES[o.score].d)}</p>${custom}`:'')
    + `<p class="muted">${o.frames} cuadros · ${o.lines} línea${o.lines>1?'s':''} · pista ${esc(OILS[o.oil].t)}${o.timer?` · ⏰ ${o.timer} s por tiro`:''}</p>`
    + `<b>Reglas de la casa activas</b>` + (on.length ? on.map(h=>`<div class="opt"><span><b>${h.t}</b><small>${h.d}${h.k==='gold'?` (+${o.goldPts})`:''}</small></span></div>`).join('') : '<p class="muted">Ninguna.</p>')
    + `<b>📝 Reglas propias del grupo</b>` + (V.grules?`<div class="grules" style="margin:6px 0 10px">${esc(V.grules)}</div>`:`<p class="muted">${host?'Las podés escribir en la sala de espera.':'No hay.'}</p>`)
    + `<b>💡 Sugerencias</b><div style="margin-top:6px">${sugsHTML(host)}</div>
       <div class="row"><input type="text" id="sugIn2" maxlength="240" placeholder="Proponé una regla…" onkeydown="if(event.key==='Enter')sendSug('sugIn2')"><button class="btn sm" style="flex:0 0 auto" onclick="sendSug('sugIn2')">Sugerir</button></div>
       <button class="btn dark wide" style="margin-top:12px" onclick="showRules()">📜 Cómo se juega</button>`;
}

/* ====================== VARIOS ====================== */
function modal(h){ $('#mbox').innerHTML=h; $('#modal').classList.add('on'); }
function closeModal(){ $('#modal').classList.remove('on'); }
function roomLink(){ return location.origin+location.pathname+'#'+NET.code; }
function copyCode(){ navigator.clipboard && navigator.clipboard.writeText(NET.code).then(()=>toast('Código copiado: '+NET.code)); }
function shareRoom(){
  const url=roomLink(), text=`¡Vení a jugar a los Bolos conmigo! 🎳🇵🇾 Sala ${NET.code}`;
  if(navigator.share) return navigator.share({title:'Bolos PY', text, url}).catch(()=>{});
  modal(`<h2>📤 Invitar a la sala ${NET.code}</h2><p style="word-break:break-all;user-select:all;background:#fff;padding:8px;border-radius:8px">${esc(url)}</p>
    <a class="btn green wide" style="display:block;text-align:center;text-decoration:none" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text+' '+url)}">💬 Mandar por WhatsApp</a>
    <button class="btn wide" style="margin-top:6px" onclick="navigator.clipboard.writeText('${url}').then(()=>toast('Enlace copiado'))">📋 Copiar enlace</button>
    <button class="btn gray wide" style="margin-top:6px" onclick="closeModal()">Cerrar</button>`);
}
function showRules(){
  modal(`<div class="rules"><h2>📜 Cómo se juega</h2>
  <h3>🕹️ Controles</h3>
  <ul><li><b>Lugar:</b> con ◀ ▶ (o en la vista de arriba tocando cerca de la bola) elegís desde dónde tirás.</li>
  <li><b>Dirección:</b> tocá o arrastrá en la pista hacia donde querés tirar; afinás con ↖ ↗ o deslizando la tira. En 3D arrastrá para los costados.</li>
  <li><b>Efecto:</b> la barrita de efecto hace que la bola se curve al final de la pista (↶ a la izquierda, ↷ a la derecha). Con gancho entra mejor a los pinos.</li>
  <li><b>Fuerza:</b> en la barra de la derecha tirá con el dedo hacia abajo y soltá (en PC también mantené la barra espaciadora y soltala). Teclas: ← → dirección, A D lugar, Q E efecto.</li></ul>
  <h3>🎳 El secreto del strike</h3><p>El mejor lugar para pegar es el <b>“bolsillo”</b>: entre el pino 1 y el 3 (o entre el 1 y el 2 si la bola se curva a la derecha), entrando con un poco de ángulo. De frente al pino 1 suelen quedar splits.</p>
  <h3>📋 Puntos</h3><p><b>X</b> = strike (los 10 de un tiro), <b>/</b> = spare (los 10 en dos tiros), <b>-</b> = ninguno, <b>G</b> = canaleta. Un número con círculo es un <b>split</b> (quedaron pinos separados).</p>
  ${Object.keys(SCORES).map(k=>`<p><b>${SCORES[k].t}:</b> ${SCORES[k].d}</p>`).join('')}
  <p><b>Hándicap:</b> puntos de ventaja que el anfitrión le puede dar a cada jugador; se suman al total.</p>
  <h3>🎮 Modos</h3>${Object.keys(MODES).map(k=>`<p><b>${MODES[k].t}:</b> ${MODES[k].d}</p>`).join('')}
  <h3>👥 Equipos</h3><p><b>Baker:</b> cada jugador del equipo tira un cuadro entero, por turno. <b>Escocés:</b> los del equipo se turnan en cada tiro.</p>
  <h3>🏠 Reglas de la casa</h3>${HOUSE.map(h=>`<p><b>${h.t}:</b> ${h.d}</p>`).join('')}
  </div><button class="btn wide" onclick="closeModal()">Entendido</button>`);
}
