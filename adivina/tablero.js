'use strict';
/* =====================================================================
   Adivina Quién PY — pantallas: sala de espera, tablero 2D (cartas) y
   3D (las fichas se bajan como en el juego de mesa), preguntas, arriesgar,
   fin de ronda y el editor de personajes propios (foto → caricatura).
   ===================================================================== */
let GUESS=false;            // modo "arriesgar": la próxima carta que toques es tu apuesta
let VIEWPID=null;           // los que miran eligen qué tablero ver
const CAT_ORDER=['fut','his','pol','far','inf','mio'];

/* ====================== RENDER GENERAL ====================== */
function render(){
  if(!S) return;
  V = NET.mode==='client' ? S : publicState(me());
  if(V.phase==='lobby'){ show('lobby'); renderLobby(); }
  else { show('game'); renderGame(); }
  renderSidePanels(); renderChatTo(); renderVoice(); voiceSync(); musicSync(); events();
}
const isPlayer = () => !!V && V.players.some(p=>p.id===me());
const oppOf = pid => (V.players.find(p=>p.id!==pid)||{}).id;
const VPn = pid => { const p=V.players.find(x=>x.id===pid); return p ? `${p.emoji} ${p.name}` : '?'; };
const leftV = pid => V.board.filter(id=>!((V.down||{})[pid]||[]).includes(id));
function playerTag(p){
  const host=p.id===V.hostPid;
  return `<span class="dot" style="background:${p.color}"></span><span style="font-size:20px">${esc(p.emoji)}</span><span class="nm">${esc(p.name)}${p.id===me()?' <span class="muted">(vos)</span>':''}</span>`
    + `${host&&NET.mode!=='local'?'👑':''}${p.bot?'🤖':''}${p.mic?'🎙️':''}${!p.bot&&!p.conn?'⚠️':''}`;
}
function fotoOf(c){ return c ? (c.foto||'') : ''; }

