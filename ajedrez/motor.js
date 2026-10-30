'use strict';
/* =====================================================================
   Ajedrez y Damas PY — motor de reglas y bots.
   Ajedrez: reglas completas (enroque, al paso, coronación, jaque mate,
   ahogado, 50 jugadas, triple repetición y material insuficiente).
   Damas 8x8: inglesa, latina y brasileña, captura obligatoria y ley de la
   mayoría. Los bots buscan con alfa-beta y su fuerza sale del ELO elegido.
   Este mismo archivo corre como Web Worker para que el bot piense sin
   trabar la pantalla.
   ===================================================================== */
(function(G){
const MATE=30000, INF=32000;
const rand = n => Math.floor(Math.random()*n);

/* ---------- niveles por ELO ----------
   ajedrez / damas: [profundidad, milisegundos, ruido (centésimas de peón), probabilidad de error] */
const NIVELES=[
  {elo:400,  n:'Principiante',          e:'🐣', a:[1,300,350,.40],  d:[1,300,300,.40]},
  {elo:600,  n:'Novato',                e:'🌱', a:[1,400,220,.25],  d:[2,400,200,.25]},
  {elo:800,  n:'Aprendiz',              e:'📘', a:[2,500,150,.15],  d:[3,500,130,.15]},
  {elo:1000, n:'Aficionado',            e:'🙂', a:[2,600,90,.08],   d:[4,600,80,.08]},
  {elo:1200, n:'Jugador de club',       e:'♟️', a:[3,800,60,.05],   d:[5,800,50,.05]},
  {elo:1400, n:'Intermedio',            e:'😎', a:[3,1000,35,.025], d:[6,1000,30,.025]},
  {elo:1600, n:'Avanzado',              e:'🔥', a:[4,1200,20,.01],  d:[7,1200,15,.01]},
  {elo:1800, n:'Experto',               e:'🧠', a:[5,1800,0,0],     d:[8,1500,0,0]},
  {elo:2000, n:'Candidato a Maestro',   e:'🎖️', a:[6,2500,0,0],     d:[10,2000,0,0]},
  {elo:2200, n:'Maestro FIDE',          e:'🏅', a:[8,3500,0,0],     d:[12,3000,0,0]},
  {elo:2400, n:'Maestro Internacional', e:'🥈', a:[12,5000,0,0],    d:[16,4000,0,0]},
  {elo:2600, n:'Gran Maestro',          e:'👑', a:[30,7000,0,0],    d:[30,6000,0,0]},
];
const nivel = elo => NIVELES.reduce((a,b)=>Math.abs(b.elo-elo)<Math.abs(a.elo-elo)?b:a);

/* ====================================================================
   AJEDREZ (tablero 0x88: casilla = fila*16 + columna; fila 0 = la 1)
   ==================================================================== */
const P=1,N=2,B=3,R=4,Q=5,K=6,BLK=8, EP=1,CAS=2,DBL=4;
const VAL=[0,100,320,330,500,900,0], PHW=[0,0,1,1,2,4,0];
const T = s => s.trim().split(/\s+/).map(Number);
// tablas de posición (vistas desde las blancas, la fila 8 primero)
const PST=[null,
T(`0 0 0 0 0 0 0 0  50 50 50 50 50 50 50 50  10 10 20 30 30 20 10 10  5 5 10 25 25 10 5 5
   0 0 0 20 20 0 0 0  5 -5 -10 0 0 -10 -5 5  5 10 10 -20 -20 10 10 5  0 0 0 0 0 0 0 0`),
T(`-50 -40 -30 -30 -30 -30 -40 -50  -40 -20 0 0 0 0 -20 -40  -30 0 10 15 15 10 0 -30  -30 5 15 20 20 15 5 -30
   -30 0 15 20 20 15 0 -30  -30 5 10 15 15 10 5 -30  -40 -20 0 5 5 0 -20 -40  -50 -40 -30 -30 -30 -30 -40 -50`),
T(`-20 -10 -10 -10 -10 -10 -10 -20  -10 0 0 0 0 0 0 -10  -10 0 5 10 10 5 0 -10  -10 5 5 10 10 5 5 -10
   -10 0 10 10 10 10 0 -10  -10 10 10 10 10 10 10 -10  -10 5 0 0 0 0 5 -10  -20 -10 -10 -10 -10 -10 -10 -20`),
T(`0 0 0 0 0 0 0 0  5 10 10 10 10 10 10 5  -5 0 0 0 0 0 0 -5  -5 0 0 0 0 0 0 -5
   -5 0 0 0 0 0 0 -5  -5 0 0 0 0 0 0 -5  -5 0 0 0 0 0 0 -5  0 0 0 5 5 0 0 0`),
T(`-20 -10 -10 -5 -5 -10 -10 -20  -10 0 0 0 0 0 0 -10  -10 0 5 5 5 5 0 -10  -5 0 5 5 5 5 0 -5
   0 0 5 5 5 5 0 -5  -10 5 5 5 5 5 0 -10  -10 0 5 0 0 0 0 -10  -20 -10 -10 -5 -5 -10 -10 -20`),
];
const KMG=T(`-30 -40 -40 -50 -50 -40 -40 -30  -30 -40 -40 -50 -50 -40 -40 -30  -30 -40 -40 -50 -50 -40 -40 -30  -30 -40 -40 -50 -50 -40 -40 -30
   -20 -30 -30 -40 -40 -30 -30 -20  -10 -20 -20 -20 -20 -20 -20 -10  20 20 0 0 0 0 20 20  20 30 10 0 0 10 30 20`);
const KEG=T(`-50 -40 -30 -20 -20 -30 -40 -50  -30 -20 -10 0 0 -10 -20 -30  -30 -10 20 30 30 20 -10 -30  -30 -10 30 40 40 30 -10 -30
   -30 -10 30 40 40 30 -10 -30  -30 -10 20 30 30 20 -10 -30  -30 -30 0 0 0 0 -30 -30  -50 -30 -30 -30 -30 -30 -30 -50`);
const PASS=[0,5,10,18,30,50,80,0];
const KN=[33,31,18,14,-33,-31,-18,-14], KG=[1,-1,16,-16,15,17,-15,-17], BD=[15,17,-15,-17], RD=[1,-1,16,-16];
const CM=new Int8Array(128).fill(15); CM[0]=13; CM[4]=12; CM[7]=14; CM[112]=7; CM[116]=3; CM[119]=11;
// claves al azar para reconocer posiciones (zobrist)
let sd=2463534242;
function r32(){ sd^=sd<<13; sd>>>=0; sd^=sd>>>17; sd^=sd<<5; sd>>>=0; return sd|0; }
const ZP1=new Int32Array(16*128).map(r32), ZP2=new Int32Array(16*128).map(r32);
const ZC1=new Int32Array(16).map(r32), ZC2=new Int32Array(16).map(r32);
const ZE1=new Int32Array(128).map(r32), ZE2=new Int32Array(128).map(r32);
const ZS1=r32(), ZS2=r32();
const FILES='abcdefgh';
const sqName = s => FILES[s&7]+((s>>4)+1);
const to88 = i => (i>>3)*16+(i&7), from88 = s => (s>>4)*8+(s&7);
const START='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function cParse(fen){
  const [bd, side, cas, ep, half, full]=String(fen||START).split(' ');
  const b=new Int8Array(128); let r=7, f=0;
  for(const ch of bd){
    if(ch==='/'){ r--; f=0; continue; }
    if(ch>='1' && ch<='8'){ f+=+ch; continue; }
    const lo=ch.toLowerCase(), t='.pnbrqk'.indexOf(lo);
    if(t>0 && r>=0 && f<8) b[r*16+f]=t|(ch===lo?BLK:0); f++;
  }
  const p={b, side:side==='b'?BLK:0, cas:0, ep:-1, half:+half||0, full:+full||1, k:[4,116], st:[], h1:0, h2:0};
  if(cas){ if(cas.includes('K')) p.cas|=1; if(cas.includes('Q')) p.cas|=2; if(cas.includes('k')) p.cas|=4; if(cas.includes('q')) p.cas|=8; }
  if(ep && ep!=='-') p.ep=(+ep[1]-1)*16+FILES.indexOf(ep[0]);
  for(let s=0;s<128;s++){ if(s&0x88){ s+=7; continue; } if((b[s]&7)===K) p.k[b[s]&BLK?1:0]=s; }
  hashAll(p); return p;
}
function hashAll(p){
  let h1=0, h2=0;
  for(let s=0;s<128;s++){ if(s&0x88){ s+=7; continue; } const pc=p.b[s]; if(pc){ h1^=ZP1[pc*128+s]; h2^=ZP2[pc*128+s]; } }
  if(p.side){ h1^=ZS1; h2^=ZS2; }
  h1^=ZC1[p.cas]; h2^=ZC2[p.cas];
  if(p.ep>=0){ h1^=ZE1[p.ep]; h2^=ZE2[p.ep]; }
  p.h1=h1; p.h2=h2;
}
function cFen(p){
  let s='';
  for(let r=7;r>=0;r--){ let e=0;
    for(let f=0;f<8;f++){ const pc=p.b[r*16+f]; if(!pc){ e++; continue; } if(e){ s+=e; e=0; } const ch='.pnbrqk'[pc&7]; s+= pc&BLK ? ch : ch.toUpperCase(); }
    if(e) s+=e; if(r) s+='/'; }
  const c=(p.cas&1?'K':'')+(p.cas&2?'Q':'')+(p.cas&4?'k':'')+(p.cas&8?'q':'')||'-';
  return s+' '+(p.side?'b':'w')+' '+c+' '+(p.ep>=0?sqName(p.ep):'-')+' '+p.half+' '+p.full;
}
function cAtt(b, sq, by){
  let s;
  if(by){ s=sq+15; if(!(s&0x88) && b[s]===(P|BLK)) return true; s=sq+17; if(!(s&0x88) && b[s]===(P|BLK)) return true; }
  else { s=sq-15; if(!(s&0x88) && b[s]===P) return true; s=sq-17; if(!(s&0x88) && b[s]===P) return true; }
  for(let i=0;i<8;i++){ s=sq+KN[i]; if(!(s&0x88) && b[s]===(N|by)) return true; s=sq+KG[i]; if(!(s&0x88) && b[s]===(K|by)) return true; }
  for(let i=0;i<4;i++){
    let d=BD[i]; s=sq+d;
    while(!(s&0x88)){ const x=b[s]; if(x){ if(x===(B|by) || x===(Q|by)) return true; break; } s+=d; }
    d=RD[i]; s=sq+d;
    while(!(s&0x88)){ const x=b[s]; if(x){ if(x===(R|by) || x===(Q|by)) return true; break; } s+=d; }
  }
  return false;
}
const mv = (fr,to,pr,fl) => fr | (to<<7) | ((pr||0)<<14) | ((fl||0)<<17);
function cGen(p, out, caps){
  const b=p.b, us=p.side, them=us^BLK;
  for(let sq=0;sq<128;sq++){
    if(sq&0x88){ sq+=7; continue; }
    const pc=b[sq]; if(!pc || (pc&BLK)!==us) continue;
    const t=pc&7;
    if(t===P){
      const dir=us?-16:16, last=us?0:7, start=us?6:1, one=sq+dir;
      if(!(one&0x88) && !b[one]){
        if((one>>4)===last){ out.push(mv(sq,one,Q)); if(!caps){ out.push(mv(sq,one,N), mv(sq,one,R), mv(sq,one,B)); } }
        else if(!caps){ out.push(mv(sq,one)); if((sq>>4)===start && !b[one+dir]) out.push(mv(sq,one+dir,0,DBL)); }
      }
      for(const to of [one-1, one+1]){
        if(to&0x88) continue;
        const x=b[to];
        if(x && (x&BLK)===them){ if((to>>4)===last){ out.push(mv(sq,to,Q)); if(!caps) out.push(mv(sq,to,N), mv(sq,to,R), mv(sq,to,B)); } else out.push(mv(sq,to)); }
        else if(to===p.ep) out.push(mv(sq,to,0,EP));
      }
    } else if(t===N || t===K){
      const D=t===N?KN:KG;
      for(let i=0;i<8;i++){ const to=sq+D[i]; if(to&0x88) continue; const x=b[to]; if(!x){ if(!caps) out.push(mv(sq,to)); } else if((x&BLK)===them) out.push(mv(sq,to)); }
      if(t===K && !caps){
        if(!us){
          if((p.cas&1) && !b[5] && !b[6] && b[7]===R && !cAtt(b,4,BLK) && !cAtt(b,5,BLK) && !cAtt(b,6,BLK)) out.push(mv(4,6,0,CAS));
          if((p.cas&2) && !b[3] && !b[2] && !b[1] && b[0]===R && !cAtt(b,4,BLK) && !cAtt(b,3,BLK) && !cAtt(b,2,BLK)) out.push(mv(4,2,0,CAS));
        } else {
          if((p.cas&4) && !b[117] && !b[118] && b[119]===(R|BLK) && !cAtt(b,116,0) && !cAtt(b,117,0) && !cAtt(b,118,0)) out.push(mv(116,118,0,CAS));
          if((p.cas&8) && !b[115] && !b[114] && !b[113] && b[112]===(R|BLK) && !cAtt(b,116,0) && !cAtt(b,115,0) && !cAtt(b,114,0)) out.push(mv(116,114,0,CAS));
        }
      }
    } else {
      const D = t===B ? BD : t===R ? RD : KG;
      for(let i=0;i<D.length;i++){ const d=D[i]; let to=sq+d;
        while(!(to&0x88)){ const x=b[to]; if(!x){ if(!caps) out.push(mv(sq,to)); } else { if((x&BLK)===them) out.push(mv(sq,to)); break; } to+=d; } }
    }
  }
  return out;
}
function cMake(p, m){
  const b=p.b, fr=m&127, to=(m>>7)&127, pr=(m>>14)&7, fl=m>>>17, us=p.side, pc=b[fr];
  const capSq = fl&EP ? (us ? to+16 : to-16) : to, cap=b[capSq];
  p.st.push([m, pc, cap, p.cas, p.ep, p.half, p.h1, p.h2]);
  let h1=p.h1, h2=p.h2;
  if(p.ep>=0){ h1^=ZE1[p.ep]; h2^=ZE2[p.ep]; }
  h1^=ZC1[p.cas]; h2^=ZC2[p.cas];
  if(cap){ b[capSq]=0; h1^=ZP1[cap*128+capSq]; h2^=ZP2[cap*128+capSq]; }
  b[fr]=0; h1^=ZP1[pc*128+fr]; h2^=ZP2[pc*128+fr];
  const np = pr ? (pr|us) : pc; b[to]=np; h1^=ZP1[np*128+to]; h2^=ZP2[np*128+to];
  if(fl&CAS){ const rf = to>fr ? fr+3 : fr-4, rt = to>fr ? fr+1 : fr-1, rk=b[rf];
    b[rf]=0; b[rt]=rk; h1^=ZP1[rk*128+rf]^ZP1[rk*128+rt]; h2^=ZP2[rk*128+rf]^ZP2[rk*128+rt]; }
  if((pc&7)===K) p.k[us?1:0]=to;
  p.cas &= CM[fr] & CM[to];
  h1^=ZC1[p.cas]; h2^=ZC2[p.cas];
  p.ep = fl&DBL ? (fr+to)>>1 : -1;
  if(p.ep>=0){ h1^=ZE1[p.ep]; h2^=ZE2[p.ep]; }
  p.half = ((pc&7)===P || cap) ? 0 : p.half+1;
  if(us) p.full++;
  p.side=us^BLK; h1^=ZS1; h2^=ZS2;
  p.h1=h1; p.h2=h2;
}
function cUnmake(p){
  const [m, pc, cap, cas, ep, half, h1, h2]=p.st.pop();
  const b=p.b, fr=m&127, to=(m>>7)&127, fl=m>>>17;
  p.side^=BLK; const us=p.side;
  if(us) p.full--;
  b[to]=0; b[fr]=pc;
  if(fl&EP) b[us ? to+16 : to-16]=cap; else b[to]=cap;
  if(fl&CAS){ const rf = to>fr ? fr+3 : fr-4, rt = to>fr ? fr+1 : fr-1; b[rf]=b[rt]; b[rt]=0; }
  if((pc&7)===K) p.k[us?1:0]=fr;
  p.cas=cas; p.ep=ep; p.half=half; p.h1=h1; p.h2=h2;
}
function nullMake(p){ p.st.push([0,0,0,p.cas,p.ep,p.half,p.h1,p.h2]); if(p.ep>=0){ p.h1^=ZE1[p.ep]; p.h2^=ZE2[p.ep]; } p.ep=-1; p.side^=BLK; p.h1^=ZS1; p.h2^=ZS2; }
function nullUnmake(p){ const s=p.st.pop(); p.side^=BLK; p.ep=s[4]; p.h1=s[6]; p.h2=s[7]; }
const inCheck = p => cAtt(p.b, p.k[p.side?1:0], p.side^BLK);
function cLegal(p){
  const all=cGen(p,[],false), res=[], us=p.side;
  for(const m of all){ cMake(p,m); if(!cAtt(p.b, p.k[us?1:0], us^BLK)) res.push(m); cUnmake(p); }
  return res;
}
function cInsuf(p){
  const minors=[];
  for(let s=0;s<128;s++){ if(s&0x88){ s+=7; continue; } const t=p.b[s]&7; if(!t || t===K) continue;
    if(t===P || t===R || t===Q) return false; minors.push([t, ((s>>4)+(s&7))&1]); }
  if(minors.length<=1) return true;
  return minors.every(x=>x[0]===B) && minors.every(x=>x[1]===minors[0][1]);
}
// ¿ese color todavía puede dar mate? (para cuando al otro se le acaba el tiempo)
function cCanMate(p, white){
  let n=0, heavy=false;
  for(let s=0;s<128;s++){ if(s&0x88){ s+=7; continue; } const pc=p.b[s]; if(!pc || (pc&7)===K || !!(pc&BLK)===white) continue; n++; if((pc&7)!==N && (pc&7)!==B) heavy=true; }
  return heavy || n>=2;
}

/* ---------- evaluación ---------- */
function cEval(p){
  const b=p.b; let s=0, ph=0, kmg=0, keg=0, pmg=0, peg=0, bw=0, bb=0;
  const wMin=[8,8,8,8,8,8,8,8], bMax=[-1,-1,-1,-1,-1,-1,-1,-1], wc=[0,0,0,0,0,0,0,0], bc=[0,0,0,0,0,0,0,0], pw=[], pb=[];
  for(let sq=0;sq<128;sq++){
    if(sq&0x88){ sq+=7; continue; }
    const pc=b[sq]; if(!pc) continue;
    const t=pc&7, r=sq>>4, f=sq&7;
    if(pc&BLK){ const i=r*8+f;
      if(t===K){ kmg-=KMG[i]; keg-=KEG[i]; } else { s-=VAL[t]+PST[t][i]; ph+=PHW[t]; }
      if(t===P){ bc[f]++; if(r>bMax[f]) bMax[f]=r; pb.push(sq); } else if(t===B) bb++;
    } else { const i=(7-r)*8+f;
      if(t===K){ kmg+=KMG[i]; keg+=KEG[i]; } else { s+=VAL[t]+PST[t][i]; ph+=PHW[t]; }
      if(t===P){ wc[f]++; if(r<wMin[f]) wMin[f]=r; pw.push(sq); } else if(t===B) bw++;
    }
  }
  if(ph>24) ph=24;
  for(const sq of pw){ const r=sq>>4, f=sq&7; let passed=true;
    for(let ff=f-1; ff<=f+1; ff++) if(ff>=0 && ff<8 && bMax[ff]>r){ passed=false; break; }
    if(passed){ pmg+=PASS[r]>>1; peg+=PASS[r]; }
    if((f===0 || !wc[f-1]) && (f===7 || !wc[f+1])) s-=12; }
  for(const sq of pb){ const r=sq>>4, f=sq&7; let passed=true;
    for(let ff=f-1; ff<=f+1; ff++) if(ff>=0 && ff<8 && wMin[ff]<r){ passed=false; break; }
    if(passed){ pmg-=PASS[7-r]>>1; peg-=PASS[7-r]; }
    if((f===0 || !bc[f-1]) && (f===7 || !bc[f+1])) s+=12; }
  for(let f=0;f<8;f++){ if(wc[f]>1) s-=10*(wc[f]-1); if(bc[f]>1) s+=10*(bc[f]-1); }
  if(bw>=2) s+=30; if(bb>=2) s-=30;
  s += ((kmg+pmg)*ph + (keg+peg)*(24-ph))/24;
  if(ph<=8){ // final: arrinconar al rey del que pierde para poder dar mate
    if(s>250) s+=mopUp(p.k[1], p.k[0]); else if(s<-250) s-=mopUp(p.k[0], p.k[1]);
  }
  return ((p.side ? -s : s) + 10)|0;
}
function mopUp(loser, winner){
  const r=loser>>4, f=loser&7, cd=Math.max(3-r, r-4)+Math.max(3-f, f-4);
  const dist=Math.abs((loser>>4)-(winner>>4))+Math.abs((loser&7)-(winner&7));
  return 10*cd + 4*(14-dist);
}

/* ---------- búsqueda ---------- */
const TTN=1<<19, TTM=TTN-1;
let tK, tM, tS, tD, tF;
function ttInit(){ if(!tK){ tK=new Int32Array(TTN); tM=new Int32Array(TTN); tS=new Int32Array(TTN); tD=new Int8Array(TTN); tF=new Int8Array(TTN); } }
function cSearch(p, cfg){
  ttInit();
  const t0=Date.now(), ms=cfg.ms||1000, maxD=cfg.depth||4;
  let nodes=0, stop=false, rootBest=0;
  const killers=new Int32Array(256), histT=new Int32Array(16*128);
  const path=(cfg.hist||[]).slice();
  const root=cLegal(p);
  if(!root.length) return null;
  if(root.length===1) return {m:root[0], d:0, s:0};
  function isRep(){ const h=p.h1; for(let i=path.length-1, k=0; i>=0 && k<p.half; i--, k++) if(path[i]===h) return true; return false; }
  function order(moves, ttm, ply){
    const b=p.b, sc=new Int32Array(moves.length);
    for(let i=0;i<moves.length;i++){ const m=moves[i];
      if(m===ttm){ sc[i]=3e6; continue; }
      const fr=m&127, to=(m>>7)&127, cap=b[to], fl=m>>>17, pr=(m>>14)&7;
      if(cap || (fl&EP)) sc[i]=2e6 + VAL[cap?cap&7:P]*10 - (VAL[b[fr]&7]||1000)/10;
      else if(pr) sc[i]=1.9e6+pr;
      else if(m===killers[ply*2]) sc[i]=1.8e6;
      else if(m===killers[ply*2+1]) sc[i]=1.7e6;
      else sc[i]=histT[b[fr]*128+to];
    }
    return sc;
  }
  function pickNext(moves, sc, i){
    let bi=i; for(let j=i+1;j<moves.length;j++) if(sc[j]>sc[bi]) bi=j;
    if(bi!==i){ const tm=moves[i]; moves[i]=moves[bi]; moves[bi]=tm; const ts=sc[i]; sc[i]=sc[bi]; sc[bi]=ts; }
    return moves[i];
  }
  function qs(alpha, beta, ply){
    if((++nodes&2047)===0 && Date.now()-t0>ms) stop=true;
    if(stop) return 0;
    const stand=cEval(p);
    if(stand>=beta) return stand;
    if(stand>alpha) alpha=stand;
    if(ply>48) return stand;
    const moves=cGen(p,[],true), sc=order(moves,0,Math.min(ply,127)), us=p.side;
    for(let i=0;i<moves.length;i++){
      const m=pickNext(moves,sc,i);
      cMake(p,m);
      if(cAtt(p.b, p.k[us?1:0], us^BLK)){ cUnmake(p); continue; }
      const v=-qs(-beta,-alpha,ply+1);
      cUnmake(p);
      if(stop) return 0;
      if(v>=beta) return v;
      if(v>alpha) alpha=v;
    }
    return alpha;
  }
  function search(depth, alpha, beta, ply, allowNull){
    if((++nodes&2047)===0 && Date.now()-t0>ms) stop=true;
    if(stop) return 0;
    if(ply>0){ if(p.half>=100 || isRep()) return 0; }
    const us=p.side, chk=cAtt(p.b, p.k[us?1:0], us^BLK);
    if(chk) depth++;
    if(depth<=0) return qs(alpha, beta, ply);
    if(ply>100) return cEval(p);
    const idx=p.h1&TTM; let ttm=0;
    if(tK[idx]===p.h2){
      ttm=tM[idx];
      if(ply>0 && tD[idx]>=depth){
        let v=tS[idx]; if(v>MATE-500) v-=ply; else if(v<-MATE+500) v+=ply;
        const f=tF[idx];
        if(f===0) return v;
        if(f===1 && v>alpha) alpha=v; else if(f===2 && v<beta) beta=v;
        if(alpha>=beta) return v;
      }
    }
    if(allowNull && !chk && depth>=3 && ply>0 && beta<MATE-500){
      let big=false; for(let s=0;s<128;s++){ if(s&0x88){ s+=7; continue; } const pc=p.b[s]; if(pc && (pc&BLK)===us && (pc&7)>P && (pc&7)<K){ big=true; break; } }
      if(big){
        nullMake(p); path.push(p.h1);
        const v=-search(depth-3, -beta, -beta+1, ply+1, false);
        path.pop(); nullUnmake(p);
        if(stop) return 0;
        if(v>=beta) return beta;
      }
    }
    const moves=cGen(p,[],false), sc=order(moves, ttm, Math.min(ply,127)), a0=alpha;
    let best=-INF, bestM=0, legal=0;
    path.push(p.h1);
    for(let i=0;i<moves.length;i++){
      const m=pickNext(moves,sc,i);
      const quiet=!p.b[(m>>7)&127] && !(m>>>17&EP) && !((m>>14)&7);
      cMake(p,m);
      if(cAtt(p.b, p.k[us?1:0], us^BLK)){ cUnmake(p); continue; }
      legal++;
      let v;
      if(legal===1) v=-search(depth-1, -beta, -alpha, ply+1, true);
      else {
        const red = depth>=3 && legal>4 && quiet && !chk ? 1 : 0;
        v=-search(depth-1-red, -alpha-1, -alpha, ply+1, true);
        if(v>alpha && !stop && (red || v<beta)) v=-search(depth-1, -beta, -alpha, ply+1, true);
      }
      cUnmake(p);
      if(stop){ path.pop(); return 0; }
      if(v>best){
        best=v; bestM=m;
        if(v>alpha){
          alpha=v; if(ply===0) rootBest=m;
          if(v>=beta){
            if(quiet){ const k=Math.min(ply,127)*2; if(killers[k]!==m){ killers[k+1]=killers[k]; killers[k]=m; } histT[p.b[m&127]*128+((m>>7)&127)]+=depth*depth; }
            break;
          }
        }
      }
    }
    path.pop();
    if(!legal) return chk ? -MATE+ply : 0;
    let st=best; if(st>MATE-500) st+=ply; else if(st<-MATE+500) st-=ply;
    tK[idx]=p.h2; tM[idx]=bestM; tS[idx]=st; tD[idx]=depth; tF[idx]= best<=a0 ? 2 : best>=beta ? 1 : 0;
    return best;
  }
  let best=root[0], bestS=0, done=0, scored=null;
  for(let d=1; d<=maxD; d++){
    if(cfg.noise){
      const arr=[]; path.push(p.h1);
      for(const m of root){ cMake(p,m); const v=-search(d-1, -INF, INF, 1, true); cUnmake(p); if(stop) break; arr.push([m,v]); }
      path.pop();
      if(stop && arr.length<root.length) break;
      scored=arr; done=d;
    } else {
      rootBest=0;
      const v=search(d, -INF, INF, 0, true);
      if(rootBest) best=rootBest;
      if(stop) break;
      bestS=v; done=d;
      if(Math.abs(v)>MATE-500) break;
    }
    if(Date.now()-t0 > ms*.55) break;
  }
  if(cfg.noise && scored){
    let bv=-Infinity;
    for(const [m,v] of scored){ const x=v+(Math.random()*2-1)*cfg.noise; if(x>bv){ bv=x; best=m; bestS=v; } }
  }
  return {m:best, s:bestS, d:done, nodes};
}

/* ---------- libro de aperturas (para que los bots no abran siempre igual) ---------- */
const BOOK=`e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7
e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6 d2d3
e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4 g8f6 d4c6 b7c6
e2e4 e7e5 g1f3 g8f6 f3e5 d7d6 e5f3 f6e4
e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6
e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e5
e2e4 c7c5 b1c3 b8c6 g2g3 g7g6 f1g2 f8g7
e2e4 e7e6 d2d4 d7d5 b1c3 g8f6 c1g5 f8e7
e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5
e2e4 d7d5 e4d5 d8d5 b1c3 d5a5 d2d4 g8f6
d2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7
d2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 d5c4
d2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 e8g8
d2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8
d2d4 g8f6 c2c4 e7e6 g1f3 b7b6 g2g3 c8b7
c2c4 e7e5 b1c3 g8f6 g1f3 b8c6 g2g3 d7d5
g1f3 d7d5 g2g3 g8f6 f1g2 e7e6 e1g1
d2d4 d7d5 g1f3 g8f6 c1f4 e7e6 e2e3 c7c5`.split('\n').map(l=>l.trim().split(/\s+/));
function bookMove(played){
  const c=[]; for(const l of BOOK){ if(l.length<=played.length) continue; let ok=true; for(let i=0;i<played.length;i++) if(l[i]!==played[i]){ ok=false; break; } if(ok) c.push(l[played.length]); }
  return c.length ? c[rand(c.length)] : null;
}
const PRL=['','p','n','b','r','q','k'];
const uciOf = m => sqName(m&127)+sqName((m>>7)&127)+(((m>>14)&7) ? '.pnbrqk'[(m>>14)&7] : '');

/* ---------- notación (en castellano: R rey, D dama, T torre, A alfil, C caballo) ---------- */
const LES=['','','C','A','T','D','R'], LEN=['','','N','B','R','Q','K'];
function cSan(p, m, legal, en){
  const L=en?LEN:LES, fr=m&127, to=(m>>7)&127, pr=(m>>14)&7, fl=m>>>17, t=p.b[fr]&7;
  let s;
  if(fl&CAS) s = to>fr ? 'O-O' : 'O-O-O';
  else {
    const cap = p.b[to] || (fl&EP);
    if(t===P) s=(cap ? FILES[fr&7]+'x' : '')+sqName(to)+(pr ? '='+L[pr] : '');
    else {
      const amb=legal.filter(x=>x!==m && ((x>>7)&127)===to && (p.b[x&127]&7)===t);
      let dis='';
      if(amb.length){ const sf=amb.some(x=>((x&127)&7)===(fr&7)), sr=amb.some(x=>((x&127)>>4)===(fr>>4)); dis = !sf ? FILES[fr&7] : !sr ? String((fr>>4)+1) : sqName(fr); }
      s=L[t]+dis+(cap?'x':'')+sqName(to);
    }
  }
  cMake(p,m); if(inCheck(p)) s+= cLegal(p).length ? '+' : '#'; cUnmake(p);
  return s;
}
const posKey = fen => String(fen).split(' ').slice(0,4).join(' ');

/* ---------- lo que usa la página (casillas 0..63 = fila*8 + columna) ---------- */
const chess={
  START,
  board(fen){ const p=cParse(fen), out=new Array(64).fill('');
    for(let i=0;i<64;i++){ const pc=p.b[to88(i)]; if(pc) out[i]=(pc&BLK?'b':'w')+' PNBRQK'[pc&7]; } return out; },
  turn: fen => String(fen).split(' ')[1]==='b' ? 'b' : 'w',
  legal(fen){ const p=cParse(fen); return cLegal(p).map(m=>({from:from88(m&127), to:from88((m>>7)&127), promo:PRL[(m>>14)&7], m})); },
  move(fen, x){
    const p=cParse(fen), legal=cLegal(p);
    const m=legal.find(m=>from88(m&127)===x.from && from88((m>>7)&127)===x.to && (!((m>>14)&7) || '.pnbrqk'[(m>>14)&7]===(x.promo||'q')));
    if(m==null) return null;
    const fl=m>>>17, cap=p.b[(m>>7)&127] ? (p.b[(m>>7)&127]&BLK?'b':'w')+' PNBRQK'[p.b[(m>>7)&127]&7] : (fl&EP ? (p.side?'wP':'bP') : '');
    const san=cSan(p,m,legal,false), en=cSan(p,m,legal,true), uci=uciOf(m);
    cMake(p,m);
    return {fen:cFen(p), san, en, uci, cap, castle:!!(fl&CAS), ep:!!(fl&EP), check:inCheck(p), from:x.from, to:x.to, promo:PRL[(m>>14)&7]};
  },
  checkSq(fen){ const p=cParse(fen); return inCheck(p) ? from88(p.k[p.side?1:0]) : -1; },
  status(fen, prev){
    const p=cParse(fen), legal=cLegal(p);
    if(!legal.length) return inCheck(p) ? {w:p.side?'w':'b', why:'jaque mate'} : {w:null, why:'rey ahogado'};
    if(cInsuf(p)) return {w:null, why:'material insuficiente'};
    if(p.half>=100) return {w:null, why:'regla de las 50 jugadas'};
    const k=posKey(fen); let n=1; for(const f of prev||[]) if(posKey(f)===k) n++;
    if(n>=3) return {w:null, why:'triple repetición'};
    return null;
  },
  canMate(fen, color){ return cCanMate(cParse(fen), color==='w'); },
  eval(fen){ const p=cParse(fen), v=cEval(p); return p.side ? -v : v; },   // a favor de las blancas
  uci: i => FILES[i&7]+((i>>3)+1),
};

/* ====================================================================
   DAMAS (casilla = fila*8 + columna; fila 0 = la de las blancas)
   fichas: 1 peón blanco, 2 dama blanca, -1 peón negro, -2 dama negra
   ==================================================================== */
const DVAR={
  inglesa:  {n:'Inglesa / americana', back:false, fly:false, max:false, stop:true},
  latina:   {n:'Latina (española)',   back:false, fly:true,  max:true,  stop:false},
  brasilena:{n:'Brasileña (internacional en 8x8)', back:true, fly:true, max:true, stop:false},
};
const DIRS=[[1,1],[1,-1],[-1,1],[-1,-1]];
const dCfg = o => Object.assign({forz:true}, DVAR[(o&&o.var)||'latina']||DVAR.latina, o&&o.forz===false?{forz:false}:{});
function dStart(){
  let s='';
  for(let i=0;i<64;i++){ const r=i>>3, f=i&7, dark=((r+f)&1)===0; s+= !dark ? '.' : r<=2 ? 'w' : r>=5 ? 'b' : '.'; }
  return s+' w 0';
}
function dParse(str){
  const [bd, side, q]=String(str).split(' '), b=new Int8Array(64);
  for(let i=0;i<64;i++){ const c=bd[i]; b[i]= c==='w'?1 : c==='W'?2 : c==='b'?-1 : c==='B'?-2 : 0; }
  return {b, side:side==='b'?-1:1, q:+q||0};
}
function dStr(p){ let s=''; for(let i=0;i<64;i++){ const v=p.b[i]; s+= v===1?'w': v===2?'W': v===-1?'b': v===-2?'B':'.'; } return s+' '+(p.side>0?'w':'b')+' '+p.q; }
const onB = (r,f) => r>=0 && r<8 && f>=0 && f<8;
function dJump(b, side, cfg, king, r, f, path, caps, out){
  let any=false;
  for(const [dr,df] of DIRS){
    if(!king && !cfg.back && dr!==side) continue;
    if(king && cfg.fly){
      let rr=r+dr, ff=f+df;
      while(onB(rr,ff) && !b[rr*8+ff]){ rr+=dr; ff+=df; }
      if(!onB(rr,ff)) continue;
      const e=rr*8+ff; if(Math.sign(b[e])===side || caps.includes(e)) continue;
      let lr=rr+dr, lf=ff+df;
      while(onB(lr,lf) && !b[lr*8+lf]){
        const L=lr*8+lf, np=path.concat(L), nc=caps.concat(e); any=true;
        if(!dJump(b, side, cfg, king, lr, lf, np, nc, out)) out.push({from:path[0], to:L, path:np, caps:nc, promo:false});
        lr+=dr; lf+=df;
      }
    } else {
      const er=r+dr, ef=f+df, lr=r+2*dr, lf=f+2*df;
      if(!onB(lr,lf)) continue;
      const e=er*8+ef, L=lr*8+lf;
      if(!b[e] || Math.sign(b[e])===side || caps.includes(e) || b[L]) continue;
      any=true;
      const np=path.concat(L), nc=caps.concat(e), promoRow = !king && lr===(side>0?7:0);
      if(promoRow && cfg.stop){ out.push({from:path[0], to:L, path:np, caps:nc, promo:true}); continue; }
      if(!dJump(b, side, cfg, king, lr, lf, np, nc, out)) out.push({from:path[0], to:L, path:np, caps:nc, promo:promoRow});
    }
  }
  return any;
}
function dGen(p, cfg){
  const b=p.b, side=p.side, caps=[], quiet=[];
  for(let i=0;i<64;i++){
    const v=b[i]; if(!v || Math.sign(v)!==side) continue;
    const king=Math.abs(v)===2, r=i>>3, f=i&7;
    b[i]=0; dJump(b, side, cfg, king, r, f, [i], [], caps); b[i]=v;
    for(const [dr,df] of DIRS){
      if(!king && dr!==side) continue;
      let rr=r+dr, ff=f+df;
      while(onB(rr,ff) && !b[rr*8+ff]){
        const t=rr*8+ff; quiet.push({from:i, to:t, path:[i,t], caps:[], promo:!king && rr===(side>0?7:0)});
        if(!(king && cfg.fly)) break; rr+=dr; ff+=df;
      }
    }
  }
  if(!caps.length) return quiet;
  let c=caps;
  if(cfg.max){ const mx=Math.max(...c.map(x=>x.caps.length)); c=c.filter(x=>x.caps.length===mx); }
  const seen=new Set(); c=c.filter(x=>{ const k=x.from+'-'+x.to+'-'+x.caps.slice().sort((a,b)=>a-b).join(','); if(seen.has(k)) return false; seen.add(k); return true; });
  return cfg.forz ? c : c.concat(quiet);
}
function dMake(p, m){
  const b=new Int8Array(p.b), v=b[m.from];
  b[m.from]=0; for(const c of m.caps) b[c]=0; b[m.to]= m.promo ? 2*Math.sign(v) : v;
  return {b, side:-p.side, q: (Math.abs(v)===2 && !m.caps.length) ? p.q+1 : 0};
}
const dSq = i => FILES[i&7]+((i>>3)+1);
const dSan = m => m.caps.length ? m.path.map(dSq).join('x') : dSq(m.from)+'-'+dSq(m.to);
const CEN=new Int8Array(64).map((_,i)=>{ const r=i>>3, f=i&7; return (r>=2&&r<=5&&f>=2&&f<=5) ? 4 : (r>=1&&r<=6&&f>=1&&f<=6) ? 2 : 0; });
function dEval(p, cfg){
  const b=p.b, KV=cfg.fly?330:250; let s=0, nw=0, nb=0;
  for(let i=0;i<64;i++){ const v=b[i]; if(!v) continue; const r=i>>3;
    if(v===1){ s+=100+r*4+(r===0?6:0)+CEN[i]; nw++; }
    else if(v===-1){ s-=100+(7-r)*4+(r===7?6:0)+CEN[i]; nb++; }
    else if(v===2){ s+=KV+CEN[i]*2; nw++; }
    else { s-=KV+CEN[i]*2; nb++; } }
  // con ventaja conviene cambiar fichas
  if(s>150) s+= (24-nb-nw)*3; else if(s<-150) s-= (24-nb-nw)*3;
  return p.side>0 ? s : -s;
}
const DZ=new Int32Array(5*64).map(r32), DZ2=new Int32Array(5*64).map(r32), DZS=r32();
function dHash(p){ let h1=0, h2=0; for(let i=0;i<64;i++){ const v=p.b[i]; if(v){ const k=(v+2)*64+i; h1^=DZ[k]; h2^=DZ2[k]; } } if(p.side<0){ h1^=DZS; h2=~h2; } return [h1,h2]; }
function dSearch(p, cfg, lv){
  ttInit();
  const t0=Date.now(), ms=lv.ms, maxD=lv.depth;
  let nodes=0, stop=false, rootBest=-1;
  const path=(lv.hist||[]).slice();
  const root=dGen(p,cfg);
  if(!root.length) return null;
  if(root.length===1) return {m:root[0], d:0};
  function neg(p, depth, alpha, beta, ply){
    if((++nodes&1023)===0 && Date.now()-t0>ms) stop=true;
    if(stop) return 0;
    const moves=dGen(p,cfg);
    if(!moves.length) return -MATE+ply;
    const caps=moves[0].caps.length>0;
    if(ply>0 && p.q>=50) return 0;
    const [h1,h2]=dHash(p);
    if(ply>0 && !caps){ for(let i=path.length-1, k=0; i>=0 && k<p.q; i--, k++) if(path[i]===h1) return 0; }
    let stand=null;
    if(depth<=0 || ply>60){
      if(!caps || ply>60) return dEval(p,cfg);
      if(!cfg.forz){ stand=dEval(p,cfg); if(stand>=beta) return stand; if(stand>alpha) alpha=stand; }
    }
    const idx=h1&TTM; let ttm=-1;
    if(tK[idx]===h2){ ttm=tM[idx];
      if(ply>0 && tD[idx]>=depth){ let v=tS[idx]; if(v>MATE-500) v-=ply; else if(v<-MATE+500) v+=ply;
        const f=tF[idx]; if(f===0) return v; if(f===1 && v>alpha) alpha=v; else if(f===2 && v<beta) beta=v; if(alpha>=beta) return v; } }
    const ord=moves.map((m,i)=>[i===ttm?1e6:m.caps.length*100+(m.promo?50:0), i]).sort((a,b)=>b[0]-a[0]);
    const a0=alpha; let best=stand!=null?stand:-INF, bestI=-1;
    path.push(h1);
    for(const [,i] of ord){
      const m=moves[i], np=dMake(p,m);
      const v=-neg(np, (depth<=0 && caps) ? 0 : depth-1, -beta, -alpha, ply+1);
      if(stop){ path.pop(); return 0; }
      if(v>best){ best=v; bestI=i; if(v>alpha){ alpha=v; if(ply===0) rootBest=i; if(v>=beta) break; } }
    }
    path.pop();
    let st=best; if(st>MATE-500) st+=ply; else if(st<-MATE+500) st-=ply;
    if(bestI>=0){ tK[idx]=h2; tM[idx]=bestI; tS[idx]=st; tD[idx]=Math.max(0,depth); tF[idx]= best<=a0 ? 2 : best>=beta ? 1 : 0; }
    return best;
  }
  let best=root[0], done=0, scored=null;
  for(let d=1; d<=maxD; d++){
    if(lv.noise){
      const arr=[];
      for(const m of root){ const v=-neg(dMake(p,m), d-1, -INF, INF, 1); if(stop) break; arr.push([m,v]); }
      if(stop && arr.length<root.length) break;
      scored=arr; done=d;
    } else {
      rootBest=-1; const v=neg(p, d, -INF, INF, 0);
      if(rootBest>=0) best=dGen(p,cfg)[rootBest];
      if(stop) break; done=d;
      if(Math.abs(v)>MATE-500) break;
    }
    if(Date.now()-t0 > ms*.55) break;
  }
  if(lv.noise && scored){ let bv=-Infinity; for(const [m,v] of scored){ const x=v+(Math.random()*2-1)*lv.noise; if(x>bv){ bv=x; best=m; } } }
  return {m:best, d:done};
}
const damas={
  VAR:DVAR, cfg:dCfg,
  start: dStart,
  board(str){ const p=dParse(str), out=new Array(64).fill(''); for(let i=0;i<64;i++){ const v=p.b[i]; if(v) out[i]=(v>0?'w':'b')+(Math.abs(v)===2?'D':'M'); } return out; },
  turn: str => String(str).split(' ')[1]==='b' ? 'b' : 'w',
  legal(str, o){ return dGen(dParse(str), dCfg(o)); },
  move(str, x, o){
    const p=dParse(str), list=dGen(p, dCfg(o));
    let m=list.filter(m=>m.from===x.from && m.to===x.to);
    if(x.path && m.length>1){ const k=x.path.join(','); m=m.filter(y=>y.path.join(',')===k); }
    m=m[0]; if(!m) return null;
    const np=dMake(p,m);
    return {pos:dStr(np), san:dSan(m), en:dSan(m), from:m.from, to:m.to, path:m.path, caps:m.caps, promo:m.promo};
  },
  status(str, prev, o){
    const p=dParse(str), cfg=dCfg(o);
    if(!dGen(p,cfg).length){ const left=p.b.some(v=>Math.sign(v)===p.side); return {w:p.side>0?'b':'w', why: left ? 'se quedó sin jugadas' : 'se quedó sin fichas'}; }
    if(p.q>=50) return {w:null, why:'25 jugadas seguidas de cada uno solo con damas, sin capturar'};
    const k=String(str).slice(0,66); let n=1; for(const s of prev||[]) if(String(s).slice(0,66)===k) n++;
    if(n>=3) return {w:null, why:'triple repetición'};
    return null;
  },
  eval(str, o){ const p=dParse(str), v=dEval(p, dCfg(o)); return p.side>0 ? v : -v; },
};

/* ====================================================================
   El bot: elige la jugada según el ELO
   ==================================================================== */
function think(req){
  const lvl=nivel(req.elo||1200);
  if(req.kind==='chess'){
    const p=cParse(req.fen), [depth, ms0, noise, blunder]=lvl.a;
    const ms=Math.max(150, Math.min(ms0, req.ms||ms0));
    const legal=cLegal(p); if(!legal.length) return null;
    if(lvl.elo>=1000 && req.uci){ const u=bookMove(req.uci); const m=u && legal.find(x=>uciOf(x)===u); if(m!=null) return {from:from88(m&127), to:from88((m>>7)&127), promo:PRL[(m>>14)&7]}; }
    let m;
    if(blunder && Math.random()<blunder) m=legal[rand(legal.length)];
    else { const hist=(req.hist||[]).map(f=>cParse(f).h1); const r=cSearch(p, {depth, ms, noise, hist}); m=r ? r.m : legal[0]; }
    return {from:from88(m&127), to:from88((m>>7)&127), promo:PRL[(m>>14)&7]};
  }
  const cfg=dCfg(req.opts), p=dParse(req.pos), [depth, ms0, noise, blunder]=lvl.d;
  const ms=Math.max(150, Math.min(ms0, req.ms||ms0));
  const list=dGen(p,cfg); if(!list.length) return null;
  let m;
  if(blunder && Math.random()<blunder) m=list[rand(list.length)];
  else { const hist=(req.hist||[]).map(s=>dHash(dParse(s))[0]); const r=dSearch(p, cfg, {depth, ms, noise, hist}); m=r ? r.m : list[0]; }
  return {from:m.from, to:m.to, path:m.path};
}

// en el Web Worker: contesta lo que le pide la página
if(typeof window==='undefined' && typeof self!=='undefined' && typeof self.postMessage==='function'){
  self.onmessage = e => { const d=e.data||{}; let move=null; try{ move=think(d); }catch(err){ move=null; } self.postMessage({id:d.id, move}); };
  return;
}
// en la página: manda a pensar al Worker (o piensa acá si el aparato no tiene Workers)
const SRC = (document.currentScript && document.currentScript.src) || 'motor.js';
let W=null, wid=0; const CBS={};
function ask(req, cb){
  const id=++wid;
  if(W===null){ try{ W=new Worker(SRC); W.onmessage=e=>{ const c=CBS[e.data.id]; delete CBS[e.data.id]; if(c) c(e.data.move); }; W.onerror=()=>{ W=false; }; }catch(e){ W=false; } }
  if(W){ CBS[id]=cb; W.postMessage(Object.assign({id}, req)); }
  else setTimeout(()=>{ let mv=null; try{ mv=think(Object.assign({}, req, {ms:Math.min(req.ms||800, 800)})); }catch(e){} cb(mv); }, 30);
}
G.Motor={NIVELES, nivel, chess, damas, ask};
})(typeof self!=='undefined' ? self : this);
