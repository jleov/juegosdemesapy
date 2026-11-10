'use strict';
/* =====================================================================
   Ludo PY — el dibujo del tablero (SVG) y dónde cae cada casilla.
   Sirve para el de 4 colores (la cruz clásica de 15×15) y para el de 6
   (estrella de 6 brazos alrededor de un hexágono).
   Todo se calcula con la misma idea: cada brazo es 3 columnas × 6 filas
   pegado a un lado del polígono del centro (de lado 3 casillas).
   ===================================================================== */
const LAYOUTS = {};
function layout(N, rot){
  const key=N+':'+rot; if(LAYOUTS[key]) return LAYOUTS[key];
  const g=geo(N), a=g.a, R=rot*Math.PI/180, cs=Math.cos(R), sn=Math.sin(R);
  const E = N===6 ? 10.25 : 7.5;
  const rp = (x,y) => [x*cs-y*sn, x*sn+y*cs];
  const armV = k => { const f=(90+k*360/N)*Math.PI/180; return {f, u:[Math.cos(f),Math.sin(f)], v:[-Math.sin(f),Math.cos(f)]}; };
  const local = (k,col,r) => { const {u,v}=armV(k), d=a+r+.5; return [u[0]*d+v[0]*col, u[1]*d+v[1]*col]; };
  const at = (k,col,r) => rp(...local(k,col,r));
  const poly = (k,col,r,s) => { const {u,v}=armV(k), [cx,cy]=local(k,col,r); s=s||.47;
    return [[1,1],[1,-1],[-1,-1],[-1,1]].map(([i,j])=>rp(cx+u[0]*s*i+v[0]*s*j, cy+u[1]*s*i+v[1]*s*j)); };
  const trackRC = gi => { const j=Math.floor(gi/13), i=gi%13; return i<=5 ? [j,-1,i] : i===6 ? [j,0,5] : [j,1,12-i]; };
  const yardAng = k => (90+k*360/N+180/N)*Math.PI/180;
  const yardD = N===6 ? 7.75 : 4.5*Math.SQRT2;
  const yard0 = k => [Math.cos(yardAng(k))*yardD, Math.sin(yardAng(k))*yardD];
  const yardC = k => rp(...yard0(k));
  const yardR = N===6 ? 2.3 : 3;
  const sp = N===6 ? 1.0 : 1.45;   // separación de las fichas en casa
  const SPOTS = [[-1,-1],[1,1],[1,-1],[-1,1]];
  function yardSpot(k, i){ const [x,y]=yard0(k), o=SPOTS[i%4]; return rp(x+o[0]*sp, y+o[1]*sp); }
  function goalSpot(k, i, n){ const {u,v}=armV(k), d=a*(N===6?.62:.62), off=(i-(n-1)/2)*(N===6?.5:.42); return rp(u[0]*d+v[0]*off, u[1]*d+v[1]*off); }
  // posición de una ficha: brazo de su color, avance (−1 = en casa), número de ficha
  function pos(arm, p, idx, n){
    if(p<0) return yardSpot(arm, idx);
    if(p<=g.last) return at(...trackRC(gIdx(arm,p,N)));
    if(p<g.goal) return at(arm, 0, 4-(p-g.home0));
    return goalSpot(arm, idx, n||4);
  }
  // en qué casilla está (para juntar fichas apiladas)
  function cellKey(arm, p, idx){
    if(p<0) return 'y'+arm+'-'+idx;
    if(p<=g.last) return 't'+gIdx(arm,p,N);
    if(p<g.goal) return 'h'+arm+'-'+p;
    return 'g'+arm+'-'+idx;
  }
  const L={N, E, rot, a, at, poly, trackRC, yardC, yardR, yardSpot, goalSpot, pos, cellKey, armV, rp, geo:g};
  LAYOUTS[key]=L; return L;
}
const viewRot = (N, arm) => 135-(90+(arm||0)*360/N+180/N);

