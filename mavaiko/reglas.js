'use strict';
/* =====================================================================
   ¿Mávaiko Ojuka? — juego de detectives en una estancia paraguaya.
   Tablero, cartas, reglas de la casa y bots.
   Todo lo decide el anfitrión (o el propio aparato en el modo solo):
   act(pid, accion) cambia el estado S y devuelve un texto si no se puede.
   ===================================================================== */

/* ---------- la historia y las cartas ---------- */
const SUS = [
  {n:'Ña Eulogia',     t:'la cocinera de la estancia',  e:'👵', c:'#e9a100'},
  {n:'Karai Brítez',   t:'el capataz',                  e:'🤠', c:'#2a8a3f'},
  {n:'Doña Chela',     t:'la vecina chismosa',          e:'💃', c:'#d52b1e'},
  {n:'Profe Ledesma',  t:'el maestro rural',            e:'👨‍🏫', c:'#1d5fd6'},
  {n:'Rocío',          t:'la sobrina de la capital',    e:'👩‍🎤', c:'#8e44ad'},
  {n:'Don Tito',       t:'el arpista',                  e:'🎻', c:'#6d6d6d'},
];
const WPN = [
  {n:'Machete',            t:'el del capataz',                 e:'🗡️'},
  {n:'Tereré envenenado',  t:'con yuyo que no era remedio',    e:'🧉'},
  {n:'Angu\'a',            t:'el mortero de pisar maíz',       e:'🪵'},
  {n:'Soga de cuero',      t:'la del lazo del corral',         e:'🪢'},
  {n:'Plancha a carbón',   t:'la de la abuela',                e:'♨️'},
  {n:'Hacha',              t:'la de partir leña',              e:'🪓'},
];
// el tablero: 19×19 casillas; 9 piezas de la estancia y pasillos (corredores de baldosa)
const N = 19;
const ROOMS = [
  {n:'Cocina',          e:'🍲', r:0,  c:0,  h:5, w:5, doors:[[5,2],[2,5]],                 pass:8},
  {n:'Corredor',        e:'🪑', r:0,  c:7,  h:4, w:5, doors:[[4,9],[1,6],[1,12]]},
  {n:'Sala',            e:'🛋️', r:0,  c:14, h:5, w:5, doors:[[5,16],[2,13]],               pass:6},
  {n:'Capilla',         e:'⛪', r:7,  c:0,  h:5, w:4, doors:[[6,1],[9,4],[12,1]]},
  {n:'Patio del mango', e:'🥭', r:7,  c:7,  h:5, w:5, doors:[[6,9],[12,9],[9,6],[9,12]]},
  {n:'Galpón',          e:'🚜', r:7,  c:15, h:5, w:4, doors:[[9,14],[6,17],[12,17]]},
  {n:'Corral',          e:'🐄', r:14, c:0,  h:5, w:5, doors:[[13,2],[16,5]],               pass:2},
  {n:'Naranjal',        e:'🍊', r:15, c:7,  h:4, w:5, doors:[[14,9],[16,6],[16,12]]},
  {n:'Tajamar',         e:'🦆', r:14, c:14, h:5, w:5, doors:[[13,16],[16,13]],             pass:0},
];
const START = [[0,6],[0,12],[12,18],[18,12],[18,6],[6,0]];
const RMAP = [];   // RMAP[r][c] = número de pieza, o -1 si es pasillo
for(let r=0;r<N;r++){ RMAP.push([]); for(let c=0;c<N;c++) RMAP[r].push(-1); }
ROOMS.forEach((R,i)=>{ for(let r=R.r;r<R.r+R.h;r++) for(let c=R.c;c<R.c+R.w;c++) RMAP[r][c]=i; });
const DOOR = {};   // 'r,c' del pasillo → piezas a las que se entra desde ahí
ROOMS.forEach((R,i)=>R.doors.forEach(([r,c])=>{ (DOOR[r+','+c]=DOOR[r+','+c]||[]).push(i); }));
const isHall = (r,c) => r>=0 && c>=0 && r<N && c<N && RMAP[r][c]<0;
const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];

