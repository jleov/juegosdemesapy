'use strict';
/* =====================================================================
   UNO Paraguayo — mazo, reglas oficiales, reglas de la casa y bots.
   Todo lo decide el anfitrión (o el propio aparato en el modo solo):
   act(pid, accion) cambia el estado S y devuelve un texto si no se puede.
   ===================================================================== */

/* ---------- el mazo con toque paraguayo ---------- */
const COLORS = ['r','y','g','b'];
const COLOR_INFO = {
  r:{n:'Rojo',     hex:'#d52b1e', dark:'#8f1a12', tag:'de la bandera',     emo:'🟥'},
  y:{n:'Amarillo', hex:'#f2b705', dark:'#a67a00', tag:'lapacho amarillo',  emo:'🟨'},
  g:{n:'Verde',    hex:'#1f9e4a', dark:'#0f5f2a', tag:'yerba mate',        emo:'🟩'},
  b:{n:'Azul',     hex:'#0038a8', dark:'#001f63', tag:'de la bandera',     emo:'🟦'},
};
// cada número y cada carta especial tiene su referencia paraguaya (sale dibujada en la carta)
const VAL_INFO = {
  '0':{ref:'Albirroja',        ico:'⚽'},
  '1':{ref:'Tereré',           ico:'🧉'},
  '2':{ref:'Chipa',            ico:'🥯'},
  '3':{ref:'Sopa paraguaya',   ico:'🍰'},
  '4':{ref:'Mbejú',            ico:'🫓'},
  '5':{ref:'Guaraní',          ico:'💵'},
  '6':{ref:'Arpa paraguaya',   ico:'🎶'},
  '7':{ref:'Lapacho',          ico:'🌸'},
  '8':{ref:'Asado',            ico:'🍖'},
  '9':{ref:'Jaguareté',        ico:'🐆'},
  skip:{ref:'¡Ndaikatúi!',     ico:'⛔', sym:'⊘',  name:'Salto'},
  rev: {ref:'Jajevy',          ico:'🔄', sym:'⇄',  name:'Reversa'},
  d2:  {ref:'Jopói',           ico:'🎁', sym:'+2', name:'Roba 2'},
  wild:{ref:'Ñandutí',         ico:'🕸️', sym:'',   name:'Comodín'},
  d4:  {ref:'Pombero',         ico:'👹', sym:'+4', name:'Comodín roba 4'},
};
const isWild = c => c && c.c==='w';
const isAction = c => c && (c.v==='skip'||c.v==='rev'||c.v==='d2');
const cardPts = c => isWild(c) ? 50 : isAction(c) ? 20 : +c.v;
const valSym = c => VAL_INFO[c.v].sym!=null ? VAL_INFO[c.v].sym : c.v;
function cardName(c, color){
  if(!c) return '';
  if(c.v==='wild') return `Comodín Ñandutí${color?' → '+COLOR_INFO[color].n:''}`;
  if(c.v==='d4') return `+4 Pombero${color?' → '+COLOR_INFO[color].n:''}`;
  const col=COLOR_INFO[c.c].n;
  if(isAction(c)) return `${VAL_INFO[c.v].name} ${col} (${VAL_INFO[c.v].ref})`;
  return `${c.v} ${col} (${VAL_INFO[c.v].ref})`;
}
// 108 cartas como el UNO oficial: por color un 0, dos de cada 1-9, dos Salto, dos Reversa y dos Roba 2; 4 Comodines y 4 Comodines +4
function newDeck(){
  const d=[]; let id=1;
  for(const c of COLORS){
    d.push({id:id++, c, v:'0'});
    for(const v of ['1','2','3','4','5','6','7','8','9','skip','rev','d2']) for(let k=0;k<2;k++) d.push({id:id++, c, v});
  }
  for(let k=0;k<4;k++){ d.push({id:id++, c:'w', v:'wild'}); d.push({id:id++, c:'w', v:'d4'}); }
  return d;
}
function rnd(n){ if(window.crypto && crypto.getRandomValues){ const a=new Uint32Array(1); crypto.getRandomValues(a); return a[0]%n; } return Math.floor(Math.random()*n); }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=rnd(i+1); [a[i],a[j]]=[a[j],a[i]]; } return a; }

