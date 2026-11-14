'use strict';
/* =====================================================================
   Batalla Naval PY — el mar en 3D (three.js r128).
   La escena se arma una sola vez y después solo se actualiza lo que
   cambió (barcos, marcas): nunca se reconstruye entera en cada tiro.
   ===================================================================== */
const VIEW={mode: load('naval_view')==='3d' ? '3d' : '2d'};
const R3={ok:false, dirty:true};
const CAM3=Object.assign({pitch:48, zoom:1, yaw:0}, load('naval_cam3')||{});
function saveCam3(){ store('naval_cam3', {pitch:CAM3.pitch, zoom:CAM3.zoom, yaw:CAM3.yaw}); }
const CELL=10;      // tamaño de una casilla en el 3D
const RADAR_Y=4.6;  // altura de la pantalla de radar sobre el agua
const SUN_DIR=[-.3,.55,-.78];
// olas: las mismas en la placa de video y acá (para que los barcos suban y bajen con el agua)
const WAVES=[[.96,.28,.045,1.0,1.1],[-.37,.93,.06,.7,1.4],[.71,-.71,.11,.3,2.0],[.22,.97,.18,.14,2.6]];
function waveH(x, z, t){
  let h=0; for(const [dx,dz,k,a,s] of WAVES) h+=a*Math.sin(k*(dx*x+dz*z)+s*t);
  const R=R3.calmR||100, u=Math.max(0, Math.min(1, (Math.hypot(x,z)-R*.55)/(R*.9)));
  return h*(.45+.55*u*u*(3-2*u));
}
const WATER_VS=`
#include <common>
#include <shadowmap_pars_vertex>
uniform float uT, uCalm;
varying vec3 vW; varying vec3 vN; varying float vH;
void wv(vec2 p, vec2 d, float k, float a, float s, inout float h, inout vec2 g){ float ph=k*dot(d,p)+s*uT; h+=a*sin(ph); g+=a*k*d*cos(ph); }
void main(){
  vec4 w=modelMatrix*vec4(position,1.0); vec2 p=w.xz; float h=0.0; vec2 g=vec2(0.0);
  wv(p,vec2(.96,.28),.045,1.0,1.1,h,g); wv(p,vec2(-.37,.93),.06,.7,1.4,h,g); wv(p,vec2(.71,-.71),.11,.3,2.0,h,g); wv(p,vec2(.22,.97),.18,.14,2.6,h,g);
  float c=.45+.55*smoothstep(uCalm*.55, uCalm*1.45, length(p)); h*=c; g*=c;
  w.y+=h; vW=w.xyz; vH=h; vN=normalize(vec3(-g.x,1.0,-g.y));
  gl_Position=projectionMatrix*viewMatrix*w;
  vec3 transformedNormal=normalMatrix*vec3(0.0,1.0,0.0);
  vec4 worldPosition=w;
  #include <shadowmap_vertex>
}`;
const WATER_FS=`
uniform float uT, uGrid, uN, uCell, uFogN, uFogF;
uniform vec3 uSun, uDeep, uShallow, uHor, uZen, uFog;
varying vec3 vW; varying vec3 vN; varying float vH;
#include <common>
#include <packing>
#include <bsdfs>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main(){
  vec2 p=vW.xz; vec3 n=vN;
  // ondas chiquitas que brillan
  n.x+=.09*sin(p.x*.9+uT*3.1)*cos(p.y*.7-uT*2.3)+.05*sin(p.y*1.7+p.x*.4+uT*4.0)+.03*sin(p.x*3.1+p.y*2.3-uT*6.0);
  n.z+=.09*cos(p.y*.85-uT*2.7)*sin(p.x*.6+uT*1.9)+.05*sin(p.x*1.9-p.y*.5-uT*3.6)+.03*cos(p.y*3.3-p.x*2.1+uT*5.5);
  n=normalize(n);
  float shd=1.0;
  #ifdef USE_SHADOWMAP
    shd=getShadowMask();
  #endif
  vec3 Vd=normalize(cameraPosition-vW);
  float fr=.04+.96*pow(1.0-max(dot(n,Vd),0.0),4.0);
  vec3 Rf=reflect(-Vd,n);
  vec3 sky=mix(uHor,uZen,clamp(Rf.y*1.6,0.0,1.0));
  vec3 base=mix(uDeep,uShallow,clamp(vH*.3+.45,0.0,1.0));
  // el sol atraviesa la cresta de la ola
  base+=uShallow*.3*pow(max(dot(n,normalize(vec3(Vd.x,0.0,Vd.z)+uSun)),0.0),3.0);
  // manchas de luz que se mueven bajo el agua
  float ca=sin(p.x*.21+uT*.7+sin(p.y*.17-uT*.5)*2.0)*sin(p.y*.19-uT*.6+sin(p.x*.15+uT*.4)*2.0);
  base+=uShallow*.16*smoothstep(.35,1.0,ca);
  base*=mix(.52,1.0,shd);
  vec3 col=mix(base,sky,clamp(fr,0.0,1.0)*.85);
  float sd=max(dot(Rf,uSun),0.0);
  col+=vec3(1.0,.93,.78)*(pow(sd,180.0)*2.4+pow(sd,22.0)*.2)*shd;
  // espuma en la cresta de las olas
  float fo=smoothstep(1.15,2.1,vH)*(.55+.45*sin(p.x*1.3+p.y*1.1+uT*2.0)*sin(p.y*1.7-p.x*.9-uT*1.4));
  col=mix(col,vec3(.93,.97,1.0),clamp(fo,0.0,1.0)*.6);
  // la grilla pintada sobre el agua (cuando se mira una flota)
  if(uGrid>.5){
    float hf=uN*uCell*.5; vec2 q=(p+hf)/uCell;
    if(q.x>=0.0&&q.y>=0.0&&q.x<=uN&&q.y<=uN){
      vec2 fw=fwidth(q); vec2 gl=1.0-smoothstep(vec2(0.0),fw*1.6,min(fract(q),1.0-fract(q)));
      col=mix(col,vec3(.88,.96,1.0),max(gl.x,gl.y)*.42);
      col=mix(col,uShallow*1.2,.1);
    }
  }
  float d=length(cameraPosition-vW); col=mix(col,uFog,smoothstep(uFogN,uFogF,d));
  gl_FragColor=vec4(col,1.0);
}`;
const RADAR_VS=`varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`;
const RADAR_FS=`
uniform float uT, uN, uCell, uAimOn; uniform vec2 uAim; uniform sampler2D uMarks;
varying vec3 vW;
const float TAU=6.28318;
void main(){
  vec2 p=vW.xz; float hf=uN*uCell*.5; vec2 q=(p+hf)/uCell;
  float inB=step(0.0,q.x)*step(q.x,uN)*step(0.0,q.y)*step(q.y,uN);
  vec3 G=vec3(.25,1.0,.5); vec3 col=vec3(0.0,.16,.07); float a=.22*inB;
  // borde de la pantalla
  float e=min(min(q.x,uN-q.x),min(q.y,uN-q.y));
  if(inB<.5){ col=vec3(.02,.07,.05); a=.62; float rim=1.0-smoothstep(0.0,.18,abs(e)); col+=G*rim*.9; a+=rim*.3; gl_FragColor=vec4(col,a); return; }
  col+=G*(1.0-smoothstep(0.0,.12,e))*.8; a+=(1.0-smoothstep(0.0,.12,e))*.4;
  // cuadrícula
  vec2 fw=fwidth(q); vec2 gl=1.0-smoothstep(vec2(0.0),fw*1.5,min(fract(q),1.0-fract(q))); float line=max(gl.x,gl.y);
  col+=G*line*.45; a+=line*.35;
  // círculos del radar
  float rv=length(p)/(hf*.5); float rl=1.0-smoothstep(0.0,fwidth(rv)*1.4,abs(fract(rv+.5)-.5));
  col+=G*rl*.35; a+=rl*.22;
  // barrido que gira
  float sw=mod(uT*1.5,TAU); float ang=atan(p.y,p.x); float da=mod(sw-ang,TAU);
  float trail=exp(-da*2.4)*smoothstep(hf*1.5,hf*.2,length(p)); float beam=1.0-smoothstep(0.0,.035,da);
  col+=G*(trail*.5+beam*.9); a+=trail*.28+beam*.45;
  // marcas: el barrido las hace brillar al pasar
  vec2 ci=floor(q); vec2 fc=fract(q)-.5; float dd=length(fc);
  float v=floor(texture2D(uMarks,(ci+.5)/uN).r*255.0+.5);
  vec2 cc=(ci+.5)*uCell-hf; float lit=.45+.55*exp(-mod(sw-atan(cc.y,cc.x),TAU)*1.3);
  if(v==1.0||v==4.0){ float k=v==1.0?1.0:.45; float dot=1.0-smoothstep(.1,.16,dd); float rg=(1.0-smoothstep(0.0,.035,abs(dd-.27)))*.5;
    col+=vec3(.6,1.0,.95)*(dot+rg)*lit*k; a+=(dot*.55+rg*.3)*lit*k; }
  else if(v==2.0){ float pu=.5+.5*sin(uT*6.0+ci.x+ci.y); float dot=1.0-smoothstep(.22,.29,dd); float ring=(1.0-smoothstep(0.0,.04,abs(dd-(.3+pu*.12))))*.8;
    col=mix(col,vec3(1.0,.2,.15),clamp(dot*lit+ring*.6,0.0,1.0)); a+=dot*.6+ring*.3; }
  else if(v==3.0){ float x=1.0-smoothstep(.04,.09,min(abs(fc.x-fc.y),abs(fc.x+fc.y))); x*=step(max(abs(fc.x),abs(fc.y)),.36);
    col=mix(col,vec3(.55,.05,.04),.5); col=mix(col,vec3(1.0,.35,.2),x*lit); a+=.18+x*.4; }
  // la mira
  if(uAimOn>.5){
    float pu=.5+.5*sin(uT*8.0);
    if(ci.y==uAim.x||ci.x==uAim.y){ col+=vec3(1.0,.85,.3)*.12; a+=.06; }
    if(ci.y==uAim.x&&ci.x==uAim.y){ float bx=1.0-smoothstep(.0,.06,.5-max(abs(fc.x),abs(fc.y))); col=mix(col,vec3(1.0,.9,.35),bx*.95+.18+pu*.12); a+=bx*.5+.2; }
  }
  // líneas de barrido de la pantalla
  a*=.9+.1*sin(vW.z*2.6-uT*14.0);
  gl_FragColor=vec4(col,clamp(a,0.0,.92));
}`;
// partículas (fuego, humo, agua): un solo dibujo por tipo de mezcla
const PART_VS=`attribute float aSize; attribute vec4 aCol; uniform float uPx; varying vec4 vC;
void main(){ vC=aCol; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=aSize*uPx/max(1.0,-mv.z); gl_Position=projectionMatrix*mv; }`;
const PART_FS=`varying vec4 vC; void main(){ float d=length(gl_PointCoord-.5)*2.0; float a=smoothstep(1.0,.15,d); if(a<.01) discard; gl_FragColor=vec4(vC.rgb,vC.a*a); }`;

