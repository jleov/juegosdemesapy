'use strict';
/* =====================================================================
   Carrera Guasu — el mundo en 3D (three.js): piso, camino, agua, cielo
   y todos los decorados de cada ciudad. Todo lo que no se mueve se junta
   en una sola malla con colores por vértice, para que ande liviano en
   celulares modestos.
   ===================================================================== */
const azar = seed => { let s = seed>>>0 || 1; return () => { s = (s*1664525 + 1013904223)>>>0; return s/4294967296; }; };

/* ---------- Obra: junta cajas, cilindros y esferas en una sola malla ---------- */
class Obra {
  constructor(){ this.pos=[]; this.nor=[]; this.col=[]; this.base=new THREE.Matrix4(); this.pila=[]; this.w=8; this.rnd=Math.random; }
  static geo(k, f){ const c=Obra._g||(Obra._g={}); return c[k]||(c[k]=f().toNonIndexed()); }
  meter(g, color, m){
    const M=Obra._m||(Obra._m=new THREE.Matrix4()), NM=Obra._n||(Obra._n=new THREE.Matrix3()), v=Obra._v||(Obra._v=new THREE.Vector3());
    M.multiplyMatrices(this.base, m); NM.getNormalMatrix(M);
    const c=Obra._c||(Obra._c=new THREE.Color()); c.set(color);
    const p=g.attributes.position.array, n=g.attributes.normal.array;
    for(let i=0;i<p.length;i+=3){
      v.set(p[i],p[i+1],p[i+2]).applyMatrix4(M); this.pos.push(v.x,v.y,v.z);
      v.set(n[i],n[i+1],n[i+2]).applyMatrix3(NM).normalize(); this.nor.push(v.x,v.y,v.z);
      this.col.push(c.r,c.g,c.b);
    }
  }
  _mat(x,y,z,sx,sy,sz,rx,ry,rz){
    const m=Obra._l||(Obra._l=new THREE.Matrix4()), q=Obra._q||(Obra._q=new THREE.Quaternion()), e=Obra._e||(Obra._e=new THREE.Euler());
    e.set(rx||0, ry||0, rz||0, 'YXZ'); q.setFromEuler(e);
    return m.compose(new THREE.Vector3(x,y,z), q, new THREE.Vector3(sx,sy,sz));
  }
  // caja apoyada en y (x,z = centro)
  caja(x,y,z,sx,sy,sz,color,ry,rx,rz){ this.meter(Obra.geo('caja',()=>new THREE.BoxGeometry(1,1,1)), color, this._mat(x,y+sy/2,z,sx,sy,sz,rx,ry,rz)); return this; }
  // cilindro o cono apoyado en y
  cil(x,y,z,rArriba,rAbajo,h,color,seg,rx,rz){
    seg=seg||8; const g=new THREE.CylinderGeometry(rArriba,rAbajo,h,seg,1).toNonIndexed();
    if(rx||rz){ const m=this._mat(x,y,z,1,1,1,rx,0,rz); const t=new THREE.Matrix4().makeTranslation(0,h/2,0); m.multiply(t); this.meter(g,color,m); }
    else this.meter(g, color, this._mat(x,y+h/2,z,1,1,1));
    g.dispose(); return this;
  }
  esf(x,y,z,r,color,sy,seg,sx,sz){ seg=seg||7; this.meter(Obra.geo('esf'+seg,()=>new THREE.SphereGeometry(1,seg,Math.max(4,seg-2))), color, this._mat(x,y,z,r*(sx||1),r*(sy||1),r*(sz||1))); return this; }
  // dibuja algo en un lugar, girado y a escala
  en(x,y,z,rot,esc,fn){
    const viejo=this.base.clone(), m=new THREE.Matrix4().compose(new THREE.Vector3(x,y,z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0,rot||0,0)), new THREE.Vector3(esc||1,esc||1,esc||1));
    this.base.multiply(m); fn(this); this.base.copy(viejo); return this;
  }
  malla(mat){
    const g=new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos,3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor,3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col,3));
    this.pos=this.nor=this.col=null;
    return new THREE.Mesh(g, mat||new THREE.MeshLambertMaterial({vertexColors:true}));
  }
}

