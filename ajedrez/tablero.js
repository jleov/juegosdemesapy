'use strict';
/* =====================================================================
   Ajedrez y Damas PY — pantallas: sala de espera, tablero 2D y 3D,
   los 4 estilos de tablero (clásico, madera, futurista y a tu gusto),
   reloj, jugadas, pistas, tablas, deshacer y fin de partida.
   ===================================================================== */
let SEL=null;          // casilla elegida para mover
let REVIEW=null;       // si se está mirando una jugada vieja: cuántas jugadas se ven
let FLIP=false;        // el jugador dio vuelta el tablero a mano
let HINT=null;         // la pista que dio el juego {pos, from, to}
const PREF=Object.assign({tema:'clasico', vista:'2d', coords:true, girar:true, sonidoReloj:true,
  colores:{claro:'#f0d9b5', oscuro:'#5d8a4e', pb:'#fdf6e3', pn:'#7a1f2b'}}, load('ajedrez_pref')||{});
const savePref = () => store('ajedrez_pref', PREF);

/* ====================== ESTILOS DE TABLERO ====================== */
const TEMAS={
  clasico:  {n:'Clásico blanco y negro', e:'⚪⚫', claro:'#f2f2f2', oscuro:'#5b5b5b', pb:'#ffffff', pn:'#161616', marco:'#1d1d1d', fondo:'#23272e'},
  madera:   {n:'Madera',                 e:'🪵', claro:'#e7c393', oscuro:'#9c5f33', pb:'#f3dfb8', pn:'#47260f', marco:'#4a2a12', fondo:'#2a1c12', wood:true},
  futurista:{n:'Futurista',              e:'🚀', claro:'#1c2c74', oscuro:'#090d30', pb:'#3ff6ff', pn:'#ff3fd8', marco:'#05061a', fondo:'#03040f', neon:true},
  personal: {n:'A tu gusto',             e:'🎨', marco:'#2b2b2b', fondo:'#1f2430'},
};
function tema(){
  const t=Object.assign({id:PREF.tema}, TEMAS[PREF.tema]||TEMAS.clasico);
  if(PREF.tema==='personal') Object.assign(t, PREF.colores, {marco:mix(PREF.colores.oscuro,'#000000',.45)});
  return t;
}
// colores: para que las fichas nunca se confundan con las casillas
function hexRgb(h){ h=String(h).replace('#',''); if(h.length===3) h=h.split('').map(c=>c+c).join(''); const n=parseInt(h,16)||0; return [n>>16&255, n>>8&255, n&255]; }
function rgbHex(r,g,b){ return '#'+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join(''); }
function mix(a,b,t){ const x=hexRgb(a), y=hexRgb(b); return rgbHex(x[0]+(y[0]-x[0])*t, x[1]+(y[1]-x[1])*t, x[2]+(y[2]-x[2])*t); }
function lab(h){
  const f=v=>{ v/=255; return v>.04045 ? Math.pow((v+.055)/1.055,2.4) : v/12.92; };
  const [r,g,b]=hexRgb(h).map(f);
  let x=(r*.4124+g*.3576+b*.1805)/.95047, y=r*.2126+g*.7152+b*.0722, z=(r*.0193+g*.1192+b*.9505)/1.08883;
  const k=v=> v>.008856 ? Math.cbrt(v) : 7.787*v+16/116; x=k(x); y=k(y); z=k(z);
  return [116*y-16, 500*(x-y), 200*(y-z)];
}
const dE = (a,b) => { const x=lab(a), y=lab(b); return Math.hypot(x[0]-y[0], x[1]-y[1], x[2]-y[2]); };
const lum = h => { const [r,g,b]=hexRgb(h); return (r*299+g*587+b*114)/255000; };
const lineCol = fill => lum(fill)>.55 ? '#1b1b1b' : '#f4f4f4';
function colorProblemas(c){
  const out=[], MIN=28;
  [['pb','las fichas blancas (jugador 1)'],['pn','las fichas negras (jugador 2)']].forEach(([k,t])=>{
    if(dE(c[k],c.claro)<MIN) out.push(`El color de ${t} se parece mucho a las casillas claras.`);
    if(dE(c[k],c.oscuro)<MIN) out.push(`El color de ${t} se parece mucho a las casillas oscuras.`);
  });
  if(dE(c.pb,c.pn)<35) out.push('Las fichas de los dos jugadores tienen colores muy parecidos.');
  if(dE(c.claro,c.oscuro)<14) out.push('Las casillas claras y oscuras casi no se distinguen.');
  return out;
}

/* ====================== DIBUJO DE LAS FICHAS ====================== */
const BASE='<path d="M22 90h56v-5c0-5-3-8-8-8H30c-5 0-8 3-8 8z"/>';
const SHAPES={
  P: BASE+'<rect x="34" y="70" width="32" height="7" rx="3"/><path d="M40 70c0-10 2-18 6-24h8c4 6 6 14 6 24z"/><rect x="37" y="40" width="26" height="7" rx="3.5"/><circle cx="50" cy="29" r="12"/>',
  R: BASE+'<rect x="26" y="70" width="48" height="7" rx="2"/><path d="M32 70l3-32h30l3 32z"/><rect x="27" y="31" width="46" height="8" rx="2"/><path d="M27 31V15h10v7h8v-7h10v7h8v-7h10v16z"/>',
  B: BASE+'<rect x="30" y="70" width="40" height="7" rx="3"/><rect x="36" y="62" width="28" height="6" rx="3"/><path d="M38 62c-9-12-4-26 12-38c16 12 21 26 12 38z"/><path class="ln" d="M55 34l-9 12"/><circle cx="50" cy="19" r="5.5"/>',
  Q: BASE+'<rect x="27" y="70" width="46" height="7" rx="3"/><path d="M33 70L22 32l13 15 2-21 9 18 4-22 4 22 9-18 2 21 13-15-11 38z"/><circle cx="22" cy="30" r="4.5"/><circle cx="37" cy="24" r="4.5"/><circle cx="50" cy="20" r="4.5"/><circle cx="63" cy="24" r="4.5"/><circle cx="78" cy="30" r="4.5"/>',
  K: BASE+'<rect x="27" y="70" width="46" height="7" rx="3"/><path d="M34 70c-8-12-8-26 2-30h28c10 4 10 18 2 30z"/><rect x="33" y="35" width="34" height="6" rx="3"/><path d="M46 6h8v7h7v8h-7v14h-8V21h-7v-8h7z"/>',
  N: BASE+'<rect x="27" y="70" width="46" height="7" rx="3"/><path d="M33 70c0-12 5-18 12-24c-6 0-12 3-18 6c-6 3-11-3-7-8c6-8 12-16 18-22l1-9 6 7c14-2 26 9 28 26c2 12-2 18-4 24z"/><circle class="dot" cx="44" cy="30" r="2.8"/><path class="ln" d="M57 25c7 8 9 22 7 36"/>',
  M: '<circle cx="50" cy="52" r="40"/><circle class="ln" cx="50" cy="52" r="30"/><circle class="ln" cx="50" cy="52" r="19"/>',
  D: '<circle cx="50" cy="52" r="40"/><circle class="ln" cx="50" cy="52" r="31"/><path class="dot" d="M31 63l-4-22 12 10 11-17 11 17 12-10-4 22z"/>',
};
function pieceSVG(code, th){
  const fill = code[0]==='w' ? th.pb : th.pn, ln=lineCol(fill);
  const glow = th.neon ? `filter:drop-shadow(0 0 4px ${fill}) drop-shadow(0 0 1px ${fill})` : '';
  return `<svg viewBox="0 0 100 100" style="${glow}"><g fill="${fill}" stroke="${ln}" stroke-width="2.6" stroke-linejoin="round">${SHAPES[code[1]]||''}</g>`
    + `<style>.ln{fill:none}.dot{fill:${ln};stroke:none}</style></svg>`;
}
// la madera de los tableros (se dibuja una vez)
const WOOD={};
function woodCanvas(base, veta, seed, w, h){
  const c=document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d');
  g.fillStyle=base; g.fillRect(0,0,w,h);
  let s=seed; const R=()=>(s=(s*16807)%2147483647)/2147483647;
  for(let i=0;i<90;i++){
    const y0=R()*h, amp=2+R()*7, fr=.004+R()*.015, ph=R()*6;
    g.strokeStyle=`rgba(${veta},${.04+R()*.13})`; g.lineWidth=.6+R()*2.4; g.beginPath();
    for(let x=0;x<=w;x+=6){ const y=y0+Math.sin(x*fr+ph)*amp+Math.sin(x*fr*3.3+ph)*amp*.3; if(x) g.lineTo(x,y); else g.moveTo(x,y); }
    g.stroke();
  }
  return c;
}
function wood(kind){
  if(WOOD[kind]) return WOOD[kind];
  const th=TEMAS.madera;
  const c = kind==='l' ? woodCanvas(th.claro,'120,70,30',7,512,512) : kind==='d' ? woodCanvas(th.oscuro,'40,18,4',11,512,512) : woodCanvas(th.marco,'15,6,0',5,512,512);
  WOOD[kind]={c, url:c.toDataURL('image/jpeg',.85)}; return WOOD[kind];
}

