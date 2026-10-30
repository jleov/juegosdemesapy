/* =====================================================================
   Micrófono de los juegos: normal o con supresor de ruido.
   El supresor es RNNoise (inteligencia artificial que saca ventiladores, aire acondicionado,
   teclas, perros, etc.), el mismo de Salas de Voz (salas/vendor/).
   Se engancha a navigator.mediaDevices.getUserMedia: cuando un juego pide solo el micrófono,
   la voz pasa por acá y el juego recibe la voz ya limpia, sin cambiar nada en el juego.
   - La primera vez pregunta Normal o Sin ruido (y si se recuerda la elección).
   - Mientras el micrófono está prendido aparece 🎚️ abajo a la izquierda para cambiar al instante,
     sin cortar la llamada (se cambia el camino de la voz, no el micrófono).
   Salas de Voz y Karaoke tienen su propio procesamiento: ahí no se usa.
   ===================================================================== */
(function(){
  if(/\/(salas|karaoke)\//.test(location.pathname)) return;
  const md = navigator.mediaDevices;
  if(!md || !md.getUserMedia || !window.AudioContext && !window.webkitAudioContext) return;
  const BASE = new URL('salas/vendor/', (document.currentScript && document.currentScript.src) || location.href).href;
  const KEY = 'jpy_mic_modo';   // 'ia' (sin ruido) | 'normal'
  let modo = null; try{ modo = localStorage.getItem(KEY); }catch(e){}
  const orig = md.getUserMedia.bind(md);
  const M = { ctx:null, bin:null, ready:false, src:null, rn:null, dest:null, raw:null, out:null };

  // --- RNNoise: se carga una sola vez ---
  const SIMD = new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11]);
  async function cargar(){
    if(M.ready) return;
    const simd = WebAssembly.validate(SIMD);
    M.bin = await fetch(BASE + (simd ? 'rnnoise_simd.wasm' : 'rnnoise.wasm')).then(r => { if(!r.ok) throw new Error('wasm ' + r.status); return r.arrayBuffer(); });
    await M.ctx.audioWorklet.addModule(BASE + 'rnnoise-worklet.js');
    M.ready = true;
  }
  // camino de la voz: micrófono → (supresor) → salida que recibe el juego
  async function conectar(){
    try{ M.src.disconnect(); }catch(e){}
    if(M.rn){ try{ M.rn.disconnect(); M.rn.port.postMessage('destroy'); }catch(e){} M.rn = null; }
    if(modo === 'ia'){
      try{
        await cargar();
        M.rn = new AudioWorkletNode(M.ctx, '@sapphi-red/web-noise-suppressor/rnnoise', { processorOptions:{ maxChannels:1, wasmBinary:M.bin } });
        M.src.connect(M.rn); M.rn.connect(M.dest); return true;
      }catch(e){ console.warn('supresor de ruido', e); aviso('No se pudo activar el supresor de ruido en este aparato: el micrófono anda normal.'); }
    }
    M.src.connect(M.dest); return false;
  }

  md.getUserMedia = async function(c){
    const soloAudio = c && c.audio && !c.video;
    if(!soloAudio) return orig(c);
    if(modo !== 'ia' && modo !== 'normal'){
      const r = await preguntar(); modo = r.modo;
      if(r.recordar) try{ localStorage.setItem(KEY, modo); }catch(e){}
    }
    // con el supresor propio no hace falta el del navegador (los dos juntos ensucian la voz)
    const pedir = typeof c.audio === 'object' ? { ...c.audio, noiseSuppression: modo !== 'ia' } : { noiseSuppression: modo !== 'ia', echoCancellation:true, autoGainControl:true };
    const raw = await orig({ audio: pedir });
    try{
      if(!M.ctx) M.ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
      if(M.ctx.state === 'suspended') await M.ctx.resume();
      apagar(true);
      M.raw = raw; M.src = M.ctx.createMediaStreamSource(raw); M.dest = M.ctx.createMediaStreamDestination();
      await conectar();
      const out = M.dest.stream; M.out = out;
      const tr = out.getAudioTracks()[0], stop = tr.stop.bind(tr);
      tr.stop = () => { stop(); apagar(); };   // cuando el juego apaga el micrófono, se apaga todo
      pill(true);
      return out;
    }catch(e){
      console.warn('micrófono: se usa directo', e);
      return raw;
    }
  };
  function apagar(cambiando){
    if(M.raw) M.raw.getTracks().forEach(t => { try{ t.stop(); }catch(e){} });
    try{ M.src && M.src.disconnect(); }catch(e){}
    if(M.rn){ try{ M.rn.disconnect(); M.rn.port.postMessage('destroy'); }catch(e){} }
    Object.assign(M, { raw:null, src:null, rn:null, dest:null, out:null });
    if(!cambiando) pill(false);
  }

  // --- pantallitas ---
  const css = `
#micOpc{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
#micOpc .c{background:#fff8e6;color:#1d1d1d;border-radius:16px;padding:18px;max-width:380px;width:100%;box-shadow:0 10px 30px rgba(0,0,0,.5)}
#micOpc h3{margin:0 0 6px;font-size:18px}#micOpc p{margin:0 0 12px;font-size:14px;color:#444;line-height:1.4}
#micOpc button{display:block;width:100%;border:0;border-radius:12px;padding:12px;margin-top:8px;font:inherit;font-weight:800;font-size:15px;cursor:pointer;text-align:left}
#micOpc button small{display:block;font-weight:500;font-size:12.5px;opacity:.85;margin-top:2px}
#micOpc .ia{background:#1f7a3a;color:#fff}#micOpc .nor{background:#e2dcc6;color:#222}
#micOpc label{display:flex;gap:8px;align-items:center;margin-top:12px;font-size:13px;color:#444}
#micPill{position:fixed;left:max(8px,env(safe-area-inset-left));bottom:max(8px,env(safe-area-inset-bottom));z-index:9500;border:2px solid rgba(255,255,255,.6);border-radius:20px;
  background:rgba(15,12,30,.8);color:#fff;font:700 12.5px system-ui,sans-serif;padding:6px 11px;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,.45);display:none}
#micPill.on{display:block}#micPill.ia{background:rgba(31,122,58,.92)}
#micAviso{position:fixed;left:50%;bottom:58px;transform:translateX(-50%);z-index:99999;background:#222;color:#fff;padding:9px 14px;border-radius:10px;font:14px system-ui,sans-serif;max-width:90vw;text-align:center;box-shadow:0 4px 14px rgba(0,0,0,.5)}`;
  function estilos(){ if(document.getElementById('micCss')) return; const st=document.createElement('style'); st.id='micCss'; st.textContent=css; document.head.appendChild(st); }
  function aviso(t){ estilos(); const d=document.createElement('div'); d.id='micAviso'; d.textContent=t; document.body.appendChild(d); setTimeout(()=>d.remove(), 3800); }
  function preguntar(){
    estilos();
    return new Promise(res => {
      const d=document.createElement('div'); d.id='micOpc';
      d.innerHTML=`<div class="c"><h3>🎙️ ¿Cómo querés tu micrófono?</h3>
        <p>Si tenés ventilador, aire, tele o ruido de la calle, el supresor los saca y los demás te escuchan solo a vos.</p>
        <button class="ia">🎚️ Sin ruido (supresor)<small>Recomendado: limpia tu voz con inteligencia artificial</small></button>
        <button class="nor">🎙️ Normal<small>Como siempre, sin procesar</small></button>
        <label><input type="checkbox" checked> Recordar mi elección (se cambia con 🎚️ abajo a la izquierda)</label></div>`;
      document.body.appendChild(d);
      const fin = m => { const r=d.querySelector('input').checked; d.remove(); res({modo:m, recordar:r}); };
      d.querySelector('.ia').onclick = () => fin('ia');
      d.querySelector('.nor').onclick = () => fin('normal');
    });
  }
  function pill(on){
    estilos();
    let b=document.getElementById('micPill');
    if(!b){ b=document.createElement('button'); b.id='micPill'; b.type='button'; b.onclick=cambiar; document.body.appendChild(b); }
    b.classList.toggle('on', on);
    b.classList.toggle('ia', modo === 'ia');
    b.textContent = modo === 'ia' ? '🎚️ Sin ruido: SÍ' : '🎚️ Sin ruido: NO';
    b.title = 'Tocá para ' + (modo === 'ia' ? 'apagar' : 'prender') + ' el supresor de ruido';
  }
  async function cambiar(){
    modo = modo === 'ia' ? 'normal' : 'ia';
    try{ localStorage.setItem(KEY, modo); }catch(e){}
    if(M.src && M.dest){ const ok = await conectar(); if(modo === 'ia' && !ok) modo = 'normal'; }
    pill(!!M.dest);
    aviso(modo === 'ia' ? '🎚️ Supresor de ruido prendido: se saca el ruido de fondo.' : '🎙️ Micrófono normal, sin supresor.');
  }
  window.MIC_RUIDO = { modo: () => modo, cambiar };
})();
