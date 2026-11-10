'use strict';
/* =====================================================================
   Ludo PY — vista 3D de verdad (three.js, como el ajedrez): el tablero
   pintado como textura sobre un marco de madera, peones torneados con
   luz y sombra, cámara que se gira arrastrando y se acerca pellizcando.
   Lee el mismo estado (V) y las mismas animaciones (PZ.anim) que el 2D.
   ===================================================================== */
const L3 = (function(){
  const R={ok:false, key:null, pcs:{}, ghosts:[], rings:[], hops:{}};
  const CAM=Object.assign({yaw:0, pitch:55, zoom:1}, load('ludo_cam3')||{});
  const saveCam = () => store('ludo_cam3', CAM);
  // perfil del peón (radio, altura) que se tornea; una casilla mide 1
  const PAWN=[[0,0],[.36,0],[.37,.04],[.35,.08],[.29,.11],[.27,.14],[.19,.19],[.14,.30],[.12,.42],[.11,.50],[.21,.53],[.21,.57],[.10,.60],[0,.60]];
  let GEO=null;
  const MATS={};
  function mat(hex){ return MATS[hex] || (MATS[hex]=new THREE.MeshStandardMaterial({color:hex, roughness:.28, metalness:.12})); }

  function init(){
    if(R.ok) return true;
    if(!window.THREE){ toast('No se pudo cargar el 3D en este aparato.'); return false; }
    const cv=$('#c3d');
    try{ R.renderer=new THREE.WebGLRenderer({canvas:cv, antialias:true}); }catch(e){ toast('Este aparato no tiene 3D (WebGL).'); return false; }
    R.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio||1));
    R.renderer.shadowMap.enabled=true; R.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    R.scene=new THREE.Scene(); R.scene.background=new THREE.Color('#13204d');
    R.cam=new THREE.PerspectiveCamera(40, 1, .1, 300);
    R.ray=new THREE.Raycaster();
    GEO={
      pawn:new THREE.LatheGeometry(PAWN.map(([r,y])=>new THREE.Vector2(r,y)), 36),
      head:new THREE.SphereGeometry(.19, 28, 20),
      band:new THREE.TorusGeometry(.2, .028, 10, 36),
      ring:new THREE.TorusGeometry(.44, .055, 10, 40),
      ghost:new THREE.CylinderGeometry(.36, .36, .05, 32),
    };
    R.white=new THREE.MeshStandardMaterial({color:'#ffffff', roughness:.35});
    R.gold=new THREE.MeshStandardMaterial({color:'#ffd54a', emissive:'#b07800', emissiveIntensity:.8, roughness:.3, metalness:.4});
    wire(cv);
    R.ok=true; resize();
    let last=performance.now();
    const loop=now=>{ const dt=Math.min(.05,(now-last)/1000); last=now; if(R.ok && VIEW.mode==='3d' && $('#game').classList.contains('on') && V && V.N) draw(dt, now); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    return true;
  }
  function clearScene(){
    const sc=R.scene; while(sc.children.length) sc.remove(sc.children[0]);
    R.pcs={}; R.ghosts=[]; R.rings=[]; R.hops={};
  }
  // arma la mesa, el marco y el tablero (cuando cambia la cantidad de colores o el lugar del jugador)
  function build(L, colors){
    clearScene();
    const sc=R.scene, E=L.E;
    sc.add(new THREE.HemisphereLight(0xffffff, 0x2a2440, .6));
    const dl=new THREE.DirectionalLight(0xffffff, .75); dl.position.set(E*.5, E*1.8, E*.9); dl.castShadow=true;
    dl.shadow.mapSize.set(2048,2048); Object.assign(dl.shadow.camera,{left:-E-1,right:E+1,top:E+1,bottom:-E-1,near:1,far:E*5}); sc.add(dl);
    [[0,E,-E*1.4],[0,E,E*1.4]].forEach(([x,y,z])=>{ const r=new THREE.DirectionalLight(0xdfe8ff, .25); r.position.set(x,y,z); sc.add(r); });
    // la mesa (paño azul, como la bandera) y el marco de madera
    const mesa=new THREE.Mesh(new THREE.CircleGeometry(E*3.2, 64), new THREE.MeshStandardMaterial({color:'#1b2f6e', roughness:.95}));
    mesa.rotation.x=-Math.PI/2; mesa.position.y=-.42; mesa.receiveShadow=true; sc.add(mesa);
    const wood=new THREE.MeshStandardMaterial({color:'#7a4320', roughness:.55, metalness:.05});
    const marco = L.N===6 ? new THREE.Mesh(new THREE.CylinderGeometry(E+.35, E+.45, .42, 72), wood) : new THREE.Mesh(new THREE.BoxGeometry(2*E+.8, .42, 2*E+.8), wood);
    marco.position.y=-.21; marco.castShadow=true; marco.receiveShadow=true; sc.add(marco);
    // el tablero: el mismo dibujo del 2D, pintado como textura
    const cv=document.createElement('canvas'); cv.width=cv.height=2048;
    const tex=new THREE.CanvasTexture(cv); tex.anisotropy=8;
    const img=new Image();
    img.onload=()=>{ const g=cv.getContext('2d'); g.drawImage(img,0,0,2048,2048); tex.needsUpdate=true; };
    img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(boardSVG(L.N, L.rot, colors).replace('<svg ','<svg width="2048" height="2048" '));
    const bm=new THREE.MeshStandardMaterial({map:tex, roughness:.45});
    const plane = L.N===6 ? new THREE.Mesh(new THREE.CircleGeometry(E, 96), bm) : new THREE.Mesh(new THREE.PlaneGeometry(2*E, 2*E), bm);
    plane.rotation.x=-Math.PI/2; plane.position.y=.005; plane.receiveShadow=true; sc.add(plane);
    R.E=E; resize();
  }
  function makePawn(hex){
    const g=new THREE.Group(), m=mat(hex);
    const body=new THREE.Mesh(GEO.pawn, m); body.castShadow=true; body.receiveShadow=true; g.add(body);
    const head=new THREE.Mesh(GEO.head, m); head.position.y=.74; head.castShadow=true; g.add(head);
    const band=new THREE.Mesh(GEO.band, R.white); band.rotation.x=Math.PI/2; band.position.y=.555; g.add(band);   // el cuellito blanco
    g.scale.setScalar(1.3);
    return g;
  }
  // a dónde tiene que ir cada ficha (con las fichas apiladas un poco corridas, como en el 2D)
  function targets(L){
    const out=[], groups={};
    V.players.forEach(p=>(p.pz||[]).forEach((x,i)=>{ const k=L.cellKey(p.arm,x,i); (groups[k]=groups[k]||[]).push(p.id+'-'+i); }));
    V.players.forEach(p=>(p.pz||[]).forEach((x,i)=>{
      const key=p.id+'-'+i, an=PZ.anim[key];
      let xy;
      if(an) xy=an.cur;
      else { xy=L.pos(p.arm,x,i,p.pz.length); const grp=groups[L.cellKey(p.arm,x,i)]; if(grp.length>1){ const o=stackOff(grp.indexOf(key), grp.length); xy=[xy[0]+o[0]*1.3, xy[1]+o[1]*1.3]; } }
      out.push({key, p, i, xy, fly:!!(an && an.fly)});
    }));
    return out;
  }
  function sync(L){
    const used={}; V.players.forEach(p=>used[p.arm]=1);
    const C=colsOf(V.N), colors=C.map((c,k)=>used[k]?c:null);
    const key=L.N+':'+L.rot+':'+Object.keys(used).join(',');
    if(R.key!==key){ R.key=key; build(L, colors); }
  }
  function draw(dt, now){
    const L=curLayout(); if(!L) return;
    sync(L);
    const mm=myMoves(), seen={};
    for(const t of targets(L)){
      seen[t.key]=1;
      let o=R.pcs[t.key];
      if(!o){ o=makePawn(colOf(t.p).hex); o.userData={pid:t.p.id, idx:t.i}; o.position.set(t.xy[0],0,t.xy[1]); R.scene.add(o); R.pcs[t.key]=o; }
      // saltito de casilla en casilla
      const h=R.hops[t.key];
      if(!h || h.tx!==t.xy[0] || h.tz!==t.xy[1]){
        const far=Math.hypot(o.position.x-t.xy[0], o.position.z-t.xy[1]);
        R.hops[t.key]={tx:t.xy[0], tz:t.xy[1], fx:o.position.x, fz:o.position.z, t0:now, dur: t.fly ? 520 : far>2.2 ? 380 : 160, hi: t.fly ? 1.6 : far>.1 ? .55 : 0};
      }
      const g=R.hops[t.key], k=Math.min(1,(now-g.t0)/g.dur), e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
      o.position.x=g.fx+(g.tx-g.fx)*e; o.position.z=g.fz+(g.tz-g.fz)*e;
      const can = mm.some(m=>m.pid===t.p.id && m.idx===t.i) && !Object.keys(PZ.anim).length;
      o.position.y = Math.sin(k*Math.PI)*g.hi + (can ? .12+Math.sin(now/220)*.06 : 0);
      o.userData.can=can;
    }
    for(const k in R.pcs) if(!seen[k]){ R.scene.remove(R.pcs[k]); delete R.pcs[k]; delete R.hops[k]; }
    // aros dorados debajo de las que se pueden mover, y las casillas a donde llegarían
    R.rings.forEach(r=>R.scene.remove(r)); R.rings=[];
    R.ghosts.forEach(r=>R.scene.remove(r)); R.ghosts=[];
    if(!Object.keys(PZ.anim).length){
      for(const k in R.pcs){ const o=R.pcs[k]; if(!o.userData.can) continue;
        const r=new THREE.Mesh(GEO.ring, R.gold); r.rotation.x=Math.PI/2; r.position.set(o.position.x,.04,o.position.z); r.scale.setScalar(1+Math.sin(now/200)*.08); R.scene.add(r); R.rings.push(r); }
      distinctMoves(mm).forEach(m=>{ const ow=V.players.find(q=>q.id===m.pid); if(!ow) return;
        const [x,y]=L.pos(ow.arm, m.to, m.idx, ow.pz.length);
        const gm=new THREE.Mesh(GEO.ghost, new THREE.MeshStandardMaterial({color:colOf(ow).hex, transparent:true, opacity:.45+Math.sin(now/200)*.15, emissive:colOf(ow).hex, emissiveIntensity:.4}));
        gm.position.set(x,.03,y); gm.userData={move:m}; R.scene.add(gm); R.ghosts.push(gm); });
    }
    // cámara
    const yaw=CAM.yaw*Math.PI/180, pit=Math.max(18,Math.min(89,CAM.pitch))*Math.PI/180, d=(R.dist||20)/CAM.zoom;
    R.cam.position.set(d*Math.sin(yaw)*Math.cos(pit), d*Math.sin(pit), d*Math.cos(yaw)*Math.cos(pit));
    R.cam.lookAt(0,0,0);
    R.renderer.render(R.scene, R.cam);
    labels();
  }
  // los nombres y caras de cada casa siguen a la cámara
  const VEC = window.THREE ? new THREE.Vector3() : null;
  function labels(){
    const cv=$('#c3d'), w=cv.clientWidth, h=cv.clientHeight;
    $$('#ov3 .ylab').forEach(d=>{
      VEC.set(+d.dataset.x, 1.1, +d.dataset.y).project(R.cam);
      d.style.left=((VEC.x+1)/2*w)+'px'; d.style.top=((1-VEC.y)/2*h)+'px';
      d.style.display = VEC.z<1 ? '' : 'none';
    });
  }
  function resize(){
    if(!R.ok) return;
    const st=$('#stage'), w=st.clientWidth, h=st.clientHeight; if(!w||!h) return;
    R.renderer.setSize(w,h,false); R.cam.aspect=w/h; R.cam.updateProjectionMatrix();
    const fov=R.cam.fov*Math.PI/180, hfov=2*Math.atan(Math.tan(fov/2)*R.cam.aspect), half=((R.E||7.5)+.6)*.98;
    R.dist=Math.max(half/Math.tan(hfov/2), half*1.05/Math.tan(fov/2));
  }
  function view(){
    const on=VIEW.mode==='3d';
    $('#c3d').style.display = on ? 'block' : 'none';
    if(on){ resize(); R.key=null; }
  }
  function wire(cv){
    const pts=new Map(); let drag=null, pinch=null;
    cv.addEventListener('pointerdown', e=>{ try{ cv.setPointerCapture(e.pointerId); }catch(err){} pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(pts.size===1) drag={x:e.clientX, y:e.clientY, yaw:CAM.yaw, pitch:CAM.pitch, moved:false};
      if(pts.size===2){ const [a,b]=[...pts.values()]; pinch={d:Math.hypot(a.x-b.x,a.y-b.y), z:CAM.zoom}; drag=null; } });
    cv.addEventListener('pointermove', e=>{ if(!pts.has(e.pointerId)) return; pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(pinch && pts.size===2){ const [a,b]=[...pts.values()]; CAM.zoom=Math.max(.6,Math.min(2.6, pinch.z*Math.hypot(a.x-b.x,a.y-b.y)/pinch.d)); return; }
      if(!drag) return; const dx=e.clientX-drag.x, dy=e.clientY-drag.y;
      if(Math.abs(dx)+Math.abs(dy)>8) drag.moved=true;
      if(drag.moved){ CAM.yaw=drag.yaw-dx*.3; CAM.pitch=Math.max(18,Math.min(89, drag.pitch+dy*.25)); } });
    const up=e=>{ if(!pts.has(e.pointerId)) return; pts.delete(e.pointerId);
      if(drag && !drag.moved && pts.size===0) pick(e);
      if(pts.size<2) pinch=null; if(pts.size===0){ drag=null; saveCam(); } };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', e=>{ pts.delete(e.pointerId); drag=null; pinch=null; });
    cv.addEventListener('wheel', e=>{ e.preventDefault(); CAM.zoom=Math.max(.6,Math.min(2.6, CAM.zoom*(e.deltaY<0?1.08:.93))); saveCam(); }, {passive:false});
  }
  function pick(e){
    const r=$('#c3d').getBoundingClientRect();
    R.ray.setFromCamera(new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1), R.cam);
    const gh=R.ray.intersectObjects(R.ghosts)[0];
    if(gh) return doMoveUI(gh.object.userData.move);
    const objs=[]; for(const k in R.pcs) R.pcs[k].traverse(o=>{ if(o.isMesh) objs.push(o); });
    const hp=R.ray.intersectObjects(objs)[0];
    if(hp){ let o=hp.object; while(o.parent && o.userData.pid==null) o=o.parent; if(o.userData.pid!=null) return pieceClick(o.userData.pid, o.userData.idx); }
    if(V && isMyTurn() && V.tp==='roll') diceClick();
  }
  function cam(k, d){
    if(k==='spin') CAM.yaw+=d;
    else if(k==='tilt') CAM.pitch=Math.max(18,Math.min(89, CAM.pitch-d*1.5));
    else if(k==='zoom') CAM.zoom=Math.max(.6,Math.min(2.6, CAM.zoom*(d>0?1.15:.87)));
    else if(k==='reset'){ CAM.yaw=0; CAM.pitch=55; CAM.zoom=1; }
    saveCam();
  }
  return {init, view, resize, cam, draw, R};
})();
window.L3 = L3;
