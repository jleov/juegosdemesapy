'use strict';
/* =====================================================================
   Tejo PY — red (PeerJS) en tiempo real, chat con privados, voz, sala de
   espera, mesa en 3D, mazos y sonidos.
   ===================================================================== */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function store(k,v){ try{ if(v===undefined) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
function load(k){ try{ const v=localStorage.getItem(k); return v==null?null:JSON.parse(v); }catch(e){ return null; } }
function toast(x){ const t=$('#toast'); t.textContent=x; t.style.display='block'; clearTimeout(toast.t); toast.t=setTimeout(()=>t.style.display='none', 3800); }
const PREFIX='tejopy26-';
const genCode = () => { const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s=''; for(let i=0;i<5;i++) s+=A[rnd(A.length)]; return s; };
let myToken=load('tejo_token'); if(!myToken){ myToken=Math.random().toString(36).slice(2)+Date.now().toString(36); store('tejo_token', myToken); }
const NET={mode:null, peer:null, code:null, conns:{}, hostConn:null, myPid:null, obs:null, welcomed:false};
let CHAT=[], V=null;
const me = () => NET.myPid || NET.obs;
const amHost = () => NET.mode==='local' || (V && V.hostPid===NET.myPid && NET.mode==='host');
const VP = id => V && (V.players.find(p=>p.id===id) || (V.observers||[]).find(o=>o.id===id));
// ¿este aparato maneja a ese jugador? (en la partida local, todos los que no son bots)
const mine = pid => pid && (pid===me() || (NET.mode==='local' && V && V.players.some(p=>p.id===pid && !p.bot)));

/* ====================== MENÚ ====================== */
let myEmojiSel = load('tejo_emoji') || EMOJIS[0];
const myName = () => ($('#myName').value.trim() || 'Jugador').slice(0,16);
const myEmoji = () => myEmojiSel;
$('#myName').value = load('tejo_name') || '';
$('#myName').addEventListener('input', ()=>store('tejo_name', $('#myName').value.trim()));
function renderTokenPicker(){ $('#tokens').innerHTML = EMOJIS.map(e=>`<button class="tok ${e===myEmojiSel?'sel':''}" onclick="pickEmoji('${e}')">${e}</button>`).join(''); }
function pickEmoji(e){ myEmojiSel=e; store('tejo_emoji', e); renderTokenPicker(); }
renderTokenPicker();
function needName(){ if(!$('#myName').value.trim()){ toast('Escribí tu nombre primero ✍️'); $('#myName').focus(); return true; } store('tejo_name', myName()); return false; }
function joinClick(){ const code=$('#joinCode').value.trim().toUpperCase(); if(!code) return toast('Escribí el código de la sala.'); if(needName()) return; clientJoin(code); }
function resumeClick(){
  const h=load('tejo_host'), c=load('tejo_client');
  if(h && (!c || h.at>=c.at)) return hostStart(true);
  if(c){ if(needName()) return; clientJoin(c.code); }
}
function refreshResume(){ const h=load('tejo_host'), c=load('tejo_client'), ok=x=>x && Date.now()-x.at<6*3600e3; $('#btnResume').style.display = ok(h)||ok(c) ? 'block' : 'none'; }
refreshResume();
(function(){
  const m=(location.hash.slice(1) || new URLSearchParams(location.search).get('sala') || '').toUpperCase();
  if(/^[A-Z0-9]{4,6}$/.test(m)){ $('#joinCode').value=m;
    if(new URLSearchParams(location.search).get('dueno')){ if(!$('#myName').value.trim()) $('#myName').value='Dueño'; setTimeout(()=>clientJoin(m), 300); }
    else toast('Te invitaron a la sala '+m+': escribí tu nombre y tocá “Entrar”.'); }
})();
const savedOpts = () => Object.assign(defaultOpts(), load('tejo_opts')||{});

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
  sysChat('🏒 Mesa en este aparato. Jugá contra un bot 🤖 o con un amigo al lado, elegí las reglas y tocá Empezar.');
  ANIM.lastN=null; commit(); renderChat();
}
function leaveClick(){
  if(NET.mode==='local'){ if(S && S.phase==='play' && !confirm('¿Salir de la partida?')) return; return leaveToMenu(); }
  if(!confirm('¿Salir de la sala?')) return;
  if(NET.mode==='host'){
    const others=hostCandidates(S);
    if(others.length) return hostHandover();
    store('tejo_host', undefined);
  } else if(NET.mode==='client'){
    if(NET.hostConn && NET.hostConn.open && NET.myPid) try{ NET.hostConn.send({t:'act', a:{type:'leave'}}); }catch(e){}
    store('tejo_client', undefined);
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
  s.clock=Date.now();   // para que el reloj se vea igual en todos los aparatos
  return s;
}
function commit(){
  lightShot();
  if(NET.mode==='host'){
    for(const pid in NET.conns){ const c=NET.conns[pid]; if(c && c.open) try{ c.send({t:'state', s:publicState(pid)}); }catch(e){} }
    sendBackups();
    if(!NET.noSave){ const s=JSON.parse(JSON.stringify(S)); if(s.shot) s.shot={n:s.shot.n, res:s.shot.res, stale:true}; store('tejo_host', {code:NET.code, S:s, CHAT:CHAT.slice(-80), myPid:NET.myPid, at:Date.now()}); }
  }
  if(S && (NET.mode==='host'||NET.mode==='local') && S.phase==='lobby') store('tejo_opts', S.opts);
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
  const saved = resume ? load('tejo_host') : null;
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
    if(resume){ toast('La sala sigue abierta en otro aparato (otro jugador quedó de anfitrión). Entrá con el código.'); peer.destroy(); store('tejo_host',undefined); NET.mode=null; $('#joinCode').value=NET.code; return; }
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
  store('tejo_host', undefined);
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
  else if(d.t==='mv'){ const i=S.mallets.findIndex(m=>m.pid===pid); if(i>=0 && RT && RT.ms[i]){ RT.ms[i].tx=+d.x||0; RT.ms[i].ty=+d.y||0; } }
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
  NET.noSave=true; store('tejo_host', undefined);
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
      if(!NET.welcomed){ toast('No se encontró la sala '+code+'. Revisá el código.'); store('tejo_client',undefined); leaveToMenu(); }
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
    store('tejo_client',{code:NET.code, at:Date.now()}); if(location.hash!=='#'+NET.code) history.replaceState(null,'','#'+NET.code);
    if(d.why) toast(d.why);
  }
  else if(d.t==='state'){ S=d.s; if(S.clock) CLK.off=S.clock-Date.now(); render(); }
  else if(d.t==='st') onSnap(d);
  else if(d.t==='chat'){ CHAT.push(d.m); renderChat(d.m); }
  else if(d.t==='chatlog'){ CHAT=d.list||[]; renderChat(); }
  else if(d.t==='backup'){ NET.backup={s:d.s, chat:d.chat}; }
  else if(d.t==='migrate'){ NET.backup={s:d.s, chat:d.chat}; takeoverHost('handover'); }
  else if(d.t==='kicked'){ toast('🚪 El anfitrión te sacó de la mesa.'); store('tejo_client',undefined); leaveToMenu(); }
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
const SND={on:load('tejo_snd')!==false, ctx:null};
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
  hit(v){ tone(260+v*200,.06,'triangle',.08+v*.2); noise(.04,.1+v*.35,0,1500); },
  wall(v){ tone(140,.06,'square',.03+v*.08); noise(.05,.06+v*.25,0,0,900); },
  puck(v){ tone(900,.04,'triangle',.05+v*.12); },
  goal(){ noise(.25,.3,0,0,600); [392,523,659,784].forEach((f,i)=>tone(f,.22,'square',.07,.12+i*.09)); },
  ouch(){ tone(300,.2,'sawtooth',.06); tone(200,.3,'sawtooth',.06,.18); },
  beep(hi){ tone(hi?1180:780,.14,'sine',.14); },
  turn(){ tone(740,.12,'sine',.12); tone(988,.18,'sine',.12,.11); },
  win(){ [523,659,784,1047].forEach((f,i)=>tone(f,.3,'triangle',.14,i*.13)); },
  priv(){ tone(1200,.08,'sine',.08); tone(1500,.1,'sine',.08,.08); },
};
// el soplido del aire de la mesa (suave, mientras se juega)
const AIR={src:null, g:null};
function airStart(){
  if(!SND.on || AIR.src) return; const c=actx(); if(!c) return;
  const b=c.createBuffer(1, c.sampleRate*2, c.sampleRate), ch=b.getChannelData(0); for(let i=0;i<ch.length;i++) ch[i]=Math.random()*2-1;
  const s=c.createBufferSource(), f=c.createBiquadFilter(), g=c.createGain(); s.buffer=b; s.loop=true; f.type='bandpass'; f.frequency.value=900; f.Q.value=.6; g.gain.value=.012;
  s.connect(f).connect(g).connect(c.destination); s.start(); AIR.src=s; AIR.g=g;
}
function airStop(){ if(!AIR.src) return; try{ AIR.src.stop(); }catch(e){} AIR.src=null; }
function toggleSound(){ SND.on=!SND.on; store('tejo_snd', SND.on); $('#btnSnd').textContent=SND.on?'🔊':'🔇'; if(SND.on) sfx.turn(); }
$('#btnSnd').textContent=SND.on?'🔊':'🔇';
document.addEventListener('pointerdown', ()=>actx(), {once:true});
const MUSIC_CREDIT = 'Música: "Monkeys Spinning Monkeys" de Kevin MacLeod (incompetech.com). Licencia Creative Commons Atribución 4.0: creativecommons.org/licenses/by/4.0/';
const MUSIC = { on: load('tejo_music')===true, buf:null, src:null, gain:null, loading:false, VOL:.07 };
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
function toggleMusic(){ MUSIC.on=!MUSIC.on; store('tejo_music', MUSIC.on); musicSync(); toast(MUSIC.on?'🎶 Música de fondo prendida (suave).':'🔕 Música de fondo apagada.'); }
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
    + `${host&&NET.mode!=='local'?'👑':''}${p.bot?'🤖':''}${p.local&&!p.bot?'📱':''}${p.mic?'🎙️':''}${!p.bot&&!p.conn?'⚠️':''}`;
}
const mySide = () => V ? sideOf(V, NET.myPid) : -1;

