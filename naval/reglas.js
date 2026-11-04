'use strict';
/* =====================================================================
   Batalla Naval PY — flotas, colocación de barcos, tiros por letra y
   número, formas de jugar (duelo, todos contra todos, equipos) y bots.
   Todo lo decide el anfitrión. Cada uno solo recibe su propia flota;
   de los demás solo ve los tiros y los barcos ya hundidos.
   ===================================================================== */
const LETRAS='ABCDEFGHIJKLMNOP';
const FLOTAS={
  clasica:{t:'⚓ Clásica (5 barcos, 10×10)', n:10, toca:true, ships:[['porta','Portaaviones',5],['acor','Acorazado',4],['cruc','Crucero',3],['sub','Submarino',3],['dest','Destructor',2]]},
  cuaderno:{t:'📓 De cuaderno (10 barcos, 10×10)', n:10, toca:false, ships:[['acor','Acorazado',4],['cruc','Crucero',3],['cruc','Crucero',3],['dest','Destructor',2],['dest','Destructor',2],['dest','Destructor',2],['sub','Submarino',1],['sub','Submarino',1],['sub','Submarino',1],['sub','Submarino',1]]},
  rio:{t:'🇵🇾 Armada del río (10×10)', n:10, toca:true, ships:[['canpy','Cañonero Paraguay',5],['canhu','Cañonero Humaitá',4],['patru','Patrullero',3],['remo','Remolcador',3],['lancha','Lancha',2],['lancha','Lancha',2]]},
  rapida:{t:'⚡ Rápida (4 barcos, 8×8)', n:8, toca:true, ships:[['acor','Acorazado',4],['cruc','Crucero',3],['dest','Destructor',2],['dest','Destructor',2]]},
  grande:{t:'🌊 Grande (8 barcos, 12×12)', n:12, toca:true, ships:[['porta','Portaaviones',5],['acor','Acorazado',4],['acor','Acorazado',4],['cruc','Crucero',3],['sub','Submarino',3],['cruc','Crucero',3],['dest','Destructor',2],['dest','Destructor',2]]},
};
const TIROS={
  uno:{t:'🎯 Un tiro por turno', d:'Cada uno tira una bomba y pasa el turno.'},
  sigue:{t:'🔁 Si acertás, seguís tirando', d:'Mientras le pegues a un barco seguís tirando; con agua pasa el turno.'},
  salva:{t:'💥 Salva', d:'Tirás tantas bombas como barcos te quedan a flote: si te hunden barcos, tirás menos.'},
  tres:{t:'3️⃣ Tres tiros por turno', d:'Siempre tres bombas por turno.'},
};
const FORMATS={ind:'👤 Cada uno con su flota (de a 2 es un duelo; de 3 o más, todos contra todos)', eq:'👥 Por equipos (cada equipo comparte una flota y se turnan para tirar)'};
const HOUSE=[
  {k:'toca', t:'🤝 Los barcos se pueden tocar', d:'Si está apagado, entre barco y barco tiene que haber agua (ni de costado ni en diagonal), como en el cuaderno.', def:null},
  {k:'avisar', t:'📢 Decir qué barco se tocó', d:'Al pegarle a un barco se dice cuál es (“¡Tocado el Crucero!”). Si está apagado, solo se sabe cuando se hunde.', def:false},
  {k:'marcar', t:'🌊 Marcar el agua alrededor del hundido', d:'Cuando se hunde un barco se marcan solas las casillas de alrededor. Funciona solo cuando los barcos no se pueden tocar.', def:true},
  {k:'obsVen', t:'👀 Los que miran ven todas las flotas', d:'Si está apagado, los que miran solo ven los tiros, igual que los jugadores.', def:false},
  {k:'voz', t:'🗣️ Cantar los tiros en voz alta', d:'El juego dice la letra, el número y si fue agua, tocado o hundido.', def:true},
];
const RACES=[{v:1,t:'Una sola batalla'},{v:2,t:'Al mejor de 3 (gana 2)'},{v:3,t:'Al mejor de 5 (gana 3)'}];
const TIMERS=[{v:0,t:'Sin límite'},{v:20,t:'20 segundos'},{v:40,t:'40 segundos'},{v:60,t:'1 minuto'}];
const PTIMERS=[{v:0,t:'Sin límite'},{v:60,t:'1 minuto'},{v:120,t:'2 minutos'}];
const BOTLV=[{v:'facil',t:'🙂 Fácil'},{v:'normal',t:'😎 Normal'},{v:'crack',t:'🔥 Almirante (muy difícil)'}];
function defaultOpts(){ const o={flota:'clasica', tiros:'uno', fmt:'ind', race:1, timer:0, ptimer:0, bot:'normal'}; HOUSE.forEach(h=>o[h.k]=h.def); o.toca=FLOTAS.clasica.toca; return o; }
const fleetDef = o => FLOTAS[o.flota]||FLOTAS.clasica;
const coordTxt = (r,c) => LETRAS[r]+(c+1);
function parseCoord(t, n){
  const m=String(t||'').trim().toUpperCase().replace(/\s+/g,'').match(/^([A-P])(\d{1,2})$|^(\d{1,2})([A-P])$/); if(!m) return null;
  const L=m[1]||m[4], N=+(m[2]||m[3]), r=LETRAS.indexOf(L), c=N-1;
  return r>=0 && r<n && c>=0 && c<n ? {r,c} : null;
}

