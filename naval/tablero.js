'use strict';
/* =====================================================================
   Batalla Naval PY — sala de espera, colocación de barcos, los mares
   en 2D (casillas) y en 3D (three.js), tiros y su animación, paneles.
   ===================================================================== */

/* ====================== QUIÉN MIRA (en un aparato: el que tiene el turno) ====================== */
let VIEWER=null, CURTAIN=null;
const localHumans = () => S ? S.players.filter(p=>!p.bot) : [];
function viewerPid(){
  if(NET.mode!=='local' || !S) return me();
  const hs=localHumans(); if(hs.length<=1) return me();
  if(S.phase==='place'){ const s=S.sides.find(sd=>!sd.ready && sd.pids.some(pid=>hs.some(h=>h.id===pid))); if(s) return s.pids.find(pid=>hs.some(h=>h.id===pid)); }
  if(S.phase==='play'){ const sh=shooterOf(S); if(hs.some(h=>h.id===sh)) return sh; }
  return VIEWER || me();
}
const viewer = () => VIEWER || me();
const mySide = () => V ? V.sides.findIndex(s=>s.pids.includes(viewer())) : -1;

/* ====================== RENDER GENERAL ====================== */
function render(){
  if(!S) return;
  if(NET.mode==='local'){
    const v=viewerPid();
    // dos o más en el mismo aparato: antes de mostrar la flota de otro, se tapa la pantalla
    if(v!==VIEWER){ if(VIEWER && localHumans().length>1 && S.phase!=='lobby') CURTAIN=v; VIEWER=v; PL.key=null; }
  } else VIEWER=null;
  V = NET.mode==='client' ? S : publicState(viewer());
  if(V.phase==='lobby'){ show('lobby'); renderLobby(); }
  else { show('game'); renderGame(); }
  renderSidePanels(); renderChatTo(); renderVoice(); voiceSync(); musicSync();
}
function playerTag(p){
  const host=p.id===V.hostPid;
  return `<span class="dot" style="background:${p.color}"></span><span style="font-size:20px">${esc(p.emoji)}</span><span class="nm">${esc(p.name)}${p.id===me()?' <span class="muted">(vos)</span>':''}</span>`
    + `${host&&NET.mode!=='local'?'👑':''}${p.bot?'🤖':''}${p.local&&!p.bot?'📱':''}${p.mic?'🎙️':''}${!p.bot&&!p.conn?'⚠️':''}`;
}

// ---------- sala de espera ----------
function renderLobby(){
  const host=amHost(), myObs=!!NET.obs, o=V.opts, eq=o.fmt==='eq';
  $('#lobbyCode').textContent=NET.code||'—';
  $('#lobbyCodeBox').style.display = NET.mode==='local' ? 'none' : '';
  $('#lobbyTitle').textContent = NET.mode==='local' ? '⚓ Batalla en este aparato' : '⚓ Sala de espera';
  $('#pcount').textContent=`(${V.players.length}/${MAXP})`;
  const teamBtn = p => eq ? `<button class="tbtn" style="background:${TEAMS[p.team].c}" ${host||p.id===me()?`onclick="doAct({type:'team',pid:'${p.id}'})"`:'disabled'} title="Cambiar de equipo">${TEAMS[p.team].e}</button>` : '';
  $('#plist').innerHTML=V.players.map(p=>`<li>${teamBtn(p)}${playerTag(p)}${host && p.id!==V.hostPid?`<button class="btn sm gray" onclick="doAct({type:'kick',pid:'${p.id}'})" title="Sacar">✕</button>`:''}</li>`).join('')
    + (V.observers||[]).map(x=>`<li style="opacity:.75"><span style="font-size:20px">👀</span><span class="nm">${esc(x.name)} <span class="muted">mirando</span></span>${x.mic?'🎙️':''}</li>`).join('');
  const err=canStartV();
  $('#lobbyHostBtns').innerHTML = host
    ? `<div class="row"><button class="btn gray" onclick="doAct({type:'addBot'})" ${V.players.length>=MAXP?'disabled':''}>🤖 Sumar bot</button>
       ${NET.mode==='local'?`<button class="btn gray" onclick="addLocalClick()" ${V.players.length>=MAXP?'disabled':''}>🙋 Amigo en este aparato</button>`:''}
       <button class="btn green" onclick="doAct({type:'start'})">▶️ Empezar</button></div>
       <p class="muted">${err?'⚠️ '+esc(err):'¡Listo para empezar!'}${eq?' · Tocá 🔴/🔵 para cambiar a alguien de equipo.':''}</p>`
    : `<p class="muted" style="text-align:center">⏳ Esperando que el anfitrión 👑 empiece la batalla…${eq?'<br>Podés tocar tu 🔴/🔵 para cambiarte de equipo.':''}</p>`;
  $('#lobbyObs').innerHTML = myObs ? `<div class="obsbar" style="border-radius:10px;margin-top:8px">👀 Estás mirando. ${V.players.length<MAXP?`<button class="btn sm gold" onclick="doAct({type:'joinNext'})">⚓ Sumarme a jugar</button>`:'No hay más lugar.'}</div>` : '';
  $('#optsBox').innerHTML = optsHTML(host);
  const g=$('#grulesBox');
  if(host){
    if(!g.querySelector('textarea')) g.innerHTML=`<textarea id="grulesIn" maxlength="1200" placeholder="Ej.: el que pierde invita la chipa 🥯&#10;Prohibido poner todos los barcos en el borde…"></textarea><p class="muted" style="margin:4px 0 0">Se guarda solo y lo ven todos.</p>`;
    const ta=$('#grulesIn'); if(document.activeElement!==ta) ta.value=V.grules||'';
    ta.oninput=()=>{ clearTimeout(ta.t); ta.t=setTimeout(()=>doAct({type:'grules', text:ta.value}), 600); };
  } else g.innerHTML = V.grules ? `<div class="grules">${esc(V.grules)}</div>` : `<p class="muted">El anfitrión todavía no escribió reglas propias.</p>`;
  $('#sugBox').innerHTML = sugsHTML(host);
}
function canStartV(){ const keep=S; S=V; try{ return canStart(); } finally{ S=keep; } }
function addLocalClick(){ const n=prompt('Nombre del amigo que juega en este aparato:'); if(n && n.trim()) doAct({type:'addLocal', name:n.trim()}); }
function fleetPreview(o){
  const F=fleetDef(o);
  return `<div class="fprev">${F.ships.map(([k,n,l])=>`<span title="${esc(n)}"><b>${esc(n)}</b> ${'■'.repeat(l)}</span>`).join('')}</div>`;
}
function optsHTML(host){
  const o=V.opts, dis = host && V.phase==='lobby' ? '' : 'disabled';
  const sel=(k, list)=>`<select ${dis} onchange="doAct({type:'opt',k:'${k}',v:this.value})">${list.map(x=>`<option value="${x.v}" ${o[k]==x.v?'selected':''}>${x.t}</option>`).join('')}</select>`;
  const chk=(k, t, d)=>`<label class="opt" style="margin:0 0 6px;font-weight:400"><input type="checkbox" ${o[k]?'checked':''} ${dis} onchange="doAct({type:'opt',k:'${k}',v:this.checked})"><span><b>${t}</b><small>${d}</small></span></label>`;
  return `<label style="margin-top:0">🚢 Flota ${host?'':'<span class="muted">(la elige el anfitrión)</span>'}</label>${sel('flota', Object.keys(FLOTAS).map(k=>({v:k, t:FLOTAS[k].t})))}
    ${fleetPreview(o)}
    <label>💣 Tiros por turno</label>${sel('tiros', Object.keys(TIROS).map(k=>({v:k, t:TIROS[k].t})))}<p class="muted" style="margin:4px 0 0">${esc(TIROS[o.tiros].d)}</p>
    <label>Cómo se juega</label>${sel('fmt', Object.keys(FORMATS).map(k=>({v:k, t:FORMATS[k]})))}
    <label>Duración</label>${sel('race', RACES)}
    <label>⏰ Tiempo para tirar</label>${sel('timer', TIMERS)}
    <label>⏳ Tiempo para poner los barcos</label>${sel('ptimer', PTIMERS)}
    <label>Nivel de los bots</label>${sel('bot', BOTLV)}
    <label>Reglas de la casa</label>` + HOUSE.map(h=>chk(h.k, h.t, h.d)).join('');
}
function sugsHTML(host){
  const list=(V.sugs||[]).slice().sort((a,b)=>b.votes.length-a.votes.length);
  if(!list.length) return '<p class="muted">Todavía no hay sugerencias. ¡Proponé la primera!</p>';
  return list.map(s=>`<div class="sug"><span class="t">${esc(s.text)}<small>${esc(s.e)} ${esc(s.by)}</small></span>
    <button class="vote ${s.votes.includes(me())?'on':''}" onclick="doAct({type:'vote',id:'${s.id}'})">👍 ${s.votes.length}</button>
    ${host?`<button class="vote" onclick="doAct({type:'sugDel',id:'${s.id}'})" title="Borrar">🗑️</button>`:''}</div>`).join('');
}
function sendSug(id){ const i=$('#'+id); const t=i.value.trim(); if(!t) return toast('Escribí la regla que querés sugerir.'); doAct({type:'suggest', text:t}); i.value=''; toast('💡 ¡Sugerencia enviada! Los demás la pueden votar.'); }

/* ====================== ANIMACIÓN DE LOS TIROS ======================
   Los tiros llegan del anfitrión al toque, pero el resultado de cada uno se muestra
   recién cuando cae la bomba: hasta ahí la casilla se ve como estaba. */
const ANIM={lastN:null, q:[], cur:null, t0:0, landed:false, disp:{}, round:null};
const N = () => fleetDef(V.opts).n;
const animBusy = () => !!ANIM.cur || ANIM.q.length>0;
function syncDisp(){ ANIM.disp={}; V.sides.forEach((s,i)=>{ if(s.grid) ANIM.disp[i]=s.grid.slice(); }); }
function feedShots(){
  const key=V.round+'|'+V.sides.length;
  const top=(V.shots||[]).reduce((m,s)=>Math.max(m,s.n), 0);
  if(ANIM.lastN==null || ANIM.round!==key){ ANIM.round=key; ANIM.lastN=top; ANIM.q=[]; ANIM.cur=null; syncDisp(); return; }
  (V.shots||[]).filter(s=>s.n>ANIM.lastN).sort((a,b)=>a.n-b.n).forEach(s=>ANIM.q.push(s));
  ANIM.lastN=Math.max(ANIM.lastN, top);
  if(!animBusy()) syncDisp();
}
function landShot(s){
  const d=ANIM.disp[s.to], n=N(); if(!d) return;
  d[s.r*n+s.c] = s.res==='agua' ? 1 : s.res==='tocado' ? 2 : 3;
  (s.cells||[]).forEach(([r,c])=>d[r*n+c]=3);
  (s.auto||[]).forEach(([r,c])=>{ if(!d[r*n+c]) d[r*n+c]=4; });
}
function animTick(){
  if(!V || V.phase==='lobby') return;
  const now=performance.now();
  if(!ANIM.cur && ANIM.q.length){
    ANIM.cur=ANIM.q.shift(); ANIM.t0=now; ANIM.landed=false;
    sfx.launch(1.1);   // sale el misil; el impacto suena cuando cae (a los 1,1 s)
    if(VIEW.mode!=='3d' || !R3.ok){ const s=ANIM.cur; if(ANIM.cur.to!==bigSide() && ANIM.cur.to!==smallSide()) WATCH=s.to; }
    renderBoards(); renderStatus();
  }
  const s=ANIM.cur; if(!s) return;
  if(!ANIM.landed && now-ANIM.t0>1100){
    ANIM.landed=true; landShot(s);
    if(s.res==='agua') sfx.splash(); else { sfx.boom(); if(s.res==='hundido') setTimeout(()=>sfx.sink(), 650); }
    const L=coordTxt(s.r,s.c), voz=`${LETRA_VOZ[L[0]]||L[0]} ${L.slice(1)}… ` + (s.res==='agua' ? 'agua' : s.res==='tocado' ? `¡tocado${s.ship?' el '+s.ship:''}!` : `¡hundido el ${s.ship}!`);
    setTimeout(()=>cantar(voz), 900);   // primero se escucha el impacto
    const mineHit = V.sides[s.to] && V.sides[s.to].pids.includes(viewer());
    if(s.res!=='agua') banner(`${L}: ${s.res==='tocado'?'🔥 ¡Tocado'+(s.ship?' el '+s.ship:'')+'!':'💥 ¡Hundido el '+s.ship+'!'}${s.out?` · ${sideName(V,s.to)} se quedó sin barcos`:''}`, mineHit?'bad':'good');
    else banner(`${L}: 💧 Agua`, '');
    if(s.res==='hundido') bigText(mineHit ? '💥 ¡Te hundieron!' : '💥 ¡HUNDIDO!');
    BOOM.push({to:s.to, r:s.r, c:s.c, res:s.res, t:now});
    renderBoards(); renderFleetBar(); if($('#tab-hist').classList.contains('on')) renderHist();
  }
  if(now-ANIM.t0>1550){
    ANIM.cur=null;
    if(!ANIM.q.length){ syncDisp(); renderGame(); }
  }
}
const BOOM=[];   // explosiones recientes (para el 3D)