/* ---------- calidad ---------- */
function setQ3(q, auto){
  R3.q=q; if(!auto) store('naval_q', q);
  const r=R3.renderer, lo=q==='baja';
  r.setPixelRatio(lo ? 1 : Math.min(window.devicePixelRatio||1, R3.mobile?1.5:2));
  r.shadowMap.enabled=!lo; R3.sun.castShadow=!lo;
  R3.water.geometry = lo ? R3.geoLo : R3.geoHi;
  R3.scene.traverse(o=>{ if(o.material) o.material.needsUpdate=true; });
  Object.values(M3).forEach(m=>m.needsUpdate=true); Object.values(BURNT).forEach(m=>m.needsUpdate=true);
  const b=$('#btnQ3'); if(b){ b.textContent = lo ? '🔅' : '✨'; b.title = lo ? 'Calidad baja (tocá para subirla)' : 'Calidad alta (tocá para bajarla si va lento)'; }
  resizeStage();
}

function init3D(){
  if(R3.ok) return true; if(!window.THREE) return false;
  const T=THREE, canvas=$('#c3d');
  const mobile=/Android|iPhone|iPad/i.test(navigator.userAgent);
  let renderer; try{ renderer=new T.WebGLRenderer({canvas, antialias:!mobile, powerPreference:'high-performance'}); }catch(e){ toast('Este aparato no puede mostrar 3D. Seguimos en 2D.'); return false; }
  renderer.shadowMap.type=T.PCFSoftShadowMap;
  const scene=new T.Scene();
  const FOGC=0xbfdcef;
  scene.fog=new T.Fog(FOGC, 420, 1150);
  scene.background=new T.Color(FOGC);
  const cam=new T.PerspectiveCamera(45, 1, 1, 4000);
  Object.assign(R3, {T, renderer, scene, cam, ok:true, mobile, cc:{yaw:CAM3.yaw, pitch:CAM3.pitch, zoom:CAM3.zoom}, shake:0});
  // cielo: degradé, sol y nubes pintados en una cúpula
  const sunV=new T.Vector3(...SUN_DIR).normalize();
  const sc=document.createElement('canvas'); sc.width=1024; sc.height=512; const sg=sc.getContext('2d'), gr=sg.createLinearGradient(0,0,0,256);
  gr.addColorStop(0,'#2f6fb8'); gr.addColorStop(.55,'#6faede'); gr.addColorStop(.86,'#b5d8f0'); gr.addColorStop(1,'#d9edf8'); sg.fillStyle=gr; sg.fillRect(0,0,1024,256);
  sg.fillStyle='#bfdcef'; sg.fillRect(0,256,1024,256);
  const su=((Math.atan2(sunV.z, -sunV.x)/(Math.PI*2))%1+1)%1*1024, sv=Math.acos(sunV.y)/Math.PI*512;
  for(const [r,a] of [[190,.22],[90,.35],[34,.85]]){ const g2=sg.createRadialGradient(su,sv,0,su,sv,r); g2.addColorStop(0,`rgba(255,246,214,${a})`); g2.addColorStop(1,'rgba(255,246,214,0)'); sg.fillStyle=g2; sg.fillRect(su-r,sv-r,r*2,r*2); }
  sg.fillStyle='#fffdf2'; sg.beginPath(); sg.arc(su,sv,13,0,7); sg.fill();
  for(let k=0;k<26;k++){ const cx=Math.random()*1024, cy=150+Math.random()*85, w=40+Math.random()*70;
    for(let j=0;j<7;j++){ const x=cx+(Math.random()-.5)*w*1.6, y=cy+(Math.random()-.5)*10, r=10+Math.random()*w*.3; const g2=sg.createRadialGradient(x,y,0,x,y,r); g2.addColorStop(0,'rgba(255,255,255,.5)'); g2.addColorStop(1,'rgba(255,255,255,0)'); sg.fillStyle=g2; sg.fillRect(x-r,y-r*.6,r*2,r*1.2); } }
  const dome=new T.Mesh(new T.SphereGeometry(1900, 32, 16), new T.MeshBasicMaterial({map:new T.CanvasTexture(sc), side:T.BackSide, fog:false, depthWrite:false})); dome.renderOrder=-1; scene.add(dome);
  // luces: cielo + sol con sombras
  scene.add(new T.HemisphereLight(0xeaf6ff, 0x24405c, .78));
  const sun=new T.DirectionalLight(0xfff0d2, 1.0); sun.position.copy(sunV).multiplyScalar(320); scene.add(sun); scene.add(sun.target);
  const ss=mobile?1024:2048; sun.shadow.mapSize.set(ss, ss); sun.shadow.bias=-.0006; sun.shadow.normalBias=.5;
  Object.assign(sun.shadow.camera, {left:-95, right:95, top:95, bottom:-95, near:60, far:620}); sun.shadow.camera.updateProjectionMatrix();
  R3.sun=sun;
  // fogonazo de las explosiones: una sola luz que se prende y se apaga (no se agregan luces nuevas)
  R3.flash=new T.PointLight(0xff9a40, 0, 170); R3.flash.position.set(0,12,0); scene.add(R3.flash);
  // el mar: las olas se calculan en la placa de video
  const mk=seg=>{ const g=new T.PlaneGeometry(2400, 2400, seg, seg); g.rotateX(-Math.PI/2); return g; };
  R3.geoHi=mk(mobile?120:180); R3.geoLo=mk(64);
  const wu=T.UniformsUtils.merge([T.UniformsLib.lights, { uT:{value:0}, uCalm:{value:100}, uGrid:{value:1}, uN:{value:10}, uCell:{value:CELL}, uFogN:{value:420}, uFogF:{value:1150},
    uSun:{value:sunV.clone()}, uDeep:{value:new T.Color(0x06304f)}, uShallow:{value:new T.Color(0x1a82ad)},
    uHor:{value:new T.Color(0xcfe6f5)}, uZen:{value:new T.Color(0x4a8fcd)}, uFog:{value:new T.Color(FOGC)} }]);
  const wm=new T.ShaderMaterial({uniforms:wu, vertexShader:WATER_VS, fragmentShader:WATER_FS, lights:true}); wm.extensions.derivatives=true;
  R3.wu=wm.uniforms;
  R3.water=new T.Mesh(R3.geoHi, wm); R3.water.frustumCulled=false; R3.water.receiveShadow=true; scene.add(R3.water);
  // costa paraguaya de fondo: lomas verdes y palmeras
  const hillM=[new T.MeshLambertMaterial({color:0x3f7d3a}), new T.MeshLambertMaterial({color:0x4f8f45}), new T.MeshLambertMaterial({color:0x356f3b})], hg=new T.SphereGeometry(1, 18, 10);
  for(let i=0;i<13;i++){ const h=new T.Mesh(hg, hillM[i%3]), r=85+Math.random()*70; h.scale.set(r, r*(.28+Math.random()*.14), r*.7); h.position.set(-800+i*135+Math.random()*30, -10, -640-Math.random()*90); scene.add(h); }
  const trunkM=new T.MeshLambertMaterial({color:0x6b4a2b}), leafM=new T.MeshLambertMaterial({color:0x2f7a34}), tg=new T.CylinderGeometry(.8,1.3,1,6), lg=new T.SphereGeometry(1,8,6);
  for(let i=0;i<16;i++){ const x=-560+i*74+Math.random()*30, z=-560-Math.random()*30, h=24+Math.random()*14;
    const tr=new T.Mesh(tg, trunkM); tr.scale.set(1,h,1); tr.position.set(x, h/2+8, z); scene.add(tr);
    const lf=new T.Mesh(lg, leafM); lf.scale.set(11, 5, 11); lf.position.set(x, h+10, z); scene.add(lf); }
  R3.board=new T.Group(); scene.add(R3.board);
  R3.frame=new T.Group(); R3.board.add(R3.frame);
  R3.ray=new T.Raycaster(); R3.plane=new T.Plane(new T.Vector3(0,1,0), 0);
  R3.ships=new Map(); R3.marks=new Map(); R3.rings=[];
  // partículas
  const mkP=(cap, add)=>{ const geo=new T.BufferGeometry(), pos=new Float32Array(cap*3), col=new Float32Array(cap*4), siz=new Float32Array(cap);
    geo.setAttribute('position', new T.BufferAttribute(pos,3)); geo.setAttribute('aCol', new T.BufferAttribute(col,4)); geo.setAttribute('aSize', new T.BufferAttribute(siz,1));
    const m=new T.ShaderMaterial({uniforms:{uPx:{value:600}}, vertexShader:PART_VS, fragmentShader:PART_FS, transparent:true, depthWrite:false, blending:add?T.AdditiveBlending:T.NormalBlending});
    const pts=new T.Points(geo, m); pts.frustumCulled=false; pts.renderOrder=add?9:8; scene.add(pts); geo.setDrawRange(0,0);
    return {pts, geo, m, pos, col, siz, cap, list:[]}; };
  R3.pSoft=mkP(700, false); R3.pFire=mkP(600, true);
  // la bala de cañón, la mira y el blanco del tiro que viene
  R3.bomb=shellMesh(); R3.bomb.visible=false; scene.add(R3.bomb);
  const ring=(a,b,col)=>{ const m=new T.Mesh(new T.RingGeometry(a,b,32), new T.MeshBasicMaterial({color:col, side:T.DoubleSide, transparent:true, opacity:.9, depthTest:false, depthWrite:false})); m.rotation.x=-Math.PI/2; m.visible=false; m.renderOrder=6; scene.add(m); return m; };
  R3.aim=ring(3.2, 4.3, 0xffe066); R3.tgt=ring(2.6, 3.6, 0xff4030);
  R3.ringGeo=new T.RingGeometry(.8, 1.25, 40);
  wire3D(canvas);
  setQ3(load('naval_q')==='baja' ? 'baja' : 'alta', true);
  R3.userQ = load('naval_q')!=null;
  return true;
}

