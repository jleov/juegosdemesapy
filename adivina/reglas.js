'use strict';
/* =====================================================================
   Adivina Quién PY — estado de la partida, turnos, preguntas y bots.
   Todo lo decide el anfitrión; a cada aparato le manda solo lo que puede
   ver (nadie ve el personaje secreto del otro, tampoco los que miran).
   ===================================================================== */
let S=null;
const EMOJIS=['🧉','🥯','🐆','🌸','🎻','⚽','🐂','🌽','🦜','🐊','🦩','🍖','🌵','🎸','🐎','🦋','🌞','🍉','🦉','🕵️'];
const PCOLORS=['#e63946','#1d70d6','#2a9d3f','#e9a100'];
const BOT_NAMES=[['Don Detective','🕵️'],['Ña Chismosa','🦜'],['Karai Pregunta','🧉'],['Pombero','👹'],['Kuñataĩ Lupa','🔎']];
const MAXP=2;
const P = id => S && S.players.find(p=>p.id===id);
const OB = id => S && (S.observers||[]).find(o=>o.id===id);
const SIZES=[{v:16,t:'16 personajes (rápida)'},{v:20,t:'20 personajes'},{v:24,t:'24 personajes (como el original)'},{v:30,t:'30 personajes'},{v:36,t:'36 personajes (larga)'}];
const RACES=[{v:1,t:'Una sola ronda'},{v:2,t:'Al mejor de 3 (gana 2)'},{v:3,t:'Al mejor de 5 (gana 3)'}];
const PICKS={elegir:'✋ Cada uno elige su personaje', azar:'🎲 El juego reparte al azar'};
const WRONGS={pierde:'❌ Si arriesgás y errás, perdés la ronda (como el original)', turno:'🔄 Si errás, solo perdés el turno'};
function defaultOpts(){ return {cats:['fut','his','pol','far','inf'], mios:true, n:24, pick:'elegir', wrong:'pierde', race:2, ayuda:true, libres:true, bot:'normal'}; }
const BOTLV=[{v:'facil',t:'🙂 Fácil'},{v:'normal',t:'😎 Normal'},{v:'crack',t:'🔥 Crack'}];

// personajes: los del juego + los que agregó el anfitrión (llegan aparte, con su foto)
let MIOS={};
const CH = id => PERSONAJES.find(p=>p.id===id) || MIOS[id] || null;

function lobbyState(){
  return {v:1, phase:'lobby', seq:0, players:[], observers:[], hostPid:null, opts:defaultOpts(), grules:'', sugs:[], log:[],
    board:[], sec:{}, down:{}, cur:null, stage:null, q:null, qs:[], round:0, wins:{}, roundWin:null, starter:null, miosRev:0};
}
function addPlayer(name, emoji, token, peerId, bot){
  const used=S.players.map(p=>p.color);
  const p={id:'p'+(++S.seq), name:(String(name||'').trim()||'Jugador').slice(0,16), emoji, token, peerId,
    color:PCOLORS.find(c=>!used.includes(c))||PCOLORS[0], conn:!bot, bot:!!bot, mic:false};
  S.players.push(p); return p;
}
function addBot(){
  if(S.players.length>=MAXP) return 'Ya hay 2 jugadores. Los demás entran a mirar.';
  const free=BOT_NAMES.filter(([n])=>!S.players.some(p=>p.name===n));
  const [n,e]=free[rnd(free.length)];
  const b=addPlayer(n, e, null, null, true);
  sysChat(`🤖 ${b.name} se sentó a jugar.`);
}
function log(x){ S.log.push({x, at:Date.now()}); if(S.log.length>200) S.log.splice(0, S.log.length-200); }
function rnd(n){ if(window.crypto && crypto.getRandomValues){ const a=new Uint32Array(1); crypto.getRandomValues(a); return a[0]%n; } return Math.floor(Math.random()*n); }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=rnd(i+1); [a[i],a[j]]=[a[j],a[i]]; } return a; }
const other = (st, pid) => (st.players.find(p=>p.id!==pid)||{}).id;
const pname = pid => { const p=P(pid); return p ? p.emoji+' '+p.name : '?'; };