/* ---------- reglas de la casa (las elige el anfitrión en la sala) ---------- */
const HOUSE = [
  {k:'challenge', def:true,  t:'🕵️ Retar el +4 (oficial)', d:'El que recibe un +4 puede decir que fue tramposo. Si quien lo tiró tenía una carta del color de la mesa, roba 4 él; si no, el que retó roba 6.'},
  {k:'stack',     def:false, t:'📚 Acumular +2 y +4', d:'Si te tiran un +2 podés tirar otro +2 (o un +4) y el siguiente roba todo junto. Sobre un +4 solo se puede tirar otro +4.'},
  {k:'drawUntil', def:false, t:'🃏 Robar hasta poder jugar', d:'Si no tenés qué tirar, robás del mazo hasta que salga una carta que sirva.'},
  {k:'sevenZero', def:false, t:'🔁 7 cambia y 0 gira', d:'Al tirar un 7 cambiás todas tus cartas con quien elijas. Al tirar un 0 todos pasan sus cartas al siguiente, en el sentido del juego.'},
  {k:'jumpIn',    def:false, t:'⚡ Cortar (meterse)', d:'Si tenés una carta exactamente igual (mismo color y número) a la que está arriba, la podés tirar aunque no sea tu turno, y el juego sigue desde vos.'},
  {k:'forcePlay', def:false, t:'👉 Si robás y sirve, se tira', d:'Si la carta que robás se puede tirar, la tenés que tirar sí o sí.'},
];
const TARGETS = [{v:500,t:'A 500 puntos (oficial)'},{v:250,t:'A 250 puntos (más corta)'},{v:0,t:'Una sola mano'}];
function defaultOpts(){ const o={target:500}; HOUSE.forEach(h=>o[h.k]=h.def); return o; }

/* ---------- estado ---------- */
let S=null;
const EMOJIS = ['🧉','🥯','🐆','🌸','🎻','⚽','🐂','🌽','🦜','🐊','🦩','🍖','🌵','🎸','🐎','🦋','🌞','🍉','🐒','🦉'];
const PCOLORS = ['#e63946','#1d70d6','#2a9d3f','#e9a100','#8e44ad','#ff7f11','#13a8a8','#c2185b','#6d4c41','#455a64'];
const BOT_NAMES = [['Ña Chipa','🥯'],['Karai Tereré','🧉'],['Don Jaguareté','🐆'],['Ña Lapacho','🌸'],['Pombero','👹'],['Kuñataĩ Mbejú','🌽'],['Che Ra\'a','🐂'],['Ña Ñandutí','🦋'],['Don Arpa','🎻'],['Pora','🦉']];
const MAXP = 10;
const P = id => S && S.players.find(p=>p.id===id);
const OB = id => S && (S.observers||[]).find(o=>o.id===id);
const topCard = () => S.discard[S.discard.length-1];
const cur = () => S.players[S.turn];
const idxAfter = (from, steps) => { const n=S.players.length; return (((from + S.dir*steps) % n) + n) % n; };
const nextP = (steps=1) => S.players[idxAfter(S.turn, steps)];

function lobbyState(){
  return {v:1, phase:'lobby', seq:0, players:[], observers:[], hostPid:null, opts:defaultOpts(),
    grules:'', sugs:[], log:[], ev:[], evSeq:0, round:0, dealer:0, turn:0, dir:1, color:null,
    deck:[], discard:[], pendingDraw:0, drawn:null, pending4:null, pickColor:null, unoWatch:null, peek:null, roundWin:null};
}
function addPlayer(name, emoji, token, peerId, bot){
  const used=S.players.map(p=>p.color);
  const p={id:'p'+(++S.seq), name:(String(name||'').trim()||'Jugador').slice(0,16), emoji, token, peerId,
    color:PCOLORS.find(c=>!used.includes(c))||PCOLORS[S.players.length%PCOLORS.length],
    conn:!bot, bot:!!bot, mic:false, hand:[], score:0, unoSaid:false};
  S.players.push(p); return p;
}
function addBot(){
  if(S.players.length>=MAXP) return 'Ya son 10 jugadores (el máximo del UNO oficial).';
  const free=BOT_NAMES.filter(([n,e])=>!S.players.some(p=>p.name===n));
  const [n,e]=free.length?free[rnd(free.length)]:['Bot '+(S.players.length+1),'🤖'];
  const b=addPlayer(n, e, null, null, true);
  sysChat(`🤖 ${b.name} se sentó a la mesa.`);
}
function log(x, extra){ S.log.push(Object.assign({x, at:Date.now()}, extra||{})); if(S.log.length>200) S.log.splice(0, S.log.length-200); }
function ev(k, o){ S.ev.push(Object.assign({i:++S.evSeq, k, at:Date.now()}, o||{})); if(S.ev.length>14) S.ev.shift(); }

