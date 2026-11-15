'use strict';
/* =====================================================================
   Mini Golf PY — red (PeerJS), chat con privados, voz, sala de espera,
   cancha en 3D, controles del golpe y sonidos.
   ===================================================================== */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function store(k,v){ try{ if(v===undefined) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
function load(k){ try{ const v=localStorage.getItem(k); return v==null?null:JSON.parse(v); }catch(e){ return null; } }
function toast(x){ const t=$('#toast'); t.textContent=x; t.style.display='block'; clearTimeout(toast.t); toast.t=setTimeout(()=>t.style.display='none', 3800); }
const PREFIX='golfpy26-';
const genCode = () => { const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s=''; for(let i=0;i<5;i++) s+=A[rnd(A.length)]; return s; };
let myToken=load('golf_token'); if(!myToken){ myToken=Math.random().toString(36).slice(2)+Date.now().toString(36); store('golf_token', myToken); }
const NET={mode:null, peer:null, code:null, conns:{}, hostConn:null, myPid:null, obs:null, welcomed:false};
let CHAT=[], V=null;
const me = () => NET.myPid || NET.obs;
const amHost = () => NET.mode==='local' || (V && V.hostPid===NET.myPid && NET.mode==='host');
const VP = id => V && (V.players.find(p=>p.id===id) || (V.observers||[]).find(o=>o.id===id));
// ¿este aparato maneja a ese jugador? (en la partida local, todos los que no son bots)
const mine = pid => pid && (pid===me() || (NET.mode==='local' && V && V.players.some(p=>p.id===pid && !p.bot)));

/* ====================== MENÚ ====================== */
let myEmojiSel = load('golf_emoji') || EMOJIS[0];
const myName = () => ($('#myName').value.trim() || 'Jugador').slice(0,16);
const myEmoji = () => myEmojiSel;
$('#myName').value = load('golf_name') || '';
$('#myName').addEventListener('input', ()=>store('golf_name', $('#myName').value.trim()));
function renderTokenPicker(){ $('#tokens').innerHTML = EMOJIS.map(e=>`<button class="tok ${e===myEmojiSel?'sel':''}" onclick="pickEmoji('${e}')">${e}</button>`).join(''); }
function pickEmoji(e){ myEmojiSel=e; store('golf_emoji', e); renderTokenPicker(); }
renderTokenPicker();
function needName(){ if(!$('#myName').value.trim()){ toast('Escribí tu nombre primero ✍️'); $('#myName').focus(); return true; } store('golf_name', myName()); return false; }
function joinClick(){ const code=$('#joinCode').value.trim().toUpperCase(); if(!code) return toast('Escribí el código de la sala.'); if(needName()) return; clientJoin(code); }
function resumeClick(){
  const h=load('golf_host'), c=load('golf_client');
  if(h && (!c || h.at>=c.at)) return hostStart(true);
  if(c){ if(needName()) return; clientJoin(c.code); }
}
function refreshResume(){ const h=load('golf_host'), c=load('golf_client'), ok=x=>x && Date.now()-x.at<6*3600e3; $('#btnResume').style.display = ok(h)||ok(c) ? 'block' : 'none'; }
refreshResume();
(function(){
  const m=(location.hash.slice(1) || new URLSearchParams(location.search).get('sala') || '').toUpperCase();
  if(/^[A-Z0-9]{4,6}$/.test(m)){ $('#joinCode').value=m;
    if(new URLSearchParams(location.search).get('dueno')){ if(!$('#myName').value.trim()) $('#myName').value='Dueño'; setTimeout(()=>clientJoin(m), 300); }
    else toast('Te invitaron a la sala '+m+': escribí tu nombre y tocá “Entrar”.'); }
})();
const savedOpts = () => Object.assign(defaultOpts(), load('golf_opts')||{});

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
  const p=addPlayer(myName(), myEmoji(), myToken, null, false, false, load('golf_open')); NET.myPid=p.id; S.hostPid=p.id;
  addBot();
  sysChat('⛳ Cancha en este aparato. Sumá bots 🤖 o amigos que jueguen en el mismo celular o PC, elegí las reglas y tocá Empezar.');
  ANIM.lastN=null; commit(); renderChat();
}
function leaveClick(){
  if(NET.mode==='local'){ if(S && S.phase==='play' && !confirm('¿Salir de la partida?')) return; return leaveToMenu(); }
  if(!confirm('¿Salir de la sala?')) return;
  if(NET.mode==='host'){
    const others=hostCandidates(S);
    if(others.length) return hostHandover();
    store('golf_host', undefined);
  } else if(NET.mode==='client'){
    if(NET.hostConn && NET.hostConn.open && NET.myPid) try{ NET.hostConn.send({t:'act', a:{type:'leave'}}); }catch(e){}
    store('golf_client', undefined);
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
  s.clock=Date.now();   // para que el molino y el molinete se vean igual en todos los aparatos
  return s;
}
function commit(){
  lightShot();
  if(NET.mode==='host'){
    for(const pid in NET.conns){ const c=NET.conns[pid]; if(c && c.open) try{ c.send({t:'state', s:publicState(pid)}); }catch(e){} }
    sendBackups();
    if(!NET.noSave){ const s=JSON.parse(JSON.stringify(S)); if(s.shot) s.shot={n:s.shot.n, res:s.shot.res, stale:true}; store('golf_host', {code:NET.code, S:s, CHAT:CHAT.slice(-80), myPid:NET.myPid, at:Date.now()}); }
  }
  if(S && (NET.mode==='host'||NET.mode==='local') && S.phase==='lobby') store('golf_opts', S.opts);
  render();
}
function doAct(a){
  if(NET.mode==='client'){ if(NET.hostConn && NET.hostConn.open) NET.hostConn.send({t:'act', a}); else toast('Sin conexión con el anfitrión.'); return; }
  let who=me();
  if(NET.mode==='local' && a.type==='shot' && S && S.phase==='play'){ const sh=shooterOf(S); if(mine(sh)) who=sh; }
  const r=act(who, a); if(typeof r==='string'){ toast(r); if(a.type==='shot') AIM.sent=false; }
}
function newPeer(id){ return new Peer(id, {debug:1, config:{iceServers: window.ICE_SERVERS || [{urls:"stun:stun.l.google.com:19302"}]}}); }
function netBar(on,txt){ const b=$('#netbar'); b.style.display=on?'block':'none'; if(txt) b.textContent=txt; }

// ---------- anfitrión ----------
function hostStart(resume){
  if(!resume && needName()) return;
  const saved = resume ? load('golf_host') : null;
  NET.mode='host'; NET.code = saved ? saved.code : genCode(); NET.conns={}; NET.noSave=false;
  const peer = NET.peer = newPeer(PREFIX+NET.code);
  peer.on('open', id=>{
    if(saved){
      S=saved.S; CHAT=saved.CHAT||[]; NET.myPid=saved.myPid;
      S.players.forEach(p=>{ if(!p.bot && !p.local){ p.conn = p.id===NET.myPid; p.mic=false; if(!p.conn) p.offAt=Date.now(); } });
      S.observers=[]; P(NET.myPid).peerId=id;
    } else {
      S=lobbyState(); S.opts=savedOpts(); CHAT=[];
      const p=addPlayer(myName(), myEmoji(), myToken, id, false, false, load('golf_open')); NET.myPid=p.id; S.hostPid=p.id;
      sysChat('Sala '+NET.code+' creada. Pasales el código o el enlace a tus amigos.');
    }
    history.replaceState(null,'','#'+NET.code);
    ANIM.lastN=null; commit(); renderChat();
  });
  wireHostPeer(peer, ()=>{
    if(resume){ toast('La sala sigue abierta en otro aparato (otro jugador quedó de anfitrión). Entrá con el código.'); peer.destroy(); store('golf_host',undefined); NET.mode=null; $('#joinCode').value=NET.code; return; }
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
  store('golf_host', undefined);
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
        p=addPlayer(name, emo, d.token, conn.peer, false, false, d.open);
        sysChat(`${p.emoji} ${p.name} entró a la sala.`);
      } else {
        why = S.players.length>=MAXP ? 'La cancha está llena: entraste a mirar 👀.' : 'La partida ya empezó: entraste a mirar 👀. Te podés sumar cuando termine la partida.';
        ob={id:'o'+(++S.seq), name:nm, emoji:'👀', token:d.token, peerId:conn.peer, conn:true, open:d.open};
        S.observers.push(ob); sysChat(`👀 ${ob.name} entró a mirar.`);
      }
    } else if(p){ sysChat(`${p.emoji} ${p.name} se reconectó.`); if(!p.bot) p.open=Math.max(p.open||0, clampOpen(d.open)); roomOpen(); }
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
  NET.noSave=true; store('golf_host', undefined);
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
      if(!NET.welcomed){ toast('No se encontró la sala '+code+'. Revisá el código.'); store('golf_client',undefined); leaveToMenu(); }
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
  c.on('open', ()=>{ netBar(false); clearTimeout(NET.takeoverTimer); NET.takeoverTimer=null; c.send({t:'hello', name:myName(), emoji:myEmoji(), token:myToken, open:load('golf_open')}); });
  c.on('data', d=>{ if(NET.hostConn!==c) return; NET.lastHostMsg=Date.now(); if(NET.hostLost){ NET.hostLost=false; netBar(false); } clientOnData(d); });
  c.on('close', ()=>{ if(NET.mode!=='client' || NET.hostConn!==c) return; netBar(true,'Se perdió la conexión con el anfitrión. Reconectando…'); setTimeout(connectHost,3000); scheduleTakeover(); });
}
function clientOnData(d){
  if(!d) return;
  if(d.t==='ping'){ try{ NET.hostConn.send({t:'pong'}); }catch(e){} return; }
  if(d.t==='pong') return;
  if(d.t==='welcome'){
    NET.myPid=d.pid; NET.obs=d.obs||null; NET.welcomed=true;
    store('golf_client',{code:NET.code, at:Date.now()}); if(location.hash!=='#'+NET.code) history.replaceState(null,'','#'+NET.code);
    if(d.why) toast(d.why);
  }
  else if(d.t==='state'){ S=d.s; if(S.clock) CLK.off=S.clock-Date.now(); render(); }
  else if(d.t==='chat'){ CHAT.push(d.m); renderChat(d.m); }
  else if(d.t==='chatlog'){ CHAT=d.list||[]; renderChat(); }
  else if(d.t==='aim'){ REMOTE_AIM=Object.assign({}, d.a, {pid:d.pid, at:Date.now()}); }
  else if(d.t==='backup'){ NET.backup={s:d.s, chat:d.chat}; }
  else if(d.t==='migrate'){ NET.backup={s:d.s, chat:d.chat}; takeoverHost('handover'); }
  else if(d.t==='kicked'){ toast('🚪 El anfitrión te sacó de la cancha.'); store('golf_client',undefined); leaveToMenu(); }
  else if(d.t==='err'){ toast(d.m); AIM.sent=false; }
}
// la mira del que está tirando se ve en vivo en los otros aparatos
let REMOTE_AIM=null;
function relayAim(pid, a){
  if(!a) return;
  const x={ang:+a.ang||0, pow:+a.pow||0};
  if(pid!==me()) REMOTE_AIM=Object.assign({}, x, {pid, at:Date.now()});
  for(const id in NET.conns){ if(id===pid) continue; const c=NET.conns[id]; if(c && c.open) try{ c.send({t:'aim', a:x, pid}); }catch(e){} }
}
function sendAim(){
  if(NET.mode==='local' || !V || V.phase!=='play') return;
  const now=Date.now(); if(now-(sendAim.t||0)<90) { clearTimeout(sendAim.tm); sendAim.tm=setTimeout(sendAim, 100); return; }
  sendAim.t=now;
  const a={ang:AIM.ang, pow:AIM.pow};
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
// globito arriba de la cancha con lo último que dijeron
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
const SND={on:load('golf_snd')!==false, ctx:null};
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
  putt(p){ tone(900,.05,'triangle',.08+p*.12); noise(.04,.1+p*.25,0,2500); },
  wall(v){ tone(320,.07,'triangle',.05+v*.18); noise(.05,.05+v*.2,0,0,1200); },
  ball(v){ tone(1800,.05,'sine',.06+v*.15); },
  boing(){ const c=actx(); if(!SND.on||!c) return; const o=c.createOscillator(), g=c.createGain(), t=c.currentTime; o.frequency.setValueAtTime(220,t); o.frequency.exponentialRampToValueAtTime(880,t+.18); g.gain.setValueAtTime(.12,t); g.gain.exponentialRampToValueAtTime(.001,t+.3); o.connect(g).connect(c.destination); o.start(t); o.stop(t+.32); },
  cup(){ noise(.08,.25,0,0,900); tone(500,.06,'triangle',.1,.05); tone(420,.06,'triangle',.08,.13); tone(380,.08,'triangle',.07,.2); },
  water(){ noise(.5,.3,0,0,700); noise(.3,.15,.08,1500); },
  tube(){ noise(.6,.12,0,0,300); tone(120,.5,'sine',.08); },
  mill(){ tone(180,.12,'square',.05); noise(.08,.12,0,0,500); },
  sand(){ noise(.25,.1,0,2000); },
  lip(){ tone(700,.05,'triangle',.08); tone(560,.06,'triangle',.06,.05); },
  turn(){ tone(740,.12,'sine',.12); tone(988,.18,'sine',.12,.11); },
  ace(){ [523,659,784,1047,1319,1568].forEach((f,i)=>tone(f,.28,'square',.06,i*.08)); },
  good(){ [659,880,1175].forEach((f,i)=>tone(f,.22,'triangle',.12,i*.09)); },
  bad(){ tone(300,.2,'sawtooth',.06); tone(200,.3,'sawtooth',.06,.18); },
  win(){ [523,659,784,1047].forEach((f,i)=>tone(f,.3,'triangle',.14,i*.13)); },
  priv(){ tone(1200,.08,'sine',.08); tone(1500,.1,'sine',.08,.08); },
};
// el ruido de la pelota rodando por la alfombra (dura lo que rueda)
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
function toggleSound(){ SND.on=!SND.on; store('golf_snd', SND.on); $('#btnSnd').textContent=SND.on?'🔊':'🔇'; if(SND.on) sfx.turn(); }
$('#btnSnd').textContent=SND.on?'🔊':'🔇';
document.addEventListener('pointerdown', ()=>actx(), {once:true});
const MUSIC_CREDIT = 'Música: "Monkeys Spinning Monkeys" de Kevin MacLeod (incompetech.com). Licencia Creative Commons Atribución 4.0: creativecommons.org/licenses/by/4.0/';
const MUSIC = { on: load('golf_music')===true, buf:null, src:null, gain:null, loading:false, VOL:.07 };
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
function toggleMusic(){ MUSIC.on=!MUSIC.on; store('golf_music', MUSIC.on); musicSync(); toast(MUSIC.on?'🎶 Música de fondo prendida (suave).':'🔕 Música de fondo apagada.'); }
function renderMusicBtn(){ $$('.btnMusic').forEach(b=>{ b.textContent = MUSIC.on ? '🎶' : '🔕'; b.title = MUSIC.on ? 'Apagar la música de fondo' : 'Prender la música de fondo'; }); }
renderMusicBtn(); $('#musicCredit').textContent='🎶 '+MUSIC_CREDIT;


/* ====================== RENDER GENERAL ====================== */
function render(){
  if(!S) return;
  V = NET.mode==='client' ? S : publicState(me());
  if(V.phase==='lobby'){ show('lobby'); renderLobby(); }
  else { show('game'); renderGame(); }
  saveOpen(); renderSidePanels(); renderChatTo(); renderVoice(); voiceSync(); musicSync();
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
  $('#lobbyTitle').textContent = NET.mode==='local' ? '⛳ Cancha en este aparato' : '⛳ Sala de espera';
  $('#pcount').textContent=`(${V.players.length}/${MAXP})`;
  const teamBtn = p => eq ? `<button class="tbtn" style="background:${TEAMS[p.team].c}" ${host||p.id===me()?`onclick="doAct({type:'team',pid:'${p.id}'})"`:'disabled'} title="Cambiar de equipo">${TEAMS[p.team].e}</button>` : '';
  const ballBtn = p => `<button class="bbtn" ${mine(p.id)||host&&p.bot?`onclick="ballModal('${p.id}')"`:'disabled'} title="Color de la pelota">${ballDot(p.ball,24)}</button>`;
  const opn = p => p.bot ? '' : `<span class="muted" title="Hoyos que tiene abiertos">🔓${p.open||START_OPEN}</span>`;
  $('#plist').innerHTML=V.players.map(p=>`<li>${teamBtn(p)}${ballBtn(p)}${playerTag(p)}${opn(p)}${host && p.id!==V.hostPid?`<button class="btn sm gray" onclick="doAct({type:'kick',pid:'${p.id}'})" title="Sacar">✕</button>`:''}</li>`).join('')
    + (V.observers||[]).map(x=>`<li style="opacity:.75"><span style="font-size:20px">👀</span><span class="nm">${esc(x.name)} <span class="muted">mirando</span></span>${x.mic?'🎙️':''}</li>`).join('');
  const err=canStartV();
  $('#lobbyHostBtns').innerHTML = host
    ? `<div class="row"><button class="btn gray" onclick="doAct({type:'addBot'})" ${V.players.length>=MAXP?'disabled':''}>🤖 Sumar bot</button>
       ${NET.mode==='local'?`<button class="btn gray" onclick="addLocalClick()" ${V.players.length>=MAXP?'disabled':''}>🙋 Amigo en este aparato</button>`:''}
       <button class="btn green" onclick="doAct({type:'start'})">▶️ Empezar</button></div>
       <p class="muted">${err?'⚠️ '+esc(err):'¡Listo para empezar!'}${eq?' · Tocá 🔴/🔵 para cambiar a alguien de equipo.':''} · Tocá la pelota para cambiarle el color.</p>`
    : `<p class="muted" style="text-align:center">⏳ Esperando que el anfitrión 👑 empiece la partida…<br>Tocá tu pelota para elegir el color${eq?' y tu 🔴/🔵 para cambiarte de equipo':''}.</p>`;
  $('#lobbyObs').innerHTML = myObs ? `<div class="obsbar" style="border-radius:10px;margin-top:8px">👀 Estás mirando. ${V.players.length<MAXP?`<button class="btn sm gold" onclick="doAct({type:'joinNext'})">⛳ Sumarme a jugar</button>`:'La cancha está llena.'}</div>` : '';
  $('#holesBox').innerHTML = holesHTML(host);
  $('#optsBox').innerHTML = optsHTML(host);
  const g=$('#grulesBox');
  if(host){
    if(!g.querySelector('textarea')) g.innerHTML=`<textarea id="grulesIn" maxlength="1200" placeholder="Ej.: el que hace más golpes paga la gaseosa 🥤&#10;Si la pelota salta la banda, vale doble…"></textarea><p class="muted" style="margin:4px 0 0">Se guarda solo y lo ven todos.</p>`;
    const ta=$('#grulesIn'); if(document.activeElement!==ta) ta.value=V.grules||'';
    ta.oninput=()=>{ clearTimeout(ta.t); ta.t=setTimeout(()=>doAct({type:'grules', text:ta.value}), 600); };
  } else g.innerHTML = V.grules ? `<div class="grules">${esc(V.grules)}</div>` : `<p class="muted">El anfitrión todavía no escribió reglas propias.</p>`;
  $('#sugBox').innerHTML = sugsHTML(host);
}
function canStartV(){ const keep=S; S=V; try{ return canStart(); } finally{ S=keep; } }
function addLocalClick(){ const n=prompt('Nombre del amigo que juega en este aparato:'); if(n && n.trim()) doAct({type:'addLocal', name:n.trim()}); }
function ballModal(pid){
  const p=V.players.find(x=>x.id===pid); if(!p) return;
  modal(`<h2>⛳ Color de la pelota de ${esc(p.name)}</h2><div class="balls">${BALLS.map(c=>`<button onclick="doAct({type:'ballc',pid:'${pid}',c:'${c}'});closeModal()">${ballDot(c,46)}</button>`).join('')}</div><button class="btn gray wide" onclick="closeModal()">Cerrar</button>`);
}
function optsHTML(host){
  const o=V.opts, dis = host && V.phase==='lobby' ? '' : 'disabled';
  const sel=(k, list)=>`<select ${dis} onchange="doAct({type:'opt',k:'${k}',v:this.value})">${list.map(x=>`<option value="${x.v}" ${o[k]==x.v?'selected':''}>${x.t}</option>`).join('')}</select>`;
  const num=(k, t, min, max)=>`<label class="numopt">${t}<input type="number" min="${min}" max="${max}" value="${o[k]}" ${dis} onchange="doAct({type:'opt',k:'${k}',v:this.value})"></label>`;
  const chk=(k, t, d)=>`<label class="opt" style="margin:0 0 6px;font-weight:400"><input type="checkbox" ${o[k]?'checked':''} ${dis} onchange="doAct({type:'opt',k:'${k}',v:this.checked})"><span><b>${t}</b><small>${d}</small></span></label>`;
  const obj=(O)=>Object.keys(O).map(k=>({v:k, t:O[k].t||O[k]}));
  void num;
  return `<label style="margin-top:0">Modo de juego ${host?'':'<span class="muted">(lo elige el anfitrión)</span>'}</label>${sel('mode', obj(MODES))}
    <p class="muted" style="margin:4px 0 0">${esc(MODES[o.mode].d)}</p>
    <label>Cómo se juega</label>${sel('fmt', Object.keys(FORMATS).map(k=>({v:k, t:FORMATS[k]})))}
    <label>🏌️ Máximo de golpes por hoyo</label>${sel('max', MAXS)}
    <label>🎯 Dificultad (ayuda para apuntar)</label>${sel('aim', AIMS)}
    <label>⏰ Tiempo para tirar</label>${sel('timer', TIMERS)}
    <label>Nivel de los bots</label>${sel('bot', BOTLV)}
    <label>Reglas de la casa</label>`
    + HOUSE.map(h=>chk(h.k, h.t, h.d)).join('');
}
// los hoyos: cuáles están abiertos y desde cuál se juega
function holesHTML(host){
  const o=V.opts, dis = host ? '' : 'disabled', open=V.open||START_OPEN, from=Math.min(open, +o.from||1);
  const cards=HOLES.map((H,i)=>{
    const ok=i<open, inC = ok && i>=from-1 && (o.count==='all' || i<from-1+(+o.count));
    return `<button class="hole ${ok?'':'lock'} ${inC?'in':''}" ${ok&&host?`onclick="doAct({type:'opt',k:'from',v:${i+1}})"`:'disabled'} title="${esc(H.d)}">
      <b>${ok?i+1:'🔒'}</b><span>${esc(H.n)}</span><small>par ${H.par}</small></button>`;
  }).join('');
  return `<p class="muted" style="margin-top:0">🔓 Abiertos: <b>${open} de ${HOLES.length}</b>. ${open<HOLES.length?'Para abrir el siguiente hay que terminar el último hoyo abierto jugando de a 2 o más (personas o bots). Si alguien de la sala ya abrió más, se abren para todos.':'¡Están todos abiertos! 🎉'}</p>
    <div class="holes">${cards}</div>
    <div class="row" style="margin-top:8px"><div><label style="margin-top:0">Empezar en el hoyo</label><select ${dis} onchange="doAct({type:'opt',k:'from',v:this.value})">${HOLES.slice(0,open).map((H,i)=>`<option value="${i+1}" ${from===i+1?'selected':''}>${i+1}. ${esc(H.n)}</option>`).join('')}</select></div>
      <div><label style="margin-top:0">Cuántos hoyos</label><select ${dis} onchange="doAct({type:'opt',k:'count',v:this.value})">${COUNTS.map(x=>`<option value="${x.v}" ${String(o.count)===String(x.v)?'selected':''}>${x.t}</option>`).join('')}</select></div></div>`;
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
const CLK={off:0};
const hostNow = () => (Date.now() + (NET.mode==='client' ? CLK.off : 0))/1000;
const AIM={ang:Math.PI/2, pow:0, lastPow:+(load('golf_pow')||.45), sent:false, key:null, charging:false};
const ANIM={on:false, lastN:null, t0:0, shot:null, evI:0, end:0, sink:{}, wet:{}};
const curShooter = () => V && V.phase==='play' ? shooterOf(V) : null;
const myTurn = () => !!V && V.phase==='play' && !ANIM.on && mine(curShooter()) && !NET.obs;
const curHole = () => V && V.course && V.course.length ? V.course[Math.min(V.hi, V.course.length-1)] : 0;
const curUnit = () => V && V.units ? V.units[V.cur] : null;
function unitFrom(u){ const H=HOLES[curHole()]; return u && u.pos ? u.pos : {x:H.tee[0], y:H.tee[1]}; }
// los hoyos abiertos quedan guardados en este aparato
function saveOpen(){
  const p=V && V.players.find(x=>x.id===NET.myPid); if(!p || !p.open) return;
  const had=+(load('golf_open')||START_OPEN);
  if(p.open>had){ store('golf_open', p.open); if(V.phase!=='lobby') setTimeout(()=>toast(`🔓 ¡Se abrió el hoyo ${p.open}: ${HOLES[p.open-1].n}! Quedó guardado en este aparato.`), 2500); }
}

function renderGame(){
  $('#roomTag').textContent = NET.mode==='local' ? '📱 En este aparato' : '🔑 '+NET.code;
  $('#obsbar').style.display = NET.obs ? 'block' : 'none';
  if(NET.obs) $('#obsbar').textContent = '👀 Estás mirando la partida.';
  if(ANIM.lastN==null) ANIM.lastN = V.shot ? V.shot.n : 0;   // al entrar no se repite el último golpe
  else if(V.shot && V.shot.n!==ANIM.lastN){
    ANIM.lastN=V.shot.n;
    if(V.shot.tracks) startAnim(V.shot);
    AIM.sent=false;
  }
  const key = V.phase==='play' ? `${V.hi}|${V.cur}|${V.shotN}` : null;
  if(key && key!==AIM.key){ AIM.key=key; AIM.pow=0; AIM.sent=false; paintPower(); aimAtCup(); CAM3.yawOff=0; }
  renderScore(); renderCtrl(); renderHoleInfo();
  if(!ANIM.on) afterShotUI();
}
function aimAtCup(){ const u=curUnit(); if(!u) return; const f=unitFrom(u), H=HOLES[curHole()]; AIM.ang=Math.atan2(H.cup[1]-f.y, H.cup[0]-f.x); }

// ---------- tarjeta de puntos ----------
function cardHTML(st, big){
  const T=totals(st), cols=st.course, curSide = st.phase==='play' && st.units[st.cur] ? st.units[st.cur].side : -1;
  const head=`<tr><th class="nmh"></th>${cols.map((ci,h)=>`<th class="${h===st.hi&&st.phase==='play'?'now':''}">${ci+1}<small>par ${HOLES[ci].par}</small></th>`).join('')}<th>Total</th></tr>`;
  const rows=st.sides.map((sd,si)=>{
    const color = sd.team!=null ? TEAMS[sd.team].c : (st.players.find(p=>p.id===sd.pids[0])||{}).color||'#888';
    const names = sd.team!=null ? `${TEAMS[sd.team].e} ${sd.pids.map(pid=>{ const p=st.players.find(x=>x.id===pid); return p?`<span class="${pid===shooterOf(st)&&st.phase==='play'?'shoot':''}">${esc(p.name)}</span>`:''; }).join(', ')}`
      : (()=>{ const p=st.players.find(x=>x.id===sd.pids[0])||{}; return `${ballDot(p.ball||'#fff',14)} ${esc(p.emoji||'')} ${esc(p.name||'?')}${p.bot?'🤖':''}${!p.bot&&p.conn===false?'⚠️':''}${p.mic?'🎙️':''}`; })();
    const cells=cols.map((ci,h)=>{
      let v=sideHole(st, si, h), live=false;
      if(v==null && h===st.hi && st.phase==='play'){ const us=st.units.filter(u=>u.side===si && u.strokes>0); if(us.length){ v=Math.min(...us.map(u=>u.strokes)); live=true; } }
      const par=HOLES[ci].par, raw=st.units.filter(u=>u.side===si).map(u=>u.card[h]);
      const cls = v==null ? '' : live ? 'live' : raw.includes(1) ? 'ace' : v<par ? 'bir' : v>par ? 'bog' : 'par';
      return `<td class="${cls}">${v==null?'':v}${live?'…':''}</td>`;
    }).join('');
    const t=T[si], tot = st.opts.mode==='golpes' ? `${t.strokes}<small>${t.holes?parTxt(t.strokes-t.par):''}</small>` : st.opts.mode==='hoyos' ? `${t.won}<small>hoyos</small>` : `${t.pts}<small>puntos</small>`;
    return `<tr class="${curSide===si?'on':''}" style="--pc:${color}"><td class="nmc">${names}</td>${cells}<td class="tt">${tot}</td></tr>`;
  }).join('');
  return `<table class="card${big?' big':''}">${head}${rows}</table>`;
}
function renderScore(){
  if(ANIM.on) return;   // el puntaje se actualiza recién cuando se queda quieta la pelota
  const el=$('#score'); el.innerHTML=cardHTML(V);
  const on=el.querySelector('tr.on'); if(on && el.scrollHeight>el.clientHeight) el.scrollTop=on.offsetTop-24;
  const now=el.querySelector('th.now'); if(now) el.scrollLeft=Math.max(0, now.offsetLeft-el.clientWidth/2);
}
function cardModal(){ modal(`<h2>📋 Tarjeta</h2><div style="overflow-x:auto">${cardHTML(V,true)}</div><p class="muted">${esc(MODES[V.opts.mode].t)} · ${esc(FORMATS[V.opts.fmt])}</p><button class="btn gray wide" onclick="closeModal()">Cerrar</button>`); }
function renderHoleInfo(){
  if(!V || V.phase==='lobby') return;
  const ci=curHole(), H=HOLES[ci], u=curUnit();
  $('#holeinfo').innerHTML = `⛳ <b>Hoyo ${ci+1}</b> · ${esc(H.n)} · par ${H.par}${V.phase==='play'&&u?` · golpe ${u.strokes+1}`:''}`;
}

// ---------- controles ----------
function renderCtrl(){
  const my=myTurn(), sh=curShooter(), p=V.players.find(x=>x.id===sh), o=V.opts, u=curUnit();
  let st='';
  if(V.phase==='play'){
    const g = u ? `golpe ${u.strokes+1}` : '';
    if(ANIM.on) st='⛳ …';
    else if(my){
      const who = NET.mode==='local' && V.players.filter(x=>!x.bot).length>1 ? `<b>${esc(p.name)}</b>, ` : '';
      st = `${who}te toca · ${g}`;
    } else st = `Juega <b>${esc(p?p.name:'?')}</b>${p&&p.bot?' 🤖':''} · ${g}`;
    if(o.timer && !ANIM.on && p && !p.bot){ const left=Math.max(0, Math.ceil((Math.max(V.turnAt, V.busyUntil)+o.timer*1000-Date.now())/1000)); st+=` · ⏰ ${left}s`; }
  } else if(V.phase==='holeEnd') st='🏁 Fin del hoyo';
  else if(V.phase==='over') st='🏆 Fin de la vuelta';
  $('#status').innerHTML=st;
  $('#ctrl').classList.toggle('dis', !my);
}
setInterval(()=>{
  // si la pestaña estuvo escondida la animación no avanza: igual se cierra para no trabar el turno
  if(ANIM.on && animFrame()>ANIM.end+45) endAnim();
  if(V && V.phase==='play' && V.opts.timer && $('#game').classList.contains('on')) renderCtrl();
}, 1000);
function turnAim(d){ if(!myTurn()) return; AIM.ang+=d; sendAim(); }
(function(){
  const fs=$('#fine'); let lx=null;
  fs.addEventListener('pointerdown', e=>{ if(!myTurn()) return; fs.setPointerCapture(e.pointerId); lx=e.clientX; });
  fs.addEventListener('pointermove', e=>{ if(lx==null) return; const d=e.clientX-lx; lx=e.clientX; turnAim(-d*.0012); fs.style.backgroundPositionX=(parseFloat(fs.style.backgroundPositionX||0)+d)+'px'; });
  const end=()=>{ lx=null; }; fs.addEventListener('pointerup', end); fs.addEventListener('pointercancel', end);
  const hold=(btn, fn)=>{ let t=null; const go=()=>{ fn(); t=setTimeout(go, t?40:350); };
    btn.addEventListener('pointerdown', e=>{ e.preventDefault(); if(!myTurn()) return; t=null; go(); });
    ['pointerup','pointerleave','pointercancel'].forEach(k=>btn.addEventListener(k, ()=>{ clearTimeout(t); t=null; })); };
  hold($('#aimL'), ()=>turnAim(.006)); hold($('#aimR'), ()=>turnAim(-.006));
})();
function aimCup(){ if(!myTurn()) return; aimAtCup(); sendAim(); }
// fuerza: se tira para abajo y se suelta
(function(){
  const bar=$('#power'); let y0=null;
  const set=e=>{ const r=bar.getBoundingClientRect(); AIM.pow=Math.max(0, Math.min(1, (e.clientY-y0)/(r.height*.85))); paintPower(); sendAim(); };
  bar.addEventListener('pointerdown', e=>{ if(!myTurn() || AIM.sent) return; e.preventDefault(); bar.setPointerCapture(e.pointerId); y0=e.clientY; AIM.charging=true; AIM.pow=0; paintPower(); });
  bar.addEventListener('pointermove', e=>{ if(y0!=null) set(e); });
  bar.addEventListener('pointerup', ()=>{ if(y0==null) return; y0=null; AIM.charging=false; if(AIM.pow>.02) shoot(); else { AIM.pow=0; paintPower(); } });
  bar.addEventListener('pointercancel', ()=>{ y0=null; AIM.charging=false; AIM.pow=0; paintPower(); });
})();
function paintPower(){ $('#powFill').style.height=(AIM.pow*100)+'%'; $('#powTxt').textContent = AIM.pow>0 ? Math.round(AIM.pow*100)+'%' : '⬇️'; }
function shoot(){
  if(!myTurn() || AIM.sent) return;
  AIM.sent=true; AIM.lastPow=AIM.pow; store('golf_pow', AIM.pow);
  doAct({type:'shot', ang:AIM.ang, pow:AIM.pow});
  setTimeout(()=>{ AIM.pow=0; paintPower(); }, 200);
}
const KEYPOW={t0:0};   // con la barra espaciadora la fuerza sube y baja: soltás cuando querés
document.addEventListener('keydown', e=>{
  if(!V || V.phase!=='play' || !$('#game').classList.contains('on') || e.target.tagName==='INPUT' || e.target.tagName==='TEXTAREA' || e.target.tagName==='SELECT') return;
  const k=e.key.toLowerCase();
  if(k==='arrowleft'||k==='arrowright'){ e.preventDefault(); turnAim((k==='arrowleft'?1:-1)*(e.shiftKey?.002:.012)); }
  if(e.key===' ' && myTurn() && !e.repeat){ e.preventDefault(); KEYPOW.t0=performance.now(); AIM.charging=true; }
});
document.addEventListener('keyup', e=>{ if(e.key===' ' && KEYPOW.t0){ const p=AIM.pow; KEYPOW.t0=0; AIM.charging=false; if(p>.02) shoot(); else { AIM.pow=0; paintPower(); } } });
function keyPowTick(){ if(KEYPOW.t0 && myTurn()){ const t=(performance.now()-KEYPOW.t0)/1400; AIM.pow=Math.abs(((t+1)%2)-1); paintPower(); sendAim(); } }

// ---------- animación del golpe ----------
function startAnim(shot){
  ANIM.on=true; ANIM.shot=shot; ANIM.t0=performance.now(); ANIM.evI=0; ANIM.end=shot.frames+24; ANIM.sink={}; ANIM.wet={};
  sfx.putt(shot.pow||.5); rollStart(); REMOTE_AIM=null; CAM3.shotStart=performance.now();
}
const animFrame = () => (performance.now()-ANIM.t0)/1000*30;
function endAnim(){ ANIM.on=false; rollStop(); afterShotUI(true); renderScore(); renderCtrl(); renderHoleInfo(); renderSidePanels(); }
function trackAt(t, f){
  const n=t.length/2; let k=Math.floor(f); if(k>=n-1){ k=n-1; f=k; }
  const a=f-k, x0=t[k*2], y0=t[k*2+1];
  if(x0===-99999) return null;
  if(k+1>=n) return [x0/10, y0/10];
  const x1=t[k*2+2], y1=t[k*2+3]; if(x1===-99999) return [x0/10, y0/10];
  return [(x0+(x1-x0)*a)/10, (y0+(y1-y0)*a)/10];
}
const colOf = u => { const p=V.players.find(x=>x.id===u.pids[0]); return p ? p.ball : '#ffffff'; };
// lo que se ve ahora: dónde está cada pelota
function dispState(){
  const H=HOLES[curHole()], list=[];
  if(ANIM.on){
    const sh=ANIM.shot, f=animFrame();
    while(ANIM.evI<(sh.ev||[]).length && sh.ev[ANIM.evI].f<=f){ const e=sh.ev[ANIM.evI++];
      if(e.k==='w') sfx.wall(e.v); else if(e.k==='b') sfx.boing(); else if(e.k==='k') sfx.ball(e.v); else if(e.k==='m') sfx.mill();
      else if(e.k==='s') sfx.sand(); else if(e.k==='l') sfx.lip(); else if(e.k==='t'){ sfx.tube(); rollStop(); setTimeout(()=>{ if(ANIM.on) rollStart(); }, 650); }
      else if(e.k==='c'){ sfx.cup(); ANIM.sink[e.id]=e.f; if(e.id===sh.unit) rollStop(); }
      else if(e.k==='a'){ sfx.water(); ANIM.wet[e.id]=e.f; if(e.id===sh.unit) rollStop(); } }
    if(f>=sh.frames-1) rollStop();
    if(f>=ANIM.end) endAnim();
    else {
      for(const id in sh.tracks){ const p=trackAt(sh.tracks[id], f); if(!p) continue; const u=V.units.find(x=>x.id===id);
        const sk=ANIM.sink[id], wt=ANIM.wet[id];
        list.push({id, x:p[0], y:p[1], col:u?colOf(u):'#fff', moving:true, sink: sk!=null&&f>=sk ? Math.min(1,(f-sk)/6) : 0, wet: wt!=null&&f>=wt ? Math.min(1,(f-wt)/12) : 0}); }
      V.units.forEach(u=>{ if(sh.tracks[u.id] || !u.pos || u.done) return; list.push({id:u.id, x:u.pos.x, y:u.pos.y, col:colOf(u)}); });
      return {balls:list, anim:true};
    }
  }
  if(V.phase!=='lobby') V.units.forEach((u,i)=>{
    if(u.done) return;
    const cur = i===V.cur && V.phase==='play';
    if(u.pos) list.push({id:u.id, x:u.pos.x, y:u.pos.y, col:colOf(u), cur});
    else if(cur) list.push({id:u.id, x:H.tee[0], y:H.tee[1], col:colOf(u), cur});
  });
  return {balls:list, anim:false};
}
const aimNow = () => { const sh=curShooter(); if(mine(sh) && !NET.obs) return {ang:AIM.ang, pow:AIM.pow, me:true}; if(REMOTE_AIM && REMOTE_AIM.pid===sh) return REMOTE_AIM; return null; };
let LASTRES=null;
function afterShotUI(justEnded){
  if(!V || !V.shot || !V.shot.res) return;
  if(LASTRES===V.shot.n) return; LASTRES=V.shot.n;
  if(!justEnded){ endModal(); return; }
  const r=V.shot.res;
  if(r.ace){ bigText('🌟 ¡HOYO EN UNO!'); sfx.ace(); }
  else if(r.inn){ bigText(r.msg.split(' · ')[0]); sfx.good(); banner(r.msg, ''); }
  else if(r.wet || r.picked){ banner(r.msg, 'bad'); sfx.bad(); }
  else if(r.msg) banner(r.msg, '');
  if(myTurn()){ sfx.turn(); if(curShooter()!==V.shot.pid) yourTurn(); }
  endModal();
}
function banner(t, cls){ const b=$('#banner'); b.className='banner '+(cls||''); b.textContent=t; b.style.display='block'; clearTimeout(banner.t); banner.t=setTimeout(()=>b.style.display='none', 3000); }
function bigText(t){ const d=document.createElement('div'); d.className='bigtext'; d.textContent=t; $('#stage').appendChild(d); setTimeout(()=>d.remove(), 2200); }
function yourTurn(){ const d=document.createElement('div'); d.className='yourturn'; d.textContent='⛳ ¡Te toca!'; document.body.appendChild(d); setTimeout(()=>d.remove(),1700); }

// fin del hoyo / de la vuelta
let ENDSHOWN=null;
function endModal(){
  if(!V || (V.phase!=='holeEnd' && V.phase!=='over') || !V.holeEnd){ if(ENDSHOWN && V && V.phase==='play'){ ENDSHOWN=null; closeModal(); } return; }
  if(ANIM.on) return;
  const key=V.phase+'|'+V.hi+'|'+(V.startedAt||0); if(ENDSHOWN===key) return; ENDSHOWN=key;
  const host=amHost(), over=V.phase==='over', he=V.holeEnd, ci=V.course[he.h], H=HOLES[ci];
  const best=Math.min(...he.sc.filter(v=>v!=null));
  const res=V.sides.map((s,i)=>({i, v:he.sc[i]})).sort((a,b)=>a.v-b.v).map(x=>`<tr><td>${x.v===best?'🏅 ':''}${esc(sideName(V,x.i))}</td><td style="text-align:right"><b>${x.v}</b> <span class="muted">${holeName(x.v-H.par).replace(/^\S+ /,'')}</span></td></tr>`).join('');
  const unl = he.unlocked ? `<div class="unlock">🔓 ¡Se abrió el hoyo ${he.unlocked}: <b>${esc(HOLES[he.unlocked-1].n)}</b>!${V.course.includes(he.unlocked-1)?' Se suma a esta vuelta.':''}</div>` : '';
  let top='';
  if(over){
    const w=V.win, iWon=w.ties.some(i=>V.sides[i].pids.some(pid=>mine(pid))); if(iWon) sfx.win();
    const T=totals(V), t=T[w.ties[0]];
    const how = V.opts.mode==='golpes' ? `${t.strokes} golpes (${parTxt(t.strokes-t.par)})` : V.opts.mode==='hoyos' ? `${t.won} hoyo${t.won===1?'':'s'} ganado${t.won===1?'':'s'}` : `${t.pts} puntos`;
    top=`<p style="font-size:18px"><b>${esc(w.ties.map(i=>sideName(V,i)).join(' y '))}</b> ${w.tie?'empatan':'gana'} con <b>${how}</b> 🎉</p>`;
  }
  modal(`<h2>${over?'🏆 ¡Terminó la vuelta!':`🏁 Hoyo ${ci+1} terminado`}</h2>${top}
    <p class="muted" style="margin:0 0 4px">Hoyo ${ci+1} · ${esc(H.n)} · par ${H.par}</p><table class="score">${res}</table>${unl}
    <div style="overflow-x:auto">${cardHTML(V,true)}</div>
    ${host ? (over ? `<button class="btn green wide" onclick="closeModal();doAct({type:'rematch'})">🔁 Revancha</button><button class="btn wide" style="margin-top:6px" onclick="closeModal();doAct({type:'newGame'})">⚙️ Volver a la sala (cambiar hoyos o reglas)</button>`
                   : `<button class="btn green wide" onclick="closeModal();doAct({type:'nextHole'})">▶️ Siguiente hoyo</button><p class="muted">Si no, arranca solo en unos segundos.</p>`)
           : `<p class="muted">${over?'El anfitrión elige si hay revancha.':'El siguiente hoyo arranca en unos segundos…'}</p>`}
    <button class="btn gray wide" style="margin-top:6px" onclick="closeModal()">Mirar la cancha</button>`);
}

/* ====================== CANCHA 3D ====================== */
const R3={renderer:null, built:-1, balls:{}};
const CAM3=Object.assign({mode:'tiro', h:0, zoom:1}, load('golf_cam3')||{}); CAM3.yawOff=0; CAM3.shotStart=0;
function saveCam3(){ store('golf_cam3', {mode:CAM3.mode, h:CAM3.h, zoom:CAM3.zoom}); }
const W3 = (x,y,h) => new THREE.Vector3(x, h||0, -y);
const stage=$('#stage'), cv3=$('#c3d');
function resizeStage(){
  const r=stage.getBoundingClientRect();
  if(R3.renderer){ R3.renderer.setSize(r.width, r.height, false); R3.cam.aspect=r.width/Math.max(1,r.height); R3.cam.updateProjectionMatrix();
    if(R3.parts) R3.parts.m.uniforms.uPx.value=r.height*R3.renderer.getPixelRatio()/(2*Math.tan(25*Math.PI/180)); }
}
// partículas (chapuzón, papelitos al embocar): un solo dibujo
const PART_VS=`attribute float aSize; attribute vec4 aCol; uniform float uPx; varying vec4 vC;
void main(){ vC=aCol; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=aSize*uPx/max(1.0,-mv.z); gl_Position=projectionMatrix*mv; }`;
const PART_FS=`varying vec4 vC; void main(){ float d=length(gl_PointCoord-.5)*2.0; float a=smoothstep(1.0,.3,d); if(a<.01) discard; gl_FragColor=vec4(vC.rgb,vC.a*a); }`;
function emitP(p){ const s=R3.parts; if(!s || s.list.length>=s.cap) return; p.age=0; s.list.push(p); }
function stepParts(dt){
  const s=R3.parts, L=s.list, pos=s.pos, col=s.col, siz=s.siz; let n=0;
  for(let i=0;i<L.length;i++){ const p=L[i]; p.age+=dt; if(p.age>=p.life) continue;
    p.vy-=p.g*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.z+=p.vz*dt; if(p.y<p.floor){ p.y=p.floor; p.vy=0; p.vx*=.6; p.vz*=.6; }
    const k=p.age/p.life; L[n]=p; pos[n*3]=p.x; pos[n*3+1]=p.y; pos[n*3+2]=p.z; siz[n]=p.s*(1-k*.4);
    col[n*4]=p.c[0]; col[n*4+1]=p.c[1]; col[n*4+2]=p.c[2]; col[n*4+3]=p.a*Math.min(1,(1-k)*2.5); n++; }
  L.length=n; s.geo.setDrawRange(0,n); s.geo.attributes.position.needsUpdate=true; s.geo.attributes.aCol.needsUpdate=true; s.geo.attributes.aSize.needsUpdate=true;
}
function fxSplash(x, y, z){ for(let k=0;k<46;k++){ const a=Math.random()*6.28, v=6+Math.random()*16; emitP({x, y, z, vx:Math.cos(a)*v, vy:28+Math.random()*34, vz:Math.sin(a)*v, g:120, floor:y-2, life:.9+Math.random()*.5, s:1.6+Math.random()*1.4, c:Math.random()<.5?[1,1,1]:[.7,.9,1], a:.9}); } }
function fxCup(x, y, z){ const C=[[1,.84,.3],[.84,.17,.12],[1,1,1],[.1,.3,.8],[.3,.8,.35]];
  for(let k=0;k<70;k++){ const a=Math.random()*6.28, v=8+Math.random()*26; emitP({x, y:y+2, z, vx:Math.cos(a)*v, vy:55+Math.random()*60, vz:Math.sin(a)*v, g:95, floor:y+.4, life:1.6+Math.random()*1.2, s:1.5+Math.random()*1.3, c:C[k%5], a:1}); } }
window.addEventListener('resize', ()=>{ if($('#game').classList.contains('on')) resizeStage(); });
function canvasTex(w, h, draw){ const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'), w, h); const t=new THREE.CanvasTexture(c); t.anisotropy=4; return t; }
function init3D(){
  if(R3.renderer || !window.THREE) return !!R3.renderer;
  const T=THREE;
  let renderer;
  try{ renderer=new T.WebGLRenderer({canvas:cv3, antialias:true}); }catch(e){ $('#no3d').style.display='flex'; return false; }
  const mobile=/Android|iPhone|iPad/i.test(navigator.userAgent);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, mobile?1.5:2));
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=T.PCFSoftShadowMap;
  const scene=new T.Scene();
  scene.background=new T.Color(0xd6ebf8);
  scene.fog=new T.Fog(0xd6ebf8, 1300, 4600);
  const cam=new T.PerspectiveCamera(50, 1, 1, 12000);
  Object.assign(R3, {renderer, scene, cam, T, mobile});
  // cielo: degradé, sol y nubes pintados en una cúpula
  const sunV=new T.Vector3(220, 520, 260).normalize();
  const sky=canvasTex(1024, 512, (g,w,h)=>{
    const gr=g.createLinearGradient(0,0,0,h/2); gr.addColorStop(0,'#2f7fd0'); gr.addColorStop(.5,'#74b4e8'); gr.addColorStop(.85,'#bfe0f6'); gr.addColorStop(1,'#e4f3fb'); g.fillStyle=gr; g.fillRect(0,0,w,h/2);
    g.fillStyle='#d6ebf8'; g.fillRect(0,h/2,w,h/2);
    const su=((Math.atan2(sunV.z, -sunV.x)/(Math.PI*2))%1+1)%1*w, sv=Math.acos(sunV.y)/Math.PI*h;
    for(const [r,a] of [[150,.25],[70,.4],[26,.9]]){ const g2=g.createRadialGradient(su,sv,0,su,sv,r); g2.addColorStop(0,`rgba(255,250,225,${a})`); g2.addColorStop(1,'rgba(255,250,225,0)'); g.fillStyle=g2; g.fillRect(su-r,sv-r,r*2,r*2); }
    g.fillStyle='#fffef4'; g.beginPath(); g.arc(su,sv,11,0,7); g.fill();
    for(let k=0;k<34;k++){ const cx=Math.random()*w, cy=120+Math.random()*110, cw=40+Math.random()*80;
      for(let j=0;j<9;j++){ const x=cx+(Math.random()-.5)*cw*1.7, y=cy+(Math.random()-.5)*12, r=10+Math.random()*cw*.3, g2=g.createRadialGradient(x,y,0,x,y,r); g2.addColorStop(0,'rgba(255,255,255,.6)'); g2.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=g2; g.fillRect(x-r,y-r*.55,r*2,r*1.1); } }
  });
  const dome=new T.Mesh(new T.SphereGeometry(9000, 32, 16), new T.MeshBasicMaterial({map:sky, side:T.BackSide, fog:false, depthWrite:false})); dome.renderOrder=-1; scene.add(dome); R3.dome=dome;
  scene.add(new T.HemisphereLight(0xeaf5ff, 0x4a6a34, .72));
  const sun=new T.DirectionalLight(0xfff0d0, .92); sun.castShadow=true; sun.shadow.mapSize.set(mobile?1024:2048, mobile?1024:2048); sun.shadow.bias=-.0006; sun.shadow.normalBias=.6;
  scene.add(sun, sun.target); R3.sun=sun;
  // pasto de alrededor (con hojitas y florcitas) y lomas a lo lejos
  R3.grassTex=canvasTex(256, 256, (g,w,h)=>{ g.fillStyle='#4d8739'; g.fillRect(0,0,w,h);
    for(let i=0;i<5200;i++){ const x=Math.random()*w, y=Math.random()*h, l=2+Math.random()*5; g.strokeStyle=`rgba(${Math.random()<.5?'28,66,18':'150,205,92'},.38)`; g.beginPath(); g.moveTo(x,y); g.lineTo(x+(Math.random()-.5)*2.5,y-l); g.stroke(); }
    for(let i=0;i<26;i++){ g.fillStyle=['#ffffff','#ffd54a','#f58ab8'][i%3]; g.beginPath(); g.arc(Math.random()*w, Math.random()*h, 1.4, 0, 7); g.fill(); } });
  R3.grassTex.wrapS=R3.grassTex.wrapT=T.RepeatWrapping; R3.grassTex.repeat.set(90,90);
  const out=new T.Mesh(new T.PlaneGeometry(12000,12000), new T.MeshStandardMaterial({map:R3.grassTex, roughness:1})); out.rotation.x=-Math.PI/2; out.position.y=-10; out.receiveShadow=true; scene.add(out); R3.out=out;
  const hillG=new T.SphereGeometry(1, 14, 8), hillM=[0x4f8f45,0x3f7d3a,0x5a9a4c].map(c=>new T.MeshLambertMaterial({color:c}));
  R3.hills=new T.Group(); for(let i=0;i<18;i++){ const a=i/18*Math.PI*2+Math.random()*.2, rr=2700+Math.random()*700, r=420+Math.random()*380, hm=new T.Mesh(hillG, hillM[i%3]); hm.scale.set(r, r*(.22+Math.random()*.16), r); hm.position.set(Math.cos(a)*rr, -30, Math.sin(a)*rr); R3.hills.add(hm); } scene.add(R3.hills);
  // agua que se mueve y hoyuelos de la pelota
  // hojas, corteza y hoja de pindó
  R3.leafTex=canvasTex(128, 128, (g,w,h)=>{ g.fillStyle='#e0e0e0'; g.fillRect(0,0,w,h);
    for(let i=0;i<1100;i++){ g.fillStyle=Math.random()<.55?`rgba(30,30,30,${.05+Math.random()*.1})`:`rgba(255,255,255,${.2+Math.random()*.4})`; g.beginPath(); g.ellipse(Math.random()*w, Math.random()*h, 1.6+Math.random()*3.2, 1+Math.random()*1.8, Math.random()*3, 0, 7); g.fill(); } });
  R3.leafTex.wrapS=R3.leafTex.wrapT=T.RepeatWrapping; R3.leafTex.repeat.set(3,2);
  R3.barkTex=canvasTex(64, 128, (g,w,h)=>{ g.fillStyle='#cfcfcf'; g.fillRect(0,0,w,h);
    for(let i=0;i<70;i++){ const x=Math.random()*w; g.strokeStyle=`rgba(${Math.random()<.6?'25,20,15':'255,250,240'},${.15+Math.random()*.3})`; g.lineWidth=1+Math.random()*2.5; g.beginPath(); g.moveTo(x, Math.random()*h); g.lineTo(x+(Math.random()-.5)*6, Math.random()*h); g.stroke(); }
    for(let y=6;y<h;y+=16){ g.fillStyle='rgba(20,15,10,.22)'; g.fillRect(0,y,w,2.5); } });
  R3.barkTex.wrapS=R3.barkTex.wrapT=T.RepeatWrapping; R3.barkTex.repeat.set(2,1);
  R3.frondTex=canvasTex(256, 96, (g,w,h)=>{ g.lineCap='round';
    for(let i=0;i<46;i++){ const t=i/46, x=6+t*(w-22), l=(h/2-3)*(1-t*t*.75)*(i<4?.4+i*.15:1);
      for(const sg of [-1,1]){ g.strokeStyle=['#2f8a3a','#3fa147','#27753a','#56b356'][(i+(sg>0?1:0))%4]; g.lineWidth=4.2; g.beginPath(); g.moveTo(x, h/2); g.quadraticCurveTo(x+7, h/2+sg*l*.6, x+15, h/2+sg*l); g.stroke(); } }
    g.strokeStyle='#8fae4a'; g.lineWidth=3; g.beginPath(); g.moveTo(0,h/2); g.lineTo(w-6,h/2); g.stroke(); });
  R3.waterU={uT:{value:0}, uSun:{value:sunV.clone()}};
  R3.ballBump=canvasTex(128, 64, (g,w,h)=>{ g.fillStyle='#b0b0b0'; g.fillRect(0,0,w,h); for(let j=0;j<8;j++) for(let i=0;i<16;i++){ const x=(i+(j%2?.5:0))*8+4, y=j*8+4, gr=g.createRadialGradient(x,y,0,x,y,3.2); gr.addColorStop(0,'#3a3a3a'); gr.addColorStop(1,'#b0b0b0'); g.fillStyle=gr; g.fillRect(x-4,y-4,8,8); } });
  R3.ballBump.wrapS=T.RepeatWrapping;
  { const cap=320, geo=new T.BufferGeometry(), pos=new Float32Array(cap*3), col=new Float32Array(cap*4), siz=new Float32Array(cap);
    geo.setAttribute('position', new T.BufferAttribute(pos,3)); geo.setAttribute('aCol', new T.BufferAttribute(col,4)); geo.setAttribute('aSize', new T.BufferAttribute(siz,1)); geo.setDrawRange(0,0);
    const m=new T.ShaderMaterial({uniforms:{uPx:{value:600}}, vertexShader:PART_VS, fragmentShader:PART_FS, transparent:true, depthWrite:false});
    const pts=new T.Points(geo, m); pts.frustumCulled=false; pts.renderOrder=9; scene.add(pts); R3.parts={pts, geo, m, pos, col, siz, cap, list:[]}; }
  R3.holeG=new T.Group(); scene.add(R3.holeG);
  // línea de ayuda, anillo de la pelota que juega y el palo
  R3.guide=new T.Line(new T.BufferGeometry().setFromPoints([...Array(240)].map(()=>new T.Vector3())), new T.LineDashedMaterial({color:0xffffff, dashSize:4, gapSize:3, transparent:true, opacity:.9}));
  R3.guide.frustumCulled=false; scene.add(R3.guide);
  R3.ring=new T.Mesh(new T.RingGeometry(BR+1.2, BR+2.2, 32), new T.MeshBasicMaterial({color:0xffd54a, transparent:true, opacity:.8, side:T.DoubleSide, depthWrite:false})); R3.ring.rotation.x=-Math.PI/2; scene.add(R3.ring);
  const putter=new T.Group(), steel=new T.MeshStandardMaterial({color:0xcfd6dd, metalness:.8, roughness:.3});
  const head=new T.Mesh(new T.BoxGeometry(2.6, 3, 10), steel); head.position.y=1.5; head.castShadow=true; putter.add(head);
  // el palo se inclina hacia el costado, donde estaría parado el jugador
  const lean=.85, shaft=new T.Mesh(new T.CylinderGeometry(.45,.45,30,8), steel); shaft.rotation.x=lean; shaft.position.set(0, 2+Math.cos(lean)*15, Math.sin(lean)*15); shaft.castShadow=true; putter.add(shaft);
  const grip=new T.Mesh(new T.CylinderGeometry(.75,.7,10,8), new T.MeshStandardMaterial({color:0x111111, roughness:.8})); grip.rotation.x=lean; grip.position.set(0, 2+Math.cos(lean)*33, Math.sin(lean)*33); putter.add(grip);
  scene.add(putter); R3.putter=putter;
  wire3DInput(cv3);
  resizeStage();
  return true;
}
// agua de verdad: olitas, reflejo del cielo y brillo del sol
const WATER_VS='varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }';
const WATER_FS=`uniform float uT; uniform vec3 uSun; varying vec3 vW;
float wv(vec2 p){ return sin(p.x*.21+uT*1.3)+sin(p.y*.17-uT*1.1)+sin((p.x+p.y)*.12+uT*.8)+sin((p.x-p.y)*.33+uT*1.9)*.5+sin(p.x*.61-p.y*.47+uT*2.6)*.25; }
void main(){ vec2 p=vW.xz; float h=wv(p), hx=wv(p+vec2(.6,0.)), hz=wv(p+vec2(0.,.6));
  vec3 n=normalize(vec3((h-hx)*.4, 1., (h-hz)*.4)), v=normalize(cameraPosition-vW);
  float fr=pow(1.-max(dot(n,v),0.),3.);
  vec3 col=mix(vec3(.04,.30,.52), vec3(.16,.60,.76), clamp(.5+n.x*2.5+n.z*1.5,0.,1.));
  col=mix(col, vec3(.78,.91,1.), fr*.75+.06);
  float sp=pow(max(dot(reflect(-uSun,n),v),0.),70.); col+=vec3(1.,.97,.85)*sp*1.3;
  col+=vec3(.9,.97,1.)*smoothstep(1.9,2.6,h)*.22;
  gl_FragColor=vec4(col, .74+fr*.22+sp*.3); }`;
// la arena y el agua están hundidas: cuánto baja el piso en cada punto (solo para dibujar)
function edgeDist(pts, x, y){ let m=1e9; for(let i=0, j=pts.length-1; i<pts.length; j=i++){ const ax=pts[j][0], ay=pts[j][1], ex=pts[i][0]-ax, ey=pts[i][1]-ay, t=Math.max(0, Math.min(1, ((x-ax)*ex+(y-ay)*ey)/(ex*ex+ey*ey))), dx=x-ax-ex*t, dy=y-ay-ey*t, d=dx*dx+dy*dy; if(d<m) m=d; } return Math.sqrt(m); }
function dipAt(x, y){ let h=0; for(const d of R3.dips||[]){ if(x<d.x0 || x>d.x1 || y<d.y0 || y>d.y1 || !inPoly(d.pts,x,y)) continue; const s=Math.min(1, edgeDist(d.pts,x,y)/d.bank); h+=d.dep*s*s*(3-2*s); } return h; }
const gAt=(pr, x, y)=>hAt(pr,x,y)-dipAt(x,y);
// obstáculos que se vuelven transparentes cuando tapan la pelota o se está cerca
function fadeReg(objs, x0, y0, x1, y1, near, min){ R3.fades.push({objs, x0, y0, x1, y1, near, min, a:1}); }
function segRect(ax, ay, bx, by, f, m){ let t0=0, t1=1; const dx=bx-ax, dy=by-ay;
  for(const [p,q] of [[-dx, ax-(f.x0-m)], [dx, (f.x1+m)-ax], [-dy, ay-(f.y0-m)], [dy, (f.y1+m)-ay]]){ if(p===0){ if(q<0) return false; } else { const r=q/p; if(p<0){ if(r>t1) return false; if(r>t0) t0=r; } else { if(r<t0) return false; if(r<t1) t1=r; } } }
  return true; }
function fadeApply(f, tgt){
  if(tgt===1 && f.a===1) return;
  let a=f.a+(tgt-f.a)*.16; if(Math.abs(tgt-a)<.01) a=tgt; f.a=a;
  if(!f.mats){ f.mats=[]; f.meshes=[]; const map=new Map();
    for(const o of f.objs) o.traverse(m=>{ if(!m.isMesh) return; let c=map.get(m.material); if(!c){ c=m.material.clone(); c.userData={op:m.material.opacity, tr:m.material.transparent}; map.set(m.material, c); f.mats.push(c); } m.material=c; f.meshes.push([m, m.castShadow]); }); }
  const on=a<.995;
  for(const c of f.mats){ c.transparent=on||c.userData.tr; c.opacity=c.userData.op*a; c.depthWrite=!on && !c.userData.tr; }
  for(const [m,cs] of f.meshes) m.castShadow=cs && a>.6;
}
// copa de árbol: una bola con bultos, de sombreado suave
function blobGeo(det){ const g=new THREE.IcosahedronGeometry(1, det), p=g.attributes.position, n=g.attributes.normal, v=new THREE.Vector3();
  for(let i=0;i<p.count;i++){ v.fromBufferAttribute(p,i).normalize(); const k=1+.16*Math.sin(v.x*5+1.3)*Math.sin(v.y*4+.4)+.12*Math.sin(v.z*6+.7)*Math.sin(v.x*3+2)+.07*Math.sin(v.y*9+v.z*7);
    n.setXYZ(i, v.x, v.y, v.z); p.setXYZ(i, v.x*k, v.y*k, v.z*k); } return g; }
// hoja de pindó: una tira que sale, se arquea y cae
function frondGeo(){ const g=new THREE.PlaneGeometry(1, .38, 10, 2); g.rotateX(-Math.PI/2); g.translate(.5,0,0); const p=g.attributes.position;
  for(let i=0;i<p.count;i++){ const x=p.getX(i), z=p.getZ(i); p.setY(i, Math.sin(x*1.5)*.34 - x*x*.6 - Math.abs(z)*.5*(.25+x)); } g.computeVertexNormals(); return g; }
function disposeTree(o){ o.traverse(m=>{ if(m.geometry) m.geometry.dispose(); if(m.material){ (Array.isArray(m.material)?m.material:[m.material]).forEach(x=>{ if(x.map) x.map.dispose(); x.dispose(); }); } }); }
const WALLCOL=[0xc62828, 0x1d4fa8];
// arma la cancha de un hoyo
function buildHole(ci){
  const T=THREE, pr=prep(ci), H=pr.H, G=R3.holeG, b=pr.box;
  while(G.children.length){ const c=G.children[0]; G.remove(c); disposeTree(c); }
  R3.spins=[]; R3.mills=[]; R3.fades=[]; R3.built=ci;
  R3.dips=[...pr.sand.map(p=>({pts:p, dep:5.5, bank:10, sand:true})), ...pr.water.map(p=>({pts:p, dep:7, bank:5}))];
  R3.dips.forEach(d=>{ const xs=d.pts.map(p=>p[0]), ys=d.pts.map(p=>p[1]); d.x0=Math.min(...xs); d.x1=Math.max(...xs); d.y0=Math.min(...ys); d.y1=Math.max(...ys); });
  const M=6, x0=b.x0-M, y0=b.y0-M, W=b.x1-b.x0+2*M, L=b.y1-b.y0+2*M;
  // piso: alfombra con franjas, arena, agua y el hoyo, pintado en un canvas
  const sc=Math.min(4, 2048/Math.max(W,L)), cw=Math.ceil(W*sc), ch=Math.ceil(L*sc);
  const P=(x,y)=>[(x-x0)*sc, (L-(y-y0))*sc];
  const path=(g,pts)=>{ g.beginPath(); pts.forEach((p,i)=>{ const [X,Y]=P(p[0],p[1]); if(i) g.lineTo(X,Y); else g.moveTo(X,Y); }); g.closePath(); };
  const tex=canvasTex(cw, ch, g=>{
    g.save(); path(g, H.out); g.clip();
    g.fillStyle='#2f9e44'; g.fillRect(0,0,cw,ch);
    // franjas del corte del pasto, una clara y una oscura
    for(let y=b.y0-60, k=0; y<b.y1+60; y+=30, k++){ const [,Y]=P(0,y+30); g.fillStyle=k%2?'rgba(255,255,255,.09)':'rgba(0,45,12,.08)'; g.fillRect(0, Y, cw, 30*sc); }
    // fibras de la alfombra
    for(let i=0;i<cw*ch/40;i++){ g.fillStyle=`rgba(${Math.random()<.5?'0,50,10':'195,255,175'},.075)`; g.fillRect(Math.random()*cw, Math.random()*ch, 1.5, 3.2); }
    // sombra suave contra las bandas
    g.lineJoin='round'; for(const [lw,a] of [[30,.045],[18,.06],[9,.09]]){ path(g, H.out); g.strokeStyle=`rgba(0,30,6,${a})`; g.lineWidth=lw*sc; g.stroke(); }
    // salida: alfombrita más oscura con sus dos marcas
    const [tx,ty]=P(H.tee[0]-16, H.tee[1]+12); g.fillStyle='#1f6f30'; g.fillRect(tx, ty, 32*sc, 24*sc); g.strokeStyle='rgba(255,255,255,.55)'; g.lineWidth=.8*sc; g.strokeRect(tx+1.5*sc, ty+1.5*sc, 29*sc, 21*sc);
    for(const dx of [-11,0,11]){ const [mx,my]=P(H.tee[0]+dx, H.tee[1]); g.fillStyle=dx?'#f2c14e':'rgba(255,255,255,.9)'; g.beginPath(); g.arc(mx, my, (dx?1.3:1.6)*sc, 0, 7); g.fill(); }
    // arena con granitos
    // camino claro y flechas que marcan el paso por debajo del molino
    for(const m of pr.mills){ const [ax,ay]=P(m.x-m.gw/2, m.y+m.d+16), pw=m.gw*sc, ph=(m.d+32)*sc, pg=g.createLinearGradient(0,ay,0,ay+ph);
      pg.addColorStop(0,'rgba(240,255,200,0)'); pg.addColorStop(.25,'rgba(240,255,200,.3)'); pg.addColorStop(.75,'rgba(240,255,200,.3)'); pg.addColorStop(1,'rgba(240,255,200,0)'); g.fillStyle=pg; g.fillRect(ax, ay, pw, ph);
      g.strokeStyle='rgba(255,232,120,.8)'; g.lineWidth=2.2*sc; g.lineCap='round'; g.lineJoin='round';
      for(const yy of [m.y-44, m.y-30, m.y-16]){ const a=P(m.x-8,yy-7), c=P(m.x,yy), e=P(m.x+8,yy-7); g.beginPath(); g.moveTo(a[0],a[1]); g.lineTo(c[0],c[1]); g.lineTo(e[0],e[1]); g.stroke(); } }
    for(const m of pr.tubes){ g.strokeStyle='rgba(255,232,120,.8)'; g.lineWidth=2.2*sc; g.lineCap='round'; g.lineJoin='round';
      for(const yy of [m.a[1]-40, m.a[1]-27, m.a[1]-14]){ const a=P(m.a[0]-8,yy-7), c=P(m.a[0],yy), e=P(m.a[0]+8,yy-7); g.beginPath(); g.moveTo(a[0],a[1]); g.lineTo(c[0],c[1]); g.lineTo(e[0],e[1]); g.stroke(); } }
    // arena: rastrillada en franjas que siguen el borde, con granitos y el borde en sombra
    for(const s of pr.sand){ g.save(); path(g, s); g.clip(); g.fillStyle='#e3cf98'; g.fillRect(0,0,cw,ch); g.lineJoin='round';
      for(let d=60, k=0; d>=2; d-=2, k++){ path(g, s); g.strokeStyle=k%2?'#dcc588':'#e9d6a2'; g.lineWidth=2*d*sc; g.stroke(); }
      for(let i=0;i<cw*ch/200;i++){ g.fillStyle=`rgba(${Math.random()<.5?'140,105,45':'255,248,220'},.3)`; g.fillRect(Math.random()*cw, Math.random()*ch, 1.6, 1.6); }
      for(const [lw,a] of [[24,.12],[13,.18],[6,.34]]){ path(g, s); g.strokeStyle=`rgba(95,65,20,${a})`; g.lineWidth=lw*sc; g.stroke(); } g.restore();
      path(g, s); g.strokeStyle='#1f7a34'; g.lineWidth=3.2*sc; g.stroke(); path(g, s); g.strokeStyle='#8a6a35'; g.lineWidth=1.5*sc; g.stroke(); }
    // el fondo del agua: orilla clara, centro hondo y piedritas, con borde de piedra
    for(const w of pr.water){ g.save(); path(g, w); g.clip(); g.fillStyle='#0b3c66'; g.fillRect(0,0,cw,ch); g.lineJoin='round';
      for(const [lw,c] of [[44,'rgba(30,110,150,.35)'],[26,'rgba(70,150,165,.4)'],[12,'rgba(170,190,150,.55)']]){ path(g, w); g.strokeStyle=c; g.lineWidth=lw*sc; g.stroke(); }
      for(let i=0;i<cw*ch/420;i++){ g.fillStyle=`rgba(${Math.random()<.5?'205,215,205':'20,50,70'},.22)`; g.beginPath(); g.arc(Math.random()*cw, Math.random()*ch, (.6+Math.random()*1.3)*sc, 0, 7); g.fill(); }
      g.restore(); path(g, w); g.strokeStyle='#8d949b'; g.lineWidth=4.5*sc; g.stroke(); g.strokeStyle='#5d646b'; g.lineWidth=1.2*sc; g.stroke(); }
    for(const m of pr.tubes) for(const [q,r] of [[m.a,TR+3],[m.b,TR+2]]){ const [ax,ay]=P(q[0],q[1]), sg=g.createRadialGradient(ax,ay,0,ax,ay,r*1.6*sc); sg.addColorStop(0,'rgba(0,20,5,.55)'); sg.addColorStop(1,'rgba(0,20,5,0)'); g.fillStyle=sg; g.beginPath(); g.arc(ax,ay,r*1.6*sc,0,7); g.fill(); }
    // el hoyo: pasto gastado alrededor, aro blanco y el agujero
    const [cx,cy]=P(H.cup[0], H.cup[1]); const wg=g.createRadialGradient(cx,cy,CR*sc,cx,cy,CR*4.5*sc); wg.addColorStop(0,'rgba(215,255,190,.28)'); wg.addColorStop(1,'rgba(215,255,190,0)'); g.fillStyle=wg; g.beginPath(); g.arc(cx,cy,CR*4.5*sc,0,7); g.fill();
    g.fillStyle='#f6f6f6'; g.beginPath(); g.arc(cx,cy,(CR+1.2)*sc,0,7); g.fill(); g.fillStyle='#070707'; g.beginPath(); g.arc(cx,cy,CR*sc,0,7); g.fill();
    g.restore();
  });
  const step=Math.max(2.5, Math.max(W,L)/(R3.mobile?260:340)), sx=Math.ceil(W/step), sy=Math.ceil(L/step), pos=[], uv=[], idx=[];
  for(let j=0;j<=sy;j++) for(let i=0;i<=sx;i++){ const x=x0+W*i/sx, y=y0+L*j/sy; pos.push(x, gAt(pr,x,y), -y); uv.push(i/sx, j/sy); }
  for(let j=0;j<sy;j++) for(let i=0;i<sx;i++){ const a=j*(sx+1)+i, c=a+sx+1; idx.push(a,a+1,c, a+1,c+1,c); }
  const gg=new T.BufferGeometry(); gg.setAttribute('position', new T.Float32BufferAttribute(pos,3)); gg.setAttribute('uv', new T.Float32BufferAttribute(uv,2)); gg.setIndex(idx); gg.computeVertexNormals();
  const ground=new T.Mesh(gg, new T.MeshStandardMaterial({map:tex, roughness:.95, alphaTest:.5})); ground.receiveShadow=true; G.add(ground); R3.ground=ground;
  // pasto de alrededor y árboles (lapachos y otros)
  let seed=ci*977+13; const R=()=>{ seed=(seed*16807)%2147483647; return seed/2147483647; };
  const bcx=(b.x0+b.x1)/2, bcy=(b.y0+b.y1)/2;
  R3.out.position.set(bcx, -10, -bcy); R3.hills.position.set(bcx, 0, -bcy); R3.dome.position.set(bcx, 0, -bcy);
  // vereda de baldosas alrededor de la cancha
  const pvT=canvasTex(128, 128, (g,w,h)=>{ g.fillStyle='#cbbfa6'; g.fillRect(0,0,w,h); for(let j=0;j<2;j++) for(let i=0;i<2;i++){ g.fillStyle=(i+j)%2?'#d6cbb3':'#c3b698'; g.fillRect(i*64+2, j*64+2, 60, 60); } for(let i=0;i<500;i++){ g.fillStyle='rgba(90,75,50,.12)'; g.fillRect(Math.random()*w, Math.random()*h, 2, 2); } });
  pvT.wrapS=pvT.wrapT=T.RepeatWrapping; pvT.repeat.set((W+64)/44, (L+64)/44);
  const pave=new T.Mesh(new T.PlaneGeometry(W+64, L+64), new T.MeshStandardMaterial({map:pvT, roughness:.9})); pave.rotation.x=-Math.PI/2; pave.position.set(bcx, -9.6, -bcy); pave.receiveShadow=true; G.add(pave);
  const curb=new T.Mesh(new T.BoxGeometry(W+72, 3, L+72), new T.MeshStandardMaterial({color:0x9a8f78, roughness:.9})); curb.position.set(bcx, -11.2, -bcy); curb.receiveShadow=true; G.add(curb);
  // árboles: lapachos rosados y amarillos, pindós y árboles de copa verde; arbustos, piedras y flores
  const trunkM=new T.MeshStandardMaterial({color:0x8a5a34, map:R3.barkTex, roughness:.95}), palmTrM=new T.MeshStandardMaterial({color:0x9c8463, map:R3.barkTex, roughness:.95});
  const LEAF={verde:[0x45a046,0x66bb55,0x52ad4c], oscuro:[0x33853b,0x449645,0x55a650], rosa:[0xe75480,0xf58ab8,0xd9417a], amar:[0xf2c14e,0xffd966,0xe0a82e]}; for(const k in LEAF) LEAF[k]=LEAF[k].map(c=>new T.MeshStandardMaterial({color:c, map:R3.leafTex, roughness:.9, emissive:c, emissiveIntensity:.2}));
  const palmM=new T.MeshStandardMaterial({map:R3.frondTex, alphaTest:.5, roughness:.8, side:T.DoubleSide}), palmD=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking, map:R3.frondTex, alphaTest:.5});
  const rockM=new T.MeshStandardMaterial({color:0x8f959c, roughness:.95, flatShading:true}), fruitM=new T.MeshStandardMaterial({color:0xe08a1e, roughness:.6});
  const gSph=blobGeo(R3.mobile?1:2), gTrunk=new T.CylinderGeometry(.55, 1, 1, 9), gFrond=new T.ConeGeometry(1, 1, 4), gRock=new T.DodecahedronGeometry(1), gPet=new T.CircleGeometry(1, 16), gPalm=frondGeo();
  const mk=(par, geo, mat, x, y, z, sx, sy, sz)=>{ const m=new T.Mesh(geo, mat); m.position.set(x,y,z); m.scale.set(sx, sy==null?sx:sy, sz==null?sx:sz); m.castShadow=true; par.add(m); return m; };
  const inCourse=(x,y,mg)=>x>b.x0-mg && x<b.x1+mg && y>b.y0-mg && y<b.y1+mg;
  const UP=new T.Vector3(0,1,0), nTree=R3.mobile?16:30;
  for(let k=0;k<nTree;k++){
    const a=R()*Math.PI*2, rr=Math.max(W,L)*.5+70+R()*300, x=bcx+Math.cos(a)*rr*(W/Math.max(W,L)+.4), y=bcy+Math.sin(a)*rr;
    if(inCourse(x,y,100)) continue;
    const s=.8+R()*.8, tr=new T.Group(), q=R(), kind=q<.24?'rosa':q<.36?'amar':q<.54?'palm':'verde';
    if(kind==='palm'){
      // pindó: tronco anillado que se inclina, penacho de hojas arqueadas y racimo de coquitos
      const hgt=(56+R()*24)*s, lean=(R()-.5)*.36, segs=7; let px=0, py=0;
      for(let j=0;j<segs;j++){ const an=lean*(j+.5)/segs*1.7, sl=hgt/segs, r=2.7*s*(1-.3*j/segs), m=mk(tr, gTrunk, palmTrM, px+Math.sin(an)*sl/2, py+Math.cos(an)*sl/2, 0, r, sl*1.06, r); m.rotation.z=-an; px+=Math.sin(an)*sl; py+=Math.cos(an)*sl; }
      mk(tr, gTrunk, palmTrM, 0, 1.2*s, 0, 4*s, 2.4*s, 4*s);
      const cw=new T.Group(); cw.position.set(px, py, 0); tr.add(cw); const nf=R3.mobile?9:13;
      for(let f=0;f<nf;f++){ const pv=new T.Group(); pv.rotation.y=f*Math.PI*2/nf+R()*.3; const len=(27+R()*9)*s, fr=new T.Mesh(gPalm, palmM); fr.scale.set(len, len, len); fr.rotation.z=.75-(f%3)*.42+R()*.1; fr.castShadow=true; fr.customDepthMaterial=palmD; pv.add(fr); cw.add(pv); }
      mk(cw, gSph, LEAF.oscuro[1], 0, 0, 0, 3.4*s, 4.2*s, 3.4*s);
      for(let j=0;j<5;j++) mk(cw, gSph, fruitM, 2.6*s+(R()-.5)*2*s, -3.5*s-R()*3*s, (R()-.5)*2.4*s, 1.1*s).castShadow=false;
    } else {
      // lapacho o árbol de copa verde: tronco con raíz, tres ramas y copa de varias bolas
      const big=kind==='verde' && R()<.4, hgt=(kind==='verde'?30:36)*s*(big?1.25:1), cr=(kind==='verde'?19:17)*s*(big?1.2:1), L3=LEAF[kind==='verde' && R()<.45?'oscuro':kind];
      mk(tr, gTrunk, trunkM, 0, hgt/2, 0, 3.3*s, hgt, 3.3*s); mk(tr, gTrunk, trunkM, 0, 1.6*s, 0, 5.2*s, 3.2*s, 5.2*s);
      mk(tr, gSph, L3[0], 0, hgt+cr*.45, 0, cr*.8, cr*.7, cr*.8).rotation.y=R()*6;
      for(let j=0;j<3;j++){ const an=j*2.1+R()*.8, bl=cr*.8, d=new T.Vector3(Math.cos(an)*.72, .7, Math.sin(an)*.72).normalize();
        const br=mk(tr, gTrunk, trunkM, d.x*bl/2, hgt*.7+d.y*bl/2, d.z*bl/2, 1.5*s, bl, 1.5*s); br.quaternion.setFromUnitVectors(UP, d);
        mk(tr, gSph, L3[1+j%2], Math.cos(an)*cr*.62, hgt+cr*.12, Math.sin(an)*cr*.62, cr*.58, cr*.5, cr*.58).rotation.y=R()*6; }
      for(let j=0;j<(R3.mobile?2:4);j++){ const an=R()*6.28, d=cr*(.3+R()*.45); mk(tr, gSph, L3[j%3], Math.cos(an)*d, hgt+cr*(.35+R()*.5), Math.sin(an)*d, cr*(.36+R()*.14)).rotation.y=R()*6; }
      if(kind!=='verde'){ const pt=new T.Mesh(gPet, new T.MeshBasicMaterial({color:kind==='rosa'?0xf58ab8:0xffd966, transparent:true, opacity:.4, depthWrite:false})); pt.rotation.x=-Math.PI/2; pt.position.y=.5; pt.scale.set(cr*1.25, cr*1.25, 1); tr.add(pt); }
    }
    tr.position.set(x,-10,-y); tr.rotation.y=R()*6; G.add(tr); fadeReg([tr], x-24*s, y-24*s, x+24*s, y+24*s, 0, .25);
  }
  for(let k=0;k<(R3.mobile?12:26);k++){
    const a=R()*Math.PI*2, rr=Math.max(W,L)*.5+48+R()*150, x=bcx+Math.cos(a)*rr*(W/Math.max(W,L)+.4), y=bcy+Math.sin(a)*rr;
    if(inCourse(x,y,58)) continue;
    if(k%4===3){ const s=3+R()*5; mk(G, gRock, rockM, x, -10+s*.5, -y, s, s*.7, s*1.2).rotation.y=R()*6; }
    else { const s=5+R()*5, bm=LEAF.verde[k%3]; mk(G, gSph, bm, x, -10+s*.7, -y, s, s*.8, s); mk(G, gSph, LEAF.verde[(k+1)%3], x+s*.8, -10+s*.5, -y+s*.4, s*.7);
      if(k%3===0) for(let j=0;j<5;j++) mk(G, gSph, LEAF[j%2?'rosa':'amar'][1], x+(R()-.5)*s*1.6, -10+s*(1+R()*.4), -y+(R()-.5)*s*1.6, .9).castShadow=false; }
  }
  // bandas del borde (se cortan en pedazos para seguir las lomas)
  const wallM=new T.MeshStandardMaterial({color:WALLCOL[ci%2], roughness:.5, metalness:.05}), capM=new T.MeshStandardMaterial({color:0xfbf7ec, roughness:.45});
  let area=0; H.out.forEach((p,i)=>{ const q=H.out[(i+1)%H.out.length]; area+=p[0]*q[1]-q[0]*p[1]; }); const sg=area>0?1:-1;
  H.out.forEach((p,i)=>{ const q=H.out[(i+1)%H.out.length], dx=q[0]-p[0], dy=q[1]-p[1], len=Math.hypot(dx,dy), n=Math.ceil(len/25), nx=sg*dy/len, ny=-sg*dx/len;
    for(let k=0;k<n;k++){ const a0=k/n, a1=(k+1)/n, ax=p[0]+dx*a0, ay=p[1]+dy*a0, bx=p[0]+dx*a1, by=p[1]+dy*a1, l=len/n;
      const top=Math.max(hAt(pr,ax,ay), hAt(pr,bx,by))+7, hh=top+10, cx=(ax+bx)/2+nx*2.5, cy=(ay+by)/2+ny*2.5;
      const w=new T.Mesh(new T.BoxGeometry(l+5, hh, 5), wallM); w.position.set(cx, top-hh/2, -cy); w.rotation.y=Math.atan2(dy,dx); w.castShadow=true; w.receiveShadow=true; G.add(w);
      const cap=new T.Mesh(new T.BoxGeometry(l+5, 1.2, 6.2), capM); cap.position.set(cx, top+.6, -cy); cap.rotation.y=w.rotation.y; G.add(cap); }
  });
  // obstáculos
  const stoneM=new T.MeshStandardMaterial({color:0x8d9096, roughness:.95, flatShading:true}), woodM=new T.MeshStandardMaterial({color:0x6b4423, roughness:.85}), glassM=new T.MeshStandardMaterial({color:0x6fb6e6, roughness:.15, metalness:.4}),
    creamM=new T.MeshStandardMaterial({color:0xf3e3c3, roughness:.75}), tileM=new T.MeshStandardMaterial({color:0xb03a2e, roughness:.6, flatShading:true}), chromeM=new T.MeshStandardMaterial({color:0xe9edf1, metalness:.85, roughness:.2}),
    whiteM=new T.MeshStandardMaterial({color:0xf7f5ee, roughness:.4}), redM=new T.MeshStandardMaterial({color:0xd52b1e, roughness:.4}), blueM=new T.MeshStandardMaterial({color:0x0038a8, roughness:.4}), darkM=new T.MeshStandardMaterial({color:0x20242a, roughness:.7});
  const dbox=(par, w, h, d, x, y, z, mat)=>{ const m=new T.Mesh(new T.BoxGeometry(w,h,d), mat); m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; par.add(m); return m; };
  const dcyl=(par, rt, rb, h, x, y, z, mat, seg)=>{ const m=new T.Mesh(new T.CylinderGeometry(rt,rb,h,seg||24), mat); m.position.set(x,y,z); m.castShadow=true; par.add(m); return m; };
  const parts=[];   // lo que arma cada obstáculo, para poder volverlo transparente
  for(const o of H.obs){
    const n0=G.children.length; parts.push({o, n0});
    if(o.t==='block'){
      const sh=new T.Shape(o.pts.map(p=>new T.Vector2(p[0],p[1]))), hgt=o.house?60:12;
      const geo=new T.ExtrudeGeometry(sh, {depth:hgt+10, bevelEnabled:false}); geo.rotateX(-Math.PI/2);
      const m=new T.Mesh(geo, o.house?creamM:new T.MeshStandardMaterial({color:WALLCOL[ci%2], roughness:.5})); m.position.y=-10; m.castShadow=true; m.receiveShadow=true; G.add(m);
      const xs=o.pts.map(p=>p[0]), ys=o.pts.map(p=>p[1]), ax0=Math.min(...xs), ax1=Math.max(...xs), ay0=Math.min(...ys), ay1=Math.max(...ys), bw=ax1-ax0, bd=ay1-ay0, mx=(ax0+ax1)/2, my=(ay0+ay1)/2;
      if(o.house){
        // casita del molino: zócalo de piedra, viga de madera y ventanas con postigos a los dos lados
        dbox(G, bw+1.6, 10, bd+1.6, mx, 5, -my, stoneM); dbox(G, bw+1.6, 3, bd+1.6, mx, 58.5, -my, woodM);
        if(bw>=30) for(const fy of [ay0-.6, ay1+.6]){ const n=bw>70?2:1; for(let k=0;k<n;k++){ const wx=n===1?mx:ax0+bw*(k?.72:.28);
          dbox(G, 13, 16, 1, wx, 34, -fy, woodM); dbox(G, 9.5, 12.5, 1.4, wx, 34, -fy, glassM); dbox(G, 1, 12.5, 1.6, wx, 34, -fy, woodM); dbox(G, 9.5, 1, 1.6, wx, 34, -fy, woodM);
          dbox(G, 15, 2, 2.4, wx, 25, -fy, stoneM); for(const sx of [-1,1]) dbox(G, 3.4, 15, 1, wx+sx*8.6, 34, -fy, redM); } }
      } else if(pr.tubes.length){
        // el túnel pasa por adentro de un cerro de piedra con pasto, arbustos y flores arriba
        m.material=stoneM; dbox(G, bw+2, 2.4, bd+2, mx, 12.4, -my, whiteM);
        const tb=pr.tubes[0], tmx=(tb.a[0]+tb.b[0])/2, cerroM=[0x9a938a,0x857e76,0xa8a196].map(c=>new T.MeshStandardMaterial({color:c, roughness:1, flatShading:true})), gCerro=new T.IcosahedronGeometry(1, 1), nl=Math.max(3, Math.round(bw/15));
        for(let r=0;r<2;r++) for(let i=0;i<nl;i++){ const x=ax0+bw*(i+.5+(r?.25:-.15))/nl, pk=24+26*Math.exp(-(((x-tmx)/34)**2))+R()*8, z=-my+(r?bd*.17:-bd*.17)+(R()-.5)*4;
          const rk=mk(G, gCerro, cerroM[(i+r)%3], x, 8, z, bw/nl*.78+R()*3, pk, bd*.34+R()*3); rk.rotation.y=R()*6; rk.receiveShadow=true;
          if((i+r)%2===0){ mk(G, gSph, LEAF.verde[i%3], x+(R()-.5)*4, 8+pk*.84, z, 8+R()*3, 3.4, 8+R()*3);
            if(i%2===0) for(let j=0;j<4;j++) mk(G, gSph, LEAF[j%2?'rosa':'amar'][1], x+(R()-.5)*10, 8+pk*.84+3, z+(R()-.5)*8, .9).castShadow=false; } }
        for(const sx of [ax0+9, ax1-9]){ mk(G, gSph, LEAF.oscuro[0], sx, 17, -my, 7, 6, 9); mk(G, gSph, LEAF.verde[1], sx+(sx<mx?5:-5), 15.5, -my+7, 5, 4.5, 5); }
      } else { dbox(G, bw+2.4, 2.2, bd+2.4, mx, 12.6, -my, whiteM); dbox(G, bw+1, 2, bd+1, mx, 1, -my, darkM); }
    } else if(o.t==='post'){
      const h0=hAt(pr,o.x,o.y), pg=new T.Group(); pg.position.set(o.x, h0, -o.y); G.add(pg);
      if(o.boing){   // rebotador: base, cuerpo rojo con franja blanca y tapa cromada
        dcyl(pg, o.r+1.2, o.r+1.8, 1.6, 0, .8, 0, darkM); dcyl(pg, o.r, o.r, 9, 0, 5.5, 0, new T.MeshStandardMaterial({color:0xe53935, roughness:.35, emissive:0x3a0000}));
        dcyl(pg, o.r+.2, o.r+.2, 2.4, 0, 5.5, 0, whiteM); dcyl(pg, o.r+.9, o.r+.9, 1.4, 0, 10.4, 0, chromeM);
        const dm=new T.Mesh(new T.SphereGeometry(o.r*.8, 20, 10, 0, Math.PI*2, 0, Math.PI/2), chromeM); dm.position.y=11; dm.scale.y=.55; dm.castShadow=true; pg.add(dm);
        const lt=new T.Mesh(new T.SphereGeometry(1.6, 12, 8), new T.MeshStandardMaterial({color:0xffd54a, emissive:0xb07a00})); lt.position.y=11+o.r*.44; pg.add(lt);
      } else {       // poste: blanco con los colores de la bandera y punta redonda
        dcyl(pg, o.r+.8, o.r+1.2, 1.4, 0, .7, 0, darkM); dcyl(pg, o.r*.92, o.r, 15, 0, 7.5, 0, whiteM);
        dcyl(pg, o.r*.95+.15, o.r*.96+.15, 2.2, 0, 11.8, 0, redM); dcyl(pg, o.r*.97+.15, o.r*.98+.15, 2.2, 0, 8.4, 0, blueM);
        const dm=new T.Mesh(new T.SphereGeometry(o.r*.92, 20, 10, 0, Math.PI*2, 0, Math.PI/2), whiteM); dm.position.y=15; dm.scale.y=.6; dm.castShadow=true; pg.add(dm);
      }
    } else if(o.t==='spin'){
      const g=new T.Group(), y=hAt(pr,o.x,o.y), mat=new T.MeshStandardMaterial({color:0xf2c14e, roughness:.4}), mat2=new T.MeshStandardMaterial({color:0x222222});
      for(let k=0;k<o.arms;k++){ const pv=new T.Group(); pv.rotation.y=k*2*Math.PI/o.arms; const arm=new T.Mesh(new T.BoxGeometry(o.len, 4, 3.5), k%2?mat2:mat); arm.position.x=o.len/2; arm.castShadow=true; pv.add(arm);
        for(let s=1;s<4;s++) dbox(pv, 2.2, 4.2, 3.7, o.len*s/4, 0, 0, k%2?mat:mat2).castShadow=false;
        const tip=new T.Mesh(new T.SphereGeometry(2.3, 12, 8), redM); tip.position.x=o.len-2; tip.castShadow=true; pv.add(tip); g.add(pv); }
      dcyl(g, 4.5, 4.5, 9, 0, 0, 0, redM, 20); dcyl(g, 5.6, 5.6, 1.4, 0, 4.6, 0, chromeM, 20); dcyl(g, 7.5, 8.5, 1.6, 0, -1.9, 0, darkM, 20);
      const dm=new T.Mesh(new T.SphereGeometry(3.6, 16, 8, 0, Math.PI*2, 0, Math.PI/2), chromeM); dm.position.y=5.2; dm.scale.y=.6; g.add(dm);
      g.position.set(o.x, y+2.5, -o.y); G.add(g); R3.spins.push({o, g});
    } else if(o.t==='mill'){
      const top=60, zc=-(o.y+o.d/2), rw=o.hw*2+12, ah=26;
      // el paso: un túnel con arco, bien alto, con faroles y luz adentro para que se vea que se pasa
      const ms=new T.Shape(); ms.moveTo(-o.gw/2, top); ms.lineTo(o.gw/2, top); ms.lineTo(o.gw/2, ah); ms.absarc(0, ah, o.gw/2, 0, Math.PI, false); ms.lineTo(-o.gw/2, top);
      const mw=new T.Mesh(new T.ExtrudeGeometry(ms, {depth:o.d, bevelEnabled:false}), creamM); mw.position.set(o.x, 0, -(o.y+o.d)); mw.castShadow=true; mw.receiveShadow=true; G.add(mw);
      const lampM=new T.MeshBasicMaterial({color:0xffe9a8}), tl=new T.PointLight(0xffe2ad, 1.1, 120, 1.4); tl.position.set(o.x, 15, zc); G.add(tl);
      for(const lz of [-o.d*.3, 0, o.d*.3]) dbox(G, 5, .8, 5, o.x, ah+o.gw/2-.6, zc+lz, lampM).castShadow=false;
      // techo a dos aguas de tejas, torre con su techito y marco de madera en la entrada
      const rs=new T.Shape(); rs.moveTo(-o.d/2-8, 0); rs.lineTo(0, 26); rs.lineTo(o.d/2+8, 0); rs.lineTo(-o.d/2-8, 0);
      const rg=new T.ExtrudeGeometry(rs, {depth:rw, bevelEnabled:false}); rg.translate(0, 0, -rw/2); rg.rotateY(Math.PI/2);
      const roof=new T.Mesh(rg, tileM); roof.position.set(o.x, top, zc); roof.castShadow=true; roof.receiveShadow=true; G.add(roof);
      dbox(G, rw+2, 2, 3, o.x, top+26.5, zc, woodM);
      dcyl(G, 12, 16, 44, o.x, top+30, zc, creamM, 8); dcyl(G, 12.6, 12.6, 2.4, o.x, top+50, zc, woodM, 8);
      const tr=new T.Mesh(new T.ConeGeometry(17, 22, 8), tileM); tr.position.set(o.x, top+63, zc); tr.castShadow=true; G.add(tr);
      const kb=new T.Mesh(new T.SphereGeometry(2, 10, 8), new T.MeshStandardMaterial({color:0xf2c14e, metalness:.7, roughness:.3})); kb.position.set(o.x, top+75, zc); G.add(kb);
      for(const sg2 of [1,-1]){ dbox(G, 8, 10, 1.2, o.x, top+40, zc+sg2*13.4, woodM); dbox(G, 5.5, 7.5, 1.6, o.x, top+40, zc+sg2*13.5, glassM); }
      for(const fy of [o.y-.8, o.y+o.d+.8]){ for(const sx of [-1,1]){ dbox(G, 3.6, ah, 2.6, o.x+sx*(o.gw/2+.6), ah/2, -fy, whiteM); dbox(G, 4.6, 2.4, 3.4, o.x+sx*(o.gw/2+.6), 1.2, -fy, stoneM);
          dbox(G, 1, 1, 3.4, o.x+sx*(o.gw/2+7), 24, -fy+(fy<o.y?1.2:-1.2), woodM); dbox(G, 2.6, 4, 2.6, o.x+sx*(o.gw/2+7), 21.5, -fy+(fy<o.y?2.6:-2.6), lampM).castShadow=false; }
        const ar=new T.Mesh(new T.TorusGeometry(o.gw/2+.8, 2, 8, 24, Math.PI), whiteM); ar.position.set(o.x, ah, -fy); ar.castShadow=true; G.add(ar);
        dbox(G, 4.6, 5, 3.6, o.x, ah+o.gw/2+.9, -fy, redM); }
      const g=new T.Group(), bladeM=new T.MeshStandardMaterial({color:0xfbf7ec, roughness:.5, side:T.DoubleSide}), barM=woodM;
      for(let k=0;k<4;k++){ const pv=new T.Group(); pv.rotation.z=k*Math.PI/2-Math.PI/2; const bar=new T.Mesh(new T.BoxGeometry(1.6, 30, 1.2), barM); bar.position.y=15; pv.add(bar);
        const sail=new T.Mesh(new T.BoxGeometry(7, 22, .5), k%2?bladeM:redM); sail.position.set(4.2, 18, 0); sail.castShadow=true; pv.add(sail);
        for(let s=0;s<5;s++){ const rb=new T.Mesh(new T.BoxGeometry(7.4, .7, .9), barM); rb.position.set(4.2, 8+s*5, 0); pv.add(rb); } g.add(pv); }
      const hub=new T.Mesh(new T.CylinderGeometry(3,3,6,16), barM); hub.rotation.x=Math.PI/2; g.add(hub);
      const cap=new T.Mesh(new T.SphereGeometry(2.4, 12, 8), chromeM); cap.position.z=3; g.add(cap);
      const axle=new T.Mesh(new T.CylinderGeometry(1.5,1.5,9,12), barM); axle.rotation.x=Math.PI/2; axle.position.z=-5; g.add(axle);
      g.scale.set(1.5, 1.5, 1); g.position.set(o.x, 57, -o.y+10); G.add(g); R3.mills.push({o, g}); fadeReg([g], o.x-46, o.y-13, o.x+46, o.y+2, 0, .22);   // las aspas solo se aclaran si tapan la pelota
    } else if(o.t==='water'){
      const sh=new T.Shape(o.pts.map(p=>new T.Vector2(p[0],p[1]))), geo=new T.ShapeGeometry(sh); geo.rotateX(-Math.PI/2);
      const m=new T.Mesh(geo, new T.ShaderMaterial({uniforms:R3.waterU, vertexShader:WATER_VS, fragmentShader:WATER_FS, transparent:true, depthWrite:false}));
      const c=o.pts.reduce((a,p)=>[a[0]+p[0]/o.pts.length, a[1]+p[1]/o.pts.length],[0,0]), wy=hAt(pr,c[0],c[1])-2.2; m.position.y=wy; G.add(m);
      // piedras en la orilla, camalotes con flor y totoras
      const n=o.pts.length, gap=R3.mobile?11:7.5;
      for(let i=0;i<n;i++){ const p=o.pts[i], q=o.pts[(i+1)%n], len=Math.hypot(q[0]-p[0], q[1]-p[1]), k=Math.max(1, Math.round(len/gap));
        for(let j=0;j<k;j++){ const x=p[0]+(q[0]-p[0])*(j+R()*.5)/k, y=p[1]+(q[1]-p[1])*(j+R()*.5)/k; if(edgeDist(H.out,x,y)<4) continue;
          const s=1.9+R()*1.5, st=mk(G, gRock, rockM, x, hAt(pr,x,y)-.2, -y, s, s*.5, s*(.8+R()*.5)); st.rotation.y=R()*6; st.receiveShadow=true; } }
      const xs=o.pts.map(p=>p[0]), ys=o.pts.map(p=>p[1]), wx0=Math.min(...xs), wx1=Math.max(...xs), wy0=Math.min(...ys), wy1=Math.max(...ys);
      const inW=(lo,hi)=>{ for(let t=0;t<300;t++){ const x=wx0+R()*(wx1-wx0), y=wy0+R()*(wy1-wy0); if(!inPoly(o.pts,x,y)) continue; const d=edgeDist(o.pts,x,y); if(d>=lo && d<=hi) return [x,y]; } return null; };
      const padM=new T.MeshStandardMaterial({color:0x3f9a48, roughness:.7, side:T.DoubleSide}), reedM=new T.MeshStandardMaterial({color:0x4c8f3a, roughness:.8}), catM=new T.MeshStandardMaterial({color:0x5a3b1e, roughness:.9});
      for(let k=0, nk=Math.round(Math.min(9, 3+(wx1-wx0)*(wy1-wy0)/4500));k<nk;k++){ const p=inW(11, 1e9); if(!p) break; const s=3+R()*2.6;
        const pad=new T.Mesh(new T.CircleGeometry(1, 14, .5, 5.6), padM); pad.rotation.x=-Math.PI/2; pad.rotation.z=R()*6; pad.scale.set(s,s,1); pad.position.set(p[0], wy+.15, -p[1]); G.add(pad);
        if(k%2===0){ mk(G, gSph, LEAF.rosa[1], p[0]+s*.2, wy+.9, -p[1], 1.1, .8, 1.1).castShadow=false; mk(G, gSph, LEAF.amar[0], p[0]+s*.2, wy+1.5, -p[1], .45).castShadow=false; } }
      for(let k=0;k<(R3.mobile?2:4);k++){ const p=inW(2.5, 6); if(!p) break;
        for(let j=0;j<6;j++){ const hh=9+R()*9, rx=p[0]+(R()-.5)*5, ry=p[1]+(R()-.5)*5, rd=mk(G, gTrunk, reedM, rx, wy+hh/2-1, -ry, .35, hh, .35); rd.rotation.z=(R()-.5)*.25;
          if(j%2===0) mk(G, gTrunk, catM, rx, wy+hh-1.5, -ry, .75, 3.4, .75).rotation.z=rd.rotation.z; } }
    } else if(o.t==='sand'){
      // matitas de pasto y piedritas en el borde de la trampa
      const n=o.pts.length, tuftM=LEAF.verde;
      for(let i=0;i<n;i++){ const p=o.pts[i], q=o.pts[(i+1)%n], len=Math.hypot(q[0]-p[0], q[1]-p[1]), k=Math.max(1, Math.round(len/(R3.mobile?14:9)));
        for(let j=0;j<k;j++){ const x=p[0]+(q[0]-p[0])*(j+R())/k, y=p[1]+(q[1]-p[1])*(j+R())/k; if(edgeDist(H.out,x,y)<4) continue; const h0=hAt(pr,x,y);
          if(j%3===2){ const s=1.2+R()*1.2; mk(G, gRock, rockM, x, h0+.1, -y, s, s*.55, s).rotation.y=R()*6; }
          else for(let b=0;b<3;b++){ const tf=mk(G, gFrond, tuftM[(j+b)%3], x+(R()-.5)*2.4, h0+1.5, -y+(R()-.5)*2.4, .55, 3+R()*1.6, .55); tf.rotation.z=(R()-.5)*.5; tf.castShadow=false; } } }
    } else if(o.t==='tube'){
      const a=o.a, bb=o.b, mid=[(a[0]+bb[0])/2, (a[1]+bb[1])/2];
      // el caño va acostado en el piso: la boca abierta mira al jugador, se mete en el cerro y sale del otro lado
      const fw=bb[1]>a[1]?1:-1, ex=Math.cos(o.dir), ey=Math.sin(o.dir), PR=7.2;
      const curve=new T.CatmullRomCurve3([W3(a[0],a[1]-7*fw,PR), W3(a[0],a[1]+24*fw,PR), W3(mid[0],mid[1],PR+9), W3(bb[0]-ex*24,bb[1]-ey*24,PR), W3(bb[0]+ex*6,bb[1]+ey*6,PR)]);
      const pipe=new T.Mesh(new T.TubeGeometry(curve, 72, PR, 20, false), new T.MeshStandardMaterial({color:0x0038a8, roughness:.25, metalness:.3})); pipe.castShadow=true; G.add(pipe);
      G.add(new T.Mesh(new T.TubeGeometry(curve, 72, PR-.9, 20, false), new T.MeshBasicMaterial({color:0x06080c, side:T.BackSide})));
      // aros blancos y rojos a lo largo del caño
      for(let k=1;k<8;k++){ const tt=k/8, p=curve.getPointAt(tt), tg=curve.getTangentAt(tt);
        const rg2=new T.Mesh(new T.TorusGeometry(PR+.4, .9, 8, 24), k%2?whiteM:redM); rg2.position.copy(p); rg2.quaternion.setFromUnitVectors(new T.Vector3(0,0,1), tg); rg2.castShadow=true; G.add(rg2); }
      // las dos bocas: embudo rojo con borde blanco y el fondo oscuro, para que se vea que la pelota entra
      for(const tt of [0, 1]){ const p=curve.getPointAt(tt), tg=curve.getTangentAt(tt), q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1), tg), out=tt?1:-1;
        const fl=new T.Mesh(new T.CylinderGeometry(PR+3.2, PR, 5, 24, 1, true), new T.MeshStandardMaterial({color:0xd52b1e, roughness:.4, side:T.DoubleSide})); fl.quaternion.copy(q).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0), out*Math.PI/2)); fl.position.copy(p).addScaledVector(tg, out*2.5); fl.castShadow=true; G.add(fl);
        const rim=new T.Mesh(new T.TorusGeometry(PR+3.2, 1, 8, 28), whiteM); rim.quaternion.copy(q); rim.position.copy(p).addScaledVector(tg, out*5); G.add(rim);
        const dk=new T.Mesh(new T.CircleGeometry(PR-.6, 24), new T.MeshBasicMaterial({color:0x020304, side:T.DoubleSide})); dk.quaternion.copy(q); dk.position.copy(p).addScaledVector(tg, -out*9); G.add(dk); }
    }
  }
  // qué se vuelve transparente: el molino con sus casitas (todo junto), las casitas sueltas y el caño del túnel
  parts.forEach((p,i)=>{ p.objs=G.children.slice(p.n0, i+1<parts.length ? parts[i+1].n0 : G.children.length); });
  const used=new Set();
  for(const p of parts){ if(p.o.t!=='mill') continue; const o=p.o; let objs=p.objs.filter(x=>!R3.mills.some(m=>m.g===x)), x0=o.x-o.gw/2, x1=o.x+o.gw/2;
    for(const q of parts){ if(q.o.t!=='block' || !q.o.house) continue; const ys=q.o.pts.map(v=>v[1]), xs=q.o.pts.map(v=>v[0]); if(Math.max(...ys)<o.y-1 || Math.min(...ys)>o.y+o.d+1) continue;
      used.add(q); objs=objs.concat(q.objs); x0=Math.min(x0, ...xs); x1=Math.max(x1, ...xs); }
    fadeReg(objs, x0, o.y, x1, o.y+o.d, 95, .2); }
  for(const p of parts){ const o=p.o;
    if(o.t==='block' && o.house && !used.has(p)){ const xs=o.pts.map(v=>v[0]), ys=o.pts.map(v=>v[1]); fadeReg(p.objs, Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), 80, .18); }
    else if(o.t==='tube'){ const ty0=Math.min(o.a[1],o.b[1]), ty1=Math.max(o.a[1],o.b[1]);
      // el caño solo se aclara si tapa la pelota, y las bocas (las últimas 6 piezas) nunca: hay que ver por dónde entra
      fadeReg(p.objs.slice(0, -6), Math.min(o.a[0],o.b[0])-8, ty0+10, Math.max(o.a[0],o.b[0])+8, ty1-10, 0, .25);
      for(const q of parts) if(q.o.t==='block' && !q.o.house){ const xs=q.o.pts.map(v=>v[0]), ys=q.o.pts.map(v=>v[1]); fadeReg(q.objs, Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), 45, .22); } } }
  // banderita del hoyo (con los colores de Paraguay) y cartel del hoyo
  const ch0=hAt(pr,H.cup[0],H.cup[1]);
  const pole=new T.Mesh(new T.CylinderGeometry(.55,.55,70,8), new T.MeshStandardMaterial({color:0xf5f5f5})); pole.position.set(H.cup[0], ch0+35, -H.cup[1]); pole.castShadow=true; G.add(pole);
  const fg=new T.PlaneGeometry(26,16,10,1); fg.translate(13,0,0);
  const flag=new T.Mesh(fg, new T.MeshStandardMaterial({side:T.DoubleSide, map:canvasTex(128,80,(g,w,h)=>{ g.fillStyle='#d52b1e'; g.fillRect(0,0,w,h/3); g.fillStyle='#fff'; g.fillRect(0,h/3,w,h/3); g.fillStyle='#0038a8'; g.fillRect(0,2*h/3,w,h/3); g.fillStyle='#f2c14e'; g.beginPath(); g.arc(w/2,h/2,7,0,7); g.fill(); g.fillStyle='#2a9d3f'; g.beginPath(); g.arc(w/2,h/2,4,0,7); g.fill(); })}));
  flag.position.set(H.cup[0], ch0+62, -H.cup[1]); flag.castShadow=true; G.add(flag); R3.flag=flag; R3.flagBase=fg.attributes.position.array.slice();
  const knob=new T.Mesh(new T.SphereGeometry(1.5, 12, 8), new T.MeshStandardMaterial({color:0xf2c14e, metalness:.7, roughness:.3})); knob.position.set(H.cup[0], ch0+70.5, -H.cup[1]); G.add(knob);
  const rim=new T.Mesh(new T.TorusGeometry(CR+.5, .5, 8, 28), new T.MeshStandardMaterial({color:0xe9edf1, metalness:.75, roughness:.3})); rim.rotation.x=Math.PI/2; rim.position.set(H.cup[0], ch0+.15, -H.cup[1]); G.add(rim);
  const cupIn=new T.Mesh(new T.CylinderGeometry(CR, CR, 6, 24, 1, true), new T.MeshBasicMaterial({color:0x050505, side:T.BackSide})); cupIn.position.set(H.cup[0], ch0-3, -H.cup[1]); G.add(cupIn);
  const sign=new T.Mesh(new T.PlaneGeometry(48,22), new T.MeshStandardMaterial({map:canvasTex(384,176,(g,w,h)=>{ g.fillStyle='#1b4d2b'; g.fillRect(0,0,w,h); g.strokeStyle='#f2c14e'; g.lineWidth=8; g.strokeRect(4,4,w-8,h-8); g.fillStyle='#fff'; g.textAlign='center'; g.font='900 58px system-ui'; g.fillText(`⛳ Hoyo ${ci+1}`, w/2, 72); g.font='700 32px system-ui'; g.fillText(H.n, w/2, 118); g.fillStyle='#f2c14e'; g.fillText(`Par ${H.par}`, w/2, 158); })}));
  sign.position.set(b.x0-30, 26, -(H.tee[1]+20)); sign.rotation.y=.35; G.add(sign);
  for(const dx of [-18,18]){ const st=new T.Mesh(new T.CylinderGeometry(1,1,40,6), trunkM); st.position.set(b.x0-30+dx*Math.cos(.35), 6, -(H.tee[1]+20)+dx*Math.sin(.35)); G.add(st); }
  // sombras del sol sobre esta cancha
  const cx=(b.x0+b.x1)/2, cy=(b.y0+b.y1)/2, span=Math.max(W,L)/2+80, sun=R3.sun;
  sun.position.set(cx+220, 520, -cy+260); sun.target.position.set(cx, 0, -cy);
  Object.assign(sun.shadow.camera, {left:-span, right:span, top:span, bottom:-span, near:50, far:1600}); sun.shadow.camera.updateProjectionMatrix();
  R3.cam.position.set(H.tee[0], 90, -(H.tee[1]-150)); R3.camLook=W3(H.tee[0], H.tee[1]+100, 0);
}
function ballMesh(id, col){
  let o=R3.balls[id];
  if(!o){ const T=THREE; o=R3.balls[id]={m:new T.Mesh(new T.SphereGeometry(BR, 28, 18), new T.MeshStandardMaterial({roughness:.28, metalness:.05, bumpMap:R3.ballBump, bumpScale:.06})), col:null};
    o.m.castShadow=true; R3.scene.add(o.m); }
  if(o.col!==col){ o.col=col; o.m.material.color.set(col); }
  return o;
}
function wire3DInput(canvas){
  let drag=null;
  canvas.addEventListener('pointerdown', e=>{ canvas.setPointerCapture(e.pointerId); drag={x:e.clientX, y:e.clientY, x0:e.clientX, y0:e.clientY, moved:false}; });
  canvas.addEventListener('pointermove', e=>{
    if(!drag) return;
    const dx=e.clientX-drag.x, dy=e.clientY-drag.y; drag.x=e.clientX; drag.y=e.clientY;
    if(!drag.moved && Math.hypot(e.clientX-drag.x0, e.clientY-drag.y0)>8) drag.moved=true;
    if(!drag.moved) return;
    if(CAM3.mode==='arriba'){ CAM3.h=Math.max(-1, Math.min(1.5, CAM3.h + dy*.004)); return; }
    if(myTurn()) turnAim(-dx*.004); else CAM3.yawOff-=dx*.005;
    CAM3.h=Math.max(-1, Math.min(1.5, CAM3.h - dy*.004));
  });
  canvas.addEventListener('pointerup', e=>{
    const d=drag; drag=null; if(!d) return;
    if(d.moved){ saveCam3(); return; }
    // tocar la cancha: apuntar ahí
    if(!myTurn() || !R3.ground) return;
    const r=canvas.getBoundingClientRect(), T=THREE, ray=new T.Raycaster();
    ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1, -((e.clientY-r.top)/r.height)*2+1), R3.cam);
    const hit=ray.intersectObject(R3.ground)[0]; if(!hit) return;
    const f=unitFrom(curUnit()), x=hit.point.x, y=-hit.point.z;
    if(Math.hypot(x-f.x, y-f.y)<3) return;
    AIM.ang=Math.atan2(y-f.y, x-f.x); sendAim();
  });
  canvas.addEventListener('pointercancel', ()=>{ drag=null; });
  canvas.addEventListener('wheel', e=>{ e.preventDefault(); CAM3.zoom=Math.max(.4, Math.min(2.5, CAM3.zoom*(e.deltaY>0?1.08:.93))); saveCam3(); }, {passive:false});
}
function cam3(k, d){
  if(k==='h') CAM3.h=Math.max(-1, Math.min(1.5, CAM3.h+d));
  else if(k==='zoom') CAM3.zoom=Math.max(.4, Math.min(2.5, CAM3.zoom*(d>0?.85:1.18)));
  else { CAM3.mode=k; CAM3.h=0; CAM3.zoom=1; CAM3.yawOff=0; }
  saveCam3();
}
// puntos de la línea de ayuda según la dificultad
const GUIDE={key:'', at:0, pts:null};
function guidePts(am, f){
  const ci=curHole(), pr=prep(ci), lv=V.opts.aim, dx=Math.cos(am.ang), dy=Math.sin(am.ang);
  if(lv==='experto') return [[f.x+dx*(BR+2), f.y+dy*(BR+2)], [f.x+dx*24, f.y+dy*24]];
  if(lv==='medio'){
    let best=600, nx=0, ny=0;
    for(const s of pr.segs){ const ex=s[2]-s[0], ey=s[3]-s[1], den=dx*ey-dy*ex; if(Math.abs(den)<1e-9) continue;
      const t=((s[0]-f.x)*ey-(s[1]-f.y)*ex)/den, u=((s[0]-f.x)*dy-(s[1]-f.y)*dx)/den;
      if(t>.5 && u>=0 && u<=1 && t<best){ best=t; const l=Math.hypot(ex,ey); nx=-ey/l; ny=ex/l; } }
    for(const p of pr.posts){ const ox=p.x-f.x, oy=p.y-f.y, pj=ox*dx+oy*dy; if(pj<=0) continue; const q=ox*ox+oy*oy-pj*pj, R=(p.r+BR)**2; if(q>=R) continue;
      const t=pj-Math.sqrt(R-q); if(t<best){ best=t; const hx=f.x+dx*t-p.x, hy=f.y+dy*t-p.y, l=Math.hypot(hx,hy); nx=hx/l; ny=hy/l; } }
    const t=Math.max(0, best-BR), ex=f.x+dx*t, ey=f.y+dy*t, pts=[[f.x,f.y],[ex,ey]];
    if(best<600){ const dn=dx*nx+dy*ny, rx=dx-2*dn*nx, ry=dy-2*dn*ny; pts.push([ex+rx*35, ey+ry*35]); }
    return pts;
  }
  // fácil: el recorrido entero con la fuerza que se está cargando (o la del último golpe)
  const pow=am.pow>.02 ? am.pow : AIM.lastPow, key=am.ang.toFixed(3)+'|'+pow.toFixed(2)+'|'+f.x+'|'+f.y;
  if(GUIDE.key!==key || performance.now()-GUIDE.at>300){
    const u=curUnit(), balls=[{id:u.id, x:f.x, y:f.y}];
    if(V.opts.collide) V.units.forEach(v=>{ if(v!==u && v.pos && !v.done) balls.push({id:v.id, x:v.pos.x, y:v.pos.y}); });
    const r=simulate(ci, balls, {id:u.id, ang:am.ang, pow}, hostNow(), {collide:V.opts.collide}, 'path');
    GUIDE.key=key; GUIDE.at=performance.now(); GUIDE.pts=r ? r.path : null;
  }
  return GUIDE.pts;
}
function draw3D(){
  const T=THREE, ci=curHole(); if(R3.built!==ci) buildHole(ci);
  const pr=prep(ci), H=pr.H, t = ANIM.on ? ANIM.shot.t0+(performance.now()-ANIM.t0)/1000 : hostNow();
  const nowP=performance.now(), dtP=Math.min(.1, (nowP-(R3.lt||nowP))/1000); R3.lt=nowP;
  stepParts(dtP); R3.waterU.uT.value=nowP/1000%3600;
  R3.spins.forEach(s=>s.g.rotation.y=spinAng(s.o,t));
  R3.mills.forEach(s=>s.g.rotation.z=millAng(s.o,t));
  if(R3.flag){ const a=R3.flag.geometry.attributes.position, base=R3.flagBase, tt=performance.now()/1000;
    for(let i=0;i<a.count;i++){ const x=base[i*3]; a.setZ(i, Math.sin(x*.25-tt*4)*x*.06); } a.needsUpdate=true; }
  // pelotas
  const d=dispState(), seen={};
  for(const b of d.balls){
    const o=ballMesh(b.id, b.col); seen[b.id]=1;
    const ghost=!V.opts.collide && !b.cur && !b.moving;
    o.m.material.transparent=ghost; o.m.material.opacity=ghost?.55:1;
    const gy=gAt(pr,b.x,b.y);
    o.m.position.set(b.x, gy+BR - (b.sink||0)*BR*2.6 - (b.wet||0)*3, -b.y);
    // arenita que salta cuando la pelota pasa por la trampa
    if(b.moving && o.last && Math.hypot(b.x-o.last[0], b.y-o.last[1])>.35 && R3.dips.some(q=>q.sand && b.x>q.x0 && b.x<q.x1 && b.y>q.y0 && b.y<q.y1 && inPoly(q.pts,b.x,b.y)))
      for(let k=0;k<2;k++) emitP({x:b.x, y:gy+1, z:-b.y, vx:(Math.random()-.5)*14, vy:8+Math.random()*14, vz:(Math.random()-.5)*14, g:70, floor:gy+.2, life:.45+Math.random()*.3, s:.9+Math.random()*.7, c:[.93,.84,.6], a:.85});
    o.m.visible = (b.wet||0)<1;
    // chapuzón al caer al agua y papelitos al embocar
    const wetNow=(b.wet||0)>0, sinkNow=(b.sink||0)>0;
    if(wetNow && !o.wasWet) fxSplash(b.x, hAt(pr,b.x,b.y)+1, -b.y);
    if(sinkNow && !o.wasSink) fxCup(H.cup[0], hAt(pr,H.cup[0],H.cup[1]), -H.cup[1]);
    o.wasWet=wetNow; o.wasSink=sinkNow;
    if(b.moving && o.last){ const dx=b.x-o.last[0], dy=b.y-o.last[1], dist=Math.hypot(dx,dy); if(dist>1e-3 && dist<60){ const ax=new T.Vector3(-dy,0,-dx).normalize(); o.m.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(ax, dist/BR)); } }
    o.last=[b.x,b.y];
  }
  for(const id in R3.balls) if(!seen[id]){ R3.balls[id].m.visible=false; R3.balls[id].last=null; }
  // la que juega: anillito, palo y ayuda
  const cur=d.balls.find(b=>b.cur), am = V.phase==='play' && !ANIM.on && cur ? aimNow() : null;
  R3.ring.visible=!!cur && !ANIM.on;
  if(cur){ R3.ring.position.set(cur.x, gAt(pr,cur.x,cur.y)+.3, -cur.y); R3.ring.material.opacity=.5+.4*Math.sin(performance.now()/250); }
  R3.putter.visible=!!am; R3.guide.visible=false;
  if(am){
    const back=BR+1.6+am.pow*26, px=cur.x-Math.cos(am.ang)*back, py=cur.y-Math.sin(am.ang)*back;
    R3.putter.position.set(px, gAt(pr,px,py), -py); R3.putter.rotation.y=am.ang;
    const pts=guidePts(am, cur);
    if(pts && pts.length>1){
      const arr=R3.guide.geometry.attributes.position, n=Math.min(240, pts.length); let last=pts[0];
      for(let i=0;i<240;i++){ const p=pts[Math.min(i, n-1)]; if(p[0]!=null) last=p; arr.setXYZ(i, last[0], gAt(pr,last[0],last[1])+.7, -last[1]); }
      arr.needsUpdate=true; R3.guide.geometry.setDrawRange(0, n); R3.guide.geometry.computeBoundingSphere(); R3.guide.computeLineDistances(); R3.guide.visible=true;
    }
  }
  // cámara
  const z=CAM3.zoom, b=pr.box, cam=R3.cam;
  const focus = (ANIM.on && d.balls.find(x=>x.id===ANIM.shot.unit)) || cur || {x:H.tee[0], y:H.tee[1]};
  const fh=hAt(pr,focus.x,focus.y);
  let want, look;
  if(CAM3.mode==='arriba'){
    const cx=(b.x0+b.x1)/2, cy=(b.y0+b.y1)/2, tf=Math.tan(25*Math.PI/180);
    const dist=Math.max((b.y1-b.y0)/2/tf, (b.x1-b.x0)/2/(tf*Math.max(.3, cam.aspect||1)))*1.12*z;
    want=W3(cx, cy-dist*(.18+CAM3.h*.25), dist); look=W3(cx, cy, 0);
  } else if(CAM3.mode==='hoyo'){
    const dx=focus.x-H.cup[0], dy=focus.y-H.cup[1], l=Math.hypot(dx,dy)||1, back=(50+l*.06)*z;
    want=W3(H.cup[0]-dx/l*back, H.cup[1]-dy/l*back, hAt(pr,H.cup[0],H.cup[1])+(35+l*.05)*z+CAM3.h*40); look=W3((focus.x+H.cup[0])/2, (focus.y+H.cup[1])/2, fh);
  } else {
    const yaw=(ANIM.on ? ANIM.shot.ang : am ? am.ang : Math.atan2(H.cup[1]-focus.y, H.cup[0]-focus.x)) + CAM3.yawOff;
    const dist=(ANIM.on?150:110)*z, hh=(ANIM.on?70:48)*z+CAM3.h*50;
    want=W3(focus.x-Math.cos(yaw)*dist, focus.y-Math.sin(yaw)*dist, fh+hh); look=W3(focus.x+Math.cos(yaw)*70, focus.y+Math.sin(yaw)*70, fh);
  }
  // lo que tapa la pelota (o está pegado a ella) se vuelve transparente para ver dónde tirar
  { const cx=cam.position.x, cy=-cam.position.z, fa=ANIM.on ? ANIM.shot.ang : am ? am.ang : null;
    const ex=focus.x+(fa==null?0:Math.cos(fa)*90), ey=focus.y+(fa==null?0:Math.sin(fa)*90), top=CAM3.mode==='arriba';
    for(const f of R3.fades){ const dx=Math.max(f.x0-focus.x, 0, focus.x-f.x1), dy=Math.max(f.y0-focus.y, 0, focus.y-f.y1);
      const hide=(f.near && Math.hypot(dx,dy)<f.near) || (!top && isFinite(cx+cy) && (segRect(cx,cy,focus.x,focus.y,f,5) || (f.near && segRect(focus.x,focus.y,ex,ey,f,2))));
      fadeApply(f, hide?f.min:1); } }
  const k = ANIM.on ? .07 : .18;
  // si la cámara quedó en un lugar imposible (pasaba al abrir con la vista de arriba guardada), se la pone directo donde va
  if(!isFinite(cam.position.x+cam.position.y+cam.position.z)) cam.position.copy(want);
  if(R3.camLook && !isFinite(R3.camLook.x+R3.camLook.y+R3.camLook.z)) R3.camLook=look.clone();
  cam.position.lerp(want, k);
  R3.camLook=(R3.camLook||look.clone()).lerp(look, k); cam.lookAt(R3.camLook);
  R3.renderer.render(R3.scene, cam);
}
function loop(){
  requestAnimationFrame(loop);
  if(!V || V.phase==='lobby' || !$('#game').classList.contains('on') || !R3.renderer) return;
  keyPowTick();
  draw3D();
}
requestAnimationFrame(loop);
setTimeout(()=>{ if(!window.THREE) $('#no3d').style.display='flex'; else init3D(); }, 0);