/* ---------- personajes que entran en la partida ---------- */
function poolFor(o){
  const list=PERSONAJES.filter(p=>o.cats.includes(p.cat));
  if(o.mios) Object.values(MIOS).forEach(p=>{ if(o.cats.includes(p.cat) || p.cat==='mio') list.push(p); });
  return list;
}
function canStart(){
  if(S.players.length<2) return 'Hacen falta 2 jugadores (podés sumar un bot 🤖).';
  if(!S.opts.cats.length) return 'Elegí al menos una categoría de personajes.';
  if(poolFor(S.opts).length<8) return 'Con esas categorías hay muy pocos personajes: sumá otra.';
  return null;
}
function startGame(){
  S.round=0; S.wins={}; S.players.forEach(p=>S.wins[p.id]=0);
  S.starter=S.players[rnd(2)].id; newRound();
}
function newRound(){
  S.round++;
  const pool=shuffle(poolFor(S.opts).slice());
  S.board=pool.slice(0, Math.min(S.opts.n, pool.length)).map(p=>p.id);
  S.sec={}; S.down={}; S.players.forEach(p=>S.down[p.id]=[]);
  S.q=null; S.qs=[]; S.roundWin=null; S.stage='ask';
  if(S.round>1) S.starter=other(S, S.starter);
  S.cur=S.starter;
  if(S.opts.pick==='azar'){ S.players.forEach(p=>S.sec[p.id]=S.board[rnd(S.board.length)]); S.phase='play';
    log(`🎲 Ronda ${S.round}: el juego repartió los personajes secretos. Empieza ${pname(S.cur)}.`); }
  else { S.phase='pick'; log(`🃏 Ronda ${S.round}: cada uno elige su personaje secreto.`); }
}
function roundOver(w, why){
  S.wins[w]=(S.wins[w]||0)+1;
  S.roundWin={pid:w, why, sec:Object.assign({}, S.sec), at:Date.now()};
  S.phase = S.wins[w]>=S.opts.race ? 'over' : 'roundEnd';
  S.stage=null;
  log(`🏆 ${pname(w)} ganó la ronda: ${why}`);
}
const leftFor = (st, pid) => st.board.filter(id=>!(st.down[pid]||[]).includes(id));

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
      if(S.phase==='over'){ S.phase='lobby'; }
      if(typeof onSeatChange==='function') onSeatChange(pid, np.id);
      sysChat(`🪑 ${np.name} se sentó a jugar.`); commit(); return;
    }
  }
  if(!p) return;
  const host = pid===S.hostPid || NET.mode==='local';
  const opp = other(S, pid);
  switch(a.type){
    case 'addBot': if(!host||S.phase!=='lobby') return; { const r=addBot(); if(r) return r; } commit(); return;
    case 'kick': {
      if(!host) return; const t=P(a.pid); if(!t || t.id===S.hostPid) return;
      removePlayer(t, `🚪 ${t.name} salió de la mesa.`); commit(); return;
    }
    case 'botify': {
      if(!host) return; const t=P(a.pid); if(!t || t.bot) return;
      t.bot=true; t.conn=false; t.mic=false; t.token=null; sysChat(`🤖 Un bot sigue jugando por ${t.name}.`); commit(); return;
    }
    case 'opt': {
      if(!host || S.phase!=='lobby') return;
      const o=S.opts;
      if(a.k==='cat' && CATS[a.v]){ o.cats = o.cats.includes(a.v) ? o.cats.filter(c=>c!==a.v) : o.cats.concat(a.v); }
      else if(a.k==='n') o.n=Math.max(12,Math.min(48,+a.v||24));
      else if(a.k==='race') o.race=Math.max(1,Math.min(5,+a.v||1));
      else if(a.k==='pick' && PICKS[a.v]) o.pick=a.v;
      else if(a.k==='wrong' && WRONGS[a.v]) o.wrong=a.v;
      else if(a.k==='bot' && BOTLV.some(x=>x.v===a.v)) o.bot=a.v;
      else if(['ayuda','libres','mios'].includes(a.k)) o[a.k]=!!a.v;
      commit(); return;
    }
    case 'grules': if(!host) return; S.grules=String(a.text||'').slice(0,1200); commit(); return;
    case 'sugDel': if(!host) return; S.sugs=S.sugs.filter(s=>s.id!==a.id); commit(); return;
    case 'start': {
      if(!host || S.phase!=='lobby') return;
      const r=canStart(); if(r) return r;
      startGame(); sysChat(`🕵️ ¡Empieza la partida! ${S.board.length} personajes en el tablero.`); commit(); return;
    }
    case 'nextRound': if(!host || S.phase!=='roundEnd') return; newRound(); commit(); return;
    case 'rematch': if(!host || S.phase!=='over') return; startGame(); sysChat('🔁 ¡Revancha!'); commit(); return;
    case 'newGame': if(!host) return;
      S.phase='lobby'; S.board=[]; S.sec={}; S.down={}; S.q=null; S.qs=[]; S.roundWin=null; S.stage=null; commit(); return;
    case 'leave': {
      if(S.phase==='lobby' || S.phase==='over') removePlayer(p, `🚪 ${p.name} se fue.`);
      else { p.bot=true; p.conn=false; p.mic=false; p.token=null; sysChat(`🚪 ${p.name} se fue: un bot 🤖 sigue por él.`); }
      commit(); return;
    }
    case 'pick': {
      if(S.phase!=='pick' || S.sec[pid]) return;
      if(!S.board.includes(a.id)) return;
      S.sec[pid]=a.id;
      log(`✅ ${pname(pid)} ya eligió su personaje secreto.`);
      if(S.players.every(x=>S.sec[x.id])){ S.phase='play'; S.stage='ask'; log(`▶️ ¡A jugar! Pregunta primero ${pname(S.cur)}.`); }
      commit(); return;
    }
    case 'flip': {   // bajar o levantar una carta del propio tablero
      if(S.phase!=='play' || !S.board.includes(a.id)) return;
      const d=S.down[pid]||(S.down[pid]=[]);
      const i=d.indexOf(a.id); if(i>=0) d.splice(i,1); else d.push(a.id);
      commit(); return;
    }
    case 'ask': {    // pregunta rápida: la contesta el juego, sin trampa
      if(S.phase!=='play' || S.cur!==pid || S.stage!=='ask') return 'No es tu turno de preguntar.';
      const q=PREGUNTAS.find(x=>x.k===a.k); if(!q) return;
      const ans = respuesta(CH(S.sec[opp]), q.k) ? 'si' : 'no';
      S.q={n:S.qs.length+1, by:pid, to:opp, k:q.k, text:q.q, ans, auto:true};
      S.qs.push(S.q); S.stage='flip';
      log(`❓ ${pname(pid)}: ${q.q} → ${ans==='si'?'✅ Sí':'❌ No'}`);
      commit(); return;
    }
    case 'askFree': {   // pregunta escrita: la contesta el otro jugador
      if(S.phase!=='play' || S.cur!==pid || S.stage!=='ask') return 'No es tu turno de preguntar.';
      if(!S.opts.libres) return 'En esta mesa solo valen las preguntas de la lista.';
      let t=String(a.text||'').trim().slice(0,160); if(t.length<3) return 'Escribí la pregunta.';
      if(!/\?$/.test(t)) t+='?'; if(!/^¿/.test(t)) t='¿'+t;
      S.q={n:S.qs.length+1, by:pid, to:opp, k:null, text:t, ans:null, auto:false, at:Date.now()};
      S.qs.push(S.q); S.stage='answer';
      log(`❓ ${pname(pid)} pregunta: ${t}`);
      commit(); return;
    }
    case 'answer': {
      if(S.phase!=='play' || S.stage!=='answer' || !S.q || S.q.to!==pid) return;
      if(!['si','no','nose'].includes(a.a)) return;
      S.q.ans=a.a; S.stage='flip';
      log(`💬 ${pname(pid)} contestó: ${ANS[a.a]}`);
      commit(); return;
    }
    case 'autoFlip': {   // ayuda: baja las cartas que ya no pueden ser
      if(S.phase!=='play' || S.cur!==pid || S.stage!=='flip' || !S.q || !S.q.k || !S.opts.ayuda) return;
      const want=S.q.ans==='si', d=S.down[pid];
      S.board.forEach(id=>{ if(respuesta(CH(id), S.q.k)!==want && !d.includes(id)) d.push(id); });
      commit(); return;
    }
    case 'endTurn': {
      if(S.phase!=='play' || S.cur!==pid || S.stage!=='flip') return;
      S.cur=opp; S.stage='ask'; S.q=null; commit(); return;
    }
    case 'guess': {
      if(S.phase!=='play' || S.cur!==pid || (S.stage!=='ask' && S.stage!=='flip')) return 'Arriesgás en tu turno.';
      if(!S.board.includes(a.id)) return;
      const c=CH(a.id);
      if(S.sec[opp]===a.id){ log(`🎯 ${pname(pid)} arriesgó: ¿Es ${c.n}? ¡SÍ!`); roundOver(pid, `adivinó que era ${c.n}.`); }
      else if(S.opts.wrong==='pierde'){ log(`🎯 ${pname(pid)} arriesgó: ¿Es ${c.n}? ¡NO!`); roundOver(opp, `${P(pid).name} arriesgó ${c.n} y no era.`); }
      else {
        log(`🎯 ${pname(pid)} arriesgó: ¿Es ${c.n}? ¡NO! Pierde el turno.`);
        if(!S.down[pid].includes(a.id)) S.down[pid].push(a.id);
        S.cur=opp; S.stage='ask'; S.q=null;
      }
      commit(); return;
    }
  }
}
const ANS={si:'✅ Sí', no:'❌ No', nose:'🤷 No sé'};
function removePlayer(t, msg){
  if(S.phase==='lobby' || S.phase==='over'){ S.players=S.players.filter(x=>x!==t); }
  else { t.bot=true; t.conn=false; t.token=null; }
  if(NET.mode==='host' && NET.conns[t.id]){ try{ NET.conns[t.id].send({t:'kicked'}); }catch(e){} }
  sysChat(msg);
}

