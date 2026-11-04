'use strict';
/* =====================================================================
   Botones PY — fútbol de botones (de mesa) con los clubes de Primera e
   Intermedia de Paraguay. Por turnos: se elige un botón, se lo tira con el
   dedo y tiene que pegarle a la pelota. El anfitrión simula cada tiro y
   manda a todos el recorrido.
   Acá: cancha, física, clubes, reglas, modos y bots.
   ===================================================================== */
function rnd(n){ if(window.crypto && crypto.getRandomValues){ const a=new Uint32Array(1); crypto.getRandomValues(a); return a[0]%n; } return Math.floor(Math.random()*n); }
const pick = a => a[rnd(a.length)];

/* ====================== CLUBES (nombre, ciudad y colores; sin escudos) ======================
   pat: liso, rayas (verticales), horiz (horizontales), franja (una franja al pecho), v, cruz, vivos, mangas, tricolor */
const CLUBS=[
  // ---- Primera División ----
  {k:'olimpia',   n:'Olimpia',             c:'Asunción',      d:'P', a:'#ffffff', b:'#111111', pat:'franja', ap:'El Decano'},
  {k:'cerro',     n:'Cerro Porteño',       c:'Asunción',      d:'P', a:'#c8102e', b:'#0b3d91', pat:'rayas',  ap:'El Ciclón'},
  {k:'libertad',  n:'Libertad',            c:'Asunción',      d:'P', a:'#ffffff', b:'#111111', pat:'rayas',  ap:'El Gumarelo'},
  {k:'guarani',   n:'Guaraní',             c:'Asunción',      d:'P', a:'#f5c400', b:'#111111', pat:'rayas',  ap:'El Aborigen'},
  {k:'nacional',  n:'Nacional',            c:'Asunción',      d:'P', a:'#ffffff', b:'#d52b1e', pat:'tricolor', ap:'La Academia'},
  {k:'luqueno',   n:'Sportivo Luqueño',    c:'Luque',         d:'P', a:'#034ea2', b:'#f5c400', pat:'rayas',  ap:'El Auriazul'},
  {k:'trinidense',n:'Sportivo Trinidense', c:'Asunción',      d:'P', a:'#0b3d91', b:'#f5c400', pat:'cruz',   ap:'El Triki'},
  {k:'ameliano',  n:'Sportivo Ameliano',   c:'Villeta',       d:'P', a:'#ffffff', b:'#1d4fb8', pat:'v',      ap:'La V Azulada'},
  {k:'2demayo',   n:'Sportivo 2 de Mayo',  c:'Pedro Juan Caballero', d:'P', a:'#1d4fb8', b:'#ffffff', pat:'horiz', ap:'El Gallo Norteño'},
  {k:'recoleta',  n:'Recoleta',            c:'Asunción',      d:'P', a:'#f7d417', b:'#111111', pat:'vivos',  ap:'El Canario'},
  {k:'rubionu',   n:'Rubio Ñu',            c:'Asunción',      d:'P', a:'#ffffff', b:'#1a8f3a', pat:'franja', ap:'El Albiverde'},
  {k:'sanlorenzo',n:'Sportivo San Lorenzo',c:'San Lorenzo',   d:'P', a:'#c8102e', b:'#1d4fb8', pat:'rayas',  ap:'El Rayadito'},
  // ---- División Intermedia ----
  {k:'tembetary', n:'Atlético Tembetary',  c:'Villa Elisa',   d:'I', a:'#ffffff', b:'#d52b1e', pat:'vivos',  ap:'El Rojiverde'},
  {k:'aceval',    n:'Benjamín Aceval',     c:'Villa Hayes',   d:'I', a:'#e01b1b', b:'#0033cc', pat:'liso',   ap:'El Decano Chaqueño'},
  {k:'capiata',   n:'Deportivo Capiatá',   c:'Capiatá',       d:'I', a:'#ffe100', b:'#0033cc', pat:'liso',   ap:'Los Auriazules'},
  {k:'santani',   n:'Deportivo Santaní',   c:'San Estanislao',d:'I', a:'#ffffff', b:'#111111', pat:'franja', ap:'El Depor'},
  {k:'encarnacion',n:'Encarnación FC',     c:'Encarnación',   d:'I', a:'#d52b1e', b:'#ffffff', pat:'rayas',  ap:'El Rayo Sureño'},
  {k:'fdlm',      n:'Fernando de la Mora', c:'Asunción',      d:'I', a:'#e00000', b:'#ffffff', pat:'vivos',  ap:'El Matador'},
  {k:'jlm',       n:'General Caballero JLM', c:'Juan León Mallorquín', d:'I', a:'#e01b1b', b:'#ffffff', pat:'liso', ap:'El General del Este'},
  {k:'guairena',  n:'Guaireña',            c:'Villarrica',    d:'I', a:'#ffffff', b:'#5fb3ec', pat:'rayas',  ap:'El Albiceleste'},
  {k:'indep',     n:'Independiente FBC',   c:'Asunción',      d:'I', a:'#ffffff', b:'#0033cc', pat:'franja', ap:'La Máquina Azul'},
  {k:'paraguari', n:'Paraguarí AC',        c:'Paraguarí',     d:'I', a:'#ffffff', b:'#e01b1b', pat:'mangas', ap:'Los Toreros'},
  {k:'resistencia',n:'Resistencia',        c:'Asunción',      d:'I', a:'#77bbff', b:'#d52b1e', pat:'v',      ap:'El Triángulo Rojo'},
  {k:'soldeamerica',n:'Sol de América',    c:'Villa Elisa',   d:'I', a:'#0038a2', b:'#ffffff', pat:'liso',   ap:'El Danzarín'},
  {k:'carapegua', n:'Sportivo Carapeguá',  c:'Carapeguá',     d:'I', a:'#ffffff', b:'#000080', pat:'vivos',  ap:'El Potro'},
  {k:'tacuary',   n:'Tacuary',             c:'Asunción',      d:'I', a:'#ffffff', b:'#111111', pat:'horiz',  ap:'El Buque'},
  {k:'12dejunio', n:'12 de Junio',         c:'Villa Hayes',   d:'I', a:'#000080', b:'#f5c400', pat:'vivos',  ap:'El León Chaqueño'},
  {k:'3denoviembre',n:'3 de Noviembre',    c:'Asunción',      d:'I', a:'#ffffff', b:'#d52b1e', pat:'tricolor', ap:'El Trico'},
];
const CLUB = k => CLUBS.find(c=>c.k===k) || CLUBS[0];
const DIVS={P:'Primera División', I:'División Intermedia'};

