'use strict';
/* =====================================================================
   Botones PY — red (PeerJS), chat con privados, voz, sala de
   espera, cancha en 3D, tiros con el dedo y sonidos.
   ===================================================================== */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function store(k,v){ try{ if(v===undefined) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
function load(k){ try{ const v=localStorage.getItem(k); return v==null?null:JSON.parse(v); }catch(e){ return null; } }
function toast(x){ const t=$('#toast'); t.textContent=x; t.style.display='block'; clearTimeout(toast.t); toast.t=setTimeout(()=>t.style.display='none', 3800); }
const PREFIX='botonespy26-';
const genCode = () => { const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s=''; for(let i=0;i<5;i++) s+=A[rnd(A.length)]; return s; };
let myToken=load('boton_token'); if(!myToken){ myToken=Math.random().toString(36).slice(2)+Date.now().toString(36); store('boton_token', myToken); }
const NET={mode:null, peer:null, code:null, conns:{}, hostConn:null, myPid:null, obs:null, welcomed:false};
let CHAT=[], V=null;
const me = () => NET.myPid || NET.obs;
const amHost = () => NET.mode==='local' || (V && V.hostPid===NET.myPid && NET.mode==='host');
const VP = id => V && (V.players.find(p=>p.id===id) || (V.observers||[]).find(o=>o.id===id));
// ¿este aparato maneja a ese jugador? (en la partida local, todos los que no son bots)
const mine = pid => pid && (pid===me() || (NET.mode==='local' && V && V.players.some(p=>p.id===pid && !p.bot)));

/* ====================== MENÚ ====================== */
let myEmojiSel = load('boton_emoji') || EMOJIS[0];
const myName = () => ($('#myName').value.trim() || 'Jugador').slice(0,16);
const myEmoji = () => myEmojiSel;
$('#myName').value = load('boton_name') || '';
$('#myName').addEventListener('input', ()=>store('boton_name', $('#myName').value.trim()));
function renderTokenPicker(){ $('#tokens').innerHTML = EMOJIS.map(e=>`<button class="tok ${e===myEmojiSel?'sel':''}" onclick="pickEmoji('${e}')">${e}</button>`).join(''); }
function pickEmoji(e){ myEmojiSel=e; store('boton_emoji', e); renderTokenPicker(); }
renderTokenPicker();
function needName(){ if(!$('#myName').value.trim()){ toast('Escribí tu nombre primero ✍️'); $('#myName').focus(); return true; } store('boton_name', myName()); return false; }
function joinClick(){ const code=$('#joinCode').value.trim().toUpperCase(); if(!code) return toast('Escribí el código de la sala.'); if(needName()) return; clientJoin(code); }
function resumeClick(){
  const h=load('boton_host'), c=load('boton_client');
  if(h && (!c || h.at>=c.at)) return hostStart(true);
  if(c){ if(needName()) return; clientJoin(c.code); }
}
function refreshResume(){ const h=load('boton_host'), c=load('boton_client'), ok=x=>x && Date.now()-x.at<6*3600e3; $('#btnResume').style.display = ok(h)||ok(c) ? 'block' : 'none'; }
refreshResume();
(function(){
  const m=(location.hash.slice(1) || new URLSearchParams(location.search).get('sala') || '').toUpperCase();
  if(/^[A-Z0-9]{4,6}$/.test(m)){ $('#joinCode').value=m;
    if(new URLSearchParams(location.search).get('dueno')){ if(!$('#myName').value.trim()) $('#myName').value='Dueño'; setTimeout(()=>clientJoin(m), 300); }
    else toast('Te invitaron a la sala '+m+': escribí tu nombre y tocá “Entrar”.'); }
})();
const savedOpts = () => Object.assign(defaultOpts(), load('boton_opts')||{});

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
  sysChat('⚽ Cancha en este aparato. Jugá contra un bot 🤖 o con un amigo al lado, elegí tu club y tocá Empezar.');
  ANIM.lastN=null; commit(); renderChat();
}
function leaveClick(){
  if(NET.mode==='local'){ if(S && S.phase==='play' && !confirm('¿Salir de la partida?')) return; return leaveToMenu(); }
  if(!confirm('¿Salir de la sala?')) return;
  if(NET.mode==='host'){
    const others=hostCandidates(S);
    if(others.length) return hostHandover();
    store('boton_host', undefined);
  } else if(NET.mode==='client'){
    if(NET.hostConn && NET.hostConn.open && NET.myPid) try{ NET.hostConn.send({t:'act', a:{type:'leave'}}); }catch(e){}
    store('boton_client', undefined);
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
  s.clock=Date.now();   // para que el reloj se vea igual en todos los aparatos
  return s;
}
function commit(){
  lightShot();
  if(NET.mode==='host'){
    for(const pid in NET.conns){ const c=NET.conns[pid]; if(c && c.open) try{ c.send({t:'state', s:publicState(pid)}); }catch(e){} }
    sendBackups();
    if(!NET.noSave){ const s=JSON.parse(JSON.stringify(S)); if(s.shot) s.shot={n:s.shot.n, res:s.shot.res, stale:true}; store('boton_host', {code:NET.code, S:s, CHAT:CHAT.slice(-80), myPid:NET.myPid, at:Date.now()}); }
  }
  if(S && (NET.mode==='host'||NET.mode==='local') && S.phase==='lobby') store('boton_opts', S.opts);
  render();
}
function doAct(a){
  if(NET.mode==='client'){ if(NET.hostConn && NET.hostConn.open) NET.hostConn.send({t:'act', a}); else toast('Sin conexión con el anfitrión.'); return; }
  let who=me();
  const r=act(who, a); if(typeof r==='string') toast(r);
}
function newPeer(id){ return new Peer(id, {debug:1, config:{iceServers: window.ICE_SERVERS || [{urls:"stun:stun.l.google.com:19302"}]}}); }
function netBar(on,txt){ const b=$('#netbar'); b.style.display=on?'block':'none'; if(txt) b.textContent=txt; }

// ---------- anfitrión ----------
function hostStart(resume){
  if(!resume && needName()) return;
  const saved = resume ? load('boton_host') : null;
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
    if(resume){ toast('La sala sigue abierta en otro aparato (otro jugador quedó de anfitrión). Entrá con el código.'); peer.destroy(); store('boton_host',undefined); NET.mode=null; $('#joinCode').value=NET.code; return; }
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
  store('boton_host', undefined);
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
        why = S.players.length>=MAXP ? 'La mesa está llena: entraste a mirar 👀.' : 'La partida ya empezó: entraste a mirar 👀. Te podés sumar cuando termine la partida.';
        ob={id:'o'+(++S.seq), name:nm, emoji:'👀', token:d.token, peerId:conn.peer, conn:true};
        S.observers.push(ob); sysChat(`👀 ${ob.name} entró a mirar.`);
      }
    } else if(p){ sysChat(`${p.emoji} ${p.name} se reconectó.`); }
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
  else if(d.t==='aim'){ if(S.phase==='play' && (shooterOf(S)===pid)) relayAim(pid, d.a); }
  else if(d.t==='kp'){ act(pid, {type:'keeper', x:d.x}); }
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
  NET.noSave=true; store('boton_host', undefined);
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
      if(!NET.welcomed){ toast('No se encontró la sala '+code+'. Revisá el código.'); store('boton_client',undefined); leaveToMenu(); }
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
    store('boton_client',{code:NET.code, at:Date.now()}); if(location.hash!=='#'+NET.code) history.replaceState(null,'','#'+NET.code);
    if(d.why) toast(d.why);
  }
  else if(d.t==='state'){ S=d.s; if(S.clock) CLK.off=S.clock-Date.now(); render(); }
  else if(d.t==='aim'){ REMOTE_AIM=Object.assign({}, d.a, {pid:d.pid, at:Date.now()}); }
  else if(d.t==='kp'){ if(S && d.kp) S.kp=d.kp; }
  else if(d.t==='chat'){ CHAT.push(d.m); renderChat(d.m); }
  else if(d.t==='chatlog'){ CHAT=d.list||[]; renderChat(); }
  else if(d.t==='backup'){ NET.backup={s:d.s, chat:d.chat}; }
  else if(d.t==='migrate'){ NET.backup={s:d.s, chat:d.chat}; takeoverHost('handover'); }
  else if(d.t==='kicked'){ toast('🚪 El anfitrión te sacó de la mesa.'); store('boton_client',undefined); leaveToMenu(); }
  else if(d.t==='err') toast(d.m);
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


