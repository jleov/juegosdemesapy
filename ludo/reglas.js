'use strict';
/* =====================================================================
   Ludo PY — el tablero en cruz (4 colores) o en estrella (6 colores),
   las reglas reales, las reglas de la casa y los bots.
   Todo lo decide el anfitrión (o el propio aparato en la práctica):
   act(pid, accion) cambia el estado S y devuelve un texto si no se puede.
   ===================================================================== */
function rnd(n){ if(window.crypto && crypto.getRandomValues){ const a=new Uint32Array(1); crypto.getRandomValues(a); return a[0]%n; } return Math.floor(Math.random()*n); }

/* ---------- colores de cada brazo del tablero ---------- */
const COLS4 = [
  {n:'Rojo',     hex:'#d52b1e', dark:'#7d1009', soft:'#ffd6d1'},
  {n:'Verde',    hex:'#1f9a46', dark:'#0b4d20', soft:'#d3f2dc'},
  {n:'Amarillo', hex:'#f2b705', dark:'#8a6400', soft:'#fff1bf'},
  {n:'Azul',     hex:'#1d4fd8', dark:'#0a2470', soft:'#d6e1ff'},
];
const COLS6 = [
  COLS4[0],
  {n:'Naranja',  hex:'#ef7d12', dark:'#82400a', soft:'#ffe2c7'},
  COLS4[2],
  COLS4[1],
  COLS4[3],
  {n:'Violeta',  hex:'#8a3fb8', dark:'#45155f', soft:'#ecd8f7'},
];
const colsOf = N => N===6 ? COLS6 : COLS4;

/* ---------- el recorrido ----------
   Cada brazo tiene 3 columnas de 6 casillas. El camino de todos usa las dos de afuera
   y la punta del medio (13 casillas por brazo: 52 con 4 colores, 78 con 6); la columna
   del medio es el pasillo final de ese color, que lleva a la meta del centro.
   El avance de una ficha se cuenta desde su salida: 0 = la salida, … , last = la punta
   de su brazo, home0..home0+4 = su pasillo, goal = la meta. -1 = en casa. */
function geo(N){
  const L=13*N;
  return {N, L, last:L-2, home0:L-1, goal:L+4, a:1.5/Math.tan(Math.PI/N)};
}
const gIdx = (arm, p, N) => (13*arm + 8 + p) % (13*N);     // casilla del camino común
const isStart = g => g%13===8;                              // la salida de cada color
const isStar  = g => g%13===3;                              // la estrella, 8 casillas después de cada salida
const isSafeG = g => isStart(g) || isStar(g);

/* ---------- reglas de la casa (las elige el anfitrión en la sala) ---------- */
const EXITS = [{v:'6', t:'🎲 Se sale de casa con 6 (clásico)'},{v:'16', t:'🎲 Se sale con 1 o con 6'},{v:'5', t:'🎲 Se sale con 5'}];
const BONUS = [{v:'turno', t:'🎁 Comer o llegar a la meta da otra tirada (clásico)'},{v:'20', t:'🎁 Comer cuenta 20 y llegar cuenta 10'},{v:'nada', t:'🎁 Sin premio al comer ni al llegar'}];
const PIECES = [{v:4, t:'4 fichas cada uno (clásico)'},{v:3, t:'3 fichas (partida más corta)'},{v:2, t:'2 fichas (partida rápida)'}];
const MODES = [{v:'solo', t:'Cada uno para sí'},{v:'equipos', t:'Equipos 2 contra 2 (4 jugadores, el compañero enfrente)'}];
const BOARDS = [{v:'auto', t:'Tablero de 4 colores (de 5 o 6 jugadores, el de 6)'},{v:'6', t:'Tablero de 6 colores, siempre'}];
const HOUSE = [
  {k:'blocks',   def:true,  t:'🧱 Bloqueos', d:'Dos fichas del mismo color en una casilla del camino hacen un bloqueo: nadie de otro color puede pasar ni caer ahí. Además, en cada casilla del camino entran como mucho 2 fichas.'},
  {k:'exact',    def:true,  t:'🎯 Entrar a la meta con el número justo', d:'Para meter una ficha en la meta hace falta sacar justo lo que le falta. Desmarcado: con cualquier número que alcance o se pase, entra.'},
  {k:'forceCap', def:false, t:'🍽️ Comer es obligatorio', d:'Si con la tirada podés comer una ficha, tenés que hacerlo.'},
  {k:'triple6',  def:true,  t:'🚫 Tres 6 seguidos pierde el turno', d:'Con 6 se vuelve a tirar, pero el que saca tres 6 seguidos pierde el turno.'},
  {k:'playOn',   def:true,  t:'🥈 Seguir jugando por el 2º y 3º puesto', d:'Cuando uno mete sus fichas, los demás siguen hasta que quede uno solo. Desmarcado: termina con el primero que gana.'},
  {k:'auto',     def:true,  t:'🪄 Si hay una sola jugada, se mueve sola', d:'Para no perder tiempo: cuando hay una sola ficha que se puede mover, se mueve sola.'},
];
function defaultOpts(){ const o={exit:'6', bonus:'turno', pieces:4, mode:'solo', board:'auto'}; HOUSE.forEach(h=>o[h.k]=h.def); return o; }
const exitOk = v => S.opts.exit==='16' ? (v===6||v===1) : S.opts.exit==='5' ? v===5 : v===6;
const exitTxt = o => o.exit==='16' ? '1 o 6' : o.exit==='5' ? '5' : '6';

