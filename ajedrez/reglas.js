'use strict';
/* =====================================================================
   Ajedrez y Damas PY — estado de la partida, reloj, tablas, deshacer y
   bots. Todo lo decide el anfitrión; los demás aparatos solo muestran.
   ===================================================================== */
let S=null;
const EMOJIS=['♟️','🧉','🐆','🦜','🐂','🌽','🎻','⚽','🦉','🐊','🌸','🎸','🐎','🦋','🌞','🍉','🧠','👑','🏰','🎩'];
const PCOLORS=['#e63946','#1d70d6'];
const BOT_NAMES=[['Don Peón','🤖'],['Ña Torre','🏰'],['Karai Alfil','🧉'],['Pombero Jaque','👹'],['Kuñataĩ Dama','👸'],['Caballo Loco','🐎']];
const MAXP=2;
const P = id => S && S.players.find(p=>p.id===id);
const OB = id => S && (S.observers||[]).find(o=>o.id===id);
const JUEGOS={ajedrez:'♟️ Ajedrez', damas:'⚪ Damas'};
const COLORES={azar:'🎲 Al azar', host:'⚪ El anfitrión juega con blancas', hostN:'⚫ El anfitrión juega con negras'};
const RACES=[{v:1,t:'Una sola partida'},{v:2,t:'Al mejor de 3 (gana el primero a 2 puntos)'},{v:3,t:'Al mejor de 5 (gana el primero a 3 puntos)'}];
const RELOJES=[
  {v:'none', t:'⏸️ Sin reloj'},
  {v:'1+0',  t:'⚡ Bala: 1 minuto cada uno'},
  {v:'2+1',  t:'⚡ Bala: 2 min + 1 s por jugada'},
  {v:'3+0',  t:'🔥 Blitz: 3 minutos cada uno'},
  {v:'3+2',  t:'🔥 Blitz: 3 min + 2 s por jugada'},
  {v:'5+0',  t:'🔥 Blitz: 5 minutos cada uno'},
  {v:'5+3',  t:'🔥 Blitz: 5 min + 3 s por jugada'},
  {v:'10+0', t:'⏱️ Rápida: 10 minutos cada uno'},
  {v:'10+5', t:'⏱️ Rápida: 10 min + 5 s por jugada'},
  {v:'15+10',t:'⏱️ Rápida: 15 min + 10 s por jugada'},
  {v:'30+0', t:'🐢 Clásica: 30 minutos cada uno'},
  {v:'60+30',t:'🐢 Clásica: 60 min + 30 s por jugada'},
  {v:'custom',  t:'✏️ Personalizado (mismo tiempo para los dos)'},
  {v:'distinto',t:'⚖️ Distinto para cada jugador (con ventaja)'},
  {v:'jugada',  t:'⏳ Tiempo fijo por jugada'},
];
function defaultOpts(){ return {juego:'ajedrez', var:'latina', forz:true, colores:'azar', alterna:true, reloj:'none', min:10, inc:0, minA:10, minB:5, porJug:30, deshacer:true, tablas:true, pistas:false, ayuda:true, race:1}; }