/* ---------- piezas para armar barcos ---------- */
const M3={}, BURNT={}, GEO={};
function mat(name, color, o){ return M3[name]||(M3[name]=new THREE.MeshStandardMaterial(Object.assign({color, roughness:.62, metalness:.18}, o||{}))); }
function burnt(m){ if(BURNT[m.uuid]) return BURNT[m.uuid]; const c=m.clone(); if(c.color){ c.color.multiplyScalar(.3); c.color.lerp(new THREE.Color(0x2a1a12), .45); } if(c.map) c.map=null; c.roughness=.95; c.metalness=0; return BURNT[m.uuid]=c; }
function ug(k){ const T=THREE; return GEO[k]||(GEO[k]= k==='box'?new T.BoxGeometry(1,1,1) : k==='cyl'?new T.CylinderGeometry(1,1,1,14) : k==='cone'?new T.ConeGeometry(1,1,12) : k==='tor'?new T.TorusGeometry(1,.38,6,12) : new T.SphereGeometry(1,14,10)); }
function pm(g, geo, m, x, y, z){ const o=new THREE.Mesh(geo, m); o.position.set(x,y,z); o.castShadow=true; o.receiveShadow=true; g.add(o); return o; }
function bx(g, m, w, h, d, x, y, z){ const o=pm(g, ug('box'), m, x, y+h/2, z); o.scale.set(w,h,d); return o; }
function cy(g, m, r, h, x, y, z, ax, r2){ const o=pm(g, ug('cyl'), m, x, y+(ax?0:h/2), z); o.scale.set(r, h, r2||r); if(ax==='x') o.rotation.z=Math.PI/2; if(ax==='z') o.rotation.x=Math.PI/2; return o; }
function sp(g, m, rx, ry, rz, x, y, z){ const o=pm(g, ug('sph'), m, x, y, z); o.scale.set(rx,ry,rz); return o; }
function hullGeo(L, W, H, bow, round){
  const key=['h',L,W,H,bow,round].join('|'); if(GEO[key]) return GEO[key];
  const T=THREE, s=new T.Shape(), a=L/2, b=W/2, bl=Math.min(L*.42, W*bow), st=round?b*.7:b*.18;
  s.moveTo(-a+st, -b); s.lineTo(a-bl, -b); s.quadraticCurveTo(a-bl*.25, -b*.78, a, 0); s.quadraticCurveTo(a-bl*.25, b*.78, a-bl, b);
  s.lineTo(-a+st, b); s.quadraticCurveTo(-a, b, -a, b-st); s.lineTo(-a, -b+st); s.quadraticCurveTo(-a, -b, -a+st, -b);
  const g=new T.ExtrudeGeometry(s, {depth:H, bevelEnabled:true, bevelSize:.3, bevelThickness:.3, bevelSegments:1, curveSegments:8}); g.rotateX(-Math.PI/2);
  return GEO[key]=g;
}
let FLAGTEX=null, FOAMTEX=null;
function flagTex(){ if(FLAGTEX) return FLAGTEX; const c=document.createElement('canvas'); c.width=48; c.height=30; const g=c.getContext('2d'); [['#d52b1e',0],['#ffffff',10],['#0038a8',20]].forEach(([col,y])=>{ g.fillStyle=col; g.fillRect(0,y,48,10); }); g.fillStyle='#e8c84a'; g.beginPath(); g.arc(24,15,3,0,7); g.fill(); return FLAGTEX=new THREE.CanvasTexture(c); }
function foamTex(){ if(FOAMTEX) return FOAMTEX; const c=document.createElement('canvas'); c.width=c.height=128; const g=c.getContext('2d'), gr=g.createRadialGradient(64,64,22,64,64,64);
  gr.addColorStop(0,'rgba(255,255,255,0)'); gr.addColorStop(.55,'rgba(255,255,255,.1)'); gr.addColorStop(.8,'rgba(255,255,255,.55)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=gr; g.fillRect(0,0,128,128); return FOAMTEX=new THREE.CanvasTexture(c); }
function addFlag(g, x, y, z){
  const T=THREE; cy(g, mat('mast',0x2f3438), .14, 4.4, x, y, z);
  const geo=GEO.flag||(GEO.flag=new T.PlaneGeometry(3.4,2.1).translate(-1.7,0,0));
  const f=new T.Mesh(geo, M3.flag||(M3.flag=new T.MeshBasicMaterial({map:flagTex(), side:T.DoubleSide}))); f.position.set(x, y+3.3, z); g.add(f); (g.userData.flags=g.userData.flags||[]).push(f);
}
function addTurret(g, x, y, r, n, len, dir){
  const m=mat('gun',0x596570,{metalness:.45, roughness:.5});
  cy(g, m, r, 1.3, x, y, 0); bx(g, m, r*1.5, 1.1, r*1.5, x-dir*r*.2, y+.5, 0);
  for(let k=0;k<n;k++){ const z=n===1?0:(k-(n-1)/2)*r*.7; const b=cy(g, mat('barrel',0x3c454d,{metalness:.5}), .28, len, x+dir*(r*.6+len/2), y+1.25, z, 'x'); b.rotation.z=Math.PI/2+dir*.08; }
}
function addMast(g, x, y, h, radar){
  cy(g, mat('mast',0x2f3438), .2, h, x, y, 0); bx(g, mat('mast',0x2f3438), .2, .2, 3, x, y+h*.7, 0);
  if(radar){ const a=bx(g, mat('white',0xe8edf2), 3, .7, .25, x, y+h, 0); g.userData.ant=a; }
}
function addFunnel(g, x, y, r, h, col){ cy(g, mat('fun'+col, col), r, h, x, y, 0, null, r*.8); cy(g, mat('black',0x1c1f22), r*1.04, h*.22, x, y+h*.82, 0, null, r*.84); g.userData.funnel={x, y:y+h+1}; }
// casco común: devuelve la altura de la cubierta
function addHull(g, L, W, H, bow, round, hullM, deckM, bootM){
  const geo=hullGeo(L, W, H, bow, round);
  const h=pm(g, geo, hullM, 0, -1.7, 0);
  const b=pm(g, geo, bootM||mat('boot',0x7d241d,{roughness:.8}), 0, -.55, 0); b.scale.set(1.006, .75/H, 1.02);
  const top=H-1.4, d=pm(g, geo, deckM, 0, top-.12, 0); d.scale.set(.965, .32/H, .9);
  return top+.2;
}
function buildShip(k, l){
  const T=THREE, g=new T.Group(), L=l*CELL-2.2;
  const grey=mat('hull',0x8a97a4), deck=mat('deck',0xaab4bd,{roughness:.8}), white=mat('white',0xe8edf2), glass=mat('glass',0x18232e,{metalness:.7, roughness:.2}), dark=mat('dark',0x3d444b,{roughness:.85});
  if(k==='sub'){
    const m=mat('sub',0x4b5a66,{metalness:.3, roughness:.5}), r=CELL*.27, bl=Math.max(1.5, L-r*3);
    cy(g, m, r, bl, 0, .2, 0, 'x'); sp(g, m, r*1.6, r, r, bl/2, .2, 0); sp(g, m, r*2.2, r*.9, r*.9, -bl/2, .2, 0);
    cy(g, m, r*.5, 3.2, L*.06, 1.2, 0, null, r*.3).scale.x=Math.min(2.4, L*.12);
    cy(g, mat('mast',0x2f3438), .14, 3, L*.06+.4, 4, 0); bx(g, m, .8, .25, r*2.6, L*.06, 3.2, 0);
    bx(g, m, 1.6, 2.6, .25, -L/2+1, .2, 0); bx(g, m, 1.6, .25, r*2.4, -L/2+1, 1.3, 0);
    g.userData.low=true;
  } else if(k==='porta'){
    const W=CELL*.74, dy=addHull(g, L, W, 4.6, 1.1, false, grey, dark);
    bx(g, dark, L*.97, .5, W*1.1, -L*.01, dy, 0);                       // pista
    for(let x=-L*.42; x<L*.4; x+=3.4) bx(g, white, 1.9, .06, .28, x, dy+.5, -W*.08);
    const yl=bx(g, mat('yellow',0xf2c14e), L*.5, .06, .22, -L*.12, dy+.5, W*.14); yl.rotation.y=.16;
    bx(g, white, .3, .06, W*.9, -L*.44, dy+.5, 0);
    bx(g, grey, 6.4, 3.4, 2.2, L*.12, dy+.5, W*.42); bx(g, glass, 6.5, .7, 2.3, L*.12, dy+2.6, W*.42); bx(g, white, 3.6, 1.6, 1.8, L*.12, dy+3.9, W*.42);
    const u=g.userData; cy(g, mat('mast',0x2f3438), .2, 4, L*.12, dy+5.5, W*.42); u.ant=bx(g, white, 3, .7, .25, L*.12, dy+9.4, W*.42);
    const pl=mat('plane',0xc9d2da);
    for(const [px,pz,ry] of [[-L*.3,-W*.22,.2],[-L*.16,-W*.26,.2],[L*.3,-W*.1,0],[-L*.02,W*.2,-.5]]){ const p=new T.Group(); bx(p, pl, 3, .45, .6, 0, .2, 0); bx(p, pl, .9, .12, 3.2, -.1, .35, 0); bx(p, pl, .5, .9, .12, -1.3, .4, 0); p.position.set(px, dy+.5, pz); p.rotation.y=ry; g.add(p); }
    addFlag(g, -L/2+1.2, dy+.5, W*.4);
  } else if(k==='acor' || k==='cruc' || k==='dest' || k==='canpy' || k==='canhu' || k==='patru'){
    const river = k==='canpy'||k==='canhu', W=CELL*(k==='acor'?.64 : k==='cruc'?.56 : k==='dest'||k==='patru'?.48 : .58), H=k==='dest'||k==='patru'?3.4:3.9;
    const hm=river?mat('hullr',0xb9c3ca):grey, dy=addHull(g, L, W, H, 1.5, k!=='acor', hm, river?mat('wood',0xa97a4c,{roughness:.85}):deck);
    const sup=river?white:mat('sup',0x9aa6b1), sl=Math.min(L*.3, 11), sx=-L*.04;
    bx(g, sup, sl, 2.6, W*.66, sx, dy, 0); bx(g, glass, sl*.62, .7, W*.56, sx+sl*.12, dy+2.9, 0); bx(g, sup, sl*.6, 2.2, W*.52, sx+sl*.12, dy+2.6, 0);
    if(l>=3){ bx(g, glass, sl*.61, .6, W*.54, sx+sl*.12, dy+3.7, 0); addFunnel(g, sx-sl*.22, dy+2.6, l>=4?1.5:1.2, l>=4?4.4:3.6, river?0xd8b25e:0x76828d); }
    if(l>=5 || k==='acor') addFunnel(g, sx-sl*.22-3.6, dy+2.6, 1.3, 3.8, river?0xd8b25e:0x76828d);
    addMast(g, sx+sl*.12, dy+4.8, l>=3?6:4, true);
    const big=k==='acor'||river;
    addTurret(g, L*.32, dy, big?1.9:1.4, big?2:1, big?5:3.6, 1);
    if(l>=4) addTurret(g, L*.32-5.2, dy+1.2, big?1.7:1.3, 2, 4.4, 1);
    if(l>=3) addTurret(g, -L*.33, dy, big?1.8:1.3, big?2:1, big?4.6:3.4, -1);
    if(river){ bx(g, mat('awn',0xf4efe0), sl*.5, .2, W*.7, sx-sl*.7, dy+3.2, 0); for(const z of [-1,1]) cy(g, mat('mast',0x2f3438), .1, 3.2, sx-sl*.9, dy, z*W*.3); }
    addFlag(g, -L/2+1.3, dy, 0);
  } else if(k==='remo'){
    const W=CELL*.62, dy=addHull(g, L, W, 3.6, .9, true, mat('hullt',0x2b3238), mat('wood',0xa97a4c,{roughness:.85}), mat('boot2',0xb5341f));
    bx(g, white, L*.3, 3.4, W*.62, L*.08, dy, 0); bx(g, glass, L*.3+.1, .9, W*.64, L*.08, dy+2.1, 0); bx(g, mat('roof',0xc0392b), L*.34, .4, W*.7, L*.08, dy+3.4, 0);
    addFunnel(g, -L*.14, dy, 1.5, 5.4, 0xc0392b); addMast(g, L*.08, dy+3.8, 3.4, false);
    const ty=mat('tyre',0x15171a,{roughness:.95});
    for(const z of [-1,1]) for(const f of [-.28,0,.24]){ const t=pm(g, ug('tor'), ty, L*f, 1.1, z*(W/2+.35)); t.scale.set(.9,.9,.9); }
    bx(g, mat('gun',0x596570), 2.4, 1, 2.4, -L*.36, dy, 0);
    addFlag(g, -L/2+1.2, dy, 0);
  } else {   // lancha
    const W=CELL*.44, dy=addHull(g, L, W, 2.8, 1.8, false, white, mat('wood',0xa97a4c,{roughness:.85}), mat('boot3',0x0038a8));
    bx(g, white, L*.26, 1.9, W*.7, -L*.08, dy, 0); const ws=bx(g, glass, .3, 1.5, W*.68, -L*.08+L*.13, dy+.5, 0); ws.rotation.z=.35;
    bx(g, mat('roof',0xc0392b), L*.2, .25, W*.72, -L*.12, dy+1.9, 0);
    addTurret(g, L*.24, dy, .9, 1, 2.6, 1); bx(g, dark, 1.6, 1.5, W*.5, -L/2+1.4, dy, 0);
    addFlag(g, -L/2+2.6, dy+1.6, 0);
  }
  return g;
}
function labelSprite(txt, col){
  const key='lbl'+txt+col; let tex=GEO[key];
  if(!tex){ const c=document.createElement('canvas'); c.width=64; c.height=64; const g=c.getContext('2d');
    g.fillStyle=col||'#ffffff'; g.font='900 40px system-ui,sans-serif'; g.textAlign='center'; g.textBaseline='middle';
    g.shadowColor='rgba(0,0,0,.7)'; g.shadowBlur=6; g.fillText(txt, 32, 34); tex=GEO[key]=new THREE.CanvasTexture(c); }
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex, transparent:true, depthWrite:false, depthTest:false})); s.renderOrder=5; s.scale.set(7,7,1); return s;
}
function shellMesh(){
  const T=THREE, g=new T.Group(), m=new T.MeshStandardMaterial({color:0x3a3f45, metalness:.7, roughness:.35});
  const body=new T.Mesh(new T.CylinderGeometry(.9,.9,4.4,10), m); body.rotation.x=Math.PI/2; g.add(body);
  const nose=new T.Mesh(new T.ConeGeometry(.9,2.6,10), new T.MeshStandardMaterial({color:0xc9a23a, metalness:.8, roughness:.3})); nose.rotation.x=Math.PI/2; nose.position.z=3.5; g.add(nose);
  const band=new T.Mesh(new T.CylinderGeometry(.95,.95,.6,10), new T.MeshStandardMaterial({color:0xd52b1e})); band.rotation.x=Math.PI/2; band.position.z=-1.2; g.add(band);
  g.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
  return g;
}
function cellPos(r, c, n){ return [(c-(n-1)/2)*CELL, (r-(n-1)/2)*CELL]; }

