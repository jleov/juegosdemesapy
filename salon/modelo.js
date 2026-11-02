'use strict';
/* =====================================================================
   Salón de Belleza PY — el modelo del cliente: pelo (16 mechones alrededor
   de la cabeza), cara, maquillaje, barba, uñas y accesorios; las
   herramientas, los pedidos paraguayos y el puntaje.
   Lo usan el anfitrión (que decide) y las vistas 2D y 3D (que dibujan y
   apuntan con las mismas medidas: la cabeza mide 1 y está en el 0,0,0).
   ===================================================================== */
const NSEC=16, NSTR=5, LMAX=4.2, FR_K=2.2, D2R=Math.PI/180;
const HEAD={sx:.86, sy:1.05, sz:.95};
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const sec2yaw = s => { const y=s*22.5; return y>180?y-360:y; };
const isFrontSec = s => s===0||s===1||s===15;
const avg = a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0;

/* ---------- colores ---------- */
function hexRgb(h){ h=String(h||'#000').replace('#',''); if(h.length===3) h=h.split('').map(c=>c+c).join(''); const n=parseInt(h,16)||0; return [n>>16&255, n>>8&255, n&255]; }
function rgbHex(r,g,b){ return '#'+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join(''); }
function mix(a,b,t){ const x=hexRgb(a), y=hexRgb(b); return rgbHex(x[0]+(y[0]-x[0])*t, x[1]+(y[1]-x[1])*t, x[2]+(y[2]-x[2])*t); }
const shade = (h, k) => k<0 ? mix(h,'#000000',-k) : mix(h,'#ffffff',k);
function lab(h){
  const f=v=>{ v/=255; return v<=.04045 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4); };
  const [r,g,b]=hexRgb(h).map(f);
  const x=(r*.4124+g*.3576+b*.1805)/.95047, y=r*.2126+g*.7152+b*.0722, z=(r*.0193+g*.1192+b*.9505)/1.08883;
  const k=t=>t>.008856 ? Math.cbrt(t) : 7.787*t+16/116;
  return [116*k(y)-16, 500*(k(x)-k(y)), 200*(k(y)-k(z))];
}
const dE = (a,b) => { const x=lab(a), y=lab(b); return Math.hypot(x[0]-y[0], x[1]-y[1], x[2]-y[2]); };

const SKINS=['#f7d7bb','#eec3a0','#dba57c','#c48a5e','#9c6842','#6f4529'];
const HAIR0={negro:'#1d1512', castOsc:'#3a2418', castano:'#62402a', caramelo:'#9a6634', rubio:'#d6b06c', canoso:'#c9c6c0', colorado:'#9a3a1e'};
const EYES=['#3b2414','#5a3a1e','#2f6b3a','#3a6fa8','#6b5a2a'];
const PAL={
  tinte:[['Negro azabache','#141010'],['Castaño oscuro','#3a2418'],['Castaño','#62402a'],['Chocolate','#4a2a1c'],['Caramelo','#a0662f'],['Miel','#c48a3e'],['Rubio','#dcb66e'],['Platinado','#f0e8d4'],['Cobrizo','#b8521e'],['Rojo','#a8141f'],['Bordó','#5c1024'],['Rosa','#ef7aa9'],['Lila','#a77bd6'],['Azul','#2f5fd0'],['Celeste','#79c6ef'],['Verde','#2fa66a']],
  labial:[['Rojo','#c8102e'],['Rosa','#e5578c'],['Nude','#c98f7a'],['Coral','#f0644f'],['Bordó','#6d0f2a'],['Fucsia','#d61f8a'],['Marrón','#7a4030'],['Lila','#9b59b6']],
  sombra:[['Dorada','#d4a73a'],['Marrón','#8a5a3b'],['Rosa','#e58fb0'],['Lila','#9b6bd0'],['Azul','#3d6fd6'],['Verde','#3aa36f'],['Plateada','#c9ccd4'],['Ahumada','#2b2b33']],
  rubor:[['Rosa','#f08aa0'],['Durazno','#f4a07a'],['Coral','#f07a6a'],['Bronce','#c9805a']],
  esmalte:[['Rojo','#d0142c'],['Rosa','#f2649a'],['Nude','#e2b5a0'],['Fucsia','#dc1f8e'],['Bordó','#6d0f2a'],['Coral','#ff6f5b'],['Lila','#a77bd6'],['Celeste','#6ec6f0'],['Azul','#1f4fd1'],['Verde','#2fb36a'],['Amarillo','#f7d23a'],['Blanco','#fbfbfb'],['Negro','#151515'],['Dorado','#d6ac3c']],
};
const colName = (pal, hex) => { const l=PAL[pal]||[]; let best=null, bd=1e9; for(const [n,h] of l){ const d=dE(h,hex); if(d<bd){ bd=d; best=n; } } return best||hex; };