function lobbyState(){
  return {v:1, phase:'lobby', seq:0, players:[], observers:[], hostPid:null, opts:defaultOpts(), grules:'', sugs:[], log:[],
    juego:'ajedrez', pos:null, hist:[], lm:null, col:{w:null,b:null}, clock:null, offer:null, result:null, wins:{}, game:0, startedAt:null};
}
function addPlayer(name, emoji, token, peerId, bot){
  const used=S.players.map(p=>p.color);
  const p={id:'p'+(++S.seq), name:(String(name||'').trim()||'Jugador').slice(0,16), emoji, token, peerId,
    color:PCOLORS.find(c=>!used.includes(c))||PCOLORS[0], conn:!bot, bot:!!bot, mic:false};
  if(bot) p.elo=1200;
  S.players.push(p); return p;
}
function addBot(elo){
  if(S.players.length>=MAXP) return 'Ya hay 2 jugadores. Los demás entran a mirar.';
  const free=BOT_NAMES.filter(([n])=>!S.players.some(p=>p.name===n));
  const [n,e]=free[rnd(free.length)];
  const b=addPlayer(n, e, null, null, true);
  b.elo = Motor.nivel(+elo||load('ajedrez_elo')||1200).elo;
  sysChat(`🤖 ${b.name} (ELO ${b.elo}) se sentó a jugar.`);
}
function log(x){ S.log.push({x, at:Date.now()}); if(S.log.length>200) S.log.splice(0, S.log.length-200); }
function rnd(n){ if(window.crypto && crypto.getRandomValues){ const a=new Uint32Array(1); crypto.getRandomValues(a); return a[0]%n; } return Math.floor(Math.random()*n); }
const other = (st, pid) => (st.players.find(p=>p.id!==pid)||{}).id;
const pname = pid => { const p=P(pid); return p ? p.emoji+' '+p.name : '?'; };
const opc = c => c==='w' ? 'b' : 'w';
const CN = {w:'blancas', b:'negras'};
const M = () => S.juego==='damas' ? Motor.damas : Motor.chess;
const turnOf = st => (st.juego==='damas' ? Motor.damas : Motor.chess).turn(st.pos);
const colorOf = (st, pid) => st.col.w===pid ? 'w' : st.col.b===pid ? 'b' : null;
const dOpts = st => ({var:st.opts.var, forz:st.opts.forz});

/* ---------- reloj ---------- */
function clockFor(o, wPid){
  if(o.reloj==='none') return null;
  let mw, mb, inc=0, per=0;
  if(o.reloj==='custom'){ mw=mb=o.min; inc=o.inc; }
  else if(o.reloj==='distinto'){ const first=S.players[0] && S.players[0].id; const a=o.minA, b=o.minB; mw = wPid===first ? a : b; mb = wPid===first ? b : a; inc=o.inc; }
  else if(o.reloj==='jugada'){ per=o.porJug*1000; }
  else { const [m,i]=o.reloj.split('+').map(Number); mw=mb=m; inc=i; }
  if(per) return {left:{w:per, b:per}, inc:0, per, run:null, since:0};
  return {left:{w:mw*60000, b:mb*60000}, inc:inc*1000, per:0, run:null, since:0};
}
const clockLeft = (k, c) => !k ? null : k.run===c ? k.left[c]-(Date.now()-k.since) : k.left[c];
function clockText(o){
  if(o.reloj==='none') return 'Sin reloj';
  if(o.reloj==='custom') return `${o.min} min${o.inc?` + ${o.inc} s por jugada`:''} cada uno`;
  if(o.reloj==='distinto'){ const a=S&&S.players[0], b=S&&S.players[1]; return `${a?a.name:'Jugador 1'}: ${o.minA} min · ${b?b.name:'Jugador 2'}: ${o.minB} min${o.inc?` · + ${o.inc} s por jugada`:''}`; }
  if(o.reloj==='jugada') return `${o.porJug} segundos por jugada`;
  return (RELOJES.find(r=>r.v===o.reloj)||{}).t||o.reloj;
}

