'use strict';
/* =====================================================================
   Salón de Belleza PY — dibujo 2D del cliente (cabeza de frente o de
   espaldas, y las manos). Se dibuja en las medidas del modelo (y para
   arriba). Lo usa la vista 2D, las fotos del espejo y la textura 3D de la cara.
   ===================================================================== */
const CAPE='#7b3fa6';
function ellP(ctx,x,y,rx,ry,rot){ ctx.beginPath(); ctx.ellipse(x,y,Math.abs(rx),Math.abs(ry),rot||0,0,Math.PI*2); }
function hairBase(c){
  let r=0,g=0,b=0,n=0; for(const h of c.hair){ if(h.L<.03) continue; const [x,y,z]=hexRgb(hairCol(h)); r+=x; g+=y; b+=z; n++; }
  return n ? rgbHex(r/n,g/n,b/n) : c.hair[0].col;
}
function hairCol(h){ let c=h.col; if(h.dirt>.05) c=mix(c,'#7d6a4a',h.dirt*.3); if(h.wet>.05) c=shade(c,-.28*h.wet); return c; }
const browCol = c => c.age==='mayor' ? '#8d8a85' : shade(c.orig.col,-.35);

/* ---------- pelo ---------- */
const HC=new Map();
function hairStrands(c){
  const key=c.st+JSON.stringify(c.hair);
  if(HC.has(key)) return HC.get(key);
  const list=[];
  for(let s=0;s<NSEC;s++) for(let j=0;j<NSTR;j++){
    const pts=strandPts(c,s,j); if(pts.length<2) continue;
    let z=0; for(const p of pts) z+=p[2]; z/=pts.length;
    list.push({s,j,pts,z});
  }
  if(HC.size>6) HC.clear(); HC.set(key, list); return list;
}
function strokeStrand(ctx, pts, from, to, col, w){
  if(to-from<1) return;
  ctx.strokeStyle=col; ctx.lineWidth=w; ctx.beginPath(); ctx.moveTo(pts[from][0]*VX, pts[from][1]);
  for(let i=from+1;i<=to;i++) ctx.lineTo(pts[i][0]*VX, pts[i][1]);
  ctx.stroke();
}
let VX=1;   // 1 de frente, -1 de espaldas (el dibujo ya está espejado, esto es para los puntos)
function drawStrand(ctx, c, st){
  const h=c.hair[st.s], pts=st.pts, n=pts.length-1;
  let col=hairCol(h); if(h.mech && h.mA>.05 && st.j%2===1) col=mix(col, h.mech, Math.min(1,h.mA)*.9);
  const tipFrom = h.tip && h.tA>.05 ? Math.floor(n*.58) : n;
  const tipCol = h.tip ? mix(col, h.tip, Math.min(1,h.tA)) : col;
  ctx.lineCap='round'; ctx.lineJoin='round';
  strokeStrand(ctx, pts, 0, n, shade(col,-.22), .13);
  strokeStrand(ctx, pts, 0, tipFrom, col, .1);
  if(tipFrom<n) strokeStrand(ctx, pts, tipFrom, n, tipCol, .1);
  if(h.shine>.2 || h.wet>.5){ ctx.globalAlpha=Math.min(.6,h.shine*.5+h.wet*.25); strokeStrand(ctx, pts, 1, Math.min(n, tipFrom), shade(col,.45), .02); ctx.globalAlpha=1; }
}
function drawFoam(ctx, c, list, front){
  for(const st of list){
    const h=c.hair[st.s]; if(h.foam<.05 || st.j%2) continue;
    if(front && st.z<-.2) continue;
    const n=Math.min(st.pts.length, 18);
    ctx.globalAlpha=Math.min(1,h.foam*1.3);
    for(let i=0;i<n;i+=3){ const p=st.pts[i], r=.04+hsh(st.s,st.j,i)*.05;
      ctx.fillStyle='#ffffff'; ellP(ctx,p[0]*VX+(hsh(i,st.s,1)-.5)*.08,p[1]+(hsh(i,st.j,2)-.5)*.08,r,r); ctx.fill();
      ctx.strokeStyle='#cfe6f5'; ctx.lineWidth=.008; ctx.stroke(); }
    ctx.globalAlpha=1;
  }
}
function drawTail(ctx, c, tp){
  const base=hairBase(c), mechs=c.hair.filter(h=>h.mech&&h.mA>.2), tips=c.hair.filter(h=>h.tip&&h.tA>.2);
  const mc=mechs.length>3?mechs[0].mech:null, tc=tips.length>5?tips[0].tip:null;
  ctx.lineCap='round'; ctx.lineJoin='round';
  if(tp.bun){
    const [x,y]=[tp.p[0]*VX,tp.p[1]];
    ctx.fillStyle=shade(base,-.3); ellP(ctx,x,y,tp.r*1.06,tp.r); ctx.fill();
    ctx.fillStyle=base; ellP(ctx,x,y,tp.r*.95,tp.r*.9); ctx.fill();
    ctx.strokeStyle=shade(base,-.35); ctx.lineWidth=.025;
    for(let k=0;k<3;k++){ ctx.beginPath(); ctx.arc(x,y,tp.r*(.3+k*.22),k,k+4.2); ctx.stroke(); }
    if(mc){ ctx.strokeStyle=mc; ctx.lineWidth=.03; ctx.beginPath(); ctx.arc(x,y,tp.r*.6,1,3); ctx.stroke(); }
    return;
  }
  const P=tp.pts, n=P.length-1; if(n<1) return;
  if(tp.braid){
    for(let i=0;i<n;i++){
      const a=P[i], b=P[i+1], dx=(b[0]-a[0])*VX, dy=b[1]-a[1], ang=Math.atan2(dy,dx), w=tp.w*(1-.45*i/n);
      const col = tc && i>n*.6 ? tc : (mc && i%3===1 ? mc : base), off=(i%2?1:-1)*w*.28;
      const mx=(a[0]*VX+b[0]*VX)/2-Math.sin(ang)*off, my=(a[1]+b[1])/2+Math.cos(ang)*off;
      ctx.fillStyle=shade(col,-.3); ellP(ctx,mx,my,w*.72,w*.42,ang+(i%2?.5:-.5)); ctx.fill();
      ctx.fillStyle=col; ellP(ctx,mx,my,w*.62,w*.33,ang+(i%2?.5:-.5)); ctx.fill();
    }
    const e=P[n]; ctx.fillStyle='#d61f8a'; ellP(ctx,e[0]*VX,e[1]+.02,.05,.035); ctx.fill();
    return;
  }
  for(let k=0;k<5;k++){
    const w=tp.w*(1-k*.17), col=k===4?shade(base,.25):k%2?shade(base,-.2):base;
    ctx.strokeStyle=tc&&k===0?mix(base,tc,.2):col; ctx.lineWidth=w; ctx.beginPath(); ctx.moveTo(P[0][0]*VX,P[0][1]);
    for(let i=1;i<=n;i++) ctx.lineTo(P[i][0]*VX+Math.sin(i*.6+k)*.015, P[i][1]);
    ctx.stroke();
  }
  if(tc){ ctx.strokeStyle=tc; ctx.lineWidth=tp.w*.7; ctx.beginPath(); const f=Math.floor(n*.6); ctx.moveTo(P[f][0]*VX,P[f][1]); for(let i=f+1;i<=n;i++) ctx.lineTo(P[i][0]*VX,P[i][1]); ctx.stroke(); }
  if(mc){ ctx.strokeStyle=mc; ctx.lineWidth=.025; ctx.beginPath(); ctx.moveTo(P[0][0]*VX+.03,P[0][1]); for(let i=1;i<=n;i++) ctx.lineTo(P[i][0]*VX+.03,P[i][1]); ctx.stroke(); }
  ctx.fillStyle='#d61f8a'; ellP(ctx,P[0][0]*VX,P[0][1],.08,.06); ctx.fill();
}

