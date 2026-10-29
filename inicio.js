/* =====================================================================
   Botón 🏠 para volver a la portada con todos los juegos.
   Está en el mismo lugar en todos los juegos (arriba a la izquierda).
   Cada juego puede decir si hay una partida en curso y cómo se sale:
     window.INICIO = { enJuego(){...}, preguntar(){...}, salida:'leaveToMenu' }
   - enJuego(): true si está en una sala o partida.
   - preguntar(): abre la pregunta propia del juego para salir (con traspaso de anfitrión, etc.).
   - salida: nombre de la función global que el juego llama cuando terminó de salir;
     después de esa función se va a la portada.
   Si no hay preguntar(), se pregunta acá (con "pregunta" si el juego la da) y se llama a
   salir() o a la salida; después se va a la portada.
   ===================================================================== */
(function(){
  const PORTADA = '../';
  const css = `
#inicioBtn{position:absolute;z-index:9000;top:max(8px,env(safe-area-inset-top));left:max(8px,env(safe-area-inset-left));
  width:40px;height:40px;border-radius:50%;border:2px solid rgba(255,255,255,.55);background:rgba(15,12,30,.72);color:#fff;
  font-size:19px;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;
  box-shadow:0 3px 10px rgba(0,0,0,.45);-webkit-tap-highlight-color:transparent;touch-action:manipulation;text-decoration:none;
  backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
#inicioBtn:hover{background:rgba(40,32,80,.9);border-color:#fff}
#inicioBtn:active{transform:scale(.92)}
#inicioBtn.suave{opacity:.55}
#inicioTip{position:absolute;z-index:9000;top:calc(max(8px,env(safe-area-inset-top)) + 46px);left:max(8px,env(safe-area-inset-left));
  background:#111;color:#fff;font:600 12px system-ui,sans-serif;padding:5px 9px;border-radius:8px;pointer-events:none;opacity:0;transition:opacity .2s;white-space:nowrap}
#inicioBtn:hover + #inicioTip{opacity:1}
@media print{#inicioBtn,#inicioTip{display:none}}`;
  let armado=0, envuelta=false;
  function irPortada(){ location.href = PORTADA; }
  function envolver(nombre){
    if(envuelta || !nombre || typeof window[nombre]!=='function') return;
    const orig=window[nombre]; envuelta=true;
    window[nombre]=function(){ const r=orig.apply(this, arguments); if(Date.now()<armado){ armado=0; setTimeout(irPortada, 150); } return r; };
  }
  function click(e){
    e.preventDefault();
    const G=window.INICIO||{};
    let jugando=false; try{ jugando=!!(G.enJuego && G.enJuego()); }catch(err){}
    if(!jugando) return irPortada();
    if(G.preguntar){
      envolver(G.salida);
      armado=Date.now()+30000;   // si en 30 s no salió, el próximo "salir" del juego ya no lleva a la portada
      try{ G.preguntar(); }catch(err){ irPortada(); }
      return;
    }
    if(!confirm(G.pregunta || '¿Salir de la partida y volver a todos los juegos?')) return;
    try{ if(G.salir) G.salir(); else if(G.salida && typeof window[G.salida]==='function') window[G.salida](); }catch(err){}
    setTimeout(irPortada, 700);
  }
  function poner(){
    if(document.getElementById('inicioBtn')) return;
    const st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);
    const a=document.createElement('a'); a.id='inicioBtn'; a.href=PORTADA; a.title='Todos los juegos'; a.setAttribute('aria-label','Volver a todos los juegos'); a.textContent='🏠';
    a.addEventListener('click', click);
    const tip=document.createElement('div'); tip.id='inicioTip'; tip.textContent='Todos los juegos';
    document.body.append(a, tip);
    // en los juegos de acción (pelea, carrera) el botón se ve más suave mientras se juega
    setInterval(()=>{ const G=window.INICIO||{}; let s=false; try{ s=!!(G.suave && G.enJuego && G.enJuego()); }catch(e){} a.classList.toggle('suave', s); }, 800);
  }
  if(document.body) poner(); else document.addEventListener('DOMContentLoaded', poner);
})();