/* ====================== PARTIDA ====================== */
const AIM={to:null, r:null, c:null, sent:false};
let WATCH=null;   // qué mar se ve grande (para los que miran o para mirar a otro)
const curShooter = () => V && V.phase==='play' ? shooterOf(V) : null;
const myTurn = () => !!V && V.phase==='play' && !animBusy() && mine(curShooter()) && !NET.obs && !CURTAIN;
const enemies = () => { const m=mySide(); return V.sides.map((s,i)=>i).filter(i=>i!==m && (V.opts.fmt!=='eq' || V.sides[i].team!==(V.sides[m]||{}).team)); };
function aliveDisp(i){ const s=V.sides[i]; return s && !s.out; }
function bigSide(){
  const m=mySide();
  if(m>=0 && V.phase==='play'){
    const en=enemies().filter(aliveDisp);
    if(AIM.to==null || !en.includes(AIM.to)) AIM.to = en.length ? en[0] : enemies()[0];
    if(WATCH!=null && WATCH!==AIM.to && V.sides[WATCH]) return WATCH;
    return AIM.to;
  }
  if(m>=0) return enemies()[0];
  // los que miran: el mar al que se está tirando
  if(WATCH!=null && V.sides[WATCH]) return WATCH;
  const last=(V.shots||[]).slice(-1)[0];
  return last ? last.to : V.sides.length>1 ? 1 : 0;
}
function smallSide(){
  const m=mySide(); if(m>=0) return m;
  const b=bigSide(); const sh=V.phase==='play' ? V.cur : 0;
  return sh!==b ? sh : (b+1)%V.sides.length;
}

function renderGame(){
  $('#roomTag').textContent = NET.mode==='local' ? (innerWidth<600 ? '📱' : '📱 En este aparato') : '🔑 '+NET.code;
  $('#obsbar').style.display = NET.obs ? 'block' : 'none';
  if(NET.obs) $('#obsbar').textContent = '👀 Estás mirando la batalla.' + (V.opts.obsVen ? ' Ves todas las flotas.' : ' Solo ves los tiros.');
  feedShots();
  const key = V.phase==='play' ? `${V.round}|${V.cur}|${V.shotN}` : null;
  if(key && key!==AIM.key){ AIM.key=key; AIM.sent=false; }
  $('#curtain').style.display = CURTAIN ? 'flex' : 'none';
  if(CURTAIN){ const p=V.players.find(x=>x.id===CURTAIN); $('#curtainName').textContent = p ? `${p.emoji} ${p.name}` : '?'; $('#curtainWhat').textContent = V.phase==='place' ? 'Te toca poner tus barcos.' : 'Te toca tirar.'; }
  $('#game').classList.toggle('placing', V.phase==='place');
  renderFleetBar(); renderStatus(); renderBoards(); renderCtrl();
  if(!animBusy()) endModal();
}
function curtainOk(){ CURTAIN=null; render(); }

// ---------- barra de flotas (arriba) ----------
function sideColor(s){ return s.team!=null ? TEAMS[s.team].c : (V.players.find(p=>p.id===s.pids[0])||{}).color||'#888'; }
function sunkDisp(i, ship){
  // un barco se ve hundido cuando ya cayó la bomba que lo hundió
  if(!ship.sunk) return false;
  const d=ANIM.disp[i], n=N(); if(!d || ship.r==null) return true;
  return shipCells(ship).every(([r,c])=>d[r*n+c]===3);
}
function renderFleetBar(){
  if(!V || V.phase==='lobby') return;
  const big=bigSide(), m=mySide(), sh=curShooter();
  $('#fleetbar').innerHTML = V.sides.map((s,i)=>{
    const names = s.pids.map(pid=>{ const p=V.players.find(x=>x.id===pid); if(!p) return ''; return `<span class="${pid===sh&&V.phase==='play'?'shoot':''}">${esc(p.emoji)} ${esc(p.name)}${p.bot?'🤖':''}${!p.bot&&!p.conn&&!p.local?'⚠️':''}${p.mic?'🎙️':''}</span>`; }).join(' ');
    const ships = (s.fleet||fleetDef(V.opts).ships.map(([k,n,l],j)=>({i:j,k,n,l}))).map(x=>`<i class="sh ${sunkDisp(i,x)?'sunk':''}" style="--l:${x.l}" title="${esc(x.n)}">${shipSVG(x.k, x.l, 'h')}</i>`).join('');
    const afloat = s.fleet ? s.fleet.filter(x=>!sunkDisp(i,x)).length : fleetDef(V.opts).ships.length;
    const ready = V.phase==='place' ? (s.ready ? '<small>✅ listo</small>' : '<small>⏳ poniendo barcos</small>') : '';
    const wins = V.opts.race>1 ? `<span class="wins">${'●'.repeat(s.wins)}${'○'.repeat(Math.max(0,V.opts.race-s.wins))}</span>` : '';
    return `<button class="fb ${i===V.cur&&V.phase==='play'?'on':''} ${afloat===0&&V.phase!=='place'?'out':''} ${i===big?'big':''} ${i===m?'me':''}" style="--pc:${sideColor(s)}" onclick="watchSide(${i})">
      <div class="nms">${s.team!=null?`<b>${TEAMS[s.team].e}</b> `:''}${names}${i===m?' <small>(vos)</small>':''}</div>
      <div class="ex">${ready||`<span class="ships">${ships}</span><small>${afloat} a flote</small>`}${wins}</div></button>`;
  }).join('');
}
function watchSide(i){
  const m=mySide();
  if(i===m){ WATCH=null; render(); return; }
  if(m>=0 && enemies().includes(i) && aliveDisp(i)){ AIM.to=i; WATCH=null; AIM.r=AIM.c=null; sendAim(); }
  else WATCH=i;
  renderGame();
}

// ---------- estado y controles ----------
function renderStatus(){
  let st='';
  const sh=curShooter(), p=V.players.find(x=>x.id===sh), o=V.opts;
  if(V.phase==='place'){
    const m=mySide(), s=V.sides[m];
    st = m<0 ? '⏳ Los jugadores están poniendo sus barcos…' : s.ready ? '✅ Tu flota está lista. Esperando a los demás…' : '🚢 Poné tus barcos: elegí uno, tocá el mar para ubicarlo y 🔄 para girarlo.';
    if(o.ptimer){ const left=Math.max(0, Math.ceil((V.placeAt+o.ptimer*1000-Date.now())/1000)); st+=` · ⏳ ${left}s`; }
  } else if(V.phase==='play'){
    if(ANIM.cur){ const s=ANIM.cur, w=V.players.find(x=>x.id===s.pid); st=`💣 ${esc(w?w.name:'?')} tira a <b>${coordTxt(s.r,s.c)}</b> de ${esc(sideName(V,s.to))}…`; }
    else if(animBusy()) st='💣 …';
    else if(mine(sh) && !NET.obs){
      const who = NET.mode==='local' && localHumans().length>1 ? `<b>${esc(p.name)}</b>, ` : '';
      const many = o.tiros==='salva'||o.tiros==='tres' ? ` · te ${V.left===1?'queda <b>1</b> tiro':`quedan <b>${V.left}</b> tiros`}` : o.tiros==='sigue' ? ' · si acertás, seguís' : '';
      st = `${who}🎯 ¡Te toca! Elegí dónde tirar${enemies().filter(aliveDisp).length>1?' (y a quién)':''}${many}`;
    } else st = `Tira <b>${esc(p?p.name:'?')}</b>${p&&p.bot?' 🤖':''}${o.tiros==='salva'||o.tiros==='tres'?` · ${V.left} tiro${V.left===1?'':'s'}`:''}`;
    if(o.timer && !animBusy() && p && !p.bot){ const left=Math.max(0, Math.ceil((Math.max(V.turnAt, V.busyUntil)+o.timer*1000-Date.now())/1000)); st+=` · ⏰ ${left}s`; }
  } else st='🏆 Terminó la batalla';
  $('#status').innerHTML=st;
}
setInterval(()=>{ if(V && $('#game').classList.contains('on') && ((V.phase==='play' && V.opts.timer) || (V.phase==='place' && V.opts.ptimer))) renderStatus(); }, 1000);
function renderCtrl(){
  const my=myTurn();
  $('#ctrl').style.display = V.phase==='play' ? '' : 'none';
  $('#ctrl').classList.toggle('dis', !my);
  const c=$('#coordIn'); if(document.activeElement!==c) c.value = AIM.r!=null ? coordTxt(AIM.r, AIM.c) : '';
  $('#btnFire').disabled = !my || AIM.r==null;
  const en=enemies().filter(aliveDisp);
  $('#tgtSel').style.display = my && en.length>1 ? '' : 'none';
  if(en.length>1) $('#tgtSel').innerHTML = en.map(i=>`<option value="${i}" ${i===AIM.to?'selected':''}>🎯 ${esc(sideName(V,i))}</option>`).join('');
}
function tgtChanged(){ AIM.to=+$('#tgtSel').value; AIM.r=AIM.c=null; WATCH=null; sendAim(); renderGame(); }
function coordTyped(fire){
  const v=$('#coordIn').value, p=parseCoord(v, N());
  if(!p){ if(fire) toast(`Escribí una casilla como B7 (letras A a ${LETRAS[N()-1]} y números 1 a ${N()}).`); return; }
  aimAt(p.r, p.c, fire);
}
function aimAt(r, c, fire){
  if(!myTurn()) return;
  const to=bigSide(); if(!enemies().includes(to) || !aliveDisp(to)) return toast('Ese mar no es de un enemigo.');
  AIM.to=to;
  const d=ANIM.disp[to]; if(d && d[r*N()+c]){ sfx.bad(); return toast(`Ya se tiró en ${coordTxt(r,c)}.`); }
  const same = AIM.r===r && AIM.c===c;
  AIM.r=r; AIM.c=c; sendAim(); renderBoards(); renderCtrl();
  if(fire || same) fireNow();
}
function fireNow(){
  if(!myTurn() || AIM.sent || AIM.r==null) return;
  AIM.sent=true;
  doAct({type:'fire', to:AIM.to, r:AIM.r, c:AIM.c});
  AIM.r=AIM.c=null; $('#coordIn').value='';
}
document.addEventListener('keydown', e=>{
  if(!V || V.phase!=='play' || !$('#game').classList.contains('on') || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || !myTurn()) return;
  const n=N(), mv={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]}[e.key];
  if(mv){ e.preventDefault(); AIM.r=Math.max(0,Math.min(n-1,(AIM.r==null?Math.floor(n/2):AIM.r)+mv[0])); AIM.c=Math.max(0,Math.min(n-1,(AIM.c==null?Math.floor(n/2):AIM.c)+mv[1])); sendAim(); renderBoards(); renderCtrl(); }
  if((e.key==='Enter'||e.key===' ') && AIM.r!=null){ e.preventDefault(); aimAt(AIM.r, AIM.c, true); }
});
function banner(t, cls){ const b=$('#banner'); b.className='banner '+(cls||''); b.textContent=t; b.style.display='block'; clearTimeout(banner.t); banner.t=setTimeout(()=>b.style.display='none', 2600); }
function bigText(t){ const d=document.createElement('div'); d.className='bigtext'; d.textContent=t; $('#stage').appendChild(d); setTimeout(()=>d.remove(), 2200); }
let TURNSEEN=null;
setInterval(()=>{   // aviso de "te toca" cuando terminó la animación
  if(!V || V.phase!=='play' || !myTurn()) { if(V && V.phase==='play' && !mine(curShooter())) TURNSEEN=null; return; }
  const k=V.round+'|'+V.cur+'|'+(V.sides[V.cur]||{}).k;
  if(TURNSEEN!==k){ TURNSEEN=k; WATCH=null; renderGame(); sfx.turn(); const d=document.createElement('div'); d.className='yourturn'; d.textContent='🎯 ¡Te toca tirar!'; document.body.appendChild(d); setTimeout(()=>d.remove(),1700); }
}, 300);

