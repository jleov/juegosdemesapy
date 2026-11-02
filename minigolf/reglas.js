'use strict';
/* =====================================================================
   Mini Golf PY — los hoyos (cada uno con su cancha), la física de la
   pelota (lomas, rampas, arena, agua, túnel, molino y molinete), los
   modos de juego, cómo se van abriendo hoyos nuevos y los bots.
   Todo lo decide el anfitrión: simula el golpe y manda el recorrido.
   ===================================================================== */

/* ====================== MEDIDAS (en cm) ====================== */
const BR=2.15, CR=5.4, TR=7;          // radio de la pelota, del hoyo y de la boca del túnel
const GR=981*5/7;                     // lo que tira la pendiente a una pelota que rueda
const ROLLF=70, SANDF=380;            // freno en la alfombra y en la arena (cm/s²)
const VMAX=480, VCUP=140;             // velocidad máxima del golpe y la máxima para que entre al hoyo
const powerToSpeed = p => 20 + (VMAX-20)*p;
const DT=1/600, SAMPLE=20;            // 600 pasos por segundo, una foto cada 20 (30 por segundo)
const START_OPEN=3;                   // hoyos abiertos al empezar
function rnd(n){ if(window.crypto && crypto.getRandomValues){ const a=new Uint32Array(1); crypto.getRandomValues(a); return a[0]%n; } return Math.floor(Math.random()*n); }
const rect=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];

/* ====================== LOS HOYOS ======================
   x a la derecha, y hacia adelante (del tee al hoyo). out = borde de la cancha.
   obs: hill (loma o pozo), ramp (rampa), post (poste; boing = rebotador), block (bloque macizo),
   spin (molinete que gira), mill (molino: las aspas tapan la entrada), sand, water, tube (túnel). */
const HOLES=[
  {n:'El Calentamiento', par:2, d:'Derecho y sin vueltas, para agarrarle la mano.',
    out:rect(0,0,100,620), tee:[50,45], cup:[50,560], obs:[{t:'hill', x:50, y:330, r:30, h:3}]},
  {n:'La Esquina', par:3, d:'Doblá a la derecha: usá la banda para hacer la curva.',
    out:[[0,0],[100,0],[100,360],[520,360],[520,470],[0,470]], tee:[50,45], cup:[460,415],
    obs:[{t:'post', x:50, y:418, r:9, boing:true}, {t:'hill', x:300, y:415, r:40, h:4}]},
  {n:'Los Postes', par:3, d:'Un bosque de postes: buscá el camino libre.',
    out:rect(0,0,120,720), tee:[60,45], cup:[60,665],
    obs:[[35,210],[85,250],[60,330],[22,420],[98,430],[60,510],[30,590],[90,590]].map(([x,y])=>({t:'post', x, y, r:6}))},
  {n:'La Lomita', par:3, d:'Hay que subir la rampa con fuerza… pero no tanta.',
    out:rect(0,0,110,780), tee:[55,45], cup:[55,705],
    obs:[{t:'ramp', ax:'y', a:250, b:370, h:16}, {t:'hill', x:55, y:540, r:28, h:5}, {t:'post', x:25, y:620, r:6}, {t:'post', x:85, y:620, r:6}]},
  {n:'El Molino', par:3, d:'Pasá por debajo del molino cuando las aspas te dejen.',
    out:rect(0,0,120,800), tee:[60,45], cup:[60,735],
    obs:[{t:'block', pts:rect(0,430,46,480), house:true}, {t:'block', pts:rect(74,430,120,480), house:true}, {t:'mill', x:60, y:430, gw:28, hw:60, d:50, per:4}]},
  {n:'El Tajamar', par:3, d:'Cuidado con el agua: si caés, golpe de castigo.',
    out:rect(0,0,220,720), tee:[110,45], cup:[110,655],
    obs:[{t:'water', pts:[[60,230],[160,230],[175,330],[160,430],[60,430],[45,330]]}, {t:'sand', pts:rect(140,560,220,615)}, {t:'sand', pts:rect(0,560,70,615)}]},
  {n:'El Túnel', par:2, d:'La única forma de pasar es por el caño.',
    out:rect(0,0,120,820), tee:[60,45], cup:[60,755],
    obs:[{t:'block', pts:rect(0,330,120,380)}, {t:'tube', a:[60,275], b:[28,425], dir:1.1}, {t:'post', x:38, y:240, r:6}, {t:'post', x:82, y:240, r:6}]},
  {n:'El Remolino', par:3, d:'El molinete gira sin parar: medí el momento justo.',
    out:rect(0,0,140,780), tee:[70,45], cup:[70,700],
    obs:[{t:'spin', x:70, y:380, len:56, arms:2, w:1.6}, {t:'hill', x:70, y:700, r:40, h:-4}, {t:'hill', x:28, y:560, r:25, h:5}, {t:'hill', x:112, y:560, r:25, h:5}]},
  {n:'La Zeta', par:4, d:'Dos curvas, arena y un rebotador en la esquina.',
    out:[[0,0],[110,0],[110,260],[420,260],[420,800],[310,800],[310,360],[0,360]], tee:[55,45], cup:[365,740],
    obs:[{t:'post', x:395, y:285, r:9, boing:true}, {t:'sand', pts:rect(310,500,378,550)}, {t:'hill', x:200, y:310, r:35, h:4}]},
  {n:'La Gran Final', par:4, d:'Agua, molinete, rampa y molino: todo junto.',
    out:rect(0,0,220,1060), tee:[150,45], cup:[110,1000],
    obs:[{t:'water', pts:rect(0,280,75,600)}, {t:'spin', x:150, y:440, len:42, arms:3, w:-2}, {t:'ramp', ax:'y', a:630, b:740, h:18},
      {t:'post', x:60, y:790, r:7}, {t:'post', x:160, y:790, r:7},
      {t:'block', pts:rect(0,860,96,910), house:true}, {t:'block', pts:rect(124,860,220,910), house:true}, {t:'mill', x:110, y:860, gw:28, hw:110, d:50, per:3.2}]},
];

