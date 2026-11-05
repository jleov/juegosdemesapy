'use strict';
/* =====================================================================
   Escoba de 15 — baraja española de 40 cartas, reglas reales,
   reglas de la casa, conteo de puntos y bots.
   Todo lo decide el anfitrión (o el propio aparato en la práctica):
   act(pid, accion) cambia el estado S y devuelve un texto si no se puede.
   ===================================================================== */

/* ---------- la baraja española ---------- */
const SUITS = ['o','c','e','b'];
const SUIT_INFO = {
  o:{n:'Oros',    s:'oros',    emo:'🪙', hex:'#c99400', dark:'#7a5600'},
  c:{n:'Copas',   s:'copas',   emo:'🍷', hex:'#c62828', dark:'#7d1010'},
  e:{n:'Espadas', s:'espadas', emo:'🗡️', hex:'#1d4fb8', dark:'#0e2c6e'},
  b:{n:'Bastos',  s:'bastos',  emo:'🪵', hex:'#2e7d32', dark:'#174d1a'},
};
const RANKS = [1,2,3,4,5,6,7,10,11,12];
// las figuras con nombre en guaraní (sale escrito en la carta)
const FIG = {10:{n:'Sota', gn:'Mitã', l:'S'}, 11:{n:'Caballo', gn:'Kavaju', l:'C'}, 12:{n:'Rey', gn:'Mburuvicha', l:'R'}};
const val = c => c.n<=7 ? c.n : c.n-2;          // sota 8, caballo 9, rey 10
const isVelo = c => c && c.s==='o' && c.n===7;    // el siete de oros, el “siete velo”
const rankName = n => n===1 ? 'As' : FIG[n] ? FIG[n].n : String(n);
const rankShort = n => FIG[n] ? FIG[n].l : n===1 ? 'A' : String(n);
function cardName(c){
  if(!c) return '';
  if(isVelo(c)) return '7 de oros (el siete velo)';
  return `${rankName(c.n)} de ${SUIT_INFO[c.s].s}`;
}
const cardShort = c => `${rankShort(c.n)}${SUIT_INFO[c.s].emo}`;
const listName = cs => cs.map(cardName).join(', ');
const sumV = cs => cs.reduce((t,c)=>t+val(c),0);
function newDeck(){ const d=[]; let id=1; for(const s of SUITS) for(const n of RANKS) d.push({id:id++, s, n}); return d; }
function rnd(n){ if(window.crypto && crypto.getRandomValues){ const a=new Uint32Array(1); crypto.getRandomValues(a); return a[0]%n; } return Math.floor(Math.random()*n); }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=rnd(i+1); [a[i],a[j]]=[a[j],a[i]]; } return a; }

// todas las formas de juntar 15 con la carta tirada y cartas de la mesa (devuelve listas de cartas de la mesa)
function combos(card, table){
  const need=15-val(card), out=[], t=table.slice().sort((a,b)=>val(b)-val(a));
  if(need<=0) return out;
  (function go(i, left, acc){
    if(left===0){ out.push(acc.slice()); return; }
    for(let k=i;k<t.length;k++){ const v=val(t[k]); if(v>left) continue; acc.push(t[k]); go(k+1, left-v, acc); acc.pop(); }
  })(0, need, []);
  return out;
}

