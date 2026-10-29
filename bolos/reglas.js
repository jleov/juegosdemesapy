'use strict';
/* =====================================================================
   Bolos PY — la pista, la física de la bola y los pinos, los modos de
   juego (Clásico, 3-6-9, 9 sin tope, Eliminación y Desafío de spares),
   las formas de contar los puntos y los bots.
   Todo lo decide el anfitrión: simula el tiro y manda a todos el recorrido.
   ===================================================================== */

/* ====================== PISTA (medidas en cm, pista reglamentaria) ====================== */
const LW=105.4, GW=23.5, BR=10.9, PR=6.05;   // ancho de la pista, canaleta, radio de la bola, del pino parado y del pino caído
const HEAD=1829, ROW=26.4, SP=15.24, C=LW/2;           // del pino 1 a la línea de falta, distancia entre filas y medio espacio entre pinos
const PIT=HEAD+3*ROW+70;                               // fondo: donde caen bola y pinos
const DECK0=HEAD-60;                                   // empieza la zona de los pinos (con las paredes de los costados)
const APP=150;                                         // zona de aproximación detrás de la línea
const BOARD=LW/39;
const PIN_SPOTS=[[C,HEAD],[C-SP,HEAD+ROW],[C+SP,HEAD+ROW],[C-2*SP,HEAD+2*ROW],[C,HEAD+2*ROW],[C+2*SP,HEAD+2*ROW],
  [C-3*SP,HEAD+3*ROW],[C-SP,HEAD+3*ROW],[C+SP,HEAD+3*ROW],[C+3*SP,HEAD+3*ROW]];