/* ---------- cuerpo y cabeza ---------- */
function drawBody(ctx, c){
  ctx.fillStyle=shade(c.skin,-.08); ctx.fillRect(-.3,-1.6,.6,.95);
  ctx.fillStyle='rgba(0,0,0,.12)'; ellP(ctx,0,-.82,.32,.12); ctx.fill();
  ctx.fillStyle=CAPE; ctx.beginPath(); ctx.moveTo(-.34,-1.38);
  ctx.bezierCurveTo(-.9,-1.5,-1.55,-1.7,-1.7,-2.15); ctx.lineTo(-1.82,-2.9); ctx.lineTo(1.82,-2.9); ctx.lineTo(1.7,-2.15);
  ctx.bezierCurveTo(1.55,-1.7,.9,-1.5,.34,-1.38); ctx.closePath(); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.12)'; for(let i=0;i<14;i++){ const x=-1.5+(i%7)*.5+(i>6?.25:0), y=i>6?-2.6:-2.1; ellP(ctx,x,y,.045,.045); ctx.fill(); }
  ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.moveTo(-.36,-1.34); ctx.quadraticCurveTo(0,-1.52,.36,-1.34); ctx.lineTo(.38,-1.44); ctx.quadraticCurveTo(0,-1.62,-.38,-1.44); ctx.closePath(); ctx.fill();
}
function drawEars(ctx, c){
  for(const sx of [-1,1]){ ctx.fillStyle=shade(c.skin,-.06); ellP(ctx,sx*.86,-.02,.11,.19); ctx.fill(); ctx.strokeStyle=shade(c.skin,-.25); ctx.lineWidth=.015; ellP(ctx,sx*.87,-.02,.06,.12); ctx.stroke(); }
}
function drawHeadShape(ctx, c, front){
  const g=ctx.createRadialGradient(-.2,.25,.1,0,0,1.15);
  g.addColorStop(0, shade(c.skin,.06)); g.addColorStop(.75, c.skin); g.addColorStop(1, shade(c.skin,-.18));
  ctx.fillStyle=front?g:c.skin; ellP(ctx,0,0,HEAD.sx,HEAD.sy); ctx.fill();
}
function drawCap(ctx, c, front){
  const top=c.hair.filter((h,s)=>{ const y=Math.abs(sec2yaw(s)); return front ? y<100 : y>80; });
  const amt=avg(top.map(h=>Math.min(1,h.L/.06)));
  if(amt<.02 && !(c.age==='mayor' && c.sex==='m')) return;
  ctx.save(); ellP(ctx,0,0,HEAD.sx*1.035,HEAD.sy*1.035); ctx.clip();
  ctx.beginPath();
  if(front){ ctx.moveTo(-1,-.08); ctx.lineTo(-.84,-.04); ctx.quadraticCurveTo(-.8,.36,-.6,.52); ctx.quadraticCurveTo(0,.74,.6,.52); ctx.quadraticCurveTo(.8,.36,.84,-.04); ctx.lineTo(1,-.08); ctx.lineTo(1,1.2); ctx.lineTo(-1,1.2); }
  else { ctx.moveTo(-1,-.62); ctx.quadraticCurveTo(0,-.78,1,-.62); ctx.lineTo(1,1.2); ctx.lineTo(-1,1.2); }
  ctx.closePath();
  ctx.globalAlpha = amt<.6 ? .35+amt*.5 : 1;
  ctx.fillStyle=hairBase(c); ctx.fill();
  if(amt<.6){ ctx.fillStyle=shade(hairBase(c),-.3); for(let i=0;i<120;i++){ const x=(hsh(i,1,3)-.5)*1.8, y=-.6+hsh(i,2,5)*1.7; ellP(ctx,x,y,.012,.012); ctx.fill(); } }
  ctx.globalAlpha=1; ctx.restore();
}