/* ---------- reglas de la casa (las elige el anfitrión en la sala) ---------- */
const HOUSE = [
  {k:'mesaInicial', def:true,  t:'🃏 La mesa inicial es del que reparte', d:'Si las 4 cartas de la mesa suman 15, el que reparte se las lleva y es escoba. Si suman 30, se las lleva y son 2 escobas (regla clásica).'},
  {k:'lastEscoba',  def:true,  t:'🧹 Vale la escoba de la última jugada', d:'Si con la última carta de la mano se barre la mesa, cuenta como escoba. Desmarcado: esa última no cuenta (así se juega en muchos lugares).'},
  {k:'forceCap',    def:false, t:'👉 Si se puede levantar, se levanta', d:'Si la carta que tirás junta 15 con algo de la mesa, tenés que levantar sí o sí (no vale tirarla de “muerta”).'},
  {k:'tieBoth',     def:false, t:'🤝 Empate: punto para todos los empatados', d:'Si hay empate en más cartas, más oros o más sietes (o en la setenta), el punto se lo llevan todos los empatados. Desmarcado: si hay empate nadie se lo lleva (clásico).'},
  {k:'bonus',       def:false, t:'🎖️ Premio por llevarse todo', d:'El que se lleva los 10 oros o los 4 sietes suma 1 punto más por cada cosa.'},
];
const SEVENS = [{v:'sietes', t:'Más sietes (1 punto al que tiene más sietes)'},{v:'setenta', t:'La setenta (la mejor carta de cada palo, como en la primera italiana)'},{v:'ambos', t:'Las dos: más sietes y la setenta (1 punto cada una)'}];
const TARGETS = [{v:15,t:'A 15 puntos (clásico)'},{v:21,t:'A 21 puntos'},{v:31,t:'A 31 puntos (partida larga)'},{v:0,t:'Una sola mano'}];
const MODES = [{v:'solo',t:'Cada uno para sí'},{v:'parejas',t:'En parejas (4 o 6 jugadores, el compañero enfrente)'},{v:'trios',t:'Dos equipos de 3 (6 jugadores, uno y uno)'}];
const OK_N = [2,3,4,6];    // 36 cartas de a 3 tienen que alcanzar justo para todos
function defaultOpts(){ const o={target:15, mode:'solo', sevens:'sietes'}; HOUSE.forEach(h=>o[h.k]=h.def); return o; }
// puntos de la setenta: la mejor carta de cada palo (hace falta tener de los cuatro palos)
const PRIM = {7:21, 6:18, 1:16, 5:15, 4:14, 3:13, 2:12, 10:10, 11:10, 12:10};
function setenta(cards){
  let t=0;
  for(const s of SUITS){ const b=Math.max(0, ...cards.filter(c=>c.s===s).map(c=>PRIM[c.n])); if(!b) return 0; t+=b; }
  return t;
}

/* ---------- estado ---------- */
let S=null;
const EMOJIS = ['🧉','🥯','🐆','🌸','🎻','⚽','🐂','🌽','🦜','🐊','🦩','🍖','🌵','🎸','🐎','🦋','🌞','🍉','🐒','🦉'];
const PCOLORS = ['#e63946','#1d70d6','#2a9d3f','#e9a100','#8e44ad','#ff7f11','#13a8a8','#c2185b'];
const TCOLORS = ['#d52b1e','#0038a8','#2a9d3f'];
const BOT_NAMES = [['Ña Chipa','🥯'],['Karai Tereré','🧉'],['Don Jaguareté','🐆'],['Ña Lapacho','🌸'],['Pombero','👹'],['Kuñataĩ Mbejú','🌽'],['Che Ra\'a','🐂'],['Ña Ñandutí','🦋'],['Don Arpa','🎻'],['Pora','🦉']];
const MAXP = 6;
const P = id => S && S.players.find(p=>p.id===id);
const OB = id => S && (S.observers||[]).find(o=>o.id===id);
const cur = () => S.players[S.turn];
const TEAM = id => S && S.teams && S.teams.find(t=>t.id===id);
const teamOf = p => p && TEAM(p.team);

