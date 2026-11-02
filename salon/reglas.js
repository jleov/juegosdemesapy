'use strict';
/* =====================================================================
   Salón de Belleza PY — estado de la sala, clientes, reloj, puntaje y
   acciones. Todo lo decide el anfitrión; los demás aparatos solo muestran
   (y adelantan en su pantalla lo que hacen con las herramientas).
   ===================================================================== */
let S=null;
const EMOJIS=['💇','💅','💄','✂️','🧉','🌸','🌼','🦜','🐆','👑','🎀','🪮','🌺','🦋','🐊','💈','⭐','🍉','🎻','🧴'];
const PCOLORS=['#e6398c','#1d70d6'];
const MAXP=2;
const P = id => S && S.players.find(p=>p.id===id);
const OB = id => S && (S.observers||[]).find(o=>o.id===id);
const MODOS={juntos:'🤝 Juntos (atienden al mismo cliente)', duelo:'⚔️ Duelo de estilistas (cada uno el suyo)', libre:'🎨 Libre (sin pedido ni reloj)'};
const TIEMPOS=[{v:0,t:'⏸️ Sin reloj'},{v:120,t:'⚡ 2 minutos por cliente'},{v:180,t:'⏱️ 3 minutos por cliente'},{v:300,t:'⏱️ 5 minutos por cliente'},{v:480,t:'🐢 8 minutos por cliente'},{v:720,t:'🐢 12 minutos por cliente'}];
const CLIENTES=[{v:1,t:'1 cliente'},{v:3,t:'3 clientes'},{v:5,t:'5 clientes (un día de trabajo)'},{v:8,t:'8 clientes (día largo)'}];
function defaultOpts(){ return {modo:'juntos', clientes:3, tiempo:300, ayuda:true, charla:true}; }

function lobbyState(){
  return {v:1, phase:'lobby', seq:0, players:[], observers:[], hostPid:null, opts:defaultOpts(), grules:'', sugs:[], log:[],
    n:0, cl:{}, req:null, endAt:null, turn:null, done:[], res:null, votes:{}, money:{}, stars:{}, caja:0, served:[], used:[], say:{}, startedAt:null};
}
function addPlayer(name, emoji, token, peerId){
  const used=S.players.map(p=>p.color);
  const p={id:'p'+(++S.seq), name:(String(name||'').trim()||'Jugador').slice(0,16), emoji, token, peerId,
    color:PCOLORS.find(c=>!used.includes(c))||PCOLORS[0], conn:true, mic:false};
  S.players.push(p); return p;
}
function log(x){ S.log.push({x, at:Date.now()}); if(S.log.length>200) S.log.splice(0, S.log.length-200); }
function rnd(n){ if(window.crypto && crypto.getRandomValues){ const a=new Uint32Array(1); crypto.getRandomValues(a); return a[0]%n; } return Math.floor(Math.random()*n); }
const pname = pid => { const p=P(pid); return p ? p.emoji+' '+p.name : '?'; };
const isDuel = st => st.opts.modo==='duelo';
const isLibre = st => st.opts.modo==='libre';
const keysOf = st => isDuel(st) ? st.players.map(p=>p.id).filter(id=>st.cl[id]) : ['all'];
const hotseatS = st => NET.mode==='local' && st.players.length===2;
function keyFor(st, pid){ return isDuel(st) ? pid : 'all'; }
function canEdit(st, pid, key){
  if(st.phase!=='play' || !st.cl[key] || !st.players.some(p=>p.id===pid)) return false;
  if(!isDuel(st)) return key==='all';
  if(key!==pid || st.done.includes(pid)) return false;
  if(hotseatS(st) && st.turn!==pid) return false;
  return true;
}