// datos de cada hoyo listos para la física (se arman una sola vez)
const PREP={};
function prep(i){
  if(PREP[i]) return PREP[i];
  const H=HOLES[i], pr={H, segs:[], posts:[], spins:[], mills:[], sand:[], water:[], tubes:[], hills:[]};
  const addPoly=pts=>{ for(let k=0;k<pts.length;k++){ const a=pts[k], b=pts[(k+1)%pts.length]; pr.segs.push([a[0],a[1],b[0],b[1]]); } };
  addPoly(H.out);
  for(const o of H.obs){
    if(o.t==='block') addPoly(o.pts);
    else if(o.t==='post') pr.posts.push(o);
    else if(o.t==='spin'){ pr.spins.push(o); pr.posts.push({x:o.x, y:o.y, r:4}); }
    else if(o.t==='mill') pr.mills.push(o);
    else if(o.t==='sand') pr.sand.push(o.pts);
    else if(o.t==='water') pr.water.push(o.pts);
    else if(o.t==='tube') pr.tubes.push(o);
    else if(o.t==='hill' || o.t==='ramp') pr.hills.push(o);
  }
  const xs=H.out.map(p=>p[0]), ys=H.out.map(p=>p[1]);
  pr.box={x0:Math.min(...xs), x1:Math.max(...xs), y0:Math.min(...ys), y1:Math.max(...ys)};
  return PREP[i]=pr;
}
// altura del piso (lomas, pozos y rampas)
function hAt(pr, x, y){
  let h=0;
  for(const o of pr.hills){
    if(o.t==='hill'){ const dx=x-o.x, dy=y-o.y; h+=o.h*Math.exp(-(dx*dx+dy*dy)/(o.r*o.r)); }
    else { const v=o.ax==='y'?y:x, s=Math.max(0, Math.min(1, (v-o.a)/(o.b-o.a))); h+=o.h*s*s*(3-2*s); }
  }
  return h;
}
function inPoly(pts, x, y){
  let c=false;
  for(let i=0, j=pts.length-1; i<pts.length; j=i++){ const xi=pts[i][0], yi=pts[i][1], xj=pts[j][0], yj=pts[j][1];
    if(((yi>y)!==(yj>y)) && x<(xj-xi)*(y-yi)/(yj-yi)+xi) c=!c; }
  return c;
}
// lo que se mueve depende de la hora (en segundos): así todos lo ven igual
const spinAng = (o, t) => o.w*(t%3600);
const millAng = (o, t) => 2*Math.PI/o.per*(t%3600);
function millClosed(o, t){
  const a=millAng(o, t);
  for(let k=0;k<4;k++){ let d=((a+k*Math.PI/2+Math.PI/2)%(2*Math.PI)+2*Math.PI)%(2*Math.PI); if(d>Math.PI) d-=2*Math.PI; if(Math.abs(d)<.38) return true; }
  return false;
}

/* ====================== FÍSICA ====================== */
function closest(px, py, ax, ay, bx, by){
  const dx=bx-ax, dy=by-ay, L2=dx*dx+dy*dy; let t=L2 ? ((px-ax)*dx+(py-ay)*dy)/L2 : 0; t=t<0?0:t>1?1:t;
  return [ax+dx*t, ay+dy*t];
}
// rebote contra algo que se mueve a (ux,uy); devuelve qué tan fuerte fue el choque
function bounce(b, nx, ny, e, ux, uy){
  const rvx=b.vx-ux, rvy=b.vy-uy, vn=rvx*nx+rvy*ny; if(vn>=0) return 0;
  const tx=rvx-vn*nx, ty=rvy-vn*ny;
  b.vx=ux+tx*.96-e*vn*nx; b.vy=uy+ty*.96-e*vn*ny;
  return -vn;
}
function pushOut(b, qx, qy, R){
  let nx=b.x-qx, ny=b.y-qy; const d2=nx*nx+ny*ny; if(d2>=R*R) return null;
  const d=Math.sqrt(d2)||1e-6; nx/=d; ny/=d; b.x=qx+nx*R; b.y=qy+ny*R; return [nx, ny];
}
/* simula un golpe. hi: número de hoyo; balls: [{id,x,y}] las pelotas en la cancha; shot: {id, ang, pow};
   t0: hora del golpe (s); o: {collide}; mode: 'full' (con recorrido), 'light' (solo dónde queda) o 'path' (camino de la pelota) */
