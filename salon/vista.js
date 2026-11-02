'use strict';
/* =====================================================================
   Salón de Belleza PY — pantallas: sala de espera, el salón (2D con las
   herramientas), el pedido, el espejo con el puntaje y el panel lateral.
   La vista 3D está en vista3d.js.
   ===================================================================== */
const PREF=Object.assign({vista:'2d'}, load('salon_pref')||{});
const savePref = () => store('salon_pref', PREF);
const UI={cat:'lavado', tool:'champu', col:{tinte:PAL.tinte[2][1], labial:PAL.labial[0][1], sombra:PAL.sombra[0][1], rubor:PAL.rubor[0][1], esmalte:PAL.esmalte[0][1]}, des:'py', side:'front', watch:null, pedOpen:true};
const VIEW={mode: PREF.vista==='3d' ? '3d' : '2d'};

/* ====================== RENDER GENERAL ====================== */
function render(){
  if(!S) return;
  V = NET.mode==='client' ? S : publicState(me());
  if(NET.mode!=='client') V.endAt=S.endAt;
  if(V.phase==='lobby'){ show('lobby'); renderLobby(); }
  else { show('game'); renderGame(); }
  renderSidePanels(); renderChatTo(); renderVoice(); voiceSync(); musicSync(); events();
}
const hotseat = () => NET.mode==='local' && V && V.players.length===2;
function actor(){ if(NET.mode==='local') return V && isDuel(V) && V.turn ? V.turn : NET.myPid; return me(); }
function viewKey(){
  if(!V || !V.cl) return null;
  if(!isDuel(V)) return V.cl.all ? 'all' : null;
  const a=actor();
  if(V.cl[a]) return a;
  if(UI.watch && V.cl[UI.watch]) return UI.watch;
  return Object.keys(V.cl)[0]||null;
}
const curClient = () => { const k=viewKey(); return k ? V.cl[k] : null; };
const iCanEdit = () => !!V && canEdit(V, actor(), viewKey());
const zone = () => (CATS.find(c=>c.id===UI.cat)||{}).manos ? 'manos' : 'cab';
const VPn = pid => { const p=V.players.find(x=>x.id===pid); return p ? `${p.emoji} ${p.name}` : '?'; };
function playerTag(p){
  const host=p.id===V.hostPid;
  return `<span class="dot" style="background:${p.color}"></span><span style="font-size:20px">${esc(p.emoji)}</span><span class="nm">${esc(p.name)}${p.id===me()&&!hotseat()?' <span class="muted">(vos)</span>':''}</span>`
    + `${host&&NET.mode!=='local'?'👑':''}${p.mic?'🎙️':''}${!p.conn&&!p.local?'⚠️':''}`;
}

/* ---------- sala de espera ---------- */
function renderLobby(){
  const host=amHost(), myObs=!!NET.obs;
  $('#lobbyCode').textContent=NET.code||'—';
  $('#lobbyCodeBox').style.display = NET.mode==='local' ? 'none' : '';
  $('#lobbyTitle').textContent = NET.mode==='local' ? (hotseat() ? '👥 Dos en este aparato' : '💇 Tu salón') : '💇 Sala de espera';
  $('#pcount').textContent=`(${V.players.length}/${MAXP})`;
  $('#plist').innerHTML=V.players.map(p=>`<li>${playerTag(p)}${host && p.id!==V.hostPid && NET.mode!=='local'?`<button class="btn sm gray" onclick="doAct({type:'kick',pid:'${p.id}'})" title="Sacar">✕</button>`:''}</li>`).join('')
    + (V.observers||[]).map(x=>`<li style="opacity:.75"><span style="font-size:20px">👀</span><span class="nm">${esc(x.name)} <span class="muted">mirando</span></span>${x.mic?'🎙️':''}</li>`).join('');
  const err = isDuel(V) && V.players.length<2 ? 'Para el duelo hacen falta 2 estilistas.' : null;
  $('#lobbyHostBtns').innerHTML = host
    ? `<button class="btn green wide big" onclick="doAct({type:'start'})">💇 Abrir el salón</button>
       <p class="muted">${err?'⚠️ '+esc(err):'¡Listo para atender!'} ${NET.mode==='local'?'':'Atienden 2; los demás que entren miran 👀 con chat y voz.'}</p>`
    : `<p class="muted" style="text-align:center">⏳ Esperando que el anfitrión 👑 abra el salón…</p>`;
  $('#lobbyObs').innerHTML = myObs ? `<div class="obsbar" style="border-radius:10px;margin-top:8px;display:flex">👀 Estás mirando. ${V.players.length<MAXP?`<button class="btn sm gold" onclick="doAct({type:'joinNext'})">💇 Atender yo también</button>`:'Ya hay 2 estilistas.'}</div>` : '';
  const ob=$('#optsBox'), keepFocus=document.activeElement && ob.contains(document.activeElement);
  if(!keepFocus) ob.innerHTML = optsHTML(host);
  const g=$('#grulesBox');
  if(host){
    if(!g.querySelector('textarea')) g.innerHTML=`<textarea id="grulesIn" maxlength="1200" placeholder="Ej.: la que pierde el duelo ceba el tereré 🧉&#10;Nada de raparle la cabeza a Ña Ramona 😂"></textarea><p class="muted" style="margin:4px 0 0">Se guarda solo y lo ven todos.</p>`;
    const ta=$('#grulesIn'); if(document.activeElement!==ta) ta.value=V.grules||'';
    ta.oninput=()=>{ clearTimeout(ta.t); ta.t=setTimeout(()=>doAct({type:'grules', text:ta.value}), 600); };
  } else g.innerHTML = V.grules ? `<div class="grules">${esc(V.grules)}</div>` : `<p class="muted">El anfitrión todavía no escribió reglas propias.</p>`;
  $('#sugBox').innerHTML = sugsHTML(host);
}
function optsHTML(host){
  const o=V.opts, dis = host && V.phase==='lobby' ? '' : 'disabled';
  const sel=(k, list)=>`<select ${dis} onchange="doAct({type:'opt',k:'${k}',v:this.value})">${list.map(x=>`<option value="${x.v}" ${o[k]==x.v?'selected':''}>${x.t}</option>`).join('')}</select>`;
  const chk=(k, t, d)=>`<label class="opt" style="margin:0 0 6px;font-weight:400"><input type="checkbox" ${o[k]?'checked':''} ${dis} onchange="doAct({type:'opt',k:'${k}',v:this.checked})"><span><b>${t}</b><small>${d}</small></span></label>`;
  const desc={juntos:'Los dos (o vos sola/o) atienden al mismo cliente al mismo tiempo: uno hace el pelo y el otro las uñas, por ejemplo. La plata va a la caja del salón.',
    duelo:'Llega el mismo cliente con el mismo pedido para cada uno. Cada uno lo atiende en su sillón y al final el cliente (y los que miran) dicen quién lo dejó mejor. En un solo aparato atienden por turno.',
    libre:'Sin pedidos ni reloj: cortá, teñí, maquillá y pintá las uñas como quieras. Cuando quieras, otro cliente.'};
  return `<label style="margin-top:0">Modo ${host?'':'<span class="muted">(lo elige el anfitrión)</span>'}</label>
    <div class="juegos" style="flex-direction:column">${Object.keys(MODOS).map(k=>`<button class="jbtn ${o.modo===k?'on':''}" ${dis} onclick="doAct({type:'opt',k:'modo',v:'${k}'})">${MODOS[k]}</button>`).join('')}</div>
    <p class="muted" style="margin:6px 0">${esc(desc[o.modo])}</p>
    ${o.modo!=='libre'?`<label>👥 Clientes del día</label>${sel('clientes', CLIENTES)}<label>⏱️ Tiempo</label>${sel('tiempo', TIEMPOS)}`:''}
    <label>Ayudas</label>
    ${chk('ayuda','📋 Mostrar cómo va cada cosa del pedido','En el pedido se ve ✅ lo que ya está bien hecho.')}
    ${chk('charla','💬 El cliente charla','Comenta mientras lo atienden (y se queja si duele 😅).')}`;
}
function sugsHTML(host){
  const list=(V.sugs||[]).slice().sort((a,b)=>b.votes.length-a.votes.length);
  if(!list.length) return '<p class="muted">Todavía no hay sugerencias. ¡Proponé la primera!</p>';
  return list.map(s=>`<div class="sug"><span class="t">${esc(s.text)}<small>${esc(s.e)} ${esc(s.by)}</small></span>
    <button class="vote ${s.votes.includes(me())?'on':''}" onclick="doAct({type:'vote',id:'${s.id}'})">👍 ${s.votes.length}</button>
    ${host?`<button class="vote" onclick="doAct({type:'sugDel',id:'${s.id}'})" title="Borrar">🗑️</button>`:''}</div>`).join('');
}
function sendSug(id){ const i=$('#'+id); const t=i.value.trim(); if(!t) return toast('Escribí la regla que querés sugerir.'); doAct({type:'suggest', text:t}); i.value=''; toast('💡 ¡Sugerencia enviada! Los demás la pueden votar.'); }

