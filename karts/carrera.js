'use strict';
/* =====================================================================
   Carrera Guasu — el motor de la carrera: cómo se maneja el kart
   (acelerar, derrapar con mini turbo, saltos, rebufo), los objetos,
   los bots y quién va en qué puesto.
   En línea, cada aparato mueve su propio kart; el anfitrión mueve los
   bots y decide los objetos, los golpes y el resultado.
   ===================================================================== */
const OBJETOS = {
  chipa:   {e:'🥯', n:'Chipa turbo',        d:'Un empujón de velocidad.'},
  chipa3:  {e:'🥯', n:'Tres chipas',        d:'Tres turbos para usar cuando quieras.', x:3},
  mango:   {e:'🥭', n:'Cáscara de mango',   d:'Un toque y la dejás atrás. Si mantenés apretado la llevás colgando atrás (un coco te la saca sin hacerte daño) y al soltar la tirás adelante; si soltás frenando, cae atrás.'},
  coco:    {e:'🥥', n:'Coco',               d:'Sale rodando por la pista y voltea al primero que toca. Si vas primero, sale para atrás.'},
  terere:  {e:'🧉', n:'Tereré helado',      d:'Persigue al que va adelante y lo deja congelado.'},
  nanduti: {e:'🕸️', n:'Escudo de ñandutí', d:'Te cubre de un golpe por un rato.'},
  tormenta:{e:'⛈️', n:'Tormenta',          d:'Llueve sobre todos los demás y van más lento.'},
  viento:  {e:'🌬️', n:'Viento norte',      d:'Volás un rato: nadie te para y volteás al que tocás.'},
  guampa:  {e:'🧊', n:'Guampa helada',      d:'Vas tomando tereré con 3 cargas de hielo: congela al que te choca o al que chocás. Si apretás usar, la lanzás para adelante y congela al primero que toca.', x:3},
  mango5:  {e:'🥭', n:'Mazo de mangos',     d:'Cinco cáscaras para ir tirando de a una (cada una también se puede mantener colgando y lanzar adelante).', x:5},
  sol:     {e:'☀️', n:'Fuerza del Kuarahy', d:'Brillás como el sol: vas más rápido, nada te hace daño y volteás a todo el que chocás.'},
  mainumby:{e:'🐦', n:'Mainumby furioso',   d:'Un picaflor que vuela directo al que va primero y le pega sí o sí, aunque tenga escudo. Si alguien se le cruza en el camino, también lo voltea.'},
};
const COD_OBJ = Object.keys(OBJETOS);
const NIVELES = [{id:'facil', n:'Tranquilo', f:.83}, {id:'medio', n:'Normal', f:.92}, {id:'dificil', n:'Mbarete', f:1}];
const RITMOS = [{id:'paseo', n:'Paseo', f:.84}, {id:'normal', n:'Normal', f:1}, {id:'fondo', n:'A fondo', f:1.16}];
const PUNTOS = [15,12,10,8,6,4,2,1];
const circ = (d, N) => { d%=N; if(d>N/2) d-=N; if(d<-N/2) d+=N; return d; };
const angC = d => Math.atan2(Math.sin(d), Math.cos(d));

function nuevoKart(R, e, j){
  const T=R.T;
  if(T.arena){   // modo batalla: en ronda alrededor de la arena, mirando al centro
    const n=Math.max(1, R.cfg.parrilla.filter(x=>!x.fantasma).length), a=j/n*Math.PI*2+.39, rr=T.radio*.66, x=Math.sin(a)*rr, z=Math.cos(a)*rr;
    const s={x, z, y:0, nx:0, nz:0, h:Math.atan2(-x,-z), w:8};
    const k=nuevoKart(Object.assign({}, R, {T:{N:1, S:[s], arena:false}}), e, 0);
    Object.assign(k, {x, z, y:0, ySuelo:0, h:s.h, idx:0, f0:0, prog:0, puesto:j+1, vidas:R.vidas, muerto:false, golpes:0, finT:null});
    return k;
  }
  const fila=Math.floor(j/2), i=((T.N-3-fila*2-(j%2))%T.N+T.N)%T.N, s=T.S[i], lat=(j%2?-1:1)*s.w*.42;
  const niv=NIVELES.find(n=>n.id===(e.lvl||R.cfg.nivel))||NIVELES[1];
  return {pid:e.pid, ch:e.ch|0, color:e.color, nombre:e.nombre, humano:!e.bot, local:!!e.local, fantasma:!!e.fantasma,
    bot:e.bot?{f:niv.f*(.97+Math.random()*.06), niv:niv.id, lat:lat, cambia:0, usaEn:0, turboEn:6+Math.random()*6}:null,
    x:s.x+s.nx*lat, z:s.z+s.nz*lat, y:s.y, ySuelo:s.y, h:s.h, v:0, vy:0, aire:0, idx:i, f0:i, prog:i-T.N, steer:0, steerVis:0,
    drift:0, dCarga:0, dNivel:0, desliz:0, boost:0, spin:0, hielo:0, escudo:0, lento:0, viento:0, parpadeo:0,
    item:null, itemN:0, itemPend:null, ruleta:0, fin:null, rebT:0, rebufo:false, rodado:0, cabeceo:0, fuera:false,
    inp:{gas:0, freno:0, dir:0, derrape:0, usar:0}, vueltas:[], tVuelta:0, lapN:-1, alReves:0, quieto:0, truco:false, trucoV:0,
    puesto:j+1, usarPrev:0, derPrev:0, gasDesde:null, largo:false, net:null};
}
function crearCarrera(cfg){
  const T=armarPista(cfg.pista);
  const R={T, cfg, karts:[], porPid:{}, objs:[], cajas:[], cajasOff:[], t:-6.2, reloj:0, estado:'cuenta', tormenta:0, seq:0,
    host:!!cfg.host, miPid:cfg.miPid, cierre:null, ritmoF:(RITMOS.find(r=>r.id===cfg.ritmo)||RITMOS[1]).f, vueltas:cfg.vueltas||3,
    pedir(){}, emitir(){}, alFx(){}, alTerminar(){}, orden:[], arena:!!T.arena, vidas:cfg.vidas||3, limite:cfg.tiempo||180};
  if(T.arena){ T.cajas.forEach((c,i)=>{ R.cajas.push({x:c.x, y:0, z:c.z, i}); R.cajasOff.push(0); }); }
  else if(cfg.objetos!==false) T.cajas.forEach(i=>{ const s=T.S[i]; [-.62,-.21,.21,.62].forEach(q=>R.cajas.push({x:s.x+s.nx*s.w*q, y:s.y, z:s.z+s.nz*s.w*q, i})); });
  // sin objetos (contrarreloj) las cajas quedan escondidas para siempre
  if(!T.arena){ const nCajas=T.cajas.length*4; for(let i=0;i<nCajas;i++) R.cajasOff.push(cfg.objetos===false ? 1e9 : 0); }
  cfg.parrilla.forEach((e,j)=>{ const k=nuevoKart(R, e, j); R.karts.push(k); R.porPid[k.pid]=k; });
  R.orden=R.karts.slice();
  return R;
}

/* ---------- un paso de la carrera ---------- */
function pasoCarrera(R, dt, miInp){
  R.reloj+=dt; R.t+=dt; if(R.tormenta>0) R.tormenta-=dt;
  const corre=R.t>=0;
  if(corre && R.estado==='cuenta') R.estado='carrera';
  for(const k of R.karts){
    if(k.fantasma){ pasoFantasma(R, k); continue; }
    if(!k.local){ pasoRemoto(R, k, dt); continue; }
    if(k.pid===R.miPid && !k.bot && miInp) Object.assign(k.inp, miInp); else if(k.bot) botInput(R, k, dt);
    pasoKart(R, k, dt, corre);
  }
  if(R.host) pasoHost(R, dt);
  // puestos
  R.orden = R.arena ? ordenArena(R) : R.karts.filter(k=>!k.fantasma).sort((a,b)=> (a.fin!=null||b.fin!=null) ? (a.fin==null?1:b.fin==null?-1:a.fin-b.fin) : b.prog-a.prog);
  R.orden.forEach((k,i)=>k.puesto=i+1);
}