// ---------- sala de espera ----------
function renderLobby(){
  const host=amHost(), myObs=!!NET.obs;
  $('#lobbyCode').textContent=NET.code||'—';
  $('#lobbyCodeBox').style.display = NET.mode==='local' ? 'none' : '';
  $('#lobbyTitle').textContent = NET.mode==='local' ? '🤖 Contra el bot' : '🕵️ Sala de espera';
  $('#pcount').textContent=`(${V.players.length}/${MAXP})`;
  $('#plist').innerHTML=V.players.map(p=>`<li>${playerTag(p)}${host && p.id!==V.hostPid?`<button class="btn sm gray" onclick="doAct({type:'kick',pid:'${p.id}'})" title="Sacar">✕</button>`:''}</li>`).join('')
    + (V.observers||[]).map(x=>`<li style="opacity:.75"><span style="font-size:20px">👀</span><span class="nm">${esc(x.name)} <span class="muted">mirando</span></span>${x.mic?'🎙️':''}</li>`).join('');
  const err=(()=>{ const keep=S; S=V; try{ return canStart(); } finally{ S=keep; } })();
  $('#lobbyHostBtns').innerHTML = host
    ? `<div class="row">${V.players.length<MAXP?`<button class="btn gray" onclick="doAct({type:'addBot'})">🤖 Sumar bot</button>`:''}
       <button class="btn green" onclick="doAct({type:'start'})">▶️ Empezar</button></div>
       <p class="muted">${err?'⚠️ '+esc(err):'¡Listo para empezar!'} Juegan 2; los demás que entren miran 👀 (sin ver los personajes secretos).</p>`
    : `<p class="muted" style="text-align:center">⏳ Esperando que el anfitrión 👑 empiece la partida…</p>`;
  $('#lobbyObs').innerHTML = myObs ? `<div class="obsbar" style="border-radius:10px;margin-top:8px">👀 Estás mirando. ${V.players.length<MAXP?`<button class="btn sm gold" onclick="doAct({type:'joinNext'})">🪑 Sentarme a jugar</button>`:'Ya hay 2 jugadores.'}</div>` : '';
  $('#optsBox').innerHTML = optsHTML(host);
  const g=$('#grulesBox');
  if(host){
    if(!g.querySelector('textarea')) g.innerHTML=`<textarea id="grulesIn" maxlength="1200" placeholder="Ej.: no vale preguntar por el nombre&#10;El que pierde ceba el tereré 🧉"></textarea><p class="muted" style="margin:4px 0 0">Se guarda solo y lo ven todos.</p>`;
    const ta=$('#grulesIn'); if(document.activeElement!==ta) ta.value=V.grules||'';
    ta.oninput=()=>{ clearTimeout(ta.t); ta.t=setTimeout(()=>doAct({type:'grules', text:ta.value}), 600); };
  } else g.innerHTML = V.grules ? `<div class="grules">${esc(V.grules)}</div>` : `<p class="muted">El anfitrión todavía no escribió reglas propias.</p>`;
  $('#sugBox').innerHTML = sugsHTML(host);
}
function catCount(c){ return c==='mio' ? Object.values(MIOS).filter(p=>p.cat==='mio').length : PERSONAJES.filter(p=>p.cat===c).length + Object.values(MIOS).filter(p=>p.cat===c).length; }
function optsHTML(host){
  const o=V.opts, dis = host && V.phase==='lobby' ? '' : 'disabled';
  const sel=(k, list)=>`<select ${dis} onchange="doAct({type:'opt',k:'${k}',v:this.value})">${list.map(x=>`<option value="${x.v}" ${o[k]==x.v?'selected':''}>${x.t}</option>`).join('')}</select>`;
  const chk=(k, t, d)=>`<label class="opt" style="margin:0 0 6px;font-weight:400"><input type="checkbox" ${o[k]?'checked':''} ${dis} onchange="doAct({type:'opt',k:'${k}',v:this.checked})"><span><b>${t}</b><small>${d}</small></span></label>`;
  const nm=Object.keys(MIOS).length;
  return `<label style="margin-top:0">Personajes ${host?'':'<span class="muted">(los elige el anfitrión)</span>'}</label>
    <div class="cats">${CAT_ORDER.filter(c=>c!=='mio' || nm).map(c=>`<label class="catb ${o.cats.includes(c)?'on':''}" style="--cc:${CATS[c].c}"><input type="checkbox" ${o.cats.includes(c)?'checked':''} ${dis} onchange="doAct({type:'opt',k:'cat',v:'${c}'})">${CATS[c].e} ${CATS[c].n} <small>${catCount(c)}</small></label>`).join('')}</div>
    ${nm?chk('mios', `⭐ Sumar los personajes agregados por el anfitrión (${nm})`, 'Entran los de las categorías elegidas y los que están en “Agregados”.'):''}
    ${host?`<button class="btn sm gold" style="margin:2px 0 4px" onclick="openMios()">⭐ Agregar personajes con foto</button>`:''}
    <label>Tamaño del tablero</label>${sel('n', SIZES)}
    <label>Personaje secreto</label>${sel('pick', Object.keys(PICKS).map(k=>({v:k,t:PICKS[k]})))}
    <label>Si alguien arriesga mal</label>${sel('wrong', Object.keys(WRONGS).map(k=>({v:k,t:WRONGS[k]})))}
    <label>Duración</label>${sel('race', RACES)}
    <label>Nivel del bot</label>${sel('bot', BOTLV)}
    <label>Ayudas</label>
    ${chk('libres','✍️ Preguntas escritas','Además de las de la lista, se puede escribir cualquier pregunta y la contesta el otro jugador (Sí / No / No sé).')}
    ${chk('ayuda','🪄 Botón “Bajar los que no son”','Después de una pregunta de la lista, baja solas las cartas que ya no pueden ser.')}`;
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
// de quién es el tablero que se ve de frente
function boardPid(){
  if(isPlayer()) return me();
  if(!VIEWPID || !V.players.some(p=>p.id===VIEWPID)) VIEWPID=(V.players[0]||{}).id;
  return VIEWPID;
}
function switchView(){ VIEWPID=oppOf(boardPid()); render(); }
function renderGame(){
  $('#roomTag').textContent = NET.mode==='local' ? '🤖 Contra el bot' : '🔑 '+NET.code;
  const bp=boardPid();
  $('#obsbar').style.display = NET.obs ? 'flex' : 'none';
  if(NET.obs) $('#obsbar').innerHTML = `<span>👀 Estás mirando: no ves los personajes secretos. Tablero de <b>${esc(VPn(bp))}</b></span><button class="btn sm gold" onclick="switchView()">🔄 Ver el del otro</button>`;
  if(V.phase!=='play') GUESS=false;
  renderScore(); renderCtrl();
  if(VIEW.mode==='3d') { if(R3.ok) sync3D(); } else render2D();
}
function renderScore(){
  $('#score').innerHTML = V.players.map(p=>{
    const turn = V.phase==='play' && V.cur===p.id, picking = V.phase==='pick';
    const ok = picking ? ((V.picked||[]).includes(p.id) ? '✅ eligió' : '🤔 eligiendo…') : `🃏 le quedan <b>${leftV(p.id).length}</b>`;
    return `<div class="sc ${turn?'on':''}" style="--pc:${p.color}"><div class="nms">${esc(p.emoji)} ${esc(p.name)}${p.id===me()?' (vos)':''}${p.bot?' 🤖':''}${!p.bot&&!p.conn?' ⚠️':''}${p.mic?' 🎙️':''}</div>
      <div class="ex"><span>${ok}</span><span class="wins">${'🏆'.repeat(V.wins[p.id]||0)}${V.opts.race>1?`<small> ${V.wins[p.id]||0}/${V.opts.race}</small>`:''}</span></div></div>`;
  }).join('');
}
function miniCard(id, label){
  const c=CH(id); if(!c) return '';
  return `<button class="mini" onclick="infoCard('${id}')"><img src="${esc(fotoOf(c))}" alt=""><span><small>${label}</small><b>${esc(c.n)}</b></span></button>`;
}
function lastQ(){
  const q=V.q; if(!q) return '';
  return `<div class="lq"><small>${esc(VPn(q.by))} preguntó:</small> <b>${esc(q.text)}</b> ${q.ans?`<span class="ans ${q.ans}">${ANS[q.ans]}</span>`:'<span class="ans wait">⏳</span>'}</div>`;
}
function renderCtrl(){
  const el=$('#ctrl'), my=me(), pl=isPlayer(), mySec=(V.sec||{})[my];
  let h='';
  if(V.phase==='pick'){
    if(pl && !mySec) h=`<div class="msgline">👆 <b>Tocá la carta de tu personaje secreto.</b> El otro no lo va a ver.</div><div class="btns"><button class="btn gold" onclick="randomPick()">🎲 Elegir al azar</button></div>`;
    else if(pl) h=`<div class="btns">${miniCard(mySec,'Tu personaje secreto')}<div class="msgline">⏳ Esperando que ${esc(VPn(oppOf(my)))} elija el suyo…</div></div>`;
    else h=`<div class="msgline">🤔 Los jugadores están eligiendo su personaje secreto…</div>`;
  } else if(V.phase==='play'){
    const myTurn = pl && V.cur===my, opp=oppOf(my);
    const sec = pl && mySec ? miniCard(mySec,'Tu personaje') : '';
    if(GUESS && myTurn) h=`<div class="msgline guessline">🎯 <b>Tocá la carta del personaje que creés que tiene ${esc(VPn(opp))}.</b>${V.opts.wrong==='pierde'?' Si te equivocás, perdés la ronda.':''}</div><div class="btns"><button class="btn gray" onclick="setGuess(false)">Cancelar</button></div>`;
    else if(myTurn && V.stage==='ask') h=`<div class="btns">${sec}<div class="msgline"><b>🙋 ¡Te toca preguntar!</b>${V.q?'':''}</div></div>
      <div class="btns"><button class="btn green big" onclick="askModal()">❓ Preguntar</button><button class="btn red big" onclick="setGuess(true)">🎯 Arriesgar</button></div>`;
    else if(myTurn && V.stage==='answer') h=`<div class="btns">${sec}${lastQ()}</div><div class="msgline">⏳ Esperando que ${esc(VPn(opp))} conteste…</div>`;
    else if(myTurn && V.stage==='flip') h=`<div class="btns">${sec}${lastQ()}</div><div class="msgline">Bajá las cartas que ya no pueden ser (tocalas).</div>
      <div class="btns">${V.opts.ayuda && V.q && V.q.k?`<button class="btn gold" onclick="doAct({type:'autoFlip'})">🪄 Bajar los que no son</button>`:''}<button class="btn red" onclick="setGuess(true)">🎯 Arriesgar</button><button class="btn green" onclick="doAct({type:'endTurn'})">✅ Listo, paso el turno</button></div>`;
    else if(pl && V.stage==='answer' && V.q && V.q.to===my) h=`<div class="btns">${sec}<div class="lq big"><small>${esc(VPn(V.q.by))} te pregunta:</small> <b>${esc(V.q.text)}</b></div></div>
      <div class="btns"><button class="btn green big" onclick="doAct({type:'answer',a:'si'})">✅ Sí</button><button class="btn red big" onclick="doAct({type:'answer',a:'no'})">❌ No</button><button class="btn gray" onclick="doAct({type:'answer',a:'nose'})">🤷 No sé</button></div>
      <p class="muted" style="text-align:center;margin:2px">Contestá la verdad mirando a tu personaje 😉</p>`;
    else h=`<div class="btns">${sec}${lastQ()}</div><div class="msgline">⏳ Turno de ${esc(VPn(V.cur))}${V.stage==='answer'?' (esperando la respuesta)':''}.${pl?' Mientras tanto podés bajar o levantar tus cartas.':''}</div>`;
  } else {
    const w=V.roundWin;
    h=`<div class="msgline">${w?`🏆 ${esc(VPn(w.pid))} ganó la ronda.`:''} <button class="btn sm gold" onclick="endModal(true)">Ver cómo terminó</button></div>`;
  }
  el.innerHTML=h;
  $('#stage').classList.toggle('guess', GUESS);
}
function setGuess(on){ GUESS=on; if(on) toast('🎯 Tocá la carta que creés que es.'); renderCtrl(); if(VIEW.mode==='2d') render2D(); }
function randomPick(){ const l=V.board; doAct({type:'pick', id:l[rnd(l.length)]}); }

// tocaron una carta (en 2D o en 3D)
function cardTap(id, pidBoard){
  if(!V || V.phase==='lobby') return;
  const pl=isPlayer(), my=me();
  if(!pl || pidBoard!==my) return infoCard(id);
  if(V.phase==='pick'){
    if((V.sec||{})[my]) return infoCard(id);
    const c=CH(id);
    return modal(`<div class="info">${cardInfoHTML(c)}</div><div class="row"><button class="btn gray" onclick="closeModal()">Volver</button><button class="btn green" onclick="closeModal();doAct({type:'pick',id:'${id}'})">🤫 Elegir a ${esc(c.n.split(' ')[0])}</button></div>`);
  }
  if(V.phase!=='play') return infoCard(id);
  if(GUESS){
    if(V.cur!==my){ GUESS=false; return renderCtrl(); }
    const c=CH(id);
    return modal(`<div class="info">${cardInfoHTML(c)}</div><h2 style="text-align:center">🎯 ¿Arriesgás que es ${esc(c.n)}?</h2>${V.opts.wrong==='pierde'?'<p class="muted" style="text-align:center">Si no es, perdés la ronda.</p>':''}
      <div class="row"><button class="btn gray" onclick="closeModal()">No, todavía no</button><button class="btn red" onclick="closeModal();GUESS=false;doAct({type:'guess',id:'${id}'})">🎯 ¡Sí, es este!</button></div>`);
  }
  sfx.flip(); doAct({type:'flip', id});
}
function cardInfoHTML(c){
  if(!c) return '';
  const rs=String(c.r||'').split(',').filter(Boolean).map(k=>RASGOS.find(r=>r.k===k)).filter(Boolean);
  const cat=CATS[c.cat]||CATS.mio;
  return `<img class="big" src="${esc(fotoOf(c))}" alt=""><div><h2 style="margin:4px 0">${esc(c.n)}</h2>
    <div class="chip" style="background:${cat.c}">${cat.e} ${cat.n}</div> ${c.nac?`<span class="muted">Nació en ${c.nac}${c.fin?` · murió en ${c.fin}`:''}</span>`:''}
    <p>${esc(c.bio||'')}</p>${rs.length?`<div class="tags">${rs.map(r=>`<span>${r.t}</span>`).join('')}</div>`:''}</div>`;
}
function infoCard(id){ const c=CH(id); if(!c) return; modal(`<div class="info">${cardInfoHTML(c)}</div><button class="btn wide" onclick="closeModal()">Cerrar</button>`); }

// ---------- preguntar ----------
function askModal(){
  const mine=(V.qs||[]).filter(q=>q.by===me() && q.k), done={}; mine.forEach(q=>done[q.k]=q.ans);
  const btn=q=>`<button class="qb ${done[q.k]?'done '+done[q.k]:''}" onclick="closeModal();doAct({type:'ask',k:'${q.k}'})">${esc(q.q)}${done[q.k]?` <i>${ANS[done[q.k]]}</i>`:''}</button>`;
  const foto=RASGOS.filter(r=>r.foto), quien=[...RASGOS.filter(r=>!r.foto), ...PREG_EXTRA];
  modal(`<h2>❓ ¿Qué querés preguntar?</h2>
    ${V.opts.libres?`<div class="row" style="margin-bottom:10px"><input type="text" id="freeQ" maxlength="160" placeholder="Escribí tu pregunta… (la contesta ${esc(VPn(oppOf(me())))})" onkeydown="if(event.key==='Enter')sendFree()"><button class="btn" style="flex:0 0 auto" onclick="sendFree()">Preguntar</button></div>`:''}
    <p class="muted" style="margin:0 0 6px">Las de la lista las contesta el juego, sin trampa:</p>
    <h3>👀 Cómo se ve en la foto</h3><div class="qgrid">${foto.map(btn).join('')}</div>
    <h3>🕵️ Quién es</h3><div class="qgrid">${quien.map(btn).join('')}</div>
    <button class="btn gray wide" style="margin-top:10px" onclick="closeModal()">Cerrar</button>`);
}
function sendFree(){ const i=$('#freeQ'), t=i.value.trim(); if(t.length<3) return toast('Escribí la pregunta.'); closeModal(); doAct({type:'askFree', text:t}); }

// ---------- avisos (sonidos, cartel, fin de ronda) ----------
const EV={q:null, cur:null, phase:null, round:null};
function events(){
  if(!V) return;
  const qk = V.phase==='play' && V.q ? V.q.n+'|'+V.q.ans : null;
  if(qk && qk!==EV.q){
    const q=V.q;
    if(!q.ans){ if(q.to===me()){ sfx.ask(); if(!document.hasFocus || true) toast(`❓ ${VPn(q.by)} te pregunta: ${q.text}`); } }
    else { (q.ans==='si'?sfx.yes:q.ans==='no'?sfx.no:sfx.ask)(); banner(`${q.text} → ${ANS[q.ans]}`, q.ans); }
  }
  EV.q=qk;
  if(V.phase==='play' && V.cur!==EV.cur && V.cur===me() && isPlayer()){ sfx.turn(); yourTurn(); }
  EV.cur = V.phase==='play' ? V.cur : null;
  if((V.phase==='roundEnd'||V.phase==='over') && (EV.phase!==V.phase || EV.round!==V.round)){ const w=V.roundWin && V.roundWin.pid===me(); if(isPlayer()) (w?sfx.win:sfx.lose)(); else sfx.win(); setTimeout(()=>endModal(), 600); }
  if((V.phase==='play'||V.phase==='pick') && (EV.phase==='roundEnd'||EV.phase==='over')) closeModal();
  if(V.phase==='pick' && EV.phase!=='pick' && isPlayer()) toast('🃏 Elegí tu personaje secreto tocando una carta.');
  EV.phase=V.phase; EV.round=V.round;
}
function banner(t, cls){ const b=$('#banner'); b.className='banner '+(cls||''); b.textContent=t; b.style.display='block'; clearTimeout(banner.t); banner.t=setTimeout(()=>b.style.display='none', 3800); }
function yourTurn(){ const d=document.createElement('div'); d.className='yourturn'; d.textContent='🙋 ¡Te toca preguntar!'; document.body.appendChild(d); setTimeout(()=>d.remove(),1700); }
function endModal(force){
  if(!V || !V.roundWin || (V.phase!=='roundEnd' && V.phase!=='over')) return;
  const w=V.roundWin, host=amHost(), over=V.phase==='over';
  const sc=V.players.map(p=>{ const id=w.sec[p.id], c=CH(id); return `<div class="reveal" style="--pc:${p.color}"><small>${esc(p.emoji)} ${esc(p.name)} tenía a</small>${c?`<img src="${esc(fotoOf(c))}" alt=""><b>${esc(c.n)}</b>`:'<b>?</b>'}</div>`; }).join('');
  const tbl=V.players.map(p=>`<tr><td>${esc(p.emoji)} ${esc(p.name)}</td><td style="text-align:right">${'🏆'.repeat(V.wins[p.id]||0)||'—'}</td></tr>`).join('');
  const champ = over ? V.players.find(p=>(V.wins[p.id]||0)>=V.opts.race) : null;
  modal(`<h2>${over?`🏆 ¡${esc(champ?champ.name:'')} ganó la partida!`:`🏁 Fin de la ronda ${V.round}`}</h2>
    <p style="margin:0 0 8px"><b>${esc(VPn(w.pid))}</b> ${esc(w.why)}</p>
    <div class="reveals">${sc}</div>
    <table class="score">${tbl}</table>
    ${host ? (over ? `<div class="row"><button class="btn green" onclick="doAct({type:'rematch'})">🔁 Revancha</button><button class="btn gray" onclick="doAct({type:'newGame'})">⚙️ Volver a la sala</button></div>`
                   : `<button class="btn green wide" onclick="doAct({type:'nextRound'})">▶️ Siguiente ronda</button>`)
           : `<p class="muted" style="text-align:center">⏳ Esperando al anfitrión…</p>`}
    <button class="btn gray wide" style="margin-top:6px" onclick="closeModal()">Ver el tablero</button>`);
  void force;
}

/* ====================== TABLERO 2D ====================== */
const VIEW=Object.assign({mode:'2d'}, load('adivina_view')||{});
function render2D(){
  const box=$('#board2d'); if(!box || VIEW.mode!=='2d') return;
  const bp=boardPid(), down=(V.down||{})[bp]||[], pc=(V.players.find(p=>p.id===bp)||{}).color||'#888';
  const picking = V.phase==='pick' && isPlayer() && !(V.sec||{})[me()];
  box.style.setProperty('--pc', pc);
  box.classList.toggle('picking', picking);
  box.classList.toggle('guessing', GUESS);
  const key=V.board.join(',');
  if(box.dataset.key!==key){
    box.dataset.key=key;
    box.innerHTML=V.board.map(id=>{ const c=CH(id)||{n:'?'}; return `<div class="card" data-id="${id}"><div class="in"><div class="fr"><img src="${esc(fotoOf(c))}" alt="" loading="lazy" draggable="false"><div class="nm">${esc(c.n)}</div></div><div class="bk"><span>?</span></div></div><button class="inf" title="Quién es">i</button></div>`; }).join('');
    layout2D();
  }
  $$('#board2d .card').forEach(el=>el.classList.toggle('down', down.includes(el.dataset.id)));
}
function layout2D(){
  const box=$('#board2d'); if(!box || !V || !V.board.length) return;
  const W=box.clientWidth-12, H=box.clientHeight-12, n=V.board.length, gap=6, R=1.27;
  let best={w:0, cols:1};
  for(let cols=2; cols<=n; cols++){
    const rows=Math.ceil(n/cols);
    const w=Math.min((W-gap*(cols-1))/cols, ((H-gap*(rows-1))/rows)/R);
    if(w>best.w) best={w, cols};
  }
  box.style.setProperty('--cols', best.cols);
  box.style.setProperty('--cw', Math.max(40, Math.floor(best.w))+'px');
}
$('#board2d').addEventListener('click', e=>{
  const card=e.target.closest('.card'); if(!card) return;
  if(e.target.closest('.inf')) return infoCard(card.dataset.id);
  cardTap(card.dataset.id, boardPid());
});
function resizeStage(){ layout2D(); resize3D(); }
window.addEventListener('resize', ()=>{ clearTimeout(resizeStage.t); resizeStage.t=setTimeout(resizeStage, 80); });

/* ====================== TABLERO 3D ====================== */
const R3={ok:false};
const TEX3=new Map();
const CAM3=Object.assign({yaw:0, pitch:20, zoom:1}, load('adivina_cam3')||{});
function cardTexture(id){
  if(TEX3.has(id)) return TEX3.get(id);
  const cv=document.createElement('canvas'); cv.width=256; cv.height=320;
  const g=cv.getContext('2d'), c=CH(id)||{n:'?'};
  const paint=img=>{
    g.fillStyle='#fffaf0'; g.fillRect(0,0,256,320);
    if(img) g.drawImage(img, 8, 8, 240, 240);
    g.fillStyle='#1d1d1d'; g.textAlign='center'; g.textBaseline='middle';
    const words=c.n.split(' '); let l1=c.n, l2='';
    g.font='bold 26px system-ui,sans-serif';
    if(g.measureText(c.n).width>236){ const h=Math.ceil(words.length/2); l1=words.slice(0,h).join(' '); l2=words.slice(h).join(' '); }
    const fit=t=>{ let s=26; g.font=`bold ${s}px system-ui,sans-serif`; while(g.measureText(t).width>240 && s>14){ s--; g.font=`bold ${s}px system-ui,sans-serif`; } };
    if(l2){ fit(l1); g.fillText(l1,128,272); fit(l2); g.fillText(l2,128,300); } else { fit(l1); g.fillText(l1,128,284); }
    tex.needsUpdate=true;
  };
  const tex=new THREE.CanvasTexture(cv); tex.anisotropy=4;
  paint(null);
  const img=new Image(); img.onload=()=>paint(img); img.src=fotoOf(c);
  TEX3.set(id, tex); return tex;
}
function backTexture(color){
  const key='bk'+color; if(TEX3.has(key)) return TEX3.get(key);
  const cv=document.createElement('canvas'); cv.width=128; cv.height=160; const g=cv.getContext('2d');
  g.fillStyle=color; g.fillRect(0,0,128,160);
  g.fillStyle='rgba(255,255,255,.12)'; for(let i=-160;i<160;i+=16){ g.beginPath(); g.moveTo(i,0); g.lineTo(i+160,160); g.lineTo(i+168,160); g.lineTo(i+8,0); g.fill(); }
  g.fillStyle='#fff'; g.font='bold 90px system-ui'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('?',64,84);
  const t=new THREE.CanvasTexture(cv); TEX3.set(key,t); return t;
}
function init3D(){
  if(R3.ok) return true;
  if(!window.THREE){ toast('No se pudo cargar el 3D en este aparato.'); return false; }
  const cv=$('#c3d');
  try{ R3.renderer=new THREE.WebGLRenderer({canvas:cv, antialias:true}); }catch(e){ toast('Este aparato no tiene 3D (WebGL).'); return false; }
  R3.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio||1));
  const sc=R3.scene=new THREE.Scene(); sc.background=new THREE.Color('#14243b');
  sc.add(new THREE.HemisphereLight(0xffffff, 0x334455, .85));
  const dl=new THREE.DirectionalLight(0xffffff, .65); dl.position.set(3,10,8); sc.add(dl);
  R3.cam=new THREE.PerspectiveCamera(42, 1, .1, 200);
  // la mesa
  const mesa=new THREE.Mesh(new THREE.BoxGeometry(40,.4,24), new THREE.MeshStandardMaterial({color:'#7a4a26', roughness:.8}));
  mesa.position.set(0,-.2,-3); sc.add(mesa);
  const pano=new THREE.Mesh(new THREE.PlaneGeometry(30,16), new THREE.MeshStandardMaterial({color:'#8c1d1d', roughness:1}));
  pano.rotation.x=-Math.PI/2; pano.position.set(0,.01,-3); sc.add(pano);
  R3.boards={front:null, back:null}; R3.key='';
  R3.ray=new THREE.Raycaster();
  wire3D(cv);
  R3.ok=true; resize3D();
  const loop=()=>{ if(R3.ok && VIEW.mode==='3d' && $('#game').classList.contains('on')) draw3D(); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  return true;
}
const CW=1, CHh=1.25, GAP=.18;
// en pantallas angostas (celular parado) van menos fichas por fila y más filas
function gridFor(n){ const a=R3.cam?R3.cam.aspect:1.5; const cols=Math.max(4, Math.min(9, Math.round(Math.sqrt(n*a*.75)))); return {rows:Math.ceil(n/cols), cols}; }
// arma un tablero: fila de bandejas con las fichas paradas (cada una gira sobre su borde de abajo)
function buildBoard(pid, front){
  const grp=new THREE.Group(), p=V.players.find(x=>x.id===pid)||{color:'#888'};
  const {rows, cols}=gridFor(V.board.length), W=cols*(CW+GAP)+.4;
  const baseMat=new THREE.MeshStandardMaterial({color:p.color, roughness:.5});
  const cards={};
  for(let r=0;r<rows;r++){
    const z=-r*1.0, y=r*.5;
    const tray=new THREE.Mesh(new THREE.BoxGeometry(W,.18+y,.7), baseMat); tray.position.set(0,(.18+y)/2,z); grp.add(tray);
  }
  V.board.forEach((id,i)=>{
    const r=Math.floor(i/cols), c=i%cols, inRow=Math.min(cols, V.board.length-r*cols);
    const x=(c-(inRow-1)/2)*(CW+GAP), z=-r*1.0+.12, y=.18+r*.5;
    const piv=new THREE.Group(); piv.position.set(x,y,z);
    const fm=new THREE.Mesh(new THREE.PlaneGeometry(CW,CHh), new THREE.MeshStandardMaterial({map:cardTexture(id), roughness:.6}));
    fm.position.y=CHh/2; fm.position.z=.012; fm.userData={id, pid};
    const bm=new THREE.Mesh(new THREE.PlaneGeometry(CW,CHh), new THREE.MeshStandardMaterial({map:backTexture(p.color), roughness:.6}));
    bm.position.y=CHh/2; bm.position.z=-.012; bm.rotation.y=Math.PI; bm.userData={id, pid};
    const edge=new THREE.Mesh(new THREE.BoxGeometry(CW+.06,CHh+.06,.02), baseMat); edge.position.y=CHh/2;
    piv.add(edge, fm, bm); grp.add(piv);
    cards[id]={piv, fm, bm, ang:0};
  });
  if(!front){ grp.rotation.y=Math.PI; grp.position.z=-(rows*2+1.6); }
  grp.userData={pid, W, cards, rows};
  R3.scene.add(grp);
  return grp;
}
// la ficha del personaje secreto, parada adelante a la izquierda (solo la ve su dueño)
function buildSecret(id, color, W){
  const g=new THREE.Group();
  const st=new THREE.Mesh(new THREE.BoxGeometry(1.5,.25,.6), new THREE.MeshStandardMaterial({color}));
  st.position.y=.12; g.add(st);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(1.25,1.56), new THREE.MeshStandardMaterial({map:cardTexture(id)}));
  m.position.set(0,1.05,0); m.rotation.x=-.12; g.add(m);
  g.position.set(-W/2+.9, 0, 1.9); g.rotation.y=.25; g.scale.setScalar(.8);
  R3.scene.add(g); return g;
}
function sync3D(){
  if(!R3.ok || !V || !V.board.length) return;
  const bp=boardPid(), op=oppOf(bp), mySec=isPlayer() ? (V.sec||{})[me()] : null;
  const key=V.board.join(',')+'|'+bp+'|'+op+'|'+(mySec||'')+'|'+V.players.map(p=>p.color).join()+'|'+gridFor(V.board.length).cols;
  if(R3.key!==key){
    R3.key=key;
    ['front','back','sec'].forEach(k=>{ if(R3.boards[k]){ R3.scene.remove(R3.boards[k]); R3.boards[k]=null; } });
    R3.boards.front=buildBoard(bp, true);
    if(op) R3.boards.back=buildBoard(op, false);
    if(mySec) R3.boards.sec=buildSecret(mySec, (V.players.find(p=>p.id===me())||{}).color||'#888', R3.boards.front.userData.W);
    fitCam3();
  }
  for(const k of ['front','back']){
    const b=R3.boards[k]; if(!b) continue;
    const down=(V.down||{})[b.userData.pid]||[];
    for(const id in b.userData.cards) b.userData.cards[id].target = down.includes(id) ? -Math.PI/2*.94 : 0;
  }
  const guess=GUESS, picking=V.phase==='pick' && isPlayer() && !(V.sec||{})[me()];
  const fc=R3.boards.front.userData.cards;
  for(const id in fc) fc[id].fm.material.emissive=new THREE.Color(guess||picking ? '#3a2a00' : '#000000');
}
function fitCam3(){
  const b=R3.boards.front; if(!b) return;
  const aspect=R3.cam.aspect||1, W=b.userData.W+3, fov=R3.cam.fov*Math.PI/180;
  const hfov=2*Math.atan(Math.tan(fov/2)*aspect);
  const rows=b.userData.rows||3;
  R3.dist=Math.max((W/2)/Math.tan(hfov/2), 5.5, rows*2.4)*.92; R3.tz=-(rows-1)*.5+.3; R3.ty=.4+rows*.17;
}
function draw3D(){
  const b=R3.boards;
  for(const k of ['front','back']){ const g=b[k]; if(!g) continue;
    for(const id in g.userData.cards){ const c=g.userData.cards[id]; const t=c.target||0; if(Math.abs(c.ang-t)>.002){ c.ang+= (t-c.ang)*.18; c.piv.rotation.x=c.ang; } } }
  const rows=R3.boards.front?R3.boards.front.userData.rows:3;
  const d=(R3.dist||10)/CAM3.zoom, yaw=CAM3.yaw*Math.PI/180, pit=Math.min(85,CAM3.pitch+Math.max(0,rows-3)*6)*Math.PI/180;
  const tx=0, ty=R3.ty||.9, tz=R3.tz==null?-.1:R3.tz;
  R3.cam.position.set(tx+d*Math.sin(yaw)*Math.cos(pit), ty+d*Math.sin(pit), tz+d*Math.cos(yaw)*Math.cos(pit));
  R3.cam.lookAt(tx,ty,tz);
  R3.renderer.render(R3.scene, R3.cam);
}
function resize3D(){
  if(!R3.ok) return;
  const st=$('#stage'), w=st.clientWidth, h=st.clientHeight; if(!w||!h) return;
  R3.renderer.setSize(w,h,false); R3.cam.aspect=w/h; R3.cam.updateProjectionMatrix(); fitCam3();
  if(V && V.board && V.board.length && VIEW.mode==='3d') sync3D();
}
function wire3D(cv){
  const pts=new Map(); let drag=null, pinch=null;
  cv.addEventListener('pointerdown', e=>{ cv.setPointerCapture(e.pointerId); pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pts.size===1) drag={x:e.clientX, y:e.clientY, yaw:CAM3.yaw, pitch:CAM3.pitch, moved:false};
    if(pts.size===2){ const [a,b]=[...pts.values()]; pinch={d:Math.hypot(a.x-b.x,a.y-b.y), z:CAM3.zoom}; drag=null; } });
  cv.addEventListener('pointermove', e=>{ if(!pts.has(e.pointerId)) return; pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pinch && pts.size===2){ const [a,b]=[...pts.values()]; CAM3.zoom=Math.max(.6,Math.min(2.6, pinch.z*Math.hypot(a.x-b.x,a.y-b.y)/pinch.d)); return; }
    if(!drag) return; const dx=e.clientX-drag.x, dy=e.clientY-drag.y;
    if(Math.abs(dx)+Math.abs(dy)>8) drag.moved=true;
    if(drag.moved){ CAM3.yaw=Math.max(-70,Math.min(70, drag.yaw-dx*.25)); CAM3.pitch=Math.max(4,Math.min(80, drag.pitch+dy*.2)); } });
  const up=e=>{ if(!pts.has(e.pointerId)) return; pts.delete(e.pointerId);
    if(drag && !drag.moved && pts.size===0) pick3D(e);
    if(pts.size<2) pinch=null; if(pts.size===0){ drag=null; store('adivina_cam3', CAM3); } };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', e=>{ pts.delete(e.pointerId); drag=null; pinch=null; });
  cv.addEventListener('wheel', e=>{ e.preventDefault(); CAM3.zoom=Math.max(.6,Math.min(2.6, CAM3.zoom*(e.deltaY<0?1.08:.93))); }, {passive:false});
}
function pick3D(e){
  const r=$('#c3d').getBoundingClientRect();
  const m=new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
  R3.ray.setFromCamera(m, R3.cam);
  const objs=[]; ['front','back'].forEach(k=>{ const b=R3.boards[k]; if(b) for(const id in b.userData.cards){ objs.push(b.userData.cards[id].fm, b.userData.cards[id].bm); } });
  const hit=R3.ray.intersectObjects(objs)[0]; if(!hit) return;
  const {id, pid}=hit.object.userData; cardTap(id, pid);
}
function cam3(k, d){
  if(k==='reset'){ CAM3.yaw=0; CAM3.pitch=20; CAM3.zoom=1; }
  else if(k==='zoom') CAM3.zoom=Math.max(.6,Math.min(2.6, CAM3.zoom*(d>0?1.15:.87)));
  else if(k==='top'){ CAM3.yaw=0; CAM3.pitch=62; }
  store('adivina_cam3', CAM3);
}
function applyView(){
  const is3=VIEW.mode==='3d';
  if(is3 && !init3D()){ VIEW.mode='2d'; }
  $('#board2d').style.display = VIEW.mode==='2d' ? '' : 'none';
  $('#c3d').style.display = VIEW.mode==='3d' ? 'block' : 'none';
  $('#stage').classList.toggle('v3d', VIEW.mode==='3d');
  $('#btnView').textContent = VIEW.mode==='3d' ? '🃏 2D' : '🧊 3D';
  if(VIEW.mode==='3d'){ R3.key=''; resize3D(); } else { const b=$('#board2d'); b.dataset.key=''; }
  if(V && V.phase!=='lobby') renderGame();
}
function toggleView(){ VIEW.mode = VIEW.mode==='3d' ? '2d' : '3d'; store('adivina_view', {mode:VIEW.mode}); applyView(); }
applyView();