/* ---------- cara ---------- */
function drawFace(ctx, c, t, talk){
  const sk=c.skin, f=c.face, mk=c.mk, male=c.sex==='m';
  if(c.age==='mayor'){ ctx.strokeStyle=shade(sk,-.18); ctx.lineWidth=.012; for(const y of [.5,.58]){ ctx.beginPath(); ctx.moveTo(-.3,y); ctx.quadraticCurveTo(0,y+.03,.3,y); ctx.stroke(); }
    for(const sx of [-1,1]){ ctx.beginPath(); ctx.moveTo(sx*.2,-.3); ctx.quadraticCurveTo(sx*.29,-.42,sx*.25,-.55); ctx.stroke(); } }
  if(f.glow>.02){ ctx.globalAlpha=f.glow*.35; for(const [x,y] of [[-.45,-.15],[.45,-.15],[0,.5]]){ const g=ctx.createRadialGradient(x,y,0,x,y,.25); g.addColorStop(0,'#fff'); g.addColorStop(1,'rgba(255,255,255,0)'); ctx.fillStyle=g; ellP(ctx,x,y,.25,.25); ctx.fill(); } ctx.globalAlpha=1; }
  if(f.red>.02){ ctx.globalAlpha=f.red*.45; ctx.fillStyle='#e0414a'; ellP(ctx,0,-.65,.6,.35); ctx.fill(); ctx.globalAlpha=1; }
  // granitos
  for(const i of f.spots){ const [x,y]=SPOTS[i]; ctx.fillStyle='#d9534f'; ellP(ctx,x,y,.028,.028); ctx.fill(); ctx.fillStyle='#ffe9d0'; ellP(ctx,x+.006,y+.008,.009,.009); ctx.fill(); }
  // barba
  if(male && c.beard) drawBeard(ctx, c);
  // rubor
  for(let i=0;i<2;i++){ const a=Math.min(.85,mk.blA[i]*.45); if(a<.02) continue; const x=i?.47:-.47, g=ctx.createRadialGradient(x,-.22,0,x,-.22,.22+Math.max(0,mk.blA[i]-1)*.12);
    g.addColorStop(0,mk.bl); g.addColorStop(1,'rgba(255,255,255,0)'); ctx.globalAlpha=a; ctx.fillStyle=g; ellP(ctx,x,-.22,.34,.34); ctx.fill(); ctx.globalAlpha=1; }
  // nariz
  ctx.strokeStyle=shade(sk,-.22); ctx.lineWidth=.016; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(.035,.12); ctx.quadraticCurveTo(.08,-.08,.07,-.19); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-.09,-.22); ctx.quadraticCurveTo(-.06,-.27,-.02,-.25); ctx.moveTo(.09,-.22); ctx.quadraticCurveTo(.06,-.27,.02,-.25); ctx.stroke();
  // ojos y cejas
  const blink = (t%4.3)<.13 && !talk;
  for(let i=0;i<2;i++) drawEye(ctx, c, i, blink);
  // boca
  drawMouth(ctx, c, t, talk);
  if(male && c.beard) drawMustache(ctx, c);
  // mascarilla (arriba de todo menos ojos y boca)
  const M=f.mask, R={fr:[0,.55,.55,.2], mi:[-.47,-.22,.22,.22], md:[.47,-.22,.22,.22], na:[0,-.1,.12,.22], me:[0,-.8,.32,.15]};
  for(const k in R){ const a=M[k]; if(a<.02) continue; const [x,y,rx,ry]=R[k]; ctx.globalAlpha=Math.min(.9,a*.95); ctx.fillStyle='#8cc56a'; ellP(ctx,x,y,rx,ry); ctx.fill();
    ctx.fillStyle='#a7d98a'; for(let i=0;i<6;i++){ ellP(ctx,x+(hsh(i,k.length,7)-.5)*rx*1.4,y+(hsh(i,3,k.length)-.5)*ry*1.4,.02,.015); ctx.fill(); } ctx.globalAlpha=1; }
  if(f.pep) for(const x of [-.33,.33]){ ctx.fillStyle='#3f8f3a'; ellP(ctx,x,.05,.15,.15); ctx.fill(); ctx.fillStyle='#cdeaa8'; ellP(ctx,x,.05,.125,.125); ctx.fill(); ctx.fillStyle='#f3f7dc'; for(let k=0;k<6;k++){ const a=k*Math.PI/3; ellP(ctx,x+Math.cos(a)*.06,.05+Math.sin(a)*.06,.012,.02,a); ctx.fill(); } }
}
function drawEye(ctx, c, i, blink){
  const mk=c.mk, x=i?.33:-.33, sd=i?1:-1;
  if(!c.face.pep){
    if(mk.shA[i]>.02){ ctx.globalAlpha=Math.min(.85,mk.shA[i]*.7); ctx.fillStyle=mk.sh; ellP(ctx,x+sd*.01,.1,.17,.085); ctx.fill(); ctx.globalAlpha=1; }
    if(blink){ ctx.strokeStyle='#3a2a22'; ctx.lineWidth=.018; ctx.beginPath(); ctx.moveTo(x-.13,.05); ctx.quadraticCurveTo(x,.0,x+.13,.05); ctx.stroke(); }
    else {
      ctx.fillStyle='#fdfdfb'; ctx.beginPath(); ctx.moveTo(x-.14,.05); ctx.quadraticCurveTo(x,.15,x+.14,.05); ctx.quadraticCurveTo(x,-.03,x-.14,.05); ctx.fill();
      ctx.save(); ctx.clip(); ctx.fillStyle=c.eye; ellP(ctx,x,.05,.058,.058); ctx.fill(); ctx.fillStyle='#111'; ellP(ctx,x,.05,.027,.027); ctx.fill(); ctx.fillStyle='#fff'; ellP(ctx,x+.018,.07,.012,.012); ctx.fill(); ctx.restore();
      ctx.strokeStyle='#3a2a22'; ctx.lineWidth=.014+mk.ln[i]*.026; ctx.beginPath(); ctx.moveTo(x-.145,.05); ctx.quadraticCurveTo(x,.155,x+.145,.05);
      if(mk.ln[i]>.35){ ctx.moveTo(x+sd*.14,.055); ctx.lineTo(x+sd*(.14+mk.ln[i]*.06),.1); }
      ctx.stroke();
      if(mk.rm[i]>.05){ ctx.strokeStyle='#111'; ctx.lineWidth=.008+mk.rm[i]*.008; ctx.beginPath(); for(let k=0;k<7;k++){ const u=-.12+k*.04, yy=.05+.105*(1-(u/.14)**2)*.95; ctx.moveTo(x+u,yy); ctx.lineTo(x+u*1.25+sd*.01,yy+.03+mk.rm[i]*.045); } ctx.stroke(); }
    }
  }
  // ceja
  const b=c.brow[i], bc=c.bdef[i]>.2?shade(browCol(c),-.25*c.bdef[i]):browCol(c);
  ctx.strokeStyle=bc; ctx.lineCap='round'; ctx.lineWidth=.018+b*.065;
  ctx.beginPath(); ctx.moveTo(x-sd*.15,.245); ctx.quadraticCurveTo(x+sd*.01,.33-b*.02,x+sd*.16,.26); ctx.stroke();
  const ms=c.bmess[i];
  if(ms>.05){ ctx.lineWidth=.01; ctx.beginPath(); const n=Math.round(ms*16);
    for(let k=0;k<n;k++){ const u=hsh(k,i,9)*.34-.17, v=(hsh(k,i,4)-.5)*.13; ctx.moveTo(x+u,.28+v); ctx.lineTo(x+u+(hsh(k,9,i)-.5)*.05,.28+v+.035); } ctx.stroke(); }
  if(i===1 && Math.min(...c.brow)>.74 && Math.min(...c.bmess)>.35){ ctx.lineWidth=.04; ctx.strokeStyle=bc; ctx.globalAlpha=.55; ctx.beginPath(); ctx.moveTo(-.17,.25); ctx.lineTo(.17,.25); ctx.stroke(); ctx.globalAlpha=1; }
}
function drawMouth(ctx, c, t, talk){
  const nat=mix(c.skin,'#b0464a',.5), a=Math.min(1,c.mk.lipA), lc=c.mk.lip&&a>0?mix(nat,c.mk.lip,a):nat, open=talk?Math.abs(Math.sin(t*14))*.05:0;
  if(c.mk.lipA>1.02 && c.mk.lip){ ctx.globalAlpha=(c.mk.lipA-1)*2; ctx.fillStyle=c.mk.lip; ellP(ctx,0,-.5,.26,.11); ctx.fill(); ctx.globalAlpha=1; }
  if(open>.005){ ctx.fillStyle='#5a1c22'; ellP(ctx,0,-.5-open/2,.13,open+.01); ctx.fill(); }
  ctx.fillStyle=lc;
  ctx.beginPath(); ctx.moveTo(-.2,-.48); ctx.quadraticCurveTo(-.1,-.41,0,-.445); ctx.quadraticCurveTo(.1,-.41,.2,-.48); ctx.quadraticCurveTo(0,-.495,-.2,-.48); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-.2,-.48-open*.2); ctx.quadraticCurveTo(0,-.495-open,.2,-.48-open*.2); ctx.quadraticCurveTo(0,-.61-open,-.2,-.48-open*.2); ctx.fill();
  ctx.strokeStyle=shade(lc,-.35); ctx.lineWidth=.012; ctx.beginPath(); ctx.moveTo(-.2,-.48); ctx.quadraticCurveTo(0,-.505-open,.2,-.48); ctx.stroke();
  if(a>.3){ ctx.fillStyle='rgba(255,255,255,.35)'; ellP(ctx,.05,-.545,.05,.014); ctx.fill(); }
}
function beardPath(ctx, c, k){
  const b=c.beard, lo=-1.06-Math.max(0,b.L-.12)*.9*k;
  ctx.beginPath(); ctx.moveTo(-.8,-.12); ctx.quadraticCurveTo(-.82,-.7,-.42,-.95); ctx.quadraticCurveTo(0,lo-.05,.42,-.95); ctx.quadraticCurveTo(.82,-.7,.8,-.12);
  ctx.lineTo(.68,-.12); ctx.quadraticCurveTo(.62,-.55,.3,-.6); ctx.quadraticCurveTo(0,-.72,-.3,-.6); ctx.quadraticCurveTo(-.62,-.55,-.68,-.12); ctx.closePath();
}
function drawBeard(ctx, c){
  const b=c.beard; if(b.L<.015 && b.foam<.02) return;
  const col=c.age==='mayor'?'#a9a6a1':b.col;
  if(b.L>.015){
    beardPath(ctx,c,1);
    if(b.L<.12){ ctx.globalAlpha=Math.min(.55,b.L*5); ctx.fillStyle=col; ctx.fill(); ctx.globalAlpha=1;
      ctx.save(); ctx.clip(); ctx.fillStyle=shade(col,-.2); for(let i=0;i<160;i++){ ellP(ctx,(hsh(i,4,4)-.5)*1.6,-.1-hsh(i,7,1)*1,.007,.007); ctx.fill(); } ctx.restore(); }
    else { ctx.fillStyle=col; ctx.fill(); ctx.save(); ctx.clip(); ctx.strokeStyle=shade(col,-.3); ctx.lineWidth=.012;
      ctx.beginPath(); for(let i=0;i<70;i++){ const x=(hsh(i,2,2)-.5)*1.6, y=-.15-hsh(i,3,3)*1.2; ctx.moveTo(x,y); ctx.lineTo(x+(b.neat?0:(hsh(i,5,5)-.5)*.05),y-.06); } ctx.stroke(); ctx.restore();
      if(!b.neat){ ctx.strokeStyle=col; ctx.lineWidth=.02; ctx.beginPath(); for(let i=0;i<24;i++){ const x=-.6+i*.05, y=-.95-Math.cos(x*1.4)*.12*(1+Math.max(0,b.L-.12)*3); ctx.moveTo(x,y); ctx.lineTo(x+(hsh(i,1,8)-.5)*.06,y-.05); } ctx.stroke(); } }
  }
  if(b.foam>.02){ ctx.globalAlpha=Math.min(1,b.foam*1.3); ctx.fillStyle='#fff'; for(let i=0;i<40;i++){ const x=(hsh(i,8,1)-.5)*1.3, y=-.62-hsh(i,6,2)*.42; ellP(ctx,x,y,.05+hsh(i,1,1)*.04,.05); ctx.fill(); } ctx.globalAlpha=1; }
}
function drawMustache(ctx, c){
  const b=c.beard; if(b.mus<.02) return; const col=c.age==='mayor'?'#a9a6a1':b.col, w=.025+b.mus*.12;
  ctx.globalAlpha=b.mus<.1?b.mus*6:1; ctx.fillStyle=col; ctx.beginPath(); ctx.moveTo(-.24-b.mus*.1,-.47); ctx.quadraticCurveTo(-.12,-.39+w*.2,0,-.41); ctx.quadraticCurveTo(.12,-.39+w*.2,.24+b.mus*.1,-.47);
  ctx.quadraticCurveTo(.12,-.4+w,0,-.4+w); ctx.quadraticCurveTo(-.12,-.4+w,-.24-b.mus*.1,-.47); ctx.fill(); ctx.globalAlpha=1;
}