/* ====================== MIRA EN VIVO Y ARQUERO ====================== */
// la flecha del que está tirando se ve en los otros aparatos
let REMOTE_AIM=null;
function relayAim(pid, a){
  if(!a) return;
  const x={j:a.j|0, ang:+a.ang||0, pow:+a.pow||0};
  if(pid!==me()) REMOTE_AIM=Object.assign({}, x, {pid, at:Date.now()});
  for(const id in NET.conns){ if(id===pid) continue; const c=NET.conns[id]; if(c && c.open) try{ c.send({t:'aim', a:x, pid}); }catch(e){} }
}
function sendAim(){
  if(NET.mode==='local' || !V || V.phase!=='play' || !AIM.on) return;
  const now=Date.now(); if(now-(sendAim.t||0)<90){ clearTimeout(sendAim.tm); sendAim.tm=setTimeout(sendAim, 100); return; }
  sendAim.t=now;
  const a={j:AIM.j, ang:AIM.ang, pow:AIM.pow};
  if(NET.mode==='client'){ if(NET.hostConn && NET.hostConn.open) try{ NET.hostConn.send({t:'aim', a}); }catch(e){} }
  else if(NET.mode==='host') relayAim(me(), a);
}
// el anfitrión avisa dónde están los arqueros (sin mandar todo el estado)
function relayKeeper(){
  if(NET.mode!=='host') return;
  const now=Date.now(); if(now-(relayKeeper.t||0)<70){ clearTimeout(relayKeeper.tm); relayKeeper.tm=setTimeout(relayKeeper, 80); return; }
  relayKeeper.t=now;
  for(const id in NET.conns){ const c=NET.conns[id]; if(c && c.open) try{ c.send({t:'kp', kp:S.kp}); }catch(e){} }
}
function sendKeeper(x, side){
  if(NET.mode==='client'){ const now=Date.now(); if(now-(sendKeeper.t||0)<60) return; sendKeeper.t=now; if(S) S.kp[side]=x; if(NET.hostConn && NET.hostConn.open) try{ NET.hostConn.send({t:'kp', x}); }catch(e){} }
  else doAct({type:'keeper', x, side});
}

/* ====================== SONIDOS ====================== */
const SND={on:load('boton_snd')!==false, ctx:null};
function actx(){ if(!SND.ctx){ try{ SND.ctx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } if(SND.ctx && SND.ctx.state==='suspended') SND.ctx.resume(); return SND.ctx; }
function tone(f, d, type, v, when, f2){
  if(!SND.on) return; const c=actx(); if(!c) return;
  const t=c.currentTime+(when||0), o=c.createOscillator(), g=c.createGain();
  o.type=type||'sine'; o.frequency.setValueAtTime(f,t); if(f2) o.frequency.exponentialRampToValueAtTime(f2, t+d);
  g.gain.setValueAtTime(v||.12,t); g.gain.exponentialRampToValueAtTime(.001,t+d);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t+d+.02);
}
function noise(d, v, when, hp, lp, shape){
  if(!SND.on) return; const c=actx(); if(!c) return;
  const t=c.currentTime+(when||0), b=c.createBuffer(1, Math.max(1,c.sampleRate*d|0), c.sampleRate), ch=b.getChannelData(0);
  for(let i=0;i<ch.length;i++){ const k=i/ch.length; ch[i]=(Math.random()*2-1)*(shape==='swell' ? Math.sin(Math.PI*k) : Math.pow(1-k, 3)); }
  const s=c.createBufferSource(), g=c.createGain(), f=c.createBiquadFilter(); f.type=lp?'lowpass':'highpass'; f.frequency.value=lp||hp||1800;
  s.buffer=b; g.gain.value=v||.2; s.connect(f).connect(g).connect(c.destination); s.start(t);
}
const sfx={
  flick(v){ tone(1400,.03,'triangle',.06+v*.1); noise(.03,.12+v*.2,0,2500); },
  b(v){ tone(180,.07,'sine',.1+v*.25,0,90); noise(.04,.08+v*.3,0,0,1400); },
  c(v){ tone(1100+v*500,.04,'triangle',.05+v*.14); },
  w(v){ tone(150,.08,'triangle',.06+v*.18); noise(.05,.05+v*.2,0,0,700); },
  p(v){ tone(1650,.5,'sine',.08+v*.12); tone(2480,.35,'sine',.04+v*.06); },
  n(v){ noise(.25,.05+v*.18,0,0,2400,'swell'); },
  k(v){ tone(200,.09,'square',.04+v*.1); noise(.06,.08+v*.2,0,0,900); },
  goal(){ noise(2.2,.32,0,0,1300,'swell'); noise(1.6,.18,.2,400,0,'swell'); [392,523,659,784].forEach((f,i)=>tone(f,.25,'square',.06,.15+i*.1)); },
  whistle(n){ for(let i=0;i<(n||1);i++){ tone(2900,.22,'square',.05,i*.3); tone(3150,.22,'square',.04,i*.3); } },
  ooh(){ noise(1.1,.16,0,0,900,'swell'); tone(320,.9,'sawtooth',.02,0,220); },
  turn(){ tone(740,.12,'sine',.12); tone(988,.18,'sine',.12,.11); },
  win(){ [523,659,784,1047].forEach((f,i)=>tone(f,.3,'triangle',.14,i*.13)); },
  priv(){ tone(1200,.08,'sine',.08); tone(1500,.1,'sine',.08,.08); },
};
// la hinchada de fondo (suave, mientras se juega)
const CROWD={src:null, g:null};
function crowdStart(){
  if(!SND.on || CROWD.src) return; const c=actx(); if(!c) return;
  const b=c.createBuffer(1, c.sampleRate*3, c.sampleRate), ch=b.getChannelData(0); let l=0;
  for(let i=0;i<ch.length;i++){ l=l*.97+(Math.random()*2-1)*.03; ch[i]=l*(.7+.3*Math.sin(i/c.sampleRate*1.7)); }
  const s=c.createBufferSource(), f=c.createBiquadFilter(), g=c.createGain(); s.buffer=b; s.loop=true; f.type='bandpass'; f.frequency.value=520; f.Q.value=.5; g.gain.value=.5;
  s.connect(f).connect(g).connect(c.destination); s.start(); CROWD.src=s; CROWD.g=g;
}
function crowdStop(){ if(!CROWD.src) return; try{ CROWD.src.stop(); }catch(e){} CROWD.src=null; }
function toggleSound(){ SND.on=!SND.on; store('boton_snd', SND.on); $('#btnSnd').textContent=SND.on?'🔊':'🔇'; if(SND.on) sfx.turn(); else crowdStop(); }
$('#btnSnd').textContent=SND.on?'🔊':'🔇';
document.addEventListener('pointerdown', ()=>actx(), {once:true});
const MUSIC_CREDIT = 'Música: "Monkeys Spinning Monkeys" de Kevin MacLeod (incompetech.com). Licencia Creative Commons Atribución 4.0: creativecommons.org/licenses/by/4.0/';
const MUSIC = { on: load('boton_music')===true, buf:null, src:null, gain:null, loading:false, VOL:.07 };
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
function toggleMusic(){ MUSIC.on=!MUSIC.on; store('boton_music', MUSIC.on); musicSync(); toast(MUSIC.on?'🎶 Música de fondo prendida (suave).':'🔕 Música de fondo apagada.'); }
function renderMusicBtn(){ $$('.btnMusic').forEach(b=>{ b.textContent = MUSIC.on ? '🎶' : '🔕'; b.title = MUSIC.on ? 'Apagar la música de fondo' : 'Prender la música de fondo'; }); }
renderMusicBtn(); $('#musicCredit').textContent='🎶 '+MUSIC_CREDIT;

/* ====================== RENDER GENERAL ====================== */
const CLK={off:0}, ANIM={on:false, lastN:null, start:0, shot:null, evi:0};
const hostMs = () => Date.now() + (NET.mode==='client' ? CLK.off : 0);
function render(){
  if(!S) return;
  V = NET.mode==='client' ? S : publicState(me());
  if(V.phase==='lobby'){ show('lobby'); renderLobby(); }
  else { show('game'); renderGame(); }
  renderSidePanels(); renderChatTo(); renderVoice(); voiceSync(); musicSync();
}
const humanLocals = () => NET.mode==='local' && V ? V.players.filter(p=>!p.bot) : [];
function playerTag(p){
  const host=p.id===V.hostPid;
  return `<span class="dot" style="background:${p.color}"></span><span style="font-size:20px">${esc(p.emoji)}</span><span class="nm">${esc(p.name)}${p.id===me()?' <span class="muted">(vos)</span>':''}</span>`
    + `${host&&NET.mode!=='local'?'👑':''}${p.bot?'🤖':''}${p.local&&!p.bot?'📱':''}${p.mic?'🎙️':''}${!p.bot&&!p.conn?'⚠️':''}`;
}
const mySide = () => V ? sideOf(V, NET.myPid) : -1;
// de qué lado se mira la cancha (en un aparato con varios, desde el lado 0)
const mySideView = () => { if(NET.mode==='local' && humanLocals().length>1) return 0; const s=mySide(); return s<0 ? 0 : s; };
function clubSwatch(c, kit){ const k=kit||c; return `<span class="sw" style="background:linear-gradient(90deg,${k.a} 0 50%,${k.b} 50% 100%)"></span>`; }
function clubSelect(p, en){
  const opt=d=>CLUBS.filter(c=>c.d===d).map(c=>`<option value="${c.k}" ${p.club===c.k?'selected':''}>${esc(c.n)}</option>`).join('');
  return `<select class="clubsel" ${en?'':'disabled'} onchange="doAct({type:'club',pid:'${p.id}',v:this.value})"><optgroup label="Primera División">${opt('P')}</optgroup><optgroup label="División Intermedia">${opt('I')}</optgroup></select>`;
}