function pasoKart(R, k, dt, corre){
  const T=R.T, N=T.N, p=piloto(k.ch), inp=k.inp, f=R.ritmoF;
  if(k.muerto){ k.v*=Math.max(0, 1-dt*3); k.boost=k.viento=0; k.drift=0; return; }
  for(const c of ['boost','spin','hielo','escudo','lento','viento','sol','parpadeo','ruleta']) if(k[c]>0) k[c]=Math.max(0, k[c]-dt);
  if(k.itemPend && k.ruleta<=0){ k.item=k.itemPend; k.itemN=OBJETOS[k.item].x||1; k.itemT=R.t; k.itemPend=null; k.sost=false; k.mDesde=null; if(k.pid===R.miPid) R.alFx({k:'tengo', o:k.item}); }
  if(!corre){ if(inp.gas){ if(k.gasDesde==null) k.gasDesde=R.t; } else k.gasDesde=null; return; }
  // la largada: el que aprieta antes del 2 patina; el que aprieta justo en el 1, sale con turbo
  if(!k.largo){ k.largo=true;
    if(k.gasDesde!=null && k.gasDesde<=-2){ k.spin=1.1; k.v=0; if(k.pid===R.miPid) R.alFx({k:'quemo'}); }
    else if(k.gasDesde!=null && k.gasDesde>-.95 && k.gasDesde<-.15){ k.boost=1.2; if(k.pid===R.miPid) R.alFx({k:'largada'}); } }
  const trabado=k.hielo>0||k.spin>0, turbo=k.boost>0||k.viento>0||k.sol>0, suelo=k.aire<=0;
  const gas=trabado?0:inp.gas, freno=trabado?0:inp.freno, dir=trabado?0:inp.dir;
  /* velocidad */
  let vmax=(26.5+p.vel*1.15)*f;
  if(k.fuera && !turbo) vmax*=.5;
  if(k.lento>0 && k.viento<=0 && !(k.sol>0)) vmax*=.7;
  if(k.rebufo) vmax*=1.09;
  if(k.viento>0) vmax*=1.42; else if(k.sol>0) vmax*=1.3; else if(k.boost>0) vmax*=1.32;
  if(k.bot) vmax*=k.bot.f*(k.bot.goma||1);
  const ace=(11+p.ace*1.7)*f*(turbo?2.6:1);
  if(turbo && k.v<vmax) k.v=Math.min(vmax, k.v+ace*dt);
  else if(gas>0 && k.v<vmax) k.v=Math.min(vmax, k.v+ace*gas*dt*(1.2-Math.max(0,k.v)/vmax));
  else if(k.v>vmax) k.v-=(k.v-vmax)*Math.min(1, dt*(k.fuera?3.4:1.5));
  if(freno>0){ if(k.v>.5) k.v=Math.max(0, k.v-36*dt); else if(!gas) k.v=Math.max(-9*f, k.v-12*dt); }
  else if(!gas && !turbo) k.v-=Math.sign(k.v)*Math.min(Math.abs(k.v), 7*dt);
  if(trabado) k.v*=Math.max(0, 1-(k.hielo>0?4.5:2.2)*dt);
  /* volante y derrape */
  k.steer+=(dir-k.steer)*Math.min(1, dt*9); k.steerVis=k.steer;
  const giro=1.75+p.man*.11, vf=Math.max(-1, Math.min(1, k.v/9));
  const der=!!inp.derrape && !trabado;
  if(der && !k.derPrev){
    if(suelo){ k.vy=5.2; k.aire=.001; if(Math.abs(dir)>.25 && k.v>13){ k.drift=Math.sign(dir); k.dCarga=0; k.dNivel=0; } }
    else if(k.trucoV>0 && !k.truco){ k.truco=true; if(k.pid===R.miPid) R.alFx({k:'truco'}); }
  }
  if(k.trucoV>0) k.trucoV-=dt;
  if(k.drift){
    if(!der || k.v<9 || trabado){
      if(k.dNivel>0 && !trabado){ k.boost=Math.max(k.boost, [0,.55,1,1.6][k.dNivel]); if(k.pid===R.miPid) R.alFx({k:'miniturbo', n:k.dNivel}); }
      k.drift=0; k.dCarga=0; k.dNivel=0;
    } else {
      const rel=k.steer*k.drift; k.h-=k.drift*(.8+.58*rel)*giro*dt;
      k.dCarga+=dt*(.72+.75*Math.max(0, rel)); const n=k.dCarga>2.5?3:k.dCarga>1.55?2:k.dCarga>.7?1:0;
      if(n>k.dNivel){ k.dNivel=n; if(k.pid===R.miPid) R.alFx({k:'chispa', n}); }
    }
  } else k.h-=k.steer*giro*vf*dt*(suelo?1:.4);
  k.desliz+=((k.drift||0)-k.desliz)*Math.min(1, dt*7);
  k.derPrev=der;
  /* avanzar */
  const sx=Math.sin(k.h), cz=Math.cos(k.h);
  k.x+=sx*k.v*dt; k.z+=cz*k.v*dt; k.rodado+=k.v*dt*2.4;
  if(R.arena) return pasoArena(R, k, dt, p, sx, cz, trabado, inp);
  /* dónde quedó respecto de la pista */
  let L=ubicar(T, k.x, k.z, k.idx, 6, 12);
  if(Math.abs(L.lat)>L.w+L.marg+9 || Math.abs(L.f-L.i)>=1) { const G=ubicarGlobal(T, k.x, k.z); if(Math.abs(circ(G.i-k.idx, N))<N*.3 || Math.abs(L.lat)>L.w+L.marg+20) L=G; }
  let lat=L.lat, i=L.i, fidx=L.f, yS=L.y; const w=L.w, marg=L.marg, th=L.h, pend=L.pend, ttx=L.tx, ttz=L.tz;
  const ata=T.atajos.length ? enAtajo(T, k.x, k.z, i) : null;
  if(ata && Math.abs(ata.lat)<=ata.a.hw+.6){ yS=ata.y; k.fuera=false; fidx=ata.a.i0+ata.a.di*ata.t; i=((Math.round(fidx)%N)+N)%N; k.enAtajo=true; }
  else {
    k.enAtajo=false; k.fuera=Math.abs(lat)>w+.5;
    const lim=w+marg;
    if(Math.abs(lat)>lim && !(ata)){
      const ex=Math.abs(lat)-lim, sg=Math.sign(lat); k.x-=ttz*sg*ex; k.z-=-ttx*sg*ex; lat=sg*lim;
      k.v*=1-Math.min(.9, dt*2.2); if(k.v>15) k.v-=dt*22;
      const dh=angC(th-k.h); if(Math.abs(dh)<1.7) k.h+=dh*Math.min(1, dt*3.2);
      if(k.drift){ k.drift=0; k.dCarga=0; k.dNivel=0; }
    }
  }
  k.lat=lat;
  const d=circ(fidx-k.f0, N); if(Math.abs(d)<N*.3) k.prog+=d; k.f0=fidx; k.idx=i;
  /* rampas: el piso sube hasta el borde de la rampa, y ahí sale el salto */
  if(!k.enAtajo) for(const si of T.saltos){ const rel=circ(fidx-si, N)*T.paso; if(rel>-RAMPA && rel<=0 && Math.abs(lat)<w){ yS+=(rel+RAMPA)/RAMPA*ALTO_RAMPA; break; } }
  /* saltos y flechas turbo */
  if(suelo && d>0){
    for(const si of T.saltos){ const falta=((si-(fidx-d))%N+N)%N; if(falta<=d && k.v>8 && Math.abs(lat)<w && !k.enAtajo){ k.vy=6.4+k.v*.2; k.aire=.001; k.trucoV=.45; k.truco=false; if(k.pid===R.miPid) R.alFx({k:'salto'}); } }
    for(const t of T.turbos){ if(Math.abs(circ(fidx-t.i, N))<1.3 && Math.abs(lat-t.lat)<3.3){ if(k.boost<.7 && k.pid===R.miPid) R.alFx({k:'flecha'}); k.boost=Math.max(k.boost, 1.05); } }
  }
  /* altura */
  k.ySuelo=yS;
  if(k.aire>0){ k.vy-=30*dt; k.y+=k.vy*dt; k.aire+=dt;
    if(k.y<=yS && k.vy<=0){ k.y=yS; k.vy=0; k.aire=0; if(k.truco){ k.boost=Math.max(k.boost, .85); k.truco=false; if(k.pid===R.miPid) R.alFx({k:'miniturbo', n:1}); } } }
  else if(yS<k.y-.45){ k.aire=.001; k.vy=0; }
  else if(yS>k.y) k.y=yS;   // subiendo (rampa o cuesta): pegado al piso
  else k.y+=(yS-k.y)*Math.min(1, dt*18);
  k.cabeceo+=((k.aire>0 ? Math.max(-.4, Math.min(.4, k.vy*.035)) : Math.atan(pend)*Math.cos(k.h-th))-k.cabeceo)*Math.min(1, dt*8);
  /* choques con otros karts y rebufo */
  let reb=false;
  for(const o of R.karts){
    if(o===k || o.fantasma) continue;
    const dx=o.x-k.x, dz=o.z-k.z, d2=dx*dx+dz*dz;
    if(d2<3.8 && Math.abs(o.y-k.y)<1.6){
      const dd=Math.sqrt(d2)||.01, po=piloto(o.ch).peso, pk=p.peso, parte=o.local ? po/(po+pk) : .8, e=(1.95-dd)*parte;
      k.x-=dx/dd*e; k.z-=dz/dd*e; k.v*=.992;
    } else if(d2<230 && d2>9 && k.v>15 && o.v>12){ const dd=Math.sqrt(d2); if((dx*sx+dz*cz)/dd>.95) reb=true; }
  }
  k.rebT=reb ? Math.min(2, k.rebT+dt) : Math.max(0, k.rebT-dt*2.5);
  const rb=k.rebT>.8; if(rb && !k.rebufo && k.pid===R.miPid) R.alFx({k:'rebufo'}); k.rebufo=rb;
  /* cajas de objetos */
  if(!k.item && !k.itemPend && k.ruleta<=0 && k.fin==null){
    for(let c=0;c<R.cajas.length;c++){ const b=R.cajas[c]; if(R.cajasOff[c]>R.reloj) continue; const ddx=b.x-k.x, ddz=b.z-k.z;
      if(ddx*ddx+ddz*ddz<6.2 && Math.abs(k.y-b.y)<3){ k.ruleta=1.35; R.cajasOff[c]=R.reloj+3.4; R.pedir({k:'caja', pid:k.pid, c}); if(k.pid===R.miPid) R.alFx({k:'caja'}); break; } }
  }
  /* usar el objeto */
  usoObjeto(R, k, inp, trabado);
  /* vueltas */
  const lap=Math.floor(k.prog/N);
  if(lap>k.lapN){
    if(k.lapN>=0){ k.vueltas.push(R.t-k.tVuelta); if(k.pid===R.miPid) R.alFx({k:'vuelta', n:lap+1, t:R.t-k.tVuelta, ultima:lap===R.vueltas-1}); }
    k.tVuelta=R.t; k.lapN=lap;
    if(lap>=R.vueltas && k.fin==null){ k.fin=R.t; k.item=null; k.itemPend=null; if(k.pid===R.miPid) R.alFx({k:'meta'}); if(!k.bot) k.bot={f:.86, niv:'medio', lat:0, cambia:0, usaEn:1e9, turboEn:1e9, auto:true}; }
  }
  const alRev=(sx*ttx+cz*ttz)<-.35 && k.v>4; k.alReves=alRev ? k.alReves+dt : 0;
  k.quieto=(Math.abs(k.v)<3 && !trabado) ? k.quieto+dt : 0;
}