/* ====================== RENDER GENERAL ====================== */
function render(){
  if(!S) return;
  V = NET.mode==='client' ? S : publicState(me());
  if(V.phase==='lobby'){ show('lobby'); renderLobby(); }
  else { show('game'); renderGame(); }
  renderSidePanels(); renderChatTo(); renderVoice(); voiceSync(); musicSync(); events();
}
const isPlayer = () => !!V && V.players.some(p=>p.id===me());
const hotseat = () => NET.mode==='local' && V && V.players.length===2 && V.players.every(p=>!p.bot);
const VPn = pid => { const p=V.players.find(x=>x.id===pid); return p ? `${p.emoji} ${p.name}` : '?'; };
const VP2 = pid => V.players.find(x=>x.id===pid);
const vTurn = () => V && V.pos ? turnOf(V) : 'w';
const vColorOf = pid => !V ? null : V.col.w===pid ? 'w' : V.col.b===pid ? 'b' : null;
// quién mueve desde este aparato (en "dos en este aparato", el que tiene el turno)
function actor(){ if(hotseat()) return V.col[vTurn()]; return me(); }
const myColor = () => vColorOf(actor());
function bottomColor(){
  let c = hotseat() ? (PREF.girar ? vTurn() : 'w') : (vColorOf(me()) || 'w');
  if(hotseat() && PREF.girar && V.phase!=='play') c='w';
  return FLIP ? opc(c) : c;
}
const boardOf = pos => V.juego==='damas' ? Motor.damas.board(pos) : Motor.chess.board(pos);
function curPly(){ return REVIEW==null ? V.hist.length : REVIEW; }
function curPos(){ const k=curPly(); return k>=V.hist.length ? V.pos : V.hist[k].pos; }
function curLm(){ const k=curPly(); return k>0 && V.hist[k-1] ? V.hist[k-1].lm : null; }
const LEGAL={pos:null, list:[]};
function legalNow(){
  if(!V || V.phase!=='play' || REVIEW!=null) return [];
  const c=myColor(); if(!c || c!==vTurn() || VP2(V.col[c]).bot) return [];
  if(LEGAL.pos!==V.pos){ LEGAL.pos=V.pos; LEGAL.list = V.juego==='damas' ? Motor.damas.legal(V.pos, dOpts(V)) : Motor.chess.legal(V.pos); }
  return LEGAL.list;
}
function playerTag(p){
  const host=p.id===V.hostPid, c=vColorOf(p.id);
  return `<span class="dot" style="background:${p.color}"></span><span style="font-size:20px">${esc(p.emoji)}</span><span class="nm">${esc(p.name)}${p.id===me()&&!hotseat()?' <span class="muted">(vos)</span>':''}${c&&V.phase!=='lobby'?` <span class="muted">${c==='w'?'⚪':'⚫'}</span>`:''}</span>`
    + `${host&&NET.mode!=='local'?'👑':''}${p.mic?'🎙️':''}${!p.bot&&!p.conn?'⚠️':''}`;
}
const nivelTxt = elo => { const n=Motor.nivel(elo); return `${n.e} ${n.elo} · ${n.n}`; };
function eloSelect(p, host){
  if(!p.bot) return '';
  if(!host) return `<span class="elo">🤖 ${esc(nivelTxt(p.elo||1200))}</span>`;
  return `<select class="elosel" title="Nivel del bot (ELO)" onchange="doAct({type:'botElo',pid:'${p.id}',elo:this.value})">${Motor.NIVELES.map(n=>`<option value="${n.elo}" ${n.elo===(p.elo||1200)?'selected':''}>🤖 ${n.e} ${n.elo} · ${n.n}</option>`).join('')}</select>`;
}

/* ---------- sala de espera ---------- */
function renderLobby(){
  const host=amHost(), myObs=!!NET.obs;
  $('#lobbyCode').textContent=NET.code||'—';
  $('#lobbyCodeBox').style.display = NET.mode==='local' ? 'none' : '';
  $('#lobbyTitle').textContent = NET.mode==='local' ? (hotseat() ? '👥 Dos en este aparato' : '🤖 Contra el bot') : '♟️ Sala de espera';
  $('#pcount').textContent=`(${V.players.length}/${MAXP})`;
  $('#plist').innerHTML=V.players.map(p=>`<li>${playerTag(p)}${eloSelect(p, host)}${host && p.id!==V.hostPid?`<button class="btn sm gray" onclick="doAct({type:'kick',pid:'${p.id}'})" title="Sacar">✕</button>`:''}</li>`).join('')
    + (V.observers||[]).map(x=>`<li style="opacity:.75"><span style="font-size:20px">👀</span><span class="nm">${esc(x.name)} <span class="muted">mirando</span></span>${x.mic?'🎙️':''}</li>`).join('');
  const err=(()=>{ const keep=S; S=V; try{ return canStart(); } finally{ S=keep; } })();
  $('#lobbyHostBtns').innerHTML = host
    ? `<div class="row">${V.players.length<MAXP?`<button class="btn gray" onclick="doAct({type:'addBot'})">🤖 Sumar bot</button>`:''}
       <button class="btn green" onclick="doAct({type:'start'})">▶️ Empezar</button></div>
       <p class="muted">${err?'⚠️ '+esc(err):'¡Listo para empezar!'} Juegan 2; los demás que entren miran 👀 con chat y voz.</p>`
    : `<p class="muted" style="text-align:center">⏳ Esperando que el anfitrión 👑 empiece la partida…</p>`;
  $('#lobbyObs').innerHTML = myObs ? `<div class="obsbar" style="border-radius:10px;margin-top:8px">👀 Estás mirando. ${V.players.length<MAXP?`<button class="btn sm gold" onclick="doAct({type:'joinNext'})">🪑 Sentarme a jugar</button>`:'Ya hay 2 jugadores.'}</div>` : '';
  const ob=$('#optsBox'), keepFocus=document.activeElement && ob.contains(document.activeElement) && document.activeElement.tagName==='INPUT';
  if(!keepFocus) ob.innerHTML = optsHTML(host);
  const g=$('#grulesBox');
  if(host){
    if(!g.querySelector('textarea')) g.innerHTML=`<textarea id="grulesIn" maxlength="1200" placeholder="Ej.: el que pierde ceba el tereré 🧉&#10;Pieza tocada, pieza movida"></textarea><p class="muted" style="margin:4px 0 0">Se guarda solo y lo ven todos.</p>`;
    const ta=$('#grulesIn'); if(document.activeElement!==ta) ta.value=V.grules||'';
    ta.oninput=()=>{ clearTimeout(ta.t); ta.t=setTimeout(()=>doAct({type:'grules', text:ta.value}), 600); };
  } else g.innerHTML = V.grules ? `<div class="grules">${esc(V.grules)}</div>` : `<p class="muted">El anfitrión todavía no escribió reglas propias.</p>`;
  $('#sugBox').innerHTML = sugsHTML(host);
}
function optsHTML(host){
  const o=V.opts, dis = host && V.phase==='lobby' ? '' : 'disabled';
  const sel=(k, list)=>`<select ${dis} onchange="doAct({type:'opt',k:'${k}',v:this.value})">${list.map(x=>`<option value="${x.v}" ${o[k]==x.v?'selected':''}>${x.t}</option>`).join('')}</select>`;
  const chk=(k, t, d)=>`<label class="opt" style="margin:0 0 6px;font-weight:400"><input type="checkbox" ${o[k]?'checked':''} ${dis} onchange="doAct({type:'opt',k:'${k}',v:this.checked})"><span><b>${t}</b><small>${d}</small></span></label>`;
  const num=(k, t, min, max, suf)=>`<label class="numin"><span>${t}</span><input type="number" inputmode="numeric" min="${min}" max="${max}" value="${o[k]}" ${dis} onchange="doAct({type:'opt',k:'${k}',v:this.value})"> <small>${suf}</small></label>`;
  const pl=V.players;
  let reloj='';
  if(o.reloj==='custom') reloj=`<div class="nums">${num('min','Minutos para cada uno',1,180,'min')}${num('inc','Se suma por jugada',0,60,'s')}</div>`;
  else if(o.reloj==='distinto') reloj=`<div class="nums">${num('minA', esc(pl[0]?pl[0].name:'Jugador 1'),1,180,'min')}${num('minB', esc(pl[1]?pl[1].name:'Jugador 2'),1,180,'min')}${num('inc','Se suma por jugada',0,60,'s')}</div><p class="muted" style="margin:2px 0 6px">Sirve para dar ventaja: el que sabe más juega con menos tiempo.</p>`;
  else if(o.reloj==='jugada') reloj=`<div class="nums">${num('porJug','Segundos para cada jugada',5,600,'s')}</div><p class="muted" style="margin:2px 0 6px">Si no movés a tiempo, perdés la partida.</p>`;
  return `<label style="margin-top:0">Juego ${host?'':'<span class="muted">(lo elige el anfitrión)</span>'}</label>
    <div class="juegos">${Object.keys(JUEGOS).map(k=>`<button class="jbtn ${o.juego===k?'on':''}" ${dis} onclick="doAct({type:'opt',k:'juego',v:'${k}'})">${JUEGOS[k]}</button>`).join('')}</div>
    ${o.juego==='damas' ? `<label>Reglas de las damas</label>${sel('var', Object.keys(Motor.damas.VAR).map(k=>({v:k, t:Motor.damas.VAR[k].n})))}
      <p class="muted" style="margin:4px 0">${esc(varDesc(o.var))}</p>
      ${chk('forz','⚠️ Comer es obligatorio','Si podés comer, tenés que comer (si no, se puede elegir).')}` : ''}
    <label>⏱️ Reloj</label>${sel('reloj', RELOJES)}${reloj}
    <label>Colores</label>${sel('colores', Object.keys(COLORES).map(k=>({v:k,t:COLORES[k]})))}
    <label>Duración</label>${sel('race', RACES)}
    ${chk('alterna','🔄 Cambiar de color en cada partida','En la revancha o la siguiente partida, el que tenía blancas juega con negras.')}
    <label>Ayudas</label>
    ${chk('ayuda','👆 Mostrar las jugadas posibles','Al tocar una ficha se marcan las casillas a donde puede ir.')}
    ${chk('deshacer','↩️ Se puede pedir deshacer','El rival tiene que aceptar (contra el bot es al instante).')}
    ${chk('tablas','🤝 Se pueden ofrecer tablas','El rival acepta o no.')}
    ${chk('pistas','💡 Pistas','Un botón que muestra una buena jugada (calculada en tu aparato).')}`;
}
function varDesc(v){
  return {inglesa:'Los peones comen solo para adelante. La dama camina de a una casilla. Al coronar comiendo, termina la jugada.',
    latina:'Los peones comen solo para adelante. La dama es voladora (va lejos en diagonal). Hay que comer la mayor cantidad posible.',
    brasilena:'Los peones comen para adelante y para atrás. La dama es voladora. Hay que comer la mayor cantidad posible.'}[v]||'';
}
function sugsHTML(host){
  const list=(V.sugs||[]).slice().sort((a,b)=>b.votes.length-a.votes.length);
  if(!list.length) return '<p class="muted">Todavía no hay sugerencias. ¡Proponé la primera!</p>';
  return list.map(s=>`<div class="sug"><span class="t">${esc(s.text)}<small>${esc(s.e)} ${esc(s.by)}</small></span>
    <button class="vote ${s.votes.includes(me())?'on':''}" onclick="doAct({type:'vote',id:'${s.id}'})">👍 ${s.votes.length}</button>
    ${host?`<button class="vote" onclick="doAct({type:'sugDel',id:'${s.id}'})" title="Borrar">🗑️</button>`:''}</div>`).join('');
}
function sendSug(id){ const i=$('#'+id); const t=i.value.trim(); if(!t) return toast('Escribí la regla que querés sugerir.'); doAct({type:'suggest', text:t}); i.value=''; toast('💡 ¡Sugerencia enviada! Los demás la pueden votar.'); }