/* ---------- estado ---------- */
let S=null;
const EMOJIS = ['🧉','🥯','🐆','🌸','🎻','⚽','🐂','🌽','🦜','🐊','🦩','🍖','🌵','🎸','🐎','🦋','🌞','🍉','🐒','🦉'];
const PCOLORS = ['#d52b1e','#1f9a46','#f2b705','#1d4fd8','#8a3fb8','#ef7d12'];
const TCOLORS = ['#d52b1e','#1d4fd8'];
const BOT_NAMES = [['Ña Chipa','🥯'],['Karai Tereré','🧉'],['Don Jaguareté','🐆'],['Ña Lapacho','🌸'],['Pombero','👹'],['Kuñataĩ Mbejú','🌽'],['Che Ra\'a','🐂'],['Ña Ñandutí','🦋'],['Don Arpa','🎻'],['Pora','🦉'],['Karai Sopa','🍲'],['Ña Polca','💃']];
const MAXP = 6;
const P = id => S && S.players.find(p=>p.id===id);
const OB = id => S && (S.observers||[]).find(o=>o.id===id);
const cur = () => S.players[S.turn];
const DICE_FACES = ['','⚀','⚁','⚂','⚃','⚄','⚅'];

function lobbyState(){
  return {v:1, phase:'lobby', seq:0, players:[], observers:[], hostPid:null, opts:defaultOpts(),
    grules:'', sugs:[], log:[], ev:[], evSeq:0, N:4, turn:0, tp:'roll', dice:0, sixes:0, extra:false,
    moves:[], bonusQ:[], bonusN:0, places:[], winner:null, turnAt:0, busyUntil:0};
}
function addPlayer(name, emoji, token, peerId, bot){
  const used=S.players.map(p=>p.color);
  const p={id:'p'+(++S.seq), name:(String(name||'').trim()||'Jugador').slice(0,16), emoji, token, peerId,
    color:PCOLORS.find(c=>!used.includes(c))||PCOLORS[S.players.length%PCOLORS.length],
    conn:!bot, bot:!!bot, mic:false, arm:null, pz:[], team:null, done:false, place:0, caps:0, lost:0, sixes:0};
  S.players.push(p); return p;
}
function addBot(){
  if(S.players.length>=MAXP) return 'Ya son 6 jugadores (el máximo del Ludo).';
  const free=BOT_NAMES.filter(([n])=>!S.players.some(p=>p.name===n));
  const [n,e]=free.length?free[rnd(free.length)]:['Bot '+(S.players.length+1),'🤖'];
  const b=addPlayer(n, e, null, null, true);
  sysChat(`🤖 ${b.name} se sentó a la mesa.`);
}
function log(x, extra){ S.log.push(Object.assign({x, at:Date.now()}, extra||{})); if(S.log.length>260) S.log.splice(0, S.log.length-260); }
function ev(k, o){ S.ev.push(Object.assign({i:++S.evSeq, k, at:Date.now()}, o||{})); if(S.ev.length>14) S.ev.shift(); }