/* ====================== EL SALÓN ====================== */
function renderGame(){
  $('#roomTag').textContent = NET.mode==='local' ? (hotseat()?'👥 2 en este aparato':'📱 En este aparato') : 'Sala '+NET.code;
  const ob=$('#obsbar');
  if(NET.obs && isDuel(V) && V.phase==='play'){ ob.style.display='flex'; ob.innerHTML='👀 Mirando a: '+Object.keys(V.cl).map(k=>`<button class="btn sm ${viewKey()===k?'gold':'dark'}" onclick="UI.watch='${k}';renderGame()">${esc(VPn(k))}</button>`).join(' '); }
  else if(NET.obs){ ob.style.display='flex'; ob.textContent='👀 Estás mirando el salón (chat y voz abiertos).'; }
  else ob.style.display='none';
  renderCtrl(); renderHud(true); applyView();
}
const errToast = m => { const now=Date.now(); if(errToast.m===m && now-errToast.at<2500) return; errToast.m=m; errToast.at=now; toast(m); };

/* ---------- controles de abajo ---------- */
let CTRLKEY='';
function renderCtrl(){
  const c=curClient(), ed=iCanEdit(), T=TOOLS[UI.tool]||{};
  const key=[V.phase, UI.cat, UI.tool, JSON.stringify(UI.col), UI.des, ed, c?c.st+c.acc.join()+(c.beard?1:0):'', isDuel(V), isLibre(V), V.done.join(), V.turn, VIEW.mode, UI.side, actor()].join('|');
  if(key===CTRLKEY) return; CTRLKEY=key;
  const el=$('#ctrl');
  if(V.phase!=='play' || !c){ el.innerHTML = V.phase==='review' ? `<div class="msgline">🪞 El cliente se está mirando al espejo…</div>${amHost()?'':''}` : V.phase==='over' ? `<div class="msgline">🏁 Se terminó el día.</div>` : ''; return; }
  const cats=CATS.map(k=>`<button class="cat ${UI.cat===k.id?'on':''}" onclick="pickCat('${k.id}')"><span>${k.e}</span>${k.n}</button>`).join('');
  let tools=toolsOf(UI.cat).map(id=>{ const t=TOOLS[id]; return `<button class="tool ${UI.tool===id?'on':''}" onclick="pickTool('${id}')" title="${esc(t.d)}"><span>${t.e}</span>${t.n}</button>`; }).join('');
  if(UI.cat==='peinado') tools+=`<span class="sep"></span>`+Object.keys(STYLES).map(st=>`<button class="tool sty ${c.st===st?'on':''}" ${ed?'':'disabled'} onclick="doTool({tool:'peinar',st:'${st}'})"><span>${STYLES[st].split(' ')[0]}</span>${STYLES[st].split(' ').slice(1).join(' ')}</button>`).join('');
  if(UI.cat==='acc') tools=Object.keys(ACC).map(id=>`<button class="tool ${c.acc.includes(id)?'on':''}" ${ed?'':'disabled'} onclick="doTool({tool:'acc',acc:'${id}'})"><span>${ACC[id].e}</span>${ACC[id].n}</button>`).join('');
  let pal='';
  if(T.pal && UI.cat!=='acc') pal=`<div class="pal">${PAL[T.pal].map(([n,h])=>`<button class="swb ${UI.col[T.pal]===h?'on':''}" style="background:${h}" title="${esc(n)}" onclick="pickCol('${T.pal}','${h}')"></button>`).join('')}<span class="muted" style="color:#fff">${esc(colName(T.pal, UI.col[T.pal]))}</span></div>`;
  if(T.des) pal=`<div class="pal">${Object.keys(DESIGNS).map(d=>`<button class="desb ${UI.des===d?'on':''}" onclick="UI.des='${d}';CTRLKEY='';renderCtrl()">${DESIGNS[d]}</button>`).join('')}</div>`;
  let info = UI.cat==='acc' ? 'Tocá un accesorio para ponérselo o sacárselo.' : UI.cat==='barba' && !c.beard ? 'Este cliente no tiene barba 😄' : T.d || '';
  if(VIEW.mode==='3d') info += ' · 🖱️ Para girar: arrastrá con el botón derecho, con dos dedos o con ✋';
  const busy = isDuel(V) && V.done.includes(actor());
  const acts = `${VIEW.mode==='2d'&&zone()==='cab'?`<button class="btn sm dark" onclick="flipSide()">🔄 ${UI.side==='front'?'Ver de espaldas':'Ver de frente'}</button>`:''}
    ${VIEW.mode==='3d'?`<button class="btn sm ${UI.tool==='mirar'?'gold':'dark'}" onclick="pickTool('mirar')">✋ Girar</button>`:''}
    ${isLibre(V)?`<button class="btn sm dark" onclick="newClientModal()">🆕 Otro cliente</button>`:''}
    ${isPlayerMe() && !busy ? `<button class="btn sm green" onclick="listoClick()">✅ ¡Listo!${isLibre(V)?' (al espejo)':''}</button>` : busy ? `<span class="muted" style="color:#fff">✅ Terminaste. Esperando al otro…</span>` : ''}`;
  el.innerHTML = `<div class="cats">${cats}</div><div class="tools">${tools}</div>${pal}<div class="btns"><span class="tinfo">${esc(info)}</span>${acts}</div>`;
}
const isPlayerMe = () => V.players.some(p=>p.id===actor());
function pickCat(id){
  UI.cat=id; const first=toolsOf(id)[0];
  if(first && TOOLS[UI.tool] && TOOLS[UI.tool].cat!==id) UI.tool=first;
  if(id==='acc') UI.tool='acc';
  if(zone()==='cab' && UI.side==='back' && ['maquillaje','facial','barba'].includes(id)) UI.side='front';
  CTRLKEY=''; renderCtrl(); R3.camKey=''; sfx.click();
}
function pickTool(id){ UI.tool=id; CTRLKEY=''; renderCtrl(); sfx.click(); }
function pickCol(p,h){ UI.col[p]=h; CTRLKEY=''; renderCtrl(); }
function flipSide(){ UI.side = UI.side==='front' ? 'back' : 'front'; CTRLKEY=''; renderCtrl(); }
function listoClick(){
  if(isLibre(V)) return doMyAct({type:'listo'});
  const c=curClient(); let warn='';
  if(c && V.req){ const pend=V.req.tasks.filter(t=>scoreTask(c,t).s<.75).length; if(pend) warn=`Todavía falta${pend>1?'n':''} ${pend} cosa${pend>1?'s':''} del pedido. `; }
  if(!warn || confirm(warn+'¿Mostrarle cómo quedó?')) doMyAct({type:'listo'});
}
function doMyAct(a){ if(NET.mode==='local'){ const r=act(actor(), a); if(typeof r==='string') toast(r); return; } doAct(a); }
function newClientModal(){
  modal(`<h2>🆕 Otro cliente</h2><p class="muted">¿A quién atendemos ahora?</p>
    <div class="pick2">
      <button class="btn big" onclick="closeModal();doMyAct({type:'newClient',sex:'f'})">👩 Una señora</button>
      <button class="btn big" onclick="closeModal();doMyAct({type:'newClient',sex:'f',age:'joven'})">👧 Una chica</button>
      <button class="btn big" onclick="closeModal();doMyAct({type:'newClient',sex:'m'})">👨 Un señor (con barba)</button>
      <button class="btn big" onclick="closeModal();doMyAct({type:'newClient',sex:'f',age:'mayor'})">👵 Una abuela</button>
      <button class="btn big" onclick="closeModal();doMyAct({type:'newClient',sex:'m',age:'mayor'})">👴 Un abuelo</button>
      <button class="btn big gold" onclick="closeModal();doMyAct({type:'newClient'})">🎲 Cualquiera</button></div>
    <button class="btn gray wide" style="margin-top:10px" onclick="closeModal()">Cancelar</button>`);
}