/* ====================== PARTIDA ====================== */
function renderGame(){
  $('#roomTag').textContent = NET.mode==='local' ? (hotseat()?'👥 En este aparato':'🤖 Contra el bot') : '🔑 '+NET.code;
  $('#gameTitle').innerHTML = V.juego==='damas' ? 'DAMAS<small>PY</small>' : 'AJEDREZ<small>PY</small>';
  $('#obsbar').style.display = NET.obs ? 'flex' : 'none';
  if(NET.obs) $('#obsbar').innerHTML = `<span>👀 Estás mirando la partida.</span><button class="btn sm gold" onclick="flipBoard()">🔄 Dar vuelta</button>`;
  if(REVIEW!=null && REVIEW>=V.hist.length) REVIEW=null;
  if(SEL!=null && !legalNow().some(m=>m.from===SEL)) SEL=null;
  renderBars(); renderCtrl(); drawBoard();
}
function drawBoard(){ if(VIEW.mode==='3d'){ if(R3.ok) sync3D(); } else sync2D(); }
// las barras de los jugadores (arriba el rival, abajo el que mira)
function capturedBy(c){
  // fichas que capturó el color c
  if(V.juego==='damas'){ const bd=boardOf(curPos()); const left=bd.filter(x=>x && x[0]===opc(c)).length; return {list:new Array(Math.max(0,12-left)).fill(opc(c)+'M'), plus:0}; }
  const VALS={P:1,N:3,B:3,R:5,Q:9}, list=[];
  V.hist.slice(0, curPly()).forEach(h=>{ if(h.cap && h.c===c) list.push(h.cap); });
  const ord='QRBNP'; list.sort((a,b)=>ord.indexOf(a[1])-ord.indexOf(b[1]));
  const bd=boardOf(curPos()); let mw=0, mb=0; bd.forEach(x=>{ if(x && VALS[x[1]]) { if(x[0]==='w') mw+=VALS[x[1]]; else mb+=VALS[x[1]]; } });
  return {list, plus: c==='w' ? mw-mb : mb-mw};
}
function fmtClock(ms){
  if(ms==null) return '';
  ms=Math.max(0,ms); const s=ms/1000;
  if(s<10) return s.toFixed(1);
  const m=Math.floor(s/60), r=Math.floor(s%60);
  return m>=60 ? `${Math.floor(m/60)}:${String(m%60).padStart(2,'0')}:${String(r).padStart(2,'0')}` : `${m}:${String(r).padStart(2,'0')}`;
}
function barHTML(c){
  const pid=V.col[c], p=VP2(pid)||{name:'?', emoji:'❔'}, th=tema();
  const cap=capturedBy(c), turn=V.phase==='play' && vTurn()===c;
  const mini=cap.list.map(x=>`<i class="cp">${pieceSVG(x, th)}</i>`).join('');
  const clk = S.clock ? `<span class="clk ${turn?'run':''}" data-c="${c}">${fmtClock(clockLeft(S.clock,c))}</span>` : '';
  return `<div class="pbar ${turn?'on':''}" style="--pc:${p.color||'#888'}">
    <span class="sw" style="background:${c==='w'?th.pb:th.pn}"></span>
    <span class="who"><b>${esc(p.emoji)} ${esc(p.name)}</b>${p.bot?` <small>🤖 ${esc(nivelTxt(p.elo||1200))}</small>`:''}${!p.bot&&p.conn===false?' ⚠️':''}${p.mic?' 🎙️':''}
      <span class="caps">${mini}${cap.plus>0?`<small>+${cap.plus}</small>`:''}</span></span>
    ${V.opts.race>1?`<span class="pts">${(V.wins[pid]||0)} pt</span>`:''}${clk}</div>`;
}
function renderBars(){ const b=bottomColor(); $('#barTop').innerHTML=barHTML(opc(b)); $('#barBot').innerHTML=barHTML(b); }
setInterval(()=>{
  if(!S || !S.clock || !$('#game').classList.contains('on')) return;
  $$('.clk').forEach(el=>{
    const c=el.dataset.c, ms=clockLeft(S.clock,c);
    el.textContent=fmtClock(ms); el.classList.toggle('low', ms!=null && ms<20000);
    if(S.clock.run===c && ms<10000 && ms>0 && PREF.sonidoReloj && myColor()===c && !hotseat()){ const s=Math.ceil(ms/1000); if(s!==el._s){ el._s=s; sfx.low(); } }
  });
}, 100);

function renderCtrl(){
  const el=$('#ctrl'), pl=isPlayer() || hotseat(), my=myColor(), turn=vTurn(), o=V.offer, act=actor();
  let h='';
  if(REVIEW!=null){
    h=`<div class="msgline">📜 Mirando la jugada <b>${REVIEW}</b> de ${V.hist.length}</div>
      <div class="btns"><button class="btn sm dark" onclick="review(0)">⏮</button><button class="btn sm dark" onclick="review(REVIEW-1)">◀</button><button class="btn sm dark" onclick="review(REVIEW+1)">▶</button><button class="btn gold" onclick="review(null)">↩️ Volver a la partida</button></div>`;
  } else if(V.phase==='play'){
    const tp=VP2(V.col[turn]), chk=V.juego==='ajedrez' && Motor.chess.checkSq(V.pos)>=0;
    let msg;
    if(hotseat()) msg=`${chk?'⚠️ <b>¡Jaque!</b> ':''}Mueve <b>${esc(tp.emoji)} ${esc(tp.name)}</b> (${CN[turn]})`;
    else if(pl && my===turn) msg=`${chk?'⚠️ <b>¡Jaque!</b> ':''}<b>🙋 Te toca mover</b> (${CN[turn]})`;
    else msg=`${chk?'⚠️ ¡Jaque! ':''}⏳ Turno de ${esc(tp.emoji)} ${esc(tp.name)} (${CN[turn]})${tp.bot?' · 🤖 pensando…':''}`;
    if(S.clock && !S.clock.run && !V.hist.length) msg+=` <span class="muted" style="color:#cfd8e6">· el reloj arranca con la primera jugada</span>`;
    h=`<div class="msgline">${msg}</div>`;
    if(o){
      const by=VP2(o.by), what=o.k==='draw'?'🤝 ofrece tablas':'↩️ pide deshacer su última jugada';
      if(pl && o.by!==act && !(hotseat())) h+=`<div class="offer">${esc(by.emoji)} <b>${esc(by.name)}</b> ${what}. <button class="btn sm green" onclick="doMyAct({type:'reply',ok:true})">✅ Sí</button><button class="btn sm red" onclick="doMyAct({type:'reply',ok:false})">❌ No</button></div>`;
      else if(hotseat()) h+=`<div class="offer">${esc(by.emoji)} <b>${esc(by.name)}</b> ${what}. ${esc(VPn(other(V,o.by)))}: <button class="btn sm green" onclick="doAct2(other(V,V.offer.by),{type:'reply',ok:true})">✅ Sí</button><button class="btn sm red" onclick="doAct2(other(V,V.offer.by),{type:'reply',ok:false})">❌ No</button></div>`;
      else if(o.by===act) h+=`<div class="offer">⏳ Esperando la respuesta… <button class="btn sm gray" onclick="doMyAct({type:'cancelOffer'})">Cancelar</button></div>`;
      else h+=`<div class="offer">${esc(by.emoji)} ${esc(by.name)} ${what}.</div>`;
    }
    const b=[];
    if(pl){
      b.push(`<button class="btn sm red" onclick="resignClick()">🏳️ Rendirse</button>`);
      if(V.opts.tablas && !o) b.push(`<button class="btn sm dark" onclick="doMyAct({type:'offer',k:'draw'})">🤝 Tablas</button>`);
      if(V.opts.deshacer && !o && V.hist.length) b.push(`<button class="btn sm dark" onclick="doMyAct({type:'offer',k:'undo'})">↩️ Deshacer</button>`);
      if(V.opts.pistas && my===turn && !VP2(V.col[turn]).bot) b.push(`<button class="btn sm gold" onclick="hintClick()">💡 Pista</button>`);
    }
    b.push(`<button class="btn sm dark" onclick="flipBoard()" title="Dar vuelta el tablero">🔄</button>`);
    h+=`<div class="btns">${b.join('')}</div>`;
  } else {
    const r=V.result;
    h=`<div class="msgline">${r?(r.pid?`🏆 Ganó ${esc(VPn(r.pid))}: ${esc(r.why)}.`:`🤝 Tablas: ${esc(r.why)}.`):''} <button class="btn sm gold" onclick="endModal()">Ver resultado</button> <button class="btn sm dark" onclick="flipBoard()">🔄</button></div>`;
  }
  el.innerHTML=h;
}
// en "dos en este aparato" cada uno actúa con su propio jugador
function doMyAct(a){ if(NET.mode==='local') return doAct2(actor(), a); doAct(a); }
function doAct2(pid, a){ const r=act(pid, a); if(typeof r==='string') toast(r); }
function resignClick(){
  const who = hotseat() ? VPn(actor()) : 'vos';
  modal(`<h2>🏳️ ¿Rendirse?</h2><p>${hotseat()?`${esc(who)} abandona y`:'Abandonás y'} gana el rival.</p>
    <div class="row"><button class="btn gray" onclick="closeModal()">No, sigo</button><button class="btn red" onclick="closeModal();doMyAct({type:'resign'})">🏳️ Sí, me rindo</button></div>`);
}
function flipBoard(){ FLIP=!FLIP; R3.camKey=''; render(); }
function review(k){
  if(k==null || k>=V.hist.length){ REVIEW=null; }
  else REVIEW=Math.max(0, k);
  SEL=null; render();
}
function hintClick(){
  const pos=V.pos;
  toast('💡 Pensando una buena jugada…');
  const req = V.juego==='damas' ? {kind:'damas', pos, hist:V.hist.map(h=>h.pos), opts:dOpts(V), elo:2000, ms:1500} : {kind:'chess', fen:pos, hist:V.hist.map(h=>h.pos), elo:2000, ms:1500};
  Motor.ask(req, mv=>{ if(!mv || !V || V.pos!==pos) return; HINT={pos, from:mv.from, to:mv.to}; drawBoard(); });
}