function simulate(hi, balls, shot, t0, o, mode){
  const pr=prep(hi), cup=pr.H.cup, full=mode==='full', dt=full?DT:DT*2;
  const B=balls.map(b=>({id:b.id, x:b.x, y:b.y, vx:0, vy:0, sx:b.x, sy:b.y, on:true, inn:false, wet:false, hid:0, lip:false, moved:false, sand:false}));
  const me=B.find(b=>b.id===shot.id); if(!me) return null;
  const v=powerToSpeed(shot.pow); me.vx=Math.cos(shot.ang)*v; me.vy=Math.sin(shot.ang)*v; me.moved=true;
  const act = o && o.collide ? B : [me];
  const tr={}, ev=[], path=[[me.x, me.y]];
  const rec=()=>{ for(const b of act){ const a=tr[b.id]||(tr[b.id]=[]); const h=b.hid>0; a.push(h?-99999:Math.round(b.x*10), h?-99999:Math.round(b.y*10)); } };
  if(full) rec();
  let frame=0, quiet=0;
  const maxSteps=Math.round((full?25:(mode==='path'?12:10))/dt);
  for(let step=0; step<maxSteps; step++){
    const t=t0+step*dt;
    let moving=false;
    for(const b of act){
      if(!b.on) continue;
      if(b.hid>0){ b.hid-=dt; moving=true; continue; }
      const e=.6, gx=(hAt(pr,b.x+e,b.y)-hAt(pr,b.x-e,b.y))/(2*e), gy=(hAt(pr,b.x,b.y+e)-hAt(pr,b.x,b.y-e))/(2*e);
      const sand=pr.sand.length>0 && pr.sand.some(p=>inPoly(p,b.x,b.y)), fr=sand?SANDF:ROLLF, slope=GR*Math.hypot(gx,gy);
      const sp=Math.hypot(b.vx,b.vy);
      if(sp<2.5 && slope<fr*.85){ b.vx=b.vy=0; continue; }
      moving=true; b.moved=true;
      if(sand && !b.sand && full) ev.push({f:frame, k:'s'}); b.sand=sand;
      b.vx-=GR*gx*dt; b.vy-=GR*gy*dt;
      const s2=Math.hypot(b.vx,b.vy), dec=fr*dt;
      if(s2<=dec){ b.vx=b.vy=0; } else { const k=(s2-dec)/s2; b.vx*=k; b.vy*=k; }
      // cerca del hoyo la pelota se va un poquito para adentro
      const cx=b.x-cup[0], cy=b.y-cup[1], cd=Math.hypot(cx,cy);
      if(cd<CR+BR && cd>.01 && s2<VCUP*1.3){ b.vx-=cx/cd*260*dt; b.vy-=cy/cd*260*dt; }
      b.x+=b.vx*dt; b.y+=b.vy*dt;
      // bandas y bloques
      for(const s of pr.segs){ const q=closest(b.x,b.y,s[0],s[1],s[2],s[3]), n=pushOut(b,q[0],q[1],BR); if(!n) continue;
        const vn=bounce(b,n[0],n[1],.72,0,0); if(vn>20 && full) ev.push({f:frame, k:'w', v:Math.min(1,vn/350)}); }
      // postes y rebotadores
      for(const p of pr.posts){ const n=pushOut(b,p.x,p.y,p.r+BR); if(!n) continue;
        const vn=bounce(b,n[0],n[1],p.boing?1:.75,0,0); if(p.boing && vn>0){ b.vx+=n[0]*120; b.vy+=n[1]*120; }
        if((vn>15 || p.boing) && full) ev.push({f:frame, k:p.boing?'b':'w', v:Math.min(1,vn/350)}); }
      // molinete (gira: empuja la pelota)
      for(const m of pr.spins){ const a0=spinAng(m,t);
        for(let k=0;k<m.arms;k++){ const a=a0+k*2*Math.PI/m.arms, ex=m.x+Math.cos(a)*m.len, ey=m.y+Math.sin(a)*m.len;
          const q=closest(b.x,b.y,m.x,m.y,ex,ey), n=pushOut(b,q[0],q[1],BR+2); if(!n) continue;
          const vn=bounce(b,n[0],n[1],.6,-m.w*(q[1]-m.y),m.w*(q[0]-m.x)); if(vn>15 && full) ev.push({f:frame, k:'w', v:Math.min(1,vn/350)}); } }
      // molino: cuando un aspa está abajo tapa la entrada
      for(const m of pr.mills){ if(!millClosed(m,t)) continue;
        const q=closest(b.x,b.y,m.x-m.gw/2,m.y,m.x+m.gw/2,m.y), n=pushOut(b,q[0],q[1],BR+1.5); if(!n) continue;
        const vn=bounce(b,n[0],n[1],.5,0,0); if(vn>10 && full) ev.push({f:frame, k:'m', v:Math.min(1,vn/300)}); }
      // agua
      if(pr.water.length && pr.water.some(p=>inPoly(p,b.x,b.y))){ b.on=false; b.wet=true; b.vx=b.vy=0; if(full) ev.push({f:frame, k:'a', id:b.id}); continue; }
      // túnel
      for(const m of pr.tubes){ if(Math.hypot(b.x-m.a[0],b.y-m.a[1])<TR){ const s4=Math.max(90, Math.hypot(b.vx,b.vy)*.85);
        b.x=m.b[0]+Math.cos(m.dir)*(TR+BR+1); b.y=m.b[1]+Math.sin(m.dir)*(TR+BR+1); b.vx=Math.cos(m.dir)*s4; b.vy=Math.sin(m.dir)*s4; b.hid=.7;
        if(full) ev.push({f:frame, k:'t'}); break; } }
      // hoyo
      const dx2=b.x-cup[0], dy2=b.y-cup[1], cd2=Math.hypot(dx2,dy2);
      if(cd2<CR){ const s3=Math.hypot(b.vx,b.vy);
        if(s3<VCUP){ b.on=false; b.inn=true; b.x=cup[0]; b.y=cup[1]; b.vx=b.vy=0; if(full) ev.push({f:frame, k:'c', id:b.id}); continue; }
        if(!b.lip){ b.lip=true;   // pasa por arriba muy rápido: se frena y se desvía
          const side=(dx2*b.vy-dy2*b.vx)>0?1:-1, ang=.35*side*(cd2/CR), c=Math.cos(ang), s=Math.sin(ang), vx=b.vx, vy=b.vy;
          b.vx=(vx*c-vy*s)*.7; b.vy=(vx*s+vy*c)*.7; if(full) ev.push({f:frame, k:'l'}); } }
      else b.lip=false;
    }
    // pelotas entre sí (si la regla está prendida)
    if(act.length>1) for(let i=0;i<act.length;i++){ const p=act[i]; if(!p.on || p.hid) continue;
      for(let j=i+1;j<act.length;j++){ const q=act[j]; if(!q.on || q.hid) continue;
        let nx=q.x-p.x, ny=q.y-p.y; const d2=nx*nx+ny*ny, R=2*BR; if(d2>=R*R) continue;
        const d=Math.sqrt(d2)||1e-6; nx/=d; ny/=d; const ov=(R-d)/2; p.x-=nx*ov; p.y-=ny*ov; q.x+=nx*ov; q.y+=ny*ov;
        const rel=(p.vx-q.vx)*nx+(p.vy-q.vy)*ny; if(rel<=0) continue;
        const J=rel*.95; p.vx-=J*nx; p.vy-=J*ny; q.vx+=J*nx; q.vy+=J*ny; p.moved=q.moved=true;
        if(full) ev.push({f:frame, k:'k', v:Math.min(1,rel/300)}); } }
    if(mode==='path' && step%6===5) path.push([me.hid>0?null:me.x, me.y]);
    if(full && (step+1)%SAMPLE===0){ frame++; rec(); }
    if(!moving){ if(++quiet>20) break; } else quiet=0;
  }
  if(mode==='path'){ path.push([me.x, me.y]); return {path, inn:me.inn, wet:me.wet}; }
  const fin={};
  for(const b of B) fin[b.id]={x:+(b.wet?b.sx:b.x).toFixed(2), y:+(b.wet?b.sy:b.y).toFixed(2), inn:b.inn, wet:b.wet, moved:b.moved};
  const tracks={}; if(full) for(const id in tr) if(fin[id].moved) tracks[id]=tr[id];
  return {fin, tracks, ev, frames:frame};
}