/* ---------- clientes ---------- */
function startClient(){
  S.n++;
  const libre=isLibre(S);
  S.req = libre ? null : newPedido(S.used);
  if(S.req){ S.used.push(S.req.who); if(S.used.length>PEDIDOS.length-3) S.used.splice(0, 5); }
  const base=newClient(S.req ? S.req.tpl : null);
  // que lo pedido no esté hecho de entrada (si pide rulos, que no venga con rulos)
  if(S.req) for(const t of S.req.tasks) if(t.k==='rizo') base.hair.forEach(h=>{ if(Math.abs(h.cu-t.cu)<.5) h.cu = t.cu===0 ? 1 : 0; });
  if(S.req) delete S.req.tpl;
  S.cl={};
  if(isDuel(S)) S.players.forEach(p=>S.cl[p.id]=cloneClient(base)); else S.cl.all=base;
  S.done=[]; S.res=null; S.votes={}; S.say={};
  S.turn = isDuel(S) && hotseatS(S) ? S.players[0].id : null;
  S.endAt = !libre && S.opts.tiempo ? Date.now()+S.opts.tiempo*1000 : null;
  S.phase='play'; S.startedAt=S.startedAt||Date.now(); S.clientAt=Date.now();
  const who = S.req ? `${S.req.e} ${S.req.who}` : `${base.e} ${base.name}`;
  log(`🚪 Llega ${who}${S.req?': '+S.req.story:''}`);
  for(const k of keysOf(S)) speak(k, S.req ? pickR(['¡Buenas! 😊','Mba\'éichapa! 👋','¡Hola, hola! Vengo con apuro 😅','¡Buen día! Ojalá me atiendan rapidito']) : '¡Hola! Hacé lo que quieras conmigo 😄', true);
}
function finishClient(){
  if(S.phase!=='play') return;
  S.res={}; S.endAt=null;
  for(const k of keysOf(S)){
    const r=evalClient(S.cl[k], S.req, isLibre(S)); S.res[k]=r;
    const earn=r.pay+r.tip;
    if(k==='all'){ S.caja+=earn; S.players.forEach(p=>{ S.money[p.id]=(S.money[p.id]||0)+earn; (S.stars[p.id]=S.stars[p.id]||[]).push(r.stars); }); }
    else { S.money[k]=(S.money[k]||0)+earn; (S.stars[k]=S.stars[k]||[]).push(r.stars); }
  }
  let win=null;
  if(isDuel(S)){
    const ks=keysOf(S); if(ks.length===2){ const [a,b]=ks; const sa=S.res[a].score, sb=S.res[b].score; win = Math.abs(sa-sb)<.005 ? null : sa>sb ? a : b; }
    S.res.win=win;
  }
  const c0=S.cl[keysOf(S)[0]];
  S.served.push({n:S.n, who:S.req?S.req.who:c0.name, e:S.req?S.req.e:c0.e, stars:keysOf(S).map(k=>({k, st:S.res[k].stars, earn:S.res[k].pay+S.res[k].tip})), win});
  log(isDuel(S) ? (win ? `🏆 ${pname(win)} atendió mejor a ${S.served[S.served.length-1].who}.` : '🤝 ¡Empate!') : `⭐ ${S.served[S.served.length-1].who}: ${'⭐'.repeat(S.res.all.stars)} · ${gs(S.res.all.pay+S.res.all.tip)}`);
  S.phase='review';
}
function speak(key, x, force){
  if(!S || (!force && !S.opts.charla)) return;
  const now=Date.now(), last=S.say[key];
  if(!force && last && now-last.at<6000) return;
  S.say[key]={x:String(x).slice(0,140), at:now};
}