/* ---------- lugares en el tablero ---------- */
// qué tablero y qué brazos usa cada cantidad de jugadores
function boardFor(n, opts){ return (n>4 || opts.board==='6') ? 6 : 4; }
function armsFor(n, N){
  if(N===4) return n===2 ? [0,2] : n===3 ? [0,1,2] : [0,1,2,3];
  return ({1:[0], 2:[0,3], 3:[0,2,4], 4:[0,1,3,4], 5:[0,1,2,3,4], 6:[0,1,2,3,4,5]})[n];
}
function seatPreview(players, opts){
  const n=players.length, N=boardFor(n, opts), arms=armsFor(Math.max(1,n), N)||[], C=colsOf(N);
  return players.map((p,i)=>({p, arm:arms[i], col:C[arms[i]] || {n:'—', hex:'#888'}, team: opts.mode==='equipos' && n===4 ? (i%2) : null}));
}
function modeOk(o, n){ return o.mode!=='equipos' || (n===4 && boardFor(n,o)===4); }

/* ---------- empezar ---------- */
function startGame(){
  const n=S.players.length, N=S.N=boardFor(n, S.opts), arms=armsFor(n, N), C=colsOf(N);
  S.phase='play'; S.startedAt=Date.now(); S.log=[]; S.places=[]; S.winner=null; S.moves=[]; S.bonusQ=[]; S.bonusN=0;
  S.players.forEach((p,i)=>{
    p.arm=arms[i]; p.color=C[p.arm].hex; p.pz=Array(S.opts.pieces).fill(-1); p.done=false; p.place=0; p.caps=0; p.lost=0;
    p.team = S.opts.mode==='equipos' ? 't'+(i%2) : null;
  });
  S.turn=rnd(n); S.tp='roll'; S.dice=0; S.sixes=0; S.extra=false; S.turnAt=Date.now(); S.busyUntil=0;
  log(`🎲 Empieza la partida de Ludo (${N===6?'tablero de 6 colores':'tablero clásico'}, ${S.opts.pieces} fichas cada uno). Se sale de casa con ${exitTxt(S.opts)}. Arranca ${cur().name}.`);
  if(S.opts.mode==='equipos') log(`🤝 Equipos: ${teamLabel('t0')} contra ${teamLabel('t1')}.`);
  ev('start', {});
}
function teamLabel(t){ return S.players.filter(p=>p.team===t).map(p=>p.name).join(' y '); }

/* ---------- ayudas ---------- */
const G = () => geo(S.N);
const ally = (a, b) => a===b || (!!a.team && a.team===b.team);
const allHome = p => p.pz.length>0 && p.pz.every(x=>x===G().goal);
const mateOf = p => p.team ? S.players.find(q=>q!==p && q.team===p.team) : null;
// con qué fichas juega: las propias, o (en equipos) las del compañero cuando ya metió las suyas
function controlled(p){
  if(allHome(p)){ const m=mateOf(p); if(m && !allHome(m)) return m; return null; }
  return p;
}
function piecesAt(g){   // fichas en una casilla del camino común
  const out=[], g0=G();
  for(const q of S.players) q.pz.forEach((x,i)=>{ if(x>=0 && x<=g0.last && gIdx(q.arm,x,S.N)===g) out.push({pl:q, idx:i}); });
  return out;
}
function blockOwner(g){   // dos fichas del mismo color = bloqueo
  const h=piecesAt(g); if(h.length<2) return null;
  return h.every(o=>o.pl===h[0].pl) ? h[0].pl : null;
}
// adónde llega la ficha idx de "owner" con "steps" (null si no se puede)
function moveFor(owner, idx, steps, bonus){
  const g0=G(), pos=owner.pz[idx];
  if(pos==null || pos===g0.goal) return null;
  let to, path;
  if(pos<0){ if(bonus || !exitOk(steps)) return null; to=0; path=[0]; }
  else {
    to=pos+steps;
    if(to>g0.goal){ if(S.opts.exact) return null; to=g0.goal; }
    path=[]; for(let q=pos+1;q<=to;q++) path.push(q);
  }
  if(S.opts.blocks) for(const q of path.slice(0,-1)){
    if(q>g0.last) break;
    const b=blockOwner(gIdx(owner.arm,q,S.N)); if(b && !ally(b, owner)) return null;
  }
  const cap=[];
  if(to<=g0.last){
    const g=gIdx(owner.arm,to,S.N), here=piecesAt(g).filter(o=>!(o.pl===owner && o.idx===idx));
    if(S.opts.blocks && here.length>=2) return null;
    if(!isSafeG(g)) here.forEach(o=>{ if(!ally(o.pl, owner)) cap.push({pid:o.pl.id, idx:o.idx}); });
  }
  return {pid:owner.id, idx, from:pos, to, steps, cap, goal:to===g0.goal, exit:pos<0};
}
function legalMoves(p, steps, bonus){
  const owner=controlled(p); if(!owner) return [];
  let ms=owner.pz.map((_,i)=>moveFor(owner, i, steps, bonus)).filter(Boolean);
  if(S.opts.forceCap && ms.some(m=>m.cap.length)) ms=ms.filter(m=>m.cap.length);
  return ms;
}
// jugadas distintas (sacar una u otra ficha de casa es lo mismo)
const distinctMoves = ms => { const s=new Set(); return ms.filter(m=>{ const k=m.pid+':'+m.from+'>'+m.to; if(s.has(k)) return false; s.add(k); return true; }); };