function lobbyState(){
  return {v:1, phase:'lobby', seq:0, players:[], observers:[], hostPid:null, opts:defaultOpts(),
    grules:'', sugs:[], log:[], ev:[], evSeq:0, round:0, dealer:0, turn:0, deck:[], table:[], teams:[], lastCap:null, dealN:0, roundRes:null, winner:null};
}
function addPlayer(name, emoji, token, peerId, bot){
  const used=S.players.map(p=>p.color);
  const p={id:'p'+(++S.seq), name:(String(name||'').trim()||'Jugador').slice(0,16), emoji, token, peerId,
    color:PCOLORS.find(c=>!used.includes(c))||PCOLORS[S.players.length%PCOLORS.length],
    conn:!bot, bot:!!bot, mic:false, hand:[], pile:[], esc:0, escIds:[], team:null};
  S.players.push(p); return p;
}
function addBot(){
  if(S.players.length>=MAXP) return 'Ya son 6 jugadores (el máximo para la Escoba).';
  const free=BOT_NAMES.filter(([n,e])=>!S.players.some(p=>p.name===n));
  const [n,e]=free.length?free[rnd(free.length)]:['Bot '+(S.players.length+1),'🤖'];
  const b=addPlayer(n, e, null, null, true);
  sysChat(`🤖 ${b.name} se sentó a la mesa.`);
}
function log(x, extra){ S.log.push(Object.assign({x, at:Date.now()}, extra||{})); if(S.log.length>220) S.log.splice(0, S.log.length-220); }
function ev(k, o){ S.ev.push(Object.assign({i:++S.evSeq, k, at:Date.now()}, o||{})); if(S.ev.length>14) S.ev.shift(); }

/* ---------- equipos ---------- */
function modeOk(mode, n){
  if(mode==='parejas') return n===4 || n===6;
  if(mode==='trios') return n===6;
  return true;
}
function teamIndex(i, n, mode){
  if(mode==='parejas') return n===4 ? i%2 : i%3;
  if(mode==='trios') return i%2;
  return i;
}
function makeTeams(){
  const n=S.players.length, mode=S.opts.mode, k = mode==='parejas' ? n/2 : mode==='trios' ? 2 : n;
  S.teams=[];
  for(let t=0;t<k;t++) S.teams.push({id:'t'+t, members:[], score:0, color: mode==='solo' ? null : TCOLORS[t]});
  S.players.forEach((p,i)=>{ const t=S.teams[teamIndex(i,n,mode)]; t.members.push(p.id); p.team=t.id; });
  S.teams.forEach((t,i)=>{ if(mode==='solo'){ const p=P(t.members[0]); t.color=p.color; } });
}
function teamName(t){
  if(!t) return '';
  const ns=t.members.map(id=>(P(id)||{}).name||'?');
  if(t.members.length===1) return ns[0];
  return (S.opts.mode==='trios' ? 'Equipo ' : 'Pareja ') + (S.teams.indexOf(t)+1) + ': ' + ns.join(' y ');
}

/* ---------- repartir ---------- */
function give3(){
  const n=S.players.length;
  for(let r=0;r<3;r++) for(let i=1;i<=n;i++){ const c=S.deck.pop(); if(c) S.players[(S.dealer+i)%n].hand.push(c); }
  S.dealN++;
}
function deal(){
  const n=S.players.length;
  S.deck=shuffle(newDeck()); S.table=[]; S.lastCap=null; S.dealN=0; S.roundRes=null;
  S.players.forEach(p=>{ p.hand=[]; p.pile=[]; p.esc=0; p.escIds=[]; });
  give3();
  for(let k=0;k<4;k++) S.table.push(S.deck.pop());
  S.turn=(S.dealer+1)%n;
  const d=S.players[S.dealer];
  log(`🃏 Mano ${S.round}: reparte ${d.name}. Se ponen en la mesa: ${listName(S.table)}.`, {cards:S.table.slice()});
  ev('deal', {first:true});
  const t=sumV(S.table);
  if(S.opts.mesaInicial && (t===15 || t===30)){
    const k=t/15, got=S.table.splice(0);
    d.pile.push(...got); d.esc+=k; d.escIds.push(got[0].id); if(k>1) d.escIds.push(got[1].id);
    S.lastCap=d.id;
    log(`🧹 ¡La mesa suma ${t}! ${d.name}, que repartió, se lleva las 4 cartas: ${k===1?'una escoba':'dos escobas'}.`, {cards:got, pid:d.id});
    ev('mesa', {pid:d.id, cards:got, n:k});
    sysChat(`🧹 La mesa inicial sumó ${t}: ${k===1?'escoba':'dos escobas'} para ${d.name}.`);
  }
  S.turnAt=Date.now();
}
function startGame(){
  S.phase='play'; S.round=1; S.dealer=rnd(S.players.length); S.startedAt=Date.now(); S.winner=null;
  makeTeams(); S.log=[];
  deal();
}
function nextRound(){ S.phase='play'; S.round++; S.dealer=(S.dealer+1)%S.players.length; deal(); }