// ---------- sala de espera ----------
function renderLobby(){
  const host=amHost(), myObs=!!NET.obs, o=V.opts, eq=o.fmt==='parejas', ord=o.fmt!=='parejas';
  $('#lobbyCode').textContent=NET.code||'—';
  $('#lobbyCodeBox').style.display = NET.mode==='local' ? 'none' : '';
  $('#lobbyTitle').textContent = NET.mode==='local' ? '🏒 Mesa en este aparato' : '🏒 Sala de espera';
  $('#pcount').textContent=`(${V.players.length}/${MAXP})`;
  const teamBtn = p => eq ? `<button class="tbtn" style="background:${TEAMS[p.team].c}" ${host||p.id===me()?`onclick="doAct({type:'team',pid:'${p.id}'})"`:'disabled'} title="Cambiar de lado">${TEAMS[p.team].e}</button>` : '';
  const upBtn = (p,i) => ord && host && i>0 ? `<button class="btn sm gray" onclick="doAct({type:'order',pid:'${p.id}'})" title="Subir en el orden">⬆️</button>` : '';
  const tag = i => o.fmt==='duelo' ? (i<2?`<span class="muted">${i===0?'🔴 abajo':'🔵 arriba'}</span>`:'<span class="muted">mira</span>') : o.fmt==='rey' ? `<span class="muted">${i+1}º</span>` : '';
  $('#plist').innerHTML=V.players.map((p,i)=>`<li>${teamBtn(p)}${playerTag(p)}${tag(i)}${upBtn(p,i)}${host && p.id!==V.hostPid?`<button class="btn sm gray" onclick="doAct({type:'kick',pid:'${p.id}'})" title="Sacar">✕</button>`:''}</li>`).join('')
    + (V.observers||[]).map(x=>`<li style="opacity:.75"><span style="font-size:20px">👀</span><span class="nm">${esc(x.name)} <span class="muted">mirando</span></span>${x.mic?'🎙️':''}</li>`).join('');
  const err=canStartV();
  $('#lobbyHostBtns').innerHTML = host
    ? `<div class="row"><button class="btn gray" onclick="doAct({type:'addBot'})" ${V.players.length>=MAXP?'disabled':''}>🤖 Sumar bot</button>
       ${NET.mode==='local'&&!V.players.some(p=>p.local)?`<button class="btn gray" onclick="addLocalClick()">🙋 Amigo en este aparato</button>`:''}
       <button class="btn green" onclick="doAct({type:'start'})">▶️ Empezar</button></div>
       <p class="muted">${err?'⚠️ '+esc(err):'¡Listo para empezar!'}${eq?' · Tocá 🔴/🔵 para cambiar a alguien de lado.':ord?' · Con ⬆️ cambiás el orden.':''}</p>`
    : `<p class="muted" style="text-align:center">⏳ Esperando que el anfitrión 👑 empiece la partida…${eq?'<br>Tocá tu color para cambiarte de lado.':''}</p>`;
  $('#lobbyObs').innerHTML = myObs ? `<div class="obsbar" style="border-radius:10px;margin-top:8px">👀 Estás mirando. ${V.players.length<MAXP?`<button class="btn sm gold" onclick="doAct({type:'joinNext'})">🏒 Sumarme a jugar</button>`:'La mesa está llena.'}</div>` : '';
  $('#optsBox').innerHTML = optsHTML(host);
  const g=$('#grulesBox');
  if(host){
    if(!g.querySelector('textarea')) g.innerHTML=`<textarea id="grulesIn" maxlength="1200" placeholder="Ej.: el que pierde paga la gaseosa 🥤&#10;Gol con la mano no vale 😂"></textarea><p class="muted" style="margin:4px 0 0">Se guarda solo y lo ven todos.</p>`;
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
  const chk=(k, t, d)=>`<label class="opt" style="margin:0 0 6px;font-weight:400"><input type="checkbox" ${o[k]?'checked':''} ${dis} onchange="doAct({type:'opt',k:'${k}',v:this.checked})"><span><b>${t}</b><small>${d}</small></span></label>`;
  const obj=O=>Object.keys(O).map(k=>({v:k, t:O[k].t||O[k]}));
  return `<label style="margin-top:0">Cómo se juega ${host?'':'<span class="muted">(lo elige el anfitrión)</span>'}</label>${sel('fmt', obj(FORMATS))}
    <p class="muted" style="margin:4px 0 0">${esc(FORMATS[o.fmt].d)}</p>
    <label>🥅 Gana el que llega a</label>${sel('goals', GOALS)}
    ${o.fmt==='rey'?`<label>👑 Coronas para ser el Rey</label>${sel('crowns', CROWNS)}`:''}
    <label>⏰ Tiempo por partido</label>${sel('time', TIMES)}
    <label>🏒 Tejos en la mesa</label>${sel('pucks', PUCKS)}
    <label>💨 Velocidad del tejo</label>${sel('speed', obj(SPEEDS))}
    <label>Tamaño del arco</label>${sel('goal', GOALW)}
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
let PREV={phase:null, mk:''};
function renderGame(){
  $('#roomTag').textContent = NET.mode==='local' ? '📱 En este aparato' : '🔑 '+NET.code;
  $('#obsbar').style.display = NET.obs ? 'block' : 'none';
  if(NET.obs) $('#obsbar').textContent = '👀 Estás mirando la partida.';
  const mkey=(V.startedAt||0)+'|'+V.matchN;
  if(mkey!==PREV.mk && V.phase==='play'){ SN.buf=[]; LOCAL.t={}; if(CAM3.auto) CAM3.mode=defaultCam(); }
  PREV={phase:V.phase, mk:mkey};
  renderScore(); renderStatus(); endModal();
}
function sideColor(st, i){ return st.opts.fmt==='parejas' ? TEAMS[i].c : (st.players.find(p=>p.id===(st.sides[i]||{pids:[]}).pids[0])||{}).color||TEAMS[i].c; }
function clockTxt(){
  if(!V || V.phase!=='play') return '';
  if(V.sudden) return '⚡ Muerte súbita';
  if(!V.endsAt) return `a ${V.opts.goals}`;
  const s=Math.max(0, Math.ceil((V.endsAt-hostMs())/1000)); return `⏱ ${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
}
function renderScore(){
  if(!V.sides.length){ $('#score').innerHTML=''; return; }
  const side=i=>`<div class="sbs s${i}" style="--c:${sideColor(V,i)}"><b>${esc(sideName(V,i))}${V.sides[i].pids.includes(NET.myPid)?' (vos)':''}</b><span>${V.score[i]}</span></div>`;
  const q = V.opts.fmt==='rey' ? `<div class="queue">👑 ${V.queue.map(id=>{ const p=V.players.find(x=>x.id===id); return p?`<span class="${playing(V,id)?'on':''}">${esc(p.emoji)} ${esc(p.name)}${V.crowns[id]?' '+'👑'.repeat(V.crowns[id]):''}</span>`:''; }).join('')}</div>` : '';
  $('#score').innerHTML=`<div class="sb">${side(0)}<div class="mid" id="clock">${clockTxt()}</div>${side(1)}</div>${q}`;
}
function renderStatus(){
  const ms=mySide(); let st='';
  if(V.phase==='play'){ st = ms>=0 ? (NET.mode==='local' && humanLocals().length>1 ? 'Cada uno mueve su mazo en su mitad (dedo o mouse; teclado: WASD y flechas)' : `Mové tu mazo con el dedo o el mouse · defendés el arco de ${ms===mySideView()?'abajo':'arriba'}`) : '👀 Mirando el partido'; }
  else if(V.phase==='matchEnd') st='🏆 Fin del partido';
  else if(V.phase==='over') st='🏆 Fin de la partida';
  $('#status').textContent=st;
}
setInterval(()=>{ const c=$('#clock'); if(c && V) c.textContent=clockTxt(); }, 250);
function banner(t, cls){ const b=$('#banner'); b.className='banner '+(cls||''); b.textContent=t; b.style.display='block'; clearTimeout(banner.t); banner.t=setTimeout(()=>b.style.display='none', 2600); }
function bigText(t, col){ const d=document.createElement('div'); d.className='bigtext'; if(col) d.style.setProperty('--glow', col); d.textContent=t; $('#stage').appendChild(d); setTimeout(()=>d.remove(), 1900); }
let ENDSHOWN=null;
function endModal(){
  if(!V || (V.phase!=='over' && V.phase!=='matchEnd')){ if(ENDSHOWN && V && V.phase==='play'){ ENDSHOWN=null; closeModal(); } return; }
  const key=V.phase+'|'+V.matchN; if(ENDSHOWN===key) return; ENDSHOWN=key;
  const host=amHost(), mw=V.matchWin||{side:-1, score:V.score};
  const iWon = V.opts.fmt==='rey' ? V.win && mine(V.win.pid) : mw.side>=0 && V.sides[mw.side].pids.some(pid=>mine(pid));
  if(V.phase==='over' && (iWon || (V.opts.fmt!=='rey' && mw.side>=0 && V.sides[mw.side].pids.some(pid=>mine(pid))))) sfx.win();
  const res = mw.side<0 ? `🤝 Empate ${mw.score[0]} a ${mw.score[1]}` : `<b>${esc(sideName(V,mw.side))}</b> gana ${mw.score[mw.side]} a ${mw.score[1-mw.side]} 🎉`;
  const crowns = V.opts.fmt==='rey' ? `<table class="score">${V.players.slice().sort((a,b)=>(V.crowns[b.id]||0)-(V.crowns[a.id]||0)).map(p=>`<tr><td>${esc(p.emoji)} ${esc(p.name)}</td><td style="text-align:right">${'👑'.repeat(V.crowns[p.id]||0)||'—'}</td></tr>`).join('')}</table>` : '';
  if(V.phase==='matchEnd'){
    const nx=V.queue.slice(0,2).map(id=>{ const p=V.players.find(x=>x.id===id); return p?esc(p.name):'?'; });
    modal(`<h2>🏆 Fin del partido</h2><p style="font-size:18px">${res}</p>${crowns}<p>Ahora: <b>${nx[0]}</b> contra <b>${nx[1]}</b></p>
      ${host?`<button class="btn green wide" onclick="closeModal();doAct({type:'next'})">▶️ Siguiente partido</button><p class="muted">Si no, arranca solo en unos segundos.</p>`:`<p class="muted">El siguiente partido arranca en unos segundos…</p>`}
      <button class="btn gray wide" style="margin-top:6px" onclick="closeModal()">Cerrar</button>`);
    return;
  }
  const title = V.opts.fmt==='rey' && V.win ? `👑 ¡${esc((V.players.find(p=>p.id===V.win.pid)||{}).name||'?')} es el Rey de la mesa!` : '🏆 ¡Terminó la partida!';
  modal(`<h2>${title}</h2><p style="font-size:18px">${res}</p>${crowns}
    ${host?`<button class="btn green wide" onclick="closeModal();doAct({type:'rematch'})">🔁 Revancha</button><button class="btn wide" style="margin-top:6px" onclick="closeModal();doAct({type:'newGame'})">⚙️ Volver a la sala (cambiar reglas)</button>`:`<p class="muted">El anfitrión elige si hay revancha.</p>`}
    <button class="btn gray wide" style="margin-top:6px" onclick="closeModal()">Mirar la mesa</button>`);
}

/* ====================== TIEMPO REAL ====================== */
// el anfitrión (o la partida en un aparato) mueve la física y manda fotos de la mesa
const r1 = v => Math.round(v*10)/10;
function hostLoop(){
  if(!S || NET.mode==='client' || S.phase==='lobby') return;
  if((S.phase==='play' || S.phase==='matchEnd') && !RT) resetTable();
  if(!RT) return;
  const now=performance.now(), dt=Math.min(.1, (now-RT.last)/1000); RT.last=now;
  S.mallets.forEach((m,i)=>{ const p=P(m.pid); if(autoPlays(p)) botMove(i); else if(RT.ms[i]) RT.ms[i].vmax=null; });
  keysMove(dt);
  RT.acc+=dt; while(RT.acc>=SUB){ stepWorld(SUB); RT.acc-=SUB; }
  timeCheck();
  if(S.phase==='matchEnd' && S.matchWin && Date.now()-S.matchWin.at>6000){ startMatch(); commit(); }
  const ev=RT.ev; RT.ev=[]; if(ev.length){ playEvents(ev); (RT.sendEv=RT.sendEv||[]).push(...ev); }
  if(NET.mode==='host' && now-(RT.snapAt||0)>=33){
    RT.snapAt=now;
    const msg={t:'st', p:RT.pucks.map(p=>[r1(p.x), r1(p.y), p.on?1:0]), m:RT.ms.map(m=>[r1(m.x), r1(m.y)]), e:RT.sendEv||[]}; RT.sendEv=[];
    for(const id in NET.conns){ const c=NET.conns[id]; if(c && c.open) try{ c.send(msg); }catch(e){} }
  }
}
setInterval(hostLoop, 16);
// en los otros aparatos: se guardan las fotos y se dibuja un poquito atrasado, mezclando entre dos
const SN={buf:[]};
function onSnap(d){ SN.buf.push({t:performance.now(), p:d.p||[], m:d.m||[]}); if(SN.buf.length>40) SN.buf.shift(); if(d.e && d.e.length) playEvents(d.e); }
function playEvents(ev){
  ev.forEach(e=>{
    if(e[0]==='h'){ sfx.hit(e[1]); R3.hitAt=performance.now(); }
    else if(e[0]==='w') sfx.wall(e[1]);
    else if(e[0]==='p') sfx.puck(e[1]);
    else if(e[0]==='g'){ const ms=mySide(), good = ms<0 || ms===e[1]; if(good) sfx.goal(); else sfx.ouch(); bigText(e[2]>1?'¡GOL DE BANDA! ×2':'¡GOOOL!', TEAMS[e[1]].c); R3.flash={at:performance.now(), side:e[1]}; }
  });
}
function viewTable(){
  if(NET.mode!=='client'){ if(!RT) return null; return {p:RT.pucks.map(p=>[p.x,p.y,p.on?1:0]), m:RT.ms.map(m=>[m.x,m.y])}; }
  const b=SN.buf; if(!b.length) return null;
  const rt=performance.now()-90; let k=0; while(k<b.length-1 && b[k+1].t<=rt) k++;
  const a=b[k], c=b[k+1]||a, f = c===a ? 0 : Math.max(0, Math.min(1, (rt-a.t)/(c.t-a.t)));
  const mix=(A,C)=>A.map((x,i)=>{ const y=C[i]||x; return x.length>2 && (x[2]!==y[2]) ? y.slice() : x.map((v,j)=>j<2 ? v+(y[j]-v)*f : y[j]); });
  return {p:mix(a.p,c.p), m:mix(a.m,c.m)};
}
// ---------- controles ----------
const LOCAL={t:{}, sendAt:0, keys:{}};
const humanLocals = () => V ? V.mallets.map((m,i)=>({m,i,p:V.players.find(x=>x.id===m.pid)})).filter(x=>x.p && !x.p.bot && mine(x.p.id)) : [];
const mySideView = () => { const s=mySide(); return s<0 ? 0 : s; };
function clampT(side, x, y){ const R=mr(V.opts); return [Math.max(-W2+R, Math.min(W2-R, x)), side ? Math.max(R, Math.min(L2-R, y)) : Math.max(-L2+R, Math.min(-R, y))]; }
function setTarget(i, x, y){
  const side=V.mallets[i].side; [x,y]=clampT(side, x, y);
  if(NET.mode==='client'){ LOCAL.t[i]=[x,y]; const now=performance.now(); if(now-LOCAL.sendAt>30){ LOCAL.sendAt=now; if(NET.hostConn && NET.hostConn.open) try{ NET.hostConn.send({t:'mv', x:r1(x), y:r1(y)}); }catch(e){} } else { clearTimeout(LOCAL.tm); LOCAL.tm=setTimeout(()=>setTarget(i, x, y), 35); } }
  else if(RT && RT.ms[i]){ RT.ms[i].tx=x; RT.ms[i].ty=y; }
}
function pointerTable(e){
  const r=cv3.getBoundingClientRect(), T=THREE, ray=new T.Raycaster();
  ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1, -((e.clientY-r.top)/r.height)*2+1), R3.cam);
  const pt=new T.Vector3(); if(!ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0), -1.5), pt)) return null;
  return [pt.x, -pt.z];
}
function onPointer(e){
  if(!V || V.phase!=='play' || NET.obs || !R3.renderer) return;
  if(e.pointerType==='touch' || e.buttons || e.type==='pointermove'){
    const t=pointerTable(e); if(!t) return;
    const hs=humanLocals(); if(!hs.length) return;
    // con dos en el mismo aparato, cada uno maneja su mitad de la mesa
    let h = hs.length>1 ? (hs.find(x=>(x.m.side ? t[1]>0 : t[1]<0)) || hs[0]) : hs[0];
    if(e.pointerId!=null){ if(e.type==='pointerdown') INP[e.pointerId]=h.i; else if(INP[e.pointerId]!=null && hs.length>1) h=hs.find(x=>x.i===INP[e.pointerId])||h; }
    setTarget(h.i, t[0], t[1]);
  }
}
const INP={};
// teclado: WASD el de abajo y flechas el de arriba (si hay dos en el aparato); si hay uno, cualquiera de los dos
function keysMove(dt){
  if(!V || V.phase!=='play') return;
  const hs=humanLocals(); if(!hs.length) return;
  const K=LOCAL.keys, sets=[['w','s','a','d'],['arrowup','arrowdown','arrowleft','arrowright']];
  sets.forEach((ks,si)=>{
    const dy=(K[ks[0]]?1:0)-(K[ks[1]]?1:0), dx=(K[ks[3]]?1:0)-(K[ks[2]]?1:0); if(!dx && !dy) return;
    const h = hs.length>1 ? hs.find(x=>x.m.side===si) : hs[0]; if(!h) return;
    const flip = h.m.side===1 && hs.length===1 ? -1 : 1, src = NET.mode==='client' ? (LOCAL.t[h.i] || [0, h.m.side?80:-80]) : [RT.ms[h.i].tx, RT.ms[h.i].ty];
    setTarget(h.i, src[0]+dx*flip*520*dt, src[1]+dy*flip*520*dt);
  });
}
document.addEventListener('keydown', e=>{ if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT') return; const k=e.key.toLowerCase(); if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k) && V && V.phase==='play'){ LOCAL.keys[k]=true; e.preventDefault(); } });
document.addEventListener('keyup', e=>{ LOCAL.keys[e.key.toLowerCase()]=false; });
setInterval(()=>{ if(NET.mode==='client') keysMove(.016); }, 16);

/* ====================== MESA 3D ====================== */
const R3={renderer:null, ms:[], pucks:[]};
const CAM3=Object.assign({mode:'lado', zoom:1, auto:true}, load('tejo_cam3')||{});
function saveCam3(){ store('tejo_cam3', {mode:CAM3.mode, zoom:CAM3.zoom, auto:CAM3.auto}); }
const defaultCam = () => NET.mode==='local' && humanLocals().length>1 ? 'arriba' : 'lado';
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
  scene.background=canvasTex(4, 256, (g,w,h)=>{ const gr=g.createLinearGradient(0,0,0,h); gr.addColorStop(0,'#0b1030'); gr.addColorStop(1,'#2a1745'); g.fillStyle=gr; g.fillRect(0,0,w,h); });
  scene.fog=new T.Fog(0x1a1238, 500, 1400);
  const cam=new T.PerspectiveCamera(50, 1, 1, 4000);
  Object.assign(R3, {renderer, scene, cam, T});
  scene.add(new T.HemisphereLight(0xdfe8ff, 0x2a1d2e, .6));
  for(const z of [-60, 60]){ const l=new T.PointLight(0xffffff, .55, 420, 1.4); l.position.set(0, 130, z); l.castShadow=true; l.shadow.mapSize.set(mobile?512:1024, mobile?512:1024); l.shadow.bias=-.003; scene.add(l);
    const lamp=new T.Mesh(new T.BoxGeometry(60, 3, 14), new T.MeshBasicMaterial({color:0xfff6dc})); lamp.position.set(0, 136, z); scene.add(lamp); }
  // piso y paredes del salón
  const floor=new T.Mesh(new T.PlaneGeometry(2000,2000), new T.MeshStandardMaterial({roughness:.8, map:(()=>{ const t=canvasTex(256,256,(g,w,h)=>{ g.fillStyle='#2b2b3a'; g.fillRect(0,0,w,h); g.fillStyle='#3a3a4e'; g.fillRect(0,0,w/2,h/2); g.fillRect(w/2,h/2,w/2,h/2); }); t.wrapS=t.wrapT=T.RepeatWrapping; t.repeat.set(30,30); return t; })()}));
  floor.rotation.x=-Math.PI/2; floor.position.y=-80; floor.receiveShadow=true; scene.add(floor);
  R3.tableG=new T.Group(); scene.add(R3.tableG); R3.goalKey=null;
  // tejos y mazos
  R3.puckGeo=new T.CylinderGeometry(PR, PR, 1.3, 32);
  R3.puckMat=[new T.MeshStandardMaterial({color:0xd52b1e, roughness:.35}), new T.MeshStandardMaterial({roughness:.35, map:canvasTex(128,128,(g,w,h)=>{ g.fillStyle='#d52b1e'; g.fillRect(0,0,w,h); g.strokeStyle='#fff'; g.lineWidth=10; g.beginPath(); g.arc(w/2,h/2,40,0,7); g.stroke(); g.fillStyle='#f2c14e'; g.beginPath(); g.arc(w/2,h/2,14,0,7); g.fill(); })}), new T.MeshStandardMaterial({color:0x8a1a12})];
  R3.ring=new T.Mesh(new T.RingGeometry(1, 1.3, 40), new T.MeshBasicMaterial({color:0xffd54a, transparent:true, opacity:.8, side:T.DoubleSide, depthWrite:false})); R3.ring.rotation.x=-Math.PI/2; scene.add(R3.ring);
  cv3.addEventListener('pointerdown', onPointer); cv3.addEventListener('pointermove', onPointer);
  cv3.addEventListener('pointerup', e=>{ delete INP[e.pointerId]; }); cv3.addEventListener('pointercancel', e=>{ delete INP[e.pointerId]; });
  cv3.addEventListener('wheel', e=>{ e.preventDefault(); CAM3.zoom=Math.max(.6, Math.min(1.8, CAM3.zoom*(e.deltaY>0?1.06:.94))); saveCam3(); }, {passive:false});
  resizeStage();
  return true;
}
function disposeTree(o){ o.traverse(m=>{ if(m.geometry) m.geometry.dispose(); if(m.material){ (Array.isArray(m.material)?m.material:[m.material]).forEach(x=>{ if(x.map) x.map.dispose(); x.dispose(); }); } }); }
// arma la mesa (se rehace si cambia el ancho del arco)
function buildTable(){
  const T=THREE, G=R3.tableG, gh=goalHalf(V.opts);
  while(G.children.length){ const c=G.children[0]; G.remove(c); disposeTree(c); }
  const top=canvasTex(512,1024,(g,w,h)=>{
    const sx=w/(2*W2), sy=h/(2*L2), X=x=>(x+W2)*sx, Y=y=>(L2-y)*sy;
    const gr=g.createLinearGradient(0,0,w,0); gr.addColorStop(0,'#cfe4ff'); gr.addColorStop(.5,'#f4f9ff'); gr.addColorStop(1,'#cfe4ff'); g.fillStyle=gr; g.fillRect(0,0,w,h);
    g.fillStyle='rgba(30,60,120,.18)'; for(let x=6;x<w;x+=16) for(let y=6;y<h;y+=16) g.fillRect(x,y,2,2);   // agujeritos del aire
    g.strokeStyle='#d52b1e'; g.lineWidth=6; g.beginPath(); g.moveTo(0,Y(0)); g.lineTo(w,Y(0)); g.stroke();
    g.beginPath(); g.arc(X(0),Y(0),22*sx,0,7); g.stroke();
    for(const s of [-1,1]){ g.strokeStyle= s<0 ? '#d52b1e' : '#0038a8'; g.lineWidth=5; g.beginPath(); g.arc(X(0), Y(s*L2), (gh+10)*sx, 0, 7); g.stroke();
      g.globalAlpha=.25; g.beginPath(); g.moveTo(0,Y(s*L2*.5)); g.lineTo(w,Y(s*L2*.5)); g.stroke(); g.globalAlpha=1; }
    g.fillStyle='#f2c14e'; g.beginPath(); g.arc(X(0),Y(0),7*sx,0,7); g.fill();
    g.save(); g.translate(X(0), Y(0)); g.fillStyle='rgba(27,42,90,.22)'; g.font='900 52px system-ui'; g.textAlign='center'; g.fillText('TEJO PY', 0, -60); g.rotate(Math.PI); g.fillText('TEJO PY', 0, -60); g.restore();
  });
  const surfM=new T.MeshStandardMaterial({map:top, roughness:.25, metalness:.05}), sideM=new T.MeshStandardMaterial({color:0x1b2a5a, roughness:.6});
  const surf=new T.Mesh(new T.BoxGeometry(2*W2, 4, 2*L2), [sideM, sideM, surfM, sideM, sideM, sideM]); surf.position.y=-2; surf.receiveShadow=true; G.add(surf);
  // mueble de abajo con los colores de Paraguay
  const body=new T.Mesh(new T.BoxGeometry(2*W2+16, 70, 2*L2+16), new T.MeshStandardMaterial({roughness:.6, map:canvasTex(512,256,(g,w,h)=>{ g.fillStyle='#1b2a5a'; g.fillRect(0,0,w,h); g.fillStyle='#d52b1e'; g.fillRect(0,20,w,24); g.fillStyle='#fff'; g.fillRect(0,44,w,24); g.fillStyle='#0038a8'; g.fillRect(0,68,w,24); g.fillStyle='#f2c14e'; g.font='900 70px system-ui'; g.textAlign='center'; g.fillText('🏒 TEJO PY', w/2, 190); })}));
  body.position.y=-42; body.castShadow=true; body.receiveShadow=true; G.add(body);
  // bandas
  const railM=[new T.MeshStandardMaterial({color:0xd52b1e, roughness:.4}), new T.MeshStandardMaterial({color:0x0038a8, roughness:.4})], whiteM=new T.MeshStandardMaterial({color:0xf2f2f2, roughness:.4});
  for(const s of [-1,1]){ const r=new T.Mesh(new T.BoxGeometry(8, 7, 2*L2+16), whiteM); r.position.set(s*(W2+4), 1.5, 0); r.castShadow=true; G.add(r); }
  for(const s of [-1,1]){
    const m=railM[s<0?0:1], len=W2-gh;
    for(const sx of [-1,1]){ const r=new T.Mesh(new T.BoxGeometry(len, 7, 8), m); r.position.set(sx*(gh+len/2), 1.5, -s*(L2+4)); r.castShadow=true; G.add(r); }
    const slot=new T.Mesh(new T.BoxGeometry(2*gh, 2, 8), new T.MeshBasicMaterial({color:0x050505})); slot.position.set(0, -1.2, -s*(L2+4)); G.add(slot);
    const cap=new T.Mesh(new T.BoxGeometry(2*gh+4, 3, 6), m); cap.position.set(0, 4, -s*(L2+7)); G.add(cap);
  }
}
function malletMesh(col){
  const T=THREE, g=new T.Group(), R=mr(V.opts), mat=new T.MeshStandardMaterial({color:col, roughness:.35});
  const base=new T.Mesh(new T.CylinderGeometry(R, R, 2.2, 36), mat); base.position.y=1.1; base.castShadow=true; g.add(base);
  const dome=new T.Mesh(new T.CylinderGeometry(R*.75, R*.95, 2.5, 36), mat); dome.position.y=3.3; g.add(dome);
  const knob=new T.Mesh(new T.CylinderGeometry(R*.32, R*.42, 6, 20), mat); knob.position.y=7; knob.castShadow=true; g.add(knob);
  const ball=new T.Mesh(new T.SphereGeometry(R*.42, 20, 14), new T.MeshStandardMaterial({color:0xffffff, roughness:.3})); ball.position.y=10.2; g.add(ball);
  R3.scene.add(g); return g;
}
function draw3D(){
  const T=THREE, now=performance.now(), gk=V.opts.goal+'|'+V.opts.mazo;
  if(R3.goalKey!==gk){ R3.goalKey=gk; buildTable(); R3.ms.forEach(m=>{ R3.scene.remove(m.g); disposeTree(m.g); }); R3.ms=[]; }
  // mazos
  const mk=V.mallets.map(m=>m.pid+(V.players.find(p=>p.id===m.pid)||{}).color).join('|');
  if(R3.mk!==mk){ R3.mk=mk; R3.ms.forEach(m=>{ R3.scene.remove(m.g); disposeTree(m.g); }); R3.ms=V.mallets.map(m=>({g:malletMesh((V.players.find(p=>p.id===m.pid)||{}).color||'#888')})); }
  const vt = V.phase==='lobby' ? null : viewTable();
  let myM=null;
  V.mallets.forEach((m,i)=>{
    const o=R3.ms[i]; if(!o) return;
    let x, y;
    if(NET.mode==='client' && LOCAL.t[i] && mine(m.pid)){ [x,y]=LOCAL.t[i]; }
    else if(vt && vt.m[i]){ [x,y]=vt.m[i]; }
    else { x=0; y=m.side?80:-80; }
    o.g.position.set(x, 0, -y); o.g.visible=true;
    if(mine(m.pid) && !NET.obs) myM=[x,y];
  });
  R3.ring.visible=!!myM && humanLocals().length===1; if(myM){ const R=mr(V.opts); R3.ring.scale.set(R+1.2, R+1.2, 1); R3.ring.position.set(myM[0], .15, -myM[1]); }
  // tejos
  const ps = vt ? vt.p : [];
  while(R3.pucks.length<ps.length){ const m=new T.Mesh(R3.puckGeo, R3.puckMat); m.castShadow=true; R3.scene.add(m); R3.pucks.push(m); }
  R3.pucks.forEach((m,i)=>{ const p=ps[i]; m.visible=!!p && !!p[2]; if(p){ m.position.set(p[0], .65, -p[1]); m.rotation.y+=.05; } });
  // cuenta regresiva
  const go=V.phase==='play' ? Math.ceil((V.goAt-hostMs())/1000) : -9;
  if(go!==R3.lastGo){ R3.lastGo=go; if(go>0 && go<=3){ bigText(String(go)); sfx.beep(false); } else if(go===0){ bigText('¡YA!'); sfx.beep(true); } }
  // el aire suena mientras se juega
  if(V.phase==='play' && $('#game').classList.contains('on')) airStart(); else airStop();
  // cámara
  const s=mySideView(), dz = s ? -1 : 1, z=CAM3.zoom, cam=R3.cam, asp=Math.max(.3, Math.min(4, cam.aspect||1)), portrait=asp<1;
  let want, look; cam.up.set(0,1,0);
  if(CAM3.mode==='arriba'){
    const tf=Math.tan(25*Math.PI/180), fitL=(L2+14)/tf, fitW=(W2+14)/(tf*asp);
    if(portrait){ want=new T.Vector3(0, Math.max(fitL, fitW)*z, dz*1); cam.up.set(0,0,-dz); }
    else { const fL=(L2+14)/(tf*asp), fW=(W2+14)/tf; want=new T.Vector3(0, Math.max(fL, fW)*z, 0); cam.up.set(-dz,0,0); }
    look=new T.Vector3(0,0,0);
  } else if(CAM3.mode==='costado'){ want=new T.Vector3(170*z, 120*z, 0); look=new T.Vector3(0,0,0); }
  else { const back=(portrait?185:150)*z, hgt=(portrait?175:120)*z; want=new T.Vector3(0, hgt, dz*back); look=new T.Vector3(0, 0, -dz*(portrait?15:25)); }
  if(R3.camMode!==CAM3.mode+'|'+s || !isFinite(cam.position.x+cam.position.y+cam.position.z)){ R3.camMode=CAM3.mode+'|'+s; cam.position.copy(want); R3.camLook=look.clone(); }
  cam.position.lerp(want, .12); R3.camLook.lerp(look, .12); cam.lookAt(R3.camLook);
  // destello del gol
  const fl=R3.flash; R3.scene.background && (R3.renderer.toneMappingExposure=1);
  if(fl && now-fl.at<700){ const k=1-(now-fl.at)/700; R3.scene.fog.color.setRGB(.1+.4*k*(fl.side?0:1), .07, .22+.4*k*(fl.side?1:0)); } else R3.scene.fog.color.setHex(0x1a1238);
  R3.renderer.render(R3.scene, cam);
}
function cam3(k, d){
  if(k==='zoom') CAM3.zoom=Math.max(.6, Math.min(1.8, CAM3.zoom*(d>0?.88:1.14)));
  else { CAM3.mode=k; CAM3.auto=false; }
  saveCam3();
}
function loop(){
  requestAnimationFrame(loop);
  if(!V || V.phase==='lobby' || !$('#game').classList.contains('on') || !R3.renderer){ airStop(); return; }
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
  $('#histList').innerHTML = L.map((l,i)=>`<div class="hline ${i<fresh&&fresh<5?'new':''}">${esc(l.x)}</div>`).join('') || '<p class="muted">Todavía no hubo goles.</p>';
}
function renderMesaTab(){
  const host=amHost(), inPlay=V.phase!=='lobby';
  const ps=V.players.map(p=>{
    const offline=!p.bot&&!p.conn;
    return `<div class="prow" style="border-left:5px solid ${p.color}"><span style="font-size:22px">${esc(p.emoji)}</span><span class="nm"><b>${esc(p.name)}${p.id===me()?' (vos)':''}${p.id===V.hostPid&&NET.mode!=='local'?' 👑':''}</b>
      <small>${V.opts.fmt==='parejas'?TEAMS[p.team].e+' '+TEAMS[p.team].n:''}${V.crowns&&V.crowns[p.id]?' · '+'👑'.repeat(V.crowns[p.id]):''}${p.bot?' · 🤖 bot':''}${p.mic?' · 🎙️':''}${offline?' · ⚠️ sin conexión':''}${inPlay&&playing(V,p.id)?' · 🏒 jugando':''}</small></span>
      ${host&&p.id!==V.hostPid&&NET.mode!=='local'?`${offline&&inPlay?`<button class="btn sm gray" onclick="doAct({type:'botify',pid:'${p.id}'})" title="Que juegue un bot">🤖</button>`:''}<button class="btn sm gray" onclick="if(confirm('¿Sacar a ${esc(p.name)} de la mesa?'))doAct({type:'kick',pid:'${p.id}'})" title="Sacar">✕</button>`:''}</div>`;
  }).join('');
  const obs=(V.observers||[]).map(o=>`<div class="prow"><span style="font-size:20px">${o.owner?'👑':'👀'}</span><span class="nm"><b>${esc(o.name)}${o.id===me()?' (vos)':''}</b><small>${o.owner?'dueño del juego, ':''}mirando${o.mic?' · 🎙️':''}</small></span></div>`).join('');
  const sit = NET.obs && (V.phase==='lobby'||V.phase==='over') && V.players.length<MAXP ? `<button class="btn gold wide" onclick="doAct({type:'joinNext'})">🏒 Sumarme a jugar</button>` : NET.obs ? `<p class="muted">Te podés sumar cuando termine la partida (si hay lugar).</p>` : '';
  $('#mesaList').innerHTML = `<b>Jugadores (${V.players.length}/${MAXP})</b>` + ps + (obs?`<b>Mirando</b>${obs}`:'') + sit
    + (host && inPlay ? `<button class="btn dark wide" style="margin-top:8px" onclick="if(confirm('¿Terminar la partida y volver a la sala?'))doAct({type:'newGame',force:true})">⚙️ Terminar y volver a la sala</button>` : '')
    + (NET.mode!=='local'&&NET.code?`<p class="muted" style="margin-top:12px">Invitá con el código <b>${NET.code}</b> <button class="btn sm" onclick="shareRoom()">📤 Compartir</button></p>`:'');
}
function renderReglasTab(){
  const o=V.opts, on=HOUSE.filter(h=>o[h.k]), host=amHost();
  $('#reglasList').innerHTML = `<p style="margin-top:0"><b>${esc(FORMATS[o.fmt].t)}</b></p><p class="muted">${esc(FORMATS[o.fmt].d)}</p>`
    + `<p class="muted">A ${o.goals} goles${o.fmt==='rey'?` · ${o.crowns} coronas`:''} · ${o.time?`⏰ ${o.time/60} min`:'sin tiempo'} · ${o.pucks} tejo${o.pucks>1?'s':''} · ${esc(SPEEDS[o.speed].t)} · arco ${esc(o.goal)}</p>`
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
  const url=roomLink(), text=`¡Vení a jugar al Tejo conmigo! 🏒🇵🇾 Sala ${NET.code}`;
  if(navigator.share) return navigator.share({title:'Tejo PY', text, url}).catch(()=>{});
  modal(`<h2>📤 Invitar a la sala ${NET.code}</h2><p style="word-break:break-all;user-select:all;background:#fff;padding:8px;border-radius:8px">${esc(url)}</p>
    <a class="btn green wide" style="display:block;text-align:center;text-decoration:none" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text+' '+url)}">💬 Mandar por WhatsApp</a>
    <button class="btn wide" style="margin-top:6px" onclick="navigator.clipboard.writeText('${url}').then(()=>toast('Enlace copiado'))">📋 Copiar enlace</button>
    <button class="btn gray wide" style="margin-top:6px" onclick="closeModal()">Cerrar</button>`);
}
function showRules(){
  modal(`<div class="rules"><h2>📜 Cómo se juega</h2>
  <p>Cada uno tiene un mazo y defiende el arco de su lado. El tejo se desliza sobre el aire de la mesa: pegale para meterlo en el arco del otro. No podés pasar la línea del medio.</p>
  <h3>🕹️ Controles</h3><ul><li><b>Celular:</b> arrastrá el dedo sobre la mesa y el mazo lo sigue.</li><li><b>PC:</b> mové el mouse sobre la mesa. También con WASD o las flechas.</li>
  <li><b>Dos en el mismo aparato:</b> cada uno toca su mitad de la mesa (o uno con WASD y el otro con las flechas).</li><li><b>Cámaras:</b> 🎯 desde tu arco, 🔭 desde arriba, 📐 de costado.</li></ul>
  <h3>🎮 Modos</h3>${Object.keys(FORMATS).map(k=>`<p><b>${FORMATS[k].t}:</b> ${FORMATS[k].d}</p>`).join('')}
  <p>Gana el que llega primero a los goles que se eligieron. Si hay tiempo, cuando se termina gana el que va ganando.</p>
  <h3>🏠 Reglas de la casa</h3>${HOUSE.map(h=>`<p><b>${h.t}:</b> ${h.d}</p>`).join('')}
  <p><b>Varios tejos:</b> con 2 o 3 tejos a la vez hay que atajar todo. <b>Velocidad:</b> en Turbo el tejo casi no se frena.</p>
  <p class="muted">En línea, el que crea la sala es el que mueve la mesa: conviene que tenga buena conexión y no cierre el juego.</p>
  </div><button class="btn wide" onclick="closeModal()">Entendido</button>`);
}
