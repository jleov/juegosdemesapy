'use strict';
/* =====================================================================
   Billar PY — la mesa, la física de las bolas, los modos de juego
   (Bola 8, Bola 9, Bola 10, Rotación 61, Bola secreta y Libre) y los bots.
   Todo lo decide el anfitrión: simula el tiro y manda a todos el recorrido.
   ===================================================================== */

/* ====================== MESA (medidas en cm, mesa de 9 pies) ====================== */
const TL=254, TW=127, BR=2.858;          // largo y ancho del paño, radio de la bola
const HEAD_X=TL/4, FOOT_X=TL*3/4, MID_Y=TW/2;
const CM=8.8, SM=6.6;                     // boca de las troneras: esquina (desde la esquina) y media boca de las del medio
const POCKETS=[
  {x:-2.2, y:-2.2, aim:{x:1.8, y:1.8}, n:'↖'},   {x:TL/2, y:-4, aim:{x:TL/2, y:-.6}, n:'⬆'},   {x:TL+2.2, y:-2.2, aim:{x:TL-1.8, y:1.8}, n:'↗'},
  {x:-2.2, y:TW+2.2, aim:{x:1.8, y:TW-1.8}, n:'↙'}, {x:TL/2, y:TW+4, aim:{x:TL/2, y:TW+.6}, n:'⬇'}, {x:TL+2.2, y:TW+2.2, aim:{x:TL-1.8, y:TW-1.8}, n:'↘'},
];
// bandas (con los "cuernos" de las troneras): segmentos [ax,ay,bx,by]
const SEGS=(()=>{
  const s=[], J=4.6;
  for(const y of [0, TW]){ const d=y?1:-1;
    s.push([CM,y, TL/2-SM,y], [TL/2+SM,y, TL-CM,y]);
    s.push([CM,y, CM-2.4,y+d*J], [TL-CM,y, TL-CM+2.4,y+d*J]);           // esquinas
    s.push([TL/2-SM,y, TL/2-SM-.9,y+d*J], [TL/2+SM,y, TL/2+SM+.9,y+d*J]); // medio
  }
  for(const x of [0, TL]){ const d=x?1:-1;
    s.push([x,CM, x,TW-CM]);
    s.push([x,CM, x+d*J,CM-2.4], [x,TW-CM, x+d*J,TW-CM+2.4]);
  }
  return s;
})();
const BALL_COLORS=['#f8f6ef','#f4c20d','#1f4fbf','#d32f2f','#6a1b9a','#f57c00','#2e7d32','#7b1f1f','#111111'];
const ballColor = n => n===0 ? BALL_COLORS[0] : BALL_COLORS[n>8 ? n-8 : n];
const isStripe = n => n>8;

/* ====================== FÍSICA ====================== */
const G=981, MU_S=.2, MU_R=.014, E_BALL=.95, E_RAIL=.78, DRAG=.06;
const DT=1/840, SAMPLE=28;               // 840 pasos por segundo, se guarda una foto cada 28 (30 por segundo)
const powerToSpeed = p => 18 + 640*p*p;  // fuerza 0..1 → cm/s
const POT_OUT=3.4;                        // si el centro pasa este margen afuera del paño, la bola entró
function nearestPocket(x,y){ let bi=0, bd=1e9; POCKETS.forEach((p,i)=>{ const d=(p.x-x)**2+(p.y-y)**2; if(d<bd){ bd=d; bi=i; } }); return bi; }