/* ---------- jugadas ---------- */
const isTurn = pid => S && S.phase==='play' && cur() && cur().id===pid;
function nextTurn(){ S.turn=(S.turn+1)%S.players.length; S.turnAt=Date.now(); }

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
    case 'joinNext': {   // un observador se sienta: en la sala (o al terminar la partida) o en el lugar de un bot entre manos
      const o=OB(pid); if(!o || o.owner) return;
      if(S.phase==='play') return 'Esperá a que termine la mano para sentarte.';
      let np=null;
      if(S.phase==='roundEnd'){
        const b=S.players.find(x=>x.bot); if(!b) return 'La partida está empezada y no hay ningún bot para reemplazar. Esperá a que termine.';
        S.observers=S.observers.filter(x=>x!==o);
        const old=b.name; b.name=o.name; b.bot=false; b.token=o.token; b.peerId=o.peerId; b.conn=o.conn; b.mic=false;
        if(o.emoji!=='👀') b.emoji=o.emoji;
        np=b; sysChat(`🪑 ${b.name} toma el lugar de ${old} 🤖 (con sus puntos).`);
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
      else { t.bot=true; t.conn=false; t.mic=false; t.token=null; sysChat(`🚪 ${t.name} fue sacado: un bot 🤖 sigue con sus cartas.`); log(`🤖 Un bot juega por ${t.name}.`); }
      commit(); return;
    }
    case 'botify': {   // un jugador desconectado pasa a ser manejado por un bot
      if(!host) return; const t=P(a.pid); if(!t || t.bot) return;
      t.bot=true; t.conn=false; t.mic=false; t.token=null; sysChat(`🤖 Un bot sigue jugando con las cartas de ${t.name}.`); log(`🤖 Un bot juega por ${t.name}.`); commit(); return;
    }
    case 'seatUp': {   // el anfitrión cambia el orden de la mesa (así se arman las parejas)
      if(!host || S.phase!=='lobby') return; const i=S.players.findIndex(x=>x.id===a.pid); if(i<=0) return;
      [S.players[i-1], S.players[i]]=[S.players[i], S.players[i-1]]; commit(); return;
    }
    case 'opt': {
      if(!host || S.phase!=='lobby') return;
      if(a.k==='target') S.opts.target=+a.v||0;
      else if(a.k==='mode' && MODES.some(m=>m.v===a.v)) S.opts.mode=a.v;
      else if(a.k==='sevens' && SEVENS.some(m=>m.v===a.v)) S.opts.sevens=a.v;
      else if(HOUSE.some(h=>h.k===a.k)) S.opts[a.k]=!!a.v;
      commit(); return;
    }
    case 'grules': if(!host) return; S.grules=String(a.text||'').slice(0,1200); commit(); return;
    case 'sugDel': if(!host) return; S.sugs=S.sugs.filter(s=>s.id!==a.id); commit(); return;
    case 'start': {
      if(!host || S.phase!=='lobby') return;
      const n=S.players.length;
      if(n<2) return 'Hacen falta al menos 2 jugadores (sumá un bot 🤖).';
      if(!OK_N.includes(n)) return 'La Escoba se juega de 2, 3, 4 o 6 (con 5 no alcanzan las cartas parejo). Sumá o sacá a alguien.';
      if(!modeOk(S.opts.mode, n)) return S.opts.mode==='trios' ? 'Los equipos de 3 son con 6 jugadores.' : 'En parejas se juega con 4 o 6 jugadores.';
      startGame(); sysChat('🧹 ¡Empieza la partida de Escoba! Suerte a todos.'); commit(); return;
    }
    case 'nextRound': if(!host || S.phase!=='roundEnd') return; nextRound(); commit(); return;
    case 'newGame': if(!host || S.phase!=='over') return; S.phase='lobby'; S.log=[]; S.teams=[]; S.roundRes=null; S.winner=null; S.players.forEach(x=>{x.hand=[]; x.pile=[]; x.esc=0; x.escIds=[]; x.team=null;}); S.deck=[]; S.table=[]; commit(); return;
    case 'leave': {
      if(S.phase==='lobby' || S.phase==='over'){ S.players=S.players.filter(x=>x!==p); sysChat(`🚪 ${p.name} se fue.`); }
      else { p.bot=true; p.conn=false; p.mic=false; p.token=null; sysChat(`🚪 ${p.name} se fue: un bot 🤖 sigue con sus cartas.`); log(`🚪 ${p.name} se fue: un bot sigue con sus cartas.`); }
      commit(); return;
    }
    case 'play': {
      if(S.phase!=='play') return;
      if(!isTurn(pid)) return 'No es tu turno.';
      const c=p.hand.find(x=>x.id===a.id); if(!c) return 'Esa carta no está en tu mano.';
      const ids=[...new Set(Array.isArray(a.take)?a.take:[])];
      const take=ids.map(id=>S.table.find(x=>x.id===id));
      if(take.some(x=>!x)) return 'Esa carta ya no está en la mesa.';
      if(take.length && val(c)+sumV(take)!==15) return `Con ${cardName(c)} (vale ${val(c)}) y lo que elegiste suman ${val(c)+sumV(take)}: tiene que dar 15 justo.`;
      if(!take.length && S.opts.forceCap && combos(c, S.table).length) return 'Con esa carta podés levantar: en esta mesa es obligatorio (regla de la casa).';
      doPlay(p, c, take);
      commit(); return;
    }
  }
}