/* ---------- turnos ---------- */
const isTurn = pid => S && S.phase==='play' && cur() && cur().id===pid;
function stillPlays(p){ if(!allHome(p)) return true; const m=mateOf(p); return !!(m && !allHome(m)); }
function nextPlayer(){
  const n=S.players.length;
  for(let k=1;k<=n;k++){ const i=(S.turn+k)%n; if(stillPlays(S.players[i])){ S.turn=i; break; } }
  S.tp='roll'; S.sixes=0; S.extra=false; S.moves=[]; S.bonusQ=[]; S.bonusN=0; S.turnAt=Date.now(); S.autoAt=0;
}
function afterTurnStep(p){
  // premios pendientes de 20/10
  while(S.bonusQ.length){
    const b=S.bonusQ.shift(), ms=legalMoves(p, b, true);
    if(ms.length){ S.tp='bonus'; S.bonusN=b; S.moves=ms; S.turnAt=Date.now(); S.autoAt = S.opts.auto && distinctMoves(ms).length===1 ? Date.now()+900 : 0; return; }
    log(`🎁 ${p.name} no tiene con qué contar el premio de ${b}: se pierde.`);
  }
  S.bonusN=0;
  if(checkOver()) return;
  if((S.extra || S.again) && stillPlays(p) && !(allHome(p) && !mateOf(p))){
    S.again=false; S.tp='roll'; S.moves=[]; S.turnAt=Date.now(); S.autoAt=0;
    return;
  }
  S.again=false; nextPlayer();
}
function checkOver(){
  if(S.opts.mode==='equipos'){
    const t=['t0','t1'].find(t=>S.players.filter(p=>p.team===t).every(allHome));
    if(t){ endGame(t); return true; }
    return false;
  }
  const left=S.players.filter(p=>!allHome(p));
  if(!S.opts.playOn ? S.places.length>=1 : left.length<=1){
    left.sort((a,b)=>progressOf(b)-progressOf(a)).forEach(p=>{ S.places.push(p.id); p.place=S.places.length; });
    endGame(null); return true;
  }
  return false;
}
const progressOf = p => p.pz.reduce((s,x)=>s+(x<0?-3:x),0);
function endGame(team){
  S.phase='over'; S.tp='over'; S.moves=[];
  if(team){
    S.winner=team; const names=teamLabel(team);
    S.places=[...S.players.filter(p=>p.team===team), ...S.players.filter(p=>p.team!==team)].map(p=>p.id);
    S.players.forEach(p=>p.place = p.team===team ? 1 : 2);
    log(`🎉 ¡Gana el equipo de ${names}!`); sysChat(`🎉 ¡El equipo de ${names} ganó la partida de Ludo!`);
  } else {
    const w=P(S.places[0]); S.winner=w?w.id:null;
    log(`🎉 ¡${w?w.name:'Alguien'} gana la partida!`); sysChat(`🎉 ¡${w?w.name:'Alguien'} ganó la partida de Ludo! ${S.places.map((id,i)=>`${i+1}º ${(P(id)||{}).name}`).join(' · ')}`);
  }
  ev('end', {});
}