/* ---------- accesorios ---------- */
function flower(ctx, x, y, r, pet, mid, n){
  for(let k=0;k<n;k++){ const a=k*Math.PI*2/n; ctx.fillStyle=pet; ellP(ctx,x+Math.cos(a)*r*.55,y+Math.sin(a)*r*.55,r*.5,r*.32,a); ctx.fill(); }
  ctx.fillStyle=mid; ellP(ctx,x,y,r*.28,r*.28); ctx.fill();
}
function nanduti(ctx, x, y, r, col){
  ctx.strokeStyle=col; ctx.lineWidth=r*.04;
  for(let k=1;k<=4;k++){ ctx.beginPath(); ctx.arc(x,y,r*k/4,0,Math.PI*2); ctx.stroke(); }
  ctx.beginPath(); for(let k=0;k<16;k++){ const a=k*Math.PI/8; ctx.moveTo(x,y); ctx.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r); } ctx.stroke();
  for(let k=0;k<8;k++){ const a=k*Math.PI/4; ctx.fillStyle=col; ellP(ctx,x+Math.cos(a)*r*.62,y+Math.sin(a)*r*.62,r*.09,r*.09); ctx.fill(); }
}
function drawAccBack(ctx, c, front){
  if(c.acc.includes('peineta')){ ctx.save(); ctx.beginPath(); ctx.arc(0,.95,.48,0,Math.PI); ctx.closePath(); ctx.clip(); ctx.fillStyle='rgba(255,255,255,.25)'; ctx.fill(); nanduti(ctx,0,.95,.48,'#fbfbf4'); ctx.restore(); }
  if(!front && c.acc.includes('monio')) bow(ctx,0,.55);
}
function bow(ctx,x,y){ ctx.fillStyle='#d61f3a'; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x-.24,y+.13); ctx.lineTo(x-.24,y-.13); ctx.closePath(); ctx.moveTo(x,y); ctx.lineTo(x+.24,y+.13); ctx.lineTo(x+.24,y-.13); ctx.closePath(); ctx.fill(); ctx.fillStyle='#a3122a'; ellP(ctx,x,y,.06,.06); ctx.fill(); }
function drawAcc(ctx, c, front){
  const A=c.acc;
  if(A.includes('collar')){ ctx.strokeStyle='#fbfbf4'; ctx.lineWidth=.03; ctx.beginPath(); ctx.moveTo(-.4,-1.42); ctx.quadraticCurveTo(0,-1.75,.4,-1.42); ctx.stroke(); if(front) nanduti(ctx,0,-1.72,.12,'#fbfbf4'); }
  if(A.includes('aros')) for(const sx of [-1,1]){ ctx.strokeStyle='#e6b422'; ctx.lineWidth=.025; ellP(ctx,sx*.88,-.3,.07,.09); ctx.stroke(); }
  if(front && A.includes('lentes')){ ctx.fillStyle='rgba(20,20,30,.72)'; ctx.strokeStyle='#111'; ctx.lineWidth=.035;
    for(const x of [-.33,.33]){ ellP(ctx,x,.05,.18,.14); ctx.fill(); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-.15,.08); ctx.quadraticCurveTo(0,.12,.15,.08); ctx.moveTo(-.51,.08); ctx.lineTo(-.84,.12); ctx.moveTo(.51,.08); ctx.lineTo(.84,.12); ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,.35)'; ellP(ctx,-.38,.1,.05,.025,-.4); ctx.fill(); ellP(ctx,.28,.1,.05,.025,-.4); ctx.fill(); }
  if(A.includes('vincha')){ const cols=['#d52b1e','#ffffff','#0038a8']; for(let k=0;k<3;k++){ ctx.strokeStyle=cols[k]; ctx.lineWidth=.045; ctx.beginPath(); ctx.ellipse(0,.0,HEAD.sx*1.0+.02,HEAD.sy*.98+.02-k*.045,0,Math.PI*.18,Math.PI*.82); ctx.stroke(); } }
  if(A.includes('corona')){ ctx.fillStyle='#e8c34a'; ctx.strokeStyle='#a8861c'; ctx.lineWidth=.012; ctx.beginPath(); ctx.moveTo(-.45,.84);
    for(let k=0;k<=8;k++){ const x=-.45+k*.1125, up=k%2?.0:(k%4===0?.28:.18); ctx.lineTo(x,.9+up+(k===4?.08:0)); } ctx.lineTo(.45,.84); ctx.quadraticCurveTo(0,.94,-.45,.84); ctx.fill(); ctx.stroke();
    for(const [x,y,col] of [[0,1.1,'#e5578c'],[-.22,1.0,'#6ec6f0'],[.22,1.0,'#6ec6f0']]){ ctx.fillStyle=col; ellP(ctx,x,y,.035,.035); ctx.fill(); } }
  if(A.includes('lapacho')) flower(ctx, front?.72:-.72, .55, .17, '#f06bb0', '#f7d23a', 5);
  if(A.includes('mburucuya')){ const x=front?-.72:.72; flower(ctx,x,.55,.19,'#f4f0ff','#7a3fa6',10); ctx.strokeStyle='#6a2c96'; ctx.lineWidth=.01; ctx.beginPath(); for(let k=0;k<20;k++){ const a=k*Math.PI/10; ctx.moveTo(x+Math.cos(a)*.06,.55+Math.sin(a)*.06); ctx.lineTo(x+Math.cos(a)*.13,.55+Math.sin(a)*.13); } ctx.stroke(); flower(ctx,x,.55,.05,'#f7d23a','#2d6b2d',5); }
  if(front && A.includes('monio')) bow(ctx,.5,.86);
  if(A.includes('piri')){ ctx.fillStyle='#e2c27a'; ellP(ctx,0,.78,1.4,.2); ctx.fill(); ctx.strokeStyle='#b8964a'; ctx.lineWidth=.012; for(let k=1;k<5;k++){ ellP(ctx,0,.78,1.4*k/5,.2*k/5); ctx.stroke(); }
    ctx.fillStyle='#e8cc88'; ctx.beginPath(); ctx.moveTo(-.68,.8); ctx.bezierCurveTo(-.7,1.35,.7,1.35,.68,.8); ctx.closePath(); ctx.fill(); ctx.stroke();
    const cols=['#d52b1e','#ffffff','#0038a8']; for(let k=0;k<3;k++){ ctx.fillStyle=cols[k]; ctx.fillRect(-.68,.84+k*.05,1.36,.05); } }
}