// el botón de usar: el mango se puede mantener apretado (colgando atrás) y se tira al soltar
function usoObjeto(R, k, inp, trabado){
  const us=!!inp.usar, vale=k.fin==null && !k.muerto;
  if((k.item==='mango'||k.item==='mango5') && vale){
    if(us && !k.usarPrev && !trabado) k.mDesde=R.t;
    if(us && k.mDesde!=null && R.t-k.mDesde>.3 && !k.sost){ k.sost=true; if(k.pid===R.miPid) R.alFx({k:'sost'}); }
    if(!us && k.mDesde!=null){ const ad=k.sost && !inp.freno; k.mDesde=null; k.sost=false; usarObjeto(R, k, {ad:ad?1:0}); }
  } else { k.mDesde=null; k.sost=false; if(us && !k.usarPrev && k.item && !trabado && vale) usarObjeto(R, k); }
  k.usarPrev=us;
}
function usarObjeto(R, k, extra){
  const o=k.item;
  if(o==='guampa'){ R.pedir({k:'usar', o, pid:k.pid, x:k.x, y:k.y, z:k.z, h:k.h, f:k.f0, lat:k.lat||0}); k.item=null; k.itemN=0; if(k.pid===R.miPid) R.alFx({k:'tira'}); return; }
  if(o==='sol'){ k.sol=7.5; k.lento=0; k.hielo=0; k.spin=0; }
  if(o==='coco' && !R.arena && k.puesto===1 && R.orden.length>1 && k.pid===R.miPid) R.alFx({k:'cocoAtras'});
  if(o==='chipa' || o==='chipa3') k.boost=Math.max(k.boost, 1.5);
  else if(o==='nanduti') k.escudo=9;
  else if(o==='viento'){ k.viento=5.5; k.lento=0; }
  else if(o==='sol'){}
  else R.pedir(Object.assign({k:'usar', o, pid:k.pid, x:k.x, y:k.y, z:k.z, h:k.h, f:k.f0, lat:k.lat||0, prog:k.prog, v:Math.round(k.v*10)/10}, extra||{}));
  if(k.pid===R.miPid) R.alFx({k:'uso', o});
  k.itemN--; if(k.itemN<=0){ k.item=null; k.itemN=0; }
}
function recolocar(R, k){
  if(R.arena){ const a=Math.atan2(k.x, k.z), rr=R.T.radio*.5; k.x=Math.sin(a)*rr; k.z=Math.cos(a)*rr; k.y=.3; k.h=Math.atan2(-k.x,-k.z); k.v=0; k.vy=0; k.aire=0; k.drift=0; k.spin=0; k.parpadeo=Math.max(k.parpadeo,1.6); k.quieto=0; k.alReves=0; k.steer=0; return; }
  const s=R.T.S[k.idx]; k.x=s.x; k.z=s.z; k.y=s.y+.3; k.h=s.h; k.v=0; k.vy=0; k.aire=0; k.drift=0; k.spin=0; k.parpadeo=1.6; k.quieto=0; k.alReves=0; k.steer=0;
}