let S=null;
const EMOJIS=['⚓','🧉','🐆','🦜','🐂','🌽','🎻','⚽','🦉','🐊','🌸','🎸','🐎','🦋','🌞','🐟','🦈','🐬','🛟','🧭'];
const PCOLORS=['#e63946','#1d70d6','#2a9d3f','#e9a100','#8e44ad','#ff7f11'];
const TEAMS=[{n:'Flota Roja', e:'🔴', c:'#e63946'}, {n:'Flota Azul', e:'🔵', c:'#1d70d6'}];
const BOT_NAMES=[['Almirante Bot','⚓'],['Capitán Surubí','🐟'],['Ña Marinera','🌸'],['Karai Torpedo','🧉'],['Pombero del Río','👹'],['Don Timón','🧭']];
const MAXP=6;
const P = id => S && S.players.find(p=>p.id===id);
const OB = id => S && (S.observers||[]).find(o=>o.id===id);
function rnd(n){ if(window.crypto && crypto.getRandomValues){ const a=new Uint32Array(1); crypto.getRandomValues(a); return a[0]%n; } return Math.floor(Math.random()*n); }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=rnd(i+1); [a[i],a[j]]=[a[j],a[i]]; } return a; }

function lobbyState(){
  return {v:1, phase:'lobby', seq:0, players:[], observers:[], hostPid:null, opts:defaultOpts(), grules:'', sugs:[], log:[],
    sides:[], cur:0, left:0, round:0, shots:[], shotN:0, busyUntil:0, roundWin:null, turnAt:0, placeAt:0};
}
function addPlayer(name, emoji, token, peerId, bot, local){
  const used=S.players.map(p=>p.color);
  const t0=S.players.filter(p=>p.team===0).length, t1=S.players.filter(p=>p.team===1).length;
  const p={id:'p'+(++S.seq), name:(String(name||'').trim()||'Jugador').slice(0,16), emoji, token, peerId,
    color:PCOLORS.find(c=>!used.includes(c))||PCOLORS[S.players.length%PCOLORS.length],
    conn:!bot, bot:!!bot, local:!!local, mic:false, team: t0<=t1 ? 0 : 1};
  S.players.push(p); return p;
}
function addBot(){
  if(S.players.length>=MAXP) return `Ya son ${MAXP} jugadores (el máximo).`;
  const free=BOT_NAMES.filter(([n])=>!S.players.some(p=>p.name===n));
  const [n,e]=free.length?free[rnd(free.length)]:['Bot '+(S.players.length+1),'🤖'];
  const b=addPlayer(n, e, null, null, true);
  sysChat(`🤖 ${b.name} se sumó a la batalla.`);
}
function log(x){ S.log.push({x, at:Date.now()}); if(S.log.length>250) S.log.splice(0, S.log.length-250); }

