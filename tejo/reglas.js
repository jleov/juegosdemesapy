'use strict';
/* =====================================================================
   Tejo PY — tejo de mesa (hockey de aire): cada uno con su mazo intenta
   meter el tejo en el arco del otro. Juego en tiempo real: el anfitrión
   mueve la física y manda fotos de la mesa 30 veces por segundo.
   Acá: medidas, física, modos (duelo, parejas, rey de la mesa) y bots.
   ===================================================================== */
function rnd(n){ if(window.crypto && crypto.getRandomValues){ const a=new Uint32Array(1); crypto.getRandomValues(a); return a[0]%n; } return Math.floor(Math.random()*n); }

/* ====================== MESA (en cm) ======================
   x de -50 a 50 (ancho), y de -100 a 100 (largo). El lado 0 defiende el arco de y=-100 y el lado 1 el de y=+100. */
const W2=50, L2=100, PR=3.2;
const mr = o => o.mazo ? 7 : 5;                                   // radio del mazo
const goalHalf = o => ({angosto:12, normal:15, ancho:19})[o.goal]||15;
const SPEEDS={normal:{t:'🙂 Normal', fr:.16, max:520}, rapida:{t:'⚡ Rápida', fr:.07, max:700}, turbo:{t:'🔥 Turbo', fr:.03, max:900}};
const MALLET_V=1100;                                               // lo más rápido que se mueve un mazo (cm/s)
const SUB=1/240;                                                   // paso de la física

/* ====================== OPCIONES ====================== */
const FORMATS={
  duelo:  {t:'🥊 Duelo (1 contra 1)', d:'Dos jugadores, uno en cada punta de la mesa.'},
  parejas:{t:'👥 Parejas (2 contra 2)', d:'Dos por lado, cada uno con su mazo en su mitad de la mesa.'},
  rey:    {t:'👑 Rey de la mesa', d:'Juegan de a dos: el que gana se queda y el que pierde va a la fila. Gana la partida el primero que junta las coronas.'},
};
const GOALS=[{v:3,t:'3 goles'},{v:5,t:'5 goles'},{v:7,t:'7 goles (lo de siempre)'},{v:10,t:'10 goles'},{v:15,t:'15 goles'}];
const TIMES=[{v:0,t:'Sin límite de tiempo'},{v:120,t:'2 minutos'},{v:180,t:'3 minutos'},{v:300,t:'5 minutos'}];
const PUCKS=[{v:1,t:'1 tejo'},{v:2,t:'2 tejos a la vez'},{v:3,t:'3 tejos a la vez (un lío)'}];
const GOALW=[{v:'angosto',t:'🥅 Angosto (más difícil)'},{v:'normal',t:'🥅 Normal'},{v:'ancho',t:'🥅 Ancho (más goles)'}];
const CROWNS=[{v:2,t:'2 coronas'},{v:3,t:'3 coronas'},{v:5,t:'5 coronas'}];
const BOTLV=[{v:'facil',t:'🙂 Fácil'},{v:'normal',t:'😎 Normal'},{v:'crack',t:'🔥 Crack'}];
const HOUSE=[
  {k:'muerte', t:'⚡ Muerte súbita', d:'Si se termina el tiempo empatados, el próximo gol gana.', def:true},
  {k:'rebote2', t:'🎱 Gol de banda vale 2', d:'Si el tejo pega en una banda después del último golpe y entra, vale doble.', def:false},
  {k:'mazo', t:'🧒 Mazos grandes', d:'Mazos más grandes, para los chicos o para empezar.', def:false},
  {k:'saque', t:'🤝 Saca el que recibe el gol', d:'Después de cada gol el tejo aparece del lado del que lo recibió (si no, aparece en el medio).', def:true},
];
function defaultOpts(){ const o={fmt:'duelo', goals:7, time:0, pucks:1, speed:'normal', goal:'normal', crowns:3, bot:'normal'}; HOUSE.forEach(h=>o[h.k]=h.def); return o; }