/* ---------- tocar el tablero (2D y 3D usan lo mismo) ---------- */
function squareTap(sq){
  if(!V || V.phase!=='play') return;
  if(REVIEW!=null){ review(null); return; }
  const legal=legalNow();
  if(SEL!=null && legal.some(m=>m.from===SEL && m.to===sq)) return tryMove(SEL, sq);
  if(legal.some(m=>m.from===sq)){ SEL = SEL===sq ? null : sq; sfx.tick(); drawBoard(); return; }
  if(SEL!=null){ SEL=null; drawBoard(); return; }
  const bd=boardOf(V.pos), my=myColor();
  if(bd[sq] && my && bd[sq][0]===my){
    if(my!==vTurn()) toast('⏳ Esperá tu turno.');
    else if(V.juego==='damas' && V.opts.forz && legal.length && legal[0].caps.length) toast('⚠️ Tenés que comer: tocá la ficha que puede comer.');
    else toast('Esa ficha no se puede mover ahora.');
  }
}
function tryMove(from, to){
  const c=legalNow().filter(m=>m.from===from && m.to===to);
  if(!c.length) return;
  if(V.juego==='ajedrez' && c.length>1){ return promoModal(from, to); }
  if(V.juego==='damas' && c.length>1){
    return modal(`<h2>¿Por dónde comés?</h2><p class="muted">Hay más de un camino para llegar a esa casilla.</p>${c.map((m,i)=>`<button class="btn wide" style="margin-bottom:6px" onclick="closeModal();sendMove(${from},${to},null,[${m.path.join(',')}])">${i+1}. ${m.path.map(i=>Motor.chess.uci(i)).join(' → ')}</button>`).join('')}<button class="btn gray wide" onclick="closeModal()">Cancelar</button>`);
  }
  sendMove(from, to, c[0].promo||null, c[0].path||null);
}
function promoModal(from, to){
  const th=tema(), c=myColor();
  modal(`<h2>👑 ¿En qué se convierte el peón?</h2><div class="promo">${['q','r','b','n'].map(k=>`<button onclick="closeModal();sendMove(${from},${to},'${k}')">${pieceSVG(c+k.toUpperCase(), th)}<small>${{q:'Dama',r:'Torre',b:'Alfil',n:'Caballo'}[k]}</small></button>`).join('')}</div><button class="btn gray wide" onclick="closeModal();SEL=null;drawBoard()">Cancelar</button>`);
}
function sendMove(from, to, promo, path){
  SEL=null; HINT=null;
  const m={from, to}; if(promo) m.promo=promo; if(path) m.path=path;
  PEND={from, to};
  doMyAct({type:'move', m});
  drawBoard();
}
let PEND=null;   // jugada mandada que todavía no volvió del anfitrión (para que la ficha no salte)

/* ---------- avisos (sonidos y fin de partida) ---------- */
const EV={n:-1, phase:null, game:null, offer:null};
function events(){
  if(!V) return;
  if(V.phase==='play' || V.phase==='gameEnd' || V.phase==='over'){
    const n=V.hist.length;
    if(EV.n>=0 && n>EV.n && EV.game===V.gid){
      const h=V.hist[n-1];
      if(V.juego==='ajedrez' && Motor.chess.checkSq(V.pos)>=0) sfx.check();
      else if(h.cap || (h.lm.caps && h.lm.caps.length)) sfx.cap(); else sfx.move();
      if(V.phase==='play' && (isPlayer()||hotseat()) && myColor()===vTurn() && !hotseat() && document.hidden) sfx.turn();
    } else if(EV.n>=0 && n<EV.n && EV.game===V.gid) { sfx.move(); toast('↩️ Se deshizo la jugada.'); }
    EV.n=n;
  }
  const ok=V.offer ? V.offer.k+V.offer.at : null;
  if(ok && ok!==EV.offer && V.offer.by!==actor() && (isPlayer()||hotseat())){ sfx.offer(); toast(V.offer.k==='draw' ? `🤝 ${VPn(V.offer.by)} ofrece tablas.` : `↩️ ${VPn(V.offer.by)} pide deshacer.`); }
  EV.offer=ok;
  if((V.phase==='gameEnd'||V.phase==='over') && (EV.phase!==V.phase || EV.game!==V.gid)){
    const w=V.result && V.result.pid===me();
    if(isPlayer() && !hotseat() && V.result && V.result.pid) (w?sfx.win:sfx.lose)(); else sfx.win();
    setTimeout(()=>endModal(), 700);
  }
  if(V.phase==='play' && (EV.phase==='gameEnd'||EV.phase==='over'||EV.phase==='lobby')){ closeModal(); REVIEW=null; FLIP=false; HINT=null; R3.camKey=''; EV.n=V.hist.length; }
  EV.phase=V.phase; EV.game=V.gid;
}
function endModal(){
  if(!V || !V.result || (V.phase!=='gameEnd' && V.phase!=='over')) return;
  const r=V.result, host=amHost(), over=V.phase==='over';
  const tbl=V.players.map(p=>`<tr><td>${esc(p.emoji)} ${esc(p.name)}${p.bot?` <small class="muted">ELO ${p.elo}</small>`:''}</td><td style="text-align:right"><b>${String(V.wins[p.id]||0).replace('.5','½')}</b> pt</td></tr>`).join('');
  const champ = over && V.opts.race>1 ? V.players.slice().sort((a,b)=>(V.wins[b.id]||0)-(V.wins[a.id]||0))[0] : null;
  modal(`<h2>${r.pid?`🏆 ¡Ganó ${esc(VPn(r.pid))}!`:'🤝 ¡Tablas!'}</h2>
    <p style="margin:0 0 8px">${esc(r.why.charAt(0).toUpperCase()+r.why.slice(1))}.${r.pid?` Jugaba con ${CN[r.w]}.`:''} ${V.hist.length} jugadas.</p>
    ${champ && (V.wins[champ.id]||0)>=V.opts.race?`<p><b>🏅 ${esc(champ.name)} ganó el encuentro.</b></p>`:''}
    <table class="score">${tbl}</table>
    ${host ? (over ? `<div class="row"><button class="btn green" onclick="doAct({type:'rematch'})">🔁 Revancha</button><button class="btn gray" onclick="doAct({type:'newGame'})">⚙️ Volver a la sala</button></div>`
                   : `<button class="btn green wide" onclick="doAct({type:'next'})">▶️ Siguiente partida</button>`)
           : `<p class="muted" style="text-align:center">⏳ Esperando al anfitrión…</p>`}
    <div class="row" style="margin-top:6px"><button class="btn gray" onclick="closeModal()">Ver el tablero</button>${V.juego==='ajedrez'?`<button class="btn dark" onclick="copyPGN()">📋 Copiar PGN</button>`:''}</div>`);
}

/* ====================== TABLERO 2D ====================== */
const VIEW={mode: PREF.vista==='3d' ? '3d' : '2d'};
const P2D={pos:null, els:{}, theme:null, game:null};
function sqXY(sq){ const f=sq&7, r=sq>>3, b=bottomColor(); return b==='w' ? [f, 7-r] : [7-f, r]; }
function sqAt2D(x, y){
  const r=$('#board2d').getBoundingClientRect(); const fx=Math.floor((x-r.left)/r.width*8), fy=Math.floor((y-r.top)/r.height*8);
  if(fx<0||fx>7||fy<0||fy>7) return -1;
  return bottomColor()==='w' ? (7-fy)*8+fx : fy*8+(7-fx);
}
function layout2D(){
  const st=$('#stage'), w=st.clientWidth-8, h=st.clientHeight-8, s=Math.max(160, Math.floor(Math.min(w,h)/8)*8);
  const b=$('#board2d'); b.style.width=b.style.height=s+'px';
}
function sync2D(){
  if(!V || !V.pos) return;
  const box=$('#board2d'), th=tema(), pos=curPos(), lm=curLm(), bd=boardOf(pos);
  if(P2D.pos!==pos) PEND=null;
  box.className='b2d t-'+th.id;
  box.style.setProperty('--cl', th.claro); box.style.setProperty('--cd', th.oscuro); box.style.setProperty('--mk', th.marco);
  // casillas
  const legal=legalNow(), V_ay=V.opts.ayuda!==false, tg=SEL!=null && V_ay ? legal.filter(m=>m.from===SEL) : [];
  const chk = V.juego==='ajedrez' ? Motor.chess.checkSq(pos) : -1;
  const hint = HINT && HINT.pos===V.pos && REVIEW==null ? HINT : null;
  const path = lm && lm.path ? lm.path : [];
  let sq=box.querySelector('.sqs');
  if(!sq || P2D.flipKey!==bottomColor()+th.id){
    P2D.flipKey=bottomColor()+th.id;
    if(sq) sq.remove();
    sq=document.createElement('div'); sq.className='sqs'; box.prepend(sq);
    let h='';
    for(let y=0;y<8;y++) for(let x=0;x<8;x++){
      const i = bottomColor()==='w' ? (7-y)*8+x : y*8+(7-x), r=i>>3, f=i&7, light=((r+f)&1)===1;
      const wd = th.wood ? `background-image:url(${wood(light?'l':'d').url});background-position:${(f*13+r*7)%100}% ${(r*17+f*5)%100}%;` : '';
      h+=`<div class="sq ${light?'l':'d'}" data-i="${i}" style="${wd}">${PREF.coords && y===7?`<span class="cf">${'abcdefgh'[f]}</span>`:''}${PREF.coords && x===0?`<span class="cr">${r+1}</span>`:''}</div>`;
    }
    sq.innerHTML=h;
  }
  sq.querySelectorAll('.sq').forEach(el=>{
    const i=+el.dataset.i;
    el.classList.toggle('lm', !!lm && (lm.from===i || lm.to===i));
    el.classList.toggle('lmp', path.includes(i) && lm.from!==i && lm.to!==i);
    el.classList.toggle('sel', SEL===i);
    const t=tg.find(m=>m.to===i);
    el.classList.toggle('tg', !!t && !bd[i]);
    el.classList.toggle('tgc', !!t && !!bd[i]);
    el.classList.toggle('chk', chk===i);
    el.classList.toggle('hint', !!hint && (hint.from===i || hint.to===i));
    el.classList.toggle('can', V_ay && SEL==null && legal.some(m=>m.from===i));
  });
  // fichas
  const layer=box.querySelector('.pcs'), els=P2D.els, themeKey=th.id+JSON.stringify(PREF.colores)+V.juego;
  if(P2D.theme!==themeKey || P2D.game!==V.gid+V.juego){ layer.innerHTML=''; P2D.els={}; P2D.pos=null; P2D.theme=themeKey; P2D.game=V.gid+V.juego; }
  const E=P2D.els;
  if(P2D.pos && P2D.pos!==pos && lm && E[lm.from] && !bd[lm.from]){
    const el=E[lm.from]; delete E[lm.from];
    if(E[lm.to]){ gone(E[lm.to]); }
    E[lm.to]=el;
    if(V.juego==='ajedrez' && bd[lm.to] && bd[lm.to][1]==='K' && Math.abs((lm.to&7)-(lm.from&7))===2){
      const rf = lm.to>lm.from ? lm.from+3 : lm.from-4, rt = lm.to>lm.from ? lm.from+1 : lm.from-1;
      if(E[rf]){ if(E[rt]) gone(E[rt]); E[rt]=E[rf]; delete E[rf]; }
    }
  }
  for(let i=0;i<64;i++){
    const want=bd[i]; let el=E[i];
    if(el && !want){ gone(el); delete E[i]; continue; }
    if(!want) continue;
    if(!el){ el=document.createElement('div'); el.className='pc'; layer.appendChild(el); E[i]=el; el.style.transition='none'; }
    if(el.dataset.p!==want){ el.dataset.p=want; el.innerHTML=pieceSVG(want, th); }
    const [x,y]=sqXY(PEND && PEND.from===i ? PEND.to : i);
    if(!(DRAG && DRAG.el===el)) el.style.transform=`translate(${x*100}%,${y*100}%)`;
    el.classList.toggle('lift', SEL===i);
    if(el.style.transition==='none') requestAnimationFrame(()=>{ el.style.transition=''; });
  }
  P2D.pos=pos;
  drawArrow(hint);
  function gone(el){ el.classList.add('gone'); setTimeout(()=>el.remove(), 260); }
}
function drawArrow(h){
  const svg=$('#board2d .arw'); if(!svg) return;
  if(!h){ svg.innerHTML=''; return; }
  const [x1,y1]=sqXY(h.from), [x2,y2]=sqXY(h.to);
  svg.innerHTML=`<defs><marker id="ah" markerWidth="4" markerHeight="4" refX="2.2" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 z" fill="rgba(255,190,0,.9)"/></marker></defs>
    <line x1="${x1+.5}" y1="${y1+.5}" x2="${x2+.5}" y2="${y2+.5}" stroke="rgba(255,190,0,.85)" stroke-width=".18" stroke-linecap="round" marker-end="url(#ah)"/>`;
}
// arrastrar o tocar
let DRAG=null;
(function wire2D(){
  const box=$('#board2d');
  box.addEventListener('pointerdown', e=>{
    if(!V || V.phase!=='play') return;
    const sq=sqAt2D(e.clientX, e.clientY); if(sq<0) return;
    const legal=legalNow();
    if(legal.some(m=>m.from===sq) && !(SEL!=null && legal.some(m=>m.from===SEL && m.to===sq))){
      const el=P2D.els[sq];
      if(el){ DRAG={sq, el, x:e.clientX, y:e.clientY, moved:false, id:e.pointerId}; try{ box.setPointerCapture(e.pointerId); }catch(err){} }
    }
    e.preventDefault();
  });
  box.addEventListener('pointermove', e=>{
    if(!DRAG || e.pointerId!==DRAG.id) return;
    if(!DRAG.moved && Math.hypot(e.clientX-DRAG.x, e.clientY-DRAG.y)<6) return;
    if(!DRAG.moved){ DRAG.moved=true; SEL=DRAG.sq; sync2D(); DRAG.el.classList.add('drag'); }
    const r=box.getBoundingClientRect(), s=r.width/8;
    DRAG.el.style.transform=`translate(${(e.clientX-r.left-s/2)/s*100}%,${(e.clientY-r.top-s/2)/s*100}%)`;
  });
  const up=e=>{
    const d=DRAG; DRAG=null;
    const sq=sqAt2D(e.clientX, e.clientY);
    if(d){ d.el.classList.remove('drag');
      if(d.moved){
        if(sq>=0 && sq!==d.sq && legalNow().some(m=>m.from===d.sq && m.to===sq)){ const [x,y]=sqXY(sq); d.el.style.transition='none'; d.el.style.transform=`translate(${x*100}%,${y*100}%)`; requestAnimationFrame(()=>d.el.style.transition=''); tryMove(d.sq, sq); return; }
        sync2D(); return;
      }
    }
    if(sq>=0) squareTap(sq);
  };
  box.addEventListener('pointerup', up);
  box.addEventListener('pointercancel', ()=>{ if(DRAG){ DRAG.el.classList.remove('drag'); DRAG=null; sync2D(); } });
})();
function resizeStage(){ layout2D(); resize3D(); }
window.addEventListener('resize', ()=>{ clearTimeout(resizeStage.t); resizeStage.t=setTimeout(resizeStage, 80); });