/* ====================== MARES 2D ====================== */
// dibuja un mar: casillas con agua, tiros y (si se ven) los barcos
function seaHTML(i, kind){
  const s=V.sides[i], n=N(), d=ANIM.disp[i]||s.grid||[];
  const shipAt={};
  const ships = kind==='place' ? PL.ships() : (s.fleet||[]).filter(x=>x.r!=null && (!x.hidden));
  ships.forEach(x=>{ if(kind!=='place' && x.sunk && !sunkDisp(i,x) && !s.pids.includes(viewer()) && !(V.opts.obsVen && NET.obs)) return;
    shipCells(x).forEach(([r,c],j)=>shipAt[r*n+c]={x, j, sunk:sunkDisp(i,x)}); });
  const cur=ANIM.cur && ANIM.cur.to===i && !ANIM.landed ? ANIM.cur : null;
  const aiming = kind==='target' && myTurn() && AIM.to===i ? AIM : (REMOTE_AIM && REMOTE_AIM.to===i && V.phase==='play' && !mine(curShooter()) ? REMOTE_AIM : null);
  const ghost = kind==='place' ? PL.ghostCells() : null;
  // cada casilla va en su lugar fijo de la grilla, así los barcos dibujados se pueden poner encima
  const at=(r,c)=>`grid-row:${r+2};grid-column:${c+2}`;
  let h=`<div class="sea ${kind}" style="--n:${n}"><i class="corner" style="grid-row:1;grid-column:1"></i>`;
  for(let c=0;c<n;c++) h+=`<i class="lab" style="grid-row:1;grid-column:${c+2}">${c+1}</i>`;
  const drawn=new Set();
  for(const k in shipAt){ const x=shipAt[k].x; if(drawn.has(x)) continue; drawn.add(x);
    h+=`<div class="shipimg ${x.dir}${shipAt[k].sunk?' sunk':''}${kind==='place'&&PL.sel===x.i?' sel':''}" style="grid-row:${x.r+2} / span ${x.dir==='v'?x.l:1};grid-column:${x.c+2} / span ${x.dir==='h'?x.l:1}">${shipSVG(x.k, x.l, x.dir)}</div>`; }
  for(let r=0;r<n;r++){
    h+=`<i class="lab" style="grid-row:${r+2};grid-column:1">${LETRAS[r]}</i>`;
    for(let c=0;c<n;c++){
      const k=r*n+c, g=d[k]||0, sa=shipAt[k];
      let cls='cell';
      if(sa) cls+=' ship';
      if(g===1) cls+=' miss'; else if(g===4) cls+=' auto'; else if(g===2) cls+=' hit'; else if(g===3) cls+=' hit dead';
      if(cur && cur.r===r && cur.c===c) cls+=' incoming';
      if(aiming && aiming.r===r && aiming.c===c) cls+=' aim';
      if(ghost && ghost.cells.some(([y,x])=>y===r&&x===c)) cls+= ghost.ok ? ' gok' : ' gbad';
      const recent=BOOM.find(b=>b.to===i && b.r===r && b.c===c && performance.now()-b.t<900);
      if(recent) cls+= recent.res==='agua' ? ' splash' : ' boom';
      h+=`<button class="${cls}" style="${at(r,c)}" data-r="${r}" data-c="${c}" aria-label="${coordTxt(r,c)}"></button>`;
    }
  }
  return h+'</div>';
}
/* ---------- dibujo de los barcos (vistos desde arriba, la proa a la derecha) ---------- */
const SHIPCACHE={};
function shipSVG(k, l, dir){
  const key=k+l+dir; if(SHIPCACHE[key]) return SHIPCACHE[key];
  const W=l*100;
  const flag=x=>`<g transform="translate(${x},38)"><rect width="18" height="8" fill="#d52b1e"/><rect y="8" width="18" height="8" fill="#fff"/><rect y="16" width="18" height="8" fill="#0038a8"/><rect width="18" height="24" fill="none" stroke="#222" stroke-width="1.2"/></g>`;
  const turret=(x, back)=>`<g transform="translate(${x},50)"><rect x="${back?-34:0}" y="-3.5" width="34" height="7" rx="3" fill="#3c4650"/><circle r="13" fill="#6f7c89" stroke="#2d3a45" stroke-width="2.5"/><circle r="5" fill="#4b5763"/></g>`;
  const hull=`<path d="M10,28 L${W-60},22 Q${W-3},50 ${W-60},78 L10,72 Q3,50 10,28 Z" fill="#97a5b2" stroke="#2b3742" stroke-width="3.5"/><path d="M22,40 L${W-70},37 Q${W-38},50 ${W-70},63 L22,60 Z" fill="#a9b5c0" opacity=".55"/>`;
  let body='';
  if(k==='sub'){
    body=`<ellipse cx="${W/2}" cy="50" rx="${W/2-8}" ry="20" fill="#3d4853" stroke="#1d252c" stroke-width="3.5"/><ellipse cx="${W/2}" cy="44" rx="${W/2-20}" ry="7" fill="#56626e" opacity=".7"/>
      <rect x="${W*.42}" y="38" width="${Math.max(26,W*.14)}" height="24" rx="11" fill="#2a333b" stroke="#111" stroke-width="2"/><line x1="${W*.42+10}" y1="50" x2="${W*.42+10}" y2="30" stroke="#111" stroke-width="3"/>
      <path d="M8,50 L-2,40 L-2,60 Z" fill="#2a333b"/>`;
  } else if(k==='porta'){
    body=`<path d="M6,24 L${W-40},18 Q${W-2},50 ${W-40},82 L6,76 Z" fill="#97a5b2" stroke="#2b3742" stroke-width="3.5"/>
      <path d="M14,30 L${W-50},26 L${W-30},50 L${W-50},74 L14,70 Z" fill="#4d5862"/>
      <line x1="24" y1="50" x2="${W-60}" y2="50" stroke="#f2f2f2" stroke-width="3" stroke-dasharray="16 12"/><line x1="40" y1="34" x2="${W*.55}" y2="66" stroke="#f2c14e" stroke-width="2.5" opacity=".8"/>
      <rect x="${W*.62}" y="10" width="42" height="18" rx="3" fill="#dfe5ea" stroke="#2b3742" stroke-width="2"/>
      ${[0.2,0.38].map(f=>`<path d="M${W*f},50 l14,-14 l4,0 l-6,14 l6,14 l-4,0 Z" fill="#aab4bd" stroke="#333" stroke-width="1"/>`).join('')}${flag(16)}`;
  } else if(k==='remo'){
    body=hull+`<rect x="${W*.28}" y="32" width="${W*.32}" height="36" rx="8" fill="#e8edf2" stroke="#2b3742" stroke-width="2.5"/><rect x="${W*.33}" y="40" width="${W*.1}" height="20" rx="3" fill="#7fb3dc"/>
      ${[0.15,0.4,0.65].map(f=>`<circle cx="${W*f}" cy="25" r="5" fill="#222"/><circle cx="${W*f}" cy="75" r="5" fill="#222"/>`).join('')}<circle cx="${W*.72}" cy="50" r="9" fill="#c0392b" stroke="#222" stroke-width="2"/>${flag(14)}`;
  } else if(k==='lancha'){
    body=`<path d="M10,32 L${W-55},28 Q${W-6},50 ${W-55},72 L10,68 Q4,50 10,32 Z" fill="#97a5b2" stroke="#2b3742" stroke-width="3.5"/>
      <rect x="${W*.35}" y="38" width="${W*.22}" height="24" rx="6" fill="#e8edf2" stroke="#2b3742" stroke-width="2"/><rect x="${W*.52}" y="41" width="10" height="18" rx="2" fill="#7fb3dc"/>${turret(W*.78)}${flag(14)}`;
  } else {
    // acorazados, cruceros, cañoneros, destructores y patrulleros: puente, chimenea y cañones según el largo
    const tur = l>=5 ? [[.17,true],[.3,true],[.72,false],[.85,false]] : l===4 ? [[.18,true],[.72,false],[.86,false]] : l===3 ? [[.2,true],[.78,false]] : [[.8,false]];
    body=hull + tur.map(([f,b])=>turret(W*f,b)).join('')
      + `<rect x="${W*(l>2?.42:.32)}" y="34" width="${l>2?W*.16:W*.3}" height="32" rx="5" fill="#e8edf2" stroke="#2b3742" stroke-width="2.5"/><rect x="${W*(l>2?.42:.32)+6}" y="42" width="${l>2?W*.16-12:W*.3-12}" height="16" rx="3" fill="#cfd8e0"/>`
      + (l>2 ? `<ellipse cx="${W*.6}" cy="50" rx="11" ry="9" fill="#2d2d2d" stroke="#111" stroke-width="2"/><ellipse cx="${W*.6}" cy="48" rx="6" ry="4" fill="#555"/>` : '')
      + flag(14);
  }
  const inner=`<g transform="translate(0,50) scale(1,1.6) translate(0,-50)">${body}</g>`;   // más ancho: que llene la casilla
  const svg = dir==='v'
    ? `<svg viewBox="0 0 100 ${W}" preserveAspectRatio="none"><g transform="rotate(90) translate(0,-100)">${inner}</g></svg>`
    : `<svg viewBox="0 0 ${W} 100" preserveAspectRatio="none">${inner}</svg>`;
  return SHIPCACHE[key]=svg;
}
function renderBoards(){
  if(!V || V.phase==='lobby') return;
  if(V.phase==='place') return renderPlace();
  const big=bigSide(), small=smallSide(), m=mySide();
  const bigTitle = m>=0 && enemies().includes(big) ? `🎯 Mar de ${esc(sideName(V,big))}` : big===m ? '⚓ Tu flota' : `🌊 Mar de ${esc(sideName(V,big))}`;
  const smallTitle = small===m ? '⚓ Tu flota' : `🌊 ${esc(sideName(V,small))}`;
  $('#seaBig').innerHTML = `<div class="seat">${bigTitle}</div>` + seaHTML(big, m>=0 && enemies().includes(big) ? 'target' : 'view');
  $('#seaSmall').innerHTML = small!==big && V.sides[small] ? `<div class="seat">${smallTitle}</div>` + seaHTML(small, 'own') : '';
  $('#placeBox').innerHTML='';
  if(VIEW.mode==='3d' && R3.ok) R3.dirty=true;
}
(function(){
  const cellOf=e=>{ const b=e.target.closest('.cell'); return b ? {r:+b.dataset.r, c:+b.dataset.c, el:b} : null; };
  $('#seaBig').addEventListener('click', e=>{ const x=cellOf(e); if(!x || !V || V.phase!=='play') return; aimAt(x.r, x.c, false); });
  $('#placeBox').addEventListener('click', e=>{ const x=cellOf(e); if(x) PL.tap(x.r, x.c); });
  $('#placeBox').addEventListener('pointermove', e=>{ const x=cellOf(e); if(!x) return; if(PL.hover && PL.hover.r===x.r && PL.hover.c===x.c) return; PL.hover={r:x.r,c:x.c}; if(PL.sel!=null) renderPlace(); });
  $('#placeBox').addEventListener('pointerleave', ()=>{ PL.hover=null; if(PL.sel!=null) renderPlace(); });
})();