let S=null;
const EMOJIS=['🏒','🧉','🥯','🐆','🌸','🎻','⚽','🐂','🌽','🦜','🐊','🦩','🍖','🌵','🎸','🐎','🦋','🌞','🍉','🦉'];
const PCOLORS=['#e63946','#1d70d6','#2a9d3f','#e9a100','#8e44ad','#ff7f11','#13a8a8','#c2185b'];
const TEAMS=[{n:'Rojo', e:'🔴', c:'#d52b1e'}, {n:'Azul', e:'🔵', c:'#0038a8'}];
const BOT_NAMES=[['Don Mazo','🏒'],['Ña Rápida','🌸'],['Karai Tejo','🧉'],['Chulo Gol','😎'],['Ña Banda','🦋'],['Don Arquero','🐆'],['Pombero','👹'],['Kuñataĩ Turbo','🦜']];
const MAXP=8;
const P = id => S && S.players.find(p=>p.id===id);
const OB = id => S && (S.observers||[]).find(o=>o.id===id);

function lobbyState(){
  return {v:1, phase:'lobby', seq:0, players:[], observers:[], hostPid:null, opts:defaultOpts(), grules:'', sugs:[], log:[],
    sides:[], mallets:[], score:[0,0], goAt:0, endsAt:0, sudden:false, queue:[], crowns:{}, matchN:0, win:null, matchWin:null, pauseAt:0};
}
function addPlayer(name, emoji, token, peerId, bot, local){
  const used=S.players.map(p=>p.color), t0=S.players.filter(p=>p.team===0).length, t1=S.players.filter(p=>p.team===1).length;
  const p={id:'p'+(++S.seq), name:(String(name||'').trim()||'Jugador').slice(0,16), emoji, token, peerId,
    color:PCOLORS.find(c=>!used.includes(c))||PCOLORS[S.players.length%PCOLORS.length],
    conn:!bot, bot:!!bot, local:!!local, mic:false, team: t0<=t1 ? 0 : 1};
  S.players.push(p); return p;
}
function addBot(){
  if(S.players.length>=MAXP) return 'Ya son 8 jugadores (el máximo).';
  const free=BOT_NAMES.filter(([n])=>!S.players.some(p=>p.name===n));
  const [n,e]=free.length?free[rnd(free.length)]:['Bot '+(S.players.length+1),'🤖'];
  const b=addPlayer(n, e, null, null, true);
  sysChat(`🤖 ${b.name} se acercó a la mesa.`);
}
function log(x){ S.log.push({x, at:Date.now()}); if(S.log.length>200) S.log.splice(0, S.log.length-200); }
function sideName(st, i){
  const s=st.sides[i]; if(!s) return '?';
  if(st.opts.fmt==='parejas') return TEAMS[i].e+' '+s.pids.map(id=>{ const p=st.players.find(x=>x.id===id); return p?p.name:'?'; }).join(' y ');
  const p=st.players.find(x=>x.id===s.pids[0]); return p ? p.name : '?';
}
const sideOf = (st, pid) => st.sides.findIndex(s=>s.pids.includes(pid));
const playing = (st, pid) => sideOf(st, pid)>=0;

