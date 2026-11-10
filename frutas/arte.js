/* =====================================================================
   Yva Rape — dibujos (SVG de 100x100) de las frutas, la guampa de tereré
   y los productos de cada ciudad (medallones). Todo dibujado acá, sin
   imágenes de afuera.
   ===================================================================== */
(function(){
const brillo = (x,y,rx,ry,rot,op) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" opacity="${op||.5}" transform="rotate(${rot||0} ${x} ${y})"/>`;
const rg = (id,cx,cy,stops) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r=".75">${stops.map(([o,c])=>`<stop offset="${o}" stop-color="${c}"/>`).join('')}</radialGradient>`;
const lg = (id,x1,y1,x2,y2,stops) => `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([o,c])=>`<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;
const svg = (defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>${defs}</defs>${body}</svg>`;
const hoja = (x,y,rot,col) => `<path d="M0 0 C6 -10 20 -12 28 -6 C20 2 8 4 0 0Z" fill="${col||'#3fa34d'}" stroke="#1f6b2a" stroke-width="1.5" transform="translate(${x} ${y}) rotate(${rot})"/>`;

const FRUTAS = {
  frutilla: { nom:'frutilla', col:'#e3172b', svg: svg(
    rg('a',.35,.3,[[0,'#ff8a8a'],[.45,'#e8192d'],[1,'#8a0613']]),
    `<path d="M50 94 C26 82 10 60 14 40 C17 27 31 23 50 28 C69 23 83 27 86 40 C90 60 74 82 50 94Z" fill="url(#a)" stroke="#6a0410" stroke-width="2.5"/>
     ${[[34,44],[50,42],[66,44],[28,58],[42,56],[58,56],[72,58],[36,70],[50,70],[64,70],[44,82],[56,82]].map(([x,y])=>`<ellipse cx="${x}" cy="${y}" rx="2.2" ry="3.2" fill="#ffe27a" stroke="#b07a00" stroke-width=".8"/>`).join('')}
     <g fill="#3fae4a" stroke="#1d6b27" stroke-width="1.5"><path d="M50 32 L30 22 L42 30 L26 34 L44 34 L36 44 L50 36 L64 44 L56 34 L74 34 L58 30 L70 22Z"/></g>
     <path d="M50 30 L50 14" stroke="#2c7a33" stroke-width="4" stroke-linecap="round"/>
     ${brillo(33,50,6,11,25,.55)}`)},
  sandia: { nom:'sandía', col:'#f0304a', svg: svg(
    rg('a',.5,.1,[[0,'#ff7a86'],[.6,'#f0304a'],[1,'#c41530']]),
    `<path d="M6 30 L94 30 A44 44 0 0 1 6 30Z" fill="#1f7a30" stroke="#0f4a1b" stroke-width="2.5"/>
     <path d="M12 30 L88 30 A38 38 0 0 1 12 30Z" fill="#c9f2a6"/>
     <path d="M16 30 L84 30 A34 34 0 0 1 16 30Z" fill="url(#a)"/>
     ${[[32,40],[50,44],[68,40],[40,54],[60,54],[50,64]].map(([x,y])=>`<ellipse cx="${x}" cy="${y}" rx="2.4" ry="4" fill="#1a0a0a"/>`).join('')}
     <path d="M6 30 L94 30" stroke="#0f4a1b" stroke-width="2.5"/>
     ${brillo(30,36,10,3,8,.45)}`)},
  naranja: { nom:'naranja', col:'#ff9500', svg: svg(
    rg('a',.35,.32,[[0,'#ffe0a0'],[.4,'#ffa21a'],[1,'#c25400']]),
    `<circle cx="50" cy="55" r="38" fill="url(#a)" stroke="#9a4300" stroke-width="2.5"/>
     ${[[40,40],[62,44],[52,62],[34,64],[68,66],[48,80],[28,50],[74,52]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="1.4" fill="#d06a00" opacity=".7"/>`).join('')}
     <path d="M50 20 L52 12" stroke="#5a3a10" stroke-width="3.5" stroke-linecap="round"/>
     ${hoja(52,16,-20)}
     ${brillo(36,40,8,13,35,.55)}`)},
  mango: { nom:'mango', col:'#ff7a1a', svg: svg(
    lg('a',0,0,1,1,[[0,'#ff4a3a'],[.45,'#ff8a1a'],[.8,'#ffc93a'],[1,'#9bc84a']]),
    `<path d="M48 14 C78 14 92 44 84 68 C76 90 44 96 28 82 C10 66 14 36 30 22 C35 17 42 14 48 14Z" fill="url(#a)" stroke="#9a3a10" stroke-width="2.5"/>
     <path d="M46 16 L44 8" stroke="#5a3a10" stroke-width="3.5" stroke-linecap="round"/>
     ${hoja(46,12,-160,'#45a84a')}
     ${brillo(34,38,7,14,30,.5)}`)},
  banana: { nom:'banana', col:'#ffd21a', svg: svg(
    lg('a',0,0,1,1,[[0,'#fff3a0'],[.5,'#ffd51f'],[1,'#d99a00']]),
    `<path d="M22 18 C14 50 30 82 70 86 C80 87 88 84 90 78 C86 74 82 74 74 74 C46 72 34 50 34 20 C34 14 26 12 22 18Z" fill="url(#a)" stroke="#8a5a00" stroke-width="2.5"/>
     <path d="M28 24 C26 50 40 70 70 78" fill="none" stroke="#c99200" stroke-width="2" opacity=".7"/>
     <path d="M22 18 C22 12 28 8 33 12 L34 20 Z" fill="#6a4a10"/>
     <path d="M86 78 L92 76 L92 82 Z" fill="#4a3008"/>
     ${brillo(30,46,4,14,-10,.6)}`)},
  pina: { nom:'piña', col:'#f5b81a', svg: svg(
    rg('a',.4,.35,[[0,'#ffe680'],[.5,'#f2b31a'],[1,'#a8670a']]) + `<clipPath id="c"><ellipse cx="50" cy="64" rx="27" ry="31"/></clipPath>`,
    `<g fill="#3fae4a" stroke="#1d6b27" stroke-width="1.5">
       <path d="M50 38 L38 6 L48 30 L50 2 L52 30 L62 6 Z"/><path d="M50 40 L24 16 L44 36Z"/><path d="M50 40 L76 16 L56 36Z"/></g>
     <ellipse cx="50" cy="64" rx="27" ry="31" fill="url(#a)" stroke="#7a4a05" stroke-width="2.5"/>
     <g clip-path="url(#c)" stroke="#9a5a08" stroke-width="2" opacity=".8">
       ${[-40,-26,-12,2,16,30,44].map(d=>`<path d="M${20+d} 30 L${80+d} 100"/><path d="M${80-d} 30 L${20-d} 100"/>`).join('')}</g>
     ${brillo(38,54,5,12,20,.5)}`)},
  mburukuja: { nom:'mburukuja', col:'#f5c518', svg: svg(
    rg('a',.5,.5,[[0,'#ffd75a'],[.7,'#f0a818'],[1,'#d98a10']]),
    `<circle cx="50" cy="52" r="40" fill="#e8c52a" stroke="#8a6a00" stroke-width="2.5"/>
     <circle cx="50" cy="52" r="34" fill="#fff6d6"/>
     <circle cx="50" cy="52" r="30" fill="url(#a)"/>
     ${[[40,38],[56,36],[66,48],[60,64],[44,66],[34,54],[50,50],[48,26],[28,44],[72,58],[54,78],[36,72],[66,34],[26,60],[74,42]].map(([x,y])=>`<ellipse cx="${x}" cy="${y}" rx="3.2" ry="4" fill="#2a1a0a"/><circle cx="${x-1}" cy="${y-1.5}" r="1" fill="#fff" opacity=".6"/>`).join('')}
     ${brillo(30,30,7,4,-35,.5)}`)},
  guayaba: { nom:'guayaba', col:'#7cc243', svg: svg(
    rg('a',.5,.5,[[0,'#ffd0d6'],[.6,'#ff7e92'],[1,'#e8506a']]),
    `<circle cx="50" cy="52" r="40" fill="#7cc243" stroke="#2f6a12" stroke-width="2.5"/>
     <circle cx="50" cy="52" r="33" fill="#f6ffd8"/>
     <circle cx="50" cy="52" r="30" fill="url(#a)"/>
     <circle cx="50" cy="52" r="13" fill="#ffb3bf"/>
     ${[[50,40],[61,47],[58,61],[44,62],[38,48],[50,52]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="2.6" fill="#fff4cc" stroke="#d9a07a" stroke-width=".8"/>`).join('')}
     ${brillo(28,34,7,4,-40,.55)}`)},
  aguacate: { nom:'aguacate', col:'#4f9a2a', svg: svg(
    rg('a',.45,.55,[[0,'#f4ffb0'],[.6,'#c8e66a'],[1,'#8fbf3a']]),
    `<path d="M50 6 C62 6 66 22 72 36 C84 56 84 84 50 94 C16 84 16 56 28 36 C34 22 38 6 50 6Z" fill="#2f6a1a" stroke="#173d0a" stroke-width="2.5"/>
     <path d="M50 12 C59 12 62 26 67 38 C77 57 76 80 50 88 C24 80 23 57 33 38 C38 26 41 12 50 12Z" fill="url(#a)"/>
     <circle cx="50" cy="62" r="15" fill="#8a4a1a" stroke="#5a2a08" stroke-width="2"/>
     ${brillo(45,56,4,6,-20,.45)}`)},
  yvapuru: { nom:'yvapurũ', col:'#5a2a8a', svg: svg(
    rg('a',.35,.3,[[0,'#a07ad0'],[.4,'#4a1f6e'],[1,'#14061f']]),
    `<path d="M50 10 L50 30 M50 30 L28 40 M50 30 L72 40" stroke="#7a5a3a" stroke-width="5" stroke-linecap="round"/>
     <circle cx="30" cy="56" r="22" fill="url(#a)" stroke="#0e0418" stroke-width="2"/>
     <circle cx="70" cy="56" r="22" fill="url(#a)" stroke="#0e0418" stroke-width="2"/>
     <circle cx="50" cy="74" r="22" fill="url(#a)" stroke="#0e0418" stroke-width="2"/>
     ${brillo(23,48,5,8,30,.7)}${brillo(63,48,5,8,30,.7)}${brillo(43,66,5,8,30,.7)}`)},
  uva: { nom:'uva', col:'#9b4fd1', svg: svg(
    rg('a',.35,.3,[[0,'#e2b8ff'],[.45,'#9b4fd1'],[1,'#4a1a7a']]),
    `<path d="M52 18 L56 6" stroke="#5a3a10" stroke-width="4" stroke-linecap="round"/>${hoja(56,14,-10,'#4fa83a')}
     ${[[32,30],[50,28],[68,30],[40,46],[60,46],[24,46],[76,46],[32,62],[50,62],[68,62],[41,77],[59,77],[50,91]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="10.5" fill="url(#a)" stroke="#3a0f5e" stroke-width="1.6"/><circle cx="${x-3}" cy="${y-3.5}" r="2.6" fill="#fff" opacity=".65"/>`).join('')}`)},
  mbokaja: { nom:'mbokaja', col:'#b8792a', svg: svg(
    rg('a',.35,.3,[[0,'#ffe3a8'],[.45,'#d9a050'],[1,'#7a4a16']]),
    `<path d="M50 6 C50 20 46 26 40 32 M50 6 C52 20 58 26 62 32 M50 6 C50 24 50 40 50 46" stroke="#6a4a1a" stroke-width="4" fill="none" stroke-linecap="round"/>
     ${[[30,46],[70,46],[50,56],[28,76],[72,76],[50,84]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="16" fill="url(#a)" stroke="#5a3408" stroke-width="2"/><path d="M${x-5} ${y-14} q5 -4 10 0" stroke="#5a3408" stroke-width="2" fill="#8a5a1a"/><circle cx="${x-5}" cy="${y-5}" r="3.4" fill="#fff" opacity=".55"/>`).join('')}`)},
};

// guampa de tereré (pieza especial máxima)
const GUAMPA = svg(
  lg('a',0,0,1,0,[[0,'#7a4a20'],[.35,'#e8c890'],[.6,'#fff0d0'],[1,'#8a5a28']]) +
  lg('p',0,0,1,0,[[0,'#8a96a8'],[.5,'#ffffff'],[1,'#7a8698']]) +
  rg('y',.5,.4,[[0,'#b8f070'],[1,'#3f8a1a']]),
  `<path d="M66 6 L58 46" stroke="url(#p)" stroke-width="5" stroke-linecap="round"/>
   <path d="M62 4 L72 8" stroke="#c8d0dc" stroke-width="6" stroke-linecap="round"/>
   <path d="M24 30 L76 30 L72 62 C70 80 60 92 50 96 C46 97 44 94 46 90 C52 82 34 76 30 62 Z" fill="url(#a)" stroke="#4a2a0a" stroke-width="2.5"/>
   <ellipse cx="50" cy="30" rx="26" ry="7" fill="url(#y)" stroke="#4a2a0a" stroke-width="2"/>
   <path d="M66 26 L62 46" stroke="url(#p)" stroke-width="4" stroke-linecap="round"/>
   <path d="M25 38 L75 38" stroke="url(#p)" stroke-width="5"/>
   <path d="M29 58 L71 58" stroke="url(#p)" stroke-width="4"/>
   <g fill="#c22b3a"><circle cx="40" cy="48" r="2.5"/><circle cx="50" cy="48" r="2.5"/><circle cx="60" cy="48" r="2.5"/></g>
   <path d="M38 70 Q50 76 62 70" stroke="#6a3a10" stroke-width="2" fill="none"/>
   ${brillo(36,46,3,12,0,.55)}`);

// medallones de los productos de cada ciudad (piezas que hay que bajar)
const med = (col, cuerpo) => svg(
  rg('m',.4,.35,[[0,'#fff6c8'],[.6,'#f2c14e'],[1,'#9a6a10']]) + rg('f',.4,.35,[[0,'#ffffff'],[1,col]]),
  `<circle cx="50" cy="50" r="46" fill="url(#m)" stroke="#6a4a08" stroke-width="2"/>
   <circle cx="50" cy="50" r="38" fill="url(#f)" stroke="#8a6a18" stroke-width="1.5"/>${cuerpo}
   <path d="M18 34 A36 36 0 0 1 50 14" stroke="#fff" stroke-width="4" fill="none" opacity=".55" stroke-linecap="round"/>`);

const PROD = {
  guitarra: {nom:'guitarra', svg: med('#ffd9a0', `<g transform="rotate(-35 50 50)"><rect x="46" y="14" width="8" height="34" fill="#5a3010"/><rect x="43" y="8" width="14" height="10" rx="2" fill="#3a1a08"/>
    <circle cx="50" cy="58" r="13" fill="#c8782a" stroke="#5a2a08" stroke-width="2"/><circle cx="50" cy="76" r="15" fill="#c8782a" stroke="#5a2a08" stroke-width="2"/>
    <rect x="44" y="52" width="12" height="22" fill="#c8782a"/><circle cx="50" cy="62" r="5" fill="#3a1a08"/><rect x="44" y="80" width="12" height="3" fill="#3a1a08"/>
    <path d="M48 16 L48 82 M52 16 L52 82" stroke="#f0e0c0" stroke-width=".8"/></g>`)},
  vela: {nom:'vela', svg: med('#fff1c4', `<rect x="40" y="44" width="20" height="40" rx="3" fill="#fffaf0" stroke="#b8a070" stroke-width="2"/>
    <path d="M40 50 q4 6 8 0" fill="#fffaf0" stroke="#b8a070" stroke-width="1.5"/><path d="M50 44 L50 38" stroke="#333" stroke-width="2"/>
    <path d="M50 14 C58 26 60 34 50 40 C40 34 42 26 50 14Z" fill="#ffb21a"/><path d="M50 24 C54 30 54 35 50 38 C46 35 46 30 50 24Z" fill="#fff3a0"/>`)},
  cantaro: {nom:'cántaro', svg: med('#ffd2b0', `<path d="M42 18 L58 18 L56 28 C74 34 78 56 70 72 C64 84 36 84 30 72 C22 56 26 34 44 28 Z" fill="#c8562a" stroke="#6a2a0a" stroke-width="2.5"/>
    <rect x="40" y="15" width="20" height="6" rx="2" fill="#a8441e" stroke="#6a2a0a" stroke-width="2"/>
    <path d="M32 50 Q50 56 68 50" stroke="#fff0d0" stroke-width="3" fill="none"/><path d="M34 60 Q50 66 66 60" stroke="#3a1a08" stroke-width="2" fill="none"/>
    ${brillo(38,44,3,9,10,.4)}`)},
  bota: {nom:'artesanía en cuero', svg: med('#ffe0b8', `<path d="M36 16 L60 16 L60 60 C70 62 80 66 82 76 L82 84 L28 84 L28 74 C34 70 36 64 36 56 Z" fill="#8a4a1a" stroke="#3a1a04" stroke-width="2.5"/>
    <path d="M36 26 L60 26" stroke="#d9a050" stroke-width="3"/><path d="M28 80 L82 80" stroke="#3a1a04" stroke-width="3"/>
    <path d="M40 34 q8 6 16 0 M40 44 q8 6 16 0" stroke="#d9a050" stroke-width="2" fill="none"/>`)},
  chipa: {nom:'chipa', svg: med('#fff0c0', `<circle cx="50" cy="52" r="24" fill="none" stroke="#c8822a" stroke-width="20"/>
    <circle cx="50" cy="52" r="24" fill="none" stroke="#e8b058" stroke-width="13"/>
    ${[[30,40],[44,30],[64,34],[72,52],[62,70],[42,74],[28,60]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="2.2" fill="#9a5a14"/>`).join('')}
    <path d="M32 38 A24 24 0 0 1 50 28" stroke="#fff6d0" stroke-width="4" fill="none" stroke-linecap="round"/>`)},
  poncho: {nom:'poncho de 60 listas', svg: med('#fff8ee', `<path d="M50 16 L82 50 L50 80 L18 50 Z" fill="#fbf6ea" stroke="#3a2a1a" stroke-width="2"/>
    ${[24,30,36,42,48,54,60,66,72,78].map((x,i)=>`<path d="M${x} ${50-Math.min(x-18,82-x)} L${x} ${50+Math.min(x-18,82-x)}" stroke="${i%2?'#7a1a10':'#2a2a2a'}" stroke-width="1.6"/>`).join('')}
    <path d="M44 22 L56 22 L50 30 Z" fill="#3a2a1a"/>
    ${[26,32,38,44,50,56,62,68,74].map(x=>`<path d="M${x} ${50+Math.min(x-18,82-x)} l0 6" stroke="#3a2a1a" stroke-width="1.5"/>`).join('')}`)},
  miel: {nom:'miel', svg: med('#fff0b0', `<path d="M32 36 L68 36 L70 78 C70 84 66 86 62 86 L38 86 C34 86 30 84 30 78 Z" fill="#f2a20a" stroke="#7a4a00" stroke-width="2.5"/>
    <rect x="30" y="26" width="40" height="12" rx="3" fill="#a8641a" stroke="#5a3008" stroke-width="2"/>
    <path d="M40 38 L40 50 q3 5 6 0 L46 38" fill="#ffc42a"/>
    <path d="M50 58 l6 3.5 0 7 -6 3.5 -6 -3.5 0 -7Z" fill="#ffe27a" stroke="#a86a00" stroke-width="1.5"/>
    ${brillo(37,62,3,10,0,.5)}`)},
  hamaca: {nom:'hamaca', svg: med('#d8f0ff', `<path d="M18 22 L18 82 M82 22 L82 82" stroke="#6a3a10" stroke-width="5" stroke-linecap="round"/>
    <path d="M18 34 C30 70 70 70 82 34 L82 42 C70 80 30 80 18 42Z" fill="#e8402a" stroke="#6a1a08" stroke-width="2"/>
    <path d="M22 44 C34 72 66 72 78 44" stroke="#ffd21a" stroke-width="3" fill="none"/><path d="M24 50 C36 74 64 74 76 50" stroke="#2a8a4a" stroke-width="3" fill="none"/>`)},
  gota: {nom:'agua del salto', svg: med('#d0f0ff', `<path d="M50 14 C62 34 74 48 74 62 C74 76 63 86 50 86 C37 86 26 76 26 62 C26 48 38 34 50 14Z" fill="#2a9ae8" stroke="#0a4a8a" stroke-width="2.5"/>
    <path d="M38 60 C38 52 42 46 46 42" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".8"/>`)},
  libro: {nom:'libro de poesía', svg: med('#fff4dc', `<path d="M50 30 C40 24 28 24 18 28 L18 76 C28 72 40 72 50 78 C60 72 72 72 82 76 L82 28 C72 24 60 24 50 30Z" fill="#fffdf6" stroke="#5a3a1a" stroke-width="2.5"/>
    <path d="M50 30 L50 78" stroke="#5a3a1a" stroke-width="2"/>
    ${[38,46,54,62].map(y=>`<path d="M24 ${y} Q34 ${y-3} 44 ${y}" stroke="#9a8a7a" stroke-width="1.5" fill="none"/><path d="M56 ${y} Q66 ${y-3} 76 ${y}" stroke="#9a8a7a" stroke-width="1.5" fill="none"/>`).join('')}
    <path d="M18 76 C28 72 40 72 50 78 C60 72 72 72 82 76 L82 82 C72 78 60 78 50 84 C40 78 28 78 18 82Z" fill="#b8302a"/>`)},
  mandioca: {nom:'mandioca', svg: med('#fff3dc', `<g transform="rotate(-30 50 50)"><path d="M20 50 C20 40 30 38 50 40 C70 40 82 44 88 50 C82 56 70 60 50 60 C30 62 20 60 20 50Z" fill="#8a4a1e" stroke="#4a2008" stroke-width="2"/>
    <ellipse cx="22" cy="50" rx="6" ry="10" fill="#fff8e8" stroke="#4a2008" stroke-width="2"/><circle cx="22" cy="50" r="2" fill="#e8d0a0"/>
    <path d="M40 44 l2 4 M56 46 l-2 5 M70 47 l2 4" stroke="#4a2008" stroke-width="1.5"/></g>`)},
  nota: {nom:'música de Mangoré', svg: med('#e8e0ff', `<path d="M40 70 L40 26 L74 20 L74 62" stroke="#2a1a5a" stroke-width="5" fill="none" stroke-linejoin="round"/>
    <path d="M40 26 L74 20 L74 30 L40 36Z" fill="#2a1a5a"/>
    <ellipse cx="32" cy="72" rx="10" ry="7.5" fill="#2a1a5a" transform="rotate(-20 32 72)"/><ellipse cx="66" cy="64" rx="10" ry="7.5" fill="#2a1a5a" transform="rotate(-20 66 64)"/>`)},
  surubi: {nom:'surubí', svg: med('#d8f4ff', `<path d="M16 52 C26 36 56 34 74 46 L88 36 L86 52 L88 68 L74 58 C56 70 26 68 16 52Z" fill="#8a9aa8" stroke="#3a4a5a" stroke-width="2.5"/>
    ${[[34,46],[44,52],[54,46],[60,56],[40,58],[66,50]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="2.6" fill="#2a3440"/>`).join('')}
    <circle cx="24" cy="48" r="2.6" fill="#111"/><path d="M18 54 Q8 60 6 70 M20 56 Q14 64 14 72" stroke="#3a4a5a" stroke-width="1.8" fill="none"/>
    <path d="M22 58 C40 64 60 62 74 56" stroke="#f0f4f8" stroke-width="3" fill="none"/>`)},
  mascara: {nom:'carnaval', svg: med('#ffe0f4', `<path d="M38 40 C30 20 34 10 40 6 M50 36 C50 18 54 10 58 6 M62 40 C68 24 72 16 78 14" stroke="#1aa8a0" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M14 48 C24 36 40 40 50 48 C60 40 76 36 86 48 C84 62 72 70 62 66 C56 64 54 58 50 58 C46 58 44 64 38 66 C28 70 16 62 14 48Z" fill="#a82adb" stroke="#4a0a6a" stroke-width="2.5"/>
    <ellipse cx="34" cy="54" rx="8" ry="5" fill="#fff"/><ellipse cx="66" cy="54" rx="8" ry="5" fill="#fff"/>
    <path d="M16 50 C24 42 40 44 48 52 M84 50 C76 42 60 44 52 52" stroke="#ffd21a" stroke-width="2.5" fill="none"/>
    <circle cx="50" cy="46" r="3" fill="#ffd21a"/>`)},
  campana: {nom:'campana de las misiones', svg: med('#fff0d0', `<path d="M50 14 C64 14 66 30 68 44 C70 58 74 66 82 72 L18 72 C26 66 30 58 32 44 C34 30 36 14 50 14Z" fill="#e8b030" stroke="#7a5008" stroke-width="2.5"/>
    <rect x="44" y="8" width="12" height="8" rx="3" fill="#7a5008"/><circle cx="50" cy="80" r="7" fill="#b88010" stroke="#7a5008" stroke-width="2"/>
    <path d="M30 64 L70 64" stroke="#7a5008" stroke-width="2.5"/>${brillo(40,40,3,12,8,.55)}`)},
  yerba: {nom:'yerba mate', svg: med('#e4ffd0', `<path d="M60 8 L54 46" stroke="#c0c8d4" stroke-width="5" stroke-linecap="round"/>
    <path d="M28 40 C24 62 32 84 50 86 C68 84 76 62 72 40 Z" fill="#a8702a" stroke="#4a2a08" stroke-width="2.5"/>
    <ellipse cx="50" cy="40" rx="22" ry="7" fill="#5aa82a" stroke="#4a2a08" stroke-width="2"/>
    <path d="M30 56 Q50 62 70 56" stroke="#e8c070" stroke-width="3" fill="none"/>${brillo(37,62,3,10,10,.4)}`)},
  rayo: {nom:'energía de Itaipú', svg: med('#d8ecff', `<path d="M56 10 L26 56 L46 56 L38 90 L74 40 L54 40 L64 10Z" fill="#ffd21a" stroke="#8a5a00" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M54 16 L36 50" stroke="#fff8c0" stroke-width="3" stroke-linecap="round"/>`)},
  vaca: {nom:'ganadería', svg: med('#e0ffe0', `<path d="M24 30 C16 26 12 20 14 14 C20 20 26 22 32 24Z M76 30 C84 26 88 20 86 14 C80 20 74 22 68 24Z" fill="#f0e8d8" stroke="#6a5a4a" stroke-width="2"/>
    <path d="M28 26 C36 20 64 20 72 26 C76 40 74 54 68 64 L32 64 C26 54 24 40 28 26Z" fill="#fff" stroke="#3a3a3a" stroke-width="2.5"/>
    <path d="M30 30 C38 28 42 36 38 44 C32 44 28 38 30 30Z M60 24 C68 24 72 30 68 36 C62 36 58 30 60 24Z" fill="#2a2a2a"/>
    <ellipse cx="50" cy="70" rx="18" ry="12" fill="#ffb0b8" stroke="#8a4a50" stroke-width="2"/>
    <circle cx="43" cy="71" r="2.6" fill="#8a3a40"/><circle cx="57" cy="71" r="2.6" fill="#8a3a40"/>
    <circle cx="40" cy="46" r="3.5" fill="#111"/><circle cx="60" cy="46" r="3.5" fill="#111"/>`)},
  cana: {nom:'caña de azúcar', svg: med('#f0ffd0', `<g transform="rotate(14 50 50)">${[40,58].map(x=>`<rect x="${x-5}" y="12" width="10" height="76" rx="4" fill="#c8d84a" stroke="#5a6a10" stroke-width="2"/>
    ${[26,44,62,78].map(y=>`<path d="M${x-5} ${y} L${x+5} ${y}" stroke="#5a6a10" stroke-width="3"/>`).join('')}`).join('')}
    <path d="M58 14 C70 6 80 8 86 14 C76 14 68 16 60 22Z" fill="#3fae4a" stroke="#1d6b27" stroke-width="1.5"/>
    <path d="M40 14 C30 4 20 6 14 10 C24 12 32 16 40 22Z" fill="#3fae4a" stroke="#1d6b27" stroke-width="1.5"/></g>`)},
  leche: {nom:'leche y queso', svg: med('#dcefff', `<path d="M38 14 L56 14 L56 24 C62 30 64 36 64 42 L64 84 L30 84 L30 42 C30 36 32 30 38 24Z" fill="#fff" stroke="#4a6a8a" stroke-width="2.5"/>
    <rect x="36" y="10" width="22" height="7" rx="2" fill="#2a7ae8"/><rect x="30" y="52" width="34" height="18" fill="#2a7ae8"/>
    <path d="M38 61 q4 -6 9 0 q4 6 9 0" stroke="#fff" stroke-width="2.5" fill="none"/>
    <path d="M62 66 L84 58 L84 80 L62 86Z" fill="#ffd25a" stroke="#9a7a10" stroke-width="2"/><circle cx="72" cy="70" r="2.5" fill="#e8b020"/><circle cx="78" cy="77" r="2" fill="#e8b020"/>`)},
  nanduti: {nom:'ñandutí', svg: med('#ffe6f0', `<g stroke="#b8306a" stroke-width="1.6" fill="none">${Array.from({length:16},(_,i)=>{const a=i*Math.PI/8;return `<path d="M50 50 L${(50+34*Math.cos(a)).toFixed(1)} ${(50+34*Math.sin(a)).toFixed(1)}"/>`;}).join('')}
    ${[10,18,26,33].map(r=>`<polygon points="${Array.from({length:16},(_,i)=>{const a=i*Math.PI/8, rr=r+(i%2?2:0);return (50+rr*Math.cos(a)).toFixed(1)+','+(50+rr*Math.sin(a)).toFixed(1);}).join(' ')}"/>`).join('')}</g>
    <circle cx="50" cy="50" r="6" fill="#ff4a8a"/><circle cx="50" cy="50" r="2.5" fill="#ffd21a"/>`)},
};
// las frutas también se pueden mostrar como producto de la ciudad
for(const k in FRUTAS) PROD[k] = {nom:FRUTAS[k].nom, svg:FRUTAS[k].svg, fruta:true};

window.ARTE = { FRUTAS, PROD, GUAMPA };
})();