/* ---------- karts de otros aparatos: se mueven suave hacia lo último que avisaron ---------- */
function pasoRemoto(R, k, dt){
  const n=k.net; if(!n) return;
  const edad=Math.min(.3, R.reloj-n.at), px=n.x+Math.sin(n.h)*n.v*edad, pz=n.z+Math.cos(n.h)*n.v*edad, a=Math.min(1, dt*11);
  if(Math.abs(px-k.x)+Math.abs(pz-k.z)>40){ k.x=px; k.z=pz; k.y=n.y; k.h=n.h; }
  k.x+=(px-k.x)*a; k.z+=(pz-k.z)*a; k.y+=(n.y-k.y)*a; k.h+=angC(n.h-k.h)*a; k.v=n.v;
  k.rodado+=k.v*dt*2.4; k.steerVis+=(n.st-k.steerVis)*a; k.desliz+=((k.drift||0)-k.desliz)*Math.min(1, dt*7);
  if(R.arena){ k.ySuelo=Math.min(k.y, alturaArena(R.T, k.x, k.z)); } else { const L=ubicar(R.T, k.x, k.z, k.idx, 8, 14); k.idx=L.i; k.ySuelo=Math.min(k.y, L.y); }
  for(const c of ['spin','parpadeo']) if(k[c]>0) k[c]=Math.max(0, k[c]-dt);
}
const empacar = k => [Math.round(k.x*20)/20, Math.round(k.y*20)/20, Math.round(k.z*20)/20, Math.round(k.h*200)/200, Math.round(k.v*10)/10, Math.round(k.prog*50)/50,
  (k.drift>0?1:0)|(k.drift<0?2:0)|(k.boost>0?4:0)|(k.spin>0?8:0)|(k.hielo>0?16:0)|(k.escudo>0?32:0)|(k.viento>0?64:0)|(k.aire>0?128:0)|(k.lento>0?256:0)|((k.dNivel&3)<<10)|(k.parpadeo>0?4096:0)|(k.sost?8192:0)|(k.sol>0?16384:0),
  Math.round(k.steer*10)/10, k.fin==null?0:Math.round(k.fin*1000)/1000, k.item?COD_OBJ.indexOf(k.item)+1:0, k.vidas==null?-1:k.vidas, k.muerto?1:0, k.itemN|0];
function desempacar(R, k, a){
  const fl=a[6];
  k.net={x:a[0], y:a[1], z:a[2], h:a[3], v:a[4], st:a[7], at:R.reloj};
  k.prog=a[5]; k.drift=fl&1?1:fl&2?-1:0; k.boost=fl&4?1:0; if(fl&8){ if(k.spin<=0) k.spin=.4; } else k.spin=0;
  k.hielo=fl&16?1:0; k.escudo=fl&32?1:0; k.viento=fl&64?1:0; k.aire=fl&128?1:0; k.lento=fl&256?1:0; k.dNivel=(fl>>10)&3; if(fl&4096) k.parpadeo=.3; k.sost=!!(fl&8192); k.sol=fl&16384?1:0;
  k.fin=a[8]||null; k.item=a[9]?COD_OBJ[a[9]-1]:null; k.itemN=a[12]|0; k.lapN=Math.floor(k.prog/R.T.N);
  if(R.arena && a[10]!=null && a[10]>=0){ if(R.host){ k.muerto=k.muerto||!!a[11]; } else { k.vidas=a[10]; k.muerto=!!a[11]; } }
}

/* ---------- fantasma del contrarreloj ---------- */
function pasoFantasma(R, k){
  const D=k.datos, q=R.t*10; if(!D || q<0){ k.oculto=q<0; return; }
  const i=Math.floor(q), a=D[Math.min(i, D.length-1)], b=D[Math.min(i+1, D.length-1)], t=q-i;
  k.oculto=i>=D.length-1; k.x=(a[0]+(b[0]-a[0])*t)/10; k.y=(a[1]+(b[1]-a[1])*t)/10; k.z=(a[2]+(b[2]-a[2])*t)/10; k.h=a[3]/100+angC(b[3]/100-a[3]/100)*t;
  k.v=20; k.rodado+=.3; k.ySuelo=k.y; k.parpadeo=k.oculto?1:0;
}

/* ---------- bots ---------- */
function botInput(R, k, dt){
  const T=R.T, N=T.N, S=T.S, b=k.bot, inp=k.inp, p=piloto(k.ch);
  inp.gas=1; inp.freno=0; inp.derrape=0; inp.usar=0;
  if(R.t<0){   // los buenos aprietan justo en el 1; los tranquilos a veces se apuran y patinan
    if(b.larga==null) b.larga = b.niv==='dificil' ? -.75+Math.random()*.4 : b.niv==='medio' ? (Math.random()<.1 ? -2.4 : -1.5+Math.random()*1.3) : (Math.random()<.25 ? -2.6 : -.4+Math.random()*.4);
    inp.gas = R.t>=b.larga ? 1 : 0; inp.dir=0; return; }
  if(R.arena) return botArena(R, k, dt);
  // por dónde va: cambia de carril cada tanto y esquiva al de adelante
  b.cambia-=dt; if(b.cambia<=0){ b.cambia=2.5+Math.random()*4; b.lat=(Math.random()-.5)*S[k.idx].w*1.1; }
  for(const o of R.karts){ if(o===k || o.fantasma) continue; const dp=o.prog-k.prog; if(dp>0 && dp<3.5 && Math.abs((o.lat||0)-(k.lat||0))<2.2 && o.v<k.v+2){ b.lat=(o.lat||0)+((k.lat||0)>(o.lat||0)?3.4:-3.4); b.cambia=1.2; } }
  if(k.item==='guampa' && !b.auto) for(const o of R.karts){ if(o===k || o.fantasma) continue; const dp=o.prog-k.prog; if(dp>-.6 && dp<4){ b.lat=o.lat||0; b.cambia=.8; } }   // con la guampa va a chocar
  const mira=3+Math.floor(Math.max(0,k.v)*.16), s=S[(k.idx+mira)%N], lim=s.w-1.6, la=Math.max(-lim, Math.min(lim, b.lat));
  const tx=s.x+s.nx*la, tz=s.z+s.nz*la, dh=angC(Math.atan2(tx-k.x, tz-k.z)-k.h);
  inp.dir=Math.max(-1, Math.min(1, -dh*2.6));
  // cuánto frenar en las curvas
  const giro=1.75+p.man*.11, curva=T.vmax[(k.idx+2)%N], vCurva=curva>.004 ? giro/curva*(b.niv==='dificil'?1.05:b.niv==='medio'?.95:.85) : 99;
  if(k.v>vCurva+3) { inp.gas=0; inp.freno=1; } else if(k.v>vCurva) inp.gas=0;
  // la goma: si se escapa mucho afloja, si queda muy atrás aprieta
  const yo=R.porPid[R.miPid], lider=R.karts.reduce((m,o)=>o.humano && !o.fantasma && (!m||o.prog>m.prog)?o:m, null) || yo;
  if(lider && !b.auto){ const dif=(k.prog-lider.prog)*T.paso; b.goma = dif>70 ? .93 : dif<-90 ? (b.niv==='facil'?1.03:1.07) : 1; }
  // mini turbos al salir de las curvas (los buenos)
  if(b.niv!=='facil' && !b.auto){ b.turboEn-=dt; if(b.turboEn<=0 && curva<.012 && T.vmax[(k.idx+N-8)%N]>.03){ k.boost=Math.max(k.boost, b.niv==='dificil'?.9:.55); b.turboEn=b.niv==='dificil'?5:10; } }
  // objetos
  if((k.item==='mango'||k.item==='mango5') && !b.auto){
    // la lleva colgando atrás; la suelta cuando viene alguien atrás, o la tira adelante si hay uno a tiro
    const atr=R.karts.some(q=>q!==k && !q.fantasma && q.prog<k.prog && k.prog-q.prog<6), ade=R.karts.some(q=>q!==k && !q.fantasma && q.prog-k.prog>4 && q.prog-k.prog<9);
    botMango(R, k, atr, ade && Math.random()<.03, inp);
  }
  else if(k.item && !b.auto){
    if(!b.usaEn || b.usaEn>R.t+9) b.usaEn=R.t+.8+Math.random()*3.5;
    if(R.t>=b.usaEn){
      const o=k.item, adelante=R.karts.some(q=>q!==k && !q.fantasma && q.prog>k.prog && q.prog-k.prog<18), atras=R.karts.some(q=>q!==k && !q.fantasma && q.prog<k.prog && k.prog-q.prog<10);
      const ok = o==='chipa'||o==='chipa3' ? curva<.012 && !k.fuera : o==='mango' ? atras || Math.random()<.01 : o==='coco' ? (k.puesto===1 ? atras : adelante) : o==='terere' ? adelante : o==='guampa' ? (adelante && Math.random()<.25) || R.t-(k.itemT||0)>20 : true;
      if(ok){ inp.usar=1; k.usarPrev=0; b.usaEn=R.t+1+Math.random()*2.5; }
    }
  }
  // si quedó trabado, vuelve a la pista
  if(k.quieto>2.2 || k.alReves>2.5) recolocar(R, k);
}

