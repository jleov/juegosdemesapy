'use strict';
/* =====================================================================
   ¿Mávapa? — pasa una foto a caricatura (cabeza agrandada,
   colores planos y contorno negro). Lo usan las fotos del juego y
   también las que sube cada uno al agregar personajes.
   Uso: Caricatura.hacer(img, {cx, cy, s}) → canvas de 240×240
        cx, cy = centro de la cara (0..1 del ancho y del alto de la foto)
        s      = lado del recorte (0..1 del ancho de la foto)
   ===================================================================== */
const Caricatura = (()=>{
  const N=240;
  function recorte(img, c){
    const W=img.naturalWidth||img.width, H=img.naturalHeight||img.height;
    let side=Math.min(W, H, Math.max(16, (c.s||1)*W));
    let x=(c.cx==null?.5:c.cx)*W-side/2, y=(c.cy==null?.4:c.cy)*H-side/2;
    x=Math.max(0, Math.min(W-side, x)); y=Math.max(0, Math.min(H-side, y));
    const cv=document.createElement('canvas'); cv.width=cv.height=N;
    const g=cv.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,N,N);
    g.imageSmoothingQuality='high'; g.drawImage(img, x, y, side, side, 0, 0, N, N);
    return g.getImageData(0,0,N,N);
  }
  // lupa en el medio: la cara queda más grande que el resto (efecto caricatura)
  function lupa(src, k){
    const out=new ImageData(N,N), s=src.data, d=out.data, cx=N/2, cy=N*.46, R=N*.62;
    for(let y=0;y<N;y++) for(let x=0;x<N;x++){
      const dx=x-cx, dy=y-cy, r=Math.hypot(dx,dy)/R;
      let sx=x, sy=y;
      if(r<1 && r>0){ const f=Math.pow(r, k)/r; sx=cx+dx*f; sy=cy+dy*f; }
      const ix=Math.max(0,Math.min(N-1,sx|0)), iy=Math.max(0,Math.min(N-1,sy|0)), i=(y*N+x)*4, j=(iy*N+ix)*4;
      d[i]=s[j]; d[i+1]=s[j+1]; d[i+2]=s[j+2]; d[i+3]=255;
    }
    return out;
  }
  // suaviza las superficies pero respeta los bordes (filtro bilateral chico)
  function suavizar(src, rad, sc){
    const out=new ImageData(N,N), s=src.data, d=out.data, k2=1/(2*sc*sc);
    for(let y=0;y<N;y++) for(let x=0;x<N;x++){
      const i=(y*N+x)*4, r0=s[i], g0=s[i+1], b0=s[i+2];
      let R=0,G=0,B=0,W=0;
      for(let v=-rad;v<=rad;v++){ const yy=y+v; if(yy<0||yy>=N) continue;
        for(let u=-rad;u<=rad;u++){ const xx=x+u; if(xx<0||xx>=N) continue;
          const j=(yy*N+xx)*4, dr=s[j]-r0, dg=s[j+1]-g0, db=s[j+2]-b0;
          const w=Math.exp(-(dr*dr+dg*dg+db*db)*k2);
          R+=s[j]*w; G+=s[j+1]*w; B+=s[j+2]*w; W+=w; } }
      d[i]=R/W; d[i+1]=G/W; d[i+2]=B/W; d[i+3]=255;
    }
    return out;
  }
  function hacer(img, c){
    c=c||{};
    let im=recorte(img, c);
    im=lupa(im, 1.16);
    const gris=(()=>{ const g=new Float32Array(N*N), s=im.data; for(let i=0;i<N*N;i++) g[i]=.3*s[i*4]+.59*s[i*4+1]+.11*s[i*4+2]; return g; })();
    let sm=suavizar(im, 2, 28); sm=suavizar(sm, 2, 22); sm=suavizar(sm, 1, 18);
    // bordes (Sobel sobre la foto apenas suavizada)
    const gs=new Float32Array(N*N);
    for(let y=1;y<N-1;y++) for(let x=1;x<N-1;x++){ const i=y*N+x; gs[i]=(gris[i-N-1]+2*gris[i-N]+gris[i-N+1]+2*gris[i-1]+4*gris[i]+2*gris[i+1]+gris[i+N-1]+2*gris[i+N]+gris[i+N+1])/16; }
    const ed=new Float32Array(N*N);
    for(let y=1;y<N-1;y++) for(let x=1;x<N-1;x++){
      const i=y*N+x;
      const gx=-gs[i-N-1]-2*gs[i-1]-gs[i+N-1]+gs[i-N+1]+2*gs[i+1]+gs[i+N+1];
      const gy=-gs[i-N-1]-2*gs[i-N]-gs[i-N+1]+gs[i+N-1]+2*gs[i+N]+gs[i+N+1];
      ed[i]=Math.hypot(gx,gy);
    }
    // umbral según la foto (las fotos lavadas tienen bordes más suaves)
    const sorted=Array.from(ed).sort((a,b)=>a-b), thr=Math.max(38, sorted[(N*N*.86)|0]);
    const out=sm, d=out.data;
    for(let i=0;i<N*N;i++){
      let r=d[i*4], g=d[i*4+1], b=d[i*4+2];
      // colores más vivos y en pocos tonos, como dibujo pintado
      const m=(r+g+b)/3; r=m+(r-m)*1.35; g=m+(g-m)*1.35; b=m+(b-m)*1.35;
      const q=v=>{ v=Math.max(0,Math.min(255,v)); return Math.min(255, Math.round(v/34)*34+10); };
      r=q(r); g=q(g); b=q(b);
      const e=ed[i];
      if(e>thr){ const t=Math.min(1,(e-thr)/(thr*.9)); const k=1-.85*t; r*=k; g*=k; b*=k; }
      d[i*4]=r; d[i*4+1]=g; d[i*4+2]=b;
    }
    const cv=document.createElement('canvas'); cv.width=cv.height=N;
    cv.getContext('2d').putImageData(out,0,0);
    return cv;
  }
  return {hacer, N};
})();