/* ====================== MODOS Y REGLAS ====================== */
const MODES={
  golpes:{t:'⛳ Por golpes', d:'Se suman todos los golpes de la vuelta. Gana el que hizo menos.'},
  hoyos: {t:'🏁 Por hoyos (match play)', d:'Cada hoyo lo gana el que lo hizo con menos golpes (si empatan, no es de nadie). Gana el que se lleva más hoyos.'},
  puntos:{t:'🌟 Por puntos (Stableford)', d:'Cada hoyo da puntos según el par: 2 por hacer el par, 3 por uno menos, 4 por dos menos, 1 por uno más y 0 si te pasás más. Gana el que suma más.'},
};
const FORMATS={ind:'👤 Cada uno por su cuenta', mejor:'👥 Por equipos: cuenta la mejor pelota del equipo', alterno:'👫 Por equipos: una pelota por equipo, se turnan cada golpe'};
const HOUSE=[
  {k:'collide', t:'🎱 Pelotas que chocan', d:'Las pelotas de los demás quedan en la cancha y se pueden chocar. Si metés la de otro en el hoyo, ¡le hiciste el favor!', def:false},
  {k:'water0', t:'💧 Agua sin castigo', d:'Si caés al agua volvés a tirar desde donde estabas, pero sin sumar un golpe de castigo.', def:false},
  {k:'ace', t:'🌟 Hoyo en uno premiado', d:'El hoyo en uno se anota como 0 golpes.', def:true},
  {k:'gimme', t:'🤏 La “dada”', d:'Si la pelota queda a menos de un palmo (15 cm) del hoyo, se cuenta como embocada con un golpe más.', def:false},
];
const MAXS=[{v:6,t:'6 golpes (si no entra, se levanta y se anotan 7)'},{v:8,t:'8 golpes (se anotan 9)'},{v:10,t:'10 golpes (se anotan 11)'}];
const COUNTS=[{v:'all',t:'Todos los hoyos abiertos'},{v:1,t:'1 solo hoyo'},{v:3,t:'3 hoyos'},{v:5,t:'5 hoyos'},{v:9,t:'9 hoyos'}];
const AIMS=[{v:'facil',t:'🟢 Fácil (muestra todo el recorrido con los rebotes)'},{v:'medio',t:'🟡 Medio (línea hasta la primera banda)'},{v:'experto',t:'🔴 Experto (solo una flechita)'}];
const TIMERS=[{v:0,t:'Sin límite'},{v:20,t:'20 segundos'},{v:40,t:'40 segundos'},{v:60,t:'1 minuto'}];
const BOTLV=[{v:'facil',t:'🙂 Fácil'},{v:'normal',t:'😎 Normal'},{v:'crack',t:'🔥 Crack'}];
function defaultOpts(){ const o={mode:'golpes', fmt:'ind', from:1, count:'all', max:6, aim:'medio', bot:'normal', timer:0}; HOUSE.forEach(h=>o[h.k]=h.def); return o; }

let S=null;
const EMOJIS=['⛳','🧉','🥯','🐆','🌸','🎻','⚽','🐂','🌽','🦜','🐊','🦩','🍖','🌵','🎸','🐎','🦋','🌞','🍉','🦉'];
const PCOLORS=['#e63946','#1d70d6','#2a9d3f','#e9a100','#8e44ad','#ff7f11','#13a8a8','#c2185b'];
const BALLS=['#ffffff','#ffd60a','#ff7f11','#ff4d8d','#3a86ff','#2ec4b6','#e63946','#9b5de5','#80ed99','#222222'];
const TEAMS=[{n:'Equipo Rojo', e:'🔴', c:'#e63946'}, {n:'Equipo Azul', e:'🔵', c:'#1d70d6'}];
const BOT_NAMES=[['Don Hoyo','⛳'],['Ña Bandera','🌸'],['Karai Putt','🧉'],['Chulo Birdie','😎'],['Ña Pelotita','🦋'],['Don Molino','🐆'],['Pombero','👹'],['Kuñataĩ Golf','🦜']];
const MAXP=8;
const P = id => S && S.players.find(p=>p.id===id);
const OB = id => S && (S.observers||[]).find(o=>o.id===id);

