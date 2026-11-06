'use strict';
/* =====================================================================
   El Impostor — reglas, rondas, votación, puntajes y bots.
   Todo lo decide el anfitrión (o el propio aparato en la práctica):
   act(pid, accion) cambia el estado S y devuelve un texto si no se puede.
   ===================================================================== */
function rnd(n){ if(window.crypto && crypto.getRandomValues){ const a=new Uint32Array(1); crypto.getRandomValues(a); return a[0]%n; } return Math.floor(Math.random()*n); }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=rnd(i+1); [a[i],a[j]]=[a[j],a[i]]; } return a; }
const pick = a => a[rnd(a.length)];

/* ---------- opciones del anfitrión ---------- */
const IMPS   = [{v:'auto',t:'Automático (1 hasta 6 jugadores, 2 hasta 11, 3 desde 12)'},{v:'1',t:'1 impostor'},{v:'2',t:'2 impostores'},{v:'3',t:'3 impostores'},{v:'4',t:'4 impostores'},{v:'5',t:'5 impostores'}];
const HINTS  = [{v:'nada',t:'Nada: el impostor no sabe ni la categoría'},{v:'cat',t:'La categoría (ej.: “Comidas”)'},{v:'parecida',t:'Una palabra parecida (ej.: “Mbejú” si es Chipa)'},{v:'ambas',t:'La categoría y una palabra parecida'},{v:'encubierto',t:'Modo encubierto: recibe la palabra parecida y NO sabe que es impostor'}];
const CLUE_T = [{v:15,t:'15 segundos'},{v:20,t:'20 segundos'},{v:30,t:'30 segundos'},{v:45,t:'45 segundos'},{v:60,t:'1 minuto'},{v:0,t:'Sin límite'}];
const DISC_T = [{v:30,t:'30 segundos'},{v:60,t:'1 minuto'},{v:90,t:'1 minuto y medio'},{v:120,t:'2 minutos'},{v:180,t:'3 minutos'},{v:300,t:'5 minutos'},{v:0,t:'Sin límite (hasta que el anfitrión mande a votar)'}];
const LAPS   = [{v:1,t:'1 vuelta de pistas'},{v:2,t:'2 vueltas de pistas'},{v:3,t:'3 vueltas de pistas'}];
const GUESS  = [{v:'echado',t:'Sí, cuando lo echan (última oportunidad)'},{v:'siempre',t:'Sí, en cualquier momento (si erra, queda afuera)'},{v:'no',t:'No puede adivinar'}];
const ELIM   = [{v:'sigue',t:'Se sigue jugando: otra vuelta de pistas y otra votación'},{v:'gana',t:'Muerte súbita: si echan a un inocente, gana el impostor'}];
const VOTEV  = [{v:'secreto',t:'Voto secreto (se ve al final de la votación)'},{v:'publico',t:'Voto a la vista (se ve quién vota a quién)'}];
const ROUNDS = [{v:3,t:'3 rondas'},{v:5,t:'5 rondas'},{v:8,t:'8 rondas'},{v:10,t:'10 rondas'},{v:15,t:'15 rondas'},{v:0,t:'Sin fin (hasta que el anfitrión corte)'}];
const PTS    = [{v:'clasico',t:'Clásico: inocentes +1 · impostor +2 si se salva · +3 si adivina',civ:1,imp:2,adv:3},
                {v:'impostor',t:'Impostor vale más: inocentes +1 · impostor +3 · +4 si adivina',civ:1,imp:3,adv:4},
                {v:'parejo',t:'Parejo: el bando que gana suma +2 cada uno',civ:2,imp:2,adv:2}];
const VOTE_SECS = 60, GUESS_SECS = 35, REVEAL_SECS = 14, RESULT_SECS = 6;
function defaultOpts(){
  return {nImp:'auto', hint:'cat', cats:Object.keys(CATS), clueTime:30, discTime:90, laps:1, guess:'echado', know:false, elim:'sigue', vote:'secreto', rounds:5, pts:'clasico', cazador:true};
}
// variantes rápidas para grupos (botones en la sala)
const VARIANTS = [
  {k:'clasica',    t:'🎭 Clásica',        d:'1 impostor que sabe la categoría, 1 vuelta de pistas, voto secreto.', o:{}},
  {k:'encubierto', t:'🕶️ Encubierto',     d:'El impostor recibe una palabra parecida y no sabe que es el impostor.', o:{hint:'encubierto', guess:'no', laps:2}},
  {k:'relampago',  t:'⚡ Relámpago',       d:'15 segundos por pista y 45 de discusión. Para pensar rápido.', o:{clueTime:15, discTime:30, laps:1}},
  {k:'grande',     t:'👨‍👩‍👧‍👦 Grupo grande', d:'Para 10 o más: impostores automáticos que se conocen entre sí.', o:{nImp:'auto', know:true, clueTime:20, discTime:120, laps:1}},
  {k:'subita',     t:'💀 Muerte súbita',   d:'Una sola votación: si echan a un inocente, gana el impostor.', o:{elim:'gana', laps:2}},
  {k:'ninos',      t:'🧒 Para chicos',     d:'El impostor sabe la categoría y una palabra parecida, sin apuro.', o:{hint:'ambas', clueTime:0, discTime:0, cats:['py','comida','animal','objeto']}},
];