// las 21 cartas: s0..s5 sospechosos, w0..w5 armas, r0..r8 lugares
const CARDS = [...SUS.map((x,i)=>'s'+i), ...WPN.map((x,i)=>'w'+i), ...ROOMS.map((x,i)=>'r'+i)];
const cardKind = id => id[0];
const cardIdx = id => +id.slice(1);
const cardInfo = id => id[0]==='s' ? SUS[cardIdx(id)] : id[0]==='w' ? WPN[cardIdx(id)] : ROOMS[cardIdx(id)];
const cardName = id => cardInfo(id).n;
const KIND_N = {s:'Sospechoso', w:'Arma', r:'Lugar'};
const triple = (s,w,r) => ['s'+s, 'w'+w, 'r'+r];
const tripleTxt = (s,w,r) => `${SUS[s].n} con ${artW(w)} en ${artR(r)}`;
function artW(w){ const n=WPN[w].n; return (/^(Soga|Plancha|Hacha)/.test(n)?'la ':'el ')+n; }
function artR(r){ const n=ROOMS[r].n; return (/^(Cocina|Sala|Capilla)/.test(n)?'la ':'el ')+n; }

function rnd(n){ if(window.crypto && crypto.getRandomValues){ const a=new Uint32Array(1); crypto.getRandomValues(a); return a[0]%n; } return Math.floor(Math.random()*n); }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=rnd(i+1); [a[i],a[j]]=[a[j],a[i]]; } return a; }

/* ---------- reglas de la casa (las elige el anfitrión en la sala) ---------- */
const HOUSE = [
  {k:'pombero',  def:true,  t:'👹 Túneles del Pombero', d:'La Cocina y el Tajamar, y la Sala y el Corral, están unidos por un túnel: desde una de esas piezas pasás a la otra sin tirar los dados.'},
  {k:'faceUp',   def:true,  t:'🃏 Las cartas que sobran, a la vista', d:'Si las cartas no se reparten parejo, las que sobran quedan boca arriba para todos. Si no, a algunos les toca una más.'},
  {k:'second',   def:false, t:'🙏 Segunda oportunidad', d:'El que acusa mal no queda afuera la primera vez: pierde 2 turnos y sigue jugando. La segunda vez sí queda afuera.'},
  {k:'autoNote', def:true,  t:'📒 Libreta que se anota sola', d:'La libreta marca sola tus cartas, las que te muestran y quién no pudo mostrar nada. Sin esto anotás todo vos, como con lápiz y papel.'},
];
const MOVES = [{v:'2d',t:'🎲🎲 Dos dados (oficial)'},{v:'1d',t:'🎲 Un dado (más lento)'},{v:'free',t:'🏃 Sin dados: vas directo a la pieza que quieras (rápido)'}];
function defaultOpts(){ const o={moves:'2d'}; HOUSE.forEach(h=>o[h.k]=h.def); return o; }

/* ---------- estado ---------- */
let S=null;
const EMOJIS = ['🕵️','🔎','🧉','🐆','🦉','🦜','🐊','🌸','🎩','🐎','🦊','🌞','🐂','🦋','🍊','🐒'];
const PCOLORS = ['#e63946','#1d70d6','#2a9d3f','#e9a100','#8e44ad','#13a8a8'];
const BOT_NAMES = [['Pesquisa Benítez','🔎'],['Ña Rosa','🌸'],['Karai Mbaretĕ','🐂'],['Kuñataĩ Lupe','🦋'],['Don Ñandu','🦉'],['Sherlock Ñandutí','🎩'],['Ña Chipa','🧉'],['Che Ra\'a','🐒']];
const MAXP = 6;
const P = id => S && S.players.find(p=>p.id===id);
const OB = id => S && (S.observers||[]).find(o=>o.id===id);
const cur = () => S.players[S.turn];
const isTurn = pid => S && S.phase==='play' && cur() && cur().id===pid;
const active = () => S.players.filter(p=>!p.out);

function lobbyState(){
  return {v:1, phase:'lobby', seq:0, players:[], observers:[], hostPid:null, opts:defaultOpts(),
    grules:'', sugs:[], log:[], ev:[], evSeq:0, round:0, turn:0, step:null, dice:null, moves:0,
    sol:null, up:[], tokS:[], tokW:[], hist:[], refute:null, peek:null, win:null, gid:null};
}
function addPlayer(name, emoji, token, peerId, bot){
  const used=S.players.map(p=>p.color);
  const p={id:'p'+(++S.seq), name:(String(name||'').trim()||'Jugador').slice(0,16), emoji, token, peerId,
    color:PCOLORS.find(c=>!used.includes(c))||PCOLORS[S.players.length%PCOLORS.length],
    conn:!bot, bot:!!bot, mic:false, hand:[], pos:null, room:null, out:false, wins:0};
  S.players.push(p); return p;
}
function addBot(){
  if(S.players.length>=MAXP) return 'Ya son 6 pesquisas (el máximo).';
  const free=BOT_NAMES.filter(([n])=>!S.players.some(p=>p.name===n));
  const [n,e]=free.length?free[rnd(free.length)]:['Bot '+(S.players.length+1),'🤖'];
  const b=addPlayer(n, e, null, null, true);
  sysChat(`🤖 ${b.name} se sumó a la investigación.`);
}
// "a el" → "al", "de el" → "del"
const gram = s => String(s).replace(/\b([Aa]) el /g,'$1l ').replace(/\b([Dd])e el /g,'$1el ');
function log(x, extra){ S.log.push(Object.assign({x:gram(x), at:Date.now()}, extra||{})); if(S.log.length>250) S.log.splice(0, S.log.length-250); }
function ev(k, o){ S.ev.push(Object.assign({i:++S.evSeq, k, at:Date.now()}, o||{})); if(S.ev.length>14) S.ev.shift(); }

