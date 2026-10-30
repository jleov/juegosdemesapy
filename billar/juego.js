'use strict';
/* =====================================================================
   Billar PY — red (PeerJS), chat con privados, voz, sala de espera,
   mesa desde arriba (2D) y de costado (3D), controles de tiro y sonidos.
   ===================================================================== */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function store(k,v){ try{ if(v===undefined) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
function load(k){ try{ const v=localStorage.getItem(k); return v==null?null:JSON.parse(v); }catch(e){ return null; } }
function toast(x){ const t=$('#toast'); t.textContent=x; t.style.display='block'; clearTimeout(toast.t); toast.t=setTimeout(()=>t.style.display='none', 3800); }
const PREFIX='billarpy26-';
const genCode = () => { const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s=''; for(let i=0;i<5;i++) s+=A[rnd(A.length)]; return s; };
let myToken=load('billar_token'); if(!myToken){ myToken=Math.random().toString(36).slice(2)+Date.now().toString(36); store('billar_token', myToken); }
const NET={mode:null, peer:null, code:null, conns:{}, hostConn:null, myPid:null, obs:null, welcomed:false};
let CHAT=[], V=null;
const me = () => NET.myPid || NET.obs;
const amHost = () => NET.mode==='local' || (V && V.hostPid===NET.myPid && NET.mode==='host');
const VP = id => V && (V.players.find(p=>p.id===id) || (V.observers||[]).find(o=>o.id===id));
// ¿este aparato maneja a ese jugador? (en la partida local, todos los que no son bots)
const mine = pid => pid && (pid===me() || (NET.mode==='local' && V && V.players.some(p=>p.id===pid && !p.bot)));

/* ====================== MENÚ ====================== */
let myEmojiSel = load('billar_emoji') || EMOJIS[0];
const myName = () => ($('#myName').value.trim() || 'Jugador').slice(0,16);
const myEmoji = () => myEmojiSel;
$('#myName').value = load('billar_name') || '';
$('#myName').addEventListener('input', ()=>store('billar_name', $('#myName').value.trim()));
function renderTokenPicker(){ $('#tokens').innerHTML = EMOJIS.map(e=>`<button class="tok ${e===myEmojiSel?'sel':''}" onclick="pickEmoji('${e}')">${e}</button>`).join(''); }
function pickEmoji(e){ myEmojiSel=e; store('billar_emoji', e); renderTokenPicker(); }
renderTokenPicker();
function needName(){ if(!$('#myName').value.trim()){ toast('Escribí tu nombre primero ✍️'); $('#myName').focus(); return true; } store('billar_name', myName()); return false; }
function joinClick(){ const code=$('#joinCode').value.trim().toUpperCase(); if(!code) return toast('Escribí el código de la sala.'); if(needName()) return; clientJoin(code); }
function resumeClick(){
  const h=load('billar_host'), c=load('billar_client');
  if(h && (!c || h.at>=c.at)) return hostStart(true);
  if(c){ if(needName()) return; clientJoin(c.code); }
}
function refreshResume(){ const h=load('billar_host'), c=load('billar_client'), ok=x=>x && Date.now()-x.at<6*3600e3; $('#btnResume').style.display = ok(h)||ok(c) ? 'block' : 'none'; }
refreshResume();
(function(){
  const m=(location.hash.slice(1) || new URLSearchParams(location.search).get('sala') || '').toUpperCase();
  if(/^[A-Z0-9]{4,6}$/.test(m)){ $('#joinCode').value=m;
    if(new URLSearchParams(location.search).get('dueno')){ if(!$('#myName').value.trim()) $('#myName').value='Dueño'; setTimeout(()=>clientJoin(m), 300); }
    else toast('Te invitaron a la sala '+m+': escribí tu nombre y tocá “Entrar”.'); }
})();
const savedOpts = () => Object.assign(defaultOpts(), load('billar_opts')||{});

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
  sysChat('🎱 Mesa en este aparato. Sumá bots 🤖 o amigos que jueguen en el mismo celular o PC, elegí las reglas y tocá Empezar.');
  ANIM.lastN=null; commit(); renderChat();
}
function leaveClick(){
  if(NET.mode==='local'){ if(S && S.phase==='play' && !confirm('¿Salir de la partida?')) return; return leaveToMenu(); }
  if(!confirm('¿Salir de la sala?')) return;
  if(NET.mode==='host'){
    const others=hostCandidates(S);
    if(others.length) return hostHandover();
    store('billar_host', undefined);
  } else if(NET.mode==='client'){
    if(NET.hostConn && NET.hostConn.open && NET.myPid) try{ NET.hostConn.send({t:'act', a:{type:'leave'}}); }catch(e){}
    store('billar_client', undefined);
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
function lightShot(){ if(S && S.shot && S.shot.tracks && Date.now()>S.busyUntil+2500){ const x=S.shot; S.shot={n:x.n, res:x.res, pid:x.pid, side:x.side, stale:true}; } }
function publicState(forPid){
  const s=JSON.parse(JSON.stringify(S));
  s.players.forEach(p=>delete p.token);
  (s.observers||[]).forEach(o=>delete o.token);
  delete s.ownerTok;
  if(s.phase==='play' && NET.mode!=='local') (s.sides||[]).forEach(sd=>{ if(!sd.pids.includes(forPid) && !sd.out) sd.secret = sd.secret ? -1 : null; });
  return s;
}
function commit(){
  lightShot();
  if(NET.mode==='host'){
    for(const pid in NET.conns){ const c=NET.conns[pid]; if(c && c.open) try{ c.send({t:'state', s:publicState(pid)}); }catch(e){} }
    sendBackups();
    if(!NET.noSave){ const s=JSON.parse(JSON.stringify(S)); if(s.shot) s.shot={n:s.shot.n, res:s.shot.res, stale:true}; store('billar_host', {code:NET.code, S:s, CHAT:CHAT.slice(-80), myPid:NET.myPid, at:Date.now()}); }
  }
  if(S && (NET.mode==='host'||NET.mode==='local') && S.phase==='lobby') store('billar_opts', S.opts);
  render();
}
function doAct(a){
  if(NET.mode==='client'){ if(NET.hostConn && NET.hostConn.open) NET.hostConn.send({t:'act', a}); else toast('Sin conexión con el anfitrión.'); return; }
  let who=me();
  if(NET.mode==='local' && (a.type==='shot'||a.type==='place') && S && S.phase==='play'){ const sh=shooterOf(S); if(mine(sh)) who=sh; }
  const r=act(who, a); if(typeof r==='string'){ toast(r); if(a.type==='shot') AIM.sent=false; }
}
function newPeer(id){ return new Peer(id, {debug:1, config:{iceServers: window.ICE_SERVERS || [{urls:"stun:stun.l.google.com:19302"}]}}); }
function netBar(on,txt){ const b=$('#netbar'); b.style.display=on?'block':'none'; if(txt) b.textContent=txt; }

// ---------- anfitrión ----------
function hostStart(resume){
  if(!resume && needName()) return;
  const saved = resume ? load('billar_host') : null;
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
    if(resume){ toast('La sala sigue abierta en otro aparato (otro jugador quedó de anfitrión). Entrá con el código.'); peer.destroy(); store('billar_host',undefined); NET.mode=null; $('#joinCode').value=NET.code; return; }
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
  store('billar_host', undefined);
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
        why = S.players.length>=MAXP ? 'La mesa está llena: entraste a mirar 👀.' : 'La partida ya empezó: entraste a mirar 👀. Te podés sentar cuando termine la serie.';
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
  NET.noSave=true; store('billar_host', undefined);
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
      if(!NET.welcomed){ toast('No se encontró la sala '+code+'. Revisá el código.'); store('billar_client',undefined); leaveToMenu(); }
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
    store('billar_client',{code:NET.code, at:Date.now()}); if(location.hash!=='#'+NET.code) history.replaceState(null,'','#'+NET.code);
    if(d.why) toast(d.why);
  }
  else if(d.t==='state'){ S=d.s; render(); }
  else if(d.t==='chat'){ CHAT.push(d.m); renderChat(d.m); }
  else if(d.t==='chatlog'){ CHAT=d.list||[]; renderChat(); }
  else if(d.t==='aim'){ REMOTE_AIM=Object.assign({}, d.a, {pid:d.pid, at:Date.now()}); }
  else if(d.t==='backup'){ NET.backup={s:d.s, chat:d.chat}; }
  else if(d.t==='migrate'){ NET.backup={s:d.s, chat:d.chat}; takeoverHost('handover'); }
  else if(d.t==='kicked'){ toast('🚪 El anfitrión te sacó de la mesa.'); store('billar_client',undefined); leaveToMenu(); }
  else if(d.t==='err'){ toast(d.m); AIM.sent=false; }
}
// la mira del que está tirando se ve en vivo en los otros aparatos
let REMOTE_AIM=null;
function relayAim(pid, a){
  if(!a) return;
  const x={ang:+a.ang||0, pow:+a.pow||0, cx:a.cx==null?null:+a.cx, cy:a.cy==null?null:+a.cy, sa:+a.sa||0, sb:+a.sb||0};
  if(pid!==me()) REMOTE_AIM=Object.assign({}, x, {pid, at:Date.now()});
  for(const id in NET.conns){ if(id===pid) continue; const c=NET.conns[id]; if(c && c.open) try{ c.send({t:'aim', a:x, pid}); }catch(e){} }
}
function sendAim(){
  if(NET.mode==='local' || !V || V.phase!=='play') return;
  const now=Date.now(); if(now-(sendAim.t||0)<90) { clearTimeout(sendAim.tm); sendAim.tm=setTimeout(sendAim, 100); return; }
  sendAim.t=now;
  const a={ang:AIM.ang, pow:AIM.pow, cx:V.bih?AIM.cx:null, cy:V.bih?AIM.cy:null, sa:AIM.sa, sb:AIM.sb};
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
// globito arriba de la mesa con lo último que dijeron
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
const SND={on:load('billar_snd')!==false, ctx:null};
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
  cue(p){ noise(.05,.25+p*.4,0,900); tone(160,.07,'triangle',.08+p*.1); },
  ball(v){ tone(2600+v*900,.035,'sine',.05+v*.25); noise(.025,.08+v*.4,0,3500); },
  rail(v){ tone(95,.12,'sine',.06+v*.3); noise(.05,.05+v*.2,0,0,500); },
  pocket(v){ tone(70,.22,'sine',.18+v*.2); noise(.18,.15,0.03,0,700); [0,.07,.15].forEach(w=>tone(300+rnd(200),.05,'triangle',.04,.05+w)); },
  turn(){ tone(740,.12,'sine',.12); tone(988,.18,'sine',.12,.11); },
  foul(){ tone(300,.2,'sawtooth',.07); tone(200,.3,'sawtooth',.07,.18); },
  win(){ [523,659,784,1047].forEach((f,i)=>tone(f,.3,'triangle',.14,i*.13)); },
  priv(){ tone(1200,.08,'sine',.08); tone(1500,.1,'sine',.08,.08); },
  tick(){ tone(1800,.02,'square',.025); },
};
function toggleSound(){ SND.on=!SND.on; store('billar_snd', SND.on); $('#btnSnd').textContent=SND.on?'🔊':'🔇'; if(SND.on) sfx.turn(); }
$('#btnSnd').textContent=SND.on?'🔊':'🔇';
document.addEventListener('pointerdown', ()=>actx(), {once:true});
const MUSIC_CREDIT = 'Música: "Monkeys Spinning Monkeys" de Kevin MacLeod (incompetech.com). Licencia Creative Commons Atribución 4.0: creativecommons.org/licenses/by/4.0/';
const MUSIC = { on: load('billar_music')===true, buf:null, src:null, gain:null, loading:false, VOL:.07 };
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
function toggleMusic(){ MUSIC.on=!MUSIC.on; store('billar_music', MUSIC.on); musicSync(); toast(MUSIC.on?'🎶 Música de fondo prendida (suave).':'🔕 Música de fondo apagada.'); }
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
function ballHTML(n, sz){
  const c=ballColor(n), st=isStripe(n);
  return `<span class="mb${st?' st':''}" style="--bc:${c};${sz?`--s:${sz}px`:''}">${n?`<i>${n}</i>`:''}</span>`;
}

// ---------- sala de espera ----------
function renderLobby(){
  const host=amHost(), myObs=!!NET.obs, o=V.opts, eq=o.fmt==='eq';
  $('#lobbyCode').textContent=NET.code||'—';
  $('#lobbyCodeBox').style.display = NET.mode==='local' ? 'none' : '';
  $('#lobbyTitle').textContent = NET.mode==='local' ? '🎱 Mesa en este aparato' : '🎱 Sala de espera';
  $('#pcount').textContent=`(${V.players.length}/${MAXP})`;
  const teamBtn = p => eq ? `<button class="tbtn" style="background:${TEAMS[p.team].c}" ${host||p.id===me()?`onclick="doAct({type:'team',pid:'${p.id}'})"`:'disabled'} title="Cambiar de equipo">${TEAMS[p.team].e}</button>` : '';
  $('#plist').innerHTML=V.players.map(p=>`<li>${teamBtn(p)}${playerTag(p)}${host && p.id!==V.hostPid?`<button class="btn sm gray" onclick="doAct({type:'kick',pid:'${p.id}'})" title="Sacar">✕</button>`:''}</li>`).join('')
    + (V.observers||[]).map(x=>`<li style="opacity:.75"><span style="font-size:20px">👀</span><span class="nm">${esc(x.name)} <span class="muted">mirando</span></span>${x.mic?'🎙️':''}</li>`).join('');
  const err=canStartV();
  $('#lobbyHostBtns').innerHTML = host
    ? `<div class="row"><button class="btn gray" onclick="doAct({type:'addBot'})" ${V.players.length>=MAXP?'disabled':''}>🤖 Sumar bot</button>
       ${NET.mode==='local'?`<button class="btn gray" onclick="addLocalClick()" ${V.players.length>=MAXP?'disabled':''}>🙋 Amigo en este aparato</button>`:''}
       <button class="btn green" onclick="doAct({type:'start'})">▶️ Empezar</button></div>
       <p class="muted">${err?'⚠️ '+esc(err):'¡Listo para empezar!'}${eq?' · Tocá 🔴/🔵 para cambiar a alguien de equipo.':''}</p>`
    : `<p class="muted" style="text-align:center">⏳ Esperando que el anfitrión 👑 empiece la partida…${eq?'<br>Podés tocar tu 🔴/🔵 para cambiarte de equipo.':''}</p>`;
  $('#lobbyObs').innerHTML = myObs ? `<div class="obsbar" style="border-radius:10px;margin-top:8px">👀 Estás mirando. ${V.players.length<MAXP?`<button class="btn sm gold" onclick="doAct({type:'joinNext'})">🪑 Sentarme a jugar</button>`:'La mesa está llena.'}</div>` : '';
  $('#optsBox').innerHTML = optsHTML(host);
  const g=$('#grulesBox');
  if(host){
    if(!g.querySelector('textarea')) g.innerHTML=`<textarea id="grulesIn" maxlength="1200" placeholder="Ej.: el que pierde paga el tereré 🧉&#10;Si la blanca salta de la mesa, bola en mano…"></textarea><p class="muted" style="margin:4px 0 0">Se guarda solo y lo ven todos.</p>`;
    const ta=$('#grulesIn'); if(document.activeElement!==ta) ta.value=V.grules||'';
    ta.oninput=()=>{ clearTimeout(ta.t); ta.t=setTimeout(()=>doAct({type:'grules', text:ta.value}), 600); };
  } else g.innerHTML = V.grules ? `<div class="grules">${esc(V.grules)}</div>` : `<p class="muted">El anfitrión todavía no escribió reglas propias.</p>`;
  $('#sugBox').innerHTML = sugsHTML(host);
}
function canStartV(){ const keep=S; S=V; try{ return canStart(); } finally{ S=keep; } }
function addLocalClick(){ const n=prompt('Nombre del amigo que juega en este aparato:'); if(n && n.trim()) doAct({type:'addLocal', name:n.trim()}); }
function optsHTML(host){
  const o=V.opts, dis = host && V.phase==='lobby' ? '' : 'disabled';
  const sel=(k, list)=>`<select ${dis} onchange="doAct({type:'opt',k:'${k}',v:this.value})">${list.map(x=>`<option value="${x.v}" ${o[k]==x.v?'selected':''}>${x.t}</option>`).join('')}</select>`;
  const modes=Object.keys(MODES).map(k=>({v:k, t:MODES[k].t}));
  return `<label style="margin-top:0">Modo de juego ${host?'':'<span class="muted">(lo elige el anfitrión)</span>'}</label>${sel('mode', modes)}
    <p class="muted" style="margin:4px 0 0">${esc(MODES[o.mode].d)}</p>
    <label>Cómo se juega</label>${sel('fmt', Object.keys(FORMATS).map(k=>({v:k, t:FORMATS[k]})))}
    ${o.mode!=='libre'?`<label>Duración</label>${sel('race', RACES)}`:''}
    ${o.mode==='rot'?`<label>Puntos para ganar</label>${sel('rotTarget', [{v:61,t:'61 puntos (oficial)'},{v:31,t:'31 puntos (corta)'},{v:91,t:'91 puntos (larga)'}])}`:''}
    <label>🎯 Dificultad (ayuda para apuntar)</label>${sel('aim', AIMS)}
    <label>Nivel de los bots</label>${sel('bot', BOTLV)}
    <label>Reglas de la casa</label>`
    + (HOUSE.filter(h=>h.modes.includes(o.mode)).map(h=>`<label class="opt" style="margin:0 0 6px;font-weight:400"><input type="checkbox" ${o[h.k]?'checked':''} ${dis} onchange="doAct({type:'opt',k:'${h.k}',v:this.checked})"><span><b>${h.t}</b><small>${h.d}</small></span></label>`).join('') || '<p class="muted">Este modo no tiene reglas para elegir.</p>');
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
const AIM={ang:0, pow:0, sa:0, sb:0, call:null, cx:null, cy:null, placing:false, sent:false, key:null, charging:false};
const ANIM={on:false, lastN:null, t0:0, shot:null, evI:0, potF:{}};
const curShooter = () => V && V.phase==='play' ? shooterOf(V) : null;
const myTurn = () => !!V && V.phase==='play' && !ANIM.on && mine(curShooter()) && !NET.obs;

function renderGame(){
  $('#roomTag').textContent = NET.mode==='local' ? '📱 En este aparato' : '🔑 '+NET.code;
  $('#obsbar').style.display = NET.obs ? 'block' : 'none';
  if(NET.obs) $('#obsbar').textContent = '👀 Estás mirando la partida.';
  // ¿llegó un tiro nuevo?
  if(ANIM.lastN==null) ANIM.lastN = V.shot ? V.shot.n : 0;   // al entrar no se repite el último tiro
  else if(V.shot && V.shot.n!==ANIM.lastN){
    ANIM.lastN=V.shot.n;
    if(V.shot.tracks) startAnim(V.shot);
    AIM.sent=false;
  }
  // ¿empieza un turno nuevo?
  const key = V.phase==='play' ? `${V.rack}|${V.shotN}|${curShooter()}` : null;
  if(key && key!==AIM.key){ AIM.key=key; resetAim(); }
  renderScore(); renderCtrl();
  if(!ANIM.on) afterShotUI();
}
function resetAim(){
  AIM.pow=0; AIM.sa=0; AIM.sb=0; AIM.call=null; AIM.sent=false; AIM.placing=false;
  const cue=V.balls.find(b=>b.n===0);
  AIM.cx=cue.x; AIM.cy=cue.y;
  if(V.bih && V.breakShot){ AIM.cx=HEAD_X; AIM.cy=MID_Y; }
  // apunta a la primera bola que se puede tocar
  const t=legalFirstV()[0], b = V.breakShot ? V.balls.filter(x=>x.n && !x.in).sort((p,q)=>p.x-q.x)[0] : t!=null && V.balls.find(x=>x.n===t && !x.in);
  if(b) AIM.ang=Math.atan2(b.y-AIM.cy, b.x-AIM.cx);
  if(V.shot && V.shot.res && V.shot.res.foul && mine(curShooter())) toast('✋ Bola en mano: arrastrá la blanca adonde quieras y tirá.');
  CAM3.follow=true;
}
const legalFirstV = () => { const keep=S; S=V; try{ return legalFirst(V); } finally{ S=keep; } };
const needsCallV = () => needsCall(V);
function cuePos(){ return V && V.bih && mine(curShooter()) && AIM.cx!=null ? {x:AIM.cx, y:AIM.cy} : (()=>{ const c=V.balls.find(b=>b.n===0); return c?{x:c.x,y:c.y}:{x:HEAD_X,y:MID_Y}; })(); }

// ---------- marcador ----------
function renderScore(){
  const cs=V.cur, m=V.opts.mode, sh=curShooter();
  $('#score').innerHTML = V.sides.map((s,i)=>{
    const color = s.team!=null ? TEAMS[s.team].c : (V.players.find(p=>p.id===s.pids[0])||{}).color||'#888';
    const names = s.pids.map(pid=>{ const p=V.players.find(x=>x.id===pid); if(!p) return ''; return `<span class="${pid===sh&&V.phase==='play'?'shoot':''}">${esc(p.emoji)} ${esc(p.name)}${p.bot?'🤖':''}${!p.bot&&!p.conn?'⚠️':''}${p.mic?'🎙️':''}</span>`; }).join(' ');
    let extra='';
    if(m==='8'){ if(s.group){ const left=groupNums(s.group).filter(n=>V.balls.some(b=>b.n===n && !b.in)); extra = left.length ? left.map(n=>ballHTML(n,16)).join('') : `${ballHTML(8,16)} <small>¡a la 8!</small>`; } else extra='<small>mesa abierta</small>'; }
    if(m==='rot') extra=`<b class="pts">${s.pts}</b><small>/${V.opts.rotTarget}</small>`;
    if((m==='9'||m==='10') && s.fouls) extra=`<small>🚫 ${s.fouls} falta${s.fouls>1?'s':''}</small>`;
    if(m==='kelly'){
      const mineSide = s.pids.some(pid=>mine(pid));
      if(s.out) extra='<small>💥 afuera</small>';
      else if(NET.mode==='local') extra = KELLY_SHOW===i ? `🤫 ${ballHTML(s.secret,16)}` : `<button class="btn sm dark" onclick="peekSecret(${i})">🤫 ver</button>`;
      else extra = mineSide ? `<small>tu bola:</small> ${ballHTML(s.secret,16)}` : '<small>🤫 ?</small>';
    }
    const racks = V.opts.race>1 ? `<span class="racks">${'●'.repeat(s.racks)}${'○'.repeat(Math.max(0,V.opts.race-s.racks))}</span>` : '';
    return `<div class="sc ${i===cs&&V.phase==='play'?'on':''} ${s.out?'out':''}" style="--pc:${color}"><div class="nms">${s.team!=null?`<b>${TEAMS[s.team].e}</b> `:''}${names}</div><div class="ex">${extra}${racks}</div></div>`;
  }).join('');
}
let KELLY_SHOW=-1;
function peekSecret(i){ KELLY_SHOW=i; renderScore(); setTimeout(()=>{ KELLY_SHOW=-1; if(V) renderScore(); }, 2500); }

// ---------- controles ----------
function renderCtrl(){
  const my=myTurn(), sh=curShooter(), p=V.players.find(x=>x.id===sh);
  let st='';
  if(V.phase==='play'){
    if(ANIM.on) st='🎱 …';
    else if(my){
      const who = NET.mode==='local' && V.players.filter(x=>!x.bot).length>1 ? `<b>${esc(p.name)}</b>, ` : '';
      const legal=legalFirstV();
      const tgt = V.opts.mode==='libre' ? '' : V.opts.mode==='8' && !V.sides[V.cur].group ? (V.breakShot?' · ¡a romper!':' · mesa abierta') : legal.length===1 ? ` · tocá primero la ${legal[0]}` : V.opts.mode==='8' ? ` · tus ${groupName(V.sides[V.cur].group)}` : '';
      st = `${who}te toca${tgt}`;
      if(V.bih) st += V.bih.zone==='head' ? ' · ✋ blanca detrás de la línea' : ' · ✋ bola en mano';
      if(needsCallV()) st += AIM.call==null ? ' · 📣 cantá la tronera' : ` · tronera ${POCKETS[AIM.call].n}`;
    } else st = `Tira <b>${esc(p?p.name:'?')}</b>${p&&p.bot?' 🤖':''}${V.bih?' (bola en mano)':''}`;
  } else if(V.phase==='rackEnd' || V.phase==='over') st='🏆 Fin de la partida';
  $('#status').innerHTML=st;
  $('#ctrl').classList.toggle('dis', !my);
  $('#callRow').style.display = my && needsCallV() ? 'flex' : 'none';
  $('#callRow').innerHTML = '<span>📣 Tronera de la 8:</span>' + POCKETS.map((pk,i)=>`<button class="${AIM.call===i?'on':''}" onclick="setCall(${i})">${pk.n}</button>`).join('');
  $('#btnRerack').style.display = V.opts.mode==='libre' && amHost() ? '' : 'none';
  renderSpinBtn();
}
function setCall(i){ AIM.call=i; renderCtrl(); }
function renderSpinBtn(){ const d=$('#spinDot'); d.style.left=(50+AIM.sa*38)+'%'; d.style.top=(50-AIM.sb*38)+'%'; }
function spinModal(){
  modal(`<h2>🎯 Efecto en la blanca</h2><p class="muted" style="margin-top:0">Tocá dónde le pega el taco. <b>Abajo</b>: la blanca vuelve para atrás (retroceso). <b>Arriba</b>: sigue de largo. <b>A los costados</b>: cambia cómo sale de las bandas.</p>
    <div class="spinbig" id="spinBig"><i id="spinBigDot"></i></div>
    <div class="row" style="margin-top:12px"><button class="btn gray" onclick="AIM.sa=0;AIM.sb=0;spinPaint()">⊙ Al centro</button><button class="btn green" onclick="closeModal()">Listo</button></div>`);
  const el=$('#spinBig');
  const setFrom=e=>{ const r=el.getBoundingClientRect(); let x=(e.clientX-r.left)/r.width*2-1, y=-((e.clientY-r.top)/r.height*2-1); const m=Math.hypot(x,y); if(m>.85){ x*=.85/m; y*=.85/m; } AIM.sa=+(x/.85).toFixed(2); AIM.sb=+(y/.85).toFixed(2); spinPaint(); sendAim(); };
  el.onpointerdown=e=>{ el.setPointerCapture(e.pointerId); setFrom(e); el.onpointermove=setFrom; };
  el.onpointerup=()=>{ el.onpointermove=null; };
  spinPaint();
}
function spinPaint(){ const d=$('#spinBigDot'); if(d){ d.style.left=(50+AIM.sa*42.5)+'%'; d.style.top=(50-AIM.sb*42.5)+'%'; } renderSpinBtn(); }

// afinar la puntería: tira deslizable y botones
(function(){
  const fs=$('#fine'); let lx=null;
  fs.addEventListener('pointerdown', e=>{ if(!myTurn()) return; fs.setPointerCapture(e.pointerId); lx=e.clientX; });
  fs.addEventListener('pointermove', e=>{ if(lx==null) return; const d=e.clientX-lx; lx=e.clientX; turnAim(d*.0012); fs.style.backgroundPositionX=(parseFloat(fs.style.backgroundPositionX||0)+d)+'px'; });
  const end=()=>{ lx=null; }; fs.addEventListener('pointerup', end); fs.addEventListener('pointercancel', end);
  const hold=(btn, d)=>{ let t=null; const go=()=>{ turnAim(d); t=setTimeout(go, t?40:350); };
    btn.addEventListener('pointerdown', e=>{ e.preventDefault(); if(!myTurn()) return; t=null; go(); });
    ['pointerup','pointerleave','pointercancel'].forEach(k=>btn.addEventListener(k, ()=>{ clearTimeout(t); t=null; })); };
  hold($('#aimL'), -.0025); hold($('#aimR'), .0025);
})();
function turnAim(d){ if(!myTurn()) return; AIM.ang+=d; sendAim(); }

// fuerza: se tira para abajo y se suelta
(function(){
  const bar=$('#power'); let y0=null;
  const set=e=>{ const r=bar.getBoundingClientRect(); AIM.pow=Math.max(0, Math.min(1, (e.clientY-y0)/(r.height*.85))); paintPower(); sendAim(); };
  bar.addEventListener('pointerdown', e=>{ if(!myTurn() || AIM.sent) return; e.preventDefault(); bar.setPointerCapture(e.pointerId); y0=e.clientY; AIM.charging=true; AIM.pow=0; paintPower(); });
  bar.addEventListener('pointermove', e=>{ if(y0!=null) set(e); });
  bar.addEventListener('pointerup', e=>{ if(y0==null) return; y0=null; AIM.charging=false; if(AIM.pow>.015) shoot(); else { AIM.pow=0; paintPower(); } });
  bar.addEventListener('pointercancel', ()=>{ y0=null; AIM.charging=false; AIM.pow=0; paintPower(); });
})();
function paintPower(){ $('#powFill').style.height=(AIM.pow*100)+'%'; $('#powTxt').textContent = AIM.pow>0 ? Math.round(AIM.pow*100)+'%' : '⬇️'; }
function shoot(){
  if(!myTurn() || AIM.sent) return;
  if(needsCallV() && AIM.call==null){ toast('📣 Antes de tirar a la 8, elegí la tronera (botones de abajo).'); AIM.pow=0; paintPower(); return; }
  if(V.bih){ const r=placeOk(V, AIM.cx, AIM.cy); if(r){ toast('✋ '+r); AIM.pow=0; paintPower(); return; } }
  AIM.sent=true;
  sfx.cue(AIM.pow);
  doAct({type:'shot', ang:AIM.ang, pow:AIM.pow, sa:AIM.sa, sb:AIM.sb, call:AIM.call, cx:V.bih?AIM.cx:null, cy:V.bih?AIM.cy:null});
  setTimeout(()=>{ AIM.pow=0; paintPower(); }, 200);
}
document.addEventListener('keydown', e=>{
  if(!V || V.phase!=='play' || !$('#game').classList.contains('on') || e.target.tagName==='INPUT' || e.target.tagName==='TEXTAREA') return;
  if(e.key==='ArrowLeft'||e.key==='ArrowRight'){ e.preventDefault(); turnAim((e.key==='ArrowLeft'?-1:1)*(e.shiftKey?.0008:.006)); }
  if(e.key===' ' && myTurn() && !e.repeat){ e.preventDefault(); KEYPOW.t0=performance.now(); AIM.charging=true; }
});
document.addEventListener('keyup', e=>{
  if(e.key===' ' && KEYPOW.t0){ const p=AIM.pow; KEYPOW.t0=0; AIM.charging=false; if(p>.015) shoot(); }
});
const KEYPOW={t0:0};   // con la barra espaciadora la fuerza sube y baja: soltás cuando querés

// ---------- animación del tiro ----------
function startAnim(shot){
  ANIM.on=true; ANIM.shot=shot; ANIM.t0=performance.now(); ANIM.evI=0; ANIM.potF={};
  (shot.ev||[]).forEach(e=>{ if(e.k==='p') ANIM.potF[e.n]=e.f; });
  if(shot.pid!==me() || NET.mode==='local') sfx.cue(shot.pow||.5);
  REMOTE_AIM=null; CAM3.shotStart=performance.now(); if(CAM3.follow && shot.ang!=null) CAM3.yaw=shot.ang;
}
function animFrame(){ return (performance.now()-ANIM.t0)/1000*30; }
function trackPos(t, f){
  const n=t.length/2, k=Math.floor(f);
  if(k>=n-1) return [t[(n-1)*2]/10, t[(n-1)*2+1]/10];
  const a=f-k; return [(t[k*2]+(t[k*2+2]-t[k*2])*a)/10, (t[k*2+1]+(t[k*2+3]-t[k*2+1])*a)/10];
}
// bolas que se ven ahora: durante el tiro salen del recorrido, si no del estado
function dispBalls(){
  if(ANIM.on){
    const sh=ANIM.shot, f=animFrame();
    while(ANIM.evI<(sh.ev||[]).length && sh.ev[ANIM.evI].f<=f){ const e=sh.ev[ANIM.evI++]; if(e.k==='b') sfx.ball(e.v); else if(e.k==='r') sfx.rail(e.v); else if(e.k==='p') sfx.pocket(e.v); }
    if(f>=sh.frames+2){ ANIM.on=false; afterShotUI(true); renderScore(); renderCtrl(); }
    else {
      return sh.from.filter(b=>!b.in && sh.tracks[b.n]).map(b=>{
        const [x,y]=trackPos(sh.tracks[b.n], f), pf=ANIM.potF[b.n];
        return {n:b.n, x, y, sink: pf!=null && f>=pf ? Math.min(1,(f-pf)/8) : 0};
      }).filter(b=>b.sink<1);
    }
  }
  const out=V.balls.filter(b=>!b.in).map(b=>({n:b.n, x:b.x, y:b.y}));
  if(V.phase==='play' && V.bih){
    const c=out.find(b=>b.n===0);
    if(mine(curShooter()) && AIM.cx!=null){ if(c){ c.x=AIM.cx; c.y=AIM.cy; } }
    else if(REMOTE_AIM && REMOTE_AIM.cx!=null && c){ c.x=REMOTE_AIM.cx; c.y=REMOTE_AIM.cy; }
  }
  return out;
}
let LASTRES=null;
function afterShotUI(justEnded){
  if(!V || !V.shot || !V.shot.res) return;
  if(LASTRES===V.shot.n) return; LASTRES=V.shot.n;
  if(!justEnded) { endModal(); return; }
  const r=V.shot.res;
  if(r.foul){ banner('🚫 Falta: '+r.foul, 'foul'); sfx.foul(); }
  else if(r.msg && !r.win) banner(r.msg, '');
  if(myTurn()){ sfx.turn(); if(!r.keep || r.foul) yourTurn(); }
  endModal();
}
function banner(t, cls){ const b=$('#banner'); b.className='banner '+(cls||''); b.textContent=t; b.style.display='block'; clearTimeout(banner.t); banner.t=setTimeout(()=>b.style.display='none', 3200); }
function yourTurn(){ const d=document.createElement('div'); d.className='yourturn'; d.textContent='🎱 ¡Te toca!'; document.body.appendChild(d); setTimeout(()=>d.remove(),1700); }

// fin de partida / serie
let ENDSHOWN=null;
function endModal(){
  if(!V || (V.phase!=='rackEnd' && V.phase!=='over') || !V.rackWin) { if(ENDSHOWN && V && V.phase==='play'){ ENDSHOWN=null; closeModal(); } return; }
  if(ANIM.on) return;
  const key=V.rack+'|'+V.phase; if(ENDSHOWN===key) return; ENDSHOWN=key;
  const w=V.rackWin, host=amHost(), over=V.phase==='over';
  const iWon = V.sides[w.side] && V.sides[w.side].pids.some(pid=>pid===me()||mine(pid));
  if(w.libre){ modal(`<h2>🎉 ¡Mesa limpia!</h2><p>No quedan bolas.</p>${host?`<button class="btn green wide" onclick="closeModal();doAct({type:'rerack'})">🔁 Volver a armar</button>`:''}<button class="btn gray wide" style="margin-top:6px" onclick="closeModal()">Cerrar</button>`); return; }
  if(iWon) sfx.win();
  const tbl = V.sides.map((s,i)=>`<tr><td>${esc(sideName(V,i))}</td><td style="text-align:right"><b>${s.racks}</b> ${V.opts.race>1?'ganada'+(s.racks===1?'':'s'):''}${V.opts.mode==='kelly'&&s.secret>0?` · bola ${s.secret}`:''}</td></tr>`).join('');
  modal(`<h2>${over?'🏆 ¡Ganó la serie!':'🎱 Partida terminada'}</h2>
    <p style="font-size:18px"><b>${esc(sideName(V, w.side))}</b> ${over?'gana':'gana esta partida'} 🎉</p>
    <p class="muted">${esc(w.why||'')}</p>
    ${V.opts.race>1||V.sides.length>2?`<table class="score">${tbl}</table>`:''}
    ${host ? (over ? `<button class="btn green wide" onclick="closeModal();doAct({type:'rematch'})">🔁 Revancha</button><button class="btn wide" style="margin-top:6px" onclick="closeModal();doAct({type:'newGame'})">⚙️ Volver a la sala (cambiar reglas)</button>`
                   : `<button class="btn green wide" onclick="closeModal();doAct({type:'nextRack'})">▶️ Siguiente partida</button><p class="muted">Si no, arranca sola en unos segundos.</p>`)
           : `<p class="muted">${over?'El anfitrión elige si hay revancha.':'La próxima partida arranca en unos segundos…'}</p>`}
    <button class="btn gray wide" style="margin-top:6px" onclick="closeModal()">Mirar la mesa</button>`);
}

/* ====================== MESA 2D (desde arriba) ====================== */
const VIEW=Object.assign({mode:'2d', felt:'verde'}, load('billar_view')||{});
const FELTS={verde:['#1d8a52','#0f5e36'], azul:['#2667b8','#153f78'], bordo:['#9a2a3a','#5e1220'], gris:['#5d6b78','#37424c']};
function saveView(){ store('billar_view', {mode:VIEW.mode, felt:VIEW.felt}); }
const RW=12.5;   // ancho de la baranda de madera
const T2={s:1, ox:0, oy:0, rot:false};
const cv=$('#c2d'), cx2=cv.getContext('2d');
function resizeStage(){
  const st=$('#stage'), r=st.getBoundingClientRect(), dpr=Math.min(2, window.devicePixelRatio||1);
  for(const c of [cv]){ c.width=Math.max(1,r.width*dpr|0); c.height=Math.max(1,r.height*dpr|0); c.style.width=r.width+'px'; c.style.height=r.height+'px'; }
  if(R3.renderer){ R3.renderer.setSize(r.width, r.height, false); R3.cam.aspect=r.width/Math.max(1,r.height); R3.cam.updateProjectionMatrix(); }
}
window.addEventListener('resize', ()=>{ if($('#game').classList.contains('on')) resizeStage(); });
function layout2D(){
  const dpr=Math.min(2, window.devicePixelRatio||1), W=cv.width/dpr, H=cv.height/dpr, pad=8, right=64;
  const ow=TL+2*RW, oh=TW+2*RW;
  T2.rot = H > W*1.05;
  const aw = T2.rot ? W-right-pad : W-right-pad*2, ah=H-pad*2;
  const s = T2.rot ? Math.min(aw/oh, ah/ow) : Math.min(aw/ow, ah/oh);
  T2.s=s;
  if(T2.rot){ T2.ox = pad + (aw-oh*s)/2 + RW*s; T2.oy = pad + (ah-ow*s)/2 + RW*s; }
  else { T2.ox = pad + (aw-ow*s)/2 + RW*s; T2.oy = pad + (ah-oh*s)/2 + RW*s; }
  return dpr;
}
function toScreen(x,y){ return T2.rot ? [T2.ox + (TW-y)*T2.s, T2.oy + x*T2.s] : [T2.ox + x*T2.s, T2.oy + y*T2.s]; }
function toTable(X,Y){ return T2.rot ? {x:(Y-T2.oy)/T2.s, y:TW-(X-T2.ox)/T2.s} : {x:(X-T2.ox)/T2.s, y:(Y-T2.oy)/T2.s}; }
function draw2D(){
  const c=cx2, dpr=layout2D(), s=T2.s;
  c.setTransform(1,0,0,1,0,0); c.clearRect(0,0,cv.width,cv.height);
  c.setTransform(dpr,0,0,dpr,0,0);
  if(T2.rot){ c.translate(T2.ox+TW*s, T2.oy); c.rotate(Math.PI/2); } else c.translate(T2.ox, T2.oy);
  c.scale(s,s);
  // madera
  c.save(); c.shadowColor='rgba(0,0,0,.6)'; c.shadowBlur=30*s>0?18/s*s:0;
  const wg=c.createLinearGradient(0,-RW,0,TW+RW); wg.addColorStop(0,'#7a3f1d'); wg.addColorStop(.5,'#5a2e17'); wg.addColorStop(1,'#43200f');
  c.fillStyle=wg; rrect(c,-RW,-RW,TL+2*RW,TW+2*RW,6); c.fill(); c.restore();
  c.strokeStyle='rgba(255,220,170,.18)'; c.lineWidth=.6; rrect(c,-RW+1.2,-RW+1.2,TL+2*RW-2.4,TW+2*RW-2.4,5); c.stroke();
  // paño
  const [f1,f2]=FELTS[VIEW.felt]||FELTS.verde;
  c.fillStyle=f2; c.fillRect(-4.6,-4.6,TL+9.2,TW+9.2);
  const fg=c.createRadialGradient(TL/2,TW/2,10,TL/2,TW/2,TL*.62); fg.addColorStop(0,f1); fg.addColorStop(1,f2);
  c.fillStyle=fg; c.fillRect(0,0,TL,TW);
  // ñandutí y marca en el paño
  c.save(); c.globalAlpha=.07; c.strokeStyle='#fff'; c.lineWidth=.5;
  for(const r of [6,12,18]){ c.beginPath(); c.arc(TL/2,TW/2,r,0,7); c.stroke(); }
  for(let a=0;a<36;a++){ const t=a/36*Math.PI*2; c.beginPath(); c.moveTo(TL/2+Math.cos(t)*3,TW/2+Math.sin(t)*3); c.lineTo(TL/2+Math.cos(t)*18,TW/2+Math.sin(t)*18); c.stroke(); }
  c.globalAlpha=.09; c.fillStyle='#fff'; c.font='bold 7px system-ui'; c.textAlign='center'; c.fillText('BILLAR · PARAGUAY', TL/2, TW/2+28); c.restore();
  // línea de salida y punto de pie
  c.save(); c.strokeStyle='rgba(255,255,255,.18)'; c.lineWidth=.35; c.setLineDash([2,2]); c.beginPath(); c.moveTo(HEAD_X,0); c.lineTo(HEAD_X,TW); c.stroke(); c.restore();
  dot(c, FOOT_X, MID_Y, .6, 'rgba(255,255,255,.35)'); dot(c, HEAD_X, MID_Y, .6, 'rgba(255,255,255,.35)');
  if(V.phase==='play' && V.bih && V.bih.zone==='head' && !ANIM.on){ c.fillStyle='rgba(255,255,255,.05)'; c.fillRect(0,0,HEAD_X,TW); }
  // bandas (goma) con las bocas de las troneras
  c.fillStyle=shade(f2,-.18);
  for(const sg of SEGS){ if(Math.hypot(sg[2]-sg[0], sg[3]-sg[1])<10) continue; cushionPoly(c, sg); }
  c.strokeStyle='rgba(0,0,0,.25)'; c.lineWidth=.3;
  // troneras
  POCKETS.forEach((p,i)=>{
    const r = i===1||i===4 ? 6.2 : 6.6;
    const g=c.createRadialGradient(p.x,p.y,1,p.x,p.y,r); g.addColorStop(0,'#000'); g.addColorStop(.8,'#0b0b0b'); g.addColorStop(1,'#2a2a2a');
    c.fillStyle=g; c.beginPath(); c.arc(p.x,p.y,r,0,7); c.fill();
  });
  // diamantes
  c.fillStyle='#f3e6c4';
  for(let k=1;k<8;k++){ if(k===4) continue; diamond(c, TL*k/8, -RW/2); diamond(c, TL*k/8, TW+RW/2); }
  for(let k=1;k<4;k++){ diamond(c, -RW/2, TW*k/4); diamond(c, TL+RW/2, TW*k/4); }
  // cantar tronera
  if(myTurn() && needsCallV()) POCKETS.forEach((p,i)=>{ c.save(); c.strokeStyle = AIM.call===i ? '#ffd54a' : 'rgba(255,255,255,.5)'; c.lineWidth = AIM.call===i ? 1.4 : .5; c.setLineDash(AIM.call===i?[]:[1.5,1.5]); c.beginPath(); c.arc(p.x,p.y,8.5,0,7); c.stroke(); c.restore(); });
  else if(AIM.call!=null && V.phase==='play' && needsCallV() && mine(curShooter())){}
  const balls=dispBalls();
  const cue=balls.find(b=>b.n===0);
  // guía y taco
  const showAim = V.phase==='play' && !ANIM.on && cue;
  let aim=null;
  if(showAim){
    if(mine(curShooter()) && !NET.obs) aim={ang:AIM.ang, pow:AIM.pow};
    else if(REMOTE_AIM && REMOTE_AIM.pid===curShooter()) aim={ang:REMOTE_AIM.ang, pow:REMOTE_AIM.pow};
  }
  if(aim && mine(curShooter())) drawGuide2D(c, balls, cue, aim.ang);
  for(const b of balls){ if(b.n!==0 || true) drawBall2D(c, b); }
  if(aim) drawCue2D(c, cue, aim.ang, aim.pow);
  if(showAim && V.bih && mine(curShooter())){
    const bad=placeOk(V, cue.x, cue.y);
    c.save(); c.strokeStyle = bad ? '#ff5252' : 'rgba(255,255,255,.85)'; c.lineWidth=.5; c.setLineDash([1.2,1.2]); c.beginPath(); c.arc(cue.x,cue.y,BR+2.2,0,7); c.stroke(); c.restore();
    c.save(); c.translate(cue.x, cue.y-BR-6); if(T2.rot) c.rotate(-Math.PI/2); c.font='5px system-ui'; c.textAlign='center'; c.textBaseline='middle'; c.fillText('✋',0,0); c.restore();
  }
  // números de las troneras para cantar
  if(myTurn() && needsCallV()) POCKETS.forEach((p,i)=>{ c.save(); c.translate(p.x + (p.x<TL/2?-1:p.x>TL/2?1:0)*1, p.y); if(T2.rot) c.rotate(-Math.PI/2); c.fillStyle='#fff'; c.font='bold 5px system-ui'; c.textAlign='center'; c.textBaseline='middle'; c.fillText(p.n,0,0); c.restore(); });
}
function rrect(c,x,y,w,h,r){ c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); }
function dot(c,x,y,r,col){ c.fillStyle=col; c.beginPath(); c.arc(x,y,r,0,7); c.fill(); }
function diamond(c,x,y){ c.beginPath(); c.moveTo(x,y-1.1); c.lineTo(x+.7,y); c.lineTo(x,y+1.1); c.lineTo(x-.7,y); c.closePath(); c.fill(); }
function shade(hex, k){ const n=parseInt(hex.slice(1),16); let r=n>>16, g=(n>>8)&255, b=n&255; const f=v=>Math.max(0,Math.min(255, Math.round(k<0 ? v*(1+k) : v+(255-v)*k))); return `rgb(${f(r)},${f(g)},${f(b)})`; }
// la goma de la banda: un trapecio por fuera del borde del paño
function cushionPoly(c, sg){
  const [ax,ay,bx,by]=sg, D=4.6;
  let nx=0, ny=0; if(ay===by) ny = ay<1 ? -1 : 1; else nx = ax<1 ? -1 : 1;
  const ux=Math.sign(bx-ax), uy=Math.sign(by-ay);
  c.beginPath(); c.moveTo(ax,ay); c.lineTo(bx,by); c.lineTo(bx+nx*D+ux*2.4, by+ny*D+uy*2.4); c.lineTo(ax+nx*D-ux*2.4, ay+ny*D-uy*2.4); c.closePath(); c.fill();
  c.save(); c.strokeStyle='rgba(255,255,255,.08)'; c.lineWidth=.4; c.beginPath(); c.moveTo(ax,ay); c.lineTo(bx,by); c.stroke(); c.restore();
}
function drawBall2D(c, b){
  const col=ballColor(b.n), r=BR*(1-(b.sink||0)*.4);
  c.save(); c.translate(b.x, b.y);
  c.fillStyle='rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(.7,.9,r,r*.95,0,0,7); c.fill();
  c.beginPath(); c.arc(0,0,r,0,7); c.save(); c.clip();
  c.fillStyle = isStripe(b.n) ? '#f6f3ea' : col; c.fillRect(-r,-r,2*r,2*r);
  if(isStripe(b.n)){ c.fillStyle=col; c.fillRect(-r,-r*.55,2*r,r*1.1); }
  if(b.n===0){ c.fillStyle='#d32f2f'; c.beginPath(); c.arc(r*.35,-r*.2,r*.13,0,7); c.fill(); }
  if(b.n){
    c.fillStyle='#fbfaf5'; c.beginPath(); c.arc(0,0,r*.5,0,7); c.fill();
    c.save(); if(T2.rot) c.rotate(-Math.PI/2);
    c.fillStyle='#111'; c.font=`bold ${r*(b.n>9?.62:.72)}px Arial`; c.textAlign='center'; c.textBaseline='middle'; c.fillText(b.n, 0, r*.04); c.restore();
  }
  const g=c.createRadialGradient(-r*.35,-r*.4,r*.1,0,0,r*1.05); g.addColorStop(0,'rgba(255,255,255,.55)'); g.addColorStop(.35,'rgba(255,255,255,0)'); g.addColorStop(1,'rgba(0,0,0,.38)');
  c.fillStyle=g; c.fillRect(-r,-r,2*r,2*r);
  c.restore(); c.restore();
}
function drawCue2D(c, cue, ang, pow){
  const dx=Math.cos(ang), dy=Math.sin(ang), back=BR+1.5+pow*28, L=146;
  const x1=cue.x-dx*back, y1=cue.y-dy*back, x2=x1-dx*L, y2=y1-dy*L;
  c.save(); c.lineCap='round';
  c.strokeStyle='rgba(0,0,0,.3)'; c.lineWidth=2.6; c.beginPath(); c.moveTo(x1+1.5,y1+2); c.lineTo(x2+1.5,y2+2); c.stroke();
  const g=c.createLinearGradient(x1,y1,x2,y2); g.addColorStop(0,'#e9e2d0'); g.addColorStop(.02,'#e9e2d0'); g.addColorStop(.021,'#f5deb3'); g.addColorStop(.6,'#c8925a'); g.addColorStop(.61,'#2b1408'); g.addColorStop(1,'#120804');
  c.strokeStyle=g;
  // taco más grueso atrás: se dibuja en tramos
  for(let i=0;i<10;i++){ const a=i/10, b2=(i+1)/10; c.lineWidth=1.1+a*1.6; c.beginPath(); c.moveTo(x1-dx*L*a, y1-dy*L*a); c.lineTo(x1-dx*L*b2, y1-dy*L*b2); c.stroke(); }
  c.strokeStyle='#3d6fd6'; c.lineWidth=1.1; c.beginPath(); c.moveTo(x1,y1); c.lineTo(x1-dx*.8, y1-dy*.8); c.stroke();
  c.restore();
}
// hasta dónde llega la blanca y qué toca primero
function aimGuide(balls, cue, ang){
  const dx=Math.cos(ang), dy=Math.sin(ang);
  let best=1e9, hit=null;
  for(const b of balls){ if(b.n===0) continue;
    const ox=b.x-cue.x, oy=b.y-cue.y, pr=ox*dx+oy*dy; if(pr<=0) continue;
    const pp=ox*ox+oy*oy-pr*pr, rr=4*BR*BR; if(pp>=rr) continue;
    const t=pr-Math.sqrt(rr-pp); if(t<best){ best=t; hit=b; } }
  let wall=1e9, wn=null;
  const lim=[[dx<0?(BR-cue.x)/dx:dx>0?(TL-BR-cue.x)/dx:1e9,'x'],[dy<0?(BR-cue.y)/dy:dy>0?(TW-BR-cue.y)/dy:1e9,'y']];
  for(const [t,k] of lim) if(t>0 && t<wall){ wall=t; wn=k; }
  if(hit && best<=wall){
    const gx=cue.x+dx*best, gy=cue.y+dy*best, [nx,ny]=unit(hit.x-gx, hit.y-gy), dot=dx*nx+dy*ny;
    let tx=dx-dot*nx, ty=dy-dot*ny; const tl=Math.hypot(tx,ty); if(tl>1e-6){ tx/=tl; ty/=tl; }
    return {t:best, gx, gy, hit, obj:[nx,ny], cueOut:tl>1e-3?[tx,ty]:null, cut:dot};
  }
  const gx=cue.x+dx*wall, gy=cue.y+dy*wall;
  return {t:wall, gx, gy, hit:null, refl: wn==='x' ? [-dx,dy] : [dx,-dy]};
}
function drawGuide2D(c, balls, cue, ang){
  const help=V.opts.aim;
  if(help==='nada') return; // experto: sin ninguna ayuda
  const g=aimGuide(balls, cue, ang), reach = help==='larga' || g.t<=AIM_MEDIO;
  c.save(); c.strokeStyle='rgba(255,255,255,.75)'; c.lineWidth=.35;
  const maxL = help==='larga' ? g.t : Math.min(AIM_MEDIO, g.t);
  c.beginPath(); c.moveTo(cue.x, cue.y); c.lineTo(cue.x+Math.cos(ang)*maxL, cue.y+Math.sin(ang)*maxL); c.stroke();
  if(reach){
    c.strokeStyle='rgba(255,255,255,.8)'; c.beginPath(); c.arc(g.gx, g.gy, BR, 0, 7); c.stroke();
    if(g.hit){
      const ok=legalFirstV().includes(g.hit.n) || V.opts.mode==='libre';
      if(!ok){ c.strokeStyle='#ff5252'; c.lineWidth=.6; c.beginPath(); c.moveTo(g.gx-2,g.gy-2); c.lineTo(g.gx+2,g.gy+2); c.moveTo(g.gx+2,g.gy-2); c.lineTo(g.gx-2,g.gy+2); c.stroke(); }
      c.strokeStyle = ok ? 'rgba(255,240,150,.9)' : 'rgba(255,90,90,.8)'; c.lineWidth=.45;
      if(help==='larga'){ c.beginPath(); c.moveTo(g.hit.x, g.hit.y); c.lineTo(g.hit.x+g.obj[0]*70*Math.max(.25,g.cut), g.hit.y+g.obj[1]*70*Math.max(.25,g.cut)); c.stroke(); }
      if(help==='larga' && g.cueOut){ c.strokeStyle='rgba(255,255,255,.45)'; c.setLineDash([1.2,1.2]); c.beginPath(); c.moveTo(g.gx,g.gy); c.lineTo(g.gx+g.cueOut[0]*30*(1-Math.abs(g.cut)), g.gy+g.cueOut[1]*30*(1-Math.abs(g.cut))); c.stroke(); }
    } else if(help==='larga' && g.refl){ c.setLineDash([1.2,1.2]); c.strokeStyle='rgba(255,255,255,.45)'; c.beginPath(); c.moveTo(g.gx,g.gy); c.lineTo(g.gx+g.refl[0]*30, g.gy+g.refl[1]*30); c.stroke(); }
  }
  c.restore();
}
// tocar / arrastrar en la mesa 2D
(function(){
  let mode=null;
  cv.addEventListener('pointerdown', e=>{
    if(VIEW.mode!=='2d' || !V || V.phase!=='play') return;
    const r=cv.getBoundingClientRect(), t=toTable(e.clientX-r.left, e.clientY-r.top);
    if(!myTurn()) return;
    cv.setPointerCapture(e.pointerId);
    if(needsCallV()){ const i=nearestPocket(t.x,t.y), p=POCKETS[i]; if(Math.hypot(p.x-t.x,p.y-t.y)<14){ setCall(i); mode=null; return; } }
    if(V.bih && Math.hypot(t.x-AIM.cx, t.y-AIM.cy) < BR+5){ mode='place'; return; }
    mode='aim'; aimAt(t);
  });
  cv.addEventListener('pointermove', e=>{
    if(!mode) return;
    const r=cv.getBoundingClientRect(), t=toTable(e.clientX-r.left, e.clientY-r.top);
    if(mode==='place') placeAt(t); else aimAt(t);
  });
  const end=()=>{ if(mode==='place') sendAim(); mode=null; };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  cv.addEventListener('wheel', e=>{ if(!myTurn()) return; e.preventDefault(); turnAim(e.deltaY>0?.002:-.002); }, {passive:false});
})();
function aimAt(t){ const c=cuePos(); if(Math.hypot(t.x-c.x, t.y-c.y)<1) return; AIM.ang=Math.atan2(t.y-c.y, t.x-c.x); sendAim(); }
function placeAt(t){
  const maxX = V.bih && V.bih.zone==='head' ? HEAD_X : TL-BR;
  AIM.cx=Math.max(BR, Math.min(maxX, t.x)); AIM.cy=Math.max(BR, Math.min(TW-BR, t.y)); sendAim();
}

/* ====================== MESA 3D (de costado) ====================== */
const R3={renderer:null};
const CAM3=Object.assign({mode:'tiro', yaw:0, pitch:16, dist:95, follow:true, shotStart:0}, load('billar_cam3')||{});
function saveCam3(){ store('billar_cam3', {mode:CAM3.mode, pitch:CAM3.pitch, dist:CAM3.dist}); }
function init3D(){
  if(R3.renderer || !window.THREE) return !!R3.renderer;
  const T=THREE, canvas=$('#c3d');
  let renderer;
  try{ renderer=new T.WebGLRenderer({canvas, antialias:true}); }catch(e){ toast('Este aparato no puede mostrar 3D. Seguimos en 2D.'); return false; }
  const mobile=/Android|iPhone|iPad/i.test(navigator.userAgent);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, mobile?1.5:2));
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=T.PCFSoftShadowMap;
  const scene=new T.Scene(); scene.background=new T.Color(0x140d08); scene.fog=new T.Fog(0x140d08, 500, 1100);
  const cam=new T.PerspectiveCamera(50, 1, 1, 3000);
  R3.renderer=renderer; R3.scene=scene; R3.cam=cam; R3.T=T;
  // luces: lámpara arriba de la mesa
  scene.add(new T.HemisphereLight(0xfff3dd, 0x2a1a10, .5));
  const spot=new T.SpotLight(0xfff1d6, 1.15, 0, Math.PI/3.1, .55, 1); spot.position.set(0,210,0); spot.target.position.set(0,0,0);
  spot.castShadow=true; spot.shadow.mapSize.set(mobile?1024:2048, mobile?1024:2048); spot.shadow.camera.near=80; spot.shadow.camera.far=320; spot.shadow.bias=-.0004;
  scene.add(spot, spot.target);
  const fill=new T.DirectionalLight(0xffffff, .25); fill.position.set(-150,200,120); scene.add(fill);
  // paño con textura
  const fc=document.createElement('canvas'); fc.width=1024; fc.height=512; R3.feltCanvas=fc;
  R3.feltTex=new T.CanvasTexture(fc); paintFelt3D();
  const felt=new T.Mesh(new T.BoxGeometry(TL+9.2, 4, TW+9.2), [0,1,2,3,4,5].map(i=>new T.MeshStandardMaterial(i===2?{map:R3.feltTex, roughness:.95}:{color:0x0c4a2b, roughness:1})));
  felt.position.y=-2; felt.receiveShadow=true; scene.add(felt); R3.felt=felt;
  // troneras: agujero negro en el paño y en la madera
  const holeMat=new T.MeshBasicMaterial({color:0x050505}), tubeMat=new T.MeshBasicMaterial({color:0x080808, side:T.DoubleSide});
  POCKETS.forEach((p,i)=>{
    const r = i===1||i===4 ? 6.2 : 6.6;
    const h=new T.Mesh(new T.CircleGeometry(r, 32), holeMat); h.rotation.x=-Math.PI/2; h.position.set(p.x-TL/2, .06, p.y-TW/2); scene.add(h);
    const h2=new T.Mesh(new T.CylinderGeometry(r, r*.85, 14, 32, 1, true), tubeMat); h2.position.set(p.x-TL/2, 4.6-7, p.y-TW/2); scene.add(h2);
    const rim=new T.Mesh(new T.TorusGeometry(r+.2, .5, 8, 32), new T.MeshStandardMaterial({color:0x2a2a2a, metalness:.6, roughness:.4})); rim.rotation.x=Math.PI/2; rim.position.set(p.x-TL/2, 4.6, p.y-TW/2); scene.add(rim);
  });
  // bandas (goma)
  R3.cushMat=new T.MeshStandardMaterial({color:0x0e5c36, roughness:.9});
  for(const sg of SEGS){
    const L=Math.hypot(sg[2]-sg[0], sg[3]-sg[1]); if(L<10) continue;
    const horiz = sg[1]===sg[3];
    const geo=new T.BoxGeometry(horiz?L+2:4.6, 3.9, horiz?4.6:L+2);
    const m=new T.Mesh(geo, R3.cushMat); m.castShadow=true; m.receiveShadow=true;
    const mx=(sg[0]+sg[2])/2-TL/2, mz=(sg[1]+sg[3])/2-TW/2;
    const ox = horiz ? 0 : (sg[0]<1 ? -2.3 : 2.3), oz = horiz ? (sg[1]<1 ? -2.3 : 2.3) : 0;
    m.position.set(mx+ox, 1.95, mz+oz); scene.add(m);
  }
  // baranda de madera
  const wood=new T.MeshStandardMaterial({color:0x6b3519, roughness:.45, metalness:.05});
  const wW=RW-4.6, H=17, top=4.6;
  const rails=[[TL+2*RW, wW, 0, -(TW/2+4.6+wW/2)], [TL+2*RW, wW, 0, TW/2+4.6+wW/2], [wW, TW+9.2, -(TL/2+4.6+wW/2), 0], [wW, TW+9.2, TL/2+4.6+wW/2, 0]];
  for(const [w,d,x,z] of rails){ const m=new T.Mesh(new T.BoxGeometry(w, H, d), wood); m.position.set(x, top-H/2, z); m.castShadow=true; m.receiveShadow=true; scene.add(m); }
  // diamantes
  const dMat=new T.MeshStandardMaterial({color:0xf3e6c4, roughness:.3});
  const dGeo=new T.CircleGeometry(.75, 4);
  const addD=(x,z)=>{ const m=new T.Mesh(dGeo, dMat); m.rotation.x=-Math.PI/2; m.position.set(x-TL/2, top+.02, z-TW/2); scene.add(m); };
  for(let k=1;k<8;k++){ if(k===4) continue; addD(TL*k/8, -(4.6+wW/2)); addD(TL*k/8, TW+4.6+wW/2); }
  for(let k=1;k<4;k++){ addD(-4.6-wW/2, TW*k/4); addD(TL+4.6+wW/2, TW*k/4); }
  // cuerpo de la mesa y patas
  const body=new T.Mesh(new T.BoxGeometry(TL+2*RW-6, 34, TW+2*RW-6), new T.MeshStandardMaterial({color:0x3e1c0b, roughness:.6}));
  body.position.y=top-H-17; scene.add(body);
  for(const sx of [-1,1]) for(const sz of [-1,1]){ const l=new T.Mesh(new T.BoxGeometry(14,40,14), body.material); l.position.set(sx*(TL/2-10), top-H-34-20, sz*(TW/2-6)); scene.add(l); }
  const floor=new T.Mesh(new T.PlaneGeometry(2400,2400), new T.MeshStandardMaterial({color:0x2a1d14, roughness:1})); floor.rotation.x=-Math.PI/2; floor.position.y=top-H-34-40; floor.receiveShadow=true; scene.add(floor);
  // lámpara
  const shadeM=new T.MeshStandardMaterial({color:0x1d5b33, roughness:.5, emissive:0x081a10});
  for(const x of [-70,0,70]){ const lamp=new T.Mesh(new T.CylinderGeometry(9, 22, 14, 24, 1, true), shadeM); lamp.position.set(x,150,0); scene.add(lamp);
    const bulb=new T.Mesh(new T.SphereGeometry(5,16,8), new T.MeshBasicMaterial({color:0xfff6dd})); bulb.position.set(x,145,0); scene.add(bulb); }
  // bolas
  R3.balls={}; R3.sphere=new T.SphereGeometry(BR, 36, 24);
  for(let n=0;n<=15;n++){
    const m=new T.Mesh(R3.sphere, new T.MeshPhongMaterial({map:ballTexture(n), shininess:110, specular:0x777777}));
    m.castShadow=true; m.visible=false; scene.add(m);
    m.quaternion.setFromEuler(new T.Euler(Math.random()*6, Math.random()*6, Math.random()*6));
    R3.balls[n]={mesh:m, last:null};
  }
  // taco
  const cueG=new T.Group();
  const shaft=new T.Mesh(new T.CylinderGeometry(.62, 1.05, 90, 16), new T.MeshStandardMaterial({color:0xe9c99a, roughness:.5})); shaft.position.y=-45.8;
  const butt=new T.Mesh(new T.CylinderGeometry(1.05, 1.55, 56, 16), new T.MeshStandardMaterial({color:0x2b1408, roughness:.35})); butt.position.y=-90.8-28;
  const fer=new T.Mesh(new T.CylinderGeometry(.62, .62, 1.6, 16), new T.MeshStandardMaterial({color:0xf5f5ef})); fer.position.y=-.8;
  const tip=new T.Mesh(new T.CylinderGeometry(.6, .62, .5, 16), new T.MeshStandardMaterial({color:0x3d6fd6})); tip.position.y=.2;
  [shaft,butt,fer,tip].forEach(m=>{ m.castShadow=true; cueG.add(m); });
  scene.add(cueG); R3.cue=cueG;
  // guía
  const lm=new T.LineBasicMaterial({color:0xffffff, transparent:true, opacity:.75});
  R3.lines=[0,1,2].map(i=>{ const g=new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute([0,0,0,0,0,0],3)); const l=new T.Line(g, i===1?new T.LineBasicMaterial({color:0xfff096, transparent:true, opacity:.9}):lm); scene.add(l); return l; });
  R3.ghost=new T.Mesh(new T.SphereGeometry(BR, 20, 12), new T.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:.22, depthWrite:false})); scene.add(R3.ghost);
  R3.calls=POCKETS.map(p=>{ const m=new T.Mesh(new T.TorusGeometry(8.5,.45,8,40), new T.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:.6})); m.rotation.x=Math.PI/2; m.position.set(p.x-TL/2, .4, p.y-TW/2); m.visible=false; scene.add(m); return m; });
  R3.ray=new T.Raycaster(); R3.plane=new T.Plane(new T.Vector3(0,1,0), -BR);
  wire3DInput(canvas);
  resizeStage();
  return true;
}
function paintFelt3D(){
  const c=R3.feltCanvas.getContext('2d'), W=c.canvas.width, H=c.canvas.height, sx=W/(TL+9.2), sy=H/(TW+9.2);
  const [f1,f2]=FELTS[VIEW.felt]||FELTS.verde;
  const g=c.createRadialGradient(W/2,H/2,20,W/2,H/2,W*.6); g.addColorStop(0,f1); g.addColorStop(1,f2); c.fillStyle=g; c.fillRect(0,0,W,H);
  const img=c.getImageData(0,0,W,H), d=img.data; for(let i=0;i<d.length;i+=4){ const k=(Math.random()-.5)*10; d[i]+=k; d[i+1]+=k; d[i+2]+=k; } c.putImageData(img,0,0);
  const X=x=>(x+4.6)*sx, Y=y=>(y+4.6)*sy;
  c.strokeStyle='rgba(255,255,255,.14)'; c.lineWidth=1.5; c.setLineDash([6,6]); c.beginPath(); c.moveTo(X(HEAD_X),Y(0)); c.lineTo(X(HEAD_X),Y(TW)); c.stroke(); c.setLineDash([]);
  c.fillStyle='rgba(255,255,255,.35)'; for(const x of [HEAD_X, FOOT_X]){ c.beginPath(); c.arc(X(x),Y(MID_Y),2.5,0,7); c.fill(); }
  c.globalAlpha=.07; c.strokeStyle='#fff'; c.lineWidth=1.4;
  for(const r of [6,12,18]){ c.beginPath(); c.ellipse(X(TL/2),Y(TW/2),r*sx,r*sy,0,0,7); c.stroke(); }
  for(let a=0;a<36;a++){ const t=a/36*Math.PI*2; c.beginPath(); c.moveTo(X(TL/2+Math.cos(t)*3),Y(TW/2+Math.sin(t)*3)); c.lineTo(X(TL/2+Math.cos(t)*18),Y(TW/2+Math.sin(t)*18)); c.stroke(); }
  c.globalAlpha=.1; c.fillStyle='#fff'; c.font=`bold ${7*sx}px system-ui`; c.textAlign='center'; c.fillText('BILLAR · PARAGUAY', X(TL/2), Y(TW/2+28)); c.globalAlpha=1;
  R3.feltTex.needsUpdate=true;
  if(R3.cushMat) R3.cushMat.color.set(shade(f2,-.12));
}
function ballTexture(n){
  const c=document.createElement('canvas'); c.width=512; c.height=256; const g=c.getContext('2d'), col=ballColor(n);
  g.fillStyle = n===0 || isStripe(n) ? '#f7f4ea' : col; g.fillRect(0,0,512,256);
  if(isStripe(n)){ g.fillStyle=col; g.fillRect(0,70,512,116); }
  if(n===0){ g.fillStyle='#d32f2f'; for(const [x,y] of [[128,128],[384,128],[0,40],[256,40],[0,216],[256,216]]){ g.beginPath(); g.arc(x,y,9,0,7); g.fill(); } }
  else for(const x of [128,384]){
    g.fillStyle='#fbfaf5'; g.beginPath(); g.ellipse(x,128,34,34,0,0,7); g.fill();
    g.fillStyle='#111'; g.font=`bold ${n>9?38:44}px Arial`; g.textAlign='center'; g.textBaseline='middle'; g.fillText(n, x, 131);
    if(n===6||n===9){ g.fillRect(x-10,150,20,3); }
  }
  const t=new THREE.CanvasTexture(c); t.anisotropy=4; return t;
}
function wire3DInput(canvas){
  let drag=null;
  const hitTable=e=>{ const r=canvas.getBoundingClientRect(), v=new R3.T.Vector2((e.clientX-r.left)/r.width*2-1, -((e.clientY-r.top)/r.height*2-1)); R3.ray.setFromCamera(v, R3.cam); const p=new R3.T.Vector3(); return R3.ray.ray.intersectPlane(R3.plane, p) ? {x:p.x+TL/2, y:p.z+TW/2} : null; };
  canvas.addEventListener('pointerdown', e=>{
    if(VIEW.mode!=='3d') return;
    canvas.setPointerCapture(e.pointerId);
    const t=hitTable(e);
    drag={x:e.clientX, y:e.clientY, sx:e.clientX, sy:e.clientY, mode:'look'};
    if(myTurn() && t){
      if(V.bih && Math.hypot(t.x-AIM.cx, t.y-AIM.cy)<BR+6){ drag.mode='place'; return; }
    }
  });
  canvas.addEventListener('pointermove', e=>{
    if(!drag) return;
    const dx=e.clientX-drag.x, dy=e.clientY-drag.y; drag.x=e.clientX; drag.y=e.clientY;
    if(drag.mode==='place'){ const t=hitTable(e); if(t) placeAt(t); return; }
    if(CAM3.mode==='tiro' && myTurn()){ AIM.ang += dx*.0028; sendAim(); }
    else { CAM3.yaw += dx*.006; CAM3.follow=false; }
    CAM3.pitch=Math.max(4, Math.min(85, CAM3.pitch + dy*.15));
  });
  const end=e=>{
    if(!drag) return;
    const tap = Math.hypot(e.clientX-drag.sx, e.clientY-drag.sy)<6;
    if(tap && myTurn()){ const t=hitTable(e); if(t){
      if(needsCallV()){ const i=nearestPocket(t.x,t.y), p=POCKETS[i]; if(Math.hypot(p.x-t.x,p.y-t.y)<16){ setCall(i); drag=null; return; } }
      if(CAM3.mode==='arriba' || CAM3.pitch>50) aimAt(t);
    } }
    if(drag.mode==='place') sendAim();
    drag=null; saveCam3();
  };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', ()=>{ drag=null; });
  canvas.addEventListener('wheel', e=>{ e.preventDefault(); CAM3.dist=Math.max(35, Math.min(380, CAM3.dist*(e.deltaY>0?1.08:.93))); saveCam3(); }, {passive:false});
}
function cam3(k, d){
  if(k==='pitch') CAM3.pitch=Math.max(4, Math.min(85, CAM3.pitch+d));
  else if(k==='zoom') CAM3.dist=Math.max(35, Math.min(380, CAM3.dist*(d>0?.85:1.18)));
  else if(k==='tiro'){ CAM3.mode='tiro'; CAM3.follow=true; CAM3.pitch=16; CAM3.dist=95; }
  else if(k==='arriba'){ CAM3.mode='arriba'; CAM3.follow=false; CAM3.pitch=62; CAM3.dist=290; CAM3.yaw=-Math.PI/2; }
  else if(k==='spin'){ CAM3.yaw+=d; CAM3.follow=false; }
  saveCam3();
}
const lerpA=(a,b,t)=>{ let d=b-a; while(d>Math.PI) d-=2*Math.PI; while(d<-Math.PI) d+=2*Math.PI; return a+d*t; };
function draw3D(){
  const T=R3.T, balls=dispBalls(), shown=new Set();
  // bolas y su giro según lo que ruedan
  for(const b of balls){
    const o=R3.balls[b.n]; if(!o) continue; shown.add(b.n);
    const m=o.mesh, x=b.x-TL/2, z=b.y-TW/2, y=BR - (b.sink||0)*BR*2.4;
    if(o.last){ const dx=x-o.last.x, dz=z-o.last.z, dist=Math.hypot(dx,dz);
      if(dist>1e-4 && dist<15){ const ax=new T.Vector3(dz,0,-dx).normalize(); const q=new T.Quaternion().setFromAxisAngle(ax, dist/BR); m.quaternion.premultiply(q); } }
    o.last={x,z}; m.position.set(x,y,z); m.visible=true;
  }
  for(const n in R3.balls) if(!shown.has(+n)){ R3.balls[n].mesh.visible=false; R3.balls[n].last=null; }
  // mira
  const cue=balls.find(b=>b.n===0);
  let aim=null;
  if(V.phase==='play' && !ANIM.on && cue){
    if(mine(curShooter()) && !NET.obs) aim={ang:AIM.ang, pow:AIM.pow};
    else if(REMOTE_AIM && REMOTE_AIM.pid===curShooter()) aim={ang:REMOTE_AIM.ang, pow:REMOTE_AIM.pow};
  }
  R3.cue.visible=!!aim;
  R3.lines.forEach(l=>l.visible=false); R3.ghost.visible=false;
  if(aim){
    const dx=Math.cos(aim.ang), dz=Math.sin(aim.ang), el=.09, back=BR+1+aim.pow*28;
    R3.cue.position.set(cue.x-TL/2-dx*back*Math.cos(el), BR+back*Math.sin(el), cue.y-TW/2-dz*back*Math.cos(el));
    R3.cue.quaternion.setFromUnitVectors(new T.Vector3(0,1,0), new T.Vector3(dx*Math.cos(el), -Math.sin(el), dz*Math.cos(el)).normalize());
    if(mine(curShooter()) && V.opts.aim!=='nada'){ // experto: sin ninguna ayuda
      const g=aimGuide(balls, cue, aim.ang), help=V.opts.aim, yL=.25;
      const setL=(l,pts)=>{ const a=l.geometry.attributes.position; a.setXYZ(0,pts[0]-TL/2,yL,pts[1]-TW/2); a.setXYZ(1,pts[2]-TL/2,yL,pts[3]-TW/2); a.needsUpdate=true; l.geometry.computeBoundingSphere(); l.visible=true; };
      const L0 = help==='larga' ? g.t : Math.min(AIM_MEDIO, g.t);
      setL(R3.lines[0], [cue.x, cue.y, cue.x+dx*L0, cue.y+dz*L0]);
      if(help==='larga' || g.t<=AIM_MEDIO){
        R3.ghost.position.set(g.gx-TL/2, BR, g.gy-TW/2); R3.ghost.visible=true;
        if(g.hit && help==='larga'){ const L1=70*Math.max(.25,g.cut); setL(R3.lines[1], [g.hit.x, g.hit.y, g.hit.x+g.obj[0]*L1, g.hit.y+g.obj[1]*L1]);
          R3.lines[1].material.color.set(legalFirstV().includes(g.hit.n)||V.opts.mode==='libre' ? 0xfff096 : 0xff5a5a);
          if(g.cueOut){ const L2=30*(1-Math.abs(g.cut)); setL(R3.lines[2], [g.gx, g.gy, g.gx+g.cueOut[0]*L2, g.gy+g.cueOut[1]*L2]); } }
        else if(help==='larga' && g.refl) setL(R3.lines[2], [g.gx, g.gy, g.gx+g.refl[0]*30, g.gy+g.refl[1]*30]);
      }
    }
  }
  R3.calls.forEach((m,i)=>{ m.visible = myTurn() && needsCallV(); m.material.color.set(AIM.call===i?0xffd54a:0xffffff); });
  // cámara
  const target = cue ? new T.Vector3(cue.x-TL/2, BR, cue.y-TW/2) : new T.Vector3(0,0,0);
  if(CAM3.mode==='tiro'){
    if(aim && CAM3.follow) CAM3.yaw = lerpA(CAM3.yaw, aim.ang, mine(curShooter()) ? 1 : .15);
    let look=target, dist=CAM3.dist, pitch=CAM3.pitch;
    if(ANIM.on){ // durante el tiro la cámara se levanta un poco para ver hacia dónde van
      const k=Math.min(1,(performance.now()-CAM3.shotStart)/900);
      R3.anTarget = R3.anTarget || target.clone(); look=R3.anTarget.clone().lerp(new T.Vector3(0,0,0), k*.55);
      dist=CAM3.dist + k*110; pitch=CAM3.pitch + k*24;
    } else R3.anTarget=null;
    const p=pitch*Math.PI/180;
    const want=new T.Vector3(look.x-Math.cos(CAM3.yaw)*Math.cos(p)*dist, look.y+Math.sin(p)*dist+4, look.z-Math.sin(CAM3.yaw)*Math.cos(p)*dist);
    R3.cam.position.lerp(want, ANIM.on ? .06 : .35);
    R3.camLook = (R3.camLook||look.clone()).lerp(look.clone().add(new T.Vector3(Math.cos(CAM3.yaw)*25,0,Math.sin(CAM3.yaw)*25)), ANIM.on ? .06 : .35);
    R3.cam.lookAt(R3.camLook);
  } else {
    const p=CAM3.pitch*Math.PI/180, dist=CAM3.dist;
    const want=new T.Vector3(-Math.cos(CAM3.yaw)*Math.cos(p)*dist, Math.sin(p)*dist, -Math.sin(CAM3.yaw)*Math.cos(p)*dist);
    R3.cam.position.lerp(want, .2); R3.camLook=(R3.camLook||new T.Vector3()).lerp(new T.Vector3(0,0,0), .2); R3.cam.lookAt(R3.camLook);
  }
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
  if(VIEW.mode==='2d'){ if(!init3D()) return; VIEW.mode='3d'; toast('🧊 Vista 3D: arrastrá para girar el taco y subir o bajar la cámara. 🔭 para ver desde arriba.'); }
  else { VIEW.mode='2d'; toast('🗺️ Vista desde arriba: tocá o arrastrá en la mesa para apuntar.'); }
  saveView(); applyView(); resizeStage();
}
function feltModal(){
  modal(`<h2>🎨 Color del paño</h2><div class="felts">${Object.keys(FELTS).map(k=>`<button style="background:${FELTS[k][0]}" onclick="setFelt('${k}')">${k}</button>`).join('')}</div><button class="btn gray wide" onclick="closeModal()">Cerrar</button>`);
}
function setFelt(k){ VIEW.felt=k; saveView(); if(R3.renderer) paintFelt3D(); closeModal(); }
// la barra espaciadora hace subir y bajar la fuerza
function keyPowTick(){ if(KEYPOW.t0 && myTurn()){ const t=(performance.now()-KEYPOW.t0)/1100; AIM.pow=Math.abs(((t+1)%2)-1); paintPower(); } }
function loop(){
  requestAnimationFrame(loop);
  if(!V || V.phase==='lobby' || !$('#game').classList.contains('on')) return;
  keyPowTick();
  if(VIEW.mode==='3d' && R3.renderer) draw3D(); else draw2D();
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
  const gone = V.balls ? V.balls.filter(b=>b.n && b.in).map(b=>b.n).sort((a,b)=>a-b) : [];
  $('#histList').innerHTML = (V.phase!=='lobby' ? `<div class="muted" style="font-weight:800">Bolas ya metidas:</div><div class="strip">${gone.map(n=>ballHTML(n,20)).join('')||'<span class="muted">ninguna todavía</span>'}</div>` : '')
    + L.map((l,i)=>`<div class="hline ${i<fresh&&fresh<5?'new':''}">${esc(l.x)}</div>`).join('');
}
function renderMesaTab(){
  const host=amHost(), inPlay=V.phase!=='lobby';
  const ps=V.players.map(p=>{
    const offline=!p.bot&&!p.conn;
    return `<div class="prow" style="border-left:5px solid ${p.color}"><span style="font-size:22px">${esc(p.emoji)}</span><span class="nm"><b>${esc(p.name)}${p.id===me()?' (vos)':''}${p.id===V.hostPid&&NET.mode!=='local'?' 👑':''}</b>
      <small>${V.opts.fmt==='eq'?TEAMS[p.team].e+' '+TEAMS[p.team].n:''}${p.bot?' · 🤖 bot':''}${p.mic?' · 🎙️':''}${offline?' · ⚠️ sin conexión':''}${inPlay&&curShooter()===p.id?' · 🎱 tirando':''}</small></span>
      ${host&&p.id!==V.hostPid&&NET.mode!=='local'?`${offline&&inPlay?`<button class="btn sm gray" onclick="doAct({type:'botify',pid:'${p.id}'})" title="Que tire un bot">🤖</button>`:''}<button class="btn sm gray" onclick="if(confirm('¿Sacar a ${esc(p.name)} de la mesa?'))doAct({type:'kick',pid:'${p.id}'})" title="Sacar">✕</button>`:''}</div>`;
  }).join('');
  const obs=(V.observers||[]).map(o=>`<div class="prow"><span style="font-size:20px">👀</span><span class="nm"><b>${esc(o.name)}${o.id===me()?' (vos)':''}</b><small>mirando${o.mic?' · 🎙️':''}</small></span></div>`).join('');
  const sit = NET.obs && V.phase!=='play' && V.phase!=='rackEnd' && V.players.length<MAXP ? `<button class="btn gold wide" onclick="doAct({type:'joinNext'})">🪑 Sentarme a jugar</button>` : NET.obs ? `<p class="muted">Te podés sentar cuando termine la serie (si hay lugar).</p>` : '';
  const info = inPlay ? `<p class="muted">${esc(MODES[V.opts.mode].t)} · partida ${V.rack}${V.opts.race>1?` · gana el primero a ${V.opts.race}`:''}</p>` : '';
  $('#mesaList').innerHTML = info + `<b>Jugadores (${V.players.length}/${MAXP})</b>` + ps + (obs?`<b>Mirando</b>${obs}`:'') + sit
    + (host && inPlay ? `<button class="btn dark wide" style="margin-top:8px" onclick="if(confirm('¿Terminar la partida y volver a la sala?'))doAct({type:'newGame',force:true})">⚙️ Terminar y volver a la sala</button>` : '')
    + (NET.mode!=='local'&&NET.code?`<p class="muted" style="margin-top:12px">Invitá con el código <b>${NET.code}</b> <button class="btn sm" onclick="shareRoom()">📤 Compartir</button></p>`:'');
}
function renderReglasTab(){
  const o=V.opts, on=HOUSE.filter(h=>h.modes.includes(o.mode) && o[h.k]), host=amHost();
  $('#reglasList').innerHTML = `<p style="margin-top:0"><b>${esc(MODES[o.mode].t)}</b> · ${esc(FORMATS[o.fmt])}</p><p class="muted">${esc(MODES[o.mode].d)}</p>`
    + `<b>Reglas de la casa activas</b>` + (on.length ? on.map(h=>`<div class="opt"><span><b>${h.t}</b><small>${h.d}</small></span></div>`).join('') : '<p class="muted">Ninguna.</p>')
    + `<b>📝 Reglas propias del grupo</b>` + (V.grules?`<div class="grules" style="margin:6px 0 10px">${esc(V.grules)}</div>`:`<p class="muted">${host?'Las podés escribir en la sala de espera.':'No hay.'}</p>`)
    + `<b>💡 Sugerencias</b><div style="margin-top:6px">${sugsHTML(host)}</div>
       <div class="row"><input type="text" id="sugIn2" maxlength="240" placeholder="Proponé una regla…" onkeydown="if(event.key==='Enter')sendSug('sugIn2')"><button class="btn sm" style="flex:0 0 auto" onclick="sendSug('sugIn2')">Sugerir</button></div>
       <button class="btn dark wide" style="margin-top:12px" onclick="showRules()">📜 Cómo se juega cada modo</button>`;
}