/* ---------- estado ---------- */
let S=null;
const EMOJIS = ['🧉','🥯','🐆','🌸','🎻','⚽','🐂','🌽','🦜','🐊','🦩','🍖','🌵','🎸','🐎','🦋','🌞','🍉','🐒','🦉','🐸','🦔','🍍','🎺'];
const PCOLORS = ['#e63946','#1d70d6','#2a9d3f','#e9a100','#8e44ad','#ff7f11','#13a8a8','#c2185b','#6d4c41','#3949ab','#7cb342','#d81b60','#00897b','#f4511e','#5e35b1','#c0ca33','#546e7a','#ad1457','#0277bd','#558b2f'];
const BOT_NAMES = [['Ña Chipa','🥯'],['Karai Tereré','🧉'],['Don Jaguareté','🐆'],['Ña Lapacho','🌸'],['Pombero','👹'],['Kuñataĩ Mbejú','🌽'],["Che Ra'a",'🐂'],['Ña Ñandutí','🦋'],['Don Arpa','🎻'],['Pora','🦉'],['Karai Vori','🍲'],['Ña Guampa','🧉'],['Tío Kure','🐷'],['Ña Rosa','🌹'],['Don Carpincho','🦫'],['Mitãkuña','🎀'],['Karai Yacaré','🐊'],['Ña Mandioca','🥔'],['Don Tatú','🦔'],['Kuña Panambí','🦋']];
const MAXP = 20, MINP = 3;
const P = id => S && S.players.find(p=>p.id===id);
const OB = id => S && (S.observers||[]).find(o=>o.id===id);
const alive = () => S.players.filter(p=>!p.out);
const isImp = p => p && S.imps.includes(p.id);
const curP = () => S && S.phase==='clues' ? P(S.order[S.ci]) : null;

function lobbyState(){
  return {v:1, phase:'lobby', seq:0, players:[], observers:[], hostPid:null, opts:defaultOpts(), grules:'', sugs:[], log:[], ev:[], evSeq:0,
    round:0, word:null, sim:null, cat:null, imps:[], clues:[], order:[], ci:0, lap:0, cround:1, votes:{}, ready:[], dl:0, res:null, vres:null, guesser:null, used:[], hunters:[], winner:null, turnAt:0};
}
function addPlayer(name, emoji, token, peerId, bot){
  const used=S.players.map(p=>p.color);
  const p={id:'p'+(++S.seq), name:(String(name||'').trim()||'Jugador').slice(0,16), emoji, token, peerId,
    color:PCOLORS.find(c=>!used.includes(c))||PCOLORS[S.players.length%PCOLORS.length],
    conn:!bot, bot:!!bot, mic:false, score:0, out:false, rev:null};
  S.players.push(p); return p;
}
function addBot(){
  if(S.players.length>=MAXP) return `Ya son ${MAXP} jugadores (el máximo).`;
  const free=BOT_NAMES.filter(([n])=>!S.players.some(p=>p.name===n));
  const [n,e]=free.length?pick(free):['Bot '+(S.players.length+1),'🤖'];
  const b=addPlayer(n, e, null, null, true);
  sysChat(`🤖 ${b.name} se sumó a la ronda.`);
}
function log(x, extra){ S.log.push(Object.assign({x, at:Date.now()}, extra||{})); if(S.log.length>300) S.log.splice(0, S.log.length-300); }
function ev(k, o){ S.ev.push(Object.assign({i:++S.evSeq, k, at:Date.now()}, o||{})); if(S.ev.length>14) S.ev.shift(); }
const maxImp = n => Math.max(1, Math.floor((n-1)/2));
function impCount(n){
  const o=S.opts.nImp;
  if(o==='auto') return Math.min(maxImp(n), n<=6 ? 1 : n<=11 ? 2 : 3);
  return +o;
}
const ptsOf = () => PTS.find(x=>x.v===S.opts.pts) || PTS[0];
const catName = c => CATS[c] ? CATS[c].e+' '+CATS[c].n : '';