/* ---------- empezar ---------- */
function startGame(){
  S.phase='play'; S.round++; S.startedAt=Date.now(); S.gid=Date.now().toString(36)+rnd(1e6).toString(36);
  S.sol={s:rnd(SUS.length), w:rnd(WPN.length), r:rnd(ROOMS.length)};
  const rest=shuffle(CARDS.filter(c=>!triple(S.sol.s,S.sol.w,S.sol.r).includes(c)));
  const n=S.players.length, each=Math.floor(rest.length/n);
  S.up = S.opts.faceUp ? rest.splice(0, rest.length-each*n) : [];
  S.players.forEach(p=>{ p.hand=[]; p.out=false; p.strikes=0; p.skip=0; p.room=null; p.left=null; p.entered=false; });
  rest.forEach((c,i)=>S.players[i%n].hand.push(c));
  S.players.forEach((p,i)=>{ p.pos=START[i].slice(); });
  // los sospechosos y las armas empiezan repartidos por la estancia
  const rs=shuffle(ROOMS.map((x,i)=>i)); S.tokS=SUS.map((x,i)=>rs[i]);
  const rw=shuffle(ROOMS.map((x,i)=>i)); S.tokW=WPN.map((x,i)=>rw[i]);
  S.hist=[]; S.refute=null; S.peek=null; S.win=null; S.log=[];
  S.turn=rnd(n); S.dice=null;
  log('🌙 Noche de San Juan en la estancia Ñu Porã: encontraron muerto a Don Ramón, el patrón. ¿Mávaiko ojuka? ¿Quién fue, con qué y dónde?');
  log(`🃏 Se repartieron las cartas${S.up.length?` y quedan ${S.up.length} a la vista`:''}. El sobre con la verdad quedó cerrado.`);
  ev('deal', {});
  beginTurn();
}
function beginTurn(){
  const p=cur(); S.step='roll'; S.dice=null; S.moves=0; p.entered=false; p.left=null; S.turnAt=Date.now();
}
function nextTurn(){
  S.refute=null;
  const n=S.players.length;
  for(let k=0;k<n*3;k++){
    S.turn=(S.turn+1)%n;
    const p=cur();
    if(p.out) continue;
    if(p.skip>0){ p.skip--; log(`⏸️ ${p.name} pierde este turno (le quedan ${p.skip}).`); continue; }
    return beginTurn();
  }
  endGame(null);
}

/* ---------- moverse ---------- */
function occupied(r, c, except){ return S.players.some(p=>p.id!==except && p.room==null && p.pos && p.pos[0]===r && p.pos[1]===c); }
// hasta dónde puede llegar p con n pasos: casillas del pasillo y piezas
function reach(p, n){
  const res={cells:{}, rooms:{}};
  if(!S || !p) return res;
  if(S.opts.moves==='free'){ ROOMS.forEach((R,i)=>{ if(i!==p.room) res.rooms[i]=1; }); return res; }
  const dist={}, q=[];
  if(p.room!=null){ for(const [r,c] of ROOMS[p.room].doors){ const k=r+','+c; if(!occupied(r,c,p.id) && dist[k]==null){ dist[k]=1; q.push([r,c]); } } }
  else if(p.pos){ dist[p.pos.join(',')]=0; q.push(p.pos); }
  while(q.length){
    const [r,c]=q.shift(), d=dist[r+','+c];
    (DOOR[r+','+c]||[]).forEach(ri=>{ if(ri!==p.room && d+1<=n && (res.rooms[ri]==null || res.rooms[ri]>d+1)) res.rooms[ri]=d+1; });
    if(d>=n) continue;
    for(const [dr,dc] of DIRS){
      const nr=r+dr, nc=c+dc, k=nr+','+nc;
      if(!isHall(nr,nc) || dist[k]!=null || occupied(nr,nc,p.id)) continue;
      dist[k]=d+1; q.push([nr,nc]);
    }
  }
  for(const k in dist) if(dist[k]>0) res.cells[k]=dist[k];
  return res;
}
// distancia de cada casilla del pasillo a cada pieza (sin contar a los demás), para que los bots sepan ir
const DIST = ROOMS.map((R,i)=>{
  const d={}, q=[];
  R.doors.forEach(([r,c])=>{ d[r+','+c]=1; q.push([r,c]); });
  while(q.length){ const [r,c]=q.shift(), k=r+','+c;
    for(const [dr,dc] of DIRS){ const nr=r+dr, nc=c+dc, nk=nr+','+nc; if(!isHall(nr,nc) || d[nk]!=null) continue; d[nk]=d[k]+1; q.push([nr,nc]); } }
  return d;
});
function distToRoom(p, ri){
  if(p.room===ri) return 0;
  if(p.room!=null) return Math.min(...ROOMS[p.room].doors.map(([r,c])=>1+(DIST[ri][r+','+c]||99)), (S.opts.pombero && ROOMS[p.room].pass===ri) ? 1 : 99);
  return p.pos ? (DIST[ri][p.pos.join(',')]||99) : 99;
}
function enterRoom(p, ri, how){
  p.left=p.room; p.room=ri; p.pos=null; p.entered=true; S.step='suggest';
  log(`${p.emoji} ${p.name} ${how||'entra a'} ${artR(ri)} ${ROOMS[ri].e}.`, {pid:p.id});
  ev('room', {pid:p.id, r:ri});
}