/* ====================== VARIOS ====================== */
function modal(h){ $('#mbox').innerHTML=h; $('#modal').classList.add('on'); }
function closeModal(){ $('#modal').classList.remove('on'); }
function roomLink(){ return location.origin+location.pathname+'#'+NET.code; }
function copyCode(){ navigator.clipboard && navigator.clipboard.writeText(NET.code).then(()=>toast('Código copiado: '+NET.code)); }
function shareRoom(){
  const url=roomLink(), text=`¡Vení a jugar al Billar conmigo! 🎱🇵🇾 Sala ${NET.code}`;
  if(navigator.share) return navigator.share({title:'Billar PY', text, url}).catch(()=>{});
  modal(`<h2>📤 Invitar a la sala ${NET.code}</h2><p style="word-break:break-all;user-select:all;background:#fff;padding:8px;border-radius:8px">${esc(url)}</p>
    <a class="btn green wide" style="display:block;text-align:center;text-decoration:none" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text+' '+url)}">💬 Mandar por WhatsApp</a>
    <button class="btn wide" style="margin-top:6px" onclick="navigator.clipboard.writeText('${url}').then(()=>toast('Enlace copiado'))">📋 Copiar enlace</button>
    <button class="btn gray wide" style="margin-top:6px" onclick="closeModal()">Cerrar</button>`);
}
function showRules(){
  modal(`<div class="rules"><h2>📜 Cómo se juega</h2>
  <h3>🕹️ Controles</h3>
  <ul><li><b>Apuntar:</b> en la vista de arriba tocá o arrastrá en la mesa hacia donde querés tirar. En 3D arrastrá para los costados (y para arriba o abajo para mover la cámara).</li>
  <li><b>Afinar:</b> los botones ◀ ▶ o deslizá la tira rayada (en PC también las flechas del teclado y la rueda del mouse).</li>
  <li><b>Fuerza:</b> en la barra de la derecha tirá con el dedo hacia abajo y soltá para tirar (en PC también mantené la barra espaciadora y soltala).</li>
  <li><b>Efecto:</b> el botón de la bola blanca: abajo = retroceso, arriba = sigue de largo, costados = efecto en las bandas.</li>
  <li><b>Bola en mano:</b> arrastrá la blanca (aparece la ✋) antes de tirar.</li></ul>
  <h3>${MODES['8'].t}</h3><p>Se rompe desde detrás de la línea. La mesa está abierta hasta que alguien mete una bola después de la salida: esa es su grupo (lisas 1–7 o rayadas 9–15). Hay que tocar primero una bola propia. Cuando metiste todas, vas por la 8. Si metés la 8 antes de tiempo, con falta o en otra tronera, perdés.</p>
  <h3>${MODES['9'].t}</h3><p>Nueve bolas en rombo. Siempre hay que tocar primero la más baja que haya en la mesa, pero vale meter cualquiera (también de combinación). El que mete la 9 sin falta gana.</p>
  <h3>${MODES['10'].t}</h3><p>Igual que la 9 pero con 10 bolas en triángulo. Si la 10 entra en la salida, vuelve al punto.</p>
  <h3>${MODES.rot.t}</h3><p>Las 15 bolas. Tocás primero la más baja; cada bola que metés suma su número. Gana el que llega primero a los puntos elegidos (61 normalmente). Con falta, las bolas metidas vuelven a la mesa.</p>
  <h3>${MODES.kelly.t}</h3><p>Para 3 a 8 jugadores. A cada uno le toca una bola secreta (solo la ve él). Se juega como la rotación. Si metés tu bola secreta, ganás. Si metés la de otro, ese queda afuera. El último que queda también gana.</p>
  <h3>${MODES.libre.t}</h3><p>Sin faltas: para practicar o jugar con reglas propias.</p>
  <h3>🚫 Faltas</h3><ul><li>Que caiga la blanca.</li><li>No tocar ninguna bola, o tocar primero una que no se puede.</li><li>Si no metés nada, alguna bola tiene que tocar una banda después del choque (regla que se puede apagar).</li></ul>
  <p>Después de una falta el otro tiene <b>bola en mano</b>: pone la blanca donde quiere (o detrás de la línea, si así se eligió).</p>
  <h3>👥 Equipos</h3><p>En “por equipos”, los jugadores de cada equipo se turnan: cada vez que le toca al equipo, tira el siguiente de ese equipo.</p>
  </div><button class="btn wide" onclick="closeModal()">Entendido</button>`);
}
