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
  mango:   {e:'🥭', n:'Cáscara de mango',   d:'La dejás atrás: el que la pisa, patina.'},
  coco:    {e:'🥥', n:'Coco',               d:'Sale rodando por la pista y voltea al primero que toca.'},
  terere:  {e:'🧉', n:'Tereré helado',      d:'Persigue al que va adelante y lo deja congelado.'},
  nanduti: {e:'🕸️', n:'Escudo de ñandutí', d:'Te cubre de un golpe por un rato.'},
  tormenta:{e:'⛈️', n:'Tormenta',          d:'Llueve sobre todos los demás y van más lento.'},
  viento:  {e:'🌬️', n:'Viento norte',      d:'Volás un rato: nadie te para y volteás al que tocás.'},
};
const COD_OBJ = Object.keys(OBJETOS);
const NIVELES = [{id:'facil', n:'Tranquilo', f:.83}, {id:'medio', n:'Normal', f:.92}, {id:'dificil', n:'Mbarete', f:1}];
const RITMOS = [{id:'paseo', n:'Paseo', f:.84}, {id:'normal', n:'Normal', f:1}, {id:'fondo', n:'A fondo', f:1.16}];
const PUNTOS = [15,12,10,8,6,4,2,1];
const circ = (d, N) => { d%=N; if(d>N/2) d-=N; if(d<-N/2) d+=N; return d; };
const angC = d => Math.atan2(Math.sin(d), Math.cos(d));

function nuevoKart(R, e, j){
  const T=R.T, fila=Math.floor(j/2), i=((T.N-3-fila*2-(j%2))%T.N+T.N)%T.N, s=T.S[i], lat=(j%2?-1:1)*s.w*.42;
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
    pedir(){}, emitir(){}, alFx(){}, alTerminar(){}, orden:[]};
  if(cfg.objetos!==false) T.cajas.forEach(i=>{ const s=T.S[i]; [-.62,-.21,.21,.62].forEach(q=>R.cajas.push({x:s.x+s.nx*s.w*q, y:s.y, z:s.z+s.nz*s.w*q, i})); });
  // sin objetos (contrarreloj) las cajas quedan escondidas para siempre
  const nCajas=T.cajas.length*4; for(let i=0;i<nCajas;i++) R.cajasOff.push(cfg.objetos===false ? 1e9 : 0);
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
  R.orden=R.karts.filter(k=>!k.fantasma).sort((a,b)=> (a.fin!=null||b.fin!=null) ? (a.fin==null?1:b.fin==null?-1:a.fin-b.fin) : b.prog-a.prog);
  R.orden.forEach((k,i)=>k.puesto=i+1);
}

