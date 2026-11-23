'use strict';
/* =====================================================================
   Carrera Guasu — los karts y sus pilotos en 3D, los objetos, los efectos
   y la cámara. La escena se arma una vez por pista y después solo se
   mueven las cosas (no se vuelve a armar en cada cuadro).
   ===================================================================== */

/* ---------- pilotos: animales del Paraguay, cada uno con su vehículo ---------- */
const PILOTOS = [
  {id:'jakare',  n:'Jakare',   esp:'el yacaré',        e:'🐊', veh:'Motocarro',          color:'#3f9a45', vel:4, ace:2, man:2, peso:5},
  {id:'kapi',    n:'Kapi',     esp:'el carpincho',     e:'🦫', veh:'Carrito chipero',    color:'#b07a3a', vel:3, ace:3, man:4, peso:3},
  {id:'tuka',    n:'Tukã',     esp:'el tucán',         e:'🦜', veh:'Kart pico largo',    color:'#ff9a1e', vel:2, ace:5, man:4, peso:1},
  {id:'jagua',   n:'Jaguarete',esp:'el jaguareté',     e:'🐆', veh:'Kart de carrera',    color:'#f2b01e', vel:5, ace:2, man:1, peso:4},
  {id:'kure',    n:'Kure',     esp:'el chanchito',     e:'🐷', veh:'Tractorcito',        color:'#f28aa8', vel:3, ace:2, man:3, peso:5},
  {id:'aguara',  n:'Aguara',   esp:'el aguará guazú',  e:'🦊', veh:'Arenero patas largas',color:'#d8582a', vel:4, ace:3, man:4, peso:2},
  {id:'kai',     n:'Ka’i',     esp:'el monito',        e:'🐒', veh:'Karrito de madera',  color:'#8a5a34', vel:4, ace:4, man:5, peso:1},
  {id:'lobope',  n:'Lobope',   esp:'la nutria gigante',e:'🦦', veh:'Lancha con ruedas',  color:'#3b8fd0', vel:4, ace:4, man:3, peso:3},
];
const COLORES = ['#d52b1e','#1d6fe0','#f2c14e','#2fae5a','#ff7a1e','#c452d8','#19c2c2','#f4f1e8'];
const piloto = i => PILOTOS[((i|0)%PILOTOS.length+PILOTOS.length)%PILOTOS.length];