/* ---------- herramientas ---------- */
const CATS=[
  {id:'lavado', e:'🚿', n:'Lavado'},
  {id:'corte', e:'✂️', n:'Corte'},
  {id:'color', e:'🎨', n:'Color'},
  {id:'peinado', e:'💨', n:'Peinado'},
  {id:'maquillaje', e:'💄', n:'Maquillaje'},
  {id:'facial', e:'🧖', n:'Facial'},
  {id:'barba', e:'🧔', n:'Barbería'},
  {id:'unas', e:'💅', n:'Uñas', manos:true},
  {id:'acc', e:'💍', n:'Accesorios'},
];
const TOOLS={
  champu:   {cat:'lavado', e:'🧴', n:'Champú', on:'pelo', d:'Frotá el pelo: hace espuma y saca la suciedad.'},
  enjuagar: {cat:'lavado', e:'🚿', n:'Enjuagar', on:'pelo', d:'Saca la espuma (el pelo queda mojado).'},
  acond:    {cat:'lavado', e:'💧', n:'Acondicionador', on:'pelo', d:'Pelo suave y con brillo, con menos frizz.'},
  toalla:   {cat:'lavado', e:'🧺', n:'Toalla', on:'pelo', d:'Saca el agua que chorrea (para secar del todo, el secador).'},
  tijera:   {cat:'corte', e:'✂️', n:'Tijera', on:'pelo', d:'Pasala por el pelo: corta a la altura por donde pasa.'},
  maquina:  {cat:'corte', e:'💈', n:'Máquina', on:'pelo', d:'Rapa bien cortito por donde pasa.'},
  peine:    {cat:'corte', e:'🪮', n:'Peine', on:'pelo', d:'Desenreda y saca el frizz.'},
  tinte:    {cat:'color', e:'🖌️', n:'Tintura', on:'pelo', pal:'tinte', d:'Pintá el pelo del color elegido (pasá varias veces).'},
  mechas:   {cat:'color', e:'✨', n:'Mechas', on:'pelo', pal:'tinte', d:'Reflejos finitos del color elegido.'},
  puntas:   {cat:'color', e:'🌈', n:'Puntas', on:'pelo', pal:'tinte', d:'Pinta solo las puntas (degradé u ombré).'},
  secador:  {cat:'peinado', e:'💨', n:'Secador', on:'pelo', d:'Seca el pelo mojado.'},
  planchita:{cat:'peinado', e:'🔥', n:'Planchita', on:'pelo', d:'Deja el pelo lacio (tiene que estar seco).'},
  ondas:    {cat:'peinado', e:'〰️', n:'Ondas', on:'pelo', d:'Ondas suaves (pelo seco).'},
  buclera:  {cat:'peinado', e:'🌀', n:'Buclera', on:'pelo', d:'Rulos bien marcados (pelo seco).'},
  laca:     {cat:'peinado', e:'🌬️', n:'Laca', on:'pelo', d:'Fija el peinado y saca el frizz.'},
  labial:   {cat:'maquillaje', e:'💄', n:'Labial', on:'cara', pal:'labial', d:'Pintá los labios.'},
  sombra:   {cat:'maquillaje', e:'👁️', n:'Sombra', on:'cara', pal:'sombra', d:'Pasala sobre los ojos.'},
  rubor:    {cat:'maquillaje', e:'🌸', n:'Rubor', on:'cara', pal:'rubor', d:'En las mejillas (¡no tanto que parece payaso!).'},
  delineador:{cat:'maquillaje', e:'✒️', n:'Delineador', on:'cara', d:'La rayita de los ojos.'},
  rimel:    {cat:'maquillaje', e:'🖍️', n:'Rímel', on:'cara', d:'Pestañas largas y negras.'},
  pinza:    {cat:'maquillaje', e:'🤏', n:'Pinza de cejas', on:'cara', d:'Saca pelitos: cejas más finas y prolijas.'},
  lapiz:    {cat:'maquillaje', e:'✏️', n:'Lápiz de cejas', on:'cara', d:'Rellena y marca las cejas.'},
  desmaq:   {cat:'maquillaje', e:'🧻', n:'Desmaquillante', on:'cara', d:'Borra el maquillaje donde pasa.'},
  mascarilla:{cat:'facial', e:'🍵', n:'Mascarilla', on:'cara', d:'Cubrí la cara (frente, mejillas, nariz y mentón).'},
  pepinos:  {cat:'facial', e:'🥒', n:'Pepinos', on:'cara', click:true, d:'Tocá un ojo para poner o sacar las rodajitas.'},
  limpieza: {cat:'facial', e:'🔍', n:'Limpieza', on:'cara', d:'Pasala por los granitos para sacarlos.'},
  esponja:  {cat:'facial', e:'🧽', n:'Esponja', on:'cara', d:'Saca la mascarilla.'},
  crema:    {cat:'facial', e:'🫙', n:'Crema', on:'cara', d:'Hidrata: la piel brilla y se calma lo rojo.'},
  espuma:   {cat:'barba', e:'🫧', n:'Espuma', on:'cara', d:'Antes de la navaja, ¡si no raspa!'},
  navaja:   {cat:'barba', e:'🪒', n:'Navaja', on:'cara', d:'Afeita la barba o el bigote.'},
  recortar: {cat:'barba', e:'🧔', n:'Recortadora', on:'cara', d:'Deja la barba o el bigote cortitos y prolijos.'},
  locion:   {cat:'barba', e:'🍃', n:'Loción', on:'cara', d:'After shave: saca la espuma y lo rojo.'},
  remojar:  {cat:'unas', e:'🛁', n:'Remojar', on:'mano', d:'Ablanda las cutículas de la mano que tocás.'},
  quitaesm: {cat:'unas', e:'🧪', n:'Quitaesmalte', on:'una', d:'Saca el esmalte viejo.'},
  lima:     {cat:'unas', e:'🪚', n:'Lima', on:'una', d:'Acorta y empareja la uña.'},
  cortaunas:{cat:'unas', e:'✂️', n:'Cortaúñas', on:'una', click:true, d:'Corta la uña cortita de una.'},
  esmalte:  {cat:'unas', e:'💅', n:'Esmalte', on:'una', pal:'esmalte', d:'Pintá cada uña (2 o 3 pasadas).'},
  diseno:   {cat:'unas', e:'🎨', n:'Diseño', on:'una', click:true, des:true, d:'Elegí un dibujo y tocá la uña pintada.'},
  secunas:  {cat:'unas', e:'🌬️', n:'Secar esmalte', on:'mano', d:'Para que no se corra el esmalte.'},
  cremamanos:{cat:'unas', e:'🤲', n:'Crema de manos', on:'mano', d:'Manos suaves.'},
};
const toolsOf = cat => Object.keys(TOOLS).filter(k=>TOOLS[k].cat===cat);
const DESIGNS={py:'🇵🇾 Bandera', flor:'🌼 Mburucuyá', brillos:'✨ Brillitos', franc:'🤍 Francesita', corazon:'❤️ Corazón', puntos:'⚪ Lunares', nanduti:'🕸️ Ñandutí'};
const ACC={
  lapacho:{e:'🌸', n:'Flor de lapacho'}, mburucuya:{e:'🌼', n:'Flor de mburucuyá'}, peineta:{e:'🕸️', n:'Peineta de ñandutí'},
  vincha:{e:'🇵🇾', n:'Vincha tricolor'}, corona:{e:'👑', n:'Corona de 15 años'}, piri:{e:'👒', n:'Sombrero pirí'},
  lentes:{e:'🕶️', n:'Lentes'}, aros:{e:'💎', n:'Aros'}, collar:{e:'📿', n:'Collar de ñandutí'}, monio:{e:'🎀', n:'Moño'},
};
const STYLES={suelto:'💇 Suelto', cola:'🐴 Cola', trenza:'🥨 Trenza', trenzas:'👧 Dos trenzas', mono:'🍩 Moño alto', rodete:'🧶 Rodete'};

/* ---------- cara: zonas (vista de frente, medidas de la cabeza) ---------- */
const SPOTS=[[-.42,-.05],[.47,-.32],[.2,.48],[-.15,-.62],[.55,.08],[-.55,-.35],[.05,.3]];
const ell = (x,y,cx,cy,rx,ry) => ((x-cx)/rx)**2+((y-cy)/ry)**2 <= 1;
function faceRegion(x, y, male){
  if(Math.abs(x)>.8 || y>.95 || y<-1) return null;
  if(ell(x,y,0,-.5,.22,.1)) return 'labios';
  if(ell(x,y,-.33,.06,.17,.12)) return 'ojoI';
  if(ell(x,y,.33,.06,.17,.12)) return 'ojoD';
  if(ell(x,y,-.33,.27,.2,.08)) return 'cejaI';
  if(ell(x,y,.33,.27,.2,.08)) return 'cejaD';
  if(male && ell(x,y,0,-.37,.27,.07)) return 'bigote';
  if(ell(x,y,0,-.14,.11,.2)) return 'nariz';
  if(male && y<-.36 && Math.abs(x)<.74) return 'barba';
  if(ell(x,y,-.47,-.22,.2,.19)) return 'mejI';
  if(ell(x,y,.47,-.22,.2,.19)) return 'mejD';
  if(y>.36) return 'frente';
  if(y<-.6) return 'menton';
  return 'cara';
}
const MASKREG={frente:'fr', mejI:'mi', mejD:'md', nariz:'na', menton:'me', cara:null, barba:'me', bigote:'na'};
const side = r => /I$/.test(r) ? 0 : 1;

/* ---------- manos (vista de las uñas: x de -2.2 a 2.2, y de -1.6 a 1.6) ---------- */
const FINGERS=[ // dx desde el centro de la mano (hacia el pulgar = +), y base, largo, ángulo (grados, + hacia el pulgar), ancho
  {dx:.5,  by:-.62, len:.55, ang:42, w:.21},
  {dx:.27, by:-.18, len:.8,  ang:9,  w:.175},
  {dx:.07, by:-.12, len:.88, ang:1,  w:.18},
  {dx:-.13,by:-.15, len:.82, ang:-6, w:.17},
  {dx:-.31,by:-.27, len:.64, ang:-14,w:.145},
];
const HANDX=[-1.08, 1.08];
// la mano 0 es la izquierda (el pulgar mira al centro: +x), la 1 la derecha
function fingerGeom(n){
  const h=n<5?0:1, f=FINGERS[n%5], m=h===0?1:-1;
  const a=f.ang*D2R*m, bx=HANDX[h]+f.dx*m, by=f.by;
  const ux=Math.sin(a), uy=Math.cos(a);   // dirección del dedo
  return {h, bx, by, ux, uy, len:f.len, w:f.w, tipx:bx+ux*f.len, tipy:by+uy*f.len};
}
function nailGeom(n, L){
  const g=fingerGeom(n), nl=.15+clamp(L,0,1)*.32, st=g.len-.19;
  return {cx:g.bx+g.ux*(st+nl/2), cy:g.by+g.uy*(st+nl/2), ux:g.ux, uy:g.uy, w:g.w*.82, l:nl, st};
}
function hitNail(x, y, c){
  let best=-1, bd=1e9;
  for(let n=0;n<10;n++){
    const g=nailGeom(n, c.nails[n].L), dx=x-g.cx, dy=y-g.cy;
    const along=dx*g.ux+dy*g.uy, across=dx*g.uy-dy*g.ux;
    if(Math.abs(along)<g.l/2+.1 && Math.abs(across)<g.w/2+.07){ const d=Math.hypot(along,across); if(d<bd){ bd=d; best=n; } }
  }
  return best;
}
function hitHand(x, y){
  for(let h=0;h<2;h++){
    if(ell(x,y,HANDX[h],-.75,.55,.62)) return h;
    for(let f=0;f<5;f++){ const g=fingerGeom(h*5+f), dx=x-g.bx, dy=y-g.by, al=dx*g.ux+dy*g.uy, ac=dx*g.uy-dy*g.ux;
      if(al>-.1 && al<g.len+.2 && Math.abs(ac)<g.w/2+.05) return h; }
  }
  return -1;
}