/* ---------- partículas ---------- */
function emit(sys, p){ if(sys.list.length>=sys.cap) return; p.age=0; sys.list.push(p); }
const lowQ = () => R3.q==='baja';
function pFire(x, y, z, s, sp_){ const a=Math.random()*6.28, v=sp_||1.2; emit(R3.pFire, {x, y, z, vx:Math.cos(a)*v*.5, vy:5+Math.random()*5, vz:Math.sin(a)*v*.5, g:-2, life:.45+Math.random()*.4, s0:s, s1:s*.3, c0:[1,.82,.3], c1:[1,.22,.04], a:.85}); }
function pSmoke(x, y, z, s, dark, up){ emit(R3.pSoft, {x, y, z, vx:(Math.random()-.5)*1.6+1.2, vy:(up||5)+Math.random()*3, vz:(Math.random()-.5)*1.6, g:0, life:2+Math.random()*1.2, s0:s, s1:s*3.2, c0:dark?[.1,.1,.1]:[.86,.88,.9], c1:dark?[.3,.3,.3]:[1,1,1], a:dark?.55:.5}); }
function stepParts(sys, dt){
  const L=sys.list, pos=sys.pos, col=sys.col, siz=sys.siz; let n=0;
  for(let i=0;i<L.length;i++){ const p=L[i]; p.age+=dt; if(p.age>=p.life) continue;
    p.vy-=(p.g||0)*dt; if(p.drag){ const d=Math.exp(-p.drag*dt); p.vx*=d; p.vy*=d; p.vz*=d; }
    p.x+=p.vx*dt; p.y+=p.vy*dt; p.z+=p.vz*dt; if(p.floor!=null && p.y<p.floor){ p.age=p.life; continue; }
    const k=p.age/p.life; L[n]=p;
    pos[n*3]=p.x; pos[n*3+1]=p.y; pos[n*3+2]=p.z; siz[n]=p.s0+(p.s1-p.s0)*k;
    col[n*4]=p.c0[0]+(p.c1[0]-p.c0[0])*k; col[n*4+1]=p.c0[1]+(p.c1[1]-p.c0[1])*k; col[n*4+2]=p.c0[2]+(p.c1[2]-p.c0[2])*k;
    col[n*4+3]=p.a*Math.min(1, k*8)*(1-k)*(p.sq?(1-k):1); n++; }
  L.length=n; sys.geo.setDrawRange(0, n);
  sys.geo.attributes.position.needsUpdate=true; sys.geo.attributes.aCol.needsUpdate=true; sys.geo.attributes.aSize.needsUpdate=true;
}
function ringFx(x, y, z, col, grow, life, op, top){
  const T=R3.T, m=new T.Mesh(R3.ringGeo, new T.MeshBasicMaterial({color:col, transparent:true, opacity:op, side:T.DoubleSide, depthWrite:false, depthTest:!top}));
  m.rotation.x=-Math.PI/2; m.position.set(x,y,z); m.renderOrder=top?6:2; R3.scene.add(m); R3.rings.push({m, t:0, life, grow, op});
}
// lo que pasa cuando cae la bala
function spawnFx(x, z, res, cells){
  const lo=lowQ(), q=lo?.5:1, y0=R3.isRadar?1:1.2;
  ringFx(x, 1.5, z, 0xffffff, 9, 1.8, .8); setTimeout(()=>{ if(R3.ok) ringFx(x, 1.5, z, 0xffffff, 7, 1.6, .5); }, 260);
  if(R3.isRadar) ringFx(x, RADAR_Y+.25, z, res==='agua'?0x8dffb4:0xff5040, 6, 1.4, .95, true);
  if(res==='agua'){
    // columna de agua que sube y cae, con gotas y neblina
    for(let k=0;k<70*q;k++){ const a=Math.random()*6.28, r=Math.random()*1.6, up=Math.random(); emit(R3.pSoft, {x:x+Math.cos(a)*r, y:y0, z:z+Math.sin(a)*r, vx:Math.cos(a)*(1+r*2), vy:16+up*20, vz:Math.sin(a)*(1+r*2), g:34, life:1.1+up*.7, s0:2.6, s1:1.2, c0:[.95,.98,1], c1:[.8,.92,1], a:.9, floor:.2}); }
    for(let k=0;k<26*q;k++){ const a=Math.random()*6.28, v=6+Math.random()*10; emit(R3.pSoft, {x, y:y0+1, z, vx:Math.cos(a)*v, vy:8+Math.random()*10, vz:Math.sin(a)*v, g:30, life:1.2, s0:1, s1:.7, c0:[1,1,1], c1:[.85,.95,1], a:.95, floor:.2}); }
    for(let k=0;k<8*q;k++) pSmoke(x+(Math.random()-.5)*4, 2.5, z+(Math.random()-.5)*4, 3.2, false, 2);
    R3.shake=Math.max(R3.shake, .5);
  } else {
    const big=res==='hundido', pts=big && cells && cells.length ? cells.map(([r,c])=>cellPos(r,c,N())) : [[x,z]];
    pts.forEach(([px,pz],j)=>setTimeout(()=>{ if(!R3.ok) return;
      for(let k=0;k<(j?22:46)*q;k++){ const a=Math.random()*6.28, e=Math.random()*3.14, v=5+Math.random()*13; emit(R3.pFire, {x:px, y:y0+3, z:pz, vx:Math.cos(a)*Math.sin(e)*v, vy:Math.abs(Math.cos(e))*v+3, vz:Math.sin(a)*Math.sin(e)*v, g:6, drag:2.2, life:.5+Math.random()*.6, s0:6.5, s1:1.5, c0:[1,.9,.5], c1:[1,.25,.03], a:.9}); }
      for(let k=0;k<(j?8:24)*q;k++){ const a=Math.random()*6.28, v=10+Math.random()*22; emit(R3.pFire, {x:px, y:y0+3, z:pz, vx:Math.cos(a)*v, vy:14+Math.random()*22, vz:Math.sin(a)*v, g:40, life:1+Math.random()*.6, s0:1.1, s1:.4, c0:[1,.95,.6], c1:[1,.4,.1], a:1, floor:.3}); }
      for(let k=0;k<(j?5:14)*q;k++){ const a=Math.random()*6.28, v=6+Math.random()*14; emit(R3.pSoft, {x:px, y:y0+3, z:pz, vx:Math.cos(a)*v, vy:12+Math.random()*16, vz:Math.sin(a)*v, g:36, life:1.5, s0:1.3, s1:1, c0:[.12,.1,.09], c1:[.2,.16,.14], a:1, floor:.3}); }
      for(let k=0;k<(j?4:10)*q;k++) setTimeout(()=>{ if(R3.ok) pSmoke(px+(Math.random()-.5)*5, 5+Math.random()*4, pz+(Math.random()-.5)*5, 4+Math.random()*2, true, 7); }, 200+k*90);
    }, j*170));
    R3.flash.position.set(x, 14, z); R3.flash.intensity=big?7:4.5;
    R3.shake=Math.max(R3.shake, big?2.4:1.3);
  }
}