// los bots con mango: lo mantienen colgando y lo sueltan (atrás o adelante) de a uno
function botMango(R, k, atr, ade, inp){
  const b=k.bot, listo=R.t-(k.itemT||0)>.8 && R.t-(b.mSolto||0)>1.5, quiere=atr || ade || R.t-(b.mSolto||k.itemT||0)>22;
  if(k.mDesde==null) inp.usar=1;
  else if(listo && quiere){ inp.usar=0; b.mSolto=R.t; if(atr || !ade) inp.freno=1; }
  else inp.usar=1;
}
/* ---------- lo que decide el anfitrión: objetos sueltos, golpes, quién gana ---------- */
function sortear(R, k){
  if(R.arena){   // en la batalla: al que le quedan menos corazones le tocan cosas más fuertes
    const poco=1-((k.vidas||1)-1)/Math.max(1, R.vidas-1);
    const W={chipa:1.6, chipa3:.6, mango:2.2, mango5:.8, coco:3.6+poco, terere:1.8+2*poco, nanduti:1.6+poco, tormenta:.4+poco*.6, viento:.3+poco*1.2, guampa:1.1, sol:.2+poco*1.2, mainumby:R.objs.some(o=>o.t==='mainumby')?0:.2+poco*.8};
    let tot=0; for(const o in W) tot+=W[o]; let x=Math.random()*tot; for(const o in W){ x-=W[o]; if(x<=0) return o; } return 'coco';
  }
  const n=R.orden.length, rel=n>1 ? (k.puesto-1)/(n-1) : .5;
  // el que va adelante recibe cosas flojas (cáscaras, cocos, escudo); el del fondo tiene chance de lo bueno para alcanzar a los primeros
  const hay=R.objs.some(o=>o.t==='mainumby');
  const W={chipa:3+rel, chipa3:rel>.3?3.5*rel:0, mango:4.5*(1-rel)+.4, mango5:rel<.75?1.5:.3, coco:3*(1-rel*.5), terere:rel>.1?1.4+1.6*rel:0, guampa:rel<.7?1.4:.5,
    nanduti:2.4*(1-rel)+.4, tormenta:rel>.55?1.4*rel:0, viento:rel>.65?2.2*rel:0, sol:rel>.6?2.6*rel:0, mainumby:!hay && rel>.45?1.8*rel:0};
  if(n<2){ W.coco=W.terere=W.tormenta=W.mango=W.mango5=W.guampa=W.mainumby=0; }
  let tot=0; for(const o in W) tot+=W[o]; let x=Math.random()*tot;
  for(const o in W){ x-=W[o]; if(x<=0) return o; } return 'chipa';
}
function hostPedido(R, d){
  const k=R.porPid[d.pid]; if(!k) return;
  if(d.k==='caja'){
    R.cajasOff[d.c]=R.reloj+3.4;
    const o=sortear(R, k);
    if(k.local){ k.itemPend=o; if(k.ruleta<=0) k.ruleta=1.2; } else R.emitir({k:'obj', pid:k.pid, o});
  } else if(d.k==='usar'){
    const T=R.T, id='o'+(++R.seq);
    if(d.o==='mango5') d.o='mango';
    if(d.o==='mango' && d.ad){   // tirada adelante: vuela en arco y cae en tu carril
      const sx=Math.sin(d.h), cz=Math.cos(d.h), L=22+Math.max(0, d.v||0)*.5, x0=d.x+sx*1.6, z0=d.z+cz*1.6, y0=d.y+1.2; let x1, y1, z1;
      if(R.arena){ x1=d.x+sx*L; z1=d.z+cz*L; const dd=Math.hypot(x1, z1), lim=T.radio-3; if(dd>lim){ x1*=lim/dd; z1*=lim/dd; } y1=alturaArena(T, x1, z1); }
      else { const N=T.N, f=d.f+L/T.paso, j=((Math.floor(f)%N)+N)%N, s=T.S[j], la=Math.max(-(s.w-1), Math.min(s.w-1, d.lat||0)); x1=s.x+s.nx*la; z1=s.z+s.nz*la; y1=s.y; }
      R.objs.push({id, t:'mango', x:x0, y:y0, z:z0, x0, y0, z0, x1, y1, z1, vuelo:0, dur:.8, de:d.pid, edad:0, vida:70});
    }
    else if(d.o==='mango') R.objs.push({id, t:'mango', x:d.x-Math.sin(d.h)*2.8, y:d.y, z:d.z-Math.cos(d.h)*2.8, de:d.pid, edad:0, vida:70});
    else if(d.o==='mainumby'){   // va siempre por el que va primero
      const lider=objetivoMainumby(R, null); const sx=Math.sin(d.h), cz=Math.cos(d.h);
      if(R.arena) R.objs.push({id, t:'mainumby', x:d.x+sx*2.6, y:d.y+1, z:d.z+cz*2.6, vx:sx*48*R.ritmoF, vz:cz*48*R.ritmoF, de:d.pid, a:lider?lider.pid:null, edad:0, vida:25, vel:48*R.ritmoF});
      else R.objs.push({id, t:'mainumby', f:d.f+1.2, lat:d.lat, x:d.x, y:d.y+1, z:d.z, de:d.pid, a:lider?lider.pid:null, edad:0, vida:35, vel:78*R.ritmoF});
    }
    else if(R.arena && (d.o==='coco' || d.o==='terere' || d.o==='guampa')){
      // en la arena el coco sale derecho y rebota en las paredes; el tereré busca al más cercano que tenga adelante
      const vel=(d.o==='terere'?44:54)*R.ritmoF, sx=Math.sin(d.h), cz=Math.cos(d.h);
      let blanco=null, mejor=1e9; for(const q of R.karts){ if(q.pid===d.pid || q.muerto || q.fantasma) continue; const dx=q.x-d.x, dz=q.z-d.z, dd=Math.hypot(dx,dz), fr=(dx*sx+dz*cz)/(dd||1), pe=dd*(fr>.2?1:2.5); if(pe<mejor){ mejor=pe; blanco=q; } }
      R.objs.push({id, t:d.o, x:d.x+sx*2.6, y:d.y, z:d.z+cz*2.6, vx:sx*vel, vz:cz*vel, de:d.pid, a:d.o==='terere'&&blanco?blanco.pid:null, edad:0, vida:d.o==='terere'?9:6, vel});
    }
    else if(d.o==='coco'){ const atras=k.puesto===1 && R.orden.length>1;   // el que va primero lo tira para atrás
      R.objs.push({id, t:'coco', f:d.f+(atras?-1.4:1.2), lat:d.lat, x:d.x, y:d.y, z:d.z, de:d.pid, edad:0, vida:atras?5:7, vel:(atras?-44:58)*R.ritmoF}); }
    else if(d.o==='guampa') R.objs.push({id, t:'guampa', f:d.f+1.2, lat:d.lat, x:d.x, y:d.y, z:d.z, de:d.pid, edad:0, vida:6, vel:56*R.ritmoF});
    else if(d.o==='terere'){ const ad=R.orden[k.puesto-2]; R.objs.push({id, t:'terere', f:d.f+1.2, lat:d.lat, x:d.x, y:d.y, z:d.z, de:d.pid, a:ad&&ad.fin==null?ad.pid:null, edad:0, vida:11, vel:52*R.ritmoF}); }
    else if(d.o==='tormenta') R.emitir({k:'tormenta', de:d.pid, dur:5.5});
    R.emitir({k:'uso', pid:d.pid, o:d.o});
  }
}
function objetivoMainumby(R, o){
  const vivos=R.orden.filter(q=>!q.fantasma && !q.muerto && q.fin==null);
  return vivos[0] || null;
}
function golpear(R, k, c, por, forzar){
  if(k.muerto || (R.arena && R.estado==='fin')) return;   // terminada la batalla ya nadie pierde corazones
  if(k.fin!=null || k.spin>0 || k.hielo>0 || k.parpadeo>0) return;
  if(forzar){ R.emitir({k:'golpe', pid:k.pid, c, por}); return true; }   // el mainumby al primero: le da sí o sí
  if(k.viento>0 || k.sol>0) return;
  if(k.escudo>0){ R.emitir({k:'escudo', pid:k.pid}); return false; }
  R.emitir({k:'golpe', pid:k.pid, c, por}); return true;
}
function pasoHost(R, dt){
  const T=R.T, N=T.N, S=T.S;
  for(let q=R.objs.length-1; q>=0; q--){
    const o=R.objs[q]; o.edad+=dt; o.vida-=dt; let fuera=o.vida<=0;
    if(o.dur){ o.vuelo+=dt; const t=Math.min(1, o.vuelo/o.dur); o.x=o.x0+(o.x1-o.x0)*t; o.z=o.z0+(o.z1-o.z0)*t; o.y=o.y0+(o.y1-o.y0)*t+Math.sin(t*Math.PI)*4.5; if(t<1) continue; o.dur=0; o.y=o.y1; }
    if(R.arena && o.t!=='mango') moverObjArena(R, o, dt);
    else if(o.t!=='mango'){
      if(o.t==='mainumby'){ const l=objetivoMainumby(R, o); if(!l){ R.objs.splice(q,1); continue; } o.a=l.pid; }
      const obj=o.a ? R.porPid[o.a] : null;
      if(obj && obj.fin==null && Math.hypot(obj.x-o.x, obj.z-o.z)<22){ const dx=obj.x-o.x, dz=obj.z-o.z, dd=Math.hypot(dx,dz)||1, pas=Math.min(dd, o.vel*1.15*dt); o.x+=dx/dd*pas; o.z+=dz/dd*pas; o.y+=(obj.y+(o.t==='mainumby'?1:0)-o.y)*.3; o.f=obj.idx; o.lat=obj.lat||0; }
      else { o.f+=o.vel*dt/T.paso; if(obj){ const lo=obj.local ? (obj.lat||0) : detalle(T, obj.x, obj.z, obj.idx).lat; o.lat+=(lo-o.lat)*Math.min(1, dt*2.5); }
        const j=((Math.floor(o.f)%N)+N)%N, s=S[j], s2=S[(j+1)%N], t=o.f-Math.floor(o.f), la=Math.max(-s.w, Math.min(s.w, o.lat));
        o.x=s.x+(s2.x-s.x)*t+s.nx*la; o.z=s.z+(s2.z-s.z)*t+s.nz*la; o.y=s.y+(s2.y-s.y)*t+(o.t==='mainumby'?1:0); }
    }
    if(!fuera) for(const k of R.karts){
      if(k.fantasma || k.muerto || (k.pid===o.de && o.edad<(o.t==='mango'?1.2:(R.arena?1.4:.6)))) continue;
      const dx=k.x-o.x, dz=k.z-o.z, r=o.t==='mango'?2:2.3;
      if(dx*dx+dz*dz<r*r && Math.abs(k.y-o.y)<2.6){
        if(o.t==='mainumby'){   // al primero le da sí o sí; a los que se le cruzan los voltea y sigue de largo
          if(k.pid===o.a){ if(golpear(R, k, 'boom', o.de, true)){ fuera=true; break; } }
          else golpear(R, k, 'spin', o.de);
          continue; }
        if(o.t==='coco' && k.sost) R.emitir({k:'quita', pid:k.pid, por:o.de});   // el coco le saca el mango que lleva colgando, sin hacerle daño
        else golpear(R, k, o.t==='terere'||o.t==='guampa'?'hielo':'spin', o.de);
        fuera=true; break; }
    }
    if(fuera) R.objs.splice(q, 1);
  }
  // el que va con viento norte voltea al que toca
  for(const a of R.karts) if((a.viento>0 || a.sol>0) && !a.muerto) for(const b of R.karts){ if(b===a || b.fantasma || b.muerto) continue; const dx=a.x-b.x, dz=a.z-b.z; if(dx*dx+dz*dz<5.3) golpear(R, b, 'spin', a.pid); }
  // la guampa helada congela al que toca (o al que la toca), gastando una carga
  for(const a of R.karts){ if(a.item!=='guampa' || a.fantasma || a.muerto || a.fin!=null || (a.gT||0)>R.reloj) continue;
    for(const b of R.karts){ if(b===a || b.fantasma || b.muerto) continue; const dx=a.x-b.x, dz=a.z-b.z;
      if(dx*dx+dz*dz<5.3 && Math.abs(a.y-b.y)<1.8){ a.gT=R.reloj+1.2; if(golpear(R, b, 'hielo', a.pid)) R.emitir({k:'gasta', pid:a.pid, a:b.pid}); break; } } }
  // final
  if(R.arena){ finArena(R); return; }
  if(R.estado==='carrera'){
    const hum=R.karts.filter(k=>k.humano && !k.fantasma && !k.ausente), listos=hum.filter(k=>k.fin!=null).length, todos=R.karts.filter(k=>!k.fantasma);
    if(R.cierre==null && hum.length && listos===hum.length) R.cierre=R.t+3.2;
    else if(R.cierre==null && (listos>0 || (!hum.length && todos.some(k=>k.fin!=null)))) R.cierre=R.t+35;
    if(listos===hum.length && hum.length && R.cierre>R.t+3.2) R.cierre=R.t+3.2;
    if((R.cierre!=null && R.t>=R.cierre) || todos.every(k=>k.fin!=null)){ R.estado='fin'; R.alTerminar(resultado(R)); }
  }
}
function resultado(R){
  if(R.arena) return R.orden.map((k,i)=>({pid:k.pid, t:Math.round((k.muerto&&k.finT!=null?k.finT:Math.min(R.t,R.limite))*1000)/1000, est:false, mejor:null, pts:PUNTOS[i]||0, vidas:Math.max(0,k.vidas|0), golpes:k.golpes|0, afuera:!!k.muerto}));
  const N=R.T.N;
  return R.orden.map((k,i)=>{
    let t=k.fin, est=false;
    if(t==null){ const falta=(R.vueltas*N-k.prog)*R.T.paso; t=R.t+falta/Math.max(14, 24*R.ritmoF); est=true; }
    return {pid:k.pid, t:Math.round(t*1000)/1000, est, mejor:k.vueltas.length?Math.round(Math.min(...k.vueltas)*1000)/1000:null, pts:PUNTOS[i]||0};
  });
}
/* lo que pasa en todos los aparatos cuando el anfitrión avisa algo */
function aplicarEvento(R, e){
  const k=R.porPid[e.pid];
  if(e.k==='golpe' && k){ if(k.local && k.sost){ k.item=null; k.itemN=0; } k.sost=false; k.mDesde=null; }   // si te pegan, se te cae el mango que llevabas
  if(e.k==='gasta' && k){ if(k.local && k.item==='guampa'){ k.itemN--; if(k.itemN<=0){ k.item=null; k.itemN=0; } } return R.alFx(e); }
  if(e.k==='quita' && k){ if(k.local && (k.item==='mango'||k.item==='mango5')){ k.itemN--; if(k.itemN<=0){ k.item=null; k.itemN=0; } } k.sost=false; k.mDesde=null; return R.alFx(e); }
  if(e.k==='golpe' && k && e.c==='boom' && k.local){ k.vy=7; k.aire=.001; }   // el mainumby lo hace volar
  if(e.k==='golpe' && k && R.arena){
    if(k.muerto) return R.alFx(e);
    k.vidas=Math.max(0, (k.vidas==null?R.vidas:k.vidas)-1); const por=R.porPid[e.por]; if(por && por!==k) por.golpes=(por.golpes|0)+1;
    if(k.local){ if(e.c==='hielo'){ k.hielo=1.7; k.v*=.2; } else { k.spin=e.c==='boom'?1.7:1.1; k.v*=e.c==='boom'?.1:.35; } k.drift=0; k.dCarga=0; k.dNivel=0; k.boost=0; k.sol=0; k.viento=0; k.parpadeo=3.2; }
    else { if(e.c==='hielo') k.hielo=1; else k.spin=1; k.parpadeo=3.2; }
    if(k.vidas<=0 && R.host && !k.muerto) R.emitir({k:'afuera', pid:k.pid, t:Math.round(R.t*100)/100});
  } else if(e.k==='afuera' && k){
    k.muerto=true; k.vidas=0; k.finT=e.t; k.item=null; k.itemPend=null; k.ruleta=0; k.v=0; k.escudo=0; k.viento=0;
  } else if(e.k==='golpe' && k){
    if(k.local){ if(e.c==='hielo'){ k.hielo=1.7; k.v*=.2; } else { k.spin=e.c==='boom'?1.7:1.1; k.v*=e.c==='boom'?.1:.35; } k.drift=0; k.dCarga=0; k.dNivel=0; k.boost=0; k.sol=0; k.viento=0; k.parpadeo=0; }
    else if(e.c==='hielo') k.hielo=1; else k.spin=1;
  } else if(e.k==='escudo' && k){ k.escudo=0; k.parpadeo=k.local?.9:0; }
  else if(e.k==='tormenta'){ R.tormenta=e.dur; for(const q of R.karts) if(q.local && q.pid!==e.de && q.viento<=0 && !(q.sol>0) && q.fin==null) q.lento=e.dur; }
  else if(e.k==='obj' && k && k.local){ if(e.o){ k.itemPend=e.o; if(k.ruleta<=0) k.ruleta=.6; } else k.ruleta=0; }
  R.alFx(e);
}
/* =====================================================================
   Modo batalla (Ñorairõ): la arena
   ===================================================================== */