function doPlay(p, c, take){
  p.hand=p.hand.filter(x=>x.id!==c.id);
  const lastPlay = !S.deck.length && S.players.every(x=>!x.hand.length);
  if(take.length){
    const ids=take.map(x=>x.id);
    S.table=S.table.filter(x=>!ids.includes(x.id));
    p.pile.push(c, ...take); S.lastCap=p.id;
    let esc=false;
    if(!S.table.length && (!lastPlay || S.opts.lastEscoba)){ esc=true; p.esc++; p.escIds.push(c.id); }
    const velo = isVelo(c) || take.some(isVelo);
    log(`${p.emoji} ${p.name} tira ${cardName(c)} y levanta ${listName(take)}${esc?' — ¡ESCOBA! 🧹':''}${velo&&!esc?' — ¡con el siete velo! 🪙':''}`, {card:c, take, pid:p.id, esc});
    if(!S.table.length && lastPlay && !S.opts.lastEscoba) log('🧹 Barrió con la última carta, pero en esta mesa esa escoba no cuenta.');
    ev('cap', {pid:p.id, card:c, take, esc, velo});
  } else {
    S.table.push(c);
    log(`${p.emoji} ${p.name} tira ${cardName(c)} a la mesa.`, {card:c, pid:p.id});
    ev('drop', {pid:p.id, card:c});
  }
  if(S.players.every(x=>!x.hand.length)){
    if(S.deck.length){ give3(); nextTurn(); log(`🃏 ${S.players[S.dealer].name} reparte 3 cartas más a cada uno (quedan ${S.deck.length} en el mazo).`); ev('deal', {}); return; }
    return endRound();
  }
  nextTurn();
}