/* ---------- qué mar se ve y qué hay en él ---------- */
// el que elegiste, salvo mientras cae una bala en otro
const following3 = () => V && V.phase==='play' && R3.follow!=null && V.sides[R3.follow] && performance.now()<R3.followUntil;
function side3(){ return following3() ? R3.follow : (R3.showOwn ? smallSide() : bigSide()); }
const bkey3 = () => { const i=side3(); return [V.phase, V.round, i, following3(), (ANIM.disp[i]||[]).join(''), viewer()].join('|'); };
function buildFrame(n, radar){
  const T=R3.T, F=R3.frame, size=n*CELL; while(F.children.length) F.remove(F.children[0]);
  const fm=radar ? mat('frR',0x22332b,{emissive:0x0c3a1c, roughness:.35, metalness:.7}) : mat('frG',0xe9b949,{roughness:.38, metalness:.45});
  const fy=radar?RADAR_Y-.9:.1, h=radar?1.2:1.7;
  for(const [w,dd,x,z] of [[size+17,3,0,-size/2-7],[size+17,3,0,size/2+7],[3,size+11,-size/2-7,0],[3,size+11,size/2+7,0]]) bx(F, fm, w, h, dd, x, fy, z);
  if(!radar) for(const sx of [-1,1]) for(const sz of [-1,1]){ const b=cy(F, mat('buoyR',0xd52b1e), 2.2, 3.4, sx*(size/2+7), .2, sz*(size/2+7)); cy(F, mat('white',0xe8edf2), 2.25, 1, sx*(size/2+7), 1.4, sz*(size/2+7)); }
  for(let k=0;k<n;k++){ const lc=radar?'#8dffb4':'#ffffff';
    const a=labelSprite(String(k+1), lc); const [x]=cellPos(0,k,n); a.position.set(x, radar?RADAR_Y+2.5:5, -size/2-3.5); F.add(a);
    const b=labelSprite(LETRAS[k], lc); const [,z]=cellPos(k,0,n); b.position.set(-size/2-3.5, radar?RADAR_Y+2.5:5, z); F.add(b); }
  if(R3.radar){ R3.board.remove(R3.radar); R3.radar.geometry.dispose(); R3.radar=null; }
  if(radar){
    const data=new Uint8Array(n*n*4); if(R3.marksTex) R3.marksTex.dispose();
    const tex=new T.DataTexture(data, n, n, T.RGBAFormat); tex.magFilter=tex.minFilter=T.NearestFilter; R3.marksTex=tex; R3.marksData=data;
    R3.ru={ uT:{value:0}, uN:{value:n}, uCell:{value:CELL}, uMarks:{value:tex}, uAim:{value:new T.Vector2(-1,-1)}, uAimOn:{value:0} };
    const rm=new T.ShaderMaterial({uniforms:R3.ru, vertexShader:RADAR_VS, fragmentShader:RADAR_FS, transparent:true, depthWrite:false, side:T.DoubleSide}); rm.extensions.derivatives=true;
    const pg=new T.PlaneGeometry(size+11, size+11); pg.rotateX(-Math.PI/2);
    R3.radar=new T.Mesh(pg, rm); R3.radar.position.y=RADAR_Y; R3.radar.renderOrder=3; R3.board.add(R3.radar);
  }
}
function sinkStart(rec, animated){
  rec.sunk=true; rec.t0 = animated ? performance.now() : -1e9;
  rec.inn.traverse(o=>{ if(o.isMesh && o.material && o.material.isMeshStandardMaterial) o.material=burnt(o.material); });
  if(rec.foam) rec.foam.visible=false;
}
function sync3D(){
  const T=R3.T; R3.dirty=false; R3.syncKey=bkey3();
  const n=N(), i=side3(), s=V.sides[i];
  if(i<0 || !s){ R3.board.visible=false; return; }
  R3.board.visible=true;
  const d=ANIM.disp[i]||s.grid||[], size=n*CELL, mineS=s.pids.includes(viewer()), radar=V.phase==='play' && !mineS, fol=following3();
  const boardKey=[V.round, i, viewer()].join('|'), swapped=R3.boardKey!==boardKey;
  const lbl=$('#sea3lbl');
  if(lbl){ lbl.className = radar ? 'radar' : mineS && fol ? 'mio' : '';
    lbl.textContent = radar ? `📡 Radar · mar de ${sideName(V,i)}` : mineS ? (fol ? '🎯 ¡Te están tirando! · tu flota' : '⚓ Tu flota') : `⚓ Flota de ${sideName(V,i)}`; }
  if(swapped){
    // otro mar: se cambia lo que hay arriba del agua con un fundido corto (el agua y la cámara siguen)
    if(R3.boardKey!=null){ const cv=$('#c3d'); cv.classList.remove('swap'); void cv.offsetWidth; cv.classList.add('swap'); R3.cc.zoom*=1.06; }
    R3.boardKey=boardKey; R3.side=i;
    R3.ships.forEach(rec=>R3.board.remove(rec.out)); R3.ships.clear();
    R3.marks.forEach(m=>{ if(m.o) R3.board.remove(m.o); }); R3.marks.clear();
  }
  R3.isRadar=radar; R3.mineS=mineS; R3.plane.constant = radar ? -RADAR_Y : 0;
  R3.calmR=size*.75; R3.wu.uCalm.value=size*.75; R3.wu.uN.value=n; R3.wu.uGrid.value=radar?0:1;
  const fk=n+'|'+radar; if(R3.frameKey!==fk){ R3.frameKey=fk; buildFrame(n, radar); }
  const sh=R3.sun.shadow.camera, ext=size*.5+34; if(sh.right!==ext){ sh.left=sh.bottom=-ext; sh.right=sh.top=ext; sh.updateProjectionMatrix(); }
  // barcos que se ven
  const ownOrAll = mineS || (NET.obs && V.opts.obsVen) || V.phase!=='play';
  const want=new Set(), justHit = !swapped && ANIM.cur && ANIM.landed;
  (s.fleet||[]).forEach(x=>{ if(x.r==null || x.hidden) return; const sunk=sunkDisp(i,x); if(!ownOrAll && !sunk) return;
    const key=[x.k,x.l,x.r,x.c,x.dir].join(':'); want.add(key);
    let rec=R3.ships.get(key);
    if(!rec){
      const out=new T.Group(), inn=buildShip(x.k, x.l), [x0,z0]=cellPos(x.r, x.c, n), off=(x.l-1)*CELL/2, L=x.l*CELL-2.2;
      out.position.set(x.dir==='h'?x0+off:x0, 0, x.dir==='v'?z0+off:z0); out.rotation.y = x.dir==='v' ? -Math.PI/2 : 0; out.add(inn);
      const fo=new T.Mesh(GEO.foam||(GEO.foam=new T.PlaneGeometry(1,1).rotateX(-Math.PI/2)), new T.MeshBasicMaterial({map:foamTex(), transparent:true, opacity:.5, depthWrite:false}));
      fo.scale.set(L*1.22, 1, CELL*(inn.userData.low?.7:.98)); fo.position.y=.35; fo.renderOrder=1; out.add(fo);
      R3.board.add(out);
      rec={out, inn, foam:fo, l:x.l, L, ph:Math.random()*6, sunk:false, t0:null, fx:x.dir==='h'?1:0, fz:x.dir==='v'?1:0, sg:Math.random()<.5?-1:1, low:!!inn.userData.low};
      R3.ships.set(key, rec);
      if(sunk) sinkStart(rec, justHit);
    } else if(sunk && !rec.sunk) sinkStart(rec, true);
  });
  R3.ships.forEach((rec,key)=>{ if(!want.has(key)){ R3.board.remove(rec.out); R3.ships.delete(key); } });
  // marcas: agua = boya, tocado = fuego y humo
  const wantM=new Set();
  for(let r=0;r<n;r++) for(let c=0;c<n;c++){ const g=d[r*n+c]; if(!g) continue; const key=r+':'+c+':'+g+':'+radar; wantM.add(key); if(R3.marks.has(key)) continue;
    const [x,z]=cellPos(r,c,n); let m={x, z, g};
    if(g===1 || g===4){ if(!radar || g===1){ const o=new T.Group(); const b=sp(o, mat('white',0xe8edf2), 1.5, 1.1, 1.5, 0, .5, 0); const t=pm(o, ug('cone'), mat('buoyR',0xd52b1e), 0, 1.9, 0); t.scale.set(.9,1.8,.9);
        if(g===4) o.scale.setScalar(.6); o.position.set(x, 0, z); R3.board.add(o); m.o=o; m.bob=1; } }
    else if(g===2){ m.fire=true; m.y=radar?1.4:3.6; m.next=0; m.nextS=0; }
    R3.marks.set(key, m); }
  R3.marks.forEach((m,key)=>{ if(!wantM.has(key)){ if(m.o) R3.board.remove(m.o); R3.marks.delete(key); } });
  if(radar && R3.marksData){ const data=R3.marksData; for(let k=0;k<n*n;k++){ data[k*4]=d[k]||0; data[k*4+3]=255; } R3.marksTex.needsUpdate=true; }
}