/* ====================== PONER LOS BARCOS ====================== */
const PL={
  key:null, list:[], sel:0, dir:'h', hover:null,
  F(){ return fleetDef(V.opts); },
  reset(){ this.list=this.F().ships.map(()=>null); this.sel=0; this.dir='h'; },
  ships(){ const F=this.F(); return this.list.map((s,i)=>s ? {i, k:F.ships[i][0], n:F.ships[i][1], l:F.ships[i][2], r:s.r, c:s.c, dir:s.dir} : null).filter(Boolean); },
  ghostCells(){
    if(this.sel==null || !this.hover) return null;
    const l=this.F().ships[this.sel][2], s={r:this.hover.r, c:this.hover.c, dir:this.dir, l};
    const try_=this.list.slice(); try_[this.sel]={r:s.r, c:s.c, dir:s.dir};
    return {cells:shipCells(s), ok:!partialError(try_, V.opts)};
  },
  tap(r, c){
    if(V.sides[mySide()].ready) return toast('Tu flota ya está lista. Tocá ✏️ Cambiar para moverla.');
    const n=this.F().n;
    // ¿tocó un barco ya puesto? lo levanta (o, si es el elegido, lo gira)
    const hit=this.ships().find(x=>shipCells(x).some(([y,xx])=>y===r&&xx===c));
    if(hit && hit.i===this.sel) return this.rotate();
    if(hit){ this.sel=hit.i; this.dir=hit.dir; this.list[hit.i]=null; sfx.place(); return renderPlace(); }
    if(this.sel==null){ return; }
    const try_=this.list.slice(); try_[this.sel]={r, c, dir:this.dir};
    const l=this.F().ships[this.sel][2];
    // si se sale por el borde, lo corre para adentro
    if(this.dir==='h' && c+l>n) try_[this.sel].c=n-l; if(this.dir==='v' && r+l>n) try_[this.sel].r=n-l;
    if(partialError(try_, V.opts)){ sfx.bad(); return toast(V.opts.toca===false ? 'No entra ahí: los barcos no se pueden tocar.' : 'No entra ahí.'); }
    this.list=try_; sfx.place();
    const next=this.list.findIndex(x=>!x); this.sel = next>=0 ? next : null;
    renderPlace();
  },
  rotate(){
    this.dir = this.dir==='h' ? 'v' : 'h';
    if(this.sel!=null && this.list[this.sel]){
      const try_=this.list.slice(); try_[this.sel]=Object.assign({}, this.list[this.sel], {dir:this.dir});
      if(!partialError(try_, V.opts)) this.list=try_; else { this.dir = this.dir==='h' ? 'v' : 'h'; toast('Girado no entra ahí.'); }
    }
    renderPlace();
  },
  pick(i){ if(this.list[i]){ this.dir=this.list[i].dir; this.list[i]=null; } this.sel=i; renderPlace(); },
  random(){ const f=randomFleet(V.opts); if(f){ this.list=f; this.sel=null; sfx.place(); renderPlace(); } },
  clear(){ this.reset(); renderPlace(); },
  last(){ const f=load('naval_flota_'+V.opts.flota+(V.opts.toca===false?'_nt':'')); if(f && !fleetError(f, V.opts)){ this.list=f; this.sel=null; renderPlace(); } else toast('No hay una flota guardada para estas reglas.'); },
  ready(){
    if(this.list.some(x=>!x)) return toast('Te faltan barcos por poner.');
    const e=fleetError(this.list, V.opts); if(e) return toast(e);
    store('naval_flota_'+V.opts.flota+(V.opts.toca===false?'_nt':''), this.list);
    doAct({type:'place', fleet:this.list, as:viewer()});
  },
};
function renderPlace(){
  const m=mySide();
  $('#seaBig').innerHTML=''; $('#seaSmall').innerHTML='';
  if(m<0){ $('#placeBox').innerHTML=`<div class="waitbox">⏳ Los jugadores están poniendo sus barcos en secreto…<br><small>${V.sides.map((s,i)=>`${esc(sideName(V,i))}: ${s.ready?'✅':'⏳'}`).join(' · ')}</small></div>`; return; }
  const s=V.sides[m], key=V.round+'|'+m+'|'+viewer();
  if(PL.key!==key){ PL.key=key; PL.reset(); if(s.fleet && s.fleet.every(x=>x.r!=null)) PL.list=s.fleet.map(x=>({r:x.r,c:x.c,dir:x.dir})); }
  if(s.ready){
    if(s.fleet) PL.list=s.fleet.map(x=>({r:x.r,c:x.c,dir:x.dir}));
    PL.sel=null;
    $('#placeBox').innerHTML=`<div class="seat">⚓ Tu flota está lista</div>${seaHTML(m,'place')}
      <div class="waitbox">⏳ Esperando a los demás: ${V.sides.map((x,i)=>i===m?'':`${esc(sideName(V,i))} ${x.ready?'✅':'⏳'}`).filter(Boolean).join(' · ')}
      <br><button class="btn sm gray" style="margin-top:8px" onclick="doAct({type:'unready', as:viewer()})">✏️ Cambiar mi flota</button></div>`;
    return;
  }
  const F=PL.F();
  const chips=F.ships.map(([k,n,l],i)=>`<button class="chip ${PL.sel===i?'sel':''} ${PL.list[i]?'done':''}" onclick="PL.pick(${i})"><b>${esc(n)}</b><span class="mini" style="--l:${l}">${shipSVG(k, l, 'h')}</span></button>`).join('');
  $('#placeBox').innerHTML=`<div class="seat">🚢 Poné tus barcos${V.opts.toca===false?' <small>(no se pueden tocar)</small>':''}</div>
    <div class="placewrap">${seaHTML(m,'place')}
    <div class="ppanel"><div class="chips">${chips}</div>
      <p class="muted">${PL.sel!=null?`Ubicando: <b>${esc(F.ships[PL.sel][1])}</b> (${F.ships[PL.sel][2]} casillas, ${PL.dir==='h'?'acostado ↔':'parado ↕'}). Tocá dónde empieza.`:'Tocá un barco del mar para moverlo, o elegí uno de la lista.'}</p>
      <div class="row wrap"><button class="btn sm" onclick="PL.rotate()">🔄 Girar</button><button class="btn sm gray" onclick="PL.random()">🎲 Al azar</button><button class="btn sm gray" onclick="PL.last()">↩️ Mi última</button><button class="btn sm gray" onclick="PL.clear()">🧹 Sacar todos</button></div>
      <button class="btn green wide" style="margin-top:8px" onclick="PL.ready()" ${PL.list.some(x=>!x)?'disabled':''}>✅ ¡Listo!</button></div></div>`;
}
document.addEventListener('keydown', e=>{ if(V && V.phase==='place' && (e.key==='r'||e.key==='R') && !/INPUT|TEXTAREA/.test(e.target.tagName)) PL.rotate(); });

// ---------- fin de la batalla ----------
let ENDSHOWN=null;
function endModal(){
  if(!V || (V.phase!=='roundEnd' && V.phase!=='over') || !V.roundWin){ if(ENDSHOWN && V && (V.phase==='play'||V.phase==='place')){ ENDSHOWN=null; closeModal(); } return; }
  const key=V.round+'|'+V.phase; if(ENDSHOWN===key) return; ENDSHOWN=key;
  const w=V.roundWin, host=amHost(), over=V.phase==='over';
  const iWon = V.sides[w.side] && V.sides[w.side].pids.some(pid=>mine(pid));
  if(iWon) sfx.win(); else if(mySide()>=0) sfx.lose();
  const stats=V.sides.map((s,i)=>`<tr><td><b>${esc(sideName(V,i))}</b>${i===w.side?' 🏆':''}</td><td>${s.shotsF} tiros</td><td>${s.hitsF} aciertos</td><td>${s.shotsF?Math.round(s.hitsF/s.shotsF*100):0}%</td>${V.opts.race>1?`<td>${s.wins} ganada${s.wins===1?'':'s'}</td>`:''}</tr>`).join('');
  const seas=V.sides.map((s,i)=>`<div class="endsea"><div class="seat">${esc(sideName(V,i))}</div>${seaHTML(i,'view')}</div>`).join('');
  modal(`<h2>${over?'🏆 ¡Terminó la batalla!':`⚓ Fin de la batalla ${V.round}`}</h2>
    <p style="font-size:18px">${iWon?'🎉 ¡Ganaste! ':''}<b>${esc(sideName(V,w.side))}</b> gana ${over&&V.opts.race>1?'la serie':'la batalla'}.</p>
    <p class="muted">${esc(w.why||'')}</p>
    <table class="score">${stats}</table>
    <p class="muted" style="margin-bottom:4px">Así estaban las flotas:</p><div class="endseas">${seas}</div>
    ${host ? (over ? `<button class="btn green wide" onclick="closeModal();doAct({type:'rematch'})">🔁 Revancha</button><button class="btn wide" style="margin-top:6px" onclick="closeModal();doAct({type:'newGame'})">⚙️ Volver a la sala (cambiar reglas)</button>`
                   : `<button class="btn green wide" onclick="closeModal();doAct({type:'nextRound'})">▶️ Siguiente batalla</button><p class="muted">Si no, arranca sola en unos segundos.</p>`)
           : `<p class="muted">${over?'El anfitrión elige si hay revancha.':'La próxima batalla arranca en unos segundos…'}</p>`}
    <button class="btn gray wide" style="margin-top:6px" onclick="closeModal()">Mirar el mar</button>`);
}