/* ====================== PANEL LATERAL ====================== */
function renderSidePanels(){ if($('#tab-hist').classList.contains('on')) renderHist(); renderMesaTab(); renderReglasTab(); }
function renderHist(){
  if(!V) return;
  const qs=(V.qs||[]).slice().reverse();
  $('#histList').innerHTML = (V.phase!=='lobby' ? `<div class="muted" style="font-weight:800;margin-bottom:6px">Preguntas de la ronda ${V.round||''}</div>` : '')
    + (qs.length ? qs.map(q=>`<div class="hline"><b>${esc(VPn(q.by))}:</b> ${esc(q.text)} ${q.ans?`<span class="ans ${q.ans}">${ANS[q.ans]}</span>`:'⏳'}</div>`).join('') : '<p class="muted">Todavía nadie preguntó nada.</p>')
    + `<div class="muted" style="font-weight:800;margin:12px 0 6px">Lo que pasó</div>` + (V.log||[]).slice().reverse().slice(0,60).map(l=>`<div class="hline">${esc(l.x)}</div>`).join('');
}
function renderMesaTab(){
  const host=amHost(), inPlay=V.phase!=='lobby';
  const ps=V.players.map(p=>{
    const offline=!p.bot&&!p.conn;
    return `<div class="prow" style="border-left:5px solid ${p.color}"><span style="font-size:22px">${esc(p.emoji)}</span><span class="nm"><b>${esc(p.name)}${p.id===me()?' (vos)':''}${p.id===V.hostPid&&NET.mode!=='local'?' 👑':''}</b>
      <small>${p.bot?'🤖 bot':''}${p.mic?' · 🎙️':''}${offline?' · ⚠️ sin conexión':''}${inPlay&&V.cur===p.id?' · 🙋 su turno':''}</small></span>
      ${host&&p.id!==V.hostPid&&NET.mode!=='local'?`${offline&&inPlay?`<button class="btn sm gray" onclick="doAct({type:'botify',pid:'${p.id}'})" title="Que juegue un bot">🤖</button>`:''}<button class="btn sm gray" onclick="if(confirm('¿Sacar a ${esc(p.name)} de la mesa?'))doAct({type:'kick',pid:'${p.id}'})" title="Sacar">✕</button>`:''}</div>`;
  }).join('');
  const obs=(V.observers||[]).map(o=>`<div class="prow"><span style="font-size:20px">${o.owner?'👑':'👀'}</span><span class="nm"><b>${esc(o.name)}${o.id===me()?' (vos)':''}</b><small>mirando${o.mic?' · 🎙️':''}</small></span></div>`).join('');
  const sit = NET.obs && (V.phase==='lobby'||V.phase==='over') && V.players.length<MAXP ? `<button class="btn gold wide" onclick="doAct({type:'joinNext'})">🪑 Sentarme a jugar</button>` : NET.obs ? `<p class="muted">Juegan 2. Si se libera un lugar te podés sentar cuando termine la partida.</p>` : '';
  const info = inPlay ? `<p class="muted">Ronda ${V.round} · ${V.board.length} personajes${V.opts.race>1?` · gana el primero a ${V.opts.race}`:''}</p>` : '';
  $('#mesaList').innerHTML = info + `<b>Jugadores (${V.players.length}/${MAXP})</b>` + ps + (obs?`<b>Mirando</b>${obs}`:'') + sit
    + (host && inPlay ? `<button class="btn dark wide" style="margin-top:8px" onclick="if(confirm('¿Terminar la partida y volver a la sala?'))doAct({type:'newGame'})">⚙️ Terminar y volver a la sala</button>` : '')
    + (NET.mode!=='local'&&NET.code?`<p class="muted" style="margin-top:12px">Invitá con el código <b>${NET.code}</b> <button class="btn sm" onclick="shareRoom()">📤 Compartir</button></p>`:'');
}
function renderReglasTab(){
  const o=V.opts, host=amHost();
  $('#reglasList').innerHTML = `<p style="margin-top:0"><b>Categorías:</b> ${o.cats.map(c=>CATS[c].e+' '+CATS[c].n).join(', ')}</p>
    <p class="muted">${esc(PICKS[o.pick])}<br>${esc(WRONGS[o.wrong])}<br>${o.libres?'✍️ Se pueden escribir preguntas':'📋 Solo preguntas de la lista'}${o.ayuda?' · 🪄 con ayuda para bajar':''}</p>`
    + `<b>📝 Reglas propias del grupo</b>` + (V.grules?`<div class="grules" style="margin:6px 0 10px">${esc(V.grules)}</div>`:`<p class="muted">${host?'Las podés escribir en la sala de espera.':'No hay.'}</p>`)
    + `<b>💡 Sugerencias</b><div style="margin-top:6px">${sugsHTML(host)}</div>
       <div class="row"><input type="text" id="sugIn2" maxlength="240" placeholder="Proponé una regla…" onkeydown="if(event.key==='Enter')sendSug('sugIn2')"><button class="btn sm" style="flex:0 0 auto" onclick="sendSug('sugIn2')">Sugerir</button></div>
       <button class="btn dark wide" style="margin-top:12px" onclick="showRules()">📜 Cómo se juega</button>`;
}