/* ====================== CANCHA (en cm de mesa) ======================
   x de -FW a FW (ancho), y de -FL a FL (largo). El lado 0 defiende el arco de y=-FL y ataca hacia arriba. */
const FW=34, FL=52, MARG=6;                 // medio ancho, medio largo, borde de la mesa afuera de las líneas
const BR=2.6, BA=1.25;                      // radio del botón y de la pelota
const GH=8, GD=4.5;                         // medio ancho del arco y profundidad
const KH=2.2, KR=1.2, KY=FL-1.9;            // arquero: medio largo, grosor y dónde se para
const AREA={w:16, d:14}, CHICA={w:8.5, d:5}, PEN=FL-10.5, CIRC=9;
const M_A=.35;                              // la pelota pesa un tercio de un botón
const DT=1/240, SAMPLE=8;                   // 240 pasos por segundo; se guarda una foto cada 8 (30 por segundo)
const flickSpeed = p => 28 + 172*p;         // fuerza del tirito (0..1) → cm/s
const BTN_N = o => +o.size || 5;

// paredes fijas: [ax,ay,bx,by, radio, rebote, tipo]
const SEGS=(()=>{
  const s=[], X=FW+MARG, Y=FL+MARG;
  s.push([-X,-Y, X,-Y, 0,.55,'w'], [-X,Y, X,Y, 0,.55,'w'], [-X,-Y, -X,Y, 0,.55,'w'], [X,-Y, X,Y, 0,.55,'w']);
  for(const sg of [-1,1]){
    s.push([-GH, sg*(FL+GD), GH, sg*(FL+GD), .3,.15,'n']);                 // red de atrás
    s.push([-GH, sg*FL, -GH, sg*(FL+GD), .3,.2,'n'], [GH, sg*FL, GH, sg*(FL+GD), .3,.2,'n']);   // red de los costados
    s.push([-GH, sg*FL, -GH, sg*FL, .7,.6,'p'], [GH, sg*FL, GH, sg*FL, .7,.6,'p']);              // palos
  }
  return s;
})();

/* ====================== FÍSICA ====================== */
// objs: [{x,y,team,ball}] (botones del 0, del 1 y la pelota al final). shot: {i, ang, pow}. kp: x de los arqueros [lado0, lado1]
function simulate(objs, shot, kp, light){
  const O=objs.map((o,i)=>({i, x:o.x, y:o.y, vx:0, vy:0, team:o.team, ball:!!o.ball, r:o.ball?BA:BR, m:o.ball?M_A:1}));
  const ball=O.find(o=>o.ball), sh=O[shot.i], v=flickSpeed(Math.max(0,Math.min(1,shot.pow)));
  sh.vx=Math.cos(shot.ang)*v; sh.vy=Math.sin(shot.ang)*v;
  const keep=[0,1].map(t=>{ const k=Math.max(-GH+KH*.4, Math.min(GH-KH*.4, (kp&&+kp[t])||0)), y=t ? KY : -KY; return [k-KH, y, k+KH, y, KR, .45, 'k', t]; });
  const segs=SEGS.concat(keep);
  const info={first:null, firstAt:null, touched:false, lastTeam:shot.lastTeam!=null?shot.lastTeam:null, goal:null, out:null, frames:0, keeper:null, post:false};
  const tracks=O.map(o=>light?null:[Math.round(o.x*10), Math.round(o.y*10)]), ev=[];
  let step=0, frame=0, endAt=8*240;
  for(; step<endAt; step++){
    let moving=false;
    for(const o of O){
      if(o.vx===0 && o.vy===0) continue;
      moving=true;
      const sp=Math.hypot(o.vx,o.vy), dec=(o.ball ? 30+1.15*sp : 62+1.8*sp)*DT;
      if(sp<=dec || sp<.4){ o.vx=o.vy=0; continue; }
      const k=(sp-dec)/sp; o.vx*=k; o.vy*=k;
      o.x+=o.vx*DT; o.y+=o.vy*DT;
    }
    if(!moving) break;
    // paredes, red, palos y arqueros
    for(const o of O){
      if(o.vx===0 && o.vy===0 && Math.abs(o.x)<FW && Math.abs(o.y)<FL-5) continue;
      for(const s of segs){
        if(s[6]==='k' && !o.ball && Math.abs(o.y)<FL-7) continue;
        const ex=s[2]-s[0], ey=s[3]-s[1], L=ex*ex+ey*ey;
        let t = L ? ((o.x-s[0])*ex+(o.y-s[1])*ey)/L : 0; t=t<0?0:t>1?1:t;
        const cx=s[0]+ex*t, cy=s[1]+ey*t, dx=o.x-cx, dy=o.y-cy, d2=dx*dx+dy*dy, rr=o.r+s[4];
        if(d2>=rr*rr || d2===0) continue;
        const d=Math.sqrt(d2), nx=dx/d, ny=dy/d; o.x=cx+nx*rr; o.y=cy+ny*rr;
        const vn=o.vx*nx+o.vy*ny; if(vn>=0) continue;
        o.vx-=(1+s[5])*vn*nx; o.vy-=(1+s[5])*vn*ny;
        if(o.ball && s[6]==='k'){ info.lastTeam=s[7]; info.keeper=s[7]; }
        if(o.ball && s[6]==='p') info.post=true;
        if(!light && -vn>6) ev.push({f:frame, k:s[6], v:Math.min(1,-vn/220)});
      }
    }
    // choques entre botones y con la pelota (dos pasadas)
    for(let pass=0; pass<2; pass++){
      for(let a=0;a<O.length;a++){ const A=O[a];
        for(let b=a+1;b<O.length;b++){ const B=O[b];
          const dx=B.x-A.x, dy=B.y-A.y, rr=A.r+B.r; if(dx>rr||dx<-rr||dy>rr||dy<-rr) continue;
          const d2=dx*dx+dy*dy; if(d2>=rr*rr || d2===0) continue;
          const d=Math.sqrt(d2), nx=dx/d, ny=dy/d, ov=rr-d, ia=1/A.m, ib=1/B.m;
          A.x-=nx*ov*ia/(ia+ib); A.y-=ny*ov*ia/(ia+ib); B.x+=nx*ov*ib/(ia+ib); B.y+=ny*ov*ib/(ia+ib);
          const rel=(A.vx-B.vx)*nx+(A.vy-B.vy)*ny; if(rel<=0) continue;
          const e = A.ball||B.ball ? .82 : .62, J=(1+e)*rel/(ia+ib);
          A.vx-=J*ia*nx; A.vy-=J*ia*ny; B.vx+=J*ib*nx; B.vy+=J*ib*ny;
          // quién tocó primero el botón que se tiró, y quién tocó la pelota por última vez
          if(info.first==null && (A===sh || B===sh)){ const ot=A===sh?B:A; info.first = ot.ball ? 'ball' : ot.team===sh.team ? 'own' : 'opp'; info.firstAt={x:(A.x+B.x)/2, y:(A.y+B.y)/2, j:ot.i}; }
          if(A.ball||B.ball){ const bt=A.ball?B:A; info.lastTeam=bt.team; info.lastBtn=bt.team; if(bt===sh) info.touched=true; }
          if(!light && pass===0 && rel>5) ev.push({f:frame, k:(A.ball||B.ball)?'b':'c', v:Math.min(1,rel/220)});
        }
      }
    }
    // ¿gol o afuera?
    if(info.goal==null && info.out==null){
      if(Math.abs(ball.x)<GH && Math.abs(ball.y)>FL+BA){ info.goal = ball.y>0 ? 0 : 1; info.goalFrame=frame; endAt=Math.min(endAt, step+170); if(!light) ev.push({f:frame, k:'g', side:info.goal}); }
      else if(Math.abs(ball.x)>FW+BA || (Math.abs(ball.y)>FL+BA && Math.abs(ball.x)>=GH)){
        info.out={x:ball.x, y:ball.y, kind: Math.abs(ball.x)>FW+BA ? 'side' : 'end', lastTeam:info.lastTeam};
        endAt=Math.min(endAt, step+500); if(!light) ev.push({f:frame, k:'o'});
      }
    }
    if(!light && (step+1)%SAMPLE===0){ frame++; O.forEach((o,i)=>tracks[i].push(Math.round(o.x*10), Math.round(o.y*10))); }
  }
  if(!light){
    frame++; O.forEach((o,i)=>tracks[i].push(Math.round(o.x*10), Math.round(o.y*10)));
    for(const t of tracks){ let L=t.length; while(L>2 && t[L-1]===t[L-3] && t[L-2]===t[L-4]) L-=2; t.length=L; }
  }
  info.frames=frame;
  return {objs:O.map(o=>({x:+o.x.toFixed(2), y:+o.y.toFixed(2), team:o.team, ball:o.ball})), info, tracks, ev};
}