/* ====================== TABLERO 3D ====================== */
const R3={ok:false, pcs:{}, pos:null, theme:null, camKey:''};
const CAM3=Object.assign({yaw:0, pitch:48, zoom:1}, load('ajedrez_cam3')||{});
const PROF={   // perfiles de las fichas (radio, altura) que se tornean
  P:[[0,0],[.34,0],[.34,.06],[.29,.09],[.28,.12],[.19,.16],[.13,.32],[.11,.40],[.19,.42],[.19,.45],[.09,.47]],
  R:[[0,0],[.38,0],[.38,.07],[.32,.11],[.29,.15],[.25,.50],[.29,.53],[.31,.58],[.31,.72],[.22,.72],[.22,.66],[0,.66]],
  B:[[0,0],[.36,0],[.36,.07],[.30,.10],[.26,.15],[.15,.42],[.13,.50],[.21,.53],[.21,.56],[.13,.58],[.19,.66],[.20,.75],[.15,.86],[.08,.92],[0,.95]],
  Q:[[0,0],[.39,0],[.39,.07],[.32,.11],[.28,.16],[.15,.56],[.14,.70],[.24,.73],[.24,.76],[.15,.78],[.23,.99],[.17,1.01],[.08,1.0],[0,1.02]],
  K:[[0,0],[.40,0],[.40,.07],[.33,.11],[.29,.16],[.16,.60],[.15,.76],[.26,.79],[.26,.82],[.16,.84],[.22,1.03],[.10,1.06],[0,1.06]],
  N:[[0,0],[.38,0],[.38,.07],[.31,.11],[.29,.17],[.26,.24],[0,.24]],
};
const KNIGHT2D=[[33,70],[34,58],[40,50],[45,46],[36,47],[27,52],[21,50],[20,44],[26,36],[32,28],[38,22],[39,13],[45,20],[56,19],[66,25],[71,35],[73,46],[72,58],[69,70]];
const GEO={};
function geo(t){
  if(GEO[t]) return GEO[t];
  let g;
  if(t==='M' || t==='D'){ g=new THREE.CylinderGeometry(.38,.40,.13,40); g.translate(0,.065,0); }
  else if(t==='N'){
    const sh=new THREE.Shape(); KNIGHT2D.forEach(([x,y],i)=>{ const X=(x-52)*.0105, Y=.22+(70-y)*.0125; if(i) sh.lineTo(X,Y); else sh.moveTo(X,Y); });
    g=new THREE.ExtrudeGeometry(sh, {depth:.22, bevelEnabled:true, bevelThickness:.04, bevelSize:.03, bevelSegments:2, curveSegments:4}); g.translate(0,0,-.11);
  } else g=new THREE.LatheGeometry(PROF[t].map(([r,y])=>new THREE.Vector2(r,y)), 32);
  GEO[t]=g; return g;
}
function pieceMat(color, th){
  if(th.neon) return new THREE.MeshStandardMaterial({color, emissive:color, emissiveIntensity:.45, metalness:.5, roughness:.25, transparent:true, opacity:.92});
  if(th.wood){ const tex=new THREE.CanvasTexture(woodCanvas('#ffffff','0,0,0', color===th.pb?3:9, 256, 256)); return new THREE.MeshStandardMaterial({color, map:tex, roughness:.5, metalness:.02}); }
  return new THREE.MeshStandardMaterial({color, roughness:.32, metalness:.08});
}
function makePiece3D(code){
  const th=R3.th, mat=R3.mats[code[0]], t=code[1], grp=new THREE.Group();
  const m=new THREE.Mesh(geo(t==='N'?'N':t), mat); m.castShadow=true; grp.add(m);
  if(t==='N'){ const b=new THREE.Mesh(new THREE.LatheGeometry(PROF.N.map(([r,y])=>new THREE.Vector2(r,y)),32), mat); b.castShadow=true; grp.add(b); }
  if(t==='P'){ const h=new THREE.Mesh(new THREE.SphereGeometry(.16,24,16), mat); h.position.y=.58; h.castShadow=true; grp.add(h); }
  if(t==='Q'){ const h=new THREE.Mesh(new THREE.SphereGeometry(.08,16,12), mat); h.position.y=1.08; grp.add(h); }
  if(t==='K'){ const a=new THREE.Mesh(new THREE.BoxGeometry(.07,.26,.07), mat), b=new THREE.Mesh(new THREE.BoxGeometry(.2,.07,.07), mat); a.position.y=1.18; b.position.y=1.2; grp.add(a,b); }
  if(t==='R'){ for(let i=0;i<4;i++){ const c=new THREE.Mesh(new THREE.BoxGeometry(.11,.1,.11), mat); const a=i*Math.PI/2+Math.PI/4; c.position.set(Math.cos(a)*.24,.77,Math.sin(a)*.24); grp.add(c); } }
  if(t==='M' || t==='D'){
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.26,.025,8,40), new THREE.MeshStandardMaterial({color:lineCol(code[0]==='w'?th.pb:th.pn), roughness:.5}));
    ring.rotation.x=Math.PI/2; ring.position.y=.135; grp.add(ring);
    if(t==='D'){ const m2=new THREE.Mesh(geo('M'), mat); m2.position.y=.13; m2.castShadow=true; grp.add(m2);
      const cr=new THREE.Mesh(new THREE.TorusGeometry(.16,.04,8,24), new THREE.MeshStandardMaterial({color:'#f2c14e', metalness:.7, roughness:.3, emissive:'#5a4000'})); cr.rotation.x=Math.PI/2; cr.position.y=.28; grp.add(cr); }
  }
  // los caballos miran de costado, hacia el que juega con ese color
  if(t==='N') grp.rotation.y = code[0]==='w' ? 0 : Math.PI;
  grp.userData={code};
  return grp;
}
const sq3 = i => [ (i&7)-3.5, 3.5-(i>>3) ];
function init3D(){
  if(R3.ok) return true;
  if(!window.THREE){ toast('No se pudo cargar el 3D en este aparato.'); return false; }
  const cv=$('#c3d');
  try{ R3.renderer=new THREE.WebGLRenderer({canvas:cv, antialias:true}); }catch(e){ toast('Este aparato no tiene 3D (WebGL).'); return false; }
  R3.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio||1));
  R3.renderer.shadowMap.enabled=true; R3.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  R3.scene=new THREE.Scene();
  R3.cam=new THREE.PerspectiveCamera(40, 1, .1, 200);
  R3.ray=new THREE.Raycaster();
  wire3D(cv);
  R3.ok=true; resize3D();
  let last=performance.now();
  const loop=now=>{ const dt=Math.min(.05,(now-last)/1000); last=now; if(R3.ok && VIEW.mode==='3d' && $('#game').classList.contains('on')) draw3D(dt); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  return true;
}
// arma el tablero y la mesa con el estilo elegido
function build3DScene(th){
  const sc=R3.scene;
  while(sc.children.length) sc.remove(sc.children[0]);
  R3.pcs={}; R3.pos=null;
  sc.background=new THREE.Color(th.fondo);
  sc.fog = th.neon ? new THREE.Fog(th.fondo, 14, 34) : null;
  sc.add(new THREE.HemisphereLight(0xffffff, th.neon?0x220044:0x3a3028, th.neon?.45:.55));
  const dl=new THREE.DirectionalLight(0xffffff, th.neon?.5:.7); dl.position.set(4,12,6); dl.castShadow=true;
  dl.shadow.mapSize.set(1024,1024); Object.assign(dl.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:1,far:30}); sc.add(dl);
  if(th.neon){ const a=new THREE.PointLight(0x3ff6ff,.9,18); a.position.set(-5,3,5); const b=new THREE.PointLight(0xff3fd8,.9,18); b.position.set(5,3,-5); sc.add(a,b); }
  // mesa
  const mesaMat = th.wood ? new THREE.MeshStandardMaterial({color:'#6b4424', roughness:.85}) : th.neon ? new THREE.MeshStandardMaterial({color:'#050716', roughness:.4, metalness:.6}) : new THREE.MeshStandardMaterial({color:'#2e333b', roughness:.9});
  const mesa=new THREE.Mesh(new THREE.CircleGeometry(16,48), mesaMat); mesa.rotation.x=-Math.PI/2; mesa.position.y=-.32; mesa.receiveShadow=true; sc.add(mesa);
  if(th.neon){ const grid=new THREE.GridHelper(32, 32, 0x3ff6ff, 0x1a2a66); grid.position.y=-.31; grid.material.transparent=true; grid.material.opacity=.35; sc.add(grid); }
  // marco
  const marcoMat = th.wood ? new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(wood('m').c), roughness:.6}) : th.neon ? new THREE.MeshStandardMaterial({color:'#0a0d2a', emissive:'#101860', metalness:.7, roughness:.3}) : new THREE.MeshStandardMaterial({color:th.marco, roughness:.4, metalness:.1});
  const marco=new THREE.Mesh(new THREE.BoxGeometry(9.2,.3,9.2), marcoMat); marco.position.y=-.15; marco.receiveShadow=true; marco.castShadow=true; sc.add(marco);
  if(th.neon){ const edge=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(9.2,.3,9.2)), new THREE.LineBasicMaterial({color:0x3ff6ff})); edge.position.y=-.15; sc.add(edge); }
  // casillas: una textura que se vuelve a pintar cuando cambian las marcas
  R3.base=document.createElement('canvas'); R3.base.width=R3.base.height=1024;
  paintBase(R3.base.getContext('2d'), th);
  R3.tcv=document.createElement('canvas'); R3.tcv.width=R3.tcv.height=1024;
  R3.tex=new THREE.CanvasTexture(R3.tcv); R3.tex.anisotropy=8;
  const mat = th.neon ? new THREE.MeshStandardMaterial({map:R3.tex, roughness:.2, metalness:.4, emissiveMap:R3.tex, emissive:'#ffffff', emissiveIntensity:.35}) : new THREE.MeshStandardMaterial({map:R3.tex, roughness: th.wood?.55:.35});
  R3.plane=new THREE.Mesh(new THREE.PlaneGeometry(8,8), mat); R3.plane.rotation.x=-Math.PI/2; R3.plane.position.y=.005; R3.plane.receiveShadow=true; sc.add(R3.plane);
  R3.mats={w:pieceMat(th.pb, th), b:pieceMat(th.pn, th)};
  R3.th=th;
}
function paintBase(g, th){
  const s=128;
  for(let r=0;r<8;r++) for(let f=0;f<8;f++){
    const light=((r+f)&1)===1, x=f*s, y=(7-r)*s;
    if(th.wood){ const w=wood(light?'l':'d').c; g.drawImage(w, ((f*61+r*29)%3)*128, ((r*47+f*13)%3)*128, 128, 128, x, y, s, s); }
    else { g.fillStyle=light?th.claro:th.oscuro; g.fillRect(x,y,s,s); }
    if(th.neon){ g.strokeStyle='rgba(63,246,255,.35)'; g.lineWidth=3; g.strokeRect(x+1.5,y+1.5,s-3,s-3); }
  }
}
function paintMarks(){
  const g=R3.tcv.getContext('2d'), s=128;
  g.drawImage(R3.base,0,0);
  const pos=curPos(), lm=curLm(), bd=boardOf(pos), legal=legalNow(), tg=SEL!=null && V.opts.ayuda!==false ? legal.filter(m=>m.from===SEL) : [];
  const chk = V.juego==='ajedrez' ? Motor.chess.checkSq(pos) : -1, hint=HINT && HINT.pos===V.pos && REVIEW==null ? HINT : null;
  const box=(i,c)=>{ g.fillStyle=c; g.fillRect((i&7)*s, (7-(i>>3))*s, s, s); };
  if(lm){ box(lm.from,'rgba(255,214,0,.38)'); box(lm.to,'rgba(255,214,0,.45)'); (lm.path||[]).forEach(i=>{ if(i!==lm.from && i!==lm.to) box(i,'rgba(255,214,0,.22)'); }); }
  if(SEL!=null) box(SEL,'rgba(40,200,90,.55)');
  if(hint){ box(hint.from,'rgba(255,150,0,.55)'); box(hint.to,'rgba(255,150,0,.55)'); }
  if(chk>=0){ const x=(chk&7)*s+s/2, y=(7-(chk>>3))*s+s/2, gr=g.createRadialGradient(x,y,4,x,y,s*.7); gr.addColorStop(0,'rgba(255,0,0,.9)'); gr.addColorStop(1,'rgba(255,0,0,0)'); g.fillStyle=gr; g.fillRect(x-s/2,y-s/2,s,s); }
  tg.forEach(m=>{ const x=(m.to&7)*s+s/2, y=(7-(m.to>>3))*s+s/2; g.beginPath();
    if(bd[m.to]){ g.lineWidth=10; g.strokeStyle='rgba(20,20,20,.5)'; g.arc(x,y,s*.42,0,7); g.stroke(); } else { g.fillStyle='rgba(20,20,20,.42)'; g.arc(x,y,s*.15,0,7); g.fill(); } });
  if(PREF.coords){ g.font='bold 22px system-ui,sans-serif'; for(let f=0;f<8;f++){ const light=(f&1)===1; g.fillStyle=R3.th.neon?'#3ff6ff':light?R3.th.oscuro:R3.th.claro; g.fillText('abcdefgh'[f], f*s+s-20, 1024-8); }
    for(let r=0;r<8;r++){ const light=(r&1)===1; g.fillStyle=R3.th.neon?'#3ff6ff':light?R3.th.oscuro:R3.th.claro; g.fillText(String(r+1), 6, (7-r)*s+24); } }
  R3.tex.needsUpdate=true;
}
function sync3D(){
  if(!R3.ok || !V || !V.pos) return;
  const th=tema(), tk=th.id+JSON.stringify(PREF.colores)+V.juego+V.gid;
  if(R3.theme!==tk){ R3.theme=tk; build3DScene(th); }
  const pos=curPos(), lm=curLm(), bd=boardOf(pos), E=R3.pcs, now=performance.now();
  if(R3.pos && R3.pos!==pos && lm && E[lm.from] && !bd[lm.from]){
    const o=E[lm.from]; delete E[lm.from];
    if(E[lm.to]) gone3(E[lm.to]);
    E[lm.to]=o; o.userData.anim={t0:now, from:o.position.clone(), path:(lm.path||[lm.from,lm.to]).slice(1), hop: (o.userData.code[1]==='N'||V.juego==='damas')};
    if(V.juego==='ajedrez' && bd[lm.to] && bd[lm.to][1]==='K' && Math.abs((lm.to&7)-(lm.from&7))===2){
      const rf = lm.to>lm.from ? lm.from+3 : lm.from-4, rt = lm.to>lm.from ? lm.from+1 : lm.from-1;
      if(E[rf]){ const r=E[rf]; delete E[rf]; E[rt]=r; r.userData.anim={t0:now+120, from:r.position.clone(), path:[rt], hop:true}; }
    }
    (lm.caps||[]).forEach(c=>{ if(E[c] && !bd[c]){ const x=E[c]; delete E[c]; x.userData.dieAt=now+260; } });
  }
  for(let i=0;i<64;i++){
    const want=bd[i]; let o=E[i];
    if(o && (!want || o.userData.code!==want)){ if(!want){ gone3(o); delete E[i]; continue; } R3.scene.remove(o); delete E[i]; o=null; }
    if(!want) continue;
    if(!o){ o=makePiece3D(want); const [x,z]=sq3(i); o.position.set(x,0,z); R3.scene.add(o); E[i]=o; }
    o.userData.sq=i;
  }
  R3.pos=pos;
  paintMarks();
  const ck=bottomColor()+'|'+V.gid;
  if(R3.camKey!==ck){ R3.camKey=ck; CAM3.yaw=0; }
  function gone3(o){ o.userData.dieAt=now; }
}
function draw3D(dt){
  const now=performance.now();
  R3.scene.children.slice().forEach(o=>{
    const u=o.userData; if(!u || !u.code) return;
    if(u.dieAt!=null){ const k=(now-u.dieAt)/250; if(k>0){ o.scale.setScalar(Math.max(.01,1-k)); o.position.y=-k*.3; if(k>=1) R3.scene.remove(o); } return; }
    if(u.anim){
      const a=u.anim, seg=a.path.length, dur=260*seg, k=Math.min(1,Math.max(0,(now-a.t0)/dur));
      const si=Math.min(seg-1, Math.floor(k*seg)), kk=k*seg-si;
      const from = si===0 ? a.from : (()=>{ const [x,z]=sq3(a.path[si-1]); return new THREE.Vector3(x,0,z); })();
      const [tx,tz]=sq3(a.path[si]), e=kk<.5?2*kk*kk:1-Math.pow(-2*kk+2,2)/2;
      o.position.x=from.x+(tx-from.x)*e; o.position.z=from.z+(tz-from.z)*e;
      o.position.y = a.hop ? Math.sin(kk*Math.PI)*.45 : Math.sin(kk*Math.PI)*.08;
      if(k>=1){ u.anim=null; o.position.y=0; }
      return;
    }
    const lift = u.sq===SEL && R3.pcs[u.sq]===o ? .18 : 0;
    o.position.y += (lift-o.position.y)*Math.min(1,dt*12);
  });
  const base = bottomColor()==='w' ? 0 : 180;
  const yaw=(CAM3.yaw+base)*Math.PI/180, pit=Math.max(15,Math.min(88,CAM3.pitch))*Math.PI/180;
  const d=(R3.dist||13)/CAM3.zoom;
  R3.cam.position.set(d*Math.sin(yaw)*Math.cos(pit), d*Math.sin(pit), d*Math.cos(yaw)*Math.cos(pit));
  R3.cam.lookAt(0,0,0);
  R3.renderer.render(R3.scene, R3.cam);
}
function resize3D(){
  if(!R3.ok) return;
  const st=$('#stage'), w=st.clientWidth, h=st.clientHeight; if(!w||!h) return;
  R3.renderer.setSize(w,h,false); R3.cam.aspect=w/h; R3.cam.updateProjectionMatrix();
  const fov=R3.cam.fov*Math.PI/180, hfov=2*Math.atan(Math.tan(fov/2)*R3.cam.aspect);
  R3.dist=Math.max(6.2/Math.tan(hfov/2), 6.0/Math.tan(fov/2));
}
function wire3D(cv){
  const pts=new Map(); let drag=null, pinch=null;
  cv.addEventListener('pointerdown', e=>{ try{ cv.setPointerCapture(e.pointerId); }catch(err){} pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pts.size===1) drag={x:e.clientX, y:e.clientY, yaw:CAM3.yaw, pitch:CAM3.pitch, moved:false};
    if(pts.size===2){ const [a,b]=[...pts.values()]; pinch={d:Math.hypot(a.x-b.x,a.y-b.y), z:CAM3.zoom}; drag=null; } });
  cv.addEventListener('pointermove', e=>{ if(!pts.has(e.pointerId)) return; pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pinch && pts.size===2){ const [a,b]=[...pts.values()]; CAM3.zoom=Math.max(.6,Math.min(2.4, pinch.z*Math.hypot(a.x-b.x,a.y-b.y)/pinch.d)); return; }
    if(!drag) return; const dx=e.clientX-drag.x, dy=e.clientY-drag.y;
    if(Math.abs(dx)+Math.abs(dy)>8) drag.moved=true;
    if(drag.moved){ CAM3.yaw=Math.max(-170,Math.min(170, drag.yaw-dx*.3)); CAM3.pitch=Math.max(15,Math.min(88, drag.pitch+dy*.25)); } });
  const up=e=>{ if(!pts.has(e.pointerId)) return; pts.delete(e.pointerId);
    if(drag && !drag.moved && pts.size===0) pick3D(e);
    if(pts.size<2) pinch=null; if(pts.size===0){ drag=null; store('ajedrez_cam3', CAM3); } };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', e=>{ pts.delete(e.pointerId); drag=null; pinch=null; });
  cv.addEventListener('wheel', e=>{ e.preventDefault(); CAM3.zoom=Math.max(.6,Math.min(2.4, CAM3.zoom*(e.deltaY<0?1.08:.93))); }, {passive:false});
}
function pick3D(e){
  const r=$('#c3d').getBoundingClientRect();
  R3.ray.setFromCamera(new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1), R3.cam);
  // primero las fichas (se tocan más fácil que la casilla), después el tablero
  const objs=[]; for(const k in R3.pcs) R3.pcs[k].traverse(o=>{ if(o.isMesh) objs.push(o); });
  const hp=R3.ray.intersectObjects(objs)[0];
  if(hp){ let o=hp.object; while(o.parent && o.userData.sq==null) o=o.parent; if(o.userData.sq!=null) return squareTap(o.userData.sq); }
  const h=R3.ray.intersectObject(R3.plane)[0]; if(!h || !h.uv) return;
  const f=Math.floor(h.uv.x*8), rr=Math.floor(h.uv.y*8); if(f<0||f>7||rr<0||rr>7) return;
  squareTap(rr*8+f);
}
function cam3(k, d){
  if(k==='reset'){ CAM3.yaw=0; CAM3.pitch=48; CAM3.zoom=1; }
  else if(k==='zoom') CAM3.zoom=Math.max(.6,Math.min(2.4, CAM3.zoom*(d>0?1.15:.87)));
  else if(k==='top'){ CAM3.yaw=0; CAM3.pitch=88; }
  store('ajedrez_cam3', CAM3);
}
function applyView(){
  if(VIEW.mode==='3d' && !init3D()) VIEW.mode='2d';
  $('#board2d').style.display = VIEW.mode==='2d' ? '' : 'none';
  $('#c3d').style.display = VIEW.mode==='3d' ? 'block' : 'none';
  $('#stage').classList.toggle('v3d', VIEW.mode==='3d');
  $('#btnView').textContent = VIEW.mode==='3d' ? '🔲 2D' : '🧊 3D';
  if(VIEW.mode==='3d'){ R3.theme=null; resize3D(); } else { P2D.flipKey=''; layout2D(); }
  if(V && V.phase!=='lobby') renderGame();
}
function toggleView(){ VIEW.mode = VIEW.mode==='3d' ? '2d' : '3d'; PREF.vista=VIEW.mode; savePref(); applyView(); }
applyView();

