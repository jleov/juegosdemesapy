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
    // en 3D la cámara se va al mar donde cae el misil (también al tuyo) y después vuelve
    if(VIEW.mode==='3d' && R3.ok && V.phase==='play'){ R3.follow=ANIM.cur.to; R3.followUntil=now+1100+1900; }
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
// dibuja un mar: carta náutica (flotas) o pantalla de radar (el mar al que se tira), con tiros y barcos
function seaHTML(i, kind){
  const s=V.sides[i], n=N(), d=ANIM.disp[i]||s.grid||[];
  const shipAt={};
  const ships = kind==='place' ? PL.ships() : (s.fleet||[]).filter(x=>x.r!=null && (!x.hidden));
  ships.forEach(x=>{ if(kind!=='place' && x.sunk && !sunkDisp(i,x) && !s.pids.includes(viewer()) && !(V.opts.obsVen && NET.obs)) return;
    shipCells(x).forEach(([r,c],j)=>shipAt[r*n+c]={x, j, sunk:sunkDisp(i,x)}); });
  const cur=ANIM.cur && ANIM.cur.to===i && !ANIM.landed ? ANIM.cur : null;
  const aiming = kind==='target' && myTurn() && AIM.to===i ? AIM : (REMOTE_AIM && REMOTE_AIM.to===i && V.phase==='play' && !mine(curShooter()) ? REMOTE_AIM : null);
  const ghost = kind==='place' ? PL.ghostCells() : null;
  const now=performance.now();
  // cada casilla va en su lugar fijo de la grilla, así los barcos dibujados se pueden poner encima
  const at=(r,c)=>`grid-row:${r+2};grid-column:${c+2}`;
  // el barrido del radar sigue por donde iba aunque se redibuje el mar
  let h=`<div class="sea ${kind}" style="--n:${n};--ad:-${((Date.now()%5000)/1000).toFixed(2)}s"><i class="corner" style="grid-row:1;grid-column:1"></i>`;
  for(let c=0;c<n;c++) h+=`<i class="lab${aiming&&aiming.c===c?' on':''}" style="grid-row:1;grid-column:${c+2}">${c+1}</i>`;
  const drawn=new Set();
  for(const k in shipAt){ const x=shipAt[k].x; if(drawn.has(x)) continue; drawn.add(x);
    h+=`<div class="shipimg ${x.dir}${shipAt[k].sunk?' sunk':''}${kind==='place'&&PL.sel===x.i?' sel':''}" style="grid-row:${x.r+2} / span ${x.dir==='v'?x.l:1};grid-column:${x.c+2} / span ${x.dir==='h'?x.l:1}">${shipSVG(x.k, x.l, x.dir)}</div>`; }
  // el barco que se está por poner, medio transparente
  if(ghost && ghost.fits){ const g=ghost.ship; h+=`<div class="shipimg ghost ${ghost.ok?'':'bad'}" style="grid-row:${g.r+2} / span ${g.dir==='v'?g.l:1};grid-column:${g.c+2} / span ${g.dir==='h'?g.l:1}">${shipSVG(g.k, g.l, g.dir)}</div>`; }
  for(let r=0;r<n;r++){
    h+=`<i class="lab${aiming&&aiming.r===r?' on':''}" style="grid-row:${r+2};grid-column:1">${LETRAS[r]}</i>`;
    for(let c=0;c<n;c++){
      const k=r*n+c, g=d[k]||0, sa=shipAt[k];
      let cls='cell';
      if(sa) cls+=' ship';
      if(g===1) cls+=' miss'; else if(g===4) cls+=' auto'; else if(g===2) cls+=' hit'; else if(g===3) cls+=' hit dead';
      if(cur && cur.r===r && cur.c===c) cls+=' incoming';
      if(aiming && aiming.r!=null){ if(aiming.r===r && aiming.c===c) cls+=' aim'; else if(aiming.r===r || aiming.c===c) cls+=' aimrc'; }
      if(ghost && ghost.cells.some(([y,x])=>y===r&&x===c)) cls+= ghost.ok ? ' gok' : ' gbad';
      h+=`<button class="${cls}" style="${at(r,c)}" data-r="${r}" data-c="${c}" aria-label="${coordTxt(r,c)}"></button>`;
    }
  }
  // chapuzón o explosión del tiro que acaba de caer (sigue por donde iba si el mar se redibuja)
  BOOM.forEach(b=>{ const age=now-b.t; if(b.to!==i || age>1100) return;
    h+=`<i class="fx ${b.res==='agua'?'splash':'boom'}" style="${at(b.r,b.c)};--fd:-${Math.round(age)}ms"><b></b><b></b><b></b></i>`; });
  return h+'</div>';
}
/* ---------- dibujo de los barcos (vistos desde arriba, la proa a la derecha) ---------- */
(function(){   // los degradés se definen una sola vez y los usan todos los barcos
  const d=document.createElement('div'); d.style.cssText='position:absolute;width:0;height:0;overflow:hidden';
  const lg=(id, st)=>`<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${st.map(([o,c])=>`<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;
  d.innerHTML=`<svg width="0" height="0" aria-hidden="true"><defs>
    ${lg('nvHull',[[0,'#4f5c68'],[.28,'#9aa8b4'],[.5,'#c9d2da'],[.72,'#9aa8b4'],[1,'#4f5c68']])}
    ${lg('nvHullW',[[0,'#8d979f'],[.28,'#e2e8ec'],[.5,'#ffffff'],[.72,'#e2e8ec'],[1,'#8d979f']])}
    ${lg('nvHullD',[[0,'#101417'],[.5,'#3d4850'],[1,'#101417']])}
    ${lg('nvSub',[[0,'#10151a'],[.42,'#5b6975'],[.6,'#46535e'],[1,'#10151a']])}
    ${lg('nvWood',[[0,'#86603a'],[.5,'#c79a63'],[1,'#86603a']])}
    ${lg('nvDeck',[[0,'#8e99a3'],[.5,'#bcc6ce'],[1,'#8e99a3']])}
    <radialGradient id="nvSteel" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#b9c4cd"/><stop offset="1" stop-color="#4c5863"/></radialGradient>
  </defs></svg>`;
  document.body.appendChild(d);
})();
const SHIPCACHE={};
function shipSVG(k, l, dir){
  const key=k+l+dir; if(SHIPCACHE[key]) return SHIPCACHE[key];
  const W=l*100, f=n=>+n.toFixed(1);
  const hull=(y0,y1,bow,fill,st)=>{ const rr=9, s=6+rr; bow=Math.min(bow, W*.42);
    return `<path d="M${s},${y0} L${f(W-bow)},${y0} Q${f(W-bow*.35)},${f(y0+(50-y0)*.2)} ${W-5},50 Q${f(W-bow*.35)},${f(y1-(y1-50)*.2)} ${f(W-bow)},${y1} L${s},${y1} Q6,${y1} 6,${y1-rr} L6,${y0+rr} Q6,${y0} ${s},${y0} Z" fill="${fill}" stroke="${st||'#1c2730'}" stroke-width="3" stroke-linejoin="round"/>`; };
  const deck=(y0,y1,bow,fill)=>{ bow=Math.min(bow, W*.46); return `<path d="M17,${y0} L${f(W-bow)},${y0} Q${f(W-bow*.5)},${f(y0+(50-y0)*.3)} ${W-22},50 Q${f(W-bow*.5)},${f(y1-(y1-50)*.3)} ${f(W-bow)},${y1} L17,${y1} Z" fill="${fill}"/>`; };
  const planks=(x0,x1,y0,y1)=>{ let s=''; for(let y=y0+6;y<y1-2;y+=7) s+=`<line x1="${f(x0)}" y1="${y}" x2="${f(x1)}" y2="${y}" stroke="#6d4c2a" stroke-width="1" opacity=".55"/>`; return s; };
  const turret=(x,dr,r,two)=>{ const b=y=>`<rect x="${f(dr>0?x:x-r*2.5)}" y="${f(y-2.6)}" width="${f(r*2.5)}" height="5.2" rx="2.4" fill="#2a333b"/>`;
    return (two?b(50-r*.42)+b(50+r*.42):b(50))+`<circle cx="${f(x)}" cy="50" r="${r}" fill="url(#nvSteel)" stroke="#1f2932" stroke-width="2"/><circle cx="${f(x-dr*r*.25)}" cy="50" r="${f(r*.34)}" fill="#39434c"/>`; };
  const funnel=(x,r,col)=>`<ellipse cx="${f(x+2)}" cy="53" rx="${f(r*1.25)}" ry="${r}" fill="rgba(0,0,0,.3)"/><ellipse cx="${f(x)}" cy="50" rx="${f(r*1.25)}" ry="${r}" fill="${col}" stroke="#1a2127" stroke-width="2"/><ellipse cx="${f(x)}" cy="50" rx="${f(r*.7)}" ry="${f(r*.55)}" fill="#111518"/>`;
  const flag=(x,y)=>`<g transform="translate(${f(x)},${y})"><rect width="15" height="6" fill="#d52b1e"/><rect y="6" width="15" height="6" fill="#fff"/><rect y="12" width="15" height="6" fill="#0038a8"/><rect width="15" height="18" fill="none" stroke="#151515" stroke-width="1"/></g>`;
  const house=(x,w,y0,y1,fill)=>`<rect x="${f(x+2.5)}" y="${y0+3}" width="${f(w)}" height="${y1-y0}" rx="5" fill="rgba(0,0,0,.3)"/><rect x="${f(x)}" y="${y0}" width="${f(w)}" height="${y1-y0}" rx="5" fill="${fill}" stroke="#25313a" stroke-width="2"/>`;
  const glass=(x,w,y0,y1)=>`<rect x="${f(x)}" y="${y0}" width="${f(w)}" height="${y1-y0}" rx="2.5" fill="#5fa8d8" stroke="#1d3a52" stroke-width="1.2"/>`;
  let body='';
  if(k==='sub'){
    const ry=l>1?20:23, sx=W*.5, sw=Math.max(24, W*.12);
    body=`<path d="M10,50 L-1,37 L3,50 L-1,63 Z" fill="#1c242b"/>
      <ellipse cx="${W/2}" cy="50" rx="${W/2-7}" ry="${ry}" fill="url(#nvSub)" stroke="#0e1317" stroke-width="3"/>
      <ellipse cx="${f(W*.52)}" cy="43" rx="${f(W/2-26)}" ry="4.5" fill="#fff" opacity=".13"/>
      ${l>1?`<rect x="${f(W*.74)}" y="26" width="9" height="48" rx="4" fill="#232c33"/>`:''}
      <rect x="${f(sx-sw/2+2)}" y="42" width="${f(sw)}" height="22" rx="11" fill="rgba(0,0,0,.35)"/>
      <rect x="${f(sx-sw/2)}" y="39" width="${f(sw)}" height="22" rx="11" fill="#28323a" stroke="#0e1317" stroke-width="2"/>
      <circle cx="${f(sx+sw*.18)}" cy="50" r="3.5" fill="#8a97a2"/><circle cx="${f(sx-sw*.2)}" cy="50" r="2" fill="#0e1317"/>`;
  } else if(k==='porta'){
    body=hull(9,91,58,'url(#nvHull)')
      + `<path d="M13,15 L${W-70},15 L${W-34},50 L${W-70},85 L13,85 Z" fill="#3a434a"/>
      <path d="M13,15 L${W-70},15 L${W-34},50 L${W-70},85 L13,85 Z" fill="none" stroke="#e9eef2" stroke-width="1.6" opacity=".7"/>
      <line x1="26" y1="45" x2="${W-62}" y2="45" stroke="#f4f6f8" stroke-width="2.6" stroke-dasharray="15 11"/>
      <line x1="30" y1="26" x2="${f(W*.6)}" y2="66" stroke="#f2c14e" stroke-width="2.4" opacity=".9"/>
      <rect x="${f(W*.2)}" y="62" width="34" height="18" fill="none" stroke="#cfd6dc" stroke-width="1.4" opacity=".7"/>
      ${house(W*.56,62,69,88,'#d5dce2')}${glass(W*.56+40,16,72,85)}
      <circle cx="${f(W*.56+18)}" cy="78" r="5" fill="#2a333b"/>
      ${[[.14,30],[.3,30],[.74,58]].map(([fx,y])=>`<path transform="translate(${f(W*fx)},${y})" d="M18,0 L4,-3 L1,-12 L-3,-12 L-2,-3 L-10,-2.4 L-12,-6 L-14,-6 L-13,0 L-14,6 L-12,6 L-10,2.4 L-2,3 L-3,12 L1,12 L4,3 Z" fill="#c4ced6" stroke="#20292f" stroke-width="1"/>`).join('')}`
      + flag(16,56);
  } else if(k==='remo'){
    body=hull(17,83,54,'url(#nvHullD)','#0b0e10') + deck(25,75,62,'url(#nvWood)') + planks(20,W-70,25,75)
      + [.12,.3,.48,.64].map(fx=>`<circle cx="${f(W*fx)}" cy="17" r="6" fill="#0d0f11" stroke="#333" stroke-width="1.5"/><circle cx="${f(W*fx)}" cy="83" r="6" fill="#0d0f11" stroke="#333" stroke-width="1.5"/>`).join('')
      + `<rect x="24" y="43" width="14" height="14" rx="3" fill="#39434c" stroke="#111" stroke-width="1.5"/>`
      + funnel(W*.3, 12, '#c0392b') + house(W*.42, W*.24, 31, 69, '#c0392b') + `<rect x="${f(W*.42+5)}" y="36" width="${f(W*.24-10)}" height="28" rx="3" fill="#d94a3a"/>` + glass(W*.66-3, 9, 35, 65)
      + flag(44, 41);
  } else if(k==='lancha'){
    body=hull(23,77,80,'url(#nvHullW)','#0c2f7a') + deck(30,70,90,'url(#nvWood)') + planks(20,W-90,30,70)
      + `<rect x="14" y="40" width="16" height="20" rx="3" fill="#2a333b"/>`
      + house(W*.3, W*.2, 34, 66, '#f4f6f8') + glass(W*.5-2, 9, 36, 64) + `<rect x="${f(W*.3+4)}" y="38" width="${f(W*.2-14)}" height="24" rx="3" fill="#c0392b"/>`
      + turret(W*.7, 1, 8, false) + flag(34, 41);
  } else {
    // acorazados, cruceros, destructores, patrulleros y cañoneros del río: puente, chimeneas y cañones según el largo
    const river = k==='canpy'||k==='canhu', big = k==='acor'||river;
    const [y0,y1] = k==='acor'?[15,85] : river?[17,83] : k==='cruc'?[19,81] : [22,78];
    const fc = river?'#d8b25e':'#6f7b86';
    body=hull(y0,y1,l>2?70:56, river?'url(#nvHullW)':'url(#nvHull)') + deck(y0+7,y1-7,l>2?84:68, river?'url(#nvWood)':'url(#nvDeck)') + (river?planks(20,W-90,y0+7,y1-7):'');
    if(l>=4) body+=turret(W*.83, 1, big?12:10, true) + turret(W*.7, 1, big?11:9, true) + turret(W*.14, -1, big?12:10, true);
    else if(l===3) body+=turret(W*.8, 1, 10, k==='cruc') + turret(W*.16, -1, 9, false);
    else body+=turret(W*.72, 1, 9, false);
    const hx=l>2?W*.4:W*.24, hw=l>2?W*.2:W*.3;
    if(l>=3) body+=funnel(hx-18, big?12:10, fc);
    if(l>=5 || k==='acor') body+=funnel(hx-48, big?11:9, fc);
    body+=house(hx, hw, y0+14, y1-14, river?'#f4f6f8':'#dfe5ea') + `<rect x="${f(hx+hw*.28)}" y="${y0+19}" width="${f(hw*.5)}" height="${y1-y0-38}" rx="3" fill="${river?'#e2e7ea':'#c4cdd5'}" stroke="#25313a" stroke-width="1.2"/>`
      + glass(hx+hw-7, 6, y0+18, y1-18) + `<circle cx="${f(hx+hw*.5)}" cy="50" r="3.2" fill="#1c242b"/><line x1="${f(hx+hw*.5)}" y1="40" x2="${f(hx+hw*.5)}" y2="60" stroke="#1c242b" stroke-width="1.6"/>`;
    if(k==='patru') body+=`<rect x="${f(W*.12)}" y="40" width="26" height="20" rx="4" fill="#e9692c" stroke="#333" stroke-width="1.5"/>`;
    body+=flag(l>=4?W*.14+22:l===3&&k!=='patru'?W*.16+18:12, y0+ (l>2?8:16));
  }
  const svg = dir==='v'
    ? `<svg viewBox="0 0 100 ${W}" preserveAspectRatio="none"><g transform="rotate(90) translate(0,-100)">${body}</g></svg>`
    : `<svg viewBox="0 0 ${W} 100" preserveAspectRatio="none">${body}</svg>`;
  return SHIPCACHE[key]=svg;
}
function renderBoards(){
  if(!V || V.phase==='lobby') return;
  if(V.phase==='place') return renderPlace();
  const big=bigSide(), small=smallSide(), m=mySide();
  for(const id of ['#seaBig','#seaSmall']) $(id).style.setProperty('--n', N());
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
    const F=this.F(), k=F.ships[this.sel][0], l=F.ships[this.sel][2], n=F.n; let r=this.hover.r, c=this.hover.c;
    // igual que al tocar: si se sale por el borde, se corre para adentro
    if(this.dir==='h' && c+l>n) c=n-l; if(this.dir==='v' && r+l>n) r=n-l;
    const s={k, l, r, c, dir:this.dir}, try_=this.list.slice(); try_[this.sel]={r, c, dir:this.dir};
    return {cells:shipCells(s), ok:!partialError(try_, V.opts), ship:s, fits:true};
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
  $('#placeBox').style.setProperty('--n', N());
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
  const F=PL.F(), done=PL.list.filter(Boolean).length, tot=F.ships.length;
  const chips=F.ships.map(([k,n,l],i)=>`<button class="chip ${PL.sel===i?'sel':''} ${PL.list[i]?'done':''}" onclick="PL.pick(${i})"><b>${esc(n)}</b><small>${l} casilla${l===1?'':'s'}</small><span class="mini" style="--l:${l}">${shipSVG(k, l, 'h')}</span></button>`).join('');
  const help = PL.sel!=null ? `Ubicando: <b>${esc(F.ships[PL.sel][1])}</b> (${F.ships[PL.sel][2]} casilla${F.ships[PL.sel][2]===1?'':'s'}, ${PL.dir==='h'?'acostado ↔':'parado ↕'}). Tocá la casilla del mar donde empieza.`
    : done===tot ? '¡Flota completa! Tocá un barco del mar si querés moverlo, o <b>✅ ¡Listo!</b> para empezar.' : 'Tocá un barco del mar para moverlo, o elegí uno de la lista.';
  $('#placeBox').innerHTML=`<div class="seat">🚢 Poné tus barcos${V.opts.toca===false?' <small>(no se pueden tocar entre sí)</small>':''}</div>
    <div class="placewrap">${seaHTML(m,'place')}
    <div class="ppanel"><div class="pprog">⚓ ${done} de ${tot} barcos<i><b style="width:${Math.round(done/tot*100)}%"></b></i></div>
      <div class="chips">${chips}</div>
      <p class="muted">${help}</p>
      <div class="row wrap"><button class="btn sm" onclick="PL.rotate()">🔄 Girar ${PL.dir==='h'?'↕':'↔'}</button><button class="btn sm gold" onclick="PL.random()">🎲 Al azar</button><button class="btn sm gray" onclick="PL.last()">↩️ Mi última</button><button class="btn sm gray" onclick="PL.clear()">🧹 Sacar todos</button></div>
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

/* El mar en 3D está en mar3d.js */
// los tiros se animan con un timer y no con cada cuadro: así siguen aunque la pestaña esté escondida
setInterval(()=>{ if(V && V.phase!=='lobby' && $('#game').classList.contains('on')) animTick(); }, 50);

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