// simula un tiro. balls: [{n,x,y,in}], shot: {dx,dy,v,sa,sb} (sa = efecto de costado, sb = arriba(+)/abajo(-))
function simulate(balls, shot, light){
  const B=balls.filter(b=>!b.in).map(b=>({n:b.n, x:b.x, y:b.y, vx:0, vy:0, ux:0, uy:0, w:0, on:true}));
  const cue=B.find(b=>b.n===0);
  const info={first:null, potted:[], cueIn:false, railAfter:false, railBalls:[], frames:0, dur:0};
  const tracks={}, ev=[];
  if(!cue) return {balls:balls.map(b=>({...b})), info, tracks, ev};
  const v=shot.v, sb=Math.max(-1,Math.min(1,shot.sb||0)), sa=Math.max(-1,Math.min(1,shot.sa||0));
  cue.vx=shot.dx*v; cue.vy=shot.dy*v;
  cue.ux=cue.vx*1.25*sb; cue.uy=cue.vy*1.25*sb;   // golpe arriba: sigue; abajo: retrocede
  cue.w=1.25*sa*v;                                // efecto de costado
  if(!light) B.forEach(b=>tracks[b.n]=[Math.round(b.x*10), Math.round(b.y*10)]);
  const railSeen=new Set();
  let step=0, frame=0;
  const MAXSTEP=840*40;
  for(; step<MAXSTEP; step++){
    let moving=false;
    for(const b of B){
      if(!b.on) continue;
      if(b.vx===0 && b.vy===0 && b.ux===0 && b.uy===0){ b.w=0; continue; }
      moving=true;
      const sx=b.vx-b.ux, sy=b.vy-b.uy, sl=Math.hypot(sx,sy);
      if(sl>.4){   // patina: el paño la frena y le cambia el giro hasta que rueda
        const dv=MU_S*G*DT;
        if(sl<=3.5*dv){ const vx=(5*b.vx+2*b.ux)/7, vy=(5*b.vy+2*b.uy)/7; b.vx=b.ux=vx; b.vy=b.uy=vy; }
        else { const nx=sx/sl, ny=sy/sl; b.vx-=dv*nx; b.vy-=dv*ny; b.ux+=2.5*dv*nx; b.uy+=2.5*dv*ny; }
      } else {     // rueda
        const sp=Math.hypot(b.vx,b.vy), dv=(MU_R*G + DRAG*sp)*DT;
        if(sp<=dv){ b.vx=b.vy=b.ux=b.uy=0; }
        else { const k=(sp-dv)/sp; b.vx*=k; b.vy*=k; b.ux=b.vx; b.uy=b.vy; }
      }
      if(b.w){ const d=60*DT; b.w = Math.abs(b.w)<=d ? 0 : b.w-Math.sign(b.w)*d; }
      b.x+=b.vx*DT; b.y+=b.vy*DT;
    }
    if(!moving) break;
    // bandas
    for(const b of B){
      if(!b.on) continue;
      if(b.x>BR+.01 && b.x<TL-BR-.01 && b.y>BR+.01 && b.y<TW-BR-.01) continue;
      for(const s of SEGS){
        const ex=s[2]-s[0], ey=s[3]-s[1], L2=ex*ex+ey*ey;
        let t=((b.x-s[0])*ex+(b.y-s[1])*ey)/L2; t=t<0?0:t>1?1:t;
        const cx=s[0]+ex*t, cy=s[1]+ey*t, dx=b.x-cx, dy=b.y-cy, d2=dx*dx+dy*dy;
        if(d2>=BR*BR || d2===0) continue;
        const d=Math.sqrt(d2), nx=dx/d, ny=dy/d, vn=b.vx*nx+b.vy*ny;
        b.x+=nx*(BR-d); b.y+=ny*(BR-d);
        if(vn>=0) continue;
        b.vx-=(1+E_RAIL)*vn*nx; b.vy-=(1+E_RAIL)*vn*ny;
        const un=b.ux*nx+b.uy*ny; b.ux-=1.6*un*nx; b.uy-=1.6*un*ny;
        if(b.w){ const tx=-ny, ty=nx, k=.38*b.w*Math.min(1,-vn/120); b.vx+=tx*k; b.vy+=ty*k; b.w*=.55; }
        if(info.first!=null){ info.railAfter=true; }
        if(b.n && !railSeen.has(b.n)){ railSeen.add(b.n); }
        if(!light && -vn>8) ev.push({f:frame, k:'r', v:Math.min(1,-vn/400)});
      }
    }
    // choques entre bolas: varias pasadas para que el golpe corra por las bolas que se tocan (como en el triángulo)
    const CT=2*BR+.04;
    for(let pass=0; pass<8; pass++){
      let any=false;
      for(let i=0;i<B.length;i++){ const a=B[i]; if(!a.on) continue;
        for(let j=i+1;j<B.length;j++){ const c=B[j]; if(!c.on) continue;
          const dx=c.x-a.x; if(dx>CT || dx<-CT) continue;
          const dy=c.y-a.y; if(dy>CT || dy<-CT) continue;
          const d2=dx*dx+dy*dy; if(d2>=CT*CT || d2===0) continue;
          const d=Math.sqrt(d2), nx=dx/d, ny=dy/d;
          if(d<2*BR){ const ov=(2*BR-d)/2; a.x-=nx*ov; a.y-=ny*ov; c.x+=nx*ov; c.y+=ny*ov; }
          const rel=(a.vx-c.vx)*nx+(a.vy-c.vy)*ny;
          if(rel<=.01) continue;
          const J=(1+E_BALL)/2*rel;
          a.vx-=J*nx; a.vy-=J*ny; c.vx+=J*nx; c.vy+=J*ny; any=true;
          if(info.first==null && (a.n===0 || c.n===0)) info.first = a.n===0 ? c.n : a.n;
          if(!light && rel>4 && pass===0) ev.push({f:frame, k:'b', v:Math.min(1,rel/350)});
        }
      }
      if(!any) break;
    }
    // troneras
    for(const b of B){
      if(!b.on) continue;
      if(b.x<-POT_OUT || b.x>TL+POT_OUT || b.y<-POT_OUT || b.y>TW+POT_OUT){
        b.on=false; const p=nearestPocket(b.x,b.y);
        b.x=POCKETS[p].x; b.y=POCKETS[p].y;
        if(b.n===0) info.cueIn=true; else info.potted.push({n:b.n, p});
        if(!light) ev.push({f:frame+1, k:'p', n:b.n, p, v:Math.min(1,Math.hypot(b.vx,b.vy)/300)});
        b.vx=b.vy=b.ux=b.uy=0; b.pf=frame+1;
      }
    }
    if(!light && (step+1)%SAMPLE===0){
      frame++;
      for(const b of B){ const t=tracks[b.n]; t.push(Math.round(b.x*10), Math.round(b.y*10)); }
    }
  }
  info.railBalls=[...railSeen];
  if(!light){
    frame++; for(const b of B){ tracks[b.n].push(Math.round(b.x*10), Math.round(b.y*10)); }
    // se recorta el final quieto de cada bola para que pese menos
    for(const n in tracks){ const t=tracks[n]; let L=t.length; while(L>2 && t[L-1]===t[L-3] && t[L-2]===t[L-4]) L-=2; t.length=L; }
  }
  info.frames=frame; info.dur=step*DT;
  const out=balls.map(b=>{ const s=B.find(x=>x.n===b.n); return s ? {n:b.n, x:+s.x.toFixed(2), y:+s.y.toFixed(2), in:!s.on, pf:s.pf} : {...b}; });
  return {balls:out, info, tracks, ev};
}

/* ====================== ARMADO ====================== */
function rnd(n){ if(window.crypto && crypto.getRandomValues){ const a=new Uint32Array(1); crypto.getRandomValues(a); return a[0]%n; } return Math.floor(Math.random()*n); }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=rnd(i+1); [a[i],a[j]]=[a[j],a[i]]; } return a; }
// lugares del triángulo: fila r (0 = la del vértice), puesto j
function rackSpot(r, j){ const g=.012; return {x:FOOT_X + r*(2*BR+g)*Math.sqrt(3)/2, y:MID_Y + (j - r/2)*(2*BR+g)}; }
function rackBalls(mode){
  const out=[{n:0, x:HEAD_X, y:MID_Y, in:false}];
  const put=(n,r,j)=>{ const s=rackSpot(r,j); out.push({n, x:+s.x.toFixed(3), y:+(s.y+(rnd(5)-2)*.002).toFixed(3), in:false}); };
  if(mode==='9'){   // rombo 1-2-3-2-1: la 1 adelante, la 9 al medio
    const rest=shuffle([2,3,4,5,6,7,8]), g=2*BR+.012;
    [1,2,3,2,1].forEach((k,r)=>{ for(let j=0;j<k;j++){
      const n = r===0 ? 1 : (r===2&&j===1) ? 9 : rest.pop();
      out.push({n, x:+(FOOT_X + r*g*Math.sqrt(3)/2).toFixed(3), y:+(MID_Y + (j-(k-1)/2)*g).toFixed(3), in:false});
    } });
    return out;
  }
  if(mode==='10'){
    const rest=shuffle([2,3,4,5,6,7,8,9]);
    for(let r=0;r<4;r++) for(let j=0;j<=r;j++){ const n = r===0 ? 1 : (r===2&&j===1) ? 10 : rest.pop(); put(n,r,j); }
    return out;
  }
  // 15 bolas
  let nums;
  if(mode==='8'){
    const sol=shuffle([1,2,3,4,5,6,7]), str=shuffle([9,10,11,12,13,14,15]);
    nums=new Array(15).fill(0);
    // vértice cualquiera, la 8 al medio, en las puntas de atrás una lisa y una rayada
    const idx=(r,j)=>r*(r+1)/2+j;
    nums[idx(2,1)]=8;
    if(rnd(2)){ nums[idx(4,0)]=sol.pop(); nums[idx(4,4)]=str.pop(); } else { nums[idx(4,0)]=str.pop(); nums[idx(4,4)]=sol.pop(); }
    const rest=shuffle([...sol, ...str]);
    for(let i=0;i<15;i++) if(!nums[i]) nums[i]=rest.pop();
  } else {
    const rest=shuffle([2,3,4,5,6,7,8,9,10,11,12,13,14,15]);
    nums=[1, ...rest];
    if(mode==='rot'){ const i15=nums.indexOf(15); const c=4; [nums[i15], nums[c]]=[nums[c], nums[i15]]; }
  }
  let k=0; for(let r=0;r<5;r++) for(let j=0;j<=r;j++) put(nums[k++], r, j);
  return out;
}
// vuelve a poner una bola en el punto de pie (o lo más cerca libre, hacia la banda de atrás)
function spotBall(st, n){
  const b=st.balls.find(x=>x.n===n); if(!b) return;
  const free=(x,y)=>st.balls.every(o=>o===b || o.in || (o.x-x)**2+(o.y-y)**2 >= (2*BR+.05)**2);
  for(let k=0;k<200;k++){
    for(const sgn of [1,-1]){
      const x=FOOT_X + sgn*k*.6;
      if(x<BR || x>TL-BR) continue;
      if(free(x, MID_Y)){ b.x=+x.toFixed(2); b.y=MID_Y; b.in=false; delete b.pf; return; }
    }
  }
  b.in=false; b.x=FOOT_X; b.y=MID_Y;
}

