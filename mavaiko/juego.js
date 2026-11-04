'use strict';
/* =====================================================================
   ¿Mávaiko Ojuka? — red (PeerJS), chat con privados, voz, tablero 2D/3D,
   libreta del pesquisa, ventanas para sospechar, mostrar y acusar.
   ===================================================================== */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function store(k,v){ try{ if(v===undefined) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
function load(k){ try{ const v=localStorage.getItem(k); return v==null?null:JSON.parse(v); }catch(e){ return null; } }
function toast(x){ const t=$('#toast'); t.textContent=gram(x); t.style.display='block'; clearTimeout(toast.t); toast.t=setTimeout(()=>t.style.display='none', 3800); }
const PREFIX='mavaiko26-';
const genCode = () => { const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s=''; for(let i=0;i<5;i++) s+=A[rnd(A.length)]; return s; };
let myToken=load('mvk_token'); if(!myToken){ myToken=Math.random().toString(36).slice(2)+Date.now().toString(36); store('mvk_token', myToken); }
const NET={mode:null, peer:null, code:null, conns:{}, hostConn:null, myPid:null, obs:null, welcomed:false};
let CHAT=[], V=null;
const me = () => NET.myPid || NET.obs;
const VP = id => V && (V.players.find(p=>p.id===id) || (V.observers||[]).find(o=>o.id===id));
const amHost = () => NET.mode==='local' || (V && V.hostPid===NET.myPid && NET.mode==='host');

/* ====================== MENÚ ====================== */
let myEmojiSel = load('mvk_emoji') || EMOJIS[0];
const myName = () => ($('#myName').value.trim() || 'Jugador').slice(0,16);
const myEmoji = () => myEmojiSel;
$('#myName').value = load('mvk_name') || '';
$('#myName').addEventListener('input', ()=>store('mvk_name', $('#myName').value.trim()));
function renderTokenPicker(){
  $('#tokens').innerHTML = EMOJIS.map(e=>`<button class="tok ${e===myEmojiSel?'sel':''}" onclick="pickEmoji('${e}')">${e}</button>`).join('');
}
function pickEmoji(e){ myEmojiSel=e; store('mvk_emoji', e); renderTokenPicker(); }
renderTokenPicker();
$('#logoCards').innerHTML = ['s0','w1','r4','s3','w2'].map((c,i)=>cardHTML(c,'', `transform:rotate(${(i-2)*11}deg) translateY(${Math.abs(i-2)*6}px)`)).join('');
function needName(){ if(!$('#myName').value.trim()){ toast('Escribí tu nombre primero ✍️'); $('#myName').focus(); return true; } store('mvk_name', myName()); return false; }
function joinClick(){
  const code=$('#joinCode').value.trim().toUpperCase(); if(!code) return toast('Escribí el código de la sala.');
  if(needName()) return; clientJoin(code);
}
function resumeClick(){
  const h=load('mvk_host'), c=load('mvk_client');
  if(h && (!c || h.at>=c.at)) return hostStart(true);
  if(c){ if(needName()) return; clientJoin(c.code); }
}
function refreshResume(){
  const h=load('mvk_host'), c=load('mvk_client'), ok=x=>x && Date.now()-x.at<6*3600e3;
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
  if(id==='game') setTimeout(fitBoard, 30);
}
function localStart(){
  if(needName()) return;
  NET.mode='local'; NET.code=null; CHAT=[];
  S=lobbyState(); S.opts=Object.assign(defaultOpts(), load('mvk_localopts')||{});
  const p=addPlayer(myName(), myEmoji(), myToken, null); NET.myPid=p.id; S.hostPid=p.id;
  const n=+$('#nBots').value; for(let i=0;i<n;i++) addBot();
  startGame(); sysChat('🌙 Caso de práctica contra bots. Las reglas de la casa se cambian en la pestaña 🏠 Reglas (para el próximo caso).');
  LAST.ev=null; FACES={}; commit(); shareMyFace();
}
function leaveClick(){
  if(NET.mode==='local'){ if(S && S.phase==='play' && !confirm('¿Salir del caso contra los bots?')) return; return leaveToMenu(); }
  if(!confirm('¿Salir de la sala?')) return;
  if(NET.mode==='host'){
    const others=hostCandidates(S);
    if(others.length) return hostHandover();
    store('mvk_host', undefined);
  } else if(NET.mode==='client'){
    if(NET.hostConn && NET.hostConn.open && NET.myPid) try{ NET.hostConn.send({t:'act', a:{type:'leave'}}); }catch(e){}
    store('mvk_client', undefined);
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
  const over=s.phase==='over';
  s.players.forEach(p=>{ delete p.token; p.n=p.hand.length; if(p.id!==forPid && !over) p.hand=null; });
  (s.observers||[]).forEach(o=>delete o.token);
  if(!over) s.sol=null;
  delete s.ownerTok;
  if(s.peek && s.peek.to!==forPid) s.peek=null;
  (s.hist||[]).forEach(h=>{ if(h.by!==forPid && h.shower!==forPid) h.card=null; });
  (s.ev||[]).forEach(e=>{ if(e.k==='show' && e.to!==forPid && e.from!==forPid) e.card=null; });
  return s;
}
function commit(){
  if(NET.mode==='host'){
    for(const pid in NET.conns){ const c=NET.conns[pid]; if(c && c.open) try{ c.send({t:'state', s:publicState(pid)}); }catch(e){} }
    sendBackups();
    if(!NET.noSave) store('mvk_host', {code:NET.code, S, CHAT:CHAT.slice(-80), myPid:NET.myPid, at:Date.now()});
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
  const saved = resume ? load('mvk_host') : null;
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
    if(resume){ toast('La sala sigue abierta en otro aparato (otro jugador quedó de anfitrión). Entrá con el código.'); peer.destroy(); store('mvk_host',undefined); NET.mode=null; $('#joinCode').value=NET.code; return; }
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
  store('mvk_host', undefined);
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
      if((S.ownerTok||[]).includes(d.token)){
        why='👑 Entraste como dueño del juego: todos ven que estás mirando y podés chatear y hablar.';
        ob={id:'o'+(++S.seq), name:nm, emoji:'👑', token:d.token, peerId:conn.peer, conn:true, owner:true};
        S.observers.push(ob); sysChat(`👑 ${ob.name} (dueño del juego) entró a mirar.`);
      } else if(S.phase!=='play' && S.players.length<MAXP){
        let name=nm; for(let k=2; S.players.some(x=>x.name.toLowerCase()===name.toLowerCase()); k++) name=nm.slice(0,13)+' '+k;
        let emo=EMOJIS.includes(d.emoji)?d.emoji:EMOJIS[0]; if(S.players.some(x=>x.emoji===emo)) emo=EMOJIS.find(e=>!S.players.some(x=>x.emoji===e))||emo;
        p=addPlayer(name, emo, d.token, conn.peer);
        sysChat(`${p.emoji} ${p.name} entró a la sala.`);
      } else {
        why = S.players.length>=MAXP ? 'Ya hay 6 pesquisas: entraste a mirar 👀.' : 'El caso ya empezó: entraste a mirar 👀. Te podés sumar cuando termine.';
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
function onSeatChange(oldId, newId){
  if(NET.mode!=='host') return;
  const c=NET.conns[oldId]; if(!c) return;
  delete NET.conns[oldId]; NET.conns[newId]=c; c.pid=newId;
  try{ c.send({t:'welcome', pid:newId, code:NET.code, why:'🪑 ¡Te sumaste a la investigación!', force:true}); }catch(e){}
}
function hostOnClose(conn){
  const pid=conn.pid; if(!pid || NET.conns[pid]!==conn || !S) return;
  delete NET.conns[pid];
  const ob=OB(pid);
  if(ob){ S.observers=S.observers.filter(x=>x!==ob); sysChat(`👀 ${ob.name} dejó de mirar.`); commit(); return; }
  const p=P(pid); if(!p) return;
  if(S.phase!=='play'){ S.players=S.players.filter(x=>x!==p); sysChat(`${p.name} salió de la sala.`); }
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
  if(mine){ if(S.phase!=='play') S.players=S.players.filter(p=>p!==mine); else { mine.bot=true; mine.conn=false; mine.token=null; log(`🚪 ${mine.name} se fue: un bot sigue con sus cartas.`); } }
  const c=NET.conns[next.id];
  try{ c.send({t:'migrate', s:S, chat:CHAT.slice(-80)}); }catch(e){}
  NET.noSave=true; store('mvk_host', undefined);
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
  if(old && reason!=='handover'){ if(S.phase!=='play') S.players=S.players.filter(p=>p!==old); }
  S.hostPid=NET.myPid;
  netBar(true,'👑 Tomando el mando de la sala…');
  let tries=0;
  const claim=()=>{
    if(NET.mode!=='host') return;
    const peer=NET.peer=newPeer(PREFIX+NET.code);
    peer.on('open', id=>{
      netBar(false); mine.peerId=id; mine.conn=true; delete mine.offAt;
      sysChat(`👑 ${mine.name} ahora es el anfitrión${old?` (${old.name} ${reason==='handover'?'salió':'se desconectó'})`:''}. El caso sigue.`);
      toast('👑 Ahora sos el anfitrión: el caso sigue desde tu aparato. No cierres el juego.');
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
      if(!NET.welcomed){ toast('No se encontró la sala '+code+'. Revisá el código.'); store('mvk_client',undefined); leaveToMenu(); }
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
    store('mvk_client',{code:NET.code, at:Date.now()}); if(location.hash!=='#'+NET.code) history.replaceState(null,'','#'+NET.code);
    if(d.why) toast(d.why);
    setTimeout(shareMyFace, 300);
  }
  else if(d.t==='state'){ S=d.s; render(); }
  else if(d.t==='chat'){ CHAT.push(d.m); renderChat(d.m); }
  else if(d.t==='chatlog'){ CHAT=d.list||[]; renderChat(); }
  else if(d.t==='faces' || d.t==='face') clientFace(d);
  else if(d.t==='backup'){ NET.backup={s:d.s, chat:d.chat}; }
  else if(d.t==='migrate'){ NET.backup={s:d.s, chat:d.chat}; takeoverHost('handover'); }
  else if(d.t==='kicked'){ toast('🚪 El anfitrión te sacó de la mesa.'); store('mvk_client',undefined); leaveToMenu(); }
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
const BUB={};
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
    if(!m.sys && !m.to){ BUB[m.from]={x:m.x, at:Date.now()}; renderPawns(); setTimeout(renderPawns, 4600); }
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
function toggleSide(force, tab){
  const s=$('#side'), open = force==null ? !s.classList.contains('open') : force;
  if(window.innerWidth>=1000 && force==null){ setTab(tab||'chat'); if(!tab) $('#chatText').focus(); return; }
  s.classList.toggle('open', open);
  if(open) setTab(tab||'chat');
}
function openNotes(){ toggleSide(true, 'nota'); if(window.innerWidth>=1000) setTab('nota'); }
function setTab(t){
  $$('#tabs button').forEach(b=>b.classList.toggle('on', b.dataset.tab===t));
  $$('.tabp').forEach(p=>p.classList.toggle('on', p.id==='tab-'+t));
  if(t==='chat'){ UNREAD=0; refreshUnread(); const el=$('#chatList'); el.scrollTop=el.scrollHeight; }
  if(t==='hist') renderHist();
  if(t==='nota') renderNotes();
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
  if(call.metadata && call.metadata.kind==='cam') return camOnCall(call);
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
const SND={on:load('mvk_snd')!==false, ctx:null};
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
  dice(){ for(let i=0;i<6;i++) noise(.05,.25,i*.07,1200); tone(160,.08,'triangle',.12,.45); },
  step(){ tone(220,.05,'triangle',.08); },
  door(){ tone(300,.1,'sawtooth',.05); tone(200,.25,'triangle',.08,.08); noise(.12,.1,.02,600); },
  turn(){ tone(740,.12,'sine',.14); tone(988,.18,'sine',.14,.11); },
  sus(){ [392,370,349,330].forEach((f,i)=>tone(f,.22,'triangle',.11,i*.16)); },
  show(){ noise(.09,.3,0,2200); tone(660,.15,'sine',.1,.05); },
  bad(){ tone(240,.3,'sawtooth',.1); tone(160,.45,'sawtooth',.1,.25); },
  win(){ [523,659,784,1047].forEach((f,i)=>tone(f,.3,'triangle',.14,i*.13)); },
  priv(){ tone(1200,.08,'sine',.08); tone(1500,.1,'sine',.08,.08); },
  shuffle(){ for(let i=0;i<8;i++) noise(.04,.15,i*.05,2500); },
  pombero(){ tone(90,.6,'sawtooth',.07); tone(1800,.05,'square',.03,.3); tone(1500,.05,'square',.03,.45); },
};
function toggleSound(){ SND.on=!SND.on; store('mvk_snd', SND.on); $('#btnSnd').textContent=SND.on?'🔊':'🔇'; if(SND.on) sfx.turn(); }
$('#btnSnd').textContent=SND.on?'🔊':'🔇';
document.addEventListener('pointerdown', ()=>actx(), {once:true});
const MUSIC_CREDIT = 'Música: "Monkeys Spinning Monkeys" de Kevin MacLeod (incompetech.com). Licencia Creative Commons Atribución 4.0: creativecommons.org/licenses/by/4.0/';
const MUSIC = { on: load('mvk_music')!==false, buf:null, src:null, gain:null, loading:false, VOL:.08 };
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
function toggleMusic(){ MUSIC.on=!MUSIC.on; store('mvk_music', MUSIC.on); musicSync(); toast(MUSIC.on?'🎶 Música de fondo prendida (suave).':'🔕 Música de fondo apagada.'); }
function renderMusicBtn(){ $$('.btnMusic').forEach(b=>{ b.textContent = MUSIC.on ? '🎶' : '🔕'; b.title = MUSIC.on ? 'Apagar la música de fondo' : 'Prender la música de fondo'; }); }
renderMusicBtn(); $('#musicCredit').textContent='🎶 '+MUSIC_CREDIT;

/* ====================== CARTAS ====================== */
function cardHTML(id, cls, style){
  const k=cardKind(id), x=cardInfo(id);
  const col = k==='s' ? x.c : k==='w' ? '#6b4423' : '#2f6b3a';
  return `<div class="card k-${k} ${cls||''}" data-c="${id}" style="--cc:${col};${style||''}"><span class="kd">${KIND_N[k]}</span><span class="em">${x.e}</span><b>${esc(x.n)}</b>${x.t?`<small>${esc(x.t)}</small>`:''}</div>`;
}
function chipHTML(id){ const x=cardInfo(id); return `<span class="chip k-${cardKind(id)}">${x.e} ${esc(x.n)}</span>`; }

/* ====================== RENDER ====================== */
const LAST={ev:null, turnKey:null, overKey:null, peekAt:null, refKey:null, sugKey:null};
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
    + `${host?'👑':''}${p.bot?'🤖':''}${p.mic?'🎙️':''}${!p.bot&&!p.conn?'⚠️':''}${p.wins?` <span class="muted">🏆${p.wins}</span>`:''}`;
}

// ---------- sala de espera ----------
function renderLobby(){
  const host=amHost(), myObs=!!NET.obs;
  $('#lobbyCode').textContent=NET.code||'—';
  $('#lobbyCodeBox').style.display = NET.mode==='local' ? 'none' : '';
  $('#pcount').textContent=`(${V.players.length}/${MAXP})`;
  $('#plist').innerHTML=V.players.map(p=>`<li>${playerTag(p)}${host && p.id!==V.hostPid?`<button class="btn sm gray" onclick="doAct({type:'kick',pid:'${p.id}'})" title="Sacar">✕</button>`:''}</li>`).join('')
    + (V.observers||[]).map(o=>`<li style="opacity:.75"><span style="font-size:20px">👀</span><span class="nm">${esc(o.name)} <span class="muted">mirando</span></span>${o.mic?'🎙️':''}</li>`).join('');
  $('#lobbyHostBtns').innerHTML = host
    ? `<div class="row"><button class="btn gray" onclick="doAct({type:'addBot'})" ${V.players.length>=MAXP?'disabled':''}>🤖 Sumar bot</button>
       <button class="btn green" onclick="doAct({type:'start'})" ${V.players.length<2?'disabled':''}>🌙 Empezar el caso</button></div>
       <p class="muted">De 2 a 6 pesquisas. Con menos de 2 sumá un bot. Si alguien se corta, un bot juega por él hasta que vuelva.</p>`
    : `<p class="muted" style="text-align:center">⏳ Esperando que el anfitrión 👑 empiece el caso…</p>`;
  $('#lobbyObs').innerHTML = myObs ? `<div class="obsbar" style="border-radius:10px;margin-top:8px">👀 Estás mirando. ${V.players.length<MAXP?`<button class="btn sm gold" onclick="doAct({type:'joinNext'})">🪑 Sumarme a jugar</button>`:'La mesa está llena.'}</div>` : '';
  $('#optsBox').innerHTML = optsHTML(host);
  const g=$('#grulesBox');
  if(host){
    if(!g.querySelector('textarea')) g.innerHTML=`<textarea id="grulesIn" maxlength="1200" placeholder="Ej.: el que acusa mal ceba el tereré 🧉&#10;Vale mentir en el chat, pero no en las cartas…"></textarea><p class="muted" style="margin:4px 0 0">Se guarda solo y lo ven todos.</p>`;
    const ta=$('#grulesIn'); if(document.activeElement!==ta) ta.value=V.grules||'';
    ta.oninput=()=>{ clearTimeout(ta.t); ta.t=setTimeout(()=>doAct({type:'grules', text:ta.value}), 600); };
  } else g.innerHTML = V.grules ? `<div class="grules">${esc(V.grules)}</div>` : `<p class="muted">El anfitrión todavía no escribió reglas propias.</p>`;
  $('#sugBox').innerHTML = sugsHTML(host);
}
function optsHTML(host){
  const o=V.opts, dis = host && V.phase!=='play' ? '' : 'disabled';
  return `<label style="margin-top:0">Cómo se camina por la estancia</label><select ${dis} onchange="doAct({type:'opt',k:'moves',v:this.value})">${MOVES.map(t=>`<option value="${t.v}" ${o.moves===t.v?'selected':''}>${t.t}</option>`).join('')}</select>
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
function sendSug(id){ const i=$('#'+id); const t=i.value.trim(); if(!t) return toast('Escribí la regla que querés sugerir.'); doAct({type:'suggestRule', text:t}); i.value=''; toast('💡 ¡Sugerencia enviada! Los demás la pueden votar.'); }

/* ====================== TABLERO ====================== */
const U = 100/N;   // tamaño de una casilla en %
let BOARD_BUILT=false;
function buildBoard(){
  if(BOARD_BUILT) return; BOARD_BUILT=true;
  let h='';
  for(let r=0;r<N;r++) for(let c=0;c<N;c++) if(isHall(r,c)){
    const st=START.findIndex(x=>x[0]===r&&x[1]===c);
    h+=`<div class="tile ${(r+c)%2?'b':''} ${st>=0?'start':''}" data-k="${r},${c}" style="left:${c*U}%;top:${r*U}%"></div>`;
  }
  ROOMS.forEach((R,i)=>{
    const pass = R.pass!=null ? `<span class="tunnel" title="Túnel del Pombero a ${esc(ROOMS[R.pass].n)}">👹→${ROOMS[R.pass].e}</span>` : '';
    h+=`<div class="room rm${i}" data-r="${i}" style="left:${R.c*U}%;top:${R.r*U}%;width:${R.w*U}%;height:${R.h*U}%"><div class="floor"></div>
      <div class="rname"><span>${R.e}</span><b>${esc(R.n)}</b></div>${pass}<div class="rtoks" id="rtoks${i}"></div></div>`;
    R.doors.forEach(([r,c])=>{
      // la puerta está en el borde entre la casilla del pasillo y la pieza
      for(const [dr,dc] of DIRS){ const rr=r+dr, cc=c+dc; if(rr<0||cc<0||rr>=N||cc>=N||RMAP[rr][cc]!==i) continue;
        const horiz = dr!==0;
        const x = horiz ? (c+.5)*U : (dc>0 ? (c+1)*U : c*U), y = horiz ? (dr>0 ? (r+1)*U : r*U) : (r+.5)*U;
        h+=`<i class="door ${horiz?'h':'v'}" style="left:${x}%;top:${y}%"></i>`; }
    });
  });
  h+=`<div class="sign" style="left:${(N/2)*U}%;top:${12.9*U}%">ESTANCIA ÑU PORÃ</div>`;
  $('#tiles').innerHTML=h;
  $$('#tiles .tile').forEach(t=>t.onclick=()=>tileClick(t.dataset.k));
  $$('#tiles .room').forEach(t=>t.onclick=()=>roomClick(+t.dataset.r));
}
function fitBoard(){
  const st=$('#stage'), b=$('#board'); if(!st || !b) return;
  const w=st.clientWidth, h=st.clientHeight; if(!w||!h) return;
  const s = VIEW.mode==='3d' ? Math.min(w*.88, h*1.02) : Math.min(w, h)-28;
  b.style.width=b.style.height=Math.max(200, s)+'px';
}
window.addEventListener('resize', fitBoard);
const meP = () => V && V.players.find(p=>p.id===me());
const myTurn = () => V && V.phase==='play' && V.players[V.turn] && V.players[V.turn].id===me();
function myReach(){
  const p=meP(); if(!p || !myTurn() || V.step!=='move') return null;
  const keep=S; S=V; try{ return reach(p, V.moves); } finally { S=keep; }
}
function tileClick(k){
  if(DRAG.moved) return;
  const R=myReach(); if(!R) return;
  if(!R.cells[k]) return toast('No llegás hasta esa casilla.');
  doAct({type:'move', cell:k.split(',').map(Number)});
}
function roomClick(i){
  if(DRAG.moved) return;
  const R=myReach();
  if(!R){ toast(`${ROOMS[i].e} ${ROOMS[i].n}`); return; }
  if(R.rooms[i]==null) return toast(`No te alcanza para llegar a ${artR(i)}.`);
  doAct({type:'move', room:i});
}
// lugares de cada jugador adentro de una pieza
function roomSpot(ri, k){
  const R=ROOMS[ri], cols=Math.max(2, R.w-1), row=Math.floor(k/cols), col=k%cols;
  return [(R.c+.85+col*((R.w-1.7)/Math.max(1,cols-1)))*U, (R.r+R.h-.75-row*1.05)*U];
}
function renderBoard(){
  buildBoard();
  const R=myReach();
  $$('#tiles .tile').forEach(t=>{ const d=R && R.cells[t.dataset.k]; t.classList.toggle('can', !!d); });
  $$('#tiles .room').forEach(t=>{ const i=+t.dataset.r; t.classList.toggle('can', !!(R && R.rooms[i]!=null)); t.classList.toggle('here', !!(meP() && meP().room===i)); });
  // sospechosos y armas en cada pieza
  ROOMS.forEach((x,i)=>{
    const s=(V.tokS||[]).map((r,k)=>r===i?k:-1).filter(k=>k>=0), w=(V.tokW||[]).map((r,k)=>r===i?k:-1).filter(k=>k>=0);
    const el=$('#rtoks'+i); if(!el) return;
    el.innerHTML = s.map(k=>`<span class="stok" style="--sc:${SUS[k].c}" title="${esc(SUS[k].n)}">${SUS[k].e}</span>`).join('') + w.map(k=>`<span class="wtok" title="${esc(WPN[k].n)}">${WPN[k].e}</span>`).join('');
  });
  renderPawns();
  renderDice();
}
function renderPawns(){
  if(!V || V.phase==='lobby') return;
  const box=$('#pawns'), seen={}, inRoom={};
  const curId=V.players[V.turn] && V.players[V.turn].id;
  V.players.forEach(p=>{
    let x, y;
    if(p.room!=null){ const k=inRoom[p.room]=(inRoom[p.room]||0); inRoom[p.room]++; [x,y]=roomSpot(p.room, k); }
    else if(p.pos){ x=(p.pos[1]+.5)*U; y=(p.pos[0]+.5)*U; }
    else return;
    seen[p.id]=1;
    let el=box.querySelector(`.pawn[data-pid="${p.id}"]`);
    if(!el){ el=document.createElement('div'); el.className='pawn'; el.dataset.pid=p.id; box.appendChild(el); }
    el.style.left=x+'%'; el.style.top=y+'%'; el.style.setProperty('--pc', p.color);
    el.classList.toggle('turn', p.id===curId && V.phase==='play'); el.classList.toggle('me', p.id===me()); el.classList.toggle('out', !!p.out);
    const b=BUB[p.id], bub = b && Date.now()-b.at<4500 ? `<div class="bub">${esc(b.x.slice(0,90))}</div>` : '';
    const face=FACES[p.id];
    const html=`<div class="fig">${headHTML(p)}<span class="pin">${face?`<img src="${face}" alt="">`:esc(p.emoji)}</span><span class="base"></span><b>${esc(p.name)}${p.out?' ❌':''}${p.bot?' 🤖':''}${!p.bot&&!p.conn?' ⚠️':''}</b>${bub}</div>`;
    if(el._h!==html){ el._h=html; el.innerHTML=html; }
  });
  box.querySelectorAll('.pawn').forEach(el=>{ if(!seen[el.dataset.pid]) el.remove(); });
  headsAfterRender();
}
const PIPS={1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]};
const dieHTML = n => `<div class="die">${[1,2,3,4,5,6,7,8,9].map(i=>`<i class="${(PIPS[n]||[]).includes(i)?'on':''}"></i>`).join('')}</div>`;
function renderDice(){
  const d=$('#dice');
  if(V.phase!=='play' || !V.dice){ d.innerHTML=''; return; }
  const key=V.turn+':'+V.dice.join(',')+':'+V.turnAt;
  if(d.dataset.k===key) return; d.dataset.k=key;
  d.innerHTML=V.dice.map(dieHTML).join('')+`<span class="sum">${V.moves}</span>`;
}

// ---------- partida ----------
function renderGame(){
  $('#roomTag').textContent = NET.mode==='local' ? '🤖 Práctica' : '🔑 '+NET.code;
  $('#obsbar').style.display = NET.obs ? 'block' : 'none';
  if(NET.obs) $('#obsbar').innerHTML = `👀 Estás mirando el caso (no se ven las cartas de nadie).`;
  applyView();
  renderBoard(); renderHand(); renderActions();
  processEvents();
  turnNotice();
  refuteModal(); suggestAuto(); overModal(); peekModal();
}
function renderHand(){
  const p=meP(), el=$('#hand');
  const up=(V.up||[]).map(c=>cardHTML(c,'mini up')).join('');
  if(!p){ el.innerHTML=(up?`<span class="hlab">👁️ A la vista:</span>${up}`:'')+`<span class="hlab">👀 Mirando el caso</span>`; $('#mineTag').innerHTML=''; return; }
  const curId=V.players[V.turn]&&V.players[V.turn].id;
  $('#mineTag').innerHTML = `<div class="mine ${curId===me()&&V.phase==='play'?'turn':''}" style="--pc:${p.color}">${headHTML(p)}<span class="av">${esc(p.emoji)}</span><b>${esc(p.name)}</b>${p.out?' · ❌ afuera':''}</div>`;
  headsAfterRender();
  el.innerHTML = `<span class="hlab">🃏 Tus cartas:</span>`+(p.hand||[]).map(c=>cardHTML(c,'mini')).join('') + (up?`<span class="hlab">👁️ A la vista:</span>${up}`:'');
}
function renderActions(){
  const p=meP(), A=$('#actions'), st=$('#status');
  if(V.phase!=='play'){ A.innerHTML=V.phase==='over'?`<button class="btn gold" onclick="LAST.overKey=null;overModal(true)">🏆 Ver la solución</button>`:''; st.innerHTML=V.phase==='over'?'🔒 Caso cerrado.':''; return; }
  const cp=V.players[V.turn], R=V.refute;
  let h='', s='';
  if(R){
    const by=VP(R.by), w=R.waiting && VP(R.waiting);
    const hh=(V.hist||[]).find(x=>x.i===R.h);
    const what = hh ? `<b>${esc(tripleTxt(hh.s,hh.w,hh.r))}</b>` : '';
    if(R.waiting===me()){ s=`🤫 ${esc(by?by.name:'')} sospecha de ${what}. <b>Tenés que mostrarle una carta.</b>`; h+=`<button class="btn gold hot" onclick="LAST.refKey=null;refuteModal(true)">🃏 Elegir qué carta mostrar</button>`; }
    else if(R.by===me()) s=`🕵️ Sospechaste de ${what}. ${w?`Esperando que <b>${esc(w.name)}</b> te muestre una carta…`:''}`;
    else s=`🕵️ ${esc(by?by.name:'')} sospecha de ${what}. ${w?`${esc(w.name)} está eligiendo qué carta mostrarle…`:''}`;
  } else if(p && myTurn() && !p.out){
    const room=p.room;
    if(V.step==='roll'){
      s=`🟢 <b>¡Te toca!</b> ${room!=null?`Estás en ${esc(artR(room))}.`:''} ${V.opts.moves==='free'?'Elegí a qué pieza ir.':'Tirá los dados para caminar.'}`;
      h+= V.opts.moves==='free' ? `<button class="btn green" onclick="doAct({type:'roll'})">🏃 Ir a otra pieza</button>` : `<button class="btn green" onclick="doAct({type:'roll'})">🎲 Tirar ${V.opts.moves==='1d'?'el dado':'los dados'}</button>`;
      if(V.opts.pombero && room!=null && ROOMS[room].pass!=null) h+=`<button class="btn" style="background:#5b3b7a" onclick="doAct({type:'pass'})">👹 Túnel a ${esc(ROOMS[ROOMS[room].pass].n)}</button>`;
      h+=`<button class="btn red" onclick="accuseModal()">⚖️ Acusar</button>`;
    } else if(V.step==='move'){
      s = V.opts.moves==='free' ? '🏃 Tocá la pieza a la que querés ir.' : `🎲 Sacaste <b>${V.moves}</b>: tocá una casilla que brilla o una pieza para entrar.`;
      h+=`<button class="btn gray" onclick="doAct({type:'stay'})">✋ Quedarme acá</button>`;
    } else if(V.step==='suggest'){
      s=`🚪 Entraste <b>${esc(gram('a '+artR(room)))}</b> ${ROOMS[room].e}. ¿De quién sospechás y con qué arma?`;
      h+=`<button class="btn gold" onclick="suggestModal()">🕵️ Sospechar</button><button class="btn red" onclick="accuseModal()">⚖️ Acusar</button><button class="btn gray" onclick="doAct({type:'endTurn'})">⏭️ Terminar</button>`;
    } else if(V.step==='after'){
      s='🤔 ¿Ya sabés quién fue? Si estás seguro, acusá. Si no, terminá tu turno.';
      h+=`<button class="btn red" onclick="accuseModal()">⚖️ Acusar</button><button class="btn green" onclick="doAct({type:'endTurn'})">⏭️ Terminar turno</button>`;
    }
  } else {
    s = `⏳ Turno de <b>${esc(cp.emoji)} ${esc(cp.name)}</b>${cp.bot?' 🤖':''}`;
    if(V.step==='move' && V.dice) s+=` · sacó ${V.moves}`;
    if(p && p.out) s=`❌ Quedaste afuera del caso: solo mostrás tus cartas cuando te toca. ${s}`;
  }
  if(p) h+=`<button class="btn dark" onclick="openNotes()">📒 Libreta</button>`;
  A.innerHTML=h; st.innerHTML=gram(s);
}
function turnNotice(){
  if(V.phase!=='play') return;
  const key=V.round+':'+V.turn+':'+V.turnAt+':'+V.step;
  if(key===LAST.turnKey) return; LAST.turnKey=key;
  if(myTurn() && V.step==='roll' && LAST.ev!=null){
    sfx.turn(); if(navigator.vibrate) try{ navigator.vibrate(120); }catch(e){}
    const d=document.createElement('div'); d.className='yourturn'; d.textContent='🟢 ¡Te toca, pesquisa!'; document.body.appendChild(d); setTimeout(()=>d.remove(),1700);
  }
}

// ---------- lo que pasa en la mesa ----------
function bigText(t, sub){ const d=document.createElement('div'); d.className='big-uno'; d.innerHTML=esc(t)+(sub?`<small>${esc(sub)}</small>`:''); document.body.appendChild(d); setTimeout(()=>d.remove(),2200); }
function processEvents(){
  const evs=V.ev||[], maxI=evs.length?evs[evs.length-1].i:0;
  if(LAST.ev==null || maxI<LAST.ev){ LAST.ev=maxI; return; }
  const news=evs.filter(e=>e.i>LAST.ev); LAST.ev=maxI;
  if(news.length>8) return;
  let delay=0;
  for(const e of news){
    const p=VP(e.pid);
    if(e.k==='roll'){ sfx.dice(); const d=$('#dice'); d.classList.remove('roll'); void d.offsetWidth; d.classList.add('roll'); }
    else if(e.k==='step') sfx.step();
    else if(e.k==='room') setTimeout(()=>sfx.door(), 350);
    else if(e.k==='tunnel'){ sfx.pombero(); setTimeout(()=>bigText('👹 ¡Túnel del Pombero!', p?p.name:''), delay); delay+=400; }
    else if(e.k==='suggest'){ setTimeout(()=>{ sfx.sus(); bigText('🕵️ ¿Habrá sido…?', `${SUS[e.s].n} · ${WPN[e.w].n} · ${ROOMS[e.r].n}`); }, delay); delay+=600; }
    else if(e.k==='show'){
      const to=VP(e.to), from=VP(e.from);
      if(e.to===me() && e.card){ setTimeout(()=>{ sfx.show(); shownModal(e.card, from); }, delay+500); }
      else if(e.from===me() && e.card) toast(`🤫 Le mostraste “${cardName(e.card)}” a ${to?to.name:''}.`);
      else setTimeout(()=>{ sfx.show(); toast(`🤫 ${from?from.name:''} le mostró una carta en secreto a ${to?to.name:''}.`); }, delay);
    }
    else if(e.k==='nobody'){ setTimeout(()=>{ sfx.bad(); bigText('😮 ¡Nadie mostró nada!', e.by===me()?'¿Será que diste en el clavo?':''); }, delay+300); }
    else if(e.k==='accuse'){ setTimeout(()=>{ bigText('⚖️ ¡Acusación!', p?p.name:''); }, delay); setTimeout(()=>{ if(e.ok) sfx.win(); else { sfx.bad(); bigText('❌ ¡No era así!', p?p.name:''); } }, delay+2000); delay+=2000; }
    else if(e.k==='deal'){ sfx.shuffle(); }
  }
}

// ---------- ventanas ----------
function modal(h, lock){ $('#mbox').innerHTML=h; $('#modal').classList.add('on'); if(lock) $('#modal').dataset.lock='1'; else delete $('#modal').dataset.lock; }
function closeModal(){ $('#modal').classList.remove('on'); delete $('#modal').dataset.lock; }
$('#modal').addEventListener('click', e=>{ if(e.target.id==='modal' && !$('#modal').dataset.lock) closeModal(); });
// elegir cartas (sospechoso, arma, lugar) mostrando lo que tachaste en la libreta
const PICK={s:null, w:null, r:null};
function pickGrid(k, ids){
  const nm=noteMarks();
  return `<div class="pgrid">${ids.map(id=>{ const i=cardIdx(id), dead=nm.dead[id];
    return `<button class="pk ${PICK[k]===i?'sel':''} ${dead?'dead':''}" onclick="PICK.${k}=${i};this.parentElement.querySelectorAll('.pk').forEach(b=>b.classList.remove('sel'));this.classList.add('sel')">${cardHTML(id,'mini')}</button>`; }).join('')}</div>`;
}
function suggestModal(){
  const p=meP(); if(!p || p.room==null) return;
  PICK.s=null; PICK.w=null;
  modal(`<h2>🕵️ ¿Habrá sido…?</h2><p style="margin-top:0">Sospechás que fue en <b>${esc(artR(p.room))}</b> ${ROOMS[p.room].e}. El sospechoso y el arma que elijas vienen a esta pieza. Los demás, en orden, te tienen que mostrar una carta si tienen alguna.</p>
    <p class="muted">Las que tachaste en tu libreta se ven más clarito.</p>
    <h3>🧑 ¿Quién?</h3>${pickGrid('s', CARDS.filter(c=>c[0]==='s'))}
    <h3>🗡️ ¿Con qué?</h3>${pickGrid('w', CARDS.filter(c=>c[0]==='w'))}
    <button class="btn gold wide" onclick="if(PICK.s==null||PICK.w==null)return toast('Elegí un sospechoso y un arma.');closeModal();doAct({type:'suggest',s:PICK.s,w:PICK.w})">🕵️ Sospechar</button>
    <button class="btn gray wide" style="margin-top:6px" onclick="closeModal()">Ahora no</button>`);
}
function suggestAuto(){
  if(!myTurn() || V.step!=='suggest') return;
  const key=V.turnAt+':'+V.round; if(LAST.sugKey===key) return; LAST.sugKey=key;
  setTimeout(()=>{ if(myTurn() && V.step==='suggest' && !$('#modal').classList.contains('on')) suggestModal(); }, 900);
}
function accuseModal(){
  PICK.s=null; PICK.w=null; PICK.r=null;
  const p=meP();
  modal(`<h2>⚖️ Acusación</h2><p style="margin-top:0">Si acertás las tres cosas, <b>ganás</b>. Si te equivocás, ${V.opts.second && p && !p.strikes?'perdés 2 turnos (tenés una segunda oportunidad).':'<b>quedás afuera del caso</b> (pero seguís mostrando tus cartas).'} Abrís el sobre solo vos.</p>
    <h3>🧑 ¿Quién fue?</h3>${pickGrid('s', CARDS.filter(c=>c[0]==='s'))}
    <h3>🗡️ ¿Con qué?</h3>${pickGrid('w', CARDS.filter(c=>c[0]==='w'))}
    <h3>🏠 ¿Dónde?</h3>${pickGrid('r', CARDS.filter(c=>c[0]==='r'))}
    <button class="btn red wide" onclick="accuseGo()">⚖️ ¡Acuso!</button>
    <button class="btn gray wide" style="margin-top:6px" onclick="closeModal()">Mejor no</button>`);
}
function accuseGo(){
  if(PICK.s==null||PICK.w==null||PICK.r==null) return toast('Elegí quién, con qué y dónde.');
  if(!confirm(`¿Seguro? Acusás a ${tripleTxt(PICK.s,PICK.w,PICK.r)}.`)) return;
  closeModal(); doAct({type:'accuse', s:PICK.s, w:PICK.w, r:PICK.r});
}
function refuteModal(force){
  const R=V.refute; if(!R || R.waiting!==me()) return;
  const key=R.h+':'+R.waiting; if(!force && LAST.refKey===key) return; LAST.refKey=key;
  const p=meP(), by=VP(R.by), ok=(p.hand||[]).filter(c=>R.cards.includes(c));
  const hh=(V.hist||[]).find(x=>x.i===R.h);
  modal(`<h2>🤫 Mostrale una carta a ${esc(by?by.name:'')}</h2><p style="margin-top:0">${esc(by?by.name:'')} sospecha de <b>${hh?esc(tripleTxt(hh.s,hh.w,hh.r)):''}</b>. Tenés ${ok.length===1?'esta carta':'estas cartas'}: elegí ${ok.length===1?'mostrarla':'cuál le mostrás'} (solo la ve ${esc(by?by.name:'')}).</p>
    <div class="pgrid big">${ok.map(c=>`<button class="pk" onclick="closeModal();doAct({type:'show',card:'${c}'})">${cardHTML(c)}</button>`).join('')}</div>`, true);
}
function shownModal(card, from){
  modal(`<h2>🤫 ${esc(from?from.name:'')} te mostró…</h2><div class="reveal">${cardHTML(card)}</div>
    <p class="muted" style="text-align:center">${V.opts.autoNote?'Ya quedó anotada en tu 📒 libreta.':'Anotala en tu 📒 libreta.'}</p>
    <div class="row"><button class="btn dark" onclick="closeModal();openNotes()">📒 Ver libreta</button><button class="btn wide" onclick="closeModal()">Listo</button></div>`);
}
function overModal(force){
  if(V.phase!=='over' || !V.win) return;
  const key=V.round+':over'; if(!force && LAST.overKey===key) return; LAST.overKey=key;
  const w=V.win, wp=w.pid&&VP(w.pid), so=w.sol, host=amHost();
  setTimeout(()=>{
    if(!wp && !force) sfx.bad(); else if(!force) sfx.win();
    const nobs = NET.obs && V.players.length<MAXP ? `<button class="btn gold wide" style="margin-top:6px" onclick="doAct({type:'joinNext'});closeModal()">🪑 Sumarme al próximo caso</button>` : '';
    modal(`<h2>${wp?`🏆 ¡${esc(wp.name)} resolvió el caso!`:'🤷 Nadie resolvió el caso'}</h2>
      <p style="margin-top:0">Se abre el sobre: fue <b>${esc(tripleTxt(so.s,so.w,so.r))}</b>.</p>
      <div class="sobre">${triple(so.s,so.w,so.r).map(c=>cardHTML(c)).join('')}</div>
      <table class="score">${V.players.map(p=>`<tr><td>${esc(p.emoji)} <b>${esc(p.name)}</b>${p.id===w.pid?' 🏆':p.out?' ❌':''}</td><td><div class="cards">${(p.hand||[]).map(c=>cardHTML(c,'mini')).join('')}</div></td><td style="text-align:right">${p.wins?'🏆'+p.wins:''}</td></tr>`).join('')}</table>
      ${host?`<button class="btn green wide" onclick="closeModal();doAct({type:'start'})">🌙 Otro caso con los mismos</button><button class="btn gray wide" style="margin-top:6px" onclick="closeModal();doAct({type:'toLobby'})">⚙️ Volver a la sala (cambiar reglas)</button>`
        :`<p class="muted" style="text-align:center">⏳ Esperando que el anfitrión arme otro caso…</p>`}
      ${nobs}
      <button class="btn gray wide" style="margin-top:6px" onclick="closeModal()">Ver el tablero</button>`);
  }, force?0:2400);
}
function peekModal(){
  const k=V.peek; if(!k || k.to!==me() || LAST.peekAt===k.at) return; LAST.peekAt=k.at;
  setTimeout(()=>modal(`<h2>❌ ¡No era así!</h2><p>Abriste el sobre (solo vos lo ves): fue <b>${esc(tripleTxt(k.sol.s,k.sol.w,k.sol.r))}</b>.</p>
    <div class="sobre">${triple(k.sol.s,k.sol.w,k.sol.r).map(c=>cardHTML(c,'mini')).join('')}</div>
    <p>Quedaste afuera del caso, pero <b>seguís mostrando tus cartas</b> cuando te toque. ¡No le digas a nadie! 🤐</p><button class="btn wide" onclick="closeModal()">Entendido</button>`), 2600);
}

/* ====================== LIBRETA DEL PESQUISA ====================== */
const noteKey = () => 'mvk_note_'+(V && V.gid || 'x');
function noteData(){ return load(noteKey()) || {}; }
// marcas automáticas: lo que se sabe seguro (si la regla de la casa lo deja)
function autoMarks(){
  const a={}, p=meP(); if(!V || !p || !V.opts.autoNote) return a;
  const set=(c,pid,m)=>{ (a[c]=a[c]||{})[pid]=m; };
  (p.hand||[]).forEach(c=>V.players.forEach(q=>set(c,q.id, q.id===p.id?'✔':'✖')));
  (V.up||[]).forEach(c=>V.players.forEach(q=>set(c,q.id,'✖')));
  (V.hist||[]).forEach(h=>{
    const t=triple(h.s,h.w,h.r);
    h.passed.forEach(q=>t.forEach(c=>{ if(!(a[c]&&a[c][q])) set(c,q,'✖'); }));
    if(h.by===p.id && h.card && h.shower){ V.players.forEach(q=>set(h.card,q.id, q.id===h.shower?'✔':'✖')); }
  });
  return a;
}
function noteMarks(){
  const man=noteData(), au=autoMarks(), dead={}, up=V?(V.up||[]):[];
  const get=(c,pid)=> (man[c] && man[c][pid]!=null) ? man[c][pid] : (au[c]&&au[c][pid]) || '';
  CARDS.forEach(c=>{ if(up.includes(c) || (man[c]&&man[c].x) || (V && V.players.some(q=>get(c,q.id)==='✔'))) dead[c]=1; });
  return {get, dead, man};
}
const CYCLE=['', '✖', '✔', '?'];
function noteTap(c, pid){
  const d=noteData(), m=noteMarks(); const now=m.get(c,pid);
  d[c]=d[c]||{}; d[c][pid]=CYCLE[(CYCLE.indexOf(now)+1)%CYCLE.length];
  store(noteKey(), d); renderNotes();
}
function noteStrike(c){ const d=noteData(); d[c]=d[c]||{}; d[c].x=!d[c].x; store(noteKey(), d); renderNotes(); }
function noteClear(){ if(!confirm('¿Borrar todo lo que anotaste a mano en la libreta?')) return; store(noteKey(), undefined); renderNotes(); }
function renderNotes(){
  const el=$('#notaList'); if(!el || !V) return;
  if(V.phase==='lobby'){ setHTML(el, '<p class="muted">La libreta se usa durante el caso.</p>'); return; }
  const ps=V.players, m=noteMarks();
  const head=`<tr><th></th>${ps.map(p=>`<th title="${esc(p.name)}" style="--pc:${p.color}"><span>${esc(p.emoji)}</span><small>${esc(p.name.slice(0,6))}</small></th>`).join('')}</tr>`;
  const sec=(k,t)=>`<tr class="sec"><td colspan="${ps.length+1}">${t}</td></tr>`+CARDS.filter(c=>c[0]===k).map(c=>{
    const x=cardInfo(c);
    return `<tr class="${m.dead[c]?'dead':''}"><td class="cn" onclick="noteStrike('${c}')" title="Tocá para tachar o destachar">${x.e} ${esc(x.n)}${(V.up||[]).includes(c)?' 👁️':''}</td>${ps.map(p=>{ const v=m.get(c,p.id); return `<td class="mk m${CYCLE.indexOf(v)}" onclick="noteTap('${c}','${p.id}')">${v}</td>`; }).join('')}</tr>`;
  }).join('');
  setHTML(el, `<button class="btn green wide backgame only-mobile" onclick="toggleSide(false)">⬅️ Volver al juego</button><p class="muted" style="margin:0 0 6px">Tocá un casillero para anotar: ✖ no la tiene · ✔ la tiene · ? puede ser. Tocá el nombre para tacharlo. ${V.opts.autoNote?'Lo seguro se anota solo.':'Anotás todo vos.'}</p>
    <table class="nota">${head}${sec('s','🧑 ¿Quién?')}${sec('w','🗡️ ¿Con qué?')}${sec('r','🏠 ¿Dónde?')}</table>
    <p class="muted">Lo que no está tachado puede estar en el sobre 📜. La libreta se guarda en este aparato.</p>
    <button class="btn sm gray" onclick="noteClear()">🧽 Borrar lo que anoté a mano</button>
    <button class="btn green wide only-mobile" style="margin-top:10px" onclick="toggleSide(false)">⬅️ Volver al juego</button>`);
}
// solo cambia el contenido si cambió algo (si no, se pierden los toques mientras los bots juegan)
function setHTML(el, h){ if(el._h===h) return; el._h=h; el.innerHTML=h; }

/* ====================== PANEL: jugadas, mesa y reglas ====================== */
function renderSidePanels(){
  if($('#tab-hist').classList.contains('on')) renderHist();
  if($('#tab-nota').classList.contains('on')) renderNotes();
  renderMesaTab(); renderReglasTab();
}
let HIST_N=0;
function renderHist(){
  if(!V) return;
  const L=(V.log||[]).slice().reverse();
  const fresh=L.length-HIST_N; HIST_N=L.length;
  const sus=(V.hist||[]).slice().reverse().map(h=>{ const by=VP(h.by), sh=h.shower&&VP(h.shower);
    return `<tr><td>${esc(by?by.emoji:'')} ${esc(by?by.name:'?')}</td><td>${SUS[h.s].e}${WPN[h.w].e}${ROOMS[h.r].e}</td><td>${h.passed.map(id=>{ const q=VP(id); return q?esc(q.emoji):''; }).join('')||'—'}</td><td>${sh?esc(sh.emoji)+' '+esc(sh.name.slice(0,8)):'nadie'}${h.card?` <b>(${esc(cardName(h.card))})</b>`:''}</td></tr>`; }).join('');
  setHTML($('#histList'), (sus?`<b>🕵️ Sospechas</b><table class="htab"><tr><td class="muted">Quién</td><td class="muted">Qué</td><td class="muted">No tenían</td><td class="muted">Mostró</td></tr>${sus}</table>`:'')
    + `<b>📜 Lo que pasó</b>` + L.map((l,i)=>`<div class="hline ${i<fresh&&fresh<5?'new':''} ${l.acc?'acc':''}"><span class="t">${esc(l.x)}</span></div>`).join(''));
}
function renderMesaTab(){
  const host=amHost(), inPlay=V.phase!=='lobby';
  const ps=V.players.map(p=>{
    const cnt=p.hand?p.hand.length:p.n, offline=!p.bot&&!p.conn;
    return `<div class="prow" style="border-left:5px solid ${p.color}"><span style="font-size:22px">${esc(p.emoji)}</span><span class="nm"><b>${esc(p.name)}${p.id===me()?' (vos)':''}${p.id===V.hostPid&&NET.mode!=='local'?' 👑':''}</b>
      <small>${inPlay?`🃏 ${cnt} cartas`:''}${p.room!=null&&inPlay?` · en ${esc(ROOMS[p.room].n)}`:''}${p.out?' · ❌ afuera':''}${p.bot?' · 🤖 bot':''}${p.mic?' · 🎙️':''}${offline?' · ⚠️ sin conexión':''}${inPlay&&V.players[V.turn]===p&&V.phase==='play'?' · ⏳ su turno':''}</small></span>
      ${p.wins?`<span class="pts">🏆${p.wins}</span>`:''}
      ${host&&p.id!==V.hostPid&&NET.mode!=='local'?`${offline&&inPlay?`<button class="btn sm gray" onclick="doAct({type:'botify',pid:'${p.id}'})" title="Que juegue un bot">🤖</button>`:''}<button class="btn sm gray" onclick="if(confirm('¿Sacar a ${esc(p.name)} de la mesa?'))doAct({type:'kick',pid:'${p.id}'})" title="Sacar">✕</button>`:''}</div>`;
  }).join('');
  const obs=(V.observers||[]).map(o=>`<div class="prow"><span style="font-size:20px">👀</span><span class="nm"><b>${esc(o.name)}${o.id===me()?' (vos)':''}</b><small>mirando${o.mic?' · 🎙️':''}</small></span></div>`).join('');
  const sit = NET.obs && V.phase!=='play' && V.players.length<MAXP ? `<button class="btn gold wide" onclick="doAct({type:'joinNext'})">🪑 Sumarme a jugar</button>` : NET.obs ? `<p class="muted">Te podés sumar cuando termine el caso (si hay lugar).</p>` : '';
  const where = inPlay ? `<p class="muted">Caso ${V.round} · ${(MOVES.find(m=>m.v===V.opts.moves)||{}).t||''}</p>` : '';
  setHTML($('#mesaList'), where + `<b>Pesquisas (${V.players.length}/${MAXP})</b>` + ps + (obs?`<b>Mirando</b>${obs}`:'') + sit
    + `<b>🧑 Sospechosos</b>` + SUS.map((x,i)=>`<div class="prow" style="border-left:5px solid ${x.c}"><span style="font-size:22px">${x.e}</span><span class="nm"><b>${esc(x.n)}</b><small>${esc(x.t)}${inPlay&&V.tokS?` · en ${esc(ROOMS[V.tokS[i]].n)}`:''}</small></span></div>`).join('')
    + (NET.mode!=='local'&&NET.code?`<p class="muted" style="margin-top:12px">Invitá con el código <b>${NET.code}</b> <button class="btn sm" onclick="shareRoom()">📤 Compartir</button></p>`:''));
}
function renderReglasTab(){
  const o=V.opts, on=HOUSE.filter(h=>o[h.k]);
  const host=amHost(), localEdit = NET.mode==='local';
  const lo=Object.assign(defaultOpts(), load('mvk_localopts')||{});
  setHTML($('#reglasList'), `<p style="margin-top:0"><b>${(MOVES.find(m=>m.v===o.moves)||{}).t||''}</b></p>`
    + (localEdit ? `<p class="muted">Lo que cambies acá vale para el próximo caso de práctica.</p><select onchange="setLocalOpt('moves',this.value)">${MOVES.map(t=>`<option value="${t.v}" ${lo.moves===t.v?'selected':''}>${t.t}</option>`).join('')}</select>`
        +HOUSE.map(h=>`<label class="opt" style="font-weight:400"><input type="checkbox" ${lo[h.k]?'checked':''} onchange="setLocalOpt('${h.k}',this.checked)"><span><b>${h.t}</b><small>${h.d}</small></span></label>`).join('')
      : `<b>Reglas de la casa activas</b>` + (on.length ? on.map(h=>`<div class="opt"><span><b>${h.t}</b><small>${h.d}</small></span></div>`).join('') : '<p class="muted">Ninguna: reglas clásicas puras.</p>'))
    + `<b>📝 Reglas propias del grupo</b>` + (V.grules?`<div class="grules" style="margin:6px 0 10px">${esc(V.grules)}</div>`:`<p class="muted">${host&&!localEdit?'Las podés escribir en la sala de espera.':'No hay.'}</p>`)
    + `<b>💡 Sugerencias</b><div style="margin-top:6px">${sugsHTML(host)}</div>
       <div class="row"><input type="text" id="sugIn2" maxlength="240" placeholder="Proponé una regla…" onkeydown="if(event.key==='Enter')sendSug('sugIn2')"><button class="btn sm" style="flex:0 0 auto" onclick="sendSug('sugIn2')">Sugerir</button></div>
       <button class="btn dark wide" style="margin-top:12px" onclick="showRules()">📜 Reglas completas</button>`);
}
function setLocalOpt(k, v){ const o=Object.assign(defaultOpts(), load('mvk_localopts')||{}); o[k]=v; store('mvk_localopts', o); toast('Se usa en el próximo caso de práctica.'); }

// ---------- compartir ----------
function roomLink(){ return location.origin+location.pathname+'#'+NET.code; }
function copyCode(){ navigator.clipboard && navigator.clipboard.writeText(NET.code).then(()=>toast('Código copiado: '+NET.code)); }
function shareRoom(){
  const url=roomLink(), text=`¡Vení a resolver un crimen conmigo en ¿Mávaiko Ojuka? 🕵️🇵🇾 Sala ${NET.code}`;
  if(navigator.share) return navigator.share({title:'¿Mávaiko Ojuka?', text, url}).catch(()=>{});
  modal(`<h2>📤 Invitar a la sala ${NET.code}</h2><p style="word-break:break-all;user-select:all;background:#fff;padding:8px;border-radius:8px">${esc(url)}</p>
    <a class="btn green wide" style="display:block;text-align:center;text-decoration:none" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text+' '+url)}">💬 Mandar por WhatsApp</a>
    <button class="btn wide" style="margin-top:6px" onclick="navigator.clipboard.writeText('${url}').then(()=>toast('Enlace copiado'))">📋 Copiar enlace</button>
    <button class="btn gray wide" style="margin-top:6px" onclick="closeModal()">Cerrar</button>`);
}

/* ====================== VISTA 2D / 3D ====================== */
const VIEW=Object.assign({mode:'2d', tilt:48, spin:0, zoom:.92}, load('mvk_view')||{});
function saveView(){ store('mvk_view', {mode:VIEW.mode, tilt:VIEW.tilt, zoom:VIEW.zoom}); }
function applyView(){
  $('#game').classList.toggle('v3d', VIEW.mode==='3d');
  const m=$('#board'); m.style.setProperty('--tilt', VIEW.tilt+'deg'); m.style.setProperty('--spin', VIEW.spin+'deg'); m.style.setProperty('--zoom', VIEW.zoom);
  $('#btnView').textContent = VIEW.mode==='3d' ? '🗺️ 2D' : '🧊 3D';
}
function toggleView(){
  VIEW.mode = VIEW.mode==='3d' ? '2d' : '3d'; VIEW.spin=0; saveView(); applyView(); fitBoard();
  toast(VIEW.mode==='3d' ? '🧊 Vista 3D: arrastrá el tablero para girarlo. Botones de cámara a la derecha.' : '🗺️ Vista 2D (desde arriba).');
}
function cam(k, d){
  if(k==='spin') VIEW.spin+=d;
  else if(k==='tilt') VIEW.tilt=Math.max(15, Math.min(65, VIEW.tilt+d));
  else if(k==='zoom') VIEW.zoom=Math.max(.5, Math.min(1.6, +(VIEW.zoom+d).toFixed(2)));
  else if(k==='reset'){ VIEW.spin=0; VIEW.tilt=48; VIEW.zoom=.92; }
  saveView(); applyView();
}
const DRAG={on:false, moved:false};
(function(){
  const stage=$('#stage');
  stage.addEventListener('pointerdown', e=>{ DRAG.moved=false; if(VIEW.mode!=='3d' || e.target.closest('.cam3d')) return; Object.assign(DRAG,{on:true, x:e.clientX, y:e.clientY, spin:VIEW.spin, tilt:VIEW.tilt}); });
  window.addEventListener('pointermove', e=>{
    if(!DRAG.on) return; const dx=e.clientX-DRAG.x, dy=e.clientY-DRAG.y;
    if(!DRAG.moved && Math.hypot(dx,dy)<8) return;
    if(!DRAG.moved){ DRAG.moved=true; $('#board').classList.add('dragging'); }
    VIEW.spin=DRAG.spin+dx*.35; VIEW.tilt=Math.max(15, Math.min(65, DRAG.tilt+dy*.15)); applyView();
  });
  window.addEventListener('pointerup', ()=>{ if(!DRAG.on) return; DRAG.on=false; $('#board').classList.remove('dragging'); if(DRAG.moved){ saveView(); setTimeout(()=>DRAG.moved=false, 50); } });
})();

/* ====================== REGLAS ====================== */
function showRules(){
  modal(`<div class="rules"><h2>📜 ¿Mávaiko Ojuka?</h2>
  <p><i>“¿Quién será el que mató?”</i> en guaraní. Es un juego de <b>detectives</b> para <b>2 a 6 pesquisas</b>.</p>
  <h3>🌙 La historia</h3>
  <p>Noche de San Juan en la estancia <b>Ñu Porã</b>. Entre la fogata, el pelotata y la chipa, encontraron muerto a <b>Don Ramón, el patrón</b>. Alguien de la estancia lo hizo, con algo que había a mano, en alguna de las piezas. Ustedes son los pesquisas: ¿quién fue, con qué y dónde?</p>
  <h3>🃏 Las cartas</h3>
  <p><b>6 sospechosos:</b> ${SUS.map(x=>`${x.e} ${esc(x.n)} (${esc(x.t)})`).join(', ')}.</p>
  <p><b>6 armas:</b> ${WPN.map(x=>`${x.e} ${esc(x.n)}`).join(', ')}.</p>
  <p><b>9 lugares:</b> ${ROOMS.map(x=>`${x.e} ${esc(x.n)}`).join(', ')}.</p>
  <p>Al empezar se saca <b>una carta de cada tipo sin que nadie las vea</b> y se guardan en el <b>sobre 📜</b>: esa es la verdad. Las demás se reparten entre todos. Las que tenés vos <b>no</b> están en el sobre.</p>
  <h3>▶️ Tu turno</h3>
  <ul>
    <li>🎲 <b>Tirás los dados</b> y caminás por los corredores de baldosa hasta esa cantidad de pasos (no hace falta usar todos). Para entrar a una pieza llegás a su puerta 🚪.</li>
    <li>👹 <b>Túneles del Pombero:</b> desde la Cocina pasás al Tajamar (y al revés), y desde la Sala al Corral, sin tirar los dados.</li>
    <li>🕵️ <b>Al entrar a una pieza podés sospechar:</b> nombrás un sospechoso y un arma; el lugar es la pieza donde estás. El sospechoso y el arma vienen a esa pieza.</li>
    <li>🤫 Los demás, uno por uno empezando por el de al lado, se fijan si tienen alguna de esas tres cartas. El primero que tenga <b>te muestra una sola, en secreto</b>. Si nadie tiene, ¡puede que hayas dado en el clavo!</li>
    <li>Para volver a sospechar tenés que salir de la pieza y entrar a otra (o volver en otro turno).</li>
  </ul>
  <h3>⚖️ Acusar</h3>
  <p>Cuando estés seguro, en tu turno <b>acusás</b>: quién, con qué y dónde (cualquier lugar). Abrís el sobre solo vos. Si acertaste las tres, <b>ganás</b>. Si no, quedás afuera del caso, pero seguís mostrando tus cartas a los demás.</p>
  <h3>📒 La libreta</h3>
  <p>Anotá lo que vas sabiendo: ✖ no la tiene, ✔ la tiene, ? puede ser. Lo que no está tachado puede estar en el sobre.</p>
  <h3>🏠 Reglas de la casa (opcionales)</h3>
  <p><b>Cómo se camina:</b> ${MOVES.map(m=>m.t).join(' · ')}.</p>
  ${HOUSE.map(h=>`<p><b>${h.t}</b>: ${h.d}</p>`).join('')}
  <p>Además, cada grupo puede escribir sus propias reglas en la sala y todos pueden <b>sugerir reglas nuevas y votarlas 👍</b>.</p>
  <h3>💬 Chat y voz</h3>
  <p>Escribí <b>@nombre</b> (o elegí a alguien en “Para”) para mandarle un <b>mensaje privado</b>. Con 🎤 hablan por voz. Se vale despistar en el chat… pero las cartas no mienten.</p>
  <p class="muted">Juego propio de Juegos PY, inspirado en los juegos de detectives de mesa de siempre. 🎶 ${MUSIC_CREDIT}</p>
  <button class="btn wide" onclick="closeModal()">Entendido</button></div>`);
}

if('serviceWorker' in navigator && location.protocol==='https:') navigator.serviceWorker.register('sw.js').catch(()=>{});