/* ---------- repartir y robar ---------- */
function reshuffle(){
  if(S.discard.length<=1) return false;
  const t=S.discard.pop(); const rest=S.discard; S.discard=[t];
  S.deck=shuffle(rest.concat(S.deck));
  log('🔀 Se acabó el mazo: se mezclan las cartas tiradas (menos la de arriba).');
  return true;
}
function drawCards(p, k){
  const got=[];
  for(let i=0;i<k;i++){
    if(!S.deck.length && !reshuffle()) break;
    const c=S.deck.pop(); p.hand.push(c); got.push(c);
  }
  if(got.length){ p.unoSaid=false; ev('draw', {pid:p.id, n:got.length, ids:got.map(c=>c.id)}); }
  if(S.unoWatch && S.unoWatch.pid===p.id && p.hand.length!==1) S.unoWatch=null;
  return got;
}
function deal(){
  const n=S.players.length;
  S.deck=shuffle(newDeck()); S.discard=[]; S.dir=1; S.pendingDraw=0; S.drawn=null; S.pending4=null; S.pickColor=null; S.unoWatch=null; S.peek=null; S.roundWin=null;
  S.players.forEach(p=>{ p.hand=[]; p.unoSaid=false; });
  for(let r=0;r<7;r++) for(let i=1;i<=n;i++) S.players[(S.dealer+i)%n].hand.push(S.deck.pop());
  // la primera carta: si es un +4 vuelve al mazo y se da vuelta otra
  let t=S.deck.pop();
  while(t.v==='d4'){ S.deck.push(t); shuffle(S.deck); t=S.deck.pop(); }
  S.discard=[t]; S.color = isWild(t) ? null : t.c;
  S.turn=(S.dealer+1)%n;
  const d=S.players[S.dealer];
  log(`🃏 Mano ${S.round}: reparte ${d.name}. Se dan vuelta: ${cardName(t)}.`, {card:t});
  ev('deal', {});
  if(t.v==='skip'){ log(`⛔ ${cur().name} pierde el turno por la carta de salida.`); S.turn=idxAfter(S.turn,1); }
  else if(t.v==='rev'){ S.dir=-1; S.turn=S.dealer; log(`🔄 La salida es Reversa: empieza ${cur().name} y se juega al revés.`); }
  else if(t.v==='d2'){ const v=cur(); drawCards(v,2); log(`🎁 ${v.name} roba 2 por la carta de salida y pierde el turno.`); S.turn=idxAfter(S.turn,1); }
  else if(t.v==='wild'){ S.pickColor={pid:cur().id}; log(`🕸️ La salida es un Comodín: ${cur().name} elige el color.`); }
  S.turnAt=Date.now();
}
function startGame(){
  S.phase='play'; S.round=1; S.dealer=rnd(S.players.length); S.startedAt=Date.now();
  S.players.forEach(p=>p.score=0); S.log=[];
  deal();
}
function nextRound(){
  S.phase='play'; S.round++; S.dealer=(S.dealer+1)%S.players.length; deal();
}

/* ---------- qué se puede tirar ---------- */
function canPlay(c){
  if(!S || S.phase!=='play' || !c) return false;
  const t=topCard();
  if(S.pendingDraw>0){   // hay un +2/+4 acumulado: solo se puede apilar
    if(c.v==='d4') return true;
    if(c.v==='d2') return t.v==='d2';
    return false;
  }
  if(isWild(c)) return true;
  if(!S.color) return false;
  return c.c===S.color || c.v===t.v;
}
// cortar: carta exactamente igual a la de arriba (mismo color y mismo número o símbolo)
function canJumpIn(p, c){
  const t=topCard();
  return S.opts.jumpIn && S.phase==='play' && !S.pending4 && !S.pickColor && !S.pendingDraw && !isWild(c) && !isWild(t)
    && c.c===t.c && c.v===t.v && cur().id!==p.id;
}
const isTurn = pid => S && S.phase==='play' && cur() && cur().id===pid;