function doRoll(p){
  const v=1+rnd(6);
  S.dice=v; S.lastRoll={pid:p.id, v, at:Date.now()};
  if(v===6){ S.sixes++; p.sixes=(p.sixes||0)+1; } else S.sixes=0;
  ev('roll', {pid:p.id, v});
  if(v===6 && S.opts.triple6 && S.sixes>=3){
    log(`🚫 ${p.emoji} ${p.name} sacó tres 6 seguidos: pierde el turno.`, {dice:v, pid:p.id});
    S.tp='pass'; S.extra=false; S.passAt=Date.now()+1500; S.moves=[]; return;
  }
  S.extra = v===6;
  const ms=legalMoves(p, v, false), owner=controlled(p);
  if(!ms.length){
    const why = owner && owner.pz.every(x=>x<0) ? `todavía no sale de casa (hace falta ${exitTxt(S.opts)})` : 'no tiene ninguna ficha que pueda mover';
    log(`${p.emoji} ${p.name} saca ${v} ${DICE_FACES[v]} y ${why}.`, {dice:v, pid:p.id});
    S.tp='pass'; S.passAt=Date.now()+1400; S.moves=[]; return;
  }
  S.tp='move'; S.moves=ms; S.turnAt=Date.now();
  S.autoAt = S.opts.auto && distinctMoves(ms).length===1 ? Date.now()+1100 : 0;
}
function doMove(p, m){
  const owner=P(m.pid), g0=G();
  owner.pz[m.idx]=m.to;
  const caps=m.cap.map(c=>({pid:c.pid, idx:c.idx, at:P(c.pid).pz[c.idx]}));
  m.cap.forEach(c=>{ const q=P(c.pid); q.pz[c.idx]=-1; q.lost++; });
  if(caps.length) p.caps+=caps.length;
  const path = m.exit ? [-1,0] : [m.from]; if(!m.exit) for(let q=m.from+1;q<=m.to;q++) path.push(q);
  const who = owner===p ? '' : ` (de ${owner.name})`;
  const steps = S.tp==='bonus' ? `cuenta ${S.bonusN} de premio` : `saca ${S.dice} ${DICE_FACES[S.dice]}`;
  let x;
  if(m.exit) x=`${p.emoji} ${p.name} ${steps} y saca una ficha${who} de casa 🏠➡️`;
  else if(m.goal) x=`${p.emoji} ${p.name} ${steps} y mete una ficha${who} en la meta 🏁`;
  else if(m.to>=g0.home0 && m.from<g0.home0) x=`${p.emoji} ${p.name} ${steps} y entra al pasillo${who} 🛤️`;
  else x=`${p.emoji} ${p.name} ${steps} y avanza ${m.to-m.from} casillas${who}`;
  if(caps.length) x+=` — ¡se come ${caps.length>1?caps.length+' fichas':'la ficha'} de ${[...new Set(caps.map(c=>P(c.pid).name))].join(' y ')}! 😋`;
  const tg = m.to<=g0.last ? gIdx(owner.arm, m.to, S.N) : -1;
  if(tg>=0 && !caps.length && isSafeG(tg)) x+=' (casilla segura ⭐)';
  if(S.opts.blocks && tg>=0 && blockOwner(tg)===owner) x+=' — ¡bloqueo! 🧱';
  log(x, {dice:S.tp==='bonus'?0:S.dice, bonus:S.tp==='bonus'?S.bonusN:0, pid:p.id, color:owner.color, cap:caps.length>0, goal:m.goal});
  ev('move', {pid:owner.id, by:p.id, idx:m.idx, path, caps, goal:m.goal});
  S.busyUntil = Date.now() + (path.length*170) + (caps.length?700:0) + 200;
  // premios
  if(m.goal && allHome(owner) && !owner.place && S.opts.mode!=='equipos'){
    S.places.push(owner.id); owner.place=S.places.length;
    log(`🏆 ¡${owner.name} metió todas sus fichas! Sale ${owner.place}º.`); sysChat(`🏆 ${owner.name} metió todas sus fichas: ${owner.place}º puesto.`);
    ev('done', {pid:owner.id, place:owner.place});
  } else if(m.goal && allHome(owner) && S.opts.mode==='equipos'){
    log(`🏁 ${owner.name} metió todas sus fichas: ahora juega con las de su compañero.`);
  }
  if(S.opts.bonus==='20'){ if(caps.length) S.bonusQ.push(20); if(m.goal) S.bonusQ.push(10); }
  else if(S.opts.bonus==='turno' && (caps.length || m.goal)) S.again=true;
  S.moves=[]; S.autoAt=0;
  afterTurnStep(p);
}