/* ---------- flotas ---------- */
// casillas de un barco colocado
const shipCells = s => [...Array(s.l)].map((_,i)=>s.dir==='v' ? [s.r+i, s.c] : [s.r, s.c+i]);
// revisa una flota entera: [{r,c,dir}] en el orden de la flota de las reglas. Devuelve el texto del error o null.
function fleetError(list, o){
  const F=fleetDef(o), n=F.n, toca=o.toca!==false;
  if(!Array.isArray(list) || list.length!==F.ships.length) return 'Faltan barcos por poner.';
  const occ=new Map();
  for(let i=0;i<list.length;i++){
    const s=list[i]; if(!s) return 'Faltan barcos por poner.';
    const sh={r:+s.r, c:+s.c, dir:s.dir==='v'?'v':'h', l:F.ships[i][2]};
    for(const [r,c] of shipCells(sh)){
      if(!(r>=0 && r<n && c>=0 && c<n)) return `El ${F.ships[i][1]} se sale del mar.`;
      if(occ.has(r*n+c)) return 'Dos barcos no pueden estar en la misma casilla.';
      occ.set(r*n+c, i);
    }
  }
  if(!toca) for(const [k,i] of occ){ const r=Math.floor(k/n), c=k%n;
    for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){ const j=occ.get((r+dr)*n+(c+dc)); if(r+dr>=0&&r+dr<n&&c+dc>=0&&c+dc<n && j!=null && j!==i) return 'Con esta regla los barcos no se pueden tocar (ni en diagonal).'; } }
  return null;
}
function randomFleet(o){
  const F=fleetDef(o);
  for(let tries=0; tries<400; tries++){
    const list=[];
    let ok=true;
    for(let i=0;i<F.ships.length && ok;i++){
      let placed=false;
      for(let k=0;k<200;k++){
        const dir=rnd(2)?'h':'v', l=F.ships[i][2], r=rnd(dir==='v'?F.n-l+1:F.n), c=rnd(dir==='h'?F.n-l+1:F.n);
        list[i]={r,c,dir};
        if(!partialError(list, o)){ placed=true; break; }   // revisa solo lo puesto hasta ahora
      }
      if(!placed) ok=false;
    }
    if(ok) return list;
  }
  return null;
}
function partialError(part, o){
  const F=fleetDef(o), n=F.n, toca=o.toca!==false, occ=new Map();
  for(let i=0;i<part.length;i++){ const s=part[i]; if(!s) continue;
    for(const [r,c] of shipCells({r:s.r,c:s.c,dir:s.dir,l:F.ships[i][2]})){
      if(!(r>=0 && r<n && c>=0 && c<n) || occ.has(r*n+c)) return 'x';
      occ.set(r*n+c, i);
    } }
  if(!toca) for(const [k,i] of occ){ const r=Math.floor(k/n), c=k%n;
    for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){ if(r+dr<0||r+dr>=n||c+dc<0||c+dc>=n) continue; const j=occ.get((r+dr)*n+(c+dc)); if(j!=null && j!==i) return 'x'; } }
  return null;
}
function buildFleet(list, o){
  const F=fleetDef(o);
  return F.ships.map(([k,n,l],i)=>({i, k, n, l, r:+list[i].r, c:+list[i].c, dir:list[i].dir==='v'?'v':'h', hit:0, sunk:false}));
}