const fullRack = () => PIN_SPOTS.map(([x,y])=>({x, y, up:true}));
const leaveRack = nums => PIN_SPOTS.map(([x,y],i)=>({x, y, up:nums.includes(i+1)}));
const OILS={seca:{t:'🏜️ Seca (engancha temprano y mucho)', len:850, k:1.3}, normal:{t:'🛢️ Normal', len:1200, k:1}, aceitosa:{t:'💧 Mucho aceite (engancha tarde y poco)', len:1480, k:.75}};
const powerToSpeed = p => 380 + 640*p;   // fuerza 0..1 → cm/s (de 3,8 a 10 m/s)
const HOOK=150;                          // cuánto engancha con efecto completo (cm/s²)
const MAXANG=.09;                        // ángulo máximo del tiro (rad)
function rnd(n){ if(window.crypto && crypto.getRandomValues){ const a=new Uint32Array(1); crypto.getRandomValues(a); return a[0]%n; } return Math.floor(Math.random()*n); }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=rnd(i+1); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function mulberry(a){ return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

/* ====================== FÍSICA ====================== */
const DT=1/600, SAMPLE=20;               // 600 pasos por segundo, una foto cada 20 (30 por segundo)
const MB=6.8, MP=1.55;
const PHY={fallv:26, prf:8.6, fdec:230, jit:.14, epp:.55, ebp:.7, kick:.5, gout:0, c0:.65, r0:30, r1:60, wob:.25, qd:6, drift:3};   // golpe para que caiga un pino (cm/s), radio y freno del pino caído, desvío al azar y rebotes
// un paso de la bola por la pista (se usa en el tiro y en la línea de ayuda)
function stepBall(b, env, dt){
  if(b.out) return;
  if(b.gut){   // en la canaleta: va derecho al fondo
    const gx = b.gut<0 ? -GW/2 : LW+GW/2; b.x += (gx-b.x)*Math.min(1, dt*12); b.vx=0;
    b.vy = Math.max(0, b.vy - 40*dt); b.y += b.vy*dt;
  } else {
    const oil=OILS[env.oil]||OILS.normal, h = b.y<oil.len ? .06 : Math.min(1, .06+(b.y-oil.len)/160);
    const hk = b.hit ? .45 : 1;
    b.vx += (b.spin*HOOK*oil.k*h*hk + (env.drift||0))*dt;
    b.vy = Math.max(0, b.vy - (b.y<oil.len ? 22 : 55)*dt);
    b.x += b.vx*dt; b.y += b.vy*dt;
    if(env.bumpers && b.y<DECK0){
      if(b.x<BR*.45){ b.x=BR*.45; b.vx=Math.abs(b.vx)*.45; b.spin*=.5; b.bump=(b.bump||0)+1; }
      if(b.x>LW-BR*.45){ b.x=LW-BR*.45; b.vx=-Math.abs(b.vx)*.45; b.spin*=.5; b.bump=(b.bump||0)+1; }
    } else if(b.x<0 || b.x>LW){ b.gut = b.x<0 ? -1 : 1; }
    // paredes del fondo
    if(b.y>DECK0){ if(b.x<-GW+BR){ b.x=-GW+BR; b.vx=Math.abs(b.vx)*.4; } if(b.x>LW+GW-BR){ b.x=LW+GW-BR; b.vx=-Math.abs(b.vx)*.4; } }
  }
  if(b.y>PIT+20 || (b.vy<=0 && Math.abs(b.vx)<1)) b.out=true;
}
// recorrido de la bola sola (sin pinos), para la ayuda y los bots
function ballPath(th, env, untilY, every){
  const b={x:th.x, y:0, vx:Math.sin(th.ang)*powerToSpeed(th.pow), vy:Math.cos(th.ang)*powerToSpeed(th.pow), spin:th.spin};
  const pts=[[b.x,b.y]]; let k=0;
  while(!b.out && b.y<untilY && k<600*8){ stepBall(b, env, DT); if(++k%(every||30)===0) pts.push([b.x,b.y]); }
  pts.push([b.x, Math.min(b.y, untilY)]);
  return {pts, x:b.x, gut:!!b.gut, vx:b.vx, vy:b.vy};
}
// simula un tiro. pins: [{x,y,up}] (10), th: {x,ang,pow,spin}; env: {oil,bumpers}
function simulate(pins, th, env, seed, light){
  const R=mulberry(seed||1), jit=()=>(R()-.5)*PHY.jit;
  env=Object.assign({}, env, {drift:(R()-.5)*PHY.drift});
  const v=powerToSpeed(th.pow);
  const b={x:th.x, y:0, vx:Math.sin(th.ang)*v, vy:Math.cos(th.ang)*v, spin:Math.max(-1,Math.min(1,th.spin||0))};
  const P=pins.map((p,i)=>({i, x:p.x, y:p.y, vx:0, vy:0, on:p.up, up:p.up, a:0, out:false}));
  const info={gutter:false, first:null, frames:0, bump:0};
  const bt=[], pt={}, ev=[];
  if(!light){ bt.push(Math.round(b.x*10), Math.round(b.y*10)); P.forEach(p=>{ if(p.on) pt[p.i]=[Math.round(p.x*10), Math.round(p.y*10)]; }); }
  let frame=0, quiet=0, carry=PHY.c0;
  // qué tan bien entra la bola: en el bolsillo (entre el 1 y el 3, o el 1 y el 2 si engancha al revés) y con ángulo, los pinos se llevan mejor entre sí
  const knock=(p, rel)=>{ if(!p.up) return; const pk=Math.min(1, (rel-PHY.r0)/PHY.r1)*carry; if(R()<pk) fall(p, Math.atan2(p.vx,p.vy)); else { p.vx*=PHY.wob; p.vy*=PHY.wob; } };
  const fall=(p, ang)=>{ if(!p.up) return; p.up=false; p.a=ang; if(!light) ev.push({f:frame, k:'f', i:p.i, a:+ang.toFixed(2)}); };
  for(let step=0; step<600*9; step++){
    const wasGut=b.gut; stepBall(b, env, DT);
    if(info.q==null && b.y>=HEAD-BR-PR-1){
      if(b.gut || b.out) info.q=0;
      else { const side = b.vx<-1 ? 1 : b.vx>1 ? -1 : (b.x>=C?1:-1), xh=b.x+b.vx*(HEAD-b.y)/Math.max(1,b.vy), dx=xh-(C+side*6), ang=Math.atan2(Math.abs(b.vx), b.vy)*180/Math.PI;
        info.q=Math.exp(-((dx/PHY.qd)**2))*Math.min(1, .6+ang/2.5*.4); }
      carry=PHY.c0+(1-PHY.c0)*info.q;
    }
    if(b.gut && !wasGut){ info.gutter=true; if(!light) ev.push({f:frame, k:'g'}); }
    // pinos
    let moving = !b.out;
    for(const p of P){
      if(!p.on) continue;
      const sp=Math.hypot(p.vx,p.vy); if(sp<.5){ p.vx=p.vy=0; continue; }
      moving=true;
      const dec=(p.up ? 900 : PHY.fdec)*DT, k=sp<=dec ? 0 : (sp-dec)/sp; p.vx*=k; p.vy*=k;
      p.x+=p.vx*DT; p.y+=p.vy*DT;
      if(p.up && (p.x<-1 || p.x>LW+1)) fall(p, Math.atan2(p.vx, p.vy));
      const r=p.up?PR:PHY.prf;
      if(p.y>DECK0-30){ if(p.x<-GW+r){ p.x=-GW+r; p.vx=Math.abs(p.vx)*PHY.kick; if(!light && sp>40) ev.push({f:frame, k:'w', v:Math.min(1,sp/400)}); } if(p.x>LW+GW-r){ p.x=LW+GW-r; p.vx=-Math.abs(p.vx)*PHY.kick; if(!light && sp>40) ev.push({f:frame, k:'w', v:Math.min(1,sp/400)}); } }
      if(p.y>PIT || p.y<HEAD-200 || (PHY.gout && !p.up && (p.x<-PHY.gout || p.x>LW+PHY.gout))){ p.on=false; p.out=true; if(p.up) fall(p, 0); if(!light) ev.push({f:frame, k:'o', i:p.i}); }
    }
    // bola contra pinos
    if(!b.gut && !b.out && b.y>DECK0-20){
      for(const p of P){
        if(!p.on) continue;
        const r=BR+(p.up?PR:PHY.prf), dx=p.x-b.x, dy=p.y-b.y, d2=dx*dx+dy*dy; if(d2>=r*r) continue;
        const d=Math.sqrt(d2)||.01; let nx=dx/d, ny=dy/d; const j=jit(), cs=Math.cos(j), sn=Math.sin(j); [nx,ny]=[nx*cs-ny*sn, nx*sn+ny*cs];
        const ov=r-d; b.x-=nx*ov*MP/(MB+MP); b.y-=ny*ov*MP/(MB+MP); p.x+=nx*ov*MB/(MB+MP); p.y+=ny*ov*MB/(MB+MP);
        const rel=(b.vx-p.vx)*nx+(b.vy-p.vy)*ny; if(rel<=0) continue;
        const J=(1+PHY.ebp)*rel/(1/MB+1/MP);
        b.vx-=J/MB*nx; b.vy-=J/MB*ny; p.vx+=J/MP*nx; p.vy+=J/MP*ny;
        if(info.first==null) info.first=p.i;
        b.hit=true;
        if(J/MP>PHY.fallv) fall(p, Math.atan2(p.vx, p.vy));
        if(!light) ev.push({f:frame, k:'h', v:Math.min(1,rel/700)});
      }
    }
    // pinos entre sí
    for(let a=0;a<P.length;a++){ const p=P[a]; if(!p.on) continue;
      for(let c=a+1;c<P.length;c++){ const q=P[c]; if(!q.on) continue;
        const r=(p.up?PR:PHY.prf)+(q.up?PR:PHY.prf), dx=q.x-p.x, dy=q.y-p.y, d2=dx*dx+dy*dy; if(d2>=r*r) continue;
        const d=Math.sqrt(d2)||.01; let nx=dx/d, ny=dy/d; const j=jit(), cs=Math.cos(j), sn=Math.sin(j); [nx,ny]=[nx*cs-ny*sn, nx*sn+ny*cs];
        const ov=(r-d)/2; p.x-=nx*ov; p.y-=ny*ov; q.x+=nx*ov; q.y+=ny*ov;
        const rel=(p.vx-q.vx)*nx+(p.vy-q.vy)*ny; if(rel<=0) continue;
        const J=(1+PHY.epp)/2*rel;
        p.vx-=J*nx; p.vy-=J*ny; q.vx+=J*nx; q.vy+=J*ny;
        knock(q, rel); knock(p, rel);
        if(!light && rel>25) ev.push({f:frame, k:'p', v:Math.min(1,rel/450)});
      }
    }
    if(!light && (step+1)%SAMPLE===0){
      frame++;
      bt.push(Math.round(b.x*10), Math.round(b.y*10));
      for(const i in pt){ const p=P[i]; pt[i].push(Math.round(p.x*10), Math.round(p.y*10)); }
    }
    if(!moving){ if(++quiet>30) break; } else quiet=0;
  }
  info.frames=frame; info.bump=b.bump||0;
  const out=P.map(p=>({x:+p.x.toFixed(1), y:+p.y.toFixed(1), up:p.on && p.up}));
  const knocked=P.filter((p,i)=>pins[i].up && !(p.on && p.up)).map(p=>p.i);
  return {pins:out, knocked, info, bt, pt, ev};
}

/* ====================== MODOS Y REGLAS ====================== */
const MODES={
  clasico:{t:'🎳 Clásico (10 pinos)', d:'10 cuadros, 2 tiros por cuadro. Strike = los 10 de una; spare = los 10 en dos tiros. En el último cuadro, si hacés strike o spare tirás de nuevo.'},
  '369':  {t:'3️⃣6️⃣9️⃣ Bolos 3-6-9', d:'Igual que el clásico, pero los cuadros 3, 6 y 9 son strike de regalo para todos. ¡Ideal para llegar a puntajes altos!'},
  nueve:  {t:'9️⃣ Nueve sin tope', d:'Si tirás 9 o más pinos en el primer tiro cuenta como strike. Se juega mucho en ligas y torneos de aficionados.'},
  elim:   {t:'💀 Eliminación', d:'Al final de cada cuadro, el que va último queda afuera. Gana el último que queda (o el que más tiene al terminar).'},
  spares: {t:'🎯 Desafío de spares', d:'En cada cuadro se arma una “sobra” difícil (7-10, 4-6, el balde…) y tenés un solo tiro. Sumás los pinos que tirás y 10 más si limpiás todo.'},
};
const SCORES={
  trad:  {t:'📋 Tradicional (máximo 300)', d:'Strike: 10 + los dos tiros siguientes. Spare: 10 + el tiro siguiente.'},
  actual:{t:'⚡ Cuadro actual (World Bowling)', d:'Strike vale 30 al toque, spare vale 10 + el primer tiro de ese cuadro. No hay tiros extra en el último cuadro. Máximo 300.'},
  pinos: {t:'🔢 Solo pinos (sin bonus)', d:'Se suman los pinos que cayeron y nada más. Máximo 10 por cuadro.'},
  custom:{t:'🛠️ Personalizada', d:'Vos elegís cuánto vale cada pino, el strike y el spare.'},
};
const FORMATS={ind:'👤 Cada uno por su cuenta', baker:'👥 Por equipos, turnándose por cuadro (Baker)', escoces:'👫 Por equipos, turnándose cada tiro (escocés)'};
const HOUSE=[
  {k:'bumpers', t:'🛟 Barandas (sin canaletas)', d:'Como para los chicos: la bola rebota en los costados y nunca cae a la canaleta.', def:false},
  {k:'gold', t:'🌟 Pino dorado', d:'En cada cuadro un pino brilla dorado. Si lo tirás en el primer tiro sumás puntos extra.', def:false},
  {k:'gutterRedo', t:'🎁 Canaleta de regalo', d:'La primera canaleta de cada cuadro no cuenta: se vuelve a tirar.', def:false},
  {k:'turkey', t:'🦃 Premio al pavo', d:'Tres strikes seguidos (un “pavo”) suman 10 puntos extra.', def:false},
];
const FRAMES=[{v:10,t:'10 cuadros (oficial)'},{v:5,t:'5 cuadros (rápida)'},{v:3,t:'3 cuadros (relámpago)'}];
const LINES=[{v:1,t:'Una línea'},{v:2,t:'Dos líneas (se suman)'},{v:3,t:'Serie de tres líneas (se suman)'}];
const AIMS=[{v:'facil',t:'🟢 Fácil (muestra todo el recorrido con la curva)'},{v:'medio',t:'🟡 Medio (línea hasta las flechas)'},{v:'experto',t:'🔴 Experto (solo la dirección)'}];
const TIMERS=[{v:0,t:'Sin límite'},{v:20,t:'20 segundos'},{v:40,t:'40 segundos'},{v:60,t:'1 minuto'}];
const BOTLV=[{v:'facil',t:'🙂 Fácil'},{v:'normal',t:'😎 Normal'},{v:'crack',t:'🔥 Crack'}];
const LEAVES=[
  {p:[7,10], n:'7-10, “los postes”'}, {p:[4,6], n:'4-6, “la grande”'}, {p:[2,7], n:'2-7, “split chico”'}, {p:[3,10], n:'3-10, “split chico”'},
  {p:[5,7], n:'5-7, “la diagonal”'}, {p:[5,10], n:'5-10'}, {p:[2,4,5,8], n:'2-4-5-8, “el balde”'}, {p:[3,5,6,9], n:'3-5-6-9, “el balde”'},
  {p:[1,2,4,10], n:'1-2-4-10, “la lavada”'}, {p:[10], n:'el 10 solito'}, {p:[7], n:'el 7 solito'}, {p:[6,7,10], n:'6-7-10'},
  {p:[4,7,10], n:'4-7-10'}, {p:[8,10], n:'8-10'}, {p:[4,9], n:'4-9'}, {p:[2,10], n:'2-10'}, {p:[3,6,10], n:'3-6-10'}, {p:[1,2,8,10], n:'1-2-8-10'},
];
function defaultOpts(){ const o={mode:'clasico', score:'trad', fmt:'ind', frames:10, lines:1, oil:'normal', aim:'medio', bot:'normal', timer:0, pp:1, sb:0, spb:0, bon:true, goldPts:10}; HOUSE.forEach(h=>o[h.k]=h.def); return o; }
const hasBonusBalls = o => o.mode!=='spares' && (o.score==='trad' || (o.score==='custom' && o.bon) || o.mode==='nueve' && o.score!=='actual' && o.score!=='pinos');

let S=null;
const EMOJIS=['🎳','🧉','🥯','🐆','🌸','🎻','⚽','🐂','🌽','🦜','🐊','🦩','🍖','🌵','🎸','🐎','🦋','🌞','🍉','🦉'];
const PCOLORS=['#e63946','#1d70d6','#2a9d3f','#e9a100','#8e44ad','#ff7f11','#13a8a8','#c2185b'];
const BALLS=['#d52b1e','#0038a8','#2a9d3f','#f2c14e','#7b2cbf','#111111','#ff7f11','#13a8a8','#e75480','#8d5524'];
const TEAMS=[{n:'Equipo Rojo', e:'🔴', c:'#e63946'}, {n:'Equipo Azul', e:'🔵', c:'#1d70d6'}];
const BOT_NAMES=[['Don Pino','🎳'],['Ña Canaleta','🌸'],['Karai Strike','🧉'],['Chulo Spare','😎'],['Ña Chuza','🦋'],['Don Gancho','🐆'],['Pombero','👹'],['Kuñataĩ Bola','🦜']];
const MAXP=8;
const P = id => S && S.players.find(p=>p.id===id);
const OB = id => S && (S.observers||[]).find(o=>o.id===id);

function lobbyState(){
  return {v:1, phase:'lobby', seq:0, players:[], observers:[], hostPid:null, opts:defaultOpts(), grules:'', sugs:[], log:[],
    sides:[], cur:0, frame:0, ball:0, pins:fullRack(), line:0, shot:null, shotN:0, busyUntil:0, lineWin:null, gold:null, leaves:[], turnAt:0};
}
function addPlayer(name, emoji, token, peerId, bot, local){
  const used=S.players.map(p=>p.color), usedB=S.players.map(p=>p.ball);
  const t0=S.players.filter(p=>p.team===0).length, t1=S.players.filter(p=>p.team===1).length;
  const p={id:'p'+(++S.seq), name:(String(name||'').trim()||'Jugador').slice(0,16), emoji, token, peerId,
    color:PCOLORS.find(c=>!used.includes(c))||PCOLORS[S.players.length%PCOLORS.length],
    ball:BALLS.find(c=>!usedB.includes(c))||BALLS[0], hc:0,
    conn:!bot, bot:!!bot, local:!!local, mic:false, team: t0<=t1 ? 0 : 1};
  S.players.push(p); return p;
}
function addBot(){
  if(S.players.length>=MAXP) return 'Ya son 8 jugadores (el máximo).';
  const free=BOT_NAMES.filter(([n])=>!S.players.some(p=>p.name===n));
  const [n,e]=free.length?free[rnd(free.length)]:['Bot '+(S.players.length+1),'🤖'];
  const b=addPlayer(n, e, null, null, true);
  sysChat(`🤖 ${b.name} se sumó a la pista.`);
}
function log(x){ S.log.push({x, at:Date.now()}); if(S.log.length>200) S.log.splice(0, S.log.length-200); }

/* ---------- lados (jugadores o equipos) y turnos ---------- */
function buildSides(){
  const o=S.opts;
  if(o.fmt!=='ind') S.sides=[0,1].map(t=>({team:t, pids:S.players.filter(p=>p.team===t).map(p=>p.id), k:-1, frames:[], lines:[], out:false}));
  else S.sides=S.players.map(p=>({team:null, pids:[p.id], k:-1, frames:[], lines:[], out:false}));
}
function sideName(st, i){
  const s=st.sides[i]; if(!s) return '?';
  if(s.team!=null) return TEAMS[s.team].e+' '+TEAMS[s.team].n;
  const p=st.players.find(x=>x.id===s.pids[0]); return p ? p.name : '?';
}
function shooterOf(st){ const s=st.sides[st.cur]; if(!s || !s.pids.length) return null; return s.pids[((s.k%s.pids.length)+s.pids.length)%s.pids.length]; }
const sideHc = (st, s) => s.pids.reduce((a,pid)=>a+(+((st.players.find(p=>p.id===pid)||{}).hc)||0), 0);
function startGame(){
  buildSides(); S.line=0; S.phase='play'; S.startedAt=Date.now();
  newLine();
}
function newLine(){
  const o=S.opts; S.line++;
  S.sides.forEach(s=>{ s.frames=[]; s.out=false; });
  S.frame=0; S.cur=0; S.ball=0; S.lineWin=null; S.shot=null; S.phase='play';
  S.leaves = o.mode==='spares' ? shuffle(LEAVES.map((_,i)=>i)).slice(0, o.frames) : [];
  log(`🎳 Línea ${S.line}: ${MODES[o.mode].t}, ${o.frames} cuadros.`);
  beginFrame();
}
// empieza el cuadro del lado que le toca (los cuadros de regalo del 3-6-9 se anotan solos)
function beginFrame(){
  const o=S.opts, s=S.sides[S.cur];
  if(o.mode==='369' && [2,5,8].includes(S.frame) && S.frame<o.frames-1){
    s.frames[S.frame]={b:[10], v:[10], m:['X'], auto:true, done:true};
    log(`🎁 ${sideName(S,S.cur)}: strike de regalo en el cuadro ${S.frame+1}.`);
    return endFrame(true);
  }
  s.frames[S.frame]={b:[], v:[], m:[], done:false};
  if(o.fmt==='baker') s.k++;
  S.ball=0;
  rackFor();
}
function rackFor(){
  const o=S.opts;
  S.pins = o.mode==='spares' ? leaveRack(LEAVES[S.leaves[S.frame]].p) : fullRack();
  S.gold = o.gold && o.mode!=='spares' ? rnd(10) : null;
  startBall();
}
function startBall(){
  const s=S.sides[S.cur];
  if(S.opts.fmt==='escoces' || (S.opts.fmt==='ind' && s.k<0)) s.k++;
  S.turnAt=Date.now();
}
function nextActive(from){ for(let i=from+1;i<S.sides.length;i++) if(!S.sides[i].out && S.sides[i].pids.length) return i; return -1; }
function endFrame(fromAuto){
  let i=nextActive(S.cur);
  if(i<0){   // terminó la vuelta: todos tiraron este cuadro
    if(S.opts.mode==='elim') elimCheck();
    const alive=S.sides.filter(s=>!s.out);
    S.frame++;
    if(S.frame>=S.opts.frames || (S.opts.mode==='elim' && alive.length<=1)) return lineOver();
    i=nextActive(-1);
  }
  S.cur=i;
  beginFrame();
  void fromAuto;
}
function elimCheck(){
  const alive=S.sides.map((s,i)=>({s,i})).filter(x=>!x.s.out);
  if(alive.length<2) return;
  const tot=alive.map(x=>({...x, t:scoreSide(S, x.s).prov}));
  const min=Math.min(...tot.map(x=>x.t));
  const low=tot.filter(x=>x.t===min);
  if(low.length===alive.length) { log(`🤝 Cuadro ${S.frame+1}: todos empatados, nadie queda afuera.`); return; }
  if(alive.length-low.length<1) return;
  low.forEach(x=>{ x.s.out=true; log(`💀 ${sideName(S,x.i)} queda afuera con ${x.t} puntos.`); });
}
function lineOver(){
  const tots=S.sides.map(s=>{ const sc=scoreSide(S, s); return sc.tot + sideHc(S, s); });
  S.sides.forEach((s,i)=>s.lines.push(tots[i]));
  let cand=S.sides.map((s,i)=>i);
  if(S.opts.mode==='elim'){ const alive=cand.filter(i=>!S.sides[i].out); if(alive.length) cand=alive; }
  const best=Math.max(...cand.map(i=>tots[i])), win=cand.filter(i=>tots[i]===best);
  S.lineWin={side:win[0], tie:win.length>1, ties:win, pts:best, at:Date.now()};
  const over = S.line>=S.opts.lines;
  if(over && S.opts.lines>1){
    const sums=S.sides.map(s=>s.lines.reduce((a,b)=>a+b,0)), b2=Math.max(...sums), w2=sums.map((v,i)=>i).filter(i=>sums[i]===b2);
    S.lineWin.serie={side:w2[0], tie:w2.length>1, ties:w2, pts:b2};
  }
  S.phase = over ? 'over' : 'lineEnd';
  log(`🏆 Línea ${S.line}: ${win.map(i=>sideName(S,i)).join(' y ')} ${win.length>1?'empatan':'gana'} con ${best}.`);
}

/* ---------- puntos ---------- */
const isSplitLeave = up => {   // up: números de pino parados (1..10) después del primer tiro
  if(up.includes(1) || up.length<2) return false;
  const near=(a,b)=>{ const [x1,y1]=PIN_SPOTS[a-1], [x2,y2]=PIN_SPOTS[b-1]; return Math.hypot(x1-x2,y1-y2)<31; };
  const seen=new Set([up[0]]), st=[up[0]];
  while(st.length){ const a=st.pop(); for(const b of up) if(!seen.has(b) && near(a,b)){ seen.add(b); st.push(b); } }
  return seen.size<up.length;
};
// puntaje de un lado: cum = acumulado por cuadro (null si falta saber el bonus), tot = el último seguro, prov = contando lo que hay
function scoreSide(st, sd){
  const o=st.opts, N=o.frames, sys=o.score, F=sd.frames, cum=[];
  const rolls=[]; F.forEach((fr,f)=>{ if(fr) fr.v.forEach((v,k)=>rolls.push({f,k,v})); });
  const after=(f,k,n)=>{ const i=rolls.findIndex(r=>r.f===f && r.k===k); const nx=rolls.slice(i+1, i+1+n); return nx.length<n ? null : nx.reduce((a,r)=>a+r.v,0); };
  let run=0, prov=0, ok=true;
  for(let f=0; f<N; f++){
    const fr=F[f]; if(!fr || !fr.done){ cum.push(null); if(fr){ prov += fr.v.reduce((a,b)=>a+b,0)*(sys==='custom'?o.pp:1); } ok=false; continue; }
    const last=f===N-1, strike=fr.m[0]==='X', spare=!strike && fr.m[1]==='/';
    const sum=fr.v.reduce((a,b)=>a+b,0);
    let fs=0, pend=false;
    if(o.mode==='spares') fs = fr.b[0] + (fr.clr?10:0);
    else if(sys==='actual') fs = strike ? 30 : spare ? 10+fr.v[0] : sum;
    else if(sys==='pinos') fs = fr.b.reduce((a,b)=>a+b,0);
    else {
      const trad=sys==='trad', pp=trad?1:+o.pp, sb=trad?0:+o.sb, spb=trad?0:+o.spb, bon=trad||o.bon;
      if(last){ fs = sum*pp + fr.m.filter(m=>m==='X').length*sb + fr.m.filter(m=>m==='/').length*spb; }
      else if(strike){ const nx=bon?after(f,0,2):0; if(nx==null){ pend=true; fs=10*pp+sb; } else fs=10*pp+sb+nx*pp; }
      else if(spare){ const nx=bon?after(f,1,1):0; if(nx==null){ pend=true; fs=10*pp+spb; } else fs=10*pp+spb+nx*pp; }
      else fs=sum*pp;
    }
    if(fr.g) fs += +o.goldPts||0;
    if(fr.tk) fs+=10*fr.tk;
    prov+=fs;
    if(pend) ok=false;
    if(ok){ run+=fs; cum.push(run); } else cum.push(null);
  }
  return {cum, tot:run, prov};
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
    case 'vote': {
      const s=S.sugs.find(x=>x.id===a.id); if(!s) return;
      s.votes = s.votes.includes(pid) ? s.votes.filter(x=>x!==pid) : s.votes.concat(pid); commit(); return;
    }
    case 'joinNext': {
      const o=OB(pid); if(!o) return;
      if(S.phase==='play' || S.phase==='lineEnd') return 'Esperá a que termine la partida para sentarte.';
      if(S.players.length>=MAXP) return 'La pista está llena.';
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
      if(S.players.length>=MAXP) return 'Ya son 8 jugadores.';
      const nm=String(a.name||'').trim().slice(0,16); if(!nm) return;
      const emo=EMOJIS.find(e=>!S.players.some(q=>q.emoji===e))||'🎳';
      const np=addPlayer(nm, emo, null, null, false, true); np.conn=true;
      sysChat(`🙋 ${np.name} juega en este aparato.`); commit(); return;
    }
    case 'team': {
      if(S.phase!=='lobby') return;
      const t=P(a.pid); if(!t || (!host && t.id!==pid)) return;
      t.team = t.team ? 0 : 1; commit(); return;
    }
    case 'ballc': {   // color de la bola: cada uno la suya (en la partida local, el anfitrión elige por todos)
      const t=P(a.pid||pid); if(!t || (t.id!==pid && !host)) return;
      if(BALLS.includes(a.c)) t.ball=a.c; commit(); return;
    }
    case 'hc': {      // hándicap: lo pone el anfitrión
      if(!host || S.phase!=='lobby') return; const t=P(a.pid); if(!t) return;
      t.hc=Math.max(0, Math.min(250, Math.round(+a.v||0))); commit(); return;
    }
    case 'kick': {
      if(!host) return; const t=P(a.pid); if(!t || t.id===S.hostPid) return;
      removePlayer(t, `🚪 ${t.name} salió de la pista.`); commit(); return;
    }
    case 'botify': {
      if(!host) return; const t=P(a.pid); if(!t || t.bot) return;
      t.bot=true; t.conn=false; t.mic=false; t.token=null; sysChat(`🤖 Un bot sigue tirando por ${t.name}.`); commit(); return;
    }
    case 'opt': {
      if(!host || S.phase!=='lobby') return;
      const o=S.opts, v=a.v;
      if(a.k==='mode' && MODES[v]) o.mode=v;
      else if(a.k==='score' && SCORES[v]) o.score=v;
      else if(a.k==='fmt' && FORMATS[v]) o.fmt=v;
      else if(a.k==='frames' && FRAMES.some(x=>x.v==v)) o.frames=+v;
      else if(a.k==='lines' && LINES.some(x=>x.v==v)) o.lines=+v;
      else if(a.k==='oil' && OILS[v]) o.oil=v;
      else if(a.k==='aim' && AIMS.some(x=>x.v===v)) o.aim=v;
      else if(a.k==='bot' && BOTLV.some(x=>x.v===v)) o.bot=v;
      else if(a.k==='timer' && TIMERS.some(x=>x.v==v)) o.timer=+v;
      else if(a.k==='pp') o.pp=Math.max(1, Math.min(10, Math.round(+v||1)));
      else if(a.k==='sb') o.sb=Math.max(0, Math.min(50, Math.round(+v||0)));
      else if(a.k==='spb') o.spb=Math.max(0, Math.min(50, Math.round(+v||0)));
      else if(a.k==='goldPts') o.goldPts=Math.max(1, Math.min(50, Math.round(+v||10)));
      else if(a.k==='bon') o.bon=!!v;
      else if(HOUSE.some(h=>h.k===a.k)) o[a.k]=!!v;
      commit(); return;
    }
    case 'grules': if(!host) return; S.grules=String(a.text||'').slice(0,1200); commit(); return;
    case 'sugDel': if(!host) return; S.sugs=S.sugs.filter(s=>s.id!==a.id); commit(); return;
    case 'start': {
      if(!host || S.phase!=='lobby') return;
      const r=canStart(); if(r) return r;
      startGame(); sysChat(`🎳 ¡Empieza! ${MODES[S.opts.mode].t}. Tira ${sideName(S,S.cur)}.`); commit(); return;
    }
    case 'nextLine': if(!host || S.phase!=='lineEnd') return; newLine(); commit(); return;
    case 'rematch': if(!host || S.phase!=='over') return; startGame(); sysChat('🔁 ¡Revancha! Empieza otra partida.'); commit(); return;
    case 'newGame': if(!host || (S.phase!=='over' && S.phase!=='lineEnd' && !a.force)) return;
      S.phase='lobby'; S.log=[]; S.sides=[]; S.shot=null; S.lineWin=null; S.pins=fullRack(); commit(); return;
    case 'leave': {
      if(S.phase==='lobby' || S.phase==='over') removePlayer(p, `🚪 ${p.name} se fue.`);
      else { p.bot=true; p.conn=false; p.mic=false; p.token=null; sysChat(`🚪 ${p.name} se fue: un bot 🤖 tira por él.`); }
      commit(); return;
    }
    case 'throw': {
      if(S.phase!=='play') return;
      const sh=shooterOf(S);
      if(sh!==pid && !(NET.mode==='local' && P(sh) && !P(sh).bot && isLocalCtl(pid))) return 'No es tu turno.';
      if(Date.now() < S.busyUntil-400) return 'Esperá que terminen de caer los pinos.';
      return doThrow(a);
    }
  }
}
function canStart(){
  const o=S.opts, n=S.players.length;
  if(n<1) return 'Falta al menos un jugador.';
  if(o.fmt!=='ind'){
    const a=S.players.filter(p=>p.team===0).length, b=S.players.filter(p=>p.team===1).length;
    if(!a || !b) return 'Cada equipo necesita al menos un jugador. Tocá 🔴/🔵 al lado de cada nombre para cambiarlo de equipo.';
  }
  if(o.mode==='elim' && (o.fmt!=='ind' ? 2 : n)<2) return 'La eliminación necesita al menos 2 jugadores (sumá un bot 🤖).';
  if(o.mode==='elim' && o.fmt!=='ind') return 'La eliminación se juega cada uno por su cuenta.';
  return null;
}
function doThrow(a){
  const th={x:Math.max(BR*.5, Math.min(LW-BR*.5, +a.x||C)), ang:Math.max(-MAXANG, Math.min(MAXANG, +a.ang||0)), pow:Math.max(.02, Math.min(1, +a.pow||0)), spin:Math.max(-1, Math.min(1, +a.spin||0))};
  if(!isFinite(th.x) || !isFinite(th.ang)) return;
  const o=S.opts, before=S.pins.map(p=>({...p})), seed=1+rnd(2e9);
  const sim=simulate(S.pins, th, {oil:o.oil, bumpers:o.bumpers}, seed);
  const shooterPid=shooterOf(S), side0=S.cur, frame0=S.frame, ball0=S.ball;
  const res=scoreThrow(sim, before);
  S.shotN++;
  S.shot={n:S.shotN, from:before, bt:sim.bt, pt:sim.pt, ev:sim.ev, frames:sim.info.frames, pid:shooterPid, side:side0, frame:frame0, ball:ball0, th, gold:S.gold,
    res:Object.assign({knocked:sim.knocked}, res)};
  S.busyUntil = Date.now() + sim.info.frames/30*1000 + 1100;
  commit();
}
// anota el tiro en el cuadro y decide qué sigue
function scoreThrow(sim, before){
  const o=S.opts, s=S.sides[S.cur], fr=s.frames[S.frame], name=sideName(S,S.cur), shooter=P(shooterOf(S));
  const up0=before.map((p,i)=>p.up?i+1:0).filter(Boolean), n=sim.knocked.length, fresh=up0.length===10;
  const who = s.pids.length>1 && shooter ? `${name} (${shooter.name})` : name;
  const res={n, msg:'', strike:false, spare:false, split:false, gutter:sim.info.gutter && n===0, redo:false};
  // canaleta de regalo
  if(o.gutterRedo && res.gutter && !fr.redo && o.mode!=='spares'){
    fr.redo=true; res.redo=true; res.msg='🎁 Canaleta de regalo: ¡tirá de nuevo!';
    log(`🎁 ${who}: canaleta de regalo, vuelve a tirar.`); S.turnAt=Date.now(); return res;
  }
  if(o.mode==='spares'){
    fr.b=[n]; fr.v=[n]; fr.clr = n===up0.length; fr.m=[fr.clr?'/':String(n||'-')]; fr.done=true;
    res.spare=fr.clr; res.msg = fr.clr ? `🎯 ¡Limpió la ${LEAVES[S.leaves[S.frame]].n}!` : n ? `Tiró ${n} de ${up0.length}` : '😬 Ninguno';
    log(`${fr.clr?'🎯':'🎳'} ${who}: ${res.msg} (cuadro ${S.frame+1}).`);
    S.pins=sim.pins; endFrame(); return res;
  }
  const bi=fr.b.length, last=S.frame===o.frames-1, bonus=hasBonusBalls(o);
  const strike = fresh && (n===10 || (o.mode==='nueve' && n>=9 && bi===0));
  const spare = !strike && !fresh && n===up0.length && n>0;
  fr.b.push(n); fr.v.push(strike ? 10 : n);
  fr.m.push(strike ? 'X' : spare ? '/' : res.gutter ? 'G' : n ? String(n) : '-');
  const upAfter=sim.pins.map((p,i)=>p.up?i+1:0).filter(Boolean);
  if(bi===0 && fresh && !strike && isSplitLeave(upAfter)){ fr.sp=true; res.split=true; }
  if(bi===0 && S.gold!=null && sim.knocked.includes(S.gold)){ fr.g=true; res.gold=true; }
  res.strike=strike; res.spare=spare;
  // pavo: tres strikes seguidos
  if(strike && o.turkey){
    let k=0; const all=s.frames.flatMap(F=>F?F.m:[]); for(let i=all.length-1; i>=0 && all[i]==='X'; i--) k++;
    if(k>=3 && k%3===0){ fr.tk=(fr.tk||0)+1; res.turkey=true; }
  }
  const leftName = upAfter.join('-');
  res.msg = strike ? (o.mode==='nueve' && n===9 ? '¡Nueve = strike! 💥' : '💥 ¡STRIKE!') : spare ? '✨ ¡Spare!' : res.gutter ? '😬 ¡Canaleta!' : res.split ? `😱 ¡Split ${leftName}!` : n===0 ? '😅 Ningún pino' : `${n} pino${n>1?'s':''}`;
  if(res.turkey) res.msg='🦃 ¡PAVO! Tres strikes seguidos';
  if(res.gold) res.msg+=' · 🌟 ¡pino dorado!';
  log(`${strike?'💥':spare?'✨':res.gutter?'😬':'🎳'} ${who}, cuadro ${S.frame+1}: ${res.msg.replace(/^(?![0-9¡])\S+ /,'')}${!strike&&!spare&&upAfter.length&&upAfter.length<10?` (en pie: ${leftName})`:''}.`);
  let done, reset=false;
  if(!last || !bonus) done = strike || bi>=1;
  else {
    const b0x=fr.m[0]==='X';
    if(bi===0) { done=false; reset=strike; }
    else if(bi===1){ if(b0x){ done=false; reset=strike; } else { done=!spare; reset=spare; } }
    else done=true;
  }
  if(done){ fr.done=true; S.pins=sim.pins; endFrame(); }
  else {
    S.ball++;
    if(reset){ S.pins=fullRack(); S.gold=null; } else S.pins=sim.pins;
    startBall();
  }
  return res;
}
function removePlayer(t, msg){
  if(S.phase==='lobby' || S.phase==='over'){ S.players=S.players.filter(x=>x!==t); }
  else { t.bot=true; t.conn=false; t.token=null; }
  if(NET.mode==='host' && NET.conns[t.id]){ try{ NET.conns[t.id].send({t:'kicked'}); }catch(e){} }
  sysChat(msg);
}