/* ====================== OPCIONES ====================== */
const FORMATS={
  duelo:  {t:'🥊 Partido (1 contra 1)', d:'Dos jugadores, cada uno con su club.'},
  parejas:{t:'👥 Parejas (2 contra 2, o más)', d:'Dos equipos: los compañeros se turnan para tirar.'},
  rey:    {t:'👑 Desafío (el que gana se queda)', d:'Juegan de a dos: el que gana se queda y el que pierde va a la fila. Gana el primero que junta las copas.'},
};
const SIZES=[{v:5,t:'5 botones por lado (rápido)'},{v:7,t:'7 botones por lado'},{v:10,t:'10 botones por lado (como en la cancha)'}];
const GOALS=[{v:1,t:'1 gol (gol de oro)'},{v:3,t:'3 goles'},{v:5,t:'5 goles'},{v:7,t:'7 goles'}];
const TIMES=[{v:0,t:'Sin tiempo'},{v:5,t:'5 minutos'},{v:10,t:'10 minutos'},{v:15,t:'15 minutos'}];
const TOQUES=[{v:1,t:'1 toque por turno'},{v:3,t:'3 toques (lo de siempre)'},{v:5,t:'5 toques'}];
const TURNT=[{v:0,t:'Sin apuro'},{v:20,t:'20 segundos para tirar'},{v:40,t:'40 segundos para tirar'}];
const CUPS=[{v:2,t:'2 copas'},{v:3,t:'3 copas'},{v:5,t:'5 copas'}];
const AIMS=[{v:'larga',t:'🟢 Fácil (flecha larga, muestra para dónde sale)'},{v:'corta',t:'🟡 Medio (flecha corta)'},{v:'nada',t:'🔴 Experto (solo la fuerza)'}];
const BOTLV=[{v:'facil',t:'🙂 Fácil'},{v:'normal',t:'😎 Normal'},{v:'crack',t:'🔥 Crack'}];
const HOUSE=[
  {k:'campo',  t:'🏟️ Gol solo desde campo rival', d:'El botón que patea tiene que estar pasando la mitad de la cancha. Si no, el gol no vale y saca el arquero.', def:true},
  {k:'faltas', t:'🟨 Faltas y penales', d:'Si tu botón toca primero uno del rival (antes que la pelota) es falta: tiro libre para el otro. Dentro de tu área es penal.', def:true},
  {k:'arquero',t:'🧤 Arquero a mano', d:'Mientras el otro apunta, movés tu arquero tocando cerca de tu arco. Si no está marcada, el arquero sigue la pelota solo.', def:false},
  {k:'muerte', t:'⚡ Gol de oro si empatan', d:'Si se termina el tiempo empatados, sigue hasta el próximo gol.', def:true},
  {k:'palo',   t:'🥅 Tiro al palo, toque de más', d:'Si la pelota pega en el palo y no entra, el que pateó tiene un toque más.', def:false},
];
function defaultOpts(){ const o={fmt:'duelo', size:5, goals:3, time:0, toques:3, turnT:0, cups:3, aim:'corta', bot:'normal'}; HOUSE.forEach(h=>o[h.k]=h.def); return o; }

let S=null;
const EMOJIS=['⚽','🧉','🥯','🐆','🌸','🎻','🥅','🐂','🌽','🦜','🐊','🦩','🍖','🌵','🎸','🐎','🦋','🌞','🍉','🦉'];
const PCOLORS=['#e63946','#1d70d6','#2a9d3f','#e9a100','#8e44ad','#ff7f11','#13a8a8','#c2185b'];
const TEAMS=[{n:'Equipo A', e:'🅰️'}, {n:'Equipo B', e:'🅱️'}];
const BOT_NAMES=[['Don Botón','⚽'],['Ña Chapita','🌸'],['Karai Gol','🧉'],['Chulo Taquito','😎'],['Ña Palomita','🦋'],['Don Arquero','🐆'],['Pombero','👹'],['Kuñataĩ Crack','🦜']];
const MAXP=8;
const P = id => S && S.players.find(p=>p.id===id);
const OB = id => S && (S.observers||[]).find(o=>o.id===id);

