'use strict';
/* =====================================================================
   Las cartas dibujadas: baraja española de 40 con toque paraguayo.
   Oros con la estrella del escudo, figuras con sombrero pirí, poncho de
   ao po'i y un ñandutí en el pecho del rey. Dorso azul con ñandutí.
   Todo en SVG (sin imágenes), así se ve nítido en cualquier tamaño.
   ===================================================================== */
const INK='#3a2414', SKIN='#e9b98a', STRAW='#e5c46b', GOLD='#f2c230';
// estrella de 5 puntas (la del escudo paraguayo)
function starPts(r, r2){ const p=[]; for(let i=0;i<10;i++){ const a=-Math.PI/2+i*Math.PI/5, rr=i%2?r2:r; p.push((Math.cos(a)*rr).toFixed(2)+','+(Math.sin(a)*rr).toFixed(2)); } return p.join(' '); }
const STAR=starPts(5.6, 2.3);
// cada palo dibujado alrededor de (0,0), de unos 26 de alto
const PIP = {
  o:`<circle r="11.5" fill="#b8860b" stroke="#6b4a00" stroke-width="1.2"/><circle r="9.2" fill="${GOLD}"/><circle r="9.2" fill="none" stroke="#fff3b0" stroke-width=".8" stroke-dasharray="1.4 1.6"/>
     <circle cx="-2.6" cy="-3" r="3.6" fill="#ffe680" opacity=".55"/><polygon points="${STAR}" fill="#fff8d6" stroke="#9a6b00" stroke-width=".8"/>`,
  c:`<path d="M-9,-10.5 H9 Q9.2,-1 1.8,2.2 V6.4 Q6.2,7.4 7,11.5 H-7 Q-6.2,7.4 -1.8,6.4 V2.2 Q-9.2,-1 -9,-10.5Z" fill="#c62828" stroke="#6d0f0f" stroke-width="1.1"/>
     <rect x="-9.6" y="-12.6" width="19.2" height="2.8" rx="1.2" fill="${GOLD}" stroke="#6d0f0f" stroke-width=".6"/>
     <path d="M-6,-8 Q-5.6,-3 -2.2,-.6" stroke="#ff9e94" stroke-width="1.3" fill="none" stroke-linecap="round"/>
     <rect x="-4.5" y="9.2" width="9" height="1.4" rx=".7" fill="${GOLD}"/>`,
  e:`<path d="M0,-13.5 L2.2,-9.6 V5 H-2.2 V-9.6Z" fill="#dfe7f1" stroke="#1d4fb8" stroke-width="1"/><path d="M0,-11 V4" stroke="#9fb3cf" stroke-width=".7"/>
     <rect x="-6.6" y="4.6" width="13.2" height="2.6" rx="1.3" fill="${GOLD}" stroke="#0e2c6e" stroke-width=".7"/>
     <rect x="-1.5" y="7.2" width="3" height="4.6" fill="#1d4fb8" stroke="#0e2c6e" stroke-width=".5"/>
     <circle cy="12.9" r="1.9" fill="${GOLD}" stroke="#0e2c6e" stroke-width=".6"/>`,
  b:`<path d="M-2.3,12.4 L-4.8,-8 Q-5.3,-13.6 0,-13.6 Q5.3,-13.6 4.8,-8 L2.3,12.4 Q0,13.9 -2.3,12.4Z" fill="#a0652d" stroke="#3e240c" stroke-width="1"/>
     <path d="M-4.3,-6.2 Q0,-4 4.3,-6.2" stroke="#2e7d32" stroke-width="1.7" fill="none"/><path d="M-3.4,3.2 Q0,4.8 3.4,3.2" stroke="#2e7d32" stroke-width="1.5" fill="none"/>
     <ellipse cx="-1.8" cy="-1.5" rx="1" ry="1.5" fill="#5d3612"/><ellipse cx="1.7" cy="7.5" rx=".9" ry="1.3" fill="#5d3612"/><ellipse cx="1.4" cy="-10" rx=".8" ry="1.1" fill="#5d3612"/>`,
};
const pip = (s, x, y, k, rot) => `<g transform="translate(${x} ${y}) scale(${k})${rot?` rotate(${rot})`:''}">${PIP[s]}</g>`;
const LAY = {
  2:[[50,44],[50,106]],
  3:[[50,34],[50,75],[50,116]],
  4:[[34,44],[66,44],[34,106],[66,106]],
  5:[[34,40],[66,40],[50,75],[34,110],[66,110]],
  6:[[34,36],[66,36],[34,75],[66,75],[34,114],[66,114]],
  7:[[34,34],[66,34],[50,54],[34,78],[66,78],[34,116],[66,116]],
};
// poncho de ao po'i: rayitas finas sobre la ropa
const stripes = (x1, x2, y1, y2) => { let h=''; for(let y=y1;y<y2;y+=5) h+=`<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#fff" stroke-width=".7" opacity=".55"/>`; return h; };
const piri = (x, y, k) => `<g transform="translate(${x} ${y}) scale(${k})"><ellipse cx="0" cy="0" rx="17" ry="4" fill="${STRAW}" stroke="${INK}" stroke-width="1"/>
  <path d="M-8,-.5 Q-8,-11 0,-11 Q8,-11 8,-.5Z" fill="${STRAW}" stroke="${INK}" stroke-width="1"/><path d="M-8,-2.6 H8" stroke="#d52b1e" stroke-width="1.6"/><path d="M-7.6,-1 H7.6" stroke="#0038a8" stroke-width="1.2"/>
  <path d="M-13,-1 Q0,3 13,-1" stroke="#b8963c" stroke-width=".6" fill="none"/></g>`;
