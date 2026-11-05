'use strict';
/* =====================================================================
   Escoba de 15 — red (PeerJS), chat con privados, voz, mesa 2D/3D,
   la mano del jugador, levantar cartas, animaciones, sonidos y música.
   ===================================================================== */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function store(k,v){ try{ if(v===undefined) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
function load(k){ try{ const v=localStorage.getItem(k); return v==null?null:JSON.parse(v); }catch(e){ return null; } }
function toast(x){ const t=$('#toast'); t.textContent=x; t.style.display='block'; clearTimeout(toast.t); toast.t=setTimeout(()=>t.style.display='none', 3800); }
const PREFIX='escobapy26-';
const genCode = () => { const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s=''; for(let i=0;i<5;i++) s+=A[rnd(A.length)]; return s; };
let myToken=load('esc_token'); if(!myToken){ myToken=Math.random().toString(36).slice(2)+Date.now().toString(36); store('esc_token', myToken); }
const NET={mode:null, peer:null, code:null, conns:{}, hostConn:null, myPid:null, obs:null, welcomed:false};
let CHAT=[], V=null;
const me = () => NET.myPid || NET.obs;
const VP = id => V && (V.players.find(p=>p.id===id) || (V.observers||[]).find(o=>o.id===id));
const VT = id => V && (V.teams||[]).find(t=>t.id===id);
const amHost = () => NET.mode==='local' || (V && V.hostPid===NET.myPid && NET.mode==='host');
function vTeamName(t){
  if(!t) return '';
  const ns=t.members.map(id=>(VP(id)||{}).name||'?');
  if(t.members.length===1) return ns[0];
  return (V.opts.mode==='trios'?'Equipo ':'Pareja ')+(V.teams.indexOf(t)+1)+': '+ns.join(' y ');
}

/* ====================== MENÚ ====================== */
let myEmojiSel = load('esc_emoji') || EMOJIS[0];
const myName = () => ($('#myName').value.trim() || 'Jugador').slice(0,16);
const myEmoji = () => myEmojiSel;
$('#myName').value = load('esc_name') || load('uno_name') || '';
$('#myName').addEventListener('input', ()=>store('esc_name', $('#myName').value.trim()));
function renderTokenPicker(){
  $('#tokens').innerHTML = EMOJIS.map(e=>`<button class="tok ${e===myEmojiSel?'sel':''}" onclick="pickEmoji('${e}')">${e}</button>`).join('');
}
function pickEmoji(e){ myEmojiSel=e; store('esc_emoji', e); renderTokenPicker(); }
renderTokenPicker();
$('#logoCards').innerHTML = [{id:7,s:'o',n:7},{id:18,s:'c',n:10},{id:21,s:'e',n:1},{id:40,s:'b',n:12},{id:15,s:'c',n:5}]
  .map((c,i)=>cardHTML(c,'', `transform:rotate(${(i-2)*11}deg) translateY(${Math.abs(i-2)*6}px)`)).join('');
function needName(){ if(!$('#myName').value.trim()){ toast('Escribí tu nombre primero ✍️'); $('#myName').focus(); return true; } store('esc_name', myName()); return false; }
function joinClick(){
  const code=$('#joinCode').value.trim().toUpperCase(); if(!code) return toast('Escribí el código de la sala.');
  if(needName()) return; clientJoin(code);
}
function resumeClick(){
  const h=load('esc_host'), c=load('esc_client');
  if(h && (!c || h.at>=c.at)) return hostStart(true);
  if(c){ if(needName()) return; clientJoin(c.code); }
}
function refreshResume(){
  const h=load('esc_host'), c=load('esc_client'), ok=x=>x && Date.now()-x.at<6*3600e3;
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
  S=lobbyState(); S.opts=Object.assign(defaultOpts(), load('esc_localopts')||{});
  const p=addPlayer(myName(), myEmoji(), myToken, null); NET.myPid=p.id; S.hostPid=p.id;
  const v=$('#nBots').value, n=parseInt(v); for(let i=0;i<n;i++) addBot();
  S.opts.mode = v.endsWith('p') ? 'parejas' : 'solo';
  startGame(); sysChat('🧹 Partida de práctica contra bots. Las reglas de la casa se cambian en la pestaña 🏠 Reglas (para la próxima partida).');
  LAST.ev=null; FACES={}; commit(); shareMyFace();
}
function leaveClick(){
  if(NET.mode==='local'){ if(S && S.phase==='play' && !confirm('¿Salir de la partida contra los bots?')) return; return leaveToMenu(); }
  if(!confirm('¿Salir de la sala?')) return;
  if(NET.mode==='host'){
    const others=hostCandidates(S);
    if(others.length) return hostHandover();
    store('esc_host', undefined);
  } else if(NET.mode==='client'){
    if(NET.hostConn && NET.hostConn.open && NET.myPid) try{ NET.hostConn.send({t:'act', a:{type:'leave'}}); }catch(e){}
    store('esc_client', undefined);
  }
  setTimeout(leaveToMenu, 250);
}
function leaveToMenu(){
  camsReset();
  musicStop();
  stopMic(false);
  try{ if(NET.peer) NET.peer.destroy(); }catch(e){}
  Object.assign(NET,{mode:null, peer:null, code:null, conns:{}, hostConn:null, myPid:null, obs:null, welcomed:false, backup:null});
  S=null; V=null; CHAT=[]; LAST.ev=null; SEL.id=null; closeModal(); netBar(false);
  history.replaceState(null,'',location.pathname);
  show('menu');
}

/* ====================== RED ====================== */
function publicState(forPid){
  const s=JSON.parse(JSON.stringify(S));
  s.players.forEach(p=>{ delete p.token; p.n=p.hand.length; p.pileN=p.pile.length; p.pile=null; if(p.id!==forPid) p.hand=null; });
  (s.observers||[]).forEach(o=>delete o.token);
  s.deckN=s.deck.length; s.deck=null;
  delete s.ownerTok;
  return s;
}
function commit(){
  if(NET.mode==='host'){
    for(const pid in NET.conns){ const c=NET.conns[pid]; if(c && c.open) try{ c.send({t:'state', s:publicState(pid)}); }catch(e){} }
    sendBackups();
    if(!NET.noSave) store('esc_host', {code:NET.code, S, CHAT:CHAT.slice(-80), myPid:NET.myPid, at:Date.now()});
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
  const saved = resume ? load('esc_host') : null;
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
    if(resume){ toast('La sala sigue abierta en otro aparato (otro jugador quedó de anfitrión). Entrá con el código.'); peer.destroy(); store('esc_host',undefined); NET.mode=null; $('#joinCode').value=NET.code; return; }
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
  store('esc_host', undefined);
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
        why = S.phase==='lobby' ? 'La mesa está llena (6 jugadores): entraste a mirar 👀.' : 'La partida ya empezó: entraste a mirar 👀. Entre manos podés tomar el lugar de un bot.';
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
  if(mine){ if(S.phase==='lobby') S.players=S.players.filter(p=>p!==mine); else { mine.bot=true; mine.conn=false; mine.token=null; log(`🚪 ${mine.name} se fue: un bot sigue con sus cartas.`); } }
  const c=NET.conns[next.id];
  try{ c.send({t:'migrate', s:S, chat:CHAT.slice(-80)}); }catch(e){}
  NET.noSave=true; store('esc_host', undefined);
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
      if(!NET.welcomed){ toast('No se encontró la sala '+code+'. Revisá el código.'); store('esc_client',undefined); leaveToMenu(); }
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
    store('esc_client',{code:NET.code, at:Date.now()}); if(location.hash!=='#'+NET.code) history.replaceState(null,'','#'+NET.code);
    if(d.why) toast(d.why);
    setTimeout(shareMyFace, 300);   // mi foto, si tengo
  }
  else if(d.t==='state'){ S=d.s; render(); }
  else if(d.t==='chat'){ CHAT.push(d.m); renderChat(d.m); }
  else if(d.t==='chatlog'){ CHAT=d.list||[]; renderChat(); }
  else if(d.t==='faces' || d.t==='face') clientFace(d);
  else if(d.t==='backup'){ NET.backup={s:d.s, chat:d.chat}; }
  else if(d.t==='migrate'){ NET.backup={s:d.s, chat:d.chat}; takeoverHost('handover'); }
  else if(d.t==='kicked'){ toast('🚪 El anfitrión te sacó de la mesa.'); store('esc_client',undefined); leaveToMenu(); }
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
  if(!to && V && V.teams && V.teams.length){
    const mp=VP(me()), t=mp && VT(mp.team), mate=t && t.members.find(id=>id!==me());
    if(mate) to=mate;
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
const SND={on:load('esc_snd')!==false, ctx:null};
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
  card(){ noise(.09,.35,0,2200); tone(180,.06,'triangle',.1,.02); },
  take(k){ for(let i=0;i<Math.min(k||1,6);i++) noise(.05,.2,i*.06,2600); },
  deal(k){ for(let i=0;i<Math.min(k||3,10);i++) noise(.05,.16,i*.07,3000); },
  turn(){ tone(740,.12,'sine',.14); tone(988,.18,'sine',.14,.11); },
  escoba(){ for(let i=0;i<6;i++) noise(.12,.3,i*.07,800+i*500); [523,659,784,1047].forEach((f,i)=>tone(f,.22,'triangle',.12,.15+i*.08)); },
  velo(){ [1319,1568,2093].forEach((f,i)=>tone(f,.25,'sine',.1,i*.09)); },
  win(){ [523,659,784,1047].forEach((f,i)=>tone(f,.3,'triangle',.14,i*.13)); },
  priv(){ tone(1200,.08,'sine',.08); tone(1500,.1,'sine',.08,.08); },
  shuffle(){ for(let i=0;i<8;i++) noise(.04,.15,i*.05,2500); },
};
function say(t){ if(!SND.on || !window.speechSynthesis) return; try{ const u=new SpeechSynthesisUtterance(t); u.lang='es-ES'; u.rate=1.1; u.pitch=1.1; speechSynthesis.cancel(); speechSynthesis.speak(u); }catch(e){} }
function toggleSound(){ SND.on=!SND.on; store('esc_snd', SND.on); $('#btnSnd').textContent=SND.on?'🔊':'🔇'; if(SND.on) sfx.turn(); }
$('#btnSnd').textContent=SND.on?'🔊':'🔇';
document.addEventListener('pointerdown', ()=>actx(), {once:true});

/* ---------- música de fondo: una polca paraguaya de arpa, tocada en el momento (sin archivos) ---------- */
const MUSIC_CREDIT = 'Música propia del juego: una polca paraguaya de arpa que se toca en el momento.';
const MUSIC = { on: load('esc_music')!==false, gain:null, timer:null, t:0, bar:0, VOL:.075 };
const mf = m => 440*Math.pow(2,(m-69)/12);
// 8 compases de 6/8: acorde, bajo y melodía (0 = silencio)
const POLCA = [
  {ch:[55,59,62], b:43, m:[74,0,71,74,79,0]},
  {ch:[50,54,57,60], b:38, m:[78,76,74,72,69,0]},
  {ch:[50,54,57,60], b:38, m:[69,0,72,74,78,0]},
  {ch:[55,59,62], b:43, m:[79,0,74,71,67,0]},
  {ch:[48,52,55], b:36, m:[76,0,79,76,72,0]},
  {ch:[55,59,62], b:43, m:[74,71,74,79,0,74]},
  {ch:[50,54,57,60], b:38, m:[72,0,69,66,69,72]},
  {ch:[55,59,62], b:43, m:[71,0,67,0,74,71]},
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
  const E=.165;   // una corchea (6/8 a paso de polca)
  while(MUSIC.t < c.currentTime+.6){
    const bar=POLCA[MUSIC.bar%8], pass=Math.floor(MUSIC.bar/8)%2, t0=MUSIC.t;
    harp(mf(bar.b), t0, .5, 1.2); harp(mf(bar.b+12), t0+3*E, .35, .9);   // bajo en 1 y 4
    // el acompañamiento de la polca: sincopado, 3+3 contra 2+2+2
    [[1,0],[2,1],[4,2],[5,1]].forEach(([s,k])=>harp(mf(bar.ch[k%bar.ch.length]+12), t0+s*E, .16, .5));
    bar.m.forEach((n,s)=>{ if(n) harp(mf(n+(pass?12:0)), t0+s*E, pass?.17:.22, .7); });
    MUSIC.t+=6*E; MUSIC.bar++;
  }
}
function musicStart(){
  if(!MUSIC.on || MUSIC.timer) return;
  const c=actx(); if(!c) return;
  MUSIC.gain=c.createGain(); MUSIC.gain.connect(c.destination);
  MUSIC.gain.gain.setValueAtTime(0.0001, c.currentTime); MUSIC.gain.gain.exponentialRampToValueAtTime(MUSIC.VOL, c.currentTime+2.5);   // entra suave
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
function toggleMusic(){ MUSIC.on=!MUSIC.on; store('esc_music', MUSIC.on); musicSync(); toast(MUSIC.on?'🎶 Música de fondo prendida (polca de arpa, suave).':'🔕 Música de fondo apagada.'); }
function renderMusicBtn(){ $$('.btnMusic').forEach(b=>{ b.textContent = MUSIC.on ? '🎶' : '🔕'; b.title = MUSIC.on ? 'Apagar la música de fondo' : 'Prender la música de fondo'; }); }
renderMusicBtn(); $('#musicCredit').textContent='🎶 '+MUSIC_CREDIT;

/* ====================== RENDER ====================== */
const LAST={ev:null, turnKey:null, endKey:null, dismissedEnd:null};
const SEL={id:null, take:[]};   // la carta elegida de la mano y lo que se quiere levantar
const HINTS={on:load('esc_hints')!==false};
function toggleHints(){ HINTS.on=!HINTS.on; store('esc_hints', HINTS.on); renderHintBtn(); if(V && V.phase!=='lobby'){ renderHand(); } toast(HINTS.on?'💡 Pistas prendidas: se marcan las cartas que levantan y las escobas.':'💡 Pistas apagadas: a contar solito.'); }
function renderHintBtn(){ $('#btnHint').style.opacity = HINTS.on ? 1 : .45; }
renderHintBtn();
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
function lobbyTeams(){
  const n=V.players.length, mode=V.opts.mode;
  if(mode==='solo' || !modeOk(mode, n)) return null;
  const k = mode==='parejas' ? n/2 : 2, ts=[];
  for(let t=0;t<k;t++) ts.push([]);
  V.players.forEach((p,i)=>ts[teamIndex(i,n,mode)].push(p));
  return ts;
}
function renderLobby(){
  const host=amHost(), myObs=!!NET.obs, n=V.players.length;
  $('#lobbyCode').textContent=NET.code||'—';
  $('#lobbyCodeBox').style.display = NET.mode==='local' ? 'none' : '';
  $('#pcount').textContent=`(${n}/6)`;
  const ts=lobbyTeams();
  const teamOfIdx = i => ts ? teamIndex(i, n, V.opts.mode) : -1;
  $('#plist').innerHTML=V.players.map((p,i)=>`<li>${playerTag(p)}${ts?`<span class="tm" style="background:${TCOLORS[teamOfIdx(i)]}">${V.opts.mode==='trios'?'Equipo':'Pareja'} ${teamOfIdx(i)+1}</span>`:''}
      ${host && i>0?`<button class="btn sm gray" onclick="doAct({type:'seatUp',pid:'${p.id}'})" title="Subir en el orden de la mesa (para armar las parejas)">⬆️</button>`:''}
      ${host && p.id!==V.hostPid?`<button class="btn sm gray" onclick="doAct({type:'kick',pid:'${p.id}'})" title="Sacar">✕</button>`:''}</li>`).join('')
    + (V.observers||[]).map(o=>`<li style="opacity:.75"><span style="font-size:20px">👀</span><span class="nm">${esc(o.name)} <span class="muted">mirando</span></span>${o.mic?'🎙️':''}</li>`).join('');
  let warn='';
  if(n>=2 && !OK_N.includes(n)) warn='⚠️ Con 5 no se puede: las 36 cartas no se reparten parejo. Sumá un bot o sacá a alguien.';
  else if(n>=2 && !modeOk(V.opts.mode, n)) warn = V.opts.mode==='trios' ? '⚠️ Los equipos de 3 son con 6 jugadores.' : '⚠️ En parejas se juega con 4 o 6 jugadores.';
  $('#teamPrev').innerHTML = (ts ? `<div class="teamprev">${ts.map((t,i)=>`<b style="color:${TCOLORS[i]}">${V.opts.mode==='trios'?'Equipo':'Pareja'} ${i+1}:</b> ${t.map(p=>esc(p.emoji+' '+p.name)).join(' y ')}`).join('<br>')}<br><span class="muted">Los compañeros se sientan enfrente. ${host?'Con ⬆️ cambiás el orden para elegir las parejas.':''}</span></div>` : '')
    + (warn?`<p class="muted" style="color:#a3320b;font-weight:700">${warn}</p>`:'');
  const canStart = n>=2 && OK_N.includes(n) && modeOk(V.opts.mode, n);
  $('#lobbyHostBtns').innerHTML = host
    ? `<div class="row"><button class="btn gray" onclick="doAct({type:'addBot'})" ${n>=MAXP?'disabled':''}>🤖 Sumar bot</button>
       <button class="btn green" onclick="doAct({type:'start'})" ${canStart?'':'disabled'}>▶️ Empezar</button></div>
       <p class="muted">Se juega de 2, 3, 4 o 6. Si alguien se corta en la partida, un bot juega por él hasta que vuelva.</p>`
    : `<p class="muted" style="text-align:center">⏳ Esperando que el anfitrión 👑 empiece la partida…</p>`;
  $('#lobbyObs').innerHTML = myObs ? `<div class="obsbar" style="border-radius:10px;margin-top:8px">👀 Estás mirando. ${n<MAXP?`<button class="btn sm gold" onclick="doAct({type:'joinNext'})">🪑 Sentarme a jugar</button>`:'La mesa está llena.'}</div>` : '';
  $('#optsBox').innerHTML = optsHTML(host);
  const g=$('#grulesBox');
  if(host){
    if(!g.querySelector('textarea')) g.innerHTML=`<textarea id="grulesIn" maxlength="1200" placeholder="Ej.: el que hace escoba ceba el tereré 🧉&#10;El siete velo se canta en voz alta…"></textarea><p class="muted" style="margin:4px 0 0">Se guarda solo y lo ven todos.</p>`;
    const ta=$('#grulesIn'); if(document.activeElement!==ta) ta.value=V.grules||'';
    ta.oninput=()=>{ clearTimeout(ta.t); ta.t=setTimeout(()=>doAct({type:'grules', text:ta.value}), 600); };
  } else g.innerHTML = V.grules ? `<div class="grules">${esc(V.grules)}</div>` : `<p class="muted">El anfitrión todavía no escribió reglas propias.</p>`;
  $('#sugBox').innerHTML = sugsHTML(host);
}
function optsHTML(host){
  const o=V.opts, dis = host && V.phase==='lobby' ? '' : 'disabled';
  const sel=(k, list)=>`<select ${dis} onchange="doAct({type:'opt',k:'${k}',v:this.value})">${list.map(t=>`<option value="${t.v}" ${o[k]==t.v?'selected':''}>${t.t}</option>`).join('')}</select>`;
  return `<label style="margin-top:0">Partida</label>${sel('target', TARGETS)}
    <label>Cómo se juega</label>${sel('mode', MODES)}
    <label>Los sietes</label>${sel('sevens', SEVENS)}
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
  $$('#hand .card, #tcards .card').forEach(el=>before[el.dataset.id]=el.getBoundingClientRect());
  $('#roomTag').textContent = NET.mode==='local' ? '🤖 Práctica' : '🔑 '+NET.code;
  $('#scoreTag').textContent = '🏆 '+(V.teams||[]).map(t=>t.score).join(' · ')+(V.opts.target?` / ${V.opts.target}`:'');
  $('#obsbar').style.display = NET.obs ? 'block' : 'none';
  if(NET.obs) $('#obsbar').innerHTML = `👀 Estás mirando la partida (no se ven las cartas de nadie).`;
  fixSel();
  applyView();
  renderSeats(); renderCenter(); renderHand(); renderActions();
  processEvents(before);
  turnNotice();
  roundModal();
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
  const teams = V.opts.mode!=='solo';
  let h='';
  V.players.forEach((p,i)=>{
    const r=(i-base+n)%n, ang=90+r*360/n, rad=ang*Math.PI/180;
    const rx=window.innerWidth<600?33:47, x=50+rx*Math.cos(rad), y=50+46*Math.sin(rad);
    const cnt = p.hand ? p.hand.length : p.n;
    const isMe = i===mi;
    let fan='';
    if(!isMe){
      const spread=Math.min(50, cnt*14);
      for(let j=0;j<cnt;j++){ const a = cnt>1 ? -spread/2 + spread*j/(cnt-1) : 0; fan+=backHTML('mini', `transform:translateX(-50%) rotate(${a}deg)`); }
    }
    const b=BUB[p.id], bub = b && Date.now()-b.at<4500 ? `<div class="bub">${esc(b.x.slice(0,90))}</div>` : '';
    const offline=!p.bot && !p.conn, t=VT(p.team), ti=t?V.teams.indexOf(t):0;
    const pn=p.pileN||0, escs=(p.escIds||[]).slice(-4).map(id=>cardHTML(cardById(id),'mini escm')).join('');
    const pile=`<div class="pilebox ${pn?'':'zero'}" data-pile="${p.id}"><div class="pw">${escs}${pn?backHTML('mini st'):''}${p.esc?`<span class="pe">🧹${p.esc}</span>`:''}<span class="pn">${pn}</span></div></div>`;
    h+=`<div class="seat ${p.id===curId&&V.phase==='play'?'turn':''} ${offline?'off':''} ${isMe?'me':''}" data-pid="${p.id}" style="left:${x}%;top:${y}%;--rot:${ang-90}deg;--rot3:${rot3(ang-90)}deg">
      ${isMe?'':`<div class="fan">${fan}</div>`}${pile}
      ${isMe?"":headHTML(p)}<div class="tag" style="--pc:${p.color}">${teams&&t?`<span class="tmk" style="--tc:${t.color}">${V.opts.mode==='trios'?'E':'P'}${ti+1}</span>`:''}<span class="av">${esc(p.emoji)}</span><span><b>${esc(p.name)}${isMe?' (vos)':''}</b><small>${t?`${t.score} pts`:''}${i===V.dealer?' · 🃏 reparte':''}${p.bot?' · 🤖':''}${p.mic?' · 🎙️':''}${offline?' · ⚠️ sin conexión':''}${p.id===V.hostPid&&NET.mode!=='local'?' · 👑':''}</small></span></div>${bub}</div>`;
  });
  $('#seats').innerHTML=h;
  headsAfterRender();
}
function renderCenter(){
  const deckN=V.deckN!=null?V.deckN:(V.deck||[]).length;
  let layers=''; if(VIEW.mode==='3d'){ const L=Math.min(10, Math.ceil(deckN/4)); for(let i=0;i<L;i++) layers+=`<i style="transform:translateZ(${-i*1.5-1}px)"></i>`; }
  $('#deck').className='pila'+(deckN?'':' empty');
  $('#deck').innerHTML=`<div class="layers">${layers}</div>${backHTML('stack')}<div class="n">${deckN} en el mazo</div>`;
  const tc=$('#tcards'), t=V.table||[];
  tc.classList.toggle('many', t.length>6 && t.length<=10); tc.classList.toggle('lots', t.length>10);
  const pickable=new Set(), selCard=selectedCard();
  if(selCard) combos(selCard, t).forEach(cb=>cb.forEach(x=>pickable.add(x.id)));
  tc.innerHTML = t.length ? t.map(c=>cardHTML(c, (SEL.take.includes(c.id)?'sel ':'')+(pickable.has(c.id)?'pick':''))).join('') : `<div class="vacia">Mesa vacía 🧹</div>`;
  $$('#tcards .card').forEach(el=>el.onclick=()=>tableClick(+el.dataset.id));
  renderSum();
}
function renderSum(){
  const ch=$('#sumchip'), c=selectedCard();
  if(!c){ ch.style.display='none'; return; }
  const take=SEL.take.map(id=>(V.table||[]).find(x=>x.id===id)).filter(Boolean), s=val(c)+sumV(take);
  ch.style.display='block'; ch.classList.toggle('ok', s===15 && take.length>0);
  ch.textContent = take.length ? `${val(c)} + ${take.map(val).join(' + ')} = ${s}${s===15?' ✅ ¡15!':s>15?' (te pasaste)':` (faltan ${15-s})`}` : `Tu ${rankName(c.n).toLowerCase()} vale ${val(c)}: te faltan ${15-val(c)} de la mesa`;
}
const meP = () => V && V.players.find(p=>p.id===me());
const isMyTurn = () => V && V.phase==='play' && V.players[V.turn] && V.players[V.turn].id===me();
function selectedCard(){ const p=meP(); return p && SEL.id!=null && isMyTurn() ? (p.hand||[]).find(x=>x.id===SEL.id) : null; }
function fixSel(){
  const p=meP();
  if(!p || !isMyTurn() || !(p.hand||[]).some(x=>x.id===SEL.id)){ SEL.id=null; SEL.take=[]; return; }
  SEL.take=SEL.take.filter(id=>(V.table||[]).some(x=>x.id===id));
}
function renderHand(){
  const el=$('#hand'), p=meP();
  if(!p){ el.innerHTML=`<div class="empty">👀 Mirando la partida</div>`; $('#mineTag').innerHTML=''; return; }
  const hand=p.hand||[], myTurn=isMyTurn(), t=VT(p.team);
  $('#mineTag').innerHTML = `<div class="mine ${myTurn?'turn':''}" style="--pc:${p.color}">${headHTML(p)}<span class="av">${esc(p.emoji)}</span><b>${esc(p.name)}</b>${t?` · ${t.score} pts`:''}</div>`;
  headsAfterRender();
  if(!hand.length){ el.innerHTML=`<div class="empty">${V.phase==='play'?'Sin cartas: esperá el próximo reparto 🃏':''}</div>`; return; }
  el.innerHTML = hand.map(c=>{
    const cs=combos(c, V.table||[]), escoba=cs.some(cb=>cb.length===(V.table||[]).length);
    const hint = HINTS.on && myTurn && cs.length ? `<span class="hint">${escoba?'🧹 ¡escoba!':'levanta'}</span>` : '';
    return `<div class="cw">${hint}${cardHTML(c, (c.id===SEL.id?'sel ':'')+(HINTS.on&&myTurn&&cs.length?'can':''))}</div>`;
  }).join('');
  $$('#hand .card').forEach(c=>c.onclick=()=>cardClick(+c.dataset.id));
}
// la mejor forma de levantar con esa carta (escoba primero, después el siete velo, sietes, oros y cantidad)
function bestCombo(c, cs){
  const t=V.table||[];
  const sc = cb => (cb.length===t.length?100:0) + (cb.some(isVelo)?30:0) + cb.filter(x=>x.n===7).length*6 + cb.filter(x=>x.s==='o').length*2 + cb.length;
  return cs.slice().sort((a,b)=>sc(b)-sc(a))[0];
}
function cardClick(id){
  const p=meP(); if(!p || V.phase!=='play') return;
  if(!isMyTurn()) return toast('Esperá tu turno ⏳');
  const c=(p.hand||[]).find(x=>x.id===id); if(!c) return;
  const cs=combos(c, V.table||[]);
  if(SEL.id===id){   // segundo toque en la misma carta: si hay una sola forma, se juega
    const take=SEL.take.map(x=>V.table.find(y=>y.id===x)).filter(Boolean);
    if(take.length && val(c)+sumV(take)===15) return playSel();
    if(!cs.length) return playDrop();
    if(cs.length===1) { SEL.take=cs[0].map(x=>x.id); return playSel(); }
    return toast('Hay varias formas de levantar: tocá las cartas de la mesa o elegí abajo cuál.');
  }
  SEL.id=id; SEL.take = cs.length ? bestCombo(c, cs).map(x=>x.id) : [];
  sfx.card && tone(520,.05,'sine',.06);
  renderCenter(); renderHand(); renderActions();
}
function tableClick(id){
  if(DRAG.moved) return;
  if(!isMyTurn()) return toast(V && V.phase==='play' ? 'Esperá tu turno ⏳' : '');
  if(SEL.id==null) return toast('Primero tocá una carta de tu mano 👇');
  SEL.take = SEL.take.includes(id) ? SEL.take.filter(x=>x!==id) : SEL.take.concat(id);
  renderCenter(); renderActions();
}
function playSel(){
  const c=selectedCard(); if(!c) return;
  const take=SEL.take.slice();
  if(!take.length) return playDrop();
  const s=val(c)+sumV(take.map(id=>V.table.find(x=>x.id===id)).filter(Boolean));
  if(s!==15) return toast(`Suma ${s}: tiene que dar 15 justo.`);
  doAct({type:'play', id:c.id, take}); SEL.id=null; SEL.take=[];
}
function playDrop(){
  const c=selectedCard(); if(!c) return;
  if(V.opts.forceCap && combos(c, V.table||[]).length) return toast('Con esa carta podés levantar: en esta mesa es obligatorio 👉');
  doAct({type:'play', id:c.id, take:[]}); SEL.id=null; SEL.take=[];
}
function pickCombo(i){ const c=selectedCard(); if(!c) return; const cs=combos(c, V.table||[]); if(!cs[i]) return; SEL.take=cs[i].map(x=>x.id); playSel(); }
function renderActions(){
  const p=meP(), A=$('#actions'), st=$('#status');
  if(V.phase!=='play'){ A.innerHTML=V.phase!=='lobby'?`<button class="btn gold" onclick="LAST.dismissedEnd=null;roundModal(true)">🏆 Ver el conteo</button>`:''; st.innerHTML=''; return; }
  const cp=V.players[V.turn];
  let h='', s='';
  if(p && isMyTurn()){
    const c=selectedCard();
    if(!c){ s=`🟢 <b>¡Te toca!</b> Elegí una carta de tu mano: con la mesa tiene que sumar <b>15</b> para levantar.`; }
    else {
      const cs=combos(c, V.table||[]), t=V.table||[];
      const take=SEL.take.map(id=>t.find(x=>x.id===id)).filter(Boolean), ok=take.length && val(c)+sumV(take)===15;
      s = cs.length ? `Con <b>${esc(cardName(c))}</b> podés levantar ${cs.length===1?'esto':'de '+cs.length+' formas'}. Tocá las cartas de la mesa para cambiar.` : `<b>${esc(cardName(c))}</b> no junta 15 con nada: va a la mesa.`;
      if(cs.length>1) h+=cs.slice(0,6).map((cb,i)=>`<button class="btn chip ${cb.length===t.length?'esc':''}" onclick="pickCombo(${i})">${cb.length===t.length?'🧹 ':''}${cb.map(cardShort).join(' + ')}</button>`).join('');
      h+=`<button class="btn cap" onclick="playSel()" ${ok?'':'disabled'}>🧹 Levantar${take.length===t.length&&ok?' ¡y es ESCOBA!':''}</button>`;
      if(!(V.opts.forceCap && cs.length)) h+=`<button class="btn gray" onclick="playDrop()">⬇️ Tirar a la mesa</button>`;
      h+=`<button class="btn dark" onclick="SEL.id=null;SEL.take=[];renderCenter();renderHand();renderActions()">✕</button>`;
    }
  } else if(cp){
    const tm=VT(cp.team);
    s = `${p?'⏳':'👀'} Turno de <b>${esc(cp.emoji)} ${esc(cp.name)}</b>${cp.bot?' 🤖':''}${p && tm && tm.members.includes(me()) && cp.id!==me()?' (tu compañero)':''}`;
  }
  A.innerHTML=h; st.innerHTML=s;
}
function turnNotice(){
  if(V.phase!=='play') return;
  const key=V.round+':'+V.turn+':'+V.turnAt;
  if(key===LAST.turnKey) return; LAST.turnKey=key;
  if(isMyTurn() && LAST.ev!=null && meP() && (meP().hand||[]).length){
    sfx.turn(); if(navigator.vibrate) try{ navigator.vibrate(120); }catch(e){}
    const d=document.createElement('div'); d.className='yourturn'; d.textContent='🟢 ¡Te toca!'; document.body.appendChild(d); setTimeout(()=>d.remove(),1700);
  }
}

// ---------- animaciones de lo que pasa en la mesa ----------
function seatRect(pid){ const s=document.querySelector(`.seat[data-pid="${pid}"] .tag`); return s ? s.getBoundingClientRect() : null; }
function pileRect(pid){ const s=document.querySelector(`.seat[data-pid="${pid}"] .pilebox .pw`); return s ? s.getBoundingClientRect() : seatRect(pid); }
function fly(html, from, to, delay, done, rot){
  if(!from || !to) { if(done) setTimeout(done, delay); return; }
  const box=document.createElement('div'); box.innerHTML=html; const c=box.firstElementChild;
  c.style.setProperty('--w', to.width+'px'); c.style.transformOrigin='0 0';
  const sc=Math.max(.3, from.width/to.width);
  c.style.transform=`translate(${from.left}px,${from.top}px) scale(${sc})`;
  c.style.opacity='0';
  $('#fly').appendChild(c);
  setTimeout(()=>{ c.style.opacity='1'; c.getBoundingClientRect(); c.style.transform=`translate(${to.left}px,${to.top}px) rotate(${rot||0}deg)`; }, delay+16);
  setTimeout(()=>{ c.remove(); if(done) done(); }, delay+480);
}
const smallR = (r, w) => r ? {left:r.left+r.width/2-w/2, top:r.top+r.height/2-w*.75, width:w, height:w*1.5} : null;
function bigText(t, sub){ const d=document.createElement('div'); d.className='big-esc'; d.innerHTML=esc(t)+(sub?`<small>${esc(sub)}</small>`:''); document.body.appendChild(d); setTimeout(()=>d.remove(),1700); }
function processEvents(before){
  const evs=V.ev||[], maxI=evs.length?evs[evs.length-1].i:0;
  if(LAST.ev==null || maxI<LAST.ev){ LAST.ev=maxI; return; }   // recién llegó: no se repite lo de antes
  const news=evs.filter(e=>e.i>LAST.ev); LAST.ev=maxI;
  if(news.length>6) return;
  let delay=0;
  const deckR=$('#deck .card') && $('#deck .card').getBoundingClientRect();
  const tw=($('#tcards .card')||$('#tcards')).getBoundingClientRect().width || 60;
  for(const e of news){
    const from = e.pid===me() && before[e.card&&e.card.id] ? before[e.card.id] : smallR(seatRect(e.pid), tw*.6);
    if(e.k==='drop'){
      const el=document.querySelector(`#tcards .card[data-id="${e.card.id}"]`), to=el && el.getBoundingClientRect();
      if(el) el.style.visibility='hidden';
      fly(cardHTML(e.card), from, to, delay, ()=>{ if(el) el.style.visibility=''; }, 0);
      setTimeout(()=>sfx.card(), delay); delay+=260;
    } else if(e.k==='cap'){
      const first=e.take[0], tr=before[first.id] || $('#tcards').getBoundingClientRect();
      const mid={left:tr.left+tr.width*.25, top:tr.top-tr.height*.1, width:tr.width, height:tr.height};
      const pr=smallR(pileRect(e.pid), 24);
      fly(cardHTML(e.card), from, mid, delay, null, 8);
      setTimeout(()=>sfx.card(), delay);
      delay+=470;
      [e.card, ...e.take].forEach((c,j)=>{
        const r=before[c.id] || mid;
        fly(cardHTML(c), j===0?mid:r, pr, delay+j*70);
      });
      setTimeout(()=>sfx.take(e.take.length+1), delay);
      if(e.esc){ const p=VP(e.pid); setTimeout(()=>{ bigText('¡ESCOBA! 🧹', p?p.name:''); sfx.escoba(); say('¡Escoba!'); }, delay); }
      else if(e.velo){ const p=VP(e.pid); setTimeout(()=>{ bigText('🪙 ¡Siete velo!', p?p.name+' se lo lleva':''); sfx.velo(); }, delay); }
      delay+=e.take.length*70+380;
    } else if(e.k==='mesa'){
      const p=VP(e.pid), pr=smallR(pileRect(e.pid), 24);
      e.cards.forEach((c,j)=>fly(cardHTML(c), before[c.id] || $('#tcards').getBoundingClientRect(), pr, delay+300+j*90));
      setTimeout(()=>{ bigText(e.n>1?'¡DOS ESCOBAS! 🧹🧹':'¡ESCOBA! 🧹', `La mesa sumó ${e.n*15}: para ${p?p.name:''}`); sfx.escoba(); }, delay+300);
      delay+=900;
    } else if(e.k==='deal'){ sfx.shuffle(); dealAnim(e.first); }
    else if(e.k==='end'){ setTimeout(()=>{ sfx.win(); }, delay+300); }
  }
}
function dealAnim(first){
  const deckR=$('#deck .card') && $('#deck .card').getBoundingClientRect(); if(!deckR) return;
  sfx.deal(V.players.length*3);
  V.players.forEach((p,i)=>{
    const r = p.id===me() ? $('#hand').getBoundingClientRect() : seatRect(p.id); if(!r) return;
    const tr={left:r.left+r.width/2-14, top:r.top, width:28, height:42};
    for(let j=0;j<3;j++) fly(backHTML(), deckR, tr, (i+j*V.players.length)*55);
  });
  if(first) $$('#tcards .card').forEach((el,j)=>{ const to=el.getBoundingClientRect(); el.style.visibility='hidden'; fly(backHTML(), deckR, to, 400+j*90, ()=>el.style.visibility=''); });
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
  const R=V.roundRes; if(!R) return;
  const delayMs = force ? 0 : 1500;
  setTimeout(()=>{ if(V.phase!=='roundEnd' && V.phase!=='over') return; modal(roundHTML(R)); }, delayMs);
}
function roundHTML(R){
  const host=amHost(), over=V.phase==='over', o=V.opts;
  const T=R.teams.map(r=>({r, t:VT(r.id)}));
  const won = (r, label) => r.why.includes(label);
  const cell = (r, txt, label) => `<td class="${label&&won(r,label)?'won':''}">${txt}${label&&won(r,label)?' ⭐':''}</td>`;
  const tie = k => R.ties[k] ? ' <span class="muted">(empate: nadie)</span>' : '';
  let rows='';
  rows+=`<tr><td>🧹 Escobas</td>${T.map(({r})=>`<td class="${r.esc?'won':''}">${r.esc||'—'}${r.esc?` <small>(+${r.esc})</small>`:''}</td>`).join('')}</tr>`;
  rows+=`<tr><td>🂠 Cartas${tie('nC')}</td>${T.map(({r})=>cell(r, r.nC, 'más cartas')).join('')}</tr>`;
  rows+=`<tr><td>🪙 Oros${tie('nO')}</td>${T.map(({r})=>cell(r, r.nO, 'más oros')).join('')}</tr>`;
  rows+=`<tr><td>7️⃣ Siete velo</td>${T.map(({r})=>cell(r, r.velo?'✔️':'—', 'el siete velo')).join('')}</tr>`;
  if(o.sevens!=='setenta') rows+=`<tr><td>7️⃣ Sietes${tie('n7')}</td>${T.map(({r})=>cell(r, r.n7, 'más sietes')).join('')}</tr>`;
  if(o.sevens!=='sietes') rows+=`<tr><td>🎯 Setenta${tie('prim')}</td>${T.map(({r})=>cell(r, r.prim||'—', 'la setenta')).join('')}</tr>`;
  if(o.bonus) rows+=`<tr><td>🎖️ Premios</td>${T.map(({r})=>{ const b=r.why.filter(w=>w.startsWith('premio')).length; return `<td class="${b?'won':''}">${b?'+'+b:'—'}</td>`; }).join('')}</tr>`;
  rows+=`<tr><td>Oros y sietes</td>${T.map(({r})=>`<td><div class="cards">${(r.shown||[]).map(c=>cardHTML(c,'mini')).join('')}</div></td>`).join('')}</tr>`;
  rows+=`<tr class="tot"><td>Puntos de esta mano</td>${T.map(({r})=>`<td>+${r.pts}</td>`).join('')}</tr>`;
  rows+=`<tr class="tot"><td>Total</td>${T.map(({t})=>`<td>${t?t.score:0}</td>`).join('')}</tr>`;
  const head=`<tr><th></th>${T.map(({t})=>`<th style="color:${t&&t.color||'#333'}">${esc(t?vTeamName(t):'')}${t&&t.members.includes(me())?'<br><small>(vos)</small>':''}</th>`).join('')}</tr>`;
  const lt=VP(R.lastTaker);
  const w=VT(V.winner);
  const nobs = NET.obs && V.phase==='roundEnd' && V.players.some(p=>p.bot) ? `<button class="btn gold wide" style="margin-top:6px" onclick="doAct({type:'joinNext'});closeModal()">🪑 Tomar el lugar de un bot</button>`
    : NET.obs && over && V.players.length<MAXP ? `<button class="btn gold wide" style="margin-top:6px" onclick="doAct({type:'joinNext'});closeModal()">🪑 Sentarme para la próxima partida</button>` : '';
  return `<h2>${over?'🎉 ¡Terminó la partida!':'🧮 El conteo de la mano '+V.round}</h2>
    ${over?`<p style="font-size:17px">${w?`🥇 <b>${esc(vTeamName(w))}</b> gana con <b>${w.score}</b> puntos.`:'🤝 Terminó empatada.'}</p>`:''}
    ${R.left&&R.left.length&&lt?`<p class="muted" style="margin:0">🧺 ${esc(lt.name)} levantó último y se llevó lo que quedó en la mesa (${R.left.length} carta${R.left.length>1?'s':''}).</p>`:''}
    <div class="scorewrap"><table class="score">${head}${rows}</table></div>
    <p class="muted">Vale 1 punto: cada escoba, el que tiene más cartas, más oros, el siete de oros (siete velo) y ${o.sevens==='sietes'?'el que tiene más sietes':o.sevens==='setenta'?'la setenta':'más sietes y la setenta'}.${o.target?` Gana el primero que llega a <b>${o.target}</b>.`:''}</p>
    ${host ? (over?`<button class="btn green wide" onclick="closeModal();doAct({type:'newGame'})">🔁 Otra partida</button>`:`<button class="btn green wide" onclick="closeModal();doAct({type:'nextRound'})">▶️ Siguiente mano</button>`)
      : `<p class="muted" style="text-align:center">⏳ Esperando que el anfitrión ${over?'arme otra partida':'reparta la siguiente mano'}…</p>`}
    ${nobs}
    <button class="btn gray wide" style="margin-top:6px" onclick="closeModal()">Ver la mesa</button>`;
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
    const cs=[].concat(l.card?[l.card]:[], l.take||[], l.cards||[]);
    return `<div class="hline ${l.esc?'esc':''} ${i<fresh&&fresh<5?'new':''}">${cs.length?`<span class="cs">${cs.map(c=>cardHTML(c,'mini')).join('')}</span>`:''}<span class="t">${esc(l.x)}</span></div>`;
  }).join('') : '<p class="muted">Todavía no hay jugadas.</p>';
}
function renderMesaTab(){
  const host=amHost(), inPlay=V.phase!=='lobby';
  const tl = inPlay && V.teams && V.teams.length ? `<b>Puntos${V.opts.target?` (se juega a ${V.opts.target})`:' (una sola mano)'}</b>` + V.teams.slice().sort((a,b)=>b.score-a.score).map(t=>`<div class="prow" style="border-left:5px solid ${t.color}"><span class="nm"><b>${esc(vTeamName(t))}</b><small>${t.members.map(id=>{ const p=VP(id); return p?`🧺 ${p.pileN||0}${p.esc?' · 🧹'+p.esc:''}`:''; }).join(' / ')}</small></span><span class="pts">${t.score}</span></div>`).join('') : '';
  const ps=V.players.map((p,i)=>{
    const cnt=p.hand?p.hand.length:p.n, offline=!p.bot&&!p.conn;
    return `<div class="prow" style="border-left:5px solid ${p.color}"><span style="font-size:22px">${esc(p.emoji)}</span><span class="nm"><b>${esc(p.name)}${p.id===me()?' (vos)':''}${p.id===V.hostPid&&NET.mode!=='local'?' 👑':''}</b>
      <small>${inPlay?`🂠 ${cnt} en la mano · 🧺 ${p.pileN||0} levantadas${p.esc?' · 🧹 '+p.esc:''}`:''}${p.bot?' · 🤖 bot':''}${p.mic?' · 🎙️':''}${offline?' · ⚠️ sin conexión':''}${inPlay&&V.players[V.turn]===p&&V.phase==='play'?' · ⏳ su turno':''}</small></span>
      ${host&&p.id!==V.hostPid&&NET.mode!=='local'?`${offline&&inPlay?`<button class="btn sm gray" onclick="doAct({type:'botify',pid:'${p.id}'})" title="Que juegue un bot">🤖</button>`:''}<button class="btn sm gray" onclick="if(confirm('¿Sacar a ${esc(p.name)} de la mesa?'))doAct({type:'kick',pid:'${p.id}'})" title="Sacar">✕</button>`:''}</div>`;
  }).join('');
  const obs=(V.observers||[]).map(o=>`<div class="prow"><span style="font-size:20px">👀</span><span class="nm"><b>${esc(o.name)}${o.id===me()?' (vos)':''}</b><small>mirando${o.mic?' · 🎙️':''}</small></span></div>`).join('');
  const sit = NET.obs && (V.phase==='over' && V.players.length<MAXP) ? `<button class="btn gold wide" onclick="doAct({type:'joinNext'})">🪑 Sentarme a jugar</button>`
    : NET.obs && V.phase==='roundEnd' && V.players.some(p=>p.bot) ? `<button class="btn gold wide" onclick="doAct({type:'joinNext'})">🪑 Tomar el lugar de un bot</button>`
    : NET.obs ? `<p class="muted">Entre manos podés tomar el lugar de un bot; si no, te sentás en la próxima partida.</p>` : '';
  const info = inPlay ? `<p class="muted">Mano ${V.round} · quedan ${V.deckN!=null?V.deckN:(V.deck||[]).length} cartas en el mazo · reparte ${esc((V.players[V.dealer]||{}).name||'')}</p>` : '';
  $('#mesaList').innerHTML = info + tl + `<b>Jugadores (${V.players.length}/6)</b>` + ps + (obs?`<b>Mirando</b>${obs}`:'') + sit
    + (NET.mode!=='local'&&NET.code?`<p class="muted" style="margin-top:12px">Invitá con el código <b>${NET.code}</b> <button class="btn sm" onclick="shareRoom()">📤 Compartir</button></p>`:'');
}
function renderReglasTab(){
  const o=V.opts, on=HOUSE.filter(h=>o[h.k]);
  const host=amHost(), localEdit = NET.mode==='local';
  const lo=Object.assign(defaultOpts(), load('esc_localopts')||{});
  const lsel=(k, list)=>`<select onchange="setLocalOpt('${k}',this.value)">${list.map(t=>`<option value="${t.v}" ${lo[k]==t.v?'selected':''}>${t.t}</option>`).join('')}</select>`;
  $('#reglasList').innerHTML = `<p style="margin-top:0"><b>${(TARGETS.find(t=>t.v==o.target)||{}).t||''}</b> · ${(MODES.find(m=>m.v===o.mode)||{}).t||''}<br>${(SEVENS.find(m=>m.v===o.sevens)||{}).t||''}</p>`
    + (localEdit ? `<p class="muted">Lo que cambies acá vale para la próxima partida de práctica.</p><label style="font-weight:800;font-size:13px">Partida</label>${lsel('target',TARGETS)}<label style="font-weight:800;font-size:13px">Los sietes</label>${lsel('sevens',SEVENS)}<div style="height:8px"></div>`
        +HOUSE.map(h=>`<label class="opt" style="font-weight:400"><input type="checkbox" ${lo[h.k]?'checked':''} onchange="setLocalOpt('${h.k}',this.checked)"><span><b>${h.t}</b><small>${h.d}</small></span></label>`).join('')
      : `<b>Reglas de la casa activas</b>` + (on.length ? on.map(h=>`<div class="opt"><span><b>${h.t}</b><small>${h.d}</small></span></div>`).join('') : '<p class="muted">Ninguna.</p>'))
    + `<b>📝 Reglas propias del grupo</b>` + (V.grules?`<div class="grules" style="margin:6px 0 10px">${esc(V.grules)}</div>`:`<p class="muted">${host&&!localEdit?'Las podés escribir en la sala de espera.':'No hay.'}</p>`)
    + `<b>💡 Sugerencias</b><div style="margin-top:6px">${sugsHTML(host)}</div>
       <div class="row"><input type="text" id="sugIn2" maxlength="240" placeholder="Proponé una regla…" onkeydown="if(event.key==='Enter')sendSug('sugIn2')"><button class="btn sm" style="flex:0 0 auto" onclick="sendSug('sugIn2')">Sugerir</button></div>
       <button class="btn dark wide" style="margin-top:12px" onclick="showRules()">📜 Reglas completas de la Escoba</button>`;
}
function setLocalOpt(k, v){
  const o=Object.assign(defaultOpts(), load('esc_localopts')||{});
  o[k] = k==='target' ? +v : k==='sevens' ? v : !!v;
  store('esc_localopts', o); toast('Se usa en la próxima partida de práctica.');
}