/* ---------- jugadas ---------- */
function clearWatchFor(pid){ if(S.unoWatch && S.unoWatch.pid!==pid) S.unoWatch=null; }
function nextTurn(steps){ S.turn=idxAfter(S.turn, steps); S.drawn=null; S.turnAt=Date.now(); }

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
    case 'joinNext': {   // un observador se sienta a la mesa (en la sala o entre manos)
      const o=OB(pid); if(!o) return;
      if(S.phase==='play') return 'Esperá a que termine la mano para sentarte.';
      if(S.players.length>=MAXP) return 'La mesa está llena (10 jugadores).';
      if(o.owner) return;
      S.observers=S.observers.filter(x=>x!==o);
      const np=addPlayer(o.name, o.emoji==='👀'?EMOJIS.find(e=>!S.players.some(q=>q.emoji===e)):o.emoji, o.token, o.peerId);
      np.conn=o.conn;
      if(typeof onSeatChange==='function') onSeatChange(pid, np.id);
      sysChat(`🪑 ${np.name} se sentó a la mesa${S.phase==='lobby'?'':' para la próxima mano'}.`);
      commit(); return;
    }
  }
  if(!p) return;
  const host = pid===S.hostPid || NET.mode==='local';
  switch(a.type){
    case 'addBot': if(!host||S.phase!=='lobby') return; { const r=addBot(); if(r) return r; } commit(); return;
    case 'kick': {
      if(!host) return; const t=P(a.pid); if(!t || t.id===S.hostPid) return;
      removePlayer(t, `🚪 ${t.name} fue sacado de la mesa.`); commit(); return;
    }
    case 'botify': {   // un jugador desconectado pasa a ser manejado por un bot
      if(!host) return; const t=P(a.pid); if(!t || t.bot) return;
      t.bot=true; t.conn=false; t.mic=false; t.token=null; sysChat(`🤖 Un bot sigue jugando con las cartas de ${t.name}.`); log(`🤖 Un bot juega por ${t.name}.`); commit(); return;
    }
    case 'opt': {
      if(!host || S.phase!=='lobby') return;
      if(a.k==='target') S.opts.target=+a.v||0; else if(HOUSE.some(h=>h.k===a.k)) S.opts[a.k]=!!a.v;
      commit(); return;
    }
    case 'grules': if(!host) return; S.grules=String(a.text||'').slice(0,1200); commit(); return;
    case 'sugDel': if(!host) return; S.sugs=S.sugs.filter(s=>s.id!==a.id); commit(); return;
    case 'start': {
      if(!host || S.phase!=='lobby') return;
      if(S.players.length<2) return 'Hacen falta al menos 2 jugadores (sumá un bot 🤖).';
      startGame(); sysChat('🃏 ¡Empieza la partida! Suerte a todos.'); commit(); return;
    }
    case 'nextRound': if(!host || S.phase!=='roundEnd') return; nextRound(); commit(); return;
    case 'newGame': if(!host || S.phase!=='over') return; S.phase='lobby'; S.log=[]; S.players.forEach(x=>{x.hand=[]; x.score=0;}); S.deck=[]; S.discard=[]; commit(); return;
    case 'leave': {
      if(S.phase==='lobby' || S.phase==='over') removePlayer(p, `🚪 ${p.name} se fue.`);
      else { p.bot=true; p.conn=false; p.mic=false; p.token=null; sysChat(`🚪 ${p.name} se fue: un bot 🤖 sigue con sus cartas.`); log(`🚪 ${p.name} se fue: un bot sigue con sus cartas.`); }
      commit(); return;
    }
    case 'uno': {
      if(S.phase!=='play') return;
      if(S.unoWatch && S.unoWatch.pid===pid){ S.unoWatch=null; log(`📣 ${p.name} cantó ¡UNO! a tiempo.`); ev('uno',{pid}); commit(); return; }
      if(p.hand.length===1){ ev('uno',{pid}); commit(); return; }   // ya lo había cantado
      return 'Se canta ¡UNO! cuando te queda una sola carta.';
    }
    case 'catch': {
      const w=S.unoWatch; if(!w) return 'Nadie se olvidó de cantar ¡UNO!';
      if(w.pid===pid) return;
      const t=P(w.pid); S.unoWatch=null;
      if(!t || t.hand.length!==1){ commit(); return; }
      drawCards(t,1);
      log(`🚨 ${p.name} le cantó ¡UNO! antes a ${t.name}: roba 1 carta del mazo.`, {pid:t.id});
      ev('catch', {pid:t.id, by:pid});
      commit(); return;
    }
    case 'pickColor': {
      if(!S.pickColor || S.pickColor.pid!==pid || !COLORS.includes(a.color)) return;
      S.color=a.color; S.pickColor=null; log(`🎨 ${p.name} elige el color ${COLOR_INFO[a.color].n}.`); commit(); return;
    }
    case 'accept4': case 'challenge': {
      const X=S.pending4; if(!X || X.victim!==pid) return;
      S.pending4=null; clearWatchFor(pid);
      const off=P(X.by);
      if(a.type==='accept4'){
        drawCards(p,4); log(`👹 ${p.name} roba 4 por el Pombero y pierde el turno.`, {pid});
        nextTurn(1);
      } else if(X.illegal && off){
        S.peek={to:pid, of:off.id, name:off.name, cards:off.hand.map(c=>({...c})), at:Date.now()};
        drawCards(off,4);
        log(`🕵️ ${p.name} retó a ${off.name} y ¡lo agarró! Tenía una carta ${COLOR_INFO[X.prev].n.toLowerCase()}: ${off.name} roba 4 y ${p.name} juega normal.`);
        ev('challenge', {pid, ok:true});
        S.drawn=null; S.turnAt=Date.now();
      } else {
        drawCards(p,6); log(`🕵️ ${p.name} retó a ${off?off.name:'?'} pero el +4 era legal: ${p.name} roba 6 y pierde el turno.`, {pid});
        ev('challenge', {pid, ok:false});
        nextTurn(1);
      }
      commit(); return;
    }
    case 'draw': {
      if(S.phase!=='play') return;
      if(!isTurn(pid)) return 'No es tu turno.';
      if(S.pending4) return 'Primero decidí si aceptás el +4 o retás.';
      if(S.pickColor) return 'Primero elegí el color.';
      if(S.drawn) return 'Ya robaste: tirá esa carta o pasá.';
      clearWatchFor(pid);
      if(S.pendingDraw){
        const k=S.pendingDraw; S.pendingDraw=0; drawCards(p,k);
        log(`📚 ${p.name} no apila y roba ${k} cartas.`, {pid}); nextTurn(1); commit(); return;
      }
      let got=[];
      if(S.opts.drawUntil){
        for(let i=0;i<60;i++){ const g=drawCards(p,1); if(!g.length) break; got.push(g[0]); if(canPlay(g[0])) break; }
      } else got=drawCards(p,1);
      const last=got[got.length-1];
      log(`🂠 ${p.name} roba ${got.length===1?'1 carta':got.length+' cartas'}.`, {pid});
      if(last && canPlay(last)){ S.drawn=last.id; }
      else nextTurn(1);
      commit(); return;
    }
    case 'pass': {
      if(!isTurn(pid) || !S.drawn) return;
      if(S.opts.forcePlay) return 'Con la regla de la casa “si robás y sirve, se tira”, tenés que tirarla.';
      log(`✋ ${p.name} se queda con la carta y pasa.`); nextTurn(1); commit(); return;
    }
    case 'play': {
      if(S.phase!=='play') return;
      const c=p.hand.find(x=>x.id===a.id); if(!c) return 'Esa carta no está en tu mano.';
      if(S.pending4 || S.pickColor) return isTurn(pid)?'Primero resolvé lo pendiente.':'No es tu turno.';
      let jump=false;
      if(!isTurn(pid)){
        if(canJumpIn(p,c)) jump=true;
        else return S.opts.jumpIn ? 'No es tu turno (solo podés cortar con una carta idéntica a la de arriba).' : 'No es tu turno.';
      }
      if(!jump && S.drawn && c.id!==S.drawn) return 'Después de robar solo podés tirar la carta que robaste.';
      if(!jump && !canPlay(c)) return S.pendingDraw ? `Te tiraron +${S.pendingDraw}: apilá un ${topCard().v==='d4'?'+4':'+2 o +4'} o robá.` : 'Esa carta no coincide en color ni en número o símbolo.';
      if(isWild(c) && !COLORS.includes(a.color)) return 'Elegí un color.';
      const seven = S.opts.sevenZero && c.v==='7' && p.hand.length>1;
      if(seven && (!P(a.target) || a.target===pid)) return 'Elegí con quién cambiar las cartas.';
      if(jump){ S.turn=S.players.indexOf(p); log(`⚡ ${p.name} ¡corta! con una carta igual.`); ev('jump',{pid}); }
      clearWatchFor(pid);
      doPlay(p, c, a);
      commit(); return;
    }
  }
}