/* ---------- uñas y manos ---------- */
function drawNailShape(ctx, nl, w, l){
  const nat='#f2c2bb';
  const shape=()=>{ ctx.beginPath(); ctx.moveTo(-w/2,0); ctx.lineTo(-w/2,l-w*.45); ctx.quadraticCurveTo(-w/2,l,0,l); ctx.quadraticCurveTo(w/2,l,w/2,l-w*.45); ctx.lineTo(w/2,0); ctx.quadraticCurveTo(0,-w*.15,-w/2,0); ctx.closePath(); };
  shape(); ctx.fillStyle=nat; ctx.fill(); ctx.save(); ctx.clip();
  ctx.fillStyle='rgba(255,255,255,.55)'; ctx.fillRect(-w/2,l-.16*(l/.4)*.45,w,w);   // la puntita blanca natural
  if(nl.col && nl.a>.02){
    ctx.globalAlpha = nl.a<1 ? .3+.7*nl.a : 1; ctx.fillStyle=nl.col; ctx.fillRect(-w/2,-.05,w,l+.1); ctx.globalAlpha=1;
    if(nl.a<.9){ ctx.strokeStyle=nat; ctx.globalAlpha=.6*(1-nl.a); ctx.lineWidth=w*.08; ctx.beginPath(); for(let k=0;k<4;k++){ const x=-w/2+w*(k+.5)/4; ctx.moveTo(x,0); ctx.lineTo(x,l); } ctx.stroke(); ctx.globalAlpha=1; }
    if(nl.chip>.02){ ctx.fillStyle=nat; for(let k=0;k<5;k++){ const x=(hsh(k,3,9)-.5)*w, y=l*(.35+hsh(k,7,2)*.7), r=w*.25*nl.chip*(.6+hsh(k,1,1)); ellP(ctx,x,y,r,r*1.3); ctx.fill(); } }
    if(nl.des && nl.a>.5) drawDesign(ctx, nl.des, w, l);
  }
  if(nl.wet>.05){ ctx.globalAlpha=nl.wet*.7; ctx.fillStyle='#ffffff'; ellP(ctx,-w*.2,l*.55,w*.1,l*.25); ctx.fill(); ctx.globalAlpha=1; }
  ctx.restore();
  shape(); ctx.strokeStyle='rgba(120,60,60,.4)'; ctx.lineWidth=w*.05; ctx.stroke();
}
function drawDesign(ctx, d, w, l){
  if(d==='py'){ const h=l/3; ['#0038a8','#ffffff','#d52b1e'].forEach((c,i)=>{ ctx.fillStyle=c; ctx.fillRect(-w/2,i*h,w,h+.001); }); ctx.fillStyle='#f2c14e'; ellP(ctx,0,l/2,w*.12,w*.12); ctx.fill(); }
  else if(d==='franc'){ ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.moveTo(-w/2,l*.7); ctx.quadraticCurveTo(0,l*.6,w/2,l*.7); ctx.lineTo(w/2,l+.05); ctx.lineTo(-w/2,l+.05); ctx.fill(); }
  else if(d==='flor') flower(ctx,0,l*.55,w*.42,'#fbfbfb','#f7d23a',5);
  else if(d==='corazon'){ const s=w*.3, y=l*.5; ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.moveTo(0,y-s); ctx.bezierCurveTo(-s*1.6,y+s*.2,-s*.6,y+s*1.3,0,y+s*.5); ctx.bezierCurveTo(s*.6,y+s*1.3,s*1.6,y+s*.2,0,y-s); ctx.fill(); }
  else if(d==='puntos'){ ctx.fillStyle='#ffffff'; for(let k=0;k<5;k++){ ellP(ctx,(k%2?.2:-.2)*w,l*(.2+k*.17),w*.09,w*.09); ctx.fill(); } }
  else if(d==='brillos'){ for(let k=0;k<14;k++){ ctx.fillStyle=k%2?'#fff6c8':'#e6c34a'; ellP(ctx,(hsh(k,2,2)-.5)*w*.9,hsh(k,5,1)*l,w*.06,w*.06); ctx.fill(); } }
  else if(d==='nanduti') nanduti(ctx,0,l*.55,w*.42,'#ffffff');
}
function drawHands(ctx, c){
  for(let h=0;h<2;h++){
    const hx=HANDX[h], sk=c.skin;
    ctx.fillStyle=shade(sk,-.05); ctx.fillRect(hx-.36,-1.7,.72,.8);
    for(let f=0;f<5;f++){ const g=fingerGeom(h*5+f); ctx.save(); ctx.translate(g.bx,g.by); ctx.rotate(-Math.atan2(g.ux,g.uy));
      ctx.fillStyle=sk; ctx.beginPath(); ctx.moveTo(-g.w/2,-.15); ctx.lineTo(-g.w/2,g.len-g.w/2); ctx.arc(0,g.len-g.w/2,g.w/2,Math.PI,0,true); ctx.lineTo(g.w/2,-.15); ctx.closePath(); ctx.fill();
      ctx.strokeStyle=shade(sk,-.2); ctx.lineWidth=.012; ctx.beginPath(); ctx.moveTo(-g.w*.3,g.len*.45); ctx.lineTo(g.w*.3,g.len*.45); ctx.stroke(); ctx.restore(); }
    ctx.fillStyle=sk; ellP(ctx,hx,-.72,.52,.58); ctx.fill();
    if(c.soft[h]>.1){ ctx.globalAlpha=c.soft[h]*.3; ctx.fillStyle='#fff'; ellP(ctx,hx-.1,-.6,.3,.25); ctx.fill(); ctx.globalAlpha=1; }
    ctx.strokeStyle=shade(sk,-.18); ctx.lineWidth=.012; for(let k=0;k<3;k++){ ctx.beginPath(); ctx.moveTo(hx-.25+k*.2,-.3); ctx.lineTo(hx-.22+k*.2,-.55); ctx.stroke(); }
    for(let f=0;f<5;f++){ const n=h*5+f, nl=c.nails[n], g=nailGeom(n,nl.L), fg=fingerGeom(n);
      ctx.save(); ctx.translate(fg.bx+fg.ux*g.st, fg.by+fg.uy*g.st); ctx.rotate(-Math.atan2(g.ux,g.uy));
      drawNailShape(ctx, nl, g.w, g.l);
      if(c.cut[h]>.25){ ctx.strokeStyle=shade(sk,-.25); ctx.lineWidth=.01; ctx.beginPath(); for(let k=0;k<5;k++){ const x=-g.w/2+k*g.w/4; ctx.moveTo(x,-.01); ctx.lineTo(x+.01,.025*c.cut[h]+.01); } ctx.stroke(); }
      ctx.restore(); }
  }
}