function lobbyState(){
  return {v:1, phase:'lobby', seq:0, players:[], observers:[], hostPid:null, opts:defaultOpts(), grules:'', sugs:[], log:[],
    sides:[], score:[0,0], btn:[[],[]], ball:{x:0,y:0}, kp:[0,0], turn:0, toques:3, set:null, lastTeam:null, shot:null, shotN:0, busyUntil:0,
    endsAt:0, sudden:false, queue:[], cups:{}, matchN:0, win:null, matchWin:null, turnAt:0};
}
function addPlayer(name, emoji, token, peerId, bot, local){
  const used=S.players.map(p=>p.color), t0=S.players.filter(p=>p.team===0).length, t1=S.players.filter(p=>p.team===1).length;
  const taken=S.players.map(p=>p.club), freeC=CLUBS.filter(c=>!taken.includes(c.k));
  const p={id:'p'+(++S.seq), name:(String(name||'').trim()||'Jugador').slice(0,16), emoji, token, peerId,
    color:PCOLORS.find(c=>!used.includes(c))||PCOLORS[S.players.length%PCOLORS.length],
    conn:!bot, bot:!!bot, local:!!local, mic:false, team: t0<=t1 ? 0 : 1, club:(freeC.length?pick(freeC):pick(CLUBS)).k};
  S.players.push(p); return p;
}
function addBot(){
  if(S.players.length>=MAXP) return 'Ya son 8 jugadores (el máximo).';
  const free=BOT_NAMES.filter(([n])=>!S.players.some(p=>p.name===n));
  const [n,e]=free.length?free[rnd(free.length)]:['Bot '+(S.players.length+1),'🤖'];
  const b=addPlayer(n, e, null, null, true);
  sysChat(`🤖 ${b.name} se sumó con ${CLUB(b.club).n}.`);
}
function log(x){ S.log.push({x, at:Date.now()}); if(S.log.length>200) S.log.splice(0, S.log.length-200); }
// el club de un lado: el del primer jugador de ese lado
function sideClub(st, i){ const s=st.sides[i]; const p=s && st.players.find(x=>x.id===s.pids[0]); return CLUB(p ? p.club : CLUBS[i].k); }
// colores que se ven en la cancha (si los dos usan los mismos colores, el de arriba se pone la camiseta alternativa)
function sideKit(st, i){
  const c=sideClub(st, i); if(i===0 || !st.sides[0]) return {a:c.a, b:c.b, pat:c.pat};
  const o=sideClub(st, 0); return (c.k===o.k || (c.a===o.a && c.b===o.b)) ? {a:c.b, b:c.a, pat:c.pat==='liso'?'vivos':c.pat, alt:true} : {a:c.a, b:c.b, pat:c.pat};
}
function sideName(st, i){
  const s=st.sides[i]; if(!s) return '?';
  const names=s.pids.map(id=>{ const p=st.players.find(x=>x.id===id); return p?p.name:'?'; });
  return `${sideClub(st,i).n} (${names.join(' y ')})`;
}
const clubName = (st, i) => sideClub(st, i).n;
const sideOf = (st, pid) => st.sides.findIndex(s=>s.pids.includes(pid));
const playing = (st, pid) => sideOf(st, pid)>=0;
function shooterOf(st){ const s=st.sides[st.turn]; if(!s || !s.pids.length) return null; return s.pids[((s.k%s.pids.length)+s.pids.length)%s.pids.length]; }

/* ---------- formaciones (para el lado 0; el lado 1 es el espejo) ---------- */
const FORM={
  5:[[-12,-38],[12,-38],[0,-26],[-17,-11],[17,-11]],
  7:[[-14,-40],[14,-40],[0,-32],[-23,-22],[23,-22],[-8,-12],[8,-12]],
  10:[[-24,-40],[-8,-41],[8,-41],[24,-40],[-24,-24],[-8,-26],[8,-26],[24,-24],[-7,-12],[7,-12]],
};
function lineUp(st, kicker){
  const n=BTN_N(st.opts), f=FORM[n]||FORM[5];
  st.btn=[0,1].map(t=>f.map(([x,y])=>({x: t ? -x : x, y: t ? -y : y})));
  // el que saca pone un botón atrás de la pelota
  const k=st.btn[kicker], dir=kicker ? -1 : 1; let bi=0; k.forEach((b,i)=>{ if(Math.abs(b.y)<Math.abs(k[bi].y)) bi=i; });
  k[bi]={x:0, y:-dir*(BR+BA+1.2)};
  st.ball={x:0, y:0}; st.kp=[0,0];
}

/* ---------- partido ---------- */
function startGame(){
  S.cups={}; S.matchN=0; S.win=null; S.startedAt=Date.now();
  if(S.opts.fmt==='rey') S.queue=S.players.map(p=>p.id);
  log(`⚽ Empieza: ${FORMATS[S.opts.fmt].t}.`);
  startMatch();
}
function startMatch(){
  const o=S.opts;
  if(o.fmt==='duelo') S.sides=[{pids:[S.players[0].id], k:-1}, {pids:[S.players[1].id], k:-1}];
  else if(o.fmt==='parejas') S.sides=[0,1].map(t=>({pids:S.players.filter(p=>p.team===t).map(p=>p.id), k:-1}));
  else S.sides=[{pids:[S.queue[0]], k:-1}, {pids:[S.queue[1]], k:-1}];
  S.score=[0,0]; S.sudden=false; S.matchN++; S.matchWin=null; S.phase='play'; S.shot=null; S.lastTeam=null;
  S.endsAt = o.time ? Date.now()+o.time*60000 : 0;
  const k=rnd(2); lineUp(S, k); giveTurn(S, k, {type:'saque'});
  log(`🏟️ Partido ${S.matchN}: ${sideName(S,0)} contra ${sideName(S,1)}. Saca ${clubName(S,k)}.`);
}
function giveTurn(st, side, set){
  if(st.turn!==side || set){ st.sides[side].k++; }
  st.turn=side; st.toques=set && set.type==='penal' ? 1 : st.opts.toques; st.set=set||null; st.turnAt=Date.now();
}
const SETNAME={saque:'⚽ Saque del medio', lateral:'↔️ Lateral', corner:'🚩 Córner', arco:'🧤 Saque de arco', libre:'🟨 Tiro libre', penal:'🎯 ¡Penal!'};