/* ---------- lados y turnos ---------- */
function buildSides(){
  const o=S.opts;
  if(o.fmt==='eq') S.sides=[0,1].map(t=>({team:t, pids:S.players.filter(p=>p.team===t).map(p=>p.id), k:-1, fleet:null, ready:false, grid:null, out:false, wins:0, shotsF:0, hitsF:0}));
  else S.sides=S.players.map(p=>({team:null, pids:[p.id], k:-1, fleet:null, ready:false, grid:null, out:false, wins:0, shotsF:0, hitsF:0}));
}
function sideName(st, i){
  const s=st.sides[i]; if(!s) return '?';
  if(s.team!=null) return TEAMS[s.team].e+' '+TEAMS[s.team].n;
  const p=st.players.find(x=>x.id===s.pids[0]); return p ? p.name : '?';
}
function sideOf(st, pid){ return st.sides.findIndex(s=>s.pids.includes(pid)); }
function shooterOf(st){ const s=st.sides[st.cur]; if(!s || !s.pids.length) return null; return s.pids[((s.k%s.pids.length)+s.pids.length)%s.pids.length]; }
const alive = st => st.sides.map((s,i)=>i).filter(i=>!st.sides[i].out && st.sides[i].pids.length);
const shipsAfloat = s => s.fleet ? s.fleet.filter(x=>!x.sunk).length : 0;
function startGame(){ buildSides(); S.round=0; S.startedAt=Date.now(); S.first=rnd(S.sides.length); newRound(); }
function newRound(){
  const o=S.opts, n=fleetDef(o).n;
  S.round++; S.phase='place'; S.roundWin=null; S.shots=[]; S.placeAt=Date.now();
  S.sides.forEach(s=>{ s.fleet=null; s.ready=false; s.grid=Array(n*n).fill(0); s.out=false; s.shotsF=0; s.hitsF=0; });
  // los bots ponen su flota enseguida
  S.sides.forEach((s,i)=>{ if(s.pids.every(pid=>{ const p=P(pid); return p && p.bot; })) setFleet(i, randomFleet(o)); });
  log(`⚓ Batalla ${S.round}: ${fleetDef(o).t}. ¡A poner los barcos!`);
  checkAllReady();
}
function setFleet(i, list){ const s=S.sides[i]; s.fleet=buildFleet(list, S.opts); s.ready=true; }
function checkAllReady(){
  if(S.phase!=='place' || !S.sides.every(s=>s.ready)) return false;
  S.phase='play';
  const al=alive(S); S.cur = al.includes(S.first%S.sides.length) ? S.first%S.sides.length : al[0];
  S.first++;
  log(`💣 ¡Empieza la batalla! Tira primero ${sideName(S,S.cur)}.`);
  startTurn();
  return true;
}
function startTurn(){
  const s=S.sides[S.cur], t=S.opts.tiros;
  s.k++;
  S.left = t==='salva' ? Math.max(1, shipsAfloat(s)) : t==='tres' ? 3 : 1;
  S.turnAt=Date.now();
}
function nextTurn(){
  const al=alive(S); if(al.length<=1) return;
  let i=S.cur; do{ i=(i+1)%S.sides.length; } while(!al.includes(i));
  S.cur=i; startTurn();
}

/* ---------- tiros ---------- */
// marcas de cada casilla del mar de un lado: 0 sin tirar, 1 agua, 2 tocado, 3 hundido, 4 agua marcada sola
function fire(fromI, toI, r, c){
  const o=S.opts, F=fleetDef(o), n=F.n, T=S.sides[toI], k=r*n+c;
  const ship=T.fleet.find(sh=>shipCells(sh).some(([y,x])=>y===r && x===c));
  const sh=S.sides[fromI]; sh.shotsF++;
  const res={n:++S.shotN, from:fromI, to:toI, r, c, pid:shooterOf(S), at:Date.now(), res:'agua', ship:null, cells:null, auto:null, out:false};
  if(!ship){ T.grid[k]=1; }
  else {
    sh.hitsF++; ship.hit++; T.grid[k]=2; res.res='tocado';
    if(o.avisar) res.ship=ship.n;
    if(ship.hit>=ship.l){
      ship.sunk=true; res.res='hundido'; res.ship=ship.n;
      const cells=shipCells(ship); res.cells=cells; cells.forEach(([y,x])=>T.grid[y*n+x]=3);
      res.sh={r:ship.r, c:ship.c, dir:ship.dir, l:ship.l, k:ship.k};
      if(o.marcar && o.toca===false){ res.auto=[];   // solo si los barcos no se tocan: si no, alrededor puede haber otro barco
        cells.forEach(([y,x])=>{ for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ const yy=y+dy, xx=x+dx; if(yy<0||yy>=n||xx<0||xx>=n) continue; if(T.grid[yy*n+xx]===0){ T.grid[yy*n+xx]=4; res.auto.push([yy,xx]); } } });
      }
      if(T.fleet.every(x=>x.sunk)){ T.out=true; res.out=true; }
    }
  }
  S.shots.push(res); if(S.shots.length>40) S.shots.shift();
  const who=P(res.pid), txt = res.res==='agua' ? 'agua 💧' : res.res==='tocado' ? `¡tocado${res.ship?' el '+res.ship:''}! 🔥` : `¡hundido el ${res.ship}! 💥`;
  log(`💣 ${who?who.name:sideName(S,fromI)} → ${sideName(S,toI)}: ${coordTxt(r,c)}, ${txt}${res.out?` · ¡${sideName(S,toI)} se quedó sin barcos!`:''}`);
  return res;
}
function afterShot(res){
  const o=S.opts, al=alive(S);
  if(al.length<=1){ return roundOver(al[0], `${sideName(S,al[0])} hundió toda la flota ${S.sides.length>2?'de los demás':'enemiga'}.`); }
  if(o.tiros==='sigue'){ if(res.res==='agua') nextTurn(); else S.turnAt=Date.now(); return; }
  S.left--;
  if(S.left<=0 || S.sides[S.cur].out) nextTurn(); else S.turnAt=Date.now();
}
function roundOver(w, why){
  S.sides[w].wins++;
  S.roundWin={side:w, why, at:Date.now()};
  S.phase = S.sides[w].wins>=S.opts.race ? 'over' : 'roundEnd';
  log(`🏆 ${why}`);
}