/* ---------- herramientas: apuntar y aplicar ---------- */
const REGOK={labial:['labios'], sombra:['ojoI','ojoD'], rubor:['mejI','mejD'], delineador:['ojoI','ojoD'], rimel:['ojoI','ojoD'], pinza:['cejaI','cejaD'], lapiz:['cejaI','cejaD'],
  pepinos:['ojoI','ojoD'], espuma:['barba','bigote','menton'], navaja:['barba','bigote','menton'], recortar:['barba','bigote','menton'], mascarilla:['frente','mejI','mejD','nariz','menton','barba','bigote'], esponja:['frente','mejI','mejD','nariz','menton','barba','bigote']};
const REGHINT={labial:'El labial va en los labios 💄', sombra:'La sombra va sobre los ojos 👁️', rubor:'El rubor va en las mejillas 🌸', delineador:'El delineador va en los ojos', rimel:'El rímel va en las pestañas', pinza:'La pinza es para las cejas', lapiz:'El lápiz es para las cejas', pepinos:'Los pepinos van en los ojos 🥒', espuma:'La espuma va en la barba', navaja:'La navaja es para la barba y el bigote', recortar:'La recortadora es para la barba y el bigote'};
function occluded2D(p){ if(ell(p[0],p[1],0,0,HEAD.sx,HEAD.sy)) return true; if(p[1]<-1.38) return Math.abs(p[0])<1.75; if(p[1]<-.7 && Math.abs(p[0])<.34) return true; return false; }
function hairHits(c, near){
  const res={};
  for(const st of hairStrands(c)) for(const p of st.pts){ if(!near(p)) continue; const cur=res[st.s]; if(cur==null || p[3]<cur) res[st.s]=p[3]; }
  return res;
}
// h = {zone, x, y, front, p3}   (p3: el punto 3D donde apuntó, en el modelo)
function toolAct(h){
  const c=curClient(), T=TOOLS[UI.tool]; if(!c || !T) return null;
  const a={tool:UI.tool}; if(T.pal) a.col=UI.col[T.pal];
  if(T.cat==='unas' && h.zone!=='manos') return null;
  if(T.cat!=='unas' && h.zone==='manos') return null;
  if(T.on==='pelo'){
    const r = UI.tool==='tijera' ? .07 : UI.tool==='maquina' ? .13 : .17, dz=h.front?1:-1;
    const near = h.p3 ? p=>Math.hypot(p[0]-h.p3[0],p[1]-h.p3[1],p[2]-h.p3[2])<r*1.25 : p=>Math.hypot(p[0]-h.x,p[1]-h.y)<r && !(p[2]*dz<0 && occluded2D(p));
    const hs=hairHits(c, near); let secs=Object.keys(hs).map(Number);
    if(UI.tool==='tijera') a.secs=secs.map(s=>[s, +(hs[s]/(kOf(isFringe(c,s))*curlShrink(c.hair[s].cu))).toFixed(3)]);
    else {
      if(UI.tool==='puntas') secs=secs.filter(s=>hs[s]>visLen(c,s)*.55);
      if(c.st!=='suelto' && UI.tool!=='maquina'){ const tails=tailPaths(c); let hit=false;
        for(const tp of tails) for(const p of tp.pts){ if(tp.bun ? (h.p3 ? Math.hypot(p[0]-h.p3[0],p[1]-h.p3[1],p[2]-h.p3[2])<tp.r*1.3 : Math.hypot(p[0]-h.x,p[1]-h.y)<tp.r) : near(p)) hit=true; }
        if(hit) secs=[...Array(NSEC).keys()]; }
      a.secs=secs;
    }
    return a.secs.length ? a : null;
  }
  if(T.on==='cara'){
    if(!h.front) return null;
    const reg=faceRegion(h.x,h.y,c.sex==='m'); if(!reg) return null;
    if(REGOK[UI.tool] && !REGOK[UI.tool].includes(reg)){ if(REGHINT[UI.tool]) errToast(REGHINT[UI.tool]); return null; }
    if(T.cat==='barba' && !c.beard){ errToast('Este cliente no tiene barba 😄'); return null; }
    a.reg=reg;
    if(UI.tool==='limpieza'){ let best=-1, bd=.11; for(const i of c.face.spots){ const d=Math.hypot(SPOTS[i][0]-h.x, SPOTS[i][1]-h.y); if(d<bd){ bd=d; best=i; } } if(best<0) return null; a.spot=best; }
    return a;
  }
  if(T.on==='una'){ const n=hitNail(h.x,h.y,c); if(n<0) return null; a.nail=n; if(T.des) a.des=UI.des; return a; }
  if(T.on==='mano'){ const hd=hitHand(h.x,h.y); if(hd<0) return null; a.hand=hd; return a; }
  return null;
}
const TOOLSND={tijera:'snip', maquina:'buzz', champu:'foam', enjuagar:'water', acond:'foam', secador:'air', secunas:'air', planchita:'hot', ondas:'hot', buclera:'hot', laca:'spray', limpieza:'pop', pinza:'ouch', navaja:'brush', recortar:'buzz', cortaunas:'snip'};
function doTool(a){
  if(!V || V.phase!=='play') return;
  if(!iCanEdit()){ if(isDuel(V) && V.done.includes(actor())) errToast('Ya terminaste: esperá al otro estilista.'); else if(!isPlayerMe()) errToast('👀 Estás mirando: no podés atender.'); return; }
  a.type='tool'; a.key=viewKey();
  const now=Date.now(), snd=TOOLSND[a.tool]||'brush';
  if(now-(doTool.snd||0)>(snd==='buzz'||snd==='air'?110:160)){ doTool.snd=now; if(sfx[snd]) sfx[snd](); }
  if(NET.mode==='client'){
    try{ if(canEdit(S, me(), a.key)){ const r=applyTool(S.cl[a.key], JSON.parse(JSON.stringify(a))); if(r.err) errToast(r.err); else { V=S; CTRLKEY=''; renderCtrl(); } } }catch(e){}
    if(NET.hostConn && NET.hostConn.open) NET.hostConn.send({t:'act', a}); else errToast('Sin conexión con el anfitrión.');
  } else { const r=act(actor(), a); if(typeof r==='string') errToast(r); }
}