/* ---------- decorados: cada uno se dibuja en el origen mirando hacia +z (hacia la pista) ---------- */
const TEJA='#b5482e', BLANCO='#f4f1e8', PIEDRA='#a9a59b', MADERA='#7a5230', ROJIZO='#a8503a', VERDE='#2f8f3f';
const tono = (hex, r, k) => { const c=new THREE.Color(hex); const d=(r()-.5)*(k||.16); c.offsetHSL(0, 0, d); return c; };
const GENTE=['#e23b3b','#f2c14e','#3b7be2','#ffffff','#2fae5a','#ff8a3d','#c452d8','#222a55'];
const DECO = {
  palmera(b,r){ const h=7+r()*3, inc=(r()-.5)*.25; b.cil(0,0,0,.22,.34,h,'#8a6a45',6,0,inc); const tx=-Math.sin(inc)*h, ty=Math.cos(inc)*h;
    for(let i=0;i<7;i++){ const a=i/7*6.283+r(); b.caja(tx+Math.sin(a)*1.7,ty-.5,Math.cos(a)*1.7,.7,.12,3.6,tono('#3f9a45',r),a,.45); } b.esf(tx,ty-.2,0,.45,'#6b4a2b'); },
  arbol(b,r){ const h=3+r()*2, c=tono('#3a8f3d',r,.2); b.cil(0,0,0,.28,.42,h,'#6b4a2b',6); b.esf(0,h+1.6,0,2.6+r(),c,.85); b.esf(1.3,h+.6,.6,1.7,tono('#3a8f3d',r,.2),.8); b.esf(-1.2,h+.8,-.5,1.8,c,.8); },
  lapacho(b,r,col){ const h=3.5+r()*2, c=col||'#f08ac0'; b.cil(0,0,0,.25,.4,h,'#5a4030',6); b.cil(.5,h-.8,0,.12,.18,2.2,'#5a4030',5,0,-.7); b.cil(-.5,h-.8,0,.12,.18,2.2,'#5a4030',5,0,.7);
    b.esf(0,h+1.8,0,2.5+r()*.6,tono(c,r,.12),.8); b.esf(1.8,h+1,.3,1.7,tono(c,r,.12),.8); b.esf(-1.7,h+1.1,-.3,1.8,tono(c,r,.12),.8); b.esf(.2,h+.9,1.4,1.5,tono(c,r,.12),.8); },
  lapachoA(b,r){ DECO.lapacho(b,r,'#f6cf3a'); },
  pino(b,r){ const h=2+r(), c=tono('#2c7a45',r,.14); b.cil(0,0,0,.25,.35,h,'#6b4a2b',6); b.cil(0,h,0,0,2.4,3.2,c,7); b.cil(0,h+2,0,0,1.9,2.8,c,7); b.cil(0,h+3.8,0,0,1.3,2.4,c,7); },
  arbusto(b,r){ b.esf(0,.7,0,1.2+r()*.6,tono('#3f9a45',r,.2),.7); b.esf(1,.5,.3,.8,tono('#4aa54a',r,.2),.7); },
  arbustoSeco(b,r){ b.esf(0,.5,0,1+r()*.5,tono('#9a9a52',r,.2),.6); b.esf(.8,.4,.2,.6,tono('#8a8a44',r,.2),.6); },
  helecho(b,r){ for(let i=0;i<5;i++){ const a=i/5*6.283+r(); b.caja(Math.sin(a)*.7,.5,Math.cos(a)*.7,.4,.08,1.8,tono('#3aa04a',r,.2),a,.6); } },
  roca(b,r){ b.esf(0,.5,0,1.2+r()*.8,tono('#8d8a84',r,.14),.7,5); b.esf(1.1,.3,.5,.7,tono('#7d7a74',r,.14),.7,5); },
  cactus(b,r){ const h=3+r()*2; b.cil(0,0,0,.4,.45,h,'#4f8f4a',7); b.esf(0,h,0,.4,'#4f8f4a'); b.cil(.9,h*.45,0,.25,.25,1.4,'#4f8f4a',6); b.caja(.5,h*.42,0,.9,.4,.4,'#4f8f4a'); b.cil(-.9,h*.6,0,.25,.25,1.1,'#4f8f4a',6); b.caja(-.5,h*.57,0,.9,.4,.4,'#4f8f4a'); },
  paloBorracho(b,r){ const h=4+r()*1.5; b.cil(0,0,0,.5,.7,1,'#8f9a72',8); b.esf(0,2.1,0,1.25,'#9aa57a',1.25,8); b.cil(0,3,0,.35,.6,h-2,'#8f9a72',7);
    for(let i=0;i<4;i++){ const a=i/4*6.283+r(); b.cil(0,h+.6,0,.12,.2,2.4,'#7f8a62',5,Math.cos(a)*.9,Math.sin(a)*.9); b.esf(Math.sin(a)*1.9,h+2.2,-Math.cos(a)*0+Math.cos(a)*1.9,1.2,tono(r()<.4?'#f3b6cf':'#5a9a4a',r,.1),.6); } },
  farol(b){ b.cil(0,0,0,.09,.13,5,'#2c2f3a',6); b.caja(0,4.9,.5,.12,.12,1.1,'#2c2f3a'); b.esf(0,4.75,1,.3,'#fff3b0'); },
  poste(b){ b.cil(0,0,0,.1,.12,1.3,'#8a6a45',5); },
  antorcha(b){ b.cil(0,0,0,.08,.1,2,'#5a4030',5); b.esf(0,2.25,0,.32,'#ff9a2e',1.3,5); },
  vela(b){ b.cil(0,0,0,.2,.22,1.2,'#f6f0dc',7); b.esf(0,1.4,0,.16,'#ffb52e',1.5,5); },
  bandera(b){ b.cil(0,0,0,.08,.1,7,'#d9d9d9',6); b.caja(1.25,6.2,0,2.5,.5,.06,'#d52b1e'); b.caja(1.25,5.7,0,2.5,.5,.06,'#ffffff'); b.caja(1.25,5.2,0,2.5,.5,.06,'#0038a8'); b.esf(1.25,5.95,.05,.16,'#f2c14e',1,5); },
  casa(b,r){ const w=7+r()*3, c=r()<.5?BLANCO:['#f6dfa0','#f2c9b0','#cfe4f2','#e8f0c8'][Math.floor(r()*4)];
    b.caja(0,0,0,w,3.2,6,c); b.caja(0,3.2,0,w+1,.25,7,TEJA); b.caja(0,3.4,0,w+.4,.9,4.2,TEJA); b.caja(0,4.2,0,w+.2,.6,1.8,'#a23f28');
    b.caja(0,0,3.6,w+1,2.9,.15,'#00000000'.slice(0,7)==='#000000'?TEJA:TEJA,0,1.25);   // alero del corredor
    for(let x=-w/2+.4;x<=w/2-.3;x+=(w-.8)/3) b.cil(x,0,4.3,.14,.16,2.5,BLANCO,6);
    b.caja(0,0,3.02,1,2.1,.1,'#6b3a1d'); b.caja(-w/4,1.2,3.02,1,1,.1,'#3a6a8a'); b.caja(w/4,1.2,3.02,1,1,.1,'#3a6a8a'); },
  casaChaco(b,r){ b.caja(0,.8,0,9,3,6,'#e8e0cc'); b.caja(0,3.8,0,10,.25,4.2,'#8a8f96',0,0,.0); b.caja(0,3.8,1.6,10,.2,3.6,'#9aa0a8',0,.5); b.caja(0,3.8,-1.6,10,.2,3.6,'#8a8f96',0,-.5);
    for(const x of [-4,-1.4,1.4,4]) b.cil(x,0,2.6,.12,.12,.8,MADERA,5), b.cil(x,0,-2.6,.12,.12,.8,MADERA,5); b.caja(0,.8,3.02,1,2,.1,'#5a4030'); },
  cabana(b,r){ b.caja(0,0,0,6,2.6,5,'#8a5a34'); b.caja(0,2.6,1.4,7,.25,3.6,'#5a3a22',0,.6); b.caja(0,2.6,-1.4,7,.25,3.6,'#5a3a22',0,-.6); b.caja(0,0,2.52,1,2,.1,'#3a2414'); b.cil(2,3,-1,.25,.3,1.6,PIEDRA,6); },
  edificio(b,r){ const w=9+r()*5, d=9+r()*4, h=14+r()*26, c=['#d8dde6','#c9b9a6','#b8c8d8','#e6d9c0','#a8b4c4','#e0c4b4'][Math.floor(r()*6)];
    b.caja(0,0,0,w,h,d,c); b.caja(0,h,0,w*.6,1.4,d*.6,'#8a8f96');
    for(let y=2.2;y<h-1;y+=3) b.caja(0,y,0,w+.12,1.1,d+.12,'#4a6a8a'); b.caja(0,0,d/2+.05,2,2.4,.1,'#2c3440'); },
  torre(b,r){ const w=10+r()*4, h=26+r()*30, c=['#7fb0d8','#9ac0c8','#d8c088','#c8a8d0','#8fd0b0'][Math.floor(r()*5)];
    b.caja(0,0,0,w+3,5,w+3,'#d8d8d8'); b.caja(0,5,0,w,h,w,c); for(let y=7;y<h+3;y+=3.2) b.caja(0,y,0,w+.14,.5,w+.14,'#ffffff');
    b.caja(0,h+5,0,w*.5,2.5,w*.5,'#666c78'); b.cil(0,h+7.5,0,.12,.12,6,'#c0392b',5); b.caja(0,2.2,(w+3)/2+.1,(w+3)*.8,1.8,.2,['#e23b3b','#f2c14e','#2fae5a','#3b7be2'][Math.floor(r()*4)]); },
  letrero(b,r){ const c=['#e23b3b','#f2c14e','#2fae5a','#3b7be2','#ff5fa8','#ff8a3d'][Math.floor(r()*6)]; b.cil(-1.6,0,0,.12,.12,6,'#3a3f4a',5); b.cil(1.6,0,0,.12,.12,6,'#3a3f4a',5); b.caja(0,3.6,0,4.4,2.6,.3,c); b.caja(0,4.2,.2,3.4,.5,.1,'#ffffff'); b.caja(0,5,.2,2.2,.4,.1,'#ffffff'); },
  cartel(b,r){ b.cil(-2.6,0,0,.14,.14,5.6,'#4a4f5a',5); b.cil(2.6,0,0,.14,.14,5.6,'#4a4f5a',5); b.caja(0,2.6,0,6.6,3.2,.3,'#f2c14e'); b.caja(0,2.9,.2,5.8,2.6,.1,'#d52b1e'); b.caja(0,3.5,.3,4.6,.9,.1,'#ffffff'); b.esf(-1.6,4.6,.3,.5,'#f2c14e',1,6); b.caja(.6,4.7,.3,2.6,.35,.1,'#ffe9a8'); },
  tribuna(b,r){ const n=5; for(let i=0;i<n;i++) b.caja(0,0,-i*1.3-1,15,1+i*.9,1.3,i%2?'#c8ccd4':'#b4b8c2');
    for(let i=0;i<n;i++) for(let x=-6.8;x<7;x+=1.15) if(r()<.8) b.caja(x+(r()-.5)*.3,1+i*.9,-i*1.3-1,.6,.9,.5,GENTE[Math.floor(r()*GENTE.length)]);
    b.caja(0,0,-n*1.3-1.1,15,n*.9+3.4,.3,'#8a8f9a'); b.caja(0,n*.9+3.4,-n*.65-1,15.4,.25,n*1.3+1.6,'#d52b1e'); },
  reflector(b){ b.cil(0,0,0,.25,.4,22,'#8a8f9a',6); b.caja(0,21,.3,5,3,.5,'#3a3f4a'); for(let x=-1.8;x<=1.8;x+=1.2) for(let y=21.5;y<=23.3;y+=.9) b.esf(x,y,.6,.36,'#fffbd0',1,5); },
  puesto(b,r){ b.caja(0,0,0,3.4,1,1.6,MADERA); for(const x of [-1.6,1.6]) for(const z of [-.7,.7]) b.cil(x,0,z,.07,.07,2.7,'#5a4030',5);
    for(let i=0;i<4;i++) b.caja(-1.35+i*.9,2.7,0,.9,.14,2.2,i%2?'#ffffff':'#d52b1e',0,.12); b.cil(-.8,1,0,.5,.4,.35,'#c79a55',8); for(let i=0;i<5;i++) b.esf(-.8+Math.cos(i)*.25,1.42,Math.sin(i)*.25,.17,'#e6b85a',.7,5); b.cil(.8,1,0,.22,.22,.7,'#2f6fb0',7); },
  sombrilla(b,r){ const c=['#e23b3b','#f2c14e','#3b7be2','#2fae5a','#ff8a3d','#ff5fa8'][Math.floor(r()*6)]; b.cil(0,0,0,.06,.06,2.6,'#e8e8e8',5); b.cil(0,2.3,0,0,2,.75,c,8); b.caja(1.2,.1,.6,.8,.12,1.9,'#ffffff',.3); b.caja(-1.1,.1,.4,.8,.12,1.9,c,-.2); },
  velero(b,r){ b.caja(0,0,0,1.8,.8,5,'#f4f1e8'); b.caja(0,0,2.9,1.2,.7,1.2,'#f4f1e8',.78); b.cil(0,.8,.2,.07,.07,6.4,'#8a6a45',5); b.caja(0,1.4,-1.1,.08,5,2.4,['#ffffff','#ffe1a8','#ff9c9c','#bfe0ff'][Math.floor(r()*4)],0,-.22); b.caja(0,1.4,1.5,.08,3.6,1.8,'#ffffff',0,.3); b.caja(0,.75,0,1.9,.14,5.1,'#d52b1e'); },
  lancha(b,r){ b.caja(0,0,0,2.2,.9,5.4,'#f4f1e8'); b.caja(0,0,3.1,1.5,.8,1.5,'#f4f1e8',.78); b.caja(0,.9,-.6,1.8,.9,1.6,'#3b7be2'); b.caja(0,.85,0,2.3,.12,5.5,'#0038a8'); },
  muelle(b){ b.caja(0,.35,-7,2.6,.25,16,MADERA); for(let z=0;z>-15;z-=3) for(const x of [-1.2,1.2]) b.cil(x,-4,z,.16,.16,5.6,'#5a4030',5); b.caja(0,.6,-14.5,4.6,.2,3.6,MADERA); b.cil(2,.6,-15.6,.06,.06,2.4,'#e8e8e8',5); },
  carreta(b,r){ b.caja(0,.9,0,2,.3,3.6,MADERA); b.caja(-1,1.2,0,.12,.8,3.6,'#5a3a22'); b.caja(1,1.2,0,.12,.8,3.6,'#5a3a22'); for(const x of [-1.15,1.15]) b.cil(x,.9,0,.9,.9,.16,'#4a3020',10,0,1.5708); b.caja(0,.9,2.8,.12,.12,2.6,'#5a3a22'); b.esf(0,1.5,-.6,.6,'#e8d27a',.7); b.esf(.3,1.5,.5,.5,'#5aa84a',.7); },
  vaca(b,r){ const c=r()<.5?'#f4f1e8':'#7a4a2a'; b.caja(0,.9,0,.9,1,2,c); b.caja(0,1.5,1.2,.6,.6,.8,c); for(const x of [-.3,.3]) for(const z of [-.8,.8]) b.caja(x,0,z,.2,.9,.2,c); b.caja(.3,1.3,.2,.5,.5,.9,'#3a2a1a'); b.caja(0,2.05,1.2,.9,.08,.08,'#e8e0cc'); },
  frutilla(b,r){ b.cil(0,0,0,.95,.25,1.7,'#e3263a',8); b.esf(0,1.7,0,.95,'#e3263a',.45,8); for(let i=0;i<10;i++){ const a=r()*6.283, y=.4+r()*1.2, rr=.3+y*.42; b.esf(Math.sin(a)*rr,y,Math.cos(a)*rr,.08,'#ffe9a8',1,4); }
    for(let i=0;i<5;i++){ const a=i/5*6.283; b.caja(Math.sin(a)*.5,2.05,Math.cos(a)*.5,.4,.08,.9,'#2f9a3f',a,.3); } b.cil(0,2.05,0,.06,.08,.4,'#2f7a3f',5); },
  cantaro(b,r){ const c=['#b8623a','#a8502e','#c87a4a','#8a3f24'][Math.floor(r()*4)]; b.cil(0,0,0,.6,.3,.5,c,9); b.esf(0,.9,0,.75,c,.85,9); b.cil(0,1.4,0,.3,.42,.5,c,9); b.cil(0,1.9,0,.42,.3,.14,c,9); b.cil(0,.86,0,.77,.77,.1,'#f4e4c0',9); },
  tanque(b){ for(const x of [-1.6,1.6]) for(const z of [-1.6,1.6]) b.cil(x,0,z,.14,.14,9,'#8a8f9a',5); b.cil(0,9,0,2.6,2.6,3,'#c8ccd4',10); b.cil(0,12,0,0,2.8,1.2,'#a23f28',10); },
  molino(b){ for(const x of [-1,1]) for(const z of [-1,1]) b.cil(x*.2,0,z*.2,.06,.1,10,'#9aa0a8',4,z*.1,-x*.1); b.cil(0,9.8,.5,.15,.15,.5,'#666c78',6,1.5708); for(let i=0;i<10;i++){ const a=i/10*6.283; b.caja(Math.sin(a)*1.3,9.9+Math.cos(a)*1.3,.8,.5,1.9,.06,'#d8dde6',0,0,-a); } b.caja(0,9.8,-1.3,.06,1.2,1.6,'#d52b1e'); },
  estacion(b){ b.caja(0,0,0,16,4,7,'#e8d8b0'); b.caja(0,4,2.2,17,.3,5.4,TEJA,0,.5); b.caja(0,4,-2.2,17,.3,5.4,'#a23f28',0,-.5); for(let x=-7;x<=7;x+=3.5) b.cil(x,0,5,.16,.18,3,'#3a5a3a',6); b.caja(0,3,5,16,.2,3,'#3a5a3a',0,.15); b.caja(0,5.6,0,2.4,2.4,2.4,'#e8d8b0'); b.cil(0,8,0,0,2,1.4,TEJA,4); b.caja(0,0,8.5,22,.15,.5,'#3a3a3a'); b.caja(0,0,10,22,.15,.5,'#3a3a3a'); },
  hotel(b){ b.caja(0,0,0,22,7,9,'#f6e9c8'); b.caja(0,7,0,23,.4,10,TEJA); b.caja(0,7.4,0,22,1.6,6,TEJA); b.caja(-8,0,5.5,5,9,3,'#f6e9c8'); b.cil(-8,9,5.5,0,3.6,3,TEJA,4); b.caja(8,0,5.5,5,9,3,'#f6e9c8'); b.cil(8,9,5.5,0,3.6,3,TEJA,4);
    for(let x=-5;x<=5;x+=2.5) b.cil(x,0,5.4,.2,.22,3.4,BLANCO,6); b.caja(0,3.4,5.2,11,.3,2,'#e8d8b0'); for(let x=-9.5;x<=9.5;x+=2.7) b.caja(x,4.4,4.52,1.1,1.5,.1,'#3a6a8a'); b.caja(0,0,4.55,1.6,2.6,.1,'#6b3a1d'); },
  iglesia(b){ b.caja(0,0,0,9,7,16,BLANCO); b.caja(0,7,2.3,9.6,.3,6,TEJA,0,0,0); b.caja(2.3,7,0,5.6,.3,16.4,TEJA,0,0,-.6); b.caja(-2.3,7,0,5.6,.3,16.4,'#a23f28',0,0,.6);
    b.caja(0,0,9,5,13,3.2,BLANCO); b.caja(0,13,9,3.6,3,2.6,BLANCO); b.cil(0,16,9,0,2.6,3.4,TEJA,4,0,0); b.caja(0,19.2,9,.2,2,.2,'#5a4030'); b.caja(0,20,9,1.1,.2,.2,'#5a4030');
    b.caja(0,0,10.65,1.8,3.2,.1,'#6b3a1d'); b.esf(0,9,10.65,.9,'#3a6a8a',1,8,1,.1); for(const x of [-4.6,4.6]) for(let z=-5;z<=5;z+=3.3) b.caja(x,2.2,z,.12,2.6,1,'#3a6a8a'); },
  basilica(b){ // la Basílica de Caacupé: frente con columnas, dos torres y la cúpula azul
    b.caja(0,0,0,30,1.2,36,'#d8d2c4'); b.caja(0,1.2,-2,22,13,26,'#f1ead8'); b.caja(0,14.2,-2,23,1,27,'#d8d2c4');
    b.cil(0,15.2,-4,7.6,7.6,6,'#f1ead8',14); for(let i=0;i<14;i++){ const a=i/14*6.283; b.caja(Math.sin(a)*7.65,16.4,-4+Math.cos(a)*7.65,.9,3.2,.2,'#3a6a9a',a); }
    b.esf(0,21.2,-4,7.9,'#2f6fb5',1,14); b.cil(0,28.6,-4,.9,1.2,2.6,'#f1ead8',8); b.esf(0,31.6,-4,1,'#2f6fb5',1,8); b.caja(0,32.4,-4,.2,2.6,.2,'#f2c14e'); b.caja(0,33.9,-4,1.2,.2,.2,'#f2c14e');
    for(const x of [-9,9]){ b.caja(x,1.2,11,6,22,6,'#f1ead8'); b.caja(x,23.2,11,6.6,.8,6.6,'#d8d2c4'); b.cil(x,24,11,2.4,2.6,4,'#f1ead8',8); b.esf(x,28,11,2.6,'#2f6fb5',1.1,10); b.caja(x,30.6,11,.16,1.8,.16,'#f2c14e'); b.caja(x,16,14.05,2,3.4,.1,'#3a5a7a'); b.caja(x,8,14.05,2,3.4,.1,'#3a5a7a'); }
    b.caja(0,1.2,12,12,12,4,'#f1ead8'); for(let x=-4.5;x<=4.5;x+=3) b.cil(x,1.2,14.8,.55,.6,9,'#ffffff',8); b.caja(0,10.2,14.6,12.4,1,1.6,'#d8d2c4'); b.cil(0,11.2,14.4,0,7,3.4,'#f1ead8',3,0,0);
    b.caja(0,1.2,14.05,2.6,5,.1,'#6b3a1d'); for(let i=0;i<6;i++) b.caja(0,i*.2,17.4+ (5-i)*.5,16-i,.2,1,'#c8c2b4'); },
  tupasy(b){ b.cil(0,0,0,1.3,1.6,1.4,'#d8d2c4',8); b.cil(0,1.4,0,.25,.75,2.6,'#2f6fb5',8); b.esf(0,4.3,0,.36,'#f2d0b0'); b.cil(0,4.6,0,.42,.3,.25,'#f2c14e',8); b.cil(0,1.4,0,.3,.95,2.2,'#ffffff',8); },
  palacio(b){ // Palacio de López: blanco, con arcadas, alas a los costados y la torre del medio
    b.caja(0,0,0,56,1,20,'#d8d2c4'); b.caja(0,1,-1,38,9,12,'#f6f3ea'); b.caja(0,10,-1,39,.8,13,'#e2ddd0');
    for(const x of [-23,23]){ b.caja(x,1,2,10,10.5,16,'#f6f3ea'); b.caja(x,11.5,2,10.8,.8,16.8,'#e2ddd0'); for(const xx of [-3,0,3]){ b.caja(x+xx,2,10.05,1.5,3.2,.1,'#3a4a5a'); b.caja(x+xx,7,10.05,1.5,2.8,.1,'#3a4a5a'); } }
    for(let x=-17;x<=17;x+=3.4){ b.cil(x,1,5.6,.4,.45,4.2,'#ffffff',7); b.cil(x,5.8,5.6,.35,.4,3.6,'#ffffff',7); b.caja(x,2,5.05,1.7,2.8,.1,'#3a4a5a'); b.caja(x,6.6,5.05,1.5,2.4,.1,'#3a4a5a'); }
    b.caja(0,5.2,5.6,36,.6,1.6,'#e2ddd0'); b.caja(0,9.4,5.6,36,.6,1.6,'#e2ddd0');
    b.caja(0,1,3,9,13,9,'#f6f3ea'); b.caja(0,14,3,9.8,.8,9.8,'#e2ddd0'); b.caja(0,14.8,3,6.4,6,6.4,'#f6f3ea'); for(const x of [-2.2,0,2.2]) b.caja(x,15.8,6.25,1.1,3.4,.1,'#3a4a5a');
    b.caja(0,20.8,3,7,.7,7,'#e2ddd0'); b.caja(0,21.5,3,4.4,4.4,4.4,'#f6f3ea'); b.cil(0,25.9,3,0,3.3,3.6,'#c9c4b6',4); b.cil(0,29.3,3,.07,.07,4.6,'#d9d9d9',5);
    b.caja(1.1,33,3,2.2,.42,.06,'#d52b1e'); b.caja(1.1,32.58,3,2.2,.42,.06,'#ffffff'); b.caja(1.1,32.16,3,2.2,.42,.06,'#0038a8'); b.caja(0,1,7.55,2.6,4.4,.1,'#6b3a1d');
    for(const x of [-12,12]) b.en(x,1,12,0,1,o=>DECO.palmera(o,Math.random)); },
  panteon(b){ // Panteón de los Héroes: pórtico con columnas y cúpula
    b.caja(0,0,0,18,1,18,'#d8d2c4'); b.caja(0,1,0,13,10,13,'#f3ead8'); b.caja(0,11,0,14,1,14,'#d8cfbc'); b.cil(0,12,0,5,5,4.4,'#f3ead8',12);
    for(let i=0;i<12;i++){ const a=i/12*6.283; b.cil(Math.sin(a)*5.2,12,Math.cos(a)*5.2,.3,.3,4.4,'#ffffff',6); } b.esf(0,16.4,0,5.4,'#9aa7b0',1,12); b.cil(0,21.4,0,.8,1,2,'#f3ead8',8); b.esf(0,24,0,.9,'#9aa7b0'); b.caja(0,24.8,0,.16,2,.16,'#f2c14e');
    b.caja(0,1,8,10,9,3,'#f3ead8'); for(let x=-3.75;x<=3.75;x+=2.5) b.cil(x,1,10.4,.5,.55,7.4,'#ffffff',8); b.caja(0,8.4,10.2,10.6,.9,1.6,'#d8cfbc'); b.cil(0,9.3,10,0,6,2.8,'#f3ead8',3); b.caja(0,1,9.55,2,4.4,.1,'#5a3a22'); },
  ruinaMuro(b,r){ const w=6+r()*5, h=3+r()*3; b.caja(0,0,0,w,h*.6,1.2,tono(ROJIZO,r,.1)); b.caja(-w*.25,h*.6,0,w*.5,h*.4,1.2,tono(ROJIZO,r,.1)); b.caja(w*.3,h*.6,0,w*.2,h*.2,1.2,tono('#98483a',r,.1)); b.caja(w*.1,1.2,.05,1.2,2.2,1.25,'#3a2420'); b.esf(w*.4,h*.6+.3,0,.6,'#4a8f3d',.5,5); },
  columna(b,r){ const h=3+r()*4; b.caja(0,0,0,1.5,.5,1.5,'#98483a'); b.cil(0,.5,0,.5,.56,h,tono(ROJIZO,r,.1),8); if(r()<.6) b.caja(0,h+.5,0,1.4,.45,1.4,'#98483a'); },
  ruinaArco(b,r){ const w=b.w+3.2, h=9; for(const x of [-w,w]){ b.caja(x,0,0,3,h,2.6,tono(ROJIZO,r,.08)); b.caja(x,h,0,3.4,.6,3,'#98483a'); }
    for(let i=0;i<=12;i++){ const a=i/12*Math.PI; b.caja(-Math.cos(a)*(w-.4),h+.4+Math.sin(a)*4.6,0,2.6,1.5,2.4,tono(i%2?ROJIZO:'#98483a',r,.06),0,0,a-Math.PI/2); }
    b.caja(0,h+5.4,0,5,1.6,2.2,'#98483a'); b.esf(-w,h+1,0,.9,'#4a8f3d',.5,5); },
  ruinaFachada(b,r){ // el frente de la iglesia mayor de Trinidad
    b.caja(0,0,0,30,2,5,'#98483a'); for(const x of [-11,11]){ b.caja(x,2,0,7,13,4,ROJIZO); b.caja(x,15,0,5,4+ (x>0?3:0),3.6,'#98483a'); b.caja(x,7,2.05,2,3.6,.1,'#3a2420'); }
    b.caja(0,2,0,15,9,4,ROJIZO); b.caja(0,2,2.05,4,6,.1,'#3a2420'); b.cil(0,8,2.1,2,2,.2,'#3a2420',10,1.5708); for(let x=-6;x<=6;x+=4) b.cil(x,2,2.5,.5,.55,8,'#b86a52',8);
    b.caja(0,11,0,16,1,4.4,'#98483a'); b.caja(-3,12,0,5,3,3.6,ROJIZO); b.esf(5,12.4,0,1.4,'#4a8f3d',.5,5); b.esf(-11,19.4,0,1.2,'#4a8f3d',.5,5);
    for(let z=-8;z>=-40;z-=8) for(const x of [-13,13]) b.caja(x,0,z,2.4,5+ (z%16?2:0),2.4,ROJIZO); },
  campanario(b){ b.caja(0,0,0,6,14,6,ROJIZO); b.caja(0,14,0,6.6,.7,6.6,'#98483a'); for(const x of [-2.2,2.2]) for(const z of [-2.2,2.2]) b.caja(x,14.7,z,1.2,4,1.2,ROJIZO); b.caja(0,18.7,0,6.2,.7,6.2,'#98483a'); b.cil(0,19.4,0,0,3.6,3,'#98483a',4); b.esf(0,15.8,0,1,'#b89a3a',1.1,7); b.caja(0,2,3.05,1.6,3.4,.1,'#3a2420'); },
  monumento(b){ b.caja(0,0,0,12,1,12,PIEDRA); b.caja(0,1,0,8,1,8,'#c0bcb2'); b.caja(0,2,0,2.6,12,2.6,'#d8d4ca'); b.cil(0,14,0,0,2,3,'#d8d4ca',4); b.caja(0,9,1.35,1.6,.3,.1,'#f2c14e'); b.caja(0,8,1.35,.3,2.6,.1,'#f2c14e');
    for(const x of [-4.4,4.4]) b.en(x,1,4.4,0,.7,o=>DECO.bandera(o)); },
  cruz(b){ b.caja(0,0,0,2,.8,2,PIEDRA); b.caja(0,.8,0,.5,6,.5,'#f4f1e8'); b.caja(0,4.6,0,3,.5,.5,'#f4f1e8'); },
  mirador(b){ for(const x of [-2,2]) for(const z of [-2,2]) b.cil(x,0,z,.16,.2,7,MADERA,5); b.caja(0,7,0,5.4,.3,5.4,MADERA); for(const x of [-2.6,2.6]) b.caja(x,7.3,0,.12,1.1,5.4,'#5a3a22'); b.caja(0,7.3,2.6,5.4,1.1,.12,'#5a3a22'); b.caja(0,7.3,-2.6,5.4,1.1,.12,'#5a3a22'); b.cil(0,10,0,0,4.2,1.8,TEJA,4); for(const x of [-2,2]) for(const z of [-2,2]) b.cil(x,7.3,z,.1,.1,2.7,MADERA,5); },
  cerroPiedra(b,r){ const h=22+r()*20, w=14+r()*10; b.cil(0,-2,0,w*.55,w,h*.5,tono('#9a5f4a',r,.08),7); b.cil(0,h*.5-2,0,w*.42,w*.55,h*.35,tono('#b0705a',r,.08),7); b.cil(0,h*.85-2,0,w*.36,w*.42,h*.15,tono('#8a5444',r,.08),7); b.esf(0,h-2,0,w*.37,'#4a8a3f',.25,7); },
  cascada(b,r){ // una pared de piedra con el salto de agua
    b.caja(0,0,-3,22,13,6,'#6f6a62'); b.caja(-8,0,0,7,9,6,'#7d7870'); b.caja(8,0,.5,7,10,6,'#77726a'); b.caja(0,13,-3,23,1.2,7,'#3f8a3f'); b.esf(-8,9,0,3.4,'#3a8f3d',.6); b.esf(8,10,.5,3.6,'#35853a',.6);
    b.caja(0,0,.2,4.4,13,.5,'#dff4ff'); b.caja(-1.2,0,.5,1,12.6,.3,'#ffffff'); b.caja(1.4,0,.45,.8,12.8,.3,'#ffffff'); b.esf(0,.2,1.6,3,'#ffffff',.35,8); b.esf(-2.4,.2,2,1.6,'#eaf8ff',.35); b.esf(2.6,.2,2.2,1.8,'#eaf8ff',.35); },
  saltoMonday(b,r){ b.caja(0,-6,-6,90,22,12,'#6a5a48'); b.caja(0,16,-6,92,1.4,13,'#3f8a3f'); for(let i=0;i<7;i++){ const x=-36+i*12+r()*4, w=4+r()*5; b.caja(x,-6,.2,w,22,.6,'#e6f4f7'); b.caja(x+1,-6,.6,w*.4,21.4,.3,'#ffffff'); b.esf(x,-5.4,3,w*.8,'#ffffff',.4,7); }
    for(let i=0;i<9;i++) b.esf(-40+i*10+r()*4,17,-6,4+r()*2,'#35853a',.6); },
  puenteLejos(b){ // el puente de Encarnación a lo lejos, sobre el río
    for(let z=-220;z<=220;z+=44) b.caja(0,-6,z,5,16,5,'#c8ccd4'); b.caja(0,10,0,9,1.6,470,'#d8dde6'); b.caja(0,11.6,0,9.4,.5,470,'#8a8f9a');
    for(const z of [-44,44]){ b.caja(0,10,z,3,46,4,'#e8ecf2'); for(let k=1;k<=6;k++){ b.caja(0,11.6,z+k*6.6,.25,Math.hypot(k*6.6,44-k*5.5),.25,'#ffffff',0,-Math.atan2(k*6.6,44-k*5.5)); b.caja(0,11.6,z-k*6.6,.25,Math.hypot(k*6.6,44-k*5.5),.25,'#ffffff',0,Math.atan2(k*6.6,44-k*5.5)); } } },
  sambaArco(b,r){ const w=b.w+2.4; for(const x of [-w,w]) b.cil(x,0,0,.5,.6,9,'#c452d8',8); for(let i=0;i<=14;i++){ const a=i/14*Math.PI; b.esf(-Math.cos(a)*w,9+Math.sin(a)*3.4,0,.85,GENTE[i%6],1,6); }
    for(const x of [-w,w]){ for(let i=0;i<6;i++){ const a=i/6*6.283; b.caja(x+Math.sin(a)*1.5,9.6+Math.cos(a)*1.5,0,.5,2.2,.1,['#ff5fa8','#f2c14e','#2fae5a'][i%3],0,0,-a); } } },
  carroza(b,r){ b.caja(0,.6,0,5,1.4,9,'#c452d8'); b.caja(0,2,0,4,.4,8,'#f2c14e'); b.caja(0,2.4,-2,3,3,3,'#ff5fa8'); b.esf(0,6.6,-2,1.6,'#f2c14e',1,8); for(let i=0;i<8;i++){ const a=i/8*6.283; b.caja(Math.sin(a)*2.2,6.6+Math.cos(a)*2.2,-2.2,.6,2.6,.1,GENTE[i%6],0,0,-a); }
    for(const x of [-2.4,2.4]) for(const z of [-3,3]) b.cil(x,0,z,.7,.7,.4,'#222',8,0,1.5708); b.esf(1,3,2.4,.5,'#2fae5a'); b.esf(-1,3,2.6,.5,'#3b7be2'); },
  arcoFutbol(b){ b.cil(-3.6,0,0,.12,.12,2.5,'#ffffff',6); b.cil(3.6,0,0,.12,.12,2.5,'#ffffff',6); b.caja(0,2.44,0,7.4,.2,.2,'#ffffff'); b.caja(0,0,-1.2,7.2,.05,2.4,'#e8e8e8'); b.caja(0,0,0,50,.06,.3,'#ffffff'); b.caja(0,0,8,18,.06,.3,'#ffffff'); },
  pelota(b){ b.esf(0,1,0,1,'#ffffff',1,8); for(const [x,y,z] of [[0,1.9,0],[.8,1.2,.4],[-.7,1.3,.5],[.2,.6,.8],[-.3,1.2,-.9],[.7,.7,-.6]]) b.esf(x*.98,y*.98+.02,z*.98,.26,'#222222',1,5); },
  arpa(b,r){ // arpa paraguaya gigante
    b.caja(0,0,0,2.2,.5,3,'#5a3a22'); b.caja(0,.5,-1,1.2,7,.9,'#b8793a',0,.22); b.caja(0,7.1,.3,.8,.7,4.2,'#8a5a2a',0,-.28); b.cil(0,.5,1.9,.16,.2,7.6,'#8a5a2a',6); b.esf(0,8.3,1.9,.4,'#f2c14e');
    for(let i=0;i<9;i++){ const z=-.4+i*.26; b.caja(0,1.2+i*.12,z,.04,5.6-i*.06,.04,'#f4f1e8'); } },
  guitarra(b,r){ const c=['#c8822e','#b8622a','#d89a3a'][Math.floor(r()*3)]; b.cil(0,.2,0,1.9,1.9,.9,c,12,1.5708); b.cil(0,3.2,0,1.5,1.5,.9,c,12,1.5708); b.caja(0,1.4,0,2.6,1.6,.9,c);
    b.cil(0,3.1,.5,.55,.55,.1,'#2a1a10',10,1.5708); b.caja(0,4.4,.2,.6,5.4,.4,'#5a3a22'); b.caja(0,9.8,.2,.9,1.5,.4,'#3a2414'); for(const x of [-.18,-.06,.06,.18]) b.caja(x,1.4,.5,.03,8.6,.03,'#f4f1e8'); b.caja(0,1.3,.5,1.3,.25,.14,'#3a2414'); },
  casilla(b){ b.caja(0,0,0,4,3,4,'#e8e8e8'); b.caja(0,3,0,5,.3,5,'#0038a8'); b.caja(0,1.4,2.02,2.4,1.2,.1,'#3a6a8a'); b.caja(3.4,1,0,3,.2,.2,'#d52b1e'); b.caja(3.4,1.2,0,.6,.2,.22,'#ffffff'); },
  tucanPalo(b,r){ b.cil(0,0,0,.14,.18,4,'#6b4a2b',5); b.caja(0,3.9,0,1.6,.14,.14,'#6b4a2b'); b.esf(.4,4.5,0,.45,'#1a1a1a',1.3,6); b.esf(.4,4.75,.25,.28,'#ffffff',1,5); b.caja(.4,5,.6,.2,.26,.9,'#ff9a1e'); b.caja(.4,4.95,1.05,.18,.2,.2,'#222'); },
};
DECO.fuente = (b,r)=>{ b.cil(0,0,0,4,4.2,.9,'#d8d2c4',14); b.cil(0,.75,0,3.5,3.5,.2,'#5ab0d8',14); b.cil(0,.9,0,.6,.8,2.2,'#e8e2d4',8); b.cil(0,3,0,1.6,.5,.4,'#e8e2d4',10); b.esf(0,3.6,0,.5,'#bfeaff',1.6,6); for(let i=0;i<6;i++){ const a=i/6*6.283; b.esf(Math.sin(a)*1.2,2.4,Math.cos(a)*1.2,.25,'#dff4ff',1.4,5); } };
const RADIO = {palacio:30, basilica:22, panteon:13, iglesia:11, hotel:14, estacion:13, ruinaFachada:20, campanario:6, tribuna:8, edificio:9, torre:10, casa:7, casaChaco:7, cabana:6, monumento:9, cascada:13, cerroPiedra:22, tanque:4, molino:3, mirador:5, carroza:6, arcoFutbol:26, hotel2:14};
const FLOTA = {velero:1, lancha:1};
const LIBRE = {puenteLejos:1, saltoMonday:1, cascada:1, ruinaArco:1, sambaArco:1, muelle:1};

