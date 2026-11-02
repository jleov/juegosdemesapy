'use strict';
/* =====================================================================
   Salón de Belleza PY — vista 3D (three.js r128). La cara se pinta con el
   mismo dibujo 2D (como textura), el pelo son cintas que siguen los mismos
   mechones y las uñas usan el mismo dibujo. Al apuntar se usa el mismo
   modelo: un punto 3D → mechones cercanos, zona de la cara o uña.
   ===================================================================== */
const R3={ok:false, orbit:null, camKey:'', keys:{}};
const CAM3=Object.assign({cab:{yaw:0,pitch:6,dist:6.4}, manos:{yaw:0,pitch:60,dist:6.3}}, load('salon_cam3')||{});
let RD=null, SC=null, CAMERA=null;
const G3={};
const RAY = () => G3.ray || (G3.ray=new THREE.Raycaster());
function mat(col, o){ return new THREE.MeshStandardMaterial(Object.assign({color:new THREE.Color(col), roughness:.65, metalness:0}, o||{})); }
function init3D(){
  if(R3.ok || R3.failed || !window.THREE) return;
  try{ RD=new THREE.WebGLRenderer({canvas:$('#c3d'), antialias:true}); }
  catch(e){ R3.failed=true; VIEW.mode='2d'; PREF.vista='2d'; savePref(); applyView(); toast('Este aparato no puede mostrar 3D: seguimos en 2D.'); return; }
  RD.setPixelRatio(Math.min(2, window.devicePixelRatio||1));
  SC=new THREE.Scene(); SC.background=new THREE.Color('#f7d9e6');
  CAMERA=new THREE.PerspectiveCamera(38,1,.1,100);
  SC.add(new THREE.HemisphereLight(0xffffff, 0x9a7080, .8));
  const d=new THREE.DirectionalLight(0xffffff,.65); d.position.set(3,5,6); SC.add(d);
  const d2=new THREE.DirectionalLight(0xffe6f0,.3); d2.position.set(-4,2,-3); SC.add(d2);
  // ---- cabeza ----
  const head=G3.head=new THREE.Group(); SC.add(head);
  G3.faceCv=document.createElement('canvas'); G3.faceCv.width=G3.faceCv.height=512;
  G3.faceTex=new THREE.CanvasTexture(G3.faceCv);
  const fg=new THREE.SphereGeometry(1,56,40,0,Math.PI), pos=fg.attributes.position, uv=fg.attributes.uv;
  for(let i=0;i<pos.count;i++) uv.setXY(i,(pos.getX(i)+1)/2,(pos.getY(i)+1)/2);
  G3.skinM=mat('#eec3a0',{roughness:.75});
  G3.front=new THREE.Mesh(fg, new THREE.MeshStandardMaterial({map:G3.faceTex, roughness:.72}));
  G3.back=new THREE.Mesh(new THREE.SphereGeometry(1,56,40,Math.PI,Math.PI), G3.skinM);
  for(const m of [G3.front,G3.back]){ m.scale.set(HEAD.sx,HEAD.sy,HEAD.sz); head.add(m); }
  G3.front.userData.k='cara'; G3.back.userData.k='cabeza';
  G3.nose=new THREE.Mesh(new THREE.SphereGeometry(.1,20,14), G3.skinM); G3.nose.scale.set(.85,1.7,1.1); G3.nose.position.set(0,-.12,.9); G3.nose.userData.k='cara'; head.add(G3.nose);
  for(const sx of [-1,1]){ const e=new THREE.Mesh(new THREE.SphereGeometry(1,16,12), G3.skinM); e.scale.set(.09,.19,.12); e.position.set(sx*.85,-.02,0); head.add(e); }
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(.3,.33,1.1,24), G3.skinM); neck.position.y=-1.15; head.add(neck);
  const prof=[[.001,-1.33],[.36,-1.36],[.7,-1.5],[1.25,-1.72],[1.62,-2.05],[1.74,-2.5],[1.78,-3.4],[.001,-3.4]].map(p=>new THREE.Vector2(p[0],p[1]));
  const cape=new THREE.Mesh(new THREE.LatheGeometry(prof,48), mat(CAPE,{roughness:.85})); cape.scale.z=.5; head.add(cape);
  const collar=new THREE.Mesh(new THREE.TorusGeometry(.37,.05,8,32), mat('#ffffff')); collar.rotation.x=Math.PI/2; collar.position.y=-1.38; head.add(collar);
  const chair=new THREE.Mesh(new THREE.BoxGeometry(2.7,2.4,.35), mat('#4a2a3a',{roughness:.5})); chair.position.set(0,-2.4,-1.05); head.add(chair); G3.chair=chair;
  const mirror=new THREE.Mesh(new THREE.CircleGeometry(2.6,48), new THREE.MeshBasicMaterial({map:nandutiTex(), transparent:true})); mirror.position.set(0,0,-3.2); head.add(mirror);
  G3.hairM=new THREE.MeshStandardMaterial({vertexColors:true, side:THREE.DoubleSide, roughness:.5});
  G3.capM=mat('#3a2418',{roughness:.8});
  G3.dyn=new THREE.Group(); head.add(G3.dyn);
  G3.acc=new THREE.Group(); head.add(G3.acc);
  // ---- manos ----
  const hands=G3.hands=new THREE.Group(); SC.add(hands);
  const towel=new THREE.Mesh(new THREE.PlaneGeometry(5,3.2), mat('#fdf3fa',{roughness:1})); towel.rotation.x=-Math.PI/2; towel.position.set(0,-.12,-.1); towel.userData.k='mesa'; hands.add(towel);
  const table=new THREE.Mesh(new THREE.BoxGeometry(6.5,.2,4.2), mat('#c99a72',{roughness:.6})); table.position.set(0,-.23,-.1); hands.add(table);
  G3.handDyn=new THREE.Group(); hands.add(G3.handDyn);
  R3.ok=true; resize3D();
}
function nandutiTex(){
  const cv=document.createElement('canvas'); cv.width=cv.height=512; const x=cv.getContext('2d');
  x.setTransform(256/1.8,0,0,256/1.8,256,256); x.globalAlpha=.5; nanduti(x,0,0,1.75,'#ffffff');
  return new THREE.CanvasTexture(cv);
}
function resize3D(){
  if(!R3.ok) return; const st=$('#stage'), w=st.clientWidth, h=st.clientHeight; if(!w||!h) return;
  RD.setSize(w,h,false); CAMERA.aspect=w/h; CAMERA.updateProjectionMatrix();
}
function clearGroup(g){ while(g.children.length){ const m=g.children.pop(); m.traverse(o=>{ if(o.geometry) o.geometry.dispose(); if(o.material && o.material.map && o.material.map!==G3.faceTex) o.material.map.dispose(); }); } }