/* ---------- puntero sobre el salón ---------- */
const PTR={down:false, last:0, x:-1, y:-1, in:false, first:false, orbit:false};
let LAST2D=null;
function ptrHit(e){
  const st=$('#stage').getBoundingClientRect(), px=e.clientX-st.left, py=e.clientY-st.top;
  PTR.x=px; PTR.y=py;
  if(VIEW.mode==='3d') return pick3D(px, py, st.width, st.height);
  if(!LAST2D) return null;
  const X=LAST2D, front=UI.side!=='back' || zone()==='manos';
  return {zone:zone(), x:(px-X.ox)/X.sc*(front?1:-1), y:(X.oy-py)/X.sc, front};
}
function ptrApply(e, first){
  const h=ptrHit(e); if(!h) return;
  if(h.zone==='cab') sendCur('cab', h.p3 || [h.x,h.y,h.front?1:-1], UI.tool, viewKey()); else sendCur('manos', [h.x,h.y,0], UI.tool, viewKey());
  if(!PTR.down || V.phase!=='play') return;
  const T=TOOLS[UI.tool]; if(!T) return;
  if(T.click && !first) return;
  const now=Date.now(); if(!first && now-PTR.last<60) return; PTR.last=now;
  const a=toolAct(h); if(!a) return;
  doTool(a); spawnFx(h, a);
}
function wireStage(){
  const st=$('#stage');
  st.addEventListener('contextmenu', e=>e.preventDefault());
  st.addEventListener('pointerdown', e=>{
    if(e.target.closest('button,#hud,#rival')) return;
    if(VIEW.mode==='3d' && (UI.tool==='mirar' || e.button===2 || e.pointerType==='touch' && PTR.touches>0)){ orbitStart(e); return; }
    if(e.pointerType==='touch'){ PTR.touches=(PTR.touches||0)+1; if(PTR.touches>1 && VIEW.mode==='3d'){ PTR.down=false; orbitStart(e); return; } }
    PTR.down=true; PTR.in=true; try{ st.setPointerCapture(e.pointerId); }catch(_){}
    ptrApply(e, true);
  });
  st.addEventListener('pointermove', e=>{ PTR.in=true; if(R3.orbit) return orbitMove(e); ptrApply(e, false); });
  const up=e=>{ if(e.pointerType==='touch') PTR.touches=Math.max(0,(PTR.touches||1)-1); PTR.down=false; orbitEnd(e); };
  st.addEventListener('pointerup', up); st.addEventListener('pointercancel', up);
  st.addEventListener('pointerleave', ()=>{ PTR.in=false; });
  st.addEventListener('wheel', e=>{ if(VIEW.mode==='3d'){ e.preventDefault(); cam3('zoom', e.deltaY<0?1:-1); } }, {passive:false});
}

/* ---------- efectos (pelitos que caen, aire, chispas) ---------- */
const FX=[];
function spawnFx(h, a){
  const c=curClient(); if(!c) return;
  const sx=PTR.x, sy=PTR.y;
  if(a.tool==='tijera' || a.tool==='maquina'){ const col=hairBase(c); for(let i=0;i<5;i++) FX.push({k:'hair', x:sx+(Math.random()-.5)*20, y:sy, vx:(Math.random()-.5)*60, vy:20+Math.random()*40, r:Math.random()*6, col, t:0, life:1.4}); }
  else if(a.tool==='secador' || a.tool==='secunas') for(let i=0;i<3;i++) FX.push({k:'air', x:sx-30, y:sy+(Math.random()-.5)*30, vx:120, vy:0, t:0, life:.5});
  else if(a.tool==='laca' || a.tool==='enjuagar') for(let i=0;i<6;i++) FX.push({k:'drop', x:sx+(Math.random()-.5)*30, y:sy+(Math.random()-.5)*30, vx:(Math.random()-.5)*40, vy:a.tool==='enjuagar'?90:10, col:a.tool==='enjuagar'?'#6fb7e8':'#e8eef5', t:0, life:.6});
  else if(a.tool==='diseno' || a.tool==='acc' || a.tool==='limpieza') for(let i=0;i<8;i++) FX.push({k:'star', x:sx, y:sy, vx:(Math.random()-.5)*160, vy:(Math.random()-.5)*160, t:0, life:.6});
}