/* ---------- pelo: caminos de cada mechón (se calculan una vez y se guardan) ---------- */
function sph(yaw, el, r){
  const ce=Math.cos(el*D2R);
  return [r*ce*Math.sin(yaw*D2R)*HEAD.sx, r*Math.sin(el*D2R)*HEAD.sy, r*ce*Math.cos(yaw*D2R)*HEAD.sz];
}
function unitDir(yaw, el){ const ce=Math.cos(el*D2R); return [ce*Math.sin(yaw*D2R), Math.sin(el*D2R), ce*Math.cos(yaw*D2R)]; }
function bodyR(y){
  if(y>-.8) return null;
  if(y>-1.5) return [.36,.34];
  const k=Math.min(1,(-1.5-y)/.45);
  return [.36+k*1.3, .34+k*.48];
}
function drape(p){   // el pelo que cae sobre los hombros se va para adelante (sobre el pecho) o para atrás (la espalda)
  const b=bodyR(p[1]); if(!b) return p;
  const [rx,rz]=b, q=(p[0]/rx)**2+(p[2]/rz)**2;
  if(q>=1.15) return p;
  const ax=Math.abs(p[0]/rx);
  if(ax<1.07){ const z=rz*Math.sqrt(1.15-ax*ax); return [p[0], p[1], p[2]>=0?z:-z]; }
  const f=Math.sqrt(1.15/q); return [p[0]*f, p[1], p[2]*f];
}
function withT(pts){ const t=[0]; for(let i=1;i<pts.length;i++){ const a=pts[i-1], b=pts[i]; t.push(t[i-1]+Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2])); } return {pts, t}; }
// punto de reunión del pelo para cada peinado
const GATHER={cola:[180,28,1.06], trenza:[180,-18,1.04], mono:[180,62,1.0], rodete:[180,8,1.0]};
function gatherOf(st, s, j){
  if(st==='trenzas'){ const y=sec2yaw(s)+(j-2)*4; return y<0||y===-180 ? [-104,-12,1.06] : [104,-12,1.06]; }
  return GATHER[st];
}
const PATHS={};
function hairPath(st, s, j, fringe){
  const key=st+'|'+s+'|'+j+'|'+(fringe?1:0); if(PATHS[key]) return PATHS[key];
  const yaw0=sec2yaw(s)+(j-2)*4.2, front=Math.abs(sec2yaw(s))<=45;
  const elR = front ? 40-Math.abs(sec2yaw(s))*.1 : 57;
  const pts=[];
  if(st!=='suelto'){
    const g=gatherOf(st, s, j), a=unitDir(yaw0, elR), b=unitDir(g[0], g[1]);
    const dot=clamp(a[0]*b[0]+a[1]*b[1]+a[2]*b[2],-1,1), om=Math.acos(dot), so=Math.sin(om)||1;
    for(let i=0;i<=16;i++){ const u=i/16, ka=om<1e-3?1-u:Math.sin((1-u)*om)/so, kb=om<1e-3?u:Math.sin(u*om)/so;
      const d=[a[0]*ka+b[0]*kb, a[1]*ka+b[1]*kb, a[2]*ka+b[2]*kb], r=1.035+.025*Math.sin(u*Math.PI);
      pts.push([d[0]*r*HEAD.sx, d[1]*r*HEAD.sy, d[2]*r*HEAD.sz]); }
    return PATHS[key]=withT(pts);
  }
  if(fringe){
    for(let e=elR;e>=-6;e-=2) pts.push(sph(yaw0, e, 1.055));
    return PATHS[key]=withT(pts);
  }
  const sign = sec2yaw(s)>=0 ? 1 : -1;
  for(let i=0;i<=24;i++){
    const u=i/24, e=elR+(-8-elR)*u, r=1.04+.06*u;
    const y = front ? yaw0+(sign*(78+Math.abs(yaw0)*.1)-yaw0)*(1-(1-u)*(1-u)) : yaw0;
    pts.push(sph(y, e, r));
  }
  let p=pts[24];
  for(let d=.07; d<LMAX; d+=.07){
    const ex = d<1.4 ? 1.004 : 1;   // el pelo se abre un poquito al caer
    p=drape([p[0]*ex, p[1]-.07, p[2]*ex]);
    pts.push(p);
  }
  return PATHS[key]=withT(pts);
}
const isFringe = (c, s) => c.st==='suelto' && isFrontSec(s) && c.hair[s].L<.22;
const kOf = fringe => fringe ? FR_K : LMAX;
const curlShrink = cu => 1-.1*clamp(cu,0,2);
// largo del pelo de un mechón que se ve (en unidades del camino)
function visLen(c, s){ const fr=isFringe(c,s); return c.hair[s].L*kOf(fr)*curlShrink(c.hair[s].cu); }
function hsh(a,b,c){ let h=(a*374761393+b*668265263+c*2147483647)|0; h=(h^(h>>>13))*1274126177|0; return ((h^(h>>>16))>>>0)/4294967296; }
// los puntos de una hebra (con rulos y frizz), cortados donde termina el pelo
function strandPts(c, s, j){
  const fr=isFringe(c,s), P=hairPath(c.st, s, j, fr), sec=c.hair[s];
  const Lv = c.st==='suelto' ? visLen(c,s) : P.t[P.t.length-1];
  const out=[], cu=clamp(sec.cu,0,2), A=cu<1 ? cu*.07 : .07+(cu-1)*.05, w=cu<1.4 ? 5.5 : 5.5+(cu-1.4)*14;
  const yaw=sec2yaw(s)*D2R, sx=Math.cos(yaw), sz=-Math.sin(yaw), fz=c.st==='suelto' ? sec.frizz*(1-sec.wet*.8) : 0, ph=j*1.7+s;
  for(let i=0;i<P.pts.length;i++){
    let t=P.t[i], p=P.pts[i];
    if(t>Lv){
      if(i===0) break;
      const a=P.pts[i-1], k=(Lv-P.t[i-1])/(t-P.t[i-1]||1);
      p=[a[0]+(p[0]-a[0])*k, a[1]+(p[1]-a[1])*k, a[2]+(p[2]-a[2])*k]; t=Lv;
    }
    const ramp=Math.min(1,t/.5), off=A*Math.sin(w*t+ph)*ramp*(c.st==='suelto'?1:0);
    const jx=fz ? (hsh(s,j,i)-.5)*.09*fz*ramp : 0, jy=fz ? (hsh(s+40,j,i)-.5)*.07*fz*ramp : 0;
    const vol=(sec.wet>.5?-.02:0)+(c.st==='suelto'?A*.5*Math.cos(w*t+ph)*ramp:0);
    out.push([p[0]+sx*off+jx+p[0]*vol, p[1]+jy, p[2]+sz*off+p[2]*vol, t]);
    if(t>=Lv) break;
  }
  return out;
}
// cuánto pelo sobra para la cola, trenza o moño
function tailLen(c){
  if(c.st==='suelto') return 0;
  const l=[]; for(let s=0;s<NSEC;s++){ const P=hairPath(c.st,s,2,false); l.push(Math.max(0, c.hair[s].L*LMAX*curlShrink(c.hair[s].cu)-P.t[P.t.length-1])); }
  return avg(l);
}
function styleOk(c, st){
  if(st==='suelto') return null;
  let short=0; for(let s=0;s<NSEC;s++){ const P=hairPath(st,s,2,false); if(c.hair[s].L*LMAX < P.t[P.t.length-1]+.25) short++; }
  if(short>3) return st==='mono'||st==='rodete' ? 'El pelo es muy corto para un moño.' : st==='cola' ? 'El pelo es muy corto para una cola.' : 'El pelo es muy corto para trenzar.';
  return null;
}
// el recorrido de la cola, trenza(s) o moño (para dibujar y para apuntar)
function tailPaths(c){
  const st=c.st; if(st==='suelto') return [];
  const tl=tailLen(c);
  if(st==='mono'||st==='rodete'){ const g=GATHER[st], p=sph(g[0],g[1],g[2]+.1); return [{bun:true, p, r:.2+Math.min(.28, Math.sqrt(tl)*.16), pts:[p]}]; }
  const gs = st==='trenzas' ? [[-104,-12,1.06],[104,-12,1.06]] : [GATHER[st]];
  return gs.map(g=>{
    const p0=sph(g[0],g[1],g[2]+.02), pts=[p0]; let p=p0;
    const n=Math.max(2, Math.round(tl/.07)), out = st==='trenzas' ? [p0[0]>0?.06:-.06,0,.32] : [0,0,-.2];
    for(let i=1;i<=n;i++){
      const u=Math.min(1,i/5);
      p=drape([p[0]+out[0]*u/5*(i<=5?1:0), p[1]-.07*(st==='cola'&&i<4?.4:1), p[2]+out[2]*(i<=5?1/5:0)]);
      pts.push(p);
    }
    return {braid:st!=='cola', pts, w:st==='cola'?.2:.15};
  });
}