/* ---------- partidas ---------- */
function canStart(){
  if(S.players.length<2) return 'Hacen falta 2 jugadores (podés sumar un bot 🤖).';
  return null;
}
function startGame(first, rematch){
  if(first){ S.game=0; S.wins={}; S.players.forEach(p=>S.wins[p.id]=0); }
  S.game++; S.gid=Date.now().toString(36)+rnd(1000);
  const [a,b]=S.players, h=S.hostPid;
  if((first && !rematch) || !S.opts.alterna || !S.col.w){
    const o=S.opts.colores, hostIn=S.players.some(p=>p.id===h);
    if(o==='host' && hostIn) S.col={w:h, b:other(S,h)};
    else if(o==='hostN' && hostIn) S.col={w:other(S,h), b:h};
    else S.col = rnd(2) ? {w:a.id, b:b.id} : {w:b.id, b:a.id};
  } else S.col={w:S.col.b, b:S.col.w};
  S.juego=S.opts.juego;
  S.pos = S.juego==='damas' ? Motor.damas.start() : Motor.chess.START;
  S.hist=[]; S.lm=null; S.offer=null; S.result=null; S.phase='play'; S.startedAt=Date.now();
  S.clock=clockFor(S.opts, S.col.w);
  log(`${S.juego==='damas'?'⚪':'♟️'} Partida ${S.game}: ${pname(S.col.w)} con blancas, ${pname(S.col.b)} con negras.`);
}
function endGame(w, why){
  if(S.phase!=='play') return;
  if(S.clock && S.clock.run){ const k=S.clock; k.left[k.run]=Math.max(0, clockLeft(k,k.run)); k.run=null; }
  S.offer=null;
  const wp = w ? S.col[w] : null;
  if(wp) S.wins[wp]=(S.wins[wp]||0)+1; else S.players.forEach(p=>S.wins[p.id]=(S.wins[p.id]||0)+.5);
  S.result={w, pid:wp, why, at:Date.now()};
  const need=S.opts.race;
  S.phase = need<=1 || S.players.some(p=>(S.wins[p.id]||0)>=need) ? 'over' : 'gameEnd';
  log(wp ? `🏆 Ganó ${pname(wp)} (${CN[w]}): ${why}.` : `🤝 Tablas: ${why}.`);
}
function applyMove(pid, m){
  const c=turnOf(S);
  if(S.col[c]!==pid) return 'No es tu turno.';
  const r = S.juego==='damas' ? Motor.damas.move(S.pos, m||{}, dOpts(S)) : Motor.chess.move(S.pos, m||{});
  if(!r) return 'Esa jugada no vale.';
  const now=Date.now(), k=S.clock;
  if(k){
    if(k.run===c){ k.left[c]=clockLeft(k,c); if(k.left[c]<=0) return; k.left[c]+=k.inc; }
    if(k.per) k.left[opc(c)]=k.per;
    if(k.run || c==='w') { k.run=opc(c); k.since=now; }
  }
  S.hist.push({pos:S.pos, san:r.san, en:r.en, uci:r.uci, c, lm:{from:r.from, to:r.to, path:r.path||null, caps:r.caps||null}, cap:r.cap||'', at:now});
  S.pos = S.juego==='damas' ? r.pos : r.fen;
  S.lm={from:r.from, to:r.to, path:r.path||null, caps:r.caps||null, castle:!!r.castle, n:S.hist.length};
  if(S.offer && S.offer.k==='undo') S.offer=null;
  if(S.offer && S.offer.k==='draw' && S.offer.by!==pid) S.offer=null;   // jugar es rechazar las tablas
  const st = S.juego==='damas' ? Motor.damas.status(S.pos, S.hist.map(h=>h.pos), dOpts(S)) : Motor.chess.status(S.pos, S.hist.map(h=>h.pos));
  if(st) endGame(st.w, st.why);
}
function undoMoves(n){
  for(let i=0;i<n && S.hist.length;i++){ const h=S.hist.pop(); S.pos=h.pos; }
  const last=S.hist[S.hist.length-1];
  S.lm = last ? Object.assign({n:S.hist.length}, last.lm) : null;
  if(S.clock){ const k=S.clock; if(k.run){ k.left[k.run]=Math.max(1000, clockLeft(k,k.run)); }
    k.run = S.hist.length ? turnOf(S) : null; k.since=Date.now(); if(k.per && k.run) k.left[k.run]=k.per; }
  S.offer=null;
}
// cuántas jugadas hay que volver para que le vuelva a tocar al que pidió
function undoCount(pid){ const c=colorOf(S,pid); if(!c || !S.hist.length) return 0; const t=turnOf(S); return t===c ? Math.min(2, S.hist.length) : 1; }

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
    case 'joinNext': {
      const o=OB(pid); if(!o) return;
      if(S.phase!=='lobby' && S.phase!=='over') return 'Esperá a que termine la partida para sentarte.';
      if(S.players.length>=MAXP) return 'Ya hay 2 jugadores. Si el anfitrión saca a un bot, te podés sentar.';
      if(o.owner) return;
      S.observers=S.observers.filter(x=>x!==o);
      const np=addPlayer(o.name, o.emoji==='👀'?EMOJIS.find(e=>!S.players.some(q=>q.emoji===e)):o.emoji, o.token, o.peerId);
      np.conn=o.conn;
      if(S.phase==='over') S.phase='lobby';
      if(typeof onSeatChange==='function') onSeatChange(pid, np.id);
      sysChat(`🪑 ${np.name} se sentó a jugar.`); commit(); return;
    }
  }
  if(!p) return;
  const host = pid===S.hostPid || NET.mode==='local';
  switch(a.type){
    case 'addBot': if(!host||S.phase!=='lobby') return; { const r=addBot(a.elo); if(r) return r; } commit(); return;
    case 'botElo': {
      if(!host) return; const t=P(a.pid); if(!t || !t.bot) return;
      if(S.phase==='play' && turnOf(S) && S.col[turnOf(S)]===t.id && BOT.busy) return 'Esperá que el bot termine de pensar.';
      t.elo=Motor.nivel(+a.elo).elo; store('ajedrez_elo', t.elo);
      sysChat(`🤖 ${t.name} ahora juega con ELO ${t.elo} (${Motor.nivel(t.elo).n}).`); commit(); return;
    }
    case 'kick': {
      if(!host) return; const t=P(a.pid); if(!t || t.id===S.hostPid) return;
      removePlayer(t, `🚪 ${t.name} salió de la mesa.`); commit(); return;
    }
    case 'botify': {
      if(!host) return; const t=P(a.pid); if(!t || t.bot) return;
      t.bot=true; t.conn=false; t.mic=false; t.token=null; t.elo=t.elo||1400; sysChat(`🤖 Un bot sigue jugando por ${t.name}.`); commit(); return;
    }
    case 'opt': {
      if(!host || S.phase!=='lobby') return;
      const o=S.opts, num=(v,lo,hi,d)=>{ const n=Math.round(+v); return isFinite(n) ? Math.max(lo,Math.min(hi,n)) : d; };
      if(a.k==='juego' && JUEGOS[a.v]) o.juego=a.v;
      else if(a.k==='var' && Motor.damas.VAR[a.v]) o.var=a.v;
      else if(a.k==='colores' && COLORES[a.v]) o.colores=a.v;
      else if(a.k==='reloj' && RELOJES.some(r=>r.v===a.v)) o.reloj=a.v;
      else if(a.k==='race') o.race=num(a.v,1,3,1);
      else if(a.k==='min') o.min=num(a.v,1,180,10);
      else if(a.k==='minA') o.minA=num(a.v,1,180,10);
      else if(a.k==='minB') o.minB=num(a.v,1,180,5);
      else if(a.k==='inc') o.inc=num(a.v,0,60,0);
      else if(a.k==='porJug') o.porJug=num(a.v,5,600,30);
      else if(['forz','alterna','deshacer','tablas','pistas','ayuda'].includes(a.k)) o[a.k]=!!a.v;
      else return;
      S.juego=o.juego; commit(); return;
    }
    case 'grules': if(!host) return; S.grules=String(a.text||'').slice(0,1200); commit(); return;
    case 'sugDel': if(!host) return; S.sugs=S.sugs.filter(s=>s.id!==a.id); commit(); return;
    case 'start': {
      if(!host || S.phase!=='lobby') return;
      const r=canStart(); if(r) return r;
      startGame(true); sysChat(`${S.juego==='damas'?'⚪':'♟️'} ¡Empieza la partida de ${S.juego==='damas'?'damas':'ajedrez'}! ${clockText(S.opts)}.`); commit(); return;
    }
    case 'next': if(!host || S.phase!=='gameEnd') return; startGame(false); commit(); return;
    case 'rematch': if(!host || S.phase!=='over') return; startGame(true, true); sysChat('🔁 ¡Revancha!'); commit(); return;
    case 'newGame': if(!host) return;
      S.phase='lobby'; S.pos=null; S.hist=[]; S.lm=null; S.result=null; S.offer=null; S.clock=null; commit(); return;
    case 'leave': {
      if(S.phase==='lobby' || S.phase==='over') removePlayer(p, `🚪 ${p.name} se fue.`);
      else { p.bot=true; p.conn=false; p.mic=false; p.token=null; p.elo=p.elo||1400; sysChat(`🚪 ${p.name} se fue: un bot 🤖 sigue por él.`); }
      commit(); return;
    }
    case 'move': {
      if(S.phase!=='play') return;
      const r=applyMove(pid, a.m); if(typeof r==='string') return r;
      commit(); return;
    }
    case 'resign': {
      if(S.phase!=='play') return; const c=colorOf(S,pid); if(!c) return;
      endGame(opc(c), `${p.name} abandonó`); commit(); return;
    }
    case 'offer': {
      if(S.phase!=='play' || !colorOf(S,pid)) return;
      if(a.k==='draw' && !S.opts.tablas) return 'En esta mesa no se ofrecen tablas.';
      if(a.k==='undo'){ if(!S.opts.deshacer) return 'En esta mesa no se puede deshacer.'; if(!undoCount(pid)) return 'Todavía no hay nada para deshacer.'; }
      if(!['draw','undo'].includes(a.k)) return;
      if(S.offer) return 'Ya hay un pedido esperando respuesta.';
      // contra un bot en este aparato, deshacer es al instante
      if(a.k==='undo' && NET.mode==='local' && P(other(S,pid)).bot){ undoMoves(undoCount(pid)); log(`↩️ ${p.name} deshizo su jugada.`); commit(); return; }
      S.offer={k:a.k, by:pid, at:Date.now()};
      log(a.k==='draw' ? `🤝 ${p.name} ofrece tablas.` : `↩️ ${p.name} pide deshacer su última jugada.`);
      commit(); return;
    }
    case 'reply': {
      const o=S.offer; if(!o || o.by===pid || S.phase!=='play' || !colorOf(S,pid)) return;
      if(!a.ok){ S.offer=null; log(`🙅 ${p.name} dijo que no${o.k==='draw'?' a las tablas':' a deshacer'}.`); commit(); return; }
      if(o.k==='draw'){ endGame(null, 'de común acuerdo'); }
      else { const n=undoCount(o.by); undoMoves(n); log(`↩️ ${p.name} aceptó: se deshizo ${n===2?'la última jugada de cada uno':'la última jugada'}.`); }
      commit(); return;
    }
    case 'cancelOffer': if(S.offer && S.offer.by===pid){ S.offer=null; commit(); } return;
  }
}
function removePlayer(t, msg){
  if(S.phase==='lobby' || S.phase==='over'){ S.players=S.players.filter(x=>x!==t); }
  else { t.bot=true; t.conn=false; t.token=null; t.elo=t.elo||1400; }
  if(NET.mode==='host' && NET.conns[t.id]){ try{ NET.conns[t.id].send({t:'kicked'}); }catch(e){} }
  sysChat(msg);
}