/* ====================== APARIENCIA (tableros y colores) ====================== */
function openLook(){
  const t=PREF.tema, c=PREF.colores, probs=colorProblemas(c);
  const prev=(id)=>{ const th=id==='personal' ? Object.assign({}, TEMAS.personal, c) : TEMAS[id];
    const cells=[0,1,2,3].map(i=>{ const light=i===0||i===3, bg=th.wood?`url(${wood(light?'l':'d').url}) ${i*20}% 30% / 600%`:(light?th.claro:th.oscuro);
      return `<i style="background:${bg}">${i===0?pieceSVG('wN',th):i===3?pieceSVG('bQ',th):''}</i>`; }).join('');
    return `<div class="tprev ${th.neon?'neon':''}">${cells}</div>`; };
  modal(`<h2>🎨 Tableros y colores</h2>
    <p class="muted" style="margin-top:0">Cada uno elige cómo ve su tablero: no cambia nada para los demás.</p>
    <div class="temas">${Object.keys(TEMAS).map(id=>`<button class="tema ${t===id?'on':''}" onclick="setTema('${id}')">${prev(id)}<b>${TEMAS[id].e} ${TEMAS[id].n}</b></button>`).join('')}</div>
    ${t==='personal'?`<div class="pick">
      <label><input type="color" value="${c.claro}" oninput="setCol('claro',this.value)"> Casillas claras</label>
      <label><input type="color" value="${c.oscuro}" oninput="setCol('oscuro',this.value)"> Casillas oscuras</label>
      <label><input type="color" value="${c.pb}" oninput="setCol('pb',this.value)"> Fichas del jugador 1 (blancas)</label>
      <label><input type="color" value="${c.pn}" oninput="setCol('pn',this.value)"> Fichas del jugador 2 (negras)</label></div>
      <div id="colWarn">${colWarnHTML(probs)}</div>`:''}
    <label class="opt"><input type="checkbox" ${PREF.coords?'checked':''} onchange="PREF.coords=this.checked;savePref();lookChanged()"><span><b>Mostrar letras y números</b><small>Las coordenadas (a-h, 1-8) en el borde del tablero.</small></span></label>
    <label class="opt"><input type="checkbox" ${PREF.girar?'checked':''} onchange="PREF.girar=this.checked;savePref();lookChanged()"><span><b>Girar el tablero en cada turno</b><small>Solo en “dos en este aparato”: el que mueve siempre ve sus fichas abajo.</small></span></label>
    <label class="opt"><input type="checkbox" ${PREF.sonidoReloj?'checked':''} onchange="PREF.sonidoReloj=this.checked;savePref()"><span><b>Tic-tac en los últimos 10 segundos</b><small>Avisa cuando se te acaba el tiempo.</small></span></label>
    <div class="row"><button class="btn ${VIEW.mode==='2d'?'':'gray'}" onclick="if(VIEW.mode!=='2d')toggleView();openLook()">🔲 Ver en 2D</button><button class="btn ${VIEW.mode==='3d'?'':'gray'}" onclick="if(VIEW.mode!=='3d')toggleView();openLook()">🧊 Ver en 3D</button></div>
    <button class="btn green wide" style="margin-top:8px" onclick="closeLook()">Listo</button>`);
}
function colWarnHTML(probs){ return probs.length ? `<div class="warn">⚠️ ${probs.map(esc).join('<br>⚠️ ')}<br><button class="btn sm gold" style="margin-top:6px" onclick="fixColors()">🪄 Arreglar los colores solo</button></div>` : `<div class="okc">✅ Los colores se distinguen bien.</div>`; }
function setTema(id){
  if(PREF.tema==='personal' && id!=='personal' && colorProblemas(PREF.colores).length) fixColors(true);
  PREF.tema=id; savePref(); lookChanged(); openLook();
}
function setCol(k, v){
  PREF.colores[k]=v;
  const probs=colorProblemas(PREF.colores), w=$('#colWarn'); if(w) w.innerHTML=colWarnHTML(probs);
  if(!probs.length){ savePref(); lookChanged(); }
}
// busca un color que se distinga de las casillas, acercándolo al blanco o al negro
function fixColors(quiet){
  const c=PREF.colores;
  if(dE(c.claro,c.oscuro)<14) c.oscuro=mix(c.claro,'#000000',.5);
  ['pb','pn'].forEach(k=>{
    if(dE(c[k],c.claro)>=28 && dE(c[k],c.oscuro)>=28) return;
    const towards = k==='pb' ? ['#ffffff','#000000'] : ['#000000','#ffffff'];
    let best=null;
    for(const t of towards){ for(let a=.1;a<=1.001;a+=.1){ const x=mix(c[k],t,a); if(dE(x,c.claro)>=28 && dE(x,c.oscuro)>=28){ best=x; break; } } if(best) break; }
    if(!best) for(const t of ['#e63946','#1d70d6','#f2c14e','#2a9d3f','#ffffff','#000000']) if(dE(t,c.claro)>=28 && dE(t,c.oscuro)>=28){ best=t; break; }
    c[k]=best||c[k];
  });
  if(dE(c.pb,c.pn)<35) for(const t of ['#000000','#ffffff','#e63946','#1d70d6','#f2c14e']) if(dE(t,c.claro)>=28 && dE(t,c.oscuro)>=28 && dE(t,c.pb)>=35){ c.pn=t; break; }
  savePref(); lookChanged(); if(!quiet) openLook();
}
function closeLook(){
  if(PREF.tema==='personal' && colorProblemas(PREF.colores).length){ toast('⚠️ Hay colores que se confunden: arreglalos o tocá “Arreglar los colores solo”.'); return; }
  closeModal();
}
function lookChanged(){ P2D.flipKey=''; P2D.theme=null; R3.theme=null; if(V && V.phase!=='lobby') renderGame(); renderMenuLook(); }
function renderMenuLook(){ const el=$('#lookName'); if(el){ const th=tema(); el.textContent=`${TEMAS[PREF.tema].e} ${TEMAS[PREF.tema].n} · ${VIEW.mode.toUpperCase()}`; } }
renderMenuLook();