/* ---------- rondas ---------- */
function startGame(){
  S.round=0; S.startedAt=Date.now(); S.winner=null; S.log=[];
  S.players.forEach(p=>{ p.score=0; });
  newRound();
}
function newRound(){
  S.round++;
  const pool=WORDS.filter(w=>S.opts.cats.includes(w.c) && !S.used.includes(w.w));
  const ent = pool.length ? pick(pool) : pick(WORDS.filter(w=>S.opts.cats.includes(w.c)));
  S.used.push(ent.w); if(S.used.length>60) S.used.shift();
  S.word=ent.w; S.sim=ent.s; S.cat=ent.c;
  const n=S.players.length, k=Math.min(impCount(n), maxImp(n));
  S.imps=shuffle(S.players.map(p=>p.id)).slice(0,k);
  S.players.forEach(p=>{ p.out=false; p.rev=null; });
  S.clues=[]; S.votes={}; S.vres=null; S.res=null; S.guesser=null; S.hunters=[]; S.lap=0;
  S.ready=S.players.filter(p=>p.bot).map(p=>p.id);
  S.startIdx = rnd(n);
  S.phase='reveal'; S.dl=Date.now()+REVEAL_SECS*1000;
  log(`🎴 Ronda ${S.round}: se repartieron las tarjetas. ${k===1?'Hay 1 impostor':'Hay '+k+' impostores'} en la ronda.`);
  ev('round');
}
function toClues(){
  // el orden: los que siguen en juego, empezando cada vuelta por uno distinto
  const al=S.players.filter(p=>!p.out);
  const st=(S.startIdx + S.lap) % al.length;
  S.order=al.slice(st).concat(al.slice(0,st)).map(p=>p.id);
  S.lap++; S.ci=0; S.cround=1;
  S.phase='clues'; turnStart();
  log(`🧉 Vuelta de pistas ${S.lap}: empieza ${P(S.order[0]).name}.`);
  ev('clues');
}
function turnStart(){ S.turnAt=Date.now(); S.dl = S.opts.clueTime ? Date.now()+S.opts.clueTime*1000 : 0; }
function addClue(p, x, how){
  S.clues.push({pid:p.id, x, lap:S.lap, how:how||'txt', at:Date.now()});
  log(`${p.emoji} ${p.name}: ${how==='skip'?'⌛ no dijo nada (se le pasó el tiempo)':how==='voz'?'🎙️ dijo su pista en voz':'“'+x+'”'}`);
  ev('clue', {pid:p.id});
  nextTurn();
}
function nextTurn(){
  S.ci++;
  if(S.ci>=S.order.length){
    if(S.cround<S.opts.laps){ S.cround++; S.ci=0; S.lap++; turnStart(); log(`🧉 Otra vuelta de pistas (${S.cround} de ${S.opts.laps}).`); }
    else return toDiscuss();
  }
  // saltea a los que ya no están en juego (por si alguien quedó afuera adivinando)
  while(S.ci<S.order.length && P(S.order[S.ci]) && P(S.order[S.ci]).out) S.ci++;
  if(S.ci>=S.order.length) return toDiscuss();
  turnStart();
}
function toDiscuss(){
  S.phase='discuss'; S.ready=[]; S.dl = S.opts.discTime ? Date.now()+S.opts.discTime*1000 : 0; S.turnAt=Date.now();
  S.botTalk={};
  log('🗣️ A discutir: ¿quién es el impostor?'); ev('discuss');
}
function toVote(){
  S.phase='vote'; S.votes={}; S.dl=Date.now()+VOTE_SECS*1000; S.turnAt=Date.now();
  S.botVoteAt={}; alive().forEach(p=>{ S.botVoteAt[p.id]=Date.now()+2500+rnd(6000); });
  log('🗳️ ¡A votar! ¿A quién echamos de la ronda?'); ev('vote');
}
function endVote(){
  const tally={};
  alive().forEach(p=>{ const v=S.votes[p.id]; if(v) tally[v]=(tally[v]||0)+1; });
  const max=Math.max(0, ...Object.values(tally));
  const top=Object.keys(tally).filter(k=>tally[k]===max);
  let out=null;
  if(max>0 && top.length===1 && top[0]!=='skip') out=top[0];
  const o=P(out);
  S.vres={tally, votes:Object.assign({}, S.votes), out, imp: o ? isImp(o) : false, tie: max>0 && top.length>1, skip: top.length===1 && top[0]==='skip'};
  if(o){
    o.out=true; o.rev = isImp(o) ? 'imp' : 'civ';
    if(isImp(o)) alive().forEach(p=>{ if(S.votes[p.id]===o.id && !isImp(p)) S.hunters.push(p.id); });
    log(`🚪 Echaron a ${o.name} con ${max} voto${max>1?'s':''}: ${isImp(o)?'¡ERA EL IMPOSTOR! 🎭':'era inocente 😇'}`);
    sysChat(`🚪 Echaron a ${o.name}: ${isImp(o)?'¡era impostor! 🎭':'era inocente 😇'}`);
  } else {
    const t = S.vres.tie ? '⚖️ Empate en la votación: no se echa a nadie.' : S.vres.skip ? '🤷 La mayoría prefirió no echar a nadie.' : '🤷 Nadie votó: no se echa a nadie.';
    log(t); sysChat(t);
  }
  S.phase='result'; S.dl=Date.now()+RESULT_SECS*1000; ev('result', {out});
}
function afterResult(){
  const v=S.vres||{}, o=P(v.out);
  if(o && v.imp && S.opts.guess!=='no' && S.opts.hint!=='encubierto'){
    S.phase='guess'; S.guesser=o.id; S.dl=Date.now()+GUESS_SECS*1000; S.turnAt=Date.now();
    log(`🎯 ${o.name} tiene una última oportunidad: si adivina la palabra, gana igual.`); ev('guess');
    return;
  }
  checkWin(v);
}
function checkWin(v){
  const ia=alive().filter(isImp).length, ca=alive().length-ia;
  if(!ia) return endRound('civ', 'echado');
  if(ia>=ca) return endRound('imp', 'mayoria');
  if(S.opts.elim==='gana' && v && !(v.out && v.imp)) return endRound('imp', 'salvo');
  if(S.lap>=10) return endRound('imp', 'salvo');
  toClues();
}
function endRound(win, how, who){
  const pt=ptsOf(), gains={};
  const add=(id,n)=>{ const p=P(id); if(!p) return; p.score+=n; gains[id]=(gains[id]||0)+n; };
  if(win==='civ'){
    S.players.forEach(p=>{ if(!isImp(p)) add(p.id, pt.civ); });
    if(S.opts.cazador) [...new Set(S.hunters)].forEach(id=>add(id, 1));
  } else {
    S.imps.forEach(id=>add(id, how==='adivina' && id===who ? pt.adv : pt.imp));
  }
  S.players.forEach(p=>{ p.rev = isImp(p) ? 'imp' : 'civ'; });
  const names=S.imps.map(id=>(P(id)||{}).name||'?').join(' y ');
  S.res={win, how, who, word:S.word, sim:S.sim, cat:S.cat, imps:S.imps.slice(), gains};
  const why = win==='civ' ? `🎉 ¡Ganan los inocentes! Echaron ${S.imps.length>1?'a todos los impostores':'al impostor'} (${names}).`
    : how==='adivina' ? `🎭 ¡Gana ${S.imps.length>1?'el bando impostor':'el impostor'}! ${(P(who)||{}).name} adivinó la palabra.`
    : how==='mayoria' ? `🎭 ¡Ganan los impostores! Ya son tantos como los inocentes (${names}).`
    : `🎭 ¡Gana ${S.imps.length>1?'el bando impostor':'el impostor'}! ${names} se salvó.`;
  log(why); log(`🔑 La palabra era “${S.word}” (${catName(S.cat)}).`);
  sysChat(`${why} La palabra era “${S.word}”.`);
  const over = S.opts.rounds && S.round>=S.opts.rounds;
  S.phase = over ? 'over' : 'roundEnd'; S.dl=0;
  if(over){
    const max=Math.max(...S.players.map(p=>p.score));
    S.winner=S.players.filter(p=>p.score===max).map(p=>p.id);
    const wn=S.winner.map(id=>P(id).name).join(' y ');
    log(`🏆 Terminó la partida: ${S.winner.length>1?'empatan':'gana'} ${wn} con ${max} puntos.`);
    sysChat(`🏆 ¡Terminó la partida! ${S.winner.length>1?'Empatan':'Gana'} ${wn} con ${max} puntos.`);
  }
  ev('end', {win, over});
}
// ¿qué palabra tiene este jugador en su tarjeta?
function wordOf(p){ if(!p) return null; if(!isImp(p)) return S.word; return S.opts.hint==='encubierto' ? S.sim : null; }