/* ---------- dibujo de cada cuadro ---------- */
function draw2D(t){
  const cv=$('#c2d'), c=curClient(); if(!c) return;
  const W=cv.clientWidth, H=cv.clientHeight, dpr=Math.min(2, window.devicePixelRatio||1);
  if(cv.width!==Math.round(W*dpr) || cv.height!==Math.round(H*dpr)){ cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); }
  const ctx=cv.getContext('2d'); ctx.save(); ctx.scale(dpr,dpr);
  const z=zone(), side = z==='manos' ? 'front' : UI.side;
  // drawScene usa setTransform: le paso el escalado del dpr armando las coordenadas a mano
  const X=drawSceneDpr(ctx, W, H, c, {side, zone:z, t, talk:talking(), bg:true}, dpr);
  LAST2D={sc:X.sc, ox:X.ox, oy:X.oy};
  ctx.restore();
}
function drawSceneDpr(ctx, W, H, c, o, dpr){
  const st=ctx.setTransform.bind(ctx);
  ctx.setTransform=(a,b,cc,d,e,f)=>st(a*dpr,b*dpr,cc*dpr,d*dpr,e*dpr,f*dpr);
  try{ return drawScene(ctx, W, H, c, o); } finally{ ctx.setTransform=st; ctx.setTransform(dpr,0,0,dpr,0,0); }
}
function talking(){ const k=viewKey(), s=V && V.say && V.say[k]; return !!s && Date.now()-s.at<2200; }
// capa de arriba: cursores, efectos y el globito del cliente
function drawOverlay(dt){
  const cv=$('#fx'), W=cv.clientWidth, H=cv.clientHeight, dpr=Math.min(2, window.devicePixelRatio||1);
  if(cv.width!==Math.round(W*dpr) || cv.height!==Math.round(H*dpr)){ cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); }
  const ctx=cv.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,W,H);
  for(let i=FX.length-1;i>=0;i--){ const f=FX[i]; f.t+=dt; if(f.t>f.life){ FX.splice(i,1); continue; }
    f.x+=f.vx*dt; f.y+=f.vy*dt; if(f.k==='hair') f.vy+=200*dt; const a=1-f.t/f.life; ctx.globalAlpha=a;
    if(f.k==='hair'){ ctx.strokeStyle=f.col; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(f.x,f.y); ctx.lineTo(f.x+Math.cos(f.r+f.t*6)*9,f.y+Math.sin(f.r+f.t*6)*9); ctx.stroke(); }
    else if(f.k==='air'){ ctx.strokeStyle='#ffffff'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(f.x,f.y); ctx.lineTo(f.x+18,f.y); ctx.stroke(); }
    else if(f.k==='drop'){ ctx.fillStyle=f.col; ctx.beginPath(); ctx.arc(f.x,f.y,3,0,7); ctx.fill(); }
    else { ctx.fillStyle='#ffd84a'; ctx.font='14px sans-serif'; ctx.fillText('✦',f.x,f.y); }
  }
  ctx.globalAlpha=1;
  const T=TOOLS[UI.tool];
  if(PTR.in && T && V.phase==='play' && UI.tool!=='mirar' && matchMedia('(hover:hover)').matches){
    ctx.font='26px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(T.e, PTR.x+16, PTR.y-16);
    if(T.on==='pelo' && VIEW.mode==='2d' && LAST2D){ const r=(UI.tool==='tijera'?.07:UI.tool==='maquina'?.13:.17)*LAST2D.sc; ctx.strokeStyle='rgba(255,255,255,.8)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(PTR.x,PTR.y,r,0,7); ctx.stroke(); }
  }
  // cursores de los demás
  const key=viewKey(), z=zone();
  for(const pid in CUR){ const k=CUR[pid]; if(Date.now()-k.at>3000 || k.key!==key || k.z!==z || !k.p) continue;
    const s=projectPt(k.p, k.z); if(!s) continue; const p=VP(pid); const col=(p&&p.color)||'#fff';
    ctx.font='24px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText((TOOLS[k.tool]||{e:'👆'}).e, s[0], s[1]);
    ctx.font='bold 11px system-ui,sans-serif'; const nm=p?p.name:''; const w=ctx.measureText(nm).width+10;
    ctx.fillStyle=col; ctx.fillRect(s[0]-w/2, s[1]+15, w, 16); ctx.fillStyle='#fff'; ctx.fillText(nm, s[0], s[1]+23); }
  // globito del cliente
  const sb=$('#sayb'), sy=V && V.say && V.say[key];
  if(sy && Date.now()-sy.at<5500 && z==='cab'){ const s=projectPt([.55,1.25,.3],'cab'); if(s){
    let left=Math.max(6,s[0]), top=Math.max(6,s[1]-50); const hb=$('#hud').getBoundingClientRect(), sr=$('#stage').getBoundingClientRect();
    if(top < hb.bottom-sr.top && left < hb.right-sr.left+6) left=hb.right-sr.left+8;   // que el pedido no lo tape
    sb.style.display='block'; sb.style.left=Math.min(W-200, left)+'px'; sb.style.top=top+'px'; if(sb.textContent!==sy.x) sb.textContent=sy.x; } }
  else sb.style.display='none';
}
// de un punto del modelo a la pantalla
function projectPt(p, z){
  if(VIEW.mode==='3d') return project3D(p, z);
  if(!LAST2D || z!==zone()) return null;
  const f = z==='manos' || UI.side!=='back' ? 1 : -1;
  if(z==='cab' && p.length>2 && Math.abs(p[2])===1 && p[2]!==f) return null;   // el otro lo está mirando del otro lado
  return [LAST2D.ox+p[0]*LAST2D.sc*f, LAST2D.oy-p[1]*LAST2D.sc];
}
let lastTs=0, hudAt=0;
function frame(ts){
  requestAnimationFrame(frame);
  const dt=Math.min(.1,(ts-lastTs)/1000||0); lastTs=ts;
  if(!V || !$('#game').classList.contains('on') || V.phase==='lobby') return;
  if(VIEW.mode==='3d'){ if(R3.ok) draw3D(ts/1000); } else draw2D(ts/1000);
  drawOverlay(dt);
  if(ts-hudAt>350){ hudAt=ts; renderHud(); }
}
requestAnimationFrame(frame);