function doPlay(p, c, a){
  const prev=S.color;
  // ¿el +4 fue legal? (oficial: solo se puede tirar si no tenés ninguna carta del color de la mesa)
  const illegal = c.v==='d4' && p.hand.some(x=>x.id!==c.id && x.c===prev);
  p.hand=p.hand.filter(x=>x.id!==c.id);
  S.discard.push(c); S.drawn=null;
  S.color = isWild(c) ? a.color : c.c;
  log(`${p.emoji} ${p.name} tira ${cardName(c, isWild(c)?a.color:null)}.`, {card:c, pid:p.id, col:S.color});
  ev('play', {pid:p.id, card:c, col:S.color});
  if(p.hand.length===1){
    S.unoWatch={pid:p.id, at:Date.now()};   // le queda una: tiene que cantar ¡UNO! antes que otro se lo cante
  }
  p.unoSaid=false;
  const n=S.players.length, me=S.players.indexOf(p);
  const after = k => S.players[idxAfter(me, k)];
  let steps=1;
  if(c.v==='skip'){ steps=2; log(`⛔ ${after(1).name} pierde el turno.`); }
  else if(c.v==='rev'){ S.dir*=-1; if(n===2){ steps=2; log(`🔄 Jajevy: con 2 jugadores, ${after(1).name} pierde el turno.`); } else log('🔄 Jajevy: cambia el sentido del juego.'); }
  else if(c.v==='d2'){
    if(S.opts.stack){ S.pendingDraw+=2; log(`🎁 Se acumulan +${S.pendingDraw} para ${after(1).name}.`); }
    else { const v=after(1); drawCards(v,2); log(`🎁 ${v.name} roba 2 y pierde el turno.`, {pid:v.id}); steps=2; }
  }
  else if(c.v==='d4'){
    const v=after(1);
    if(S.opts.stack){ S.pendingDraw+=4; log(`👹 Se acumulan +${S.pendingDraw} para ${v.name}.`); }
    else if(S.opts.challenge && p.hand.length>0){ S.pending4={by:p.id, victim:v.id, illegal, prev}; }
    else { drawCards(v,4); log(`👹 ${v.name} roba 4 y pierde el turno.`, {pid:v.id}); steps=2; }
  }
  if(p.hand.length===0){
    if(S.pendingDraw){ const v=after(1); drawCards(v,S.pendingDraw); log(`📚 ${v.name} roba las ${S.pendingDraw} acumuladas.`); S.pendingDraw=0; }
    return endRound(p);
  }
  if(S.opts.sevenZero && c.v==='7'){
    const t=P(a.target);
    if(t){ [p.hand, t.hand]=[t.hand, p.hand]; p.unoSaid=t.unoSaid=false; S.unoWatch=null; log(`🔁 ${p.name} cambia sus cartas con ${t.name}.`); ev('swap',{pid:p.id, to:t.id}); }
  } else if(S.opts.sevenZero && c.v==='0'){
    const hands=S.players.map(x=>x.hand);
    S.players.forEach((x,i)=>{ S.players[idxAfter(i,1)].hand=hands[i]; x.unoSaid=false; });
    S.unoWatch=null; log('🔁 ¡Cero! Todos pasan sus cartas al siguiente.'); ev('rotate',{});
  }
  S.turn=me; nextTurn(steps);
}