/* el muñeco del piloto (sentado), de frente a +z; los brazos van aparte (A.i / A.d) para poder festejar */
const HOMBRO = {x:.42, y:1.1, z:-.02};
function dibujarPiloto(b, id, A){
  const ojo = (x,y,z,r) => { b.esf(x,y,z,r||.11,'#ffffff',1,6); b.esf(x,y,z+(r||.11)*.6,(r||.11)*.55,'#111111',1,5); };
  const brazo = (l,x,y,z,sx,sy,sz,c,ry,rx) => (l<0?A.i:A.d).caja(x-l*HOMBRO.x, y-HOMBRO.y, z-HOMBRO.z, sx,sy,sz,c,ry,rx);
  const brazos = c => { brazo(-1,-.42,.95,.25,.16,.16,.6,c,0,.5); brazo(1,.42,.95,.25,.16,.16,.6,c,0,.5); };
  if(id==='jakare'){ const c='#3f9a45', c2='#c8d86a';
    b.esf(0,.95,-.05,.5,c,1.1,8); b.esf(0,.9,.12,.38,c2,1,7); brazos(c);
    b.caja(0,1.5,.15,.62,.4,.6,c); b.caja(0,1.5,.75,.5,.22,.8,c); b.caja(0,1.4,.72,.44,.1,.74,'#ffffff'); b.caja(0,1.32,.7,.46,.1,.76,'#2f7a35');
    ojo(-.2,1.95,.2,.13); ojo(.2,1.95,.2,.13); b.esf(-.2,1.9,.12,.17,c); b.esf(.2,1.9,.12,.17,c); b.esf(-.14,1.74,1.12,.05,'#1a3a1a'); b.esf(.14,1.74,1.12,.05,'#1a3a1a');
    b.cil(0,.5,-.6,.05,.26,1.1,c,6,-1.9); for(let i=0;i<4;i++) b.cil(0,1.02+i*.2,-.42-i*.03,0,.09,.18,'#2f7a35',4);
  } else if(id==='kapi'){ const c='#a8743a', c2='#8a5a2a';
    b.esf(0,.95,-.05,.52,c,1.05,8); brazos(c2); b.caja(0,1.45,.22,.66,.6,.8,c); b.caja(0,1.5,.66,.56,.42,.2,c2); b.caja(0,1.62,.77,.3,.16,.06,'#2a1a10');
    ojo(-.27,1.86,.42,.08); ojo(.27,1.86,.42,.08); b.esf(-.3,2.08,.02,.12,c2); b.esf(.3,2.08,.02,.12,c2); b.caja(0,1.44,.77,.14,.12,.05,'#ffffff');
    b.cil(0,2.02,.2,.5,.52,.08,'#e8d27a',10); b.cil(0,2.1,.2,.26,.3,.2,'#e8d27a',10);   // sombrero pirí
  } else if(id==='tuka'){ const c='#151515';
    b.esf(0,.95,-.05,.44,c,1.15,8); b.esf(0,1,.14,.34,'#ffffff',1,7); brazo(-1,-.44,.95,.1,.12,.5,.5,c,0,.3); brazo(1,.44,.95,.1,.12,.5,.5,c,0,.3);
    b.esf(0,1.72,.1,.38,c,1,8); b.esf(0,1.62,.3,.26,'#ffe37a',1,7); ojo(-.2,1.84,.34,.09); ojo(.2,1.84,.34,.09); b.esf(-.2,1.84,.3,.14,'#3ba0e0',1,6); b.esf(.2,1.84,.3,.14,'#3ba0e0',1,6);
    b.caja(0,1.62,.82,.24,.3,.9,'#ff9a1e'); b.caja(0,1.56,1.3,.22,.24,.24,'#111111'); b.caja(0,1.84,.8,.2,.1,.8,'#ffcf3a'); b.cil(0,.55,-.55,.3,.06,.7,c,5,-1.3);
  } else if(id==='jagua'){ const c='#f0a81e', c2='#fff3d8';
    b.esf(0,.95,-.05,.5,c,1.08,8); b.esf(0,.92,.14,.36,c2,1,7); brazos(c); b.esf(0,1.7,.12,.44,c,.95,9); b.esf(0,1.58,.44,.24,c2,.8,7); b.esf(0,1.66,.66,.07,'#2a1a10');
    ojo(-.19,1.82,.46,.09); ojo(.19,1.82,.46,.09); b.cil(-.3,2,.0,0,.15,.24,c,5); b.cil(.3,2,.0,0,.15,.24,c,5);
    for(const [x,y,z] of [[-.34,1.7,.2],[.34,1.72,.18],[0,2.08,.1],[-.2,2,-.14],[.24,1.96,-.18],[-.38,1,.1],[.4,1.1,-.1],[0,1.25,-.5],[.2,.8,-.48],[-.25,1,-.46]]) b.esf(x,y,z,.075,'#2a1a10',1,4);
    b.cil(0,.5,-.55,.07,.1,1,c,5,-.9); b.esf(0,1.12,-1.34,.1,'#2a1a10');
  } else if(id==='kure'){ const c='#f59ab4', c2='#e87a9a';
    b.esf(0,.95,-.05,.56,c,1,8); brazos(c2); b.esf(0,1.7,.12,.46,c,.95,9); b.cil(0,1.6,.52,.2,.22,.2,c2,8,1.5708); b.esf(-.08,1.6,.66,.04,'#7a2a44'); b.esf(.08,1.6,.66,.04,'#7a2a44');
    ojo(-.2,1.86,.44,.08); ojo(.2,1.86,.44,.08); b.caja(-.36,1.98,.12,.26,.3,.08,c2,0,.5,.5); b.caja(.36,1.98,.12,.26,.3,.08,c2,0,.5,-.5);
    b.cil(0,2.08,.1,.42,.46,.07,'#3b7be2',10); b.cil(0,2.14,.1,.22,.26,.22,'#3b7be2',10); b.cil(0,.8,-.6,.04,.04,.3,c2,5,-1);
  } else if(id==='aguara'){ const c='#d8582a', c2='#fff3e0', n='#1a1414';
    b.esf(0,.95,-.05,.42,c,1.2,8); b.esf(0,1.05,.12,.28,c2,1,7); brazo(-1,-.4,.95,.25,.13,.13,.62,n,0,.5); brazo(1,.4,.95,.25,.13,.13,.62,n,0,.5);
    b.esf(0,1.78,.1,.36,c,1,8); b.caja(0,1.62,.52,.22,.2,.56,c); b.caja(0,1.56,.56,.18,.1,.5,c2); b.esf(0,1.72,.82,.07,n); ojo(-.17,1.88,.36,.08); ojo(.17,1.88,.36,.08);
    b.cil(-.24,2.02,.0,0,.16,.56,c,5); b.cil(.24,2.02,.0,0,.16,.56,c,5); b.cil(-.24,2.38,.0,0,.08,.2,n,5); b.cil(.24,2.38,.0,0,.08,.2,n,5); b.caja(0,1.35,-.3,.2,.7,.14,n);
    b.cil(0,.5,-.5,.14,.08,.9,c,5,-1); b.esf(0,1,-1.2,.16,c2);
  } else if(id==='kai'){ const c='#7a4a2a', c2='#e8c8a0';
    b.esf(0,.95,-.05,.42,c,1.1,8); brazos(c); b.esf(0,1.66,.12,.4,c,1,9); b.esf(0,1.6,.3,.3,c2,.9,7); ojo(-.14,1.72,.52,.08); ojo(.14,1.72,.52,.08); b.esf(0,1.5,.56,.1,c2,.7); b.caja(0,1.46,.6,.2,.03,.05,'#5a2a1a');
    b.esf(-.42,1.7,.1,.15,c2); b.esf(.42,1.7,.1,.15,c2); b.cil(0,.5,-.5,.05,.07,1.3,c,5,-.5); b.esf(0,1.75,-1.2,.14,c);
    b.caja(0,2.02,.12,.5,.14,.5,'#d52b1e'); b.caja(0,2.02,.5,.36,.06,.3,'#d52b1e');
  } else { const c='#5a3a2a', c2='#f0dcb8';
    b.esf(0,.95,-.05,.48,c,1.12,8); b.esf(0,1.02,.14,.32,c2,1,7); brazos(c); b.esf(0,1.7,.12,.4,c,.92,9); b.esf(0,1.58,.4,.25,c2,.7,7); b.esf(0,1.64,.62,.08,'#1a1010');
    ojo(-.2,1.82,.4,.08); ojo(.2,1.82,.4,.08); b.esf(-.34,1.92,.0,.1,c); b.esf(.34,1.92,.0,.1,c); for(const s of [-1,1]) for(const y of [1.54,1.6]) b.caja(s*.36,y,.5,.34,.015,.015,'#ffffff',0,0,s*.15);
    b.caja(0,.5,-.75,.34,.12,.9,c,0,-.5);
    b.esf(-.2,1.98,.3,.13,'#3ba0e0',1,6); b.esf(.2,1.98,.3,.13,'#3ba0e0',1,6); b.caja(0,2,.24,.5,.06,.06,'#222');   // antiparras
  }
}
/* el vehículo de cada piloto; devuelve dónde van las ruedas [x,y,z,radio,ancho] (las 2 primeras doblan) */
function dibujarVehiculo(b, id, col){
  const osc=new THREE.Color(col).multiplyScalar(.62), gris='#3a3f4a', R=[];
  const volante = () => { b.cil(0,1,.62,.03,.03,.5,gris,5,-.9); b.cil(0,1.28,.4,.22,.22,.05,'#222',8,.7); };
  if(id==='jakare'){ // motocarro: una rueda adelante y caja de carga atrás
    b.caja(0,.42,-.5,1.5,.5,1.7,col); b.caja(0,.92,-.95,1.5,.5,.12,osc); b.caja(-.72,.92,-.5,.1,.5,1.7,osc); b.caja(.72,.92,-.5,.1,.5,1.7,osc);
    b.caja(0,.42,.7,.6,.4,1.4,col); b.caja(0,.8,1.25,.5,.5,.2,osc); b.caja(0,1.25,1.2,.9,.06,.06,gris); b.esf(0,1,1.4,.14,'#fff3b0'); b.caja(0,.6,.3,.9,.2,.5,'#222');
    b.esf(-.4,.95,-.9,.3,'#5aa84a'); b.esf(.3,.95,-1,.28,'#2f8f3f');   // sandías
    R.push([0,.42,1.25,.42,.3],[0,.42,1.25,.42,.3],[-.85,.45,-.7,.45,.34],[.85,.45,-.7,.45,.34]);
  } else if(id==='kapi'){ // carrito chipero con canasto y toldo
    b.caja(0,.4,0,1.3,.4,2.3,col); b.caja(0,.8,-.75,1.3,.55,.75,'#c79a55'); for(let i=0;i<6;i++) b.esf(-.4+(i%3)*.4,1.38,-.9+Math.floor(i/3)*.34,.17,'#e6b85a',.7,5);
    for(const x of [-.6,.6]) b.cil(x,.8,-1.05,.03,.03,1.5,gris,4); b.caja(0,2.3,-.75,1.5,.06,.9,'#ffffff'); b.caja(0,2.31,-.75,.5,.06,.92,'#d52b1e'); b.caja(0,.45,1.2,1.1,.3,.25,osc); volante();
    R.push([-.75,.36,.8,.36,.26],[.75,.36,.8,.36,.26],[-.75,.36,-.8,.36,.26],[.75,.36,-.8,.36,.26]);
  } else if(id==='kure'){ // tractorcito: ruedas grandes atrás y caño de escape
    b.caja(0,.6,.55,.9,.7,1.5,col); b.caja(0,1.3,.3,.8,.1,1,osc); b.cil(.3,1.3,.9,.06,.06,.9,gris,5); b.caja(0,.5,-.6,1.2,.6,1,col); b.caja(0,.75,1.32,.7,.4,.08,gris);
    for(const x of [-.62,.62]) b.caja(x,1.05,-.6,.34,.12,1.2,osc); volante(); b.esf(-.25,1,1.33,.1,'#fff3b0'); b.esf(.25,1,1.33,.1,'#fff3b0');
    R.push([-.72,.34,1,.34,.26],[.72,.34,1,.34,.26],[-.86,.62,-.6,.62,.42],[.86,.62,-.6,.62,.42]);
  } else if(id==='aguara'){ // arenero alto, con jaula
    b.caja(0,.75,0,1.1,.35,2.3,col); b.caja(0,.75,1.2,.9,.3,.3,osc); for(const x of [-.55,.55]){ b.cil(x,1.1,-.9,.04,.04,1.3,gris,5); b.cil(x,1.1,.5,.04,.04,1.3,gris,5,-.5); b.caja(x,2.36,-.55,.08,.08,1.5,gris); }
    b.caja(0,2.36,-.9,1.2,.08,.08,gris); volante(); for(const x of [-.8,.8]) for(const z of [.85,-.85]) b.caja(x*.75,.5,z,.5,.08,.08,gris);
    R.push([-.9,.5,.85,.5,.3],[.9,.5,.85,.5,.3],[-.9,.5,-.85,.5,.3],[.9,.5,-.85,.5,.3]);
  } else if(id==='kai'){ // karrito de madera
    b.caja(0,.4,0,1.1,.16,2.5,'#b8793a'); b.caja(0,.56,-.7,1.1,.5,.9,'#8a5a2a'); b.caja(0,.3,.95,1.7,.12,.16,'#6b4a2b'); b.caja(0,.3,-.85,1.7,.12,.16,'#6b4a2b'); b.caja(0,.56,.6,.7,.3,.9,col);
    b.caja(-.3,.7,1.1,.04,.04,1.1,'#e8d8b0',0,-.6); b.caja(.3,.7,1.1,.04,.04,1.1,'#e8d8b0',0,-.6); volante(); b.caja(0,1.06,-1.1,1.1,.08,.1,col);
    R.push([-.9,.3,.95,.3,.2],[.9,.3,.95,.3,.2],[-.9,.3,-.85,.3,.2],[.9,.3,-.85,.3,.2]);
  } else if(id==='lobope'){ // lancha con ruedas
    b.caja(0,.4,-.2,1.4,.55,2.2,col); b.caja(0,.4,1.15,1,.5,1,col,.785); b.caja(0,.95,-.2,1.5,.1,2.3,'#ffffff'); b.caja(0,.42,-1.35,.5,.6,.3,gris); b.caja(0,.3,-1.55,.08,.5,.3,'#222');
    b.caja(0,1.05,.55,1.1,.5,.06,'#bfe6ff',0,-.5); volante(); b.esf(0,.75,-1.05,.3,'#d52b1e',.7); b.esf(0,.75,-1.05,.2,'#ffffff',.75);
    R.push([-.78,.36,.75,.36,.26],[.78,.36,.75,.36,.26],[-.78,.36,-.8,.36,.26],[.78,.36,-.8,.36,.26]);
  } else { // kart bajito (tuka y jagua), con alerón
    const largo = id==='tuka';
    b.caja(0,.32,0,1.1,.3,2.5,col); b.caja(0,.32,1.4,largo?.5:1.5,.2,largo?.9:.3,largo?'#ff9a1e':osc); b.caja(-.75,.3,0,.34,.3,1.3,osc); b.caja(.75,.3,0,.34,.3,1.3,osc);
    b.caja(0,.62,-.75,1,.5,.7,osc); b.caja(-.5,1.1,-1.15,.08,.5,.3,gris); b.caja(.5,1.1,-1.15,.08,.5,.3,gris); b.caja(0,1.56,-1.2,1.6,.08,.5,col); b.caja(0,.6,.7,.7,.2,.7,col,0,-.2);
    if(id==='jagua'){ b.caja(0,.63,0,.3,.02,2.5,'#111'); b.cil(-.4,.5,-1.3,.09,.09,.3,gris,6,1.5708); b.cil(.4,.5,-1.3,.09,.09,.3,gris,6,1.5708); }
    volante();
    R.push([-.85,.34,.9,.34,.28],[.85,.34,.9,.34,.28],[-.88,.4,-.85,.4,.36],[.88,.4,-.85,.4,.36]);
  }
  return R;
}