// ---------- compartir ----------
function roomLink(){ return location.origin+location.pathname+'#'+NET.code; }
function copyCode(){ navigator.clipboard && navigator.clipboard.writeText(NET.code).then(()=>toast('Código copiado: '+NET.code)); }
function shareRoom(){
  const url=roomLink(), text=`¡Vení a jugar a la Escoba de 15 conmigo! 🧹🇵🇾 Sala ${NET.code}`;
  if(navigator.share) return navigator.share({title:'Escoba de 15', text, url}).catch(()=>{});
  modal(`<h2>📤 Invitar a la sala ${NET.code}</h2><p style="word-break:break-all;user-select:all;background:#fff;padding:8px;border-radius:8px">${esc(url)}</p>
    <a class="btn green wide" style="display:block;text-align:center;text-decoration:none" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text+' '+url)}">💬 Mandar por WhatsApp</a>
    <button class="btn wide" style="margin-top:6px" onclick="navigator.clipboard.writeText('${url}').then(()=>toast('Enlace copiado'))">📋 Copiar enlace</button>
    <button class="btn gray wide" style="margin-top:6px" onclick="closeModal()">Cerrar</button>`);
}

/* ====================== VISTA 2D / 3D ====================== */
const VIEW=Object.assign({mode:'2d', tilt:50, spin:0, zoom:.88}, load('esc_view')||{});
function saveView(){ store('esc_view', {mode:VIEW.mode, tilt:VIEW.tilt, zoom:VIEW.zoom}); }
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
  else if(k==='tilt') VIEW.tilt=Math.max(20, Math.min(66, VIEW.tilt+d));
  else if(k==='zoom') VIEW.zoom=Math.max(.5, Math.min(1.3, +(VIEW.zoom+d).toFixed(2)));
  else if(k==='reset'){ VIEW.spin=0; VIEW.tilt=50; VIEW.zoom=.88; }
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
    VIEW.spin=DRAG.spin+dx*.35; VIEW.tilt=Math.max(20, Math.min(66, DRAG.tilt+dy*.15)); applyView();
  });
  window.addEventListener('pointerup', ()=>{ if(!DRAG.on) return; DRAG.on=false; $('#mesa').classList.remove('dragging'); if(DRAG.moved){ saveView(); setTimeout(()=>DRAG.moved=false, 50); } });
})();
window.addEventListener('resize', ()=>{ if(V && V.phase!=='lobby') renderSeats(); });

