'use strict';
/* =====================================================================
   Caras en la mesa (opcional): cada jugador puede mostrar una foto de su
   cara o su cámara en vivo (chiquita y en baja calidad) en una "cabeza"
   arriba de sus cartas, para ver contra quién juega.
   - Las fotos viajan aparte del estado de la partida (FACES), una sola vez.
   - Las cámaras van como llamadas de video de PeerJS marcadas {kind:'cam'}.
   ===================================================================== */
let FACES = {};   // id del jugador → foto chiquita (data:image/jpeg)
const CAM = {stream:null, calls:{}, videos:{}, self:null};
const myFace = () => load('uno_face');

/* ---------- fotos ---------- */
// recorta la imagen (o el cuadro de la cámara) con forma de cabeza y la achica mucho
function faceFromImage(src, mirror){
  const W=80, H=96, c=document.createElement('canvas'); c.width=W; c.height=H;
  const g=c.getContext('2d');
  const sw=src.videoWidth||src.naturalWidth||src.width, sh=src.videoHeight||src.naturalHeight||src.height;
  const r=Math.min(sw/W, sh/H), cw=W*r, ch=H*r;
  if(mirror){ g.translate(W,0); g.scale(-1,1); }
  g.drawImage(src, (sw-cw)/2, (sh-ch)*.35, cw, ch, 0, 0, W, H);   // un poco más arriba del centro: ahí suele estar la cara
  return c.toDataURL('image/jpeg', .72);
}
function faceSet(img){
  if(img) store('uno_face', img); else store('uno_face', undefined);
  shareMyFace();
}
// le pasa mi foto a la sala (el anfitrión la reparte a todos)
function shareMyFace(){
  const img=myFace()||null, id=me(); if(!id) return;
  if(NET.mode==='client'){ if(NET.hostConn && NET.hostConn.open) try{ NET.hostConn.send({t:'face', img}); }catch(e){} }
  else if(NET.mode) hostSetFace(id, img);
}
function hostSetFace(pid, img){
  if(img && (typeof img!=='string' || !img.startsWith('data:image/jpeg') || img.length>40000)) return;
  if(img) FACES[pid]=img; else delete FACES[pid];
  if(NET.mode==='host') for(const k in NET.conns){ const c=NET.conns[k]; if(c && c.open) try{ c.send({t:'face', pid, img:img||null}); }catch(e){} }
  if(S) render();
}
function clientFace(d){
  if(d.t==='faces'){ FACES=d.map||{}; }
  else { if(d.img) FACES[d.pid]=d.img; else delete FACES[d.pid]; }
  if(S) render();
}

/* ---------- cámara en vivo ---------- */
function mkVideo(muted){
  const v=document.createElement('video'); v.autoplay=true; v.muted=true; v.setAttribute('playsinline',''); v.setAttribute('muted','');
  return v;
}
async function camToggle(){
  if(CAM.stream){ camStop(true); return faceModalRefresh(); }
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return toast('Este navegador no deja usar la cámara (se necesita https).');
  try{
    CAM.stream=await navigator.mediaDevices.getUserMedia({audio:false, video:{width:{ideal:160}, height:{ideal:120}, frameRate:{ideal:12, max:15}, facingMode:'user'}});
  }catch(e){ return toast('No se pudo prender la cámara. Revisá el permiso del navegador.'); }
  CAM.self=mkVideo(); CAM.self.srcObject=CAM.stream; CAM.self.play().catch(()=>{});
  doAct({type:'cam', on:true}); camSync();
  toast(NET.mode==='local' ? '🎥 Cámara prendida (en la práctica solo la ves vos).' : '🎥 Cámara prendida: los demás te ven en la cabecita arriba de tus cartas.');
  faceModalRefresh();
}
function camStop(tell){
  if(!CAM.stream) return;
  CAM.stream.getTracks().forEach(t=>t.stop()); CAM.stream=null;
  Object.values(CAM.calls).forEach(c=>{ try{ c.close(); }catch(e){} }); CAM.calls={};
  if(CAM.self){ CAM.self.srcObject=null; CAM.self.remove(); CAM.self=null; }
  if(tell) doAct({type:'cam', on:false});
  if(S) render();
}
// manda mi cámara a cada uno que está en la sala (igual que la voz)
function camSync(){
  if(!CAM.stream || !NET.peer || !V || NET.mode==='local') return;
  const myPeer=NET.peer.id, live=new Set();
  for(const p of [...V.players, ...(V.observers||[])]){
    if(!p.peerId || p.peerId===myPeer || !p.conn) continue;
    live.add(p.peerId);
    if(!CAM.calls[p.peerId]){
      const c=NET.peer.call(p.peerId, CAM.stream, {metadata:{kind:'cam'}}); if(!c) continue;
      CAM.calls[p.peerId]=c;
      const drop=()=>{ if(CAM.calls[p.peerId]===c) delete CAM.calls[p.peerId]; };
      c.on('close',drop); c.on('error',drop);
      setTimeout(()=>lowBitrate(c), 1500);
    }
  }
  for(const id in CAM.calls) if(!live.has(id)){ try{ CAM.calls[id].close(); }catch(e){} delete CAM.calls[id]; }
}
// calidad baja a propósito: gasta pocos datos aunque haya 10 cámaras
function lowBitrate(c){
  try{ c.peerConnection.getSenders().forEach(s=>{
    if(!s.track || s.track.kind!=='video') return;
    const p=s.getParameters(); if(!p.encodings || !p.encodings.length) p.encodings=[{}];
    p.encodings[0].maxBitrate=90000; p.encodings[0].maxFramerate=12;
    s.setParameters(p).catch(()=>{});
  }); }catch(e){}
}
function camOnCall(call){
  call.answer();
  call.on('stream', st=>{
    let v=CAM.videos[call.peer]; if(!v){ v=mkVideo(); CAM.videos[call.peer]=v; }
    v.srcObject=st; v.play().catch(()=>{}); headsAfterRender();
  });
  const drop=()=>{ const v=CAM.videos[call.peer]; if(v){ v.srcObject=null; v.remove(); delete CAM.videos[call.peer]; } };
  call.on('close',drop); call.on('error',drop);
}
function camsReset(){ camStop(false); Object.values(CAM.videos).forEach(v=>{ v.srcObject=null; v.remove(); }); CAM.videos={}; FACES={}; }