/* ====================== MAR 3D ====================== */
const VIEW={mode: load('naval_view')==='3d' ? '3d' : '2d'};
const R3={ok:false, dirty:true};
const CAM3=Object.assign({pitch:55, zoom:1, yaw:0}, load('naval_cam3')||{});
function saveCam3(){ store('naval_cam3', {pitch:CAM3.pitch, zoom:CAM3.zoom, yaw:CAM3.yaw}); }
const CELL=10;   // tamaño de una casilla en el 3D
const RADAR_Y=4.6; // altura de la pantalla de radar sobre el agua
// olas: las mismas en la placa de video y acá (para que los barcos suban y bajen con el agua)
const WAVES=[[.96,.28,.045,1.0,1.1],[-.37,.93,.06,.7,1.4],[.71,-.71,.11,.3,2.0],[.22,.97,.18,.14,2.6]];
function waveH(x, z, t){
  let h=0; for(const [dx,dz,k,a,s] of WAVES) h+=a*Math.sin(k*(dx*x+dz*z)+s*t);
  const R=R3.calmR||100, u=Math.max(0, Math.min(1, (Math.hypot(x,z)-R*.55)/(R*.9)));
  return h*(.45+.55*u*u*(3-2*u));
}
const WATER_VS=`
uniform float uT, uCalm;
varying vec3 vW; varying vec3 vN; varying float vH;
void wv(vec2 p, vec2 d, float k, float a, float s, inout float h, inout vec2 g){ float ph=k*dot(d,p)+s*uT; h+=a*sin(ph); g+=a*k*d*cos(ph); }
void main(){
  vec4 w=modelMatrix*vec4(position,1.0); vec2 p=w.xz; float h=0.0; vec2 g=vec2(0.0);
  wv(p,vec2(.96,.28),.045,1.0,1.1,h,g); wv(p,vec2(-.37,.93),.06,.7,1.4,h,g); wv(p,vec2(.71,-.71),.11,.3,2.0,h,g); wv(p,vec2(.22,.97),.18,.14,2.6,h,g);
  float c=.45+.55*smoothstep(uCalm*.55, uCalm*1.45, length(p)); h*=c; g*=c;
  w.y+=h; vW=w.xyz; vH=h; vN=normalize(vec3(-g.x,1.0,-g.y));
  gl_Position=projectionMatrix*viewMatrix*w;
}`;
const WATER_FS=`
uniform float uT, uGrid, uN, uCell, uFogN, uFogF;
uniform vec3 uSun, uDeep, uShallow, uHor, uZen, uFog;
varying vec3 vW; varying vec3 vN; varying float vH;
void main(){
  vec2 p=vW.xz; vec3 n=vN;
  // ondas chiquitas que brillan
  n.x+=.09*sin(p.x*.9+uT*3.1)*cos(p.y*.7-uT*2.3)+.05*sin(p.y*1.7+p.x*.4+uT*4.0)+.03*sin(p.x*3.1+p.y*2.3-uT*6.0);
  n.z+=.09*cos(p.y*.85-uT*2.7)*sin(p.x*.6+uT*1.9)+.05*sin(p.x*1.9-p.y*.5-uT*3.6)+.03*cos(p.y*3.3-p.x*2.1+uT*5.5);
  n=normalize(n);
  vec3 V=normalize(cameraPosition-vW);
  float fr=.04+.96*pow(1.0-max(dot(n,V),0.0),4.0);
  vec3 R=reflect(-V,n);
  vec3 sky=mix(uHor,uZen,clamp(R.y*1.6,0.0,1.0));
  vec3 base=mix(uDeep,uShallow,clamp(vH*.3+.45,0.0,1.0));
  base+=uShallow*.25*pow(max(dot(n,normalize(vec3(V.x,0.0,V.z)+uSun)),0.0),3.0);
  vec3 col=mix(base,sky,clamp(fr,0.0,1.0)*.85);
  float sp=pow(max(dot(R,uSun),0.0),220.0); col+=vec3(1.0,.95,.85)*sp*2.2;
  col+=vec3(1.0)*pow(max(dot(R,uSun),0.0),24.0)*.12;
  // espuma en la cresta de las olas
  float fo=smoothstep(1.15,2.1,vH)*(.55+.45*sin(p.x*1.3+p.y*1.1+uT*2.0)*sin(p.y*1.7-p.x*.9-uT*1.4));
  col=mix(col,vec3(.93,.97,1.0),clamp(fo,0.0,1.0)*.6);
  // la grilla pintada sobre el agua (cuando se mira la flota propia)
  if(uGrid>.5){
    float hf=uN*uCell*.5; vec2 q=(p+hf)/uCell;
    if(q.x>=0.0&&q.y>=0.0&&q.x<=uN&&q.y<=uN){
      vec2 fw=fwidth(q); vec2 gl=1.0-smoothstep(vec2(0.0),fw*1.6,min(fract(q),1.0-fract(q)));
      col=mix(col,vec3(.88,.96,1.0),max(gl.x,gl.y)*.5);
      col=mix(col,uShallow*1.2,.12);
    }
  }
  float d=length(cameraPosition-vW); col=mix(col,uFog,smoothstep(uFogN,uFogF,d));
  gl_FragColor=vec4(col,1.0);
}`;
const RADAR_VS=`varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`;
const RADAR_FS=`
uniform float uT, uN, uCell, uAimOn; uniform vec2 uAim; uniform sampler2D uMarks;
varying vec3 vW;
const float TAU=6.28318;
void main(){
  vec2 p=vW.xz; float hf=uN*uCell*.5; vec2 q=(p+hf)/uCell;
  float inB=step(0.0,q.x)*step(q.x,uN)*step(0.0,q.y)*step(q.y,uN);
  vec3 G=vec3(.25,1.0,.5); vec3 col=vec3(0.0,.16,.07); float a=.24*inB;
  // borde de la pantalla
  float e=min(min(q.x,uN-q.x),min(q.y,uN-q.y));
  if(inB<.5){ col=vec3(.02,.07,.05); a=.62; float rim=1.0-smoothstep(0.0,.18,abs(e)); col+=G*rim*.9; a+=rim*.3; gl_FragColor=vec4(col,a); return; }
  col+=G*(1.0-smoothstep(0.0,.12,e))*.8; a+=(1.0-smoothstep(0.0,.12,e))*.4;
  // cuadrícula
  vec2 fw=fwidth(q); vec2 gl=1.0-smoothstep(vec2(0.0),fw*1.5,min(fract(q),1.0-fract(q))); float line=max(gl.x,gl.y);
  col+=G*line*.45; a+=line*.35;
  // círculos del radar
  float rv=length(p)/(hf*.5); float rl=1.0-smoothstep(0.0,fwidth(rv)*1.4,abs(fract(rv+.5)-.5));
  col+=G*rl*.35; a+=rl*.22;
  // barrido que gira
  float sw=mod(uT*1.5,TAU); float ang=atan(p.y,p.x); float da=mod(sw-ang,TAU);
  float trail=exp(-da*2.4)*smoothstep(hf*1.5,hf*.2,length(p)); float beam=1.0-smoothstep(0.0,.035,da);
  col+=G*(trail*.5+beam*.9); a+=trail*.28+beam*.45;
  // marcas: el barrido las hace brillar al pasar
  vec2 ci=floor(q); vec2 fc=fract(q)-.5; float dd=length(fc);
  float v=floor(texture2D(uMarks,(ci+.5)/uN).r*255.0+.5);
  vec2 cc=(ci+.5)*uCell-hf; float lit=.45+.55*exp(-mod(sw-atan(cc.y,cc.x),TAU)*1.3);
  if(v==1.0||v==4.0){ float k=v==1.0?1.0:.45; float dot=1.0-smoothstep(.1,.16,dd); col+=vec3(.6,1.0,.95)*dot*lit*k; a+=dot*.55*lit*k; }
  else if(v==2.0){ float pu=.5+.5*sin(uT*6.0+ci.x+ci.y); float dot=1.0-smoothstep(.22,.29,dd); float ring=(1.0-smoothstep(0.0,.04,abs(dd-(.3+pu*.12))))*.8;
    col=mix(col,vec3(1.0,.2,.15),clamp(dot*lit+ring*.6,0.0,1.0)); a+=dot*.6+ring*.3; }
  else if(v==3.0){ float x=1.0-smoothstep(.04,.09,min(abs(fc.x-fc.y),abs(fc.x+fc.y))); x*=step(max(abs(fc.x),abs(fc.y)),.36);
    col=mix(col,vec3(.55,.05,.04),.55); col=mix(col,vec3(1.0,.35,.2),x*lit); a+=.25+x*.4; }
  // la mira
  if(uAimOn>.5){
    float pu=.5+.5*sin(uT*8.0);
    if(ci.y==uAim.x||ci.x==uAim.y){ col+=vec3(1.0,.85,.3)*.12; a+=.06; }
    if(ci.y==uAim.x&&ci.x==uAim.y){ float bx=1.0-smoothstep(.0,.06,.5-max(abs(fc.x),abs(fc.y))); col=mix(col,vec3(1.0,.9,.35),bx*.95+.18+pu*.12); a+=bx*.5+.2; }
  }
  // líneas de barrido de la pantalla
  a*=.9+.1*sin(vW.z*2.6-uT*14.0);
  gl_FragColor=vec4(col,clamp(a,0.0,.92));
}`;
function init3D(){
  if(R3.ok) return true; if(!window.THREE) return false;
  const T=THREE, canvas=$('#c3d');
  let renderer; try{ renderer=new T.WebGLRenderer({canvas, antialias:true}); }catch(e){ toast('Este aparato no puede mostrar 3D. Seguimos en 2D.'); return false; }
  const mobile=/Android|iPhone|iPad/i.test(navigator.userAgent);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, mobile?1.5:2));
  const scene=new T.Scene();
  // cielo con degradé
  const sc=document.createElement('canvas'); sc.width=2; sc.height=256; const sg=sc.getContext('2d'), gr=sg.createLinearGradient(0,0,0,256);
  gr.addColorStop(0,'#3d7fc4'); gr.addColorStop(.55,'#8fc0e6'); gr.addColorStop(1,'#d6ecf8'); sg.fillStyle=gr; sg.fillRect(0,0,2,256);
  scene.background=new T.CanvasTexture(sc);
  const cam=new T.PerspectiveCamera(45, 1, 1, 3000);
  Object.assign(R3, {T, renderer, scene, cam, ok:true});
  scene.add(new T.HemisphereLight(0xeaf6ff, 0x1d3550, .85));
  const sun=new T.DirectionalLight(0xfff2d6, .95); sun.position.set(120, 260, 140); scene.add(sun);
  // el mar: las olas se calculan en la placa de video
  const seg=mobile?110:160, geo=new T.PlaneGeometry(1600, 1600, seg, seg); geo.rotateX(-Math.PI/2);
  R3.wu={ uT:{value:0}, uCalm:{value:100}, uGrid:{value:1}, uN:{value:10}, uCell:{value:CELL}, uFogN:{value:420}, uFogF:{value:1150},
    uSun:{value:new T.Vector3(120,260,140).normalize()}, uDeep:{value:new T.Color(0x07304f)}, uShallow:{value:new T.Color(0x1c78a6)},
    uHor:{value:new T.Color(0xcfe6f5)}, uZen:{value:new T.Color(0x4f93cf)}, uFog:{value:new T.Color(0xc4e0f3)} };
  const wm=new T.ShaderMaterial({uniforms:R3.wu, vertexShader:WATER_VS, fragmentShader:WATER_FS}); wm.extensions.derivatives=true;
  R3.water=new T.Mesh(geo, wm); R3.water.frustumCulled=false; scene.add(R3.water);
  // costa paraguaya de fondo: lomas verdes
  for(let i=0;i<9;i++){ const h=new T.Mesh(new T.SphereGeometry(80+rnd(60), 16, 10), new T.MeshLambertMaterial({color: i%2?0x3f7d3a:0x4f8f45})); h.scale.y=.35; h.position.set(-520+i*130, -12, -620-rnd(80)); scene.add(h); }
  R3.board=new T.Group(); scene.add(R3.board);
  R3.ray=new T.Raycaster(); R3.plane=new T.Plane(new T.Vector3(0,1,0), 0);
  R3.fx=[]; R3.bobs=[];
  wire3D(canvas); resizeStage();
  return true;
}
function labelSprite(txt, col){
  const c=document.createElement('canvas'); c.width=64; c.height=64; const g=c.getContext('2d');
  g.fillStyle=col||'#ffffff'; g.font='bold 40px system-ui'; g.textAlign='center'; g.textBaseline='middle';
  g.shadowColor='rgba(0,0,0,.6)'; g.shadowBlur=6; g.fillText(txt, 32, 34);
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c), transparent:true, depthWrite:false, depthTest:false})); s.renderOrder=5; s.scale.set(7,7,1); return s;
}
// barco 3D: casco con proa, puente, cañones y una banderita paraguaya
function shipMesh(l, sunk){
  const T=THREE, g=new T.Group(), L=l*CELL-2.4, W=CELL*.62;
  const sh=new T.Shape(); sh.moveTo(-L/2, -W/2); sh.lineTo(L/2-W*.8, -W/2); sh.quadraticCurveTo(L/2+W*.2, 0, L/2-W*.8, W/2); sh.lineTo(-L/2, W/2); sh.lineTo(-L/2, -W/2);
  const hull=new T.Mesh(new T.ExtrudeGeometry(sh, {depth:3.4, bevelEnabled:true, bevelSize:.5, bevelThickness:.5, bevelSegments:1}), new T.MeshStandardMaterial({color: sunk?0x3b2a24:0x6f7d8c, roughness:.6, metalness:.3}));
  hull.rotation.x=-Math.PI/2; hull.position.y=-1.2; g.add(hull);
  // franja roja en la línea de flotación
  const wl=new T.Mesh(new T.BoxGeometry(L*.97, .7, W*1.04), new T.MeshStandardMaterial({color: sunk?0x2a1a14:0x8c2a22, roughness:.7})); wl.position.set(-W*.15, -.9, 0); g.add(wl);
  const deck=new T.Mesh(new T.BoxGeometry(L*.9, .5, W*.86), new T.MeshStandardMaterial({color: sunk?0x2a1e18:0x9aa6b2})); deck.position.set(-W*.2, 2.6, 0); g.add(deck);
  if(!sunk){
    const bridge=new T.Mesh(new T.BoxGeometry(Math.min(8,L*.3), 4, W*.6), new T.MeshStandardMaterial({color:0xe8edf2})); bridge.position.set(-L*.12, 4.8, 0); g.add(bridge);
    const win=new T.Mesh(new T.BoxGeometry(Math.min(8,L*.3)+.1, .8, W*.62), new T.MeshStandardMaterial({color:0x1d2a36, metalness:.6, roughness:.2})); win.position.set(-L*.12, 6, 0); g.add(win);
    for(let k=0;k<Math.max(1,l-2);k++){ const tur=new T.Mesh(new T.CylinderGeometry(1.4,1.6,1.2,10), new T.MeshStandardMaterial({color:0x56616d})); tur.position.set(L*.3-k*CELL*.7, 3.4, 0); g.add(tur);
      const gun=new T.Mesh(new T.CylinderGeometry(.3,.3,4,6), tur.material); gun.rotation.z=Math.PI/2; gun.position.set(L*.3-k*CELL*.7+2.2, 3.6, 0); g.add(gun); }
    const mast=new T.Mesh(new T.CylinderGeometry(.2,.2,7,6), new T.MeshStandardMaterial({color:0x333333})); mast.position.set(-L*.12, 9.5, 0); g.add(mast);
    // antena de radar que gira
    const ant=new T.Mesh(new T.BoxGeometry(3.2,.5,.3), new T.MeshStandardMaterial({color:0xdfe6ec})); ant.position.set(-L*.12, 12.6, 0); g.add(ant); g.userData.ant=ant;
    const fc=document.createElement('canvas'); fc.width=48; fc.height=30; const fg=fc.getContext('2d'); [['#d52b1e',0],['#ffffff',10],['#0038a8',20]].forEach(([col,y])=>{ fg.fillStyle=col; fg.fillRect(0,y,48,10); });
    const flag=new T.Mesh(new T.PlaneGeometry(4,2.5), new T.MeshBasicMaterial({map:new T.CanvasTexture(fc), side:T.DoubleSide})); flag.position.set(-L*.12-2, 11.2, 0); g.add(flag); g.userData.flag=flag;
  }
  // espuma alrededor del casco
  const fo=new T.Mesh(new T.CircleGeometry(1, 28), new T.MeshBasicMaterial({color:0xffffff, transparent:true, opacity: sunk?.12:.28, depthWrite:false}));
  fo.rotation.x=-Math.PI/2; fo.scale.set(L*.62, W*1.05, 1); fo.position.set(-W*.1, .2, 0); g.add(fo);
  return g;
}
function cellPos(r, c, n){ return [(c-(n-1)/2)*CELL, (r-(n-1)/2)*CELL]; }
function bob(o, k, extra){ o.updateMatrix(); R3.bobs.push(Object.assign({o, x:o.position.x, z:o.position.z, y0:o.position.y, rx:o.rotation.x, rz:o.rotation.z, ph:Math.random()*6, k}, extra||{})); }
// rehace el tablero 3D (el mar que se ve grande) cuando cambia algo
function build3D(){
  const T=R3.T, n=N(), B=R3.board; while(B.children.length) B.remove(B.children[0]);
  R3.bobs=[]; R3.radar=null; R3.fires=[];
  if(!V || V.phase==='lobby') return;
  const i = V.phase==='place' ? mySide() : (R3.showOwn ? smallSide() : bigSide()); R3.side=i;
  if(i<0 || !V.sides[i]) return;
  const s=V.sides[i], d=ANIM.disp[i]||s.grid||[], size=n*CELL;
  // radar: cuando se mira el mar del enemigo durante la batalla
  const radar = V.phase==='play' && !s.pids.includes(viewer());
  R3.isRadar=radar; R3.plane.constant = radar ? -RADAR_Y : 0;
  R3.calmR=size*.75; R3.wu.uCalm.value=size*.75; R3.wu.uN.value=n; R3.wu.uGrid.value=radar?0:1;
  // marco alrededor del mar: dorado en tu mar, metal verde en el radar
  const fm=radar ? new T.MeshStandardMaterial({color:0x22332b, emissive:0x0c3a1c, roughness:.35, metalness:.7}) : new T.MeshStandardMaterial({color:0xf2c14e, roughness:.4, metalness:.3});
  const fy=radar?RADAR_Y-.4:.8;
  for(const [w,dd,x,z] of [[size+16,3,0,-size/2-7],[size+16,3,0,size/2+7],[3,size+16,-size/2-7,0],[3,size+16,size/2+7,0]]){ const b=new T.Mesh(new T.BoxGeometry(w,radar?1.2:1.6,dd), fm); b.position.set(x,fy,z); B.add(b); if(!radar) bob(b,.35); }
  for(let k=0;k<n;k++){ const lc=radar?'#8dffb4':'#ffffff';
    const a=labelSprite(String(k+1), lc); const [x]=cellPos(0,k,n); a.position.set(x, radar?RADAR_Y+2.5:5, -size/2-3.5); B.add(a);
    const b=labelSprite(LETRAS[k], lc); const [,z]=cellPos(k,0,n); b.position.set(-size/2-3.5, radar?RADAR_Y+2.5:5, z); B.add(b); }
  // barcos que se ven
  const ownOrAll = s.pids.includes(viewer()) || (NET.obs && V.opts.obsVen) || V.phase!=='play';
  const ships = V.phase==='place' ? PL.ships() : (s.fleet||[]).filter(x=>x.r!=null && !x.hidden && (ownOrAll ? true : sunkDisp(i,x)));
  ships.forEach(x=>{ const sunk = V.phase!=='place' && sunkDisp(i,x), m=shipMesh(x.l, sunk), [x0,z0]=cellPos(x.r, x.c, n);
    const ang = x.dir==='v' ? -Math.PI/2 : 0, off=(x.l-1)*CELL/2;
    m.position.set(x.dir==='h' ? x0+off : x0, sunk?-2.6:0, x.dir==='v' ? z0+off : z0); m.rotation.y=ang; if(sunk){ m.rotation.z=.12; m.rotation.x=.08; } B.add(m);
    bob(m, sunk?.25:.75, {ship:true}); });
  // marcas: agua = boya blanca, tocado = estaca roja con fuego y humo
  const missM=new T.MeshStandardMaterial({color:0xffffff, roughness:.4}), hitM=new T.MeshStandardMaterial({color:0xd52b1e, emissive:0x550000});
  for(let r=0;r<n;r++) for(let c=0;c<n;c++){ const g=d[r*n+c]; if(!g) continue; const [x,z]=cellPos(r,c,n);
    if(g===1 || g===4){ const b=new T.Mesh(new T.SphereGeometry(g===4?1:1.6, 10, 8), missM); b.position.set(x, .6, z); if(g===4){ b.material=b.material.clone(); b.material.transparent=true; b.material.opacity=.45; } B.add(b); bob(b,1); }
    else { const p=new T.Mesh(new T.CylinderGeometry(.9,.9,6,8), hitM); p.position.set(x, 3, z); B.add(p); bob(p,.75);
      const f=new T.Mesh(new T.ConeGeometry(2.2, 5, 8), new T.MeshBasicMaterial({color:0xff8a00, transparent:true, opacity:.85})); f.position.set(x, 7, z); B.add(f); R3.fires.push(f); bob(f,.75);
      const f2=new T.Mesh(new T.ConeGeometry(1.2, 3.4, 8), new T.MeshBasicMaterial({color:0xffe066, transparent:true, opacity:.9})); f2.position.set(x, 6.2, z); B.add(f2); R3.fires.push(f2); bob(f2,.75);
      if(g===2) R3.fires.push({smoke:true, x, z, next:0}); }
  }
  // la pantalla de radar semitransparente
  if(radar){
    const data=new Uint8Array(n*n*4); for(let k=0;k<n*n;k++){ data[k*4]=d[k]||0; data[k*4+3]=255; }
    if(R3.marksTex) R3.marksTex.dispose();
    const tex=new T.DataTexture(data, n, n, T.RGBAFormat); tex.magFilter=tex.minFilter=T.NearestFilter; tex.needsUpdate=true; R3.marksTex=tex;
    R3.ru={ uT:{value:0}, uN:{value:n}, uCell:{value:CELL}, uMarks:{value:tex}, uAim:{value:new T.Vector2(-1,-1)}, uAimOn:{value:0} };
    const rm=new T.ShaderMaterial({uniforms:R3.ru, vertexShader:RADAR_VS, fragmentShader:RADAR_FS, transparent:true, depthWrite:false, side:T.DoubleSide}); rm.extensions.derivatives=true;
    const pg=new T.PlaneGeometry(size+11, size+11); pg.rotateX(-Math.PI/2);
    R3.radar=new T.Mesh(pg, rm); R3.radar.position.y=RADAR_Y; R3.radar.renderOrder=3; B.add(R3.radar);
  }
  // mira
  R3.aim=new T.Mesh(new T.RingGeometry(3.2, 4.4, 24), new T.MeshBasicMaterial({color:0xffe066, side:T.DoubleSide, transparent:true, opacity:.9, depthTest:!radar})); R3.aim.rotation.x=-Math.PI/2; R3.aim.visible=false; R3.aim.renderOrder=4; B.add(R3.aim);
  R3.builtKey=bkey3();
  R3.dirty=false;
}
const bkey3 = () => [V.phase, V.round, R3.showOwn, bigSide(), smallSide(), JSON.stringify(ANIM.disp[R3.showOwn?smallSide():bigSide()]||[]).length, (ANIM.disp[bigSide()]||[]).join(''), V.phase==='place'?JSON.stringify(PL.list):'' ].join('|');
function wire3D(cv){
  let drag=null;
  cv.addEventListener('pointerdown', e=>{ cv.setPointerCapture(e.pointerId); drag={x:e.clientX, y:e.clientY, sx:e.clientX, sy:e.clientY}; });
  cv.addEventListener('pointermove', e=>{ if(!drag) return; const dx=e.clientX-drag.x, dy=e.clientY-drag.y; drag.x=e.clientX; drag.y=e.clientY; CAM3.yaw+=dx*.005; CAM3.pitch=Math.max(20, Math.min(88, CAM3.pitch+dy*.2)); });
  cv.addEventListener('pointerup', e=>{ if(!drag) return; const tap=Math.hypot(e.clientX-drag.sx, e.clientY-drag.sy)<7; drag=null; saveCam3();
    if(!tap || !V || V.phase!=='play' || R3.showOwn) return;
    const r=cv.getBoundingClientRect(), v=new R3.T.Vector2((e.clientX-r.left)/r.width*2-1, -((e.clientY-r.top)/r.height*2-1));
    R3.ray.setFromCamera(v, R3.cam); const p=new R3.T.Vector3(); if(!R3.ray.ray.intersectPlane(R3.plane, p)) return;
    const n=N(), c=Math.floor(p.x/CELL+n/2), rr=Math.floor(p.z/CELL+n/2); if(rr<0||rr>=n||c<0||c>=n) return;
    aimAt(rr, c, false);
  });
  cv.addEventListener('wheel', e=>{ e.preventDefault(); CAM3.zoom=Math.max(.5, Math.min(2.2, CAM3.zoom*(e.deltaY>0?1.08:.93))); saveCam3(); }, {passive:false});
}
function cam3(k, d){
  if(k==='own'){ R3.showOwn=!R3.showOwn; R3.dirty=true; toast(R3.showOwn?'⚓ Mirando el otro mar (tu flota si jugás)':'📡 Mirando el radar del mar enemigo'); return; }
  if(k==='zoom') CAM3.zoom=Math.max(.5, Math.min(2.2, CAM3.zoom*(d>0?.85:1.18)));
  else if(k==='pitch') CAM3.pitch=Math.max(20, Math.min(88, CAM3.pitch+d));
  else if(k==='reset'){ CAM3.pitch=55; CAM3.zoom=1; CAM3.yaw=0; }
  saveCam3();
}
function draw3D(t){
  const T=R3.T;
  if(R3.dirty || R3.builtKey!==bkey3()) build3D();
  const tt=t/1000, n=N();
  R3.wu.uT.value=tt;
  // todo lo que flota sube y baja con las olas
  for(const b of R3.bobs){ const o=b.o, h=waveH(b.x, b.z, tt);
    o.position.y=b.y0+h*b.k;
    if(b.ship){ const sx=waveH(b.x+6, b.z, tt)-waveH(b.x-6, b.z, tt), sz=waveH(b.x, b.z+6, tt)-waveH(b.x, b.z-6, tt);
      o.rotation.x=b.rx-sz*.035; o.rotation.z=b.rz+sx*.035;
      const u=o.userData; if(u.ant) u.ant.rotation.y=tt*2.4+b.ph; if(u.flag) u.flag.rotation.y=Math.sin(tt*3+b.ph)*.35; } }
  (R3.fires||[]).forEach((f,k)=>{
    if(f.smoke){ if(t>f.next){ f.next=t+380+Math.random()*260; puff(f.x+(Math.random()-.5)*2, 9, f.z+(Math.random()-.5)*2, 0x2b2b2b, .55, 2.6); } return; }
    const s=1+Math.sin(tt*9+k)*.18; f.scale.set(s, 1+Math.sin(tt*7+k*2)*.25, s); });
  // mira y bomba en camino
  const am = myTurn() && AIM.r!=null && AIM.to===R3.side ? AIM : (REMOTE_AIM && REMOTE_AIM.to===R3.side && REMOTE_AIM.r!=null && !mine(curShooter()) ? REMOTE_AIM : null);
  if(R3.aim){ R3.aim.visible=!!am; if(am){ const [x,z]=cellPos(am.r, am.c, n); R3.aim.position.set(x, (R3.isRadar?RADAR_Y+.3:1.4+waveH(x,z,tt)*.8)+Math.sin(tt*6)*.3, z); } }
  if(R3.radar){ R3.ru.uT.value=tt; R3.ru.uAimOn.value=am?1:0; if(am) R3.ru.uAim.value.set(am.r, am.c); }
  const cur=ANIM.cur;
  if(cur && cur.to===R3.side){
    if(!R3.bomb){ R3.bomb=missileMesh(); R3.scene.add(R3.bomb); }
    const k=Math.min(1,(performance.now()-ANIM.t0)/1100), [x,z]=cellPos(cur.r, cur.c, n);
    const pos=kk=>new T.Vector3(x, 2+130*(1-kk)+45*Math.sin(Math.PI*kk), z+(1-kk)*170);
    const p=pos(k); R3.bomb.visible=k<1; R3.bomb.position.copy(p); R3.bomb.lookAt(pos(Math.min(1,k+.02)));
    if(k<1 && t>(R3.trailT||0)){ R3.trailT=t+28; puff(p.x, p.y, p.z, 0xdddddd, .7, 1.6, .9); }
    if(k>=1 && R3.fxDone!==cur.n){ R3.fxDone=cur.n; spawnFx(x, z, cur.res); }
  } else if(R3.bomb) R3.bomb.visible=false;
  if(!cur) R3.fxDone=null;
  R3.fx=R3.fx.filter(f=>{ const age=(t-f.t0)/1000; if(age>f.life){ R3.scene.remove(f.m); if(f.light) R3.scene.remove(f.light); return false; } f.up(age); return true; });
  // cámara
  const size=n*CELL, dist=size*2.05*CAM3.zoom, p=CAM3.pitch*Math.PI/180, yw=CAM3.yaw;
  R3.cam.position.set(Math.sin(yw)*Math.cos(p)*dist, Math.sin(p)*dist, Math.cos(yw)*Math.cos(p)*dist);
  R3.cam.lookAt(0, 0, 2);
  R3.renderer.render(R3.scene, R3.cam);
}
function missileMesh(){
  const T=R3.T, g=new T.Group(), m=new T.MeshStandardMaterial({color:0x4a4f55, metalness:.7, roughness:.35});
  const body=new T.Mesh(new T.CylinderGeometry(.8,.8,6,10), m); body.rotation.x=Math.PI/2; g.add(body);
  const nose=new T.Mesh(new T.ConeGeometry(.8,2.2,10), new T.MeshStandardMaterial({color:0xd52b1e})); nose.rotation.x=Math.PI/2; nose.position.z=4.1; g.add(nose);
  for(let k=0;k<4;k++){ const fin=new T.Mesh(new T.BoxGeometry(.15,2.2,1.6), m); fin.position.z=-2.4; fin.rotation.z=k*Math.PI/2; fin.translateY(1); g.add(fin); }
  const fl=new T.Mesh(new T.ConeGeometry(.7,3,8), new T.MeshBasicMaterial({color:0xffb347, transparent:true, opacity:.9})); fl.rotation.x=-Math.PI/2; fl.position.z=-4.4; g.add(fl);
  return g;
}
const PUFFGEO={};
function puff(x, y, z, color, op, sz, life){
  const T=R3.T; if(R3.fx.length>160) return;
  const geo=PUFFGEO.s||(PUFFGEO.s=new T.SphereGeometry(1, 8, 6));
  const m=new T.Mesh(geo, new T.MeshBasicMaterial({color, transparent:true, opacity:op, depthWrite:false})); m.position.set(x,y,z); R3.scene.add(m);
  const L=life||2.4, dx=(Math.random()-.5)*1.5;
  R3.fx.push({m, t0:performance.now(), life:L, up(a){ const k=a/L, s=sz*(1+k*2.2); m.scale.set(s,s,s); m.position.y=y+a*5; m.position.x=x+dx*a; m.material.opacity=op*(1-k); }});
}
function spawnFx(x, z, res){
  const T=R3.T, now=performance.now(), sc=R3.scene, add=(m,life,up,light)=>{ sc.add(m); if(light) sc.add(light); R3.fx.push({m, t0:now, life, up, light}); };
  // onda en el agua
  const rg=new T.Mesh(new T.RingGeometry(.8, 1.4, 40), new T.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:.8, side:T.DoubleSide, depthWrite:false}));
  rg.rotation.x=-Math.PI/2; rg.position.set(x, 1.6, z);
  add(rg, 1.8, a=>{ const s=1+a*9; rg.scale.set(s,s,s); rg.material.opacity=.8*(1-a/1.8); });
  // ping en el radar
  if(R3.isRadar){ const pr=new T.Mesh(new T.RingGeometry(1.2, 1.9, 40), new T.MeshBasicMaterial({color: res==='agua'?0x8dffb4:0xff5040, transparent:true, opacity:.95, side:T.DoubleSide, depthWrite:false}));
    pr.rotation.x=-Math.PI/2; pr.position.set(x, RADAR_Y+.2, z); pr.renderOrder=6;
    add(pr, 1.4, a=>{ const s=1+a*6; pr.scale.set(s,s,s); pr.material.opacity=.95*(1-a/1.4); }); }
  // gotas o escombros que vuelan y caen
  const N=res==='agua'?60:45, pos=new Float32Array(N*3), vel=[];
  for(let k=0;k<N;k++){ const an=Math.random()*Math.PI*2, sp=res==='agua'?4+Math.random()*8:6+Math.random()*14; vel.push([Math.cos(an)*sp, (res==='agua'?18:14)+Math.random()*14, Math.sin(an)*sp]); pos[k*3]=x; pos[k*3+1]=2; pos[k*3+2]=z; }
  const pg=new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(pos,3));
  const pts=new T.Points(pg, new T.PointsMaterial({color: res==='agua'?0xeaf7ff:0x2a201a, size: res==='agua'?1.3:1.1, transparent:true, opacity:.95, depthWrite:false}));
  add(pts, 1.9, a=>{ for(let k=0;k<N;k++){ const v=vel[k]; pos[k*3]=x+v[0]*a; pos[k*3+1]=Math.max(.5, 2+v[1]*a-16*a*a); pos[k*3+2]=z+v[2]*a; } pg.attributes.position.needsUpdate=true; pts.material.opacity=.95*(1-a/1.9); });
  if(res==='agua'){
    const m=new T.Mesh(new T.CylinderGeometry(1.5, 4, 14, 14, 1, true), new T.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:.8, side:T.DoubleSide, depthWrite:false})); m.position.set(x, 7, z);
    add(m, 1.6, a=>{ m.scale.set(1+a*.8, Math.max(.01, Math.sin(Math.min(1,a/1.2)*Math.PI)*1.6), 1+a*.8); m.position.y=7*m.scale.y*.6; m.material.opacity=.8*(1-a/1.6); });
    for(let k=0;k<5;k++) setTimeout(()=>puff(x+(Math.random()-.5)*5, 3, z+(Math.random()-.5)*5, 0xffffff, .5, 2.2, 1.4), k*60);
  } else {
    const m=new T.Mesh(new T.SphereGeometry(2.4, 16, 12), new T.MeshBasicMaterial({color:0xffb030, transparent:true, opacity:.95})); m.position.set(x, 5, z);
    const light=new T.PointLight(0xff8a30, 4, 120); light.position.set(x, 12, z);
    add(m, 1.3, a=>{ const s=1+Math.min(a,.5)*9; m.scale.set(s,s,s); m.material.opacity=.95*Math.pow(1-a/1.3,.8); m.material.color.setHSL(.11-a*.05, 1, .66-a*.18); light.intensity=Math.max(0, 4-a*6); }, light);
    const core=new T.Mesh(new T.SphereGeometry(2, 12, 10), new T.MeshBasicMaterial({color:0xfff6c0, transparent:true, opacity:1, depthWrite:false})); core.position.set(x, 6, z); core.renderOrder=7;
    add(core, .55, a=>{ const s=1+a*7; core.scale.set(s,s,s); core.material.opacity=1-a/.55; });
    for(let k=0;k<10;k++) setTimeout(()=>puff(x+(Math.random()-.5)*6, 8+Math.random()*4, z+(Math.random()-.5)*6, k<3?0x4a3328:0x262626, .65, 3+Math.random()*2, 3), 450+k*80);
  }
}
function resizeStage(){
  if(!R3.ok) return;
  const st=$('#stage'), r=st.getBoundingClientRect();
  R3.renderer.setSize(r.width, r.height, false); R3.cam.aspect=r.width/Math.max(1,r.height); R3.cam.updateProjectionMatrix();
}
window.addEventListener('resize', ()=>{ if($('#game').classList.contains('on')) resizeStage(); });
function applyView(){
  const is3 = VIEW.mode==='3d' && R3.ok;
  $('#game').classList.toggle('v3d', is3);
  $('#btnView').textContent = is3 ? '🗺️ 2D' : '🧊 3D';
  if(is3){ R3.dirty=true; requestAnimationFrame(resizeStage); }
}
function toggleView(){
  if(VIEW.mode==='2d'){ if(!init3D()) return; VIEW.mode='3d'; toast('🧊 Vista 3D: tocá una casilla para apuntar y otra vez para tirar. Arrastrá para girar el mar.'); }
  else VIEW.mode='2d';
  store('naval_view', VIEW.mode); applyView(); if(V) renderGame();
}
function loop(t){
  requestAnimationFrame(loop);
  if(!V || V.phase==='lobby' || !$('#game').classList.contains('on')) return;
  if(VIEW.mode==='3d' && R3.ok && V.phase!=='place') draw3D(t);
}
requestAnimationFrame(loop);
// los tiros se animan con un timer y no con cada cuadro: así siguen aunque la pestaña esté escondida
setInterval(()=>{ if(V && V.phase!=='lobby' && $('#game').classList.contains('on')) animTick(); }, 50);
setTimeout(()=>{ if(VIEW.mode==='3d' && !init3D()) VIEW.mode='2d'; applyView(); }, 0);

