/* =====================================================================
   Micrófono de los juegos: con supresor de ruido o normal, y prueba de micrófono.
   El supresor es RNNoise (inteligencia artificial que saca ventiladores, aire acondicionado,
   tele, perros, etc.), el mismo de Salas de Voz (salas/vendor/). Viene prendido.
   Se engancha a navigator.mediaDevices.getUserMedia: cuando un juego pide solo el micrófono,
   la voz pasa por acá y el juego recibe la voz ya limpia, sin cambiar nada en el juego.
   Al lado del botón "Activar micrófono" de cada juego se agregan:
     🎚️ Sin ruido: SÍ/NO  → prende o apaga el supresor (si el micrófono está prendido, al instante)
     🧪 Probar            → medidor de voz y "grabar 4 segundos y escucharme"
   En la Lotería (barra de arriba con íconos) va un 🎚️ que abre la prueba, con el interruptor adentro.
   Salas de Voz y Karaoke tienen su propio procesamiento: ahí no se usa.
   ===================================================================== */
(function(){
  if(/\/(salas|karaoke)\//.test(location.pathname)) return;
  const md = navigator.mediaDevices;
  if(!md || !md.getUserMedia || !window.AudioContext && !window.webkitAudioContext) return;
  const BASE = new URL('salas/vendor/', (document.currentScript && document.currentScript.src) || location.href).href;
  const KEY = 'jpy_mic_modo';   // 'ia' (sin ruido, de entrada) | 'normal'
  let modo = 'ia'; try{ if(localStorage.getItem(KEY) === 'normal') modo = 'normal'; }catch(e){}
  const orig = md.getUserMedia.bind(md);
  const AU = { ctx:null, bin:null, ready:false, fallo:false };
  const VIVO = { raw:null, src:null, rn:null, dest:null };   // el micrófono que usa el juego
  const PRU = { raw:null, src:null, rn:null, dest:null, an:null, rec:null, timer:null };   // la prueba

  // --- RNNoise: se carga una sola vez ---
  const SIMD = new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11]);
  function ctx(){ if(!AU.ctx) AU.ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 }); if(AU.ctx.state === 'suspended') AU.ctx.resume().catch(()=>{}); return AU.ctx; }
  async function cargar(){
    if(AU.ready) return;
    const simd = WebAssembly.validate(SIMD);
    AU.bin = await fetch(BASE + (simd ? 'rnnoise_simd.wasm' : 'rnnoise.wasm')).then(r => { if(!r.ok) throw new Error('wasm ' + r.status); return r.arrayBuffer(); });
    await ctx().audioWorklet.addModule(BASE + 'rnnoise-worklet.js');
    AU.ready = true;
  }
  // arma el camino de la voz: micrófono → (supresor) → salida(s)
  async function conectar(c, salidas){
    try{ c.src.disconnect(); }catch(e){}
    if(c.rn){ try{ c.rn.disconnect(); c.rn.port.postMessage('destroy'); }catch(e){} c.rn = null; }
    let desde = c.src;
    if(modo === 'ia'){
      try{
        await cargar();
        c.rn = new AudioWorkletNode(ctx(), '@sapphi-red/web-noise-suppressor/rnnoise', { processorOptions:{ maxChannels:1, wasmBinary:AU.bin } });
        c.src.connect(c.rn); desde = c.rn;
      }catch(e){
        console.warn('supresor de ruido', e);
        if(!AU.fallo){ AU.fallo = true; aviso('No se pudo activar el supresor de ruido en este aparato: el micrófono anda normal.'); }
        modo = 'normal'; refrescar();
      }
    }
    salidas.forEach(s => s && desde.connect(s));
  }
  const pedido = audio => {   // con el supresor propio no hace falta el del navegador (los dos juntos ensucian la voz)
    const base = typeof audio === 'object' ? audio : { echoCancellation:true, autoGainControl:true };
    return { audio: { ...base, noiseSuppression: modo !== 'ia' } };
  };
  function soltar(c){
    if(c.raw) c.raw.getTracks().forEach(t => { try{ t.stop(); }catch(e){} });
    try{ c.src && c.src.disconnect(); }catch(e){}
    if(c.rn){ try{ c.rn.disconnect(); c.rn.port.postMessage('destroy'); }catch(e){} }
    Object.assign(c, { raw:null, src:null, rn:null, dest:null });
  }

  // --- el micrófono del juego ---
  md.getUserMedia = async function(c){
    if(!(c && c.audio && !c.video)) return orig(c);
    const raw = await orig(pedido(c.audio));
    try{
      soltar(VIVO);
      VIVO.raw = raw; VIVO.src = ctx().createMediaStreamSource(raw); VIVO.dest = ctx().createMediaStreamDestination();
      await conectar(VIVO, [VIVO.dest]);
      const out = VIVO.dest.stream, tr = out.getAudioTracks()[0], stop = tr.stop.bind(tr);
      tr.stop = () => { stop(); soltar(VIVO); refrescar(); };   // cuando el juego apaga el micrófono, se apaga todo
      setTimeout(refrescar, 50);
      return out;
    }catch(e){ console.warn('micrófono: se usa directo', e); return raw; }
  };

  // --- prender / apagar el supresor ---
  async function cambiar(){
    modo = modo === 'ia' ? 'normal' : 'ia';
    try{ localStorage.setItem(KEY, modo); }catch(e){}
    if(VIVO.src) await conectar(VIVO, [VIVO.dest]);
    if(PRU.src) await conectar(PRU, [PRU.an, PRU.dest]);
    refrescar();
    aviso(modo === 'ia' ? '🎚️ Supresor de ruido prendido: se saca el ruido de fondo.' : '🎙️ Micrófono normal, sin supresor.');
  }

  // --- probar el micrófono: medidor + grabar y escucharse ---
  async function abrirPrueba(){
    estilos();
    if(document.getElementById('micPrueba')) return;
    const d = document.createElement('div'); d.id = 'micPrueba';
    d.innerHTML = `<div class="c"><h3>🧪 Probar el micrófono</h3>
      <p>Hablá normal: la barra se mueve con tu voz. Si se mueve sola cuando no hablás, es ruido de fondo (probá con el supresor prendido).</p>
      <div class="vu"><i></i></div>
      <button class="t sup"></button>
      <button class="t rec">⏺ Grabar 4 segundos y escucharme</button>
      <p class="st"></p>
      <button class="t cerrar">Listo</button></div>`;
    document.body.appendChild(d);
    const barra = d.querySelector('.vu i'), st = d.querySelector('.st'), sup = d.querySelector('.sup'), rec = d.querySelector('.rec');
    const pintar = () => { sup.textContent = modo === 'ia' ? '🎚️ Sin ruido: SÍ (tocá para apagarlo)' : '🎚️ Sin ruido: NO (tocá para prenderlo)'; sup.classList.toggle('on', modo === 'ia'); };
    pintar(); d._pintar = pintar;
    sup.onclick = cambiar;
    d.querySelector('.cerrar').onclick = cerrarPrueba;
    d.onclick = e => { if(e.target === d) cerrarPrueba(); };
    try{
      PRU.raw = await orig(pedido(true));
      PRU.src = ctx().createMediaStreamSource(PRU.raw); PRU.an = ctx().createAnalyser(); PRU.an.fftSize = 1024; PRU.dest = ctx().createMediaStreamDestination();
      await conectar(PRU, [PRU.an, PRU.dest]);
    }catch(e){
      st.textContent = '⚠️ No se pudo usar el micrófono: ' + (e.name === 'NotAllowedError' ? 'el navegador no dio permiso. Tocá el candado de la barra de direcciones y permití el micrófono.' : (e.message || e));
      return;
    }
    const buf = new Float32Array(1024);
    PRU.timer = setInterval(() => {
      if(!PRU.an) return;
      PRU.an.getFloatTimeDomainData(buf);
      let s = 0; for(let i=0;i<buf.length;i++) s += buf[i]*buf[i];
      const db = 10*Math.log10(s/buf.length + 1e-12);   // de -70 (silencio) a -10 (fuerte)
      barra.style.width = Math.max(0, Math.min(100, (db + 70) / 60 * 100)) + '%';
      barra.classList.toggle('alto', db > -25);
    }, 60);
    rec.onclick = () => {
      if(!window.MediaRecorder){ st.textContent = 'Este navegador no deja grabar. El medidor igual muestra si el micrófono anda.'; return; }
      const partes = [], mr = new MediaRecorder(PRU.dest.stream); PRU.rec = mr;
      mr.ondataavailable = e => e.data.size && partes.push(e.data);
      mr.onstop = () => {
        if(!PRU.dest) return;
        const url = URL.createObjectURL(new Blob(partes, { type: mr.mimeType || 'audio/webm' })), a = new Audio(url);
        st.textContent = '🔊 Así te escuchan los demás…'; rec.disabled = false;
        a.onended = () => { st.textContent = '¿Se escucha bien? Podés grabar de nuevo, o probar con el supresor prendido y apagado.'; URL.revokeObjectURL(url); };
        a.play().catch(() => { st.textContent = 'No se pudo reproducir la grabación.'; });
      };
      mr.start(); rec.disabled = true;
      let n = 4; st.textContent = `⏺ Grabando… hablá ahora (${n})`;
      const t = setInterval(() => { n--; if(n > 0) st.textContent = `⏺ Grabando… hablá ahora (${n})`; else { clearInterval(t); try{ mr.stop(); }catch(e){} } }, 1000);
    };
  }
  function cerrarPrueba(){
    clearInterval(PRU.timer); try{ PRU.rec && PRU.rec.state === 'recording' && PRU.rec.stop(); }catch(e){}
    soltar(PRU); PRU.an = null; PRU.rec = null;
    const d = document.getElementById('micPrueba'); if(d) d.remove();
  }

  // --- botones al lado de "Activar micrófono" ---
  function asegurarBotones(){
    const mic = document.getElementById('btnMic');
    if(mic && !document.getElementById('btnSupresor')){
      const sup = document.createElement('button'); sup.id = 'btnSupresor'; sup.type = 'button'; sup.className = 'btn sm micExtra'; sup.onclick = cambiar;
      const pr = document.createElement('button'); pr.id = 'btnProbarMic'; pr.type = 'button'; pr.className = 'btn sm gray micExtra'; pr.textContent = '🧪 Probar'; pr.title = 'Probar el micrófono: medidor y grabar para escucharte'; pr.onclick = abrirPrueba;
      mic.insertAdjacentElement('afterend', pr); mic.insertAdjacentElement('afterend', sup);
      refrescar();
    }
    // Lotería: ícono en la barra de arriba (se vuelve a dibujar seguido)
    const ib = document.querySelector('#top .ib[data-act="mic"]');
    if(ib && !(ib.nextElementSibling && ib.nextElementSibling.id === 'icoSupresor')){
      const b = document.createElement('button'); b.id = 'icoSupresor'; b.type = 'button'; b.className = 'ib'; b.onclick = e => { e.stopPropagation(); abrirPrueba(); };
      ib.insertAdjacentElement('afterend', b); refrescar();
    }
  }
  function refrescar(){
    const sup = document.getElementById('btnSupresor');
    if(sup){ sup.textContent = modo === 'ia' ? '🎚️ Sin ruido: SÍ' : '🎚️ Sin ruido: NO'; sup.classList.toggle('green', modo === 'ia'); sup.classList.toggle('gray', modo !== 'ia');
      sup.title = 'Supresor de ruido (saca ventilador, aire, tele…): tocá para ' + (modo === 'ia' ? 'apagarlo' : 'prenderlo'); }
    const ico = document.getElementById('icoSupresor');
    if(ico){ ico.textContent = '🎚️'; ico.title = 'Micrófono: supresor de ruido ' + (modo === 'ia' ? 'prendido' : 'apagado') + ' y prueba del micrófono'; ico.style.opacity = modo === 'ia' ? '1' : '.55'; }
    const p = document.getElementById('micPrueba'); if(p && p._pintar) p._pintar();
  }

  // --- pantallitas ---
  const css = `
#micPrueba{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
#micPrueba .c{background:#fff8e6;color:#1d1d1d;border-radius:16px;padding:18px;max-width:380px;width:100%;box-shadow:0 10px 30px rgba(0,0,0,.5)}
#micPrueba h3{margin:0 0 6px;font-size:18px}#micPrueba p{margin:0 0 10px;font-size:14px;color:#444;line-height:1.4}
#micPrueba .vu{height:18px;border-radius:9px;background:#e2dcc6;overflow:hidden;margin:6px 0 10px}
#micPrueba .vu i{display:block;height:100%;width:0;background:linear-gradient(90deg,#2a9d3f,#7bd389);transition:width .06s}
#micPrueba .vu i.alto{background:linear-gradient(90deg,#2a9d3f,#f2c14e)}
#micPrueba .t{display:block;width:100%;border:0;border-radius:12px;padding:11px;margin-top:8px;font:inherit;font-weight:800;font-size:15px;cursor:pointer;background:#e2dcc6;color:#222}
#micPrueba .t.sup.on{background:#1f7a3a;color:#fff}#micPrueba .t.rec{background:#0038a8;color:#fff}#micPrueba .t.rec:disabled{opacity:.6}
#micPrueba .st{min-height:20px;margin:8px 0 0;font-weight:600;color:#1d1d1d}
.micExtra{flex:0 0 auto}
#micAviso{position:fixed;left:50%;bottom:58px;transform:translateX(-50%);z-index:99999;background:#222;color:#fff;padding:9px 14px;border-radius:10px;font:14px system-ui,sans-serif;max-width:90vw;text-align:center;box-shadow:0 4px 14px rgba(0,0,0,.5)}`;
  function estilos(){ if(document.getElementById('micCss')) return; const st=document.createElement('style'); st.id='micCss'; st.textContent=css; document.head.appendChild(st); }
  function aviso(t){ estilos(); const d=document.createElement('div'); d.id='micAviso'; d.textContent=t; document.body.appendChild(d); setTimeout(()=>d.remove(), 3800); }

  function iniciar(){
    estilos(); asegurarBotones();
    new MutationObserver(() => { if(!iniciar.p){ iniciar.p = true; requestAnimationFrame(() => { iniciar.p = false; asegurarBotones(); }); } })
      .observe(document.body, { childList:true, subtree:true });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
  window.MIC_RUIDO = { modo: () => modo, cambiar, probar: abrirPrueba };
})();