/* ====================== PANEL LATERAL ====================== */
function renderSidePanels(){ if($('#tab-hist').classList.contains('on')) renderHist(); renderMesaTab(); renderReglasTab(); }
let HIST_N=0;
function renderHist(){
  if(!V || ANIM.on) return;
  const L=(V.log||[]).slice().reverse(); const fresh=L.length-HIST_N; HIST_N=L.length;
  $('#histList').innerHTML = L.map((l,i)=>`<div class="hline ${i<fresh&&fresh<5?'new':''}">${esc(l.x)}</div>`).join('') || '<p class="muted">Todavía no hubo golpes.</p>';
}
function renderMesaTab(){
  const host=amHost(), inPlay=V.phase!=='lobby';
  const ps=V.players.map(p=>{
    const offline=!p.bot&&!p.conn;
    return `<div class="prow" style="border-left:5px solid ${p.color}">${ballDot(p.ball,22)}<span style="font-size:22px">${esc(p.emoji)}</span><span class="nm"><b>${esc(p.name)}${p.id===me()?' (vos)':''}${p.id===V.hostPid&&NET.mode!=='local'?' 👑':''}</b>
      <small>${V.opts.fmt!=='ind'?TEAMS[p.team].e+' '+TEAMS[p.team].n:''}${p.bot?' · 🤖 bot':` · 🔓 ${p.open||START_OPEN} hoyos`}${p.mic?' · 🎙️':''}${offline?' · ⚠️ sin conexión':''}${inPlay&&curShooter()===p.id?' · ⛳ jugando':''}</small></span>
      ${host&&p.id!==V.hostPid&&NET.mode!=='local'?`${offline&&inPlay?`<button class="btn sm gray" onclick="doAct({type:'botify',pid:'${p.id}'})" title="Que juegue un bot">🤖</button>`:''}<button class="btn sm gray" onclick="if(confirm('¿Sacar a ${esc(p.name)} de la cancha?'))doAct({type:'kick',pid:'${p.id}'})" title="Sacar">✕</button>`:''}</div>`;
  }).join('');
  const obs=(V.observers||[]).map(o=>`<div class="prow"><span style="font-size:20px">${o.owner?'👑':'👀'}</span><span class="nm"><b>${esc(o.name)}${o.id===me()?' (vos)':''}</b><small>${o.owner?'dueño del juego, ':''}mirando${o.mic?' · 🎙️':''}</small></span></div>`).join('');
  const sit = NET.obs && V.phase!=='play' && V.phase!=='holeEnd' && V.players.length<MAXP ? `<button class="btn gold wide" onclick="doAct({type:'joinNext'})">⛳ Sumarme a jugar</button>` : NET.obs ? `<p class="muted">Te podés sumar cuando termine la vuelta (si hay lugar).</p>` : '';
  const info = inPlay ? `<p class="muted">${esc(MODES[V.opts.mode].t)} · hoyo ${Math.min(V.hi+1, V.course.length)} de ${V.course.length}</p><button class="btn dark wide" style="margin-bottom:8px" onclick="cardModal()">📋 Ver la tarjeta grande</button>` : '';
  $('#mesaList').innerHTML = info + `<b>Jugadores (${V.players.length}/${MAXP})</b>` + ps + (obs?`<b>Mirando</b>${obs}`:'') + sit
    + (host && inPlay ? `<button class="btn dark wide" style="margin-top:8px" onclick="if(confirm('¿Terminar la vuelta y volver a la sala?'))doAct({type:'newGame',force:true})">⚙️ Terminar y volver a la sala</button>` : '')
    + (NET.mode!=='local'&&NET.code?`<p class="muted" style="margin-top:12px">Invitá con el código <b>${NET.code}</b> <button class="btn sm" onclick="shareRoom()">📤 Compartir</button></p>`:'');
}
function renderReglasTab(){
  const o=V.opts, on=HOUSE.filter(h=>o[h.k]), host=amHost();
  $('#reglasList').innerHTML = `<p style="margin-top:0"><b>${esc(MODES[o.mode].t)}</b> · ${esc(FORMATS[o.fmt])}</p><p class="muted">${esc(MODES[o.mode].d)}</p>`
    + `<p class="muted">Máximo ${o.max} golpes por hoyo · ayuda ${esc(AIMS.find(a=>a.v===o.aim).t.split(' (')[0])}${o.timer?` · ⏰ ${o.timer} s por golpe`:''} · 🔓 ${V.open||START_OPEN} de ${HOLES.length} hoyos abiertos</p>`
    + `<b>Reglas de la casa activas</b>` + (on.length ? on.map(h=>`<div class="opt"><span><b>${h.t}</b><small>${h.d}</small></span></div>`).join('') : '<p class="muted">Ninguna.</p>')
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
  const url=roomLink(), text=`¡Vení a jugar al Mini Golf conmigo! ⛳🇵🇾 Sala ${NET.code}`;
  if(navigator.share) return navigator.share({title:'Mini Golf PY', text, url}).catch(()=>{});
  modal(`<h2>📤 Invitar a la sala ${NET.code}</h2><p style="word-break:break-all;user-select:all;background:#fff;padding:8px;border-radius:8px">${esc(url)}</p>
    <a class="btn green wide" style="display:block;text-align:center;text-decoration:none" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text+' '+url)}">💬 Mandar por WhatsApp</a>
    <button class="btn wide" style="margin-top:6px" onclick="navigator.clipboard.writeText('${url}').then(()=>toast('Enlace copiado'))">📋 Copiar enlace</button>
    <button class="btn gray wide" style="margin-top:6px" onclick="closeModal()">Cerrar</button>`);
}
function showRules(){
  modal(`<div class="rules"><h2>📜 Cómo se juega</h2>
  <p>Hay que meter la pelota en el hoyo con la menor cantidad de golpes. Cada hoyo tiene su <b>par</b>: los golpes que debería llevar.</p>
  <h3>🕹️ Controles</h3>
  <ul><li><b>Apuntar:</b> tocá la cancha donde querés tirar, o arrastrá para los costados. Afinás con ◀ ▶ o deslizando la tira. ⛳ apunta derecho al hoyo.</li>
  <li><b>Fuerza:</b> en la barra de la derecha tirá con el dedo para abajo y soltá. En PC también podés mantener la barra espaciadora y soltarla; con ← → apuntás.</li>
  <li><b>Cámaras:</b> 🎯 detrás de la pelota, 🔭 toda la cancha desde arriba, ⛳ desde el hoyo. Arrastrá para arriba o abajo para subir o bajar la cámara.</li></ul>
  <h3>🗺️ Lo que hay en las canchas</h3>
  <ul><li><b>Lomas, pozos y rampas:</b> la pelota se curva y se frena en la subida.</li><li><b>Arena:</b> frena mucho.</li><li><b>Agua:</b> volvés a tirar desde donde estabas, con un golpe de castigo.</li>
  <li><b>Molino:</b> las aspas tapan la entrada cuando pasan por abajo.</li><li><b>Molinete:</b> gira y te puede devolver la pelota.</li><li><b>Túnel:</b> la pelota entra por el caño y sale del otro lado.</li><li><b>Rebotador rojo:</b> te devuelve la pelota con más fuerza.</li></ul>
  <h3>🔓 Hoyos que se abren</h3><p>Al principio hay ${START_OPEN} hoyos abiertos. Cuando terminás el último hoyo abierto jugando de a 2 o más (personas o bots), se abre el siguiente y se suma a la vuelta. Queda guardado en tu aparato, y si jugás con alguien que ya abrió más, también se te abren.</p>
  <h3>🎮 Modos</h3>${Object.keys(MODES).map(k=>`<p><b>${MODES[k].t}:</b> ${MODES[k].d}</p>`).join('')}
  <h3>👥 Equipos</h3><p><b>Mejor pelota:</b> cada uno juega su pelota y en cada hoyo cuenta la del que hizo menos. <b>Una pelota por equipo:</b> los del equipo se turnan para pegarle a la misma pelota.</p>
  <p>En cada hoyo sale primero el que hizo menos golpes en el hoyo anterior. Si llegás al máximo de golpes, se levanta la pelota.</p>
  <h3>🏠 Reglas de la casa</h3>${HOUSE.map(h=>`<p><b>${h.t}:</b> ${h.d}</p>`).join('')}
  <h3>🗺️ Los hoyos</h3>${HOLES.map((H,i)=>`<p><b>${i+1}. ${esc(H.n)}</b> (par ${H.par}): ${esc(H.d)}</p>`).join('')}
  </div><button class="btn wide" onclick="closeModal()">Entendido</button>`);
}