function figure(c){
  const col=SUIT_INFO[c.s].hex, dk=SUIT_INFO[c.s].dark;
  let g='';
  if(c.n===10){   // Sota: un mitã con sombrero pirí y poncho
    g+=`<rect x="40" y="110" width="8" height="24" rx="2" fill="#5d4037" stroke="${INK}"/><rect x="52" y="110" width="8" height="24" rx="2" fill="#5d4037" stroke="${INK}"/>
      <path d="M36,64 Q50,58 64,64 L70,114 Q50,120 30,114Z" fill="${col}" stroke="${INK}" stroke-width="1.2"/>${stripes(33,67,72,114)}
      <path d="M50,64 L50,114" stroke="${dk}" stroke-width="1"/>
      <path d="M63,70 Q72,74 70,86" stroke="${SKIN}" stroke-width="5" fill="none" stroke-linecap="round"/>
      <circle cx="50" cy="50" r="10" fill="${SKIN}" stroke="${INK}"/><circle cx="46.5" cy="49" r="1.1" fill="${INK}"/><circle cx="53.5" cy="49" r="1.1" fill="${INK}"/><path d="M46.5,54.5 Q50,57 53.5,54.5" stroke="${INK}" fill="none" stroke-width=".9"/>
      ${piri(50,41,1)}${pip(c.s,71,92,.75)}`;
  } else if(c.n===11){   // Caballo: el kavaju con su jinete
    g+=`<path d="M22,96 Q20,84 34,82 L62,82 Q70,70 74,62 L80,58 Q88,60 86,68 L80,72 Q78,84 74,98 Q70,108 58,108 L34,108 Q24,106 22,96Z" fill="#8d5a2b" stroke="${INK}" stroke-width="1.2"/>
      <path d="M74,62 Q70,56 76,52 L78,58" fill="#5d3612" stroke="${INK}" stroke-width=".8"/><circle cx="81" cy="62" r="1.1" fill="${INK}"/>
      <path d="M22,92 Q12,96 14,112" stroke="#5d3612" stroke-width="3.2" fill="none" stroke-linecap="round"/>
      <rect x="30" y="104" width="5" height="30" rx="2" fill="#7a4a22" stroke="${INK}" stroke-width=".8"/><rect x="40" y="104" width="5" height="28" rx="2" fill="#7a4a22" stroke="${INK}" stroke-width=".8"/>
      <rect x="58" y="104" width="5" height="30" rx="2" fill="#7a4a22" stroke="${INK}" stroke-width=".8"/><rect x="67" y="102" width="5" height="28" rx="2" fill="#7a4a22" stroke="${INK}" stroke-width=".8"/>
      <path d="M36,84 Q46,80 56,84 L58,100 L34,100Z" fill="#d52b1e" stroke="${INK}" stroke-width=".8"/><path d="M36,90 H57" stroke="#fff" stroke-width="1.6"/><path d="M35,95 H58" stroke="#0038a8" stroke-width="1.6"/>
      <path d="M38,82 Q46,76 54,82 L56,62 Q46,58 36,62Z" fill="${col}" stroke="${INK}" stroke-width="1.1"/>${stripes(37,55,66,82)}
      <path d="M38,66 Q28,62 26,52" stroke="${SKIN}" stroke-width="4.4" fill="none" stroke-linecap="round"/>
      <circle cx="46" cy="50" r="8" fill="${SKIN}" stroke="${INK}"/><circle cx="43.5" cy="49.5" r=".9" fill="${INK}"/><circle cx="48.5" cy="49.5" r=".9" fill="${INK}"/>
      ${piri(46,43,.82)}${pip(c.s,25,40,.7)}`;
  } else {   // Rey: el mburuvicha con corona, capa y un ñandutí en el pecho
    g+=`<path d="M30,66 Q50,58 70,66 L75,129 L25,129Z" fill="${col}" stroke="${INK}" stroke-width="1.2"/>
      <path d="M30,66 L25,129 L33,129 L38,68Z" fill="#fff" stroke="${INK}" stroke-width=".8"/><path d="M70,66 L75,129 L67,129 L62,68Z" fill="#fff" stroke="${INK}" stroke-width=".8"/>
      <circle cx="29" cy="90" r=".9" fill="${INK}"/><circle cx="28" cy="108" r=".9" fill="${INK}"/><circle cx="71" cy="90" r=".9" fill="${INK}"/><circle cx="72" cy="108" r=".9" fill="${INK}"/>
      <circle cx="50" cy="86" r="9" fill="#fff" stroke="${INK}" stroke-width=".8"/><circle cx="50" cy="86" r="6" fill="none" stroke="${col}" stroke-width=".6"/><circle cx="50" cy="86" r="3" fill="none" stroke="${col}" stroke-width=".6"/>
      <path d="M50,77 V95 M41,86 H59 M43.6,79.6 L56.4,92.4 M56.4,79.6 L43.6,92.4" stroke="${col}" stroke-width=".5"/><circle cx="50" cy="86" r="1.3" fill="#d52b1e"/>
      <path d="M64,72 Q74,78 72,92" stroke="${SKIN}" stroke-width="5" fill="none" stroke-linecap="round"/>
      <circle cx="50" cy="50" r="10" fill="${SKIN}" stroke="${INK}"/><circle cx="46.5" cy="48" r="1.1" fill="${INK}"/><circle cx="53.5" cy="48" r="1.1" fill="${INK}"/>
      <path d="M41,52 Q42,66 50,66 Q58,66 59,52 Q55,57 50,56 Q45,57 41,52Z" fill="#e9e3d6" stroke="${INK}" stroke-width=".8"/>
      <path d="M39,42 L40,30 L45,36 L50,27 L55,36 L60,30 L61,42Z" fill="${GOLD}" stroke="${INK}" stroke-width="1"/><circle cx="50" cy="38" r="1.6" fill="#d52b1e"/><circle cx="43.5" cy="39" r="1.1" fill="#0038a8"/><circle cx="56.5" cy="39" r="1.1" fill="#0038a8"/>
      ${pip(c.s,73,99,.78)}`;
  }
  return g;
}
const CARD_CACHE={};
function cardSVG(c){
  const k=c.s+c.n; if(CARD_CACHE[k]) return CARD_CACHE[k];
  const col=SUIT_INFO[c.s].hex, gaps={o:0,c:1,e:2,b:3}[c.s];
  let h=`<svg viewBox="0 0 100 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`;
  // marco con las “pintas”: los cortes que dicen el palo (oros sin corte, copas 1, espadas 2, bastos 3)
  h+=`<rect x="15" y="8" width="70" height="134" rx="4" fill="${FIG[c.n]?'#fff3dc':'none'}" stroke="${col}" stroke-width="1.8"/>`;
  for(let j=0;j<gaps;j++){ const x=50+(j-(gaps-1)/2)*9-2.6; h+=`<rect x="${x}" y="6" width="5.2" height="4" fill="#fffaf0"/><rect x="${x}" y="140" width="5.2" height="4" fill="#fffaf0"/>`; }
  // números en las esquinas (con lo que vale en la Escoba, para las figuras)
  const num=String(c.n), fs=num.length>1?11:13;
  h+=`<text x="8" y="20" font-size="${fs}" font-weight="900" text-anchor="middle" fill="${col}" font-family="Georgia,'Times New Roman',serif">${num}</text>`;
  h+=`<text x="8" y="20" font-size="${fs}" font-weight="900" text-anchor="middle" fill="${col}" font-family="Georgia,'Times New Roman',serif" transform="rotate(180 50 75)">${num}</text>`;
  if(FIG[c.n]) h+=`<text x="8" y="31" font-size="7" font-weight="800" text-anchor="middle" fill="#7a6a50" font-family="system-ui,sans-serif">=${val(c)}</text>`;
  if(c.n===1){
    h+=pip(c.s,50,72,2.25);
    if(c.s==='o') h+=`<text x="50" y="128" font-size="8" font-weight="900" text-anchor="middle" fill="#9a6b00" letter-spacing="1.2" font-family="system-ui,sans-serif">PARAGUAY</text>`;
    if(c.s==='e') h+=`<path d="M38,122 Q50,128 62,122" stroke="#d52b1e" stroke-width="2" fill="none"/><path d="M38,126 Q50,132 62,126" stroke="#0038a8" stroke-width="2" fill="none"/>`;
  } else if(c.n<=7){
    const k = c.n>=6 ? .82 : .95;
    LAY[c.n].forEach(([x,y],i)=>{ h+=pip(c.s, x, y, k, (c.s==='e'||c.s==='b') && c.n>=4 ? (x<50?-14:x>50?14:0) : 0); });
  } else {
    h+=figure(c);
    h+=`<text x="50" y="138.5" font-size="${c.n===12?6.4:7}" font-weight="900" text-anchor="middle" fill="${INK}" letter-spacing=".6" font-family="system-ui,sans-serif">${FIG[c.n].gn.toUpperCase()}</text>`;
  }
  h+='</svg>';
  return CARD_CACHE[k]=h;
}
function cardHTML(c, cls, style){
  if(!c) return '';
  return `<div class="card s-${c.s} n-${c.n} ${cls||''}" data-id="${c.id}"${style?` style="${style}"`:''}>${cardSVG(c)}</div>`;
}
function backHTML(cls, style){
  return `<div class="card back ${cls||''}"${style?` style="${style}"`:''}><div class="in"><i>PARAGUAY</i><div class="nd"></div><b>ESCOBA</b></div></div>`;
}
// la carta a partir de su número (la baraja siempre se arma igual)
const cardById = id => ({id, s:SUITS[Math.floor((id-1)/10)], n:RANKS[(id-1)%10]});