/* ---------- pelo ---------- */
function buildHair(c){
  clearGroup(G3.dyn);
  const list=hairStrands(c), P=[], C=[], I=[]; let v=0;
  const col=new THREE.Color();
  for(const st of list){
    const h=c.hair[st.s], pts=st.pts, n=pts.length; if(n<2) continue;
    let base=hairCol(h); if(h.mech && h.mA>.05 && st.j%2===1) base=mix(base,h.mech,Math.min(1,h.mA)*.9);
    const tipC=h.tip&&h.tA>.05 ? mix(base,h.tip,Math.min(1,h.tA)) : null;
    for(let i=0;i<n;i++){
      const p=pts[i], a=pts[Math.max(0,i-1)], b=pts[Math.min(n-1,i+1)];
      let dx=b[0]-a[0], dy=b[1]-a[1], dz=b[2]-a[2]; const dl=Math.hypot(dx,dy,dz)||1; dx/=dl; dy/=dl; dz/=dl;
      let ox=p[0], oy=p[1]*.3, oz=p[2]; const ol=Math.hypot(ox,oy,oz)||1; ox/=ol; oy/=ol; oz/=ol;
      let sx=dy*oz-dz*oy, sy=dz*ox-dx*oz, sz=dx*oy-dy*ox; const sl=Math.hypot(sx,sy,sz)||1; sx/=sl; sy/=sl; sz/=sl;
      const w=.05*(1-.45*i/n)+.012;
      P.push(p[0]+sx*w, p[1]+sy*w, p[2]+sz*w, p[0]-sx*w, p[1]-sy*w, p[2]-sz*w);
      col.set(tipC && i>n*.58 ? tipC : base); const k=.82+.18*((st.j%3)/2);
      C.push(col.r*k,col.g*k,col.b*k, col.r*k*.9,col.g*k*.9,col.b*k*.9);
      if(i<n-1){ I.push(v,v+1,v+2, v+1,v+3,v+2); }
      v+=2;
    }
  }
  if(P.length){
    const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P,3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C,3)); g.setIndex(I); g.computeVertexNormals();
    const m=new THREE.Mesh(g, G3.hairM); m.userData.k='pelo'; G3.dyn.add(m);
  }
  // casquete (el pelo pegado a la cabeza)
  const amt=avg(c.hair.map(h=>Math.min(1,h.L/.06)));
  if(amt>.03){
    const cg=new THREE.SphereGeometry(1.025,48,28,0,Math.PI*2,0,Math.PI*.62), cp=cg.attributes.position;
    for(let i=0;i<cp.count;i++){ const x=cp.getX(i), y=cp.getY(i), z=cp.getZ(i), yaw=Math.atan2(x,z)/D2R, el=Math.asin(Math.max(-1,Math.min(1,y/1.025)))/D2R;
      const ay=Math.abs(yaw), line = ay<60 ? 34-ay*.08 : ay<110 ? 30-(ay-60)*.7 : -5-(ay-110)*.45;
      if(el<line){ const k=Math.cos(line*D2R)*1.025, f=k/Math.max(.001,Math.hypot(x,z)); cp.setXYZ(i,x*f,Math.sin(line*D2R)*1.025,z*f); } }
    cg.computeVertexNormals();
    const capM=G3.capM; capM.color.set(hairBase(c)); capM.transparent=amt<.6; capM.opacity=amt<.6?.45+amt*.5:1;
    const cap=new THREE.Mesh(cg, capM); cap.scale.set(HEAD.sx,HEAD.sy,HEAD.sz); cap.userData.k='pelo'; G3.dyn.add(cap);
  }
  // cola, trenzas o moño
  for(const tp of tailPaths(c)){
    const bm=mat(hairBase(c),{roughness:.55});
    if(tp.bun){ const s=new THREE.Mesh(new THREE.SphereGeometry(tp.r,24,16), bm); s.position.set(...tp.p); s.scale.set(1,.9,.9); s.userData.k='pelo'; G3.dyn.add(s);
      const t=new THREE.Mesh(new THREE.TorusGeometry(tp.r*.7,tp.r*.2,8,24), mat(shade(hairBase(c),-.2))); t.position.set(...tp.p); t.lookAt(0,0,0); G3.dyn.add(t); continue; }
    const n=tp.pts.length;
    for(let i=0;i<n;i++){ const p=tp.pts[i], w=tp.w*(1-.45*i/n)*.6, s=new THREE.Mesh(new THREE.SphereGeometry(w,12,10), i%2&&tp.braid?mat(shade(hairBase(c),-.12)):bm);
      s.position.set(p[0]+(tp.braid?(i%2?.02:-.02):0),p[1],p[2]); s.scale.set(1,tp.braid?1.3:1.6,1); s.userData.k='pelo'; G3.dyn.add(s); }
  }
  // espuma
  const foam=[]; for(const st of list){ const h=c.hair[st.s]; if(h.foam<.08 || st.j%2) continue; for(let i=0;i<Math.min(st.pts.length,18);i+=3) foam.push([st.pts[i], .04+h.foam*.05]); }
  if(foam.length){ const im=new THREE.InstancedMesh(new THREE.SphereGeometry(1,10,8), mat('#ffffff',{roughness:.3}), foam.length), m4=new THREE.Matrix4();
    foam.forEach(([p,r],i)=>{ m4.makeScale(r,r,r); m4.setPosition(p[0]*1.03,p[1],p[2]*1.03); im.setMatrixAt(i,m4); }); G3.dyn.add(im); }
}
/* ---------- accesorios ---------- */
const onHead = (x,y,o) => [x, y, HEAD.sz*Math.sqrt(Math.max(0,1-(x/HEAD.sx)**2-(y/HEAD.sy)**2))*(o||1.04)];
function flower3(col, mid, n, r){
  const g=new THREE.Group();
  for(let k=0;k<n;k++){ const a=k*Math.PI*2/n, p=new THREE.Mesh(new THREE.SphereGeometry(r*.45,12,8), mat(col)); p.scale.set(1,.6,.3); p.position.set(Math.cos(a)*r*.5,Math.sin(a)*r*.5,0); p.rotation.z=a; g.add(p); }
  const m=new THREE.Mesh(new THREE.SphereGeometry(r*.25,12,8), mat(mid)); m.position.z=.03; g.add(m); return g;
}
function buildAcc(c){
  clearGroup(G3.acc); const A=c.acc, add=o=>{ G3.acc.add(o); return o; };
  if(A.includes('lapacho')){ const f=add(flower3('#f06bb0','#f7d23a',5,.2)); f.position.set(...onHead(.66,.55)); f.lookAt(f.position.x*3,f.position.y*1.5,f.position.z*3); }
  if(A.includes('mburucuya')){ const f=add(flower3('#f4f0ff','#7a3fa6',10,.22)); f.position.set(...onHead(-.66,.55)); f.lookAt(f.position.x*3,f.position.y*1.5,f.position.z*3); }
  if(A.includes('peineta')){ const cv=document.createElement('canvas'); cv.width=cv.height=256; const x=cv.getContext('2d'); x.setTransform(128/.5,0,0,-128/.5,128,128); nanduti(x,0,0,.48,'#ffffff');
    const p=add(new THREE.Mesh(new THREE.CircleGeometry(.5,32,0,Math.PI), new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(cv), transparent:true, side:THREE.DoubleSide}))); p.position.set(0,.9,-.35); p.rotation.x=-.35; }
  if(A.includes('vincha')) ['#d52b1e','#ffffff','#0038a8'].forEach((col,k)=>{ const t=add(new THREE.Mesh(new THREE.TorusGeometry(1.04,.035,8,48,Math.PI*.72), mat(col))); t.scale.set(HEAD.sx,HEAD.sy,1); t.rotation.z=Math.PI*.14; t.position.z=.28-k*.075; });
  if(A.includes('corona')){ const g=add(new THREE.Group()); g.position.set(0,.88,.25); g.rotation.x=-.35;
    const r=new THREE.Mesh(new THREE.TorusGeometry(.42,.03,8,32,Math.PI), mat('#e8c34a',{metalness:.6,roughness:.3})); g.add(r);
    for(let k=0;k<5;k++){ const a=Math.PI*(k+.5)/5, cn=new THREE.Mesh(new THREE.ConeGeometry(.05,k===2?.3:.2,8), mat('#e8c34a',{metalness:.6,roughness:.3})); cn.position.set(Math.cos(a)*.42,Math.sin(a)*.42+.1,0); g.add(cn);
      const gem=new THREE.Mesh(new THREE.SphereGeometry(.035,8,6), mat(k===2?'#e5578c':'#6ec6f0',{metalness:.2,roughness:.2})); gem.position.set(Math.cos(a)*.42,Math.sin(a)*.42,.03); g.add(gem); } }
  if(A.includes('piri')){ const straw=mat('#e2c27a',{roughness:.9}); const b=add(new THREE.Mesh(new THREE.CylinderGeometry(1.45,1.45,.03,48), straw)); b.position.y=.8;
    const cr=add(new THREE.Mesh(new THREE.CylinderGeometry(.68,.78,.55,40), straw)); cr.position.y=1.08;
    ['#d52b1e','#ffffff','#0038a8'].forEach((col,k)=>{ const bd=add(new THREE.Mesh(new THREE.CylinderGeometry(.785-k*.01,.785-k*.01,.05,40,1,true), mat(col))); bd.position.y=.86+k*.05; }); }
  if(A.includes('lentes')) for(const sx of [-1,1]){ const r=add(new THREE.Mesh(new THREE.TorusGeometry(.16,.025,8,24), mat('#111'))); r.position.set(sx*.33,.05,.98);
    const l=add(new THREE.Mesh(new THREE.CircleGeometry(.16,24), new THREE.MeshStandardMaterial({color:0x151520, transparent:true, opacity:.75, roughness:.1}))); l.position.set(sx*.33,.05,.985); }
  if(A.includes('aros')) for(const sx of [-1,1]){ const r=add(new THREE.Mesh(new THREE.TorusGeometry(.07,.014,8,20), mat('#e6b422',{metalness:.8,roughness:.25}))); r.position.set(sx*.88,-.3,.02); r.rotation.y=Math.PI/2; }
  if(A.includes('collar')){ const t=add(new THREE.Mesh(new THREE.TorusGeometry(.42,.03,8,40), mat('#fbfbf4'))); t.rotation.x=Math.PI/2+.25; t.position.set(0,-1.45,.05); }
  if(A.includes('monio')) for(const sx of [-1,1]){ const cn=add(new THREE.Mesh(new THREE.ConeGeometry(.12,.26,10), mat('#d61f3a'))); cn.position.set(.5+sx*.13,.86,.55); cn.rotation.z=sx*Math.PI/2; }
}
/* ---------- cara (textura) ---------- */
function paintFace(c, t, talk){
  const x=G3.faceCv.getContext('2d');
  x.setTransform(1,0,0,1,0,0); x.fillStyle=c.skin; x.fillRect(0,0,512,512);
  x.setTransform(256/HEAD.sx,0,0,-256/HEAD.sy,256,256);
  drawFace(x,c,t,talk); G3.faceTex.needsUpdate=true;
}
/* ---------- manos ---------- */
function buildHands(c){
  clearGroup(G3.handDyn); const sk=mat(c.skin,{roughness:.7}); G3.nails=[];
  for(let h=0;h<2;h++){
    const palm=new THREE.Mesh(new THREE.SphereGeometry(1,24,16), sk); palm.scale.set(.52,.13,.6); palm.position.set(HANDX[h],0,.72); palm.userData.k='mano'; G3.handDyn.add(palm);
    const wr=new THREE.Mesh(new THREE.CylinderGeometry(.3,.33,1.2,16), sk); wr.rotation.x=Math.PI/2; wr.position.set(HANDX[h],-.02,1.5); G3.handDyn.add(wr);
    for(let f=0;f<5;f++){
      const n=h*5+f, g=fingerGeom(n), ang=Math.atan2(g.ux,g.uy);
      const fi=new THREE.Mesh(new THREE.CylinderGeometry(g.w/2,g.w/2*1.05,g.len,14), sk);
      fi.rotation.order='YXZ'; fi.rotation.x=Math.PI/2; fi.rotation.y=-ang;   // acostado, apuntando hacia adelante
      fi.position.set(g.bx+g.ux*g.len/2, .04, -(g.by+g.uy*g.len/2)); fi.userData.k='mano'; G3.handDyn.add(fi);
      const tip=new THREE.Mesh(new THREE.SphereGeometry(g.w/2,14,10), sk); tip.position.set(g.tipx,.04,-g.tipy); G3.handDyn.add(tip);
      const cv=document.createElement('canvas'); cv.width=64; cv.height=160;
      const pl=new THREE.Mesh(new THREE.PlaneGeometry(1,1), new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(cv), transparent:true, alphaTest:.4, roughness:.25}));
      pl.rotation.order='YXZ'; pl.rotation.x=-Math.PI/2; pl.rotation.y=-ang; pl.userData.k='una'; G3.handDyn.add(pl);
      G3.nails.push({pl, cv, key:''});
    }
  }
}
function paintNails(c){
  for(let n=0;n<10;n++){
    const nl=c.nails[n], N=G3.nails[n], g=nailGeom(n,nl.L), fg=fingerGeom(n), key=JSON.stringify(nl)+c.cut[n<5?0:1];
    N.pl.scale.set(g.w,g.l,1); N.pl.position.set(fg.bx+fg.ux*(g.st+g.l/2), .04+fg.w/2+.004, -(fg.by+fg.uy*(g.st+g.l/2)));
    if(N.key===key) continue; N.key=key;
    const x=N.cv.getContext('2d'); x.setTransform(1,0,0,1,0,0); x.clearRect(0,0,64,160); x.setTransform(64/g.w,0,0,-160/g.l,32,160);
    drawNailShape(x, nl, g.w, g.l); N.pl.material.map.needsUpdate=true;
  }
}

