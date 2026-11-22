'use strict';
/* =====================================================================
   Carrera Guasu — volantes (Logitech G29 y otros) y mandos.
   - El navegador ve el volante como un mando "no estándar": el volante,
     los pedales y los botones vienen en otro orden que un joystick común.
   - Viene listo para el G29: volante en el eje 0, acelerador en el 2,
     freno en el 5; X lanza, O derrapa, las paletas también; Triángulo
     vuelve a la pista y Options pone pausa.
   - Para cualquier otro (o si los pedales salen al revés) hay un asistente
     que pide girar, pisar y tocar cada botón, y lo guarda en este aparato.
   ===================================================================== */
const PADS = load('kg_pads') || {};   // perfil de cada volante o mando (por su nombre)
const esVolante = g => /wheel|volante|racing|driving force|G2[79]\b|G9[0-9]{2}|thrustmaster|T150|T248|T300|TMX|T80|fanatec|moza|logitech.*c24f|046d.*c2(4f|62|66|6e|98|9a)/i.test(g.id);
function perfilBase(g){
  if(esVolante(g)) return {tipo:'volante', dir:{e:0, c:0, inv:false}, gas:{e:2, r:1, f:-1}, freno:{e:5, r:1, f:-1},
    botGas:[], botFreno:[], derrape:[2,4], usar:[0,5], volver:[3], pausa:[9], sens:2.5};
  // mando común (PlayStation / Xbox): X lanza, O derrapa, R2 acelera, L2 frena
  return {tipo:'mando', dir:{e:0, c:0, inv:false}, gas:null, freno:null, botGas:[7,2], botFreno:[6], derrape:[1,5], usar:[0,4], volver:[3], pausa:[9], sens:1, dpad:true};
}
const perfil = g => PADS[g.id] || perfilBase(g);
const nombrePad = g => g.id.replace(/\s*\((vendor|STANDARD).*$/i, '').replace(/\s*\(.*?\)\s*$/, '').trim() || 'Mando';
function padActivo(){ const ps=navigator.getGamepads ? navigator.getGamepads() : []; for(const g of ps) if(g && g.connected) return g; return null; }

// Chrome manda 0 en un pedal hasta que se lo toca por primera vez: mientras tanto cuenta como suelto
const VISTO = {};
function ejePedal(g, p){
  if(!p) return 0; const v=g.axes[p.e]; if(v==null) return 0;
  const k=g.index+':'+p.e;
  if(!VISTO[k]){ if(Math.abs(v)<.001) return 0; VISTO[k]=1; }
  const x=(v-p.r)/((p.f!=null?p.f:-p.r)-p.r || 1);
  return x<.06 ? 0 : Math.min(1, x);
}
const MANDO_PREV = {};
function leerMando(inp){
  const g=padActivo(); if(!g) return;
  const P=perfil(g), b=i=>!!(g.buttons[i] && g.buttons[i].pressed), alguno=l=>(l||[]).some(b);
  // volante o palanca
  const v=g.axes[P.dir.e];
  if(v!=null){ let x=(v-(P.dir.c||0))*(P.sens||1)*(P.dir.inv?-1:1); const dz=P.tipo==='volante'?.015:.15; if(Math.abs(x)>dz) inp.dir+=Math.max(-1, Math.min(1, x)); }
  if(P.dpad || P.tipo==='mando'){ if(b(14)) inp.dir-=1; if(b(15)) inp.dir+=1; }
  // pedales (o gatillos / botones)
  const gas=Math.max(ejePedal(g, P.gas), alguno(P.botGas)?1:0), fr=Math.max(ejePedal(g, P.freno), alguno(P.botFreno)?1:0);
  if(gas>.08) inp.gas=Math.max(inp.gas, gas>.85?1:gas);
  if(fr>.15) inp.freno=1;
  if(alguno(P.derrape)) inp.derrape=1;
  if(alguno(P.usar)) inp.usar=1;
  // botones de un toque
  const una=(k, l, fn)=>{ const on=alguno(l); if(on && !MANDO_PREV[k]) fn(); MANDO_PREV[k]=on; };
  una('pausa', P.pausa, ()=>pausar());
  una('volver', P.volver, ()=>volverPista());
}
addEventListener('gamepadconnected', e=>{
  const g=e.gamepad; toast(esVolante(g) ? `🏎️ Volante conectado: ${nombrePad(g)}. O derrapa, X lanza objetos.` : `🎮 Mando conectado: ${nombrePad(g)}. O derrapa, X lanza objetos, R2 acelera.`);
  if($('#padBox')) $('#padBox').innerHTML=padHTML();
});
addEventListener('gamepaddisconnected', ()=>{ if($('#padBox')) $('#padBox').innerHTML=padHTML(); });

/* ---------- en ⚙️ Ajustes ---------- */
function padHTML(){
  const g=padActivo();
  if(!g) return `<p class="muted" style="margin:6px 0">🎮 No hay volante ni mando a la vista. Si está enchufado, <b>girá el volante o apretá un botón</b> (el navegador no lo muestra hasta que lo tocás).</p>`;
  const P=perfil(g), prop=!!PADS[g.id];
  return `<div class="pinfo" style="margin:6px 0"><b>${esVolante(g)?'🏎️':'🎮'} ${esc(nombrePad(g))}</b> <span class="muted">${prop?'(configurado por vos)':'(de fábrica)'}</span>
    <div class="muted" style="margin-top:4px">${P.tipo==='volante'?'Volante dobla · acelerador y freno con los pedales':'Palanca o cruceta dobla · R2 acelera · L2 frena'} · <b>O</b> derrapa · <b>X</b> lanza · Triángulo vuelve a la pista · Options pausa</div>
    ${P.tipo==='volante'?`<label style="margin:8px 0 2px">Sensibilidad del volante <span class="muted" id="sensTxt">${sensTxt(P.sens)}</span></label><input type="range" min="1" max="5" step=".25" value="${P.sens}" oninput="padSens(this.value)" style="width:100%">`:''}
    <div class="row" style="margin-top:8px"><button class="btn sm" onclick="padAsistente()">🧭 Configurar paso a paso</button>${prop?`<button class="btn sm gray" onclick="padFabrica()">↩️ De fábrica</button>`:''}</div></div>`;
}
const sensTxt = s => `(doblás a fondo girando unos ${Math.round(450/s)}°)`;
function padSens(v){ const g=padActivo(); if(!g) return; const P=PADS[g.id]=Object.assign(perfil(g), {}); P.sens=+v; store('kg_pads', PADS); const t=$('#sensTxt'); if(t) t.textContent=sensTxt(P.sens); }
function padFabrica(){ const g=padActivo(); if(!g) return; Reflect.deleteProperty(PADS, g.id); store('kg_pads', PADS); $('#padBox').innerHTML=padHTML(); toast('Volvió a como venía de fábrica.'); }

/* ---------- asistente: girá, pisá, tocá ---------- */
const ASI = {on:false};
const PASOS = [
  {k:'centro', t:'Soltá todo', d:'Dejá el volante derecho y los pedales sueltos, sin tocar nada…'},
  {k:'dir', t:'Girá a la DERECHA', d:'Girá el volante (o mové la palanca) hacia la derecha y volvé al medio.'},
  {k:'gas', t:'ACELERAR', d:'Pisá el acelerador a fondo y soltalo (o apretá el gatillo o botón que quieras para acelerar).'},
  {k:'freno', t:'FRENAR', d:'Pisá el freno a fondo y soltalo (o apretá el gatillo o botón que quieras para frenar).'},
  {k:'derrape', t:'DERRAPAR', d:'Apretá el botón para derrapar (por ejemplo O).'},
  {k:'usar', t:'LANZAR OBJETOS', d:'Apretá el botón para lanzar los objetos (por ejemplo X).'},
];
function padAsistente(){
  const g=padActivo(); if(!g) return toast('Girá el volante o apretá un botón para que el navegador lo vea.');
  Object.assign(ASI, {on:true, i:0, id:g.id, base:null, t0:performance.now(), P:Object.assign(perfil(g), {}), ext:{}, espera:false});
  asiPintar(); requestAnimationFrame(asiPaso);
}
function asiPintar(msg){
  const p=PASOS[ASI.i];
  modal(`<h2>🧭 Configurar ${esc(nombrePad(padActivo()||{id:''}))}</h2>
    <div style="text-align:center;padding:10px 0"><div style="font-size:13px;color:#777">Paso ${ASI.i+1} de ${PASOS.length}</div>
    <div style="font:900 26px system-ui;margin:6px 0">${p.t}</div><p>${p.d}</p>
    <div style="height:8px;background:#e3d8bd;border-radius:5px;overflow:hidden"><div id="asiBar" style="height:100%;width:0;background:var(--green)"></div></div>
    <p class="muted" id="asiMsg">${msg||''}</p></div>
    <div class="row"><button class="btn gray" onclick="asiSaltar()">Saltar este paso</button><button class="btn red" onclick="asiCancelar()">Cancelar</button></div>`);
}
function asiCancelar(){ ASI.on=false; closeModal(); }
function asiSaltar(){ asiSiguiente('Saltado.'); }
function asiSiguiente(msg){
  ASI.i++; ASI.espera=true; ASI.ext={};
  if(ASI.i>=PASOS.length){ ASI.on=false; PADS[ASI.id]=ASI.P; store('kg_pads', PADS); modal(`<h2>✅ ¡Listo!</h2><p>Quedó guardado en este aparato. Ya podés correr con tu ${esc(nombrePad(padActivo()||{id:''}))}.</p><div id="padBox">${padHTML()}</div><button class="btn green wide" onclick="closeModal()">A correr 🏁</button>`); return; }
  asiPintar(msg);
}
function asiPaso(){
  if(!ASI.on) return;
  const g=padActivo(); if(!g || g.id!==ASI.id){ requestAnimationFrame(asiPaso); return; }
  const ax=[...g.axes], bt=g.buttons.map(x=>x.pressed), p=PASOS[ASI.i], P=ASI.P, bar=$('#asiBar');
  const quieto = ()=>!bt.some(Boolean) && (!ASI.base || ax.every((v,e)=>Math.abs(v-ASI.base[e])<.25 || Math.abs(ASI.base[e])>1.01 || (Math.abs(ASI.base[e])<.05 && Math.abs(Math.abs(v)-1)<.2 && e!==ASI.P.dir.e)));
  if(ASI.espera){ if(quieto()){ ASI.espera=false; ASI.t0=performance.now(); } requestAnimationFrame(asiPaso); return; }   // esperar que suelte todo entre paso y paso
  if(p.k==='centro'){
    const t=(performance.now()-ASI.t0)/1500; if(bar) bar.style.width=Math.min(100,t*100)+'%';
    if(t>=1){ ASI.base=ax; P.dir.c=0; asiSiguiente(); }
  } else if(p.k==='dir'){
    let best=-1, bv=0; ax.forEach((v,e)=>{ if(Math.abs(ASI.base[e])>1.01) return; const d=v-ASI.base[e]; if(Math.abs(d)>Math.abs(bv)){ bv=d; best=e; } });
    if(bar) bar.style.width=Math.min(100, Math.abs(bv)/.4*100)+'%';
    if(best>=0 && Math.abs(bv)>.4){ P.dir={e:best, c:Math.abs(ASI.base[best])<.2?ASI.base[best]:0, inv:bv<0}; P.dpad=P.tipo==='mando'; asiSiguiente('✔️ Volante en el eje '+best+(bv<0?' (al revés, ya lo di vuelta)':'')); }
  } else if(p.k==='gas' || p.k==='freno'){
    const bi=bt.findIndex(Boolean);
    if(bi>=0){ P[p.k]=null; P[p.k==='gas'?'botGas':'botFreno']=[bi]; ASI.botones=[...(ASI.botones||[]), bi]; asiSiguiente('✔️ Botón '+bi); requestAnimationFrame(asiPaso); return; }
    let best=-1, bv=0; ax.forEach((v,e)=>{ if(e===P.dir.e || Math.abs(ASI.base[e])>1.01) return; const d=v-ASI.base[e]; if(Math.abs(d)>Math.abs(bv)){ bv=d; best=e; } });
    if(best>=0){ const x=ASI.ext[best]; if(x==null || Math.abs(ax[best]-ASI.base[best])>Math.abs(x-ASI.base[best])) ASI.ext[best]=ax[best]; }
    if(bar) bar.style.width=Math.min(100, Math.abs(bv)/1.2*100)+'%';
    // cuando lo suelta después de haberlo pisado bastante, queda ese eje
    const e=Object.keys(ASI.ext).map(Number).sort((a,c)=>Math.abs(ASI.ext[c]-ASI.base[c])-Math.abs(ASI.ext[a]-ASI.base[a]))[0];
    // pedal que todavía no se había tocado (Chrome lo marca en 0): el reposo es el otro extremo
    const reposo = e==null ? 0 : Math.abs(ASI.base[e])<.05 ? -Math.sign(ASI.ext[e]) : ASI.base[e];
    if(e!=null && Math.abs(ASI.ext[e]-ASI.base[e])>.6 && Math.abs(ax[e]-reposo)<.2){
      const r=reposo, f=ASI.ext[e];
      P[p.k]={e, r, f}; P[p.k==='gas'?'botGas':'botFreno']=[]; ASI.base[e]=r; asiSiguiente('✔️ Pedal en el eje '+e);
    }
  } else {
    const bi=bt.findIndex(Boolean);
    if(bi>=0){ P[p.k]=[bi]; asiSiguiente('✔️ Botón '+bi); }
  }
  requestAnimationFrame(asiPaso);
}