function act(pid, a){
  if(!S || !a) return;
  const p=P(pid);
  switch(a.type){
    case 'mic': { const w=p||OB(pid); if(w){ w.mic=!!a.on; commit(); } return; }
    case 'cam': { const w=p||OB(pid); if(w){ w.cam=!!a.on; commit(); } return; }
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
    case 'joinNext': {   // un observador se sienta: en la sala, al terminar, o en el lugar de un bot
      const o=OB(pid); if(!o || o.owner) return;
      let np=null;
      if(S.phase==='play'){
        const b=S.players.find(x=>x.bot && !(cur()===x)); if(!b) return 'No hay ningún bot para reemplazar (o le toca justo a él). Probá en un ratito o esperá a que termine.';
        S.observers=S.observers.filter(x=>x!==o);
        const old=b.name; b.name=o.name; b.bot=false; b.token=o.token; b.peerId=o.peerId; b.conn=o.conn; b.mic=false;
        if(o.emoji!=='👀') b.emoji=o.emoji;
        np=b; sysChat(`🪑 ${b.name} toma el lugar de ${old} 🤖 (con sus fichas).`);
      } else {
        if(S.players.length>=MAXP) return 'La mesa está llena (6 jugadores).';
        S.observers=S.observers.filter(x=>x!==o);
        np=addPlayer(o.name, o.emoji==='👀'?EMOJIS.find(e=>!S.players.some(q=>q.emoji===e)):o.emoji, o.token, o.peerId);
        np.conn=o.conn;
        sysChat(`🪑 ${np.name} se sentó a la mesa.`);
      }
      if(typeof onSeatChange==='function') onSeatChange(pid, np.id);
      commit(); return;
    }
  }
  if(!p) return;
  const host = pid===S.hostPid || NET.mode==='local';
  switch(a.type){
    case 'addBot': if(!host||S.phase!=='lobby') return; { const r=addBot(); if(r) return r; } commit(); return;
    case 'kick': {
      if(!host) return; const t=P(a.pid); if(!t || t.id===S.hostPid) return;
      if(NET.conns && NET.conns[t.id]){ try{ NET.conns[t.id].send({t:'kicked'}); }catch(e){} }
      if(S.phase==='lobby' || S.phase==='over'){ S.players=S.players.filter(x=>x!==t); sysChat(`🚪 ${t.name} fue sacado de la mesa.`); }
      else { t.bot=true; t.conn=false; t.mic=false; t.token=null; sysChat(`🚪 ${t.name} fue sacado: un bot 🤖 sigue con sus fichas.`); log(`🤖 Un bot juega por ${t.name}.`); }
      commit(); return;
    }
    case 'botify': {
      if(!host) return; const t=P(a.pid); if(!t || t.bot) return;
      t.bot=true; t.conn=false; t.mic=false; t.token=null; sysChat(`🤖 Un bot sigue jugando con las fichas de ${t.name}.`); log(`🤖 Un bot juega por ${t.name}.`); commit(); return;
    }
    case 'seatUp': {
      if(!host || S.phase!=='lobby') return; const i=S.players.findIndex(x=>x.id===a.pid); if(i<=0) return;
      [S.players[i-1], S.players[i]]=[S.players[i], S.players[i-1]]; commit(); return;
    }
    case 'opt': {
      if(!host || S.phase!=='lobby') return;
      if(a.k==='exit' && EXITS.some(x=>x.v===a.v)) S.opts.exit=a.v;
      else if(a.k==='bonus' && BONUS.some(x=>x.v===a.v)) S.opts.bonus=a.v;
      else if(a.k==='pieces' && PIECES.some(x=>x.v==a.v)) S.opts.pieces=+a.v;
      else if(a.k==='mode' && MODES.some(x=>x.v===a.v)) S.opts.mode=a.v;
      else if(a.k==='board' && BOARDS.some(x=>x.v===a.v)) S.opts.board=a.v;
      else if(HOUSE.some(h=>h.k===a.k)) S.opts[a.k]=!!a.v;
      commit(); return;
    }
    case 'grules': if(!host) return; S.grules=String(a.text||'').slice(0,1200); commit(); return;
    case 'sugDel': if(!host) return; S.sugs=S.sugs.filter(s=>s.id!==a.id); commit(); return;
    case 'start': {
      if(!host || S.phase!=='lobby') return;
      const n=S.players.length;
      if(n<2) return 'Hacen falta al menos 2 jugadores (sumá un bot 🤖).';
      if(!modeOk(S.opts, n)) return 'Los equipos 2 contra 2 se juegan con 4 jugadores en el tablero de 4 colores.';
      startGame(); sysChat('🎲 ¡Empieza la partida de Ludo! Suerte a todos.'); commit(); return;
    }
    case 'newGame': if(!host || S.phase!=='over') return;
      S.phase='lobby'; S.log=[]; S.places=[]; S.winner=null; S.moves=[]; S.tp='roll'; S.dice=0;
      S.players.forEach(x=>{ x.pz=[]; x.arm=null; x.team=null; x.done=false; x.place=0; x.caps=0; x.lost=0; x.sixes=0; });
      commit(); return;
    case 'leave': {
      if(S.phase==='lobby' || S.phase==='over'){ S.players=S.players.filter(x=>x!==p); sysChat(`🚪 ${p.name} se fue.`); }
      else { p.bot=true; p.conn=false; p.mic=false; p.token=null; sysChat(`🚪 ${p.name} se fue: un bot 🤖 sigue con sus fichas.`); log(`🚪 ${p.name} se fue: un bot sigue con sus fichas.`); }
      commit(); return;
    }
    case 'roll': {
      if(S.phase!=='play') return;
      if(!isTurn(pid)) return 'No es tu turno.';
      if(S.tp!=='roll') return S.tp==='move'||S.tp==='bonus' ? 'Ya tiraste: ahora mové una ficha 👆' : '';
      doRoll(p); commit(); return;
    }
    case 'move': {
      if(S.phase!=='play') return;
      if(!isTurn(pid)) return 'No es tu turno.';
      if(S.tp!=='move' && S.tp!=='bonus') return 'Primero tirá el dado 🎲';
      const m=S.moves.find(x=>x.idx===a.idx && (!a.pid || x.pid===a.pid));
      if(!m) return 'Esa ficha no se puede mover con este número.';
      doMove(p, m); commit(); return;
    }
  }
}