/* ---------- fin de la mano: el conteo ---------- */
function endRound(){
  const lc=P(S.lastCap) || S.players[S.dealer];
  const left=S.table.splice(0);
  if(left.length){ lc.pile.push(...left); log(`🧺 ${lc.name} levantó último y se lleva lo que quedó en la mesa: ${listName(left)}.`, {cards:left, pid:lc.id}); }
  const o=S.opts;
  const T=S.teams.map(t=>{
    const ps=t.members.map(P).filter(Boolean), cards=[].concat(...ps.map(x=>x.pile));
    return {id:t.id, cards, nC:cards.length, nO:cards.filter(c=>c.s==='o').length, n7:cards.filter(c=>c.n===7).length,
      velo:cards.some(isVelo), prim:setenta(cards), esc:ps.reduce((s,x)=>s+x.esc,0), pts:0, why:[]};
  });
  const most=(key, label)=>{
    const max=Math.max(...T.map(t=>t[key])); if(max<=0) return null;
    const w=T.filter(t=>t[key]===max);
    if(w.length===1 || o.tieBoth){ w.forEach(t=>{ t.pts++; t.why.push(label); }); return w; }
    return [];
  };
  T.forEach(t=>{ if(t.esc){ t.pts+=t.esc; t.why.push(t.esc===1?'1 escoba':t.esc+' escobas'); } });
  const rows={};
  rows.nC=most('nC','más cartas');
  rows.nO=most('nO','más oros');
  T.forEach(t=>{ if(t.velo){ t.pts++; t.why.push('el siete velo'); } });
  if(o.sevens!=='setenta') rows.n7=most('n7','más sietes');
  if(o.sevens!=='sietes') rows.prim=most('prim','la setenta');
  if(o.bonus) T.forEach(t=>{ if(t.nO===10){ t.pts++; t.why.push('premio: los 10 oros'); } if(t.n7===4){ t.pts++; t.why.push('premio: los 4 sietes'); } });
  T.forEach(t=>{ TEAM(t.id).score+=t.pts; });
  const total=T.reduce((s,t)=>s+t.nC,0);
  if(total!==40) console.error('¡Las cartas no cierran!', total);
  S.roundRes={teams:T.map(t=>({id:t.id, nC:t.nC, nO:t.nO, n7:t.n7, velo:t.velo, prim:t.prim, esc:t.esc, pts:t.pts, why:t.why,
      shown:t.cards.filter(c=>c.s==='o'||c.n===7).sort((a,b)=>a.s.localeCompare(b.s)||a.n-b.n)})),
    ties:Object.fromEntries(Object.entries(rows).map(([k,v])=>[k, v&&v.length===0])), left, lastTaker:lc.id, total};
  S.teams.forEach(t=>{ const r=T.find(x=>x.id===t.id); log(`🧮 ${teamName(t)}: +${r.pts}${r.why.length?' ('+r.why.join(', ')+')':''} → ${t.score} puntos.`); });
  // ¿terminó la partida?
  const max=Math.max(...S.teams.map(t=>t.score)), lead=S.teams.filter(t=>t.score===max);
  let over=false;
  if(!o.target){ over=true; S.winner = lead.length===1 ? lead[0].id : null; }
  else if(max>=o.target){
    if(lead.length===1){ over=true; S.winner=lead[0].id; }
    else log(`⚖️ Empate arriba con ${max} puntos: se juega otra mano para desempatar.`);
  }
  S.phase = over ? 'over' : 'roundEnd';
  if(over){
    const w=TEAM(S.winner);
    log(w ? `🎉 ¡${teamName(w)} gana la partida con ${w.score} puntos!` : '🤝 ¡Terminó empatada!');
    sysChat(w ? `🎉 ¡${teamName(w)} ganó la partida de Escoba!` : '🤝 La partida terminó empatada.');
  } else sysChat(`🧮 Terminó la mano ${S.round}. ${S.teams.map(t=>`${teamName(t)}: ${t.score}`).join(' · ')}`);
  ev('end', {over});
}