/* ====================== BOTS ====================== */
const BOT={busy:false};
const BOT_TALK={
  good:['Mmm, interesante 🤔','Ajá… ya te voy encontrando 🕵️','Esto se pone bueno 🧉'],
  win:['¡Te encontré! 😎','Fácil, fácil 🏆','¿Otra ronda? 😏'],
  lose:['Uff, me ganaste 😅','Era re difícil ese','La próxima te gano 😤'],
};
const pick = a => a[rnd(a.length)];
const autoPlays = p => p && (p.bot || (!p.conn && p.offAt && Date.now()-p.offAt>20000));
// la pregunta que mejor parte en dos lo que le queda
function bestQuestion(st, pid, lv){
  const left=leftFor(st, pid).map(CH).filter(Boolean);
  const asked=new Set(st.qs.filter(q=>q.by===pid && q.k).map(q=>q.k));
  const opts=PREGUNTAS.filter(q=>!asked.has(q.k)).map(q=>{ const y=left.filter(c=>respuesta(c,q.k)).length; return {k:q.k, s:Math.min(y, left.length-y)}; }).filter(x=>x.s>0);
  if(!opts.length) return null;
  opts.sort((a,b)=>b.s-a.s);
  const top = lv==='crack' ? 1 : lv==='normal' ? 3 : 8;
  return opts[rnd(Math.min(top, opts.length))].k;
}
// palabras que entiende el bot cuando le escriben una pregunta
const BOT_WORDS=[[/mujer|chica|señora|nena/,'muj'],[/anteojo|lente/,'ant'],[/barba/,'bar'],[/bigote/,'big'],[/pelad|calv/,'pel'],[/canos|blanco el pelo|pelo blanco|gris/,'can'],[/rubi/,'rub'],[/largo/,'lar'],[/gorr|sombrer/,'gor'],[/sonr|diente/,'son'],[/corbata/,'cor'],[/uniform/,'uni'],[/camiseta/,'cam'],[/guitarra/,'gui'],[/blanco y negro|sepia/,'byn'],[/presidente|gobern/,'gob'],[/militar|general|mariscal/,'mil'],[/selecci|albirroja/,'sel'],[/arquer/,'arq'],[/music|cant|músic/,'mus'],[/actor|actriz|cine|tele/,'cin'],[/escrit/,'esc'],[/extranjer|fuera del paraguay|otro país/,'ext'],[/vivo|viva/,'vivo'],[/futbol|fútbol/,'cat_fut'],[/histori/,'cat_his'],[/politic|polític/,'cat_pol'],[/faránd|farand|artista/,'cat_far'],[/influencer|tiktok|youtub/,'cat_inf']];
function botAnswer(text, secId){
  const t=String(text||'').toLowerCase(), m=BOT_WORDS.find(([re])=>re.test(t));
  if(!m) return 'nose';
  return respuesta(CH(secId), m[1]) ? 'si' : 'no';
}
function botTick(){
  if(!S || NET.mode==='client' || BOT.busy) return;
  if(S.phase==='pick'){
    const b=S.players.find(p=>autoPlays(p) && !S.sec[p.id]);
    if(b){ BOT.busy=true; setTimeout(()=>{ BOT.busy=false; if(S && S.phase==='pick' && !S.sec[b.id]) act(b.id, {type:'pick', id:S.board[rnd(S.board.length)]}); }, 900); }
    return;
  }
  if(S.phase!=='play') return;
  // ¿le preguntaron algo a un bot?
  if(S.stage==='answer' && S.q && autoPlays(P(S.q.to))){
    const b=P(S.q.to); BOT.busy=true;
    setTimeout(()=>{ BOT.busy=false; if(!S || S.stage!=='answer' || S.q.to!==b.id) return;
      const ans=botAnswer(S.q.text, S.sec[b.id]); act(b.id, {type:'answer', a:ans});
      if(ans==='nose' && b.bot) botChat(b, 'No te entendí 🤷 Probá con las preguntas de la lista.'); }, 1500+rnd(1200));
    return;
  }
  const b=P(S.cur); if(!autoPlays(b)) return;
  BOT.busy=true;
  const lv=S.opts.bot;
  setTimeout(()=>{
    BOT.busy=false;
    if(!S || S.phase!=='play' || S.cur!==b.id) return;
    const left=leftFor(S, b.id);
    if(S.stage==='ask'){
      const k=bestQuestion(S, b.id, lv);
      const risky = lv==='facil' ? left.length<=3 : left.length<=2;
      if(left.length<=1 || !k || (risky && rnd(2)===0)){
        const g=left.length ? left[rnd(left.length)] : S.board[rnd(S.board.length)];
        const won=S.sec[other(S,b.id)]===g;
        act(b.id, {type:'guess', id:g});
        if(b.bot && rnd(2)===0) setTimeout(()=>botChat(b, pick(won?BOT_TALK.win:BOT_TALK.lose)), 900);
      } else act(b.id, {type:'ask', k});
    } else if(S.stage==='flip'){
      // el bot fácil a veces se olvida de bajar alguna
      if(S.q && S.q.k){ const want=S.q.ans==='si', d=S.down[b.id];
        S.board.forEach(id=>{ if(respuesta(CH(id), S.q.k)!==want && !d.includes(id) && !(lv==='facil' && rnd(4)===0)) d.push(id); }); }
      if(b.bot && rnd(5)===0) botChat(b, pick(BOT_TALK.good));
      act(b.id, {type:'endTurn'});
    }
  }, 1300+rnd(1300));
}
setInterval(botTick, 500);
function botPrivate(bot, from){
  setTimeout(()=>{ if(!S) return; addChat(bot.id, pick(['Shhh, no te voy a decir quién es 🤫','Jaja, preguntá en tu turno 😏','¿Me querés sacar información? 😂']), from.id); }, 1200+rnd(1500));
}