/* ---------- acciones ---------- */
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
    case 'sugVote': {
      const s=S.sugs.find(x=>x.id===a.id); if(!s) return;
      s.votes = s.votes.includes(pid) ? s.votes.filter(x=>x!==pid) : s.votes.concat(pid); commit(); return;
    }
    case 'joinNext': {   // un observador se sienta: en la sala o entre rondas
      const o=OB(pid); if(!o || o.owner) return;
      if(!['lobby','roundEnd','over'].includes(S.phase)) return 'Esperá a que termine la ronda para sumarte.';
      if(S.players.length>=MAXP) return `La ronda está llena (${MAXP} jugadores).`;
      S.observers=S.observers.filter(x=>x!==o);
      const np=addPlayer(o.name, o.emoji==='👀'?(EMOJIS.find(e=>!S.players.some(q=>q.emoji===e))||'🙂'):o.emoji, o.token, o.peerId);
      np.conn=o.conn; np.rev=null;
      sysChat(`🪑 ${np.name} se sumó a la ronda.`);
      if(typeof onSeatChange==='function') onSeatChange(pid, np.id);
      commit(); return;
    }
  }
  if(!p) return;
  const host = pid===S.hostPid || NET.mode==='local';
  switch(a.type){
    case 'addBot': if(!host||!['lobby','roundEnd','over'].includes(S.phase)) return; { const r=addBot(); if(r) return r; } commit(); return;
    case 'kick': {
      if(!host) return; const t=P(a.pid); if(!t || t.id===S.hostPid) return;
      if(NET.conns && NET.conns[t.id]){ try{ NET.conns[t.id].send({t:'kicked'}); }catch(e){} }
      if(['lobby','roundEnd','over'].includes(S.phase)){ S.players=S.players.filter(x=>x!==t); sysChat(`🚪 ${t.name} fue sacado de la ronda.`); }
      else { t.bot=true; t.conn=false; t.mic=false; t.token=null; sysChat(`🚪 ${t.name} fue sacado: un bot 🤖 sigue en su lugar hasta que termine la ronda.`); }
      commit(); return;
    }
    case 'botify': {
      if(!host) return; const t=P(a.pid); if(!t || t.bot) return;
      t.bot=true; t.conn=false; t.mic=false; t.token=null; sysChat(`🤖 Un bot sigue en el lugar de ${t.name}.`); commit(); return;
    }
    case 'opt': {
      if(!host || S.phase!=='lobby') return;
      const o=S.opts, k=a.k, v=a.v;
      if(k==='nImp' && IMPS.some(x=>x.v===v)) o.nImp=v;
      else if(k==='hint' && HINTS.some(x=>x.v===v)) o.hint=v;
      else if(k==='clueTime' && CLUE_T.some(x=>x.v==v)) o.clueTime=+v;
      else if(k==='discTime' && DISC_T.some(x=>x.v==v)) o.discTime=+v;
      else if(k==='laps' && LAPS.some(x=>x.v==v)) o.laps=+v;
      else if(k==='guess' && GUESS.some(x=>x.v===v)) o.guess=v;
      else if(k==='elim' && ELIM.some(x=>x.v===v)) o.elim=v;
      else if(k==='vote' && VOTEV.some(x=>x.v===v)) o.vote=v;
      else if(k==='rounds' && ROUNDS.some(x=>x.v==v)) o.rounds=+v;
      else if(k==='pts' && PTS.some(x=>x.v===v)) o.pts=v;
      else if(k==='know' || k==='cazador') o[k]=!!v;
      else if(k==='cat' && CATS[a.c]){ o.cats = v ? [...new Set(o.cats.concat(a.c))] : o.cats.filter(x=>x!==a.c); if(!o.cats.length) o.cats=[a.c]; }
      else if(k==='variant'){ const vr=VARIANTS.find(x=>x.k===v); if(vr){ S.opts=Object.assign(defaultOpts(), vr.o); sysChat(`🎛️ Variante elegida: ${vr.t}.`); } }
      commit(); return;
    }
    case 'grules': if(!host) return; S.grules=String(a.text||'').slice(0,1200); commit(); return;
    case 'sugDel': if(!host) return; S.sugs=S.sugs.filter(s=>s.id!==a.id); commit(); return;
    case 'start': {
      if(!host || S.phase!=='lobby') return;
      const n=S.players.length;
      if(n<MINP) return `Hacen falta al menos ${MINP} jugadores (sumá bots 🤖).`;
      if(S.opts.nImp!=='auto' && +S.opts.nImp>maxImp(n)) return `Con ${n} jugadores puede haber como mucho ${maxImp(n)} impostor${maxImp(n)>1?'es':''} (tienen que ser menos que los inocentes).`;
      startGame(); sysChat('🎭 ¡Empieza El Impostor! Mirá tu tarjeta sin que nadie te vea 🤫'); commit(); return;
    }
    case 'nextRound': {
      if(!host || S.phase!=='roundEnd') return;
      if(S.players.length<MINP) return `Hacen falta al menos ${MINP} jugadores.`;
      newRound(); commit(); return;
    }
    case 'endGame': {   // el anfitrión corta la partida (sobre todo en "sin fin")
      if(!host || S.phase!=='roundEnd') return;
      const max=Math.max(...S.players.map(x=>x.score)); S.winner=S.players.filter(x=>x.score===max).map(x=>x.id);
      S.phase='over'; sysChat(`🏆 ¡Terminó la partida! ${S.winner.map(id=>P(id).name).join(' y ')} con ${max} puntos.`); ev('end',{over:true}); commit(); return;
    }
    case 'newGame': {
      if(!host || S.phase!=='over') return;
      S.phase='lobby'; S.log=[]; S.res=null; S.vres=null; S.winner=null; S.clues=[]; S.imps=[]; S.word=null; S.round=0;
      S.players.forEach(x=>{ x.score=0; x.out=false; x.rev=null; }); commit(); return;
    }
    case 'skip': {   // el anfitrión adelanta: termina la discusión o el turno de alguien colgado
      if(!host) return;
      if(S.phase==='reveal') toClues();
      else if(S.phase==='discuss') toVote();
      else if(S.phase==='clues'){ const c=curP(); if(c) addClue(c, '', 'skip'); }
      else if(S.phase==='vote') endVote();
      else return;
      commit(); return;
    }
    case 'leave': {
      if(['lobby','roundEnd','over'].includes(S.phase)){ S.players=S.players.filter(x=>x!==p); sysChat(`🚪 ${p.name} se fue.`); }
      else { p.bot=true; p.conn=false; p.mic=false; p.token=null; sysChat(`🚪 ${p.name} se fue: un bot 🤖 sigue en su lugar.`); }
      commit(); return;
    }
    case 'ready': {
      if(S.phase==='reveal'){ if(!S.ready.includes(pid)) S.ready.push(pid); if(S.players.every(x=>S.ready.includes(x.id))) toClues(); commit(); return; }
      if(S.phase==='discuss'){ if(p.out) return; S.ready = S.ready.includes(pid) ? S.ready.filter(x=>x!==pid) : S.ready.concat(pid); discCheck(); commit(); return; }
      return;
    }
    case 'clue': {
      if(S.phase!=='clues') return;
      const c=curP(); if(!c || c.id!==pid) return 'No es tu turno de dar pista.';
      if(a.voz){ addClue(p, '', 'voz'); commit(); return; }
      const x=String(a.text||'').replace(/\s+/g,' ').trim().slice(0,40);
      if(!x) return 'Escribí una pista (una palabra o algo corto).';
      const w=wordOf(p);
      if(w && clueSaysWord(x, w)) return '¡No vale decir la palabra! 🙊 Pensá otra pista.';
      if(S.clues.some(k=>k.lap===S.lap && k.how==='txt' && norm(k.x)===norm(x))) return 'Esa pista ya la dijo otro en esta vuelta. Probá con otra.';
      addClue(p, x, 'txt'); commit(); return;
    }
    case 'vote': {
      if(S.phase!=='vote') return;
      if(p.out) return 'Ya estás afuera de la ronda: no votás.';
      const t = a.pid==='skip' ? 'skip' : P(a.pid);
      if(t!=='skip' && (!t || t.out)) return 'Esa persona ya no está en juego.';
      if(t!=='skip' && t.id===pid) return 'No te podés votar a vos mismo 😅';
      S.votes[pid] = t==='skip' ? 'skip' : t.id;
      if(alive().every(x=>S.votes[x.id])) endVote();
      commit(); return;
    }
    case 'guess': {
      if(S.phase==='guess'){
        if(pid!==S.guesser) return 'No te toca adivinar.';
        doGuess(p, a.text, false); commit(); return;
      }
      // arriesgar en cualquier momento
      if(S.opts.guess!=='siempre' || S.opts.hint==='encubierto') return 'En esta mesa no se puede arriesgar la palabra así.';
      if(!['clues','discuss'].includes(S.phase) || !isImp(p) || p.out) return;
      doGuess(p, a.text, true); commit(); return;
    }
  }
}
function discCheck(){
  if(S.phase!=='discuss') return;
  const al=alive();
  if(al.length && al.every(x=>S.ready.includes(x.id))) toVote();
}
function doGuess(p, text, risk){
  const t=String(text||'').trim().slice(0,40);
  const ok = !!t && sameWord(t, S.word);
  log(`🎯 ${p.name} ${risk?'arriesga':'intenta adivinar'}: “${t||'…'}” — ${ok?'¡ACERTÓ! 😱':'no es 😅'}`);
  sysChat(`🎯 ${p.name} ${risk?'arriesgó':'dijo'} “${t||'…'}”: ${ok?'¡adivinó la palabra! 😱':'no era 😅'}`);
  ev('guessed', {pid:p.id, ok});
  if(ok) return endRound('imp', 'adivina', p.id);
  if(risk){
    p.out=true; p.rev='imp';
    log(`🎭 ${p.name} se descubrió solo: era impostor y queda afuera.`);
    const ia=alive().filter(isImp).length, ca=alive().length-ia;
    if(!ia) return endRound('civ', 'echado');
    if(ia>=ca) return endRound('imp', 'mayoria');
    // la ronda sigue donde estaba (si era su turno de pista, pasa al siguiente)
    if(S.phase==='clues' && S.order[S.ci]===p.id) nextTurn();
    if(S.phase==='discuss') discCheck();
    return;
  }
  checkWin(S.vres);
}