function endRound(w){
  let pts=0;
  S.players.forEach(x=>{ if(x!==w) pts+=x.hand.reduce((s,c)=>s+cardPts(c),0); });
  w.score+=pts;
  S.unoWatch=null; S.pending4=null; S.pendingDraw=0; S.drawn=null;
  const over = !S.opts.target || w.score>=S.opts.target;
  S.roundWin={pid:w.id, pts, hands:S.players.map(x=>({id:x.id, cards:x.hand.map(c=>({...c})), pts:x.hand.reduce((s,c)=>s+cardPts(c),0)}))};
  S.phase = over ? 'over' : 'roundEnd';
  log(`🏆 ${w.name} se quedó sin cartas y gana la mano: +${pts} puntos (total ${w.score}).`);
  if(over) log(`🎉 ¡${w.name} gana la partida${S.opts.target?' con '+w.score+' puntos':''}!`);
  ev('win', {pid:w.id});
  sysChat(over ? `🎉 ¡${w.name} ganó la partida!` : `🏆 ${w.name} ganó la mano ${S.round} (+${pts}).`);
}

function removePlayer(t, msg){
  const i=S.players.indexOf(t); if(i<0) return;
  if(S.phase==='play' || S.phase==='roundEnd'){
    S.deck=shuffle(S.deck.concat(t.hand));
    S.players.splice(i,1);
    if(S.pending4 && (S.pending4.by===t.id || S.pending4.victim===t.id)) S.pending4=null;
    if(S.unoWatch && S.unoWatch.pid===t.id) S.unoWatch=null;
    if(S.pickColor && S.pickColor.pid===t.id){ S.pickColor=null; S.color=COLORS[rnd(4)]; }
    const n=S.players.length;
    if(n<2){ S.phase='over'; log(msg); if(n===1) log(`🎉 ${S.players[0].name} queda solo en la mesa y gana.`); sysChat(msg); return; }
    if(i<S.turn) S.turn--;
    else if(i===S.turn){ S.drawn=null; if(S.dir===-1) S.turn--; }
    S.turn=((S.turn%n)+n)%n;
    if(S.dealer>=n) S.dealer=0;
    log(msg);
  } else S.players.splice(i,1);
  if(NET.conns && NET.conns[t.id]){ try{ NET.conns[t.id].send({t:'kicked'}); }catch(e){} }
  sysChat(msg);
}