/* ---------- se acabó el tiempo (lo mira el anfitrión) ---------- */
setInterval(()=>{
  if(!S || NET.mode==='client' || S.phase!=='play' || !S.clock || !S.clock.run) return;
  const k=S.clock, c=k.run;
  if(clockLeft(k,c)>0) return;
  k.left[c]=0;
  const win=opc(c), loser=P(S.col[c]);
  const can = S.juego==='damas' ? true : Motor.chess.canMate(S.pos, win);
  if(can) endGame(win, `a ${loser?loser.name:CN[c]} se le acabó el tiempo`);
  else endGame(null, `se acabó el tiempo de ${loser?loser.name:CN[c]}, pero el rival no tiene con qué dar mate`);
  commit();
}, 200);

/* ====================== BOTS ====================== */
const BOT={busy:false};
const BOT_TALK={
  hi:['¡Suerte! 🍀','Dale nomás, mové 😎','A ver qué sabés 🧉'],
  win:['¡Gané! 😎','Buena partida 🤝','¿Otra? 😏'],
  lose:['Uff, me ganaste 👏','Bien jugado 🤝','La próxima te gano 😤'],
};
const pick = a => a[rnd(a.length)];
const autoPlays = p => p && (p.bot || (!p.conn && p.offAt && Date.now()-p.offAt>30000));
function botTick(){
  if(!S || NET.mode==='client' || BOT.busy || S.phase!=='play') return;
  // ¿le pidieron algo a un bot?
  if(S.offer){
    const to=P(other(S, S.offer.by));
    if(autoPlays(to)){
      const o=S.offer; BOT.busy=true;
      setTimeout(()=>{ BOT.busy=false; if(!S || S.offer!==o) return;
        let ok=true;
        if(o.k==='draw'){ const ev=M().eval(S.pos, dOpts(S)), mine=colorOf(S,to.id)==='w'?ev:-ev; ok = mine < -150 || (Math.abs(mine)<40 && S.hist.length>60); }
        act(to.id, {type:'reply', ok});
        if(to.bot) botChat(to, ok ? (o.k==='draw'?'Dale, tablas 🤝':'Bueno, volvé a jugar 😉') : 'No, seguimos jugando 😏');
      }, 1200);
      return;
    }
  }
  const c=turnOf(S), pid=S.col[c], b=P(pid);
  if(!autoPlays(b)) return;
  BOT.busy=true;
  const key=S.pos+'|'+S.hist.length, t0=Date.now(), elo=b.bot ? (b.elo||1200) : 1400;
  let ms=null;
  if(S.clock){ const left=clockLeft(S.clock,c); ms = S.clock.per ? left*.4 : left/30 + S.clock.inc*.7; }
  const req = S.juego==='damas'
    ? {kind:'damas', pos:S.pos, hist:S.hist.map(h=>h.pos), opts:dOpts(S), elo, ms}
    : {kind:'chess', fen:S.pos, hist:S.hist.map(h=>h.pos), uci:S.hist.map(h=>h.uci), elo, ms};
  Motor.ask(req, mv=>{
    const wait=Math.max(0, (S && S.clock ? 250 : 600+rnd(500)) - (Date.now()-t0));
    setTimeout(()=>{
      BOT.busy=false;
      if(!S || S.phase!=='play' || S.pos+'|'+S.hist.length!==key || !mv) return;
      act(pid, {type:'move', m:mv});
      if(b.bot && S.phase!=='play' && S.result) setTimeout(()=>botChat(b, pick(S.result.pid===b.id?BOT_TALK.win:BOT_TALK.lose)), 900);
      else if(b.bot && S.hist.length<=2 && rnd(3)===0) setTimeout(()=>botChat(b, pick(BOT_TALK.hi)), 700);
    }, wait);
  });
}
setInterval(botTick, 300);
function botPrivate(bot, from){
  setTimeout(()=>{ if(!S) return; addChat(bot.id, pick(['Shhh, estoy pensando 🤔','Jaja, concentrate en el tablero 😏','No te voy a decir mi jugada 🤫']), from.id); }, 1200+rnd(1500));
}