/* ====================== BOTS ====================== */
const BOT={busy:false};
const BOT_TALK={
  strike:['¡Chuza! 💥','Eso es gancho paraguayo 🎳','¡Tomá! 🧉','Limpito 👌'],
  spare:['Spare, de una 😎','Con lo justo ✨'],
  miss:['Uff, por poquito 😅','Se me resbaló la bola','Esa pista está torcida 😤'],
  gutter:['Upa, canaleta 🙈','Ni yo sé qué hice 😂'],
  win:['¡Gané! ¿Otra? 🏆','Fue suerte… o no 😏'],
};
const pick = a => a[rnd(a.length)];
const autoPlays = p => p && (p.bot || (!p.conn && p.offAt && Date.now()-p.offAt>20000));
// busca el ángulo para que la bola llegue a "tx" a la altura "ty"
function aimFor(x, tx, ty, pow, spin, env){
  let lo=-MAXANG, hi=MAXANG;
  for(let k=0;k<22;k++){ const m=(lo+hi)/2, r=ballPath({x, ang:m, pow, spin}, env, ty, 60); if(r.x<tx) lo=m; else hi=m; }
  return (lo+hi)/2;
}
function botPlan(lvOverride){
  const st=S, o=st.opts, env={oil:o.oil, bumpers:o.bumpers}, lv=lvOverride||o.bot;
  const up=st.pins.map((p,i)=>p.up?i:-1).filter(i=>i>=0);
  if(!up.length) return {x:C, ang:0, pow:.7, spin:0};
  let base;
  if(up.length===10){   // primer tiro: al bolsillo 1-3 con gancho
    const spin=-(.45+Math.random()*.2), pow=.68+Math.random()*.12, x=C+28+rnd(10);
    base={x, pow, spin, tx:C+5.5, ty:HEAD};
  } else {              // spare: derecho a los pinos que quedan, cruzando la pista
    const ps=up.map(i=>st.pins[i]), front=ps.slice().sort((a,b)=>a.y-b.y)[0];
    const cx=ps.reduce((a,p)=>a+p.x,0)/ps.length, tx = ps.length>1 ? front.x*.6+cx*.4 : front.x;
    const x = tx<C ? C+22 : tx>C ? C-22 : C;
    base={x, pow:.8, spin:0, tx, ty:front.y};
  }
  // prueba algunas variantes con la física (sin ruido) y elige la que más tira
  let best=null;
  const offs = lv==='facil' ? [0] : [0,-3,3,-6,6,-1.5,1.5];
  for(const d of offs){
    const ang=aimFor(base.x, base.tx+d, base.ty, base.pow, base.spin, env);
    const th={x:base.x, ang, pow:base.pow, spin:base.spin};
    const n=simulate(st.pins, th, env, 7+Math.abs(d*10|0), true).knocked.length;
    if(!best || n>best.n) best={th, n};
  }
  const th=best.th, noise = lv==='facil' ? .011 : lv==='crack' ? .0013 : .0035;
  th.ang += (Math.random()+Math.random()+Math.random()-1.5)*noise;
  th.x += (Math.random()-.5)*(lv==='facil'?8:lv==='crack'?1.5:4);
  th.pow = Math.max(.1, Math.min(1, th.pow*(1+(Math.random()-.5)*(lv==='crack'?.04:.12))));
  return th;
}
function botTick(){
  if(!S || NET.mode==='client' || BOT.busy) return;
  if(S.phase==='lineEnd' && S.lineWin && Date.now()-S.lineWin.at>15000){ newLine(); commit(); return; }   // la próxima línea arranca sola
  if(S.phase!=='play') return;
  const pid=shooterOf(S), p=P(pid);
  const late = S.opts.timer>0 && p && !p.bot && Date.now() > Math.max(S.turnAt, S.busyUntil) + S.opts.timer*1000;
  if(!autoPlays(p) && !late) return;
  if(Date.now() < S.busyUntil + 500) return;
  BOT.busy=true;
  setTimeout(()=>{
    try{
      if(!S || S.phase!=='play' || shooterOf(S)!==pid) return;
      if(late && !autoPlays(p)) sysChat(`⏰ Se le acabó el tiempo a ${p.name}: tiró el bot por él.`);
      const plan=botPlan(late?'facil':null);
      act(pid, Object.assign({type:'throw'}, plan));
      if(p.bot && S && S.shot && rnd(3)===0){
        const r=S.shot.res; setTimeout(()=>{ if(!S) return; botChat(p, pick(r.strike?BOT_TALK.strike:r.spare?BOT_TALK.spare:r.gutter?BOT_TALK.gutter:BOT_TALK.miss)); }, S.shot.frames/30*1000+400);
      }
    } finally { BOT.busy=false; }
  }, late ? 200 : 1000+rnd(900));
}
setInterval(botTick, 400);
function botPrivate(bot, from, text){
  void text;
  setTimeout(()=>{ if(!S) return; addChat(bot.id, pick(['Shhh, estoy apuntando 🎳','Jaja, después hablamos 😏','¿Me estás distrayendo? 😂']), from.id); }, 1200+rnd(1500));
}