/* ---------- reloj del anfitrión ---------- */
function hostTick(){
  if(!S || (NET.mode!=='host' && NET.mode!=='local')) return;
  const now=Date.now(), late = S.dl && now>S.dl;
  let ch=false;
  if(S.phase==='reveal' && late){ toClues(); ch=true; }
  else if(S.phase==='clues'){
    const c=curP();
    if(!c){ toDiscuss(); ch=true; }
    else if(late){ addClue(c, '', 'skip'); ch=true; }
    else if(autoPlays(c) && now-S.turnAt > 1800+rnd(1500)){ botClue(c); ch=true; }
  }
  else if(S.phase==='discuss'){
    if(late){ toVote(); ch=true; }
    else ch=botDiscuss(now)||ch;
  }
  else if(S.phase==='vote'){
    if(late){ endVote(); ch=true; }
    else for(const b of alive()) if(autoPlays(b) && !S.votes[b.id] && now>(S.botVoteAt[b.id]||0)){ botVote(b); ch=true; break; }
  }
  else if(S.phase==='result' && late){ afterResult(); ch=true; }
  else if(S.phase==='guess'){
    const g=P(S.guesser);
    if(late || !g){ if(g) doGuess(g, '', false); else checkWin(S.vres); ch=true; }
    else if(g && autoPlays(g) && now-S.turnAt>3500){ doGuess(g, botGuessWord(g), false); ch=true; }
  }
  if(ch) commit();
}
setInterval(hostTick, 400);