/* ====================== BOTS ====================== */
// un bot (o el jugador que se cortó hace rato) decide qué hacer; lo corre solo el anfitrión
const BOT = {next:0, watchTry:null, selfTry:null, jumpTry:0};
const BOT_TALK = {
  play:['¡Tomá!','Upéi…','¡Ahí va!','Jaha 😎','Esa te dolió','¡Aguanteee!','Mba\'éichapa la mano 😏'],
  d4:['¡El Pombero te visita! 👹','Che ra\'a, robá nomás 😈','+4 y un tereré 🧉'],
  uno:['¡UNO! 📣','¡Peteĩ! (uno) 📣','¡UNO, atención! 📣'],
  catchd:['¡UNO! 📣 Te lo canté primero, robá una 😜','Ndaje… ¡UNO! Te gané de mano 📣'],
  draw:['Nde… a robar 😩','Ndaipóri… robo','Ni una me sirve 😅'],
};
const pick = a => a[rnd(a.length)];
const autoPlays = p => p.bot || (!p.conn && p.offAt && Date.now()-p.offAt>20000);
function botColor(hand){
  const cnt={r:0,y:0,g:0,b:0}; hand.forEach(c=>{ if(!isWild(c)) cnt[c.c]+= 1 + (isAction(c)?.5:0); });
  const best=Object.entries(cnt).sort((a,b)=>b[1]-a[1]);
  return best[0][1]>0 ? best[0][0] : COLORS[rnd(4)];
}
function botChoose(b){
  let ok=b.hand.filter(canPlay);
  if(S.drawn) ok=ok.filter(c=>c.id===S.drawn);
  if(!ok.length) return S.drawn ? {type:'pass'} : {type:'draw'};
  const nx=nextP(1), danger=nx.hand.length<=2, others=b.hand.length;
  const hasColor=b.hand.some(c=>c.c===S.color);
  let best=null, bs=-1e9;
  for(const c of ok){
    let s=10 + (isWild(c)?0:cardPts(c)/3);
    if(c.v==='wild') s -= others>3 ? 25 : 0;
    if(c.v==='d4'){ s -= others>3 ? 35 : 5; if(hasColor && !S.pendingDraw && rnd(10)>0) s-=200; }   // casi nunca hace trampa con el +4
    if(danger && (c.v==='skip'||c.v==='d2'||c.v==='d4')) s+=45;
    if(c.c===S.color) s+=4;
    if(BOT.wish && BOT.wish[b.id] && (c.c===BOT.wish[b.id] || c.v===BOT.wish[b.id])) s+=6;   // le pidieron en secreto ese color o número
    s+=Math.random()*4;
    if(s>bs){ bs=s; best=c; }
  }
  if(S.drawn && S.drawn===best.id && bs<0 && !S.opts.forcePlay) return {type:'pass'};
  const a={type:'play', id:best.id};
  if(isWild(best)) a.color=botColor(b.hand.filter(c=>c.id!==best.id));
  if(S.opts.sevenZero && best.v==='7' && b.hand.length>1){
    const t=S.players.filter(x=>x!==b).sort((x,y)=>x.hand.length-y.hand.length)[0]; a.target=t.id;
  }
  return a;
}
function botTick(){
  if(!S || S.phase!=='play' || (NET.mode!=='host' && NET.mode!=='local')) return;
  const now=Date.now();
  // alguien se olvidó de cantar UNO: algún bot lo puede agarrar (no al instante, para dar tiempo a cantarlo)
  const w=S.unoWatch;
  if(w){
    const t=P(w.pid);
    if(t && autoPlays(t) && BOT.selfTry!==w.at){ BOT.selfTry=w.at; if(!t.bot || Math.random()<.85){ setTimeout(()=>{ if(S.unoWatch && S.unoWatch.pid===t.id){ act(t.id,{type:'uno'}); if(t.bot) botChat(t,pick(BOT_TALK.uno)); } }, 700+rnd(1500)); } }
    const catchers=S.players.filter(x=>x.bot && x.id!==w.pid);
    if(catchers.length && now-w.at>1800 && BOT.watchTry!==w.at){
      BOT.watchTry=w.at;
      if(Math.random()<.55){ const c=pick(catchers); setTimeout(()=>{ if(S.unoWatch && S.unoWatch.at===w.at){ botChat(c,pick(BOT_TALK.catchd)); act(c.id,{type:'catch'}); } }, rnd(1800)); }
    }
  }
  if(now<BOT.next) return;
  // cortar con una carta idéntica
  if(S.opts.jumpIn && now-BOT.jumpTry>2500 && now-(S.turnAt||0)>700){
    BOT.jumpTry=now;
    for(const b of S.players.filter(x=>x.bot && x!==cur())){
      const c=b.hand.find(x=>canJumpIn(b,x));
      if(c && Math.random()<.3){ const a={type:'play', id:c.id};
        if(S.opts.sevenZero && c.v==='7') a.target=S.players.filter(x=>x!==b).sort((x,y)=>x.hand.length-y.hand.length)[0].id; BOT.next=now+1200; return act(b.id,a); }
    }
  }
  if(S.pending4){ const v=P(S.pending4.victim); if(v && autoPlays(v)){ BOT.next=now+1300; return act(v.id,{type: Math.random()<.28?'challenge':'accept4'}); } return; }
  if(S.pickColor){ const v=P(S.pickColor.pid); if(v && autoPlays(v)){ BOT.next=now+900; return act(v.id,{type:'pickColor', color:botColor(v.hand)}); } return; }
  const b=cur(); if(!b || !autoPlays(b)) return;
  if(now-(S.turnAt||0) < 900+rnd(700)) return;
  const a=botChoose(b);
  BOT.next=now+700;
  if(a.type==='play'){
    const c=b.hand.find(x=>x.id===a.id);
    if(c && c.v==='d4' && Math.random()<.5) botChat(b,pick(BOT_TALK.d4));
    else if(Math.random()<.08) botChat(b,pick(BOT_TALK.play));
  } else if(a.type==='draw' && Math.random()<.1) botChat(b,pick(BOT_TALK.draw));
  const r=act(b.id,a);
  if(typeof r==='string'){ console.warn('bot', r, a); if(a.type==='play') act(b.id, S.drawn?{type:'pass'}:{type:'draw'}); }
}
setInterval(botTick, 450);
// los bots contestan los pedidos en secreto (y a veces les hacen caso)
function botPrivate(bot, from, text){
  const t=text.toLowerCase();
  const col=COLORS.find(c=>t.includes(COLOR_INFO[c].n.toLowerCase()));
  const num=(t.match(/\b([0-9])\b/)||[])[1];
  BOT.wish=BOT.wish||{};
  if(col||num) BOT.wish[bot.id]=col||num;
  const ans = col||num ? pick(['Dale, voy a ver qué puedo hacer 😉','Oĩma, si tengo te lo tiro 🤫','Mmm… veremos 🤔','¡Trato hecho! 🤝']) : pick(['Jaja, ¿y qué me das a cambio? 😏','Shhh, que nadie se entere 🤫','Upéi hablamos 🧉']);
  setTimeout(()=>{ if(S) addChat(bot.id, ans, from.id); }, 900+rnd(1500));
}