/* ---------- escena completa ---------- */
// o = {side:'front'|'back', zone:'cab'|'manos', t, talk, bg}
function sceneXf(W, H, zone){
  if(zone==='manos'){ const sc=Math.min(W/4.6, H/3.9); return {sc, ox:W/2, oy:H*.6+.1*sc}; }
  const sc=Math.min(W/4.3, H/4.5); return {sc, ox:W/2, oy:H/2-.55*sc};
}
function drawScene(ctx, W, H, c, o){
  const X=sceneXf(W,H,o.zone), front=o.side!=='back';
  ctx.setTransform(1,0,0,1,0,0);
  if(o.bg!==false) drawBg(ctx,W,H,o.zone,X,front);
  ctx.setTransform(X.sc*(front?1:-1),0,0,-X.sc,X.ox,X.oy);
  VX=1;
  if(o.zone==='manos'){ drawHands(ctx,c); ctx.setTransform(1,0,0,1,0,0); return X; }
  const list=hairStrands(c), tails=tailPaths(c), dz=front?1:-1;
  const back=list.filter(s=>s.z*dz<0).sort((a,b)=>a.z*dz-b.z*dz), fr=list.filter(s=>s.z*dz>=0).sort((a,b)=>a.z*dz-b.z*dz);
  const tz = tp => tp.bun ? tp.p[2] : avg(tp.pts.map(p=>p[2]));
  for(const tp of tails) if(tz(tp)*dz<0) drawTail(ctx,c,tp);
  drawAccBack(ctx,c,front);
  for(const st of back) drawStrand(ctx,c,st);
  drawBody(ctx,c);
  drawEars(ctx,c);
  drawHeadShape(ctx,c,front);
  if(front) drawFace(ctx,c,o.t||0,o.talk);
  drawCap(ctx,c,front);
  for(const st of fr) drawStrand(ctx,c,st);
  for(const tp of tails) if(tz(tp)*dz>=0) drawTail(ctx,c,tp);
  drawFoam(ctx,c,front?fr:fr,true);
  drawAcc(ctx,c,front);
  ctx.setTransform(1,0,0,1,0,0);
  return X;
}
function drawBg(ctx, W, H, zone, X, front){
  if(zone==='manos'){
    const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,'#f6e7d6'); g.addColorStop(1,'#e8cfb6'); ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#fdf6fb'; const tw=4.3*X.sc, th=2.4*X.sc; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(X.ox-tw/2, X.oy-th*.15, tw, th, 18) : ctx.rect(X.ox-tw/2, X.oy-th*.15, tw, th); ctx.fill();
    ctx.strokeStyle='#f1c1dc'; ctx.lineWidth=3; for(let k=0;k<6;k++){ const y=X.oy-th*.15+th*(k+.5)/6; ctx.beginPath(); ctx.moveTo(X.ox-tw/2+10,y); ctx.lineTo(X.ox+tw/2-10,y); ctx.stroke(); }
    return;
  }
  const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,'#fde7ef'); g.addColorStop(1,'#f3c9dc'); ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  ctx.save(); ctx.translate(X.ox, X.oy-.15*X.sc); ctx.scale(X.sc,X.sc); ctx.globalAlpha=.35; nanduti(ctx,0,0,1.75,'#ffffff'); ctx.globalAlpha=1; ctx.restore();
  if(!front) return;
  ctx.fillStyle='#4a2a3a'; const cw=2.6*X.sc; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(X.ox-cw/2, X.oy+1.05*X.sc, cw, 2*X.sc, 30) : ctx.rect(X.ox-cw/2, X.oy+1.05*X.sc, cw, 2*X.sc); ctx.fill();
}