/* ---------- clientes y pedidos ---------- */
const NAMES_F=['Ña Ramona','Fátima','Lourdes','Nadia','Profe Gladys','Mirna','Doña Sara','Carmen','Ña Chela','Belén','Ana','Luz','Rocío','Tamara','Liz','Perla','Celeste','Gabi','Noelia','Araceli'];
const NAMES_M=['Don Ñato','Rodrigo','Karai Alcides','Diego','Kevin','Derlis','Óscar','Marcelo','Lucas','Hugo'];
const T = (k, o) => Object.assign({k}, o||{});
const PEDIDOS=[
  {who:'Ña Ramona', e:'👵', sex:'f', age:'mayor', hc:'canoso', L:.45, cu:1, story:'Mañana es el cumple de 15 de su nieta en Luque y quiere tapar las canas.',
    tasks:[T('lavar'),T('secar'),T('color',{col:'#62402a'}),T('rizo',{cu:1}),T('labios',{col:'#e5578c'}),T('unas',{col:'#d0142c'})]},
  {who:'Fátima', e:'👸', sex:'f', age:'joven', hc:'castano', L:.8, story:'¡Su fiesta de 15 años es esta noche en el club de Lambaré!',
    tasks:[T('lavar'),T('secar'),T('peinado',{st:'mono'}),T('acc',{id:'corona'}),T('sombra',{col:'#e58fb0'}),T('labios',{col:'#e5578c'}),T('unas',{col:'#f2649a',des:'brillos',n:4})]},
  {who:'Lourdes', e:'👰', sex:'f', hc:'castOsc', L:.85, story:'Se casa el sábado en la Catedral de Asunción.',
    tasks:[T('peinado',{st:'rodete'}),T('acc',{id:'peineta'}),T('facial'),T('rimel'),T('delineado'),T('labios',{col:'#c98f7a'}),T('unas',{col:'#e2b5a0',des:'franc',n:10})]},
  {who:'Don Ñato', e:'👴', sex:'m', age:'mayor', hc:'canoso', L:.3, story:'Es el bautismo del nieto en San Lorenzo y quiere quedar prolijo.',
    tasks:[T('corte',{tipo:'clasico'}),T('afeitar'),T('cejas')]},
  {who:'Rodrigo', e:'⚽', sex:'m', hc:'negro', L:.3, story:'Juega la final del barrio el domingo: quiere el degradé de los futbolistas.',
    tasks:[T('lavar'),T('corte',{tipo:'degrade'}),T('barba')]},
  {who:'Nadia', e:'📱', sex:'f', hc:'castano', L:.75, cu:1, story:'Es influencer de Asunción: hoy graba un TikTok y quiere algo que llame la atención.',
    tasks:[T('mechas',{col:'#ef7aa9'}),T('rizo',{cu:0}),T('delineado'),T('labios',{col:'#d61f8a'}),T('unas',{col:'#dc1f8e'})]},
  {who:'Profe Gladys', e:'👩‍🏫', sex:'f', hc:'castOsc', L:.7, story:'Acto del 15 de mayo en la escuela: el Día de la Independencia.',
    tasks:[T('peinado',{st:'trenza'}),T('acc',{id:'vincha'}),T('labios',{col:'#c8102e'}),T('unas',{col:'#fbfbfb',des:'py',n:10})]},
  {who:'Mirna', e:'🙏', sex:'f', hc:'negro', L:.85, story:'Sale de peregrinación a Caacupé para el 8 de diciembre.',
    tasks:[T('lavar'),T('secar'),T('peinado',{st:'trenza'}),T('cejas'),T('facial')]},
  {who:'Doña Sara', e:'🧀', sex:'f', age:'mayor', hc:'caramelo', L:.55, story:'Va a la Expo de Mariano Roque Alonso a vender sus quesos Paraguay.',
    tasks:[T('rizo',{cu:1}),T('acc',{id:'piri'}),T('labios',{col:'#f0644f'}),T('rubor')]},
  {who:'Karai Alcides', e:'🔥', sex:'m', hc:'castOsc', L:.33, story:'Esta noche es la fiesta de San Juan: va a pasar por el fuego y quiere estar facherito.',
    tasks:[T('lavar'),T('secar'),T('corte',{tipo:'militar'}),T('bigote')]},
  {who:'Carmen', e:'🎭', sex:'f', hc:'negro', L:.8, story:'Desfila en el Carnaval Encarnaceno: ¡quiere brillar!',
    tasks:[T('puntas',{col:'#a77bd6'}),T('rizo',{cu:2}),T('sombra',{col:'#d4a73a'}),T('labios',{col:'#c8102e'}),T('acc',{id:'lapacho'}),T('unas',{col:'#d6ac3c',des:'brillos',n:10})]},
  {who:'Ña Chela', e:'🧉', sex:'f', age:'mayor', hc:'canoso', L:.4, story:'Viene todos los viernes: lo de siempre, lavado, rulos y las manos.',
    tasks:[T('lavar'),T('secar'),T('rizo',{cu:2}),T('manos')]},
  {who:'Belén', e:'🎓', sex:'f', hc:'castano', L:.9, cu:1, story:'Se recibe en la UNA: hoy es el acto de colación.',
    tasks:[T('corte',{tipo:'hombros'}),T('rizo',{cu:0}),T('labios',{col:'#c98f7a'}),T('rimel'),T('unas',{col:'#e2b5a0'})]},
  {who:'Diego', e:'🎸', sex:'m', hc:'castano', L:.42, story:'Toca polka con su banda en un festival y quiere un look rockero.',
    tasks:[T('puntas',{col:'#2f5fd0'}),T('barba'),T('cejas')]},
  {who:'Abuela Teodora', e:'⛪', sex:'f', age:'mayor', hc:'canoso', L:.7, story:'Va a la misa del domingo en Areguá.',
    tasks:[T('lavar'),T('secar'),T('peinado',{st:'rodete'}),T('cejas'),T('manos')]},
  {who:'Ana', e:'💼', sex:'f', hc:'castOsc', L:.8, story:'Tiene una entrevista de trabajo en un banco: algo serio y prolijo.',
    tasks:[T('corte',{tipo:'carre'}),T('rizo',{cu:0}),T('labios',{col:'#c98f7a'}),T('unas',{col:'#e2b5a0',corto:true})]},
  {who:'Luz', e:'💃', sex:'f', hc:'negro', L:.85, story:'Baila con traje típico y botella en la cabeza en el festival del Lago Ypacaraí.',
    tasks:[T('peinado',{st:'trenzas'}),T('acc',{id:'mburucuya'}),T('labios',{col:'#c8102e'}),T('rubor'),T('acc',{id:'aros'})]},
  {who:'Kevin', e:'😎', sex:'m', age:'joven', hc:'castano', L:.35, story:'Tiene su primera cita y quiere un cambio total.',
    tasks:[T('corte',{tipo:'degrade'}),T('mechas',{col:'#f0e8d4'}),T('cejas'),T('facial')]},
  {who:'Rocío', e:'🏐', sex:'f', age:'joven', hc:'rubio', L:.75, story:'Juega el campeonato de vóley playa en San Bernardino.',
    tasks:[T('lavar'),T('secar'),T('peinado',{st:'cola'}),T('acc',{id:'lentes'}),T('unas',{col:'#6ec6f0',corto:true})]},
  {who:'Derlis', e:'🚌', sex:'m', hc:'negro', L:.28, story:'Es chofer de colectivo de la Línea 30 y mañana se casa su hija.',
    tasks:[T('lavar'),T('corte',{tipo:'clasico'}),T('afeitar'),T('manos')]},
  {who:'Perla', e:'🌺', sex:'f', hc:'colorado', L:.6, story:'Su novio la lleva a cenar a la Costanera de Asunción.',
    tasks:[T('corte',{tipo:'flequillo'}),T('rizo',{cu:1}),T('sombra',{col:'#9b6bd0'}),T('labios',{col:'#6d0f2a'}),T('unas',{col:'#6d0f2a',des:'corazon',n:2})]},
  {who:'Celeste', e:'🎤', sex:'f', hc:'rubio', L:.7, story:'Canta guaranias en el Festival del Takuare\'ẽ en Guarambaré.',
    tasks:[T('color',{col:'#a8141f'}),T('rizo',{cu:1}),T('acc',{id:'collar'}),T('labios',{col:'#c8102e'}),T('rimel')]},
];
const CHARLA=[
  '¿Viste que va a llover? Dicen que entra el viento sur 🌧️','Mi nuera me dijo que acá atienden bien 😊','Hace un calor de 40 grados afuera 🥵',
  'Mba\'éichapa? ¡Todo bien por acá!','Pasame un tereré, che amiga 🧉','¿Vas a ir a la Expo este año?','Mi novio es de Cerro, pero yo soy de Olimpia 😂',
  'Mañana tengo el cumple de mi comadre en Luque 🎂','¿Escuchaste la nueva de los Rebeldes? 🎶','Mi abuela hace la mejor sopa paraguaya de Itauguá',
  'Ndaipóri problema, tranquila nomás 😌','¿Y ese chipá de dónde es? Huele riquísimo 🥯','Ojalá que no se corte la luz otra vez 🔌','Che, ¿cuánto tiempo hace que trabajás acá?',
];
const SAY={
  champu:['Mmm, qué rico masajito 😌','Ahí, ahí, en la nuca 😆','¡Qué rico olor tiene ese champú!'],
  enjuagar:['¡Ay, está fría el agua! 🥶','Ahora sí, tibiecita 😌'],
  secador:['¡No escucho nada con el secador! 😅','¡Qué calorcito!'],
  tijera:['¡Cuidado con la oreja! 😬','Despacito nomás, ¿eh?','¡Me encanta cómo va quedando!'],
  maquina:['¡Bzzzz! Me hace cosquillas 😂'],
  pinza:['¡Ayyy! 😖','¡Uy, eso dolió! 😣','Valga la pena…'],
  tinte:['¡Qué olor fuerte tiene la tintura! 😷','¿Va a quedar lindo, no? 😟'],
  navaja:['Despacito con eso, por favor 😰'],
  esmalte:['¡Qué lindo color! 💅','Ya quiero que se seque'],
  mascarilla:['Uy, está fresquita 😊','Voy a parecer el Pombero con esto verde 😂'],
  pepinos:['¡Qué relax! 😴'],
};