function lobbyState(){
  return {v:1, phase:'lobby', seq:0, players:[], observers:[], hostPid:null, opts:defaultOpts(), grules:'', sugs:[], log:[],
    sides:[], units:[], course:[], hi:0, order:[], oi:0, cur:0, shot:null, shotN:0, busyUntil:0, open:START_OPEN, holeEnd:null, win:null, turnAt:0};
}
const clampOpen = v => Math.max(START_OPEN, Math.min(HOLES.length, Math.round(+v)||START_OPEN));
function roomOpen(){ S.open=Math.max(S.open||START_OPEN, ...S.players.filter(p=>!p.bot).map(p=>p.open||0)); }
function addPlayer(name, emoji, token, peerId, bot, local, open){
  const used=S.players.map(p=>p.color), usedB=S.players.map(p=>p.ball);
  const t0=S.players.filter(p=>p.team===0).length, t1=S.players.filter(p=>p.team===1).length;
  const p={id:'p'+(++S.seq), name:(String(name||'').trim()||'Jugador').slice(0,16), emoji, token, peerId,
    color:PCOLORS.find(c=>!used.includes(c))||PCOLORS[S.players.length%PCOLORS.length],
    ball:BALLS.find(c=>!usedB.includes(c))||BALLS[0], open: bot ? 0 : clampOpen(open),
    conn:!bot, bot:!!bot, local:!!local, mic:false, team: t0<=t1 ? 0 : 1};
  S.players.push(p); roomOpen(); return p;
}
function addBot(){
  if(S.players.length>=MAXP) return 'Ya son 8 jugadores (el máximo).';
  const free=BOT_NAMES.filter(([n])=>!S.players.some(p=>p.name===n));
  const [n,e]=free.length?free[rnd(free.length)]:['Bot '+(S.players.length+1),'🤖'];
  const b=addPlayer(n, e, null, null, true);
  sysChat(`🤖 ${b.name} se sumó a la cancha.`);
}
function log(x){ S.log.push({x, at:Date.now()}); if(S.log.length>200) S.log.splice(0, S.log.length-200); }