/* ---------- el anfitrión mueve el reloj: pasar el turno, mover sola, bots ---------- */
const BOT = {next:0};
const BOT_TALK = {
  cap:['¡Te comí! 😋','¡A casa, che! 🏠','Jaha, ¡ñam! 😋','¡Perdón… mentira, no! 😂','¡Volvé a empezar nomás! 🎲'],
  eaten:['¡Ndaje! 😩','¡Me comieron! 😤','Ya vas a ver… 😠','Aikóma 😭'],
  goal:['¡Una en la meta! 🏁','¡Llegó una! 🎉','Oĩma una 🏁'],
  six:['¡Seis! 🎲','¡Otra vez! 😎'],
  nada:['Upéi…','Ndaipóri 😅','Mba\'éichapa este dado 🤔'],
};
const pick = a => a[rnd(a.length)];
const autoPlays = p => p.bot || (!p.conn && p.offAt && Date.now()-p.offAt>20000);
// ¿cuántas fichas rivales pueden caer en esta casilla con la próxima tirada?
function danger(g, owner){
  if(isSafeG(g)) return 0;
  const g0=G(); let d=0;
  for(const q of S.players){ if(ally(q, owner)) continue;
    q.pz.forEach(x=>{
      if(x<0){ if(exitOk(6) && gIdx(q.arm,0,S.N)===g) d+=.3; return; }
      if(x>g0.last) return;
      const gq=gIdx(q.arm,x,S.N), dist=(g-gq+g0.L)%g0.L;
      if(dist>=1 && dist<=6 && x+dist<=g0.last) d++;
    });
  }
  return d;
}
function botScore(m){
  const owner=P(m.pid), g0=G();
  let s=m.to*.12 + Math.random()*3;
  s+=m.cap.length*70;
  if(m.goal) s+=50;
  if(m.exit) s+=38;
  if(m.to>=g0.home0 && m.from<g0.home0) s+=28;
  if(m.to<=g0.last){
    const g=gIdx(owner.arm,m.to,S.N);
    if(isSafeG(g)) s+=14;
    s-=danger(g, owner)*22;
    if(S.opts.blocks && piecesAt(g).some(o=>o.pl===owner)) s+=8;
  }
  if(m.from>=0 && m.from<=g0.last){ const gf=gIdx(owner.arm,m.from,S.N); s+=danger(gf, owner)*18; }
  return s;
}
function botTick(){
  if(!S || S.phase!=='play' || (NET.mode!=='host' && NET.mode!=='local')) return;
  const now=Date.now();
  if(S.tp==='pass'){
    if(now<(S.passAt||0)) return;
    const p=cur();
    if(S.extra && S.sixes<3){ S.tp='roll'; S.turnAt=now; S.moves=[]; }
    else nextPlayer();
    commit(); return;
  }
  if((S.tp==='move'||S.tp==='bonus') && S.autoAt && now>=S.autoAt && now>=(S.busyUntil||0)){
    const m=S.moves[0]; if(m){ doMove(cur(), m); commit(); return; }
  }
  if(now<BOT.next) return;
  const b=cur(); if(!b || !autoPlays(b)) return;
  if(now<(S.busyUntil||0)+500 || now-(S.turnAt||0) < 900+rnd(700)) return;
  BOT.next=now+600;
  if(S.tp==='roll'){
    doRoll(b);
    if(b.bot && S.dice===6 && Math.random()<.12) botChat(b, pick(BOT_TALK.six));
    else if(b.bot && S.tp==='pass' && Math.random()<.08) botChat(b, pick(BOT_TALK.nada));
    commit(); return;
  }
  if(S.tp==='move'||S.tp==='bonus'){
    if(now-(S.turnAt||0)<900) return;
    const m=S.moves.slice().sort((x,y)=>botScore(y)-botScore(x))[0]; if(!m) return;
    const eaten=m.cap.map(c=>P(c.pid)).filter(Boolean);
    if(b.bot){
      if(m.cap.length && Math.random()<.6) botChat(b, pick(BOT_TALK.cap));
      else if(m.goal && Math.random()<.4) botChat(b, pick(BOT_TALK.goal));
    }
    doMove(b, m);
    eaten.forEach(v=>{ if(v.bot && Math.random()<.45) setTimeout(()=>{ if(S) botChat(v, pick(BOT_TALK.eaten)); }, 1200+rnd(900)); });
    commit();
  }
}
setInterval(botTick, 300);
// los bots contestan los mensajes en secreto
function botPrivate(bot, from, text){
  const t=text.toLowerCase();
  const ans = /com|come|ficha|bloque/.test(t) ? pick(['Yo no como a nadie… todavía 😇','Si te acercás, te como 😏','Tranqui, a vos no te toco… creo 🤭'])
    : /equipo|ayud|junt/.test(t) ? pick(['¡Dale, hagamos equipo contra los demás! 🤝','Oĩma, te cuido la espalda 😉','Mmm… veremos 🤔'])
    : pick(['Jaja, ¿y qué me das a cambio? 😏','Shhh, que nadie se entere 🤫','Upéi hablamos 🧉','¡Trato hecho! 🤝','Tirá el dado nomás 🎲']);
  setTimeout(()=>{ if(S) addChat(bot.id, ans, from.id); }, 900+rnd(1500));
}