/* ---------- sospechar y mostrar ---------- */
function startRefute(p, s, w){
  const r=p.room;
  S.tokS[s]=r; S.tokW[w]=r;
  const h={i:S.hist.length+1, by:p.id, s, w, r, passed:[], shower:null, card:null, at:Date.now()};
  S.hist.push(h); if(S.hist.length>200) S.hist.shift();
  log(`🕵️ ${p.name} sospecha: “¿Habrá sido ${tripleTxt(s,w,r)}?”`, {pid:p.id, sus:h});
  ev('suggest', {pid:p.id, s, w, r});
  const n=S.players.length, me=S.players.indexOf(p);
  S.refute={h:h.i, by:p.id, cards:triple(s,w,r), order:[], k:0, waiting:null, at:Date.now()};
  for(let j=1;j<n;j++) S.refute.order.push(S.players[(me+j)%n].id);
  S.step='refute';
  advanceRefute();
}
function curHist(){ return S.refute && S.hist.find(x=>x.i===S.refute.h); }
function advanceRefute(){
  const R=S.refute, h=curHist(); if(!R || !h) return;
  while(R.k<R.order.length){
    const q=P(R.order[R.k]);
    if(q && q.hand.some(c=>R.cards.includes(c))){ R.waiting=q.id; R.at=Date.now(); return; }
    if(q){ h.passed.push(q.id); log(`🙅 ${q.name} no tiene ninguna de esas cartas.`, {pid:q.id}); }
    R.k++;
  }
  log(`😮 ¡Nadie pudo mostrar ninguna carta!`);
  ev('nobody', {by:R.by});
  S.refute=null; S.step='after'; S.turnAt=Date.now();
}
function doShow(q, card){
  const R=S.refute, h=curHist(), by=P(R.by);
  h.shower=q.id; h.card=card;
  log(`🤫 ${q.name} le mostró una carta en secreto a ${by?by.name:'?'}.`, {pid:q.id});
  ev('show', {from:q.id, to:R.by, card});
  S.refute=null; S.step='after'; S.turnAt=Date.now();
}

/* ---------- acusar ---------- */
function endGame(w){
  S.phase='over'; S.step=null; S.refute=null;
  S.win={pid:w?w.id:null, sol:S.sol};
  if(w){ w.wins=(w.wins||0)+1; log(`🏆 ¡${w.name} resolvió el caso! Fue ${tripleTxt(S.sol.s,S.sol.w,S.sol.r)}.`); sysChat(`🏆 ¡${w.name} resolvió el caso!`); }
  else { log(`🤷 Nadie resolvió el caso. Fue ${tripleTxt(S.sol.s,S.sol.w,S.sol.r)}.`); sysChat('🤷 Nadie resolvió el caso.'); }
  ev('over', {pid:w?w.id:null});
}