function rint(n){ return Math.floor(Math.random()*n); }
const pickR = a => a[rint(a.length)];
function newClient(tpl){
  tpl=tpl||{};
  const sex=tpl.sex||(Math.random()<.72?'f':'m'), age=tpl.age||'adulta';
  const hc=HAIR0[tpl.hc]||tpl.hcol||(age==='mayor'?HAIR0.canoso:pickR([HAIR0.negro,HAIR0.castOsc,HAIR0.castano,HAIR0.caramelo,HAIR0.rubio]));
  const L0=tpl.L!=null?tpl.L:(sex==='f'?.55+Math.random()*.35:.22+Math.random()*.1);
  const cu0=tpl.cu!=null?tpl.cu:(Math.random()<.3?1:Math.random()<.15?2:0);
  const dirt=tpl.dirt!=null?tpl.dirt:.55+Math.random()*.3;
  const hair=[];
  for(let s=0;s<NSEC;s++){
    let L=L0*(1+(Math.random()-.5)*.1);
    if(sex==='m' && isFrontSec(s)) L=Math.min(L,.2);
    hair.push({L:+L.toFixed(3), col:hc, mech:null, mA:0, tip:null, tA:0, cu:cu0, dirt, foam:0, wet:0, frizz:.45+Math.random()*.2, shine:.15});
  }
  const old=Math.random()<.6, oc=pickR(PAL.esmalte)[1];
  const nails=[]; for(let n=0;n<10;n++) nails.push({L:.45+Math.random()*.25, col:old?oc:null, a:old?.9:0, chip:old?.55+Math.random()*.3:0, des:null, wet:0});
  const spots=[]; SPOTS.forEach((p,i)=>{ if(Math.random()<.5) spots.push(i); });
  const c={sex, age, name:tpl.who||pickR(sex==='f'?NAMES_F:NAMES_M), e:tpl.e||(sex==='f'?'👩':'👨'),
    skin:tpl.skin||pickR(SKINS), eye:pickR(EYES), hair, st:'suelto',
    brow:[.82,.82], bmess:[.6,.6], bdef:[0,0],
    mk:{lip:null, lipA:0, sh:null, shA:[0,0], bl:'#f08aa0', blA:[0,0], ln:[0,0], rm:[0,0]},
    face:{mask:{fr:0,mi:0,md:0,na:0,me:0}, maskMax:0, spots, spots0:spots.length, glow:0, pep:false, red:0},
    beard: sex==='m' ? {L:.3+Math.random()*.15, mus:.35+Math.random()*.15, foam:0, neat:0, col:shade(hc,-.1)} : null,
    nails, cut:[.7,.7], soft:[.2,.2], acc:[]};
  c.orig={col:hc, L:hair.map(h=>h.L)};
  return c;
}
function cloneClient(c){ return JSON.parse(JSON.stringify(c)); }
function newPedido(used){
  const free=PEDIDOS.filter(p=>!(used||[]).includes(p.who));
  const p=pickR(free.length?free:PEDIDOS);
  return {who:p.who, e:p.e, story:p.story, tasks:JSON.parse(JSON.stringify(p.tasks)), tpl:p};
}