// ---------- sala de espera ----------
function renderLobby(){
  const host=amHost(), myObs=!!NET.obs, o=V.opts, eq=o.fmt==='parejas', ord=o.fmt!=='parejas';
  $('#lobbyCode').textContent=NET.code||'—';
  $('#lobbyCodeBox').style.display = NET.mode==='local' ? 'none' : '';
  $('#lobbyTitle').textContent = NET.mode==='local' ? '⚽ Cancha en este aparato' : '⚽ Sala de espera';
  $('#pcount').textContent=`(${V.players.length}/${MAXP})`;
  const teamBtn = p => eq ? `<button class="tbtn" ${host||p.id===me()?`onclick="doAct({type:'team',pid:'${p.id}'})"`:'disabled'} title="Cambiar de equipo">${TEAMS[p.team].e}</button>` : '';
  const upBtn = (p,i) => ord && host && i>0 ? `<button class="btn sm gray" onclick="doAct({type:'order',pid:'${p.id}'})" title="Subir en el orden">⬆️</button>` : '';
  const tag = i => o.fmt==='duelo' ? (i<2?'':'<span class="muted">sobra</span>') : o.fmt==='rey' ? `<span class="muted">${i+1}º</span>` : '';
  const capt = p => eq && V.players.filter(x=>x.team===p.team)[0]!==p;   // en parejas, el club del equipo lo elige el primero
  $('#plist').innerHTML=V.players.map((p,i)=>{ const c=CLUB(p.club), en=(host && (p.bot||NET.mode==='local'||p.id===me())) || p.id===me();
    return `<li class="pl"><div class="plrow">${teamBtn(p)}${playerTag(p)}${tag(i)}${upBtn(p,i)}${host && p.id!==V.hostPid?`<button class="btn sm gray" onclick="doAct({type:'kick',pid:'${p.id}'})" title="Sacar">✕</button>`:''}</div>
      <div class="plclub">${capt(p) ? `<span class="muted">juega con ${esc(CLUB(V.players.filter(x=>x.team===p.team)[0].club).n)}</span>` : `${clubSwatch(c)}${clubSelect(p, en)}<small class="muted">${esc(c.ap)} · ${esc(c.c)}</small>`}</div></li>`; }).join('')
    + (V.observers||[]).map(x=>`<li style="opacity:.75"><div class="plrow"><span style="font-size:20px">👀</span><span class="nm">${esc(x.name)} <span class="muted">mirando</span></span>${x.mic?'🎙️':''}</div></li>`).join('');
  const err=canStartV();
  $('#lobbyHostBtns').innerHTML = host
    ? `<div class="row"><button class="btn gray" onclick="doAct({type:'addBot'})" ${V.players.length>=MAXP?'disabled':''}>🤖 Sumar bot</button>
       ${NET.mode==='local'?`<button class="btn gray" onclick="addLocalClick()">🙋 Amigo en este aparato</button>`:''}
       <button class="btn green" onclick="doAct({type:'start'})">▶️ Empezar</button></div>
       <p class="muted">${err?'⚠️ '+esc(err):'¡Listo para empezar!'}${eq?' · Tocá 🅰️/🅱️ para cambiar a alguien de equipo.':ord?' · Con ⬆️ cambiás el orden.':''}</p>`
    : `<p class="muted" style="text-align:center">⏳ Esperando que el anfitrión 👑 empiece el partido… Mientras, elegí tu club.</p>`;
  $('#lobbyObs').innerHTML = myObs ? `<div class="obsbar" style="border-radius:10px;margin-top:8px">👀 Estás mirando. ${V.players.length<MAXP?`<button class="btn sm gold" onclick="doAct({type:'joinNext'})">⚽ Sumarme a jugar</button>`:'La mesa está llena.'}</div>` : '';
  $('#optsBox').innerHTML = optsHTML(host);
  const g=$('#grulesBox');
  if(host){
    if(!g.querySelector('textarea')) g.innerHTML=`<textarea id="grulesIn" maxlength="1200" placeholder="Ej.: el que pierde ceba el tereré 🧉&#10;Si la pelota sale de la mesa, saca el otro"></textarea><p class="muted" style="margin:4px 0 0">Se guarda solo y lo ven todos.</p>`;
    const ta=$('#grulesIn'); if(document.activeElement!==ta) ta.value=V.grules||'';
    ta.oninput=()=>{ clearTimeout(ta.t); ta.t=setTimeout(()=>doAct({type:'grules', text:ta.value}), 600); };
  } else g.innerHTML = V.grules ? `<div class="grules">${esc(V.grules)}</div>` : `<p class="muted">El anfitrión todavía no escribió reglas propias.</p>`;
  $('#sugBox').innerHTML = sugsHTML(host);
}
function canStartV(){ const keep=S; S=V; try{ return canStart(); } finally{ S=keep; } }
function addLocalClick(){ const n=prompt('Nombre del amigo que juega en este aparato:'); if(n && n.trim()) doAct({type:'addLocal', name:n.trim()}); }
function optsHTML(host){
  const o=V.opts, dis = host && V.phase==='lobby' ? '' : 'disabled';
  const sel=(k, list)=>`<select ${dis} onchange="doAct({type:'opt',k:'${k}',v:this.value})">${list.map(x=>`<option value="${x.v}" ${String(o[k])===String(x.v)?'selected':''}>${x.t}</option>`).join('')}</select>`;
  const chk=(k, t, d)=>`<label class="opt" style="margin:0 0 6px;font-weight:400"><input type="checkbox" ${o[k]?'checked':''} ${dis} onchange="doAct({type:'opt',k:'${k}',v:this.checked})"><span><b>${t}</b><small>${d}</small></span></label>`;
  const obj=O=>Object.keys(O).map(k=>({v:k, t:O[k].t||O[k]}));
  return `<label style="margin-top:0">Cómo se juega ${host?'':'<span class="muted">(lo elige el anfitrión)</span>'}</label>${sel('fmt', obj(FORMATS))}
    <p class="muted" style="margin:4px 0 0">${esc(FORMATS[o.fmt].d)}</p>
    <label>⚽ Botones por equipo</label>${sel('size', SIZES)}
    <label>🥅 Gana el que llega a</label>${sel('goals', GOALS)}
    ${o.fmt==='rey'?`<label>🏆 Copas para ganar el Desafío</label>${sel('cups', CUPS)}`:''}
    <label>⏰ Tiempo de partido</label>${sel('time', TIMES)}
    <label>👆 Toques por turno</label>${sel('toques', TOQUES)}
    <label>⏳ Tiempo para tirar</label>${sel('turnT', TURNT)}
    <label>🎯 Ayuda para apuntar</label>${sel('aim', AIMS)}
    <label>Nivel de los bots</label>${sel('bot', BOTLV)}
    <label>Reglas de la casa</label>` + HOUSE.map(h=>chk(h.k, h.t, h.d)).join('');
}
function sugsHTML(host){
  const list=(V.sugs||[]).slice().sort((a,b)=>b.votes.length-a.votes.length);
  if(!list.length) return '<p class="muted">Todavía no hay sugerencias. ¡Proponé la primera!</p>';
  return list.map(s=>`<div class="sug"><span class="t">${esc(s.text)}<small>${esc(s.e)} ${esc(s.by)}</small></span>
    <button class="vote ${s.votes.includes(me())?'on':''}" onclick="doAct({type:'vote',id:'${s.id}'})">👍 ${s.votes.length}</button>
    ${host?`<button class="vote" onclick="doAct({type:'sugDel',id:'${s.id}'})" title="Borrar">🗑️</button>`:''}</div>`).join('');
}
function sendSug(id){ const i=$('#'+id); const t=i.value.trim(); if(!t) return toast('Escribí la regla que querés sugerir.'); doAct({type:'suggest', text:t}); i.value=''; toast('💡 ¡Sugerencia enviada! Los demás la pueden votar.'); }