/* ====================== MODOS Y REGLAS ====================== */
const MODES={
  '8':    {t:'🎱 Bola 8',            d:'Lisas (1–7) contra rayadas (9–15). Metés todas las tuyas y después la 8.'},
  '9':    {t:'9️⃣ Bola 9',            d:'Siempre se toca primero la más baja. Gana el que mete la 9.'},
  '10':   {t:'🔟 Bola 10',           d:'Como la 9 pero con 10 bolas. La 10 en la salida vuelve a la mesa.'},
  'rot':  {t:'🔢 Rotación (61)',      d:'Cada bola vale su número. Tocás primero la más baja. Gana el que llega a 61 puntos.'},
  'kelly':{t:'🤫 Bola secreta',       d:'Cada uno tiene una bola secreta. Si metés la tuya ganás; si te meten la tuya, quedás afuera.'},
  'libre':{t:'🎯 Libre / práctica',   d:'Sin faltas ni turnos estrictos: para practicar tiros o jugar como quieran.'},
};
const FORMATS={ind:'👤 Cada uno por su cuenta (1 vs 1, o más)', eq:'👥 Por equipos (2 vs 2, 3 vs 3…)'};
const HOUSE=[
  {k:'bihHead',   def:false, modes:['8','9','10','rot','kelly'], t:'↩️ Bola en mano solo detrás de la línea', d:'Después de una falta, la blanca se pone detrás de la línea de salida (como se juega en muchos bares), no en cualquier lugar.'},
  {k:'call8',     def:true,  modes:['8'], t:'📣 Cantar la tronera de la 8', d:'Antes de tirar a la 8 hay que elegir la tronera. Si entra en otra, perdés.'},
  {k:'samePocket',def:false, modes:['8'], t:'🎯 La 8 en la tronera de la última', d:'Regla de bar: la 8 tiene que entrar en la misma tronera donde metiste tu última bola.'},
  {k:'eightBreakWin', def:true, modes:['8'], t:'💥 La 8 en la salida gana', d:'Si en la salida entra la 8 (sin que caiga la blanca), ganás. Si no está marcada, se vuelve a armar.'},
  {k:'threeFouls',def:true,  modes:['9','10'], t:'🚫 Tres faltas seguidas pierden', d:'Si cometés tres faltas seguidas, perdés la partida.'},
  {k:'railRule',  def:true,  modes:['8','9','10','rot','kelly'], t:'🧱 Banda después del choque', d:'Si no metés ninguna bola, alguna tiene que tocar una banda después del choque. Si no, es falta.'},
];
const RACES=[{v:1,t:'Una sola partida'},{v:2,t:'Al mejor de 3 (gana 2)'},{v:3,t:'Al mejor de 5 (gana 3)'},{v:5,t:'Al mejor de 9 (gana 5)'}];
const AIMS=[{v:'larga',t:'🟢 Fácil (línea larga: muestra a dónde van las dos bolas)'},{v:'corta',t:'🟡 Medio (línea corta, no muestra a dónde van)'},{v:'nada',t:'🔴 Experto (sin ninguna ayuda)'}];
const AIM_MEDIO=40; // hasta dónde llega la línea en el nivel medio (cm)
const BOTLV=[{v:'facil',t:'🙂 Fácil'},{v:'normal',t:'😎 Normal'},{v:'crack',t:'🔥 Crack'}];
function defaultOpts(){ const o={mode:'8', fmt:'ind', race:1, aim:'corta', bot:'normal', rotTarget:61}; HOUSE.forEach(h=>o[h.k]=h.def); return o; }

let S=null;
const EMOJIS=['🎱','🧉','🥯','🐆','🌸','🎻','⚽','🐂','🌽','🦜','🐊','🦩','🍖','🌵','🎸','🐎','🦋','🌞','🍉','🦉'];
const PCOLORS=['#e63946','#1d70d6','#2a9d3f','#e9a100','#8e44ad','#ff7f11','#13a8a8','#c2185b'];
const TEAMS=[{n:'Equipo Rojo', e:'🔴', c:'#e63946'}, {n:'Equipo Azul', e:'🔵', c:'#1d70d6'}];
const BOT_NAMES=[['Don Taco','🎱'],['Ña Tiza','🌸'],['Karai Banda','🧉'],['Chulo Efecto','😎'],['Ña Carambola','🦋'],['Don Tronera','🐆'],['Pombero','👹'],['Kuñataĩ Billa','🦜']];
const MAXP=8;
const P = id => S && S.players.find(p=>p.id===id);
const OB = id => S && (S.observers||[]).find(o=>o.id===id);