/* ---------- jugadas ---------- */
function act(pid, a){
  if(!S || !a) return;
  const p=P(pid);
  switch(a.type){
    case 'mic': { const w=p||OB(pid); if(w){ w.mic=!!a.on; commit(); } return; }
    case 'cam': { const w=p||OB(pid); if(w){ w.cam=!!a.on; commit(); } return; }
    case 'suggestRule': {
      const t=String(a.text||'').trim().slice(0,240); if(!t) return 'Escribí la regla que querés sugerir.';
      const w=p||OB(pid); if(!w) return;
      S.sugs.push({id:'g'+(++S.seq), by:w.name, e:w.emoji, text:t, votes:[pid]}); if(S.sugs.length>40) S.sugs.shift();
      sysChat(`💡 ${w.name} sugirió una regla: “${t}”`); commit(); return;
    }
    case 'vote': {
      const s=S.sugs.find(x=>x.id===a.id); if(!s) return;
      s.votes = s.votes.includes(pid) ? s.votes.filter(x=>x!==pid) : s.votes.concat(pid); commit(); return;
    }
    case 'joinNext': {
      const o=OB(pid); if(!o) return;
      if(S.phase==='play') return 'Esperá a que termine el caso para sumarte.';
      if(S.players.length>=MAXP) return 'Ya hay 6 pesquisas en la mesa.';
      if(o.owner) return;
      S.observers=S.observers.filter(x=>x!==o);
      const np=addPlayer(o.name, o.emoji==='👀'?EMOJIS.find(e=>!S.players.some(q=>q.emoji===e)):o.emoji, o.token, o.peerId);
      np.conn=o.conn;
      if(typeof onSeatChange==='function') onSeatChange(pid, np.id);
      sysChat(`🪑 ${np.name} se sumó a la investigación.`);
      commit(); return;
    }
  }
  if(!p) return;
  const host = pid===S.hostPid || NET.mode==='local';
  switch(a.type){
    case 'addBot': if(!host||S.phase==='play') return; { const r=addBot(); if(r) return r; } commit(); return;
    case 'kick': {
      if(!host) return; const t=P(a.pid); if(!t || t.id===S.hostPid) return;
      removePlayer(t, `🚪 ${t.name} fue sacado de la mesa.`); commit(); return;
    }
    case 'botify': {
      if(!host) return; const t=P(a.pid); if(!t || t.bot) return;
      t.bot=true; t.conn=false; t.mic=false; t.token=null; sysChat(`🤖 Un bot sigue investigando con las cartas de ${t.name}.`); log(`🤖 Un bot juega por ${t.name}.`); commit(); return;
    }
    case 'opt': {
      if(!host || S.phase==='play') return;
      if(a.k==='moves'){ if(MOVES.some(m=>m.v===a.v)) S.opts.moves=a.v; } else if(HOUSE.some(h=>h.k===a.k)) S.opts[a.k]=!!a.v;
      commit(); return;
    }
    case 'grules': if(!host) return; S.grules=String(a.text||'').slice(0,1200); commit(); return;
    case 'sugDel': if(!host) return; S.sugs=S.sugs.filter(s=>s.id!==a.id); commit(); return;
    case 'start': {
      if(!host || S.phase==='play') return;
      if(S.players.length<2) return 'Hacen falta al menos 2 pesquisas (sumá un bot 🤖).';
      startGame(); sysChat('🌙 ¡Empieza el caso! ¿Mávaiko ojuka? Suerte, pesquisas.'); commit(); return;
    }
    case 'toLobby': if(!host || S.phase!=='over') return; S.phase='lobby'; S.players.forEach(x=>{ x.hand=[]; x.pos=null; x.room=null; x.out=false; }); S.up=[]; S.hist=[]; S.win=null; commit(); return;
    case 'leave': {
      if(S.phase!=='play') removePlayer(p, `🚪 ${p.name} se fue.`);
      else { p.bot=true; p.conn=false; p.mic=false; p.token=null; sysChat(`🚪 ${p.name} se fue: un bot 🤖 sigue con sus cartas.`); log(`🚪 ${p.name} se fue: un bot sigue con sus cartas.`); }
      commit(); return;
    }
    case 'show': {
      const R=S.refute; if(!R || R.waiting!==pid) return 'No te toca mostrar.';
      if(!R.cards.includes(a.card) || !p.hand.includes(a.card)) return 'Tenés que mostrar una de las cartas que se nombraron.';
      doShow(p, a.card); commit(); return;
    }
  }
  if(S.phase!=='play') return;
  if(!isTurn(pid)) return 'No es tu turno.';
  if(p.out) return 'Ya quedaste afuera del caso: solo mostrás cartas.';
  switch(a.type){
    case 'roll': {
      if(S.step!=='roll') return;
      if(S.opts.moves==='free'){ S.step='move'; S.dice=null; S.moves=99; commit(); return; }
      const d = S.opts.moves==='1d' ? [1+rnd(6)] : [1+rnd(6), 1+rnd(6)];
      S.dice=d; S.moves=d.reduce((x,y)=>x+y,0); S.step='move';
      log(`🎲 ${p.name} tira ${d.length>1?'los dados':'el dado'}: ${d.join(' + ')}${d.length>1?' = '+S.moves:''}.`, {pid});
      ev('roll', {pid, d});
      commit(); return;
    }
    case 'pass': {   // túnel del Pombero
      if(S.step!=='roll' || !S.opts.pombero || p.room==null || ROOMS[p.room].pass==null) return 'Desde acá no hay túnel.';
      enterRoom(p, ROOMS[p.room].pass, 'pasa por el túnel del Pombero 👹 hasta');
      ev('tunnel', {pid});
      commit(); return;
    }
    case 'move': {
      if(S.step!=='move') return;
      const R=reach(p, S.moves);
      if(a.room!=null){
        if(R.rooms[a.room]==null) return 'No te alcanza para llegar a esa pieza.';
        enterRoom(p, +a.room); commit(); return;
      }
      const k=Array.isArray(a.cell) ? a.cell[0]+','+a.cell[1] : '';
      if(!R.cells[k]) return 'No llegás hasta ahí.';
      const from=p.room;
      p.room=null; p.pos=a.cell.map(Number);
      ev('step', {pid});
      if(from!=null) log(`${p.emoji} ${p.name} sale de ${artR(from)} al pasillo.`, {pid});
      nextTurn(); commit(); return;
    }
    case 'stay': {
      if(S.step!=='move' && S.step!=='roll') return;
      log(`✋ ${p.name} se queda donde está.`, {pid}); nextTurn(); commit(); return;
    }
    case 'suggest': {
      if(S.step!=='suggest' || p.room==null) return 'Para sospechar tenés que entrar a una pieza.';
      const s=+a.s, w=+a.w;
      if(!SUS[s] || !WPN[w]) return 'Elegí un sospechoso y un arma.';
      startRefute(p, s, w); commit(); return;
    }
    case 'accuse': {
      if(!['roll','suggest','after'].includes(S.step)) return 'Ahora no podés acusar.';
      const s=+a.s, w=+a.w, r=+a.r;
      if(!SUS[s] || !WPN[w] || !ROOMS[r]) return 'Elegí sospechoso, arma y lugar.';
      const ok = s===S.sol.s && w===S.sol.w && r===S.sol.r;
      log(`⚖️ ${p.name} ACUSA: “¡Fue ${tripleTxt(s,w,r)}!”`, {pid, acc:true});
      ev('accuse', {pid, s, w, r, ok});
      if(ok){ endGame(p); commit(); return; }
      if(S.opts.second && !p.strikes){
        p.strikes=1; p.skip=2;
        log(`❌ ¡No era así! ${p.name} tiene una segunda oportunidad, pero pierde 2 turnos.`, {pid});
      } else {
        p.out=true;
        S.peek={to:pid, sol:Object.assign({}, S.sol), at:Date.now()};
        log(`❌ ¡No era así! ${p.name} queda afuera del caso (pero sigue mostrando sus cartas).`, {pid});
      }
      if(!active().length) { endGame(null); commit(); return; }
      nextTurn(); commit(); return;
    }
    case 'endTurn': {
      if(S.step!=='suggest' && S.step!=='after') return;
      nextTurn(); commit(); return;
    }
  }
}