/* ---------- pedido, reloj y rival ---------- */
let HUDKEY='';
function renderHud(force){
  const hud=$('#hud'), c=curClient();
  if(!c || V.phase==='lobby'){ hud.innerHTML=''; return; }
  const k=viewKey(), req=V.req, o=V.opts;
  let clock='';
  if(V.endAt && V.phase==='play'){ const left=Math.max(0, V.endAt-Date.now()), s=Math.ceil(left/1000); clock=`<span class="clk ${s<=20?'low':''}">⏱️ ${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}</span>`;
    if(s<=10 && s>0 && s!==renderHud.lastS){ renderHud.lastS=s; sfx.tick(); } }
  const money = isDuel(V) ? V.players.map(p=>`<span class="mon" style="border-color:${p.color}">${esc(p.emoji)} ${gs(V.money[p.id]||0)}</span>`).join('') : `<span class="mon">💰 Caja: ${gs(V.caja)}</span>`;
  const who = req ? `${req.e} <b>${esc(req.who)}</b>` : `${c.e} <b>${esc(c.name)}</b>`;
  const tasks = req ? req.tasks.map(t=>{ const sc=scoreTask(c,t).s, ok=sc>=.75; return `<li class="${ok&&o.ayuda?'ok':''}">${o.ayuda?(ok?'✅':'⬜'):'▫️'} ${taskText(t)}${o.ayuda&&!ok&&sc>.05?`<i class="bar"><b style="width:${Math.round(sc*100)}%"></b></i>`:''}</li>`; }).join('') : '<li>🎨 Modo libre: hacé lo que quieras.</li>';
  const turn = isDuel(V) && hotseat() && V.phase==='play' ? `<div class="turn">💇 Atiende: <b>${esc(VPn(V.turn))}</b></div>` : isDuel(V) && NET.obs ? `<div class="turn">Mirando el sillón de <b>${esc(VPn(k))}</b></div>` : '';
  const html=`<div class="ped ${UI.pedOpen?'':'closed'}"><div class="ph" onclick="UI.pedOpen=!UI.pedOpen;renderHud(true)">${who} <span class="muted">· cliente ${V.n}${isLibre(V)?'':' de '+o.clientes}</span> <span class="tog">${UI.pedOpen?'▲':'▼'}</span></div>
    ${UI.pedOpen?`${req?`<div class="story">${esc(req.story)}</div>`:''}${turn}<ul>${tasks}</ul>`:''}<div class="hrow">${clock}${money}</div></div>`;
  if(force || html!==HUDKEY){ HUDKEY=html; hud.innerHTML=html; }
  // el sillón del otro (en el duelo)
  const rv=$('#rival');
  const other = isDuel(V) && V.phase==='play' ? Object.keys(V.cl).find(x=>x!==k) : null;
  if(other && !(hotseat())){ rv.style.display='block'; const ctx=rv.getContext('2d'); const W=rv.width, H=rv.height; ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,W,H); drawScene(ctx,W,H,V.cl[other],{side:'front',zone:'cab',t:0,bg:true}); ctx.setTransform(1,0,0,1,0,0); ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(0,H-18,W,18); ctx.fillStyle='#fff'; ctx.font='bold 11px system-ui'; ctx.textAlign='center'; ctx.fillText(VPn(other).slice(0,18)+(V.done.includes(other)?' ✅':''), W/2, H-5); }
  else rv.style.display='none';
}

/* ---------- avisos y el espejo ---------- */
const EV={n:-1, phase:null, handoff:null, say:''};
function events(){
  if(!V) return;
  if(V.phase==='play' && (V.n!==EV.n || EV.phase!=='play')){
    if(V.n!==EV.n){ sfx.bell(); const c=curClient(); if(c){ UI.side='front'; if(c.sex==='m' && UI.cat==='maquillaje') pickCat('lavado'); } if(V.req) toast(`🔔 Llegó ${V.req.e} ${V.req.who}`); }
    closeModal();
  }
  if(V.phase==='play' && hotseat() && isDuel(V) && V.handoff && V.handoff!==EV.handoff){ EV.handoff=V.handoff; sfx.turn(); modal(`<h2>🔁 ¡Cambio de estilista!</h2><p style="font-size:17px">Ahora atiende <b>${esc(VPn(V.turn))}</b> al mismo cliente, con el mismo pedido. Pasale el aparato 📱</p><button class="btn green wide big" onclick="closeModal()">💇 ¡Empezar!</button>`); }
  if(V.phase==='review'){ if(EV.phase!=='review'){ const r=V.res||{}; const best=Math.max(...Object.keys(V.cl).map(k=>(r[k]||{}).stars||0)); if(best>=4) sfx.cash(); else if(best<=2) sfx.lose(); else sfx.cash(); } reviewModal(); }
  if(V.phase==='over' && EV.phase!=='over'){ sfx.win(); overModal(); }
  else if(V.phase==='over') overModal(true);
  const s=V.say && V.say[viewKey()];
  if(s && s.x+s.at!==EV.say){ EV.say=s.x+s.at; }
  EV.n=V.n; EV.phase=V.phase;
}
function snapshot(c, w, h){
  const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
  drawScene(cv.getContext('2d'), w, h, c, {side:'front', zone:'cab', t:1, bg:true});
  return cv.toDataURL('image/jpeg', .85);
}
function handsShot(c, w, h){ const cv=document.createElement('canvas'); cv.width=w; cv.height=h; drawScene(cv.getContext('2d'), w, h, c, {side:'front', zone:'manos', t:1, bg:true}); return cv.toDataURL('image/jpeg', .8); }
let REVKEY='';
function reviewModal(){
  const r=V.res||{}, keys=Object.keys(V.cl), duel=isDuel(V);
  const key=V.n+'|'+JSON.stringify(V.votes)+'|'+keys.join();
  if(key===REVKEY && $('#modal').classList.contains('on')) return; REVKEY=key;
  const votes=k=>Object.values(V.votes||{}).filter(x=>x===k).length;
  const cols=keys.map(k=>{
    const c=V.cl[k], x=r[k]||{tasks:[],stars:0,pay:0,tip:0};
    const usesHands=V.req && V.req.tasks.some(t=>t.k==='unas'||t.k==='manos');
    return `<div class="mcol ${duel&&r.win===k?'win':''}">
      ${duel?`<h3>${esc(VPn(k))}${r.win===k?' 🏆':''}</h3>`:''}
      <div class="mirror"><img src="${snapshot(c, 300, 330)}" alt="">${usesHands?`<img class="hshot" src="${handsShot(c,220,150)}" alt="">`:''}</div>
      <div class="stars">${'⭐'.repeat(x.stars)}${'<span style="opacity:.25">⭐</span>'.repeat(5-x.stars)}</div>
      <p class="quote">“${esc(x.say||'')}”</p>
      ${x.tasks.length?`<ul class="tl">${x.tasks.map(t=>`<li>${t.s>=.75?'✅':t.s>=.4?'🟡':'❌'} ${V.req && V.req.tasks[t.i] ? taskText(V.req.tasks[t.i]) : esc(t.t)}${t.bad?`<br><small>💬 ${esc(t.bad)}</small>`:''}</li>`).join('')}${(x.extra||[]).map(e=>`<li>❌ <small>💬 ${esc(e)}</small></li>`).join('')}</ul>`:''}
      ${V.req?`<p class="pay">💵 Pagó <b>${gs(x.pay)}</b>${x.tip?` + propina <b>${gs(x.tip)}</b> 🎁`:''}</p>`:''}
      ${duel?`<button class="btn sm ${V.votes&&V.votes[me()]===k?'gold':'gray'}" ${k===me()||hotseat()?'disabled':''} onclick="doAct({type:'like',key:'${k}'})">👍 Me gusta más (${votes(k)})</button>`:''}
    </div>`;
  }).join('');
  const last=!isLibre(V) && V.n>=V.opts.clientes;
  const btn = amHost() ? `<button class="btn green wide big" onclick="doMyAct({type:'next'})">${last?'🏁 Ver cómo nos fue en el día':isLibre(V)?'🆕 Otro cliente':'🔔 Que pase el siguiente cliente'}</button>` : `<p class="muted" style="text-align:center">⏳ Esperando que el anfitrión 👑 haga pasar al siguiente…</p>`;
  const title = duel ? (r.win ? `🏆 ¡Ganó ${esc(VPn(r.win))}!` : '🤝 ¡Empate!') : '🪞 ¡Al espejo!';
  modal(`<h2>${title}</h2>${V.req?`<p class="muted">${esc(V.req.e)} ${esc(V.req.who)} se mira al espejo…</p>`:''}<div class="mcols">${cols}</div>${btn}`);
}
function overModal(quiet){
  if(quiet && $('#modal').classList.contains('on')) return;
  const duel=isDuel(V), host=amHost();
  const avgSt = pid => { const a=V.stars[pid]||[]; return a.length ? (a.reduce((x,y)=>x+y,0)/a.length).toFixed(1) : '0'; };
  let body='';
  if(duel){
    const rank=V.players.slice().sort((a,b)=>(V.money[b.id]||0)-(V.money[a.id]||0));
    const wins = pid => V.served.filter(s=>s.win===pid).length;
    body=`<h3>👑 Estilista del día: ${esc(rank[0]?rank[0].emoji+' '+rank[0].name:'')}</h3><table class="score">${rank.map((p,i)=>`<tr><td>${i?'🥈':'🥇'} ${esc(p.emoji)} <b>${esc(p.name)}</b></td><td>${gs(V.money[p.id]||0)}</td><td>⭐ ${avgSt(p.id)}</td><td>🏆 ${wins(p.id)}</td></tr>`).join('')}</table>`;
  } else body=`<h3>💰 En la caja: ${gs(V.caja)}</h3><p>⭐ Promedio: <b>${avgSt(V.players[0].id)}</b> estrellas</p>`;
  body+=`<h3>Clientes del día</h3><table class="score">${V.served.map(s=>`<tr><td>${esc(s.e)} ${esc(s.who)}</td><td>${s.stars.map(x=>(duel?esc(VPn(x.k).split(' ')[0])+' ':'')+'⭐'.repeat(x.st)).join(' · ')}</td></tr>`).join('')}</table>`;
  modal(`<h2>🏁 ¡Se cerró el salón!</h2>${body}
    ${host?`<div class="row" style="margin-top:10px"><button class="btn green big" onclick="doMyAct({type:'rematch'})">🔁 Otro día</button><button class="btn dark big" onclick="doMyAct({type:'newGame'})">⚙️ Volver a la sala</button></div>`:'<p class="muted">El anfitrión decide si siguen.</p>'}
    <button class="btn gray wide" style="margin-top:6px" onclick="closeModal()">Cerrar</button>`);
}