const K3 = {gRueda:null, mRueda:null, mLlanta:null, gSombra:null, mSombra:null, mod:{}, esperan:[]};
/* modelos 3D de los animales (Poly Pizza, licencia CC-BY: los créditos están en "Cómo se juega" y en modelos/CREDITOS.txt).
   Se cargan aparte: mientras no llegan (o si no cargan) se ve el muñeco hecho a mano de arriba.
   H = alto máximo, L = largo máximo, y/z = dónde se para en el asiento */
const MODELOS = {jakare:{H:1.1, L:3.3, rx:-.25, y:.95, z:-.4}, kapi:{H:1.7, L:2.0, rx:-.45, y:.55, z:-.35}, tuka:{H:1.9, L:2.8, y:.5, z:-.2}, jagua:{H:1.6, L:2.1, rx:-.5, y:.55, z:-.45},
  kure:{H:1.35, L:1.7, rx:-.4, y:.8, z:-.55}, aguara:{H:1.75, L:2.0, rx:-.45, y:.7, z:-.35}, kai:{H:1.7, L:2.0, y:.5, z:-.3}, lobope:{H:1.6, L:2.0, rx:-.45, y:1.0, z:-.45}};
const VMOD = 1;   // subir si se cambian los .glb
function cargarModelos(){
  if(K3.cargando || !THREE.GLTFLoader) return; K3.cargando=true; const L=new THREE.GLTFLoader();
  for(const id in MODELOS) L.load('modelos/'+id+'.glb?v='+VMOD, g=>{
    const o=g.scene, c=MODELOS[id], b=new THREE.Box3().setFromObject(o), s=b.getSize(new THREE.Vector3());
    const e=Math.min((c.H||1.4)/s.y, (c.L||2.2)/Math.max(s.x,s.z)); o.scale.setScalar(e); o.position.set(-(b.min.x+s.x/2)*e, -b.min.y*e, -(b.min.z+s.z/2)*e);
    o.traverse(m=>{ if(m.isMesh){ const v=m.material; if(v.map) v.map.encoding=THREE.LinearEncoding; m.material=new THREE.MeshLambertMaterial({map:v.map||null, color:v.map?'#ffffff':v.color}); } });
    const w=new THREE.Group(); w.add(o); K3.mod[id]=w;
    K3.esperan=K3.esperan.filter(v=>{ if(v.tirado) return false; if(piloto(v.ch).id!==id) return true; ponerModelo(v); return false; });
  }, undefined, ()=>{});
}
function ponerModelo(v){
  const id=piloto(v.ch).id, t=K3.mod[id]; if(!t || v.modelo) return; const c=MODELOS[id], m=t.clone(true), mats=[];
  m.traverse(x=>{ if(x.isMesh){ x.material=x.material.clone(); mats.push(x.material); } });
  m.position.set(0, c.y||.5, c.z||-.15); m.rotation.set(c.rx||0, c.ry||0, 0); v.pil.add(m); v.modelo=m; v.mMod=mats; v.pilMallas.forEach(x=>x.visible=false);
  if(v.op<1) v.fantasma(v.op);
}
function crearKart3D(ch, color){
  const p=piloto(ch), g=new THREE.Group(), cuerpo=new THREE.Group(); g.add(cuerpo);
  const b=new Obra(), bp=new Obra(), bi=new Obra(), bd=new Obra(); const ruedasDef=dibujarVehiculo(b, p.id, color||p.color); dibujarPiloto(bp, p.id, {i:bi, d:bd});
  const mat=new THREE.MeshLambertMaterial({vertexColors:true}), malla=b.malla(mat); cuerpo.add(malla);
  // el piloto y sus brazos (comparten el material: si el kart se vuelve fantasma, el piloto también)
  const pil=new THREE.Group(); cuerpo.add(pil); const mallas=[malla, bp.malla(mat)]; pil.add(mallas[1]);
  const brazos=[bi,bd].map((o,i)=>{ const q=new THREE.Group(); q.position.set(i?HOMBRO.x:-HOMBRO.x, HOMBRO.y, HOMBRO.z); q.rotation.order='ZXY'; if(o.pos.length){ const m=o.malla(mat); mallas.push(m); q.add(m); } pil.add(q); return q; });
  if(!K3.gRueda){ K3.gRueda=new THREE.CylinderGeometry(1,1,1,10); K3.gRueda.rotateZ(Math.PI/2); K3.mRueda=new THREE.MeshLambertMaterial({color:'#1c1c1f'});
    K3.gSombra=new THREE.CircleGeometry(1.5,12); K3.mSombra=new THREE.MeshBasicMaterial({color:0, transparent:true, opacity:.32, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-8, polygonOffsetUnits:-80});
    K3.gLlama=new THREE.ConeGeometry(.28,1.5,6); K3.gLlama.rotateX(-Math.PI/2); K3.gLlama.translate(0,0,-.75); K3.mLlama=new THREE.MeshBasicMaterial({color:'#ffb52e', transparent:true, opacity:.9});
    K3.gChispa=new THREE.BoxGeometry(.22,.22,.22); K3.gEscudo=new THREE.IcosahedronGeometry(1.9,1); K3.mEscudo=new THREE.MeshBasicMaterial({color:'#ffffff', wireframe:true, transparent:true, opacity:.7});
    K3.gHielo=new THREE.BoxGeometry(2.4,2.6,3.2); K3.mHielo=new THREE.MeshLambertMaterial({color:'#bfeaff', transparent:true, opacity:.55}); K3.mViento=new THREE.MeshBasicMaterial({color:'#fff3a0', wireframe:true, transparent:true, opacity:.8});
    K3.mSol=new THREE.MeshBasicMaterial({color:'#ffd23a', transparent:true, opacity:.38, depthWrite:false}); }
  const ruedas=ruedasDef.map((r,i)=>{ if(p.id==='jakare' && i===1) return null; const m=new THREE.Mesh(K3.gRueda, K3.mRueda); m.scale.set(r[4], r[3], r[3]); m.position.set(r[0], r[1], r[2]); m.rotation.order='YXZ'; cuerpo.add(m); return m; });
  const sombra=new THREE.Mesh(K3.gSombra, K3.mSombra); sombra.rotation.x=-Math.PI/2; g.add(sombra);
  // corazones del modo batalla (se muestran solo en la arena)
  if(!K3.mCor){ const c=document.createElement('canvas'); c.width=c.height=64; const x=c.getContext('2d'); x.font='52px system-ui,"Segoe UI Emoji",sans-serif'; x.textAlign='center'; x.textBaseline='middle'; x.fillText('❤️',32,36);
    K3.mCor=new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c), transparent:true, depthWrite:false}); }
  const cors=[0,1,2,3,4].map(i=>{ const s=new THREE.Sprite(K3.mCor); s.scale.set(.75,.75,1); s.position.y=2.75; s.visible=false; g.add(s); return s; });
  const llamas=[-.4,.4].map(x=>{ const m=new THREE.Mesh(K3.gLlama, K3.mLlama); m.position.set(x,.5,-1.3); m.visible=false; cuerpo.add(m); return m; });
  const mCh=new THREE.MeshBasicMaterial({color:'#5ad0ff'}); const chispas=[-.85,.85,-.7,.7].map((x,i)=>{ const m=new THREE.Mesh(K3.gChispa, mCh); m.position.set(x,.2,-1-(i>1?.3:0)); m.visible=false; cuerpo.add(m); return m; });
  const escudo=new THREE.Mesh(K3.gEscudo, K3.mEscudo); escudo.position.y=1; escudo.visible=false; g.add(escudo);
  const hielo=new THREE.Mesh(K3.gHielo, K3.mHielo); hielo.position.y=1.2; hielo.visible=false; g.add(hielo);
  const v={g, cuerpo, malla, pil, brazos, ruedas, sombra, llamas, chispas, mCh, escudo, hielo, cors, etiqueta:null, giro:0, extras:[], ch, op:1, pilMallas:mallas.slice(1), mMod:[],
    fantasma(op){ this.op=op; for(const m of [mat, ...this.mMod]){ m.transparent=op<1; m.opacity=op; } },
    tirar(){ this.tirado=true; this.mMod.forEach(m=>m.dispose()); mallas.forEach(m=>m.geometry.dispose()); mat.dispose(); mCh.dispose(); this.extras.forEach(m=>{ m.geometry.dispose(); if(m.material.map) m.material.map.dispose(); m.material.dispose(); }); if(this.etiqueta){ this.etiqueta.material.map.dispose(); this.etiqueta.material.dispose(); } }};
  cargarModelos(); if(K3.mod[p.id]) ponerModelo(v); else K3.esperan.push(v);
  return v;
}
/* cartelito con el nombre (y la foto, si tiene) arriba del kart */
function etiquetaKart(v, nombre, color, cara){
  const c=document.createElement('canvas'); c.width=256; c.height=96; const g=c.getContext('2d');
  const pintar=img=>{ g.clearRect(0,0,256,96); const x0=img?76:0; g.font='900 30px system-ui,sans-serif'; const w=Math.min(250-x0, g.measureText(nombre).width+26);
    g.fillStyle='rgba(10,12,30,.72)'; const x=(256-w-x0)/2+x0; g.beginPath(); g.roundRect ? g.roundRect(x,28,w,44,14) : g.rect(x,28,w,44); g.fill();
    g.fillStyle=color; g.fillRect(x+6,64,w-12,4); g.fillStyle='#fff'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(nombre, x+w/2, 49, w-16);
    if(img){ g.save(); g.beginPath(); g.ellipse(x-34,48,32,40,0,0,6.283); g.closePath(); g.clip(); g.drawImage(img, x-66, 8, 64, 80); g.restore(); g.strokeStyle=color; g.lineWidth=4; g.beginPath(); g.ellipse(x-34,48,32,40,0,0,6.283); g.stroke(); }
    tex.needsUpdate=true; };
  if(v.etiqueta){ v.g.remove(v.etiqueta); v.etiqueta.material.map.dispose(); v.etiqueta.material.dispose(); }
  const tex=new THREE.CanvasTexture(c), sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex, transparent:true, depthWrite:false}));
  sp.scale.set(5.4,2,1); sp.position.y=3.6; v.g.add(sp); v.etiqueta=sp; pintar(null);
  if(cara){ const im=new Image(); im.onload=()=>pintar(im); im.src=cara; }
}