/* ====================== BOTS ====================== */
const autoPlays = p => p && (p.bot || (!p.conn && p.offAt && Date.now()-p.offAt>20000));
const VAGUE = ['interesante','común','conocido','me gusta','todos','normal','a veces','depende','raro','popular'];
// lo que el bot cree que es la palabra: los inocentes la saben; el impostor la deduce por las pistas
function botEntry(b){
  if(!isImp(b)) return findWord(S.word);
  if(S.opts.hint==='encubierto') return findWord(S.sim) || {w:S.sim, p:[]};
  return botGuess(b).e;
}
function botGuess(b){
  const knowCat = S.opts.hint==='cat' || S.opts.hint==='ambas', knowSim = S.opts.hint==='parecida' || S.opts.hint==='ambas';
  const pool = WORDS.filter(w=>knowCat ? w.c===S.cat : S.opts.cats.includes(w.c));
  const said = S.clues.filter(c=>c.pid!==b.id && c.how==='txt' && !isImp(P(c.pid))).map(c=>c.x);
  let best=null, bs=-1, second=-1;
  for(const w of pool){
    let s=0; for(const x of said) if(clueFits(x, w)) s+=1;
    if(knowSim && (norm(w.s)===norm(S.sim) || norm(w.w)===norm(S.sim))) s+=.8;
    if(knowSim && norm(w.w)===norm(S.sim)) s-=.6;   // la parecida no es la palabra
    s+=Math.random()*.4;
    if(s>bs){ second=bs; bs=s; best=w; } else if(s>second) second=s;
  }
  return {e:best, s:bs, lead:bs-second};
}
function botGuessWord(b){   // no siempre acierta aunque esté seguro: a veces se confunde con otra parecida
  const g=botGuess(b); if(!g.e) return pick(WORDS).w;
  const sure = g.s>=2 ? .8 : g.s>=1 ? .55 : .3;
  if(Math.random()<sure) return g.e.w;
  const alt=WORDS.filter(w=>w.c===g.e.c && w!==g.e); return alt.length ? pick(alt).w : g.e.w;
}
function botClue(b){
  const used=new Set(S.clues.map(c=>norm(c.x)));
  const myWord = wordOf(b);
  let cands=[];
  if(isImp(b) && S.opts.hint!=='encubierto'){
    const g=botGuess(b);
    const knowCat = S.opts.hint==='cat' || S.opts.hint==='ambas';
    if(g.e && g.s>=2 && g.lead>=.8 && Math.random()<.65) cands=g.e.p.slice();   // cree saber la palabra, pero no siempre se arriesga a decir algo tan preciso
    else if(knowCat) cands=CATS[S.cat].gen.slice();
    else cands=VAGUE.slice();
    if(Math.random()<.35 && knowCat) cands=cands.concat(CATS[S.cat].gen);
  } else {
    const e=botEntry(b); cands = e && e.p.length ? e.p.slice() : CATS[S.cat].gen.slice();
  }
  const ok = x => !(myWord && clueSaysWord(x, myWord)) && !clueSaysWord(x, S.word);
  cands=cands.filter(x=>!used.has(norm(x)) && ok(x));
  // en grupos grandes se acaban las pistas: primero las de la categoría, después repetir alguna de otra vuelta
  if(!cands.length) cands=CATS[S.cat].gen.concat(VAGUE).filter(x=>!used.has(norm(x)) && ok(x));
  if(!cands.length){ const e=botEntry(b), now=new Set(S.clues.filter(c=>c.lap===S.lap).map(c=>norm(c.x))); cands=((e&&e.p)||[]).filter(x=>!now.has(norm(x)) && ok(x)); }
  const x = cands.length ? pick(cands) : 'paso';
  addClue(b, x, 'txt');
}
// qué tan sospechoso le parece cada uno
function botSuspicion(b){
  const e=botEntry(b), sc={};
  const others=alive().filter(p=>p.id!==b.id && !(isImp(b) && S.opts.know && isImp(p)) && !(isImp(b) && S.opts.hint!=='encubierto' && isImp(p) && S.opts.know));
  for(const p of others){
    let s=Math.random()*1.2;
    for(const c of S.clues.filter(c=>c.pid===p.id)){
      if(c.how==='skip') s+=1.5;
      else if(c.how==='voz') s+=.3;
      else if(e && clueFits(c.x, e)) s-=1.4;
      else if(CATS[S.cat].gen.concat(VAGUE).some(g=>norm(g)===norm(c.x))) s+=.6;   // pista muy general: algo sospechosa
      else s+=2;
    }
    for(const id in S.votes) if(S.votes[id]===p.id) s+=.7;
    if(isImp(b) && S.opts.hint!=='encubierto' && isImp(p)) s-=6;   // el impostor no vota a su compañero si lo conoce
    sc[p.id]=s;
  }
  return sc;
}
function botVote(b){
  const sc=botSuspicion(b), ids=Object.keys(sc);
  if(!ids.length){ act(b.id, {type:'vote', pid:'skip'}); return; }
  ids.sort((x,y)=>sc[y]-sc[x]);
  const t = sc[ids[0]] < -2 && !isImp(b) && S.lap<=S.opts.laps ? 'skip' : ids[0];   // en la primera votación puede no echar a nadie si nadie le parece raro
  act(b.id, {type:'vote', pid:t});
}
const BOT_TALK = {
  sus:['Para mí es {n}, “{c}” no tiene nada que ver 🤔','Mmm… {n} está medio raro 👀','Yo sospecho de {n}, ¿qué onda esa pista?','{n}, explicame “{c}” 🧐','Che, {n} dijo cualquier cosa 😂'],
  sus0:['Mmm, todavía no sé… 🤔','Hay alguien que está chamuyando 👀','Yo dije algo clarito, ¿eh? 😇','Nde, qué difícil esta ronda 😅','Ojo con los que dicen pistas muy generales 🧐'],
  defend:['¡Yo no fui! Mi pista tenía todo que ver 😤','Ndaha’éi, no soy yo 🙅','¿Por qué yo? Si dije algo re claro 😇'],
};
function botDiscuss(now){
  let ch=false;
  S.botTalk=S.botTalk||{};
  for(const b of alive()){
    if(!autoPlays(b)) continue;
    const st=S.botTalk[b.id]=S.botTalk[b.id]||{n:0, next:now+2500+rnd(5000)};
    if(now<st.next) continue;
    // el impostor que está seguro de la palabra arriesga
    if(b.bot && isImp(b) && S.opts.guess==='siempre' && S.opts.hint!=='encubierto' && !st.risked){
      st.risked=true; const g=botGuess(b);
      if(g.s>=3 && g.lead>=1.5 && Math.random()<.5){ doGuess(b, g.e.w, true); return true; }
    }
    const big=alive().length>8;   // en grupos grandes los bots hablan menos
    if(st.n<(big?1:2) && b.bot && (!big || Math.random()<.5)){
      const sc=botSuspicion(b), ids=Object.keys(sc).sort((x,y)=>sc[y]-sc[x]);
      const t=P(ids[0]);
      const lc=t && S.clues.filter(c=>c.pid===t.id && c.how==='txt').slice(-1)[0];
      let msg;
      if(t && sc[t.id]>1.5 && lc) msg=pick(BOT_TALK.sus).replace('{n}', t.name).replace('{c}', lc.x);
      else if(t && sc[t.id]>1.5) msg=pick(BOT_TALK.sus).replace('{n}', t.name).replace(/“\{c\}”|\{c\}/, 'eso');
      else msg=pick(BOT_TALK.sus0);
      addChat(b.id, msg); ch=true;
    }
    st.n++; st.next=now+5000+rnd(7000);
    if(!S.ready.includes(b.id) && st.n>=2){ S.ready.push(b.id); ch=true; }
  }
  // los desconectados también quedan listos
  for(const b of alive()) if(!b.bot && autoPlays(b) && !S.ready.includes(b.id)){ S.ready.push(b.id); ch=true; }
  if(ch) discCheck();
  return ch;
}
function botPrivate(bot, from, text){
  const t=norm(text);
  const ans = /impostor|sos vos|fuiste/.test(t) ? pick(['¿Yo? Ni loco 😇','Shhh… yo sé quién es 🤫','Ndaha’éi che 🙅'])
    : /palabra|cual es|que es/.test(t) ? pick(['Jajaja, ¿y si sos el impostor? No te digo nada 😏','Eso no se pregunta 🤐','Ni a palos te digo 🤫'])
    : pick(['Dale, votemos juntos 🤝','Upéi hablamos 🧉','Shhh, que nadie se entere 🤫','Oĩma, entendido 👍','Mmm… veremos 🤔']);
  setTimeout(()=>{ if(S) addChat(bot.id, ans, from.id); }, 900+rnd(1500));
}