/* ---------- partido ---------- */
function startGame(){
  S.crowns={}; S.matchN=0; S.win=null; S.startedAt=Date.now();
  if(S.opts.fmt==='rey'){ S.queue=S.players.map(p=>p.id); }
  log(`🏒 Empieza el tejo: ${FORMATS[S.opts.fmt].t}.`);
  startMatch();
}
function startMatch(){
  const o=S.opts;
  if(o.fmt==='duelo') S.sides=[{pids:[S.players[0].id]}, {pids:[S.players[1].id]}];
  else if(o.fmt==='parejas') S.sides=[0,1].map(t=>({pids:S.players.filter(p=>p.team===t).map(p=>p.id)}));
  else S.sides=[{pids:[S.queue[0]]}, {pids:[S.queue[1]]}];
  S.mallets=[]; S.sides.forEach((s,si)=>s.pids.forEach(pid=>S.mallets.push({pid, side:si})));
  S.score=[0,0]; S.sudden=false; S.matchN++; S.matchWin=null; S.phase='play';
  S.goAt=Date.now()+3200; S.endsAt = o.time ? S.goAt+o.time*1000 : 0;
  resetTable(null);
  log(`🏒 Partido ${S.matchN}: ${sideName(S,0)} contra ${sideName(S,1)}.`);
}
// la física en vivo (solo en el anfitrión, no viaja en el estado)
let RT=null;
function resetTable(){
  const o=S.opts, n=o.pucks;
  RT={pucks:[], ms:S.mallets.map((m,i)=>{ const same=S.mallets.filter(x=>x.side===m.side), k=same.indexOf(m), x=same.length>1 ? (k?22:-22) : 0, y=m.side ? 80 : -80; return {x, y, vx:0, vy:0, tx:x, ty:y}; }), ev:[], last:performance.now(), acc:0};
  for(let i=0;i<n;i++) RT.pucks.push({x:n>1?(i-(n-1)/2)*24:0, y:0, vx:0, vy:0, on:true, resp:0, wall:false, hit:-1, still:0});
}
function respawn(p, conceded){
  const o=S.opts; p.on=true; p.vx=p.vy=0; p.wall=false; p.hit=-1;
  p.x=(Math.random()-.5)*20; p.y = o.saque && conceded!=null ? (conceded ? 45 : -45) : 0;
}
// avanza la física dt segundos
function stepWorld(dt){
  const o=S.opts, R=mr(o), gh=goalHalf(o), sp=SPEEDS[o.speed]||SPEEDS.normal, now=Date.now();
  if(now<S.goAt || S.phase!=='play' || S.matchWin) { RT.ms.forEach((m,i)=>moveMallet(m, S.mallets[i].side, R, dt)); return; }
  RT.ms.forEach((m,i)=>moveMallet(m, S.mallets[i].side, R, dt));
  // mazos del mismo lado no se pisan
  for(let i=0;i<RT.ms.length;i++) for(let j=i+1;j<RT.ms.length;j++){ const a=RT.ms[i], b=RT.ms[j]; if(S.mallets[i].side!==S.mallets[j].side) continue;
    const dx=b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy)||.01; if(d<2*R){ const k=(2*R-d)/2/d; a.x-=dx*k; a.y-=dy*k; b.x+=dx*k; b.y+=dy*k; } }
  for(const p of RT.pucks){
    if(!p.on){ if(now>=p.resp){ respawn(p, p.conc); } continue; }
    const k=Math.max(0, 1-sp.fr*dt); p.vx*=k; p.vy*=k;
    p.x+=p.vx*dt; p.y+=p.vy*dt;
    // bandas de los costados
    if(p.x<-W2+PR){ p.x=-W2+PR; p.vx=Math.abs(p.vx)*.9; wallHit(p); }
    if(p.x>W2-PR){ p.x=W2-PR; p.vx=-Math.abs(p.vx)*.9; wallHit(p); }
    // cabeceras con el arco
    for(const s of [-1,1]){
      const inGoal=Math.abs(p.x)<gh-PR*.3;
      if(s*p.y>L2-PR && !inGoal && s*p.y<L2+PR){ p.y=s*(L2-PR); p.vy=-s*Math.abs(p.vy)*.9; wallHit(p); }
      if(s*p.y>L2-PR && inGoal){
        if(Math.abs(p.x)>gh-PR){ p.x=Math.sign(p.x)*(gh-PR); p.vx*=-.5; }
        if(s*p.y>L2+PR*1.6){ goal(p, s>0 ? 0 : 1); break; }   // en el arco de arriba (y>0) mete el lado 0
      }
    }
    if(!p.on) continue;
    // contra los mazos
    RT.ms.forEach((m,i)=>{
      const dx=p.x-m.x, dy=p.y-m.y, d=Math.hypot(dx,dy), rr=PR+R; if(d>=rr || d<1e-6) return;
      const nx=dx/d, ny=dy/d; p.x=m.x+nx*rr; p.y=m.y+ny*rr;
      const rvx=p.vx-m.vx, rvy=p.vy-m.vy, vn=rvx*nx+rvy*ny;
      if(vn<0){ p.vx-=1.9*vn*nx; p.vy-=1.9*vn*ny; RT.ev.push(['h', Math.min(1,-vn/600)]); }
      p.hit=S.mallets[i].side; p.wall=false;
      // si el mazo lo apretó contra la banda, el tejo vuelve adentro y se escapa por el costado
      const cx=Math.max(-W2+PR, Math.min(W2-PR, p.x)), inG=Math.abs(p.x)<gh-PR*.3, cy = inG ? p.y : Math.max(-L2+PR, Math.min(L2-PR, p.y));
      if(cx!==p.x){ p.x=cx; p.vx=-Math.sign(p.x)*40; p.vy=-(Math.sign(p.y)||1)*220; }
      if(cy!==p.y){ p.y=cy; p.vy=-Math.sign(p.y)*40; p.vx=-(Math.sign(p.x)||1)*220; }
      // el tejo no puede atravesar la banda: el que se corre es el mazo
      const ex=m.x-p.x, ey=m.y-p.y, ed=Math.hypot(ex,ey);
      if(ed<rr){ const ux=ed>.01?ex/ed:-Math.sign(p.x)||1, uy=ed>.01?ey/ed:-Math.sign(p.y)||1; m.x=p.x+ux*rr; m.y=p.y+uy*rr; }
    });
    // tejos entre sí
    for(const q of RT.pucks){ if(q===p || !q.on) continue; const dx=q.x-p.x, dy=q.y-p.y, d=Math.hypot(dx,dy); if(d>=2*PR || d<1e-6) continue;
      const nx=dx/d, ny=dy/d, ov=(2*PR-d)/2; p.x-=nx*ov; p.y-=ny*ov; q.x+=nx*ov; q.y+=ny*ov;
      const rel=(p.vx-q.vx)*nx+(p.vy-q.vy)*ny; if(rel>0){ p.vx-=rel*nx; p.vy-=rel*ny; q.vx+=rel*nx; q.vy+=rel*ny; RT.ev.push(['p', Math.min(1,rel/500)]); } }
    const s=Math.hypot(p.vx,p.vy); if(s>sp.max){ p.vx*=sp.max/s; p.vy*=sp.max/s; }
    // si queda quieto justo en el medio, se empuja un poquito para un lado
    // si queda quieto (o trabado) un rato, se empuja suave hacia el medio
    if(s<6){ p.still+=dt; const lim=Math.abs(p.y)<PR+R ? 2.5 : 5; if(p.still>lim){ p.vx=-p.x*1.5; p.vy=Math.abs(p.y)<PR+R ? (Math.random()<.5?-1:1)*40 : -p.y*1.2; p.still=0; } } else p.still=0;
  }
}
function wallHit(p){ p.wall=true; RT.ev.push(['w', Math.min(1, Math.hypot(p.vx,p.vy)/600)]); }
// mueve el mazo hacia donde apunta el jugador (con tope de velocidad y sin pasar la mitad)
function moveMallet(m, side, R, dt){
  const tx=Math.max(-W2+R, Math.min(W2-R, m.tx)), ty = side ? Math.max(R, Math.min(L2-R, m.ty)) : Math.max(-L2+R, Math.min(-R, m.ty));
  const dx=tx-m.x, dy=ty-m.y, d=Math.hypot(dx,dy), mv=(m.vmax||MALLET_V)*dt;
  const k = d>mv ? mv/d : 1, ox=m.x, oy=m.y;
  m.x+=dx*k; m.y+=dy*k; m.vx=(m.x-ox)/dt; m.vy=(m.y-oy)/dt;
}
function goal(p, side){
  const o=S.opts, pts = o.rebote2 && p.wall && p.hit===side ? 2 : 1, own = p.hit===1-side;
  p.on=false; p.resp=Date.now()+1300; p.conc=1-side;
  S.score[side]+=pts; RT.ev.push(['g', side, pts]);
  log(`🥅 ¡Gol${pts>1?' de banda (vale 2)':''}${own?' en contra':''}! ${sideName(S,side)} ${S.score[side]} - ${S.score[1-side]}.`);
  if(S.score[side]>=o.goals || S.sudden) endMatch(side);
  commit();
}
function endMatch(win){
  const o=S.opts; S.matchWin={side:win, at:Date.now(), score:S.score.slice()};
  log(`🏆 ${sideName(S,win)} gana el partido ${S.score[win]} a ${S.score[1-win]}.`);
  if(o.fmt==='rey'){
    const w=S.sides[win].pids[0], l=S.sides[1-win].pids[0];
    S.crowns[w]=(S.crowns[w]||0)+1;
    S.queue=S.queue.filter(x=>x!==w && x!==l); S.queue.unshift(w); S.queue.push(l);
    if(S.crowns[w]>=o.crowns){ S.win={pid:w, at:Date.now()}; S.phase='over'; log(`👑 ${P(w)?P(w).name:'?'} es el Rey de la mesa con ${S.crowns[w]} coronas.`); }
    else S.phase='matchEnd';
  } else { S.win={side:win, at:Date.now()}; S.phase='over'; }
}
// el tiempo
function timeCheck(){
  if(S.phase!=='play' || !S.endsAt || S.matchWin || S.sudden || Date.now()<S.endsAt) return;
  if(S.score[0]!==S.score[1]){ endMatch(S.score[0]>S.score[1]?0:1); commit(); return; }
  if(S.opts.muerte || S.opts.fmt==='rey'){ S.sudden=true; log('⚡ ¡Empatados! Muerte súbita: el próximo gol gana.'); commit(); return; }
  S.matchWin={side:-1, at:Date.now(), score:S.score.slice()}; S.win={side:-1, at:Date.now()}; S.phase='over'; log(`🤝 Empate ${S.score[0]} a ${S.score[1]}.`); commit();
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
    case 'joinNext': {
      const o=OB(pid); if(!o) return;
      if(S.phase!=='lobby' && S.phase!=='over') return 'Esperá a que termine la partida para sumarte.';
      if(S.players.length>=MAXP) return 'La mesa está llena.';
      if(o.owner) return;
      S.observers=S.observers.filter(x=>x!==o);
      const np=addPlayer(o.name, o.emoji==='👀'?EMOJIS.find(e=>!S.players.some(q=>q.emoji===e)):o.emoji, o.token, o.peerId);
      np.conn=o.conn;
      if(typeof onSeatChange==='function') onSeatChange(pid, np.id);
      sysChat(`🪑 ${np.name} se sumó a jugar.`); commit(); return;
    }
  }
  if(!p) return;
  const host = pid===S.hostPid || NET.mode==='local';
  switch(a.type){
    case 'addBot': if(!host||S.phase!=='lobby') return; { const r=addBot(); if(r) return r; } commit(); return;
    case 'addLocal': {
      if(NET.mode!=='local' || S.phase!=='lobby') return;
      if(S.players.some(x=>x.local)) return 'Ya hay un amigo en este aparato.';
      const nm=String(a.name||'').trim().slice(0,16); if(!nm) return;
      const np=addPlayer(nm, EMOJIS.find(e=>!S.players.some(q=>q.emoji===e))||'🏒', null, null, false, true); np.conn=true;
      sysChat(`🙋 ${np.name} juega en este aparato.`); commit(); return;
    }
    case 'team': {
      if(S.phase!=='lobby') return;
      const t=P(a.pid); if(!t || (!host && t.id!==pid)) return;
      t.team = t.team ? 0 : 1; commit(); return;
    }
    case 'order': {   // cambiar el orden (quién juega en el duelo / la fila del rey)
      if(!host || S.phase!=='lobby') return; const i=S.players.findIndex(x=>x.id===a.pid); if(i<=0) return;
      [S.players[i-1], S.players[i]]=[S.players[i], S.players[i-1]]; commit(); return;
    }
    case 'kick': {
      if(!host) return; const t=P(a.pid); if(!t || t.id===S.hostPid) return;
      removePlayer(t, `🚪 ${t.name} se fue de la mesa.`); commit(); return;
    }
    case 'botify': {
      if(!host) return; const t=P(a.pid); if(!t || t.bot) return;
      t.bot=true; t.conn=false; t.mic=false; t.token=null; sysChat(`🤖 Un bot sigue jugando por ${t.name}.`); commit(); return;
    }
    case 'opt': {
      if(!host || S.phase!=='lobby') return;
      const o=S.opts, v=a.v;
      if(a.k==='fmt' && FORMATS[v]) o.fmt=v;
      else if(a.k==='goals' && GOALS.some(x=>x.v==v)) o.goals=+v;
      else if(a.k==='time' && TIMES.some(x=>x.v==v)) o.time=+v;
      else if(a.k==='pucks' && PUCKS.some(x=>x.v==v)) o.pucks=+v;
      else if(a.k==='speed' && SPEEDS[v]) o.speed=v;
      else if(a.k==='goal' && GOALW.some(x=>x.v===v)) o.goal=v;
      else if(a.k==='crowns' && CROWNS.some(x=>x.v==v)) o.crowns=+v;
      else if(a.k==='bot' && BOTLV.some(x=>x.v===v)) o.bot=v;
      else if(HOUSE.some(h=>h.k===a.k)) o[a.k]=!!v;
      commit(); return;
    }
    case 'grules': if(!host) return; S.grules=String(a.text||'').slice(0,1200); commit(); return;
    case 'sugDel': if(!host) return; S.sugs=S.sugs.filter(s=>s.id!==a.id); commit(); return;
    case 'start': {
      if(!host || S.phase!=='lobby') return;
      const r=canStart(); if(r) return r;
      startGame(); sysChat('🏒 ¡A jugar! Agarren los mazos.'); commit(); return;
    }
    case 'next': if(!host || S.phase!=='matchEnd') return; startMatch(); commit(); return;
    case 'rematch': if(!host || S.phase!=='over') return; startGame(); sysChat('🔁 ¡Revancha!'); commit(); return;
    case 'newGame': if(!host || (S.phase!=='over' && !a.force)) return;
      S.phase='lobby'; S.log=[]; S.sides=[]; S.mallets=[]; S.win=null; S.matchWin=null; RT=null; commit(); return;
    case 'leave': {
      if(S.phase==='lobby' || S.phase==='over') removePlayer(p, `🚪 ${p.name} se fue.`);
      else { p.bot=true; p.conn=false; p.mic=false; p.token=null; sysChat(`🚪 ${p.name} se fue: un bot 🤖 juega por él.`); }
      commit(); return;
    }
  }
}
function canStart(){
  const o=S.opts, n=S.players.length;
  if(o.fmt==='duelo' && n!==2) return n<2 ? 'Para el duelo hacen falta 2 (sumá un bot 🤖).' : 'El duelo es de a 2. Para más, elegí Parejas o Rey de la mesa.';
  if(o.fmt==='parejas'){ const a=S.players.filter(p=>p.team===0).length, b=S.players.filter(p=>p.team===1).length;
    if(n!==4 || a!==2 || b!==2) return 'Para parejas hacen falta 4: dos 🔴 y dos 🔵 (tocá el color al lado de cada nombre).'; }
  if(o.fmt==='rey' && n<3) return 'Para el Rey de la mesa hacen falta al menos 3 (sumá bots 🤖).';
  return null;
}
function removePlayer(t, msg){
  if(S.phase==='lobby' || S.phase==='over'){ S.players=S.players.filter(x=>x!==t); S.queue=(S.queue||[]).filter(x=>x!==t.id); }
  else { t.bot=true; t.conn=false; t.token=null; }
  if(NET.mode==='host' && NET.conns[t.id]){ try{ NET.conns[t.id].send({t:'kicked'}); }catch(e){} }
  sysChat(msg);
}