/* ---------- controles ---------- */
function wire3D(cv){
  let drag=null;
  cv.addEventListener('pointerdown', e=>{ cv.setPointerCapture(e.pointerId); drag={x:e.clientX, y:e.clientY, sx:e.clientX, sy:e.clientY}; });
  cv.addEventListener('pointermove', e=>{ if(!drag) return; const dx=e.clientX-drag.x, dy=e.clientY-drag.y; drag.x=e.clientX; drag.y=e.clientY; CAM3.yaw+=dx*.005; CAM3.pitch=Math.max(18, Math.min(88, CAM3.pitch+dy*.2)); });
  cv.addEventListener('pointercancel', ()=>{ drag=null; });
  cv.addEventListener('pointerup', e=>{ if(!drag) return; const tap=Math.hypot(e.clientX-drag.sx, e.clientY-drag.sy)<7; drag=null; saveCam3();
    if(!tap || !V || V.phase!=='play' || !R3.isRadar) return;
    const r=cv.getBoundingClientRect(), v=new R3.T.Vector2((e.clientX-r.left)/r.width*2-1, -((e.clientY-r.top)/r.height*2-1));
    R3.ray.setFromCamera(v, R3.cam); const p=new R3.T.Vector3(); if(!R3.ray.ray.intersectPlane(R3.plane, p)) return;
    const n=N(), c=Math.floor(p.x/CELL+n/2), rr=Math.floor(p.z/CELL+n/2); if(rr<0||rr>=n||c<0||c>=n) return;
    aimAt(rr, c, false);
  });
  cv.addEventListener('wheel', e=>{ e.preventDefault(); CAM3.zoom=Math.max(.5, Math.min(2.2, CAM3.zoom*(e.deltaY>0?1.08:.93))); saveCam3(); }, {passive:false});
}
function cam3(k, d){
  if(k==='own'){ R3.showOwn=!R3.showOwn; R3.followUntil=0; R3.dirty=true; toast(R3.showOwn?'⚓ Mirando el otro mar (tu flota si jugás)':'📡 Mirando el radar del mar enemigo'); return; }
  if(k==='q'){ R3.userQ=true; setQ3(lowQ()?'alta':'baja'); toast(lowQ()?'🔅 Calidad baja: sin sombras, más liviano para el aparato.':'✨ Calidad alta: sombras y más detalle.'); return; }
  if(k==='zoom') CAM3.zoom=Math.max(.5, Math.min(2.2, CAM3.zoom*(d>0?.85:1.18)));
  else if(k==='pitch') CAM3.pitch=Math.max(18, Math.min(88, CAM3.pitch+d));
  else if(k==='reset'){ CAM3.pitch=48; CAM3.zoom=1; CAM3.yaw=0; }
  saveCam3();
}