/* ====================== MIS PERSONAJES (foto → caricatura) ====================== */
function myMios(){ return load('adivina_mios')||[]; }
function saveMios(l){ try{ localStorage.setItem('adivina_mios', JSON.stringify(l)); return true; }catch(e){ toast('No hay más lugar en este aparato para fotos. Borrá alguno o exportalos.'); return false; } }
function loadMyMios(){ MIOS={}; myMios().forEach(p=>MIOS[p.id]=p); TEX3.clear(); if(S) S.miosRev=(S.miosRev||0)+1; }
function openMios(){
  const l=myMios();
  modal(`<h2>⭐ Mis personajes</h2>
    <p class="muted" style="margin-top:0">Agregá a quien quieras con su foto: el juego la pasa a caricatura. Quedan guardados en este aparato y entran en las partidas que vos armes (como anfitrión). Para que estén para todos, exportalos y mandá el archivo al dueño del juego.</p>
    <div class="mios">${l.map(p=>`<div class="mio"><img src="${esc(p.foto)}" alt=""><b>${esc(p.n)}</b><small>${(CATS[p.cat]||CATS.mio).e} ${(CATS[p.cat]||CATS.mio).n}</small>
      <div class="row"><button class="btn sm" onclick="editMio('${p.id}')">✏️</button><button class="btn sm red" onclick="delMio('${p.id}')">🗑️</button></div></div>`).join('') || '<p class="muted">Todavía no agregaste a nadie.</p>'}</div>
    <button class="btn green wide" onclick="editMio(null)">➕ Agregar personaje</button>
    <div class="row" style="margin-top:6px"><button class="btn sm gray" onclick="exportMios()" ${l.length?'':'disabled'}>⬇️ Exportar</button><label class="btn sm gray" style="text-align:center">⬆️ Importar<input type="file" accept=".json,application/json" style="display:none" onchange="importMios(this.files[0])"></label></div>
    <button class="btn gray wide" style="margin-top:8px" onclick="closeMios()">Listo</button>`);
}
function closeMios(){ closeModal(); if(S && (NET.mode==='host'||NET.mode==='local') && S.phase==='lobby'){ loadMyMios(); commit(); } }
function delMio(id){ if(!confirm('¿Borrar este personaje?')) return; saveMios(myMios().filter(p=>p.id!==id)); openMios(); }
function exportMios(){
  const b=new Blob([JSON.stringify({juego:'adivina-quien-py', personajes:myMios()})], {type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='mis-personajes-adivina.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 3000);
}
function importMios(f){
  if(!f) return; const r=new FileReader();
  r.onload=()=>{ try{ const d=JSON.parse(r.result), list=(d.personajes||d||[]).filter(p=>p && p.n && /^data:image\//.test(p.foto||''));
      const cur=myMios(); list.forEach(p=>{ p.id=p.id && /^m_/.test(p.id) ? p.id : 'm_'+Math.random().toString(36).slice(2,9); if(!cur.some(x=>x.id===p.id)) cur.push(p); });
      if(saveMios(cur)) toast(`⬆️ Se sumaron ${list.length} personajes.`); openMios(); }catch(e){ toast('Ese archivo no es de personajes.'); } };
  r.readAsText(f);
}
const ED={img:null, cx:.5, cy:.4, s:.6, id:null, foto:null};
function editMio(id){
  const p=id ? myMios().find(x=>x.id===id) : null;
  Object.assign(ED, {img:null, cx:.5, cy:.4, s:.6, id, foto:p?p.foto:null});
  const rs=String(p?p.r:'').split(',');
  modal(`<h2>${p?'✏️ Editar':'➕ Nuevo'} personaje</h2>
    <label class="lb">Nombre</label><input type="text" id="edN" maxlength="40" value="${esc(p?p.n:'')}" placeholder="Ej.: Ña Chela del barrio">
    <div class="row"><div><label class="lb">Categoría</label><select id="edC">${CAT_ORDER.map(c=>`<option value="${c}" ${(p?p.cat:'mio')===c?'selected':''}>${CATS[c].e} ${CATS[c].n}</option>`).join('')}</select></div>
      <div><label class="lb">Año en que nació</label><input type="text" inputmode="numeric" id="edY" maxlength="4" value="${p&&p.nac?p.nac:''}" placeholder="Ej.: 1990"></div></div>
    <label class="opt" style="margin-top:6px"><input type="checkbox" id="edV" ${p&&p.fin?'':'checked'}><span><b>Está vivo</b></span></label>
    <label class="lb">Foto</label>
    <div class="edfoto"><div class="edsrc"><canvas id="edSrc" width="240" height="240"></canvas><small>Arrastrá el cuadro hasta la cara</small></div><div class="edout"><canvas id="edOut" width="240" height="240"></canvas><small>Así queda la caricatura</small></div></div>
    <div class="row"><label class="btn sm" style="text-align:center">📷 Elegir o sacar foto<input type="file" accept="image/*" style="display:none" onchange="edLoad(this.files[0])"></label></div>
    <label class="lb">Tamaño del recorte</label><input type="range" id="edS" min="10" max="100" value="60" oninput="ED.s=this.value/100;edDraw(true)">
    <label class="lb">Cómo se ve (marcá lo que tenga)</label>
    <div class="tags edtags">${RASGOS.map(r=>`<label><input type="checkbox" value="${r.k}" ${rs.includes(r.k)?'checked':''}> ${r.t}</label>`).join('')}</div>
    <label class="lb">Quién es (se ve al tocar la ⓘ)</label><textarea id="edB" maxlength="300" placeholder="Ej.: La que vende chipa en la esquina">${esc(p?p.bio||'':'')}</textarea>
    <div class="row" style="margin-top:8px"><button class="btn gray" onclick="openMios()">Cancelar</button><button class="btn green" onclick="edSave()">💾 Guardar</button></div>`);
  if(ED.foto){ const im=new Image(); im.onload=()=>{ ED.img=im; ED.cx=.5; ED.cy=.5; ED.s=1; $('#edS').value=100; edDraw(false); const g=$('#edOut').getContext('2d'); g.drawImage(im,0,0,240,240); }; im.src=ED.foto; ED.keep=true; } else ED.keep=false;
  wireEd();
}
function edLoad(f){
  if(!f) return; const u=URL.createObjectURL(f), im=new Image();
  im.onload=()=>{ ED.img=im; ED.keep=false; ED.cx=.5; ED.cy=.4; ED.s=Math.min(1, .7*Math.min(im.naturalWidth,im.naturalHeight)/im.naturalWidth); $('#edS').value=Math.round(ED.s*100); edDraw(true); };
  im.onerror=()=>toast('No se pudo abrir esa foto.'); im.src=u;
}
function edDraw(caric){
  const im=ED.img, cv=$('#edSrc'); if(!im || !cv) return;
  const W=im.naturalWidth, H=im.naturalHeight, k=Math.min(240/W, 240/H), g=cv.getContext('2d');
  g.fillStyle='#222'; g.fillRect(0,0,240,240);
  const ox=(240-W*k)/2, oy=(240-H*k)/2; g.drawImage(im, ox, oy, W*k, H*k);
  const side=Math.min(W,H,ED.s*W)*k; let x=ED.cx*W*k-side/2, y=ED.cy*H*k-side/2;
  x=Math.max(0,Math.min(W*k-side,x)); y=Math.max(0,Math.min(H*k-side,y));
  g.strokeStyle='#ffd400'; g.lineWidth=3; g.strokeRect(ox+x, oy+y, side, side);
  ED.box={ox, oy, k, W, H};
  if(caric){ ED.keep=false; clearTimeout(edDraw.t); edDraw.t=setTimeout(()=>{ const out=Caricatura.hacer(im, {cx:ED.cx, cy:ED.cy, s:ED.s}); const o=$('#edOut'); if(o) o.getContext('2d').drawImage(out,0,0); }, 120); }
}
function wireEd(){
  const cv=$('#edSrc'); let d=false;
  const mv=e=>{ if(!d || !ED.img || !ED.box) return; const r=cv.getBoundingClientRect(), b=ED.box;
    const px=(e.clientX-r.left)*240/r.width, py=(e.clientY-r.top)*240/r.height;
    ED.cx=Math.max(0,Math.min(1,(px-b.ox)/(b.W*b.k))); ED.cy=Math.max(0,Math.min(1,(py-b.oy)/(b.H*b.k))); edDraw(true); };
  cv.addEventListener('pointerdown', e=>{ d=true; cv.setPointerCapture(e.pointerId); mv(e); });
  cv.addEventListener('pointermove', mv);
  cv.addEventListener('pointerup', ()=>d=false); cv.addEventListener('pointercancel', ()=>d=false);
}
function edSave(){
  const n=$('#edN').value.trim(); if(!n) return toast('Escribí el nombre.');
  if(!ED.img) return toast('Elegí una foto.');
  const foto = ED.keep && ED.foto ? ED.foto : Caricatura.hacer(ED.img, {cx:ED.cx, cy:ED.cy, s:ED.s}).toDataURL('image/jpeg', .82);
  const y=parseInt($('#edY').value,10);
  const p={id:ED.id||'m_'+Math.random().toString(36).slice(2,9), n:n.slice(0,40), cat:$('#edC').value, nac:y>1000&&y<2100?y:null,
    fin:$('#edV').checked?null:1, r:$$('.edtags input:checked').map(i=>i.value).join(','), bio:$('#edB').value.trim().slice(0,300), foto};
  if(!p.nac) delete p.nac;
  const l=myMios().filter(x=>x.id!==p.id); l.push(p);
  if(saveMios(l)){ toast(`⭐ ${p.n} quedó guardado.`); openMios(); }
}

/* ====================== VARIOS ====================== */
function modal(h){ $('#mbox').innerHTML=h; $('#modal').classList.add('on'); }
function closeModal(){ $('#modal').classList.remove('on'); }
function roomLink(){ return location.origin+location.pathname+'#'+NET.code; }
function copyCode(){ navigator.clipboard && navigator.clipboard.writeText(NET.code).then(()=>toast('Código copiado: '+NET.code)); }
function shareRoom(){
  const url=roomLink(), text=`¡Vení a jugar al Adivina Quién paraguayo! 🕵️🇵🇾 Sala ${NET.code}`;
  if(navigator.share) return navigator.share({title:'Adivina Quién PY', text, url}).catch(()=>{});
  modal(`<h2>📤 Invitar a la sala ${NET.code}</h2><p style="word-break:break-all;user-select:all;background:#fff;padding:8px;border-radius:8px">${esc(url)}</p>
    <a class="btn green wide" style="display:block;text-align:center;text-decoration:none" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text+' '+url)}">💬 Mandar por WhatsApp</a>
    <button class="btn wide" style="margin-top:6px" onclick="navigator.clipboard.writeText('${url}').then(()=>toast('Enlace copiado'))">📋 Copiar enlace</button>
    <button class="btn gray wide" style="margin-top:6px" onclick="closeModal()">Cerrar</button>`);
}
function showRules(){
  modal(`<div class="rules"><h2>📜 Cómo se juega</h2>
  <p>Cada jugador tiene un <b>personaje secreto</b> del tablero. Hay que adivinar el del otro antes que él adivine el tuyo.</p>
  <h3>🙋 En tu turno</h3>
  <ul><li><b>❓ Preguntar</b> algo que se conteste con sí o no. Las preguntas de la lista las contesta el juego (no hay trampa). Si la mesa lo permite, también podés escribir tu propia pregunta y la contesta el otro jugador.</li>
  <li>Con la respuesta, <b>bajá las cartas</b> que ya no pueden ser (tocalas; si te equivocás, tocá de nuevo y se levanta). El botón 🪄 las baja solas.</li>
  <li>Tocá <b>✅ Listo</b> para pasar el turno.</li>
  <li>Cuando creas que sabés quién es, tocá <b>🎯 Arriesgar</b> y elegí la carta. Si acertás, ganás la ronda. Si errás, perdés la ronda (o solo el turno, según la mesa).</li></ul>
  <h3>👀 Los que miran</h3><p>Ven los dos tableros, las preguntas y el chat, pero <b>nunca</b> los personajes secretos hasta que termina la ronda: así nadie puede soplar.</p>
  <h3>🧊 2D y 3D</h3><p>En 2D ves las cartas grandes. En 3D, el tablero de tu rival queda enfrente (ves la espalda de sus fichas y cuántas bajó). Arrastrá para girar, pellizcá o usá la rueda para acercar.</p>
  <h3>⭐ Personajes nuevos</h3><p>Desde el menú, “Mis personajes”: poné nombre, foto (se pasa sola a caricatura) y sus rasgos. Entran en las partidas que armes vos.</p>
  </div><button class="btn wide" onclick="closeModal()">Entendido</button>`);
}
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeModal(); });
$('#modal').addEventListener('click', e=>{ if(e.target.id==='modal') closeModal(); });