/* ====================== ACCIONES ====================== */
const isLocalCtl = pid => { const p=P(pid); return NET.mode==='local' && p && !p.bot; };
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
    case 'vote': { const s=S.sugs.find(x=>x.id===a.id); if(!s) return; s.votes = s.votes.includes(pid) ? s.votes.filter(x=>x!==pid) : s.votes.concat(pid); commit(); return; }
    case 'joinNext': {
      const o=OB(pid); if(!o) return;
      if(S.phase!=='lobby' && S.phase!=='over') return 'Esperá a que termine la partida para sumarte.';
      if(S.players.length>=MAXP) return 'Ya no hay lugar.';
      if(o.owner) return;
      S.observers=S.observers.filter(x=>x!==o);
      const np=addPlayer(o.name, o.emoji==='👀'?EMOJIS.find(e=>!S.players.some(q=>q.emoji===e)):o.emoji, o.token, o.peerId);
      np.conn=o.conn;
      if(typeof onSeatChange==='function') onSeatChange(pid, np.id);
      sysChat(`⚓ ${np.name} se sumó a jugar.`); commit(); return;
    }
  }
  if(!p) return;
  const host = pid===S.hostPid || NET.mode==='local';
  switch(a.type){
    case 'addBot': if(!host||S.phase!=='lobby') return; { const r=addBot(); if(r) return r; } commit(); return;
    case 'addLocal': {
      if(NET.mode!=='local' || S.phase!=='lobby') return;
      if(S.players.length>=MAXP) return `Ya son ${MAXP} jugadores.`;
      const nm=String(a.name||'').trim().slice(0,16); if(!nm) return;
      const np=addPlayer(nm, EMOJIS.find(e=>!S.players.some(q=>q.emoji===e))||'⚓', null, null, false, true); np.conn=true;
      sysChat(`🙋 ${np.name} juega en este aparato.`); commit(); return;
    }
    case 'team': { if(S.phase!=='lobby') return; const t=P(a.pid); if(!t || (!host && t.id!==pid)) return; t.team = t.team ? 0 : 1; commit(); return; }
    case 'kick': { if(!host) return; const t=P(a.pid); if(!t || t.id===S.hostPid) return; removePlayer(t, `🚪 ${t.name} salió de la batalla.`); commit(); return; }
    case 'botify': { if(!host) return; const t=P(a.pid); if(!t || t.bot) return; t.bot=true; t.conn=false; t.mic=false; t.token=null; sysChat(`🤖 Un bot sigue jugando por ${t.name}.`); botPlaceIfNeeded(); commit(); return; }
    case 'opt': {
      if(!host || S.phase!=='lobby') return;
      const o=S.opts, v=a.v;
      if(a.k==='flota' && FLOTAS[v]){ o.flota=v; o.toca=FLOTAS[v].toca; }
      else if(a.k==='tiros' && TIROS[v]) o.tiros=v;
      else if(a.k==='fmt' && FORMATS[v]) o.fmt=v;
      else if(a.k==='race' && RACES.some(x=>x.v==v)) o.race=+v;
      else if(a.k==='timer' && TIMERS.some(x=>x.v==v)) o.timer=+v;
      else if(a.k==='ptimer' && PTIMERS.some(x=>x.v==v)) o.ptimer=+v;
      else if(a.k==='bot' && BOTLV.some(x=>x.v===v)) o.bot=v;
      else if(HOUSE.some(h=>h.k===a.k)) o[a.k]=!!v;
      commit(); return;
    }
    case 'grules': if(!host) return; S.grules=String(a.text||'').slice(0,1200); commit(); return;
    case 'sugDel': if(!host) return; S.sugs=S.sugs.filter(s=>s.id!==a.id); commit(); return;
    case 'start': {
      if(!host || S.phase!=='lobby') return;
      const r=canStart(); if(r) return r;
      startGame(); sysChat(`⚓ ¡Empieza! ${fleetDef(S.opts).t}. Cada uno pone sus barcos.`); commit(); return;
    }
    case 'place': {   // la flota entera de su lado
      if(S.phase!=='place') return;
      const i=sideOf(S, a.as && isLocalCtl(a.as) ? a.as : pid); if(i<0) return;
      const e=fleetError(a.fleet, S.opts); if(e) return e;
      setFleet(i, a.fleet);
      sysChat(`✅ ${sideName(S,i)} ya puso sus barcos.`);
      checkAllReady(); commit(); return;
    }
    case 'unready': {
      if(S.phase!=='place') return;
      const i=sideOf(S, a.as && isLocalCtl(a.as) ? a.as : pid); if(i<0) return;
      S.sides[i].ready=false; S.sides[i].fleet=null; commit(); return;
    }
    case 'fire': {
      if(S.phase!=='play') return;
      const sh=shooterOf(S);
      if(sh!==pid && !(NET.mode==='local' && isLocalCtl(sh))) return 'No es tu turno.';
      if(Date.now() < S.busyUntil-300) return 'Esperá que caiga la bomba.';
      const n=fleetDef(S.opts).n, r=+a.r, c=+a.c, to=+a.to;
      if(!(r>=0 && r<n && c>=0 && c<n)) return 'Esa casilla no existe.';
      const T=S.sides[to]; if(!T || to===S.cur || T.out) return 'Elegí a quién tirarle.';
      if(T.grid[r*n+c]) return `Ya se tiró en ${coordTxt(r,c)}.`;
      const res=fire(S.cur, to, r, c);
      S.busyUntil=Date.now()+1500;
      afterShot(res); commit(); return;
    }
    case 'nextRound': if(!host || S.phase!=='roundEnd') return; newRound(); commit(); return;
    case 'rematch': if(!host || S.phase!=='over') return; startGame(); sysChat('🔁 ¡Revancha! Otra batalla.'); commit(); return;
    case 'newGame': if(!host || (S.phase!=='over' && S.phase!=='roundEnd' && !a.force)) return;
      S.phase='lobby'; S.log=[]; S.sides=[]; S.shots=[]; S.roundWin=null; commit(); return;
    case 'leave': {
      if(S.phase==='lobby' || S.phase==='over') removePlayer(p, `🚪 ${p.name} se fue.`);
      else { p.bot=true; p.conn=false; p.mic=false; p.token=null; sysChat(`🚪 ${p.name} se fue: un bot 🤖 sigue por él.`); botPlaceIfNeeded(); }
      commit(); return;
    }
  }
}
function canStart(){
  const o=S.opts, n=S.players.length;
  if(n<2) return 'Hacen falta al menos 2 jugadores (sumá un bot 🤖).';
  if(o.fmt==='eq'){
    const a=S.players.filter(p=>p.team===0).length, b=S.players.filter(p=>p.team===1).length;
    if(!a || !b) return 'Cada equipo necesita al menos un jugador. Tocá 🔴/🔵 al lado de cada nombre para cambiarlo de equipo.';
  }
  return null;
}
function removePlayer(t, msg){
  if(S.phase==='lobby' || S.phase==='over'){ S.players=S.players.filter(x=>x!==t); }
  else { t.bot=true; t.conn=false; t.token=null; }
  if(NET.mode==='host' && NET.conns[t.id]){ try{ NET.conns[t.id].send({t:'kicked'}); }catch(e){} }
  sysChat(msg);
}
function botPlaceIfNeeded(){
  if(!S || S.phase!=='place') return;
  S.sides.forEach((s,i)=>{ if(!s.ready && s.pids.every(pid=>{ const p=P(pid); return p && p.bot; })) setFleet(i, randomFleet(S.opts)); });
  checkAllReady();
}