function lobbyState(){
  return {v:1, phase:'lobby', seq:0, players:[], observers:[], hostPid:null, opts:defaultOpts(), grules:'', sugs:[], log:[],
    sides:[], cur:0, balls:[], bih:null, breakShot:true, rack:0, breaker:0, shot:null, shotN:0, busyUntil:0, rackWin:null, open:true};
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
  if(S.players.length>=MAXP) return 'Ya son 8 jugadores (el máximo).';
  const free=BOT_NAMES.filter(([n])=>!S.players.some(p=>p.name===n));
  const [n,e]=free.length?free[rnd(free.length)]:['Bot '+(S.players.length+1),'🤖'];
  const b=addPlayer(n, e, null, null, true);
  sysChat(`🤖 ${b.name} se sumó a la mesa.`);
}
function log(x){ S.log.push({x, at:Date.now()}); if(S.log.length>200) S.log.splice(0, S.log.length-200); }

/* ---------- lados (jugadores o equipos) y turnos ---------- */
function buildSides(){
  const o=S.opts;
  if(o.fmt==='eq'){
    S.sides=[0,1].map(t=>({team:t, pids:S.players.filter(p=>p.team===t).map(p=>p.id), k:-1, racks:0, pts:0, fouls:0, group:null, last:null, secret:null, out:false}));
  } else S.sides=S.players.map(p=>({team:null, pids:[p.id], k:-1, racks:0, pts:0, fouls:0, group:null, last:null, secret:null, out:false}));
}
function sideName(st, i){
  const s=st.sides[i]; if(!s) return '?';
  if(s.team!=null) return TEAMS[s.team].e+' '+TEAMS[s.team].n;
  const p=st.players.find(x=>x.id===s.pids[0]); return p ? p.name : '?';
}
function sideOfPid(st, pid){ return st.sides.findIndex(s=>s.pids.includes(pid)); }
function shooterOf(st){ const s=st.sides[st.cur]; if(!s || !s.pids.length) return null; return s.pids[((s.k%s.pids.length)+s.pids.length)%s.pids.length]; }
function startInning(st, i){ st.cur=i; const s=st.sides[i]; s.k++; }
function nextSideIdx(st, from){
  const n=st.sides.length;
  for(let k=1;k<=n;k++){ const i=(from+k)%n; if(!st.sides[i].out && st.sides[i].pids.length) return i; }
  return from;
}
function startGame(){
  buildSides(); S.rack=0; S.breaker=rnd(S.sides.length); S.phase='play'; S.startedAt=Date.now();
  newRack();
}
function newRack(){
  const o=S.opts; S.rack++;
  S.balls=rackBalls(o.mode); S.breakShot=true; S.open=true; S.rackWin=null; S.shot=null;
  S.sides.forEach(s=>{ s.group=null; s.last=null; s.fouls=0; s.out=false; if(o.mode==='rot') s.pts=0; });
  if(o.mode==='kelly'){ const nums=shuffle([...Array(15)].map((_,i)=>i+1)); S.sides.forEach(s=>s.secret=nums.pop()); }
  if(S.sides[S.breaker].out) S.breaker=nextSideIdx(S, S.breaker);
  startInning(S, S.breaker);
  S.bih={zone:'head'};   // la salida: blanca detrás de la línea
  S.phase='play';
  log(`🎱 Partida ${S.rack}: ${MODES[o.mode].t}. Sale ${sideName(S, S.cur)}.`);
}
const onTable = (st, n) => st.balls.some(b=>b.n===n && !b.in);
const objectsOn = st => st.balls.filter(b=>b.n && !b.in).map(b=>b.n).sort((a,b)=>a-b);
const groupNums = g => g==='L' ? [1,2,3,4,5,6,7] : g==='R' ? [9,10,11,12,13,14,15] : [];
const groupName = g => g==='L' ? 'lisas' : g==='R' ? 'rayadas' : '';
// bolas que se pueden tocar primero
function legalFirst(st){
  const m=st.opts.mode, on=objectsOn(st);
  if(m==='libre') return on;
  if(m==='8'){
    const s=st.sides[st.cur];
    if(!s.group) return st.breakShot ? on : on.filter(n=>n!==8);
    const mine=groupNums(s.group).filter(n=>on.includes(n));
    return mine.length ? mine : [8];
  }
  return on.length ? [on[0]] : [];
}
const needsCall = st => st.opts.mode==='8' && st.opts.call8 && !st.breakShot && legalFirst(st).length===1 && legalFirst(st)[0]===8;