/* ---------- cámara y cuadro ---------- */
function camOf(){ return CAM3[zone()]; }
function placeCam(){
  const z=zone(), k=camOf(), tgt = z==='manos' ? new THREE.Vector3(0,0,.1) : new THREE.Vector3(0,-.35,0);
  const yaw=k.yaw*D2R, pit=k.pitch*D2R;
  CAMERA.position.set(tgt.x+Math.sin(yaw)*Math.cos(pit)*k.dist, tgt.y+Math.sin(pit)*k.dist, tgt.z+Math.cos(yaw)*Math.cos(pit)*k.dist);
  CAMERA.lookAt(tgt);
}
function draw3D(t){
  const c=curClient(); if(!c) return;
  const z=zone(), K=R3.keys;
  G3.head.visible = z==='cab'; G3.hands.visible = z==='manos';
  if(z==='cab'){
    const hk=c.st+JSON.stringify(c.hair); if(K.hair!==hk || K.client!==c){ K.hair=hk; buildHair(c); }
    const ak=c.acc.join(); if(K.acc!==ak){ K.acc=ak; buildAcc(c); }
    const talk=talking(), blink=(t%4.3)<.13 && !talk;
    const fk=JSON.stringify([c.mk,c.face,c.brow,c.bmess,c.bdef,c.beard,c.skin,c.eye,c.age,blink])+(talk?Math.round(t*20):'');
    if(K.face!==fk){ K.face=fk; paintFace(c, talk?t:(blink?0:1), talk); }
    if(K.skin!==c.skin){ K.skin=c.skin; G3.skinM.color.set(c.skin); }
  } else {
    if(K.hands!==c.skin || !G3.nails){ K.hands=c.skin; buildHands(c); }
    paintNails(c);
  }
  K.client=c;
  if(G3.chair) G3.chair.visible = Math.cos(CAM3.cab.yaw*D2R)>-.2;   // la silla no tapa cuando se mira de atrás
  placeCam(); RD.render(SC, CAMERA);
}
function pick3D(px, py, W, H){
  if(!R3.ok) return null;
  const z=zone(), r=RAY(); r.setFromCamera(new THREE.Vector2(px/W*2-1, -(py/H)*2+1), CAMERA);
  if(z==='manos'){
    const hits=r.intersectObjects(G3.hands.children, true); const h=hits[0]; if(!h) return null;
    return {zone:'manos', x:h.point.x, y:-h.point.z, front:true};
  }
  const objs=[]; G3.head.traverse(o=>{ if(o.isMesh && o.userData.k) objs.push(o); });
  const hits=r.intersectObjects(objs, false); if(!hits.length) return null;
  const T=TOOLS[UI.tool]||{};
  if(T.on==='cara'){ const f=hits.find(h=>h.object.userData.k==='cara'); if(!f) return null; return {zone:'cab', x:f.point.x, y:f.point.y, front:true}; }
  const p=hits[0].point; return {zone:'cab', x:p.x, y:p.y, front:p.z>=0, p3:[p.x,p.y,p.z]};
}
function project3D(p, z){
  if(!R3.ok || z!==zone()) return null;
  const v = z==='manos' ? new THREE.Vector3(p[0],.08,-p[1]) : Math.abs(p[2])===1 ? new THREE.Vector3(...onHead(p[0],p[1],1.05).map((v,i)=>i===2?v*p[2]:v)) : new THREE.Vector3(p[0],p[1],p[2]);
  v.project(CAMERA); if(v.z>1) return null;
  const st=$('#stage'); return [(v.x+1)/2*st.clientWidth, (1-v.y)/2*st.clientHeight];
}
function orbitStart(e){ if(!R3.ok) return; const k=camOf(); R3.orbit={x:e.clientX, y:e.clientY, yaw:k.yaw, pitch:k.pitch}; try{ $('#stage').setPointerCapture(e.pointerId); }catch(_){} }
function orbitMove(e){ const o=R3.orbit; if(!o) return; const k=camOf(); k.yaw=o.yaw-(e.clientX-o.x)*.4; k.pitch=clamp(o.pitch+(e.clientY-o.y)*.3, zone()==='manos'?15:-30, 80); }
function orbitEnd(){ if(R3.orbit){ R3.orbit=null; store('salon_cam3', CAM3); } }
function cam3(k, d){
  const c=camOf();
  if(k==='reset'){ Object.assign(c, zone()==='manos' ? {yaw:0,pitch:60,dist:6.3} : {yaw:0,pitch:6,dist:6.4}); }
  else if(k==='zoom') c.dist=clamp(c.dist*(d>0?.88:1.13), 2.6, 11);
  else if(k==='turn') c.yaw+=d*45;
  store('salon_cam3', CAM3);
}