/* ---------- lados, pelotas y turnos ---------- */
function buildSides(){
  const o=S.opts; S.units=[];
  if(o.fmt==='ind') S.sides=S.players.map(p=>({team:null, pids:[p.id]}));
  else S.sides=[0,1].map(t=>({team:t, pids:S.players.filter(p=>p.team===t).map(p=>p.id)}));
  S.sides.forEach((s,si)=>{
    const mk=pids=>({id:'u'+(++S.seq), side:si, pids, k:0, pos:null, strokes:0, done:false, inn:false, card:[]});
    if(o.fmt==='alterno') S.units.push(mk(s.pids.slice()));
    else s.pids.forEach(pid=>S.units.push(mk([pid])));
  });
}
function sideName(st, i){
  const s=st.sides[i]; if(!s) return '?';
  if(s.team!=null) return TEAMS[s.team].e+' '+TEAMS[s.team].n;
  const p=st.players.find(x=>x.id===s.pids[0]); return p ? p.name : '?';
}
const unitPid = u => u.pids[u.k%u.pids.length];
function shooterOf(st){ const u=st.units[st.cur]; return u && u.pids.length ? unitPid(u) : null; }
function unitName(st, u){ const p=st.players.find(x=>x.id===unitPid(u)); return st.opts.fmt==='alterno' ? `${sideName(st,u.side)} (${p?p.name:'?'})` : p ? p.name : '?'; }
function courseFor(){
  const o=S.opts, from=Math.max(1, Math.min(S.open, +o.from||1))-1, list=[];
  for(let i=from;i<S.open;i++) list.push(i);
  return o.count==='all' ? list : list.slice(0, +o.count);
}
function startGame(){
  S.players.forEach(p=>{ if(!p.bot) p.open=Math.max(p.open||0, S.open); });   // jugando con alguien que ya abrió más hoyos, también se te abren
  buildSides(); S.course=courseFor(); S.hi=0; S.win=null; S.startedAt=Date.now();
  log(`⛳ Empieza la vuelta: ${MODES[S.opts.mode].t}, ${S.course.length} hoyo${S.course.length>1?'s':''}.`);
  beginHole();
}
function beginHole(){
  const prev=S.hi-1, val=u=>{ const v=u.card[prev]; return v==null?99:v; };
  S.units.forEach(u=>{ u.pos=null; u.strokes=0; u.done=false; u.inn=false; });
  S.order=S.units.map((u,i)=>i);
  if(prev>=0) S.order.sort((a,b)=>val(S.units[a])-val(S.units[b]) || a-b);   // el que hizo menos en el hoyo anterior sale primero
  S.oi=0; S.cur=S.order[0]; S.phase='play'; S.holeEnd=null; S.turnAt=Date.now(); S.shot=null;
  const H=HOLES[S.course[S.hi]]; log(`⛳ Hoyo ${S.course[S.hi]+1}: ${H.n} (par ${H.par}).`);
}
function nextTurn(){
  const n=S.order.length;
  for(let k=1;k<=n;k++){ const oi=(S.oi+k)%n, u=S.units[S.order[oi]]; if(!u.done){ S.oi=oi; S.cur=S.order[oi]; S.turnAt=Date.now(); return; } }
  endHole();
}
// golpes de un lado en un hoyo (con el premio del hoyo en uno); null si todavía no terminó
function sideHole(st, si, h){
  const vals=st.units.filter(u=>u.side===si).map(u=>u.card[h]).filter(v=>v!=null).map(v=>st.opts.ace && v===1 ? 0 : v);
  if(!vals.length) return null;
  return Math.min(...vals);
}
const ptsFor = (sc, par) => Math.max(0, 2+par-sc);
function totals(st){
  const T=st.sides.map(()=>({strokes:0, par:0, pts:0, won:0, holes:0}));
  for(let h=0; h<st.course.length; h++){
    const sc=st.sides.map((s,si)=>sideHole(st, si, h)); if(sc.some(v=>v==null)) continue;
    const par=HOLES[st.course[h]].par, best=Math.min(...sc), w=sc.filter(v=>v===best).length;
    sc.forEach((v,si)=>{ const t=T[si]; t.strokes+=v; t.par+=par; t.pts+=ptsFor(v,par); t.holes++; if(v===best && w===1) t.won++; });
  }
  T.forEach(t=>t.val = st.opts.mode==='golpes' ? -t.strokes : st.opts.mode==='hoyos' ? t.won : t.pts);
  return T;
}
const parTxt = d => d===0 ? 'par' : d>0 ? '+'+d : String(d);
function endHole(){
  const h=S.hi, ci=S.course[h], H=HOLES[ci];
  S.units.forEach(u=>u.card[h]=u.strokes);
  const sc=S.sides.map((s,si)=>sideHole(S, si, h)), best=Math.min(...sc), win=sc.map((v,i)=>i).filter(i=>sc[i]===best);
  let unlocked=null;
  // se abre el hoyo siguiente: al terminar el último abierto, jugando de a 2 o más
  if(S.players.length>=2 && ci===S.open-1 && S.open<HOLES.length){
    S.open++; unlocked=S.open;
    S.players.forEach(p=>{ if(!p.bot) p.open=Math.max(p.open||0, S.open); });
    log(`🔓 ¡Se abrió el hoyo ${S.open}: ${HOLES[S.open-1].n}!`);
    if(S.opts.count==='all' || S.course.length<+S.opts.count) S.course.push(S.open-1);
  }
  log(`🏁 Hoyo ${ci+1} (par ${H.par}): ${win.map(i=>sideName(S,i)).join(' y ')} ${win.length>1?'empatan':'gana'} con ${best} golpe${best===1?'':'s'}.`);
  S.holeEnd={h, sc, unlocked, at:Date.now()};
  if(h+1>=S.course.length) return gameOver();
  S.phase='holeEnd';
}
function nextHole(){ S.hi++; beginHole(); }
function gameOver(){
  const T=totals(S), best=Math.max(...T.map(t=>t.val)), ties=T.map((t,i)=>i).filter(i=>T[i].val===best);
  S.win={ties, tie:ties.length>1, at:Date.now()};
  S.phase='over';
  const t=T[ties[0]], how = S.opts.mode==='golpes' ? `${t.strokes} golpes (${parTxt(t.strokes-t.par)})` : S.opts.mode==='hoyos' ? `${t.won} hoyo${t.won===1?'':'s'} ganado${t.won===1?'':'s'}` : `${t.pts} puntos`;
  log(`🏆 ${ties.map(i=>sideName(S,i)).join(' y ')} ${ties.length>1?'empatan':'gana la vuelta'} con ${how}.`);
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
      if(S.phase==='play' || S.phase==='holeEnd') return 'Esperá a que termine la vuelta para sumarte.';
      if(S.players.length>=MAXP) return 'La cancha está llena.';
      if(o.owner) return;
      S.observers=S.observers.filter(x=>x!==o);
      const np=addPlayer(o.name, o.emoji==='👀'?EMOJIS.find(e=>!S.players.some(q=>q.emoji===e)):o.emoji, o.token, o.peerId, false, false, o.open);
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
      const emo=EMOJIS.find(e=>!S.players.some(q=>q.emoji===e))||'⛳';
      const np=addPlayer(nm, emo, null, null, false, true, S.open); np.conn=true;
      sysChat(`🙋 ${np.name} juega en este aparato.`); commit(); return;
    }
    case 'team': {
      if(S.phase!=='lobby') return;
      const t=P(a.pid); if(!t || (!host && t.id!==pid)) return;
      t.team = t.team ? 0 : 1; commit(); return;
    }
    case 'ballc': {   // color de la pelota: cada uno la suya (en la partida local, el anfitrión elige por todos)
      const t=P(a.pid||pid); if(!t || (t.id!==pid && !host)) return;
      if(BALLS.includes(a.c)) t.ball=a.c; commit(); return;
    }
    case 'kick': {
      if(!host) return; const t=P(a.pid); if(!t || t.id===S.hostPid) return;
      removePlayer(t, `🚪 ${t.name} salió de la cancha.`); commit(); return;
    }
    case 'botify': {
      if(!host) return; const t=P(a.pid); if(!t || t.bot) return;
      t.bot=true; t.conn=false; t.mic=false; t.token=null; sysChat(`🤖 Un bot sigue jugando por ${t.name}.`); commit(); return;
    }
    case 'opt': {
      if(!host || S.phase!=='lobby') return;
      const o=S.opts, v=a.v;
      if(a.k==='mode' && MODES[v]) o.mode=v;
      else if(a.k==='fmt' && FORMATS[v]) o.fmt=v;
      else if(a.k==='from') o.from=Math.max(1, Math.min(S.open, Math.round(+v)||1));
      else if(a.k==='count' && COUNTS.some(x=>String(x.v)===String(v))) o.count = v==='all' ? 'all' : +v;
      else if(a.k==='max' && MAXS.some(x=>x.v==v)) o.max=+v;
      else if(a.k==='aim' && AIMS.some(x=>x.v===v)) o.aim=v;
      else if(a.k==='bot' && BOTLV.some(x=>x.v===v)) o.bot=v;
      else if(a.k==='timer' && TIMERS.some(x=>x.v==v)) o.timer=+v;
      else if(HOUSE.some(h=>h.k===a.k)) o[a.k]=!!v;
      commit(); return;
    }
    case 'grules': if(!host) return; S.grules=String(a.text||'').slice(0,1200); commit(); return;
    case 'sugDel': if(!host) return; S.sugs=S.sugs.filter(s=>s.id!==a.id); commit(); return;
    case 'start': {
      if(!host || S.phase!=='lobby') return;
      const r=canStart(); if(r) return r;
      startGame(); sysChat(`⛳ ¡Empieza! ${MODES[S.opts.mode].t}. Arranca ${unitName(S, S.units[S.cur])}.`); commit(); return;
    }
    case 'nextHole': if(!host || S.phase!=='holeEnd') return; nextHole(); commit(); return;
    case 'rematch': if(!host || S.phase!=='over') return; startGame(); sysChat('🔁 ¡Revancha! Otra vuelta.'); commit(); return;
    case 'newGame': if(!host || (S.phase!=='over' && S.phase!=='holeEnd' && !a.force)) return;
      S.phase='lobby'; S.log=[]; S.sides=[]; S.units=[]; S.shot=null; S.win=null; S.holeEnd=null; commit(); return;
    case 'leave': {
      if(S.phase==='lobby' || S.phase==='over') removePlayer(p, `🚪 ${p.name} se fue.`);
      else { p.bot=true; p.conn=false; p.mic=false; p.token=null; sysChat(`🚪 ${p.name} se fue: un bot 🤖 juega por él.`); }
      commit(); return;
    }
    case 'shot': {
      if(S.phase!=='play') return;
      const sh=shooterOf(S);
      if(sh!==pid && !(NET.mode==='local' && P(sh) && !P(sh).bot && isLocalCtl(pid))) return 'No es tu turno.';
      if(Date.now() < S.busyUntil-400) return 'Esperá que se quede quieta la pelota.';
      return doShot(a);
    }
  }
}
function canStart(){
  const o=S.opts;
  if(S.players.length<1) return 'Falta al menos un jugador.';
  if(o.fmt!=='ind'){
    const a=S.players.filter(p=>p.team===0).length, b=S.players.filter(p=>p.team===1).length;
    if(!a || !b) return 'Cada equipo necesita al menos un jugador. Tocá 🔴/🔵 al lado de cada nombre para cambiarlo de equipo.';
  }
  return null;
}
// las pelotas que están en la cancha (la que tira, en su lugar o en el tee)
function onCourse(u, from){
  const list=[{id:u.id, x:from.x, y:from.y}];
  S.units.forEach(v=>{ if(v!==u && v.pos && !v.done) list.push({id:v.id, x:v.pos.x, y:v.pos.y}); });
  return list;
}
const holeName = d => d<=-3 ? '¡Albatros!' : d===-2 ? '🦅 ¡Águila!' : d===-1 ? '🐦 ¡Birdie!' : d===0 ? '👌 Par' : d===1 ? 'Bogey' : d===2 ? 'Doble bogey' : `+${d}`;
function doShot(a){
  const u=S.units[S.cur], ci=S.course[S.hi], H=HOLES[ci], o=S.opts;
  const ang=+a.ang, pow=Math.max(.02, Math.min(1, +a.pow||0)); if(!isFinite(ang)) return;
  const from=u.pos || {x:H.tee[0], y:H.tee[1]}, t0=Date.now()/1000;
  const sim=simulate(ci, onCourse(u, from), {id:u.id, ang, pow}, t0, {collide:o.collide}, 'full'); if(!sim) return;
  const pid=shooterOf(S), who=unitName(S, u), f=sim.fin[u.id];
  const res={msg:'', ace:false, inn:false, wet:false, picked:false, gimme:false, cls:''};
  u.strokes++;
  if(f.wet){ res.wet=true; if(!o.water0) u.strokes++; u.pos={x:from.x, y:from.y}; }
  else u.pos={x:f.x, y:f.y};
  if(f.inn){ u.inn=true; u.done=true; u.pos={x:H.cup[0], y:H.cup[1]}; }
  // pelotas de otros que se movieron por un choque
  S.units.forEach(v=>{ if(v===u) return; const g=sim.fin[v.id]; if(!g || !g.moved) return;
    if(g.inn){ v.inn=true; v.done=true; v.pos={x:H.cup[0], y:H.cup[1]}; log(`🎱 ${who} le metió la pelota a ${unitName(S,v)} en el hoyo.`); }
    else v.pos={x:g.x, y:g.y}; });
  if(!u.done && o.gimme && Math.hypot(u.pos.x-H.cup[0], u.pos.y-H.cup[1])<15){ u.strokes++; u.inn=true; u.done=true; res.gimme=true; }
  if(!u.done && u.strokes>=o.max){ u.done=true; u.strokes=o.max+1; res.picked=true; }
  if(u.inn){
    res.inn=true; res.ace = u.strokes===1;
    res.msg = res.ace ? '🌟 ¡HOYO EN UNO!' : `${holeName(u.strokes-H.par)} · ${u.strokes} golpes${res.gimme?' (con la dada)':''}`;
    log(`${res.ace?'🌟':'⛳'} ${who}: ${res.ace?'¡hoyo en uno!':`embocó en ${u.strokes} (${holeName(u.strokes-H.par).replace(/^\S+ /,'')})`} en el hoyo ${ci+1}.`);
  } else if(res.wet){ res.msg = o.water0 ? '💦 ¡Al agua! Tirá de nuevo.' : '💦 ¡Al agua! +1 golpe de castigo'; log(`💦 ${who} cayó al agua en el hoyo ${ci+1}.`); }
  else if(res.picked){ res.msg=`🙈 Llegó a ${o.max} golpes: se anotan ${u.strokes}`; log(`🙈 ${who} levantó la pelota: ${u.strokes} golpes en el hoyo ${ci+1}.`); }
  else { const d=Math.hypot(u.pos.x-H.cup[0], u.pos.y-H.cup[1]); res.msg = d<25 ? '😬 ¡Cerquita!' : `Quedó a ${d<100?Math.round(d)+' cm':(d/100).toFixed(1).replace('.',',')+' m'} del hoyo`; }
  S.shotN++;
  S.shot={n:S.shotN, pid, unit:u.id, from, tracks:sim.tracks, ev:sim.ev, frames:sim.frames, t0, ang, pow, hi:S.hi, res};
  S.busyUntil=Date.now()+sim.frames/30*1000+900;
  if(o.fmt==='alterno') u.k++;
  nextTurn();
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
  ace:['¡HOYO EN UNO! 🌟 Anotá eso','Ni yo me lo creo 😂'],
  inn:['Adentro 👌','Al hoyo, como pelota al arco ⚽','¡Tomá! 🧉'],
  wet:['Upa, a nadar 💦','Esa agua me llama 😅'],
  miss:['Uff, por poquito 😅','La alfombra está torcida 😤','Ya va a entrar…'],
  win:['¡Gané! ¿Otra vuelta? 🏆','Fue suerte… o no 😏'],
};
const pick = a => a[rnd(a.length)];
const autoPlays = p => p && (p.bot || (!p.conn && p.offAt && Date.now()-p.offAt>20000));
function botPlan(lvOverride){
  const u=S.units[S.cur], ci=S.course[S.hi], H=HOLES[ci], pr=prep(ci), lv=lvOverride||S.opts.bot;
  const from=u.pos || {x:H.tee[0], y:H.tee[1]}, balls=onCourse(u, from), t0=Date.now()/1000, cup=H.cup;
  const dist=Math.hypot(cup[0]-from.x, cup[1]-from.y), direct=Math.atan2(cup[1]-from.y, cup[0]-from.x);
  const powD=Math.max(.05, Math.min(1, (Math.sqrt(2*ROLLF*dist)*1.08-20)/(VMAX-20)));
  const cands=[];
  [.85,1,1.2].forEach(k=>cands.push([direct, Math.min(1, powD*k)]));
  pr.tubes.forEach(m=>{ const a=Math.atan2(m.a[1]-from.y, m.a[0]-from.x); [.35,.55].forEach(pw=>cands.push([a,pw])); });
  const nA = lv==='facil' ? 12 : lv==='crack' ? 36 : 24, pows = lv==='facil' ? [.3,.6,.9] : [.2,.35,.5,.7,.9];
  for(let k=0;k<nA;k++) for(const pw of pows) cands.push([k*2*Math.PI/nA + (k%2?.07:0), pw]);
  const cost=(ang,pw)=>{ const r=simulate(ci, balls, {id:u.id, ang, pow:pw}, t0, {collide:S.opts.collide}, 'light'), f=r.fin[u.id];
    if(f.inn) return -1000+pw; return (f.wet?400:0) + Math.hypot(f.x-cup[0], f.y-cup[1]) + (lv==='crack'?0:Math.abs(pw-.5)*10); };
  let best=null;
  for(const [ang,pw] of cands){ const c=cost(ang,pw); if(!best || c<best.c) best={ang, pow:pw, c}; }
  // afina alrededor del mejor
  if(lv!=='facil' && best.c>-900){
    const base={...best};
    for(const da of [-.06,-.03,-.012,.012,.03,.06]) for(const dp of [-.06,0,.06]){
      const ang=base.ang+da, pw=Math.max(.05, Math.min(1, base.pow+dp)), c=cost(ang,pw); if(c<best.c) best={ang, pow:pw, c}; }
  }
  const na = lv==='facil' ? .07 : lv==='crack' ? .006 : .04, np = lv==='facil' ? .15 : lv==='crack' ? .025 : .1;
  const g=()=>Math.random()+Math.random()+Math.random()-1.5;
  return {ang:best.ang+g()*na, pow:Math.max(.03, Math.min(1, best.pow*(1+g()*np)))};
}
function botTick(){
  if(!S || NET.mode==='client' || BOT.busy) return;
  if(S.phase==='holeEnd' && S.holeEnd && Date.now()-S.holeEnd.at>9000){ nextHole(); commit(); return; }   // el siguiente hoyo arranca solo
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
      act(pid, Object.assign({type:'shot'}, plan));
      if(p.bot && S && S.shot && S.shot.pid===pid && rnd(3)===0){
        const r=S.shot.res; setTimeout(()=>{ if(!S) return; botChat(p, pick(r.ace?BOT_TALK.ace:r.inn?BOT_TALK.inn:r.wet?BOT_TALK.wet:BOT_TALK.miss)); }, S.shot.frames/30*1000+400);
      }
    } finally { BOT.busy=false; }
  }, late ? 200 : 900+rnd(800));
}
setInterval(botTick, 400);
function botPrivate(bot, from, text){
  void text;
  setTimeout(()=>{ if(!S) return; addChat(bot.id, pick(['Shhh, estoy apuntando ⛳','Jaja, después hablamos 😏','¿Me estás distrayendo? 😂']), from.id); }, 1200+rnd(1500));
}