/* ---------- cada cuadro ---------- */
function draw3D(t){
  const T=R3.T, dt=Math.min(.1, Math.max(.001, (t-(R3.lt||t))/1000)); R3.lt=t;
  if(R3.dirty || R3.syncKey!==bkey3()) sync3D();
  const tt=t/1000, n=N(), now=performance.now(), lo=lowQ(), size=n*CELL;
  R3.wu.uT.value=tt;
  // si el aparato no da, se baja sola la calidad (una vez, y solo si no la eligió la persona)
  if(!R3.userQ && !lo){ R3.fn=(R3.fn||0)+1; if(R3.fn>40){ R3.fa=(R3.fa||0)+dt; if(R3.fn===130){ if(R3.fa/90>.04){ R3.userQ=true; setQ3('baja', true); toast('🔅 Bajé la calidad del 3D para que ande más fluido en este aparato.'); } else R3.userQ=true; } } }
  // barcos: suben y bajan con las olas; los hundidos se escoran y se van a pique
  R3.ships.forEach(rec=>{ const o=rec.out, p=o.position, h=waveH(p.x, p.z, tt);
    if(!rec.sunk){
      const a=rec.L*.3, df=waveH(p.x+rec.fx*a, p.z+rec.fz*a, tt)-waveH(p.x-rec.fx*a, p.z-rec.fz*a, tt), ds=waveH(p.x-rec.fz*3, p.z+rec.fx*3, tt)-waveH(p.x+rec.fz*3, p.z-rec.fx*3, tt);
      p.y=h*.75+(rec.low?-.6:0); rec.inn.rotation.z=df/(a*2)*.9; rec.inn.rotation.x=-ds*.05+Math.sin(tt*.9+rec.ph)*.025;
    } else {
      const k=Math.min(1, (now-rec.t0)/3600), e=k*k*(3-2*k);
      p.y=h*.75*(1-e*.7)-e*(rec.low?3.2:4.3); rec.inn.rotation.x=rec.sg*e*.42+Math.sin(tt*.7+rec.ph)*.02*(1-e); rec.inn.rotation.z=e*.2*Math.min(1, 2/rec.l+.4);
      if(k<1 && Math.random()<(lo?.3:.7)){ const q=(Math.random()-.5)*rec.L; emit(R3.pSoft, {x:p.x+rec.fx*q+(Math.random()-.5)*4, y:.6, z:p.z+rec.fz*q+(Math.random()-.5)*4, vx:0, vy:2+Math.random()*3, vz:0, g:3, life:.9, s0:1.2, s1:3, c0:[1,1,1], c1:[.9,.97,1], a:.75}); }
      if(k<1 && Math.random()<.12) pSmoke(p.x+(Math.random()-.5)*rec.L*.6*rec.fx, 4, p.z+(Math.random()-.5)*rec.L*.6*rec.fz, 3.5, true, 6);
    }
    const u=rec.inn.userData; if(!rec.sunk){ if(u.ant) u.ant.rotation.y=tt*2.4+rec.ph; if(u.flags) for(const f of u.flags) f.rotation.y=Math.sin(tt*3+rec.ph)*.35;
      if(u.funnel && !lo && Math.random()<.05){ const c=Math.cos(o.rotation.y), s_=Math.sin(o.rotation.y); emit(R3.pSoft, {x:p.x+u.funnel.x*c, y:p.y+u.funnel.y, z:p.z-u.funnel.x*s_, vx:1.5, vy:3, vz:.3, g:0, life:1.8, s0:1.4, s1:4, c0:[.35,.35,.36], c1:[.6,.6,.62], a:.28}); } }
  });
  // marcas
  R3.marks.forEach(m=>{
    if(m.o){ m.o.position.y=waveH(m.x, m.z, tt)*.9; m.o.rotation.z=Math.sin(tt*1.7+m.x)*.12; m.o.rotation.x=Math.cos(tt*1.4+m.z)*.12; }
    else if(m.fire){ const y=m.y+waveH(m.x, m.z, tt)*.7;
      if(t>m.next){ m.next=t+(lo?150:70)+Math.random()*50; pFire(m.x+(Math.random()-.5)*2.2, y, m.z+(Math.random()-.5)*2.2, 4.2+Math.random()*2); }
      if(t>m.nextS){ m.nextS=t+(lo?560:300)+Math.random()*200; pSmoke(m.x, y+4, m.z, 2.6, true, 6); } }
  });
  // mira, blanco y bala en camino
  const am = myTurn() && AIM.r!=null && AIM.to===R3.side ? AIM : (REMOTE_AIM && REMOTE_AIM.to===R3.side && REMOTE_AIM.r!=null && !mine(curShooter()) ? REMOTE_AIM : null);
  R3.aim.visible=!!am && !R3.isRadar; if(am && !R3.isRadar){ const [x,z]=cellPos(am.r, am.c, n); R3.aim.position.set(x, 1.6+waveH(x,z,tt)*.8+Math.sin(tt*6)*.3, z); R3.aim.rotation.z=tt; }
  if(R3.radar){ R3.ru.uT.value=tt; R3.ru.uAimOn.value=am?1:0; if(am) R3.ru.uAim.value.set(am.r, am.c); }
  const cur=ANIM.cur; let flying=false;
  if(cur && cur.to===R3.side){
    const k=Math.min(1, (now-ANIM.t0)/1100), [x,z]=cellPos(cur.r, cur.c, n);
    const far=R3.mineS ? -1 : 1, sx=x*.35, sz=far*size*1.7, y1=R3.isRadar?1.5:2.5;
    const pos=kk=>new T.Vector3(sx+(x-sx)*kk, 14+(y1-14)*kk+70*4*kk*(1-kk)*.5, sz+(z-sz)*kk);
    if(k<1){ flying=true; const p=pos(k); R3.bomb.position.copy(p); R3.bomb.lookAt(pos(Math.min(1,k+.02)));
      if(t>(R3.trailT||0)){ R3.trailT=t+(lo?50:24); emit(R3.pSoft, {x:p.x, y:p.y, z:p.z, vx:0, vy:1, vz:0, g:0, life:.8, s0:1.4, s1:3.6, c0:[.9,.9,.9], c1:[1,1,1], a:.5}); emit(R3.pFire, {x:p.x, y:p.y, z:p.z, vx:0, vy:0, vz:0, g:0, life:.18, s0:2.6, s1:.6, c0:[1,.8,.4], c1:[1,.3,.1], a:.9}); }
      R3.tgt.visible=true; const pu=1+Math.sin(tt*14)*.18; R3.tgt.scale.set(pu,pu,pu); R3.tgt.position.set(x, (R3.isRadar?RADAR_Y+.3:1.7+waveH(x,z,tt)*.8), z); }
    else if(R3.fxDone!==cur.n){ R3.fxDone=cur.n; spawnFx(x, z, cur.res, cur.cells); }
  }
  R3.bomb.visible=flying; if(!flying) R3.tgt.visible=false;
  if(!cur) R3.fxDone=null;
  // ondas, partículas y fogonazo
  R3.rings=R3.rings.filter(f=>{ f.t+=dt; if(f.t>f.life){ R3.scene.remove(f.m); f.m.material.dispose(); return false; } const s=1+f.t*f.grow; f.m.scale.set(s,s,s); f.m.material.opacity=f.op*(1-f.t/f.life); return true; });
  stepParts(R3.pSoft, dt); stepParts(R3.pFire, dt);
  R3.flash.intensity*=Math.exp(-dt*5); if(R3.flash.intensity<.02) R3.flash.intensity=0;
  // cámara: va suave hacia donde se la mandó, con un vaivén leve y el sacudón de las explosiones
  const c=R3.cc, f=1-Math.exp(-dt*7); c.yaw+=(CAM3.yaw-c.yaw)*f; c.pitch+=(CAM3.pitch-c.pitch)*f; c.zoom+=(CAM3.zoom-c.zoom)*f;
  const asp=R3.cam.aspect||1, dist=size*Math.max(1.95, 1.56/asp)*c.zoom, p=c.pitch*Math.PI/180, yw=c.yaw+Math.sin(tt*.23)*.025;
  R3.shake*=Math.exp(-dt*4.5); const sk=R3.shake;
  R3.cam.position.set(Math.sin(yw)*Math.cos(p)*dist+Math.sin(tt*71)*sk, Math.sin(p)*dist+Math.sin(tt*83)*sk, Math.cos(yw)*Math.cos(p)*dist+Math.sin(tt*59)*sk);
  R3.cam.lookAt(0, 0, asp<1 ? size*.06 : 2);
  R3.renderer.render(R3.scene, R3.cam);
}
function resizeStage(){
  if(!R3.ok) return;
  const st=$('#stage'), r=st.getBoundingClientRect(); if(r.width<2 || r.height<2) return;
  if(R3.sw===r.width && R3.sh===r.height && R3.spr===R3.renderer.getPixelRatio()) return;
  R3.sw=r.width; R3.sh=r.height; R3.spr=R3.renderer.getPixelRatio();
  R3.renderer.setSize(r.width, r.height, false); R3.cam.aspect=r.width/Math.max(1,r.height); R3.cam.updateProjectionMatrix();
  const px=r.height*R3.spr/(2*Math.tan(22.5*Math.PI/180)); R3.pSoft.m.uniforms.uPx.value=px; R3.pFire.m.uniforms.uPx.value=px;
}
window.addEventListener('resize', ()=>{ if($('#game').classList.contains('on')) resizeStage(); });
function applyView(){
  const is3 = VIEW.mode==='3d' && R3.ok;
  $('#game').classList.toggle('v3d', is3);
  $('#btnView').textContent = is3 ? '🗺️ 2D' : '🧊 3D';
  if(is3){ R3.dirty=true; requestAnimationFrame(resizeStage); }
}
function toggleView(){
  if(VIEW.mode==='2d'){ if(!init3D()) return; VIEW.mode='3d'; toast('🧊 Vista 3D: tocá una casilla del radar para apuntar y otra vez para tirar. Arrastrá para girar el mar.'); }
  else VIEW.mode='2d';
  store('naval_view', VIEW.mode); applyView(); if(V) renderGame();
}
function loop(t){
  requestAnimationFrame(loop);
  if(!V || V.phase==='lobby' || !$('#game').classList.contains('on')) return;
  if(VIEW.mode==='3d' && R3.ok && V.phase!=='place'){ resizeStage(); draw3D(t); }
}
requestAnimationFrame(loop);
setTimeout(()=>{ if(VIEW.mode==='3d' && !init3D()) VIEW.mode='2d'; applyView(); }, 0);
