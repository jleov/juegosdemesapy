'use strict';
/* =====================================================================
   El Impostor — red (PeerJS) con anfitrión que manda y traspaso de
   anfitrión, chat general y privado, voz, la tarjeta secreta, la ronda
   de jugadores, votación, sonidos y música de fondo.
   ===================================================================== */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function store(k,v){ try{ if(v===undefined) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
function load(k){ try{ const v=localStorage.getItem(k); return v==null?null:JSON.parse(v); }catch(e){ return null; } }
function toast(x){ const t=$('#toast'); t.textContent=x; t.style.display='block'; clearTimeout(toast.t); toast.t=setTimeout(()=>t.style.display='none', 3800); }
const PREFIX='impostorpy26-';
const genCode = () => { const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s=''; for(let i=0;i<5;i++) s+=A[rnd(A.length)]; return s; };
let myToken=load('imp_token'); if(!myToken){ myToken=Math.random().toString(36).slice(2)+Date.now().toString(36); store('imp_token', myToken); }
const NET={mode:null, peer:null, code:null, conns:{}, hostConn:null, myPid:null, obs:null, welcomed:false};
let CHAT=[], V=null;
const me = () => NET.myPid || NET.obs;
const VP = id => V && (V.players.find(p=>p.id===id) || (V.observers||[]).find(o=>o.id===id));
const amHost = () => NET.mode==='local' || (V && V.hostPid===NET.myPid && NET.mode==='host');

/* ====================== MENÚ ====================== */
let myEmojiSel = load('imp_emoji') || EMOJIS[0];
const myName = () => ($('#myName').value.trim() || 'Jugador').slice(0,16);
const myEmoji = () => myEmojiSel;
$('#myName').value = load('imp_name') || load('esc_name') || load('uno_name') || '';
$('#myName').addEventListener('input', ()=>store('imp_name', $('#myName').value.trim()));
function renderTokenPicker(){
  $('#tokens').innerHTML = EMOJIS.map(e=>`<button class="tok ${e===myEmojiSel?'sel':''}" onclick="pickEmoji('${e}')">${e}</button>`).join('');
}
function pickEmoji(e){ myEmojiSel=e; store('imp_emoji', e); renderTokenPicker(); }
renderTokenPicker();
function needName(){ if(!$('#myName').value.trim()){ toast('Escribí tu nombre primero ✍️'); $('#myName').focus(); return true; } store('imp_name', myName()); return false; }
function joinClick(){
  const code=$('#joinCode').value.trim().toUpperCase(); if(!code) return toast('Escribí el código de la sala.');
  if(needName()) return; clientJoin(code);
}
function resumeClick(){
  const h=load('imp_host'), c=load('imp_client');
  if(h && (!c || h.at>=c.at)) return hostStart(true);
  if(c){ if(needName()) return; clientJoin(c.code); }
}
function refreshResume(){
  const h=load('imp_host'), c=load('imp_client'), ok=x=>x && Date.now()-x.at<6*3600e3;
  $('#btnResume').style.display = ok(h)||ok(c) ? 'block' : 'none';
}
refreshResume();
(function(){   // enlace con #CÓDIGO o ?sala=CÓDIGO
  const m=(location.hash.slice(1) || new URLSearchParams(location.search).get('sala') || '').toUpperCase();
  if(/^[A-Z0-9]{4,6}$/.test(m)){ $('#joinCode').value=m;
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
  S=lobbyState(); S.opts=Object.assign(defaultOpts(), load('imp_localopts')||{});
  const p=addPlayer(myName(), myEmoji(), myToken, null); NET.myPid=p.id; S.hostPid=p.id;
  const n=parseInt($('#nBots').value)||4; for(let i=0;i<n;i++) addBot();
  sysChat('🤖 Práctica contra bots: elegí las reglas y tocá “Empezar”. Los bots dan pistas, discuten y votan.');
  LAST.ev=null; FACES={}; commit(); shareMyFace();
}
function leaveClick(){
  if(NET.mode==='local'){ if(S && S.phase!=='lobby' && !confirm('¿Salir de la partida contra los bots?')) return; return leaveToMenu(); }
  if(!confirm('¿Salir de la sala?')) return;
  if(NET.mode==='host'){
    const others=hostCandidates(S);
    if(others.length) return hostHandover();
    store('imp_host', undefined);
  } else if(NET.mode==='client'){
    if(NET.hostConn && NET.hostConn.open && NET.myPid) try{ NET.hostConn.send({t:'act', a:{type:'leave'}}); }catch(e){}
    store('imp_client', undefined);
  }
  setTimeout(leaveToMenu, 250);
}
function leaveToMenu(){
  if(NET.mode==='local' && S) store('imp_localopts', S.opts);
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
// lo que ve cada uno: la palabra y los impostores solo los ve quien corresponde
function publicState(forPid){
  const s=JSON.parse(JSON.stringify(S));
  const p=S.players.find(x=>x.id===forPid), ob=(S.observers||[]).find(o=>o.id===forPid);
  const open = S.phase==='roundEnd' || S.phase==='over';
  let mine=null;
  if(p && S.word && S.phase!=='lobby'){
    const imp=S.imps.includes(p.id), h=S.opts.hint, enc=h==='encubierto';
    mine = (!imp || enc) ? {role:'civ', word: imp ? S.sim : S.word, cat:S.cat}
      : {role:'imp', cat:(h==='cat'||h==='ambas') ? S.cat : null, sim:(h==='parecida'||h==='ambas') ? S.sim : null,
         mates: S.opts.know ? S.imps.filter(id=>id!==p.id) : []};
  } else if(ob && ob.owner && S.word){ mine={owner:true, word:S.word, cat:S.cat, imps:S.imps.slice()}; }
  s.mine=mine;
  delete s.word; delete s.sim; delete s.imps; delete s.hunters; delete s.ownerTok; delete s.botTalk; delete s.botVoteAt; delete s.used;
  if(!open) delete s.cat;
  s.players.forEach(x=>{ delete x.token; });
  (s.observers||[]).forEach(o=>delete o.token);
  if(S.phase==='vote' && S.opts.vote==='secreto'){ const v={}; for(const k in S.votes) v[k] = k===forPid ? S.votes[k] : true; s.votes=v; }
  s.dlAt=S.dl||0;
  return s;
}
function commit(){
  if(NET.mode==='host'){
    const now=Date.now();
    for(const pid in NET.conns){ const c=NET.conns[pid]; if(c && c.open) try{ const st=publicState(pid); st.left = S.dl ? S.dl-now : 0; c.send({t:'state', s:st}); }catch(e){} }
    sendBackups();
    if(!NET.noSave) store('imp_host', {code:NET.code, S, CHAT:CHAT.slice(-80), myPid:NET.myPid, at:Date.now()});
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
  const saved = resume ? load('imp_host') : null;
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
    if(resume){ toast('La sala sigue abierta en otro aparato (otro jugador quedó de anfitrión). Entrá con el código.'); peer.destroy(); store('imp_host',undefined); NET.mode=null; $('#joinCode').value=NET.code; return; }
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
  store('imp_host', undefined);
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
        why = S.phase==='lobby' ? `La ronda está llena (${MAXP} jugadores): entraste a mirar 👀.` : 'La partida ya empezó: entraste a mirar 👀. Cuando termine la ronda te podés sumar.';
        ob={id:'o'+(++S.seq), name:nm, emoji:'👀', token:d.token, peerId:conn.peer, conn:true};
        S.observers.push(ob); sysChat(`👀 ${ob.name} entró a mirar.`);
      }
    } else if(p) sysChat(`${p.emoji} ${p.name} se reconectó.`);
    else { why='Volviste a mirar 👀.'; sysChat(`👀 ${ob.name} volvió a mirar.`); }
    const who=p||ob;
    if(NET.conns[who.id] && NET.conns[who.id]!==conn) try{ NET.conns[who.id].close(); }catch(e){}
    conn.pid=who.id; NET.conns[who.id]=conn; who.conn=true; who.peerId=conn.peer; who.mic=false; who.cam=false; delete who.offAt;
    if(p && p.bot && p.token===d.token){ p.bot=false; }
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
function onSeatChange(oldId, newId){
  if(NET.mode!=='host') return;
  const c=NET.conns[oldId]; if(!c) return;
  delete NET.conns[oldId]; NET.conns[newId]=c; c.pid=newId;
  if(FACES[oldId]){ FACES[newId]=FACES[oldId]; delete FACES[oldId]; }
  try{ c.send({t:'welcome', pid:newId, code:NET.code, why:'🪑 ¡Te sumaste a la ronda!', force:true}); }catch(e){}
}
function hostOnClose(conn){
  const pid=conn.pid; if(!pid || NET.conns[pid]!==conn || !S) return;
  delete NET.conns[pid];
  const ob=OB(pid);
  if(ob){ S.observers=S.observers.filter(x=>x!==ob); sysChat(`👀 ${ob.name} dejó de mirar.`); commit(); return; }
  const p=P(pid); if(!p) return;
  if(S.phase==='lobby'){ S.players=S.players.filter(x=>x!==p); sysChat(`${p.name} salió de la sala.`); }
  else if(!p.bot){ p.conn=false; p.mic=false; p.cam=false; p.offAt=Date.now(); sysChat(`⚠️ ${p.name} se desconectó. Si no vuelve, un bot juega por él.`); }
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
  if(mine){ if(['lobby','roundEnd','over'].includes(S.phase)) S.players=S.players.filter(p=>p!==mine); else { mine.bot=true; mine.conn=false; mine.token=null; log(`🚪 ${mine.name} se fue: un bot sigue en su lugar.`); } }
  const c=NET.conns[next.id];
  try{ c.send({t:'migrate', s:S, chat:CHAT.slice(-80)}); }catch(e){}
  NET.noSave=true; store('imp_host', undefined);
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
  if(S.dl) S.dl=Math.max(S.dl, Date.now()+10000);   // un poco de tiempo extra por el corte
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
      if(!NET.welcomed){ toast('No se encontró la sala '+code+'. Revisá el código.'); store('imp_client',undefined); leaveToMenu(); }
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
    store('imp_client',{code:NET.code, at:Date.now()}); if(location.hash!=='#'+NET.code) history.replaceState(null,'','#'+NET.code);
    if(d.why) toast(d.why);
    setTimeout(shareMyFace, 300);
  }
  else if(d.t==='state'){ S=d.s; S.dlAt = S.left>0 ? Date.now()+S.left : 0; render(); }
  else if(d.t==='chat'){ CHAT.push(d.m); renderChat(d.m); }
  else if(d.t==='chatlog'){ CHAT=d.list||[]; renderChat(); }
  else if(d.t==='faces' || d.t==='face') clientFace(d);
  else if(d.t==='backup'){ NET.backup={s:d.s, chat:d.chat}; }
  else if(d.t==='migrate'){ NET.backup={s:d.s, chat:d.chat}; takeoverHost('handover'); }
  else if(d.t==='kicked'){ toast('🚪 El anfitrión te sacó de la ronda.'); store('imp_client',undefined); leaveToMenu(); }
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
function pushChat(m){
  CHAT.push(m); if(CHAT.length>250) CHAT.shift();
  if(NET.mode==='host') for(const pid in NET.conns){
    if(m.to && pid!==m.to && pid!==m.from) continue;   // los privados solo les llegan a los dos
    const c=NET.conns[pid]; if(c&&c.open) try{ c.send({t:'chat', m}); }catch(e){}
  }
  renderChat(m);
}
const BUB={};   // globito sobre cada jugador con lo último que dijo
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
    if(!m.sys && !m.to){ BUB[m.from]={x:m.x, at:Date.now()}; renderRonda(); setTimeout(renderRonda, 4600); }
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
// frases rápidas para la discusión
function quickSay(what){ if(!what) return; sendChatRaw(what, $('#chatTo').value); }
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
const SND={on:load('imp_snd')!==false, ctx:null};
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
  card(){ noise(.09,.3,0,2200); tone(330,.08,'triangle',.08,.03); },
  clue(){ tone(660,.07,'sine',.09); tone(880,.09,'sine',.07,.06); },
  turn(){ tone(740,.12,'sine',.14); tone(988,.18,'sine',.14,.11); },
  tick(){ tone(1200,.04,'square',.04); },
  vote(){ [196,196,262].forEach((f,i)=>tone(f,.18,'triangle',.13,i*.16)); },
  drum(){ for(let i=0;i<10;i++) noise(.06,.16+i*.02,i*.09,300); },
  imp(){ tone(220,.5,'sawtooth',.08); tone(175,.7,'sawtooth',.08,.25); [523,659,784].forEach((f,i)=>tone(f,.25,'triangle',.11,.6+i*.1)); },
  inoc(){ [392,330,262].forEach((f,i)=>tone(f,.3,'triangle',.11,i*.18)); },
  win(){ [523,659,784,1047].forEach((f,i)=>tone(f,.3,'triangle',.14,i*.13)); },
  lose(){ [392,370,349,330].forEach((f,i)=>tone(f,.35,'sawtooth',.06,i*.2)); },
  priv(){ tone(1200,.08,'sine',.08); tone(1500,.1,'sine',.08,.08); },
};
function say(t){ if(!SND.on || !window.speechSynthesis) return; try{ const u=new SpeechSynthesisUtterance(t); u.lang='es-ES'; u.rate=1.1; u.pitch=1.05; speechSynthesis.cancel(); speechSynthesis.speak(u); }catch(e){} }
function toggleSound(){ SND.on=!SND.on; store('imp_snd', SND.on); $('#btnSnd').textContent=SND.on?'🔊':'🔇'; if(SND.on) sfx.turn(); }
$('#btnSnd').textContent=SND.on?'🔊':'🔇';
document.addEventListener('pointerdown', ()=>actx(), {once:true});

/* ---------- música de fondo: una guarania de suspenso con arpa, tocada en el momento (sin archivos) ---------- */
const MUSIC_CREDIT = 'Música propia del juego: una guarania de suspenso con arpa, en menor, que se toca en el momento.';
const MUSIC = { on: load('imp_music')!==false, gain:null, timer:null, t:0, bar:0, VOL:.07 };
const mf = m => 440*Math.pow(2,(m-69)/12);
// 8 compases de 3/4 lentos (la menor): acorde, bajo y melodía por negras (0 = silencio)
const GUARANIA = [
  {ch:[57,60,64], b:45, m:[76,0,72]},
  {ch:[57,60,64], b:45, m:[74,72,71]},
  {ch:[50,53,57], b:38, m:[69,0,65]},
  {ch:[52,56,59,62], b:40, m:[68,0,71]},
  {ch:[57,60,64], b:45, m:[72,74,76]},
  {ch:[53,57,60], b:41, m:[77,76,74]},
  {ch:[52,56,59,62], b:40, m:[71,0,68]},
  {ch:[57,60,64], b:45, m:[69,0,0]},
];
function harp(f, t, v, d){
  const c=SND.ctx, o=c.createOscillator(), o2=c.createOscillator(), g=c.createGain(), lp=c.createBiquadFilter();
  o.type='triangle'; o.frequency.value=f; o2.type='sine'; o2.frequency.value=f*2;
  lp.type='lowpass'; lp.frequency.value=2600;
  g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(v,t+.008); g.gain.exponentialRampToValueAtTime(.0005,t+d);
  const g2=c.createGain(); g2.gain.value=.22;
  o.connect(g); o2.connect(g2).connect(g); g.connect(lp).connect(MUSIC.gain);
  o.start(t); o2.start(t); o.stop(t+d+.05); o2.stop(t+d+.05);
}
function musicSchedule(){
  const c=SND.ctx; if(!c || !MUSIC.gain) return;
  const Q=.62;   // una negra (guarania lenta)
  while(MUSIC.t < c.currentTime+.8){
    const bar=GUARANIA[MUSIC.bar%8], pass=Math.floor(MUSIC.bar/8)%2, t0=MUSIC.t;
    harp(mf(bar.b), t0, .45, 2.2);
    // arpegio de la guarania: corcheas suaves entre los tiempos
    [1,2,3,4,5].forEach((s,k)=>harp(mf(bar.ch[k%bar.ch.length]+12), t0+s*Q/2, .12, 1));
    bar.m.forEach((n,s)=>{ if(n) harp(mf(n+(pass?12:0)), t0+s*Q+(s===1?Q*.15:0), pass?.14:.19, 1.4); });
    MUSIC.t+=3*Q; MUSIC.bar++;
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
function toggleMusic(){ MUSIC.on=!MUSIC.on; store('imp_music', MUSIC.on); musicSync(); toast(MUSIC.on?'🎶 Música de fondo prendida (guarania de arpa, suave).':'🔕 Música de fondo apagada.'); }
function renderMusicBtn(){ $$('.btnMusic').forEach(b=>{ b.textContent = MUSIC.on ? '🎶' : '🔕'; b.title = MUSIC.on ? 'Apagar la música de fondo' : 'Prender la música de fondo'; }); }
renderMusicBtn(); $('#musicCredit').textContent='🎶 '+MUSIC_CREDIT;

/* ====================== RENDER ====================== */
const LAST={ev:null, turnKey:null, endKey:null};
const TAPAR={on:!!load('imp_tapar'), peek:false};
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
    + `${host&&NET.mode!=='local'?'👑':''}${p.bot?'🤖':''}${p.mic?'🎙️':''}${!p.bot&&!p.conn?'⚠️':''}`;
}
const optT = (list, v) => (list.find(x=>x.v==v)||{}).t||'';

// ---------- sala de espera ----------
function renderLobby(){
  const host=amHost(), myObs=!!NET.obs, n=V.players.length;
  $('#lobbyCode').textContent=NET.code||'—';
  $('#lobbyCodeBox').style.display = NET.mode==='local' ? 'none' : '';
  $('#pcount').textContent=`(${n}/${MAXP})`;
  $('#plist').innerHTML=V.players.map(p=>`<li>${playerTag(p)}
      ${host && p.id!==V.hostPid?`<button class="btn sm gray" onclick="doAct({type:'kick',pid:'${p.id}'})" title="Sacar">✕</button>`:''}</li>`).join('')
    + (V.observers||[]).map(o=>`<li style="opacity:.75"><span style="font-size:20px">👀</span><span class="nm">${esc(o.name)} <span class="muted">mirando</span></span>${o.mic?'🎙️':''}</li>`).join('');
  const k = V.opts.nImp==='auto' ? Math.min(maxImp(Math.max(n,3)), n<=6?1:n<=11?2:3) : +V.opts.nImp;
  let warn='';
  if(n<MINP) warn=`Hacen falta al menos ${MINP} jugadores. Sumá bots 🤖 o esperá a tus amigos.`;
  else if(V.opts.nImp!=='auto' && k>maxImp(n)) warn=`⚠️ Con ${n} jugadores puede haber como mucho ${maxImp(n)} impostor${maxImp(n)>1?'es':''}.`;
  $('#teamPrev').innerHTML = n>=MINP && !warn ? `<div class="teamprev">🎭 Con ${n} jugadores: <b>${k} impostor${k>1?'es':''}</b> y <b>${n-k} inocentes</b>.</div>` : (warn?`<p class="muted" style="color:#a3320b;font-weight:700">${warn}</p>`:'');
  const canStart = n>=MINP && !(V.opts.nImp!=='auto' && k>maxImp(n));
  $('#lobbyHostBtns').innerHTML = host
    ? `<div class="row"><button class="btn gray" onclick="doAct({type:'addBot'})" ${n>=MAXP?'disabled':''}>🤖 Sumar bot</button>
       <button class="btn green" onclick="doAct({type:'start'})" ${canStart?'':'disabled'}>▶️ Empezar</button></div>
       <p class="muted">De ${MINP} a ${MAXP} jugadores. Si alguien se corta, un bot juega por él hasta que vuelva.</p>`
    : `<p class="muted" style="text-align:center">⏳ Esperando que el anfitrión 👑 empiece la partida…</p>`;
  $('#lobbyObs').innerHTML = myObs ? `<div class="obsbar" style="border-radius:10px;margin-top:8px">👀 Estás mirando. ${n<MAXP?`<button class="btn sm gold" onclick="doAct({type:'joinNext'})">🪑 Sumarme a jugar</button>`:'La ronda está llena.'}</div>` : '';
  $('#optsBox').innerHTML = optsHTML(host);
  const g=$('#grulesBox');
  if(host){
    if(!g.querySelector('textarea')) g.innerHTML=`<textarea id="grulesIn" maxlength="1200" placeholder="Ej.: el que echan ceba el tereré 🧉&#10;Las pistas se dicen en guaraní…"></textarea><p class="muted" style="margin:4px 0 0">Se guarda solo y lo ven todos.</p>`;
    const ta=$('#grulesIn'); if(document.activeElement!==ta) ta.value=V.grules||'';
    ta.oninput=()=>{ clearTimeout(ta.t); ta.t=setTimeout(()=>doAct({type:'grules', text:ta.value}), 600); };
  } else g.innerHTML = V.grules ? `<div class="grules">${esc(V.grules)}</div>` : `<p class="muted">El anfitrión todavía no escribió reglas propias.</p>`;
  $('#sugBox').innerHTML = sugsHTML(host);
}
function optsHTML(host){
  const o=V.opts, dis = host && V.phase==='lobby' ? '' : 'disabled';
  const sel=(k, list)=>`<select ${dis} onchange="doAct({type:'opt',k:'${k}',v:this.value})">${list.map(t=>`<option value="${t.v}" ${o[k]==t.v?'selected':''}>${t.t}</option>`).join('')}</select>`;
  const chk=(k, t, d)=>`<label class="opt" style="margin:0 0 6px;font-weight:400"><input type="checkbox" ${o[k]?'checked':''} ${dis} onchange="doAct({type:'opt',k:'${k}',v:this.checked})"><span><b>${t}</b><small>${d}</small></span></label>`;
  return `<label style="margin-top:0">Variantes rápidas ${host?'':'<span class="muted">(las elige el anfitrión)</span>'}</label>
    <div class="variants">${VARIANTS.map(v=>`<button class="var" ${dis} onclick="doAct({type:'opt',k:'variant',v:'${v.k}'})" title="${esc(v.d)}"><b>${v.t}</b><small>${esc(v.d)}</small></button>`).join('')}</div>
    <label>🎭 Cantidad de impostores</label>${sel('nImp', IMPS)}
    <label>🤫 Qué recibe el impostor</label>${sel('hint', HINTS)}
    <label>📚 Categorías de palabras</label>
    <div class="cats">${Object.keys(CATS).map(c=>`<label class="catchk ${o.cats.includes(c)?'on':''}"><input type="checkbox" ${o.cats.includes(c)?'checked':''} ${dis} onchange="doAct({type:'opt',k:'cat',c:'${c}',v:this.checked})">${CATS[c].e} ${CATS[c].n}</label>`).join('')}</div>
    <div class="row2"><div><label>⏱️ Tiempo por pista</label>${sel('clueTime', CLUE_T)}</div><div><label>🗣️ Tiempo de discusión</label>${sel('discTime', DISC_T)}</div></div>
    <div class="row2"><div><label>🧉 Pistas antes de votar</label>${sel('laps', LAPS)}</div><div><label>🏁 Partida</label>${sel('rounds', ROUNDS)}</div></div>
    <label>🎯 ¿El impostor puede adivinar la palabra?</label>${sel('guess', GUESS)}
    <label>🚪 Si echan a un inocente…</label>${sel('elim', ELIM)}
    <label>🗳️ Votación</label>${sel('vote', VOTEV)}
    <label>🏆 Puntajes</label>${sel('pts', PTS)}
    <div style="height:8px"></div>
    ${chk('know','🤝 Los impostores se conocen entre sí','Si hay 2 o más, cada impostor ve quiénes son sus compañeros.')}
    ${chk('cazador','🏹 Premio al cazador','+1 punto extra a cada inocente que votó a un impostor que fue echado.')}`;
}
function sugsHTML(host){
  const list=(V.sugs||[]).slice().sort((a,b)=>b.votes.length-a.votes.length);
  if(!list.length) return '<p class="muted">Todavía no hay sugerencias. ¡Proponé la primera!</p>';
  return list.map(s=>`<div class="sug"><span class="t">${esc(s.text)}<small>${esc(s.e)} ${esc(s.by)}</small></span>
    <button class="vote ${s.votes.includes(me())?'on':''}" onclick="doAct({type:'sugVote',id:'${s.id}'})">👍 ${s.votes.length}</button>
    ${host?`<button class="vote" onclick="doAct({type:'sugDel',id:'${s.id}'})" title="Borrar">🗑️</button>`:''}</div>`).join('');
}
function sendSug(id){ const i=$('#'+id); const t=i.value.trim(); if(!t) return toast('Escribí la regla que querés sugerir.'); doAct({type:'suggest', text:t}); i.value=''; toast('💡 ¡Sugerencia enviada! Los demás la pueden votar.'); }

// ---------- partida ----------
const meP = () => V && V.players.find(p=>p.id===me());
const VPl = id => V && V.players.find(p=>p.id===id);
const curV = () => V && V.phase==='clues' ? VPl(V.order[V.ci]) : null;
const isMyTurn = () => { const c=curV(); return !!c && c.id===me(); };
function renderGame(){
  $('#roomTag').textContent = NET.mode==='local' ? '🤖 Práctica' : '🔑 '+NET.code;
  $('#roundTag').textContent = `🎴 Ronda ${V.round}${V.opts.rounds?' / '+V.opts.rounds:''}`;
  $('#obsbar').style.display = NET.obs ? 'block' : 'none';
  if(NET.obs) $('#obsbar').innerHTML = (V.mine && V.mine.owner) ? '👑 Mirando como dueño: ves la palabra y quién es el impostor (los demás no).' : '👀 Estás mirando la partida: no ves la palabra ni quién es el impostor.';
  renderTarjeta(); renderFase(); renderRonda(); renderActbar();
  processEvents();
  turnNotice();
  roundModal();
  tickTimer();
}
function renderTarjeta(){
  const el=$('#tarjeta'), m=V.mine, p=meP(), open=V.phase==='roundEnd'||V.phase==='over';
  let h='';
  if(open && V.res){
    const r=V.res, imps=r.imps.map(id=>VPl(id)).filter(Boolean);
    h=`<div class="tj reveal"><div class="tjk">La palabra era</div><div class="tjw">${esc(r.word)}</div><div class="tjc">${esc(catName(r.cat))}</div>
      <div class="tjs">🎭 ${imps.length>1?'Impostores':'Impostor'}: <b>${imps.map(x=>esc(x.emoji+' '+x.name)).join(', ')}</b>${V.opts.hint==='encubierto'?` · su palabra era “${esc(r.sim)}”`:''}</div></div>`;
  } else if(m && m.owner){
    h=`<div class="tj own"><div class="tjk">👑 Lo que solo ve el dueño</div><div class="tjw">${esc(m.word)}</div><div class="tjc">${esc(catName(m.cat))}</div><div class="tjs">🎭 ${m.imps.map(id=>esc((VPl(id)||{}).name||'?')).join(', ')}</div></div>`;
  } else if(!m){
    h=`<div class="tj obs"><div class="tjk">👀 Mirando</div><div class="tjs">No ves la palabra secreta. Escuchá las pistas y adiviná quién miente.</div></div>`;
  } else {
    const hid = TAPAR.on && !TAPAR.peek;
    const out = p && p.out ? `<div class="tjout">🚪 Quedaste afuera de esta ronda: mirá y no ayudes a nadie 🤐</div>` : '';
    if(m.role==='civ'){
      h=`<div class="tj civ ${hid?'tapada':''}"><div class="tjk">${V.opts.hint==='encubierto'?'Tu palabra secreta':'😇 Sos inocente · la palabra secreta es'}</div><div class="tjw">${esc(m.word)}</div>
        <div class="tjc">${esc(catName(m.cat))}</div>
        <div class="tjs">${V.opts.hint==='encubierto'?'Ojo: alguien tiene una palabra parecida… ¿o sos vos? 🤔':'Da pistas que entiendan los inocentes pero que no le regalen la palabra al impostor.'}</div>${out}</div>`;
    } else {
      const mates=(m.mates||[]).map(id=>VPl(id)).filter(Boolean);
      h=`<div class="tj imp ${hid?'tapada':''}"><div class="tjk">🎭 Sos el IMPOSTOR</div><div class="tjw">???</div>
        ${m.cat?`<div class="tjc">Categoría: ${esc(catName(m.cat))}</div>`:''}${m.sim?`<div class="tjc">Se parece a: “${esc(m.sim)}”</div>`:''}
        <div class="tjs">${!m.cat&&!m.sim?'No sabés ni la categoría. ':''}Escuchá las pistas de los demás y disimulá.${V.opts.guess!=='no'?' Si adivinás la palabra, ganás.':''}</div>
        ${mates.length?`<div class="tjs">🤝 ${mates.length>1?'Tus compañeros':'Tu compañero'}: <b>${mates.map(x=>esc(x.emoji+' '+x.name)).join(', ')}</b></div>`:''}${out}</div>`;
    }
    h+=`<button class="tjbtn" onpointerdown="peek(true)" onpointerup="peek(false)" onpointerleave="peek(false)" onclick="if(!TAPAR.on)toggleTapar()">${TAPAR.on?'👁️ Mantené apretado para ver':'🙈 Tapar mi tarjeta'}</button>${TAPAR.on?`<button class="tjbtn" onclick="toggleTapar()">Destapar siempre</button>`:''}`;
  }
  el.innerHTML=h;
}
function peek(on){ if(!TAPAR.on) return; TAPAR.peek=on; renderTarjeta(); }
function toggleTapar(){ TAPAR.on=!TAPAR.on; TAPAR.peek=false; store('imp_tapar', TAPAR.on); renderTarjeta(); toast(TAPAR.on?'🙈 Tarjeta tapada: mantené apretado el botón para verla.':'👁️ Tarjeta destapada.'); }
const PH_T = {reveal:'🎴 Mirá tu tarjeta', clues:'🧉 Ronda de pistas', discuss:'🗣️ Discusión', vote:'🗳️ Votación', result:'🚪 Resultado', guess:'🎯 Última oportunidad', roundEnd:'🏁 Fin de la ronda', over:'🏆 Fin de la partida'};
function renderFase(){
  const el=$('#fase'), al=V.players.filter(p=>!p.out), p=meP();
  let sub='';
  if(V.phase==='reveal') sub=`Leé tu tarjeta sin que nadie te vea. Listos: <b>${(V.ready||[]).length}/${V.players.length}</b>`;
  else if(V.phase==='clues'){ const c=curV(); sub = c ? (c.id===me() ? `🟢 <b>¡Te toca!</b> Decí una pista relacionada con tu palabra.` : `Le toca el tereré a <b>${esc(c.emoji)} ${esc(c.name)}</b>${c.bot?' 🤖':''}: escuchá su pista.`) + ` <span class="muted">(vuelta ${V.cround} de ${V.opts.laps})</span>` : ''; }
  else if(V.phase==='discuss') sub=`¿Quién dijo una pista rara? Hablen por voz o por chat. Listos para votar: <b>${(V.ready||[]).filter(id=>al.some(x=>x.id===id)).length}/${al.length}</b>`;
  else if(V.phase==='vote') sub=`Tocá a quién querés echar. Votaron: <b>${Object.keys(V.votes||{}).length}/${al.length}</b>`;
  else if(V.phase==='result'){ const r=V.vres||{}, o=VPl(r.out); sub = o ? `Echaron a <b>${esc(o.emoji)} ${esc(o.name)}</b>: ${r.imp?'<b class="red">¡ERA IMPOSTOR! 🎭</b>':'era inocente 😇'}` : r.tie ? '⚖️ Empate: no se echa a nadie.' : '🤷 No se echa a nadie.'; }
  else if(V.phase==='guess'){ const g=VPl(V.guesser); sub = g ? (g.id===me() ? '🎯 <b>¡Te descubrieron!</b> Si adivinás la palabra, ganás igual.' : `🎯 <b>${esc(g.name)}</b> intenta adivinar la palabra…`) : ''; }
  else if(V.phase==='roundEnd' || V.phase==='over'){ const r=V.res||{}; sub = r.win==='civ' ? '🎉 ¡Ganaron los inocentes!' : '🎭 ¡Ganó el bando impostor!'; }
  el.innerHTML=`<div class="fh"><b>${PH_T[V.phase]||''}</b><span class="timer" id="timer"></span></div><div class="fs">${sub}</div><div class="tbar"><i id="tbar"></i></div>`;
}
function tileHTML(p){
  const cur=curV(), vote=V.phase==='vote', mineP=meP();
  const canVote = vote && mineP && !mineP.out && !p.out && p.id!==me();
  const myVote = V.votes && V.votes[me()];
  const showCounts = (vote && V.opts.vote==='publico') || V.phase==='result';
  const votesMap = V.phase==='result' && V.vres ? V.vres.votes : V.votes||{};
  const cnt = showCounts ? Object.values(votesMap).filter(v=>v===p.id).length : 0;
  const voters = showCounts ? Object.keys(votesMap).filter(k=>votesMap[k]===p.id).map(id=>VPl(id)).filter(Boolean) : [];
  const clues=(V.clues||[]).filter(c=>c.pid===p.id);
  const mates = V.mine && V.mine.role==='imp' ? (V.mine.mates||[]) : [];
  const offline=!p.bot && !p.conn;
  const b=BUB[p.id], bub = b && Date.now()-b.at<4500 ? `<div class="bub">${esc(b.x.slice(0,80))}</div>` : '';
  let st='';
  if(p.out) st=`<span class="st out">${p.rev==='imp'?'🎭 era impostor':'😇 era inocente'}</span>`;
  else if(V.phase==='reveal' && (V.ready||[]).includes(p.id)) st='<span class="st ok">✓ listo</span>';
  else if(V.phase==='discuss' && (V.ready||[]).includes(p.id)) st='<span class="st ok">✋ listo</span>';
  else if(vote && V.votes && V.votes[p.id]) st='<span class="st ok">🗳️ votó</span>';
  if((V.phase==='roundEnd'||V.phase==='over') && p.rev) st=`<span class="st ${p.rev==='imp'?'out':'ok'}">${p.rev==='imp'?'🎭 impostor':'😇 inocente'}</span>`;
  const gain = (V.phase==='roundEnd'||V.phase==='over') && V.res && V.res.gains[p.id] ? `<span class="gain">+${V.res.gains[p.id]}</span>` : '';
  return `<div class="tile ${cur&&cur.id===p.id?'turn':''} ${p.out?'isout':''} ${canVote?'canvote':''} ${myVote===p.id?'myvote':''} ${p.id===me()?'me':''} ${offline?'off':''}" data-pid="${p.id}" style="--pc:${p.color}" ${canVote?`onclick="voteFor('${p.id}')"`:''}>
    ${cur&&cur.id===p.id?'<span class="guampa">🧉</span>':''}${mates.includes(p.id)?'<span class="matek">🎭 compañero</span>':''}${gain}
    <div class="tav">${headHTML(p)||`<span class="emo">${esc(p.emoji)}</span>`}</div>
    <div class="tnm"><b>${esc(p.name)}${p.id===me()?' (vos)':''}</b><small>${p.score} pts${p.id===V.hostPid&&NET.mode!=='local'?' · 👑':''}${p.bot?' · 🤖':''}${p.mic?' · 🎙️':''}${offline?' · ⚠️':''}</small></div>
    <div class="clues">${clues.map(c=>`<span class="clue ${c.how}">${c.how==='skip'?'⌛':c.how==='voz'?'🎙️ en voz':esc(c.x)}</span>`).join('')||(V.phase==='clues'||V.phase==='reveal'?'<span class="clue none">…</span>':'')}</div>
    ${st}${showCounts&&cnt?`<span class="vcnt" title="${esc(voters.map(x=>x.name).join(', '))}">${cnt} 🗳️</span>`:''}${showCounts&&voters.length?`<div class="voters">${voters.map(x=>esc(x.emoji)).join('')}</div>`:''}${bub}
  </div>`;
}
function renderRonda(){
  if(!V || V.phase==='lobby') return;
  const el=$('#ronda');
  el.classList.toggle('many', V.players.length>8);
  el.innerHTML=V.players.map(tileHTML).join('');
  headsAfterRender();
}
function voteFor(pid){ const t=VPl(pid); doAct({type:'vote', pid}); if(t) toast(`🗳️ Votaste a ${t.name}. Podés cambiar hasta que voten todos.`); sfx.card(); }
function renderActbar(){
  const A=$('#actbar'), p=meP(), host=amHost();
  let h='';
  const canRisk = p && !p.out && V.mine && V.mine.role==='imp' && V.opts.guess==='siempre' && V.opts.hint!=='encubierto' && ['clues','discuss'].includes(V.phase);
  if(V.phase==='reveal'){
    if(p) h+= (V.ready||[]).includes(p.id) ? `<span class="muted wh">✓ Listo. Esperando a los demás…</span>` : `<button class="btn green big" onclick="doAct({type:'ready'})">✅ Ya vi mi tarjeta</button>`;
    if(host) h+=`<button class="btn sm dark" onclick="doAct({type:'skip'})">⏩ Empezar ya</button>`;
  } else if(V.phase==='clues'){
    if(isMyTurn()){
      h+=`<div class="cluein"><input type="text" id="clueText" maxlength="40" placeholder="Tu pista (una palabra o algo corto)" autocomplete="off" onkeydown="if(event.key==='Enter')sendClue()">
        <button class="btn green" onclick="sendClue()">🧉 Decir</button></div>
        <button class="btn sm dark" onclick="doAct({type:'clue',voz:true})" title="Si la dijiste por el micrófono">🎙️ Ya la dije en voz</button>`;
    }
    if(canRisk) h+=`<button class="btn sm red" onclick="riskModal()">🎯 Arriesgar la palabra</button>`;
    if(host && !isMyTurn()) h+=`<button class="btn sm dark" onclick="if(confirm('¿Saltar el turno de este jugador?'))doAct({type:'skip'})">⏭️ Saltar turno</button>`;
  } else if(V.phase==='discuss'){
    if(p && !p.out){ const r=(V.ready||[]).includes(p.id); h+=`<button class="btn ${r?'gray':'gold'}" onclick="doAct({type:'ready'})">${r?'↩️ Quiero seguir hablando':'✋ Listo para votar'}</button>`; }
    h+=`<select class="quick" onchange="quickSay(this.value);this.value=''"><option value="">💬 Frase rápida…</option><option>Para mí es el que dijo la pista más rara 🤔</option><option>¡Yo no soy! 😇</option><option>Expliquen sus pistas 🧐</option><option>Votemos ya 🗳️</option><option>Hay alguien que está chamuyando 👀</option></select>`;
    if(canRisk) h+=`<button class="btn sm red" onclick="riskModal()">🎯 Arriesgar la palabra</button>`;
    if(host) h+=`<button class="btn sm dark" onclick="doAct({type:'skip'})">⏩ Votar ya</button>`;
  } else if(V.phase==='vote'){
    if(p && !p.out){
      const mv=V.votes&&V.votes[me()];
      h+=`<span class="muted wh">${mv && mv!=='skip' ? '🗳️ Votaste a '+esc((VPl(mv)||{}).name||'')+'.' : mv==='skip' ? '🤷 Elegiste no echar a nadie.' : '👆 Tocá a un jugador para votarlo.'}</span>
        <button class="btn sm ${mv==='skip'?'gold':'gray'}" onclick="doAct({type:'vote',pid:'skip'})">🤷 No echar a nadie</button>`;
    } else h+=`<span class="muted wh">${p?'Estás afuera: mirá cómo votan.':'👀 Mirando la votación.'}</span>`;
    if(host) h+=`<button class="btn sm dark" onclick="doAct({type:'skip'})">⏩ Cerrar votación</button>`;
  } else if(V.phase==='guess'){
    if(V.guesser===me()) h+=`<div class="cluein"><input type="text" id="guessText" maxlength="40" placeholder="¿Cuál es la palabra?" autocomplete="off" onkeydown="if(event.key==='Enter')sendGuess()"><button class="btn red" onclick="sendGuess()">🎯 Adivinar</button></div>`;
    else h+=`<span class="muted wh">⏳ Esperando que adivine…</span>`;
  } else if(V.phase==='roundEnd' || V.phase==='over'){
    h+=`<button class="btn gold" onclick="LAST.endKey=null;roundModal(true)">🏆 Ver puntajes</button>`;
    if(host) h+= V.phase==='over' ? `<button class="btn green" onclick="doAct({type:'newGame'})">🔁 Otra partida</button>` : `<button class="btn green" onclick="doAct({type:'nextRound'})">▶️ Siguiente ronda</button>`;
    if(NET.obs && V.players.length<MAXP) h+=`<button class="btn gold" onclick="doAct({type:'joinNext'})">🪑 Sumarme a jugar</button>`;
  }
  // no borrar lo que la persona está escribiendo
  const ci=$('#clueText'), gi=$('#guessText'), keep = ci ? ci.value : gi ? gi.value : null, focus=document.activeElement && (document.activeElement===ci || document.activeElement===gi);
  const key=V.phase+'|'+h;
  if(A.dataset.key===key) return;
  A.dataset.key=key; A.innerHTML=h;
  const ni=$('#clueText')||$('#guessText');
  if(ni && keep!=null){ ni.value=keep; if(focus) ni.focus(); }
  else if(ni && window.innerWidth>700) setTimeout(()=>ni.focus(), 50);
}
function sendClue(){ const i=$('#clueText'); const t=i.value.trim(); if(!t) return toast('Escribí tu pista primero ✍️'); doAct({type:'clue', text:t}); i.value=''; }
function sendGuess(){ const i=$('#guessText'); const t=i.value.trim(); if(!t) return toast('Escribí la palabra.'); doAct({type:'guess', text:t}); i.value=''; }
function riskModal(){
  modal(`<h2>🎯 Arriesgar la palabra</h2><p>Si acertás, <b>ganás la ronda</b>. Si errás, <b>quedás descubierto y afuera</b>.</p>
    <input type="text" id="riskText" maxlength="40" placeholder="¿Cuál es la palabra?" autocomplete="off" onkeydown="if(event.key==='Enter')riskGo()">
    <div class="row" style="margin-top:10px"><button class="btn red" onclick="riskGo()">🎯 Arriesgar</button><button class="btn gray" onclick="closeModal()">Mejor no</button></div>`);
  setTimeout(()=>$('#riskText') && $('#riskText').focus(), 50);
}
function riskGo(){ const t=($('#riskText').value||'').trim(); if(!t) return toast('Escribí la palabra.'); closeModal(); doAct({type:'guess', text:t}); }
// el reloj de cada fase
function tickTimer(){
  const el=$('#timer'), bar=$('#tbar'); if(!el || !V) return;
  const at=V.dlAt||0;
  if(!at || ['roundEnd','over','lobby'].includes(V.phase)){ el.textContent=''; if(bar) bar.style.width='0'; return; }
  const left=Math.max(0, at-Date.now()), s=Math.ceil(left/1000);
  el.textContent = '⏱️ '+(s>=60 ? Math.floor(s/60)+':'+String(s%60).padStart(2,'0') : s+'s');
  el.classList.toggle('hurry', s<=5);
  const total = V.phase==='clues' ? V.opts.clueTime : V.phase==='discuss' ? V.opts.discTime : V.phase==='vote' ? VOTE_SECS : V.phase==='guess' ? GUESS_SECS : V.phase==='reveal' ? REVEAL_SECS : RESULT_SECS;
  if(bar) bar.style.width = total ? Math.min(100, left/(total*10))+'%' : '0';
  if(s<=5 && s>0 && s!==LAST.tickS && (isMyTurn() || (V.phase==='guess' && V.guesser===me()) || (V.phase==='vote' && meP() && !meP().out && !(V.votes||{})[me()]))) sfx.tick();
  LAST.tickS=s;
}
setInterval(tickTimer, 250);
function turnNotice(){
  if(V.phase!=='clues') return;
  const key=V.round+':'+V.lap+':'+V.ci;
  if(key===LAST.turnKey) return; LAST.turnKey=key;
  if(isMyTurn() && LAST.ev!=null){
    sfx.turn(); if(navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) try{ navigator.vibrate(120); }catch(e){}
    bigText('🧉 ¡Te toca!', 'Decí tu pista', 'turnpop');
  }
}
function bigText(t, sub, cls){ const d=document.createElement('div'); d.className='bigtx '+(cls||''); d.innerHTML=esc(t)+(sub?`<small>${esc(sub)}</small>`:''); document.body.appendChild(d); setTimeout(()=>d.remove(),1900); }
function processEvents(){
  const evs=V.ev||[], maxI=evs.length?evs[evs.length-1].i:0;
  if(LAST.ev==null || maxI<LAST.ev){ LAST.ev=maxI; return; }
  const news=evs.filter(e=>e.i>LAST.ev); LAST.ev=maxI;
  if(news.length>6) return;
  for(const e of news){
    if(e.k==='round'){ sfx.card(); setTimeout(()=>sfx.card(),150); TAPAR.peek=false; bigText('🎴 Ronda '+V.round, 'Mirá tu tarjeta sin que nadie la vea'); }
    else if(e.k==='clue'){ sfx.clue(); const t=document.querySelector(`.tile[data-pid="${e.pid}"]`); if(t){ t.classList.add('pop'); setTimeout(()=>t.classList.remove('pop'),600); } }
    else if(e.k==='discuss'){ sfx.vote(); say('¡A discutir!'); }
    else if(e.k==='vote'){ sfx.drum(); bigText('🗳️ ¡A votar!', '¿A quién echamos?'); }
    else if(e.k==='result'){
      const r=V.vres||{}, o=VPl(r.out);
      if(o){ setTimeout(()=>{ if(r.imp){ sfx.imp(); bigText('🎭 ¡ERA IMPOSTOR!', o.name, 'imp'); } else { sfx.inoc(); bigText('😇 Era inocente', o.name, 'inoc'); } }, 300); }
      else sfx.inoc();
    }
    else if(e.k==='guess'){ sfx.drum(); }
    else if(e.k==='guessed'){ if(e.ok){ sfx.imp(); bigText('😱 ¡ADIVINÓ!', (VPl(e.pid)||{}).name||'', 'imp'); } else { sfx.inoc(); } }
    else if(e.k==='end'){
      const mine=V.res && V.mine, imWin = V.res && meP() && (V.res.win==='imp' ? V.res.imps.includes(me()) : !V.res.imps.includes(me()));
      setTimeout(()=>{ if(!meP() || imWin) sfx.win(); else sfx.lose(); }, 400);
    }
  }
}

// ---------- ventanas ----------
function modal(h){ $('#mbox').innerHTML=h; $('#modal').classList.add('on'); }
function closeModal(){ $('#modal').classList.remove('on'); }
$('#modal').addEventListener('click', e=>{ if(e.target.id==='modal') closeModal(); });
function roundModal(force){
  if(V.phase!=='roundEnd' && V.phase!=='over') return;
  const key=V.round+':'+V.phase;
  if(!force && LAST.endKey===key) return;
  LAST.endKey=key;
  if(!V.res) return;
  setTimeout(()=>{ if(V.phase!=='roundEnd' && V.phase!=='over') return; modal(roundHTML()); }, force?0:1600);
}
function roundHTML(){
  const R=V.res, host=amHost(), over=V.phase==='over';
  const imps=R.imps.map(id=>VPl(id)).filter(Boolean);
  const how = R.win==='civ' ? `Echaron ${imps.length>1?'a todos los impostores':'al impostor'}.` : R.how==='adivina' ? `${esc((VPl(R.who)||{}).name||'')} adivinó la palabra.` : R.how==='mayoria' ? 'Los impostores quedaron tantos como los inocentes.' : `${imps.length>1?'Los impostores se salvaron':'El impostor se salvó'}.`;
  const rows=V.players.slice().sort((a,b)=>b.score-a.score).map((p,i)=>`<tr class="${over&&(V.winner||[]).includes(p.id)?'won':''}"><td>${i+1}. ${esc(p.emoji)} ${esc(p.name)}${p.id===me()?' <small>(vos)</small>':''}</td><td>${R.imps.includes(p.id)?'🎭':'😇'}</td><td>${R.gains[p.id]?'+'+R.gains[p.id]:'—'}</td><td><b>${p.score}</b></td></tr>`).join('');
  const w=(V.winner||[]).map(id=>VPl(id)).filter(Boolean);
  return `<h2>${over?'🏆 ¡Terminó la partida!':R.win==='civ'?'🎉 ¡Ganaron los inocentes!':'🎭 ¡Ganó el impostor!'}</h2>
    ${over?`<p style="font-size:17px">${w.length>1?'Empatan':'Gana'} <b>${w.map(x=>esc(x.emoji+' '+x.name)).join(' y ')}</b> con <b>${w[0]?w[0].score:0}</b> puntos 🥇</p>`:''}
    <p>${over?(R.win==='civ'?'Última ronda: ganaron los inocentes. ':'Última ronda: ganó el impostor. '):''}${how}</p>
    <div class="secretbox">La palabra era <b>“${esc(R.word)}”</b> <span class="muted">(${esc(catName(R.cat))})</span><br>🎭 ${imps.length>1?'Impostores':'Impostor'}: <b>${imps.map(x=>esc(x.emoji+' '+x.name)).join(', ')}</b>${V.opts.hint==='encubierto'?`<br>🕶️ Su palabra parecida era “${esc(R.sim)}”`:''}</div>
    <div class="scorewrap"><table class="score"><tr><th>Jugador</th><th></th><th>Ronda</th><th>Total</th></tr>${rows}</table></div>
    <p class="muted">${optT(PTS, V.opts.pts)}${V.opts.cazador?' · 🏹 +1 al inocente que votó a un impostor echado':''}.${V.opts.rounds?` Se juegan ${V.opts.rounds} rondas.`:''}</p>
    ${host ? (over?`<button class="btn green wide" onclick="closeModal();doAct({type:'newGame'})">🔁 Otra partida</button>`
      :`<button class="btn green wide" onclick="closeModal();doAct({type:'nextRound'})">▶️ Siguiente ronda</button>${!V.opts.rounds?`<button class="btn dark wide" style="margin-top:6px" onclick="closeModal();doAct({type:'endGame'})">🏁 Terminar la partida acá</button>`:''}`)
      : `<p class="muted" style="text-align:center">⏳ Esperando que el anfitrión ${over?'arme otra partida':'empiece la siguiente ronda'}…</p>`}
    ${NET.obs && V.players.length<MAXP ? `<button class="btn gold wide" style="margin-top:6px" onclick="doAct({type:'joinNext'});closeModal()">🪑 Sumarme a jugar</button>`:''}
    <button class="btn gray wide" style="margin-top:6px" onclick="closeModal()">Cerrar</button>`;
}

// ---------- panel: historial, jugadores y reglas ----------
function renderSidePanels(){
  if($('#tab-hist').classList.contains('on')) renderHist();
  renderMesaTab(); renderReglasTab();
}
let HIST_N=0;
function renderHist(){
  if(!V) return;
  const L=(V.log||[]).slice().reverse();
  const fresh=L.length-HIST_N; HIST_N=L.length;
  $('#histList').innerHTML = L.length ? L.map((l,i)=>`<div class="hline ${/ERA EL IMPOSTOR|Ganan|Gana|ACERTÓ/.test(l.x)?'esc':''} ${i<fresh&&fresh<5?'new':''}"><span class="t">${esc(l.x)}</span></div>`).join('') : '<p class="muted">Todavía no pasó nada.</p>';
}
function renderMesaTab(){
  const host=amHost(), inPlay=V.phase!=='lobby';
  const ps=V.players.slice().sort((a,b)=>inPlay?b.score-a.score:0).map(p=>{
    const offline=!p.bot&&!p.conn;
    return `<div class="prow" style="border-left:5px solid ${p.color}"><span style="font-size:22px">${esc(p.emoji)}</span><span class="nm"><b>${esc(p.name)}${p.id===me()?' (vos)':''}${p.id===V.hostPid&&NET.mode!=='local'?' 👑':''}</b>
      <small>${p.out?'🚪 afuera en esta ronda':''}${p.bot?' · 🤖 bot':''}${p.mic?' · 🎙️':''}${offline?' · ⚠️ sin conexión':''}</small></span>${inPlay?`<span class="pts">${p.score}</span>`:''}
      ${host&&p.id!==V.hostPid&&NET.mode!=='local'?`${offline&&inPlay?`<button class="btn sm gray" onclick="doAct({type:'botify',pid:'${p.id}'})" title="Que juegue un bot">🤖</button>`:''}<button class="btn sm gray" onclick="if(confirm('¿Sacar a ${esc(p.name)}?'))doAct({type:'kick',pid:'${p.id}'})" title="Sacar">✕</button>`:''}</div>`;
  }).join('');
  const obs=(V.observers||[]).map(o=>`<div class="prow"><span style="font-size:20px">${esc(o.emoji)}</span><span class="nm"><b>${esc(o.name)}${o.id===me()?' (vos)':''}</b><small>mirando${o.mic?' · 🎙️':''}</small></span></div>`).join('');
  const sit = NET.obs && ['roundEnd','over','lobby'].includes(V.phase) && V.players.length<MAXP ? `<button class="btn gold wide" onclick="doAct({type:'joinNext'})">🪑 Sumarme a jugar</button>`
    : NET.obs ? `<p class="muted">Cuando termine la ronda te podés sumar a jugar.</p>` : '';
  const info = inPlay ? `<p class="muted">Ronda ${V.round}${V.opts.rounds?' de '+V.opts.rounds:''} · ${V.players.length} jugadores</p>` : '';
  const addb = host && ['roundEnd','over'].includes(V.phase) && V.players.length<MAXP ? `<button class="btn sm gray" onclick="doAct({type:'addBot'})">🤖 Sumar un bot para la próxima ronda</button>` : '';
  $('#mesaList').innerHTML = info + `<b>Jugadores y puntos</b>` + ps + addb + (obs?`<br><b>Mirando</b>${obs}`:'') + sit
    + (NET.mode!=='local'&&NET.code?`<p class="muted" style="margin-top:12px">Invitá con el código <b>${NET.code}</b> <button class="btn sm" onclick="shareRoom()">📤 Compartir</button></p>`:'');
}
function renderReglasTab(){
  const o=V.opts, host=amHost();
  $('#reglasList').innerHTML = `<div class="rsum">
      <div>🎭 ${esc(optT(IMPS,o.nImp))}</div><div>🤫 ${esc(optT(HINTS,o.hint))}</div>
      <div>📚 ${o.cats.map(c=>CATS[c].e+' '+CATS[c].n).join(', ')}</div>
      <div>⏱️ Pista: ${esc(optT(CLUE_T,o.clueTime))} · 🗣️ Discusión: ${esc(optT(DISC_T,o.discTime))}</div>
      <div>🧉 ${esc(optT(LAPS,o.laps))} · 🏁 ${esc(optT(ROUNDS,o.rounds))}</div>
      <div>🎯 Adivinar: ${esc(optT(GUESS,o.guess))}</div><div>🚪 ${esc(optT(ELIM,o.elim))}</div><div>🗳️ ${esc(optT(VOTEV,o.vote))}</div>
      <div>🏆 ${esc(optT(PTS,o.pts))}</div>${o.know?'<div>🤝 Los impostores se conocen</div>':''}${o.cazador?'<div>🏹 Premio al cazador</div>':''}</div>
    <b>📝 Reglas propias del grupo</b>` + (V.grules?`<div class="grules" style="margin:6px 0 10px">${esc(V.grules)}</div>`:`<p class="muted">${host?'Las podés escribir en la sala de espera.':'No hay.'}</p>`)
    + `<b>💡 Sugerencias</b><div style="margin-top:6px">${sugsHTML(host)}</div>
       <div class="row"><input type="text" id="sugIn2" maxlength="240" placeholder="Proponé una regla…" onkeydown="if(event.key==='Enter')sendSug('sugIn2')"><button class="btn sm" style="flex:0 0 auto" onclick="sendSug('sugIn2')">Sugerir</button></div>
       <button class="btn dark wide" style="margin-top:12px" onclick="showRules()">📜 Reglas completas y variantes</button>`;
}

// ---------- compartir ----------
function roomLink(){ return location.origin+location.pathname+'#'+NET.code; }
function copyCode(){ navigator.clipboard && navigator.clipboard.writeText(NET.code).then(()=>toast('Código copiado: '+NET.code)); }
function shareRoom(){
  const url=roomLink(), text=`¡Vení a jugar a El Impostor conmigo! 🎭🇵🇾 Sala ${NET.code}`;
  if(navigator.share) return navigator.share({title:'El Impostor', text, url}).catch(()=>{});
  modal(`<h2>📤 Invitar a la sala ${NET.code}</h2><p style="word-break:break-all;user-select:all;background:#fff;padding:8px;border-radius:8px">${esc(url)}</p>
    <a class="btn green wide" style="display:block;text-align:center;text-decoration:none" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text+' '+url)}">💬 Mandar por WhatsApp</a>
    <button class="btn wide" style="margin-top:6px" onclick="navigator.clipboard.writeText('${url}').then(()=>toast('Enlace copiado'))">📋 Copiar enlace</button>
    <button class="btn gray wide" style="margin-top:6px" onclick="closeModal()">Cerrar</button>`);
}

/* ====================== REGLAS ====================== */
function showRules(){
  modal(`<div class="rules"><h2>📜 Cómo se juega El Impostor</h2>
  <p>Un juego de palabras, mentiras y sospechas para <b>3 a ${MAXP} jugadores</b>. Todos reciben la misma <b>palabra secreta</b>… menos el <b>impostor</b> 🎭, que no la sabe y tiene que disimular.</p>
  <h3>▶️ Una ronda</h3>
  <ol>
    <li><b>🎴 La tarjeta.</b> Cada uno mira su tarjeta sin que la vean los demás. Los inocentes ven la palabra (por ejemplo <i>Chipa</i>) y la categoría. El impostor ve “???” y, según la mesa, alguna ayuda.</li>
    <li><b>🧉 Las pistas.</b> Como en una ronda de tereré, la guampa va pasando: cada uno dice <b>una pista</b> relacionada con la palabra (escrita o en voz). Ni muy clara (el impostor la adivina) ni muy rara (van a pensar que sos vos). <b>No vale decir la palabra.</b></li>
    <li><b>🗣️ La discusión.</b> Se habla por voz o por chat: ¿quién dijo algo que no tenía que ver?</li>
    <li><b>🗳️ La votación.</b> Cada uno toca a quién quiere echar (o “no echar a nadie”). Se va el que tiene más votos; si hay empate, nadie.</li>
    <li><b>🚪 El resultado.</b> Se da vuelta la tarjeta del echado: ¿era el impostor?</li>
  </ol>
  <h3>🏁 Quién gana</h3>
  <ul>
    <li><b>Ganan los inocentes</b> si echan a todos los impostores.</li>
    <li><b>Gana el impostor</b> si sobrevive: cuando quedan tantos impostores como inocentes, o en “muerte súbita” si echan a un inocente.</li>
    <li><b>Última oportunidad:</b> si al impostor lo echan, puede intentar <b>adivinar la palabra</b>. ¡Si acierta, gana igual!</li>
    <li>Si echan a un inocente y la mesa juega “se sigue”, hay otra vuelta de pistas y otra votación.</li>
  </ul>
  <h3>🏆 Puntos</h3>
  <p>Al final de cada ronda se reparten puntos (lo elige el anfitrión): clásico = inocentes <b>+1</b> cada uno si ganan, impostor <b>+2</b> si se salva y <b>+3</b> si adivina. Con el <b>premio al cazador</b>, el inocente que votó al impostor suma +1 más. Después de las rondas elegidas, gana el que más puntos juntó.</p>
  <h3>⚙️ Lo que puede elegir el anfitrión</h3>
  <ul>
    <li><b>Cantidad de impostores</b>: 1, 2, 3… (siempre menos que los inocentes) o automático según cuántos son.</li>
    <li><b>Qué recibe el impostor</b>: nada, la categoría, una palabra parecida, las dos cosas, o el <b>modo encubierto</b>.</li>
    <li><b>Categorías</b>: ${Object.values(CATS).map(c=>c.e+' '+c.n).join(', ')}.</li>
    <li><b>Tiempos</b> por pista y de discusión, <b>vueltas de pistas</b> antes de votar, si el impostor puede <b>adivinar</b> (al ser echado o en cualquier momento, arriesgando), si los <b>impostores se conocen</b>, voto <b>secreto o a la vista</b>, y cuántas <b>rondas</b> tiene la partida.</li>
  </ul>
  <h3>👨‍👩‍👧‍👦 Variantes para grupos</h3>
  ${VARIANTS.map(v=>`<p><b>${v.t}</b>: ${esc(v.d)}</p>`).join('')}
  <p><b>🧉 La del tereré</b>: el que echan (o el impostor que pierde) ceba la próxima ronda. Se escribe en “Reglas propias del grupo”.</p>
  <p><b>🗣️ Solo en guaraní</b>: las pistas se dicen en guaraní o en jopara. ¡Vale reírse!</p>
  <p><b>🎥 Mímica</b>: con la cámara prendida, la pista se hace con gestos y se toca “Ya la dije en voz”.</p>
  <p><b>🤐 Una sola palabra</b>: la pista tiene que ser una palabra, sin frases. El que dice dos, pierde el turno.</p>
  <h3>💡 Consejos</h3>
  <ul><li>Inocente: pensá una pista que los demás inocentes entiendan, pero que no le diga todo al impostor.</li>
    <li>Impostor: escuchá las primeras pistas antes de hablar y decí algo que encaje con todas. Si te toca primero… ¡suerte! 😅</li>
    <li>En el modo encubierto, si las pistas de los demás no encajan con tu palabra, quizás el impostor seas vos.</li></ul>
  <h3>💬 Chat y voz</h3>
  <p>Escribí <b>@nombre</b> (o elegí a alguien en “Para”) para mandar un <b>mensaje privado</b>: solo lo ven ustedes dos. Con 🎤 hablan por voz y con 📷 se ven las caras. Los que entran con la partida empezada miran 👀 y se suman al terminar la ronda.</p>
  <p class="muted">🎶 ${MUSIC_CREDIT}</p>
  <button class="btn wide" onclick="closeModal()">Entendido</button></div>`);
}

if('serviceWorker' in navigator && location.protocol==='https:') navigator.serviceWorker.register('sw.js').catch(()=>{});