function removePlayer(t, msg){
  const i=S.players.indexOf(t); if(i<0) return;
  if(S.phase==='play'){
    // sus cartas quedan a la vista de todos
    if(t.hand.length){ S.up=S.up.concat(t.hand); log(`🃏 Las cartas de ${t.name} quedan a la vista: ${t.hand.map(cardName).join(', ')}.`); }
    const wasTurn = i===S.turn;
    if(S.refute){
      if(S.refute.by===t.id) S.refute=null;
      else { S.refute.order=S.refute.order.filter(x=>x!==t.id); if(S.refute.waiting===t.id){ S.refute.waiting=null; S.refute.k=Math.min(S.refute.k, S.refute.order.length); } }
    }
    S.players.splice(i,1);
    log(msg);
    if(!S.players.length || !active().length){ endGame(null); }
    else {
      if(i<S.turn) S.turn--;
      S.turn=((S.turn%S.players.length)+S.players.length)%S.players.length;
      if(wasTurn){ S.turn=(S.turn-1+S.players.length)%S.players.length; nextTurn(); }
      else if(S.refute && !S.refute.waiting) advanceRefute();
    }
  } else S.players.splice(i,1);
  if(NET.conns && NET.conns[t.id]){ try{ NET.conns[t.id].send({t:'kicked'}); }catch(e){} }
  sysChat(msg);
}