/* =====================================================================
   Armado de la escena de una pista
   ===================================================================== */
function texLienzo(w, h, pintar, repetir){
  const c=document.createElement('canvas'); c.width=w; c.height=h; pintar(c.getContext('2d'), w, h);
  const t=new THREE.CanvasTexture(c); if(repetir){ t.wrapS=t.wrapT=THREE.RepeatWrapping; } t.anisotropy=4; return t;
}
/* ---------- la arena del modo batalla: cancha redonda, baranda, tribunas y obstáculos ---------- */
function armarArena3D(T, calidad){
  const tema=T.tema, R0=T.radio, baja=calidad==='baja', r=azar(R0*131|0), G=new THREE.Group(), tirar=[];
  const reg = o => { tirar.push(o); return o; };
  const off={polygonOffset:true, polygonOffsetFactor:-3, polygonOffsetUnits:-30};
  // pasto alrededor
  const pasto=new THREE.Mesh(reg(new THREE.PlaneGeometry(3000,3000)), reg(new THREE.MeshLambertMaterial({color:tema.suelo2}))); pasto.rotation.x=-Math.PI/2; pasto.position.y=-.05; G.add(pasto);
  const anillo2=new THREE.Mesh(reg(new THREE.CircleGeometry(R0+70, 48)), reg(new THREE.MeshLambertMaterial({color:tema.suelo}))); anillo2.rotation.x=-Math.PI/2; anillo2.position.y=-.02; G.add(anillo2);
  // piso de la cancha: baldosas o tierra
  const tierra=T.def.piso==='tierra';
  const tex=reg(texLienzo(256,256,(g,w,h)=>{
    g.fillStyle='#fff'; g.fillRect(0,0,w,h);
    if(tierra){ for(let i=0;i<2200;i++){ const v=200+Math.random()*55|0; g.fillStyle=`rgba(${v},${v-20},${v-50},.5)`; g.fillRect(Math.random()*w, Math.random()*h, 3, 3); } }
    else { g.strokeStyle='rgba(120,110,95,.55)'; g.lineWidth=3; for(let i=0;i<=8;i++){ g.beginPath(); g.moveTo(i*32,0); g.lineTo(i*32,h); g.stroke(); g.beginPath(); g.moveTo(0,i*32); g.lineTo(w,i*32); g.stroke(); }
      for(let i=0;i<500;i++){ const v=215+Math.random()*40|0; g.fillStyle=`rgba(${v},${v},${v},.45)`; g.fillRect(Math.random()*w, Math.random()*h, 2, 2); } }
  }, true)); tex.repeat.set(R0/9, R0/9);
  const piso=new THREE.Mesh(reg(new THREE.CircleGeometry(R0, 64)), reg(new THREE.MeshLambertMaterial(Object.assign({map:tex, color:tema.camino}, off)))); piso.rotation.x=-Math.PI/2; piso.position.y=.02; G.add(piso);
  // dibujos en el piso: círculo del medio
  const aro=new THREE.Mesh(reg(new THREE.RingGeometry(R0*.36, R0*.36+.9, 64)), reg(new THREE.MeshBasicMaterial(Object.assign({color:'#ffffff', transparent:true, opacity:.55}, off, {polygonOffsetFactor:-5, polygonOffsetUnits:-50})))); aro.rotation.x=-Math.PI/2; aro.position.y=.05; G.add(aro);
  const b=new Obra(); b.rnd=r;
  // baranda roja y blanca alrededor
  const nB=Math.round(2*Math.PI*R0/3);
  for(let i=0;i<nB;i++){ const a=i/nB*Math.PI*2, x=Math.sin(a)*(R0+.6), z=Math.cos(a)*(R0+.6); b.en(x,0,z,a,1,o=>{ o.caja(0,0,0,3.2,1.2,1,tema.borde[i%2]); }); }
  // obstáculos
  for(const o of T.obst){ const f=DECO[o.t]; if(f) b.en(o.x,0,o.z,Math.atan2(-o.x,-o.z),o.s,q=>f(q,r)); }
  // tribunas con gente mirando la batalla, y alrededor la ciudad o el campo
  const nT=baja?6:10;
  for(let i=0;i<nT;i++){ const a=i/nT*Math.PI*2+.2, d=R0+9; b.en(Math.sin(a)*d,0,Math.cos(a)*d,a+Math.PI,1.2,o=>DECO.tribuna(o,r)); }
  for(let i=0;i<nT;i++){ const a=(i+.5)/nT*Math.PI*2+.2, d=R0+7; b.en(Math.sin(a)*d,0,Math.cos(a)*d,a+Math.PI,1,o=>DECO.bandera(o,r)); }
  const fuera = T.def.fuera==='ciudad' ? ['edificio','edificio','casa','lapacho','palmera','arbol'] : ['casa','vaca','vaca','palmera','arbol','lapachoA','molino'];
  for(let i=0;i<(baja?40:90);i++){ const a=r()*Math.PI*2, d=R0+26+r()*110, t=fuera[Math.floor(r()*fuera.length)]; b.en(Math.sin(a)*d,0,Math.cos(a)*d,r()*6.28,.9+r()*.4,o=>DECO[t](o,r)); }
  // rampas (misma forma que usa el juego)
  for(const p of T.rampas){ const ang=Math.atan2(ALTO_RAMPA, RAMPA), L=Math.hypot(ALTO_RAMPA, RAMPA), w=8.4, gr=.35;
    b.en(p.x,0,p.z,p.h,1,o=>{ const cy=ALTO_RAMPA/2-gr/2*Math.cos(ang);
      o.caja(0,cy-gr/2,-RAMPA/2+gr/2*Math.sin(ang),w,gr,L,'#f2c14e',0,-ang);
      for(let x=-w/2+1.2;x<w/2-.6;x+=2.4) o.caja(x,cy-gr/2+.02,-RAMPA/2+gr/2*Math.sin(ang),1.1,gr,L*.92,'#d52b1e',0,-ang);
      o.caja(0,0,-.12,w,ALTO_RAMPA,.24,'#c8902a');
      for(const x of [-w/2,w/2]) for(let q=0;q<4;q++){ const h=ALTO_RAMPA*(1-(q+.5)/4); o.caja(x,0,-RAMPA*(q+.5)/4,.2,h,RAMPA/4,'#b07a22'); } }); }
  // nubes y cerros lejanos
  for(let i=0;i<(baja?8:14);i++){ const a=r()*Math.PI*2, d=160+r()*260, x=Math.sin(a)*d, z=Math.cos(a)*d, y=90+r()*50, e=10+r()*12;
    b.esf(x,y,z,e,'#ffffff',.38,7,1.6); b.esf(x+e*1.2,y-1,z+3,e*.7,'#ffffff',.4,7,1.5); }
  for(let i=0;i<(tema.nCerros||0);i++){ const a=i/tema.nCerros*6.283+r()*.3, d=330+r()*90, h=40+r()*70; b.cil(Math.sin(a)*d,-4,Math.cos(a)*d,10+r()*20,90+r()*60,h,tono(tema.cerros,r,.08),7); }
  const deco=b.malla(reg(new THREE.MeshLambertMaterial({vertexColors:true}))); reg(deco.geometry); G.add(deco);
  // cajas de objetos
  const texCaja=reg(texLienzo(64,64,(g)=>{ const gr=g.createLinearGradient(0,0,64,64); gr.addColorStop(0,'#ffe37a'); gr.addColorStop(.5,'#ff8a3d'); gr.addColorStop(1,'#d52b1e'); g.fillStyle=gr; g.fillRect(0,0,64,64);
    g.strokeStyle='#fff'; g.lineWidth=4; g.strokeRect(3,3,58,58); g.fillStyle='#fff'; g.font='900 46px system-ui,sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('?',32,35); }));
  const gCaja=reg(new THREE.BoxGeometry(1.7,1.7,1.7)), mCaja=reg(new THREE.MeshLambertMaterial({map:texCaja, transparent:true, opacity:.93, emissive:'#553300'}));
  const cajas=T.cajas.map((c,i)=>{ const m=new THREE.Mesh(gCaja, mCaja); m.position.set(c.x,1.5,c.z); G.add(m); return {m, x:c.x, y:1.5, z:c.z, i}; });
  // flechas turbo
  const texTurbo=reg(texLienzo(64,64,(g)=>{ g.fillStyle='#ff7a1e'; g.fillRect(0,0,64,64); g.fillStyle='#fff3a0'; for(const y of [6,34]){ g.beginPath(); g.moveTo(8,y+22); g.lineTo(32,y); g.lineTo(56,y+22); g.lineTo(56,y+26); g.lineTo(32,y+12); g.lineTo(8,y+26); g.fill(); } }, true));
  const mTurbo=reg(new THREE.MeshBasicMaterial(Object.assign({map:texTurbo}, off, {polygonOffsetFactor:-6, polygonOffsetUnits:-60})));
  for(const t of T.turbos){ const m=new THREE.Mesh(reg(new THREE.PlaneGeometry(5.5,7)), mTurbo); m.rotation.order='YXZ'; m.rotation.y=t.h+Math.PI; m.rotation.x=-Math.PI/2; m.position.set(t.x,.08,t.z); G.add(m); }
  G.userData.cajas=cajas; G.userData.texTurbo=texTurbo;
  G.userData.tirar=()=>{ for(const o of tirar) try{ o.dispose(); }catch(e){} };
  return G;
}
function armarMundo(T, calidad){
  if(T.arena) return armarArena3D(T, calidad);
  const tema=T.tema, S=T.S, N=T.N, baja=calidad==='baja', r=azar(T.L*7|0);
  const G=new THREE.Group(), tirar=[];
  const reg = o => { tirar.push(o); return o; };
  /* ---- piso ---- */
  const M=260, cel=baja?10:7, x0=T.caja.x0-M, z0=T.caja.z0-M, nx=Math.ceil((T.caja.x1-T.caja.x0+2*M)/cel), nz=Math.ceil((T.caja.z1-T.caja.z0+2*M)/cel);
  const pos=new Float32Array((nx+1)*(nz+1)*3), col=new Float32Array((nx+1)*(nz+1)*3);
  const c1=new THREE.Color(tema.suelo), c2=new THREE.Color(tema.suelo2), cAr=new THREE.Color('#e4d3a0'), cFo=new THREE.Color(tema.agua).multiplyScalar(.55), cc=new THREE.Color();
  for(let j=0, k=0; j<=nz; j++) for(let i=0; i<=nx; i++, k+=3){
    const x=x0+i*cel, z=z0+j*cel, t=terreno(T, x, z);
    const bordeMapa=Math.min(i, nx-i, j, nz-j)/6;
    pos[k]=x; pos[k+1]=t.y*(bordeMapa<1?bordeMapa:1) - (t.borde<3 ? .22 : 0); pos[k+2]=z;
    const ru=(Math.sin(x*.13)*Math.cos(z*.11)+Math.sin(x*.05+z*.07))*.25+.5;
    cc.copy(c1).lerp(c2, tema.arena ? suave((t.borde-8)/50) : ru);
    if(t.agua>0.02){ const orilla=(tema.nivelOr||T.nivelAgua)+.5; cc.lerp(cAr, suave((orilla+1.2-pos[k+1])/1.4)); if(pos[k+1]<T.nivelAgua-.6) cc.lerp(cFo, suave((T.nivelAgua-.6-pos[k+1])/2)); }
    else if(tema.arena){ const f=enAgua(T, x+40, z+40)+enAgua(T, x-10, z+40); if(f>0) cc.lerp(cAr, Math.min(1,f)); }
    const v=.94+r()*.1; col[k]=cc.r*v; col[k+1]=cc.g*v; col[k+2]=cc.b*v;
  }
  const idx=[]; for(let j=0;j<nz;j++) for(let i=0;i<nx;i++){ const a=j*(nx+1)+i, b=a+1, c=a+nx+1, d=c+1; idx.push(a,c,b, b,c,d); }
  const gp=reg(new THREE.BufferGeometry()); gp.setAttribute('position', new THREE.BufferAttribute(pos,3)); gp.setAttribute('color', new THREE.BufferAttribute(col,3)); gp.setIndex(idx); gp.computeVertexNormals();
  G.add(new THREE.Mesh(gp, reg(new THREE.MeshLambertMaterial({vertexColors:true}))));
  const lejos=new THREE.Mesh(reg(new THREE.PlaneGeometry(6000,6000)), reg(new THREE.MeshLambertMaterial({color:tema.suelo2}))); lejos.rotation.x=-Math.PI/2; lejos.position.set(T.caja.cx, -1.2+Math.min(0,T.nivelAgua), T.caja.cz); G.add(lejos);
  /* ---- agua ---- */
  if(T.agua.length){
    const ag=new THREE.Mesh(reg(new THREE.PlaneGeometry(nx*cel-40, nz*cel-40)), reg(new THREE.MeshLambertMaterial({color:tema.agua, transparent:true, opacity:.86})));
    ag.rotation.x=-Math.PI/2; ag.position.set(x0+nx*cel/2, T.nivelAgua, z0+nz*cel/2); G.add(ag); G.userData.agua=ag;
  }
  /* ---- camino ---- */
  const tierra=!!tema.tierra;
  const texCamino=reg(texLienzo(128, 128, (g,w,h)=>{
    g.fillStyle=tierra?'#fff':'#fff'; g.fillRect(0,0,w,h);
    for(let i=0;i<900;i++){ const v=200+Math.random()*55|0; g.fillStyle=`rgba(${v},${v},${v},.5)`; g.fillRect(Math.random()*w, Math.random()*h, 2, 2); }
    if(tierra){ g.fillStyle='rgba(120,90,60,.35)'; g.fillRect(w*.22,0,w*.1,h); g.fillRect(w*.68,0,w*.1,h); }
    else { g.fillStyle='#ffffff'; g.fillRect(3,0,4,h); g.fillRect(w-7,0,4,h); g.fillStyle='#ffe37a'; g.fillRect(w/2-2,0,4,h*.55); }
  }, true));
  const vp=[], vu=[], vi=[], bp=[], bc=[];
  const cA=new THREE.Color(tierra?'#e8dcc0':'#d52b1e'), cB=new THREE.Color(tierra?'#8a6a45':'#ffffff');
  for(let j=0;j<=N;j++){
    const s=S[j%N], y=s.y+.12;
    vp.push(s.x+s.nx*s.w, y, s.z+s.nz*s.w, s.x-s.nx*s.w, y, s.z-s.nz*s.w); vu.push(0, j*.5, 1, j*.5);
    if(j<N){ const a=j*2; vi.push(a,a+1,a+2, a+1,a+3,a+2);
      const o=S[(j+1)%N], c=(j>>1)%2?cA:cB, an=1.3;
      for(const l of [1,-1]){ // cordón
        const p=[s.x+s.nx*s.w*l, s.z+s.nz*s.w*l, s.x+s.nx*(s.w+an)*l, s.z+s.nz*(s.w+an)*l, o.x+o.nx*o.w*l, o.z+o.nz*o.w*l, o.x+o.nx*(o.w+an)*l, o.z+o.nz*(o.w+an)*l], ya=s.y+.13, yb=o.y+.13;
        const tri = l>0 ? [0,2,1, 1,2,3] : [0,1,2, 1,3,2], ys=[ya,ya-.05,yb,yb-.05];
        for(const q of tri){ bp.push(p[q*2], ys[q], p[q*2+1]); bc.push(c.r,c.g,c.b); }
      } }
  }
  const gc=reg(new THREE.BufferGeometry()); gc.setAttribute('position', new THREE.Float32BufferAttribute(vp,3)); gc.setAttribute('uv', new THREE.Float32BufferAttribute(vu,2)); gc.setIndex(vi); gc.computeVertexNormals();
  const off={polygonOffset:true, polygonOffsetFactor:-3, polygonOffsetUnits:-30};
  G.add(new THREE.Mesh(gc, reg(new THREE.MeshLambertMaterial(Object.assign({map:texCamino, color:tema.camino}, off)))));
  const gb=reg(new THREE.BufferGeometry()); gb.setAttribute('position', new THREE.Float32BufferAttribute(bp,3)); gb.setAttribute('color', new THREE.Float32BufferAttribute(bc,3)); gb.computeVertexNormals();
  G.add(new THREE.Mesh(gb, reg(new THREE.MeshLambertMaterial(Object.assign({vertexColors:true}, off)))));
  /* ---- atajos (camino de tierra) ---- */
  for(const a of T.atajos){
    const p=[], ii=[]; a.pts.forEach((q,k)=>{ p.push(q.x+a.tz*a.hw, q.y+.1, q.z-a.tx*a.hw, q.x-a.tz*a.hw, q.y+.1, q.z+a.tx*a.hw); if(k){ const b=(k-1)*2; ii.push(b,b+1,b+2, b+1,b+3,b+2); } });
    const g=reg(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.Float32BufferAttribute(p,3)); g.setIndex(ii); g.computeVertexNormals();
    G.add(new THREE.Mesh(g, reg(new THREE.MeshLambertMaterial(Object.assign({color:tierra?'#d8b98a':'#b08a5a'}, off)))));
  }
  /* ---- línea de largada ---- */
  { const s=S[0], tx=reg(texLienzo(64,16,(g)=>{ for(let i=0;i<8;i++) for(let j=0;j<2;j++){ g.fillStyle=(i+j)%2?'#111':'#fff'; g.fillRect(i*8,j*8,8,8); } }));
    const m=new THREE.Mesh(reg(new THREE.PlaneGeometry(s.w*2, 2.4)), reg(new THREE.MeshBasicMaterial(Object.assign({map:tx}, off, {polygonOffsetFactor:-6, polygonOffsetUnits:-60}))));
    m.rotation.set(-Math.PI/2, 0, -s.h, 'YXZ'); m.rotation.order='YXZ'; m.rotation.y=s.h; m.rotation.x=-Math.PI/2; m.rotation.z=0; m.position.set(s.x, s.y+.16, s.z); G.add(m); }

  /* ---- decorados (una sola malla) ---- */
  const b=new Obra(); b.rnd=r;
  const poner = (tipo, x, z, rot, esc, w, forzar) => {
    const f=DECO[tipo]; if(!f) return false;
    const t=terreno(T, x, z), rad=(RADIO[tipo]||2.5)*esc;
    if(!forzar && !LIBRE[tipo]){ if(t.borde<rad+1.5) return false; if(FLOTA[tipo] ? t.agua<.9 : t.agua>.05) return false; }
    b.w=w||8; b.en(x, FLOTA[tipo] ? T.nivelAgua-.25 : (tipo==='muelle' ? T.nivelAgua+.2 : t.y), z, rot, esc, o=>f(o, r));
    return true;
  };
  const alCostado = (s, l, d) => ({x:s.x+s.nx*l*(s.w+d), z:s.z+s.nz*l*(s.w+d), rot:Math.atan2(-s.nx*l, -s.nz*l)});
  for(const d of T.def.deco){
    if(d.k==='A') poner(d.t, d.x, d.z, d.rot, d.s, 8, true);
    else if(d.k==='U'){
      const s=S[T.idxCp(d.cp)];
      if(!d.l){ poner(d.t, s.x, s.z, s.h+d.rot, d.s, s.w, true); continue; }
      for(let k=0;k<12;k++){ const p=alCostado(s, d.l, d.d+(RADIO[d.t]||0)*d.s*.5+k*5); if(poner(d.t, p.x, p.z, p.rot+d.rot, d.s, s.w)) break; }
    } else if(d.k==='F'){
      const i0=T.idxCp(d.a), i1=T.idxCp(d.b), len=((i1-i0)%N+N)%N, cada=Math.max(1, Math.round(d.cada*(baja?1.7:1)/T.paso));
      for(let k=0;k<=len;k+=cada){ const s=S[(i0+k)%N]; if(s.puente) continue;
        for(const l of (d.l?[d.l]:[1,-1])){ const p=alCostado(s, l, d.d+(RADIO[d.t]||0)*d.s*.5+(r()-.5)*.8); poner(d.t, p.x, p.z, p.rot, d.s*(.9+r()*.2), s.w); } }
    } else if(d.k==='R'){
      const n=Math.round(d.n*(baja?.4:1));
      for(let k=0, m=0; k<n && m<n*30; m++){
        const x=T.caja.x0-d.max+r()*(T.caja.x1-T.caja.x0+2*d.max), z=T.caja.z0-d.max+r()*(T.caja.z1-T.caja.z0+2*d.max), t=terreno(T,x,z);
        if(t.borde<d.min || t.borde>d.max) continue;
        const tipo=d.t[Math.floor(r()*d.t.length)];
        if(poner(tipo, x, z, r()*6.283, .85+r()*.5)) k++;
      }
    }
  }
  /* arco de largada */
  { const s=S[0], w=s.w+2; b.en(s.x, s.y, s.z, s.h, 1, o=>{ for(const x of [-w,w]){ o.cil(x,0,0,.45,.55,8,'#d52b1e',8); o.cil(x,3,0,.47,.47,2.4,'#ffffff',8); o.cil(x,5.4,0,.46,.46,2.6,'#0038a8',8); }
      for(let i=0;i<Math.round(w*2/1.2);i++) for(let j=0;j<2;j++) o.caja(-w+.6+i*1.2, 7.4+j*1.1, 0, 1.2, 1.1, .5, (i+j)%2?'#111111':'#ffffff'); o.caja(0,9.6,0,w*2+1.4,.5,.9,'#f2c14e'); }); }
  /* rampas de salto */
  // la misma forma que usa la carrera: sube RAMPA metros hasta ALTO_RAMPA justo en la muestra del salto
  for(const i of T.saltos){ const s=S[i], k=RAMPA/T.paso, a=S[((i-Math.ceil(k))%N+N)%N], c=S[((i-Math.floor(k))%N+N)%N], fr=k-Math.floor(k), y0=c.y+(a.y-c.y)*fr;
    const sube=s.y+ALTO_RAMPA-y0, ang=Math.atan2(sube, RAMPA), L=Math.hypot(sube, RAMPA), w=s.w*2-.4, gr=.35;
    b.en(s.x, s.y, s.z, s.h, 1, o=>{
      // la tabla inclinada (su cara de arriba va del piso al borde)
      const cy=(y0-s.y+ALTO_RAMPA)/2-gr/2*Math.cos(ang);
      o.caja(0,cy-gr/2,-RAMPA/2+gr/2*Math.sin(ang),w,gr,L,'#f2c14e',0,-ang);
      for(let x=-w/2+1.2;x<w/2-.6;x+=2.4) o.caja(x,cy-gr/2+.02,-RAMPA/2+gr/2*Math.sin(ang),1.1,gr,L*.92,'#d52b1e',0,-ang);
      // frente del borde y costados
      o.caja(0,-.3,-.12,w,ALTO_RAMPA+.3,.24,'#c8902a');
      for(const x of [-w/2,w/2]) for(let q=0;q<4;q++){ const z=-RAMPA*(q+.5)/4, h=ALTO_RAMPA*(1-(q+.5)/4)+(y0-s.y)*((q+.5)/4); if(h>.05) o.caja(x,-.3,z,.2,h+.3,RAMPA/4,'#b07a22'); }
    }); }
  /* puentes */
  for(const p of T.puentes){
    for(let k=0;k<=p.len;k++){ const s=S[(p.i0+k)%N], o=S[(p.i0+k+1)%N];
      for(const l of [1,-1]){ const x=s.x+s.nx*l*(s.w+.9), z=s.z+s.nz*l*(s.w+.9);
        b.en(x, s.y, z, s.h, 1, q=>{ q.caja(0,-1.2,0,1,1.3,T.paso+.3, p.estilo==='madera'?'#6a4526':'#c8ccd4'); q.caja(0,.1,0,.3,1,T.paso+.3, p.estilo==='madera'?'#8a5a34':(p.estilo==='arco'?'#e8ecf2':'#b0b6c0')); q.caja(0,1.1,0,.5,.22,T.paso+.3, p.estilo==='madera'?'#5a3a22':'#f2c14e'); }); }
      b.en(s.x, s.y, s.z, s.h, 1, q=>{ q.caja(0,-1.4,0,s.w*2+1.6,1.3,T.paso+.3, p.estilo==='madera'?'#7a5230':'#9aa0aa'); });
      if(p.estilo==='represa') b.en(s.x, s.y, s.z, s.h, 1, q=>{ q.caja(-s.w-7,-16,0,12,16,T.paso+.4,'#b8bcc4'); q.caja(-s.w-17,-17,0,12,10,T.paso+.4,'#a8acb4',0,0,-.5); if(k%6<3) q.caja(-s.w-16.5,-16.6,0,12,10,T.paso*.8,'#eef8ff',0,0,-.5); q.caja(s.w+3,-16,0,5,16,T.paso+.4,'#c0c4cc'); if(k%14===7){ q.caja(-s.w-3,0,0,3,6,3,'#d8dde6'); q.caja(-s.w-3,6,0,4,.5,4,'#3b7be2'); } });
      else if(k%7===3) b.en(s.x, s.y, s.z, s.h, 1, q=>{ for(const x of [-s.w+.5, s.w-.5]) q.caja(x,-22,0,2,20.8,2.4, p.estilo==='madera'?'#5a3a22':'#b0b6c0'); });
      if(p.estilo==='arco'){ const t=k/p.len, h=4+Math.sin(t*Math.PI)*17, t2=(k+1)/p.len, h2=4+Math.sin(Math.min(1,t2)*Math.PI)*17, ang=Math.atan2(h2-h, T.paso);
        for(const l of [1,-1]) b.en(s.x+s.nx*l*(s.w+1.6), s.y, s.z+s.nz*l*(s.w+1.6), s.h, 1, q=>{ q.caja(0,h,0,1.3,1.5,T.paso+1.2,'#e8ecf2',0,-ang); if(k%2===0) q.caja(0,0,0,.25,h,.25,'#d8dde6'); });
        if(k%5===2) b.en(s.x, s.y, s.z, s.h, 1, q=>q.caja(0,h+.2,0,s.w*2+3.4,.8,.8,'#e8ecf2')); }
    }
  }
  /* nubes y cerros lejanos */
  for(let i=0;i<(baja?8:16);i++){ const a=r()*6.283, d=120+r()*330, x=T.caja.cx+Math.sin(a)*d, z=T.caja.cz+Math.cos(a)*d, y=95+r()*60, e=10+r()*12, cn=tema.tarde?'#ffc59a':'#ffffff';
    b.esf(x,y,z,e,cn,.38,7,1.6); b.esf(x+e*1.2,y-1,z+3,e*.7,cn,.4,7,1.5); b.esf(x-e*1.1,y-2,z-2,e*.75,cn,.4,7,1.5); }
  for(let i=0;i<(tema.nCerros||0);i++){ const a=i/tema.nCerros*6.283+r()*.3, d=350+r()*120, h=40+r()*80;
    b.cil(T.caja.cx+Math.sin(a)*d, -4, T.caja.cz+Math.cos(a)*d, 10+r()*20, 90+r()*70, h, tono(tema.cerros, r, .08), 7); }
  const deco=b.malla(reg(new THREE.MeshLambertMaterial({vertexColors:true}))); reg(deco.geometry); G.add(deco);

  /* ---- cajas de objetos y flechas turbo ---- */
  const texCaja=reg(texLienzo(64,64,(g)=>{ const gr=g.createLinearGradient(0,0,64,64); gr.addColorStop(0,'#ffe37a'); gr.addColorStop(.5,'#ff8a3d'); gr.addColorStop(1,'#d52b1e'); g.fillStyle=gr; g.fillRect(0,0,64,64);
    g.strokeStyle='#fff'; g.lineWidth=4; g.strokeRect(3,3,58,58); g.fillStyle='#fff'; g.font='900 46px system-ui,sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('?',32,35); }));
  const gCaja=reg(new THREE.BoxGeometry(1.7,1.7,1.7)), mCaja=reg(new THREE.MeshLambertMaterial({map:texCaja, transparent:true, opacity:.93, emissive:'#553300'}));
  const cajas=[];
  T.cajas.forEach((i,f)=>{ const s=S[i]; [-.62,-.21,.21,.62].forEach((q,c)=>{ const m=new THREE.Mesh(gCaja, mCaja); const x=s.x+s.nx*s.w*q, z=s.z+s.nz*s.w*q; m.position.set(x, s.y+1.5, z); G.add(m); cajas.push({m, x, y:s.y+1.5, z, i, lat:s.w*q}); }); });
  const texTurbo=reg(texLienzo(64,64,(g)=>{ g.fillStyle='#ff7a1e'; g.fillRect(0,0,64,64); g.fillStyle='#fff3a0'; for(const y of [6,34]){ g.beginPath(); g.moveTo(8,y+22); g.lineTo(32,y); g.lineTo(56,y+22); g.lineTo(56,y+12+22-8); g.lineTo(32,y+12); g.lineTo(8,y+26); g.fill(); } }, true));
  const mTurbo=reg(new THREE.MeshBasicMaterial(Object.assign({map:texTurbo}, off, {polygonOffsetFactor:-6, polygonOffsetUnits:-60})));
  for(const t of T.turbos){ const s=S[t.i], m=new THREE.Mesh(reg(new THREE.PlaneGeometry(5.5, 7)), mTurbo); m.rotation.order='YXZ'; m.rotation.y=s.h+Math.PI; m.rotation.x=-Math.PI/2+Math.atan(s.pend)*-1; m.position.set(s.x+s.nx*t.lat, s.y+.17, s.z+s.nz*t.lat); G.add(m); }
  G.userData.cajas=cajas; G.userData.texTurbo=texTurbo;
  G.userData.tirar=()=>{ for(const o of tirar) try{ o.dispose(); }catch(e){} };
  return G;
}
