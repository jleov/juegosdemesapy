'use strict';
/* =====================================================================
   Billar PY — la sala en 3D: piso de tablas, alfombra, paredes, cartel,
   lámpara de bronce, taquera, banquetas y los detalles de la mesa.
   Es solo decorado: no toca reglas ni la física.
   ===================================================================== */
function salaTex(w, h, draw, rep){
  const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'), w, h);
  const t=new THREE.CanvasTexture(c); t.anisotropy=4;
  if(rep){ t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
// madera con vetas
function woodTex(base, dark, rep){
  return salaTex(256, 256, (g,w,h)=>{ g.fillStyle=base; g.fillRect(0,0,w,h);
    for(let i=0;i<80;i++){ const y=Math.random()*h; g.strokeStyle=`rgba(${dark},${.05+Math.random()*.15})`; g.lineWidth=.6+Math.random()*2.4; g.beginPath(); g.moveTo(0,y); g.bezierCurveTo(w*.3, y+(Math.random()-.5)*14, w*.7, y+(Math.random()-.5)*14, w, y+(Math.random()-.5)*6); g.stroke(); }
    for(let i=0;i<5;i++){ const x=Math.random()*w, y=Math.random()*h; g.strokeStyle=`rgba(${dark},.22)`; g.lineWidth=1; for(let r=2;r<9;r+=2.2){ g.beginPath(); g.ellipse(x,y,r*2.2,r,0,0,7); g.stroke(); } }
  }, rep);
}
// lo que se refleja en las bolas: la sala oscura con las lámparas arriba
function salaEnvTex(){
  const t=salaTex(512, 256, (g,w,h)=>{
    const gr=g.createLinearGradient(0,0,0,h); gr.addColorStop(0,'#120c08'); gr.addColorStop(.45,'#2c1c10'); gr.addColorStop(.62,'#123221'); gr.addColorStop(1,'#061a10'); g.fillStyle=gr; g.fillRect(0,0,w,h);
    for(let k=0;k<6;k++){ const x=(k+.5)/6*w, y=h*.1, r=30, g2=g.createRadialGradient(x,y,0,x,y,r); g2.addColorStop(0,'rgba(255,246,220,1)'); g2.addColorStop(.4,'rgba(255,225,170,.5)'); g2.addColorStop(1,'rgba(255,225,170,0)'); g.fillStyle=g2; g.fillRect(x-r,y-r,r*2,r*2); }
    for(const [x,c] of [[70,'255,62,165'],[300,'255,200,120'],[430,'120,200,255']]){ const g2=g.createRadialGradient(x,h*.42,0,x,h*.42,34); g2.addColorStop(0,`rgba(${c},.55)`); g2.addColorStop(1,`rgba(${c},0)`); g.fillStyle=g2; g.fillRect(x-34,h*.42-34,68,68); }
  });
  t.mapping=THREE.EquirectangularReflectionMapping; return t;
}
function sala3D(T, scene, mobile, o){
  const fy=o.floorY, G=new T.Group(); scene.add(G);
  const std=(p)=>new T.MeshStandardMaterial(p), lam=(p)=>new T.MeshLambertMaterial(p);
  const box=(w,h,d,x,y,z,m,sh)=>{ const k=new T.Mesh(new T.BoxGeometry(w,h,d), m); k.position.set(x,y,z); if(sh){ k.castShadow=true; k.receiveShadow=true; } G.add(k); return k; };
  const cyl=(rt,rb,h,x,y,z,m,seg)=>{ const k=new T.Mesh(new T.CylinderGeometry(rt,rb,h,seg||16), m); k.position.set(x,y,z); G.add(k); return k; };
  const brass=std({color:0xc9a23a, metalness:.85, roughness:.3}), chrome=std({color:0xdfe5ea, metalness:.9, roughness:.2}), dark=std({color:0x15100c, roughness:.8});
  /* ---------- piso de tablas y alfombra ---------- */
  const floorT=salaTex(512, 512, (g,w,h)=>{ g.fillStyle='#5a3920'; g.fillRect(0,0,w,h);
    for(let r=0;r<8;r++){ const y=r*64, off=(r%2)*128; for(let c=-1;c<3;c++){ const x=c*256+off, t=30+Math.random()*26; g.fillStyle=`rgb(${70+t},${44+t*.6|0},${24+t*.3|0})`; g.fillRect(x+1, y+1, 254, 62);
        for(let i=0;i<9;i++){ g.strokeStyle=`rgba(30,14,4,${.06+Math.random()*.12})`; g.lineWidth=.6+Math.random()*1.6; const yy=y+4+Math.random()*56; g.beginPath(); g.moveTo(x,yy); g.bezierCurveTo(x+80,yy+(Math.random()-.5)*8,x+170,yy+(Math.random()-.5)*8,x+256,yy); g.stroke(); } } }
    g.fillStyle='rgba(10,5,2,.55)'; for(let r=0;r<=8;r++) g.fillRect(0, r*64-1, w, 2);
  }, [9,9]);
  const floor=new T.Mesh(new T.PlaneGeometry(1900,1900), std({map:floorT, roughness:.55, metalness:.05})); floor.rotation.x=-Math.PI/2; floor.position.y=fy; floor.receiveShadow=true; G.add(floor);
  const rugT=salaTex(512, 320, (g,w,h)=>{ g.fillStyle='#571321'; g.fillRect(0,0,w,h);
    for(let i=0;i<9000;i++){ g.fillStyle=`rgba(${Math.random()<.5?'0,0,0':'255,190,170'},.06)`; g.fillRect(Math.random()*w, Math.random()*h, 2, 2); }
    g.strokeStyle='#d8b25e'; g.lineWidth=6; g.strokeRect(14,14,w-28,h-28); g.lineWidth=2; g.strokeRect(26,26,w-52,h-52);
    g.strokeStyle='#0038a8'; g.lineWidth=3; g.strokeRect(34,34,w-68,h-68);
    // ñandutí en el medio y en las esquinas
    const ros=(x,y,R)=>{ g.strokeStyle='rgba(240,214,150,.75)'; g.lineWidth=1.4; for(const r of [1,.72,.44,.18]){ g.beginPath(); g.arc(x,y,R*r,0,7); g.stroke(); } for(let a=0;a<16;a++){ const t=a/16*Math.PI*2; g.beginPath(); g.moveTo(x,y); g.lineTo(x+Math.cos(t)*R, y+Math.sin(t)*R); g.stroke(); } g.setLineDash([3,4]); g.lineWidth=4; g.beginPath(); g.arc(x,y,R*.58,0,7); g.stroke(); g.setLineDash([]); };
    ros(w/2,h/2,96); for(const [x,y] of [[70,70],[w-70,70],[70,h-70],[w-70,h-70]]) ros(x,y,30);
  });
  const rug=new T.Mesh(new T.PlaneGeometry(TL+190, TW+170), std({map:rugT, roughness:1})); rug.rotation.x=-Math.PI/2; rug.position.y=fy+.4; rug.receiveShadow=true; G.add(rug);
  /* ---------- paredes: zócalo de madera y arriba verde inglés ---------- */
  const WX=720, WZ=580, WH=440;
  const wallT=salaTex(512, 512, (g,w,h)=>{ g.fillStyle='#17392a'; g.fillRect(0,0,w,h*.64);
    for(let x=0;x<w;x+=32){ g.fillStyle='rgba(255,255,255,.025)'; g.fillRect(x,0,16,h*.64); }
    for(let i=0;i<60;i++){ g.fillStyle='rgba(216,178,94,.16)'; const x=(i%10)*51+25+((i/10|0)%2)*25, y=(i/10|0)*52+26; g.beginPath(); g.moveTo(x,y-7); g.lineTo(x+5,y); g.lineTo(x,y+7); g.lineTo(x-5,y); g.fill(); }
    g.fillStyle='#4a2a14'; g.fillRect(0,h*.64,w,h*.36); g.fillStyle='#6b3f1e'; g.fillRect(0,h*.64,w,10); g.fillStyle='#2a160a'; g.fillRect(0,h*.64+10,w,3);
    for(let x=0;x<w;x+=128){ g.fillStyle='#55311a'; g.fillRect(x+12,h*.64+26,104,h*.36-52); g.strokeStyle='#2a160a'; g.lineWidth=3; g.strokeRect(x+12,h*.64+26,104,h*.36-52); g.strokeStyle='rgba(255,220,170,.12)'; g.lineWidth=1.5; g.strokeRect(x+18,h*.64+32,92,h*.36-64); }
    g.fillStyle='#2a160a'; g.fillRect(0,h-12,w,12);
  });
  const wallM=(rep)=>{ const t=wallT.clone(); t.needsUpdate=true; t.wrapS=T.RepeatWrapping; t.repeat.set(rep,1); return lam({map:t}); };
  for(const [w,x,z,ry] of [[WX*2,0,-WZ,0],[WX*2,0,WZ,Math.PI],[WZ*2,-WX,0,Math.PI/2],[WZ*2,WX,0,-Math.PI/2]]){ const m=new T.Mesh(new T.PlaneGeometry(w, WH), wallM(Math.round(w/260))); m.position.set(x, fy+WH/2, z); m.rotation.y=ry; G.add(m); }
  const ceil=new T.Mesh(new T.PlaneGeometry(WX*2, WZ*2), lam({color:0x120c08})); ceil.rotation.x=Math.PI/2; ceil.position.y=fy+WH; G.add(ceil);
  /* ---------- cartel luminoso, bandera, cuadros y taquera ---------- */
  const neonT=salaTex(1024, 320, (g,w,h)=>{ g.clearRect(0,0,w,h); g.textAlign='center'; g.textBaseline='middle'; g.font='900 150px system-ui,sans-serif';
    for(const [b,a] of [[46,.5],[22,.8],[8,1]]){ g.shadowColor='#ff3ea5'; g.shadowBlur=b; g.strokeStyle=`rgba(255,120,200,${a})`; g.lineWidth=8; g.strokeText('BILLAR', w/2-130, h/2); }
    g.strokeStyle='#fff'; g.lineWidth=3; g.shadowBlur=0; g.strokeText('BILLAR', w/2-130, h/2);
    for(const [b,a] of [[40,.5],[16,.9]]){ g.shadowColor='#33d6ff'; g.shadowBlur=b; g.strokeStyle=`rgba(140,230,255,${a})`; g.lineWidth=8; g.strokeText('PY', w/2+330, h/2); }
    g.strokeStyle='#fff'; g.lineWidth=3; g.shadowBlur=0; g.strokeText('PY', w/2+330, h/2);
    g.shadowColor='#ffd54a'; g.shadowBlur=18; g.strokeStyle='#ffe48a'; g.lineWidth=5; g.strokeRect(24,24,w-48,h-48);
  });
  const neon=new T.Mesh(new T.PlaneGeometry(300, 94), new T.MeshBasicMaterial({map:neonT, transparent:true, depthWrite:false})); neon.position.set(0, fy+290, -WZ+3); G.add(neon);
  box(316, 106, 2, 0, fy+290, -WZ+1, lam({color:0x0c0806}));
  const nl=new T.PointLight(0xff5ab0, .55, 700, 1.6); nl.position.set(0, fy+270, -WZ+80); G.add(nl);
  const frame=(w,h,x,y,z,ry,tex)=>{ const g2=new T.Group(); g2.position.set(x,y,z); g2.rotation.y=ry; G.add(g2);
    const f=new T.Mesh(new T.BoxGeometry(w+10, h+10, 3), std({color:0x3a2010, roughness:.5})); g2.add(f);
    const p=new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshLambertMaterial({map:tex})); p.position.z=1.7; g2.add(p); };
  frame(120, 78, -330, fy+250, -WZ+3, 0, salaTex(240,156,(g,w,h)=>{ g.fillStyle='#d52b1e'; g.fillRect(0,0,w,h/3); g.fillStyle='#fff'; g.fillRect(0,h/3,w,h/3); g.fillStyle='#0038a8'; g.fillRect(0,2*h/3,w,h/3); g.strokeStyle='#1b1b1b'; g.lineWidth=2; g.beginPath(); g.arc(w/2,h/2,17,0,7); g.stroke(); g.fillStyle='#f2c14e'; g.beginPath(); g.arc(w/2,h/2,7,0,7); g.fill(); }));
  frame(90, 90, 330, fy+250, -WZ+3, 0, salaTex(180,180,(g,w,h)=>{ g.fillStyle='#efe6cf'; g.fillRect(0,0,w,h); const gr=g.createRadialGradient(72,70,6,90,90,62); gr.addColorStop(0,'#666'); gr.addColorStop(1,'#050505'); g.fillStyle=gr; g.beginPath(); g.arc(90,90,62,0,7); g.fill(); g.fillStyle='#fff'; g.beginPath(); g.arc(90,82,26,0,7); g.fill(); g.fillStyle='#111'; g.font='900 40px Arial'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('8',90,84); }));
  frame(110, 76, -WX+3, fy+250, 120, Math.PI/2, salaTex(220,152,(g,w,h)=>{ g.fillStyle='#10301f'; g.fillRect(0,0,w,h); g.strokeStyle='rgba(240,214,150,.9)'; g.lineWidth=1.3; for(const r of [64,46,28,12]){ g.beginPath(); g.arc(w/2,h/2,r,0,7); g.stroke(); } for(let a=0;a<20;a++){ const t=a/20*Math.PI*2; g.beginPath(); g.moveTo(w/2,h/2); g.lineTo(w/2+Math.cos(t)*64, h/2+Math.sin(t)*64); g.stroke(); } }));
  // taquera en la pared de la derecha
  { const rx=WX-4, ry=fy+150, wood=std({map:woodTex('#6b3519','30,12,4'), roughness:.5});
    box(4, 16, 150, rx, ry+62, -90, wood); box(6, 8, 150, rx-3, ry-52, -90, wood); box(3, 150, 160, rx+1, ry+5, -90, lam({color:0x2a160a}));
    for(let k=0;k<6;k++){ const z=-150+k*24; const c1=cyl(.9, 1.5, 128, rx-5, ry+8, z, std({color:0xe9c99a, roughness:.5}), 10); c1.rotation.z=.03; cyl(1.5, 1.9, 44, rx-5, ry-54+22, z, std({color:[0x2b1408,0x0d3b22,0x5a1420][k%3], roughness:.4}), 10); } }
  // estante con el triángulo y las tizas
  { const zx=-WZ+10; box(120, 4, 20, 420, fy+150, zx, std({map:woodTex('#6b3519','30,12,4'), roughness:.5}));
    const tri=new T.Mesh(new T.TorusGeometry(15, 1.3, 6, 3), std({color:0x8a5a2b, roughness:.5})); tri.position.set(400, fy+166, zx+2); tri.rotation.z=Math.PI/2; G.add(tri);
    for(let k=0;k<3;k++) box(4, 4, 4, 440+k*8, fy+154, zx, std({color:0x2f6fe0, roughness:.9})); }
  /* ---------- banquetas y mesita con el tereré ---------- */
  const seatM=std({color:0x8a1c1c, roughness:.6});
  for(const [x,z] of [[-420,-470],[-340,-490],[-500,-430],[470,300],[520,220]]){ cyl(17, 17, 6, x, fy+62, z, seatM, 20).castShadow=true; cyl(2, 2, 60, x, fy+30, z, chrome, 10); cyl(14, 16, 3, x, fy+1.5, z, chrome, 20); const fr=new T.Mesh(new T.TorusGeometry(11, 1, 6, 20), chrome); fr.rotation.x=Math.PI/2; fr.position.set(x, fy+24, z); G.add(fr); }
  { const x=-420, z=-400; cyl(34, 34, 4, x, fy+78, z, std({map:woodTex('#6b3519','30,12,4'), roughness:.45}), 24).castShadow=true; cyl(3, 3, 76, x, fy+38, z, dark, 10); cyl(20, 24, 4, x, fy+2, z, dark, 20);
    cyl(5.5, 4, 13, x+8, fy+86.5, z-4, std({color:0x5e3b1e, roughness:.6}), 14); cyl(5.8, 5.8, 1.5, x+8, fy+93, z-4, chrome, 14); const bo=cyl(.5, .5, 16, x+10, fy+98, z-4, chrome, 6); bo.rotation.z=-.3;
    cyl(7, 6, 22, x-12, fy+91, z+6, std({color:0xd52b1e, roughness:.4}), 14); cyl(4, 6.5, 5, x-12, fy+104.5, z+6, std({color:0xf4f4f4, roughness:.4}), 14); }
  /* ---------- lámpara de bronce sobre la mesa ---------- */
  box(190, 2.4, 2.4, 0, 172, 0, brass);
  for(const x of [-80, 80]) cyl(.6, .6, fy+WH-172, x, 172+(fy+WH-172)/2, 0, brass, 6);
  for(const x of [-70, 0, 70]){ cyl(.8, .8, 16, x, 163, 0, brass, 6); cyl(4, 9.6, 4, x, 157.5, 0, brass, 20);
    const inner=new T.Mesh(new T.CylinderGeometry(8.6, 21.4, 13.6, 24, 1, true), new T.MeshBasicMaterial({color:0xfff0c4, side:T.BackSide})); inner.position.set(x, 150, 0); G.add(inner);
    const rim=new T.Mesh(new T.TorusGeometry(22, .7, 6, 28), brass); rim.rotation.x=Math.PI/2; rim.position.set(x, 143, 0); G.add(rim);
    // el haz de luz que baja a la mesa
    const cone=new T.Mesh(new T.CylinderGeometry(20, 74, 138, 28, 1, true), new T.MeshBasicMaterial({color:0xfff0c4, transparent:true, opacity:.035, depthWrite:false, side:T.DoubleSide, blending:T.AdditiveBlending})); cone.position.set(x, 74, 0); cone.renderOrder=5; G.add(cone); }
  /* ---------- detalles de la mesa: moldura de bronce, patas con base y tizas ---------- */
  const tb=o.top-o.H, ow=TL+2*RW, od=TW+2*RW;
  box(ow+1.2, 1.6, od+1.2, 0, tb-.2, 0, brass, true);
  box(ow-4, 1.2, od-4, 0, tb-34, 0, brass);
  for(const sx of [-1,1]) for(const sz of [-1,1]){ const x=sx*(TL/2-10), z=sz*(TW/2-6); box(17, 3, 17, x, fy+1.5, z, brass, true); box(15.5, 2, 15.5, x, tb-36, z, brass); }
  // nombre en el frente de la mesa
  const plate=salaTex(256, 64, (g,w,h)=>{ const gr=g.createLinearGradient(0,0,0,h); gr.addColorStop(0,'#e9c867'); gr.addColorStop(1,'#a8811f'); g.fillStyle=gr; g.fillRect(0,0,w,h); g.strokeStyle='#5a4208'; g.lineWidth=4; g.strokeRect(4,4,w-8,h-8); g.fillStyle='#3a2a05'; g.font='900 30px system-ui,sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('BILLAR · PY', w/2, h/2+2); });
  for(const sz of [-1,1]){ const p=new T.Mesh(new T.PlaneGeometry(40, 10), std({map:plate, metalness:.6, roughness:.35})); p.position.set(0, tb-17, sz*(od/2-3+.2)); if(sz<0) p.rotation.y=Math.PI; G.add(p); }
  const chalkM=std({color:0x2f6fe0, roughness:.95});
  box(2.3, 2.3, 2.3, 34, o.top+1.15, TW/2+4.6+o.wW/2, chalkM, true).rotation.y=.4; box(2.3, 2.3, 2.3, -TL/2-4.6-o.wW/2, o.top+1.15, -18, chalkM, true).rotation.y=.9;
  return G;
}