/* ---------- herramientas sobre el cliente (las aplica el anfitrión) ---------- */
// a = {tool, secs:[[s,L]] | [s], reg, spot, nail, hand, col, des, st, acc}
function applyTool(c, a){
  const T=TOOLS[a.tool], r={};
  const secs=(a.secs||[]).filter(x=>Array.isArray(x)?x[0]>=0&&x[0]<NSEC:x>=0&&x<NSEC);
  const S_ = f => secs.forEach(x=>{ const s=Array.isArray(x)?x[0]:x; f(c.hair[s], s, x); });
  const col = /^#[0-9a-f]{6}$/i.test(a.col||'') ? a.col : null;
  const needLoose = () => { if(c.st!=='suelto'){ r.err='Primero soltá el pelo (Peinado → 💇 Suelto).'; return true; } };
  const reg=a.reg, si = reg ? side(reg) : 0;
  switch(a.tool){
    case 'champu': if(needLoose()) break; S_(h=>{ h.dirt=Math.max(0,h.dirt-.1); h.foam=Math.min(1,h.foam+.18); h.wet=Math.max(h.wet,.55); }); break;
    case 'enjuagar': if(needLoose()) break; S_(h=>{ h.foam=Math.max(0,h.foam-.3); h.wet=1; h.dirt=Math.max(0,h.dirt-.02); h.frizz=Math.max(.1,h.frizz-.03); }); break;
    case 'acond': S_(h=>{ h.shine=Math.min(1,h.shine+.12); h.frizz=Math.max(0,h.frizz-.1); h.wet=Math.max(h.wet,.6); }); break;
    case 'toalla': S_(h=>{ if(h.wet>.35) h.wet=Math.max(.35,h.wet-.15); }); break;
    case 'tijera': if(needLoose()) break; S_((h,s,x)=>{ const L=+x[1]; if(isFinite(L) && L<h.L-.008){ h.L=Math.max(.025,L); r.cut=true; } }); break;
    case 'maquina': if(needLoose()) break; S_(h=>{ if(h.L>.04){ h.L=.035; r.cut=true; } }); break;
    case 'peine': S_(h=>{ h.frizz=Math.max(0,h.frizz-.15); }); break;
    case 'tinte': if(!col) break; S_(h=>{ h.col=mix(h.col,col,.3); h.mA*=.85; h.tA*=.8; h.shine=Math.max(0,h.shine-.02); }); break;
    case 'mechas': if(!col) break; S_(h=>{ h.mech=h.mech&&h.mA>.05?mix(h.mech,col,.4):col; h.mA=Math.min(1,h.mA+.3); }); break;
    case 'puntas': if(!col) break; S_(h=>{ h.tip=h.tip&&h.tA>.05?mix(h.tip,col,.4):col; h.tA=Math.min(1,h.tA+.3); }); break;
    case 'secador': S_(h=>{ if(h.foam>.3){ r.err='¡Primero enjuagá la espuma! 🚿'; return; } h.wet=Math.max(0,h.wet-.18); if(h.wet<.3) h.frizz=Math.min(1,h.frizz+.015); }); break;
    case 'planchita': case 'ondas': case 'buclera': {
      const goal=a.tool==='planchita'?0:a.tool==='ondas'?1:2;
      S_(h=>{ if(h.wet>.3){ r.err='¡El pelo está mojado! Primero el secador 💨'; return; } if(h.cu<goal) h.cu=Math.min(goal,h.cu+.35); else h.cu=Math.max(goal,h.cu-.35); h.frizz=Math.max(0,h.frizz-.08); h.shine=Math.min(1,h.shine+(goal?0:.05)); });
      break;
    }
    case 'laca': S_(h=>{ h.frizz=Math.max(0,h.frizz-.22); h.shine=Math.min(1,h.shine+.03); }); break;
    case 'peinar': {
      const st=a.st; if(!STYLES[st]) break;
      const e=styleOk(c, st); if(e){ r.err=e; break; }
      if(st!=='suelto' && avg(c.hair.map(h=>h.wet))>.5){ r.err='Primero secá el pelo 💨'; break; }
      c.st=st; r.style=true; break;
    }
    case 'labial': if(reg==='labios' && col){ c.mk.lip = c.mk.lip&&c.mk.lipA>.05 ? mix(c.mk.lip,col,.4) : col; c.mk.lipA=Math.min(1.2,c.mk.lipA+.25); } break;
    case 'sombra': if(/^ojo/.test(reg) && col && !c.face.pep){ c.mk.sh = c.mk.sh&&Math.max(...c.mk.shA)>.05 ? mix(c.mk.sh,col,.35) : col; c.mk.shA[si]=Math.min(1.2,c.mk.shA[si]+.25); } break;
    case 'rubor': if(/^mej/.test(reg) && col){ c.mk.bl=mix(c.mk.bl||col,col,.5); c.mk.blA[si]=Math.min(1.8,c.mk.blA[si]+.2); } break;
    case 'delineador': if(/^ojo/.test(reg) && !c.face.pep) c.mk.ln[si]=Math.min(1,c.mk.ln[si]+.3); break;
    case 'rimel': if(/^ojo/.test(reg) && !c.face.pep) c.mk.rm[si]=Math.min(1,c.mk.rm[si]+.3); break;
    case 'pinza': if(/^ceja/.test(reg)){ c.brow[si]=Math.max(.15,c.brow[si]-.06); c.bmess[si]=Math.max(0,c.bmess[si]-.22); r.ouch=true; } break;
    case 'lapiz': if(/^ceja/.test(reg)){ c.brow[si]=Math.min(1,c.brow[si]+.04); c.bdef[si]=Math.min(1,c.bdef[si]+.3); c.bmess[si]=Math.max(0,c.bmess[si]-.08); } break;
    case 'desmaq':
      if(reg==='labios') c.mk.lipA=Math.max(0,c.mk.lipA-.35);
      else if(/^ojo/.test(reg)){ c.mk.shA[si]=Math.max(0,c.mk.shA[si]-.35); c.mk.ln[si]=Math.max(0,c.mk.ln[si]-.35); c.mk.rm[si]=Math.max(0,c.mk.rm[si]-.35); }
      else if(/^mej/.test(reg)) c.mk.blA[si]=Math.max(0,c.mk.blA[si]-.35);
      else if(/^ceja/.test(reg)) c.bdef[si]=Math.max(0,c.bdef[si]-.35);
      break;
    case 'mascarilla': { const m=MASKREG[reg]; if(m){ c.face.mask[m]=Math.min(1,c.face.mask[m]+.3); c.face.maskMax=Math.max(c.face.maskMax, avg(Object.values(c.face.mask))); } break; }
    case 'esponja': { const m=MASKREG[reg]; if(m && c.face.mask[m]>0){ c.face.mask[m]=Math.max(0,c.face.mask[m]-.35); if(c.face.maskMax>.5) c.face.glow=Math.min(1,c.face.glow+.06); } break; }
    case 'pepinos': if(/^ojo/.test(reg)) c.face.pep=!c.face.pep; break;
    case 'limpieza': { const i=c.face.spots.indexOf(a.spot); if(i>=0){ c.face.spots.splice(i,1); r.pop=true; } break; }
    case 'crema': c.face.glow=Math.min(1,c.face.glow+.1); c.face.red=Math.max(0,c.face.red-.2); break;
    case 'espuma': if(c.beard && (reg==='barba'||reg==='bigote'||reg==='menton')) c.beard.foam=Math.min(1,c.beard.foam+.3); break;
    case 'navaja': {
      const b=c.beard; if(!b || !(reg==='barba'||reg==='bigote'||reg==='menton')) break;
      if(b.foam<.25){ c.face.red=Math.min(1,c.face.red+.2); r.ouch=true; }
      if(reg==='bigote') b.mus=Math.max(0,b.mus-.22); else b.L=Math.max(0,b.L-.22);
      b.foam=Math.max(0,b.foam-.08); break;
    }
    case 'recortar': { const b=c.beard; if(!b) break; if(reg==='bigote') b.mus=Math.min(b.mus,.26); else if(reg==='barba'||reg==='menton'){ b.L=Math.min(b.L,.2); b.neat=1; } break; }
    case 'locion': if(c.beard) c.beard.foam=0; c.face.red=Math.max(0,c.face.red-.5); c.face.glow=Math.min(1,c.face.glow+.04); break;
    case 'remojar': if(a.hand===0||a.hand===1) c.cut[a.hand]=Math.max(0,c.cut[a.hand]-.35); break;
    case 'secunas': if(a.hand===0||a.hand===1) for(let n=a.hand*5;n<a.hand*5+5;n++) c.nails[n].wet=Math.max(0,c.nails[n].wet-.35); break;
    case 'cremamanos': if(a.hand===0||a.hand===1) c.soft[a.hand]=Math.min(1,c.soft[a.hand]+.2); break;
    default: {
      const n=a.nail; if(!(n>=0&&n<10)) break; const nl=c.nails[n];
      if(a.tool==='quitaesm'){ nl.a=Math.max(0,nl.a-.4); nl.chip=Math.max(0,nl.chip-.4); if(nl.a<=0){ nl.col=null; nl.des=null; } nl.wet=0; }
      else if(a.tool==='lima') nl.L=Math.max(.12,nl.L-.06);
      else if(a.tool==='cortaunas') nl.L=Math.min(nl.L,.24);
      else if(a.tool==='esmalte' && col){ nl.col = nl.col&&nl.a>.05&&nl.chip<.05 ? mix(nl.col,col,.5) : col; if(nl.chip>0) nl.chip=Math.max(nl.chip,.01); nl.a=Math.min(1,nl.a+.34); nl.wet=1; }
      else if(a.tool==='diseno' && DESIGNS[a.des]){ if(nl.a<.6) r.err='Primero pintá esa uña con esmalte 💅'; else { nl.des=a.des; nl.wet=Math.max(nl.wet,.5); } }
    }
  }
  if(a.tool==='acc' && ACC[a.acc]){ const i=c.acc.indexOf(a.acc); if(i>=0) c.acc.splice(i,1); else { c.acc.push(a.acc); if(a.acc==='piri') c.acc=c.acc.filter(x=>x!=='corona'&&x!=='vincha'); if(a.acc==='corona'||a.acc==='vincha') c.acc=c.acc.filter(x=>x!=='piri'); } }
  return r;
}