/* ====================== LO QUE SE SABE ======================
   deduce(p) arma la libreta "perfecta" de un jugador con lo que él puede saber:
   sus cartas, las de la vista, las que le mostraron y quién no pudo mostrar.
   La usan los bots (y la libreta automática, para marcar lo seguro). */
function deduce(p, s){
  s=s||S;
  const owners=s.players.map(x=>x.id).concat('env');
  const has={}; owners.forEach(o=>{ has[o]={}; });
  const setv=(o,c,v)=>{ if(has[o][c]===undefined){ has[o][c]=v; return true; } return false; };
  const handN=id=>{ const x=s.players.find(y=>y.id===id); return x ? (x.hand ? x.hand.length : x.n||0) : 0; };
  (p.hand||[]).forEach(c=>{ owners.forEach(o=>has[o][c]= o===p.id); });
  CARDS.forEach(c=>{ if(has[p.id][c]===undefined) has[p.id][c]=false; });
  (s.up||[]).forEach(c=>owners.forEach(o=>has[o][c]=false));
  const clauses=[];
  (s.hist||[]).forEach(h=>{
    const t=triple(h.s,h.w,h.r);
    h.passed.forEach(q=>{ if(has[q]) t.forEach(c=>setv(q,c,false)); });
    if(h.shower && has[h.shower]){
      if(h.by===p.id && h.card) owners.forEach(o=>{ has[o][h.card] = o===h.shower; });
      else if(h.shower!==p.id) clauses.push({o:h.shower, cards:t});
    }
  });
  const cats={s:CARDS.filter(c=>c[0]==='s'), w:CARDS.filter(c=>c[0]==='w'), r:CARDS.filter(c=>c[0]==='r')};
  for(let it=0; it<30; it++){
    let ch=false;
    for(const c of CARDS){
      const owner=owners.find(o=>has[o][c]===true);
      if(owner){ owners.forEach(o=>{ if(o!==owner) ch=setv(o,c,false)||ch; }); continue; }
      const open=owners.filter(o=>has[o][c]!==false);
      if(open.length===1 && !(s.up||[]).includes(c)) ch=setv(open[0],c,true)||ch;
    }
    for(const o of owners){
      if(o==='env'){
        for(const k in cats){
          const L=cats[k], t=L.filter(c=>has.env[c]===true), op=L.filter(c=>has.env[c]!==false);
          if(t.length===1) L.forEach(c=>{ if(c!==t[0]) ch=setv('env',c,false)||ch; });
          else if(op.length===1) ch=setv('env',op[0],true)||ch;
        }
        continue;
      }
      const n=handN(o), t=CARDS.filter(c=>has[o][c]===true), op=CARDS.filter(c=>has[o][c]!==false);
      if(t.length>=n) CARDS.forEach(c=>{ if(has[o][c]!==true) ch=setv(o,c,false)||ch; });
      else if(op.length===n) op.forEach(c=>{ ch=setv(o,c,true)||ch; });
    }
    for(const cl of clauses){
      if(cl.cards.some(c=>has[cl.o][c]===true)) continue;
      const op=cl.cards.filter(c=>has[cl.o][c]!==false);
      if(op.length===1) ch=setv(cl.o,op[0],true)||ch;
    }
    if(!ch) break;
  }
  const sol={};
  for(const k in cats){ const t=cats[k].find(c=>has.env[c]===true); if(t) sol[k]=cardIdx(t); }
  return {has, sol, unknown: k => cats[k].filter(c=>has.env[c]!==false)};
}