// mueve los botones que tapan una pelota parada (y los del rival, a una distancia)
function clearAround(st, x, y, rivalOf, dist){
  for(const t of [0,1]) st.btn[t].forEach(b=>{
    const need = t===rivalOf ? dist : BR+BA+.4;
    const dx=b.x-x, dy=b.y-y, d=Math.hypot(dx,dy);
    if(d<need){ const ux=d>.01?dx/d:0, uy=d>.01?dy/d:(t?1:-1); b.x=x+ux*need; b.y=y+uy*need; clampBtn(b); }
  });
}
function clampBtn(b){ b.x=Math.max(-FW-MARG+BR, Math.min(FW+MARG-BR, b.x)); b.y=Math.max(-FL+BR*.5, Math.min(FL-BR*.5, b.y)); if(Math.abs(b.x)>FW-BR*.2) b.x=Math.sign(b.x)*(FW-BR*.2); }
function sepButtons(st){
  const all=[...st.btn[0], ...st.btn[1]];
  for(let it=0; it<6; it++) for(let i=0;i<all.length;i++) for(let j=i+1;j<all.length;j++){
    const a=all[i], b=all[j], dx=b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy)||.01;
    if(d<2*BR+.1){ const k=(2*BR+.1-d)/2/d; a.x-=dx*k; a.y-=dy*k; b.x+=dx*k; b.y+=dy*k; clampBtn(a); clampBtn(b); }
  }
}