function alturaArena(T, x, z){
  for(const r of T.rampas){ const dx=x-r.x, dz=z-r.z, s=Math.sin(r.h), c=Math.cos(r.h), al=dx*s+dz*c, la=dx*c-dz*s;
    if(al>-RAMPA && al<=0 && Math.abs(la)<4.2) return (al+RAMPA)/RAMPA*ALTO_RAMPA; }
  return 0;
}
function pasoArena(R, k, dt, p, sx, cz, trabado, inp){
  const T=R.T, suelo=k.aire<=0;
  k.fuera=false; k.enAtajo=false; k.lat=0; k.idx=0;
  // pared redonda de la arena
  const d=Math.hypot(k.x, k.z), lim=T.radio-1.4;
  if(d>lim){ const nx=k.x/d, nz=k.z/d; k.x=nx*lim; k.z=nz*lim; const vn=sx*nx+cz*nz; if(vn>0){ k.v*=1-Math.min(.6, vn*.7); const ta=Math.atan2(sx-nx*vn*1.6, cz-nz*vn*1.6); k.h+=angC(ta-k.h)*.5; } if(k.drift){ k.drift=0; k.dCarga=0; k.dNivel=0; } }
  // obstáculos (redondos)
  for(const o of T.obst){ const dx=k.x-o.x, dz=k.z-o.z, dd=Math.hypot(dx,dz), m=o.r+1.1; if(dd<m && dd>.01){ k.x=o.x+dx/dd*m; k.z=o.z+dz/dd*m; const vn=-(sx*dx+cz*dz)/dd; if(vn>0) k.v*=1-Math.min(.5, vn*.6); } }
  // rampas: el piso sube hasta el borde, y ahí sale el salto
  const yS=alturaArena(T, k.x, k.z);
  if(suelo && k.enRampa && yS===0 && k.v>8){ k.vy=6.4+k.v*.2; k.aire=.001; k.trucoV=.45; k.truco=false; if(k.pid===R.miPid) R.alFx({k:'salto'}); }
  k.enRampa=yS>0;
  // flechas turbo
  if(suelo) for(const t of T.turbos){ if((k.x-t.x)**2+(k.z-t.z)**2<11){ if(k.boost<.7 && k.pid===R.miPid) R.alFx({k:'flecha'}); k.boost=Math.max(k.boost, 1.05); } }
  // altura
  k.ySuelo=yS;
  if(k.aire>0){ k.vy-=30*dt; k.y+=k.vy*dt; k.aire+=dt;
    if(k.y<=yS && k.vy<=0){ k.y=yS; k.vy=0; k.aire=0; if(k.truco){ k.boost=Math.max(k.boost, .85); k.truco=false; if(k.pid===R.miPid) R.alFx({k:'miniturbo', n:1}); } } }
  else if(yS<k.y-.45){ k.aire=.001; k.vy=0; }
  else if(yS>k.y) k.y=yS; else k.y+=(yS-k.y)*Math.min(1, dt*18);
  k.cabeceo+=((k.aire>0 ? Math.max(-.4, Math.min(.4, k.vy*.035)) : (k.enRampa ? Math.atan2(ALTO_RAMPA,RAMPA)*Math.cos(k.h-T.rampas.reduce((m,r)=>Math.hypot(k.x-r.x,k.z-r.z)<Math.hypot(k.x-m.x,k.z-m.z)?r:m, T.rampas[0]).h) : 0))-k.cabeceo)*Math.min(1, dt*8);
  // choques entre karts (sin daño)
  for(const o of R.karts){
    if(o===k || o.fantasma || o.muerto) continue;
    const dx=o.x-k.x, dz=o.z-k.z, d2=dx*dx+dz*dz;
    if(d2<3.8 && Math.abs(o.y-k.y)<1.6){ const dd=Math.sqrt(d2)||.01, po=piloto(o.ch).peso, pk=p.peso, parte=o.local ? po/(po+pk) : .8, e=(1.95-dd)*parte; k.x-=dx/dd*e; k.z-=dz/dd*e; k.v*=.992; }
  }
  k.rebufo=false;
  // cajas
  if(!k.item && !k.itemPend && k.ruleta<=0){
    for(let c=0;c<R.cajas.length;c++){ const b=R.cajas[c]; if(R.cajasOff[c]>R.reloj) continue; const ddx=b.x-k.x, ddz=b.z-k.z;
      if(ddx*ddx+ddz*ddz<6.2 && k.y<3){ k.ruleta=1.35; R.cajasOff[c]=R.reloj+5; R.pedir({k:'caja', pid:k.pid, c}); if(k.pid===R.miPid) R.alFx({k:'caja'}); break; } }
  }
  usoObjeto(R, k, inp, trabado);
  k.alReves=0; k.quieto=(Math.abs(k.v)<2 && !trabado && inp.gas) ? k.quieto+dt : 0;
}
// el anfitrión mueve el coco (derecho, rebota) y el tereré (persigue)
function moverObjArena(R, o, dt){
  const T=R.T;
  if(o.t==='mainumby'){ const l=objetivoMainumby(R, o); o.a=l?l.pid:null; if(l){ const dx=l.x-o.x, dz=l.z-o.z, ang=Math.atan2(o.vx,o.vz), gi=angC(Math.atan2(dx,dz)-ang), na=ang+Math.max(-dt*5, Math.min(dt*5, gi)); o.vx=Math.sin(na)*o.vel; o.vz=Math.cos(na)*o.vel; o.y+=(l.y+1-o.y)*.2; } }
  else if(o.t==='terere' && o.a){ const q=R.porPid[o.a]; if(q && !q.muerto){ const dx=q.x-o.x, dz=q.z-o.z, dd=Math.hypot(dx,dz)||1, ang=Math.atan2(o.vx,o.vz), obj=Math.atan2(dx,dz), gi=angC(obj-ang), na=ang+Math.max(-dt*2.6, Math.min(dt*2.6, gi)); o.vx=Math.sin(na)*o.vel; o.vz=Math.cos(na)*o.vel; o.y+=(q.y-o.y)*.2; } else o.a=null; }
  o.x+=o.vx*dt; o.z+=o.vz*dt;
  const d=Math.hypot(o.x, o.z), lim=T.radio-1.2;
  if(d>lim){ const nx=o.x/d, nz=o.z/d, vn=o.vx*nx+o.vz*nz; o.x=nx*lim; o.z=nz*lim; if(vn>0){ o.vx-=2*vn*nx; o.vz-=2*vn*nz; } }
  for(const b of T.obst){ const dx=o.x-b.x, dz=o.z-b.z, dd=Math.hypot(dx,dz), m=b.r+.8; if(dd<m && dd>.01){ const nx=dx/dd, nz=dz/dd, vn=o.vx*nx+o.vz*nz; o.x=b.x+nx*m; o.z=b.z+nz*m; if(vn<0){ o.vx-=2*vn*nx; o.vz-=2*vn*nz; } } }
  if(o.t==='coco' || o.t==='guampa') o.y=Math.max(0, alturaArena(T, o.x, o.z));
}
function ordenArena(R){
  return R.karts.filter(k=>!k.fantasma).sort((a,b)=>{
    if(!!a.muerto!==!!b.muerto) return a.muerto?1:-1;
    if(a.muerto) return (b.finT||0)-(a.finT||0);
    return ((b.vidas|0)-(a.vidas|0)) || ((b.golpes|0)-(a.golpes|0));
  });
}
function finArena(R){
  if(R.estado!=='carrera') return;
  const vivos=R.karts.filter(k=>!k.fantasma && !k.muerto);
  if(R.cierre==null && (vivos.length<=1 || R.t>=R.limite)){ R.cierre=R.t+(vivos.length<=1?2.5:.2); }
  if(R.cierre!=null && R.t>=R.cierre){ R.estado='fin'; R.alTerminar(resultado(R)); }
}
// bots de la batalla: buscan una caja si no tienen nada, y si tienen algo salen a cazar
function botArena(R, k, dt){
  const T=R.T, b=k.bot, inp=k.inp;
  if(k.muerto){ inp.gas=0; inp.dir=0; return; }
  const sx=Math.sin(k.h), cz=Math.cos(k.h);
  let tx=0, tz=0, blanco=null;
  if(!k.item){ let m=1e9; R.cajas.forEach((c,i)=>{ if(R.cajasOff[i]>R.reloj) return; const d=Math.hypot(c.x-k.x, c.z-k.z)*(((c.x-k.x)*sx+(c.z-k.z)*cz)>0?1:1.8); if(d<m){ m=d; tx=c.x; tz=c.z; } }); if(m===1e9){ tx=-k.x*.3; tz=-k.z*.3; } }
  else { let m=1e9; for(const q of R.karts){ if(q===k || q.muerto || q.fantasma) continue; const d=Math.hypot(q.x-k.x, q.z-k.z); if(d<m){ m=d; blanco=q; } } if(blanco){ tx=blanco.x; tz=blanco.z; if((k.item==='mango'||k.item==='mango5')){ tx=k.x+(k.x-blanco.x); tz=k.z+(k.z-blanco.z); } } }
  // lejos de la pared y de los obstáculos
  const d=Math.hypot(k.x, k.z); if(d>T.radio-12){ tx=tx*.4-k.x*.6; tz=tz*.4-k.z*.6; }
  for(const o of T.obst){ const ox=o.x-k.x, oz=o.z-k.z, al=ox*sx+oz*cz, la=ox*cz-oz*sx; if(al>0 && al<o.r+12 && Math.abs(la)<o.r+2.5){ const lado=la>0?-1:1; tx=o.x+cz*lado*(o.r+5); tz=o.z-sx*lado*(o.r+5); } }
  const dh=angC(Math.atan2(tx-k.x, tz-k.z)-k.h);
  inp.dir=Math.max(-1, Math.min(1, -dh*2.4)); inp.gas=1; inp.freno=0; inp.derrape=0; inp.usar=0;
  if(Math.abs(dh)>1.9 && k.v>6){ inp.gas=0; inp.freno=1; }
  // usar el objeto
  if((k.item==='mango'||k.item==='mango5')){
    let atr=false, ade=false;
    if(blanco){ const dx=blanco.x-k.x, dz=blanco.z-k.z, dd=Math.hypot(dx,dz), fr=(dx*sx+dz*cz)/(dd||1); if(fr<-.6 && dd<18) atr=true; else if(fr>.9 && dd>14 && dd<32 && Math.random()<.05) ade=true; }
    botMango(R, k, atr, ade, inp);
  }
  else if(k.item){
    if(!b.usaEn || b.usaEn>R.t+9) b.usaEn=R.t+.6+Math.random()*2.5;
    if(R.t>=b.usaEn){
      const o=k.item; let ok=true;
      if(blanco){ const dx=blanco.x-k.x, dz=blanco.z-k.z, dd=Math.hypot(dx,dz), fr=(dx*sx+dz*cz)/(dd||1);
        if(o==='coco' || o==='guampa') ok = fr>.93 && dd<45; else if(o==='terere') ok = dd<60; else if(o==='mango') ok = fr<-.6 && dd<25 || Math.random()<.004; }
      if(o==='guampa') ok=ok && Math.random()<.3 || R.t-(k.itemT||0)>18;
      if(b.niv==='facil' && Math.random()<.5) ok=ok && Math.random()<.02;
      if(ok){ inp.usar=1; k.usarPrev=0; b.usaEn=R.t+1+Math.random()*2; }
    }
  }
  if(k.quieto>1.6){ inp.gas=0; inp.freno=1; if(k.quieto>2.6){ k.h+=Math.PI*.6; k.quieto=0; } }
}
const fmtT = t => { if(t==null) return '—'; const m=Math.floor(t/60), s=t-m*60; return m+':'+(s<10?'0':'')+s.toFixed(2); };
