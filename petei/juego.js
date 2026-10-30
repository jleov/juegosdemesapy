'use strict';
/* =====================================================================
   Peteĩ — red (PeerJS), chat con privados, voz, mesa 2D/3D,
   la mano del jugador, animaciones y sonidos.
   ===================================================================== */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function store(k,v){ try{ if(v===undefined) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
function load(k){ try{ const v=localStorage.getItem(k); return v==null?null:JSON.parse(v); }catch(e){ return null; } }
function toast(x){ const t=$('#toast'); t.textContent=x; t.style.display='block'; clearTimeout(toast.t); toast.t=setTimeout(()=>t.style.display='none', 3800); }
const PREFIX='unopy26-';
const genCode = () => { const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s=''; for(let i=0;i<5;i++) s+=A[rnd(A.length)]; return s; };
let myToken=load('uno_token'); if(!myToken){ myToken=Math.random().toString(36).slice(2)+Date.now().toString(36); store('uno_token', myToken); }
const NET={mode:null, peer:null, code:null, conns:{}, hostConn:null, myPid:null, obs:null, welcomed:false};
let CHAT=[], V=null;
const me = () => NET.myPid || NET.obs;
const VP = id => V && (V.players.find(p=>p.id===id) || (V.observers||[]).find(o=>o.id===id));
const amHost = () => NET.mode==='local' || (V && V.hostPid===NET.myPid && NET.mode==='host');

/* ====================== MENÚ ====================== */
let myEmojiSel = load('uno_emoji') || EMOJIS[0];
const myName = () => ($('#myName').value.trim() || 'Jugador').slice(0,16);
const myEmoji = () => myEmojiSel;
$('#myName').value = load('uno_name') || '';
$('#myName').addEventListener('input', ()=>store('uno_name', $('#myName').value.trim()));
function renderTokenPicker(){
  $('#tokens').innerHTML = EMOJIS.map(e=>`<button class="tok ${e===myEmojiSel?'sel':''}" onclick="pickEmoji('${e}')">${e}</button>`).join('');
}
function pickEmoji(e){ myEmojiSel=e; store('uno_emoji', e); renderTokenPicker(); }
renderTokenPicker();
$('#logoCards').innerHTML = [{id:1,c:'r',v:'7'},{id:2,c:'y',v:'1'},{id:3,c:'w',v:'d4'},{id:4,c:'g',v:'rev'},{id:5,c:'b',v:'9'}]
  .map((c,i)=>cardHTML(c,'', `transform:rotate(${(i-2)*11}deg) translateY(${Math.abs(i-2)*6}px)`)).join('');
function needName(){ if(!$('#myName').value.trim()){ toast('Escribí tu nombre primero ✍️'); $('#myName').focus(); return true; } store('uno_name', myName()); return false; }
function joinClick(){
  const code=$('#joinCode').value.trim().toUpperCase(); if(!code) return toast('Escribí el código de la sala.');
  if(needName()) return; clientJoin(code);
}
function resumeClick(){
  const h=load('uno_host'), c=load('uno_client');
  if(h && (!c || h.at>=c.at)) return hostStart(true);
  if(c){ if(needName()) return; clientJoin(c.code); }
}
function refreshResume(){
  const h=load('uno_host'), c=load('uno_client'), ok=x=>x && Date.now()-x.at<6*3600e3;
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
  S=lobbyState(); S.opts=Object.assign(defaultOpts(), load('uno_localopts')||{});
  const p=addPlayer(myName(), myEmoji(), myToken, null); NET.myPid=p.id; S.hostPid=p.id;
  const n=+$('#nBots').value; for(let i=0;i<n;i++) addBot();
  startGame(); sysChat('🃏 Partida de práctica contra bots. Las reglas de la casa se cambian en la pestaña 🏠 Reglas (para la próxima partida).');
  LAST.ev=null; FACES={}; commit(); shareMyFace();
}
function leaveClick(){
  if(NET.mode==='local'){ if(S && S.phase==='play' && !confirm('¿Salir de la partida contra los bots?')) return; return leaveToMenu(); }
  if(!confirm('¿Salir de la sala?')) return;
  if(NET.mode==='host'){
    const others=hostCandidates(S);
    if(others.length) return hostHandover();
    store('uno_host', undefined);
  } else if(NET.mode==='client'){
    if(NET.hostConn && NET.hostConn.open && NET.myPid) try{ NET.hostConn.send({t:'act', a:{type:'leave'}}); }catch(e){}
    store('uno_client', undefined);
  }
  setTimeout(leaveToMenu, 250);
}
function leaveToMenu(){
  camsReset();
  musicStop();
  stopMic(false);
  try{ if(NET.peer) NET.peer.destroy(); }catch(e){}
  Object.assign(NET,{mode:null, peer:null, code:null, conns:{}, hostConn:null, myPid:null, obs:null, welcomed:false, backup:null});
  S=null; V=null; CHAT=[]; LAST.ev=null; closeModal(); netBar(false);
  history.replaceState(null,'',location.pathname);
  show('menu');
}

/* ====================== RED ====================== */
function publicState(forPid){
  const s=JSON.parse(JSON.stringify(S));
  s.players.forEach(p=>{ delete p.token; p.n=p.hand.length; if(p.id!==forPid) p.hand=null; });
  (s.observers||[]).forEach(o=>delete o.token);
  s.deckN=s.deck.length; s.deck=null;
  if(s.pending4) delete s.pending4.illegal;
  delete s.ownerTok;
  if(s.peek && s.peek.to!==forPid) s.peek=null;
  s.ev.forEach(e=>{ if(e.pid!==forPid) delete e.ids; });
  return s;
}
function commit(){
  if(NET.mode==='host'){
    for(const pid in NET.conns){ const c=NET.conns[pid]; if(c && c.open) try{ c.send({t:'state', s:publicState(pid)}); }catch(e){} }
    sendBackups();
    if(!NET.noSave) store('uno_host', {code:NET.code, S, CHAT:CHAT.slice(-80), myPid:NET.myPid, at:Date.now()});
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
  const saved = resume ? load('uno_host') : null;
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
    if(resume){ toast('La sala sigue abierta en otro aparato (otro jugador quedó de anfitrión). Entrá con el código.'); peer.destroy(); store('uno_host',undefined); NET.mode=null; $('#joinCode').value=NET.code; return; }
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
  store('uno_host', undefined);
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
        why = S.players.length>=MAXP ? 'La mesa está llena (10 jugadores): entraste a mirar 👀.' : 'La partida ya empezó: entraste a mirar 👀. Te podés sentar cuando termine la mano.';
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
// un observador se sentó a la mesa: su conexión pasa a ser la del jugador nuevo
function onSeatChange(oldId, newId){
  if(NET.mode!=='host') return;
  const c=NET.conns[oldId]; if(!c) return;
  delete NET.conns[oldId]; NET.conns[newId]=c; c.pid=newId;
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
  if(mine){ if(S.phase==='lobby') S.players=S.players.filter(p=>p!==mine); else { mine.bot=true; mine.conn=false; mine.token=null; log(`🚪 ${mine.name} se fue: un bot sigue con sus cartas.`); } }
  const c=NET.conns[next.id];
  try{ c.send({t:'migrate', s:S, chat:CHAT.slice(-80)}); }catch(e){}
  NET.noSave=true; store('uno_host', undefined);
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
      if(!NET.welcomed){ toast('No se encontró la sala '+code+'. Revisá el código.'); store('uno_client',undefined); leaveToMenu(); }
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
    store('uno_client',{code:NET.code, at:Date.now()}); if(location.hash!=='#'+NET.code) history.replaceState(null,'','#'+NET.code);
    if(d.why) toast(d.why);
    setTimeout(shareMyFace, 300);   // mi foto, si tengo
  }
  else if(d.t==='state'){ S=d.s; render(); }
  else if(d.t==='chat'){ CHAT.push(d.m); renderChat(d.m); }
  else if(d.t==='chatlog'){ CHAT=d.list||[]; renderChat(); }
  else if(d.t==='faces' || d.t==='face') clientFace(d);
  else if(d.t==='backup'){ NET.backup={s:d.s, chat:d.chat}; }
  else if(d.t==='migrate'){ NET.backup={s:d.s, chat:d.chat}; takeoverHost('handover'); }
  else if(d.t==='kicked'){ toast('🚪 El anfitrión te sacó de la mesa.'); store('uno_client',undefined); leaveToMenu(); }
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
  if(open){ setTab('chat'); }
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
// pedir en secreto un color o un número a alguien
function askSecret(what){
  const to=$('#chatTo').value;
  if(!to){ toast('Primero elegí a quién (en “Para”, abajo) o escribí @nombre. Los pedidos en secreto solo los ve esa persona 🤫'); $('#chatTo').focus(); return; }
  const txt = COLOR_INFO[what] ? `🤫 ¿Me tirás ${COLOR_INFO[what].emo} ${COLOR_INFO[what].n}?` : what==='no +4' ? '🤫 Porfa, no me tires un +4 😇' : `🤫 ¿Me tirás un ${what}?`;
  sendChatRaw(txt, to);
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
const SND={on:load('uno_snd')!==false, ctx:null};
function actx(){ if(!SND.ctx){ try{ SND.ctx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } if(SND.ctx && SND.ctx.state==='suspended') SND.ctx.resume(); return SND.ctx; }
function tone(f, d, type, v, when){
  if(!SND.on) return; const c=actx(); if(!c) return;
  const t=c.currentTime+(when||0), o=c.createOscillator(), g=c.createGain();
  o.type=type||'sine'; o.frequency.setValueAtTime(f,t); g.gain.setValueAtTime(v||.12,t); g.gain.exponentialRampToValueAtTime(.001,t+d);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t+d+.02);
}
function noise(d, v, when, hp){
  if(!SND.on) return; const c=actx(); if(!c) return;
  const t=c.currentTime+(when||0), b=c.createBuffer(1, c.sampleRate*d, c.sampleRate), ch=b.getChannelData(0);
  for(let i=0;i<ch.length;i++) ch[i]=(Math.random()*2-1)*(1-i/ch.length);
  const s=c.createBufferSource(), g=c.createGain(), f=c.createBiquadFilter(); f.type='highpass'; f.frequency.value=hp||1800;
  s.buffer=b; g.gain.value=v||.2; s.connect(f).connect(g).connect(c.destination); s.start(t);
}
const sfx={
  card(){ noise(.09,.35,0,2200); tone(180,.06,'triangle',.1,.02); },
  draw(k){ for(let i=0;i<Math.min(k||1,6);i++) noise(.06,.18,i*.09,3000); },
  turn(){ tone(740,.12,'sine',.14); tone(988,.18,'sine',.14,.11); },
  uno(){ tone(660,.13,'square',.08); tone(880,.25,'square',.08,.12); },
  catch(){ tone(320,.25,'sawtooth',.1); tone(220,.35,'sawtooth',.1,.2); },
  win(){ [523,659,784,1047].forEach((f,i)=>tone(f,.3,'triangle',.14,i*.13)); },
  priv(){ tone(1200,.08,'sine',.08); tone(1500,.1,'sine',.08,.08); },
  shuffle(){ for(let i=0;i<8;i++) noise(.04,.15,i*.05,2500); },
};
function say(t){ if(!SND.on || !window.speechSynthesis) return; try{ const u=new SpeechSynthesisUtterance(t); u.lang='es-ES'; u.rate=1.1; u.pitch=1.2; speechSynthesis.cancel(); speechSynthesis.speak(u); }catch(e){} }
function toggleSound(){ SND.on=!SND.on; store('uno_snd', SND.on); $('#btnSnd').textContent=SND.on?'🔊':'🔇'; if(SND.on) sfx.turn(); }
$('#btnSnd').textContent=SND.on?'🔊':'🔇';
document.addEventListener('pointerdown', ()=>actx(), {once:true});
// música de fondo: la misma del Banquero, suave, en la sala y en la partida (no en el menú)
const MUSIC_CREDIT = 'Música: "Monkeys Spinning Monkeys" de Kevin MacLeod (incompetech.com). Licencia Creative Commons Atribución 4.0: creativecommons.org/licenses/by/4.0/';
const MUSIC = { on: load('uno_music')!==false, buf:null, src:null, gain:null, loading:false, VOL:.1 };
function musicLoad(){
  if(MUSIC.buf || MUSIC.loading) return Promise.resolve(); MUSIC.loading=true;
  const c=actx(); if(!c){ MUSIC.loading=false; return Promise.resolve(); }
  return fetch('musica.mp3').then(r=>r.arrayBuffer()).then(b=>c.decodeAudioData(b)).then(buf=>{ MUSIC.buf=buf; }).catch(()=>{ MUSIC.loading=false; });
}
function musicStart(){
  if(!MUSIC.on || MUSIC.src) return;
  musicLoad().then(()=>{
    if(!MUSIC.buf || MUSIC.src || !MUSIC.on || !musicWanted()) return;
    const c=actx(), s=c.createBufferSource(), g=c.createGain();
    s.buffer=MUSIC.buf; s.loop=true; s.connect(g); g.connect(c.destination);
    g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.exponentialRampToValueAtTime(MUSIC.VOL, c.currentTime+2.5);   // entra suave
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
function toggleMusic(){ MUSIC.on=!MUSIC.on; store('uno_music', MUSIC.on); musicSync(); toast(MUSIC.on?'🎶 Música de fondo prendida (suave).':'🔕 Música de fondo apagada.'); }
function renderMusicBtn(){ $$('.btnMusic').forEach(b=>{ b.textContent = MUSIC.on ? '🎶' : '🔕'; b.title = MUSIC.on ? 'Apagar la música de fondo' : 'Prender la música de fondo'; }); }
renderMusicBtn(); $('#musicCredit').textContent='🎶 '+MUSIC_CREDIT;

/* ====================== CARTAS ====================== */
function cardHTML(c, cls, style){
  if(!c) return '';
  const vi=VAL_INFO[c.v], wild=isWild(c), sym=valSym(c);
  const bc = c.v==='d2'||c.v==='d4' ? 'big plus' : c.v==='skip'||c.v==='rev' ? 'big sym' : 'big';
  const cor = c.v==='wild' ? '★' : sym;
  return `<div class="card c-${c.c} v-${c.v} ${cls||''}" data-id="${c.id}"${style?` style="${style}"`:''}><div class="in">`
    + (wild?'<div class="nandu"></div>':'<div class="oval"></div>')
    + `<div class="${bc}">${c.v==='wild'?'':esc(sym)}</div><span class="cor tl">${cor}</span><span class="cor br">${cor}</span>`
    + `<span class="ico">${vi.ico}</span><span class="ref">${esc(vi.ref)}</span></div></div>`;
}
function backHTML(cls, style){
  return `<div class="card back ${cls||''}"${style?` style="${style}"`:''}><div class="in"><span class="py">PARAGUAY</span><div class="oval"></div><div class="big">PETEĨ</div><span class="flag"></span></div></div>`;
}
const hashRot = id => ((id*37)%28)-14;
const hashOff = id => [((id*13)%9)-4, ((id*7)%7)-3];

/* ====================== RENDER ====================== */
const LAST={ev:null, turnKey:null, endKey:null, peekAt:null, dismissedEnd:null};
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

// ---------- sala de espera ----------
function renderLobby(){
  const host=amHost(), myObs=!!NET.obs;
  $('#lobbyCode').textContent=NET.code||'—';
  $('#lobbyCodeBox').style.display = NET.mode==='local' ? 'none' : '';
  $('#pcount').textContent=`(${V.players.length}/10)`;
  $('#plist').innerHTML=V.players.map(p=>`<li>${playerTag(p)}${host && p.id!==V.hostPid?`<button class="btn sm gray" onclick="doAct({type:'kick',pid:'${p.id}'})" title="Sacar">✕</button>`:''}</li>`).join('')
    + (V.observers||[]).map(o=>`<li style="opacity:.75"><span style="font-size:20px">👀</span><span class="nm">${esc(o.name)} <span class="muted">mirando</span></span>${o.mic?'🎙️':''}</li>`).join('');
  $('#lobbyHostBtns').innerHTML = host
    ? `<div class="row"><button class="btn gray" onclick="doAct({type:'addBot'})" ${V.players.length>=10?'disabled':''}>🤖 Sumar bot</button>
       <button class="btn green" onclick="doAct({type:'start'})" ${V.players.length<2?'disabled':''}>▶️ Empezar</button></div>
       <p class="muted">Con menos de 2 jugadores sumá un bot. Si alguien se corta en la partida, un bot juega por él hasta que vuelva.</p>`
    : `<p class="muted" style="text-align:center">⏳ Esperando que el anfitrión 👑 empiece la partida…</p>`;
  $('#lobbyObs').innerHTML = myObs ? `<div class="obsbar" style="border-radius:10px;margin-top:8px">👀 Estás mirando. ${V.players.length<10?`<button class="btn sm gold" onclick="doAct({type:'joinNext'})">🪑 Sentarme a jugar</button>`:'La mesa está llena.'}</div>` : '';
  $('#optsBox').innerHTML = optsHTML(host);
  const g=$('#grulesBox');
  if(host){
    if(!g.querySelector('textarea')) g.innerHTML=`<textarea id="grulesIn" maxlength="1200" placeholder="Ej.: el que se olvida de cantar Peteĩ paga el tereré 🧉&#10;No vale tirar +4 al que tiene 1 carta…"></textarea><p class="muted" style="margin:4px 0 0">Se guarda solo y lo ven todos.</p>`;
    const ta=$('#grulesIn'); if(document.activeElement!==ta) ta.value=V.grules||'';
    ta.oninput=()=>{ clearTimeout(ta.t); ta.t=setTimeout(()=>doAct({type:'grules', text:ta.value}), 600); };
  } else g.innerHTML = V.grules ? `<div class="grules">${esc(V.grules)}</div>` : `<p class="muted">El anfitrión todavía no escribió reglas propias.</p>`;
  $('#sugBox').innerHTML = sugsHTML(host);
}
function optsHTML(host){
  const o=V.opts, dis = host && V.phase==='lobby' ? '' : 'disabled';
  return `<label style="margin-top:0">Partida</label><select ${dis} onchange="doAct({type:'opt',k:'target',v:this.value})">${TARGETS.map(t=>`<option value="${t.v}" ${o.target==t.v?'selected':''}>${t.t}</option>`).join('')}</select>
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
function renderGame(){
  const before={};
  $$('#hand .card').forEach(el=>before[el.dataset.id]=el.getBoundingClientRect());
  $('#roomTag').textContent = NET.mode==='local' ? '🤖 Práctica' : '🔑 '+NET.code;
  $('#obsbar').style.display = NET.obs ? 'block' : 'none';
  if(NET.obs) $('#obsbar').innerHTML = `👀 Estás mirando la partida (no se ven las cartas de nadie).`;
  applyView();
  renderSeats(); renderCenter(); renderHand(); renderActions();
  processEvents(before);
  turnNotice();
  roundModal(); peekModal();
}
function seatOrder(){
  const n=V.players.length, mi=V.players.findIndex(p=>p.id===me());
  return {n, base: mi<0 ? 0 : mi, mi};
}
// en 3D los que están a los costados giran un poco sus cartas hacia la cámara (si no, se verían de canto)
const rot3 = r => { const d=((180-r+540)%360)-180; return r + d*.45; };
function renderSeats(){
  if(!V || V.phase==='lobby') return;
  const {n, base, mi} = seatOrder(), curId=V.players[V.turn] && V.players[V.turn].id;
  let h='';
  V.players.forEach((p,i)=>{
    const r=(i-base+n)%n, ang=90+r*360/n, rad=ang*Math.PI/180;
    const rx=window.innerWidth<600?40:47, x=50+rx*Math.cos(rad), y=50+46*Math.sin(rad);
    const cnt = p.hand ? p.hand.length : p.n;
    const isMe = i===mi;
    let fan='';
    if(!isMe){
      const k=Math.min(cnt, 14), spread=Math.min(70, k*7);
      for(let j=0;j<k;j++){ const a = k>1 ? -spread/2 + spread*j/(k-1) : 0; fan+=backHTML('mini', `transform:translateX(-50%) rotate(${a}deg)`); }
    }
    const b=BUB[p.id], bub = b && Date.now()-b.at<4500 ? `<div class="bub">${esc(b.x.slice(0,90))}</div>` : '';
    const offline=!p.bot && !p.conn;
    h+=`<div class="seat ${p.id===curId&&V.phase==='play'?'turn':''} ${offline?'off':''} ${isMe?'me':''}" data-pid="${p.id}" style="left:${x}%;top:${y}%">
      ${isMe?'':`<div class="fan" style="--rot:${ang-90}deg;--rot3:${rot3(ang-90)}deg">${fan}</div>`}
      ${isMe?"":headHTML(p)}<div class="tag" style="--pc:${p.color}"><span class="av">${esc(p.emoji)}</span><span><b>${esc(p.name)}${isMe?' (vos)':''}</b><small>🂠 ${cnt}${V.opts.target?` · ${p.score} pts`:''}${p.bot?' · 🤖':''}${p.mic?' · 🎙️':''}${offline?' · ⚠️ sin conexión':''}${p.id===V.hostPid&&NET.mode!=='local'?' · 👑':''}</small></span>
      ${cnt===1&&V.phase==='play'?'<span class="unob">¡Peteĩ!</span>':''}</div>${bub}</div>`;
  });
  $('#seats').innerHTML=h;
  headsAfterRender();
}
function renderCenter(){
  const t=V.discard[V.discard.length-1];
  const deckN=V.deckN!=null?V.deckN:(V.deck||[]).length;
  const can = isMyTurnPlain() && !V.drawn;
  let layers=''; if(VIEW.mode==='3d'){ const L=Math.min(14, Math.ceil(deckN/6)); for(let i=0;i<L;i++) layers+=`<i style="transform:translateZ(${-i*1.5-1}px)"></i>`; }
  $('#deck').className='pila'+(can?' can':'');
  $('#deck').innerHTML=`<div class="layers">${layers}</div>${backHTML('stack')}<div class="n">${deckN} en el mazo</div>`;
  const last=V.discard.slice(-6);
  const col = V.color ? COLOR_INFO[V.color].hex : '#fff';
  $('#discard').style.setProperty('--col', col);
  $('#discard').innerHTML=`<div class="glow"></div>`+last.map((c,i)=>{ const [dx,dy]=hashOff(c.id); return cardHTML(c, i===last.length-1?'topc':'mini', `transform:translate(${dx}px,${dy}px) rotate(${hashRot(c.id)}deg)${VIEW.mode==='3d'?` translateZ(${i*1.2}px)`:''}`); }).join('')
    + (V.pendingDraw?`<span class="pend">+${V.pendingDraw}</span>`:'')
    + `<div class="colchip" style="--col:${col}"><i></i>${V.color?COLOR_INFO[V.color].n:'eligiendo color…'}</div>`;
  const dr=$('#dirring'); dr.classList.toggle('rev', V.dir===-1);
  dr.title = V.dir===1 ? 'El juego va para la izquierda (sentido del reloj)' : 'El juego va al revés';
}
const meP = () => V && V.players.find(p=>p.id===me());
const isMyTurnPlain = () => V && V.phase==='play' && V.players[V.turn] && V.players[V.turn].id===me() && !V.pending4 && !V.pickColor;
const SORT={mode:load('uno_sort')||'color'};
function sortHand(h){
  const co={r:0,y:1,g:2,b:3,w:4}, vo=v=>v==='skip'?10:v==='rev'?11:v==='d2'?12:v==='wild'?13:v==='d4'?14:+v;
  if(SORT.mode==='color') return h.slice().sort((a,b)=>co[a.c]-co[b.c] || vo(a.v)-vo(b.v));
  if(SORT.mode==='num') return h.slice().sort((a,b)=>vo(a.v)-vo(b.v) || co[a.c]-co[b.c]);
  return h;
}
function cycleSort(){ SORT.mode = SORT.mode==='color'?'num':SORT.mode==='num'?'none':'color'; store('uno_sort', SORT.mode); renderHand(); toast(SORT.mode==='color'?'Ordenadas por color':SORT.mode==='num'?'Ordenadas por número':'En el orden en que llegaron'); }
function cardOk(p, c){
  if(V.phase!=='play') return false;
  if(isMyTurnPlain() && (!V.drawn || c.id===V.drawn) && canPlay(c)) return true;
  return V.opts.jumpIn && canJumpIn(p, c);
}
function renderHand(){
  const el=$('#hand'), p=meP();
  el.classList.toggle('v3dh', VIEW.mode==='3d');
  $('#btnSort').style.display = p ? '' : 'none';
  if(!p){ el.innerHTML=`<div class="empty">👀 Mirando la partida</div>`; $('#mineTag').innerHTML=''; return; }
  const hand=sortHand(p.hand||[]), k=hand.length, myTurn=isMyTurnPlain();
  const curId=V.players[V.turn]&&V.players[V.turn].id;
  $('#mineTag').innerHTML = `<div class="mine ${curId===me()&&V.phase==='play'?'turn':''}" style="--pc:${p.color}">${headHTML(p)}<span class="av">${esc(p.emoji)}</span><b>${esc(p.name)}</b> · 🂠 ${k}${V.opts.target?" · "+p.score+" pts":""}</div>`;
  headsAfterRender();
  el.innerHTML = hand.map(c=>cardHTML(c, cardOk(p,c)?'ok':(myTurn?'no':''))).join('');
  const cards=$$('#hand .card'); if(!cards.length) return;
  const W=el.clientWidth, cw=cards[0].offsetWidth;
  const step = k>1 ? Math.max(14, Math.min(cw*.7, (W-cw-20)/(k-1))) : 0;
  const total=cw+step*(k-1), x0=Math.max(4,(W-total)/2), spread=Math.min(34, k*3.2);
  cards.forEach((c,j)=>{
    const a = k>1 ? -spread/2 + spread*j/(k-1) : 0, dy=Math.abs(a)*.9 + (VIEW.mode==='3d'?0:0);
    const lift = c.classList.contains('ok') ? -14 : 0;
    const base=`translateY(${dy+lift}px) rotate(${a}deg)${VIEW.mode==='3d'?' rotateX(14deg)':''}`;
    c.style.left=(x0+j*step)+'px'; c.style.zIndex=j+1; c.style.transform=base;
    c.onmouseenter=()=>{ if(c.classList.contains('ok')) c.style.transform=`translateY(${dy+lift-18}px) rotate(${a}deg) scale(1.06)`; };
    c.onmouseleave=()=>{ c.style.transform=base; };
    c.onclick=()=>cardClick(+c.dataset.id);
  });
}
function cardClick(id){
  const p=meP(); if(!p) return;
  const c=(p.hand||[]).find(x=>x.id===id); if(!c) return;
  if(!cardOk(p,c)){
    if(V.phase!=='play') return;
    if(!isMyTurnPlain()) return toast(V.pending4&&V.pending4.victim===me() ? 'Primero decidí: aceptás el +4 o retás.' : V.pickColor&&V.pickColor.pid===me() ? 'Primero elegí el color.' : 'Esperá tu turno ⏳');
    if(V.drawn) return toast('Después de robar solo podés tirar la carta que robaste (o pasar).');
    return toast(V.pendingDraw ? `Te tiraron +${V.pendingDraw}: apilá un +2/+4 o robá.` : `Esa no coincide: tiene que ser ${COLOR_INFO[V.color]?COLOR_INFO[V.color].n.toLowerCase():'del color'} o del mismo número o símbolo (o un comodín).`);
  }
  const a={type:'play', id};
  const go = ()=>{
    if(V.opts.sevenZero && c.v==='7' && p.hand.length>1) return pickTarget(t=>{ a.target=t; doAct(a); });
    doAct(a);
  };
  if(isWild(c)) return pickColorModal(col=>{ a.color=col; go(); }, c);
  go();
}
function pickColorModal(cb, c){
  const best=botColor((meP().hand||[]).filter(x=>!c||x.id!==c.id));
  modal(`<h2>${c?(c.v==='d4'?'👹 +4 Pombero':'🕸️ Comodín Ñandutí'):'🎨 Elegí el color'}: ¿qué color sigue?</h2>
    <div class="colpick">${COLORS.map(k=>`<button style="background:${COLOR_INFO[k].hex}" data-c="${k}">${COLOR_INFO[k].emo} ${COLOR_INFO[k].n}<small>${COLOR_INFO[k].tag}${k===best?' · el que más tenés':''}</small></button>`).join('')}</div>
    <button class="btn gray wide" onclick="closeModal()">Cancelar</button>`);
  $$('.colpick button').forEach(b=>b.onclick=()=>{ closeModal(); cb(b.dataset.c); });
}
function pickTarget(cb){
  const others=V.players.filter(p=>p.id!==me());
  modal(`<h2>🔁 Tiraste un 7: ¿con quién cambiás tus cartas?</h2>
    ${others.map(p=>`<button class="btn wide" style="margin-bottom:6px;background:${p.color}" data-p="${p.id}">${esc(p.emoji)} ${esc(p.name)} — ${p.n} cartas</button>`).join('')}
    <button class="btn gray wide" onclick="closeModal()">Cancelar</button>`);
  $$('#mbox button[data-p]').forEach(b=>b.onclick=()=>{ closeModal(); cb(b.dataset.p); });
}
function drawClick(){
  if(DRAG.moved) return;
  if(!isMyTurnPlain()) return toast(V && V.phase==='play' ? 'Esperá tu turno para robar ⏳' : '');
  if(V.drawn) return toast('Ya robaste: tirá esa carta o pasá.');
  doAct({type:'draw'});
}
function renderActions(){
  const p=meP(), A=$('#actions'), st=$('#status');
  if(V.phase!=='play'){ A.innerHTML=V.phase!=='lobby'?`<button class="btn gold" onclick="LAST.dismissedEnd=null;roundModal(true)">🏆 Ver resultados</button>`:''; st.innerHTML=''; return; }
  const cp=V.players[V.turn], myTurn=isMyTurnPlain();
  let h='', s='';
  const col = V.color ? `<b style="color:${COLOR_INFO[V.color].hex};text-shadow:0 0 4px #fff">${COLOR_INFO[V.color].n}</b>` : '';
  if(p){
    if(V.pending4 && V.pending4.victim===me()){
      const by=VP(V.pending4.by);
      s=`👹 ${esc(by?by.name:'')} te tiró un <b>+4</b>. ¿Lo aceptás o lo retás? (si te mintió y tenía ${col||'del color'}, roba 4 él; si no, robás 6)`;
      h+=`<button class="btn red" onclick="doAct({type:'accept4'})">😩 Aceptar y robar 4</button><button class="btn" style="background:#5b3b7a" onclick="doAct({type:'challenge'})">🕵️ ¡Retar!</button>`;
    } else if(V.pickColor && V.pickColor.pid===me()){
      s='🕸️ La carta de salida es un comodín: elegí el color con el que se empieza.';
      h+=COLORS.map(k=>`<button class="btn" style="background:${COLOR_INFO[k].hex}" onclick="doAct({type:'pickColor',color:'${k}'})">${COLOR_INFO[k].emo} ${COLOR_INFO[k].n}</button>`).join('');
    } else if(myTurn){
      if(V.drawn){ const c=(p.hand||[]).find(x=>x.id===V.drawn); s=`Robaste ${esc(cardName(c))} y sirve: ${V.opts.forcePlay?'<b>tirala</b> (regla de la casa).':'tirala o pasá.'}`; }
      else if(V.pendingDraw) s=`📚 Te acumularon <b>+${V.pendingDraw}</b>: apilá otro ${V.discard[V.discard.length-1].v==='d4'?'+4':'+2 o +4'} o robá ${V.pendingDraw}.`;
      else s=`🟢 <b>¡Te toca!</b> Tirá una carta ${col} o del mismo número/símbolo, un comodín, o robá del mazo.`;
      if(!V.drawn) h+=`<button class="btn" onclick="drawClick()">🂠 Robar${V.pendingDraw?' '+V.pendingDraw:''}</button>`;
      else if(!V.opts.forcePlay) h+=`<button class="btn gray" onclick="doAct({type:'pass'})">✋ Pasar</button>`;
    } else {
      s = V.pending4 ? `👹 ${esc(VP(V.pending4.victim).name)} decide si acepta el +4 o reta…` : V.pickColor ? `🕸️ ${esc(VP(V.pickColor.pid).name)} elige el color de salida…` : `⏳ Turno de <b>${esc(cp.emoji)} ${esc(cp.name)}</b>${cp.bot?' 🤖':''} · color ${col}`;
    }
    const n=(p.hand||[]).length, mustUno=!!(V.unoWatch && V.unoWatch.pid===me());
    if(mustUno){ h+=`<button class="btn uno hot" onclick="doAct({type:'uno'})">📣 ¡Peteĩ!</button>`; s=`📣 <b>¡Te queda una carta!</b> Tocá ¡Peteĩ! rápido, antes que otro te lo cante (si no, robás 1).`; }
    else if(n===1) h+=`<button class="btn uno" disabled>✅ Peteĩ</button>`;
  } else {
    s = `👀 Turno de <b>${esc(cp.emoji)} ${esc(cp.name)}</b> · color ${col}`;
  }
  if(V.unoWatch && V.unoWatch.pid!==me() && p){
    const w=VP(V.unoWatch.pid);
    h+=`<button class="btn catch" onclick="doAct({type:'catch'})">📣 ¡Peteĩ! a ${esc(w?w.name:'')}</button>`;
  }
  A.innerHTML=h; st.innerHTML=s;
}
function turnNotice(){
  if(V.phase!=='play') return;
  const key=V.round+':'+V.turn+':'+V.turnAt+':'+(V.pending4?1:0);
  if(key===LAST.turnKey) return; LAST.turnKey=key;
  const mine = (isMyTurnPlain() && !V.drawn) || (V.pending4 && V.pending4.victim===me());
  if(mine && LAST.ev!=null){
    sfx.turn(); if(navigator.vibrate) try{ navigator.vibrate(120); }catch(e){}
    const d=document.createElement('div'); d.className='yourturn'; d.textContent= V.pending4?'👹 ¡Te tiraron un +4!':'🟢 ¡Te toca!'; document.body.appendChild(d); setTimeout(()=>d.remove(),1700);
  }
}

// ---------- animaciones de lo que pasa en la mesa ----------
function seatRect(pid){ const s=document.querySelector(`.seat[data-pid="${pid}"] .tag`); return s ? s.getBoundingClientRect() : null; }
function fly(html, from, to, delay, done, rot){
  if(!from || !to) { if(done) done(); return; }
  const box=document.createElement('div'); box.innerHTML=html; const c=box.firstElementChild;
  c.style.setProperty('--w', to.width+'px'); c.style.transformOrigin='0 0';
  const sc=Math.max(.3, from.width/to.width);
  c.style.transform=`translate(${from.left}px,${from.top}px) scale(${sc})`;
  c.style.opacity='0';
  $('#fly').appendChild(c);
  setTimeout(()=>{ c.style.opacity='1'; c.getBoundingClientRect(); c.style.transform=`translate(${to.left}px,${to.top}px) rotate(${rot||0}deg)`; }, delay+16);
  setTimeout(()=>{ c.remove(); if(done) done(); }, delay+480);
}
function bigText(t, sub){ const d=document.createElement('div'); d.className='big-uno'; d.innerHTML=esc(t)+(sub?`<small>${esc(sub)}</small>`:''); document.body.appendChild(d); setTimeout(()=>d.remove(),1500); }
function processEvents(before){
  const evs=V.ev||[], maxI=evs.length?evs[evs.length-1].i:0;
  if(LAST.ev==null || maxI<LAST.ev){ LAST.ev=maxI; return; }   // recién llegó: no se repite lo de antes
  const news=evs.filter(e=>e.i>LAST.ev); LAST.ev=maxI;
  if(news.length>6) return;
  let delay=0;
  const deckR=$('#deck .card') && $('#deck .card').getBoundingClientRect();
  for(const e of news){
    if(e.k==='play'){
      const topEl=$('#discard .topc'), to=topEl && topEl.getBoundingClientRect();
      const from = e.pid===me() ? before[e.card.id] : seatRect(e.pid);
      if(topEl && e===news.filter(x=>x.k==='play').pop()){ topEl.style.visibility='hidden'; }
      const isLast = e===news.filter(x=>x.k==='play').pop();
      fly(cardHTML(e.card), from, to, delay, ()=>{ if(isLast && topEl) topEl.style.visibility=''; }, hashRot(e.card.id));
      setTimeout(()=>sfx.card(), delay); delay+=220;
    } else if(e.k==='draw'){
      const mineD=e.pid===me();
      const targets = mineD ? (e.ids||[]).map(id=>document.querySelector(`#hand .card[data-id="${id}"]`)).filter(Boolean) : [];
      const to = mineD ? null : seatRect(e.pid);
      const k=Math.min(e.n, 6);
      for(let j=0;j<k;j++){
        const tEl=targets[j];
        if(tEl) tEl.style.visibility='hidden';
        const tr = tEl ? tEl.getBoundingClientRect() : to ? {left:to.left+to.width/2-12, top:to.top-10, width:24, height:36} : null;
        fly(backHTML(), deckR, tr, delay+j*90, ()=>{ if(tEl) tEl.style.visibility=''; });
      }
      targets.slice(k).forEach(t=>{ t.style.visibility='hidden'; setTimeout(()=>t.style.visibility='', delay+k*90+450); });
      setTimeout(()=>sfx.draw(e.n), delay); delay+=k*90+120;
    } else if(e.k==='uno'){
      const p=VP(e.pid); setTimeout(()=>{ bigText('¡Peteĩ!', p?p.name+' · ¡le queda una!':''); sfx.uno(); say('¡Peteí!'); }, delay);
    } else if(e.k==='catch'){
      const p=VP(e.pid), by=VP(e.by); setTimeout(()=>{ bigText('📣 ¡Te canté Peteĩ!', `${by?by.name:''} → ${p?p.name:''} roba 1`); sfx.catch(); }, delay);
    } else if(e.k==='challenge'){
      setTimeout(()=>{ bigText(e.ok?'🕵️ ¡Era trampa!':'🕵️ Era legal', e.ok?'El del +4 roba 4':'El que retó roba 6'); sfx.catch(); }, delay);
    } else if(e.k==='jump'){ const p=VP(e.pid); setTimeout(()=>{ bigText('⚡ ¡Cortó!', p?p.name:''); }, delay); }
    else if(e.k==='swap'){ const a=VP(e.pid), b=VP(e.to); toast(`🔁 ${a?a.name:''} cambió sus cartas con ${b?b.name:''}.`); }
    else if(e.k==='rotate'){ toast('🔁 ¡Cero! Todos pasaron sus cartas al siguiente.'); }
    else if(e.k==='deal'){ sfx.shuffle(); dealAnim(); }
    else if(e.k==='win'){ setTimeout(()=>{ sfx.win(); const p=VP(e.pid); bigText('🏆 '+(p?p.name:''), V.phase==='over'?'¡Ganó la partida!':'¡Ganó la mano!'); }, delay+300); }
  }
}
function dealAnim(){
  const deckR=$('#deck .card') && $('#deck .card').getBoundingClientRect(); if(!deckR) return;
  V.players.forEach((p,i)=>{
    const r = p.id===me() ? $('#hand').getBoundingClientRect() : seatRect(p.id); if(!r) return;
    const tr={left:r.left+r.width/2-14, top:r.top, width:28, height:42};
    for(let j=0;j<2;j++) fly(backHTML(), deckR, tr, (i+j*V.players.length)*60);
  });
}

// ---------- ventanas ----------
function modal(h){ $('#mbox').innerHTML=h; $('#modal').classList.add('on'); }
function closeModal(){ $('#modal').classList.remove('on'); }
$('#modal').addEventListener('click', e=>{ if(e.target.id==='modal' && !$('#modal').dataset.lock) closeModal(); });
function roundModal(force){
  if(V.phase!=='roundEnd' && V.phase!=='over') return;
  const key=V.round+':'+V.phase;
  if(!force && (LAST.endKey===key)) return;
  LAST.endKey=key;
  const w=V.roundWin, wp=w&&VP(w.pid), host=amHost();
  const rows=V.players.slice().sort((a,b)=>b.score-a.score).map(p=>{
    const hd=w&&w.hands.find(x=>x.id===p.id);
    return `<tr><td>${esc(p.emoji)} <b>${esc(p.name)}</b>${p.id===(w&&w.pid)?' 🏆':''}<div class="cards">${hd?hd.cards.map(c=>cardHTML(c,'mini')).join(''):''}</div></td><td style="text-align:right;white-space:nowrap">${hd&&hd.pts?'−'+hd.pts+' en mano':''}</td><td style="text-align:right"><b>${p.score}</b></td></tr>`;
  }).join('');
  const over=V.phase==='over';
  const nobs = NET.obs && V.players.length<10 ? `<button class="btn gold wide" style="margin-top:6px" onclick="doAct({type:'joinNext'});closeModal()">🪑 Sentarme para la próxima mano</button>` : '';
  modal(`<h2>${over?'🎉 ¡Terminó la partida!':'🏆 Terminó la mano '+V.round}</h2>
    <p>${wp?`<b>${esc(wp.emoji)} ${esc(wp.name)}</b> se quedó sin cartas y suma <b>${w.pts}</b> puntos (lo que quedó en la mano de los demás).`:''}
    ${over&&wp?`<br>🥇 <b>${esc(wp.name)}</b> gana ${V.opts.target?'con '+wp.score+' puntos':'la partida'}.`:V.opts.target?`<br>Gana el primero que llega a <b>${V.opts.target}</b>.`:''}</p>
    <table class="score"><tr><td class="muted">Jugador y lo que le quedó</td><td></td><td class="muted" style="text-align:right">Total</td></tr>${rows}</table>
    <p class="muted">Puntos: números = lo que dicen · Salto, Reversa y +2 = 20 · Comodín y +4 = 50.</p>
    ${host ? (over?`<button class="btn green wide" onclick="closeModal();doAct({type:'newGame'})">🔁 Otra partida</button>`:`<button class="btn green wide" onclick="closeModal();doAct({type:'nextRound'})">▶️ Siguiente mano</button>`)
      : `<p class="muted" style="text-align:center">⏳ Esperando que el anfitrión ${over?'arme otra partida':'reparta la siguiente mano'}…</p>`}
    ${nobs}
    <button class="btn gray wide" style="margin-top:6px" onclick="closeModal()">Ver la mesa</button>`);
}
function peekModal(){
  const k=V.peek; if(!k || k.to!==me() || LAST.peekAt===k.at) return; LAST.peekAt=k.at;
  setTimeout(()=>modal(`<h2>🕵️ ¡Lo agarraste!</h2><p>Estas eran las cartas de <b>${esc(k.name)}</b> cuando te tiró el +4 (solo vos las ves). Ahora roba 4 él y vos jugás normal.</p>
    <div class="peek">${k.cards.map(c=>cardHTML(c)).join('')}</div><button class="btn wide" onclick="closeModal()">Listo</button>`), 900);
}

// ---------- panel: jugadas, mesa y reglas ----------
function renderSidePanels(){
  if($('#tab-hist').classList.contains('on')) renderHist();
  renderMesaTab(); renderReglasTab();
}
let HIST_N=0;
function renderHist(){
  if(!V) return;
  const strip=(V.discard||[]).slice(-16).reverse();
  const L=(V.log||[]).slice().reverse();
  const fresh=L.length-HIST_N; HIST_N=L.length;
  $('#histList').innerHTML = `<div class="muted" style="font-weight:800">Últimas cartas tiradas (la primera es la de arriba):</div><div class="strip">${strip.map(c=>cardHTML(c,'mini')).join('')||'<span class="muted">—</span>'}</div>`
    + L.map((l,i)=>`<div class="hline ${i<fresh&&fresh<5?'new':''}">${l.card?cardHTML(l.card,'mini'):'<span style="width:26px;text-align:center">·</span>'}<span class="t">${esc(l.x)}</span></div>`).join('');
}
function renderMesaTab(){
  const host=amHost(), inPlay=V.phase!=='lobby';
  const ps=V.players.map((p,i)=>{
    const cnt=p.hand?p.hand.length:p.n, offline=!p.bot&&!p.conn;
    return `<div class="prow" style="border-left:5px solid ${p.color}"><span style="font-size:22px">${esc(p.emoji)}</span><span class="nm"><b>${esc(p.name)}${p.id===me()?' (vos)':''}${p.id===V.hostPid&&NET.mode!=='local'?' 👑':''}</b>
      <small>${inPlay?`🂠 ${cnt} cartas`:''}${p.bot?' · 🤖 bot':''}${p.mic?' · 🎙️':''}${offline?' · ⚠️ sin conexión':''}${inPlay&&V.players[V.turn]===p&&V.phase==='play'?' · ⏳ su turno':''}</small></span>
      ${V.opts.target&&inPlay?`<span class="pts">${p.score}</span>`:''}
      ${host&&p.id!==V.hostPid&&NET.mode!=='local'?`${offline&&inPlay?`<button class="btn sm gray" onclick="doAct({type:'botify',pid:'${p.id}'})" title="Que juegue un bot">🤖</button>`:''}<button class="btn sm gray" onclick="if(confirm('¿Sacar a ${esc(p.name)} de la mesa?'))doAct({type:'kick',pid:'${p.id}'})" title="Sacar">✕</button>`:''}</div>`;
  }).join('');
  const obs=(V.observers||[]).map(o=>`<div class="prow"><span style="font-size:20px">👀</span><span class="nm"><b>${esc(o.name)}${o.id===me()?' (vos)':''}</b><small>mirando${o.mic?' · 🎙️':''}</small></span></div>`).join('');
  const sit = NET.obs && V.phase!=='play' && V.players.length<10 ? `<button class="btn gold wide" onclick="doAct({type:'joinNext'})">🪑 Sentarme a jugar</button>` : NET.obs ? `<p class="muted">Te podés sentar cuando termine la mano (si hay lugar).</p>` : '';
  const dir = inPlay ? `<p class="muted">Sentido: ${V.dir===1?'➡️ normal (para la izquierda)':'⬅️ al revés'} · Mano ${V.round}${V.opts.target?` · se juega a ${V.opts.target} puntos`:' · una sola mano'}</p>` : '';
  $('#mesaList').innerHTML = dir + `<b>Jugadores (${V.players.length}/10)</b>` + ps + (obs?`<b>Mirando</b>${obs}`:'') + sit
    + (NET.mode!=='local'&&NET.code?`<p class="muted" style="margin-top:12px">Invitá con el código <b>${NET.code}</b> <button class="btn sm" onclick="shareRoom()">📤 Compartir</button></p>`:'');
}
function renderReglasTab(){
  const o=V.opts, on=HOUSE.filter(h=>o[h.k]);
  const host=amHost(), localEdit = NET.mode==='local';
  $('#reglasList').innerHTML = `<p style="margin-top:0"><b>${(TARGETS.find(t=>t.v==o.target)||{}).t||''}</b></p>`
    + (localEdit ? `<p class="muted">Lo que cambies acá vale para la próxima partida de práctica.</p>`+HOUSE.map(h=>`<label class="opt" style="font-weight:400"><input type="checkbox" ${(load('uno_localopts')||defaultOpts())[h.k]?'checked':''} onchange="setLocalOpt('${h.k}',this.checked)"><span><b>${h.t}</b><small>${h.d}</small></span></label>`).join('')
      : `<b>Reglas de la casa activas</b>` + (on.length ? on.map(h=>`<div class="opt"><span><b>${h.t}</b><small>${h.d}</small></span></div>`).join('') : '<p class="muted">Ninguna: reglas clásicas puras.</p>'))
    + `<b>📝 Reglas propias del grupo</b>` + (V.grules?`<div class="grules" style="margin:6px 0 10px">${esc(V.grules)}</div>`:`<p class="muted">${host&&!localEdit?'Las podés escribir en la sala de espera.':'No hay.'}</p>`)
    + `<b>💡 Sugerencias</b><div style="margin-top:6px">${sugsHTML(host)}</div>
       <div class="row"><input type="text" id="sugIn2" maxlength="240" placeholder="Proponé una regla…" onkeydown="if(event.key==='Enter')sendSug('sugIn2')"><button class="btn sm" style="flex:0 0 auto" onclick="sendSug('sugIn2')">Sugerir</button></div>
       <button class="btn dark wide" style="margin-top:12px" onclick="showRules()">📜 Reglas oficiales completas</button>`;
}
function setLocalOpt(k, v){ const o=Object.assign(defaultOpts(), load('uno_localopts')||{}); o[k]=v; store('uno_localopts', o); toast('Se usa en la próxima partida de práctica.'); }

// ---------- compartir ----------
function roomLink(){ return location.origin+location.pathname+'#'+NET.code; }
function copyCode(){ navigator.clipboard && navigator.clipboard.writeText(NET.code).then(()=>toast('Código copiado: '+NET.code)); }
function shareRoom(){
  const url=roomLink(), text=`¡Vení a jugar Peteĩ conmigo! 🃏🇵🇾 Sala ${NET.code}`;
  if(navigator.share) return navigator.share({title:'Peteĩ', text, url}).catch(()=>{});
  modal(`<h2>📤 Invitar a la sala ${NET.code}</h2><p style="word-break:break-all;user-select:all;background:#fff;padding:8px;border-radius:8px">${esc(url)}</p>
    <a class="btn green wide" style="display:block;text-align:center;text-decoration:none" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text+' '+url)}">💬 Mandar por WhatsApp</a>
    <button class="btn wide" style="margin-top:6px" onclick="navigator.clipboard.writeText('${url}').then(()=>toast('Enlace copiado'))">📋 Copiar enlace</button>
    <button class="btn gray wide" style="margin-top:6px" onclick="closeModal()">Cerrar</button>`);
}

/* ====================== VISTA 2D / 3D ====================== */
const VIEW=Object.assign({mode:'2d', tilt:52, spin:0, zoom:.86}, load('uno_view')||{});
function saveView(){ store('uno_view', {mode:VIEW.mode, tilt:VIEW.tilt, zoom:VIEW.zoom}); }
function applyView(){
  $('#game').classList.toggle('v3d', VIEW.mode==='3d');
  const m=$('#mesa'); m.style.setProperty('--tilt', VIEW.tilt+'deg'); m.style.setProperty('--spin', VIEW.spin+'deg'); m.style.setProperty('--zoom', VIEW.zoom);
  $('#btnView').textContent = VIEW.mode==='3d' ? '🗺️ 2D' : '🧊 3D';
}
function toggleView(){
  VIEW.mode = VIEW.mode==='3d' ? '2d' : '3d'; VIEW.spin=0; saveView(); applyView();
  if(V && V.phase!=='lobby'){ renderCenter(); renderHand(); }
  toast(VIEW.mode==='3d' ? '🧊 Vista 3D: arrastrá la mesa para girarla. Botones de cámara a la derecha.' : '🗺️ Vista 2D (desde arriba).');
}
function cam(k, d){
  if(k==='spin') VIEW.spin+=d;
  else if(k==='tilt') VIEW.tilt=Math.max(20, Math.min(68, VIEW.tilt+d));
  else if(k==='zoom') VIEW.zoom=Math.max(.5, Math.min(1.3, +(VIEW.zoom+d).toFixed(2)));
  else if(k==='reset'){ VIEW.spin=0; VIEW.tilt=52; VIEW.zoom=.86; }
  saveView(); applyView();
}
const DRAG={on:false, moved:false};
(function(){
  const stage=$('#stage');
  stage.addEventListener('pointerdown', e=>{ DRAG.moved=false; if(VIEW.mode!=='3d' || e.target.closest('.cam3d')) return; Object.assign(DRAG,{on:true, x:e.clientX, y:e.clientY, spin:VIEW.spin, tilt:VIEW.tilt}); });
  window.addEventListener('pointermove', e=>{
    if(!DRAG.on) return; const dx=e.clientX-DRAG.x, dy=e.clientY-DRAG.y;
    if(!DRAG.moved && Math.hypot(dx,dy)<8) return;
    if(!DRAG.moved){ DRAG.moved=true; $('#mesa').classList.add('dragging'); }
    VIEW.spin=DRAG.spin+dx*.35; VIEW.tilt=Math.max(20, Math.min(68, DRAG.tilt+dy*.15)); applyView();
  });
  window.addEventListener('pointerup', ()=>{ if(!DRAG.on) return; DRAG.on=false; $('#mesa').classList.remove('dragging'); if(DRAG.moved){ saveView(); setTimeout(()=>DRAG.moved=false, 50); } });
})();
window.addEventListener('resize', ()=>{ if(V && V.phase!=='lobby') renderHand(); });

/* ====================== REGLAS ====================== */
function showRules(){
  const ex=(v,c)=>cardHTML({id:900+Math.random()*99|0, c:c||'r', v});
  modal(`<div class="rules"><h2>📜 Reglas del Peteĩ</h2>
  <p>Son las <b>reglas clásicas</b> de este juego de cartas de colores, con cartas que tienen cosas nuestras. <b>Peteĩ</b> quiere decir “uno” en guaraní. Juegan de <b>2 a 10 personas</b>. Gana la mano el primero que se queda sin cartas.</p>
  <h3>🃏 Las cartas (108)</h3>
  <p>Cuatro colores: 🟥 rojo y 🟦 azul de la bandera, 🟩 verde yerba mate y 🟨 amarillo lapacho. Cada número tiene su dibujo:</p>
  <div class="cardrow">${['0','1','2','3','4','5','6','7','8','9'].map((v,i)=>ex(v,COLORS[i%4])).join('')}</div>
  <p>0 Albirroja ⚽ · 1 Tereré 🧉 · 2 Chipa · 3 Sopa paraguaya · 4 Mbejú · 5 Guaraní 💵 · 6 Arpa paraguaya 🎶 · 7 Lapacho 🌸 · 8 Asado 🍖 · 9 Jaguareté 🐆</p>
  <div class="cardrow">${ex('skip','b')}${ex('rev','g')}${ex('d2','y')}${ex('wild','w')}${ex('d4','w')}</div>
  <ul>
    <li><b>⛔ Salto “¡Ndaikatúi!”</b>: el siguiente pierde el turno.</li>
    <li><b>🔄 Reversa “Jajevy”</b>: cambia el sentido del juego. Con 2 jugadores funciona como Salto.</li>
    <li><b>🎁 +2 “Jopói”</b> (el regalo): el siguiente roba 2 y pierde el turno.</li>
    <li><b>🕸️ Comodín “Ñandutí”</b>: se tira cuando quieras y elegís el color que sigue.</li>
    <li><b>👹 +4 “Pombero”</b>: elegís el color y el siguiente roba 4 y pierde el turno. <b>Solo se puede tirar si no tenés ninguna carta del color de la mesa.</b></li>
  </ul>
  <h3>▶️ Cómo se juega</h3>
  <ul>
    <li>Se reparten <b>7 cartas</b> a cada uno y se da vuelta una del mazo (si es un +4, vuelve al mazo).</li>
    <li>En tu turno tirás una carta que coincida con la de arriba en <b>color</b>, en <b>número</b> o en <b>símbolo</b>, o un comodín.</li>
    <li>Si no tenés (o no querés), <b>robás una</b>. Si esa sirve, la podés tirar enseguida; si no, pasa el turno.</li>
    <li>Si se acaba el mazo, se mezclan las tiradas (menos la de arriba).</li>
  </ul>
  <h3>📣 ¡Peteĩ!</h3>
  <p>Cuando te queda <b>una sola carta</b> tenés que cantar <b>¡Peteĩ!</b> (tocá el botón amarillo). Si otro jugador te canta el Peteĩ antes que vos (con el botón “📣 ¡Peteĩ! a …”), <b>robás 1 carta del mazo</b>. Hay tiempo hasta que juegue el siguiente.</p>
  <h3>🕵️ Retar el +4</h3>
  <p>El que recibe un +4 puede retar. Si el que lo tiró tenía una carta del color de la mesa, roba 4 él (y el que retó ve sus cartas). Si era legal, el que retó roba 6.</p>
  <h3>🏆 Puntos</h3>
  <p>El que gana la mano suma lo que quedó en la mano de los demás: los números valen lo que dicen, Salto/Reversa/+2 valen 20, Comodín y +4 valen 50. Gana el primero que llega a 500 (o la cantidad que elija el anfitrión, o una sola mano).</p>
  <h3>🏠 Reglas de la casa (opcionales)</h3>
  ${HOUSE.map(h=>`<p><b>${h.t}</b>: ${h.d}</p>`).join('')}
  <p>Además, cada grupo puede escribir sus propias reglas en la sala y todos pueden <b>sugerir reglas nuevas y votarlas 👍</b>.</p>
  <h3>💬 Chat y voz</h3>
  <p>Escribí <b>@nombre</b> (o elegí a alguien en “Para”) para mandarle un <b>mensaje privado</b>: solo lo ven ustedes dos. Con <b>🤫 Pedir en secreto</b> le pedís un color o un número a alguien sin que los demás se enteren. Con 🎤 hablan por voz.</p>
  <p class="muted">🎶 ${MUSIC_CREDIT}</p>
  <button class="btn wide" onclick="closeModal()">Entendido</button></div>`);
}

if('serviceWorker' in navigator && location.protocol==='https:') navigator.serviceWorker.register('sw.js').catch(()=>{});