/* ====================== BOTS ====================== */
const BOT = {next:0};
const BOT_TALK = {
  sus:['Mmm… algo me huele mal 🤔','A ver, a ver… 🔎','Nde, esto no me cierra','¡Ajá! 🕵️','Upéicha raka\'e…'],
  win:['¡Lo sabía! 🎉','Elemental, che ra\'a 🎩','¡Caso cerrado! 🔒'],
  nobody:['¡Epa! Nadie tiene nada 😳','Mirá vos… 🤨'],
  room:['Linda pieza para un crimen 😬','Acá hay algo raro 👀','Pa\'i, ¿qué pasó acá?'],
};
const pick = a => a[rnd(a.length)];
const autoPlays = p => p.bot || (!p.conn && p.offAt && Date.now()-p.offAt>20000);
function botBestRoom(b, K){
  // la pieza que conviene: una que todavía puede ser la del crimen, la más cerca
  const unk=K.unknown('r').map(cardIdx);
  const cand = unk.length ? unk : ROOMS.map((x,i)=>i);
  let best=null, bd=1e9;
  cand.forEach(ri=>{ if(ri===b.room && !b.entered) return; const d=distToRoom(b, ri)+Math.random()*1.5; if(d<bd){ bd=d; best=ri; } });
  return best==null ? cand[0] : best;
}
function botPickSuggest(b, K){
  const choose = k => {
    if(K.sol[k]!=null && Math.random()<.5) return K.sol[k];   // a veces nombra lo que ya sabe, para averiguar lo otro
    const unk=K.unknown(k);
    if(unk.length) return cardIdx(pick(unk));
    return cardIdx(pick(CARDS.filter(c=>c[0]===k)));
  };
  return {s:choose('s'), w:choose('w')};
}
function botTick(){
  if(!S || S.phase!=='play' || (NET.mode!=='host' && NET.mode!=='local')) return;
  const now=Date.now();
  if(now<BOT.next) return;
  // alguien tiene que mostrar una carta
  if(S.refute && S.refute.waiting){
    const q=P(S.refute.waiting);
    if(q && autoPlays(q) && now-S.refute.at>900+rnd(900)){
      const ok=q.hand.filter(c=>S.refute.cards.includes(c));
      // si ya le mostró una a ese mismo, muestra la misma (así da menos pistas)
      const prev=ok.find(c=>S.hist.some(h=>h.shower===q.id && h.by===S.refute.by && h.card===c));
      BOT.next=now+600;
      return act(q.id, {type:'show', card: prev || pick(ok)});
    }
    return;
  }
  const b=cur(); if(!b || !autoPlays(b) || b.out) return;
  if(now-(S.turnAt||0) < 900+rnd(600)) return;
  BOT.next=now+800;
  const K=deduce(b);
  const sure = K.sol.s!=null && K.sol.w!=null && K.sol.r!=null;
  let r;
  if(S.step==='roll'){
    if(sure){ botChat(b, pick(BOT_TALK.win)); r=act(b.id, {type:'accuse', s:K.sol.s, w:K.sol.w, r:K.sol.r}); }
    else {
      const target=botBestRoom(b, K);
      if(S.opts.pombero && b.room!=null && ROOMS[b.room].pass===target) r=act(b.id,{type:'pass'});
      else r=act(b.id,{type:'roll'});
    }
  } else if(S.step==='move'){
    const R=reach(b, S.moves), target=botBestRoom(b, K), unk=K.unknown('r').map(cardIdx);
    const rooms=Object.keys(R.rooms).map(Number);
    let go = rooms.includes(target) ? target : rooms.find(x=>unk.includes(x));
    if(go!=null){ if(Math.random()<.15) botChat(b, pick(BOT_TALK.room)); r=act(b.id,{type:'move', room:go}); }
    else {
      const cells=Object.keys(R.cells);
      if(!cells.length) r=act(b.id,{type:'stay'});
      else {
        let bestC=null, bd=1e9;
        cells.forEach(k=>{ const d=(DIST[target][k]||99)+Math.random()*.5; if(d<bd){ bd=d; bestC=k; } });
        const here = b.room==null ? (DIST[target][b.pos.join(',')]||99) : distToRoom(b, target);
        if(b.room!=null && bd>=here && target!==b.room) r=act(b.id,{type:'stay'});
        else r=act(b.id,{type:'move', cell:bestC.split(',').map(Number)});
      }
    }
  } else if(S.step==='suggest'){
    const x=botPickSuggest(b, K);
    if(Math.random()<.25) botChat(b, pick(BOT_TALK.sus));
    r=act(b.id,{type:'suggest', s:x.s, w:x.w});
  } else if(S.step==='after'){
    const K2=deduce(b);
    if(K2.sol.s!=null && K2.sol.w!=null && K2.sol.r!=null){ botChat(b, pick(BOT_TALK.win)); r=act(b.id,{type:'accuse', s:K2.sol.s, w:K2.sol.w, r:K2.sol.r}); }
    else r=act(b.id,{type:'endTurn'});
  }
  if(typeof r==='string'){ console.warn('bot', r, S.step); act(b.id,{type: S.step==='suggest'||S.step==='after' ? 'endTurn' : 'stay'}); }
}
setInterval(botTick, 400);
function botPrivate(bot, from, text){
  const t=text.toLowerCase();
  const ans = /qui[eé]n|sospech|fue/.test(t) ? pick(['Yo no digo nada 🤐','Mmm… para mí fue el que menos pensás 😏','¿Y vos qué me das a cambio? 🧉','Shhh… las paredes oyen 👂'])
    : pick(['Jaja, upéi hablamos 🧉','Shhh, que nadie se entere 🤫','Estoy pensando… 🤔','Mba\'éichapa, pesquisa 👋']);
  setTimeout(()=>{ if(S) addChat(bot.id, ans, from.id); }, 900+rnd(1500));
}