/* ====================== ACCIONES ====================== */
function act(pid, a){
  if(!S || !a) return;
  const p=P(pid);
  switch(a.type){
    case 'mic': { const w=p||OB(pid); if(w){ w.mic=!!a.on; commit(); } return; }
    case 'suggest': {
      const t=String(a.text||'').trim().slice(0,240); if(!t) return 'Escribí la regla que querés sugerir.';
      const w=p||OB(pid); if(!w) return;
      S.sugs.push({id:'s'+(++S.seq), by:w.name, e:w.emoji, text:t, votes:[pid]}); if(S.sugs.length>40) S.sugs.shift();
      sysChat(`💡 ${w.name} sugirió una regla: “${t}”`); commit(); return;
    }
    case 'vote': {
      const s=S.sugs.find(x=>x.id===a.id); if(!s) return;
      s.votes = s.votes.includes(pid) ? s.votes.filter(x=>x!==pid) : s.votes.concat(pid); commit(); return;
    }
    case 'like': {   // voto del público en el duelo
      if(S.phase!=='review' || !isDuel(S) || !S.cl[a.key] || a.key===pid) return;
      S.votes[pid]=a.key; commit(); return;
    }
    case 'joinNext': {
      const o=OB(pid); if(!o) return;
      if(S.phase!=='lobby' && S.phase!=='over') return 'Esperá a que termine para sentarte.';
      if(S.players.length>=MAXP) return 'Ya hay 2 estilistas.';
      if(o.owner) return;
      S.observers=S.observers.filter(x=>x!==o);
      const np=addPlayer(o.name, o.emoji==='👀'?EMOJIS.find(e=>!S.players.some(q=>q.emoji===e)):o.emoji, o.token, o.peerId);
      np.conn=o.conn;
      if(S.phase==='over') S.phase='lobby';
      if(typeof onSeatChange==='function') onSeatChange(pid, np.id);
      sysChat(`🪑 ${np.name} se puso el delantal para atender.`); commit(); return;
    }
  }
  if(!p) return;
  const host = pid===S.hostPid || NET.mode==='local';
  switch(a.type){
    case 'tool': {
      const key=a.key, c=S.cl[key];
      if(!canEdit(S, pid, key)) return;
      const T=TOOLS[a.tool]; if(!T && a.tool!=='peinar' && a.tool!=='acc') return;
      const r=applyTool(c, a);
      if(r.err){ commitSoon(); return r.err; }
      // lo que dice el cliente mientras lo atienden
      if(r.ouch) speak(key, pickR(a.tool==='navaja'?['¡Ay, me raspa! 😣','¡Sin espuma no, por favor! 😖']:SAY.pinza));
      else if(SAY[a.tool] && Math.random()<.2) speak(key, pickR(SAY[a.tool]));
      else if(r.style && Math.random()<.6) speak(key, pickR(['¡Qué lindo peinado! 😍','¡Ay, me encanta! 💖','A ver, a ver… 🤔']));
      if(r.cut && S.req && !S.req.tasks.some(t=>t.k==='corte') && Math.random()<.5) speak(key, '¡Epa! ¡Yo no te pedí corte! 😱');
      commitSoon(); return;
    }
    case 'listo': {
      if(S.phase!=='play' || !S.players.some(x=>x.id===pid)) return;
      if(!isDuel(S)){ finishClient(); commit(); return; }
      const who = hotseatS(S) ? S.turn : pid;
      if(!S.cl[who] || S.done.includes(who)) return;
      S.done.push(who); log(`✅ ${pname(who)} terminó.`);
      const left=keysOf(S).filter(k=>!S.done.includes(k));
      if(!left.length) finishClient();
      else if(hotseatS(S)){ S.turn=left[0]; S.endAt=S.opts.tiempo ? Date.now()+S.opts.tiempo*1000 : null; S.handoff=Date.now(); }
      commit(); return;
    }
    case 'newClient': {   // en el modo libre: otro cliente cuando quieran
      if(!isLibre(S) || (S.phase!=='play' && S.phase!=='review')) return;
      S.n++; S.cl={all:newClient({sex:a.sex==='m'?'m':a.sex==='f'?'f':undefined, age:a.age==='mayor'?'mayor':a.age==='joven'?'joven':undefined})};
      S.phase='play'; S.res=null; S.say={}; speak('all','¡Hola! Hacé lo que quieras conmigo 😄', true); commit(); return;
    }
    case 'next': {
      if(!host || S.phase!=='review') return;
      if(isLibre(S) || S.n<S.opts.clientes) startClient(); else { S.phase='over'; log('🏁 ¡Se terminó el día en el salón!'); }
      commit(); return;
    }
    case 'kick': {
      if(!host) return; const t=P(a.pid); if(!t || t.id===S.hostPid) return;
      removePlayer(t, `🚪 ${t.name} salió del salón.`); commit(); return;
    }
    case 'opt': {
      if(!host || S.phase!=='lobby') return;
      const o=S.opts;
      if(a.k==='modo' && MODOS[a.v]) o.modo=a.v;
      else if(a.k==='tiempo' && TIEMPOS.some(t=>t.v===+a.v)) o.tiempo=+a.v;
      else if(a.k==='clientes' && CLIENTES.some(t=>t.v===+a.v)) o.clientes=+a.v;
      else if(['ayuda','charla'].includes(a.k)) o[a.k]=!!a.v;
      else return;
      commit(); return;
    }
    case 'grules': if(!host) return; S.grules=String(a.text||'').slice(0,1200); commit(); return;
    case 'sugDel': if(!host) return; S.sugs=S.sugs.filter(s=>s.id!==a.id); commit(); return;
    case 'start': {
      if(!host || S.phase!=='lobby') return;
      if(isDuel(S) && S.players.length<2) return 'Para el duelo hacen falta 2 estilistas (o elegí “Juntos” para atender solo/a).';
      S.n=0; S.money={}; S.stars={}; S.caja=0; S.served=[]; S.startedAt=Date.now();
      S.players.forEach(x=>{ S.money[x.id]=0; S.stars[x.id]=[]; });
      startClient();
      sysChat(`💇 ¡Se abre el salón! ${MODOS[S.opts.modo]}${isLibre(S)?'':` · ${S.opts.clientes} cliente${S.opts.clientes>1?'s':''}`}.`);
      commit(); return;
    }
    case 'rematch': if(!host || S.phase!=='over') return; S.phase='lobby'; act(pid, {type:'start'}); sysChat('🔁 ¡Otro día en el salón!'); return;
    case 'newGame': if(!host) return;
      S.phase='lobby'; S.cl={}; S.req=null; S.res=null; S.endAt=null; commit(); return;
    case 'leave': {
      removePlayer(p, `🚪 ${p.name} se fue.`);
      commit(); return;
    }
  }
}
function removePlayer(t, msg){
  S.players=S.players.filter(x=>x!==t);
  if(S.phase==='play' && isDuel(S)){ delete S.cl[t.id]; S.done=S.done.filter(x=>x!==t.id); if(!keysOf(S).filter(k=>!S.done.includes(k)).length && keysOf(S).length) finishClient(); }
  if(S.hostPid===t.id && S.players[0]) S.hostPid=S.players[0].id;
  if(NET.mode==='host' && NET.conns[t.id]){ try{ NET.conns[t.id].send({t:'kicked'}); }catch(e){} }
  sysChat(msg);
}

/* ---------- reloj y charla del cliente (lo mira el anfitrión) ---------- */
setInterval(()=>{
  if(!S || NET.mode==='client' || S.phase!=='play') return;
  if(S.endAt && Date.now()>S.endAt){
    if(isDuel(S)){
      const left=keysOf(S).filter(k=>!S.done.includes(k));
      if(hotseatS(S) && left.length>1){ S.done.push(S.turn); log(`⏰ Se le acabó el tiempo a ${pname(S.turn)}.`); S.turn=left.find(k=>k!==S.turn); S.endAt=S.opts.tiempo?Date.now()+S.opts.tiempo*1000:null; S.handoff=Date.now(); commit(); return; }
    }
    log('⏰ ¡Se acabó el tiempo!'); finishClient(); commit(); return;
  }
  if(S.opts.charla && Math.random()<.04){
    const k=pickR(keysOf(S)), last=S.say[k];
    if(!last || Date.now()-last.at>18000){ speak(k, pickR(CHARLA)); commitSoon(); }
  }
}, 500);