/* ---------- resultado de un tiro (st puede ser una copia, para que el bot pruebe) ---------- */
function resolveShot(st, sim, sh, quiet){
  const o=st.opts, info=sim.info, s=st.turn, opp=1-s, n=BTN_N(o);
  const L = quiet ? ()=>{} : x=>{ st.log.push({x, at:Date.now()}); if(st.log.length>200) st.log.shift(); };
  const from=st.btn[s][sh.j], fromY=from.y, wasSet=st.set;
  st.btn=[0,1].map(t=>st.btn[t].map((b,j)=>{ const q=sim.objs[t*n+j]; return {x:q.x, y:q.y}; }));
  const bq=sim.objs[2*n]; st.ball={x:bq.x, y:bq.y};
  if(info.lastTeam!=null) st.lastTeam=info.lastTeam;
  const res={goal:null, foul:null, keep:false, msg:'', set:null};
  const nm=clubName(st, s), on=clubName(st, opp);
  // ---- gol ----
  if(info.goal!=null){
    const scorer=info.goal, own = info.lastBtn!=null && info.lastBtn!==scorer;
    const fromOwnHalf = (s===0 ? fromY<0 : fromY>0);
    if(o.campo && scorer===s && fromOwnHalf && !own && !(wasSet && wasSet.type==='penal')){
      res.msg='¡Gol no válido! Hay que patear desde campo rival.'; L(`❌ ${nm}: ${res.msg} Saca el arquero de ${on}.`);
      const sg = opp ? 1 : -1; st.ball={x:6*(Math.sign(st.ball.x)||1), y:sg*(FL-6)};
      clearAround(st, st.ball.x, st.ball.y, s, 9); sepButtons(st); giveTurn(st, opp, {type:'arco'}); res.set='arco'; return res;
    }
    st.score[scorer]++; res.goal=scorer; res.own=own;
    L(`⚽ ${own ? `¡Gol en contra de ${clubName(st,1-scorer)}! La metió en su propio arco.` : `¡GOOOL de ${clubName(st,scorer)}!`} ${clubName(st,0)} ${st.score[0]} - ${st.score[1]} ${clubName(st,1)}.`);
    if(!quiet) checkEnd(st, true);
    if(st.phase==='play'){ lineUp(st, 1-scorer); giveTurn(st, 1-scorer, {type:'saque'}); res.set='saque'; }
    return res;
  }
  // ---- falta ----
  if(o.faltas && info.first==='opp'){
    const at=info.firstAt, myGoalY = s ? FL : -FL, inArea = Math.abs(at.x)<AREA.w && Math.abs(at.y-myGoalY)<AREA.d;
    if(inArea){
      res.foul='penal'; res.msg=`Falta de ${nm} dentro del área: ¡penal para ${on}!`; L(`🎯 ${res.msg}`);
      const sg = s ? 1 : -1; st.ball={x:0, y:sg*PEN};
      // todos afuera del área, y un botón del que patea atrás de la pelota
      for(const t of [0,1]) st.btn[t].forEach(b=>{ if(Math.abs(b.x)<AREA.w+BR && sg*b.y>FL-AREA.d-BR){ b.y=sg*(FL-AREA.d-BR-1); } });
      const kb=st.btn[opp]; let bi=0, bd=1e9; kb.forEach((b,i)=>{ const d=Math.hypot(b.x-st.ball.x, b.y-st.ball.y); if(d<bd){ bd=d; bi=i; } });
      kb[bi]={x:0, y:sg*(PEN-(BR+BA+2))}; st.kp[s]=0;
      sepButtons(st); giveTurn(st, opp, {type:'penal'}); res.set='penal'; return res;
    }
    res.foul='libre'; res.msg=`Falta de ${nm}: tiro libre para ${on}.`; L(`🟨 ${res.msg}`);
    st.ball={x:Math.max(-FW+BA, Math.min(FW-BA, at.x)), y:Math.max(-FL+BA+1, Math.min(FL-BA-1, at.y))};
    clearAround(st, st.ball.x, st.ball.y, s, 9); sepButtons(st); giveTurn(st, opp, {type:'libre'}); res.set='libre'; return res;
  }
  // ---- afuera ----
  if(info.out){
    const ox=info.out.x, oy=info.out.y, lt=info.out.lastTeam!=null ? info.out.lastTeam : s;
    if(info.out.kind==='side'){
      const t=1-lt; st.ball={x:Math.sign(ox)*(FW-BA), y:Math.max(-FL+2, Math.min(FL-2, oy))};
      res.msg=`Lateral para ${clubName(st,t)}.`; L(`↔️ ${res.msg}`); clearAround(st, st.ball.x, st.ball.y, 1-t, 6); sepButtons(st); giveTurn(st, t, {type:'lateral'}); res.set='lateral';
      if(t===s) res.keep=true; return res;
    }
    const def = oy>0 ? 1 : 0;   // el lado que defiende ese arco
    if(lt===def){ const t=1-def; st.ball={x:Math.sign(ox||1)*(FW-BA-.4), y:Math.sign(oy)*(FL-BA-.4)}; res.msg=`Córner para ${clubName(st,t)}.`; L(`🚩 ${res.msg}`); clearAround(st, st.ball.x, st.ball.y, def, 7); sepButtons(st); giveTurn(st, t, {type:'corner'}); res.set='corner'; if(t===s) res.keep=true; return res; }
    st.ball={x:6*(Math.sign(ox)||1), y:Math.sign(oy)*(FL-6)}; res.msg=`Saque de arco para ${clubName(st,def)}.`; L(`🧤 ${res.msg}`);
    clearAround(st, st.ball.x, st.ball.y, 1-def, 9); sepButtons(st); giveTurn(st, def, {type:'arco'}); res.set='arco'; if(def===s) res.keep=true; return res;
  }
  // botones que quedaron afuera vuelven a la línea
  for(const t of [0,1]) st.btn[t].forEach(b=>{ if(Math.abs(b.x)>FW-BR*.2) b.x=Math.sign(b.x)*(FW-BR*.2); if(Math.abs(b.y)>FL-BR*.5) b.y=Math.sign(b.y)*(FL-BR*.5); });
  sepButtons(st);
  // ---- jugada normal: si tu botón tocó la pelota seguís (hasta los toques del turno) ----
  if(info.touched){
    st.toques--; st.set=null;
    if(o.palo && info.post) st.toques++;
    if(st.toques>0){ res.keep=true; res.msg=`Le pegó: le queda${st.toques>1?'n':''} ${st.toques} toque${st.toques>1?'s':''}.`; }
    else { res.msg='Se terminaron los toques.'; giveTurn(st, opp); }
  } else {
    res.msg = info.first==='own' ? 'Le pegó a un compañero y no a la pelota.' : 'No tocó la pelota.';
    giveTurn(st, opp);
  }
  if(!res.keep) L(`➡️ ${nm}: ${res.msg} Turno de ${on}.`);
  return res;
}
// ¿se terminó el partido? (por goles o por tiempo)
function checkEnd(st, afterGoal){
  const o=st.opts;
  if(st.score[0]>=o.goals || st.score[1]>=o.goals) return endMatch(st.score[0]>st.score[1]?0:1);
  if(st.sudden && afterGoal) return endMatch(st.score[0]>st.score[1]?0:1);
  if(st.endsAt && Date.now()>=st.endsAt && !st.sudden){
    if(st.score[0]!==st.score[1]) return endMatch(st.score[0]>st.score[1]?0:1);
    if(o.muerte){ st.sudden=true; log('⚡ ¡Se terminó el tiempo empatados: gol de oro!'); return; }
    return endMatch(-1);
  }
}
function endMatch(win){
  const o=S.opts; S.matchWin={side:win, at:Date.now(), score:S.score.slice()};
  if(win<0){ log(`🤝 Empate ${S.score[0]} a ${S.score[1]}.`); S.phase='over'; return; }
  log(`🏆 ${sideName(S,win)} gana ${S.score[win]} a ${S.score[1-win]}.`);
  if(o.fmt==='rey'){
    const w=S.sides[win].pids[0], l=S.sides[1-win].pids[0];
    S.cups[w]=(S.cups[w]||0)+1;
    if(S.cups[w]>=o.cups){ S.win={pid:w}; S.phase='over'; log(`🏆 ¡${(P(w)||{}).name} levanta la copa!`); return; }
    S.queue=S.queue.filter(x=>x!==w && x!==l); S.queue.unshift(w); S.queue.push(l);
    S.phase='matchEnd'; return;
  }
  S.phase='over';
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
      if(S.phase==='play' || S.phase==='matchEnd') return 'Esperá a que termine la partida para sumarte.';
      if(S.players.length>=MAXP) return 'La mesa está llena.';
      if(o.owner) return;
      S.observers=S.observers.filter(x=>x!==o);
      const np=addPlayer(o.name, o.emoji==='👀'?EMOJIS.find(e=>!S.players.some(q=>q.emoji===e)):o.emoji, o.token, o.peerId);
      np.conn=o.conn; if(typeof onSeatChange==='function') onSeatChange(pid, np.id);
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
      const np=addPlayer(nm, EMOJIS.find(e=>!S.players.some(q=>q.emoji===e))||'⚽', null, null, false, true); np.conn=true;
      sysChat(`🙋 ${np.name} juega en este aparato.`); commit(); return;
    }
    case 'club': {
      if(S.phase!=='lobby') return; const t=P(a.pid||pid); if(!t || (!host && t.id!==pid) || (t.bot && !host)) return;
      if(!CLUBS.some(c=>c.k===a.v)) return; t.club=a.v; commit(); return;
    }
    case 'team': { if(S.phase!=='lobby') return; const t=P(a.pid); if(!t || (!host && t.id!==pid)) return; t.team = t.team ? 0 : 1; commit(); return; }
    case 'order': { if(!host || S.phase!=='lobby') return; const i=S.players.findIndex(x=>x.id===a.pid); if(i>0){ const [x]=S.players.splice(i,1); S.players.splice(i-1,0,x); } commit(); return; }
    case 'kick': { if(!host) return; const t=P(a.pid); if(!t || t.id===S.hostPid) return; removePlayer(t, `🚪 ${t.name} salió de la mesa.`); commit(); return; }
    case 'botify': { if(!host) return; const t=P(a.pid); if(!t || t.bot) return; t.bot=true; t.conn=false; t.mic=false; t.token=null; sysChat(`🤖 Un bot sigue jugando por ${t.name}.`); commit(); return; }
    case 'opt': {
      if(!host || S.phase!=='lobby') return;
      const o=S.opts, v=a.v, has=(L)=>L.some(x=>String(x.v)===String(v));
      if(a.k==='fmt' && FORMATS[v]) o.fmt=v;
      else if(a.k==='size' && has(SIZES)) o.size=+v;
      else if(a.k==='goals' && has(GOALS)) o.goals=+v;
      else if(a.k==='time' && has(TIMES)) o.time=+v;
      else if(a.k==='toques' && has(TOQUES)) o.toques=+v;
      else if(a.k==='turnT' && has(TURNT)) o.turnT=+v;
      else if(a.k==='cups' && has(CUPS)) o.cups=+v;
      else if(a.k==='aim' && has(AIMS)) o.aim=v;
      else if(a.k==='bot' && has(BOTLV)) o.bot=v;
      else if(HOUSE.some(h=>h.k===a.k)) o[a.k]=!!v;
      commit(); return;
    }
    case 'grules': if(!host) return; S.grules=String(a.text||'').slice(0,1200); commit(); return;
    case 'sugDel': if(!host) return; S.sugs=S.sugs.filter(s=>s.id!==a.id); commit(); return;
    case 'start': { if(!host || S.phase!=='lobby') return; const r=canStart(); if(r) return r; startGame(); sysChat(`⚽ ¡Empieza el partido! ${clubName(S,0)} contra ${clubName(S,1)}.`); commit(); return; }
    case 'next': if(!host || S.phase!=='matchEnd') return; startMatch(); commit(); return;
    case 'rematch': if(!host || S.phase!=='over') return; startGame(); sysChat('🔁 ¡Revancha!'); commit(); return;
    case 'newGame': if(!host || (S.phase!=='over' && !a.force)) return; S.phase='lobby'; S.log=[]; S.sides=[]; S.shot=null; S.matchWin=null; S.win=null; commit(); return;
    case 'leave': {
      if(S.phase==='lobby' || S.phase==='over') removePlayer(p, `🚪 ${p.name} se fue.`);
      else { p.bot=true; p.conn=false; p.mic=false; p.token=null; sysChat(`🚪 ${p.name} se fue: un bot 🤖 juega por él.`); }
      commit(); return;
    }
    case 'keeper': {   // mover el arquero (con "arquero a mano")
      if(S.phase!=='play' || !S.opts.arquero) return;
      const sd=sideOf(S, pid); if(sd<0 && !isLocalCtl(pid)) return;
      const t = a.side!=null && isLocalCtl(pid) ? +a.side : sd; if(t!==0 && t!==1 || t===S.turn) return;
      S.kp[t]=Math.max(-GH+KH*.4, Math.min(GH-KH*.4, +a.x||0)); if(typeof relayKeeper==='function') relayKeeper(); return;
    }
    case 'shot': {
      if(S.phase!=='play') return;
      const sh=shooterOf(S);
      if(sh!==pid && !(NET.mode==='local' && P(sh) && !P(sh).bot && isLocalCtl(pid))) return 'No es tu turno.';
      if(Date.now() < S.busyUntil-300) return 'Esperá que se quede quieta la pelota.';
      return doShot(a);
    }
  }
}
function canStart(){
  const o=S.opts, n=S.players.length;
  if(o.fmt==='duelo') return n!==2 ? 'El partido es de 2 jugadores (sumá un bot 🤖 o elegí “Parejas” o “Desafío”).' : null;
  if(o.fmt==='parejas'){
    if(n<2) return 'Hacen falta al menos 2 jugadores.';
    const a=S.players.filter(p=>p.team===0).length, b=S.players.filter(p=>p.team===1).length;
    if(!a || !b) return 'Cada equipo necesita al menos un jugador. Tocá 🅰️/🅱️ para cambiar a alguien de equipo.';
    return null;
  }
  return n<3 ? 'El Desafío es de 3 a 8 jugadores (sumá bots 🤖).' : null;
}
// arquero solo: se para entre la pelota y el centro del arco
function autoKeeper(st, t){ const gy = t ? FL : -FL, b=st.ball, k = b.x * Math.min(1, 12/Math.max(12, Math.abs(gy-b.y)+4)); return Math.max(-GH+KH*.4, Math.min(GH-KH*.4, k)); }
function simObjs(st){ return [...st.btn[0].map(b=>({x:b.x, y:b.y, team:0})), ...st.btn[1].map(b=>({x:b.x, y:b.y, team:1})), {x:st.ball.x, y:st.ball.y, ball:true}]; }
function keepersFor(st){ return [0,1].map(t=>{ if(st.opts.arquero){ const sd=st.sides[t], hp=sd && sd.pids.map(id=>st.players.find(x=>x.id===id)).find(x=>x && !autoPlays(x)); if(hp) return st.kp[t]; } return autoKeeper(st, t); }); }
function doShot(a){
  const ang=+a.ang, pow=Math.max(.02, Math.min(1, +a.pow||0)), j=a.j|0, n=BTN_N(S.opts), s=S.turn;
  if(!isFinite(ang) || j<0 || j>=n) return;
  if(S.set && S.set.type==='penal'){ const b=S.btn[s][j], d=Math.hypot(b.x-S.ball.x, b.y-S.ball.y); if(d>BR+BA+4) return 'En el penal patea el botón que está atrás de la pelota.'; }
  const kp=keepersFor(S); S.kp=kp.slice();
  const before={btn:JSON.parse(JSON.stringify(S.btn)), ball:{...S.ball}, kp:kp.slice()};
  const sim=simulate(simObjs(S), {i:s*n+j, ang, pow, lastTeam:S.lastTeam}, kp);
  const shooterPid=shooterOf(S);
  const res=resolveShot(S, sim, {j});
  S.shotN++;
  S.shot={n:S.shotN, from:before, tracks:sim.tracks, ev:sim.ev, frames:sim.info.frames, pid:shooterPid, side:s, j, ang, pow,
    res:{goal:res.goal, own:!!res.own, foul:res.foul, msg:res.msg, keep:res.keep, set:res.set, post:sim.info.post && res.goal==null, saved:sim.info.keeper!=null && sim.info.keeper!==s && res.goal==null}};
  S.busyUntil = Date.now() + sim.info.frames/30*1000 + (res.goal!=null ? 2200 : 700);
  if(S.phase==='play') checkEnd(S, false);
  commit();
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
  goal:['¡GOOOL! ⚽🔥','¡Adentro, papá! 😎','¡Golazo de botón! 🧉','¡Tomá! Al ángulo 🎯'],
  miss:['Uff, por poquito 😅','Esa cancha está torcida 😤','Se me resbaló el dedo','Ahora te toca'],
  foul:['Upa, perdón 🙈','No le toqué, árbitro 😇','Fue sin querer 😂'],
  save:['¡Qué atajada! 🧤','No pasa nada por acá 🧱'],
};
const autoPlays = p => p && (p.bot || (!p.conn && p.offAt && Date.now()-p.offAt>20000));
// evalúa un tiro en una copia del estado
function evalShot(st, j, ang, pow){
  const n=BTN_N(st.opts), s=st.turn;
  const c=JSON.parse(JSON.stringify({opts:st.opts, sides:st.sides, players:st.players, turn:st.turn, toques:st.toques, set:st.set, btn:st.btn, ball:st.ball, kp:st.kp, score:st.score, lastTeam:st.lastTeam, phase:'play', log:[]}));
  const kp=keepersFor(c);
  const sim=simulate(simObjs(c), {i:s*n+j, ang, pow, lastTeam:c.lastTeam}, kp, true);
  const r=resolveShot(c, sim, {j}, true);
  const dir = s ? -1 : 1, b=c.ball;
  let sc=0;
  if(r.goal!=null) return r.goal===s ? 2000 : -2000;
  if(r.foul) sc -= r.foul==='penal' ? 700 : 160;
  if(r.set==='corner') sc += c.turn===s ? 60 : -60;
  if(r.set==='lateral' || r.set==='arco') sc += c.turn===s ? 10 : -50;
  sc += dir*b.y*1.6;                                     // la pelota más cerca del arco rival
  if(c.turn===s){
    sc += 70;
    // ¿tengo un botón cerca de la pelota para el próximo toque, y del lado bueno?
    let best=1e9; c.btn[s].forEach(q=>{ const d=Math.hypot(q.x-b.x, q.y-b.y) + (dir*(q.y-b.y)>0 ? 10 : 0); if(d<best) best=d; });
    sc -= best*1.2;
    if(dir*b.y>FL-AREA.d && Math.abs(b.x)<AREA.w) sc += 50;
  } else {
    // le dejo la pelota al otro: mejor que la tenga lejos y que no esté cerca de mi arco
    let best=1e9; c.btn[1-s].forEach(q=>{ const d=Math.hypot(q.x-b.x, q.y-b.y); if(d<best) best=d; });
    sc -= Math.max(0, 25-best)*3;
    if(dir*b.y<-FL+AREA.d+6) sc -= 80;
  }
  return sc;
}
function botPlan(){
  const st=S, lv=st.opts.bot, s=st.turn, n=BTN_N(st.opts), dir = s ? -1 : 1, b=st.ball;
  const order=st.btn[s].map((q,j)=>({j, d:Math.hypot(q.x-b.x, q.y-b.y)})).sort((a,c)=>a.d-c.d);
  let cand=order.slice(0, lv==='facil' ? 2 : lv==='normal' ? 4 : 5);
  if(st.set && st.set.type==='penal') cand=order.slice(0,1);
  const targets=[[0, dir*(FL+2)], [-(GH-2.2), dir*(FL+2)], [GH-2.2, dir*(FL+2)], [-(GH-1.5), dir*(FL+2)], [GH-1.5, dir*(FL+2)], [b.x*.4, b.y+dir*25], [b.x+(b.x>0?-14:14), b.y+dir*12]];
  const pows = lv==='facil' ? [.45,.75] : [.3,.5,.7,.9];
  const plans=[];
  for(const {j} of cand){
    const q=st.btn[s][j];
    for(const [tx,ty] of targets){
      let ux=tx-b.x, uy=ty-b.y; const l=Math.hypot(ux,uy)||1; ux/=l; uy/=l;
      const cx=b.x-ux*(BR+BA-.15), cy=b.y-uy*(BR+BA-.15), ang=Math.atan2(cy-q.y, cx-q.x);
      const d=Math.hypot(cx-q.x, cy-q.y);
      for(const p0 of pows){ const pow=Math.min(1, p0+d/260); plans.push({j, ang, pow}); }
    }
    // directo a la pelota
    plans.push({j, ang:Math.atan2(b.y-q.y, b.x-q.x), pow:.55});
  }
  let best=null;
  for(const pl of plans){ const sc=evalShot(st, pl.j, pl.ang, pl.pow) + rnd(lv==='crack'?6:20); if(!best || sc>best.sc){ best=pl; best.sc=sc; } }
  if(!best){ const j=order[0].j, q=st.btn[s][j]; best={j, ang:Math.atan2(b.y-q.y, b.x-q.x), pow:.5}; }
  const noise = lv==='facil' ? .06 : lv==='normal' ? .025 : .008;
  return {j:best.j, ang:best.ang+(Math.random()+Math.random()-1)*noise, pow:Math.max(.05, Math.min(1, best.pow*(1+(Math.random()-.5)*(lv==='crack'?.05:.16))))};
}
function botTick(){
  if(!S || NET.mode==='client' || BOT.busy) return;
  if(S.phase==='matchEnd' && S.matchWin && Date.now()-S.matchWin.at>9000){ startMatch(); commit(); return; }
  if(S.phase!=='play') return;
  // se terminó el tiempo con la pelota quieta
  if(S.endsAt && Date.now()>=S.endsAt && !S.sudden && Date.now()>S.busyUntil){ checkEnd(S, false); if(S.phase!=='play' || S.sudden){ commit(); return; } }
  const pid=shooterOf(S), p=P(pid);
  // tiempo para tirar
  if(S.opts.turnT && !autoPlays(p) && Date.now()>S.busyUntil && Date.now()-Math.max(S.turnAt, S.busyUntil)>S.opts.turnT*1000){
    log(`⏰ A ${clubName(S,S.turn)} se le pasó el tiempo: turno de ${clubName(S,1-S.turn)}.`); giveTurn(S, 1-S.turn); commit(); return;
  }
  if(!autoPlays(p)) return;
  if(Date.now() < S.busyUntil + 500) return;
  BOT.busy=true;
  setTimeout(()=>{
    try{
      if(!S || S.phase!=='play' || shooterOf(S)!==pid) return;
      const plan=botPlan();
      act(pid, Object.assign({type:'shot'}, plan));
      if(p.bot && S && S.shot && rnd(3)===0){
        const r=S.shot.res, mineGoal=r.goal!=null && r.goal===S.shot.side;
        const list = mineGoal ? BOT_TALK.goal : r.foul ? BOT_TALK.foul : BOT_TALK.miss;
        setTimeout(()=>{ if(S) botChat(p, pick(list)); }, S.shot.frames/30*1000+400);
      }
    } finally { BOT.busy=false; }
  }, 900+rnd(900));
}
setInterval(botTick, 400);
function botPrivate(bot, from){
  setTimeout(()=>{ if(!S) return; addChat(bot.id, pick(['Shhh, estoy concentrado ⚽','Jaja, después hablamos 😏','¿Me estás distrayendo? 😂']), from.id); }, 1200+rnd(1500));
}