/* ====================== PANEL LATERAL ====================== */
function renderSidePanels(){ renderHist(); renderMesaTab(); renderReglasTab(); }
function renderHist(){
  if(!V) return;
  const c=curClient(), req=V.req;
  let h='';
  if(V.phase!=='lobby' && c){
    h+= req ? `<div class="hbox"><b>${esc(req.e)} ${esc(req.who)}</b><p>${esc(req.story)}</p><ul class="tl">${req.tasks.map(t=>`<li>${taskText(t)}</li>`).join('')}</ul></div>` : `<p class="muted">Modo libre: sin pedido.</p>`;
  }
  h+=`<div class="muted" style="font-weight:800;margin:12px 0 6px">Lo que pasó</div>` + (V.log||[]).slice().reverse().slice(0,40).map(l=>`<div class="hline">${esc(l.x)}</div>`).join('');
  const el=$('#histList'); if(el.innerHTML!==h) el.innerHTML=h;
}
function renderMesaTab(){
  const host=amHost(), inPlay=V.phase!=='lobby';
  const ps=V.players.map(p=>{
    const offline=!p.conn&&!p.local;
    return `<div class="prow" style="border-left:5px solid ${p.color}"><span style="font-size:22px">${esc(p.emoji)}</span><span class="nm"><b>${esc(p.name)}${p.id===me()&&!hotseat()?' (vos)':''}${p.id===V.hostPid&&NET.mode!=='local'?' 👑':''}</b>
      <small>${inPlay?gs(V.money[p.id]||0):''}${p.mic?' · 🎙️':''}${offline?' · ⚠️ sin conexión':''}</small></span>
      ${host&&p.id!==V.hostPid&&NET.mode!=='local'?`<button class="btn sm gray" onclick="if(confirm('¿Sacar a ${esc(p.name)} del salón?'))doAct({type:'kick',pid:'${p.id}'})" title="Sacar">✕</button>`:''}</div>`;
  }).join('');
  const obs=(V.observers||[]).map(o=>`<div class="prow"><span style="font-size:20px">${o.owner?'👑':'👀'}</span><span class="nm"><b>${esc(o.name)}${o.id===me()?' (vos)':''}</b><small>mirando${o.mic?' · 🎙️':''}</small></span></div>`).join('');
  const sit = NET.obs && V.players.length<MAXP && (V.phase==='lobby'||V.phase==='over') ? `<button class="btn gold wide" onclick="doAct({type:'joinNext'})">💇 Atender yo también</button>` : NET.obs ? `<p class="muted">Atienden 2. Si se libera un lugar te podés sumar cuando termine.</p>` : '';
  const info = inPlay ? `<p class="muted">${esc(MODOS[V.opts.modo])} · cliente ${V.n}${isLibre(V)?'':' de '+V.opts.clientes}</p>` : '';
  const html = info + `<b>Estilistas (${V.players.length}/${MAXP})</b>` + ps + (obs?`<b>Mirando</b>${obs}`:'') + sit
    + (host && inPlay ? `<button class="btn dark wide" style="margin-top:8px" onclick="if(confirm('¿Cerrar el salón y volver a la sala?'))doMyAct({type:'newGame'})">⚙️ Cerrar y volver a la sala</button>` : '')
    + (NET.mode!=='local'&&NET.code?`<p class="muted" style="margin-top:12px">Invitá con el código <b>${NET.code}</b> <button class="btn sm" onclick="shareRoom()">📤 Compartir</button></p>`:'');
  const el=$('#mesaList'); if(el.innerHTML!==html) el.innerHTML=html;
}
function renderReglasTab(){
  const o=V.opts, host=amHost();
  const el=$('#reglasList'); if(el.contains(document.activeElement)) return;
  el.innerHTML = `<p style="margin-top:0"><b>${esc(MODOS[o.modo])}</b></p>
    <p class="muted">${o.modo==='libre'?'Sin pedidos ni reloj':`👥 ${o.clientes} cliente${o.clientes>1?'s':''} · ${esc((TIEMPOS.find(t=>t.v===o.tiempo)||{}).t||'')}`}${o.ayuda?' · 📋 con ayuda':''}${o.charla?' · 💬 el cliente charla':''}</p>`
    + `<b>📝 Reglas propias del grupo</b>` + (V.grules?`<div class="grules" style="margin:6px 0 10px">${esc(V.grules)}</div>`:`<p class="muted">${host?'Las podés escribir en la sala de espera.':'No hay.'}</p>`)
    + `<b>💡 Sugerencias</b><div style="margin-top:6px">${sugsHTML(host)}</div>
       <div class="row"><input type="text" id="sugIn2" maxlength="240" placeholder="Proponé una regla…" onkeydown="if(event.key==='Enter')sendSug('sugIn2')"><button class="btn sm" style="flex:0 0 auto" onclick="sendSug('sugIn2')">Sugerir</button></div>
       <button class="btn dark wide" style="margin-top:12px" onclick="showRules()">📜 Cómo se juega</button>`;
}