/* ====================== PARTIDO ====================== */
let PREV={mk:'', turnKey:''};
function renderGame(){
  $('#roomTag').textContent = NET.mode==='local' ? '📱 En este aparato' : '🔑 '+NET.code;
  $('#obsbar').style.display = NET.obs ? 'block' : 'none';
  if(NET.obs) $('#obsbar').textContent = '👀 Estás mirando el partido.';
  const mkey=(V.startedAt||0)+'|'+V.matchN;
  if(mkey!==PREV.mk){ if(CAM3.auto) CAM3.mode=defaultCam(); R3.kitKey=null; }
  PREV.mk=mkey;
  // si llegó un tiro nuevo, se anima
  if(V.shot && V.shot.n!==ANIM.lastN){
    if(V.shot.stale || !V.shot.tracks || hostMs()>V.busyUntil){ ANIM.lastN=V.shot.n; }
    else { ANIM.lastN=V.shot.n; ANIM.on=true; ANIM.start=performance.now(); ANIM.shot=V.shot; ANIM.evi=0; ANIM.done=false; AIM.on=false; REMOTE_AIM=null; sfx.flick(Math.min(1,V.shot.pow||.5)); }
  }
  renderScore(); if(!ANIM.on) renderStatus(); endModal();
  const tk=V.phase+'|'+V.turn+'|'+V.shotN;
  if(tk!==PREV.turnKey){ PREV.turnKey=tk; if(V.phase==='play' && !ANIM.on && mine(shooterOf(V)) && !NET.obs) sfx.turn(); }
}
function clockTxt(){
  if(!V || V.phase!=='play') return '';
  if(V.sudden) return '⚡ Gol de oro';
  let t = V.endsAt ? (()=>{ const s=Math.max(0, Math.ceil((V.endsAt-hostMs())/1000)); return `⏱ ${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; })() : `a ${V.opts.goals}`;
  if(V.opts.turnT && !ANIM.on){ const left=Math.ceil((V.opts.turnT*1000-(hostMs()-Math.max(V.turnAt, V.busyUntil)))/1000); if(left>=0 && left<=V.opts.turnT) t+=` · ⏳${left}`; }
  return t;
}
function renderScore(){
  if(!V.sides.length){ $('#score').innerHTML=''; return; }
  const side=i=>{ const c=sideClub(V,i), k=sideKit(V,i), turn=V.phase==='play' && V.turn===i;
    return `<div class="sbs s${i} ${turn?'turn':''}" style="--c:${k.a};--c2:${k.b}"><b>${clubSwatch(c,k)} ${esc(c.n)}<small>${esc(V.sides[i].pids.map(id=>(V.players.find(p=>p.id===id)||{}).name||'?').join(' y '))}${V.sides[i].pids.includes(NET.myPid)?' (vos)':''}</small></b><span>${V.score[i]}</span></div>`; };
  const q = V.opts.fmt==='rey' ? `<div class="queue">🏆 ${V.queue.map(id=>{ const p=V.players.find(x=>x.id===id); return p?`<span class="${playing(V,id)?'on':''}">${esc(p.emoji)} ${esc(p.name)}${V.cups[id]?' '+'🏆'.repeat(V.cups[id]):''}</span>`:''; }).join('')}</div>` : '';
  $('#score').innerHTML=`<div class="sb">${side(0)}<div class="mid" id="clock">${clockTxt()}</div>${side(1)}</div>${q}`;
}
function renderStatus(){
  let st='';
  if(V.phase==='play'){
    const sh=shooterOf(V), p=V.players.find(x=>x.id===sh), set=V.set ? SETNAME[V.set.type]+' · ' : '';
    if(mine(sh) && !NET.obs){
      const who = humanLocals().length>1 ? `${p.emoji} ${p.name} (${clubName(V,V.turn)})` : 'Tu turno';
      st = `${set}${who}: tocá uno de tus botones y arrastrá para atrás para tirar · ${V.toques} toque${V.toques>1?'s':''}`;
    } else {
      st = `${set}Turno de ${clubName(V,V.turn)} (${p?esc(p.name):'?'})`;
      const ms=mySide(); if(V.opts.arquero && ms>=0 && ms!==V.turn && !NET.obs) st+=' · 🧤 mové tu arquero tocando cerca de tu arco';
    }
  } else if(V.phase==='matchEnd') st='🏆 Fin del partido';
  else if(V.phase==='over') st='🏆 Fin';
  $('#status').textContent=st;
}
setInterval(()=>{ const c=$('#clock'); if(c && V) c.textContent=clockTxt(); }, 250);
function banner(t, cls){ const b=$('#banner'); b.className='banner '+(cls||''); b.textContent=t; b.style.display='block'; clearTimeout(banner.t); banner.t=setTimeout(()=>b.style.display='none', 2600); }
function bigText(t, col){ const d=document.createElement('div'); d.className='bigtext'; if(col) d.style.setProperty('--glow', col); d.textContent=t; $('#stage').appendChild(d); setTimeout(()=>d.remove(), 2200); }
let ENDSHOWN=null;
function endModal(){
  if(!V || (V.phase!=='over' && V.phase!=='matchEnd') || ANIM.on){ if(ENDSHOWN && V && V.phase==='play'){ ENDSHOWN=null; closeModal(); } return; }
  const key=V.phase+'|'+V.matchN+'|'+(V.startedAt||0); if(ENDSHOWN===key) return; ENDSHOWN=key;
  const host=amHost(), mw=V.matchWin||{side:-1, score:V.score};
  const iWon = V.opts.fmt==='rey' ? V.win && mine(V.win.pid) : mw.side>=0 && V.sides[mw.side].pids.some(pid=>mine(pid));
  if(iWon) sfx.win();
  const res = mw.side<0 ? `🤝 Empate ${mw.score[0]} a ${mw.score[1]}` : `<b>${esc(clubName(V,mw.side))}</b> gana ${mw.score[mw.side]} a ${mw.score[1-mw.side]} 🎉`;
  const cups = V.opts.fmt==='rey' ? `<table class="score">${V.players.slice().sort((a,b)=>(V.cups[b.id]||0)-(V.cups[a.id]||0)).map(p=>`<tr><td>${esc(p.emoji)} ${esc(p.name)} <span class="muted">${esc(CLUB(p.club).n)}</span></td><td style="text-align:right">${'🏆'.repeat(V.cups[p.id]||0)||'—'}</td></tr>`).join('')}</table>` : '';
  if(V.phase==='matchEnd'){
    const nx=V.queue.slice(0,2).map(id=>{ const p=V.players.find(x=>x.id===id); return p?esc(p.name)+' ('+esc(CLUB(p.club).n)+')':'?'; });
    modal(`<h2>🏆 Fin del partido</h2><p style="font-size:18px">${res}</p>${cups}<p>Ahora: <b>${nx[0]}</b> contra <b>${nx[1]}</b></p>
      ${host?`<button class="btn green wide" onclick="closeModal();doAct({type:'next'})">▶️ Siguiente partido</button><p class="muted">Si no, arranca solo en unos segundos.</p>`:`<p class="muted">El siguiente partido arranca en unos segundos…</p>`}
      <button class="btn gray wide" style="margin-top:6px" onclick="closeModal()">Cerrar</button>`);
    return;
  }
  const title = V.opts.fmt==='rey' && V.win ? `🏆 ¡${esc((V.players.find(p=>p.id===V.win.pid)||{}).name||'?')} levanta la copa!` : '🏆 ¡Terminó el partido!';
  modal(`<h2>${title}</h2><p style="font-size:18px">${res}</p>${cups}
    ${host?`<button class="btn green wide" onclick="closeModal();doAct({type:'rematch'})">🔁 Revancha</button><button class="btn wide" style="margin-top:6px" onclick="closeModal();doAct({type:'newGame'})">⚙️ Volver a la sala (cambiar clubes o reglas)</button>`:`<p class="muted">El anfitrión elige si hay revancha.</p>`}
    <button class="btn gray wide" style="margin-top:6px" onclick="closeModal()">Mirar la cancha</button>`);
}

/* ====================== ANIMACIÓN DEL TIRO ====================== */
// dónde está cada cosa ahora: [botones lado 0], [botones lado 1], pelota, arqueros
function viewPos(){
  const n=BTN_N(V.opts);
  if(ANIM.on && ANIM.shot){
    const sh=ANIM.shot, f=(performance.now()-ANIM.start)/1000*30, fi=Math.floor(f), fr=f-fi;
    const at=i=>{ const t=sh.tracks[i]; if(!t) return null; const L=t.length/2; const a=Math.min(fi, L-1), b=Math.min(fi+1, L-1); return {x:(t[a*2]+(t[b*2]-t[a*2])*fr)/10, y:(t[a*2+1]+(t[b*2+1]-t[a*2+1])*fr)/10}; };
    // sonidos de los choques
    while(ANIM.evi<sh.ev.length && sh.ev[ANIM.evi].f<=fi){ playEv(sh.ev[ANIM.evi], sh); ANIM.evi++; }
    if(fi>=sh.frames+2 && !ANIM.done){ ANIM.done=true; setTimeout(()=>{ ANIM.on=false; afterShot(sh); if(V) { renderStatus(); endModal(); } }, sh.res.goal!=null ? 1600 : 350); }
    const btn=[0,1].map(t=>[...Array(n)].map((_,j)=>at(t*n+j)||sh.from.btn[t][j]));
    return {btn, ball:at(2*n)||sh.from.ball, kp:sh.from.kp};
  }
  return {btn:V.btn, ball:V.ball, kp:V.kp};
}
function playEv(e, sh){
  if(e.k==='g'){ const sc=clubName(V,e.side); bigText('¡GOOOL!', sideKit(V,e.side).a); banner(`⚽ ¡Gol de ${sc}!`, 'gol'); sfx.goal(); R3.flash={at:performance.now(), side:e.side}; return; }
  if(e.k==='o'){ sfx.whistle(1); return; }
  if(sfx[e.k]) sfx[e.k](e.v||.5);
}
function afterShot(sh){
  const r=sh.res;
  if(r.goal!=null) return;
  if(r.foul){ sfx.whistle(2); banner(r.foul==='penal' ? '🎯 ¡Penal!' : '🟨 Falta: tiro libre', 'falta'); return; }
  if(r.saved){ sfx.ooh(); banner('🧤 ¡Atajó el arquero!'); return; }
  if(r.post){ sfx.ooh(); banner('🥅 ¡Al palo!'); return; }
  if(r.set && SETNAME[r.set]) banner(SETNAME[r.set]);
}

/* ====================== APUNTAR Y TIRAR ====================== */
const AIM={on:false, j:-1, ang:0, pow:0, sx:0, sy:0, keeper:false};
const DRAG_FULL=26;   // cuánto hay que arrastrar para la fuerza máxima (cm de cancha)
function canShootNow(){ return V && V.phase==='play' && !ANIM.on && !NET.obs && mine(shooterOf(V)) && hostMs()>=V.busyUntil-300; }
function tablePoint(e){
  const r=cv3.getBoundingClientRect(), T=THREE;
  const m=new T.Vector2(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
  R3.ray.setFromCamera(m, R3.cam);
  const p=new T.Vector3(); if(!R3.ray.ray.intersectPlane(R3.plane, p)) return null;
  return {x:p.x, y:-p.z};
}
function onDown(e){
  if(!V || V.phase!=='play') return;
  const p=tablePoint(e); if(!p) return;
  // arquero a mano: tocar cerca de mi arco cuando el otro apunta
  const ms = NET.mode==='local' ? 1-V.turn : mySide();
  if(V.opts.arquero && ms>=0 && ms!==V.turn && (NET.mode!=='local' || humanLocals().some(q=>sideOf(V,q.id)===ms)) && Math.abs(p.y-(ms?FL:-FL))<16 && Math.abs(p.x)<GH+10){
    AIM.keeper=ms; cv3.setPointerCapture(e.pointerId); moveKeeper(p); return;
  }
  if(!canShootNow()) return;
  const s=V.turn, pos=viewPos(); let bj=-1, bd=BR+2.8;
  pos.btn[s].forEach((b,j)=>{ const d=Math.hypot(b.x-p.x, b.y-p.y); if(d<bd){ bd=d; bj=j; } });
  if(bj<0){ toast('Tocá uno de tus botones ('+clubName(V,s)+') y arrastrá para atrás.'); return; }
  AIM.on=true; AIM.j=bj; AIM.sx=pos.btn[s][bj].x; AIM.sy=pos.btn[s][bj].y; AIM.pow=0; AIM.ang=0;
  cv3.setPointerCapture(e.pointerId);
}
function onMove(e){
  if(AIM.keeper!==false){ const p=tablePoint(e); if(p) moveKeeper(p); return; }
  if(!AIM.on) return;
  const p=tablePoint(e); if(!p) return;
  const dx=AIM.sx-p.x, dy=AIM.sy-p.y, d=Math.hypot(dx,dy);
  AIM.pow=Math.min(1, Math.max(0, (d-1.5)/DRAG_FULL)); if(d>.5) AIM.ang=Math.atan2(dy,dx);
  sendAim();
}
function onUp(e){
  if(AIM.keeper!==false){ AIM.keeper=false; return; }
  if(!AIM.on) return;
  AIM.on=false;
  if(AIM.pow<.03){ return; }
  if(!canShootNow()) return;
  doAct({type:'shot', j:AIM.j, ang:AIM.ang, pow:AIM.pow});
}
function moveKeeper(p){ const x=Math.max(-GH+KH*.4, Math.min(GH-KH*.4, p.x)); if(V) V.kp[AIM.keeper]=x; sendKeeper(x, AIM.keeper); }

/* ====================== CANCHA 3D ====================== */
const R3={renderer:null, btn:[[],[]], kitKey:null};
const CAM3=Object.assign({mode:'lado', zoom:1, auto:true}, load('boton_cam3')||{});
function saveCam3(){ store('boton_cam3', {mode:CAM3.mode, zoom:CAM3.zoom, auto:CAM3.auto}); }
const defaultCam = () => (NET.mode==='local' && humanLocals().length>1) ? 'arriba' : 'lado';
const stage=$('#stage'), cv3=$('#c3d');
function resizeStage(){
  const r=stage.getBoundingClientRect();
  if(R3.renderer && r.width>0 && r.height>0){ R3.renderer.setSize(r.width, r.height, false); R3.cam.aspect=r.width/r.height; R3.cam.updateProjectionMatrix(); }
}
window.addEventListener('resize', ()=>{ if($('#game').classList.contains('on')) resizeStage(); });
function canvasTex(w, h, draw){ const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'), w, h); const t=new THREE.CanvasTexture(c); t.anisotropy=8; return t; }
function init3D(){
  if(R3.renderer || !window.THREE) return !!R3.renderer;
  const T=THREE;
  let renderer;
  try{ renderer=new T.WebGLRenderer({canvas:cv3, antialias:true}); }catch(e){ $('#no3d').style.display='flex'; return false; }
  const mobile=/Android|iPhone|iPad/i.test(navigator.userAgent);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, mobile?1.5:2));
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=T.PCFSoftShadowMap;
  const scene=new T.Scene();
  scene.background=canvasTex(4, 256, (g,w,h)=>{ const gr=g.createLinearGradient(0,0,0,h); gr.addColorStop(0,'#071226'); gr.addColorStop(1,'#14301f'); g.fillStyle=gr; g.fillRect(0,0,w,h); });
  scene.fog=new T.Fog(0x0d1f1a, 380, 1100);
  const cam=new T.PerspectiveCamera(50, 1, 1, 3000);
  Object.assign(R3, {renderer, scene, cam, T, ray:new T.Raycaster(), plane:new T.Plane(new T.Vector3(0,1,0), 0)});
  scene.add(new T.HemisphereLight(0xeaf4ff, 0x203020, .62));
  // torres de luz como en un estadio
  for(const [x,z] of [[-90,-110],[90,-110],[-90,110],[90,110]]){
    const l=new T.SpotLight(0xffffff, .42, 600, .7, .6, 1.2); l.position.set(x, 170, z); l.target.position.set(0,0,0); scene.add(l); scene.add(l.target);
    if(x<0 && z<0){ l.castShadow=true; l.shadow.mapSize.set(mobile?1024:2048, mobile?1024:2048); l.shadow.bias=-.0015; }
    const pole=new T.Mesh(new T.CylinderGeometry(1.5,2.2,250,8), new T.MeshStandardMaterial({color:0x555c66})); pole.position.set(x*1.25, 45, z*1.25); scene.add(pole);
    const panel=new T.Mesh(new T.BoxGeometry(26,14,3), new T.MeshBasicMaterial({color:0xfffbe8})); panel.position.set(x*1.25, 172, z*1.25); panel.lookAt(0,0,0); scene.add(panel);
  }
  // piso del salón
  const floor=new T.Mesh(new T.PlaneGeometry(2400,2400), new T.MeshStandardMaterial({roughness:.9, map:(()=>{ const t=canvasTex(256,256,(g,w,h)=>{ g.fillStyle='#3b2a1d'; g.fillRect(0,0,w,h); g.fillStyle='#4a3524'; for(let i=0;i<8;i++) g.fillRect(0,i*32,w,14); }); t.wrapS=t.wrapT=T.RepeatWrapping; t.repeat.set(40,40); return t; })()}));
  floor.rotation.x=-Math.PI/2; floor.position.y=-75; floor.receiveShadow=true; scene.add(floor);
  buildTable();
  // pelota
  R3.ball=new T.Mesh(new T.SphereGeometry(BA, 24, 16), new T.MeshStandardMaterial({roughness:.4, map:canvasTex(256,128,(g,w,h)=>{ g.fillStyle='#fafafa'; g.fillRect(0,0,w,h); g.fillStyle='#161616';
    for(let i=0;i<10;i++){ const x=(i%5)*w/5+(i>4?w/10:0)+w/20, y=i>4?h*.72:h*.3; g.beginPath(); for(let k=0;k<5;k++){ const a=k/5*Math.PI*2-Math.PI/2; g.lineTo(x+Math.cos(a)*13, y+Math.sin(a)*13); } g.fill(); } })}));
  R3.ball.castShadow=true; scene.add(R3.ball);
  // flecha para apuntar y anillo de fuerza
  R3.arrow=new T.Group(); const am=new T.MeshBasicMaterial({color:0xffe14a, transparent:true, opacity:.9, depthWrite:false});
  R3.arrowBody=new T.Mesh(new T.PlaneGeometry(1,1), am); R3.arrowBody.rotation.x=-Math.PI/2; R3.arrow.add(R3.arrowBody);
  R3.arrowHead=new T.Mesh(new T.CircleGeometry(1.8, 3), am); R3.arrowHead.rotation.x=-Math.PI/2; R3.arrow.add(R3.arrowHead);
  R3.arrow.position.y=.25; scene.add(R3.arrow);
  R3.powRing=new T.Mesh(new T.RingGeometry(BR+.6, BR+1.4, 48, 1, 0, Math.PI*2), new T.MeshBasicMaterial({color:0x2ee66b, transparent:true, opacity:.85, side:T.DoubleSide, depthWrite:false})); R3.powRing.rotation.x=-Math.PI/2; R3.powRing.position.y=.3; scene.add(R3.powRing);
  R3.sel=new T.Mesh(new T.RingGeometry(BR+.3, BR+.8, 40), new T.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:.6, side:T.DoubleSide, depthWrite:false})); R3.sel.rotation.x=-Math.PI/2; R3.sel.position.y=.2; scene.add(R3.sel);
  cv3.addEventListener('pointerdown', onDown); cv3.addEventListener('pointermove', onMove);
  cv3.addEventListener('pointerup', onUp); cv3.addEventListener('pointercancel', ()=>{ AIM.on=false; AIM.keeper=false; });
  cv3.addEventListener('wheel', e=>{ e.preventDefault(); CAM3.zoom=Math.max(.55, Math.min(1.8, CAM3.zoom*(e.deltaY>0?1.06:.94))); saveCam3(); }, {passive:false});
  resizeStage();
  return true;
}
function disposeTree(o){ o.traverse(m=>{ if(m.geometry) m.geometry.dispose(); if(m.material){ (Array.isArray(m.material)?m.material:[m.material]).forEach(x=>{ if(x.map) x.map.dispose(); x.dispose(); }); } }); }
function buildTable(){
  const T=THREE, G=new T.Group(); R3.scene.add(G);
  const X=FW+MARG, Y=FL+MARG;
  // el paño con la cancha pintada
  const field=canvasTex(1024, 1500, (g,w,h)=>{
    const sx=w/(2*X), sy=h/(2*Y), PX=x=>(x+X)*sx, PY=y=>(Y-y)*sy;
    g.fillStyle='#1f7a35'; g.fillRect(0,0,w,h);
    for(let i=0;i<14;i++){ g.fillStyle = i%2 ? '#23853a' : '#1d7432'; g.fillRect(PX(-FW), PY(FL-i*(2*FL/14)), (2*FW)*sx, (2*FL/14)*sy); }
    g.strokeStyle='rgba(255,255,255,.92)'; g.lineWidth=5;
    g.strokeRect(PX(-FW), PY(FL), 2*FW*sx, 2*FL*sy);
    g.beginPath(); g.moveTo(PX(-FW), PY(0)); g.lineTo(PX(FW), PY(0)); g.stroke();
    g.beginPath(); g.arc(PX(0), PY(0), CIRC*sx, 0, 7); g.stroke();
    g.fillStyle='#fff'; g.beginPath(); g.arc(PX(0), PY(0), 5, 0, 7); g.fill();
    for(const s of [-1,1]){
      g.strokeRect(PX(-AREA.w), s>0?PY(FL):PY(-FL+AREA.d), 2*AREA.w*sx, AREA.d*sy);
      g.strokeRect(PX(-CHICA.w), s>0?PY(FL):PY(-FL+CHICA.d), 2*CHICA.w*sx, CHICA.d*sy);
      g.beginPath(); g.arc(PX(0), PY(s*PEN), 5, 0, 7); g.fill();
      g.beginPath(); g.arc(PX(0), PY(s*PEN), 9*sx, s>0 ? Math.PI*.2 : Math.PI*1.2, s>0 ? Math.PI*.8 : Math.PI*1.8); g.stroke();
      for(const cx of [-1,1]){ g.beginPath(); g.arc(PX(cx*FW), PY(s*FL), 2*sx, 0, 7); g.stroke(); }
    }
    // borde de la mesa (afuera de las líneas) con la marca del juego
    g.fillStyle='rgba(255,255,255,.18)'; g.font=`900 ${Math.round(4*sx)}px system-ui`; g.textAlign='center';
    g.save(); g.translate(PX(-FW-MARG/2), PY(0)); g.rotate(-Math.PI/2); g.fillText('BOTONES PY 🇵🇾', 0, 10); g.restore();
    g.save(); g.translate(PX(FW+MARG/2), PY(0)); g.rotate(Math.PI/2); g.fillText('BOTONES PY 🇵🇾', 0, 10); g.restore();
  });
  const top=new T.Mesh(new T.PlaneGeometry(2*X, 2*Y), new T.MeshStandardMaterial({map:field, roughness:.95}));
  top.rotation.x=-Math.PI/2; top.receiveShadow=true; G.add(top);
  // marco de madera
  const wood=new T.MeshStandardMaterial({roughness:.55, map:canvasTex(256,32,(g,w,h)=>{ g.fillStyle='#8a5a2b'; g.fillRect(0,0,w,h); g.strokeStyle='rgba(60,30,10,.35)'; for(let i=0;i<9;i++){ g.beginPath(); g.moveTo(0,i*4+Math.random()*2); g.bezierCurveTo(w*.3,i*4+3,w*.6,i*4-2,w,i*4+1); g.stroke(); } })});
  for(const s of [-1,1]){
    const a=new T.Mesh(new T.BoxGeometry(3, 4, 2*Y+6), wood); a.position.set(s*(X+1.5), 1.5, 0); a.castShadow=a.receiveShadow=true; G.add(a);
    const b=new T.Mesh(new T.BoxGeometry(2*X+6, 4, 3), wood); b.position.set(0, 1.5, s*(Y+1.5)); b.castShadow=b.receiveShadow=true; G.add(b);
  }
  // mueble con los colores de Paraguay
  const body=new T.Mesh(new T.BoxGeometry(2*X+10, 70, 2*Y+10), new T.MeshStandardMaterial({roughness:.7, map:canvasTex(512,256,(g,w,h)=>{ g.fillStyle='#5b3a1c'; g.fillRect(0,0,w,h); g.fillStyle='#d52b1e'; g.fillRect(0,22,w,22); g.fillStyle='#fff'; g.fillRect(0,44,w,22); g.fillStyle='#0038a8'; g.fillRect(0,66,w,22); g.fillStyle='#f2c14e'; g.font='900 64px system-ui'; g.textAlign='center'; g.fillText('⚽ BOTONES PY', w/2, 185); })}));
  body.position.y=-35.5; body.castShadow=true; body.receiveShadow=true; G.add(body);
  // arcos con red
  const postM=new T.MeshStandardMaterial({color:0xffffff, roughness:.3, metalness:.2});
  const netTex=canvasTex(64,64,(g,w,h)=>{ g.strokeStyle='rgba(255,255,255,.75)'; g.lineWidth=2; for(let i=0;i<=w;i+=8){ g.beginPath(); g.moveTo(i,0); g.lineTo(i,h); g.stroke(); g.beginPath(); g.moveTo(0,i); g.lineTo(w,i); g.stroke(); } });
  netTex.wrapS=netTex.wrapT=T.RepeatWrapping; netTex.repeat.set(4,2);
  const netM=new T.MeshBasicMaterial({map:netTex, transparent:true, side:T.DoubleSide, depthWrite:false});
  const H=5;
  for(const s of [-1,1]){
    const z=-s*FL, zb=-s*(FL+GD);
    for(const x of [-GH, GH]){ const p=new T.Mesh(new T.CylinderGeometry(.5,.5,H,12), postM); p.position.set(x, H/2, z); p.castShadow=true; G.add(p); }
    const bar=new T.Mesh(new T.CylinderGeometry(.5,.5,2*GH+1,12), postM); bar.rotation.z=Math.PI/2; bar.position.set(0, H, z); bar.castShadow=true; G.add(bar);
    const back=new T.Mesh(new T.PlaneGeometry(2*GH, H), netM); back.position.set(0, H/2, zb); G.add(back);
    const roof=new T.Mesh(new T.PlaneGeometry(2*GH, GD), netM); roof.rotation.x=Math.PI/2; roof.position.set(0, H, (z+zb)/2); G.add(roof);
    for(const x of [-GH, GH]){ const sd=new T.Mesh(new T.PlaneGeometry(GD, H), netM); sd.rotation.y=Math.PI/2; sd.position.set(x, H/2, (z+zb)/2); G.add(sd); }
  }
  // tribunas con hinchada alrededor
  const crowd=canvasTex(512,128,(g,w,h)=>{ g.fillStyle='#22262e'; g.fillRect(0,0,w,h); const cols=['#d52b1e','#ffffff','#0038a8','#f5c400','#111','#1a8f3a','#5fb3ec'];
    for(let y=6;y<h;y+=11) for(let x=4;x<w;x+=8){ g.fillStyle=cols[(Math.random()*cols.length)|0]; g.beginPath(); g.arc(x+Math.random()*3, y+Math.random()*3, 3, 0, 7); g.fill(); } });
  crowd.wrapS=T.RepeatWrapping;
  const standM=new T.MeshStandardMaterial({map:crowd, roughness:1});
  const stands=[[0,-380,900,0],[0,380,900,Math.PI],[-330,0,1100,Math.PI/2],[330,0,1100,-Math.PI/2]];
  for(const [x,z,w,ry] of stands){ const st=new T.Mesh(new T.PlaneGeometry(w, 160), standM); st.position.set(x, 20, z); st.rotation.y=ry; st.rotation.x=0; G.add(st); }
  R3.tableG=G;
}
// la tapa del botón con los colores y el dibujo del club
function kitTex(k, num){
  return canvasTex(128,128,(g,w,h)=>{
    const c=w/2; g.save(); g.beginPath(); g.arc(c,c,w/2,0,7); g.clip();
    g.fillStyle=k.a; g.fillRect(0,0,w,h); g.fillStyle=k.b;
    if(k.pat==='rayas') for(let x=0;x<w;x+=26) g.fillRect(x+13,0,13,h);
    else if(k.pat==='horiz') for(let y=0;y<h;y+=26) g.fillRect(0,y+13,w,13);
    else if(k.pat==='franja') g.fillRect(0,h*.4,w,h*.2);
    else if(k.pat==='v'){ g.beginPath(); g.moveTo(0,h*.15); g.lineTo(c,h*.62); g.lineTo(w,h*.15); g.lineTo(w,h*.32); g.lineTo(c,h*.8); g.lineTo(0,h*.32); g.fill(); }
    else if(k.pat==='cruz'){ g.fillRect(c-10,0,20,h); g.fillRect(0,c-10,w,20); }
    else if(k.pat==='mangas'){ g.fillRect(0,0,w*.22,h); g.fillRect(w*.78,0,w*.22,h); }
    else if(k.pat==='tricolor'){ g.fillStyle='#d52b1e'; g.fillRect(0,h*.36,w,9); g.fillStyle='#0038a8'; g.fillRect(0,h*.36+9,w,9); }
    g.restore();
    g.lineWidth=9; g.strokeStyle=k.pat==='liso'||k.pat==='vivos'||k.pat==='tricolor' ? k.b : 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(c,c,w/2-5,0,7); g.stroke();
    g.fillStyle='rgba(255,255,255,.92)'; g.beginPath(); g.arc(c,c,22,0,7); g.fill();
    g.fillStyle='#111'; g.font='900 28px system-ui'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(String(num), c, c+1);
  });
}
function rebuildKits(){
  const T=THREE, n=BTN_N(V.opts);
  for(const t of [0,1]){ R3.btn[t].forEach(m=>{ R3.scene.remove(m); disposeTree(m); }); R3.btn[t]=[]; if(R3.keeper && R3.keeper[t]){ R3.scene.remove(R3.keeper[t]); disposeTree(R3.keeper[t]); } }
  R3.keeper=[];
  for(const t of [0,1]){
    const k=sideKit(V,t), sideM=new T.MeshStandardMaterial({color:k.b, roughness:.35}), rimM=new T.MeshStandardMaterial({color:k.a, roughness:.35});
    for(let j=0;j<n;j++){
      const g=new T.Group();
      const base=new T.Mesh(new T.CylinderGeometry(BR, BR*1.04, .9, 40), sideM); base.position.y=.45; base.castShadow=true; g.add(base);
      const topM=new T.MeshStandardMaterial({map:kitTex(k, j+2), roughness:.3});
      const cap=new T.Mesh(new T.CylinderGeometry(BR*.92, BR, .5, 40), [rimM, topM, rimM]); cap.position.y=1.15; cap.castShadow=true; g.add(cap);
      R3.scene.add(g); R3.btn[t].push(g);
    }
    // arquero: una plaquita parada con los colores del club y guantes
    const kg=new T.Group(), km=new T.MeshStandardMaterial({map:kitTex({a:k.b, b:k.a, pat:'liso'}, 1), roughness:.4});
    const body=new T.Mesh(new T.BoxGeometry(2*KH, 3.2, 1.6), [new T.MeshStandardMaterial({color:k.b}), new T.MeshStandardMaterial({color:k.b}), new T.MeshStandardMaterial({color:k.a}), new T.MeshStandardMaterial({color:k.a}), km, km]);
    body.position.y=1.6; body.castShadow=true; kg.add(body);
    for(const sx of [-1,1]){ const gl=new T.Mesh(new T.SphereGeometry(.85, 12, 10), new T.MeshStandardMaterial({color:0xf2c14e})); gl.position.set(sx*(KH+.4), 2.6, 0); kg.add(gl); }
    R3.scene.add(kg); R3.keeper[t]=kg;
  }
}
function draw3D(){
  const T=THREE, now=performance.now(), n=BTN_N(V.opts);
  const kk=n+'|'+V.sides.map((s,i)=>sideClub(V,i).k).join(',')+'|'+V.matchN;
  if(R3.kitKey!==kk){ R3.kitKey=kk; rebuildKits(); }
  const pos=viewPos();
  for(const t of [0,1]) R3.btn[t].forEach((m,j)=>{ const b=pos.btn[t][j]; if(b){ m.position.set(b.x, 0, -b.y); m.visible=true; } else m.visible=false; });
  R3.ball.position.set(pos.ball.x, BA, -pos.ball.y);
  if(ANIM.on){ const sp=R3.lastBall ? Math.hypot(pos.ball.x-R3.lastBall.x, pos.ball.y-R3.lastBall.y) : 0; R3.ball.rotation.x-=sp*.6; }
  R3.lastBall={...pos.ball};
  // arqueros (el que está a mano se ve donde lo puso su dueño; si no, sigue la pelota)
  for(const t of [0,1]){ const kg=R3.keeper[t]; if(!kg) continue;
    const auto = !V.opts.arquero || !V.sides[t] || V.sides[t].pids.every(id=>{ const p=V.players.find(x=>x.id===id); return !p || p.bot || (!p.conn && p.offAt); });
    let kx = ANIM.on && pos.kp ? pos.kp[t] : auto ? autoKeeper({ball:pos.ball}, t) : ((NET.mode!=='client'&&S?S.kp:V.kp)[t]||0);
    kg.userData.x = kg.userData.x==null ? kx : kg.userData.x + (kx-kg.userData.x)*.25;
    kg.position.set(kg.userData.x, 0, -(t ? KY : -KY)); }
  // flecha (la mía, o la del que está tirando en otro aparato)
  let aim=null;
  if(AIM.on && !ANIM.on){ aim={j:AIM.j, ang:AIM.ang, pow:AIM.pow, s:V.turn}; }
  else if(REMOTE_AIM && Date.now()-REMOTE_AIM.at<3000 && !ANIM.on && V.phase==='play'){ aim={j:REMOTE_AIM.j, ang:REMOTE_AIM.ang, pow:REMOTE_AIM.pow, s:V.turn}; }
  R3.arrow.visible=R3.powRing.visible=false;
  if(aim && pos.btn[aim.s] && pos.btn[aim.s][aim.j]){
    const b=pos.btn[aim.s][aim.j], lvl=V.opts.aim;
    if(lvl!=='nada' && aim.pow>0){
      const len = lvl==='larga' ? 8+aim.pow*46 : 4+aim.pow*14;
      R3.arrow.visible=true; R3.arrow.position.set(b.x, .25, -b.y); R3.arrow.rotation.y=aim.ang;
      R3.arrowBody.scale.set(len, 1.1, 1); R3.arrowBody.position.set(BR+len/2, 0, 0);
      R3.arrowHead.position.set(BR+len+1, 0, 0); R3.arrowHead.rotation.z=0;
    }
    R3.powRing.visible=true; R3.powRing.position.set(b.x, .3, -b.y);
    R3.powRing.geometry.dispose(); R3.powRing.geometry=new T.RingGeometry(BR+.6, BR+1.5, 40, 1, Math.PI/2, Math.max(.01, aim.pow)*Math.PI*2);
    R3.powRing.material.color.setHSL(.33-.33*aim.pow, .85, .55);
  }
  // marca qué botones se pueden tirar
  const myTurn=canShootNow() && !AIM.on;
  R3.sel.visible=false;
  if(myTurn){ const s=V.turn, b=pos.ball; let bj=0, bd=1e9; pos.btn[s].forEach((q,j)=>{ const d=Math.hypot(q.x-b.x,q.y-b.y); if(d<bd){ bd=d; bj=j; } });
    const q=pos.btn[s][bj]; R3.sel.visible=true; R3.sel.position.set(q.x, .2, -q.y); const k=1+.12*Math.sin(now/200); R3.sel.scale.set(k,k,1); }
  // la hinchada suena mientras se juega
  if(V.phase==='play' && $('#game').classList.contains('on')){ crowdStart(); if(CROWD.g) CROWD.g.gain.value = .5; } else crowdStop();
  // cámara
  const s=mySideView(), dz = s ? -1 : 1, z=CAM3.zoom, cam=R3.cam, asp=Math.max(.3, Math.min(4, cam.aspect||1)), portrait=asp<1;
  let want, look; cam.up.set(0,1,0);
  if(CAM3.mode==='arriba'){
    const tf=Math.tan(25*Math.PI/180), L=FL+MARG+4, W=FW+MARG+4;
    if(portrait){ want=new T.Vector3(0, Math.max(L/tf, W/(tf*asp))*z, dz*1); cam.up.set(0,0,-dz); }
    else { want=new T.Vector3(0, Math.max(L/(tf*asp), W/tf)*z, 0); cam.up.set(-dz,0,0); }
    look=new T.Vector3(0,0,0);
  } else if(CAM3.mode==='tv'){ want=new T.Vector3((portrait?175:130)*z, (portrait?120:85)*z, 0); look=new T.Vector3(0,0,0); }
  else { const back=(portrait?150:105)*z, hgt=(portrait?150:100)*z; want=new T.Vector3(0, hgt, dz*back); look=new T.Vector3(0, 0, -dz*(portrait?10:18)); }
  if(R3.camMode!==CAM3.mode+'|'+s || !isFinite(cam.position.x+cam.position.y+cam.position.z)){ R3.camMode=CAM3.mode+'|'+s; cam.position.copy(want); R3.camLook=look.clone(); }
  cam.position.lerp(want, .12); R3.camLook.lerp(look, .12); cam.lookAt(R3.camLook);
  // destello del gol
  const fl=R3.flash;
  if(fl && now-fl.at<900){ const k=1-(now-fl.at)/900; R3.scene.fog.color.setRGB(.05+.35*k, .12+.3*k, .1); } else R3.scene.fog.color.setHex(0x0d1f1a);
  R3.renderer.render(R3.scene, cam);
}
function cam3(k, d){
  if(k==='zoom') CAM3.zoom=Math.max(.55, Math.min(1.8, CAM3.zoom*(d>0?.88:1.14)));
  else { CAM3.mode=k; CAM3.auto=false; }
  saveCam3();
}
function loop(){
  requestAnimationFrame(loop);
  if(!V || V.phase==='lobby' || !$('#game').classList.contains('on') || !R3.renderer){ crowdStop(); return; }
  draw3D();
}
requestAnimationFrame(loop);
setTimeout(()=>{ if(!window.THREE) $('#no3d').style.display='flex'; else init3D(); }, 0);

/* ====================== PANEL LATERAL ====================== */
function renderSidePanels(){ if($('#tab-hist').classList.contains('on')) renderHist(); renderMesaTab(); renderReglasTab(); }
let HIST_N=0;
function renderHist(){
  if(!V) return;
  const L=(V.log||[]).slice().reverse(); const fresh=L.length-HIST_N; HIST_N=L.length;
  $('#histList').innerHTML = L.map((l,i)=>`<div class="hline ${i<fresh&&fresh<5?'new':''}">${esc(l.x)}</div>`).join('') || '<p class="muted">Todavía no pasó nada.</p>';
}
function renderMesaTab(){
  const host=amHost(), inPlay=V.phase!=='lobby';
  const ps=V.players.map(p=>{
    const offline=!p.bot&&!p.conn, c=CLUB(p.club);
    return `<div class="prow" style="border-left:5px solid ${p.color}"><span style="font-size:22px">${esc(p.emoji)}</span><span class="nm"><b>${esc(p.name)}${p.id===me()?' (vos)':''}${p.id===V.hostPid&&NET.mode!=='local'?' 👑':''}</b>
      <small>${clubSwatch(c)} ${esc(c.n)}${V.opts.fmt==='parejas'?' · '+TEAMS[p.team].e:''}${V.cups&&V.cups[p.id]?' · '+'🏆'.repeat(V.cups[p.id]):''}${p.bot?' · 🤖 bot':''}${p.mic?' · 🎙️':''}${offline?' · ⚠️ sin conexión':''}${inPlay&&playing(V,p.id)?' · ⚽ jugando':''}</small></span>
      ${host&&p.id!==V.hostPid&&NET.mode!=='local'?`${offline&&inPlay?`<button class="btn sm gray" onclick="doAct({type:'botify',pid:'${p.id}'})" title="Que juegue un bot">🤖</button>`:''}<button class="btn sm gray" onclick="if(confirm('¿Sacar a ${esc(p.name)} de la mesa?'))doAct({type:'kick',pid:'${p.id}'})" title="Sacar">✕</button>`:''}</div>`;
  }).join('');
  const obs=(V.observers||[]).map(o=>`<div class="prow"><span style="font-size:20px">${o.owner?'👑':'👀'}</span><span class="nm"><b>${esc(o.name)}${o.id===me()?' (vos)':''}</b><small>${o.owner?'dueño del juego, ':''}mirando${o.mic?' · 🎙️':''}</small></span></div>`).join('');
  const sit = NET.obs && (V.phase==='lobby'||V.phase==='over') && V.players.length<MAXP ? `<button class="btn gold wide" onclick="doAct({type:'joinNext'})">⚽ Sumarme a jugar</button>` : NET.obs ? `<p class="muted">Te podés sumar cuando termine la partida (si hay lugar).</p>` : '';
  $('#mesaList').innerHTML = `<b>Jugadores (${V.players.length}/${MAXP})</b>` + ps + (obs?`<b>Mirando</b>${obs}`:'') + sit
    + (host && inPlay ? `<button class="btn dark wide" style="margin-top:8px" onclick="if(confirm('¿Terminar la partida y volver a la sala?'))doAct({type:'newGame',force:true})">⚙️ Terminar y volver a la sala</button>` : '')
    + (NET.mode!=='local'&&NET.code?`<p class="muted" style="margin-top:12px">Invitá con el código <b>${NET.code}</b> <button class="btn sm" onclick="shareRoom()">📤 Compartir</button></p>`:'');
}
function renderReglasTab(){
  const o=V.opts, on=HOUSE.filter(h=>o[h.k]), host=amHost();
  $('#reglasList').innerHTML = `<p style="margin-top:0"><b>${esc(FORMATS[o.fmt].t)}</b></p><p class="muted">${esc(FORMATS[o.fmt].d)}</p>`
    + `<p class="muted">${o.size} botones por lado · a ${o.goals} gol${o.goals>1?'es':''}${o.fmt==='rey'?` · ${o.cups} copas`:''} · ${o.time?`⏰ ${o.time} min`:'sin tiempo'} · ${o.toques} toque${o.toques>1?'s':''} por turno${o.turnT?` · ${o.turnT} s para tirar`:''}</p>`
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
  const url=roomLink(), text=`¡Vení a jugar al fútbol de botones conmigo! ⚽🇵🇾 Sala ${NET.code}`;
  if(navigator.share) return navigator.share({title:'Botones PY', text, url}).catch(()=>{});
  modal(`<h2>📤 Invitar a la sala ${NET.code}</h2><p style="word-break:break-all;user-select:all;background:#fff;padding:8px;border-radius:8px">${esc(url)}</p>
    <a class="btn green wide" style="display:block;text-align:center;text-decoration:none" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text+' '+url)}">💬 Mandar por WhatsApp</a>
    <button class="btn wide" style="margin-top:6px" onclick="navigator.clipboard.writeText('${url}').then(()=>toast('Enlace copiado'))">📋 Copiar enlace</button>
    <button class="btn gray wide" style="margin-top:6px" onclick="closeModal()">Cerrar</button>`);
}
function showRules(){
  modal(`<div class="rules"><h2>📜 Cómo se juega</h2>
  <p>Es el fútbol de botones de toda la vida: cada club tiene sus botones en la cancha y un arquero. Por turnos, tirás un botón con el dedo para que le pegue a la pelota y la meta en el arco del otro.</p>
  <h3>👆 Cómo tirar</h3><ul><li>Tocá uno de tus botones y <b>arrastrá para atrás</b>, como una gomera. Cuanto más arrastrás, más fuerte sale. Soltá para tirar.</li>
  <li>Si tu botón <b>le pega a la pelota</b>, seguís tirando hasta gastar los toques del turno (normalmente 3). Si no la toca, le toca al otro.</li>
  <li><b>Cámaras:</b> 🎯 desde tu arco, 🔭 desde arriba (la mejor para apuntar), 📺 como en la tele. Con ＋ y － acercás o alejás.</li></ul>
  <h3>⚽ Reglas</h3><ul><li><b>Saque del medio</b> al empezar y después de cada gol (saca el que lo recibió).</li>
  <li><b>Lateral:</b> si la pelota sale por el costado, saca el otro equipo desde la línea.</li>
  <li><b>Córner y saque de arco:</b> si sale por el fondo, es córner si la tocó último el que defiende ese arco; si no, saque de arco.</li>
  <li><b>Arquero:</b> se mueve solo siguiendo la pelota, o lo movés vos con la regla “Arquero a mano”.</li></ul>
  <h3>🎮 Modos</h3>${Object.keys(FORMATS).map(k=>`<p><b>${FORMATS[k].t}:</b> ${FORMATS[k].d}</p>`).join('')}
  <h3>🏠 Reglas de la casa</h3>${HOUSE.map(h=>`<p><b>${h.t}:</b> ${h.d}</p>`).join('')}
  <h3>🇵🇾 Clubes</h3><p>Están los clubes de Primera División e Intermedia, con sus colores. Cada jugador elige el suyo en la sala de espera. Si los dos usan los mismos colores, el de arriba juega con la camiseta alternativa.</p>
  <p class="muted">Los nombres son de los clubes; los escudos no se usan.</p>
  </div><button class="btn wide" onclick="closeModal()">Entendido</button>`);
}
