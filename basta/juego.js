'use strict';
/* =====================================================================
   Basta PY — red (PeerJS), chat con privados, voz, sala de espera,
   mesa en 3D, planillas, revisión de palabras y sonidos.
   ===================================================================== */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function store(k,v){ try{ if(v===undefined) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
function load(k){ try{ const v=localStorage.getItem(k); return v==null?null:JSON.parse(v); }catch(e){ return null; } }
function toast(x){ const t=$('#toast'); t.textContent=x; t.style.display='block'; clearTimeout(toast.t); toast.t=setTimeout(()=>t.style.display='none', 3800); }
const PREFIX='bastapy26-';
const genCode = () => { const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s=''; for(let i=0;i<5;i++) s+=A[rnd(A.length)]; return s; };
let myToken=load('basta_token'); if(!myToken){ myToken=Math.random().toString(36).slice(2)+Date.now().toString(36); store('basta_token', myToken); }
const NET={mode:null, peer:null, code:null, conns:{}, hostConn:null, myPid:null, obs:null, welcomed:false};
let CHAT=[], V=null;
const me = () => NET.myPid || NET.obs;
const amHost = () => NET.mode==='local' || (V && V.hostPid===NET.myPid && NET.mode==='host');
const VP = id => V && (V.players.find(p=>p.id===id) || (V.observers||[]).find(o=>o.id===id));
// ¿este aparato maneja a ese jugador? (en la partida local, todos los que no son bots)
const mine = pid => pid && (pid===me() || (NET.mode==='local' && V && V.players.some(p=>p.id===pid && !p.bot)));

/* ====================== MENÚ ====================== */
let myEmojiSel = load('basta_emoji') || EMOJIS[0];
const myName = () => ($('#myName').value.trim() || 'Jugador').slice(0,16);
const myEmoji = () => myEmojiSel;
$('#myName').value = load('basta_name') || '';
$('#myName').addEventListener('input', ()=>store('basta_name', $('#myName').value.trim()));
function renderTokenPicker(){ $('#tokens').innerHTML = EMOJIS.map(e=>`<button class="tok ${e===myEmojiSel?'sel':''}" onclick="pickEmoji('${e}')">${e}</button>`).join(''); }
function pickEmoji(e){ myEmojiSel=e; store('basta_emoji', e); renderTokenPicker(); }
renderTokenPicker();
function needName(){ if(!$('#myName').value.trim()){ toast('Escribí tu nombre primero ✍️'); $('#myName').focus(); return true; } store('basta_name', myName()); return false; }
function joinClick(){ const code=$('#joinCode').value.trim().toUpperCase(); if(!code) return toast('Escribí el código de la sala.'); if(needName()) return; clientJoin(code); }
function resumeClick(){
  const h=load('basta_host'), c=load('basta_client');
  if(h && (!c || h.at>=c.at)) return hostStart(true);
  if(c){ if(needName()) return; clientJoin(c.code); }
}
function refreshResume(){ const h=load('basta_host'), c=load('basta_client'), ok=x=>x && Date.now()-x.at<6*3600e3; $('#btnResume').style.display = ok(h)||ok(c) ? 'block' : 'none'; }
refreshResume();
(function(){
  const m=(location.hash.slice(1) || new URLSearchParams(location.search).get('sala') || '').toUpperCase();
  if(/^[A-Z0-9]{4,6}$/.test(m)){ $('#joinCode').value=m;
    if(new URLSearchParams(location.search).get('dueno')){ if(!$('#myName').value.trim()) $('#myName').value='Dueño'; setTimeout(()=>clientJoin(m), 300); }
    else toast('Te invitaron a la sala '+m+': escribí tu nombre y tocá “Entrar”.'); }
})();
const savedOpts = () => Object.assign(defaultOpts(), load('basta_opts')||{});

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
  sysChat('✏️ Mesa en este aparato. Sumá bots 🤖, elegí las reglas y tocá Empezar.');
  ANIM.lastN=null; commit(); renderChat();
}
function leaveClick(){
  if(NET.mode==='local'){ if(S && S.phase==='play' && !confirm('¿Salir de la partida?')) return; return leaveToMenu(); }
  if(!confirm('¿Salir de la sala?')) return;
  if(NET.mode==='host'){
    const others=hostCandidates(S);
    if(others.length) return hostHandover();
    store('basta_host', undefined);
  } else if(NET.mode==='client'){
    if(NET.hostConn && NET.hostConn.open && NET.myPid) try{ NET.hostConn.send({t:'act', a:{type:'leave'}}); }catch(e){}
    store('basta_client', undefined);
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
function lightShot(){}
function publicState(forPid){
  const s=JSON.parse(JSON.stringify(S));
  s.players.forEach(p=>delete p.token);
  (s.observers||[]).forEach(o=>delete o.token);
  delete s.ownerTok;
  s.clock=Date.now();   // para que el reloj y el abecedario se vean igual en todos los aparatos
  // mientras se escribe, de las planillas ajenas solo se sabe qué casillas están llenas
  if(s.phase==='write' || s.phase==='spin' || s.phase==='abc' || s.phase==='pick'){
    const mySide=sideOf(s, forPid), local=NET.mode==='local';
    s.sheets=(s.sheets||[]).map((sh,si)=> si===mySide || (local && s.sides[si].pids.some(id=>{ const p=s.players.find(x=>x.id===id); return p && !p.bot; })) ? sh : sh.map(x=>String(x).trim()?'•':''));
  }
  return s;
}
function commit(){
  lightShot();
  if(NET.mode==='host'){
    for(const pid in NET.conns){ const c=NET.conns[pid]; if(c && c.open) try{ c.send({t:'state', s:publicState(pid)}); }catch(e){} }
    sendBackups();
    if(!NET.noSave){ const s=JSON.parse(JSON.stringify(S)); if(s.shot) s.shot={n:s.shot.n, res:s.shot.res, stale:true}; store('basta_host', {code:NET.code, S:s, CHAT:CHAT.slice(-80), myPid:NET.myPid, at:Date.now()}); }
  }
  if(S && (NET.mode==='host'||NET.mode==='local') && S.phase==='lobby') store('basta_opts', S.opts);
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
  const saved = resume ? load('basta_host') : null;
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
    if(resume){ toast('La sala sigue abierta en otro aparato (otro jugador quedó de anfitrión). Entrá con el código.'); peer.destroy(); store('basta_host',undefined); NET.mode=null; $('#joinCode').value=NET.code; return; }
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
  store('basta_host', undefined);
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
  NET.noSave=true; store('basta_host', undefined);
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
      if(!NET.welcomed){ toast('No se encontró la sala '+code+'. Revisá el código.'); store('basta_client',undefined); leaveToMenu(); }
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
    store('basta_client',{code:NET.code, at:Date.now()}); if(location.hash!=='#'+NET.code) history.replaceState(null,'','#'+NET.code);
    if(d.why) toast(d.why);
  }
  else if(d.t==='state'){ S=d.s; if(S.clock) CLK.off=S.clock-Date.now(); render(); }
  else if(d.t==='chat'){ CHAT.push(d.m); renderChat(d.m); }
  else if(d.t==='chatlog'){ CHAT=d.list||[]; renderChat(); }
  else if(d.t==='backup'){ NET.backup={s:d.s, chat:d.chat}; }
  else if(d.t==='migrate'){ NET.backup={s:d.s, chat:d.chat}; takeoverHost('handover'); }
  else if(d.t==='kicked'){ toast('🚪 El anfitrión te sacó de la mesa.'); store('basta_client',undefined); leaveToMenu(); }
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

/* ====================== SONIDOS ====================== */
const SND={on:load('basta_snd')!==false, ctx:null};
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
  spin(){ for(let i=0;i<14;i++) tone(500+rnd(500),.04,'triangle',.05,i*.13); },
  letter(){ tone(660,.12,'sine',.14); tone(990,.25,'sine',.14,.1); },
  tick(){ tone(1400,.03,'square',.04); },
  abc(){ tone(900,.02,'square',.025); },
  write(){ noise(.06,.05,0,3000); },
  basta(){ const c=actx(); if(!SND.on||!c) return; [0,.18].forEach(d=>{ const o=c.createOscillator(), g=c.createGain(), t=c.currentTime+d; o.type='sawtooth'; o.frequency.setValueAtTime(440,t); o.frequency.linearRampToValueAtTime(330,t+.22); g.gain.setValueAtTime(.12,t); g.gain.exponentialRampToValueAtTime(.001,t+.3); o.connect(g).connect(c.destination); o.start(t); o.stop(t+.32); }); },
  stop(){ noise(.15,.25,0,0,800); tone(220,.3,'square',.08); },
  turn(){ tone(740,.12,'sine',.12); tone(988,.18,'sine',.12,.11); },
  good(){ [659,880,1175].forEach((f,i)=>tone(f,.22,'triangle',.12,i*.09)); },
  bad(){ tone(300,.2,'sawtooth',.06); tone(200,.3,'sawtooth',.06,.18); },
  win(){ [523,659,784,1047].forEach((f,i)=>tone(f,.3,'triangle',.14,i*.13)); },
  priv(){ tone(1200,.08,'sine',.08); tone(1500,.1,'sine',.08,.08); },
};
function toggleSound(){ SND.on=!SND.on; store('basta_snd', SND.on); $('#btnSnd').textContent=SND.on?'🔊':'🔇'; if(SND.on) sfx.turn(); }
$('#btnSnd').textContent=SND.on?'🔊':'🔇';
document.addEventListener('pointerdown', ()=>actx(), {once:true});
const MUSIC_CREDIT = 'Música: "Monkeys Spinning Monkeys" de Kevin MacLeod (incompetech.com). Licencia Creative Commons Atribución 4.0: creativecommons.org/licenses/by/4.0/';
const MUSIC = { on: load('basta_music')===true, buf:null, src:null, gain:null, loading:false, VOL:.07 };
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
function toggleMusic(){ MUSIC.on=!MUSIC.on; store('basta_music', MUSIC.on); musicSync(); toast(MUSIC.on?'🎶 Música de fondo prendida (suave).':'🔕 Música de fondo apagada.'); }
function renderMusicBtn(){ $$('.btnMusic').forEach(b=>{ b.textContent = MUSIC.on ? '🎶' : '🔕'; b.title = MUSIC.on ? 'Apagar la música de fondo' : 'Prender la música de fondo'; }); }
renderMusicBtn(); $('#musicCredit').textContent='🎶 '+MUSIC_CREDIT;



/* ====================== RENDER GENERAL ====================== */
const CLK={off:0}, ANIM={on:false, lastN:null};
const hostMs = () => Date.now() + (NET.mode==='client' ? CLK.off : 0);
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
    + `${host&&NET.mode!=='local'?'👑':''}${p.bot?'🤖':''}${p.mic?'🎙️':''}${!p.bot&&!p.conn?'⚠️':''}`;
}
const mySide = () => V ? sideOf(V, NET.myPid) : -1;

// ---------- sala de espera ----------
function renderLobby(){
  const host=amHost(), myObs=!!NET.obs, o=V.opts, eq=o.fmt==='eq';
  $('#lobbyCode').textContent=NET.code||'—';
  $('#lobbyCodeBox').style.display = NET.mode==='local' ? 'none' : '';
  $('#lobbyTitle').textContent = NET.mode==='local' ? '✏️ Mesa en este aparato' : '✏️ Sala de espera';
  $('#pcount').textContent=`(${V.players.length}/${MAXP})`;
  const teamBtn = p => eq ? `<button class="tbtn" style="background:${TEAMS[p.team].c}" ${host||p.id===me()?`onclick="doAct({type:'team',pid:'${p.id}'})"`:'disabled'} title="Cambiar de equipo">${TEAMS[p.team].e}</button>` : '';
  $('#plist').innerHTML=V.players.map(p=>`<li>${teamBtn(p)}${playerTag(p)}${host && p.id!==V.hostPid?`<button class="btn sm gray" onclick="doAct({type:'kick',pid:'${p.id}'})" title="Sacar">✕</button>`:''}</li>`).join('')
    + (V.observers||[]).map(x=>`<li style="opacity:.75"><span style="font-size:20px">👀</span><span class="nm">${esc(x.name)} <span class="muted">mirando</span></span>${x.mic?'🎙️':''}</li>`).join('');
  const err=canStartV();
  $('#lobbyHostBtns').innerHTML = host
    ? `<div class="row"><button class="btn gray" onclick="doAct({type:'addBot'})" ${V.players.length>=MAXP?'disabled':''}>🤖 Sumar bot</button>
       <button class="btn green" onclick="doAct({type:'start'})">▶️ Empezar</button></div>
       <p class="muted">${err?'⚠️ '+esc(err):'¡Listo para empezar!'}${eq?' · Tocá el color al lado de cada nombre para cambiarlo de equipo.':''}</p>`
    : `<p class="muted" style="text-align:center">⏳ Esperando que el anfitrión 👑 empiece la partida…${eq?'<br>Tocá tu color para cambiarte de equipo.':''}</p>`;
  $('#lobbyObs').innerHTML = myObs ? `<div class="obsbar" style="border-radius:10px;margin-top:8px">👀 Estás mirando. ${V.players.length<MAXP?`<button class="btn sm gold" onclick="doAct({type:'joinNext'})">✏️ Sentarme a jugar</button>`:'La mesa está llena.'}</div>` : '';
  const ob=$('#optsBox'), fa=document.activeElement;
  if(!(fa && ob.contains(fa) && fa.tagName==='TEXTAREA')) ob.innerHTML = optsHTML(host);
  const g=$('#grulesBox');
  if(host){
    if(!g.querySelector('textarea')) g.innerHTML=`<textarea id="grulesIn" maxlength="1200" placeholder="Ej.: los nombres de famosos valen doble ⭐&#10;El que pierde ceba el tereré 🧉"></textarea><p class="muted" style="margin:4px 0 0">Se guarda solo y lo ven todos.</p>`;
    const ta=$('#grulesIn'); if(document.activeElement!==ta) ta.value=V.grules||'';
    ta.oninput=()=>{ clearTimeout(ta.t); ta.t=setTimeout(()=>doAct({type:'grules', text:ta.value}), 600); };
  } else g.innerHTML = V.grules ? `<div class="grules">${esc(V.grules)}</div>` : `<p class="muted">El anfitrión todavía no escribió reglas propias.</p>`;
  $('#sugBox').innerHTML = sugsHTML(host);
}
function canStartV(){ const keep=S; S=V; try{ return canStart(); } finally{ S=keep; } }
function optsHTML(host){
  const o=V.opts, dis = host && V.phase==='lobby' ? '' : 'disabled';
  const sel=(k, list)=>`<select ${dis} onchange="doAct({type:'opt',k:'${k}',v:this.value})">${list.map(x=>`<option value="${x.v}" ${o[k]==x.v?'selected':''}>${x.t}</option>`).join('')}</select>`;
  const chk=(k, t, d)=>`<label class="opt" style="margin:0 0 6px;font-weight:400"><input type="checkbox" ${o[k]?'checked':''} ${dis} onchange="doAct({type:'opt',k:'${k}',v:this.checked})"><span><b>${t}</b><small>${d}</small></span></label>`;
  const obj=O=>Object.keys(O).map(k=>({v:k, t:O[k].t||O[k]}));
  const cats=catsOf(o);
  return `<label style="margin-top:0">📋 Categorías ${host?'':'<span class="muted">(las elige el anfitrión)</span>'}</label>${sel('preset', obj(PRESETS))}
    ${o.preset==='propia'?`<textarea ${dis} maxlength="400" placeholder="Separadas por comas: Nombre, Animal, Cantante…" onchange="doAct({type:'opt',k:'custom',v:this.value})">${esc(o.custom)}</textarea><p class="muted" style="margin:4px 0 0">De 2 a 12 categorías, separadas por comas. Los bots solo contestan las que conocen.</p>`:''}
    <div class="chips">${cats.map(c=>`<span>${esc(c)}</span>`).join('')}</div>
    <label>🧮 Cómo se cuentan los puntos</label>${sel('score', obj(SCORES))}<p class="muted" style="margin:4px 0 0">${esc(SCORES[o.score].d)}</p>
    <label>🔤 Cómo sale la letra</label>${sel('pick', obj(PICKS))}<p class="muted" style="margin:4px 0 0">${esc(PICKS[o.pick].d)}</p>
    <label>Cómo se juega</label>${sel('fmt', Object.keys(FORMATS).map(k=>({v:k, t:FORMATS[k]})))}
    <label>🔁 Largo de la partida</label>${sel('rounds', ROUNDS)}
    <label>⏰ Tiempo por ronda</label>${sel('timer', TIMERS)}
    <label>✋ Después del ¡BASTA!, los demás tienen</label>${sel('count', COUNTS)}
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

/* ====================== PARTIDA ====================== */
let PREV={phase:null, round:0, basta:null};
function renderGame(){
  $('#roomTag').textContent = NET.mode==='local' ? '📱 En este aparato' : '🔑 '+NET.code;
  $('#obsbar').style.display = NET.obs ? 'block' : 'none';
  if(NET.obs) $('#obsbar').textContent = '👀 Estás mirando la partida.';
  // avisos y sonidos cuando cambia algo
  if(PREV.phase!==null){
    if(V.phase!==PREV.phase || V.round!==PREV.round){
      if(V.phase==='spin'){ sfx.spin(); }
      else if(V.phase==='write'){ sfx.letter(); bigText(`Letra ${V.letter}`); R3.flipAt=performance.now(); }
      else if(V.phase==='review'){ sfx.stop(); flushWrites(); banner('📝 ¡Lápiz abajo! Revisen las palabras.', ''); }
      else if(V.phase==='roundEnd'){ sfx.good(); }
      else if(V.phase==='abc' || V.phase==='pick'){ if(chooserPid(V)===NET.myPid && !NET.obs){ sfx.turn(); yourTurn(V.phase==='abc'?'🔤 ¡Te toca frenar el abecedario!':'👉 ¡Te toca elegir la letra!'); } }
    }
    if(V.bastaBy && V.bastaBy!==PREV.basta){ const p=V.players.find(x=>x.id===V.bastaBy); sfx.basta(); bigText('✋ ¡BASTA!'); banner(`${p?p.name:'?'} gritó ¡BASTA!${V.opts.count?` · ${V.opts.count} segundos más`:''}`, 'bad'); R3.pressAt=performance.now(); }
  }
  PREV={phase:V.phase, round:V.round, basta:V.bastaBy};
  renderScore(); renderPanel(); endModal();
}
// ---------- tabla de puntos ----------
function roundPts(st, si){ return st.res && st.res[si] ? st.res[si].reduce((a,x)=>a+x.pts,0) : null; }
function renderScore(){
  const rows=V.sides.map((s,si)=>{
    const color = s.team!=null ? TEAMS[s.team].c : (V.players.find(p=>p.id===s.pids[0])||{}).color||'#888';
    const names = s.team!=null ? `${TEAMS[s.team].e} ${s.pids.map(pid=>{ const p=V.players.find(x=>x.id===pid); return p?esc(p.name):''; }).join(', ')}` : (()=>{ const p=V.players.find(x=>x.id===s.pids[0])||{}; return `${esc(p.emoji||'')} ${esc(p.name||'?')}${p.bot?'🤖':''}${!p.bot&&p.conn===false?'⚠️':''}${p.mic?'🎙️':''}`; })();
    let st='';
    if(V.phase==='write') st=`✏️ ${filled(V,si)}/${V.cats.length}`;
    else if(V.phase==='review') st=`+${roundPts(V,si)}`;
    else if(V.phase==='roundEnd' || V.phase==='over') st=`+${s.pts[s.pts.length-1]||0}`;
    const basta = V.bastaBy && s.pids.includes(V.bastaBy) ? ' ✋' : '';
    return `<tr class="${si===mySide()?'me':''}" style="--pc:${color}"><td class="nmc">${names}${basta}</td><td class="st">${st}</td><td class="tt">${s.total}</td></tr>`;
  }).join('');
  $('#score').innerHTML=`<table class="board">${rows}</table>`;
}
// ---------- panel de abajo (la planilla para escribir, la revisión, etc.) ----------
const FORM={key:null, timers:{}, pend:{}};
function sendWrite(k){ const v=FORM.pend[k]; if(v==null) return; delete FORM.pend[k]; clearTimeout(FORM.timers[k]); doAct({type:'write', k, v}); }
function flushWrites(){ Object.keys(FORM.pend).forEach(k=>sendWrite(+k)); }
function timeLeft(){ return V && V.endsAt ? Math.max(0, Math.ceil((V.endsAt-hostMs())/1000)) : null; }
function canWrite(){ return V && V.phase==='write' && mySide()>=0 && !NET.obs && (!V.endsAt || hostMs()<V.endsAt); }
function renderPanel(){
  const el=$('#panel'), ph=V.phase, si=mySide();
  if(ph==='write' && si>=0 && !NET.obs){
    const key=V.round+'|'+V.letter;
    if(FORM.key!==key){
      FORM.key=key; FORM.pend={};
      el.innerHTML=`<div class="wtop"><div class="bigL">${esc(V.letter)}</div><div class="winfo"><b>${V.opts.alreves?'Terminan':'Empiezan'} con ${esc(V.letter)}</b><span id="wtimer"></span></div><button class="btn red basta" id="btnBasta" onclick="basta()">✋ ¡BASTA!</button></div>
        <div class="fields">${V.cats.map((c,k)=>`<label class="fld"><span>${esc(c)}</span><input data-k="${k}" maxlength="40" autocomplete="off" autocorrect="off" spellcheck="false" autocapitalize="sentences" enterkeyhint="next"></label>`).join('')}</div>`;
      el.querySelectorAll('input').forEach(inp=>{
        const k=+inp.dataset.k;
        inp.addEventListener('input', ()=>{ if(!canWrite()) return; FORM.pend[k]=inp.value; if(V.sheets[si]) V.sheets[si][k]=inp.value; clearTimeout(FORM.timers[k]); FORM.timers[k]=setTimeout(()=>sendWrite(k), 350); sfx.write(); paintBasta(); R3.sheetKey=null; });
        inp.addEventListener('blur', ()=>sendWrite(k));
        inp.addEventListener('keydown', e=>{ e.stopPropagation(); if(e.key==='Enter'){ e.preventDefault(); const nx=el.querySelector(`input[data-k="${k+1}"]`); if(nx) nx.focus(); else inp.blur(); } });
      });
      setTimeout(()=>{ const f=el.querySelector('input'); if(f && window.innerWidth>=1000) f.focus(); }, 300);
    }
    // lo que escribió el compañero de equipo
    el.querySelectorAll('input').forEach(inp=>{ const k=+inp.dataset.k; if(document.activeElement!==inp && FORM.pend[k]==null) inp.value=(V.sheets[si]||[])[k]||''; inp.disabled=!canWrite(); });
    paintBasta(); paintTimer();
    return;
  }
  FORM.key=null;
  const host=amHost(), chooser=V.players.find(p=>p.id===chooserPid(V));
  if(ph==='write'){ el.innerHTML=`<div class="wait"><div class="bigL">${esc(V.letter)}</div><p>👀 Están escribiendo… <span id="wtimer"></span></p></div>`; paintTimer(); return; }
  if(ph==='spin'){ el.innerHTML=`<div class="wait"><p style="font-size:20px">🌼 Girando las letras del ñandutí…</p></div>`; return; }
  if(ph==='abc'){
    const mineC = chooserPid(V)===NET.myPid && !NET.obs;
    el.innerHTML=`<div class="wait"><div class="bigL" id="abcL">?</div>${mineC?`<button class="btn red basta" onclick="doAct({type:'stopAbc'})">✋ ¡STOP!</button><p>Las letras pasan rapidito: frenalas cuando quieras.</p>`:`<p>🔤 <b>${esc(chooser?chooser.name:'?')}</b> está por frenar el abecedario…</p>`}</div>`;
    return;
  }
  if(ph==='pick'){
    const mineC = chooserPid(V)===NET.myPid && !NET.obs, L=lettersLeft(V);
    el.innerHTML = mineC ? `<div class="wait"><p>👉 Elegí la letra de esta ronda:</p><div class="letters">${(V.opts.dificiles?EASY.concat(HARD):EASY).map(l=>`<button ${L.includes(l)?'':'disabled'} onclick="doAct({type:'pickL',l:'${l}'})">${l}</button>`).join('')}</div></div>`
      : `<div class="wait"><p>👉 <b>${esc(chooser?chooser.name:'?')}</b> está eligiendo la letra…</p></div>`;
    return;
  }
  if(ph==='review'){
    const n=V.players.filter(p=>!p.bot && p.conn).length, rd=V.ready.length, iReady=V.ready.includes(NET.myPid);
    el.innerHTML=`<div class="rtop"><div class="bigL">${esc(V.letter)}</div><p>📝 Revisen las palabras. Tocá 👎 en las que no valen: se anulan con la mitad de los votos de los demás.</p></div>
      <div class="review">${reviewHTML()}</div>
      <div class="row rbtns">${!NET.obs?`<button class="btn ${iReady?'gray':'green'}" onclick="doAct({type:'ready'})">${iReady?'↩️ Todavía no':'✅ Listo'} (${rd}/${n})</button>`:''}${host?`<button class="btn" onclick="doAct({type:'count'})">🧮 Contar los puntos ya</button>`:''}</div>`;
    return;
  }
  if(ph==='roundEnd' || ph==='over'){
    const list=V.sides.map((s,si)=>({si, r:s.pts[s.pts.length-1]||0, t:s.total})).sort((a,b)=>b.t-a.t);
    el.innerHTML=`<div class="rtop"><div class="bigL">${esc(V.letter||'')}</div><p>${ph==='over'?'🏆 ¡Terminó la partida!':`🧮 Fin de la ronda ${V.round}${V.opts.rounds?` de ${V.opts.rounds}`:''}`}</p></div>
      <table class="score">${list.map((x,i)=>`<tr><td>${i===0?'🥇':i===1?'🥈':i===2?'🥉':''} ${esc(sideName(V,x.si))}</td><td style="text-align:right">+${x.r}</td><td style="text-align:right"><b>${x.t}</b></td></tr>`).join('')}</table>
      <div class="review">${reviewHTML(true)}</div>
      ${ph==='roundEnd' ? (host?`<button class="btn green wide" onclick="doAct({type:'next'})">▶️ Siguiente ronda</button><p class="muted">Si no, sigue sola en unos segundos.</p>`:`<p class="muted">La próxima ronda arranca en unos segundos…</p>`)
        : (host?`<button class="btn green wide" onclick="doAct({type:'rematch'})">🔁 Revancha</button><button class="btn wide" style="margin-top:6px" onclick="doAct({type:'newGame'})">⚙️ Volver a la sala</button>`:`<p class="muted">El anfitrión elige si hay revancha.</p>`)}`;
  }
}
function reviewHTML(done){
  if(!V.res) return '';
  const mine=mySide();
  return V.cats.map((c,k)=>`<div class="rcat"><h4>${esc(c)}</h4>${V.sides.map((s,si)=>{
    const r=V.res[si][k], can=!done && !NET.obs && si!==mine && mine>=0, voted=(V.votes[si]&&V.votes[si][k]||[]).includes(NET.myPid);
    const cls = !r.txt ? 'empty' : !r.ok ? 'bad' : r.dup ? 'dup' : 'ok';
    const why = !r.txt ? '—' : !r.ok ? '✗ '+r.why : r.dup ? '👯 repetida' : '✓';
    return `<div class="rw ${cls}"><span class="who">${esc(sideName(V,si))}</span><span class="w">${esc(r.txt||'')}</span><small>${why}</small><b>${r.pts?'+'+r.pts:'0'}</b>${can&&r.txt?`<button class="veto ${voted?'on':''}" onclick="doAct({type:'veto',si:${si},k:${k}})" title="No vale">👎${r.votes?' '+r.votes:''}</button>`:(r.votes&&!done?`<span class="muted">👎${r.votes}</span>`:'')}</div>`;
  }).join('')}</div>`).join('');
}
function paintBasta(){
  const b=$('#btnBasta'); if(!b) return; const si=mySide(), n=filled(V,si), tot=V.cats.length;
  const ok = !V.bastaBy && canWrite() && (V.opts.completo ? n===tot : n>0);
  b.disabled=!ok; b.textContent = V.bastaBy ? '✋ ¡Ya gritaron!' : V.opts.completo && n<tot ? `✋ ¡BASTA! (${n}/${tot})` : '✋ ¡BASTA!';
}
function paintTimer(){
  const t=$('#wtimer'); if(!t) return; const s=timeLeft();
  t.textContent = s==null ? '' : `⏰ ${s} s`; t.classList.toggle('hurry', s!=null && s<=10);
}
function basta(){ if(!canWrite()) return; flushWrites(); doAct({type:'basta'}); }
setInterval(()=>{
  if(!V || !$('#game').classList.contains('on')) return;
  if(V.phase==='write'){
    paintTimer(); const s=timeLeft();
    if(s!=null && s<=5 && s!==paintTimer.last){ paintTimer.last=s; if(s>0) sfx.tick(); }
    if(s===0 && FORM.key){ flushWrites(); $$('#panel input').forEach(i=>i.disabled=true); paintBasta(); }
  }
}, 200);
function banner(t, cls){ const b=$('#banner'); b.className='banner '+(cls||''); b.textContent=t; b.style.display='block'; clearTimeout(banner.t); banner.t=setTimeout(()=>b.style.display='none', 3200); }
function bigText(t){ const d=document.createElement('div'); d.className='bigtext'; d.textContent=t; $('#stage').appendChild(d); setTimeout(()=>d.remove(), 2200); }
function yourTurn(t){ const d=document.createElement('div'); d.className='yourturn'; d.textContent=t||'✏️ ¡Te toca!'; document.body.appendChild(d); setTimeout(()=>d.remove(),1900); }
let ENDSHOWN=null;
function endModal(){
  if(!V || V.phase!=='over' || !V.win){ if(ENDSHOWN && V && V.phase!=='over'){ ENDSHOWN=null; closeModal(); } return; }
  const key='over|'+V.win.at; if(ENDSHOWN===key) return; ENDSHOWN=key;
  const w=V.win, host=amHost(), iWon=w.ties.some(i=>V.sides[i].pids.some(pid=>mine(pid)));
  if(iWon) sfx.win();
  const list=V.sides.map((s,si)=>({si, t:s.total, pts:s.pts})).sort((a,b)=>b.t-a.t);
  modal(`<h2>🏆 ¡Terminó el Basta!</h2><p style="font-size:18px"><b>${esc(w.ties.map(i=>sideName(V,i)).join(' y '))}</b> ${w.tie?'empatan':'gana'} con <b>${w.pts}</b> puntos 🎉</p>
    <table class="score">${list.map((x,i)=>`<tr><td>${i===0?'🥇':i===1?'🥈':i===2?'🥉':''} ${esc(sideName(V,x.si))}</td><td class="muted">${x.pts.join(' · ')}</td><td style="text-align:right"><b>${x.t}</b></td></tr>`).join('')}</table>
    <p class="muted">Letras: ${esc(V.used.join(' · '))}</p>
    ${host?`<button class="btn green wide" onclick="closeModal();doAct({type:'rematch'})">🔁 Revancha</button><button class="btn wide" style="margin-top:6px" onclick="closeModal();doAct({type:'newGame'})">⚙️ Volver a la sala (cambiar reglas)</button>`:`<p class="muted">El anfitrión elige si hay revancha.</p>`}
    <button class="btn gray wide" style="margin-top:6px" onclick="closeModal()">Mirar la mesa</button>`);
}

/* ====================== MESA 3D ====================== */
const R3={renderer:null, seats:[], seatKey:null, sheetKey:null};
const CAM3=Object.assign({mode:'silla', yaw:0, pitch:0, zoom:1}, load('basta_cam3')||{});
function saveCam3(){ store('basta_cam3', {mode:CAM3.mode, zoom:CAM3.zoom}); }
const TY=74, TR=72;    // alto y radio de la mesa (cm)
const stage=$('#stage'), cv3=$('#c3d');
function resizeStage(){
  const r=stage.getBoundingClientRect();
  if(R3.renderer){ R3.renderer.setSize(r.width, r.height, false); R3.cam.aspect=r.width/Math.max(1,r.height); R3.cam.updateProjectionMatrix(); }
}
window.addEventListener('resize', ()=>{ if($('#game').classList.contains('on')) resizeStage(); });
function canvasTex(w, h, draw){ const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'), w, h); const t=new THREE.CanvasTexture(c); t.anisotropy=4; return t; }
const HAND='"Segoe Print","Bradley Hand","Comic Sans MS","Chalkboard SE",cursive';
function init3D(){
  if(R3.renderer || !window.THREE) return !!R3.renderer;
  const T=THREE;
  let renderer;
  try{ renderer=new T.WebGLRenderer({canvas:cv3, antialias:true}); }catch(e){ $('#no3d').style.display='flex'; return false; }
  const mobile=/Android|iPhone|iPad/i.test(navigator.userAgent);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, mobile?1.5:2));
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=T.PCFSoftShadowMap;
  const scene=new T.Scene();
  scene.background=canvasTex(4, 256, (g,w,h)=>{ const gr=g.createLinearGradient(0,0,0,h); gr.addColorStop(0,'#1d2a55'); gr.addColorStop(.5,'#6b3f6e'); gr.addColorStop(1,'#e8955a'); g.fillStyle=gr; g.fillRect(0,0,w,h); });
  scene.fog=new T.Fog(0x4a3456, 500, 1300);
  const cam=new T.PerspectiveCamera(50, 1, 1, 4000);
  Object.assign(R3, {renderer, scene, cam, T});
  scene.add(new T.HemisphereLight(0xffe7c8, 0x2a1d2e, .55));
  const lamp=new T.PointLight(0xffd9a0, 1.1, 600, 1.6); lamp.position.set(0, TY+150, 0); lamp.castShadow=true; lamp.shadow.mapSize.set(mobile?512:1024, mobile?512:1024); lamp.shadow.bias=-.002; scene.add(lamp);
  // piso de baldosas
  const floor=new T.Mesh(new T.PlaneGeometry(1600,1600), new T.MeshStandardMaterial({roughness:.9, map:(()=>{ const t=canvasTex(256,256,(g,w,h)=>{ g.fillStyle='#a5532f'; g.fillRect(0,0,w,h); g.strokeStyle='#7a3a20'; g.lineWidth=6; for(let i=0;i<=4;i++){ g.beginPath(); g.moveTo(i*64,0); g.lineTo(i*64,h); g.stroke(); g.beginPath(); g.moveTo(0,i*64); g.lineTo(w,i*64); g.stroke(); } for(let i=0;i<300;i++){ g.fillStyle=`rgba(0,0,0,${Math.random()*.08})`; g.fillRect(Math.random()*w, Math.random()*h, 3, 3); } }); t.wrapS=t.wrapT=T.RepeatWrapping; t.repeat.set(20,20); return t; })()}));
  floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; scene.add(floor);
  // mesa de madera
  const wood=canvasTex(512,512,(g,w,h)=>{ g.fillStyle='#8a5a32'; g.fillRect(0,0,w,h); for(let i=0;i<90;i++){ g.strokeStyle=`rgba(${Math.random()<.5?'60,30,10':'190,130,80'},${.08+Math.random()*.12})`; g.lineWidth=1+Math.random()*3; g.beginPath(); const y=Math.random()*h; g.moveTo(0,y); g.bezierCurveTo(w*.3,y+Math.random()*20-10,w*.6,y+Math.random()*20-10,w,y+Math.random()*16-8); g.stroke(); } });
  const top=new T.Mesh(new T.CylinderGeometry(TR, TR, 4, 64), new T.MeshStandardMaterial({map:wood, roughness:.5})); top.position.y=TY-2; top.receiveShadow=true; top.castShadow=true; scene.add(top);
  const cloth=new T.Mesh(new T.CylinderGeometry(TR*.42, TR*.42, .3, 48), new T.MeshStandardMaterial({color:0xfaf3e0, roughness:.9, map:canvasTex(256,256,(g,w,h)=>{ g.fillStyle='#faf3e0'; g.fillRect(0,0,w,h); g.strokeStyle='#d52b1e'; g.lineWidth=6; g.beginPath(); g.arc(w/2,h/2,w/2-10,0,7); g.stroke(); g.strokeStyle='#0038a8'; g.beginPath(); g.arc(w/2,h/2,w/2-22,0,7); g.stroke(); for(let a=0;a<24;a++){ g.fillStyle=a%2?'#d52b1e':'#0038a8'; g.beginPath(); g.arc(w/2+Math.cos(a/24*6.283)*(w/2-40), h/2+Math.sin(a/24*6.283)*(h/2-40), 4, 0, 7); g.fill(); } })}));
  cloth.position.y=TY+.2; cloth.receiveShadow=true; scene.add(cloth);
  const leg=new T.Mesh(new T.CylinderGeometry(6, 10, TY-4, 16), new T.MeshStandardMaterial({color:0x5a3a20, roughness:.6})); leg.position.y=(TY-4)/2; leg.castShadow=true; scene.add(leg);
  const foot=new T.Mesh(new T.CylinderGeometry(30, 34, 4, 32), new T.MeshStandardMaterial({color:0x5a3a20})); foot.position.y=2; scene.add(foot);
  // lámpara colgante
  const shade=new T.Mesh(new T.ConeGeometry(30, 22, 32, 1, true), new T.MeshStandardMaterial({color:0x2a9d3f, side:T.DoubleSide, roughness:.5, emissive:0x0a2a10})); shade.position.y=TY+165; scene.add(shade);
  const bulb=new T.Mesh(new T.SphereGeometry(5, 16, 12), new T.MeshBasicMaterial({color:0xfff2c0})); bulb.position.y=TY+156; scene.add(bulb);
  const cord=new T.Mesh(new T.CylinderGeometry(.4,.4,200,6), new T.MeshBasicMaterial({color:0x111111})); cord.position.y=TY+276; scene.add(cord);
  // tablero de ñandutí en el medio: las letras alrededor como pétalos
  const board=new T.Group(); board.position.y=TY; scene.add(board); R3.board=board;
  const btop=canvasTex(1024,1024,(g,w,h)=>{ g.fillStyle='#1b2340'; g.fillRect(0,0,w,h); nanduti(g, w/2, h/2, w*.47); g.fillStyle='#1b2340'; g.beginPath(); g.arc(w/2,h/2,w*.13,0,7); g.fill(); });
  const edgeM=new T.MeshStandardMaterial({color:0x6b4423, roughness:.5});
  const disc=new T.Mesh(new T.CylinderGeometry(27, 28, 2.4, 72), [edgeM, new T.MeshStandardMaterial({map:btop, roughness:.6}), edgeM]); disc.position.y=1.2; disc.castShadow=true; disc.receiveShadow=true; board.add(disc);
  R3.petals=[]; R3.poolKey=null;
  // el mate del medio es el reloj: la yerba baja con el tiempo y el anillo se achica
  const mate=new T.Group(); mate.position.y=2.4; board.add(mate); R3.mate=mate;
  const prof=[[0,0],[3.5,.2],[6,1.6],[7.2,4.5],[6.9,7.8],[5.8,10.2],[5.2,11.6]].map(([r,y])=>new T.Vector2(r,y));
  const gourd=new T.Mesh(new T.LatheGeometry(prof, 32), new T.MeshStandardMaterial({color:0xffffff, roughness:.55, side:T.DoubleSide, map:canvasTex(256,128,(g,w,h)=>{ g.fillStyle='#7a4a22'; g.fillRect(0,0,w,h); g.strokeStyle='#d9a32a'; g.lineWidth=4; for(let x=0;x<w;x+=32){ g.beginPath(); g.moveTo(x,40); g.lineTo(x+16,60); g.lineTo(x+32,40); g.stroke(); } g.fillStyle='#d52b1e'; g.fillRect(0,90,w,6); g.fillStyle='#0038a8'; g.fillRect(0,100,w,6); })})); gourd.castShadow=true; mate.add(gourd);
  const silver=new T.MeshStandardMaterial({color:0xd7dde3, metalness:.85, roughness:.25});
  const rim=new T.Mesh(new T.TorusGeometry(5.3, .55, 10, 32), silver); rim.rotation.x=Math.PI/2; rim.position.y=11.6; mate.add(rim);
  R3.yerba=new T.Mesh(new T.CylinderGeometry(5.6, 5.6, .8, 28), new T.MeshStandardMaterial({color:0x6b8f2a, roughness:1})); R3.yerba.position.y=10.8; mate.add(R3.yerba);
  const bomb=new T.Mesh(new T.CylinderGeometry(.32, .32, 20, 8), silver); bomb.position.set(1.8, 15, 0); bomb.rotation.z=-.22; mate.add(bomb);
  R3.timeRing=new T.Mesh(new T.RingGeometry(9.2, 11.6, 64), new T.MeshBasicMaterial({color:0x2a9d3f, side:T.DoubleSide})); R3.timeRing.rotation.x=-Math.PI/2; R3.timeRing.position.y=2.5; board.add(R3.timeRing); R3.ringLv=1;
  // letra grande que flota arriba del mate (con el reloj)
  R3.letterCv=document.createElement('canvas'); R3.letterCv.width=256; R3.letterCv.height=320;
  R3.letterTex=new T.CanvasTexture(R3.letterCv);
  R3.letter=new T.Mesh(new T.PlaneGeometry(20, 25), new T.MeshBasicMaterial({map:R3.letterTex, transparent:true, depthWrite:false})); R3.letter.position.set(0, TY+50, 0); scene.add(R3.letter);
  // tarjeta de categorías parada al costado (se da vuelta en cada ronda)
  const card=new T.Group(); scene.add(card); R3.card=card;
  const easel=new T.Mesh(new T.BoxGeometry(18, 2, 5), edgeM); easel.position.y=1; card.add(easel);
  const flip=new T.Group(); flip.position.y=13; flip.rotation.x=-.22; card.add(flip); R3.flip=flip;
  R3.cardCv=document.createElement('canvas'); R3.cardCv.width=360; R3.cardCv.height=500; R3.cardTex=new T.CanvasTexture(R3.cardCv); R3.cardTex.anisotropy=4;
  const front=new T.Mesh(new T.PlaneGeometry(17, 23.6), new T.MeshStandardMaterial({map:R3.cardTex, roughness:.7})); front.position.z=.06; flip.add(front);
  const back=new T.Mesh(new T.PlaneGeometry(17, 23.6), new T.MeshStandardMaterial({roughness:.7, map:canvasTex(360,500,(g,w,h)=>{ g.fillStyle='#d52b1e'; g.fillRect(0,0,w,h); g.fillStyle='#fff'; g.fillRect(14,14,w-28,h-28); g.fillStyle='#1b2340'; g.fillRect(24,24,w-48,h-48); nanduti(g, w/2, h/2-20, 130); g.fillStyle='#fff'; g.font='900 46px system-ui'; g.textAlign='center'; g.fillText('BASTA PY', w/2, h-50); })})); back.rotation.y=Math.PI; back.position.z=-.06; flip.add(back);
  // sello de goma de ¡BASTA!
  const stamp=new T.Group(); scene.add(stamp); R3.stamp=stamp;
  const rub=new T.Mesh(new T.BoxGeometry(13, 2, 7.5), new T.MeshStandardMaterial({color:0xc62828, roughness:.8})); rub.position.y=1; stamp.add(rub);
  const label=new T.MeshStandardMaterial({roughness:.6, map:canvasTex(256,64,(g,w,h)=>{ g.fillStyle='#6b4423'; g.fillRect(0,0,w,h); g.fillStyle='#fff3dd'; g.font='900 44px system-ui'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('¡BASTA!', w/2, h/2+2); })});
  const blk=new T.Mesh(new T.BoxGeometry(13, 3.4, 7.5), [edgeM, edgeM, edgeM, edgeM, label, edgeM]); blk.position.y=3.7; blk.castShadow=true; stamp.add(blk);
  const hnd=new T.Mesh(new T.CylinderGeometry(1.3, 1.6, 7, 16), edgeM); hnd.position.y=8.9; stamp.add(hnd);
  const knob=new T.Mesh(new T.SphereGeometry(2.8, 20, 14), new T.MeshStandardMaterial({color:0xd52b1e, roughness:.35})); knob.position.y=13.6; knob.castShadow=true; stamp.add(knob); R3.knob=knob;
  R3.seatG=new T.Group(); scene.add(R3.seatG);
  wire3DInput(cv3);
  resizeStage();
  return true;
}
function disposeTree(o){ o.traverse(m=>{ if(m.geometry) m.geometry.dispose(); if(m.material){ (Array.isArray(m.material)?m.material:[m.material]).forEach(x=>{ if(x.map) x.map.dispose(); x.dispose(); }); } }); }
// dónde se sienta cada uno: yo siempre adelante (mirando a la cámara)
function seatAngles(){
  const n=V.players.length, myI=Math.max(0, V.players.findIndex(p=>p.id===NET.myPid));
  return V.players.map((p,i)=>Math.PI/2 + ((i-myI+n)%n)/n*Math.PI*2);
}
const polar = (a, r, y) => new THREE.Vector3(Math.cos(a)*r, y, Math.sin(a)*r);
function buildSeats(){
  const T=THREE, G=R3.seatG;
  while(G.children.length){ const c=G.children[0]; G.remove(c); disposeTree(c); }
  R3.seats=[];
  const ang=seatAngles();
  V.players.forEach((p,i)=>{
    const a=ang[i], g=new T.Group(); G.add(g);
    // silla
    const chairM=new T.MeshStandardMaterial({color:new T.Color(p.color).multiplyScalar(.75), roughness:.6});
    const seat=new T.Mesh(new T.BoxGeometry(38, 4, 38), chairM), back=new T.Mesh(new T.BoxGeometry(38, 50, 4), chairM);
    const cpos=polar(a, TR+30, 46); seat.position.copy(cpos); seat.lookAt(0,46,0); seat.castShadow=true; g.add(seat);
    back.position.copy(polar(a, TR+48, 72)); back.lookAt(0,72,0); back.castShadow=true; g.add(back);
    // persona: un cuerpo simple con la ficha de cara
    const body=new T.Mesh(new T.CylinderGeometry(11, 15, 40, 16), new T.MeshStandardMaterial({color:p.color, roughness:.7})); body.position.copy(polar(a, TR+30, 70)); body.castShadow=true; g.add(body);
    const face=new T.Mesh(new T.PlaneGeometry(30, 30), new T.MeshBasicMaterial({transparent:true, map:canvasTex(256,256,(c,w,h)=>{ c.fillStyle='#fff3dd'; c.beginPath(); c.arc(w/2,h/2,120,0,7); c.fill(); c.lineWidth=10; c.strokeStyle=p.color; c.stroke(); c.font='150px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText(p.emoji, w/2, h/2+10); })}));
    face.position.copy(polar(a, TR+30, 108)); g.add(face);
    const tag=new T.Mesh(new T.PlaneGeometry(44, 11), new T.MeshBasicMaterial({transparent:true, depthWrite:false, map:canvasTex(512,128,(c,w,h)=>{ c.fillStyle='rgba(0,0,0,.6)'; c.beginPath(); c.roundRect ? c.roundRect(4,4,w-8,h-8,40) : c.rect(4,4,w-8,h-8); c.fill(); c.fillStyle='#fff'; c.font='bold 64px system-ui'; c.textAlign='center'; c.textBaseline='middle'; c.fillText((p.name+(p.bot?' 🤖':'')).slice(0,18), w/2, h/2+4); })}));
    tag.position.copy(polar(a, TR+30, 130)); g.add(tag);
    // planilla y lápiz sobre la mesa
    const cv=document.createElement('canvas'); cv.width=512; cv.height=660; const tex=new T.CanvasTexture(cv); tex.anisotropy=8;
    const sheet=new T.Mesh(new T.PlaneGeometry(30, 38.7), new T.MeshStandardMaterial({map:tex, roughness:.95}));
    sheet.rotation.x=-Math.PI/2; sheet.rotation.z=Math.PI/2-a; sheet.position.copy(polar(a, TR-24, TY+.5)); sheet.receiveShadow=true; g.add(sheet);
    const pencil=new T.Group(); const wood=new T.Mesh(new T.CylinderGeometry(.6,.6,16,6), new T.MeshStandardMaterial({color:0xf2c14e})); wood.rotation.z=Math.PI/2; pencil.add(wood);
    const tip=new T.Mesh(new T.ConeGeometry(.6,2,6), new T.MeshStandardMaterial({color:0x333333})); tip.rotation.z=-Math.PI/2; tip.position.x=9; pencil.add(tip);
    const pp=polar(a+.32, TR-20, TY+1.2); pencil.position.copy(pp); pencil.rotation.y=-a+Math.PI/2; pencil.castShadow=true; g.add(pencil);
    // mi silla y mi muñeco no se ven: la cámara está ahí
    if(p.id===NET.myPid && !NET.obs) g.children.forEach(m=>{ if(m!==sheet && m!==pencil) m.visible=false; });
    R3.seats.push({pid:p.id, a, g, face, tag, sheet, cv, tex, pencil, pp:pp.clone(), last:-1, wob:0});
  });
  R3.sheetKey=null;
}
// dibuja la planilla de un jugador (las ajenas, mientras se escribe, solo con garabatos)
function drawSheet(s){
  const c=s.cv.getContext('2d'), w=s.cv.width, h=s.cv.height, si=sideOf(V, s.pid), side=V.sides[si], rows=V.cats.length;
  c.fillStyle='#fffdf3'; c.fillRect(0,0,w,h);
  c.strokeStyle='rgba(30,80,200,.25)'; c.lineWidth=2; for(let y=110;y<h;y+=34){ c.beginPath(); c.moveTo(0,y); c.lineTo(w,y); c.stroke(); }
  c.strokeStyle='rgba(213,43,30,.5)'; c.beginPath(); c.moveTo(56,0); c.lineTo(56,h); c.stroke();
  const p=V.players.find(x=>x.id===s.pid)||{};
  c.fillStyle='#222'; c.font=`bold 34px ${HAND}`; c.textAlign='left'; c.fillText((side&&side.team!=null?TEAMS[side.team].e+' ':'')+(p.name||''), 70, 50);
  c.fillStyle='#d52b1e'; c.font='900 54px system-ui'; c.textAlign='right'; c.fillText(V.letter||'?', w-20, 64);
  c.fillStyle='#777'; c.font='bold 20px system-ui'; c.textAlign='left'; c.fillText(`Ronda ${V.round} · ${side?side.total:0} pts`, 70, 84);
  const rowH=Math.min(64, (h-110)/Math.max(1,rows)), sh=(V.sheets&&V.sheets[si])||[];
  for(let k=0;k<rows;k++){
    const y=110+k*rowH; c.fillStyle='#8a7a5a'; c.font='bold 17px system-ui'; c.textAlign='left'; c.fillText(V.cats[k].slice(0,26), 64, y+20);
    const txt=String(sh[k]||''), r=V.res && V.res[si] ? V.res[si][k] : null;
    if(txt==='•'){ c.strokeStyle='#2a3f9e'; c.lineWidth=3; c.beginPath(); for(let x=70;x<330;x+=12){ c.lineTo(x, y+rowH-14+Math.sin(x*.7+k)*7); } c.stroke(); }
    else if(txt){ c.fillStyle = r ? (r.ok ? (r.dup?'#b07a00':'#1f7a3a') : '#c62828') : '#1b3fa0'; c.font=`${Math.min(34,rowH-22)}px ${HAND}`; c.fillText(txt.slice(0,22), 70, y+rowH-10);
      if(r && !r.ok){ c.strokeStyle='#c62828'; c.lineWidth=3; c.beginPath(); c.moveTo(66, y+rowH-20); c.lineTo(70+Math.min(380, c.measureText(txt.slice(0,22)).width), y+rowH-22); c.stroke(); } }
    if(r){ c.fillStyle = r.pts ? '#1f7a3a' : '#c62828'; c.font='bold 26px system-ui'; c.textAlign='right'; c.fillText(r.pts ? '+'+r.pts : (r.txt?'✗':'—'), w-16, y+rowH-12); }
  }
  if(V.bastaBy===s.pid){ c.save(); c.translate(w-120, h-70); c.rotate(-.25); c.strokeStyle='#d52b1e'; c.lineWidth=6; c.strokeRect(-90,-34,180,62); c.fillStyle='#d52b1e'; c.font='900 40px system-ui'; c.textAlign='center'; c.fillText('¡BASTA!', 0, 12); c.restore(); }
  s.tex.needsUpdate=true;
}
// dibujo de encaje ñandutí (para el tablero, la tarjeta y la letra)
function nanduti(g, cx, cy, r){
  const cols=['#d52b1e','#0038a8','#2a9d3f','#f2c14e','#e75480','#ff7f11','#13a8a8'];
  g.save(); g.strokeStyle='rgba(255,255,255,.85)'; g.lineWidth=Math.max(1, r/150);
  for(let i=0;i<64;i++){ const a=i/64*Math.PI*2; g.beginPath(); g.moveTo(cx,cy); g.lineTo(cx+Math.cos(a)*r, cy+Math.sin(a)*r); g.stroke(); }
  for(let ring=1; ring<=7; ring++){
    const rr=r*ring/7.4, n=8+ring*6;
    g.strokeStyle=cols[(ring+3)%cols.length]; g.lineWidth=Math.max(1, r/80); g.beginPath(); g.arc(cx, cy, rr+r*.055, 0, 7); g.stroke();
    for(let i=0;i<n;i++){ const a=(i+(ring%2)*.5)/n*Math.PI*2; g.fillStyle=cols[(ring+i%2)%cols.length]; g.beginPath(); g.ellipse(cx+Math.cos(a)*rr, cy+Math.sin(a)*rr, r*.05*(1+ring*.12), r*.022*(1+ring*.08), a, 0, 7); g.fill(); }
  }
  g.restore();
}
// las letras de la partida, en orden, alrededor del tablero
const petalPool = () => 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('').filter(l=>EASY.includes(l) || (V.opts.dificiles && HARD.includes(l)));
function buildPetals(pool){
  const T=THREE, B=R3.board;
  R3.petals.forEach(p=>{ B.remove(p.g); disposeTree(p.g); });
  R3.petals=[];
  const cols=[0xd52b1e, 0xffffff, 0x0038a8], n=pool.length, rad=n>22 ? 21.5 : 21;
  pool.forEach((L,i)=>{
    const a=Math.PI/2+i/n*Math.PI*2, g=new T.Group(); g.position.set(Math.cos(a)*rad, 2.4, Math.sin(a)*rad); B.add(g);
    const body=new T.Mesh(new T.CylinderGeometry(1, 1, 1.6, 28), new T.MeshStandardMaterial({color:cols[i%3], roughness:.4})); body.scale.set(n>22?2.2:2.5, 1, 3.4); body.rotation.y=Math.PI/2-a; body.position.y=.8; body.castShadow=true; g.add(body);
    const top=new T.Mesh(new T.PlaneGeometry(4.2, 4.2), new T.MeshBasicMaterial({transparent:true, map:canvasTex(128,128,(c,w,h)=>{ c.fillStyle='#fff6e0'; c.beginPath(); c.arc(w/2,h/2,58,0,7); c.fill(); c.lineWidth=6; c.strokeStyle='#8a5a12'; c.stroke(); c.fillStyle='#1b2340'; c.font='900 86px system-ui'; c.textAlign='center'; c.textBaseline='middle'; c.fillText(L, w/2, h/2+6); })}));
    top.rotation.x=-Math.PI/2; top.rotation.z=Math.PI/2-a; top.position.y=1.65; g.add(top);
    body.userData.L=L; top.userData.L=L;
    R3.petals.push({L, g, body, top, col:cols[i%3]});
  });
}
function drawCard(){
  const c=R3.cardCv.getContext('2d'), w=360, h=500;
  c.fillStyle='#d52b1e'; c.fillRect(0,0,w,h); c.fillStyle='#fffdf3'; c.fillRect(12,12,w-24,h-24);
  c.fillStyle='#0038a8'; c.fillRect(12,12,w-24,78);
  c.fillStyle='#fff'; c.font='900 38px system-ui'; c.textAlign='left'; c.fillText('Categorías', 30, 66);
  c.fillStyle='#f2c14e'; c.beginPath(); c.arc(w-56, 51, 30, 0, 7); c.fill(); c.fillStyle='#d52b1e'; c.font='900 40px system-ui'; c.textAlign='center'; c.textBaseline='middle'; c.fillText(V.letter||'?', w-56, 53); c.textBaseline='alphabetic';
  const n=Math.max(1, V.cats.length), rowH=Math.min(46, (h-120)/n);
  V.cats.forEach((cat,k)=>{ const y=118+k*rowH+rowH*.7; c.fillStyle=['#d52b1e','#0038a8','#2a9d3f'][k%3]; c.beginPath(); c.arc(36, y-rowH*.25, 7, 0, 7); c.fill();
    c.fillStyle='#1b2340'; c.font=`bold ${Math.min(30, rowH*.62)}px system-ui`; c.textAlign='left'; c.fillText(cat.slice(0,20), 54, y); });
  R3.cardTex.needsUpdate=true;
}
function drawLetterCv(L, sub, hot){
  const c=R3.letterCv.getContext('2d'), w=256, h=320;
  c.clearRect(0,0,w,h);
  c.fillStyle='#1b2340'; c.beginPath(); c.arc(128,128,122,0,7); c.fill();
  nanduti(c, 128, 128, 118);
  c.fillStyle='#fff6e0'; c.beginPath(); c.arc(128,128,74,0,7); c.fill(); c.lineWidth=6; c.strokeStyle='#d9a32a'; c.stroke();
  c.fillStyle='#d52b1e'; c.font='900 110px system-ui'; c.textAlign='center'; c.textBaseline='middle'; c.fillText(L, 128, 136);
  if(sub){ c.fillStyle=hot?'#ff5252':'#fff'; c.font='bold 46px system-ui'; c.textBaseline='alphabetic'; c.strokeStyle='rgba(0,0,0,.7)'; c.lineWidth=8; c.strokeText(sub, 128, 305); c.fillText(sub, 128, 305); }
  R3.letterTex.needsUpdate=true;
}
function wire3DInput(canvas){
  let drag=null;
  canvas.addEventListener('pointerdown', e=>{ canvas.setPointerCapture(e.pointerId); drag={x:e.clientX, y:e.clientY, x0:e.clientX, y0:e.clientY, moved:false}; });
  canvas.addEventListener('pointermove', e=>{
    if(!drag) return;
    const dx=e.clientX-drag.x, dy=e.clientY-drag.y; drag.x=e.clientX; drag.y=e.clientY;
    if(!drag.moved && Math.hypot(e.clientX-drag.x0, e.clientY-drag.y0)>8) drag.moved=true;
    if(!drag.moved) return;
    CAM3.yaw-=dx*.006; CAM3.pitch=Math.max(-.5, Math.min(.9, CAM3.pitch+dy*.004));
  });
  canvas.addEventListener('pointerup', e=>{
    const d=drag; drag=null; if(!d || d.moved) return;
    // tocar el sello = ¡BASTA!; en el abecedario frena; al elegir, se toca un pétalo
    const r=canvas.getBoundingClientRect(), T=THREE, ray=new T.Raycaster();
    ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1, -((e.clientY-r.top)/r.height)*2+1), R3.cam);
    const mineC=chooserPid(V)===NET.myPid && !NET.obs;
    if(ray.intersectObject(R3.stamp, true).length){ if(canWrite()) basta(); else if(V.phase==='abc' && mineC) doAct({type:'stopAbc'}); return; }
    if(V.phase==='abc' && mineC && ray.intersectObject(R3.board, true).length){ doAct({type:'stopAbc'}); return; }
    if(V.phase==='pick' && mineC){ const h=ray.intersectObjects(R3.petals.map(p=>p.body).concat(R3.petals.map(p=>p.top)))[0]; if(h) doAct({type:'pickL', l:h.object.userData.L}); }
  });
  canvas.addEventListener('pointercancel', ()=>{ drag=null; });
  canvas.addEventListener('wheel', e=>{ e.preventDefault(); CAM3.zoom=Math.max(.5, Math.min(2, CAM3.zoom*(e.deltaY>0?1.08:.93))); saveCam3(); }, {passive:false});
}
function cam3(k, d){
  if(k==='zoom') CAM3.zoom=Math.max(.5, Math.min(2, CAM3.zoom*(d>0?.85:1.18)));
  else { CAM3.mode=k; CAM3.yaw=0; CAM3.pitch=0; }
  saveCam3();
}
function draw3D(){
  const T=THREE, now=performance.now();
  const key=V.players.map(p=>p.id+p.name+p.emoji+p.color+(p.bot?1:0)).join('|')+'|'+NET.myPid;
  if(R3.seatKey!==key){ R3.seatKey=key; buildSeats(); }
  // planillas: se redibujan cuando cambia lo escrito o la revisión
  const sk=JSON.stringify([V.phase, V.round, V.letter, V.sheets, V.res&&V.res.map(r=>r.map(x=>x.pts+(x.ok?1:0))), V.bastaBy, V.sides.map(s=>s.total), V.cats]);
  if(R3.sheetKey!==sk){ R3.sheetKey=sk; R3.seats.forEach(s=>{ const si=sideOf(V,s.pid), n=filled(V,si); if(s.last>=0 && n>s.last) s.wob=now; s.last=n; drawSheet(s); }); }
  R3.seats.forEach(s=>{ const t=(now-s.wob)/1000; if(t<1.2){ s.pencil.position.set(s.pp.x+Math.sin(t*30)*1.5, s.pp.y+Math.abs(Math.sin(t*15))*1.2, s.pp.z+Math.cos(t*25)*1.2); } else s.pencil.position.copy(s.pp);
    s.face.lookAt(R3.cam.position); s.tag.lookAt(R3.cam.position); });
  // tablero: pétalos de las letras, mate reloj, tarjeta y sello
  const ph=V.phase, pool=petalPool();
  if(R3.poolKey!==pool.join('')){ R3.poolKey=pool.join(''); buildPetals(pool); }
  let cur=-1;
  if(ph==='spin'){ const t=pool.indexOf(V.letter), k=Math.max(0, Math.min(1, (hostMs()-V.phaseAt)/2400)), e=1-Math.pow(1-k,3), st=Math.floor((1-e)*pool.length*3); cur=((t-st)%pool.length+pool.length)%pool.length; }
  else if(ph==='abc') cur=pool.indexOf(abcLetter(V, hostMs()));
  if(cur!==R3.cur){ R3.cur=cur; if(cur>=0){ if(ph==='abc'){ sfx.abc(); const el=$('#abcL'); if(el) el.textContent=pool[cur]; } else sfx.tick(); } }
  const showCur = !['spin','abc','pick','lobby'].includes(ph);
  R3.petals.forEach((p,i)=>{
    const used=V.used.includes(p.L) && !(showCur && p.L===V.letter), isCur=showCur && p.L===V.letter, hl=i===cur, canPick=ph==='pick' && chooserPid(V)===NET.myPid && !V.used.includes(p.L);
    p.body.material.color.setHex(isCur ? 0xf2c14e : hl ? 0x7fd7ff : used ? 0x4a4550 : p.col);
    p.body.material.emissive.setHex(isCur ? 0x553300 : hl ? 0x1a4a66 : canPick && Math.sin(now/250+i)>0 ? 0x332200 : 0);
    const y = 2.4 + (isCur ? 1.8+Math.sin(now/300)*.4 : hl ? 1.2 : used ? -.6 : 0);
    p.g.position.y += (y-p.g.position.y)*.3; p.top.material.opacity = used ? .35 : 1;
  });
  // el mate se va vaciando con el tiempo
  let lv=1;
  if(ph==='write' && V.endsAt){ const tot=(V.bastaBy ? V.opts.count : V.opts.timer)*1000 || 1; lv=Math.max(0, Math.min(1, (V.endsAt-hostMs())/tot)); }
  else if(ph==='review' || ph==='roundEnd' || ph==='over') lv=0;
  R3.yerba.position.y=3.5+lv*7.3; R3.yerba.visible=lv>.02;
  if(Math.abs(lv-R3.ringLv)>.004){ R3.ringLv=lv; R3.timeRing.geometry.dispose(); R3.timeRing.geometry=new T.RingGeometry(9.2, 11.6, 64, 1, Math.PI/2, Math.max(.001, lv*Math.PI*2)); R3.timeRing.material.color.setHSL(lv*.33, .8, .45); }
  R3.timeRing.visible = ph==='write' && !!V.endsAt;
  // letra grande arriba del mate
  let L = cur>=0 ? pool[cur] : ph==='pick' ? '?' : (V.letter||'?'), sub='', hot=false;
  if(ph==='write'){ const s=timeLeft(); if(s!=null){ sub=`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; hot=s<=10; } else sub='✏️'; }
  const lk=L+'|'+sub+'|'+hot; if(R3.lk!==lk){ R3.lk=lk; drawLetterCv(L, sub, hot); }
  R3.letter.position.y=TY+50+Math.sin(now/600)*1.5; R3.letter.lookAt(R3.cam.position);
  // tarjeta: se da vuelta cuando empieza cada ronda
  const ck=V.round+'|'+V.letter+'|'+V.cats.join(','); if(R3.ck!==ck){ R3.ck=ck; drawCard(); }
  R3.card.position.copy(polar(Math.PI/2-.62, 40, TY)); R3.card.lookAt(0, TY+8, 160);
  const ft=R3.flipAt ? Math.min(1, (now-R3.flipAt)/800) : 1, faceUp = ph!=='spin' && ph!=='abc' && ph!=='pick';
  R3.flip.rotation.y = faceUp ? Math.PI*Math.pow(1-ft,3) : Math.PI;
  // sello: delante mío, al costado; cae cuando alguien grita ¡BASTA!
  R3.stamp.position.copy(polar(Math.PI/2+.62, 36, TY));
  const pt=R3.pressAt ? (now-R3.pressAt)/600 : 9;
  R3.stamp.position.y = TY + (pt<1 ? (pt<.3 ? 10*(1-pt/.3) : (pt-.3)/.7*3) : (V.bastaBy?3:0)) + (canWrite()&&!V.bastaBy ? Math.abs(Math.sin(now/400))*.8 : 0);
  R3.knob.material.emissive.setHex(canWrite() && !V.bastaBy ? 0x330000 : 0);
  // cámara
  const z=CAM3.zoom, cam=R3.cam;
  let want, look;
  if(CAM3.mode==='arriba'){ want=new T.Vector3(Math.cos(Math.PI/2+CAM3.yaw)*40, TY+300*z, Math.sin(Math.PI/2+CAM3.yaw)*40); look=new T.Vector3(0,TY,0); }
  else if(CAM3.mode==='hoja'){ const sp=polar(Math.PI/2, TR-24, TY); want=new T.Vector3(sp.x+Math.sin(CAM3.yaw)*20, TY+48*z, sp.z+22*z); look=sp; }
  else { const a=Math.PI/2+CAM3.yaw, nar=cam.aspect<1 ? 1+(1-cam.aspect)*.9 : 1, r=(TR+38)*z*nar; want=new T.Vector3(Math.cos(a)*r, TY+(98+CAM3.pitch*90)*z*nar, Math.sin(a)*r); look=new T.Vector3(Math.cos(a)*14, TY+16, Math.sin(a)*14); }
  cam.position.lerp(want, .15);
  R3.camLook=(R3.camLook||look.clone()).lerp(look, .15); cam.lookAt(R3.camLook);
  R3.renderer.render(R3.scene, cam);
}
function loop(){
  requestAnimationFrame(loop);
  if(!V || V.phase==='lobby' || !$('#game').classList.contains('on') || !R3.renderer) return;
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
    const offline=!p.bot&&!p.conn;
    return `<div class="prow" style="border-left:5px solid ${p.color}"><span style="font-size:22px">${esc(p.emoji)}</span><span class="nm"><b>${esc(p.name)}${p.id===me()?' (vos)':''}${p.id===V.hostPid&&NET.mode!=='local'?' 👑':''}</b>
      <small>${V.opts.fmt==='eq'?TEAMS[p.team].e+' '+TEAMS[p.team].n:''}${p.bot?' · 🤖 bot':''}${p.mic?' · 🎙️':''}${offline?' · ⚠️ sin conexión':''}</small></span>
      ${host&&p.id!==V.hostPid&&NET.mode!=='local'?`${offline&&inPlay?`<button class="btn sm gray" onclick="doAct({type:'botify',pid:'${p.id}'})" title="Que siga un bot">🤖</button>`:''}<button class="btn sm gray" onclick="if(confirm('¿Sacar a ${esc(p.name)} de la mesa?'))doAct({type:'kick',pid:'${p.id}'})" title="Sacar">✕</button>`:''}</div>`;
  }).join('');
  const obs=(V.observers||[]).map(o=>`<div class="prow"><span style="font-size:20px">${o.owner?'👑':'👀'}</span><span class="nm"><b>${esc(o.name)}${o.id===me()?' (vos)':''}</b><small>${o.owner?'dueño del juego, ':''}mirando${o.mic?' · 🎙️':''}</small></span></div>`).join('');
  const sit = NET.obs && (V.phase==='lobby'||V.phase==='over') && V.players.length<MAXP ? `<button class="btn gold wide" onclick="doAct({type:'joinNext'})">✏️ Sentarme a jugar</button>` : NET.obs ? `<p class="muted">Te podés sentar cuando termine la partida (si hay lugar).</p>` : '';
  const info = inPlay ? `<p class="muted">Ronda ${V.round}${V.opts.rounds?` de ${V.opts.rounds}`:''} · letras que salieron: ${esc((V.used||[]).join(' ')||'—')}</p>` : '';
  $('#mesaList').innerHTML = info + `<b>Jugadores (${V.players.length}/${MAXP})</b>` + ps + (obs?`<b>Mirando</b>${obs}`:'') + sit
    + (host && inPlay ? `<button class="btn dark wide" style="margin-top:8px" onclick="if(confirm('¿Terminar la partida y volver a la sala?'))doAct({type:'newGame',force:true})">⚙️ Terminar y volver a la sala</button>` : '')
    + (NET.mode!=='local'&&NET.code?`<p class="muted" style="margin-top:12px">Invitá con el código <b>${NET.code}</b> <button class="btn sm" onclick="shareRoom()">📤 Compartir</button></p>`:'');
}
function renderReglasTab(){
  const o=V.opts, on=HOUSE.filter(h=>o[h.k]), host=amHost();
  $('#reglasList').innerHTML = `<p style="margin-top:0"><b>${esc(PRESETS[o.preset].t)}</b> · ${esc(FORMATS[o.fmt])}</p><div class="chips">${(V.cats&&V.cats.length?V.cats:catsOf(o)).map(c=>`<span>${esc(c)}</span>`).join('')}</div>`
    + `<p><b>${esc(SCORES[o.score].t)}</b></p><p class="muted">${esc(SCORES[o.score].d)}</p><p class="muted">${esc(PICKS[o.pick].t)} · ${o.rounds?o.rounds+' rondas':'todas las letras'} · ${o.timer?`⏰ ${o.timer} s por ronda`:'sin límite de tiempo'} · después del ¡BASTA! ${o.count?o.count+' s':'se corta al toque'}</p>`
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
  const url=roomLink(), text=`¡Vení a jugar al Basta conmigo! ✏️🇵🇾 Sala ${NET.code}`;
  if(navigator.share) return navigator.share({title:'Basta PY', text, url}).catch(()=>{});
  modal(`<h2>📤 Invitar a la sala ${NET.code}</h2><p style="word-break:break-all;user-select:all;background:#fff;padding:8px;border-radius:8px">${esc(url)}</p>
    <a class="btn green wide" style="display:block;text-align:center;text-decoration:none" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text+' '+url)}">💬 Mandar por WhatsApp</a>
    <button class="btn wide" style="margin-top:6px" onclick="navigator.clipboard.writeText('${url}').then(()=>toast('Enlace copiado'))">📋 Copiar enlace</button>
    <button class="btn gray wide" style="margin-top:6px" onclick="closeModal()">Cerrar</button>`);
}
function showRules(){
  modal(`<div class="rules"><h2>📜 Cómo se juega</h2>
  <p>Sale una letra y todos escriben, lo más rápido posible, una palabra que empiece con esa letra para cada categoría (nombre, país, animal…).</p>
  <h3>✋ ¡BASTA!</h3><p>El primero que completa la planilla toca <b>¡BASTA!</b> (el botón rojo de la mesa o el de abajo). Según las reglas, se corta al toque o los demás tienen unos segundos más. Si hay límite de tiempo y nadie grita, se corta igual.</p>
  <h3>📝 Revisión</h3><p>Después se ven las planillas de todos. El juego ya marca las que no empiezan con la letra. Las demás las revisan los jugadores: tocá 👎 en una palabra que no vale (que no existe o no es de esa categoría). Se anula con la mitad de los votos de los demás. Cuando todos tocan <b>✅ Listo</b>, se cuentan los puntos.</p>
  <h3>🧮 Puntos</h3>${Object.keys(SCORES).map(k=>`<p><b>${SCORES[k].t}:</b> ${SCORES[k].d}</p>`).join('')}
  <p>Para comparar no importan las mayúsculas, los acentos ni el “el / la” de adelante.</p>
  <h3>🔤 La letra</h3>${Object.keys(PICKS).map(k=>`<p><b>${PICKS[k].t}:</b> ${PICKS[k].d}</p>`).join('')}<p>Una letra que ya salió no vuelve a salir en la partida.</p>
  <h3>👥 Equipos</h3><p>Los del mismo equipo comparten la planilla: cada uno puede escribir en cualquier casilla y ven lo que pone el compañero.</p>
  <h3>🏠 Reglas de la casa</h3>${HOUSE.map(h=>`<p><b>${h.t}:</b> ${h.d}</p>`).join('')}
  <h3>📋 Categorías</h3>${Object.keys(PRESETS).filter(k=>k!=='propia').map(k=>`<p><b>${PRESETS[k].t}:</b> ${PRESETS[k].c.join(', ')}.</p>`).join('')}<p><b>${PRESETS.propia.t}:</b> las que quieran, de 2 a 12.</p>
  <h3>🕹️ La mesa</h3><p>Arrastrá para mirar alrededor de la mesa. 🪑 tu lugar, 📄 tu planilla de cerca, 🔭 desde arriba.</p>
  </div><button class="btn wide" onclick="closeModal()">Entendido</button>`);
}