/* ====================== PANEL LATERAL ====================== */
function renderSidePanels(){ if($('#tab-hist').classList.contains('on')) renderHist(); renderMesaTab(); renderReglasTab(); }
function renderHist(){
  if(!V) return;
  const el=$('#histList');
  if(!V.hist || !V.hist.length){ el.innerHTML = '<p class="muted">Todavía no se movió nada.</p>' + logHTML(); return; }
  const cur=curPly(); let h='<div class="moves">';
  for(let i=0;i<V.hist.length;i+=2){
    const a=V.hist[i], b=V.hist[i+1];
    h+=`<div class="mrow"><span class="mn">${i/2+1}.</span><button class="mv ${cur===i+1?'on':''}" onclick="review(${i+1})">${esc(a.san)}</button>${b?`<button class="mv ${cur===i+2?'on':''}" onclick="review(${i+2})">${esc(b.san)}</button>`:''}</div>`;
  }
  h+='</div><div class="btns" style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0">'
    + `<button class="btn sm dark" onclick="review(0)">⏮</button><button class="btn sm dark" onclick="review(curPly()-1)">◀</button><button class="btn sm dark" onclick="review(curPly()+1)">▶</button><button class="btn sm dark" onclick="review(null)">⏭</button>`
    + (V.juego==='ajedrez'?`<button class="btn sm" onclick="copyPGN()">📋 PGN</button>`:`<button class="btn sm" onclick="copyMoves()">📋 Copiar</button>`)+'</div>';
  el.innerHTML=h+logHTML();
  const on=el.querySelector('.mv.on'); if(on) on.scrollIntoView({block:'nearest'});
}
const logHTML = () => `<div class="muted" style="font-weight:800;margin:12px 0 6px">Lo que pasó</div>` + (V.log||[]).slice().reverse().slice(0,40).map(l=>`<div class="hline">${esc(l.x)}</div>`).join('');
function pgnText(){
  const w=VP2(V.col.w)||{}, b=VP2(V.col.b)||{}, r=V.result;
  const res = !r ? '*' : r.w==='w' ? '1-0' : r.w==='b' ? '0-1' : '1/2-1/2';
  const d=new Date(V.startedAt||Date.now()), date=`${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
  let mv=''; V.hist.forEach((h,i)=>{ if(i%2===0) mv+=(i/2+1)+'. '; mv+=h.en+' '; });
  return `[Event "Ajedrez PY"]\n[Site "juegospy.com"]\n[Date "${date}"]\n[White "${w.name||'?'}"]\n[Black "${b.name||'?'}"]\n[Result "${res}"]\n\n${mv}${res}\n`;
}
function copyPGN(){ const t=pgnText(); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(()=>toast('📋 Partida copiada (PGN). Se puede pegar en Lichess o Chess.com para analizarla.')).catch(()=>modal(`<h2>PGN</h2><textarea style="height:200px">${esc(t)}</textarea><button class="btn wide" onclick="closeModal()">Cerrar</button>`)); }
function copyMoves(){ let t=''; V.hist.forEach((h,i)=>{ if(i%2===0) t+=(i/2+1)+'. '; t+=h.san+' '; }); navigator.clipboard && navigator.clipboard.writeText(t.trim()).then(()=>toast('📋 Jugadas copiadas.')); }
function renderMesaTab(){
  const host=amHost(), inPlay=V.phase!=='lobby';
  const ps=V.players.map(p=>{
    const offline=!p.bot&&!p.conn&&!p.local, c=vColorOf(p.id);
    return `<div class="prow" style="border-left:5px solid ${p.color}"><span style="font-size:22px">${esc(p.emoji)}</span><span class="nm"><b>${esc(p.name)}${p.id===me()&&!hotseat()?' (vos)':''}${p.id===V.hostPid&&NET.mode!=='local'?' 👑':''}</b>
      <small>${inPlay&&c?(c==='w'?'⚪ blancas':'⚫ negras'):''}${p.mic?' · 🎙️':''}${offline?' · ⚠️ sin conexión':''}</small>${eloSelect(p, host)}</span>
      ${host&&p.id!==V.hostPid&&NET.mode!=='local'?`${offline&&inPlay?`<button class="btn sm gray" onclick="doAct({type:'botify',pid:'${p.id}'})" title="Que juegue un bot">🤖</button>`:''}<button class="btn sm gray" onclick="if(confirm('¿Sacar a ${esc(p.name)} de la mesa?'))doAct({type:'kick',pid:'${p.id}'})" title="Sacar">✕</button>`:''}</div>`;
  }).join('');
  const obs=(V.observers||[]).map(o=>`<div class="prow"><span style="font-size:20px">${o.owner?'👑':'👀'}</span><span class="nm"><b>${esc(o.name)}${o.id===me()?' (vos)':''}</b><small>mirando${o.mic?' · 🎙️':''}</small></span></div>`).join('');
  const sit = NET.obs && (V.phase==='lobby'||V.phase==='over') && V.players.length<MAXP ? `<button class="btn gold wide" onclick="doAct({type:'joinNext'})">🪑 Sentarme a jugar</button>` : NET.obs ? `<p class="muted">Juegan 2. Si se libera un lugar te podés sentar cuando termine la partida.</p>` : '';
  const info = inPlay ? `<p class="muted">${V.juego==='damas'?'⚪ Damas':'♟️ Ajedrez'} · partida ${V.game}${V.opts.race>1?` · gana el primero a ${V.opts.race} puntos`:''}</p>` : '';
  $('#mesaList').innerHTML = info + `<b>Jugadores (${V.players.length}/${MAXP})</b>` + ps + (obs?`<b>Mirando</b>${obs}`:'') + sit
    + (host && inPlay ? `<button class="btn dark wide" style="margin-top:8px" onclick="if(confirm('¿Terminar la partida y volver a la sala?'))doAct({type:'newGame'})">⚙️ Terminar y volver a la sala</button>` : '')
    + (NET.mode!=='local'&&NET.code?`<p class="muted" style="margin-top:12px">Invitá con el código <b>${NET.code}</b> <button class="btn sm" onclick="shareRoom()">📤 Compartir</button></p>`:'');
}
function renderReglasTab(){
  const o=V.opts, host=amHost();
  const juego = o.juego==='damas' ? `⚪ Damas · ${esc(Motor.damas.VAR[o.var].n)}${o.forz?' · comer es obligatorio':''}` : '♟️ Ajedrez (reglas oficiales)';
  $('#reglasList').innerHTML = `<p style="margin-top:0"><b>${juego}</b></p>
    <p class="muted">⏱️ ${esc(clockText(o))}<br>${esc(COLORES[o.colores])}${o.alterna?' · se cambia de color en cada partida':''}<br>${o.ayuda?'👆 Se marcan las jugadas posibles':''}${o.deshacer?' · ↩️ se puede deshacer':''}${o.tablas?' · 🤝 se ofrecen tablas':''}${o.pistas?' · 💡 con pistas':''}</p>`
    + `<b>📝 Reglas propias del grupo</b>` + (V.grules?`<div class="grules" style="margin:6px 0 10px">${esc(V.grules)}</div>`:`<p class="muted">${host?'Las podés escribir en la sala de espera.':'No hay.'}</p>`)
    + `<b>💡 Sugerencias</b><div style="margin-top:6px">${sugsHTML(host)}</div>
       <div class="row"><input type="text" id="sugIn2" maxlength="240" placeholder="Proponé una regla…" onkeydown="if(event.key==='Enter')sendSug('sugIn2')"><button class="btn sm" style="flex:0 0 auto" onclick="sendSug('sugIn2')">Sugerir</button></div>
       <button class="btn dark wide" style="margin-top:12px" onclick="showRules()">📜 Cómo se juega</button>`;
}

/* ====================== VARIOS ====================== */
function modal(h){ $('#mbox').innerHTML=h; $('#modal').classList.add('on'); }
function closeModal(){ $('#modal').classList.remove('on'); }
function roomLink(){ return location.origin+location.pathname+'#'+NET.code; }
function copyCode(){ navigator.clipboard && navigator.clipboard.writeText(NET.code).then(()=>toast('Código copiado: '+NET.code)); }
function shareRoom(){
  const url=roomLink(), text=`¡Vení a jugar ${V && V.opts.juego==='damas'?'a las damas':'al ajedrez'} conmigo! ♟️🇵🇾 Sala ${NET.code}`;
  if(navigator.share) return navigator.share({title:'Ajedrez y Damas PY', text, url}).catch(()=>{});
  modal(`<h2>📤 Invitar a la sala ${NET.code}</h2><p style="word-break:break-all;user-select:all;background:#fff;padding:8px;border-radius:8px">${esc(url)}</p>
    <a class="btn green wide" style="display:block;text-align:center;text-decoration:none" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text+' '+url)}">💬 Mandar por WhatsApp</a>
    <button class="btn wide" style="margin-top:6px" onclick="navigator.clipboard.writeText('${url}').then(()=>toast('Enlace copiado'))">📋 Copiar enlace</button>
    <button class="btn gray wide" style="margin-top:6px" onclick="closeModal()">Cerrar</button>`);
}
function showRules(){
  modal(`<div class="rules"><h2>📜 Cómo se juega</h2>
  <h3>♟️ Ajedrez</h3><p>Reglas oficiales: enroque, captura al paso, coronación (elegís la pieza), jaque mate, rey ahogado, tablas por las 50 jugadas, triple repetición o falta de material. Tocá una pieza y después la casilla, o arrastrala.</p>
  <h3>⚪ Damas</h3><ul>
  <li><b>Inglesa / americana:</b> los peones comen solo para adelante; la dama camina de a una casilla.</li>
  <li><b>Latina (española):</b> los peones comen solo para adelante; la dama es voladora; hay que comer la mayor cantidad de fichas posible.</li>
  <li><b>Brasileña:</b> los peones comen para adelante y para atrás; dama voladora; ley de la mayoría.</li></ul>
  <p>Si se puede comer varias veces seguidas, se come todo en la misma jugada (tocá la casilla final). Gana el que deja al otro sin fichas o sin jugadas.</p>
  <h3>🤖 Bots por ELO</h3><p>Desde 🐣 400 (principiante) hasta 👑 2600 (gran maestro). Los niveles bajos se equivocan seguido; los altos piensan más jugadas por adelantado. Es un ELO aproximado, para tener una idea de la fuerza.</p>
  <h3>⏱️ Reloj</h3><p>Sin reloj, con el mismo tiempo para los dos (bala, blitz, rápida, clásica o el que quieras, con segundos extra por jugada), distinto para cada jugador (para dar ventaja) o un tiempo fijo por jugada. Al que se le acaba el tiempo pierde (si el rival no tiene con qué dar mate, son tablas).</p>
  <h3>🎨 Tableros</h3><p>Clásico blanco y negro, madera, futurista o a tu gusto: elegís el color de las casillas y de las fichas, y el juego no deja que se confundan. Cada uno ve el suyo, en 2D o en 3D.</p>
  <h3>👀 Los que miran</h3><p>Ven la partida, el chat y escuchan la voz. Se pueden sentar cuando termina si hay lugar.</p>
  </div><button class="btn wide" onclick="closeModal()">Entendido</button>`);
}
document.addEventListener('keydown', e=>{
  if(e.key==='Escape') closeModal();
  if(!V || V.phase==='lobby' || document.activeElement.tagName==='INPUT' || $('#modal').classList.contains('on')) return;
  if(e.key==='ArrowLeft') review(curPly()-1); else if(e.key==='ArrowRight') review(curPly()+1);
});
$('#modal').addEventListener('click', e=>{ if(e.target.id==='modal') closeModal(); });