/* ====================== PANEL LATERAL ====================== */
function renderSidePanels(){ if($('#tab-hist').classList.contains('on')) renderHist(); renderMesaTab(); renderReglasTab(); }
let HIST_N=0;
function renderHist(){
  if(!V) return;
  // lo que todavía no cayó no se anota
  const pend = ANIM.cur && !ANIM.landed ? ANIM.cur.at : ANIM.q.length ? ANIM.q[0].at : null;
  const L=(V.log||[]).filter(l=>pend==null || l.at<pend);
  const R=L.reverse(); const fresh=R.length-HIST_N; HIST_N=R.length;
  $('#histList').innerHTML = R.map((l,i)=>`<div class="hline ${i<fresh&&fresh<5?'new':''}">${esc(l.x)}</div>`).join('') || '<p class="muted">Todavía no hubo tiros.</p>';
}
function renderMesaTab(){
  const host=amHost(), inPlay=V.phase!=='lobby';
  const ps=V.players.map(p=>{
    const offline=!p.bot&&!p.conn&&!p.local;
    return `<div class="prow" style="border-left:5px solid ${p.color}"><span style="font-size:22px">${esc(p.emoji)}</span><span class="nm"><b>${esc(p.name)}${p.id===me()?' (vos)':''}${p.id===V.hostPid&&NET.mode!=='local'?' 👑':''}</b>
      <small>${V.opts.fmt==='eq'?TEAMS[p.team].e+' '+TEAMS[p.team].n:''}${p.bot?' · 🤖 bot':''}${p.mic?' · 🎙️':''}${offline?' · ⚠️ sin conexión':''}${inPlay&&curShooter()===p.id?' · 💣 tirando':''}</small></span>
      ${host&&p.id!==V.hostPid&&NET.mode!=='local'?`${offline&&inPlay?`<button class="btn sm gray" onclick="doAct({type:'botify',pid:'${p.id}'})" title="Que juegue un bot">🤖</button>`:''}<button class="btn sm gray" onclick="if(confirm('¿Sacar a ${esc(p.name)}?'))doAct({type:'kick',pid:'${p.id}'})" title="Sacar">✕</button>`:''}</div>`;
  }).join('');
  const obs=(V.observers||[]).map(o=>`<div class="prow"><span style="font-size:20px">${o.owner?'👑':'👀'}</span><span class="nm"><b>${esc(o.name)}${o.id===me()?' (vos)':''}</b><small>${o.owner?'dueño del juego, ':''}mirando${o.mic?' · 🎙️':''}</small></span></div>`).join('');
  const sit = NET.obs && (V.phase==='over') && V.players.length<MAXP ? `<button class="btn gold wide" onclick="doAct({type:'joinNext'})">⚓ Sumarme a jugar</button>` : NET.obs ? `<p class="muted">Te podés sumar cuando termine la partida (si hay lugar).</p>` : '';
  const info = inPlay ? `<p class="muted">${esc(fleetDef(V.opts).t)} · ${esc(TIROS[V.opts.tiros].t)} · batalla ${V.round}${V.opts.race>1?` · gana el primero a ${V.opts.race}`:''}</p>` : '';
  $('#mesaList').innerHTML = info + `<b>Jugadores (${V.players.length}/${MAXP})</b>` + ps + (obs?`<b>Mirando</b>${obs}`:'') + sit
    + (host && inPlay ? `<button class="btn dark wide" style="margin-top:8px" onclick="if(confirm('¿Terminar la partida y volver a la sala?'))doAct({type:'newGame',force:true})">⚙️ Terminar y volver a la sala</button>` : '')
    + (NET.mode!=='local'&&NET.code?`<p class="muted" style="margin-top:12px">Invitá con el código <b>${NET.code}</b> <button class="btn sm" onclick="shareRoom()">📤 Compartir</button></p>`:'');
}
function renderReglasTab(){
  const o=V.opts, host=amHost();
  $('#reglasList').innerHTML = `<p style="margin-top:0"><b>${esc(fleetDef(o).t)}</b></p>${fleetPreview(o)}
    <p><b>${esc(TIROS[o.tiros].t)}</b> — ${esc(TIROS[o.tiros].d)}</p><p class="muted">${esc(FORMATS[o.fmt])}${o.timer?` · ⏰ ${o.timer} s por tiro`:''}</p>`
    + `<b>Reglas de la casa</b>` + HOUSE.map(h=>`<div class="opt"><span><b>${o[h.k]?'✅':'❌'} ${h.t}</b><small>${h.d}</small></span></div>`).join('')
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
  const url=roomLink(), text=`¡Vení a jugar a la Batalla Naval conmigo! ⚓🇵🇾 Sala ${NET.code}`;
  if(navigator.share) return navigator.share({title:'Batalla Naval PY', text, url}).catch(()=>{});
  modal(`<h2>📤 Invitar a la sala ${NET.code}</h2><p style="word-break:break-all;user-select:all;background:#fff;padding:8px;border-radius:8px">${esc(url)}</p>
    <a class="btn green wide" style="display:block;text-align:center;text-decoration:none" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text+' '+url)}">💬 Mandar por WhatsApp</a>
    <button class="btn wide" style="margin-top:6px" onclick="navigator.clipboard.writeText('${url}').then(()=>toast('Enlace copiado'))">📋 Copiar enlace</button>
    <button class="btn gray wide" style="margin-top:6px" onclick="closeModal()">Cerrar</button>`);
}
function showRules(){
  modal(`<div class="rules"><h2>📜 Cómo se juega</h2>
  <p>Cada uno tiene un mar de casillas con letras (filas) y números (columnas). Primero cada uno pone sus barcos <b>sin que los demás los vean</b>. Después, por turnos, se tiran bombas diciendo una casilla, por ejemplo <b>B7</b>.</p>
  <ul><li><b>💧 Agua:</b> no había nada.</li><li><b>🔥 Tocado:</b> le pegaste a un barco.</li><li><b>💥 Hundido:</b> le pegaste en todas sus casillas.</li></ul>
  <p>Gana el que hunde todos los barcos del otro (en “todos contra todos”, el último que queda a flote).</p>
  <h3>🕹️ Cómo tirar</h3><ul><li>Tocá una casilla del mar enemigo para apuntar y tocala otra vez (o 💣 Fuego) para tirar.</li><li>O escribí la casilla (B7) y apretá Enter.</li><li>En la PC también: flechas para mover la mira y Enter para tirar.</li><li>Si hay varios enemigos, elegí a quién tirarle arriba o en la lista 🎯.</li></ul>
  <h3>🚢 Poner los barcos</h3><ul><li>Elegí un barco de la lista y tocá la casilla donde empieza. 🔄 (o la tecla R) lo gira.</li><li>Tocá un barco ya puesto para levantarlo y moverlo.</li><li>🎲 Al azar los pone solos; ↩️ Mi última repite tu flota anterior.</li></ul>
  <h3>🚢 Flotas</h3>${Object.keys(FLOTAS).map(k=>`<p><b>${FLOTAS[k].t}</b>: ${FLOTAS[k].ships.map(s=>s[1]+' ('+s[2]+')').join(', ')}.</p>`).join('')}
  <h3>💣 Tiros</h3>${Object.keys(TIROS).map(k=>`<p><b>${TIROS[k].t}:</b> ${TIROS[k].d}</p>`).join('')}
  <h3>🏠 Reglas de la casa</h3>${HOUSE.map(h=>`<p><b>${h.t}:</b> ${h.d}</p>`).join('')}
  <h3>👥 Equipos</h3><p>Cada equipo comparte una flota (cualquiera del equipo la puede poner) y se turnan para tirar.</p>
  </div><button class="btn wide" onclick="closeModal()">Entendido</button>`);
}