/* ====================== REGLAS ====================== */
function showRules(){
  const ex=(s,n)=>cardHTML({id:0, s, n});
  modal(`<div class="rules"><h2>📜 Reglas de la Escoba de 15</h2>
  <p>Se juega con la <b>baraja española de 40 cartas</b>: oros 🪙, copas 🍷, espadas 🗡️ y bastos 🪵, del 1 al 7 más la sota, el caballo y el rey. Juegan <b>2, 3, 4 o 6</b> personas, cada uno para sí o <b>en parejas</b> (el compañero se sienta enfrente). La idea: <b>levantar cartas que sumen 15</b>.</p>
  <h3>🃏 Lo que vale cada carta</h3>
  <div class="cardrow">${ex('o',1)}${ex('c',5)}${ex('e',7)}${ex('b',10)}${ex('o',11)}${ex('c',12)}</div>
  <table><tr><td>Del 1 (as) al 7</td><td>lo que dicen</td></tr><tr><td>Sota (10) · <i>Mitã</i></td><td>vale 8</td></tr><tr><td>Caballo (11) · <i>Kavaju</i></td><td>vale 9</td></tr><tr><td>Rey (12) · <i>Mburuvicha</i></td><td>vale 10</td></tr></table>
  <p class="muted">Las figuras tienen sombrero pirí y poncho de ao po'i, y el rey lleva un ñandutí en el pecho. Los cortes del marco (las “pintas”) dicen el palo: oros sin corte, copas uno, espadas dos y bastos tres.</p>
  <h3>▶️ Cómo se juega</h3>
  <ul>
    <li>El que reparte da <b>3 cartas a cada uno</b> y pone <b>4 boca arriba en la mesa</b>.</li>
    <li>Si las 4 de la mesa suman <b>15</b>, el que repartió se las lleva y es <b>escoba</b>; si suman <b>30</b>, son <b>dos escobas</b>.</li>
    <li>Empieza el de al lado del que reparte. En tu turno tirás <b>una carta</b>: si con una o varias cartas de la mesa suma <b>15 justo</b>, te las llevás junto con la tuya. Si no, tu carta queda en la mesa.</li>
    <li>Si hay varias formas de juntar 15, elegís cuál (en el juego: tocás las cartas de la mesa o el botón de la combinación).</li>
    <li>Si levantás <b>todo lo que había en la mesa</b>, es <b>¡ESCOBA! 🧹</b> y vale 1 punto.</li>
    <li>Cuando todos se quedan sin cartas, se reparten 3 más (sin poner en la mesa) hasta que se acaba el mazo.</li>
    <li>Al final, <b>el último que levantó se lleva lo que quedó en la mesa</b> (eso no es escoba).</li>
  </ul>
  <h3>🧮 El conteo de cada mano</h3>
  <ul>
    <li><b>Cada escoba</b>: 1 punto.</li>
    <li><b>Más cartas</b>: 1 punto (si hay empate, nadie).</li>
    <li><b>Más oros</b>: 1 punto (si hay empate, nadie).</li>
    <li><b>El siete de oros, el “siete velo”</b> <span style="display:inline-block;vertical-align:middle">${cardHTML({id:0,s:'o',n:7},'mini','--w:26px')}</span>: 1 punto.</li>
    <li><b>Más sietes</b>: 1 punto. O, según la variante, <b>la setenta</b>: se suma la mejor carta de cada palo (7 = 21, 6 = 18, as = 16, 5 = 15, 4 = 14, 3 = 13, 2 = 12, figuras = 10) y gana el que tiene más (hay que tener de los cuatro palos).</li>
  </ul>
  <p>Gana la partida el primero que llega a <b>15</b> o a <b>21</b> puntos (lo elige el anfitrión). Si dos llegan empatados arriba, se juega otra mano.</p>
  <h3>🏠 Reglas de la casa (opcionales)</h3>
  ${HOUSE.map(h=>`<p><b>${h.t}</b>: ${h.d}</p>`).join('')}
  <p>Además, cada grupo puede escribir sus propias reglas en la sala y todos pueden <b>sugerir reglas nuevas y votarlas 👍</b>.</p>
  <h3>💬 Chat y voz</h3>
  <p>Escribí <b>@nombre</b> (o elegí a alguien en “Para”) para mandarle un <b>mensaje privado</b>: solo lo ven ustedes dos. Con <b>🤫 En secreto</b> le pasás una seña a tu compañero sin que los demás se enteren. Con 🎤 hablan por voz. 💡 prende o apaga las pistas que marcan qué cartas levantan.</p>
  <p class="muted">🎶 ${MUSIC_CREDIT}</p>
  <button class="btn wide" onclick="closeModal()">Entendido</button></div>`);
}

if('serviceWorker' in navigator && location.protocol==='https:') navigator.serviceWorker.register('sw.js').catch(()=>{});