const f2 = n => Math.round(n*1000)/1000;
const ptsStr = ps => ps.map(p=>f2(p[0])+','+f2(p[1])).join(' ');
function starPts(cx, cy, r, ri, rot){
  const out=[]; for(let i=0;i<10;i++){ const ang=(rot||-90)*Math.PI/180+i*Math.PI/5, rr=i%2?(ri||r*.45):r; out.push([cx+Math.cos(ang)*rr, cy+Math.sin(ang)*rr]); }
  return out;
}
// colors[arm] = {hex, dark, soft} o null (brazo sin jugador)
function boardSVG(N, rot, colors){
  const L=layout(N, rot), g=L.geo, E=L.E, C=colsOf(N);
  const col = k => colors && colors[k] !== undefined ? colors[k] : C[k];
  const gray = {hex:'#b9b2a3', dark:'#7d7668', soft:'#e9e4d8'};
  const cc = k => col(k) || gray;
  let s=`<svg class="bd" viewBox="${-E} ${-E} ${2*E} ${2*E}" xmlns="http://www.w3.org/2000/svg">`;
  s+=`<defs><radialGradient id="pap" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#fffaf0"/><stop offset="1" stop-color="#f1e4c6"/></radialGradient></defs>`;
  // fondo
  if(N===6) s+=`<circle cx="0" cy="0" r="${E-.15}" fill="url(#pap)"/>`;
  else s+=`<rect x="${-E+.12}" y="${-E+.12}" width="${2*E-.24}" height="${2*E-.24}" rx=".5" fill="url(#pap)"/>`;
  // casas
  for(let k=0;k<N;k++){
    const c=cc(k), [x,y]=L.yardC(k);
    if(N===4){
      const R=L.yardR-.08, corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([i,j])=>{ const y0=[Math.cos((90+k*90+45)*Math.PI/180)*4.5*Math.SQRT2, Math.sin((90+k*90+45)*Math.PI/180)*4.5*Math.SQRT2]; return L.rp(y0[0]+i*R, y0[1]+j*R); });
      s+=`<polygon points="${ptsStr(corners)}" fill="${c.hex}" stroke="${c.dark}" stroke-width=".12" stroke-linejoin="round"/>`;
      s+=`<circle cx="${f2(x)}" cy="${f2(y)}" r="2.45" fill="#fff" stroke="${c.dark}" stroke-width=".1"/>`;
    } else {
      s+=`<circle cx="${f2(x)}" cy="${f2(y)}" r="${L.yardR}" fill="${c.hex}" stroke="${c.dark}" stroke-width=".12"/>`;
      s+=`<circle cx="${f2(x)}" cy="${f2(y)}" r="${L.yardR-.42}" fill="#fff" stroke="${c.dark}" stroke-width=".08"/>`;
    }
    // ñandutí: la telita paraguaya, dibujada en cada casa
    const rr = N===4 ? 2.3 : L.yardR-.5;
    let nd=''; for(let i=0;i<24;i++){ const an=i*Math.PI/12; nd+=`<line x1="${f2(x)}" y1="${f2(y)}" x2="${f2(x+Math.cos(an)*rr)}" y2="${f2(y+Math.sin(an)*rr)}"/>`; }
    s+=`<g stroke="${c.hex}" stroke-width=".04" opacity=".35" fill="none">${nd}<circle cx="${f2(x)}" cy="${f2(y)}" r="${f2(rr*.33)}"/><circle cx="${f2(x)}" cy="${f2(y)}" r="${f2(rr*.66)}"/><circle cx="${f2(x)}" cy="${f2(y)}" r="${f2(rr*.95)}" stroke-dasharray=".12 .1"/></g>`;
    for(let i=0;i<4;i++){ const [px,py]=L.yardSpot(k,i); s+=`<circle cx="${f2(px)}" cy="${f2(py)}" r="${N===6?.42:.55}" fill="${c.soft}" stroke="${c.hex}" stroke-width=".1"/>`; }
  }
  // casillas del camino y pasillos
  for(let j=0;j<N;j++){
    const c=cc(j);
    for(const colI of [-1,1]) for(let r=0;r<6;r++){
      const gi = colI===-1 ? 13*j+r : 13*j+12-r;
      const start=isStart(gi), star=isStar(gi);
      s+=`<polygon points="${ptsStr(L.poly(j,colI,r))}" fill="${start?c.hex:'#fffdf7'}" stroke="#6d5a3a" stroke-width=".05"/>`;
      if(start || star){ const [cx,cy]=L.at(j,colI,r); s+=`<polygon points="${ptsStr(starPts(cx,cy,.36,.15))}" fill="${start?'#fff':'#f2c14e'}" stroke="${start?c.dark:'#a07400'}" stroke-width=".04"/>`; }
    }
    s+=`<polygon points="${ptsStr(L.poly(j,0,5))}" fill="#fffdf7" stroke="#6d5a3a" stroke-width=".05"/>`;
    { const {u}=L.armV(j), [cx,cy]=L.at(j,0,5), ru=L.rp(u[0],u[1]), rv=[-ru[1],ru[0]];
      const tip=[cx-ru[0]*.32, cy-ru[1]*.32], b1=[cx+ru[0]*.18+rv[0]*.26, cy+ru[1]*.18+rv[1]*.26], b2=[cx+ru[0]*.18-rv[0]*.26, cy+ru[1]*.18-rv[1]*.26];
      s+=`<polygon points="${ptsStr([tip,b1,b2])}" fill="${c.hex}"/>`; }
    for(let r=0;r<5;r++) s+=`<polygon points="${ptsStr(L.poly(j,0,r))}" fill="${c.hex}" stroke="${c.dark}" stroke-width=".05"/>`;
  }
  // el centro: un triángulo de cada color (la meta) y la estrella del escudo
  const rc=1.5/Math.sin(Math.PI/N);
  const vx = k => { const an=(90+k*360/N)*Math.PI/180; return L.rp(Math.cos(an)*rc, Math.sin(an)*rc); };
  for(let k=0;k<N;k++){
    const c=cc(k), an1=(90+k*360/N-180/N)*Math.PI/180, an2=(90+k*360/N+180/N)*Math.PI/180;
    const p1=L.rp(Math.cos(an1)*rc, Math.sin(an1)*rc), p2=L.rp(Math.cos(an2)*rc, Math.sin(an2)*rc);
    s+=`<polygon points="${ptsStr([[0,0],p1,p2])}" fill="${c.hex}" stroke="${c.dark}" stroke-width=".06" stroke-linejoin="round"/>`;
  }
  s+=`<circle cx="0" cy="0" r="${N===6?.75:.55}" fill="#fff" stroke="#1b2a5a" stroke-width=".06"/>`;
  s+=`<polygon points="${ptsStr(starPts(0,0,N===6?.5:.36,N===6?.2:.15))}" fill="#f2c14e" stroke="#9a6b00" stroke-width=".03"/>`;
  s+=`</svg>`;
  return s;
}
// la ficha en 3D: un peón parado (de costado)
function pawnSVG(c){
  return `<svg class="pawn" viewBox="0 0 40 64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="pg${c.hex.slice(1)}" x1="0" x2="1"><stop offset="0" stop-color="${c.dark}"/><stop offset=".35" stop-color="${c.hex}"/><stop offset=".55" stop-color="${c.soft}"/><stop offset="1" stop-color="${c.dark}"/></linearGradient></defs>
    <ellipse cx="20" cy="59" rx="16" ry="4.5" fill="rgba(0,0,0,.35)"/>
    <path d="M6 58 Q6 51 12 49 L15 33 Q9 30 11 25 L29 25 Q31 30 25 33 L28 49 Q34 51 34 58 Z" fill="url(#pg${c.hex.slice(1)})" stroke="${c.dark}" stroke-width="1.2"/>
    <circle cx="20" cy="15" r="10" fill="url(#pg${c.hex.slice(1)})" stroke="${c.dark}" stroke-width="1.2"/>
    <ellipse cx="16.5" cy="11.5" rx="3" ry="2.2" fill="rgba(255,255,255,.6)"/></svg>`;
}