/* ====================== VISTA 2D / 3D ====================== */
function applyView(){
  const is3=VIEW.mode==='3d';
  $('#c2d').style.display = is3 ? 'none' : 'block';
  $('#c3d').style.display = is3 ? 'block' : 'none';
  $('#stage').classList.toggle('v3d', is3);
  $('#btnView').textContent = is3 ? '🖼️ 2D' : '🧊 3D';
  if(is3) init3D();
}
function toggleView(){
  VIEW.mode = VIEW.mode==='3d' ? '2d' : '3d';
  if(VIEW.mode==='3d' && !window.THREE){ VIEW.mode='2d'; return toast('Este aparato no puede mostrar 3D.'); }
  PREF.vista=VIEW.mode; savePref(); if(UI.tool==='mirar' && VIEW.mode==='2d') pickTool(toolsOf(UI.cat)[0]||'acc');
  CTRLKEY=''; applyView(); renderCtrl();
}
function resizeStage(){ if(typeof resize3D==='function') resize3D(); }
window.addEventListener('resize', resizeStage);

/* ====================== VARIOS ====================== */
function modal(h){ $('#mbox').innerHTML=h; $('#modal').classList.add('on'); }
function closeModal(){ $('#modal').classList.remove('on'); }
function roomLink(){ return location.origin+location.pathname+'#'+NET.code; }
function copyCode(){ navigator.clipboard && navigator.clipboard.writeText(NET.code).then(()=>toast('Código copiado: '+NET.code)); }
function shareRoom(){
  const url=roomLink(), text=`¡Vení a atender el salón de belleza conmigo! 💇‍♀️💅🇵🇾 Sala ${NET.code}`;
  if(navigator.share) return navigator.share({title:'Salón de Belleza PY', text, url}).catch(()=>{});
  modal(`<h2>📤 Invitar a la sala ${NET.code}</h2><p style="word-break:break-all;user-select:all;background:#fff;padding:8px;border-radius:8px">${esc(url)}</p>
    <a class="btn green wide" style="display:block;text-align:center;text-decoration:none" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text+' '+url)}">💬 Mandar por WhatsApp</a>
    <button class="btn wide" style="margin-top:6px" onclick="navigator.clipboard.writeText('${url}').then(()=>toast('Enlace copiado'))">📋 Copiar enlace</button>
    <button class="btn gray wide" style="margin-top:6px" onclick="closeModal()">Cerrar</button>`);
}
function showRules(){
  modal(`<div class="rules"><h2>📜 Cómo se juega</h2>
  <p>Llegan clientes al salón con un <b>pedido</b> (para su fiesta de 15, el casamiento en la Catedral, la Expo, el acto del 15 de mayo, la peregrinación a Caacupé…). Hacé todo lo que piden y tocá <b>✅ ¡Listo!</b>: el cliente se mira al espejo, pone estrellas y paga en guaraníes, con propina si quedó contento.</p>
  <h3>🧰 Las herramientas</h3><ul>
  <li><b>🚿 Lavado:</b> champú (frotá hasta sacar la suciedad), enjuagar (sacá toda la espuma), acondicionador y toalla.</li>
  <li><b>✂️ Corte:</b> la tijera corta a la altura por donde la pasás; la máquina rapa. Dá vuelta al cliente 🔄 para cortar atrás. Cortando los mechones de adelante bien cortitos se hace el flequillo.</li>
  <li><b>🎨 Color:</b> tintura (todo el pelo), mechas y puntas, del color que elijas. Pasá varias veces.</li>
  <li><b>💨 Peinado:</b> secador, planchita (lacio), ondas y buclera (rulos) con el pelo seco; laca contra el frizz; y cola, trenza, dos trenzas, moño o rodete.</li>
  <li><b>💄 Maquillaje:</b> labial, sombra, rubor, delineador, rímel, pinza y lápiz de cejas, desmaquillante.</li>
  <li><b>🧖 Facial:</b> limpiá los granitos, poné la mascarilla, pepinos en los ojos, sacá la mascarilla con la esponja y crema.</li>
  <li><b>🧔 Barbería:</b> primero espuma, después navaja (¡sin espuma raspa!), recortadora y loción.</li>
  <li><b>💅 Uñas:</b> quitaesmalte, lima o cortaúñas, esmalte (2 o 3 pasadas), diseños (🇵🇾 bandera, mburucuyá, brillitos, francesita, corazón, lunares, ñandutí) y secar el esmalte.</li>
  <li><b>💍 Accesorios:</b> flor de lapacho o de mburucuyá, peineta y collar de ñandutí, vincha tricolor, corona de 15, sombrero pirí, lentes, aros y moño.</li></ul>
  <h3>👥 Entre dos</h3><p><b>Juntos:</b> atienden al mismo cliente al mismo tiempo; cada uno ve con qué herramienta anda el otro. <b>Duelo:</b> el mismo cliente para cada uno y gana el que lo deja mejor (los que miran votan 👍). En un solo aparato, el duelo es por turnos.</p>
  <h3>⚠️ Cuidado</h3><p>Si cortás o teñís sin que te lo pidan, el cliente se enoja. No lo mandes con el pelo mojado, con espuma, con la mascarilla o los pepinos puestos, ni con el esmalte fresco.</p>
  <h3>🧊 2D y 3D</h3><p>Con el botón 🧊 se cambia a 3D: se gira el cliente arrastrando con el botón derecho, con dos dedos o con ✋.</p>
  </div><button class="btn wide" onclick="closeModal()">Entendido</button>`);
}
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeModal(); });
$('#modal').addEventListener('click', e=>{ if(e.target.id==='modal' && !(V && V.phase==='review')) closeModal(); });
wireStage();