/* ---------- puntaje ---------- */
const PRICE={lavar:20000, secar:15000, corte:45000, color:150000, mechas:180000, puntas:120000, rizo:60000, peinado:70000, labios:25000, sombra:30000, rubor:15000,
  delineado:20000, rimel:15000, cejas:30000, facial:90000, afeitar:30000, barba:35000, bigote:15000, unas:60000, manos:25000, acc:20000};
const CORTES={hombros:'a la altura de los hombros', carre:'carré (a la altura del mentón)', corto:'bien cortito', clasico:'clásico corto', degrade:'degradé (costados rapados, arriba más largo)', militar:'militar (todo rapadito)', flequillo:'con flequillo (lo demás, igual)', despuntar:'solo despuntar'};
function taskText(t){
  const sw = c => `<i class="sw" style="background:${c}"></i>`;
  switch(t.k){
    case 'lavar': return '🧴 Lavar el pelo y enjuagar toda la espuma';
    case 'secar': return '💨 Secar el pelo';
    case 'corte': return '✂️ Corte '+CORTES[t.tipo];
    case 'color': return `🖌️ Teñir de ${colName('tinte',t.col)} ${sw(t.col)}`;
    case 'mechas': return `✨ Mechas ${colName('tinte',t.col)} ${sw(t.col)}`;
    case 'puntas': return `🌈 Puntas ${colName('tinte',t.col)} ${sw(t.col)}`;
    case 'rizo': return ['🔥 Pelo lacio (planchita)','〰️ Ondas','🌀 Rulos (buclera)'][t.cu];
    case 'peinado': return 'Peinado: '+STYLES[t.st];
    case 'labios': return `💄 Labios ${colName('labial',t.col)} ${sw(t.col)}`;
    case 'sombra': return `👁️ Sombra ${colName('sombra',t.col)} ${sw(t.col)}`;
    case 'rubor': return '🌸 Un poquito de rubor';
    case 'delineado': return '✒️ Ojos delineados';
    case 'rimel': return '🖍️ Rímel en las pestañas';
    case 'cejas': return '🤏 Arreglar las cejas (finitas y prolijas)';
    case 'facial': return '🧖 Limpieza facial: granitos, mascarilla y sacarla';
    case 'afeitar': return '🪒 Afeitar barba y bigote (¡con espuma!)';
    case 'barba': return '🧔 Barba cortita y prolija (recortadora)';
    case 'bigote': return '👨 Dejar el bigote, recortado';
    case 'unas': return `💅 Uñas ${t.col?colName('esmalte',t.col)+' '+sw(t.col):''}${t.des?' con '+DESIGNS[t.des]+(t.n<10?` en ${t.n} uñas`:''):''}${t.corto?' (cortitas)':''}`;
    case 'manos': return '🤲 Manos: remojar las cutículas y crema';
    case 'acc': return `${ACC[t.id].e} Ponerle: ${ACC[t.id].n}`;
  }
  return t.k;
}
function cutTarget(tipo, s, orig){
  const y=Math.abs(sec2yaw(s)), sideSec=y>=56&&y<=124, top=y<56;
  switch(tipo){
    case 'hombros': return [.43,.53];
    case 'carre': return [.32,.4];
    case 'corto': return [.08,.16];
    case 'clasico': return [.07,.16];
    case 'degrade': return sideSec||y>124 ? [0,.05] : [.12,.24];
    case 'militar': return top ? [.04,.1] : [0,.05];
    case 'flequillo': return isFrontSec(s) ? [.1,.21] : [orig[s]-.08, orig[s]+.01];
    case 'despuntar': return [orig[s]-.12, orig[s]-.03];
  }
  return [0,1];
}
const sc01 = v => clamp(v,0,1);
function scoreTask(c, t){
  const H=c.hair, live=H.filter(h=>h.L>.05);
  switch(t.k){
    case 'lavar': { const d=avg(H.map(h=>h.dirt)), f=avg(H.map(h=>h.foam));
      return {s:sc01(1-d*1.4-f*1.6), bad: f>.15 ? 'Me quedó espuma en el pelo 🫧' : d>.2 ? 'Todavía tengo el pelo sucio 😕' : null}; }
    case 'secar': { const w=avg(H.map(h=>h.wet)), d=avg(H.map(h=>h.dirt)); if(d>.25) return {s:0, bad:'Ni me lavaste ni me secaste el pelo'}; return {s:sc01(1-w*1.5), bad: w>.2 ? '¡Me mandás con el pelo mojado! 💦' : null}; }
    case 'corte': { let sum=0, short=0, long=0; const o=c.orig.L;
      for(let s=0;s<NSEC;s++){ const [lo,hi]=cutTarget(t.tipo,s,o), L=H[s].L; if(L<lo){ sum+=sc01(1-(lo-L)/.12); short++; } else if(L>hi){ sum+=sc01(1-(L-hi)/.12); long++; } else sum+=1; }
      return {s:sum/NSEC, bad: short>4 ? '¡Me cortaste demasiado! 😢' : long>4 ? 'Te faltó cortar 🤔' : null}; }
    case 'color': { const d=avg(live.map(h=>dE(h.col,t.col))); return {s:sc01(1-(d-7)/28), bad: d>20 ? 'Este no es el color que te pedí 😕' : null}; }
    case 'mechas': { const v=H.reduce((a,h)=>a+(h.mech&&h.mA>.2&&dE(h.mech,t.col)<22?Math.min(1,h.mA):0),0)/(NSEC*.5); return {s:sc01(v), bad:v<.6?'Casi no se notan las mechas':null}; }
    case 'puntas': { const v=H.reduce((a,h)=>a+(h.tip&&h.tA>.2&&dE(h.tip,t.col)<22?Math.min(1,h.tA):0),0)/(NSEC*.7); return {s:sc01(v), bad:v<.6?'Faltan pintar puntas':null}; }
    case 'rizo': { const l=live.filter(h=>h.L>.15); const v=l.length ? l.filter(h=>Math.abs(h.cu-t.cu)<.36).length/l.length : 0;
      return {s:sc01(v*1.1), bad:v<.7?['No quedó lacio del todo','Faltan ondas','Faltan rulos'][t.cu]:null}; }
    case 'peinado': { const ok=c.st===t.st, fz=avg(H.map(h=>h.frizz)); return {s:ok?sc01(1.15-fz*.6):0, bad:!ok?'¡Yo quería '+STYLES[t.st].slice(3).toLowerCase()+'!':fz>.5?'Quedó con mucho frizz':null}; }
    case 'labios': { const a=Math.min(1,c.mk.lipA), d=c.mk.lip?dE(c.mk.lip,t.col):99; return {s:sc01(a*1.15)*sc01(1-(d-8)/30), bad:a<.6?'Me falta labial':d>20?'Ese no es el color de labial que quería':null}; }
    case 'sombra': { const a=Math.min(1,Math.min(...c.mk.shA)), d=c.mk.sh?dE(c.mk.sh,t.col):99; return {s:sc01(a*1.15)*sc01(1-(d-8)/30), bad:a<.6?'Falta sombra en un ojo':d>20?'No es la sombra que pedí':null}; }
    case 'rubor': { const a=Math.min(...c.mk.blA), m=Math.max(...c.mk.blA); return {s:m>1.3?.4:sc01(a*1.6), bad:m>1.3?'¡Parezco payaso con tanto rubor! 🤡':a<.4?'Falta rubor':null}; }
    case 'delineado': { const a=Math.min(...c.mk.ln); return {s:sc01(a*1.3), bad:a<.6?'Falta delinear':null}; }
    case 'rimel': { const a=Math.min(...c.mk.rm); return {s:sc01(a*1.3), bad:a<.6?'Falta rímel':null}; }
    case 'cejas': { let v=0; for(let i=0;i<2;i++){ const b=c.brow[i]; v+=(b>=.3&&b<=.58?1:sc01(1-Math.min(Math.abs(b-.3),Math.abs(b-.58))/.25))*(1-c.bmess[i]*.6); } v/=2;
      return {s:v, bad:Math.min(...c.brow)<.25?'¡Me dejaste sin cejas! 😱':Math.max(...c.bmess)>.4||Math.max(...c.brow)>.62?'Las cejas siguen desprolijas':null}; }
    case 'facial': { const f=c.face, sp=f.spots0?1-f.spots.length/f.spots0:1, mk=sc01(f.maskMax/.8), rm=sc01(1-avg(Object.values(f.mask))*2);
      return {s:sp*.4+mk*.3+rm*.15+sc01(f.glow/.3)*.15, bad:f.spots.length?'Todavía tengo granitos':f.maskMax<.6?'Faltó la mascarilla':rm<.7?'¡Me quedó la mascarilla puesta! 🍵':null}; }
    case 'afeitar': { const b=c.beard||{L:0,mus:0}; return {s:sc01(1-(b.L+b.mus)/.35)*(1-c.face.red*.4), bad:b.L+b.mus>.15?'Quedan pelos de la barba':c.face.red>.3?'Me raspaste toda la cara 😣':null}; }
    case 'barba': { const b=c.beard; if(!b) return {s:1}; const ok=b.L>=.1&&b.L<=.24; return {s:(ok?1:b.L<.1?sc01(b.L/.1):sc01(1-(b.L-.24)/.2))*(b.neat?1:.6), bad:b.L<.08?'¡Yo quería dejarme la barba!':!ok||!b.neat?'La barba quedó desprolija':null}; }
    case 'bigote': { const b=c.beard; if(!b) return {s:1}; const ok=b.mus>=.15&&b.mus<=.3; return {s:ok?1:b.mus<.15?sc01(b.mus/.15):.5, bad:b.mus<.1?'¡Me sacaste el bigote! 😭':!ok?'El bigote quedó muy largo':null}; }
    case 'unas': { const N=c.nails;
      const old=1-avg(N.map(n=>n.chip))*1.5, cov=avg(N.map(n=>Math.min(1,n.a/.95)*(t.col&&n.col?sc01(1-(dE(n.col,t.col)-8)/30):1)));
      const des=t.des?Math.min(1,N.filter(n=>n.des===t.des).length/t.n):1, dry=1-avg(N.map(n=>n.wet))*1.5, len=t.corto?avg(N.map(n=>n.L<=.3?1:sc01(1-(n.L-.3)/.2))):avg(N.map(n=>n.L<=.62?1:.5));
      return {s:sc01(old)*.2+cov*.4+des*.2+sc01(dry)*.1+len*.1, bad:old<.8?'Me quedó el esmalte viejo 😕':cov<.8?'Faltan pintar uñas':des<1?'Faltan los dibujitos':dry<.7?'¡Se me corrió el esmalte! Estaba mojado 💦':len<.8?'Las uñas quedaron largas':null}; }
    case 'manos': { const v=avg([1-c.cut[0],1-c.cut[1],c.soft[0],c.soft[1]]); return {s:sc01(v*1.4), bad:v<.6?'Las manos quedaron ásperas':null}; }
    case 'acc': return {s:c.acc.includes(t.id)?1:0, bad:c.acc.includes(t.id)?null:'¿Y '+(ACC[t.id].n.toLowerCase())+'?'};
  }
  return {s:1};
}
const GOOD=['¡Me encantó! 😍','¡Iporãite! (¡qué lindo!) 🤩','¡Quedé divina! 💖','¡Esto es justo lo que quería! 🥰','¡Mi comadre se va a morir de envidia! 😂'];
const GOODM=['¡Quedé facherito! 😎','¡Iporã, che ra\'a! 👍','¡Excelente trabajo, maestro! 🤝'];
const MEH=['Está bien, nomás 🙂','No está mal… 🤔','Mmm, más o menos 😐'];
const BAD=['¡Qué desastre! 😭','¡No vuelvo más acá! 😤','¡Mi marido no me va a reconocer! 😱'];
function evalClient(c, req, libre){
  if(libre || !req) return {tasks:[], score:1, stars:5, pay:0, tip:0, say:pickR(c.sex==='m'?GOODM:GOOD)};
  const tasks=req.tasks.map((t,i)=>{ const r=scoreTask(c,t); return {i, t:taskText(t).replace(/<[^>]*>/g,'').trim(), k:t.k, s:+r.s.toFixed(3), bad:r.s<.75?r.bad:null, price:PRICE[t.k]||20000}; });
  let score=avg(tasks.map(t=>t.s)); const extra=[];
  const ks=req.tasks.map(t=>t.k);
  if(!ks.some(k=>k==='color'||k==='mechas'||k==='puntas') && avg(c.hair.filter(h=>h.L>.05).map(h=>dE(h.col,c.orig.col)))>18){ score-=.15; extra.push('¡Yo no te pedí cambiar el color del pelo! 😠'); }
  if(!ks.includes('corte') && avg(c.hair.map((h,i)=>c.orig.L[i]-h.L))>.08){ score-=.2; extra.push('¡¿Quién te dijo que me cortes el pelo?! 😡'); }
  if(!ks.includes('secar') && avg(c.hair.map(h=>h.wet))>.4){ score-=.1; extra.push('Me voy con el pelo mojado 💦'); }
  if(!ks.includes('lavar') && avg(c.hair.map(h=>h.foam))>.2){ score-=.1; extra.push('¡Me quedó espuma en la cabeza! 🫧'); }
  if(c.face.red>.4 && !ks.includes('afeitar')){ score-=.08; extra.push('Me quedó la cara toda roja 😣'); }
  if(c.face.pep){ score-=.05; extra.push('Me olvidaste los pepinos en los ojos 🥒😂'); }
  score=clamp(score,0,1);
  const stars=clamp(Math.round(score*5+.15),1,5);
  const base=tasks.reduce((a,t)=>a+t.price,0);
  const pay=Math.round(base*Math.pow(score,1.3)/1000)*1000;
  const tip=stars>=5?Math.round(pay*.2/1000)*1000:stars===4?Math.round(pay*.1/1000)*1000:0;
  const say=stars>=4?pickR(c.sex==='m'?GOODM:GOOD):stars===3?pickR(MEH):pickR(BAD);
  return {tasks, extra, score:+score.toFixed(3), stars, pay, tip, say};
}
const gs = n => 'Gs. '+String(Math.round(n||0)).replace(/\B(?=(\d{3})+(?!\d))/g,'.');