/* ====================== BOTS ====================== */
const BOT={busy:false};
const BOT_TALK={
  hit:['¡Te encontré! 😎','Ahí estaba 🔥','¡Tomá, torpedo! 🧉'],
  sink:['¡Al fondo del río! 💥','Uno menos 😏','Glu glu glu… 🐟'],
  miss:['Uff, agua 💧','Ese mar está muy tranquilo…','Ya te voy a encontrar 👀'],
  win:['¡Victoria naval! 🏆','Fue estrategia… o suerte 😏'],
};
const pick = a => a[rnd(a.length)];
const autoPlays = p => p && (p.bot || (!p.conn && p.offAt && Date.now()-p.offAt>20000));
// lo que se sabe del mar de un lado (lo mismo que ve cualquiera): marcas y largos de los barcos que quedan
function seaInfo(st, i){
  const s=st.sides[i], n=fleetDef(st.opts).n;
  return {n, g:s.grid, left:s.fleet.filter(x=>!x.sunk).map(x=>x.l)};
}
// elige casilla: fácil = al azar y algo de puntería; normal = caza con damero y sigue la línea; almirante = densidad de probabilidad
function botCell(info, lv, toca){
  const {n, g, left}=info, free=[], hits=[];
  for(let k=0;k<n*n;k++){ if(!g[k]) free.push(k); if(g[k]===2) hits.push(k); }
  if(!free.length) return null;
  const near=k=>[[1,0],[-1,0],[0,1],[0,-1]].map(([dr,dc])=>{ const r=Math.floor(k/n)+dr, c=k%n+dc; return r>=0&&r<n&&c>=0&&c<n ? r*n+c : -1; }).filter(x=>x>=0 && !g[x]);
  if(lv==='facil'){
    if(hits.length && rnd(3)===0){ const opts=[].concat(...hits.map(near)); if(opts.length) return opts[rnd(opts.length)]; }
    return free[rnd(free.length)];
  }
  if(lv==='normal' && hits.length){
    // si hay dos o más tocados en línea, sigue la línea
    for(const h of hits){ const r=Math.floor(h/n), c=h%n;
      for(const [dr,dc] of [[0,1],[1,0]]){ const nb=(r+dr)*n+(c+dc);
        if(r+dr<n && c+dc<n && g[nb]===2){
          const line=[]; let y=r, x=c; while(y>=0&&x>=0&&y<n&&x<n&&g[y*n+x]===2){ y-=dr; x-=dc; } if(y>=0&&x>=0&&y<n&&x<n&&!g[y*n+x]) line.push(y*n+x);
          y=r; x=c; while(y>=0&&x>=0&&y<n&&x<n&&g[y*n+x]===2){ y+=dr; x+=dc; } if(y>=0&&x>=0&&y<n&&x<n&&!g[y*n+x]) line.push(y*n+x);
          if(line.length) return line[rnd(line.length)];
        } } }
    const opts=[].concat(...hits.map(near)); if(opts.length) return opts[rnd(opts.length)];
  }
  if(lv==='normal'){   // busca al azar en damero (no hace falta tirar en las casillas pegadas)
    const par=free.filter(k=>(Math.floor(k/n)+k%n)%2===0);
    const L=par.length ? par : free; return L[rnd(L.length)];
  }
  // densidad: cuenta en cuántas posiciones posibles de los barcos que quedan entra cada casilla
  const w=Array(n*n).fill(0), minL=Math.min(...left, 99);
  const blocked=k=>g[k]===1||g[k]===3||g[k]===4;
  for(const L of left) for(let r=0;r<n;r++) for(let c=0;c<n;c++) for(const v of [0,1]){
    const cells=[]; let ok=true, cover=0;
    for(let i=0;i<L;i++){ const y=r+(v?i:0), x=c+(v?0:i); if(y>=n||x>=n){ ok=false; break; } const k=y*n+x; if(blocked(k)){ ok=false; break; } if(g[k]===2) cover++; cells.push(k); }
    if(!ok) continue;
    if(!toca && cells.some(k=>{ const y=Math.floor(k/n), x=k%n; for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ const yy=y+dy, xx=x+dx; if(yy<0||yy>=n||xx<0||xx>=n) continue; if(g[yy*n+xx]===3 && !cells.includes(yy*n+xx)) return true; } return false; })) continue;
    const wt = hits.length ? (cover ? 1+cover*40 : (lv==='crack'?0.02:0.2)) : 1;
    cells.forEach(k=>{ if(!g[k]) w[k]+=wt; });
  }
  let best=-1, bk=[];
  for(const k of free){ let v=w[k]; if(!hits.length && lv==='normal' && ((Math.floor(k/n)+k%n)%Math.max(2,minL))) v*=.35; if(v>best+1e-9){ best=v; bk=[k]; } else if(Math.abs(v-best)<1e-9) bk.push(k); }
  return bk.length ? bk[rnd(bk.length)] : free[rnd(free.length)];
}
function botPlan(lvOverride){
  const lv=lvOverride||S.opts.bot, al=alive(S).filter(i=>i!==S.cur);
  // a quién: al que tiene un barco tocado sin hundir, si no al que menos barcos le quedan (o al azar)
  const withHit=al.filter(i=>S.sides[i].grid.includes(2));
  const to = withHit.length ? withHit[rnd(withHit.length)] : lv==='crack' ? al.slice().sort((a,b)=>shipsAfloat(S.sides[a])-shipsAfloat(S.sides[b]))[0] : al[rnd(al.length)];
  const k=botCell(seaInfo(S, to), lv, S.opts.toca!==false), n=fleetDef(S.opts).n;
  return {to, r:Math.floor(k/n), c:k%n};
}
function botTick(){
  if(!S || NET.mode==='client' || BOT.busy) return;
  if(S.phase==='roundEnd' && S.roundWin && Date.now()-S.roundWin.at>15000){ newRound(); commit(); return; }
  if(S.phase==='place'){
    // tiempo para poner los barcos: al que no terminó se le ponen al azar
    if(S.opts.ptimer && Date.now()>S.placeAt+S.opts.ptimer*1000){ S.sides.forEach((s,i)=>{ if(!s.ready){ setFleet(i, randomFleet(S.opts)); sysChat(`⏰ Se acabó el tiempo: a ${sideName(S,i)} se le pusieron los barcos al azar.`); } }); checkAllReady(); commit(); }
    else if(S.sides.some(s=>!s.ready && s.pids.every(pid=>autoPlays(P(pid))))){ botPlaceIfNeeded(); commit(); }
    return;
  }
  if(S.phase!=='play') return;
  const pid=shooterOf(S), p=P(pid);
  const late = S.opts.timer>0 && p && !p.bot && Date.now() > Math.max(S.turnAt, S.busyUntil) + S.opts.timer*1000;
  if(!autoPlays(p) && !late) return;
  if(Date.now() < S.busyUntil + 300) return;
  BOT.busy=true;
  setTimeout(()=>{
    try{
      if(!S || S.phase!=='play' || shooterOf(S)!==pid) return;
      if(late && !autoPlays(p)) sysChat(`⏰ Se le acabó el tiempo a ${p.name}: tiró el bot por él.`);
      const plan=botPlan(late?'facil':null);
      S.busyUntil=0;
      act(pid, Object.assign({type:'fire'}, plan));
      const last=S && S.shots[S.shots.length-1];
      if(p.bot && last && rnd(4)===0){
        setTimeout(()=>{ if(!S) return; botChat(p, pick(S.phase==='over'||S.phase==='roundEnd' ? BOT_TALK.win : last.res==='hundido'?BOT_TALK.sink:last.res==='tocado'?BOT_TALK.hit:BOT_TALK.miss)); }, 1600);
      }
    } finally { BOT.busy=false; }
  }, late ? 200 : 700+rnd(900));
}
setInterval(botTick, 400);
function botPrivate(bot, from){
  setTimeout(()=>{ if(!S) return; addChat(bot.id, pick(['Shhh, estoy calculando coordenadas 🧭','Jaja, no te voy a decir dónde están mis barcos 😏','¿Me querés distraer? 😂']), from.id); }, 1200+rnd(1500));
}