/* ====================== BOTS ====================== */
const BOT = {next:0};
const BOT_TALK = {
  esc:['¡Escoba! 🧹','¡Barrí todo, che! 🧹','Jaha, ¡escobita! 😎','¡Limpito quedó! 🧹✨','¡Tomá, escoba! 🧹'],
  velo:['¡El siete velo es mío! 🪙','Vení, sietecito de oro 🪙😍','¡Ese siete velo vale oro! 🪙'],
  drop:['Ahí te dejo…','Upéi…','Mba\'éichapa la mesa 🤔','Nde… no junto nada 😅','Ndaipóri 15 😩'],
  big:['¡Me llevo un montón! 🧺','Jaha, cosecha 🌽'],
};
const pick = a => a[rnd(a.length)];
const autoPlays = p => p.bot || (!p.conn && p.offAt && Date.now()-p.offAt>20000);
// cuánto le conviene al bot una jugada (con un poco de azar para que no sea siempre igual)
function botEval(b, c, take, noise){
  const after = take.length ? S.table.filter(x=>!take.includes(x)) : S.table.concat([c]);
  const lastPlay = !(S.deck ? S.deck.length : S.deckN) && S.players.every(x=>x===b ? x.hand.length===1 : !(x.hand ? x.hand.length : x.n));
  let s=0;
  if(take.length){
    const got=[c, ...take];
    s += 12 + got.length*1.2 + got.filter(x=>x.s==='o').length*1.6 + got.filter(x=>x.n===7).length*3 + (got.some(isVelo)?14:0);
    if(!after.length && (!lastPlay || S.opts.lastEscoba)) s+=30;
  } else {
    s -= 2 + (c.n===7?4:0) + (c.s==='o'?1.5:0) + (isVelo(c)?12:0) - val(c)*.15;
  }
  // ¿le dejo al siguiente la escoba servida?
  const nx=S.players[(S.turn+1)%S.players.length], mate = nx && nx!==b && nx.team===b.team;
  if(after.length && !lastPlay){
    const need=15-sumV(after);
    if(need>=1 && need<=10) s += mate ? 3 : -10;
    if(after.some(isVelo) && !mate) s -= 3;
  }
  return s + Math.random()*(noise||1.5);
}
function botChoose(b){
  let best=null, bs=-1e9;
  for(const c of b.hand){
    const cs=combos(c, S.table);
    const opts = S.opts.forceCap && cs.length ? cs : cs.concat([[]]);
    for(const take of opts){ const s=botEval(b, c, take); if(s>bs){ bs=s; best={type:'play', id:c.id, take:take.map(x=>x.id)}; } }
  }
  return best;
}
function botTick(){
  if(!S || S.phase!=='play' || (NET.mode!=='host' && NET.mode!=='local')) return;
  const now=Date.now();
  if(now<BOT.next) return;
  const b=cur(); if(!b || !autoPlays(b)) return;
  if(now-(S.turnAt||0) < 1500+rnd(900)) return;
  const a=botChoose(b); if(!a) return;
  BOT.next=now+700;
  const c=b.hand.find(x=>x.id===a.id), take=a.take.map(id=>S.table.find(x=>x.id===id));
  const esc = take.length && S.table.length===take.length;
  if(b.bot){
    if(esc && Math.random()<.6) botChat(b, pick(BOT_TALK.esc));
    else if(take.length && (isVelo(c) || take.some(isVelo)) && Math.random()<.6) botChat(b, pick(BOT_TALK.velo));
    else if(take.length>=4 && Math.random()<.3) botChat(b, pick(BOT_TALK.big));
    else if(!take.length && Math.random()<.07) botChat(b, pick(BOT_TALK.drop));
  }
  const r=act(b.id, a);
  if(typeof r==='string'){ console.warn('bot', r, a); }
}
setInterval(botTick, 450);
// los bots contestan los mensajes en secreto
function botPrivate(bot, from, text){
  const t=text.toLowerCase();
  const ans = /siete|velo|7/.test(t) ? pick(['Shhh… del siete no se habla 🤫','Si lo tengo, no te lo digo 😏','¿Siete? ¿Qué siete? 😇'])
    : /15|quince|mesa|baja|alta/.test(t) ? pick(['Dale, voy a ver qué hago con la mesa 😉','Oĩma, entendido 🤝','Mmm… veremos 🤔'])
    : pick(['Jaja, ¿y qué me das a cambio? 😏','Shhh, que nadie se entere 🤫','Upéi hablamos 🧉','¡Trato hecho! 🤝']);
  setTimeout(()=>{ if(S) addChat(bot.id, ans, from.id); }, 900+rnd(1500));
}