function pasoKart(R, k, dt, corre){
  const T=R.T, N=T.N, p=piloto(k.ch), inp=k.inp, f=R.ritmoF;
  for(const c of ['boost','spin','hielo','escudo','lento','viento','parpadeo','ruleta']) if(k[c]>0) k[c]=Math.max(0, k[c]-dt);
  if(k.itemPend && k.ruleta<=0){ k.item=k.itemPend; k.itemN=OBJETOS[k.item].x||1; k.itemPend=null; if(k.pid===R.miPid) R.alFx({k:'tengo', o:k.item}); }
  if(!corre){ if(inp.gas){ if(k.gasDesde==null) k.gasDesde=R.t; } else k.gasDesde=null; return; }
  if(!k.largo){ k.largo=true; if(k.gasDesde!=null && k.gasDesde>-.95 && k.gasDesde<-.15){ k.boost=1.2; if(k.pid===R.miPid) R.alFx({k:'largada'}); } }
  const trabado=k.hielo>0||k.spin>0, turbo=k.boost>0||k.viento>0, suelo=k.aire<=0;
  const gas=trabado?0:inp.gas, freno=trabado?0:inp.freno, dir=trabado?0:inp.dir;
  /* velocidad */
  let vmax=(26.5+p.vel*1.15)*f;
  if(k.fuera && !turbo) vmax*=.5;
  if(k.lento>0 && k.viento<=0) vmax*=.7;
  if(k.rebufo) vmax*=1.09;
  if(k.viento>0) vmax*=1.42; else if(k.boost>0) vmax*=1.32;
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
  const us=!!inp.usar; if(us && !k.usarPrev && k.item && !trabado && k.fin==null) usarObjeto(R, k); k.usarPrev=us;
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

function usarObjeto(R, k){
  const o=k.item;
  if(o==='chipa' || o==='chipa3') k.boost=Math.max(k.boost, 1.5);
  else if(o==='nanduti') k.escudo=9;
  else if(o==='viento'){ k.viento=5.5; k.lento=0; }
  else R.pedir({k:'usar', o, pid:k.pid, x:k.x, y:k.y, z:k.z, h:k.h, f:k.f0, lat:k.lat||0, prog:k.prog});
  if(k.pid===R.miPid) R.alFx({k:'uso', o});
  k.itemN--; if(k.itemN<=0){ k.item=null; k.itemN=0; }
}
function recolocar(R, k){
  const s=R.T.S[k.idx]; k.x=s.x; k.z=s.z; k.y=s.y+.3; k.h=s.h; k.v=0; k.vy=0; k.aire=0; k.drift=0; k.spin=0; k.parpadeo=1.6; k.quieto=0; k.alReves=0; k.steer=0;
}

/* ---------- karts de otros aparatos: se mueven suave hacia lo último que avisaron ---------- */
function pasoRemoto(R, k, dt){
  const n=k.net; if(!n) return;
  const edad=Math.min(.3, R.reloj-n.at), px=n.x+Math.sin(n.h)*n.v*edad, pz=n.z+Math.cos(n.h)*n.v*edad, a=Math.min(1, dt*11);
  if(Math.abs(px-k.x)+Math.abs(pz-k.z)>40){ k.x=px; k.z=pz; k.y=n.y; k.h=n.h; }
  k.x+=(px-k.x)*a; k.z+=(pz-k.z)*a; k.y+=(n.y-k.y)*a; k.h+=angC(n.h-k.h)*a; k.v=n.v;
  k.rodado+=k.v*dt*2.4; k.steerVis+=(n.st-k.steerVis)*a; k.desliz+=((k.drift||0)-k.desliz)*Math.min(1, dt*7);
  const L=ubicar(R.T, k.x, k.z, k.idx, 8, 14); k.idx=L.i; k.ySuelo=Math.min(k.y, L.y);
  for(const c of ['spin','parpadeo']) if(k[c]>0) k[c]=Math.max(0, k[c]-dt);
}
const empacar = k => [Math.round(k.x*20)/20, Math.round(k.y*20)/20, Math.round(k.z*20)/20, Math.round(k.h*200)/200, Math.round(k.v*10)/10, Math.round(k.prog*50)/50,
  (k.drift>0?1:0)|(k.drift<0?2:0)|(k.boost>0?4:0)|(k.spin>0?8:0)|(k.hielo>0?16:0)|(k.escudo>0?32:0)|(k.viento>0?64:0)|(k.aire>0?128:0)|(k.lento>0?256:0)|((k.dNivel&3)<<10)|(k.parpadeo>0?4096:0),
  Math.round(k.steer*10)/10, k.fin==null?0:Math.round(k.fin*1000)/1000, k.item?COD_OBJ.indexOf(k.item)+1:0];
function desempacar(R, k, a){
  const fl=a[6];
  k.net={x:a[0], y:a[1], z:a[2], h:a[3], v:a[4], st:a[7], at:R.reloj};
  k.prog=a[5]; k.drift=fl&1?1:fl&2?-1:0; k.boost=fl&4?1:0; if(fl&8){ if(k.spin<=0) k.spin=.4; } else k.spin=0;
  k.hielo=fl&16?1:0; k.escudo=fl&32?1:0; k.viento=fl&64?1:0; k.aire=fl&128?1:0; k.lento=fl&256?1:0; k.dNivel=(fl>>10)&3; if(fl&4096) k.parpadeo=.3;
  k.fin=a[8]||null; k.item=a[9]?COD_OBJ[a[9]-1]:null; k.lapN=Math.floor(k.prog/R.T.N);
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
  if(R.t<0){ inp.gas = R.t>-.6+(b.niv==='facil'?.5:b.niv==='dificil'?0:.25) || R.t<-3 ? 0 : 1; if(b.niv==='facil') inp.gas=0; inp.dir=0; return; }
  // por dónde va: cambia de carril cada tanto y esquiva al de adelante
  b.cambia-=dt; if(b.cambia<=0){ b.cambia=2.5+Math.random()*4; b.lat=(Math.random()-.5)*S[k.idx].w*1.1; }
  for(const o of R.karts){ if(o===k || o.fantasma) continue; const dp=o.prog-k.prog; if(dp>0 && dp<3.5 && Math.abs((o.lat||0)-(k.lat||0))<2.2 && o.v<k.v+2){ b.lat=(o.lat||0)+((k.lat||0)>(o.lat||0)?3.4:-3.4); b.cambia=1.2; } }
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
  if(k.item && !b.auto){
    if(!b.usaEn || b.usaEn>R.t+9) b.usaEn=R.t+.8+Math.random()*3.5;
    if(R.t>=b.usaEn){
      const o=k.item, adelante=R.karts.some(q=>q!==k && !q.fantasma && q.prog>k.prog && q.prog-k.prog<18), atras=R.karts.some(q=>q!==k && !q.fantasma && q.prog<k.prog && k.prog-q.prog<10);
      const ok = o==='chipa'||o==='chipa3' ? curva<.012 && !k.fuera : o==='mango' ? atras || Math.random()<.01 : o==='coco'||o==='terere' ? adelante : true;
      if(ok){ inp.usar=1; k.usarPrev=0; b.usaEn=R.t+1+Math.random()*2.5; }
    }
  }
  // si quedó trabado, vuelve a la pista
  if(k.quieto>2.2 || k.alReves>2.5) recolocar(R, k);
}

/* ---------- lo que decide el anfitrión: objetos sueltos, golpes, quién gana ---------- */
function sortear(R, k){
  const n=R.orden.length, rel=n>1 ? (k.puesto-1)/(n-1) : .5;
  const W={chipa:3+2*rel, chipa3:rel>.3?4*rel:0, mango:4*(1-rel)+.8, coco:3, terere:rel>.1?1.8+2.2*rel:0, nanduti:2.4*(1-rel)+.6, tormenta:rel>.55?1.6*rel:0, viento:rel>.7?3.2*rel:0};
  if(n<2){ W.coco=W.terere=W.tormenta=W.mango=0; }
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
    if(d.o==='mango') R.objs.push({id, t:'mango', x:d.x-Math.sin(d.h)*2.8, y:d.y, z:d.z-Math.cos(d.h)*2.8, de:d.pid, edad:0, vida:70});
    else if(d.o==='coco') R.objs.push({id, t:'coco', f:d.f+1.2, lat:d.lat, x:d.x, y:d.y, z:d.z, de:d.pid, edad:0, vida:7, vel:58*R.ritmoF});
    else if(d.o==='terere'){ const ad=R.orden[k.puesto-2]; R.objs.push({id, t:'terere', f:d.f+1.2, lat:d.lat, x:d.x, y:d.y, z:d.z, de:d.pid, a:ad&&ad.fin==null?ad.pid:null, edad:0, vida:11, vel:52*R.ritmoF}); }
    else if(d.o==='tormenta') R.emitir({k:'tormenta', de:d.pid, dur:5.5});
    R.emitir({k:'uso', pid:d.pid, o:d.o});
  }
}
function golpear(R, k, c, por){
  if(k.fin!=null || k.spin>0 || k.hielo>0 || k.parpadeo>0) return;
  if(k.viento>0) return;
  if(k.escudo>0) return R.emitir({k:'escudo', pid:k.pid});
  R.emitir({k:'golpe', pid:k.pid, c, por});
}
function pasoHost(R, dt){
  const T=R.T, N=T.N, S=T.S;
  for(let q=R.objs.length-1; q>=0; q--){
    const o=R.objs[q]; o.edad+=dt; o.vida-=dt; let fuera=o.vida<=0;
    if(o.t!=='mango'){
      const obj=o.a ? R.porPid[o.a] : null;
      if(obj && obj.fin==null && Math.hypot(obj.x-o.x, obj.z-o.z)<22){ const dx=obj.x-o.x, dz=obj.z-o.z, dd=Math.hypot(dx,dz)||1, pas=Math.min(dd, o.vel*1.15*dt); o.x+=dx/dd*pas; o.z+=dz/dd*pas; o.y+=(obj.y-o.y)*.3; o.f=obj.idx; o.lat=obj.lat||0; }
      else { o.f+=o.vel*dt/T.paso; if(obj){ const lo=obj.local ? (obj.lat||0) : detalle(T, obj.x, obj.z, obj.idx).lat; o.lat+=(lo-o.lat)*Math.min(1, dt*2.5); }
        const j=((Math.floor(o.f)%N)+N)%N, s=S[j], s2=S[(j+1)%N], t=o.f-Math.floor(o.f), la=Math.max(-s.w, Math.min(s.w, o.lat));
        o.x=s.x+(s2.x-s.x)*t+s.nx*la; o.z=s.z+(s2.z-s.z)*t+s.nz*la; o.y=s.y+(s2.y-s.y)*t; }
    }
    if(!fuera) for(const k of R.karts){
      if(k.fantasma || (k.pid===o.de && o.edad<(o.t==='mango'?1.2:.6))) continue;
      const dx=k.x-o.x, dz=k.z-o.z, r=o.t==='mango'?2:2.3;
      if(dx*dx+dz*dz<r*r && Math.abs(k.y-o.y)<2.4){ golpear(R, k, o.t==='terere'?'hielo':'spin', o.de); fuera=true; break; }
    }
    if(fuera) R.objs.splice(q, 1);
  }
  // el que va con viento norte voltea al que toca
  for(const a of R.karts) if(a.viento>0) for(const b of R.karts){ if(b===a || b.fantasma) continue; const dx=a.x-b.x, dz=a.z-b.z; if(dx*dx+dz*dz<5.3) golpear(R, b, 'spin', a.pid); }
  // final
  if(R.estado==='carrera'){
    const hum=R.karts.filter(k=>k.humano && !k.fantasma && !k.ausente), listos=hum.filter(k=>k.fin!=null).length, todos=R.karts.filter(k=>!k.fantasma);
    if(R.cierre==null && hum.length && listos===hum.length) R.cierre=R.t+3.2;
    else if(R.cierre==null && (listos>0 || (!hum.length && todos.some(k=>k.fin!=null)))) R.cierre=R.t+35;
    if(listos===hum.length && hum.length && R.cierre>R.t+3.2) R.cierre=R.t+3.2;
    if((R.cierre!=null && R.t>=R.cierre) || todos.every(k=>k.fin!=null)){ R.estado='fin'; R.alTerminar(resultado(R)); }
  }
}
function resultado(R){
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
  if(e.k==='golpe' && k){
    if(k.local){ if(e.c==='hielo'){ k.hielo=1.7; k.v*=.2; } else { k.spin=1.1; k.v*=.35; } k.drift=0; k.dCarga=0; k.dNivel=0; k.boost=0; k.parpadeo=0; }
    else if(e.c==='hielo') k.hielo=1; else k.spin=1;
  } else if(e.k==='escudo' && k){ k.escudo=0; k.parpadeo=k.local?.9:0; }
  else if(e.k==='tormenta'){ R.tormenta=e.dur; for(const q of R.karts) if(q.local && q.pid!==e.de && q.viento<=0 && q.fin==null) q.lento=e.dur; }
  else if(e.k==='obj' && k && k.local){ if(e.o){ k.itemPend=e.o; if(k.ruleta<=0) k.ruleta=.6; } else k.ruleta=0; }
  R.alFx(e);
}
const fmtT = t => { if(t==null) return '—'; const m=Math.floor(t/60), s=t-m*60; return m+':'+(s<10?'0':'')+s.toFixed(2); };