/* ---------- resolver el resultado de un tiro (st puede ser una copia para que el bot pruebe) ---------- */
function resolveShot(st, sim, call, quiet){
  const o=st.opts, m=o.mode, info=sim.info, side=st.sides[st.cur], name=sideName(st, st.cur);
  const L = quiet ? ()=>{} : x=>{ st.log.push({x, at:Date.now()}); if(st.log.length>200) st.log.shift(); };
  const before=objectsOn(st), legal=legalFirst(st), brk=st.breakShot, wasOpen=m==='8' && !side.group;
  st.balls=sim.balls.map(b=>({n:b.n, x:b.x, y:b.y, in:b.in}));
  const pot=info.potted.map(x=>x.n), objPot=pot;
  const res={foul:null, keep:false, win:null, lose:false, msg:''};
  const lowName = n => n===8 ? 'la 8' : 'la '+n;
  // ---- faltas comunes ----
  if(m!=='libre'){
    if(info.cueIn) res.foul='la blanca cayó en la tronera';
    else if(info.first==null) res.foul='la blanca no tocó ninguna bola';
    else if(!legal.includes(info.first)) res.foul = m==='8'
        ? (side.group ? (legal[0]===8 ? 'había que tocar primero la 8' : `tocó primero una bola que no era de sus ${groupName(side.group)}`) : 'no se puede tocar primero la 8 con la mesa abierta')
        : `había que tocar primero ${lowName(legal[0])}`;
    else if(o.railRule && !brk && !objPot.length && !info.railAfter) res.foul='ninguna bola tocó banda después del choque';
  }
  const nextSide=()=>{ const n=nextSideIdx(st, st.cur); startInning(st, n); };
  const setBih=()=>{ st.bih={zone: o.bihHead ? 'head' : 'all'}; if(info.cueIn || st.balls.find(b=>b.n===0).in){ const c=st.balls.find(b=>b.n===0); c.in=false; c.x=HEAD_X; c.y=MID_Y; } };
  st.breakShot=false;

  if(m==='libre'){
    if(info.cueIn){ const c=st.balls.find(b=>b.n===0); c.in=false; c.x=HEAD_X; c.y=MID_Y; st.bih={zone:'all'}; } else st.bih=null;
    res.keep = objPot.length>0 && !info.cueIn;
    res.msg = objPot.length ? `Entró ${objPot.map(n=>'la '+n).join(', ')}.` : info.cueIn ? 'Cayó la blanca.' : '';
    if(!res.keep && st.sides.length>1) nextSide();
    if(!objectsOn(st).length){ res.msg+=' ¡Mesa limpia! 🎉'; st.rackWin={side:st.cur, why:'limpió la mesa', libre:true}; st.phase='rackEnd'; }
    if(res.msg) L(`${name}: ${res.msg}`);
    return res;
  }

  if(m==='8'){
    const ownBefore = side.group ? groupNums(side.group).filter(n=>before.includes(n)).length : null;
    const eight = info.potted.find(x=>x.n===8);
    if(eight){
      if(brk){
        if(o.eightBreakWin && !info.cueIn){ res.win=st.cur; res.msg='¡metió la 8 en la salida!'; }
        else { res.rerack=true; res.msg='la 8 entró en la salida: se vuelve a armar'; }
      } else if(!res.foul && side.group && ownBefore===0
              && (!o.call8 || call===eight.p) && (!o.samePocket || side.last==null || side.last===eight.p)){
        res.win=st.cur; res.msg='¡metió la 8!';
      } else {
        res.lose=true;
        res.msg = res.foul ? `metió la 8 con falta (${res.foul})` : !side.group || ownBefore>0 ? 'metió la 8 antes de tiempo'
          : o.call8 && call!==eight.p ? `la 8 entró en otra tronera (había cantado ${POCKETS[call]?POCKETS[call].n:'—'})` : 'la 8 no entró en la tronera de su última bola';
      }
    }
    if(res.win==null && !res.lose && !res.rerack){
      // asignar grupos con la mesa abierta
      if(!side.group && !brk && !res.foul && objPot.length){
        const g = objPot[0]<8 ? 'L' : 'R';
        st.sides.forEach((s,i)=>{ s.group = (i===st.cur) === true ? g : (g==='L'?'R':'L'); });
        st.open=false;
        L(`🎱 ${name} va con las ${groupName(g)}.`);
      }
      const g=side.group;
      for(const x of info.potted){ if(g && groupNums(g).includes(x.n)) side.last=x.p; else { const os=st.sides.find(s=>s.group && groupNums(s.group).includes(x.n)); if(os) os.last=x.p; } }
      if(res.foul) res.keep=false;
      else if(brk) res.keep=objPot.length>0;
      else if(wasOpen) res.keep=objPot.length>0;
      else res.keep=objPot.some(n=>groupNums(g).includes(n));
    }
  }
  else if(m==='9' || m==='10'){
    const money = m==='9' ? 9 : 10;
    if(pot.includes(money)){
      if(res.foul || (m==='10' && brk)){ spotBall(st, money); if(!res.foul) res.msg=`la ${money} en la salida vuelve a la mesa`; }
      else { res.win=st.cur; res.msg=`¡metió la ${money}!`; }
    }
    if(res.win==null) res.keep = !res.foul && objPot.length>0;
    if(res.foul){ side.fouls++; if(o.threeFouls && side.fouls>=3){ res.lose=true; res.msg='tres faltas seguidas'; } }
    else side.fouls=0;
  }
  else if(m==='rot'){
    if(res.foul){ objPot.forEach(n=>spotBall(st, n)); }
    else { const p=objPot.reduce((a,b)=>a+b,0); side.pts+=p; if(p) res.msg=`suma ${p} punto${p===1?'':'s'} (tiene ${side.pts})`; res.keep=objPot.length>0;
      if(side.pts>=o.rotTarget){ res.win=st.cur; res.msg=`¡llegó a ${side.pts} puntos!`; } }
    if(res.win==null && !objectsOn(st).length){
      let bi=0; st.sides.forEach((s,i)=>{ if(s.pts>st.sides[bi].pts) bi=i; });
      res.endWin=bi; res.msg+=' · no quedan bolas';
    }
  }
  else if(m==='kelly'){
    if(res.foul){ objPot.forEach(n=>spotBall(st, n)); }
    else {
      for(const n of objPot){
        const oi=st.sides.findIndex(s=>s.secret===n && !s.out);
        if(oi===st.cur){ res.win=st.cur; res.msg=`¡metió su bola secreta, la ${n}!`; break; }
        if(oi>=0){ st.sides[oi].out=true; L(`💥 ${name} metió la ${n}: era la bola secreta de ${sideName(st, oi)}, que queda afuera.`); }
      }
      res.keep=objPot.length>0;
      const alive=st.sides.map((s,i)=>i).filter(i=>!st.sides[i].out);
      if(res.win==null && alive.length===1){ res.endWin=alive[0]; res.msg = alive[0]===st.cur ? 'quedó solo en la mesa' : `gana ${sideName(st, alive[0])}, el último que queda`; }
      if(res.win==null && res.endWin==null && !objectsOn(st).length){ res.endWin=st.cur; }
    }
  }

  // ---- después del tiro ----
  const potTxt = objPot.length ? `metió ${objPot.map(n=>'la '+n).join(', ')}` : '';
  if(res.rerack){
    L(`🔁 ${name}: ${res.msg}.`); if(!quiet){ st.balls=rackBalls(m); st.breakShot=true; st.bih={zone:'head'}; }
    return res;
  }
  if(res.win!=null || res.lose || res.endWin!=null){
    const w = res.win!=null ? res.win : res.endWin!=null ? res.endWin : nextSideIdx(st, st.cur);
    if(res.lose && st.sides.length>2 && m!=='8'){ /* con más de dos, gana el siguiente */ }
    L(`${res.lose?'❌':'🏆'} ${name}${potTxt?' '+potTxt+',':''} ${res.msg}${res.lose?` · gana ${sideName(st, w)}`:''}`);
    if(!quiet) rackOver(st, w, res.lose || res.win==null ? `${name}: ${res.msg.replace(/^ · /,'')}` : `${sideName(st,w)} ${res.msg}`);
    res.rackWinner=w;
    return res;
  }
  if(res.foul){
    L(`🚫 Falta de ${name}: ${res.foul}.${potTxt?' ('+potTxt+')':''}`);
    nextSide(); setBih();
    res.msg=`Falta: ${res.foul}`;
  } else {
    st.bih=null;
    if(res.keep) L(`✅ ${name} ${potTxt}${res.msg?' · '+res.msg:''} y sigue tirando.`);
    else { L(`➡️ ${name} ${potTxt?potTxt+', pero ':''}no metió${potTxt?' ninguna suya':' nada'}. Turno de ${sideName(st, nextSideIdx(st, st.cur))}.`); nextSide(); }
  }
  return res;
}
function rackOver(st, w, why){
  st.sides[w].racks++;
  st.rackWin={side:w, why, at:Date.now()};
  st.phase = st.sides[w].racks>=st.opts.race ? 'over' : 'rackEnd';
  st.breaker = nextSideIdx(st, st.breaker);
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
      if(S.phase==='play' || S.phase==='rackEnd') return 'Esperá a que termine la serie para sentarte.';
      if(S.players.length>=MAXP) return 'La mesa está llena.';
      if(o.owner) return;
      S.observers=S.observers.filter(x=>x!==o);
      const np=addPlayer(o.name, o.emoji==='👀'?EMOJIS.find(e=>!S.players.some(q=>q.emoji===e)):o.emoji, o.token, o.peerId);
      np.conn=o.conn;
      if(typeof onSeatChange==='function') onSeatChange(pid, np.id);
      sysChat(`🪑 ${np.name} se sentó a jugar.`); commit(); return;
    }
  }
  if(!p) return;
  const host = pid===S.hostPid || NET.mode==='local';
  switch(a.type){
    case 'addBot': if(!host||S.phase!=='lobby') return; { const r=addBot(); if(r) return r; } commit(); return;
    case 'addLocal': {   // otro jugador en este mismo aparato
      if(NET.mode!=='local' || S.phase!=='lobby') return;
      if(S.players.length>=MAXP) return 'Ya son 8 jugadores.';
      const nm=String(a.name||'').trim().slice(0,16); if(!nm) return;
      const emo=EMOJIS.find(e=>!S.players.some(q=>q.emoji===e))||'🎱';
      const np=addPlayer(nm, emo, null, null, false, true); np.conn=true;
      sysChat(`🙋 ${np.name} juega en este aparato.`); commit(); return;
    }
    case 'team': {
      if(S.phase!=='lobby') return;
      const t=P(a.pid); if(!t || (!host && t.id!==pid)) return;
      t.team = t.team ? 0 : 1; commit(); return;
    }
    case 'kick': {
      if(!host) return; const t=P(a.pid); if(!t || t.id===S.hostPid) return;
      removePlayer(t, `🚪 ${t.name} salió de la mesa.`); commit(); return;
    }
    case 'botify': {
      if(!host) return; const t=P(a.pid); if(!t || t.bot) return;
      t.bot=true; t.conn=false; t.mic=false; t.token=null; sysChat(`🤖 Un bot sigue tirando por ${t.name}.`); commit(); return;
    }
    case 'opt': {
      if(!host || S.phase!=='lobby') return;
      if(a.k==='mode' && MODES[a.v]) S.opts.mode=a.v;
      else if(a.k==='fmt' && FORMATS[a.v]) S.opts.fmt=a.v;
      else if(a.k==='race') S.opts.race=Math.max(1,Math.min(9,+a.v||1));
      else if(a.k==='aim' && AIMS.some(x=>x.v===a.v)) S.opts.aim=a.v;
      else if(a.k==='bot' && BOTLV.some(x=>x.v===a.v)) S.opts.bot=a.v;
      else if(a.k==='rotTarget') S.opts.rotTarget=Math.max(20,Math.min(120,+a.v||61));
      else if(HOUSE.some(h=>h.k===a.k)) S.opts[a.k]=!!a.v;
      commit(); return;
    }
    case 'grules': if(!host) return; S.grules=String(a.text||'').slice(0,1200); commit(); return;
    case 'sugDel': if(!host) return; S.sugs=S.sugs.filter(s=>s.id!==a.id); commit(); return;
    case 'start': {
      if(!host || S.phase!=='lobby') return;
      const r=canStart(); if(r) return r;
      startGame(); sysChat(`🎱 ¡Empieza! ${MODES[S.opts.mode].t}. Sale ${sideName(S,S.cur)}.`); commit(); return;
    }
    case 'nextRack': if(!host || S.phase!=='rackEnd') return; newRack(); commit(); return;
    case 'rematch': if(!host || S.phase!=='over') return; startGame(); sysChat('🔁 ¡Revancha! Empieza otra serie.'); commit(); return;
    case 'rerack': {   // en modo libre: volver a armar
      if(!host || S.phase==='lobby' || S.opts.mode!=='libre') return;
      S.phase='play'; newRack(); commit(); return;
    }
    case 'newGame': if(!host || (S.phase!=='over' && S.phase!=='rackEnd' && S.opts.mode!=='libre' && !a.force)) return;
      S.phase='lobby'; S.log=[]; S.sides=[]; S.balls=[]; S.shot=null; S.rackWin=null; commit(); return;
    case 'leave': {
      if(S.phase==='lobby' || S.phase==='over') removePlayer(p, `🚪 ${p.name} se fue.`);
      else { p.bot=true; p.conn=false; p.mic=false; p.token=null; sysChat(`🚪 ${p.name} se fue: un bot 🤖 tira por él.`); }
      commit(); return;
    }
    case 'place': {   // mover la blanca con bola en mano (para que los demás la vean)
      if(S.phase!=='play' || !S.bih) return;
      if(shooterOf(S)!==pid && !(isLocalCtl(pid) && isLocalCtl(shooterOf(S)))) return;
      const r=placeOk(S, +a.x, +a.y); if(r) return;
      const c=S.balls.find(b=>b.n===0); c.x=+(+a.x).toFixed(2); c.y=+(+a.y).toFixed(2); c.in=false;
      commit(); return;
    }
    case 'shot': {
      if(S.phase!=='play') return;
      const sh=shooterOf(S);
      if(sh!==pid && !(NET.mode==='local' && P(sh) && !P(sh).bot && isLocalCtl(pid))) return 'No es tu turno.';
      if(Date.now() < S.busyUntil-400) return 'Esperá que se queden quietas las bolas.';
      return doShot(a);
    }
  }
}
function canStart(){
  const o=S.opts, n=S.players.length;
  if(o.mode==='libre') return n<1 ? 'Falta al menos un jugador.' : null;
  if(n<2) return 'Hacen falta al menos 2 jugadores (sumá un bot 🤖).';
  if(o.fmt==='eq'){
    const a=S.players.filter(p=>p.team===0).length, b=S.players.filter(p=>p.team===1).length;
    if(!a || !b) return 'Cada equipo necesita al menos un jugador. Tocá 🔴/🔵 al lado de cada nombre para cambiarlo de equipo.';
  } else if(o.mode==='8' && n!==2) return 'La Bola 8 es de dos bandos: con más de 2 jugadores elegí “Por equipos”.';
  if(o.mode==='kelly' && o.fmt==='eq') return 'La Bola secreta se juega cada uno por su cuenta.';
  return null;
}
function placeOk(st, x, y){
  if(!(x>=BR && x<=TL-BR && y>=BR && y<=TW-BR)) return 'Fuera de la mesa.';
  if(st.bih && st.bih.zone==='head' && x>HEAD_X) return 'Con bola en mano tiene que ir detrás de la línea de salida.';
  if(st.balls.some(b=>b.n && !b.in && (b.x-x)**2+(b.y-y)**2 < (2*BR+.05)**2)) return 'Está tocando otra bola.';
  return null;
}
function doShot(a){
  const ang=+a.ang, pow=Math.max(.01, Math.min(1, +a.pow||0));
  if(!isFinite(ang)) return;
  let sa=+a.sa||0, sb=+a.sb||0; const m=Math.hypot(sa,sb); if(m>1){ sa/=m; sb/=m; }
  const cue=S.balls.find(b=>b.n===0);
  if(S.bih && a.cx!=null){
    const r=placeOk(S, +a.cx, +a.cy); if(r) return r;
    cue.x=+a.cx; cue.y=+a.cy; cue.in=false;
  } else if(S.bih){ const r=placeOk(S, cue.x, cue.y); if(r) return r; }
  const call = a.call!=null && POCKETS[+a.call] ? +a.call : null;
  if(needsCall(S) && call==null) return 'Primero cantá la tronera de la 8 (tocá un número de tronera).';
  const before=S.balls.map(b=>({...b}));
  const sim=simulate(S.balls, {dx:Math.cos(ang), dy:Math.sin(ang), v:powerToSpeed(pow), sa, sb});
  const shooterPid=shooterOf(S), side0=S.cur;
  const res=resolveShot(S, sim, call);
  S.shotN++;
  S.shot={n:S.shotN, from:before, tracks:sim.tracks, ev:sim.ev, frames:sim.info.frames, pid:shooterPid, side:side0, ang, pow, sa, sb,
    res:{foul:res.foul, msg:res.msg, keep:res.keep, win:res.win!=null||res.endWin!=null, lose:res.lose, potted:sim.info.potted.map(x=>x.n), cueIn:sim.info.cueIn}};
  S.busyUntil = Date.now() + sim.info.frames/30*1000 + 900;
  commit();
}
function removePlayer(t, msg){
  const wasHost=t.id===S.hostPid;
  if(S.phase==='lobby' || S.phase==='over'){ S.players=S.players.filter(x=>x!==t); }
  else { t.bot=true; t.conn=false; t.token=null; }
  if(NET.mode==='host' && NET.conns[t.id]){ try{ NET.conns[t.id].send({t:'kicked'}); }catch(e){} }
  sysChat(msg); void wasHost;
}