/* ====================== BOTS ====================== */
const BOTSP={facil:{v:430, err:16, lag:.12}, normal:{v:720, err:8, lag:.22}, crack:{v:1050, err:3, lag:.45}};
const autoPlays = p => p && (p.bot || (!p.conn && p.offAt && Date.now()-p.offAt>5000));
function botMove(i){
  const m=RT.ms[i], side=S.mallets[i].side, lv=BOTSP[S.opts.bot]||BOTSP.normal, R=mr(S.opts), dir=side ? -1 : 1, gy=side ? L2 : -L2;
  m.vmax=lv.v;
  const mates=S.mallets.map((x,j)=>j).filter(j=>S.mallets[j].side===side), defender = mates.length>1 && mates.indexOf(i)===1;
  // el tejo más peligroso: el que está más cerca de mi arco
  const ps=RT.pucks.filter(p=>p.on); if(!ps.length){ m.tx=0; m.ty=gy+dir*25; return; }
  const p=ps.sort((a,b)=>Math.abs(a.y-gy)-Math.abs(b.y-gy))[0];
  const mine = side ? p.y>0 : p.y<0, coming = dir*p.vy<0;
  m.err = m.err==null || Math.random()<.02 ? (Math.random()-.5)*lv.err : m.err;
  let tx, ty;
  if(mine && !defender && (!coming || Math.hypot(p.vx,p.vy)<120)){
    // atacar: ponerse detrás del tejo mirando al arco de enfrente y pasarle por encima
    const ax=(m.aim==null || Math.random()<.01) ? (m.aim=(Math.random()-.5)*20) : m.aim, ay=-gy;
    let ux=ax-p.x, uy=ay-p.y; const l=Math.hypot(ux,uy)||1; ux/=l; uy/=l;
    const behind=(p.x-m.x)*ux+(p.y-m.y)*uy;
    const bx=p.x-ux*(R+PR+7), by=p.y-uy*(R+PR+7), reach=Math.abs(bx)<W2-R && Math.abs(by)<L2-R;
    if(!reach){ tx=p.x*.4; ty=p.y+(side?-1:1)*35; }   // no puede ponerse detrás (esquina o banda): se corre y deja salir el tejo
    else if(behind>R*.5){ tx=p.x+ux*12; ty=p.y+uy*12; }
    else {
      // está del lado equivocado: lo rodea por el costado para no empujarlo a su propio arco
      const qx=-uy, qy=ux, sg=((m.x-p.x)*qx+(m.y-p.y)*qy)>=0 ? 1 : -1, side2=Math.abs((m.x-p.x)*qx+(m.y-p.y)*qy);
      if(side2<R+PR+3){ tx=p.x+qx*sg*(R+PR+9); ty=p.y+qy*sg*(R+PR+9); if(Math.abs(tx)>W2-R){ tx=p.x-qx*sg*(R+PR+9); ty=p.y-qy*sg*(R+PR+9); } }
      else { tx=bx+m.err; ty=by; }
    }
  } else {
    // defender: entre el tejo y el arco, adivinando por dónde viene
    const ly=gy+dir*(defender?10:13); let px=p.x;
    if(coming && Math.abs(p.vy)>20){ const t=(ly-p.y)/p.vy; if(t>0 && t<2){ px=p.x+p.vx*t; while(Math.abs(px)>W2){ px = px>0 ? 2*W2-px : -2*W2-px; } } }
    const gh=goalHalf(S.opts); tx=Math.max(-gh-3, Math.min(gh+3, px))+m.err*.5; ty=ly;
  }
  m.tx += (tx-m.tx)*Math.min(1, lv.lag*2.2); m.ty += (ty-m.ty)*Math.min(1, lv.lag*2.2);
}