/* ---------- la cabeza arriba de las cartas ---------- */
function headHTML(p){
  const face=FACES[p.id];
  if(!face && !p.cam) return '';
  return `<div class="head" data-hp="${p.id}" style="--pc:${p.color}">${face?`<img src="${face}" alt="">`:`<span>${esc(p.emoji)}</span>`}${p.cam?'<i class="rec"></i>':''}</div>`;
}
// pone cada video en su cabeza (los videos no se vuelven a crear al redibujar la mesa)
function headsAfterRender(){
  if(!V) return;
  document.querySelectorAll('.head[data-hp]').forEach(h=>{
    const p=V.players.find(x=>x.id===h.dataset.hp); if(!p || !p.cam) return;
    const v = p.id===me() ? CAM.self : CAM.videos[p.peerId];
    if(!v) return;
    if(v.parentElement!==h) h.appendChild(v);
    h.classList.add('live'); if(v.paused) v.play().catch(()=>{});
  });
}

/* ---------- ventana "Tu cara" ---------- */
function faceModal(){
  if(window.SHOT_END){ SHOT_END(); SHOT_END=null; }
  const f=myFace(), p=(V && V.players.find(x=>x.id===me()))||{};
  modal(`<div id="faceBox"><h2>📷 Tu cara en la mesa</h2>
    <p class="muted" style="margin-top:0">Es opcional. Los demás te ven en una cabecita arriba de tus cartas: con una <b>foto</b> o con tu <b>cámara en vivo</b> (chiquita y en baja calidad, sin sonido).</p>
    <div class="facepv"><div class="head big ${CAM.stream?'live':''}" style="--pc:${p.color||'#888'}">${f?`<img src="${f}" alt="">`:`<span>${esc(p.emoji||myEmoji())}</span>`}</div></div>
    <button class="btn wide ${CAM.stream?'red':'green'}" onclick="camToggle()">${CAM.stream?'⏹️ Apagar mi cámara':'🎥 Prender mi cámara en vivo'}</button>
    <div class="row" style="margin-top:8px"><button class="btn" onclick="faceShoot()">📸 Sacar foto</button>
      <label class="btn" style="text-align:center">🖼️ Elegir foto<input type="file" accept="image/*" style="display:none" onchange="facePick(this)"></label></div>
    ${f?`<button class="btn gray wide" style="margin-top:8px" onclick="faceSet(null);faceModal()">🗑️ Quitar mi foto</button>`:''}
    <p class="muted">La foto se guarda en este aparato y se usa en las próximas partidas. Con la cámara prendida se ve el video en lugar de la foto.</p>
    <button class="btn dark wide" onclick="closeModal()">Listo</button></div>`);
  if(CAM.stream){ const h=$('.facepv .head'); const v=mkVideo(); v.srcObject=CAM.stream; v.play().catch(()=>{}); h.appendChild(v); }
}
function faceModalRefresh(){ if($('#faceBox') && $('#modal').classList.contains('on')) faceModal(); }
function facePick(inp){
  const f=inp.files && inp.files[0]; if(!f) return;
  const rd=new FileReader();
  rd.onload=()=>{ const im=new Image(); im.onload=()=>{ faceSet(faceFromImage(im, false)); toast('🖼️ ¡Listo! Ya se ve tu foto arriba de tus cartas.'); faceModal(); }; im.src=rd.result; };
  rd.readAsDataURL(f);
}
// sacar la foto con la cámara (si ya está prendida la cámara en vivo, usa esa)
async function faceShoot(){
  let st=CAM.stream, own=false;
  if(!st){
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return toast('Este navegador no deja usar la cámara. Probá con “Elegir foto”.');
    try{ st=await navigator.mediaDevices.getUserMedia({audio:false, video:{width:{ideal:480}, height:{ideal:360}, facingMode:'user'}}); own=true; }
    catch(e){ return toast('No se pudo usar la cámara. Revisá el permiso del navegador o probá con “Elegir foto”.'); }
  }
  modal(`<h2>📸 Sacate una foto</h2><p class="muted" style="margin-top:0">Poné la cara adentro de la cabeza y tocá “Sacar”.</p>
    <div class="facepv"><div class="head big live" id="shotHead" style="--pc:#f2c14e"></div></div>
    <div class="row"><button class="btn green" id="shotGo">📸 Sacar</button><button class="btn gray" id="shotNo">Cancelar</button></div>`);
  const v=mkVideo(); v.srcObject=st; v.play().catch(()=>{}); $('#shotHead').appendChild(v);
  const end=()=>{ if(own) st.getTracks().forEach(t=>t.stop()); window.SHOT_END=null; };
  window.SHOT_END=end;
  $('#shotGo').onclick=()=>{ if(!v.videoWidth) return; faceSet(faceFromImage(v, true)); end(); toast('📸 ¡Listo! Ya se ve tu foto arriba de tus cartas.'); faceModal(); };
  $('#shotNo').onclick=()=>{ end(); faceModal(); };
}
// si se cierra la ventana mientras se saca la foto, se apaga la cámara
const _closeModal=closeModal;
closeModal=function(){ if(window.SHOT_END) SHOT_END(); _closeModal(); };