/* ====================== BOTS ====================== */
const BOT={busy:false};
const BOT_TALK={
  good:['¡Adentro! 😎','Eso es tiza y talento 🎱','¡Tomá! 🧉','Limpito 👌'],
  miss:['Uff, por poquito 😅','Se me fue la mano','Esa mesa está torcida 😤','Ahora te toca, a ver'],
  foul:['Upa, perdón 🙈','Bola en mano para vos…','Ni yo sé qué hice 😂'],
  win:['¡Gané! Otra partida? 🏆','Fue suerte… o no 😏'],
};
const pick = a => a[rnd(a.length)];
const autoPlays = p => p && (p.bot || (!p.conn && p.offAt && Date.now()-p.offAt>20000));
const unit=(x,y)=>{ const d=Math.hypot(x,y)||1; return [x/d,y/d]; };
// ¿hay alguna bola en el camino de a → b (que no sean las de "skip")?
function pathClear(st, ax, ay, bx, by, skip){
  const ex=bx-ax, ey=by-ay, L2=ex*ex+ey*ey||1;
  for(const o of st.balls){
    if(o.in || skip.includes(o.n)) continue;
    let t=((o.x-ax)*ex+(o.y-ay)*ey)/L2; if(t<=0 || t>=1) continue;
    const cx=ax+ex*t, cy=ay+ey*t; if((o.x-cx)**2+(o.y-cy)**2 < (2*BR-.2)**2) return false;
  }
  return true;
}
// lista de tiros posibles por geometría: bola, tronera, ángulo, puntaje
function geomShots(st, cx, cy, targets, onlyPocket){
  const out=[];
  for(const n of targets){
    const b=st.balls.find(x=>x.n===n && !x.in); if(!b) continue;
    POCKETS.forEach((pk,pi)=>{
      if(onlyPocket!=null && pi!==onlyPocket) return;
      const A=pk.aim, [ux,uy]=unit(A.x-b.x, A.y-b.y);
      const gx=b.x-ux*2*BR, gy=b.y-uy*2*BR;
      const [cxu,cyu]=unit(gx-cx, gy-cy), cos=cxu*ux+cyu*uy;
      if(cos<.2) return;
      // la tronera del medio no acepta bolas muy de costado
      if(pi===1||pi===4){ if(Math.abs(uy)<.45) return; }
      if(!pathClear(st, cx, cy, gx, gy, [0, n])) return;
      if(!pathClear(st, b.x, b.y, A.x, A.y, [0, n])) return;
      const d1=Math.hypot(gx-cx, gy-cy), d2=Math.hypot(A.x-b.x, A.y-b.y);
      out.push({n, pi, ang:Math.atan2(gy-cy, gx-cx), d1, d2, cos, score: cos*cos*3 - (d1+d2)/250 - (d2>120?.3:0)});
    });
  }
  return out.sort((a,b)=>b.score-a.score);
}
function powFor(g){
  const a=MU_R*G+12;
  const vo=Math.sqrt(2*a*(g.d2+25)), v1=vo/Math.max(.35,g.cos)*1.25, v=Math.sqrt(v1*v1+2*a*g.d1)*1.1;
  return Math.max(.12, Math.min(.92, Math.sqrt(Math.max(0,v-18)/640)));
}
function evalShot(st, shot, call){
  const sim=simulate(st.balls, {dx:Math.cos(shot.ang), dy:Math.sin(shot.ang), v:powerToSpeed(shot.pow), sa:shot.sa||0, sb:shot.sb||0}, true);
  const c=JSON.parse(JSON.stringify({opts:st.opts, sides:st.sides, cur:st.cur, balls:st.balls, breakShot:st.breakShot, bih:st.bih, players:st.players, open:st.open, log:[]}));
  const me=c.cur, myGroup=c.sides[me].group;
  const r=resolveShot(c, sim, call, true);
  let sc=0;
  if(r.rackWinner!=null) sc += r.rackWinner===me ? 1000 : -1000;
  if(r.foul) sc-=220;
  if(r.keep) sc+=120 + sim.info.potted.length*12;
  if(!r.keep && !r.foul && r.rackWinner==null){
    // si no metió, mejor dejarle al otro un tiro difícil
    const cue=c.balls.find(b=>b.n===0), opp=geomShots(c, cue.x, cue.y, legalFirst(c));
    sc -= opp.length ? Math.max(0, opp[0].score)*60 : -20;
  }
  if(r.keep){ const cue=c.balls.find(b=>b.n===0), nx=geomShots(c, cue.x, cue.y, legalFirst(c)); sc += nx.length ? 25+nx[0].score*20 : 0; }
  if(c.opts.mode==='rot' && r.keep) sc+=sim.info.potted.reduce((a,x)=>a+x.n,0)*2;
  void myGroup;
  return sc;
}
function botPlan(){
  const st=S, lv=st.opts.bot, me=st.cur, side=st.sides[me];
  const cue=st.balls.find(b=>b.n===0);
  let targets=legalFirst(st);
  let onlyPocket=null;
  if(st.opts.mode==='8' && st.opts.samePocket && targets.length===1 && targets[0]===8 && side.last!=null) onlyPocket=side.last;
  let cx=cue.x, cy=cue.y;
  // con bola en mano busca un buen lugar para la blanca
  if(st.bih){
    let best=null;
    const tries=[];
    if(st.breakShot){ tries.push([HEAD_X, MID_Y + (rnd(3)-1)*18]); }
    else {
      for(const n of targets){ const b=st.balls.find(x=>x.n===n && !x.in); if(!b) continue;
        POCKETS.forEach((pk,pi)=>{ if(onlyPocket!=null && pi!==onlyPocket) return;
          const [ux,uy]=unit(pk.aim.x-b.x, pk.aim.y-b.y);
          for(const k of [18,32,50]) tries.push([b.x-ux*(2*BR+k), b.y-uy*(2*BR+k)]);
        });
      }
      for(let i=0;i<12;i++) tries.push([BR+rnd(Math.floor((st.bih.zone==='head'?HEAD_X:TL)-2*BR)), BR+rnd(Math.floor(TW-2*BR))]);
    }
    for(const [x,y] of tries){
      if(placeOk(st, x, y)) continue;
      const g=geomShots(st, x, y, targets, onlyPocket)[0];
      const sc = st.breakShot ? 1 : g ? g.score : -5;
      if(!best || sc>best.sc) best={x,y,sc};
    }
    if(best){ cx=best.x; cy=best.y; cue.x=cx; cue.y=cy; }
  }
  // salida: fuerte al vértice
  if(st.breakShot){
    const apex=st.balls.filter(b=>b.n && !b.in).sort((a,b)=>a.x-b.x)[0];
    const ang=Math.atan2(apex.y-cy+(rnd(3)-1)*.4, apex.x-cx);
    return {ang, pow:.9+rnd(10)/100, sa:0, sb:-.1, cx, cy};
  }
  const cands=[];
  const geo=geomShots(st, cx, cy, targets, onlyPocket).slice(0, lv==='facil'?2:lv==='normal'?4:6);
  for(const g of geo){
    const p=powFor(g);
    const vars = lv==='facil' ? [[1,0]] : lv==='normal' ? [[1,0],[1.25,.4],[1,-.45]] : [[1,0],[1.3,.45],[1,-.5],[.8,0],[1.5,-.3]];
    for(const [k,sb] of vars) cands.push({ang:g.ang, pow:Math.min(.95,p*k), sa:0, sb, call:g.pi});
  }
  // tiros de seguridad: directo a la bola, con algunas variantes
  for(const n of targets.slice(0,3)){
    const b=st.balls.find(x=>x.n===n && !x.in); if(!b) continue;
    const base=Math.atan2(b.y-cy, b.x-cx), d=Math.hypot(b.x-cx, b.y-cy);
    for(const off of [0, .03, -.03, .07, -.07]) for(const pw of [.28,.42,.6]) cands.push({ang:base+off, pow:Math.min(.9,pw+d/900), sa:0, sb:0, call:nearestPocket(b.x,b.y)});
  }
  let best=null;
  for(const c of cands){ const sc=evalShot(st, c, c.call) + rnd(10); if(!best || sc>best.sc){ best=c; best.sc=sc; } }
  if(!best){ const o=st.balls.find(b=>b.n && !b.in); best={ang:o?Math.atan2(o.y-cy,o.x-cx):0, pow:.4, sa:0, sb:0, call:0}; }
  const noise = lv==='facil' ? .022 : lv==='normal' ? .008 : .0022;
  best.ang += (Math.random()+Math.random()+Math.random()-1.5)*noise;
  best.pow = Math.max(.08, Math.min(1, best.pow*(1+(Math.random()-.5)*(lv==='crack'?.04:.14))));
  return {ang:best.ang, pow:best.pow, sa:best.sa, sb:best.sb, call:best.call, cx:st.bih?cx:null, cy:st.bih?cy:null};
}
function botTick(){
  if(!S || NET.mode==='client' || BOT.busy) return;
  if(S.phase==='rackEnd' && S.rackWin && !S.rackWin.libre && Date.now()-S.rackWin.at>12000){ newRack(); commit(); return; }   // la próxima partida arranca sola
  if(S.phase!=='play') return;
  const pid=shooterOf(S), p=P(pid);
  if(!autoPlays(p)) return;
  if(Date.now() < S.busyUntil + 600) return;
  BOT.busy=true;
  setTimeout(()=>{
    try{
      if(!S || S.phase!=='play' || shooterOf(S)!==pid) return;
      const plan=botPlan();
      const prev=S.cur;
      act(pid, Object.assign({type:'shot'}, plan));
      if(p.bot && S && S.shot && rnd(3)===0){
        const r=S.shot.res; setTimeout(()=>{ if(!S) return; botChat(p, pick(r.win&&!r.lose?BOT_TALK.win:r.foul?BOT_TALK.foul:r.keep?BOT_TALK.good:BOT_TALK.miss)); }, S.shot.frames/30*1000+300);
      }
      void prev;
    } finally { BOT.busy=false; }
  }, 900+rnd(900));
}
setInterval(botTick, 400);
function botPrivate(bot, from, text){
  setTimeout(()=>{ if(!S) return; addChat(bot.id, pick(['Shhh, estoy concentrado 🎱','Jaja, después hablamos 😏','¿Me estás distrayendo? 😂']), from.id); }, 1200+rnd(1500));
}