/* =====================================================================
   M3: el dibujante (renderer, cámara, sincronizar con la carrera)
   ===================================================================== */
const M3 = (() => {
  let rend=null, lienzo=null, esc=null, cam=null, mundo=null, T=null, calidad='media', vis={}, objs={}, lluvia=null, luzSol=null, luzAmb=null, camH=0, camPos=null, fov=72, vitrina=null, tLluvia=0;
  const v3=new THREE.Vector3();
  function init(canvas){
    if(rend && lienzo===canvas) return true;
    try{ rend=new THREE.WebGLRenderer({canvas, alpha:true, antialias:calidad==='alta', powerPreference:'high-performance'}); }catch(e){ return false; }
    lienzo=canvas; cam=new THREE.PerspectiveCamera(72, 1, .3, 900); camPos=new THREE.Vector3();
    aplicarCalidad(); return true;
  }
  function aplicarCalidad(){ if(!rend) return; const d=window.devicePixelRatio||1; rend.setPixelRatio(calidad==='baja' ? Math.min(d,1)*.7 : calidad==='alta' ? Math.min(d,2) : Math.min(d,1.25)); tam(); }
  function setCalidad(q){ if(q===calidad) return; const eraAlta=calidad==='alta'; calidad=q; if(rend && (eraAlta!==(q==='alta'))){ /* el suavizado de bordes se elige al crear: se rehace */ const c=lienzo; try{ rend.dispose(); }catch(e){} const n=c.cloneNode(false); c.parentNode.replaceChild(n, c); rend=null; lienzo=null; init(n); } else aplicarCalidad(); }
  function tam(){ if(!rend) return; const w=lienzo.clientWidth||lienzo.parentElement.clientWidth||300, h=lienzo.clientHeight||lienzo.parentElement.clientHeight||200; rend.setSize(w, h, false); cam.aspect=w/h; cam.updateProjectionMatrix(); }
  function cielo(tema){
    const t=texLienzo(8, 256, (g,w,h)=>{ const gr=g.createLinearGradient(0,0,0,h); gr.addColorStop(0,tema.cielo[0]); gr.addColorStop(.62,tema.cielo[1]); gr.addColorStop(1,tema.niebla); g.fillStyle=gr; g.fillRect(0,0,w,h); });
    return t;
  }
  function limpiar(){
    for(const k in vis){ esc && esc.remove(vis[k].g); vis[k].tirar(); } vis={};
    for(const k in objs){ esc && esc.remove(objs[k]); } objs={};
    if(mundo){ esc.remove(mundo); mundo.userData.tirar(); mundo=null; }
    if(esc && esc.background && esc.background.dispose) esc.background.dispose();
    if(lluvia){ lluvia.geometry.dispose(); lluvia.material.dispose(); lluvia=null; }
    esc=null; T=null; vitrina=null; cerrarPodio();
  }
  function cargar(pista){
    limpiar(); T=pista; const tema=T.tema;
    esc=new THREE.Scene(); esc.background=cielo(tema); esc.fog=new THREE.Fog(tema.niebla, calidad==='baja'?60:90, tema.lejos*(calidad==='baja'?.72:1));
    luzAmb=new THREE.HemisphereLight(tema.tarde?'#ffd0a0':'#ffffff', tema.tarde?'#6a4a5a':'#8a9a7a', tema.tarde?.85:.9); esc.add(luzAmb);
    luzSol=new THREE.DirectionalLight(tema.tarde?'#ffb070':'#fff6e0', tema.tarde?.75:.7); luzSol.position.set(.5,1,.35); esc.add(luzSol);
    mundo=armarMundo(T, calidad); esc.add(mundo);
    cam.far=tema.lejos*1.6; cam.updateProjectionMatrix(); camH=null;
    const n=calidad==='baja'?260:520, p=new Float32Array(n*3); for(let i=0;i<n*3;i+=3){ p[i]=(Math.random()-.5)*60; p[i+1]=Math.random()*30; p[i+2]=(Math.random()-.5)*60; }
    const gl=new THREE.BufferGeometry(); gl.setAttribute('position', new THREE.BufferAttribute(p,3));
    lluvia=new THREE.Points(gl, new THREE.PointsMaterial({color:'#cfe6ff', size:.22, transparent:true, opacity:.8})); lluvia.visible=false; lluvia.frustumCulled=false; esc.add(lluvia);
  }
  function kart(k){
    let v=vis[k.pid]; if(v && v.ch===k.ch && v.color===k.color) return v;
    if(v){ esc.remove(v.g); v.tirar(); }
    v=vis[k.pid]=crearKart3D(k.ch, k.color); v.ch=k.ch; v.color=k.color; esc.add(v.g); return v;
  }
  function etiqueta(k, nombre, cara){ const v=kart(k); const key=nombre+'|'+(cara?cara.length:0)+'|'+k.color; if(v.etKey===key) return; v.etKey=key; etiquetaKart(v, nombre, k.color, cara); }
  const OBJ3 = {
    mango(){ const b=new Obra(); b.esf(0,.35,0,.6,'#f6c21e',.5,7,1,1.5); b.caja(0,.3,.9,.3,.08,.9,'#f6d85a',0,.3); b.caja(.7,.3,-.4,.3,.08,.9,'#f6d85a',2.1,.3); b.caja(-.7,.3,-.4,.3,.08,.9,'#f6d85a',-2.1,.3); b.esf(0,.62,0,.14,'#6b4a2b'); return b.malla(); },
    coco(){ const b=new Obra(); b.esf(0,.8,0,.8,'#6b4a2b',1,8); b.esf(.25,1.2,.55,.12,'#2a1a10'); b.esf(-.25,1.2,.55,.12,'#2a1a10'); b.esf(0,.95,.74,.12,'#2a1a10'); b.esf(0,1.5,0,.3,'#8a6a45',.4); return b.malla(); },
    guampa(){ const b=new Obra(); b.cil(0,0,0,.2,.16,.42,'#c8a070',8); b.cil(0,.42,0,.21,.21,.04,'#e8d27a',8); b.cil(0,.44,0,.17,.17,.02,'#6fb04a',8); b.cil(.06,.3,0,.025,.025,.5,'#d8dde6',4,0,-.35); return b.malla(); },
    trofeo(){ const b=new Obra(), o='#f2c14e', o2='#ffd96a'; b.caja(0,0,0,.42,.14,.42,'#6b4a2b'); b.cil(0,.14,0,.07,.11,.26,o,8); b.cil(0,.4,0,.34,.13,.44,o2,12); b.cil(0,.84,0,.36,.34,.05,o,12);
      b.esf(-.38,.66,0,.12,o,1,6,.7); b.esf(.38,.66,0,.12,o,1,6,.7); b.esf(0,.9,0,.09,'#fff3b0'); return b.malla(); },
    medalla(c){ const b=new Obra(); b.caja(-.09,.12,0,.05,.42,.03,'#1d6fe0',0,0); b.caja(.09,.12,0,.05,.42,.03,'#d52b1e',0,0); b.cil(0,0,0,.17,.17,.05,c,12,1.5708); return b.malla(); },
    mainumby(){ const b=new Obra(), c='#1fa87a', c2='#2f7fe0';
      b.esf(0,1,0,.5,c,1,8,1,1.5); b.esf(0,1.25,.6,.32,c2,1,7); b.esf(0,1.2,.48,.28,'#e8344a',.6,6); b.cil(0,1.25,.85,.02,.07,.9,'#222',5,1.5708);
      b.esf(-.14,1.36,.78,.07,'#ffffff',1,5); b.esf(.14,1.36,.78,.07,'#ffffff',1,5); b.esf(-.15,1.37,.83,.04,'#111',1,4); b.esf(.15,1.37,.83,.04,'#111',1,4);
      b.caja(-.75,1.1,0,1.1,.06,.55,c2,0,0,.35); b.caja(.75,1.1,0,1.1,.06,.55,c2,0,0,-.35); b.caja(0,.95,-.85,.45,.05,.6,c,0,-.3); return b.malla(); },
    terere(){ const b=new Obra(); b.cil(0,.2,0,.42,.42,1.5,'#2f6fb0',9); b.cil(0,1.7,0,.3,.42,.25,'#d8dde6',9); b.cil(0,1.95,0,.16,.16,.3,'#d8dde6',7); b.caja(.5,.9,0,.14,.7,.14,'#d8dde6'); b.cil(-.75,.2,.3,.3,.22,.75,'#e8dcc0',8); b.cil(-.75,.9,.3,.03,.03,.8,'#c8ccd4',4,0,.3); b.esf(0,1,0,1.1,'#bfeaff',1.2,7); return b.malla(new THREE.MeshLambertMaterial({vertexColors:true, transparent:true, opacity:.9})); },
  };
  /* un cuadro: R = la carrera, yo = el kart que sigue la cámara */
  function sync(R, yo, dt){
    if(!esc || !mundo || vitrina) return;
    const t=R.reloj||0;
    for(const k of R.karts){
      const v=kart(k), g=v.g;
      g.position.set(k.x, k.y, k.z);
      v.cuerpo.rotation.order='YXZ';
      const des=k.desliz||0;
      v.giro = k.spin>0 ? v.giro+dt*15 : 0;
      v.cuerpo.rotation.y=k.h-des*.42+v.giro;
      v.cuerpo.rotation.x=-(k.cabeceo||0);
      v.cuerpo.rotation.z=(k.steerVis||0)*-.06*(k.v>3?1:0)+des*.05;
      v.cuerpo.position.y=(k.hielo>0?Math.sin(t*40)*.03:0);
      v.sombra.position.y=(k.ySuelo!=null?k.ySuelo:k.y)-k.y+.16; const al=Math.max(0, k.y-(k.ySuelo!=null?k.ySuelo:k.y)); v.sombra.scale.setScalar(Math.max(.5, 1-al*.08));
      const giroR=k.rodado||0;
      v.ruedas.forEach((r,i)=>{ if(!r) return; r.rotation.x=giroR; r.rotation.y=i<2?-(k.steerVis||0)*.45:0; });
      const turbo=k.boost>0||k.viento>0||k.sol>0;
      v.llamas.forEach((l,i)=>{ l.visible=turbo; if(turbo){ const s=.8+Math.random()*.7; l.scale.set(1,1,s*(k.viento>0?1.5:1)); } });
      const dn=k.drift?k.dNivel:0;
      v.chispas.forEach((c,i)=>{ c.visible=!!k.drift && k.aire<=0 && (dn>0 || i<2); if(c.visible){ c.position.y=.15+Math.random()*.5; c.rotation.set(Math.random()*3,Math.random()*3,0); } });
      if(k.drift) v.mCh.color.set(dn>=3?'#d86bff':dn===2?'#ff8a1e':dn===1?'#5ad0ff':'#dddddd');
      const sol=k.sol>0;
      v.escudo.visible=k.escudo>0||k.viento>0||sol; if(v.escudo.visible){ v.escudo.material=sol?K3.mSol:k.viento>0?K3.mViento:K3.mEscudo; v.escudo.rotation.y+=dt*2; v.escudo.rotation.x+=dt*.7; v.escudo.scale.setScalar(sol?1.05+Math.sin(t*12)*.08:1); }
      if(sol) K3.mSol.color.setHSL((t*.6)%1, 1, .6);
      v.hielo.visible=k.hielo>0; if(v.hielo.visible) v.hielo.rotation.y=k.h;
      // el mango que lleva colgando atrás
      if(k.sost && !v.mangoM){ v.mangoM=OBJ3.mango(); v.mangoM.scale.setScalar(.75); v.mangoM.position.set(0,.05,-2.4); v.cuerpo.add(v.mangoM); v.extras.push(v.mangoM); }
      if(v.mangoM){ v.mangoM.visible=!!k.sost; if(k.sost) v.mangoM.rotation.z=Math.sin(t*9)*.25; }
      // la guampa helada: en la mano, con cubitos de hielo girando (uno por carga)
      const gua=k.item==='guampa' && !(k.ruleta>0);
      if(gua && !v.guampaM){ v.guampaM=OBJ3.guampa(); v.guampaM.position.set(.1,-.12,.62); v.brazos[1].add(v.guampaM); v.extras.push(v.guampaM);
        v.cubos=[0,1,2].map(()=>{ const m=new THREE.Mesh(K3.gChispa, K3.mHielo); m.scale.setScalar(2.4); v.g.add(m); return m; }); }
      if(v.guampaM){ v.guampaM.visible=gua; const n=gua?Math.max(1, Math.min(3, k.itemN||3)):0; v.cubos.forEach((c,i)=>{ c.visible=i<n; const a=t*3+i*2.094; c.position.set(Math.sin(a)*1.9, 1.1+Math.sin(t*4+i)*.25, Math.cos(a)*1.9); c.rotation.set(t*2+i, t*3, 0); }); }
      if(R.arena){ const n=k.muerto||k===yo?0:Math.max(0, k.vidas|0); v.cors.forEach((c,i)=>{ c.visible=i<n; c.position.x=(i-(n-1)/2)*.72; c.position.y=2.75+Math.sin(t*3+i)*.08; }); if(k.muerto){ v.g.visible=false; if(v.etiqueta) v.etiqueta.visible=false; continue; } }
      g.visible = !(k.parpadeo>0 && Math.floor(t*14)%2);
      if(v.etiqueta) v.etiqueta.visible = k!==yo && !k.oculto;
    }
    for(const pid in vis) if(!R.karts.some(k=>k.pid===pid)){ esc.remove(vis[pid].g); vis[pid].tirar(); delete vis[pid]; }
    // objetos sueltos en la pista
    const vivos={};
    for(const o of R.objs){ vivos[o.id]=1; let m=objs[o.id]; if(!m){ m=objs[o.id]=(OBJ3[o.t]||OBJ3.coco)(); if(o.t==='guampa') m.scale.setScalar(2.4); if(o.t==='mainumby') m.scale.setScalar(1.3); esc.add(m); }
      if(o.t==='mainumby'){ const dx=o.x-m.position.x, dz=o.z-m.position.z; if(dx*dx+dz*dz>.0004) m.rotation.y=Math.atan2(dx, dz); m.position.set(o.x, o.y+Math.sin(t*14)*.15, o.z); m.rotation.z=Math.sin(t*30)*.12; continue; }
      m.position.set(o.x, o.y, o.z); if(o.t!=='mango'){ m.rotation.y+=dt*6; if(o.t==='coco'||o.t==='guampa') m.rotation.x+=dt*9; } }
    for(const id in objs) if(!vivos[id]){ esc.remove(objs[id]); objs[id].geometry.dispose(); objs[id].material.dispose(); delete objs[id]; }
    // cajas
    const cj=mundo.userData.cajas; for(let i=0;i<cj.length;i++){ const c=cj[i], on=!(R.cajasOff[i]>t); c.m.visible=on; if(on){ c.m.rotation.y=t*1.6+i; c.m.rotation.x=t*.9; c.m.position.y=c.y+Math.sin(t*2.4+i)*.25; } }
    mundo.userData.texTurbo.offset.y=-(t*1.6%1);
    if(mundo.userData.agua) mundo.userData.agua.position.y=T.nivelAgua+Math.sin(t*.8)*.06;
    // tormenta
    const llueve=R.tormenta>0; tLluvia+=((llueve?1:0)-tLluvia)*Math.min(1,dt*3);
    if(lluvia){ lluvia.visible=tLluvia>.05; if(lluvia.visible){ const p=lluvia.geometry.attributes.position.array; for(let i=1;i<p.length;i+=3){ p[i]-=dt*46; if(p[i]<0) p[i]+=30; } lluvia.geometry.attributes.position.needsUpdate=true; lluvia.position.set(cam.position.x, cam.position.y-12, cam.position.z); } }
    luzSol.intensity=(T.tema.tarde?.75:.7)*(1-tLluvia*.6); luzAmb.intensity=(T.tema.tarde?.85:.9)*(1-tLluvia*.4);
    // cámara detrás del kart
    if(yo){
      if(camH==null){ camH=yo.h; camPos.set(yo.x, yo.y+6, yo.z); }
      let d=yo.h-(yo.desliz||0)*.2-camH; d=Math.atan2(Math.sin(d), Math.cos(d)); camH+=d*Math.min(1, dt*(yo.spin>0?1.5:5.5));
      const vert=cam.aspect<1, atras=(vert?9.6:7.4)+(yo.boost>0?1:0), alto=vert?4.6:3.4;
      const ysu=yo.ySuelo!=null?Math.max(yo.ySuelo, yo.y-2.2):yo.y;
      v3.set(yo.x-Math.sin(camH)*atras, ysu+alto+(yo.y-ysu)*.5, yo.z-Math.cos(camH)*atras);
      camPos.lerp(v3, Math.min(1, dt*10)); cam.position.copy(camPos);
      cam.lookAt(yo.x+Math.sin(camH)*5, yo.y+1.5, yo.z+Math.cos(camH)*5);
      const f=(vert?84:70)+(yo.boost>0||yo.viento>0?10:0)+Math.min(6, Math.abs(yo.v)*.12); fov+=(f-fov)*Math.min(1,dt*4);
      if(Math.abs(cam.fov-fov)>.05){ cam.fov=fov; cam.updateProjectionMatrix(); }
    }
    rend.render(esc, cam);
  }
  /* vista de paseo por la pista (antes de largar o mirando el final) */
  function paseo(R, t){
    if(T && T.arena){ if(!esc || !mundo) return; const a=t*.25, d=T.radio*1.1; cam.position.set(Math.sin(a)*d, 32, Math.cos(a)*d); cam.lookAt(0,0,0); camH=null; return; }
    if(!esc || !mundo) return; const s=T.S[Math.floor((t*9)%T.N)], o=T.S[Math.floor((t*9+14)%T.N)];
    cam.position.set(s.x+s.nx*6, s.y+13, s.z+s.nz*6); cam.lookAt(o.x, o.y+1, o.z); camH=null;
  }
  /* el podio: los tres primeros festejan (el 1º con la copa, el 2º contento, el 3º festeja pero medio triste) */
  let podio=null;
  function cerrarPodio(){
    if(!podio) return; podio.ks.forEach(v=>v.tirar()); podio.tirar.forEach(x=>{ x.geometry.dispose(); if(x.material.map) x.material.map.dispose(); x.material.dispose(); });
    if(podio.esc.background && podio.esc.background.dispose) podio.esc.background.dispose(); podio=null;
  }
  function texto(t, color, tam){ const c=document.createElement('canvas'); c.width=c.height=128; const g=c.getContext('2d'); g.font='900 '+(tam||96)+'px system-ui,"Segoe UI Emoji",sans-serif'; g.textAlign='center'; g.textBaseline='middle';
    if(color){ g.lineWidth=10; g.strokeStyle='rgba(0,0,0,.55)'; g.strokeText(t,64,70); g.fillStyle=color; } g.fillText(t,64,70); return new THREE.CanvasTexture(c); }
  // final=true: entrega de la copa al terminar la copa completa (el campeón festeja, los demás quedan tristes)
  function mostrarPodio(lista, tema, final){
    if(!rend) return; cerrarPodio();
    const e=new THREE.Scene(), tirar=[];
    e.background = tema ? cielo(tema) : new THREE.Color('#2a3a7a');
    e.add(new THREE.HemisphereLight('#ffffff','#7a8a6a',1)); const l=new THREE.DirectionalLight('#fff6e0',.75); l.position.set(.4,1,.9); e.add(l);
    const b=new Obra();
    b.cil(0,-.1,0,30,30,.1,'#4f8f3a',32); b.caja(0,0,4,3,.03,14,'#c0262a');   // césped y alfombra
    b.caja(0,0,-5,17,6.5,.4,'#1d3f8a'); b.caja(0,6.5,-5,17,.6,.42,'#d52b1e'); b.caja(0,7.1,-5,17,.6,.42,'#ffffff'); b.caja(0,7.7,-5,17,.6,.42,'#1d6fe0');   // telón con los colores de la bandera
    for(const x of [-8.2,8.2]){ b.cil(x,0,-4.6,.18,.18,9,'#d8dde6',8); b.caja(x+(x<0?.9:-.9),7.4,-4.55,1.6,1.1,.05,x<0?'#d52b1e':'#1d6fe0'); }
    const alt=[2.1,1.4,.85], xs=[0,-3.9,3.9], cols=['#f2c14e','#c9d1dc','#d0884a'];
    alt.forEach((h,i)=>{ if(i<lista.length || i===0){ b.caja(xs[i],0,0,3.6,h,3.8,'#f4f1e8'); b.caja(xs[i],h-.12,0,3.7,.14,3.9,cols[i]); b.caja(xs[i],.1,1.91,3.6,.18,.02,cols[i]); } });
    const base=b.malla(); e.add(base); tirar.push(base);
    // números en el frente de cada escalón
    lista.slice(0,3).forEach((q,i)=>{ const sp=new THREE.Mesh(new THREE.PlaneGeometry(1.5,1.5), new THREE.MeshBasicMaterial({map:texto(String(i+1), cols[i]), transparent:true})); sp.position.set(xs[i], alt[i]*.5, 1.92); e.add(sp); tirar.push(sp); });
    // los que no subieron al podio (solo en la final): abajo, a los costados
    const abajo=[[-7.6,2.6,.55],[7.6,2.6,-.55],[-4.4,7.2,.25],[4.4,7.2,-.25],[-9.8,6.2,.55],[9.8,6.2,-.55]];
    const ks=lista.slice(0, final?9:3).map((q,i)=>{
      const v=crearKart3D(q.ch, q.color), ab=abajo[i-3]; if(i>=3 && !ab) return null;
      if(i<3){ v.g.position.set(xs[i], alt[i], 0); v.g.rotation.y=i===1?.32:i===2?-.32:0; } else { v.g.position.set(ab[0], 0, ab[1]); v.g.rotation.y=ab[2]; v.g.scale.setScalar(.85); }
      v.sombra.visible=false; e.add(v.g);
      etiquetaKart(v, q.nombre+(final&&q.pts!=null?' · '+q.pts:''), q.color, q.cara); v.etiqueta.position.y=i<3?4.6:3.9; if(i<3) v.etiqueta.scale.set(4.6,1.7,1); else v.etiqueta.scale.set(3.6,1.33,1);
      v.anim = !final ? ['gana','contento','triste'][i] : i===0 ? 'campeon' : i<3 ? 'triste' : 'llora';
      if(i===0){ const tr=OBJ3.trofeo(); tr.position.set(0,-.05,.8); tr.scale.setScalar(final?2.5:1.75); v.brazos[1].add(tr); v.extras.push(tr); v.trofeo=tr; v.trofeoE=final?2.5:1.75; }
      else if(i<3){ const m=OBJ3.medalla(cols[i]); m.position.set(0,1.05,.52); v.pil.add(m); v.extras.push(m); }
      const emo = !final ? ['😁','😄','🥲'][i] : i===0 ? '🤩' : ['😢','😞','😭','😩','😢','😔'][(i-1)%6];
      const cara=new THREE.Sprite(new THREE.SpriteMaterial({map:texto(emo), transparent:true, depthWrite:false})); cara.scale.set(.95,.95,1); cara.position.set(-1,2.45,.3); v.pil.add(cara); v.extras.push(cara);
      return v; }).filter(Boolean);
    // papelitos
    const n=calidad==='baja'?160:340, p=new Float32Array(n*3), c=new Float32Array(n*3), paleta=['#d52b1e','#ffffff','#1d6fe0','#f2c14e','#2fae5a','#ff7a1e'].map(x=>new THREE.Color(x));
    for(let i=0;i<n;i++){ p[i*3]=(Math.random()-.5)*20; p[i*3+1]=Math.random()*13; p[i*3+2]=(Math.random()-.5)*10; const k=paleta[i%paleta.length]; c[i*3]=k.r; c[i*3+1]=k.g; c[i*3+2]=k.b; }
    const gp=new THREE.BufferGeometry(); gp.setAttribute('position', new THREE.BufferAttribute(p,3)); gp.setAttribute('color', new THREE.BufferAttribute(c,3));
    const conf=new THREE.Points(gp, new THREE.PointsMaterial({size:.24, vertexColors:true})); conf.frustumCulled=false; e.add(conf); tirar.push(conf);
    podio={esc:e, ks, conf, tirar, final:!!final, t0:performance.now()/1000};
  }
  function cuadroPodio(dt){
    if(!podio) return; const t=performance.now()/1000-podio.t0, S=Math.sin, A=Math.abs;
    podio.ks.forEach((v,i)=>{ const P=v.pil, bi=v.brazos[0], bd=v.brazos[1], an=v.anim;
      if(an==='campeon' && t<2.2){   // le entregan la copa: baja girando del cielo hasta sus manos
        const q=Math.min(1, t/1.8), ease=1-Math.pow(1-q,3); P.position.y=.4; P.rotation.set(0,0,0);
        bd.rotation.set(-2.5, 0, -.12); bi.rotation.set(-2.5, 0, .12);
        if(v.trofeo){ v.trofeo.rotation.x=-bd.rotation.x; v.trofeo.rotation.y=t*7*(1-ease)+t; v.trofeo.position.y=-.05+(1-ease)*7; v.trofeo.scale.setScalar(v.trofeoE*(.4+.6*ease)); }
      } else if(an==='gana' || an==='campeon'){   // salta con la copa en alto y saluda con la otra mano
        const s=A(S(t*4.4)); P.position.y=.5+s*.75; P.rotation.set(0, S(t*1.3)*.4, 0); v.cuerpo.position.y=A(S(t*4.4+1.2))*.12;
        bd.rotation.set(-2.55+S(t*4.4)*.3, 0, -.12); bi.rotation.set(-2.2+S(t*9)*.3, 0, .55+S(t*9)*.3);
        if(v.trofeo){ v.trofeo.position.y=-.05; v.trofeo.scale.setScalar(v.trofeoE); v.trofeo.rotation.x=-bd.rotation.x; v.trofeo.rotation.y=t*1.5; }
      } else if(an==='llora'){   // se quedó sin nada: sentado, la cara entre las manos y moqueando
        P.position.y=0; P.rotation.set(.34, 0, S(t*14)*.025); bi.rotation.set(-1.55+S(t*11)*.05, 0, -.45); bd.rotation.set(-1.55+S(t*11+1)*.05, 0, .45);
      } else if(an==='contento'){   // contento: brinca y levanta los brazos de a uno
        P.position.y=.35+A(S(t*3.1))*.3; P.rotation.set(0, S(t*.9)*.3, 0);
        bi.rotation.set(-1.9+S(t*3.1)*.6, 0, .4); bd.rotation.set(-1.9-S(t*3.1)*.6, 0, -.4);
      } else {   // festeja medio triste: cabizbajo, se hamaca despacio y saluda flojito
        const hop=Math.pow(Math.max(0, S(t*1.5)), 10)*.22; P.position.y=.12+hop; P.rotation.set(.26, S(t*.7)*.15, S(t*1.1)*.1);
        bi.rotation.set(.35, 0, .12); bd.rotation.set(-1.15+S(t*2.2)*.25, 0, -.25+S(t*2.2)*.12);
      }
    });
    const p=podio.conf.geometry.attributes.position.array; for(let i=0;i<p.length;i+=3){ p[i+1]-=dt*(1.6+(i%7)*.25); p[i]+=S(t*2+i)*dt*.6; if(p[i+1]<0) p[i+1]+=13; } podio.conf.geometry.attributes.position.needsUpdate=true;
    const vert=cam.aspect<1; cam.fov=vert?62:44; cam.updateProjectionMatrix(); fov=cam.fov;
    const lejos=podio.final?1.45:1; cam.position.set(S(t*.2)*2.6, (vert?5:4.4)*lejos, (vert?17:14)*lejos); cam.lookAt(0, vert?3:2.7, podio.final?1.5:0);
    rend.render(podio.esc, cam);
  }
  /* vitrina del menú: el kart elegido girando */
  function mostrarVitrina(ch, color){
    if(!rend) return;
    if(!vitrina || !esc || mundo){ limpiar(); esc=new THREE.Scene(); esc.add(new THREE.HemisphereLight('#ffffff','#8a9a7a',1)); const l=new THREE.DirectionalLight('#fff6e0',.7); l.position.set(.5,1,.6); esc.add(l);
      const piso=new THREE.Mesh(new THREE.CylinderGeometry(3.2,3.4,.3,24), new THREE.MeshLambertMaterial({color:'#2a3a7a'})); piso.position.y=-.15; esc.add(piso);
      const aro=new THREE.Mesh(new THREE.TorusGeometry(3.25,.08,6,32), new THREE.MeshBasicMaterial({color:'#f2c14e'})); aro.rotation.x=Math.PI/2; aro.position.y=.02; esc.add(aro);
      vitrina={k:null, v:null}; esc.background=null; rend.setClearColor(0,0); }
    if(vitrina.v){ esc.remove(vitrina.v.g); vitrina.v.tirar(); }
    vitrina.v=crearKart3D(ch, color); vitrina.v.sombra.visible=false; esc.add(vitrina.v.g);
  }
  function cuadroVitrina(t){ if(!vitrina || !vitrina.v) return; vitrina.v.g.rotation.y=t*.9; cam.fov=40; cam.position.set(0,2.9,7.6); cam.lookAt(0,.95,0); cam.updateProjectionMatrix(); fov=40; rend.render(esc, cam); }
  return {init, tam, cargar, limpiar, sync, paseo, kart, etiqueta, setCalidad, mostrarVitrina, cuadroVitrina, mostrarPodio, cuadroPodio, cerrarPodio, enPodio(){ return !!podio; }, get calidad(){ return calidad; }, set calidad(q){ calidad=q; }, get lienzo(){ return lienzo; }, get listo(){ return !!rend; }, foto(){ return lienzo.toDataURL('image/png'); }, get cam(){ return cam; }, get esc(){ return esc; }, get rend(){ return rend; }, enVitrina(){ return !!vitrina; }};
})();
